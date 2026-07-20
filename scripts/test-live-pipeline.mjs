#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEMAND_ACCOUNT_REGISTRY,
  RELATION_ENTITY_REGISTRY,
  buildAgentBriefing,
  buildBaselineFreshness,
  buildDemandAccountSignals,
  buildIndustryPulse,
  buildRelationCandidates,
} from "./live-pipeline.mjs";
import { buildBrokerResearch, collectLastGood, extractLiveFigures, quantMemoryMomentum, sourceHealthId, sourceHealthSnapshot } from "./crawl.mjs";

const now = new Date("2026-07-20T12:00:00Z");
const article = (title, url, date = "2026-07-20", summary = title, source = "Official", sourceClass = "official-primary") => ({
  title,
  originalTitle: title,
  summaryOriginal: summary,
  link: url,
  sourceUrl: url,
  source,
  date,
  verification: { sourceClass, origin: "live-crawl", observedThisRun: true },
});

assert.equal(DEMAND_ACCOUNT_REGISTRY.length, 27, "demand registry must contain exactly 27 accounts");
assert.equal(new Set(DEMAND_ACCOUNT_REGISTRY.map((item) => item.id)).size, 27, "demand account ids must be unique");
assert.equal(new Set(RELATION_ENTITY_REGISTRY.map((item) => item.id)).size, RELATION_ENTITY_REGISTRY.length, "relation entity ids must be unique");

const accountContext = {
  news: [
    article("Microsoft Azure expands cloud data center CAPEX", "https://example.com/azure", "2026-07-19"),
    article("Tencent signs a server DRAM supply contract", "https://example.com/tencent", "2026-07-19"),
    article("Output flaws increase memory test coverage", "https://example.com/not-aws", "2026-07-19"),
    article("서버 메모리 확대 모델 검토", "https://example.com/not-dell", "2026-07-19"),
    article("Tesla expands automotive memory orders", "https://news-one.example/tesla", "2026-07-19", undefined, "News One", "news"),
    article("BYD expands automotive memory orders", "https://news-one.example/byd", "2026-07-19", undefined, "News One", "news"),
    article("BYD increases automotive memory supply contract", "https://news-two.example/byd", "2026-07-18", undefined, "News Two", "news"),
    {
      ...article("Amazon AWS expands cloud data center CAPEX", "https://seed.example/aws", "2026-07-19"),
      preservedSeed: true,
      verification: { sourceClass: "official-primary", origin: "curated-seed", observedThisRun: false },
    },
  ],
  benchmarkSignals: { stream: [article("Microsoft Azure expands cloud data center CAPEX", "https://example.com/azure", "2026-07-19")] },
};
const accountSignals = buildDemandAccountSignals(accountContext, {}, now);
assert.equal(accountSignals.accountCount, 27, "all accounts must be emitted even with zero evidence");
assert.equal(accountSignals.schemaVersion, "2.1");
assert.equal(accountSignals.expectedCount, DEMAND_ACCOUNT_REGISTRY.length);
assert.equal(accountSignals.accounts.azure.evidenceCount, 1, "canonical URL duplicates must be removed");
assert.equal(accountSignals.accounts.azure.direction, "up");
assert.equal(accountSignals.accounts.china.evidenceCount, 1, "a named China cloud account plus server context must be live evidence");
assert.equal(accountSignals.accounts.china.direction, "up", "a scoped server supply contract must count as demand expansion");
assert.ok(accountSignals.accounts.china.pullScore < 75, "one source must not produce a high-confidence-looking pull score");
assert.equal(accountSignals.accounts.tesla.status, "insufficient", "one non-official source must not create a live pull score");
assert.equal(accountSignals.accounts.tesla.evidenceCount, 1, "low-confidence evidence must remain visible for review");
assert.equal(accountSignals.accounts.tesla.pullScore, null, "low-confidence evidence must not create a score");
assert.equal(accountSignals.accounts.byd.status, "live", "two independent sources may create a live signal");
assert.equal(accountSignals.accounts.byd.independentSourceCount, 2);
assert.equal(accountSignals.accounts.aws.status, "insufficient", "'flaws' must not match AWS");
assert.equal(accountSignals.accounts.aws.evidenceCount, 0, "curated seeds must never become today's live account evidence");
assert.equal(accountSignals.accounts.google.status, "insufficient", "'output' must not match TPU");
assert.equal(accountSignals.accounts.dell.status, "insufficient", "'모델' must not match Dell");
assert.equal(accountSignals.accounts.aws.pullScore, null, "missing evidence must never fall back to a static score");

