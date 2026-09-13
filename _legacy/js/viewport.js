import { state } from './state.js';
import { dom, mainCtx, gridCtx, countCtx, highlightCtx } from './dom.js';
import { drawGrid } from './grid.js';

export function updateBaseDisplayScale() {
  if (!state.workingCanvas) return;
  const area = dom.canvasArea;
  const maxW = area.clientWidth - 40;
  const maxH = area.clientHeight - 40;
  const sw = state.workingCanvas.width;
  const sh = state.workingCanvas.height;
  state.baseDisplayScale = Math.min(1, maxW / sw, maxH / sh);
  if (state.baseDisplayScale < 0.125) state.baseDisplayScale = 0.125;
}

export function updateZoomUI() {
  document.getElementById('grid-zoom').value = Math.round(state.zoomLevel * 100);
  document.getElementById('grid-zoom-val').textContent = `${Math.round(state.zoomLevel * 100)}%`;
  dom.zoomInfo.textContent = `${state.workingCanvas.width}×${state.workingCanvas.height}px · ${Math.round(state.displayScale * 100)}% · scroll zoom · drag pan`;
}

export async function renderWorkingCanvasDisplay() {
  if (!state.workingCanvas) return;

  const sw = state.workingCanvas.width;
  const sh = state.workingCanvas.height;
  state.displayScale = state.baseDisplayScale * state.zoomLevel;
  const dw = Math.max(1, Math.round(sw * state.displayScale));
  const dh = Math.max(1, Math.round(sh * state.displayScale));

  for (const c of [dom.mainCanvas, dom.gridCanvas, dom.countCanvas, dom.highlightCanvas]) {
    c.width = dw;
    c.height = dh;
    c.style.width = dw + 'px';
    c.style.height = dh + 'px';
  }
  dom.wrapper.style.width = dw + 'px';
  dom.wrapper.style.height = dh + 'px';

  mainCtx.imageSmoothingEnabled = false;
  gridCtx.clearRect(0, 0, dw, dh);
  countCtx.clearRect(0, 0, dw, dh);
  highlightCtx.clearRect(0, 0, dw, dh);

  if (state.currentStep >= 4 && state.countGrid.length) {
    const { drawColorPreview, drawColorHighlight } = await import('./color-correction.js');
    drawColorPreview();
    if (state.highlightedSourceHex) drawColorHighlight(state.highlightedSourceHex);
  } else {
    mainCtx.clearRect(0, 0, dw, dh);
    mainCtx.drawImage(state.workingCanvas, 0, 0, sw, sh, 0, 0, dw, dh);
  }

  updateZoomUI();
  const { updateCropUI } = await import('./crop.js');
  updateCropUI();

  if (state.currentStep === 3) drawGrid();
  if (state.currentStep === 4 && state.countMetrics) {
    const { drawGrid: drawGridOverlay } = await import('./grid.js');
    drawGridOverlay();
  }
  if (state.currentStep === 5 && state.countMetrics) {
    const { drawCountOverlay } = await import('./count.js');
    drawCountOverlay(state.countMetrics.pw, state.countMetrics.ph, state.countMetrics.rows, state.countMetrics.cols);
  }
  if (state.currentStep === 6 && state.countMetrics) {
    const { renderPatternWalkCanvases } = await import('./pattern-walk.js');
    renderPatternWalkCanvases();
  }
}

export function setGridZoom(value, anchorX, anchorY) {
  if (!state.workingCanvas) return;
  const oldScale = state.displayScale || state.baseDisplayScale * state.zoomLevel;
  state.zoomLevel = Math.max(0.25, Math.min(8, parseInt(value, 10) / 100 || 1));

  if (anchorX !== undefined && anchorY !== undefined) {
    const rect = dom.canvasArea.getBoundingClientRect();
    const contentX = dom.canvasArea.scrollLeft + anchorX - rect.left;
    const contentY = dom.canvasArea.scrollTop + anchorY - rect.top;
    renderWorkingCanvasDisplay();
    const ratio = state.displayScale / Math.max(oldScale, 0.000001);
    dom.canvasArea.scrollLeft = Math.max(0, contentX * ratio - (anchorX - rect.left));
    dom.canvasArea.scrollTop = Math.max(0, contentY * ratio - (anchorY - rect.top));
  } else {
    renderWorkingCanvasDisplay();
  }
}

export function resetGridZoom() {
  setGridZoom(100);
}
