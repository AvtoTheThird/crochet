<script>
	let { form } = $props();
</script>

<div class="login-wrap">
	<div class="login-box">
		<h1>Mari Admin</h1>
		<p class="muted">Operator login. Uses ADMIN_PASSWORD from .env.</p>
		<form class="stack" method="POST">
			<label>
				Password
				<input type="password" name="password" required autocomplete="current-password" />
			</label>
			{#if form?.error}
				<p class="error">{form.error}</p>
			{/if}
			<button class="btn btn-primary" type="submit">Sign in</button>
		</form>
	</div>
</div>
