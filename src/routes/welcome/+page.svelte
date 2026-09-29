<script>
	import { resolve } from '$app/paths';
	import SiteHeader from '$lib/components/site/SiteHeader.svelte';
	import SiteFooter from '$lib/components/site/SiteFooter.svelte';
	import '$lib/styles/site.css';
</script>

<svelte:head>
	<title>Welcome — Qsovio</title>
</svelte:head>

<div class="site-page">
	<SiteHeader />

	<main class="site-section welcome">
		<h1>You're all set 🎉</h1>
		<p class="lead">
			Thanks for your purchase. Your payment was received and your receipt is on its way by email.
		</p>
		<p class="site-muted note">
			Your plan unlocks once payment is confirmed. If your new limits aren't visible yet, give it a
			moment and refresh — activation is applied by a verified payment webhook.
		</p>

		<div class="actions">
			<a class="site-btn site-btn-primary" href={resolve('/studio/load')}>Open studio</a>
			<a class="site-btn" href={resolve('/pricing')}>Back to pricing</a>
		</div>
	</main>

	<SiteFooter />
</div>

<style>
	.welcome h1 {
		font-family: var(--site-font-display);
		font-weight: 800;
		font-size: clamp(2rem, 5vw, 3rem);
		letter-spacing: -0.03em;
		margin: 0 0 12px;
	}

	.lead {
		margin: 0 0 12px;
		color: var(--site-text);
		max-width: 40rem;
	}

	.note {
		margin: 0 0 28px;
		max-width: 40rem;
		font-size: 0.85rem;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
	}
</style>
