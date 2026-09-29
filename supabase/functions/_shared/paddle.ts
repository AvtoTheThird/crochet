/**
 * Paddle webhook helpers: signature verification, money conversion, and
 * pure mapping from Paddle event payloads into our DB-shaped inputs.
 *
 * No DB access here — see processPayment.ts for persistence.
 */

import type { ProductTier, SuccessfulPaymentInput } from './processPayment.ts';

// ------------------------------------------------------------------ signature

/**
 * Verify a Paddle webhook signature.
 * Header format: `ts=1700000000;h1=<hex hmac sha256>`.
 * Signed payload is `${ts}:${rawBody}`, keyed with the destination secret.
 * @param rawBody exact request body string (do NOT re-serialize)
 * @param signatureHeader value of the `Paddle-Signature` header
 * @param secret notification destination secret (endpoint_secret_key, `pdl_ntfset_...`/`ntfset_...`)
 * @param toleranceSeconds max allowed clock skew (0 disables the check)
 */
export async function verifyPaddleSignature(
	rawBody: string,
	signatureHeader: string | null,
	secret: string,
	toleranceSeconds = 300
): Promise<{ ok: boolean; reason?: string }> {
	if (!signatureHeader) return { ok: false, reason: 'missing_signature_header' };
	if (!secret) return { ok: false, reason: 'missing_secret' };

	const parts: Record<string, string> = {};
	for (const seg of signatureHeader.split(';')) {
		const idx = seg.indexOf('=');
		if (idx === -1) continue;
		parts[seg.slice(0, idx).trim()] = seg.slice(idx + 1).trim();
	}

	const ts = parts['ts'];
	const h1 = parts['h1'];
	if (!ts || !h1) return { ok: false, reason: 'malformed_signature_header' };

	if (toleranceSeconds > 0) {
		const tsNum = Number(ts);
		if (!Number.isFinite(tsNum)) return { ok: false, reason: 'bad_timestamp' };
		const skew = Math.abs(Date.now() / 1000 - tsNum);
		if (skew > toleranceSeconds) return { ok: false, reason: 'timestamp_out_of_tolerance' };
	}

	const enc = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		enc.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(`${ts}:${rawBody}`));
	const expected = [...new Uint8Array(sigBuf)]
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');

	return { ok: timingSafeEqualHex(expected, h1), reason: 'signature_mismatch' };
}

