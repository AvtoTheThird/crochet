<script>
	import { onMount } from 'svelte';
	import { auth } from '$lib/supabase/session.svelte.js';
	import { currentTier } from '$lib/supabase/entitlements.js';
	import {
		applyManualReferralCode,
		getMyReferralAttribution
	} from '$lib/referral/index.js';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import SiteHeader from '$lib/components/site/SiteHeader.svelte';
	import SiteFooter from '$lib/components/site/SiteFooter.svelte';
	import { getPaddle } from '$lib/paddle/client.js';
	import { getMyPaddleCustomerId } from '$lib/supabase/profile.js';
	import { tiers, priceIdFor } from '$lib/paddle/tiers.js';
	import { fetchPriceMap } from '$lib/paddle/prices.js';
	import { pageTitle } from '$lib/site/seo.js';
	import '$lib/styles/site.css';

	const pricingTitle = pageTitle('Pricing for the Tapestry Pattern Creator');
	const pricingDescription =
		'Start free with Qsovio’s tapestry pattern creator. Upgrade for more crochet tapestry pattern projects and full gallery access.';

	// ---- Paddle pricing state -------------------------------------------------
	/** @type {'month' | 'year'} */
	let billingCycle = $state('month');
	/** Map of priceId -> Paddle's already-formatted total string. */
	let priceMap = $state(/** @type {Record<string, string>} */ ({}));
	let pricesLoading = $state(true);
	let pricesError = $state('');
	/** ISO country code detected server-side, or null (Paddle auto-detects). */
	let country = $state(/** @type {string | null} */ (null));
	/** id of the tier whose checkout is currently opening. */
	let checkoutBusy = $state('');
	let checkoutError = $state('');

	const tier = $derived(currentTier());
	/** Paddle customer id (ctm_...) for Retain, when the user is an existing customer. */
	let pwCustomerId = $state(/** @type {string | null} */ (null));

	onMount(() => {
		loadPrices();
	});

	/** Resolve Paddle instance, attaching the customer id for Retain when known. */
	async function resolvePaddle() {
		if (!pwCustomerId && auth.user?.id) {
			try {
				pwCustomerId = await getMyPaddleCustomerId();
			} catch {
				pwCustomerId = null;
			}
		}
		return getPaddle(pwCustomerId ? { pwCustomerId } : {});
	}

	async function loadPrices() {
		pricesLoading = true;
		pricesError = '';
		try {
			const paddle = await resolvePaddle();
			if (!paddle) throw new Error('Paddle failed to initialize.');

			const result = await fetchPriceMap(paddle);
			country = result.country;
			priceMap = result.priceMap;
		} catch (e) {
			pricesError = e instanceof Error ? e.message : 'Could not load prices.';
		} finally {
			pricesLoading = false;
		}
	}

	/**
	 * @param {import('$lib/paddle/tiers.js').Tier} t
	 */
	function priceLabelFor(t) {
		const id = priceIdFor(t, billingCycle);
		return priceMap[id] ?? '';
	}

	/**
	 * @param {import('$lib/paddle/tiers.js').Tier} t
	 */
	async function subscribe(t) {
		checkoutError = '';

		// Require login: entitlement + affiliate attribution depend on user_id,
		// which is only present when signed in. Never open anonymous checkout.
		const userId = auth.user?.id;
		if (!userId) {
			await goto(resolve('/login'));
			return;
		}

		checkoutBusy = t.id;
		try {
			const paddle = await resolvePaddle();
			if (!paddle) throw new Error('Paddle failed to initialize.');

			const priceId = priceIdFor(t, billingCycle);
			const email = auth.user?.email;

			paddle.Checkout.open({
				items: [{ priceId, quantity: 1 }],
				// Prefill the email only when the visitor is signed in.
				...(email ? { customer: { email } } : {}),
				// custom_data flows to the transaction + subscription and is read by
				// the payment-webhook to map events to our user and entitlement.
				// t.id is 'maker' | 'lifetime', matching our product_tier.
				customData: {
					user_id: userId,
					product_tier: t.id
				},
				settings: {
					displayMode: 'overlay',
					variant: 'one-page',
					theme: 'light',
					// successUrl must be an absolute http(s) URL.
					successUrl: `${window.location.origin}/welcome`
				}
			});
		} catch (e) {
			checkoutError = e instanceof Error ? e.message : 'Could not open checkout.';
		} finally {
			// The overlay takes over the screen; release the button shortly after.
			setTimeout(() => {
				if (checkoutBusy === t.id) checkoutBusy = '';
			}, 2500);
		}
	}

	// ---- Referral (existing feature, preserved) -------------------------------
	let referralInput = $state('');
	let referralBusy = $state(false);
	let referralError = $state('');
	let referralOk = $state('');
	/** @type {Record<string, unknown> | null} */
	let attribution = $state(null);

	const attributionLocked = $derived(Boolean(attribution?.locked_at));

	onMount(() => {
		const id = setInterval(() => {
			if (auth.loading) return;
			clearInterval(id);
			if (!auth.session) return;
			getMyReferralAttribution()
				.then((row) => {
					attribution = row;
				})
				.catch((err) => {
					console.warn('Referral attribution load failed', err);
				});
		}, 50);
		return () => clearInterval(id);
	});

	async function applyReferral() {
		referralError = '';
		referralOk = '';
		const code = referralInput.trim();
		if (!code) {
			referralError = 'Enter a referral code';
			return;
		}
		if (attributionLocked) {
			referralError = 'Referral attribution is locked and cannot be changed.';
			return;
		}
		referralBusy = true;
		try {
			const result = await applyManualReferralCode(code);
			if (result?.ok === false && result?.reason === 'locked') {
				referralError = 'Referral attribution is locked and cannot be changed.';
				attribution = {
					...attribution,
					locked_at: result.locked_at ?? attribution?.locked_at ?? true
				};
				return;
			}
			if (result?.ok === false) {
				referralError = result?.reason || 'Could not apply referral code';
				return;
			}
			referralOk = 'Referral code applied.';
			referralInput = '';
			attribution = await getMyReferralAttribution().catch(() => attribution);
		} catch (e) {
			referralError = e?.message || 'Could not apply referral code';
		} finally {
			referralBusy = false;
		}
	}
