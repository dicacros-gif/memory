import assert from "node:assert/strict";
import {
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
];

const observations = extractMetricObservations(documents, policy);
assert.equal(observations.filter((item) => item.metricId === "hbm-revenue-share").length, 16);
assert.equal(observations.filter((item) => item.metricId === "hbm-wafer-input-share").length, 3);
assert.ok(!observations.some((item) => item.value === 84.9), "gross margin must never become an HBM share observation");
assert.ok(!observations.some((item) => item.metricId === "hbm-revenue-share" && item.entityId === "skhynix" && item.value === 29), "DRAM share must never leak into the HBM table");

const consensus = buildMetricConsensus({ current: observations, policy, now: new Date("2026-08-16T00:00:00.000Z") });
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
const secondIndex = buildIncrementalKnowledgeIndex({ documents, previous: firstIndex, policy, now: new Date("2026-08-16T03:00:00.000Z") });
assert.equal(secondIndex.stats.unchanged, documents.length);
assert.equal(secondIndex.stats.reindexed, 0);
const changedDocuments = structuredClone(documents);
changedDocuments[0].text += " Updated source text.";
const thirdIndex = buildIncrementalKnowledgeIndex({ documents: changedDocuments, previous: secondIndex, policy, now: new Date("2026-08-16T06:00:00.000Z") });
assert.equal(thirdIndex.stats.changed, 1);
assert.equal(thirdIndex.stats.reindexed, 1);

const built = buildDecisionIntelligence({
  documents,
  policy,
  runId: "decision-intelligence-test",
  now: new Date("2026-08-16T00:00:00.000Z"),
  feedStatus: policy.directFeeds.map((feed) => ({ id: feed.id, status: "fixture" })),
});
assert.equal(built.metrics.latest.find((item) => item.entityId === "skhynix").display, "58–62%");
assert.equal(built.retrieval.packs.length, policy.retrieval.tracks.length);
assert.ok(built.retrieval.packs.every((pack) => pack.evidence.every((item) => item.url)));
assert.equal(built.evaluation.metrics.unsupportedClaimPct, 0);
assert.equal(built.evaluation.metrics.citationCoveragePct, 100);

console.log(JSON.stringify({
  ok: true,
  observations: observations.length,
  latestMetrics: built.metrics.latest.length,
  index: built.retrieval.stats,
  evaluation: built.evaluation,
}, null, 2));
