import assert from "node:assert/strict";
import {
  buildAutomatedDecisionBriefs,
  buildClaimEventLedger,
  buildDecisionIntelligence,
  buildIncrementalKnowledgeIndex,
  buildMetricConsensus,
  canonicalPeriod,
  extractMetricObservations,
  htmlToDecisionText,
  loadIntelligencePolicy,
  validateIntelligencePolicy,
} from "./decision-intelligence.mjs";

const policy = loadIntelligencePolicy();
assert.deepEqual(validateIntelligencePolicy(policy), { ok: true, errors: [] });
assert.equal(canonicalPeriod("Q1 2026"), "2026-Q1");
assert.equal(canonicalPeriod("2026년 1분기"), "2026-Q1");

const counterpointHtml = `
  <h2>전세계 D램 시장 점유율</h2>
  <table>
    <tr><th>Vendor</th><th>Q1 2025</th><th>Q2 2025</th><th>Q3 2025</th><th>Q4 2025</th><th>Q1 2026</th></tr>
    <tr><td>SK Hynix</td><td>36%</td><td>39%</td><td>33%</td><td>32%</td><td>29%</td></tr>
    <tr><td>Samsung</td><td>38%</td><td>37%</td><td>39%</td><td>42%</td><td>38%</td></tr>
    <tr><td>Micron</td><td>25%</td><td>22%</td><td>26%</td><td>22%</td><td>22%</td></tr>
  </table>
  <h2>전세계 HBM 시장 점유율</h2>
  <table>
    <tr><th>Vendor</th><th>Q1 2025</th><th>Q2 2025</th><th>Q3 2025</th><th>Q4 2025</th><th>Q1 2026</th></tr>
    <tr><td>SK Hynix</td><td>69%</td><td>64%</td><td>56%</td><td>57%</td><td>58%</td></tr>
    <tr><td>Samsung</td><td>13%</td><td>15%</td><td>23%</td><td>22%</td><td>21%</td></tr>
    <tr><td>Micron</td><td>18%</td><td>21%</td><td>21%</td><td>21%</td><td>21%</td></tr>
  </table>`;
