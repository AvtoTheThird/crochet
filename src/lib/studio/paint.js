import { state } from "./state.js";
import { dom } from "./dom.js";
import { hexToRgb } from "./utils.js";
import { runLengthEncode } from "./count.js";
import { buildWalkStepsFromCountResults } from "./pattern-walk.js";
import {
  createYarn,
  countCellsForSource,
  syncCellFromYarn,
  invalidateColorPreviewCache,
  scheduleColorPreviewRender,
  renderPaletteUI,
} from "./color-correction.js";
import { studioUi } from "./ui.svelte.js";

const UNDO_LIMIT = 5;

/** Most recent strokes last; each maps "row,col" to the cell's source before the stroke. */
/** @type {{ grid: any[][], previous: Map<string, string> }[]} */
let history = [];

function syncUndoCount() {
  studioUi.undoCount = history.length;
}

export function clearPaintHistory() {
  history = [];
  syncUndoCount();
}

/** @type {{ sourceHex: string, pointerId: number, last: { col: number, row: number }, changed: boolean, wasVisible: boolean, previous: Map<string, string> } | null} */
let stroke = null;

export function isPaintActive() {
  return (
    studioUi.paintOpen &&
    state.currentStep === 4 &&
    state.countGrid.length > 0 &&
    !!state.countMetrics
  );
}

/**
 * Grid cell under a viewport point, or null when outside the artwork.
 * @param {number} clientX
 * @param {number} clientY
 */
function cellFromPoint(clientX, clientY) {
  if (!state.workingCanvas || !state.countMetrics || !dom.mainCanvas) return null;
  const rect = dom.mainCanvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const { pw, ph, cols, rows } = state.countMetrics;
  const x = ((clientX - rect.left) / rect.width) * state.workingCanvas.width;
  const y = ((clientY - rect.top) / rect.height) * state.workingCanvas.height;
  const col = Math.floor(x / pw);
  const row = Math.floor(y / ph);
  if (col < 0 || row < 0 || col >= cols || row >= rows) return null;
  return { col, row };
}

/**
 * Palette source the brush paints with, creating a new yarn for unseen colors.
 * @returns {string}
 */
function resolvePaintSource() {
  const bound = studioUi.paintSource;
  if (bound && state.yarnColors.has(state.sourceToYarn.get(bound))) return bound;

  const hex = studioUi.paintColor.toLowerCase();
  for (const [sourceHex, yarnId] of state.sourceToYarn) {
    if (state.yarnColors.get(yarnId)?.hex === hex) return sourceHex;
  }

  let key = hex;
  for (let n = 2; state.sourceToYarn.has(key); n++) key = `${hex}-${n}`;
  const { r, g, b } = hexToRgb(hex);
  const yarn = createYarn(r, g, b);
  state.sourceToYarn.set(key, yarn.id);
  return key;
}

function paintCell(col, row, sourceHex) {
  const cell = state.countGrid[row]?.[col];
  if (!cell || cell.sourceHex === sourceHex) return false;
  const key = `${row},${col}`;
  if (stroke && !stroke.previous.has(key)) stroke.previous.set(key, cell.sourceHex);
  cell.sourceHex = sourceHex;
  syncCellFromYarn(cell);
  return true;
}

