import { state, STEP_COUNT } from './state.js';
import { syncPixelCountFromCellSize, drawGrid } from './grid.js';
import { formatGridNumber } from './utils.js';
import { renderResults } from './results.js';
import { enableCrop, disableCrop } from './crop.js';
import { renderPaletteUI, clearHighlight } from './color-correction.js';
import { renderWorkingCanvasDisplay } from './viewport.js';
import { onEnterPatternWalkStep } from './pattern-walk.js';
import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { stepFromSlug, studioPathForStep } from './routes.js';

/** Prevents URL→step sync from pushing another history entry. */
let syncingFromUrl = false;

/**
 * Apply step UI / canvas enter hooks without touching the URL.
 * @param {number} n
 */
export function applyStep(n) {
	if (n < 1 || n > STEP_COUNT) return;

	if (n !== 4 && n !== 5) clearHighlight();
	state.currentStep = n;
	const layout = document.getElementById('main-layout');
	if (layout) layout.dataset.step = String(n);
	for (let i = 1; i <= STEP_COUNT; i++) {
		document.getElementById('step' + i)?.classList.toggle('active', i === n);
		document.getElementById('panel' + i)?.classList.toggle('active', i === n);
	}

	if (n === 2) enableCrop();
	if (n !== 2) disableCrop();

	if (n === 3) {
		// Prefer cell sizes locked in at color correction so inputs don't drift.
		if (state.countMetrics?.pw && state.countMetrics?.ph) {
			const pxW = document.getElementById('px-w');
			const pxH = document.getElementById('px-h');
			if (pxW) pxW.value = formatGridNumber(state.countMetrics.pw);
			if (pxH) pxH.value = formatGridNumber(state.countMetrics.ph);
		}
		syncPixelCountFromCellSize();
		drawGrid();
	}
	if (n === 4) renderPaletteUI();
	if (n === 5) {
		renderResults();
		onEnterPatternWalkStep();
	}
	renderWorkingCanvasDisplay();
}

/**
 * Move to a workflow step and update `/studio/[step]` in the history stack.
 * @param {number} n
 * @param {{ replaceState?: boolean, syncUrl?: boolean }} [options]
 */
export function goStep(n, options = {}) {
	const { replaceState = false, syncUrl = true } = options;

	if (n > 1 && !state.workingCanvas) {
		n = 1;
	}

	applyStep(n);

	if (!syncUrl || !browser || syncingFromUrl) return;

	const path = studioPathForStep(n);
	if (window.location.pathname === path) return;

	goto(path, { replaceState, noScroll: true, keepFocus: true });
}

/**
 * Sync studio UI from the current URL slug (back/forward / deep link).
 * @param {string | undefined} slug
 */
export function syncStepFromUrl(slug) {
	let n = stepFromSlug(slug);
	if (!n) return;

	if (n > 1 && !state.workingCanvas) {
		if (browser) {
			goto(studioPathForStep(1), { replaceState: true, noScroll: true, keepFocus: true });
		}
		n = 1;
	}

	if (n === state.currentStep) {
		const layout = document.getElementById('main-layout');
		if (layout && layout.dataset.step !== String(n)) applyStep(n);
		// Rewrite legacy /studio/count → /studio/walk
		if (slug === 'count' && browser && window.location.pathname.endsWith('/count')) {
			goto(studioPathForStep(5), { replaceState: true, noScroll: true, keepFocus: true });
		}
		return;
	}

	syncingFromUrl = true;
	try {
		applyStep(n);
	} finally {
		syncingFromUrl = false;
	}

	if (slug === 'count' && browser) {
		goto(studioPathForStep(5), { replaceState: true, noScroll: true, keepFocus: true });
	}
}
