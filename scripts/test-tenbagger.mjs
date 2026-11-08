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

// The concept with the most recent period wins: NVIDIA's old revenue concept ends in FY2023.
const switched = secFundamentals({ facts: { "us-gaap": {
  RevenueFromContractWithCustomerExcludingAssessedTax: { units: { USD: [{ start: "2022-01-31", end: "2023-01-29", val: 26974 }] } },
  Revenues: { units: { USD: [{ start: "2025-01-27", end: "2026-01-25", val: 200000 }] } },
} } });
assert.equal(switched.revenueTtm, 200000);

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

// ── Market screen (TradingView scan) ────────────────────────────────────────
const screenMod = await import("./tenbagger-screen.mjs");
const { tvTicker, dedupe, rowFacts, industryGrowthMap, discoveryCandidates, recentTenBaggers, crossCheck, buildLandingClient, universeScreen } = screenMod;
const { usdMarketCap } = await import("./tenbagger-collect.mjs");
assert.equal(tvTicker("KOSDAQ:196170"), "KRX:196170");
assert.equal(tvTicker("NYSEAMERICAN:LEU"), "AMEX:LEU");
assert.equal(tvTicker("AMS:BESI"), "EURONEXT:BESI");
assert.equal(tvTicker("NASDAQ:IONQ"), "NASDAQ:IONQ");
const tv = (o) => ({ ticker: "NASDAQ:X", description: "X Corp", country: "United States", industry: "Semiconductors", market_cap_basic: 2e9,
  total_revenue_ttm: 100, total_revenue_yoy_growth_ttm: 50, free_cash_flow_ttm: -10, cash_n_short_term_invest_fq: 40, gross_margin: 55, "Perf.Y": 20, "Perf.5Y": 100, ...o });
// Preferred lines repeat the parent; the larger listing stays.
assert.equal(dedupe([tv({ ticker: "KRX:005930", description: "Samsung Electronics Co., Ltd.", market_cap_basic: 9 }), tv({ ticker: "KRX:005935", description: "Samsung Electronics Co Ltd Pfd", market_cap_basic: 1 })]).length, 1);
const rf = rowFacts(tv({}));
assert.equal(rf.fcfMarginPct, -10);
assert.equal(rf.runwayYears, 4);
assert.equal(rf.sector, "ai-infra");
assert.equal(rowFacts(tv({ free_cash_flow_ttm: 5 })).runwayYears, null, "runway only when burning cash");
// Industry map needs enough companies and clips outliers in the weighting.
const manyRows = Array.from({ length: 10 }, (_, i) => tv({ ticker: `NASDAQ:S${i}`, description: `S${i}`, total_revenue_yoy_growth_ttm: i === 0 ? 5000 : 10 }));
const imap = industryGrowthMap([...manyRows, tv({ ticker: "NYSE:Z", description: "Z", industry: "Tiny" })]);
assert.equal(imap.length, 1);
assert.equal(imap[0].medianGrowthPct, 10);
assert.ok(imap[0].capWeightedGrowthPct <= 40, "a 5000% base effect is clipped to 300%");
// Discovery: growth, size, funding and a tracked industry; universe names flagged.
const disc = discoveryCandidates([
  tv({ ticker: "NASDAQ:A", description: "A" }),
  tv({ ticker: "NASDAQ:B", description: "B", free_cash_flow_ttm: -30 }), // runway 1.3y → out
  tv({ ticker: "NASDAQ:C", description: "C", market_cap_basic: 20e9 }), // too big → out
  tv({ ticker: "NASDAQ:D", description: "D", industry: "Restaurants" }), // untracked → out
  tv({ ticker: "NASDAQ:E", description: "E", total_revenue_yoy_growth_ttm: 10 }), // slow → out
], ["NASDAQ:A"]);
assert.deepEqual(disc.map((f) => [f.ticker, f.inUniverse]), [["NASDAQ:A", true]]);
const tx = recentTenBaggers([tv({ ticker: "NASDAQ:T", description: "T", "Perf.5Y": 1200 }), tv({ ticker: "NASDAQ:U", description: "U", "Perf.5Y": 800 })]);
assert.equal(tx.total, 1);
assert.equal(tx.industries[0].industry, "Semiconductors");
// Cross-check: within 10pp and same FCF sign agrees.
assert.equal(crossCheck({ fundamentals: { revenueGrowthPct: 55, fcfTtm: -1 } }, tv({})).agrees, true);
assert.equal(crossCheck({ fundamentals: { revenueGrowthPct: 80, fcfTtm: -1 } }, tv({})).agrees, false);
assert.equal(crossCheck({ fundamentals: { revenueGrowthPct: 52, fcfTtm: 5 } }, tv({})).agrees, false, "FCF sign disagrees");
assert.equal(crossCheck({}, null), null);
assert.equal(usdMarketCap({ currency: "USD", marketCap: 5.4 }, null), 5);
assert.equal(usdMarketCap({ currency: "KRW", marketCap: 5e12 }, { marketCapUsd: 3.6e9 }), 3.6e9);
assert.equal(usdMarketCap({ currency: "JPY", marketCap: 5e11 }, null), null, "never treat a foreign currency as dollars");
// Universe screen uses dollar caps only and candidates only.
const u2 = { sectors: [{ id: "q", name: "양자", publicCompanies: [
  { ticker: "NASDAQ:A", name: "A", layer: "candidate" }, { ticker: "TSE:B", name: "B", layer: "candidate" }, { ticker: "NASDAQ:L", name: "L", layer: "leader" }] }] };
