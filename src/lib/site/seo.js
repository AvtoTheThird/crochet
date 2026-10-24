import { company } from './company.js';

/** Absolute site origin (no trailing slash). */
export const siteUrl = company.website.replace(/\/$/, '');

/** Default / shared SEO copy. Tuned for tapestry-pattern search queries. */
export const seo = {
	siteName: company.name,
	defaultTitle: `${company.name} · Tapestry Pattern Creator`,
	titleTemplate: `%s · ${company.name}`,
	/** ~155 chars; primary keywords near the front. */
	defaultDescription:
		'Free tapestry pattern creator: turn a pixel image into a crochet tapestry pattern with yarn colors and row-by-row stitch counts. Pixel to tapestry crochet patterns made easy.',
	keywords:
		'tapestry pattern creator, tapestry pattern, crochet tapestry pattern, pixel to tapestry crochet pattern, crochet tapestry, pixel crochet pattern, tapestry crochet chart, row by row crochet pattern',
	locale: 'en_US',
	twitterCard: 'summary_large_image'
};

/**
 * Build a canonical absolute URL for a path.
 * @param {string} [path='/']
 */
export function canonicalUrl(path = '/') {
	const p = path.startsWith('/') ? path : `/${path}`;
	return `${siteUrl}${p === '/' ? '/' : p.replace(/\/$/, '')}`;
}

/**
 * Format a page title; pass the full string if it already includes the brand.
 * @param {string} title
 * @param {{ absolute?: boolean }} [opts]
 */
export function pageTitle(title, opts = {}) {
	if (opts.absolute || title.includes(company.name)) return title;
	return seo.titleTemplate.replace('%s', title);
}