</script>

<svelte:head>
	<title>{pricingTitle}</title>
	<meta name="description" content={pricingDescription} />
	<meta property="og:title" content={pricingTitle} />
	<meta property="og:description" content={pricingDescription} />
	<meta name="twitter:title" content={pricingTitle} />
	<meta name="twitter:description" content={pricingDescription} />
</svelte:head>

<div class="site-page">
	<SiteHeader />

	<main class="site-section pricing">
		<p class="site-eyebrow">pick what suits you</p>
		<h1 class="site-page-title">Pricing</h1>
		<p class="lead">
			Start free with one tapestry pattern project. Upgrade when you want more crochet tapestry
			patterns on the go or full access to the gallery.
		</p>

		<div class="billing-toggle" role="group" aria-label="Billing cycle">
			<button
				type="button"
				class="toggle-btn"
				class:active={billingCycle === 'month'}
				aria-pressed={billingCycle === 'month'}
				onclick={() => (billingCycle = 'month')}
			>
				Monthly
			</button>
			<button
				type="button"
				class="toggle-btn"
				class:active={billingCycle === 'year'}
				aria-pressed={billingCycle === 'year'}
				onclick={() => (billingCycle = 'year')}
			>
				Yearly
			</button>
		</div>

		{#if pricesError}
			<p class="site-error">Prices unavailable: {pricesError}</p>
		{/if}
		{#if checkoutError}
			<p class="site-error">{checkoutError}</p>
		{/if}

		<div class="tiers">
			<!-- Free tier: no checkout -->
			<section class="tier" aria-labelledby="tier-free">
				<h2 id="tier-free">Free</h2>
				<p class="price">$0</p>
				<ul>
					<li>One project create on registration</li>
					<li>Deleting that project does not unlock another create</li>
					<li>Full studio tools on your project</li>
					<li>Gallery: view images and descriptions only</li>
					<li>Publish your project to the gallery</li>
				</ul>
				{#if !auth.session}
					<a class="site-btn" href={resolve('/login')}>Create free account</a>
				{:else if tier === 'free'}
					<p class="status">Your current plan</p>
				{/if}
			</section>

			<!-- Paid tiers: localized prices + Paddle Checkout -->
			{#each tiers as t (t.id)}
				<section
					class="tier"
					class:tier-featured={t.featured}
					aria-labelledby={`tier-${t.id}`}
				>
					{#if t.featured}
						<span class="tier-badge">best value</span>
					{/if}
					<h2 id={`tier-${t.id}`}>{t.name}</h2>

					<p class="price">
						{#if pricesLoading}
							<span class="price-loading">Loading…</span>
						{:else if priceLabelFor(t)}
							{priceLabelFor(t)}
							<span class="price-note">
								{#if t.oneTime}
									one-time
								{:else if billingCycle === 'month'}
									/month
								{:else}
									/year
								{/if}
							</span>
						{:else}
							<span class="price-loading">—</span>
						{/if}
					</p>

					<ul>
						{#each t.features as feature (feature)}
							<li>{feature}</li>
						{/each}
					</ul>

					{#if tier === t.id}
						<p class="status">{t.name} plan active</p>
						<a class="site-btn" href={resolve('/studio/load')}>Open studio</a>
					{:else if t.id === 'maker' && tier === 'lifetime'}
						<p class="status">Included under Lifetime</p>
					{:else if auth.loading}
						<p class="site-muted">Checking session…</p>
					{:else if !auth.session}
						<a class="site-btn site-btn-primary" href={resolve('/login')}>Log in to subscribe</a>
					{:else}
						<button
							type="button"
							class="site-btn site-btn-primary"
							disabled={pricesLoading || checkoutBusy === t.id}
							onclick={() => subscribe(t)}
						>
							{checkoutBusy === t.id ? 'Opening…' : 'Subscribe'}
						</button>
					{/if}
				</section>
			{/each}
		</div>

		{#if auth.session && !auth.loading}
			<section class="referral" aria-labelledby="referral-heading">
				<h2 id="referral-heading">Referral code</h2>
				{#if attributionLocked}
					<p class="site-muted">
						Your referral attribution is locked and cannot be changed.
						{#if attribution?.source}
							<span class="attr-meta">(source: {String(attribution.source)})</span>
						{/if}
					</p>
				{:else}
					{#if attribution}
						<p class="site-muted attr-status">
							Current: {String(attribution.source || 'unknown')}
							{#if attribution.locked_at}
								· locked
							{:else}
								· unlocked
							{/if}
						</p>
					{/if}
					<div class="referral-row">
						<label class="site-field">
							Code
							<input
								type="text"
								bind:value={referralInput}
								autocomplete="off"
								spellcheck="false"
								disabled={referralBusy}
							/>
						</label>
						<button
							type="button"
							class="site-btn site-btn-primary"
							disabled={referralBusy}
							onclick={applyReferral}
						>
							{referralBusy ? 'Applying…' : 'Apply'}
						</button>
					</div>
				{/if}
				{#if referralError}
					<p class="site-error">{referralError}</p>
				{/if}
				{#if referralOk}
					<p class="site-ok">{referralOk}</p>
				{/if}
			</section>
		{/if}
	</main>

	<SiteFooter />
</div>

<style>
	.lead {
		margin: 0 0 28px;
		color: var(--site-muted);
		max-width: 36rem;
		font-size: 1.1rem;
	}

	.billing-toggle {
		display: inline-flex;
		gap: 4px;
		padding: 5px;
		margin: 0 0 40px;
		border-radius: 999px;
		background: var(--site-surface-2);
		border: 1px solid var(--site-border);
	}

	.toggle-btn {
		appearance: none;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--site-muted);
		font-family: var(--site-font-body);
		font-size: 0.95rem;
		font-weight: 800;
		padding: 8px 22px;
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}
	.toggle-btn:hover {
		color: var(--site-text);
	}

	.toggle-btn.active {
		background: var(--site-surface);
		color: var(--site-accent);
		box-shadow: var(--site-shadow);
	}

	.tiers {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 20px;
		align-items: stretch;
	}

	.tier {
		position: relative;
		padding: 32px 26px 26px;
		background: var(--site-surface);
		border: 1px solid var(--site-border);
		border-radius: var(--site-radius);
		box-shadow: var(--site-shadow);
		display: flex;
		flex-direction: column;
		align-items: flex-start;
	}
	.tier::before {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		top: 0;
		height: 10px;
		border-radius: var(--site-radius) var(--site-radius) 0 0;
		background: var(--site-sage-soft);
	}
	.tier:nth-child(2)::before {
		background: var(--site-mustard-soft);
	}

	.tier-featured {
		border: 2px dashed var(--site-accent);
	}
	.tier-featured::before,
	.tier-featured:nth-child(2)::before {
		background: var(--site-accent-soft);
	}

	.tier-badge {
		position: absolute;
		top: -14px;
		right: 18px;
		padding: 2px 12px;
		border-radius: 999px;
		background: var(--site-accent);
		color: #fff;
		font-family: var(--site-font-hand);
		font-size: 1.2rem;
		transform: rotate(3deg);
	}

	.tier h2 {
		font-size: 1.5rem;
		margin: 0 0 6px;
	}

	.price {
		font-family: var(--site-font-display);
		font-size: 2.1rem;
		font-weight: 700;
		margin: 0 0 20px;
		color: var(--site-text);
	}

	.price-loading {
		color: var(--site-muted);
		font-size: 1.15rem;
		font-weight: 600;
	}

	.price-note {
		font-family: var(--site-font-body);
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--site-muted);
		margin-left: 4px;
	}

	.tier ul {
		margin: 0 0 24px;
		padding: 0;
		list-style: none;
		color: var(--site-text);
		font-size: 0.95rem;
		flex: 1;
		align-self: stretch;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.tier li {
		position: relative;
		padding-left: 28px;
	}
	.tier li::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0.2em;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--site-sage-soft)
			url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath d='M5 10.5l3 3 7-7' fill='none' stroke='%2355784a' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")
			center / 12px no-repeat;
	}

	.status {
		margin: 0 0 12px;
		font-family: var(--site-font-hand);
		font-size: 1.4rem;
		color: var(--site-ok);
	}

	.referral {
		margin-top: 48px;
		max-width: 460px;
		padding: 24px;
		border-radius: var(--site-radius);
		background: var(--site-surface-2);
		border: 2px dashed var(--site-border-strong);
	}

	.referral h2 {
		font-size: 1.3rem;
		margin: 0 0 12px;
	}

	.attr-status,
	.attr-meta {
		font-size: 0.9rem;
		margin: 0 0 12px;
	}

	.referral-row {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: flex-end;
	}

	.referral-row label {
		flex: 1;
		min-width: 160px;
	}

	@media (max-width: 900px) {
		.tiers {
			grid-template-columns: 1fr;
		}
	}
</style>
