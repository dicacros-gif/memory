import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { rowFacts, tvTicker } from "./tenbagger-screen.mjs";
import { PRESETS, applyFilters } from "../tenbagger/js/presets.js";

/**
 * Ten-bagger company-data layer for the static site.
 *
 * Joins the curated universe (data/tenbagger/universe.json), the collected
 * metrics (metrics.json), the TradingView screen (screen.json) and the
 * historical cohort (cohort.json) into the files the pages read:
 *
 *   companies.json  one record per listing, stable id (us-nasdaq-nvda), the
 *                   industries it belongs to (no duplicate counting), statement
 *                   figures with period end, source status and update dates
 *   industries.json industry cards: forecasts kept per source, observed growth,
 *                   coverage, value-chain groups
 *   startups.json   startup profiles and listed company -> vehicle -> startup
 *                   ownership relationships (percent and amount kept apart)
 *   history.json    hindsight cases and the cohort's executable base rates
 *   fx.json         FRED DEXKOUS (KRW per USD), last good value kept
 *   changelog.json  companies added to / removed from coverage, by date
 *   status.json     per-source last attempt, last success and stale-since
 *
 * Nothing is estimated except where a field says so (startup exposure).
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const P = (name) => resolve(root, "data/tenbagger", name);
const DAY = 864e5;
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const round = (v, d = 1) => (isNum(v) ? Number(v.toFixed(d)) : null);

const US = new Set(["NASDAQ", "NYSE", "NYSEAMERICAN", "AMEX", "NYSEARCA"]);
const KR = new Set(["KRX", "KOSDAQ", "KOSPI"]);
const TV_TO_EXCHANGE = { AMEX: "NYSEAMERICAN", XETR: "XETRA", SIX: "SWX", EURONEXT: "EURONEXT" };

export function marketOf(ticker) {
  const exchange = String(ticker).split(":")[0].toUpperCase();
  return US.has(exchange) ? "US" : KR.has(exchange) ? "KR" : "OTHER";
}

/** Stable id from the listing: us-nasdaq-nvda, kr-kosdaq-196170, jp-tse-6324. */
export function companyId(ticker) {
  const [exchange, code] = String(ticker).split(":");
  const region = { US: "us", KR: "kr" }[marketOf(ticker)] || ({ TSE: "jp", TYO: "jp", HKEX: "hk", SSE: "cn", SZSE: "cn", TWSE: "tw", TPEX: "tw", LSE: "uk", TSX: "ca", SWX: "ch", AMS: "nl", XETRA: "de", ASX: "au" }[String(exchange).toUpperCase()] || "xx");
  return `${region}-${String(exchange).toLowerCase()}-${String(code).toLowerCase().replace(/[^a-z0-9]+/g, "")}`;
}

const normalize = (ticker) => {
  const [exchange, code] = String(ticker).split(":");
  return `${TV_TO_EXCHANGE[exchange] || exchange}:${code}`;
};

/** Holder text "Intel (Intel Capital)" -> parent and investing vehicle. */
export function splitVehicle(holder) {
  const m = /^(.*?)\s*\((.+)\)\s*$/.exec(String(holder || ""));
  if (!m) return { parent: String(holder || ""), vehicle: null };
  const vehicle = m[2].replace(/^via\s+/i, "");
  return { parent: m[1], vehicle };
}

/** Ownership relationship status and basis from the curated fields and their notes. */
export function relationship(h, startup) {
  const note = String(h.note || "");
  const { parent, vehicle } = splitVehicle(h.holder);
  const status = h.status || (/terminat|pending|talks|not completed|announced/i.test(note) ? "pending"
    : /sold|exited|cashed out|divested|distribution/i.test(note) ? "historical" : "completed");
  const basis = h.stakeBasis || (/look-through|effective|indirect/i.test(note) ? "economic (look-through)"
    : /voting/i.test(note) ? "voting" : /fully diluted/i.test(note) ? "fully diluted" : "not stated");
  const holding = h.holding || (vehicle || /via |through |indirect|look-through/i.test(`${note} ${h.holder}`) ? "indirect" : "direct");
  const valuationDate = startup?.valuationDate || null;
  return {
    parent, vehicle, holding, basis, status,
    pctOwned: isNum(h.pctOwned) ? h.pctOwned : null,
    amountUsd: isNum(h.amountUsd) ? h.amountUsd : null,
    measuredAt: h.asOf || null,
    // A percentage measured before the latest priced round may be diluted since.
    predatesLatestRound: isNum(h.pctOwned) && h.asOf && valuationDate ? h.asOf < valuationDate : false,
    source: { type: { filing: "filing", "company-disclosure": "company", reported: "press" }[h.basis] || "source", url: h.url || null, check: h.check || "cited" },
    note: note || null,
  };
}

/** Peak-to-trough fall inside a monthly window, in % (negative). */
export function maxDrawdownPct(points) {
  let peak = -Infinity, worst = 0;
  for (const p of points) {
    peak = Math.max(peak, p.close);
    worst = Math.min(worst, p.close / peak - 1);
  }
  return round(worst * 100);
}

/** Revenue growth over the last four quarters vs the four before, when eight consecutive quarters exist. */
export function ttmGrowthFromQuarters(quarters = []) {
  const q = quarters.filter((x) => isNum(x.revenue));
  if (q.length < 8) return null;
  const last8 = q.slice(-8);
  const spanDays = (Date.parse(last8.at(-1).end) - Date.parse(last8[0].end)) / DAY;
  if (spanDays < 600 || spanDays > 680) return null;
  const now = last8.slice(4).reduce((s, x) => s + x.revenue, 0);
  const before = last8.slice(0, 4).reduce((s, x) => s + x.revenue, 0);
  return before > 0 ? round((now / before - 1) * 100) : null;
}

/** Compare with TradingView only when both are trailing-twelve-month growth on a recent period. */
export function periodAlignedCheck(company, tv, fetchedAt) {
  if (!tv || !isNum(tv.revenueGrowthPct)) return { state: "no-data" };
  const ours = company.revenueGrowthTtmPct;
  const end = company.revenueEnd;
  if (!isNum(ours) || !end) return { state: "not-comparable", reason: "자체 수치에 최근 4분기 성장률 없음" };
  const lag = (Date.parse(fetchedAt || Date.now()) - Date.parse(end)) / DAY;
  if (lag > 130) return { state: "not-comparable", reason: `자체 기간 종료 ${end} — 최근 분기와 다를 수 있음` };
  const diff = round(ours - tv.revenueGrowthPct);
  return { state: Math.abs(diff) <= 5 ? "aligned" : "differs", diffPp: diff, tv: tv.revenueGrowthPct, ours, periodEnd: end };
}

function trend(series = []) {
  const pts = series.filter((p) => isNum(p.close));
  if (pts.length < 13) return {};
  const last = pts.at(-1).close;
  const high12 = Math.max(...pts.slice(-13).map((p) => p.close));
  return { ret3mPct: round((last / pts.at(-4).close - 1) * 100), offHigh12mPct: round((last / high12 - 1) * 100) };
}

const STOP = new Set(["inc", "corp", "corporation", "co", "ltd", "limited", "plc", "the", "holdings", "holding", "group", "company", "technologies", "technology", "class", "ord", "shares"]);
const tokens = (s) => new Set(String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((t) => t.length >= 3 && !STOP.has(t)));

