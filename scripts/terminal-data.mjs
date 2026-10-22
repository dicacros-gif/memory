/**
 * Semiconductor terminal artifact.
 *
 * The terminal page is a dense, Bloomberg-style read of the same verified run
 * the console shows, plus the market data the Python collector gathers through
 * OpenBB, FinanceDataReader and the TradingView screener. This joins them into
 * one browser artifact carrying the publication runId, so the page can refuse
 * a mixed snapshot exactly as the console does.
 *
 * Nothing here is typed in by hand: every row is the crawl's daily close, an
 * OpenBB field, a FRED observation, a TrendForce price row or the IC memo. A
 * field the sources did not return stays null and renders as a dash.
 */

import { equityMetrics, equitySignal } from "./investment-memo.mjs";

const DAY = 864e5;
const isNum = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
const num = (value) => (isNum(value) ? Number(value) : null);
const round = (value, digits = 2) => (isNum(value) ? Number(Number(value).toFixed(digits)) : null);
const median = (values) => {
  const list = values.filter(isNum).map(Number).sort((a, b) => a - b);
  if (!list.length) return null;
  const middle = Math.floor(list.length / 2);
  return list.length % 2 ? list[middle] : (list[middle - 1] + list[middle]) / 2;
};
const HAN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
const safeText = (value, max = 240) => {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text && !HAN.test(text) ? text.slice(0, max) : null;
};
const ratioToPct = (value) => (isNum(value) ? round(Number(value) * 100, 1) : null);
const pctChange = (now, then) => (isNum(now) && isNum(then) && Number(then) !== 0 ? round((Number(now) / Number(then) - 1) * 100, 2) : null);

const VALUE_CHAIN_LABEL = {
  memory: "메모리",
  "ai-chip": "AI 칩",
  foundry: "파운드리",
  equipment: "장비",
  materials: "소재",
  packaging: "패키징·테스트",
  interconnect: "인터커넥트",
  infrastructure: "AI 인프라",
  "design-ip": "설계·IP",
  "analog-power": "아날로그·전력",
  substrates: "기판",
  index: "지수",
};

const REGION_LABEL = { global: "글로벌", china: "중국", korea: "한국", index: "지수" };

// ── Price series ────────────────────────────────────────────────────────────

function closesFrom(index = {}) {
  return (index.points || [])
    .map((point) => (Array.isArray(point)
      ? [Number(point[0]), Number(point[1])]
      : [Number(point.time ?? Date.parse(point.date)), Number(point.close ?? point.value)]))
    .filter(([time, value]) => Number.isFinite(time) && Number.isFinite(value) && value > 0)
    .sort((a, b) => a[0] - b[0]);
}

function sparkline(points, count = 60) {
  if (!points.length) return [];
  const window = points.slice(-Math.max(count * 2, count));
  const step = Math.max(1, Math.floor(window.length / count));
  const sampled = window.filter((_, index) => index % step === 0 || index === window.length - 1);
  return sampled.slice(-count).map(([, value]) => round(value, 4));
}

function returnsFrom(points) {
  if (!points.length) return {};
  const last = points.at(-1);
  const back = (offset) => (points.length > offset ? points[points.length - 1 - offset][1] : null);
  const yearStart = Date.UTC(new Date(last[0]).getUTCFullYear(), 0, 1);
  const ytdBase = [...points].reverse().find(([time]) => time < yearStart)?.[1] ?? null;
  return {
    ret1d: pctChange(last[1], back(1)),
    ret1w: pctChange(last[1], back(5)),
    ytd: pctChange(last[1], ytdBase),
  };
}

// ── OpenBB-derived fields ───────────────────────────────────────────────────

const sectionData = (sections, key) => sections?.[key]?.data ?? null;

function estimateMomentum(trend = []) {
  const rows = Array.isArray(trend) ? trend : [];
  const pick = (period) => rows.find((row) => row.period === period);
  const current = pick("0y") || pick("+1y") || rows[0];
  if (!current) return null;
  return {
    period: current.period,
    current: num(current.current),
    rev30: pctChange(current.current, current.days_ago_30),
    rev90: pctChange(current.current, current.days_ago_90),
    nextYear: num(pick("+1y")?.current),
  };
}

