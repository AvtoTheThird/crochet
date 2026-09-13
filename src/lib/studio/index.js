/**
 * Public studio API for the Svelte UI layer.
 */
export { state, STEP_COUNT } from './state.js';
export { initStudio, studioActions } from './init.js';
export {
	STUDIO_STEPS,
	studioPathForStep,
	slugFromStep,
	stepFromSlug,
	isValidStepSlug
} from './routes.js';
