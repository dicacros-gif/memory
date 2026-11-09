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

// ── Company data layer ──────────────────────────────────────────────────────
const build = await import("./tenbagger-build.mjs");
assert.equal(build.companyId("NASDAQ:NVDA"), "us-nasdaq-nvda");
assert.equal(build.companyId("KOSDAQ:196170"), "kr-kosdaq-196170");
assert.equal(build.companyId("TSE:6324"), "jp-tse-6324");
assert.deepEqual(build.splitVehicle("Intel (Intel Capital)"), { parent: "Intel", vehicle: "Intel Capital" });
assert.deepEqual(build.splitVehicle("Alphabet (via GV)"), { parent: "Alphabet", vehicle: "GV" });
const rel = build.relationship({ holder: "Hyundai Motor", pctOwned: 28, asOf: "2026-07-16", basis: "reported", url: "https://x", note: "look-through via HMG Global" }, { valuationDate: "2026-08-01" });
assert.equal(rel.holding, "indirect");
assert.equal(rel.basis, "economic (look-through)");
assert.equal(rel.predatesLatestRound, true);
assert.equal(rel.source.type, "press");
assert.equal(build.relationship({ holder: "X", note: "talks terminated" }, {}).status, "pending");
assert.equal(build.maxDrawdownPct([{ close: 10 }, { close: 20 }, { close: 5 }, { close: 30 }]), -75);
const q8 = Array.from({ length: 8 }, (_, i) => ({ end: new Date(Date.UTC(2024, 2 + i * 3, 30)).toISOString().slice(0, 10), revenue: i < 4 ? 100 : 150 }));
assert.equal(build.ttmGrowthFromQuarters(q8), 50);
assert.equal(build.ttmGrowthFromQuarters(q8.slice(1)), null, "needs eight quarters");
assert.equal(build.periodAlignedCheck({ revenueGrowthTtmPct: 50, revenueEnd: "2026-09-30" }, { revenueGrowthPct: 52 }, "2026-11-08").state, "aligned");
assert.equal(build.periodAlignedCheck({ revenueGrowthTtmPct: 50, revenueEnd: "2025-12-31" }, { revenueGrowthPct: 52 }, "2026-11-08").state, "not-comparable");
assert.equal(build.periodAlignedCheck({ revenueGrowthPct: 50, revenueEnd: "2026-09-30" }, { revenueGrowthPct: 52 }, "2026-11-08").state, "not-comparable", "fiscal-year growth is never compared with TTM");
const cl1 = build.updateChangelog(null, [{ id: "a", coverage: "universe" }], "2026-11-01");
const cl2 = build.updateChangelog(cl1, [{ id: "a", coverage: "universe" }, { id: "b", coverage: "holder" }, { id: "s", coverage: "screen" }], "2026-11-08");
assert.deepEqual(cl2.entries[0], { date: "2026-11-08", added: ["b"], removed: [] });
const st1 = build.sourceStatus(null, "2026-11-08T00:00:00Z", { sec: { ok: true }, fred: { ok: false, error: "HTTP 500" }, dart: { ok: null } });
assert.equal(st1.sources.sec.ok, true);
assert.equal(st1.sources.fred.staleSince, "2026-11-08T00:00:00Z");
assert.equal(st1.sources.dart, undefined, "not attempted is not a failure");
const st2 = build.sourceStatus(st1, "2026-11-09T00:00:00Z", { fred: { ok: false, error: "HTTP 500" } });
assert.equal(st2.sources.fred.staleSince, "2026-11-08T00:00:00Z", "stale since the first failure");

