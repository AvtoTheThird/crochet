<script>
	import { onMount } from 'svelte';
	import { auth } from '$lib/supabase/session.svelte.js';
	import { resolve } from '$app/paths';
	import { listGalleryMostLiked } from '$lib/supabase/gallery.js';
	import SiteHeader from '$lib/components/site/SiteHeader.svelte';
	import SiteFooter from '$lib/components/site/SiteFooter.svelte';
	import '$lib/styles/site.css';

	const steps = [
		{
			n: '01',
			title: 'Load and crop',
			body: 'Bring in a pixelated image and trim it to the artwork bounds.',
			icon: '/media/icons/step-load.svg',
			alt: 'Placeholder icon for load and crop',
			video: '/media/steps/step-01.mp4'
		},
		{
			n: '02',
			title: 'Set the grid',
			body: 'Match pixel width and height so each cell is one stitch.',
			icon: '/media/icons/step-grid.svg',
			alt: 'Placeholder icon for grid setup',
			video: '/media/steps/step-02.mp4'
		},
		{
			n: '03',
			title: 'Correct colors',
			body: 'Merge noisy shades into a yarn-ready palette.',
			icon: '/media/icons/step-colors.svg',
			alt: 'Placeholder icon for color correction',
			video: '/media/steps/step-03.mp4'
		},
		{
			n: '04',
			title: 'Walk the pattern',
			body: 'Follow run-length counts row by row, then export CSV or PNG.',
			icon: '/media/icons/step-walk.svg',
			alt: 'Placeholder icon for pattern walk',
			video: '/media/steps/step-04.mp4'
		}
	];

	/** @type {any[]} */
	let galleryItems = $state([]);
	let openStep = $state(/** @type {string | null} */ (null));

	onMount(async () => {
		try {
			galleryItems = await listGalleryMostLiked(24);
		} catch (e) {
			console.warn('landing gallery:', e);
		}
	});

	function onStepEnter(n, el) {
		openStep = n;
		const video = el?.querySelector?.('video');
		if (video instanceof HTMLVideoElement) {
			video.currentTime = 0;
			video.play().catch(() => {});
		}
	}

	function onStepLeave(n, el) {
		if (openStep === n) openStep = null;
		const video = el?.querySelector?.('video');
		if (video instanceof HTMLVideoElement) {
			video.pause();
		}
	}
</script>

