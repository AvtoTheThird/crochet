/**
 * Supabase project persistence — DB row + Storage PNG for working canvas.
 */
import { state } from './state.js';
import { dom } from './dom.js';
import { setStartDirection } from './grid.js';
import { runLengthEncode } from './count.js';
import { buildWalkStepsFromCountResults } from './pattern-walk.js';
import { updateBaseDisplayScale, resetZoomBakeCache, centerCanvasInView } from './viewport.js';
import { getSupabase } from '$lib/supabase/client.js';
import { auth } from '$lib/supabase/session.svelte.js';

const BUCKET = 'project-images';
let saveChain = Promise.resolve();

function requireUserId() {
	const id = auth.user?.id;
	if (!id) throw new Error('You must be logged in to save projects.');
	return id;
}

function canvasToBlob(canvas) {
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			blob ? resolve(blob) : reject(new Error('toBlob failed'));
		}, 'image/png');
	});
}

function defaultProjectName() {
	if (state.projectName) return state.projectName;
	if (state.loadedFileName) {
		const base = state.loadedFileName.replace(/\.[^.]+$/, '');
		return base || 'Untitled Pattern';
	}
	return 'Untitled Pattern';
}

function readNum(id, fallback) {
	const n = parseFloat(document.getElementById(id)?.value ?? '');
	return Number.isFinite(n) && n > 0 ? n : fallback;
}

function readInt(id, fallback) {
	const n = parseInt(document.getElementById(id)?.value ?? '', 10);
	return Number.isFinite(n) ? n : fallback;
}

function directionToDb(dir) {
	return dir === 'rtl' ? 'right' : 'left';
}

function directionFromDb(dir) {
	return dir === 'right' ? 'rtl' : 'ltr';
}

function buildPaletteJson() {
	/** @type {Map<string, {hex:string,r:number,g:number,b:number,count:number,yarn_label:string}>} */
	const map = new Map();
	for (const row of state.countGrid) {
		for (const cell of row) {
			if (!cell) continue;
			const key = cell.hex;
			const existing = map.get(key);
			if (existing) {
				existing.count += 1;
			} else {
				map.set(key, {
					hex: cell.hex,
					r: cell.r,
					g: cell.g,
					b: cell.b,
					count: 1,
					yarn_label: (cell.name || cell.hex).trim() || cell.hex
				});
			}
		}
	}
	return [...map.values()];
}

function buildCountResultsJson() {
	const cols = state.countMetrics?.cols;
	return (state.countResults || []).map((row) => ({
		logRow: row.logRow,
		imgRow: row.imgRow,
		dir: row.dir,
		cols: row.cols ?? cols,
		segments: (row.segments || []).map((seg) => ({
			color: {
				hex: seg.color?.hex || '#000000',
				name: seg.color?.name || seg.color?.hex || ''
			},
			count: seg.count
		}))
	}));
}

function applyPaletteToMaps(palette) {
	state.yarnColors.clear();
	state.sourceToYarn.clear();
	for (const entry of palette || []) {
		const hex = entry.hex || '#000000';
		const id = `yarn-${hex.replace('#', '')}`;
		const yarn = {
			id,
			r: entry.r ?? 0,
			g: entry.g ?? 0,
			b: entry.b ?? 0,
			hex,
			name: entry.yarn_label || hex
		};
		state.yarnColors.set(id, yarn);
		state.sourceToYarn.set(hex, id);
	}
}

/**
 * Rebuild per-cell grid from boustrophedon count_results.
 * @param {any[]} countResults
 * @param {{ cols: number, rows: number, pw: number, ph: number }} metrics
 */
function rebuildCountGridFromResults(countResults, metrics) {
	const { cols, rows } = metrics;
	/** @type {any[][]} */
	const grid = Array.from({ length: rows }, () => Array(cols).fill(null));

	for (const rowResult of countResults || []) {
		const imgRow = rowResult.imgRow;
		if (imgRow < 0 || imgRow >= rows) continue;
		const leftToRight = rowResult.dir === '→';
		let col = leftToRight ? 0 : cols - 1;
		const step = leftToRight ? 1 : -1;

		for (const seg of rowResult.segments || []) {
			const hex = seg.color?.hex || '#000000';
			const yarnId = state.sourceToYarn.get(hex);
			const yarn = yarnId ? state.yarnColors.get(yarnId) : null;
			const cell = {
				r: yarn?.r ?? 0,
				g: yarn?.g ?? 0,
				b: yarn?.b ?? 0,
				hex: yarn?.hex ?? hex,
				sourceHex: hex,
				name: yarn?.name ?? seg.color?.name ?? hex,
				yarnId: yarnId || null
			};
			for (let i = 0; i < (seg.count || 0); i++) {
				if (col >= 0 && col < cols) grid[imgRow][col] = { ...cell };
				col += step;
			}
		}
	}
	return grid;
}