const brokerLive = buildBrokerResearch([
  article(
    "Morgan Stanley raises DRAM memory semiconductor forecast",
    "https://www.reuters.com/technology/morgan-stanley-memory-forecast",
    "2026-07-20",
    "모건스탠리는 서버 수요 강세를 근거로 DRAM 메모리 반도체 전망을 상향했습니다.",
    "Reuters",
    "authoritative-media",
  ),
]);
assert.equal(brokerLive.schemaVersion, "2.0");
assert.equal(brokerLive.items.length, 1, "a current-run authoritative broker citation must be live");
assert.equal(brokerLive.items[0].observedThisRun, true);
assert.equal(brokerLive.baseline.status, "revalidation-required");
const brokerSeedOnly = buildBrokerResearch([{
  ...article("Morgan Stanley DRAM memory forecast", "https://www.reuters.com/technology/seeded-memory", "2026-07-20"),
  preservedSeed: true,
  verification: { sourceClass: "authoritative-media", origin: "curated-seed", observedThisRun: false },
}]);
assert.equal(brokerSeedOnly.items.length, 0, "curated broker material must remain outside live cards");

const liveFigures = extractLiveFigures({ news: [
  article("HBM memory capacity rises 40%", "https://news.samsung.com/global/live-figure", "2026-07-20", "HBM 메모리 생산능력이 공식 발표 기준 40% 증가했습니다.", "Samsung"),
  {
    ...article("HBM memory capacity rises 99%", "https://news.samsung.com/global/seed-figure", "2026-07-20", "HBM 메모리 생산능력이 과거 기준 99% 증가했습니다.", "Samsung"),
    preservedSeed: true,
    verification: { sourceClass: "official-primary", origin: "curated-seed", observedThisRun: false },
  },
] });
assert.ok(liveFigures.items.some((item) => item.value === "40%"));
assert.ok(!liveFigures.items.some((item) => item.value === "99%"), "curated seeds must not enter live figures");
assert.ok(liveFigures.items.every((item) => item.origin === "live-crawl" && item.observedThisRun === true));

const recentLastGood = await collectLastGood(
  async () => { throw new Error("fixture outage"); },
  { value: 123, lastSuccessAt: new Date(Date.now() - 864e5).toISOString(), failureStreak: 0 },
  "fixture:recent",
  () => "unused",
  { maxStaleDays: 3, report: false },
);
assert.equal(recentLastGood.status, "stale");
assert.equal(recentLastGood.value, 123, "a recent last-good value may survive inside its TTL");
const expiredLastGood = await collectLastGood(
  async () => { throw new Error("fixture outage"); },
  { value: 456, lastSuccessAt: new Date(Date.now() - 5 * 864e5).toISOString(), failureStreak: 2 },
  "fixture:expired",
  () => "unused",
  { maxStaleDays: 3, report: false },
);
assert.equal(expiredLastGood.status, "unavailable");
assert.equal(expiredLastGood.value, undefined, "expired stale values must not remain in the live payload");
assert.equal(expiredLastGood.expiredPrevious, true);

