import { state } from './state.js';
import { formatGridNumber } from './utils.js';
import { setPixelSizeLocked, enforceLockedPixelSize, syncPixelCountFromCellSize, drawGrid } from './grid.js';
import { initWorkingCanvas } from './image.js';
import { showAlert, notify } from '$lib/ui/dialogs.svelte.js';
import { cropForOrigin, detectGridAlignment } from './grid-period.js';

export function autoAlignGrid() {
	const canvas = state.workingCanvas;
	const ctx = state.workingCtx;
	if (!canvas || !ctx) return;

	const { width, height } = canvas;
	const image = ctx.getImageData(0, 0, width, height);
	const detected = detectGridAlignment(image.data, width, height);
	if (!detected) {
		showAlert({
			title: 'No grid found',
			message:
				'This picture doesn’t have a clear repeating pixel pattern. Set the pixel width and height yourself.',
			tone: 'warning'
		});
		return;
	}

	let { pw, ph, ox, oy } = detected;
	const same = Math.abs(pw - ph) < 0.08;
	if (!same && state.pixelSizeLocked) setPixelSizeLocked(false);
	if (same && state.pixelSizeLocked) {
		const size = Math.round(((pw + ph) / 2) * 1000) / 1000;
		pw = size;
		ph = size;
	}

	const pxW = document.getElementById('px-w');
	const pxH = document.getElementById('px-h');
	if (pxW) pxW.value = formatGridNumber(pw);
	if (pxH) pxH.value = formatGridNumber(ph);
	if (state.pixelSizeLocked) enforceLockedPixelSize('px-w');

	const cropX = cropForOrigin(ox, pw, width);
	const cropY = cropForOrigin(oy, ph, height);
	if (cropX !== 0 || cropY !== 0) {
		initWorkingCanvas(canvas, cropX, cropY, width - cropX, height - cropY);
	}
	// Counts depend on the canvas size after the phase shift.
	syncPixelCountFromCellSize();
	if (cropX === 0 && cropY === 0) drawGrid();

	const size = state.pixelSizeLocked
		? `${formatGridNumber(pw)} px`
		: `${formatGridNumber(pw)} × ${formatGridNumber(ph)} px`;
	notify(`Grid aligned to ${size}`);
}
