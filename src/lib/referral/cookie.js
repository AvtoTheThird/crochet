/** Referral cookie: transport only until attribution is stored in Supabase. */

export const REFERRAL_COOKIE = 'mari_ref';
export const REFERRAL_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

/**
 * @param {string} name
 * @returns {string | null}
 */
export function getCookie(name) {
	if (typeof document === 'undefined') return null;
	const match = document.cookie.match(
		new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)')
	);
	return match ? decodeURIComponent(match[1]) : null;
}

/**
 * @param {string} name
 * @param {string} value
 * @param {number} [maxAgeSec]
 */
export function setCookie(name, value, maxAgeSec = REFERRAL_COOKIE_MAX_AGE_SEC) {
	if (typeof document === 'undefined') return;
	const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
	document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax${secure}`;
}

/**
 * @param {string} name
 */
export function clearCookie(name) {
	if (typeof document === 'undefined') return;
	document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function getReferralCookie() {
	return getCookie(REFERRAL_COOKIE);
}

/**
 * @param {string} code
 */
export function setReferralCookie(code) {
	setCookie(REFERRAL_COOKIE, code.trim());
}

export function clearReferralCookie() {
	clearCookie(REFERRAL_COOKIE);
}