// SEC quarters, filings and post-period raises.
const { quarterlyValues, secFilings, postPeriodRaises, runwayStatus } = await import("./tenbagger-collect.mjs");
const ytd = [
  { start: "2026-01-01", end: "2026-03-31", val: 10, filed: "2026-05-01" },
  { start: "2026-01-01", end: "2026-06-30", val: 25, filed: "2026-08-01" },
  { start: "2026-01-01", end: "2026-09-30", val: 45, filed: "2026-11-01" },
];
assert.deepEqual(quarterlyValues(ytd).map((q) => q.value), [10, 15, 20]);
const subs = { filings: { recent: { form: ["424B5", "10-Q", "4"], filingDate: ["2026-10-20", "2026-11-05", "2026-11-06"], accessionNumber: ["0001-26-1", "0001-26-2", "0001-26-3"], primaryDocument: ["a.htm", "b.htm", "c.xml"], reportDate: ["", "2026-09-30", ""] } } };
const fil = secFilings(subs, "1824920");
assert.equal(fil.length, 2, "form 4 filtered out");
assert.equal(fil[0].capitalRaise, true);
assert.match(fil[0].url, /edgar\/data\/1824920\/0001261\/a\.htm$/);
assert.deepEqual(postPeriodRaises({ cashEnd: "2026-09-30", filings: fil }).map((x) => x.form), ["424B5"]);
assert.equal(runwayStatus({ status: "filed", cashEnd: "2026-09-30", fcfEnd: "2026-09-30" }), "filed");
assert.equal(runwayStatus({ status: "provider snapshot", cashEnd: "2026-09-30", fcfEnd: "2026-09-30" }), "estimate");

// DART statement parsing (quarterly report: income YTD, cash flow YTD).
const { dartFundamentals, dartFilings } = await import("./tenbagger-dart.mjs");
const q3 = [
  { sj_div: "IS", account_id: "ifrs-full_Revenue", account_nm: "매출액", thstrm_amount: "40", thstrm_add_amount: "120", frmtrm_add_amount: "100" },
  { sj_div: "CF", account_id: "ifrs-full_CashFlowsFromUsedInOperatingActivities", account_nm: "영업활동현금흐름", thstrm_amount: "30", frmtrm_amount: "20" },
  { sj_div: "CF", account_id: "ifrs-full_PurchaseOfPropertyPlantAndEquipment", account_nm: "유형자산의 취득", thstrm_amount: "-10", frmtrm_amount: "-5" },
  { sj_div: "BS", account_id: "ifrs-full_CashAndCashEquivalents", account_nm: "현금및현금성자산", thstrm_amount: "500" },
  { sj_div: "BS", account_id: "-표준계정코드 미사용-", account_nm: "단기금융상품", thstrm_amount: "50" },
];
const fy = [
  { sj_div: "IS", account_id: "ifrs-full_Revenue", account_nm: "매출액", thstrm_amount: "140" },
  { sj_div: "CF", account_id: "ifrs-full_CashFlowsFromUsedInOperatingActivities", account_nm: "영업활동현금흐름", thstrm_amount: "28" },
  { sj_div: "CF", account_id: "ifrs-full_PurchaseOfPropertyPlantAndEquipment", account_nm: "유형자산의 취득", thstrm_amount: "-8" },
];
const df = dartFundamentals({ latest: q3, latestCode: "11014", year: 2026, annualPrior: fy });
assert.equal(df.revenueTtm, 160, "120 YTD + 140 FY − 100 prior YTD");
assert.equal(df.revenueGrowthPct, 20);
assert.equal(df.fcfTtm, (30 + 28 - 20) - (10 + 8 - 5));
assert.equal(df.cashAndShortTermInvestments, 550);
assert.equal(df.cashOnly, 500);
assert.equal(df.revenueEnd, "2026-09-30");
assert.equal(dartFilings([{ report_nm: "주요사항보고서(유상증자결정)", rcept_dt: "20261020", rcept_no: "1" }])[0].capitalRaise, true);

// Audit rules.
const { auditUniverse, nonFinite } = await import("./tenbagger-audit.mjs");
assert.deepEqual(auditUniverse({ sectors: [{ id: "x", publicCompanies: [{ ticker: "A:B" }, { ticker: "A:B" }], startups: [{ name: "S", ticker: "NASDAQ:S", holders: [{ holder: "H", url: "", asOf: "2099-01-01", pctOwned: 5 }] }] }] }, "2026-11-08").length, 4);
assert.deepEqual(nonFinite({ a: [1, Infinity], b: { c: NaN } }), ["$.a[1]", "$.b.c"]);
console.log(JSON.stringify({ tenbaggerDataLayer: "pass" }));

