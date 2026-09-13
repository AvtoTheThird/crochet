<script>
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { initStudio, studioActions } from '$lib/studio/index.js';
	import { syncStepFromUrl } from '$lib/studio/steps.js';

	let mainCanvas;
	let gridCanvas;
	let countCanvas;
	let highlightCanvas;
	let wrapper;
	let dropZone;
	let cropOverlay;
	let cropBox;
	let zoomInfo;
	let canvasArea;
	let paletteList;
	let paletteCount;

	let sidebarCollapsed = $state(false);
	let studioReady = false;

	const a = studioActions;

	function toggleSidebar() {
		sidebarCollapsed = !sidebarCollapsed;
	}

	onMount(() => {
		const cleanup = initStudio({
			mainCanvas,
			gridCanvas,
			countCanvas,
			highlightCanvas,
			wrapper,
			dropZone,
			cropOverlay,
			cropBox,
			zoomInfo,
			canvasArea,
			paletteList,
			paletteCount
		});
		studioReady = true;
		syncStepFromUrl(page.params.step);
		return cleanup;
	});

	afterNavigate(() => {
		if (!studioReady) return;
		syncStepFromUrl(page.params.step);
	});
</script>

<header>
	<div>
		<h1>PixelCount Studio</h1>
		<div class="sub">Pixel Art Run-Length Encoder</div>
	</div>
	<button
		type="button"
		class="btn btn-secondary"
		id="save-project-btn"
		onclick={() => a.saveProject()}
		title="Save project (also auto-saves when advancing stages)"
	>
		💾 Save Project
	</button>
</header>

<div id="walk-topbar" class="walk-topbar" aria-hidden="true">
	<div id="walk-topbar-progress" class="walk-topbar-progress"></div>
	<div id="walk-topbar-detail" class="walk-topbar-detail"></div>
	<div id="walk-topbar-rowinfo" class="walk-topbar-rowinfo"></div>
</div>

<div class="step-bar">
	<div class="step active" id="step1"><span class="num">1</span> Load Image</div>
	<div class="step" id="step2"><span class="num">2</span> Crop</div>
	<div class="step" id="step3"><span class="num">3</span> Grid Setup</div>
	<div class="step" id="step4"><span class="num">4</span> Color Correction</div>
	<div class="step" id="step5"><span class="num">5</span> Count</div>
	<div class="step" id="step6"><span class="num">6</span> Pattern Walk</div>
</div>

