<script>
	import LegalPage from '$lib/components/site/LegalPage.svelte';
	import { company } from '$lib/site/company.js';
</script>

<svelte:head>
	<title>Privacy Policy — {company.name}</title>
	<meta name="description" content="Privacy Policy for {company.name}." />
</svelte:head>

<LegalPage title="Privacy Policy" updated={company.lastUpdated}>
	<p>
		This Privacy Policy explains how {company.legalName} ("we") collects, uses, and shares
		information when you use {company.name} (the "Service").
	</p>

	<h2>1. Information we collect</h2>
	<ul>
		<li><strong>Account information</strong> — your name, username, and email address when you sign up (including via Google sign-in if you choose it).</li>
		<li><strong>Content</strong> — images you upload and the patterns, palettes, and project data you create.</li>
		<li><strong>Usage data</strong> — basic technical data such as approximate country (from your IP, to localize prices) and standard log data.</li>
		<li><strong>Payment data</strong> — handled by our payments provider Paddle. We do not store your full card details.</li>
	</ul>

	<h2>2. How we use information</h2>
	<ul>
		<li>To provide and operate the Service (accounts, projects, gallery, exports).</li>
		<li>To process purchases and manage subscriptions and entitlements.</li>
		<li>To secure the Service and prevent abuse.</li>
		<li>To respond to support requests.</li>
	</ul>

	<h2>3. Service providers we share with</h2>
	<ul>
		<li><strong>Supabase</strong> — authentication, database, and storage hosting for your account, projects, and images.</li>
		<li><strong>Paddle</strong> — payment processing and Merchant of Record for purchases; Paddle processes your payment and billing information under its own privacy policy.</li>
		<li><strong>Google</strong> — only if you choose Google sign-in, for authentication.</li>
		<li><strong>Cloudflare</strong> — hosting and delivery of the web application.</li>
	</ul>
	<p>We do not sell your personal information.</p>

	<h2>4. Cookies and local storage</h2>
	<p>
		We use cookies/local storage for essential functions such as keeping you signed in and, where
		applicable, remembering referral attribution. Payment and checkout may set cookies via Paddle.
	</p>

	<h2>5. Data retention</h2>
	<p>
		We keep your account and content while your account is active. You can delete your projects at
		any time. If you close your account, we delete or anonymize your personal data except where we
		must retain records (for example, transaction records required for tax or accounting).
	</p>

	<h2>6. Your rights</h2>
	<p>
		Depending on your location, you may have rights to access, correct, export, or delete your
		personal data. To exercise these, contact us at
		<a href="mailto:{company.supportEmail}">{company.supportEmail}</a>. For payment-related data,
		you may also contact Paddle as the Merchant of Record.
	</p>

	<h2>7. Changes</h2>
	<p>We may update this policy; the "Last updated" date above reflects the latest version.</p>

	<h2>8. Contact</h2>
	<p>
		Privacy questions? Email <a href="mailto:{company.supportEmail}">{company.supportEmail}</a>.
	</p>
</LegalPage>
