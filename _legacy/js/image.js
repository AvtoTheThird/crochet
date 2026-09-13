import { state } from "./state.js";
import { dom } from "./dom.js";
import {
  updateBaseDisplayScale,
  renderWorkingCanvasDisplay,
} from "./viewport.js";
import { updateCropUI } from "./crop.js";
import { goStep } from "./steps.js";

export function initWorkingCanvas(src, sx, sy, sw, sh) {
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
  updateCropUI();
}

export function loadFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    alert("Please choose an image file (PNG, GIF, BMP, JPEG).");
    return;
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    state.originalImg = img;
    initWorkingCanvas(img, 0, 0, img.width, img.height);
    dom.dropZone.style.display = "none";
    dom.wrapper.style.display = "block";
    dom.canvasArea.classList.add("has-image");
    goStep(2);
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    alert("Could not load that image. Try another file.");
  };
  img.src = url;
}

export function initFileHandlers() {
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
