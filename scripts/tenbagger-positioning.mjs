import { readdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Growth-industry positioning monitor, computed only from data the pipeline
 * collects (daily bars in data/tenbagger/bars, companies.json, Yahoo short
 * interest). The framework follows common sell-side flows-and-positioning
 * practice — percentile of own history, trend-following momentum z-scores,
 * a realised-volatility range, breadth, short interest and a health map — but
 * every number here is our own computation; no third-party research figure
 * is reproduced.
 *
 * Per industry an equal-weighted index is built from members' daily
 * adjusted closes (members need 260+ sessions; each member's return is
 * capped at ±50% a day so one bad print cannot move the index).
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = resolve(root, "data/tenbagger");
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const round = (v, d = 2) => (isNum(v) ? Number(v.toFixed(d)) : null);
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const median = (a) => { const v = a.filter(isNum).sort((x, y) => x - y); if (!v.length) return null; const m = Math.floor(v.length / 2); return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
const std = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)) : null; };

export const LOOKBACKS = [21, 63, 126, 252];

/** Percentile rank (0–100) of the last value within the series. */
export function percentileOfLast(series) {
  const v = series.filter(isNum);
  if (v.length < 20) return null;
  const last = v.at(-1);
  return round((v.filter((x) => x <= last).length - 1) / (v.length - 1) * 100, 0);
}

/**
 * Trend-following momentum signal at index i of a price series: the average
 * over lookbacks of the return divided by its volatility-scaled expectation
 * (daily vol × √lookback), i.e. a z-score per horizon. Positive = uptrend.
 */
export function momentumAt(prices, i, volWindow = 126) {
  if (i < Math.max(...LOOKBACKS, volWindow)) return null;
  const rets = [];
  for (let k = i - volWindow + 1; k <= i; k += 1) rets.push(Math.log(prices[k] / prices[k - 1]));
  const vol = std(rets);
  if (!vol) return null;
  const zs = LOOKBACKS.map((n) => Math.log(prices[i] / prices[i - n]) / (vol * Math.sqrt(n)));
  return mean(zs);
}

export function realisedVol(prices, i, n = 21) {
  if (i < n) return null;
  const rets = [];
  for (let k = i - n + 1; k <= i; k += 1) rets.push(Math.log(prices[k] / prices[k - 1]));
  return std(rets) * Math.sqrt(252) * 100;
}

/** Equal-weighted index from members' close series aligned on dates. */
export function equalWeightIndex(members) {
  const dates = [...new Set(members.flatMap((m) => m.t))].sort();
  const maps = members.map((m) => new Map(m.t.map((d, i) => [d, m.c[i]])));
  const level = [100];
  const out = [{ date: dates[0], value: 100 }];
  const last = maps.map((m) => m.get(dates[0]) ?? null);
  for (let j = 1; j < dates.length; j += 1) {
    const rets = [];
    maps.forEach((m, k) => {
      const px = m.get(dates[j]);
      if (isNum(px) && isNum(last[k]) && last[k] > 0) rets.push(Math.max(-0.5, Math.min(0.5, px / last[k] - 1)));
      if (isNum(px)) last[k] = px;
    });
    const r = rets.length ? mean(rets) : 0;
    level.push(level.at(-1) * (1 + r));
    out.push({ date: dates[j], value: level.at(-1), n: rets.length });
  }
  return out;
}

export function rsi14(c, n = 14) {
  if (c.length < n + 2) return null;
  let gain = 0, loss = 0;
  for (let i = 1; i <= n; i += 1) { const d = c[i] - c[i - 1]; gain += Math.max(d, 0); loss += Math.max(-d, 0); }
  gain /= n; loss /= n;
  for (let i = n + 1; i < c.length; i += 1) { const d = c[i] - c[i - 1]; gain = (gain * (n - 1) + Math.max(d, 0)) / n; loss = (loss * (n - 1) + Math.max(-d, 0)) / n; }
  return round(100 - 100 / (1 + gain / (loss || 1e-9)), 1);
}

export function maxDrawdown(c) {
  let peak = -Infinity, worst = 0;
  for (const p of c) { peak = Math.max(peak, p); worst = Math.min(worst, p / peak - 1); }
  return round(worst * 100, 1);
}

