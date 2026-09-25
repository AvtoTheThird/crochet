import { fail } from '@sveltejs/kit';
import { getAdminSupabase } from '$lib/server/supabase.js';
import { one } from '$lib/server/normalize.js';

/** @type {import('./$types').PageServerLoad} */
export async function load() {
	const sb = getAdminSupabase();
	const { data, error } = await sb
		.from('user_referrals')
		.select(
			'id, user_id, creator_id, referral_code_id, source, created_at, updated_at, locked_at, creators(name), referral_codes(code)'
		)
		.order('created_at', { ascending: false })
		.limit(200);

	return {
		rows: (data ?? []).map((row) => ({
			id: row.id,
			user_id: row.user_id,
			creator_id: row.creator_id,
			referral_code_id: row.referral_code_id,
			source: row.source,
			created_at: row.created_at,
			updated_at: row.updated_at,
			locked_at: row.locked_at,
			creator_name: one(row.creators)?.name ?? null,
			code: one(row.referral_codes)?.code ?? null
		})),
		error: error?.message ?? null
	};
}

/** @type {import('./$types').Actions} */
export const actions = {
	unlock: async ({ request }) => {
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '');
		if (!id) return fail(400, { error: 'Missing id' });

		const sb = getAdminSupabase();
		const { data, error } = await sb.rpc('admin_unlock_user_referral', { p_id: id });
		if (error) return fail(400, { error: error.message });
		if (data?.ok === false) return fail(400, { error: data.reason ?? 'unlock failed' });
		return { ok: true };
	},

	reassign: async ({ request }) => {
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '');
		const code = String(fd.get('code') ?? '').trim();
		if (!id) return fail(400, { error: 'Missing id' });
		if (!code) return fail(400, { error: 'Code required' });

		const sb = getAdminSupabase();
		const { data, error } = await sb.rpc('admin_reassign_user_referral', {
			p_id: id,
			p_code: code
		});
		if (error) return fail(400, { error: error.message });
		if (data?.ok === false) return fail(400, { error: data.reason ?? 'reassign failed' });
		return { ok: true };
	}
};