<div class="site-page">
	<SiteHeader />

	<section class="hero" aria-label="Introduction">
		<div class="hero-media" aria-hidden="true">
			<video
				class="hero-video"
				autoplay
				muted
				loop
				playsinline
				poster="/media/hero-poster.svg"
			>
				<source src="/media/hero-demo.mp4" type="video/mp4" />
			</video>
			<img
				class="hero-fallback"
				src="/media/hero-poster.svg"
				alt=""
				width="1600"
				height="900"
			/>
			<div class="hero-scrim"></div>
		</div>

		<div class="hero-copy">
			<p class="hero-eyebrow">Tapestry from pixel art</p>
			<h1>PixelCount Studio</h1>
			<p class="hero-lead">
				Turn pixel art into run-length stitch patterns you can follow stitch by stitch.
			</p>
			<div class="hero-actions">
				{#if auth.session}
					<a class="site-btn site-btn-primary" href={resolve('/studio/load')}
						>Create your first pattern</a
					>
				{:else}
					<a class="site-btn site-btn-primary" href={resolve('/login')}
						>Create your first pattern</a
					>
				{/if}
				<a class="site-btn" href={resolve('/pricing')}>Pricing</a>
			</div>
			<p class="hero-note">No credit card required</p>
		</div>
	</section>

	<section class="site-section how" aria-labelledby="how-heading">
		<h2 id="how-heading">How it works</h2>
		<ol class="how-list">
			{#each steps as step (step.n)}
				<li>
					<div
						class="how-item"
						class:open={openStep === step.n}
						role="group"
						aria-label={`${step.title}: ${step.body}`}
						onpointerenter={(e) => onStepEnter(step.n, e.currentTarget)}
						onpointerleave={(e) => onStepLeave(step.n, e.currentTarget)}
					>
						<div class="how-row">
							<img src={step.icon} alt={step.alt} width="40" height="40" />
							<span class="how-num">{step.n}</span>
							<div>
								<strong>{step.title}</strong>
								<p>{step.body}</p>
							</div>
						</div>
						<div class="how-video-wrap">
							<div class="how-video-inner">
								<video muted loop playsinline preload="metadata" poster="/media/hero-poster.svg">
									<source src={step.video} type="video/mp4" />
								</video>
							</div>
						</div>
					</div>
				</li>
			{/each}
		</ol>
	</section>

	<section class="site-section gallery-promo" aria-labelledby="gallery-promo-heading">
		<h2 id="gallery-promo-heading">From the gallery</h2>
		<p class="gallery-promo-lead">
			Browse patterns other makers publish. Preview image and description for free. Paid plans
			unlock full pattern data and Add to my projects.
		</p>

		{#if galleryItems.length}
			<div class="carousel" aria-label="Gallery project carousel">
				<div class="carousel-track">
					{#each [...galleryItems, ...galleryItems] as item, i (item.id + '-' + i)}
						<a
							class="carousel-card"
							href={resolve('/gallery/[id]', { id: item.id })}
							tabindex="0"
						>
							{#if item.imageSrc}
								<img
									src={item.imageSrc}
									alt=""
									width="160"
									height="160"
								/>
							{:else}
								<div class="carousel-ph" aria-hidden="true"></div>
							{/if}
							<span class="carousel-name">{item.name}</span>
							<span class="carousel-author">by {item.author_username}</span>
							{#if item.likes_count != null}
								<span class="carousel-likes"
									>{item.likes_count}
									{item.likes_count === 1 ? 'like' : 'likes'}</span
								>
							{/if}
						</a>
					{/each}
				</div>
			</div>
		{:else}
			<p class="site-muted">
				No published projects yet.
				<a href={resolve('/gallery')}>Open the gallery</a>
			</p>
		{/if}

		<p class="gallery-promo-cta">
			<a class="site-btn" href={resolve('/gallery')}>Browse gallery</a>
		</p>
	</section>

	<section class="site-section pricing-teaser" aria-labelledby="pricing-teaser-heading">
		<h2 id="pricing-teaser-heading">Plans</h2>
		<ul class="plan-facts">
			<li>
				<strong>Free</strong>
				<span class="plan-price">$0</span>
				<p>One project when you register. Deleting it does not unlock another create.</p>
			</li>
			<li>
				<strong>Maker</strong>
				<span class="plan-price">$2.99</span>
				<p>Up to five concurrent projects, full gallery access, and Add to my projects.</p>
			</li>
			<li class="plan-featured">
				<strong>Lifetime</strong>
				<span class="plan-price">$9.99 <em>one-time</em></span>
				<p>Pay once. Up to twenty concurrent projects and full gallery access.</p>
			</li>
		</ul>
		<p>
			<a class="site-btn" href={resolve('/pricing')}>View pricing</a>
		</p>
	</section>

	<SiteFooter />
</div>

<style>
	.hero {
		position: relative;
		min-height: min(92vh, 820px);
		display: flex;
		align-items: flex-start;
		padding: 0;
		overflow: hidden;
		border-bottom: 1px solid var(--site-border);
	}

	.hero-media {
		position: absolute;
		inset: 0;
		background: #141416;
	}

	.hero-video,
	.hero-fallback {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.hero-video {
		z-index: 1;
	}

	.hero-fallback {
		z-index: 0;
	}

	.hero-scrim {
		position: absolute;
		inset: 0;
		z-index: 2;
		background: #0c0c0e;
		opacity: 0.72;
	}

	.hero-copy {
		position: relative;
		z-index: 3;
		padding: 72px 24px 56px;
		max-width: 960px;
		width: 100%;
		margin: 0 auto;
	}

	.hero-eyebrow {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--site-accent);
		margin: 0 0 12px;
	}

	.hero-copy h1 {
		font-family: var(--site-font-display);
		font-weight: 800;
		font-size: clamp(2.75rem, 8vw, 5.5rem);
		line-height: 0.95;
		letter-spacing: -0.04em;
		margin: 0 0 16px;
		max-width: 12ch;
	}

	.hero-lead {
		margin: 0 0 28px;
		max-width: 28rem;
		color: var(--site-text);
		font-size: 1rem;
	}

	.hero-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	.hero-note {
		margin: 10px 0 0;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--site-muted);
	}

	.how-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0;
		border-top: 1px solid var(--site-border);
	}

	.how-list li {
		border-bottom: 1px solid var(--site-border);
		padding: 0;
		list-style: none;
	}

	.how-item {
		cursor: default;
	}

	.how-row {
		display: grid;
		grid-template-columns: 40px 3rem 1fr;
		gap: 16px;
		align-items: start;
		padding: 20px 0;
	}

	.how-item.open {
		background: var(--site-surface);
	}

	.how-list img {
		display: block;
		width: 40px;
		height: 40px;
		background: var(--site-surface);
		border: 1px solid var(--site-border);
	}

	.how-num {
		font-size: 0.75rem;
		color: var(--site-accent);
		padding-top: 4px;
	}

	.how-list strong {
		display: block;
		font-family: var(--site-font-display);
		font-size: 1.1rem;
		margin-bottom: 4px;
		color: var(--site-text);
	}

	.how-list p {
		margin: 0;
		color: var(--site-muted);
	}

	.how-video-wrap {
		display: grid;
		grid-template-rows: 0fr;
		transition: grid-template-rows 0.2s ease;
	}

	.how-item.open .how-video-wrap {
		grid-template-rows: 1fr;
		padding-bottom: 20px;
	}

	.how-video-inner {
		overflow: hidden;
		min-height: 0;
	}

	.how-video-inner video {
		width: 100%;
		max-height: 280px;
		object-fit: cover;
		background: #101012;
		border: 1px solid var(--site-border);
		display: block;
	}

	.gallery-promo {
		border-top: 1px solid var(--site-border);
		border-bottom: 1px solid var(--site-border);
		background: var(--site-surface);
		max-width: none;
		overflow: hidden;
	}

	.gallery-promo h2,
	.gallery-promo-lead,
	.gallery-promo-cta,
	.gallery-promo .site-muted {
		max-width: 960px;
		margin-left: auto;
		margin-right: auto;
		padding-left: 24px;
		padding-right: 24px;
		box-sizing: border-box;
	}

	.gallery-promo-lead {
		margin: 0 auto 28px;
		color: var(--site-muted);
		max-width: 40rem;
	}

	.carousel {
		width: 100%;
		overflow: hidden;
		border-top: 1px solid var(--site-border);
		border-bottom: 1px solid var(--site-border);
		background: var(--site-bg);
		margin-bottom: 28px;
	}

	.carousel-track {
		display: flex;
		width: max-content;
		animation: carousel-scroll 48s linear infinite;
	}

	.carousel:hover .carousel-track,
	.carousel:focus-within .carousel-track {
		animation-play-state: paused;
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
		max-height: 260px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 12px;
		border-right: 1px solid var(--site-border);
		color: inherit;
		text-decoration: none;
		background: var(--site-bg);
		overflow: hidden;
	}

	.carousel-card:hover,
	.carousel-card:focus-visible {
		background: var(--site-surface);
		text-decoration: none;
		outline: 1px solid var(--site-accent);
		outline-offset: -1px;
	}

	.carousel-card img,
	.carousel-ph {
		width: 156px;
		height: 156px;
		max-width: 100%;
		max-height: 156px;
		aspect-ratio: 1;
		object-fit: contain;
		background: #101012;
		image-rendering: pixelated;
		display: block;
		border: 1px solid var(--site-border);
		flex-shrink: 0;
	}

	.carousel-name {
		font-family: var(--site-font-display);
		font-size: 0.9rem;
		color: var(--site-text);
	}

	.carousel-author {
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--site-muted);
	}

	.carousel-likes {
		font-size: 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--site-muted);
		opacity: 0.85;
	}

	.gallery-promo-cta {
		margin: 0 auto;
	}

	.plan-facts {
		list-style: none;
		margin: 0 0 24px;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 12px;
	}

	.plan-facts li {
		padding: 20px 18px;
		border: 1px solid var(--site-border);
		background: var(--site-bg);
		color: var(--site-muted);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.plan-facts .plan-featured {
		border-color: var(--site-accent);
		background: var(--site-surface);
	}

	.plan-facts strong {
		display: block;
		color: var(--site-text);
		font-family: var(--site-font-display);
		font-size: 1.15rem;
		margin: 0;
	}

	.plan-price {
		font-family: var(--site-font-display);
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--site-text);
	}

	.plan-price em {
		font-style: normal;
		font-size: 0.65rem;
		font-weight: 400;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--site-muted);
		margin-left: 4px;
	}

	.plan-facts p {
		margin: 0;
		font-size: 0.85rem;
		max-width: none;
	}

	@media (max-width: 800px) {
		.plan-facts {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 640px) {
		.how-row {
			grid-template-columns: 40px 1fr;
		}
		.how-num {
			display: none;
		}
		.hero-copy {
			padding-top: 48px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.carousel-track {
			animation: none;
		}
		.how-video-wrap {
			transition: none;
		}
	}
</style>
