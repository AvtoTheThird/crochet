<script>
	let { data, form } = $props();
</script>

<h2 class="page-title">Attributions</h2>
<p class="muted">Permanent user → creator referral links. Locked after first earn commission.</p>

{#if form?.error}
	<p class="error">{form.error}</p>
{/if}
{#if form?.ok}
	<p class="ok">Updated.</p>
{/if}
{#if data.error}
	<p class="error">{data.error}</p>
{/if}

<table class="data">
	<thead>
		<tr>
			<th>User</th>
			<th>Creator</th>
			<th>Code</th>
			<th>Source</th>
			<th>Locked</th>
			<th>Created</th>
			<th>Admin</th>
		</tr>
	</thead>
	<tbody>
		{#each data.rows as row (row.id)}
			<tr>
				<td class="mono">{row.user_id}</td>
				<td>
					{row.creator_name ?? '—'}
					<div class="muted mono">{row.creator_id.slice(0, 8)}…</div>
				</td>
				<td class="mono">{row.code ?? row.referral_code_id}</td>
				<td><span class="badge">{row.source}</span></td>
				<td>
					{#if row.locked_at}
						<span class="badge">locked</span>
						<div class="muted mono">{row.locked_at}</div>
					{:else}
						<span class="badge">open</span>
					{/if}
				</td>
				<td class="mono">{row.created_at}</td>
				<td>
					{#if row.locked_at}
						<form method="POST" action="?/unlock" style="margin-bottom:6px">
							<input type="hidden" name="id" value={row.id} />
							<button class="btn" type="submit">Unlock</button>
						</form>
					{/if}
					<form class="inline" method="POST" action="?/reassign">
						<input type="hidden" name="id" value={row.id} />
						<input name="code" placeholder="new code" required />
						<button class="btn btn-primary" type="submit">Reassign</button>
					</form>
				</td>
			</tr>
		{:else}
			<tr><td colspan="7" class="muted">No attributions yet</td></tr>
		{/each}
	</tbody>
</table>
