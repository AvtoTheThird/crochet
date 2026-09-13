import { state } from "./state.js";
import { dom, highlightCtx } from "./dom.js";
import { getColorLabel } from "./utils.js";
import { runLengthEncode } from "./count.js";
import { drawGrid } from "./grid.js";
import { drawCountOverlay } from "./count.js";
import { renderWorkingCanvasDisplay } from "./viewport.js";

const DEFAULT_OPTIONS = {
  highlightRow: true,
  enlargeSegment: true,
  dimOtherRows: true,
  showGrid: true,
  showCountNumbers: false,
};

export function buildWalkStepsFromCountResults() {
  const steps = [];
  if (!state.countResults.length) return steps;

  for (const rowResult of state.countResults) {
    const { imgRow, dir, segments, logRow, cols } = rowResult;
    const leftToRight = dir === "→";
    let colCursor = leftToRight ? 0 : cols - 1;
    const step = leftToRight ? 1 : -1;

    segments.forEach((segment, segIndex) => {
      const startCol = colCursor;
      const endCol = colCursor + step * (segment.count - 1);
      steps.push({
        logRow,
        imgRow,
        segIndex,
        segment,
        dir,
        cols,
        startCol: Math.min(startCol, endCol),
        endCol: Math.max(startCol, endCol),
        leftToRight,
      });
      colCursor = endCol + step;
    });
  }
  return steps;
}

/** Fallback: rebuild walk steps from Count-stage CSV textarea. */
export function buildWalkStepsFromCsv(csvText) {
  const lines = csvText.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const rowMap = new Map();
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    if (parts.length < 5) continue;
    const logRow = parseInt(parts[0], 10) - 1;
    const dir = parts[1].trim();
    const hex = parts[2].trim();
    const name = parts[3].trim();
    const count = parseInt(parts[4], 10);
    if (!Number.isFinite(logRow) || !Number.isFinite(count) || count < 1) continue;

    if (!rowMap.has(logRow)) rowMap.set(logRow, { dir, segments: [] });
    rowMap.get(logRow).segments.push({
      color: { hex, name: name || hex },
      count,
    });
  }

  const rows = state.countMetrics?.rows ?? 0;
  const cols = state.countMetrics?.cols ?? 0;
  const saved = state.countResults;
  state.countResults = [...rowMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([logRow, data]) => ({
      logRow,
      imgRow: rows - 1 - logRow,
      dir: data.dir,
      segments: data.segments,
      cols,
    }));
  const steps = buildWalkStepsFromCountResults();
  state.countResults = saved;
  return steps;
}

function ensureWalkSteps() {
  if (state.patternWalk.steps.length) return;
  if (state.countResults.length) {
    state.patternWalk.steps = buildWalkStepsFromCountResults();
    return;
  }
  const csv = document.getElementById("export-csv")?.value;
  if (csv) state.patternWalk.steps = buildWalkStepsFromCsv(csv);
}

export async function enterPatternWalk() {
  if (!state.countGrid.length || !state.countMetrics) return;
  if (!state.countResults.length) runLengthEncode();
  state.patternWalk.steps = buildWalkStepsFromCountResults();
  if (!state.patternWalk.steps.length) {
    const csv = document.getElementById("export-csv")?.value;
    if (csv) state.patternWalk.steps = buildWalkStepsFromCsv(csv);
  }
  state.patternWalk.currentIndex = 0;
  const { goStep } = await import("./steps.js");
  goStep(6);
  const { autoSaveProject } = await import("./projects.js");
  autoSaveProject();
}

function getCurrentWalkStep() {
  const steps = state.patternWalk.steps;
  if (!steps.length) return null;
  const idx = Math.max(0, Math.min(state.patternWalk.currentIndex, steps.length - 1));
  state.patternWalk.currentIndex = idx;
  return steps[idx];
}

