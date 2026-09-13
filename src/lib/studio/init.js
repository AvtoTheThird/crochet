import { state } from './state.js';
import { setDomRefs } from './dom.js';
import { initFileHandlers } from './image.js';
import { initCropHandlers, resetCrop, applyCrop } from './crop.js';
import {
	drawGrid,
	syncPixelCountFromCellSize,
	syncCellSizeFromPixelCount,
	setStartDirection
} from './grid.js';
import {
	setGridZoom,
	resetGridZoom,
	renderWorkingCanvasDisplay,
	updateBaseDisplayScale
} from './viewport.js';
import {
	enterColorCorrection,
	resetColorCorrections,
	collapsePaletteColors
} from './color-correction.js';
import { goCount, toggleCountOverlay } from './count.js';
import { exportPNG } from './export.js';
import { copyCSV } from './results.js';
import { goStep } from './steps.js';
import {
	enterPatternWalk,
	patternWalkNext,
	patternWalkPrev,
	initPatternWalkHandlers
} from './pattern-walk.js';
import { saveProject, renderProjectList, autoSaveProject } from './projects.js';

function goColorCorrection() {
	enterColorCorrection();
	goStep(4);
	autoSaveProject();
}

function initGridHandlers() {
	document.getElementById('grid-opacity')?.addEventListener('input', function () {
		const val = document.getElementById('grid-opacity-val');
		if (val) val.textContent = this.value;
		drawGrid();
	});

	document.getElementById('grid-zoom')?.addEventListener('input', function () {
		setGridZoom(this.value);
	});

	document.getElementById('tolerance')?.addEventListener('input', function () {
		const val = document.getElementById('tol-val');
		if (val) val.textContent = this.value;
	});

	for (const id of ['px-w', 'px-h']) {
		document.getElementById(id)?.addEventListener('input', () => {
			syncPixelCountFromCellSize();
			drawGrid();
		});
	}

	for (const id of ['grid-cols-input', 'grid-rows-input']) {
		document.getElementById(id)?.addEventListener('input', () => {
			syncCellSizeFromPixelCount();
			drawGrid();
		});
	}
}

/**
 * Bind canvas/workspace elements and wire event handlers.
 * @param {Parameters<typeof setDomRefs>[0]} refs
 * @returns {() => void} cleanup
 */
export function initStudio(refs) {
	setDomRefs(refs);
	initFileHandlers();
	initCropHandlers();
	initGridHandlers();
	initPatternWalkHandlers();
	renderProjectList();

	const onResize = () => {
		if (state.workingCanvas) {
			updateBaseDisplayScale();
			renderWorkingCanvasDisplay();
		}
	};
	window.addEventListener('resize', onResize);

	return () => {
		window.removeEventListener('resize', onResize);
	};
}

export const studioActions = {
	goStep,
	resetCrop,
	applyCrop,
	drawGrid,
	setStartDirection,
	resetGridZoom,
	goColorCorrection,
	resetColorCorrections,
	collapsePaletteColors,
	goCount,
	toggleCountOverlay,
	copyCSV,
	exportPNG,
	enterPatternWalk,
	patternWalkNext,
	patternWalkPrev,
	saveProject
};
