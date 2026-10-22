<script>
	import { untrack } from 'svelte';

	/**
	 * @type {{
	 *   request: import('./dialogs.svelte.js').DialogRequest,
	 *   onsettle: (value: unknown) => void
	 * }}
	 */
	let { request, onsettle } = $props();

	let value = $state(untrack(() => request.defaultValue ?? ''));
	let values = $state(
		untrack(() =>
			Object.fromEntries(
				(request.fields ?? []).map((field) => [field.key, field.defaultValue ?? ''])
			)
		)
	);
	let settled = false;

	const tone = $derived(request.tone ?? 'info');
	const isPrompt = $derived(request.kind === 'prompt');
	const fieldsMode = $derived(
		isPrompt && Array.isArray(request.fields) && request.fields.length > 0
	);
	const canSubmit = $derived(
		!isPrompt
			? true
			: fieldsMode
				? !(request.fields ?? []).some(
						(field) => field.required && (values[field.key] ?? '').trim() === ''
					)
				: !request.required || value.trim() !== ''
	);
	const cancelValue = $derived(
		request.kind === 'confirm' ? false : request.kind === 'prompt' ? null : undefined
	);
	const titleId = $derived(`modal-title-${request.id}`);
	const messageId = $derived(`modal-message-${request.id}`);

	/** @param {unknown} result */
	function settle(result) {
		if (settled) return;
		settled = true;
		onsettle(result);
	}

	function submit() {
		if (!canSubmit) return;
		if (request.kind === 'prompt') {
			if (fieldsMode) {
				settle(
					Object.fromEntries(
						(request.fields ?? []).map((field) => [
							field.key,
							(values[field.key] ?? '').trim()
						])
					)
				);
			} else {
				settle(value.trim());
			}
		} else if (request.kind === 'confirm') settle(true);
		else settle(undefined);
	}

	/** @param {HTMLDialogElement} node */
	function openModal(node) {
		node.showModal();
		return () => {
			if (node.open) node.close();
		};
	}

	/** Focus the safest default: the field, or Cancel for destructive actions. */
	function focusOnOpen(/** @type {HTMLElement} */ node) {
		queueMicrotask(() => {
			node.focus();
			if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) node.select();
		});
	}

	/** @param {KeyboardEvent} e */
	function onTextareaKey(e) {
		if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			submit();
		}
	}
</script>

<dialog
	class={['modal', `tone-${tone}`]}
	aria-labelledby={titleId}
	aria-describedby={request.message ? messageId : undefined}
	{@attach openModal}
	oncancel={(e) => {
		e.preventDefault();
		settle(cancelValue);
	}}
	onclick={(e) => {
		if (e.target === e.currentTarget) settle(cancelValue);
	}}
