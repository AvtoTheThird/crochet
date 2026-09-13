<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getSupabase } from '$lib/supabase/client.js';
	import { syncProviderToken } from '$lib/supabase/auth.js';
	import { setAuthSession } from '$lib/supabase/session.svelte.js';

	let message = $state('Completing sign-in…');

	onMount(async () => {
		try {
			const supabase = getSupabase();
			const url = new URL(window.location.href);
			const code = url.searchParams.get('code');

			if (code) {
				const { data, error } = await supabase.auth.exchangeCodeForSession(code);
				if (error) throw error;
				await setAuthSession(data.session);
				if (data.session) await syncProviderToken(data.session);
			} else {
				const { data: sessionData, error } = await supabase.auth.getSession();
				if (error) throw error;
				if (!sessionData.session) {
					throw new Error('No auth code or session found');
				}
				await setAuthSession(sessionData.session);
				await syncProviderToken(sessionData.session);
			}

			goto('/studio/load', { replaceState: true });
		} catch (e) {
			message = e?.message || 'Sign-in failed';
			setTimeout(() => goto('/', { replaceState: true }), 2500);
		}
	});
</script>

<main class="callback">
	<p>{message}</p>
</main>

<style>
	.callback {
		min-height: 100vh;
		display: grid;
		place-items: center;
		background: #0d0d0f;
		color: #e8e8f0;
		font-family: system-ui, sans-serif;
	}
</style>