export function drawPatternWalkOverlay() {
  highlightCtx.clearRect(
    0,
    0,
    dom.highlightCanvas.width,
    dom.highlightCanvas.height,
  );

  const step = getCurrentWalkStep();
  if (!step || !state.countMetrics || !state.workingCanvas) return;

  const opts = state.patternWalk.options;
  const { pw, ph, rows, cols } = state.countMetrics;
  const iw = state.workingCanvas.width;
  const ih = state.workingCanvas.height;
  const dw = dom.highlightCanvas.width;
  const dh = dom.highlightCanvas.height;
  const scaleX = dw / iw;
  const scaleY = dh / ih;

  const rowY0 = Math.round(step.imgRow * ph * scaleY);
  const rowY1 =
    step.imgRow === rows - 1
      ? dh
      : Math.round((step.imgRow + 1) * ph * scaleY);
  const rowH = Math.max(1, rowY1 - rowY0);

  if (opts.dimOtherRows) {
    highlightCtx.fillStyle = "rgba(0, 0, 0, 0.58)";
    if (rowY0 > 0) highlightCtx.fillRect(0, 0, dw, rowY0);
    if (rowY1 < dh) highlightCtx.fillRect(0, rowY1, dw, dh - rowY1);
  }

  if (opts.highlightRow) {
    highlightCtx.strokeStyle = "rgba(232, 255, 71, 0.95)";
    highlightCtx.lineWidth = 3;
    highlightCtx.strokeRect(1.5, rowY0 + 1.5, dw - 3, rowH - 3);
    highlightCtx.fillStyle = "rgba(232, 255, 71, 0.08)";
    highlightCtx.fillRect(0, rowY0, dw, rowH);
  }

  if (opts.enlargeSegment) {
    const pad = Math.max(2, Math.min(pw, ph) * scaleX * 0.12);
    const lift = Math.max(1, Math.min(pw, ph) * scaleY * 0.08);
    for (let col = step.startCol; col <= step.endCol; col++) {
      const x0 = Math.round(col * pw * scaleX);
      const y0 = Math.round(step.imgRow * ph * scaleY);
      const x1 =
        col === cols - 1 ? dw : Math.round((col + 1) * pw * scaleX);
      const y1 =
        step.imgRow === rows - 1 ? dh : Math.round((step.imgRow + 1) * ph * scaleY);
      const w = Math.max(1, x1 - x0);
      const h = Math.max(1, y1 - y0);
      const color = step.segment.color;

      highlightCtx.fillStyle = color.hex || "#fff";
      highlightCtx.fillRect(
        x0 - pad,
        y0 - pad - lift,
        w + pad * 2,
        h + pad * 2,
      );
      highlightCtx.strokeStyle = "rgba(255, 255, 255, 0.92)";
      highlightCtx.lineWidth = 2;
      highlightCtx.strokeRect(
        x0 - pad + 0.5,
        y0 - pad - lift + 0.5,
        w + pad * 2 - 1,
        h + pad * 2 - 1,
      );
    }
  } else {
    highlightCtx.fillStyle = "rgba(232, 255, 71, 0.35)";
    for (let col = step.startCol; col <= step.endCol; col++) {
      const x0 = Math.round(col * pw * scaleX);
      const y0 = Math.round(step.imgRow * ph * scaleY);
      const x1 =
        col === cols - 1 ? dw : Math.round((col + 1) * pw * scaleX);
      const y1 =
        step.imgRow === rows - 1 ? dh : Math.round((step.imgRow + 1) * ph * scaleY);
      highlightCtx.fillRect(
        x0,
        y0,
        Math.max(1, x1 - x0),
        Math.max(1, y1 - y0),
      );
    }
  }
}

