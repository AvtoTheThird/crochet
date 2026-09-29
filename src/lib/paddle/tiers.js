/**
 * Editable pricing catalog for the pricing page.
 *
 * These map to real products/prices in your Paddle LIVE account.
 * Price IDs are public (they are sent to the browser at checkout), so it is
 * fine to keep them here. Secrets (API keys) never live in this file.
 *
 * To edit a plan, just change the fields below. To add a plan, push another
 * object with the same shape.
 *
 * @typedef {'month' | 'year'} BillingCycle
 *
 * @typedef {Object} Tier
 * @property {string} id                       Internal id (matches your entitlement tiers where relevant).
 * @property {string} name                     Display name shown on the card.
 * @property {string} description              Short tagline under the name.
 * @property {string[]} features               Bullet list of features.
 * @property {boolean} [featured]              Highlight this card.
 * @property {boolean} [oneTime]               True for one-time purchases (no month/year toggle).
 * @property {{ month: string, year: string }} priceId  Paddle price IDs per billing cycle.
 *                                             For one-time tiers, use the same id for both.
 */

/** @type {Tier[]} */
export const tiers = [
	{
		id: 'maker',
		name: 'Maker',
		description: 'For makers who need more than one project at a time.',
		features: [
			'Up to five concurrent projects',
			'Delete a project to free a slot',
			'Full gallery pattern data',
			'Add gallery patterns to your projects',
			'Same studio tools'
		],
		priceId: {
			month: 'pri_01m3pymfz2y4cd8y9rrwcwh55j',
			year: 'pri_01m3pymg7ds2zdrgbmgqcvvpsa'
		}
	},
	{
		id: 'lifetime',
		name: 'Lifetime',
		description: 'Pay once. Keep it forever.',
		features: [
			'Up to twenty concurrent projects',
			'Delete a project to free a slot',
			'Full gallery pattern data',
			'Add gallery patterns to your projects',
			'Same studio tools'
		],
		featured: true,
		oneTime: true,
		priceId: {
			// One-time price: same id for both toggle positions.
			month: 'pri_01m3pymgg2x2r3b7wcyfn4t5wp',
			year: 'pri_01m3pymgg2x2r3b7wcyfn4t5wp'
		}
	}
];

/**
 * Every unique price id in the catalog. Used to fetch all localized prices
 * from Paddle.PricePreview() in a single call.
 * @returns {string[]}
 */
export function allPriceIds() {
	const set = new Set();
	for (const tier of tiers) {
		set.add(tier.priceId.month);
		set.add(tier.priceId.year);
	}
	return [...set];
}

/**
 * Resolve the price id to show/checkout for a tier at the current billing cycle.
 * One-time tiers ignore the cycle.
 * @param {Tier} tier
 * @param {BillingCycle} cycle
 * @returns {string}
 */
export function priceIdFor(tier, cycle) {
	if (tier.oneTime) return tier.priceId.month;
	return tier.priceId[cycle];
}