const trendforceHtml = `<p>TrendForce estimates that HBM wafer input among the top three suppliers will account for approximately 18%, 22%, and 30% of total DRAM wafer input by the end of 2025, 2026, and 2027, respectively.</p>`;
const documents = [
  {
    feedId: "skhynix-hbm4e-sample-2026",
    sourceId: "skhynix-newsroom",
    source: "SK hynix Newsroom",
    sourceClass: "official",
    title: "SK hynix Ships Samples of 12-layer HBM4E",
    url: "https://news.skhynix.com/en/sk-hynix-ships-samples-of-12-layer-next-gen-hbm4e-2/",
    publishedAt: "2026-08-03",
    observedAt: "2026-08-16T00:00:00.000Z",
    text: "SK hynix shipped samples of 12-layer HBM4E to customers and plans to begin mass production after customer qualification.",
  },
  {
    feedId: "counterpoint-hbm-quarterly-share",
    sourceId: "counterpoint",
    source: "Counterpoint Research",
    sourceClass: "research",
    title: "Global DRAM and HBM Market Share",
    url: "https://korea.counterpointresearch.com/global-dram-and-hbm-market-share-quarterly/",
    publishedAt: "2026-06-15",
    observedAt: "2026-08-16T00:00:00.000Z",
    text: htmlToDecisionText(counterpointHtml),
  },
  {
    feedId: "trendforce-hbm-wafer-input",
    sourceId: "trendforce",
    source: "TrendForce",
    sourceClass: "research",
    title: "HBM wafer input outlook",
    url: "https://www.trendforce.com/presscenter/news/20260602-13074.html",
    publishedAt: "2026-06-02",
    observedAt: "2026-08-16T00:00:00.000Z",
    text: htmlToDecisionText(trendforceHtml),
  },
  {
    feedId: "narrative",
    sourceId: "second-research",
    source: "Second Research",
    sourceClass: "research",
    title: "HBM tracker",
    url: "https://example.org/hbm-tracker",
    publishedAt: "2026-06-20",
    observedAt: "2026-08-16T00:00:00.000Z",
    text: "In Q1 2026, SK hynix HBM market share was 62%. Gross margin was 84.9%, which must not be treated as market share.",
  },
  {
    feedId: "narrative",
    sourceId: "ihbm-boilerplate",
    source: "SK hynix Newsroom",
    sourceClass: "official",
    title: "iHBM cooling solution",
    url: "https://news.skhynix.com/en/ihbm-solution",
    publishedAt: "2026-05-26",
    observedAt: "2026-08-16T00:00:00.000Z",
    text: "Share Copy URL. SK hynix introduced iHBM, an HBM solution whose thermal resistance is reduced by 30% for better heat dissipation.",
  },
  {
    feedId: "narrative",
    sourceId: "vllm-kv-offloading",
    source: "vLLM",
    sourceClass: "official",
    title: "KV cache offloading",
    url: "https://docs.vllm.ai/en/latest/features/kv_offloading_usage/",
    publishedAt: "2026-08-01",
    observedAt: "2026-08-16T00:00:00.000Z",
    text: "KV cache offload moves memory tiers between GPU HBM and CPU memory. Scheduler and goodput must be measured for workload TCO.",
  },
  {
    feedId: "narrative",
    sourceId: "rag-standard",
    source: "RAG Research",
    sourceClass: "research",
    title: "RAG retrieval and vector memory",
    url: "https://arxiv.org/abs/2309.06180",
    publishedAt: "2026-08-02",
    observedAt: "2026-08-16T00:00:00.000Z",
    text: "RAG retrieval uses a vector index, embedding cache and context documents. DRAM and storage placement affects latency and cost.",
  },
  {
    feedId: "narrative",
    sourceId: "micron-investor",
    source: "Micron Investor Relations",
    sourceClass: "official",
    title: "Quarterly results",
    url: "https://investors.micron.com/quarterly-results",
    publishedAt: "2026-08-03",
    observedAt: "2026-08-16T00:00:00.000Z",
    text: "Quarterly results include HBM4 capacity, long-term customer contract and shipment commitments.",
  },
  {
    feedId: "skhynix-hbf-open-standard",
    sourceId: "skhynix-newsroom",
    source: "SK hynix Newsroom",
    sourceClass: "official",
    title: "SK hynix Unveils First HBF Standard Specifications with Sandisk",
    url: "https://news.skhynix.com/en/hbf-at-fms-2026",
    publishedAt: "2026-08-04",
    observedAt: "2026-08-16T00:00:00.000Z",
    text: "SK hynix and Sandisk released the first open HBF standard specifications via OCP for High Bandwidth Flash.",
  },
  {
    feedId: "skhynix-full-stack-ai-memory",
    sourceId: "skhynix-newsroom",
    source: "SK hynix Newsroom",
    sourceClass: "official",
    title: "SK hynix becomes a Full-Stack AI Memory Creator",
    url: "https://news.skhynix.com/en/sk-hynix-redefines-its-vision-at-sk-ai-summit-2025-from-ai-memory-provider-to-creator",
    publishedAt: "2025-11-20",
    observedAt: "2026-08-16T00:00:00.000Z",
    text: "The Full-Stack AI Memory Creator portfolio has three pillars: Custom HBM, AI-D and AI-N roadmap products.",
  },
  {
    feedId: "skhynix-cxl-maas",
    sourceId: "skhynix-newsroom",
    source: "SK hynix Newsroom",
    sourceClass: "official",
    title: "SK hynix unlocks NAND memory potential at FMS",
    url: "https://news.skhynix.com/en/sk-hynix-unlocks-nand-memory-potential-with-innovative-products-at-fms-2022/",
    publishedAt: "2022-08-04",
    observedAt: "2026-08-16T00:00:00.000Z",
    text: "SK hynix presented CXL memory bandwidth and capacity expansion with memory pooling, redefining memory-as-a-service.",
  },
];

