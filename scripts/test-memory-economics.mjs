/**
 * Memory economics gate.
 *
 * The board is allowed to name a metric only if the model can produce it, and
 * the model must stay fail-closed: an incomplete baseline omits the metric
 * rather than estimating it or showing a zero that reads like a measurement.
 */
import assert from "node:assert/strict";
import { computeMemoryEconomics, economicsVerdict } from "../assets/js/memory-economics.js";

const rowsOf = (result) => new Map(result.groups.flatMap((group) => group.rows.map((row) => [row.id, row])));

/* --------------------------------------------------------------- fail-closed */

const empty = computeMemoryEconomics({});
assert.deepEqual(empty.groups, [], "no baseline must produce no numbers");
assert.ok(empty.missing.length, "a blank baseline must name what it needs");
assert.equal(economicsVerdict(empty), "", "no numbers must produce no verdict");

// A price with no volume still yields a unit cost — that much is arithmetic —
// but nothing that depends on how much of it the customer runs.
for (const bad of [
  { dailyQueriesMillions: 0, tokensPerQuery: 2500, costPerMillionTokens: 3.5 },
  { dailyQueriesMillions: -4, tokensPerQuery: 2500, costPerMillionTokens: 3.5 },
  { dailyQueriesMillions: "abc", tokensPerQuery: 2500, costPerMillionTokens: 3.5 },
]) {
  const partial = rowsOf(computeMemoryEconomics(bad));
  assert.ok(partial.has("costPerQuery"), `a unit cost is computable without volume: ${JSON.stringify(bad)}`);
  for (const id of ["dailyTokens", "annualTokens", "annualCost", "annualSaving", "tam"]) {
    assert.equal(partial.has(id), false, `${id} must be omitted when volume is not usable: ${JSON.stringify(bad)}`);
  }
}

// A percentage outside 0–100 is a typo, not a value to carry through.
const badRate = computeMemoryEconomics({
  dailyQueriesMillions: 10, tokensPerQuery: 2500, costPerMillionTokens: 3.5, tieringSavingPercent: 180,
});
assert.equal(rowsOf(badRate).has("annualSaving"), false, "an out-of-range rate must not yield a saving");

/* ------------------------------------------------------------------ arithmetic */

const base = {
  dailyQueriesMillions: 10,
  tokensPerQuery: 2500,
  costPerMillionTokens: 3.5,
  tieringSavingPercent: 18,
  rackPowerKw: 120,
  powerSavingPercent: 12,
  incrementalCapexMillions: 12,
  memoryShareOfSavingPercent: 40,
  targetWinSharePercent: 35,
  bandwidthTBPerSecond: 8,
  capacityTB: 24,
  systemCostMillions: 4,
};
const result = computeMemoryEconomics(base);
const rows = rowsOf(result);

// 10M queries × 2,500 tokens = 25B tokens/day; ×365 = 9,125B tokens/yr.
assert.equal(rows.get("dailyTokens").value, 25);
assert.equal(rows.get("annualTokens").value, 9125);

// 9.125e12 tokens ÷ 1M × $3.5 = $31.94M/yr, reported in millions.
assert.equal(rows.get("annualCost").value, 31.94);
assert.equal(rows.get("annualSaving").value, 5.75, "18% of the annual cost");

// $3.5 per 1M tokens over 2,500 tokens = $0.00875 per query.
assert.equal(rows.get("costPerQuery").value, 0.00875);
assert.equal(rows.get("proposedCostPerQuery").value, 0.007175, "18% below the current per-query cost");

// 120kW × 12% = 14.4kW freed, which is 0.12 of another rack.
assert.equal(rows.get("freedPower").value, 14.4);
assert.equal(rows.get("addedRacks").value, 0.12);

assert.equal(rows.get("bandwidthPerDollar").value, 2, "8 TB/s over $4M");
assert.equal(rows.get("capacityPerDollar").value, 6, "24 TB over $4M");

// SAM is the memory share of the saving; SOM narrows it by the target win rate.
assert.equal(rows.get("sam").value, 2.3, "40% of a $5.75M saving");
assert.equal(rows.get("som").value, 0.8, "35% of SAM");

// $12M of capex against a $5.75M annual saving takes just over two years.
assert.equal(rows.get("payback").value, 25, "rounded to one decimal");
assert.equal(rows.get("roi").value, -52.1, "first-year ROI is negative while the capex is still unrecovered");

/* ------------------------------------------------------------------- formulas */

for (const group of result.groups) {
  for (const row of group.rows) {
    assert.ok(row.formula && row.formula.trim(), `${row.id} must state the formula behind it`);
    assert.ok(Number.isFinite(Number(row.value)), `${row.id} must be a finite number`);
    assert.ok(row.unit && row.unit.trim(), `${row.id} must carry a unit`);
  }
}

/* -------------------------------------------------------------------- verdict */

const verdict = economicsVerdict(result);
assert.match(verdict, /회수 25개월/);
assert.match(verdict, /재설계 필요/, "a two-year payback must not read as approvable");

// Halve the capex and the same saving clears the approval window.
const fast = computeMemoryEconomics({ ...base, incrementalCapexMillions: 6 });
assert.match(economicsVerdict(fast), /제안 가능/, "a payback inside 18 months is approvable");

// A capex that dwarfs the saving must not read as approvable.
const slow = computeMemoryEconomics({ ...base, tieringSavingPercent: 1, incrementalCapexMillions: 900000 });
assert.match(economicsVerdict(slow), /재설계 필요/, "a long payback must not read as approvable");

console.log(JSON.stringify({
  status: "memory-economics-pass",
  groups: result.groups.length,
  metrics: result.groups.reduce((total, group) => total + group.rows.length, 0),
}, null, 2));
