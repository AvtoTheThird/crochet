<script>
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { initAuth } from '$lib/supabase/session.svelte.js';
	import '$lib/styles/reset.css';

	let { children } = $props();

	onMount(() => {
		initAuth();
	});
</script>

<svelte:head>
	<title>PixelCount Studio</title>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
