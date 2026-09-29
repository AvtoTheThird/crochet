/**
 * Paddle source-IP allowlist (defense-in-depth on top of signature verification).
 *
 * The IP list is fetched at runtime from Paddle's published endpoint — NEVER
 * hard-coded, because Paddle can change it. Environment-aware:
 *   - production → https://api.paddle.com/ips
 *   - sandbox    → https://sandbox-api.paddle.com/ips
 * Response shape: { data: { ipv4_cidrs: string[] } } (each is a /32 CIDR).
 *
 * Cached per warm instance to avoid a fetch on every delivery. If the list
 * can't be obtained (and nothing is cached), the check is skipped (fail-open)
 * so a transient Paddle outage can't drop legitimate webhooks — signature
 * verification is still enforced by the caller.
 */

type Cache = { cidrs: string[]; fetchedAt: number } | null;
let cache: Cache = null;
const TTL_MS = 60 * 60 * 1000; // 1 hour

function ipsEndpoint(environment: string): string {
	return environment === 'production'
		? 'https://api.paddle.com/ips'
		: 'https://sandbox-api.paddle.com/ips';
}

async function getPaddleCidrs(environment: string): Promise<string[] | null> {
	if (cache && Date.now() - cache.fetchedAt < TTL_MS) return cache.cidrs;
	try {
		const res = await fetch(ipsEndpoint(environment), { headers: { Accept: 'application/json' } });
		if (!res.ok) return cache?.cidrs ?? null;
		const body = await res.json();
		const cidrs: string[] = body?.data?.ipv4_cidrs ?? [];
		if (Array.isArray(cidrs) && cidrs.length) {
			cache = { cidrs, fetchedAt: Date.now() };
			return cidrs;
		}
		return cache?.cidrs ?? null;
	} catch {
		return cache?.cidrs ?? null;
	}
}

function ipToLong(ip: string): number | null {
	const parts = ip.trim().split('.');
	if (parts.length !== 4) return null; // IPv4 only (Paddle publishes ipv4_cidrs)
	let n = 0;
	for (const p of parts) {
		const o = Number(p);
		if (!Number.isInteger(o) || o < 0 || o > 255) return null;
		n = (n << 8) | o;
	}
	return n >>> 0;
}

function ipInCidr(ip: string, cidr: string): boolean {
	const [range, bitsStr] = cidr.split('/');
	const bits = bitsStr === undefined ? 32 : Number(bitsStr);
	if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
	const ipL = ipToLong(ip);
	const rangeL = ipToLong(range);
	if (ipL === null || rangeL === null) return false;
	if (bits === 0) return true;
	const mask = bits === 32 ? 0xffffffff : (~((1 << (32 - bits)) - 1)) >>> 0;
	return (ipL & mask) === (rangeL & mask);
}

/** Best-effort client IP from proxy headers (Supabase sets x-forwarded-for). */
export function clientIpFrom(req: Request): string | null {
	const xff = req.headers.get('x-forwarded-for');
	if (xff) {
		const first = xff.split(',')[0]?.trim();
		if (first) return first;
	}
	return req.headers.get('x-real-ip')?.trim() ?? null;
}

/**
 * Check whether the request originates from a Paddle IP.
 * `checked=false` means the allowlist was unavailable → caller should fail-open
 * and rely on signature verification.
 */
export async function checkPaddleIp(
	req: Request,
	environment: string
): Promise<{ allowed: boolean; checked: boolean; ip: string | null }> {
	const ip = clientIpFrom(req);
	const cidrs = await getPaddleCidrs(environment);
	if (!cidrs || cidrs.length === 0) return { allowed: true, checked: false, ip };
	if (!ip) return { allowed: false, checked: true, ip };
	const allowed = cidrs.some((c) => ipInCidr(ip, c));
	return { allowed, checked: true, ip };
}
