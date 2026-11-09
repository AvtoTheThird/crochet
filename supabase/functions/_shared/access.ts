/**
 * Access / entitlement helper — single source of truth for "does this user get
 * paid features?" Used by the webhook when applying/revoking entitlements, and
 * safe to reuse anywhere server-side.
 *
 * Mirrors the client rule in src/lib/supabase/entitlements.js:
 *   free = 1 project, maker = 5 concurrent, lifetime = 20 concurrent.
 */

export type Tier = 'free' | 'maker' | 'lifetime';

/** Paddle subscription statuses that should grant access while set. */
const ACCESS_GRANTING_SUB_STATUSES = new Set([
	'active',
	'trialing',
	'past_due' // still within dunning — keep access until canceled
]);

/** Statuses that mean the subscription no longer grants access. */
const ACCESS_REVOKING_SUB_STATUSES = new Set(['paused', 'canceled']);

export function subscriptionStatusGrantsAccess(status: string): boolean {
	return ACCESS_GRANTING_SUB_STATUSES.has(status);
}

export function subscriptionStatusRevokesAccess(status: string): boolean {
	return ACCESS_REVOKING_SUB_STATUSES.has(status);
}

/** Whether a stored tier unlocks paid features (ignores expiry; prefer hasPaidAccessNow). */
export function hasPaidAccess(tier: Tier | string | null | undefined): boolean {
	return tier === 'maker' || tier === 'lifetime';
}

/**
 * Whether a user profile currently unlocks paid features, respecting optional
 * subscription_expires_at from admin timed grants.
 */
export function hasPaidAccessNow(profile: {
	subscription_tier?: string | null;
	subscription_expires_at?: string | null;
} | null | undefined): boolean {
	if (!profile || !hasPaidAccess(profile.subscription_tier)) return false;
	const expiresAt = profile.subscription_expires_at;
	if (!expiresAt) return true;
	const t = Date.parse(expiresAt);
	if (Number.isNaN(t)) return true;
	return t > Date.now();
}

/** Concurrent project limit for a tier (kept in sync with the client). */
export function projectLimitForTier(tier: Tier | string | null | undefined): number {
	if (tier === 'lifetime') return 20;
	if (tier === 'maker') return 5;
	return 1;
}