>
	<form
		class="modal-body"
		onsubmit={(e) => {
			e.preventDefault();
			submit();
		}}
	>
		<span class="modal-icon" aria-hidden="true">
			{#if tone === 'success'}
				<svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9" /></svg>
			{:else if tone === 'danger'}
				<svg viewBox="0 0 24 24"
					><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10.5 10.5v5M13.5 10.5v5" /></svg
				>
			{:else if tone === 'warning'}
				<svg viewBox="0 0 24 24"><path d="M12 7v6M12 16.5v.5" /></svg>
			{:else}
				<svg viewBox="0 0 24 24"
					><circle cx="12" cy="12" r="6.5" /><path
						d="M7 10c3 0 6 2 8 7M8.5 15.5c2-1 5-.5 7 1.5M11 5.8c1.5 2 2.5 5 2.5 11.7"
					/></svg
				>
			{/if}
		</span>

		<h2 id={titleId}>{request.title}</h2>
		{#if request.message}
			<p id={messageId}>{request.message}</p>
		{/if}

		{#if isPrompt}
			{#if fieldsMode}
				<div class="modal-fields">
					{#each request.fields ?? [] as field, i (field.key)}
						<label class="modal-field">
							{#if field.label}<span>{field.label}</span>{/if}
							{#if field.multiline}
								<textarea
									rows="4"
									bind:value={values[field.key]}
									placeholder={field.placeholder}
									maxlength={field.maxLength}
									onkeydown={onTextareaKey}
									{@attach i === 0 && focusOnOpen}
								></textarea>
							{:else}
								<input
									type="text"
									bind:value={values[field.key]}
									placeholder={field.placeholder}
									maxlength={field.maxLength}
									autocomplete="off"
									{@attach i === 0 && focusOnOpen}
								/>
							{/if}
							{#if field.maxLength}
								<small class="modal-count"
									>{(values[field.key] ?? '').length} / {field.maxLength}</small
								>
							{/if}
						</label>
					{/each}
				</div>
			{:else}
				<label class="modal-field">
					{#if request.label}<span>{request.label}</span>{/if}
					{#if request.multiline}
						<textarea
							rows="4"
							bind:value
							placeholder={request.placeholder}
							maxlength={request.maxLength}
							onkeydown={onTextareaKey}
							{@attach focusOnOpen}
						></textarea>
					{:else}
						<input
							type="text"
							bind:value
							placeholder={request.placeholder}
							maxlength={request.maxLength}
							autocomplete="off"
							{@attach focusOnOpen}
						/>
					{/if}
					{#if request.maxLength}
						<small class="modal-count">{value.length} / {request.maxLength}</small>
					{/if}
				</label>
			{/if}
		{/if}

		<div class="modal-actions">
			{#if request.kind !== 'alert'}
				{#if tone === 'danger'}
					<button
						type="button"
						class="modal-btn"
						onclick={() => settle(cancelValue)}
						{@attach focusOnOpen}>{request.cancelLabel}</button
					>
				{:else}
					<button type="button" class="modal-btn" onclick={() => settle(cancelValue)}
						>{request.cancelLabel}</button
					>
				{/if}
			{/if}
			{#if isPrompt || tone === 'danger'}
				<button type="submit" class="modal-btn modal-btn-primary" disabled={!canSubmit}
					>{request.confirmLabel}</button
				>
			{:else}
				<button
					type="submit"
					class="modal-btn modal-btn-primary"
					disabled={!canSubmit}
					{@attach focusOnOpen}>{request.confirmLabel}</button
				>
			{/if}
		</div>
	</form>
</dialog>

<style>
	.modal {
		--m-bg: #ffffff;
		--m-text: #3e2f2a;
		--m-muted: #7f6c62;
		--m-border: #eadfd1;
		--m-border-strong: #d9c8b4;
		--m-soft: #f5ede2;
		--m-accent: #c65d50;
		--m-accent-hover: #b14e42;
		--m-accent-soft: #f9e0d9;
		--m-tone: #c65d50;
		--m-tone-soft: #f9e0d9;

		width: min(440px, calc(100vw - 32px));
		max-height: calc(100dvh - 32px);
		margin: auto;
		padding: 0;
		border: none;
		border-radius: 24px;
		background: var(--m-bg);
		color: var(--m-text);
		font-family: 'Nunito', system-ui, sans-serif;
		box-shadow:
			0 2px 4px rgba(80, 50, 30, 0.06),
			0 24px 64px rgba(80, 50, 30, 0.22);
		overflow: visible;
		animation: modal-in 0.22s cubic-bezier(0.2, 0.9, 0.3, 1.2);
	}
	.modal::backdrop {
		background: rgba(62, 47, 42, 0.38);
		backdrop-filter: blur(3px);
		animation: backdrop-in 0.2s ease;
	}

	.tone-success {
		--m-tone: #55784a;
		--m-tone-soft: #e4ecdc;
	}
	.tone-warning {
		--m-tone: #b5801d;
		--m-tone-soft: #fbeccb;
	}
	.tone-danger {
		--m-tone: #b8433a;
		--m-tone-soft: #f9e0d9;
		--m-accent: #b8433a;
		--m-accent-hover: #9c372f;
	}

	.modal-body {
		position: relative;
		margin: 0;
		padding: 40px 28px 24px;
		text-align: center;
	}
	.modal-body::before {
		content: '';
		position: absolute;
		inset: 8px;
		border: 2px dashed var(--m-border);
		border-radius: 18px;
		pointer-events: none;
	}

	.modal-icon {
		position: absolute;
		top: -28px;
		left: 50%;
		transform: translateX(-50%) rotate(-6deg);
		display: grid;
		place-items: center;
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background: var(--m-tone-soft);
		border: 4px solid var(--m-bg);
		color: var(--m-tone);
	}
	.modal-icon svg {
		width: 28px;
		height: 28px;
		fill: none;
		stroke: currentColor;
		stroke-width: 2.2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	h2 {
		margin: 0 0 8px;
		font-family: 'Fraunces', Georgia, serif;
		font-weight: 600;
		font-size: 1.45rem;
		line-height: 1.2;
	}
	p {
		margin: 0 auto;
		max-width: 34ch;
		color: var(--m-muted);
		font-size: 1rem;
		line-height: 1.55;
		white-space: pre-line;
	}

	.modal-fields {
		display: flex;
		flex-direction: column;
		gap: 14px;
		margin-top: 20px;
	}
	.modal-fields .modal-field {
		margin-top: 0;
	}
	.modal-field {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-top: 20px;
		text-align: left;
		font-size: 0.9rem;
		font-weight: 700;
	}
	.modal-field input,
	.modal-field textarea {
		width: 100%;
		box-sizing: border-box;
		border: 2px solid var(--m-border);
		border-radius: 12px;
		background: #fffdf9;
		color: var(--m-text);
		padding: 11px 14px;
		font: inherit;
		font-weight: 600;
		font-size: 1rem;
		resize: vertical;
		transition:
			border-color 0.15s,
			box-shadow 0.15s;
	}
	.modal-field input:focus,
	.modal-field textarea:focus {
		outline: none;
		border-color: var(--m-accent);
		box-shadow: 0 0 0 4px var(--m-accent-soft);
	}
	.modal-count {
		align-self: flex-end;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--m-muted);
	}

	.modal-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 10px;
		margin-top: 24px;
	}

	.modal-btn {
		flex: 1 1 140px;
		max-width: 200px;
		padding: 11px 20px;
		border: 2px solid var(--m-border-strong);
		border-radius: 999px;
		background: var(--m-bg);
		color: var(--m-text);
		font: inherit;
		font-weight: 800;
		font-size: 0.98rem;
		cursor: pointer;
		transition:
			background 0.15s,
			border-color 0.15s,
			transform 0.15s;
	}
	.modal-btn:hover:not(:disabled) {
		border-color: var(--m-accent);
		background: var(--m-accent-soft);
	}
	.modal-btn:focus-visible {
		outline: 3px solid #e2a93f;
		outline-offset: 2px;
	}
	.modal-btn-primary {
		background: var(--m-accent);
		border-color: var(--m-accent);
		color: #fff;
		box-shadow: 0 4px 0 var(--m-accent-hover);
	}
	.modal-btn-primary:hover:not(:disabled) {
		background: var(--m-accent-hover);
		border-color: var(--m-accent-hover);
	}
	.modal-btn-primary:active:not(:disabled) {
		transform: translateY(2px);
		box-shadow: 0 2px 0 var(--m-accent-hover);
	}
	.modal-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	@keyframes modal-in {
		from {
			opacity: 0;
			transform: translateY(12px) scale(0.96);
		}
	}
	@keyframes backdrop-in {
		from {
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.modal,
		.modal::backdrop {
			animation: none;
		}
	}
</style>
