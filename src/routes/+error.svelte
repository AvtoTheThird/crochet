<script>
	import { page } from '$app/state';
	import '$lib/styles/site.css';
</script>

<main class="err">
	<p class="err-hand">oops, we dropped a stitch</p>
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
		background-color: #fbf6ef;
		background-image: radial-gradient(#e7d8c5 1.2px, transparent 1.3px);
		background-size: 18px 18px;
		color: #3e2f2a;
		font-family: 'Nunito', system-ui, sans-serif;
		padding: 24px;
		text-align: center;
	}
	.err-hand {
		margin: 0;
		font-family: 'Caveat', 'Segoe Print', cursive;
		font-size: 1.8rem;
		color: #7f6c62;
	}
	h1 {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 5rem;
		line-height: 1;
		color: #c65d50;
		margin: 0;
	}
	p {
		margin: 0;
	}
	a {
		margin-top: 12px;
		padding: 11px 22px;
		border-radius: 999px;
		background: #c65d50;
		color: #fff;
		font-weight: 800;
		text-decoration: none;
	}
	a:hover {
		background: #b14e42;
	}
</style>