export function updatePatternWalkUI() {
  const steps = state.patternWalk.steps;
  const step = getCurrentWalkStep();
  const total = steps.length;
  const idx = state.patternWalk.currentIndex;

  const progressEl = document.getElementById("walk-progress");
  const detailEl = document.getElementById("walk-detail");
  const rowEl = document.getElementById("walk-row-info");
  const prevBtn = document.getElementById("walk-prev");
  const nextBtn = document.getElementById("walk-next");
  const floatPrev = document.getElementById("walk-float-prev");
  const floatNext = document.getElementById("walk-float-next");
  const topProgress = document.getElementById("walk-topbar-progress");
  const topDetail = document.getElementById("walk-topbar-detail");
  const topRowInfo = document.getElementById("walk-topbar-rowinfo");

  if (!progressEl) return;

  if (!step || !total) {
    progressEl.textContent = "No stitch data";
    if (detailEl) detailEl.textContent = "Run Count first or paste CSV.";
    if (rowEl) rowEl.textContent = "";
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    if (floatPrev) floatPrev.disabled = true;
    if (floatNext) floatNext.disabled = true;
    if (topProgress) topProgress.textContent = "";
    if (topDetail) topDetail.innerHTML = "";
    if (topRowInfo) topRowInfo.textContent = "";
    return;
  }

  const label = getColorLabel(step.segment.color);
  const segNum = step.segIndex + 1;
  const rowSegCount = state.countResults[step.logRow]?.segments.length ?? "?";
  const progressText = `Stitch ${idx + 1} of ${total}`;
  const detailHTML = `<span class="walk-color-swatch" style="background:${step.segment.color.hex}"></span> <strong>${label}</strong> × ${step.segment.count}`;
  const rowText = `Row ${step.logRow + 1} (${step.dir}) · seg ${segNum}/${rowSegCount}`;

  progressEl.textContent = progressText;
  if (detailEl) detailEl.innerHTML = detailHTML;
  if (rowEl) {
    rowEl.textContent = `Row ${step.logRow + 1} (${step.dir}) · segment ${segNum} of ${rowSegCount}`;
  }
  if (topProgress) topProgress.textContent = progressText;
  if (topDetail) topDetail.innerHTML = detailHTML;
  if (topRowInfo) topRowInfo.textContent = rowText;
  if (prevBtn) prevBtn.disabled = idx <= 0;
  if (nextBtn) nextBtn.disabled = idx >= total - 1;
  if (floatPrev) floatPrev.disabled = idx <= 0;
  if (floatNext) floatNext.disabled = idx >= total - 1;
}

export function refreshPatternWalkView() {
  updatePatternWalkUI();
  renderWorkingCanvasDisplay();
}

export function patternWalkNext() {
  if (state.patternWalk.currentIndex < state.patternWalk.steps.length - 1) {
    state.patternWalk.currentIndex++;
    refreshPatternWalkView();
  }
}

export function patternWalkPrev() {
  if (state.patternWalk.currentIndex > 0) {
    state.patternWalk.currentIndex--;
    refreshPatternWalkView();
  }
}

export function setPatternWalkOption(key, value) {
  if (key in state.patternWalk.options) {
    state.patternWalk.options[key] = value;
    refreshPatternWalkView();
  }
}

export function initPatternWalkHandlers() {
  const bindToggle = (id, key) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.checked = state.patternWalk.options[key];
    el.addEventListener("change", () => {
      setPatternWalkOption(key, el.checked);
    });
  };

  bindToggle("walk-opt-highlight-row", "highlightRow");
  bindToggle("walk-opt-enlarge", "enlargeSegment");
  bindToggle("walk-opt-dim-rows", "dimOtherRows");
  bindToggle("walk-opt-grid", "showGrid");
  bindToggle("walk-opt-count-numbers", "showCountNumbers");

  document.getElementById("walk-prev")?.addEventListener("click", patternWalkPrev);
  document.getElementById("walk-next")?.addEventListener("click", patternWalkNext);
  document.addEventListener("keydown", (e) => {
    if (state.currentStep !== 6) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      patternWalkNext();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      patternWalkPrev();
    }
  });
}

export function onEnterPatternWalkStep() {
  ensureWalkSteps();
  if (!state.patternWalk.options) {
    state.patternWalk.options = { ...DEFAULT_OPTIONS };
  }
  syncWalkOptionCheckboxes();
  updatePatternWalkUI();
}

function syncWalkOptionCheckboxes() {
  const opts = state.patternWalk.options;
  for (const [id, key] of [
    ["walk-opt-highlight-row", "highlightRow"],
    ["walk-opt-enlarge", "enlargeSegment"],
    ["walk-opt-dim-rows", "dimOtherRows"],
    ["walk-opt-grid", "showGrid"],
    ["walk-opt-count-numbers", "showCountNumbers"],
  ]) {
    const el = document.getElementById(id);
    if (el) el.checked = !!opts[key];
  }
}

export function renderPatternWalkCanvases() {
  const opts = state.patternWalk.options;
  const { pw, ph, rows, cols } = state.countMetrics || {};
  if (opts.showGrid) drawGrid();
  if (opts.showCountNumbers && pw) drawCountOverlay(pw, ph, rows, cols);
  drawPatternWalkOverlay();
}
