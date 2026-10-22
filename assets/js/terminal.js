// Semiconductor terminal.
//
// One page, keyboard first: a command line ("MU GP", "000660 DES", "MON"),
// function keys, and screens that read only data/terminal-client.json from
// the published run. The artifact must carry the manifest's runId; a mixed or
// missing snapshot shows a data-state message instead of older numbers.

(() => {
  "use strict";

  const DATA = "../data/";
  const REFRESH_MS = 5 * 60 * 1000;
  const FUNCTIONS = ["TOP", "ALRT", "MON", "GP", "COMP", "DES", "BRKR", "BTST", "CORR", "ETF", "EQRV", "MEM", "ECO", "SCRN", "CAL", "RISK", "N", "SRC", "HELP"];
  const KEY_TO_FN = { 1: "TOP", 2: "MON", 3: "GP", 4: "DES", 5: "EQRV", 6: "MEM", 7: "ECO", 8: "SCRN", 9: "CAL", 0: "RISK", n: "N", s: "SRC", b: "BRKR", c: "COMP", a: "ALRT", x: "CORR", e: "ETF", t: "BTST", "?": "HELP" };
  const FN_TITLE = {
    TOP: ["TOP", "오늘의 투자 판단"],
    MON: ["MON", "반도체 시장 모니터"],
    GP: ["GP", "가격 차트"],
    COMP: ["COMP", "상대 성과 비교"],
    ALRT: ["ALRT", "오늘의 알림·기술적 스캔"],
    CORR: ["CORR", "수익률 상관관계"],
    ETF: ["ETF", "반도체 ETF"],
    BTST: ["BTST", "전략 백테스트"],
    BRKR: ["BRKR", "증권사 리서치·의견 변경"],
    DES: ["DES", "종목 개요"],
    EQRV: ["EQRV", "상대 가치"],
    MEM: ["MEM", "메모리 가격 모니터"],
    ECO: ["ECO", "매크로·환율·지수"],
    SCRN: ["SCRN", "글로벌 반도체 스크리너"],
    CAL: ["CAL", "실적 일정·촉매"],
    RISK: ["RISK", "논지 폐기 조건·시나리오"],
    N: ["NEWS", "검증 뉴스"],
    SRC: ["SRC", "데이터 소스·방법론"],
    HELP: ["HELP", "명령어"],
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const main = $("#terminalMain");
  const state = {
    data: null,
    manifest: null,
    fn: "TOP",
    securityId: "micron-stock",
    back: [],
    monitor: { region: "all", chain: "all", sort: null, dir: -1 },
    screener: { country: "all", sort: "marketCap", dir: -1 },
    eqrv: { x: "earningsGrowth", y: "forwardPe", chain: "all" },
    news: "all",
    newsCategory: "all",
    comp: { group: "coverage", range: "1Y" },
    brokers: { filter: "all" },
    alerts: { kind: "all" },
    chart: { instance: null, range: "1Y", type: "candle", indicators: { MA: true, BOLL: false, VOL: true, MACD: false, RSI: true } },
    barsCache: new Map(),
  };

  // ── Formatting ────────────────────────────────────────────────────────────
  const isNum = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  const dash = '<span class="muted">—</span>';
  const tone = (value, inverse = false) => {
    if (!isNum(value) || Number(value) === 0) return "flat";
    return (Number(value) > 0) !== inverse ? "up" : "down";
  };
  function fixed(value, digits = 2) {
    if (!isNum(value)) return null;
    return Number(value).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
  function priceText(value) {
    if (!isNum(value)) return null;
    const number = Number(value);
    const digits = Math.abs(number) >= 1000 ? 0 : Math.abs(number) >= 100 ? 1 : Math.abs(number) >= 1 ? 2 : 4;
    return fixed(number, digits);
  }
  const price = (value) => (priceText(value) ?? dash);
  const num = (value, digits = 1, suffix = "") => (isNum(value) ? `${fixed(value, digits)}${suffix}` : dash);
  function pct(value, { digits = 1, signed = true, inverse = false } = {}) {
    if (!isNum(value)) return dash;
    const number = Number(value);
    const text = `${signed && number > 0 ? "+" : ""}${fixed(number, Math.abs(number) >= 100 ? 0 : digits)}%`;
    return `<span class="${tone(number, inverse)}">${text}</span>`;
  }
  function pp(value, digits = 1) {
    if (!isNum(value)) return dash;
    const number = Number(value);
    return `<span class="${tone(number)}">${number > 0 ? "+" : ""}${fixed(number, digits)}%p</span>`;
  }
  function big(value, currency = "") {
    if (!isNum(value)) return dash;
    const number = Number(value);
    if (currency === "KRW") {
      return number >= 1e12 ? `${fixed(number / 1e12, 1)}조원` : `${fixed(number / 1e8, 0)}억원`;
    }
    const scaled = number >= 1e12 ? `${fixed(number / 1e12, 2)}T` : number >= 1e9 ? `${fixed(number / 1e9, 1)}B` : number >= 1e6 ? `${fixed(number / 1e6, 0)}M` : fixed(number, 0);
    return `${scaled}${currency ? ` <small class="muted">${esc(currency)}</small>` : ""}`;
  }
  function day(value) {
    const text = String(value || "");
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${Number(match[2])}/${Number(match[3])}`;
    if (/^\d{4}-(?:\d{2}|Q[1-4])$/.test(text)) return text.replace(/^20/, "'");
    return text || "—";
  }
  function stamp(value) {
    const time = Date.parse(value || "");
    if (!Number.isFinite(time)) return "—";
    return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(time));
  }
  function spark(values = [], width = 120, height = 22) {
    const list = (values || []).filter(isNum).map(Number);
    if (list.length < 2) return "";
    const min = Math.min(...list);
    const max = Math.max(...list);
    const span = max - min || 1;
    const points = list.map((value, index) => `${((index / (list.length - 1)) * width).toFixed(1)},${(height - 2 - ((value - min) / span) * (height - 4)).toFixed(1)}`).join(" ");
    return `<svg class="t-spark" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><polyline class="${tone(list.at(-1) - list[0])}" points="${points}" /></svg>`;
  }
  const RATING = { strong_buy: "Strong Buy", buy: "Buy", hold: "Hold", underperform: "Underperform", sell: "Sell", strong_sell: "Strong Sell", none: "—" };
  const rating = (value) => (value ? RATING[String(value).toLowerCase()] || String(value) : "—");
  // Bloomberg-style composite tickers: MU US, 000660 KS, 8035 JT, 688981 CH.
  const BBG_SUFFIX = [[/\.KS$/, " KS"], [/\.KQ$/, " KQ"], [/\.T$/, " JT"], [/\.SS$/, " CH"], [/\.SZ$/, " CH"], [/\.TWO$/, " TT"], [/\.TW$/, " TT"], [/\.AS$/, " NA"]];
  function bbg(symbol = "") {
    const text = String(symbol);
    if (text.startsWith("^")) return `${text.slice(1)} Index`;
    for (const [pattern, code] of BBG_SUFFIX) if (pattern.test(text)) return text.replace(pattern, code);
    return `${text} US`;
  }
  const chip = (label, kind = "neutral") => `<span class="t-chip is-${esc(kind)}">${esc(label)}</span>`;
  const link = (url, label) => (url && /^https?:\/\//.test(url) ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>` : esc(label));
  const jump = (fn, id, label) => `<a href="#${esc(fn)}/${esc(id)}">${esc(label)}</a>`;
  const panel = (title, body, { meta = "", cls = "", flush = false } = {}) => `
    <section class="t-panel ${cls}">
      <header><h2>${esc(title)}</h2>${meta ? `<span>${meta}</span>` : ""}</header>
      <div class="t-panel-body${flush ? " is-flush" : ""}">${body}</div>
    </section>`;
  // Bloomberg's "Related Functions" menu: numbered jumps under each screen.
  const RELATED = {
    TOP: ["ALRT", "MON", "RISK", "BRKR", "CAL"], ALRT: ["TOP", "MON", "GP", "BRKR"], MON: ["EQRV", "COMP", "SCRN", "ALRT"],
    GP: ["DES", "COMP", "BTST", "BRKR"], DES: ["GP", "BRKR", "BTST", "EQRV"], BRKR: ["DES", "CAL", "EQRV"], BTST: ["GP", "COMP", "CORR"],
    COMP: ["GP", "CORR", "BTST"], CORR: ["COMP", "BTST", "MON"], ETF: ["MON", "COMP"], EQRV: ["DES", "BRKR", "SCRN"],
    MEM: ["TOP", "RISK", "ECO"], ECO: ["MEM", "RISK", "COMP"], SCRN: ["MON", "EQRV"], CAL: ["BRKR", "DES", "N"], RISK: ["TOP", "MEM", "ALRT"],
    N: ["BRKR", "CAL"], SRC: ["HELP"], HELP: ["TOP"],
  };
  const head = (fn, extra = "", note = "") => {
    const [code, title] = FN_TITLE[fn] || [fn, ""];
    const related = (RELATED[fn] || []).map((item, index) => `<button type="button" data-fn-jump="${esc(item)}"><b>${index + 1})</b> ${esc(item)} <span>${esc(FN_TITLE[item]?.[1] || "")}</span></button>`).join("");
    return `<header class="t-screen-head"><h1>${esc(code)}<small>${esc(title)}${extra ? ` · ${extra}` : ""}</small></h1><p>${note}</p></header>${related ? `<nav class="t-related" aria-label="관련 기능"><em>Related Functions</em>${related}</nav>` : ""}`;
  };

  function renderSecurityBar() {
    const bar = $("#terminalSecurity");
    const row = security();
    if (!bar || !row) return;
    const change = row.price.ret1d;
    bar.innerHTML = `
      <strong class="yellow">${esc(bbg(row.symbol))} <span>${row.isIndex ? "Index" : "Equity"}</span></strong>
      <span class="t-sec-name">${esc(row.name)}</span>
      <b class="t-sec-last">${price(row.price.last)}</b><span class="${tone(change)}">${isNum(change) ? `${change > 0 ? "▲" : change < 0 ? "▼" : ""} ${pct(change)}` : dash}</span>
      <span><i>52W</i>${price(row.price.yearLow ?? null)} – ${price(row.price.yearHigh ?? null)}</span>
      <span><i>고점 대비</i>${pct(row.price.fromHigh52)}</span>
      <span><i>P/E</i>${num(row.valuation.pe, 1)} <i>Fwd</i>${num(row.valuation.forwardPe, 1)}</span>
      <span><i>TGT</i>${price(row.consensus.targetMedian)} ${pct(row.consensus.upside)}</span>
      <span><i>RSI</i>${num(row.scan?.rsi, 1)}</span>
      <span>${signalChip(row.signal)}</span>
      <span class="t-sec-actions">${["GP", "DES", "BRKR", "BTST"].map((fn) => `<button type="button" data-fn-jump="${fn}">${fn}</button>`).join("")}</span>`;
  }

  // ── Data ──────────────────────────────────────────────────────────────────
  async function fetchJson(path, { reload = false } = {}) {
    const response = await fetch(path, { cache: reload ? "reload" : "no-cache" });
    if (!response.ok) throw new Error(`${path} HTTP ${response.status}`);
    return response.json();
  }

  async function loadData({ reload = false } = {}) {
    const manifest = await fetchJson(`${DATA}data-manifest.json`, { reload: true });
    const version = encodeURIComponent(manifest.cacheVersion || manifest.runId || Date.now());
    let data = await fetchJson(`${DATA}terminal-client.json?v=${version}`, { reload });
    if (data?.clientArtifact !== true || String(data.runId) !== String(manifest.runId)) {
      data = await fetchJson(`${DATA}terminal-client.json?v=${version}-r`, { reload: true });
    }
    if (data?.clientArtifact !== true || String(data.runId) !== String(manifest.runId)) {
      throw new Error("terminal artifact runId does not match the published manifest");
    }
    state.manifest = manifest;
    state.data = data;
    indexSecurities();
    return data;
  }

  const securityIndex = new Map();
  function indexSecurities() {
    securityIndex.clear();
    for (const row of state.data?.equities || []) {
      const keys = new Set([
        row.id,
        row.id.replace(/-stock$/, ""),
        row.symbol,
        row.symbol.replace(/\.[A-Z]+$/, ""),
        row.symbol.replace(/^\^/, ""),
        String(row.name || "").toUpperCase(),
        String(row.name || "").toUpperCase().replace(/[^A-Z0-9]/g, ""),
      ]);
      for (const key of keys) if (key) securityIndex.set(String(key).toUpperCase(), row);
    }
  }
  const equities = () => state.data?.equities || [];
  const security = (id = state.securityId) => equities().find((row) => row.id === id) || equities().find((row) => !row.isIndex) || null;
  function resolveSecurity(token = "") {
    const key = String(token).trim().toUpperCase();
    if (!key) return null;
    return securityIndex.get(key) || securityIndex.get(key.replace(/[^A-Z0-9.^]/g, "")) || null;
  }
  function suggestions(text = "") {
    const key = String(text).trim().toUpperCase();
    if (!key) return [];
    const fnMatches = FUNCTIONS.filter((fn) => fn.startsWith(key)).map((fn) => ({ kind: "fn", label: fn, detail: FN_TITLE[fn]?.[1] || "" }));
    const seen = new Set();
    const rows = [];
    for (const [entryKey, row] of securityIndex) {
      if (seen.has(row.id) || !entryKey.startsWith(key.split(/\s+/)[0])) continue;
      seen.add(row.id);
      rows.push({ kind: "security", label: row.symbol, detail: row.name, extra: row.valueChainLabel, id: row.id });
      if (rows.length >= 8) break;
    }
    return [...fnMatches, ...rows].slice(0, 10);
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  function go(fn, securityId = state.securityId, { push = true } = {}) {
    if (!FUNCTIONS.includes(fn)) fn = "TOP";
    if (push && (state.fn !== fn || state.securityId !== securityId)) state.back.push([state.fn, state.securityId]);
    state.fn = fn;
    if (securityId) state.securityId = securityId;
    const hash = ["GP", "DES"].includes(fn) ? `#${fn}/${state.securityId}` : `#${fn}`;
    if (location.hash !== hash) history.replaceState(null, "", hash);
    render();
  }
  function goBack() {
    const previous = state.back.pop();
    if (previous) go(previous[0], previous[1], { push: false });
  }
  function runCommand(raw = "") {
    const tokens = String(raw).trim().toUpperCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return;
    if (tokens[0] === "?" ) return go("HELP");
    if (FUNCTIONS.includes(tokens[0]) || tokens[0] === "NEWS") return go(tokens[0] === "NEWS" ? "N" : tokens[0]);
    // "MU US EQUITY GP" style: the last function token wins, every other
    // token narrows the security.
    const fnToken = [...tokens].reverse().find((token) => FUNCTIONS.includes(token));
    const securityTokens = tokens.filter((token) => !FUNCTIONS.includes(token) && !["US", "KS", "KQ", "JP", "JT", "CH", "TT", "NA", "EQUITY", "INDEX", "<EQUITY>", "<INDEX>", "<GO>", "GO"].includes(token));
    const found = resolveSecurity(securityTokens.join("")) || resolveSecurity(securityTokens[0]);
    if (!found) {
      message(`'${raw}' 종목·명령을 찾을 수 없음 · HELP 참고`);
      return;
    }
    go(fnToken || "DES", found.id);
  }
  function message(text) {
    const node = $("#terminalMessage");
    if (node) node.textContent = text;
  }

  // ── Screens ───────────────────────────────────────────────────────────────
  function signalChip(signal) {
    if (!signal) return dash;
    return `${chip(signal.label, signal.tone || "neutral")} <small class="muted">${esc(signal.action || "")}</small>`;
  }
  function scoreBar(score) {
    if (!isNum(score)) return '<span class="muted">미반영</span>';
    const value = Number(score);
    const cells = [-2, -1, 1, 2].map((step) => {
      const on = (value < 0 && step < 0 && step >= value) || (value > 0 && step > 0 && step <= value);
      return `<i class="${on ? `is-on ${step < 0 ? "down" : "up"}` : ""}"></i>`;
    }).join("");
    return `<span class="t-score" aria-label="점수 ${value}">${cells}</span> <b class="${tone(value)}">${value > 0 ? "+" : ""}${value}</b>`;
  }
  const statusKind = { ok: "ok", warn: "warn", kill: "kill", unknown: "unknown" };

  function verdictPanel(memo) {
    if (!memo?.verdict) return panel("IC MEMO", '<p class="t-empty">투자 판단 데이터 없음 · 다음 검증 실행 대기</p>');
    const verdict = memo.verdict;
    const composite = isNum(verdict.composite) ? Number(verdict.composite) : 0;
    const left = Math.max(0, Math.min(100, ((composite + 2) / 4) * 100));
    const reasons = (verdict.keyMessages || []).map((item, index) => `
      <li><b>${index + 1}</b><strong>${esc(item.label)} ${scoreBar(item.score)}</strong><span></span><small>${esc(item.verdict)} → ${esc(item.soWhat)}</small></li>`).join("");
    const changes = verdict.change?.items?.length
      ? `<ul class="t-changes">${verdict.change.items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`
      : `<p class="muted">${verdict.change?.prior ? `직전 판단(${esc(day(verdict.change.prior.asOf))}) 대비 변경 없음` : "판단 이력 축적 시작"}</p>`;
    return panel("IC MEMO · 업종 의견", `
      <div class="t-verdict">
        <div class="t-verdict-head">
          <span>${esc(verdict.sector)} · ${esc(day(memo.asOf))} 기준 · 규칙 기반</span>
          <strong>${esc(verdict.stance?.label || "판단 보류")} <small class="muted">${esc(verdict.stance?.labelEn || "")}</small></strong>
          <em>종합 점수<b class="${tone(composite)}">${composite > 0 ? "+" : ""}${fixed(composite, 2) ?? "—"}</b>확신도 ${esc(verdict.conviction?.label || "—")} · 커버리지 ${esc(verdict.coverage ?? "—")}%</em>
        </div>
        <div><div class="t-gauge" role="img" aria-label="종합 점수 ${composite}"><i style="left:${left.toFixed(1)}%"></i></div>
        <div class="t-gauge-scale"><span>−2 비중축소</span><span>−0.75</span><span>중립</span><span>+0.75</span><span>비중확대 +2</span></div></div>
        ${verdict.threshold ? `<p class="muted">${esc(verdict.threshold.label)} ${esc(fixed(verdict.threshold.distance, 2))}점${verdict.override ? ` · ${esc(verdict.override)}` : ""}</p>` : ""}
        <p class="t-tactic"><b class="amber">실행</b> ${esc(verdict.tactic || "")}</p>
        <p class="muted">${esc(verdict.summary || "")}</p>
        <ol class="t-reasons">${reasons}</ol>
        ${changes}
      </div>`, { meta: `run ${esc(state.data.runId)}` });
  }

  function factorPanel(memo) {
    const rows = (memo?.factors || []).map((factor) => `
      <tr><td class="is-text"><b>${esc(factor.label)}</b><small>${esc(factor.verdict || "")}</small></td>
      <td>${Math.round(Number(factor.weight || 0) * 100)}%</td><td>${scoreBar(factor.score)}</td></tr>`).join("");
    return panel("FACTOR SCORECARD", rows ? `<div class="t-scroll"><table class="t-table"><thead><tr><th>요인 · 판정</th><th>가중</th><th>점수</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="t-empty">요인 점수 없음</p>', { flush: true, meta: "−2 ~ +2" });
  }

  function killTable(rows = [], { rationale = false, compact = false } = {}) {
    if (!rows.length) return '<p class="t-empty">점검 지표 없음</p>';
    const thresholds = (row) => (compact
      ? `<td class="muted"><small>${esc(row.warn || "")}<br />${esc(row.kill || "")}</small></td>`
      : `<td class="muted">${esc(row.warn || "")}</td><td class="muted">${esc(row.kill || "")}</td>`);
    return `<div class="t-scroll"><table class="t-table"><thead><tr><th>지표</th><th>현재</th>${compact ? "<th>경고 · 폐기</th>" : "<th>경고</th><th>폐기</th>"}<th>상태</th>${compact ? "" : "<th>기준</th>"}</tr></thead><tbody>
      ${rows.map((row) => `<tr><td class="is-text"><b>${esc(row.label)}</b>${rationale ? `<small>${esc(row.rationale || "")}</small>` : compact ? `<small>${esc(day(row.asOf))}</small>` : ""}</td>
      <td><b class="${row.status === "kill" ? "down" : row.status === "warn" ? "amber" : ""}">${esc(row.display || "—")}</b></td>
      ${thresholds(row)}
      <td>${chip(row.statusLabel || row.status, statusKind[row.status] || "neutral")}</td>
      ${compact ? "" : `<td class="is-text"><small>${row.url ? link(row.url, row.source || "출처") : esc(row.source || "")} · ${esc(day(row.asOf))}</small></td>`}</tr>`).join("")}
    </tbody></table></div>`;
  }

  function scenarioBlock(memo, { full = false } = {}) {
    const scenarios = memo?.scenarios || [];
    if (!scenarios.length) return '<p class="t-empty">시나리오 없음</p>';
    const bar = `<div class="t-prob" role="img" aria-label="시나리오 확률">${scenarios.map((item) => `<span class="is-${esc(item.id)}" style="width:${Number(item.probability) || 0}%">${esc(item.label)} ${esc(item.probability)}%</span>`).join("")}</div>`;
    if (!full) {
      return `${bar}<ul class="t-changes" style="margin-top:8px">${scenarios.map((item) => `<li><b class="amber">${esc(item.label)}</b> ${esc(item.title)}</li>`).join("")}</ul>`;
    }
    return `${bar}<div class="t-scenarios" style="margin-top:10px">${scenarios.map((item) => `
      <article class="is-${esc(item.id)}"><h3>${esc(item.label)}<b>${esc(item.probability)}%</b></h3><p>${esc(item.title)}</p>
      <ul>${(item.watch || []).map((watch) => `<li><span>${esc(watch.label)}</span><span>${esc(watch.display)} ${chip(watch.statusLabel, statusKind[watch.status] || "neutral")}</span></li>`).join("")}</ul>
      <small>${esc(item.reference || "")}</small></article>`).join("")}</div>`;
  }

  function equityRow(row, { columns = "monitor" } = {}) {
    const selected = row.id === state.securityId ? " is-selected" : "";
    const base = `<td class="is-text"><span class="t-ticker">${esc(bbg(row.symbol))}</span><small>${esc(row.name)}</small></td>`;
    if (columns === "basket") {
      return `<tr data-security="${esc(row.id)}" tabindex="0" class="${selected}">${base}
        <td>${price(row.price.last)}<small>${esc(row.currency)}</small></td><td>${pct(row.price.ret1d)}</td><td>${pct(row.price.ret1m)}</td><td>${pct(row.price.ret1y)}</td>
        <td>${pct(row.price.fromHigh52)}</td><td>${num(row.valuation.forwardPe, 1, "x")}</td><td>${pct(row.consensus.upside)}</td><td>${pct(row.estimates?.trend?.rev90)}</td>
        <td class="is-text">${signalChip(row.signal)}</td><td>${spark(row.price.spark)}</td></tr>`;
    }
    return `<tr data-security="${esc(row.id)}" tabindex="0" class="${selected}">${base}
      <td class="is-text">${esc(row.valueChainLabel)}<small>${esc(row.regionLabel)} · ${esc(row.exchange || "")}</small></td>
      <td>${price(row.price.last)}<small>${esc(row.currency)}</small></td>
      <td>${pct(row.price.ret1d)}</td><td>${pct(row.price.ret1w)}</td><td>${pct(row.price.ret1m)}</td><td>${pct(row.price.ytd)}</td><td>${pct(row.price.ret1y)}</td>
      <td>${pct(row.price.fromHigh52)}</td><td>${pct(row.price.vsMa200)}</td>
      <td>${num(row.valuation.pe, 1, "x")}</td><td>${num(row.valuation.forwardPe, 1, "x")}</td><td>${num(row.valuation.evEbitda, 1, "x")}</td>
      <td>${pct(row.consensus.upside)}</td><td>${pct(row.estimates?.trend?.rev90)}</td>
      <td class="is-text">${signalChip(row.signal)}</td><td>${spark(row.price.spark)}</td></tr>`;
  }

  function renderTop() {
    const data = state.data;
    const memo = data.memo;
    const basketIds = new Set((memo?.basket?.names || []).length ? equities().filter((row) => row.memo).map((row) => row.id) : []);
    const basket = equities().filter((row) => basketIds.has(row.id));
    const estimates = data.estimates || {};
    const memoryRows = (data.memoryPrices || []).slice(0, 8).map((row) => `<tr><td class="is-text"><b>${esc(row.label)}</b><small>${esc(row.kind)} · ${esc(day(row.asOf))}</small></td><td>${price(row.last)}</td><td>${pct(row.chg30)}</td><td>${pct(row.chg90)}</td><td>${spark(row.spark)}</td></tr>`).join("");
    const earnings = (data.earnings || []).slice(0, 8).map((row) => `<tr data-security="${esc(row.id)}" tabindex="0"><td class="is-text"><span class="t-ticker">${esc(bbg(row.symbol))}</span><small>${esc(row.name)}</small></td><td>${esc(day(row.date))}</td><td>D${row.days >= 0 ? "-" : "+"}${Math.abs(row.days)}</td><td>${num(row.epsAverage, 2)}</td></tr>`).join("");
    const macro = (data.macro || []).slice(0, 8).map((row) => `<tr><td class="is-text"><b>${esc(row.label)}</b><small>${esc(day(row.asOf))}</small></td><td>${num(row.last, row.last >= 100 ? 1 : 2)}</td><td>${row.changeKind === "level" ? num(row.chg1m, 2) : pct(row.chg1m)}</td><td>${spark(row.spark)}</td></tr>`).join("");
    main.innerHTML = `
      ${head("TOP", esc(memo?.verdict?.sector || ""), `생성 ${esc(stamp(data.generatedAt))} KST · 시장 데이터 수집 ${esc(stamp(data.collectedAt))}`)}
      <div class="t-grid is-top">
        ${verdictPanel(memo)}
        ${factorPanel(memo)}
        ${panel("KILL MONITOR · 논지 폐기 조건", killTable(memo?.killCriteria || [], { compact: true }), { flush: true, meta: "경고 · 폐기 조건 자동 판정" })}
        ${panel("MEMORY COVERAGE", basket.length ? `<div class="t-scroll"><table class="t-table"><thead><tr><th>종목</th><th>종가</th><th>1D</th><th>1M</th><th>1Y</th><th>52W 고점</th><th>Fwd P/E</th><th>목표가 여력</th><th>EPS Rev 90D</th><th>신호</th><th>60D</th></tr></thead><tbody>${basket.map((row) => equityRow(row, { columns: "basket" })).join("")}</tbody></table></div>` : '<p class="t-empty">바스켓 데이터 없음</p>', { cls: "t-span-2", flush: true, meta: `중앙값 52W ${pct(memo?.basket?.fromHigh52)} · 1Y ${pct(memo?.basket?.ret1y)}` })}
        ${panel("SCENARIOS", scenarioBlock(memo), { meta: "확률은 종합 점수·경고 수로 기울인 규칙값" })}
        ${panel("MEMORY PRICES", memoryRows ? `<table class="t-table"><thead><tr><th>품목</th><th>가격</th><th>30D</th><th>90D</th><th>추이</th></tr></thead><tbody>${memoryRows}</tbody></table>` : '<p class="t-empty">가격 이력 없음</p>', { flush: true, meta: "TrendForce" })}
        ${panel("ESTIMATES · CONSENSUS", `<dl class="t-kv">
            <div><dt>EPS Rev 90D 중앙값</dt><dd>${pct(estimates.rev90Median)}</dd></div>
            <div><dt>EPS Rev 30D 중앙값</dt><dd>${pct(estimates.rev30Median)}</dd></div>
            <div><dt>목표가 여력 중앙값</dt><dd>${pct(estimates.upsideMedian)}</dd></div>
            <div><dt>투자의견 평균</dt><dd>${num(estimates.recommendationMedian, 2)}<small>1 Strong Buy ~ 5 Strong Sell</small></dd></div>
          </dl><p class="muted" style="margin:8px 0 0">${estimates.count ? `메모리 바스켓 ${esc(estimates.count)}개 종목 · OpenBB yfinance · ${esc(stamp(estimates.asOf))}` : "OpenBB 수집 전 · 다음 정기 실행에서 반영"}</p>`, { meta: "OpenBB" })}
        ${panel("UPCOMING EARNINGS", earnings ? `<table class="t-table"><thead><tr><th>종목</th><th>발표</th><th>D-day</th><th>EPS 예상</th></tr></thead><tbody>${earnings}</tbody></table>` : '<p class="t-empty">실적 일정 수집 전</p>', { flush: true, meta: "OpenBB company calendar" })}
        ${panel("MACRO", macro ? `<table class="t-table"><thead><tr><th>지표</th><th>최근</th><th>1M</th><th>추이</th></tr></thead><tbody>${macro}</tbody></table>` : '<p class="t-empty">매크로 데이터 없음</p>', { cls: "t-span-2", flush: true, meta: "FRED · 환율 · SOX" })}
      </div>`;
  }

  const CHAIN_ORDER = ["memory", "ai-chip", "foundry", "equipment", "materials", "packaging", "interconnect", "design-ip", "analog-power", "substrates", "infrastructure", "index"];
  const SORTERS = {
    symbol: (row) => row.symbol,
    last: (row) => row.price.last,
    ret1d: (row) => row.price.ret1d,
    ret1w: (row) => row.price.ret1w,
    ret1m: (row) => row.price.ret1m,
    ytd: (row) => row.price.ytd,
    ret1y: (row) => row.price.ret1y,
    fromHigh52: (row) => row.price.fromHigh52,
    vsMa200: (row) => row.price.vsMa200,
    pe: (row) => row.valuation.pe,
    forwardPe: (row) => row.valuation.forwardPe,
    evEbitda: (row) => row.valuation.evEbitda,
    upside: (row) => row.consensus.upside,
    rev90: (row) => row.estimates?.trend?.rev90,
  };
  function sortRows(rows, key, dir) {
    const getter = SORTERS[key];
    if (!getter) return rows;
    return [...rows].sort((a, b) => {
      const left = getter(a);
      const right = getter(b);
      if (!isNum(left) && !isNum(right)) return String(left ?? "").localeCompare(String(right ?? "")) * dir;
      if (!isNum(left)) return 1;
      if (!isNum(right)) return -1;
      return (Number(left) - Number(right)) * dir;
    });
  }
  const sortHeader = (key, label, active) => `<th><button type="button" data-sort="${esc(key)}"${active.sort === key ? ` aria-sort="${active.dir < 0 ? "descending" : "ascending"}"` : ""}>${esc(label)}</button></th>`;

  function renderMonitor() {
    const filters = state.monitor;
    let rows = equities().filter((row) => (filters.region === "all" || row.region === filters.region) && (filters.chain === "all" || row.valueChain === filters.chain));
    const chains = CHAIN_ORDER.filter((chain) => equities().some((row) => row.valueChain === chain));
    const regions = ["all", ...new Set(equities().map((row) => row.region))];
    let body;
    const columns = [["symbol", "종목"], [null, "체인"], ["last", "종가"], ["ret1d", "1D"], ["ret1w", "1W"], ["ret1m", "1M"], ["ytd", "YTD"], ["ret1y", "1Y"], ["fromHigh52", "52W 고점"], ["vsMa200", "200D"], ["pe", "P/E"], ["forwardPe", "Fwd P/E"], ["evEbitda", "EV/EBITDA"], ["upside", "목표가 여력"], ["rev90", "EPS Rev 90D"], [null, "신호"], [null, "60D"]];
    const header = `<tr>${columns.map(([key, label]) => (key ? sortHeader(key, label, filters) : `<th>${esc(label)}</th>`)).join("")}</tr>`;
    if (filters.sort) {
      body = sortRows(rows, filters.sort, filters.dir).map((row) => equityRow(row)).join("");
    } else {
      body = chains.map((chain) => {
        const group = rows.filter((row) => row.valueChain === chain);
        if (!group.length) return "";
        return `<tr class="t-group-row"><td colspan="${columns.length}">${esc(group[0].valueChainLabel)} · ${group.length}</td></tr>${sortRows(group, "ret1y", -1).map((row) => equityRow(row)).join("")}`;
      }).join("");
    }
    const advancing = rows.filter((row) => Number(row.price.ret1d) > 0).length;
    main.innerHTML = `
      ${head("MON", `${rows.length}개 종목`, `상승 ${advancing} · 하락 ${rows.filter((row) => Number(row.price.ret1d) < 0).length} · 헤더 클릭 정렬 · 행 클릭 → 개요`)}
      <div class="t-filter">${regions.map((region) => `<button type="button" class="t-toggle" data-region="${esc(region)}" aria-pressed="${filters.region === region}">${esc(region === "all" ? "전체 지역" : ({ global: "글로벌", china: "중국", korea: "한국", index: "지수" }[region] || region))}</button>`).join("")}</div>
      <div class="t-filter"><button type="button" class="t-toggle" data-chain="all" aria-pressed="${filters.chain === "all"}">전체 체인</button>${chains.map((chain) => `<button type="button" class="t-toggle" data-chain="${esc(chain)}" aria-pressed="${filters.chain === chain}">${esc(equities().find((row) => row.valueChain === chain)?.valueChainLabel || chain)}</button>`).join("")}</div>
      ${panel("EQUITY MONITOR", `<div class="t-scroll is-tall"><table class="t-table"><thead>${header}</thead><tbody>${body}</tbody></table></div>`, { flush: true, meta: "종가 = 크롤러 일별 종가 · 밸류에이션·컨센서스 = OpenBB" })}`;
    $$("[data-region]", main).forEach((button) => button.addEventListener("click", () => { filters.region = button.dataset.region; renderMonitor(); }));
    $$("[data-chain]", main).forEach((button) => button.addEventListener("click", () => { filters.chain = button.dataset.chain; renderMonitor(); }));
    $$("[data-sort]", main).forEach((button) => button.addEventListener("click", () => {
      const key = button.dataset.sort;
      if (filters.sort === key) filters.dir = -filters.dir;
      else { filters.sort = key; filters.dir = key === "symbol" ? 1 : -1; }
      renderMonitor();
    }));
  }

  function keyStats(row) {
    return `<dl class="t-kv">
      <div><dt>종가</dt><dd>${price(row.price.last)}<small>${esc(row.currency)} · ${esc(day(row.price.asOf))}</small></dd></div>
      <div><dt>1D · 1M</dt><dd>${pct(row.price.ret1d)} <small>${pct(row.price.ret1m)}</small></dd></div>
      <div><dt>1Y · YTD</dt><dd>${pct(row.price.ret1y)} <small>${pct(row.price.ytd)}</small></dd></div>
      <div><dt>52주 고점 대비</dt><dd>${pct(row.price.fromHigh52)}</dd></div>
      <div><dt>200일선 대비</dt><dd>${pct(row.price.vsMa200)}</dd></div>
      <div><dt>변동성 · 최대 낙폭</dt><dd>${num(row.price.volatility, 0, "%")}<small>MDD ${pct(row.price.maxDrawdown)}</small></dd></div>
      <div><dt>추세 신호</dt><dd>${signalChip(row.signal)}</dd></div>
      <div><dt>기술 등급</dt><dd>${row.technical ? `${esc(row.technical.rating || "—")}<small>RSI ${num(row.technical.rsi, 1)}</small>` : dash}</dd></div>
    </dl>`;
  }

  function renderDescription() {
    const row = security();
    if (!row) return emptyScreen("DES");
    const peers = equities().filter((item) => item.valueChain === row.valueChain && item.id !== row.id && !item.isIndex).slice(0, 12);
    const mix = row.consensus.mix;
    const dist = mix ? `<div class="t-dist" role="img" aria-label="투자의견 분포">${[["sb", mix.strongBuy], ["b", mix.buy], ["h", mix.hold], ["s", mix.sell], ["ss", mix.strongSell]].map(([cls, value]) => `<i class="${cls}" style="width:${((value / mix.total) * 100).toFixed(1)}%"></i>`).join("")}</div><p class="muted" style="margin:4px 0 0">Strong Buy ${mix.strongBuy} · Buy ${mix.buy} · Hold ${mix.hold} · Sell ${mix.sell} · Strong Sell ${mix.strongSell}</p>` : "";
    const trend = row.estimates?.trend;
    const breadth = row.estimates?.breadth;
    const earnings = row.earnings;
    main.innerHTML = `
      ${head("DES", `<span class="yellow">${esc(row.symbol)}</span> ${esc(row.name)}`, `${esc(row.valueChainLabel)} · ${esc(row.regionLabel)} · ${esc(row.exchange)} · ${link(row.sourceUrl, "시세 원문")}`)}
      <div class="t-grid is-two">
        <div class="t-grid">
          ${panel("PRICE · TREND", keyStats(row), { meta: jump("GP", row.id, "GP 차트 →") })}
          ${panel("VALUATION", `<dl class="t-kv">
            <div><dt>시가총액</dt><dd>${big(row.valuation.marketCapKrw ?? row.valuation.marketCap, row.valuation.marketCapKrw ? "KRW" : row.currency)}</dd></div>
            <div><dt>P/E (TTM)</dt><dd>${num(row.valuation.pe, 1, "x")}</dd></div>
            <div><dt>Forward P/E</dt><dd>${num(row.valuation.forwardPe, 1, "x")}</dd></div>
            <div><dt>PEG</dt><dd>${num(row.valuation.peg, 2)}</dd></div>
            <div><dt>EV/EBITDA</dt><dd>${num(row.valuation.evEbitda, 1, "x")}</dd></div>
            <div><dt>EV/Sales</dt><dd>${num(row.valuation.evSales, 1, "x")}</dd></div>
            <div><dt>P/B</dt><dd>${num(row.valuation.pb, 2, "x")}</dd></div>
            <div><dt>배당수익률 · 베타</dt><dd>${num(row.valuation.dividendYield, 2, "%")}<small>β ${num(row.valuation.beta, 2)}</small></dd></div>
          </dl>`, { meta: row.valuation.asOf ? `OpenBB · ${esc(stamp(row.valuation.asOf))}` : "OpenBB 수집 전" })}
          ${panel("PROFITABILITY · GROWTH", `<dl class="t-kv">
            <div><dt>총이익률</dt><dd>${num(row.fundamentals.grossMargin, 1, "%")}</dd></div>
            <div><dt>영업이익률</dt><dd>${num(row.fundamentals.operatingMargin, 1, "%")}</dd></div>
            <div><dt>순이익률</dt><dd>${num(row.fundamentals.profitMargin, 1, "%")}</dd></div>
            <div><dt>매출 성장 (YoY)</dt><dd>${pct(row.fundamentals.revenueGrowth)}</dd></div>
            <div><dt>이익 성장 (YoY)</dt><dd>${pct(row.fundamentals.earningsGrowth)}</dd></div>
            <div><dt>ROE</dt><dd>${num(row.fundamentals.roe, 1, "%")}</dd></div>
            <div><dt>부채비율 (D/E)</dt><dd>${num(row.fundamentals.debtToEquity, 1)}</dd></div>
            <div><dt>EPS TTM · Fwd</dt><dd>${num(row.fundamentals.epsTtm, 2)}<small>Fwd ${num(row.fundamentals.epsForward, 2)}</small></dd></div>
          </dl>`)}
          ${row.profile?.description ? panel("BUSINESS", `<p class="t-desc">${esc(row.profile.description)}</p><p class="muted">${esc([row.profile.sector, row.profile.industry, row.profile.country].filter(Boolean).join(" · "))}${row.profile.employees ? ` · 임직원 ${esc(Number(row.profile.employees).toLocaleString("en-US"))}` : ""}</p>`, { meta: "OpenBB profile" }) : ""}
        </div>
        <div class="t-grid">
          ${panel("CONSENSUS", `<dl class="t-kv">
            <div><dt>목표가 중앙값</dt><dd>${price(row.consensus.targetMedian)}<small>${esc(row.currency)}</small></dd></div>
            <div><dt>상승여력</dt><dd>${pct(row.consensus.upside)}</dd></div>
            <div><dt>목표가 범위</dt><dd>${price(row.consensus.targetLow)} ~ ${price(row.consensus.targetHigh)}</dd></div>
            <div><dt>의견 · 평균</dt><dd>${esc(rating(row.consensus.rating))}<small>${num(row.consensus.recommendationMean, 2)} · ${esc(row.consensus.analysts ?? "—")}명</small></dd></div>
          </dl>${dist}`, { meta: row.consensus.asOf ? esc(stamp(row.consensus.asOf)) : "수집 전" })}
          ${panel("ESTIMATES · REVISIONS", `<dl class="t-kv">
            <div><dt>EPS 추정 (${esc(trend?.period || "0y")})</dt><dd>${num(trend?.current, 2)}<small>내년 ${num(trend?.nextYear, 2)}</small></dd></div>
            <div><dt>30일 변화</dt><dd>${pct(trend?.rev30)}</dd></div>
            <div><dt>90일 변화</dt><dd>${pct(trend?.rev90)}</dd></div>
            <div><dt>30일 상향 · 하향</dt><dd>${breadth ? `<span class="up">${breadth.up}</span> · <span class="down">${breadth.down}</span>` : dash}</dd></div>
          </dl>`)}
          ${panel("NEXT EARNINGS", earnings ? `<dl class="t-kv">
            <div><dt>발표 예정</dt><dd>${esc(earnings.date)}<small>D${earnings.days >= 0 ? "-" : "+"}${Math.abs(earnings.days)}</small></dd></div>
            <div><dt>EPS 예상</dt><dd>${num(earnings.epsAverage, 2)}<small>${num(earnings.epsLow, 2)} ~ ${num(earnings.epsHigh, 2)}</small></dd></div>
            <div><dt>매출 예상</dt><dd>${big(earnings.revenueAverage, row.currency)}</dd></div>
          </dl>` : '<p class="t-empty">실적 일정 없음</p>')}
          ${(row.earningsHistory?.quarters || []).length ? panel("EARNINGS SURPRISE", `<p class="muted" style="margin:0;padding:8px 10px">최근 ${esc(row.earningsHistory.reported)}개 분기 중 예상 상회 ${esc(row.earningsHistory.beats)}회 · 서프라이즈 중앙값 ${pct(row.earningsHistory.averageSurprise)}</p><table class="t-table"><thead><tr><th>분기</th><th>실제 EPS</th><th>예상</th><th>서프라이즈</th></tr></thead><tbody>${row.earningsHistory.quarters.map((item) => `<tr><td>${esc(item.date)}</td><td><b>${num(item.actual, 2)}</b></td><td>${num(item.estimate, 2)}</td><td>${pct(item.surprise)}</td></tr>`).join("")}</tbody></table>`, { flush: true, meta: "OpenBB historical EPS" }) : ""}
          ${row.shareStats ? panel("SHORT INTEREST · OWNERSHIP", `<dl class="t-kv">
            <div><dt>공매도 / 유통주식</dt><dd>${num(row.shareStats.shortPercentFloat, 2, "%")}</dd></div>
            <div><dt>Days to cover</dt><dd>${num(row.shareStats.daysToCover, 1)}</dd></div>
            <div><dt>공매도 전월 대비</dt><dd>${pct(row.shareStats.shortChange, { inverse: true })}</dd></div>
            <div><dt>기관 보유</dt><dd>${num(row.shareStats.institutionOwnership, 1, "%")}<small>${esc(row.shareStats.institutions ?? "—")}개 기관</small></dd></div>
            <div><dt>내부자 보유</dt><dd>${num(row.shareStats.insiderOwnership, 1, "%")}</dd></div>
          </dl>`) : ""}
          ${panel("ANALYST ACTIONS", (row.analystActions || []).length ? `<div class="t-scroll"><table class="t-table"><thead><tr><th>일자</th><th>증권사</th><th>의견</th><th>목표가</th></tr></thead><tbody>${row.analystActions.slice(0, 10).map((item) => `<tr><td>${esc(day(item.date))}</td><td class="is-text"><b>${esc(item.firm)}</b><small>${esc(item.action || "")}</small></td><td class="is-text">${esc(item.ratingFrom && item.ratingFrom !== item.ratingTo ? `${item.ratingFrom} → ${item.ratingTo}` : item.ratingTo || "—")}</td><td>${isNum(item.targetFrom) && item.targetFrom !== item.targetTo ? `${price(item.targetFrom)} → ` : ""}<b class="${tone((item.targetTo || 0) - (item.targetFrom || item.targetTo || 0))}">${price(item.targetTo)}</b></td></tr>`).join("")}</tbody></table></div>` : '<p class="t-empty">의견 변경 수집 전 · OpenBB price_target</p>', { flush: true, meta: "OpenBB · yfinance" })}
          ${(row.holders || []).length ? panel("INSTITUTIONAL HOLDERS", `<table class="t-table"><thead><tr><th>기관</th><th>지분</th><th>변화</th></tr></thead><tbody>${row.holders.map((item) => `<tr><td class="is-text"><b>${esc(item.holder)}</b><small>${esc(day(item.date))}</small></td><td>${num(item.percent, 2, "%")}</td><td>${pct(item.change)}</td></tr>`).join("")}</tbody></table>`, { flush: true }) : ""}
          ${(row.insiders || []).length ? panel("INSIDER TRANSACTIONS", `<div class="t-scroll"><table class="t-table"><thead><tr><th>일자</th><th>내부자</th><th>유형</th><th>주식</th><th>금액</th></tr></thead><tbody>${row.insiders.map((item) => `<tr><td>${esc(day(item.date))}</td><td class="is-text"><b>${item.url ? link(item.url, item.owner) : esc(item.owner)}</b><small>${esc(item.title || "")}</small></td><td class="is-text">${esc(item.type || "")}</td><td>${num(item.shares, 0)}</td><td>${big(item.value, row.currency)}</td></tr>`).join("")}</tbody></table></div>`, { flush: true, meta: "SEC Form 4 · OpenBB" }) : ""}
          ${row.memo ? panel("IC MEMO ROLE", `<dl class="t-kv"><div><dt>역할</dt><dd>${esc(row.memo.role)}</dd></div><div><dt>노출</dt><dd>${esc(row.memo.exposure)}</dd></div><div><dt>핵심 변수</dt><dd>${esc(row.memo.driver)}</dd></div></dl>`) : ""}
          ${panel("PEERS · " + (row.valueChainLabel || ""), peers.length ? `<div class="t-scroll"><table class="t-table"><thead><tr><th>종목</th><th>1M</th><th>1Y</th><th>Fwd P/E</th><th>여력</th></tr></thead><tbody>${peers.map((peer) => `<tr data-security="${esc(peer.id)}" tabindex="0"><td class="is-text"><span class="t-ticker">${esc(bbg(peer.symbol))}</span><small>${esc(peer.name)}</small></td><td>${pct(peer.price.ret1m)}</td><td>${pct(peer.price.ret1y)}</td><td>${num(peer.valuation.forwardPe, 1, "x")}</td><td>${pct(peer.consensus.upside)}</td></tr>`).join("")}</tbody></table></div>` : '<p class="t-empty">동일 체인 종목 없음</p>', { flush: true })}
        </div>
      </div>`;
  }

  // ── GP chart ──────────────────────────────────────────────────────────────
  async function barsFor(row) {
    if (state.barsCache.has(row.id)) return state.barsCache.get(row.id);
    let bars = null;
    let kind = "ohlc";
    if (row.hasBars) {
      try {
        const payload = await fetchJson(`${DATA}terminal-ohlcv/${encodeURIComponent(row.id)}.json?v=${encodeURIComponent(state.manifest.cacheVersion || state.data.runId)}`);
        bars = (payload.bars || []).map(([timestamp, open, high, low, close, volume]) => ({ timestamp, open, high, low, close, volume }));
      } catch {
        bars = null;
      }
    }
    if (!bars?.length) {
      // No collected bars: fall back to the crawl's daily closes for this name.
      try {
        if (!state.marketHistory) {
          state.marketHistory = await fetchJson(`${DATA}market-history-client.json?v=${encodeURIComponent(state.manifest.cacheVersion || state.data.runId)}`);
        }
        const index = state.marketHistory?.runId === state.data.runId ? state.marketHistory.indexes?.[row.id] : null;
        bars = (index?.points || []).map(([timestamp, close]) => ({ timestamp, open: close, high: close, low: close, close, volume: 0 }));
        kind = "close";
      } catch {
        bars = [];
      }
    }
    const result = { bars, kind };
    state.barsCache.set(row.id, result);
    return result;
  }

  function chartStyles(kind) {
    const up = "#2fb86a";
    const down = "#d9706a";
    const text = "#b9b7b0";
    const line = "#1f2830";
    return {
      grid: { horizontal: { color: line }, vertical: { color: line } },
      candle: {
        type: kind === "close" || state.chart.type === "area" ? "area" : "candle_solid",
        bar: { upColor: up, downColor: down, noChangeColor: text, upBorderColor: up, downBorderColor: down, upWickColor: up, downWickColor: down },
        area: { lineColor: "#ccb052", lineSize: 2, backgroundColor: [{ offset: 0, color: "rgba(204,176,82,0.28)" }, { offset: 1, color: "rgba(204,176,82,0.02)" }] },
        priceMark: { last: { upColor: up, downColor: down, noChangeColor: text }, high: { color: text }, low: { color: text } },
        tooltip: { text: { color: text, family: "Roboto, 'Noto Sans KR', Helvetica" } },
      },
      indicator: { tooltip: { text: { color: text, family: "Roboto, 'Noto Sans KR', Helvetica" } } },
      xAxis: { axisLine: { color: line }, tickLine: { color: line }, tickText: { color: text, family: "Roboto, 'Noto Sans KR', Helvetica" } },
      yAxis: { axisLine: { color: line }, tickLine: { color: line }, tickText: { color: text, family: "Roboto, 'Noto Sans KR', Helvetica" } },
      separator: { color: "#2b3640" },
      crosshair: {
        horizontal: { line: { color: "#8d918c" }, text: { backgroundColor: "#1d3f66", borderColor: "#24527f", color: "#e6e3dc" } },
        vertical: { line: { color: "#8d918c" }, text: { backgroundColor: "#1d3f66", borderColor: "#24527f", color: "#e6e3dc" } },
      },
    };
  }

  function disposeChart() {
    if (state.chart.instance && window.klinecharts) {
      try { window.klinecharts.dispose($("#terminalChart") || state.chart.instance); } catch { /* already gone */ }
    }
    state.chart.instance = null;
  }

  async function renderChart() {
    const row = security();
    if (!row) return emptyScreen("GP");
    const ranges = { "3M": 63, "6M": 126, "1Y": 252, ALL: Infinity };
    main.innerHTML = `
      ${head("GP", `<span class="yellow">${esc(row.symbol)}</span> ${esc(row.name)}`, `${esc(row.valueChainLabel)} · ${esc(row.currency)} · 마우스 휠 확대 · 드래그 이동`)}
      <div class="t-grid is-two">
        ${panel("PRICE CHART", `
          <div class="t-chart-tools">
            <span>기간</span>${Object.keys(ranges).map((range) => `<button type="button" class="t-toggle" data-range="${range}" aria-pressed="${state.chart.range === range}">${range}</button>`).join("")}
            <span>지표</span>${Object.keys(state.chart.indicators).map((name) => `<button type="button" class="t-toggle" data-indicator="${name}" aria-pressed="${state.chart.indicators[name]}">${name}</button>`).join("")}
            <span>형태</span><button type="button" class="t-toggle" data-type="candle" aria-pressed="${state.chart.type === "candle"}">캔들</button><button type="button" class="t-toggle" data-type="area" aria-pressed="${state.chart.type === "area"}">라인</button>
          </div>
          <div class="t-chart" id="terminalChart" role="img" aria-label="${esc(row.name)} 가격 차트"></div>
          <p class="t-chart-note" id="terminalChartNote">차트 데이터 불러오는 중</p>`, { meta: "KLineChart · Apache-2.0" })}
        ${panel("KEY STATS", keyStats(row), { meta: jump("DES", row.id, "DES 개요 →") })}
      </div>`;
    $$("[data-range]", main).forEach((button) => button.addEventListener("click", () => { state.chart.range = button.dataset.range; renderChart(); }));
    $$("[data-indicator]", main).forEach((button) => button.addEventListener("click", () => { state.chart.indicators[button.dataset.indicator] = !state.chart.indicators[button.dataset.indicator]; renderChart(); }));
    $$("[data-type]", main).forEach((button) => button.addEventListener("click", () => { state.chart.type = button.dataset.type; renderChart(); }));
    const { bars, kind } = await barsFor(row);
    const note = $("#terminalChartNote");
    const host = $("#terminalChart");
    if (!host || state.fn !== "GP") return;
    if (!window.klinecharts || !bars.length) {
      if (note) note.textContent = !bars.length ? "차트 데이터 없음 · 다음 수집 대기" : "차트 라이브러리 로드 실패";
      return;
    }
    disposeChart();
    const visible = Number.isFinite(ranges[state.chart.range]) ? bars.slice(-ranges[state.chart.range]) : bars;
    const chart = window.klinecharts.init(host, { styles: chartStyles(kind), timezone: "Asia/Seoul", locale: "en-US" });
    state.chart.instance = chart;
    chart.setSymbol({ ticker: row.symbol, pricePrecision: Number(row.price.last) >= 100 ? 1 : 2, volumePrecision: 0 });
    chart.setPeriod({ span: 1, type: "day" });
    chart.setDataLoader({ getBars: ({ callback }) => callback(visible, false) });
    const indicators = state.chart.indicators;
    if (indicators.MA) chart.createIndicator({ name: "MA", calcParams: [20, 60, 120], paneId: "candle_pane" }, true);
    if (indicators.BOLL) chart.createIndicator({ name: "BOLL", paneId: "candle_pane" }, true);
    if (indicators.VOL && kind !== "close") chart.createIndicator("VOL");
    if (indicators.MACD) chart.createIndicator("MACD");
    if (indicators.RSI) chart.createIndicator({ name: "RSI", calcParams: [14] });
    if (note) note.textContent = kind === "close"
      ? `일별 종가 ${visible.length}개 · 시가·고가·저가 미수집 종목은 종가 라인으로 표시`
      : `OpenBB yfinance 일봉 ${visible.length}개 · 마지막 ${day(new Date(visible.at(-1).timestamp).toISOString())}`;
  }

  // ── EQRV ──────────────────────────────────────────────────────────────────
  const EQRV_AXES = {
    forwardPe: { label: "Forward P/E", get: (row) => row.valuation.forwardPe, unit: "x" },
    pe: { label: "P/E (TTM)", get: (row) => row.valuation.pe, unit: "x" },
    evEbitda: { label: "EV/EBITDA", get: (row) => row.valuation.evEbitda, unit: "x" },
    earningsGrowth: { label: "이익 성장 YoY", get: (row) => row.fundamentals.earningsGrowth, unit: "%" },
    revenueGrowth: { label: "매출 성장 YoY", get: (row) => row.fundamentals.revenueGrowth, unit: "%" },
    ret1y: { label: "1Y 수익률", get: (row) => row.price.ret1y, unit: "%" },
    upside: { label: "목표가 여력", get: (row) => row.consensus.upside, unit: "%" },
    rev90: { label: "EPS Rev 90D", get: (row) => row.estimates?.trend?.rev90, unit: "%" },
  };
  function renderRelativeValue() {
    const config = state.eqrv;
    const x = EQRV_AXES[config.x];
    const y = EQRV_AXES[config.y];
    const rows = equities().filter((row) => !row.isIndex && (config.chain === "all" || row.valueChain === config.chain))
      .map((row) => ({ row, x: x.get(row), y: y.get(row) }))
      .filter((point) => isNum(point.x) && isNum(point.y));
    // Clip the extreme 5% so one outlier does not flatten the rest.
    const clip = (values) => {
      const sorted = [...values].sort((a, b) => a - b);
      const at = (q) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))];
      return [at(0.03), at(0.97)];
    };
    let svg = '<p class="t-empty">두 지표가 모두 수집된 종목 없음 · OpenBB 수집 후 표시</p>';
    if (rows.length >= 3) {
      const [x0, x1] = clip(rows.map((point) => Number(point.x)));
      const [y0, y1] = clip(rows.map((point) => Number(point.y)));
      const W = 900; const H = 460; const P = 46;
      const sx = (value) => P + ((Math.min(x1, Math.max(x0, value)) - x0) / ((x1 - x0) || 1)) * (W - P * 2);
      const sy = (value) => H - P - ((Math.min(y1, Math.max(y0, value)) - y0) / ((y1 - y0) || 1)) * (H - P * 2);
      const mx = rows.map((point) => Number(point.x)).sort((a, b) => a - b)[Math.floor(rows.length / 2)];
      const my = rows.map((point) => Number(point.y)).sort((a, b) => a - b)[Math.floor(rows.length / 2)];
      svg = `<svg class="t-scatter" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(x.label)} 대비 ${esc(y.label)}">
        <line class="axis" x1="${P}" y1="${H - P}" x2="${W - P}" y2="${H - P}" /><line class="axis" x1="${P}" y1="${P}" x2="${P}" y2="${H - P}" />
        <line class="median" x1="${sx(mx)}" y1="${P}" x2="${sx(mx)}" y2="${H - P}" /><line class="median" x1="${P}" y1="${sy(my)}" x2="${W - P}" y2="${sy(my)}" />
        <text x="${W - P}" y="${H - 12}" text-anchor="end">${esc(x.label)} →</text><text x="12" y="${P - 14}">${esc(y.label)} ↑</text>
        <text x="${P}" y="${H - P + 18}">${esc(fixed(x0, 0))}${esc(x.unit)}</text><text x="${W - P}" y="${H - P + 18}" text-anchor="end">${esc(fixed(x1, 0))}${esc(x.unit)}</text>
        <text x="${P - 6}" y="${H - P}" text-anchor="end">${esc(fixed(y0, 0))}</text><text x="${P - 6}" y="${P + 4}" text-anchor="end">${esc(fixed(y1, 0))}</text>
        ${rows.map((point) => `<g data-security="${esc(point.row.id)}"><circle class="${point.row.valueChain === "memory" ? "is-memory" : "is-other"}" cx="${sx(point.x).toFixed(1)}" cy="${sy(point.y).toFixed(1)}" r="6"><title>${esc(point.row.symbol)} · ${esc(x.label)} ${esc(fixed(point.x, 1))} · ${esc(y.label)} ${esc(fixed(point.y, 1))}</title></circle><text class="label" x="${(sx(point.x) + 8).toFixed(1)}" y="${(sy(point.y) + 4).toFixed(1)}">${esc(point.row.symbol.replace(/\.[A-Z]+$/, ""))}</text></g>`).join("")}
      </svg><p class="t-chart-note">점선 = 중앙값 · 노란 점 = 메모리 · 우하단(성장 높고 배수 낮음)일수록 상대 저평가 후보 · 양끝 3% 값은 축 경계에 표시</p>`;
    }
    const chains = CHAIN_ORDER.filter((chain) => equities().some((row) => row.valueChain === chain && !row.isIndex));
    const table = rows.sort((a, b) => Number(a.y) - Number(b.y)).map((point) => `<tr data-security="${esc(point.row.id)}" tabindex="0"><td class="is-text"><span class="t-ticker">${esc(bbg(point.row.symbol))}</span><small>${esc(point.row.name)}</small></td><td>${num(point.y, 1, y.unit)}</td><td>${y.unit === "%" ? pct(point.x) : num(point.x, 1, x.unit)}</td><td>${pct(point.row.consensus.upside)}</td></tr>`).join("");
    main.innerHTML = `
      ${head("EQRV", `${rows.length}개 종목`, "축 선택 · 점 클릭 → 개요")}
      <div class="t-filter"><span class="amber">X</span>${Object.entries(EQRV_AXES).map(([key, axis]) => `<button type="button" class="t-toggle" data-x="${key}" aria-pressed="${config.x === key}">${esc(axis.label)}</button>`).join("")}</div>
      <div class="t-filter"><span class="amber">Y</span>${Object.entries(EQRV_AXES).map(([key, axis]) => `<button type="button" class="t-toggle" data-y="${key}" aria-pressed="${config.y === key}">${esc(axis.label)}</button>`).join("")}</div>
      <div class="t-filter"><button type="button" class="t-toggle" data-eqrv-chain="all" aria-pressed="${config.chain === "all"}">전체</button>${chains.map((chain) => `<button type="button" class="t-toggle" data-eqrv-chain="${esc(chain)}" aria-pressed="${config.chain === chain}">${esc(equities().find((row) => row.valueChain === chain)?.valueChainLabel || chain)}</button>`).join("")}</div>
      <div class="t-grid is-two">
        ${panel("RELATIVE VALUE MAP", svg)}
        ${panel(`RANK · ${y.label} 낮은 순`, table ? `<div class="t-scroll is-tall"><table class="t-table"><thead><tr><th>종목</th><th>${esc(y.label)}</th><th>${esc(x.label)}</th><th>여력</th></tr></thead><tbody>${table}</tbody></table></div>` : '<p class="t-empty">데이터 없음</p>', { flush: true })}
      </div>`;
    $$("[data-x]", main).forEach((button) => button.addEventListener("click", () => { config.x = button.dataset.x; renderRelativeValue(); }));
    $$("[data-y]", main).forEach((button) => button.addEventListener("click", () => { config.y = button.dataset.y; renderRelativeValue(); }));
    $$("[data-eqrv-chain]", main).forEach((button) => button.addEventListener("click", () => { config.chain = button.dataset.eqrvChain; renderRelativeValue(); }));
  }

  // ── BTST ──────────────────────────────────────────────────────────────────
  function renderBacktest() {
    const row = security();
    const rows = equities().filter((item) => item.backtest).sort((a, b) => Number(b.backtest.strategy.sharpe ?? -9) - Number(a.backtest.strategy.sharpe ?? -9));
    const test = row?.backtest;
    const metric = (label, s, b, unit = "%") => `<tr><td class="is-text"><b>${esc(label)}</b></td><td>${unit === "%" ? pct(s) : num(s, 2)}</td><td>${unit === "%" ? pct(b) : num(b, 2)}</td><td>${isNum(s) && isNum(b) ? (unit === "%" ? pp(s - b) : num(s - b, 2)) : dash}</td></tr>`;
    main.innerHTML = `
      ${head("BTST", row ? `<span class="yellow">${esc(bbg(row.symbol))}</span> ${esc(row.name)}` : "", "QuantConnect LEAN의 일별 이벤트 백테스트 방식을 단순화 · 크롤러 일별 종가 · 미래 정보 미사용")}
      <div class="t-grid is-two is-wide-right">
        ${panel("STRATEGY vs BUY & HOLD", test ? `<table class="t-table"><thead><tr><th>지표</th><th>추세 전략</th><th>매수 후 보유</th><th>차이</th></tr></thead><tbody>
          ${metric("누적 수익률", test.strategy.totalReturn, test.buyHold.totalReturn)}
          ${metric("CAGR", test.strategy.cagr, test.buyHold.cagr)}
          ${metric("Sharpe", test.strategy.sharpe, test.buyHold.sharpe, "x")}
          ${metric("최대 낙폭", test.strategy.maxDrawdown, test.buyHold.maxDrawdown)}
        </tbody></table><dl class="t-kv" style="margin-top:10px"><div><dt>규칙</dt><dd><small>${esc(test.rule)}</small></dd></div><div><dt>기간</dt><dd>${esc(test.years)}년</dd></div><div><dt>청산 거래 · 승률</dt><dd>${esc(test.strategy.trades)}회 · ${num(test.strategy.winRate, 0, "%")}</dd></div><div><dt>시장 노출</dt><dd>${num(test.strategy.exposure, 0, "%")}</dd></div><div><dt>현재 신호</dt><dd class="${test.position === "보유" ? "up" : "down"}">${esc(test.position)}${isNum(test.openReturn) ? ` <small>진입 후 ${pct(test.openReturn)} · 미청산</small>` : ""}</dd></div></dl>` : '<p class="t-empty">백테스트 이력 부족 (260거래일 이상 필요)</p>', { meta: "과거 성과는 미래 수익을 보장하지 않음" })}
        ${panel("UNIVERSE · Sharpe 순", `<div class="t-scroll is-tall"><table class="t-table"><thead><tr><th>종목</th><th>전략 CAGR</th><th>B&H CAGR</th><th>전략 Sharpe</th><th>전략 MDD</th><th>B&H MDD</th><th>현재</th></tr></thead><tbody>${rows.map((item) => `<tr data-security="${esc(item.id)}" tabindex="0" class="${item.id === state.securityId ? "is-selected" : ""}"><td class="is-text"><span class="t-ticker">${esc(bbg(item.symbol))}</span><small>${esc(item.name)}</small></td><td>${pct(item.backtest.strategy.cagr)}</td><td>${pct(item.backtest.buyHold.cagr)}</td><td>${num(item.backtest.strategy.sharpe, 2)}</td><td>${pct(item.backtest.strategy.maxDrawdown)}</td><td>${pct(item.backtest.buyHold.maxDrawdown)}</td><td class="${item.backtest.position === "보유" ? "up" : "down"}">${esc(item.backtest.position)}</td></tr>`).join("")}</tbody></table></div>`, { flush: true, meta: `${rows.length}개 종목` })}
      </div>`;
  }

  // ── ALRT ──────────────────────────────────────────────────────────────────
  function renderAlerts() {
    const alerts = state.data.alerts || [];
    const kind = state.alerts.kind;
    const kinds = [["all", "전체"], ["positive", "긍정"], ["negative", "부정"], ["caution", "주의"], ["analyst", "증권사"], ["earnings", "실적 임박"]];
    const rows = alerts.filter((item) => kind === "all" || item.tone === kind || item.kind === kind);
    const scans = equities().filter((row) => row.scan && !row.isIndex).sort((a, b) => Number(a.scan.rsi ?? 50) - Number(b.scan.rsi ?? 50));
    const kills = (state.data.memo?.killCriteria || []).filter((row) => row.status === "kill" || row.status === "warn");
    main.innerHTML = `
      ${head("ALRT", `${alerts.length}건`, "매 실행 자동 생성 · 기술적 신호(일별 종가) · 증권사 의견 변경(3일 이내) · 7일 내 실적 발표 · 논지 폐기 조건")}
      <div class="t-filter">${kinds.map(([id, label]) => `<button type="button" class="t-toggle" data-alert-kind="${id}" aria-pressed="${kind === id}">${label}</button>`).join("")}</div>
      <div class="t-grid is-two">
        ${panel("ALERTS", rows.length ? `<div class="t-scroll is-tall"><table class="t-table"><thead><tr><th>종목</th><th>체인</th><th>신호</th><th>1D</th><th>RSI</th></tr></thead><tbody>${rows.map((item) => `<tr data-security="${esc(item.id)}" tabindex="0"><td class="is-text"><span class="t-ticker">${esc(bbg(item.symbol))}</span><small>${esc(item.name)}</small></td><td class="is-text">${esc(item.valueChainLabel || "")}</td><td class="is-text">${chip(item.label, item.tone || "neutral")}</td><td>${pct(item.ret1d)}</td><td>${num(item.rsi, 1)}</td></tr>`).join("")}</tbody></table></div>` : '<p class="t-empty">해당 알림 없음</p>', { flush: true })}
        <div class="t-grid">
          ${panel("THESIS WATCH", killTable(kills, { compact: true }), { flush: true, meta: "경고·폐기 조건만" })}
          ${panel("RSI LADDER · 과매도 → 과매수", `<div class="t-scroll is-tall"><table class="t-table"><thead><tr><th>종목</th><th>RSI(14)</th><th>52W 고점</th><th>신호</th></tr></thead><tbody>${scans.map((row) => `<tr data-security="${esc(row.id)}" tabindex="0"><td class="is-text"><span class="t-ticker">${esc(bbg(row.symbol))}</span><small>${esc(row.name)}</small></td><td><b class="${row.scan.rsi >= 70 ? "amber" : row.scan.rsi <= 30 ? "up" : ""}">${num(row.scan.rsi, 1)}</b></td><td>${pct(row.price.fromHigh52)}</td><td class="is-text">${(row.scan.flags || []).slice(0, 2).map((flag) => chip(flag.label, flag.tone)).join(" ") || '<span class="muted">—</span>'}</td></tr>`).join("")}</tbody></table></div>`, { flush: true })}
        </div>
      </div>`;
    $$("[data-alert-kind]", main).forEach((button) => button.addEventListener("click", () => { state.alerts.kind = button.dataset.alertKind; renderAlerts(); }));
  }

  // ── CORR ──────────────────────────────────────────────────────────────────
  function renderCorrelation() {
    const matrix = state.data.correlation || {};
    const labels = matrix.labels || [];
    const cell = (value) => {
      if (!isNum(value)) return '<td class="muted">—</td>';
      const v = Number(value);
      const alpha = Math.min(0.85, Math.abs(v) * 0.85).toFixed(2);
      const background = v >= 0 ? `rgba(47,184,106,${alpha})` : `rgba(217,112,106,${alpha})`;
      return `<td style="background:${background};color:${Math.abs(v) > 0.55 ? "#050607" : "#e6e3dc"};text-align:center"><b>${fixed(v, 2)}</b></td>`;
    };
    const pairs = [];
    labels.forEach((a, i) => labels.forEach((b, j) => { if (j > i && isNum(matrix.values?.[i]?.[j])) pairs.push({ a: a.symbol, b: b.symbol, value: matrix.values[i][j] }); }));
    pairs.sort((x, y) => y.value - x.value);
    main.innerHTML = `
      ${head("CORR", `${labels.length}개 시리즈 · 최근 ${esc(matrix.window || 60)}거래일`, "일별 로그 수익률 상관계수 · 1에 가까울수록 같은 트레이드 · 분산 효과 점검")}
      <div class="t-grid is-two">
        ${panel("CORRELATION MATRIX", labels.length ? `<div class="t-scroll"><table class="t-table"><thead><tr><th></th>${labels.map((label) => `<th>${esc(label.symbol.replace(/\.[A-Z]+$/, ""))}</th>`).join("")}</tr></thead><tbody>${labels.map((label, i) => `<tr><td class="is-text"><span class="t-ticker">${esc(label.symbol)}</span></td>${(matrix.values?.[i] || []).map(cell).join("")}</tr>`).join("")}</tbody></table></div>` : '<p class="t-empty">상관계수 계산 이력 부족</p>', { flush: true })}
        <div class="t-grid">
          ${panel("MOST CORRELATED", `<table class="t-table"><tbody>${pairs.slice(0, 8).map((pair) => `<tr><td class="is-text">${esc(pair.a)} · ${esc(pair.b)}</td><td>${num(pair.value, 2)}</td></tr>`).join("")}</tbody></table>`, { flush: true, meta: "동반 비중 시 집중 위험" })}
          ${panel("LEAST CORRELATED", `<table class="t-table"><tbody>${pairs.slice(-8).reverse().map((pair) => `<tr><td class="is-text">${esc(pair.a)} · ${esc(pair.b)}</td><td>${num(pair.value, 2)}</td></tr>`).join("")}</tbody></table>`, { flush: true, meta: "분산 후보" })}
        </div>
      </div>`;
  }

  // ── ETF ───────────────────────────────────────────────────────────────────
  function renderEtfs() {
    const etfs = state.data.etfs || [];
    main.innerHTML = `
      ${head("ETF", `${etfs.length}개`, "OpenBB yfinance ETF 정보·상위 보유종목 · 반도체 테마 패시브 대안")}
      ${panel("SEMICONDUCTOR ETFS", etfs.length ? `<div class="t-scroll"><table class="t-table"><thead><tr><th>ETF</th><th>NAV</th><th>순자산</th><th>YTD</th><th>3Y 연평균</th><th>5Y 연평균</th><th>P/E</th><th>배당</th><th>β</th><th>52W 고점</th><th>200D</th></tr></thead><tbody>${etfs.map((etf) => `<tr><td class="is-text"><span class="t-ticker">${esc(etf.symbol)}</span><small>${esc(etf.name)}</small></td><td>${price(etf.nav)}</td><td>${big(etf.totalAssets, etf.currency)}</td><td>${pct(etf.ytd)}</td><td>${pct(etf.return3y)}</td><td>${pct(etf.return5y)}</td><td>${num(etf.pe, 1, "x")}</td><td>${num(etf.dividendYield, 2, "%")}</td><td>${num(etf.beta, 2)}</td><td>${pct(etf.fromHigh52)}</td><td>${pct(etf.vsMa200)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="t-empty">ETF 데이터 수집 전 · 다음 정기 실행에서 반영</p>`, { flush: true })}
      <div class="t-grid is-top" style="margin-top:10px">${etfs.filter((etf) => etf.holdings.length).map((etf) => panel(`${etf.symbol} TOP HOLDINGS`, `<table class="t-table"><thead><tr><th>종목</th><th>비중</th></tr></thead><tbody>${etf.holdings.map((holding) => { const known = resolveSecurity(holding.symbol); return `<tr${known ? ` data-security="${esc(known.id)}" tabindex="0"` : ""}><td class="is-text"><span class="t-ticker">${esc(holding.symbol || "")}</span><small>${esc(holding.name || "")}</small></td><td>${num(holding.weight, 2, "%")}</td></tr>`; }).join("")}</tbody></table>`, { flush: true, meta: esc(stamp(etf.asOf)) })).join("")}</div>`;
  }

  // ── BRKR ──────────────────────────────────────────────────────────────────
  function renderBrokers() {
    const brokers = state.data.brokers || {};
    const filter = state.brokers.filter;
    const actions = (brokers.actions || []).filter((item) => filter === "all" || (filter === "up" ? item.targetTo > item.targetFrom : filter === "down" ? item.targetTo < item.targetFrom : item.ratingFrom && item.ratingFrom !== item.ratingTo));
    const consensus = equities().filter((row) => isNum(row.consensus.upside) || row.consensus.analysts)
      .sort((a, b) => Number(b.consensus.upside ?? -999) - Number(a.consensus.upside ?? -999));
    main.innerHTML = `
      ${head("BRKR", "증권사 리서치 · 애널리스트 의견", "OpenBB price_target(증권사별 의견·목표가 변경) · 크롤러 검증 기사 속 증권사 인용")}
      <div class="t-filter">${[["all", "전체 변경"], ["up", "목표가 상향"], ["down", "목표가 하향"], ["rating", "의견 변경"]].map(([id, label]) => `<button type="button" class="t-toggle" data-broker-filter="${id}" aria-pressed="${filter === id}">${label}</button>`).join("")}</div>
      <div class="t-grid is-two">
        ${panel("ANALYST ACTIONS · 최근 의견·목표가 변경", actions.length ? `<div class="t-scroll is-tall"><table class="t-table"><thead><tr><th>일자</th><th>종목</th><th>증권사</th><th>의견</th><th>목표가</th><th>현재가 대비</th></tr></thead><tbody>${actions.map((item) => `<tr data-security="${esc(item.id)}" tabindex="0"><td>${esc(day(item.date))}</td><td class="is-text"><span class="t-ticker">${esc(bbg(item.symbol))}</span><small>${esc(item.name)}</small></td><td class="is-text"><b>${esc(item.firm)}</b><small>${esc(item.action || "")}</small></td><td class="is-text">${esc(item.ratingFrom && item.ratingFrom !== item.ratingTo ? `${item.ratingFrom} → ${item.ratingTo}` : item.ratingTo || "—")}</td><td>${isNum(item.targetFrom) && item.targetFrom !== item.targetTo ? `<small>${price(item.targetFrom)} →</small>` : ""}<b class="${tone((item.targetTo || 0) - (item.targetFrom || item.targetTo || 0))}">${price(item.targetTo)}</b></td><td>${isNum(item.targetTo) && isNum(item.last) ? pct((item.targetTo / item.last - 1) * 100) : dash}</td></tr>`).join("")}</tbody></table></div>` : `<p class="t-empty">의견 변경 수집 전 · 상태 ${esc(state.data.providers?.openbb?.state || "미실행")}</p>`, { flush: true, meta: `${(brokers.actions || []).length}건` })}
        <div class="t-grid">
          ${panel("BROKERAGE ACTIVITY", (brokers.firms || []).length ? `<table class="t-table"><thead><tr><th>증권사</th><th>건수</th><th>상향</th><th>하향</th><th>최근</th></tr></thead><tbody>${brokers.firms.map((item) => `<tr><td class="is-text"><b>${esc(item.firm)}</b></td><td>${esc(item.actions)}</td><td class="up">${esc(item.up)}</td><td class="down">${esc(item.down)}</td><td>${esc(day(item.latest))}</td></tr>`).join("")}</tbody></table>` : '<p class="t-empty">집계 대상 없음</p>', { flush: true })}
          ${panel("CONSENSUS UPSIDE", consensus.length ? `<div class="t-scroll is-tall"><table class="t-table"><thead><tr><th>종목</th><th>목표가 여력</th><th>의견</th><th>애널리스트</th></tr></thead><tbody>${consensus.map((row) => `<tr data-security="${esc(row.id)}" tabindex="0"><td class="is-text"><span class="t-ticker">${esc(bbg(row.symbol))}</span><small>${esc(row.name)}</small></td><td>${pct(row.consensus.upside)}</td><td class="is-text">${esc(rating(row.consensus.rating))}<small>${num(row.consensus.recommendationMean, 2)}</small></td><td>${esc(row.consensus.analysts ?? "—")}</td></tr>`).join("")}</tbody></table></div>` : '<p class="t-empty">컨센서스 수집 전</p>', { flush: true, meta: `${consensus.length}개 종목 · 여력 순` })}
        </div>
        ${panel("BROKER RESEARCH CITATIONS · 검증 기사 속 증권사 견해", (brokers.research || []).length ? `<ul class="t-news">${brokers.research.map((item) => `<li><time>${esc(day(item.date))}</time><span><b class="yellow">${esc(item.institution)}</b> · ${link(item.url, item.title)}<small class="muted" style="display:block">${esc(item.summary || "")}</small>${item.insight ? `<small class="amber" style="display:block">So what · ${esc(item.insight)}</small>` : ""}${item.reversalKpi ? `<small class="muted" style="display:block">반증 KPI · ${esc(item.reversalKpi)}</small>` : ""}</span><span>${esc(item.label || "")} · ${esc(item.source || "")}</span></li>`).join("")}</ul>` : '<p class="t-empty">증권사 인용 없음</p>', { cls: "t-span-all", flush: true, meta: "크롤러 근거 게이트 통과 기사" })}
      </div>`;
    $$("[data-broker-filter]", main).forEach((button) => button.addEventListener("click", () => { state.brokers.filter = button.dataset.brokerFilter; renderBrokers(); }));
  }

  // ── COMP · Lightweight Charts ────────────────────────────────────────────
  const COMP_COLORS = ["#ccb052", "#7db7d4", "#2fb86a", "#d9706a", "#c8964b", "#b9b7b0", "#5aa6c8", "#d1973f", "#4aa56b", "#8d918c"];
  async function renderCompare() {
    const config = state.comp;
    const groups = {
      coverage: { label: "메모리 커버리지", ids: equities().filter((row) => row.memo).map((row) => row.id) },
      leaders: { label: "AI 반도체 대표", ids: ["nvidia-stock", "amd-stock", "broadcom-stock", "tsmc-stock", "micron-stock", "skhy-stock", "asml-stock"] },
      equipment: { label: "장비", ids: equities().filter((row) => row.valueChain === "equipment" && row.region !== "china").map((row) => row.id).slice(0, 10) },
      selected: { label: `선택 종목 vs SOX`, ids: [state.securityId, "sox"] },
    };
    const group = groups[config.group] || groups.coverage;
    // The client history is sampled, not daily, so windows are cut by date.
    const ranges = { "3M": 92, "6M": 183, "1Y": 366, ALL: Infinity };
    main.innerHTML = `
      ${head("COMP", group.label, "기간 첫 종가 = 100 · 통화 차이 없이 수익률 비교 · TradingView Lightweight Charts")}
      <div class="t-chart-tools"><span>그룹</span>${Object.entries(groups).map(([id, item]) => `<button type="button" class="t-toggle" data-comp-group="${id}" aria-pressed="${config.group === id}">${esc(item.label)}</button>`).join("")}
        <span>기간</span>${Object.keys(ranges).map((range) => `<button type="button" class="t-toggle" data-comp-range="${range}" aria-pressed="${config.range === range}">${range}</button>`).join("")}</div>
      <div class="t-grid is-two">
        ${panel("RELATIVE PERFORMANCE", `<div class="t-chart" id="terminalCompare" role="img" aria-label="${esc(group.label)} 상대 성과"></div><p class="t-chart-note" id="terminalCompareNote">이력 불러오는 중</p>`, { meta: "Lightweight Charts · Apache-2.0" })}
        ${panel("RETURN TABLE", '<div id="terminalCompareTable"><p class="t-empty">계산 중</p></div>', { flush: true })}
      </div>`;
    $$("[data-comp-group]", main).forEach((button) => button.addEventListener("click", () => { config.group = button.dataset.compGroup; renderCompare(); }));
    $$("[data-comp-range]", main).forEach((button) => button.addEventListener("click", () => { config.range = button.dataset.compRange; renderCompare(); }));
    try {
      if (!state.marketHistory) state.marketHistory = await fetchJson(`${DATA}market-history-client.json?v=${encodeURIComponent(state.manifest.cacheVersion || state.data.runId)}`);
    } catch { state.marketHistory = null; }
    const host = $("#terminalCompare");
    if (!host || state.fn !== "COMP") return;
    const indexes = state.marketHistory?.runId === state.data.runId ? state.marketHistory.indexes || {} : {};
    const lines = group.ids.map((id) => ({ id, index: indexes[id], row: equities().find((item) => item.id === id) })).filter((item) => item.index?.points?.length);
    if (!lines.length || !window.LightweightCharts) {
      $("#terminalCompareNote").textContent = !lines.length ? "비교할 이력 없음" : "차트 라이브러리 로드 실패";
      return;
    }
    const lw = window.LightweightCharts;
    if (state.compChart) { try { state.compChart.remove(); } catch { /* gone */ } }
    const chart = lw.createChart(host, {
      autoSize: true,
      layout: { background: { color: "#050607" }, textColor: "#b9b7b0", fontFamily: "Roboto, 'Noto Sans KR', Helvetica" },
      grid: { vertLines: { color: "#1f2830" }, horzLines: { color: "#1f2830" } },
      rightPriceScale: { borderColor: "#2b3640" },
      timeScale: { borderColor: "#2b3640" },
      crosshair: { mode: 0 },
    });
    state.compChart = chart;
    const table = [];
    lines.forEach((line, index) => {
      const points = line.index.points.filter((point) => Array.isArray(point));
      const cutoff = Number.isFinite(ranges[config.range]) ? points.at(-1)[0] - ranges[config.range] * 864e5 : -Infinity;
      const window_ = points.filter(([time]) => time >= cutoff);
      const base = window_[0]?.[1];
      if (!base) return;
      const seen = new Set();
      const data = window_.map(([time, value]) => ({ time: Math.floor(time / 1000), value: Number(((value / base) * 100).toFixed(2)) }))
        .filter((point) => (seen.has(point.time) ? false : seen.add(point.time)));
      const series = chart.addSeries(lw.LineSeries, { color: COMP_COLORS[index % COMP_COLORS.length], lineWidth: line.id === "sox" ? 3 : 2, title: (line.row?.symbol || line.id).replace(/\.[A-Z]+$/, ""), priceLineVisible: false });
      series.setData(data);
      table.push({ line, color: COMP_COLORS[index % COMP_COLORS.length], ret: data.at(-1).value - 100, low: Math.min(...data.map((point) => point.value)) - 100 });
    });
    chart.timeScale().fitContent();
    $("#terminalCompareNote").textContent = `${table.length}개 시리즈 · ${config.range} · 종가 이력 (5년 압축 표본)`;
    $("#terminalCompareTable").innerHTML = `<table class="t-table"><thead><tr><th>종목</th><th>기간 수익률</th><th>기간 최저</th></tr></thead><tbody>${table.sort((a, b) => b.ret - a.ret).map((item) => `<tr${item.line.row ? ` data-security="${esc(item.line.id)}" tabindex="0"` : ""}><td class="is-text"><b style="color:${item.color}">■</b> <span class="t-ticker">${esc(item.line.row?.symbol || item.line.id.toUpperCase())}</span><small>${esc(item.line.row?.name || "")}</small></td><td>${pct(item.ret)}</td><td>${pct(item.low)}</td></tr>`).join("")}</tbody></table>`;
  }

  function renderMemory() {
    const rows = state.data.memoryPrices || [];
    const memo = state.data.memo;
    const priceKills = (memo?.killCriteria || []).filter((row) => /spot|contract/.test(row.id));
    const groups = ["DRAM", "NAND"].map((group) => {
      const list = rows.filter((row) => row.group === group);
      return list.length ? `<tr class="t-group-row"><td colspan="8">${group}</td></tr>${list.map((row) => `<tr><td class="is-text"><b>${esc(row.label)}</b><small>${esc(row.kind)}</small></td><td>${price(row.last)}</td><td>${pct(row.chg30)}</td><td>${pct(row.chg90)}</td><td>${pct(row.chg365)}</td><td>${esc(day(row.asOf))}${row.ageDays > 14 ? ' <small class="amber">지연</small>' : ""}</td><td>${spark(row.spark)}</td><td>${link(row.sourceUrl, "원문")}</td></tr>`).join("")}` : "";
    }).join("");
    const priceFactor = (memo?.factors || []).find((factor) => factor.id === "price");
    main.innerHTML = `
      ${head("MEM", "DRAM · NAND", "TrendForce 공개 가격표 · 자체 축적 이력 · 보간 없음")}
      <div class="t-grid is-two">
        ${panel("MEMORY PRICE MONITOR", groups ? `<div class="t-scroll"><table class="t-table"><thead><tr><th>품목</th><th>가격 (USD)</th><th>30D</th><th>90D</th><th>1Y</th><th>기준일</th><th>추이</th><th>출처</th></tr></thead><tbody>${groups}</tbody></table></div>` : '<p class="t-empty">가격 이력 없음</p>', { flush: true })}
        <div class="t-grid">
          ${panel("PRICE FACTOR", priceFactor ? `<p>${scoreBar(priceFactor.score)}</p><p>${esc(priceFactor.verdict)}</p><p class="muted">${esc(priceFactor.soWhat)}</p>` : '<p class="t-empty">요인 없음</p>')}
          ${panel("PRICE KILL CRITERIA", killTable(priceKills), { flush: true })}
        </div>
      </div>`;
  }

  function renderMacro() {
    const rows = state.data.macro || [];
    const risk = (state.data.memo?.factors || []).find((factor) => factor.id === "risk");
    main.innerHTML = `
      ${head("ECO", "금리 · 달러 · 변동성 · 반도체 산업", "FRED(FinanceDataReader) · 환율 · SOX")}
      <div class="t-grid is-two">
        ${panel("MACRO MONITOR", rows.length ? `<div class="t-scroll"><table class="t-table"><thead><tr><th>지표</th><th>최근</th><th>1M</th><th>1Y</th><th>기준일</th><th>추이</th><th>출처</th></tr></thead><tbody>${rows.map((row) => `<tr><td class="is-text"><b>${esc(row.label)}</b><small>${esc(row.id)}</small></td><td>${num(row.last, row.last >= 100 ? 1 : 2)}${row.unit ? ` <small class="muted">${esc(row.unit)}</small>` : ""}</td><td>${row.changeKind === "level" ? num(row.chg1m, 2) : pct(row.chg1m)}</td><td>${row.changeKind === "level" ? num(row.chg1y, 2) : pct(row.chg1y)}</td><td>${esc(day(row.asOf))}</td><td>${spark(row.spark)}</td><td>${link(row.url, row.source || "출처")}</td></tr>`).join("")}</tbody></table></div>` : '<p class="t-empty">매크로 데이터 없음</p>', { flush: true })}
        ${panel("RISK FACTOR", risk ? `<p>${scoreBar(risk.score)}</p><p>${esc(risk.verdict)}</p><p class="muted">${esc(risk.soWhat)}</p>` : '<p class="t-empty">요인 없음</p>')}
      </div>`;
  }

  function renderScreener() {
    const config = state.screener;
    const screener = state.data.screener || {};
    const all = screener.rows || [];
    const countries = ["all", ...new Set(all.map((row) => row.country).filter(Boolean))];
    const getters = {
      marketCap: (row) => row.marketCap, change: (row) => row.change, pe: (row) => row.pe, evEbitda: (row) => row.evEbitda, pb: (row) => row.pb,
      grossMargin: (row) => row.grossMargin, rsi: (row) => row.rsi, ratingScore: (row) => row.ratingScore, perf1m: (row) => row.perf1m, perf3m: (row) => row.perf3m, perfYtd: (row) => row.perfYtd, perf1y: (row) => row.perf1y,
    };
    const rows = all.filter((row) => config.country === "all" || row.country === config.country)
      .sort((a, b) => {
        const left = getters[config.sort]?.(a);
        const right = getters[config.sort]?.(b);
        if (!isNum(left)) return 1;
        if (!isNum(right)) return -1;
        return (Number(left) - Number(right)) * config.dir;
      });
    const columns = [[null, "종목"], [null, "국가"], ["marketCap", "시가총액"], [null, "종가"], ["change", "1D"], ["pe", "P/E"], ["evEbitda", "EV/EBITDA"], ["pb", "P/B"], ["grossMargin", "GM"], ["rsi", "RSI"], ["ratingScore", "기술 등급"], ["perf1m", "1M"], ["perf3m", "3M"], ["perfYtd", "YTD"], ["perf1y", "1Y"]];
    const body = rows.map((row) => `<tr><td class="is-text"><span class="t-ticker">${esc(row.ticker)}</span><small>${esc(row.name || "")}</small></td><td class="is-text">${esc(row.country || "")}</td><td>${big(row.marketCap, row.currency)}</td><td>${price(row.close)}</td><td>${pct(row.change)}</td><td>${num(row.pe, 1, "x")}</td><td>${num(row.evEbitda, 1, "x")}</td><td>${num(row.pb, 2, "x")}</td><td>${num(row.grossMargin, 1, "%")}</td><td>${num(row.rsi, 1)}</td><td>${row.rating ? chip(row.rating, row.ratingScore > 0.1 ? "positive" : row.ratingScore < -0.1 ? "negative" : "neutral") : dash}</td><td>${pct(row.perf1m)}</td><td>${pct(row.perf3m)}</td><td>${pct(row.perfYtd)}</td><td>${pct(row.perf1y)}</td></tr>`).join("");
    main.innerHTML = `
      ${head("SCRN", `${rows.length}개 종목`, `${esc(screener.source || "TradingView public scanner")} · ${esc(stamp(screener.asOf))}`)}
      <div class="t-filter">${countries.map((country) => `<button type="button" class="t-toggle" data-country="${esc(country)}" aria-pressed="${config.country === country}">${esc(country === "all" ? "전체 국가" : country)}</button>`).join("")}</div>
      ${panel("GLOBAL SEMICONDUCTOR SCREEN", body ? `<div class="t-scroll is-tall"><table class="t-table"><thead><tr>${columns.map(([key, label]) => (key ? sortHeader(key, label, config) : `<th>${esc(label)}</th>`)).join("")}</tr></thead><tbody>${body}</tbody></table></div>` : `<p class="t-empty">스크리너 데이터 수집 전 · 상태 ${esc(state.data.providers?.tradingviewScreener?.state || "미실행")} · SRC 참고</p>`, { flush: true, meta: "업종 Semiconductors · Electronic Production Equipment · 시총 20억$ 이상 · 지연 시세" })}`;
    $$("[data-country]", main).forEach((button) => button.addEventListener("click", () => { config.country = button.dataset.country; renderScreener(); }));
    $$("[data-sort]", main).forEach((button) => button.addEventListener("click", () => {
      const key = button.dataset.sort;
      if (config.sort === key) config.dir = -config.dir;
      else { config.sort = key; config.dir = -1; }
      renderScreener();
    }));
  }

  function renderCalendar() {
    const data = state.data;
    const earnings = data.earnings || [];
    const catalysts = data.memo?.catalysts || [];
    const industries = data.industries || [];
    main.innerHTML = `
      ${head("CAL", "실적 일정 · 검증 촉매 · 업종 순위")}
      <div class="t-grid is-halves">
        ${panel("EARNINGS CALENDAR", earnings.length ? `<div class="t-scroll"><table class="t-table"><thead><tr><th>종목</th><th>체인</th><th>발표</th><th>D-day</th><th>EPS 예상</th><th>범위</th><th>매출 예상</th></tr></thead><tbody>${earnings.map((row) => `<tr data-security="${esc(row.id)}" tabindex="0"><td class="is-text"><span class="t-ticker">${esc(bbg(row.symbol))}</span><small>${esc(row.name)}</small></td><td class="is-text">${esc(row.valueChainLabel)}</td><td>${esc(row.date)}</td><td>D${row.days >= 0 ? "-" : "+"}${Math.abs(row.days)}</td><td>${num(row.epsAverage, 2)}</td><td><small>${num(row.epsLow, 2)} ~ ${num(row.epsHigh, 2)}</small></td><td>${big(row.revenueAverage)}</td></tr>`).join("")}</tbody></table></div>` : '<p class="t-empty">실적 일정 수집 전 · OpenBB company calendar</p>', { flush: true, meta: "OpenBB · 120일 이내" })}
        ${panel("VERIFIED CATALYSTS", catalysts.length ? `<ul class="t-news">${catalysts.map((item) => `<li><time>${esc(day(item.date))}</time><span>${link(item.url, item.title)}<small class="muted" style="display:block">${esc(item.label)}</small></span><span>${esc(item.source)} · ${esc(item.priority)}</span></li>`).join("")}</ul>` : '<p class="t-empty">검증 이벤트 없음</p>', { flush: true, meta: "공식·리서치 원문에서 추출한 이벤트" })}
        ${industries.map((block) => panel(`YAHOO INDUSTRY · ${block.slug}`, `${block.overview ? `<p class="muted" style="padding:8px 10px;margin:0">${esc(block.overview.name || "")} · 시총 ${big(block.overview.marketCap, "USD")} · 시장 비중 ${num(block.overview.marketWeight, 1, "%")} · ${esc(block.overview.companies ?? "—")}개사</p>` : ""}
          <div class="t-scroll"><table class="t-table"><thead><tr><th>상위 성과</th><th>YTD</th><th>종가</th><th>목표가</th></tr></thead><tbody>${(block.topPerforming || []).map((row) => `<tr><td class="is-text"><span class="t-ticker">${esc(bbg(row.symbol))}</span><small>${esc(row.name || "")}</small></td><td>${pct(row.ytd)}</td><td>${price(row.last)}</td><td>${price(row.target)}</td></tr>`).join("")}</tbody></table></div>`, { flush: true, meta: esc(stamp(block.asOf)) })).join("")}
      </div>`;
  }

  function renderRisk() {
    const memo = state.data.memo;
    const factors = (memo?.factors || []).map((factor) => `<tr><td class="is-text"><b>${esc(factor.label)}</b><small>${esc(factor.soWhat || "")}</small></td><td>${Math.round(Number(factor.weight || 0) * 100)}%</td><td>${scoreBar(factor.score)}</td><td class="is-text"><small>${esc(factor.verdict || "")}${factor.note ? ` · ${esc(factor.note)}` : ""}</small></td></tr>`).join("");
    main.innerHTML = `
      ${head("RISK", "논지 폐기 조건 · 시나리오 · 요인 상세", esc(memo?.method?.stance || ""))}
      <div class="t-grid">
        ${panel("KILL CRITERIA", killTable(memo?.killCriteria || [], { rationale: true }), { flush: true })}
        ${panel("SCENARIOS", scenarioBlock(memo, { full: true }))}
        ${panel("FACTOR DETAIL", factors ? `<div class="t-scroll"><table class="t-table"><thead><tr><th>요인 · So what</th><th>가중</th><th>점수</th><th>판정</th></tr></thead><tbody>${factors}</tbody></table></div>` : '<p class="t-empty">요인 없음</p>', { flush: true, meta: esc(memo?.method?.factors || "") })}
      </div>`;
  }

  function renderNews() {
    const news = state.data.news || {};
    const all = [
      ...(news.verified || []).map((item) => ({ ...item, group: "verified" })),
      ...(news.company || []).map((item) => ({ ...item, group: "company" })),
    ].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const filter = state.news;
    const categoryLabels = { dram: "DRAM", nand: "NAND", hbm: "HBM", aidemand: "AI 수요", packaging: "패키징", equipment: "장비" };
    const categories = ["all", ...new Set(all.map((item) => item.category).filter(Boolean))];
    const rows = all.filter((item) => (filter === "all" || item.group === filter) && (state.newsCategory === "all" || item.category === state.newsCategory));
    main.innerHTML = `
      ${head("NEWS", `${rows.length}건`, "검증 = 크롤러 근거 게이트 통과 · 번역 검증본 / 기업 = OpenBB yfinance 원문 헤드라인")}
      <div class="t-filter">${[["all", "전체"], ["verified", "검증 뉴스"], ["company", "기업 헤드라인 (영문)"]].map(([id, label]) => `<button type="button" class="t-toggle" data-news="${id}" aria-pressed="${filter === id}">${label}</button>`).join("")}</div>
      <div class="t-filter">${categories.map((id) => `<button type="button" class="t-toggle" data-news-category="${esc(id)}" aria-pressed="${state.newsCategory === id}">${esc(id === "all" ? "전체 분야" : categoryLabels[id] || id)}</button>`).join("")}</div>
      ${panel("NEWS", rows.length ? `<ul class="t-news">${rows.map((item) => `<li><time>${esc(day(item.date))}</time>${link(item.url, item.title)}<span>${item.category ? `${esc(categoryLabels[item.category] || item.category)} · ` : ""}${esc(item.source || "")}${item.symbols ? ` · ${esc(item.symbols)}` : ""}</span></li>`).join("")}</ul>` : '<p class="t-empty">뉴스 없음</p>', { flush: true })}`;
    $$("[data-news]", main).forEach((button) => button.addEventListener("click", () => { state.news = button.dataset.news; renderNews(); }));
    $$("[data-news-category]", main).forEach((button) => button.addEventListener("click", () => { state.newsCategory = button.dataset.newsCategory; renderNews(); }));
  }

  function renderSources() {
    const data = state.data;
    const providers = Object.entries(data.providers || {});
    main.innerHTML = `
      ${head("SRC", "데이터 소스 · 라이선스 · 방법론", `run ${esc(data.runId)} · 생성 ${esc(stamp(data.generatedAt))}`)}
      <div class="t-grid is-halves">
        ${panel("ACTIVE SOURCES", `<div class="t-scroll"><table class="t-table"><thead><tr><th>소스</th><th>라이선스</th><th>버전</th><th>상태</th><th>성공 · 실패</th><th>완료</th></tr></thead><tbody>
          <tr><td class="is-text"><b>크롤러 검증 데이터</b><small>일별 종가 · TrendForce 가격 · EDGAR · TWSE · 뉴스 근거 게이트</small></td><td>—</td><td>—</td><td>${chip("검증", "ok")}</td><td>—</td><td>${esc(stamp(data.generatedAt))}</td></tr>
          ${providers.map(([id, item]) => `<tr><td class="is-text"><b>${link(item.url, item.package || id)}</b><small>${esc(id)}${item.ohlcvFiles ? ` · OHLCV ${esc(item.ohlcvFiles)}개` : ""}</small></td><td>${esc(item.license || "")}</td><td>${esc(item.version || "—")}</td><td>${chip(item.state, item.state === "ok" ? "ok" : item.state === "partial" ? "warn" : item.state === "failed" ? "kill" : "unknown")}</td><td>${esc(item.ok)} · ${esc(item.failed)}</td><td>${esc(stamp(item.finishedAt))}</td></tr>`).join("")}
          <tr><td class="is-text"><b>${link("https://github.com/klinecharts/KLineChart", "KLineChart 10.0.3")}</b><small>GP 캔들·지표 차트</small></td><td>Apache-2.0</td><td>10.0.3</td><td>${chip(window.klinecharts ? "로드됨" : "미로드", window.klinecharts ? "ok" : "kill")}</td><td>—</td><td>—</td></tr>
          <tr><td class="is-text"><b>${link("https://github.com/tradingview/lightweight-charts", "TradingView Lightweight Charts 5.2.1")}</b><small>COMP 다중 시리즈 비교</small></td><td>Apache-2.0</td><td>5.2.1</td><td>${chip(window.LightweightCharts ? "로드됨" : "미로드", window.LightweightCharts ? "ok" : "kill")}</td><td>—</td><td>—</td></tr>
        </tbody></table></div>`, { flush: true, meta: "계정·API 키·로그인 없이 접근 가능한 소스만 사용" })}
        ${panel("EXCLUDED SOURCES", `<div class="t-scroll"><table class="t-table"><thead><tr><th>소스</th><th>제외 사유</th></tr></thead><tbody>${(data.excludedSources || []).map((item) => `<tr><td class="is-text"><b>${esc(item.name)}</b></td><td class="is-text">${esc(item.reason)}</td></tr>`).join("")}</tbody></table></div>`, { flush: true })}
        ${panel("METHOD", `<dl class="t-kv">
          <div><dt>투자 의견</dt><dd><small>${esc(data.memo?.method?.stance || "")}</small></dd></div>
          <div><dt>요인 가중</dt><dd><small>${esc(data.memo?.method?.factors || "")}</small></dd></div>
          <div><dt>주가 위치</dt><dd><small>${esc(data.memo?.method?.positioning || "")}</small></dd></div>
          <div><dt>종목 신호</dt><dd><small>${esc(data.memo?.method?.signals || "")}</small></dd></div>
        </dl>`)}
        ${panel("TERMS", `<ul class="t-changes">
          <li>Yahoo Finance 데이터(OpenBB yfinance 경유)는 Yahoo 이용약관상 개인·연구 목적 이용 전제 · 지연 시세</li>
          <li>TradingView 스캐너는 로그인 없는 공개 지연 데이터 · 실시간 아님</li>
          <li>FRED 시리즈는 세인트루이스 연준 공개 데이터 · 원 출처 표기 유지</li>
          <li>${esc(data.memo?.method?.disclaimer || "투자 권유 아님")}</li>
        </ul>`)}
      </div>`;
  }

  function renderHelp() {
    const items = [
      ["MU GP", "종목 차트 · 티커·코드·이름 모두 가능 (000660 GP, SKHYNIX GP)"],
      ["MU DES", "종목 개요 · 밸류에이션 · 컨센서스 · 추정치 · 실적 일정 · 의견 변경 · 기관·내부자"],
      ["COMP", "상대 성과 비교 · 메모리·AI 대표·장비·선택 종목 vs SOX"],
      ["BRKR", "증권사 의견·목표가 변경 · 증권사별 집계 · 검증 기사 속 증권사 견해"],
      ["ALRT", "오늘의 알림 · RSI·52주 고저·골든/데드크로스·급등락 · 의견 변경 · 실적 임박"],
      ["CORR", "커버리지·벤치마크 60일 수익률 상관관계"],
      ["MU BTST", "200일선 추세 전략 vs 매수 후 보유 백테스트 (LEAN 방식 단순화)"],
      ["MU US DES <GO>", "블룸버그식 명령 · 거래소 코드(US·KS·JT·CH·TT·NA) 무시하고 종목 해석"],
      ["ETF", "SMH·SOXX 등 반도체 ETF 성과·상위 보유종목"],
      ["TOP", "오늘의 투자 판단 · IC 메모 · 폐기 조건 · 바스켓"],
      ["MON", "반도체 전 종목 모니터 · 지역·체인 필터 · 정렬"],
      ["EQRV", "상대 가치 산점도 · 배수 대비 성장"],
      ["MEM", "DRAM·NAND 현물·계약가 모니터"],
      ["ECO", "금리·달러·VIX·반도체 산업생산·PPI·환율·SOX"],
      ["SCRN", "TradingView 글로벌 반도체 스크리너"],
      ["CAL", "실적 발표 일정 · 검증 촉매 · Yahoo 업종 순위"],
      ["RISK", "논지 폐기 조건 · 시나리오 · 요인 상세"],
      ["NEWS", "검증 뉴스 · 기업 헤드라인"],
      ["SRC", "데이터 소스 상태 · 라이선스 · 제외 소스"],
      ["/ · Esc", "명령줄 이동 · 이전 화면"],
      ["1 ~ 0 · A · B · C · E · T · X · N · S", "기능 단축키 (명령줄 밖에서)"],
    ];
    main.innerHTML = `${head("HELP", "명령어")}<div class="t-help">${items.map(([command, text]) => `<div><b>${esc(command)}</b><p>${esc(text)}</p></div>`).join("")}</div>`;
  }

  function emptyScreen(fn) {
    main.innerHTML = `${head(fn)}<p class="t-empty">표시할 종목 없음</p>`;
  }

  const RENDERERS = { TOP: renderTop, MON: renderMonitor, GP: renderChart, COMP: renderCompare, BRKR: renderBrokers, BTST: renderBacktest, ALRT: renderAlerts, CORR: renderCorrelation, ETF: renderEtfs, DES: renderDescription, EQRV: renderRelativeValue, MEM: renderMemory, ECO: renderMacro, SCRN: renderScreener, CAL: renderCalendar, RISK: renderRisk, N: renderNews, SRC: renderSources, HELP: renderHelp };

  function render() {
    if (!state.data) return;
    if (state.fn !== "GP") disposeChart();
    if (state.fn !== "COMP" && state.compChart) { try { state.compChart.remove(); } catch { /* gone */ } state.compChart = null; }
    $$("[data-fn]").forEach((button) => {
      if (button.dataset.fn === state.fn) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    const [code, title] = FN_TITLE[state.fn] || [state.fn, ""];
    document.title = `${code} · ${title} · Semiconductor Terminal`;
    try {
      RENDERERS[state.fn]();
    } catch (error) {
      console.error(error);
      main.innerHTML = `${head(state.fn)}<p class="t-empty">화면 구성 오류 · ${esc(error.message)}</p>`;
    }
    main.scrollTop = 0;
    renderSecurityBar();
  }

  // ── Chrome: tape, clocks, run status ─────────────────────────────────────
  function renderTape() {
    const track = $("#terminalTapeTrack");
    if (!track || !state.data) return;
    const picks = equities().filter((row) => row.isIndex || row.memo || ["nvidia-stock", "tsmc-stock", "asml-stock"].includes(row.id));
    const items = [
      ...picks.map((row) => `<button type="button" data-security="${esc(row.id)}"><b>${esc(bbg(row.symbol))}</b><span>${priceText(row.price.last) ?? "—"}</span>${pct(row.price.ret1d)}</button>`),
      ...(state.data.memoryPrices || []).slice(0, 4).map((row) => `<button type="button" data-fn-jump="MEM"><b>${esc(row.label)}</b><span>${priceText(row.last) ?? "—"}</span>${pct(row.chg30)}<small class="muted">30D</small></button>`),
      ...(state.data.macro || []).filter((row) => ["DGS10", "USDKRW", "VIXCLS"].includes(row.id)).map((row) => `<button type="button" data-fn-jump="ECO"><b>${esc(row.label)}</b><span>${fixed(row.last, 2) ?? "—"}</span></button>`),
    ];
    track.innerHTML = items.join("") + items.join("");
  }

  function marketOpen(timeZone, openMinutes, closeMinutes) {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
    const get = (type) => parts.find((part) => part.type === type)?.value;
    const minutes = Number(get("hour")) % 24 * 60 + Number(get("minute"));
    return !["Sat", "Sun"].includes(get("weekday")) && minutes >= openMinutes && minutes < closeMinutes;
  }
  function tickClocks() {
    const format = (timeZone) => new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date());
    $("#clockSeoul").textContent = format("Asia/Seoul");
    $("#clockNewYork").textContent = format("America/New_York");
    const krx = marketOpen("Asia/Seoul", 9 * 60, 15 * 60 + 30);
    const nyse = marketOpen("America/New_York", 9 * 60 + 30, 16 * 60);
    const krxNode = $("#marketKrx");
    const nyseNode = $("#marketNyse");
    krxNode.textContent = krx ? "KRX 장중" : "KRX 장마감";
    nyseNode.textContent = nyse ? "NYSE 장중" : "NYSE 장마감";
    krxNode.classList.toggle("is-open", krx);
    nyseNode.classList.toggle("is-open", nyse);
  }
  // pages.yml runs at minute 17 of every sixth UTC hour; show the next slot.
  const nextRefresh = (now = Date.now()) => {
    const slot = new Date(now);
    slot.setUTCMinutes(17, 0, 0);
    slot.setUTCHours(Math.floor(slot.getUTCHours() / 6) * 6);
    while (slot.getTime() <= now) slot.setUTCHours(slot.getUTCHours() + 6);
    return slot;
  };
  const kstTime = (value) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
  function renderRunStatus(error = null) {
    const node = $("#terminalRun");
    if (!node) return;
    if (error) {
      node.className = "t-run is-error";
      node.innerHTML = `<b>데이터 불일치</b> · 최신 실행본 재확인 중`;
      return;
    }
    const expires = Date.parse(state.data?.expiresAt || "");
    const stale = Number.isFinite(expires) && Date.now() > expires;
    node.className = `t-run${stale ? " is-stale" : ""}`;
    node.innerHTML = `<b>${stale ? "갱신 지연" : "검증본"}</b> run ${esc(state.data.runId)} · ${esc(stamp(state.data.generatedAt))} KST<br />시장 데이터 ${esc(stamp(state.data.collectedAt))} · 다음 갱신 ${esc(kstTime(nextRefresh()))}`;
  }

  // ── Events ────────────────────────────────────────────────────────────────
  function wireCommand() {
    const form = $("#terminalCommand");
    const input = $("#terminalCommandInput");
    const list = $("#terminalSuggest");
    let active = -1;
    const close = () => { list.hidden = true; list.innerHTML = ""; active = -1; };
    const show = () => {
      const items = suggestions(input.value);
      if (!items.length) return close();
      list.innerHTML = items.map((item, index) => `<li role="option" data-index="${index}" data-kind="${item.kind}" data-value="${esc(item.kind === "fn" ? item.label : item.id)}" aria-selected="${index === active}"><b>${esc(item.label)}</b><span>${esc(item.detail || "")}</span><i>${esc(item.extra || (item.kind === "fn" ? "기능" : ""))}</i></li>`).join("");
      list.hidden = false;
    };
    const pick = (node) => {
      if (!node) return;
      close();
      input.value = "";
      if (node.dataset.kind === "fn") go(node.dataset.value);
      else go(["GP", "DES"].includes(state.fn) ? state.fn : "DES", node.dataset.value);
    };
    input.addEventListener("input", () => { active = -1; show(); });
    input.addEventListener("keydown", (event) => {
      const items = $$("li", list);
      if (event.key === "ArrowDown" && items.length) { event.preventDefault(); active = (active + 1) % items.length; show(); }
      else if (event.key === "ArrowUp" && items.length) { event.preventDefault(); active = (active - 1 + items.length) % items.length; show(); }
      else if (event.key === "Escape") { close(); input.blur(); }
      else if (event.key === "Enter" && active >= 0 && items[active]) { event.preventDefault(); pick(items[active]); }
    });
    list.addEventListener("mousedown", (event) => { event.preventDefault(); pick(event.target.closest("li")); });
    input.addEventListener("blur", () => window.setTimeout(close, 120));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = input.value;
      input.value = "";
      close();
      runCommand(value);
    });
  }

  function wireSectorKeys() {
    $("#terminalSectors")?.addEventListener("click", (event) => {
      const key = event.target.closest("[data-sector]");
      if (!key) return;
      const target = key.dataset.sector;
      if (target === "CANCEL") return goBack();
      if (target === "EQUITY") { state.monitor.region = "all"; state.monitor.chain = "all"; return go("MON"); }
      if (target === "INDEX") return go("GP", "sox");
      go(target);
    });
  }

  function wireGlobal() {
    wireSectorKeys();
    $("#terminalKeys").addEventListener("click", (event) => {
      const button = event.target.closest("[data-fn]");
      if (button) go(button.dataset.fn);
    });
    document.addEventListener("click", (event) => {
      const jump = event.target.closest("[data-fn-jump]");
      if (jump) return go(jump.dataset.fnJump);
      const row = event.target.closest("[data-security]");
      if (row && !event.target.closest("a")) go(["GP", "BTST"].includes(state.fn) ? state.fn : "DES", row.dataset.security);
    });
    document.addEventListener("keydown", (event) => {
      const typing = event.target.closest("input, textarea, select");
      if (event.key === "Enter" && event.target.matches("tr[data-security]")) {
        go(state.fn === "GP" ? "GP" : "DES", event.target.dataset.security);
        return;
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "/") { event.preventDefault(); $("#terminalCommandInput").focus(); return; }
      if (event.key === "Escape") { goBack(); return; }
      const fn = KEY_TO_FN[event.key.toLowerCase()];
      if (fn) { event.preventDefault(); go(fn); }
    });
    window.addEventListener("hashchange", () => applyHash());
    window.addEventListener("resize", () => state.chart.instance?.resize?.());
  }

  function applyHash() {
    const [fn, id] = location.hash.replace(/^#/, "").split("/");
    const code = String(fn || "").toUpperCase();
    if (!FUNCTIONS.includes(code)) return go("TOP", state.securityId, { push: false });
    if (id && equities().some((row) => row.id === id)) state.securityId = id;
    go(code, state.securityId, { push: false });
  }

  async function refreshIfNewRun() {
    try {
      const manifest = await fetchJson(`${DATA}data-manifest.json`, { reload: true });
      if (String(manifest.runId) === String(state.data?.runId)) return;
      await loadData({ reload: true });
      state.barsCache.clear();
      state.marketHistory = null;
      renderRunStatus();
      renderTape();
      render();
      message(`새 검증본 반영 · run ${state.data.runId}`);
    } catch (error) {
      console.warn("terminal refresh", error);
    }
  }

  async function boot() {
    try {
      await loadData();
      renderRunStatus();
      renderTape();
      applyHash();
      window.setInterval(refreshIfNewRun, REFRESH_MS);
    } catch (error) {
      console.error(error);
      renderRunStatus(error);
      main.innerHTML = `<section class="t-boot"><h1>데이터 연결 실패</h1><p>검증 실행본과 일치하는 터미널 데이터를 찾지 못함 · 잠시 후 자동 재시도</p></section>`;
      window.setTimeout(boot, 30_000);
    }
  }

  function start() {
    wireCommand();
    wireGlobal();
    tickClocks();
    window.setInterval(tickClocks, 1000);
    void boot();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
