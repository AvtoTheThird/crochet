import { state } from './state.js';
import { dom } from './dom.js';
import { initWorkingCanvas } from './image.js';
import { goStep } from './steps.js';
import { setGridZoom, getDisplaySize, MIN_ZOOM, MAX_ZOOM } from './viewport.js';
import { isPaintActive, cancelPaintStroke } from './paint.js';

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
	const { dw, dh } = getDisplaySize();
	if (!dw || !dh) return;
	const sx = (state.cropRect.x / iw) * dw;
	const sy = (state.cropRect.y / ih) * dh;
	const sw = (state.cropRect.w / iw) * dw;
	const sh = (state.cropRect.h / ih) * dh;

	dom.cropBox.style.left = sx + 'px';
	dom.cropBox.style.top = sy + 'px';
	dom.cropBox.style.width = sw + 'px';
	dom.cropBox.style.height = sh + 'px';

	document.getElementById('shade-top').style.cssText =
		`left:0;top:0;width:100%;height:${sy}px`;
	document.getElementById('shade-bottom').style.cssText =
		`left:0;top:${sy + sh}px;width:100%;height:${dh - sy - sh}px`;
	document.getElementById('shade-left').style.cssText =
		`left:0;top:${sy}px;width:${sx}px;height:${sh}px`;
	document.getElementById('shade-right').style.cssText =
		`left:${sx + sw}px;top:${sy}px;width:${dw - sx - sw}px;height:${sh}px`;

	document.getElementById('crop-x').textContent = Math.round(state.cropRect.x);
	document.getElementById('crop-y').textContent = Math.round(state.cropRect.y);
	document.getElementById('crop-w').textContent = Math.round(state.cropRect.w);
	document.getElementById('crop-h').textContent = Math.round(state.cropRect.h);
}

export function resetCrop() {
	if (!state.workingCanvas) return;
	state.cropRect = {
		x: 0,
		y: 0,
		w: state.workingCanvas.width,
		h: state.workingCanvas.height
	};
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

/** @param {Touch} a @param {Touch} b */
function touchDistance(a, b) {
	return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

/** @param {Touch} a @param {Touch} b */
function touchMidpoint(a, b) {
	return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
}

/** One finger pans the canvas area; two fingers pinch-zoom around their midpoint and pan. */
function initTouchGestures() {
	const area = dom.canvasArea;
	/** @type {{ type: 'pan', x: number, y: number } | { type: 'pinch', dist: number, zoom: number, mid: { x: number, y: number } } | null} */
	let gesture = null;

	const hasArtwork = () => state.workingCanvas && dom.wrapper.style.display !== 'none';

	area.addEventListener(
		'touchstart',
		(e) => {
			if (!hasArtwork()) return;
			if (e.touches.length >= 2) {
				cancelPaintStroke();
				const [a, b] = e.touches;
				gesture = {
					type: 'pinch',
					dist: Math.max(1, touchDistance(a, b)),
					zoom: state.zoomLevel,
					mid: touchMidpoint(a, b)
				};
				e.preventDefault();
				return;
			}
			const target = /** @type {Element} */ (e.target);
			if (target.closest('#crop-box')) return;
			if (isPaintActive() && target.closest('#canvas-wrapper')) return;
			const t = e.touches[0];
			gesture = { type: 'pan', x: t.clientX, y: t.clientY };
		},
		{ passive: false }
	);

	area.addEventListener(
		'touchmove',
		(e) => {
			if (!gesture) return;
			if (gesture.type === 'pinch' && e.touches.length >= 2) {
				e.preventDefault();
				const [a, b] = e.touches;
				const mid = touchMidpoint(a, b);
				area.scrollLeft -= mid.x - gesture.mid.x;
				area.scrollTop -= mid.y - gesture.mid.y;
				gesture.mid = mid;
				const ratio = touchDistance(a, b) / gesture.dist;
				setGridZoom(gesture.zoom * ratio * 100, mid.x, mid.y);
			} else if (gesture.type === 'pan' && e.touches.length === 1) {
				e.preventDefault();
				const t = e.touches[0];
				area.scrollLeft -= t.clientX - gesture.x;
				area.scrollTop -= t.clientY - gesture.y;
				gesture.x = t.clientX;
				gesture.y = t.clientY;
			}
		},
		{ passive: false }
	);

	const endGesture = (/** @type {TouchEvent} */ e) => {
		// Lifting one finger of a pinch shouldn't turn into a jumpy pan.
		if (e.touches.length < 2 && gesture?.type === 'pinch') gesture = null;
		if (e.touches.length === 0) gesture = null;
	};
	area.addEventListener('touchend', endGesture);
	area.addEventListener('touchcancel', endGesture);
}

export function initCropHandlers() {
	dom.canvasArea.addEventListener('mousedown', (e) => {
		if (!state.workingCanvas || dom.wrapper.style.display === 'none') return;
		const painting = isPaintActive();
		if (e.button !== 0 && !(painting && e.button === 1)) return;
		if (e.target.closest('#crop-box')) return;
		if (painting && e.button === 0 && e.target.closest('#canvas-wrapper')) return;

		state.viewPanning = {
			startX: e.clientX,
			startY: e.clientY,
			scrollLeft: dom.canvasArea.scrollLeft,
			scrollTop: dom.canvasArea.scrollTop
		};
		dom.canvasArea.classList.add('panning');
		e.preventDefault();
	});

	dom.canvasArea.addEventListener(
		'wheel',
		(e) => {
			if (!state.workingCanvas || dom.wrapper.style.display === 'none') return;
			e.preventDefault();
			const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
			const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, state.zoomLevel * factor));
			setGridZoom(nextZoom * 100, e.clientX, e.clientY);
		},
		{ passive: false }
	);

	initTouchGestures();

	dom.cropBox.addEventListener('mousedown', (e) => {
		if (e.target.dataset.handle) {
			state.cropDragging = {
				type: e.target.dataset.handle,
				startX: e.clientX,
				startY: e.clientY,
				origRect: { ...state.cropRect }
			};
		} else {
			state.cropDragging = {
				type: 'move',
				startX: e.clientX,
				startY: e.clientY,
				origRect: { ...state.cropRect }
			};
		}
		e.stopPropagation();
		e.preventDefault();
	});

	document.addEventListener('mousemove', (e) => {
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
		const { dw, dh } = getDisplaySize();
		if (!dw || !dh) return;
		const dx = ((e.clientX - state.cropDragging.startX) / dw) * iw;
		const dy = ((e.clientY - state.cropDragging.startY) / dh) * ih;
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
