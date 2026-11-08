/**
 * Ten-bagger research tracker: refreshes the numbers behind data/tenbagger/universe.json.
 *
 * The universe (sectors, growth estimates, listed companies, startups and the
 * listed holders of their equity) is curated with a source URL on every figure.
 * This script refreshes what can be refreshed from free, no-login sources:
 *   - SEC EDGAR companyfacts (US filers): revenue, operating cash flow, capex,
 *     free cash flow, cash + short-term investments, shares outstanding.
 *   - Yahoo Finance chart (all listings): monthly price history and the last price,
 *     from which market cap, returns and ten-bagger episodes are computed.
 *   - Yahoo fundamentals timeseries (non-SEC listings such as KRX): annual revenue,
 *     free cash flow, cash and market cap, labelled with that source.
 * A figure that cannot be fetched is carried from the previous run and marked
 * stale; nothing is estimated. Runway is only computed for negative FCF.
 */
import { readFile, writeFile, rename } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { crossCheck, setFx, tvTicker } from "./tenbagger-screen.mjs";
import { toUsd } from "./tenbagger-fx.mjs";
let FX_TABLE = null;

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const UNIVERSE = resolve(root, "data/tenbagger/universe.json");
const OUT = resolve(root, "data/tenbagger/metrics.json");
const SEC_UA = "memory-intelligence-dashboard admin@dicacros.dev";
const BROWSER_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const DAY = 864e5;

// ── pure helpers (tested in test-tenbagger.mjs) ─────────────────────────────

/** Yahoo symbol for "EXCHANGE:CODE". */
export function yahooSymbol(ticker = "") {
  const [exchange, code] = String(ticker).includes(":") ? String(ticker).split(":") : ["", String(ticker)];
  const suffix = {
    KRX: ".KS", KOSPI: ".KS", KOSDAQ: ".KQ", TSE: ".T", TYO: ".T", HKEX: ".HK", HKG: ".HK",
    LSE: ".L", ASX: ".AX", TSX: ".TO", TSXV: ".V", EPA: ".PA", AMS: ".AS", EBR: ".BR", ETR: ".DE", FRA: ".F",
    SWX: ".SW", STO: ".ST", OSL: ".OL", TWSE: ".TW", TPE: ".TW", TPEX: ".TWO", SSE: ".SS", SZSE: ".SZ", NSE: ".NS",
  }[String(exchange).toUpperCase()] || "";
  return `${code}${suffix}`;
}

const days = (a, b) => (Date.parse(b) - Date.parse(a)) / DAY;

/**
 * Trailing twelve months from XBRL duration facts. 10-Q cash-flow facts are
 * year-to-date, so TTM = YTD + last fiscal year − the prior year's same YTD.
 * Returns { value, end, basis } or null.
 */
export function trailingTwelveMonths(facts = []) {
  const rows = facts.filter((f) => f.start && f.end && Number.isFinite(Number(f.val)))
    .map((f) => ({ start: f.start, end: f.end, val: Number(f.val), len: days(f.start, f.end) }));
  if (!rows.length) return null;
  const latestEnd = rows.reduce((max, r) => (r.end > max ? r.end : max), "");
  const annual = rows.filter((r) => r.len > 350 && r.len < 380);
  const exact = annual.find((r) => r.end === latestEnd);
  if (exact) return { value: exact.val, end: exact.end, basis: "fiscal-year" };
  const ytd = rows.filter((r) => r.end === latestEnd && r.len < 350).sort((a, b) => b.len - a.len)[0];
  if (ytd) {
    const fy = annual.filter((r) => r.end < latestEnd).sort((a, b) => (a.end < b.end ? 1 : -1))[0];
    const prior = fy && rows.find((r) => Math.abs(r.len - ytd.len) < 10 && Math.abs(days(r.end, ytd.end) - 365) < 20
      && r.start >= fy.start && r.end <= fy.end);
    if (fy && prior) return { value: ytd.val + fy.val - prior.val, end: latestEnd, basis: "ttm" };
  }
  const lastFy = annual.sort((a, b) => (a.end < b.end ? 1 : -1))[0];
  return lastFy ? { value: lastFy.val, end: lastFy.end, basis: "fiscal-year" } : null;
}

