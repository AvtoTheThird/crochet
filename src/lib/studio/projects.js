/**
 * Supabase project persistence — DB row + Storage PNG for working canvas.
 */
import { state } from './state.js';
import { dom } from './dom.js';
import { setStartDirection, setPixelSizeLocked } from './grid.js';
import { buildWalkStepsFromCountResults } from './pattern-walk.js';
import { updateBaseDisplayScale, resetZoomBakeCache, centerCanvasInView } from './viewport.js';
import { getSupabase } from '$lib/supabase/client.js';
import { auth } from '$lib/supabase/session.svelte.js';
import { setHasImage } from './ui.svelte.js';
import {
	showAlert,
	showConfirm,
	showPrompt,
	notify,
	errorMessage
} from '$lib/ui/dialogs.svelte.js';

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

/**
 * Scaled pixel art from the quantized grid (solid stitch cells, not the photo).
 * Cell size follows grid metrics, upscaled so the long edge is at least ~512px.
 * @returns {{ canvas: HTMLCanvasElement, pixelWidth: number, pixelHeight: number } | null}
 */
function buildPixelArtCanvas() {
	if (!state.countGrid.length || !state.countMetrics) return null;
	const { cols, rows } = state.countMetrics;
	if (!cols || !rows) return null;

	const MIN_EDGE = 512;
	const MAX_CELL = 48;
	let cellW = Math.max(1, Math.round(Number(state.countMetrics.pw) || 1));
	let cellH = Math.max(1, Math.round(Number(state.countMetrics.ph) || 1));

	const longEdge = Math.max(cols * cellW, rows * cellH);
	if (longEdge < MIN_EDGE) {
		const scale = Math.ceil(MIN_EDGE / Math.max(cols, rows));
		const cell = Math.min(MAX_CELL, Math.max(cellW, cellH, scale));
		cellW = cell;
		cellH = cell;
	}

	const canvas = document.createElement('canvas');
	canvas.width = cols * cellW;
	canvas.height = rows * cellH;
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;
	ctx.imageSmoothingEnabled = false;

	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < cols; col++) {
			const cell = state.countGrid[row]?.[col];
			if (!cell) continue;
			ctx.fillStyle = `rgb(${cell.r},${cell.g},${cell.b})`;
			ctx.fillRect(col * cellW, row * cellH, cellW, cellH);
		}
	}

	return { canvas, pixelWidth: cellW, pixelHeight: cellH };
}

/**
 * Prefer generated pixel art after grid/colors; fall back to working canvas.
 */
