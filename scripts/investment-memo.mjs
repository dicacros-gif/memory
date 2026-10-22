/**
 * Investment committee memo.
 *
 * The console used to state its investment view in hand-written HTML stamped
 * with the month it was last checked. A reader could not tell which number had
 * moved since, and the view itself never changed when the data did.
 *
 * This derives the whole view from the verified crawl instead: memory spot and
 * contract prices, EDGAR quarters, TSMC monthly revenue, daily closes, HBM
 * share observations and verified claim events. The rules and thresholds live
 * in data/investment-memo-model.json, so a reviewer can audit why a stance was
 * reached, and every figure carries its source and date. When an input is
 * missing the factor drops out and conviction falls; when too little survives,
 * the memo withholds a stance rather than inventing one.
 */

import { isEditorialNewsItem } from "../assets/js/news-identity.js";

const DAY = 864e5;
const finite = (value) => (value === null || value === undefined || value === "" ? NaN : Number(value));
const isNum = (value) => Number.isFinite(finite(value));
const round = (value, digits = 1) => (isNum(value) ? Number(Number(value).toFixed(digits)) : null);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const mean = (values) => {
  const list = values.filter(isNum).map(Number);
  return list.length ? list.reduce((sum, value) => sum + value, 0) / list.length : null;
};
const median = (values) => {
  const list = values.filter(isNum).map(Number).sort((a, b) => a - b);
  if (!list.length) return null;
  const middle = Math.floor(list.length / 2);
  return list.length % 2 ? list[middle] : (list[middle - 1] + list[middle]) / 2;
};
const isoDay = (value) => {
  const time = typeof value === "number" ? value : Date.parse(value || "");
  return Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : null;
};
// Months and quarters are their own precision: "2026-09" must not become 9/1.
const stamp = (value) => {
  if (!value) return null;
  const text = String(value);
  return /^\d{4}-(?:\d{2}|Q[1-4])$/.test(text) ? text : isoDay(text) || text;
};
const signed = (value, unit = "%", digits = 1) => {
  if (!isNum(value)) return "—";
  const number = Number(value);
  const text = Math.abs(number) >= 100 ? Math.round(number).toLocaleString("en-US") : number.toFixed(digits);
  return `${number > 0 ? "+" : number < 0 ? "−" : ""}${text.replace(/^-/, "")}${unit}`;
};
const plain = (value, unit = "", digits = 1) => (isNum(value) ? `${Number(value).toFixed(digits)}${unit}` : "—");
// 억 = 1e8: USD 41.456bn reads as 414.6억$, the unit the rest of the site uses.
const usdEok = (value) => (isNum(value) ? `${(Number(value) / 1e8).toLocaleString("en-US", { maximumFractionDigits: 1 })}억$` : "—");
const ratioPct = (value) => (isNum(value) ? Number(value) * 100 : null);

// ── Daily closes ─────────────────────────────────────────────────────────────

function closes(index = {}) {
  return (index.points || [])
    .map((point) => (Array.isArray(point)
      ? { t: Number(point[0]), v: Number(point[1]) }
      : { t: Number(point.time ?? Date.parse(point.date)), v: Number(point.close ?? point.value) }))
    .filter((point) => Number.isFinite(point.t) && Number.isFinite(point.v) && point.v > 0)
    .sort((a, b) => a.t - b.t);
}

const back = (points, offset) => (points.length > offset ? points[points.length - 1 - offset].v : null);
const change = (points, offset) => {
  const start = back(points, offset);
  return isNum(start) ? (points.at(-1).v / start - 1) * 100 : null;
};
const movingAverage = (points, length) => (points.length >= length
  ? points.slice(-length).reduce((sum, point) => sum + point.v, 0) / length
  : null);
function maxDrawdown(points) {
  let peak = 0;
  let worst = 0;
  for (const point of points) {
    peak = Math.max(peak, point.v);
    worst = Math.min(worst, point.v / peak - 1);
  }
  return points.length ? worst * 100 : null;
}
function annualVolatility(points, length = 63) {
  const window = points.slice(-(length + 1));
  if (window.length < length) return null;
  const returns = window.slice(1).map((point, index) => Math.log(point.v / window[index].v));
  const average = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - average) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance * 252) * 100;
}

export function equityMetrics(index = {}, { now = Date.now(), maxLagDays = 7, minHistoryPoints = 210 } = {}) {
  const points = closes(index);
  if (!points.length) return { status: "missing" };
  const last = points.at(-1);
  const lagDays = (now - last.t) / DAY;
  const year = points.slice(-252);
  const high52 = Math.max(...year.map((point) => point.v));
  const ma50 = movingAverage(points, 50);
  const ma200 = movingAverage(points, 200);
  return {
    status: lagDays > maxLagDays ? "stale" : points.length < minHistoryPoints ? "short-history" : "ok",
    close: last.v,
    asOf: isoDay(last.t),
    lagDays: round(lagDays, 1),
    points: points.length,
    ret1m: round(change(points, 21)),
    ret3m: round(change(points, 63)),
    ret6m: round(change(points, 126)),
    ret1y: round(change(points, 252)),
    fromHigh52: round((last.v / high52 - 1) * 100),
    vsMa200: isNum(ma200) ? round((last.v / ma200 - 1) * 100) : null,
    ma50AboveMa200: isNum(ma50) && isNum(ma200) ? ma50 >= ma200 : null,
    volatility: round(annualVolatility(points)),
    maxDrawdown: round(maxDrawdown(points)),
    historyYears: round((last.t - points[0].t) / (365.25 * DAY), 1),
  };
}

// A trend reading per name. It describes the tape, not the company: the memo
// pairs it with the sector factors before anyone acts on it.
export function equitySignal(metrics = {}, thresholds = {}) {
  if (metrics.status === "missing" || metrics.status === "stale") {
    return { id: "hold", label: "데이터 지연", action: "판단 보류", tone: "neutral" };
  }
  if (metrics.status === "short-history" || !isNum(metrics.vsMa200)) {
    return { id: "watch", label: "상장 이력 부족", action: "관찰", tone: "neutral" };
  }
  const stretch = Number(metrics.vsMa200) / 100;
  if (stretch < 0 && metrics.ma50AboveMa200 === false) {
    return { id: "broken", label: "추세 이탈", action: "비중 축소 검토", tone: "negative" };
  }
  if (stretch >= Number(thresholds.overheatedStretch ?? 0.6) || Number(metrics.ret1m) / 100 >= Number(thresholds.overheatedMonth ?? 0.35)) {
    return { id: "overheated", label: "과열 구간", action: "차익 관리 · 신규 자제", tone: "caution" };
  }
  if (stretch >= 0 && Number(metrics.fromHigh52) / 100 <= Number(thresholds.pullbackFromHigh ?? -0.15)) {
    return { id: "pullback", label: "추세 내 조정", action: "분할 매수 후보", tone: "positive" };
  }
  if (stretch >= 0) return { id: "trend", label: "추세 유지", action: "보유", tone: "positive" };
  return { id: "weakening", label: "추세 약화", action: "관찰", tone: "caution" };
}

// ── Fundamental inputs ───────────────────────────────────────────────────────

