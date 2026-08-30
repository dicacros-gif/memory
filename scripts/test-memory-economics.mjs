/**
 * Memory economics gate.
 *
 * The board is allowed to name a metric only if the model can produce it, and
 * the model must stay fail-closed: an incomplete baseline omits the metric
 * rather than estimating it or showing a zero that reads like a measurement.
 */
import assert from "node:assert/strict";
import { computeMemoryEconomics, economicsVerdict, economicsDecision } from "../assets/js/memory-economics.js";

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

// A percentage outside 0–100 is a typo. Dropping every dependent row was worse
// than the typo: the TCO, ROI and payback cards vanished with nothing on screen
// to say why, so the reader saw a shorter card and no reason for it. It is
// clamped into range, the row is computed at the clamped rate, and the clamp is
// reported so the card can name the value it actually used.
const badRate = computeMemoryEconomics({
  dailyQueriesMillions: 10, tokensPerQuery: 2500, costPerMillionTokens: 3.5, tieringSavingPercent: 180,
});
assert.equal(rowsOf(badRate).has("annualSaving"), true, "an out-of-range rate is clamped, not silently dropped");
const clamp = (badRate.invalid || []).find((entry) => entry.field === "tieringSavingPercent");
assert.ok(clamp, "the clamp must be reported to the caller");
assert.equal(clamp.entered, 180);
assert.equal(clamp.applied, 100);

// A duration of zero is refused rather than replaced. Substituting the default
// silently is how "0년" came to print a three-year total under a "3년 기준" label.
const zeroHorizon = computeMemoryEconomics({
  dailyQueriesMillions: 10, tokensPerQuery: 2500, costPerMillionTokens: 3.5, tieringSavingPercent: 12, horizonYears: 0,
});
assert.ok((zeroHorizon.invalid || []).some((entry) => entry.field === "horizonYears"), "a zero horizon must be reported, not defaulted");
assert.doesNotMatch(JSON.stringify(zeroHorizon.groups.map((group) => group.label)), /3년 기준/, "a refused horizon must not print a year in the label");

// An empty field is absence, not a typed zero: num("") is 0, which once made a
// blank duration report itself as invalid.
const blankHorizon = computeMemoryEconomics({
  dailyQueriesMillions: 10, tokensPerQuery: 2500, costPerMillionTokens: 3.5, tieringSavingPercent: 12, horizonYears: "",
});
assert.equal((blankHorizon.invalid || []).length, 0, "an empty field must not be reported as an invalid entry");

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
// Two bands put a 12.8-month account and a 48-month one under one badge, so 22
// of 27 presets read "재설계" and the badge carried no information. A two-year
// payback still must not read as approvable — it now says which design is in
// question, which the old wording left the reader to guess.
assert.match(verdict, /재설계 대상/, "a two-year payback must not read as approvable");
assert.match(verdict, /고객 메모리 계층/, "a redesign verdict must name the customer's hierarchy, not our product mix");

// Cut the capex far enough and the same saving clears the approval window.
// The bar is twelve months: the hyperscaler purchase-approval window, not the
// eighteen it used to be.
const fast = computeMemoryEconomics({ ...base, incrementalCapexMillions: 4 });
assert.match(economicsVerdict(fast), /제안 가능/, "a payback inside 12 months is approvable");

// A capex that dwarfs the saving must not read as approvable. Past three years
// it is not a redesign question either — it is not a case yet.
const slow = computeMemoryEconomics({ ...base, tieringSavingPercent: 1, incrementalCapexMillions: 900000 });
assert.match(economicsVerdict(slow), /보류/, "a payback beyond the evaluation horizon must read as held, not approvable");

// The band between the approval window and a hierarchy rebuild is the one that
// was missing: most accounts land in it, and calling them all "재설계" is what
// made the badge meaningless.
const conditional = computeMemoryEconomics({ ...base, incrementalCapexMillions: 7 });
assert.equal(economicsDecision(conditional)?.state, "conditional", "a payback between the approval window and a rebuild is conditional");
assert.match(economicsVerdict(conditional), /계층 구성 최적화/, "a conditional case says what would make it approvable");

// The card and the sentence are two renderings of one decision. If they can
// disagree about whether a case is approvable, one of them is lying to an
// executive, so both are pinned to the same set of states.
assert.equal(economicsDecision(empty), null, "no numbers must produce no decision");
assert.equal(economicsDecision(result)?.state, "redesign", "a two-year payback is a redesign");
assert.equal(economicsDecision(fast)?.state, "approve", "a payback inside 12 months is approvable");
assert.equal(economicsDecision(slow)?.state, "hold", "a payback beyond the evaluation horizon is held, not a redesign");

// The bands must stay ordered: a longer payback can never read as a shorter
// one's state.
const ORDER = ["approve", "conditional", "redesign", "hold"];
const ladder = [fast, conditional, result, slow].map((computed) => ORDER.indexOf(economicsDecision(computed).state));
assert.deepEqual(ladder, [...ladder].sort((a, b) => a - b), "a longer payback must never rank ahead of a shorter one");

// Every band must state the scope of its verdict except the approval, which has
// nothing to qualify.
for (const computed of [conditional, result, slow]) {
  assert.ok(economicsDecision(computed).scope, "a non-approval verdict must say what its scope is");
}
assert.equal(economicsDecision(fast).scope, "", "an approval needs no scope note");

// The headline strip carries the economics the frame asks for.
for (const computed of [fast, result]) {
  const economics = economicsDecision(computed).economics || [];
  assert.ok(economics.length >= 4, "the verdict must surface the economics it already computes");
}

for (const [computed, state] of [[result, "redesign"], [fast, "approve"], [slow, "hold"]]) {
  const decision = economicsDecision(computed);
  assert.ok(economicsVerdict(computed).endsWith(decision.decision),
    `the ${state} sentence must end with the decision the card shows`);
  assert.ok(decision.metrics.length, "a decision must carry the numbers it rests on");
}

console.log(JSON.stringify({
  status: "memory-economics-pass",
  groups: result.groups.length,
  metrics: result.groups.reduce((total, group) => total + group.rows.length, 0),
}, null, 2));