function resolveSaveImage() {
	const pixelArt = buildPixelArtCanvas();
	if (pixelArt) {
		return {
			canvas: pixelArt.canvas,
			width: pixelArt.canvas.width,
			height: pixelArt.canvas.height,
			pixelWidth: pixelArt.pixelWidth,
			pixelHeight: pixelArt.pixelHeight
		};
	}
	return {
		canvas: state.workingCanvas,
		width: state.workingCanvas.width,
		height: state.workingCanvas.height,
		pixelWidth: readNum('px-w', state.countMetrics?.pw || 8),
		pixelHeight: readNum('px-h', state.countMetrics?.ph || 8)
	};
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

/**
 * Crop the working canvas to exactly cols×pw by rows×ph so no leftover strip
 * sits below/right of the last cells.
 * @param {{ cols: number, rows: number, pw: number, ph: number }} metrics
 */
function trimWorkingCanvasToMetrics(metrics) {
	const src = state.workingCanvas;
	if (!src) return;
	const tw = Math.min(src.width, Math.max(1, Math.round(metrics.cols * metrics.pw)));
	const th = Math.min(src.height, Math.max(1, Math.round(metrics.rows * metrics.ph)));
	if (tw === src.width && th === src.height) return;

	const next = document.createElement('canvas');
	next.width = tw;
	next.height = th;
	const ctx = next.getContext('2d', { willReadFrequently: true });
	if (!ctx) return;
	ctx.imageSmoothingEnabled = false;
	ctx.drawImage(src, 0, 0, tw, th, 0, 0, tw, th);
	state.workingCanvas = next;
	state.workingCtx = ctx;
	state.cropRect = { x: 0, y: 0, w: tw, h: th };
}

function imagePath(userId, projectId) {
	return `${userId}/${projectId}.png`;
}

function currentWalkRow() {
	const step = state.patternWalk.steps[state.patternWalk.currentIndex];
	return step?.logRow ?? 0;
}

async function buildDbRow(userId, projectId, name, imagePathValue, imageMeta) {
	const tolerance = readInt('tolerance', 20);
	const gridOpacity = readInt('grid-opacity', 35);

	return {
		id: projectId,
		user_id: userId,
		name,
		image_url: imagePathValue,
		image_width: imageMeta.width,
		image_height: imageMeta.height,
		pixel_width: Number(imageMeta.pixelWidth),
		pixel_height: Number(imageMeta.pixelHeight),
		color_tolerance: tolerance,
		start_direction: directionToDb(state.startDirection),
		palette: buildPaletteJson(),
		count_results: buildCountResultsJson(),
		grid_opacity: gridOpacity,
		current_row: currentWalkRow(),
		completed_rows: state.completedRows || [],
		// Load (1) isn't a resumable stage once an image exists.
		studio_step: Math.max(2, state.currentStep),
		walk_index: state.patternWalk.currentIndex || 0
	};
}

/** Snapshot of the saved fields at the last save/load; compared to detect unsaved changes. */
let lastSavedSignature = null;

function projectSignature() {
	if (!state.workingCanvas) return null;
	return JSON.stringify({
		w: state.workingCanvas.width,
		h: state.workingCanvas.height,
		px: [readNum('px-w', 0), readNum('px-h', 0)],
		tolerance: readInt('tolerance', 20),
		opacity: readInt('grid-opacity', 35),
		dir: state.startDirection,
		step: Math.max(2, state.currentStep),
		done: state.completedRows || [],
		yarn: [...state.sourceToYarn.entries()].map(([src, id]) => [src, state.yarnColors.get(id)?.hex]),
		rev: state.gridRevision,
		counts: buildCountResultsJson()
	});
}

function markProjectSaved() {
	lastSavedSignature = projectSignature();
}

const WALK_SAVE_DELAY = 1200;
let walkSaveTimer = null;

/** Persist only the walk position (no image upload), debounced while stepping through stitches. */
export function scheduleWalkProgressSave() {
	if (!state.projectId || !auth.user) return;
	clearTimeout(walkSaveTimer);
	walkSaveTimer = setTimeout(flushWalkProgress, WALK_SAVE_DELAY);
}

export async function flushWalkProgress() {
	if (walkSaveTimer === null) return;
	clearTimeout(walkSaveTimer);
	walkSaveTimer = null;
	if (!state.projectId) return;
	const { error } = await getSupabase()
		.from('projects')
		.update({ walk_index: state.patternWalk.currentIndex || 0, current_row: currentWalkRow() })
		.eq('id', state.projectId);
	if (error) console.warn('Walk progress save failed:', error.message);
}

export function hasUnsavedChanges() {
	if (!state.workingCanvas) return false;
	if (!state.projectId) return true;
	return projectSignature() !== lastSavedSignature;
}

/**
 * @param {{ promptName?: boolean, silent?: boolean }} [options]
 */
export function persistProject(options = {}) {
	if (!state.workingCanvas) return Promise.resolve(null);

	const run = async () => {
		const signature = projectSignature();
		const userId = requireUserId();
		let name = state.projectName || defaultProjectName();
		let id = state.projectId;
		const isNew = !id;

		if (isNew) {
			const { assertCanCreateProject } = await import('$lib/supabase/entitlements.js');
			await assertCanCreateProject();
		}

		if (options.promptName) {
			const prompted = await showPrompt({
				title: 'Name your project',
				message: 'Pick something you’ll recognize later in your project list.',
				label: 'Project name',
				defaultValue: name,
				maxLength: 80,
				confirmLabel: 'Save project'
			});
			if (prompted === null) return null;
			name = prompted || name;
		}

		if (!id) id = crypto.randomUUID();

		const image = resolveSaveImage();
		const blob = await canvasToBlob(image.canvas);
		const path = imagePath(userId, id);
		const supabase = getSupabase();

		const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, blob, {
			upsert: true,
			contentType: 'image/png',
			cacheControl: '3600'
		});
		if (uploadError) throw uploadError;

		const row = await buildDbRow(userId, id, name, path, image);
		const { data, error } = await supabase.from('projects').upsert(row).select().single();
		if (error) throw error;

		state.projectId = id;
		state.projectName = name;
		lastSavedSignature = signature;

		if (isNew) {
			const { markFreeProjectUsed } = await import('$lib/supabase/entitlements.js');
			await markFreeProjectUsed();
		}

		return data;
	};

	saveChain = saveChain.then(run, run);
	return saveChain;
}

/**
 * @returns {Promise<boolean>} whether the project was saved
 */
