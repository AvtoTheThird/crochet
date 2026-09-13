/**
 * IndexedDB project persistence (ported from the shipping vanilla bundle).
 * Grid is stored as a compact palette + Uint16Array index map; image as a PNG Blob.
 */
import { state } from './state.js';
import { dom } from './dom.js';
import { setStartDirection } from './grid.js';
import { runLengthEncode } from './count.js';
import { buildWalkStepsFromCountResults } from './pattern-walk.js';
import { updateBaseDisplayScale } from './viewport.js';

const IDB_NAME = 'PixelCountStudio';
const IDB_VER = 1;
const IDB_STORE = 'projects';

/** @type {IDBDatabase | null} */
let idb = null;
let saveChain = Promise.resolve();

try {
	for (const k of Object.keys(localStorage).filter((key) => key.startsWith('pixelcount-v1'))) {
		localStorage.removeItem(k);
	}
} catch {
	/* ignore */
}

function openIDB() {
	if (idb) return Promise.resolve(idb);
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(IDB_NAME, IDB_VER);
		req.onupgradeneeded = (e) => {
			const db = /** @type {IDBOpenDBRequest} */ (e.target).result;
			if (!db.objectStoreNames.contains(IDB_STORE)) {
				db.createObjectStore(IDB_STORE, { keyPath: 'id' });
			}
		};
		req.onsuccess = (e) => {
			idb = /** @type {IDBOpenDBRequest} */ (e.target).result;
			resolve(idb);
		};
		req.onerror = (e) => reject(/** @type {IDBOpenDBRequest} */ (e.target).error);
	});
}

function idbPut(record) {
	return openIDB().then(
		(db) =>
			new Promise((resolve, reject) => {
				const req = db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).put(record);
				req.onsuccess = () => resolve();
				req.onerror = (e) => reject(/** @type {IDBRequest} */ (e.target).error);
			})
	);
}

function idbGet(id) {
	return openIDB().then(
		(db) =>
			new Promise((resolve, reject) => {
				const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(id);
				req.onsuccess = (e) => resolve(/** @type {IDBRequest} */ (e.target).result);
				req.onerror = (e) => reject(/** @type {IDBRequest} */ (e.target).error);
			})
	);
}

function idbDelete(id) {
	return openIDB().then(
		(db) =>
			new Promise((resolve, reject) => {
				const req = db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).delete(id);
				req.onsuccess = () => resolve();
				req.onerror = (e) => reject(/** @type {IDBRequest} */ (e.target).error);
			})
	);
}

function idbGetAll() {
	return openIDB().then(
		(db) =>
			new Promise((resolve, reject) => {
				const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).getAll();
				req.onsuccess = (e) => resolve(/** @type {IDBRequest} */ (e.target).result);
				req.onerror = (e) => reject(/** @type {IDBRequest} */ (e.target).error);
			})
	);
}

function encodeGrid(countGrid, countMetrics) {
	if (!countGrid.length || !countMetrics) return null;
	const { rows, cols } = countMetrics;
	/** @type {string[]} */
	const palette = [];
	/** @type {Record<string, number>} */
	const palIdx = {};
	const data = new Uint16Array(rows * cols);
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const cell = countGrid[r] && countGrid[r][c];
			const key = cell ? cell.sourceHex : '#000000';
			if (palIdx[key] === undefined) {
				palIdx[key] = palette.length;
				palette.push(key);
			}
			data[r * cols + c] = palIdx[key];
		}
	}
	return { palette, data };
}

