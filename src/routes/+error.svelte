<script>
	import { page } from '$app/state';
</script>

<main class="err">
	<h1>{page.status || 500}</h1>
	<p>{page.error?.message || 'Something went wrong.'}</p>
	<a href="/">Back to home</a>
</main>

<style>
	.err {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		background: #0d0d0f;
		color: #e8e8f0;
		font-family: system-ui, sans-serif;
		padding: 24px;
		text-align: center;
	}
	h1 {
		color: #ff6b35;
		margin: 0;
	}
	a {
		color: #e8ff47;
	}
</style>