export function saveProject() {
	if (!state.workingCanvas) {
		showAlert({
			title: 'Nothing to save yet',
			message: 'Load a picture first, then you can save it as a project.',
			tone: 'warning'
		});
		return Promise.resolve(false);
	}
	if (!auth.user) {
		showAlert({
			title: 'Please log in',
			message: 'You need to be logged in to save projects.',
			tone: 'warning'
		});
		return Promise.resolve(false);
	}
	return persistProject({ promptName: !state.projectId })
		.then((record) => {
			if (!record) return false;
			notify(`“${state.projectName}” saved`);
			renderProjectList();
			return true;
		})
		.catch((e) => {
			if (e?.code !== 'PROJECT_LIMIT') {
				showAlert({
					title: 'Couldn’t save your project',
					message: errorMessage(e),
					tone: 'danger'
				});
			}
			return false;
		});
}

export async function deleteProject(id) {
	const ok = await showConfirm({
		title: 'Delete this project?',
		message: 'The project and its picture will be removed for good. This can’t be undone.',
		tone: 'danger',
		confirmLabel: 'Delete project',
		cancelLabel: 'Keep it'
	});
	if (!ok) return;
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
		notify('Project deleted');
	} catch (e) {
		showAlert({ title: 'Couldn’t delete the project', message: errorMessage(e), tone: 'danger' });
	}
}

