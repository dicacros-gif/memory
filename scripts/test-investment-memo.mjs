import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildInvestmentMemo, equityMetrics, equitySignal } from "./investment-memo.mjs";
import { buildTerminalClient, terminalEstimateSignals } from "./terminal-data.mjs";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const model = JSON.parse(await read("../data/investment-memo-model.json"));
const DAY = 864e5;
const now = Date.parse("2026-10-22T12:00:00Z");

// A synthetic year of closes: a steady climb, then a sharp fall into "now".
function series(id, { start = 100, climb = 0.004, fall = 0, days = 320 } = {}) {
  const points = [];
  let value = start;
  for (let day = days; day >= 0; day -= 1) {
    value *= day < 25 ? 1 - fall : 1 + climb;
    points.push([now - day * DAY, Number(value.toFixed(4))]);
  }
  return { id, symbol: id.toUpperCase(), exchange: "TEST", currency: "USD", points };
}

function marketHistory(options = {}) {
  const indexes = { sox: series("sox", options) };
  for (const entry of model.universe) indexes[entry.id] = series(entry.id, options);
  for (const id of model.demandReadThrough) indexes[id] = series(id, { climb: 0.002 });
  return { indexes };
}

const quarter = (date, value) => ({ date, value });
const quant = {
  expiresAt: "2026-10-23T12:00:00Z",
  memoryMomentum: {
    dramSpot30dPct: 1.5, dramSpot90dPct: 20, nandSpot30dPct: 4, nandSpot90dPct: 26, asOf: "2026-10-22",
    coverage: { dram30: { spanDays: 30 }, dram90: { spanDays: 90 }, nand30: { spanDays: 30 }, nand90: { spanDays: 90 } },
  },
  foundry: { tsmcMonthly: { month: "2026-09", yoyPct: 50, momPct: 1, revenueBillionTwd: 500, revenueHistory: { points: [] } } },
  fundamentals: { micron: { source: "SEC EDGAR", history: {
    revenue: [quarter("2025-05-29", 9e9), quarter("2026-02-26", 24e9), quarter("2026-05-28", 41e9)],
    grossProfit: [quarter("2025-05-29", 3e9), quarter("2026-02-26", 18e9), quarter("2026-05-28", 35e9)],
    inventory: [quarter("2026-05-28", 8.5e9), quarter("2026-09-03", 8.8e9)],
  } } },
  fx: { usdkrw: { value: 1350, changePct90d: -2, asOf: "2026-10-22" } },
  scenarioCalibration: { drivers: { chinaPressure: 20, chinaEvidence: 10 } },
  decisionIntelligence: { metrics: { observations: [
    { metricId: "hbm-revenue-share", entityId: "skhynix", company: "SKHY", period: "2026-Q1", value: 55 },
    { metricId: "hbm-revenue-share", entityId: "skhynix", company: "SKHY", period: "2026-Q2", value: 54 },
  ] }, eventTriggers: [], claimEvents: { events: [] } },
};

// 1. Fail-closed: with no inputs the memo withholds a stance.
const empty = buildInvestmentMemo({ model, now: new Date(now) });
assert.equal(empty.verdict.stance.id, "withheld", "a memo without verified inputs must withhold its stance");
assert.equal(empty.verdict.conviction.id, "low");
assert.ok(empty.factors.every((factor) => factor.score === null), "no factor may be scored from missing data");

// 2. Strong fundamentals and a healthy tape produce an overweight call.
const strong = buildInvestmentMemo({
  quant,
  marketHistory: marketHistory({ climb: 0.0012 }),
  priceHistory: {},
  model,
  estimates: { count: 5, rev90Median: 12, rev30Median: 4, upsideMedian: 30, recommendationMedian: 1.8, asOf: "2026-10-22" },
  runId: "test-run",
  now: new Date(now),
});
assert.equal(strong.runId, "test-run");
assert.equal(strong.clientArtifact, true);
assert.equal(strong.verdict.stance.id, "overweight", `expected overweight, got ${strong.verdict.stance.id} at ${strong.verdict.composite}`);
assert.equal(strong.factors.find((factor) => factor.id === "estimates").score, 2, "EPS revisions of 10%+ over 90 days must score +2");
const staleUpside = buildInvestmentMemo({
  quant, marketHistory: marketHistory({ climb: 0.0012 }), priceHistory: {}, model,
  estimates: { count: 5, rev90Median: 5, upsideMedian: 140 }, now: new Date(now),
});
assert.equal(staleUpside.factors.find((factor) => factor.id === "estimates").score, 1, "target upside is context only and must never raise the estimates score");
assert.ok(strong.factors.every((factor) => factor.verdict && factor.soWhat), "every factor must explain itself");
assert.ok(strong.verdict.keyMessages.length >= 1 && strong.verdict.keyMessages.length <= 3);
assert.equal(strong.scenarios.reduce((sum, item) => sum + item.probability, 0), 100, "scenario probabilities must sum to 100");
assert.ok(strong.scenarios.find((item) => item.id === "bull").probability > strong.scenarios.find((item) => item.id === "bear").probability);

