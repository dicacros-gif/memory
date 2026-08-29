/**
 * Strategy spine — renders the AI-industry-to-new-business causal chain as
 * consulting shapes. Self-mounting so it costs the console bundle nothing:
 * it finds its own mount, fetches its own model, and paints on idle.
 */
const script = document.currentScript;
const revision = new URL(script?.src || location.href).searchParams.get("v") || "current";
const base = script?.src || location.href;
const dataUrl = new URL(`../../data/strategy-spine.json?v=${encodeURIComponent(revision)}`, base);
const ledgerUrl = new URL(`../../data/insight-ledger.json?v=${encodeURIComponent(revision)}`, base);
const styleUrl = new URL(`../css/strategy-spine.min.css?v=${encodeURIComponent(revision)}`, base);

function ensureStyle() {
  if (document.querySelector('link[data-strategy-spine]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = styleUrl.href;
  link.dataset.strategySpine = "1";
  const brandStyles = document.querySelector('link[href*="brand-system.min.css"]');
  document.head.insertBefore(link, brandStyles || null);
}

const esc = (v) => String(v ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

const chevron = (items) => items.map((item, i) => `
  <li class="ss-chevron" style="--ss-accent:${esc(["#17A2A2","#7656C9","#C2417B","#C88600","#2D6BFF","#0E7777"][i % 6])}">
    <span class="ss-idx">${esc(item.index)}</span>
    <strong>${esc(item.label)}</strong>
    <em>${esc(item.question)}</em>
    <p>${esc(item.note)}</p>
  </li>`).join("");

const translationRow = (t) => `
  <article class="ss-translate" style="--ss-accent:${esc(t.accent)}">
    <header><span class="ss-idx">${esc(t.axis)}</span><strong>${esc(t.tech)}</strong></header>
    <ol class="ss-steps">${t.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
    <footer><b>MEMORY</b><span>${esc(t.memory)}</span></footer>
  </article>`;

const painCard = (p) => `
  <article class="ss-pain" data-layer="${esc(p.layer)}">
    <span class="ss-idx">${esc(p.axis)}</span>
    <strong>${esc(p.company)}</strong>
    <p class="ss-pain-body">${esc(p.pain)}</p>
    <p class="ss-hook"><b>MEMORY HOOK</b> ${esc(p.memoryHook)}</p>
  </article>`;

const techCard = (t) => `
  <article class="ss-tech" style="--ss-accent:${esc(t.accent)}">
    <span class="ss-idx">${esc(t.index)}</span>
    <strong>${esc(t.label)}</strong>
    <p class="ss-solves"><b>SOLVES</b> ${esc(t.solves)}</p>
    <p>${esc(t.note)}</p>
  </article>`;

const useCase = (u) => `
  <article class="ss-case">
    <span class="ss-idx">${esc(u.stage)}</span>
    <strong>${esc(u.partner)}</strong>
    <div class="ss-case-row"><b>PAIN</b><span>${esc(u.pain)}</span></div>
    <div class="ss-case-row"><b>SOLUTION</b><span>${esc(u.solution)}</span></div>
    <div class="ss-case-row"><b>OUTCOME</b><span>${esc(u.outcome)}</span></div>
  </article>`;

const ledgerEntry = (e) => `
  <li class="ss-led" data-kind="${esc(e.kind)}">
    <span class="ss-idx">${esc(e.kindLabel || e.kind)}</span>
    ${e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.headline)}</a>` : `<strong>${esc(e.headline)}</strong>`}
    ${e.detail ? `<p>${esc(e.detail)}</p>` : ""}
    <em>${esc(e.asOf || "")}${Number(e.seenCount) > 1 ? ` · ${e.seenCount}회 관측` : ""}</em>
  </li>`;

function renderLedger(ledger) {
  const entries = (ledger?.entries || []).slice(0, 24);
  if (!entries.length) return "";
  const kinds = (ledger.kinds || []).filter((k) => (ledger.byKind || {})[k.id]);
  return `
    <div class="ss-lead"><span>INSIGHT LEDGER</span><h4>검증 주기별 전략 인사이트</h4></div>
    ${kinds.length ? `<div class="ss-ledger-kinds">${kinds.map((k) => `<span>${esc(k.label)} ${esc(String(ledger.byKind[k.id]))}</span>`).join("")}</div>` : ""}
    <ul class="ss-ledger">${entries.map(ledgerEntry).join("")}</ul>`;
}

const numberedRow = (items, cls = "ss-step-chip") => items.map((it) => `
  <li class="${cls}"><span class="ss-idx">${esc(it.index)}</span><strong>${esc(it.label)}</strong>${it.question || it.note ? `<p>${esc(it.question || it.note)}</p>` : ""}</li>`).join("");

function renderNewBiz(nb) {
  if (!nb || !Array.isArray(nb.candidates)) return "";
  const horizons = [["H1", "핵심 확대"], ["H2", "인접 구축"], ["H3", "차세대 옵션"]];
  return `
    <div class="ss-lead"><span>NEW BUSINESS</span><h4>${esc(nb.question)}</h4></div>
    <ol class="ss-chain ss-chain-compact">${numberedRow(nb.stages || [])}</ol>
    ${horizons.map(([h, label]) => {
      const rows = nb.candidates.filter((c) => c.horizon === h);
      if (!rows.length) return "";
      return `<div class="ss-layer"><span class="ss-layer-label">${esc(h)} · ${esc(label)}</span>
        <div class="ss-grid ss-grid-3">${rows.map((c) => `
          <article class="ss-tech" style="--ss-accent:${h === "H1" ? "#17A2A2" : h === "H2" ? "#7656C9" : "#C88600"}">
            <span class="ss-idx">${esc(c.horizon)}</span><strong>${esc(c.label)}</strong>
            <p>${esc(c.thesis)}</p>
            <div class="ss-case-row"><b>GATE</b><span>${esc(c.gate)}</span></div>
          </article>`).join("")}</div></div>`;
    }).join("")}`;
}

function renderTco(t) {
  if (!t || !Array.isArray(t.items)) return "";
  return `
    <div class="ss-lead"><span>TCO DECOMPOSITION</span><h4>${esc(t.question)}</h4></div>
    <div class="ss-grid ss-grid-4">${t.items.map((i) => `
      <article class="ss-translate" style="--ss-accent:#C2417B">
        <header><strong>${esc(i.label)}</strong></header>
        <footer><b>MEMORY LEVER</b><span>${esc(i.memoryLever)}</span></footer>
      </article>`).join("")}</div>
    ${t.conclusion ? `<p class="ss-key"><b>SO WHAT</b>${esc(t.conclusion)}</p>` : ""}`;
}

function renderProcess(steps) {
  if (!Array.isArray(steps) || !steps.length) return "";
  return `
    <div class="ss-lead"><span>STRATEGY PROCESS</span><h4>시장에서 실행까지 연결하는 7단계</h4></div>
    <ol class="ss-chain ss-chain-compact">${numberedRow(steps)}</ol>`;
}

function renderHwSw(h) {
  if (!h || !Array.isArray(h.layers)) return "";
  return `
    <div class="ss-lead"><span>HW / SW OPTIMIZATION</span><h4>${esc(h.question)}</h4></div>
    <div class="ss-grid ss-grid-3">${h.layers.map((l) => `
      <article class="ss-tech" style="--ss-accent:#2D6BFF">
        <span class="ss-idx">${esc(l.layer)}</span>
        <strong>${esc((l.items || []).join(" · "))}</strong>
        <p>${esc(l.note)}</p>
      </article>`).join("")}</div>`;
}

function renderDeepDive(d) {
  if (!d || !Array.isArray(d.axes)) return "";
  return `
    <div class="ss-lead"><span>ACCOUNT DEEP DIVE</span><h4>${esc(d.question)}</h4></div>
    <div class="ss-trends">${d.axes.map((a) => `<span class="ss-axis">${esc(a)}</span>`).join("")}</div>
    ${d.output ? `<p class="ss-key"><b>OUTPUT</b>${esc(d.output)}</p>` : ""}`;
}

function renderConsulting(c) {
  if (!c || !Array.isArray(c.steps)) return "";
  return `
    <div class="ss-lead"><span>MEMORY CONSULTING</span><h4>${esc(c.question)}</h4></div>
    <ol class="ss-chain">${c.steps.map((st, i) => `
      <li class="ss-chevron" style="--ss-accent:${esc(["#17A2A2","#7656C9","#C2417B","#C88600","#2D6BFF","#0E7777","#B4530A"][i % 7])}">
        <span class="ss-idx">${esc(st.index)}</span><strong>${esc(st.label)}</strong>
        <p>${esc(st.detail)}</p><em>→ ${esc(st.output)}</em>
      </li>`).join("")}</ol>`;
}

function renderPartners(models) {
  if (!Array.isArray(models) || !models.length) return "";
  return `
    <div class="ss-lead"><span>PARTNER MODELS</span><h4>협력 3주체와 공동 산출물</h4></div>
    <div class="ss-grid ss-grid-3">${models.map((m) => `
      <article class="ss-tech" style="--ss-accent:${esc(m.accent)}">
        <span class="ss-idx">${esc(m.label)}</span><strong>${esc(m.role)}</strong>
        <div class="ss-case-row"><b>기여</b><span>${esc(m.contribution)}</span></div>
        <div class="ss-case-row"><b>접점</b><span>${esc(m.touchpoint)}</span></div>
        <div class="ss-case-row"><b>산출물</b><span>${esc(m.output)}</span></div>
      </article>`).join("")}</div>`;
}

function renderVerticals(rows) {
  if (!Array.isArray(rows) || !rows.length) return "";
  return `
    <div class="ss-lead"><span>VERTICAL WORKLOADS</span><h4>도메인별 워크로드와 메모리 요구</h4></div>
    <div class="ss-grid ss-grid-3">${rows.map((v) => `
      <article class="ss-translate" style="--ss-accent:#2D6BFF">
        <header><span class="ss-idx">${esc(v.label)}</span><strong>${esc(v.workload)}</strong></header>
        <div class="ss-case-row"><b>요구</b><span>${esc(v.memoryNeed)}</span></div>
        <footer><b>PRODUCT</b><span>${esc(v.product)}</span></footer>
      </article>`).join("")}</div>`;
}

function renderRnd(r) {
  if (!r || !Array.isArray(r.tracks)) return "";
  return `
    <div class="ss-lead"><span>R&amp;D ROADMAP</span><h4>${esc(r.question)}</h4></div>
    <div class="ss-grid ss-grid-4">${r.tracks.map((t) => `
      <article class="ss-tech" style="--ss-accent:#0E7777">
        <span class="ss-idx">${esc(t.label)}</span>
        <div class="ss-case-row"><b>NOW</b><span>${esc(t.now)}</span></div>
        <div class="ss-case-row"><b>NEXT</b><span>${esc(t.next)}</span></div>
        <div class="ss-case-row"><b>LATER</b><span>${esc(t.later)}</span></div>
      </article>`).join("")}</div>`;
}

function renderLlm(rows) {
  if (!Array.isArray(rows) || !rows.length) return "";
  return `
    <div class="ss-lead"><span>LLM TECH TRENDS</span><h4>최신 AI 기술이 메모리에 미치는 영향</h4></div>
    <div class="ss-grid ss-grid-4">${rows.map((t) => `
      <article class="ss-translate" style="--ss-accent:${esc(t.accent)}">
        <header><strong>${esc(t.label)}</strong></header>
        <p class="ss-llm-impact">${esc(t.impact)}</p>
        <footer><b>MEMORY</b><span>${esc(t.memory)}</span></footer>
      </article>`).join("")}</div>`;
}

function render(model) {
  // Only the blocks the console's own experience model does not carry:
  // the accumulating ledger, the three partner models, and vertical workloads.
  // Everything else moved into that model, so rendering it here would duplicate.
  return `
  <section class="ss-board" aria-labelledby="ssTitle">
    <header class="ss-head">
      <span class="ss-eyebrow">INSIGHT LEDGER</span>
      <h3 id="ssTitle">쌓이는 인사이트와 협력 구조</h3>
      <p>변화가 확인된 인사이트 · 협력 주체 · 도메인별 워크로드 요구</p>
    </header>
    ${renderLedger(model.__ledger)}
    ${renderPartners(model.partnerModels)}
    ${renderVerticals(model.verticalWorkloads)}
  </section>`;
}

let cached = null;

async function mount() {
  const host = document.querySelector("#insightLedgerMount");
  // The console re-renders its boards, which wipes anything already painted
  // here, so re-mount whenever the host comes back empty.
  if (!host || host.childElementCount > 0) return;
  try {
    ensureStyle();
    if (!cached) {
      const res = await fetch(dataUrl.href, { cache: "no-cache" });
      if (!res.ok) return;
      cached = await res.json();
      try {
        const ledgerRes = await fetch(ledgerUrl.href, { cache: "no-cache" });
        if (ledgerRes.ok) cached.__ledger = await ledgerRes.json();
      } catch {
        // The spine still renders without the ledger.
      }
    }
    if (!Array.isArray(cached.chain) || !cached.chain.length) return;
    if (host.childElementCount > 0) return;
    host.innerHTML = render(cached);
    host.dataset.ready = "1";
  } catch {
    // The rest of the console stays usable when the spine cannot load.
  }
}

const idle = (fn) => (window.requestIdleCallback
  ? window.requestIdleCallback(fn, { timeout: 1200 })
  : window.setTimeout(fn, 1));
const boot = () => { try { idle(mount); } catch { void mount(); } };
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
else boot();
window.addEventListener("memory-console-ready", boot);

// Re-paint after console board re-renders clear the mount.
let watchTimer = 0;
const observer = new MutationObserver(() => {
  const host = document.querySelector("#insightLedgerMount");
  if (!host || host.childElementCount > 0 || watchTimer) return;
  watchTimer = window.setTimeout(() => { watchTimer = 0; void mount(); }, 120);
});
observer.observe(document.documentElement, { childList: true, subtree: true });
