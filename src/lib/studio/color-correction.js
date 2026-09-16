import { state } from "./state.js";
import { dom, mainCtx, highlightCtx } from "./dom.js";
import { rgbToHex, hexToRgb, colorsMatch, nextId } from "./utils.js";
import { getGridMetrics, averageCellColor, snapColor, trimWorkingCanvasToGrid } from "./grid.js";
import { renderWorkingCanvasDisplay, updateBaseDisplayScale, resetZoomBakeCache } from "./viewport.js";

function createYarn(r, g, b, name = "") {
  const hex = rgbToHex(r, g, b);
  const id = nextId();
  const yarn = { id, r, g, b, hex, name: name || hex };
  state.yarnColors.set(id, yarn);
  return yarn;
}

function sourcesForYarn(yarnId) {
  return [...state.sourceToYarn.entries()]
    .filter(([, id]) => id === yarnId)
    .map(([hex]) => hex);
}

function pruneOrphanYarns() {
  const used = new Set(state.sourceToYarn.values());
  for (const id of [...state.yarnColors.keys()]) {
    if (!used.has(id)) state.yarnColors.delete(id);
  }
}

function countCellsForSource(sourceHex) {
  let n = 0;
  for (const row of state.countGrid) {
    for (const cell of row) {
      if (cell?.sourceHex === sourceHex) n++;
    }
  }
  return n;
}

function syncCellFromYarn(cell) {
  const yarnId = state.sourceToYarn.get(cell.sourceHex);
  const yarn = state.yarnColors.get(yarnId);
  if (!yarn) return;
  cell.yarnId = yarn.id;
  cell.r = yarn.r;
  cell.g = yarn.g;
  cell.b = yarn.b;
  cell.hex = yarn.hex;
  cell.name = yarn.name;
}

export function applyYarnToGrid() {
  invalidateColorPreviewCache();
  for (const row of state.countGrid) {
    for (const cell of row) syncCellFromYarn(cell);
  }
}

function applyYarnToSource(sourceHex) {
  invalidateColorPreviewCache();
  const yarnId = state.sourceToYarn.get(sourceHex);
  const yarn = state.yarnColors.get(yarnId);
  if (!yarn) return;
  for (const row of state.countGrid) {
    for (const cell of row) {
      if (cell?.sourceHex !== sourceHex) continue;
      cell.yarnId = yarn.id;
      cell.r = yarn.r;
      cell.g = yarn.g;
      cell.b = yarn.b;
      cell.hex = yarn.hex;
      cell.name = yarn.name;
    }
  }
}

let colorPreviewRaf = 0;

/** Offscreen cols×rows bitmap of yarn colors — scaled with one drawImage on zoom. */
let previewCacheCanvas = null;
let previewCacheVersion = -1;
let previewCacheEpoch = 0;

export function invalidateColorPreviewCache() {
  previewCacheEpoch++;
}

