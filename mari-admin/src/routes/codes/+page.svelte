<script>
	let { data, form } = $props();
</script>

<h2 class="page-title">Referral codes</h2>

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
	<strong>Create code</strong>
	<form class="inline" method="POST" action="?/create" style="margin-top:10px">
		<label>
			Creator
			<select name="creator_id" required>
				<option value="">Select…</option>
				{#each data.creators as c (c.id)}
					<option value={c.id}>{c.name}</option>
				{/each}
			</select>
		</label>
		<label>
			Code
			<input name="code" required placeholder="creator123" />
		</label>
		<label>
			Active
			<input name="active" type="checkbox" checked />
		</label>
		<button class="btn btn-primary" type="submit">Create</button>
	</form>
	{#if !data.creators.length}
		<p class="muted">Create a creator first.</p>
	{/if}
</div>

<table class="data">
	<thead>
		<tr>
			<th>Code</th>
			<th>Creator</th>
			<th>Active</th>
			<th>Created</th>
			<th>Actions</th>
		</tr>
	</thead>
	<tbody>
		{#each data.codes as row (row.id)}
			<tr>
				<td>
					<form class="inline" method="POST" action="?/update">
						<input type="hidden" name="id" value={row.id} />
						<input name="code" value={row.code} required />
						<label>
							Active
							<input name="active" type="checkbox" checked={row.active} />
						</label>
						<button class="btn btn-primary" type="submit">Save</button>
					</form>
				</td>
				<td>
					{row.creator_name ?? '—'}
					<div class="muted mono">{row.creator_id.slice(0, 8)}…</div>
				</td>
				<td><span class="badge">{row.active ? 'yes' : 'no'}</span></td>
				<td class="mono">{row.created_at}</td>
				<td class="row-actions">
					<form method="POST" action="?/toggle">
						<input type="hidden" name="id" value={row.id} />
						<input type="hidden" name="active" value={String(row.active)} />
						<button class="btn" type="submit">{row.active ? 'Deactivate' : 'Activate'}</button>
					</form>
					<form
						method="POST"
						action="?/delete"
						onsubmit={(e) => {
							if (!confirm('Delete this code?')) e.preventDefault();
						}}
					>
						<input type="hidden" name="id" value={row.id} />
						<button class="btn btn-danger" type="submit">Delete</button>
					</form>
				</td>
			</tr>
		{:else}
			<tr><td colspan="5" class="muted">No codes yet</td></tr>
		{/each}
	</tbody>
</table>
