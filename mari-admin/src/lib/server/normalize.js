/**
 * Supabase embed relations may be typed/returned as object or array.
 * @template T
 * @param {T | T[] | null | undefined} value
 * @returns {T | null}
 */
export function one(value) {
	if (value == null) return null;
	if (Array.isArray(value)) return value[0] ?? null;
	return value;
}

/**
 * @param {Record<string, unknown>} row
 * @param {string[]} keys
 */
export function normalizeEmbeds(row, keys) {
	const out = { ...row };
	for (const key of keys) {
		out[key] = one(/** @type {any} */ (row[key]));
	}
	return out;
}