const observations = extractMetricObservations(documents, policy);
assert.equal(observations.filter((item) => item.metricId === "hbm-revenue-share").length, 16);
assert.equal(observations.filter((item) => item.metricId === "hbm-wafer-input-share").length, 3);
assert.ok(!observations.some((item) => item.value === 84.9), "gross margin must never become an HBM share observation");
assert.ok(!observations.some((item) => item.metricId === "hbm-revenue-share" && item.entityId === "skhynix" && item.value === 29), "DRAM share must never leak into the HBM table");
assert.ok(!observations.some((item) => item.metricId === "hbm-revenue-share" && item.value === 30 && item.sourceId === "ihbm-boilerplate"), "thermal-resistance percentages must never become HBM market share");

const consensus = buildMetricConsensus({
  current: observations,
  previous: { observations: [{
    metricId: "hbm-revenue-share", metricLabel: "HBM 매출 점유율", dimension: "revenue-share", entityId: "skhynix", company: "SKHY",
    period: "2026", unit: "%", value: 30, sourceId: "ihbm-boilerplate", source: "SK hynix Newsroom", sourceClass: "official",
    sourceUrl: "https://news.skhynix.com/en/ihbm-solution", publishedAt: "2026-05-26", observedAt: "2026-08-16T00:00:00.000Z",
  }] },
  policy,
  now: new Date("2026-08-16T00:00:00.000Z"),
});
assert.ok(!consensus.observations.some((item) => item.metricId === "hbm-revenue-share" && item.period === "2026"), "quarterly HBM-share policy must purge annual polluted observations");
const skhynix = consensus.latest.find((item) => item.metricId === "hbm-revenue-share" && item.entityId === "skhynix");
assert.equal(skhynix.period, "2026-Q1");
assert.equal(skhynix.display, "58–62%");
assert.equal(skhynix.representation, "range");
assert.equal(skhynix.priorPeriod, "2025-Q4");
assert.equal(skhynix.direction, "up");
assert.equal(skhynix.yearAgoPeriod, "2025-Q1");
assert.equal(skhynix.yearAgoChangePctPoint, -9);
const wafer = consensus.latest.find((item) => item.metricId === "hbm-wafer-input-share");
assert.equal(wafer.display, "30%");
assert.equal(wafer.period, "2027");

const firstIndex = buildIncrementalKnowledgeIndex({ documents, policy, now: new Date("2026-08-16T00:00:00.000Z") });
assert.equal(firstIndex.stats.added, documents.length);
assert.equal(firstIndex.stats.reindexed, documents.length);
assert.equal(firstIndex.documents[0].lastHumanVerifiedAt, null, "human verification must never be inferred from an automated run");
assert.ok(firstIndex.documents.every((item) => item.sourceChangeDetectedAt && item.indexedAt && item.freshnessDays));
const secondIndex = buildIncrementalKnowledgeIndex({ documents, previous: firstIndex, policy, now: new Date("2026-08-16T03:00:00.000Z") });
assert.equal(secondIndex.stats.unchanged, documents.length);
assert.equal(secondIndex.stats.reindexed, 0);
assert.ok(secondIndex.documents.every((item) => item.indexedAt === firstIndex.documents.find((before) => before.id === item.id)?.indexedAt), "unchanged documents must not be reindexed");
const missingDateIndex = structuredClone(firstIndex);
missingDateIndex.documents[0].publishedAt = null;
const repairedMetadataIndex = buildIncrementalKnowledgeIndex({ documents, previous: missingDateIndex, policy, now: new Date("2026-08-16T04:00:00.000Z") });
const repairedSource = documents.find((item) => item.url.replace(/\/$/, "") === missingDateIndex.documents[0].url.replace(/\/$/, ""));
assert.equal(repairedMetadataIndex.documents.find((item) => item.id === missingDateIndex.documents[0].id)?.publishedAt, repairedSource?.publishedAt, "source-date repairs must update metadata without re-embedding unchanged text");
const changedDocuments = structuredClone(documents);
changedDocuments.find((item) => item.sourceId === "counterpoint").text += " Updated source text.";
const thirdIndex = buildIncrementalKnowledgeIndex({ documents: changedDocuments, previous: secondIndex, policy, now: new Date("2026-08-16T06:00:00.000Z") });
assert.equal(thirdIndex.stats.changed, 1);
assert.equal(thirdIndex.stats.reindexed, 1);
const changedDocument = thirdIndex.documents.find((item) => item.sourceId === "counterpoint");
assert.equal(changedDocument.indexedAt, "2026-08-16T06:00:00.000Z");

