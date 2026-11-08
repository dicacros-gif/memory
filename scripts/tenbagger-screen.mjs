import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Ten-bagger market screen.
 *
 * Reads the TradingView scan (scripts/tenbagger/collect_tv.py, the same public
 * scanner the semiconductor terminal uses) and publishes
 * data/tenbagger/screen.json:
 *
 * - industryMap: measured trailing-twelve-month revenue growth per industry,
 *   from every listed company in the scan — what is growing now, as opposed
 *   to the forecast CAGRs cited in universe.json;
 * - discovery: fast growers that are still small enough for a tenfold move
 *   and are funded (FCF positive or two years of cash), flagged when they are
 *   not yet in the curated universe;
 * - recentTenBaggers: stocks up tenfold or more over five years, and the
 *   industries they came from.
 *
 * Every figure is a scanner field or arithmetic on scanner fields of the same
 * row (ratios only, so reporting currencies never mix). Nothing is estimated.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = resolve(root, "data/tenbagger/tv-cache.json");
const UNIVERSE = resolve(root, "data/tenbagger/universe.json");
const OUT = resolve(root, "data/tenbagger/screen.json");
const METRICS = resolve(root, "data/tenbagger/metrics.json");
const LANDING = resolve(root, "data/tenbagger/landing-client.json");

export const TV_PREFIX = { KOSDAQ: "KRX", KOSPI: "KRX", NYSEAMERICAN: "AMEX", AMS: "EURONEXT", SWX: "SIX" };
export const tvTicker = (ticker) => {
  const [exchange, code] = String(ticker).split(":");
  const upper = (exchange || "").toUpperCase();
  return `${TV_PREFIX[upper] || upper}:${code}`;
};

// TradingView industry -> the tracker's sector. Industries outside this map
// still appear in the industry map; they just carry no sector tag.
export const SECTOR_INDUSTRIES = {
  "ai-infra": ["Semiconductors", "Electronic Production Equipment", "Computer Processing Hardware", "Electronic Components",
    "Telecommunications Equipment", "Computer Communications", "Computer Peripherals"],
  robotics: ["Industrial Machinery", "Electronic Equipment/Instruments", "Trucks/Construction/Farm Machinery"],
  "ai-agents": ["Packaged Software", "Information Technology Services", "Internet Software/Services", "Data Processing Services"],
  "bio-platform": ["Biotechnology", "Pharmaceuticals: Other", "Pharmaceuticals: Major", "Medical Specialties"],
  "space-defense": ["Aerospace & Defense"],
  "energy-nuclear": ["Alternative Power Generation", "Electric Utilities", "Electrical Products", "Other Metals/Minerals"],
};
// Korean labels for the scanner's industry names; an unlisted industry keeps its English name.
export const INDUSTRY_KO = {
  Semiconductors: "반도체", "Electronic Production Equipment": "반도체·전자 장비", "Computer Processing Hardware": "컴퓨팅 하드웨어",
  "Electronic Components": "전자부품", "Telecommunications Equipment": "통신장비", "Computer Communications": "네트워크 장비",
  "Computer Peripherals": "컴퓨터 주변기기", "Industrial Machinery": "산업기계", "Electronic Equipment/Instruments": "전자장비·계측기",
  "Trucks/Construction/Farm Machinery": "트럭·건설·농기계", "Packaged Software": "패키지 소프트웨어", "Information Technology Services": "IT 서비스",
  "Internet Software/Services": "인터넷 소프트웨어·서비스", "Data Processing Services": "데이터 처리 서비스", Biotechnology: "바이오테크",
  "Pharmaceuticals: Other": "제약(기타)", "Pharmaceuticals: Major": "대형 제약", "Medical Specialties": "의료기기", "Aerospace & Defense": "항공우주·방산",
  "Alternative Power Generation": "대체 발전", "Electric Utilities": "전력 유틸리티", "Electrical Products": "전기장비", "Other Metals/Minerals": "기타 금속·광물",
  "Engineering & Construction": "엔지니어링·건설", "Investment Banks/Brokers": "증권", "Regional Banks": "지역은행", "Major Banks": "대형 은행",
  "Real Estate Development": "부동산 개발", "Oil & Gas Production": "석유·가스 생산", "Precious Metals": "귀금속", "Steel": "철강",
  "Chemicals: Specialty": "특수화학", "Motor Vehicles": "자동차", "Auto Parts: OEM": "자동차 부품", "Internet Retail": "온라인 유통",
  "Medical/Nursing Services": "의료·요양 서비스", "Specialty Insurance": "특수보험", "Restaurants": "외식", "Casinos/Gaming": "카지노·게임",
  "Recreational Products": "레저용품", "Industrial Specialties": "산업 특수소재", "Miscellaneous Commercial Services": "기타 상업 서비스",
  "Marine Shipping": "해운", "Air Freight/Couriers": "항공화물·택배", "Wireless Telecommunications": "무선통신", "Electronics/Appliances": "가전",
};
export const industryLabel = (name) => (INDUSTRY_KO[name] ? `${INDUSTRY_KO[name]} (${name})` : name);

