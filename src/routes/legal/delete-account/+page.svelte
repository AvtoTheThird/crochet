<script>
	import { resolve } from '$app/paths';
	import LegalPage from '$lib/components/site/LegalPage.svelte';
	import { company } from '$lib/site/company.js';
</script>

<svelte:head>
	<title>Delete your account &amp; data — {company.name}</title>
	<meta
		name="description"
		content="How to delete your {company.name} account and personal data."
	/>
</svelte:head>

<LegalPage title="Delete your account & data" updated={company.lastUpdated}>
	<p>
		This page explains how to permanently delete your {company.name} account and the personal
		data we hold about you. Deletion is irreversible.
	</p>

	<h2>1. Delete from your profile (fastest)</h2>
	<ol>
		<li>
			Sign in at
			<a href={resolve('/login')}>{company.website.replace(/^https?:\/\//, '')}/login</a>
			(or open the app and go to your profile).
		</li>
		<li>Open <a href={resolve('/profile')}>Profile</a>.</li>
		<li>Scroll to <strong>Delete account</strong>.</li>
		<li>
			Read the warnings, then confirm by typing <strong>delete me</strong> exactly in the dialog
			and submitting.
		</li>
	</ol>
	<p>
		If you are not signed in, use the email option below — we will verify you own the account
		before deleting anything.
	</p>

	<h2>2. Request deletion by email</h2>
	<p>
		Email
		<a href="mailto:{company.supportEmail}?subject=Account%20deletion%20request"
			>{company.supportEmail}</a
		>
		from the address on your account with the subject “Account deletion request”. Include your
		username (if any) so we can find the right account. We aim to complete verified requests
		within <strong>30 days</strong>.
	</p>

	<h2>3. What gets deleted</h2>
	<ul>
		<li>Your login (email/password or Google / Facebook link) and profile details</li>
		<li>Projects, uploaded images, gallery publications, likes, and avatar</li>
		<li>Session and in-app preference data we store for your account</li>
	</ul>

	<h2>4. Paid plans, subscriptions, and lifetime access</h2>
	<ul>
		<li>
			<strong>Maker (recurring) subscription:</strong> deleting your account cancels billing
			immediately. You lose access to paid features as soon as the account is removed — there is
			no remaining “paid until end of period” after deletion.
		</li>
		<li>
			<strong>Lifetime purchase:</strong> deleting your account ends that access. Lifetime access
			is tied to the account; it cannot be transferred after deletion.
		</li>
		<li>
			If you only want to stop monthly/annual billing but keep using the product until the period
			ends, cancel from Profile → Subscription instead of deleting your account. See also our
			<a href={resolve('/legal/refunds')}>Refund &amp; Cancellation Policy</a>.
		</li>
	</ul>

	<h2>5. What we may retain</h2>
	<p>
		We may keep anonymized or limited records where the law requires it (for example transaction
		identifiers and amounts for tax, accounting, fraud prevention, or dispute handling via
		Paddle). Those records are not used to identify you in the product after deletion.
	</p>

	<h2>6. Third parties</h2>
	<ul>
		<li>
			<strong>Paddle</strong> is our Merchant of Record and may retain payment records under its
			own policies.
		</li>
		<li>
			<strong>Google / Facebook</strong> — if you signed in with them, revoke {company.name}’s
			access in that provider’s account security settings if you wish.
		</li>
	</ul>

	<h2>7. Contact</h2>
	<p>
		Questions about deletion?
		<a href="mailto:{company.supportEmail}">{company.supportEmail}</a>.
	</p>
</LegalPage>
