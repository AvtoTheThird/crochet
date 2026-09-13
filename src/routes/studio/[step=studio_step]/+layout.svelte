<script>
	import Studio from '$lib/components/Studio.svelte';

	let { children } = $props();
</script>

<Studio />
{@render children()}