// Research additions are published only after their listing is confirmed.
assert.equal(build.verifyListing({ ticker: "NASDAQ:AXTI", name: "AXT, Inc." }, { description: "AXT Inc" }, "0001051627", true), true);
assert.equal(build.verifyListing({ ticker: "NASDAQ:AXTI", name: "AXT, Inc." }, { description: "AXT Inc" }, null, true), false, "US ticker must be in SEC's map");
assert.equal(build.verifyListing({ ticker: "NASDAQ:XYZ", name: "Foo Robotics" }, { description: "Bar Biotech" }, "1", true), false, "name must match");
assert.equal(build.verifyListing({ ticker: "KOSDAQ:123456", name: "에스피지" }, { description: "SPG Co Ltd" }, null, true), true, "KR six-digit code is unambiguous");
assert.equal(build.verifyListing({ ticker: "NASDAQ:AXTI", name: "AXT" }, null, "1", true), false);
assert.equal(build.verifyListing({ ticker: "NASDAQ:AXTI", name: "AXT" }, null, "1", false), null, "no scan this run: undecided");
console.log(JSON.stringify({ tenbaggerVerification: "pass" }));

// Daily change digest: preset entries/exits, offerings since the last run, big moves.
const mk = (id, o) => ({ id, name: id, ticker: `NASDAQ:${id}`, market: "US", currency: "USD", coverage: "universe", industries: [], holdings: [], data: { financials: "filed" }, returns: {}, filings: [], ...o });
const prevDoc = { generatedAt: "2026-11-07T00:00:00Z", companies: [mk("a", { revenueGrowthPct: 10, fcfPositive: true, price: 10 }), mk("b", { revenueGrowthPct: 30, fcfPositive: true, price: 10, filings: [] })] };
const nowCos = [mk("a", { revenueGrowthPct: 25, fcfPositive: true, price: 12 }), mk("b", { revenueGrowthPct: 30, fcfPositive: false, price: 10, filings: [{ form: "424B5", date: "2026-11-07", url: "u", capitalRaise: true }, { form: "S-3", date: "2026-10-01", url: "v", capitalRaise: true }] }), mk("c", { revenueGrowthPct: 5 })];
const dg = build.buildDigest({ previous: prevDoc, companies: nowCos, prevStartups: null, startups: [], fx: null, now: "2026-11-08T00:00:00Z" });
const cg = dg.presets.find((p) => p.key === "cash-growers");
assert.deepEqual(cg.entered, ["a"]);
assert.deepEqual(cg.left, ["b"]);
assert.deepEqual(dg.raises.map((r) => r.form), ["424B5"], "only offerings filed after the previous run");
assert.deepEqual(dg.moves.map((m) => [m.id, m.changePct]), [["a", 20]]);
assert.deepEqual(dg.added.map((a) => a.id), ["c"]);
const first = build.buildDigest({ previous: null, companies: nowCos, prevStartups: null, startups: [], fx: null, now: "2026-11-08T00:00:00Z" });
assert.equal(first.since, null);
assert.deepEqual(first.presets[0].entered, [], "no baseline: nothing reported as new");
const land = build.buildLanding({ industries: [{ id: "x", name: "X", observed: { medianRevenueGrowthPct: 12, companies: 3 }, forecastCagrRange: [10, 20], forecastPeriods: [] }], companies: nowCos, digest: dg, fx: null, metricsAt: "2026-11-08" });
assert.equal(land.schemaVersion, "2.0");
assert.equal(land.presets.find((p) => p.key === "cash-growers").entered[0].id, "a");
console.log(JSON.stringify({ tenbaggerDigest: "pass" }));