function imagePath(userId, projectId) {
	return `${userId}/${projectId}.png`;
}

function currentWalkRow() {
	const step = state.patternWalk.steps[state.patternWalk.currentIndex];
	return step?.logRow ?? 0;
}

async function buildDbRow(userId, projectId, name, imagePathValue) {
	const pw = readNum('px-w', state.countMetrics?.pw || 8);
	const ph = readNum('px-h', state.countMetrics?.ph || 8);
	const tolerance = readInt('tolerance', 20);
	const gridOpacity = readInt('grid-opacity', 35);

	return {
		id: projectId,
		user_id: userId,
		name,
		image_url: imagePathValue,
		image_width: state.workingCanvas.width,
		image_height: state.workingCanvas.height,
		pixel_width: Number(pw),
		pixel_height: Number(ph),
		color_tolerance: tolerance,
		start_direction: directionToDb(state.startDirection),
		palette: buildPaletteJson(),
		count_results: buildCountResultsJson(),
		grid_opacity: gridOpacity,
		current_row: currentWalkRow(),
		completed_rows: state.completedRows || [],
		studio_step: state.currentStep,
		walk_index: state.patternWalk.currentIndex || 0
	};
}

/**
 * @param {{ promptName?: boolean, silent?: boolean }} [options]
 */
export function persistProject(options = {}) {
	if (!state.workingCanvas) return Promise.resolve(null);

	const run = async () => {
		const userId = requireUserId();
		let name = state.projectName || defaultProjectName();
		let id = state.projectId;
		const isNew = !id;

		if (isNew) {
			const { assertCanCreateProject } = await import('$lib/supabase/entitlements.js');
			await assertCanCreateProject();
		}

		if (options.promptName) {
			const prompted = prompt('Project name:', name);
			if (prompted === null) return null;
			name = prompted.trim() || name;
		}

		if (!id) id = crypto.randomUUID();

		const blob = await canvasToBlob(state.workingCanvas);
		const path = imagePath(userId, id);
		const supabase = getSupabase();

		const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, blob, {
			upsert: true,
			contentType: 'image/png',
			cacheControl: '3600'
		});
		if (uploadError) throw uploadError;

		const row = await buildDbRow(userId, id, name, path);
		const { data, error } = await supabase.from('projects').upsert(row).select().single();
		if (error) throw error;

		state.projectId = id;
		state.projectName = name;

		if (isNew) {
			const { markFreeProjectUsed } = await import('$lib/supabase/entitlements.js');
			await markFreeProjectUsed();
		}

		return data;
	};

	saveChain = saveChain.then(run, run);
	return saveChain;
}

export function autoSaveProject() {
	if (!auth.user) return Promise.resolve(null);
	return persistProject({ silent: true })
		.then((record) => {
			if (record) renderProjectList();
			return record;
		})
		.catch((e) => {
			if (e?.code === 'PROJECT_LIMIT') return;
			console.warn('Auto-save failed:', e);
		});
}

export function saveProject() {
	if (!state.workingCanvas) {
		alert('No image loaded.');
		return;
	}
	if (!auth.user) {
		alert('You must be logged in to save.');
		return;
	}
	persistProject({ promptName: !state.projectId })
		.then((record) => {
			if (!record) return;
			const btn = document.getElementById('save-project-btn');
			if (btn) {
				const orig = btn.textContent;
				btn.textContent = '✓ Saved!';
				setTimeout(() => {
					btn.textContent = orig;
				}, 1600);
			}
			renderProjectList();
		})
		.catch((e) => {
			if (e?.code === 'PROJECT_LIMIT') return;
			alert('Save failed: ' + (e.message || e));
		});
}

export async function deleteProject(id) {
	if (!confirm('Delete this project?')) return;
	try {
		const userId = requireUserId();
		const supabase = getSupabase();
		await supabase.storage.from(BUCKET).remove([imagePath(userId, id)]);
		const { error } = await supabase.from('projects').delete().eq('id', id);
		if (error) throw error;
		if (state.projectId === id) {
			state.projectId = null;
			state.projectName = null;
		}
		renderProjectList();
	} catch (e) {
		alert('Delete failed: ' + (e.message || e));
	}
}