const relationNews = [1, 2, 3].map((index) => article(
  `SK hynix and TSMC discuss HBM4 base die collaboration ${index}`,
  `https://example.com/relation-${index}`,
  `2026-07-${16 + index}`,
));
relationNews.push(article("Duplicate canonical SK hynix and TSMC HBM4 story", "https://example.com/relation-3?utm_source=duplicate", "2026-07-20"));
relationNews.push(article("SK hynix HBM4 production update", "https://example.com/single-entity", "2026-07-20"));
const relations = buildRelationCandidates({ news: relationNews }, now, 3);
const skhyTsmc = relations.items.find((item) => new Set([item.from, item.to]).has("skhy") && new Set([item.from, item.to]).has("tsmc"));
assert.ok(skhyTsmc, "two endpoints in the same article must create a candidate");
assert.equal(skhyTsmc.evidenceCount, 3);
assert.equal(skhyTsmc.status, "promotion-review", "three unique articles must request promotion review");
assert.equal(skhyTsmc.relationEvidenceCount, 3, "promotion review must contain explicit relationship language");
assert.ok(!relations.items.some((item) => item.evidence.some((evidence) => evidence.url === "https://example.com/single-entity")), "one endpoint alone must not create a relationship");
for (const [count, expected] of [[1, "candidate"], [2, "candidate"], [3, "promotion-review"]]) {
  const boundary = buildRelationCandidates({ news: relationNews.slice(0, count) }, now, 3);
  assert.equal(boundary.items[0]?.status, expected, `relationship threshold boundary ${count}/3 must be ${expected}`);
}
const incidentalRelations = buildRelationCandidates({ news: [1, 2, 3].map((index) => article(
  `SK hynix and TSMC quarterly market results ${index}`,
  `https://incidental-${index}.example/results`,
  `2026-07-${16 + index}`,
)) }, now, 3);
assert.equal(incidentalRelations.items[0]?.status, "candidate", "co-occurrence without relationship language must never request promotion");
const threeEntityRelations = buildRelationCandidates({ news: [article(
  `SK hynix collaborates with TSMC on HBM4. ${"unrelated market commentary ".repeat(30)} Micron reports quarterly revenue.`,
  "https://example.com/three-entities",
  "2026-07-20",
)] }, now, 1);
const relationFor = (left, right) => threeEntityRelations.items.find((item) => new Set([item.from, item.to]).has(left) && new Set([item.from, item.to]).has(right));
assert.equal(relationFor("skhy", "tsmc")?.relationEvidenceCount, 1);
assert.equal(relationFor("skhy", "micron")?.relationEvidenceCount, 0, "a relationship phrase must not leak to a distant third company");

const baseline = { architectureMatrix: { tracks: [{ id: "premium-test", title: "HBM4 TSMC", thesis: "HBM4 base die collaboration expands", signals: ["HBM4", "TSMC", "base die"] }] } };
const freshness = buildBaselineFreshness(baseline, { news: relationNews }, {}, now);
assert.equal(freshness.schemaVersion, "2.3");
assert.equal(freshness.items["premium-test"].status, "current");
assert.equal(freshness.items["premium-test"].lastCheckedAt, "2026-07-20");
const staleFreshness = buildBaselineFreshness(baseline, { news: [] }, {}, now);
assert.equal(staleFreshness.items["premium-test"].status, "revalidate");
assert.equal(staleFreshness.items["premium-test"].lastCheckedAt, "2026-07-20", "the audit run date must be recorded even when evidence is absent");
assert.equal(staleFreshness.items["premium-test"].lastEvidenceAt, null);
const oldFreshness = buildBaselineFreshness(baseline, { news: [article("SK hynix and TSMC HBM4 base die collaboration expands", "https://example.com/old-baseline", "2026-07-05")] }, {}, now);
assert.equal(oldFreshness.items["premium-test"].status, "revalidate", "a daily rerun must not refresh a 15-day-old evidence clock");
assert.equal(oldFreshness.items["premium-test"].ageDays, 15);
const boundaryFreshness = buildBaselineFreshness(baseline, { news: [article("SK hynix and TSMC HBM4 base die collaboration expands", "https://example.com/boundary-baseline", "2026-07-06")] }, {}, now);
assert.equal(boundaryFreshness.items["premium-test"].status, "current", "evidence exactly 14 days old remains within the freshness window");
const conflictFreshness = buildBaselineFreshness(baseline, { news: [article("TSMC HBM4 base die collaboration declines", "https://example.com/conflict", "2026-07-20")] }, {}, now);
assert.equal(conflictFreshness.items["premium-test"].status, "conflict-candidate");
assert.equal(conflictFreshness.items["premium-test"].conflictEvidence.url, "https://example.com/conflict");
const carriedConflict = buildBaselineFreshness(baseline, { news: [] }, conflictFreshness, new Date("2026-07-21T12:00:00Z"));
assert.equal(carriedConflict.items["premium-test"].status, "conflict-candidate", "an unresolved recent conflict must survive an empty crawl");
assert.equal(carriedConflict.items["premium-test"].evidenceCount, 1, "carried freshness must retain its source link");
assert.equal(carriedConflict.items["premium-test"].conflictEvidence.url, "https://example.com/conflict");
const anchoredBaseline = { talent: [{ id: "ymtc-talent", company: "YMTC", thesis: "YMTC NAND design hiring expands", facts: ["Xtacking design team"] }] };
const unrelatedSamsung = buildBaselineFreshness(anchoredBaseline, { news: [article("Samsung NAND design hiring expands", "https://example.com/samsung-design", "2026-07-20")] }, {}, now);
assert.equal(unrelatedSamsung.items["ymtc-talent"].status, "revalidate", "company baselines require the company anchor, not generic NAND/design words");
const expandedBaseline = buildBaselineFreshness({ rows: [{
  id: "coverage-test",
  company: "TSMC",
  title: "TSMC coverage",
  thesis: "TSMC HBM4 base die collaboration expands",
  facts: ["TSMC HBM4 base die production qualification expands this quarter"],
  summary: "TSMC HBM4 base die supply and qualification are reviewed against current evidence.",
  note: "TSMC HBM4 base die schedule requires a dated source before operational use.",
  a: "TSMC HBM4 base die evidence remains subject to a fourteen day freshness gate.",
}] }, { news: relationNews }, {}, now);
for (const id of ["coverage-test", "coverage-test-fact-1", "coverage-test-summary", "coverage-test-note", "coverage-test-a"]) {
  assert.ok(expandedBaseline.items[id], `baseline field ${id} must receive its own freshness record`);
}

