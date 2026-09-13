import { error } from '@sveltejs/kit';
import { isValidStepSlug, STUDIO_STEP_SLUGS } from '$lib/studio/routes.js';

/** @type {import('./$types').EntryGenerator} */
export function entries() {
	return STUDIO_STEP_SLUGS.map((step) => ({ step }));
}

/** @type {import('./$types').PageLoad} */
export function load({ params }) {
	if (!isValidStepSlug(params.step)) {
		error(404, 'Unknown studio step');
	}
	return { step: params.step };
}