// Positioning monitor: momentum z, percentiles, equal-weight index, regimes.
const posMod = await import("./tenbagger-positioning.mjs");
const up = Array.from({ length: 400 }, (_, i) => 100 * 1.002 ** i * (1 + 0.01 * Math.sin(i)));
const down = up.map((_, i) => up[up.length - 1 - i]);
assert.ok(posMod.momentumAt(up, 399) > 1, "steady uptrend has a positive momentum z");
assert.ok(posMod.momentumAt(down, 399) < -1);
assert.equal(posMod.momentumAt(up, 100), null, "needs the longest lookback");
assert.equal(posMod.percentileOfLast([...Array(30).keys()]), 100);
assert.equal(posMod.percentileOfLast([5, ...Array(29).fill(10), 0]), 0);
const t = Array.from({ length: 300 }, (_, i) => `d${String(i).padStart(3, "0")}`);
const ew = posMod.equalWeightIndex([{ t, c: t.map((_, i) => 100 + i) }, { t, c: t.map(() => 50) }]);
assert.ok(ew.at(-1).value > 100 && ew.at(-1).value < 300 * 100 / 100, "equal weight averages member returns");
const crash = [...up.slice(0, 340), ...Array.from({ length: 60 }, (_, i) => up[339] * (1 - 0.006 * i) * (1 + (i % 2 ? 1 : -1) * 0.002 * i))]; // falling, with swings that widen
const ind = posMod.industryPositioning("x", [{ t: crash.map((_, i) => `d${String(i).padStart(3, "0")}`), c: crash }, { t: crash.map((_, i) => `d${String(i).padStart(3, "0")}`), c: crash }, { t: crash.map((_, i) => `d${String(i).padStart(3, "0")}`), c: crash }]);
assert.equal(ind.regime, "de-risking", "a sharp, volatile fall from the 3-month high");
assert.equal(posMod.industryPositioning("y", []).insufficient, true);
const hm = posMod.healthMap({ momentumPct: 80, breadth200: 70, volPct1y: 30, observedGrowth: 20, shortMedian: 2 }, [{ observedGrowth: 5, shortMedian: 5 }, { observedGrowth: 10, shortMedian: 3 }, { observedGrowth: 20, shortMedian: 2 }], { fcfPositiveShare: 60 });
assert.deepEqual(hm.map((a) => a.value), [80, 70, 70, 100, 60, 100]);
console.log(JSON.stringify({ tenbaggerPositioning: "pass" }));

// FX: TradingView per-market market caps are in the listing currency.
const fxMod = await import("./tenbagger-fx.mjs");
const table = { rates: { KRW: { rate: 1400 }, JPY: { rate: 150 }, GBP: { rate: 0.8 } } };
assert.equal(fxMod.toUsd(1.4e12, "KRW", table), 1e9);
assert.equal(fxMod.toUsd(100, "GBX", table), 1.25, "pence are 1/100 of a pound");
assert.equal(fxMod.toUsd(5, "XYZ", table), null, "unknown currency: no dollar value");
assert.deepEqual(fxMod.parseFred("DATE,DEXUSEU\n2026-11-05,1.10\n2026-11-06,.\n", true), { rate: 1 / 1.1, date: "2026-11-05" });
screenMod.setFx(table);
assert.equal(rowFacts(tv({ market_cap_basic: 3.35e12, currency: "KRW" })).marketCapUsd, Math.round(3.35e12 / 1400));
screenMod.setFx(null);
assert.equal(rowFacts(tv({ market_cap_basic: 3.35e12, currency: "KRW" })).marketCapUsd, null, "never read won as dollars");
assert.equal(usdMarketCap({ currency: "KRW", marketCap: 2.8e12 }, null, table), 2e9, "own market cap converted first");
console.log(JSON.stringify({ tenbaggerFx: "pass" }));

// Burn trend, industry historical 10x, digest names.
assert.equal(build.burnTrend([{ fcf: -10 }, { fcf: -10 }, { fcf: -5 }, { fcf: -4 }]).state, "improving");
assert.equal(build.burnTrend([{ fcf: -4 }, { fcf: -5 }, { fcf: -10 }, { fcf: -12 }]).state, "worsening");
assert.equal(build.burnTrend([{ fcf: -4 }]), null);
const cohortFx = { base: { n: 1000, hits: 20 }, cells: { "ind·size|Semiconductors|<$0.3B": { n: 100, hits: 6, halved: 20 }, "ind·size|Semiconductors|>$10B": { n: 100, hits: 0, halved: 5 }, "ind·size|Banks|<$0.3B": { n: 100, hits: 1, halved: 3 } } };
const itx = build.industryTenX(cohortFx, ["Semiconductors"]);
assert.equal(itx.ratePct, 3);
assert.equal(itx.lift, 1.5);
assert.equal(itx.small.ratePct, 6);
assert.equal(build.industryTenX(cohortFx, ["Nothing"]), null);
const dg2 = build.buildDigest({ previous: { generatedAt: "2026-11-07", companies: [mk("gone", { revenueGrowthPct: 50, fcfPositive: true, name: "Gone Inc" })] }, companies: [], prevStartups: null, startups: [], fx: null, now: "2026-11-08" });
assert.equal(dg2.names.gone, "Gone Inc", "a company that left coverage keeps its name in the digest");
assert.equal(dg2.presets[0].prevCount, 1);
console.log(JSON.stringify({ tenbaggerValuation: "pass" }));