const officialContext = {
  news: [
    article("WSTS official semiconductor forecast expands memory outlook", "https://www.wsts.org/76/Recent-News-Release", "2026-07-18"),
    article("SIA reports global semiconductor monthly sales", "https://www.semiconductors.org/global-semiconductor-sales-test/", "2026-07-19"),
    article("Official HBM4 revenue and contract price update", "https://example.com/hbm4", "2026-07-20"),
    article("HBM4 hybrid bonding qualification advances", "https://example.com/hbm4-bonding", "2026-07-20", "公司网站介绍新一代平台打造了"),
    article("CXMT production capacity and yield hiring expands", "https://example.com/cxmt-jobs", "2026-07-20", "智联招聘为求职者提供最新招聘信息，岗位在线直招，求职找工作就上智联招聘!"),
  ],
};
const pulse = buildIndustryPulse(officialContext, now);
assert.equal(pulse.schemaVersion, "1.1");
assert.equal(pulse.connected, 2, "WSTS and SIA official domains must be monitored separately");
assert.equal(pulse.observed, 2);
const briefing = buildAgentBriefing(officialContext, { memoryMomentum: {}, liveFigures: { items: [] }, fx: {}, aiDemandProxy: {} }, now);
assert.equal(briefing.schemaVersion, "1.1");
assert.equal(briefing.roles.cfo.status, "live");
assert.match(briefing.roles.cfo.sourceUrl, /^https:\/\//);
assert.ok(briefing.roles.cfo.date);
assert.equal(briefing.roles.cto.quote, "HBM4 hybrid bonding qualification advances", "an upstream-truncated quote must fall back to a complete title");
assert.equal(briefing.roles.cto.quoteQuality, "title-fallback");
assert.equal(briefing.roles.coo.quote, "CXMT production capacity and yield hiring expands", "site boilerplate must not become an agent quote");

const priceHistory = {
  items: {
    "dram-dram-spot-price::fixture": { key: "dram-dram-spot-price::fixture", points: [
      { date: "2026-04-20", average: 80 },
      { date: "2026-06-25", average: 100 },
      { date: "2026-07-20", average: 120 },
    ] },
    "dram-dram-contract-price::must-not-mix": { key: "dram-dram-contract-price::must-not-mix", points: [
      { date: "2026-06-20", average: 10 },
      { date: "2026-07-20", average: 100 },
    ] },
  },
};
const momentum = quantMemoryMomentum(priceHistory);
assert.equal(momentum.dramSpot30dPct, 20, "nearest valid 25-day spot point must drive the 30d window");
assert.equal(momentum.coverage.dram30.spanDays, 25);
assert.equal(momentum.coverage.dram30.seriesCount, 1, "contract/module series must not be mixed into spot momentum");

const health = sourceHealthSnapshot({
  sources: {
    "yahoo:usdkrw": { id: "yahoo:usdkrw", ok: false, failureStreak: 2, lastSuccessAt: "2026-07-17T00:00:00Z" },
    "preserved:not-attempted": { id: "preserved:not-attempted", ok: true, failureStreak: 0 },
  },
}, [
  { step: "quant:FX USD/KRW", ok: false, msg: "timeout" },
  { step: "quant:AI NVIDIA", ok: true, msg: "ok" },
]);
assert.equal(health.sources["yahoo:usdkrw"].failureStreak, 3);
assert.equal(health.sources["yahoo:usdkrw"].alert, true);
assert.equal(health.sources["yahoo:nvda"].failureStreak, 0, "different providers must not share a streak");
assert.equal(health.sources["preserved:not-attempted"].attempted, false, "unattempted sources must be retained");
assert.equal(health.total, 2, "source-health denominator must include only sources attempted in this run");
assert.equal(health.ok, 1);
assert.equal(health.catalogTotal, 3, "the retained source catalog must be reported separately");
assert.equal(sourceHealthId("TrendForce차트"), "trendforce:chart");
const migratedHealth = sourceHealthSnapshot({ sources: { TrendForce차트: { id: "TrendForce차트", ok: true }, trendforce차트: { id: "trendforce차트", ok: true } } }, [
  { step: "TrendForce차트", ok: true, msg: "ok" },
]);
assert.deepEqual(Object.keys(migratedHealth.sources).filter((id) => id.toLowerCase().includes("trendforce")), ["trendforce:chart"], "case-only legacy source ids must migrate to one stable id");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appText = await readFile(resolve(root, "assets/js/app.js"), "utf8");
const refreshText = await readFile(resolve(root, "scripts/refresh-derived.mjs"), "utf8");
assert.doesNotMatch(refreshText, /sourceHealthSnapshot/, "network-free derived replay must not increment source failure streaks");
assert.match(appText, /const fresh = Number\.isFinite\(expiresAt\) && Date\.now\(\) <= expiresAt/, "derived contracts must fail closed when expiry is missing");
assert.doesNotMatch(appText, /\["2\.1",\s*"2\.0"\]|\["1\.1",\s*"1\.0"\]|\["2\.3",\s*"2\.2"\]/, "legacy derived schemas must not bypass current live-quality gates");
const accountBlock = appText.match(/const FORECAST_CATEGORIES = \[[\s\S]*?const FORECAST_CATEGORY_ORDER/)?.[0] || "";
assert.ok(accountBlock, "forecast category block must exist");
assert.doesNotMatch(accountBlock, /\b(?:driver|pull|note)\s*:/, "account cards must not contain static direction, pull, or narrative fallbacks");
assert.doesNotMatch(accountBlock, /\baccounts\s*:/, "the UI must consume the generated 27-account registry instead of duplicating it");
assert.doesNotMatch(appText, /account\.(?:tech|region)\b/, "account cards must not render unsourced static technology or region fields");

const dailyGroundingBlock = appText.slice(
  appText.indexOf("function withDailyAgentEvidence"),
  appText.indexOf("function buildDailyBriefingMessage"),
);
assert.ok(dailyGroundingBlock, "daily agent evidence mapper must exist");
assert.doesNotMatch(dailyGroundingBlock, /\.slice\s*\(/, "agent evidence quotes must not be cut to a fixed character count");
assert.doesNotMatch(dailyGroundingBlock, /agent\.message/, "daily agent turns must replace, not append to, static template bodies");
assert.ok((appText.match(/withDailyAgentEvidence\(/g) || []).length >= 4, "all three agent-turn render paths must apply daily live evidence");

const manualEdgesBlock = appText.slice(
  appText.indexOf("function memoryMarketEdges()"),
  appText.indexOf("function memoryMarketCandidateEdges"),
);
assert.ok(manualEdgesBlock, "manual value-chain edge block must exist");
assert.equal((manualEdgesBlock.match(/\bid\s*:/g) || []).length, 64, "the reviewed manual value-chain baseline must remain exactly 64 edges");
assert.match(appText, /function memoryMarketAllEdges\(\)[\s\S]*memoryMarketCandidateEdges\(manual\)/, "live relation candidates must be merged with the manual baseline");
assert.match(appText, /edge\.candidate[^\n]*\?\s*"2 7"/, "live relation candidates must render as dotted edges");
assert.match(appText, /if \(edge\.candidate\) return "↔"/, "co-occurrence candidates must remain direction-neutral in text");
assert.match(appText, /livePairEvidenceCount/, "manual relationships must expose their live co-occurrence revalidation count");

console.log("live pipeline tests passed");