const m2 = { companies: [
  { ticker: "NASDAQ:A", currency: "USD", marketCap: 2e9, marketCapUsd: 2e9, runwayYears: 3, fundamentals: { revenueGrowthPct: 40, fcfTtm: -5 } },
  { ticker: "TSE:B", currency: "JPY", marketCap: 1e11, marketCapUsd: null, fundamentals: { revenueGrowthPct: 90, fcfTtm: 5 } },
  { ticker: "NASDAQ:L", currency: "USD", marketCap: 2e9, marketCapUsd: 2e9, fundamentals: { revenueGrowthPct: 90, fcfTtm: 5 } }] };
assert.deepEqual(universeScreen(u2, m2).map((p) => p.ticker), ["NASDAQ:A"]);
assert.equal(buildLandingClient(null, { sectors: [] }, null), null, "nothing verified → landing section stays hidden");
const lcl = buildLandingClient({ fetchedAt: "2026-11-08", source: "TV", sourceUrl: "u", scope: { companies: 10 }, industryMap: [{ ...imap[0], companies: 20 }], discovery: [], recentTenBaggers: tx }, u2, m2);
assert.equal(lcl.candidateCount, 1);
assert.equal(lcl.industries.length, 1);
console.log(JSON.stringify({ tenbaggerScreen: "pass" }));

// ── Research factor score ───────────────────────────────────────────────────
const { scoreFactors, factorLeaders, FACTOR_RESEARCH } = screenMod;
const fx = scoreFactors([
  { marketCapUsd: 1e9, bookToMarket: 0.5, operatingMarginPct: 20, fcfYieldPct: 8, offHighPct: -40 },
  { marketCapUsd: 5e9, bookToMarket: 0.1, operatingMarginPct: 5, fcfYieldPct: 1, offHighPct: -2 },
  { marketCapUsd: 3e9, bookToMarket: null, operatingMarginPct: null, grossMarginPct: 10, fcfYieldPct: null, offHighPct: null },
]);
assert.equal(fx[0].factor.score, 100, "small, cheap, profitable, high FCF yield, far from high");
assert.equal(fx[1].factor.score, 0);
assert.equal(fx[2].factor.score, null, "fewer than three factors → no score");
assert.match(FACTOR_RESEARCH.url, /^https:\/\//);
const lead = factorLeaders([
  tv({ ticker: "NASDAQ:F1", description: "F1", price_book_fq: 1, operating_margin: 30, price_free_cash_flow_ttm: 10, free_cash_flow_ttm: 5, market_cap_basic: 1e9 }),
  tv({ ticker: "NASDAQ:F2", description: "F2", price_book_fq: 8, operating_margin: 2, price_free_cash_flow_ttm: 80, free_cash_flow_ttm: 5, market_cap_basic: 8e9 }),
  tv({ ticker: "NASDAQ:F3", description: "F3", free_cash_flow_ttm: -5 }), // burning cash → excluded
], ["NASDAQ:F2"]);
assert.deepEqual(lead.map((l) => l.ticker), ["NASDAQ:F1", "NASDAQ:F2"]);
assert.equal(lead[1].inUniverse, true);
assert.equal(rowFacts(tv({ price_free_cash_flow_ttm: 25 })).fcfYieldPct, 4);
const oneY = recentTenBaggers([tv({ ticker: "KRX:1", description: "One", "Perf.Y": 1000, market_cap_basic: 5e8 })]);
assert.equal(oneY.oneYear.length, 1);
console.log(JSON.stringify({ tenbaggerFactors: "pass" }));