/** Paint every cell on the line between two cells so fast drags leave no gaps. */
function paintLine(from, to, sourceHex) {
  let { col: x0, row: y0 } = from;
  const { col: x1, row: y1 } = to;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let changed = false;
  for (;;) {
    if (paintCell(x0, y0, sourceHex)) changed = true;
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
  return changed;
}

/** Scroll the left-hand palette list to an entry and flash it. */
export function revealPaletteItem(sourceHex) {
  const list = dom.paletteList;
  if (!list) return;
  const item = list.querySelector(
    `.palette-item[data-source-hex="${CSS.escape(sourceHex)}"]`,
  );
  if (!(item instanceof HTMLElement)) return;
  const listRect = list.getBoundingClientRect();
  const itemRect = item.getBoundingClientRect();
  const top =
    list.scrollTop +
    (itemRect.top - listRect.top) -
    (list.clientHeight - itemRect.height) / 2;
  list.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  item.classList.remove("is-new");
  void item.offsetWidth;
  item.classList.add("is-new");
  item.addEventListener("animationend", () => item.classList.remove("is-new"), {
    once: true,
  });
}

/** Keep an existing run-length pattern in sync with painted cells. */
function refreshPatternAfterPaint() {
  if (!state.countResults.length) return;
  runLengthEncode();
  if (state.patternWalk.steps.length) {
    state.patternWalk.steps = buildWalkStepsFromCountResults();
    state.patternWalk.currentIndex = Math.min(
      state.patternWalk.currentIndex,
      Math.max(0, state.patternWalk.steps.length - 1),
    );
  }
}

function pickColorAt(cell) {
  const sourceHex = state.countGrid[cell.row]?.[cell.col]?.sourceHex;
  const yarn = state.yarnColors.get(state.sourceToYarn.get(sourceHex));
  if (!yarn) return;
  studioUi.paintSource = sourceHex;
  studioUi.paintColor = yarn.hex;
  studioUi.paintTool = "brush";
}

/** Undo the in-progress stroke, e.g. when a second finger turns it into a pinch. */
export function cancelPaintStroke() {
  if (!stroke) return;
  const { previous, changed, wasVisible, pointerId } = stroke;
  stroke = null;
  try {
    dom.wrapper.releasePointerCapture(pointerId);
  } catch {
    /* already released */
  }
  if (!changed) return;
  restoreCells(previous);
  if (!wasVisible) renderPaletteUI();
}

/** @param {Map<string, string>} previous */
function restoreCells(previous) {
  for (const [key, sourceHex] of previous) {
    const [row, col] = key.split(",").map(Number);
    const cell = state.countGrid[row]?.[col];
    if (!cell) continue;
    cell.sourceHex = sourceHex;
    syncCellFromYarn(cell);
  }
  invalidateColorPreviewCache();
  scheduleColorPreviewRender();
}

export function undoPaint() {
  if (stroke) return;
  const entry = history.pop();
  syncUndoCount();
  if (!entry) return;
  if (entry.grid !== state.countGrid) {
    clearPaintHistory();
    return;
  }
  restoreCells(entry.previous);
  state.gridRevision++;
  refreshPatternAfterPaint();
  renderPaletteUI();
}

function onPointerDown(e) {
  if (stroke && e.pointerId !== stroke.pointerId) {
    cancelPaintStroke();
    return;
  }
  if (!isPaintActive() || e.button !== 0) return;
  const cell = cellFromPoint(e.clientX, e.clientY);
  if (!cell) return;
  e.preventDefault();

  if (e.altKey || studioUi.paintTool === "picker") {
    pickColorAt(cell);
    return;
  }

  const sourceHex = resolvePaintSource();
  studioUi.paintSource = sourceHex;
  stroke = {
    sourceHex,
    pointerId: e.pointerId,
    last: cell,
    changed: false,
    wasVisible: countCellsForSource(sourceHex) > 0,
    previous: new Map(),
  };
  dom.wrapper.setPointerCapture(e.pointerId);
  applyStrokeSegment(cell, cell);
}

function onPointerMove(e) {
  if (!stroke || e.pointerId !== stroke.pointerId) return;
  const cell = cellFromPoint(e.clientX, e.clientY);
  if (!cell) return;
  if (cell.col === stroke.last.col && cell.row === stroke.last.row) return;
  applyStrokeSegment(stroke.last, cell);
  stroke.last = cell;
}

function applyStrokeSegment(from, to) {
  if (!paintLine(from, to, stroke.sourceHex)) return;
  invalidateColorPreviewCache();
  scheduleColorPreviewRender();
  if (!stroke.changed && !stroke.wasVisible) {
    renderPaletteUI();
    revealPaletteItem(stroke.sourceHex);
  }
  stroke.changed = true;
}

function onPointerUp(e) {
  if (!stroke || e.pointerId !== stroke.pointerId) return;
  const { changed, previous } = stroke;
  stroke = null;
  try {
    dom.wrapper.releasePointerCapture(e.pointerId);
  } catch {
    /* already released */
  }
  if (!changed) return;
  history.push({ grid: state.countGrid, previous });
  if (history.length > UNDO_LIMIT) history.shift();
  syncUndoCount();
  state.gridRevision++;
  refreshPatternAfterPaint();
  renderPaletteUI();
}

/** @returns {() => void} cleanup */
export function initPaintHandlers() {
  const el = dom.wrapper;
  el.addEventListener("pointerdown", onPointerDown);
  el.addEventListener("pointermove", onPointerMove);
  el.addEventListener("pointerup", onPointerUp);
  el.addEventListener("pointercancel", onPointerUp);
  return () => {
    el.removeEventListener("pointerdown", onPointerDown);
    el.removeEventListener("pointermove", onPointerMove);
    el.removeEventListener("pointerup", onPointerUp);
    el.removeEventListener("pointercancel", onPointerUp);
  };
}