export function stockPositioning(bar) {
  const c = bar.c, n = c.length - 1;
  if (n < 260) return null;
  const sma = (w) => mean(c.slice(n - w + 1, n + 1));
  const high252 = Math.max(...c.slice(n - 251));
  const momSeries = [];
  for (let i = Math.max(n - 504, 260); i <= n; i += 5) momSeries.push(momentumAt(c, i));
  return {
    momentum: round(momentumAt(c, n)),
    momentumPct: percentileOfLast(momSeries),
    vol21: round(realisedVol(c, n), 1),
    above50: c[n] > sma(50), above200: c[n] > sma(200),
    offHigh252Pct: round((c[n] / high252 - 1) * 100, 1),
    rsi14: rsi14(c.slice(-300)),
    return6mPct: round((c[n] / c[n - 126] - 1) * 100, 1),
    maxDrawdown1yPct: maxDrawdown(c.slice(n - 251)),
  };
}

export function industryPositioning(id, members) {
  const usable = members.filter((m) => m.t.length >= 260);
  if (usable.length < 3) return { id, members: usable.length, insufficient: true };
  const idx = equalWeightIndex(usable).filter((p) => p.n === undefined || p.n >= Math.ceil(usable.length * 0.6));
  const px = idx.map((p) => p.value);
  const n = px.length - 1;
  const mom = [], vol = [];
  for (let i = 260; i <= n; i += 1) { mom.push({ date: idx[i].date, v: momentumAt(px, i) }); vol.push({ date: idx[i].date, v: realisedVol(px, i) }); }
  const lastYearVol = vol.slice(-252).filter((x) => isNum(x.v));
  const lo = lastYearVol.reduce((a, b) => (b.v < a.v ? b : a), lastYearVol[0]);
  const hi = lastYearVol.reduce((a, b) => (b.v > a.v ? b : a), lastYearVol[0]);
  const high63 = Math.max(...px.slice(Math.max(0, n - 62)));
  const high252 = Math.max(...px.slice(Math.max(0, n - 251)));
  const stocks = usable.map((m) => stockPositioning(m)).filter(Boolean);
  const out = {
    id, members: usable.length, asOf: idx.at(-1).date,
    momentum: round(mom.at(-1)?.v), momentumPct: percentileOfLast(mom.map((x) => x.v)),
    vol21: round(vol.at(-1)?.v, 1), volPct1y: percentileOfLast(lastYearVol.map((x) => x.v)),
    volRange1y: lo && hi ? { low: round(lo.v, 1), lowDate: lo.date, high: round(hi.v, 1), highDate: hi.date } : null,
    drawdown3mPct: round((px[n] / high63 - 1) * 100, 1), drawdown1yPct: round((px[n] / high252 - 1) * 100, 1),
    return1mPct: round((px[n] / px[n - 21] - 1) * 100, 1), return3mPct: round((px[n] / px[n - 63] - 1) * 100, 1), return1yPct: round((px[n] / px[n - 252] - 1) * 100, 1),
    breadth200: round(stocks.filter((s) => s.above200).length / stocks.length * 100, 0),
    breadth50: round(stocks.filter((s) => s.above50).length / stocks.length * 100, 0),
    series: idx.slice(-504).filter((_, i, a) => i % 5 === 0 || i === a.length - 1).map((p) => [p.date, round(p.value, 2)]),
  };
  // De-risking flag: a sharp fall from the 3-month high with volatility near its 1-year top.
  out.regime = out.drawdown3mPct <= -15 && out.volPct1y >= 80 ? "de-risking"
    : out.momentum > 0.5 && out.breadth200 >= 60 ? "uptrend"
      : out.momentum < -0.5 && out.breadth200 <= 40 ? "downtrend" : "neutral";
  return out;
}

/** Health map axes: each a 0–100 percentile; higher is healthier for the industry. */
export function healthMap(ind, all, extra) {
  const rankAmong = (key, invert = false) => {
    const vals = all.map((x) => x[key]).filter(isNum);
    if (!isNum(ind[key]) || vals.length < 3) return null;
    const p = (vals.filter((v) => v <= ind[key]).length - 1) / (vals.length - 1) * 100;
    return round(invert ? 100 - p : p, 0);
  };
  return [
    { axis: "가격 모멘텀", value: ind.momentumPct, basis: "자기 2년 이력 대비 백분위" },
    { axis: "참여 폭", value: ind.breadth200, basis: "200일 이동평균 위 종목 비율(%)" },
    { axis: "안정성", value: isNum(ind.volPct1y) ? 100 - ind.volPct1y : null, basis: "100 − 변동성의 1년 백분위" },
    { axis: "매출 성장", value: rankAmong("observedGrowth"), basis: "추적 산업 간 관측 매출 성장 순위" },
    { axis: "자금 여력", value: isNum(extra.fcfPositiveShare) ? extra.fcfPositiveShare : null, basis: "FCF 플러스 기업 비율(%)" },
    { axis: "공매도 여유", value: rankAmong("shortMedian", true), basis: "산업 간 공매도 비율 역순위(미국 상장)" },
  ];
}

