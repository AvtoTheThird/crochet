import { fail, redirect } from '@sveltejs/kit';
import { createAdminSession, verifyAdminPassword } from '$lib/server/auth.js';

/** @type {import('./$types').Actions} */
export const actions = {
	default: async ({ request, cookies }) => {
		const fd = await request.formData();
		const password = String(fd.get('password') ?? '');
		try {
			if (!verifyAdminPassword(password)) {
				return fail(401, { error: 'Invalid password' });
			}
		} catch (e) {
			return fail(500, { error: e instanceof Error ? e.message : 'Server config error' });
		}
		createAdminSession(cookies);
		throw redirect(303, '/');
	}
};