function contractMomentum(priceHistory = {}, prefix, now) {
  const latest = Object.values(priceHistory.items || {})
    .filter((item) => String(item.sectionId || item.key || "").startsWith(prefix) && /contract/i.test(item.sectionId || item.key || ""))
    .map((item) => {
      const point = [...(item.points || [])].filter((row) => isNum(row.changePct)).sort((a, b) => Date.parse(a.date) - Date.parse(b.date)).at(-1);
      return point ? { changePct: Number(point.changePct), date: point.date, sourceUrl: item.sourceUrl } : null;
    })
    .filter(Boolean)
    .filter((row) => now - Date.parse(row.date) <= 75 * DAY);
  if (!latest.length) return null;
  const date = latest.map((row) => row.date).sort().at(-1);
  return {
    value: round(mean(latest.map((row) => row.changePct)), 2),
    count: latest.length,
    asOf: isoDay(date),
    sourceUrl: latest.find((row) => row.sourceUrl)?.sourceUrl || null,
  };
}

function spotMomentum(quant = {}) {
  const momentum = quant.memoryMomentum || {};
  const coverage = momentum.coverage || {};
  const covered = (key, value, minimumSpan) => (isNum(value) && Number(coverage[key]?.spanDays) >= minimumSpan ? Number(value) : null);
  return {
    dram30: covered("dram30", momentum.dramSpot30dPct, 20),
    dram90: covered("dram90", momentum.dramSpot90dPct, 75),
    nand30: covered("nand30", momentum.nandSpot30dPct, 20),
    nand90: covered("nand90", momentum.nandSpot90dPct, 75),
    asOf: momentum.asOf || null,
    source: momentum.source || "TrendForce 공개 가격표",
  };
}

function micronQuarters(quant = {}, now) {
  const micron = quant.fundamentals?.micron || {};
  const history = micron.history || {};
  const byDate = (rows = []) => new Map(rows.filter((row) => isNum(row.value) && row.date).map((row) => [row.date, row]));
  const revenue = byDate(history.revenue);
  const gross = byDate(history.grossProfit);
  const quarters = [...revenue.keys()].sort().map((date) => ({
    date,
    revenue: Number(revenue.get(date).value),
    grossMargin: gross.has(date) ? Number(gross.get(date).value) / Number(revenue.get(date).value) : null,
  }));
  if (!quarters.length) return null;
  const latest = quarters.at(-1);
  const prior = [...quarters].reverse().find((row) => {
    const gap = (Date.parse(latest.date) - Date.parse(row.date)) / DAY;
    return gap >= 60 && gap <= 130;
  });
  const yearAgo = quarters.find((row) => {
    const gap = (Date.parse(latest.date) - Date.parse(row.date)) / DAY;
    return gap >= 330 && gap <= 400;
  });
  const inventory = [...(history.inventory || [])].filter((row) => isNum(row.value) && row.date).sort((a, b) => a.date.localeCompare(b.date));
  const inventoryLatest = inventory.at(-1);
  const inventoryPrior = inventory.at(-2);
  return {
    quarterEnd: latest.date,
    ageDays: round((now - Date.parse(latest.date)) / DAY, 0),
    revenue: latest.revenue,
    revenueQoQ: prior ? round((latest.revenue / prior.revenue - 1) * 100) : null,
    revenueYoY: yearAgo ? round((latest.revenue / yearAgo.revenue - 1) * 100) : null,
    grossMargin: round(ratioPct(latest.grossMargin)),
    grossMarginQoQ: prior && isNum(latest.grossMargin) && isNum(prior.grossMargin)
      ? round((latest.grossMargin - prior.grossMargin) * 100)
      : null,
    inventory: inventoryLatest ? Number(inventoryLatest.value) : null,
    inventoryAsOf: inventoryLatest?.date || null,
    inventoryQoQ: inventoryLatest && inventoryPrior ? round((inventoryLatest.value / inventoryPrior.value - 1) * 100) : null,
    source: micron.source || "SEC EDGAR",
    sourceUrl: micron.sourceUrl || null,
    status: micron.status || null,
  };
}

function tsmcRevenue(quant = {}) {
  const monthly = quant.foundry?.tsmcMonthly || {};
  if (!isNum(monthly.yoyPct)) return null;
  const points = (monthly.revenueHistory?.points || []).filter((row) => isNum(row.value) && row.date);
  const valueAt = new Map(points.map((row) => [row.date, Number(row.value)]));
  const yoyFor = (month) => {
    const [year, number] = month.split("-").map(Number);
    const previous = `${year - 1}-${String(number).padStart(2, "0")}`;
    return valueAt.has(month) && valueAt.has(previous) ? (valueAt.get(month) / valueAt.get(previous) - 1) * 100 : null;
  };
  const recent = points.map((row) => row.date).sort().slice(-3);
  return {
    month: monthly.month || null,
    revenueBillionTwd: round(monthly.revenueBillionTwd, 1),
    yoy: round(monthly.yoyPct),
    mom: round(monthly.momPct),
    yoy3m: round(mean(recent.map(yoyFor))),
    source: "TSMC 월매출 공시 (TWSE)",
    sourceUrl: monthly.sourceUrl || monthly.revenueHistory?.sourceUrl || null,
  };
}

const ENTITY_LABEL = { skhynix: "SK hynix", "sk-hynix": "SK hynix", samsung: "Samsung", micron: "Micron" };

function hbmShares(quant = {}) {
  const observations = quant.decisionIntelligence?.metrics?.observations || [];
  const series = {};
  for (const row of observations) {
    if (row.metricId !== "hbm-revenue-share" || !isNum(row.value)) continue;
    (series[row.entityId] ||= new Map()).set(row.period, row);
  }
  const result = {};
  for (const [entity, rows] of Object.entries(series)) {
    const ordered = [...rows.values()].sort((a, b) => String(a.period).localeCompare(String(b.period)));
    const latest = ordered.at(-1);
    const prior = ordered.at(-2);
    result[entity] = {
      company: ENTITY_LABEL[entity] || latest.company,
      period: latest.period,
      value: Number(latest.value),
      priorPeriod: prior?.period || null,
      changePp: prior ? round(latest.value - prior.value) : null,
      trail: ordered.slice(-4).map((row) => ({ period: row.period, value: Number(row.value) })),
      source: latest.source,
      sourceUrl: latest.sourceUrl,
      publishedAt: latest.publishedAt,
    };
  }
  return result;
}

// ── Factor scoring ───────────────────────────────────────────────────────────

const evidence = (label, value, { detail = "", asOf = null, source = "", url = null, tone = "neutral" } = {}) => ({
  label, value, detail, asOf: stamp(asOf), source, url, tone,
});
const toneOf = (value, good = 0) => (!isNum(value) ? "neutral" : Number(value) > good ? "positive" : Number(value) < good ? "negative" : "neutral");

