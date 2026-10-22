import { state } from './state.js';
import { dom, gridCtx } from './dom.js';
import { readPositiveNumber, formatGridNumber, rgbToHex, colorsMatch } from './utils.js';

export function getGridMetrics() {
  const pw = readPositiveNumber('px-w', 8);
  const ph = state.pixelSizeLocked ? pw : readPositiveNumber('px-h', 8);
  const iw = state.workingCanvas.width;
  const ih = state.workingCanvas.height;
  const cols = Math.max(1, Math.floor((iw + 0.000001) / pw));
  const rows = Math.max(1, Math.floor((ih + 0.000001) / ph));
  return { pw, ph, iw, ih, cols, rows };
}

/**
 * Crop the working canvas to an exact cols×pw by rows×ph region.
 * Removes the leftover strip that otherwise shows as a black bar in color preview.
 * @returns {boolean} true if the canvas was resized
 */
export function trimWorkingCanvasToGrid() {
  if (!state.workingCanvas) return false;
  const { pw, ph, iw, ih, cols, rows } = getGridMetrics();
  const tw = Math.min(iw, Math.max(1, Math.round(cols * pw)));
  const th = Math.min(ih, Math.max(1, Math.round(rows * ph)));
  if (tw === iw && th === ih) return false;

  const next = document.createElement('canvas');
  next.width = tw;
  next.height = th;
  const ctx = next.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(state.workingCanvas, 0, 0, tw, th, 0, 0, tw, th);

  state.workingCanvas = next;
  state.workingCtx = ctx;
  state.cropRect = { x: 0, y: 0, w: tw, h: th };
  state.pixelData = null;

  // Keep the user's cell size; refresh stitch counts for the trimmed bounds.
  syncPixelCountFromCellSize();
  return true;
}

/** Reflect `state.pixelSizeLocked` on the lock toggle button, if present. */
export function updatePixelSizeLockButton() {
  const btn = document.getElementById('pixel-lock-btn');
  if (!btn) return;
  const locked = !!state.pixelSizeLocked;
  btn.classList.toggle('active', locked);
  btn.setAttribute('aria-pressed', String(locked));
  btn.title = locked
    ? 'Pixel width and height are locked together'
    : 'Pixel width and height can differ';
  const icon = btn.querySelector('.pixel-lock-icon');
  if (icon) icon.textContent = locked ? '🔒' : '🔓';
  const label = btn.querySelector('.pixel-lock-label');
  if (label) label.textContent = locked ? 'Locked' : 'Unlocked';
}

/**
 * Copy one pixel-size input onto the other while the lock is on.
 * @param {'px-w' | 'px-h'} [sourceId] input whose value wins
 * @returns {boolean} whether the other input was changed
 */
export function enforceLockedPixelSize(sourceId = 'px-w') {
  if (!state.pixelSizeLocked) return false;
  const src = document.getElementById(sourceId);
  const dst = document.getElementById(sourceId === 'px-w' ? 'px-h' : 'px-w');
  if (!src || !dst || src.value === dst.value) return false;
  dst.value = src.value;
  return true;
}

/**
 * Turn the pixel-size lock on/off. Locking immediately equalizes the
 * height to the current width so the two inputs can no longer differ.
 * @param {boolean} locked
 */
export function setPixelSizeLocked(locked) {
  state.pixelSizeLocked = !!locked;
  if (state.pixelSizeLocked) enforceLockedPixelSize('px-w');
  updatePixelSizeLockButton();
}

export function togglePixelSizeLocked() {
  setPixelSizeLocked(!state.pixelSizeLocked);
  syncPixelCountFromCellSize();
  drawGrid();
}

export function syncPixelCountFromCellSize() {
  if (!state.workingCanvas) return;
  enforceLockedPixelSize('px-w');
  const { cols, rows } = getGridMetrics();
  document.getElementById('grid-cols-input').value = cols;
  document.getElementById('grid-rows-input').value = rows;
}

/**
 * @param {'grid-cols-input' | 'grid-rows-input'} [sourceId] count input the user edited;
 *   while locked, that side drives the (shared) pixel size and the other count is recomputed.
 */
