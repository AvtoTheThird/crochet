/**
 * Profile self-service: display name, password (with old-password verification),
 * avatar upload, and subscription cancellation.
 *
 * Only profile-safe columns are writable from the client (see column grants in
 * migration 20260916120000 + 20260929120000). Paid fields (subscription_tier)
 * are never client-writable — cancellation goes through the Edge Function which
 * calls Paddle, and the resulting webhook updates entitlements.
 */
import { getSupabase } from './client.js';
import { auth, setAuthSession } from './session.svelte.js';

const AVATAR_BUCKET = 'avatars';

/**
 * Update the signed-in user's first/last name.
 * @param {{ firstName: string, lastName: string }} fields
 */
export async function updateDisplayName({ firstName, lastName }) {
	const userId = auth.user?.id;
	if (!userId) throw new Error('Not signed in');

	const supabase = getSupabase();
	const { error } = await supabase
		.from('users')
		.update({
			first_name: (firstName ?? '').trim(),
			last_name: (lastName ?? '').trim()
		})
		.eq('id', userId);
	if (error) throw error;

	// Refresh the cached profile.
	if (auth.session) await setAuthSession(auth.session);
}

/**
 * Change password. Verifies the current password by re-authenticating first.
 * @param {string} oldPassword
 * @param {string} newPassword
 */
export async function changePassword(oldPassword, newPassword) {
	const email = auth.user?.email;
	if (!email) throw new Error('No email on this account');
	if (!oldPassword) throw new Error('Enter your current password');
	if (!newPassword || newPassword.length < 6) {
		throw new Error('New password must be at least 6 characters');
	}
	if (oldPassword === newPassword) {
		throw new Error('New password must be different from the current one');
	}

	const supabase = getSupabase();

	// Verify the current password by attempting a sign-in with it.
	const { error: reauthErr } = await supabase.auth.signInWithPassword({
		email,
		password: oldPassword
	});
	if (reauthErr) throw new Error('Current password is incorrect');

	const { error } = await supabase.auth.updateUser({ password: newPassword });
	if (error) throw error;
}

/**
 * Upload/replace the user's avatar. Removes any previous avatar files first,
 * stores the new one in a public bucket, and saves the public URL on the user.
 * @param {File} file
 * @returns {Promise<string>} public URL
 */
export async function uploadAvatar(file) {
	const userId = auth.user?.id;
	if (!userId) throw new Error('Not signed in');
	if (!file) throw new Error('Choose an image first');
	if (!file.type.startsWith('image/')) throw new Error('Avatar must be an image');
	if (file.size > 2 * 1024 * 1024) throw new Error('Avatar must be 2 MB or smaller');

	const supabase = getSupabase();

	// Clean up previous avatars so the folder holds only the latest.
	const { data: existing } = await supabase.storage.from(AVATAR_BUCKET).list(userId);
	if (existing?.length) {
		await supabase.storage
			.from(AVATAR_BUCKET)
			.remove(existing.map((f) => `${userId}/${f.name}`));
	}

	const ext = (file.name.split('.').pop() || 'png').toLowerCase();
	const path = `${userId}/${crypto.randomUUID()}.${ext}`;

	const { error: upErr } = await supabase.storage
		.from(AVATAR_BUCKET)
		.upload(path, file, { contentType: file.type || 'image/png', upsert: true });
	if (upErr) throw upErr;

	const { data: pub } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
	const publicUrl = pub.publicUrl;

	const { error } = await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', userId);
	if (error) throw error;

	if (auth.session) await setAuthSession(auth.session);
	return publicUrl;
}

/**
 * Load the user's most recent subscription (own rows only, via RLS).
 * @returns {Promise<Record<string, any> | null>}
 */
export async function getMySubscription() {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('subscriptions')
		.select(
			'id, provider_subscription_id, provider_customer_id, status, product_tier, price_id, current_period_end, scheduled_change_action, scheduled_change_at, canceled_at, updated_at'
		)
		.order('updated_at', { ascending: false })
		.limit(1)
		.maybeSingle();
	if (error) throw error;
	return data;
}

/**
 * The signed-in user's Paddle customer id (ctm_...), read from the subscription
 * mirror. Used to initialize Paddle Retain via pwCustomer. Returns null if the
 * user has never checked out (no Paddle customer yet).
 * @returns {Promise<string | null>}
 */
export async function getMyPaddleCustomerId() {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('subscriptions')
		.select('provider_customer_id, updated_at')
		.not('provider_customer_id', 'is', null)
		.order('updated_at', { ascending: false })
		.limit(1)
		.maybeSingle();
	if (error) return null;
	return data?.provider_customer_id ?? null;
}

/**
 * Cancel the user's active subscription at the end of the current billing
 * period (keeps access until then). Runs server-side via Paddle; entitlement
 * changes are applied by the resulting webhook.
 */
export async function cancelMySubscription() {
	const supabase = getSupabase();
	const { data, error } = await supabase.functions.invoke('cancel-subscription', { body: {} });
	if (error) {
		// Surface the function's JSON error message when present.
		const ctx = /** @type {any} */ (error).context;
		let message = error.message;
		try {
			const body = ctx && typeof ctx.json === 'function' ? await ctx.json() : null;
			if (body?.error) message = body.error;
		} catch {
			/* ignore */
		}
		throw new Error(message || 'Could not cancel subscription');
	}
	return data;
}
