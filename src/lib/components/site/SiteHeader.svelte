<script>
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { auth } from '$lib/supabase/session.svelte.js';
	import { signOut } from '$lib/supabase/auth.js';

	async function logout() {
		await signOut();
		goto(resolve('/'));
	}

	const avatarUrl = $derived(auth.profile?.avatar_url ?? '');
	const initial = $derived(
		(auth.profile?.first_name || auth.profile?.username || auth.user?.email || '?')
			.charAt(0)
			.toUpperCase()
	);
</script>

<header class="site-header">
	<a class="site-brand" href={resolve('/')}>Qsovio</a>
	<nav class="site-nav" aria-label="Main">
		<a href={resolve('/gallery')}>Gallery</a>
		<a href={resolve('/pricing')}>Pricing</a>
		{#if auth.loading}
			<span class="site-muted">…</span>
		{:else if auth.session}
			<a href={resolve('/studio/load')}>Studio</a>
			<button type="button" class="site-nav-btn" onclick={logout}>Log out</button>
			<a class="site-avatar-link" href={resolve('/profile')} aria-label="Profile" title="Profile">
				{#if avatarUrl}
					<img class="site-avatar" src={avatarUrl} alt="Profile" />
				{:else}
					<span class="site-avatar site-avatar-fallback">{initial}</span>
				{/if}
			</a>
		{:else}
			<a href={resolve('/login')}>Log in</a>
			<a class="site-nav-btn site-nav-btn-primary" href={resolve('/login')}>Get started</a>
		{/if}
	</nav>
</header>

<style>
	.site-avatar-link {
		display: inline-flex;
		align-items: center;
		line-height: 0;
	}
	.site-avatar {
		width: 30px;
		height: 30px;
		border-radius: 50%;
		object-fit: cover;
		border: 1px solid var(--site-border);
		display: inline-block;
	}
	.site-avatar-fallback {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--site-surface);
		color: var(--site-text);
		font-family: var(--site-font-mono);
		font-size: 0.8rem;
		font-weight: 700;
	}
</style>
