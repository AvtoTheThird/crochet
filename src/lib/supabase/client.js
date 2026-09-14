/**
 * Browser Supabase client (SPA).
 * Uses $env/static/public so values are baked in at build time (required for ssr=false).
 * Set PUBLIC_* vars in Cloudflare Build variables (not only Worker runtime vars).
 */
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let client = null;

export function getSupabase() {
	if (client) return client;

	const url = PUBLIC_SUPABASE_URL?.trim();
	const key = PUBLIC_SUPABASE_ANON_KEY?.trim();

	if (!url || !key) {
		throw new Error(
			'Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY. Set them for the Vite build (local .env or Cloudflare Build variables).'
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
