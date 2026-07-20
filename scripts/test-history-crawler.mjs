#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  archiveMonthlyTargets,
  mergeMarketPoints,
  mergePricePoints,
  parseTsmcAnnualRevenueHtml,
  pricePointCoversMonth,
  trendForceObservationIso,
} from "./crawl.mjs";

const observedAt = trendForceObservationIso("2026-05-29 15:00 (GMT+8)");
assert.equal(observedAt, "2026-05-29T07:00:00.000Z");

const duplicateCrawls = mergePricePoints([
  {
    date: "2026-07-17T01:00:00.000Z",
    crawledAt: "2026-07-17T01:00:00.000Z",
    sourceUpdate: "2026-05-29 15:00 (GMT+8)",
    average: 3.25,
    changeRaw: "0.00%",
  },
  {
    date: "2026-07-18T01:00:00.000Z",
    crawledAt: "2026-07-18T01:00:00.000Z",
    sourceUpdate: "2026-05-29 15:00 (GMT+8)",
    average: 3.25,
    changeRaw: "0.00%",
  },
], []);
assert.equal(duplicateCrawls.length, 1, "same source observation must not become multiple crawl-day points");
assert.equal(duplicateCrawls[0].date, observedAt);
assert.equal(duplicateCrawls[0].sourceObservedAt, observedAt);

const corrected = mergePricePoints(duplicateCrawls, [{
  sourceUpdate: "2026-05-29 15:00 (GMT+8)",
  crawledAt: "2026-07-20T01:00:00.000Z",
  average: 3.3,
  changeRaw: "+1.54%",
}]);
assert.equal(corrected.length, 1);
assert.equal(corrected[0].average, 3.3, "a later correction for the same observation date must replace the old value");

const marketPointWithoutRawClose = mergeMarketPoints([], [{
  date: "2026-07-20T00:00:00.000Z",
  close: 123.45,
  rawClose: null,
}]);
assert.equal(marketPointWithoutRawClose[0].rawClose, null, "missing raw close must not be serialized as zero");
const marketPointWithLegacyZero = mergeMarketPoints([], [{
  date: "2026-07-21T00:00:00.000Z",
  close: 125.5,
  rawClose: 0,
}]);
assert.equal(marketPointWithLegacyZero[0].rawClose, null, "legacy zero sentinel must migrate back to missing");

const targets = archiveMonthlyTargets(60, new Date("2026-07-20T00:00:00.000Z"));
assert.equal(targets.length, 60);
assert.equal(targets[0].id, "2021-07");
assert.equal(targets.at(-1).id, "2026-06");
assert.equal(new Set(targets.map((target) => target.id)).size, 60);
assert.equal(pricePointCoversMonth({ date: "2026-07-01T00:00:00Z", average: 1 }, "2026-06"), false,
  "one observation must not cover an adjacent archive month");
assert.equal(pricePointCoversMonth({ date: "2026-06-30T00:00:00Z", average: 1 }, "2026-06"), true);

const tsmc = parseTsmcAnnualRevenueHtml(`
  <table><tr><th>Month</th><th>Consolidated Net Revenue</th><th>YoY Change</th></tr>
  <tr><td>Jan.</td><td>293,288</td><td>35.9%</td></tr>
  <tr><td>Feb.</td><td>260,009</td><td>43.1%</td></tr></table>
`, 2025, "https://investor.tsmc.com/english/monthly-revenue/2025");
assert.deepEqual(tsmc.map((point) => [point.date, point.revenueBillionTwd, point.yoyPct]), [
  ["2025-01", 293.3, 35.9],
  ["2025-02", 260, 43.1],
]);

console.log(JSON.stringify({
  ok: true,
  sourceObservedAt: observedAt,
  deduplicatedPoints: duplicateCrawls.length,
  archiveMonths: targets.length,
  archiveRange: [targets[0].id, targets.at(-1).id],
  tsmcMonths: tsmc.length,
}, null, 2));
