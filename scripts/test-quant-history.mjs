#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  buildQuantBacktestSummary,
  calculateHorizonStats,
  classifySeriesKind,
  inferHistoryCadence,
  normalizeHistoryPoints,
} from "./quant-history.mjs";

const DAY_MS = 86_400_000;
const day = (iso, value, extra = {}) => ({ date: `${iso}T00:00:00.000Z`, value, ...extra });

function dailySeries(startIso, endIso, valueAt) {
  const start = Date.parse(`${startIso}T00:00:00.000Z`);
  const end = Date.parse(`${endIso}T00:00:00.000Z`);
  const points = [];
  let index = 0;
  for (let time = start; time <= end; time += DAY_MS) {
    points.push({ date: new Date(time).toISOString(), value: valueAt(index, time) });
    index += 1;
  }
  return points;
}

const normalized = normalizeHistoryPoints([
  { crawledAt: "2026-07-02T12:00:00Z", sourceUpdate: "2026-07-01 18:10 (GMT+8)", average: "1,250.5" },
  { date: "invalid", value: 7 },
  { date: "2026-07-01T11:00:00Z", close: 1_251 },
]);
assert.equal(normalized.length, 1, "same-day observations must be deduplicated");
assert.equal(normalized[0].date, "2026-07-01T11:00:00.000Z");
assert.equal(normalized[0].value, 1_251);

const exactFiveYears = dailySeries("2021-07-20", "2026-07-20", (index) => 100 + index / 100);
assert.equal(inferHistoryCadence(exactFiveYears), "daily");
for (const horizon of ["1y", "3y", "5y"]) {
  const stats = calculateHorizonStats(exactFiveYears, {
    horizon,
    cadence: "daily",
    asOf: "2026-07-20T00:00:00Z",
  });
  assert.equal(stats.eligible, true, `${horizon} exact coverage must be eligible`);
  assert.equal(stats.status, "eligible");
  assert.ok(stats.pointCount >= stats.requiredPointCount);
  assert.ok(stats.largestGapDays <= 1);
}
const freshWithinFourteenDays = calculateHorizonStats(exactFiveYears, {
  horizon: "1y",
  cadence: "daily",
  asOf: "2026-08-02T00:00:00Z",
});
assert.equal(freshWithinFourteenDays.eligible, true, "a daily close up to 14 days old remains current");
const staleAfterFourteenDays = calculateHorizonStats(exactFiveYears, {
  horizon: "1y",
  cadence: "daily",
  asOf: "2026-08-04T00:00:00Z",
});
assert.equal(staleAfterFourteenDays.eligible, false);
assert.ok(staleAfterFourteenDays.reasonCodes.includes("stale-end"));

const newlyListed = dailySeries("2025-10-01", "2026-07-20", (index) => 50 + index);
const unavailableOneYear = calculateHorizonStats(newlyListed, {
  horizon: "1y",
  cadence: "daily",
  asOf: "2026-07-20T00:00:00Z",
});
assert.equal(unavailableOneYear.eligible, false);
assert.equal(unavailableOneYear.status, "insufficient-history");
assert.equal(unavailableOneYear.cumulativePct, null, "a shorter range must not masquerade as a 1y return");
assert.equal(unavailableOneYear.startDate, null, "fixed horizon must not fall back to the first available point");
assert.equal(unavailableOneYear.endDate, "2026-07-20T00:00:00.000Z");

const withLargeGap = dailySeries("2025-07-20", "2026-07-20", (index) => 100 + index)
  .filter((point) => point.date < "2026-01-01" || point.date > "2026-02-15");
const gapFailure = calculateHorizonStats(withLargeGap, {
  horizon: "1y",
  cadence: "daily",
  asOf: "2026-07-20T00:00:00Z",
});
assert.equal(gapFailure.eligible, false, "a discontinuous series must fail closed");
assert.ok(gapFailure.reasonCodes.includes("excessive-gap"));
assert.ok(gapFailure.largestGapDays > 10);
assert.equal(gapFailure.cumulativePct, null);

const monthlyWithOneMissingPublication = Array.from({ length: 13 }, (_, index) => ({
  date: new Date(Date.UTC(2025, 6 + index, 1)).toISOString(),
  value: 100 + index,
})).filter((_, index) => index !== 6);
const oneMissingMonth = calculateHorizonStats(monthlyWithOneMissingPublication, {
  horizon: "1y",
  cadence: "monthly",
  asOf: "2026-07-01T00:00:00Z",
});
assert.equal(oneMissingMonth.eligible, true, "one missing monthly publication may retain coverage");
assert.ok(oneMissingMonth.largestGapDays > 50 && oneMissingMonth.largestGapDays <= 75);