const built = buildDecisionIntelligence({
  documents,
  policy,
  runId: "decision-intelligence-test",
  now: new Date("2026-08-16T00:00:00.000Z"),
  feedStatus: policy.directFeeds.map((feed) => ({ id: feed.id, status: "fixture" })),
});
const ineligibleStructuredClaim = {
  feedId: null,
  sourceId: "claim-gate-market-estimate",
  source: "Secondary market report",
  sourceClass: "ineligible",
  title: "Samsung HBM4 mass production reaches 12Gbps",
  url: "https://example.org/hbm4-unverified-speed-claim",
  publishedAt: "2026-08-15",
  observedAt: "2026-08-16T00:00:00.000Z",
  text: "Samsung HBM4 mass production reaches 12Gbps and begins shipment ramp.",
  claimClass: "hbm4-interface-speed",
  claimStage: "market-estimate",
};
const claimGatedBuild = buildDecisionIntelligence({
  documents: [...documents, ineligibleStructuredClaim],
  policy,
  runId: "decision-intelligence-claim-gate-test",
  now: new Date("2026-08-16T00:00:00.000Z"),
});
assert.ok(
  !claimGatedBuild.eventTriggers.some((event) => event.sourceId === ineligibleStructuredClaim.sourceId),
  "an ineligible production-shaped news document must not re-enter the public event trigger stream",
);
assert.ok(claimGatedBuild.eventTriggers.length > 0, "eligible official and research documents must still create event triggers");
assert.equal(built.metrics.latest.find((item) => item.entityId === "skhynix").display, "58–62%");
assert.equal(built.retrieval.packs.length, policy.retrieval.tracks.length);
assert.ok(built.retrieval.packs.every((pack) => pack.evidence.every((item) => item.url)));
assert.equal(built.evaluation.metrics.unsupportedClaimPct, 0);
assert.equal(built.evaluation.metrics.citationCoveragePct, 100);
assert.equal(built.schemaVersion, "1.3");
assert.ok(built.claimEvents.stats.structuredEvents > 0, "verified documents must become structured ClaimEvents");
assert.ok(built.claimEvents.events.every((event) => event.evidenceSpan && event.entity?.id && event.product?.id && event.stage?.id));
assert.ok(built.claimEvents.events.every((event) => ["verified-fact", "market-estimate"].includes(event.claimType)), "every ClaimEvent must separate facts from estimates");
assert.ok(built.claimEvents.events.every((event) => event.asOf === event.publishedAt), "every ClaimEvent must retain an explicit as-of date");
assert.ok(built.claimEvents.events.every((event) => event.feedId), "direct ClaimEvents must retain their feed lineage");
const hbfStandard = built.claimEvents.events.find((event) => event.ruleId === "hbf-standardization-stage" && event.sourceClass === "official");
assert.equal(hbfStandard?.stage.id, "STANDARDIZATION", "an HBF standard disclosure must not be overwritten by generic announcement language");
const hbm4eSample = built.claimEvents.events.find((event) => event.ruleId === "hbm4-production-stage" && event.product.id === "hbm4e");
assert.equal(hbm4eSample?.stage.id, "SAMPLE", "a future mass-production plan must not promote a current HBM4E sample shipment");
assert.ok(built.claimEvents.events.some((event) => event.ruleId === "full-stack-memory-portfolio" && event.product.id === "ai-n"), "the official Full-Stack portfolio must reach the ClaimEvent ledger");
const maasDirection = built.claimEvents.events.find((event) => event.ruleId === "maas-service-model");
assert.equal(maasDirection?.product.id, "cxl", "MaaS direction must bind to CXL");
assert.equal(maasDirection?.claimType, "verified-fact", "official MaaS direction must remain a verified fact");
assert.ok(built.claimEvents.events.every((event) => ["official", "research"].includes(event.sourceClass)), "media summaries must not enter the ClaimEvent ledger");
assert.ok(built.claimEvents.events.every((event) => event.promotionStatus !== "verified-primary" || event.sourceClass === "official"), "research claims must never inherit a verified-primary label");
assert.ok(built.claimEvents.events.every((event) => !event.isCurrentStage || event.sourceClass === "official" || !built.claimEvents.events.some((peer) => peer.entity.id === event.entity.id && peer.product.id === event.product.id && peer.stage.id === event.stage.id && peer.sourceClass === "official")), "an official claim must lead same-stage research claims");
assert.equal(built.decisionAutomation.briefs.length, policy.decisionAutomation.briefs.length);
assert.ok(built.decisionAutomation.briefs.every((brief) => brief.customerPain && brief.hypothesis && brief.trigger && brief.killCriteria));
assert.equal(built.decisionAutomation.meceAxes.length, 4, "the decision layer must expose four non-overlapping strategy domains");
assert.equal(new Set(built.decisionAutomation.meceAxes.map((axis) => axis.id)).size, 4);
assert.equal(new Set(built.decisionAutomation.briefs.map((brief) => brief.meceAxis)).size, built.decisionAutomation.briefs.length, "each executive brief must own one MECE axis");
assert.equal(new Set(built.decisionAutomation.briefs.map((brief) => brief.decisionQuestion)).size, built.decisionAutomation.briefs.length, "executive questions must never repeat across cards");
assert.equal(new Set(built.decisionAutomation.briefs.map((brief) => brief.stage)).size, built.decisionAutomation.briefs.length, "each decision brief must use its own execution stage rather than cloning a source stage");
assert.ok(built.decisionAutomation.briefs.every((brief) => brief.whatChanged === brief.decisionQuestion && brief.deliverable && brief.latestSignal));
assert.ok(built.decisionAutomation.briefs.every((brief) => brief.factBoundary && brief.hypothesisStatus === "strategy-hypothesis"));
assert.ok(built.decisionAutomation.briefs.every((brief) => Number.isInteger(brief.officialFactCount) && Number.isInteger(brief.marketEstimateCount)));
assert.ok(built.decisionAutomation.briefs.find((brief) => brief.id === "enterprise-rag")?.evidence.some((item) => item.ruleId === "maas-service-model"), "MaaS official evidence must reach the New Biz decision brief");
assert.ok(["MONITORING", "EVIDENCE_READY", "CONFLICT_REVIEW", "DECISION_READY"].includes(built.decisionAutomation.state));
assert.equal(built.decisionAutomation.sourceOperations.configured, policy.directFeeds.length);
assert.equal(built.decisionAutomation.sourceOperations.observed, policy.directFeeds.length);
assert.ok(built.freshness.score >= 85);
assert.equal(built.freshness.status, "current");
assert.deepEqual(Object.keys(built.freshness.components).sort(), ["contentAge", "coverageDrift", "embeddingLag", "staleRetrievalRate"].sort());
assert.equal(built.freshness.thresholds.current, 85);
assert.equal(built.freshness.thresholds.warning, 70);
assert.ok(built.retrieval.packs.flatMap((pack) => pack.evidence).every((item) => item.indexedAt && item.sourceChangeDetectedAt));

console.log(JSON.stringify({
  ok: true,
  observations: observations.length,
  latestMetrics: built.metrics.latest.length,
  index: built.retrieval.stats,
  evaluation: built.evaluation,
  freshness: built.freshness,
  claimEvents: built.claimEvents.stats,
  decisionState: built.decisionAutomation.state,
}, null, 2));
