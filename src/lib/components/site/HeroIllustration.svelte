<script>
	/** @type {Record<string, { hex: string, name: string }>} */
	const yarns = {
		'.': { hex: '#f6ead8', name: 'Oat' },
		r: { hex: '#d8685b', name: 'Berry' },
		d: { hex: '#a9473d', name: 'Cherry' },
		y: { hex: '#f3d27a', name: 'Butter' },
		g: { hex: '#8fae7d', name: 'Leaf' },
		G: { hex: '#5f7d52', name: 'Moss' }
	};

	const motif = [
		'......GG......',
		'...gg.G.gg....',
		'....ggGgg.....',
		'...rrgggrrr...',
		'..rrrrrrrrrr..',
		'.rryrrrrryrrr.',
		'.rrrrryrrrrrd.',
		'.ryrrrrrrryrd.',
		'..rrryrrrrrd..',
		'..rrrrrryrdd..',
		'...ryrrrrdd...',
		'....rrrrdd....',
		'.....rrdd.....',
		'......dd......'
	];

	const CELL = 10;
	const COLS = motif[0].length;
	const ROWS = motif.length;
	const HIGHLIGHT = 11;

	const cells = motif.flatMap((line, y) =>
		[...line].map((ch, x) => ({ id: `${x}-${y}`, x, y, hex: yarns[ch].hex }))
	);

	/** Rows are worked bottom-up, alternating direction, like in the studio. */
	const rowNumber = ROWS - HIGHLIGHT;
	const leftToRight = rowNumber % 2 === 1;
	const segments = (() => {
		const chars = [...motif[HIGHLIGHT]];
		if (!leftToRight) chars.reverse();
		/** @type {{ key: string, ch: string, count: number }[]} */
		const runs = [];
		for (const ch of chars) {
			const last = runs.at(-1);
			if (last && last.ch === ch) last.count++;
			else runs.push({ key: `${runs.length}`, ch, count: 1 });
		}
		return runs.map((r) => ({ ...r, ...yarns[r.ch] }));
	})();
</script>

