import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const SOURCE_CATALOG_PATH = resolve(root, "data", "source-catalog.json");
const ALLOWED_SOURCE_CLASSES = new Set(["official", "research", "authoritative-media"]);
const ALLOWED_TIERS = new Set([
  "primary-company",
  "primary-customer",
  "primary-standard",
  "primary-regulatory",
  "primary-market",
  "industry-research",
  "authoritative-media",
]);

const arrayOfText = (value) => Array.isArray(value)
  && value.length > 0
  && value.every((item) => typeof item === "string" && item.trim());

export function validateSourceCatalog(catalog = {}) {
  const errors = [];
  if (catalog.schemaVersion !== "1.0") errors.push("schemaVersion");
  if (!Array.isArray(catalog.sources) || catalog.sources.length < 20) errors.push("sources:min-20");
  if (Number(catalog.refreshPolicy?.scheduleHours) < 1) errors.push("refreshPolicy.scheduleHours");
  if (catalog.refreshPolicy?.failClosed !== true) errors.push("refreshPolicy.failClosed");
  const ids = new Set();
  for (const [index, source] of (catalog.sources || []).entries()) {
    const prefix = `sources[${index}]`;
    if (!/^[a-z0-9][a-z0-9-]+$/.test(String(source?.id || ""))) errors.push(`${prefix}.id`);
    if (ids.has(source?.id)) errors.push(`${prefix}.id:duplicate`);
    ids.add(source?.id);
    if (!String(source?.name || "").trim()) errors.push(`${prefix}.name`);
    if (!ALLOWED_TIERS.has(source?.tier)) errors.push(`${prefix}.tier`);
    if (!ALLOWED_SOURCE_CLASSES.has(source?.sourceClass)) errors.push(`${prefix}.sourceClass`);
    if (!/^https:\/\//i.test(String(source?.url || ""))) errors.push(`${prefix}.url`);
    if (!arrayOfText(source?.domains)) errors.push(`${prefix}.domains`);
    if (!arrayOfText(source?.topics)) errors.push(`${prefix}.topics`);
    if (!arrayOfText(source?.roles)) errors.push(`${prefix}.roles`);
    if (!arrayOfText(source?.languages)) errors.push(`${prefix}.languages`);
    if (!Number.isFinite(Number(source?.freshnessHours)) || Number(source.freshnessHours) < 24) errors.push(`${prefix}.freshnessHours`);
    if (!Array.isArray(source?.discoveryQueries)) errors.push(`${prefix}.discoveryQueries`);
    if (source?.healthCheck && !arrayOfText(source.healthCheck.markers)) errors.push(`${prefix}.healthCheck.markers`);
    if (source?.enabled !== true && source?.enabled !== false) errors.push(`${prefix}.enabled`);
  }
  return { ok: errors.length === 0, errors };
}

export function loadSourceCatalog(path = SOURCE_CATALOG_PATH) {
  const catalog = JSON.parse(readFileSync(path, "utf8"));
  const validation = validateSourceCatalog(catalog);
  if (!validation.ok) throw new Error(`source catalog validation failed: ${validation.errors.join(", ")}`);
  return Object.freeze(catalog);
}

export function sourceCatalogDiscoveryMonitors(catalog = loadSourceCatalog()) {
  return catalog.sources
    .filter((source) => source.enabled && source.discoveryQueries.length)
    .map((source) => ({
      id: `catalog-${source.id}`,
      label: `${source.name} · catalog`,
      queries: [...source.discoveryQueries],
      sourceCatalogId: source.id,
    }));
}

function markerPattern(markers = []) {
  const escaped = markers.map((marker) => String(marker).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(escaped.join("|"), "i");
}

export function sourceCatalogHealthProbes(catalog = loadSourceCatalog()) {
  return catalog.sources
    .filter((source) => source.enabled && source.healthCheck)
    .map((source) => ({
      id: `catalog-${source.id}`,
      catalogSourceId: source.id,
      label: source.name,
      url: source.url,
      fallbackUrls: source.healthCheck.fallbackUrls || [],
      pattern: markerPattern(source.healthCheck.markers),
    }));
}

function sourceHost(value = "") {
  try { return new URL(String(value)).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; }
}

export function catalogSourceForUrl(value = "", catalog = loadSourceCatalog()) {
  const input = String(value || "").replace(/#.*$/, "").replace(/\/$/, "");
  const host = sourceHost(input);
  if (!host) return null;
  const exact = catalog.sources.find((source) => source.enabled
    && String(source.url || "").replace(/#.*$/, "").replace(/\/$/, "") === input);
  if (exact) return exact;
  const candidates = catalog.sources.filter((source) => source.enabled && source.domains.some((domain) => {
    const normalized = String(domain).toLowerCase().replace(/^www\./, "");
    return host === normalized || host.endsWith(`.${normalized}`);
  }));
  const score = (source) => {
    const sourceUrl = String(source.url || "");
    const sourcePath = (() => { try { return new URL(sourceUrl).pathname.replace(/[^/]+$/, ""); } catch { return ""; } })();
    let inputPath = "";
    try { inputPath = new URL(input).pathname; } catch { /* already rejected above */ }
    return (sourceHost(sourceUrl) === host ? 100000 : 0)
      + (sourcePath && inputPath.startsWith(sourcePath) ? sourcePath.length * 100 : 0)
      + Math.max(...source.domains.map((domain) => String(domain).length));
  };
  return candidates.sort((left, right) => score(right) - score(left))[0] || null;
}

export function buildSourceCatalogSnapshot({ catalog = loadSourceCatalog(), news = [], industrySourceChecks = {}, now = new Date() } = {}) {
  const enabled = catalog.sources.filter((source) => source.enabled);
  const observedIds = new Set();
  const latestById = new Map();
  for (const item of news) {
    const source = catalogSourceForUrl(item?.verification?.canonicalUrl || item?.sourceUrl || item?.link || item?.url || "", catalog);
    if (!source) continue;
    observedIds.add(source.id);
    const timestamp = Date.parse(String(item?.publishedAt || item?.date || item?.observedAt || item?.crawledAt || ""));
    if (Number.isFinite(timestamp) && timestamp > Number(latestById.get(source.id) || 0)) latestById.set(source.id, timestamp);
  }
  const countBy = (key, rows = enabled) => rows.reduce((counts, source) => {
    for (const value of Array.isArray(source[key]) ? source[key] : [source[key]]) {
      if (value) counts[value] = (counts[value] || 0) + 1;
    }
    return counts;
  }, {});
  const observed = enabled.filter((source) => observedIds.has(source.id));
  const nowMs = Number.isFinite(now?.getTime?.()) ? now.getTime() : Date.now();
  const fresh = observed.filter((source) => {
    const latest = Number(latestById.get(source.id) || 0);
    return latest > 0 && nowMs - latest <= Number(source.freshnessHours) * 3600_000;
  });
  const stale = observed.filter((source) => !fresh.includes(source));
  const official = enabled.filter((source) => source.sourceClass === "official");
  const connectedHealthChecks = enabled.filter((source) => industrySourceChecks?.[`catalog-${source.id}`]?.reachable === true).length;
  return {
    version: catalog.schemaVersion,
    scheduleHours: Number(catalog.refreshPolicy.scheduleHours),
    browserRecheckMinutes: Number(catalog.refreshPolicy.browserRecheckMinutes),
    failClosed: catalog.refreshPolicy.failClosed === true,
    configuredSources: enabled.length,
    discoveryQueries: enabled.reduce((sum, source) => sum + source.discoveryQueries.length, 0),
    healthChecks: enabled.filter((source) => source.healthCheck).length,
    connectedHealthChecks,
    observedSources: observed.length,
    freshObservedSources: fresh.length,
    staleObservedSources: stale.length,
    staleSourceIds: stale.map((source) => source.id).sort(),
    observationCoveragePct: enabled.length ? Number(((observed.length / enabled.length) * 100).toFixed(1)) : 0,
    officialConfigured: official.length,
    officialObserved: observed.filter((source) => source.sourceClass === "official").length,
    officialFreshObserved: fresh.filter((source) => source.sourceClass === "official").length,
    observedSourceIds: [...observedIds].sort(),
    freshSourceIds: fresh.map((source) => source.id).sort(),
    byTier: countBy("tier"),
    observedByTier: countBy("tier", observed),
    roleCoverage: countBy("roles"),
    topicCoverage: countBy("topics"),
  };
}
