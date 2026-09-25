<script>
	import { resolve } from '$app/paths';

	let { data, form } = $props();

	const statuses = ['pending', 'available', 'paid', 'reversed', 'void'];
</script>

<h2 class="page-title">Commissions</h2>

<form class="inline" method="GET">
	<label>
		Status
		<select name="status">
			<option value="">All</option>
			{#each statuses as s (s)}
				<option value={s} selected={data.filters.status === s}>{s}</option>
			{/each}
		</select>
	</label>
	<button class="btn" type="submit">Filter</button>
</form>

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
			<th>Created</th>
			<th>Creator</th>
			<th>Kind</th>
			<th>Status</th>
			<th>%</th>
			<th>Base</th>
			<th>Commission</th>
			<th>Payment</th>
			<th>Set status</th>
		</tr>
	</thead>
	<tbody>
		{#each data.rows as c (c.id)}
			<tr>
				<td class="mono">{c.created_at}</td>
				<td>
					{c.creator_name ?? '—'}
					<div class="muted mono">{c.creator_id.slice(0, 8)}…</div>
				</td>
				<td>{c.entry_kind}</td>
				<td><span class="badge">{c.status}</span></td>
				<td class="mono">{c.commission_percentage}</td>
				<td class="mono">{c.amount} {c.currency}</td>
				<td class="mono">{c.commission} {c.currency}</td>
				<td>
					<a href={resolve(`/payments/${c.payment_id}`)}>open</a>
					<div class="muted mono">{c.provider_payment_id}</div>
				</td>
				<td>
					<form class="inline" method="POST" action="?/setStatus">
						<input type="hidden" name="id" value={c.id} />
						<select name="status">
							{#each statuses as s (s)}
								<option value={s} selected={c.status === s}>{s}</option>
							{/each}
						</select>
						<button class="btn" type="submit">Update</button>
					</form>
				</td>
			</tr>
		{:else}
			<tr><td colspan="9" class="muted">No commissions</td></tr>
		{/each}
	</tbody>
</table>
