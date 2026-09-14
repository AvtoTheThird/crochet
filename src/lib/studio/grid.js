import { state } from './state.js';
import { dom, gridCtx } from './dom.js';
import { readPositiveNumber, formatGridNumber, rgbToHex, colorsMatch } from './utils.js';

export function getGridMetrics() {
  const pw = readPositiveNumber('px-w', 8);
  const ph = readPositiveNumber('px-h', 8);
  const iw = state.workingCanvas.width;
  const ih = state.workingCanvas.height;
  const cols = Math.max(1, Math.floor((iw + 0.000001) / pw));
  const rows = Math.max(1, Math.floor((ih + 0.000001) / ph));
  return { pw, ph, iw, ih, cols, rows };
}

export function syncPixelCountFromCellSize() {
  if (!state.workingCanvas) return;
  const { cols, rows } = getGridMetrics();
  document.getElementById('grid-cols-input').value = cols;
  document.getElementById('grid-rows-input').value = rows;
}

export function syncCellSizeFromPixelCount() {
  if (!state.workingCanvas) return;
  const cols = parseInt(document.getElementById('grid-cols-input').value, 10);
  const rows = parseInt(document.getElementById('grid-rows-input').value, 10);

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

  gridCtx.beginPath();
  for (let x = 0; x <= iw + 0.000001; x += pw) {
    const dx = Math.round(x * scaleX) + 0.5;
    gridCtx.moveTo(dx, 0);
    gridCtx.lineTo(dx, dh);
  }
  for (let y = 0; y <= ih + 0.000001; y += ph) {
    const dy = Math.round(y * scaleY) + 0.5;
    gridCtx.moveTo(0, dy);
    gridCtx.lineTo(dw, dy);
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