export async function loadProjectById(id) {
	try {
		const supabase = getSupabase();
		const { data: row, error } = await supabase.from('projects').select('*').eq('id', id).single();
		if (error) throw error;
		if (!row) {
			alert('Project not found.');
			return;
		}

		const { data: file, error: dlError } = await supabase.storage.from(BUCKET).download(row.image_url);
		if (dlError) throw dlError;

		await restoreFromSupabase(row, file);
	} catch (e) {
		alert('Load failed: ' + (e.message || e));
	}
}

/**
 * @param {Record<string, any>} row
 * @param {Blob} imageBlob
 */
function restoreFromSupabase(row, imageBlob) {
	return new Promise((resolve, reject) => {
		state.projectId = row.id;
		state.projectName = row.name;
		const url = URL.createObjectURL(imageBlob);
		const img = new Image();
		img.onload = async () => {
			URL.revokeObjectURL(url);
			resetZoomBakeCache();
			state.workingCanvas = document.createElement('canvas');
			state.workingCanvas.width = img.width;
			state.workingCanvas.height = img.height;
			state.workingCtx = state.workingCanvas.getContext('2d', { willReadFrequently: true });
			state.workingCtx.drawImage(img, 0, 0);
			state.zoomLevel = 1;
			state.pixelData = null;
			state.highlightedSourceHex = null;
			state.viewPanning = null;
			state.cropDragging = null;
			state.cropRect = { x: 0, y: 0, w: img.width, h: img.height };
			state.completedRows = Array.isArray(row.completed_rows) ? [...row.completed_rows] : [];

			const setVal = (elId, v) => {
				const el = document.getElementById(elId);
				if (el && v !== undefined && v !== null) el.value = String(v);
			};

			setVal('px-w', row.pixel_width);
			setVal('px-h', row.pixel_height);
			const cols = Math.max(1, Math.floor(img.width / row.pixel_width));
			const rows = Math.max(1, Math.floor(img.height / row.pixel_height));
			setVal('grid-cols-input', cols);
			setVal('grid-rows-input', rows);
			setVal('tolerance', row.color_tolerance);
			const tolVal = document.getElementById('tol-val');
			if (tolVal) tolVal.textContent = String(row.color_tolerance ?? 20);
			setVal('grid-opacity', row.grid_opacity);
			const opVal = document.getElementById('grid-opacity-val');
			if (opVal) opVal.textContent = String(row.grid_opacity ?? 35);

			setStartDirection(directionFromDb(row.start_direction));

			state.countMetrics = {
				pw: Number(row.pixel_width),
				ph: Number(row.pixel_height),
				cols,
				rows
			};

			applyPaletteToMaps(row.palette);
			state.countResults = Array.isArray(row.count_results) ? row.count_results : [];

			if (state.countResults.length) {
				state.countGrid = rebuildCountGridFromResults(state.countResults, state.countMetrics);
			} else {
				state.countGrid = [];
			}

			const { invalidateColorPreviewCache } = await import('./color-correction.js');
			invalidateColorPreviewCache();

			if (state.countGrid.length && state.countMetrics) {
				if (!state.countResults.length) runLengthEncode();
				const step = row.studio_step || 2;
				// Walk is step 5 now (was 6). Old projects at Count (5) or Walk (6) both open walk.
				if (step >= 5 || (row.walk_index > 0 && state.countResults.length)) {
					state.patternWalk.steps = buildWalkStepsFromCountResults();
					state.patternWalk.currentIndex = Math.min(
						row.walk_index || 0,
						Math.max(0, state.patternWalk.steps.length - 1)
					);
				}
			}

			if (dom.dropZone) dom.dropZone.style.display = 'none';
			if (dom.wrapper) dom.wrapper.style.display = 'block';
			if (dom.canvasArea) dom.canvasArea.classList.add('has-image');
			updateBaseDisplayScale();

			let targetStep = row.studio_step || (state.countResults.length ? 5 : 3);
			if (targetStep > 5) targetStep = 5; // legacy Walk was step 6
			const { goStep } = await import('./steps.js');
			goStep(targetStep, { replaceState: true });
			centerCanvasInView();
			resolve();
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Could not restore image.'));
		};
		img.src = url;
	});
}

