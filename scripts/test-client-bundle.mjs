#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { buildClientDataBundle, summarizeMarketHistory } from "./crawl.mjs";

const crawlSource = await readFile(new URL("./crawl.mjs", import.meta.url), "utf8");
assert.match(crawlSource, /SITE_CONTENT_EXTENDED_CLIENT_OUT/, "crawler must define the extended site-content output");
assert.match(
  crawlSource,
  /\[SITE_CONTENT_EXTENDED_CLIENT_OUT,\s*clientBundle\.siteContentExtended\]/,
  "crawler must publish both site-content artifacts in the same verified bundle",
);

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
  news: [
    { title: "current article", url: "https://example.com/current", publishedAt: "2026-07-25" },
    { title: "stale article", url: "https://example.com/stale", publishedAt: "2025-07-25" },
  ],
  intelligence: {
    briefs: ["hbm", "dram", "nand", "demand"].map((id) => ({
      id,
      label: id.toUpperCase(),
      evidenceCount: 1,
      latest: {
        title: `${id} current signal`,
        summary: `${id} current summary`,
        source: "Official source",
        url: `https://example.com/${id}`,
        publishedAt: "2026-07-25",
        evidenceLevel: "Confirmed",
        sourceClass: "official",
      },
      insight: `${id} implication`,
      decision: `${id} decision`,
      reversalKpi: `${id} reversal KPI`,
    })),
  },
};
const quant = {
  runId,
  updatedAt: payload.updatedAt,
  sourceHealth: { ok: 1 },
  fx: { usdkrw: { history30d: { points: [{ date: "2026-07-01", value: 1 }] }, history5y: { points: [{ date: "2021-07-01", value: 1 }] } } },
  decisionIntelligence: {
    decisionAutomation: {
      state: "EVIDENCE_READY",
      meceAxes: ["customer-strategy", "workload-architecture", "new-biz-insight", "partner-execution"].map((id) => ({
        id,
        label: id.toUpperCase(),
        owns: `${id} owned scope`,
        excludes: `${id} excluded scope`,
      })),
      briefs: ["custom-memory", "agentic-tiering", "enterprise-rag", "ai-factory"].map((id, index) => ({
        id,
        label: id,
        meceAxis: ["customer-strategy", "workload-architecture", "new-biz-insight", "partner-execution"][index],
        decisionQuestion: `${id} decision question`,
        whatChanged: `${id} decision question`,
        latestSignal: `${id} latest signal`,
        stage: ["CUSTOMER_QUALIFICATION", "ARCHITECTURE_BENCHMARK", "BUSINESS_CASE", "SCALE_GATE"][index],
        deliverable: `${id} deliverable`,
        status: "EVIDENCE_READY",
        evidence: [],
      })),
    },
  },
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
assert.match(bundle.manifest.cacheVersion, new RegExp(`^${runId}-[a-f0-9]{16}$`), "cache version must change when the browser artifact contract changes");
assert.deepEqual(Object.keys(bundle.manifest.artifacts).sort(), ["companyDirectory", "companySignals", "decisionHistory", "insightLedger", "landingDecision", "live", "marketHistory", "memoryDemand", "orgSignals", "painPoints", "priceHistory", "quant", "quantBacktest", "siliconMap", "siteContent", "siteContentExtended"]);
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
assert.deepEqual(bundle.live.news.map((item) => item.title), ["current article"], "browser news must contain only articles published in 2026");
assert.equal(bundle.landingDecision.runId, runId);
assert.equal(bundle.landingDecision.clientArtifact, true);
assert.ok(bundle.manifest.artifacts.landingDecision.bytes < 20_000, "landing decision artifact must remain first-page friendly");
assert.equal(bundle.siteContent.runId, runId);
assert.equal(bundle.siteContent.clientArtifact, true);
assert.ok(
  gzipSync(JSON.stringify(bundle.siteContent)).byteLength < 32_000,
  "site content transfer payload must remain below the first-page compressed budget",
);
assert.equal(bundle.siteContentExtended.runId, runId);
assert.equal(bundle.siteContentExtended.clientArtifact, true);
assert.ok(bundle.siteContent.strategyBoard?.customerPortfolio?.competitiveDynamics?.relations?.length > 0, "competitive dynamics must remain available when the extended strategy snapshot is temporarily unavailable");
const coreDynamics = bundle.siteContent.strategyBoard?.customerPortfolio?.competitiveDynamics || {};
const extendedDynamics = bundle.siteContentExtended.strategyBoard?.customerPortfolio?.competitiveDynamics || {};
assert.equal(coreDynamics.views?.[coreDynamics.defaultView]?.companyScope, "site-company-registry", "the first client snapshot must expose the complete site-company roster");
assert.deepEqual(
  new Set(coreDynamics.companies.map((company) => company.id)),
  new Set(extendedDynamics.companies.map((company) => company.id)),
  "core and extended Dynamics must expose the same site-company roster",
);
assert.deepEqual(
  new Set(extendedDynamics.companies.map((company) => company.id)),
  new Set(extendedDynamics.views?.[extendedDynamics.defaultView]?.companyIds || []),
  "the deferred all-company view must resolve every requested company",
);
assert.equal(extendedDynamics.relations.length, coreDynamics.relations.length, "full company coverage must not invent additional relationship edges");
assert.equal(bundle.manifest.artifacts.siteContentExtended.path, "data/site-content-extended-client.json");
assert.equal(bundle.companyDirectory.runId, runId);
assert.equal(bundle.manifest.artifacts.companyDirectory.path, "data/company-directory-client.json");
assert.ok(bundle.companyDirectory.profiles.some((profile) => profile.id === "broadcom"));
assert.equal(marketSummary.runId, runId, "embedded market summary must preserve the verified runId");
assert.equal(marketSummary.validatedAt, payload.updatedAt, "embedded market summary must preserve validation time");
assert.equal(marketSummary.expiresAt, payload.expiresAt, "embedded market summary must preserve the shared freshness gate");

console.log(JSON.stringify({
  ok: true,
  artifacts: Object.keys(bundle.manifest.artifacts).length,
  liveBytes: bundle.manifest.artifacts.live.bytes,
  landingDecisionBytes: bundle.manifest.artifacts.landingDecision.bytes,
}, null, 2));