function ensureColorPreviewCache() {
  const { cols, rows } = state.countMetrics;
  if (
    previewCacheCanvas &&
    previewCacheVersion === previewCacheEpoch &&
    previewCacheCanvas.width === cols &&
    previewCacheCanvas.height === rows
  ) {
    return previewCacheCanvas;
  }

  if (!previewCacheCanvas) previewCacheCanvas = document.createElement('canvas');
  previewCacheCanvas.width = cols;
  previewCacheCanvas.height = rows;
  const ctx = previewCacheCanvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.createImageData(cols, rows);
  const data = imageData.data;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cell = state.countGrid[row]?.[col];
      const i = (row * cols + col) * 4;
      if (cell) {
        data[i] = cell.r;
        data[i + 1] = cell.g;
        data[i + 2] = cell.b;
        data[i + 3] = 255;
      } else {
        data[i + 3] = 0;
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
  previewCacheVersion = previewCacheEpoch;
  return previewCacheCanvas;
}

function renderColorPreviewOnly() {
  if (!state.countGrid.length || !state.countMetrics) return;
  drawColorPreview();
  if (state.highlightedSourceHex) drawColorHighlight(state.highlightedSourceHex);
}

function scheduleColorPreviewRender() {
  if (colorPreviewRaf) return;
  colorPreviewRaf = requestAnimationFrame(() => {
    colorPreviewRaf = 0;
    renderColorPreviewOnly();
  });
}

function cancelColorPreviewRender() {
  if (!colorPreviewRaf) return;
  cancelAnimationFrame(colorPreviewRaf);
  colorPreviewRaf = 0;
}

function previewSourceColor(sourceHex, hex, item) {
  const { r, g, b } = hexToRgb(hex);
  const yarnId = state.sourceToYarn.get(sourceHex);
  const yarn = state.yarnColors.get(yarnId);
  if (!yarn) return;
  yarn.r = r;
  yarn.g = g;
  yarn.b = b;
  yarn.hex = rgbToHex(r, g, b);
  applyYarnToSource(sourceHex);
  if (item) syncPaletteItemColor(item, yarn.hex);
  scheduleColorPreviewRender();
}

function initPaletteFromGrid() {
  state.yarnColors.clear();
  state.sourceToYarn.clear();

  const seen = new Map();
  for (const row of state.countGrid) {
    for (const cell of row) {
      if (!cell?.sourceHex) continue;
      if (!seen.has(cell.sourceHex)) {
        const yarn = createYarn(cell.r, cell.g, cell.b);
        state.sourceToYarn.set(cell.sourceHex, yarn.id);
        seen.set(cell.sourceHex, yarn.id);
      }
    }
  }
  applyYarnToGrid();
}

export function buildRawColorGrid() {
  if (!state.workingCanvas) return;

  invalidateColorPreviewCache();
  const { pw, ph, iw, ih, cols, rows } = getGridMetrics();
  const tol = parseInt(document.getElementById("tolerance").value, 10);
  state.pixelData = state.workingCtx.getImageData(0, 0, iw, ih);
  const data = state.pixelData.data;
  const palette = [];
  const grid = [];

  for (let row = 0; row < rows; row++) {
    grid[row] = [];
    for (let col = 0; col < cols; col++) {
      const color = averageCellColor(data, iw, ih, col, row, pw, ph);
      const snapped = snapColor(color.r, color.g, color.b, palette, tol);
      grid[row][col] = {
        r: snapped.r,
        g: snapped.g,
        b: snapped.b,
        hex: snapped.hex,
        sourceHex: snapped.hex,
        name: snapped.hex,
      };
    }
  }

  state.countGrid = grid;
  state.countMetrics = { pw, ph, cols, rows };
  initPaletteFromGrid();
}

function ensureUniqueYarnForSource(sourceHex) {
  const yarnId = state.sourceToYarn.get(sourceHex);
  const sources = sourcesForYarn(yarnId);
  if (sources.length <= 1) return state.yarnColors.get(yarnId);

  const old = state.yarnColors.get(yarnId);
  const yarn = createYarn(old.r, old.g, old.b, old.name);
  state.sourceToYarn.set(sourceHex, yarn.id);
  return yarn;
}

/** While > 0, native color picker is open — avoid rebuilding palette DOM. */
let colorPickerSessions = 0;

export function setSourceColor(sourceHex, hex, { refreshPalette = true } = {}) {
  cancelColorPreviewRender();
  const { r, g, b } = hexToRgb(hex);
  const yarn = ensureUniqueYarnForSource(sourceHex);
  yarn.r = r;
  yarn.g = g;
  yarn.b = b;
  yarn.hex = rgbToHex(r, g, b);
  applyYarnToGrid();
  if (refreshPalette) renderPaletteUI();
  renderWorkingCanvasDisplay();
  return yarn;
}

function syncPaletteItemColor(item, hex) {
  const swatch = item.querySelector(".palette-swatch");
  const hexSpan = item.querySelector(".palette-meta span");
  if (swatch) swatch.style.background = hex;
  if (hexSpan) {
    hexSpan.style.color = hex;
    hexSpan.textContent = hex;
  }
}

export function setSourceName(sourceHex, name) {
  const yarnId = state.sourceToYarn.get(sourceHex);
  const yarn = state.yarnColors.get(yarnId);
  if (!yarn) return;
  yarn.name = name.trim() || yarn.hex;
  applyYarnToGrid();
}

function mergeSourceIntoInternal(sourceHex, targetSourceHex) {
  if (!targetSourceHex || sourceHex === targetSourceHex) return false;
  if (!state.sourceToYarn.has(targetSourceHex)) return false;
  if (!state.sourceToYarn.has(sourceHex)) return false;

  for (const row of state.countGrid) {
    for (const cell of row) {
      if (cell?.sourceHex === sourceHex) cell.sourceHex = targetSourceHex;
    }
  }

  state.sourceToYarn.delete(sourceHex);
  pruneOrphanYarns();
  applyYarnToGrid();
  if (state.highlightedSourceHex === sourceHex) {
    state.highlightedSourceHex = targetSourceHex;
  }
  return true;
}

export function mergeSourceInto(sourceHex, targetSourceHex) {
  if (!mergeSourceIntoInternal(sourceHex, targetSourceHex)) return;
  renderPaletteUI();
  renderWorkingCanvasDisplay();
  if (state.highlightedSourceHex) {
    setHighlightedSource(state.highlightedSourceHex);
  }
}

function yarnColorDistanceSq(yarnA, yarnB) {
  const dr = yarnA.r - yarnB.r;
  const dg = yarnA.g - yarnB.g;
  const db = yarnA.b - yarnB.b;
  return dr * dr + dg * dg + db * db;
}

function getPaletteEntries() {
  return [...state.sourceToYarn.keys()]
    .map((sourceHex) => {
      const yarnId = state.sourceToYarn.get(sourceHex);
      const yarn = state.yarnColors.get(yarnId);
      return { sourceHex, yarn, count: countCellsForSource(sourceHex) };
    })
    .filter((e) => e.yarn && e.count > 0);
}

function findClosestPalettePair(entries) {
  let best = null;
  let bestDist = Infinity;
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const dist = yarnColorDistanceSq(entries[i].yarn, entries[j].yarn);
      if (dist < bestDist) {
        bestDist = dist;
        best = [entries[i], entries[j]];
      }
    }
  }
  return best;
}

