<script>
	import SiteHeader from './SiteHeader.svelte';
	import SiteFooter from './SiteFooter.svelte';
	import '$lib/styles/site.css';

	/** @type {{ title: string, updated?: string, children: import('svelte').Snippet }} */
	let { title, updated, children } = $props();
</script>

<div class="site-page">
	<SiteHeader />

	<main class="legal-main">
		<h1>{title}</h1>
		{#if updated}
			<p class="legal-updated">Last updated: {updated}</p>
		{/if}
		<article class="legal-body">
			{@render children()}
		</article>
	</main>

	<SiteFooter />
</div>

<style>
	.legal-main {
		max-width: 760px;
		margin: 0 auto;
		padding: 48px 24px 64px;
	}
	h1 {
		font-family: var(--site-font-display);
		font-weight: 800;
		font-size: 2rem;
		letter-spacing: -0.03em;
		margin: 0 0 8px;
	}
	.legal-updated {
		font-family: var(--site-font-mono);
		font-size: 0.75rem;
		color: var(--site-muted);
		margin: 0 0 32px;
	}
	.legal-body :global(h2) {
		font-family: var(--site-font-display);
		font-weight: 700;
		font-size: 1.2rem;
		letter-spacing: -0.02em;
		margin: 32px 0 8px;
	}
	.legal-body :global(p),
	.legal-body :global(li) {
		font-size: 0.95rem;
		line-height: 1.6;
		color: var(--site-text);
	}
	.legal-body :global(ul) {
		padding-left: 20px;
		margin: 8px 0;
	}
	.legal-body :global(li) {
		margin: 4px 0;
	}
	.legal-body :global(a) {
		color: var(--site-accent);
	}
</style>
