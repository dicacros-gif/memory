// Click-through detail for the ten-bagger page: a stock opens its daily chart
// (data/tenbagger/daily/<ticker>.json, two years of adjusted closes) with
// a monthly long view (metrics.json series) and an explanation assembled only
// from collected fields; a startup opens its listed shareholders and stakes.
// Nothing here writes a number that is not in the loaded data.

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const link = (url, text) => (url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text)}</a>` : esc(text));
const day = (v) => (v ? String(v).slice(0, 10) : "");
const sign = (v, d = 1) => (isNum(v) ? `${v > 0 ? "+" : ""}${v.toFixed(d)}%` : "");
const pctHtml = (v) => (isNum(v) ? `<span class="${v >= 0 ? "up" : "down"}">${sign(v)}</span>` : "—");

export function money(value, currency = "USD") {
  if (!isNum(value)) return "—";
  const abs = Math.abs(value);
  if (currency === "KRW") {
    if (abs >= 1e12) return `${(value / 1e12).toFixed(2)}조원`;
    if (abs >= 1e8) return `${Math.round(value / 1e8).toLocaleString()}억원`;
    return `${Math.round(value).toLocaleString()}원`;
  }
  const sym = `${value < 0 ? "−" : ""}${currency === "USD" ? "$" : `${currency} `}`;
  if (abs >= 1e12) return `${sym}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sym}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sym}${(abs / 1e6).toFixed(1)}M`;
  return `${sym}${abs.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

// TradingView prefixes (screen.json) -> the exchange codes the daily files use.
const TV_TO_EXCHANGE = { AMEX: "NYSEAMERICAN", XETR: "XETRA", SIX: "SWX" };
export const normalizeTicker = (ticker) => {
  const [exchange, code] = String(ticker || "").split(":");
  return code ? `${TV_TO_EXCHANGE[exchange] || exchange}:${code}` : String(ticker || "");
};
const US = new Set(["NASDAQ", "NYSE", "NYSEAMERICAN", "AMEX", "NYSEARCA", "BATS"]);
const slug = (ticker) => ticker.replace(/:/g, "_").replace(/\//g, "-").replace(/\s/g, "");
const sameListing = (a, b) => {
  const [ea, ca] = normalizeTicker(a).split(":");
  const [eb, cb] = normalizeTicker(b).split(":");
  const krx = (e) => (e === "KOSDAQ" || e === "KOSPI" ? "KRX" : e === "TYO" ? "TSE" : US.has(e) ? "US" : e);
  return ca && ca === cb && krx(ea) === krx(eb);
};

let CTX = null;
let dialog = null;
const dailyCache = new Map();

export function initDetail(ctx) {
  CTX = ctx;
  dialog = document.getElementById("tbDetail");
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog || e.target.closest("[data-close]")) closeDetail();
  });
  dialog.addEventListener("close", () => { if (location.hash.startsWith("#stock=") || location.hash.startsWith("#startup=")) history.replaceState(null, "", location.pathname + location.search); });
  document.addEventListener("click", (e) => {
    const stock = e.target.closest("[data-stock]");
    if (stock) { e.preventDefault(); openStock(stock.dataset.stock); return; }
    const startup = e.target.closest("[data-startup]");
    if (startup) { e.preventDefault(); openStartup(startup.dataset.startup); }
  });
  const fromHash = () => {
    const m = /^#(stock|startup)=(.+)$/.exec(location.hash);
    if (!m) return;
    const value = decodeURIComponent(m[2]);
    if (m[1] === "stock") openStock(value); else openStartup(value);
  };
  window.addEventListener("hashchange", fromHash);
  fromHash();
}

function closeDetail() { if (dialog.open) dialog.close(); }
function show(html) {
  dialog.querySelector("[data-body]").innerHTML = html;
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
}

