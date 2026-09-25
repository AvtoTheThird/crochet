import { redirect } from '@sveltejs/kit';
import { isAdminAuthenticated } from '$lib/server/auth.js';

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	const path = event.url.pathname;
	const publicPaths = ['/login'];
	const authed = isAdminAuthenticated(event.cookies);
	event.locals.admin = authed;

	if (!authed && !publicPaths.includes(path) && !path.startsWith('/login')) {
		throw redirect(303, '/login');
	}
	if (authed && path === '/login') {
		throw redirect(303, '/');
	}

	return resolve(event);
}
