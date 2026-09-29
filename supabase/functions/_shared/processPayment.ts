/**
 * Provider-agnostic successful-payment processing.
 *
 * Flitt (or any provider) webhook handlers should:
 * 1. Authenticate/verify the provider callback (signature, etc.) — NOT implemented here.
 * 2. Map the provider payload into a SuccessfulPaymentInput.
 * 3. Call processSuccessfulPayment().
 *
 * Idempotency is enforced by payments(provider, provider_payment_id) and
 * affiliate_commissions unique earn indexes.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
	subscriptionStatusGrantsAccess,
	subscriptionStatusRevokesAccess
} from './access.ts';
import type { SubscriptionMirrorInput } from './paddle.ts';

export type ProductTier = 'maker' | 'lifetime';

export type SuccessfulPaymentInput = {
	userId: string;
	provider: string;
	providerPaymentId: string;
	providerOrderId?: string | null;
	subscriptionId?: string | null;
	productTier: ProductTier;
	/** Gross amount charged by the provider */
	amount: number;
	/**
	 * Eligible revenue for affiliate commission. Defaults to amount.
	 * Later: subtract fees/taxes here without changing ledger shape.
	 */
	eligibleAmount?: number;
	currency: string;
	paidAt?: string | null;
	metadata?: Record<string, unknown>;
	/** Hold period before commission is payout-eligible (days). Default 30. */
	commissionHoldDays?: number;
};

export type ProcessPaymentResult = {
	paymentId: string;
	alreadyProcessed: boolean;
	entitlementApplied: boolean;
	commissionId: string | null;
	commissionSkippedReason: string | null;
};

function roundMoney(n: number): number {
	return Math.round(n * 100) / 100;
}

/**
 * Upsert payment, apply entitlement, create affiliate earn commission if attributed.
 * Safe to call repeatedly for the same provider payment id.
 */
export async function processSuccessfulPayment(
	admin: SupabaseClient,
	input: SuccessfulPaymentInput
): Promise<ProcessPaymentResult> {
	const eligible =
		input.eligibleAmount === undefined || input.eligibleAmount === null
			? input.amount
			: input.eligibleAmount;
	const paidAt = input.paidAt ?? new Date().toISOString();
	const holdDays = input.commissionHoldDays ?? 30;

	const { data: existing, error: existingErr } = await admin
		.from('payments')
		.select('id, processed_at, status')
		.eq('provider', input.provider)
		.eq('provider_payment_id', input.providerPaymentId)
		.maybeSingle();

	if (existingErr) throw existingErr;

	if (existing?.processed_at) {
		return {
			paymentId: existing.id,
			alreadyProcessed: true,
			entitlementApplied: false,
			commissionId: null,
			commissionSkippedReason: 'already_processed'
		};
	}

	let paymentId = existing?.id as string | undefined;

	if (!paymentId) {
		const { data: inserted, error: insertErr } = await admin
			.from('payments')
			.insert({
				user_id: input.userId,
				provider: input.provider,
				provider_payment_id: input.providerPaymentId,
				provider_order_id: input.providerOrderId ?? null,
				subscription_id: input.subscriptionId ?? null,
				product_tier: input.productTier,
				amount: input.amount,
				eligible_amount: eligible,
				currency: input.currency,
				status: 'succeeded',
				paid_at: paidAt,
				metadata: input.metadata ?? {}
			})
			.select('id')
			.single();

		if (insertErr) {
			// Race: another webhook inserted first — re-read
			const { data: raced, error: raceErr } = await admin
				.from('payments')
				.select('id, processed_at')
				.eq('provider', input.provider)
				.eq('provider_payment_id', input.providerPaymentId)
				.maybeSingle();
			if (raceErr) throw raceErr;
			if (!raced) throw insertErr;
			if (raced.processed_at) {
				return {
					paymentId: raced.id,
					alreadyProcessed: true,
					entitlementApplied: false,
					commissionId: null,
					commissionSkippedReason: 'already_processed'
				};
			}
			paymentId = raced.id;
		} else {
			paymentId = inserted.id;
		}
	} else {
		const { error: updErr } = await admin
			.from('payments')
			.update({
				status: 'succeeded',
				product_tier: input.productTier,
				amount: input.amount,
				eligible_amount: eligible,
				currency: input.currency,
				paid_at: paidAt,
				subscription_id: input.subscriptionId ?? null,
				provider_order_id: input.providerOrderId ?? null,
				metadata: input.metadata ?? {}
			})
			.eq('id', paymentId);
		if (updErr) throw updErr;
	}

	// Entitlement: only via service role (column grants block client updates)
	const { error: tierErr } = await admin
		.from('users')
		.update({
			subscription_tier: input.productTier,
			subscription_updated_at: new Date().toISOString()
		})
		.eq('id', input.userId);
	if (tierErr) throw tierErr;

	let commissionId: string | null = null;
	let commissionSkippedReason: string | null = null;

	const { data: referral, error: refErr } = await admin
		.from('user_referrals')
		.select('creator_id, referral_code_id')
		.eq('user_id', input.userId)
		.maybeSingle();
	if (refErr) throw refErr;

	if (!referral) {
		commissionSkippedReason = 'no_referral';
	} else {
		const { data: creator, error: creatorErr } = await admin
			.from('creators')
			.select('id, commission_percentage_cut')
			.eq('id', referral.creator_id)
			.single();
		if (creatorErr) throw creatorErr;

		const pct = Number(creator.commission_percentage_cut);
		const commission = roundMoney((Number(eligible) * pct) / 100);
		const availableAt = new Date(
			Date.now() + holdDays * 24 * 60 * 60 * 1000
		).toISOString();

		const { data: commissionRow, error: commissionErr } = await admin
			.from('affiliate_commissions')
			.insert({
				creator_id: creator.id,
				user_id: input.userId,
				payment_id: paymentId,
				payment_provider: input.provider,
				provider_payment_id: input.providerPaymentId,
				subscription_id: input.subscriptionId ?? null,
				amount: eligible,
				commission_percentage: pct,
				commission,
				currency: input.currency,
				entry_kind: 'earn',
				status: 'pending',
				available_at: availableAt
			})
			.select('id')
			.maybeSingle();

		if (commissionErr) {
			// Unique violation → already created (idempotent)
			if (commissionErr.code === '23505') {
				commissionSkippedReason = 'commission_already_exists';
			} else {
				throw commissionErr;
			}
		} else {
			commissionId = commissionRow?.id ?? null;
		}
	}

	const { error: processedErr } = await admin
		.from('payments')
		.update({ processed_at: new Date().toISOString() })
		.eq('id', paymentId)
		.is('processed_at', null);
	if (processedErr) throw processedErr;

	return {
		paymentId: paymentId!,
		alreadyProcessed: false,
		entitlementApplied: true,
		commissionId,
		commissionSkippedReason
	};
}