// 3. A collapsing tape is the market discounting a peak, not cheapness.
const falling = buildInvestmentMemo({ quant, marketHistory: marketHistory({ climb: 0.003, fall: 0.02 }), priceHistory: {}, model, now: new Date(now) });
const positioning = falling.factors.find((factor) => factor.id === "positioning");
assert.ok(positioning.score <= 0, "a deep drawdown with a falling tape must not score as value");
assert.equal(falling.killCriteria.find((row) => row.id === "basket-drawdown").status, "kill");

// 4. Two breached kill criteria lower the stance one notch and say so.
const breached = buildInvestmentMemo({
  quant: {
    ...quant,
    memoryMomentum: { ...quant.memoryMomentum, dramSpot30dPct: -8, nandSpot30dPct: -9 },
  },
  marketHistory: marketHistory({ climb: 0.0012 }),
  priceHistory: {},
  model,
  estimates: { count: 5, rev90Median: 12, upsideMedian: 30 },
  now: new Date(now),
});
assert.ok(breached.killCriteria.filter((row) => row.status === "kill").length >= 2);
assert.notEqual(breached.verdict.stance.id, "overweight", "two kill conditions must lower an overweight call");
assert.equal(breached.verdict.threshold, null, "an overridden call must not also print a distance to the next stance");

// 5. History accumulates and changes are reported against the prior run.
const next = buildInvestmentMemo({
  quant, marketHistory: marketHistory({ climb: 0.0012 }), priceHistory: {}, model,
  previous: { history: [{ asOf: "2026-10-21", composite: -0.2, stance: "neutral", warns: 0, kills: 0 }], factors: [] },
  now: new Date(now),
});
assert.equal(next.history.length, 2);
assert.ok(next.verdict.change.items.some((item) => item.startsWith("투자 의견")), "a stance change must be listed");

// 6. Equity signals read the tape with explicit rules.
const metrics = equityMetrics(series("x", { climb: 0.004 }), { now });
assert.equal(metrics.status, "ok");
assert.equal(equitySignal({ status: "stale" }).id, "hold");
assert.equal(equitySignal({ ...metrics, vsMa200: 80 }).id, "overheated");
assert.equal(equitySignal({ ...metrics, vsMa200: -10, ma50AboveMa200: false }).id, "broken");

// 7. Terminal artifact joins OpenBB sections onto the crawl's closes.
const source = {
  generatedAt: "2026-10-22T11:00:00Z",
  universe: [{ id: "micron-stock", symbol: "MU", name: "Micron", region: "global", valueChain: "memory" }],
  equities: { MU: {
    consensus: { asOf: "2026-10-22T11:00:00Z", data: { current_price: 100, target_median: 125, number_of_analysts: 30, recommendation_mean: 1.8 } },
    metrics: { asOf: "2026-10-22T11:00:00Z", data: { forward_pe: 9.5, gross_margin: 0.6, market_cap: 1e11 } },
    epsTrend: { asOf: "2026-10-22T11:00:00Z", data: [{ period: "0y", current: 11, days_ago_30: 10.5, days_ago_90: 10 }] },
  } },
  providers: { openbb: { package: "openbb-core", license: "AGPL-3.0", state: "ok", ok: 3, failed: 0 } },
};
const estimates = terminalEstimateSignals(source, ["MU"]);
assert.equal(estimates.upsideCount, 1);
assert.equal(estimates.upsideMedian, null, "a basket upside median needs three usable consensus rows");
assert.equal(estimates.rev90Median, 10);
const staleSource = { equities: Object.fromEntries(["A", "B", "C"].map((symbol) => [symbol, { consensus: { asOf: "2026-10-22", data: { current_price: 100, target_median: 300, target_low: 200, target_high: 400, number_of_analysts: 20 } } }])) };
const stale = terminalEstimateSignals(staleSource, ["A", "B", "C"]);
assert.equal(stale.upsideMedian, null, "targets the price has fallen far below must not produce an upside median");
assert.equal(stale.targetsWithheld.length, 3);
assert.ok(stale.targetsWithheld.every((row) => row.status === "stale"));
const terminal = buildTerminalClient({ source, marketHistory: { indexes: { "micron-stock": series("micron-stock") } }, memo: strong, runId: "test-run", now: new Date(now) });
const mu = terminal.equities.find((row) => row.id === "micron-stock");
assert.equal(terminal.runId, "test-run");
assert.equal(terminal.clientArtifact, true);
assert.equal(mu.consensus.upside, Number(((125 / mu.price.last - 1) * 100).toFixed(2)), "upside is measured against the published close");
assert.ok(terminal.integrity && Array.isArray(terminal.integrity.flags) && terminal.integrity.rules.length >= 5, "the terminal publishes its integrity rules and flags");
assert.equal(mu.valuation.forwardPe, 9.5);
assert.equal(mu.fundamentals.grossMargin, 60);
assert.ok(mu.price.spark.length > 10, "terminal rows carry a sparkline from the crawl's closes");
assert.equal(terminal.providers.openbb.license, "AGPL-3.0");
assert.ok(Array.isArray(terminal.alerts), "the terminal publishes daily scan alerts");
assert.ok(terminal.correlation && Array.isArray(terminal.correlation.values), "the terminal publishes a return correlation matrix");
assert.ok(terminal.brokers && Array.isArray(terminal.brokers.actions), "the terminal publishes brokerage actions");
assert.ok(isFinite(mu.scan?.rsi), "every priced row carries a Wilder RSI");
assert.ok(strong.market?.markets && strong.market.stages.length === 5, "the memo carries the live landing market read");

