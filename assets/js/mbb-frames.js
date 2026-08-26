import { consultingBullet, sourceLabel } from "./public-copy-policy.js";

/**
 * Consulting frame layer — renders the AI Infra strategy as MBB-style shapes
 * (mandate fan-out, issue tree, chevron rail, thesis/criteria, quad + schema,
 * cascade, metric ladder) into the executive brief and the console panels.
 *
 * Self-mounting: it creates its own containers, fetches its own model and
 * injects its own stylesheet, so it adds nothing to the existing bundles and
 * touches none of the markup the console renders for itself.
 */
const script = document.currentScript;
const revision = new URL(script?.src || location.href).searchParams.get("v") || "current";
const base = script?.src || location.href;
const dataUrl = new URL(`../../data/mbb-frames.json?v=${encodeURIComponent(revision)}`, base);
const capitalUrl = new URL(`../../data/capital-plans.json?v=${encodeURIComponent(revision)}`, base);
const siteContentUrl = new URL(`../../data/site-content-client.json?v=${encodeURIComponent(revision)}`, base);
const styleUrl = new URL(`../css/mbb-frames.min.css?v=${encodeURIComponent(revision)}`, base);

function ensureStyle() {
  if (document.querySelector("link[data-mbb-frames]")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = styleUrl.href;
  link.dataset.mbbFrames = "1";
  document.head.appendChild(link);
}

const esc = (v) => String(v ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

const safeHref = (value) => {
  try {
    const url = new URL(String(value || ""), location.href);
    return /^https?:$/.test(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
};

const sourceLink = (source = {}) => {
  const href = safeHref(source.url || source.sourceUrl);
  if (!href) return "";
  const date = source.asOf || source.date || source.publishedAt || "";
  return `<a class="mbb-source-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(sourceLabel(date))}</a>`;
};

// Titles carry an authored <br /> for the report's two-line headline rhythm.
const headline = (v) => esc(v).replaceAll("&lt;br /&gt;", "<br />").replaceAll("&lt;br&gt;", "<br />");

const ACCENTS = ["teal", "blue", "violet", "gold", "coral"];
const accentAt = (i) => ACCENTS[i % ACCENTS.length];

const heading = (frame) => `
  <header class="mbb-head">
    <div>
      <p class="mbb-kicker">${esc(frame.kicker)}</p>
      <h3 class="mbb-title">${headline(frame.title)}</h3>
    </div>
    ${frame.lede ? `<p class="mbb-lede">${esc(frame.lede)}</p>` : ""}
  </header>`;

const rule = (frame) => (frame.rule
  ? `<p class="mbb-rule"><b>${esc(frame.rule.chip)}</b><span>${esc(frame.rule.text)}</span></p>`
  : "");

/* ---------------------------------------------------------------- shapes */

const mandateFanout = (frame) => `
  <div class="mbb-fanout">
    <article class="mbb-mandate">
      <p class="mbb-kicker">${esc(frame.mandate.kicker)}</p>
      <strong>${esc(frame.mandate.title)}</strong>
      <p>${esc(frame.mandate.note)}</p>
    </article>
    <div class="mbb-connector" aria-hidden="true"><span>${esc(frame.connector)}</span><i></i></div>
    <div class="mbb-columns">
      ${frame.columns.map((col, i) => `
        <article class="mbb-card" data-accent="${accentAt(i)}">
          <p class="mbb-index">${esc(col.index)} · ${esc(col.label)}</p>
          <strong>${esc(col.title)}</strong>
          <ul>${col.items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>
        </article>`).join("")}
    </div>
  </div>`;

const thesisCriteria = (frame) => `
  <div class="mbb-thesis-layout">
    <article class="mbb-thesis">
      <p class="mbb-kicker">${esc(frame.thesis.kicker)}</p>
      <strong>${esc(frame.thesis.title)}</strong>
      <p>${esc(frame.thesis.note)}</p>
    </article>
    <ol class="mbb-criteria">
      ${frame.criteria.map((c, i) => `
        <li class="mbb-criterion" data-accent="${accentAt(i)}">
          <p class="mbb-index">${esc(c.index)} · ${esc(c.label)}</p>
          <strong>${esc(c.title)}</strong>
          <ol class="mbb-chain">${c.chain.map((step) => `<li>${esc(step)}</li>`).join("")}</ol>
          <p class="mbb-landing">${esc(c.landing)}</p>
        </li>`).join("")}
    </ol>
  </div>`;

const constraintLedger = (frame) => `
  <div class="mbb-ledger">
    ${frame.groups.map((group) => `
      <section class="mbb-group" data-accent="${esc(group.accent)}">
        <p class="mbb-group-label">${esc(group.label)}</p>
        <div class="mbb-group-body">
          ${group.entries.map((entry) => `
            <article class="mbb-constraint">
              <strong>${esc(entry.name)}</strong>
              <p class="mbb-constraint-fact">${esc(entry.constraint)}</p>
              <dl>
                <div><dt>MEMORY READ</dt><dd>${esc(entry.read)}</dd></div>
                <div><dt>OUR MOVE</dt><dd>${esc(entry.move)}</dd></div>
              </dl>
            </article>`).join("")}
        </div>
      </section>`).join("")}
  </div>`;

const programMatrix = (frame) => `
  ${frame.note ? `<p class="mbb-note">${esc(frame.note)}</p>` : ""}
  <div class="mbb-matrix" role="table" aria-label="${esc(frame.kicker)}">
    <div class="mbb-matrix-head" role="row">${frame.columns.map((c) => `<span role="columnheader">${esc(c)}</span>`).join("")}</div>
    ${frame.rows.map((row) => `
      <div class="mbb-matrix-row" role="row">
        <strong role="cell" data-label="${esc(frame.columns[0])}">${esc(row.program)}</strong>
        <span role="cell" class="mbb-designer" data-label="${esc(frame.columns[1])}">${esc(row.designer)}</span>
        <span role="cell" data-label="${esc(frame.columns[2])}">${esc(row.deployer)}</span>
        <span role="cell" data-label="${esc(frame.columns[3])}">${esc(row.constraint)}</span>
        <span role="cell" class="mbb-entry" data-label="${esc(frame.columns[4])}">${esc(row.entry)}</span>
      </div>`).join("")}
  </div>`;

// A plain column/row table for the comparisons that only work side by side —
// workload against bottleneck, product axis against gate. The first cell leads
// the row, and every cell carries its column label for the stacked layout.
const matrix = (frame) => `
  ${frame.note ? `<p class="mbb-note">${esc(frame.note)}</p>` : ""}
  <div class="mbb-matrix" role="table" aria-label="${esc(frame.kicker)}">
    <div class="mbb-matrix-head" role="row">${frame.columns.map((c) => `<span role="columnheader">${esc(c)}</span>`).join("")}</div>
    ${frame.rows.map((row) => `
      <div class="mbb-matrix-row is-flex" role="row">
        ${row.map((cell, i) => (i === 0
          ? `<strong role="cell" data-label="${esc(frame.columns[i])}">${esc(cell)}</strong>`
          : `<span role="cell"${i === row.length - 1 ? ' class="mbb-entry"' : ""} data-label="${esc(frame.columns[i] || "")}">${esc(cell)}</span>`)).join("")}
      </div>`).join("")}
  </div>`;

// Cards whose rows are the same labelled sequence — fact, implication,
// decision, gate — so the reader compares position to position across cards.
const recordCards = (frame) => `
  <div class="mbb-records">
    ${frame.cards.map((card) => `
      <article class="mbb-record" data-accent="${esc(card.accent)}">
        <header>
          <p class="mbb-index">${esc(card.index)}</p>
          <strong>${esc(card.title)}</strong>
        </header>
        <dl>
          ${card.entries.map((entry, i) => `<div><dt>${esc(frame.labels[i] || "")}</dt><dd${i === card.entries.length - 1 ? ' class="mbb-record-gate"' : ""}>${esc(entry)}</dd></div>`).join("")}
        </dl>
        ${sourceLink(card.source)}
      </article>`).join("")}
  </div>`;

const chevronRail = (frame) => `
  <ol class="mbb-rail${frame.dense ? " is-dense" : ""}">
    ${frame.cards.map((card, i) => `
      <li class="mbb-chevron" data-accent="${accentAt(i)}">
        <p class="mbb-index">${esc(card.index)} · ${esc(card.label)}</p>
        <strong>${esc(card.title)}</strong>
        <p>${esc(card.body)}</p>
        ${card.bottleneck ? `<dl><div><dt>BOTTLENECK</dt><dd>${esc(card.bottleneck)}</dd></div><div><dt>PROOF</dt><dd>${esc(card.proof)}</dd></div></dl>` : ""}
      </li>`).join("")}
  </ol>`;

const quadSchema = (frame) => `
  <div class="mbb-quad-layout">
    <div class="mbb-quads">
      ${frame.quads.map((quad) => `
        <article class="mbb-quad" data-accent="${esc(quad.accent)}">
          <p class="mbb-index">${esc(quad.label)}</p>
          <strong>${esc(quad.title)}</strong>
          <p>${esc(quad.body)}</p>
        </article>`).join("")}
    </div>
    <div class="mbb-exchange" aria-hidden="true"></div>
    <article class="mbb-schema">
      <p class="mbb-kicker">${esc(frame.schema.kicker)}</p>
      <strong>${esc(frame.schema.title)}</strong>
      <ol>${frame.schema.steps.map((step) => `<li>${esc(step)}</li>`).join("")}</ol>
    </article>
  </div>`;

const axisSchema = (frame) => `
  <div class="mbb-axis-layout">
    <article class="mbb-axis-question">
      <p class="mbb-kicker">PREDICTION</p>
      <strong>${esc(frame.question)}</strong>
      <ul class="mbb-axes">${frame.axes.map((axis) => `<li>${esc(axis)}</li>`).join("")}</ul>
    </article>
    <article class="mbb-voice">
      <p class="mbb-kicker">${esc(frame.voice.speaker)}</p>
      <blockquote>${esc(frame.voice.quote)}</blockquote>
      <p class="mbb-landing">${esc(frame.voice.read)}</p>
    </article>
  </div>`;

const issueTree = (frame) => `
  <div class="mbb-tree">
    <article class="mbb-tree-root">
      <p class="mbb-index">${esc(frame.root.label)}</p>
      <strong>${esc(frame.root.title)}</strong>
    </article>
    <div class="mbb-branches">
      ${frame.branches.map((branch, i) => `
        <article class="mbb-branch" data-accent="${accentAt(i)}" data-lever="${esc(branch.lever)}">
          <p class="mbb-index">${esc(branch.label)}</p>
          <strong>${esc(branch.title)}</strong>
          <ul>${branch.children.map((child) => `<li>${esc(child)}</li>`).join("")}</ul>
          <p class="mbb-lever"><b>메모리 레버</b><span>${esc(branch.lever)}</span></p>
        </article>`).join("")}
    </div>
    <ol class="mbb-answers">${frame.answers.map((answer) => `<li>${esc(answer)}</li>`).join("")}</ol>
  </div>`;

const cascade = (frame) => `
  <ol class="mbb-cascade">
    ${frame.steps.map((step, i) => `
      <li class="mbb-step${i === frame.steps.length - 1 ? " is-decision" : ""}" data-accent="${accentAt(i)}">
        <p class="mbb-index">${esc(step.label)}</p>
        <strong>${esc(step.text)}</strong>
      </li>`).join("")}
  </ol>`;

// Named accounts read as one row each: what they said, what it changes, what we
// sell against it. Keeping the four columns on one line is the whole point —
// a pain without an offer beside it is an observation, not a play.
const accountPlayBoard = (frame) => `
  <div class="mbb-plays" role="table" aria-label="${esc(frame.kicker)}">
    <div class="mbb-play-head" role="row">${frame.columns.map((c) => `<span role="columnheader">${esc(c)}</span>`).join("")}</div>
    ${frame.rows.map((row) => `
      <div class="mbb-play" role="row" data-accent="${esc(row.accent)}">
        <div role="cell" class="mbb-play-account" data-label="${esc(frame.columns[0])}">
          <strong>${esc(row.account)}</strong>
          <span class="mbb-index">${esc(row.role)}</span>
        </div>
        <p role="cell" class="mbb-play-fact" data-label="${esc(frame.columns[1])}">${esc(row.fact)}${sourceLink(row.source)}</p>
        <p role="cell" data-label="${esc(frame.columns[2])}">${esc(row.shift)}</p>
        <p role="cell" class="mbb-play-offer" data-label="${esc(frame.columns[3])}">${esc(row.offer)}</p>
        <p role="cell" class="mbb-play-metric" data-label="${esc(frame.columns[4])}">${esc(row.metric)}</p>
      </div>`).join("")}
  </div>`;

const workedExample = (frame) => `
  <ol class="mbb-walk">
    ${frame.steps.map((step, i) => `
      <li class="mbb-walk-step" data-accent="${accentAt(i)}">
        <p class="mbb-index">${esc(step.index)} · ${esc(step.label)}</p>
        <strong>${esc(step.title)}</strong>
        <p class="mbb-walk-detail">${esc(step.detail)}</p>
        <p class="mbb-walk-output"><b>OUTPUT</b><span>${esc(step.output)}</span></p>
      </li>`).join("")}
  </ol>`;

const caseBoard = (frame) => `
  <div class="mbb-cases">
    ${frame.cases.map((item) => `
      <article class="mbb-case" data-accent="${esc(item.accent)}">
        <header>
          <p class="mbb-index">${esc(item.stage)}</p>
          <strong>${esc(item.partner)}</strong>
        </header>
        <dl>
          <div><dt>고객 Pain</dt><dd>${esc(item.pain)}</dd></div>
          <div><dt>한 일</dt><dd>${esc(item.did)}</dd></div>
          <div><dt>결과</dt><dd class="mbb-case-outcome">${esc(item.outcome)}</dd></div>
          <div><dt>다음 확장</dt><dd>${esc(item.next)}</dd></div>
        </dl>
        ${sourceLink(item.source)}
      </article>`).join("")}
  </div>`;

const connectPlay = (frame) => `
  <div class="mbb-connect">
    <ol class="mbb-connect-chain">
      ${frame.steps.map((step, i) => `
        <li class="mbb-connect-step${i === frame.steps.length - 1 ? " is-action" : ""}" data-accent="${accentAt(i)}">
          <p class="mbb-index">${esc(step.label)}</p>
          <strong>${esc(step.text)}</strong>
        </li>`).join("")}
    </ol>
    <div class="mbb-parallels">
      ${frame.parallels.map((row, i) => `
        <article class="mbb-parallel" data-accent="${accentAt(i)}">
          <p class="mbb-index">${esc(row.tech)}</p>
          <p class="mbb-parallel-chain">${esc(row.chain)}</p>
          <p class="mbb-parallel-memory"><b>MEMORY</b><span>${esc(row.memory)}</span></p>
        </article>`).join("")}
    </div>
  </div>`;

// Spending is only useful next to what the company said about it and what it
// implies for memory, so the three are rendered as one row per company.
const capitalBoard = (frame) => {
  const plans = frame.__plans || {};
  const groups = (frame.groups || [])
    .map((group) => ({
      ...group,
      rows: (group.companies || [])
        .map((id) => ({ id, ...(plans[id] || {}) }))
        .filter((row) => row.capex || row.plan || row.comment),
    }))
    .filter((group) => group.rows.length);
  if (!groups.length) return "";
  return `
    <div class="mbb-capital">
      ${groups.map((group) => `
        <section class="mbb-group" data-accent="${esc(group.accent)}">
          <p class="mbb-group-label">${esc(group.label)}</p>
          <div class="mbb-capital-rows">
            ${group.rows.map((row) => `
              <article class="mbb-capital-row" data-accent="${esc(group.accent)}">
                <div class="mbb-capital-head">
                  <strong>${esc(row.name || frame.names?.[row.id] || row.id)}</strong>
                  ${row.tier ? `<span class="mbb-tier-chip">${esc(row.tier)}</span>` : ""}
                </div>
                ${row.capex ? `<p class="mbb-capex">${esc(consultingBullet(row.capex))}</p>` : ""}
                <dl>
                  ${row.plan ? `<div><dt>투자 계획</dt><dd>${esc(consultingBullet(row.plan))}</dd></div>` : ""}
                  ${row.comment ? `<div><dt>경영진 코멘트</dt><dd>${esc(consultingBullet(row.comment))}</dd></div>` : ""}
                  ${row.memoryRead ? `<div><dt>메모리 해석</dt><dd>${esc(consultingBullet(row.memoryRead))}</dd></div>` : ""}
                </dl>
              </article>`).join("")}
          </div>
        </section>`).join("")}
    </div>`;
};

const metricLadder = (frame) => `
  <ol class="mbb-ladder">
    ${frame.tiers.map((tier) => `
      <li class="mbb-tier" data-accent="${esc(tier.accent)}">
        <p class="mbb-index">${esc(tier.label)}</p>
        <ul class="mbb-metrics">${tier.metrics.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>
        <p class="mbb-question">${esc(tier.question)}</p>
      </li>`).join("")}
  </ol>`;

const SHAPES = {
  "mandate-fanout": mandateFanout,
  "thesis-criteria": thesisCriteria,
  "constraint-ledger": constraintLedger,
  "program-matrix": programMatrix,
  "chevron-rail": chevronRail,
  "quad-schema": quadSchema,
  "axis-schema": axisSchema,
  "issue-tree": issueTree,
  cascade,
  "metric-ladder": metricLadder,
  "capital-board": capitalBoard,
  matrix,
  "record-cards": recordCards,
  "account-play-board": accountPlayBoard,
  "worked-example": workedExample,
  "case-board": caseBoard,
  "connect-play": connectPlay,
};

function renderFrame(frame) {
  const shape = SHAPES[frame.type];
  if (!shape) return "";
  let body = "";
  try {
    body = shape(frame);
  } catch {
    return "";
  }
  if (!body.trim()) return "";
  return `
    <section class="mbb-frame" data-frame="${esc(frame.id)}" data-shape="${esc(frame.type)}">
      ${heading(frame)}
      ${body}
      ${frame.source ? `<p class="mbb-frame-source">${sourceLink(frame.source)}</p>` : ""}
      ${rule(frame)}
    </section>`;
}

function normalizeFrameCopy(container) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const normalized = consultingBullet(node.nodeValue || "");
    if (normalized) node.nodeValue = normalized;
  }
}

function enrichWithSiteContent(siteContent = {}) {
  const portfolio = siteContent.strategyBoard?.customerPortfolio;
  if (!portfolio) return;
  const accountById = new Map((portfolio.accounts || portfolio.focusAccounts || []).map((account) => [account.id, account]));
  const groupById = new Map((portfolio.groups || []).map((group) => [group.id, group]));
  const accentByGroup = {
    gpu: "blue",
    "hyperscaler-asic": "teal",
    "design-ecosystem": "violet",
    "server-oem": "gold",
    "edge-physical": "coral",
  };
  const accountIds = ["meta", "openai", "anthropic", "microsoft", "google", "aws", "dell"];
  const accountFrame = model.frames.find((frame) => frame.id === "account-plays");
  if (accountFrame) {
    accountFrame.lede = "공식 플랫폼 → 공개 Pain → Memory 제안 → 검증 Gate · 매 수집 자동 갱신";
    accountFrame.columns = ["고객", "공식 관측", "공개 Pain", "Memory 제안", "검증 Gate"];
    accountFrame.rows = accountIds.map((id) => accountById.get(id)).filter(Boolean).map((account) => ({
      account: account.company,
      role: `${groupById.get(account.group)?.label || account.demandClass || "ACCOUNT"} · ${account.chipStage || "MONITOR"}`,
      accent: accentByGroup[account.group] || "blue",
      fact: `${account.chip || "Platform 확인"} · ${account.evidence?.label || "SOURCE MONITOR"}`,
      shift: account.pain || "공개 병목 확인 필요",
      offer: account.memory || "Memory Requirement Lock 우선",
      metric: account.gate || "Qualification · Economics",
      source: account.evidence,
    }));
    accountFrame.rule = {
      chip: "FAIL CLOSED",
      text: "공식 원문 없는 공급 관계·물량·절감률 미표시",
    };
  }

  const oem = portfolio.oemChannel;
  if (!oem?.primaryAccount || !Array.isArray(oem.groups)) return;
  if (!model.frames.some((frame) => frame.id === "oem-channel-programs")) {
    const oemFrame = {
      id: "oem-channel-programs",
      mount: "executive",
      anchor: "#keyAccounts",
      position: "after",
      type: "record-cards",
      kicker: "SERVER OEM · RACK CHANNEL",
      title: "Dell에서 OEM·ODM으로<br />확장되는 계정 Program",
      lede: oem.lede,
      labels: ["공식 관측", "System Pain", "Memory Move", "검증 Gate"],
      cards: oem.groups.map((group, index) => ({
        index: group.index,
        title: `${group.title} · ${(group.companies || []).join(" · ")}`,
        accent: ["gold", "blue", "violet"][index] || "teal",
        entries: [group.observation, group.constraint, group.memoryMove, group.gate],
        source: group.source,
      })),
      source: oem.primaryAccount.source,
      rule: {
        chip: "AUTOMATION",
        text: "Rack Roadmap 변화 감지 → 계정 Pain·Memory Stack·Qualification Gate 동시 갱신",
      },
    };
    const anchorIndex = model.frames.findIndex((frame) => frame.id === "account-plays");
    model.frames.splice(anchorIndex >= 0 ? anchorIndex + 1 : 0, 0, oemFrame);
  }

  const worked = model.frames.find((frame) => frame.id === "worked-example");
  if (worked) {
    const account = oem.primaryAccount;
    worked.kicker = "WORKED EXAMPLE · DELL ACCOUNT";
    worked.title = "Dell AI Factory · 계정 실행 6단계";
    worked.lede = "공식 Rack 신호 → 구성 분해 → System Pain → Memory Stack → Qualification → 채널 확장";
    worked.source = account.source;
    worked.steps = [
      { index: "01", label: "관측", title: "공식 Rack Roadmap 수집", detail: `${account.platform} · ${account.stage}`, output: "계정 Fact Pack" },
      { index: "02", label: "분해", title: "Rack Configuration 분해", detail: "GPU·CPU·HBM·Host DRAM·Storage·Network·Power·Cooling", output: "System BOM Map" },
      { index: "03", label: "Pain", title: "System 병목 확정", detail: account.pain, output: "Pain Ledger" },
      { index: "04", label: "제안", title: "Memory Stack 설계", detail: account.memory, output: "Reference Stack" },
      { index: "05", label: "검증", title: "Qualification Gate", detail: account.gate, output: "90일 Gate" },
      { index: "06", label: "확장", title: "OEM·ODM 채널 재사용", detail: "Dell → HPE·Lenovo·Supermicro → Foxconn·QCT·Wiwynn", output: "인증 재사용 경로" },
    ];
    worked.rule = {
      chip: "DECISION",
      text: "제품 판매량 아닌 Reference 인증 재사용률·Attach·Committed Volume로 우선순위 판단",
    };
  }

  const cases = model.frames.find((frame) => frame.id === "case-board")?.cases || [];
  const channelCase = cases.find((item) => /HPE|Foxconn|QCT|Wiwynn/i.test(item.partner || ""));
  if (channelCase) {
    const ecosystem = oem.groups.find((group) => group.id === "brand-oem");
    channelCase.stage = "검증 대상";
    channelCase.partner = "Dell · HPE · Lenovo · Supermicro · Foxconn · QCT · Wiwynn";
    channelCase.pain = "Rack별 전력·냉각·통합 인증 반복 → 확산 Lead Time 증가";
    channelCase.did = "NVIDIA 공식 OEM·ODM 생태계를 공통 Reference 후보군으로 분류";
    channelCase.outcome = "HBM·Server DRAM·eSSD 인증 자산 재사용 가능성 검증";
    channelCase.next = "Dell Qualification 결과 → 인접 OEM·ODM의 Attach·Volume Gate로 전환";
    channelCase.source = ecosystem?.source;
  }
}

/* ---------------------------------------------------------------- mounting */

// Several exhibits can hang off the same section, so each new host goes after
// the last one already placed there rather than in front of it.
const lastHostByAnchor = new Map();

// The brief has been through several shells; take whichever root this page ships.
const briefRoot = () => document.querySelector("#businessMain")
  || document.querySelector("#businessSite")
  || document.querySelector("#executiveView");

function containerFor(frame) {
  if (frame.mount === "executive") {
    const view = briefRoot();
    if (!view) return null;
    const anchor = frame.anchor ? view.querySelector(frame.anchor) : null;
    if (frame.anchor && !anchor) return null;
    let host = view.querySelector(`[data-mbb-host="${frame.id}"]`);
    if (!host) {
      host = document.createElement("section");
      host.className = "mbb-section";
      if (frame.tone) host.classList.add(frame.tone);
      host.dataset.mbbHost = frame.id;
      const shell = document.createElement("div");
      shell.className = "mbb-shell";
      host.appendChild(shell);
      const previous = frame.anchor ? lastHostByAnchor.get(frame.anchor) : null;
      const after = previous && previous.isConnected ? previous : anchor;
      if (after && frame.position === "after") after.after(host);
      else if (anchor) anchor.before(host);
      else view.appendChild(host);
      if (frame.anchor) lastHostByAnchor.set(frame.anchor, host);
    }
    return host.querySelector(".mbb-shell");
  }

  const panelId = frame.mount.startsWith("console:") ? frame.mount.slice("console:".length) : null;
  if (!panelId) return null;
  const panel = document.querySelector(`[data-console-panel="${panelId}"]`);
  if (!panel) return null;
  let host = panel.querySelector(`[data-mbb-host="${frame.id}"]`);
  if (!host) {
    host = document.createElement("div");
    host.className = "mbb-panel-host";
    host.dataset.mbbHost = frame.id;
    panel.appendChild(host);
  }
  return host;
}

let model = null;

function paint() {
  if (!model) return;
  for (const frame of model.frames || []) {
    const container = containerFor(frame);
    if (!container) continue;
    // Re-render only when the host is empty: the console rewrites its own
    // panels, which wipes the children we appended.
    if (container.childElementCount > 0 && container.querySelector(".mbb-frame")) continue;
    const html = renderFrame(frame);
    if (!html.trim()) continue;
    container.insertAdjacentHTML("beforeend", html);
    normalizeFrameCopy(container.lastElementChild || container);
  }
}

function observe() {
  const roots = [briefRoot(), document.querySelector("#intelligenceConsole"), document.querySelector("#consoleView")].filter(Boolean);
  if (!roots.length) return;
  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      paint();
    });
  });
  for (const root of roots) observer.observe(root, { childList: true, subtree: true });
}

async function boot() {
  try {
    const response = await fetch(dataUrl.href, { cache: "force-cache" });
    if (!response.ok) return;
    model = await response.json();
  } catch {
    return;
  }
  if (!model?.frames?.length) return;
  try {
    const contentResponse = await fetch(siteContentUrl.href, { cache: "force-cache" });
    if (contentResponse.ok) enrichWithSiteContent(await contentResponse.json());
  } catch {
    // Static frames remain available when the content artifact is unavailable.
  }
  // Capital plans live in their own file so the crawl can keep writing observed
  // spending into it without touching the frame definitions.
  try {
    const capitalResponse = await fetch(capitalUrl.href, { cache: "force-cache" });
    if (capitalResponse.ok) {
      const plans = (await capitalResponse.json())?.plans || {};
      for (const frame of model.frames) if (frame.type === "capital-board") frame.__plans = plans;
    }
  } catch {
    // A frame with no plans renders nothing rather than an empty shell.
  }
  ensureStyle();
  paint();
  observe();
}

const idle = window.requestIdleCallback
  ? (fn) => window.requestIdleCallback(fn, { timeout: 1200 })
  : (fn) => window.setTimeout(fn, 1);

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => idle(boot), { once: true });
else idle(boot);
