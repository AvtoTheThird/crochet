import { state } from './state.js';
import { dom } from './dom.js';
import { initWorkingCanvas } from './image.js';
import { goStep } from './steps.js';

export function enableCrop() {
  dom.cropOverlay.style.display = 'block';
  updateCropUI();
}

export function disableCrop() {
  dom.cropOverlay.style.display = 'none';
}

export function updateCropUI() {
  if (!state.workingCanvas) return;
  const iw = state.workingCanvas.width;
  const ih = state.workingCanvas.height;
  const dw = dom.mainCanvas.width;
  const dh = dom.mainCanvas.height;
  const sx = state.cropRect.x / iw * dw;
  const sy = state.cropRect.y / ih * dh;
  const sw = state.cropRect.w / iw * dw;
  const sh = state.cropRect.h / ih * dh;

  dom.cropBox.style.left = sx + 'px';
  dom.cropBox.style.top = sy + 'px';
  dom.cropBox.style.width = sw + 'px';
  dom.cropBox.style.height = sh + 'px';

  document.getElementById('shade-top').style.cssText = `left:0;top:0;width:100%;height:${sy}px`;
  document.getElementById('shade-bottom').style.cssText = `left:0;top:${sy + sh}px;width:100%;height:${dh - sy - sh}px`;
  document.getElementById('shade-left').style.cssText = `left:0;top:${sy}px;width:${sx}px;height:${sh}px`;
  document.getElementById('shade-right').style.cssText = `left:${sx + sw}px;top:${sy}px;width:${dw - sx - sw}px;height:${sh}px`;

  document.getElementById('crop-x').textContent = Math.round(state.cropRect.x);
  document.getElementById('crop-y').textContent = Math.round(state.cropRect.y);
  document.getElementById('crop-w').textContent = Math.round(state.cropRect.w);
  document.getElementById('crop-h').textContent = Math.round(state.cropRect.h);
}

export function resetCrop() {
  if (!state.workingCanvas) return;
  state.cropRect = { x: 0, y: 0, w: state.workingCanvas.width, h: state.workingCanvas.height };
  updateCropUI();
}

export function applyCrop() {
  if (!state.workingCanvas) return;
  const cx = Math.round(state.cropRect.x);
  const cy = Math.round(state.cropRect.y);
  const cw = Math.round(state.cropRect.w);
  const ch = Math.round(state.cropRect.h);
  initWorkingCanvas(state.workingCanvas, cx, cy, cw, ch);
  state.cropRect = { x: 0, y: 0, w: cw, h: ch };
  goStep(3);
}

export function initCropHandlers() {
  dom.canvasArea.addEventListener('mousedown', e => {
    if (!state.workingCanvas || dom.wrapper.style.display === 'none') return;
    if (e.button !== 0) return;
    if (e.target.closest('#crop-box')) return;

    state.viewPanning = {
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: dom.canvasArea.scrollLeft,
      scrollTop: dom.canvasArea.scrollTop
    };
    dom.canvasArea.classList.add('panning');
    e.preventDefault();
  });

  dom.canvasArea.addEventListener('wheel', e => {
    if (!state.workingCanvas || dom.wrapper.style.display === 'none') return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const nextZoom = Math.max(0.25, Math.min(8, state.zoomLevel * factor));
    import('./viewport.js').then(({ setGridZoom }) => setGridZoom(Math.round(nextZoom * 100), e.clientX, e.clientY));
  }, { passive: false });

  dom.cropBox.addEventListener('mousedown', e => {
    if (e.target.dataset.handle) {
      state.cropDragging = { type: e.target.dataset.handle, startX: e.clientX, startY: e.clientY, origRect: { ...state.cropRect } };
    } else {
      state.cropDragging = { type: 'move', startX: e.clientX, startY: e.clientY, origRect: { ...state.cropRect } };
    }
    e.stopPropagation();
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (state.viewPanning) {
      dom.canvasArea.scrollLeft = state.viewPanning.scrollLeft - (e.clientX - state.viewPanning.startX);
      dom.canvasArea.scrollTop = state.viewPanning.scrollTop - (e.clientY - state.viewPanning.startY);
      return;
    }
    if (!state.cropDragging || !state.workingCanvas) return;

    const iw = state.workingCanvas.width;
    const ih = state.workingCanvas.height;
    const dw = dom.mainCanvas.width;
    const dh = dom.mainCanvas.height;
    const dx = (e.clientX - state.cropDragging.startX) / dw * iw;
    const dy = (e.clientY - state.cropDragging.startY) / dh * ih;
    const o = state.cropDragging.origRect;
    const MIN = 4;
    let r = { ...o };

    if (state.cropDragging.type === 'move') {
      r.x = Math.max(0, Math.min(iw - r.w, o.x + dx));
      r.y = Math.max(0, Math.min(ih - r.h, o.y + dy));
    } else if (state.cropDragging.type === 'tl') {
      r.x = Math.max(0, Math.min(o.x + o.w - MIN, o.x + dx));
      r.y = Math.max(0, Math.min(o.y + o.h - MIN, o.y + dy));
      r.w = o.x + o.w - r.x;
      r.h = o.y + o.h - r.y;
    } else if (state.cropDragging.type === 'tr') {
      r.y = Math.max(0, Math.min(o.y + o.h - MIN, o.y + dy));
      r.w = Math.max(MIN, Math.min(iw - o.x, o.w + dx));
      r.h = o.y + o.h - r.y;
    } else if (state.cropDragging.type === 'bl') {
      r.x = Math.max(0, Math.min(o.x + o.w - MIN, o.x + dx));
      r.w = o.x + o.w - r.x;
      r.h = Math.max(MIN, Math.min(ih - o.y, o.h + dy));
    } else if (state.cropDragging.type === 'br') {
      r.w = Math.max(MIN, Math.min(iw - o.x, o.w + dx));
      r.h = Math.max(MIN, Math.min(ih - o.y, o.h + dy));
    }
    state.cropRect = r;
    updateCropUI();
  });

  document.addEventListener('mouseup', () => {
    state.viewPanning = null;
    dom.canvasArea.classList.remove('panning');
    state.cropDragging = null;
  });
}
