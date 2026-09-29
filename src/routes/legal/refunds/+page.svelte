<script>
	import LegalPage from '$lib/components/site/LegalPage.svelte';
	import { company } from '$lib/site/company.js';
</script>

<svelte:head>
	<title>Refund &amp; Cancellation Policy — {company.name}</title>
	<meta name="description" content="Refund and cancellation policy for {company.name}." />
</svelte:head>

<LegalPage title="Refund & Cancellation Policy" updated={company.lastUpdated}>
	<p>
		This policy explains how cancellations and refunds work for {company.name}. Purchases are
		processed by <strong>Paddle</strong>, our payments provider and Merchant of Record, and are
		also subject to Paddle's buyer terms shown at checkout.
	</p>

	<h2>Cancelling a subscription</h2>
	<p>
		You can cancel the Maker subscription at any time from your
		<a href="/profile">profile page</a>. Cancellation takes effect at the end of your current
		billing period — you keep full access until then, and you won't be charged again.
	</p>

	<h2>Refunds</h2>
	<ul>
		<li>
			<strong>Monthly/annual subscriptions:</strong> if you're not satisfied, contact us within
			14 days of a charge and we'll review your request for a refund of the most recent payment.
		</li>
		<li>
			<strong>Lifetime (one-time) purchase:</strong> eligible for a refund within 14 days of
			purchase if you're not satisfied.
		</li>
		<li>
			Refunds are issued to your original payment method via Paddle. Once access has been
			extensively used, or outside the windows above, refunds are at our discretion.
		</li>
	</ul>

	<h2>How to request a refund</h2>
	<p>
		Email <a href="mailto:{company.supportEmail}">{company.supportEmail}</a> from your account
		email with your Paddle receipt or order ID (included in your purchase confirmation email). You
		can also request help through the link in any Paddle receipt. We aim to respond within a few
		business days.
	</p>

	<h2>Billing questions and chargebacks</h2>
	<p>
		For billing questions, please contact us first — we can usually resolve issues faster than a
		bank dispute. Paddle, as Merchant of Record, appears on your statement and handles payment
		disputes.
	</p>

	<h2>Contact</h2>
	<p>
		Questions about this policy? Email
		<a href="mailto:{company.supportEmail}">{company.supportEmail}</a>.
	</p>
</LegalPage>
