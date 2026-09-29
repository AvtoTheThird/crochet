<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { auth } from '$lib/supabase/session.svelte.js';
	import { signOut } from '$lib/supabase/auth.js';
	import {
		updateDisplayName,
		changePassword,
		uploadAvatar,
		getMySubscription,
		cancelMySubscription
	} from '$lib/supabase/profile.js';
	import { currentTier } from '$lib/supabase/entitlements.js';
	import SiteHeader from '$lib/components/site/SiteHeader.svelte';
	import SiteFooter from '$lib/components/site/SiteFooter.svelte';
	import '$lib/styles/site.css';

	// --- name form ---
	let firstName = $state('');
	let lastName = $state('');
	let nameBusy = $state(false);
	let nameMsg = $state('');
	let nameErr = $state('');

	// --- password form ---
	let oldPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let pwBusy = $state(false);
	let pwMsg = $state('');
	let pwErr = $state('');

	// --- avatar ---
	let avatarBusy = $state(false);
	let avatarErr = $state('');
	/** @type {File | null} */
	let avatarFile = $state(null);
	let avatarPreview = $state('');

	// --- subscription ---
	/** @type {Record<string, any> | null} */
	let subscription = $state(null);
	let subLoading = $state(true);
	let cancelBusy = $state(false);
	let subMsg = $state('');
	let subErr = $state('');

	let prefilled = false;

	const tier = $derived(currentTier());
	const avatarSrc = $derived(avatarPreview || auth.profile?.avatar_url || '');
	const displayName = $derived(
		[auth.profile?.first_name, auth.profile?.last_name].filter(Boolean).join(' ') ||
			auth.profile?.username ||
			auth.user?.email ||
			''
	);

	onMount(() => {
		let cancelled = false;
		const id = setInterval(async () => {
			if (auth.loading) return;
			clearInterval(id);
			if (!auth.session) {
				goto(resolve('/login'));
				return;
			}
			if (!prefilled) {
				firstName = auth.profile?.first_name ?? '';
				lastName = auth.profile?.last_name ?? '';
				prefilled = true;
			}
			try {
				const sub = await getMySubscription();
				if (!cancelled) subscription = sub;
			} catch (e) {
				if (!cancelled) subErr = e instanceof Error ? e.message : 'Could not load subscription';
			} finally {
				if (!cancelled) subLoading = false;
			}
		}, 50);
		return () => {
			cancelled = true;
			clearInterval(id);
		};
	});

	async function saveName(e) {
		e.preventDefault();
		nameMsg = '';
		nameErr = '';
		nameBusy = true;
		try {
			await updateDisplayName({ firstName, lastName });
			nameMsg = 'Name updated.';
		} catch (err) {
			nameErr = err instanceof Error ? err.message : 'Could not update name';
		} finally {
			nameBusy = false;
		}
	}

	async function savePassword(e) {
		e.preventDefault();
		pwMsg = '';
		pwErr = '';
		if (newPassword !== confirmPassword) {
			pwErr = 'New passwords do not match';
			return;
		}
		pwBusy = true;
		try {
			await changePassword(oldPassword, newPassword);
			pwMsg = 'Password changed.';
			oldPassword = '';
			newPassword = '';
			confirmPassword = '';
		} catch (err) {
			pwErr = err instanceof Error ? err.message : 'Could not change password';
		} finally {
			pwBusy = false;
		}
	}

	function onAvatarChange(e) {
		avatarErr = '';
		const input = /** @type {HTMLInputElement} */ (e.currentTarget);
		const file = input.files?.[0] ?? null;
		avatarFile = file;
		if (avatarPreview) URL.revokeObjectURL(avatarPreview);
		avatarPreview = file ? URL.createObjectURL(file) : '';
	}

	async function saveAvatar() {
		if (!avatarFile) {
			avatarErr = 'Choose an image first';
			return;
		}
		avatarErr = '';
		avatarBusy = true;
		try {
			await uploadAvatar(avatarFile);
			if (avatarPreview) URL.revokeObjectURL(avatarPreview);
			avatarPreview = '';
			avatarFile = null;
		} catch (err) {
			avatarErr = err instanceof Error ? err.message : 'Could not upload avatar';
		} finally {
			avatarBusy = false;
		}
	}

	async function unsubscribe() {
		subMsg = '';
		subErr = '';
		if (!confirm('Cancel your subscription? You keep access until the end of the current billing period.')) {
			return;
		}
		cancelBusy = true;
		try {
			await cancelMySubscription();
			subMsg = 'Cancellation scheduled. You keep access until the end of the current period.';
			// Reflect the pending change locally; the webhook will finalize it.
			try {
				subscription = await getMySubscription();
			} catch {
				if (subscription) subscription = { ...subscription, scheduled_change_action: 'cancel' };
			}
		} catch (err) {
			subErr = err instanceof Error ? err.message : 'Could not cancel subscription';
		} finally {
			cancelBusy = false;
		}
	}

	async function logout() {
		await signOut();
		goto(resolve('/'));
	}

	const tierLabel = $derived(
		tier === 'lifetime' ? 'Lifetime' : tier === 'maker' ? 'Maker' : 'Free'
	);

	function fmtDate(value) {
		if (!value) return '';
		try {
			return new Date(value).toLocaleDateString(undefined, {
				year: 'numeric',
				month: 'short',
				day: 'numeric'
			});
		} catch {
			return '';
		}
	}

	const hasScheduledCancel = $derived(subscription?.scheduled_change_action === 'cancel');
	const isActiveSub = $derived(
		!!subscription &&
			['active', 'trialing', 'past_due'].includes(subscription.status) &&
			!hasScheduledCancel
	);
