<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { auth } from '$lib/supabase/session.svelte.js';
	import { signInWithPassword, signUpWithPassword, finalizeSignupReferral } from '$lib/supabase/auth.js';
	import { lookupReferralCode } from '$lib/referral/index.js';
	import { setReferralCookie } from '$lib/referral/cookie.js';
	import SiteHeader from '$lib/components/site/SiteHeader.svelte';
	import SiteFooter from '$lib/components/site/SiteFooter.svelte';
	import '$lib/styles/site.css';
	let mode = $state(/** @type {'login' | 'signup'} */ ('login'));
	let errorMsg = $state('');
	let infoMsg = $state('');
	let busy = $state(false);

	let identifier = $state('');
	let email = $state('');
	let username = $state('');
	let password = $state('');
	let firstName = $state('');
	let lastName = $state('');
	let referralCode = $state('');

	onMount(() => {
		const id = setInterval(() => {
			if (auth.loading) return;
			clearInterval(id);
			if (auth.session) goto(resolve('/studio/load'));
		}, 50);
		return () => clearInterval(id);
	});

	function switchMode(next) {
		mode = next;
		errorMsg = '';
		infoMsg = '';
	}

	async function submit(e) {
		e.preventDefault();
		errorMsg = '';
		infoMsg = '';
		busy = true;
		try {
			if (mode === 'login') {
				await signInWithPassword(identifier, password);
				goto(resolve('/studio/load'));
			} else {
				const manual = referralCode.trim();
				if (manual) {
					const looked = await lookupReferralCode(manual);
					if (!looked?.valid) {
						throw new Error('Invalid referral code');
					}
				}
				const data = await signUpWithPassword({
					email,
					password,
					username,
					firstName,
					lastName
				});
				if (data.session) {
					try {
						await finalizeSignupReferral(manual || null);
					} catch (refErr) {
						console.warn('Referral apply failed', refErr);
					}
					goto(resolve('/studio/load'));
				} else {
					if (manual) {
						try {
							const looked = await lookupReferralCode(manual);
							if (looked?.valid && looked.code) setReferralCookie(looked.code);
						} catch (refErr) {
							console.warn('Referral cookie save failed', refErr);
						}
					}
					infoMsg =
						'Account created. Check your email to confirm, then log in. (Or disable email confirmation in Supabase Auth settings for instant access.)';
					mode = 'login';
					identifier = email;
					password = '';
				}
			}
		} catch (err) {
			errorMsg = err?.message || 'Something went wrong';
		} finally {
			busy = false;
		}
	}
</script>

<div class="site-page">
	<SiteHeader />

	<main class="login-main">
		<div class="login-card site-card">
		<p class="site-eyebrow">{mode === 'login' ? 'welcome back!' : 'so glad you’re here'}</p>
		<h1>{mode === 'login' ? 'Log in' : 'Create your account'}</h1>
		<p class="site-muted intro">
			Free accounts include one project. Upgrade anytime for more projects on the go.
		</p>

		{#if auth.loading}
			<p class="site-muted">Checking session…</p>
		{:else}
			<div class="tabs" role="tablist">
				<button
					type="button"
					class:active={mode === 'login'}
					onclick={() => switchMode('login')}
				>
					Log in
				</button>
				<button
					type="button"
					class:active={mode === 'signup'}
					onclick={() => switchMode('signup')}
				>
					Sign up
				</button>
			</div>

			<form class="auth-form" onsubmit={submit}>
				{#if mode === 'login'}
					<label>
						Email or username
						<input type="text" bind:value={identifier} autocomplete="username" required />
					</label>
					<label>
						Password
						<input
							type="password"
							bind:value={password}
							autocomplete="current-password"
							required
						/>
					</label>
				{:else}
					<label>
						First name
						<input type="text" bind:value={firstName} autocomplete="given-name" />
					</label>
					<label>
						Last name
						<input type="text" bind:value={lastName} autocomplete="family-name" />
					</label>
					<label>
						Username
						<input
							type="text"
							bind:value={username}
							autocomplete="username"
							required
							minlength="3"
						/>
					</label>
					<label>
						Email
						<input type="email" bind:value={email} autocomplete="email" required />
					</label>
					<label>
						Password
						<input
							type="password"
							bind:value={password}
							autocomplete="new-password"
							required
							minlength="6"
						/>
					</label>
					<label>
						Referral code (optional)
						<input
							type="text"
							bind:value={referralCode}
							autocomplete="off"
							spellcheck="false"
						/>
					</label>
				{/if}

				<button type="submit" class="site-btn site-btn-primary" disabled={busy}>
					{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
				</button>
			</form>
		{/if}

		{#if errorMsg || auth.error}
			<p class="site-error">{errorMsg || auth.error}</p>
		{/if}
		{#if infoMsg}
			<p class="site-ok">{infoMsg}</p>
		{/if}

		<p class="site-muted aside">
			Curious about plans? <a href={resolve('/pricing')}>See pricing</a>
		</p>
		</div>
	</main>

	<SiteFooter />
</div>

<style>
	.login-main {
		width: 100%;
		padding: clamp(32px, 6vw, 64px) 16px;
		background-image: radial-gradient(#e7d8c5 1.2px, transparent 1.3px);
		background-size: 18px 18px;
	}
	.login-card {
		max-width: 460px;
		margin: 0 auto;
		padding: clamp(24px, 5vw, 40px);
	}
	h1 {
		font-size: 2.1rem;
		margin: 0 0 8px;
	}
	.intro {
		margin: 0 0 24px;
	}
	.tabs {
		display: flex;
		gap: 4px;
		padding: 5px;
		margin-bottom: 20px;
		border-radius: 999px;
		background: var(--site-surface-2);
	}
	.tabs button {
		appearance: none;
		flex: 1;
		border: none;
		border-radius: 999px;
		background: transparent;
		color: var(--site-muted);
		font-family: var(--site-font-body);
		font-size: 0.95rem;
		font-weight: 800;
		padding: 9px 12px;
		cursor: pointer;
	}
	.tabs button.active {
		background: var(--site-surface);
		color: var(--site-accent);
		box-shadow: var(--site-shadow);
	}
	.auth-form {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.auth-form button[type='submit'] {
		margin-top: 8px;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 0.9rem;
		font-weight: 700;
		color: var(--site-text);
	}
	.aside {
		margin: 24px 0 0;
		font-size: 0.9rem;
		text-align: center;
	}
</style>
