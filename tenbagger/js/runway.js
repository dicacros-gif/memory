// Cash & runway monitor for loss-making companies: how many years the
// balance sheet covers at the current free-cash-flow burn, shown as bars
// (cash only vs cash + short-term investments), with the burn trend, the
// next earnings date (when the figures refresh) and any offering filed after
// the balance-sheet date. Constant-burn arithmetic, not a forecast.
import { esc, isNum, money, pct, statusChip, marketLabel, NO_DATA, toUsd } from "./format.js";
import { companyUrl } from "./state.js";
import { openPanel } from "./company.js";

const ZONES = [[1, "z-red", "1년 미만"], [2, "z-amber", "1–2년"], [3, "z-yellow", "2–3년"], [Infinity, "z-green", "3년 이상"]];
const zone = (y) => ZONES.find(([lim]) => y < lim);
const MAX_Y = 6;

function bar(c) {
  const a = c.runwayCashOnlyYears, b = c.runwayCashPlusStiYears;
  const w = (y) => `${Math.min(100, (Math.max(0, y) / MAX_Y) * 100)}%`;
  return `<div class="rw-bar" title="현금만 ${isNum(a) ? `${a}년` : "자료 없음"} · 현금+단기투자 ${isNum(b) ? `${b}년` : "자료 없음"}">
    ${[1, 2, 3].map((t) => `<i class="tick" style="left:${(t / MAX_Y) * 100}%"></i>`).join("")}
    ${isNum(b) ? `<span class="rw-sti ${zone(b)[1]}" style="width:${w(b)}"></span>` : ""}
    ${isNum(a) ? `<span class="rw-cash" style="width:${w(a)}"></span>` : ""}
    <em>${isNum(b) ? `${b.toFixed(1)}년` : "자료 없음"}${b > MAX_Y ? " ▶" : ""}</em></div>`;
}

const TREND = { improving: ["▲ 소진 감소", "pos"], worsening: ["▼ 소진 확대", "neg"], flat: ["＝ 비슷", ""], positive: ["FCF 플러스 전환", "pos"] };

const STALE_DAYS = 210;
const staleDays = (c) => (c.balanceSheetEnd ? Math.round((Date.now() - Date.parse(c.balanceSheetEnd)) / 864e5) : null);

function rows(list, fx) {
  return list.map((c) => {
    const cur = c.statementCurrency || "USD";
    const t = TREND[c.burnTrend?.state];
    const age = staleDays(c);
    return `<tr tabindex="0" data-key="${esc(c.id)}"><td class="first"><a href="${companyUrl(c.id)}" data-open="${esc(c.id)}">${esc(c.name)}</a><div class="sub">${esc(c.ticker)} · ${esc(marketLabel(c.market))}</div></td>
      <td>${bar(c)}</td><td class="r">${money(c.cashPlusSti, cur)}${cur !== "USD" && isNum(toUsd(c.cashPlusSti, cur, fx)) ? `<div class="sub">${money(toUsd(c.cashPlusSti, cur, fx))}</div>` : ""}</td>
      <td class="r">${money(c.fcfTtm, cur)}</td><td class="r">${pct(c.operatingMarginPct)}</td><td>${t ? `<span class="${t[1]}">${t[0]}</span>` : NO_DATA}</td>
      <td>${c.nextEarnings ? `${esc(c.nextEarnings)}<div class="sub ${c.daysToEarnings <= 14 ? "warn-text" : ""}">D-${Math.max(0, c.daysToEarnings)}</div>` : NO_DATA}</td>
      <td>${esc(c.balanceSheetEnd || "")}<div>${statusChip(c.runwayStatus === "filed" ? "filed" : "estimate", c.data.source || "")}${isNum(age) && age > STALE_DAYS ? `<span class="chip chip-warn" title="재무 기준일이 ${age}일 전 — 최신 분기 미반영">오래된 재무</span>` : ""}</div></td>
      <td>${c.postPeriodRaises?.length ? c.postPeriodRaises.map((r) => `<a class="chip chip-warn" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.date)} ${esc(r.form)}</a>`).join(" ") : '<span class="nd">없음</span>'}</td></tr>`;
  }).join("");
}
const HEAD = `<tr><th class="first">기업</th><th>런웨이</th><th class="r">현금+단기투자</th><th class="r">연간 FCF</th><th class="r">영업이익률</th><th>최근 소진 추세</th><th>다음 실적</th><th>기준일 · 출처</th><th>기준일 후 증자</th></tr>`;

