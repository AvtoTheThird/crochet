import { fail } from '@sveltejs/kit';
import { getAdminSupabase } from '$lib/server/supabase.js';
import { one } from '$lib/server/normalize.js';

/** @type {import('./$types').PageServerLoad} */
export async function load({ url }) {
	const sb = getAdminSupabase();
	const status = url.searchParams.get('status')?.trim() || '';

	let query = sb
		.from('affiliate_commissions')
		.select(
			'id, creator_id, user_id, payment_id, payment_provider, provider_payment_id, amount, commission_percentage, commission, currency, entry_kind, status, available_at, paid_at, created_at, creators(name)'
		)
		.order('created_at', { ascending: false })
		.limit(150);

	if (status) query = query.eq('status', status);

	const { data, error } = await query;

	return {
		rows: (data ?? []).map((row) => ({
			id: row.id,
			creator_id: row.creator_id,
			user_id: row.user_id,
			payment_id: row.payment_id,
			payment_provider: row.payment_provider,
			provider_payment_id: row.provider_payment_id,
			amount: row.amount,
			commission_percentage: row.commission_percentage,
			commission: row.commission,
			currency: row.currency,
			entry_kind: row.entry_kind,
			status: row.status,
			available_at: row.available_at,
			paid_at: row.paid_at,
			created_at: row.created_at,
			creator_name: one(row.creators)?.name ?? null
		})),
		filters: { status },
		error: error?.message ?? null
	};
}

/** @type {import('./$types').Actions} */
export const actions = {
	setStatus: async ({ request }) => {
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '');
		const status = String(fd.get('status') ?? '');
		const allowed = ['pending', 'available', 'paid', 'reversed', 'void'];
		if (!id) return fail(400, { error: 'Missing id' });
		if (!allowed.includes(status)) return fail(400, { error: 'Invalid status' });

		const sb = getAdminSupabase();
		/** @type {Record<string, unknown>} */
		const patch = { status };
		if (status === 'paid') patch.paid_at = new Date().toISOString();

		const { error } = await sb.from('affiliate_commissions').update(patch).eq('id', id);
		if (error) return fail(400, { error: error.message });
		return { ok: true };
	}
};