function scorePrice({ spot, dramContract, nandContract }) {
  const avg90 = mean([spot.dram90, spot.nand90]);
  const avg30 = mean([spot.dram30, spot.nand30]);
  const rows = [
    evidence("DRAM 현물 90일", signed(spot.dram90), { detail: `30일 ${signed(spot.dram30)}`, asOf: spot.asOf, source: spot.source, tone: toneOf(spot.dram90) }),
    evidence("NAND 현물 90일", signed(spot.nand90), { detail: `30일 ${signed(spot.nand30)}`, asOf: spot.asOf, source: spot.source, tone: toneOf(spot.nand90) }),
    evidence("DRAM 계약가 최근 월", signed(dramContract?.value, "%", 2), { detail: dramContract ? `${dramContract.count}개 품목 평균` : "최근 75일 공시 없음", asOf: dramContract?.asOf, source: "TrendForce 계약가", url: dramContract?.sourceUrl, tone: toneOf(dramContract?.value) }),
    evidence("NAND 계약가 최근 월", signed(nandContract?.value, "%", 2), { detail: nandContract ? `${nandContract.count}개 품목 평균` : "최근 75일 공시 없음", asOf: nandContract?.asOf, source: "TrendForce 계약가", url: nandContract?.sourceUrl, tone: toneOf(nandContract?.value) }),
  ];
  if (!isNum(avg90)) return { score: null, verdict: "가격 이력 부족", soWhat: "가격 요인 판단 보류", evidence: rows };
  let score = avg90 >= 15 ? 2 : avg90 >= 5 ? 1 : avg90 > -5 ? 0 : avg90 > -15 ? -1 : -2;
  const decelerating = isNum(avg30) && avg90 > 0 && avg30 * 3 < avg90 * 0.5;
  if (decelerating) score -= 1;
  if (isNum(avg30) && avg30 < 0) score = Math.min(score, 0);
  if (isNum(dramContract?.value) && dramContract.value < 0) score = Math.min(score, 0);
  score = clamp(score, -2, 2);
  const direction = avg90 >= 5 ? "상승" : avg90 <= -5 ? "하락" : "보합";
  const verdict = `현물가 90일 ${signed(avg90)} · 30일 ${signed(avg30)} → ${direction}${decelerating ? " 지속 · 속도 둔화" : direction === "보합" ? " 구간" : " 지속"}`;
  const soWhat = score >= 2
    ? "가격 상승이 이익 추정 상향을 지지 · 계약가 반영은 1~2분기 시차"
    : score === 1
      ? "가격은 우호적이나 상승 속도 둔화 · 다음 분기 계약가 상승 폭 축소 대비"
      : score === 0
        ? "가격 모멘텀 소진 · 이익 추정 상향 여지 제한"
        : "가격 하락 전환 · 이익 추정 하향 경로";
  return { score, verdict, soWhat, evidence: rows };
}

function scoreDemand({ tsmc, readThrough }) {
  const aiMedian90 = median(readThrough.map((row) => row.metrics.ret3m));
  const rows = [
    evidence("TSMC 월매출 YoY", signed(tsmc?.yoy), { detail: tsmc ? `${tsmc.month} · ${isNum(tsmc.revenueBillionTwd) ? Math.round(tsmc.revenueBillionTwd * 10).toLocaleString("en-US") : "—"}억 대만달러 · 3개월 평균 ${signed(tsmc.yoy3m)}` : "공시 없음", asOf: tsmc?.month, source: tsmc?.source, url: tsmc?.sourceUrl, tone: toneOf(tsmc?.yoy, 10) }),
    ...readThrough.map((row) => evidence(`${row.name} 3개월`, signed(row.metrics.ret3m), { detail: `1년 ${signed(row.metrics.ret1y)}`, asOf: row.metrics.asOf, source: "일별 종가", url: row.sourceUrl, tone: toneOf(row.metrics.ret3m) })),
  ];
  if (!isNum(tsmc?.yoy)) return { score: null, verdict: "AI 생산 공시 없음", soWhat: "수요 요인 판단 보류", evidence: rows };
  let score = tsmc.yoy >= 30 ? 2 : tsmc.yoy >= 10 ? 1 : tsmc.yoy >= 0 ? 0 : tsmc.yoy >= -10 ? -1 : -2;
  if (isNum(aiMedian90) && aiMedian90 <= -15) score -= 1;
  score = clamp(score, -2, 2);
  const verdict = `TSMC 월매출 YoY ${signed(tsmc.yoy)} · AI 칩 주가 3개월 중앙값 ${signed(aiMedian90)}`;
  const soWhat = score >= 2
    ? "AI 칩 생산 확대가 HBM·서버 DRAM 탑재 수요로 전이"
    : score === 1
      ? "AI 수요 증가 지속 · 성장률 둔화 여부 월별 점검"
      : score === 0
        ? "AI 수요 성장 정체 · 메모리 탑재량 증가에 의존"
        : "AI 칩 생산 둔화 · 메모리 수요 추정 하향 위험";
  return { score, verdict, soWhat, evidence: rows };
}

function scoreEarnings({ micron, staleDays }) {
  if (!micron) return { score: null, verdict: "공시 실적 없음", soWhat: "이익 요인 판단 보류", evidence: [], stale: false };
  const rows = [
    evidence("Micron 분기 매출", usdEok(micron.revenue), { detail: `QoQ ${signed(micron.revenueQoQ)} · YoY ${signed(micron.revenueYoY)}`, asOf: micron.quarterEnd, source: micron.source, url: micron.sourceUrl, tone: toneOf(micron.revenueQoQ) }),
    evidence("Micron 총이익률", plain(micron.grossMargin, "%"), { detail: `전분기 대비 ${signed(micron.grossMarginQoQ, "%p")}`, asOf: micron.quarterEnd, source: micron.source, url: micron.sourceUrl, tone: toneOf(micron.grossMarginQoQ) }),
    evidence("Micron 재고", usdEok(micron.inventory), { detail: `전분기 대비 ${signed(micron.inventoryQoQ)}`, asOf: micron.inventoryAsOf, source: micron.source, url: micron.sourceUrl, tone: isNum(micron.inventoryQoQ) && micron.inventoryQoQ > 10 ? "negative" : "neutral" }),
  ];
  let score;
  if (isNum(micron.grossMarginQoQ) && micron.grossMarginQoQ >= 2 && micron.revenueQoQ > 0) score = 2;
  else if (micron.revenueQoQ > 0 && !(micron.grossMarginQoQ < -1)) score = 1;
  else if (micron.revenueQoQ <= 0 && micron.grossMarginQoQ < -5) score = -2;
  else if (micron.revenueQoQ <= 0 && micron.grossMarginQoQ < 0) score = -1;
  else score = 0;
  if (isNum(micron.inventoryQoQ) && micron.inventoryQoQ > 20) score -= 1;
  score = clamp(score, -2, 2);
  const stale = Number(micron.ageDays) > Number(staleDays);
  const verdict = `Micron 매출 QoQ ${signed(micron.revenueQoQ)} · 총이익률 ${plain(micron.grossMargin, "%")} (${signed(micron.grossMarginQoQ, "%p")})${isNum(micron.inventoryQoQ) && micron.inventoryQoQ > 10 ? ` · 재고 ${signed(micron.inventoryQoQ)}` : ""}`;
  const soWhat = score >= 2
    ? "가격 상승이 마진으로 전이 중 · 이익 레벨 상향 국면"
    : score === 1
      ? "이익 증가 지속 · 재고와 마진 정점 여부가 다음 확인점"
      : score === 0
        ? "이익 정체 · 가격·물량 중 한 축의 개선 필요"
        : "이익 둔화 전환 · 추정치 하향 사이클 진입 위험";
  return { score, verdict, soWhat, evidence: rows, stale };
}

