<script>
	let { data, form } = $props();
</script>

<div class="toolbar">
	<h2 class="page-title" style="margin:0">Creators</h2>
</div>

{#if form?.error}
	<p class="error">{form.error}</p>
{/if}
{#if form?.ok}
	<p class="ok">Saved.</p>
{/if}
{#if data.error}
	<p class="error">{data.error}</p>
{/if}

<div class="card">
	<strong>Create creator</strong>
	<form class="stack" method="POST" action="?/create" style="margin-top:10px">
		<label>
			Name
			<input name="name" required />
		</label>
		<label>
			Channel URL
			<input name="channel_url" type="url" placeholder="https://" />
		</label>
		<label>
			Commission % cut
			<input name="commission_percentage_cut" type="number" min="0" max="100" step="0.01" value="50" required />
		</label>
		<button class="btn btn-primary" type="submit">Create</button>
	</form>
</div>

<table class="data">
	<thead>
		<tr>
			<th>Name</th>
			<th>Cut %</th>
			<th>Referred</th>
			<th>Locked</th>
			<th>Channel</th>
			<th>Actions</th>
		</tr>
	</thead>
	<tbody>
		{#each data.creators as c (c.id)}
			{@const st = data.stats[c.id]}
			<tr>
				<td>
					<form class="stack" method="POST" action="?/update">
						<input type="hidden" name="id" value={c.id} />
						<input name="name" value={c.name} required />
						<input name="channel_url" value={c.channel_url ?? ''} placeholder="https://" />
						<input
							name="commission_percentage_cut"
							type="number"
							min="0"
							max="100"
							step="0.01"
							value={c.commission_percentage_cut}
							required
						/>
						<div class="row-actions">
							<button class="btn btn-primary" type="submit">Save</button>
						</div>
					</form>
					<p class="muted mono">{c.id}</p>
				</td>
				<td class="mono">{c.commission_percentage_cut}</td>
				<td class="mono">{st?.users_referred ?? 0}</td>
				<td class="mono">{st?.users_referred_locked ?? 0}</td>
				<td>
					{#if c.channel_url}
						<a {...{ href: c.channel_url }} target="_blank" rel="noreferrer">link</a>
					{:else}
						—
					{/if}
				</td>
				<td>
					<form method="POST" action="?/delete" onsubmit={(e) => {
						if (!confirm('Delete creator? Codes will cascade-delete.')) e.preventDefault();
					}}>
						<input type="hidden" name="id" value={c.id} />
						<button class="btn btn-danger" type="submit">Delete</button>
					</form>
				</td>
			</tr>
		{:else}
			<tr><td colspan="6" class="muted">No creators yet</td></tr>
		{/each}
	</tbody>
</table>
