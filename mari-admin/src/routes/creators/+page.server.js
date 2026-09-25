import { fail } from '@sveltejs/kit';
import { getAdminSupabase } from '$lib/server/supabase.js';

/** @type {import('./$types').PageServerLoad} */
export async function load() {
	const sb = getAdminSupabase();
	const { data, error } = await sb
		.from('creators')
		.select('id, name, channel_url, commission_percentage_cut, created_at, updated_at')
		.order('created_at', { ascending: false });

	const stats = await sb.from('creator_referral_stats').select('*');

	/** @type {Record<string, { users_referred: number, users_referred_locked: number }>} */
	const byCreator = {};
	for (const row of stats.data ?? []) {
		byCreator[row.creator_id] = {
			users_referred: row.users_referred,
			users_referred_locked: row.users_referred_locked
		};
	}

	return {
		creators: data ?? [],
		stats: byCreator,
		error: error?.message ?? stats.error?.message ?? null
	};
}

/** @type {import('./$types').Actions} */
export const actions = {
	create: async ({ request }) => {
		const fd = await request.formData();
		const name = String(fd.get('name') ?? '').trim();
		const channel_url = String(fd.get('channel_url') ?? '').trim() || null;
		const cut = Number(fd.get('commission_percentage_cut'));

		if (!name) return fail(400, { error: 'Name is required' });
		if (Number.isNaN(cut) || cut < 0 || cut > 100) {
			return fail(400, { error: 'Commission % must be 0–100' });
		}

		const sb = getAdminSupabase();
		const { error } = await sb.from('creators').insert({
			name,
			channel_url,
			commission_percentage_cut: cut
		});
		if (error) return fail(400, { error: error.message });
		return { ok: true };
	},

	update: async ({ request }) => {
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '');
		const name = String(fd.get('name') ?? '').trim();
		const channel_url = String(fd.get('channel_url') ?? '').trim() || null;
		const cut = Number(fd.get('commission_percentage_cut'));

		if (!id) return fail(400, { error: 'Missing id' });
		if (!name) return fail(400, { error: 'Name is required' });
		if (Number.isNaN(cut) || cut < 0 || cut > 100) {
			return fail(400, { error: 'Commission % must be 0–100' });
		}

		const sb = getAdminSupabase();
		const { error } = await sb
			.from('creators')
			.update({
				name,
				channel_url,
				commission_percentage_cut: cut
			})
			.eq('id', id);
		if (error) return fail(400, { error: error.message });
		return { ok: true };
	},

	delete: async ({ request }) => {
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '');
		if (!id) return fail(400, { error: 'Missing id' });

		const sb = getAdminSupabase();
		const { error } = await sb.from('creators').delete().eq('id', id);
		if (error) return fail(400, { error: error.message });
		return { ok: true };
	}
};