// Without multiples a deep drawdown is not evidence of cheapness: in memory
// the tape has historically turned before prices did. A stretched basket reads
// as crowded, a falling one as the market discounting the peak, and only a
// rebound after a drawdown earns credit.
function scorePositioning({ basket }) {
  const rows = [
    evidence("바스켓 200일선 대비", signed(basket.vsMa200), { detail: `${basket.count}개 종목 중앙값`, asOf: basket.asOf, source: "일별 종가", tone: isNum(basket.vsMa200) && basket.vsMa200 >= 20 ? "caution" : isNum(basket.vsMa200) && basket.vsMa200 < 0 ? "negative" : "neutral" }),
    evidence("바스켓 1개월 · 3개월", signed(basket.ret1m), { detail: `3개월 ${signed(basket.ret3m)} · 1년 ${signed(basket.ret1y)}`, asOf: basket.asOf, source: "일별 종가", tone: toneOf(basket.ret1m) }),
    evidence("바스켓 52주 고점 대비", signed(basket.fromHigh52), { detail: `1년 변동성 중앙값 ${plain(basket.volatility, "%", 0)}`, asOf: basket.asOf, source: "일별 종가", tone: isNum(basket.fromHigh52) && basket.fromHigh52 <= -15 ? "negative" : "neutral" }),
  ];
  if (!isNum(basket.vsMa200)) return { score: null, verdict: "주가 이력 부족", soWhat: "기대 반영 판단 보류", evidence: rows };
  const stretch = basket.vsMa200 / 100;
  const drawdown = Number(basket.fromHigh52);
  let score = 0;
  let reading = "주가와 추세 괴리 제한적";
  if (stretch >= 0.4) { score = -2; reading = "과열 · 기대 과다 선반영"; }
  else if (stretch >= 0.2) { score = -1; reading = "기대 일부 선반영"; }
  else if (drawdown <= -25 && Number(basket.ret1m) > 0) { score = 1; reading = "급락 후 반등 시도"; }
  else if (drawdown <= -25 && Number(basket.ret3m) <= -10) { score = -1; reading = "시장이 사이클 정점을 선반영 중"; }
  const verdict = `메모리 바스켓 52주 고점 대비 ${signed(basket.fromHigh52)} · 200일선 대비 ${signed(basket.vsMa200)} → ${reading}`;
  const soWhat = score <= -2
    ? "주가가 이익 개선을 상당 부분 선반영 · 추가 상승은 추정치 상향이 필요"
    : score === -1 && stretch < 0.2
      ? "주가가 펀더멘털보다 먼저 꺾임 · 가격 지표가 유지되면 괴리 해소 기회, 꺾이면 추가 하락"
      : score === -1
        ? "기대 일부 선반영 · 실적 확인 전 추격 매수 위험"
        : score === 1
          ? "급락 이후 매수세 유입 · 가격 지표 유지 확인 시 비중 확대 여지"
          : "주가와 펀더멘털 괴리 제한적";
  return { score, verdict, soWhat, evidence: rows, note: "멀티플 미수집 · 가격 위치를 기대 반영의 대용 지표로 사용" };
}

function scoreRisk({ quant, sox }) {
  const drivers = quant.scenarioCalibration?.drivers || {};
  const krw = quant.fx?.usdkrw || {};
  const rows = [
    evidence("중국 관련 검증 신호", plain(drivers.chinaPressure, "", 0), { detail: `이번 실행 근거 ${drivers.chinaEvidence ?? "—"}건 · 0~100`, asOf: quant.scenarioCalibration?.updatedAt, source: "검증 뉴스·현장 신호", tone: isNum(drivers.chinaPressure) && drivers.chinaPressure >= 40 ? "negative" : "neutral" }),
    evidence("USD/KRW 90일", signed(krw.changePct90d), { detail: `현재 ${plain(krw.value, "", 1)} · 원화 강세 시 한국 상장사 원화 이익 부담`, asOf: krw.asOf, source: "환율 일별", tone: isNum(krw.changePct90d) && krw.changePct90d <= -8 ? "negative" : "neutral" }),
    evidence("SOX 52주 고점 대비", signed(sox?.fromHigh52), { detail: `3개월 ${signed(sox?.ret3m)} · 참고 지표 (점수 미반영)`, asOf: sox?.asOf, source: "일별 종가", tone: isNum(sox?.fromHigh52) && sox.fromHigh52 <= -20 ? "negative" : "neutral" }),
  ];
  if (!isNum(drivers.chinaPressure) && !isNum(krw.changePct90d) && !isNum(sox?.fromHigh52)) {
    return { score: null, verdict: "위험 지표 없음", soWhat: "위험 요인 판단 보류", evidence: rows };
  }
  let score = 0;
  const notes = [];
  if (isNum(drivers.chinaPressure) && drivers.chinaPressure >= 60) { score -= 2; notes.push("중국 공급 신호 강함"); }
  else if (isNum(drivers.chinaPressure) && drivers.chinaPressure >= 40) { score -= 1; notes.push("중국 공급 신호 증가"); }
  else if (isNum(drivers.chinaPressure) && drivers.chinaPressure <= 15) score += 1;
  if (isNum(krw.changePct90d) && krw.changePct90d <= -8) { score -= 1; notes.push("원화 강세"); }
  score = clamp(score, -2, 1);
  const verdict = notes.length ? `${notes.join(" · ")} · 중국 신호 ${plain(drivers.chinaPressure, "", 0)}` : `중국 신호 ${plain(drivers.chinaPressure, "", 0)} · 환율 위험 제한적`;
  const soWhat = score < 0 ? "위험 프리미엄 상승 요인 · 비중 확대 폭 제한" : "외생 위험이 판단을 바꿀 수준 아님";
  return { score, verdict, soWhat, evidence: rows };
}

// Analyst estimates come from the OpenBB collector. Revisions lead reported
// earnings by a quarter or two, which is why the memo reads them separately
// from the EDGAR factor instead of folding them into it.
// Which consensus rows the upside median left out, and why. A median over
// targets set before a 50% move would score the move, not the analysts.
function withheldNote(estimates) {
  const used = estimates?.upsideCount ?? 0;
  const withheld = estimates?.targetsWithheld || [];
  const stale = withheld.filter((row) => row.status === "stale").length;
  const thin = withheld.filter((row) => row.status === "thin").length;
  const other = withheld.length - stale - thin;
  const parts = [`컨센서스 중앙값 · 사용 ${used}개 종목`];
  if (stale) parts.push(`목표가 범위 이탈 ${stale}개 제외`);
  if (thin) parts.push(`애널리스트 3명 미만 ${thin}개 제외`);
  if (other) parts.push(`통화 불일치 ${other}개 제외`);
  if (!isNum(estimates?.upsideMedian) && used < 3) parts.push("사용 가능 3개 미만 · 점수 미반영");
  return parts.join(" · ");
}

function scoreEstimates({ estimates }) {
  const rows = [
    evidence("EPS 추정치 90일 변화", signed(estimates?.rev90Median), { detail: `30일 ${signed(estimates?.rev30Median)} · 바스켓 중앙값`, asOf: estimates?.asOf, source: "OpenBB · yfinance", tone: toneOf(estimates?.rev90Median) }),
    evidence("목표가 상승여력", signed(estimates?.upsideMedian), {
      detail: withheldNote(estimates),
      asOf: estimates?.asOf,
      source: "OpenBB · yfinance",
      tone: toneOf(estimates?.upsideMedian),
    }),
    evidence("투자의견 평균", plain(estimates?.recommendationMedian, "", 2), { detail: "1 Strong Buy ~ 5 Strong Sell", asOf: estimates?.asOf, source: "OpenBB · yfinance" }),
  ];
  // Scored on the EPS revision alone: it is dated (today vs 30 and 90 days
  // ago), so it cannot be stale. A target price carries no date and lags the
  // tape after a large move; it is shown as context and never scored, so a
  // fraction of a percent in one quote cannot flip the call.
  if (!estimates || Number(estimates.count) < 3 || !isNum(estimates.rev90Median)) {
    return { score: null, verdict: "추정치 수집 전", soWhat: "추정치 요인 판단 보류 · 다음 수집 후 반영", evidence: rows };
  }
  const revision = Number(estimates.rev90Median);
  const score = revision >= 10 ? 2 : revision >= 3 ? 1 : revision > -3 ? 0 : revision > -10 ? -1 : -2;
  const verdict = `EPS 추정치 90일 ${signed(estimates.rev90Median)} · 목표가 상승여력 ${isNum(estimates.upsideMedian) ? signed(estimates.upsideMedian) : "판단 제외 (컨센서스 갱신 지연)"}`;
  const soWhat = score >= 2
    ? "추정치 큰 폭 상향 · 이익 사이클 연장 신호"
    : score === 1
      ? "추정치 상향 지속 · 상승 속도 둔화 여부 점검"
      : score === 0
        ? "추정치 정체 · 실적 발표에서 방향 확인 필요"
        : "추정치 하향 전환 · 이익 정점 통과 가능성";
  return { score, verdict, soWhat, evidence: rows };
}

