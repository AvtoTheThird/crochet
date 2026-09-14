<script>
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { auth } from '$lib/supabase/session.svelte.js';
	import { signOut } from '$lib/supabase/auth.js';

	async function logout() {
		await signOut();
		goto(resolve('/'));
	}
</script>

<header class="site-header">
	<a class="site-brand" href={resolve('/')}>PixelCount Studio</a>
	<nav class="site-nav" aria-label="Main">
		<a href={resolve('/gallery')}>Gallery</a>
		<a href={resolve('/pricing')}>Pricing</a>
		{#if auth.loading}
			<span class="site-muted">…</span>
		{:else if auth.session}
			<a href={resolve('/studio/load')}>Studio</a>
			<button type="button" class="site-nav-btn" onclick={logout}>Log out</button>
		{:else}
			<a href={resolve('/login')}>Log in</a>
			<a class="site-nav-btn site-nav-btn-primary" href={resolve('/login')}>Get started</a>
		{/if}
	</nav>
</header>
