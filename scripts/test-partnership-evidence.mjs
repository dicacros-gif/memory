/**
 * Partnership evidence gate.
 *
 * A relationship shown on the site reads as a fact about who works with whom,
 * and a wrong one costs more than a missing one. So every supplier or partner
 * relationship must carry a reachable source, and anything that is a hypothesis
 * must say so in its own status rather than borrowing the look of a confirmed
 * relationship.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const directory = await read("../data/company-directory-client.json");

const httpUrl = (value) => /^https?:\/\/\S+$/.test(String(value || ""));

// A status that names the relationship as unconfirmed. Anything else is read as
// an assertion and therefore needs a source.
const HYPOTHESIS = /후보|가설|검증\s*전|hypothesis|potential|candidate|watch/i;

const findings = [];
let checked = 0;
let sourced = 0;
let hypothesis = 0;

for (const profile of directory.profiles || []) {
  const relations = [
    ...(profile.memoryLens?.supplierRelations || []).map((row) => ({ ...row, where: "memoryLens.supplierRelations" })),
    ...(profile.ecosystem?.supplierRelations || []).map((row) => ({ ...row, where: "ecosystem.supplierRelations" })),
  ];
  for (const relation of relations) {
    checked += 1;
    const status = String(relation.status || "");
    const url = relation.source?.url || relation.url || "";
    if (HYPOTHESIS.test(status)) { hypothesis += 1; continue; }
    if (httpUrl(url)) { sourced += 1; continue; }
    findings.push({
      company: profile.id,
      where: relation.where,
      supplier: relation.supplier || relation.partner || "(unnamed)",
      status: status || "(no status)",
    });
  }
}

if (findings.length) {
  console.error(`relationships asserted without a reachable source (${findings.length}):`);
  for (const finding of findings.slice(0, 20)) {
    console.error(`  ${finding.company} · ${finding.supplier} · ${finding.status} (${finding.where})`);
  }
}
console.log(JSON.stringify({ checked, sourced, hypothesis, findings: findings.length }));
assert.equal(findings.length, 0, "a relationship is either sourced or labelled a hypothesis");
