import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { calculateEconomics } from "../assets/js/strategy-economics-model.js";

const root = new URL("../", import.meta.url);
const [html, runtime] = await Promise.all([
  readFile(new URL("index.html", root), "utf8"),
  readFile(new URL("assets/js/strategy-experience.js", root), "utf8"),
]);

const baseline = {
  dailyQueries: "10",
  tokensPerQuery: "2500",
  costPerMillion: "3.5",
  costReduction: "18",
  incrementalCapex: "12",
};

for (const invalid of [
  {},
  { ...baseline, dailyQueries: "" },
  { ...baseline, tokensPerQuery: 0 },
  { ...baseline, costPerMillion: -1 },
  { ...baseline, costReduction: 0 },
  { ...baseline, costReduction: 100 },
  { ...baseline, incrementalCapex: 0 },
]) assert.equal(calculateEconomics(invalid), null, "missing or invalid required values must hide every result");

const result = calculateEconomics({
  ...baseline,
  grossMargin: "45",
  tamAccounts: "24",
  samAccounts: "10",
  somAccounts: "3",
  annualDealValue: "80",
  throughputQps: "1200",
  powerKw: "95",
  bandwidthGbps: "7200",
  usableCapacityTb: "48",
  solutionCostMillion: "6",
});

assert.ok(result);
assert.equal(result.annualTokens, 9_125_000_000_000);
assert.equal(result.baselineAnnualCost, 31_937_500);
assert.equal(result.proposedAnnualCost, 26_188_750);
assert.equal(result.annualSaving, 5_748_750);
assert.ok(Math.abs(result.paybackMonths - 25.048923) < .00001);
assert.ok(Math.abs(result.threeYearRoi - 43.71875) < .00001);
assert.ok(Math.abs(result.baselineCostPerQuery - .00875) < 1e-12);
assert.ok(Math.abs(result.proposedCostPerQuery - .007175) < 1e-12);
assert.equal(result.proposedCostPerMillion, 2.87);
assert.equal(result.grossMargin, 45);
assert.deepEqual(result.market, { tamMillion: 1920, samMillion: 800, somMillion: 240 }, "legacy field names must preserve the account-pipeline calculation");
assert.ok(Math.abs(result.efficiency.performancePerWatt - (1200 / 95_000)) < 1e-12);
assert.equal(result.efficiency.bandwidthPerMillion, 1200);
assert.equal(result.efficiency.capacityPerMillion, 8);
assert.ok(Object.values(result).flatMap((value) => typeof value === "object" && value ? Object.values(value) : [value]).every((value) => value === null || typeof value !== "number" || Number.isFinite(value)));

const partial = calculateEconomics({ ...baseline, tamAccounts: 24, samAccounts: 10, throughputQps: 1200 });
assert.equal(partial.market, null, "partial account-pipeline inputs must not manufacture values");
assert.equal(partial.efficiency.performancePerWatt, null, "partial efficiency inputs must stay hidden");
assert.equal(partial.efficiency.bandwidthPerMillion, null);
assert.equal(partial.efficiency.capacityPerMillion, null);
assert.equal(partial.grossMargin, null);

const invalidAccountValueOrder = calculateEconomics({ ...baseline, tamAccounts: 3, samAccounts: 10, somAccounts: 2, annualDealValue: 80 });
assert.equal(invalidAccountValueOrder.market, null, "the account universe must not be smaller than its qualified or winnable subsets");

assert.match(html, /id="accountPipelineValueBoundary"[^>]*>[^<]*계정 파이프라인 가치 · 시장 전체 TAM\/SAM\/SOM 아님/);
assert.doesNotMatch(html, /<legend>\s*선택\s*·\s*Market Sizing\s*<\/legend>/i, "account-count inputs must not be presented as market sizing");
assert.match(runtime, /const economics = calculateEconomics\(values\)/);
assert.match(runtime, /results\.hidden = !economics/);
for (const label of ["$/1M TOKEN", "$/QUERY", "전체 대상 계정 가치", "Qualification 가능 가치", "수주 가능 가치", "PERFORMANCE/W", "BANDWIDTH/$", "CAPACITY/$"]) {
  assert.ok(runtime.includes(label), `missing calculated output: ${label}`);
}
for (const boundary of ["시장 전체 TAM이 아님", "시장 전체 SAM이 아님", "시장 전체 SOM이 아님"]) {
  assert.ok(runtime.includes(boundary), `missing account-value boundary: ${boundary}`);
}
assert.doesNotMatch(runtime, /outputs\.push\(\["(?:TAM|SAM|SOM)"/, "account pipeline values must not use market-sizing labels");

console.log(JSON.stringify({ ok: true, formulas: 14, failClosedCases: 7 }, null, 2));
