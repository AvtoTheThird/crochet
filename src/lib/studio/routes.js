/** Studio step ↔ URL slug mapping. Leaves room for /login, /profile, /gallery, etc. */

export const STUDIO_STEPS = [
	{ n: 1, slug: 'load', label: 'Load Image' },
	{ n: 2, slug: 'crop', label: 'Crop' },
	{ n: 3, slug: 'grid', label: 'Grid Setup' },
	{ n: 4, slug: 'colors', label: 'Color Correction' },
	{ n: 5, slug: 'walk', label: 'Pattern Walk' }
];

const bySlug = new Map(STUDIO_STEPS.map((s) => [s.slug, s]));
const byNumber = new Map(STUDIO_STEPS.map((s) => [s.n, s]));

/** @param {string} slug */
export function isValidStepSlug(slug) {
	// `count` kept as a legacy alias that maps to Pattern Walk
	return bySlug.has(slug) || slug === 'count';
}

/** @param {string | undefined} slug */
export function stepFromSlug(slug) {
	if (slug === 'count') return 5;
	return bySlug.get(slug)?.n ?? null;
}

/** @param {number} n */
export function slugFromStep(n) {
	return byNumber.get(n)?.slug ?? 'load';
}

/** @param {number} n */
export function studioPathForStep(n) {
	return `/studio/${slugFromStep(n)}`;
}

export const STUDIO_STEP_SLUGS = STUDIO_STEPS.map((s) => s.slug);
