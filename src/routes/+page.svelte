<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/supabase/session.svelte.js';
	import { signInWithPassword, signUpWithPassword } from '$lib/supabase/auth.js';

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
			if (auth.session) goto('/studio/load');
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
				goto('/studio/load');
			} else {
				const data = await signUpWithPassword({
					email,
					password,
					username,
					firstName,
					lastName
				});
				if (data.session) {
					goto('/studio/load');
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

<main class="landing">
	<h1>PixelCount Studio</h1>
	<p class="tagline">Turn pixel art into tapestry stitch patterns.</p>

	{#if auth.loading}
		<p class="muted">Checking session…</p>
	{:else}
		<div class="tabs">
			<button type="button" class:active={mode === 'login'} onclick={() => switchMode('login')}>
				Log in
			</button>
			<button type="button" class:active={mode === 'signup'} onclick={() => switchMode('signup')}>
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
					<input type="password" bind:value={password} autocomplete="current-password" required />
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
					<input type="text" bind:value={username} autocomplete="username" required minlength="3" />
				</label>
				<label>
					Email
					<input type="email" bind:value={email} autocomplete="email" required />
				</label>
				<label>
					Password
					<input type="password" bind:value={password} autocomplete="new-password" required minlength="6" />
				</label>
			{/if}

			<button type="submit" class="login-btn" disabled={busy}>
				{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
			</button>
		</form>
	{/if}

	{#if errorMsg || auth.error}
		<p class="error">{errorMsg || auth.error}</p>
	{/if}
	{#if infoMsg}
		<p class="info">{infoMsg}</p>
	{/if}
</main>

<style>
	.landing {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: 24px;
		text-align: center;
		background: #0d0d0f;
		color: #e8e8f0;
		font-family: system-ui, sans-serif;
	}
	h1 {
		font-size: 1.75rem;
		font-weight: 700;
		margin: 0;
	}
	.tagline {
		margin: 0 0 8px;
		color: #888898;
		max-width: 28rem;
	}
	.tabs {
		display: flex;
		gap: 8px;
		margin-bottom: 4px;
	}
	.tabs button {
		appearance: none;
		border: 1px solid #2a2a35;
		background: #16161a;
		color: #888898;
		padding: 8px 14px;
		cursor: pointer;
		border-radius: 4px;
		font-size: 0.85rem;
	}
	.tabs button.active {
		background: #1e1e24;
		color: #e8e8f0;
		border-color: #e8ff47;
	}
	.auth-form {
		display: flex;
		flex-direction: column;
		gap: 10px;
		width: min(100%, 320px);
		text-align: left;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 0.75rem;
		color: #888898;
	}
	input {
		appearance: none;
		border: 1px solid #2a2a35;
		background: #16161a;
		color: #e8e8f0;
		padding: 10px 12px;
		border-radius: 4px;
		font-size: 0.9rem;
	}
	input:focus {
		outline: 1px solid #e8ff47;
	}
	.login-btn {
		appearance: none;
		border: 1px solid #2a2a35;
		background: #e8ff47;
		color: #0d0d0f;
		font-weight: 700;
		font-size: 0.95rem;
		padding: 12px 20px;
		cursor: pointer;
		border-radius: 4px;
		margin-top: 6px;
	}
	.login-btn:disabled {
		opacity: 0.6;
		cursor: wait;
	}
	.muted {
		color: #888898;
		font-size: 0.85rem;
	}
	.error {
		color: #ff6b35;
		font-size: 0.85rem;
		max-width: 24rem;
	}
	.info {
		color: #e8ff47;
		font-size: 0.85rem;
		max-width: 24rem;
	}
</style>
