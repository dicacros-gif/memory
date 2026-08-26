(() => {
  "use strict";

  const script = document.currentScript;
  const revision = new URL(script?.src || location.href).searchParams.get("v") || "current";
  const directoryUrl = new URL(`../../data/company-directory-client.json?v=${encodeURIComponent(revision)}`, script?.src || location.href);
  const styleUrl = new URL(`../css/company-profile.min.css?v=${encodeURIComponent(revision)}`, script?.src || location.href);
  const excluded = "script,style,template,noscript,textarea,input,select,option,code,pre,a,button,summary,[contenteditable],.company-profile-modal,.company-profile-link";
  const state = { directory: null, byId: new Map(), aliasMap: new Map(), aliasPattern: null, activeLens: "overview" };
  let directoryPromise = null;
  let dialog = null;
  let pendingRoots = new Set();
  let pendingTimer = 0;

  const escapeHTML = (value) => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const unique = (items = []) => [...new Set(items.filter(Boolean).map((item) => String(item).trim()).filter(Boolean))];
  const list = (items = [], empty = "공개 확인 필요") => items?.length ? items : [empty];
  const sourceLabel = (source = {}) => source.sourceClass === "official" ? "OFFICIAL" : source.sourceClass === "research" ? "RESEARCH" : "PUBLIC";
  const companyName = (profile = {}) => profile.nameKo && profile.nameKo !== profile.name ? `${profile.nameKo} · ${profile.name}` : profile.name || profile.nameKo || "Company";

  function ensureStyle() {
    if (document.getElementById("companyProfileStyles")) return;
    const link = document.createElement("link");
    link.id = "companyProfileStyles";
    link.rel = "stylesheet";
    link.href = styleUrl.href;
    document.head.appendChild(link);
  }

  function normalizeAlias(value = "") {
    return String(value).toLocaleLowerCase("en-US").replace(/\s+/g, " ").trim();
  }

  function escapeRegExp(value = "") {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function prepareDirectory(directory = {}) {
    state.directory = directory;
    state.byId = new Map((directory.profiles || []).map((profile) => [profile.id, profile]));
    state.aliasMap = new Map();
    for (const profile of directory.profiles || []) {
      for (const alias of profile.autoLinkAliases || [profile.name, profile.nameKo]) {
        const normalized = normalizeAlias(alias);
        if (normalized.length >= 3 && !state.aliasMap.has(normalized)) state.aliasMap.set(normalized, profile.id);
      }
    }
    const aliases = [...state.aliasMap.keys()].sort((a, b) => b.length - a.length);
    state.aliasPattern = aliases.length
      ? new RegExp(`(^|[^\\p{L}\\p{N}_])(${aliases.map(escapeRegExp).join("|")})(?=$|[^\\p{L}\\p{N}_])`, "giu")
      : null;
    return directory;
  }

  async function loadDirectory({ reload = false } = {}) {
    if (reload) directoryPromise = null;
    if (directoryPromise) return directoryPromise;
    directoryPromise = fetch(directoryUrl, { cache: reload ? "reload" : "no-cache" })
      .then((response) => {
        if (!response.ok) throw new Error(`Company directory HTTP ${response.status}`);
        return response.json();
      })
      .then((directory) => {
        const currentRun = String(window.MEMORY_SITE_CONTENT?.runId || "");
        if (!reload && currentRun && directory.runId && currentRun !== String(directory.runId)) return loadDirectory({ reload: true });
        prepareDirectory(directory);
        ensureStyle();
        scheduleLinking(document.body);
        window.dispatchEvent(new CustomEvent("memory-company-directory-ready", { detail: { runId: directory.runId, profiles: directory.profiles?.length || 0 } }));
        return directory;
      })
      .catch((error) => {
        directoryPromise = null;
        console.warn("Company intelligence directory unavailable", error);
        return null;
      });
    return directoryPromise;
  }

  function resolveCompanyId(target) {
    const explicit = target?.closest?.("[data-company-id],[data-account-id],[data-equity-stock]");
    if (!explicit) return "";
    const raw = explicit.dataset.companyId || explicit.dataset.accountId || explicit.dataset.equityStock || "";
    return String(raw).replace(/-stock$/, "");
  }

  function companyTrigger(profile, label) {
    const trigger = document.createElement("span");
    trigger.className = "company-profile-link";
    trigger.dataset.companyId = profile.id;
    trigger.role = "button";
    trigger.tabIndex = 0;
    trigger.title = `${profile.name || profile.nameKo} 기업 인텔리전스 열기`;
    trigger.textContent = label;
    return trigger;
  }

  function decorateTextNode(node) {
    if (!state.aliasPattern || !node?.parentElement || !node.nodeValue?.trim()) return;
    const parent = node.parentElement;
    if (parent.closest(excluded)) return;
    const value = node.nodeValue;
    if (value.length > 1200) return;
    state.aliasPattern.lastIndex = 0;
    const matches = [...value.matchAll(state.aliasPattern)];
    if (!matches.length) return;
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const match of matches) {
      const prefix = match[1] || "";
      const label = match[2] || "";
      const start = Number(match.index || 0) + prefix.length;
      if (start < cursor) continue;
      fragment.append(value.slice(cursor, start));
      const profile = state.byId.get(state.aliasMap.get(normalizeAlias(label)));
      fragment.append(profile ? companyTrigger(profile, label) : label);
      cursor = start + label.length;
    }
    fragment.append(value.slice(cursor));
    node.replaceWith(fragment);
  }

  function linkRoot(root) {
    if (!state.aliasPattern || !root || root.nodeType !== Node.ELEMENT_NODE) return;
    if (root.matches?.(excluded) || root.closest?.(".company-profile-modal")) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue?.trim() || node.parentElement?.closest(excluded)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    let index = 0;
    const step = (deadline) => {
      let count = 0;
      while (index < nodes.length && count < 180 && (!deadline || deadline.timeRemaining() > 2)) {
        decorateTextNode(nodes[index]);
        index += 1;
        count += 1;
      }
      if (index < nodes.length) schedule(step);
    };
    schedule(step);
  }

  function schedule(callback) {
    if ("requestIdleCallback" in window) window.requestIdleCallback(callback, { timeout: 500 });
    else window.setTimeout(() => callback(null), 24);
  }

  function scheduleLinking(root) {
    if (!root || !state.aliasPattern) return;
    pendingRoots.add(root.nodeType === Node.TEXT_NODE ? root.parentElement : root);
    window.clearTimeout(pendingTimer);
    pendingTimer = window.setTimeout(() => {
      const roots = [...pendingRoots];
      pendingRoots = new Set();
      roots.forEach(linkRoot);
    }, 48);
  }

  function baselineHTML(profile = {}) {
    const rows = profile.memoryLens?.baseline || [];
    if (!rows.length) return "";
    return `<div class="company-profile-baseline">${rows.map((item) => `<div><small>${escapeHTML(item.label || "PUBLIC SPEC")}</small><strong>${escapeHTML(item.value || "공개 확인 필요")}</strong></div>`).join("")}</div>`;
  }

  function overviewLensHTML(profile = {}) {
    const brief = profile.accountBrief || {};
    const facts = brief.businessStatus || [];
    const flow = brief.decisionFlow || [];
    const raci = brief.organizationRaci || [];
    const priorities = brief.priorities || [];
    const leaders = (profile.organization || []).filter((item) => item?.name || item?.role).slice(0, 4);
    return `
      <section class="company-lens-panel is-active" data-company-lens-panel="overview">
        <div class="company-profile-thesis company-profile-thesis--account"><span>ACCOUNT THESIS</span><strong>${escapeHTML(brief.mandate || profile.summary || "AI Infra 의사결정 연결")}</strong><p>${escapeHTML(profile.dataCenterLens?.operatingQuestion || profile.memoryLens?.gate || "고객 Roadmap과 Memory Buying Criteria를 동일 화면에 연결")}</p></div>
        <div class="company-account-facts">${facts.map((item) => `<article><small>${escapeHTML(item.label)}</small><strong>${escapeHTML(item.value)}</strong></article>`).join("")}</div>
        ${flow.length ? `<div class="company-account-flow" aria-label="고객 전략 연결 구조">${flow.map((item, index) => `<article><i>${escapeHTML(item.index || String(index + 1).padStart(2, "0"))}</i><small>${escapeHTML(item.label)}</small><strong>${escapeHTML(item.value)}</strong></article>`).join("")}</div>` : ""}
        <section class="company-raci"><header><div><small>AI INFRA EXECUTION</small><strong>계정별 역할과 산출물</strong></div><span>GSM → HBM Business → MSR</span></header><div>${raci.map((item) => `<article><small>${escapeHTML(item.owner)}</small><strong>${escapeHTML(item.role)}</strong><p>${escapeHTML(item.action)}</p></article>`).join("")}</div></section>
        ${(priorities.length || leaders.length) ? `<div class="company-profile-grid company-profile-grid--account">
          ${priorities.length ? `<article><small>STRATEGIC PRIORITIES</small><h4>우선 확인 안건</h4><ul>${priorities.map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul></article>` : ""}
          ${leaders.length ? `<article><small>LEADERSHIP / BUYING CENTER</small><h4>공개 조직 신호</h4><ul>${leaders.map((item) => `<li><b>${escapeHTML(item.name || item.role)}</b>${item.name && item.role ? `<span>${escapeHTML(item.role)}</span>` : ""}</li>`).join("")}</ul></article>` : ""}
          <article><small>PROFILE CONTROL</small><h4>공개 기준</h4><ul><li>${escapeHTML(profile.layerLabel || "Company")}</li><li>${escapeHTML(profile.verifiedAt ? `최종 확인 ${profile.verifiedAt}` : "2026 공개 원문 우선")}</li>${profile.officialUrl ? `<li><a href="${escapeHTML(profile.officialUrl)}" target="_blank" rel="noopener noreferrer">기업·제품 공식 원문 ↗</a></li>` : ""}</ul></article>
        </div>` : ""}
        ${capitalPlanHTML(profile)}
        ${executiveLensHTML(profile)}
      </section>`;
  }

  function memoryLensHTML(profile = {}) {
    const lens = profile.memoryLens || {};
    const relations = lens.supplierRelations || [];
    return `
      <section class="company-lens-panel is-active" data-company-lens-panel="memory">
        <div class="company-profile-thesis"><span>MEMORY THESIS</span><strong>${escapeHTML(lens.pain || "")}</strong><p>${escapeHTML(lens.proposal || "Requirement Lock 우선")}</p></div>
        ${baselineHTML(profile)}
        ${lens.buyingCriteria?.length ? `<div class="company-buying-criteria"><b>BUYING CRITERIA</b>${lens.buyingCriteria.map((item, index) => `<span><i>${String(index + 1).padStart(2, "0")}</i>${escapeHTML(item)}</span>`).join("")}</div>` : ""}
        <div class="company-profile-grid">
          <article><small>01 · CUSTOMER PAIN</small><h4>Memory bottleneck</h4><p>${escapeHTML(lens.pain || "공개 확인 필요")}</p></article>
          <article><small>02 · SKH OPTION</small><h4>Memory proposal</h4><p>${escapeHTML(lens.proposal || "Requirement Lock 우선")}</p></article>
          <article><small>03 · DECISION GATE</small><h4>Qualification criteria</h4><p>${escapeHTML(lens.gate || "동일 Workload·SLO 검증")}</p></article>
        </div>
        ${lens.painAxes?.length ? `<div class="company-profile-axis"><header><b>실측 Pain signal</b><span>최근 검증 데이터 기준</span></header>${lens.painAxes.map((axis) => `<div><span>${escapeHTML(axis.label)}</span><i style="--axis:${Math.min(100, Math.max(8, Number(axis.mentions || 0) * 14))}%"></i><b>${Number(axis.mentions || 0)}</b></div>`).join("")}</div>` : ""}
        ${relations.length ? `<div class="company-profile-relations"><header><b>Supplier relationship</b><span>확정·추정·미확인 분리</span></header>${relations.map((item) => `<article><strong>${escapeHTML(item.supplier)}</strong><span>${escapeHTML(item.status)}</span><p>${escapeHTML(item.note)}</p>${item.source?.url ? `<a href="${escapeHTML(item.source.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(item.source.name || "근거 원문")} ↗</a>` : ""}</article>`).join("")}</div>` : ""}
      </section>`;
  }

  function chipLensHTML(profile = {}) {
    const lens = profile.chipLens || {};
    const portfolio = lens.portfolio || [];
    const generations = lens.generations || [];
    return `
      <section class="company-lens-panel" data-company-lens-panel="chip" hidden>
        <div class="company-profile-thesis"><span>CHIP THESIS</span><strong>${escapeHTML(lens.primaryChip || "공개 Chip Roadmap 확인 필요")}</strong><p>${escapeHTML(lens.partner?.role || "Compute·Memory·Package 경계를 고객 Roadmap과 함께 추적")}</p></div>
        <div class="company-profile-grid company-profile-grid--chips">
          ${list(portfolio, null).map((item, index) => item ? `<article><small>${String(index + 1).padStart(2, "0")} · ${escapeHTML(item.type || "CHIP PLATFORM")}</small><h4>${escapeHTML(item.name || lens.primaryChip)}</h4><p>${escapeHTML(item.publicSpec || "공개 스펙 확인 필요")}</p><dl><div><dt>WORKLOAD</dt><dd>${escapeHTML(item.workload || "공개 확인 필요")}</dd></div><div><dt>MEMORY PAIN</dt><dd>${escapeHTML(item.memoryPain || "공개 확인 필요")}</dd></div></dl></article>` : `<article><small>01 · CHIP PLATFORM</small><h4>${escapeHTML(lens.primaryChip || "공개 확인 필요")}</h4><p>공개 원문 기반 세대·스펙 추적</p></article>`).join("")}
        </div>
        ${generations.length ? `<div class="company-generation-flow"><header><b>Generation roadmap</b><span>공개 스펙 기준</span></header>${generations.map((item, index) => `<div><i>${String(index + 1).padStart(2, "0")}</i><strong>${escapeHTML(item.name)}</strong><span>${item.capacityGb ? `${escapeHTML(item.capacityGb)}GB` : "용량 확인 필요"}</span><span>${item.bandwidthTbps ? `${escapeHTML(item.bandwidthTbps)}TB/s` : "대역폭 확인 필요"}</span></div>`).join("")}</div>` : ""}
        ${lens.servesAccounts?.length ? `<div class="company-related-list"><b>연결 고객</b>${lens.servesAccounts.map((item) => `<button type="button" data-company-id="${escapeHTML(item.id)}">${escapeHTML(item.company)}<small>${escapeHTML(item.chip || "")}</small></button>`).join("")}</div>` : ""}
      </section>`;
  }

  function dataCenterLensHTML(profile = {}) {
    const lens = profile.dataCenterLens || {};
    return `
      <section class="company-lens-panel" data-company-lens-panel="datacenter" hidden>
        <div class="company-profile-thesis"><span>DATA CENTER THESIS</span><strong>${escapeHTML(lens.systemBottleneck || "시스템 병목 확인 필요")}</strong><p>${escapeHTML(lens.operatingQuestion || "Memory가 Rack·서비스 KPI에 미치는 영향을 검증")}</p></div>
        <div class="company-system-flow" aria-label="데이터센터 관점 의사결정 흐름">
          <article><small>01</small><b>WORKLOAD</b><p>${escapeHTML(unique(lens.workloads || []).join(" · ") || lens.demandClass || "공개 확인 필요")}</p></article>
          <i aria-hidden="true">→</i>
          <article><small>02</small><b>SYSTEM BOTTLENECK</b><p>${escapeHTML(lens.systemBottleneck || "공개 확인 필요")}</p></article>
          <i aria-hidden="true">→</i>
          <article><small>03</small><b>MEMORY ARCHITECTURE</b><p>${escapeHTML(lens.architectureAction || "Requirement Matrix 설계")}</p></article>
          <i aria-hidden="true">→</i>
          <article><small>04</small><b>EXECUTION GATE</b><p>${escapeHTML(lens.executionGate || "동일 Workload·SLO 검증")}</p></article>
        </div>
        <div class="company-profile-grid">
          <article><small>KPI · PERFORMANCE</small><h4>Goodput · TTFT/TPOT</h4><p>가속기 사용률이 아닌 품질·지연 SLO를 통과한 유효 처리량</p></article>
          <article><small>KPI · ECONOMICS</small><h4>Cost per Successful Task</h4><p>Memory·Compute·Network·Storage·Power 비용을 업무 성과로 환산</p></article>
          <article><small>KPI · RESILIENCE</small><h4>Qualification · Recovery</h4><p>패키징·공급·장애복구·Capacity 일정을 동일 Gate로 관리</p></article>
        </div>
      </section>`;
  }

  // Investment posture: what the company is spending, what it plans, what its
  // leadership said, and the memory read that follows from it.
  function capitalPlanHTML(profile = {}) {
    const plan = profile.capitalPlan;
    if (!plan) return "";
    const rows = [
      ["CAPEX", plan.capex],
      ["INVESTMENT PLAN", plan.plan],
      ["EXECUTIVE VIEW", plan.comment],
      ["MEMORY READ", plan.memoryRead],
    ].filter(([, value]) => value);
    const seen = plan.observed;
    if (!rows.length && !seen) return "";
    const observedRow = seen ? `<div class="company-capital-observed">
      <b>OBSERVED</b>
      ${seen.url ? `<a href="${escapeHTML(seen.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(seen.headline)}</a>` : `<span>${escapeHTML(seen.headline)}</span>`}
      <em>${escapeHTML([seen.amount, seen.date].filter(Boolean).join(" · "))}</em>
    </div>` : "";
    return `<div class="company-capital">
      <div class="company-capital-head"><small>CAPITAL &amp; INVESTMENT</small><h4>투자 계획과 메모리 해석</h4>${plan.tier ? `<b>${escapeHTML(plan.tier)}</b>` : ""}</div>
      <dl>${rows.map(([label, value]) => `<div><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value)}</dd></div>`).join("")}</dl>
      ${observedRow}
    </div>`;
  }

  function executiveLensHTML(profile = {}) {
    const lens = profile.executiveLens || {};
    const actions = lens.actions || [];
    if (!actions.length) return "";
    const signals = unique([...(lens.painSignals || []), ...(lens.riskSignals || [])]).slice(0, 4);
    return `<section class="company-executive-plan" aria-label="90일 실행 제안">
      <header><div><small>EXECUTIVE ACTION</small><strong>${escapeHTML(lens.question || "다음 의사결정 질문")}</strong></div>${signals.length ? `<p>${signals.map((item) => `<span>${escapeHTML(item)}</span>`).join("")}</p>` : ""}</header>
      <div>${actions.map((item) => `<article><small>${escapeHTML(item.phase)}</small><strong>${escapeHTML(item.title)}</strong><p>${escapeHTML(item.detail)}</p></article>`).join("")}</div>
    </section>`;
  }

  function evidenceHTML(profile = {}) {
    const sources = unique([...(profile.evidence || [])]
      .filter((item) => item?.url && String(item.date || item.publishedAt || item.asOf || "").startsWith("2026"))
      .map((item) => JSON.stringify(item))).map((item) => JSON.parse(item)).slice(0, 6);
    if (!sources.length) return "";
    return `<footer class="company-profile-evidence"><header><b>2026 KEY SIGNALS</b><span>중복 제거 · 최신 기사만 표시</span></header><div>${sources.map((item) => `<a href="${escapeHTML(item.url)}" target="_blank" rel="noopener noreferrer"><small>${escapeHTML(sourceLabel(item))}</small><strong>${escapeHTML(item.title || item.name || item.source || "공개 원문")}</strong><span>${escapeHTML(item.date || item.asOf || "")} ↗</span></a>`).join("")}</div></footer>`;
  }

  function ensureDialog() {
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.className = "company-profile-modal";
    dialog.setAttribute("aria-labelledby", "companyProfileTitle");
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
      const close = event.target.closest("[data-company-close]");
      if (close) dialog.close();
      const tab = event.target.closest("[data-company-lens]");
      if (tab) setLens(tab.dataset.companyLens);
    });
    dialog.addEventListener("close", () => document.body.classList.remove("company-profile-open"));
    document.body.appendChild(dialog);
    return dialog;
  }

  function setLens(lens = "overview") {
    state.activeLens = lens;
    dialog?.querySelectorAll("[data-company-lens]").forEach((button) => {
      const active = button.dataset.companyLens === lens;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    dialog?.querySelectorAll("[data-company-lens-panel]").forEach((panel) => {
      const active = panel.dataset.companyLensPanel === lens;
      panel.hidden = !active;
      panel.classList.toggle("is-active", active);
    });
  }

  function renderDialog(profile = {}) {
    const stage = profile.overview?.stage?.label || "공개 확인 필요";
    dialog.innerHTML = `
      <div class="company-profile-shell" style="--company-accent:${escapeHTML(profile.accent || "#0b7189")}">
        <header class="company-profile-head">
          <div class="company-profile-monogram" aria-hidden="true">${escapeHTML((profile.name || profile.nameKo || "C").replace(/[^a-z0-9가-힣]/gi, "").slice(0, 2).toUpperCase())}</div>
          <div><small>${escapeHTML(profile.layerLabel || "COMPANY INTELLIGENCE")}</small><h2 id="companyProfileTitle">${escapeHTML(companyName(profile))}</h2><p>${escapeHTML(profile.summary || "메모리·칩·데이터센터 관점의 기업 프로필")}</p></div>
          <button type="button" class="company-profile-close" data-company-close aria-label="기업 정보 닫기">×</button>
        </header>
        <div class="company-profile-executive-strip">
          <div><small>ROLE</small><strong>${escapeHTML(profile.overview?.role || "공개 확인 필요")}</strong></div>
          <div><small>CHIP / PLATFORM</small><strong>${escapeHTML(profile.overview?.platform || "공개 확인 필요")}</strong></div>
          <div><small>EXECUTION STAGE</small><strong>${escapeHTML(stage)}</strong></div>
          <div><small>MEMORY QUESTION</small><strong>${escapeHTML(profile.dataCenterLens?.operatingQuestion || profile.memoryLens?.gate || "공개 확인 필요")}</strong></div>
        </div>
        <nav class="company-profile-tabs" role="tablist" aria-label="기업 분석 관점">
          <button type="button" data-company-lens="overview" role="tab">Account Brief</button>
          <button type="button" data-company-lens="memory" role="tab">Memory</button>
          <button type="button" data-company-lens="chip" role="tab">Chip</button>
          <button type="button" data-company-lens="datacenter" role="tab">Data Center</button>
        </nav>
        <main class="company-profile-body">
          ${overviewLensHTML(profile)}
          ${memoryLensHTML(profile)}
          ${chipLensHTML(profile)}
          ${dataCenterLensHTML(profile)}
          ${evidenceHTML(profile)}
        </main>
      </div>`;
    setLens(state.activeLens || "overview");
  }

  async function openProfile(id) {
    const directory = await loadDirectory();
    if (!directory) return;
    const profile = state.byId.get(String(id).replace(/-stock$/, ""));
    if (!profile) return;
    ensureStyle();
    ensureDialog();
    state.activeLens = "overview";
    renderDialog(profile);
    document.body.classList.add("company-profile-open");
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    dialog.querySelector("[data-company-close]")?.focus({ preventScroll: true });
  }

  document.addEventListener("click", (event) => {
    const id = resolveCompanyId(event.target);
    if (!id) return;
    event.preventDefault();
    event.stopPropagation();
    void openProfile(id);
  }, true);

  document.addEventListener("keydown", (event) => {
    if (!["Enter", " "].includes(event.key)) return;
    const id = resolveCompanyId(event.target);
    if (!id) return;
    event.preventDefault();
    event.stopPropagation();
    void openProfile(id);
  }, true);

  const observer = new MutationObserver((mutations) => {
    if (!state.aliasPattern) return;
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE && !node.closest?.(".company-profile-modal")) scheduleLinking(node);
      }
    }
  });

  function start() {
    observer.observe(document.body, { childList: true, subtree: true });
    const prime = () => loadDirectory();
    if ("requestIdleCallback" in window) window.requestIdleCallback(prime, { timeout: 900 });
    else window.setTimeout(prime, 300);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
  window.addEventListener("memory-site-content-ready", () => scheduleLinking(document.body));
  window.addEventListener("memory-console-ready", () => scheduleLinking(document.querySelector("#intelligenceConsole") || document.body));
})();
