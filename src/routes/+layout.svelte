<script>
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { initAuth } from '$lib/supabase/session.svelte.js';
	import { captureReferralFromUrl } from '$lib/referral/index.js';
	import '$lib/styles/reset.css';

	let { children } = $props();

	onMount(() => {
		initAuth();
		captureReferralFromUrl().catch((err) => {
			console.warn('Referral capture failed', err);
		});
	});
</script>

<svelte:head>
	<title>PixelCount Studio</title>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
