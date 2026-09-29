import { jsonResponse, optionsResponse } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import {
	processSuccessfulPayment,
	recordFailedPayment,
	resolveUserId,
	upsertSubscription
} from '../_shared/processPayment.ts';
import {
	mapSubscriptionEvent,
	mapTransactionToPayment,
	parsePriceTierMap,
	verifyPaddleSignature,
	type PaddleEvent
} from '../_shared/paddle.ts';
import { checkPaddleIp } from '../_shared/paddleIps.ts';

/**
 * Paddle webhook entrypoint.
 *
 * Security: verifies the `Paddle-Signature` header against PADDLE_WEBHOOK_SECRET
 * before trusting anything. Returns 401 on bad signatures, 2xx after durable
 * processing (or a safe no-op), and 5xx only on unexpected errors so Paddle retries.
 *
 * Environment is read explicitly and never defaulted — if PADDLE_ENVIRONMENT is
 * unset we fail loudly so we can't process events against the wrong account.
 */
Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') return optionsResponse();
	if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

	// --- Fail loudly on missing config ---
	const environment = Deno.env.get('PADDLE_ENVIRONMENT')?.trim();
	if (!environment) {
		console.error('payment-webhook: PADDLE_ENVIRONMENT is not set');
		return jsonResponse({ ok: false, error: 'paddle_environment_not_set' }, 500);
	}
	if (environment !== 'sandbox' && environment !== 'production') {
		console.error(`payment-webhook: invalid PADDLE_ENVIRONMENT "${environment}"`);
		return jsonResponse({ ok: false, error: 'paddle_environment_invalid' }, 500);
	}
	const secret = Deno.env.get('PADDLE_WEBHOOK_SECRET')?.trim();
	if (!secret) {
		console.error('payment-webhook: PADDLE_WEBHOOK_SECRET is not set');
		return jsonResponse({ ok: false, error: 'paddle_webhook_secret_not_set' }, 500);
	}
	const priceTierMap = parsePriceTierMap(Deno.env.get('PADDLE_PRICE_TIER_MAP'));

	try {
		// --- IP allowlist (defense-in-depth; signature is the primary auth) ---
		// Source IPs are fetched live from Paddle's endpoint, never hard-coded.
		const ipCheck = await checkPaddleIp(req, environment);
		if (ipCheck.checked && !ipCheck.allowed) {
			console.warn('payment-webhook: rejected non-Paddle source IP:', ipCheck.ip);
			return jsonResponse({ ok: false, error: 'ip_not_allowed' }, 403);
		}

		// Raw body is required for signature verification — never re-serialize.
		const rawBody = await req.text();
		const signature = req.headers.get('Paddle-Signature') ?? req.headers.get('paddle-signature');

		const verified = await verifyPaddleSignature(rawBody, signature, secret);
		if (!verified.ok) {
			console.warn('payment-webhook: signature verification failed:', verified.reason);
			return jsonResponse({ ok: false, error: 'invalid_signature', reason: verified.reason }, 401);
		}

		const event = (rawBody ? JSON.parse(rawBody) : {}) as PaddleEvent;
		const type = event.event_type ?? 'unknown';
		const admin = createServiceClient();

		// ------------------------------------------------ transactions
		if (type === 'transaction.completed') {
			const { input, reason } = mapTransactionToPayment(event, priceTierMap);
			if (!input) {
				console.warn('payment-webhook: transaction.completed skipped:', reason);
				return jsonResponse({ ok: true, ignored: true, reason }, 200);
			}

			const userId =
				input.userId ||
				(await resolveUserId(admin, {
					subscriptionId: input.subscriptionId,
					paddleCustomerId: (input.metadata?.paddle_customer_id as string) ?? null
				}));

			if (!userId) {
				console.error('payment-webhook: could not resolve user for', input.providerPaymentId);
				// Ack so Paddle doesn't retry forever; surfaced for manual reconciliation.
				return jsonResponse({ ok: false, error: 'user_unresolved', event_type: type }, 200);
			}

			const result = await processSuccessfulPayment(admin, { ...input, userId });
			return jsonResponse({ ok: true, event_type: type, result }, 200);
		}

		if (type === 'transaction.payment_failed') {
			const t = event.data;
			const currency = t?.currency_code ?? 'USD';
			const userId = await resolveUserId(admin, {
				customUserId: t?.custom_data?.user_id ?? null,
				subscriptionId: t?.subscription_id ?? null,
				paddleCustomerId: t?.customer_id ?? null
			});
			const totals = t?.details?.totals ?? {};
			const amount = Number(totals.grand_total ?? totals.total ?? 0) / 100;
			const result = await recordFailedPayment(admin, {
				userId,
				provider: 'paddle',
				providerPaymentId: t?.id,
				subscriptionId: t?.subscription_id ?? null,
				amount,
				currency,
				metadata: { event_id: event.event_id ?? null, paddle_customer_id: t?.customer_id ?? null }
			});
			return jsonResponse({ ok: true, event_type: type, result }, 200);
		}

		// ------------------------------------------------ subscription lifecycle
		if (type.startsWith('subscription.')) {
			const mirror = mapSubscriptionEvent(event, priceTierMap);
			if (!mirror) {
				return jsonResponse({ ok: true, ignored: true, reason: 'no_subscription_id' }, 200);
			}
			const result = await upsertSubscription(admin, mirror);
			return jsonResponse({ ok: true, event_type: type, result }, 200);
		}

		// ------------------------------------------------ everything else
		return jsonResponse({ ok: true, ignored: true, event_type: type }, 200);
	} catch (e) {
		// 5xx → Paddle will retry with backoff.
		console.error('payment-webhook error:', e);
		return jsonResponse({ ok: false, error: e instanceof Error ? e.message : 'server_error' }, 500);
	}
});
