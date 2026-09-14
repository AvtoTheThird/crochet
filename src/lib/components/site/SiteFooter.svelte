<script>
	import { resolve } from '$app/paths';
	import { auth } from '$lib/supabase/session.svelte.js';
</script>

<footer class="site-footer">
	<div>PixelCount Studio</div>
	<div class="site-footer-links">
		<a href={resolve('/gallery')}>Gallery</a>
		<a href={resolve('/pricing')}>Pricing</a>
		{#if auth.session}
			<a href={resolve('/studio/load')}>Studio</a>
		{:else}
			<a href={resolve('/login')}>Log in</a>
		{/if}
	</div>
</footer>
