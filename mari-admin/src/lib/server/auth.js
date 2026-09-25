import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';

const COOKIE = 'mari_admin_session';
const MAX_AGE_SEC = 60 * 60 * 24 * 14; // 14 days

function secret() {
	const s = env.ADMIN_SESSION_SECRET?.trim();
	if (!s) throw new Error('Missing ADMIN_SESSION_SECRET in mari-admin/.env');
	return s;
}

function password() {
	const p = env.ADMIN_PASSWORD?.trim();
	if (!p) throw new Error('Missing ADMIN_PASSWORD in mari-admin/.env');
	return p;
}

/**
 * @param {string} value
 */
function sign(value) {
	return createHmac('sha256', secret()).update(value).digest('hex');
}

/**
 * @param {string} candidate
 */
export function verifyAdminPassword(candidate) {
	const expected = password();
	const a = Buffer.from(candidate);
	const b = Buffer.from(expected);
	if (a.length !== b.length) return false;
	return timingSafeEqual(a, b);
}

/**
 * @param {import('@sveltejs/kit').Cookies} cookies
 */
export function createAdminSession(cookies) {
	const payload = `ok:${Date.now()}`;
	const token = `${payload}.${sign(payload)}`;
	cookies.set(COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: false,
		maxAge: MAX_AGE_SEC
	});
}

/**
 * @param {import('@sveltejs/kit').Cookies} cookies
 */
export function clearAdminSession(cookies) {
	cookies.delete(COOKIE, { path: '/' });
}

/**
 * @param {import('@sveltejs/kit').Cookies} cookies
 */
export function isAdminAuthenticated(cookies) {
	const token = cookies.get(COOKIE);
	if (!token) return false;
	const i = token.lastIndexOf('.');
	if (i < 0) return false;
	const payload = token.slice(0, i);
	const sig = token.slice(i + 1);
	const expected = sign(payload);
	try {
		const a = Buffer.from(sig);
		const b = Buffer.from(expected);
		if (a.length !== b.length) return false;
		return timingSafeEqual(a, b) && payload.startsWith('ok:');
	} catch {
		return false;
	}
}
