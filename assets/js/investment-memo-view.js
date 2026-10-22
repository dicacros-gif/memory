// Investment committee memo views for the console.
//
// Every block here renders data/investment-memo-client.json, which the crawl
// regenerates from the verified run. Nothing is written into the markup by
// hand: when the memo is missing or from another run the caller shows a
// data-state message instead.

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
const isNum = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
const signed = (value, digits = 2) => (isNum(value) ? `${Number(value) > 0 ? "+" : ""}${Number(value).toFixed(digits)}` : "—");
const shortDate = (value) => {
  const text = String(value || "");
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${Number(match[2])}/${Number(match[3])}`;
  return /^\d{4}-(?:\d{2}|Q[1-4])$/.test(text) ? text.replace(/^20/, "'") : text;
};
const safeUrl = (url) => (typeof url === "string" && /^https?:\/\//.test(url) ? url : "");
const sourceLink = (url, label) => {
  const href = safeUrl(url);
  return href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>` : esc(label);
};
const toneClass = (tone) => (["positive", "negative", "caution"].includes(tone) ? ` is-${tone}` : "");
const STATUS_CLASS = { ok: "is-ok", warn: "is-warn", kill: "is-kill", unknown: "is-unknown" };

// "All clear" only when every indicator was read; missing data is not normal.
function quietLabel(rows = []) {
  const unknown = rows.filter((row) => row.status === "unknown").length;
  const ok = rows.filter((row) => row.status === "ok").length;
  return unknown ? `판독된 점검 지표 ${ok}개 정상 범위` : "점검 지표 모두 정상 범위";
}

export function memoMatchesRun(memo, runId) {
  return Boolean(memo && memo.clientArtifact === true && runId && String(memo.runId) === String(runId));
}

function scoreCells(score) {
  if (!isNum(score)) return '<span class="memo-score is-empty">미반영</span>';
  const value = Number(score);
  const cells = [-2, -1, 1, 2].map((step) => {
    const on = (value < 0 && step < 0 && step >= value) || (value > 0 && step > 0 && step <= value);
    return `<i class="${on ? (step < 0 ? "is-down" : "is-up") : ""}"></i>`;
  }).join("");
  return `<span class="memo-score" aria-label="점수 ${value}">${cells}<b>${value > 0 ? "+" : ""}${value}</b></span>`;
}

function gauge(composite) {
  // No score, no marker: a needle parked at neutral would read as a call.
  const value = isNum(composite) ? Number(composite) : null;
  const left = value === null ? null : Math.max(0, Math.min(100, ((value + 2) / 4) * 100));
  return `<div class="memo-gauge" role="img" aria-label="${value === null ? "종합 점수 없음" : `종합 점수 ${esc(signed(value))}`}">${left === null ? "" : `<i style="left:${left.toFixed(1)}%"></i>`}</div>
    <div class="memo-gauge-scale"><span>비중축소</span><span>중립</span><span>비중확대</span></div>`;
}

// Route 1: the answer before the evidence.
export function renderMemoVerdict(memo) {
  const verdict = memo?.verdict;
  if (!verdict) return "";
  const kills = (memo.killCriteria || []).filter((row) => row.status === "kill").length;
  const warns = (memo.killCriteria || []).filter((row) => row.status === "warn").length;
  const scenarios = memo.scenarios || [];
  return `
    <article class="memo-verdict" aria-labelledby="memoVerdictTitle">
      <header>
        <span>INVESTMENT COMMITTEE MEMO · ${esc(shortDate(memo.asOf))} 기준</span>
        <em>매 실행 자동 재계산 · 규칙 기반 · 투자 권유 아님</em>
      </header>
      <div class="memo-verdict-body">
        <div class="memo-verdict-call">
          <small>${esc(verdict.sector)}</small>
          <h3 id="memoVerdictTitle">${esc(verdict.stance?.label || "판단 보류")}<span>${esc(verdict.stance?.labelEn || "")}</span></h3>
          <dl>
            <div><dt>종합 점수</dt><dd>${esc(signed(verdict.composite))}</dd></div>
            <div><dt>확신도</dt><dd>${esc(verdict.conviction?.label || "—")}</dd></div>
            <div><dt>점검 지표</dt><dd>경고 ${warns} · 폐기 ${kills}</dd></div>
          </dl>
          ${gauge(verdict.composite)}
          ${verdict.threshold ? `<p class="memo-threshold">${esc(verdict.threshold.label)} ${esc(Number(verdict.threshold.distance).toFixed(2))}점</p>` : ""}
          ${verdict.override ? `<p class="memo-threshold">${esc(verdict.override)}</p>` : ""}
        </div>
        <div class="memo-verdict-why">
          <p class="memo-tactic"><b>실행</b>${esc(verdict.tactic || "")}</p>
          <ol>${(verdict.keyMessages || []).map((item) => `
            <li><strong>${esc(item.label)} ${scoreCells(item.score)}</strong><span>${esc(item.verdict)}</span><small>${esc(item.soWhat)}</small></li>`).join("")}</ol>
        </div>
      </div>
      <footer>
        <div class="memo-prob" role="img" aria-label="시나리오 가중치 · 규칙 기반 · 통계적 확률 아님" title="종합 점수와 경고 수로 기울인 규칙 기반 가중치 · 통계적 확률 추정 아님">${scenarios.map((item) => `<span class="is-${esc(item.id)}" style="width:${Number(item.probability) || 0}%">${esc(item.label)} ${esc(item.probability)}%</span>`).join("")}</div>
        <button type="button" data-memo-jump="investor-thesis">전체 투자 메모 →</button>
        <a href="terminal/" class="memo-terminal-link">반도체 터미널 ↗</a>
      </footer>
    </article>`;
}

