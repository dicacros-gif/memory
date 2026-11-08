// Industries: one card per industry with forecasts kept per source (never
// averaged), observed company revenue growth shown separately, coverage and
// dates; a card opens the industry's value chain.
import { esc, isNum, pct, NO_DATA, srcBtn, day } from "./format.js";
import { go, companyUrl } from "./state.js";
import { openPanel } from "./company.js";
import { monitorTable, industryPositionSection } from "./positioning.js";

const SORTS = {
  forecast: ["예측 성장률(상단)", (i) => i.forecastCagrRange?.[1] ?? null],
  observed: ["관측 매출 성장률", (i) => i.observed.medianRevenueGrowthPct],
  fcf: ["FCF 플러스 기업 비중", (i) => i.fcfPositiveShare],
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

function digestPanel(d, companies) {
  if (!d) return "";
  const byId = new Map((companies || []).map((c) => [c.id, c]));
  const co = (id, name) => `<a href="${companyUrl(id)}" data-open="${esc(id)}">${esc(byId.get(id)?.name || name || id)}</a>`;
  const items = [
    ...d.presets.flatMap((p) => [
      ...p.entered.map((id) => `<li><span class="chip chip-filed">새로 충족</span> ${co(id)} · <a href="#companies?preset=${esc(p.key)}">${esc(p.label)}</a></li>`),
      ...p.left.map((id) => `<li><span class="chip">조건 이탈</span> ${co(id)} · ${esc(p.label)}</li>`),
    ]),
    ...d.raises.map((r) => `<li><span class="chip chip-warn">증자 공시</span> ${co(r.id, r.name)} · ${esc(r.date)} ${esc(r.form)} ${srcBtn(r.url, "원문")}</li>`),
    ...d.moves.map((m) => `<li><span class="chip">가격</span> ${co(m.id, m.name)} · 직전 갱신 대비 ${pct(m.changePct)}</li>`),
    ...d.added.map((a) => `<li><span class="chip chip-new">편입</span> ${co(a.id, a.name)}</li>`),
    ...d.startupChanges.map((s) => `<li><span class="chip">스타트업</span> <a href="#startups/${esc(s.id)}">${esc(s.name)}</a> ${esc(s.from)} → ${esc(s.to)}</li>`),
  ];
  return `<section class="digest"><h2>오늘의 변화 <span class="sub">${d.since ? `${esc(d.since)} 이후` : "첫 실행 — 비교 기준 없음"} · ${esc(day(d.generatedAt))}</span></h2>
    <div class="digest-presets">${d.presets.map((p) => `<a class="preset-count" href="#companies?preset=${esc(p.key)}"><b>${p.count}</b><span>${esc(p.label)}</span><small>${esc(p.rule)}</small></a>`).join("")}</div>
    ${items.length ? `<ul class="digest-list">${items.slice(0, 30).join("")}</ul>` : '<p class="muted">직전 갱신 이후 조건 변화·증자 공시·큰 가격 변동이 없습니다.</p>'}
    <p class="sub">${esc(d.note)}</p></section>`;
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
      <dl class="ind-counts"><div><dt>미국</dt><dd>${i.counts.us}</dd></div><div><dt>한국</dt><dd>${i.counts.kr}</dd></div><div><dt>기타</dt><dd>${i.counts.other}</dd></div><div><dt>스타트업</dt><dd>${i.counts.startups}</dd></div></dl>
      <p class="sub">재무 수집 ${i.coverage.withFinancials}/${i.coverage.total} · FCF 플러스 ${isNum(i.fcfPositiveShare) ? `${i.fcfPositiveShare}%` : "자료 없음"} · 리서치 ${esc(day(i.researchDate) || "—")} · 수치 ${esc(day(i.dataDate) || "—")}</p>
    </article>`;
  root.innerHTML = `${digestPanel(digest, companies)}${monitorTable(positioning)}<section class="view-head"><h1>성장 산업</h1>
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
