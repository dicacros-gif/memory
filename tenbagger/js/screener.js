// Listed Companies: one screener over the shared company data (curated
// industry members, listed startup shareholders and TradingView screen names).
// Filters and presets are shown as exact conditions; there is no composite score.
export { PRESETS, applyFilters };
import { esc, isNum, money, pct, years, multiple, statusChip, marketLabel, NO_DATA, toUsd } from "./format.js";
import { renderTable } from "./table.js";
import { PRESETS, applyFilters } from "./presets.js";
import { go, sortFromParam, sortToParam, companyUrl } from "./state.js";
import { openPanel } from "./company.js";

const DEFAULT_COLS = ["revenueGrowthPct", "fcfMarginPct", "runway", "priceToSales", "trend", "dataStatus"];
const DEFAULT_SORT = [{ key: "revenueGrowthPct", dir: "desc" }];

export function filterChips(p, industries, startups) {
  const chips = [];
  const ind = industries.find((i) => i.id === p.ind);
  if (ind) chips.push(["ind", `산업: ${ind.name}`]);
  if (p.mkt && p.mkt !== "US,KR") chips.push(["mkt", `시장: ${p.mkt === "all" ? "전체" : p.mkt.split(",").map(marketLabel).join("·")}`]);
  if (p.q) chips.push(["q", `검색: ${p.q}`]);
  if (p.cap) chips.push(["cap", `시가총액 ${p.cap.replace("-", "~")} $B`]);
  if (p.g) chips.push(["g", `매출 성장 ${p.g.replace("-", "~")}%`]);
  if (p.fcf) chips.push(["fcf", p.fcf === "pos" ? "FCF 플러스" : "FCF 마이너스"]);
  if (p.rw) chips.push(["rw", `FCF 플러스 또는 런웨이 ≥ ${p.rw}년`]);
  if (p.rwmax) chips.push(["rwmax", `런웨이 < ${p.rwmax}년`]);
  if (p.ps) chips.push(["ps", `P/S ≤ ${p.ps}배`]);
  if (p.off) chips.push(["off", `12개월 고점 대비 ≤ ${p.off}%`]);
  if (p.liq) chips.push(["liq", `일평균 거래대금 ≥ $${p.liq}M`]);
  if (p.cov) chips.push(["cov", { universe: "큐레이션 산업 기업", holder: "스타트업 지분 보유사", screen: "스크리너 발굴" }[p.cov]]);
  if (p.new) chips.push(["new", "신규 편입"]);
  if (p.status) chips.push(["status", p.status === "filed" ? "공시 재무" : "데이터 제공사 재무"]);
  if (p.layer) chips.push(["layer", p.layer === "candidate" ? "후보층" : "선도층"]);
  const st = startups.find((s) => s.id === p.stk);
  if (st) chips.push(["stk", `${st.name} 주주`]);
  return chips;
}