export async function renderProjectList() {
	const container = document.getElementById('project-list');
	if (!container) return;

	if (!auth.user) {
		container.innerHTML =
			'<p style="font-size:0.65rem;color:var(--text-dim);padding:4px 0">Log in to see saved projects.</p>';
		return;
	}

	try {
		const { projectQuotaLabel } = await import('$lib/supabase/entitlements.js');
		const quota = await projectQuotaLabel();

		const supabase = getSupabase();
		const { data: records, error } = await supabase
			.from('projects')
			.select('id, name, updated_at, studio_step, is_published, gallery_description')
			.order('updated_at', { ascending: false });
		if (error) throw error;

		container.innerHTML = '';
		if (quota) {
			const q = document.createElement('p');
			q.className = 'project-quota';
			q.style.cssText = 'font-size:0.62rem;color:var(--text-dim);padding:0 0 4px;margin:0';
			q.textContent = quota;
			container.appendChild(q);
		}

		if (!records?.length) {
			const empty = document.createElement('p');
			empty.style.cssText = 'font-size:0.65rem;color:var(--text-dim);padding:4px 0;margin:0';
			empty.textContent = 'No saved projects yet.';
			container.appendChild(empty);
			return;
		}

		const stepLabels = ['', 'Load', 'Crop', 'Grid', 'Colors', 'Walk'];
		for (const proj of records) {
			let date = '';
			try {
				date = new Date(proj.updated_at).toLocaleDateString();
			} catch {
				/* ignore */
			}
			const stepN = proj.studio_step === 6 ? 5 : proj.studio_step;
			const published = !!proj.is_published;
			const item = document.createElement('div');
			item.className =
				'project-list-item' + (proj.id === state.projectId ? ' is-current' : '');
			item.innerHTML =
				`<div class="project-list-name">${escapeHtml(proj.name)}</div>` +
				`<div class="project-list-meta">${date} · ${stepLabels[stepN] || 'Saved'}${published ? ' · In gallery' : ''}</div>` +
				'<div class="project-list-actions">' +
				`<button type="button" class="btn btn-primary project-load-btn" style="font-size:0.62rem;padding:5px 10px" data-id="${proj.id}">Load</button>` +
				`<button type="button" class="btn btn-secondary project-publish-btn" style="font-size:0.62rem;padding:5px 8px" data-id="${proj.id}" data-published="${published ? '1' : '0'}">${published ? 'Unpublish' : 'Publish'}</button>` +
				`<button type="button" class="btn btn-danger project-delete-btn" style="font-size:0.62rem;padding:5px 8px" data-id="${proj.id}">✕</button>` +
				'</div>';
			container.appendChild(item);
		}
		container.querySelectorAll('.project-load-btn').forEach((btn) => {
			btn.addEventListener('click', () => loadProjectById(btn.getAttribute('data-id')));
		});
		container.querySelectorAll('.project-publish-btn').forEach((btn) => {
			btn.addEventListener('click', () =>
				togglePublishProject(
					btn.getAttribute('data-id'),
					btn.getAttribute('data-published') === '1'
				)
			);
		});
		container.querySelectorAll('.project-delete-btn').forEach((btn) => {
			btn.addEventListener('click', () => deleteProject(btn.getAttribute('data-id')));
		});
	} catch (e) {
		console.warn('renderProjectList:', e);
		container.innerHTML =
			'<p style="font-size:0.65rem;color:var(--accent2);padding:4px 0">Could not load projects.</p>';
	}
}

async function togglePublishProject(id, isPublished) {
	try {
		const {
			publishProjectToGallery,
			unpublishProjectFromGallery
		} = await import('$lib/supabase/gallery.js');
		if (isPublished) {
			if (!confirm('Remove this project from the public gallery?')) return;
			await unpublishProjectFromGallery(id);
		} else {
			const supabase = getSupabase();
			const { data: row } = await supabase
				.from('projects')
				.select('gallery_description')
				.eq('id', id)
				.maybeSingle();
			const desc = prompt(
				'Gallery description (shown publicly with the image):',
				row?.gallery_description || ''
			);
			if (desc === null) return;
			await publishProjectToGallery(id, desc);
		}
		renderProjectList();
	} catch (e) {
		alert((isPublished ? 'Unpublish' : 'Publish') + ' failed: ' + (e.message || e));
	}
}

function escapeHtml(s) {
	return String(s)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}