// ── Kill criteria ────────────────────────────────────────────────────────────

function killStatus(rule, value) {
  if (!isNum(value)) return "unknown";
  const breached = (threshold) => (rule.direction === "above" ? value >= threshold : value <= threshold);
  if (breached(Number(rule.kill))) return "kill";
  if (rule.direction === "above" ? value > Number(rule.warn) : value < Number(rule.warn)) return "warn";
  return "ok";
}

const STATUS_LABEL = { ok: "정상", warn: "경고", kill: "폐기 조건", unknown: "데이터 없음" };

function buildKillCriteria(rules = [], inputs = {}) {
  const readings = {
    "dram-spot-30d": { value: inputs.spot.dram30, asOf: inputs.spot.asOf, source: inputs.spot.source },
    "nand-spot-30d": { value: inputs.spot.nand30, asOf: inputs.spot.asOf, source: inputs.spot.source },
    "dram-contract-mom": { value: inputs.dramContract?.value, asOf: inputs.dramContract?.asOf, source: "TrendForce 계약가", url: inputs.dramContract?.sourceUrl },
    "micron-gm-qoq": { value: inputs.micron?.grossMarginQoQ, asOf: inputs.micron?.quarterEnd, source: inputs.micron?.source, url: inputs.micron?.sourceUrl },
    "micron-inventory-qoq": { value: inputs.micron?.inventoryQoQ, asOf: inputs.micron?.inventoryAsOf, source: inputs.micron?.source, url: inputs.micron?.sourceUrl },
    "tsmc-revenue-yoy": { value: inputs.tsmc?.yoy, asOf: inputs.tsmc?.month, source: inputs.tsmc?.source, url: inputs.tsmc?.sourceUrl },
    "hbm-share-qoq": { value: inputs.hbm?.skhynix?.changePp, asOf: inputs.hbm?.skhynix?.period, source: inputs.hbm?.skhynix?.source, url: inputs.hbm?.skhynix?.sourceUrl },
    "basket-drawdown": { value: inputs.basket.fromHigh52, asOf: inputs.basket.asOf, source: "일별 종가" },
    "eps-revision-90d": { value: Number(inputs.estimates?.count) >= 3 ? inputs.estimates?.rev90Median : null, asOf: inputs.estimates?.asOf, source: "OpenBB · yfinance" },
  };
  return rules.map((rule) => {
    const reading = readings[rule.id] || {};
    const status = killStatus(rule, finite(reading.value));
    const unit = rule.unit || "";
    return {
      id: rule.id,
      label: rule.label,
      value: isNum(reading.value) ? Number(reading.value) : null,
      display: isNum(reading.value) ? signed(reading.value, unit, unit === "%p" ? 1 : 1) : "—",
      warn: `${rule.direction === "above" ? ">" : "<"} ${signed(rule.warn, unit, 0)}`,
      kill: `${rule.direction === "above" ? "≥" : "≤"} ${signed(rule.kill, unit, 0)}`,
      status,
      statusLabel: STATUS_LABEL[status],
      rationale: rule.rationale,
      asOf: stamp(reading.asOf),
      source: reading.source || "",
      url: reading.url || null,
    };
  });
}

// ── Assembly ─────────────────────────────────────────────────────────────────

const STANCES = {
  overweight: { id: "overweight", label: "비중확대", labelEn: "Overweight" },
  neutral: { id: "neutral", label: "중립", labelEn: "Neutral" },
  underweight: { id: "underweight", label: "비중축소", labelEn: "Underweight" },
  withheld: { id: "withheld", label: "판단 보류", labelEn: "Withheld" },
};
const STANCE_ORDER = ["underweight", "neutral", "overweight"];

// Fundamentals here means the three factors read from prices, production and
// filings; the tape is read separately. When they disagree the memo says which
// observation would settle it instead of averaging the disagreement away.
function tacticFor(stance, scores = {}) {
  const fundamentals = [scores.price, scores.demand, scores.earnings].filter(isNum);
  const fundamentalsPositive = fundamentals.length >= 2 && fundamentals.every((score) => score >= 0) && fundamentals.some((score) => score > 0);
  const fundamentalsNegative = fundamentals.length >= 2 && fundamentals.filter((score) => score < 0).length >= 2;
  const tape = scores.positioning;
  if (stance === "withheld") return "데이터 복구 후 재평가 · 기존 포지션 유지";
  if (fundamentalsPositive && isNum(tape) && tape < 0) {
    return "펀더멘털 우호 · 주가는 정점 선반영 → 계약가·마진 유지 확인 시 분할 확대 · 현물가 하락 전환 시 축소";
  }
  if (fundamentalsNegative && isNum(tape) && tape > 0) {
    return "주가 반등 · 펀더멘털 둔화 → 반등 시 비중 축소 · 재고 감소 확인 전 신규 자제";
  }
  if (stance === "underweight") return "비중 축소 · 재고와 가격 반등 확인 전 신규 매수 자제";
  if (stance === "neutral") return "벤치마크 비중 유지 · 경고 지표 해소 시 확대 검토";
  return isNum(tape) && tape <= -1
    ? "보유 유지 · 신규 진입은 조정 시 분할 · 과열 종목 차익 관리"
    : "비중 확대 실행 · 추세 유지 종목 우선";
}

function scenarioProbabilities(composite, kills, warns) {
  const tilt = isNum(composite) ? composite * 12 : 0;
  const pressure = kills * 5 + warns * 2;
  let bull = clamp(Math.round(25 + tilt - pressure), 10, 55);
  let bear = clamp(Math.round(25 - tilt + pressure), 10, 55);
  const base = 100 - bull - bear;
  return { bull, base, bear };
}

function catalystsFrom(quant = {}, limit = 8) {
  const decision = quant.decisionIntelligence || {};
  const priority = { immediate: 0, quarterly: 1 };
  const byDocument = new Map();
  for (const item of decision.eventTriggers || []) {
    const title = String(item.title || "").replace(/\s+[–-]\s+[^–-]+$/u, "").trim();
    if (!item.url || title.length < 12 || title === item.source) continue;
    const key = item.url;
    const current = byDocument.get(key);
    if (current) {
      if (!current.labels.includes(item.label)) current.labels.push(item.label);
      if ((priority[item.priority] ?? 2) < (priority[current.priority] ?? 2)) current.priority = item.priority;
      continue;
    }
    byDocument.set(key, { ...item, title, labels: [item.label] });
  }
  return [...byDocument.values()]
    .sort((a, b) => String(b.publishedAt || "").localeCompare(String(a.publishedAt || "")) || (priority[a.priority] ?? 2) - (priority[b.priority] ?? 2))
    .slice(0, limit)
    .map((item) => ({
      date: item.publishedAt || null,
      label: item.labels.join(" · "),
      title: item.title,
      source: item.source,
      sourceClass: item.sourceClass,
      url: item.url,
      priority: item.priority === "immediate" ? "즉시 반영" : item.priority === "quarterly" ? "분기 점검" : "모니터링",
    }));
}

