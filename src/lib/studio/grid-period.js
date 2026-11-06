/**
 * Detect a repeated pixel grid from an RGBA buffer.
 * JPEG noise is ignored by turning the picture into a black-and-white
 * border map (only strong brightness changes count). Period is the lag
 * those borders repeat at; a short search around that lag catches grids
 * that are not a whole number of screen pixels.
 */

const MIN_PERIOD = 2;
const MAX_PERIOD = 512;
const ANALYSIS_EDGE = 1200;

/**
 * @param {Uint8ClampedArray} data
 * @param {number} width
 * @param {number} height
 * @returns {{ pw: number, ph: number, ox: number, oy: number } | null}
 */
export function detectGridAlignment(data, width, height) {
	if (width < 8 || height < 8) return null;

	const x = analyzeAxis(data, width, height, 'x');
	const y = analyzeAxis(data, width, height, 'y');
	if (!x || !y) return null;

	return { pw: x.period, ph: y.period, ox: x.origin, oy: y.origin };
}

/**
 * @param {Uint8ClampedArray} data
 * @param {number} width
 * @param {number} height
 * @param {'x' | 'y'} axis
 */
function analyzeAxis(data, width, height, axis) {
	const horizontal = axis === 'x';
	const full = horizontal ? width : height;
	const cross = horizontal ? height : width;
	const span = Math.min(full, ANALYSIS_EDGE);
	const crossSpan = Math.min(cross, ANALYSIS_EDGE);
	const start = Math.floor((full - span) / 2);
	const crossStart = Math.floor((cross - crossSpan) / 2);
	const edge = borderProfile(
		data,
		width,
		height,
		horizontal ? start : crossStart,
		horizontal ? crossStart : start,
		horizontal ? span : crossSpan,
		horizontal ? crossSpan : span,
		axis
	);
	if (!edge) return null;

	const detected = detectPeriodFromEdges(edge);
	if (!detected) return null;

	const refined = refinePeriod(edge, detected.period);
	// 16 phase bins: a real border lands in one bin (score near 16).
	// Flat JPEG noise stays spread out and scores near 1–2.
	if (refined.concentration < 2.6) return null;

	const phase = edgePhase(edge, refined.period);
	const origin = wrap(start + phase + 1, refined.period);
	return { period: refined.period, origin };
}

/**
 * @param {Float64Array} edge
 * @returns {{ period: number, score: number } | null}
 */
export function detectPeriodFromEdges(edge) {
	if (edge.length < MIN_PERIOD * 3) return null;
	if (variance(edge) < 1e-4) return null;

	const minLag = MIN_PERIOD;
	const maxLag = Math.min(MAX_PERIOD, Math.floor(edge.length / 3));
	if (maxLag <= minLag) return null;

	const z = zeroMean(edge);
	const { scores, maxScore } = autocorrelation(z, minLag, maxLag);
	// Coefficient is ~1 on a real grid and stays small on unstructured noise.
	if (!(maxScore >= 0.3)) return null;

	/** @type {number[]} */
	const peaks = [];
	for (let lag = minLag; lag <= maxLag; lag++) {
		const left = lag === minLag ? -Infinity : scores[lag - 1];
		const right = lag === maxLag ? -Infinity : scores[lag + 1];
		if (scores[lag] >= left && scores[lag] >= right && scores[lag] >= maxScore * 0.4) {
			peaks.push(lag);
		}
	}
	if (!peaks.length) return null;

	let strongest = peaks[0];
	for (const lag of peaks) {
		if (scores[lag] > scores[strongest]) strongest = lag;
	}

	// Harmonics (2×, 3× the pixel) also peak. Keep the shortest lag that
	// still lines up with the strongest one and is nearly as tall.
	let chosen = strongest;
	for (const lag of peaks) {
		if (lag >= chosen) continue;
		if (scores[lag] < scores[strongest] * 0.72) continue;
		const multiple = Math.round(strongest / lag);
		if (multiple >= 2 && Math.abs(strongest - multiple * lag) <= Math.max(1, multiple * 0.15)) {
			chosen = lag;
		}
	}

	return { period: chosen, score: maxScore };
}

/**
 * Edge-index phase in [0, period). High values sit on color changes.
 * @param {Float64Array} edge
 * @param {number} period
 */
