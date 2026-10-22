<script>
	import ModalDialog from './ModalDialog.svelte';
	import { dialogs, settleDialog, dismissToast } from './dialogs.svelte.js';

	const current = $derived(dialogs.queue[0]);
</script>

{#if current}
	{#key current.id}
		<ModalDialog request={current} onsettle={settleDialog} />
	{/key}
{/if}

<div class="toasts" role="status" aria-live="polite">
	{#each dialogs.toasts as toast (toast.id)}
		<div class={['toast', `tone-${toast.tone}`]}>
			<span class="dot" aria-hidden="true"></span>
			<span class="msg">{toast.message}</span>
			<button type="button" aria-label="Dismiss" onclick={() => dismissToast(toast.id)}>×</button>
		</div>
	{/each}
</div>

<style>
	.toasts {
		position: fixed;
		left: 50%;
		bottom: max(24px, env(safe-area-inset-bottom, 0px));
		transform: translateX(-50%);
		z-index: 10001;
		display: flex;
		flex-direction: column-reverse;
		align-items: center;
		gap: 8px;
		width: max-content;
		max-width: calc(100vw - 32px);
		pointer-events: none;
	}

	.toast {
		--t-tone: #55784a;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 10px 10px 16px;
		border-radius: 999px;
		background: #3e2f2a;
		color: #fbf6ef;
		font-family: 'Nunito', system-ui, sans-serif;
		font-size: 0.95rem;
		font-weight: 700;
		box-shadow: 0 12px 32px rgba(62, 47, 42, 0.28);
		pointer-events: auto;
		animation: toast-in 0.25s cubic-bezier(0.2, 0.9, 0.3, 1.2);
	}
	.tone-info {
		--t-tone: #e2a93f;
	}
	.tone-warning {
		--t-tone: #e2a93f;
	}
	.tone-danger {
		--t-tone: #e5776b;
	}

	.dot {
		width: 10px;
		height: 10px;
		flex-shrink: 0;
		border-radius: 50%;
		background: var(--t-tone);
		box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.12);
	}
	.tone-success .dot {
		background: #9cc08b;
	}

	.toast button {
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		padding: 0;
		border: none;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.1);
		color: inherit;
		font-size: 1.1rem;
		line-height: 1;
		cursor: pointer;
	}
	.toast button:hover {
		background: rgba(255, 255, 255, 0.22);
	}

	@keyframes toast-in {
		from {
			opacity: 0;
			transform: translateY(10px) scale(0.96);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.toast {
			animation: none;
		}
	}
</style>