const STAGE_LABEL = {
  ANNOUNCED: "발표",
  SAMPLE: "샘플",
  QUALIFICATION: "인증",
  MASS_PRODUCTION: "양산",
  COMMERCIAL_SHIPMENT: "출하",
  PLATFORM_ADOPTION: "플랫폼 채택",
  REVENUE: "매출 반영",
};

function productStages(quant = {}, limit = 8) {
  const events = quant.decisionIntelligence?.claimEvents?.events || [];
  const best = new Map();
  for (const event of events) {
    if (!event.entity?.label || !event.product?.label || !STAGE_LABEL[event.stage?.id]) continue;
    if (event.isCurrentStage === false || event.contradictionStatus === "contradicted") continue;
    if (!/memory|hbm|dram|nand|ssd|hbf|socamm|cxl|lpddr|gddr/i.test(`${event.product.id} ${event.product.label}`)) continue;
    const key = `${event.entity.label}::${event.product.label}`;
    const current = best.get(key);
    const rank = Number(event.stage.rank) || 0;
    if (!current || rank > current.rank || (rank === current.rank && String(event.publishedAt) > String(current.date))) {
      best.set(key, {
        entity: event.entity.label,
        product: event.product.label,
        stage: STAGE_LABEL[event.stage.id],
        rank,
        confidence: event.confidence === "confirmed-primary" ? "1차 확인" : "리서치 관측",
        date: event.publishedAt || null,
        source: event.source,
        url: event.sourceUrl,
      });
    }
  }
  return [...best.values()].sort((a, b) => b.rank - a.rank || String(b.date).localeCompare(String(a.date))).slice(0, limit);
}

function newsFor(news = [], categories = [], limit = 3) {
  return news
    .filter((item) => categories.includes(item.category) && isEditorialNewsItem(item))
    .filter((item) => !item.verification?.sourceClass || ["official", "research", "authoritative-media"].includes(item.verification.sourceClass))
    .filter((item) => !/\b(?:save|deal|deals|discount|coupon|bundle|lowest price)\b|절약하세요|할인/iu.test(`${item.originalTitle || ""} ${item.title || ""} ${item.titleKo || ""}`))
    .filter((item) => item.translation?.title?.status !== "unverified")
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
    .slice(0, limit)
    .map((item) => ({
      titleKo: item.titleKo || item.title,
      originalTitle: item.originalTitle || item.title,
      source: item.source,
      url: item.sourceUrl,
      date: item.date || null,
    }));
}

function demandForecasts(quant = {}) {
  const labels = { hyperscaler: "AI 가속기 출하", mobile: "스마트폰 출하", pc: "PC 출하", auto: "자동차 생산", datacenter: "데이터센터" };
  const units = { hyperscaler: "백만 대", mobile: "백만 대", pc: "백만 대", auto: "백만 대", datacenter: "GW" };
  return Object.entries(quant.forecastInputs?.categories || {})
    .map(([id, category]) => ({ id, row: category.units }))
    .filter(({ row }) => row && row.sourceValueVerified === true && isNum(row.value))
    .map(({ id, row }) => evidence(`${labels[id] || id} ${row.period || ""}`.trim(), `${Number(row.value).toLocaleString("en-US")} ${units[id] || ""}`.trim(), {
      detail: "3자 전망 · 원문 수치 대조 완료",
      asOf: row.asOf,
      source: row.source,
      url: row.sourceUrl,
    }));
}

// Landing-page market read: the four listing markets and the value-chain
// stages, recomputed from the same closes as the memo instead of a static
// description of what each market contains.
const LISTING_MARKET = (exchange = "") => {
  const text = String(exchange).toUpperCase();
  if (text.startsWith("KRX") || text === "KSC" || text === "KOE") return "korea";
  if (text.startsWith("TSE") || text === "JPX") return "japan";
  if (/^(SSE|SZSE|SHH|SHZ)/.test(text)) return "china";
  if (/^(NASDAQ|NYSE|NMS|NYQ|NGM|NCM|ASE|PCX)/.test(text)) return "us";
  return "other";
};
const CHAIN_STAGES = [
  { id: "design", label: "설계", chains: ["ai-chip", "design-ip"] },
  { id: "manufacturing", label: "제조", chains: ["materials", "equipment", "foundry"] },
  { id: "integration", label: "통합", chains: ["memory", "packaging"] },
  { id: "connectivity", label: "연결", chains: ["interconnect", "substrates"] },
  { id: "systems", label: "시스템", chains: ["infrastructure", "analog-power"] },
];

function marketSummary(indexes = {}, options = {}) {
  const rows = Object.values(indexes)
    .filter((index) => !String(index.symbol || "").startsWith("^"))
    .map((index) => ({ index, metrics: equityMetrics(index, options) }))
    .filter((row) => row.metrics.status === "ok" || row.metrics.status === "short-history");
  const describe = (group) => {
    const ranked = group.filter((row) => isNum(row.metrics.ret1y)).sort((a, b) => b.metrics.ret1y - a.metrics.ret1y);
    const name = (row) => (row ? { name: row.index.shortName || row.index.label, ret1y: row.metrics.ret1y } : null);
    return {
      count: group.length,
      advancing: group.filter((row) => Number(row.metrics.ret1m) > 0).length,
      ret1m: round(median(group.map((row) => row.metrics.ret1m))),
      ret1y: round(median(group.map((row) => row.metrics.ret1y))),
      fromHigh52: round(median(group.map((row) => row.metrics.fromHigh52))),
      leader: name(ranked[0]),
      laggard: name(ranked.at(-1)),
    };
  };
  const markets = Object.fromEntries(["us", "korea", "china", "japan"].map((id) => [id, describe(rows.filter((row) => LISTING_MARKET(row.index.exchange || row.index.exchangeName) === id))]));
  const stages = CHAIN_STAGES.map((stage) => ({ id: stage.id, label: stage.label, ...describe(rows.filter((row) => stage.chains.includes(row.index.valueChain))) }));
  return { markets, stages, asOf: rows.map((row) => row.metrics.asOf).sort().at(-1) || null };
}