/**
 * Resolve our internal users.id for a webhook event.
 * Priority: explicit custom_data user id → existing mirrored subscription →
 * existing payment for the same Paddle customer. Returns null if unresolved.
 */
export async function resolveUserId(
	admin: SupabaseClient,
	opts: {
		customUserId?: string | null;
		subscriptionId?: string | null;
		paddleCustomerId?: string | null;
	}
): Promise<string | null> {
	if (opts.customUserId) return opts.customUserId;

	if (opts.subscriptionId) {
		const { data } = await admin
			.from('subscriptions')
			.select('user_id')
			.eq('provider', 'paddle')
			.eq('provider_subscription_id', opts.subscriptionId)
			.maybeSingle();
		if (data?.user_id) return data.user_id as string;
	}

	if (opts.paddleCustomerId) {
		const { data } = await admin
			.from('subscriptions')
			.select('user_id')
			.eq('provider', 'paddle')
			.eq('provider_customer_id', opts.paddleCustomerId)
			.not('user_id', 'is', null)
			.limit(1)
			.maybeSingle();
		if (data?.user_id) return data.user_id as string;
	}

	return null;
}

/**
 * Record a declined/failed payment for visibility. Never grants entitlement or
 * commission. Idempotent on (provider, provider_payment_id).
 */
export async function recordFailedPayment(
	admin: SupabaseClient,
	input: {
		userId: string | null;
		provider: string;
		providerPaymentId: string;
		subscriptionId?: string | null;
		productTier?: ProductTier | null;
		amount: number;
		currency: string;
		metadata?: Record<string, unknown>;
	}
): Promise<{ paymentId: string | null; recorded: boolean }> {
	const { data: existing } = await admin
		.from('payments')
		.select('id, processed_at, status')
		.eq('provider', input.provider)
		.eq('provider_payment_id', input.providerPaymentId)
		.maybeSingle();

	// Never downgrade an already-succeeded/processed payment.
	if (existing?.processed_at || existing?.status === 'succeeded') {
		return { paymentId: existing.id, recorded: false };
	}

	if (existing?.id) {
		const { error } = await admin
			.from('payments')
			.update({ status: 'failed', metadata: input.metadata ?? {} })
			.eq('id', existing.id);
		if (error) throw error;
		return { paymentId: existing.id, recorded: true };
	}

	if (!input.userId) {
		// Can't insert without a user (NOT NULL). Nothing to store, but not fatal.
		return { paymentId: null, recorded: false };
	}

	const { data: inserted, error } = await admin
		.from('payments')
		.insert({
			user_id: input.userId,
			provider: input.provider,
			provider_payment_id: input.providerPaymentId,
			subscription_id: input.subscriptionId ?? null,
			product_tier: input.productTier ?? null,
			amount: input.amount,
			currency: input.currency,
			status: 'failed',
			metadata: input.metadata ?? {}
		})
		.select('id')
		.single();
	if (error) throw error;
	return { paymentId: inserted.id, recorded: true };
}

