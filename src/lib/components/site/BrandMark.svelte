<script>
	/** @type {{ size?: number }} */
	let { size = 32 } = $props();
</script>

<svg
	class="brand-mark"
	width={size}
	height={size}
	viewBox="0 0 40 40"
	aria-hidden="true"
	focusable="false"
>
	<circle cx="19" cy="20" r="15" fill="#c65d50" />
	<path
		d="M7 15c6 1 14 6 18 18M9 26c5-2 12-1 18 4M12 8c4 4 10 12 10 26M24 6c-1 6 2 14 9 20"
		fill="none"
		stroke="#f9e0d9"
		stroke-width="2"
		stroke-linecap="round"
	/>
	<path
		d="M33 29c3 2 4 5 2 7"
		fill="none"
		stroke="#c65d50"
		stroke-width="2.2"
		stroke-linecap="round"
	/>
</svg>

<style>
	.brand-mark {
		flex-shrink: 0;
		display: block;
	}
</style>
