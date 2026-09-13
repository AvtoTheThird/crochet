import { state } from './state.js';
import { initFileHandlers } from './image.js';
import { initCropHandlers, resetCrop, applyCrop } from './crop.js';
import {
  drawGrid,
  syncPixelCountFromCellSize,
  syncCellSizeFromPixelCount,
  setStartDirection
} from './grid.js';
import { setGridZoom, resetGridZoom, renderWorkingCanvasDisplay, updateBaseDisplayScale } from './viewport.js';
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

function goColorCorrection() {
  enterColorCorrection();
  goStep(4);
}

function initGridHandlers() {
  document.getElementById('grid-opacity').addEventListener('input', function () {
    document.getElementById('grid-opacity-val').textContent = this.value;
    drawGrid();
  });

  document.getElementById('grid-zoom').addEventListener('input', function () {
    setGridZoom(this.value);
  });

  document.getElementById('tolerance').addEventListener('input', function () {
    document.getElementById('tol-val').textContent = this.value;
  });

  for (const id of ['px-w', 'px-h']) {
    document.getElementById(id).addEventListener('input', () => {
      syncPixelCountFromCellSize();
      drawGrid();
    });
  }

  for (const id of ['grid-cols-input', 'grid-rows-input']) {
    document.getElementById(id).addEventListener('input', () => {
      syncCellSizeFromPixelCount();
      drawGrid();
    });
  }
}

window.goStep = goStep;
window.resetCrop = resetCrop;
window.applyCrop = applyCrop;
window.drawGrid = drawGrid;
window.setStartDirection = setStartDirection;
window.resetGridZoom = resetGridZoom;
window.goColorCorrection = goColorCorrection;
window.resetColorCorrections = resetColorCorrections;
window.collapsePaletteColors = collapsePaletteColors;
window.goCount = goCount;
window.toggleCountOverlay = toggleCountOverlay;
window.copyCSV = copyCSV;
window.exportPNG = exportPNG;
window.enterPatternWalk = enterPatternWalk;
window.patternWalkNext = patternWalkNext;
window.patternWalkPrev = patternWalkPrev;

initFileHandlers();
initCropHandlers();
initGridHandlers();
initPatternWalkHandlers();

window.addEventListener('resize', () => {
  if (state.workingCanvas) {
    updateBaseDisplayScale();
    renderWorkingCanvasDisplay();
  }
});