const monthlyWithTwoMissingPublications = monthlyWithOneMissingPublication
  .filter((point) => !point.date.startsWith("2026-02"));
const twoMissingMonths = calculateHorizonStats(monthlyWithTwoMissingPublications, {
  horizon: "1y",
  cadence: "monthly",
  asOf: "2026-07-01T00:00:00Z",
});
assert.equal(twoMissingMonths.eligible, false, "two consecutive missing monthly publications must fail closed");
assert.ok(twoMissingMonths.reasonCodes.includes("excessive-gap"));

const performance = [
  day("2023-01-01", 100),
  day("2023-02-01", 120),
  day("2023-03-01", 60),
  ...Array.from({ length: 34 }, (_, index) => {
    const date = new Date(Date.UTC(2023, 3 + index, 1));
    const value = 60 + ((200 - 60) * (index + 1)) / 34;
    return { date: date.toISOString(), value };
  }),
];
assert.equal(inferHistoryCadence(performance), "monthly");
const threeYear = calculateHorizonStats(performance, {
  horizon: "3y",
  cadence: "monthly",
  asOf: "2026-01-01T00:00:00Z",
});
assert.equal(threeYear.eligible, true);
assert.equal(threeYear.cumulativePct, 100);
assert.ok(Math.abs(threeYear.cagrPct - 25.98) < 0.1, `unexpected CAGR: ${threeYear.cagrPct}`);
assert.equal(threeYear.maxDrawdownPct, -50);
assert.equal(threeYear.seriesKind, "price", "direct calculations default to price semantics");
assert.equal(Object.hasOwn(threeYear, "absoluteChange"), false);

const ratePoints = Array.from({ length: 13 }, (_, index) => ({
  date: new Date(Date.UTC(2025, 6 + index, 1)).toISOString(),
  value: 10 + index,
}));
const rateStats = calculateHorizonStats(ratePoints, {
  horizon: "1y",
  cadence: "monthly",
  seriesKind: "rate",
  asOf: "2026-07-01T00:00:00Z",
});
assert.equal(rateStats.eligible, true);
assert.equal(rateStats.absoluteChange, 12);
assert.equal(rateStats.percentagePointChange, 12);
assert.equal(Object.hasOwn(rateStats, "cumulativePct"), false);
assert.equal(Object.hasOwn(rateStats, "cagrPct"), false);
assert.equal(Object.hasOwn(rateStats, "maxDrawdownPct"), false);

const flowPoints = ratePoints.map((point, index) => ({ ...point, value: 100 + (index * 5) }));
const flowStats = calculateHorizonStats(flowPoints, {
  horizon: "1y",
  cadence: "monthly",
  seriesKind: "flow",
  asOf: "2026-07-01T00:00:00Z",
});
assert.equal(flowStats.eligible, true);
assert.equal(flowStats.absoluteChange, 60);
assert.equal(flowStats.endpointChangePct, 60);
assert.equal(Object.hasOwn(flowStats, "cumulativePct"), false);
assert.equal(Object.hasOwn(flowStats, "cagrPct"), false);
assert.equal(Object.hasOwn(flowStats, "maxDrawdownPct"), false);

const signChangingFlow = calculateHorizonStats([
  ...ratePoints.slice(0, -1).map((point, index) => ({ ...point, value: index === 0 ? -5 : index + 1 })),
  { ...ratePoints.at(-1), value: 25 },
], {
  horizon: "1y",
  cadence: "monthly",
  seriesKind: "flow",
  asOf: "2026-07-01T00:00:00Z",
});
assert.equal(signChangingFlow.eligible, false, "loss-to-profit sign changes must not emit relative flow growth");
assert.ok(signChangingFlow.reasonCodes.includes("invalid-change-base"));
assert.equal(signChangingFlow.absoluteChange, null);
assert.equal(signChangingFlow.endpointChangePct, null);

const quarterlyPoints = Array.from({ length: 5 }, (_, index) => ({
  date: new Date(Date.UTC(2025, 6 + index * 3, 1)).toISOString(),
  value: 5 + index,
}));
assert.equal(inferHistoryCadence(quarterlyPoints), "quarterly");
const quarterlyStats = calculateHorizonStats(quarterlyPoints, {
  horizon: "1y",
  cadence: "quarterly",
  seriesKind: "flow",
  asOf: "2026-07-01T00:00:00Z",
});
assert.equal(quarterlyStats.eligible, true);
assert.equal(quarterlyStats.pointCount, 5);
assert.equal(quarterlyStats.endpointChangePct, 80);

