/**
 * Google Ads "Subscribe" conversion.
 *
 * Paddle confirms the purchase on the pricing page. The thank-you page
 * (/welcome) is the conversion page, so the amount is held here until then.
 */

const STORAGE_KEY = 'qsovio.ads.conversion';
const SEND_TO = 'AW-18590013748/IG6wCIKAsL0dELSytKBF';

/**
 * @param {unknown} raw
 * @returns {number | null}
 */
function amount(raw) {
	const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
	if (!Number.isFinite(n) || n < 0) return null;
	return Math.round(n * 100) / 100;
}

/**
 * Remember a completed checkout so the thank-you page can report it once.
 * @param {import('@paddle/paddle-js').CheckoutEventsData | undefined} data
 */
export function rememberCheckoutConversion(data) {
	if (!data) return;
	const value = amount(data.totals?.total);
	const currency = typeof data.currency_code === 'string' ? data.currency_code : '';
	const transactionId = typeof data.transaction_id === 'string' ? data.transaction_id : '';
	if (value == null || !/^[A-Z]{3}$/.test(currency) || !transactionId) return;
	try {
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ value, currency, transactionId }));
	} catch {
		// Storage can be blocked. The thank-you page then has nothing to send.
	}
}

/** Send the stored purchase to Google Ads, once per checkout. */
export function reportSubscribeConversion() {
	let raw = null;
	try {
		raw = sessionStorage.getItem(STORAGE_KEY);
	} catch {
		return;
	}
	if (!raw) return;

	/** @type {{ value?: unknown, currency?: unknown, transactionId?: unknown }} */
	let stored;
	try {
		stored = JSON.parse(raw);
	} catch {
		sessionStorage.removeItem(STORAGE_KEY);
		return;
	}

	const value = amount(stored?.value);
	const currency = typeof stored?.currency === 'string' ? stored.currency : '';
	const transactionId = typeof stored?.transactionId === 'string' ? stored.transactionId : '';
	if (value == null || !/^[A-Z]{3}$/.test(currency) || !transactionId) {
		sessionStorage.removeItem(STORAGE_KEY);
		return;
	}

	const gtag = /** @type {((...args: unknown[]) => void) | undefined} */ (
		/** @type {any} */ (window).gtag
	);
	if (typeof gtag !== 'function') return;

	gtag('event', 'conversion', {
		send_to: SEND_TO,
		value,
		currency,
		transaction_id: transactionId
	});

	try {
		sessionStorage.removeItem(STORAGE_KEY);
	} catch {
		// Already sent. A later visit may retry; transaction_id lets Google drop the duplicate.
	}
}