const SECTOR_OF = Object.fromEntries(Object.entries(SECTOR_INDUSTRIES).flatMap(([id, list]) => list.map((name) => [name, id])));

export const DISCOVERY_RULES = {
  minGrowthPct: 30,
  maxGrowthPct: 1000, // above this the base is too small for the ratio to mean anything
  minCapUsd: 3e8,
  maxCapUsd: 10e9,
  minRunwayYears: 2,
  limit: 60,
};
export const TEN_X_PCT = 900; // +900% = 10x

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const round = (v, d = 1) => (isNum(v) ? Number(v.toFixed(d)) : null);
const median = (list) => {
  const s = list.filter(isNum).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** One company per listing family: preferred and secondary lines repeat the parent's fundamentals. */
export function dedupe(rows) {
  const key = (r) => `${r.country || ""}|${String(r.description || r.name || r.ticker).toLowerCase()
    .replace(/\b(class [a-z]|cl [a-z]|pfd|preferred|pref|ord|ordinary shares?|common stock|adr|ads)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim()}`;
  const best = new Map();
  for (const r of rows) {
    if (!r?.ticker) continue;
    const k = key(r);
    const prev = best.get(k);
    if (!prev || (r.market_cap_basic || 0) > (prev.market_cap_basic || 0)) best.set(k, r);
  }
  return [...best.values()];
}

/** Ratios computed inside one row, so the reporting currency cancels out. */
export function rowFacts(r) {
  const revenue = r.total_revenue_ttm;
  const fcf = r.free_cash_flow_ttm;
  const cash = r.cash_n_short_term_invest_fq;
  return {
    ticker: r.ticker,
    name: r.description || r.name || r.ticker,
    country: r.country || null,
    industry: r.industry || null,
    industryKo: r.industry ? INDUSTRY_KO[r.industry] || null : null,
    sector: SECTOR_OF[r.industry] || null,
    marketCapUsd: isNum(r.market_cap_basic) ? Math.round(r.market_cap_basic) : null,
    revenueGrowthPct: round(r.total_revenue_yoy_growth_ttm),
    fcfMarginPct: isNum(revenue) && revenue > 0 && isNum(fcf) ? round((fcf / revenue) * 100) : null,
    runwayYears: isNum(fcf) && fcf < 0 && isNum(cash) && cash >= 0 ? round(cash / -fcf) : null,
    fcfPositive: isNum(fcf) ? fcf >= 0 : null,
    grossMarginPct: round(r.gross_margin),
    perf1yPct: round(r["Perf.Y"]),
    perf5yPct: round(r["Perf.5Y"]),
    offHighPct: isNum(r.close) && isNum(r.price_52_week_high) && r.price_52_week_high > 0
      ? round((r.close / r.price_52_week_high - 1) * 100) : null,
  };
}

export function industryGrowthMap(rows, { minCompanies = 8 } = {}) {
  const groups = new Map();
  for (const r of rows) {
    const f = rowFacts(r);
    if (!f.industry || !isNum(f.revenueGrowthPct)) continue;
    if (!groups.has(f.industry)) groups.set(f.industry, []);
    groups.get(f.industry).push(f);
  }
  const out = [];
  for (const [industry, list] of groups) {
    if (list.length < minCompanies) continue;
    const growth = list.map((f) => f.revenueGrowthPct);
    const capped = list.filter((f) => isNum(f.marketCapUsd));
    const capSum = capped.reduce((s, f) => s + f.marketCapUsd, 0);
    // Growth clipped to [-100, 300] so one tiny-base outlier cannot carry an industry.
    const weighted = capSum > 0 ? capped.reduce((s, f) => s + f.marketCapUsd * Math.max(-100, Math.min(300, f.revenueGrowthPct)), 0) / capSum : null;
    out.push({
      industry,
      industryKo: INDUSTRY_KO[industry] || null,
      sector: SECTOR_OF[industry] || null,
      companies: list.length,
      medianGrowthPct: round(median(growth)),
      capWeightedGrowthPct: round(weighted),
      shareGrowing25Pct: round((growth.filter((g) => g >= 25).length / list.length) * 100),
      marketCapUsd: Math.round(capSum),
      leaders: [...list].sort((a, b) => (b.marketCapUsd || 0) - (a.marketCapUsd || 0)).slice(0, 3).map((f) => f.name),
    });
  }
  return out.sort((a, b) => b.medianGrowthPct - a.medianGrowthPct);
}

export function discoveryCandidates(rows, universeTickers, rules = DISCOVERY_RULES) {
  const known = new Set(universeTickers);
  return rows
    .map(rowFacts)
    .filter((f) => isNum(f.revenueGrowthPct) && f.revenueGrowthPct >= rules.minGrowthPct && f.revenueGrowthPct <= rules.maxGrowthPct)
    .filter((f) => isNum(f.marketCapUsd) && f.marketCapUsd >= rules.minCapUsd && f.marketCapUsd <= rules.maxCapUsd)
    .filter((f) => f.fcfPositive === true || (isNum(f.runwayYears) && f.runwayYears >= rules.minRunwayYears))
    .filter((f) => f.sector)
    .map((f) => ({ ...f, inUniverse: known.has(f.ticker), upsideTo10xUsd: f.marketCapUsd * 10 }))
    .sort((a, b) => b.revenueGrowthPct - a.revenueGrowthPct)
    .slice(0, rules.limit);
}

export function recentTenBaggers(rows, { minCapUsd = 1e9, limit = 80 } = {}) {
  const list = rows.map(rowFacts)
    .filter((f) => isNum(f.perf5yPct) && f.perf5yPct >= TEN_X_PCT && isNum(f.marketCapUsd) && f.marketCapUsd >= minCapUsd)
    .sort((a, b) => b.perf5yPct - a.perf5yPct);
  const byIndustry = new Map();
  for (const f of list) {
    const k = f.industry || "기타";
    const e = byIndustry.get(k) || { industry: k, sector: f.sector, count: 0, growth: [], fcfPositive: 0 };
    e.count += 1;
    if (isNum(f.revenueGrowthPct)) e.growth.push(f.revenueGrowthPct);
    if (f.fcfPositive) e.fcfPositive += 1;
    byIndustry.set(k, e);
  }
  const industries = [...byIndustry.values()]
    .map((e) => ({ industry: e.industry, industryKo: INDUSTRY_KO[e.industry] || null, sector: e.sector, count: e.count, medianGrowthPct: round(median(e.growth)), fcfPositiveShare: round((e.fcfPositive / e.count) * 100) }))
    .sort((a, b) => b.count - a.count);
  const growth = list.map((f) => f.revenueGrowthPct).filter(isNum);
  return {
    total: list.length,
    traits: {
      medianRevenueGrowthPct: round(median(growth)),
      fcfPositiveSharePct: list.length ? round((list.filter((f) => f.fcfPositive).length / list.length) * 100) : null,
      medianGrossMarginPct: round(median(list.map((f) => f.grossMarginPct))),
    },
    industries,
    stocks: list.slice(0, limit),
  };
}

/** TradingView's view of one universe company, for cross-checking SEC/Yahoo numbers. */
export function crossCheck(metricsRow, tvRow) {
  if (!tvRow) return null;
  const tv = rowFacts(tvRow);
  const ours = metricsRow?.fundamentals?.revenueGrowthPct;
  const diff = isNum(ours) && isNum(tv.revenueGrowthPct) ? round(ours - tv.revenueGrowthPct) : null;
  const ourFcf = metricsRow?.fundamentals?.fcfTtm;
  return {
    marketCapUsd: tv.marketCapUsd,
    revenueGrowthPct: tv.revenueGrowthPct,
    fcfMarginPct: tv.fcfMarginPct,
    runwayYears: tv.runwayYears,
    perf1yPct: tv.perf1yPct,
    perf5yPct: tv.perf5yPct,
    industry: tv.industry,
    growthDiffPp: diff,
    // Agreement: growth within 10pp and the same FCF sign. Different fiscal
    // calendars (fiscal-year vs trailing quarters) explain small gaps.
    agrees: diff === null && !isNum(ourFcf) ? null
      : (diff === null || Math.abs(diff) <= 10) && (!isNum(ourFcf) || tv.fcfPositive === null || (ourFcf >= 0) === tv.fcfPositive),
  };
}

export function buildScreen(cache, universe) {
  const rows = dedupe(cache.rows || []);
  const universeTickers = (universe.sectors || []).flatMap((s) => (s.publicCompanies || []).map((c) => tvTicker(c.ticker)));
  return {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    fetchedAt: cache.fetchedAt || null,
    source: cache.source || "TradingView public scanner",
    sourceUrl: cache.sourceUrl || "https://www.tradingview.com/screener/",
    scope: { markets: cache.markets || [], minMarketCapUsd: cache.minMarketCapUsd ?? null, companies: rows.length, fields: cache.fields || [] },
    rules: { discovery: DISCOVERY_RULES, tenX: "5년 수익률 +900% 이상, 시가총액 10억 달러 이상" },
    sectorIndustries: SECTOR_INDUSTRIES,
    industryMap: industryGrowthMap(rows),
    discovery: discoveryCandidates(rows, universeTickers),
    recentTenBaggers: recentTenBaggers(rows),
  };
}

// The curated-universe screen, shared with tenbagger/tenbagger.js.
export const UNIVERSE_RULES = { maxCapUsd: 10e9, minGrowthPct: 20, minRunwayYears: 2 };
export function universeScreen(universe, metrics, rules = UNIVERSE_RULES) {
  const byTicker = new Map((metrics?.companies || []).map((m) => [m.ticker, m]));
  const picks = [];
  for (const sector of universe.sectors || []) {
    for (const c of sector.publicCompanies || []) {
      const m = byTicker.get(c.ticker);
      const f = m?.fundamentals;
      if (!m || !f || c.layer !== "candidate") continue;
      const cap = m.marketCapUsd ?? (m.currency === "USD" ? m.marketCap : null);
      const funded = f.fcfTtm >= 0 || m.runwayYears >= rules.minRunwayYears;
      if (isNum(cap) && cap < rules.maxCapUsd && f.revenueGrowthPct >= rules.minGrowthPct && funded) {
        picks.push({ ticker: c.ticker, name: c.name, sector: sector.id, sectorName: sector.name, marketCapUsd: Math.round(cap),
          revenueGrowthPct: f.revenueGrowthPct, fcfPositive: f.fcfTtm >= 0, runwayYears: m.runwayYears ?? null,
          crossChecked: m.tv?.agrees ?? null, sourceUrl: c.sourceUrl || null });
      }
    }
  }
  return picks.sort((a, b) => b.revenueGrowthPct - a.revenueGrowthPct);
}

/** The small artifact the landing page reads; null when there is nothing verified to show. */
export function buildLandingClient(screen, universe, metrics) {
  const candidates = metrics ? universeScreen(universe, metrics) : [];
  const industries = (screen?.industryMap || []).filter((i) => i.companies >= 15).slice(0, 6);
  const discovery = (screen?.discovery || []).filter((d) => !d.inUniverse).slice(0, 6);
  const tenX = screen?.recentTenBaggers || null;
  if (!candidates.length && !industries.length && !discovery.length) return null;
  return {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    marketAsOf: screen?.fetchedAt || null,
    metricsAsOf: metrics?.generatedAt || null,
    source: screen ? { name: screen.source, url: screen.sourceUrl, companies: screen.scope?.companies ?? null } : null,
    industries: industries.map(({ industry, industryKo, sector, companies, medianGrowthPct, shareGrowing25Pct }) => ({ industry, industryKo, sector, companies, medianGrowthPct, shareGrowing25Pct })),
    candidates: candidates.slice(0, 6),
    candidateCount: candidates.length,
    discovery: discovery.map(({ ticker, name, industry, industryKo, sector, marketCapUsd, revenueGrowthPct, fcfPositive, runwayYears }) => ({ ticker, name, industry, industryKo, sector, marketCapUsd, revenueGrowthPct, fcfPositive, runwayYears })),
    tenX: tenX ? { total: tenX.total, traits: tenX.traits, industries: tenX.industries.slice(0, 3) } : null,
  };
}

const readJson = async (path) => { try { return JSON.parse(await readFile(path, "utf8")); } catch { return null; } };
const writeJson = async (path, value) => { await writeFile(`${path}.tmp`, `${JSON.stringify(value, null, 2)}\n`); await rename(`${path}.tmp`, path); };

async function main() {
  const universe = JSON.parse(await readFile(UNIVERSE, "utf8"));
  const cache = await readJson(CACHE);
  let screen = await readJson(OUT);
  if (cache?.rows?.length >= 500) {
    screen = buildScreen(cache, universe);
    await writeJson(OUT, screen);
    console.log(JSON.stringify({ tenbaggerScreen: "written", companies: screen.scope.companies, industries: screen.industryMap.length,
      discovery: screen.discovery.length, recentTenBaggers: screen.recentTenBaggers.total, fields: screen.scope.fields.length }));
  } else {
    console.log(JSON.stringify({ tenbaggerScreen: "kept-previous", rows: cache?.rows?.length || 0, errors: cache?.errors || null }));
  }
  const landing = buildLandingClient(screen, universe, await readJson(METRICS));
  if (landing) await writeJson(LANDING, landing);
  console.log(JSON.stringify({ tenbaggerLanding: landing ? "written" : "skipped", candidates: landing?.candidateCount ?? 0 }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
