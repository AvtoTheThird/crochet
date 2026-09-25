<script>
	import { resolve } from '$app/paths';

	let { data } = $props();
	const p = $derived(data.payment);
</script>

<p><a href={resolve('/payments')}>← Payments</a></p>
<h2 class="page-title">Payment detail</h2>

{#if data.error}
	<p class="error">{data.error}</p>
{/if}

<div class="card">
	<table class="data" style="border:none">
		<tbody>
			<tr><th>ID</th><td class="mono">{p.id}</td></tr>
			<tr><th>User</th><td class="mono">{p.user_id}</td></tr>
			<tr><th>Provider</th><td>{p.provider}</td></tr>
			<tr><th>Provider payment ID</th><td class="mono">{p.provider_payment_id}</td></tr>
			<tr><th>Provider order ID</th><td class="mono">{p.provider_order_id ?? '—'}</td></tr>
			<tr><th>Subscription ID</th><td class="mono">{p.subscription_id ?? '—'}</td></tr>
			<tr><th>Status</th><td><span class="badge">{p.status}</span></td></tr>
			<tr><th>Product tier</th><td>{p.product_tier ?? '—'}</td></tr>
			<tr><th>Amount</th><td class="mono">{p.amount} {p.currency}</td></tr>
			<tr><th>Eligible amount</th><td class="mono">{p.eligible_amount ?? '—'}</td></tr>
			<tr><th>Paid at</th><td class="mono">{p.paid_at ?? '—'}</td></tr>
			<tr><th>Processed at</th><td class="mono">{p.processed_at ?? '—'}</td></tr>
			<tr><th>Created</th><td class="mono">{p.created_at}</td></tr>
		</tbody>
	</table>
</div>

<h3>User</h3>
<div class="card">
	{#if data.user}
		<p>
			<span class="mono">{data.user.email ?? data.user.username ?? data.user.id}</span>
			· tier <span class="badge">{data.user.subscription_tier}</span>
		</p>
	{:else}
		<p class="muted">User row not found</p>
	{/if}
</div>

<h3>Referral attribution</h3>
<div class="card">
	{#if data.referral}
		<p>
			{data.referral.creator_name ?? '—'}
			· code <span class="mono">{data.referral.code ?? '—'}</span>
			· <span class="badge">{data.referral.source}</span>
			· {data.referral.locked_at ? 'locked' : 'open'}
		</p>
	{:else}
		<p class="muted">No referral attribution</p>
	{/if}
</div>

<h3>Commissions for this payment</h3>
<table class="data">
	<thead>
		<tr>
			<th>Kind</th>
			<th>Status</th>
			<th>%</th>
			<th>Amount</th>
			<th>Commission</th>
			<th>Created</th>
		</tr>
	</thead>
	<tbody>
		{#each data.commissions as c (c.id)}
			<tr>
				<td>{c.entry_kind}</td>
				<td><span class="badge">{c.status}</span></td>
				<td class="mono">{c.commission_percentage}</td>
				<td class="mono">{c.amount} {c.currency}</td>
				<td class="mono">{c.commission} {c.currency}</td>
				<td class="mono">{c.created_at}</td>
			</tr>
		{:else}
			<tr><td colspan="6" class="muted">None</td></tr>
		{/each}
	</tbody>
</table>

<details class="card">
	<summary>Raw metadata</summary>
	<pre class="mono" style="white-space:pre-wrap;margin:8px 0 0">{JSON.stringify(p.metadata ?? {}, null, 2)}</pre>
</details>