// Everything the page knows about one listing, from any of its datasets.
function lookup(ticker) {
  const t = normalizeTicker(ticker);
  let company = null, sector = null;
  for (const s of CTX.universe.sectors || []) for (const c of s.publicCompanies || []) if (sameListing(c.ticker, t)) { company = c; sector = s; }
  const historyCase = (CTX.universe.history?.cases || []).find((c) => sameListing(c.ticker, t)) || null;
  const metrics = [...CTX.metrics.values()].find((m) => sameListing(m.ticker, t)) || null;
  const screenRow = ["factorLeaders", "discovery"].flatMap((k) => CTX.screen?.[k] || [])
    .concat(CTX.screen?.recentTenBaggers?.stocks || [], CTX.screen?.recentTenBaggers?.oneYear || [])
    .find((r) => sameListing(r.ticker, t)) || null;
  const holdings = [];
  for (const s of CTX.universe.sectors || []) for (const st of s.startups || []) for (const h of st.holders || []) {
    if (String(h.holderTicker || "").split("/").some((x) => sameListing(x.trim(), t))) holdings.push({ startup: st, sector: s, holder: h });
  }
  let holderName = null;
  if (!company && holdings.length) holderName = holdings[0].holder.holder;
  return { ticker: company?.ticker || metrics?.ticker || t, company, sector, historyCase, metrics, screenRow, holdings, holderName };
}

