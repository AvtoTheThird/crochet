/** @type {import('./$types').LayoutServerLoad} */
export function load({ locals, url }) {
	return {
		showNav: locals.admin && url.pathname !== '/login'
	};
}