function timingSafeEqualHex(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

// ------------------------------------------------------------------ money

/** Currencies Paddle represents with 0 decimal places (amount is already major). */
const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW', 'CLP', 'VND']);

/**
 * Convert a Paddle minor-unit amount string (e.g. "3999") to a major-unit
 * number (e.g. 39.99). Handles common zero-decimal currencies.
 */
export function minorToMajor(amount: string | number | null | undefined, currency: string): number {
	const n = Number(amount ?? 0);
	if (!Number.isFinite(n)) return 0;
	if (ZERO_DECIMAL_CURRENCIES.has((currency || '').toUpperCase())) return n;
	return Math.round(n) / 100;
}

// ------------------------------------------------------------------ tier map

export type PriceTierMap = Record<string, ProductTier>;

/** Parse PADDLE_PRICE_TIER_MAP env JSON: { "pri_...": "maker" | "lifetime" }. */
export function parsePriceTierMap(json: string | undefined | null): PriceTierMap {
	if (!json) return {};
	try {
		const raw = JSON.parse(json) as Record<string, string>;
		const out: PriceTierMap = {};
		for (const [priceId, tier] of Object.entries(raw)) {
			if (tier === 'maker' || tier === 'lifetime') out[priceId] = tier;
		}
		return out;
	} catch {
		return {};
	}
}

export function tierForPriceId(
	priceId: string | null | undefined,
	map: PriceTierMap
): ProductTier | null {
	if (!priceId) return null;
	return map[priceId] ?? null;
}

// ------------------------------------------------------------------ event types

export type PaddleEvent = {
	event_id?: string;
	event_type?: string;
	occurred_at?: string;
	notification_id?: string;
	// deno-lint-ignore no-explicit-any
	data?: any;
};

// deno-lint-ignore no-explicit-any
function customUserId(customData: any): string | null {
	const v = customData?.user_id ?? customData?.userId ?? null;
	return typeof v === 'string' && v.length > 0 ? v : null;
}

// deno-lint-ignore no-explicit-any
function customTier(customData: any): ProductTier | null {
	const v = customData?.product_tier ?? customData?.productTier ?? null;
	return v === 'maker' || v === 'lifetime' ? v : null;
}

/** First recurring/relevant item's price + product ids from a subscription/transaction. */
// deno-lint-ignore no-explicit-any
function primaryItem(items: any[]): { priceId: string | null; productId: string | null } {
	const first = Array.isArray(items) ? items[0] : null;
	const price = first?.price ?? null;
	return {
		priceId: price?.id ?? null,
		productId: price?.product_id ?? null
	};
}

// ------------------------------------------------------------------ mappers

/**
 * Map a `transaction.completed` event to a SuccessfulPaymentInput.
 * Returns null (with a reason) if it can't be safely processed.
 */
export function mapTransactionToPayment(
	event: PaddleEvent,
	priceTierMap: PriceTierMap
): { input: SuccessfulPaymentInput | null; reason?: string } {
	const t = event.data;
	if (!t?.id) return { input: null, reason: 'no_transaction_id' };

	const currency = t.currency_code ?? 'USD';
	const totals = t.details?.totals ?? {};
	const gross = minorToMajor(totals.grand_total ?? totals.total, currency);
	// Commission base = subtotal (ex-tax). Falls back to gross if missing.
	const eligible =
		totals.subtotal != null ? minorToMajor(totals.subtotal, currency) : gross;

	const { priceId } = primaryItem(t.items ?? []);
	const productTier = tierForPriceId(priceId, priceTierMap) ?? customTier(t.custom_data);
	if (!productTier) return { input: null, reason: 'unknown_product_tier' };

	const userId = customUserId(t.custom_data);

	const input: SuccessfulPaymentInput = {
		userId: userId ?? '', // resolved/validated by caller if empty
		provider: 'paddle',
		providerPaymentId: t.id,
		providerOrderId: t.invoice_id ?? null,
		subscriptionId: t.subscription_id ?? null,
		productTier,
		amount: gross,
		eligibleAmount: eligible,
		currency,
		paidAt: t.billed_at ?? event.occurred_at ?? null,
		metadata: {
			paddle_customer_id: t.customer_id ?? null,
			price_id: priceId,
			event_id: event.event_id ?? null,
			origin: t.origin ?? null
		}
	};
	return { input };
}

export type SubscriptionMirrorInput = {
	provider: 'paddle';
	providerSubscriptionId: string;
	providerCustomerId: string | null;
	userId: string | null;
	status: string;
	productTier: ProductTier | null;
	priceId: string | null;
	productId: string | null;
	currency: string | null;
	scheduledChangeAction: string | null;
	scheduledChangeAt: string | null;
	currentPeriodStart: string | null;
	currentPeriodEnd: string | null;
	canceledAt: string | null;
	metadata: Record<string, unknown>;
};

/** Map any `subscription.*` event to our subscription mirror shape. */
export function mapSubscriptionEvent(
	event: PaddleEvent,
	priceTierMap: PriceTierMap
): SubscriptionMirrorInput | null {
	const s = event.data;
	if (!s?.id) return null;

	const { priceId, productId } = primaryItem(s.items ?? []);
	const productTier = tierForPriceId(priceId, priceTierMap) ?? customTier(s.custom_data);

	return {
		provider: 'paddle',
		providerSubscriptionId: s.id,
		providerCustomerId: s.customer_id ?? null,
		userId: customUserId(s.custom_data),
		status: s.status,
		productTier,
		priceId,
		productId,
		currency: s.currency_code ?? null,
		scheduledChangeAction: s.scheduled_change?.action ?? null,
		scheduledChangeAt: s.scheduled_change?.effective_at ?? null,
		currentPeriodStart: s.current_billing_period?.starts_at ?? null,
		currentPeriodEnd: s.current_billing_period?.ends_at ?? null,
		canceledAt: s.canceled_at ?? null,
		metadata: {
			event_id: event.event_id ?? null,
			event_type: event.event_type ?? null
		}
	};
}