/**
 * A company added by research ("verification": "pending") is published only
 * after its listing is confirmed: the ticker exists in this run's TradingView
 * scan with a matching name (Korean six-digit codes match on code alone), and
 * a US ticker is also in SEC's ticker map. Returns true / false / null (no scan).
 */
export function verifyListing(company, tvRow, secCik, scanAvailable) {
  if (!scanAvailable) return null;
  if (!tvRow) return false;
  const market = marketOf(company.ticker);
  if (market === "US" && !secCik) return false;
  if (market === "KR") return true;
  const a = tokens(company.name), b = tokens(tvRow.description || tvRow.name);
  return [...a].some((t) => b.has(t));
}

/**
 * Derived indicators, each from fields of the same record:
 * Rule of 40 (revenue growth % + FCF margin %), net cash (cash + short-term
 * investments − debt, same balance-sheet date) and its share of market cap,
 * analyst target upside, plus the Yahoo quality/ownership/analyst fields.
 */
/**
 * Revenue acceleration: latest quarter's YoY growth minus the previous
 * quarter's YoY growth (percentage points). Needs six consecutive quarters
 * whose year-ago partners are 330–400 days earlier.
 */
export function revenueAcceleration(quarters = []) {
  const q = quarters.filter((x) => isNum(x.revenue)).sort((a, b) => String(a.end).localeCompare(String(b.end)));
  if (q.length < 6) return null;
  const yoy = (i) => {
    const cur = q[i], base = q[i - 4];
    const days = (Date.parse(cur.end) - Date.parse(base.end)) / DAY;
    return days > 330 && days < 400 && base.revenue > 0 ? (cur.revenue / base.revenue - 1) * 100 : null;
  };
  const latest = yoy(q.length - 1), prior = yoy(q.length - 2);
  if (!isNum(latest) || !isNum(prior)) return null;
  return { latestYoyPct: round(latest), priorYoyPct: round(prior), accelPts: round(latest - prior), quarter: q.at(-1).end };
}

/** Revenue CAGR over three fiscal years: latest annual revenue vs the one ~3 years earlier. */
export function revenueCagr3y(annual = []) {
  const a = annual.filter((x) => isNum(x.revenue) && x.revenue > 0).sort((x, y) => String(x.end).localeCompare(String(y.end)));
  if (a.length < 4) return null;
  const last = a.at(-1);
  const base = a.find((x) => { const yrs = (Date.parse(last.end) - Date.parse(x.end)) / (365.25 * DAY); return yrs > 2.75 && yrs < 3.25; });
  if (!base) return null;
  return { pct: round((Math.pow(last.revenue / base.revenue, 1 / 3) - 1) * 100), from: base.end, to: last.end };
}

/**
 * Filed net cash against Yahoo's most-recent-quarter totals (same currency only).
 * Flags only a sign disagreement with a gap above 5% of market cap; Yahoo's debt
 * includes leases, so smaller gaps are expected and not shown.
 */
export function balanceCheck(c, netCash) {
  const v = c.valuation || {};
  if (!isNum(netCash) || !isNum(v.totalCash) || !isNum(v.totalDebt)) return null;
  if (!v.financialCurrency || v.financialCurrency !== c.statementCurrency) return null;
  const yahoo = v.totalCash - v.totalDebt;
  const gap = Math.abs(yahoo - netCash);
  const material = isNum(c.marketCap) && c.marketCap > 0 && c.currency === c.statementCurrency ? gap / c.marketCap > 0.05 : gap > Math.abs(netCash) * 0.5;
  return { yahooNetCash: yahoo, filedNetCash: netCash, disagree: Math.sign(yahoo) !== Math.sign(netCash) && material };
}

/**
 * Investment discipline (Cooper, Gulen & Schill 2008; Yartseva 2025): total asset
 * growth against EBITDA growth over the last fiscal year, plus gross profitability
 * (Novy-Marx 2013): gross profit ÷ total assets. Filed annual data first, else the
 * Yahoo snapshot's two fiscal years.
 */
export function investmentBlock(c) {
  const a = (c.annual || []).filter((x) => isNum(x.assets) && x.assets > 0);
  let cur = null, prev = null, src = null;
  if (a.length >= 2) { cur = a.at(-1); prev = a.at(-2); src = "filed"; }
  else if (c.investment && isNum(c.investment.assets) && isNum(c.investment.assetsPrior)) {
    cur = { assets: c.investment.assets, ebitda: c.investment.ebitda, grossProfit: c.investment.grossProfit, end: c.investment.end };
    prev = { assets: c.investment.assetsPrior, ebitda: c.investment.ebitdaPrior };
    src = "Yahoo";
  }
  const g = (x, y) => (isNum(x) && isNum(y) && y > 0 && x > 0 ? round((x / y - 1) * 100) : null);
  const assetGrowthPct = cur && prev ? g(cur.assets, prev.assets) : null;
  const ebitdaGrowthPct = cur && prev ? g(cur.ebitda, prev.ebitda) : null;
  const gpBase = isNum(c.grossProfitTtm) && isNum(c.assetsLatest) && c.assetsLatest > 0 ? [c.grossProfitTtm, c.assetsLatest] : cur && isNum(cur.grossProfit) ? [cur.grossProfit, cur.assets] : null;
  return {
    assetGrowthPct, ebitdaGrowthPct,
    investmentGapPts: isNum(assetGrowthPct) && isNum(ebitdaGrowthPct) ? round(assetGrowthPct - ebitdaGrowthPct) : null,
    grossProfitabilityPct: gpBase ? round((gpBase[0] / gpBase[1]) * 100) : null,
    investmentBasis: src, investmentYear: cur?.end || null,
  };
}

