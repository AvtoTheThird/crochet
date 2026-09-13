/**
 * Browser Supabase client (SPA).
 */
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/public';

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let client = null;

export function getSupabase() {
	if (client) return client;

	const url = env.PUBLIC_SUPABASE_URL?.trim();
	const key = env.PUBLIC_SUPABASE_ANON_KEY?.trim();

	if (!url || !key) {
		throw new Error(
			'Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY in .env (no spaces around =).'
		);
	}

	client = createClient(url, key, {
		auth: {
			autoRefreshToken: true,
			persistSession: true,
			detectSessionInUrl: true,
			flowType: 'pkce'
		}
	});

	return client;
}
