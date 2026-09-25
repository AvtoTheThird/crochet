import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let client = null;

/** Service-role client. Server-only. Bypasses RLS. */
export function getAdminSupabase() {
	if (client) return client;

	const url = env.SUPABASE_URL?.trim();
	const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
	if (!url || !key) {
		throw new Error(
			'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in mari-admin/.env'
		);
	}

	client = createClient(url, key, {
		auth: { persistSession: false, autoRefreshToken: false }
	});
	return client;
}
