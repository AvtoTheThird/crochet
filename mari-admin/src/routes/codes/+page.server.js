import { fail } from '@sveltejs/kit';
import { getAdminSupabase } from '$lib/server/supabase.js';
import { one } from '$lib/server/normalize.js';

/** @type {import('./$types').PageServerLoad} */
export async function load() {
	const sb = getAdminSupabase();
	const [codes, creators] = await Promise.all([
		sb
			.from('referral_codes')
			.select('id, creator_id, code, active, created_at, creators(name)')
			.order('created_at', { ascending: false }),
		sb.from('creators').select('id, name').order('name')
	]);

	return {
		codes: (codes.data ?? []).map((row) => ({
			id: row.id,
			creator_id: row.creator_id,
			code: row.code,
			active: row.active,
			created_at: row.created_at,
			creator_name: one(row.creators)?.name ?? null
		})),
		creators: creators.data ?? [],
		error: codes.error?.message ?? creators.error?.message ?? null
	};
}

/** @type {import('./$types').Actions} */
export const actions = {
	create: async ({ request }) => {
		const fd = await request.formData();
		const creator_id = String(fd.get('creator_id') ?? '');
		const code = String(fd.get('code') ?? '').trim();
		const active = fd.get('active') === 'on' || fd.get('active') === 'true';

		if (!creator_id) return fail(400, { error: 'Creator is required' });
		if (!code) return fail(400, { error: 'Code is required' });

		const sb = getAdminSupabase();
		const { error } = await sb.from('referral_codes').insert({
			creator_id,
			code,
			active
		});
		if (error) return fail(400, { error: error.message });
		return { ok: true };
	},

	update: async ({ request }) => {
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '');
		const code = String(fd.get('code') ?? '').trim();
		const active = fd.get('active') === 'on' || fd.get('active') === 'true';

		if (!id) return fail(400, { error: 'Missing id' });
		if (!code) return fail(400, { error: 'Code is required' });

		const sb = getAdminSupabase();
		const { error } = await sb
			.from('referral_codes')
			.update({ code, active })
			.eq('id', id);
		if (error) return fail(400, { error: error.message });
		return { ok: true };
	},

	toggle: async ({ request }) => {
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '');
		const active = fd.get('active') === 'true';
		if (!id) return fail(400, { error: 'Missing id' });

		const sb = getAdminSupabase();
		const { error } = await sb.from('referral_codes').update({ active: !active }).eq('id', id);
		if (error) return fail(400, { error: error.message });
		return { ok: true };
	},

	delete: async ({ request }) => {
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '');
		if (!id) return fail(400, { error: 'Missing id' });

		const sb = getAdminSupabase();
		const { error } = await sb.from('referral_codes').delete().eq('id', id);
		if (error) return fail(400, { error: error.message });
		return { ok: true };
	}
};
