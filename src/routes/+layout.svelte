<script>
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { initAuth } from '$lib/supabase/session.svelte.js';
	import { captureReferralFromUrl } from '$lib/referral/index.js';
	import DialogHost from '$lib/ui/DialogHost.svelte';
	import { company } from '$lib/site/company.js';
	import { seo, canonicalUrl } from '$lib/site/seo.js';
	import '$lib/styles/reset.css';

	let { children } = $props();

	const pageCanonical = $derived(canonicalUrl(page.url.pathname));

	onMount(() => {
		initAuth();
		captureReferralFromUrl().catch((err) => {
			console.warn('Referral capture failed', err);
		});
	});
</script>

<svelte:head>
	<title>{seo.defaultTitle}</title>
	<meta name="description" content={seo.defaultDescription} />
	<meta name="keywords" content={seo.keywords} />
	<meta name="author" content={company.name} />
	<link rel="canonical" href={pageCanonical} />
	<link rel="icon" href={favicon} />

	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={seo.siteName} />
	<meta property="og:locale" content={seo.locale} />
	<meta property="og:url" content={pageCanonical} />
	<meta property="og:title" content={seo.defaultTitle} />
	<meta property="og:description" content={seo.defaultDescription} />

	<meta name="twitter:card" content={seo.twitterCard} />
	<meta name="twitter:title" content={seo.defaultTitle} />
	<meta name="twitter:description" content={seo.defaultDescription} />
</svelte:head>

{@render children()}

<DialogHost />
