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
		<h1>Gallery</h1>
		<p class="lead">
			Patterns shared by makers. Everyone can browse images and descriptions. Paid plans unlock
			full pattern data and Add to my projects.
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
								<img
									src={item.imageSrc}
									alt=""
									width={item.image_width || 200}
									height={item.image_height || 200}
								/>
							{:else}
								<div class="gallery-ph" aria-hidden="true"></div>
							{/if}
							<div class="gallery-meta">
								<strong>{item.name}</strong>
								<span>by {item.author_username}</span>
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
	.gallery h1 {
		font-family: var(--site-font-display);
		font-weight: 800;
		font-size: clamp(2rem, 5vw, 3rem);
		letter-spacing: -0.03em;
		margin: 0 0 12px;
	}

	.lead {
		margin: 0 0 36px;
		color: var(--site-muted);
		max-width: 40rem;
	}

	.gallery-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 1px;
		background: var(--site-border);
		border: 1px solid var(--site-border);
	}

	.gallery-list li {
		background: var(--site-bg);
	}

	.gallery-item {
		display: flex;
		flex-direction: column;
		color: inherit;
		text-decoration: none;
		height: 100%;
	}
	.gallery-item:hover {
		text-decoration: none;
		background: var(--site-surface);
	}
	.gallery-item:hover strong {
		color: var(--site-accent);
	}

	.gallery-item img,
	.gallery-ph {
		display: block;
		width: 100%;
		aspect-ratio: 1;
		object-fit: contain;
		background: #101012;
		image-rendering: pixelated;
	}

	.gallery-meta {
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		border-top: 1px solid var(--site-border);
	}

	.gallery-meta strong {
		font-family: var(--site-font-display);
		font-size: 1rem;
		color: var(--site-text);
	}

	.gallery-meta span {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--site-muted);
	}
</style>