export function buildInvestmentMemo({
  quant = {},
  marketHistory = {},
  priceHistory = {},
  news = [],
  estimates = null,
  model = {},
  previous = null,
  runId = null,
  now = new Date(),
} = {}) {
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now) || Date.now();
  const thresholds = model.thresholds || {};
  const indexes = marketHistory.indexes || {};
  const metricOptions = { now: nowMs, maxLagDays: thresholds.maxPriceLagDays ?? 7, minHistoryPoints: thresholds.minHistoryPoints ?? 210 };
  const coverageRows = (model.universe || []).map((entry) => {
    const index = indexes[entry.id];
    const metrics = index ? equityMetrics(index, metricOptions) : { status: "missing" };
    return {
      id: entry.id,
      name: entry.name,
      role: entry.role,
      exposure: entry.exposure,
      driver: entry.driver,
      basket: entry.basket === true,
      market: index?.exchange || index?.exchangeName || "",
      currency: index?.currency || "",
      symbol: index?.symbol || "",
      sourceUrl: index?.sourceUrl || null,
      metrics,
      signal: equitySignal(metrics, thresholds),
    };
  });
  const basketRows = coverageRows.filter((row) => row.basket && row.metrics.status === "ok");
  const basket = {
    count: basketRows.length,
    names: basketRows.map((row) => row.name),
    asOf: basketRows.map((row) => row.metrics.asOf).sort().at(-1) || null,
    vsMa200: round(median(basketRows.map((row) => row.metrics.vsMa200))),
    ret1y: round(median(basketRows.map((row) => row.metrics.ret1y))),
    ret3m: round(median(basketRows.map((row) => row.metrics.ret3m))),
    ret1m: round(median(basketRows.map((row) => row.metrics.ret1m))),
    fromHigh52: round(median(basketRows.map((row) => row.metrics.fromHigh52))),
    volatility: round(median(basketRows.map((row) => row.metrics.volatility))),
    maxDrawdown: round(median(basketRows.map((row) => row.metrics.maxDrawdown))),
  };
  const benchmarkRows = (model.benchmarks || []).map((entry) => ({
    id: entry.id,
    name: entry.name,
    role: entry.role,
    sourceUrl: indexes[entry.id]?.sourceUrl || null,
    metrics: indexes[entry.id] ? equityMetrics(indexes[entry.id], metricOptions) : { status: "missing" },
  }));
  const sox = benchmarkRows.find((row) => row.id === "sox")?.metrics;
  for (const row of coverageRows) {
    row.metrics.vsSox3m = isNum(row.metrics.ret3m) && isNum(sox?.ret3m) ? round(row.metrics.ret3m - sox.ret3m) : null;
  }
  const readThrough = (model.demandReadThrough || [])
    .map((id) => ({ id, index: indexes[id] }))
    .filter(({ index }) => index)
    .map(({ id, index }) => ({ id, name: index.shortName || index.label, sourceUrl: index.sourceUrl, metrics: equityMetrics(index, metricOptions) }))
    .filter((row) => row.metrics.status === "ok");

  const spot = spotMomentum(quant);
  const dramContract = contractMomentum(priceHistory, "dram-", nowMs);
  const nandContract = contractMomentum(priceHistory, "nand-", nowMs);
  const micron = micronQuarters(quant, nowMs);
  const tsmc = tsmcRevenue(quant);
  const hbm = hbmShares(quant);

  const factorConfig = model.factors || {};
  const scored = {
    price: scorePrice({ spot, dramContract, nandContract }),
    demand: scoreDemand({ tsmc, readThrough }),
    earnings: scoreEarnings({ micron, staleDays: thresholds.staleQuarterDays ?? 120 }),
    estimates: scoreEstimates({ estimates }),
    positioning: scorePositioning({ basket }),
    risk: scoreRisk({ quant, sox }),
  };
  const factors = Object.entries(factorConfig).map(([id, config]) => {
    const result = scored[id] || { score: null, verdict: "규칙 없음", soWhat: "", evidence: [] };
    return {
      id,
      label: config.label,
      weight: Number(config.weight) || 0,
      score: isNum(result.score) ? Number(result.score) : null,
      weighted: isNum(result.score) ? round(Number(result.score) * Number(config.weight), 2) : null,
      verdict: result.verdict,
      soWhat: result.soWhat,
      note: result.note || (result.stale ? `최근 공시 분기 ${micron?.quarterEnd} 종료 · 다음 공시 전까지 확신도 제한` : ""),
      stale: result.stale === true,
      evidence: result.evidence,
    };
  });
  const available = factors.filter((factor) => factor.score !== null);
  const coverageWeight = available.reduce((sum, factor) => sum + factor.weight, 0);
  const totalWeight = factors.reduce((sum, factor) => sum + factor.weight, 0) || 1;
  const coverage = coverageWeight / totalWeight;
  const composite = coverageWeight
    ? round(available.reduce((sum, factor) => sum + factor.score * factor.weight, 0) / coverageWeight, 2)
    : null;

  const killCriteria = buildKillCriteria(model.killCriteria || [], { spot, dramContract, micron, tsmc, hbm, basket, estimates });
  const kills = killCriteria.filter((row) => row.status === "kill").length;
  const warns = killCriteria.filter((row) => row.status === "warn").length;

  const stanceRules = model.stance || {};
  let stanceId;
  let override = "";
  if (!isNum(composite) || coverage < Number(stanceRules.minimumCoverage ?? 0.6)) stanceId = "withheld";
  else if (composite >= Number(stanceRules.overweight ?? 0.75)) stanceId = "overweight";
  else if (composite <= Number(stanceRules.underweight ?? -0.75)) stanceId = "underweight";
  else stanceId = "neutral";
  if (stanceId !== "withheld" && kills >= 2) {
    const lowered = STANCE_ORDER[Math.max(0, STANCE_ORDER.indexOf(stanceId) - 1)];
    if (lowered !== stanceId) override = `논지 폐기 조건 ${kills}개 충족 → ${STANCES[stanceId].label}에서 한 단계 하향`;
    stanceId = lowered;
  }
  const earningsStale = factors.some((factor) => factor.stale);
  // How far the score sits from the nearest stance boundary, so a reader sees
  // whether the call is settled or one observation away from flipping.
  const upper = Number(stanceRules.overweight ?? 0.75);
  const lower = Number(stanceRules.underweight ?? -0.75);
  const threshold = !isNum(composite) ? null : composite >= upper
    ? { label: "중립 하향까지", distance: round(composite - upper, 2) }
    : composite <= lower
      ? { label: "중립 상향까지", distance: round(lower - composite, 2) }
      : upper - composite <= composite - lower
        ? { label: "비중확대까지", distance: round(upper - composite, 2) }
        : { label: "비중축소까지", distance: round(composite - lower, 2) };
  let convictionId;
  if (stanceId === "withheld" || coverage < 1 || kills > 0 || warns >= 3) convictionId = "low";
  else if (Math.abs(composite) >= Number(stanceRules.highConviction ?? 1.25) && warns <= 1 && !earningsStale) convictionId = "high";
  else convictionId = "medium";
  const conviction = { id: convictionId, label: { high: "높음", medium: "중간", low: "낮음" }[convictionId] };

  const positive = available.filter((factor) => factor.score > 0).sort((a, b) => b.score * b.weight - a.score * a.weight);
  const negative = available.filter((factor) => factor.score < 0).sort((a, b) => a.score * a.weight - b.score * b.weight);
  const stance = STANCES[stanceId];
  const sector = model.sector || "메모리 업종";
  const summaryParts = [];
  if (positive.length) summaryParts.push(`우호 ${positive.map((factor) => factor.label).join(", ")}`);
  if (negative.length) summaryParts.push(`부담 ${negative.map((factor) => factor.label).join(", ")}`);
  if (warns || kills) summaryParts.push(`점검 지표 경고 ${warns}개${kills ? ` · 폐기 조건 ${kills}개` : ""}`);
  // Pyramid order: the two strongest supports, then the strongest objection,
  // so the summary never reads as one-sided when the scorecard is not.
  const supports = stanceId === "underweight" ? negative : positive;
  const objections = stanceId === "underweight" ? positive : negative;
  const keyMessages = [...supports.slice(0, objections.length ? 2 : 3), ...objections.slice(0, 1)]
    .map((factor) => ({ id: factor.id, label: factor.label, score: factor.score, verdict: factor.verdict, soWhat: factor.soWhat }));

  const probabilities = scenarioProbabilities(composite, kills, warns);
  const byKill = new Map(killCriteria.map((row) => [row.id, row]));
  const scenarioReference = {
    bull: `바스켓 52주 고점 대비 ${signed(basket.fromHigh52)} · 1년 ${signed(basket.ret1y)}`,
    base: `현물가 30일 DRAM ${signed(spot.dram30)} · NAND ${signed(spot.nand30)}`,
    bear: `바스켓 5년 최대 낙폭 중앙값 ${signed(basket.maxDrawdown)} · 하방 크기 참고`,
  };
  const scenarios = (model.scenarios || []).map((scenario) => ({
    id: scenario.id,
    label: scenario.label,
    title: scenario.title,
    probability: probabilities[scenario.id] ?? null,
    reference: scenarioReference[scenario.id] || "",
    watch: (scenario.watch || []).map((id) => byKill.get(id)).filter(Boolean).map((row) => ({
      id: row.id, label: row.label, display: row.display, status: row.status, statusLabel: row.statusLabel,
    })),
  }));

  const asOf = [spot.asOf, basket.asOf, sox?.asOf].filter(Boolean).sort().at(-1) || isoDay(nowMs);
  const entry = { asOf, composite, stance: stance.id, conviction: conviction.id, kills, warns };
  const priorHistory = Array.isArray(previous?.history) ? previous.history : [];
  const history = [...priorHistory.filter((row) => row && row.asOf && row.asOf !== asOf), entry]
    .sort((a, b) => String(a.asOf).localeCompare(String(b.asOf)))
    .slice(-90);
  const prior = [...priorHistory].filter((row) => row.asOf && row.asOf < asOf).sort((a, b) => String(a.asOf).localeCompare(String(b.asOf))).at(-1) || null;
  const changes = [];
  if (prior) {
    if (prior.stance !== stance.id) changes.push(`투자 의견 ${STANCES[prior.stance]?.label || prior.stance} → ${stance.label}`);
    if (isNum(prior.composite) && isNum(composite) && Math.abs(composite - prior.composite) >= 0.05) {
      changes.push(`종합 점수 ${signed(prior.composite, "", 2)} → ${signed(composite, "", 2)}`);
    }
    if (Number(prior.warns) !== warns || Number(prior.kills) !== kills) {
      changes.push(`경고 ${prior.warns ?? 0} → ${warns}개 · 폐기 조건 ${prior.kills ?? 0} → ${kills}개`);
    }
  }
  const previousFactors = new Map((previous?.factors || []).map((factor) => [factor.id, factor]));
  for (const factor of factors) {
    const before = previousFactors.get(factor.id);
    if (before && isNum(before.score) && isNum(factor.score) && before.score !== factor.score) {
      changes.push(`${factor.label} ${signed(before.score, "", 0)} → ${signed(factor.score, "", 0)}`);
    }
  }
  const direction = !prior ? "new" : !isNum(prior.composite) || !isNum(composite) ? "flat"
    : composite - prior.composite >= 0.05 ? "up" : prior.composite - composite >= 0.05 ? "down" : "flat";

  const categories = model.ledgerNewsCategories || {};
  const ledgers = {
    demand: [
      { id: "foundry", title: "AI 칩 생산 · 공식 월매출", rows: [scored.demand.evidence[0]] },
      { id: "accelerators", title: "AI 수요 선행 주가", rows: scored.demand.evidence.slice(1) },
      { id: "earnings", title: "메모리 실적 전환 · EDGAR", rows: scored.earnings.evidence },
      { id: "estimates", title: "애널리스트 추정치 · OpenBB", rows: scored.estimates.evidence },
      { id: "forecasts", title: "검증된 3자 수요 전망", rows: demandForecasts(quant) },
    ],
    technology: [
      {
        id: "hbm-share",
        title: "HBM 매출 점유율 추이",
        rows: Object.values(hbm).sort((a, b) => b.value - a.value).map((row) => evidence(`${row.company} ${row.period}`, `${row.value}%`, {
          detail: `${row.priorPeriod || "직전"} 대비 ${signed(row.changePp, "%p")} · ${row.trail.map((point) => `${point.period.replace(/^20/, "'")} ${point.value}%`).join(" → ")}`,
          asOf: row.publishedAt,
          source: row.source,
          url: row.sourceUrl,
          tone: toneOf(row.changePp),
        })),
      },
      {
        id: "stages",
        title: "제품 단계 · 검증 이벤트 기준",
        rows: productStages(quant).map((row) => evidence(`${row.entity} ${row.product}`, row.stage, {
          detail: row.confidence,
          asOf: row.date,
          source: row.source,
          url: row.url,
          tone: row.rank >= 70 ? "positive" : "neutral",
        })),
      },
    ],
    risk: [
      { id: "prices", title: "메모리 가격 경로", rows: scored.price.evidence },
      { id: "supply", title: "공급 · 재고", rows: scored.earnings.evidence.slice(2) },
      { id: "macro", title: "중국 · 환율 · 지수", rows: scored.risk.evidence },
    ],
  };
  const ledgerNews = Object.fromEntries(Object.entries(categories).map(([id, list]) => [id, newsFor(news, list)]));

  const funnel = quant.decisionIntelligence?.decisionAutomation?.funnel || {};
  const sources = quant.decisionIntelligence?.decisionAutomation?.sourceOperations || {};
  return {
    schemaVersion: "1.0",
    clientArtifact: true,
    runId,
    generatedAt: new Date(nowMs).toISOString(),
    market: marketSummary(indexes, metricOptions),
    evidence: {
      newsPromoted: news.length,
      sourceDocuments: funnel.sourceDocuments ?? null,
      verifiedEvents: funnel.verifiedEvents ?? null,
      decisionReadyBriefs: funnel.decisionReadyBriefs ?? null,
      sourcesConfigured: sources.configured ?? null,
      sourcesObserved: sources.observed ?? null,
      kills: killCriteria.filter((row) => row.status === "kill").length,
      warns: killCriteria.filter((row) => row.status === "warn").length,
      memoryDram30: spot.dram30,
      memoryNand30: spot.nand30,
      sox: sox ? { last: sox.close, ret1m: sox.ret1m, fromHigh52: sox.fromHigh52, asOf: sox.asOf } : null,
    },
    expiresAt: quant.expiresAt || null,
    asOf,
    modelVersion: model.modelVersion || null,
    verdict: {
      sector,
      stance,
      composite,
      conviction,
      coverage: round(coverage * 100, 0),
      headline: `${sector} ${stance.label}`,
      summary: summaryParts.join(" / "),
      tactic: tacticFor(stance.id, Object.fromEntries(Object.entries(scored).map(([id, result]) => [id, result.score]))),
      threshold: override ? null : threshold,
      override,
      keyMessages,
      change: { direction, prior, items: changes.slice(0, 6) },
    },
    factors,
    coverage: {
      basket,
      benchmarks: benchmarkRows.map(({ id, name, role, sourceUrl, metrics }) => ({ id, name, role, sourceUrl, metrics })),
      rows: coverageRows,
    },
    killCriteria,
    scenarios,
    catalysts: catalystsFrom(quant),
    ledgers,
    ledgerNews,
    history,
    method: {
      stance: `가중 점수 ≥ ${signed(stanceRules.overweight ?? 0.75, "", 2)} 비중확대 · ≤ ${signed(stanceRules.underweight ?? -0.75, "", 2)} 비중축소 · 그 외 중립 · 폐기 조건 2개 이상이면 한 단계 하향`,
      factors: factors.map((factor) => `${factor.label} ${Math.round(factor.weight * 100)}%`).join(" · "),
      positioning: "멀티플 미수집 · 200일선 대비 가격 위치를 기대 반영의 대용 지표로 사용",
      signals: "종목 신호는 추세 규칙 · 200일선·50일선·52주 고점 기준 · 업종 의견과 함께 해석",
      disclaimer: "규칙 기반 리서치 의견 · 투자 권유 아님 · 최종 판단과 책임은 투자자 본인",
    },
  };
}