export function quantBlock(c) {
  const v = c.valuation || {};
  const sameCur = c.currency && c.statementCurrency && c.currency === c.statementCurrency;
  const netCash = isNum(c.cashPlusSti) && isNum(c.debt) ? c.cashPlusSti - c.debt : null;
  const cagr = revenueCagr3y(c.annual);
  const lastAnnual = (c.annual || []).filter((x) => isNum(x.fcf)).slice(-3);
  const accel = revenueAcceleration(c.quarters);
  const est = c.estimates || {};
  const sp = c.surprises || {};
  return {
    // Sloan (1996): (net income − operating cash flow) ÷ total assets; high accruals = lower earnings quality.
    accrualsPct: isNum(c.netIncomeTtm) && isNum(c.ocfTtm) && isNum(c.assetsLatest) && c.assetsLatest > 0 ? round(((c.netIncomeTtm - c.ocfTtm) / c.assetsLatest) * 100) : null,
    epsBeats: sp.beats ?? null, epsBeatQuarters: sp.quarters ?? null, epsSurpriseMeanPct: sp.meanSurprisePct ?? null, epsSurpriseLatest: sp.latest ?? null,
    ...investmentBlock(c),
    dilution3yPct: c.dilution3yPct ?? null,
    revenueGrowthFy0Pct: est.revenueGrowthFy0Pct ?? null, revenueGrowthFy1Pct: est.revenueGrowthFy1Pct ?? null, revenueAnalysts: est.revenueAnalysts ?? null,
    epsRevision30dPct: est.epsRevision30dPct ?? null, epsRevision90dPct: est.epsRevision90dPct ?? null,
    epsUp30d: est.epsUp30d ?? null, epsDown30d: est.epsDown30d ?? null, epsTrendPeriod: est.epsTrendPeriod ?? null,
    revenueAccelPts: accel?.accelPts ?? null, revenueYoyLatestPct: accel?.latestYoyPct ?? null, revenueAccelQuarter: accel?.quarter ?? null,
    revenueCagr3yPct: cagr?.pct ?? null, revenueCagr3yPeriod: cagr ? `${cagr.from}→${cagr.to}` : null,
    fcfYieldPct: isNum(c.fcfTtm) && isNum(c.marketCap) && c.marketCap > 0 && sameCur ? round((c.fcfTtm / c.marketCap) * 100) : null,
    fcfPositiveYears: lastAnnual.length === 3 ? lastAnnual.filter((x) => x.fcf > 0).length : null,
    balanceCheck: balanceCheck(c, netCash),
    ruleOf40: isNum(c.revenueGrowthPct) && isNum(c.fcfMarginPct) ? round(c.revenueGrowthPct + c.fcfMarginPct) : null,
    netCash, netCashToMcapPct: isNum(netCash) && isNum(c.marketCap) && c.marketCap > 0 && sameCur ? round((netCash / c.marketCap) * 100) : null,
    targetUpsidePct: isNum(v.targetMean) && isNum(c.price) && c.price > 0 ? round((v.targetMean / c.price - 1) * 100) : null,
    roePct: v.roePct ?? null, roaPct: v.roaPct ?? null, profitMarginPct: v.profitMarginPct ?? null,
    revenueGrowthQoqYoyPct: v.revenueGrowthQoqYoyPct ?? null, earningsGrowthQoqYoyPct: v.earningsGrowthQoqYoyPct ?? null,
    debtToEquity: v.debtToEquity ?? null, currentRatio: v.currentRatio ?? null, beta: v.beta ?? null,
    insiderPct: v.insiderPct ?? null, institutionPct: v.institutionPct ?? null,
    recommendationMean: v.recommendationMean ?? null, recommendationKey: v.recommendationKey ?? null, analysts: v.analysts ?? null,
  };
}

