import { getSupabase } from './client.js';
import { setAuthSession } from './session.svelte.js';

/**
 * @returns {Promise<import('@supabase/supabase-js').Session | null>}
 */
export async function getSession() {
	const supabase = getSupabase();
	const { data, error } = await supabase.auth.getSession();
	if (error) {
		console.warn('getSession:', error.message);
		return null;
	}
	return data.session ?? null;
}

/**
 * @returns {Promise<import('@supabase/supabase-js').User | null>}
 */
export async function getUser() {
	const session = await getSession();
	return session?.user ?? null;
}

/**
 * Resolve login identifier (email or username) to an email address.
 * @param {string} identifier
 */
async function resolveEmail(identifier) {
	const raw = identifier.trim();
	if (!raw) throw new Error('Email or username is required');
	if (raw.includes('@')) return raw.toLowerCase();

	const supabase = getSupabase();
	const { data, error } = await supabase.rpc('email_for_login', { identifier: raw });
	if (error) throw error;
	if (!data) throw new Error('No account found for that username');
	return data;
}

/**
 * @param {{
 *   email: string,
 *   password: string,
 *   username: string,
 *   firstName: string,
 *   lastName: string
 * }} fields
 */
export async function signUpWithPassword(fields) {
	const email = fields.email.trim().toLowerCase();
	const username = fields.username.trim();
	const password = fields.password;
	const firstName = fields.firstName.trim();
	const lastName = fields.lastName.trim();

	if (!email || !password || !username) {
		throw new Error('Email, username, and password are required');
	}
	if (username.length < 3) throw new Error('Username must be at least 3 characters');
	if (password.length < 6) throw new Error('Password must be at least 6 characters');

	const supabase = getSupabase();
	const { data, error } = await supabase.auth.signUp({
		email,
		password,
		options: {
			data: {
				username,
				first_name: firstName,
				last_name: lastName,
				full_name: [firstName, lastName].filter(Boolean).join(' ')
			}
		}
	});
	if (error) throw error;

	if (data.session) {
		await setAuthSession(data.session);
	}

	return data;
}

/**
 * Sign in with email or username + password.
 * @param {string} identifier
 * @param {string} password
 */
export async function signInWithPassword(identifier, password) {
	if (!password) throw new Error('Password is required');
	const email = await resolveEmail(identifier);

	const supabase = getSupabase();
	const { data, error } = await supabase.auth.signInWithPassword({ email, password });
	if (error) throw error;

	await setAuthSession(data.session);
	return data;
}

/** Optional Google OAuth (when configured in Supabase). */
export async function signInWithGoogle() {
	const supabase = getSupabase();
	const redirectTo = `${window.location.origin}/auth/callback`;
	const { data, error } = await supabase.auth.signInWithOAuth({
		provider: 'google',
		options: { redirectTo }
	});
	if (error) throw error;
	return data;
}

export async function signOut() {
	const supabase = getSupabase();
	const { error } = await supabase.auth.signOut();
	if (error) throw error;
	await setAuthSession(null);
}

/**
 * @param {string} userId
 */
export async function getUserProfile(userId) {
	const supabase = getSupabase();
	const { data, error } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
	if (error) throw error;
	return data;
}

/**
 * @param {import('@supabase/supabase-js').Session} session
 */
export async function syncProviderToken(session) {
	const token = session.provider_token;
	if (!token || !session.user) return;

	const supabase = getSupabase();
	await supabase
		.from('users')
		.update({
			auth_provider: 'google',
			auth_provider_token: token
		})
		.eq('id', session.user.id);
}
