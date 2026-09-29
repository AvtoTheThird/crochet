import { json } from '@sveltejs/kit';

// This endpoint must run per-request on the edge (Cloudflare Worker), so it must
// NOT be prerendered even though the rest of the app is a prerendered SPA.
export const prerender = false;

/**
 * Sentinels that are NOT real ISO 3166-1 alpha-2 country codes.
 *  - Cloudflare uses "XX" for unknown and "T1" for Tor.
 *  - "OTHERS" is an example app-side sentinel — it must never reach Paddle.
 */
const NOT_A_COUNTRY = new Set(['XX', 'T1', 'OTHERS', 'ZZ', 'AP', 'EU']);

/**
 * Detect the visitor's country from request headers, server-side.
 * Cloudflare sets `cf-ipcountry`; Vercel sets `x-vercel-ip-country` (kept as a
 * fallback so this works if the deploy target changes).
 *
 * Returns `{ country: "US" }` for a valid code, or `{ country: null }` when
 * unknown. When null, the client omits location entirely and lets Paddle.js
 * auto-detect from the visitor's IP.
 *
 * @type {import('./$types').RequestHandler}
 */
export function GET({ request, platform }) {
	const headers = request.headers;

	const raw =
		headers.get('cf-ipcountry') ||
		headers.get('x-vercel-ip-country') ||
		platform?.cf?.country ||
		'';

	const code = String(raw).trim().toUpperCase();
	const isValid = /^[A-Z]{2}$/.test(code) && !NOT_A_COUNTRY.has(code);

	return json({ country: isValid ? code : null });
}
