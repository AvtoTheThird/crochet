import { jsonResponse, optionsResponse } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/supabase.ts';

/**
 * POST { code: string }
 * Validates an active referral code for cookie capture.
 * Does not create attribution and does not expose commission percentages.
 */
Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') return optionsResponse();
	if (req.method !== 'POST') {
		return jsonResponse({ error: 'method_not_allowed' }, 405);
	}

	try {
		const body = await req.json().catch(() => ({}));
		const code = typeof body.code === 'string' ? body.code : '';

		const admin = createServiceClient();
		const { data, error } = await admin.rpc('lookup_active_referral_code', {
			p_code: code
		});
		if (error) throw error;

		return jsonResponse(data ?? { valid: false, reason: 'unknown' });
	} catch (e) {
		console.error('validate-referral-code', e);
		return jsonResponse(
			{ valid: false, error: e instanceof Error ? e.message : 'server_error' },
			500
		);
	}
});