export function buildCompanies({ universe, metrics, screen, previousCompanies = null, changelog = null, now = new Date(), verified = null, tvRows = null }) {
  const byTicker = new Map((metrics?.companies || []).map((m) => [m.ticker, m]));
  const out = new Map();
  const ensure = (ticker, base) => {
    const id = companyId(ticker);
    if (!out.has(id)) out.set(id, { id, ticker, market: marketOf(ticker), exchange: ticker.split(":")[0], industries: [], holdings: [], ...base });
    return out.get(id);
  };
  // Path 1: curated listed companies per industry.
  for (const s of universe.sectors || []) {
    for (const c of s.publicCompanies || []) {
      if (c.verification === "pending" && !(verified && verified.has(c.ticker))) continue;
      const rec = ensure(c.ticker, { name: c.name, country: c.country || null, coverage: "universe" });
      rec.industries.push({ id: s.id, name: s.name, layer: c.layer, subsector: c.subsector || null, chainLayer: c.chainLayer || null, chainNote: c.chainNote || null, thesis: c.thesis || null, sourceUrl: c.sourceUrl || null });
    }
  }
  // Path 2: listed shareholders of startups.
  for (const s of universe.sectors || []) {
    for (const st of s.startups || []) {
      for (const h of st.holders || []) {
        for (const t of String(h.holderTicker || "").split("/").map((x) => x.trim()).filter((x) => x.includes(":"))) {
          const rec = ensure(normalize(t), { name: splitVehicle(h.holder).parent, coverage: "holder" });
          rec.holdings.push({ startup: st.name, startupId: slugify(st.name), industry: s.id, ...relationship(h, st) });
        }
      }
    }
  }
  // Screen names outside both paths (TradingView-only data).
  const screenRows = [...(screen?.discovery || []), ...(screen?.factorLeaders || [])];
  for (const r of screenRows) {
    const t = normalize(r.ticker);
    if (!/^[A-Z]+:/.test(t) || marketOf(t) === "OTHER" && !r.marketCapUsd) continue;
    const rec = ensure(t, { name: r.name, country: r.country || null, coverage: "screen" });
    rec.screen = { industry: r.industry, industryKo: r.industryKo || null, sector: r.sector || null };
  }
  const prevIds = new Set((previousCompanies?.companies || []).filter((c) => c.coverage !== "screen").map((c) => c.id));
  const recentAdds = new Map((changelog?.entries || []).flatMap((e) => (e.added || []).map((id) => [id, e.date])));
  for (const rec of out.values()) {
    const m = byTicker.get(rec.ticker) || null;
    const f = m?.fundamentals || null;
    const r = screenRows.find((x) => normalize(x.ticker) === rec.ticker) || null;
    const tvFacts0 = m?.tv || null;
    const tvRow = tvRows?.get(tvTicker(rec.ticker)) || null;
    rec.name = rec.name || m?.name || rec.ticker;
    rec.currency = m?.currency || null;
    rec.price = m?.price ?? null;
    rec.marketCap = m?.marketCap ?? null;
    rec.marketCapUsd = m?.marketCapUsd ?? r?.marketCapUsd ?? tvFacts0?.marketCapUsd ?? null;
    rec.statementCurrency = f?.currency || null;
    rec.revenueTtm = f?.revenueTtm ?? null;
    rec.revenueBasis = f?.revenueBasis ?? null;
    rec.revenueEnd = f?.revenueEnd ?? null;
    rec.revenueGrowthPct = f?.revenueGrowthPct ?? null;
    rec.revenueGrowthBasis = f ? (f.revenueGrowthBasis || "fiscal-year YoY") : r ? "TTM YoY (TradingView)" : null;
    rec.revenueGrowthTtmPct = ttmGrowthFromQuarters(f?.quarters);
    if (!isNum(rec.revenueGrowthPct) && r) rec.revenueGrowthPct = r.revenueGrowthPct ?? null;
    rec.grossMarginPct = f?.grossMarginPct ?? r?.grossMarginPct ?? null;
    rec.operatingMarginPct = f?.operatingMarginPct ?? null;
    rec.ocfTtm = f?.operatingCashFlowTtm ?? null;
    rec.capexTtm = f?.capexTtm ?? null;
    rec.fcfTtm = f?.fcfTtm ?? null;
    rec.fcfMarginPct = m?.fcfMarginPct ?? r?.fcfMarginPct ?? null;
    rec.fcfPositive = isNum(rec.fcfTtm) ? rec.fcfTtm >= 0 : r?.fcfPositive ?? null;
    rec.cashOnly = f?.cashOnly ?? null;
    rec.shortTermInvestments = f?.shortTermInvestments ?? null;
    rec.cashPlusSti = f?.cashAndShortTermInvestments ?? null;
    rec.debt = f?.debt ?? null;
    rec.balanceSheetEnd = f?.cashEnd ?? null;
    rec.runwayCashOnlyYears = m?.runwayCashOnlyYears ?? null;
    rec.runwayCashPlusStiYears = m?.runwayYears ?? r?.runwayYears ?? null;
    rec.runwayStatus = m?.runwayStatus ?? (r ? "estimate" : null);
    rec.dilutionPct = f?.dilutionPct ?? null;
    rec.priceToSales = isNum(rec.marketCap) && isNum(rec.revenueTtm) && rec.revenueTtm > 0 && rec.currency === rec.statementCurrency ? round(rec.marketCap / rec.revenueTtm) : null;
    rec.returns = { m12: m?.returns?.m12 ?? r?.perf1yPct ?? null, m36: m?.returns?.m36 ?? null, m60: m?.returns?.m60 ?? r?.perf5yPct ?? null, ...trend(m?.series) };
    if (!isNum(rec.returns.offHigh12mPct) && r) rec.returns.offHigh12mPct = r.offHighPct ?? null;
    rec.avgTradedValue20d = m?.avgTradedValue20d ?? null; // listing currency
    rec.shortInterest = m?.shortInterest ?? null;
    rec.valuation = m?.valuation ?? null;
    // Growth-adjusted P/S for companies without earnings: P/S ÷ revenue growth (%).
    rec.psToGrowth = isNum(rec.priceToSales) && isNum(rec.revenueGrowthPct) && rec.revenueGrowthPct > 0 ? round(rec.priceToSales / rec.revenueGrowthPct, 2) : null;
    rec.nextEarnings = m?.nextEarnings ?? null;
    rec.daysToEarnings = rec.nextEarnings ? Math.round((Date.parse(rec.nextEarnings) - now.getTime()) / DAY) : null;
    rec.burnTrend = burnTrend(f?.quarters);
    rec.revenueReported = f ? f.revenueReported !== false : null;
    // Fields still empty after SEC/DART/Yahoo: TradingView's scan, labelled per field.
    rec.filledFrom = {};
    const tvFacts = tvRow ? rowFacts(tvRow) : null;
    if (tvFacts) for (const [key, tvKey] of [["revenueGrowthPct", "revenueGrowthPct"], ["grossMarginPct", "grossMarginPct"], ["operatingMarginPct", "operatingMarginPct"], ["fcfMarginPct", "fcfMarginPct"]]) {
      if (!isNum(rec[key]) && isNum(tvFacts[tvKey])) { rec[key] = tvFacts[tvKey]; rec.filledFrom[key] = "TradingView"; }
    }
    if (rec.fcfPositive === null && tvFacts?.fcfPositive !== null && tvFacts?.fcfPositive !== undefined) { rec.fcfPositive = tvFacts.fcfPositive; rec.filledFrom.fcfPositive = "TradingView"; }
    if (!isNum(rec.runwayCashPlusStiYears) && isNum(tvFacts?.runwayYears)) { rec.runwayCashPlusStiYears = tvFacts.runwayYears; rec.filledFrom.runway = "TradingView"; rec.runwayStatus = rec.runwayStatus || "estimate"; }
    for (const key of ["grossMarginPct", "operatingMarginPct"]) if (!isNum(rec[key]) && isNum(rec.valuation?.[key])) { rec[key] = rec.valuation[key]; rec.filledFrom[key] = "Yahoo"; }
    rec.annual = f?.annual || [];
    rec.balanceSheetConcepts = f?.balanceSheetConcepts || null;
    rec.estimates = m?.estimates ?? null;
    rec.grossProfitTtm = f?.grossProfitTtm ?? null;
    rec.assetsLatest = f?.assetsLatest ?? null;
    rec.investment = f?.investment ?? null;
    rec.dilution3yPct = f?.dilution3yPct ?? null;
    rec.netIncomeTtm = f?.netIncomeTtm ?? null;
    rec.surprises = m?.surprises ?? null;
    // Gross margin from revenue − cost of revenue when the filer does not tag gross profit.
    if (!isNum(rec.grossMarginPct) && isNum(f?.grossProfitTtm) && isNum(rec.revenueTtm) && rec.revenueTtm > 0 && f?.grossProfitBasis === "revenue − cost of revenue") {
      rec.grossMarginPct = round((f.grossProfitTtm / rec.revenueTtm) * 100); rec.filledFrom.grossMarginPct = "SEC revenue − cost of revenue";
    }
    // No filed short-term-investment line: Yahoo's latest-quarter total cash minus filed cash, same currency, labelled.
    const yv = rec.valuation;
    // Not for banks, brokers and asset managers (TradingView sector "Finance"): their cash is client and balance-sheet funding.
    const financial = tvRow?.sector === "Finance" || rec.valuation?.sector === "Financial Services" || rec.industries.some((i) => i.id === "fintech-digital-assets");
    if (!financial && rec.shortTermInvestments === null && isNum(rec.cashOnly) && isNum(yv?.totalCash) && yv.financialCurrency && yv.financialCurrency === rec.statementCurrency && yv.totalCash > rec.cashOnly * 1.05) {
      rec.shortTermInvestments = yv.totalCash - rec.cashOnly;
      rec.cashPlusSti = yv.totalCash;
      rec.filledFrom.shortTermInvestments = "Yahoo totalCash − filed cash";
      if (isNum(rec.fcfTtm) && rec.fcfTtm < 0) rec.runwayCashPlusStiYears = round(rec.cashPlusSti / -rec.fcfTtm);
    }
    rec.quarters = f?.quarters || [];
    if (!isNum(rec.priceToSales) && isNum(tvFacts?.psRatio)) { rec.priceToSales = tvFacts.psRatio; rec.filledFrom.priceToSales = "TradingView"; }
    if (!isNum(rec.psToGrowth) && isNum(rec.priceToSales) && isNum(rec.revenueGrowthPct) && rec.revenueGrowthPct > 0) rec.psToGrowth = round(rec.priceToSales / rec.revenueGrowthPct, 2);
    if (!rec.nextEarnings && tvFacts?.nextEarnings && Date.parse(tvFacts.nextEarnings) >= now.getTime() - DAY) {
      rec.nextEarnings = tvFacts.nextEarnings; rec.daysToEarnings = Math.round((Date.parse(rec.nextEarnings) - now.getTime()) / DAY); rec.filledFrom.nextEarnings = "TradingView";
    }
    rec.quant = quantBlock(rec);
    if (tvFacts) for (const [key, tvKey] of [["roePct", "roePct"], ["debtToEquity", "debtToEquityPct"], ["currentRatio", "currentRatio"], ["beta", "beta"], ["fcfYieldPct", "fcfYieldPct"], ["grossProfitabilityPct", "grossProfitabilityPct"]]) {
      // TradingView reports 0 FCF yield for negative FCF: not a yield, so not filled.
      if (key === "fcfYieldPct" && !(tvFacts[tvKey] > 0)) continue;
      if (!isNum(rec.quant[key]) && isNum(tvFacts[tvKey])) { rec.quant[key] = tvFacts[tvKey]; rec.filledFrom[key] = "TradingView"; }
    }
    if (tvFacts && !isNum(rec.valuation?.trailingPE) && isNum(tvFacts.peTtm)) { rec.valuation = { ...(rec.valuation || {}), trailingPE: tvFacts.peTtm }; rec.filledFrom.trailingPE = "TradingView"; }
    rec.tenBagger = m?.tenBagger ?? null;
    rec.filings = (f?.filings || []).slice(0, 12);
    rec.postPeriodRaises = m?.postPeriodRaises || [];
    rec.tvCheck = periodAlignedCheck(rec, tvFacts0, screen?.fetchedAt);
    rec.data = {
      financials: f ? (f.status || (/SEC|DART/.test(f.source || "") ? "filed" : "provider snapshot")) : r ? "provider snapshot" : "no data",
      source: f?.source || (r ? "TradingView screener" : null),
      sourceUrl: f?.sourceUrl || (r ? "https://www.tradingview.com/screener/" : null),
      periodEnd: f?.revenueEnd || null,
      disclosedAt: (f?.filings || []).find((x) => /^(10-K|10-Q|20-F|40-F)/.test(x.form) && (!f.revenueEnd || x.reportDate === f.revenueEnd))?.date || null,
      lastSuccess: metrics?.generatedAt && !(m?.stale?.fundamentals) ? metrics.generatedAt : m?.lastSuccess || null,
      staleFundamentals: Boolean(m?.stale?.fundamentals),
      stalePrices: Boolean(m?.stale?.prices),
    };
    rec.newlyAdded = recentAdds.has(rec.id) ? recentAdds.get(rec.id) : (previousCompanies && !prevIds.has(rec.id) && rec.coverage !== "screen" ? now.toISOString().slice(0, 10) : null);
  }
  const all = [...out.values()];
  industryRanks(all);
  return all;
}

