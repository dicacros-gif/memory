#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildInsightLedger } from "./insight-ledger.mjs";
import { technologyTranslation } from "./site-content.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (name) => JSON.parse(readFileSync(resolve(root, "data", name), "utf8"));
const accounts = readJson("accounts.json");
const memoryMap = readJson("technology-memory-map.json");
const appSource = readFileSync(resolve(root, "assets", "js", "app.js"), "utf8");
const cssSource = readFileSync(resolve(root, "assets", "css", "styles.css"), "utf8");

const requiredRules = [
  "Disaggregated Inference",
  "Agentic Inference",
  "MoE",
  "Multimodal Inference",
  "Context Caching",
];
requiredRules.forEach((key) => assert.ok(memoryMap.rules[key], `missing Technology→Memory rule: ${key}`));

const lenses = accounts.technologyOpportunityLenses || [];
const normalizedMapKeys = new Set(Object.keys(memoryMap.rules || {}).map((key) => key.toLocaleLowerCase("en-US")));
assert.ok(lenses.length >= 10, "technology opportunity radar must cover the expanded signal set");
lenses.forEach((lens) => {
  assert.ok(Number(lens.promotionRule?.minMentions || 0) >= 2, `${lens.id}: minMentions must be >= 2`);
  assert.ok(Number(lens.promotionRule?.minSources || 0) >= 2, `${lens.id}: minSources must be >= 2`);
  const keys = [...(lens.memoryMapKeys || []), lens.label, ...(lens.aliases || [])]
    .filter(Boolean)
    .map((key) => String(key).trim().toLocaleLowerCase("en-US"));
  assert.ok(keys.some((key) => normalizedMapKeys.has(key)), `${lens.id}: missing approved translation key`);
});

const validSignal = {
  id: "validated-hbf",
  label: "HBF",
  memoryMapKeys: ["HBF"],
  status: "opportunity-candidate",
  mentions: 3,
  sourceCount: 2,
  promotionRule: { minMentions: 2, minSources: 2 },
  latest: {
    title: "Official HBF technology update",
    source: "Official newsroom",
    date: "2026-08-26T00:00:00.000Z",
    url: "https://example.com/official-hbf",
    sourceClass: "official",
  },
};
const translated = technologyTranslation(validSignal);
assert.equal(translated.status, "opportunity-candidate");
assert.equal(translated.evidenceStatus, "cross-checked");
assert.equal(translated.translation?.productAxis, "AI-NAND");
assert.equal(translated.source?.url, validSignal.latest.url);

const weakSignal = technologyTranslation({
  ...validSignal,
  id: "weak-hbf",
  sourceCount: 1,
});
assert.equal(weakSignal.status, "monitoring");
assert.equal(weakSignal.source, null);

const ledger = buildInsightLedger({
  intelligence: { technologyOpportunities: [validSignal, { ...validSignal, id: "weak", sourceCount: 1 }] },
  previous: {
    entries: [{
      id: "opportunity-candidate:stale-unsourced",
      kind: "opportunity-candidate",
      headline: "근거 없는 이전 기술 후보",
      url: "",
    }, {
      id: "opportunity-candidate:stale-legacy",
      kind: "opportunity-candidate",
      headline: "검증 메타데이터 없는 이전 기술 후보",
      url: "https://example.com/legacy",
    }],
  },
  now: new Date("2026-08-27T00:00:00.000Z"),
  runId: "test-run",
});
assert.equal(ledger.entries.length, 1, "only fully verified technology candidates may enter the ledger");
assert.equal(ledger.entries[0].url, validSignal.latest.url);

const replayedLedger = buildInsightLedger({
  intelligence: { technologyOpportunities: [validSignal] },
  previous: ledger,
  now: new Date("2026-08-27T06:00:00.000Z"),
  runId: "test-run-2",
});
assert.equal(replayedLedger.entries[0].seenCount, 1, "replaying one source must not inflate insight persistence");
assert.equal(replayedLedger.entries[0].lastSeen, ledger.entries[0].lastSeen, "a replay must not look like a new observation");

// The radar has to state a chain from a technology signal through to something
// that gates a decision — a signal with no gate at the end is a headline. The
// links were renamed in c0defcbd ("Refine console interaction design") and this
// assertion kept naming the old ones, so it was pinning the wording rather than
// the requirement. It now pins the two ends and the arrow between them.
assert.match(appSource, /기술 신호 →[^"]*Qualification[^"]*/);
// The strip that recited the sourcing rule beside the question list is gone —
// it restated a policy the labels already carry. What must survive is the rule
// itself being applied where a candidate is admitted.
assert.match(appSource, /독립 출처 2개 또는 공식·공시 원문 1건/);
assert.doesNotMatch(appSource, /qaPreview[\s\S]{0,180}slice\(0,\s*96\)/, "QA preview must not hard-truncate copy");
assert.match(cssSource, /\.qa-options-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,/);
assert.match(cssSource, /\.sc-future-memory-flow\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,/);
assert.match(cssSource, /\.qa-option strong[\s\S]{0,300}overflow-wrap:\s*anywhere/);

console.log(JSON.stringify({
  ok: true,
  lenses: lenses.length,
  translationRules: Object.keys(memoryMap.rules || {}).length,
  ledgerEntries: ledger.entries.length,
}, null, 2));
