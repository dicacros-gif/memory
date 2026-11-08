// Historical Tenbaggers: hindsight examples (picked after the fact) kept apart
// from the executable test (every eligible start, winners and failures alike).
// Frequencies are of the past sample, not probabilities for any stock today.
import { esc, isNum, money, pct, NO_DATA, srcBtn } from "./format.js";
import { companyUrl } from "./state.js";

const rate = (c) => (c && c.n ? `${((c.hits / c.n) * 100).toFixed(1)}%` : NO_DATA);

export function renderHistory(root, { history }) {
  const h = history.hindsight || [];
  const co = history.cohort;
  const cells = co?.cells || {};
  const base = co?.base;
  const grid = co ? `<div class="tbl-wrap"><table class="grid heat"><thead><tr><th class="first">시작 시가총액 ↓ / 12개월 고점 대비 →</th>${co.offBuckets.map((o) => `<th class="r">${esc(o)}</th>`).join("")}</tr></thead><tbody>
      ${co.sizeBuckets.map((s) => `<tr><th class="first" scope="row">${esc(s)}</th>${co.offBuckets.map((o) => {
        const c = cells[`size·off|${s}|${o}`];
        const lift = c && base?.n && c.n >= 30 ? (c.hits / c.n) / (base.hits / base.n) : null;
        return `<td class="r ${isNum(lift) && lift >= 2 ? "hot" : ""}" title="${c ? `${c.hits}/${c.n} 10배 · 3년 안 반토막 ${c.halved}건` : "표본 없음"}">${c ? `${rate(c)}<div class="sub">${c.hits}/${c.n}${c.n < 30 ? " · 표본 적음" : ""} · 반토막 ${((c.halved / c.n) * 100).toFixed(0)}%</div>` : NO_DATA}</td>`;
      }).join("")}</tr>`).join("")}</tbody></table></div>` : "";
  const prof = (g) => co?.profiles?.[g];
  const profileRow = (label, key) => `<tr><th class="first" scope="row">${esc(label)}</th>${["winners", "others"].map((g) => `<td class="r">${isNum(prof(g)?.shares?.[key]) ? `${prof(g).shares[key]}%` : NO_DATA}</td>`).join("")}</tr>`;
  root.innerHTML = `<section class="view-head"><h1>과거 텐배거</h1>
      <p class="lede">사후에 고른 사례(후견)와, 같은 조건의 모든 종목을 시작 시점에 넣고 결과를 본 검증(실행 가능 테스트)을 나눕니다. 과거 빈도는 미래 확률이 아닙니다.</p></section>
    <section><h2>실행 가능 테스트 — 모든 시작점</h2>
      ${co ? `<p>${esc(co.population.stocks)}개 종목 · 시작점 ${esc(co.population.starts)}개 · 10배 ${base.hits}건(${rate(base)}) · 실패 ${base.n - base.hits}건 · 3년 안 반토막 ${((base.halved / base.n) * 100).toFixed(1)}% · ${esc(co.generatedAt.slice(0, 10))} 계산</p>
        ${grid}
        <h3>시작 시점 특징: 10배 종목 vs 나머지</h3>
        <div class="tbl-wrap"><table class="grid"><thead><tr><th class="first">시작 조건</th><th class="r">10배 종목 (${prof("winners")?.n ?? 0})</th><th class="r">나머지 (${prof("others")?.n ?? 0})</th></tr></thead><tbody>
          ${co.sizeBuckets.map((s) => profileRow(`시가총액 ${s}`, `size|${s}`)).join("")}
          ${co.offBuckets.map((o) => profileRow(`고점 대비 ${o}`, `off|${o}`)).join("")}
          <tr><th class="first" scope="row">고점 대비 중앙값</th><td class="r">${pct(prof("winners")?.medianOffHighPct)}</td><td class="r">${pct(prof("others")?.medianOffHighPct)}</td></tr>
          <tr><th class="first" scope="row">시작 시점 매출 성장·FCF</th><td class="r" colspan="2">${NO_DATA} — 과거 재무를 전 종목에 대해 수집하지 않음</td></tr>
        </tbody></table></div>
        <details class="method"><summary>계산 방법과 한계</summary><ul>${Object.values(co.method).map((m) => `<li>${esc(m)}</li>`).join("")}<li>${esc(co.note)}</li></ul></details>
        ${co.graduates?.length ? `<h3>최근 졸업 — 최근 2년 안에 10배를 마친 종목</h3><p class="muted">이미 10배가 난 종목은 다시 10배가 되려면 지금 시가총액의 10배를 정당화할 매출·이익이 필요합니다. 기업 상세의 10배 시나리오에서 필요한 성장률을 확인하세요.</p>
          <div class="tbl-wrap"><table class="grid"><thead><tr><th class="first">종목</th><th>업종</th><th>저점 → 고점</th><th class="r">배수</th><th class="r">고점 대비 현재</th><th class="r">현재 시총</th></tr></thead><tbody>
          ${co.graduates.slice(0, 30).map((g) => `<tr><td class="first">${esc(g.name)}<div class="sub">${esc(g.ticker)}</div></td><td>${esc(g.industry)}</td><td>${esc(g.lowMonth)} → ${esc(g.peakMonth)}</td><td class="r">${g.multiple}x</td><td class="r">${pct(g.fromPeakPct)}</td><td class="r">${money(g.marketCapUsd)}</td></tr>`).join("")}</tbody></table></div>` : ""}`
        : `<p class="error-banner">과거 코호트 계산 결과가 아직 없습니다(주 1회 계산). 다음 데이터 갱신 후 표시됩니다.</p>`}
    </section>
    <section><h2>후견 사례 — 사후에 고른 10배 종목</h2><p class="muted">시작일, 첫 10배 도달, 그 사이 최대 낙폭, 시작 시점에 공개돼 있던 재무를 보여 줍니다. 이름을 누르면 해당 구간으로 확대된 일간 차트가 열립니다.</p>
      <div class="tbl-wrap"><table class="grid"><thead><tr><th class="first">기업</th><th>시작 → 10배(월간 종가)</th><th class="r">걸린 기간</th><th class="r">중간 최대 낙폭</th><th class="r">시작 시점 매출</th><th class="r">당시 매출 성장</th><th class="r">당시 FCF</th><th>리서치 근거</th></tr></thead><tbody>
      ${h.map((c) => {
        const ep = c.priceEpisode;
        const zoom = ep ? `&from=${ep.startMonth}-01&to=${ep.tenXMonth}-28` : "";
        const f = c.financialsAtStart;
        return `<tr><td class="first"><a href="${companyUrl(c.id, zoom)}">${esc(c.name)}</a><div class="sub">${esc(c.ticker)}</div></td>
          <td>${ep ? `${esc(ep.startMonth)} → ${esc(ep.tenXMonth)}` : `<span class="nd">가격 기록상 10배 미확인</span><div class="sub">리서치 기준 ${esc(c.research.startYear || "")}→${esc(c.research.tenXYear || "")}</div>`}</td>
          <td class="r">${ep ? `${ep.months}개월` : NO_DATA}</td><td class="r">${ep ? pct(ep.drawdownBeforeTenXPct) : NO_DATA}</td>
          <td class="r">${f ? `${money(f.revenue, f.currency || "USD")}<div class="sub">FY ${esc(f.fiscalYearEnd)}</div>` : `<span class="nd" title="${esc(c.financialsNote || "")}">자료 없음</span>`}</td>
          <td class="r">${f ? pct(f.revenueGrowthPct) : NO_DATA}</td><td class="r">${f ? money(f.fcf, f.currency || "USD") : NO_DATA}</td>
          <td>${srcBtn(c.research.url, "근거")}</td></tr>`;
      }).join("")}</tbody></table></div>
      <p class="muted">상장폐지된 실패 사례는 무료 자료에서 가격을 받을 수 없어 빠져 있습니다.</p></section>`;
}