// The file is named after whichever listing code the collector used; try the venue aliases.
async function loadDaily(ticker) {
  const t = normalizeTicker(ticker);
  const key = slug(t);
  if (!dailyCache.has(key)) {
    const [exchange, code] = t.split(":");
    const venues = US.has(exchange) ? [exchange, "NASDAQ", "NYSE", "NYSEAMERICAN"] : exchange === "KRX" || exchange === "KOSDAQ" ? [exchange, "KRX", "KOSDAQ"] : [exchange];
    const keys = [...new Set(venues.map((v) => slug(`${v}:${code}`)))];
    const get = (k) => fetch(`../data/tenbagger/daily/${k}.json`, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    dailyCache.set(key, keys.reduce((p, k) => p.then((d) => d || get(k)), Promise.resolve(null)));
  }
  return dailyCache.get(key);
}

// ── Chart ───────────────────────────────────────────────────────────────────
const RANGES = [["1M", 22], ["3M", 66], ["6M", 130], ["1Y", 252], ["2Y", 9999], ["10Y", "m120"], ["전체", "mall"]];

function chartSvg(points, currency) {
  if (!points || points.length < 2) return '<p class="muted">이 구간의 가격 데이터가 없습니다.</p>';
  const W = 760, H = 260, P = { l: 8, r: 64, t: 12, b: 24 };
  const values = points.map((p) => p[1]);
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || max || 1;
  const x = (i) => P.l + (i / (points.length - 1)) * (W - P.l - P.r);
  const y = (v) => P.t + (1 - (v - min) / span) * (H - P.t - P.b);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[1]).toFixed(1)}`).join("");
  const area = `${path}L${x(points.length - 1).toFixed(1)},${H - P.b}L${x(0).toFixed(1)},${H - P.b}Z`;
  const up = values.at(-1) >= values[0];
  const ticks = [max, (max + min) / 2, min].map((v) => `<text x="${W - P.r + 6}" y="${(y(v) + 4).toFixed(1)}">${esc(money(v, currency).replace(/^\$/, ""))}</text>`).join("");
  const labels = [0, Math.floor((points.length - 1) / 2), points.length - 1].map((i, k) => `<text x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="${["start", "middle", "end"][k]}">${esc(day(points[i][0]))}</text>`).join("");
  return `<svg class="tb-chart ${up ? "is-up" : "is-down"}" viewBox="0 0 ${W} ${H}" role="img" aria-label="종가 차트 ${esc(day(points[0][0]))}부터 ${esc(day(points.at(-1)[0]))}까지">
    <path class="area" d="${area}"/><path class="line" d="${path}"/>
    <g class="axis">${ticks}${labels}</g>
    <line class="cross" x1="0" x2="0" y1="${P.t}" y2="${H - P.b}" visibility="hidden"/><circle class="dot" r="3.5" visibility="hidden"/>
  </svg><div class="tb-chart-tip" hidden></div>`;
}

function wireChart(host, points, currency) {
  const svg = host.querySelector("svg");
  if (!svg) return;
  const tip = host.querySelector(".tb-chart-tip");
  const cross = svg.querySelector(".cross"), dot = svg.querySelector(".dot");
  const W = 760, H = 260, P = { l: 8, r: 64, t: 12, b: 24 };
  const values = points.map((p) => p[1]);
  const min = Math.min(...values), max = Math.max(...values), span = max - min || max || 1;
  const move = (clientX) => {
    const box = svg.getBoundingClientRect();
    const fx = ((clientX - box.left) / box.width) * W;
    const i = Math.max(0, Math.min(points.length - 1, Math.round(((fx - P.l) / (W - P.l - P.r)) * (points.length - 1))));
    const px = P.l + (i / (points.length - 1)) * (W - P.l - P.r);
    const py = P.t + (1 - (points[i][1] - min) / span) * (H - P.t - P.b);
    cross.setAttribute("x1", px); cross.setAttribute("x2", px); cross.setAttribute("visibility", "visible");
    dot.setAttribute("cx", px); dot.setAttribute("cy", py); dot.setAttribute("visibility", "visible");
    const from = points[0][1];
    tip.hidden = false;
    tip.textContent = `${day(points[i][0])} · ${money(points[i][1], currency)} · 구간 시작 대비 ${sign((points[i][1] / from - 1) * 100)}`;
  };
  svg.addEventListener("pointermove", (e) => move(e.clientX));
  svg.addEventListener("pointerleave", () => { cross.setAttribute("visibility", "hidden"); dot.setAttribute("visibility", "hidden"); tip.hidden = true; });
}

function renderChart(host, daily, monthly, currency, range) {
  let points = [];
  let note = "";
  if (typeof range === "number") {
    points = (daily?.points || []).slice(-range);
    note = daily ? `일간 수정종가 · ${link(daily.sourceUrl, "Yahoo Finance")} · ${esc(day(daily.asOf))} 기준` : "";
  } else {
    const series = (monthly || []).map((p) => [p.date, p.close]);
    points = range === "m120" ? series.slice(-120) : series;
    note = series.length ? `월간 수정종가 · ${esc(day(series.at(-1)?.[0]))} 기준` : "";
  }
  const ret = points.length > 1 ? (points.at(-1)[1] / points[0][1] - 1) * 100 : null;
  host.querySelector("[data-chart]").innerHTML = chartSvg(points, currency);
  host.querySelector("[data-chart-meta]").innerHTML = `${points.length > 1 ? `구간 수익률 ${pctHtml(ret)} · ` : ""}${note}`;
  wireChart(host.querySelector("[data-chart]"), points, currency);
}

// ── Explanations (assembled from fields; empty fields are left out) ────────
function stockStory(info) {
  const { company, sector, metrics: m, screenRow: r, holdings, historyCase } = info;
  const f = m?.fundamentals || null;
  const cur = f?.currency || m?.currency || "USD";
  const lines = [];
  if (company) {
    lines.push(`<b>${esc(sector?.name || "")}</b> 산업의 ${esc(company.subsector || "")} 기업으로, 이 리서치에서는 <b>${company.layer === "candidate" ? "후보층" : "선도·재평가층"}</b>으로 분류했습니다.`);
    if (company.thesis) lines.push(`${esc(company.thesis)} ${company.sourceUrl ? `(${link(company.sourceUrl, "출처")})` : ""}`);
  } else if (r) {
    lines.push(`TradingView 업종 분류상 <b>${esc(r.industryKo || r.industry || "")}</b> 종목이며, 큐레이션 목록 밖에서 스크리너로 찾은 종목입니다.`);
  } else if (historyCase) {
    lines.push(`과거 텐배거 사례로 수록된 종목입니다. ${esc(historyCase.preconditions || "")}`);
  }
  if (f && isNum(f.revenueTtm)) {
    lines.push(`매출은 ${money(f.revenueTtm, cur)}(${f.revenueBasis === "ttm" ? "최근 12개월" : "직전 회계연도"}, ${esc(day(f.revenueEnd))} 기준)${isNum(f.revenueGrowthPct) ? `, 성장률 ${sign(f.revenueGrowthPct)}` : ""}입니다.`);
  } else if (r && isNum(r.revenueGrowthPct)) {
    lines.push(`최근 12개월 매출 성장률은 ${sign(r.revenueGrowthPct)}입니다(TradingView).`);
  }
  if (f && isNum(f.fcfTtm)) {
    lines.push(f.fcfTtm >= 0
      ? `잉여현금흐름(FCF)은 ${money(f.fcfTtm, cur)}로 흑자${isNum(m.fcfMarginPct) ? `, FCF 마진 ${sign(m.fcfMarginPct)}` : ""}입니다. 외부 자금 없이 운영할 수 있는 상태입니다.`
      : `FCF는 ${money(f.fcfTtm, cur)}로 현금을 쓰고 있습니다. 현금+단기투자 ${money(f.cashAndShortTermInvestments, cur)} 기준 런웨이는 ${isNum(m.runwayYears) ? `약 ${m.runwayYears}년` : "산출 불가"}이며, 증자·차입은 반영하지 않았습니다.`);
  } else if (r && r.fcfPositive !== null && r.fcfPositive !== undefined) {
    lines.push(r.fcfPositive ? `FCF는 흑자${isNum(r.fcfMarginPct) ? `(마진 ${sign(r.fcfMarginPct)})` : ""}입니다.` : `FCF는 적자이며 런웨이는 ${isNum(r.runwayYears) ? `약 ${r.runwayYears}년` : "산출 불가"}입니다.`);
  }
  const capUsd = m?.marketCapUsd ?? r?.marketCapUsd ?? null;
  if (isNum(m?.marketCap) || isNum(capUsd)) {
    const cap = isNum(m?.marketCap) ? money(m.marketCap, m.currency) : money(capUsd);
    const ten = isNum(m?.marketCapNeededFor10x) ? money(m.marketCapNeededFor10x, m.currency) : money(capUsd * 10);
    lines.push(`시가총액 ${cap}${isNum(capUsd) && m?.currency !== "USD" ? ` (약 ${money(capUsd)})` : ""} — 주가가 10배가 되려면 시가총액이 ${ten}가 되어야 합니다.`);
  }
  const ret = m?.returns || {};
  const perf = [["1년", ret.m12 ?? r?.perf1yPct], ["3년", ret.m36], ["5년", ret.m60 ?? r?.perf5yPct]].filter(([, v]) => isNum(v));
  if (perf.length) lines.push(`수익률: ${perf.map(([k, v]) => `${k} ${sign(v)}`).join(" · ")}${isNum(m?.drawdownFromHighPct) ? ` · 월간 최고점 대비 ${sign(m.drawdownFromHighPct)}` : isNum(r?.offHighPct) ? ` · 52주 고점 대비 ${sign(r.offHighPct)}` : ""}.`);
  if (m?.tenBagger) {
    const t = m.tenBagger;
    lines.push(t.achieved ? `과거 텐배거 이력: ${esc(day(t.fromDate).slice(0, 7))} 저점에서 ${t.months}개월 만에 10배(${esc(day(t.toDate).slice(0, 7))}).` : `수집된 기간 중 저점 대비 최대 ${t.multiple}배까지 올랐고 10배에는 이르지 못했습니다.`);
  }
  if (m?.tv) {
    lines.push(m.tv.agrees === true ? `TradingView 수치와 교차검증 일치(성장률 차이 ${isNum(m.tv.growthDiffPp) ? `${m.tv.growthDiffPp}%p` : "—"}).`
      : m.tv.agrees === false ? `TradingView 수치와 차이가 있습니다(성장률 차이 ${isNum(m.tv.growthDiffPp) ? `${m.tv.growthDiffPp}%p` : "FCF 부호"}). 회계 기준일 차이일 수 있어 원문 확인이 필요합니다.` : "");
  }
  if (r?.factor && isNum(r.factor.score)) {
    lines.push(`연구 요인 점수 ${r.factor.score}/100 (동일 크기·추적 업종 종목 중 백분위: 규모 ${r.factor.size ?? "—"}, 가치 ${r.factor.value ?? "—"}, 수익성 ${r.factor.profitability ?? "—"}, FCF 수익률 ${r.factor.fcfYield ?? "—"}, 고점 거리 ${r.factor.offHigh ?? "—"}).`);
  }
  if (holdings.length) lines.push(`비상장 기업 ${holdings.length}곳의 지분을 보유하거나 투자했습니다 — 아래 표 참고.`);
  return lines.filter(Boolean).map((l) => `<p>${l}</p>`).join("");
}

function statGrid(info) {
  const { metrics: m, screenRow: r } = info;
  const f = m?.fundamentals || {};
  const cur = f.currency || m?.currency || "USD";
  const cells = [
    ["현재가", isNum(m?.price) ? money(m.price, m.currency) : "—"],
    ["시가총액", isNum(m?.marketCap) ? money(m.marketCap, m.currency) : money(r?.marketCapUsd)],
    ["매출", money(f.revenueTtm, cur)],
    ["매출 성장", pctHtml(f.revenueGrowthPct ?? r?.revenueGrowthPct)],
    ["FCF", money(f.fcfTtm, cur)],
    ["FCF 마진", pctHtml(m?.fcfMarginPct ?? r?.fcfMarginPct)],
    ["현금+단기투자", money(f.cashAndShortTermInvestments, cur)],
    ["런웨이", isNum(m?.runwayYears ?? r?.runwayYears) ? `${m?.runwayYears ?? r?.runwayYears}년` : (f.fcfTtm >= 0 || r?.fcfPositive) ? '<span class="up">흑자</span>' : "—"],
    ["1년 수익률", pctHtml(m?.returns?.m12 ?? r?.perf1yPct)],
    ["5년 수익률", pctHtml(m?.returns?.m60 ?? r?.perf5yPct)],
  ];
  return `<div class="tb-stats">${cells.map(([k, v]) => `<div><span>${esc(k)}</span><b>${v}</b></div>`).join("")}</div>`;
}

function holdingsTable(holdings, { clickableStartup = true } = {}) {
  if (!holdings.length) return "";
  return `<h3>보유·투자한 비상장 기업</h3><div class="tb-scroll"><table><thead><tr><th>스타트업</th><th>산업</th><th>지분율</th><th>투자 금액</th><th>근거 · 기준일</th></tr></thead><tbody>${holdings.map(({ startup, sector, holder: h }) => `<tr>
    <td>${clickableStartup ? `<button type="button" class="tb-link" data-startup="${esc(startup.name)}">${esc(startup.name)}</button>` : esc(startup.name)}</td><td>${esc(sector.name)}</td>
    <td class="num">${isNum(h.pctOwned) ? `<b>${h.pctOwned}%</b>` : '<span class="muted">미공개</span>'}</td><td class="num">${isNum(h.amountUsd) ? money(h.amountUsd) : "—"}</td>
    <td>${link(h.url, ({ filing: "공시", "company-disclosure": "회사 발표", reported: "보도" }[h.basis] || h.basis || "출처"))} ${esc(day(h.asOf))}</td></tr>`).join("")}</tbody></table></div>`;
}

export async function openStock(ticker) {
  if (!CTX) return;
  const info = lookup(ticker);
  const name = info.company?.name || info.screenRow?.name || info.historyCase?.name || info.holderName || info.ticker;
  const m = info.metrics;
  const currency = m?.currency || "USD";
  history.replaceState(null, "", `#stock=${encodeURIComponent(info.ticker)}`);
  show(`<header class="tb-detail-head"><div><span class="muted">${esc(info.ticker)}${info.sector ? ` · ${esc(info.sector.name)}` : ""}</span><h2>${esc(name)}</h2></div>
      <button type="button" class="tb-close" data-close aria-label="닫기">✕</button></header>
    <div class="tb-ranges" role="tablist">${RANGES.map(([label, v]) => `<button type="button" data-range="${v}" aria-selected="${label === "1Y"}">${label}</button>`).join("")}</div>
    <div class="tb-chart-host" data-chart><p class="muted">일간 차트 불러오는 중</p></div><p class="tb-note" data-chart-meta></p>
    ${statGrid(info)}
    <h3>설명</h3><div class="tb-story">${stockStory(info) || '<p class="muted">이 종목에 대해 수집된 설명 자료가 없습니다.</p>'}</div>
    ${holdingsTable(info.holdings)}
    <p class="tb-note">수치 출처: ${[m?.secCik ? link(`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${m.secCik}`, "SEC EDGAR") : "", m?.fundamentals?.sourceUrl ? link(m.fundamentals.sourceUrl, "Yahoo Finance 재무") : "", m?.tv || info.screenRow ? link("https://www.tradingview.com/screener/", "TradingView 스크리너") : ""].filter(Boolean).join(" · ") || "수집 대기"} · 투자 권유가 아닙니다.</p>`);
  const body = dialog.querySelector("[data-body]");
  const daily = await loadDaily(info.ticker);
  const monthly = m?.series || [];
  const ranges = body.querySelector(".tb-ranges");
  const usable = (v) => (v.startsWith("m") ? monthly.length > 1 : (daily?.points || []).length > 1);
  for (const b of ranges.children) b.disabled = !usable(b.dataset.range);
  const pick = (value) => {
    for (const b of ranges.children) b.setAttribute("aria-selected", String(b.dataset.range === value));
    renderChart(body, daily, monthly, daily?.currency || currency, /^\d+$/.test(value) ? Number(value) : value);
  };
  ranges.onclick = (e) => { const b = e.target.closest("button[data-range]"); if (b && !b.disabled) pick(b.dataset.range); };
  pick(daily?.points?.length ? "252" : monthly.length ? "m120" : "252");
}

