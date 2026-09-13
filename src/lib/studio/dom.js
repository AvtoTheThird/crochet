/** Canvas / workspace DOM refs — populated after Studio mounts (browser-only). */

export const dom = {
	mainCanvas: null,
	gridCanvas: null,
	countCanvas: null,
	highlightCanvas: null,
	wrapper: null,
	dropZone: null,
	cropOverlay: null,
	cropBox: null,
	zoomInfo: null,
	canvasArea: null,
	paletteList: null,
	paletteCount: null
};

/** @type {CanvasRenderingContext2D | null} */
export let mainCtx = null;
/** @type {CanvasRenderingContext2D | null} */
export let gridCtx = null;
/** @type {CanvasRenderingContext2D | null} */
export let countCtx = null;
/** @type {CanvasRenderingContext2D | null} */
export let highlightCtx = null;

/**
 * @param {Partial<typeof dom>} refs
 */
export function setDomRefs(refs) {
	Object.assign(dom, refs);
	if (!dom.mainCanvas || !dom.gridCanvas || !dom.countCanvas || !dom.highlightCanvas) {
		throw new Error('setDomRefs: canvas elements are required');
	}
	mainCtx = dom.mainCanvas.getContext('2d', { willReadFrequently: true });
	gridCtx = dom.gridCanvas.getContext('2d');
	countCtx = dom.countCanvas.getContext('2d');
	highlightCtx = dom.highlightCanvas.getContext('2d');
}
