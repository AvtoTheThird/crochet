<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getSupabase } from '$lib/supabase/client.js';
	import { syncProviderToken } from '$lib/supabase/auth.js';
	import { setAuthSession } from '$lib/supabase/session.svelte.js';
	import { applyReferralCookieIfPresent } from '$lib/referral/index.js';

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

			try {
				await applyReferralCookieIfPresent();
			} catch (refErr) {
				console.warn('Referral apply failed', refErr);
			}

			goto(resolve('/studio/load'), { replaceState: true });
		} catch (e) {
			message = e?.message || 'Sign-in failed';
			setTimeout(() => goto(resolve('/'), { replaceState: true }), 2500);
		}
	});
</script>

<svelte:head>
	<meta name="robots" content="noindex, nofollow" />
	<title>Signing in · Qsovio</title>
</svelte:head>

<main class="callback">
	<p>{message}</p>
</main>

<style>
	.callback {
		min-height: 100vh;
		display: grid;
		place-items: center;
		background: #fbf6ef;
		color: #7f6c62;
		font-family: 'Nunito', system-ui, sans-serif;
		font-size: 1.1rem;
		font-weight: 600;
	}
</style>
