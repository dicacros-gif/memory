/**
 * Memory demand derivation gate.
 *
 * The point of the derivation is leverage: rules are O(technologies) and the
 * output is O(companies × technologies), so adding a company or a term must
 * produce requirements with no data edited. This gate holds that property, and
 * holds the pipeline honest about what it has not mapped.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { deriveMemoryDemand } from "./memory-demand.mjs";

const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const map = await read("../data/technology-memory-map.json");
const signals = await read("../data/company-signals.json");

/* ------------------------------------------------------------- rule integrity */

const rules = map.rules || {};
assert.ok(Object.keys(rules).length >= 20, "the rule table must cover the vocabulary the extractor recognises");
for (const [label, rule] of Object.entries(rules)) {
  for (const field of ["systemShift", "memoryNeed", "productAxis", "stage", "gate"]) {
    assert.ok(rule[field] && String(rule[field]).trim(), `${label} must state ${field}`);
  }
  // A rule that repeats the technology name as its own requirement explains
  // nothing; the requirement has to be a different statement.
  assert.notEqual(rule.memoryNeed.trim(), label, `${label} must translate into a requirement, not repeat itself`);
}

// Every technology the extractor can emit must have a rule, or the derivation
// silently drops it.
const extractor = await readFile(new URL("./company-signals.mjs", import.meta.url), "utf8");
const emitted = [...extractor.matchAll(/\["([^"]+)",\s*\//g)].map((match) => match[1]);
assert.ok(emitted.length >= 20, "the extractor vocabulary should have been found");
const missing = emitted.filter((label) => !rules[label]);
assert.deepEqual(missing, [], "every technology the extractor emits needs a translation rule");

/* -------------------------------------------------------------- fail-closed */

const empty = deriveMemoryDemand({ signals: { companies: {} }, map });
assert.deepEqual(empty.companies, {}, "no observation must produce no requirement");
assert.deepEqual(empty.rollup, [], "no observation must produce no roll-up");

const unmapped = deriveMemoryDemand({
  signals: { companies: { acme: { tech: [{ label: "Warp Drive", seenCount: 9 }] } } },
  map,
});
assert.deepEqual(unmapped.companies, {}, "an unmapped technology must not invent a requirement");
assert.deepEqual(unmapped.coverage.unmappedTechnologies, ["Warp Drive"], "and must be reported rather than swallowed");

/* ----------------------------------------------------------------- leverage */

const derived = deriveMemoryDemand({ signals, map, runId: "gate" });
assert.ok(derived.coverage.derivedRequirements > 0, "the live signal set must derive something");
assert.deepEqual(derived.coverage.unmappedTechnologies, [], "the live vocabulary must be fully mapped");
assert.ok(
  derived.coverage.derivedRequirements >= derived.coverage.companiesWithDerivedDemand,
  "each covered company must carry at least one requirement",
);

// A company the feed has never mentioned gets nothing; adding it to the feed is
// the only thing that changes that.
const before = deriveMemoryDemand({ signals, map }).coverage.derivedRequirements;
const after = deriveMemoryDemand({
  signals: {
    companies: {
      ...signals.companies,
      newcomer: { tech: [{ label: "CXL", seenCount: 3, headline: "x", firstSeen: "2026-08-01", lastSeen: "2026-08-20" }] },
    },
  },
  map,
});
assert.equal(after.coverage.derivedRequirements, before + 1, "a newly observed company must derive without any data edit");
assert.ok(after.companies.newcomer.requirements[0].memoryNeed, "and must carry the rule's requirement");
assert.equal(after.companies.newcomer.requirements[0].evidenceCount, 3,
  "the requirement must retain the observation count for downstream validation");

/* ------------------------------------------------------------------ roll-up */

for (const row of derived.rollup) {
  assert.ok(row.accountCount >= 1 && row.accounts.length === row.accountCount);
  assert.ok(row.technologies.length >= 1);
}
const counts = derived.rollup.map((row) => row.accountCount);
assert.deepEqual(counts, [...counts].sort((a, b) => b - a), "the roll-up must lead with the broadest requirement");

console.log(JSON.stringify({
  status: "memory-demand-pass",
  rules: Object.keys(rules).length,
  ...derived.coverage,
}, null, 2));