/**
 * Where each company sits among peers of its first industry on each indicator:
 * percentile 0–100 oriented so higher is better (lower P/S and forward P/E rank
 * higher). Needs at least five peers with a value; otherwise no rank.
 */
export const RANK_KEYS = {
  revenueGrowthPct: [(c) => c.revenueGrowthPct, 1], revenueCagr3yPct: [(c) => c.quant?.revenueCagr3yPct, 1],
  revenueAccelPts: [(c) => c.quant?.revenueAccelPts, 1], grossMarginPct: [(c) => c.grossMarginPct, 1],
  ruleOf40: [(c) => c.quant?.ruleOf40, 1], fcfYieldPct: [(c) => c.quant?.fcfYieldPct, 1],
  netCashToMcapPct: [(c) => c.quant?.netCashToMcapPct, 1], roePct: [(c) => c.quant?.roePct, 1],
  priceToSales: [(c) => c.priceToSales, -1], forwardPE: [(c) => c.valuation?.forwardPE, -1],
  grossProfitabilityPct: [(c) => c.quant?.grossProfitabilityPct, 1], investmentGapPts: [(c) => c.quant?.investmentGapPts, -1],
  revenueGrowthFy1Pct: [(c) => c.quant?.revenueGrowthFy1Pct, 1], epsRevision90dPct: [(c) => c.quant?.epsRevision90dPct, 1],
  dilution3yPct: [(c) => c.quant?.dilution3yPct, -1],
  accrualsPct: [(c) => c.quant?.accrualsPct, -1], epsSurpriseMeanPct: [(c) => c.quant?.epsSurpriseMeanPct, 1],
};
export function industryRanks(companies) {
  const groups = new Map();
  for (const c of companies) { const id = c.industries?.[0]?.id; if (id) (groups.get(id) || groups.set(id, []).get(id)).push(c); }
  for (const c of companies) c.ranks = null;
  for (const [id, peers] of groups) {
    for (const [key, [get, dir]] of Object.entries(RANK_KEYS)) {
      const vals = peers.map((c) => [c, get(c)]).filter(([, v]) => isNum(v));
      if (vals.length < 5) continue;
      for (const [c, v] of vals) {
        const beaten = vals.filter(([, w]) => (dir > 0 ? w < v : w > v)).length;
        const ties = vals.filter(([, w]) => w === v).length - 1;
        (c.ranks ||= { industry: id })[key] = { pct: Math.round(((beaten + ties / 2) / (vals.length - 1)) * 100), n: vals.length };
      }
    }
  }
}

export const slugify = (name) => String(name).toLowerCase().normalize("NFKD").replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-|-$/g, "");

export function buildStartups({ universe, companies }) {
  const byTicker = new Map(companies.map((c) => [c.ticker, c]));
  const list = [];
  for (const s of universe.sectors || []) {
    for (const st of s.startups || []) {
      const relationships = (st.holders || []).map((h) => {
        const tickers = String(h.holderTicker || "").split("/").map((x) => normalize(x.trim())).filter((x) => x.includes(":"));
        const listed = tickers.map((t) => byTicker.get(t)).filter(Boolean);
        const rel = relationship(h, st);
        const capUsd = listed[0]?.marketCapUsd ?? null;
        const exposure = isNum(rel.pctOwned) && isNum(st.valuationUsd) && isNum(capUsd) && capUsd > 0
          ? { pctOfHolderCap: round((rel.pctOwned / 100) * st.valuationUsd / capUsd * 100, 2), estimate: true, basis: `지분율 × 최근 비상장 기업가치(${st.valuationDate || "날짜 없음"}) ÷ 보유사 시가총액` } : null;
        return { holder: h.holder, listedIds: listed.map((c) => c.id), tickers, ...rel, exposure };
      });
      list.push({
        id: slugify(st.name), name: st.name, industry: s.id, industryName: s.name, country: st.country || null,
        what: st.what || null,
        entityType: st.entityType || (st.status === "listed" ? "listed" : st.status === "acquired" ? "acquired" : "startup"),
        stage: st.stage || null, milestones: st.milestones || [],
        financing: [...(st.rounds || []), ...(isNum(st.valuationUsd) ? [{ date: st.valuationDate || null, valuationUsd: st.valuationUsd, url: st.valuationUrl || null, label: "최근 기업가치" }] : [])],
        totalRaisedUsd: isNum(st.totalRaisedUsd) ? st.totalRaisedUsd : null,
        listedTicker: st.listedTicker || null,
        relationships,
        current: relationships.filter((r) => r.status !== "historical"),
        disclosedCount: relationships.filter((r) => isNum(r.pctOwned)).length,
      });
    }
  }
  return list;
}

function median(values) {
  const v = values.filter(isNum).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return round(v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2);
}

/** Last two quarters' FCF vs the two before: is the burn shrinking or growing? */
export function burnTrend(quarters = []) {
  const q = quarters.filter((x) => isNum(x.fcf)).slice(-4);
  if (q.length < 4) return null;
  const recent = (q[2].fcf + q[3].fcf) / 2, prior = (q[0].fcf + q[1].fcf) / 2;
  if (recent >= 0 && prior >= 0) return { state: "positive", recent, prior };
  return { state: recent > prior ? "improving" : recent < prior ? "worsening" : "flat", recent, prior, quarters: q.map((x) => x.end) };
}

