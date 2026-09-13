<script>
	import favicon from '$lib/assets/favicon.svg';
	import '$lib/studio/styles.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>PixelCount Studio</title>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
