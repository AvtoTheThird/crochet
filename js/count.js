import { state } from './state.js';
import { dom, countCtx } from './dom.js';
import { roundRect } from './utils.js';
import { drawGrid } from './grid.js';
import { goStep } from './steps.js';

export function runLengthEncode() {
  const { cols, rows } = state.countMetrics;
  state.countResults = [];
  const startLeftToRight = state.startDirection === 'ltr';

  for (let logRow = 0; logRow < rows; logRow++) {
    const imgRow = rows - 1 - logRow;
    const rowData = state.countGrid[imgRow];
    const leftToRight = logRow % 2 === 0 ? startLeftToRight : !startLeftToRight;
    const cells = leftToRight ? [...rowData] : [...rowData].reverse();

    const segments = [];
    let cur = null;
    let count = 0;

    for (const cell of cells) {
      if (cur === null) {
        cur = cell;
        count = 1;
      } else if (cur.hex === cell.hex) {
        count++;
      } else {
        segments.push({ color: cur, count });
        cur = cell;
        count = 1;
      }
    }
    if (cur) segments.push({ color: cur, count });

    state.countResults.push({
      logRow,
      imgRow,
      dir: leftToRight ? '→' : '←',
      segments,
      cols
    });
  }
}

export function drawCountOverlay(pw, ph, rows, cols) {
  const iw = state.workingCanvas.width;
  const ih = state.workingCanvas.height;
  const dw = dom.mainCanvas.width;
  const dh = dom.mainCanvas.height;
  const scaleX = dw / iw;
  const scaleY = dh / ih;

  countCtx.clearRect(0, 0, dw, dh);

  for (const rowResult of state.countResults) {
    const { imgRow, dir, segments } = rowResult;
    const leftToRight = dir === '→';
    let colCursor = leftToRight ? 0 : cols - 1;
    const step = leftToRight ? 1 : -1;

    for (const seg of segments) {
      const endCol = colCursor + step * (seg.count - 1);
      const cellX = Math.round(endCol * pw * scaleX);
      const cellY = Math.round(imgRow * ph * scaleY);
      const cellW = Math.round(pw * scaleX);
      const cellH = Math.round(ph * scaleY);
      const cx = cellX + cellW / 2;
      const cy = cellY + cellH / 2;

      const fontSize = Math.max(7, Math.min(cellH * 0.55, cellW * 0.6, 14));
      countCtx.font = `bold ${fontSize}px 'Space Mono', monospace`;
      countCtx.textAlign = 'center';
      countCtx.textBaseline = 'middle';

      const txt = String(seg.count);
      const tw = countCtx.measureText(txt).width;
      const bw = tw + 4;
      const bh = fontSize + 3;

      countCtx.fillStyle = 'rgba(255,107,53,0.9)';
      roundRect(countCtx, cx - bw / 2, cy - bh / 2, bw, bh, 2);
      countCtx.fill();
      countCtx.fillStyle = '#fff';
      countCtx.fillText(txt, cx, cy);

      colCursor = endCol + step;
    }
  }

  drawGrid();
}

export function goCount() {
  if (!state.countGrid.length || !state.countMetrics) return;
  runLengthEncode();
  const { pw, ph, rows, cols } = state.countMetrics;
  drawCountOverlay(pw, ph, rows, cols);
  goStep(5);
}

export function toggleCountOverlay() {
  state.showCountOverlay = !state.showCountOverlay;
  dom.countCanvas.style.opacity = state.showCountOverlay ? '1' : '0';
}