/** Growth of the latest fiscal year over the one before, in %. */
export function annualGrowthPct(facts = []) {
  const annual = facts.filter((f) => f.start && f.end && Number.isFinite(Number(f.val)) && days(f.start, f.end) > 350 && days(f.start, f.end) < 380)
    .sort((a, b) => (a.end < b.end ? 1 : -1));
  const [last, prior] = annual;
  if (!last || !prior || Math.abs(days(prior.end, last.end) - 365) > 20 || !(Number(prior.val) > 0)) return null;
  return Number(((Number(last.val) / Number(prior.val) - 1) * 100).toFixed(1));
}

/** Instant value of the first concept that has a fact exactly at `end` (latest filing wins). */
export function instantAt(facts, concepts, end) {
  if (!end) return null;
  for (const concept of concepts) {
    const [taxonomy, name] = concept.split(":");
    const units = facts?.facts?.[taxonomy]?.[name]?.units;
    const rows = (units?.USD || (units && Object.values(units)[0]) || []).filter((f) => f.end === end && !f.start && Number.isFinite(Number(f.val)));
    if (rows.length) return { value: Number(rows.sort((a, b) => String(b.filed || "").localeCompare(String(a.filed || "")))[0].val), concept };
  }
  return null;
}

/**
 * Debt on one balance-sheet date without double counting: long-term debt
 * split into noncurrent + current portion when filed that way, otherwise the
 * total long-term debt, plus short-term borrowings.
 */
export function debtAt(facts, end) {
  return debtBreakdown(facts, end)?.value ?? null;
}

/** debtAt plus the concepts that made it up (shown on the company page as provenance). */
export function debtBreakdown(facts, end) {
  const nonCur = instantAt(facts, ["us-gaap:LongTermDebtNoncurrent"], end);
  const cur = instantAt(facts, ["us-gaap:LongTermDebtCurrent"], end);
  const total = instantAt(facts, ["us-gaap:LongTermDebt"], end);
  const shortB = instantAt(facts, ["us-gaap:ShortTermBorrowings", "us-gaap:CommercialPaper"], end);
  const ifrs = instantAt(facts, ["ifrs-full:NoncurrentPortionOfNoncurrentBorrowings"], end);
  const ifrsCur = instantAt(facts, ["ifrs-full:CurrentBorrowingsAndCurrentPortionOfNoncurrentBorrowings"], end);
  let longTerm = null;
  const parts = [];
  if (nonCur) { longTerm = nonCur.value + (cur?.value || 0); parts.push(nonCur.concept, ...(cur ? [cur.concept] : [])); }
  else if (total) { longTerm = total.value; parts.push(total.concept); }
  else if (ifrs) { longTerm = ifrs.value + (ifrsCur?.value || 0); parts.push(ifrs.concept, ...(ifrsCur ? [ifrsCur.concept] : [])); }
  if (longTerm === null && !shortB) return null;
  if (shortB) parts.push(shortB.concept);
  return { value: (longTerm || 0) + (shortB?.value || 0), parts };
}

/**
 * Short-term investments on the cash date: a dedicated concept first; else the
 * filer's combined "cash, equivalents and short-term investments" minus cash.
 */
export function stiAtDate(facts, end, cashValue) {
  const direct = instantAt(facts, ["us-gaap:ShortTermInvestments", "us-gaap:MarketableSecuritiesCurrent", "us-gaap:AvailableForSaleSecuritiesDebtSecuritiesCurrent", "us-gaap:HeldToMaturitySecuritiesCurrent", "us-gaap:OtherShortTermInvestments", "ifrs-full:CurrentFinancialAssetsAtFairValueThroughProfitOrLoss", "ifrs-full:OtherCurrentFinancialAssets"], end);
  if (direct) return direct;
  const combined = instantAt(facts, ["us-gaap:CashCashEquivalentsAndShortTermInvestments"], end);
  if (combined && Number.isFinite(cashValue) && combined.value > cashValue) return { value: combined.value - cashValue, concept: `${combined.concept} − cash` };
  return null;
}

/** Latest instant value (balance-sheet items). */
export function latestInstant(facts = []) {
  const rows = facts.filter((f) => f.end && !f.start && Number.isFinite(Number(f.val)));
  if (!rows.length) return null;
  const last = rows.reduce((a, b) => (b.end > a.end ? b : a));
  return { value: Number(last.val), end: last.end };
}

/** Years of cash at the current burn; null when FCF is not negative. */
export function runwayYears(cash, fcf) {
  if (!Number.isFinite(cash) || !Number.isFinite(fcf) || fcf >= 0) return null;
  return Number((cash / -fcf).toFixed(1));
}

/**
 * Ten-bagger episodes in a monthly close series [{date, close}]: the first
 * month whose close is >= 10x the lowest close of the previous `windowMonths`.
 */
