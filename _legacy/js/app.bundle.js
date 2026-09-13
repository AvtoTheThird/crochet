(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) =>
    function __init() {
      return (fn && (res = (0, fn[__getOwnPropNames(fn)[0]])((fn = 0))), res);
    };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // js/state.js
  var state, STEP_COUNT;
  var init_state = __esm({
    "js/state.js"() {
      state = {
        originalImg: null,
        workingCanvas: null,
        workingCtx: null,
        baseDisplayScale: 1,
        displayScale: 1,
        zoomLevel: 1,
        currentStep: 1,
        showCountOverlay: true,
        startDirection: "ltr",
        cropRect: { x: 0, y: 0, w: 0, h: 0 },
        pixelData: null,
        countResults: [],
        countGrid: [],
        countMetrics: null,
        /** @type {Map<string, {id:string,r:number,g:number,b:number,hex:string,name:string}>} */
        yarnColors: /* @__PURE__ */ new Map(),
        /** source hex -> yarn id */
        sourceToYarn: /* @__PURE__ */ new Map(),
        highlightedSourceHex: null,
        viewPanning: null,
        cropDragging: null,
        patternWalk: {
          steps: [],
          currentIndex: 0,
          sidebarOpen: true,
          options: {
            highlightRow: true,
            enlargeSegment: true,
            dimOtherRows: true,
            showGrid: true,
            showCountNumbers: false,
          },
        },
        projectId: null,
        projectName: null,
        loadedFileName: null,
      };
      STEP_COUNT = 6;
    },
  });

  // js/dom.js
  var dom, mainCtx, gridCtx, countCtx, highlightCtx;
  var init_dom = __esm({
    "js/dom.js"() {
      dom = {
        mainCanvas: document.getElementById("main-canvas"),
        gridCanvas: document.getElementById("grid-canvas"),
        countCanvas: document.getElementById("count-canvas"),
        highlightCanvas: document.getElementById("highlight-canvas"),
        wrapper: document.getElementById("canvas-wrapper"),
        dropZone: document.getElementById("drop-zone"),
        cropOverlay: document.getElementById("crop-overlay"),
        cropBox: document.getElementById("crop-box"),
        zoomInfo: document.getElementById("zoom-info"),
        canvasArea: document.getElementById("canvas-area"),
        paletteList: document.getElementById("palette-list"),
        paletteCount: document.getElementById("palette-count"),
      };
      mainCtx = dom.mainCanvas.getContext("2d", { willReadFrequently: true });
      gridCtx = dom.gridCanvas.getContext("2d");
      countCtx = dom.countCanvas.getContext("2d");
      highlightCtx = dom.highlightCanvas.getContext("2d");
    },
  });

  // js/utils.js
  function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
  }
  function hexToRgb(hex) {
    const h = hex.replace("#", "");
    const full =
      h.length === 3
        ? h
            .split("")
            .map((c) => c + c)
            .join("")
        : h;
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
    };
  }
  function colorsMatch(r1, g1, b1, r2, g2, b2, tol) {
    return (
      Math.abs(r1 - r2) <= tol &&
      Math.abs(g1 - g2) <= tol &&
      Math.abs(b1 - b2) <= tol
    );
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  function readPositiveNumber(id, fallback) {
    const n = parseFloat(document.getElementById(id).value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }
  function formatGridNumber(n) {
    return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/\.?0+$/, "");
  }
  function getColorLabel(color) {
    if (!color) return "";
    const name = (color.name || "").trim();
    return name || color.hex;
  }
  function nextId(prefix = "yarn") {
    return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
  }
  var init_utils = __esm({
    "js/utils.js"() {},
  });

  // js/grid.js
  function getGridMetrics() {
    const pw = readPositiveNumber("px-w", 8);
    const ph = readPositiveNumber("px-h", 8);
    const iw = state.workingCanvas.width;
    const ih = state.workingCanvas.height;
    const cols = Math.max(1, Math.floor((iw + 1e-6) / pw));
    const rows = Math.max(1, Math.floor((ih + 1e-6) / ph));
    return { pw, ph, iw, ih, cols, rows };
  }
  function syncPixelCountFromCellSize() {
    if (!state.workingCanvas) return;
    const { cols, rows } = getGridMetrics();
    document.getElementById("grid-cols-input").value = cols;
    document.getElementById("grid-rows-input").value = rows;
  }
  function syncCellSizeFromPixelCount() {
    if (!state.workingCanvas) return;
    const cols = parseInt(document.getElementById("grid-cols-input").value, 10);
    const rows = parseInt(document.getElementById("grid-rows-input").value, 10);
    if (Number.isFinite(cols) && cols > 0) {
      const clampedCols = Math.min(cols, state.workingCanvas.width);
      document.getElementById("grid-cols-input").value = clampedCols;
      document.getElementById("px-w").value = formatGridNumber(
        state.workingCanvas.width / clampedCols,
      );
    }
    if (Number.isFinite(rows) && rows > 0) {
      const clampedRows = Math.min(rows, state.workingCanvas.height);
      document.getElementById("grid-rows-input").value = clampedRows;
      document.getElementById("px-h").value = formatGridNumber(
        state.workingCanvas.height / clampedRows,
      );
    }
  }
  function drawGrid(opacityOverride) {
    if (!state.workingCanvas) return;
    const { pw, ph, iw, ih } = getGridMetrics();
    const dw = dom.mainCanvas.width;
    const dh = dom.mainCanvas.height;
    const op =
      opacityOverride !== void 0
        ? opacityOverride
        : parseInt(document.getElementById("grid-opacity").value, 10) / 100;
    gridCtx.clearRect(0, 0, dw, dh);
    gridCtx.strokeStyle = `rgba(232,255,71,${op})`;
    gridCtx.lineWidth = 1;
    const scaleX = dw / iw;
    const scaleY = dh / ih;
    for (let x = 0; x <= iw + 1e-6; x += pw) {
      const dx = Math.round(x * scaleX) + 0.5;
      gridCtx.beginPath();
      gridCtx.moveTo(dx, 0);
      gridCtx.lineTo(dx, dh);
      gridCtx.stroke();
    }
    for (let y = 0; y <= ih + 1e-6; y += ph) {
      const dy = Math.round(y * scaleY) + 0.5;
      gridCtx.beginPath();
      gridCtx.moveTo(0, dy);
      gridCtx.lineTo(dw, dy);
      gridCtx.stroke();
    }
  }
  function snapColor(r, g, b, palette, tol) {
    for (const c of palette) {
      if (colorsMatch(r, g, b, c.r, c.g, c.b, tol)) return c;
    }
    const nc = { r, g, b, hex: rgbToHex(r, g, b) };
    palette.push(nc);
    return nc;
  }
  function averageCellColor(data, iw, ih, col, row, pw, ph) {
    const x0 = Math.max(0, Math.min(iw - 1, Math.round(col * pw)));
    const y0 = Math.max(0, Math.min(ih - 1, Math.round(row * ph)));
    const x1 = Math.max(x0 + 1, Math.min(iw, Math.round((col + 1) * pw)));
    const y1 = Math.max(y0 + 1, Math.min(ih, Math.round((row + 1) * ph)));
    let r = 0,
      g = 0,
      b = 0,
      count = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const idx = (y * iw + x) * 4;
        r += data[idx];
        g += data[idx + 1];
        b += data[idx + 2];
        count++;
      }
    }
    return {
      r: Math.round(r / count),
      g: Math.round(g / count),
      b: Math.round(b / count),
    };
  }
  function setStartDirection(direction) {
    state.startDirection = direction === "rtl" ? "rtl" : "ltr";
    document
      .getElementById("start-ltr")
      .classList.toggle("active", state.startDirection === "ltr");
    document
      .getElementById("start-rtl")
      .classList.toggle("active", state.startDirection === "rtl");
  }
  var init_grid = __esm({
    "js/grid.js"() {
      init_state();
      init_dom();
      init_utils();
    },
  });

  // js/color-correction.js
  var color_correction_exports = {};
  __export(color_correction_exports, {
    applyYarnToGrid: () => applyYarnToGrid,
    buildRawColorGrid: () => buildRawColorGrid,
    clearHighlight: () => clearHighlight,
    drawColorHighlight: () => drawColorHighlight,
    drawColorPreview: () => drawColorPreview,
    enterColorCorrection: () => enterColorCorrection,
    collapsePaletteColors: () => collapsePaletteColors,
    collapsePaletteTo: () => collapsePaletteTo,
    mergeSourceInto: () => mergeSourceInto,
    renderPaletteUI: () => renderPaletteUI,
    resetColorCorrections: () => resetColorCorrections,
    setHighlightedSource: () => setHighlightedSource,
    setSourceColor: () => setSourceColor,
    setSourceName: () => setSourceName,
  });
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
  function applyYarnToGrid() {
    for (const row of state.countGrid) {
      for (const cell of row) syncCellFromYarn(cell);
    }
  }
  function applyYarnToSource(sourceHex) {
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
  var colorPreviewRaf = 0;
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
    const seen = /* @__PURE__ */ new Map();
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
  function buildRawColorGrid() {
    if (!state.workingCanvas) return;
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
  var colorPickerSessions = 0;
  function setSourceColor(sourceHex, hex, options = {}) {
    cancelColorPreviewRender();
    const refreshPalette = options.refreshPalette !== false;
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
  function setSourceName(sourceHex, name) {
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
  function mergeSourceInto(sourceHex, targetSourceHex) {
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
  function collapsePaletteTo(targetCount) {
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
  function collapsePaletteColors() {
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
  function resetColorCorrections() {
    initPaletteFromGrid();
    state.highlightedSourceHex = null;
    renderPaletteUI();
    renderWorkingCanvasDisplay();
  }
  function setHighlightedSource(sourceHex) {
    state.highlightedSourceHex = sourceHex;
    document.querySelectorAll(".palette-item").forEach((el) => {
      el.classList.toggle("is-hover", el.dataset.sourceHex === sourceHex);
    });
    drawColorHighlight(sourceHex);
  }
  function clearHighlight() {
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
  function drawColorPreview() {
    if (!state.countGrid.length || !state.countMetrics || !state.workingCanvas)
      return;
    const { pw, ph, cols, rows } = state.countMetrics;
    const iw = state.workingCanvas.width;
    const ih = state.workingCanvas.height;
    const dw = dom.mainCanvas.width;
    const dh = dom.mainCanvas.height;
    const scaleX = dw / iw;
    const scaleY = dh / ih;
    mainCtx.imageSmoothingEnabled = false;
    mainCtx.clearRect(0, 0, dw, dh);
    mainCtx.drawImage(state.workingCanvas, 0, 0, iw, ih, 0, 0, dw, dh);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cell = state.countGrid[row]?.[col];
        if (!cell) continue;
        const x0 = Math.round(col * pw * scaleX);
        const y0 = Math.round(row * ph * scaleY);
        const x1 = col === cols - 1 ? dw : Math.round((col + 1) * pw * scaleX);
        const y1 = row === rows - 1 ? dh : Math.round((row + 1) * ph * scaleY);
        mainCtx.fillStyle = cell.hex;
        mainCtx.fillRect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
      }
    }
  }
  function getCellDisplayRect(col, row, pw, ph, cols, rows, dw, dh, scaleX, scaleY) {
    const x0 = Math.round(col * pw * scaleX);
    const y0 = Math.round(row * ph * scaleY);
    const x1 = col === cols - 1 ? dw : Math.round((col + 1) * pw * scaleX);
    const y1 = row === rows - 1 ? dh : Math.round((row + 1) * ph * scaleY);
    return { x0, y0, x1, y1 };
  }
  function drawColorHighlight(sourceHex) {
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
    document.querySelectorAll(
      `.palette-merge-option[data-source-hex="${CSS.escape(sourceHex)}"] .palette-merge-label`,
    ).forEach((el) => {
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
    document.querySelectorAll(".palette-merge-menu").forEach((menu) => {
      menu.hidden = true;
    });
  }
  var mergeMenuCloseBound = false;
  function ensureMergeMenuCloseListener() {
    if (mergeMenuCloseBound) return;
    mergeMenuCloseBound = true;
    document.addEventListener("click", closeAllMergeMenus);
  }
  function renderPaletteUI() {
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
          ${count} cell${count === 1 ? "" : "s"} \xB7 now <span style="color:${yarn.hex}">${yarn.hex}</span>
        </div>
      </div>
      <input class="palette-name" type="text" placeholder="Yarn name (e.g. pink)" value="${yarn.name === yarn.hex ? "" : yarn.name}">
      <div class="palette-actions">
        <input type="color" class="palette-picker" value="${yarn.hex}" title="Replace with this color">
        <div class="palette-merge">
          <button type="button" class="palette-merge-trigger">Merge into\u2026</button>
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
      item.addEventListener("mouseenter", () =>
        setHighlightedSource(sourceHex),
      );
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
  function enterColorCorrection() {
    buildRawColorGrid();
    renderPaletteUI();
  }
  var init_color_correction = __esm({
    "js/color-correction.js"() {
      init_state();
      init_dom();
      init_utils();
      init_grid();
      init_viewport();
    },
  });

  // js/results.js
  function renderResults() {
    if (!state.countResults.length) return;
    const list = document.getElementById("result-list");
    list.innerHTML = "";
    let totalSegs = 0;
    let csvLines = ["Row,Direction,Color,Name,Count"];
    let rows = 0;
    let cols = 0;
    for (const r of state.countResults) {
      rows = Math.max(rows, r.logRow + 1);
      cols = r.cols;
      totalSegs += r.segments.length;
      const div = document.createElement("div");
      div.className = "result-row";
      const segsHtml = r.segments
        .map((s) => {
          const label = getColorLabel(s.color);
          return `<span class="seg-chip" title="${s.color.hex}"><span class="swatch" style="background:${s.color.hex}"></span>${label}\xD7${s.count}</span>`;
        })
        .join("");
      div.innerHTML = `
      <span class="line-num">${r.logRow + 1}</span>
      <span class="dir">${r.dir}</span>
      <span class="segs">${segsHtml}</span>
    `;
      list.appendChild(div);
      for (const s of r.segments) {
        const name = getColorLabel(s.color);
        csvLines.push(
          `${r.logRow + 1},${r.dir},${s.color.hex},${name},${s.count}`,
        );
      }
    }
    document.getElementById("res-cols").textContent = cols;
    document.getElementById("res-rows").textContent = rows;
    document.getElementById("res-segs").textContent = totalSegs;
    document.getElementById("export-csv").value = csvLines.join("\n");
  }
  function copyCSV() {
    const ta = document.getElementById("export-csv");
    ta.select();
    document.execCommand("copy");
    const btn = event.target;
    btn.textContent = "\u2713 Copied!";
    setTimeout(() => {
      btn.textContent = "\u{1F4CB} Copy CSV";
    }, 1500);
  }
  var init_results = __esm({
    "js/results.js"() {
      init_state();
      init_utils();
    },
  });

  // js/pattern-walk.js
  function buildWalkStepsFromCountResults() {
    const steps = [];
    if (!state.countResults.length) return steps;
    for (const rowResult of state.countResults) {
      const { imgRow, dir, segments, logRow, cols } = rowResult;
      const leftToRight = dir === "\u2192";
      let colCursor = leftToRight ? 0 : cols - 1;
      const stepDir = leftToRight ? 1 : -1;
      segments.forEach((segment, segIndex) => {
        const startCol = colCursor;
        const endCol = colCursor + stepDir * (segment.count - 1);
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
        colCursor = endCol + stepDir;
      });
    }
    return steps;
  }
  function getCurrentWalkStep() {
    const steps = state.patternWalk.steps;
    if (!steps.length) return null;
    const idx = Math.max(0, Math.min(state.patternWalk.currentIndex, steps.length - 1));
    state.patternWalk.currentIndex = idx;
    return steps[idx];
  }
  function drawPatternWalkOverlay() {
    highlightCtx.clearRect(0, 0, dom.highlightCanvas.width, dom.highlightCanvas.height);
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
    const rowY1 = step.imgRow === rows - 1 ? dh : Math.round((step.imgRow + 1) * ph * scaleY);
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
        const x1 = col === cols - 1 ? dw : Math.round((col + 1) * pw * scaleX);
        const y1 = step.imgRow === rows - 1 ? dh : Math.round((step.imgRow + 1) * ph * scaleY);
        const w = Math.max(1, x1 - x0);
        const h = Math.max(1, y1 - y0);
        highlightCtx.fillStyle = step.segment.color.hex || "#fff";
        highlightCtx.fillRect(x0 - pad, y0 - pad - lift, w + pad * 2, h + pad * 2);
        highlightCtx.strokeStyle = "rgba(255, 255, 255, 0.92)";
        highlightCtx.lineWidth = 2;
        highlightCtx.strokeRect(x0 - pad + 0.5, y0 - pad - lift + 0.5, w + pad * 2 - 1, h + pad * 2 - 1);
      }
    } else {
      highlightCtx.fillStyle = "rgba(232, 255, 71, 0.35)";
      for (let col = step.startCol; col <= step.endCol; col++) {
        const x0 = Math.round(col * pw * scaleX);
        const y0 = Math.round(step.imgRow * ph * scaleY);
        const x1 = col === cols - 1 ? dw : Math.round((col + 1) * pw * scaleX);
        const y1 = step.imgRow === rows - 1 ? dh : Math.round((step.imgRow + 1) * ph * scaleY);
        highlightCtx.fillRect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
      }
    }
  }
  function updatePatternWalkUI() {
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
    const progressText = `Stitch ${idx + 1} of ${total}`;
    const detailHTML = `<span class="walk-color-swatch" style="background:${step.segment.color.hex}"></span> <strong>${label}</strong> \xD7 ${step.segment.count}`;
    const rowText = `Row ${step.logRow + 1} (${step.dir}) \xB7 seg ${step.segIndex + 1}/${state.countResults[step.logRow]?.segments.length ?? "?"}`;
    progressEl.textContent = progressText;
    if (detailEl) detailEl.innerHTML = detailHTML;
    if (rowEl) {
      rowEl.textContent = `Row ${step.logRow + 1} (${step.dir}) \xB7 segment ${step.segIndex + 1} of ${state.countResults[step.logRow]?.segments.length ?? "?"}`;
    }
    if (topProgress) topProgress.textContent = progressText;
    if (topDetail) topDetail.innerHTML = detailHTML;
    if (topRowInfo) topRowInfo.textContent = rowText;
    if (prevBtn) prevBtn.disabled = idx <= 0;
    if (nextBtn) nextBtn.disabled = idx >= total - 1;
    if (floatPrev) floatPrev.disabled = idx <= 0;
    if (floatNext) floatNext.disabled = idx >= total - 1;
  }
  function refreshPatternWalkView() {
    updatePatternWalkUI();
    renderWorkingCanvasDisplay();
  }
  function patternWalkNext() {
    if (state.patternWalk.currentIndex < state.patternWalk.steps.length - 1) {
      state.patternWalk.currentIndex++;
      refreshPatternWalkView();
    }
  }
  function patternWalkPrev() {
    if (state.patternWalk.currentIndex > 0) {
      state.patternWalk.currentIndex--;
      refreshPatternWalkView();
    }
  }
  function setPatternWalkOption(key, value) {
    if (key in state.patternWalk.options) {
      state.patternWalk.options[key] = value;
      refreshPatternWalkView();
    }
  }
  function renderPatternWalkCanvases() {
    const opts = state.patternWalk.options;
    const { pw, ph, rows, cols } = state.countMetrics || {};
    if (opts.showGrid) drawGrid();
    if (opts.showCountNumbers && pw) drawCountOverlay(pw, ph, rows, cols);
    drawPatternWalkOverlay();
  }
  function onEnterPatternWalkStep() {
    if (!state.patternWalk.steps.length && state.countResults.length) {
      state.patternWalk.steps = buildWalkStepsFromCountResults();
    }
    updatePatternWalkUI();
  }
  function enterPatternWalk() {
    if (!state.countGrid.length || !state.countMetrics) return;
    if (!state.countResults.length) runLengthEncode();
    state.patternWalk.steps = buildWalkStepsFromCountResults();
    state.patternWalk.currentIndex = 0;
    goStep(6);
    autoSaveProject();
  }
  function initPatternWalkHandlers() {
    const bindToggle = (id, key) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.checked = state.patternWalk.options[key];
      el.addEventListener("change", () => setPatternWalkOption(key, el.checked));
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

  // js/steps.js
  var steps_exports = {};
  __export(steps_exports, {
    goStep: () => goStep,
  });
  function goStep(n) {
    if (n !== 4 && n !== 6) clearHighlight();
    state.currentStep = n;
    document.getElementById("main-layout").dataset.step = String(n);
    for (let i = 1; i <= STEP_COUNT; i++) {
      document.getElementById("step" + i).classList.toggle("active", i === n);
      document.getElementById("panel" + i).classList.toggle("active", i === n);
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
  var init_steps = __esm({
    "js/steps.js"() {
      init_state();
      init_grid();
      init_results();
      init_crop();
      init_color_correction();
      init_viewport();
    },
  });

  // js/crop.js
  var crop_exports = {};
  __export(crop_exports, {
    applyCrop: () => applyCrop,
    disableCrop: () => disableCrop,
    enableCrop: () => enableCrop,
    initCropHandlers: () => initCropHandlers,
    resetCrop: () => resetCrop,
    updateCropUI: () => updateCropUI,
  });
  function enableCrop() {
    dom.cropOverlay.style.display = "block";
    updateCropUI();
  }
  function disableCrop() {
    dom.cropOverlay.style.display = "none";
  }
  function updateCropUI() {
    if (!state.workingCanvas) return;
    const iw = state.workingCanvas.width;
    const ih = state.workingCanvas.height;
    const dw = dom.mainCanvas.width;
    const dh = dom.mainCanvas.height;
    const sx = (state.cropRect.x / iw) * dw;
    const sy = (state.cropRect.y / ih) * dh;
    const sw = (state.cropRect.w / iw) * dw;
    const sh = (state.cropRect.h / ih) * dh;
    dom.cropBox.style.left = sx + "px";
    dom.cropBox.style.top = sy + "px";
    dom.cropBox.style.width = sw + "px";
    dom.cropBox.style.height = sh + "px";
    document.getElementById("shade-top").style.cssText =
      `left:0;top:0;width:100%;height:${sy}px`;
    document.getElementById("shade-bottom").style.cssText =
      `left:0;top:${sy + sh}px;width:100%;height:${dh - sy - sh}px`;
    document.getElementById("shade-left").style.cssText =
      `left:0;top:${sy}px;width:${sx}px;height:${sh}px`;
    document.getElementById("shade-right").style.cssText =
      `left:${sx + sw}px;top:${sy}px;width:${dw - sx - sw}px;height:${sh}px`;
    document.getElementById("crop-x").textContent = Math.round(
      state.cropRect.x,
    );
    document.getElementById("crop-y").textContent = Math.round(
      state.cropRect.y,
    );
    document.getElementById("crop-w").textContent = Math.round(
      state.cropRect.w,
    );
    document.getElementById("crop-h").textContent = Math.round(
      state.cropRect.h,
    );
  }
  function resetCrop() {
    if (!state.workingCanvas) return;
    state.cropRect = {
      x: 0,
      y: 0,
      w: state.workingCanvas.width,
      h: state.workingCanvas.height,
    };
    updateCropUI();
  }
  function applyCrop() {
    if (!state.workingCanvas) return;
    const cx = Math.round(state.cropRect.x);
    const cy = Math.round(state.cropRect.y);
    const cw = Math.round(state.cropRect.w);
    const ch = Math.round(state.cropRect.h);
    initWorkingCanvas(state.workingCanvas, cx, cy, cw, ch);
    state.cropRect = { x: 0, y: 0, w: cw, h: ch };
    Promise.resolve()
      .then(() => (init_steps(), steps_exports))
      .then(({ goStep: goStep2 }) => goStep2(3))
      .then(() => autoSaveProject());
  }
  function initCropHandlers() {
    dom.canvasArea.addEventListener("mousedown", (e) => {
      if (!state.workingCanvas || dom.wrapper.style.display === "none") return;
      if (e.button !== 0) return;
      if (e.target.closest("#crop-box")) return;
      state.viewPanning = {
        startX: e.clientX,
        startY: e.clientY,
        scrollLeft: dom.canvasArea.scrollLeft,
        scrollTop: dom.canvasArea.scrollTop,
      };
      dom.canvasArea.classList.add("panning");
      e.preventDefault();
    });
    dom.canvasArea.addEventListener(
      "wheel",
      (e) => {
        if (!state.workingCanvas || dom.wrapper.style.display === "none")
          return;
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        const nextZoom = Math.max(0.25, Math.min(8, state.zoomLevel * factor));
        Promise.resolve()
          .then(() => (init_viewport(), viewport_exports))
          .then(({ setGridZoom: setGridZoom2 }) =>
            setGridZoom2(Math.round(nextZoom * 100), e.clientX, e.clientY),
          );
      },
      { passive: false },
    );
    dom.cropBox.addEventListener("mousedown", (e) => {
      if (e.target.dataset.handle) {
        state.cropDragging = {
          type: e.target.dataset.handle,
          startX: e.clientX,
          startY: e.clientY,
          origRect: { ...state.cropRect },
        };
      } else {
        state.cropDragging = {
          type: "move",
          startX: e.clientX,
          startY: e.clientY,
          origRect: { ...state.cropRect },
        };
      }
      e.stopPropagation();
      e.preventDefault();
    });
    document.addEventListener("mousemove", (e) => {
      if (state.viewPanning) {
        dom.canvasArea.scrollLeft =
          state.viewPanning.scrollLeft - (e.clientX - state.viewPanning.startX);
        dom.canvasArea.scrollTop =
          state.viewPanning.scrollTop - (e.clientY - state.viewPanning.startY);
        return;
      }
      if (!state.cropDragging || !state.workingCanvas) return;
      const iw = state.workingCanvas.width;
      const ih = state.workingCanvas.height;
      const dw = dom.mainCanvas.width;
      const dh = dom.mainCanvas.height;
      const dx = ((e.clientX - state.cropDragging.startX) / dw) * iw;
      const dy = ((e.clientY - state.cropDragging.startY) / dh) * ih;
      const o = state.cropDragging.origRect;
      const MIN = 4;
      let r = { ...o };
      if (state.cropDragging.type === "move") {
        r.x = Math.max(0, Math.min(iw - r.w, o.x + dx));
        r.y = Math.max(0, Math.min(ih - r.h, o.y + dy));
      } else if (state.cropDragging.type === "tl") {
        r.x = Math.max(0, Math.min(o.x + o.w - MIN, o.x + dx));
        r.y = Math.max(0, Math.min(o.y + o.h - MIN, o.y + dy));
        r.w = o.x + o.w - r.x;
        r.h = o.y + o.h - r.y;
      } else if (state.cropDragging.type === "tr") {
        r.y = Math.max(0, Math.min(o.y + o.h - MIN, o.y + dy));
        r.w = Math.max(MIN, Math.min(iw - o.x, o.w + dx));
        r.h = o.y + o.h - r.y;
      } else if (state.cropDragging.type === "bl") {
        r.x = Math.max(0, Math.min(o.x + o.w - MIN, o.x + dx));
        r.w = o.x + o.w - r.x;
        r.h = Math.max(MIN, Math.min(ih - o.y, o.h + dy));
      } else if (state.cropDragging.type === "br") {
        r.w = Math.max(MIN, Math.min(iw - o.x, o.w + dx));
        r.h = Math.max(MIN, Math.min(ih - o.y, o.h + dy));
      }
      state.cropRect = r;
      updateCropUI();
    });
    document.addEventListener("mouseup", () => {
      state.viewPanning = null;
      dom.canvasArea.classList.remove("panning");
      state.cropDragging = null;
    });

    // --- Two-finger pinch-to-zoom ---
    var _pinch = null;
    dom.canvasArea.addEventListener("touchstart", function (e) {
      if (!state.workingCanvas || dom.wrapper.style.display === "none") return;
      if (e.touches.length === 2) {
        e.preventDefault();
        var t0 = e.touches[0], t1 = e.touches[1];
        _pinch = {
          dist: Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY),
          zoom: state.zoomLevel,
        };
      }
    }, { passive: false });

    dom.canvasArea.addEventListener("touchmove", function (e) {
      if (!state.workingCanvas || dom.wrapper.style.display === "none") return;
      if (e.touches.length === 2 && _pinch) {
        e.preventDefault();
        var t0 = e.touches[0], t1 = e.touches[1];
        var dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
        var newZoom = Math.max(0.25, Math.min(8, _pinch.zoom * (dist / _pinch.dist)));
        var midX = (t0.clientX + t1.clientX) / 2;
        var midY = (t0.clientY + t1.clientY) / 2;
        Promise.resolve()
          .then(function () { return (init_viewport(), viewport_exports); })
          .then(function (vp) { vp.setGridZoom(Math.round(newZoom * 100), midX, midY); });
      }
    }, { passive: false });

    dom.canvasArea.addEventListener("touchend", function (e) {
      if (e.touches.length < 2) _pinch = null;
    }, { passive: true });
  }
  var init_crop = __esm({
    "js/crop.js"() {
      init_state();
      init_dom();
      init_image();
    },
  });

  // js/count.js
  var count_exports = {};
  __export(count_exports, {
    drawCountOverlay: () => drawCountOverlay,
    goCount: () => goCount,
    runLengthEncode: () => runLengthEncode,
    toggleCountOverlay: () => toggleCountOverlay,
  });
  function runLengthEncode() {
    const { cols, rows } = state.countMetrics;
    state.countResults = [];
    const startLeftToRight = state.startDirection === "ltr";
    for (let logRow = 0; logRow < rows; logRow++) {
      const imgRow = rows - 1 - logRow;
      const rowData = state.countGrid[imgRow];
      const leftToRight =
        logRow % 2 === 0 ? startLeftToRight : !startLeftToRight;
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
        dir: leftToRight ? "\u2192" : "\u2190",
        segments,
        cols,
      });
    }
  }
  function drawCountOverlay(pw, ph, rows, cols) {
    const iw = state.workingCanvas.width;
    const ih = state.workingCanvas.height;
    const dw = dom.mainCanvas.width;
    const dh = dom.mainCanvas.height;
    const scaleX = dw / iw;
    const scaleY = dh / ih;
    countCtx.clearRect(0, 0, dw, dh);
    for (const rowResult of state.countResults) {
      const { imgRow, dir, segments } = rowResult;
      const leftToRight = dir === "\u2192";
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
        countCtx.textAlign = "center";
        countCtx.textBaseline = "middle";
        const txt = String(seg.count);
        const tw = countCtx.measureText(txt).width;
        const bw = tw + 4;
        const bh = fontSize + 3;
        countCtx.fillStyle = "rgba(255,107,53,0.9)";
        roundRect(countCtx, cx - bw / 2, cy - bh / 2, bw, bh, 2);
        countCtx.fill();
        countCtx.fillStyle = "#fff";
        countCtx.fillText(txt, cx, cy);
        colCursor = endCol + step;
      }
    }
    drawGrid();
  }
  function goCount() {
    if (!state.countGrid.length || !state.countMetrics) return;
    runLengthEncode();
    const { pw, ph, rows, cols } = state.countMetrics;
    drawCountOverlay(pw, ph, rows, cols);
    goStep(5);
    autoSaveProject();
  }
  function toggleCountOverlay() {
    state.showCountOverlay = !state.showCountOverlay;
    dom.countCanvas.style.opacity = state.showCountOverlay ? "1" : "0";
  }
  var init_count = __esm({
    "js/count.js"() {
      init_state();
      init_dom();
      init_utils();
      init_grid();
      init_steps();
    },
  });

  // js/viewport.js
  var viewport_exports = {};
  __export(viewport_exports, {
    renderWorkingCanvasDisplay: () => renderWorkingCanvasDisplay,
    resetGridZoom: () => resetGridZoom,
    setGridZoom: () => setGridZoom,
    updateBaseDisplayScale: () => updateBaseDisplayScale,
    updateZoomUI: () => updateZoomUI,
  });
  function updateBaseDisplayScale() {
    if (!state.workingCanvas) return;
    const area = dom.canvasArea;
    const maxW = area.clientWidth - 40;
    const maxH = area.clientHeight - 40;
    const sw = state.workingCanvas.width;
    const sh = state.workingCanvas.height;
    state.baseDisplayScale = Math.min(1, maxW / sw, maxH / sh);
    if (state.baseDisplayScale < 0.125) state.baseDisplayScale = 0.125;
  }
  function updateZoomUI() {
    document.getElementById("grid-zoom").value = Math.round(
      state.zoomLevel * 100,
    );
    document.getElementById("grid-zoom-val").textContent =
      `${Math.round(state.zoomLevel * 100)}%`;
    dom.zoomInfo.textContent = `${state.workingCanvas.width}\xD7${state.workingCanvas.height}px \xB7 ${Math.round(state.displayScale * 100)}% \xB7 scroll zoom \xB7 drag pan`;
  }
  async function renderWorkingCanvasDisplay() {
    if (!state.workingCanvas) return;
    const sw = state.workingCanvas.width;
    const sh = state.workingCanvas.height;
    state.displayScale = state.baseDisplayScale * state.zoomLevel;
    const dw = Math.max(1, Math.round(sw * state.displayScale));
    const dh = Math.max(1, Math.round(sh * state.displayScale));
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
    dom.wrapper.style.width = dw + "px";
    dom.wrapper.style.height = dh + "px";
    mainCtx.imageSmoothingEnabled = false;
    gridCtx.clearRect(0, 0, dw, dh);
    countCtx.clearRect(0, 0, dw, dh);
    highlightCtx.clearRect(0, 0, dw, dh);
    if (state.currentStep >= 4 && state.countGrid.length) {
      const {
        drawColorPreview: drawColorPreview2,
        drawColorHighlight: drawColorHighlight2,
      } = await Promise.resolve().then(
        () => (init_color_correction(), color_correction_exports),
      );
      drawColorPreview2();
      if (state.highlightedSourceHex)
        drawColorHighlight2(state.highlightedSourceHex);
    } else {
      mainCtx.clearRect(0, 0, dw, dh);
      mainCtx.drawImage(state.workingCanvas, 0, 0, sw, sh, 0, 0, dw, dh);
    }
    updateZoomUI();
    const { updateCropUI: updateCropUI2 } = await Promise.resolve().then(
      () => (init_crop(), crop_exports),
    );
    updateCropUI2();
    if (state.currentStep === 3) drawGrid();
    if (state.currentStep === 4 && state.countMetrics) {
      drawGrid(0.22);
    }
    if (state.currentStep === 5 && state.countMetrics) {
      const { drawCountOverlay: drawCountOverlay2 } =
        await Promise.resolve().then(() => (init_count(), count_exports));
      drawCountOverlay2(
        state.countMetrics.pw,
        state.countMetrics.ph,
        state.countMetrics.rows,
        state.countMetrics.cols,
      );
    }
    if (state.currentStep === 6 && state.countMetrics) {
      renderPatternWalkCanvases();
    }
  }
  function setGridZoom(value, anchorX, anchorY) {
    if (!state.workingCanvas) return;
    const oldScale =
      state.displayScale || state.baseDisplayScale * state.zoomLevel;
    state.zoomLevel = Math.max(
      0.25,
      Math.min(8, parseInt(value, 10) / 100 || 1),
    );
    if (anchorX !== void 0 && anchorY !== void 0) {
      const rect = dom.canvasArea.getBoundingClientRect();
      const contentX = dom.canvasArea.scrollLeft + anchorX - rect.left;
      const contentY = dom.canvasArea.scrollTop + anchorY - rect.top;
      renderWorkingCanvasDisplay();
      const ratio = state.displayScale / Math.max(oldScale, 1e-6);
      dom.canvasArea.scrollLeft = Math.max(
        0,
        contentX * ratio - (anchorX - rect.left),
      );
      dom.canvasArea.scrollTop = Math.max(
        0,
        contentY * ratio - (anchorY - rect.top),
      );
    } else {
      renderWorkingCanvasDisplay();
    }
  }
  function resetGridZoom() {
    setGridZoom(100);
  }
  var init_viewport = __esm({
    "js/viewport.js"() {
      init_state();
      init_dom();
      init_grid();
    },
  });

  // js/image.js
  function initWorkingCanvas(src, sx, sy, sw, sh) {
    state.workingCanvas = document.createElement("canvas");
    state.workingCanvas.width = sw;
    state.workingCanvas.height = sh;
    state.workingCtx = state.workingCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    state.workingCtx.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
    state.zoomLevel = 1;
    dom.canvasArea.scrollLeft = 0;
    dom.canvasArea.scrollTop = 0;
    state.pixelData = null;
    state.countGrid = [];
    state.countResults = [];
    state.countMetrics = null;
    state.yarnColors.clear();
    state.sourceToYarn.clear();
    state.highlightedSourceHex = null;
    updateBaseDisplayScale();
    renderWorkingCanvasDisplay();
    state.cropRect = { x: 0, y: 0, w: sw, h: sh };
    Promise.resolve()
      .then(() => (init_crop(), crop_exports))
      .then(({ updateCropUI: updateCropUI2 }) => updateCropUI2());
  }
  function loadFile(file) {
    if (!file || !file.type.startsWith("image/")) {
      alert("Please choose an image file (PNG, GIF, BMP, JPEG).");
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      state.projectId = null;
      state.projectName = null;
      state.loadedFileName = file.name || null;
      state.originalImg = img;
      initWorkingCanvas(img, 0, 0, img.width, img.height);
      dom.dropZone.style.display = "none";
      dom.wrapper.style.display = "block";
      dom.canvasArea.classList.add("has-image");
      Promise.resolve()
        .then(() => (init_steps(), steps_exports))
        .then(({ goStep: goStep2 }) => goStep2(2));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      alert("Could not load that image. Try another file.");
    };
    img.src = url;
  }
  function initFileHandlers() {
    document.getElementById("file-input").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) loadFile(file);
      e.target.value = "";
    });
    dom.dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dom.dropZone.classList.add("drag-over");
    });
    dom.dropZone.addEventListener("dragleave", () =>
      dom.dropZone.classList.remove("drag-over"),
    );
    dom.dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dom.dropZone.classList.remove("drag-over");
      if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
    });
    dom.dropZone.addEventListener("click", () =>
      document.getElementById("file-input").click(),
    );
  }
  var init_image = __esm({
    "js/image.js"() {
      init_state();
      init_dom();
      init_viewport();
    },
  });

  // js/main.js
  init_state();
  init_image();
  init_crop();
  init_grid();
  init_viewport();
  init_color_correction();
  init_count();

  // js/export.js
  init_state();
  init_utils();
  function getPaletteStats() {
    const stats = /* @__PURE__ */ new Map();
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
    const entriesPerRow = Math.max(
      1,
      Math.floor((footerWidth - padding * 2) / entryWidth),
    );
    const entryRows = Math.max(1, Math.ceil(stats.length / entriesPerRow));
    return {
      width: footerWidth,
      height: padding * 2 + lineHeight * (1 + entryRows),
      padding,
      lineHeight,
      entryWidth,
      entriesPerRow,
    };
  }
  function drawExportCells(
    ctx,
    width,
    height,
    scale,
    offsetX = 0,
    offsetY = 0,
  ) {
    const { pw, ph, cols, rows } = state.countMetrics;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const color = state.countGrid[row]?.[col];
        if (!color) continue;
        const x0 = offsetX + Math.round(col * pw * scale);
        const y0 = offsetY + Math.round(row * ph * scale);
        const x1 =
          offsetX +
          (col === cols - 1 ? width : Math.round((col + 1) * pw * scale));
        const y1 =
          offsetY +
          (row === rows - 1 ? height : Math.round((row + 1) * ph * scale));
        ctx.fillStyle = color.hex;
        ctx.fillRect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
      }
    }
  }
  function drawExportGridOverlay(
    ctx,
    width,
    height,
    scale,
    offsetX = 0,
    offsetY = 0,
  ) {
    const { pw, ph, cols, rows } = state.countMetrics;
    const op =
      parseInt(document.getElementById("grid-opacity").value, 10) / 100;
    const thickness = Math.max(1, Math.round(scale));
    const offset = Math.floor(thickness / 2);
    ctx.fillStyle = `rgba(232,255,71,${op})`;
    for (let col = 0; col <= cols; col++) {
      const x =
        offsetX +
        (col === cols
          ? width - thickness
          : Math.max(0, Math.round(col * pw * scale) - offset));
      ctx.fillRect(x, offsetY, thickness, height);
    }
    for (let row = 0; row <= rows; row++) {
      const y =
        offsetY +
        (row === rows
          ? height - thickness
          : Math.max(0, Math.round(row * ph * scale) - offset));
      ctx.fillRect(offsetX, y, width, thickness);
    }
  }
  function drawExportNumberOverlay(ctx, scale, offsetX = 0, offsetY = 0) {
    const { pw, ph, cols } = state.countMetrics;
    for (const rowResult of state.countResults) {
      const { imgRow, dir, segments } = rowResult;
      const leftToRight = dir === "\u2192";
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
        const fontSize = Math.max(
          7 * scale,
          Math.min(cellH * 0.55, cellW * 0.6, 16 * scale),
        );
        ctx.font = `bold ${fontSize}px 'Space Mono', monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const txt = String(seg.count);
        const tw = ctx.measureText(txt).width;
        const padX = Math.max(2 * scale, fontSize * 0.2);
        const padY = Math.max(2 * scale, fontSize * 0.12);
        const bw = tw + padX * 2;
        const bh = fontSize + padY * 2;
        ctx.fillStyle = "rgba(255,107,53,0.9)";
        roundRect(
          ctx,
          cx - bw / 2,
          cy - bh / 2,
          bw,
          bh,
          Math.max(2, 2 * scale),
        );
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.fillText(txt, cx, cy);
        colCursor = endCol + step;
      }
    }
  }
  function drawExportPaletteFooter(ctx, stats, x, y, layout, scale) {
    const swatch = 10 * scale;
    const fontSize = 10 * scale;
    ctx.fillStyle = "#16161a";
    ctx.fillRect(0, y, ctx.canvas.width, layout.height);
    ctx.fillStyle = "#2a2a35";
    ctx.fillRect(0, y, ctx.canvas.width, Math.max(1, Math.round(scale)));
    ctx.font = `bold ${fontSize}px 'Space Mono', monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#e8ff47";
    ctx.fillText(
      `Unique colors: ${stats.length}`,
      x + layout.padding,
      y + layout.padding + layout.lineHeight / 2,
    );
    ctx.font = `${fontSize}px 'Space Mono', monospace`;
    for (let i = 0; i < stats.length; i++) {
      const entry = stats[i];
      const col = i % layout.entriesPerRow;
      const row = Math.floor(i / layout.entriesPerRow);
      const entryX = x + layout.padding + col * layout.entryWidth;
      const entryY =
        y +
        layout.padding +
        layout.lineHeight * (row + 1) +
        layout.lineHeight / 2;
      const label = getColorLabel(entry.color);
      ctx.fillStyle = entry.color.hex;
      ctx.fillRect(entryX, entryY - swatch / 2, swatch, swatch);
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = Math.max(1, scale);
      ctx.strokeRect(entryX, entryY - swatch / 2, swatch, swatch);
      ctx.fillStyle = "#e8e8f0";
      ctx.fillText(
        `${label} (${entry.color.hex}) x ${entry.count}`,
        entryX + swatch + 6 * scale,
        entryY,
      );
    }
  }
  function exportPNG(scale) {
    if (
      !state.countGrid.length ||
      !state.countMetrics ||
      !state.countResults.length
    )
      return;
    const exportScale = Math.max(1, Math.min(4, parseInt(scale, 10) || 1));
    const { pw, ph, cols, rows } = state.countMetrics;
    const imageWidth = Math.max(1, Math.round(cols * pw * exportScale));
    const imageHeight = Math.max(1, Math.round(rows * ph * exportScale));
    const paletteStats = getPaletteStats();
    const footerLayout = getExportFooterLayout(
      paletteStats,
      imageWidth,
      exportScale,
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(Math.max(imageWidth, footerLayout.width));
    canvas.height = Math.round(imageHeight + footerLayout.height);
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#0d0d0f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const imageOffsetX = Math.round((canvas.width - imageWidth) / 2);
    drawExportCells(ctx, imageWidth, imageHeight, exportScale, imageOffsetX, 0);
    if (document.getElementById("export-grid-overlay").checked) {
      drawExportGridOverlay(
        ctx,
        imageWidth,
        imageHeight,
        exportScale,
        imageOffsetX,
        0,
      );
    }
    drawExportNumberOverlay(ctx, exportScale, imageOffsetX, 0);
    drawExportPaletteFooter(
      ctx,
      paletteStats,
      0,
      imageHeight,
      footerLayout,
      exportScale,
    );
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pixel-count-${cols}x${rows}-${exportScale}x.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1e3);
    }, "image/png");
  }

  // js/main.js
  init_results();
  init_steps();
  function goColorCorrection() {
    enterColorCorrection();
    goStep(4);
    autoSaveProject();
  }
  function initGridHandlers() {
    document
      .getElementById("grid-opacity")
      .addEventListener("input", function () {
        document.getElementById("grid-opacity-val").textContent = this.value;
        drawGrid();
      });
    document.getElementById("grid-zoom").addEventListener("input", function () {
      setGridZoom(this.value);
    });
    document.getElementById("tolerance").addEventListener("input", function () {
      document.getElementById("tol-val").textContent = this.value;
    });
    for (const id of ["px-w", "px-h"]) {
      document.getElementById(id).addEventListener("input", () => {
        syncPixelCountFromCellSize();
        drawGrid();
      });
    }
    for (const id of ["grid-cols-input", "grid-rows-input"]) {
      document.getElementById(id).addEventListener("input", () => {
        syncCellSizeFromPixelCount();
        drawGrid();
      });
    }
  }
  window.goStep = goStep;
  window.resetCrop = resetCrop;
  window.applyCrop = applyCrop;
  window.drawGrid = drawGrid;
  window.setStartDirection = setStartDirection;
  window.resetGridZoom = resetGridZoom;
  window.goColorCorrection = goColorCorrection;
  window.resetColorCorrections = resetColorCorrections;
  window.collapsePaletteColors = collapsePaletteColors;
  window.goCount = goCount;
  window.toggleCountOverlay = toggleCountOverlay;
  window.copyCSV = copyCSV;
  window.exportPNG = exportPNG;
  window.enterPatternWalk = enterPatternWalk;
  window.patternWalkNext = patternWalkNext;
  window.patternWalkPrev = patternWalkPrev;
  initFileHandlers();
  initCropHandlers();
  initGridHandlers();
  initPatternWalkHandlers();
  window.addEventListener("resize", () => {
    if (state.workingCanvas) {
      updateBaseDisplayScale();
      renderWorkingCanvasDisplay();
    }
  });

  // ===== PROJECT PERSISTENCE (IndexedDB) =====
  // Grid is stored as a compact palette + Uint16Array index map instead of
  // full JSON objects — reduces a 100×100 grid from ~800 KB to ~20 KB.
  // Image is stored as a native Blob (no base64 overhead).

  var _IDB_NAME = "PixelCountStudio";
  var _IDB_VER = 1;
  var _IDB_STORE = "projects";
  var _idb = null;

  // Clean up any old localStorage keys left from the previous implementation
  (function () {
    try {
      Object.keys(localStorage)
        .filter(function (k) { return k.startsWith("pixelcount-v1"); })
        .forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) {}
  })();

  function _openIDB() {
    if (_idb) return Promise.resolve(_idb);
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(_IDB_NAME, _IDB_VER);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(_IDB_STORE))
          db.createObjectStore(_IDB_STORE, { keyPath: "id" });
      };
      req.onsuccess = function (e) { _idb = e.target.result; resolve(_idb); };
      req.onerror = function (e) { reject(e.target.error); };
    });
  }
  function _idbPut(record) {
    return _openIDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var req = db.transaction(_IDB_STORE, "readwrite").objectStore(_IDB_STORE).put(record);
        req.onsuccess = function () { resolve(); };
        req.onerror = function (e) { reject(e.target.error); };
      });
    });
  }
  function _idbGet(id) {
    return _openIDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var req = db.transaction(_IDB_STORE, "readonly").objectStore(_IDB_STORE).get(id);
        req.onsuccess = function (e) { resolve(e.target.result); };
        req.onerror = function (e) { reject(e.target.error); };
      });
    });
  }
  function _idbDelete(id) {
    return _openIDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var req = db.transaction(_IDB_STORE, "readwrite").objectStore(_IDB_STORE).delete(id);
        req.onsuccess = function () { resolve(); };
        req.onerror = function (e) { reject(e.target.error); };
      });
    });
  }
  function _idbGetAll() {
    return _openIDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var req = db.transaction(_IDB_STORE, "readonly").objectStore(_IDB_STORE).getAll();
        req.onsuccess = function (e) { resolve(e.target.result); };
        req.onerror = function (e) { reject(e.target.error); };
      });
    });
  }

  // Encode countGrid → { palette: string[], data: Uint16Array }
  // Each cell becomes one index into the palette of unique sourceHex values.
  function _encodeGrid(countGrid, countMetrics) {
    if (!countGrid.length || !countMetrics) return null;
    var rows = countMetrics.rows, cols = countMetrics.cols;
    var palette = [], palIdx = {};
    var data = new Uint16Array(rows * cols);
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var cell = countGrid[r] && countGrid[r][c];
        var key = cell ? cell.sourceHex : "#000000";
        if (palIdx[key] === undefined) { palIdx[key] = palette.length; palette.push(key); }
        data[r * cols + c] = palIdx[key];
      }
    }
    return { palette: palette, data: data };
  }

  // Decode back to a full countGrid using the restored yarn maps
  function _decodeGrid(encoded, countMetrics, yarnColors, sourceToYarn) {
    if (!encoded || !countMetrics) return [];
    var rows = countMetrics.rows, cols = countMetrics.cols;
    var grid = [];
    for (var r = 0; r < rows; r++) {
      grid[r] = [];
      for (var c = 0; c < cols; c++) {
        var sourceHex = encoded.palette[encoded.data[r * cols + c]] || "#000000";
        var yarnId = sourceToYarn.get(sourceHex);
        var yarn = yarnColors.get(yarnId);
        grid[r][c] = {
          r: yarn ? yarn.r : 0, g: yarn ? yarn.g : 0, b: yarn ? yarn.b : 0,
          hex: yarn ? yarn.hex : sourceHex,
          sourceHex: sourceHex,
          name: yarn ? yarn.name : sourceHex,
          yarnId: yarnId || null,
        };
      }
    }
    return grid;
  }

  function _canvasToBlob(canvas) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        blob ? resolve(blob) : reject(new Error("toBlob failed"));
      }, "image/png");
    });
  }

  function _defaultProjectName() {
    if (state.projectName) return state.projectName;
    if (state.loadedFileName) {
      var base = state.loadedFileName.replace(/\.[^.]+$/, "");
      return base || "Untitled Pattern";
    }
    return "Untitled Pattern";
  }

  function _buildProjectRecord(id, name) {
    var encoded = _encodeGrid(state.countGrid, state.countMetrics);
    return _canvasToBlob(state.workingCanvas).then(function (blob) {
      return {
        id: id,
        name: name,
        savedAt: new Date().toISOString(),
        step: state.currentStep,
        imageBlob: blob,
        grid: {
          pwInput: document.getElementById("px-w").value,
          phInput: document.getElementById("px-h").value,
          colsInput: document.getElementById("grid-cols-input").value,
          rowsInput: document.getElementById("grid-rows-input").value,
          tolerance: document.getElementById("tolerance").value,
          startDirection: state.startDirection,
          gridOpacity: document.getElementById("grid-opacity").value,
        },
        countMetrics: state.countMetrics,
        gridPalette: encoded ? encoded.palette : [],
        gridData: encoded ? encoded.data : new Uint16Array(0),
        yarnColors: [...state.yarnColors.entries()],
        sourceToYarn: [...state.sourceToYarn.entries()],
        patternWalkIndex: state.patternWalk.currentIndex,
        patternWalkOptions: Object.assign({}, state.patternWalk.options),
        showCountOverlay: state.showCountOverlay,
      };
    });
  }

  var _saveChain = Promise.resolve();

  function persistProject(options) {
    options = options || {};
    if (!state.workingCanvas) return Promise.resolve(null);

    var run = function () {
      var name = state.projectName || _defaultProjectName();
      var id = state.projectId;

      if (options.promptName) {
        var prompted = prompt("Project name:", name);
        if (prompted === null) return Promise.resolve(null);
        name = prompted.trim() || name;
      }

      if (!id) id = "p" + Date.now();

      return _buildProjectRecord(id, name).then(function (record) {
        return _idbPut(record).then(function () {
          state.projectId = id;
          state.projectName = name;
          return record;
        });
      });
    };

    _saveChain = _saveChain.then(run, run);
    return _saveChain;
  }

  function autoSaveProject() {
    return persistProject({ silent: true }).then(function (record) {
      if (record) renderProjectList();
      return record;
    }).catch(function (e) {
      console.warn("Auto-save failed:", e);
    });
  }

  function saveProject() {
    if (!state.workingCanvas) { alert("No image loaded."); return; }
    persistProject({ promptName: !state.projectId }).then(function (record) {
      if (!record) return;
      var btn = document.getElementById("save-project-btn");
      if (btn) {
        var orig = btn.textContent;
        btn.textContent = "\u2713 Saved!";
        setTimeout(function () { btn.textContent = orig; }, 1600);
      }
      renderProjectList();
    }).catch(function (e) { alert("Save failed: " + e.message); });
  }

  function deleteProject(id) {
    if (!confirm("Delete this project?")) return;
    _idbDelete(id)
      .then(function () {
        if (state.projectId === id) {
          state.projectId = null;
          state.projectName = null;
        }
        renderProjectList();
      })
      .catch(function (e) { alert("Delete failed: " + e.message); });
  }

  function loadProjectById(id) {
    _idbGet(id).then(function (record) {
      if (!record) { alert("Project not found."); return; }
      _restoreSnapshot(record);
    }).catch(function (e) { alert("Load failed: " + e.message); });
  }

  function _restoreSnapshot(snap) {
    if (!snap || !snap.imageBlob) { alert("Invalid project data."); return; }
    state.projectId = snap.id || null;
    state.projectName = snap.name || null;
    var url = URL.createObjectURL(snap.imageBlob);
    var img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      state.workingCanvas = document.createElement("canvas");
      state.workingCanvas.width = img.width;
      state.workingCanvas.height = img.height;
      state.workingCtx = state.workingCanvas.getContext("2d", { willReadFrequently: true });
      state.workingCtx.drawImage(img, 0, 0);
      state.zoomLevel = 1;
      dom.canvasArea.scrollLeft = 0;
      dom.canvasArea.scrollTop = 0;
      state.pixelData = null;
      state.highlightedSourceHex = null;
      state.viewPanning = null;
      state.cropDragging = null;
      state.cropRect = { x: 0, y: 0, w: img.width, h: img.height };

      var g = snap.grid || {};
      if (g.pwInput !== undefined) document.getElementById("px-w").value = g.pwInput;
      if (g.phInput !== undefined) document.getElementById("px-h").value = g.phInput;
      if (g.colsInput !== undefined) document.getElementById("grid-cols-input").value = g.colsInput;
      if (g.rowsInput !== undefined) document.getElementById("grid-rows-input").value = g.rowsInput;
      if (g.tolerance !== undefined) {
        document.getElementById("tolerance").value = g.tolerance;
        document.getElementById("tol-val").textContent = g.tolerance;
      }
      if (g.gridOpacity !== undefined) {
        document.getElementById("grid-opacity").value = g.gridOpacity;
        document.getElementById("grid-opacity-val").textContent = g.gridOpacity;
      }
      if (g.startDirection) setStartDirection(g.startDirection);

      state.countMetrics = snap.countMetrics || null;
      state.showCountOverlay = snap.showCountOverlay !== false;
      dom.countCanvas.style.opacity = state.showCountOverlay ? "1" : "0";

      state.yarnColors.clear();
      state.sourceToYarn.clear();
      if (snap.yarnColors) snap.yarnColors.forEach(function (e) { state.yarnColors.set(e[0], e[1]); });
      if (snap.sourceToYarn) snap.sourceToYarn.forEach(function (e) { state.sourceToYarn.set(e[0], e[1]); });

      state.countGrid = _decodeGrid(
        { palette: snap.gridPalette, data: snap.gridData },
        snap.countMetrics, state.yarnColors, state.sourceToYarn
      );
      state.countResults = [];

      if (state.countGrid.length && state.countMetrics) {
        runLengthEncode();
        if (snap.step >= 6) {
          state.patternWalk.steps = buildWalkStepsFromCountResults();
          state.patternWalk.currentIndex = snap.patternWalkIndex || 0;
        }
      }
      if (snap.patternWalkOptions) Object.assign(state.patternWalk.options, snap.patternWalkOptions);

      dom.dropZone.style.display = "none";
      dom.wrapper.style.display = "block";
      dom.canvasArea.classList.add("has-image");
      updateBaseDisplayScale();

      Promise.resolve()
        .then(function () { return (init_steps(), steps_exports); })
        .then(function (m) { m.goStep(snap.step || 2); });
    };
    img.onerror = function () { URL.revokeObjectURL(url); alert("Could not restore image."); };
    img.src = url;
  }

  function renderProjectList() {
    return _idbGetAll().then(function (records) {
      var container = document.getElementById("project-list");
      if (!container) return;
      if (!records || !records.length) {
        container.innerHTML = '<p style="font-size:0.65rem;color:var(--text-dim);padding:4px 0">No saved projects yet.</p>';
        return;
      }
      records.sort(function (a, b) { return a.savedAt < b.savedAt ? 1 : -1; });
      container.innerHTML = "";
      var stepLabels = ["", "Load", "Crop", "Grid", "Colors", "Count", "Walk"];
      records.forEach(function (proj) {
        var date = "";
        try { date = new Date(proj.savedAt).toLocaleDateString(); } catch (e) {}
        var item = document.createElement("div");
        item.className = "project-list-item" + (proj.id === state.projectId ? " is-current" : "");
        item.innerHTML =
          '<div class="project-list-name">' + proj.name + "</div>" +
          '<div class="project-list-meta">' + date + " \xB7 " + (stepLabels[proj.step] || "Step " + proj.step) + "</div>" +
          '<div class="project-list-actions">' +
          '<button class="btn btn-primary" style="font-size:0.62rem;padding:5px 10px" onclick="loadProjectById(\'' + proj.id + '\')">Load</button>' +
          '<button class="btn btn-danger" style="font-size:0.62rem;padding:5px 8px" onclick="deleteProject(\'' + proj.id + '\')">✕</button>' +
          "</div>";
        container.appendChild(item);
      });
    }).catch(function (e) { console.warn("renderProjectList:", e); });
  }

  window.saveProject = saveProject;
  window.loadProjectById = loadProjectById;
  window.deleteProject = deleteProject;
  renderProjectList();
})();
