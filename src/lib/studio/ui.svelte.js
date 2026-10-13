import { flushSync } from 'svelte';

/**
 * @typedef {{ sourceHex: string, hex: string, name: string, count: number }} PaletteSwatch
 */

/** Reactive studio flags that Svelte components can read. */
export const studioUi = $state({
	hasImage: false,
	step: 1,
	paintOpen: false,
	/** @type {'brush' | 'picker'} */
	paintTool: 'brush',
	/** Paint strokes available to undo. */
	undoCount: 0,
	paintColor: '#e8ff47',
	/** Palette entry (source hex) the brush is bound to; null means "use paintColor". */
	paintSource: /** @type {string | null} */ (null),
	/** @type {PaletteSwatch[]} */
	palette: []
});

/**
 * Apply the layout change (sidebar/step bar appear) synchronously so the
 * imperative canvas code that runs next measures the final layout.
 * @param {boolean} value
 */
export function setHasImage(value) {
	studioUi.hasImage = value;
	flushSync();
}

/** @param {number} n */
export function setUiStep(n) {
	studioUi.step = n;
}

/** @param {PaletteSwatch[]} swatches */
export function setPaletteSwatches(swatches) {
	studioUi.palette = swatches;
}