export function openStartup(name) {
  if (!CTX) return;
  let startup = null, sector = null;
  for (const s of CTX.universe.sectors || []) for (const st of s.startups || []) if (st.name === name) { startup = st; sector = s; }
  if (!startup) return;
  history.replaceState(null, "", `#startup=${encodeURIComponent(name)}`);
  const holders = startup.holders || [];
  const disclosed = holders.filter((h) => isNum(h.pctOwned));
  const total = disclosed.reduce((s, h) => s + h.pctOwned, 0);
  const rows = holders.map((h) => {
    const tickers = String(h.holderTicker || "").split("/").map((x) => x.trim()).filter(Boolean);
    const m = tickers.map((t) => [...CTX.metrics.values()].find((x) => sameListing(x.ticker, t))).find(Boolean);
    return `<tr><td>${tickers.length ? tickers.map((t) => `<button type="button" class="tb-link" data-stock="${esc(t)}">${esc(h.holder)}</button><br><span class="muted">${esc(t)}</span>`).join("<br>") : esc(h.holder)}</td>
      <td class="num">${isNum(h.pctOwned) ? `<b>${h.pctOwned}%</b>` : '<span class="muted">미공개</span>'}</td>
      <td class="num">${isNum(h.amountUsd) ? money(h.amountUsd) : "—"}</td>
      <td>${link(h.url, ({ filing: "공시", "company-disclosure": "회사 발표", reported: "보도" }[h.basis] || h.basis || "출처"))}<br><span class="muted">${esc(day(h.asOf))}</span></td>
      <td class="num">${m ? `${money(m.marketCap, m.currency)}<br>${pctHtml(m.returns?.m12)}` : "—"}</td>
      <td class="wrap muted">${esc(h.note || "")}</td></tr>`;
  }).join("");
  show(`<header class="tb-detail-head"><div><span class="muted">${esc(sector.name)} · 비상장 · ${esc(startup.country || "")}</span><h2>${esc(startup.name)}</h2></div>
      <button type="button" class="tb-close" data-close aria-label="닫기">✕</button></header>
    <div class="tb-story"><p>${esc(startup.what || "")}</p>
      ${isNum(startup.valuationUsd) ? `<p>최근 기업가치 ${link(startup.valuationUrl, money(startup.valuationUsd))} (${esc(day(startup.valuationDate))}). 상장사가 이 회사에 투자하면 해당 상장사 주가로 간접 노출을 얻게 됩니다.</p>` : ""}
      <p>지분을 보유한 상장사 ${holders.length}곳 중 지분율이 공개된 곳은 ${disclosed.length}곳${disclosed.length ? `(공개 지분 합계 ${total.toFixed(2).replace(/\.?0+$/, "")}%)` : ""}입니다. 상장사 이름을 누르면 그 회사의 일간 차트와 설명이 열립니다.</p></div>
    <h3>지분 보유 상장사와 지분율</h3>
    <div class="tb-scroll"><table><thead><tr><th>상장사</th><th>지분율</th><th>투자 금액</th><th>근거 · 기준일</th><th>보유사 시총 · 1년</th><th class="wrap">비고</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="tb-note">지분율은 공시·회사 발표·보도에 명시된 값만 표시합니다. 이후 투자 라운드로 희석됐을 수 있습니다.</p>`);
}