export function syncCellSizeFromPixelCount(sourceId) {
  if (!state.workingCanvas) return;
  const cols = parseInt(document.getElementById('grid-cols-input').value, 10);
  const rows = parseInt(document.getElementById('grid-rows-input').value, 10);

  if (state.pixelSizeLocked) {
    if (sourceId === 'grid-rows-input') {
      if (Number.isFinite(rows) && rows > 0) {
        const clampedRows = Math.min(rows, state.workingCanvas.height);
        document.getElementById('grid-rows-input').value = clampedRows;
        const size = formatGridNumber(state.workingCanvas.height / clampedRows);
        document.getElementById('px-h').value = size;
        document.getElementById('px-w').value = size;
      }
    } else if (Number.isFinite(cols) && cols > 0) {
      const clampedCols = Math.min(cols, state.workingCanvas.width);
      document.getElementById('grid-cols-input').value = clampedCols;
      const size = formatGridNumber(state.workingCanvas.width / clampedCols);
      document.getElementById('px-w').value = size;
      document.getElementById('px-h').value = size;
    }
    syncPixelCountFromCellSize();
    return;
  }

  if (Number.isFinite(cols) && cols > 0) {
    const clampedCols = Math.min(cols, state.workingCanvas.width);
    document.getElementById('grid-cols-input').value = clampedCols;
    document.getElementById('px-w').value = formatGridNumber(state.workingCanvas.width / clampedCols);
  }
  if (Number.isFinite(rows) && rows > 0) {
    const clampedRows = Math.min(rows, state.workingCanvas.height);
    document.getElementById('grid-rows-input').value = clampedRows;
    document.getElementById('px-h').value = formatGridNumber(state.workingCanvas.height / clampedRows);
  }
}

export function drawGrid() {
  if (!state.workingCanvas) return;
  // After color correction, lock to the baked countMetrics so overlay matches the preview cells.
  const metrics =
    state.currentStep >= 4 && state.countMetrics
      ? {
          pw: state.countMetrics.pw,
          ph: state.countMetrics.ph,
          iw: state.workingCanvas.width,
          ih: state.workingCanvas.height
        }
      : getGridMetrics();
  const { pw, ph, iw, ih } = metrics;
  const dw = dom.mainCanvas.width;
  const dh = dom.mainCanvas.height;
  const op = parseInt(document.getElementById('grid-opacity').value, 10) / 100;

  gridCtx.clearRect(0, 0, dw, dh);
  gridCtx.strokeStyle = `rgba(232,255,71,${op})`;
  gridCtx.lineWidth = 1;

  const scaleX = dw / iw;
  const scaleY = dh / ih;
  // Once the pattern is baked, stop at its cells so a leftover strip doesn't read as a row.
  const baked = state.currentStep >= 4 && state.countMetrics;
  const gw = baked ? Math.min(iw, state.countMetrics.cols * pw) : iw;
  const gh = baked ? Math.min(ih, state.countMetrics.rows * ph) : ih;
  const lineW = baked ? Math.min(dw, Math.round(gw * scaleX)) : dw;
  const lineH = baked ? Math.min(dh, Math.round(gh * scaleY)) : dh;

  gridCtx.beginPath();
  for (let x = 0; x <= gw + 0.000001; x += pw) {
    const dx = Math.round(x * scaleX) + 0.5;
    gridCtx.moveTo(dx, 0);
    gridCtx.lineTo(dx, lineH);
  }
  for (let y = 0; y <= gh + 0.000001; y += ph) {
    const dy = Math.round(y * scaleY) + 0.5;
    gridCtx.moveTo(0, dy);
    gridCtx.lineTo(lineW, dy);
  }
  gridCtx.stroke();
}

export function snapColor(r, g, b, palette, tol) {
  for (const c of palette) {
    if (colorsMatch(r, g, b, c.r, c.g, c.b, tol)) return c;
  }
  const nc = { r, g, b, hex: rgbToHex(r, g, b) };
  palette.push(nc);
  return nc;
}

export function averageCellColor(data, iw, ih, col, row, pw, ph) {
  const x0 = Math.max(0, Math.min(iw - 1, Math.round(col * pw)));
  const y0 = Math.max(0, Math.min(ih - 1, Math.round(row * ph)));
  const x1 = Math.max(x0 + 1, Math.min(iw, Math.round((col + 1) * pw)));
  const y1 = Math.max(y0 + 1, Math.min(ih, Math.round((row + 1) * ph)));

  let r = 0, g = 0, b = 0, count = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const idx = (y * iw + x) * 4;
      r += data[idx];
      g += data[idx + 1];
      b += data[idx + 2];
      count++;
    }
  }
  return { r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) };
}

export function setStartDirection(direction) {
  state.startDirection = direction === 'rtl' ? 'rtl' : 'ltr';
  document.getElementById('start-ltr').classList.toggle('active', state.startDirection === 'ltr');
  document.getElementById('start-rtl').classList.toggle('active', state.startDirection === 'rtl');
}
