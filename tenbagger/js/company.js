// Company detail: the same content as a side panel (quick look from any list)
// and as a full page (company.html?id=us-nasdaq-nvda). Chart first, then the
// business, growth and margins, cash flow, balance sheet, runway and dilution,
// a valuation scenario with editable assumptions, stakes and sources.
import { load } from "./data.js";
import { esc, isNum, money, pct, years, multiple, statusChip, marketLabel, NO_DATA, UNDISCLOSED, srcBtn, day } from "./format.js";
import { mountChart } from "./chart.js";
import { companyUrl } from "./state.js";
import { stockPositionKv } from "./positioning.js";

const CHAIN = { infrastructure: "인프라", components: "부품·소재", platforms: "플랫폼", applications: "응용", customers: "고객·수요처", unassigned: "미분류" };

function qBars(quarters, currency) {
  const q = (quarters || []).filter((x) => isNum(x.revenue) || isNum(x.fcf)).slice(-8);
  if (!q.length) return `<p class="muted">분기 재무가 수집되지 않았습니다.</p>`;
  const max = Math.max(...q.flatMap((x) => [Math.abs(x.revenue || 0), Math.abs(x.fcf || 0)])) || 1;
  const W = 640, H = 150, bw = W / q.length;
  const y0 = H / 2;
  const bar = (v, i, off, cls) => {
    if (!isNum(v)) return "";
    const h = (Math.abs(v) / max) * (H / 2 - 12);
    return `<rect class="${cls}" x="${i * bw + off}" y="${v >= 0 ? y0 - h : y0}" width="${bw / 2 - 6}" height="${Math.max(1, h)}"><title>${esc(q[i].end)} ${cls === "rev" ? "매출" : "FCF"} ${money(v, currency, { html: false })}</title></rect>`;
  };
  return `<svg class="qbars" viewBox="0 0 ${W} ${H + 18}" role="img" aria-label="최근 분기 매출과 FCF">
    <line x1="0" x2="${W}" y1="${y0}" y2="${y0}" class="axis"/>
    ${q.map((x, i) => bar(x.revenue, i, 4, "rev") + bar(x.fcf, i, bw / 2, x.fcf >= 0 ? "fcf" : "fcf neg")).join("")}
    ${q.map((x, i) => `<text x="${i * bw + bw / 2}" y="${H + 14}" text-anchor="middle">${esc(x.end.slice(2, 7))}</text>`).join("")}
  </svg><p class="legend"><span class="sw rev"></span>매출 <span class="sw fcf"></span>FCF(플러스) <span class="sw fcf neg"></span>FCF(마이너스) · 분기 = 누적 공시값의 차이</p>`;
}

function kv(rows) {
  return `<dl class="kv">${rows.filter(Boolean).map(([k, v, note]) => `<div><dt>${esc(k)}</dt><dd>${v}${note ? `<span class="sub">${note}</span>` : ""}</dd></div>`).join("")}</dl>`;
}

