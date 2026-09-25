<script>
	import { onMount } from 'svelte';
	import { auth } from '$lib/supabase/session.svelte.js';
	import { currentTier } from '$lib/supabase/entitlements.js';
	import {
		applyManualReferralCode,
		getMyReferralAttribution
	} from '$lib/referral/index.js';
	import { resolve } from '$app/paths';
	import SiteHeader from '$lib/components/site/SiteHeader.svelte';
	import SiteFooter from '$lib/components/site/SiteFooter.svelte';
	import '$lib/styles/site.css';

	let referralInput = $state('');
	let referralBusy = $state(false);
	let referralError = $state('');
	let referralOk = $state('');
	/** @type {Record<string, unknown> | null} */
	let attribution = $state(null);

	const tier = $derived(currentTier());
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

		<div class="tiers">
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

			<section class="tier" aria-labelledby="tier-maker">
				<h2 id="tier-maker">Maker</h2>
				<p class="price">$2.99</p>
				<ul>
					<li>Up to five concurrent projects</li>
					<li>Delete a project to free a slot</li>
					<li>Full gallery pattern data</li>
					<li>Add gallery patterns to your projects</li>
					<li>Same studio tools</li>
				</ul>

				{#if auth.loading}
					<p class="site-muted">Checking session…</p>
				{:else if !auth.session}
					<a class="site-btn site-btn-primary" href={resolve('/login')}>Log in to upgrade</a>
				{:else if tier === 'maker'}
					<p class="status">Maker plan active</p>
					<a class="site-btn" href={resolve('/studio/load')}>Open studio</a>
				{:else if tier === 'lifetime'}
					<p class="status">Included under Lifetime</p>
				{:else}
					<button type="button" class="site-btn site-btn-primary" disabled>
						Checkout coming soon
					</button>
					<p class="fineprint">
						Paid upgrades arrive with Flitt checkout. Dummy upgrades are disabled for now.
					</p>
				{/if}
			</section>

			<section class="tier tier-featured" aria-labelledby="tier-lifetime">
				<h2 id="tier-lifetime">Lifetime</h2>
				<p class="price">$9.99 <span class="price-note">one-time</span></p>
				<ul>
					<li>Up to twenty concurrent projects</li>
					<li>Delete a project to free a slot</li>
					<li>Full gallery pattern data</li>
					<li>Add gallery patterns to your projects</li>
					<li>Same studio tools</li>
				</ul>

				{#if auth.loading}
					<p class="site-muted">Checking session…</p>
				{:else if !auth.session}
					<a class="site-btn site-btn-primary" href={resolve('/login')}>Log in to upgrade</a>
				{:else if tier === 'lifetime'}
					<p class="status">Lifetime plan active</p>
					<a class="site-btn" href={resolve('/studio/load')}>Open studio</a>
				{:else}
					<button type="button" class="site-btn site-btn-primary" disabled>
						Checkout coming soon
					</button>
					<p class="fineprint">
						Paid upgrades arrive with Flitt checkout. Dummy upgrades are disabled for now.
					</p>
				{/if}
			</section>
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
		margin: 0 0 40px;
		color: var(--site-muted);
		max-width: 36rem;
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
