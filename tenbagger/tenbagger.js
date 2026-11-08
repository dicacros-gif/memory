// Ten-bagger research page: renders data/tenbagger/universe.json (curated,
// sourced) joined with data/tenbagger/metrics.json (refreshed by the pipeline).
import { initDetail } from "./detail.js";

const $ = (id) => document.getElementById(id);
// Clickable names: a stock opens its daily chart and explanation, a startup its listed shareholders.
const stockBtn = (ticker, text) => `<button type="button" class="tb-link" data-stock="${esc(ticker)}">${esc(text)}</button>`;
const startupBtn = (name) => `<button type="button" class="tb-link" data-startup="${esc(name)}">${esc(name)}</button>`;
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const link = (url, text) => (url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text)}</a>` : esc(text));

function money(value, currency = "USD") {
  if (!Number.isFinite(value)) return "";
  const abs = Math.abs(value);
  if (currency === "KRW") {
    if (abs >= 1e12) return `${(value / 1e12).toFixed(2)}조원`;
    if (abs >= 1e8) return `${Math.round(value / 1e8).toLocaleString()}억원`;
    return `${Math.round(value).toLocaleString()}원`;
  }
  const sym = currency === "USD" ? "$" : `${currency} `;
  if (abs >= 1e12) return `${sym}${(value / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sym}${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sym}${(value / 1e6).toFixed(1)}M`;
  return `${sym}${Math.round(value).toLocaleString()}`;
}
const pct = (v) => (Number.isFinite(v) ? `<span class="${v >= 0 ? "up" : "down"}">${v > 0 ? "+" : ""}${v.toFixed(1)}%</span>` : "");
const day = (v) => (v ? String(v).slice(0, 10) : "");

function tenX(t) {
  if (!t) return "";
  return t.achieved
    ? `<span class="up">10x 달성</span> ${day(t.fromDate).slice(0, 7)}→${day(t.toDate).slice(0, 7)} (${t.months}개월)`
    : `<span class="muted">최대 ${t.multiple}x</span>`;
}

function companyTable(companies, metrics) {
  const rows = companies.map((c) => {
    const m = metrics.get(c.ticker) || {};
    const f = m.fundamentals || {};
    const cur = f.currency || m.currency || "USD";
    const runway = Number.isFinite(m.runwayYears) ? `${m.runwayYears}년` : Number.isFinite(f.fcfTtm) && f.fcfTtm >= 0 ? '<span class="up">흑자</span>' : "";
    return `<tr>
      <td>${stockBtn(c.ticker, c.name)}<br><span class="muted">${esc(c.ticker)}</span> ${c.sourceUrl ? link(c.sourceUrl, "출처") : ""}</td>
      <td><span class="tag ${esc(c.layer)}">${c.layer === "candidate" ? "후보층" : "선도·재평가"}</span><br><span class="muted">${esc(c.subsector)}</span></td>
      <td class="num">${money(m.marketCap, m.currency)}</td>
      <td class="num">${money(f.revenueTtm, cur)}<br><span class="muted">${f.revenueBasis === "ttm" ? "TTM" : f.revenueBasis ? "FY" : ""} ${day(f.revenueEnd)}</span></td>
      <td class="num">${pct(f.revenueGrowthPct)}</td>
      <td class="num">${money(f.fcfTtm, cur)}<br>${pct(m.fcfMarginPct)}</td>
      <td class="num">${money(f.cashAndShortTermInvestments, cur)}</td>
      <td class="num">${runway}</td>
      <td class="num">${pct(m.returns?.m12)}</td>
      <td>${tenX(m.tenBagger)}</td>
      <td>${crossBadge(m.tv)}</td>
      <td class="wrap">${esc(c.thesis)}</td>
    </tr>`;
  }).join("");
  return `<div class="tb-scroll"><table><thead><tr><th>기업</th><th>층</th><th>시가총액</th><th>매출</th><th>매출 성장</th><th>FCF · 마진</th><th>현금+단기투자</th><th>런웨이</th><th>1년 수익률</th><th>텐배거 이력</th><th>교차검증</th><th class="wrap">포지션</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

// TradingView's independent read of the same company (scripts/tenbagger-screen.mjs crossCheck).
function crossBadge(tv) {
  if (!tv) return "";
  const g = Number.isFinite(tv.revenueGrowthPct) ? `TV 성장 ${tv.revenueGrowthPct > 0 ? "+" : ""}${tv.revenueGrowthPct.toFixed(1)}%` : "TV";
  if (tv.agrees === true) return `<span class="tag ok">일치</span><br><span class="muted">${esc(g)}</span>`;
  if (tv.agrees === false) return `<span class="tag warn">차이 ${Number.isFinite(tv.growthDiffPp) ? `${tv.growthDiffPp}%p` : "FCF 부호"}</span><br><span class="muted">${esc(g)}</span>`;
  return `<span class="muted">${esc(g)}</span>`;
}
const usd = (v) => money(v, "USD");

let SOURCES = {};
// What we know about a figure: re-confirmed by the check agent, found on the
// re-opened source page by the pipeline, or only cited.
function checkBadge(item, url, value) {
  if (item.check === "verified") return '<span class="tag ok">재검증</span>';
  if (item.check === "corrected") return '<span class="tag ok">정정 반영</span>';
  const r = SOURCES[url];
  if (r?.figureFound) return '<span class="tag ok">원문 수치 확인</span>';
  if (r?.ok) return `<span class="tag">${value == null ? "원문 열림" : "원문 열림·수치 미확인"}</span>`;
  if (r) return '<span class="tag warn">원문 접근 실패</span>';
  return '<span class="tag">출처 인용</span>';
}

function startupTable(startups) {
  const rows = startups.map((s) => {
    const holders = (s.holders || []).map((h) => {
      const share = Number.isFinite(h.pctOwned) ? `${h.pctOwned}%` : Number.isFinite(h.amountUsd) ? `${money(h.amountUsd)} 투자` : "보유(비율 미공개)";
      const basis = { filing: "공시", "company-disclosure": "회사", reported: "보도" }[h.basis] || h.basis;
      const holderName = h.holderTicker && h.holderTicker.includes(":") ? stockBtn(h.holderTicker.split("/")[0].trim(), h.holder) : esc(h.holder);
      return `${holderName} <span class="muted">${esc(h.holderTicker)}</span> ${link(h.url, share)} <span class="tag">${esc(basis)} ${esc(day(h.asOf))}</span> ${checkBadge(h, h.url, h.pctOwned ?? h.amountUsd)}`;
    }).join("<br>");
    return `<tr><td>${startupBtn(s.name)}<br><span class="muted">${esc(s.country)}</span></td><td class="wrap">${esc(s.what)}</td>
      <td class="num">${s.valuationUsd ? link(s.valuationUrl, money(s.valuationUsd)) : ""}<br><span class="muted">${esc(day(s.valuationDate))}</span></td>
      <td class="wrap">${holders || '<span class="muted">상장 보유사 확인 안 됨</span>'}</td></tr>`;
  }).join("");
  return `<div class="tb-scroll"><table><thead><tr><th>스타트업</th><th class="wrap">사업</th><th>최근 기업가치</th><th class="wrap">지분 보유 상장사 (지분율 · 근거 · 기준일)</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function growthTable(growth) {
  const rows = growth.map((g) => `<tr><td>${link(g.url, g.institution)}<br><span class="muted">${esc(day(g.publishedAt))}</span></td>
    <td class="wrap">${esc(g.metric)}<br><span class="muted">${esc(g.definition)}</span></td>
    <td class="num">${esc(g.baseValue || "")}${g.baseYear ? ` (${g.baseYear})` : ""}</td>
    <td class="num">${esc(g.targetValue || "")}${g.targetYear ? ` (${g.targetYear})` : ""}</td>
    <td class="num">${Number.isFinite(g.cagrPct) ? `${g.cagrPct}%` : ""}</td><td>${checkBadge(g, g.url, g.targetValue)}</td></tr>`).join("");
  return `<div class="tb-scroll"><table><thead><tr><th>기관</th><th class="wrap">지표 · 정의</th><th>기준</th><th>전망</th><th>연평균</th><th>확인</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderSector(sector, metrics) {
  $("tbSector").innerHTML = `
    <p class="tb-note">${esc(sector.summary || "")}</p>
    <h3>성장 전망</h3>${growthTable(sector.growth || [])}
    <h3>상장사</h3>${companyTable(sector.publicCompanies || [], metrics)}
    <h3>비상장 유망 기업과 지분 보유 상장사</h3>${startupTable(sector.startups || [])}`;
}

// Transparent screen, not a recommendation: small enough for 10x arithmetic,
// growing, and either self-funding or with at least two years of cash.
const SCREEN_RULE = "후보층 · 시가총액 $10B(약 14조원) 미만 · 매출 성장 +20% 이상 · FCF 흑자이거나 런웨이 2년 이상";
function screen(universe, metrics) {
  // Dollar market cap: ours for USD listings, TradingView's conversion otherwise.
  const usdCap = (m) => m.marketCapUsd ?? (m.currency === "USD" ? m.marketCap : null);
  const picks = [];
  for (const sector of universe.sectors || []) for (const c of sector.publicCompanies || []) {
    const m = metrics.get(c.ticker); const f = m?.fundamentals;
    if (!m || !f || c.layer !== "candidate") continue;
    const cap = usdCap(m);
    const funded = (Number.isFinite(f.fcfTtm) && f.fcfTtm >= 0) || (Number.isFinite(m.runwayYears) && m.runwayYears >= 2);
    if (Number.isFinite(cap) && cap < 10e9 && f.revenueGrowthPct >= 20 && funded) picks.push({ c, m, sector });
  }
  picks.sort((a, b) => (b.m.fundamentals.revenueGrowthPct || 0) - (a.m.fundamentals.revenueGrowthPct || 0));
  $("tbScreenRule").textContent = `조건: ${SCREEN_RULE}. 통과 ${picks.length}개. 매출 성장 순 정렬이며 매수 의견이 아닙니다.`;
  $("tbScreen").innerHTML = `<table><thead><tr><th>기업</th><th>산업</th><th>시가총액</th><th>10배 시 시가총액</th><th>매출 성장</th><th>FCF</th><th>런웨이</th><th>텐배거 이력</th><th>교차검증</th></tr></thead><tbody>${picks.map(({ c, m, sector }) => `<tr>
    <td>${stockBtn(c.ticker, c.name)}<br><span class="muted">${esc(c.ticker)}</span></td><td>${esc(sector.name)}</td>
    <td class="num">${money(m.marketCap, m.currency)}</td><td class="num">${money(m.marketCapNeededFor10x, m.currency)}</td>
    <td class="num">${pct(m.fundamentals.revenueGrowthPct)}</td><td class="num">${money(m.fundamentals.fcfTtm, m.fundamentals.currency)}</td>
    <td class="num">${Number.isFinite(m.runwayYears) ? `${m.runwayYears}년` : "흑자"}</td><td>${tenX(m.tenBagger)}</td><td>${crossBadge(m.tv)}</td></tr>`).join("")}</tbody></table>`;
}

const SECTOR_NAME = {};
function factorSection(doc) {
  const leaders = doc.factorLeaders || [];
  const fr = doc.factorResearch;
  if (!leaders.length || !fr) { $("factors").hidden = true; return; }
  const r = doc.factorRules;
  $("tbFactorNote").innerHTML = `${link(fr.url, fr.title)} · ${esc(fr.sample)}. 점수는 추적 업종·시가총액 ${usd(r.minCapUsd)}~${usd(r.maxCapUsd)} 종목 안에서 아래 요인의 백분위를 평균한 값입니다: ${fr.factors.map((f) => `${esc(f.label)}(${esc(f.basis)})`).join(", ")}. FCF 흑자이고 매출 +${r.minGrowthPct}% 이상인 종목만 표시. ${esc(fr.caveat)}`;
  const cell = (v) => (Number.isFinite(v) ? `<span class="tb-bar" style="--w:${v}%">${v}</span>` : "");
  $("tbFactors").innerHTML = `<table><thead><tr><th>기업</th><th>업종</th><th>점수</th><th>규모</th><th>가치(B/M)</th><th>수익성</th><th>FCF 수익률</th><th>고점 거리</th><th>시가총액</th><th>매출 성장</th><th>FCF 수익률(%)</th></tr></thead><tbody>${leaders.map((d) => `<tr>
    <td>${stockBtn(d.ticker, d.name)} ${d.inUniverse ? "" : '<span class="tag ok">신규</span>'}<br><span class="muted">${esc(d.ticker)}</span></td>
    <td>${esc(d.industryKo || d.industry)}</td><td class="num"><b>${esc(d.factor.score)}</b></td>
    <td>${cell(d.factor.size)}</td><td>${cell(d.factor.value)}</td><td>${cell(d.factor.profitability)}</td><td>${cell(d.factor.fcfYield)}</td><td>${cell(d.factor.offHigh)}</td>
    <td class="num">${usd(d.marketCapUsd)}</td><td class="num">${pct(d.revenueGrowthPct)}</td><td class="num">${Number.isFinite(d.fcfYieldPct) ? d.fcfYieldPct.toFixed(1) : ""}</td></tr>`).join("")}</tbody></table>`;
}
function marketScreen(doc) {
  if (!doc?.industryMap?.length) {
    for (const id of ["industries", "discovery", "factors"]) $(id).hidden = true;
    $("tbTenXNote").closest("section").querySelector("h3").hidden = true;
    return;
  }
  const when = day(doc.fetchedAt);
  const src = link(doc.sourceUrl, "TradingView 스크리너");
  $("tbIndustryNote").innerHTML = `${src} ${esc(when)} 기준 · ${esc(doc.scope.markets.length)}개 시장 상장사 ${esc(doc.scope.companies.toLocaleString())}곳의 최근 12개월 매출 성장률을 업종별로 묶은 실측치입니다(전망 아님). 상장사 15곳 이상 업종만, 중앙값 순.`;
  const rows = doc.industryMap.filter((i) => i.companies >= 15).slice(0, 25);
  $("tbIndustries").innerHTML = `<table><thead><tr><th>업종</th><th>추적 산업</th><th>상장사</th><th>매출 성장 중앙값</th><th>시총 가중 성장</th><th>+25% 이상 비중</th><th>합산 시가총액</th><th class="wrap">대표 기업</th></tr></thead><tbody>${rows.map((i) => `<tr>
    <td>${esc(i.industryKo || i.industry)}${i.industryKo ? `<br><span class="muted">${esc(i.industry)}</span>` : ""}</td><td>${i.sector ? `<span class="tag">${esc(SECTOR_NAME[i.sector] || i.sector)}</span>` : ""}</td>
    <td class="num">${esc(i.companies)}</td><td class="num">${pct(i.medianGrowthPct)}</td><td class="num">${pct(i.capWeightedGrowthPct)}</td>
    <td class="num">${esc(i.shareGrowing25Pct)}%</td><td class="num">${usd(i.marketCapUsd)}</td><td class="wrap muted">${esc(i.leaders.join(", "))}</td></tr>`).join("")}</tbody></table>`;

  const r = doc.rules.discovery;
  $("tbDiscoveryNote").innerHTML = `${src} ${esc(when)} 기준 · 추적 산업 관련 업종 · 시가총액 ${usd(r.minCapUsd)}~${usd(r.maxCapUsd)} · 최근 12개월 매출 +${r.minGrowthPct}% 이상 · FCF 흑자이거나 런웨이 ${r.minRunwayYears}년 이상. '신규'는 아직 큐레이션 목록에 없는 종목입니다. 매수 의견이 아닙니다.`;
  $("tbDiscovery").innerHTML = `<table><thead><tr><th>기업</th><th>업종</th><th>시가총액</th><th>10배 시</th><th>매출 성장</th><th>FCF 마진</th><th>런웨이</th><th>총마진</th><th>1년 수익률</th><th>52주 고점 대비</th></tr></thead><tbody>${doc.discovery.map((d) => `<tr>
    <td>${stockBtn(d.ticker, d.name)} ${d.inUniverse ? "" : '<span class="tag ok">신규</span>'}<br><span class="muted">${esc(d.ticker)} · ${esc(d.country || "")}</span></td>
    <td>${esc(d.industryKo || d.industry)}<br><span class="muted">${esc(SECTOR_NAME[d.sector] || "")}</span></td>
    <td class="num">${usd(d.marketCapUsd)}</td><td class="num">${usd(d.upsideTo10xUsd)}</td><td class="num">${pct(d.revenueGrowthPct)}</td>
    <td class="num">${pct(d.fcfMarginPct)}</td><td class="num">${d.fcfPositive ? '<span class="up">흑자</span>' : Number.isFinite(d.runwayYears) ? `${d.runwayYears}년` : ""}</td>
    <td class="num">${Number.isFinite(d.grossMarginPct) ? `${d.grossMarginPct.toFixed(0)}%` : ""}</td><td class="num">${pct(d.perf1yPct)}</td><td class="num">${pct(d.offHighPct)}</td></tr>`).join("")}</tbody></table>`;

  factorSection(doc);
  const t = doc.recentTenBaggers;
  if (!t?.total) { $("tbTenXNote").textContent = `${when} 기준 5년 수익률을 받지 못했습니다.`; return; }
  $("tbTenXNote").innerHTML = `${src} ${esc(when)} 기준 · ${esc(doc.rules.tenX)} · ${esc(t.total)}개. 현재 공통점: 매출 성장 중앙값 ${pct(t.traits.medianRevenueGrowthPct)}, FCF 흑자 비중 ${esc(t.traits.fcfPositiveSharePct ?? "")}%, 총마진 중앙값 ${esc(t.traits.medianGrossMarginPct ?? "")}%.`;
  if (t.oneYear?.length) $("tbTenXNote").innerHTML += ` 최근 1년 사이 10배 이상: ${t.oneYear.slice(0, 12).map((d) => stockBtn(d.ticker, d.name)).join(", ")}${t.oneYear.length > 12 ? ` 외 ${t.oneYear.length - 12}개` : ""}.`;
  $("tbTenXIndustries").innerHTML = `<div class="tb-patterns">${t.industries.slice(0, 8).map((i) => `<div class="tb-pattern"><b>${esc(i.industryKo || i.industry)} · ${esc(i.count)}개</b><span>현재 매출 성장 중앙값 ${i.medianGrowthPct ?? "-"}% · FCF 흑자 ${i.fcfPositiveShare}%</span></div>`).join("")}</div>`;
  $("tbTenX").innerHTML = `<table><thead><tr><th>기업</th><th>업종</th><th>5년 수익률</th><th>1년 수익률</th><th>시가총액</th><th>매출 성장</th><th>FCF 마진</th></tr></thead><tbody>${t.stocks.map((d) => `<tr>
    <td>${stockBtn(d.ticker, d.name)}<br><span class="muted">${esc(d.ticker)}</span></td><td>${esc(d.industryKo || d.industry)}</td><td class="num">${pct(d.perf5yPct)}</td><td class="num">${pct(d.perf1yPct)}</td>
    <td class="num">${usd(d.marketCapUsd)}</td><td class="num">${pct(d.revenueGrowthPct)}</td><td class="num">${pct(d.fcfMarginPct)}</td></tr>`).join("")}</tbody></table>`;
}

function history(universe, metrics) {
  const h = universe.history || {};
  $("tbPatterns").innerHTML = `<div class="tb-patterns">${(h.patterns || []).map((p) => `<div class="tb-pattern"><b>${esc(p.pattern)}</b><span>${esc(p.evidence)}</span></div>`).join("")}</div>`;
  $("tbHistory").innerHTML = `<table><thead><tr><th>기업</th><th>리서치 기준 구간</th><th>가격 데이터 검증</th><th class="wrap">출발 조건</th><th class="wrap">촉매</th></tr></thead><tbody>${(h.cases || []).map((c) => {
    const m = metrics.get(c.ticker);
    return `<tr><td>${stockBtn(c.ticker, c.name)}<br><span class="muted">${esc(c.ticker)}</span> ${link(c.url, "출처")}</td>
      <td>${esc(c.startYear)}→${esc(c.tenXYear ?? "")} ${esc(c.multipleAchieved || "")}</td>
      <td>${m ? tenX(m.tenBagger) : '<span class="muted">가격 미수집</span>'}</td>
      <td class="wrap">${esc(c.preconditions)}</td><td class="wrap">${esc(c.catalysts)}</td></tr>`;
  }).join("")}</tbody></table>`;
}

async function main() {
  const [universe, metricsDoc, sourceDoc, screenDoc] = await Promise.all([
    fetch("../data/tenbagger/universe.json", { cache: "no-cache" }).then((r) => r.json()),
    fetch("../data/tenbagger/metrics.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : { companies: [] })).catch(() => ({ companies: [] })),
    fetch("../data/tenbagger/source-checks.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    fetch("../data/tenbagger/screen.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);
  for (const s of universe.sectors || []) SECTOR_NAME[s.id] = s.name;
  initDetail({ universe, metrics: new Map((metricsDoc.companies || []).map((c) => [c.ticker, c])), screen: screenDoc });
  SOURCES = sourceDoc.results || {};
  const metrics = new Map((metricsDoc.companies || []).map((c) => [c.ticker, c]));
  const sectors = universe.sectors || [];
  const listed = sectors.reduce((n, s) => n + (s.publicCompanies || []).length, 0);
  const startups = sectors.reduce((n, s) => n + (s.startups || []).length, 0);
  const stakes = sectors.reduce((n, s) => n + (s.startups || []).reduce((k, x) => k + (x.holders || []).filter((h) => Number.isFinite(h.pctOwned)).length, 0), 0);
  $("tbKpis").innerHTML = [
    [sectors.length, "산업"], [listed, "상장사"], [startups, "비상장 기업"], [stakes, "지분율 확인 건"],
    [metricsDoc.coverage?.withFundamentals ?? 0, "재무 수집 상장사"], [day(metricsDoc.generatedAt) || "—", "수치 갱신일"],
  ].map(([v, l]) => `<div class="tb-kpi"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("");
  $("tbRun").textContent = `리서치 기준 ${day(universe.asOf)} · 수치 ${day(metricsDoc.generatedAt) || "수집 대기"}`;
  $("tbTabs").innerHTML = sectors.map((s, i) => `<button type="button" role="tab" data-i="${i}" aria-selected="${i === 0}">${esc(s.name)}</button>`).join("");
  $("tbTabs").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    for (const x of $("tbTabs").children) x.setAttribute("aria-selected", String(x === b));
    renderSector(sectors[Number(b.dataset.i)], metrics);
  });
  if (sectors[0]) renderSector(sectors[0], metrics);
  screen(universe, metrics);
  history(universe, metrics);
  marketScreen(screenDoc);
}
main().catch((error) => { $("tbRun").textContent = `데이터를 불러오지 못했습니다: ${error.message}`; });
