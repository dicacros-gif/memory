#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEMAND_ACCOUNT_REGISTRY,
  STRATEGY_ACCOUNT_REGISTRY,
  RELATION_ENTITY_REGISTRY,
  buildAgentBriefing,
  buildBaselineFreshness,
  buildDemandAccountSignals,
  buildStrategyAccountIntelligence,
  buildIndustryPulse,
  buildRelationCandidates,
} from "./live-pipeline.mjs";
import {
  buildBrokerResearch,
  checkOfficialIndustryProbe,
  collectLastGood,
  extractLiveFigures,
  fetchSourceTextWithRetry,
  normalizeYahooStockResult,
  quantMemoryMomentum,
  selectFreshestYahooStockResult,
  siaMonthlyPdfFallbackUrls,
  sourceHealthId,
  sourceHealthSnapshot,
} from "./crawl.mjs";

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
assert.equal(STRATEGY_ACCOUNT_REGISTRY.filter((item) => item.focus !== false).length, 13, "strategy account registry must expose all thirteen focus accounts");
assert.ok(STRATEGY_ACCOUNT_REGISTRY.some((item) => item.id === "microsoft" && item.aliases.includes("maia 200")), "Maia must be an explicit account lens");
assert.ok(STRATEGY_ACCOUNT_REGISTRY.some((item) => item.id === "broadcom" && item.layer === "asic-partner" && item.servesAccounts.includes("openai")), "Broadcom must roll up its end customers as an ASIC partner");
assert.ok(STRATEGY_ACCOUNT_REGISTRY.some((item) => item.id === "marvell" && item.layer === "asic-partner" && item.servesAccounts.includes("microsoft") && item.servesAccounts.includes("aws")), "Marvell must roll up Microsoft and AWS as downstream customers");
assert.equal(new Set(DEMAND_ACCOUNT_REGISTRY.map((item) => item.id)).size, 27, "demand account ids must be unique");
assert.equal(new Set(RELATION_ENTITY_REGISTRY.map((item) => item.id)).size, RELATION_ENTITY_REGISTRY.length, "relation entity ids must be unique");

