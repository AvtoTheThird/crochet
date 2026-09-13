import { state } from './state.js';
import { getColorLabel } from './utils.js';

export function buildCsvText() {
	const csvLines = ['Row,Direction,Color,Name,Count'];
	for (const r of state.countResults) {
		for (const s of r.segments) {
			const name = getColorLabel(s.color);
			csvLines.push(`${r.logRow + 1},${r.dir},${s.color.hex},${name},${s.count}`);
		}
	}
	return csvLines.join('\n');
}

export function renderResults() {
	if (!state.countResults.length) return;
	const list = document.getElementById('result-list');
	if (!list) return;
	list.innerHTML = '';

	let totalSegs = 0;
	let rows = 0;
	let cols = 0;

	for (const r of state.countResults) {
		rows = Math.max(rows, r.logRow + 1);
		cols = r.cols;
		totalSegs += r.segments.length;

		const div = document.createElement('div');
		div.className = 'result-row';
		const segsHtml = r.segments
			.map((s) => {
				const label = getColorLabel(s.color);
				return `<span class="seg-chip" title="${s.color.hex}"><span class="swatch" style="background:${s.color.hex}"></span>${label}×${s.count}</span>`;
			})
			.join('');

		div.innerHTML = `
      <span class="line-num">${r.logRow + 1}</span>
      <span class="dir">${r.dir}</span>
      <span class="segs">${segsHtml}</span>
    `;
		list.appendChild(div);
	}

	const colsEl = document.getElementById('res-cols');
	const rowsEl = document.getElementById('res-rows');
	const segsEl = document.getElementById('res-segs');
	if (colsEl) colsEl.textContent = String(cols);
	if (rowsEl) rowsEl.textContent = String(rows);
	if (segsEl) segsEl.textContent = String(totalSegs);
}

/** @param {Event} [e] */
export async function copyCSV(e) {
	const text = buildCsvText();
	try {
		await navigator.clipboard.writeText(text);
	} catch {
		const ta = document.createElement('textarea');
		ta.value = text;
		ta.style.position = 'fixed';
		ta.style.left = '-9999px';
		document.body.appendChild(ta);
		ta.select();
		document.execCommand('copy');
		ta.remove();
	}
	const btn = e?.currentTarget instanceof HTMLElement ? e.currentTarget : null;
	if (!btn) return;
	const prev = btn.textContent;
	btn.textContent = '✓ Copied!';
	setTimeout(() => {
		btn.textContent = prev || '📋 Copy CSV';
	}, 1500);
}
