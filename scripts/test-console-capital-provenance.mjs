#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [profileUI, strategyUI, payload] = await Promise.all([
  readFile(new URL("assets/js/company-profile.js", root), "utf8"),
  readFile(new URL("assets/js/strategy-experience.js", root), "utf8"),
  readFile(new URL("data/console-capital-plans.json", root), "utf8").then(JSON.parse),
]);

const evidenceFields = ["capex", "plan", "comment", "contractBoundary", "memoryRead"];
for (const [account, plan] of Object.entries(payload.plans || {})) {
  for (const field of evidenceFields) {
    if (!String(plan[field] || "").trim()) continue;
    assert.ok(String(plan[`${field}Basis`] || "").trim(), `${account}.${field} must declare its basis`);
    assert.match(String(plan[`${field}Url`] || ""), /^https?:\/\//, `${account}.${field} must carry its exact source URL`);
    assert.match(String(plan[`${field}AsOf`] || ""), /^20\d{2}-\d{2}-\d{2}$/, `${account}.${field} must carry a day-precision source date`);
  }
  if (String(plan.outlook?.window || "").trim()) {
    assert.ok(String(plan.outlookBasis || "").trim(), `${account}.outlook must declare its basis`);
    assert.match(String(plan.outlookUrl || ""), /^https?:\/\//, `${account}.outlook must carry its exact source URL`);
    assert.match(String(plan.outlookAsOf || ""), /^20\d{2}-\d{2}-\d{2}$/, `${account}.outlook must carry a day-precision source date`);
  }
}

for (const [name, source] of [["company profile", profileUI], ["strategy experience", strategyUI]]) {
  assert.match(source, /capitalFieldEvidence/, `${name} must use the field evidence gate`);
  assert.ok(source.includes('plan?.[`${field}Basis`]'), `${name} must require a field-specific basis`);
  assert.ok(source.includes('plan?.[`${field}Url`]'), `${name} must require a field-specific URL`);
  assert.ok(source.includes('plan?.[`${field}AsOf`]'), `${name} must require a field-specific date`);
  assert.doesNotMatch(source, /capital(?:Plan)?[^\n]{0,120}(?:sources\?\.\[0\]|sources\[0\])/, `${name} must not fall back to the first plan source`);
  for (const field of ["plan", "contractBoundary", "memoryRead", "outlook"]) {
    assert.match(source, new RegExp(`${field}(?:Basis|Url|AsOf)`), `${name} must preserve ${field} provenance`);
  }
}

assert.match(profileUI, /capitalFieldEvidence\(plan, "plan", planValue, strictEvidence\)/, "plan rows must fail closed in Console mode");
assert.match(profileUI, /capitalFieldEvidence\(plan, "contractBoundary"/, "contract rows must fail closed in Console mode");
assert.match(profileUI, /capitalFieldEvidence\(plan, "memoryRead"/, "MEMORY READ must use exact field evidence");
assert.match(profileUI, /capitalFieldEvidence\(plan, "outlook"/, "INSIGHT must use exact field evidence");
assert.match(profileUI, /data-basis=/, "field basis must be visible as a badge");
assert.match(strategyUI, /capitalEvidence\.length \?/, "the account brief must disappear when no verified field survives");
assert.ok(strategyUI.includes('formatPublicDate(plan?.[`${field}AsOf`])'), "account brief dates must render as M/D");

console.log(JSON.stringify({ status: "console-capital-provenance-pass", accounts: Object.keys(payload.plans || {}).length }, null, 2));
