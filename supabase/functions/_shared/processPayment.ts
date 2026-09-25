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

import type { SupabaseClient } from '@supabase/supabase-js';

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
