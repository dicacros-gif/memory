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

const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const catalog = loadSourceCatalog();
const validation = validateSourceCatalog(catalog);
assert.deepEqual(validation, { ok: true, errors: [] });

const enabled = catalog.sources.filter((source) => source.enabled);
const official = enabled.filter((source) => source.sourceClass === "official");
const tiers = new Set(enabled.map((source) => source.tier));
const roles = new Set(enabled.flatMap((source) => source.roles));
assert.ok(enabled.length >= 35, "source catalog must preserve broad AI Infra coverage");
assert.ok(official.length >= 25, "primary sources must remain the majority");
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
assert.equal(catalogSourceForUrl("https://cloud.google.com/blog/topics/tpus", catalog)?.id, "google-cloud-tpu");
assert.equal(catalogSourceForUrl("https://smrc.biz.samsung.com/html/about-us_new.html", catalog)?.id, "samsung-smrc");
assert.equal(catalogSourceForUrl("https://developer.nvidia.com/blog/example", catalog)?.id, "nvidia-dynamo");
assert.equal(catalogSourceForUrl("https://docs.vllm.ai/en/latest/features/kv_offloading_usage/", catalog)?.id, "vllm-kv-offloading");

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
assert.ok(snapshot.configuredSources >= 35);
assert.equal(snapshot.observedSources, 3);
assert.equal(snapshot.officialObserved, 2);
assert.equal(snapshot.freshObservedSources, 3);
assert.equal(snapshot.connectedHealthChecks, 2);
assert.equal(snapshot.scheduleHours, 3);
assert.equal(snapshot.failClosed, true);

const payload = json("data/live.json");
const quant = json("data/quant.json");
const siteContent = buildSiteContentClient({ payload, quant });
assert.ok(siteContent.freshness.configuredSources >= 35);
assert.ok(siteContent.freshness.officialConfigured >= 25);
assert.equal(siteContent.freshness.scheduleHours, 3);
assert.equal(siteContent.workloadOptimization.process.length, 6);
assert.equal(siteContent.workloadOptimization.serviceLines.length, 3);
assert.ok(siteContent.workloadOptimization.sources.some((source) => source.id === "samsung-smrc"));

const crawler = readFileSync("scripts/crawl.mjs", "utf8");
const workflow = readFileSync(".github/workflows/pages.yml", "utf8");
const landing = readFileSync("assets/js/landing.js", "utf8");
const audit = readFileSync("scripts/audit-content.mjs", "utf8");
assert.match(crawler, /sourceCatalogDiscoveryMonitors/);
assert.match(crawler, /sourceCatalogHealthProbes/);
assert.match(crawler, /source_catalog_observed/);
assert.match(workflow, /cron: "17 \*\/3 \* \* \*"/);
assert.match(landing, /businessDataSources/);
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