export function tenBaggerEpisode(series = [], { windowMonths = 84 } = {}) {
  const points = series.filter((p) => Number.isFinite(p.close) && p.close > 0);
  let best = null;
  for (let i = 1; i < points.length; i += 1) {
    let low = null;
    for (let j = Math.max(0, i - windowMonths); j < i; j += 1) if (!low || points[j].close < low.close) low = points[j];
    if (!low) continue;
    const multiple = points[i].close / low.close;
    if (multiple >= 10) {
      return { achieved: true, fromDate: low.date, toDate: points[i].date, months: Math.round(days(low.date, points[i].date) / 30.44), multiple: Number(multiple.toFixed(1)) };
    }
    if (!best || multiple > best.multiple) best = { achieved: false, fromDate: low.date, toDate: points[i].date, multiple: Number(multiple.toFixed(1)) };
  }
  return best;
}

export function trailingReturn(series = [], months) {
  const points = series.filter((p) => Number.isFinite(p.close) && p.close > 0);
  if (points.length <= months) return null;
  const last = points.at(-1).close;
  const base = points.at(-1 - months).close;
  return Number(((last / base - 1) * 100).toFixed(1));
}

// ── fetchers ────────────────────────────────────────────────────────────────

// SEC asks for at most 10 requests a second; space them and back off on 429/403/5xx.
let secNext = 0;
async function secSlot() {
  const wait = Math.max(0, secNext - Date.now());
  secNext = Math.max(Date.now(), secNext) + 150;
  if (wait) await new Promise((r) => setTimeout(r, wait));
}

async function getJson(url, headers = {}, attempts = 3) {
  let lastError;
  const sec = /sec\.gov/.test(url);
  const tries = sec ? 6 : attempts;
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    try {
      if (sec) await secSlot();
      const response = await fetch(url, { headers: { Accept: "application/json", ...headers }, signal: AbortSignal.timeout(25_000) });
      if (response.status === 404) throw Object.assign(new Error("HTTP 404"), { fatal: true });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (error.fatal) break;
      await new Promise((r) => setTimeout(r, (sec ? 1500 : 800) * 2 ** (attempt - 1)));
    }
  }
  throw lastError;
}

// Filers switch concepts over time (NVIDIA's revenue concept stopped in
// FY2023), so the candidate with the most recent period wins, not the first.
const usd = (facts, ...concepts) => {
  let best = null;
  for (const concept of concepts) {
    const [taxonomy, name] = concept.split(":");
    const units = facts?.facts?.[taxonomy]?.[name]?.units;
    const rows = units?.USD || (units && Object.values(units)[0]);
    if (!rows?.length) continue;
    const latest = rows.reduce((max, r) => (r.end > max ? r.end : max), "");
    if (!best || latest > best.latest) best = { rows, concept, unit: units?.USD ? "USD" : Object.keys(units)[0], latest };
  }
  return best;
};

/**
 * Discrete quarters from XBRL duration facts. 10-Q facts are year-to-date for
 * cash flows (and often for revenue), so each quarter is the difference
 * between consecutive cumulative facts that share a fiscal-year start; a
 * standalone ~90-day fact is used as is. Returns [{end, value}] oldest first.
 */
export function quarterlyValues(facts = []) {
  const latest = new Map();
  for (const f of facts) {
    if (!f.start || !f.end || !Number.isFinite(Number(f.val))) continue;
    const key = `${f.start}|${f.end}`;
    const prev = latest.get(key);
    if (!prev || String(f.filed || "") > String(prev.filed || "")) latest.set(key, f);
  }
  const rows = [...latest.values()].map((f) => ({ start: f.start, end: f.end, val: Number(f.val), len: days(f.start, f.end) }));
  const out = new Map();
  for (const r of rows) if (r.len >= 80 && r.len <= 100) out.set(r.end, r.val);
  const byStart = new Map();
  for (const r of rows) if (r.len > 100 && r.len < 380) { if (!byStart.has(r.start)) byStart.set(r.start, []); byStart.get(r.start).push(r); }
  for (const group of byStart.values()) {
    const cumulative = [...group, ...rows.filter((r) => r.len >= 80 && r.len <= 100 && r.start === group[0].start)].sort((a, b) => (a.end < b.end ? -1 : 1));
    for (let i = 1; i < cumulative.length; i += 1) {
      const gap = days(cumulative[i - 1].end, cumulative[i].end);
      if (gap >= 80 && gap <= 100 && !out.has(cumulative[i].end)) out.set(cumulative[i].end, cumulative[i].val - cumulative[i - 1].val);
    }
  }
  return [...out.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([end, value]) => ({ end, value }));
}