// Quant block, TradingView fill, RSI/drawdown.
const qb = build.quantBlock({ revenueGrowthPct: 30, fcfMarginPct: 15, cashPlusSti: 200, debt: 50, marketCap: 1000, currency: "USD", statementCurrency: "USD", price: 10, valuation: { targetMean: 13, roePct: 18, analysts: 7 } });
assert.equal(qb.ruleOf40, 45);
assert.equal(qb.netCash, 150);
assert.equal(qb.netCashToMcapPct, 15);
assert.equal(qb.targetUpsidePct, 30);
assert.equal(qb.roePct, 18);
assert.equal(build.quantBlock({ cashPlusSti: 10, debt: 5, marketCap: 100, currency: "USD", statementCurrency: "KRW" }).netCashToMcapPct, null, "never mix currencies");
assert.equal(posMod.rsi14(Array.from({ length: 40 }, (_, i) => 100 + i)), 100, "only gains → RSI 100");
assert.equal(posMod.maxDrawdown([10, 20, 5, 30]), -75);
console.log(JSON.stringify({ tenbaggerQuant: "pass" }));

// SEC balance sheet on the cash date: no double-counted debt, any STI concept.
const { debtAt, instantAt } = await import("./tenbagger-collect.mjs");
const bs = { facts: { "us-gaap": {
  LongTermDebt: { units: { USD: [{ end: "2026-07-26", val: 8500 }] } },
  LongTermDebtCurrent: { units: { USD: [{ end: "2026-07-26", val: 1000 }] } },
  MarketableSecuritiesCurrent: { units: { USD: [{ end: "2026-07-26", val: 40000 }, { end: "2026-04-27", val: 30000 }] } },
} } };
assert.equal(debtAt(bs, "2026-07-26"), 8500, "total long-term debt already includes the current portion");
const bs2 = { facts: { "us-gaap": { LongTermDebtNoncurrent: { units: { USD: [{ end: "2026-07-26", val: 7500 }] } }, LongTermDebtCurrent: { units: { USD: [{ end: "2026-07-26", val: 1000 }] } } } } };
assert.equal(debtAt(bs2, "2026-07-26"), 8500);
assert.equal(debtAt({ facts: {} }, "2026-07-26"), null);
assert.equal(instantAt(bs, ["us-gaap:ShortTermInvestments", "us-gaap:MarketableSecuritiesCurrent"], "2026-07-26").value, 40000);
console.log(JSON.stringify({ tenbaggerBalanceSheet: "pass" }));