// 8. Contracts: no typed-in dated figures remain and the pipeline publishes both artifacts.
const html = await read("../index.html");
const app = await read("../assets/js/app.js");
const workflow = await read("../.github/workflows/pages.yml");
const terminalHtml = await read("../terminal/index.html");
const landingJs = await read("../assets/js/landing.js");
const collector = await read("./terminal/collect_market.py");
const requirements = await read("./terminal/requirements.txt");
assert.doesNotMatch(html, /'26\.\d{1,2}월 점검/, "investor boards must not carry hand-dated figures");
for (const mount of ['id="investorMemo"', 'data-memo-ledger="demand"', 'data-memo-ledger="technology"', 'data-memo-ledger="risk"', 'id="investorKillMonitor"', 'id="investor-today"', 'href="terminal/"']) {
  assert.ok(html.includes(mount), `missing live mount ${mount}`);
}
assert.match(app, /from "\.\/investment-memo-view\.js"/);
assert.match(app, /investmentMemo: \{\s*path: "data\/investment-memo-client\.json"[\s\S]*?validate: sameRunArtifact/);
assert.match(workflow, /Install OpenBB, FinanceDataReader and TradingView-Screener[\s\S]*?continue-on-error: true[\s\S]*?Collect semiconductor terminal data[\s\S]*?continue-on-error: true[\s\S]*?python scripts\/terminal\/collect_market\.py[\s\S]*?Run intelligence agent/,
  "the collector must run fail-soft before the crawl that bundles its output");
for (const path of ["data/investment-memo-client.json", "data/terminal-client.json", "data/terminal-source.json", "data/terminal-ohlcv"]) {
  assert.match(workflow, new RegExp(`git add [^\\n]*${path.replace(/[.\\/]/g, "\\$&")}`), `${path} must be committed by the refresh job`);
}
assert.match(terminalHtml, /assets\/vendor\/klinecharts\/klinecharts\.min\.js/);
assert.match(terminalHtml, /assets\/vendor\/lightweight-charts\/lightweight-charts\.standalone\.production\.js/);
for (const fn of ["TOP", "ALRT", "MON", "GP", "COMP", "DES", "BRKR", "EQRV", "CORR", "ETF", "MEM", "ECO", "SCRN", "CAL", "RISK", "N", "SRC"]) {
  assert.ok(terminalHtml.includes(`data-fn="${fn}"`), `terminal function key ${fn} missing`);
}
for (const mount of ["data-live-market", "data-live-stage", "data-live-method", "data-live-lens"]) {
  assert.ok(html.includes(mount), `landing live mount ${mount} missing`);
}
assert.match(landingJs, /function renderLandingLive\(memo, esc\)/);
assert.match(terminalHtml, /assets\/js\/terminal\.min\.js\?v=infra-[a-f0-9]{12}/);
assert.match(requirements, /^openbb-core==/m);
assert.match(requirements, /^openbb-yfinance==/m);
assert.doesNotMatch(requirements, /pykrx|tvdatafeed|TradingView-API/i, "login- or account-bound sources stay out");
assert.doesNotMatch(collector, /getenv\(\s*["'](?:KRX_|[A-Z_]*API_KEY|[A-Z_]*TOKEN)|api_key\s*=|cookies\s*=|login_krx/i, "the collector must not need credentials");

console.log(JSON.stringify({
  investmentMemo: "pass",
  stances: [empty.verdict.stance.id, strong.verdict.stance.id, breached.verdict.stance.id],
  terminalRows: terminal.equities.length,
}));
