import { consultingBullet, formatPublicDate, sourceLabel } from "./public-copy-policy.js";
import { computeMemoryEconomics, economicsDecision } from "./memory-economics.js";

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
const demandUrl = new URL(`../../data/memory-demand.json?v=${encodeURIComponent(revision)}`, base);
const signalsUrl = new URL(`../../data/company-signals.json?v=${encodeURIComponent(revision)}`, base);
const siteContentUrl = new URL(`../../data/site-content-client.json?v=${encodeURIComponent(revision)}`, base);
const styleUrl = new URL(`../css/mbb-frames.min.css?v=${encodeURIComponent(revision)}`, base);

function ensureStyle() {
  if (document.querySelector("link[data-mbb-frames]")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = styleUrl.href;
  link.dataset.mbbFrames = "1";
  const brandStyles = document.querySelector('link[href*="brand-system.min.css"]');
  document.head.insertBefore(link, brandStyles || null);
}

const esc = (v) => String(v ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

const comparableCopy = (value = "") => String(value || "")
  .normalize("NFKC")
  .toLocaleLowerCase("ko-KR")
  .replace(/[\s·•:：/|>→—–_.\-]+/g, "")
  .trim();

const joinDistinctCopy = (values = []) => {
  const seen = new Set();
  return values.map((value) => String(value || "").trim()).filter((value) => {
    const key = comparableCopy(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).join(" · ");
};

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

const linkedRecordTitle = (card = {}) => {
  const href = safeHref(card.source?.url || card.source?.sourceUrl);
  const title = esc(card.title);
  if (!href) return `<strong>${title}</strong>`;
  const rawDate = card.source?.asOf || card.source?.date || card.source?.publishedAt || "";
  const date = formatPublicDate(rawDate);
  return `<strong><a class="mbb-record-title-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${title}</a>${date ? `<time datetime="${esc(rawDate)}">${esc(date)}</time>` : ""}</strong>`;
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

// The thesis card is short and the criteria list beside it is tall, so the
// left column ended below the fold in dead space. It carries a slide panel
// now — one frame per criterion, so the copy is the criterion's own
// authored line rather than new claims written for a picture. The images are
// decorative (alt=""): the text is the content, and a scrim keeps it legible
// whichever frame is showing.
const thesisSlides = (frame) => {
  const images = frame.thesis?.slideImages || [];
  const criteria = frame.criteria || [];
  if (images.length < 2 || criteria.length < 2) return "";
  const slides = criteria.map((criterion, index) => ({
    image: images[index % images.length],
    kicker: `${criterion.index} · ${criterion.label}`,
    title: criterion.title,
    note: criterion.landing,
  }));
  return `
    <figure class="mbb-thesis-slides" data-mbb-slides aria-roledescription="carousel" aria-label="기술 → 메모리 수요 번역 경로">
      <div class="mbb-slide-stage">
        ${slides.map((slide, index) => `<img class="mbb-slide-image" data-slide="${index}" src="${esc(slide.image)}" alt="" width="1920" height="1072" loading="lazy" decoding="async" />`).join("")}
      </div>
      <figcaption class="mbb-slide-copy" aria-live="polite">
        ${slides.map((slide, index) => `
          <span class="mbb-slide-panel" data-slide="${index}">
            <b>${esc(slide.kicker)}</b>
            <strong>${esc(slide.title)}</strong>
            <em>${esc(slide.note)}</em>
          </span>`).join("")}
      </figcaption>
      <div class="mbb-slide-dots" role="tablist" aria-label="슬라이드 선택">
        ${slides.map((slide, index) => `<button type="button" role="tab" data-slide="${index}" aria-selected="${index === 0}" aria-label="${esc(slide.kicker)}"></button>`).join("")}
      </div>
    </figure>`;
};

const thesisCriteria = (frame) => `
  <div class="mbb-thesis-layout">
    <div class="mbb-thesis-col">
    <article class="mbb-thesis">
      <p class="mbb-kicker">${esc(frame.thesis.kicker)}</p>
      <strong>${esc(frame.thesis.title)}</strong>
      <p>${esc(frame.thesis.note)}</p>
    </article>
    ${thesisSlides(frame)}
    </div>
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
          ${linkedRecordTitle(card)}
        </header>
        <dl>
          ${card.entries.map((entry, i) => `<div><dt>${esc(frame.labels[i] || "")}</dt><dd${i === card.entries.length - 1 ? ' class="mbb-record-gate"' : ""}>${esc(entry)}</dd></div>`).join("")}
        </dl>
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

const workedExampleSteps = (steps = []) => `
  <ol class="mbb-walk">
    ${steps.map((step, i) => `
      <li class="mbb-walk-step" data-accent="${accentAt(i)}">
        <p class="mbb-index">${esc(step.index)} · ${esc(step.label)}</p>
        <strong>${esc(step.title)}</strong>
        <p class="mbb-walk-detail">${esc(step.detail)}</p>
        <p class="mbb-walk-output"><b>OUTPUT</b><span>${esc(step.output)}</span></p>
      </li>`).join("")}
  </ol>`;

const workedExample = (frame) => {
  const cases = Array.isArray(frame.cases) ? frame.cases : [];
  if (!cases.length) return workedExampleSteps(frame.steps || []);
  return `
    <div class="mbb-oem-selector" role="tablist" aria-label="Tier 1 Strategic OEM 계정 선택">
      ${cases.map((item, index) => `
        <button type="button" role="tab" data-mbb-oem-tab="${esc(item.id)}" data-accent="${accentAt(index)}" aria-selected="${index === 0 ? "true" : "false"}" aria-controls="mbb-oem-${esc(item.id)}">
          <span>${esc(item.index)} · TIER 1</span>
          <strong>${esc(item.company)}</strong>
          <small>${esc(item.platform)}</small>
        </button>`).join("")}
    </div>
    ${cases.map((item, index) => `
      <section class="mbb-oem-case" id="mbb-oem-${esc(item.id)}" role="tabpanel" data-mbb-oem-panel="${esc(item.id)}"${index === 0 ? "" : " hidden"}>
        <header class="mbb-oem-case-head">
          <div><p class="mbb-index">${esc(item.company)} · ACCOUNT PLAY</p><strong>${esc(item.platform)}</strong></div>
          <p>${esc(item.insight || "공식 Roadmap → System Pain → Memory Stack → Qualification Gate")}</p>
        </header>
        ${workedExampleSteps(item.steps)}
        ${item.source ? `<p class="mbb-oem-source">${sourceLink(item.source)}</p>` : ""}
      </section>`).join("")}`;
};

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
                  ${row.tier && row.tier !== "보도" ? `<span class="mbb-tier-chip">${esc(row.tier)}</span>` : ""}
                </div>
                ${row.capex ? `<p class="mbb-capex">${esc(consultingBullet(row.capex))}</p>` : ""}
                <dl>
                  ${(row.plan || row.outlook?.buys) ? `<div><dt><span class="mbb-capital-index">1</span><span>투자 계획</span></dt><dd>${esc(consultingBullet([row.plan, row.outlook?.buys, row.outlook?.converts].filter(Boolean).join(" · ")))}</dd></div>` : ""}
                  ${row.comment ? `<div><dt><span class="mbb-capital-index">2</span><span>경영진 Comment</span></dt><dd>${esc(consultingBullet(row.comment))}</dd></div>` : ""}
                  ${row.memoryRead ? `<div><dt><span class="mbb-capital-index">3</span><span>메모리 해석</span></dt><dd>${esc(consultingBullet(row.memoryRead))}</dd></div>` : ""}
                </dl>
                ${row.outlook?.window ? `<div class="mbb-capital-insight"><b>Insight</b><span>${esc(consultingBullet(row.outlook.window))}</span></div>` : ""}
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

// The board names $/token, Performance/W, Bandwidth/$ and TAM/SAM/SOM; this is
// where a baseline turns them into numbers. Every result shows its formula, and
// a metric whose inputs are missing is omitted rather than guessed.

const economicsCalculator = (frame) => `
  <form class="mbb-calc mbb-calc--ios" data-mbb-calc="${esc(frame.id)}" novalidate>
    <div class="mbb-calc-body">
      <div class="mbb-calc-pane">
        <div class="mbb-calc-screen">
          <p class="mbb-calc-screen-label">MEMORY ECONOMICS</p>
          <p class="mbb-calc-readout"><b data-calc-active-label>일일 Query</b><span data-calc-active-value>0</span><em data-calc-active-unit></em></p>
        </div>
        ${(frame.presets || []).length ? `<div class="mbb-calc-presets" role="group" aria-label="확인된 계정 사례">
          <span class="mbb-calc-presets-label">계정 사례</span>
          ${frame.presets.map((preset) => `<button type="button" data-calc-preset="${esc(JSON.stringify(preset.values || {}))}" title="${esc(preset.note || "")}" aria-pressed="false">${esc(preset.label)}</button>`).join("")}
        </div>` : ""}
        ${(frame.scenarios || []).length ? `<div class="mbb-calc-scenarios" role="group" aria-label="시나리오">
          <span class="mbb-calc-presets-label">시나리오</span>
          ${frame.scenarios.map((scenario, index) => `<button type="button" data-calc-scenario="${esc(JSON.stringify({ factors: scenario.factors || {}, overrides: scenario.overrides || {} }))}" title="${esc(scenario.note || "")}" aria-pressed="${index === 0}">${esc(scenario.label)}</button>`).join("")}
        </div>` : ""}
        ${(frame.products || []).length ? `<div class="mbb-calc-mix" role="group" aria-label="SK 제품군 조합">
          <span class="mbb-calc-presets-label">제품군 조합 · 절감률 시나리오</span>
          <span class="mbb-calc-multi-hint">복수 선택 · 누적 합산</span>
          ${frame.products.map((product) => `<button type="button" data-calc-product="${esc(JSON.stringify({ tiering: product.tieringPoints || 0, power: product.powerPoints || 0, margin: product.marginPoints || 0 }))}" title="${esc(product.basis || '')}" aria-pressed="false">${esc(product.label)}</button>`).join("")}
        </div>` : ""}
      </div>
      <div class="mbb-calc-tape">
        <div class="mbb-calc-fields">
          ${frame.inputs.map((field) => `
            <label class="mbb-calc-field" data-calc-row="${esc(field.name)}" title="${esc(field.hint || field.label)}">
              <span>${esc(field.label)}</span>
              <span class="mbb-calc-stepper">
                <button type="button" data-calc-step="-1" tabindex="-1" aria-label="${esc(field.label)} 감소">−</button>
                <input type="number" name="${esc(field.name)}" data-calc-store="${esc(field.name)}" inputmode="decimal" step="${esc(field.step || "any")}" min="${esc(field.min ?? "0")}" placeholder="${esc(field.placeholder || "")}" />
                <button type="button" data-calc-step="1" tabindex="-1" aria-label="${esc(field.label)} 증가">+</button>
              </span>
              ${field.unit ? `<em>${esc(field.unit)}</em>` : ""}
            </label>`).join("")}
        </div>
        <output class="mbb-calc-out" data-mbb-calc-out="${esc(frame.id)}" aria-live="polite"></output>
      </div>
    </div>
    <p class="mbb-calc-note">${esc(frame.note || "")}</p>
  </form>`;

const DECISION_BADGE = { approve: "승인 가능", redesign: "재설계", pending: "입력 필요" };
const decisionBadge = (state) => DECISION_BADGE[state] || DECISION_BADGE.pending;

function renderEconomics(result, decision) {
  if (!result.groups.length) {
    return `<p class="mbb-calc-empty">${result.missing.length ? `${esc(result.missing.join(" · "))}을 입력하면 계산` : "계정 사례를 선택하거나 값을 입력하면 계산"}</p>`;
  }
  // The decision is what a CFO reads first, so it leads the results as a card
  // with its own state colour rather than a grey strip under the inputs.
  const verdictRow = decision
    ? `<div class="mbb-calc-verdict" data-state="${esc(decision.state)}" role="status" aria-live="polite">
        <p class="mbb-calc-verdict-decision"><b>${esc(decisionBadge(decision.state))}</b><span>${esc(decision.decision)}</span></p>
        <ul class="mbb-calc-verdict-metrics">
          ${decision.metrics.map((metric) => `<li><span>${esc(metric.label)}</span><b>${esc(metric.value)}</b><em>${esc(metric.unit)}</em></li>`).join("")}
        </ul>
        <p class="mbb-calc-verdict-scope">이 판정은 선택한 제품 조합이 <b>기준선에 더하는 증분</b>만 평가합니다. HBM 매출은 rack·GB·ASP로 기준선에 이미 포함되어 조합과 무관하게 동일합니다.</p>
      </div>`
    : "";
  return `${verdictRow}
    <div class="mbb-calc-groups">
      ${result.groups.map((group, i) => `
        <section class="mbb-calc-group" data-accent="${accentAt(i)}">
          <p class="mbb-index">${esc(group.label)}</p>
          <dl>
            ${group.rows.map((row) => `
              <div>
                <dt>${esc(row.label)}</dt>
                <dd><b>${esc(String(row.value))}</b><span>${esc(row.unit)}</span></dd>
                <p class="mbb-calc-formula">${esc(row.formula)}</p>
                ${row.note ? `<p class="mbb-calc-hint">${esc(row.note)}</p>` : ""}
              </div>`).join("")}
          </dl>
        </section>`).join("")}
    </div>`;
}

// Bind after paint so a re-render of the host rewires its own form.

// Account names behind a count. One popover is reused, so opening a second
// list closes the first and nothing accumulates in the DOM.
function bindAccountCounts(root = document) {
  const NAMES = { amd: "AMD", aws: "AWS", anthropic: "Anthropic", apple: "Apple", broadcom: "Broadcom", coreweave: "CoreWeave", cxmt: "CXMT", dell: "Dell", google: "Google", hpe: "HPE", lenovo: "Lenovo", marvell: "Marvell", meta: "Meta", micron: "Micron", microsoft: "Microsoft", nvidia: "NVIDIA", openai: "OpenAI", oracle: "Oracle", samsung: "Samsung", skhynix: "SK hynix", spacexai: "SpaceX · xAI", supermicro: "Supermicro", tesla: "Tesla", tsmc: "TSMC" };
  let popover = document.querySelector(".mbb-account-popover");
  if (!popover) {
    popover = document.createElement("div");
    popover.className = "mbb-account-popover";
    popover.setAttribute("role", "dialog");
    popover.hidden = true;
    document.body.appendChild(popover);
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".mbb-account-popover") && !event.target.closest("[data-mbb-accounts]")) popover.hidden = true;
    });
    window.addEventListener("resize", () => { popover.hidden = true; });
  }
  for (const button of root.querySelectorAll("[data-mbb-accounts]:not([data-mbb-bound])")) {
    button.dataset.mbbBound = "1";
    button.addEventListener("click", () => {
      const ids = String(button.dataset.mbbAccounts || "").split(",").filter(Boolean);
      popover.innerHTML = `
        <p class="mbb-account-popover-head">${esc(button.dataset.mbbNeed || "")}</p>
        <ul>${ids.map((id) => `<li><b>${esc(NAMES[id] || id)}</b></li>`).join("")}</ul>
        <p class="mbb-account-popover-foot">공식 근거로 이 요구에 연결된 계정</p>`;
      popover.hidden = false;
      const rect = button.getBoundingClientRect();
      const width = popover.offsetWidth;
      popover.style.top = `${Math.round(rect.bottom + window.scrollY + 8)}px`;
      popover.style.left = `${Math.round(Math.min(Math.max(12, rect.left + window.scrollX - width / 2 + rect.width / 2), window.scrollX + document.documentElement.clientWidth - width - 12))}px`;
    });
  }
}
function bindCalculators(root = document) {
  for (const form of root.querySelectorAll("[data-mbb-calc]:not([data-mbb-bound])")) {
    form.dataset.mbbBound = "1";
    const out = root.querySelector(`[data-mbb-calc-out="${form.dataset.mbbCalc}"]`)
      || form.parentElement?.querySelector("[data-mbb-calc-out]");
    if (!out) continue;

    const field = (name) => form.querySelector(`[data-calc-store="${name}"]`);
    const readout = {
      label: form.querySelector("[data-calc-active-label]"),
      value: form.querySelector("[data-calc-active-value]"),
      unit: form.querySelector("[data-calc-active-unit]"),
    };
    const rowOf = (input) => input?.closest("[data-calc-row]");
    const paintReadout = (input) => {
      const row = rowOf(input);
      if (!row || !readout.value) return;
      if (readout.label) readout.label.textContent = row.querySelector("span")?.textContent || "";
      if (readout.unit) readout.unit.textContent = row.querySelector("em")?.textContent || "";
      readout.value.textContent = input.value === "" ? (input.placeholder || "0") : input.value;
    };
    const update = () => {
      const entered = Object.fromEntries([...new FormData(form).entries()]);
      const { factors, overrides } = scenarioTerms();
      const input = {};
      for (const [name, value] of Object.entries(entered)) {
        const factor = Number(factors[name]);
        const numeric = Number(value);
        const override = Number(overrides[name]);
        if (Number.isFinite(override)) { input[name] = String(override); continue; }
        input[name] = value !== "" && Number.isFinite(numeric) && Number.isFinite(factor) && factor !== 1
          ? String(Number((numeric * factor).toFixed(4)))
          : value;
      }
      const result = computeMemoryEconomics(input);
      out.innerHTML = renderEconomics(result, economicsDecision(result));
    };

    // Selecting a product mix fills the two saving rates from the scenario
    // points each product carries. The fields stay editable, so a measured
    // rate always overrides the assumption.
    const scenarioTerms = () => {
      const active = form.querySelector("[data-calc-scenario][aria-pressed='true']");
      try {
        const parsed = JSON.parse(active?.dataset.calcScenario || "{}");
        return { factors: parsed.factors || {}, overrides: parsed.overrides || {} };
      } catch { return { factors: {}, overrides: {} }; }
    };
    const applyScenario = () => update();

    const applyMix = () => {
      let tiering = 0;
      let power = 0;
      let margin = 0;
      for (const button of form.querySelectorAll("[data-calc-product][aria-pressed='true']")) {
        let points = null;
        try { points = JSON.parse(button.dataset.calcProduct); } catch { points = null; }
        if (!points) continue;
        tiering += Number(points.tiering) || 0;
        power += Number(points.power) || 0;
        margin += Number(points.margin) || 0;
      }
      const tieringField = field("tieringSavingPercent");
      const powerField = field("powerSavingPercent");
      if (tieringField) tieringField.value = tiering ? String(Math.min(tiering, 60)) : "";
      if (powerField) powerField.value = power ? String(Math.min(power, 40)) : "";
      const marginField = field("marginUpliftPoints");
      if (marginField) marginField.value = margin ? String(Math.min(margin, 20)) : "";
      update();
    };

    form.addEventListener("click", (event) => {
      const step = event.target.closest("[data-calc-step]");
      if (step) {
        const input = step.parentElement.querySelector("input");
        if (!input) return;
        const size = Number(input.step) > 0 ? Number(input.step) : 1;
        const current = Number(input.value === "" ? input.placeholder : input.value) || 0;
        const next = current + size * Number(step.dataset.calcStep);
        input.value = String(Math.max(Number(input.min) || 0, Number(next.toFixed(4))));
        paintReadout(input);
        update();
        return;
      }

      const scenario = event.target.closest("[data-calc-scenario]");
      if (scenario) {
        form.querySelectorAll("[data-calc-scenario]").forEach((button) => button.setAttribute("aria-pressed", String(button === scenario)));
        applyScenario();
        return;
      }

      const product = event.target.closest("[data-calc-product]");
      if (product) {
        product.setAttribute("aria-pressed", product.getAttribute("aria-pressed") === "true" ? "false" : "true");
        applyMix();
        return;
      }

      const preset = event.target.closest("[data-calc-preset]");
      if (!preset) return;
      let values = null;
      try { values = JSON.parse(preset.dataset.calcPreset); } catch { values = null; }
      if (!values) return;
      for (const [name, value] of Object.entries(values)) {
        const input = field(name);
        if (input) input.value = String(value);
      }
      form.querySelectorAll("[data-calc-preset]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button === preset));
      });

      applyScenario();
      const first = form.querySelector("[data-calc-store]");
      if (first) paintReadout(first);
      update();
    });

    form.addEventListener("input", (event) => {
      const input = event.target.closest("[data-calc-store]");
      if (input) paintReadout(input);
      update();
    });
    form.addEventListener("focusin", (event) => {
      const input = event.target.closest("[data-calc-store]");
      if (input) paintReadout(input);
    });
    form.addEventListener("submit", (event) => event.preventDefault());
    const first = form.querySelector("[data-calc-store]");
    if (first) paintReadout(first);
    update();
  }
}

function bindWorkedExamples(root = document) {
  for (const tablist of root.querySelectorAll(".mbb-oem-selector:not([data-mbb-bound])")) {
    tablist.dataset.mbbBound = "1";
    const frame = tablist.closest(".mbb-frame");
    const tabs = [...tablist.querySelectorAll("[data-mbb-oem-tab]")];
    const panels = [...(frame?.querySelectorAll("[data-mbb-oem-panel]") || [])];
    const select = (id) => {
      for (const tab of tabs) tab.setAttribute("aria-selected", String(tab.dataset.mbbOemTab === id));
      for (const panel of panels) panel.hidden = panel.dataset.mbbOemPanel !== id;
    };
    for (const tab of tabs) tab.addEventListener("click", () => select(tab.dataset.mbbOemTab));
  }
}

// Rendered from what the pipeline derived this crawl, so the board changes when
// the feed does rather than when someone edits a file.
const derivedDemandBoard = (frame) => {
  const rollup = frame.__rollup || [];
  if (!rollup.length) return "";
  const coverage = frame.__coverage || {};
  const summary = "";
  return `
    ${summary ? `<p class="mbb-note">${esc(summary)}</p>` : ""}
    <ol class="mbb-derived">
      ${rollup.map((row, i) => `
        <li class="mbb-derived-row" data-accent="${accentAt(i)}">
          <div class="mbb-derived-need">
            <p class="mbb-index">${esc(row.productAxis)} · ${esc(row.stage)}</p>
            <strong>${esc(row.memoryNeed)}</strong>
          </div>
          <div class="mbb-derived-tech">
            <p class="mbb-derived-label">관측된 기술</p>
            <p>${esc(row.technologies.join(" · "))}</p>
          </div>
          <div class="mbb-derived-reach">
            <p class="mbb-derived-label">계정 수</p>
            ${(row.accounts || []).length
              ? `<button type="button" class="mbb-derived-count" data-mbb-accounts="${esc((row.accounts || []).join(","))}" data-mbb-need="${esc(row.memoryNeed)}" aria-haspopup="dialog">${esc(String(row.accountCount))}</button>`
              : `<b>${esc(String(row.accountCount))}</b>`}
          </div>
          <div class="mbb-derived-gate">
            <p class="mbb-derived-label">Gate</p>
            <p>${esc(row.gate)}</p>
          </div>
        </li>`).join("")}
    </ol>`;
};

// Terms the feed keeps using that the site's own rule table does not contain.
// These are candidates for a human to judge, not findings, and the board says so
// — the value is that nobody had to think of them first.
const trendRadar = (frame) => {
  const rows = frame.__candidates || [];
  if (!rows.length) return "";
  return `
    <ol class="mbb-radar">
      ${rows.map((row, i) => `
        <li class="mbb-radar-item" data-accent="${accentAt(i)}">
          <div class="mbb-radar-head">
            <strong>${esc(row.term)}</strong>
            <span>${esc(row.seenCount >= 5 ? "지속 등장" : "반복 등장")}</span>
          </div>
          ${row.url
            ? `<a href="${esc(safeHref(row.url))}" target="_blank" rel="noopener noreferrer">${esc(row.headline)}</a>`
            : `<p>${esc(row.headline)}</p>`}
          <em>${esc(row.firstSeen && row.firstSeen !== row.lastSeen ? `${row.firstSeen} → ${row.lastSeen}` : row.lastSeen || "")}</em>
        </li>`).join("")}
    </ol>`;
};

const SHAPES = {
  "trend-radar": trendRadar,
  "derived-demand": derivedDemandBoard,
  "economics-calculator": economicsCalculator,
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

// Advances the thesis panel. It rests when the panel is off screen, when the
// pointer is on it, when something inside it has focus, and when the tab is
// hidden — a background image loop is the last thing that should keep a
// laptop awake behind another window.
const SLIDE_INTERVAL = 6200;

function bindThesisSlides(root) {
  for (const figure of root.querySelectorAll("[data-mbb-slides]:not([data-mbb-bound])")) {
    figure.dataset.mbbBound = "1";
    const images = [...figure.querySelectorAll(".mbb-slide-image")];
    const panels = [...figure.querySelectorAll(".mbb-slide-panel")];
    const dots = [...figure.querySelectorAll(".mbb-slide-dots button")];
    if (images.length < 2) continue;
    let index = 0;
    let timer = 0;
    let visible = false;
    let held = false;

    const show = (next) => {
      index = (next + images.length) % images.length;
      images.forEach((image, i) => image.classList.toggle("is-active", i === index));
      panels.forEach((panel, i) => panel.classList.toggle("is-active", i === index));
      dots.forEach((dot, i) => dot.setAttribute("aria-selected", String(i === index)));
    };

    const stop = () => { if (timer) { window.clearInterval(timer); timer = 0; } };
    const sync = () => {
      const shouldRun = visible && !held && document.visibilityState !== "hidden";
      if (shouldRun && !timer) timer = window.setInterval(() => show(index + 1), SLIDE_INTERVAL);
      else if (!shouldRun) stop();
    };

    figure.addEventListener("pointerenter", () => { held = true; sync(); });
    figure.addEventListener("pointerleave", () => { held = false; sync(); });
    figure.addEventListener("focusin", () => { held = true; sync(); });
    figure.addEventListener("focusout", () => { held = false; sync(); });
    document.addEventListener("visibilitychange", sync);
    dots.forEach((dot, i) => dot.addEventListener("click", () => { show(i); stop(); sync(); }));

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        visible = entries.some((entry) => entry.isIntersecting);
        sync();
      }, { rootMargin: "120px 0px", threshold: .1 });
      observer.observe(figure);
    } else {
      visible = true;
    }
    show(0);
    sync();
  }
}

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
    <section class="mbb-frame" data-frame="${esc(frame.id)}" data-shape="${esc(frame.type)}" data-copy-mode="telegraphic">
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
      title: "Dell에서 OEM·ODM으로 확장되는 계정 Program",
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
    const accounts = Array.isArray(oem.accounts) && oem.accounts.length ? oem.accounts : [oem.primaryAccount];
    worked.kicker = "WORKED EXAMPLE · TIER 1 STRATEGIC OEM";
    worked.title = "Server OEM · 계정별 실행 6단계";
    worked.lede = "공식 Rack 신호 → System Pain → Memory Stack → Qualification → 채널 확장";
    worked.note = "구성 분해 기준(전 계정 공통) · GPU·CPU·HBM·Host DRAM·Storage·Network·Power·Cooling";
    delete worked.source;
    worked.cases = accounts.map((account) => ({
      ...account,
      steps: [
        { index: "01", label: "관측", title: "공식 Rack Roadmap 수집", detail: joinDistinctCopy([account.platform, account.stage]), output: "계정 Fact Pack" },
        { index: "02", label: "Pain", title: "System 병목 확정", detail: account.pain, output: "Pain Ledger" },
        { index: "03", label: "제안", title: "Memory Stack 설계", detail: account.memory, output: "Reference Stack" },
        { index: "04", label: "검증", title: "Qualification Gate", detail: account.gate, output: "Execution Gate" },
        { index: "05", label: "확장", title: "Reference 인증 재사용", detail: account.insight || "OEM·ODM 채널의 Attach·Committed Volume로 확장", output: "인증 재사용 경로" },
      ],
    }));
    const shared = [];
    const stepCount = worked.cases[0]?.steps.length || 0;
    for (let index = stepCount - 1; index >= 0; index -= 1) {
      const detail = worked.cases[0]?.steps[index]?.detail;
      if (!detail) continue;
      if (!worked.cases.every((item) => item.steps[index]?.detail === detail)) continue;
      shared.unshift(`${worked.cases[0].steps[index].title} · ${detail}`);
      worked.cases.forEach((item) => item.steps.splice(index, 1));
    }
    worked.cases.forEach((item) => item.steps.forEach((step, index) => { step.index = String(index + 1).padStart(2, "0"); }));
    if (shared.length) worked.note = [worked.note, `전 계정 공통 · ${shared.join(" / ")}`].filter(Boolean).join(" · ");
    worked.steps = worked.cases[0]?.steps || worked.steps;
    worked.rule = {
      chip: "DECISION",
      text: "Reference 인증 재사용률·Attach·Committed Volume로 우선순위 판단",
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
      // Frame copy is authored dense and already normalized; the landing copy
      // rewriter must not re-compact it (it splits numbers like 1,750억 on the
      // comma and truncates data-heavy lines mid-sentence).
      shell.dataset.copyVerbatim = "1";
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
    bindCalculators(container);
  bindAccountCounts(container);
    bindWorkedExamples(container);
    bindThesisSlides(container);
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
  try {
    const demandResponse = await fetch(demandUrl.href, { cache: "force-cache" });
    if (demandResponse.ok) {
      const demand = await demandResponse.json();
      for (const frame of model.frames) {
        if (frame.type !== "derived-demand") continue;
        frame.__rollup = demand?.rollup || [];
        frame.__coverage = demand?.coverage || {};
      }
    }
  } catch {
    // A frame with no derivation renders nothing rather than an empty shell.
  }
  try {
    const signalsResponse = await fetch(signalsUrl.href, { cache: "force-cache" });
    if (signalsResponse.ok) {
      const signals = await signalsResponse.json();
      for (const frame of model.frames) {
        if (frame.type !== "trend-radar") continue;
        frame.__candidates = signals?.trendCandidates || [];
      }
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