function columns(fx) {
  return [
    { key: "name", label: "기업 · 시장", fixed: true, value: (c) => c.name,
      render: (c) => `<a class="co-link" href="${companyUrl(c.id)}" data-open="${esc(c.id)}">${esc(c.name)}</a><div class="sub">${esc(c.ticker)} · ${esc(marketLabel(c.market))}${c.newlyAdded ? ' · <span class="chip chip-new">신규</span>' : ""}</div>`, csv: (c) => `${c.name} (${c.ticker})` },
    { key: "revenueGrowthPct", label: "매출 성장", num: true, title: "직전 회계연도 또는 누적 기간 전년 대비. 기준은 상세에서 확인", value: (c) => c.revenueGrowthPct,
      render: (c) => `${pct(c.revenueGrowthPct)}<div class="sub">${esc(c.revenueEnd || "")}</div>` },
    { key: "fcfMarginPct", label: "FCF 마진", num: true, title: "FCF ÷ 매출(같은 기간). FCF = 영업현금흐름 − 설비투자", value: (c) => c.fcfMarginPct,
      render: (c) => `${pct(c.fcfMarginPct)}<div class="sub">${c.fcfPositive === true ? "FCF 플러스" : c.fcfPositive === false ? "FCF 마이너스" : ""}</div>` },
    { key: "runway", label: "런웨이", num: true, title: "FCF 마이너스일 때 (현금+단기투자) ÷ 연간 소진액. 일정 소진 가정", value: (c) => (c.fcfPositive ? 999 : c.runwayCashPlusStiYears),
      render: (c) => (c.fcfPositive ? '<span class="pos">해당 없음 · FCF 플러스</span>' : `${years(c.runwayCashPlusStiYears)}<div class="sub">${c.runwayStatus === "filed" ? "공시 기준" : c.runwayStatus ? "추정" : ""}</div>`) },
    { key: "priceToSales", label: "P/S", num: true, title: "시가총액 ÷ 최근 매출(같은 통화)", value: (c) => c.priceToSales, render: (c) => multiple(c.priceToSales, "배") },
    { key: "trend", label: "가격 추세", num: true, title: "1년 수익률 · 12개월 고점 대비", value: (c) => c.returns?.m12,
      render: (c) => `${pct(c.returns?.m12)}<div class="sub">고점 ${isNum(c.returns?.offHigh12mPct) ? pct(c.returns.offHigh12mPct, { plain: true }) : "자료 없음"}</div>` },
    { key: "dataStatus", label: "데이터 상태", value: (c) => c.data.financials, render: (c) => `${statusChip(c.data.financials, c.data.source || "")}${c.data.staleFundamentals || c.data.stalePrices ? statusChip("stale") : ""}${c.postPeriodRaises?.length ? '<span class="chip chip-warn" title="기준일 이후 증자 관련 공시 — 현금에 합산하지 않음">기준일 후 증자 공시</span>' : ""}`,
      csv: (c) => c.data.financials },
    { key: "marketCapUsd", label: "시가총액(USD)", num: true, optional: true, value: (c) => c.marketCapUsd, render: (c) => money(c.marketCapUsd) },
    { key: "revenueTtm", label: "매출", num: true, optional: true, value: (c) => toUsd(c.revenueTtm, c.statementCurrency, fx), render: (c) => `${money(c.revenueTtm, c.statementCurrency || "USD")}<div class="sub">${esc(c.revenueBasis === "ttm" ? "최근 12개월" : c.revenueBasis ? "회계연도" : "")}</div>` },
    { key: "fcfTtm", label: "FCF", num: true, optional: true, value: (c) => toUsd(c.fcfTtm, c.statementCurrency, fx), render: (c) => money(c.fcfTtm, c.statementCurrency || "USD") },
    { key: "cashPlusSti", label: "현금+단기투자", num: true, optional: true, value: (c) => toUsd(c.cashPlusSti, c.statementCurrency, fx), render: (c) => `${money(c.cashPlusSti, c.statementCurrency || "USD")}<div class="sub">${esc(c.balanceSheetEnd || "")}</div>` },
    { key: "debt", label: "차입금", num: true, optional: true, value: (c) => toUsd(c.debt, c.statementCurrency, fx), render: (c) => money(c.debt, c.statementCurrency || "USD") },
    { key: "operatingMarginPct", label: "영업이익률", num: true, optional: true, value: (c) => c.operatingMarginPct, render: (c) => pct(c.operatingMarginPct) },
    { key: "dilutionPct", label: "주식 수 변화(1년)", num: true, optional: true, value: (c) => c.dilutionPct, render: (c) => pct(c.dilutionPct) },
    { key: "liquidity", label: "일평균 거래대금", num: true, optional: true, value: (c) => c._liqUsd, render: (c) => money(c._liqUsd) },
    { key: "industry", label: "산업", optional: true, value: (c) => c.industries[0]?.name || c.screen?.industryKo || c.screen?.industry || "", render: (c) => esc(c.industries.map((i) => i.name).join(", ") || c.screen?.industryKo || c.screen?.industry || "") || NO_DATA },
    { key: "coverage", label: "편입 경로", optional: true, value: (c) => c.coverage, render: (c) => esc({ universe: "산업 큐레이션", holder: "스타트업 주주", screen: "스크리너" }[c.coverage] || c.coverage) },
  ];
}