function revisionBreadth(revisions = []) {
  const rows = Array.isArray(revisions) ? revisions : [];
  const row = rows.find((item) => item.period === "0y") || rows[0];
  if (!row) return null;
  const up = num(row.up_last_30_days) ?? 0;
  const down = num(row.down_last_30_days) ?? 0;
  return { period: row.period, up, down, net: up - down };
}

function recommendationMix(rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  const row = list.find((item) => item.period === "0m") || list[0];
  if (!row) return null;
  const counts = ["strong_buy", "buy", "hold", "sell", "strong_sell"].map((key) => num(row[key]) ?? 0);
  const total = counts.reduce((sum, value) => sum + value, 0);
  return total ? { strongBuy: counts[0], buy: counts[1], hold: counts[2], sell: counts[3], strongSell: counts[4], total } : null;
}

function nextEarnings(calendar, nowMs) {
  if (!calendar) return null;
  const dates = (Array.isArray(calendar.earnings_date) ? calendar.earnings_date : [calendar.earnings_date])
    .map((value) => String(value || "").slice(0, 10))
    .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
    .sort();
  const upcoming = dates.find((value) => Date.parse(value) >= nowMs - DAY) || null;
  if (!upcoming) return null;
  return {
    date: upcoming,
    days: Math.round((Date.parse(upcoming) - nowMs) / DAY),
    epsAverage: num(calendar.earnings_average),
    epsLow: num(calendar.earnings_low),
    epsHigh: num(calendar.earnings_high),
    revenueAverage: num(calendar.revenue_average),
  };
}

// TradingView tickers are EXCHANGE:CODE; Yahoo uses CODE.SUFFIX. Map one to
// the other so screener fields attach to the right row.
const YAHOO_TO_TV = [
  [/\.KS$|\.KQ$/, "KRX"],
  [/\.T$/, "TSE"],
  [/\.TWO$/, "TPEX"],
  [/\.TW$/, "TWSE"],
  [/\.SS$/, "SSE"],
  [/\.SZ$/, "SZSE"],
  [/\.AS$/, "EURONEXT"],
];
function tradingViewKey(symbol = "") {
  const text = String(symbol);
  for (const [pattern, exchange] of YAHOO_TO_TV) {
    if (pattern.test(text)) return `${exchange}:${text.replace(pattern, "")}`;
  }
  return text.startsWith("^") ? null : `US:${text}`;
}
function screenerIndex(screener = {}) {
  const map = new Map();
  for (const row of screener.rows || []) {
    const [exchange, code] = String(row.ticker || "").split(":");
    if (!code) continue;
    const us = ["NASDAQ", "NYSE", "AMEX", "NYSE ARCA"].includes(exchange);
    map.set(`${us ? "US" : exchange}:${code}`, row);
  }
  return map;
}
const TV_RATING = (value) => {
  if (!isNum(value)) return null;
  const score = Number(value);
  return score >= 0.5 ? "Strong Buy" : score >= 0.1 ? "Buy" : score > -0.1 ? "Neutral" : score > -0.5 ? "Sell" : "Strong Sell";
};

// ── Memory prices ───────────────────────────────────────────────────────────

const MEMORY_SERIES = [
  { match: /^dram-dram-spot-price::ddr5 16gb \(2gx8\) 4800\/5600$/, label: "DDR5 16Gb 현물", group: "DRAM" },
  { match: /^dram-dram-spot-price::ddr4 16gb \(2gx8\) 3200$/, label: "DDR4 16Gb 현물", group: "DRAM" },
  { match: /^dram-dram-spot-price::ddr4 8gb \(1gx8\) 3200$/, label: "DDR4 8Gb 현물", group: "DRAM" },
  { match: /^dram-dram-contract-price::ddr4 16gb so-dimm$/, label: "DDR4 16GB SO-DIMM 계약", group: "DRAM" },
  { match: /^dram-dram-contract-price::ddr5 8gb so-dimm$/, label: "DDR5 8GB SO-DIMM 계약", group: "DRAM" },
  { match: /^dram-module-spot-price::ddr5 rdimm 32gb 4800\/5600$/, label: "DDR5 RDIMM 32GB 현물", group: "DRAM" },
  { match: /^dram-gddr-spot-price::gddr6 8gb$/, label: "GDDR6 8Gb 현물", group: "DRAM" },
  { match: /^nand-wafer-spot-price::512gb tlc$/, label: "NAND 512Gb TLC 웨이퍼", group: "NAND" },
  { match: /^nand-wafer-spot-price::256gb tlc$/, label: "NAND 256Gb TLC 웨이퍼", group: "NAND" },
  { match: /^nand-nand-flash-contract-price::nand 128gb 16gx8 mlc$/, label: "NAND 128Gb MLC 계약", group: "NAND" },
  { match: /^nand-pc-client-oem-ssd-contract-price::1tb-msata\/m\.2 tlc pcie-value grade$/, label: "PC SSD 1TB 계약", group: "NAND" },
];

