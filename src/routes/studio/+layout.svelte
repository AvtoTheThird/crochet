<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { auth } from '$lib/supabase/session.svelte.js';
	import '$lib/studio/styles.css';

	let { children } = $props();

	onMount(() => {
		document.documentElement.classList.add('studio-shell');
		return () => {
			document.documentElement.classList.remove('studio-shell');
		};
	});

	$effect(() => {
		if (!auth.loading && !auth.session) {
			goto(resolve('/login'));
		}
	});
</script>

{#if auth.loading}
	<main class="studio-boot">Loading…</main>
{:else if auth.session}
	{@render children()}
{:else}
	<main class="studio-boot">Redirecting to login…</main>
{/if}

<style>
	.studio-boot {
		min-height: 100vh;
		display: grid;
		place-items: center;
		background: #0d0d0f;
		color: #888898;
		font-family: system-ui, sans-serif;
	}
</style>
