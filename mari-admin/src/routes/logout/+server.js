import { redirect } from '@sveltejs/kit';
import { clearAdminSession } from '$lib/server/auth.js';

/** @type {import('./$types').RequestHandler} */
export async function POST({ cookies }) {
	clearAdminSession(cookies);
	throw redirect(303, '/login');
}