function memoryPrices(priceHistory = {}, nowMs) {
  const items = Object.entries(priceHistory.items || {});
  return MEMORY_SERIES.map((series) => {
    const found = items.find(([key]) => series.match.test(key));
    if (!found) return null;
    const [key, item] = found;
    const points = (item.points || [])
      .map((point) => [Date.parse(point.date), Number(point.average)])
      .filter(([time, value]) => Number.isFinite(time) && Number.isFinite(value) && value > 0)
      .sort((a, b) => a[0] - b[0]);
    if (!points.length) return null;
    const last = points.at(-1);
    const at = (days) => [...points].reverse().find(([time]) => time <= last[0] - days * DAY)?.[1] ?? null;
    return {
      key,
      label: series.label,
      group: series.group,
      kind: /contract/.test(key) ? "계약" : "현물",
      last: round(last[1], 3),
      asOf: new Date(last[0]).toISOString().slice(0, 10),
      ageDays: Math.round((nowMs - last[0]) / DAY),
      chg30: pctChange(last[1], at(30)),
      chg90: pctChange(last[1], at(90)),
      chg365: pctChange(last[1], at(365)),
      spark: points.slice(-60).map(([, value]) => round(value, 3)),
      sourceUrl: item.sourceUrl || null,
    };
  }).filter(Boolean);
}

// ── Macro ───────────────────────────────────────────────────────────────────

function macroRows(source = {}, quant = {}, marketHistory = {}) {
  const rows = [];
  for (const [id, series] of Object.entries(source.macro || {})) {
    const points = (series.points || []).filter((point) => isNum(point?.[1]));
    if (!points.length) continue;
    const last = points.at(-1);
    const at = (days) => [...points].reverse().find(([stamp]) => Date.parse(stamp) <= Date.parse(last[0]) - days * DAY)?.[1] ?? null;
    const isLevel = ["DGS10", "T10Y2Y", "VIXCLS"].includes(id);
    rows.push({
      id,
      label: series.label,
      unit: series.unit,
      last: round(last[1], 3),
      asOf: last[0],
      chg1m: isLevel ? round(last[1] - (at(30) ?? NaN), 3) : pctChange(last[1], at(30)),
      chg1y: isLevel ? round(last[1] - (at(365) ?? NaN), 3) : pctChange(last[1], at(365)),
      changeKind: isLevel ? "level" : "pct",
      spark: points.slice(-90).map(([, value]) => round(value, 3)),
      source: series.source,
      url: series.url,
    });
  }
  for (const [id, fx] of Object.entries(quant.fx || {})) {
    if (!isNum(fx.value)) continue;
    rows.push({
      id: id.toUpperCase(),
      label: fx.label || id.toUpperCase(),
      unit: fx.currency || "",
      last: round(fx.value, 3),
      asOf: fx.asOf || null,
      chg1m: round(fx.changePct30d, 2),
      chg1y: round(fx.changePct1y, 2),
      changeKind: "pct",
      spark: [],
      source: "환율 일별 (크롤러)",
      url: null,
    });
  }
  const sox = marketHistory.indexes?.sox;
  if (sox) {
    const points = closesFrom(sox);
    const metrics = equityMetrics(sox);
    rows.push({
      id: "SOX",
      label: "필라델피아 반도체 지수",
      unit: "",
      last: round(metrics.close, 2),
      asOf: metrics.asOf,
      chg1m: metrics.ret1m,
      chg1y: metrics.ret1y,
      changeKind: "pct",
      spark: sparkline(points, 90),
      source: sox.source || "일별 종가",
      url: sox.sourceUrl || null,
    });
  }
  return rows;
}

// ── Assembly ────────────────────────────────────────────────────────────────

