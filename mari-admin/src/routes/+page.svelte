<script>
	import { resolve } from '$app/paths';

	let { data } = $props();
</script>

<h2 class="page-title">Overview</h2>

{#if data.errors?.length}
	<div class="card error">
		{#each data.errors as err, i (i)}
			<p>{err}</p>
		{/each}
	</div>
{/if}

<div class="stats">
	<div class="stat">
		<div class="label">Creators</div>
		<div class="value">{data.counts.creators}</div>
	</div>
	<div class="stat">
		<div class="label">Referral codes</div>
		<div class="value">{data.counts.codes}</div>
	</div>
	<div class="stat">
		<div class="label">Attributions</div>
		<div class="value">{data.counts.referrals}</div>
	</div>
	<div class="stat">
		<div class="label">Payments (loaded)</div>
		<div class="value">{data.counts.payments}</div>
	</div>
	<div class="stat">
		<div class="label">Commissions (loaded)</div>
		<div class="value">{data.counts.commissions}</div>
	</div>
	<div class="stat">
		<div class="label">Commission total (approx)</div>
		<div class="value">{data.commissionSum.toFixed(2)}</div>
	</div>
</div>

<div class="card">
	<strong>Payments by status</strong>
	<p class="muted">
		{#each Object.entries(data.paymentByStatus) as [status, n] (status)}
			<span class="badge">{status}: {n}</span>&nbsp;
		{:else}
			None yet
		{/each}
	</p>
	<strong>Commissions by status</strong>
	<p class="muted">
		{#each Object.entries(data.commissionByStatus) as [status, n] (status)}
			<span class="badge">{status}: {n}</span>&nbsp;
		{:else}
			None yet
		{/each}
	</p>
</div>

<h3>Recent payments</h3>
<table class="data">
	<thead>
		<tr>
			<th>Created</th>
			<th>Status</th>
			<th>Tier</th>
			<th>Amount</th>
			<th>Provider</th>
			<th>Payment ID</th>
			<th></th>
		</tr>
	</thead>
	<tbody>
		{#each data.recentPayments as p (p.id)}
			<tr>
				<td class="mono">{p.created_at}</td>
				<td><span class="badge">{p.status}</span></td>
				<td>{p.product_tier ?? '—'}</td>
				<td class="mono">{p.amount} {p.currency}</td>
				<td>{p.provider}</td>
				<td class="mono">{p.provider_payment_id}</td>
				<td><a href={resolve(`/payments/${p.id}`)}>Open</a></td>
			</tr>
		{:else}
			<tr><td colspan="7" class="muted">No payments yet</td></tr>
		{/each}
	</tbody>
</table>

<h3>Recent commissions</h3>
<table class="data">
	<thead>
		<tr>
			<th>Created</th>
			<th>Kind</th>
			<th>Status</th>
			<th>%</th>
			<th>Commission</th>
			<th>Creator</th>
			<th>User</th>
		</tr>
	</thead>
	<tbody>
		{#each data.recentCommissions as c (c.id)}
			<tr>
				<td class="mono">{c.created_at}</td>
				<td>{c.entry_kind}</td>
				<td><span class="badge">{c.status}</span></td>
				<td class="mono">{c.commission_percentage}</td>
				<td class="mono">{c.commission} {c.currency}</td>
				<td class="mono">{c.creator_id.slice(0, 8)}…</td>
				<td class="mono">{c.user_id.slice(0, 8)}…</td>
			</tr>
		{:else}
			<tr><td colspan="7" class="muted">No commissions yet</td></tr>
		{/each}
	</tbody>
</table>