// Long-horizon indicators, balance-sheet cross-check, industry medians, combined cash+STI.
{
  const { revenueCagr3y, balanceCheck, industryMedians } = await import("./tenbagger-build.mjs");
  const { stiAtDate, debtBreakdown } = await import("./tenbagger-collect.mjs");
  const annual = [{ end: "2022-01-30", revenue: 100 }, { end: "2023-01-29", revenue: 120 }, { end: "2024-01-28", revenue: 150 }, { end: "2025-01-26", revenue: 200 }];
  const cg = revenueCagr3y(annual);
  assert.equal(cg.pct, 26, "(200/100)^(1/3) − 1 ≈ 26%");
  assert.equal(cg.from, "2022-01-30");
  assert.equal(revenueCagr3y(annual.slice(1)), null, "needs four fiscal years");
  const c = { statementCurrency: "USD", currency: "USD", marketCap: 1000, valuation: { totalCash: 300, totalDebt: 100, financialCurrency: "USD" } };
  assert.equal(balanceCheck(c, -200).disagree, true);
  assert.equal(balanceCheck(c, 180).disagree, false);
  assert.equal(balanceCheck({ ...c, valuation: { ...c.valuation, financialCurrency: "KRW" } }, -200), null, "different currencies are not compared");
  const med = industryMedians([{ priceToSales: 2, quant: { ruleOf40: 50 } }, { priceToSales: 4, quant: { ruleOf40: null } }, { priceToSales: 9, quant: {} }]);
  assert.equal(med.priceToSales.median, 4); assert.equal(med.priceToSales.n, 3); assert.equal(med.ruleOf40.n, 1); assert.equal(med.forwardPE.median, null);
  const combined = { facts: { "us-gaap": { CashCashEquivalentsAndShortTermInvestments: { units: { USD: [{ end: "2026-07-26", val: 56000 }] } } } } };
  const sti = stiAtDate(combined, "2026-07-26", 11000);
  assert.equal(sti.value, 45000, "combined total minus cash");
  assert.equal(stiAtDate(combined, "2026-07-26", 60000), null);
  const bs3 = { facts: { "us-gaap": { LongTermDebt: { units: { USD: [{ end: "2026-07-26", val: 8500 }] } } } } };
  assert.deepEqual(debtBreakdown(bs3, "2026-07-26"), { value: 8500, parts: ["us-gaap:LongTermDebt"] });
  console.log(JSON.stringify({ tenbaggerLongHorizonQuant: "pass" }));
}

// Revenue acceleration from quarters; TradingView ratio fields.
{
  const { revenueAcceleration } = await import("./tenbagger-build.mjs");
  const { rowFacts } = await import("./tenbagger-screen.mjs");
  const qs = [["2025-01-31", 100], ["2025-04-30", 110], ["2025-07-31", 120], ["2025-10-31", 130], ["2026-01-31", 120], ["2026-04-30", 143]].map(([end, revenue]) => ({ end, revenue }));
  const a = revenueAcceleration(qs);
  assert.equal(a.latestYoyPct, 30); assert.equal(a.priorYoyPct, 20); assert.equal(a.accelPts, 10); assert.equal(a.quarter, "2026-04-30");
  assert.equal(revenueAcceleration(qs.slice(1)), null, "needs six quarters");
  const gap = qs.map((x, i) => (i === 1 ? { ...x, end: "2025-02-15" } : x));
  assert.equal(revenueAcceleration(gap), null, "year-ago partner must be ~a year earlier");
  const f = rowFacts({ ticker: "KRX:000001", price_revenue_ttm: 3.456, price_earnings_ttm: -5, debt_to_equity: 0.42, earnings_release_next_date: 1795000000, RSI: 71.4 });
  assert.equal(f.psRatio, 3.46); assert.equal(f.peTtm, null); assert.equal(f.debtToEquityPct, 42); assert.equal(f.rsi14, 71.4);
  assert.match(f.nextEarnings, /^\d{4}-\d{2}-\d{2}$/);
  console.log(JSON.stringify({ tenbaggerAccelAndTvRatios: "pass" }));
}

// Industry percentile ranks and relative strength.
{
  const { industryRanks } = await import("./tenbagger-build.mjs");
  const { relativeStrength } = await import("./tenbagger-positioning.mjs");
  const mk = (i, g, ps) => ({ id: `c${i}`, industries: [{ id: "x" }], revenueGrowthPct: g, priceToSales: ps, quant: {}, valuation: {} });
  const cs = [mk(1, 10, 2), mk(2, 20, 4), mk(3, 30, 6), mk(4, 40, 8), mk(5, 50, 10), { id: "lone", industries: [{ id: "y" }], revenueGrowthPct: 99, quant: {} }];
  industryRanks(cs);
  assert.equal(cs[4].ranks.revenueGrowthPct.pct, 100); assert.equal(cs[0].ranks.revenueGrowthPct.pct, 0);
  assert.equal(cs[0].ranks.priceToSales.pct, 100, "cheapest P/S ranks highest"); assert.equal(cs[2].ranks.revenueGrowthPct.n, 5);
  assert.equal(cs[5].ranks, null, "fewer than five peers: no rank");
  const rs = relativeStrength({ return3mPct: 12.5, return1yPct: null }, { id: "x", return3mPct: 2.5, return1yPct: 30 });
  assert.equal(rs.rs3mPts, 10); assert.equal(rs.rs1yPts, null);
  console.log(JSON.stringify({ tenbaggerRanksAndRs: "pass" }));
}

