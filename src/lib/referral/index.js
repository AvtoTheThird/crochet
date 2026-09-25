/**
 * Referral capture + attribution helpers.
 * Cookie is not source of truth — user_referrals in Supabase is.
 */
import { getSupabase } from '$lib/supabase/client.js';
import {
	clearReferralCookie,
	getReferralCookie,
	setReferralCookie
} from './cookie.js';

/**
 * @param {string} code
 */
export async function lookupReferralCode(code) {
	const supabase = getSupabase();
	const { data, error } = await supabase.rpc('lookup_active_referral_code', {
		p_code: code
	});
	if (error) throw error;
	return data;
}

/**
 * If the URL has ?ref=CODE, validate and store in a 30-day cookie.
 * Returns the validated code or null.
 * @param {URL | Location | string} [url]
 */
export async function captureReferralFromUrl(url = typeof window !== 'undefined' ? window.location.href : '') {
	const href = typeof url === 'string' ? url : url.href;
	const parsed = new URL(href, 'http://local');
	const raw = parsed.searchParams.get('ref');
	if (!raw?.trim()) return null;

	const result = await lookupReferralCode(raw);
	if (!result?.valid || !result.code) return null;

	setReferralCookie(result.code);
	return result.code;
}

/**
 * Persist attribution for the signed-in user.
 * @param {string} code
 * @param {'cookie' | 'manual'} source
 */
export async function applyReferralAttribution(code, source) {
	const supabase = getSupabase();
	const { data, error } = await supabase.rpc('apply_referral_attribution', {
		p_code: code,
		p_source: source
	});
	if (error) throw error;
	return data;
}

/**
 * After signup/login: if a referral cookie exists, attribute with source=cookie.
 * Cookie never overrides an existing attribution (manual wins).
 */
export async function applyReferralCookieIfPresent() {
	const code = getReferralCookie();
	if (!code) return null;

	const result = await applyReferralAttribution(code, 'cookie');
	if (result?.ok && (result.created || result.unchanged || result.updated)) {
		// Keep cookie until purchase/lock is fine; clear after successful create to avoid re-sends
		if (result.created) clearReferralCookie();
	}
	return result;
}

/**
 * Manual entry always overrides unlocked cookie attribution.
 * @param {string} code
 */
export async function applyManualReferralCode(code) {
	const result = await applyReferralAttribution(code, 'manual');
	if (result?.ok) {
		clearReferralCookie();
		if (result.code) setReferralCookie(result.code);
	}
	return result;
}

/** @returns {Promise<Record<string, unknown> | null>} */
export async function getMyReferralAttribution() {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('user_referrals')
		.select('id, creator_id, referral_code_id, source, created_at, locked_at')
		.maybeSingle();
	if (error) throw error;
	return data;
}