export function collapsePaletteTo(targetCount) {
  if (!state.countGrid.length) return;
  const goal = Math.max(2, Math.floor(targetCount));
  let entries = getPaletteEntries();
  if (entries.length <= goal) return;

  while (entries.length > goal) {
    const pair = findClosestPalettePair(entries);
    if (!pair) break;
    const [a, b] = pair;
    const source = a.count <= b.count ? a : b;
    const target = a.count <= b.count ? b : a;
    mergeSourceIntoInternal(source.sourceHex, target.sourceHex);
    entries = getPaletteEntries();
  }

  renderPaletteUI();
  renderWorkingCanvasDisplay();
  if (state.highlightedSourceHex) {
    setHighlightedSource(state.highlightedSourceHex);
  }
}

function updateCollapseControls(colorCount) {
  const row = document.getElementById("palette-collapse-row");
  const input = document.getElementById("palette-target-count");
  if (!row || !input) return;
  if (colorCount <= 2) {
    row.hidden = true;
    return;
  }
  row.hidden = false;
  input.max = String(colorCount - 1);
  input.min = "2";
  const current = parseInt(input.value, 10);
  if (!Number.isFinite(current) || current >= colorCount || current < 2) {
    input.value = String(Math.max(2, colorCount - 1));
  }
}

export function collapsePaletteColors() {
  const input = document.getElementById("palette-target-count");
  const target = parseInt(input?.value, 10);
  const count = parseInt(dom.paletteCount?.textContent || "0", 10);
  if (!Number.isFinite(target) || target < 2) {
    alert("Enter a target of at least 2 colors.");
    return;
  }
  if (target >= count) {
    alert(`You already have ${count} colors. Choose a number below ${count}.`);
    return;
  }
  collapsePaletteTo(target);
}

export function resetColorCorrections() {
  initPaletteFromGrid();
  state.highlightedSourceHex = null;
  renderPaletteUI();
  renderWorkingCanvasDisplay();
}

export function setHighlightedSource(sourceHex) {
  state.highlightedSourceHex = sourceHex;
  document.querySelectorAll(".palette-item").forEach((el) => {
    el.classList.toggle("is-hover", el.dataset.sourceHex === sourceHex);
  });
  drawColorHighlight(sourceHex);
}

export function clearHighlight() {
  state.highlightedSourceHex = null;
  document
    .querySelectorAll(".palette-item")
    .forEach((el) => el.classList.remove("is-hover"));
  highlightCtx.clearRect(
    0,
    0,
    dom.highlightCanvas.width,
    dom.highlightCanvas.height,
  );
}

