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
	import '$lib/styles/site.css';

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

<div class="site-page">
	<SiteHeader />

	<main class="site-section pricing">
		<h1>Pricing</h1>
		<p class="lead">
			Start free with one project. Upgrade when you need more concurrent projects or full gallery
			access.
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
						<label>
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
	.pricing h1 {
		font-family: var(--site-font-display);
		font-weight: 800;
		font-size: clamp(2rem, 5vw, 3rem);
		letter-spacing: -0.03em;
		margin: 0 0 12px;
	}

	.lead {
		margin: 0 0 24px;
		color: var(--site-muted);
		max-width: 36rem;
	}

	.billing-toggle {
		display: inline-flex;
		gap: 4px;
		padding: 4px;
		margin: 0 0 32px;
		border: 1px solid var(--site-border);
		background: var(--site-bg);
	}

	.toggle-btn {
		appearance: none;
		border: 0;
		background: transparent;
		color: var(--site-muted);
		font-family: var(--site-font-mono);
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 8px 18px;
		cursor: pointer;
	}

	.toggle-btn.active {
		background: var(--site-accent);
		color: var(--site-bg);
	}

	.tiers {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 12px;
		max-width: 960px;
		align-items: stretch;
	}

	.tier {
		padding: 28px 24px;
		background: var(--site-bg);
		border: 1px solid var(--site-border);
		display: flex;
		flex-direction: column;
	}

	.tier-featured {
		background: var(--site-surface);
		border-color: var(--site-accent);
	}

	.tier h2 {
		font-family: var(--site-font-display);
		font-size: 1.35rem;
		margin: 0 0 8px;
	}

	.price {
		font-family: var(--site-font-display);
		font-size: 2rem;
		font-weight: 700;
		margin: 0 0 20px;
		color: var(--site-text);
	}

	.price-loading {
		color: var(--site-muted);
		font-size: 1.25rem;
	}

	.price-note {
		font-size: 0.75rem;
		font-weight: 400;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--site-muted);
		margin-left: 6px;
	}

	.tier ul {
		margin: 0 0 24px;
		padding: 0;
		list-style: none;
		color: var(--site-muted);
		font-size: 0.85rem;
		flex: 1;
	}

	.tier li {
		padding: 8px 0;
		border-top: 1px solid var(--site-border);
	}

	.tier li:last-child {
		border-bottom: 1px solid var(--site-border);
	}

	.status {
		margin: 0 0 12px;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--site-accent);
	}

	.fineprint {
		margin: 12px 0 0;
		font-size: 0.7rem;
		color: var(--site-muted);
		max-width: 22rem;
	}

	.referral {
		margin-top: 40px;
		max-width: 420px;
		padding-top: 28px;
		border-top: 1px solid var(--site-border);
	}

	.referral h2 {
		font-family: var(--site-font-display);
		font-size: 1.15rem;
		margin: 0 0 12px;
	}

	.attr-status,
	.attr-meta {
		font-size: 0.75rem;
		margin: 0 0 12px;
	}

	.referral-row {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: flex-end;
	}

	.referral-row label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex: 1;
		min-width: 160px;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--site-muted);
	}

	.referral-row input {
		appearance: none;
		border: 1px solid var(--site-border);
		background: var(--site-surface);
		color: var(--site-text);
		padding: 10px 12px;
		font-family: var(--site-font-mono);
		font-size: 0.9rem;
		width: 100%;
	}

	.referral-row input:focus {
		outline: 1px solid var(--site-accent);
	}

	@media (max-width: 900px) {
		.tiers {
			grid-template-columns: 1fr;
		}
	}
</style>