const accountContext = {
  news: [
    article("Microsoft Azure expands cloud data center CAPEX", "https://example.com/azure", "2026-07-19"),
    article("微软扩大 Azure 人工智能数据中心投资", "https://news-two.example/azure-cn", "2026-07-18", "微软扩大 Azure 人工智能数据中心投资并增加服务器需求", "News Two", "news"),
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
assert.equal(accountSignals.accounts.azure.evidenceCount, 2, "canonical URL duplicates must be removed while multilingual evidence remains");
assert.equal(accountSignals.accounts.azure.direction, "up");
assert.equal(accountSignals.accounts.azure.independentSourceCount, 2, "Microsoft's Chinese name must resolve to the Azure account");
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

const strategyAccountIntelligence = buildStrategyAccountIntelligence({
  news: [
    article("NVIDIA Vera Rubin platform expands rack-scale AI", "https://official.example/nvidia", "2026-07-19"),
    article("Microsoft Maia 200 expands inference infrastructure", "https://official.example/maia", "2026-07-18"),
    article("AWS Trainium capacity expands", "https://official.example/trainium", "2026-07-17"),
    article("Google TPU bandwidth and HBM capacity rise as Broadcom package qualification advances", "https://official.example/google-memory", "2026-07-19"),
    article("Google TPU v7 Ironwood delivers 192GB HBM3E and 7.37TB/s bandwidth", "https://cloud.google.com/tpu/spec-v7", "2026-07-19", undefined, "Google Cloud"),
    article("Google TPU chiplet UCIe advanced packaging roadmap", "https://cloud.google.com/tpu/chiplet-package", "2026-07-19", undefined, "Google Cloud"),
    article("Meta MTIA chiplet UCIe advanced packaging roadmap", "https://ai.meta.com/mtia/chiplet-package", "2026-07-18", undefined, "Meta AI"),
    article("Google TPU dual-source Samsung supplier agreement expands under a multi-year capacity commitment", "https://official.example/google-deal", "2026-07-19"),
    article("Meta MTIA pricing and one-stop foundry packaging cost drive supplier review", "https://news.example/meta-risk", "2026-07-18", undefined, "Industry News", "news"),
    article("Tesla robotics physical AI memory platform expands", "https://official.example/tesla-robotics", "2026-07-19"),
    article("Tesla robotics physical AI memory deployment", "https://second.example/tesla-robotics", "2026-07-18", undefined, "Second Source", "news"),
  ],
  decisionIntelligence: { claimEvents: { events: [{
    ruleId: "partner-codesign", claimType: "verified-fact", contradictionStatus: "clear",
    entity: { label: "Microsoft Maia 200" }, product: { label: "Custom HBM" },
    stage: { id: "QUALIFICATION" }, sourceId: "microsoft-ai-infra",
    sourceUrl: "https://official.example/maia-custom-hbm", asOf: "2026-07-18",
    evidenceSpan: "Microsoft Maia 200 Custom HBM co-design qualification",
  }] } },
}, {}, now);
assert.equal(strategyAccountIntelligence.focusAccountCount, 13);
assert.equal(strategyAccountIntelligence.accountCount, STRATEGY_ACCOUNT_REGISTRY.length);
assert.equal(strategyAccountIntelligence.accounts.microsoft.mentions, 1, "Maia evidence must map to Microsoft account");
assert.equal(strategyAccountIntelligence.accounts.nvidia.mentions, 1, "Rubin evidence must map to NVIDIA account");
assert.equal(strategyAccountIntelligence.accounts.microsoft.customHbmStage.id, "QUALIFICATION", "verified account co-design evidence must promote the Custom HBM stage");
assert.equal(strategyAccountIntelligence.accounts.google.customHbmStage.id, "UNVERIFIED", "an account without direct Custom HBM evidence must remain unverified");
assert.equal(strategyAccountIntelligence.supplierMatrix.rows.length, 13, "supplier matrix must cover every focus account");
const supplierCells = strategyAccountIntelligence.supplierMatrix.rows.flatMap((row) => row.cells);
assert.ok(supplierCells.every((cell) => cell.claim !== "verified-fact"), "reported supplier relations must never be promoted to official facts");
assert.ok(supplierCells.some((cell) => cell.status === "unconfirmed"), "missing supplier relations must remain fail closed");
assert.equal(strategyAccountIntelligence.demandMix.externalEstimate.status, "separate-source-required", "crawl mix and external estimates must remain separate");
assert.equal(strategyAccountIntelligence.schemaVersion, "2.0");
assert.deepEqual(strategyAccountIntelligence.layerSummary.map((item) => item.id), ["asic-partner", "end-customer", "foundry-package"]);
assert.ok(strategyAccountIntelligence.accounts.google.painAxes.find((item) => item.id === "bandwidth").mentions >= 1, "account alias plus technical term must classify bandwidth pain");
assert.ok(strategyAccountIntelligence.accounts.meta.whyLost.find((item) => item.id === "pricing").mentions >= 1, "why-lost signals must be account scoped");
assert.equal(strategyAccountIntelligence.accounts.google.generationProgression.status, "measured");
assert.equal(strategyAccountIntelligence.accounts.google.generationProgression.bandwidthMultiplier, 2.67);
assert.ok(strategyAccountIntelligence.partnerRollups.some((item) => item.partnerId === "broadcom" && item.accountIds.includes("openai")));
assert.ok(strategyAccountIntelligence.deals.events.some((item) => item.accountId === "google" && item.eventType === "capacity-commitment"));
assert.ok(strategyAccountIntelligence.supplierMatrix.alerts.some((item) => item.accountId === "google" && item.supplierId === "samsung" && item.changeType === "dual-source"));
assert.ok(strategyAccountIntelligence.supplierMatrix.alerts.every((item) => item.id?.startsWith("supplier:")), "supplier changes must carry stable event ids for diffing and alerts");
assert.ok(strategyAccountIntelligence.deals.events.every((item) => item.id?.startsWith("deal:")), "deal events must carry stable ids for weekly diffing");
assert.ok(strategyAccountIntelligence.supplierMatrix.alerts.every((item) => /^https:\/\//.test(item.sourceUrl || "") && ["official-fact", "market-estimate"].includes(item.status)), "supplier alerts must retain source links and claim grades when UI governance labels are hidden");
assert.ok(strategyAccountIntelligence.deals.events.every((item) => /^https:\/\//.test(item.sourceUrl || "") && ["reported", "confirmed", "filing"].includes(item.evidenceStage)), "deal events must retain source links and evidence stages when UI governance labels are hidden");
assert.equal(strategyAccountIntelligence.applicationSignals.find((item) => item.id === "robotics").promotionStatus, "ai-d-e-opportunity");
assert.ok(strategyAccountIntelligence.accounts.tesla.applicationOpportunityTags.includes("ai-d-e"), "application signals must promote an account-level AI-D E opportunity tag");
assert.ok(strategyAccountIntelligence.generationCandidates.some((item) => item.accountId === "google" && item.status === "pending-review" && item.capacityGb === 192), "official product specifications must enter the pending-review gate");
assert.ok(strategyAccountIntelligence.technologyOpportunities.some((item) => item.id === "advanced-package-chiplet" && item.status === "opportunity-candidate"), "two independent technology sources must promote an opportunity candidate");
assert.ok(strategyAccountIntelligence.horizonPortfolio.find((item) => item.horizon === "H2")?.items.some((item) => item.id === "advanced-package-chiplet"), "promoted technology candidates must enter the configured Three Horizons queue");
assert.ok(strategyAccountIntelligence.whatChanged.items.some((item) => item.kind === "supplier-change"), "the weekly brief must surface newly detected supplier changes");
assert.ok(strategyAccountIntelligence.whatChanged.items.some((item) => item.kind === "deal-event"), "the weekly brief must surface newly detected deal events");
assert.ok(strategyAccountIntelligence.executiveOnePagers.some((item) => item.accountId === "google" && item.topPainAxes.length));

const nvidiaRelationshipIntelligence = buildStrategyAccountIntelligence({ news: [
  article(
    "NVIDIA invested in Marvell through a strategic partnership for NVLink Fusion",
    "https://investor.marvell.com/sec-filings/all-sec-filings/content/0001193125-26-134462/d113606d8k.htm",
    "2026-03-31",
    "NVIDIA invested in Marvell and the companies formed a strategic partnership for NVLink Fusion custom silicon",
    "Marvell SEC Filing",
    "filing",
  ),
] }, {}, new Date("2026-04-01T12:00:00Z"));
const googleRelationshipIntelligence = buildStrategyAccountIntelligence({ news: [
  article(
    "Google and Marvell sign commercial agreement for custom semiconductor products",
    "https://investor.marvell.com/sec-filings/all-sec-filings/content/0001193125-26-356217/d412696d8k.htm",
    "2026-08-19",
    "Google and Marvell expand partnership for custom products, memory interface controllers and near-memory compute with a purchase-linked warrant",
    "Marvell SEC Filing",
    "filing",
  ),
] }, {}, new Date("2026-08-20T12:00:00Z"));
assert.ok(nvidiaRelationshipIntelligence.ecosystemRelationships.promoted.some((item) => item.type === "investment" && [item.from, item.to].includes("nvidia") && [item.from, item.to].includes("marvell")), "an official NVIDIA–Marvell investment filing must promote a typed ecosystem relation");
assert.ok(googleRelationshipIntelligence.ecosystemRelationships.promoted.some((item) => item.type === "partnership" && [item.from, item.to].includes("google") && [item.from, item.to].includes("marvell")), "an official Google–Marvell custom silicon agreement must promote a typed ecosystem relation");
assert.ok([...nvidiaRelationshipIntelligence.ecosystemRelationships.promoted, ...googleRelationshipIntelligence.ecosystemRelationships.promoted].every((item) => item.sourceUrl && item.officialEvidenceCount >= 1), "promoted ecosystem relations must retain their filing link and promotion evidence");

const risingPainIntelligence = buildStrategyAccountIntelligence({ news: [
  article("Google TPU HBM bandwidth update", "https://week-one.example/google-bandwidth-1", "2026-07-01"),
  article("Google TPU HBM bandwidth expansion", "https://week-two.example/google-bandwidth-1", "2026-07-08"),
  article("Google TPU HBM bandwidth roadmap", "https://week-two-b.example/google-bandwidth-2", "2026-07-09"),
  article("Google TPU HBM bandwidth qualification", "https://week-three.example/google-bandwidth-1", "2026-07-15"),
  article("Google TPU HBM bandwidth package", "https://week-three-b.example/google-bandwidth-2", "2026-07-16"),
  article("Google TPU HBM bandwidth capacity", "https://week-three-c.example/google-bandwidth-3", "2026-07-17"),
] }, {}, new Date("2026-07-19T12:00:00Z"));
assert.ok(risingPainIntelligence.painAlerts.some((item) => item.accountId === "google" && item.axisId === "bandwidth"), "two consecutive weekly increases must trigger an account pain alert");

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
assert.equal(brokerLive.schemaVersion, "2.1");
assert.equal(brokerLive.items.length, 1, "a current-run authoritative broker citation must be live");
assert.equal(brokerLive.items[0].observedThisRun, true);
assert.equal(brokerLive.currentRunCount, 1);
assert.equal(brokerLive.accumulatedCount, 1);
assert.equal(brokerLive.baseline.status, "revalidation-required");
assert.equal(brokerLive.baseline.documentCount, 2, "both supplied source documents must remain visible");
assert.equal(brokerLive.baseline.documents.length, 2, "the supplied source digest must preserve both documents");
assert.equal(brokerLive.baseline.items.length, 9, "all extracted report topics must remain visible as a separate revalidation baseline");
assert.ok(brokerLive.baseline.items.every((item) => brokerLive.baseline.documents.some((document) => document.id === item.documentId)), "every supplied report topic must link back to one source document");
assert.ok(brokerLive.baseline.items.every((item) => item.dataStatus === "baseline-revalidation" && item.sourceUrl === null), "baseline reports must never masquerade as public live citations");
const brokerSeedOnly = buildBrokerResearch([{
  ...article("Morgan Stanley DRAM memory forecast", "https://www.reuters.com/technology/seeded-memory", "2026-07-20"),
  preservedSeed: true,
  verification: { sourceClass: "authoritative-media", origin: "curated-seed", observedThisRun: false },
}]);
assert.equal(brokerSeedOnly.items.length, 0, "curated broker material must remain outside live cards");

const accumulatedBroker = buildBrokerResearch([], brokerLive);
assert.equal(accumulatedBroker.schemaVersion, "2.1");
assert.equal(accumulatedBroker.items.length, 1, "a later empty crawl must preserve previously verified broker citations");
assert.equal(accumulatedBroker.currentRunCount, 0, "an empty crawl must not relabel historical citations as newly observed");
assert.equal(accumulatedBroker.accumulatedCount, 1);
assert.equal(accumulatedBroker.items[0].observedThisRun, false);
assert.equal(accumulatedBroker.items[0].sourceUrl, brokerLive.items[0].sourceUrl);
const refreshedBroker = buildBrokerResearch([
  article(
    "Morgan Stanley raises DRAM memory semiconductor forecast",
    "https://www.reuters.com/technology/morgan-stanley-memory-forecast",
    "2026-07-20",
    "모건스탠리는 서버 수요 강세를 근거로 DRAM 메모리 반도체 전망을 상향했습니다.",
    "Reuters",
    "authoritative-media",
  ),
], accumulatedBroker);
assert.equal(refreshedBroker.items.length, 1, "a repeated canonical broker URL must update rather than duplicate the archive");
assert.equal(refreshedBroker.currentRunCount, 1);
assert.equal(refreshedBroker.items[0].firstObservedAt, accumulatedBroker.items[0].firstObservedAt);

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

const normalizedStock = normalizeYahooStockResult({
  meta: { symbol: "005930.KS", currency: "KRW", exchangeTimezoneName: "Asia/Seoul" },
  timestamp: [1785193200, 1785279600],
  indicators: { quote: [{ close: [220000, 208500] }] },
}, {
  expectedCurrency: "KRW",
  now: new Date("2026-07-29T12:00:00Z"),
});
assert.equal(normalizedStock.latestClose, 208500, "latest stock close must stay aligned with its timestamp");
assert.equal(normalizedStock.prevClose, 220000);
assert.equal(normalizedStock.changePct, -5.23);
assert.equal(normalizedStock.currency, "KRW");
assert.equal(normalizedStock.sourceStatus, "current");
assert.match(normalizedStock.asOf, /^2026-07-2[78]T/, "stock quotes must expose their market observation date");
assert.throws(
  () => normalizeYahooStockResult({
    meta: { symbol: "005930.KS", currency: "USD" },
    timestamp: [1785193200, 1785279600],
    indicators: { quote: [{ close: [220000, 208500] }] },
  }, { expectedCurrency: "KRW", now: new Date("2026-07-29T12:00:00Z") }),
  /통화 불일치/,
  "a cross-market currency mismatch must not enter the stock widget",
);
const staleStock = normalizeYahooStockResult({
  meta: { symbol: "MU", currency: "USD" },
  timestamp: [1784415600, 1784502000],
  indicators: { quote: [{ close: [900.2, 820.53] }] },
}, { expectedCurrency: "USD", now: new Date("2026-07-29T12:00:00Z") });
assert.equal(staleStock.sourceStatus, "stale", "old Yahoo observations must remain visible only as stale data");
const freshestStock = selectFreshestYahooStockResult([
  {
    url: "https://query2.finance.yahoo.com/stale",
    result: {
      meta: { symbol: "MU", currency: "USD" },
      timestamp: [1785187800, 1785274200],
      indicators: { quote: [{ close: [920.95, 900.2] }] },
    },
  },
  {
    url: "https://query1.finance.yahoo.com/current",
    result: {
      meta: { symbol: "MU", currency: "USD" },
      timestamp: [1785274200, 1785360600],
      indicators: { quote: [{ close: [900.2, 820.53] }] },
    },
  },
], { symbol: "MU", expectedCurrency: "USD", now: new Date("2026-07-29T14:00:00Z") });
assert.equal(freshestStock.latestClose, 820.53, "the newest Yahoo host observation must win over a stale successful response");
assert.equal(freshestStock.prevClose, 900.2);
assert.equal(freshestStock.changePct, -8.85);
assert.equal(freshestStock.quoteCandidates, 2);
assert.match(freshestStock.quoteSource, /query1/);
const completedCloseOnly = normalizeYahooStockResult({
  meta: {
    symbol: "MU",
    currency: "USD",
    currentTradingPeriod: {
      regular: { start: 1785331800, end: 1785355200 },
    },
  },
  timestamp: [1785187800, 1785274200, 1785331800],
  indicators: { quote: [{ close: [900.2, 820.53, 837.58] }] },
}, { expectedCurrency: "USD", now: new Date("2026-07-29T14:00:00Z") });
assert.equal(completedCloseOnly.latestClose, 820.53, "an in-progress daily bar must not be published as a closing price");
assert.equal(completedCloseOnly.prevClose, 900.2);
assert.equal(completedCloseOnly.priceType, "completed-close");

const officialProbeCalls = [];
const recoveredOfficialProbe = await checkOfficialIndustryProbe({
  id: "official-test",
  url: "https://official.example/primary",
  pattern: /verified official marker/i,
}, {
  fetchImpl: async (url, init) => {
    officialProbeCalls.push({ url, headers: init.headers });
    const attempt = officialProbeCalls.length;
    return {
      ok: attempt === 2,
      status: attempt === 2 ? 200 : 403,
      url,
      text: async () => attempt === 2 ? "verified official marker" : "temporary access block",
    };
  },
  sleepImpl: async () => {},
  signalFactory: () => undefined,
});
assert.equal(recoveredOfficialProbe.reachable, true, "a transient official 403 must receive a bounded retry before health fails");
assert.equal(recoveredOfficialProbe.attempts.length, 2);
assert.equal(officialProbeCalls[1].headers["Cache-Control"], "no-cache", "the retry must bypass a stale edge-cache response");
assert.ok(officialProbeCalls[1].headers.Referer, "the retry must use a same-origin browser referer");

let thirdAttemptProbeCalls = 0;
const thirdAttemptOfficialProbe = await checkOfficialIndustryProbe({
  id: "official-third-attempt-test",
  url: "https://official.example/intermittent",
  retryAttempts: 3,
  pattern: /verified official marker/i,
}, {
  fetchImpl: async (url) => {
    thirdAttemptProbeCalls += 1;
    return {
      ok: thirdAttemptProbeCalls === 3,
      status: thirdAttemptProbeCalls === 3 ? 200 : 503,
      url,
      text: async () => thirdAttemptProbeCalls === 3 ? "verified official marker" : "temporary upstream failure",
    };
  },
  sleepImpl: async () => {},
  signalFactory: () => undefined,
});
assert.equal(thirdAttemptOfficialProbe.reachable, true, "a probe configured for three attempts must recover on its final bounded retry");
assert.equal(thirdAttemptProbeCalls, 3);

const fallbackOfficialProbe = await checkOfficialIndustryProbe({
  id: "official-fallback-test",
  url: "https://official.example/primary",
  fallbackUrls: ["https://official.example/fallback"],
  pattern: /verified official marker/i,
}, {
  fetchImpl: async (url) => ({
    ok: true,
    status: 200,
    url,
    text: async () => url.endsWith("fallback") ? "verified official marker" : "page moved",
  }),
  sleepImpl: async () => {},
  signalFactory: () => undefined,
});
assert.equal(fallbackOfficialProbe.reachable, true, "a declared first-party fallback may recover a moved index page");
assert.equal(fallbackOfficialProbe.fallbackUsed, true);
assert.equal(fallbackOfficialProbe.attempts.length, 2, "a non-matching primary page must move to the fallback without counting it as live");

const originalPublisherProbe = await checkOfficialIndustryProbe({
  id: "official-mirrored-article-test",
  url: "https://official.example/republished-article",
  fallbackUrls: ["https://publisher.example/original-article"],
  pattern: /57\.9\s*billion|6\.69\s*billion/i,
}, {
  fetchImpl: async (url) => ({
    ok: !url.includes("official.example"),
    status: url.includes("official.example") ? 403 : 200,
    url,
    text: async () => url.includes("official.example")
      ? "temporary access block"
      : "The offering is expected to raise 57.9 billion and issue 6.69 billion shares.",
  }),
  sleepImpl: async () => {},
  signalFactory: () => undefined,
});
assert.equal(originalPublisherProbe.reachable, true, "the original publisher may verify an article mirrored by a blocked official page");
assert.equal(originalPublisherProbe.fallbackUsed, true);
assert.equal(originalPublisherProbe.verifiedUrl, "https://publisher.example/original-article");

const siaFallbackCalls = [];
const siaJsonRecovery = await checkOfficialIndustryProbe({
  id: "official-sia-test",
  url: "https://www.semiconductors.org/news-events/latest-news/",
  fallbackUrls: [
    "https://www.semiconductors.org/wp-json/wp/v2/search?search=Global%20Semiconductor%20Sales&per_page=5",
    "https://www.semiconductors.org/feed/",
  ],
  pattern: /Global Semiconductor Sales/i,
}, {
  fetchImpl: async (url, init) => {
    siaFallbackCalls.push({ url, headers: init.headers });
    const isJson = url.includes("/wp-json/");
    return {
      ok: isJson,
      status: isJson ? 200 : 403,
      url,
      text: async () => isJson ? '[{"title":"Global Semiconductor Sales Increase"}]' : "temporary access block",
    };
  },
  sleepImpl: async () => {},
  signalFactory: () => undefined,
});
assert.equal(siaJsonRecovery.reachable, true, "SIA should recover through its first-party JSON search when the HTML index returns 403");
assert.equal(siaJsonRecovery.fallbackUsed, true);
assert.match(siaFallbackCalls.at(-1).headers.Accept, /application\/json/, "the SIA JSON fallback should request JSON explicitly");

const siaPdfUrls = siaMonthlyPdfFallbackUrls(new Date("2026-07-25T00:00:00Z"));
assert.equal(
  siaPdfUrls[0],
  "https://www.semiconductors.org/wp-content/uploads/2026/07/May-2026-GSR-Table-and-Graph.pdf",
  "the rolling SIA fallback should point at the latest expected monthly table",
);
const siaPdfCalls = [];
const siaPdfRecovery = await checkOfficialIndustryProbe({
  id: "official-sia-pdf-test",
  url: "https://www.semiconductors.org/news-events/latest-news/",
  fallbackUrls: ["https://www.semiconductors.org/feed/"],
  pdfFallbackUrls: siaPdfUrls,
  pattern: /Global Semiconductor Sales/i,
}, {
  fetchImpl: async (url, init) => {
    siaPdfCalls.push({ url, headers: init.headers });
    const isLatestPdf = url === siaPdfUrls[0];
    return {
      ok: isLatestPdf,
      status: isLatestPdf ? 200 : 403,
      url,
      text: async () => isLatestPdf ? `%PDF-1.7\n${"0".repeat(800)}` : "temporary access block",
    };
  },
  sleepImpl: async () => {},
  signalFactory: () => undefined,
});
assert.equal(siaPdfRecovery.reachable, true, "SIA should recover through its current first-party monthly PDF when HTML endpoints are blocked");
assert.equal(siaPdfRecovery.verifiedFormat, "pdf");
assert.match(siaPdfCalls.at(-1).headers.Accept, /application\/pdf/, "the SIA PDF fallback should request PDF explicitly");

let chinaInfraFetchAttempts = 0;
const chinaInfraRecovery = await fetchSourceTextWithRetry({
  url: "https://official.example/wuxi",
  retryAttempts: 3,
}, {
  fetchTextImpl: async () => {
    chinaInfraFetchAttempts += 1;
    if (chinaInfraFetchAttempts === 1) throw new Error("fetch failed");
    return "official Wuxi source body";
  },
  sleepImpl: async () => {},
});
assert.equal(chinaInfraRecovery.html, "official Wuxi source body");
assert.equal(chinaInfraRecovery.attempts, 2, "a transient source transport failure must recover before it reaches source health");

const chinaInfraFallbackCalls = [];
const chinaInfraFallback = await fetchSourceTextWithRetry({
  url: "https://primary.example/wuxi",
  fallbackUrls: ["https://fallback.example/wuxi"],
}, {
  fetchTextImpl: async (url) => {
    chinaInfraFallbackCalls.push(url);
    if (url.includes("primary")) throw new Error("HTTP 403");
    return "fallback Wuxi source body";
  },
  sleepImpl: async () => {},
});
assert.deepEqual(chinaInfraFallbackCalls, ["https://primary.example/wuxi", "https://fallback.example/wuxi"]);
assert.equal(chinaInfraFallback.url, "https://fallback.example/wuxi");
assert.equal(chinaInfraFallback.attempts, 2, "a blocked primary source should recover through its curated authority fallback");

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
assert.equal(freshness.schemaVersion, "3.0");
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
const numericBaseline = { kpis: [{
  id: "wsts-market-value",
  label: "WSTS 2026 semiconductor forecast",
  source: "WSTS",
  note: "WSTS 2026 semiconductor forecast is $1.51T and memory growth is 90%.",
}] };
const genericSameSource = buildBaselineFreshness(numericBaseline, { news: [article(
  "WSTS semiconductor forecast can change in 2026",
  "https://example.com/wsts-generic",
  "2026-07-20",
)] }, {}, now);
const genericSameSourceItem = genericSameSource.items["wsts-market-value-note"];
assert.equal(genericSameSourceItem.status, "revalidate", "source and generic English words must not corroborate a quantitative claim");
assert.equal(genericSameSourceItem.evidenceCount, 0, "related evidence without the configured numbers must not refresh freshness");
assert.equal(genericSameSourceItem.relatedEvidenceCount, 1, "related but numerically unmatched evidence remains reviewable");
const exactNumericSource = buildBaselineFreshness(numericBaseline, { news: [article(
  "WSTS 2026 semiconductor forecast reaches $1.51T with memory growth of 90%",
  "https://example.com/wsts-exact",
  "2026-07-20",
)] }, {}, now);
assert.equal(exactNumericSource.items["wsts-market-value-note"].status, "current", "same source, metric, period and every numeric token may refresh the claim");
assert.deepEqual(exactNumericSource.items["wsts-market-value-note"].evidence[0].matchedQuantTokens.sort(), ["$1.51t", "90%"].sort());
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
assert.equal(health.sources["fx:usdkrw"].failureStreak, 3, "legacy Yahoo FX streak must migrate to the provider-neutral FX id");
assert.equal(health.sources["fx:usdkrw"].alert, true);
assert.equal(health.sources["yahoo:usdkrw"], undefined, "migrated legacy FX id must not remain as a duplicate");
assert.equal(health.sources["yahoo:nvda"].failureStreak, 0, "different providers must not share a streak");
assert.equal(health.sources["preserved:not-attempted"].attempted, false, "unattempted sources must be retained");
assert.equal(health.total, 2, "source-health denominator must include only sources attempted in this run");
assert.equal(health.ok, 1);
assert.equal(health.catalogTotal, 3, "the retained source catalog must be reported separately");
assert.deepEqual(health.alerts, ["fx:usdkrw"], "only failures attempted in the current run may raise an active alert");
const mixedHealth = sourceHealthSnapshot({}, [
  { step: "뉴스원문요약", ok: true, msg: "4/7건 원문 메타 확보" },
  { step: "뉴스원문요약", ok: false, msg: "0/1건 원문 메타 확보" },
]);
assert.equal(mixedHealth.sources["뉴스원문요약"].ok, true, "a multi-batch source must remain available when at least one batch succeeds");
assert.equal(mixedHealth.sources["뉴스원문요약"].status, "degraded", "partial batch failure must remain visible without becoming a full outage");
assert.equal(mixedHealth.sources["뉴스원문요약"].failureStreak, 0, "partial batch failure must not extend the full-source failure streak");
assert.deepEqual(mixedHealth.failed, [], "degraded multi-batch sources must not be reported as fully failed");
assert.deepEqual(mixedHealth.degraded, ["뉴스원문요약"], "degraded channel ids must be exposed for transparent UI reporting");
const inactiveAlert = sourceHealthSnapshot({ sources: {
  "old:provider": { id: "old:provider", failureStreak: 4, alert: true },
} }, []);
assert.deepEqual(inactiveAlert.alerts, [], "a retained but unattempted source must not remain an active incident");
assert.equal(sourceHealthId("TrendForce차트"), "trendforce:chart");
const migratedHealth = sourceHealthSnapshot({ sources: { TrendForce차트: { id: "TrendForce차트", ok: true }, trendforce차트: { id: "trendforce차트", ok: true } } }, [
  { step: "TrendForce차트", ok: true, msg: "ok" },
]);
assert.deepEqual(Object.keys(migratedHealth.sources).filter((id) => id.toLowerCase().includes("trendforce")), ["trendforce:chart"], "case-only legacy source ids must migrate to one stable id");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appText = await readFile(resolve(root, "assets/js/app.js"), "utf8");
const stylesText = await readFile(resolve(root, "assets/css/styles.css"), "utf8");
const indexText = await readFile(resolve(root, "index.html"), "utf8");
const crawlText = await readFile(resolve(root, "scripts/crawl.mjs"), "utf8");
const refreshText = await readFile(resolve(root, "scripts/refresh-derived.mjs"), "utf8");
const workflowText = await readFile(resolve(root, ".github/workflows/pages.yml"), "utf8");
assert.doesNotMatch(refreshText, /sourceHealthSnapshot/, "network-free derived replay must not increment source failure streaks");
assert.match(appText, /const fresh = Number\.isFinite\(expiresAt\) && Date\.now\(\) <= expiresAt/, "derived contracts must fail closed when expiry is missing");
assert.doesNotMatch(appText, /\["2\.1",\s*"2\.0"\]|\["1\.1",\s*"1\.0"\]|\["2\.3",\s*"2\.2"\]/, "legacy derived schemas must not bypass current live-quality gates");
assert.doesNotMatch(appText, /이전 실행 기사를 라이브 카드로 대체하지 않습니다/, "empty broker cards must fall back to previous verified information instead of showing an internal guardrail");
assert.doesNotMatch(appText, /오늘 .*에 연결된 직접 근거가 없어 판단을 보류합니다/, "agent turns must fall back to previous collected briefing instead of exposing an internal hold message");
assert.match(appText, /dataStatus:\s*"reference-only"[\s\S]*?referenceOrigin:\s*item\.referenceOrigin \|\| "previous-verified-run"/, "previous-run broker citations must retain explicit reference-only provenance");
assert.match(appText, /function cLevelCrawledAgentAxes\(\)/, "crawled agent evidence must be able to add executive agenda items");
assert.match(appText, /cLevelDecisionAxes\(\)\.concat\(cLevelCrawledAgentAxes\(\)\)/, "executive agenda list must include crawled agent agendas");
assert.match(appText, /function newsActionLine\(item, category\)/, "news cards must include a third action/check line");
assert.match(appText, /return unique\.slice\(0, 3\);/, "news card insight summaries must render as three lines");
assert.match(crawlText, /function intelligenceBriefTranslationItems\(briefs = \[\], items = \[\]\)/, "translation must prioritize evidence used by executive briefings");
assert.match(crawlText, /KO_BRIEF_TRANSLATION_RESERVE_MS/, "executive briefing translation must retain a bounded final budget");
assert.match(crawlText, /auditTranslationFidelity/, "translated numerical and currency tokens must be audited before publication");
assert.match(crawlText, /periodChangeValidation = assessPriceChange/, "derived price moves must carry an outlier review state");
assert.match(crawlText, /priceVerification:/, "crawl audit must disclose price-source cross-check coverage");
assert.match(crawlText, /method: "deterministic-template"/, "generated briefs must declare that no LLM authored them");
assert.match(crawlText, /summaryLanguage: intelligenceSummaryLanguage\(top\)/, "briefings must disclose when the source-language summary is shown");
assert.match(appText, /brief\.latest\.summaryLanguage === "source-original" \? "원문 요약"/, "the UI must visibly label source-language fallback summaries");
assert.match(crawlText, /export function buildClientDataBundle/, "crawler must create a compact browser data bundle from the verified DB");
assert.match(crawlText, /retained previous verified bundle/, "a failed quality gate must keep the previous verified bundle instead of failing the automation");
assert.match(appText, /function loadDataManifest\(\)/, "browser must load the small manifest before versioned data artifacts");
assert.match(appText, /function loadManagedJSON\(/, "browser must cache immutable same-run data artifacts");
assert.match(appText, /function pricePeriodChangeState\(/, "client price displays must suppress review-required outliers");
assert.match(appText, /function evidenceClaimDisplayLabel\(/, "client claim labels must distinguish reported evidence from first-party facts");
assert.doesNotMatch(appText, /ADMIN_DELETE_PASSWORD/, "static browser code must not contain an administrator password");
assert.match(appText, /function researchEvidenceInfographic\(/, "research citations must default to an evidence infographic rather than a long row list");
assert.match(appText, /data-research-citation-toggle/, "full research chronology must remain available behind an explicit disclosure");
assert.match(stylesText, /\.ni-research-map\s*\{/, "research evidence map must receive a diagram layout");
assert.match(appText, /function storedAgentEvidence\(/, "agents must be able to continue from retained collected evidence");
assert.match(appText, /dailyReferenceNewsEvidence\(roleKey\) \|\| storedAgentEvidence\(roleKey\)/, "stored evidence must follow prior agent and reference-news evidence in the fallback chain");
assert.match(appText, /function ceoChallengeQuestionBriefHTML\(/, "CEO challenge must expose the selected question and live evidence context before the debate");
assert.match(appText, /function ceoChallengeQuestionFor\(/, "each CEO challenge specialist must receive a role-specific question");
assert.match(appText, /question: ceoChallengeQuestionFor\(turn\.name, scenario, target, challenge, response, riskGate\)/, "CEO challenge turns must pair every specialist answer with a question");
assert.match(appText, /class="agent-question"/, "agent debate cards must render question text separately from answers");
assert.match(stylesText, /\.agent-question\s*,[\s\S]*\.agent-answer\s*\{/, "question and answer states must be visually distinct");
for (const artifact of [
  "data-manifest.json",
  "live-client.json",
  "quant-client.json",
  "price-history-client.json",
  "market-history-client.json",
  "quant-backtest-client.json",
  "decision-history-client.json",
  "landing-decision-client.json",
  "site-content-client.json",
  "site-content-extended-client.json",
]) {
  assert.ok(workflowText.includes(`data/${artifact}`), `daily workflow must publish the ${artifact} browser artifact`);
}
assert.ok(
  (workflowText.match(/\bref:\s*main\b/g) || []).length >= 2,
  "queued crawl and source-health jobs must both checkout the latest main tip",
);
assert.match(
  workflowText,
  /crawl_base="\$\(git rev-parse HEAD\)"[\s\S]*?git fetch origin main[\s\S]*?crawl_base[\s\S]*?origin\/main/,
  "daily refresh must detect code advances before committing generated artifacts",
);
assert.doesNotMatch(
  workflowText,
  /git pull --rebase/,
  "generated JSON snapshots must never be line-rebased after a concurrent main update",
);
assert.match(
  workflowText,
  /main advanced before the data push; deferring to the newer queued run/,
  "a late push race must defer cleanly to the newer queued refresh",
);

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
assert.match(dailyGroundingBlock, /String\(agent\.message \|\|/, "daily evidence must preserve a role's decision logic when using current or retained evidence");
assert.match(dailyGroundingBlock, /\*\*근거\(/, "appended evidence must remain visibly dated and labelled");
assert.ok((appText.match(/withDailyAgentEvidence\(/g) || []).length >= 4, "all three agent-turn render paths must apply daily live evidence");
assert.match(appText, /function executiveDecisionFrame\(/, "all executive agents must share a diagnosis-to-gate consulting framework");
assert.match(appText, /function agentDecisionFrameHTML\(/, "the consulting decision frame must render as a dedicated visual component");
assert.match(appText, /decisionFrame: executiveDecisionFrame\(mapped, decisionFrameContext\)/, "each mapped AI Infra challenge agent must receive the management decision frame");
assert.match(appText, /question: decisionFrame\.question, decisionFrame/, "each C-level council role must receive a data-bound question and decision frame");
assert.match(appText, /function executiveDecisionAgentItems[\s\S]*?executiveDecisionFrame\(agent, decisionFrameContext\)[\s\S]*?aiInfraDomainDecisionFrame\(agent, domain, decisionFrameContext\)/, "backtest product-council agents must combine the shared and domain-specific decision frames");
assert.match(stylesText, /\.agent-decision-frame\s*\{/, "decision frames must use a compact infographic layout");
assert.match(appText, /const STATIC_AI_INFRA_COUNCIL_AGENDAS = Object\.freeze\(\[/, "the C-level board must retain a bounded fallback agenda");
assert.match(appText, /window\.MEMORY_SITE_CONTENT\?\.agentCouncil\?\.agendas/, "the C-level board must prefer the current generated strategy agenda");
assert.match(appText, /function consoleDeepLinkState\([\s\S]*?function applyConsoleDeepLink\(/, "the C-level board must support stable section and agenda deep links");
assert.match(appText, /BASELINE-RELATIVE · 예약 Capacity·Qualification\/Ramp·Package Yield[\s\S]*?Scale CAPEX를 재배분/, "the foundry agenda must use customer-baseline reversal criteria");
assert.match(appText, /BASELINE-RELATIVE KILL CRITERIA · STOP \/ REFRAME/, "the decision pack must distinguish customer-baseline kill criteria from reported facts");
assert.match(appText, /function aiInfraCouncilDeepLink\([\s\S]*?syncAiInfraCouncilDeepLink/, "the decision pack must preserve a stable agenda deep link");
assert.doesNotMatch(appText, /cLevelCopyLink|copyTextToClipboard|data-(?:agent|advanced|number|talent|work|decision|infra|inspector|investment|nand|policy|projection)-copy/, "the decision pack must not expose clipboard controls");
for (const agenda of [
  "Customized Memory Consulting · Custom HBM",
  "AI Application & HW/SW · On-device",
  "LLM Serving & Context Economics · Enterprise RAG",
  "Data Center Workload Optimization",
  "Partners & Clients · Repeatable New Biz",
]) {
  assert.match(appText, new RegExp(agenda.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `the AI Infra council must expose ${agenda}`);
}
for (const capability of ["Bottleneck First", "Serving & Rack", "Executive Decision"]) {
  assert.match(appText, new RegExp(capability), `the strategy council must make ${capability} explicit`);
}
assert.match(appText, /Business Outcome → Workload\/SLO → Dominant Bottleneck → HW\/SW Options → 90-Day Gate/, "the council must expose a bottleneck-first consulting flow");
assert.match(appText, /OFFICIAL · TSMC[\s\S]*?N12 HBM4 · N3P Custom HBM4E/, "the foundry decision must separate official HBM4 and custom HBM4E process evidence");
assert.match(appText, /검증 전 결재 사용 금지/, "unverified mobile pricing and contract claims must be excluded from decision use");
const aiInfraCouncilRenderBlock = appText.slice(appText.indexOf("function renderCLevelCockpit"), appText.indexOf("function clearCouncilTimers"));
assert.doesNotMatch(aiInfraCouncilRenderBlock, /agent-debate|animateCouncilDebate|prepareAgentSpeechFromGesture/, "the AI Infra council must render instantly without video, typing, or speech effects");
assert.match(stylesText, /AI Infra Strategy Council — flat consulting geometry[\s\S]*?\.ai-council-agenda-card[\s\S]*?box-shadow: none;/, "the AI Infra council must use flat consulting geometry without glow styling");
const deferredSectionBlock = appText.slice(
  appText.indexOf("function setupDeferredSections"),
  appText.indexOf("/* ---------------- Hyperscaler"),
);
assert.match(appText, /function scheduleProgressiveDeferredSections\(definitions\)[\s\S]*?await preloadDeferredSectionData\(definition\.id\)[\s\S]*?requestIdleCallback\(\(\) => \{ void run\(\); \}, \{ timeout: 180 \}\)/, "below-the-fold data must prewarm without rendering hidden boards or waiting for scroll");
assert.match(deferredSectionBlock, /scheduleProgressiveDeferredSections\(definitions\)/, "progressive hydration must start after core rendering");
assert.doesNotMatch(appText, /function observeDeferredSections\(|rootMargin: "900px 0px"/, "deep board hydration must not depend on scrolling");
const jumpNavigationBlock = appText.slice(
  appText.indexOf("async function jumpTo"),
  appText.indexOf("function setupScrollSpy"),
);
assert.match(appText, /function syncSidebarRoute\(/, "sidebar tabs must share one active-route state with the content board");
assert.match(jumpNavigationBlock, /syncSidebarRoute\(id, \{ pending: true, reveal: true \}\)/, "a selected sidebar tab must update before its board finishes preparing");
assert.doesNotMatch(jumpNavigationBlock, /deferredSectionRuns\.values/, "a selected board must not wait for unrelated deferred boards");
assert.match(appText, /function scheduleScrollProgress\(/, "scroll progress updates must be frame-throttled");
assert.match(stylesText, /\.sb-item\.is-pending::after/, "sidebar must visibly retain the selected tab while the matching board loads");
assert.equal((indexText.match(/pretendard[^"\s]*\.css/gi) || []).length, 0, "the page must avoid external Korean font requests during initial rendering");
assert.match(appText, /history\.scrollRestoration = "manual"/, "fresh dashboard loads must disable browser restoration to a stale deep scroll position");
assert.match(appText, /function resetInitialViewport\(/, "fresh dashboard loads must explicitly start from the overview viewport");
assert.equal((appText.match(/resetInitialViewport\(\);/g) || []).length, 1, "the overview viewport must reset once without a late forced reflow");

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