export function drawColorPreview() {
  if (!state.countGrid.length || !state.countMetrics || !state.workingCanvas) return;

  const { pw, ph, cols, rows } = state.countMetrics;
  const iw = state.workingCanvas.width;
  const ih = state.workingCanvas.height;
  const dw = dom.mainCanvas.width;
  const dh = dom.mainCanvas.height;
  const scaleX = dw / iw;
  const scaleY = dh / ih;
  // Match grid overlay geometry: cells cover cols*pw × rows*ph in image space,
  // not a uniform stretch across the full display (leftover pixels caused drift).
  const destW = Math.max(1, Math.round(cols * pw * scaleX));
  const destH = Math.max(1, Math.round(rows * ph * scaleY));
  const cache = ensureColorPreviewCache();

  mainCtx.imageSmoothingEnabled = false;
  mainCtx.clearRect(0, 0, dw, dh);
  mainCtx.drawImage(cache, 0, 0, cols, rows, 0, 0, destW, destH);
}

function getCellDisplayRect(col, row, pw, ph, cols, rows, dw, dh, scaleX, scaleY) {
  const contentW = Math.round(cols * pw * scaleX);
  const contentH = Math.round(rows * ph * scaleY);
  const x0 = Math.round(col * pw * scaleX);
  const y0 = Math.round(row * ph * scaleY);
  const x1 = col === cols - 1 ? contentW : Math.round((col + 1) * pw * scaleX);
  const y1 = row === rows - 1 ? contentH : Math.round((row + 1) * ph * scaleY);
  return { x0, y0, x1, y1 };
}

export function drawColorHighlight(sourceHex) {
  highlightCtx.clearRect(
    0,
    0,
    dom.highlightCanvas.width,
    dom.highlightCanvas.height,
  );
  if (!sourceHex || !state.countMetrics || !state.workingCanvas) return;

  const { pw, ph, cols, rows } = state.countMetrics;
  const iw = state.workingCanvas.width;
  const ih = state.workingCanvas.height;
  const dw = dom.highlightCanvas.width;
  const dh = dom.highlightCanvas.height;
  const scaleX = dw / iw;
  const scaleY = dh / ih;

  const matches = (row, col) => {
    if (row < 0 || row >= rows || col < 0 || col >= cols) return false;
    const cell = state.countGrid[row]?.[col];
    return cell?.sourceHex === sourceHex;
  };

  highlightCtx.fillStyle = "rgba(232, 255, 71, 0.22)";
  highlightCtx.strokeStyle = "rgba(232, 255, 71, 0.98)";
  highlightCtx.lineWidth = 2;
  highlightCtx.lineJoin = "miter";
  highlightCtx.beginPath();

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!matches(row, col)) continue;
      const { x0, y0, x1, y1 } = getCellDisplayRect(
        col,
        row,
        pw,
        ph,
        cols,
        rows,
        dw,
        dh,
        scaleX,
        scaleY,
      );
      highlightCtx.fillRect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));

      if (!matches(row - 1, col)) {
        highlightCtx.moveTo(x0, y0);
        highlightCtx.lineTo(x1, y0);
      }
      if (!matches(row + 1, col)) {
        highlightCtx.moveTo(x0, y1);
        highlightCtx.lineTo(x1, y1);
      }
      if (!matches(row, col - 1)) {
        highlightCtx.moveTo(x0, y0);
        highlightCtx.lineTo(x0, y1);
      }
      if (!matches(row, col + 1)) {
        highlightCtx.moveTo(x1, y0);
        highlightCtx.lineTo(x1, y1);
      }
    }
  }

  highlightCtx.stroke();
}

function mergeDisplayLabel(yarn) {
  const hasName = yarn.name && yarn.name !== yarn.hex;
  return hasName ? yarn.name : yarn.hex;
}

function updateMergeLabelsForSource(sourceHex) {
  const yarnId = state.sourceToYarn.get(sourceHex);
  const yarn = state.yarnColors.get(yarnId);
  if (!yarn) return;
  const label = mergeDisplayLabel(yarn);
  document
    .querySelectorAll(
      `.palette-merge-option[data-source-hex="${CSS.escape(sourceHex)}"] .palette-merge-label`,
    )
    .forEach((el) => {
      el.textContent = label;
    });
}

function populateMergeMenu(menu, entries, sourceHex, onSelect) {
  menu.replaceChildren();
  for (const entry of entries) {
    if (entry.sourceHex === sourceHex) continue;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "palette-merge-option";
    btn.dataset.sourceHex = entry.sourceHex;

    const swatch = document.createElement("span");
    swatch.className = "palette-merge-swatch";
    swatch.style.background = entry.yarn.hex;

    const label = document.createElement("span");
    label.className = "palette-merge-label";
    label.textContent = mergeDisplayLabel(entry.yarn);

    const count = document.createElement("span");
    count.className = "palette-merge-count";
    count.textContent = `(${entry.count})`;

    btn.append(swatch, label, count);
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      onSelect(entry.sourceHex);
    });
    menu.appendChild(btn);
  }
}