function evidenceRows(rows = []) {
  return rows.filter(Boolean).map((row) => `
    <div class="memo-evidence${toneClass(row.tone)}"><dt>${esc(row.label)}</dt><dd><strong>${esc(row.value)}</strong>${row.detail ? `<small>${esc(row.detail)}</small>` : ""}<span>${sourceLink(row.url, row.source || "출처")}${row.asOf ? ` · ${esc(shortDate(row.asOf))}` : ""}</span></dd></div>`).join("");
}

// Routes 4, 5 and 6: the figures that used to be typed into the page.
export function renderMemoLedger(memo, board) {
  const groups = memo?.ledgers?.[board] || [];
  const news = memo?.ledgerNews?.[board] || [];
  const blocks = groups
    .filter((group) => (group.rows || []).length)
    .map((group) => `<div class="investor-evidence-group"><h3>${esc(group.title)}</h3><dl>${evidenceRows(group.rows)}</dl></div>`);
  if (news.length) {
    blocks.push(`<div class="investor-evidence-group"><h3>이번 실행 신규 근거</h3><dl>${news.map((item) => `
      <div class="memo-evidence"><dt>${esc(shortDate(item.date))}</dt><dd><strong>${sourceLink(item.url, item.titleKo)}</strong><span>${esc(item.source || "")}</span></dd></div>`).join("")}</dl></div>`);
  }
  return blocks.join("") || '<p class="memo-empty">이번 실행에서 검증된 수치 없음 · 다음 실행에서 재확인</p>';
}

export function renderMemoScenarios(memo) {
  return (memo?.scenarios || []).map((scenario) => `
    <article class="is-${esc(scenario.id)}">
      <span title="종합 점수와 경고 수로 기울인 규칙 기반 가중치 · 통계적 확률 추정 아님">${esc(String(scenario.label).toUpperCase())} · 가중치 ${esc(scenario.probability)}%</span>
      <h3>${esc(scenario.title)}</h3>
      <ul>${(scenario.watch || []).map((watch) => `<li>${esc(watch.label)} <b>${esc(watch.display)}</b> <em class="memo-status ${STATUS_CLASS[watch.status] || ""}">${esc(watch.statusLabel)}</em></li>`).join("")}</ul>
      <small>${esc(scenario.reference || "")}</small>
    </article>`).join("");
}

export function renderMemoKillMonitor(memo, { title = "논지 폐기 조건 · 이번 실행 판정" } = {}) {
  const rows = memo?.killCriteria || [];
  if (!rows.length) return "";
  return `
    <div class="memo-kill" role="table" aria-label="${esc(title)}">
      <div class="memo-kill-row is-head" role="row"><span role="columnheader">${esc(title)}</span><span role="columnheader">현재</span><span role="columnheader">경고 · 폐기</span><span role="columnheader">상태</span></div>
      ${rows.map((row) => `
        <div class="memo-kill-row" role="row">
          <span role="cell"><strong>${esc(row.label)}</strong><small>${esc(row.rationale || "")}</small></span>
          <span role="cell"><b>${esc(row.display)}</b><small>${sourceLink(row.url, row.source || "")}${row.asOf ? ` · ${esc(shortDate(row.asOf))}` : ""}</small></span>
          <span role="cell">${esc(row.warn)} · ${esc(row.kill)}</span>
          <span role="cell"><em class="memo-status ${STATUS_CLASS[row.status] || ""}">${esc(row.statusLabel)}</em></span>
        </div>`).join("")}
    </div>`;
}

