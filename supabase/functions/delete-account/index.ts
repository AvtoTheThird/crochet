import { jsonResponse, optionsResponse } from '../_shared/cors.ts';
import { createServiceClient, createUserClient } from '../_shared/supabase.ts';

/**
 * POST (no body required)
 * Requires Authorization: Bearer <user access token>
 *
 * Permanently deletes the caller's account:
 * - Cancels any active Paddle subscription immediately (best-effort)
 * - Removes avatar + project image storage objects
 * - Deletes the Auth user (cascades public.users / projects; payments
 *   and commissions keep anonymized rows via ON DELETE SET NULL)
 */

function paddleApiBase(): string {
	const env = (Deno.env.get('PADDLE_ENVIRONMENT') || '').toLowerCase();
	if (env !== 'sandbox' && env !== 'production') {
		throw new Error('PADDLE_ENVIRONMENT must be "sandbox" or "production"');
	}
	return env === 'production' ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com';
}

const ACTIVE_STATUSES = ['active', 'trialing', 'past_due'];

/**
 * Recursively list and remove every object under `prefix/` in a bucket.
 */
async function emptyStoragePrefix(
	admin: ReturnType<typeof createServiceClient>,
	bucket: string,
	prefix: string
): Promise<void> {
	const { data: entries, error } = await admin.storage.from(bucket).list(prefix, {
		limit: 1000,
		offset: 0
	});
	if (error) {
		console.warn(`delete-account: list ${bucket}/${prefix}`, error.message);
		return;
	}
	if (!entries?.length) return;

	const filePaths: string[] = [];
	for (const entry of entries) {
		const path = `${prefix}/${entry.name}`;
		// Folders from list() have id === null in Supabase storage.
		if (entry.id === null) {
			await emptyStoragePrefix(admin, bucket, path);
		} else {
			filePaths.push(path);
		}
	}
	if (filePaths.length) {
		const { error: rmErr } = await admin.storage.from(bucket).remove(filePaths);
		if (rmErr) {
			console.warn(`delete-account: remove ${bucket}`, rmErr.message);
		}
	}
}

Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') return optionsResponse();
	if (req.method !== 'POST') {
		return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
	}

	try {
		const authHeader = req.headers.get('Authorization');
		if (!authHeader) {
			return jsonResponse({ ok: false, error: 'not_authenticated' }, 401);
		}

		const userClient = createUserClient(authHeader);
		const { data: userData, error: userErr } = await userClient.auth.getUser();
		if (userErr || !userData.user) {
			return jsonResponse({ ok: false, error: 'not_authenticated' }, 401);
		}
		const userId = userData.user.id;

		const admin = createServiceClient();

		// Best-effort: cancel recurring Paddle access immediately.
		const apiKey = Deno.env.get('PADDLE_API_KEY');
		if (apiKey) {
			try {
				const base = paddleApiBase();
				const { data: subs } = await admin
					.from('subscriptions')
					.select('provider_subscription_id, status')
					.eq('user_id', userId)
					.in('status', ACTIVE_STATUSES);

				for (const sub of subs ?? []) {
					if (!sub.provider_subscription_id) continue;
					const res = await fetch(
						`${base}/subscriptions/${sub.provider_subscription_id}/cancel`,
						{
							method: 'POST',
							headers: {
								Authorization: `Bearer ${apiKey}`,
								'Content-Type': 'application/json'
							},
							body: JSON.stringify({ effective_from: 'immediately' })
						}
					);
					if (!res.ok) {
						const payload = await res.json().catch(() => null);
						console.warn(
							'delete-account: paddle cancel failed',
							res.status,
							payload
						);
					}
				}
			} catch (paddleErr) {
				console.warn('delete-account: paddle cancel skipped', paddleErr);
			}
		}

		await emptyStoragePrefix(admin, 'avatars', userId);
		await emptyStoragePrefix(admin, 'project-images', userId);

		const { error: delErr } = await admin.auth.admin.deleteUser(userId);
		if (delErr) {
			console.error('delete-account: auth delete failed', delErr);
			return jsonResponse({ ok: false, error: delErr.message || 'delete_failed' }, 500);
		}

		return jsonResponse({ ok: true });
	} catch (e) {
		console.error('delete-account', e);
		return jsonResponse(
			{ ok: false, error: e instanceof Error ? e.message : 'server_error' },
			500
		);
	}
});