const sparseAnchors = [
  day("2021-07-20", 100),
  day("2022-07-20", 110),
  day("2023-07-20", 120),
  day("2024-07-20", 130),
  day("2025-07-20", 140),
  day("2026-07-20", 150),
];
assert.equal(inferHistoryCadence(sparseAnchors), "sparse");
const sparseStats = calculateHorizonStats(sparseAnchors, {
  horizon: "5y",
  cadence: "sparse",
  asOf: "2026-07-20T00:00:00Z",
});
assert.equal(sparseStats.eligible, false);
assert.ok(sparseStats.reasonCodes.includes("sparse-cadence"));
assert.equal(sparseStats.cumulativePct, null, "archive anchors must not be presented as a continuous 5y backtest");

const priceHistory = {
  updatedAt: "2026-07-20T00:00:00Z",
  items: {
    zeta: { item: "Zeta", points: sparseAnchors },
    alpha: { item: "Alpha", cadence: "daily", points: exactFiveYears },
    hybrid: {
      item: "Hybrid monthly price",
      cadence: "daily",
      points: [
        ...ratePoints.map((point, index) => ({ ...point, value: 100 + index })),
        ...dailySeries("2026-06-01", "2026-07-20", (index) => 111 + index / 100),
      ],
    },
  },
};
const marketHistory = {
  updatedAt: "2026-07-20T00:00:00Z",
  runId: "run-fixture",
  indexes: { sox: { labelKo: "반도체 지수", cadence: "daily", points: exactFiveYears } },
  metrics: {
    short: { label: "신규 상장", cadence: "daily", points: newlyListed },
    "quant-usdkrw": { label: "USD/KRW", cadence: "daily", points: exactFiveYears },
    "quant-tsmc-yoy": { label: "TSMC YoY", cadence: "monthly", points: ratePoints },
    "tsmc-revenue": { label: "TSMC revenue", cadence: "monthly", points: flowPoints },
  },
};
const contractA = buildQuantBacktestSummary({ priceHistory, marketHistory });
const contractB = buildQuantBacktestSummary({ priceHistory, marketHistory });
assert.deepEqual(contractA, contractB, "the derived contract must be deterministic");
assert.deepEqual(Object.keys(contractA.series), [
  "price:alpha",
  "price:hybrid",
  "price:zeta",
  "market:sox",
  "metric:quant-tsmc-yoy",
  "metric:quant-usdkrw",
  "metric:short",
  "metric:tsmc-revenue",
]);
assert.equal(contractA.schemaVersion, "1.0");
assert.equal(contractA.generatedAt, "2026-07-20T00:00:00.000Z");
assert.equal(contractA.runId, "run-fixture");
assert.equal(Object.hasOwn(contractA.coverage, "5"), false);
assert.equal(contractA.coverage["5y"].totalSeries, 8);
assert.equal(contractA.coverage["5y"].eligibleSeries, 3);
assert.equal(contractA.series["price:hybrid"].cadence, "monthly", "price-domain cadence must remain monthly");
assert.equal(contractA.series["price:hybrid"].periods["1y"].eligible, true);
assert.equal(contractA.series["price:hybrid"].seriesKind, "price");
assert.equal(contractA.series["metric:quant-usdkrw"].seriesKind, "price");
assert.equal(contractA.series["metric:quant-tsmc-yoy"].seriesKind, "rate");
assert.equal(contractA.series["metric:tsmc-revenue"].seriesKind, "flow");
assert.equal(Object.hasOwn(contractA.series["metric:short"].periods["1y"], "cumulativePct"), false);
assert.equal(classifySeriesKind("share-skhy-hbmShare"), "rate");
assert.equal(classifySeriesKind("micron-gross-profit"), "flow");
assert.equal(classifySeriesKind("inventory-days"), "flow");
for (const id of ["quant-usdkrw", "quant-usdtwd", "quant-nvda", "quant-amd"]) {
  assert.equal(classifySeriesKind(id), "price", `${id} must use price-return semantics`);
}

console.log(JSON.stringify({
  ok: true,
  exactHorizons: ["1y", "3y", "5y"],
  partialStatus: unavailableOneYear.status,
  gapStatus: gapFailure.status,
  cumulativePct: threeYear.cumulativePct,
  cagrPct: threeYear.cagrPct,
  maxDrawdownPct: threeYear.maxDrawdownPct,
  contractSeries: Object.keys(contractA.series).length,
}, null, 2));
