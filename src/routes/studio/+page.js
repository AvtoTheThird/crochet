import { redirect } from '@sveltejs/kit';

/** @type {import('./$types').PageLoad} */
export function load() {
	redirect(307, '/studio/load');
}
