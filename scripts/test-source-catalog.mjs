import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildSourceCatalogSnapshot,
  catalogSourceForUrl,
  loadSourceCatalog,
  sourceCatalogDiscoveryMonitors,
  sourceCatalogHealthProbes,
  validateSourceCatalog,
} from "./source-catalog.mjs";
import { buildSiteContentClient } from "./site-content.mjs";
import { loadIntelligencePolicy, validateIntelligencePolicy } from "./decision-intelligence.mjs";

const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const catalog = loadSourceCatalog();
const validation = validateSourceCatalog(catalog);
assert.deepEqual(validation, { ok: true, errors: [] });
const intelligencePolicy = loadIntelligencePolicy();
assert.deepEqual(validateIntelligencePolicy(intelligencePolicy), { ok: true, errors: [] });
assert.ok(intelligencePolicy.directFeeds.every((feed) => catalog.sources.some((source) => source.id === feed.sourceId)), "every direct feed must map to the governed source catalog");
assert.ok(intelligencePolicy.metrics.some((metric) => metric.id === "hbm-revenue-share" && metric.dimension === "revenue-share"));
assert.ok(intelligencePolicy.metrics.some((metric) => metric.id === "hbm-wafer-input-share" && metric.dimension === "wafer-input-share"));
assert.ok(intelligencePolicy.eventRules.some((rule) => rule.id === "customer-silicon-roadmap"));
assert.ok(intelligencePolicy.eventRules.some((rule) => rule.id === "contract-structure"));
assert.ok(intelligencePolicy.eventRules.some((rule) => rule.id === "oem-rack-roadmap"));
for (const feedId of ["nvidia-vera-rubin-roadmap", "microsoft-maia-200-roadmap", "aws-trainium3-roadmap", "google-ironwood-roadmap", "meta-mtia-roadmap", "broadcom-xpu-roadmap", "apple-private-cloud-roadmap", "tesla-ai5-roadmap"]) {
  assert.ok(intelligencePolicy.directFeeds.some((feed) => feed.id === feedId), `missing governed customer feed: ${feedId}`);
}
for (const feedId of ["aws-trainium4-nvhbm-roadmap", "aws-inferentia-inference-roadmap"]) {
  assert.ok(intelligencePolicy.directFeeds.some((feed) => feed.id === feedId), `missing latest AWS governed feed: ${feedId}`);
}
assert.deepEqual(intelligencePolicy.retrieval.allowedSourceClasses, ["official", "research"]);

const enabled = catalog.sources.filter((source) => source.enabled);
const official = enabled.filter((source) => source.sourceClass === "official");
const tiers = new Set(enabled.map((source) => source.tier));
const roles = new Set(enabled.flatMap((source) => source.roles));
assert.ok(enabled.length >= 42, "source catalog must preserve broad AI Factory coverage");
assert.ok(official.length >= 33, "primary sources must remain the majority");
assert.ok(tiers.has("primary-company") && tiers.has("primary-customer") && tiers.has("primary-standard"));
assert.ok(tiers.has("primary-regulatory") && tiers.has("industry-research") && tiers.has("authoritative-media"));
for (const role of ["customer", "technology", "market", "financial", "standard", "competitor"]) assert.ok(roles.has(role), `missing role coverage: ${role}`);

const monitors = sourceCatalogDiscoveryMonitors(catalog);
const probes = sourceCatalogHealthProbes(catalog);
assert.ok(monitors.length >= 24);
assert.ok(probes.length >= 5);
assert.equal(new Set(monitors.map((monitor) => monitor.id)).size, monitors.length);
assert.equal(new Set(probes.map((probe) => probe.id)).size, probes.length);
assert.equal(catalogSourceForUrl("https://news.skhynix.com/example", catalog)?.id, "skhynix-newsroom");
assert.equal(catalogSourceForUrl("https://news.samsung.com/global/example", catalog)?.id, "samsung-semiconductor");
assert.equal(catalogSourceForUrl("https://docs.cloud.google.com/tpu/docs/tpu7x", catalog)?.id, "google-cloud-tpu");
assert.equal(catalogSourceForUrl("https://cloud.google.com/blog/topics/google-cloud-next/welcome-to-google-cloud-next26", catalog)?.id, "google-cloud-next26-tpu8");
assert.equal(catalogSourceForUrl("https://smrc.biz.samsung.com/html/about-us_new.html", catalog)?.id, "samsung-smrc");
assert.equal(catalogSourceForUrl("https://developer.nvidia.com/blog/example", catalog)?.id, "nvidia-dynamo");
assert.equal(catalogSourceForUrl("https://docs.vllm.ai/en/latest/features/kv_offloading_usage/", catalog)?.id, "vllm-kv-offloading");
assert.equal(catalogSourceForUrl("https://arxiv.org/abs/2309.06180", catalog)?.id, "llm-serving-systems-research");
assert.equal(catalogSourceForUrl("https://docs.nvidia.com/enterprise-reference-architectures/nvl72-ai-factory/latest/components.html", catalog)?.id, "nvidia-nvl72-architecture");
assert.equal(catalogSourceForUrl("https://www.dell.com/en-us/dt/corporate/newsroom/announcements/detailpage.press-releases~usa~2026~05~dell-technologies-delivers-production-ready-agentic-ai-from-deskside-to-data-center.htm", catalog)?.id, "dell-agentic-ai-2026");
assert.equal(catalogSourceForUrl("https://www.iea.org/reports/key-questions-on-energy-and-ai", catalog)?.id, "iea-energy-ai");
assert.equal(catalogSourceForUrl("https://www.ashrae.org/technical-resources/ai-data-center-framework", catalog)?.id, "ashrae-ai-data-center");
assert.equal(catalogSourceForUrl("https://kueue.sigs.k8s.io/docs/overview/", catalog)?.id, "kubernetes-kueue");
assert.equal(catalogSourceForUrl("https://kubernetes.io/docs/concepts/scheduling-eviction/dynamic-resource-allocation/", catalog)?.id, "kubernetes-dra");
assert.equal(catalogSourceForUrl("https://slurm.schedmd.com/gres.html", catalog)?.id, "slurm-gres");
assert.equal(catalogSourceForUrl("https://www.broadcom.com/info/ai/3point5d", catalog)?.id, "broadcom-ai");
assert.equal(catalogSourceForUrl("https://security.apple.com/blog/private-cloud-compute/", catalog)?.id, "apple-ai-infra");
assert.equal(catalogSourceForUrl("https://ir.tesla.com/example", catalog)?.id, "tesla-ai");
assert.equal(catalogSourceForUrl("https://content.spacex.com/example.pdf", catalog)?.id, "spacex-ai-prospectus-2026");
assert.equal(catalogSourceForUrl("https://www.spacex.com/careers/jobs?keyword=ASIC", catalog)?.id, "spacex-official");
assert.equal(catalogSourceForUrl("https://investor.marvell.com/sec-filings/all-sec-filings/content/0001193125-26-134462/d113606d8k.htm", catalog)?.id, "nvidia-marvell-investment-2026");
assert.equal(catalogSourceForUrl("https://investor.marvell.com/sec-filings/all-sec-filings/content/0001193125-26-356217/d412696d8k.htm", catalog)?.id, "google-marvell-custom-silicon-2026");

