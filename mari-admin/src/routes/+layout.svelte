<script>
	import { page } from '$app/state';
	import '$lib/styles/admin.css';

	let { children, data } = $props();

	const links = [
		{ href: '/', label: 'Overview' },
		{ href: '/creators', label: 'Creators' },
		{ href: '/codes', label: 'Referral codes' },
		{ href: '/referrals', label: 'Attributions' },
		{ href: '/payments', label: 'Payments' },
		{ href: '/subscriptions', label: 'Subscriptions' },
		{ href: '/commissions', label: 'Commissions' }
	];
</script>

{#if data.showNav}
	<div class="shell">
		<nav class="side" aria-label="Admin">
			<h1>Mari Admin</h1>
			<ul>
				{#each links as link (link.href)}
					<li>
						<a href={link.href} class:active={page.url.pathname === link.href}>
							{link.label}
						</a>
					</li>
				{/each}
			</ul>
			<form class="logout" method="POST" action="/logout">
				<button class="btn" type="submit">Log out</button>
			</form>
		</nav>
		<main class="content">
			{@render children()}
		</main>
	</div>
{:else}
	{@render children()}
{/if}