function closeAllMergeMenus() {
  document
    .querySelectorAll(".palette-merge-menu")
    .forEach((menu) => {
      menu.hidden = true;
    });
}

let mergeMenuCloseBound = false;
function ensureMergeMenuCloseListener() {
  if (mergeMenuCloseBound) return;
  mergeMenuCloseBound = true;
  document.addEventListener("click", closeAllMergeMenus);
}

export function renderPaletteUI() {
  if (!dom.paletteList) return;

  const entries = [...state.sourceToYarn.keys()]
    .map((sourceHex) => {
      const yarnId = state.sourceToYarn.get(sourceHex);
      const yarn = state.yarnColors.get(yarnId);
      return { sourceHex, yarn, count: countCellsForSource(sourceHex) };
    })
    .filter((e) => e.yarn && e.count > 0)
    .sort((a, b) => b.count - a.count);

  dom.paletteCount.textContent = String(entries.length);
  dom.paletteList.innerHTML = "";
  ensureMergeMenuCloseListener();

  for (const entry of entries) {
    const { sourceHex, yarn, count } = entry;
    const item = document.createElement("div");
    item.className = "palette-item";
    item.dataset.sourceHex = sourceHex;

    item.innerHTML = `
      <div class="palette-item-top">
        <span class="palette-swatch" style="background:${yarn.hex}" title="Hover to highlight"></span>
        <div class="palette-meta">
          <strong>${sourceHex}</strong><br>
          ${count} cell${count === 1 ? "" : "s"} · now <span style="color:${yarn.hex}">${yarn.hex}</span>
        </div>
      </div>
      <input class="palette-name" type="text" placeholder="Yarn name (e.g. pink)" value="${yarn.name === yarn.hex ? "" : yarn.name}">
      <div class="palette-actions">
        <input type="color" class="palette-picker" value="${yarn.hex}" title="Replace with this color">
        <div class="palette-merge">
          <button type="button" class="palette-merge-trigger">Merge into…</button>
          <div class="palette-merge-menu" hidden></div>
        </div>
      </div>
    `;

    const swatch = item.querySelector(".palette-swatch");
    const nameInput = item.querySelector(".palette-name");
    const picker = item.querySelector(".palette-picker");
    const mergeTrigger = item.querySelector(".palette-merge-trigger");
    const mergeMenu = item.querySelector(".palette-merge-menu");

    swatch.addEventListener("mouseenter", () =>
      setHighlightedSource(sourceHex),
    );
    item.addEventListener("mouseenter", () => setHighlightedSource(sourceHex));
    item.addEventListener("mouseleave", (e) => {
      if (colorPickerSessions > 0) return;
      if (e.relatedTarget && item.contains(e.relatedTarget)) return;
      clearHighlight();
    });

    nameInput.addEventListener("input", () => {
      setSourceName(sourceHex, nameInput.value);
      updateMergeLabelsForSource(sourceHex);
    });

    const endPickerSession = () => {
      colorPickerSessions = Math.max(0, colorPickerSessions - 1);
    };
    picker.addEventListener("pointerdown", () => {
      colorPickerSessions++;
      setHighlightedSource(sourceHex);
    });
    picker.addEventListener("input", () => {
      previewSourceColor(sourceHex, picker.value, item);
    });
    picker.addEventListener("change", () => {
      setSourceColor(sourceHex, picker.value);
      endPickerSession();
    });
    picker.addEventListener("blur", endPickerSession);
    populateMergeMenu(mergeMenu, entries, sourceHex, (targetSourceHex) => {
      closeAllMergeMenus();
      mergeSourceInto(sourceHex, targetSourceHex);
    });
    mergeTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const willOpen = mergeMenu.hidden;
      closeAllMergeMenus();
      mergeMenu.hidden = !willOpen;
    });
    mergeMenu.addEventListener("click", (e) => e.stopPropagation());

    dom.paletteList.appendChild(item);
  }

  updateCollapseControls(entries.length);
}

export function enterColorCorrection() {
  if (trimWorkingCanvasToGrid()) {
    resetZoomBakeCache();
    updateBaseDisplayScale();
  }
  buildRawColorGrid();
  renderPaletteUI();
}
