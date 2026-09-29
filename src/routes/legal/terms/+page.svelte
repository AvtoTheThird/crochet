<script>
	import LegalPage from '$lib/components/site/LegalPage.svelte';
	import { company } from '$lib/site/company.js';
</script>

<svelte:head>
	<title>Terms of Service — {company.name}</title>
	<meta name="description" content="Terms of Service for {company.name}." />
</svelte:head>

<LegalPage title="Terms of Service" updated={company.lastUpdated}>
	<p>
		These Terms of Service ("Terms") govern your access to and use of {company.name}
		(the "Service"), operated by {company.legalName}. By creating an account or using the
		Service, you agree to these Terms. If you do not agree, do not use the Service.
	</p>

	<h2>1. The Service</h2>
	<p>
		{company.name} is a web application that turns pixelated images into stitch-by-stitch
		patterns for cross-stitch and similar crafts: you load and crop an image, set the grid,
		correct colors into a yarn-ready palette, and walk the pattern row by row, exporting it as
		CSV or PNG. Free accounts include one project; paid plans increase the number of concurrent
		projects and unlock full gallery pattern data.
	</p>

	<h2>2. Accounts</h2>
	<p>
		You must provide accurate information and keep your credentials secure. You are responsible
		for all activity under your account. You must be old enough to form a binding contract in
		your jurisdiction to use the Service.
	</p>

	<h2>3. Acceptable use</h2>
	<ul>
		<li>Do not upload content you do not have the rights to use.</li>
		<li>Do not misuse, disrupt, reverse engineer, or attempt to gain unauthorized access to the Service.</li>
		<li>Do not use the Service for unlawful, infringing, or abusive purposes.</li>
	</ul>

	<h2>4. Your content</h2>
	<p>
		You retain ownership of images and patterns you create. You grant us the limited rights
		needed to host, process, and display your content to operate the Service (for example,
		storing your images and, where you choose to publish, showing them in the public gallery).
	</p>

	<h2>5. Plans, billing, and payments</h2>
	<p>
		Paid plans are sold and billed through our payments provider, <strong>Paddle</strong>, which
		acts as the Merchant of Record for purchases. Your purchase is also subject to Paddle's buyer
		terms shown at checkout. Subscriptions renew automatically until cancelled. Prices are shown
		at checkout in your local currency where available. See our
		<a href="/legal/refunds">Refund &amp; Cancellation Policy</a> for cancellations and refunds.
	</p>

	<h2>6. Cancellation and termination</h2>
	<p>
		You may cancel a subscription at any time from your profile; access continues until the end
		of the current billing period. We may suspend or terminate accounts that violate these Terms.
	</p>

	<h2>7. Disclaimers</h2>
	<p>
		The Service is provided "as is" without warranties of any kind. We do not guarantee that the
		Service will be uninterrupted, error-free, or that patterns will meet your expectations.
	</p>

	<h2>8. Limitation of liability</h2>
	<p>
		To the maximum extent permitted by law, {company.legalName} will not be liable for any
		indirect, incidental, or consequential damages, or for any loss of data or profits arising
		from your use of the Service.
	</p>

	<h2>9. Changes to these Terms</h2>
	<p>
		We may update these Terms from time to time. Material changes will be reflected by updating
		the "Last updated" date above. Continued use after changes means you accept the revised Terms.
	</p>

	<h2>10. Governing law</h2>
	<p>These Terms are governed by the laws of {company.jurisdiction}, without regard to conflict-of-law rules.</p>

	<h2>11. Contact</h2>
	<p>
		Questions about these Terms? Email us at
		<a href="mailto:{company.supportEmail}">{company.supportEmail}</a>.
	</p>
</LegalPage>
