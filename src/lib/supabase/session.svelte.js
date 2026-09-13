/**
 * Reactive auth session for the SPA (plain $state object — safer than class fields).
 */
import { getSupabase } from './client.js';
import { getUserProfile } from './auth.js';

/** @typedef {import('@supabase/supabase-js').Session} Session */
/** @typedef {import('@supabase/supabase-js').User} User */

export const auth = $state({
	/** @type {Session | null} */
	session: null,
	/** @type {User | null} */
	user: null,
	/** @type {Record<string, unknown> | null} */
	profile: null,
	loading: true,
	/** @type {string | null} */
	error: null
});

let started = false;

export async function initAuth() {
	if (started) return;
	started = true;

	try {
		const supabase = getSupabase();
		const { data, error } = await supabase.auth.getSession();
		if (error) throw error;
		await setAuthSession(data.session);

		supabase.auth.onAuthStateChange(async (_event, next) => {
			await setAuthSession(next);
		});
	} catch (e) {
		auth.error = e?.message || 'Auth init failed';
		auth.session = null;
		auth.user = null;
		auth.profile = null;
	} finally {
		auth.loading = false;
	}
}

/**
 * @param {Session | null} session
 */
export async function setAuthSession(session) {
	auth.session = session;
	auth.user = session?.user ?? null;

	if (session?.user) {
		try {
			auth.profile = await getUserProfile(session.user.id);
		} catch (e) {
			console.warn('profile load:', e);
			auth.profile = null;
		}
	} else {
		auth.profile = null;
	}
}

export function isLoggedIn() {
	return !!auth.session?.user;
}