const pct = (value) => (isNum(value) ? `${Number(value) > 0 ? "+" : ""}${Number(value).toFixed(Math.abs(Number(value)) >= 100 ? 0 : 1)}%` : "—");
const pctClass = (value) => (!isNum(value) || Number(value) === 0 ? "" : Number(value) > 0 ? "is-up" : "is-down");

function historySpark(history = []) {
  const points = history.filter((row) => isNum(row.composite));
  if (points.length < 2) return `<p class="memo-history-note">판단 이력 ${points.length}회 · 실행이 쌓이면 추이 표시</p>`;
  const width = 320;
  const height = 64;
  const x = (index) => (index / (points.length - 1)) * width;
  const y = (value) => height / 2 - (Number(value) / 2) * (height / 2 - 4);
  const line = points.map((row, index) => `${x(index).toFixed(1)},${y(row.composite).toFixed(1)}`).join(" ");
  return `<svg class="memo-history" viewBox="0 0 ${width} ${height}" role="img" aria-label="종합 점수 추이">
    <line x1="0" y1="${y(0.75)}" x2="${width}" y2="${y(0.75)}" class="is-band" /><line x1="0" y1="${y(-0.75)}" x2="${width}" y2="${y(-0.75)}" class="is-band" />
    <line x1="0" y1="${y(0)}" x2="${width}" y2="${y(0)}" class="is-zero" /><polyline points="${line}" /></svg>
    <p class="memo-history-note">${esc(shortDate(points[0].asOf))} ~ ${esc(shortDate(points.at(-1).asOf))} · ${points.length}회 · 점선 = 의견 경계 ±0.75</p>`;
}