async function main() {
  const companies = JSON.parse(await readFile(resolve(DIR, "companies.json"), "utf8")).companies;
  const industries = JSON.parse(await readFile(resolve(DIR, "industries.json"), "utf8")).industries;
  let files = [];
  try { files = await readdir(resolve(DIR, "bars")); } catch { console.log(JSON.stringify({ tenbaggerPositioning: "skipped", reason: "no bars" })); return; }
  const bars = new Map();
  for (const f of files.filter((x) => x.endsWith(".json"))) {
    try { const b = JSON.parse(await readFile(resolve(DIR, "bars", f), "utf8")); if (b?.t?.length) bars.set(b.ticker, b); } catch { /* skip */ }
  }
  const byTicker = (t) => bars.get(t) || bars.get(t.replace(/^KOSDAQ:/, "KRX:")) || bars.get(t.replace(/^KRX:/, "KOSDAQ:"));
  const stocks = {};
  for (const c of companies) { const b = byTicker(c.ticker); const s = b && stockPositioning(b); if (s) stocks[c.id] = { ...s, shortPctFloat: c.shortInterest?.pctFloat ?? null }; }
  const rows = industries.map((i) => {
    const members = companies.filter((c) => c.industries.some((x) => x.id === i.id)).map((c) => byTicker(c.ticker)).filter(Boolean);
    const p = industryPositioning(i.id, members);
    const shorts = companies.filter((c) => c.industries.some((x) => x.id === i.id)).map((c) => c.shortInterest?.pctFloat).filter(isNum);
    return { ...p, name: i.name, observedGrowth: i.observed.medianRevenueGrowthPct, fcfPositiveShare: i.fcfPositiveShare, shortMedian: round(median(shorts), 1), shortN: shorts.length };
  });
  for (const r of rows) if (!r.insufficient) r.health = healthMap(r, rows.filter((x) => !x.insufficient), r);
  const out = {
    schemaVersion: "1.0", generatedAt: new Date().toISOString(),
    method: {
      index: "산업별 동일가중 지수 — 구성 종목의 일간 수정종가 수익률 평균(종목당 하루 ±50% 상한), 260거래일 이상 자료가 있는 종목만",
      momentum: "추세 추종 모멘텀 — 21·63·126·252일 로그수익률을 (126일 일간 변동성 × √기간)으로 나눈 z값의 평균. 0보다 크면 상승 추세",
      momentumPct: "모멘텀 값의 최근 2년 자기 이력 대비 백분위",
      volatility: "21일 실현 변동성(연율화)과 최근 1년 범위·백분위",
      breadth: "구성 종목 중 200일·50일 이동평균 위에 있는 비율",
      regime: "디리스킹: 3개월 고점 대비 −15% 이하 그리고 변동성 1년 백분위 80 이상 · 상승 추세: 모멘텀 > 0.5 그리고 참여 폭 ≥ 60% · 하락 추세: 모멘텀 < −0.5 그리고 참여 폭 ≤ 40%",
      shortInterest: "Yahoo Finance가 표시하는 유통주식 대비 공매도 비율(미국 상장, 월 2회 거래소 집계)",
      note: "모든 값은 이 사이트가 공개 가격·재무 자료로 직접 계산한 것입니다. 포지셔닝 지표는 상태 설명이며 매매 신호가 아닙니다.",
    },
    industries: rows, stocks,
  };
  await writeFile(resolve(DIR, "positioning.json.tmp"), `${JSON.stringify(out)}\n`);
  await rename(resolve(DIR, "positioning.json.tmp"), resolve(DIR, "positioning.json"));
  console.log(JSON.stringify({ tenbaggerPositioning: "written", industries: rows.filter((r) => !r.insufficient).length, stocks: Object.keys(stocks).length }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