/** Tenfold per-share model: every input editable; outputs are arithmetic, not forecasts. */
function valuation(c) {
  const cur = c.statementCurrency || c.currency;
  const usable = isNum(c.revenueTtm) && c.revenueTtm > 0 && isNum(c.marketCap) && c.currency === cur;
  if (!usable) return `<p class="muted">매출과 시가총액의 통화·자료가 맞지 않아 시나리오를 계산하지 않습니다.</p>`;
  const d0 = isNum(c.dilutionPct) ? Math.max(0, c.dilutionPct) : 2;
  return `<form class="val-form" data-rev="${c.revenueTtm}" data-cap="${c.marketCap}">
    <p class="muted">10배 = 주당 가치 10배. 주당 가치 = (N년 뒤 매출 × FCF 마진 × P/FCF 배수) ÷ (주식 수 × (1+희석률)^N). 아래 값은 모두 가정이며 직접 바꿀 수 있습니다.</p>
    <div class="val-inputs">
      <label>기간 N(년) <input name="n" type="number" min="1" max="15" step="1" value="5"></label>
      <label>매출 연성장률 % <input name="g" type="number" step="1" value="${isNum(c.revenueGrowthPct) ? Math.round(Math.min(Math.max(c.revenueGrowthPct, 0), 60)) : 20}"></label>
      <label>N년 뒤 FCF 마진 % <input name="m" type="number" step="1" value="${isNum(c.fcfMarginPct) && c.fcfMarginPct > 0 ? Math.round(c.fcfMarginPct) : 15}"></label>
      <label>P/FCF 배수 <input name="p" type="number" step="1" value="25"></label>
      <label>연 희석률 % <input name="d" type="number" step="0.5" value="${d0.toFixed(1)}"></label>
    </div><output class="val-out" aria-live="polite"></output></form>`;
}
function wireValuation(root) {
  const f = root.querySelector(".val-form");
  if (!f) return;
  const out = f.querySelector(".val-out");
  const calc = () => {
    const v = Object.fromEntries([...new FormData(f)].map(([k, x]) => [k, Number(x)]));
    const rev = Number(f.dataset.rev), cap = Number(f.dataset.cap);
    const futureValue = rev * (1 + v.g / 100) ** v.n * (v.m / 100) * v.p;
    const perShare = futureValue / (cap * (1 + v.d / 100) ** v.n);
    const needG = ((10 * cap * (1 + v.d / 100) ** v.n) / (rev * (v.m / 100) * v.p)) ** (1 / v.n) - 1;
    out.innerHTML = `주당 가치 배수 <b class="${perShare >= 10 ? "pos" : ""}">${perShare.toFixed(1)}배</b> (현재 시가총액 대비) · 같은 마진·배수·희석에서 10배에 필요한 매출 연성장률 <b>${(needG * 100).toFixed(1)}%</b>`;
  };
  f.addEventListener("input", calc);
  calc();
}

function failureChecks(c) {
  const items = [];
  if (c.fcfPositive === false && isNum(c.runwayCashPlusStiYears) && c.runwayCashPlusStiYears < 1.5) items.push(`런웨이 ${c.runwayCashPlusStiYears}년 — 일정 소진 가정에서 18개월 안에 추가 자금이 필요합니다.`);
  if (isNum(c.dilutionPct) && c.dilutionPct > 10) items.push(`최근 1년 주식 수 ${pct(c.dilutionPct, { html: false })} 증가 — 주당 가치를 깎는 희석입니다.`);
  if (isNum(c.priceToSales) && c.priceToSales >= 20) items.push(`P/S ${c.priceToSales}배 — 10배 상승에 매출이 크게 늘어야 하는 높은 배수입니다.`);
  if (isNum(c.revenueGrowthPct) && c.revenueGrowthPct < 0) items.push("매출이 감소 중입니다.");
  if (c.postPeriodRaises?.length) items.push(`기준일 이후 증자 관련 공시 ${c.postPeriodRaises.length}건 — 현금에는 합산하지 않았습니다.`);
  return items.length ? `<ul class="checks">${items.map((t) => `<li><span class="neg">✗</span> ${esc(t)}</li>`).join("")}</ul>` : `<p class="muted">규칙 기반 경고 없음(런웨이 1.5년 미만, 희석 10% 초과, P/S 20배 이상, 매출 감소, 기준일 후 증자를 점검).</p>`;
}

