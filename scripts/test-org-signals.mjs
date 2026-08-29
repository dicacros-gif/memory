/**
 * Organisation signal gate.
 *
 * Naming the wrong person in the wrong chair is worse than showing no chair at
 * all, and calling a reported statement a direct quote is worse than saying it
 * was reported. So the gate holds both: a name is only given a role when it
 * sits beside one, and the two kinds of evidence never merge.
 */
import assert from "node:assert/strict";
import { buildOrgSignals, extractPeople, extractStatement } from "./org-signals.mjs";

/* -------------------------------------------------------------- who is who */

assert.deepEqual(
  extractPeople("Jensen Huang, CEO of NVIDIA, on AI infrastructure"),
  [{ name: "Jensen Huang", role: "CEO" }],
  "a name beside a chair is read",
);
assert.deepEqual(
  extractPeople("NVIDIA CEO Jensen Huang said demand is strong"),
  [{ name: "Jensen Huang", role: "CEO" }],
  "and in the other order",
);

// The specific error worth preventing: a person mentioned in the same article
// as a chair somebody else holds.
assert.deepEqual(
  extractPeople("The CEO spoke after Sarah Chen published the benchmark"),
  [],
  "a name that does not sit beside a role must not be given one",
);

// A company that reads like a name.
assert.deepEqual(extractPeople("Marvell Technologies Inc, CEO commentary"), [],
  "a company name must not be filed as a person");
assert.deepEqual(extractPeople("공동 CEO가 메모리 공급을 설명했다"), [],
  "a Korean modifier beside a role must not be filed as a person");

// The longer title wins over the shorter one it contains.
assert.deepEqual(
  extractPeople("Chief Financial Officer Sarah Friar on compute spending"),
  [{ name: "Sarah Friar", role: "CFO" }],
  "the specific chair wins over the generic one inside it",
);

/* --------------------------------------------------- said versus reported */

const quoted = extractStatement("Executive: “Compute is the scarcest resource we have” said the CFO");
assert.equal(quoted.kind, "직접 인용");
assert.match(quoted.text, /scarcest resource/);

const reported = extractStatement("Microsoft said its AI data center backlog is power constrained · summary");
assert.equal(reported.kind, "보도", "an unquoted attribution is reported, never a quote");

assert.equal(extractStatement("Memory prices rose again this quarter"), null,
  "no attribution means no statement");
// The bug this prevents: an apostrophe read as an opening quote turned the
// rest of a headline into a fabricated direct quote attributed to the company.
const apostrophe = extractStatement("NVIDIA’s supply commitments soar as memory costs surge, the company said");
assert.notEqual(apostrophe?.kind, "직접 인용", "an apostrophe must never open a quote");

assert.equal(extractStatement("The chef said the soup was excellent"), null,
  "an attributed statement about nothing relevant is not an infrastructure read");

/* -------------------------------------------------------------- fail closed */

const accounts = [{ id: "nvidia", company: "NVIDIA", aliases: ["nvidia"] }];
assert.deepEqual(buildOrgSignals({ accounts }).accounts, {}, "no observation must produce nothing");

assert.deepEqual(
  buildOrgSignals({
    accounts,
    news: [{ title: "AMD CEO Lisa Su on data center GPU", date: "2026-08-20", link: "https://example.com/a" }],
  }).accounts,
  {},
  "an article that never names the account must not attach to it",
);

const built = buildOrgSignals({
  accounts,
  news: [
    { title: "NVIDIA CEO Jensen Huang said HBM supply limits shipments", date: "2026-08-20", link: "https://example.com/a" },
    { title: "NVIDIA CEO Jensen Huang on Blackwell memory capacity", date: "2026-08-22", link: "https://example.com/b" },
  ],
});
const row = built.accounts.nvidia;
assert.ok(row, "an account named alongside a chair must surface");
assert.equal(row.people[0].name, "Jensen Huang");
assert.equal(row.people[0].seenCount, 2, "repeat sightings are counted so a reader can weigh them");
assert.ok(row.statements.length, "and what was said is kept beside who said it");
assert.equal(row.statements[0].speaker, "Jensen Huang", "attribution only when the same item named someone");
assert.ok(row.statements.every((item) => item.kind === "직접 인용" || item.kind === "보도"));

const replayed = buildOrgSignals({
  accounts,
  previous: built,
  news: [
    { title: "NVIDIA CEO Jensen Huang said HBM supply limits shipments", date: "2026-08-20", link: "https://example.com/a" },
    { title: "NVIDIA CEO Jensen Huang on Blackwell memory capacity", date: "2026-08-22", link: "https://example.com/b" },
  ],
});
assert.equal(replayed.accounts.nvidia.people[0].seenCount, 2,
  "replaying the same evidence must not inflate a person's sighting count");
assert.equal(replayed.coverage.newThisRun, 0,
  "replaying an unchanged input must not create new organisation signals");

console.log(JSON.stringify({
  status: "org-signals-pass",
  roles: [...new Set(built.accounts.nvidia.people.map((item) => item.role))],
}, null, 2));
