/**
 * Baseline gate.
 *
 * The baseline exists so a company brief says something true before the crawl
 * has observed anything about that account. That only works if two things hold:
 * every claim is checkable, and the baseline never passes itself off as an
 * observation. A researched line that hides its age reads as current when it is
 * not, which is the failure this prevents.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const baseline = JSON.parse(await readFile(new URL("../data/company-baseline.json", import.meta.url), "utf8"));
const accountModel = JSON.parse(await readFile(new URL("../data/accounts.json", import.meta.url), "utf8"));
const directory = await readFile(new URL("./company-directory.mjs", import.meta.url), "utf8");
const profile = await readFile(new URL("../assets/js/company-profile.js", import.meta.url), "utf8");

const companies = baseline.companies || {};
const ids = Object.keys(companies);
assert.ok(ids.length >= 10, "the baseline must cover the accounts the board is built around");

// An account can live in either registry: the strategy accounts, or the OEM and
// ODM automation. A baseline for a name in neither is a baseline for nobody.
const { OEM_ODM_AUTOMATION } = await import("./oem-odm-automation.mjs");
const known = new Set([
  ...(accountModel.accounts || []).map((row) => row.id),
  ...OEM_ODM_AUTOMATION.map((row) => row.id),
]);
const ISO = /^\d{4}-\d{2}-\d{2}$/;

for (const [id, row] of Object.entries(companies)) {
  assert.ok(known.has(id), `${id} must be a real account, not a name that no longer exists`);
  for (const field of ["chipStrategy", "constraint", "memoryRead", "asOf"]) {
    assert.ok(row[field] && String(row[field]).trim(), `${id} must state ${field}`);
  }
  assert.match(row.asOf, ISO, `${id} must date its baseline so a reader can see how old it is`);

  // Every factual line has to be checkable. memoryRead is our reading, not an
  // observation, and is exempt by design — but the facts it rests on are not.
  const sources = row.sources || [];
  assert.ok(sources.length, `${id} must carry at least one source`);
  for (const source of sources) {
    assert.match(String(source.url || ""), /^https:\/\//, `${id} sources must be reachable links`);
    assert.ok(source.label && source.label.trim(), `${id} sources must say what they are`);
  }
}

// Industry-level facts are held to the same standard.
assert.ok(baseline.industry?.constraint && baseline.industry?.asOf, "the industry baseline must be stated and dated");
assert.ok((baseline.industry.sources || []).every((item) => /^https:\/\//.test(item.url || "")));

// Precedence: the baseline is a fallback and says so.
assert.match(directory, /basis:\s*"기준선"/, "the baseline must be labelled as one wherever it is exposed");
assert.ok(profile.includes("company-baseline"), "the brief must render it");
assert.ok(profile.includes("row.asOf"), "and show when it was checked");
assert.ok(profile.includes('["PAIN POINT", row.painPoint || row.constraint]'),
  "the customer-facing brief must label constraints as Pain Point");
assert.ok(profile.includes("shortDate(row.asOf)"),
  "the visible date must use the compact M/D consulting format");
assert.ok(profile.includes("sourceLabel(item)"),
  "every baseline source must expose its evidence grade");
assert.match(directory, /TIER 1 · OFFICIAL/,
  "the directory must classify official company evidence before rendering it");

for (const id of ["nvidia", "aws", "microsoft", "google", "meta", "openai", "anthropic", "marvell"]) {
  assert.ok((companies[id]?.sources || []).every((source) => source.grade === "TIER 1 · OFFICIAL"),
    `${id} corrected baseline must use first-party evidence only`);
}
// An observed silicon programme is shown as the live reading beside it.
assert.ok(profile.includes("profile.silicon?.programs"),
  "an observation must be shown alongside the baseline rather than hidden behind it");

console.log(JSON.stringify({
  status: "company-baseline-pass",
  accounts: ids.length,
  sources: Object.values(companies).reduce((total, row) => total + (row.sources || []).length, 0),
}, null, 2));

// Keep the account baseline and the broader fact-correction regression gate
// inseparable: both fast and full checks already execute this file.
await import("./test-fact-corrections.mjs");