export function renderCompany(c, pos = null) {
  const cur = c.statementCurrency || c.currency || "USD";
  const fy = c.revenueBasis === "ttm" ? "최근 12개월" : c.revenueBasis ? "회계연도" : "";
  const industries = c.industries.map((i) => `<li><b>${esc(i.name)}</b> · ${esc(i.layer === "candidate" ? "후보층" : i.layer === "leader" ? "선도층" : "")} · 가치사슬 ${esc(CHAIN[i.chainLayer] || "미분류")}${i.subsector ? ` · ${esc(i.subsector)}` : ""}${i.thesis ? `<p>${esc(i.thesis)} ${srcBtn(i.sourceUrl, "근거")}</p>` : ""}</li>`).join("");
  const holdings = (c.holdings || []).map((h) => `<tr><td><a href="index.html#startups/${esc(h.startupId)}">${esc(h.startup)}</a></td><td>${esc(h.vehicle || "직접")}</td>
    <td class="r">${isNum(h.pctOwned) ? `<b>${h.pctOwned}%</b>` : UNDISCLOSED}</td><td class="r">${isNum(h.amountUsd) ? money(h.amountUsd) : UNDISCLOSED}</td>
    <td>${esc(h.holding === "indirect" ? "간접" : "직접")} · ${esc(h.basis === "not stated" ? "기준 미기재" : h.basis)}</td><td>${esc(h.measuredAt || "")}${h.predatesLatestRound ? ' <span class="chip chip-warn" title="이후 투자 라운드로 희석됐을 수 있음">이후 라운드 전 측정</span>' : ""}</td>
    <td>${esc({ completed: "완료", pending: "진행·미확정", historical: "과거" }[h.status] || h.status)}</td><td>${srcBtn(h.source.url, { filing: "공시", company: "회사", press: "보도" }[h.source.type] || "출처")}</td></tr>`).join("");
  const filings = (c.filings || []).map((f) => `<li>${esc(f.date)} · ${esc(f.form)}${f.capitalRaise ? ' <span class="chip chip-warn">증자 관련</span>' : ""} ${srcBtn(f.url, "원문")}</li>`).join("");
  return `
    <header class="co-head">
      <div><p class="eyebrow">${esc(c.ticker)} · ${esc(marketLabel(c.market))}${c.newlyAdded ? ` · 신규 편입 ${esc(c.newlyAdded)}` : ""}</p><h1>${esc(c.name)}</h1>
        <p class="co-facts">${isNum(c.price) ? `${money(c.price, c.currency)} · ` : ""}시가총액 ${money(c.marketCap, c.currency || "USD")}${c.currency && c.currency !== "USD" && isNum(c.marketCapUsd) ? ` (${money(c.marketCapUsd)})` : ""} · ${statusChip(c.data.financials, c.data.source || "")}</p></div>
      <div class="co-src">${srcBtn(c.data.sourceUrl, c.data.source || "재무 출처")}</div>
    </header>
    <section class="co-sec"><h2>일간 차트</h2><div class="chart-host" data-chart-host></div></section>
    ${pos ? `<section class="co-sec"><h2>추세·변동성·수급</h2>${stockPositionKv(pos)}<p class="sub">모멘텀 z = 21·63·126·252일 변동성 조정 수익률 z값 평균. 공매도 비율은 미국 상장만, 거래소 집계 기준일 ${esc(c.shortInterest?.date || "자료 없음")}${isNum(c.shortInterest?.changePct) ? ` · 전월 대비 ${c.shortInterest.changePct > 0 ? "+" : ""}${c.shortInterest.changePct}%` : ""}.</p></section>` : ""}
    <section class="co-sec"><h2>사업과 산업 노출</h2>${industries ? `<ul class="co-ind">${industries}</ul>` : `<p class="muted">${c.coverage === "holder" ? "비상장 스타트업 지분 보유사로 편입된 기업입니다." : c.screen ? `스크리너 업종: ${esc(c.screen.industryKo || c.screen.industry)}` : "산업 분류 자료 없음"}</p>`}</section>
    <section class="co-sec"><h2>매출 성장과 이익률</h2>${kv([
      ["매출", money(c.revenueTtm, cur), `${fy} · ${esc(c.revenueEnd || "기간 없음")}`],
      ["매출 성장", pct(c.revenueGrowthPct), esc({ "fiscal-year YoY": "직전 회계연도 대비", "year-to-date YoY": "누적 기간 전년 대비", "TTM YoY (TradingView)": "최근 12개월 전년 대비(TradingView)" }[c.revenueGrowthBasis] || c.revenueGrowthBasis || "")],
      ["최근 4분기 성장(전년 4분기 대비)", pct(c.revenueGrowthTtmPct), "8개 분기 연속 자료가 있을 때만"],
      ["매출총이익률", pct(c.grossMarginPct)], ["영업이익률", pct(c.operatingMarginPct)],
    ])}${qBars(c.quarters, cur)}</section>
    <section class="co-sec"><h2>영업현금흐름 · 설비투자 · FCF</h2>${kv([
      ["영업현금흐름", money(c.ocfTtm, cur)], ["설비투자", money(c.capexTtm, cur)],
      ["FCF", money(c.fcfTtm, cur), c.fcfPositive === true ? "FCF 플러스" : c.fcfPositive === false ? "FCF 마이너스" : ""], ["FCF 마진", pct(c.fcfMarginPct)],
    ])}</section>
    <section class="co-sec"><h2>현금 · 단기투자 · 차입금</h2>${kv([
      ["현금및현금성자산", money(c.cashOnly, cur), esc(c.balanceSheetEnd || "")], ["단기투자", money(c.shortTermInvestments, cur)],
      ["현금+단기투자", money(c.cashPlusSti, cur)], ["차입금", money(c.debt, cur), "같은 재무상태표 날짜의 항목만"],
    ])}</section>
    <section class="co-sec"><h2>런웨이와 희석</h2>${c.fcfPositive ? '<p class="pos">FCF 플러스 — 현재 소진이 없어 런웨이를 계산하지 않습니다.</p>' : kv([
      ["런웨이 · 현금만", years(c.runwayCashOnlyYears)], ["런웨이 · 현금+단기투자", years(c.runwayCashPlusStiYears)],
      ["근거", c.runwayStatus === "filed" ? statusChip("filed", "같은 기간 공시 재무") : statusChip("estimate", "데이터 제공사 수치 — 기간 정렬 미확인")],
    ])}<p class="muted">두 런웨이 모두 최근 연간 FCF 소진이 일정하다는 가정입니다. 증자·차입은 넣지 않습니다.</p>
      ${kv([["최근 1년 주식 수 변화", pct(c.dilutionPct)]])}
      ${c.postPeriodRaises?.length ? `<div class="callout"><b>기준일(${esc(c.balanceSheetEnd || "")}) 이후 증자 관련 공시</b> — 위 현금에 합산하지 않았습니다.<ul>${c.postPeriodRaises.map((r) => `<li>${esc(r.date)} · ${esc(r.form)} ${srcBtn(r.url, "원문")}</li>`).join("")}</ul></div>` : ""}</section>
    <section class="co-sec"><h2>성장 촉매 · 밸류에이션 가정 · 실패 조건</h2>
      <h3>촉매(리서치 근거)</h3>${c.industries.some((i) => i.thesis) ? `<ul>${c.industries.filter((i) => i.thesis).map((i) => `<li>${esc(i.thesis)} ${srcBtn(i.sourceUrl, "근거")}</li>`).join("")}</ul>` : '<p class="muted">출처가 있는 촉매 기술 없음</p>'}
      <h3>현재 밸류에이션</h3>${kv([
        ["선행 P/E", multiple(c.valuation?.forwardPE, "배"), "애널리스트 다음 회계연도 EPS 기준"],
        ["후행 P/E", multiple(c.valuation?.trailingPE, "배")],
        ["PEG", isNum(c.valuation?.peg) ? `<span class="${c.valuation.peg < 1 ? "pos" : c.valuation.peg > 2 ? "neg" : ""}">${c.valuation.peg.toFixed(2)}</span>` : NO_DATA, "P/E ÷ 예상 EPS 성장률"],
        ["P/S", multiple(c.priceToSales, "배")], ["P/S ÷ 매출성장", isNum(c.psToGrowth) ? String(c.psToGrowth) : NO_DATA, "적자 성장주 비교용"],
        ["EV/매출", multiple(c.valuation?.evToRevenue, "배")],
        ["다음 실적 발표", c.nextEarnings ? `${esc(c.nextEarnings)} (D-${Math.max(0, c.daysToEarnings)})` : NO_DATA, "발표 후 공시가 올라오면 다음 실행에서 재무 갱신"],
      ])}<p class="sub">선행 P/E·PEG·EV 배수는 ${esc(c.valuation?.source || "Yahoo Finance")} 수치(애널리스트 ${esc(c.valuation?.analysts ?? "—")}명). 적자 기업은 P/E가 의미 없어 비워 둡니다.</p>
      <h3>10배 시나리오</h3>${valuation(c)}
      <h3>실패 조건 점검</h3>${failureChecks(c)}</section>
    ${holdings ? `<section class="co-sec"><h2>보유한 비상장 지분</h2><div class="tbl-wrap"><table class="grid"><thead><tr><th>스타트업</th><th>투자 주체</th><th class="r">지분율</th><th class="r">투자 금액</th><th>보유 형태·기준</th><th>측정일</th><th>상태</th><th>출처</th></tr></thead><tbody>${holdings}</tbody></table></div></section>` : ""}
    <section class="co-sec"><h2>출처와 공시일</h2>${kv([
      ["재무 보고 기간", esc(c.data.periodEnd || "자료 없음")], ["공시일", esc(c.data.disclosedAt || "자료 없음")],
      ["마지막 성공 갱신", esc(day(c.data.lastSuccess) || "자료 없음"), c.data.staleFundamentals ? "재무 갱신 실패 — 이전 값 유지" : ""],
    ])}${c.tvCheck?.state === "aligned" || c.tvCheck?.state === "differs" ? `<p>TradingView 대조(같은 최근 4분기 기준): 자체 ${pct(c.tvCheck.ours)} · TradingView ${pct(c.tvCheck.tv)} · 차이 ${c.tvCheck.diffPp}%p</p>` : `<p class="muted">TradingView 대조: ${esc(c.tvCheck?.reason || "기간이 맞는 비교 자료 없음")}</p>`}
      ${filings ? `<h3>최근 공시</h3><ul class="filings">${filings}</ul>` : ""}</section>`;
}

