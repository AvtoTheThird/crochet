<script>
	import { resolve } from '$app/paths';
	import { auth } from '$lib/supabase/session.svelte.js';
	import { company } from '$lib/site/company.js';
	import BrandMark from './BrandMark.svelte';
</script>

<footer class="site-footer">
	<div class="site-footer-brand">
		<div class="site-footer-name">
			<BrandMark size={24} />
			{company.name}
		</div>
		<p class="site-footer-tag">Made with love for people who make things.</p>
		<a class="site-footer-contact" href="mailto:{company.supportEmail}">{company.supportEmail}</a>
	</div>
	<div class="site-footer-links">
		<a href={resolve('/gallery')}>Gallery</a>
		<a href={resolve('/pricing')}>Pricing</a>
		{#if auth.session}
			<a href={resolve('/studio/load')}>Studio</a>
		{:else}
			<a href={resolve('/login')}>Log in</a>
		{/if}
		<a href={resolve('/legal/terms')}>Terms</a>
		<a href={resolve('/legal/privacy')}>Privacy</a>
		<a href={resolve('/legal/refunds')}>Refunds</a>
	</div>
</footer>

<style>
	.site-footer-brand {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.site-footer-name {
		display: flex;
		align-items: center;
		gap: 8px;
		font-family: var(--site-font-display);
		font-weight: 600;
		font-size: 1.1rem;
		color: var(--site-text);
	}
	.site-footer-tag {
		margin: 0;
		font-family: var(--site-font-hand);
		font-size: 1.25rem;
		color: var(--site-muted);
	}
</style>