<div class="illo" aria-hidden="true">
	<div class="polaroid">
		<span class="tape tape-a"></span>
		<svg viewBox="0 0 {COLS * CELL} {ROWS * CELL}" shape-rendering="crispEdges">
			{#each cells as c (c.id)}
				<rect x={c.x * CELL} y={c.y * CELL} width={CELL} height={CELL} fill={c.hex} />
			{/each}
		</svg>
		<span class="caption">my picture</span>
	</div>

	<svg class="arrow" viewBox="0 0 120 60" fill="none">
		<path
			d="M6 40 C 30 6, 70 4, 104 26"
			stroke="#7f6c62"
			stroke-width="2.5"
			stroke-linecap="round"
			stroke-dasharray="1 7"
		/>
		<path
			d="M92 18 L106 27 L92 34"
			stroke="#7f6c62"
			stroke-width="2.5"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	</svg>

	<div class="chart">
		<span class="tape tape-b"></span>
		<svg viewBox="-2 -2 {COLS * CELL + 22} {ROWS * CELL + 4}">
			{#each cells as c (c.id)}
				<rect
					x={c.x * CELL + 0.6}
					y={c.y * CELL + 0.6}
					width={CELL - 1.2}
					height={CELL - 1.2}
					rx="2.6"
					fill={c.hex}
					opacity={c.y === HIGHLIGHT ? 1 : 0.7}
				/>
				<path
					d="M{c.x * CELL + 3} {c.y * CELL + 3.5} l2 3 l2 -3"
					stroke="rgba(255,255,255,0.45)"
					stroke-width="0.9"
					fill="none"
					stroke-linecap="round"
					opacity={c.y === HIGHLIGHT ? 1 : 0.5}
				/>
			{/each}
			<rect
				x="-1"
				y={HIGHLIGHT * CELL - 1}
				width={COLS * CELL + 2}
				height={CELL + 2}
				rx="3"
				fill="none"
				stroke="#3e2f2a"
				stroke-width="1.4"
			/>
			{#each motif as _, y (y)}
				<text
					x={COLS * CELL + 10}
					y={y * CELL + CELL / 2 + 2.5}
					text-anchor="middle"
					font-size="6"
					font-weight={y === HIGHLIGHT ? 800 : 600}
					fill={y === HIGHLIGHT ? '#3e2f2a' : '#b8a697'}>{ROWS - y}</text
				>
			{/each}
		</svg>
	</div>

	<div class="row-note">
		<span class="row-note-title">Row {rowNumber} {leftToRight ? '→' : '←'}</span>
		<span class="row-note-chips">
			{#each segments as s (s.key)}
				<span class="chip"><i style:background={s.hex}></i>{s.count} {s.name}</span>
			{/each}
		</span>
	</div>

	<svg class="yarn" viewBox="0 0 80 80">
		<circle cx="38" cy="40" r="28" fill="#e2a93f" />
		<g fill="none" stroke="#f7d38c" stroke-width="3" stroke-linecap="round">
			<path d="M14 30c12 2 26 12 34 34" />
			<path d="M16 52c10-4 24-2 36 8" />
			<path d="M24 16c8 8 18 24 18 50" />
			<path d="M46 13c-2 12 4 26 18 38" />
		</g>
		<path d="M64 56c8 4 12 12 6 20" fill="none" stroke="#e2a93f" stroke-width="3" stroke-linecap="round" />
	</svg>
</div>

<style>
	.illo {
		position: relative;
		width: 100%;
		max-width: 520px;
		aspect-ratio: 1 / 0.92;
		margin: 0 auto;
	}

	.polaroid,
	.chart {
		position: absolute;
		background: #fff;
		border-radius: 6px;
		box-shadow: var(--site-shadow-lg);
	}

	.polaroid {
		left: 0;
		top: 6%;
		width: 42%;
		padding: 10px 10px 34px;
		transform: rotate(-6deg);
	}
	.polaroid svg {
		display: block;
		width: 100%;
		height: auto;
		border-radius: 2px;
	}
	.caption {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 4px;
		text-align: center;
		font-family: var(--site-font-hand);
		font-size: 1.35rem;
		color: var(--site-muted);
	}

	.chart {
		right: 0;
		top: 14%;
		width: 58%;
		padding: 14px;
		transform: rotate(2.5deg);
		background-color: #fff;
		background-image:
			linear-gradient(#f1e7da 1px, transparent 1px),
			linear-gradient(90deg, #f1e7da 1px, transparent 1px);
		background-size: 12px 12px;
	}
	.chart svg {
		display: block;
		width: 100%;
		height: auto;
		font-family: var(--site-font-body);
	}

	.tape {
		position: absolute;
		width: 70px;
		height: 22px;
		top: -11px;
		opacity: 0.85;
		background: repeating-linear-gradient(
			45deg,
			rgba(255, 255, 255, 0.35) 0 6px,
			transparent 6px 12px
		);
	}
	.tape-a {
		left: 50%;
		transform: translateX(-50%) rotate(-4deg);
		background-color: #ec9a8d;
	}
	.tape-b {
		left: 20%;
		transform: rotate(5deg);
		background-color: #a9c39a;
	}

	.arrow {
		position: absolute;
		left: 26%;
		top: 0;
		width: 26%;
	}

	.row-note {
		position: absolute;
		left: 4%;
		bottom: 2%;
		max-width: 74%;
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 12px 14px;
		background: #fffdf8;
		border: 2px dashed var(--site-border-strong);
		border-radius: 14px;
		box-shadow: var(--site-shadow);
		transform: rotate(-1.5deg);
	}
	.row-note-title {
		font-family: var(--site-font-hand);
		font-size: 1.5rem;
		line-height: 1;
		color: var(--site-accent);
	}
	.row-note-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 3px 10px 3px 4px;
		border-radius: 999px;
		background: var(--site-surface-2);
		font-size: 0.82rem;
		font-weight: 700;
		color: var(--site-text);
		white-space: nowrap;
	}
	.chip i {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
	}

	.yarn {
		position: absolute;
		right: 2%;
		bottom: 0;
		width: 19%;
		animation: bob 5s ease-in-out infinite;
	}

	@keyframes bob {
		0%,
		100% {
			transform: translateY(0) rotate(0deg);
		}
		50% {
			transform: translateY(-6px) rotate(-6deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.yarn {
			animation: none;
		}
	}
</style>