export async function mountCompany(host, id, { list = [], panel = false, zoom = null } = {}) {
  const doc = await load("companies");
  const c = doc.companies.find((x) => x.id === id);
  if (!c) { host.innerHTML = `<p class="error-banner">이 기업(${esc(id)})은 현재 데이터에 없습니다.</p>`; return null; }
  document.title = `${c.name} · 미래 성장 산업`;
  const pos = await load("positioning").then((p) => p.stocks?.[c.id] || null).catch(() => null);
  host.innerHTML = renderCompany(c, pos ? { ...pos, shortPctFloat: c.shortInterest?.pctFloat ?? pos.shortPctFloat } : null);
  const markers = [];
  if (c.tenBagger?.achieved) markers.push({ date: c.tenBagger.fromDate, label: "10배 구간 시작", kind: "tenx" }, { date: c.tenBagger.toDate, label: "10배 도달", kind: "tenx" });
  for (const f of c.filings || []) if (f.capitalRaise) markers.push({ date: f.date, label: f.form, kind: "raise" });
  mountChart(host.querySelector("[data-chart-host]"), { ticker: c.ticker, markers, zoom });
  wireValuation(host);
  return c;
}

// ── Side panel with previous/next through the current list ───────────────────
let panelList = [];
export async function openPanel(id, list = panelList) {
  panelList = list.length ? list : panelList;
  let panel = document.getElementById("coPanel");
  if (!panel) {
    panel = Object.assign(document.createElement("dialog"), { id: "coPanel", className: "co-panel" });
    panel.innerHTML = `<div class="panel-bar"><button type="button" class="btn sm" data-prev aria-label="이전 기업">← 이전</button><button type="button" class="btn sm" data-next aria-label="다음 기업">다음 →</button>
      <span class="spacer"></span><a class="btn sm" data-full>전체 페이지</a><button type="button" class="btn sm" data-close aria-label="닫기">닫기 ✕</button></div><div class="panel-body" data-body></div>`;
    document.body.append(panel);
    panel.addEventListener("click", (e) => { if (e.target === panel || e.target.closest("[data-close]")) panel.close(); });
    panel.querySelector("[data-prev]").addEventListener("click", () => step(-1));
    panel.querySelector("[data-next]").addEventListener("click", () => step(1));
    panel.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft" && !e.target.closest("input")) step(-1); if (e.key === "ArrowRight" && !e.target.closest("input")) step(1); });
  }
  panel.dataset.id = id;
  const i = panelList.indexOf(id);
  panel.querySelector("[data-prev]").disabled = i <= 0;
  panel.querySelector("[data-next]").disabled = i < 0 || i >= panelList.length - 1;
  panel.querySelector("[data-full]").href = companyUrl(id);
  const body = panel.querySelector("[data-body]");
  body.innerHTML = '<div class="skeleton"><div class="sk-row"></div><div class="sk-row"></div><div class="sk-row"></div></div>';
  if (!panel.open) panel.showModal();
  await mountCompany(body, id, { panel: true });
  body.scrollTop = 0;
}
function step(d) {
  const panel = document.getElementById("coPanel");
  const i = panelList.indexOf(panel.dataset.id);
  const next = panelList[i + d];
  if (next) openPanel(next);
}