export function terminalEstimateSignals(source = {}, symbols = []) {
  const equities = source.equities || {};
  const rows = symbols.map((symbol) => {
    const sections = equities[symbol] || {};
    const consensus = sectionData(sections, "consensus");
    const trend = estimateMomentum(sectionData(sections, "epsTrend"));
    const price = num(consensus?.current_price);
    const target = num(consensus?.target_median ?? consensus?.target_consensus);
    return {
      symbol,
      upside: price && target ? pctChange(target, price) : null,
      rev90: trend?.rev90 ?? null,
      rev30: trend?.rev30 ?? null,
      recommendationMean: num(consensus?.recommendation_mean),
      analysts: num(consensus?.number_of_analysts),
      asOf: sections.consensus?.asOf || sections.epsTrend?.asOf || null,
    };
  });
  const observed = rows.filter((row) => isNum(row.upside) || isNum(row.rev90));
  return {
    count: observed.length,
    upsideMedian: round(median(rows.map((row) => row.upside)), 1),
    rev90Median: round(median(rows.map((row) => row.rev90)), 1),
    rev30Median: round(median(rows.map((row) => row.rev30)), 1),
    recommendationMedian: round(median(rows.map((row) => row.recommendationMean)), 2),
    asOf: observed.map((row) => row.asOf).filter(Boolean).sort().at(-1) || null,
    rows,
  };
}