const CARD = (c) => `<div class="card-head"><a class="co-link" href="${companyUrl(c.id)}" data-open="${esc(c.id)}">${esc(c.name)}</a> <span class="sub">${esc(c.ticker)}</span></div>
  <dl class="card-grid"><div><dt>매출 성장</dt><dd>${pct(c.revenueGrowthPct)}</dd></div><div><dt>FCF 마진</dt><dd>${pct(c.fcfMarginPct)}</dd></div>
  <div><dt>런웨이</dt><dd>${c.fcfPositive ? "FCF 플러스" : years(c.runwayCashPlusStiYears)}</dd></div><div><dt>시가총액</dt><dd>${money(c.marketCapUsd)}</dd></div></dl>
  <details><summary>자세히</summary><p>P/S ${multiple(c.priceToSales, "배")} · 1년 ${pct(c.returns?.m12)} · ${statusChip(c.data.financials)}</p></details>`;

export function renderScreener(root, { companies, industries, startups, fx, params }) {
  const p = { ...params };
  const rows0 = companies.map((c) => ({ ...c, _liqUsd: toUsd(c.avgTradedValue20d, c.currency, fx) }));
  const rows = applyFilters(rows0, p, startups);
  const sort = sortFromParam(p.sort) || DEFAULT_SORT;
  const visible = p.cols ? p.cols.split(",") : DEFAULT_COLS;
  const selected = new Set((p.sel || "").split(",").filter(Boolean));
  const set = (patch, replace = true) => go("companies", Object.fromEntries(Object.entries({ ...p, ...patch }).filter(([, v]) => v !== null && v !== undefined && v !== "")), null, { replace });
  const chips = filterChips(p, industries, startups);
  const filed = rows.filter((c) => c.data.financials === "filed").length;
  root.innerHTML = `
    <section class="view-head"><h1>상장 기업</h1><p class="lede">미국·한국 상장사의 매출 성장, FCF, 런웨이, 밸류에이션을 같은 기준으로 비교합니다. 정렬·필터는 주소에 저장돼 공유할 수 있습니다. 순위는 정렬일 뿐 추천이 아닙니다.</p></section>
    <div class="presets" role="group" aria-label="프리셋">${Object.entries(PRESETS).map(([id, ps]) => `<button type="button" class="btn ${p.preset === id ? "on" : ""}" data-preset="${id}" title="${esc(ps.text)}">${esc(ps.label)}</button>`).join("")}</div>
    ${p.preset && PRESETS[p.preset] ? `<p class="preset-rule">조건: ${esc(PRESETS[p.preset].text)}</p>` : ""}
    <details class="filters" ${chips.length ? "open" : ""}><summary>필터 편집</summary>
      <form class="filter-form">
        <label>산업 <select name="ind"><option value="">전체</option>${industries.map((i) => `<option value="${esc(i.id)}" ${p.ind === i.id ? "selected" : ""}>${esc(i.name)}</option>`).join("")}</select></label>
        <label>시장 <select name="mkt"><option value="US,KR">미국+한국</option><option value="US" ${p.mkt === "US" ? "selected" : ""}>미국</option><option value="KR" ${p.mkt === "KR" ? "selected" : ""}>한국</option><option value="all" ${p.mkt === "all" ? "selected" : ""}>기타 시장 포함</option></select></label>
        <label>시가총액 $B <input name="cap" placeholder="예: 0.3-10" value="${esc(p.cap || "")}" size="8"></label>
        <label>매출 성장 % <input name="g" placeholder="예: 20-" value="${esc(p.g || "")}" size="7"></label>
        <label>FCF <select name="fcf"><option value="">전체</option><option value="pos" ${p.fcf === "pos" ? "selected" : ""}>플러스</option><option value="neg" ${p.fcf === "neg" ? "selected" : ""}>마이너스</option></select></label>
        <label>최소 런웨이(년, FCF 플러스 포함) <input name="rw" value="${esc(p.rw || "")}" size="4"></label>
        <label>최대 P/S <input name="ps" value="${esc(p.ps || "")}" size="4"></label>
        <label>고점 대비 ≤ % <input name="off" placeholder="-30" value="${esc(p.off || "")}" size="5"></label>
        <label>최소 거래대금 $M/일 <input name="liq" value="${esc(p.liq || "")}" size="5"></label>
        <label>재무 출처 <select name="status"><option value="">전체</option><option value="filed" ${p.status === "filed" ? "selected" : ""}>공시(SEC·DART)</option><option value="snapshot" ${p.status === "snapshot" ? "selected" : ""}>데이터 제공사</option></select></label>
        <label>층 <select name="layer"><option value="">전체</option><option value="candidate" ${p.layer === "candidate" ? "selected" : ""}>후보층</option><option value="leader" ${p.layer === "leader" ? "selected" : ""}>선도층</option></select></label>
        <label><input type="checkbox" name="new" value="1" ${p.new ? "checked" : ""}> 신규 편입만</label>
        <button class="btn primary" type="submit">적용</button>
      </form></details>
    <div class="chips-row">${chips.map(([k, label]) => `<button type="button" class="chip chip-filter" data-unset="${k}" aria-label="${esc(label)} 필터 해제">${esc(label)} ✕</button>`).join("")}${chips.length ? '<button type="button" class="btn link" data-clear>모두 해제</button>' : ""}<span class="muted live-count" aria-live="polite">${rows.length}개</span></div>
    ${selected.size ? `<div class="compare-bar">${selected.size}개 선택 <button type="button" class="btn primary" data-compare ${selected.size < 2 ? "disabled" : ""}>비교하기 (2~4개)</button> <button type="button" class="btn link" data-unselect>선택 해제</button></div>` : ""}
    <div id="screenTable"></div>`;
  root.querySelector(".filter-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    set({ ind: f.get("ind"), mkt: f.get("mkt") === "US,KR" ? null : f.get("mkt"), cap: f.get("cap"), g: f.get("g"), fcf: f.get("fcf"), rw: f.get("rw"), ps: f.get("ps"), off: f.get("off"), liq: f.get("liq"), status: f.get("status"), layer: f.get("layer"), new: f.get("new"), preset: null }, false);
  });
  root.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => {
    const keep = { ind: p.ind, mkt: p.mkt, sort: p.sort, cols: p.cols };
    go("companies", Object.fromEntries(Object.entries({ ...keep, ...PRESETS[b.dataset.preset].params, preset: b.dataset.preset }).filter(([, v]) => v)), null);
  }));
  root.querySelectorAll("[data-unset]").forEach((b) => b.addEventListener("click", () => set({ [b.dataset.unset]: null, preset: null }, false)));
  root.querySelector("[data-clear]")?.addEventListener("click", () => go("companies", { sort: p.sort, cols: p.cols }));
  root.querySelector("[data-compare]")?.addEventListener("click", () => go("companies", { ...p }, `compare`));
  root.querySelector("[data-unselect]")?.addEventListener("click", () => set({ sel: null }));
  const fxNote = fx?.rate ? ` · 원화 환산 ${fx.rate.toLocaleString("ko-KR")}원/$ (${fx.date}, FRED)` : "";
  const sorted = renderTable(root.querySelector("#screenTable"), {
    columns: columns(fx), rows, sort, visible, density: p.dens || "compact", rowKey: (c) => c.id, csvName: "tenbagger-companies",
    summary: `${esc(industries.find((i) => i.id === p.ind)?.name || "전체 산업")} · ${rows.length}개 기업 · 공시 재무 ${filed}개${esc(fxNote)}`,
    selectable: true, selected,
    onSelect: (id, on) => { const s = new Set(selected); if (on) s.add(id); else s.delete(id); set({ sel: [...s].slice(0, 4).join(",") || null }); },
    onSort: (next) => set({ sort: sortToParam(next) }), onColumns: (cols) => set({ cols: cols.join(",") }), onDensity: (d) => set({ dens: d === "compact" ? null : d }),
    onOpen: (c, list) => openPanel(c.id, list.map((x) => x.id)), card: CARD,
  });
  root.querySelectorAll("[data-open]").forEach((a) => a.addEventListener("click", (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return; // new tab: full page
    e.preventDefault();
    openPanel(a.dataset.open, sorted.map((x) => x.id));
  }));
}

