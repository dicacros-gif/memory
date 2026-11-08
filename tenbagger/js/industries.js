// Industries: one card per industry with forecasts kept per source (never
// averaged), observed company revenue growth shown separately, coverage and
// dates; a card opens the industry's value chain.
import { esc, isNum, pct, NO_DATA, srcBtn, day } from "./format.js";
import { go, companyUrl } from "./state.js";
import { openPanel } from "./company.js";
import { monitorTable, industryPositionSection, regimeChip } from "./positioning.js";

const SORTS = {
  forecast: ["예측 성장률(상단)", (i) => i.forecastCagrRange?.[1] ?? null],
  observed: ["관측 매출 성장률", (i) => i.observed.medianRevenueGrowthPct],
  fcf: ["FCF 플러스 기업 비중", (i) => i.fcfPositiveShare],
  tenx: ["과거 10배 발생률", (i) => i.historicalTenX?.ratePct ?? null],
  fresh: ["데이터 최신순", (i) => Date.parse(i.dataDate || i.researchDate || "") || null],
};
const CHAIN = [["infrastructure", "인프라"], ["components", "부품·소재"], ["platforms", "플랫폼"], ["applications", "응용"], ["customers", "고객·수요처"], ["unassigned", "미분류"]];

function bar(range) {
  if (!range) return `<div class="cagr-bar unknown" title="연평균 성장률 전망 없음">전망 CAGR ${NO_DATA}</div>`;
  const [lo, hi] = range;
  const scale = (v) => Math.max(0, Math.min(100, (v / 50) * 100));
  return `<div class="cagr-bar" title="기관별 전망 범위(정의가 달라 평균하지 않음)"><span class="track"><span class="fill" style="left:${scale(lo)}%;width:${Math.max(2, scale(hi) - scale(lo))}%"></span></span>
    <b class="num">${lo === hi ? `${lo}%` : `${lo}~${hi}%`}</b><span class="sub">전망 연평균(기관별)</span></div>`;
}

