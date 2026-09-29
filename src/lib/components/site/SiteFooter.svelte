<script>
	import { resolve } from '$app/paths';
	import { auth } from '$lib/supabase/session.svelte.js';
	import { company } from '$lib/site/company.js';
</script>

<footer class="site-footer">
	<div class="site-footer-brand">
		<div>{company.name}</div>
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
		gap: 2px;
	}
	.site-footer-contact {
		font-size: 0.8rem;
		color: var(--site-muted);
	}
</style>
