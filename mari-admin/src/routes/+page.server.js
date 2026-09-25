import { getAdminSupabase } from '$lib/server/supabase.js';

/** @type {import('./$types').PageServerLoad} */
export async function load() {
	const sb = getAdminSupabase();

	const [
		creators,
		codes,
		referrals,
		paymentsCount,
		commissionsCount,
		paymentsSample,
		commissionsSample,
		recentPayments,
		recentCommissions
	] = await Promise.all([
		sb.from('creators').select('id', { count: 'exact', head: true }),
		sb.from('referral_codes').select('id', { count: 'exact', head: true }),
		sb.from('user_referrals').select('id', { count: 'exact', head: true }),
		sb.from('payments').select('id', { count: 'exact', head: true }),
		sb.from('affiliate_commissions').select('id', { count: 'exact', head: true }),
		sb.from('payments').select('status').limit(500),
		sb.from('affiliate_commissions').select('status, commission, entry_kind').limit(500),
		sb
			.from('payments')
			.select(
				'id, user_id, provider, provider_payment_id, amount, currency, status, product_tier, paid_at, created_at'
			)
			.order('created_at', { ascending: false })
			.limit(15),
		sb
			.from('affiliate_commissions')
			.select(
				'id, creator_id, user_id, commission, commission_percentage, currency, status, entry_kind, created_at'
			)
			.order('created_at', { ascending: false })
			.limit(15)
	]);

	const paymentRows = paymentsSample.data ?? [];
	/** @type {Record<string, number>} */
	const byStatus = {};
	for (const p of paymentRows) {
		const key = String(p.status);
		byStatus[key] = (byStatus[key] ?? 0) + 1;
	}

	const commissionRows = commissionsSample.data ?? [];
	/** @type {Record<string, number>} */
	const commissionByStatus = {};
	let commissionSum = 0;
	for (const c of commissionRows) {
		const key = String(c.status);
		commissionByStatus[key] = (commissionByStatus[key] ?? 0) + 1;
		if (c.entry_kind !== 'reversal' && c.status !== 'void' && c.status !== 'reversed') {
			commissionSum += Number(c.commission) || 0;
		}
	}

	return {
		counts: {
			creators: creators.count ?? 0,
			codes: codes.count ?? 0,
			referrals: referrals.count ?? 0,
			payments: paymentsCount.count ?? 0,
			commissions: commissionsCount.count ?? 0
		},
		paymentByStatus: byStatus,
		commissionByStatus,
		commissionSum,
		recentPayments: recentPayments.data ?? [],
		recentCommissions: recentCommissions.data ?? [],
		errors: [
			creators.error,
			codes.error,
			referrals.error,
			paymentsCount.error,
			commissionsCount.error,
			paymentsSample.error,
			commissionsSample.error,
			recentPayments.error,
			recentCommissions.error
		]
			.filter((e) => !!e)
			.map((e) => /** @type {{ message: string }} */ (e).message)
	};
}