// Colour language: green = newly meets a preset, red = left it, blue = newly
// added to coverage, amber = offering filing; every mark also carries a symbol.
const PRESET_COLOR = { "cash-growers": "c-green", pullback: "c-amber", "funding-risk": "c-red" };
function digestPanel(d, companies) {
  if (!d) return "";
  const byId = new Map((companies || []).map((c) => [c.id, c]));
  const name = (id) => byId.get(id)?.name || d.names?.[id] || id;
  const co = (id) => (byId.has(id) ? `<a href="${companyUrl(id)}" data-open="${esc(id)}">${esc(name(id))}</a>` : `<span>${esc(name(id))}</span>`);
  const added = new Set((d.added || []).map((a) => a.id));
  // One row per company, one cell per preset: ▲ newly meets, ▼ left, · unchanged.
  const ids = [...new Set(d.presets.flatMap((p) => [...p.entered, ...p.left]))];
  const max = Math.max(1, ...d.presets.map((p) => Math.max(p.count, p.prevCount ?? 0)));
  const tiles = d.presets.map((p) => {
    const delta = p.prevCount === null || p.prevCount === undefined ? null : p.count - p.prevCount;
    return `<a class="d-tile ${PRESET_COLOR[p.key] || ""}" href="#companies?preset=${esc(p.key)}">
      <span class="d-count">${p.count}</span><span class="d-delta ${delta > 0 ? "pos" : delta < 0 ? "neg" : ""}">${delta === null ? "기준 없음" : `${delta > 0 ? "▲ +" : delta < 0 ? "▼ −" : "＝ "}${Math.abs(delta)}`}</span>
      <span class="d-label">${esc(p.label)}</span><span class="d-rule">${esc(p.rule)}</span>
      <span class="d-bar"><i style="width:${(p.count / max) * 100}%"></i>${p.prevCount !== null && p.prevCount !== undefined ? `<b style="left:${(p.prevCount / max) * 100}%" title="직전 ${p.prevCount}"></b>` : ""}</span>
      <span class="d-flow"><span class="pos">▲ ${p.entered.length} 진입</span> <span class="neg">▼ ${p.left.length} 이탈</span></span></a>`;
  }).join("");
  const matrix = ids.length ? `<div class="tbl-wrap d-matrix"><table class="grid"><thead><tr><th class="first">기업</th>${d.presets.map((p) => `<th class="c">${esc(p.label)}</th>`).join("")}<th>비고</th></tr></thead><tbody>
    ${ids.slice(0, 40).map((id) => `<tr><td class="first">${co(id)}</td>${d.presets.map((p) => {
      const inNow = p.entered.includes(id), out = p.left.includes(id);
      return `<td class="c">${inNow ? '<span class="mark pos" title="새로 조건 충족">▲</span>' : out ? '<span class="mark neg" title="조건 이탈">▼</span>' : '<span class="mark nd" title="변화 없음">·</span>'}</td>`;
    }).join("")}<td>${added.has(id) ? '<span class="chip chip-added">+ 신규 편입</span>' : ""}</td></tr>`).join("")}
    </tbody></table></div>${ids.length > 40 ? `<p class="sub">외 ${ids.length - 40}개 기업</p>` : ""}` : "";
  const events = [
    ...d.raises.map((r) => `<li><span class="chip chip-warn">증자 공시</span> ${co(r.id)} · ${esc(r.date)} ${esc(r.form)} ${srcBtn(r.url, "원문")}</li>`),
    ...d.moves.map((m) => `<li><span class="chip ${m.changePct > 0 ? "chip-filed" : "chip-fail"}">${m.changePct > 0 ? "▲" : "▼"} 가격</span> ${co(m.id)} ${pct(m.changePct)}</li>`),
    ...d.startupChanges.map((x) => `<li><span class="chip">스타트업</span> <a href="#startups/${esc(x.id)}">${esc(x.name)}</a> ${esc(x.from)} → ${esc(x.to)}</li>`),
  ];
  return `<section class="digest"><h2>오늘의 변화 <span class="sub">${d.since ? `직전 갱신(${esc(d.since)}) 대비` : "첫 실행 — 비교 기준 없음"} · ${esc(day(d.generatedAt))}</span></h2>
    <div class="d-tiles">${tiles}</div>
    <p class="d-legend"><span class="mark pos">▲</span> 새로 조건 충족 · <span class="mark neg">▼</span> 조건 이탈 · <span class="chip chip-added">+ 신규 편입</span> 추적 대상에 새로 추가 · 막대 = 현재 수, 세로선 = 직전 수</p>
    ${matrix}
    ${events.length ? `<ul class="digest-list">${events.join("")}</ul>` : ""}
    ${!ids.length && !events.length ? '<p class="muted">직전 갱신 이후 조건 변화·증자 공시·큰 가격 변동이 없습니다.</p>' : ""}
    <p class="sub">${esc(d.note)}</p></section>`;
}

