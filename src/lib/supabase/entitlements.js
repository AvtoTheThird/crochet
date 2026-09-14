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
 * Dummy paid upgrade (Stripe later).
 * @param {'maker' | 'lifetime'} tier
 */
export async function upgradeTierDummy(tier) {
	const userId = auth.user?.id;
	if (!userId) throw new Error('You must be logged in to upgrade.');
	if (tier !== 'maker' && tier !== 'lifetime') {
		throw new Error('Unknown plan');
	}

	const supabase = getSupabase();
	const { error } = await supabase
		.from('users')
		.update({
			subscription_tier: tier,
			subscription_updated_at: new Date().toISOString()
		})
		.eq('id', userId);
	if (error) throw error;

	if (auth.session) {
		await setAuthSession(auth.session);
	} else if (auth.profile) {
		auth.profile = {
			...auth.profile,
			subscription_tier: tier,
			subscription_updated_at: new Date().toISOString()
		};
	}
}

/** @deprecated use upgradeTierDummy('maker') */
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
