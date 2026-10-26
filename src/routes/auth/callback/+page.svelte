<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getSupabase } from '$lib/supabase/client.js';
	import { syncProviderToken } from '$lib/supabase/auth.js';
	import { setAuthSession } from '$lib/supabase/session.svelte.js';
	import { applyReferralCookieIfPresent } from '$lib/referral/index.js';

	let message = $state('Completing sign-in…');

	/**
	 * @param {import('@supabase/supabase-js').Session} session
	 */
	async function finishSignIn(session) {
		await setAuthSession(session);
		await syncProviderToken(session);

		try {
			await applyReferralCookieIfPresent();
		} catch (refErr) {
			console.warn('Referral apply failed', refErr);
		}

		goto(resolve('/studio/load'), { replaceState: true });
	}

	/** Remove OAuth `code` from the URL so a refresh does not re-exchange. */
	function clearCodeFromUrl() {
		const url = new URL(window.location.href);
		if (!url.searchParams.has('code')) return;
		url.searchParams.delete('code');
		const qs = url.searchParams.toString();
		window.history.replaceState({}, '', url.pathname + (qs ? `?${qs}` : '') + url.hash);
	}

	onMount(async () => {
		try {
			const supabase = getSupabase();
			const url = new URL(window.location.href);
			const code = url.searchParams.get('code');

			/** @type {import('@supabase/supabase-js').Session | null} */
			let session = null;

			if (code) {
				const { data, error } = await supabase.auth.exchangeCodeForSession(code);
				if (error) {
					// PKCE/verifier races (or double-exchange): proceed if a session already exists
					const { data: sessionData } = await supabase.auth.getSession();
					if (sessionData?.session) {
						session = sessionData.session;
					} else {
						throw error;
					}
				} else {
					session = data.session ?? null;
				}
				if (session) clearCodeFromUrl();
			} else {
				const { data: sessionData, error } = await supabase.auth.getSession();
				if (error) throw error;
				session = sessionData.session;
			}

			if (!session) {
				throw new Error('No auth code or session found');
			}

			await finishSignIn(session);
		} catch (e) {
			// Only flash an error when there is truly no session
			try {
				const { data: sessionData } = await getSupabase().auth.getSession();
				if (sessionData?.session) {
					clearCodeFromUrl();
					await finishSignIn(sessionData.session);
					return;
				}
			} catch {
				/* fall through to error UI */
			}

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