// 10x potential: industries side by side on the measures that matter, each
// cell coloured by its rank among industries (green top third, red bottom).
function potentialMatrix(industries, positioning) {
  const pos = new Map((positioning?.industries || []).map((r) => [r.id, r]));
  const cols = [
    ["과거 10배 발생률", (i) => i.historicalTenX?.ratePct, (v) => `${v.toFixed(2)}%`, "과거 표본(현재 상장 종목, 5년 창)에서 시작점 중 10배 도달 비율"],
    ["소형주 10배 발생률", (i) => i.historicalTenX?.small?.ratePct, (v) => `${v.toFixed(2)}%`, "시작 시가총액 10억 달러 미만"],
    ["관측 매출 성장", (i) => i.observed.medianRevenueGrowthPct, (v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`, "추적 상장사 중앙값"],
    ["전망 CAGR 상단", (i) => i.forecastCagrRange?.[1], (v) => `${v}%`, "기관별 전망 중 최고(정의 상이)"],
    ["FCF 플러스 비중", (i) => i.fcfPositiveShare, (v) => `${v}%`, "자금 여력"],
    ["모멘텀 백분위", (i) => pos.get(i.id)?.momentumPct, (v) => `${v}`, "자기 2년 이력 대비"],
  ];
  const ranks = cols.map(([, f]) => {
    const vals = industries.map(f).filter(isNum).sort((a, b) => a - b);
    return (v) => (!isNum(v) || vals.length < 3 ? "" : vals.indexOf(v) >= (vals.length * 2) / 3 ? "h-top" : vals.indexOf(v) < vals.length / 3 ? "h-low" : "h-mid");
  });
  const sorted = [...industries].sort((a, b) => (b.historicalTenX?.lift ?? -1) - (a.historicalTenX?.lift ?? -1));
  return `<section class="potential"><h2>10배 잠재 산업 비교 <span class="sub">색 = 산업 간 순위(초록 상위 1/3 · 빨강 하위 1/3) · 과거 발생률 배수 순</span></h2>
    <div class="tbl-wrap"><table class="grid heatmap"><thead><tr><th class="first">산업</th>${cols.map(([l, , , t]) => `<th class="r" title="${esc(t)}">${esc(l)}</th>`).join("")}<th class="r" title="과거 10배 발생률 ÷ 전체 기본률">기본률 대비</th><th>국면</th></tr></thead><tbody>
    ${sorted.map((i) => `<tr><td class="first"><a href="#industries/${esc(i.id)}">${esc(i.name)}</a></td>${cols.map(([, f, fmt], k) => { const v = f(i); return `<td class="r ${ranks[k](v)}">${isNum(v) ? fmt(v) : '<span class="nd">자료 없음</span>'}</td>`; }).join("")}
      <td class="r">${isNum(i.historicalTenX?.lift) ? `<b class="${i.historicalTenX.lift >= 1.5 ? "pos" : i.historicalTenX.lift < 0.8 ? "neg" : ""}">${i.historicalTenX.lift.toFixed(2)}×</b><div class="sub">${i.historicalTenX.hits}/${i.historicalTenX.n}</div>` : '<span class="nd">자료 없음</span>'}</td>
      <td>${pos.get(i.id) ? regimeChip(pos.get(i.id).regime) : ""}</td></tr>`).join("")}</tbody></table></div>
    <p class="sub">과거 발생률은 TradingView 업종 분류로 묶은 과거 표본의 빈도이며 미래 확률이 아닙니다. 사이버보안·에너지저장은 다른 산업과 업종이 겹칩니다. 생존 편향(상장폐지 제외)이 있습니다.</p></section>`;
}

const MEDIANS = [
  ["forwardPE", "선행 P/E", (v) => v.toFixed(1)], ["priceToSales", "P/S", (v) => v.toFixed(1)],
  ["revenueCagr3yPct", "매출 3년 CAGR", (v) => `${v.toFixed(0)}%`], ["grossMarginPct", "매출총이익률", (v) => `${v.toFixed(0)}%`],
  ["ruleOf40", "Rule of 40", (v) => v.toFixed(0)], ["fcfYieldPct", "FCF 수익률", (v) => `${v.toFixed(1)}%`],
  ["netCashToMcapPct", "순현금/시총", (v) => `${v.toFixed(0)}%`], ["roePct", "ROE", (v) => `${v.toFixed(0)}%`],
];

/** Industry medians of the per-stock quant indicators (n = companies with a value). */
export function medianStrip(m) {
  if (!m) return "";
  const cells = MEDIANS.filter(([k]) => isNum(m[k]?.median));
  if (!cells.length) return "";
  return `<dl class="ind-medians" title="추적 상장사 지표의 중앙값 · n = 값이 있는 기업 수">${cells.map(([k, l, f]) => `<div><dt>${esc(l)}</dt><dd>${esc(f(m[k].median))}<span class="sub"> n${m[k].n}</span></dd></div>`).join("")}</dl>`;
}

export function renderIndustries(root, { industries, params, digest, companies, positioning }) {
  const sortKey = SORTS[params.sort] ? params.sort : "forecast";
  const value = SORTS[sortKey][1];
  const ranked = industries.filter((i) => isNum(value(i))).sort((a, b) => value(b) - value(a));
  const unranked = industries.filter((i) => !isNum(value(i)));
  const card = (i) => `<article class="ind-card" tabindex="0" data-ind="${esc(i.id)}">
      <h2>${esc(i.name)}</h2>
      ${bar(i.forecastCagrRange)}
      <p class="sub">${i.forecastPeriods.length ? `전망 기간 ${i.forecastPeriods.map(esc).join(" · ")}` : "전망 기간 자료 없음"}</p>
      <div class="obs"><span>관측</span> ${pct(i.observed.medianRevenueGrowthPct)} <span class="sub">추적 상장사 ${i.observed.companies}곳의 최근 매출 성장률 중앙값(실적)</span></div>
      <div class="obs tenx"><span>과거</span> ${isNum(i.historicalTenX?.ratePct) ? `10배 발생률 ${i.historicalTenX.ratePct.toFixed(2)}% <b class="${i.historicalTenX.lift >= 1.5 ? "pos" : i.historicalTenX.lift < 0.8 ? "neg" : ""}">(기본률의 ${i.historicalTenX.lift.toFixed(2)}배)</b>` : '<span class="nd">자료 없음</span>'}</div>
      ${medianStrip(i.medians)}
      <dl class="ind-counts"><div><dt>미국</dt><dd>${i.counts.us}</dd></div><div><dt>한국</dt><dd>${i.counts.kr}</dd></div><div><dt>기타</dt><dd>${i.counts.other}</dd></div><div><dt>스타트업</dt><dd>${i.counts.startups}</dd></div></dl>
      <p class="sub">재무 수집 ${i.coverage.withFinancials}/${i.coverage.total} · FCF 플러스 ${isNum(i.fcfPositiveShare) ? `${i.fcfPositiveShare}%` : "자료 없음"} · 리서치 ${esc(day(i.researchDate) || "—")} · 수치 ${esc(day(i.dataDate) || "—")}</p>
    </article>`;
  root.innerHTML = `${digestPanel(digest, companies)}${potentialMatrix(industries, positioning)}${monitorTable(positioning)}<section class="view-head"><h1>성장 산업</h1>
      <p class="lede">기관 전망(예측)과 추적 상장사의 실제 매출 성장(관측)을 따로 보여 줍니다. 기관마다 시장 정의와 기간이 달라 전망치는 평균하지 않고 범위로만 표시합니다.</p>
      <label class="inline">정렬 <select data-sort>${Object.entries(SORTS).map(([k, [l]]) => `<option value="${k}" ${k === sortKey ? "selected" : ""}>${l}</option>`).join("")}</select></label></section>
    <div class="ind-grid">${ranked.map(card).join("")}</div>
    ${unranked.length ? `<h2 class="sub-h">순위 없음 — ${esc(SORTS[sortKey][0])} 자료 없음</h2><div class="ind-grid">${unranked.map(card).join("")}</div>` : ""}`;
  root.querySelector("[data-sort]").addEventListener("change", (e) => go("industries", { sort: e.target.value }, null, { replace: true }));
  const order = [...root.querySelectorAll(".digest [data-open]")].map((a) => a.dataset.open);
  root.querySelectorAll(".digest [data-open]").forEach((a) => a.addEventListener("click", (e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); openPanel(a.dataset.open, order); }));
  root.querySelectorAll("[data-ind]").forEach((el) => {
    const open = () => go("industries", {}, el.dataset.ind);
    el.addEventListener("click", open);
    el.addEventListener("keydown", (e) => { if (e.key === "Enter") open(); });
  });
}

export function renderIndustry(root, { industry: i, companies, positioning }) {
  const byId = new Map(companies.map((c) => [c.id, c]));
  const chain = CHAIN.filter(([k]) => i.chain[k]?.length).map(([k, label]) => `<div class="chain-col"><h3>${label}</h3><ul>${i.chain[k].map((id) => byId.get(id)).filter(Boolean)
    .sort((a, b) => (b.marketCapUsd || 0) - (a.marketCapUsd || 0))
    .map((c) => `<li><a href="${companyUrl(c.id)}" data-open="${esc(c.id)}">${esc(c.name)}</a> <span class="sub">${esc(c.ticker)}</span><span class="sub">${esc(c.industries.find((x) => x.id === i.id)?.chainNote || c.industries.find((x) => x.id === i.id)?.subsector || "")}</span></li>`).join("")}</ul></div>`).join("");
  root.innerHTML = `<section class="view-head"><p><a href="#industries">← 산업 목록</a></p><h1>${esc(i.name)}</h1><p class="lede">${esc(i.summary || "")}</p>
      <a class="btn primary" href="#companies?ind=${esc(i.id)}">이 산업 기업을 스크리너로 보기 →</a></section>
    ${industryPositionSection((positioning?.industries || []).find((r) => r.id === i.id))}
    <section><h2>가치사슬 — 성장의 수혜가 어디로 흐르는가</h2><p class="muted">인프라 → 부품·소재 → 플랫폼 → 응용 → 고객 순서. 대표 기업만이 아니라 공급망 전체를 봅니다. 미분류는 아직 층을 지정하지 않은 기업입니다.</p><div class="chain">${chain || '<p class="muted">가치사슬 자료 없음</p>'}</div></section>
    <section><h2>기관 전망 (기관별 · 평균하지 않음)</h2><div class="tbl-wrap"><table class="grid"><thead><tr><th class="first">기관 · 발표일</th><th>지표와 정의</th><th class="r">기준</th><th class="r">전망</th><th class="r">연평균</th><th>출처</th></tr></thead><tbody>
      ${i.forecasts.map((f) => `<tr><td class="first">${esc(f.institution)}<div class="sub">${esc(day(f.publishedAt))}</div></td><td class="wrap">${esc(f.metric)}<div class="sub">${esc(f.definition || "정의 자료 없음")}</div></td>
        <td class="r">${esc(f.baseValue || "")} ${f.baseYear ? `(${esc(f.baseYear)})` : ""}</td><td class="r">${esc(f.targetValue || "")} ${f.targetYear ? `(${esc(f.targetYear)})` : ""}</td>
        <td class="r">${isNum(f.cagrPct) ? `${f.cagrPct}%` : NO_DATA}</td><td>${srcBtn(f.url, "원문")}</td></tr>`).join("")}</tbody></table></div></section>
    <section><h2>관측 성장 (실적)</h2><p>추적 상장사 ${i.observed.companies}곳의 최근 매출 성장률 중앙값 ${pct(i.observed.medianRevenueGrowthPct)} — ${esc(i.observed.basis)}</p>
      ${i.observed.tvIndustries.length ? `<p class="sub">TradingView 업종 실측(해당 업종 전체 상장사): ${i.observed.tvIndustries.map((t) => `${esc(t.industryKo || t.industry)} ${pct(t.medianGrowthPct)} (${t.companies}곳)`).join(" · ")}</p>` : ""}</section>`;
  const order = [...root.querySelectorAll("[data-open]")].map((a) => a.dataset.open);
  root.querySelectorAll("[data-open]").forEach((a) => a.addEventListener("click", (e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); openPanel(a.dataset.open, order); }));
}
