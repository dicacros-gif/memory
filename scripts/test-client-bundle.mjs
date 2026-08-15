#!/usr/bin/env node

import assert from "node:assert/strict";
import { buildClientDataBundle, summarizeMarketHistory } from "./crawl.mjs";

const runId = "test-client-run";
const payload = {
  schemaVersion: "4.0",
  runId,
  updatedAt: "2026-07-25T00:00:00.000Z",
  expiresAt: "2026-07-26T00:00:00.000Z",
  quality: { status: "verified" },
  prices: {
    sections: [{ id: "dram", rows: [{ item: "DDR5", average: 10, history: [{ date: "2026-07-01", average: 10 }] }] }],
    watchedItems: [{ item: "DDR5", average: 10, history: [{ date: "2026-07-01", average: 10 }] }],
  },
  quant: { duplicate: true },
  priceHistory: { duplicate: true },
  marketHistory: { duplicate: true },
  evidence: { duplicate: true },
  sourceRegistry: { duplicate: true },
  news: [{ title: "verified source article" }],
};
const quant = {
  runId,
  updatedAt: payload.updatedAt,
  sourceHealth: { ok: 1 },
  fx: { usdkrw: { history30d: { points: [{ date: "2026-07-01", value: 1 }] }, history5y: { points: [{ date: "2021-07-01", value: 1 }] } } },
};
const priceHistory = {
  schemaVersion: "2.0",
  runId,
  updatedAt: payload.updatedAt,
  items: {
    "dram::ddr5": {
      key: "dram::ddr5",
      sectionId: "dram",
      item: "DDR5",
      points: [{ date: "2026-07-01T00:00:00.000Z", average: 10, parserTrace: "database-only" }],
    },
  },
  archiveBackfill: { attempts: { "dram:2026-07": { status: "empty" } }, coverage: { coverageRatio: 0.2 } },
};
const marketHistory = {
  schemaVersion: "2.0",
  runId,
  updatedAt: payload.updatedAt,
  validatedAt: payload.updatedAt,
  expiresAt: payload.expiresAt,
  indexes: {
    sox: { id: "sox", symbol: "^SOX", sourceUrl: "https://example.com/sox", points: [{ date: "2026-07-01T00:00:00.000Z", time: 1_783_000_000_000, close: 5000, rawClose: 5001 }] },
  },
  metrics: { internal: { points: [{ value: 1, sourceUrl: "https://example.com" }] } },
};
const quantBacktest = {
  schemaVersion: "1.0",
  runId,
  generatedAt: payload.updatedAt,
  coverage: { "1y": { eligibleSeries: 1 } },
  series: { "market:sox": { id: "sox", domain: "market", periods: { "1y": { eligible: true, startProvenance: { databaseOnly: true }, endProvenance: { databaseOnly: true } }, }, provenance: { databaseOnly: true } } },
};

const bundle = buildClientDataBundle({ payload, quant, priceHistory, marketHistory, quantBacktest });
const marketSummary = summarizeMarketHistory(marketHistory);

assert.equal(bundle.manifest.runId, runId);
assert.deepEqual(Object.keys(bundle.manifest.artifacts).sort(), ["decisionHistory", "live", "marketHistory", "priceHistory", "quant", "quantBacktest"]);
assert.equal(bundle.live.quant, undefined, "live client must not duplicate quant.json");
assert.equal(bundle.live.priceHistory, undefined, "live client must not duplicate price history");
assert.equal(bundle.live.prices.sections[0].rows[0].history, undefined, "price row history belongs in the deferred artifact");
assert.equal(bundle.priceHistory.archiveBackfill.attempts, undefined, "archive retry diagnostics stay in the database artifact");
assert.equal(bundle.priceHistory.items["dram::ddr5"].points[0].parserTrace, undefined);
assert.equal(bundle.marketHistory.metrics.internal, undefined, "metric provenance stays in the database artifact");
assert.deepEqual(bundle.marketHistory.indexes.sox.points[0], [1_783_000_000_000, 5000], "market points use compact time/close tuples");
assert.equal(bundle.quantBacktest.series["market:sox"].provenance, undefined);
assert.equal(bundle.quantBacktest.series["market:sox"].periods["1y"].startProvenance, undefined);
assert.deepEqual(bundle.quantBacktest.series["market:sox"].periods["1y"], { eligible: true }, "browser backtest periods keep only decision eligibility");
assert.deepEqual(Object.keys(bundle.decisionHistory.marketHistory.indexes), ["sox"], "decision bundle keeps only executive market proxies");
assert.deepEqual(Object.keys(bundle.decisionHistory.quantBacktest.series), ["market:sox"], "decision bundle keeps only matching backtest summaries");
assert.ok(bundle.manifest.artifacts.decisionHistory.bytes < bundle.manifest.artifacts.marketHistory.bytes + bundle.manifest.artifacts.priceHistory.bytes + bundle.manifest.artifacts.quantBacktest.bytes, "decision bundle must stay smaller than the full history payload");
assert.equal(bundle.quant.fx.usdkrw.history5y, undefined);
assert.equal(bundle.quant.fx.usdkrw.history30d.points.length, 1);
assert.ok(bundle.manifest.artifacts.live.bytes > 0);
assert.equal(marketSummary.runId, runId, "embedded market summary must preserve the verified runId");
assert.equal(marketSummary.validatedAt, payload.updatedAt, "embedded market summary must preserve validation time");
assert.equal(marketSummary.expiresAt, payload.expiresAt, "embedded market summary must preserve the shared freshness gate");

console.log(JSON.stringify({
  ok: true,
  artifacts: Object.keys(bundle.manifest.artifacts).length,
  liveBytes: bundle.manifest.artifacts.live.bytes,
}, null, 2));