export async function loadProjectById(id) {
	try {
		const supabase = getSupabase();
		const { data: row, error } = await supabase.from('projects').select('*').eq('id', id).single();
		if (error) throw error;
		if (!row) {
			showAlert({
				title: 'Project not found',
				message: 'It may have been deleted. Try refreshing your project list.',
				tone: 'warning'
			});
			return;
		}

		const { data: file, error: dlError } = await supabase.storage.from(BUCKET).download(row.image_url);
		if (dlError) throw dlError;

		await restoreFromSupabase(row, file);
	} catch (e) {
		showAlert({ title: 'Couldn’t open the project', message: errorMessage(e), tone: 'danger' });
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
			// A saved pattern with non-square pixels must reopen unlocked.
			setPixelSizeLocked(Number(row.pixel_width) === Number(row.pixel_height));
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
			trimWorkingCanvasToMetrics(state.countMetrics);

			applyPaletteToMaps(row.palette);
			state.countResults = Array.isArray(row.count_results) ? row.count_results : [];

			if (state.countResults.length) {
				state.countGrid = rebuildCountGridFromResults(state.countResults, state.countMetrics);
			} else {
				state.countGrid = [];
			}

			const { invalidateColorPreviewCache } = await import('./color-correction.js');
			invalidateColorPreviewCache();
			const { clearPaintHistory } = await import('./paint.js');
			clearPaintHistory();

			// Projects with pattern data always reopen in Pattern Walk, whatever stage was saved.
			const hasPattern = state.countResults.length > 0 && state.countGrid.length > 0;
			const targetStep = hasPattern
				? 5
				: Math.min(4, Math.max(2, row.studio_step || 3));

			state.patternWalk.steps = [];
			state.patternWalk.currentIndex = 0;
			if (hasPattern) {
				state.patternWalk.steps = buildWalkStepsFromCountResults();
				state.patternWalk.currentIndex = Math.min(
					row.walk_index || 0,
					Math.max(0, state.patternWalk.steps.length - 1)
				);
			}

			if (dom.dropZone) dom.dropZone.style.display = 'none';
			if (dom.wrapper) dom.wrapper.style.display = 'block';
			if (dom.canvasArea) dom.canvasArea.classList.add('has-image');
			setHasImage(true);
			updateBaseDisplayScale();

			const { goStep } = await import('./steps.js');
			goStep(targetStep, { replaceState: true });
			markProjectSaved();
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

const STEP_LABELS = ['', 'Load', 'Crop', 'Grid', 'Colors', 'Walk'];

function normalizedStep(proj) {
	return proj.studio_step === 6 ? 5 : proj.studio_step || 1;
}

function formatDate(value) {
	try {
		return new Date(value).toLocaleDateString();
	} catch {
		return '';
	}
}

/**
 * @param {Record<string, any>} proj
 * @returns {{ ratio: number, label: string }}
 */
function projectProgress(proj) {
	// Walk steps are the count_results segments in order; walk_index is the segment in progress.
	const segments = Array.isArray(proj.count_results)
		? proj.count_results.flatMap((row) => row.segments || [])
		: [];
	if (segments.length) {
		const walkIndex = Math.min(Math.max(0, proj.walk_index || 0), segments.length);
		let total = 0;
		let done = 0;
		segments.forEach((seg, i) => {
			const count = Number(seg.count) || 0;
			total += count;
			if (i < walkIndex) done += count;
		});
		if (total) {
			const pct = Math.round((done / total) * 100);
			return {
				ratio: done / total,
				label: `${done.toLocaleString()} / ${total.toLocaleString()} stitches · ${pct}%`
			};
		}
	}
	const step = normalizedStep(proj);
	return { ratio: step / 5, label: `Step ${step} of 5 · ${STEP_LABELS[step] || 'Saved'}` };
}

/**
 * @param {HTMLElement} root
 */
function wireProjectActions(root) {
	root.querySelectorAll('.project-load-btn').forEach((btn) => {
		btn.addEventListener('click', () => loadProjectById(btn.getAttribute('data-id')));
	});
	root.querySelectorAll('.project-publish-btn').forEach((btn) => {
		btn.addEventListener('click', () =>
			togglePublishProject(btn.getAttribute('data-id'), btn.getAttribute('data-published') === '1')
		);
	});
	root.querySelectorAll('.project-delete-btn').forEach((btn) => {
		btn.addEventListener('click', () => deleteProject(btn.getAttribute('data-id')));
	});
}

/**
 * @param {any[]} records
 * @returns {Promise<Map<string, string>>}
 */
async function signThumbnails(records) {
	const paths = records.map((r) => r.image_url).filter(Boolean);
	const map = new Map();
	if (!paths.length) return map;
	const { data, error } = await getSupabase().storage.from(BUCKET).createSignedUrls(paths, 3600);
	if (error) {
		console.warn('thumbnail urls:', error.message);
		return map;
	}
	for (const entry of data || []) {
		if (entry.path && entry.signedUrl) map.set(entry.path, entry.signedUrl);
	}
	return map;
}

/**
 * @param {HTMLElement} cards
 * @param {any[]} records
 * @param {string | null} quota
 */
async function renderProjectCards(cards, records, quota) {
	cards.innerHTML = '';
	if (!records.length) return;

	const thumbs = await signThumbnails(records);

	const head = document.createElement('div');
	head.className = 'project-cards-head';
	head.innerHTML =
		'<span>Your projects</span>' + (quota ? `<span class="project-cards-quota">${escapeHtml(quota)}</span>` : '');
	cards.appendChild(head);

	const grid = document.createElement('div');
	grid.className = 'project-cards-grid';
	for (const proj of records) {
		const published = !!proj.is_published;
		const progress = projectProgress(proj);
		const thumb = thumbs.get(proj.image_url);
		const card = document.createElement('div');
		card.className = 'project-card' + (proj.id === state.projectId ? ' is-current' : '');
		card.innerHTML =
			`<button type="button" class="project-card-open project-load-btn" data-id="${proj.id}" title="Open project">` +
			'<div class="project-card-thumb">' +
			(thumb
				? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy" />`
				: '<span class="project-card-thumb-ph">No preview</span>') +
			(published ? '<span class="project-card-badge">In gallery</span>' : '') +
			'</div>' +
			'<div class="project-card-body">' +
			`<div class="project-card-name">${escapeHtml(proj.name)}</div>` +
			`<div class="project-card-meta">${formatDate(proj.updated_at)} · ${STEP_LABELS[normalizedStep(proj)] || 'Saved'}</div>` +
			`<div class="project-card-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress.ratio * 100)}">` +
			`<div class="project-card-progress-fill" style="width:${(progress.ratio * 100).toFixed(1)}%"></div>` +
			'</div>' +
			`<div class="project-card-progress-label">${escapeHtml(progress.label)}</div>` +
			'</div>' +
			'</button>' +
			'<div class="project-card-actions">' +
			`<button type="button" class="btn btn-secondary project-publish-btn" data-id="${proj.id}" data-published="${published ? '1' : '0'}">${published ? 'Unpublish' : 'Publish'}</button>` +
			`<button type="button" class="btn btn-danger project-delete-btn" data-id="${proj.id}" title="Delete project">✕</button>` +
			'</div>';
		grid.appendChild(card);
	}
	cards.appendChild(grid);
	wireProjectActions(cards);
}

export async function renderProjectList() {
	const container = document.getElementById('project-list');
	const cards = document.getElementById('project-cards');
	if (!container && !cards) return;

	if (!auth.user) {
		if (container) {
			container.innerHTML =
				'<p style="font-size:0.8rem;color:var(--text-dim);padding:4px 0">Log in to see saved projects.</p>';
		}
		if (cards) cards.innerHTML = '';
		return;
	}

	try {
		const { projectQuotaLabel } = await import('$lib/supabase/entitlements.js');
		const quota = await projectQuotaLabel();

		const supabase = getSupabase();
		const { data: records, error } = await supabase
			.from('projects')
			.select(
				'id, name, updated_at, studio_step, is_published, gallery_description, image_url, count_results, walk_index'
			)
			.order('updated_at', { ascending: false });
		if (error) throw error;

		if (cards) {
			renderProjectCards(cards, records || [], quota).catch((e) =>
				console.warn('renderProjectCards:', e)
			);
		}
		if (!container) return;

		container.innerHTML = '';
		if (quota) {
			const q = document.createElement('p');
			q.className = 'project-quota';
			q.style.cssText = 'font-size:0.75rem;color:var(--text-dim);padding:0 0 4px;margin:0';
			q.textContent = quota;
			container.appendChild(q);
		}

		if (!records?.length) {
			const empty = document.createElement('p');
			empty.style.cssText = 'font-size:0.8rem;color:var(--text-dim);padding:4px 0;margin:0';
			empty.textContent = 'No saved projects yet.';
			container.appendChild(empty);
			return;
		}

		for (const proj of records) {
			const date = formatDate(proj.updated_at);
			const stepN = normalizedStep(proj);
			const published = !!proj.is_published;
			const item = document.createElement('div');
			item.className =
				'project-list-item' + (proj.id === state.projectId ? ' is-current' : '');
			item.innerHTML =
				`<div class="project-list-name">${escapeHtml(proj.name)}</div>` +
				`<div class="project-list-meta">${date} · ${STEP_LABELS[stepN] || 'Saved'}${published ? ' · In gallery' : ''}</div>` +
				'<div class="project-list-actions">' +
				`<button type="button" class="btn btn-primary project-load-btn" style="font-size:0.75rem;padding:5px 10px" data-id="${proj.id}">Load</button>` +
				`<button type="button" class="btn btn-secondary project-publish-btn" style="font-size:0.75rem;padding:5px 8px" data-id="${proj.id}" data-published="${published ? '1' : '0'}">${published ? 'Unpublish' : 'Publish'}</button>` +
				`<button type="button" class="btn btn-danger project-delete-btn" style="font-size:0.75rem;padding:5px 8px" data-id="${proj.id}">✕</button>` +
				'</div>';
			container.appendChild(item);
		}
		wireProjectActions(container);
	} catch (e) {
		console.warn('renderProjectList:', e);
		if (container) {
			container.innerHTML =
				'<p style="font-size:0.8rem;color:var(--accent2);padding:4px 0">Could not load projects.</p>';
		}
	}
}

async function togglePublishProject(id, isPublished) {
	try {
		const {
			publishProjectToGallery,
			unpublishProjectFromGallery
		} = await import('$lib/supabase/gallery.js');
		if (isPublished) {
			const ok = await showConfirm({
				title: 'Remove from the gallery?',
				message: 'Other makers won’t see it anymore. Your project stays safe in your list.',
				confirmLabel: 'Remove',
				cancelLabel: 'Keep it shared'
			});
			if (!ok) return;
			await unpublishProjectFromGallery(id);
			notify('Removed from the gallery');
		} else {
			// Refresh storage image (pixel art after colors) before publishing.
			const saved = await persistProject({ silent: true });
			const projectId = saved?.id || id;
			const supabase = getSupabase();
			const { data: row } = await supabase
				.from('projects')
				.select('name, gallery_description')
				.eq('id', projectId)
				.maybeSingle();
			const result = await showPrompt({
				title: 'Share to the gallery',
				message: 'Your picture, name and description will be visible to everyone.',
				fields: [
					{
						key: 'name',
						label: 'Name',
						placeholder: 'e.g. Strawberry tote',
						defaultValue: (row?.name || '').slice(0, 32),
						maxLength: 32,
						required: true
					},
					{
						key: 'description',
						label: 'Description',
						placeholder: 'e.g. A little strawberry for a market tote',
						defaultValue: row?.gallery_description || '',
						multiline: true,
						maxLength: 500
					}
				],
				confirmLabel: 'Publish'
			});
			if (result === null || typeof result !== 'object') return;
			const published = await publishProjectToGallery(projectId, {
				name: result.name,
				description: result.description
			});
			if (state.projectId === projectId && published?.name) {
				state.projectName = published.name;
			}
			notify('Published to the gallery ♥');
		}
		renderProjectList();
	} catch (e) {
		showAlert({
			title: isPublished ? 'Couldn’t remove it from the gallery' : 'Couldn’t publish it',
			message: errorMessage(e),
			tone: 'danger'
		});
	}
}

function escapeHtml(s) {
	return String(s)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}
