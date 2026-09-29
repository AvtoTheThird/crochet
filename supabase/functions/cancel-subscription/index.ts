import { jsonResponse, optionsResponse } from '../_shared/cors.ts';
import { createServiceClient, createUserClient } from '../_shared/supabase.ts';

/**
 * POST (no body required)
 * Requires Authorization: Bearer <user access token>
 *
 * Cancels the caller's active subscription at the end of the current billing
 * period (they keep access until then). Uses the Paddle server API key, which
 * must never live in client code. Entitlement changes are applied by the
 * resulting Paddle webhook (subscription.updated / subscription.canceled).
 */
function paddleApiBase(): string {
	const env = (Deno.env.get('PADDLE_ENVIRONMENT') || '').toLowerCase();
	if (env !== 'sandbox' && env !== 'production') {
		throw new Error('PADDLE_ENVIRONMENT must be "sandbox" or "production"');
	}
	return env === 'production' ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com';
}

const ACTIVE_STATUSES = ['active', 'trialing', 'past_due'];

Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') return optionsResponse();
	if (req.method !== 'POST') {
		return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
	}

	try {
		const authHeader = req.headers.get('Authorization');
		if (!authHeader) {
			return jsonResponse({ ok: false, error: 'not_authenticated' }, 401);
		}

		const userClient = createUserClient(authHeader);
		const { data: userData, error: userErr } = await userClient.auth.getUser();
		if (userErr || !userData.user) {
			return jsonResponse({ ok: false, error: 'not_authenticated' }, 401);
		}
		const userId = userData.user.id;

		const apiKey = Deno.env.get('PADDLE_API_KEY');
		if (!apiKey) {
			console.error('cancel-subscription: PADDLE_API_KEY is not set');
			return jsonResponse({ ok: false, error: 'server_misconfigured' }, 500);
		}
		const base = paddleApiBase();

		// Look up the caller's most recent active subscription (service role so we
		// can read the mirror regardless of RLS; still scoped to this user_id).
		const admin = createServiceClient();
		const { data: sub, error: subErr } = await admin
			.from('subscriptions')
			.select('provider_subscription_id, status, scheduled_change_action')
			.eq('user_id', userId)
			.in('status', ACTIVE_STATUSES)
			.order('updated_at', { ascending: false })
			.limit(1)
			.maybeSingle();
		if (subErr) {
			console.error('cancel-subscription: lookup failed', subErr);
			return jsonResponse({ ok: false, error: 'lookup_failed' }, 500);
		}
		if (!sub?.provider_subscription_id) {
			return jsonResponse({ ok: false, error: 'no_active_subscription' }, 404);
		}
		if (sub.scheduled_change_action === 'cancel') {
			return jsonResponse({ ok: true, already_scheduled: true });
		}

		const res = await fetch(
			`${base}/subscriptions/${sub.provider_subscription_id}/cancel`,
			{
				method: 'POST',
				headers: {
					Authorization: `Bearer ${apiKey}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ effective_from: 'next_billing_period' })
			}
		);

		const payload = await res.json().catch(() => null);
		if (!res.ok) {
			console.error('cancel-subscription: paddle error', res.status, payload);
			const detail = payload?.error?.detail || 'Paddle rejected the cancellation';
			return jsonResponse({ ok: false, error: detail }, 502);
		}

		const scheduledAt = payload?.data?.scheduled_change?.effective_at ?? null;
		return jsonResponse({ ok: true, effective_at: scheduledAt });
	} catch (e) {
		console.error('cancel-subscription', e);
		return jsonResponse(
			{ ok: false, error: e instanceof Error ? e.message : 'server_error' },
			500
		);
	}
});
