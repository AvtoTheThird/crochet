<script>
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { listGallery } from '$lib/supabase/gallery.js';
	import SiteHeader from '$lib/components/site/SiteHeader.svelte';
	import SiteFooter from '$lib/components/site/SiteFooter.svelte';
	import '$lib/styles/site.css';

	/** @type {any[]} */
	let items = $state([]);
	let loading = $state(true);
	let errorMsg = $state('');

	onMount(async () => {
		try {
			items = await listGallery();
		} catch (e) {
			errorMsg = e?.message || 'Could not load gallery';
		} finally {
			loading = false;
		}
	});
</script>

<div class="site-page">
	<SiteHeader />

	<main class="site-section gallery">
		<p class="site-eyebrow">made by our community</p>
		<h1 class="site-page-title">Gallery</h1>
		<p class="lead">
			Patterns shared by fellow makers. Anyone can browse the pictures and descriptions; paid plans
			unlock the full pattern so you can add it to your projects.
		</p>

		{#if loading}
			<p class="site-muted">Loading gallery…</p>
		{:else if errorMsg}
			<p class="site-error">{errorMsg}</p>
		{:else if !items.length}
			<p class="site-muted">No published projects yet. Publish one from your studio project list.</p>
		{:else}
			<ul class="gallery-list">
				{#each items as item (item.id)}
					<li>
						<a class="gallery-item" href={resolve('/gallery/[id]', { id: item.id })}>
							{#if item.imageSrc}
								<img src={item.imageSrc} alt="" width="200" height="200" />
							{:else}
								<div class="gallery-ph" aria-hidden="true"></div>
							{/if}
							<div class="gallery-meta">
								<strong>{item.name}</strong>
								<span>by {item.author_username}</span>
								<span class="gallery-likes"
									>♥ {item.likes_count ?? 0}
									{(item.likes_count ?? 0) === 1 ? 'like' : 'likes'}</span
								>
							</div>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</main>

	<SiteFooter />
</div>

<style>
	.lead {
		margin: 0 0 40px;
		color: var(--site-muted);
		max-width: 40rem;
		font-size: 1.1rem;
	}

	.gallery-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
		gap: 28px 22px;
	}

	.gallery-item {
		display: flex;
		flex-direction: column;
		height: 100%;
		padding: 10px 10px 14px;
		background: #fff;
		border-radius: 8px;
		box-shadow: var(--site-shadow);
		color: inherit;
		transition: transform 0.2s, box-shadow 0.2s;
	}
	.gallery-list li:nth-child(3n + 1) .gallery-item {
		transform: rotate(-1.2deg);
	}
	.gallery-list li:nth-child(3n + 2) .gallery-item {
		transform: rotate(0.8deg);
	}
	.site-page .gallery-item:hover {
		text-decoration: none;
		transform: rotate(0) translateY(-4px);
		box-shadow: var(--site-shadow-lg);
	}
	.gallery-item:hover strong {
		color: var(--site-accent);
	}

	.gallery-item img,
	.gallery-ph {
		display: block;
		width: 100%;
		height: auto;
		aspect-ratio: 1;
		object-fit: contain;
		background: var(--site-surface-2);
		border-radius: 4px;
		image-rendering: pixelated;
	}

	.gallery-meta {
		padding: 12px 4px 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.gallery-meta strong {
		font-family: var(--site-font-hand);
		font-size: 1.5rem;
		line-height: 1.1;
		color: var(--site-text);
		overflow-wrap: anywhere;
	}

	.gallery-meta span {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--site-muted);
	}

	.gallery-meta .gallery-likes {
		color: var(--site-accent);
	}
</style>
