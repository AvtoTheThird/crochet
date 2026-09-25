import { jsonResponse, optionsResponse } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import {
	processRefundPlaceholder,
	processSuccessfulPayment
} from '../_shared/processPayment.ts';

/**
 * Payment provider webhook entrypoint (Flitt later).
 *
 * Intentionally does NOT parse or trust a fabricated Flitt payload.
 * When Flitt docs/credentials are finalized:
 * 1. Verify callback signature / authenticity using documented rules.
 * 2. Map verified fields into SuccessfulPaymentInput.
 * 3. Call processSuccessfulPayment(admin, input).
 * 4. Return HTTP 200 only after durable processing (or confirmed duplicate).
 *
 * Failed payments must not call processSuccessfulPayment.
 * Refunds should use a compensating ledger path (see processRefundPlaceholder).
 */
Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') return optionsResponse();
	if (req.method !== 'POST') {
		return jsonResponse({ error: 'method_not_allowed' }, 405);
	}

	const providerHeader = req.headers.get('x-payment-provider') ?? 'unknown';

	try {
		// Keep raw body available for future signature verification.
		const rawBody = await req.text();
		let payload: unknown = null;
		try {
			payload = rawBody ? JSON.parse(rawBody) : null;
		} catch {
			payload = null;
		}

		// --- Flitt integration seam (not implemented yet) ---
		// const verified = await verifyFlittCallback(rawBody, req.headers);
		// if (!verified.ok) return jsonResponse({ error: 'invalid_signature' }, 401);
		// const input = mapFlittToSuccessfulPayment(verified);
		// const admin = createServiceClient();
		// const result = await processSuccessfulPayment(admin, input);
		// return jsonResponse({ ok: true, result });

		void processSuccessfulPayment;
		void processRefundPlaceholder;
		void createServiceClient;
		void payload;
		void providerHeader;

		return jsonResponse(
			{
				ok: false,
				error: 'payment_provider_not_configured',
				message:
					'Webhook received, but Flitt (or other provider) verification is not configured yet. ' +
					'Wire signature validation + payload mapping, then call processSuccessfulPayment.',
				expectedInputFields: [
					'userId',
					'provider',
					'providerPaymentId',
					'productTier',
					'amount',
					'currency',
					'eligibleAmount?',
					'subscriptionId?',
					'providerOrderId?',
					'paidAt?',
					'metadata?'
				]
			},
			501
		);
	} catch (e) {
		console.error('payment-webhook', e);
		return jsonResponse(
			{ ok: false, error: e instanceof Error ? e.message : 'server_error' },
			500
		);
	}
});