export function edgePhase(edge, period) {
	const integer = Math.abs(period - Math.round(period)) < 1e-6;
	if (integer) {
		return phasePeakiness(edge, period).bucket;
	}

	const samples = Math.max(16, Math.ceil(period * 4));
	let bestPhase = 0;
	let best = -Infinity;
	for (let s = 0; s < samples; s++) {
		const phase = (s / samples) * period;
		let sum = 0;
		let n = 0;
		for (let x = phase; x < edge.length; x += period) {
			sum += sampleEdge(edge, x);
			n++;
		}
		const avg = n ? sum / n : 0;
		if (avg > best) {
			best = avg;
			bestPhase = phase;
		}
	}
	return bestPhase;
}

/**
 * @param {number} origin period-space offset of the first boundary
 * @param {number} period
 * @param {number} limit image size on this axis
 */
export function cropForOrigin(origin, period, limit) {
	if (!(period > 0) || limit < 3) return 0;
	const wrapped = wrap(origin, period);
	const rounded = Math.round(wrapped);
	/** @type {number[]} */
	const candidates = [0];
	if (rounded > 0 && rounded < limit - 2 && rounded < period + 0.5) candidates.push(rounded);

	let best = 0;
	let bestDist = phaseDistance(0, wrapped, period);
	for (const crop of candidates) {
		const dist = phaseDistance(crop, wrapped, period);
		if (dist < bestDist - 1e-6) {
			best = crop;
			bestDist = dist;
		}
	}
	return best;
}

/**
 * Share of pixels along each column or row whose brightness jump clears
 * the noise floor. Soft JPEG ripples inside a flat pixel drop out.
 * @param {Uint8ClampedArray} data
 * @param {number} width
 * @param {number} height
 * @param {number} x0
 * @param {number} y0
 * @param {number} cw
 * @param {number} ch
 * @param {'x' | 'y'} axis
 * @returns {Float64Array | null}
 */
function borderProfile(data, width, height, x0, y0, cw, ch, axis) {
	const horizontal = axis === 'x';
	const length = horizontal ? cw - 1 : ch - 1;
	const cross = horizontal ? ch : cw;
	if (length < MIN_PERIOD * 3 || cross < 2) return null;

	const stride = Math.max(1, Math.floor(cross / 80));
	/** @type {number[]} */
	const samples = [];
	for (let i = 0; i < length; i++) {
		for (let j = 0; j < cross; j += stride) {
			const d = horizontal
				? lumaDelta(data, width, height, x0 + i, y0 + j, 1, 0)
				: lumaDelta(data, width, height, x0 + j, y0 + i, 0, 1);
			if (d >= 0) samples.push(d);
		}
	}
	const threshold = borderThreshold(samples);
	if (threshold == null) return null;

	const edge = new Float64Array(length);
	for (let i = 0; i < length; i++) {
		let hits = 0;
		let n = 0;
		for (let j = 0; j < cross; j++) {
			const d = horizontal
				? lumaDelta(data, width, height, x0 + i, y0 + j, 1, 0)
				: lumaDelta(data, width, height, x0 + j, y0 + i, 0, 1);
			if (d < 0) continue;
			n++;
			if (d >= threshold) hits++;
		}
		edge[i] = n ? hits / n : 0;
	}
	return edge;
}

/**
 * @param {Uint8ClampedArray} data
 * @param {number} width
 * @param {number} height
 * @param {number} x
 * @param {number} y
 * @param {number} dx
 * @param {number} dy
 * @returns {number} brightness jump, or -1 when a pixel is transparent
 */
function lumaDelta(data, width, height, x, y, dx, dy) {
	const x1 = x + dx;
	const y1 = y + dy;
	if (x < 0 || y < 0 || x1 >= width || y1 >= height) return -1;
	const i0 = (y * width + x) * 4;
	const i1 = (y1 * width + x1) * 4;
	if (data[i0 + 3] < 16 || data[i1 + 3] < 16) return -1;
	const l0 = 0.299 * data[i0] + 0.587 * data[i0 + 1] + 0.114 * data[i0 + 2];
	const l1 = 0.299 * data[i1] + 0.587 * data[i1 + 1] + 0.114 * data[i1 + 2];
	return Math.abs(l0 - l1);
}

/**
 * Sit above JPEG speckle, below a real pixel step.
 * @param {number[]} samples
 * @returns {number | null}
 */
function borderThreshold(samples) {
	let max = 0;
	/** @type {number[]} */
	const strong = [];
	for (const v of samples) {
		if (v > max) max = v;
		if (v >= 8) strong.push(v);
	}
	if (max < 16 || strong.length < 8) return null;
	strong.sort((a, b) => a - b);
	const median = strong[strong.length >> 1];
	return Math.max(14, Math.min(40, median * 0.4));
}

/**
 * Nudge an integer period so borders stack in one phase bin.
 * @param {Float64Array} edge
 * @param {number} period
 */
