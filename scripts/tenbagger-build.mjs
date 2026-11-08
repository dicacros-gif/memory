import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { rowFacts, tvTicker } from "./tenbagger-screen.mjs";

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

export function buildCompanies({ universe, metrics, screen, previousCompanies = null, changelog = null, now = new Date(), verified = null }) {
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
    const tvFacts = m?.tv || null;
    rec.name = rec.name || m?.name || rec.ticker;
    rec.currency = m?.currency || null;
    rec.price = m?.price ?? null;
    rec.marketCap = m?.marketCap ?? null;
    rec.marketCapUsd = m?.marketCapUsd ?? r?.marketCapUsd ?? tvFacts?.marketCapUsd ?? null;
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
    rec.tenBagger = m?.tenBagger ?? null;
    rec.quarters = f?.quarters || [];
    rec.annual = f?.annual || [];
    rec.filings = (f?.filings || []).slice(0, 12);
    rec.postPeriodRaises = m?.postPeriodRaises || [];
    rec.tvCheck = periodAlignedCheck(rec, tvFacts, screen?.fetchedAt);
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
  return [...out.values()];
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

export function buildIndustries({ universe, companies, startups, screen, metricsAt }) {
  const sectorIndustries = screen?.sectorIndustries || {};
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

const readJson = async (name) => { try { return JSON.parse(await readFile(P(name), "utf8")); } catch { return null; } };
const writeJson = async (name, value) => { await writeFile(`${P(name)}.tmp`, `${JSON.stringify(value)}\n`); await rename(`${P(name)}.tmp`, P(name)); };

async function main() {
  const now = new Date();
  const iso = now.toISOString();
  const [universe, metrics, screen, cohort, prevCompanies, prevChangelog, prevStatus, prevFx, yf, tv, dart] = await Promise.all(
    ["universe.json", "metrics.json", "screen.json", "cohort.json", "companies.json", "changelog.json", "status.json", "fx.json", "yf-cache.json", "tv-cache.json", "dart-cache.json"].map(readJson));
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
  const companies = buildCompanies({ universe, metrics, screen, previousCompanies: prevCompanies, changelog, now, verified });
  const startups = buildStartups({ universe, companies });
  const industries = buildIndustries({ universe, companies, startups, screen, metricsAt: metrics?.generatedAt });
  const history = buildHistory({ universe, metrics, cohort });
  const fx = await fetchFx(prevFx);
  const status = sourceStatus(prevStatus, iso, {
    sec: { ok: metrics ? !(metrics.errors || []).some((e) => /SEC ticker map/.test(e)) : null, at: metrics?.generatedAt, error: (metrics?.errors || []).find((e) => /SEC/.test(e)) },
    yahoo: { ok: yf ? Object.keys(yf.tickers || {}).length > 0 : null, at: yf?.generatedAt, detail: yf ? `${Object.keys(yf.tickers || {}).length} tickers` : null, error: yf?.errors?.[0] },
    tradingview: { ok: tv ? (tv.rows || []).length > 500 : null, at: tv?.fetchedAt, detail: tv ? `${(tv.rows || []).length} rows` : null, error: tv?.errors?.[0] },
    dart: { ok: dart ? Object.keys(dart.tickers || {}).length > 0 : null, at: dart?.generatedAt, error: dart?.errors?.[0] },
    fred: { ok: fx.ok, error: fx.error },
    cohort: { ok: cohort ? true : null, at: cohort?.generatedAt },
  });
  status.verification = verification;
  if (fx.fx) await writeJson("fx.json", fx.fx);
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