/** Two to four companies side by side; periods are shown so mismatches are visible. */
export function renderCompare(root, { companies, params }) {
  const ids = (params.sel || "").split(",").filter(Boolean).slice(0, 4);
  const list = ids.map((id) => companies.find((c) => c.id === id)).filter(Boolean);
  const ends = new Set(list.map((c) => c.revenueEnd).filter(Boolean));
  const rows = [
    ["매출", (c) => `${money(c.revenueTtm, c.statementCurrency || "USD")}<div class="sub">${esc(c.revenueBasis === "ttm" ? "최근 12개월" : "회계연도")} · ${esc(c.revenueEnd || "기간 없음")}</div>`],
    ["매출 성장", (c) => `${pct(c.revenueGrowthPct)}<div class="sub">${esc(c.revenueGrowthBasis || "")}</div>`],
    ["영업이익률", (c) => pct(c.operatingMarginPct)], ["FCF", (c) => money(c.fcfTtm, c.statementCurrency || "USD")], ["FCF 마진", (c) => pct(c.fcfMarginPct)],
    ["현금+단기투자", (c) => `${money(c.cashPlusSti, c.statementCurrency || "USD")}<div class="sub">${esc(c.balanceSheetEnd || "")}</div>`],
    ["런웨이(현금만)", (c) => (c.fcfPositive ? "FCF 플러스" : years(c.runwayCashOnlyYears))], ["런웨이(현금+단기투자)", (c) => (c.fcfPositive ? "FCF 플러스" : years(c.runwayCashPlusStiYears))],
    ["시가총액(USD)", (c) => money(c.marketCapUsd)], ["P/S", (c) => multiple(c.priceToSales, "배")], ["1년 수익률", (c) => pct(c.returns?.m12)], ["재무 출처", (c) => statusChip(c.data.financials, c.data.source || "")],
  ];
  root.innerHTML = `<section class="view-head"><h1>기업 비교</h1>
    <p class="lede">${ends.size > 1 ? `<b class="neg">기간이 다릅니다:</b> ${[...ends].map(esc).join(", ")}. 같은 기간끼리만 직접 비교하세요.` : ends.size === 1 ? `모두 ${esc([...ends][0])} 기준입니다.` : "기간 정보가 없습니다."}</p>
    <a class="btn" href="#companies?${new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([k]) => k !== "")))}">← 목록으로</a></section>
    <div class="tbl-wrap"><table class="grid compare"><thead><tr><th class="first">항목</th>${list.map((c) => `<th class="r"><a href="${companyUrl(c.id)}">${esc(c.name)}</a><div class="sub">${esc(c.ticker)}</div></th>`).join("")}</tr></thead>
    <tbody>${rows.map(([label, f]) => `<tr><th class="first" scope="row">${label}</th>${list.map((c) => `<td class="r">${f(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