function refinePeriod(edge, period) {
	let bestP = period;
	let bestC = edgeConcentration(edge, period);
	const lo = Math.max(MIN_PERIOD, period - 0.45);
	const hi = period + 0.45;
	for (let p = lo; p <= hi + 1e-6; p += 0.02) {
		const c = edgeConcentration(edge, p);
		if (c > bestC) {
			bestC = c;
			bestP = p;
		}
	}
	const snapped = snapPeriod(bestP);
	return { period: snapped, concentration: edgeConcentration(edge, snapped) };
}

/**
 * How tightly borders agree on one phase. 16 means every border shares a phase.
 * @param {Float64Array} edge
 * @param {number} period
 */
function edgeConcentration(edge, period) {
	const bins = 16;
	const hist = new Float64Array(bins);
	for (let i = 0; i < edge.length; i++) {
		const v = edge[i];
		if (v <= 0) continue;
		const frac = (i % period) / period;
		const b = Math.floor(frac * bins) % bins;
		hist[b] += v;
	}
	let sum = 0;
	let max = 0;
	for (let i = 0; i < bins; i++) {
		sum += hist[i];
		if (hist[i] > max) max = hist[i];
	}
	if (sum <= 0) return 0;
	return max / (sum / bins);
}

/**
 * @param {Float64Array} values
 */
function variance(values) {
	let mean = 0;
	for (let i = 0; i < values.length; i++) mean += values[i];
	mean /= values.length || 1;
	let sum = 0;
	for (let i = 0; i < values.length; i++) {
		const d = values[i] - mean;
		sum += d * d;
	}
	return sum / (values.length || 1);
}

/**
 * @param {Float64Array} values
 */
function zeroMean(values) {
	let mean = 0;
	for (let i = 0; i < values.length; i++) mean += values[i];
	mean /= values.length || 1;
	const z = new Float64Array(values.length);
	for (let i = 0; i < values.length; i++) z[i] = values[i] - mean;
	return z;
}

/**
 * @param {Float64Array} z
 * @param {number} minLag
 * @param {number} maxLag
 */
function autocorrelation(z, minLag, maxLag) {
	const scores = new Float64Array(maxLag + 1);
	let maxScore = 0;
	for (let lag = minLag; lag <= maxLag; lag++) {
		const n = z.length - lag;
		let num = 0;
		let d1 = 0;
		let d2 = 0;
		for (let i = 0; i < n; i++) {
			const a = z[i];
			const b = z[i + lag];
			num += a * b;
			d1 += a * a;
			d2 += b * b;
		}
		const den = Math.sqrt(d1 * d2);
		const v = den > 0 ? num / den : 0;
		scores[lag] = v;
		if (v > maxScore) maxScore = v;
	}
	return { scores, maxScore };
}

/**
 * @param {number} period
 */
function snapPeriod(period) {
	const rounded = Math.round(period);
	if (Math.abs(period - rounded) < 0.12) return rounded;
	return Math.round(period * 1000) / 1000;
}

/**
 * @param {Float64Array} edge
 * @param {number} period
 */
function phasePeakiness(edge, period) {
	const p = Math.max(MIN_PERIOD, Math.round(period));
	const buckets = new Float64Array(p);
	const counts = new Float64Array(p);
	for (let i = 0; i < edge.length; i++) {
		const b = i % p;
		buckets[b] += edge[i];
		counts[b] += 1;
	}
	let sum = 0;
	let best = 0;
	let bucket = 0;
	for (let b = 0; b < p; b++) {
		const v = counts[b] ? buckets[b] / counts[b] : 0;
		sum += v;
		if (v > best) {
			best = v;
			bucket = b;
		}
	}
	const mean = sum / p;
	return { peakiness: mean > 1e-8 ? best / mean : 0, bucket };
}

/**
 * @param {Float64Array} edge
 * @param {number} x
 */
function sampleEdge(edge, x) {
	const i = Math.floor(x);
	const f = x - i;
	if (i < 0 || i >= edge.length) return 0;
	if (f === 0 || i + 1 >= edge.length) return edge[i];
	return edge[i] * (1 - f) + edge[i + 1] * f;
}

/**
 * @param {number} value
 * @param {number} period
 */
function wrap(value, period) {
	const m = value % period;
	return m < 0 ? m + period : m;
}

/**
 * @param {number} crop
 * @param {number} origin
 * @param {number} period
 */
function phaseDistance(crop, origin, period) {
	let d = Math.abs(crop - origin);
	d = Math.min(d, Math.abs(crop - origin - period), Math.abs(crop - origin + period));
	return d;
}
