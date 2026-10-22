/**
 * Data integrity rules shared by the crawler, the IC memo and the terminal.
 *
 * Free market data is right most of the time and wrong in a few repeatable
 * ways: a provider re-bases its adjusted closes after a split, a consensus
 * target is months older than the price it is compared with, a multiple on
 * negative or near-zero earnings is a number without meaning. None of these
 * may reach a reader as a fact. Each rule here either repairs the value from
 * evidence in the same data (an overlap ratio), or withholds it and says why.
 * Nothing is estimated or filled in.
 */

const isNum = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
const dayOf = (time) => new Date(time).toISOString().slice(0, 10);
const median = (values) => {
  const list = values.filter(isNum).map(Number).sort((a, b) => a - b);
  if (!list.length) return null;
  const middle = Math.floor(list.length / 2);
  return list.length % 2 ? list[middle] : (list[middle - 1] + list[middle]) / 2;
};

// ── Price series ────────────────────────────────────────────────────────────

/**
 * Yahoo rewrites its adjusted closes after a split or dividend. A stored
 * point older than the fresh window keeps the basis it was fetched on, so the
 * two bases meet in a fake cliff. When the stored and fresh windows share
 * days, the median close ratio over those days is the re-basing factor, and
 * the older stored points are divided by it. Returns 1 when the bases agree
 * or there is too little overlap to tell.
 */
export function rebaseFactor(existing = [], incoming = [], { minOverlap = 3, tolerance = 0.005 } = {}) {
  const fresh = new Map(incoming.map((point) => [dayOf(point.time), Number(point.close)]));
  const ratios = existing
    .map((point) => {
      const close = fresh.get(dayOf(point.time));
      return isNum(close) && close > 0 ? Number(point.close) / close : null;
    })
    .filter(isNum);
  if (ratios.length < minOverlap) return 1;
  const factor = median(ratios);
  return Math.abs(factor - 1) > tolerance ? factor : 1;
}

/**
 * A listed large cap does not lose 60% or gain 150% in one session without
 * news. Three shapes of that move, three treatments:
 *  - spike: one print that the next session undoes is a bad tick; drop it.
 *  - seam: a move that holds, found among stored points older than the
 *    fresh window, is a basis change the overlap could not repair (no shared
 *    days). One fetch is one basis, so a cliff inside the fresh window is a
 *    real move and is never trimmed; only the stored tail can carry a seam.
 *    The points before a seam are dropped, never rescaled by guesswork.
 *  - unconfirmed: a move in the last two sessions cannot be told apart from a
 *    real collapse yet; it is kept and flagged for the reader.
 */
export function cleanSeries(points = [], { floor = 0.4, ceiling = 2.5, persist = 5, band = 0.3, seamBefore = -Infinity } = {}) {
  const extreme = (ratio) => !(ratio > floor && ratio < ceiling);
  const close = (point) => Number(point.close);
  const spikes = [];
  const list = [];
  for (let index = 0; index < points.length; index += 1) {
    const previous = list.at(-1);
    const point = points[index];
    const next = points[index + 1];
    if (previous && next && close(previous) > 0 && close(point) > 0 && close(next) > 0
      && extreme(close(point) / close(previous)) && extreme(close(next) / close(point))
      && Math.abs(close(next) / close(previous) - 1) < band) {
      spikes.push({ date: dayOf(point.time), ratio: Number((close(point) / close(previous)).toFixed(4)) });
      continue;
    }
    list.push(point);
  }
  const seams = [];
  const unconfirmed = [];
  let cleanFrom = 0;
  for (let index = 1; index < list.length; index += 1) {
    const before = close(list[index - 1]);
    const after = close(list[index]);
    if (!(before > 0 && after > 0) || !extreme(after / before)) continue;
    const ratio = Number((after / before).toFixed(4));
    if (list.length - index < 3) {
      unconfirmed.push({ date: dayOf(list[index].time), ratio });
      continue;
    }
    const following = list.slice(index, index + persist).map(close);
    if (list[index].time < seamBefore && following.every((value) => value > after * (1 - band) && value < after * (1 + band))) {
      seams.push({ date: dayOf(list[index].time), ratio, dropped: index });
      cleanFrom = index;
    }
  }
  return { points: list.slice(cleanFrom), seams, spikes, unconfirmed };
}

