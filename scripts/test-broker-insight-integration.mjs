import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { QA_BRIEF_GUIDES, QA_SOLUTION_OPTIONS } from "../assets/js/qa-brief-model.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const json = async (path) => JSON.parse(await read(path));
const [accounts, baseline, roster, catalog, directory, app] = await Promise.all([
  json("data/accounts.json"), json("data/company-baseline.json"),
  json("data/ai-player-watch.json"), json("data/source-catalog.json"),
  json("data/company-directory-client.json"), read("assets/js/app.js"),
]);
const account = (id) => accounts.accounts.find((row) => row.id === id);
const profile = (id) => directory.profiles.find((row) => row.id === id);
const source = catalog.sources.find((row) => row.id === "ms-google-asic-2026-08");
assert.equal(source.sourceClass, "research");
assert.equal(source.enabled, false, "a supplied research PDF is not an automated primary-source feed");
assert.equal(source.documentReference.publishedAt, "2026-08-24");
assert.equal(source.documentReference.urlScope, "publisher-portal-not-direct-report");
for (const relation of accounts.ecosystemRelations.filter((row) => row.sourceId === source.id)) {
  assert.notEqual(relation.claim, "verified-fact", `${relation.id}: broker assumptions cannot become official relationships`);
}

assert.match(account("google").chip, /7세대.*8세대/);
assert.match(account("google").relationship, /8t MediaTek·8i Broadcom.*공식 배정 미확인/);
assert.doesNotMatch(JSON.stringify(account("google")), /파생 SKU|세대는 v7 공통/);
assert.match(account("google").memory, /216→576GB.*공식 v9 사양이 아닌/);
assert.match(account("mediatek").baseline[0].value, /2027E 130–150억 달러 → 2028E 430–450억 달러.*확정 수주 아님/);
assert.match(account("mediatek").memory, /1\.8만 달러.*Compute KGD 제외.*HBM 가격/);
assert.equal(800_000 * 10_000, 8_000_000_000, "Alchip's assigned units × HBM-excluded ASP, not total AWS units");
assert.match(account("alchip").baseline[0].value, /80억 달러 = 배정 80만 개 × ASP 1만 달러\(HBM 제외\)/);
assert.match(account("alchip").pain, /전사 매출총이익률 2026E 22\.5%→2028E 15\.4% 추정/);
assert.match(account("guc").pain, /Google CPU 턴키 프로젝트 매출총이익률 약 10% 추정.*전사 이익률 아님/);

for (const id of ["google", "aws", "mediatek", "alchip", "guc"]) {
  const evidence = baseline.companies[id].sources.find((row) => /morganstanley\.com/.test(row.url));
  assert.equal(evidence?.grade, "TIER 3 · RESEARCH", `${id}: preserve separate research attribution`);
  assert.equal(evidence.observedAt, "2026-08-24");
  assert.deepEqual(profile(id).baseline, { ...baseline.companies[id], basis: "기준선", sources: profile(id).baseline.sources },
    `${id}: client profile must contain the revised authored analysis`);
  assert.equal(profile(id).baseline.sources.find((row) => /morganstanley\.com/.test(row.url)).grade, "TIER 3 · RESEARCH");
}

const start = app.indexOf("  const AI_INFRA_QA_PRESETS = Object.freeze([");
const end = app.indexOf("  const CATEGORY_RENDER_BUDGET_MS", start);
const presets = vm.runInNewContext(app.slice(start, end) + "\nAI_INFRA_QA_PRESETS");
assert.deepEqual(Array.from(presets, (pair) => pair.cat), ["industry", "customer", "workload", "solution", "newbiz", "insights", "qualification", "execution"],
  "deepen existing questions rather than append a brokerage summary section");
const pair = (cat) => presets.find((row) => row.cat === cat);
assert.match(pair("industry").a, /2026E 약 300억→2027E 약 500억 Gb\(기가비트\).*전망/);
assert.match(pair("workload").a, /1,900만.*2kW = 38GW.*칩 TDP 시나리오.*총부하·연간 전력소비량 아님/);
assert.match(pair("qualification").a, /연간 수요.*139\.4만.*269\.4만.*93%.*연말 월간 생산능력 17만→28만/);
assert.match(pair("qualification").strategy.business, /월간 캐파 × 12.*사용하지 않음/);
assert.match(pair("execution").strategy.business, /전사 매출총이익률/);
assert.equal(roster.chain.length, 6);
assert.equal(roster.tiers.flatMap((tier) => tier.players).length, 13);
assert.match(roster.chain[3].hint, /Gb\(기가비트\).*pp\.9·12 전망/);

// Exercise the existing dialog renderer: numerical units and caveats must not
// disappear when the revised strings are placed in the five existing stages.
const renderStart = app.indexOf("  function qaStrategyPackHTML(");
const renderEnd = app.indexOf("\n  function ", renderStart + 1);
const context = vm.createContext({ QA_BRIEF_GUIDES, QA_SOLUTION_OPTIONS,
  executiveBulletCopy: (value) => value, escapeHTML: (value) => String(value ?? "") });
vm.runInContext(app.slice(renderStart, renderEnd), context);
for (const item of presets) {
  const html = context.qaStrategyPackHTML(item, item.q);
  assert.ok(html.includes(item.a), `${item.cat}: complete answer must render`);
  for (const field of ["memory", "business", "partner", "action"]) {
    assert.ok(html.includes(item.strategy[field]), `${item.cat}: ${field} must not be truncated`);
  }
}
console.log("Broker insights: existing surfaces enriched; units, forecast scopes, research grades and full rendering verified");