export function renderRunway(root, { companies, fx, params }) {
  const markets = (params.mkt || "US,KR").split(",");
  const burning = companies.filter((c) => c.fcfPositive === false && (params.mkt === "all" || markets.includes(c.market)) && (isNum(c.runwayCashPlusStiYears) || isNum(c.runwayCashOnlyYears)))
    .sort((a, b) => (a.runwayCashPlusStiYears ?? a.runwayCashOnlyYears ?? 99) - (b.runwayCashPlusStiYears ?? b.runwayCashOnlyYears ?? 99));
  // Runway is meaningful for companies that lose money operating; an operating
  // profit with negative FCF is working capital or capex, financed differently.
  const list = burning.filter((c) => !(isNum(c.operatingMarginPct) && c.operatingMarginPct > 0));
  const opProfit = burning.filter((c) => isNum(c.operatingMarginPct) && c.operatingMarginPct > 0);
  const counts = ZONES.map(([, cls, label]) => [cls, label, list.filter((c) => zone(c.runwayCashPlusStiYears ?? c.runwayCashOnlyYears)[1] === cls).length]);
  const total = list.length || 1;
  const soon = list.filter((c) => isNum(c.daysToEarnings) && c.daysToEarnings >= 0 && c.daysToEarnings <= 14).length;
  root.innerHTML = `<section class="view-head"><p><a href="#companies">← 상장 기업</a></p><h1>현금·런웨이 모니터</h1>
    <p class="lede">FCF가 마이너스인 상장사가 지금 보유한 현금으로 몇 년을 버틸 수 있는지 보여 줍니다. 최근 12개월 소진액이 일정하다고 가정한 계산이며, 기준일 이후 증자는 현금에 더하지 않고 따로 표시합니다. 재무는 매일 수집되고 분기 실적 공시(10-Q·10-K, DART 분·반기 보고서)가 나오면 다음 실행에서 자동 반영됩니다.</p></section>
    <div class="rw-summary">${counts.map(([cls, label, n]) => `<div class="rw-seg ${cls}" style="flex:${Math.max(n, 0.4)}"><b>${n}</b><span>${esc(label)}</span></div>`).join("")}</div>
    <p class="sub">${list.length}개 영업적자·FCF 마이너스 기업 · 2주 안에 실적 발표 ${soon}개 · 막대: 진한 부분 = 현금만, 연한 부분 = 현금+단기투자, 눈금 1·2·3년 · 색: <span class="z-red-t">1년 미만</span> <span class="z-amber-t">1–2년</span> <span class="z-yellow-t">2–3년</span> <span class="z-green-t">3년 이상</span></p>
    <div class="tbl-wrap"><table class="grid rw-table"><thead>${HEAD}</thead><tbody>${rows(list, fx)}</tbody></table></div>
    ${opProfit.length ? `<details class="rw-op"><summary>영업이익은 흑자이지만 FCF가 마이너스인 기업 ${opProfit.length}곳 — 운전자본·설비투자 소진이라 런웨이 해석에 주의</summary>
      <div class="tbl-wrap"><table class="grid rw-table"><thead>${HEAD}</thead><tbody>${rows(opProfit, fx)}</tbody></table></div></details>` : ""}
    <p class="sub">한국 상장사는 DART 키(저장소 시크릿 DART_API_KEY)가 없으면 데이터 제공사의 연간 재무를 쓰므로 기준일이 오래될 수 있습니다("오래된 재무" 표시).</p>`;
  const order = list.map((c) => c.id);
  root.querySelectorAll("[data-open]").forEach((a) => a.addEventListener("click", (e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); openPanel(a.dataset.open, order); }));
}
