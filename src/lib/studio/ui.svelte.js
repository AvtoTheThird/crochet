import { flushSync } from 'svelte';

/** Reactive studio flags that Svelte components can read. */
export const studioUi = $state({ hasImage: false });

/**
 * Apply the layout change (sidebar/step bar appear) synchronously so the
 * imperative canvas code that runs next measures the final layout.
 * @param {boolean} value
 */
export function setHasImage(value) {
	studioUi.hasImage = value;
	flushSync();
}
