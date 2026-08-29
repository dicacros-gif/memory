/**
 * Capital precedence gate.
 *
 * The block used to display an authored CapEx figure and keep the crawl's
 * finding beside it as a footnote, so the number a reader saw went stale the
 * moment the company announced a new one. What a company is spending and what
 * an executive said are reported facts: the observation is the value, the
 * authored line is only a fallback, and every displayed value says which it is.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const directory = await readFile(new URL("./company-directory.mjs", import.meta.url), "utf8");
const profile = await readFile(new URL("../assets/js/company-profile.js", import.meta.url), "utf8");
const plans = JSON.parse(await readFile(new URL("../data/capital-plans.json", import.meta.url), "utf8"));

// The observation has to be assigned to the displayed field, not parked beside it.
assert.match(directory, /row\.capex\s*=\s*observed\.amount/,
  "an observed amount must become the CapEx value");
assert.match(directory, /row\.comment\s*=\s*quote\.text/,
  "an observed executive quote must become the comment");

// And the authored value has to survive, labelled, for accounts the feed misses.
assert.match(directory, /row\.capexBaseline\s*=\s*curated\.capex/,
  "the authored figure is kept as a labelled baseline, not discarded");
for (const field of ["capexBasis", "commentBasis"]) {
  assert.ok(directory.includes(field), `${field} must be emitted so the reader can tell them apart`);
  assert.ok(profile.includes(field), `${field} must be rendered`);
}
assert.ok(directory.includes("\"관측\"") && directory.includes("\"기준선\""),
  "both bases must be named");

// The user's rule: no bare source link — the line itself is the link.
assert.match(profile, /<a href="\$\{escapeHTML\(evidence\.url\)\}"[^]*?escapeHTML\(evidence\.value\)/,
  "an observed value must be the link target rather than carrying a separate 출처 link");

// The curated file is a fallback, so it must still hold something to fall back to.
const rows = Object.values(plans.plans || {});
assert.ok(rows.length >= 5, "the baseline must cover the named accounts");
for (const row of rows) {
  assert.ok(row.memoryRead && String(row.memoryRead).trim(),
    "every baseline row must state what it means for memory, which is the part the crawl cannot derive");
}

console.log(JSON.stringify({ status: "capital-precedence-pass", baselineAccounts: rows.length }, null, 2));
