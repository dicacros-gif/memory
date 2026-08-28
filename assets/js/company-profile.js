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
  const sourceLabel = (source = {}) => source.grade || (source.sourceClass === "official" ? "TIER 1 · OFFICIAL" : source.sourceClass === "research" ? "TIER 3 · RESEARCH" : "TIER 2 · PUBLIC");
  const shortDate = (value = "") => {
    const match = String(value).match(/(?:\d{4}-)?(\d{1,2})-(\d{1,2})/);
    return match ? `${Number(match[1])}/${Number(match[2])}` : String(value);
  };
  const companyName = (profile = {}) => profile.name || profile.nameKo || "Company";

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

  // 세대 × HBM × 대역폭 × 램프 × 어태치. One row per generation, because a
  // programme that ships a new part every six months changes capacity and
  // bandwidth each time, and reading the whole track off one line over-counts
  // the generations that shrink. A blank cell means we have not confirmed it,
  // never that the number is zero.
  function roadmapHTML(profile = {}) {
    const roadmap = profile.roadmap;
    const rows = roadmap?.generations || [];
    if (!rows.length) return "";
    return `<section class="company-roadmap" aria-label="세대별 칩 로드맵">
      <header>
        <div><small>CHIP ROADMAP · BY GENERATION</small><strong>세대마다 무엇이 얼마나 바뀌는가</strong></div>
        ${roadmap.track ? `<b>${escapeHTML(roadmap.track)}</b>` : ""}
      </header>
      <div class="company-roadmap-rows">${rows.map((row) => `
        <article>
          <b>${row.url ? `<a href="${escapeHTML(row.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(row.name)}</a>` : escapeHTML(row.name)}</b>
          <span>${escapeHTML(row.hbm || "미확인")}</span>
          <span>${escapeHTML(row.bandwidth || "미확인")}</span>
          <span>${escapeHTML(row.ramp || "미확인")}<i>${escapeHTML(row.status || "")}</i></span>
          <span class="company-roadmap-attach">${escapeHTML(row.attach || "")}</span>
          ${row.hbmDemand ? `<span class="company-roadmap-demand">${escapeHTML(row.hbmDemand)}</span>` : ""}
        </article>`).join("")}</div>
    </section>`;
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
          <article><small>PROFILE CONTROL</small><h4>공개 기준</h4><ul><li>${escapeHTML(profile.layerLabel || "Company")}</li><li>${escapeHTML(profile.verifiedAt ? `최종 확인 ${shortDate(profile.verifiedAt) || profile.verifiedAt}` : "2026 공개 원문 우선")}</li>${profile.officialUrl ? `<li><a href="${escapeHTML(profile.officialUrl)}" target="_blank" rel="noopener noreferrer">기업·제품 공식 원문 ↗</a></li>` : ""}</ul></article>
        </div>` : ""}
        ${roadmapHTML(profile)}
        ${baselineHTML(profile)}
        ${orgHTML(profile)}
        ${painPointsHTML(profile)}
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
        ${relations.length ? `<div class="company-profile-relations"><header><b>Supplier relationship</b><span>확정·추정·미확인 분리</span></header>${relations.map((item) => `<article><strong>${escapeHTML(item.supplier)}</strong><span>${escapeHTML(item.status)}</span><p>${escapeHTML(item.note)}</p>${item.source?.url ? `<a href="${escapeHTML(item.source.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(item.source.name || "원문")} ↗</a>` : ""}</article>`).join("")}</div>` : ""}
      </section>`;
  }

  // One accelerator per company hid two things: an account can design a training
  // part and an inference part with different memory profiles, and it can be
  // named alongside silicon it did not design. Both come from what the crawl
  // observed, so a second programme appears without anyone editing a file.
  function siliconProgramsHTML(profile = {}) {
    const silicon = profile.silicon;
    if (!silicon?.programs?.length) return "";
    const cover = [
      silicon.coversTraining ? "학습" : "",
      silicon.coversInference ? "추론" : "",
    ].filter(Boolean).join(" · ");
    return `
      <section class="company-silicon">
        <header>
          <small>OBSERVED SILICON PROGRAMS</small>
          <h4>어떤 프로그램과 함께 나타나는가</h4>
          ${cover ? `<b>${escapeHTML(cover)} 축 커버</b>` : ""}
        </header>
        <ul>${silicon.programs.map((row) => `
          <li data-relation="${escapeHTML(row.relation)}">
            <div class="company-silicon-head">
              <strong>${escapeHTML(row.program)}</strong>
              <span>${escapeHTML(row.roleLabel)}</span>
              <i>${escapeHTML(row.relation)}</i>
            </div>
            <p class="company-silicon-designer">설계 ${escapeHTML(row.designer)}</p>
            <p class="company-silicon-memory">${escapeHTML(row.memoryProfile)}</p>
            ${row.url
              ? `<a href="${escapeHTML(row.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(row.headline)}</a>`
              : `<p class="company-silicon-evidence">${escapeHTML(row.headline)}</p>`}
          </li>`).join("")}</ul>
      </section>`;
  }

  function chipLensHTML(profile = {}) {
    const lens = profile.chipLens || {};
    const portfolio = lens.portfolio || [];
    const generations = lens.generations || [];
    return `
      <section class="company-lens-panel" data-company-lens-panel="chip" hidden>
        ${siliconProgramsHTML(profile)}
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

  // What the feed has accumulated about this company on its own: reported
  // spending, what its leadership actually said, and which technologies keep
  // reappearing. A term seen repeatedly is a commitment; one seen once is not,
  // so persistence is stated rather than counted.
  function persistence(seenCount) {
    const times = Number(seenCount) || 1;
    if (times >= 5) return "지속";
    if (times >= 2) return "반복";
    return "";
  }

  function signalLink(row, label) {
    const text = escapeHTML(label);
    return row.url
      ? `<a href="${escapeHTML(row.url)}" target="_blank" rel="noopener noreferrer">${text}</a>`
      : `<span>${text}</span>`;
  }

  const hasTracking = (profile = {}) => Boolean(
    profile.signals?.capex?.length || profile.signals?.tech?.length
    || profile.signals?.quotes?.length || profile.signals?.stances?.length || profile.capitalPlan?.quotes?.length
    || profile.derivedDemand?.length,
  );

  // Requirements the pipeline derived from what the feed observed about this
  // company, not sentences written for it. Absent when the feed said nothing.
  function derivedDemandHTML(profile = {}) {
    const rows = profile.derivedDemand || [];
    if (!rows.length) return "";
    return `
      <section class="company-track-block company-derived">
        <header><small>DERIVED FROM OBSERVED TECHNOLOGY</small><h4>관측된 기술이 만든 메모리 요구</h4></header>
        <ul class="company-derived-list">${rows.map((row) => `
          <li>
            <div class="company-derived-head"><b>${escapeHTML(row.technology)}</b><span>${escapeHTML(row.hold)}</span><i>${escapeHTML(row.stage)}</i></div>
            <p class="company-derived-shift">${escapeHTML(row.systemShift)}</p>
            <p class="company-derived-need">${escapeHTML(row.memoryNeed)}</p>
            <dl><div><dt>제품 축</dt><dd>${escapeHTML(row.productAxis)}</dd></div><div><dt>Gate</dt><dd>${escapeHTML(row.gate)}</dd></div></dl>
          </li>`).join("")}</ul>
      </section>`;
  }

  // "EXECUTION STAGE · 공식 원문 모니터링" told the reader nothing about the
  // company. What earns that slot is the axis the feed says is actually moving,
  // derived rather than authored — and when nothing is derived the slot is
  // dropped rather than filled with a status word.
  function movingAxis(profile = {}) {
    const derived = (profile.derivedDemand || [])[0];
    if (derived) return { label: "지금 움직이는 축", value: `${derived.technology} → ${derived.memoryNeed}` };
    const stance = (profile.signals?.stances || [])[0];
    if (stance) return { label: "최근 공개 입장", value: stance.statement };
    const tech = (profile.signals?.tech || [])[0];
    if (tech) return { label: "반복 관측 기술", value: tech.label };
    return null;
  }

  function trackingLensHTML(profile = {}) {
    const signals = profile.signals || {};
    const capex = signals.capex || [];
    const tech = signals.tech || [];
    // A statement the feed surfaced and one already on file are the same kind of
    // evidence, so they sit in one list rather than two competing blocks.
    const quotes = [
      ...(profile.capitalPlan?.quotes || []).map((row) => ({
        quote: row.quote,
        role: row.speaker || "EXECUTIVE",
        headline: row.context || "",
        url: "",
        asOf: "",
      })),
      ...(signals.quotes || []),
    ];

    const capexBlock = capex.length ? `
      <section class="company-track-block">
        <header><small>CAPEX · 공개 금액</small><h4>지출이 어떻게 움직였는가</h4></header>
        <ul class="company-track-capex">${capex.map((row) => `
          <li>
            <b>${escapeHTML(row.amount)}</b>
            ${signalLink(row, row.headline)}
            <em>${escapeHTML([row.asOf, persistence(row.seenCount)].filter(Boolean).join(" · "))}</em>
          </li>`).join("")}</ul>
      </section>` : "";

    // A headline where the company is the subject of a stated verb is an
    // attributable position even without quotation marks, and the feed carries
    // far more of these than it carries quotes.
    const stances = signals.stances || [];
    const stanceBlock = stances.length ? `
      <section class="company-track-block">
        <header><small>PUBLIC POSITION · 회사가 주어인 발표</small><h4>무엇을 하겠다고 밝혔는가</h4></header>
        <ul class="company-track-quotes">${stances.map((row) => `
          <li>
            <blockquote>${escapeHTML(row.statement)}</blockquote>
            <p><b>${escapeHTML(row.verb)}</b>${signalLink(row, row.source || "원문")}<em>${escapeHTML(row.asOf || "")}</em></p>
          </li>`).join("")}</ul>
      </section>` : "";

    const quoteBlock = quotes.length ? `
      <section class="company-track-block">
        <header><small>EXECUTIVE VIEW · 직접 발언</small><h4>경영진이 무엇을 문제로 지목했는가</h4></header>
        <ul class="company-track-quotes">${quotes.map((row) => `
          <li>
            <blockquote>${escapeHTML(row.quote)}</blockquote>
            <p><b>${escapeHTML(row.role)}</b>${signalLink(row, row.headline)}<em>${escapeHTML(row.asOf || "")}</em></p>
          </li>`).join("")}</ul>
      </section>` : "";

    const techBlock = tech.length ? `
      <section class="company-track-block">
        <header><small>TECHNOLOGY · 반복 등장</small><h4>어떤 기술로 이동하고 있는가</h4></header>
        <ul class="company-track-tech">${tech.map((row) => `
          <li data-hold="${escapeHTML(persistence(row.seenCount) || "관측")}">
            <b>${escapeHTML(row.label)}</b>
            <span>${escapeHTML(persistence(row.seenCount) || "관측")}</span>
            <em>${escapeHTML(row.firstSeen && row.firstSeen !== row.lastSeen ? `${row.firstSeen} → ${row.lastSeen}` : row.lastSeen || "")}</em>
          </li>`).join("")}</ul>
      </section>` : "";

    const derived = derivedDemandHTML(profile);
    if (!derived && !capexBlock && !stanceBlock && !quoteBlock && !techBlock) return "";
    return `
      <section class="company-lens-panel" data-company-lens-panel="tracking" hidden>
        <div class="company-tracking">${derived}${capexBlock}${stanceBlock}${quoteBlock}${techBlock}</div>
      </section>`;
  }

  // Investment posture: what the company is spending, what it plans, what its
  // leadership said, and the memory read that follows from it.
  // 고객의 새로운 요구 → 메모리의 새로운 요구 → 제품 → 신규 사업. Derived per
  // account from what the crawl observed, so an account with nothing observed
  // shows nothing rather than a generic paragraph.
  // 조직과 발언. The chairs and the statements are both observed, and the two
  // kinds of evidence stay apart: a direct quote is marked as one, a statement
  // the article reported without quoting says so. A count beside a chair says
  // how often the feed put that person in it, so a single sighting is not read
  // as an org chart.
  // 데이터센터 칩·서버 전략. Researched and dated, so the brief says something
  // true before the crawl has observed anything for this account. Every line
  // carries the source behind the text itself, and the block says when it was
  // checked — a baseline that hides its age is worse than no baseline. Where
  // the crawl has observed a silicon programme, that is shown as the live
  // reading and this stays as what it would otherwise have said.
  function baselineHTML(profile = {}) {
    const row = profile.baseline;
    if (!row) return "";
    const observedSilicon = (profile.silicon?.programs || []).slice(0, 3)
      .map((item) => `${item.program} · ${item.roleLabel}`).join(" / ");
    const lines = [
      ["칩 · 서버 전략", row.chipStrategy],
      ["PAIN POINT", row.painPoint || row.constraint],
      ["메모리 해석", row.memoryRead],
    ].filter(([, value]) => value);
    if (!lines.length) return "";
    const sources = (row.sources || []).filter((item) => item?.url);
    return `<section class="company-baseline" aria-label="칩과 데이터센터 전략">
      <header>
        <div><small>CHIP &amp; DATA CENTER STRATEGY</small><strong>지금 이 계정은 무엇을 만들고 무엇에 막혀 있는가</strong></div>
        <b>${escapeHTML(row.basis || "기준선")}${row.asOf ? ` · ${escapeHTML(shortDate(row.asOf))}` : ""}</b>
      </header>
      ${observedSilicon ? `<p class="company-baseline-observed"><i>관측 실리콘</i><span>${escapeHTML(observedSilicon)}</span></p>` : ""}
      <dl>${lines.map(([label, value]) => `<div><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value)}</dd></div>`).join("")}</dl>
      ${sources.length ? `<ul class="company-baseline-sources">${sources.map((item) => `<li><a href="${escapeHTML(item.url)}" target="_blank" rel="noopener noreferrer"><small>${escapeHTML(sourceLabel(item))}${item.observedAt ? ` · ${escapeHTML(shortDate(item.observedAt))}` : ""}</small><strong>${escapeHTML(item.label || "공개 근거")}</strong></a></li>`).join("")}</ul>` : ""}
    </section>`;
  }

  function orgHTML(profile = {}) {
    const org = profile.org;
    const people = org?.people || [];
    const statements = org?.statements || [];
    if (!people.length && !statements.length) return "";
    const peopleBlock = people.length ? `
      <div class="company-org-people">
        <small>AI INFRA · CHIP 의사결정 조직</small>
        <ul>${people.map((row) => `<li>
          <b>${escapeHTML(row.role)}</b>
          ${row.url ? `<a href="${escapeHTML(row.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(row.name)}</a>` : `<strong>${escapeHTML(row.name)}</strong>`}
          <i>${escapeHTML(row.seenCount > 1 ? `반복 ${row.seenCount}` : "관측")}</i>
        </li>`).join("")}</ul>
      </div>` : "";
    const saidBlock = statements.length ? `
      <div class="company-org-said">
        <small>최신 경영진 · 회사 발언</small>
        <ul>${statements.map((row) => `<li>
          ${row.url ? `<a href="${escapeHTML(row.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(row.text)}</a>` : `<span>${escapeHTML(row.text)}</span>`}
          <em>${escapeHTML([row.speaker && `${row.speaker}${row.role ? ` · ${row.role}` : ""}`, row.kind, row.date].filter(Boolean).join(" · "))}</em>
        </li>`).join("")}</ul>
      </div>` : "";
    return `<section class="company-org" aria-label="조직과 발언">
      <header><div><small>ORGANISATION &amp; VOICE</small><strong>누가 결정하고, 무엇을 말했는가</strong></div></header>
      <div>${peopleBlock}${saidBlock}</div>
    </section>`;
  }

  function painPointsHTML(profile = {}) {
    const cards = profile.painPoints || [];
    if (!cards.length) return "";
    return `<section class="company-pain" aria-label="고객 Pain Point와 메모리 연결">
      <header><div><small>PAIN POINT → MEMORY → NEW BIZ</small><strong>관측에서 도출된 제안 경로</strong></div></header>
      <div>${cards.map((card) => `<article>
        <b>${escapeHTML(card.pain)}</b>
        <p class="company-pain-cause">${escapeHTML(card.cause)}</p>
        <p class="company-pain-answer">${escapeHTML(card.answer)}</p>
        ${(card.products || []).length ? `<ul>${card.products.map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul>` : ""}
        <dl>
          <div><dt>신규 사업</dt><dd>${escapeHTML(card.newBiz)}</dd></div>
          <div><dt>증명 지표</dt><dd>${escapeHTML(card.metric)}</dd></div>
        </dl>
        <i>${escapeHTML(card.basis)}</i>
      </article>`).join("")}</div>
    </section>`;
  }

  function capitalPlanHTML(profile = {}) {
    const plan = profile.capitalPlan;
    if (!plan) return "";
    // A figure the crawl reported carries its source: the line itself is the
    // link, and an authored fallback is marked as a baseline rather than shown
    // as if it were current.
    const spendDetail = [plan.outlook?.buys, plan.outlook?.converts].filter(Boolean).join(" → ");
    const rows = [
      ["1", "CAPEX", plan.capex, plan.capexBasis, plan.capexUrl, plan.capexAsOf],
      ["2", "INVESTMENT PLAN", [plan.plan, spendDetail].filter(Boolean).join(" · ")],
      ["3", "EXECUTIVE COMMENT", plan.comment, plan.commentBasis, plan.commentUrl, plan.commentAsOf],
    ].filter(([, , value]) => value)
      .map(([, ...rest], position) => [String(position + 1), ...rest]);
    // Already shown as the CAPEX line when it is the observed figure.
    const seen = plan.capexBasis === "관측" ? null : plan.observed;
    if (!rows.length && !seen) return "";
    const observedRow = seen ? `<div class="company-capital-observed">
      <b>OBSERVED</b>
      ${seen.url ? `<a href="${escapeHTML(seen.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(seen.headline)}</a>` : `<span>${escapeHTML(seen.headline)}</span>`}
      <em>${escapeHTML([seen.amount, seen.date].filter(Boolean).join(" · "))}</em>
    </div>` : "";
    return `<div class="company-capital">
      <div class="company-capital-head"><small>CAPITAL &amp; INVESTMENT</small><h4>투자 계획과 메모리 해석</h4>${plan.tier && plan.tier !== "보도" ? `<b>${escapeHTML(plan.tier)}</b>` : ""}</div>
      <dl>${rows.map(([index, label, value, basis, url, asOf]) => {
        const body = url
          ? `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(value)}</a>`
          : escapeHTML(value);
        const mark = basis ? `<i data-basis="${escapeHTML(basis)}">${escapeHTML([basis, asOf].filter(Boolean).join(" "))}</i>` : "";
        return `<div><dt><span class="company-capital-index">${escapeHTML(index)}</span><span>${escapeHTML(label)}</span></dt><dd>${body}${mark}</dd></div>`;
      }).join("")}</dl>
      ${(plan.memoryRead || plan.outlook?.window) ? `<div class="company-capital-read">
        ${plan.memoryRead ? `<p><b>MEMORY READ</b><span>${escapeHTML(plan.memoryRead)}</span></p>` : ""}
        ${plan.outlook?.window ? `<p><b>INSIGHT</b><span>${escapeHTML(plan.outlook.window)}</span></p>` : ""}
      </div>` : ""}
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
    const axis = movingAxis(profile);
    dialog.innerHTML = `
      <div class="company-profile-shell" style="--company-accent:${escapeHTML(profile.accent || "#0b7189")}">
        <header class="company-profile-head">
          <div class="company-profile-monogram" aria-hidden="true">${escapeHTML((profile.name || profile.nameKo || "C").replace(/[^a-z0-9가-힣]/gi, "").slice(0, 2).toUpperCase())}</div>
          <div><small>${escapeHTML(profile.layerLabel || "COMPANY INTELLIGENCE")}</small><h2 id="companyProfileTitle">${escapeHTML(companyName(profile))}</h2><p>${escapeHTML(profile.summary || "메모리·칩·데이터센터 관점의 기업 프로필")}</p></div>
          <button type="button" class="company-profile-close" data-company-close aria-label="기업 정보 닫기">×</button>
        </header>
        <div class="company-profile-executive-strip">
          ${profile.overview?.role ? `<div><small>ROLE</small><strong>${escapeHTML(profile.overview.role)}</strong></div>` : ""}
          ${profile.overview?.platform ? `<div><small>CHIP / PLATFORM</small><strong>${escapeHTML(profile.overview.platform)}</strong></div>` : ""}
          ${axis ? `<div><small>${escapeHTML(axis.label)}</small><strong>${escapeHTML(axis.value)}</strong></div>` : ""}
          ${(profile.dataCenterLens?.operatingQuestion || profile.memoryLens?.gate) ? `<div><small>MEMORY QUESTION</small><strong>${escapeHTML(profile.dataCenterLens?.operatingQuestion || profile.memoryLens?.gate)}</strong></div>` : ""}
        </div>
        <nav class="company-profile-tabs" role="tablist" aria-label="기업 분석 관점">
          <button type="button" data-company-lens="overview" role="tab">Account Brief</button>
          <button type="button" data-company-lens="memory" role="tab">Memory</button>
          <button type="button" data-company-lens="chip" role="tab">Chip</button>
          <button type="button" data-company-lens="datacenter" role="tab">Data Center</button>
          ${hasTracking(profile) ? '<button type="button" data-company-lens="tracking" role="tab">Tracking</button>' : ""}
        </nav>
        <main class="company-profile-body">
          ${overviewLensHTML(profile)}
          ${memoryLensHTML(profile)}
          ${chipLensHTML(profile)}
          ${dataCenterLensHTML(profile)}
          ${trackingLensHTML(profile)}
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
