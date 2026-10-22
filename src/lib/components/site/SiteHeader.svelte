<script>
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { auth } from '$lib/supabase/session.svelte.js';
	import { signOut } from '$lib/supabase/auth.js';
	import BrandMark from './BrandMark.svelte';

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
	const firstName = $derived(auth.profile?.first_name || auth.profile?.username || '');
</script>

<header class="site-header">
	<a class="site-brand" href={resolve('/')}>
		<BrandMark />
		Qsovio
	</a>
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
					<img class="site-avatar" src={avatarUrl} alt="" />
				{:else}
					<span class="site-avatar site-avatar-fallback">{initial}</span>
				{/if}
				{#if firstName}
					<span class="site-avatar-name">{firstName}</span>
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
		gap: 8px;
		text-decoration: none;
	}
	.site-avatar-name {
		max-width: 100px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.9rem;
		color: var(--site-text);
	}
	.site-avatar {
		width: 34px;
		height: 34px;
		border-radius: 50%;
		object-fit: cover;
		border: 2px solid var(--site-mustard);
		display: inline-block;
	}
	.site-avatar-fallback {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--site-mustard-soft);
		color: var(--site-text);
		font-size: 0.95rem;
		font-weight: 800;
	}
	@media (max-width: 560px) {
		.site-avatar-name {
			display: none;
		}
	}
</style>