/** Last eight quarters of revenue and FCF (OCF − capex on the same quarter end). */
export function secQuarters(revenueRows, ocfRows, capexRows) {
  const rev = new Map(quarterlyValues(revenueRows || []).map((q) => [q.end, q.value]));
  const ocf = new Map(quarterlyValues(ocfRows || []).map((q) => [q.end, q.value]));
  const cx = new Map(quarterlyValues(capexRows || []).map((q) => [q.end, q.value]));
  const ends = [...new Set([...rev.keys(), ...ocf.keys()])].sort().slice(-8);
  return ends.map((end) => ({ end, revenue: rev.get(end) ?? null, fcf: ocf.has(end) && (cx.has(end) || !capexRows) ? ocf.get(end) - (cx.get(end) || 0) : null }));
}

const RAISE_FORMS = /^(S-1|S-3|F-1|F-3|424B[1-5])(\/A)?$/;
/** Recent SEC filings, newest first, with offering filings flagged. */
export function secFilings(submissions, cik, limit = 15) {
  const r = submissions?.filings?.recent;
  if (!r?.form) return [];
  const out = [];
  for (let i = 0; i < r.form.length && out.length < limit; i += 1) {
    const form = r.form[i];
    if (!/^(10-K|10-Q|8-K|20-F|40-F|6-K|S-1|S-3|F-1|F-3|424B\d|DEF 14A)/.test(form)) continue;
    const acc = String(r.accessionNumber[i] || "").replace(/-/g, "");
    out.push({
      form, date: r.filingDate[i], reportDate: r.reportDate?.[i] || null, description: r.primaryDocDescription?.[i] || null,
      url: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${acc}/${r.primaryDocument[i]}`,
      capitalRaise: RAISE_FORMS.test(form),
    });
  }
  return out;
}

/** Annual values by fiscal-year end (latest filing wins), oldest first. */
export function annualValues(facts = []) {
  const out = new Map();
  for (const f of facts) {
    if (!f.start || !f.end || !Number.isFinite(Number(f.val))) continue;
    const len = days(f.start, f.end);
    if (len < 350 || len > 380) continue;
    const prev = out.get(f.end);
    if (!prev || String(f.filed || "") > String(prev.filed || "")) out.set(f.end, f);
  }
  return [...out.values()].sort((a, b) => (a.end < b.end ? -1 : 1)).map((f) => ({ end: f.end, value: Number(f.val) }));
}

/** Share count change over roughly one year, in % (positive = dilution). */
export function dilutionPct(shareFacts = []) {
  const rows = shareFacts.filter((f) => f.end && Number.isFinite(Number(f.val)) && Number(f.val) > 0).sort((a, b) => (a.end < b.end ? -1 : 1));
  if (rows.length < 2) return null;
  const last = rows.at(-1);
  const prior = [...rows].reverse().find((r) => days(r.end, last.end) >= 330 && days(r.end, last.end) <= 400);
  return prior ? Number(((Number(last.val) / Number(prior.val) - 1) * 100).toFixed(1)) : null;
}

export function secFundamentals(facts) {
  const revenue = usd(facts, "us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax", "us-gaap:Revenues", "us-gaap:SalesRevenueNet", "us-gaap:RevenueFromContractWithCustomerIncludingAssessedTax", "ifrs-full:Revenue");
  const ocf = usd(facts, "us-gaap:NetCashProvidedByUsedInOperatingActivities", "ifrs-full:CashFlowsFromUsedInOperatingActivities");
  const capex = usd(facts, "us-gaap:PaymentsToAcquirePropertyPlantAndEquipment", "us-gaap:PaymentsToAcquireProductiveAssets", "us-gaap:PaymentsToAcquirePropertyPlantAndEquipmentAndIntangibleAssets", "ifrs-full:PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities", "ifrs-full:PurchaseOfPropertyPlantAndEquipment");
  const cash = usd(facts, "us-gaap:CashAndCashEquivalentsAtCarryingValue", "us-gaap:CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents", "ifrs-full:CashAndCashEquivalents");
  const gross = usd(facts, "us-gaap:GrossProfit", "ifrs-full:GrossProfit");
  const opInc = usd(facts, "us-gaap:OperatingIncomeLoss", "ifrs-full:ProfitLossFromOperatingActivities");
  const shares = facts?.facts?.dei?.EntityCommonStockSharesOutstanding?.units?.shares;
  const rev = revenue && trailingTwelveMonths(revenue.rows);
  const op = ocf && trailingTwelveMonths(ocf.rows);
  const cx = capex && trailingTwelveMonths(capex.rows);
  const gp = gross && trailingTwelveMonths(gross.rows);
  const oi = opInc && trailingTwelveMonths(opInc.rows);
  const cashNow = cash && latestInstant(cash.rows);
  // Short-term investments and debt on the cash date only, whichever concept the filer used.
  const stiAt = stiAtDate(facts, cashNow?.end, cashNow?.value);
  const stiNow = stiAt ? { value: stiAt.value, end: cashNow.end } : null;
  const stiSameDate = stiNow ? stiNow.value : 0;
  const debtB = debtBreakdown(facts, cashNow?.end);
  const debtValue = debtB?.value ?? null;
  const sharesNow = shares && latestInstant(shares);
  const fcf = op && cx && op.end === cx.end ? op.value - cx.value : op && !capex ? op.value : null;
  const sameEnd = (x) => x && rev && x.end === rev.end;
  const annualRev = new Map(annualValues(revenue?.rows).map((a) => [a.end, a.value]));
  const annualOcf = new Map(annualValues(ocf?.rows).map((a) => [a.end, a.value]));
  const annualCapex = new Map(annualValues(capex?.rows).map((a) => [a.end, a.value]));
  return {
    currency: revenue?.unit || ocf?.unit || "USD",
    quarters: secQuarters(revenue?.rows, ocf?.rows, capex?.rows),
    annual: [...annualRev.keys()].slice(-15).map((end) => ({ end, revenue: annualRev.get(end), fcf: annualOcf.has(end) ? annualOcf.get(end) - (annualCapex.get(end) || 0) : null })),
    revenueTtm: rev?.value ?? null,
    revenueReported: Boolean(revenue),
    revenueBasis: rev?.basis ?? null,
    revenueEnd: rev?.end ?? null,
    revenueGrowthPct: revenue ? annualGrowthPct(revenue.rows) : null,
    grossMarginPct: sameEnd(gp) && rev.value > 0 ? Number((gp.value / rev.value * 100).toFixed(1)) : null,
    operatingMarginPct: sameEnd(oi) && rev.value > 0 ? Number((oi.value / rev.value * 100).toFixed(1)) : null,
    operatingCashFlowTtm: op?.value ?? null,
    capexTtm: cx?.value ?? null,
    fcfTtm: Number.isFinite(fcf) ? fcf : null,
    fcfEnd: op?.end ?? null,
    cashOnly: cashNow?.value ?? null,
    shortTermInvestments: stiNow ? stiNow.value : null,
    cashAndShortTermInvestments: cashNow ? cashNow.value + stiSameDate : null,
    debt: debtValue,
    balanceSheetConcepts: { cash: cash?.concept || null, sti: stiAt?.concept || null, debt: debtB?.parts || [] },
    cashEnd: cashNow?.end ?? null,
    sharesOutstanding: sharesNow?.value ?? null,
    dilutionPct: shares ? dilutionPct(shares) : null,
  };
}

async function fetchSec(cik) {
  const padded = String(cik).padStart(10, "0");
  const facts = await getJson(`https://data.sec.gov/api/xbrl/companyfacts/CIK${padded}.json`, { "User-Agent": SEC_UA });
  const submissions = await getJson(`https://data.sec.gov/submissions/CIK${padded}.json`, { "User-Agent": SEC_UA }).catch(() => null);
  return { ...secFundamentals(facts), filings: secFilings(submissions, cik), status: "filed", source: "SEC EDGAR companyfacts", sourceUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}` };
}

/** Korean listings move between KOSPI (.KS) and KOSDAQ (.KQ); try the other suffix too. */
export function yahooCandidates(symbol) {
  if (/\.KS$/.test(symbol)) return [symbol, symbol.replace(/\.KS$/, ".KQ")];
  if (/\.KQ$/.test(symbol)) return [symbol, symbol.replace(/\.KQ$/, ".KS")];
  return [symbol];
}

async function fetchYahooMonthlyAny(symbol) {
  let lastError;
  for (const candidate of yahooCandidates(symbol)) {
    try { return { ...(await fetchYahooMonthly(candidate)), symbol: candidate }; } catch (error) { lastError = error; }
  }
  throw lastError;
}

/** SEC's own ticker → CIK map; the researcher's CIK is only a fallback. */
async function fetchSecTickerMap() {
  const json = await getJson("https://www.sec.gov/files/company_tickers.json", { "User-Agent": SEC_UA });
  return new Map(Object.values(json || {}).map((row) => [String(row.ticker).toUpperCase(), String(row.cik_str).padStart(10, "0")]));
}

export function secCikFor(company, tickerMap) {
  const [exchange, code] = String(company.ticker).split(":");
  if (tickerMap && /^(NASDAQ|NYSE|NYSEAMERICAN)$/i.test(exchange || "")) {
    const cik = tickerMap.get(String(code).toUpperCase().replace(".", "-"));
    if (cik) return cik;
    return null; // a US ticker SEC does not know: no fundamentals rather than another company's
  }
  return company.secCik || null;
}

async function fetchYahooMonthly(symbol) {
  let lastError;
  for (const host of ["query2.finance.yahoo.com", "query1.finance.yahoo.com"]) {
    try {
      const json = await getJson(`https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?range=max&interval=1mo&events=splits`, { "User-Agent": BROWSER_UA });
      const r = json?.chart?.result?.[0];
      if (!r) throw new Error("empty chart");
      const closes = r.indicators?.adjclose?.[0]?.adjclose || r.indicators?.quote?.[0]?.close || [];
      const series = (r.timestamp || []).map((t, i) => ({ date: new Date(t * 1000).toISOString().slice(0, 10), close: Number(closes[i]) }))
        .filter((p) => Number.isFinite(p.close) && p.close > 0);
      return { series, price: Number(r.meta?.regularMarketPrice), currency: r.meta?.currency || null, priceTime: r.meta?.regularMarketTime ? new Date(r.meta.regularMarketTime * 1000).toISOString() : null };
    } catch (error) { lastError = error; }
  }
  throw lastError;
}

async function fetchYahooFundamentals(symbol) {
  const types = ["annualTotalRevenue", "annualFreeCashFlow", "annualOperatingCashFlow", "annualCashCashEquivalentsAndShortTermInvestments", "trailingMarketCap"];
  const now = Math.floor(Date.now() / 1000);
  const json = await getJson(`https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}?type=${types.join(",")}&period1=${now - 6 * 365 * 86400}&period2=${now}`, { "User-Agent": BROWSER_UA });
  const latest = (type) => {
    const row = (json?.timeseries?.result || []).find((r) => r.meta?.type?.[0] === type);
    const values = (row?.[type] || []).filter((v) => v?.reportedValue?.raw != null);
    const last = values.at(-1);
    return last ? { value: Number(last.reportedValue.raw), end: last.asOfDate, currency: last.currencyCode } : null;
  };
  const rev = latest("annualTotalRevenue");
  const revRows = ((json?.timeseries?.result || []).find((r) => r.meta?.type?.[0] === "annualTotalRevenue")?.annualTotalRevenue || [])
    .filter((v) => v?.reportedValue?.raw != null);
  const revenueGrowthPct = revRows.length >= 2 && revRows.at(-2).reportedValue.raw > 0
    ? Number(((revRows.at(-1).reportedValue.raw / revRows.at(-2).reportedValue.raw - 1) * 100).toFixed(1)) : null;
  const fcf = latest("annualFreeCashFlow");
  const ocf = latest("annualOperatingCashFlow");
  const cash = latest("annualCashCashEquivalentsAndShortTermInvestments");
  const cap = latest("trailingMarketCap");
  return {
    currency: rev?.currency || cash?.currency || null,
    revenueTtm: rev?.value ?? null, revenueBasis: rev ? "fiscal-year" : null, revenueEnd: rev?.end ?? null, revenueGrowthPct,
    operatingCashFlowTtm: ocf?.value ?? null, capexTtm: null, fcfTtm: fcf?.value ?? null,
    cashAndShortTermInvestments: cash?.value ?? null, cashEnd: cash?.end ?? null,
    marketCapReported: cap?.value ?? null,
    source: "Yahoo Finance fundamentals (annual)", sourceUrl: `https://finance.yahoo.com/quote/${symbol}/financials`,
  };
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

// ── build ───────────────────────────────────────────────────────────────────

/**
 * "filed" when cash and FCF come from the same filed period (SEC or DART);
 * "estimate" for provider snapshots whose period alignment is not verified.
 */
export function runwayStatus(f) {
  if (!f) return null;
  if (f.status === "filed" && f.cashEnd && (f.fcfEnd || f.revenueEnd) === f.cashEnd) return "filed";
  return "estimate";
}

/** Offering filings after the statements' period end: shown separately, never added to cash. */
export function postPeriodRaises(f) {
  const end = f?.cashEnd || f?.revenueEnd;
  if (!end) return [];
  return (f.filings || []).filter((x) => x.capitalRaise && x.date > end).map(({ form, date, url }) => ({ form, date, url }));
}

/** US-dollar market cap: our own figure for USD listings, TradingView's conversion otherwise. */
export function usdMarketCap(row, tv, fx = FX_TABLE) {
  if (row?.currency === "USD" && Number.isFinite(row.marketCap)) return Math.round(row.marketCap);
  const own = fx ? toUsd(row?.marketCap, row?.currency, fx) : null;
  if (Number.isFinite(own)) return Math.round(own);
  return Number.isFinite(tv?.marketCapUsd) ? tv.marketCapUsd : null;
}

export function companyMetrics({ company, prices, fundamentals, previous }) {
  const series = prices?.series || previous?.series || [];
  const fx = fundamentals || previous?.fundamentals || null;
  const price = Number.isFinite(prices?.price) ? prices.price : previous?.price ?? null;
  const shares = fx?.sharesOutstanding;
  const marketCap = Number.isFinite(price) && Number.isFinite(shares) && fx?.currency === (prices?.currency || previous?.currency)
    ? price * shares : prices?.marketCap ?? fx?.marketCapReported ?? previous?.marketCap ?? null;
  return {
    ticker: company.ticker,
    price,
    currency: prices?.currency || previous?.currency || null,
    priceTime: prices?.priceTime || previous?.priceTime || null,
    marketCap,
    marketCapNeededFor10x: Number.isFinite(marketCap) ? marketCap * 10 : null,
    fundamentals: fx,
    runwayYears: fx ? runwayYears(fx.cashAndShortTermInvestments, fx.fcfTtm) : null,
    // Constant-burn scenarios, both on the same balance-sheet date.
    runwayCashOnlyYears: fx ? runwayYears(fx.cashOnly, fx.fcfTtm) : null,
    fcfMarginPct: fx && fx.revenueTtm > 0 && Number.isFinite(fx.fcfTtm) ? Number((fx.fcfTtm / fx.revenueTtm * 100).toFixed(1)) : null,
    returns: { m12: trailingReturn(series, 12), m36: trailingReturn(series, 36), m60: trailingReturn(series, 60) },
    tenBagger: tenBaggerEpisode(series),
    drawdownFromHighPct: series.length ? Number(((series.at(-1).close / Math.max(...series.map((p) => p.close)) - 1) * 100).toFixed(1)) : null,
    stale: { prices: !prices, fundamentals: !fundamentals && Boolean(previous?.fundamentals) },
    series: series.slice(-240),
  };
}

async function main() {
  const universe = JSON.parse(await readFile(UNIVERSE, "utf8"));
  let previous = {};
  try { previous = Object.fromEntries((JSON.parse(await readFile(OUT, "utf8")).companies || []).map((c) => [c.ticker, c])); } catch { /* first run */ }
  const companies = new Map();
  for (const sector of universe.sectors || []) for (const c of sector.publicCompanies || []) companies.set(c.ticker, c);
  for (const c of universe.history?.cases || []) if (!companies.has(c.ticker)) companies.set(c.ticker, { ...c, historyOnly: true });
  // Listed holders of startup stakes: the second path into each industry.
  for (const sector of universe.sectors || []) for (const st of sector.startups || []) for (const h of st.holders || []) {
    for (const t of String(h.holderTicker || "").split("/").map((x) => x.trim()).filter((x) => /^[A-Z]+:[A-Z0-9.\-]+$/.test(x))) {
      if (!companies.has(t)) companies.set(t, { ticker: t, name: h.holder, holderOnly: true });
      else if (companies.get(t).historyOnly) companies.set(t, { ...companies.get(t), historyOnly: false, holderOnly: true });
    }
  }
  const errors = [];
  // Korean statements filed with DART (scripts/tenbagger-dart.mjs; needs the DART_API_KEY secret).
  let dartCache = {};
  try { dartCache = JSON.parse(await readFile(resolve(root, "data/tenbagger/dart-cache.json"), "utf8")).tickers || {}; } catch { /* no key or step skipped */ }
  // Prices and non-SEC statements come from the yfinance step (scripts/tenbagger/collect_yf.py).
  let yfCache = {};
  try { yfCache = JSON.parse(await readFile(resolve(root, "data/tenbagger/yf-cache.json"), "utf8")).tickers || {}; } catch { /* step skipped */ }
  // TradingView's row per ticker (scripts/tenbagger/collect_tv.py), an independent cross-check.
  try { FX_TABLE = JSON.parse(await readFile(resolve(root, "data/tenbagger/fx.json"), "utf8")); setFx(FX_TABLE); } catch { /* no FX: non-USD dollar values stay empty */ }
  let tvRows = new Map();
  try { tvRows = new Map((JSON.parse(await readFile(resolve(root, "data/tenbagger/tv-cache.json"), "utf8")).rows || []).map((r) => [r.ticker, r])); } catch { /* step skipped */ }
  const tickerMap = await fetchSecTickerMap().catch((e) => { errors.push(`SEC ticker map: ${e.message}`); return null; });
  const rows = await mapLimit([...companies.values()], 4, async (company) => {
    const symbol = company.yahoo || yahooSymbol(company.ticker);
    const cik = secCikFor(company, tickerMap);
    const cached = yfCache[company.ticker];
    const prices = cached?.series?.length
      ? { series: cached.series, price: cached.price, currency: cached.currency, symbol: cached.symbol, priceTime: null, marketCap: cached.marketCap, avgTradedValue20d: cached.avgTradedValue20d ?? null, shortInterest: cached.shortInterest ?? null, valuation: cached.valuation ?? null, nextEarnings: cached.nextEarnings ?? null }
      : await fetchYahooMonthlyAny(symbol).catch((e) => { errors.push(`${company.ticker} price: ${e.message}`); return null; });
    const dart = dartCache[company.ticker] || dartCache[company.ticker.replace(/^KOSDAQ:/, "KRX:")] || dartCache[company.ticker.replace(/^KRX:/, "KOSDAQ:")];
    const snapshot = cached?.fundamentals ? { ...cached.fundamentals, status: "provider snapshot" } : null;
    const [fundamentals] = await Promise.all([
      company.historyOnly ? null : (cik ? fetchSec(cik).catch((e) => { if (!snapshot) throw e; errors.push(`${company.ticker} SEC: ${e.message} — provider snapshot used`); return snapshot; }) : dart ? Promise.resolve({ ...dart, quarters: snapshot?.quarters || [] }) : snapshot ? Promise.resolve(snapshot)
        : fetchYahooFundamentals(prices?.symbol || symbol).then((f) => ({ ...f, status: "provider snapshot" })))
        .catch((e) => { errors.push(`${company.ticker} fundamentals: ${e.message}`); return null; }),
    ]);
    const row = companyMetrics({ company, prices, fundamentals, previous: previous[company.ticker] });
    const tv = crossCheck(row, tvRows.get(tvTicker(company.ticker))) || previous[company.ticker]?.tv || null;
    return { ...row, valuation: prices?.valuation ?? previous[company.ticker]?.valuation ?? null, nextEarnings: prices?.nextEarnings ?? previous[company.ticker]?.nextEarnings ?? null,
      shortInterest: prices?.shortInterest ?? previous[company.ticker]?.shortInterest ?? null, avgTradedValue20d: prices?.avgTradedValue20d ?? previous[company.ticker]?.avgTradedValue20d ?? null, name: company.name || null, holderOnly: Boolean(company.holderOnly), runwayStatus: runwayStatus(row.fundamentals),
      postPeriodRaises: postPeriodRaises(row.fundamentals), marketCapUsd: usdMarketCap(row, tv), tv, secCik: cik, yahooSymbol: prices?.symbol || symbol };
  });
  const fresh = rows.filter((r) => !r.stale.prices).length;
  const out = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    universeAsOf: universe.asOf || null,
    coverage: { companies: rows.length, freshPrices: fresh, withFundamentals: rows.filter((r) => r.fundamentals).length,
      tvCrossChecked: rows.filter((r) => r.tv).length, tvAgrees: rows.filter((r) => r.tv?.agrees === true).length },
    errors: errors.slice(0, 200),
    companies: rows,
  };
  // A run that reached almost nothing keeps the previous artifact instead of
  // replacing good numbers with carried-over ones.
  if (rows.length && fresh / rows.length < 0.3 && Object.keys(previous).length) {
    console.log(JSON.stringify({ tenbagger: "kept-previous", fresh, total: rows.length, sampleErrors: errors.slice(0, 5) }));
    return;
  }
  await writeFile(`${OUT}.tmp`, `${JSON.stringify(out, null, 2)}\n`);
  await rename(`${OUT}.tmp`, OUT);
  console.log(JSON.stringify({ tenbagger: "written", ...out.coverage, errors: errors.length }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
