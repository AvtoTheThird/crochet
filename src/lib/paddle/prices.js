import { allPriceIds } from '$lib/paddle/tiers.js';

/**
 * Fetch Paddle's localized, already-formatted prices for every price in the catalog.
 *
 * Country is detected server-side from request headers (see /api/geo). If unknown,
 * no country is passed and Paddle.js auto-detects by IP.
 *
 * @param {import('@paddle/paddle-js').Paddle} paddle
 * @returns {Promise<{ priceMap: Record<string, string>, country: string | null }>}
 *   priceMap is priceId -> Paddle's formatted subtotal string.
 */
export async function fetchPriceMap(paddle) {
	/** @type {string | null} */
	let country = null;
	try {
		const res = await fetch('/api/geo');
		if (res.ok) {
			const data = await res.json();
			country = typeof data?.country === 'string' ? data.country : null;
		}
	} catch {
		country = null;
	}

	/** @type {{ items: { priceId: string; quantity: number }[]; address?: { countryCode: string } }} */
	const request = {
		items: allPriceIds().map((priceId) => ({ priceId, quantity: 1 }))
	};
	// Only attach an address when we have a real ISO country code.
	if (country) {
		request.address = { countryCode: country };
	}

	const result = await paddle.PricePreview(request);
	const priceMap = /** @type {Record<string, string>} */ ({});
	for (const item of result.data.details.lineItems) {
		// Display ONLY the string Paddle returns — no math, no reformatting.
		priceMap[item.price.id] = item.formattedTotals.subtotal;
	}
	return { priceMap, country };
}
