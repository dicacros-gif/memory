import assert from "node:assert/strict";
import { cleanSeries, consensusQuality, multipleQuality, priceAgreement, rebaseFactor, reconcileSeries } from "./data-integrity.mjs";
import { reconcileMarketPoints } from "./crawl.mjs";

const DAY = 864e5;
const start = Date.parse("2021-07-01T00:00:00Z");
const series = (values, offset = 0) => values.map((close, index) => ({ time: start + (index + offset) * DAY, close }));
const ramp = (count, from = 100, step = 0.5) => Array.from({ length: count }, (_, index) => Number((from + index * step).toFixed(2)));

// 1. A re-based provider history is brought onto the fresh basis through the
//    overlap, not left as a cliff.
const stored = series(ramp(120).map((value) => value * 3));
const fresh = series(ramp(120), 0).slice(80);
assert.equal(Number(rebaseFactor(stored, fresh).toFixed(6)), 3, "the overlap ratio is the re-basing factor");
const rebased = reconcileSeries(stored, fresh);
assert.equal(rebased.rebaseFactor, 3);
assert.equal(rebased.points.length, 120, "re-basing keeps the whole history");
assert.equal(rebased.points[0].close, 100);
assert.ok(rebased.points.every((point, index) => index === 0 || Math.abs(point.close / rebased.points[index - 1].close - 1) < 0.01), "no cliff remains at the seam");
assert.equal(rebaseFactor(series(ramp(50)), series(ramp(50)).slice(30)), 1, "agreeing bases are left alone");

// 2. A seam with no overlap left (an old tail on another basis) drops the
//    tail; the same move inside the fresh window is a real move and stays.
const tail = series([...ramp(40, 13000, 10), ...ramp(80, 2600, 5)]);
const window = tail.slice(45);
const seamed = reconcileSeries(tail, window);
assert.equal(seamed.seams.length, 1, "a persistent five-fold cliff in the stored tail is a seam");
assert.equal(seamed.points[0].close, 2600, "the points before the seam are dropped, not rescaled");
const crash = series([...ramp(60, 100, 0.2), ...ramp(60, 30, 0.1)]);
const realMove = reconcileSeries(crash, crash);
assert.equal(realMove.seams.length, 0, "a cliff inside the fresh window is a real move");
assert.equal(realMove.points.length, 120, "a real move never costs history");

// 3. A single bad print that the next session undoes is removed.
const ticked = series([...ramp(30), 14, ...ramp(30, 115)]);
const despiked = cleanSeries(ticked);
assert.equal(despiked.spikes.length, 1);
assert.equal(despiked.points.length, ticked.length - 1);

// 4. A cliff in the last two sessions is kept and flagged, never trimmed.
const late = series([...ramp(60), 20]);
const unconfirmed = cleanSeries(late, { seamBefore: Infinity });
assert.equal(unconfirmed.unconfirmed.length, 1);
assert.equal(unconfirmed.points.length, late.length, "an unconfirmed move keeps all history");

// 5. The crawler's merge applies the same rules and reports them.
const merged = reconcileMarketPoints(
  tail.map((point) => ({ date: new Date(point.time).toISOString(), close: point.close })),
  window.map((point) => ({ date: new Date(point.time).toISOString(), close: point.close })),
);
assert.equal(merged.integrity.seams.length, 1);
assert.equal(merged.points[0].close, 2600);
assert.equal(reconcileMarketPoints(window, window).integrity, null, "a clean merge carries no integrity note");

// 6. Consensus quality.
assert.equal(consensusQuality({ price: 100, target: 125, low: 90, high: 160, analysts: 20 }).status, "ok");
assert.equal(consensusQuality({ price: 100, target: 125, analysts: 2 }).status, "thin");
assert.equal(consensusQuality({ price: 100, target: 300, low: 200, high: 400, analysts: 30 }).status, "stale", "a price far below every target means the targets predate the move");
assert.equal(consensusQuality({ price: 500, target: 300, low: 200, high: 400, analysts: 30 }).status, "stale");
assert.equal(consensusQuality({ price: 100, target: 125, analysts: 20, priceCurrency: "KRW", targetCurrency: "USD" }).status, "currency");
assert.equal(consensusQuality({ price: null, target: 125, analysts: 20 }).status, "missing");

// 7. Multiples and cross-source prices.
assert.equal(multipleQuality(-12), "nm");
assert.equal(multipleQuality(480), "nm");
assert.equal(multipleQuality(18.5), "ok");
assert.equal(multipleQuality(null), null);
assert.equal(priceAgreement({ published: 100, publishedDay: "2026-10-22", other: 108, otherDay: "2026-10-22" }).status, "mismatch");
assert.equal(priceAgreement({ published: 100, publishedDay: "2026-10-22", other: 101, otherDay: "2026-10-22" }).status, "ok");
assert.equal(priceAgreement({ published: 100, publishedDay: "2026-10-22", other: 130, otherDay: "2026-10-21" }).status, "unchecked", "different sessions are not compared");

console.log(JSON.stringify({ dataIntegrity: "pass", rules: 7 }));
