import { error } from '@sveltejs/kit';
import { getAdminSupabase } from '$lib/server/supabase.js';
import { one } from '$lib/server/normalize.js';

/** @type {import('./$types').PageServerLoad} */
export async function load({ params }) {
	const sb = getAdminSupabase();
	const { data: payment, error: payErr } = await sb
		.from('payments')
		.select('*')
		.eq('id', params.id)
		.maybeSingle();

	if (payErr) throw error(500, payErr.message);
	if (!payment) throw error(404, 'Payment not found');

	const { data: commissions, error: cErr } = await sb
		.from('affiliate_commissions')
		.select('*')
		.eq('payment_id', payment.id)
		.order('created_at', { ascending: false });

	const { data: user } = await sb
		.from('users')
		.select('id, email, username, subscription_tier, subscription_updated_at')
		.eq('id', payment.user_id)
		.maybeSingle();

	const { data: referralRaw } = await sb
		.from('user_referrals')
		.select('id, source, locked_at, creators(name), referral_codes(code)')
		.eq('user_id', payment.user_id)
		.maybeSingle();

	const referral = referralRaw
		? {
				id: referralRaw.id,
				source: referralRaw.source,
				locked_at: referralRaw.locked_at,
				creator_name: one(referralRaw.creators)?.name ?? null,
				code: one(referralRaw.referral_codes)?.code ?? null
			}
		: null;

	return {
		payment,
		commissions: commissions ?? [],
		user,
		referral,
		error: cErr?.message ?? null
	};
}
