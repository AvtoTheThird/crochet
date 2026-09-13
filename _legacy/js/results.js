import { state } from './state.js';
import { getColorLabel } from './utils.js';

export function renderResults() {
  if (!state.countResults.length) return;
  const list = document.getElementById('result-list');
  list.innerHTML = '';

  let totalSegs = 0;
  let csvLines = ['Row,Direction,Color,Name,Count'];
  let rows = 0;
  let cols = 0;

  for (const r of state.countResults) {
    rows = Math.max(rows, r.logRow + 1);
    cols = r.cols;
    totalSegs += r.segments.length;

    const div = document.createElement('div');
    div.className = 'result-row';
    const segsHtml = r.segments.map(s => {
      const label = getColorLabel(s.color);
      return `<span class="seg-chip" title="${s.color.hex}"><span class="swatch" style="background:${s.color.hex}"></span>${label}×${s.count}</span>`;
    }).join('');

    div.innerHTML = `
      <span class="line-num">${r.logRow + 1}</span>
      <span class="dir">${r.dir}</span>
      <span class="segs">${segsHtml}</span>
    `;
    list.appendChild(div);

    for (const s of r.segments) {
      const name = getColorLabel(s.color);
      csvLines.push(`${r.logRow + 1},${r.dir},${s.color.hex},${name},${s.count}`);
    }
  }

  document.getElementById('res-cols').textContent = cols;
  document.getElementById('res-rows').textContent = rows;
  document.getElementById('res-segs').textContent = totalSegs;
  document.getElementById('export-csv').value = csvLines.join('\n');
}

export function copyCSV() {
  const ta = document.getElementById('export-csv');
  ta.select();
  document.execCommand('copy');
  const btn = event.target;
  btn.textContent = '✓ Copied!';
  setTimeout(() => { btn.textContent = '📋 Copy CSV'; }, 1500);
}
