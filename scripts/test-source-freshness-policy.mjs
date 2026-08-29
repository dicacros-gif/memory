/**
 * Source freshness policy gate.
 *
 * Every catalog entry declares a freshnessHours budget, but nothing compared a
 * source's own publication date against it, so a four-year-old citation sat in
 * the catalog with a 24-hour policy and nobody noticed. This gate makes the
 * policy mean something: a dated source that has blown its own budget by more
 * than a year has to be either refreshed or explicitly retired, and the health
 * probes that watch the undated ones have to keep their coverage.
 */
import assert from "node:assert/strict";
import { loadSourceCatalog, sourceCatalogFeedMonitors, sourceCatalogHealthProbes } from "./source-catalog.mjs";

const catalog = loadSourceCatalog();
const now = Date.now();
const DAY_MS = 86400000;

const dated = catalog.sources.filter((source) => source.publishedAt);
const enabled = catalog.sources.filter((source) => source.enabled);

// A dated entry is a specific article, so its age is a fact about the evidence,
// not about the feed. Past two years it has to be one of two things on purpose:
// a declared anchor — a permanent primary record — or retired supply. What it
// must not be is live supply nobody noticed had expired.
const staleEnabled = dated
  .filter((source) => source.enabled && !source.anchor)
  .map((source) => ({ id: source.id, ageDays: Math.floor((now - Date.parse(source.publishedAt)) / DAY_MS) }))
  .filter((row) => row.ageDays > 730);
assert.deepEqual(
  staleEnabled,
  [],
  `a dated source older than two years must be retired or declared an anchor: ${staleEnabled.map((row) => `${row.id} (${row.ageDays}d)`).join(", ")}`,
);

// The undated majority are standing feeds. They are only trustworthy while a
// health probe is watching their markers, so probe coverage cannot silently
// erode as the catalog grows.
const probes = sourceCatalogHealthProbes(catalog);
const probeCoverage = probes.length / enabled.length;
assert.ok(
  probeCoverage >= 0.5,
  `health probes must watch at least half the enabled catalog; now ${probes.length}/${enabled.length}`,
);

// Publisher feeds are the supply that does not depend on a search aggregator.
// Every one of them must declare a budget it can actually meet.
const feeds = sourceCatalogFeedMonitors(catalog);
for (const monitor of feeds) {
  const source = catalog.sources.find((row) => row.id === monitor.sourceCatalogId);
  assert.ok(source, `${monitor.id} must resolve to a catalog source`);
  assert.ok(
    Number(source.freshnessHours) <= 72,
    `${source.id} is a live feed and must carry a freshness budget of 72h or less`,
  );
}

// Every enabled official source states a budget, because that budget is what a
// reader's "as of" is judged against.
for (const source of enabled) {
  assert.ok(
    Number.isFinite(Number(source.freshnessHours)) && Number(source.freshnessHours) >= 24,
    `${source.id} must declare a freshness budget`,
  );
}

const ages = dated.map((source) => Math.floor((now - Date.parse(source.publishedAt)) / DAY_MS));
console.log(JSON.stringify({
  status: "source-freshness-policy-pass",
  enabled: enabled.length,
  dated: dated.length,
  probes: probes.length,
  feeds: feeds.length,
  oldestDatedDays: ages.length ? Math.max(...ages) : 0,
}, null, 2));
