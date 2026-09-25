import { jsonResponse, optionsResponse } from '../_shared/cors.ts';
import { createUserClient } from '../_shared/supabase.ts';

/**
 * POST { code: string, source: 'cookie' | 'manual' }
 * Requires Authorization: Bearer <user access token>
 *
 * Manual source overrides unlocked cookie attribution.
 * Cookie source never overrides an existing attribution.
 * Locked attributions (after first earn commission) cannot change.
 */
Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') return optionsResponse();
	if (req.method !== 'POST') {
		return jsonResponse({ error: 'method_not_allowed' }, 405);
	}

	try {
		const authHeader = req.headers.get('Authorization');
		if (!authHeader) {
			return jsonResponse({ ok: false, error: 'not_authenticated' }, 401);
		}

		const body = await req.json().catch(() => ({}));
		const code = typeof body.code === 'string' ? body.code : '';
		const source = typeof body.source === 'string' ? body.source : '';

		if (source !== 'cookie' && source !== 'manual') {
			return jsonResponse({ ok: false, error: 'invalid_source' }, 400);
		}

		const userClient = createUserClient(authHeader);
		const { data: userData, error: userErr } = await userClient.auth.getUser();
		if (userErr || !userData.user) {
			return jsonResponse({ ok: false, error: 'not_authenticated' }, 401);
		}

		const { data, error } = await userClient.rpc('apply_referral_attribution', {
			p_code: code,
			p_source: source
		});
		if (error) {
			return jsonResponse(
				{ ok: false, error: error.message, code: error.code },
				400
			);
		}

		return jsonResponse(data ?? { ok: false, reason: 'unknown' });
	} catch (e) {
		console.error('apply-referral', e);
		return jsonResponse(
			{ ok: false, error: e instanceof Error ? e.message : 'server_error' },
			500
		);
	}
});
