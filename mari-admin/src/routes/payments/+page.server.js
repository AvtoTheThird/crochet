import { getAdminSupabase } from '$lib/server/supabase.js';

/** @type {import('./$types').PageServerLoad} */
export async function load({ url }) {
	const sb = getAdminSupabase();
	const status = url.searchParams.get('status')?.trim() || '';
	const q = url.searchParams.get('q')?.trim() || '';

	let query = sb
		.from('payments')
		.select(
			'id, user_id, provider, provider_payment_id, provider_order_id, subscription_id, product_tier, amount, eligible_amount, currency, status, processed_at, paid_at, created_at'
		)
		.order('created_at', { ascending: false })
		.limit(100);

	if (status) query = query.eq('status', status);
	if (q) {
		query = query.or(
			`provider_payment_id.ilike.%${q}%,provider_order_id.ilike.%${q}%,user_id.eq.${q}`
		);
	}

	const { data, error } = await query;

	return {
		payments: data ?? [],
		filters: { status, q },
		error: error?.message ?? null
	};
}