/** Historical 10x frequency for an industry: cohort cells of its TradingView industries, all start sizes and small caps. */
export function industryTenX(cohort, tvIndustries) {
  if (!cohort?.cells || !tvIndustries?.length) return null;
  const sum = { n: 0, hits: 0, halved: 0 }, small = { n: 0, hits: 0, halved: 0 };
  for (const [key, c] of Object.entries(cohort.cells)) {
    if (!key.startsWith("ind·size|")) continue;
    const [, ind, size] = key.split("|");
    if (!tvIndustries.includes(ind)) continue;
    for (const k of ["n", "hits", "halved"]) sum[k] += c[k];
    if (size === "<$0.3B" || size === "$0.3–1B") for (const k of ["n", "hits", "halved"]) small[k] += c[k];
  }
  if (!sum.n) return null;
  const base = cohort.base?.n ? cohort.base.hits / cohort.base.n : null;
  const rate = (x) => (x.n ? round((x.hits / x.n) * 100, 2) : null);
  return { ...sum, ratePct: rate(sum), halvedPct: round((sum.halved / sum.n) * 100, 1), lift: base ? round(sum.hits / sum.n / base, 2) : null,
    small: { ...small, ratePct: rate(small), lift: base && small.n ? round(small.hits / small.n / base, 2) : null },
    basePct: base ? round(base * 100, 2) : null, industries: tvIndustries };
}

/** Median of each quant indicator across an industry's tracked listed companies, with the count used. */
export function industryMedians(members) {
  const pick = {
    forwardPE: (c) => c.valuation?.forwardPE, priceToSales: (c) => c.priceToSales, revenueGrowthPct: (c) => c.revenueGrowthPct,
    revenueCagr3yPct: (c) => c.quant?.revenueCagr3yPct, grossMarginPct: (c) => c.grossMarginPct, ruleOf40: (c) => c.quant?.ruleOf40,
    fcfYieldPct: (c) => c.quant?.fcfYieldPct, netCashToMcapPct: (c) => c.quant?.netCashToMcapPct, roePct: (c) => c.quant?.roePct,
    targetUpsidePct: (c) => c.quant?.targetUpsidePct,
  };
  const out = {};
  for (const [k, f] of Object.entries(pick)) { const vals = members.map(f).filter(isNum); out[k] = { median: median(vals), n: vals.length }; }
  return out;
}

export function buildIndustries({ universe, companies, startups, screen, metricsAt, cohort = null }) {
  const sectorIndustries = { ...(screen?.sectorIndustries || {}),
    cybersecurity: ["Packaged Software", "Information Technology Services", "Internet Software/Services"],
    "energy-storage": ["Electrical Products", "Industrial Specialties", "Chemicals: Specialty"],
    "obesity-metabolic": ["Pharmaceuticals: Major", "Pharmaceuticals: Other", "Biotechnology"],
    "fintech-digital-assets": ["Investment Banks/Brokers", "Finance/Rental/Leasing", "Data Processing Services", "Miscellaneous Commercial Services"],
    "autonomy-mobility": ["Motor Vehicles", "Auto Parts: OEM", "Electronic Equipment/Instruments", "Aerospace & Defense"],
    "medtech-ai-diagnostics": ["Medical Specialties", "Medical/Nursing Services", "Services to the Health Industry"],
    "power-grid": ["Electrical Products", "Engineering & Construction", "Industrial Machinery"],
    "gene-cell-therapy": ["Biotechnology", "Pharmaceuticals: Other"],
    "satcom-6g": ["Telecommunications Equipment", "Specialty Telecommunications", "Electronic Components"],
    "critical-minerals": ["Other Metals/Minerals", "Chemicals: Specialty", "Precious Metals"],
    "drones-counter-uas": ["Aerospace & Defense", "Electronic Equipment/Instruments"],
    "datacenter-power-cooling": ["Industrial Machinery", "Electrical Products", "Building Products"],
    "edge-ai-devices": ["Semiconductors", "Electronic Components", "Computer Peripherals"],
    "advanced-packaging-materials": ["Electronic Production Equipment", "Semiconductors", "Chemicals: Specialty"],
    "water-infrastructure": ["Water Utilities", "Industrial Machinery", "Environmental Services"],
    "k-beauty-consumer-export": ["Household/Personal Care", "Apparel/Footwear", "Pharmaceuticals: Other"],
    "silicon-photonics-optical": ["Telecommunications Equipment", "Semiconductors", "Electronic Components"],
    "hydrogen-fuel-cells": ["Electrical Products", "Chemicals: Specialty", "Chemicals: Major Diversified"] };
  return (universe.sectors || []).map((s) => {
    const members = companies.filter((c) => c.industries.some((i) => i.id === s.id));
    const withFin = members.filter((c) => c.data.financials !== "no data" && c.data.financials !== "provider snapshot" || isNum(c.revenueTtm));
    const forecasts = (s.growth || []).map((g) => ({
      institution: g.institution, metric: g.metric, definition: g.definition || null, baseValue: g.baseValue || null, baseYear: g.baseYear ?? null,
      targetValue: g.targetValue || null, targetYear: g.targetYear ?? null, cagrPct: isNum(g.cagrPct) ? g.cagrPct : null, url: g.url || null,
      publishedAt: g.publishedAt || null, check: g.check || "cited",
    }));
    const cagrs = forecasts.map((f) => f.cagrPct).filter(isNum);
    const tvIndustries = new Set(sectorIndustries[s.id] || []);
    const tvMap = (screen?.industryMap || []).filter((i) => tvIndustries.has(i.industry));
    const chain = {};
    for (const c of members) {
      const layer = c.industries.find((i) => i.id === s.id)?.chainLayer || "unassigned";
      (chain[layer] ||= []).push(c.id);
    }
    return {
      id: s.id, name: s.name, summary: s.summary || null,
      forecasts,
      forecastCagrRange: cagrs.length ? [Math.min(...cagrs), Math.max(...cagrs)] : null,
      forecastPeriods: [...new Set(forecasts.filter((f) => f.baseYear && f.targetYear).map((f) => `${f.baseYear}→${f.targetYear}`))],
      observed: {
        medianRevenueGrowthPct: median(members.map((c) => c.revenueGrowthPct)),
        companies: members.filter((c) => isNum(c.revenueGrowthPct)).length,
        basis: "추적 상장사의 최근 매출 성장률 중앙값(회계연도 또는 누적 기준, 기업별 기준일 상이)",
        tvIndustries: tvMap.map(({ industry, industryKo, companies, medianGrowthPct }) => ({ industry, industryKo, companies, medianGrowthPct })),
      },
      counts: { us: members.filter((c) => c.market === "US").length, kr: members.filter((c) => c.market === "KR").length, other: members.filter((c) => c.market === "OTHER").length, startups: startups.filter((x) => x.industry === s.id).length },
      historicalTenX: industryTenX(cohort, sectorIndustries[s.id] || []),
      medians: industryMedians(members),
      fcfPositiveShare: members.filter((c) => c.fcfPositive !== null).length ? round(members.filter((c) => c.fcfPositive === true).length / members.filter((c) => c.fcfPositive !== null).length * 100) : null,
      coverage: { withFinancials: withFin.length, total: members.length },
      researchDate: s.asOf || universe.asOf || null,
      dataDate: metricsAt || null,
      chain,
    };
  });
}

