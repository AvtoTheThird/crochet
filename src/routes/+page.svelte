<script>
	import { onMount } from 'svelte';
	import { auth } from '$lib/supabase/session.svelte.js';
	import { resolve } from '$app/paths';
	import { listGalleryMostLiked } from '$lib/supabase/gallery.js';
	import SiteHeader from '$lib/components/site/SiteHeader.svelte';
	import SiteFooter from '$lib/components/site/SiteFooter.svelte';
	import HeroIllustration from '$lib/components/site/HeroIllustration.svelte';
	import StepShowcase from '$lib/components/site/StepShowcase.svelte';
	import { getPaddle } from '$lib/paddle/client.js';
	import { tiers, priceIdFor } from '$lib/paddle/tiers.js';
	import { fetchPriceMap } from '$lib/paddle/prices.js';
	import '$lib/styles/site.css';

	const steps = [
		{
			n: '1',
			title: 'Upload & crop',
			body: 'Pick a pixelated picture and trim it down to just the part you want to stitch.',
			video: '/media/steps/step-01.mp4',
			color: '#c65d50',
			soft: '#f9e0d9'
		},
		{
			n: '2',
			title: 'Set the grid',
			body: 'Line the grid up with the pixels so every little square becomes one stitch.',
			video: '/media/steps/step-02.mp4',
			color: '#d49a2f',
			soft: '#fbeccb'
		},
		{
			n: '3',
			title: 'Choose your yarn colors',
			body: 'Merge look-alike shades into a palette that matches the yarn in your stash.',
			video: '/media/steps/step-03.mp4',
			color: '#6f8c63',
			soft: '#e4ecdc'
		},
		{
			n: '4',
			title: 'Stitch row by row',
			body: 'Follow the color counts one row at a time. Export a PNG chart or CSV whenever you like.',
			video: '/media/steps/step-04.mp4',
			color: '#8b74b3',
			soft: '#ece6f5'
		}
	];

	const perks = [
		{
			title: 'Counts for every row',
			body: 'No more squinting at graph paper. Each row reads like “4 Oat, 4 Berry, 2 Cherry”.',
			bg: 'var(--site-accent-soft)'
		},
		{
			title: 'A palette that fits your stash',
			body: 'Rename colors after your actual yarns and squash tiny shade differences in one click.',
			bg: 'var(--site-mustard-soft)'
		},
		{
			title: 'Pick up where you left off',
			body: 'Your projects save your place, so you can put the hook down mid-row and come back later.',
			bg: 'var(--site-sage-soft)'
		}
	];

	/** @type {any[]} */
	let galleryItems = $state([]);

	const CARD_W = 196;
	let carouselHalf = $state(/** @type {any[]} */ ([]));
	let carouselLoop = $derived([...carouselHalf, ...carouselHalf]);
	let carouselDurationSec = $derived(Math.max(24, Math.min(100, carouselHalf.length * 3.5)));
	let carouselStatic = $derived(carouselHalf.length > 0 && carouselHalf.length * CARD_W < 960);

	function rebuildCarouselHalf() {
		const items = galleryItems;
		if (!items.length) {
			carouselHalf = [];
			return;
		}
		const minWidth = typeof window !== 'undefined' ? Math.max(window.innerWidth, 960) : 1200;
		const needed = Math.max(items.length, Math.ceil(minWidth / CARD_W));
		const half = [];
		while (half.length < needed) {
			for (const it of items) {
				half.push(it);
				if (half.length >= needed) break;
			}
		}
		carouselHalf = half;
	}

	/** Map of priceId -> Paddle's already-formatted total string. */
	let priceMap = $state(/** @type {Record<string, string>} */ ({}));
	let pricesLoading = $state(true);

	/** @param {string} tierId */
	function priceLabelFor(tierId) {
		const t = tiers.find((x) => x.id === tierId);
		if (!t) return '';
		return priceMap[priceIdFor(t, 'month')] ?? '';
	}

	onMount(async () => {
		try {
			const paddle = await getPaddle();
			if (!paddle) throw new Error('Paddle failed to initialize.');
			priceMap = (await fetchPriceMap(paddle)).priceMap;
		} catch (e) {
			console.warn('landing prices:', e);
		} finally {
			pricesLoading = false;
		}
	});

	onMount(() => {
		listGalleryMostLiked(24)
			.then((items) => (galleryItems = items))
			.catch((e) => console.warn('landing gallery:', e))
			.finally(rebuildCarouselHalf);

		/** @type {ReturnType<typeof setTimeout> | undefined} */
		let resizeTimer;
		const onResize = () => {
			clearTimeout(resizeTimer);
			resizeTimer = setTimeout(rebuildCarouselHalf, 150);
		};
		window.addEventListener('resize', onResize);
		return () => {
			clearTimeout(resizeTimer);
			window.removeEventListener('resize', onResize);
		};
	});

	const startHref = $derived(auth.session ? resolve('/studio/load') : resolve('/login'));
