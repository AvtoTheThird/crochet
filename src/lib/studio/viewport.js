import { state } from "./state.js";
import { dom, mainCtx, gridCtx, countCtx, highlightCtx } from "./dom.js";
import { drawGrid } from "./grid.js";

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 10;

/** Last fully rasterized canvas bitmap size */
let bakedDw = 0;
let bakedDh = 0;

let zoomRaf = 0;
let bakeTimer = 0;
/** @type {{ x: number, y: number } | null} */
let pendingAnchor = null;

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
  const zoomEl = document.getElementById("grid-zoom");
  const zoomVal = document.getElementById("grid-zoom-val");
  const pct = Math.round(state.zoomLevel * 100);
  if (zoomEl) zoomEl.value = String(pct);
  if (zoomVal) zoomVal.textContent = `${pct}%`;
  if (dom.zoomInfo && state.workingCanvas) {
    dom.zoomInfo.textContent = `${state.workingCanvas.width}×${state.workingCanvas.height}px · ${Math.round(state.displayScale * 100)}% · scroll zoom · drag pan`;
  }
}

/** Visual (CSS) display size — correct during soft-zoom CSS stretch. */
export function getDisplaySize() {
  const dw = dom.mainCanvas?.clientWidth || dom.mainCanvas?.width || 0;
  const dh = dom.mainCanvas?.clientHeight || dom.mainCanvas?.height || 0;
  return { dw, dh };
}

function targetDisplaySize() {
  const sw = state.workingCanvas.width;
  const sh = state.workingCanvas.height;
  state.displayScale = state.baseDisplayScale * state.zoomLevel;
  return {
    dw: Math.max(1, Math.round(sw * state.displayScale)),
    dh: Math.max(1, Math.round(sh * state.displayScale)),
  };
}

function cancelScheduledZoom() {
  if (zoomRaf) {
    cancelAnimationFrame(zoomRaf);
    zoomRaf = 0;
  }
  if (bakeTimer) {
    clearTimeout(bakeTimer);
    bakeTimer = 0;
  }
}

/**
 * Stretch existing bitmaps via CSS (cheap). Used while the wheel/slider is moving.
 * @param {number} dw
 * @param {number} dh
 * @param {{ x: number, y: number } | null} anchor
 */
function applyCssDisplaySize(dw, dh, anchor) {
  const oldW = dom.wrapper.offsetWidth || bakedDw || dw;
  const oldH = dom.wrapper.offsetHeight || bakedDh || dh;

  for (const c of [
    dom.mainCanvas,
    dom.gridCanvas,
    dom.countCanvas,
    dom.highlightCanvas,
  ]) {
    c.style.width = dw + "px";
    c.style.height = dh + "px";
  }
  dom.wrapper.style.width = dw + "px";
  dom.wrapper.style.height = dh + "px";

  if (anchor) {
    const rect = dom.canvasArea.getBoundingClientRect();
    const contentX = dom.canvasArea.scrollLeft + anchor.x - rect.left;
    const contentY = dom.canvasArea.scrollTop + anchor.y - rect.top;
    const ratioX = dw / Math.max(oldW, 1);
    const ratioY = dh / Math.max(oldH, 1);
    dom.canvasArea.scrollLeft = Math.max(
      0,
      contentX * ratioX - (anchor.x - rect.left),
    );
    dom.canvasArea.scrollTop = Math.max(
      0,
      contentY * ratioY - (anchor.y - rect.top),
    );
  }

  updateZoomUI();
  import("./crop.js").then((m) => m.updateCropUI());
}

/**
 * Rebuild canvas bitmaps at the target size and redraw (expensive — run after zoom settles).
 * @param {number} dw
 * @param {number} dh
 */
async function bakeDisplay(dw, dh) {
  const sizeChanged =
    dom.mainCanvas.width !== dw ||
    dom.mainCanvas.height !== dh ||
    bakedDw !== dw ||
    bakedDh !== dh;

  if (sizeChanged) {
    for (const c of [
      dom.mainCanvas,
      dom.gridCanvas,
      dom.countCanvas,
      dom.highlightCanvas,
    ]) {
      c.width = dw;
      c.height = dh;
      c.style.width = dw + "px";
      c.style.height = dh + "px";
    }
    bakedDw = dw;
    bakedDh = dh;
  }

  dom.wrapper.style.width = dw + "px";
  dom.wrapper.style.height = dh + "px";

  mainCtx.imageSmoothingEnabled = false;
  gridCtx.clearRect(0, 0, dw, dh);
  countCtx.clearRect(0, 0, dw, dh);
  highlightCtx.clearRect(0, 0, dw, dh);

  if (state.currentStep >= 4 && state.countGrid.length) {
    const { drawColorPreview, drawColorHighlight } =
      await import("./color-correction.js");
    drawColorPreview();
    if (state.highlightedSourceHex)
      drawColorHighlight(state.highlightedSourceHex);
  } else {
    mainCtx.clearRect(0, 0, dw, dh);
    mainCtx.drawImage(
      state.workingCanvas,
      0,
      0,
      state.workingCanvas.width,
      state.workingCanvas.height,
      0,
      0,
      dw,
      dh,
    );
  }

  updateZoomUI();
  const { updateCropUI } = await import("./crop.js");
  updateCropUI();

  if (state.currentStep === 3) drawGrid();
  if (state.currentStep === 4 && state.countMetrics) drawGrid();
  if (state.currentStep === 5 && state.countMetrics) {
    const { renderPatternWalkCanvases } = await import("./pattern-walk.js");
    renderPatternWalkCanvases();
  }
}

/** Full crisp redraw at the current zoom (step changes, load, etc.). */
export async function renderWorkingCanvasDisplay() {
  if (!state.workingCanvas) return;
  cancelScheduledZoom();
  const { dw, dh } = targetDisplaySize();
  await bakeDisplay(dw, dh);
}

/**
 * Zoom with rAF-coalesced CSS soft-zoom, then a debounced bitmap bake.
 * @param {number|string} value percent (e.g. 120)
 * @param {number} [anchorX]
 * @param {number} [anchorY]
 */
export function setGridZoom(value, anchorX, anchorY) {
  if (!state.workingCanvas) return;

  const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(value) / 100 || 1));
  // Already at this zoom (e.g. wheel past min/max) — skip soft-zoom + bake.
  if (Math.abs(next - state.zoomLevel) < 1e-9) return;

  state.zoomLevel = next;

  if (anchorX !== undefined && anchorY !== undefined) {
    pendingAnchor = { x: anchorX, y: anchorY };
  }

  if (zoomRaf) return;
  zoomRaf = requestAnimationFrame(() => {
    zoomRaf = 0;
    const { dw, dh } = targetDisplaySize();
    const anchor = pendingAnchor;
    pendingAnchor = null;
    applyCssDisplaySize(dw, dh, anchor);

    if (bakeTimer) clearTimeout(bakeTimer);
    bakeTimer = setTimeout(() => {
      bakeTimer = 0;
      if (!state.workingCanvas) return;
      const size = targetDisplaySize();
      bakeDisplay(size.dw, size.dh);
    }, 80);
  });
}

export function resetGridZoom() {
  setGridZoom(100);
}

/** Reset bake cache when the working image size changes. */
export function resetZoomBakeCache() {
  bakedDw = 0;
  bakedDh = 0;
  cancelScheduledZoom();
}