export function buildHistory({ universe, metrics, cohort }) {
  const byTicker = new Map((metrics?.companies || []).map((m) => [m.ticker, m]));
  const cases = (universe.history?.cases || []).map((c) => {
    const m = byTicker.get(c.ticker);
    const ep = m?.tenBagger?.achieved ? m.tenBagger : null;
    const window = ep && m?.series ? m.series.filter((p) => p.date >= ep.fromDate && p.date <= ep.toDate) : [];
    const startYear = ep ? Number(ep.fromDate.slice(0, 4)) : Number(c.startYear) || null;
    const annual = m?.fundamentals?.annual || [];
    const atStart = startYear ? [...annual].reverse().find((a) => Number(a.end.slice(0, 4)) <= startYear) : null;
    const before = atStart ? annual.filter((a) => a.end < atStart.end).at(-1) : null;
    return {
      id: companyId(c.ticker), ticker: c.ticker, name: c.name, kind: "hindsight",
      research: { startYear: c.startYear ?? null, tenXYear: c.tenXYear ?? null, multiple: c.multipleAchieved || null, preconditions: c.preconditions || null, catalysts: c.catalysts || null, url: c.url || null },
      priceEpisode: ep ? { startMonth: ep.fromDate.slice(0, 7), tenXMonth: ep.toDate.slice(0, 7), months: ep.months, drawdownBeforeTenXPct: maxDrawdownPct(window) } : null,
      financialsAtStart: atStart ? { fiscalYearEnd: atStart.end, revenue: atStart.revenue, fcf: atStart.fcf, revenueGrowthPct: before?.revenue > 0 ? round((atStart.revenue / before.revenue - 1) * 100) : null, currency: m?.fundamentals?.currency || null, source: "SEC EDGAR companyfacts" } : null,
      financialsNote: atStart ? null : "시작 시점 재무 미수집(SEC 연간 재무가 없는 종목)",
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    hindsight: cases,
    cohort: cohort ? {
      generatedAt: cohort.generatedAt, method: cohort.method, population: cohort.population, base: cohort.base,
      sizeBuckets: cohort.sizeBuckets, offBuckets: cohort.offBuckets, cells: cohort.cells, profiles: cohort.profiles,
      examples: cohort.examples, graduates: cohort.graduates,
      note: "과거 표본의 빈도이며 미래 10배 확률이 아닙니다. 상장폐지 종목이 빠져 있어 성공률이 높게 나옵니다.",
    } : null,
  };
}

export function updateChangelog(previous, companies, date) {
  const tracked = companies.filter((c) => c.coverage !== "screen").map((c) => c.id).sort();
  const before = previous?.tracked || null;
  const entries = [...(previous?.entries || [])];
  if (before) {
    const prevSet = new Set(before), nowSet = new Set(tracked);
    const added = tracked.filter((id) => !prevSet.has(id));
    const removed = before.filter((id) => !nowSet.has(id));
    if (added.length || removed.length) entries.unshift({ date, added, removed });
  }
  const cutoff = new Date(Date.parse(date) - 90 * DAY).toISOString().slice(0, 10);
  return { tracked, entries: entries.filter((e) => e.date >= cutoff).slice(0, 60) };
}

export function sourceStatus(previous, now, observations) {
  const out = { ...(previous?.sources || {}) };
  for (const [name, o] of Object.entries(observations)) {
    const prev = out[name] || {};
    if (o.ok === null) continue; // not attempted this run
    out[name] = o.ok
      ? { lastAttempt: now, lastSuccess: o.at || now, ok: true, staleSince: null, error: null, detail: o.detail || null }
      : { lastAttempt: now, lastSuccess: prev.lastSuccess || null, ok: false, staleSince: prev.staleSince || prev.lastSuccess || now, error: o.error || "failed", detail: o.detail || null };
  }
  return { generatedAt: now, sources: out };
}

async function fetchFx(previous) {
  try {
    const response = await fetch("https://fred.stlouisfed.org/graph/fredgraph.csv?id=DEXKOUS", { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rows = (await response.text()).trim().split(/\r?\n/).slice(1).map((l) => l.split(",")).filter(([, v]) => v && v !== "." && Number.isFinite(Number(v)));
    const [date, value] = rows.at(-1);
    return { ok: true, fx: { pair: "KRW per USD", rate: Number(value), date, source: "FRED DEXKOUS (Board of Governors, noon buying rate)", sourceUrl: "https://fred.stlouisfed.org/series/DEXKOUS" } };
  } catch (error) {
    return { ok: false, error: error.message, fx: previous || null };
  }
}

const DIGEST_PRESETS = ["cash-growers", "pullback", "funding-risk"];

/**
 * What changed for an investor since the previous run: companies entering or
 * leaving each preset, new offering filings, large price moves, companies
 * added to coverage, and startup status changes. Every item points at data
 * already in companies.json / startups.json.
 */
export function buildDigest({ previous, companies, prevStartups, startups, fx, now }) {
  const prevById = new Map((previous?.companies || []).map((c) => [c.id, c]));
  const conv = (v, cur) => (!isNum(v) ? null : cur === "USD" ? v : cur === "KRW" && fx?.rate ? v / fx.rate : null);
  const usd = (c) => ({ ...c, _liqUsd: conv(c.avgTradedValue20d, c.currency), _revUsd: conv(c.revenueTtm, c.statementCurrency) });
  const ids = (list, key) => new Set(applyFilters(list.map(usd), PRESETS[key].params).map((c) => c.id));
  const presets = DIGEST_PRESETS.map((key) => {
    const nowSet = ids(companies, key);
    const before = previous ? ids(previous.companies || [], key) : null;
    return {
      key, label: PRESETS[key].label, rule: PRESETS[key].text, count: nowSet.size, prevCount: before ? before.size : null,
      entered: before ? [...nowSet].filter((id) => !before.has(id)) : [],
      left: before ? [...before].filter((id) => !nowSet.has(id)) : [],
    };
  });
  const since = previous?.generatedAt?.slice(0, 10) || null;
  // New offering filings: present now and absent from the previous run's list for the same company.
  const raises = previous ? companies.flatMap((c) => {
    const prevFilings = prevById.get(c.id)?.filings;
    if (!Array.isArray(prevFilings)) return []; // no baseline for this company yet
    const seen = new Set(prevFilings.map((f) => f.url));
    const floor = since ? new Date(Date.parse(since) - 7 * DAY).toISOString().slice(0, 10) : "";
    return (c.filings || []).filter((f) => f.capitalRaise && !seen.has(f.url) && f.date >= floor).map((f) => ({ id: c.id, name: c.name, form: f.form, date: f.date, url: f.url }));
  }) : [];
  const moves = companies.map((c) => {
    const p = prevById.get(c.id);
    if (!p || !isNum(p.price) || !isNum(c.price) || p.price <= 0 || p.currency !== c.currency) return null;
    const change = (c.price / p.price - 1) * 100;
    return Math.abs(change) >= 15 ? { id: c.id, name: c.name, changePct: round(change), from: p.price, to: c.price, currency: c.currency } : null;
  }).filter(Boolean).sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, 20);
  const prevSt = new Map((prevStartups?.startups || []).map((s) => [s.id, s]));
  const startupChanges = prevStartups ? startups.filter((s) => prevSt.get(s.id) && prevSt.get(s.id).entityType !== s.entityType)
    .map((s) => ({ id: s.id, name: s.name, from: prevSt.get(s.id).entityType, to: s.entityType })) : [];
  const added = previous ? companies.filter((c) => !prevById.has(c.id) && c.coverage !== "screen").map((c) => ({ id: c.id, name: c.name })) : [];
  // Names for every id the digest mentions, including companies no longer in coverage.
  const names = {};
  for (const p of presets) for (const id of [...p.entered, ...p.left]) names[id] = companies.find((c) => c.id === id)?.name || prevById.get(id)?.name || id;
  return { generatedAt: now, since, presets, raises, moves, startupChanges, added, names,
    note: "직전 데이터 갱신 대비 변화. 프리셋 진입·이탈은 조건 충족 여부의 변화일 뿐 매수·매도 신호가 아닙니다." };
}

/** Small artifact for the landing page (assets/js/tenbagger-radar.js). */
export function buildLanding({ industries, companies, digest, fx, metricsAt }) {
  const byId = new Map(companies.map((c) => [c.id, c]));
  const brief = (id) => { const c = byId.get(id); return c ? { id, name: c.name, ticker: c.ticker, revenueGrowthPct: c.revenueGrowthPct, fcfPositive: c.fcfPositive, runwayYears: c.runwayCashPlusStiYears, marketCapUsd: c.marketCapUsd } : null; };
  const ranked = industries.filter((i) => isNum(i.observed.medianRevenueGrowthPct)).sort((a, b) => b.observed.medianRevenueGrowthPct - a.observed.medianRevenueGrowthPct);
  return {
    schemaVersion: "2.0", generatedAt: digest.generatedAt, dataDate: metricsAt || null, fx: fx || null,
    industries: ranked.slice(0, 6).map((i) => ({ id: i.id, name: i.name, observed: i.observed.medianRevenueGrowthPct, observedN: i.observed.companies, forecast: i.forecastCagrRange, periods: i.forecastPeriods })),
    presets: digest.presets.map((p) => ({ key: p.key, label: p.label, rule: p.rule, count: p.count,
      entered: p.entered.map(brief).filter(Boolean).slice(0, 5), top: companies.filter((c) => p.entered.includes(c.id)).length ? [] : [] })),
    raises: digest.raises.slice(0, 5), moves: digest.moves.slice(0, 5), added: digest.added.slice(0, 8), startupChanges: digest.startupChanges,
    counts: { companies: companies.filter((c) => c.coverage !== "screen").length, us: companies.filter((c) => c.market === "US" && c.coverage !== "screen").length, kr: companies.filter((c) => c.market === "KR" && c.coverage !== "screen").length },
  };
}

const readJson = async (name) => { try { return JSON.parse(await readFile(P(name), "utf8")); } catch { return null; } };
const writeJson = async (name, value) => { await writeFile(`${P(name)}.tmp`, `${JSON.stringify(value)}\n`); await rename(`${P(name)}.tmp`, P(name)); };

async function main() {
  const now = new Date();
  const iso = now.toISOString();
  const [universe, metrics, screen, cohort, prevCompanies, prevChangelog, prevStatus, prevFx, yf, tv, dart, prevStartups] = await Promise.all(
    ["universe.json", "metrics.json", "screen.json", "cohort.json", "companies.json", "changelog.json", "status.json", "fx.json", "yf-cache.json", "tv-cache.json", "dart-cache.json", "startups.json"].map(readJson));
  if (!universe) throw new Error("universe.json missing");
  // Research additions: confirm each listing before it is published.
  const tvByTicker = new Map((tv?.rows || []).map((r) => [r.ticker, r]));
  const metricsByTicker = new Map((metrics?.companies || []).map((m) => [m.ticker, m]));
  const scanAvailable = (tv?.rows || []).length > 500;
  const verification = {};
  for (const s of universe.sectors || []) for (const c of s.publicCompanies || []) {
    if (c.verification !== "pending") continue;
    const result = verifyListing(c, tvByTicker.get(tvTicker(c.ticker)), metricsByTicker.get(c.ticker)?.secCik, scanAvailable);
    verification[c.ticker] = result === null ? prevStatus?.verification?.[c.ticker] ?? null : { ok: result, checkedAt: iso.slice(0, 10), sector: s.id, name: c.name };
  }
  const verified = new Set(Object.entries(verification).filter(([, v]) => v?.ok).map(([t]) => t));
  const changelog = updateChangelog(prevChangelog, buildCompanies({ universe, metrics, screen, verified }), iso.slice(0, 10));
  const companies = buildCompanies({ universe, metrics, screen, previousCompanies: prevCompanies, changelog, now, verified, tvRows: tvByTicker });
  const startups = buildStartups({ universe, companies });
  const industries = buildIndustries({ universe, companies, startups, screen, metricsAt: metrics?.generatedAt, cohort });
  const history = buildHistory({ universe, metrics, cohort });
  // FX comes from scripts/tenbagger-fx.mjs (run earlier in the workflow).
  const fx = prevFx?.rate ? { ok: !(prevFx.failed || []).length, fx: prevFx, error: (prevFx.failed || [])[0] } : { ok: false, fx: null, error: "fx.json missing" };
  const status = sourceStatus(prevStatus, iso, {
    sec: { ok: metrics ? !(metrics.errors || []).some((e) => /SEC ticker map/.test(e)) : null, at: metrics?.generatedAt, error: (metrics?.errors || []).find((e) => /SEC/.test(e)) },
    yahoo: { ok: yf ? Object.keys(yf.tickers || {}).length > 0 : null, at: yf?.generatedAt, detail: yf ? `${Object.keys(yf.tickers || {}).length} tickers` : null, error: yf?.errors?.[0] },
    tradingview: { ok: tv ? (tv.rows || []).length > 500 : null, at: tv?.fetchedAt, detail: tv ? `${(tv.rows || []).length} rows` : null, error: tv?.errors?.[0] },
    dart: { ok: dart ? Object.keys(dart.tickers || {}).length > 0 : null, at: dart?.generatedAt, error: dart?.errors?.[0] },
    fred: { ok: fx.ok, error: fx.error },
    cohort: { ok: cohort ? true : null, at: cohort?.generatedAt },
  });
  status.verification = verification;
  const digest = buildDigest({ previous: prevCompanies, companies, prevStartups, startups, fx: fx.fx, now: iso });
  await writeJson("digest.json", digest);
  await writeJson("landing-client.json", buildLanding({ industries, companies, digest, fx: fx.fx, metricsAt: metrics?.generatedAt }));
  await writeJson("companies.json", { schemaVersion: "1.0", generatedAt: iso, metricsAt: metrics?.generatedAt || null, screenAt: screen?.fetchedAt || null, fx: fx.fx || null, companies });
  await writeJson("industries.json", { schemaVersion: "1.0", generatedAt: iso, industries });
  await writeJson("startups.json", { schemaVersion: "1.0", generatedAt: iso, startups });
  await writeJson("history.json", history);
  await writeJson("changelog.json", changelog);
  await writeJson("status.json", status);
  console.log(JSON.stringify({ tenbaggerBuild: "written", companies: companies.length, industries: industries.length, startups: startups.length, hindsight: history.hindsight.length, cohort: Boolean(history.cohort), fx: fx.ok }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
export { rowFacts, tvTicker };