const snapshot = buildSourceCatalogSnapshot({
  catalog,
  news: [
    { sourceUrl: "https://news.skhynix.com/example", date: "2026-08-16" },
    { sourceUrl: "https://semiconductor.samsung.com/news-events/news/example", date: "2026-08-15" },
    { sourceUrl: "https://www.trendforce.com/presscenter/example", date: "2026-08-14" },
  ],
  industrySourceChecks: {
    "catalog-skhynix-newsroom": { reachable: true },
    "catalog-samsung-semiconductor": { reachable: true },
  },
  now: new Date("2026-08-16T12:00:00.000Z"),
});
assert.ok(snapshot.configuredSources >= 42);
assert.equal(snapshot.observedSources, 3);
assert.equal(snapshot.officialObserved, 2);
assert.equal(snapshot.freshObservedSources, 3);
assert.equal(snapshot.connectedHealthChecks, 2);
assert.equal(snapshot.scheduleHours, 6);
assert.equal(snapshot.browserRecheckMinutes, 5);
assert.equal(snapshot.failClosed, true);

const payload = json("data/live.json");
const quant = json("data/quant.json");
const siteContent = buildSiteContentClient({ payload, quant });
assert.ok(siteContent.freshness.configuredSources >= 42);
assert.ok(siteContent.freshness.officialConfigured >= 33);
assert.equal(siteContent.freshness.scheduleHours, 6);
assert.equal(siteContent.freshness.browserRecheckMinutes, 5);
assert.equal(siteContent.workloadOptimization.process.length, 6);
assert.equal(siteContent.workloadOptimization.serviceLines.length, 6);
assert.ok(siteContent.workloadOptimization.sources.some((source) => source.id === "samsung-smrc"));
assert.ok(siteContent.aiFactorySystem.sources.some((source) => source.id === "iea-energy-ai"));
assert.ok(siteContent.aiFactorySystem.sources.some((source) => source.id === "kubernetes-kueue"));
assert.equal(siteContent.aiFactorySystem.pillarCoverage.length, 7);
assert.equal(siteContent.strategyBoard.customerPortfolio.oemChannel.primaryAccount.id, "dell");
// Three tiers now; Tier 1 must remain, the rest may grow.
for (const id of ["dell", "hpe", "lenovo", "supermicro"]) {
  assert.ok(siteContent.strategyBoard.customerPortfolio.oemChannel.accounts.some((item) => item.id === id), `oem channel must cover ${id}`);
}
assert.equal(siteContent.strategyBoard.customerPortfolio.oemChannel.groups.length, 3);

const crawler = readFileSync("scripts/crawl.mjs", "utf8");
const workflow = readFileSync(".github/workflows/pages.yml", "utf8");
const landing = readFileSync("assets/js/landing.js", "utf8");
const audit = readFileSync("scripts/audit-content.mjs", "utf8");
assert.match(crawler, /sourceCatalogDiscoveryMonitors/);
assert.match(crawler, /sourceCatalogHealthProbes/);
assert.match(crawler, /source_catalog_observed/);
assert.match(workflow, /cron: "17 \*\/6 \* \* \*"/);
assert.match(workflow, /repository_dispatch:[\s\S]*earnings-release[\s\S]*industry-report[\s\S]*source-update/);
assert.doesNotMatch(landing, /businessDataSources/, "removed catalog status panel must not be rendered again");
assert.match(audit, /3\.0-catalog-driven-registry/);
assert.match(audit, /source catalog coverage or fail-closed policy is incomplete/);

console.log(JSON.stringify({
  ok: true,
  configuredSources: snapshot.configuredSources,
  officialSources: snapshot.officialConfigured,
  discoveryQueries: snapshot.discoveryQueries,
  healthChecks: snapshot.healthChecks,
  cadenceHours: snapshot.scheduleHours,
}, null, 2));