function decodeGrid(encoded, countMetrics, yarnColors, sourceToYarn) {
	if (!encoded || !countMetrics) return [];
	const { rows, cols } = countMetrics;
	const grid = [];
	for (let r = 0; r < rows; r++) {
		grid[r] = [];
		for (let c = 0; c < cols; c++) {
			const sourceHex = encoded.palette[encoded.data[r * cols + c]] || '#000000';
			const yarnId = sourceToYarn.get(sourceHex);
			const yarn = yarnColors.get(yarnId);
			grid[r][c] = {
				r: yarn ? yarn.r : 0,
				g: yarn ? yarn.g : 0,
				b: yarn ? yarn.b : 0,
				hex: yarn ? yarn.hex : sourceHex,
				sourceHex,
				name: yarn ? yarn.name : sourceHex,
				yarnId: yarnId || null
			};
		}
	}
	return grid;
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

function buildProjectRecord(id, name) {
	const encoded = encodeGrid(state.countGrid, state.countMetrics);
	return canvasToBlob(state.workingCanvas).then((blob) => ({
		id,
		name,
		savedAt: new Date().toISOString(),
		step: state.currentStep,
		imageBlob: blob,
		grid: {
			pwInput: document.getElementById('px-w')?.value,
			phInput: document.getElementById('px-h')?.value,
			colsInput: document.getElementById('grid-cols-input')?.value,
			rowsInput: document.getElementById('grid-rows-input')?.value,
			tolerance: document.getElementById('tolerance')?.value,
			startDirection: state.startDirection,
			gridOpacity: document.getElementById('grid-opacity')?.value
		},
		countMetrics: state.countMetrics,
		gridPalette: encoded ? encoded.palette : [],
		gridData: encoded ? encoded.data : new Uint16Array(0),
		yarnColors: [...state.yarnColors.entries()],
		sourceToYarn: [...state.sourceToYarn.entries()],
		patternWalkIndex: state.patternWalk.currentIndex,
		patternWalkOptions: { ...state.patternWalk.options },
		showCountOverlay: state.showCountOverlay
	}));
}

/**
 * @param {{ promptName?: boolean, silent?: boolean }} [options]
 */
export function persistProject(options = {}) {
	if (!state.workingCanvas) return Promise.resolve(null);

	const run = () => {
		let name = state.projectName || defaultProjectName();
		let id = state.projectId;

		if (options.promptName) {
			const prompted = prompt('Project name:', name);
			if (prompted === null) return Promise.resolve(null);
			name = prompted.trim() || name;
		}

		if (!id) id = 'p' + Date.now();

		return buildProjectRecord(id, name).then((record) =>
			idbPut(record).then(() => {
				state.projectId = id;
				state.projectName = name;
				return record;
			})
		);
	};

	saveChain = saveChain.then(run, run);
	return saveChain;
}

export function autoSaveProject() {
	return persistProject({ silent: true })
		.then((record) => {
			if (record) renderProjectList();
			return record;
		})
		.catch((e) => {
			console.warn('Auto-save failed:', e);
		});
}

export function saveProject() {
	if (!state.workingCanvas) {
		alert('No image loaded.');
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
		.catch((e) => alert('Save failed: ' + e.message));
}

export function deleteProject(id) {
	if (!confirm('Delete this project?')) return;
	idbDelete(id)
		.then(() => {
			if (state.projectId === id) {
				state.projectId = null;
				state.projectName = null;
			}
			renderProjectList();
		})
		.catch((e) => alert('Delete failed: ' + e.message));
}

export function loadProjectById(id) {
	idbGet(id)
		.then((record) => {
			if (!record) {
				alert('Project not found.');
				return;
			}
			restoreSnapshot(record);
		})
		.catch((e) => alert('Load failed: ' + e.message));
}

function restoreSnapshot(snap) {
	if (!snap || !snap.imageBlob) {
		alert('Invalid project data.');
		return;
	}
	state.projectId = snap.id || null;
	state.projectName = snap.name || null;
	const url = URL.createObjectURL(snap.imageBlob);
	const img = new Image();
	img.onload = () => {
		URL.revokeObjectURL(url);
		state.workingCanvas = document.createElement('canvas');
		state.workingCanvas.width = img.width;
		state.workingCanvas.height = img.height;
		state.workingCtx = state.workingCanvas.getContext('2d', { willReadFrequently: true });
		state.workingCtx.drawImage(img, 0, 0);
		state.zoomLevel = 1;
		if (dom.canvasArea) {
			dom.canvasArea.scrollLeft = 0;
			dom.canvasArea.scrollTop = 0;
		}
		state.pixelData = null;
		state.highlightedSourceHex = null;
		state.viewPanning = null;
		state.cropDragging = null;
		state.cropRect = { x: 0, y: 0, w: img.width, h: img.height };

		const g = snap.grid || {};
		const setVal = (id, v) => {
			const el = document.getElementById(id);
			if (el && v !== undefined) el.value = v;
		};
		setVal('px-w', g.pwInput);
		setVal('px-h', g.phInput);
		setVal('grid-cols-input', g.colsInput);
		setVal('grid-rows-input', g.rowsInput);
		if (g.tolerance !== undefined) {
			setVal('tolerance', g.tolerance);
			const tolVal = document.getElementById('tol-val');
			if (tolVal) tolVal.textContent = g.tolerance;
		}
		if (g.gridOpacity !== undefined) {
			setVal('grid-opacity', g.gridOpacity);
			const opVal = document.getElementById('grid-opacity-val');
			if (opVal) opVal.textContent = g.gridOpacity;
		}
		if (g.startDirection) setStartDirection(g.startDirection);

		state.countMetrics = snap.countMetrics || null;
		state.showCountOverlay = snap.showCountOverlay !== false;
		if (dom.countCanvas) {
			dom.countCanvas.style.opacity = state.showCountOverlay ? '1' : '0';
		}

		state.yarnColors.clear();
		state.sourceToYarn.clear();
		if (snap.yarnColors) snap.yarnColors.forEach((e) => state.yarnColors.set(e[0], e[1]));
		if (snap.sourceToYarn) snap.sourceToYarn.forEach((e) => state.sourceToYarn.set(e[0], e[1]));

		state.countGrid = decodeGrid(
			{ palette: snap.gridPalette, data: snap.gridData },
			snap.countMetrics,
			state.yarnColors,
			state.sourceToYarn
		);
		state.countResults = [];
		import('./color-correction.js').then((m) => m.invalidateColorPreviewCache());

		if (state.countGrid.length && state.countMetrics) {
			runLengthEncode();
			if (snap.step >= 6) {
				state.patternWalk.steps = buildWalkStepsFromCountResults();
				state.patternWalk.currentIndex = snap.patternWalkIndex || 0;
			}
		}
		if (snap.patternWalkOptions) Object.assign(state.patternWalk.options, snap.patternWalkOptions);

		if (dom.dropZone) dom.dropZone.style.display = 'none';
		if (dom.wrapper) dom.wrapper.style.display = 'block';
		if (dom.canvasArea) dom.canvasArea.classList.add('has-image');
		updateBaseDisplayScale();

		import('./steps.js').then((m) => m.goStep(snap.step || 2, { replaceState: true }));
	};
	img.onerror = () => {
		URL.revokeObjectURL(url);
		alert('Could not restore image.');
	};
	img.src = url;
}

export function renderProjectList() {
	return idbGetAll()
		.then((records) => {
			const container = document.getElementById('project-list');
			if (!container) return;
			if (!records || !records.length) {
				container.innerHTML =
					'<p style="font-size:0.65rem;color:var(--text-dim);padding:4px 0">No saved projects yet.</p>';
				return;
			}
			records.sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
			container.innerHTML = '';
			const stepLabels = ['', 'Load', 'Crop', 'Grid', 'Colors', 'Count', 'Walk'];
			records.forEach((proj) => {
				let date = '';
				try {
					date = new Date(proj.savedAt).toLocaleDateString();
				} catch {
					/* ignore */
				}
				const item = document.createElement('div');
				item.className =
					'project-list-item' + (proj.id === state.projectId ? ' is-current' : '');
				item.innerHTML =
					`<div class="project-list-name">${proj.name}</div>` +
					`<div class="project-list-meta">${date} · ${stepLabels[proj.step] || 'Step ' + proj.step}</div>` +
					'<div class="project-list-actions">' +
					`<button type="button" class="btn btn-primary project-load-btn" style="font-size:0.62rem;padding:5px 10px" data-id="${proj.id}">Load</button>` +
					`<button type="button" class="btn btn-danger project-delete-btn" style="font-size:0.62rem;padding:5px 8px" data-id="${proj.id}">✕</button>` +
					'</div>';
				container.appendChild(item);
			});
			container.querySelectorAll('.project-load-btn').forEach((btn) => {
				btn.addEventListener('click', () => loadProjectById(btn.getAttribute('data-id')));
			});
			container.querySelectorAll('.project-delete-btn').forEach((btn) => {
				btn.addEventListener('click', () => deleteProject(btn.getAttribute('data-id')));
			});
		})
		.catch((e) => console.warn('renderProjectList:', e));
}
