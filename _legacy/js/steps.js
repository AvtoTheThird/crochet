import { state, STEP_COUNT } from './state.js';
import { syncPixelCountFromCellSize, drawGrid } from './grid.js';
import { renderResults } from './results.js';
import { enableCrop, disableCrop } from './crop.js';
import { renderPaletteUI, clearHighlight } from './color-correction.js';
import { renderWorkingCanvasDisplay } from './viewport.js';
import { onEnterPatternWalkStep } from './pattern-walk.js';

export function goStep(n) {
  if (n !== 4 && n !== 6) clearHighlight();
  state.currentStep = n;
  for (let i = 1; i <= STEP_COUNT; i++) {
    document.getElementById('step' + i).classList.toggle('active', i === n);
    document.getElementById('panel' + i).classList.toggle('active', i === n);
  }

  if (n === 2) enableCrop();
  if (n !== 2) disableCrop();

  if (n === 3) {
    syncPixelCountFromCellSize();
    drawGrid();
  }
  if (n === 4) renderPaletteUI();
  if (n === 5) renderResults();
  if (n === 6) onEnterPatternWalkStep();
  renderWorkingCanvasDisplay();
}
