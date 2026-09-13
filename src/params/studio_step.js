/** @type {import('@sveltejs/kit').ParamMatcher} */
export function match(param) {
	return (
		param === 'load' ||
		param === 'crop' ||
		param === 'grid' ||
		param === 'colors' ||
		param === 'count' ||
		param === 'walk'
	);
}
