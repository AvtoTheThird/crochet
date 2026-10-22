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
		width: 100%;
		max-width: 800px;
		margin: 0 auto;
		padding: 48px 16px 64px;
	}
	h1 {
		font-size: clamp(2rem, 5vw, 2.75rem);
		margin: 0 0 8px;
	}
	.legal-updated {
		font-size: 0.9rem;
		color: var(--site-muted);
		margin: 0 0 28px;
	}
	.legal-body {
		padding: clamp(20px, 4vw, 40px);
		border-radius: var(--site-radius);
		background: var(--site-surface);
		border: 1px solid var(--site-border);
		box-shadow: var(--site-shadow);
	}
	.legal-body :global(h2) {
		font-size: 1.35rem;
		margin: 32px 0 8px;
	}
	.legal-body :global(h2:first-child) {
		margin-top: 0;
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
