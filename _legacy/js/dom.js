export const dom = {
  mainCanvas: document.getElementById('main-canvas'),
  gridCanvas: document.getElementById('grid-canvas'),
  countCanvas: document.getElementById('count-canvas'),
  highlightCanvas: document.getElementById('highlight-canvas'),
  wrapper: document.getElementById('canvas-wrapper'),
  dropZone: document.getElementById('drop-zone'),
  cropOverlay: document.getElementById('crop-overlay'),
  cropBox: document.getElementById('crop-box'),
  zoomInfo: document.getElementById('zoom-info'),
  canvasArea: document.getElementById('canvas-area'),
  paletteList: document.getElementById('palette-list'),
  paletteCount: document.getElementById('palette-count')
};

export const mainCtx = dom.mainCanvas.getContext('2d', { willReadFrequently: true });
export const gridCtx = dom.gridCanvas.getContext('2d');
export const countCtx = dom.countCanvas.getContext('2d');
export const highlightCtx = dom.highlightCanvas.getContext('2d');
