<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { auth } from '$lib/supabase/session.svelte.js';
	import { signInWithPassword, signUpWithPassword } from '$lib/supabase/auth.js';
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
				const data = await signUpWithPassword({
					email,
					password,
					username,
					firstName,
					lastName
				});
				if (data.session) {
					goto(resolve('/studio/load'));
				} else {
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
		<h1>{mode === 'login' ? 'Log in' : 'Create account'}</h1>
		<p class="site-muted intro">
			Free accounts include one project. Upgrade anytime for more concurrent projects.
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
			<a href={resolve('/pricing')}>See pricing</a>
		</p>
	</main>

	<SiteFooter />
</div>

<style>
	.login-main {
		max-width: 420px;
		margin: 0 auto;
		padding: 48px 24px 64px;
	}
	h1 {
		font-family: var(--site-font-display);
		font-weight: 800;
		font-size: 2rem;
		letter-spacing: -0.03em;
		margin: 0 0 8px;
	}
	.intro {
		margin: 0 0 24px;
	}
	.tabs {
		display: flex;
		gap: 0;
		margin-bottom: 16px;
		border: 1px solid var(--site-border);
	}
	.tabs button {
		appearance: none;
		flex: 1;
		border: none;
		border-right: 1px solid var(--site-border);
		background: var(--site-surface);
		color: var(--site-muted);
		font-family: var(--site-font-mono);
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 10px 12px;
		cursor: pointer;
	}
	.tabs button:last-child {
		border-right: none;
	}
	.tabs button.active {
		background: var(--site-bg);
		color: var(--site-text);
		outline: 1px solid var(--site-accent);
		outline-offset: -1px;
	}
	.auth-form {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--site-muted);
	}
	input {
		appearance: none;
		border: 1px solid var(--site-border);
		background: var(--site-surface);
		color: var(--site-text);
		padding: 10px 12px;
		font-family: var(--site-font-mono);
		font-size: 0.9rem;
	}
	input:focus {
		outline: 1px solid var(--site-accent);
	}
	.aside {
		margin-top: 28px;
		font-size: 0.75rem;
	}
</style>
