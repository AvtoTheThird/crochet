<script>
	import { resolve } from '$app/paths';

	let { data } = $props();

	const statuses = [
		'created',
		'pending',
		'succeeded',
		'failed',
		'refunded',
		'partially_refunded',
		'chargeback',
		'cancelled'
	];
</script>

<h2 class="page-title">Payments</h2>

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
	<label>
		Search (payment id / order / user uuid)
		<input name="q" value={data.filters.q} />
	</label>
	<button class="btn" type="submit">Filter</button>
</form>

{#if data.error}
	<p class="error">{data.error}</p>
{/if}

<table class="data">
	<thead>
		<tr>
			<th>Created</th>
			<th>Status</th>
			<th>Tier</th>
			<th>Amount</th>
			<th>Eligible</th>
			<th>Provider</th>
			<th>Provider payment</th>
			<th>Processed</th>
			<th></th>
		</tr>
	</thead>
	<tbody>
		{#each data.payments as p (p.id)}
			<tr>
				<td class="mono">{p.created_at}</td>
				<td><span class="badge">{p.status}</span></td>
				<td>{p.product_tier ?? '—'}</td>
				<td class="mono">{p.amount} {p.currency}</td>
				<td class="mono">{p.eligible_amount ?? '—'}</td>
				<td>{p.provider}</td>
				<td class="mono">{p.provider_payment_id}</td>
				<td class="mono">{p.processed_at ? 'yes' : 'no'}</td>
				<td><a href={resolve(`/payments/${p.id}`)}>Detail</a></td>
			</tr>
		{:else}
			<tr><td colspan="9" class="muted">No payments</td></tr>
		{/each}
	</tbody>
</table>
