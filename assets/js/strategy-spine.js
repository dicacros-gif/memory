/**
 * Strategy spine — renders the AI-industry-to-new-business causal chain as
 * consulting shapes. Self-mounting so it costs the console bundle nothing:
 * it finds its own mount, fetches its own model, and paints on idle.
 */
const script = document.currentScript;
const revision = new URL(script?.src || location.href).searchParams.get("v") || "current";
const base = script?.src || location.href;
const dataUrl = new URL(`../../data/strategy-spine.json?v=${encodeURIComponent(revision)}`, base);
const styleUrl = new URL(`../css/strategy-spine.min.css?v=${encodeURIComponent(revision)}`, base);

function ensureStyle() {
  if (document.querySelector('link[data-strategy-spine]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = styleUrl.href;
  link.dataset.strategySpine = "1";
  document.head.appendChild(link);
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

function render(model) {
  const layers = [["hyperscaler", "하이퍼스케일러"], ["model", "모델 기업"], ["merchant-silicon", "머천트 실리콘"], ["asic-partner", "ASIC 설계 파트너"]];
  return `
  <section class="ss-board" aria-labelledby="ssTitle">
    <header class="ss-head">
      <span class="ss-eyebrow">STRATEGY SPINE</span>
      <h3 id="ssTitle">${esc(model.title)}</h3>
      <p>${esc(model.subtitle)}</p>
    </header>

    <ol class="ss-chain" aria-label="AI 산업 변화에서 신규 사업까지">${chevron(model.chain)}</ol>

    <div class="ss-lead"><span>TECH → MEMORY</span><h4>AI 기술 변화를 메모리 수요로 번역</h4></div>
    <div class="ss-grid ss-grid-4">${model.translations.map(translationRow).join("")}</div>

    <div class="ss-lead"><span>CUSTOMER PAIN</span><h4>고객이 실제로 막혀 있는 지점</h4></div>
    ${layers.map(([id, label]) => {
      const rows = model.customerPain.filter((p) => p.layer === id);
      if (!rows.length) return "";
      return `<div class="ss-layer"><span class="ss-layer-label">${esc(label)}</span><div class="ss-grid ss-grid-3">${rows.map(painCard).join("")}</div></div>`;
    }).join("")}

    <div class="ss-lead"><span>SK HYNIX ANSWER</span><h4>Pain에 대응하는 3대 핵심 기술</h4></div>
    <div class="ss-grid ss-grid-3">${model.coreTech.map(techCard).join("")}</div>

    <div class="ss-lead"><span>CHANNEL</span><h4>인증·공급 확장이 가능한 채널</h4></div>
    <div class="ss-grid ss-grid-2">${model.channel.map((c) => `
      <article class="ss-tech"><span class="ss-idx">${esc(c.label)}</span>
        <strong>${esc((c.members || []).join(" · "))}</strong><p>${esc(c.note)}</p></article>`).join("")}</div>

    <div class="ss-lead"><span>USE CASES</span><h4>Pain을 해결한 적용 사례</h4></div>
    <div class="ss-grid ss-grid-3">${model.useCases.map(useCase).join("")}</div>

    <div class="ss-lead"><span>ECONOMICS</span><h4>사업성을 숫자로 증명하는 축</h4></div>
    <div class="ss-metrics">${model.economics.map((g) => `
      <div class="ss-metric-group"><b>${esc(g.group)}</b>${g.metrics.map((m) => `<span>${esc(m)}</span>`).join("")}</div>`).join("")}</div>

    <div class="ss-grid ss-grid-3 ss-pillars">${model.pillars.map((p) => `
      <article class="ss-pillar" style="--ss-accent:${esc(p.accent)}">
        <span class="ss-idx">${esc(p.index)}</span><strong>${esc(p.label)}</strong><em>${esc(p.question)}</em>
      </article>`).join("")}</div>

    <p class="ss-key"><b>KEY MESSAGE</b>${esc(model.keyMessage)}</p>
  </section>`;
}

let cached = null;

async function mount() {
  const host = document.querySelector("#strategySpine");
  // The console re-renders its boards, which wipes anything already painted
  // here, so re-mount whenever the host comes back empty.
  if (!host || host.childElementCount > 0) return;
  try {
    ensureStyle();
    if (!cached) {
      const res = await fetch(dataUrl.href, { cache: "no-cache" });
      if (!res.ok) return;
      cached = await res.json();
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
  const host = document.querySelector("#strategySpine");
  if (!host || host.childElementCount > 0 || watchTimer) return;
  watchTimer = window.setTimeout(() => { watchTimer = 0; void mount(); }, 120);
});
observer.observe(document.documentElement, { childList: true, subtree: true });
