<script>
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { auth } from '$lib/supabase/session.svelte.js';
	import { isPaid } from '$lib/supabase/entitlements.js';
	import {
		getGalleryItem,
		addGalleryProjectToMine,
		toggleGalleryLike
	} from '$lib/supabase/gallery.js';
	import SiteHeader from '$lib/components/site/SiteHeader.svelte';
	import SiteFooter from '$lib/components/site/SiteFooter.svelte';
	import '$lib/styles/site.css';

	/** @type {any | null} */
	let item = $state(null);
	let loading = $state(true);
	let errorMsg = $state('');
	let busy = $state(false);
	let likeBusy = $state(false);
	let okMsg = $state('');

	const paid = $derived(isPaid());
	const hasFull = $derived(!!item && (item.access === 'full' || paid));
	const likesLabel = $derived(
		item
			? `${item.likes_count ?? 0} ${(item.likes_count ?? 0) === 1 ? 'like' : 'likes'}`
			: ''
	);

	async function loadItem() {
		const id = page.params.id;
		if (!id) {
			errorMsg = 'Missing project id';
			item = null;
			loading = false;
			return;
		}
		loading = true;
		errorMsg = '';
		try {
			item = await getGalleryItem(id);
			if (!item) errorMsg = 'This gallery project was not found or is no longer published.';
		} catch (e) {
			item = null;
			errorMsg = e?.message || 'Could not load project';
		} finally {
			loading = false;
		}
	}

	// Load (and reload when auth changes) so Maker unlocks full access.
	$effect(() => {
		const id = page.params.id;
		const ready = !auth.loading;
		void auth.session;
		if (!ready || !id) return;
		loadItem();
	});

	async function addToMine() {
		if (!item?.id) return;
		errorMsg = '';
		okMsg = '';
		busy = true;
		try {
			await addGalleryProjectToMine(item.id);
			okMsg = 'Added to your projects.';
			await goto(resolve('/studio/load'));
		} catch (e) {
			if (e?.code === 'PROJECT_LIMIT' || e?.code === 'GALLERY_LOCKED' || e?.code === 'NOT_LOGGED_IN') {
				return;
			}
			errorMsg = e?.message || 'Could not add project';
		} finally {
			busy = false;
		}
	}

	async function toggleLike() {
		if (!item?.id || likeBusy) return;
		errorMsg = '';
		likeBusy = true;
		try {
			const result = await toggleGalleryLike(item.id);
			item.likes_count = result.likes_count;
			item.liked_by_me = result.liked;
		} catch (e) {
			if (e?.code === 'NOT_LOGGED_IN') return;
			errorMsg = e?.message || 'Could not update like';
		} finally {
			likeBusy = false;
		}
	}
</script>

<div class="site-page">
	<SiteHeader />

	<main class="site-section detail">
		<p class="back"><a href={resolve('/gallery')}>Back to gallery</a></p>

		{#if loading}
			<p class="site-muted">Loading…</p>
		{:else if errorMsg && !item}
			<p class="site-error">{errorMsg}</p>
		{:else if item}
			<div class="detail-grid">
				<div class="detail-media">
					{#if item.imageSrc}
						<img
							src={item.imageSrc}
							alt={`Pattern preview for ${item.name}`}
							width={item.image_width || 400}
							height={item.image_height || 400}
						/>
					{:else}
						<div class="detail-ph" role="img" aria-label="Preview unavailable"></div>
					{/if}
				</div>
				<div class="detail-copy">
					<h1>{item.name}</h1>
					<p class="byline">by {item.author_username}</p>
					<div class="like-row">
						<button
							type="button"
							class="site-btn like-btn"
							class:liked={!!item.liked_by_me}
							disabled={likeBusy}
							aria-pressed={!!item.liked_by_me}
							onclick={toggleLike}
						>
							{likeBusy ? '…' : item.liked_by_me ? 'Liked' : 'Like'}
						</button>
						<span class="like-count">{likesLabel}</span>
					</div>
					<p class="desc">
						{item.gallery_description?.trim()
							? item.gallery_description
							: 'No description provided.'}
					</p>

					{#if hasFull}
						<p class="access site-ok">Full pattern access</p>
						{#if auth.session}
							<button
								type="button"
								class="site-btn site-btn-primary"
								disabled={busy}
								onclick={addToMine}
							>
								{busy ? 'Adding…' : 'Add to my projects'}
							</button>
						{:else}
							<a class="site-btn site-btn-primary" href={resolve('/login')}>Log in to add</a>
						{/if}
					{:else}
						<p class="access">
							Preview only. Upgrade for full pattern data and to add this to your projects.
						</p>
						{#if auth.session}
							<a class="site-btn site-btn-primary" href={resolve('/pricing')}>View pricing</a>
						{:else}
							<a class="site-btn site-btn-primary" href={resolve('/login')}>Log in</a>
							<a class="site-btn" href={resolve('/pricing')}>Pricing</a>
						{/if}
					{/if}

					{#if errorMsg}
						<p class="site-error">{errorMsg}</p>
					{/if}
					{#if okMsg}
						<p class="site-ok">{okMsg}</p>
					{/if}
				</div>
			</div>
		{/if}
	</main>

	<SiteFooter />
</div>

<style>
	.back {
		margin: 0 0 24px;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.detail-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
		gap: 32px;
		align-items: start;
	}

	.detail-media img,
	.detail-ph {
		width: 100%;
		max-height: 70vh;
		object-fit: contain;
		background: #101012;
		border: 1px solid var(--site-border);
		image-rendering: pixelated;
		display: block;
	}

	.detail-ph {
		aspect-ratio: 1;
	}

	.detail-copy h1 {
		font-family: var(--site-font-display);
		font-weight: 800;
		font-size: clamp(1.75rem, 4vw, 2.5rem);
		letter-spacing: -0.03em;
		margin: 0 0 8px;
	}

	.byline {
		margin: 0 0 12px;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--site-muted);
	}

	.like-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
		margin: 0 0 20px;
	}

	.like-btn.liked {
		background: var(--site-accent);
		border-color: var(--site-accent);
		color: #0c0c0e;
	}

	.like-count {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--site-muted);
	}

	.desc {
		margin: 0 0 24px;
		color: var(--site-muted);
		max-width: 36rem;
		white-space: pre-wrap;
	}

	.access {
		margin: 0 0 16px;
		font-size: 0.85rem;
		color: var(--site-muted);
		max-width: 28rem;
	}

	.detail-copy .site-btn {
		margin-right: 8px;
		margin-bottom: 8px;
	}

	@media (max-width: 800px) {
		.detail-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
