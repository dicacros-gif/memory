/**
 * Pain point gate.
 *
 * The value of deriving these is that one rule covers every account and an
 * account with nothing observed gets nothing. So the gate holds exactly that:
 * no observation produces no card, an account that designs both halves of the
 * workload gets the dual-axis reading that a single-chip model could not
 * produce, and every card names what in the observation made it fire.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildPainPoints } from "./pain-points.mjs";

const rules = JSON.parse(await readFile(new URL("../data/pain-point-rules.json", import.meta.url), "utf8"));

assert.ok((rules.rules || []).length >= 5, "the table must carry enough rules to be worth deriving");
for (const rule of rules.rules) {
  for (const field of ["id", "when", "pain", "cause", "answer", "newBiz", "metric"]) {
    assert.ok(rule[field], `${rule.id || "rule"} must state ${field}`);
  }
  assert.ok(Object.keys(rule.when).length, `${rule.id} must state a condition rather than always firing`);
  assert.ok((rule.products || []).length, `${rule.id} must name the products to propose`);
}

// Fail closed.
assert.deepEqual(buildPainPoints({ rules }).accounts, {}, "no observation must produce no card");
assert.deepEqual(
  buildPainPoints({ rules, silicon: { aws: { programs: [], designers: [] } } }).accounts,
  {},
  "an empty silicon row must not produce a card",
);

// The case the single-chip model could not hold: one account, both halves.
const both = buildPainPoints({
  rules,
  accounts: [{ id: "aws", layer: "end-customer", company: "Amazon AWS" }],
  silicon: { aws: { coversTraining: true, coversInference: true, designers: ["AWS"], programs: [{}] } },
});
const awsIds = both.accounts.aws.painPoints.map((card) => card.id);
assert.ok(awsIds.includes("dual-axis"), "an account with both halves must get the dual-axis reading");
assert.ok(awsIds.includes("inference-kv-cache") && awsIds.includes("training-bandwidth"),
  "and both single-axis readings alongside it");

// Inference only must not pick up the training reading.
const inferenceOnly = buildPainPoints({
  rules,
  accounts: [{ id: "meta", layer: "end-customer", company: "Meta" }],
  silicon: { meta: { coversInference: true, coversTraining: false, designers: ["Meta"], programs: [{}] } },
});
const metaIds = inferenceOnly.accounts.meta.painPoints.map((card) => card.id);
assert.ok(metaIds.includes("inference-kv-cache"));
assert.ok(!metaIds.includes("training-bandwidth"), "one inference part must not imply a training pain");
assert.ok(!metaIds.includes("dual-axis"));

// Running someone else's silicon is a different exposure from designing it.
const merchant = buildPainPoints({
  rules,
  accounts: [{ id: "oracle", layer: "end-customer", company: "Oracle" }],
  silicon: { oracle: { coversTraining: true, designers: ["NVIDIA"], programs: [{}] } },
});
assert.ok(merchant.accounts.oracle.painPoints.some((card) => card.id === "merchant-dependency"),
  "an account running外部 silicon must get the supply-ceiling reading");
assert.ok(!both.accounts.aws.painPoints.some((card) => card.id === "merchant-dependency"),
  "an account whose only designer is itself must not");

// Every card has to be checkable.
for (const row of Object.values(both.accounts)) {
  for (const card of row.painPoints) {
    assert.ok(card.basis && card.basis.trim(), "every card must name what made it fire");
  }
}

// A demand-side account can derive a card from memory demand alone, but a
// memory supplier cannot inherit the same buyer pain from a product mention.
const fromDemand = buildPainPoints({
  rules,
  accounts: [
    { id: "dell", layer: "oem-tier-1", company: "Dell" },
    { id: "cxmt", layer: "memory-supplier", company: "CXMT" },
  ],
  memoryDemand: {
    dell: { requirements: [{ productAxis: "AI-NAND · LPDDR" }] },
    cxmt: { requirements: [{ productAxis: "AI-NAND · LPDDR" }] },
  },
});
assert.ok(fromDemand.accounts.dell.painPoints.some((card) => card.id === "retrieval-storage"),
  "a demand-side product axis alone must be able to fire a rule");
assert.equal(fromDemand.accounts.cxmt, undefined,
  "a supplier product mention must not become a customer pain point");

console.log(JSON.stringify({
  status: "pain-points-pass",
  rules: rules.rules.length,
}, null, 2));