export type SubscriptionSyncResult = {
	subscriptionId: string;
	userId: string | null;
	status: string;
	entitlement: 'granted' | 'revoked' | 'unchanged';
	tier: string | null;
};

/**
 * Upsert the subscription mirror and apply the resulting entitlement.
 *
 * Access rules:
 *  - active/trialing/past_due  → grant product_tier
 *  - paused/canceled           → revoke (back to 'free')
 *  - a scheduled cancel/pause while status stays active is NOT terminal:
 *    access is preserved because we key entitlement off `status`.
 *  - a 'lifetime' entitlement (one-time purchase) is never downgraded here.
 */
export async function upsertSubscription(
	admin: SupabaseClient,
	m: SubscriptionMirrorInput
): Promise<SubscriptionSyncResult> {
	const { data: existing } = await admin
		.from('subscriptions')
		.select('id, user_id, product_tier')
		.eq('provider', m.provider)
		.eq('provider_subscription_id', m.providerSubscriptionId)
		.maybeSingle();

	const userId =
		m.userId ??
		(existing?.user_id as string | null) ??
		(await resolveUserId(admin, {
			subscriptionId: m.providerSubscriptionId,
			paddleCustomerId: m.providerCustomerId
		}));

	const productTier = m.productTier ?? (existing?.product_tier as ProductTier | null) ?? null;

	const row = {
		provider: m.provider,
		provider_subscription_id: m.providerSubscriptionId,
		provider_customer_id: m.providerCustomerId,
		user_id: userId,
		status: m.status,
		product_tier: productTier,
		price_id: m.priceId,
		product_id: m.productId,
		currency: m.currency,
		scheduled_change_action: m.scheduledChangeAction,
		scheduled_change_at: m.scheduledChangeAt,
		current_period_start: m.currentPeriodStart,
		current_period_end: m.currentPeriodEnd,
		canceled_at: m.canceledAt,
		metadata: m.metadata ?? {}
	};

	const { error: upsertErr } = await admin
		.from('subscriptions')
		.upsert(row, { onConflict: 'provider,provider_subscription_id' });
	if (upsertErr) throw upsertErr;

	let entitlement: 'granted' | 'revoked' | 'unchanged' = 'unchanged';
	let tier: string | null = null;

	if (userId) {
		if (subscriptionStatusGrantsAccess(m.status) && productTier) {
			// Don't clobber a permanent lifetime entitlement with a lower tier.
			const { data: u } = await admin
				.from('users')
				.select('subscription_tier')
				.eq('id', userId)
				.maybeSingle();
			if (u?.subscription_tier !== 'lifetime') {
				const { error } = await admin
					.from('users')
					.update({ subscription_tier: productTier, subscription_updated_at: new Date().toISOString() })
					.eq('id', userId);
				if (error) throw error;
				entitlement = 'granted';
				tier = productTier;
			} else {
				tier = 'lifetime';
			}
		} else if (subscriptionStatusRevokesAccess(m.status)) {
			const { data: u } = await admin
				.from('users')
				.select('subscription_tier')
				.eq('id', userId)
				.maybeSingle();
			if (u?.subscription_tier !== 'lifetime') {
				const { error } = await admin
					.from('users')
					.update({ subscription_tier: 'free', subscription_updated_at: new Date().toISOString() })
					.eq('id', userId);
				if (error) throw error;
				entitlement = 'revoked';
				tier = 'free';
			} else {
				tier = 'lifetime';
			}
		}
	}

	return {
		subscriptionId: m.providerSubscriptionId,
		userId,
		status: m.status,
		entitlement,
		tier
	};
}

/**
 * Placeholder for future refund handling.
 * Do not delete earn rows — insert a reversal entry and mark the earn as reversed.
 */
export type RefundPaymentInput = {
	provider: string;
	providerPaymentId: string;
	reason?: string;
};

export async function processRefundPlaceholder(
	_admin: SupabaseClient,
	_input: RefundPaymentInput
): Promise<{ ok: false; reason: string }> {
	return {
		ok: false,
		reason:
			'Refund/chargeback handling is intentionally not implemented until the payment provider integration defines event shapes.'
	};
}