// Route 7: the full memo, answer first, then the scorecard that produced it.
export function renderMemoThesis(memo) {
  const verdict = memo?.verdict;
  if (!verdict) return '<p class="memo-empty">투자 메모 데이터 없음 · 다음 검증 실행 대기</p>';
  const factors = memo.factors || [];
  const coverage = memo.coverage?.rows || [];
  const catalysts = memo.catalysts || [];
  const changes = verdict.change?.items || [];
  return `
    <section class="memo-section" aria-labelledby="memoAnswerTitle">
      <header><b>01</b><h3 id="memoAnswerTitle">결론 · ${esc(verdict.headline)}</h3><span>확신도 ${esc(verdict.conviction?.label || "—")} · 종합 ${esc(signed(verdict.composite))} · 커버리지 ${esc(verdict.coverage ?? "—")}%</span></header>
      <div class="memo-answer">
        <p class="memo-tactic"><b>실행</b>${esc(verdict.tactic)}</p>
        <p>${esc(verdict.summary)}</p>
        ${changes.length ? `<ul class="memo-changes">${changes.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>` : `<p class="memo-history-note">${verdict.change?.prior ? `직전 판단 ${esc(shortDate(verdict.change.prior.asOf))} 대비 변경 없음` : "판단 이력 축적 시작"}</p>`}
        ${historySpark(memo.history)}
      </div>
    </section>
    <section class="memo-section" aria-labelledby="memoScoreTitle">
      <header><b>02</b><h3 id="memoScoreTitle">요인 스코어카드</h3><span>${esc(memo.method?.factors || "")}</span></header>
      <div class="memo-scorecard" role="table" aria-label="요인 스코어카드">
        <div class="memo-score-row is-head" role="row"><span role="columnheader">요인</span><span role="columnheader">점수</span><span role="columnheader">판정 · So what</span><span role="columnheader">근거</span></div>
        ${factors.map((factor) => `
          <div class="memo-score-row" role="row">
            <span role="cell"><strong>${esc(factor.label)}</strong><small>가중 ${Math.round(Number(factor.weight || 0) * 100)}%</small></span>
            <span role="cell">${scoreCells(factor.score)}</span>
            <span role="cell"><strong>${esc(factor.verdict)}</strong><small>${esc(factor.soWhat)}${factor.note ? ` · ${esc(factor.note)}` : ""}</small></span>
            <span role="cell"><dl>${evidenceRows((factor.evidence || []).slice(0, 4))}</dl></span>
          </div>`).join("")}
      </div>
    </section>
    <section class="memo-section" aria-labelledby="memoCoverageTitle">
      <header><b>03</b><h3 id="memoCoverageTitle">커버리지 · 종목별 추세 신호</h3><span>${esc(memo.method?.signals || "")}</span></header>
      <div class="memo-coverage-wrap">
        <table class="memo-coverage">
          <thead><tr><th>종목</th><th>역할 · 핵심 변수</th><th>종가</th><th>1M</th><th>3M</th><th>1Y</th><th>52주 고점</th><th>200일선</th><th>SOX 대비 3M</th><th>신호</th></tr></thead>
          <tbody>${coverage.map((row) => `
            <tr>
              <td><strong>${esc(row.name)}</strong><small>${esc(row.symbol)} · ${esc(row.market)}</small></td>
              <td>${esc(row.role)}<small>${esc(row.driver)}</small></td>
              <td>${isNum(row.metrics?.close) ? esc(Number(row.metrics.close).toLocaleString("en-US", { maximumFractionDigits: 2 })) : "—"}<small>${esc(row.currency)}</small></td>
              <td class="${pctClass(row.metrics?.ret1m)}">${esc(pct(row.metrics?.ret1m))}</td>
              <td class="${pctClass(row.metrics?.ret3m)}">${esc(pct(row.metrics?.ret3m))}</td>
              <td class="${pctClass(row.metrics?.ret1y)}">${esc(pct(row.metrics?.ret1y))}</td>
              <td class="${pctClass(row.metrics?.fromHigh52)}">${esc(pct(row.metrics?.fromHigh52))}</td>
              <td class="${pctClass(row.metrics?.vsMa200)}">${esc(pct(row.metrics?.vsMa200))}</td>
              <td class="${pctClass(row.metrics?.vsSox3m)}">${esc(pct(row.metrics?.vsSox3m))}</td>
              <td><em class="memo-signal${toneClass(row.signal?.tone)}">${esc(row.signal?.label || "—")}</em><small>${esc(row.signal?.action || "")}</small></td>
            </tr>`).join("")}</tbody>
        </table>
      </div>
    </section>
    <section class="memo-section" aria-labelledby="memoKillTitle">
      <header><b>04</b><h3 id="memoKillTitle">무엇이 판단을 바꾸는가</h3><span>경고 · 폐기 조건은 매 실행 자동 판정</span></header>
      ${renderMemoKillMonitor(memo, { title: "점검 지표" })}
    </section>
    <section class="memo-section" aria-labelledby="memoCatalystTitle">
      <header><b>05</b><h3 id="memoCatalystTitle">최근 검증 촉매</h3><span>공식·리서치 원문에서 추출한 이벤트</span></header>
      <ol class="memo-catalysts">${catalysts.map((item) => `
        <li><time>${esc(shortDate(item.date))}</time><span><strong>${sourceLink(item.url, item.title)}</strong><small>${esc(item.label)} · ${esc(item.source)}</small></span><em>${esc(item.priority)}</em></li>`).join("") || '<li class="memo-empty">검증 이벤트 없음</li>'}</ol>
    </section>
    <p class="memo-method">${esc(memo.method?.stance || "")} · ${esc(memo.method?.positioning || "")} · ${esc(memo.method?.disclaimer || "")}</p>`;
}

export function renderMemoThesisOutput(memo) {
  const verdict = memo?.verdict;
  if (!verdict) return "";
  const lead = (verdict.keyMessages || [])[0];
  const catalyst = (memo.catalysts || [])[0];
  const watch = (memo.killCriteria || []).filter((row) => row.status === "kill" || row.status === "warn");
  return `
    <div><span>THESIS</span><strong>${esc(verdict.headline)} · ${esc(lead ? `${lead.label}: ${lead.soWhat}` : verdict.summary)}</strong></div>
    <div><span>CATALYST</span><strong>${esc(catalyst ? `${shortDate(catalyst.date)} ${catalyst.title}` : "검증 이벤트 대기")}</strong></div>
    <div><span>INVALIDATION</span><strong>${esc(watch.length ? watch.map((row) => `${row.label} ${row.display} (${row.statusLabel})`).join(" · ") : quietLabel(memo.killCriteria))}</strong></div>`;
}
