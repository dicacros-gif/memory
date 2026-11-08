import assert from "node:assert/strict";
import { annualGrowthPct, companyMetrics, secCikFor, yahooCandidates, runwayYears, secFundamentals, tenBaggerEpisode, trailingReturn, trailingTwelveMonths, yahooSymbol } from "./tenbagger-collect.mjs";

assert.equal(yahooSymbol("NASDAQ:IONQ"), "IONQ");
assert.equal(yahooSymbol("KRX:277810"), "277810.KS");
assert.equal(yahooSymbol("KOSDAQ:196170"), "196170.KQ");
assert.equal(yahooSymbol("TSE:6324"), "6324.T");

// 10-Q cash flows are year-to-date: TTM = 9M + FY − prior 9M.
const ocf = [
  { start: "2024-01-01", end: "2024-12-31", val: 100 },
  { start: "2024-01-01", end: "2024-09-30", val: 70 },
  { start: "2025-01-01", end: "2025-09-30", val: 90 },
];
assert.deepEqual(trailingTwelveMonths(ocf), { value: 120, end: "2025-09-30", basis: "ttm" });
assert.deepEqual(trailingTwelveMonths(ocf.slice(0, 1)), { value: 100, end: "2024-12-31", basis: "fiscal-year" });
assert.equal(trailingTwelveMonths([]), null);

// Runway exists only for a cash burner.
assert.equal(runwayYears(300, -100), 3);
assert.equal(runwayYears(300, 50), null);
assert.equal(runwayYears(null, -10), null);

// A 10x from the trough inside seven years is found at the first month it holds.
const months = (values) => values.map((close, i) => ({ date: new Date(Date.UTC(2015, i, 1)).toISOString().slice(0, 10), close }));
const run = tenBaggerEpisode(months([5, 4, 2, 3, 8, 15, 21, 25]));
assert.equal(run.achieved, true);
assert.equal(run.fromDate, "2015-03-01");
assert.equal(run.toDate, "2015-07-01");
assert.equal(run.multiple, 10.5);
assert.equal(tenBaggerEpisode(months([10, 12, 15, 18])).achieved, false);
assert.equal(trailingReturn(months([10, 20]), 1), 100);

// SEC facts → FCF and cash; capex is subtracted, short-term investments added at the same date.
const facts = { facts: {
  "us-gaap": {
    Revenues: { units: { USD: [{ start: "2024-01-01", end: "2024-12-31", val: 1000 }] } },
    NetCashProvidedByUsedInOperatingActivities: { units: { USD: [{ start: "2024-01-01", end: "2024-12-31", val: -300 }] } },
    PaymentsToAcquirePropertyPlantAndEquipment: { units: { USD: [{ start: "2024-01-01", end: "2024-12-31", val: 100 }] } },
    CashAndCashEquivalentsAtCarryingValue: { units: { USD: [{ end: "2024-12-31", val: 500 }] } },
    ShortTermInvestments: { units: { USD: [{ end: "2024-12-31", val: 300 }] } },
  },
  dei: { EntityCommonStockSharesOutstanding: { units: { shares: [{ end: "2025-02-01", val: 50 }] } } },
} };
const f = secFundamentals(facts);
assert.equal(f.fcfTtm, -400);
assert.equal(f.cashAndShortTermInvestments, 800);
const m = companyMetrics({ company: { ticker: "NASDAQ:TEST" }, prices: { series: months([1, 2]), price: 10, currency: "USD" }, fundamentals: f });
assert.equal(m.marketCap, 500);
assert.equal(m.runwayYears, 2);
assert.equal(m.fcfMarginPct, -40);

// Failed fetches carry the previous numbers and say so.
const carried = companyMetrics({ company: { ticker: "NASDAQ:TEST" }, prices: null, fundamentals: null, previous: m });
assert.equal(carried.price, 10);
assert.equal(carried.stale.prices, true);
assert.equal(carried.stale.fundamentals, true);

assert.equal(annualGrowthPct([{ start: "2023-01-01", end: "2023-12-31", val: 100 }, { start: "2024-01-01", end: "2024-12-31", val: 150 }]), 50);
assert.equal(annualGrowthPct([{ start: "2024-01-01", end: "2024-12-31", val: 150 }]), null);

assert.deepEqual(yahooCandidates("277810.KS"), ["277810.KS", "277810.KQ"]);
assert.deepEqual(yahooCandidates("IONQ"), ["IONQ"]);
// SEC's map wins over a researcher-supplied CIK for US listings, and an unknown US ticker gets none.
const map = new Map([["IONQ", "0001824920"]]);
assert.equal(secCikFor({ ticker: "NYSE:IONQ", secCik: "0000000001" }, map), "0001824920");
assert.equal(secCikFor({ ticker: "NASDAQ:ZZZZ", secCik: "0000000001" }, map), null);
assert.equal(secCikFor({ ticker: "KRX:277810", secCik: null }, map), null);

console.log(JSON.stringify({ tenbagger: "pass" }));

// Source re-check helpers.
const { figureTokens, textFound, claims } = await import("./tenbagger-verify-sources.mjs");
assert.deepEqual(figureTokens(17.2), ["17.2"]);
assert.ok(figureTokens(8000000000).includes("8"));
assert.deepEqual(figureTokens("806,000 units (2026 forecast: 655,000, +9%)").slice(0, 2), ["806,000", "2026"]);
assert.equal(textFound("<p>owns 17.2% of shares</p>", ["17.2"]), true);
assert.equal(textFound("<p>nothing</p>", ["17.2"]), false);
assert.equal(textFound("<p>x</p>", []), null);
const universe = JSON.parse(await (await import("node:fs/promises")).readFile(new URL("../data/tenbagger/universe.json", import.meta.url), "utf8"));
const universeClaims = claims(universe);
assert.ok(universeClaims.length > 100, "every cited figure carries a URL to re-check");
for (const s of universe.sectors) {
  for (const c of s.publicCompanies) assert.match(c.ticker, /^[A-Z]+:[A-Z0-9.\-]+$/, `${c.name} ticker must be EXCHANGE:CODE`);
  for (const x of s.startups) for (const h of x.holders) {
    assert.match(h.url || "", /^https?:\/\//, `${x.name} ← ${h.holder} needs a source`);
    assert.ok(["verified", "corrected", "cited"].includes(h.check));
    if (h.pctOwned !== null) assert.ok(h.pctOwned > 0 && h.pctOwned <= 100);
  }
}
console.log(JSON.stringify({ tenbaggerUniverse: "pass", claims: universeClaims.length }));