/**
 * Merge stored closes with a fresh window: fresh prints win on shared days,
 * older stored points are first brought onto the fresh basis when the overlap
 * proves the basis moved, then the result is cleaned. `points` must be
 * normalised {time, close} objects sorted by time.
 */
export function reconcileSeries(existing = [], incoming = [], options = {}) {
  const factor = incoming.length ? rebaseFactor(existing, incoming) : 1;
  const firstFresh = incoming.length ? Math.min(...incoming.map((point) => point.time)) : Infinity;
  const byDay = new Map();
  for (const point of existing) {
    const rebased = factor !== 1 && point.time < firstFresh;
    const value = rebased ? Number((Number(point.close) / factor).toFixed(2)) : point.close;
    byDay.set(dayOf(point.time), { ...point, close: value, value });
  }
  for (const point of incoming) byDay.set(dayOf(point.time), point);
  const merged = [...byDay.values()].sort((a, b) => a.time - b.time);
  const cleaned = cleanSeries(merged, { ...options, seamBefore: firstFresh === Infinity ? -Infinity : firstFresh });
  return { ...cleaned, rebaseFactor: factor === 1 ? null : Number(factor.toFixed(6)) };
}

// ── Consensus and multiples ─────────────────────────────────────────────────

/**
 * A target price is a dated opinion. When the price now sits below the lowest
 * target or above the highest by a wide margin, the targets were set before
 * the move and the "upside" is mostly the move itself. A consensus of one or
 * two analysts is an opinion, not a consensus.
 */
export function consensusQuality({ price, target, low, high, analysts, priceCurrency, targetCurrency } = {}, { minAnalysts = 3, band = 0.2 } = {}) {
  if (!isNum(price) || !isNum(target) || Number(price) <= 0 || Number(target) <= 0) return { status: "missing", reason: "목표가 미수집" };
  if (priceCurrency && targetCurrency && priceCurrency !== targetCurrency) {
    return { status: "currency", reason: `통화 불일치 (${targetCurrency} 목표가 · ${priceCurrency} 주가)` };
  }
  if (!isNum(analysts) || Number(analysts) < minAnalysts) {
    return { status: "thin", reason: `애널리스트 ${isNum(analysts) ? Number(analysts) : 0}명 · 표본 부족` };
  }
  if (isNum(low) && Number(price) < Number(low) * (1 - band)) {
    return { status: "stale", reason: "현재가가 최저 목표가보다 20% 넘게 낮음 · 목표가가 주가 하락 이전 기준일 가능성" };
  }
  if (isNum(high) && Number(price) > Number(high) * (1 + band)) {
    return { status: "stale", reason: "현재가가 최고 목표가보다 20% 넘게 높음 · 목표가가 주가 상승 이전 기준일 가능성" };
  }
  return { status: "ok", reason: null };
}

/** Bloomberg prints N.M. (not meaningful) for a multiple on negative or near-zero earnings. */
export function multipleQuality(value, { max = 200 } = {}) {
  if (!isNum(value)) return null;
  return Number(value) <= 0 || Number(value) > max ? "nm" : "ok";
}

/**
 * The published close is the crawl's. A second source printing a materially
 * different price for the same session means one of them is wrong; the row
 * is flagged instead of silently picking one.
 */
export function priceAgreement({ published, publishedDay, other, otherDay } = {}, { tolerance = 0.05 } = {}) {
  if (!isNum(published) || !isNum(other) || !publishedDay || !otherDay || publishedDay !== otherDay) return { status: "unchecked" };
  const gap = Number(other) / Number(published) - 1;
  return Math.abs(gap) > tolerance
    ? { status: "mismatch", gapPct: Number((gap * 100).toFixed(2)) }
    : { status: "ok", gapPct: Number((gap * 100).toFixed(2)) };
}
