import { state } from './state.js';
import { roundRect, getColorLabel } from './utils.js';

function getPaletteStats() {
  const stats = new Map();
  for (const row of state.countGrid) {
    for (const color of row) {
      if (!color) continue;
      const key = color.hex;
      const entry = stats.get(key) || { color, count: 0 };
      entry.count++;
      stats.set(key, entry);
    }
  }
  return [...stats.values()];
}

function getExportFooterLayout(stats, width, scale) {
  const padding = 10 * scale;
  const lineHeight = 18 * scale;
  const entryWidth = 148 * scale;
  const minWidth = 300 * scale;
  const footerWidth = Math.max(width, minWidth);
  const entriesPerRow = Math.max(1, Math.floor((footerWidth - padding * 2) / entryWidth));
  const entryRows = Math.max(1, Math.ceil(stats.length / entriesPerRow));
  return { width: footerWidth, height: padding * 2 + lineHeight * (1 + entryRows), padding, lineHeight, entryWidth, entriesPerRow };
}

function drawExportCells(ctx, width, height, scale, offsetX = 0, offsetY = 0) {
  const { pw, ph, cols, rows } = state.countMetrics;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const color = state.countGrid[row]?.[col];
      if (!color) continue;
      const x0 = offsetX + Math.round(col * pw * scale);
      const y0 = offsetY + Math.round(row * ph * scale);
      const x1 = offsetX + (col === cols - 1 ? width : Math.round((col + 1) * pw * scale));
      const y1 = offsetY + (row === rows - 1 ? height : Math.round((row + 1) * ph * scale));
      ctx.fillStyle = color.hex;
      ctx.fillRect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
    }
  }
}

function drawExportGridOverlay(ctx, width, height, scale, offsetX = 0, offsetY = 0) {
  const { pw, ph, cols, rows } = state.countMetrics;
  const op = parseInt(document.getElementById('grid-opacity').value, 10) / 100;
  const thickness = Math.max(1, Math.round(scale));
  const offset = Math.floor(thickness / 2);
  ctx.fillStyle = `rgba(232,255,71,${op})`;
  for (let col = 0; col <= cols; col++) {
    const x = offsetX + (col === cols ? width - thickness : Math.max(0, Math.round(col * pw * scale) - offset));
    ctx.fillRect(x, offsetY, thickness, height);
  }
  for (let row = 0; row <= rows; row++) {
    const y = offsetY + (row === rows ? height - thickness : Math.max(0, Math.round(row * ph * scale) - offset));
    ctx.fillRect(offsetX, y, width, thickness);
  }
}

function drawExportNumberOverlay(ctx, scale, offsetX = 0, offsetY = 0) {
  const { pw, ph, cols } = state.countMetrics;
  for (const rowResult of state.countResults) {
    const { imgRow, dir, segments } = rowResult;
    const leftToRight = dir === '→';
    let colCursor = leftToRight ? 0 : cols - 1;
    const step = leftToRight ? 1 : -1;
    for (const seg of segments) {
      const endCol = colCursor + step * (seg.count - 1);
      const cellX0 = offsetX + Math.round(endCol * pw * scale);
      const cellY0 = offsetY + Math.round(imgRow * ph * scale);
      const cellX1 = offsetX + Math.round((endCol + 1) * pw * scale);
      const cellY1 = offsetY + Math.round((imgRow + 1) * ph * scale);
      const cellW = Math.max(1, cellX1 - cellX0);
      const cellH = Math.max(1, cellY1 - cellY0);
      const cx = cellX0 + cellW / 2;
      const cy = cellY0 + cellH / 2;
      const fontSize = Math.max(7 * scale, Math.min(cellH * 0.55, cellW * 0.6, 16 * scale));
      ctx.font = `bold ${fontSize}px 'Space Mono', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const txt = String(seg.count);
      const tw = ctx.measureText(txt).width;
      const padX = Math.max(2 * scale, fontSize * 0.2);
      const padY = Math.max(2 * scale, fontSize * 0.12);
      const bw = tw + padX * 2;
      const bh = fontSize + padY * 2;
      ctx.fillStyle = 'rgba(255,107,53,0.9)';
      roundRect(ctx, cx - bw / 2, cy - bh / 2, bw, bh, Math.max(2, 2 * scale));
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(txt, cx, cy);
      colCursor = endCol + step;
    }
  }
}

function drawExportPaletteFooter(ctx, stats, x, y, layout, scale) {
  const swatch = 10 * scale;
  const fontSize = 10 * scale;
  ctx.fillStyle = '#16161a';
  ctx.fillRect(0, y, ctx.canvas.width, layout.height);
  ctx.fillStyle = '#2a2a35';
  ctx.fillRect(0, y, ctx.canvas.width, Math.max(1, Math.round(scale)));
  ctx.font = `bold ${fontSize}px 'Space Mono', monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e8ff47';
  ctx.fillText(`Unique colors: ${stats.length}`, x + layout.padding, y + layout.padding + layout.lineHeight / 2);
  ctx.font = `${fontSize}px 'Space Mono', monospace`;
  for (let i = 0; i < stats.length; i++) {
    const entry = stats[i];
    const col = i % layout.entriesPerRow;
    const row = Math.floor(i / layout.entriesPerRow);
    const entryX = x + layout.padding + col * layout.entryWidth;
    const entryY = y + layout.padding + layout.lineHeight * (row + 1) + layout.lineHeight / 2;
    const label = getColorLabel(entry.color);
    ctx.fillStyle = entry.color.hex;
    ctx.fillRect(entryX, entryY - swatch / 2, swatch, swatch);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = Math.max(1, scale);
    ctx.strokeRect(entryX, entryY - swatch / 2, swatch, swatch);
    ctx.fillStyle = '#e8e8f0';
    ctx.fillText(`${label} (${entry.color.hex}) x ${entry.count}`, entryX + swatch + 6 * scale, entryY);
  }
}

export function exportPNG(scale) {
  if (!state.countGrid.length || !state.countMetrics || !state.countResults.length) return;
  const exportScale = Math.max(1, Math.min(4, parseInt(scale, 10) || 1));
  const { pw, ph, cols, rows } = state.countMetrics;
  const imageWidth = Math.max(1, Math.round(cols * pw * exportScale));
  const imageHeight = Math.max(1, Math.round(rows * ph * exportScale));
  const paletteStats = getPaletteStats();
  const footerLayout = getExportFooterLayout(paletteStats, imageWidth, exportScale);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(Math.max(imageWidth, footerLayout.width));
  canvas.height = Math.round(imageHeight + footerLayout.height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#0d0d0f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const imageOffsetX = Math.round((canvas.width - imageWidth) / 2);
  drawExportCells(ctx, imageWidth, imageHeight, exportScale, imageOffsetX, 0);
  if (document.getElementById('export-grid-overlay').checked) {
    drawExportGridOverlay(ctx, imageWidth, imageHeight, exportScale, imageOffsetX, 0);
  }
  drawExportNumberOverlay(ctx, exportScale, imageOffsetX, 0);
  drawExportPaletteFooter(ctx, paletteStats, 0, imageHeight, footerLayout, exportScale);
  canvas.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pixel-count-${cols}x${rows}-${exportScale}x.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}