// Current-only STI concepts seen in filings (NVIDIA files DebtSecuritiesCurrent).
{
  const { stiAtDate } = await import("./tenbagger-collect.mjs");
  const f = { facts: { "us-gaap": { DebtSecuritiesCurrent: { units: { USD: [{ end: "2026-07-26", val: 34143000000 }] } }, AvailableForSaleSecuritiesDebtSecurities: { units: { USD: [{ end: "2026-07-26", val: 46900000000 }] } } } } };
  const r = stiAtDate(f, "2026-07-26", 22443000000);
  assert.equal(r.value, 34143000000); assert.equal(r.concept, "us-gaap:DebtSecuritiesCurrent");
  console.log(JSON.stringify({ tenbaggerStiConcepts: "pass" }));
}

// Investment discipline, gross profitability, 3-year dilution, consensus estimates.
{
  const { investmentBlock, quantBlock } = await import("./tenbagger-build.mjs");
  const { dilution3yPct } = await import("./tenbagger-collect.mjs");
  const filed = { annual: [{ end: "2024-12-31", assets: 1000, ebitda: 100 }, { end: "2025-12-31", assets: 1500, ebitda: 110, grossProfit: 400 }], grossProfitTtm: 450, assetsLatest: 1500 };
  const ib = investmentBlock(filed);
  assert.equal(ib.assetGrowthPct, 50); assert.equal(ib.ebitdaGrowthPct, 10); assert.equal(ib.investmentGapPts, 40);
  assert.equal(ib.grossProfitabilityPct, 30); assert.equal(ib.investmentBasis, "filed");
  const neg = investmentBlock({ annual: [{ end: "2024-12-31", assets: 1000, ebitda: -5 }, { end: "2025-12-31", assets: 900, ebitda: 10 }] });
  assert.equal(neg.ebitdaGrowthPct, null, "growth from negative EBITDA is not meaningful"); assert.equal(neg.investmentGapPts, null);
  const snap = investmentBlock({ investment: { assets: 220, assetsPrior: 200, ebitda: 30, ebitdaPrior: 20, grossProfit: 66, end: "2025-12-31" } });
  assert.equal(snap.investmentGapPts, -40); assert.equal(snap.grossProfitabilityPct, 30); assert.equal(snap.investmentBasis, "Yahoo");
  const shares = [{ end: "2022-09-30", val: 100 }, { end: "2024-09-30", val: 120 }, { end: "2025-09-30", val: 150 }];
  assert.equal(dilution3yPct(shares), 50);
  assert.equal(dilution3yPct(shares.slice(1)), null, "needs a count ~three years earlier");
  const q = quantBlock({ estimates: { revenueGrowthFy1Pct: 31.2, epsRevision90dPct: 4.5, epsUp30d: 3, epsDown30d: 1 }, annual: [] });
  assert.equal(q.revenueGrowthFy1Pct, 31.2); assert.equal(q.epsRevision90dPct, 4.5); assert.equal(q.epsUp30d, 3);
  console.log(JSON.stringify({ tenbaggerInvestmentAndEstimates: "pass" }));
}

// Research-backed presets filter on the new quant fields.
{
  const { PRESETS, applyFilters } = await import("../tenbagger/js/presets.js");
  const base = { market: "US", name: "A", ticker: "NASDAQ:A", industries: [], data: { financials: "filed" }, revenueGrowthPct: 30 };
  const good = { ...base, id: "a", quant: { epsRevision90dPct: 5, revenueAccelPts: 3, grossProfitabilityPct: 40, investmentGapPts: -5, dilution3yPct: 2 } };
  const bad = { ...base, id: "b", quant: { epsRevision90dPct: -2, revenueAccelPts: 3, grossProfitabilityPct: 10, investmentGapPts: 30, dilution3yPct: 60 } };
  assert.deepEqual(applyFilters([good, bad], PRESETS["estimate-upgrades"].params).map((c) => c.id), ["a"]);
  assert.deepEqual(applyFilters([good, bad], PRESETS.disciplined.params).map((c) => c.id), ["a"]);
  console.log(JSON.stringify({ tenbaggerResearchPresets: "pass" }));
}
