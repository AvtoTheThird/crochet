/**
 * Browser-side Paddle.js initializer.
 *
 * Reads the environment + client-side token from PUBLIC_* env vars (baked in at
 * build time, same pattern as the Supabase client — required because this app
 * runs with ssr = false).
 *
 * Hard rules enforced here:
 *  - Never silently default the environment. If PUBLIC_PADDLE_ENVIRONMENT is
 *    missing or invalid we throw, so you can never accidentally run against the
 *    wrong Paddle account.
 *  - Only a client-side token (`test_...` on sandbox, `live_...` on production)
 *    is used here. The server-side API key must NEVER be imported into client code.
 */
import { initializePaddle } from '@paddle/paddle-js';
import { PUBLIC_PADDLE_ENVIRONMENT, PUBLIC_PADDLE_CLIENT_TOKEN } from '$env/static/public';

/** @type {Promise<import('@paddle/paddle-js').Paddle | undefined> | null} */
let paddlePromise = null;
/** The Paddle customer id (ctm_...) the current instance was initialized with, if any. */
let initializedPwCustomer = /** @type {string | null} */ (null);

/**
 * Get a memoized, initialized Paddle instance.
 *
 * @param {{ pwCustomerId?: string | null }} [options]
 *   pwCustomerId — the signed-in customer's Paddle customer id (ctm_...), used by
 *   Paddle Retain. Must be the Paddle customer id, never an internal id or email.
 *   Omit it for anonymous / not-yet-a-customer visitors.
 * @returns {Promise<import('@paddle/paddle-js').Paddle | undefined>}
 */
export function getPaddle(options = {}) {
	const pwCustomerId =
		typeof options.pwCustomerId === 'string' && options.pwCustomerId.startsWith('ctm_')
			? options.pwCustomerId
			: null;

	// Already initialized: if we now know a customer id we didn't init with,
	// attach it in place via Paddle.Update (no re-initialization needed).
	if (paddlePromise) {
		if (pwCustomerId && pwCustomerId !== initializedPwCustomer) {
			initializedPwCustomer = pwCustomerId;
			paddlePromise = paddlePromise.then((p) => {
				p?.Update({ pwCustomer: { id: pwCustomerId } });
				return p;
			});
		}
		return paddlePromise;
	}

	const environment = PUBLIC_PADDLE_ENVIRONMENT?.trim();
	const token = PUBLIC_PADDLE_CLIENT_TOKEN?.trim();

	// Fail loudly — never guess the environment.
	if (!environment) {
		throw new Error(
			'PUBLIC_PADDLE_ENVIRONMENT is not set. Set it to "sandbox" or "production" ' +
				'(local .env and Cloudflare Build variables).'
		);
	}
	if (environment !== 'sandbox' && environment !== 'production') {
		throw new Error(
			`PUBLIC_PADDLE_ENVIRONMENT must be "sandbox" or "production", received "${environment}".`
		);
	}
	if (!token) {
		throw new Error(
			'PUBLIC_PADDLE_CLIENT_TOKEN is not set. Add your Paddle client-side token ' +
				'(local .env and Cloudflare Build variables).'
		);
	}

	// Guard against pairing the wrong token with the wrong environment.
	if (environment === 'sandbox' && !token.startsWith('test_')) {
		throw new Error(
			'PUBLIC_PADDLE_ENVIRONMENT=sandbox requires a sandbox client-side token prefixed with "test_".'
		);
	}
	if (environment === 'production' && token.startsWith('test_')) {
		throw new Error(
			'PUBLIC_PADDLE_ENVIRONMENT=production must not use a sandbox ("test_") client-side token.'
		);
	}

	/** @type {import('@paddle/paddle-js').InitializePaddleOptions} */
	const initOptions = {
		environment: /** @type {'sandbox' | 'production'} */ (environment),
		token
	};
	// Paddle Retain: identify the signed-in customer by their Paddle customer id.
	if (pwCustomerId) {
		initOptions.pwCustomer = { id: pwCustomerId };
	}
	initializedPwCustomer = pwCustomerId;

	paddlePromise = initializePaddle(initOptions);

	return paddlePromise;
}