export function buildTerminalClient({
  source = {},
  ohlcv = {},
  marketHistory = {},
  priceHistory = {},
  quant = {},
  memo = null,
  news = [],
  runId = null,
  now = new Date(),
} = {}) {
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now) || Date.now();
  const indexes = marketHistory.indexes || {};
  const screener = screenerIndex(source.screener);
  const krxRows = source.krx?.rows || {};
  const universe = Array.isArray(source.universe) && source.universe.length
    ? source.universe
    : Object.values(indexes).map((index) => ({
      id: index.id, symbol: index.symbol, name: index.shortName || index.label, region: index.region, valueChain: index.valueChain, isIndex: String(index.symbol || "").startsWith("^"),
    }));

  const equities = universe.map((entry) => {
    const sections = source.equities?.[entry.symbol] || {};
    const crawl = indexes[entry.id];
    const bars = ohlcv[entry.id]?.bars || [];
    // The crawl's own closes are the published price; OpenBB bars only fill
    // names the crawl does not cover, so the two never disagree on one row.
    const points = crawl ? closesFrom(crawl) : bars.map((bar) => [Number(bar[0]), Number(bar[4])]).filter(([t, v]) => Number.isFinite(t) && v > 0);
    const metrics = points.length ? equityMetrics({ points }, { now: nowMs }) : { status: "missing" };
    const quote = sectionData(sections, "quote") || {};
    const keyMetrics = sectionData(sections, "metrics") || {};
    const consensus = sectionData(sections, "consensus") || {};
    const profile = sectionData(sections, "profile") || {};
    const trend = estimateMomentum(sectionData(sections, "epsTrend"));
    const breadth = revisionBreadth(sectionData(sections, "epsRevisions"));
    const mix = recommendationMix(sectionData(sections, "recommendations"));
    const tv = screener.get(tradingViewKey(entry.symbol)) || null;
    const krxCode = (/^(\d{6})\.K[SQ]$/.exec(entry.symbol) || [])[1];
    const krx = krxCode ? krxRows[krxCode] : null;
    const price = num(consensus.current_price) ?? num(quote.last_price) ?? metrics.close ?? null;
    const target = num(consensus.target_median ?? consensus.target_consensus);
    return {
      id: entry.id,
      symbol: entry.symbol,
      name: safeText(entry.name || quote.name || profile.name, 60) || entry.symbol,
      region: entry.region || "global",
      regionLabel: REGION_LABEL[entry.region] || entry.region || "",
      valueChain: entry.valueChain || "",
      valueChainLabel: VALUE_CHAIN_LABEL[entry.valueChain] || entry.valueChain || "",
      isIndex: Boolean(entry.isIndex),
      exchange: crawl?.exchange || quote.exchange || "",
      currency: crawl?.currency || quote.currency || keyMetrics.currency || "",
      sourceUrl: crawl?.sourceUrl || `https://finance.yahoo.com/quote/${encodeURIComponent(entry.symbol)}/`,
      hasBars: bars.length > 0,
      price: {
        last: round(metrics.close ?? quote.last_price, 4),
        asOf: metrics.asOf || sections.quote?.asOf?.slice(0, 10) || null,
        status: metrics.status,
        ...returnsFrom(points),
        ret1m: metrics.ret1m ?? null,
        ret3m: metrics.ret3m ?? null,
        ret6m: metrics.ret6m ?? null,
        ret1y: metrics.ret1y ?? null,
        fromHigh52: metrics.fromHigh52 ?? null,
        vsMa200: metrics.vsMa200 ?? null,
        volatility: metrics.volatility ?? null,
        maxDrawdown: metrics.maxDrawdown ?? null,
        volume: num(quote.volume),
        volumeAverage: num(quote.volume_average),
        yearHigh: num(quote.year_high),
        yearLow: num(quote.year_low),
        spark: sparkline(points, 60),
      },
      signal: equitySignal(metrics),
      valuation: {
        marketCap: num(keyMetrics.market_cap ?? profile.market_cap),
        marketCapKrw: num(krx?.marcap),
        pe: round(keyMetrics.pe_ratio, 1),
        forwardPe: round(keyMetrics.forward_pe, 1),
        peg: round(keyMetrics.peg_ratio ?? keyMetrics.peg_ratio_ttm, 2),
        evEbitda: round(keyMetrics.enterprise_to_ebitda, 1),
        evSales: round(keyMetrics.enterprise_to_revenue, 1),
        pb: round(keyMetrics.price_to_book, 2),
        dividendYield: ratioToPct(keyMetrics.dividend_yield),
        beta: round(keyMetrics.beta ?? profile.beta, 2),
        asOf: sections.metrics?.asOf || null,
      },
      fundamentals: {
        grossMargin: ratioToPct(keyMetrics.gross_margin),
        operatingMargin: ratioToPct(keyMetrics.operating_margin),
        profitMargin: ratioToPct(keyMetrics.profit_margin),
        revenueGrowth: ratioToPct(keyMetrics.revenue_growth),
        earningsGrowth: ratioToPct(keyMetrics.earnings_growth),
        roe: ratioToPct(keyMetrics.return_on_equity),
        debtToEquity: round(keyMetrics.debt_to_equity, 1),
        epsTtm: round(keyMetrics.eps_ttm, 2),
        epsForward: round(keyMetrics.eps_forward, 2),
      },
      consensus: {
        targetMedian: round(target, 2),
        targetHigh: round(consensus.target_high, 2),
        targetLow: round(consensus.target_low, 2),
        upside: price && target ? pctChange(target, price) : null,
        rating: safeText(consensus.recommendation, 20),
        recommendationMean: round(consensus.recommendation_mean, 2),
        analysts: num(consensus.number_of_analysts),
        mix,
        asOf: sections.consensus?.asOf || null,
      },
      estimates: { trend, breadth, asOf: sections.epsTrend?.asOf || null },
      earnings: nextEarnings(sectionData(sections, "calendar"), nowMs),
      technical: tv ? {
        rating: TV_RATING(tv["Recommend.All"]),
        ratingScore: round(tv["Recommend.All"], 2),
        rsi: round(tv.RSI, 1),
        relativeVolume: round(tv.relative_volume_10d_calc, 2),
      } : null,
      profile: profile.short_description ? {
        sector: safeText(profile.sector, 40),
        industry: safeText(profile.industry_category, 60),
        country: safeText(profile.hq_country, 40),
        employees: num(profile.employees),
        url: profile.company_url || null,
        description: safeText(profile.short_description, 420),
        asOf: sections.profile?.asOf || null,
      } : null,
    };
  });

  const coverageRows = memo?.coverage?.rows || [];
  const memoSignals = new Map(coverageRows.map((row) => [row.id, row]));
  for (const row of equities) {
    const memoRow = memoSignals.get(row.id);
    if (memoRow) row.memo = { role: memoRow.role, exposure: memoRow.exposure, driver: memoRow.driver };
  }

  const upcoming = equities
    .filter((row) => row.earnings && row.earnings.days >= -1 && row.earnings.days <= 120)
    .sort((a, b) => a.earnings.date.localeCompare(b.earnings.date))
    .map((row) => ({ id: row.id, symbol: row.symbol, name: row.name, valueChainLabel: row.valueChainLabel, ...row.earnings }));

  const companyNews = (source.news || [])
    .filter((item) => item.url && safeText(item.title))
    .map((item) => ({
      date: String(item.date || "").slice(0, 10) || null,
      title: safeText(item.title, 200),
      source: safeText(item.source, 60) || "Yahoo Finance",
      url: item.url,
      symbols: safeText(Array.isArray(item.symbols) ? item.symbols.join(",") : item.symbols, 80),
      lang: "en",
    }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 40);
  const verifiedNews = (news || [])
    .filter((item) => item.sourceUrl && (item.titleKo || item.title))
    .filter((item) => item.translation?.title?.status !== "unverified")
    .map((item) => ({
      date: item.date || null,
      title: safeText(item.titleKo || item.title, 200),
      source: safeText(item.source, 60),
      url: item.sourceUrl,
      category: item.category || null,
      lang: "ko",
    }))
    .filter((item) => item.title)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 40);

  const industries = Object.entries(source.industry || {}).map(([slug, block]) => ({
    slug,
    asOf: block.asOf || null,
    overview: (block.overview || []).slice(0, 1).map((row) => ({
      name: safeText(row.name, 80),
      marketCap: num(row.market_cap),
      marketWeight: ratioToPct(row.market_weight),
      companies: num(row.companies_count),
    }))[0] || null,
    topPerforming: (block.topPerforming || []).slice(0, 12).map((row) => ({
      symbol: row.symbol, name: safeText(row.name, 60), ytd: ratioToPct(row.ytd_return), last: num(row.last_price), target: num(row.target_price),
    })),
    topGrowth: (block.topGrowth || []).slice(0, 12).map((row) => ({
      symbol: row.symbol, name: safeText(row.name, 60), ytd: ratioToPct(row.ytd_return), growth: ratioToPct(row.growth_estimate),
    })),
  }));

  const screenRows = (source.screener?.rows || []).map((row) => ({
    ticker: row.ticker,
    name: safeText(row.description || row.name, 60) || row.name,
    country: safeText(row.country, 30),
    currency: row.currency,
    industry: row.industry,
    close: num(row.close),
    change: round(row.change, 2),
    marketCap: num(row.market_cap_basic),
    pe: round(row.price_earnings_ttm, 1),
    evEbitda: round(row.enterprise_value_ebitda_ttm, 1),
    pb: round(row.price_book_fq, 2),
    grossMargin: round(row.gross_margin, 1),
    rsi: round(row.RSI, 1),
    rating: TV_RATING(row["Recommend.All"]),
    ratingScore: round(row["Recommend.All"], 2),
    perf1m: round(row["Perf.1M"], 1),
    perf3m: round(row["Perf.3M"], 1),
    perfYtd: round(row["Perf.YTD"], 1),
    perf1y: round(row["Perf.Y"], 1),
  })).filter((row) => row.ticker);

  const providers = Object.fromEntries(Object.entries(source.providers || {}).map(([id, status]) => [id, {
    package: status.package,
    license: status.license,
    url: status.url,
    version: status.version || null,
    state: status.state || "skipped",
    ok: status.ok || 0,
    failed: status.failed || 0,
    finishedAt: status.finishedAt || null,
    ohlcvFiles: status.ohlcvFiles ?? null,
  }]));

  const basketSymbols = coverageRows.filter((row) => row.basket).map((row) => row.symbol).filter(Boolean);
  return {
    schemaVersion: "1.0",
    clientArtifact: true,
    runId,
    generatedAt: new Date(nowMs).toISOString(),
    expiresAt: quant.expiresAt || null,
    collectedAt: source.generatedAt || null,
    providers,
    excludedSources: source.excludedSources || [],
    memo: memo ? {
      asOf: memo.asOf,
      verdict: memo.verdict,
      factors: (memo.factors || []).map(({ id, label, weight, score, weighted, verdict, soWhat, note }) => ({ id, label, weight, score, weighted, verdict, soWhat, note })),
      killCriteria: memo.killCriteria || [],
      scenarios: memo.scenarios || [],
      catalysts: memo.catalysts || [],
      basket: memo.coverage?.basket || null,
      history: memo.history || [],
      method: memo.method || null,
    } : null,
    estimates: terminalEstimateSignals(source, basketSymbols),
    equities,
    earnings: upcoming,
    memoryPrices: memoryPrices(priceHistory, nowMs),
    macro: macroRows(source, quant, marketHistory),
    industries,
    screener: { asOf: source.screener?.asOf || null, total: source.screener?.total ?? null, source: source.screener?.source || null, rows: screenRows },
    news: { verified: verifiedNews, company: companyNews },
  };
}
