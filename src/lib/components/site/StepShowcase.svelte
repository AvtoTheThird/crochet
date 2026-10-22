<script>
	/** @typedef {{ n: string, title: string, body: string, video: string, color: string, soft: string }} Step */

	/** @type {{ steps: Step[] }} */
	let { steps } = $props();

	let active = $state(0);
	let paused = $state(true);
	let currentTime = $state(0);
	let duration = $state(0);
	let inView = false;
	let userPaused = false;

	const progress = $derived(duration > 0 ? Math.min(1, currentTime / duration) : 0);
	const step = $derived(steps[active]);

	const reducedMotion = () =>
		typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

	/** @param {number} i */
	function select(i) {
		active = i;
		currentTime = 0;
		userPaused = false;
	}

	function onEnded() {
		select((active + 1) % steps.length);
	}

	function togglePlay() {
		userPaused = !paused;
		paused = !paused;
	}

	/** @param {KeyboardEvent} e */
	function onTabKey(e) {
		const delta = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
		if (!delta) return;
		e.preventDefault();
		const next = (active + delta + steps.length) % steps.length;
		select(next);
		document.getElementById(`step-tab-${next}`)?.focus();
	}

	/** Play only while the showcase is on screen. */
	function watchVisibility(/** @type {HTMLElement} */ node) {
		const io = new IntersectionObserver(
			([entry]) => {
				inView = entry.isIntersecting;
				if (!inView) paused = true;
				else if (!userPaused && !reducedMotion()) paused = false;
			},
			{ threshold: 0.35 }
		);
		io.observe(node);
		return () => io.disconnect();
	}

	/** Keep playing across src changes when the viewer hasn't paused. */
	function onLoaded() {
		if (inView && !userPaused && !reducedMotion()) paused = false;
	}
</script>

<div class="showcase" {@attach watchVisibility}>
	<div class="tabs" role="tablist" aria-label="Steps" aria-orientation="vertical">
		{#each steps as s, i (s.n)}
			<button
				type="button"
				role="tab"
				id="step-tab-{i}"
				class={['tab', i === active && 'active']}
				style:--c={s.color}
				style:--soft={s.soft}
				aria-selected={i === active}
				aria-controls="step-panel"
				tabindex={i === active ? 0 : -1}
				onclick={() => select(i)}
				onkeydown={onTabKey}
			>
				<span class="num">{s.n}</span>
				<span class="tab-text">
					<strong>{s.title}</strong>
					<span class="tab-body">{s.body}</span>
				</span>
				<span class="bar" aria-hidden="true">
					<span style:transform="scaleX({i === active ? progress : 0})"></span>
				</span>
			</button>
		{/each}
	</div>

	<div class="stage" id="step-panel" role="tabpanel" aria-labelledby="step-tab-{active}">
		<span class="tape tape-l"></span>
		<span class="tape tape-r"></span>
		<div class="screen">
			<video
				src={step.video}
				muted
				playsinline
				preload="metadata"
				bind:paused
				bind:currentTime
				bind:duration
				onended={onEnded}
				onloadeddata={onLoaded}
				aria-label="Screen recording: {step.title}"
			></video>
			<button
				type="button"
				class="play"
				onclick={togglePlay}
				aria-label={paused ? 'Play video' : 'Pause video'}
			>
				{#if paused}
					<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
				{:else}
					<svg viewBox="0 0 24 24" aria-hidden="true"
						><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg
					>
				{/if}
			</button>
		</div>
		<p class="stage-caption">
			<span class="stage-step" style:background={step.soft}>Step {step.n}</span>
			{step.title}
		</p>
	</div>
</div>

<style>
	.showcase {
		display: grid;
		grid-template-columns: minmax(260px, 0.8fr) minmax(0, 1.4fr);
		gap: clamp(20px, 4vw, 48px);
		align-items: center;
	}

	.tabs {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.tab {
		position: relative;
		display: grid;
		grid-template-columns: 44px 1fr;
		gap: 14px;
		align-items: start;
		width: 100%;
		padding: 16px 18px 20px;
		border: 2px solid transparent;
		border-radius: var(--site-radius);
		background: transparent;
		color: var(--site-text);
		font: inherit;
		text-align: left;
		cursor: pointer;
		overflow: hidden;
		transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
	}
	.tab:hover {
		background: var(--site-surface);
	}
	.tab.active {
		background: var(--site-surface);
		border-color: var(--c);
		border-style: dashed;
		box-shadow: var(--site-shadow);
	}

	.num {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: var(--soft);
		color: var(--site-text);
		font-family: var(--site-font-display);
		font-weight: 700;
		font-size: 1rem;
	}
	.tab.active .num {
		background: var(--c);
		color: #fff;
	}

	.tab-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.tab-text strong {
		font-family: var(--site-font-display);
		font-weight: 600;
		font-size: 1.15rem;
	}
	.tab-body {
		color: var(--site-muted);
		font-size: 0.95rem;
		line-height: 1.5;
	}

	.bar {
		position: absolute;
		left: 18px;
		right: 18px;
		bottom: 8px;
		height: 4px;
		border-radius: 999px;
		background: var(--site-surface-2);
		overflow: hidden;
		opacity: 0;
	}
	.tab.active .bar {
		opacity: 1;
	}
	.bar span {
		display: block;
		height: 100%;
		background: var(--c);
		transform-origin: left;
		transition: transform 0.25s linear;
	}

	.stage {
		position: relative;
		margin: 0;
		padding: 14px 14px 18px;
		background: #fff;
		border-radius: 10px;
		box-shadow: var(--site-shadow-lg);
		transform: rotate(0.8deg);
	}

	.screen {
		position: relative;
		border-radius: 6px;
		overflow: hidden;
		background: var(--site-surface-2);
		aspect-ratio: 16 / 10;
	}
	.screen video {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.play {
		position: absolute;
		right: 12px;
		bottom: 12px;
		width: 42px;
		height: 42px;
		display: grid;
		place-items: center;
		border: none;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.92);
		color: var(--site-text);
		box-shadow: var(--site-shadow);
		cursor: pointer;
	}
	.play svg {
		width: 20px;
		height: 20px;
		fill: currentColor;
	}

	.stage-caption {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 14px 4px 0;
		font-family: var(--site-font-hand);
		font-size: 1.6rem;
		line-height: 1;
		color: var(--site-text);
		max-width: none;
	}
	.stage-step {
		font-family: var(--site-font-body);
		font-size: 0.78rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 4px 10px;
		border-radius: 999px;
	}

	.tape {
		position: absolute;
		top: -12px;
		width: 90px;
		height: 26px;
		opacity: 0.8;
		background: repeating-linear-gradient(
			-45deg,
			rgba(255, 255, 255, 0.4) 0 6px,
			transparent 6px 12px
		);
	}
	.tape-l {
		left: -18px;
		transform: rotate(-28deg);
		background-color: #f1c27a;
	}
	.tape-r {
		right: -18px;
		transform: rotate(28deg);
		background-color: #c3b3dd;
	}

	@media (max-width: 860px) {
		.showcase {
			grid-template-columns: minmax(0, 1fr);
		}
		.stage {
			order: -1;
			transform: none;
		}
		.tabs {
			flex-direction: row;
			overflow-x: auto;
			scroll-snap-type: x mandatory;
			padding-bottom: 4px;
		}
		.tab {
			flex: 0 0 min(78%, 300px);
			scroll-snap-align: start;
			background: var(--site-surface);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.bar span {
			transition: none;
		}
	}
</style>