</script>

<div class="site-page">
	<SiteHeader />

	<main class="profile-main">
		<h1>Profile</h1>

		{#if auth.loading}
			<p class="site-muted">Checking session…</p>
		{:else if !auth.session}
			<p class="site-muted">Redirecting to log in…</p>
		{:else}
			<!-- Avatar -->
			<section class="card">
				<h2>Avatar</h2>
				<div class="avatar-row">
					{#if avatarSrc}
						<img class="avatar-lg" src={avatarSrc} alt="Your avatar" />
					{:else}
						<div class="avatar-lg avatar-fallback" aria-hidden="true">
							{(displayName || '?').charAt(0).toUpperCase()}
						</div>
					{/if}
					<div class="avatar-controls">
						<input
							type="file"
							accept="image/png,image/jpeg,image/webp,image/gif"
							onchange={onAvatarChange}
						/>
						<button
							type="button"
							class="site-btn site-btn-primary"
							disabled={avatarBusy || !avatarFile}
							onclick={saveAvatar}
						>
							{avatarBusy ? 'Uploading…' : 'Upload avatar'}
						</button>
						<p class="site-muted hint">PNG, JPEG, WebP or GIF. Max 2 MB.</p>
					</div>
				</div>
				{#if avatarErr}<p class="site-error">{avatarErr}</p>{/if}
			</section>

			<!-- Name -->
			<section class="card">
				<h2>Name</h2>
				<form class="stack" onsubmit={saveName}>
					<label>
						First name
						<input type="text" bind:value={firstName} autocomplete="given-name" />
					</label>
					<label>
						Last name
						<input type="text" bind:value={lastName} autocomplete="family-name" />
					</label>
					<button type="submit" class="site-btn site-btn-primary" disabled={nameBusy}>
						{nameBusy ? 'Saving…' : 'Save name'}
					</button>
				</form>
				{#if nameErr}<p class="site-error">{nameErr}</p>{/if}
				{#if nameMsg}<p class="site-ok">{nameMsg}</p>{/if}
			</section>

			<!-- Password -->
			<section class="card">
				<h2>Password</h2>
				<form class="stack" onsubmit={savePassword}>
					<label>
						Current password
						<input
							type="password"
							bind:value={oldPassword}
							autocomplete="current-password"
							required
						/>
					</label>
					<label>
						New password
						<input
							type="password"
							bind:value={newPassword}
							autocomplete="new-password"
							required
							minlength="6"
						/>
					</label>
					<label>
						Confirm new password
						<input
							type="password"
							bind:value={confirmPassword}
							autocomplete="new-password"
							required
							minlength="6"
						/>
					</label>
					<button type="submit" class="site-btn site-btn-primary" disabled={pwBusy}>
						{pwBusy ? 'Updating…' : 'Change password'}
					</button>
				</form>
				{#if pwErr}<p class="site-error">{pwErr}</p>{/if}
				{#if pwMsg}<p class="site-ok">{pwMsg}</p>{/if}
			</section>

			<!-- Subscription -->
			<section class="card">
				<h2>Subscription</h2>
				<p class="plan-line">
					Current plan: <strong>{tierLabel}</strong>
				</p>

				{#if subLoading}
					<p class="site-muted">Loading subscription…</p>
				{:else if subscription}
					<dl class="sub-meta">
						<div><dt>Status</dt><dd>{subscription.status}</dd></div>
						{#if subscription.current_period_end}
							<div>
								<dt>Renews / ends</dt>
								<dd>{fmtDate(subscription.current_period_end)}</dd>
							</div>
						{/if}
					</dl>

					{#if hasScheduledCancel}
						<p class="site-ok">
							Cancellation scheduled{subscription.scheduled_change_at
								? ` for ${fmtDate(subscription.scheduled_change_at)}`
								: ''}. You keep access until then.
						</p>
					{:else if isActiveSub}
						<button
							type="button"
							class="site-btn danger"
							disabled={cancelBusy}
							onclick={unsubscribe}
						>
							{cancelBusy ? 'Cancelling…' : 'Cancel subscription'}
						</button>
					{:else}
						<p class="site-muted">This subscription is no longer active.</p>
					{/if}
				{:else if tier === 'lifetime'}
					<p class="site-muted">Lifetime access — no recurring subscription to cancel.</p>
				{:else}
					<p class="site-muted">
						No active subscription. <a href={resolve('/pricing')}>See pricing</a>.
					</p>
				{/if}

				{#if subErr}<p class="site-error">{subErr}</p>{/if}
				{#if subMsg}<p class="site-ok">{subMsg}</p>{/if}
			</section>

			<div class="footer-actions">
				<button type="button" class="site-nav-btn" onclick={logout}>Log out</button>
			</div>
		{/if}
	</main>

	<SiteFooter />
</div>

<style>
	.profile-main {
		max-width: 560px;
		margin: 0 auto;
		padding: 48px 24px 64px;
	}
	h1 {
		font-family: var(--site-font-display);
		font-weight: 800;
		font-size: 2rem;
		letter-spacing: -0.03em;
		margin: 0 0 24px;
	}
	.card {
		border: 1px solid var(--site-border);
		background: var(--site-surface);
		padding: 20px;
		margin-bottom: 20px;
	}
	h2 {
		font-family: var(--site-font-mono);
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--site-muted);
		margin: 0 0 16px;
	}
	.stack {
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
	input[type='text'],
	input[type='password'] {
		appearance: none;
		border: 1px solid var(--site-border);
		background: var(--site-bg);
		color: var(--site-text);
		padding: 10px 12px;
		font-family: var(--site-font-mono);
		font-size: 0.9rem;
	}
	input:focus {
		outline: 1px solid var(--site-accent);
	}
	.avatar-row {
		display: flex;
		gap: 20px;
		align-items: flex-start;
	}
	.avatar-lg {
		width: 88px;
		height: 88px;
		border-radius: 50%;
		object-fit: cover;
		border: 1px solid var(--site-border);
		flex-shrink: 0;
	}
	.avatar-fallback {
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--site-bg);
		color: var(--site-text);
		font-family: var(--site-font-display);
		font-weight: 800;
		font-size: 2rem;
	}
	.avatar-controls {
		display: flex;
		flex-direction: column;
		gap: 10px;
		align-items: flex-start;
	}
	.hint {
		font-size: 0.7rem;
		margin: 0;
	}
	.plan-line {
		margin: 0 0 12px;
	}
	.sub-meta {
		display: flex;
		gap: 32px;
		margin: 0 0 16px;
	}
	.sub-meta dt {
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--site-muted);
		margin-bottom: 2px;
	}
	.sub-meta dd {
		margin: 0;
		font-family: var(--site-font-mono);
		font-size: 0.9rem;
	}
	.site-btn.danger {
		border-color: #c0392b;
		color: #c0392b;
		background: transparent;
	}
	.site-btn.danger:hover:not(:disabled) {
		background: #c0392b;
		color: #fff;
	}
	.footer-actions {
		margin-top: 8px;
	}
</style>