<div class="main" id="main-layout" class:sidebar-collapsed={sidebarCollapsed} data-step="1">
	<button
		type="button"
		id="sidebar-toggle"
		class="sidebar-toggle"
		aria-expanded={!sidebarCollapsed}
		title="Toggle sidebar"
		onclick={toggleSidebar}
	>
		{sidebarCollapsed ? '▶ Show panel' : '◀ Hide panel'}
	</button>
	<div class="sidebar">
		<div class="panel active" id="panel1">
			<div class="field-label">Image Source</div>
			<button
				type="button"
				class="btn btn-secondary"
				onclick={() => document.getElementById('file-input')?.click()}
			>
				📁 Browse File
			</button>
			<input type="file" id="file-input" accept="image/*" style="display:none" />
			<div class="info-badge">
				Drop any pixelated image here or click Browse. PNG recommended for clean pixel boundaries.
			</div>
			<hr class="separator" />
			<div class="field-label">Saved Projects</div>
			<div
				id="project-list"
				style="display:flex;flex-direction:column;gap:8px;overflow-y:auto;max-height:min(40vh,300px)"
			></div>
		</div>

		<div class="panel" id="panel2">
			<div class="field-label">Crop Region</div>
			<div class="info-badge">
				X: <span id="crop-x">0</span> &nbsp; Y: <span id="crop-y">0</span><br />
				W: <span id="crop-w">-</span> &nbsp; H: <span id="crop-h">-</span>
			</div>
			<button type="button" class="btn btn-secondary" onclick={() => a.resetCrop()}>↺ Reset Crop</button>
			<hr class="separator" />
			<button type="button" class="btn btn-primary" onclick={() => a.applyCrop()}>Apply Crop →</button>
		</div>

		<div class="panel" id="panel3">
			<div class="field-label">Pixel Width (px)</div>
			<input type="number" id="px-w" value="8" min="1" step="any" />
			<div class="field-label">Pixel Height (px)</div>
			<input type="number" id="px-h" value="8" min="1" step="any" />
			<hr class="separator" />
			<div class="field-label">Pixel Count (width x height)</div>
			<div class="row">
				<input type="number" id="grid-cols-input" min="1" placeholder="Width" />
				<input type="number" id="grid-rows-input" min="1" placeholder="Height" />
			</div>
			<div class="info-badge" style="font-size:0.62rem">
				Enter the artwork's pixel count to auto-calculate pixel width and height.
			</div>
			<div class="field-label">Zoom</div>
			<div class="tolerance-row">
				<input type="range" id="grid-zoom" min="25" max="800" value="100" />
				<span id="grid-zoom-val">100%</span>
			</div>
			<button type="button" class="btn btn-secondary" onclick={() => a.resetGridZoom()}>Reset Zoom</button>
			<div class="field-label">Grid Opacity</div>
			<div class="tolerance-row">
				<input type="range" id="grid-opacity" min="0" max="100" value="35" />
				<span id="grid-opacity-val">35</span>
			</div>
			<button type="button" class="btn btn-secondary" onclick={() => a.drawGrid()}>⊞ Preview Grid</button>
			<hr class="separator" />
			<div class="field-label">Start Direction</div>
			<div class="row">
				<button
					type="button"
					class="btn btn-secondary active"
					id="start-ltr"
					onclick={() => a.setStartDirection('ltr')}
				>
					Left → Right
				</button>
				<button
					type="button"
					class="btn btn-secondary"
					id="start-rtl"
					onclick={() => a.setStartDirection('rtl')}
				>
					Right → Left
				</button>
			</div>
			<div class="info-badge" style="font-size:0.62rem">
				The bottom row starts this way; each row above alternates direction.
			</div>
			<hr class="separator" />
			<div class="field-label">Color Tolerance</div>
			<div class="tolerance-row">
				<input type="range" id="tolerance" min="0" max="128" value="20" />
				<span id="tol-val">20</span>
			</div>
			<div class="info-badge" style="font-size:0.62rem">
				Tolerance merges nearby colors during sampling. Raise if pixels have compression noise.
			</div>
			<button type="button" class="btn btn-primary" onclick={() => a.goColorCorrection()}>
				Color Correction →
			</button>
		</div>

		<div class="panel" id="panel4">
			<div class="info-badge">
				<span id="palette-count" bind:this={paletteCount}>0</span> detected shades · hover a color to
				highlight on artwork
			</div>
			<div id="palette-collapse-row" class="palette-collapse-row" hidden>
				<div class="field-label">Reduce colors</div>
				<div class="row">
					<input
						type="number"
						id="palette-target-count"
						min="2"
						value="8"
						aria-label="Target color count"
					/>
					<button type="button" class="btn btn-secondary" onclick={() => a.collapsePaletteColors()}>
						Collapse
					</button>
				</div>
				<div class="info-badge" style="font-size:0.62rem;margin-top:6px">
					Repeatedly merges the two closest shades until you reach the target count. The rarer shade is
					merged into the more common one.
				</div>
			</div>
			<div class="palette-scroll" id="palette-list" bind:this={paletteList}></div>
			<button type="button" class="btn btn-secondary" onclick={() => a.resetColorCorrections()}>
				↺ Reset Corrections
			</button>
			<button type="button" class="btn btn-secondary" onclick={() => a.goStep(3)}>← Back to Grid</button>
			<button type="button" class="btn btn-primary" onclick={() => a.goCount()}>Count Pixels →</button>
		</div>

		<div class="panel" id="panel5">
			<div class="info-badge">
				Grid: <span id="res-cols">-</span>×<span id="res-rows">-</span> cells<br />
				Segments: <span id="res-segs">-</span> total
			</div>
			<button type="button" class="btn btn-secondary" onclick={() => a.toggleCountOverlay()}>
				👁 Toggle Overlay
			</button>
			<button type="button" class="btn btn-secondary" onclick={() => a.goStep(4)}>← Back to Colors</button>
			<hr class="separator" />
			<div class="field-label">Results (per row)</div>
			<div class="result-scroll" id="result-list"></div>
			<hr class="separator" />
			<div class="field-label">Export (CSV)</div>
			<div class="export-area"><textarea id="export-csv" readonly></textarea></div>
			<button type="button" class="btn btn-primary" onclick={() => a.copyCSV()}>📋 Copy CSV</button>
			<div class="field-label">Export Image (PNG)</div>
			<label class="option-row">
				<input type="checkbox" id="export-grid-overlay" checked />
				Include grid overlay
			</label>
			<div class="export-buttons">
				<button type="button" class="btn btn-secondary" onclick={() => a.exportPNG(1)}>1x</button>
				<button type="button" class="btn btn-secondary" onclick={() => a.exportPNG(2)}>2x</button>
				<button type="button" class="btn btn-secondary" onclick={() => a.exportPNG(3)}>3x</button>
				<button type="button" class="btn btn-secondary" onclick={() => a.exportPNG(4)}>4x</button>
			</div>
			<hr class="separator" />
			<button type="button" class="btn btn-primary" onclick={() => a.enterPatternWalk()}>
				Pattern Walk →
			</button>
		</div>

		<div class="panel" id="panel6">
			<div class="info-badge" id="walk-progress">Stitch 1 of 1</div>
			<div class="walk-detail" id="walk-detail"></div>
			<div class="walk-row-info" id="walk-row-info"></div>
			<div class="row walk-nav">
				<button type="button" class="btn btn-secondary" id="walk-prev">← Previous</button>
				<button type="button" class="btn btn-primary" id="walk-next">Next →</button>
			</div>
			<hr class="separator" />
			<div class="field-label">Display options</div>
			<label class="option-row">
				<input type="checkbox" id="walk-opt-highlight-row" checked />
				Highlight active row
			</label>
			<label class="option-row">
				<input type="checkbox" id="walk-opt-enlarge" checked />
				Enlarge current stitches
			</label>
			<label class="option-row">
				<input type="checkbox" id="walk-opt-dim-rows" checked />
				Dim other rows
			</label>
			<label class="option-row">
				<input type="checkbox" id="walk-opt-grid" checked />
				Show grid
			</label>
			<label class="option-row">
				<input type="checkbox" id="walk-opt-count-numbers" />
				Show count numbers
			</label>
			<hr class="separator" />
			<button type="button" class="btn btn-secondary" onclick={() => a.goStep(5)}>← Back to Count</button>
		</div>
	</div>

	<div class="canvas-area" id="canvas-area" bind:this={canvasArea}>
		<div class="drop-zone" id="drop-zone" bind:this={dropZone}>
			<div class="icon">⬛</div>
			<p>Drop your pixel art image here<br />or click Browse in the sidebar</p>
			<div class="hint">PNG, GIF, BMP, JPEG supported</div>
		</div>

		<div id="canvas-wrapper" bind:this={wrapper}>
			<canvas id="main-canvas" bind:this={mainCanvas}></canvas>
			<canvas id="grid-canvas" bind:this={gridCanvas}></canvas>
			<canvas id="highlight-canvas" bind:this={highlightCanvas}></canvas>
			<canvas id="count-canvas" bind:this={countCanvas}></canvas>
			<div id="crop-overlay" bind:this={cropOverlay}>
				<div class="crop-shade" id="shade-top"></div>
				<div class="crop-shade" id="shade-bottom"></div>
				<div class="crop-shade" id="shade-left"></div>
				<div class="crop-shade" id="shade-right"></div>
				<div class="crop-box" id="crop-box" bind:this={cropBox}>
					<div class="crop-handle tl" data-handle="tl"></div>
					<div class="crop-handle tr" data-handle="tr"></div>
					<div class="crop-handle bl" data-handle="bl"></div>
					<div class="crop-handle br" data-handle="br"></div>
				</div>
			</div>
		</div>
		<div id="zoom-info" bind:this={zoomInfo}>No image</div>
	</div>

	<button
		type="button"
		id="walk-float-prev"
		class="walk-float-btn walk-float-prev"
		onclick={() => a.patternWalkPrev()}
	>
		← Prev
	</button>
	<button
		type="button"
		id="walk-float-next"
		class="walk-float-btn walk-float-next"
		onclick={() => a.patternWalkNext()}
	>
		Next →
	</button>
</div>
