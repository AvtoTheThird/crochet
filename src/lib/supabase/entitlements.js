/**
 * Subscription entitlements:
 * free = one lifetime create
 * maker = 5 concurrent
 * lifetime = 20 concurrent
 */
import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { getSupabase } from './client.js';
import { auth, setAuthSession } from './session.svelte.js';

// Note: subscription_tier is not writable from the client (column grants + payment webhook).

export const MAKER_PROJECT_LIMIT = 5;
export const LIFETIME_PROJECT_LIMIT = 20;

/** @typedef {'free' | 'maker' | 'lifetime'} SubscriptionTier */

/** @returns {SubscriptionTier} */
export function currentTier() {
	const tier = auth.profile?.subscription_tier;
	if (tier === 'maker' || tier === 'lifetime') return tier;
	return 'free';
}

export function isMaker() {
	return currentTier() === 'maker';
}

export function isLifetime() {
	return currentTier() === 'lifetime';
}

/** Paid plans with full gallery access and concurrent project slots. */
export function isPaid() {
	const t = currentTier();
	return t === 'maker' || t === 'lifetime';
}

export function projectLimitForTier(tier = currentTier()) {
	if (tier === 'lifetime') return LIFETIME_PROJECT_LIMIT;
	if (tier === 'maker') return MAKER_PROJECT_LIMIT;
	return 1;
}

/**
 * @param {string} userId
 */
export async function countUserProjects(userId) {
	const supabase = getSupabase();
	const { count, error } = await supabase
		.from('projects')
		.select('id', { count: 'exact', head: true })
		.eq('user_id', userId);
	if (error) throw error;
	return count ?? 0;
}

/**
 * Whether the user may create a brand-new project (insert).
 * @returns {Promise<{ ok: true } | { ok: false, reason: string }>}
 */
export async function canCreateProject() {
	const userId = auth.user?.id;
	if (!userId) return { ok: false, reason: 'not_logged_in' };

	const profile = auth.profile;
	const tier = currentTier();

	if (tier === 'free') {
		if (profile?.free_project_used) {
			return { ok: false, reason: 'free_used' };
		}
		return { ok: true };
	}

	const limit = projectLimitForTier(tier);
	const count = await countUserProjects(userId);
	if (count >= limit) {
		return { ok: false, reason: 'paid_full' };
	}
	return { ok: true };
}

/**
 * Assert create allowed; otherwise redirect to pricing and throw.
 */
export async function assertCanCreateProject() {
	const result = await canCreateProject();
	if (result.ok) return;
	if (browser) {
		await goto(resolve('/pricing'));
	}
	const err = new Error(
		result.reason === 'paid_full'
			? 'Project limit reached. Upgrade or delete a project.'
			: 'Free plan allows one project. Upgrade to create more.'
	);
	err.code = 'PROJECT_LIMIT';
	throw err;
}

/** Mark free lifetime create as used and refresh auth.profile. */
export async function markFreeProjectUsed() {
	const userId = auth.user?.id;
	if (!userId) return;
	if (isPaid()) return;
	if (auth.profile?.free_project_used) return;

	const supabase = getSupabase();
	const { error } = await supabase
		.from('users')
		.update({ free_project_used: true })
		.eq('id', userId);
	if (error) throw error;

	if (auth.session) {
		await setAuthSession(auth.session);
	} else if (auth.profile) {
		auth.profile = { ...auth.profile, free_project_used: true };
	}
}

/**
 * Client-side tier upgrades are disabled.
 * Paid entitlements are applied only by trusted payment webhooks (Edge Functions)
 * writing to `payments` + `users.subscription_tier` via the service role.
 * @param {'maker' | 'lifetime'} _tier
 */
export async function upgradeTierDummy(_tier) {
	throw new Error(
		'Client upgrades are disabled. Paid plans are activated after a verified payment webhook.'
	);
}

/** @deprecated Client upgrades removed — payment webhook only. */
export async function upgradeToMakerDummy() {
	return upgradeTierDummy('maker');
}

/**
 * Short status line for studio UI.
 * @returns {Promise<string>}
 */
export async function projectQuotaLabel() {
	const userId = auth.user?.id;
	if (!userId) return '';
	const tier = currentTier();
	if (tier === 'free') {
		return auth.profile?.free_project_used
			? 'Free plan: project create used'
			: 'Free plan: 1 project create available';
	}
	const count = await countUserProjects(userId);
	const limit = projectLimitForTier(tier);
	const label = tier === 'lifetime' ? 'Lifetime' : 'Maker';
	return `${label}: ${count} / ${limit} projects`;
}
