<script>
	import { auth } from '$lib/supabase/session.svelte.js';
	import {
		upgradeTierDummy,
		currentTier,
		isPaid
	} from '$lib/supabase/entitlements.js';
	import { resolve } from '$app/paths';
	import SiteHeader from '$lib/components/site/SiteHeader.svelte';
	import SiteFooter from '$lib/components/site/SiteFooter.svelte';
	import '$lib/styles/site.css';

	let busy = $state(/** @type {null | 'maker' | 'lifetime'} */ (null));
	let errorMsg = $state('');
	let okMsg = $state('');

	const tier = $derived(currentTier());
	const paid = $derived(isPaid());

	/**
	 * @param {'maker' | 'lifetime'} next
	 */
	async function upgrade(next) {
		errorMsg = '';
		okMsg = '';
		busy = next;
		try {
			await upgradeTierDummy(next);
			okMsg =
				next === 'lifetime'
					? 'Lifetime plan is active. You can keep up to twenty projects at once.'
					: 'Maker plan is active. You can keep up to five projects at once.';
		} catch (e) {
			errorMsg = e?.message || 'Upgrade failed';
		} finally {
			busy = null;
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
					<button
						type="button"
						class="site-btn site-btn-primary"
						disabled={busy !== null}
						onclick={() => upgrade('maker')}
					>
						{busy === 'maker' ? 'Upgrading…' : 'Upgrade to Maker'}
					</button>
					<p class="fineprint">
						Dummy checkout for now. Stripe billing will replace this later. No charge is taken
						today.
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
					<button
						type="button"
						class="site-btn site-btn-primary"
						disabled={busy !== null}
						onclick={() => upgrade('lifetime')}
					>
						{busy === 'lifetime' ? 'Upgrading…' : 'Get Lifetime'}
					</button>
					<p class="fineprint">
						Dummy checkout for now. Stripe billing will replace this later. No charge is taken
						today.
					</p>
				{/if}
			</section>
		</div>

		{#if errorMsg}
			<p class="site-error">{errorMsg}</p>
		{/if}
		{#if okMsg}
			<p class="site-ok">{okMsg}</p>
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

	@media (max-width: 900px) {
		.tiers {
			grid-template-columns: 1fr;
		}
	}
</style>