</script>

<svelte:head>
	<title>Qsovio · Turn pictures into crochet tapestry patterns</title>
</svelte:head>

<div class="site-page">
	<SiteHeader />

	<main>
		<section class="hero" aria-labelledby="hero-heading">
			<div class="hero-inner">
				<div class="hero-copy">
					<p class="site-eyebrow">from picture to tapestry ♡</p>
					<h1 id="hero-heading">
						Turn your favorite pictures into <em>crochet tapestry</em> patterns
					</h1>
					<p class="hero-lead">
						Upload a pixelated image, pick your yarn colors, and get a row-by-row stitch count you
						can actually follow, one cozy row at a time.
					</p>
					<div class="hero-actions">
						<a class="site-btn site-btn-primary" href={startHref}>Make my first pattern</a>
						<a class="site-btn" href="#how-heading">See how it works</a>
					</div>
					<p class="hero-note">
						<svg viewBox="0 0 20 20" aria-hidden="true"
							><path
								d="M10 17s-6-3.7-6-8.2A3.3 3.3 0 0 1 10 6.6a3.3 3.3 0 0 1 6 2.2C16 13.3 10 17 10 17z"
							/></svg
						>
						Free to start, no credit card needed
					</p>
				</div>
				<div class="hero-art">
					<HeroIllustration />
				</div>
			</div>
		</section>

		<section class="site-section how" aria-labelledby="how-heading">
			<div class="section-head">
				<p class="site-eyebrow">easy as 1, 2, 3, 4</p>
				<h2 id="how-heading">How it works</h2>
				<p>Watch each step in action, then try it yourself with your own picture.</p>
			</div>
			<StepShowcase {steps} />
		</section>

		<section class="perks" aria-label="Why makers love it">
			<ul class="perk-list">
				{#each perks as perk (perk.title)}
					<li class="perk" style:--bg={perk.bg}>
						<h3>{perk.title}</h3>
						<p>{perk.body}</p>
					</li>
				{/each}
			</ul>
		</section>

		<section class="gallery-promo" aria-labelledby="gallery-promo-heading">
			<div class="site-section gallery-head">
				<div class="section-head">
					<p class="site-eyebrow">made by our community</p>
					<h2 id="gallery-promo-heading">Fresh from the gallery</h2>
					<p>
						Peek at patterns other makers have shared. Previews are free; paid plans unlock the full
						pattern so you can add it to your projects.
					</p>
				</div>
				<a class="site-btn" href={resolve('/gallery')}>Browse the gallery</a>
			</div>

			{#if galleryItems.length}
				<div class={['carousel', carouselStatic && 'static']} aria-label="Gallery project carousel">
					<div class="carousel-track" style:animation-duration="{carouselDurationSec}s">
						{#each carouselLoop as item, i (item.id + '-' + i)}
							<a class="carousel-card" href={resolve('/gallery/[id]', { id: item.id })}>
								{#if item.imageSrc}
									<img src={item.imageSrc} alt="" width="168" height="168" loading="lazy" />
								{:else}
									<div class="carousel-ph" aria-hidden="true"></div>
								{/if}
								<span class="carousel-name">{item.name}</span>
								<span class="carousel-meta">
									by {item.author_username}
									{#if item.likes_count != null}
										· ♥ {item.likes_count}
									{/if}
								</span>
							</a>
						{/each}
					</div>
				</div>
			{:else}
				<p class="gallery-empty site-muted">
					No published patterns yet. Be the first!
					<a href={resolve('/gallery')}>Open the gallery</a>
				</p>
			{/if}
		</section>

		<section class="site-section plans" aria-labelledby="plans-heading">
			<div class="section-head centered">
				<p class="site-eyebrow">simple pricing</p>
				<h2 id="plans-heading">Start free, grow when you're hooked</h2>
			</div>
			<ul class="plan-list">
				<li class="plan" style:--tint="var(--site-sage-soft)">
					<h3>Free</h3>
					<span class="plan-price">$0</span>
					<p>One project when you sign up. Perfect for trying your first tapestry.</p>
				</li>
				<li class="plan" style:--tint="var(--site-mustard-soft)">
					<h3>Maker</h3>
					<span class="plan-price">
						{#if pricesLoading}
							<span class="plan-price-loading">Loading…</span>
						{:else if priceLabelFor('maker')}
							{priceLabelFor('maker')} <em>/month</em>
						{:else}
							<span class="plan-price-loading">—</span>
						{/if}
					</span>
					<p>Up to five projects at once, full gallery access, and Add to my projects.</p>
				</li>
				<li class="plan featured" style:--tint="var(--site-accent-soft)">
					<span class="plan-badge">best value</span>
					<h3>Lifetime</h3>
					<span class="plan-price">
						{#if pricesLoading}
							<span class="plan-price-loading">Loading…</span>
						{:else if priceLabelFor('lifetime')}
							{priceLabelFor('lifetime')} <em>one-time</em>
						{:else}
							<span class="plan-price-loading">—</span>
						{/if}
					</span>
					<p>Pay once. Up to twenty projects at once and full gallery access, forever.</p>
				</li>
			</ul>
			<p class="plans-cta">
				<a class="site-btn" href={resolve('/pricing')}>Compare plans</a>
			</p>
		</section>

		<section class="final-cta" aria-labelledby="final-cta-heading">
			<div class="final-cta-card">
				<h2 id="final-cta-heading">Got a picture in mind?</h2>
				<p>Grab your hook. Your next tapestry is a few clicks away.</p>
				<a class="site-btn site-btn-primary" href={startHref}>Start my pattern</a>
			</div>
		</section>
	</main>

	<SiteFooter />
</div>

<style>
	/* ---------- Hero ---------- */
	.hero {
		position: relative;
		background-color: var(--site-bg);
		background-image: radial-gradient(#e7d8c5 1.2px, transparent 1.3px);
		background-size: 18px 18px;
		border-bottom: 2px dashed var(--site-border);
		overflow: hidden;
	}
	.hero::before {
		content: '';
		position: absolute;
		width: 520px;
		height: 520px;
		right: -120px;
		top: -140px;
		border-radius: 50%;
		background: radial-gradient(circle, rgba(249, 224, 217, 0.9), rgba(249, 224, 217, 0) 70%);
		pointer-events: none;
	}

	.hero-inner {
		position: relative;
		max-width: 1120px;
		margin: 0 auto;
		padding: clamp(40px, 7vw, 88px) clamp(16px, 4vw, 40px);
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: clamp(32px, 5vw, 64px);
		align-items: center;
	}

	.hero-copy h1 {
		font-size: clamp(2.3rem, 5.2vw, 3.8rem);
		line-height: 1.08;
		margin: 0 0 20px;
	}
	.hero-copy h1 em {
		font-style: italic;
		color: var(--site-accent);
		background: linear-gradient(transparent 62%, var(--site-mustard-soft) 62%);
		padding: 0 4px;
	}

	.hero-lead {
		margin: 0 0 28px;
		max-width: 32rem;
		color: var(--site-muted);
		font-size: 1.15rem;
	}

	.hero-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
	}

	.hero-note {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 18px 0 0;
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--site-muted);
	}
	.hero-note svg {
		width: 18px;
		height: 18px;
		fill: var(--site-accent);
	}

	/* ---------- Section heads ---------- */
	.section-head {
		margin-bottom: 32px;
	}
	.section-head h2 {
		margin-bottom: 8px;
	}
	.section-head.centered {
		text-align: center;
	}
	.section-head.centered p {
		margin-left: auto;
		margin-right: auto;
	}

	/* ---------- Perks ---------- */
	.perks {
		max-width: 1120px;
		margin: 0 auto;
		padding: 0 clamp(16px, 4vw, 40px) clamp(48px, 7vw, 88px);
	}
	.perk-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 18px;
	}
	.perk {
		padding: 26px 24px;
		border-radius: var(--site-radius);
		background: var(--bg);
		position: relative;
	}
	.perk::after {
		content: '';
		position: absolute;
		inset: 8px;
		border: 2px dashed rgba(62, 47, 42, 0.16);
		border-radius: 12px;
		pointer-events: none;
	}
	.perk h3 {
		font-size: 1.25rem;
		margin: 0 0 8px;
	}
	.perk p {
		margin: 0;
		color: var(--site-text);
		opacity: 0.8;
	}

	/* ---------- Gallery ---------- */
	.gallery-promo {
		background: var(--site-surface-2);
		border-top: 2px dashed var(--site-border);
		border-bottom: 2px dashed var(--site-border);
		padding-bottom: clamp(48px, 7vw, 80px);
	}
	.gallery-head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 16px 32px;
		padding-bottom: 32px;
	}
	.gallery-head .section-head {
		margin-bottom: 0;
	}

	.gallery-empty {
		text-align: center;
		padding: 0 24px;
	}

	.carousel {
		width: 100%;
		overflow: hidden;
		padding: 12px 0 16px;
	}

	.carousel-track {
		display: flex;
		gap: 0;
		width: max-content;
		animation: carousel-scroll 48s linear infinite;
	}

	.carousel:hover .carousel-track,
	.carousel:focus-within .carousel-track {
		animation-play-state: paused;
	}

	.carousel.static .carousel-track {
		animation: none;
		width: 100%;
		justify-content: center;
		flex-wrap: wrap;
	}

	@keyframes carousel-scroll {
		from {
			transform: translateX(0);
		}
		to {
			transform: translateX(-50%);
		}
	}

	.carousel-card {
		flex: 0 0 180px;
		width: 180px;
		margin: 0 8px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 8px 8px 12px;
		background: #fff;
		border-radius: 6px;
		box-shadow: var(--site-shadow);
		color: inherit;
		transition: transform 0.2s;
	}
	.carousel-card:nth-child(odd) {
		transform: rotate(-1.5deg);
	}
	.carousel-card:nth-child(even) {
		transform: rotate(1.5deg);
	}
	.carousel-card:hover,
	.carousel-card:focus-visible {
		text-decoration: none;
		transform: rotate(0) translateY(-4px);
	}

	.carousel-card img,
	.carousel-ph {
		width: 100%;
		aspect-ratio: 1;
		object-fit: contain;
		background: var(--site-surface-2);
		image-rendering: pixelated;
		display: block;
		border-radius: 3px;
		margin-bottom: 6px;
	}

	.carousel-name {
		font-family: var(--site-font-hand);
		font-size: 1.35rem;
		line-height: 1.1;
		color: var(--site-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.carousel-meta {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--site-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* ---------- Plans ---------- */
	.plan-list {
		list-style: none;
		margin: 0 0 28px;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 18px;
	}

	.plan {
		position: relative;
		padding: 28px 24px;
		border-radius: var(--site-radius);
		background: var(--site-surface);
		border: 1px solid var(--site-border);
		box-shadow: var(--site-shadow);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.plan::before {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		top: 0;
		height: 10px;
		border-radius: var(--site-radius) var(--site-radius) 0 0;
		background: var(--tint);
	}
	.plan.featured {
		border: 2px dashed var(--site-accent);
	}

	.plan-badge {
		position: absolute;
		top: -14px;
		right: 18px;
		padding: 2px 12px;
		border-radius: 999px;
		background: var(--site-accent);
		color: #fff;
		font-family: var(--site-font-hand);
		font-size: 1.2rem;
		transform: rotate(3deg);
	}

	.plan h3 {
		font-size: 1.35rem;
		margin: 6px 0 0;
	}

	.plan-price {
		font-family: var(--site-font-display);
		font-size: 1.9rem;
		font-weight: 700;
		color: var(--site-text);
	}

	.plan-price-loading {
		color: var(--site-muted);
		font-size: 1rem;
		font-weight: 600;
	}

	.plan-price em {
		font-family: var(--site-font-body);
		font-style: normal;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--site-muted);
		margin-left: 2px;
	}

	.plan p {
		margin: 0;
		font-size: 0.95rem;
	}

	.plans-cta {
		text-align: center;
		margin: 0 auto;
	}

	/* ---------- Final CTA ---------- */
	.final-cta {
		padding: 0 clamp(16px, 4vw, 40px) clamp(56px, 8vw, 96px);
	}
	.final-cta-card {
		max-width: 1120px;
		margin: 0 auto;
		padding: clamp(36px, 6vw, 64px) 24px;
		text-align: center;
		border-radius: 28px;
		background-color: var(--site-accent-soft);
		background-image: radial-gradient(rgba(198, 93, 80, 0.14) 1.2px, transparent 1.3px);
		background-size: 18px 18px;
		border: 2px dashed rgba(198, 93, 80, 0.4);
	}
	.final-cta-card h2 {
		font-size: clamp(1.75rem, 3.6vw, 2.5rem);
		margin: 0 0 8px;
	}
	.final-cta-card p {
		margin: 0 auto 24px;
		color: var(--site-muted);
	}

	@media (max-width: 900px) {
		.hero-inner {
			grid-template-columns: minmax(0, 1fr);
		}
		.hero-art {
			max-width: 480px;
			width: 100%;
			margin: 0 auto;
		}
		.perk-list,
		.plan-list {
			grid-template-columns: 1fr;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.carousel-track {
			animation: none;
		}
	}
</style>
