/**
 * Promise-based replacements for alert / confirm / prompt, plus toasts.
 * Rendered by `DialogHost.svelte`, which is mounted once in the root layout.
 */
import { goto } from '$app/navigation';

/** @typedef {'info' | 'success' | 'warning' | 'danger'} Tone */

/**
 * @typedef {object} DialogOptions
 * @property {string} title
 * @property {string} [message]
 * @property {Tone} [tone]
 * @property {string} [confirmLabel]
 * @property {string} [cancelLabel]
 */

/**
 * @typedef {object} PromptField
 * @property {string} key
 * @property {string} [label]
 * @property {string} [defaultValue]
 * @property {string} [placeholder]
 * @property {boolean} [multiline]
 * @property {number} [maxLength]
 * @property {boolean} [required]
 */

/**
 * @typedef {DialogOptions & {
 *   label?: string,
 *   defaultValue?: string,
 *   placeholder?: string,
 *   multiline?: boolean,
 *   maxLength?: number,
 *   required?: boolean,
 *   fields?: PromptField[]
 * }} PromptOptions
 */

/**
 * @typedef {PromptOptions & {
 *   id: number,
 *   kind: 'alert' | 'confirm' | 'prompt',
 *   resolve: (value: any) => void
 * }} DialogRequest
 */

/** @typedef {{ id: number, message: string, tone: Tone }} Toast */

let nextId = 1;

export const dialogs = $state({
	/** @type {DialogRequest[]} */
	queue: [],
	/** @type {Toast[]} */
	toasts: []
});

/**
 * @param {DialogRequest['kind']} kind
 * @param {PromptOptions} options
 */
function open(kind, options) {
	return new Promise((resolve) => {
		dialogs.queue.push({ ...options, id: nextId++, kind, resolve });
	});
}

/**
 * Resolve the dialog currently on screen and show the next queued one.
 * @param {unknown} value
 */
export function settleDialog(value) {
	const current = dialogs.queue.shift();
	current?.resolve(value);
}

/**
 * @param {DialogOptions | string} options
 * @returns {Promise<void>}
 */
export function showAlert(options) {
	const opts = typeof options === 'string' ? { title: options } : options;
	return open('alert', { confirmLabel: 'Got it', ...opts });
}

/**
 * @param {DialogOptions} options
 * @returns {Promise<boolean>}
 */
export function showConfirm(options) {
	return open('confirm', { confirmLabel: 'OK', cancelLabel: 'Cancel', ...options });
}

/**
 * Without `fields`, resolves to the entered text. With a non-empty
 * `fields` array, resolves to an object mapping each field key to its
 * trimmed value. Resolves to null when cancelled.
 * @param {PromptOptions} options
 * @returns {Promise<string | Record<string, string> | null>}
 */
export function showPrompt(options) {
	return open('prompt', { confirmLabel: 'Save', cancelLabel: 'Cancel', ...options });
}

/**
 * Explain why the user should go elsewhere, and only navigate if they agree.
 * @param {DialogOptions} options
 * @param {string} href
 */
export async function offerNavigation(options, href) {
	if (await showConfirm(options)) await goto(href);
}

/**
 * Show a short, non-blocking message.
 * @param {string} message
 * @param {{ tone?: Tone, duration?: number }} [options]
 */
export function notify(message, { tone = 'success', duration = 3200 } = {}) {
	const id = nextId++;
	dialogs.toasts.push({ id, message, tone });
	setTimeout(() => dismissToast(id), duration);
}

/** @param {number} id */
export function dismissToast(id) {
	const i = dialogs.toasts.findIndex((t) => t.id === id);
	if (i !== -1) dialogs.toasts.splice(i, 1);
}

/** @param {unknown} e */
export function errorMessage(e) {
	if (e instanceof Error) return e.message;
	if (e && typeof e === 'object' && 'message' in e) return String(e.message);
	return String(e);
}
