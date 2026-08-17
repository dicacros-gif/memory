(() => {
  "use strict";

  const BUSINESS_TITLE = "AI Infra Strategy · Customer Pain to Executive Action";
  const CONSOLE_HASH = "#console";
  const CONSOLE_REVISION = "infra-20260817-51";
  const DECISION_CLIENT_PATH = "data/landing-decision-client.json";
  const SITE_CONTENT_PATH = "data/site-content-client.json";
  const site = document.querySelector("#businessSite");
  let consoleLayer = document.querySelector("#intelligenceConsole");
  const header = document.querySelector("#businessHeader");
  const nav = document.querySelector("#businessNav");
  const menuButton = document.querySelector("#businessMenuButton");
  let consoleExit = document.querySelector("#consoleExit");
  const navLinks = [...document.querySelectorAll("#businessNav a[href^='#']")];
  const businessSections = navLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);
  let consoleLoadPromise = null;
  let manifestPromise = null;
  let siteContentPromise = null;
  let siteContentRefreshTimer = 0;
  let consultingMotionObserver = null;
  let presentationPolicy = null;
  let businessReady = false;
  let businessWarmupStarted = false;
  let consoleWarmupStarted = false;
  let consoleStartupTimer = 0;
  let view = "business";

  function isConsoleHash(hash = location.hash) {
    return hash === CONSOLE_HASH || hash.startsWith(`${CONSOLE_HASH}/`);
  }

  function finishConsoleStartup() {
    window.clearTimeout(consoleStartupTimer);
    consoleStartupTimer = 0;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.documentElement.classList.remove("console-entry");
      document.body.classList.remove("console-startup");
    }));
  }

  function setMenu(open) {
    document.body.classList.toggle("business-menu-open", open);
    nav?.classList.toggle("is-open", open);
    menuButton?.setAttribute("aria-expanded", String(open));
    menuButton?.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
  }

  function setActiveNav(id) {
    for (const link of navLinks) {
      const active = link.getAttribute("href") === `#${id}`;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
  }

  function prepareConsoleMedia() {
    const heroVideo = document.querySelector("#memoryHeroVideo[data-poster]");
    if (heroVideo && !heroVideo.poster) heroVideo.poster = heroVideo.dataset.poster;
  }

  function ensureConsoleMarkup() {
    if (consoleLayer) return consoleLayer;
    const template = document.querySelector("#consoleTemplate");
    if (!(template instanceof HTMLTemplateElement)) return null;
    const fragment = template.content.cloneNode(true);
    consoleLayer = fragment.querySelector("#intelligenceConsole");
    if (!consoleLayer) return null;
    const anchor = document.querySelector("#qaAnswer");
    document.body.insertBefore(fragment, anchor || null);
    consoleExit = document.querySelector("#consoleExit");
    consoleExit?.addEventListener("click", () => openBusiness("home"));
    template.remove();
    return consoleLayer;
  }

  function ensureResourceHint(id, rel, as, href, priority = "auto") {
    const existing = document.getElementById(id);
    if (existing) {
      if (rel === "preload" && existing.rel !== "preload") existing.rel = "preload";
      existing.fetchPriority = priority;
      return existing;
    }
    const link = document.createElement("link");
    link.id = id;
    link.rel = rel;
    link.as = as;
    link.href = href;
    link.fetchPriority = priority;
    document.head.appendChild(link);
    return link;
  }

  function ensurePreload(id, as, href, priority = "auto") {
    return ensureResourceHint(id, "preload", as, href, priority);
  }

  function primeConsoleAssets() {
    ensurePreload("consoleStylesPreload", "style", `assets/css/styles.min.css?v=${CONSOLE_REVISION}`, "high");
    ensurePreload("consoleAppPreload", "script", `assets/js/app.min.js?v=${CONSOLE_REVISION}`, "low");
    ensurePreload("consolePosterPreload", "image", "assets/media/memory-hero-poster.webp", "high");
  }

  function loadStylesheet() {
    const existing = document.querySelector("#consoleStyles");
    if (existing) {
      if (existing.dataset.ready === "1") return Promise.resolve();
      return new Promise((resolve, reject) => {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
      });
    }

    return new Promise((resolve, reject) => {
      const link = document.createElement("link");
      link.id = "consoleStyles";
      link.rel = "stylesheet";
      link.href = `assets/css/styles.min.css?v=${CONSOLE_REVISION}`;
      link.addEventListener("load", () => {
        link.dataset.ready = "1";
        resolve();
      }, { once: true });
      link.addEventListener("error", reject, { once: true });
      const landingStyles = document.querySelector('link[href^="assets/css/landing.min.css"]');
      document.head.insertBefore(link, landingStyles || null);
    });
  }

  function loadAppScript() {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector("#consoleApp");
      if (existing) {
        if (existing.dataset.ready === "1") resolve();
        else {
          existing.addEventListener("load", resolve, { once: true });
          existing.addEventListener("error", reject, { once: true });
        }
        return;
      }
      const script = document.createElement("script");
      script.id = "consoleApp";
      script.src = `assets/js/app.min.js?v=${CONSOLE_REVISION}`;
      script.addEventListener("load", () => {
        script.dataset.ready = "1";
        resolve();
      }, { once: true });
      script.addEventListener("error", reject, { once: true });
      document.body.appendChild(script);
    });
  }

  function loadConsole() {
    if (consoleLoadPromise) return consoleLoadPromise;
    primeConsoleAssets();
    consoleLoadPromise = Promise.all([loadStylesheet(), loadSiteContent()]).then(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      return loadAppScript();
    });
    return consoleLoadPromise;
  }

  async function openConsole({ updateHistory = true } = {}) {
    if (!site) return;
    const activeConsoleLayer = ensureConsoleMarkup();
    if (!activeConsoleLayer) return;
    view = "console";
    setMenu(false);
    primeConsoleAssets();
    document.documentElement.classList.add("console-entry");
    site.hidden = true;
    activeConsoleLayer.hidden = true;
    document.body.classList.remove("business-menu-open");
    document.body.classList.add("console-loading");
    prepareConsoleMedia();
    if (updateHistory && !isConsoleHash()) history.pushState({ view: "console" }, "", CONSOLE_HASH);
    window.scrollTo({ top: 0, behavior: "instant" });

    for (const trigger of document.querySelectorAll("[data-open-console]")) trigger.setAttribute("aria-busy", "true");
    try {
      await loadStylesheet();
      activeConsoleLayer.hidden = false;
      document.body.classList.remove("landing-mode", "business-menu-open", "console-loading");
      document.body.classList.add("console-mode", "console-startup");
      await loadConsole();
      if (document.body.dataset.consoleReady === "1") finishConsoleStartup();
      else consoleStartupTimer = window.setTimeout(finishConsoleStartup, 6000);
    } catch (error) {
      console.error("Intelligence Console failed to load", error);
      document.querySelector("#consoleStyles:not([data-ready='1'])")?.remove();
      document.querySelector("#consoleApp:not([data-ready='1'])")?.remove();
      consoleLoadPromise = null;
      const status = document.querySelector("#businessDataStatus");
      if (status) status.textContent = "Console 로딩 실패 · 다시 시도해 주세요";
      openBusiness("home", { updateHistory: true });
    } finally {
      for (const trigger of document.querySelectorAll("[data-open-console]")) trigger.removeAttribute("aria-busy");
    }
  }

  function openBusiness(targetId = "home", { updateHistory = true } = {}) {
    if (!site) return;
    view = "business";
    setupBusinessExperience();
    document.title = BUSINESS_TITLE;
    document.body.classList.add("landing-mode");
    document.body.classList.remove("console-mode", "console-loading", "console-startup", "business-menu-open", "menu-open", "crawl-moderation-open");
    document.documentElement.classList.remove("console-entry");
    if (consoleLayer) consoleLayer.hidden = true;
    site.hidden = false;
    setMenu(false);
    document.querySelector("#qaAnswer")?.setAttribute("hidden", "");
    document.querySelector("#inspector")?.setAttribute("hidden", "");

    const safeTarget = document.getElementById(targetId) ? targetId : "home";
    if (updateHistory && location.hash !== `#${safeTarget}`) history.pushState({ view: "business" }, "", `#${safeTarget}`);
    requestAnimationFrame(() => {
      document.getElementById(safeTarget)?.scrollIntoView({ behavior: "instant", block: "start" });
      setActiveNav(safeTarget);
    });
  }

  function syncFromLocation() {
    if (isConsoleHash()) {
      if (view !== "console") void openConsole({ updateHistory: false });
      return;
    }
    const targetId = location.hash.slice(1) || "home";
    if (view !== "business") openBusiness(targetId, { updateHistory: false });
  }

  function formatKst(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "확인 불가";
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }

  function escapeBusinessHTML(value = "") {
    return String(value || "")
      .replace(/솔리드다임/g, "솔리다임")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function safeBusinessUrl(value = "", fallback = "#console") {
    const url = String(value || "");
    return /^(https?:\/\/|#)/i.test(url) ? url : fallback;
  }

  function removeBusinessSentenceStops(value = "") {
    return String(value || "")
      .replace(/([A-Za-z\u3131-\u318e\uac00-\ud7a3\d%)\]"'”’])[.\u3002](?=\s|$)/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
  }

  function compactBusinessCopy(value = "", maxCharacters = 96) {
    const original = String(value || "").replace(/\s+/g, " ").trim();
    if (!original) return "";
    const firstSentence = original.split(/(?<=[A-Za-z\u3131-\u318e\uac00-\ud7a3\d%)\]"'”’])[.\u3002](?=\s|$)/, 1)[0];
    let compact = removeBusinessSentenceStops(firstSentence)
      .replace(/\s+(?:이라고|라고)\s+(?:말했습니다|밝혔습니다|설명했습니다)$/u, " 발표")
      .replace(/\s+(?:하고|해오고)\s+있습니다$/u, " 중")
      .replace(/\s+할\s+수\s+있습니다$/u, " 가능")
      .replace(/\s+해야\s+합니다$/u, " 필요")
      .replace(/(?:필요합니다|제안합니다|권고합니다)$/u, (ending) => ({
        "필요합니다": "필요",
        "제안합니다": "제안",
        "권고합니다": "권고",
      })[ending]);
    if (compact.length <= maxCharacters) return compact;
    const clauses = compact.split(/[,;]\s*|\s+(?:그리고|또한|다만)\s+/u).filter(Boolean);
    const selected = [];
    for (const clause of clauses) {
      const candidate = [...selected, clause].join(" · ");
      if (candidate.length > maxCharacters) break;
      selected.push(clause);
    }
    if (selected.length) return selected.join(" · ");
    const boundary = compact.lastIndexOf(" ", maxCharacters - 1);
    return `${compact.slice(0, boundary > 48 ? boundary : maxCharacters - 1).trimEnd()}…`;
  }

  function applyExecutiveCopyStyle(root = site, policy = {}) {
    if (!root) return;
    const paragraphLimit = Number(policy.paragraphMaxCharacters || 116);
    const listLimit = Number(policy.listMaxCharacters || 96);
    const detailLimit = Number(policy.detailMaxCharacters || 88);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    for (const textNode of textNodes) {
      const parent = textNode.parentElement;
      if (!parent || parent.closest("script, style, code, pre, [data-copy-verbatim]")) continue;
      textNode.nodeValue = String(textNode.nodeValue || "")
        .replace(/([A-Za-z\u3131-\u318e\uac00-\ud7a3\d%)\]"'”’])[.\u3002](?=\s|$)/g, "$1");
    }
    for (const node of root.querySelectorAll("p, li, dd, figcaption")) {
      if (node.childElementCount || node.closest("[data-copy-verbatim]")) continue;
      const original = node.textContent.replace(/\s+/g, " ").trim();
      const limit = node.matches("li") ? listLimit : node.matches("dd, figcaption") ? detailLimit : paragraphLimit;
      const compact = compactBusinessCopy(original, limit);
      if (compact !== original) {
        if (!node.hasAttribute("aria-label")) node.setAttribute("aria-label", original);
        node.textContent = compact;
        node.classList.add("business-copy-condensed");
      }
      if (node.matches("p") && compact.length >= 48 && !node.closest("li, .business-kicker, .eyebrow, header, footer")) {
        node.classList.add("business-copy-point");
      }
    }
  }

  function renderBusinessList(node, items = []) {
    if (!node || !Array.isArray(items) || !items.length) return;
    node.innerHTML = items.map((item) => `<li>${escapeBusinessHTML(compactBusinessCopy(item, 96))}</li>`).join("");
  }

  function renderDecisionContent(content = {}) {
    for (const decision of content.decisionCases || []) {
      const panel = document.querySelector(`[data-decision-panel="${CSS.escape(decision.panelId || "")}"]`);
      if (!panel) continue;
      const tab = document.querySelector(`[data-decision-tab="${CSS.escape(decision.panelId || "")}"]`);
      if (tab) tab.textContent = `${decision.index || ""} · ${decision.tabLabel || decision.title}`;
      const answer = panel.querySelector(":scope > .business-decision-answer");
      const answerLabel = answer?.querySelector("div > span");
      const answerTitle = answer?.querySelector("h3");
      const answerBullets = answer?.querySelector(".business-answer-bullets");
      const recommendation = answer?.querySelector(":scope > strong");
      if (answerLabel) answerLabel.textContent = `EXECUTIVE ANSWER · ${decision.phase || "CURRENT"}`;
      if (answerTitle) answerTitle.textContent = decision.answerTitle || decision.decision;
      renderBusinessList(answerBullets, [
        decision.latest?.summary,
        decision.decision,
        `판단 변경 조건 · ${decision.stop}`,
      ].filter(Boolean));
      if (recommendation) recommendation.innerHTML = `RECOMMENDATION<br>${escapeBusinessHTML(decision.recommendation || "CONDITIONAL")}`;
      let hypothesisBadge = answer?.querySelector(":scope > .business-hypothesis-badge");
      if (answer && !hypothesisBadge) {
        hypothesisBadge = document.createElement("span");
        hypothesisBadge.className = "business-hypothesis-badge";
        answer.appendChild(hypothesisBadge);
      }
      if (hypothesisBadge) {
        const isUnverified = decision.hypothesis?.status !== "verified";
        hypothesisBadge.hidden = !isUnverified;
        hypothesisBadge.textContent = `! · ${decision.hypothesis?.label || "근거 미검증"}`;
        hypothesisBadge.title = decision.hypothesis?.scope || "전략 가설은 고객 내부 근거 확인 전입니다.";
      }

      const live = panel.querySelector(":scope > .business-live-evidence");
      const liveTitle = live?.querySelector("[data-live-title]");
      const liveSummary = live?.querySelector("[data-live-summary]");
      const liveSource = live?.querySelector("[data-live-source]");
      if (liveTitle) liveTitle.textContent = decision.latest?.title || "최신 근거 확인 필요";
      if (liveSummary) liveSummary.textContent = decision.latest?.summary || "검증된 근거가 수집되면 자동 갱신됩니다.";
      if (liveSource) {
        liveSource.href = safeBusinessUrl(decision.latest?.url, decision.deepLink || "#console");
        if (/^https?:/i.test(liveSource.href)) {
          liveSource.target = "_blank";
          liveSource.rel = "noopener noreferrer";
        }
        liveSource.textContent = `${decision.latest?.source || "Console"} · ${String(decision.latest?.publishedAt || "").slice(0, 10) || "기준일 확인"} ↗`;
      }

      const stop = panel.querySelector(":scope > .business-delivery-grid > aside p");
      if (stop) stop.textContent = decision.stop;
      const footerModel = panel.querySelector(":scope > .business-decision-footer div strong");
      if (footerModel && decision.partners?.length) footerModel.textContent = decision.partners.join(" · ");
      const footerLink = panel.querySelector(":scope > .business-decision-footer a");
      if (footerLink) footerLink.href = safeBusinessUrl(decision.deepLink);
    }
  }

  function scheduleIdleStep(task, timeout = 420) {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(task, { timeout });
    } else {
      window.setTimeout(() => task({ didTimeout: true, timeRemaining: () => 0 }), 72);
    }
  }

  function scheduleConsoleAssetWarmup() {
    if (consoleWarmupStarted || isConsoleHash()) return;
    consoleWarmupStarted = true;
    const resources = [
      ["consoleStylesPreload", "style", `assets/css/styles.min.css?v=${CONSOLE_REVISION}`],
      ["consoleAppPreload", "script", `assets/js/app.min.js?v=${CONSOLE_REVISION}`],
      ["consolePosterPreload", "image", "assets/media/memory-hero-poster.webp"],
    ];
    let cursor = 0;
    const warmNext = () => scheduleIdleStep(() => {
      const resource = resources[cursor++];
      if (resource) ensureResourceHint(resource[0], "prefetch", resource[1], resource[2], "low");
      if (cursor < resources.length) warmNext();
      else document.body.dataset.consoleWarmup = "ready";
    }, 650);
    warmNext();
  }

  function renderOrganizationOperatingModel(content = {}) {
    const model = content.organizationOperatingModel;
    if (!model) return;
    const title = document.querySelector("#teamOperatingTitle");
    const thesis = document.querySelector("#teamOperatingThesis");
    if (title) title.textContent = model.title || title.textContent;
    if (thesis) thesis.textContent = model.thesis || thesis.textContent;

    const loop = document.querySelector("#teamDecisionLoop");
    if (loop && model.decisionLoop?.length) {
      loop.innerHTML = model.decisionLoop.map((step, index) => `<li><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeBusinessHTML(step)}</strong></li>`).join("");
    }

    const workstreams = document.querySelector("#teamWorkstreams");
    if (workstreams && model.workstreams?.length) {
      workstreams.innerHTML = model.workstreams.map((item) => `
        <article data-team-workstream="${escapeBusinessHTML(item.id)}" tabindex="0">
          <header><span>${escapeBusinessHTML(item.index)} · ${escapeBusinessHTML(item.label)}</span><b>${escapeBusinessHTML(item.index)}</b></header>
          <h3>${escapeBusinessHTML(item.title)}</h3>
          <p>${escapeBusinessHTML(item.mandate)}</p>
          <dl>
            <div><dt>INPUT</dt><dd>${escapeBusinessHTML((item.inputs || []).join(" · "))}</dd></div>
            <div><dt>KEY QUESTIONS</dt><dd><ul>${(item.questions || []).map((question) => `<li>${escapeBusinessHTML(question)}</li>`).join("")}</ul></dd></div>
            <div><dt>OUTPUT</dt><dd>${escapeBusinessHTML((item.outputs || []).join(" · "))}</dd></div>
            <div class="business-team-gate"><dt>DECISION GATE</dt><dd>${escapeBusinessHTML(item.gate)}</dd></div>
          </dl>
          <footer><small>KPI</small><strong>${escapeBusinessHTML((item.kpis || []).join(" · "))}</strong></footer>
        </article>`).join("");
    }

  }

  function renderDecisionAutomation(content = {}) {
    const automation = content.decisionIntelligence?.decisionAutomation;
    if (!automation) return;
    const funnel = automation.funnel || {};
    const catalog = automation.catalogCoverage || {};
    const state = document.querySelector("#decisionAutomationState");
    const asOf = document.querySelector("#decisionAutomationAsOf");
    const catalogCoverage = document.querySelector("#decisionCatalogCoverage");
    const claimEvents = document.querySelector("#decisionClaimEvents");
    const verifiedEvents = document.querySelector("#decisionVerifiedEvents");
    const readyBriefs = document.querySelector("#decisionReadyBriefs");
    if (state) state.textContent = String(automation.state || "MONITORING").replaceAll("_", " ");
    if (asOf) asOf.textContent = `${formatKst(content.generatedAt)} · Run ${String(content.runId || "-").slice(0, 14)}`;
    if (catalogCoverage) catalogCoverage.textContent = `${catalog.observed || 0} / ${catalog.configured || 0}`;
    if (claimEvents) claimEvents.textContent = `${funnel.structuredEvents || 0}건`;
    if (verifiedEvents) verifiedEvents.textContent = `${funnel.verifiedEvents || 0}건`;
    if (readyBriefs) readyBriefs.textContent = `${funnel.decisionReadyBriefs || 0} / ${(automation.briefs || []).length || 0}`;

    const briefs = document.querySelector("#decisionAutomationBriefs");
    if (briefs && automation.briefs?.length) {
      briefs.innerHTML = automation.briefs.map((brief, index) => {
        const source = (brief.evidence || []).find((item) => item.url);
        const sourceLink = source
          ? `<a href="${escapeBusinessHTML(safeBusinessUrl(source.url, "console/"))}" target="_blank" rel="noopener noreferrer">${escapeBusinessHTML(source.source || "원문")} · ${escapeBusinessHTML(String(source.publishedAt || "").slice(0, 10) || "기준일 확인")} ↗</a>`
          : `<span>구조화 Event 관측 대기</span>`;
        return `<article tabindex="0" data-decision-brief="${escapeBusinessHTML(brief.id)}">
          <header><span>${String(index + 1).padStart(2, "0")} · ${escapeBusinessHTML(brief.label)}</span><b>${escapeBusinessHTML(String(brief.status || "MONITORING").replaceAll("_", " "))}</b></header>
          <h3>${escapeBusinessHTML(brief.whatChanged || brief.hypothesis)}</h3>
          <ul><li>${escapeBusinessHTML(brief.customerPain)}</li><li>${escapeBusinessHTML(brief.hypothesis)}</li><li>90D · ${escapeBusinessHTML(brief.action90d)}</li></ul>
          <div class="decision-os-brief-meta"><span>STAGE · ${escapeBusinessHTML(brief.stage || "MONITORING")}</span><span>PRIMARY · ${Number(brief.primaryEvidence || 0)}</span><span>SOURCES · ${Number(brief.independentSources || 0)}</span>${sourceLink}</div>
          <footer><small>KILL CRITERIA</small><strong>${escapeBusinessHTML(brief.killCriteria)}</strong></footer>
        </article>`;
      }).join("");
    }
  }

  function renderCurrentInsights(content = {}) {
    const insights = (content.insights || []).slice(0, 3);
    const grid = document.querySelector(".business-execution-evidence-grid");
    if (grid && insights.length) {
      grid.innerHTML = insights.map((item) => {
        const latest = item.latest || {};
        const href = safeBusinessUrl(latest.url, "#console");
        return `
          <article tabindex="0" data-current-insight="${escapeBusinessHTML(item.id)}">
            <div><span>${escapeBusinessHTML(item.label)}</span><b>${escapeBusinessHTML(latest.evidenceLevel || "WATCH")} · ${escapeBusinessHTML(String(latest.sourceClass || "SOURCE").toUpperCase())}</b></div>
            <h4>${escapeBusinessHTML(latest.title || item.label)}</h4>
            <dl><div><dt>SOURCE</dt><dd>${escapeBusinessHTML(latest.source || "확인 필요")}</dd></div><div><dt>AS OF</dt><dd>${escapeBusinessHTML(String(latest.publishedAt || "").slice(0, 10) || "확인 필요")}</dd></div><div><dt>EVIDENCE</dt><dd>${escapeBusinessHTML(item.evidenceCount || 0)}건</dd></div></dl>
            ${item.hypothesis?.status !== "verified" ? `<span class="business-hypothesis-badge" title="${escapeBusinessHTML(item.hypothesis?.scope || "전략 가설")}">! · ${escapeBusinessHTML(item.hypothesis?.label || "근거 미검증")}</span>` : ""}
            <ol class="business-evidence-decision-path">
              <li><span>01 · FACT</span><strong>${escapeBusinessHTML(item.fact)}</strong></li>
              <li><span>02 · IMPLICATION</span><strong>${escapeBusinessHTML(item.implication)}</strong></li>
              <li><span>03 · DECISION</span><strong>${escapeBusinessHTML(item.decision)}</strong></li>
              <li><span>04 · ACTION / KILL</span><strong>${escapeBusinessHTML(item.action)}</strong></li>
            </ol>
            <a href="${escapeBusinessHTML(href)}" target="_blank" rel="noopener noreferrer">${escapeBusinessHTML(latest.source || "원문")} · ${escapeBusinessHTML(String(latest.publishedAt || "").slice(0, 10) || "기준일 확인")} ↗</a>
          </article>`;
      }).join("");
      const caveat = document.querySelector(".business-execution-evidence > .business-evidence-caveat");
      if (caveat) caveat.textContent = `최신 검증 실행 ${content.runId || "확인 필요"}에서 승격된 근거만 표시합니다. 전망·추정은 확정 계약·고객 성과와 분리하며 판단 변경 KPI를 함께 추적합니다.`;
    }

    const proofline = document.querySelector(".business-tech-proofline");
    if (proofline && insights.length) {
      proofline.innerHTML = insights.slice(0, 2).map((item) => `
        <div><span>${escapeBusinessHTML(item.latest?.evidenceLevel || "WATCH")} · CURRENT EVIDENCE</span><strong>${escapeBusinessHTML(item.latest?.title || item.label)}</strong><a href="${escapeBusinessHTML(safeBusinessUrl(item.latest?.url, "#console"))}" target="_blank" rel="noopener noreferrer">${escapeBusinessHTML(item.latest?.source || "원문")} ↗</a></div>
      `).join("");
    }

    const primarySourceNote = document.querySelector(".business-memory-fabric .business-source-note");
    const primaryInsight = insights[0];
    if (primarySourceNote && primaryInsight) {
      const label = primarySourceNote.querySelector("span");
      const link = primarySourceNote.querySelector("a");
      const time = primarySourceNote.querySelector("time");
      if (label) label.textContent = `${primaryInsight.latest?.evidenceLevel || "WATCH"} · CURRENT`;
      if (link) {
        link.href = safeBusinessUrl(primaryInsight.latest?.url, "#console");
        link.textContent = `${primaryInsight.latest?.source || "원문"} · ${primaryInsight.latest?.title || primaryInsight.label} ↗`;
      }
      if (time) {
        const date = String(primaryInsight.latest?.publishedAt || content.generatedAt || "").slice(0, 10);
        time.dateTime = date;
        time.textContent = date || "기준일 확인";
      }
    }

    const storageSources = document.querySelector(".business-storage-sources");
    const storageInsights = (content.insights || []).filter((item) => ["nand", "demand"].includes(item.id)).slice(0, 2);
    if (storageSources && storageInsights.length) {
      storageSources.innerHTML = storageInsights.map((item) => `<a href="${escapeBusinessHTML(safeBusinessUrl(item.latest?.url, "#console"))}" target="_blank" rel="noopener noreferrer">${escapeBusinessHTML(item.latest?.evidenceLevel || "WATCH")} · ${escapeBusinessHTML(item.latest?.title || item.label)} ↗</a>`).join("");
    }

    const worked = document.querySelector("#tco-evidence");
    const workedInsight = (content.insights || []).find((item) => item.id === "demand") || (content.insights || [])[0];
    if (worked && workedInsight) {
      const workedTitle = worked.querySelector(".business-evidence-title h3");
      if (workedTitle) workedTitle.textContent = `${workedInsight.label} → AI Infra 투자 Gate`;
      const rows = [...worked.querySelectorAll(".business-evidence-case-framework > li")];
      const values = [
        ["FACT · CURRENT", workedInsight.latest?.title, workedInsight.latest?.summary],
        ["BUSINESS IMPLICATION", workedInsight.implication, "고객 Workload와 Memory Architecture에 미치는 영향을 분리 검증합니다."],
        ["DECISION QUESTION", workedInsight.decision, "선택지·사업성·Right to Win을 동일 근거에서 비교합니다."],
        ["ACTION / KILL GATE", workedInsight.action, "Owner·KPI·다음 검증 시점을 실행 보드에 연결합니다."],
      ];
      rows.forEach((row, index) => {
        const [label, title, copy] = values[index] || [];
        if (!label) return;
        const small = row.querySelector("small");
        const strong = row.querySelector("strong");
        const paragraph = row.querySelector("p");
        if (small) small.textContent = label;
        if (strong) strong.textContent = title || "검증 중";
        if (paragraph) {
          if (index === 0 && workedInsight.latest?.url) paragraph.innerHTML = `<a href="${escapeBusinessHTML(safeBusinessUrl(workedInsight.latest.url))}" target="_blank" rel="noopener noreferrer">${escapeBusinessHTML(workedInsight.latest.source || "원문")} · ${escapeBusinessHTML(String(workedInsight.latest.publishedAt || "").slice(0, 10))} ↗</a>`;
          else paragraph.textContent = copy;
        }
      });
      const workedCaveat = worked.querySelector(":scope > p");
      if (workedCaveat) workedCaveat.textContent = "공개 근거와 전략 가설을 분리하고, 고객 Baseline·Qualification·반복 발주가 확인될 때만 다음 투자 Gate로 승격합니다.";
    }
  }

  function renderAIFactorySystem(content = {}) {
    const system = content.aiFactorySystem;
    if (!system) return;
    const title = document.querySelector("#aiFactorySystemTitle");
    const thesis = document.querySelector("#aiFactorySystemThesis");
    const status = document.querySelector("#aiFactoryAutomationStatus");
    if (title) title.textContent = system.title || title.textContent;
    if (thesis) thesis.textContent = system.thesis || thesis.textContent;
    if (status) status.textContent = `${system.automation?.status || "COVERAGE CHECK"} · ${system.automation?.activePillars || 0}/${system.automation?.totalPillars || 0} PILLARS · ${system.automation?.activeWorkloads || 0}/${system.automation?.totalWorkloads || 0} CONNECTED · ${system.automation?.promotedWorkloads || 0} PROMOTED · EVENT + ${system.automation?.scheduleHours || 1}H`;

    const northStar = document.querySelector("#aiFactoryNorthStar");
    if (northStar && system.northStar) {
      northStar.innerHTML = `<span>${escapeBusinessHTML(system.northStar.label || "NORTH STAR")}</span><strong>${escapeBusinessHTML(system.northStar.formula || "Useful AI Work / Total Cost")}</strong><small>${escapeBusinessHTML(system.northStar.training || "")} · ${escapeBusinessHTML(system.northStar.inference || "")}</small>`;
    }

    const layers = document.querySelector("#aiFactoryLayers");
    if (layers && system.architectureLayers?.length) {
      layers.innerHTML = system.architectureLayers.map((layer) => `<article data-system-layer="${escapeBusinessHTML(layer.id)}"><span>${escapeBusinessHTML(layer.index)}</span><div><small>${escapeBusinessHTML(layer.label)}</small><strong>${escapeBusinessHTML(layer.title)}</strong><p>${escapeBusinessHTML(layer.decision)}</p></div></article>`).join("");
    }

    const workloads = document.querySelector("#aiFactoryWorkloads");
    if (workloads && system.workloads?.length) {
      workloads.innerHTML = system.workloads.map((workload) => {
        const evidence = workload.evidence || {};
        const evidenceMeta = `${String(evidence.status || "coverage-gap").toUpperCase()}${evidence.publishedAt ? ` · ${String(evidence.publishedAt).slice(0, 10)}` : ""}`;
        const evidenceNode = evidence.url
          ? `<a href="${escapeBusinessHTML(safeBusinessUrl(evidence.url, "#console"))}" target="_blank" rel="noopener noreferrer">${escapeBusinessHTML(evidenceMeta)} ↗</a>`
          : `<em>${escapeBusinessHTML(evidenceMeta)}</em>`;
        return `<article data-workload="${escapeBusinessHTML(workload.id)}"><header><span>${escapeBusinessHTML(workload.label)}</span>${evidenceNode}</header><strong>${escapeBusinessHTML(workload.northStar)}</strong><p>${escapeBusinessHTML((workload.bottlenecks || []).join(" · "))}</p><small>${escapeBusinessHTML((workload.kpis || []).join(" · "))}</small><footer>${escapeBusinessHTML(workload.capacityMode || "Capacity 경로 검증")}</footer></article>`;
      }).join("");
    }

    const workloadMatrix = document.querySelector("#workloadMatrix");
    if (workloadMatrix && system.workloads?.length) {
      workloadMatrix.innerHTML = system.workloads.map((workload, index) => {
        const evidence = workload.evidence || {};
        const evidenceLine = evidence.url
          ? `<a href="${escapeBusinessHTML(safeBusinessUrl(evidence.url, "#console"))}" target="_blank" rel="noopener noreferrer">${escapeBusinessHTML(evidence.source || "원문")} · ${escapeBusinessHTML(String(evidence.publishedAt || "").slice(0, 10) || "기준일 확인")} ↗</a>`
          : `<span>${escapeBusinessHTML(evidence.title || "최신 근거 관측 대기")}</span>`;
        return `<article data-workload-contract="${escapeBusinessHTML(workload.id)}"><span>${String(index + 1).padStart(2, "0")} · ${escapeBusinessHTML(workload.label)}</span><h4>${escapeBusinessHTML(workload.northStar)}</h4><dl><div><dt>BOTTLENECK</dt><dd>${escapeBusinessHTML((workload.bottlenecks || []).join(" · "))}</dd></div><div><dt>KPI CONTRACT</dt><dd>${escapeBusinessHTML((workload.kpis || []).join(" · "))}</dd></div><div><dt>CAPACITY PATH</dt><dd>${escapeBusinessHTML(workload.capacityMode || "검증 후 결정")}</dd></div><div><dt>LIVE EVIDENCE</dt><dd>${evidenceLine}</dd></div></dl></article>`;
      }).join("");
    }

    const demandShift = document.querySelector("#aiFactoryDemandShift");
    if (demandShift && system.demandShift) {
      const forecast = system.demandShift;
      const evidence = forecast.evidence || {};
      const evidenceNode = evidence.url
        ? `<a href="${escapeBusinessHTML(safeBusinessUrl(evidence.url, "#console"))}" target="_blank" rel="noopener noreferrer">${escapeBusinessHTML(evidence.source || "원문")} · ${escapeBusinessHTML(String(evidence.publishedAt || "").slice(0, 10))} ↗</a>`
        : `<em>COVERAGE GAP · 다음 증분 수집에서 전망 근거 재확인</em>`;
      demandShift.innerHTML = `<span>${escapeBusinessHTML(forecast.label || "DEMAND TRANSITION · FORECAST")}</span><strong>${escapeBusinessHTML(forecast.hypothesis || "수요 전환을 지속 관측")}</strong><p>${escapeBusinessHTML(forecast.decision || "Workload 수요로 Capacity Mix 조정")}</p><small>${escapeBusinessHTML(forecast.guardrail || "전망과 실적 분리")} · ${evidenceNode}</small>`;
    }

    const sequence = document.querySelector("#aiFactorySequence");
    if (sequence && system.decisionSequence?.length) {
      sequence.innerHTML = system.decisionSequence.map((step, index) => `<li><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeBusinessHTML(step)}</strong></li>`).join("");
    }

    const roadmap = document.querySelector("#aiFactoryRoadmap");
    if (roadmap && system.roadmap?.length) {
      roadmap.innerHTML = system.roadmap.map((phase) => `<li><span>${escapeBusinessHTML(phase.phase)}</span><strong>${escapeBusinessHTML(phase.goal)}</strong><p>${escapeBusinessHTML(phase.gate)}</p></li>`).join("");
    }

    const accelerator = document.querySelector("#acceleratorScorecard");
    if (accelerator && system.acceleratorDecision) {
      const matrix = system.acceleratorDecision;
      const score = accelerator.querySelector(":scope > div");
      const copy = accelerator.querySelector("header p");
      const footer = accelerator.querySelector("footer");
      if (copy) copy.textContent = matrix.guardrail || copy.textContent;
      if (score) score.innerHTML = (matrix.criteria || []).map((item) => `<b style="--weight:${Number(item.weight || 0)}"><span>${escapeBusinessHTML(String(item.weight || 0))}</span><small>${escapeBusinessHTML(item.label)}</small></b>`).join("");
      if (footer) footer.textContent = `${(matrix.supplyLayers || []).join(" · ")} · 합계 ${matrix.totalWeight || 0}점 · 벤더 Peak 수치는 조건 불일치 시 Watch`;
    }

    const kpiTree = document.querySelector("#aiFactoryKpiTree");
    if (kpiTree && system.kpiTree) {
      const groups = [["BUSINESS", system.kpiTree.business], ["APPLICATION", system.kpiTree.application], ["PLATFORM", system.kpiTree.platform], ["FACILITY", system.kpiTree.facility]];
      const grid = kpiTree.querySelector(":scope > div");
      const formula = kpiTree.querySelector(":scope > p");
      if (grid) grid.innerHTML = groups.map(([label, items]) => `<article><small>${escapeBusinessHTML(label)}</small><strong>${escapeBusinessHTML((items || []).join(" · "))}</strong></article>`).join("");
      if (formula) formula.textContent = (system.kpiTree.formulas || []).join(" · ");
    }

    const signals = document.querySelector("#aiFactorySignals");
    if (signals) {
      if (system.signals?.length) {
        signals.innerHTML = system.signals.map((signal) => `<a href="${escapeBusinessHTML(safeBusinessUrl(signal.url, "#console"))}" target="_blank" rel="noopener noreferrer"><small>${escapeBusinessHTML(signal.pillarLabel)} · ${escapeBusinessHTML(String(signal.evidenceLevel || "WATCH").toUpperCase())}</small><strong>${escapeBusinessHTML(signal.title)}</strong><span>${escapeBusinessHTML(signal.source)} · ${escapeBusinessHTML(String(signal.publishedAt || "").slice(0, 10))} ↗</span></a>`).join("");
      } else {
        signals.innerHTML = `<p>현재 실행 ${escapeBusinessHTML(system.runId || content.runId || "확인 필요")}에서 승격된 시스템 신호가 없습니다. 마지막 검증본을 유지하고 Coverage Gap을 공개합니다.</p>`;
      }
    }

    const note = document.querySelector("#aiFactoryEvidenceNote");
    if (note && system.evidencePolicy?.length) note.textContent = system.evidencePolicy.join(" · ");
  }

  function renderWorkloadOptimization(content = {}) {
    const workload = content.workloadOptimization;
    if (!workload) return;
    const title = document.querySelector("#workloadOptimizationTitle");
    const thesis = document.querySelector("#workloadOptimizationThesis");
    if (title) title.textContent = workload.title || title.textContent;
    if (thesis) thesis.textContent = workload.thesis || thesis.textContent;

    const process = document.querySelector("#workloadConsultingProcess");
    if (process && workload.process?.length) {
      process.innerHTML = workload.process.map((step) => `
        <li>
          <span>${escapeBusinessHTML(step.index)}</span>
          <div><small>${escapeBusinessHTML(step.label)}</small><strong>${escapeBusinessHTML(step.title)}</strong><ul>${(step.bullets || []).map((item) => `<li>${escapeBusinessHTML(item)}</li>`).join("")}</ul></div>
        </li>`).join("");
    }

    const services = document.querySelector("#workloadServiceLines");
    if (services && workload.serviceLines?.length) {
      services.innerHTML = workload.serviceLines.map((service) => `
        <article data-workload-service="${escapeBusinessHTML(service.id)}">
          <span>${escapeBusinessHTML(service.label)}</span>
          <h4>${escapeBusinessHTML(service.title)}</h4>
          <dl>
            <div><dt>PAIN</dt><dd>${escapeBusinessHTML(service.pain)}</dd></div>
            <div><dt>HYPOTHESIS</dt><dd>${escapeBusinessHTML(service.hypothesis)}</dd></div>
            <div><dt>KPI</dt><dd>${escapeBusinessHTML((service.metrics || []).join(" · "))}</dd></div>
            <div><dt>KILL</dt><dd>${escapeBusinessHTML(service.killCriteria)}</dd></div>
          </dl>
        </article>`).join("");
    }

    renderBusinessList(document.querySelector("#workloadEvidencePolicy"), workload.evidencePolicy);
    const sources = document.querySelector("#workloadEvidenceSources");
    if (sources && workload.sources?.length) {
      const signals = new Map((workload.currentSignals || []).map((signal) => [signal.sourceId, signal]));
      sources.innerHTML = workload.sources.map((source) => {
        const signal = signals.get(source.id);
        const detail = signal?.title || (source.topics || []).slice(0, 3).join(" · ");
        return `<a href="${escapeBusinessHTML(safeBusinessUrl(signal?.url || source.url, "#console"))}" target="_blank" rel="noopener noreferrer">
          <span>${escapeBusinessHTML(String(source.status || "monitoring").toUpperCase())} · ${escapeBusinessHTML(String(source.sourceClass || "source").toUpperCase())}</span>
          <strong>${escapeBusinessHTML(source.name)}</strong>
          <small>${escapeBusinessHTML(detail)} ↗</small>
        </a>`;
      }).join("");
    }

    const control = document.querySelector(".business-workload-evidence > div:first-child p");
    if (control) {
      const signalCount = Number(workload.currentSignals?.length || 0);
      control.textContent = `검증 실행 ${workload.runId || content.runId || "확인 필요"} · 현재 승격 신호 ${signalCount}건. 실제 협업·검증 사례와 향후 운영 모델을 분리하고, 조건 없는 성능 배수·가격·시장 수치는 게시하지 않습니다.`;
    }

    const rag = workload.ragOperatingModel || {};
    const ragTitle = document.querySelector("#ragOperatingModelTitle");
    const ragControl = document.querySelector("#ragLiveControl");
    const ragPipeline = document.querySelector("#ragQualityPipeline");
    const ragMaturity = document.querySelector("#ragMaturity");
    const ragKpis = document.querySelector("#ragQualityKpis");
    if (ragTitle && rag.title) ragTitle.textContent = rag.title;
    if (ragControl) ragControl.textContent = `FRESHNESS ${Math.round(Number(rag.liveControl?.freshnessScore || 0))}/100 · ${String(rag.liveControl?.freshnessStatus || "pending").toUpperCase()} · CITE ${Math.round(Number(rag.liveControl?.citationCoveragePct || 0))}%`;
    if (ragPipeline && rag.pipeline?.length) ragPipeline.innerHTML = rag.pipeline.map((step, index) => `<li><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeBusinessHTML(step)}</strong></li>`).join("");
    if (ragMaturity && rag.maturity?.length) ragMaturity.innerHTML = rag.maturity.map((level) => `<article><b>${escapeBusinessHTML(level.level)}</b><strong>${escapeBusinessHTML(level.title)}</strong><small>${escapeBusinessHTML(level.gate)}</small></article>`).join("");
    if (ragKpis) ragKpis.textContent = `${(rag.qualityKpis || []).join(" · ")} · Indexed ${rag.liveControl?.indexedAt ? String(rag.liveControl.indexedAt).slice(0, 16).replace("T", " ") : "확인 중"}`;
  }

  function renderCompetitorContent(content = {}) {
    const competitors = content.competitors || [];
    if (!competitors.length) return;
    const metricPolicy = content.decisionIntelligence || {};
    const heading = document.querySelector(".business-competitor-benchmark .business-module-heading p");
    if (heading) heading.textContent = `${competitors.map((item) => item.asOf).filter(Boolean)[0] || String(content.generatedAt || "").slice(0, 10)} 기준 · 동일 분모·동일 기간 비교 · 기관 차이는 RANGE로 자동 공개 · ${String(metricPolicy.status || "pending").toUpperCase()}`;
    const grid = document.querySelector(".business-competitor-grid");
    if (!grid) return;
    grid.innerHTML = competitors.map((item) => {
      const hasYearAgo = Number.isFinite(Number(item.trend?.yearAgoChangePctPoint));
      const delta = Number(hasYearAgo ? item.trend?.yearAgoChangePctPoint : item.trend?.changePctPoint);
      const trend = Number.isFinite(delta)
        ? `${delta > 0 ? "+" : ""}${delta.toFixed(1).replace(/\.0$/, "")}%p · ${hasYearAgo ? "YoY" : item.trend?.priorPeriod || "이전"}`
        : "새 관측";
      return `
      <article>
        <header><span>${escapeBusinessHTML(item.company)}</span><strong>${escapeBusinessHTML(item.dataStatus || "review")}</strong></header>
        <dl><div><dt>HBM SHARE</dt><dd>${escapeBusinessHTML(item.hbmShare || "미공개")}</dd></div><div><dt>TREND</dt><dd>${escapeBusinessHTML(trend)}</dd></div><div><dt>DRAM SHARE</dt><dd>${escapeBusinessHTML(item.dramShare || "미공개")}</dd></div><div><dt>SOURCES</dt><dd>${escapeBusinessHTML(String(item.trend?.sourceCount || 0))}</dd></div><div><dt>AS OF</dt><dd>${escapeBusinessHTML(item.asOf || "확인 필요")}</dd></div></dl>
        <div><a href="${escapeBusinessHTML(safeBusinessUrl(item.sourceUrl, "#console"))}" target="_blank" rel="noopener noreferrer">${escapeBusinessHTML(item.source || "근거") } ↗</a></div>
      </article>`;
    }).join("");
  }

  function renderCaseClassification(content = {}) {
    const target = document.querySelector("#caseClassification");
    if (!target || !content.caseClassification?.length) return;
    target.innerHTML = content.caseClassification.map((item, index) => `
      <article data-case-classification="${escapeBusinessHTML(item.id || "case")}">
        <span>${String(index + 1).padStart(2, "0")} · ${escapeBusinessHTML(item.label)}</span>
        <p>${escapeBusinessHTML(item.description)}</p>
      </article>`).join("");
  }

  function applyDecisionControl(content = {}) {
    const control = content.decisionControl || {};
    const integrity = document.querySelector("#businessDataIntegrity");
    const freshness = document.querySelector("#businessDataFreshness");
    const coverage = document.querySelector("#businessDataCoverage");
    const confidence = document.querySelector("#businessDecisionConfidence");
    const ragQuality = document.querySelector("#businessRagQuality");
    if (integrity) integrity.textContent = `INTEGRITY · ${control.integrity?.status || "CHECK"}`;
    const freshnessControl = content.decisionIntelligence?.freshness || {};
    const hasFreshnessScore = ["current", "warning", "degraded"].includes(freshnessControl.status) && Number.isFinite(Number(freshnessControl.score));
    const score = hasFreshnessScore ? Math.max(0, Math.min(100, Number(freshnessControl.score))) : 0;
    const scoreText = hasFreshnessScore ? String(Math.round(score)) : "--";
    if (freshness) {
      freshness.textContent = `FRESHNESS · ${scoreText}/100 · ${String(freshnessControl.status || "PENDING").toUpperCase()}`;
      freshness.dataset.state = freshnessControl.status || "pending";
    }
    if (coverage) coverage.textContent = `COVERAGE · ${control.coverage?.status || "CHECK"}`;
    if (confidence) confidence.textContent = `CONFIDENCE · ${control.confidence?.status || "CHECK"}`;
    if (ragQuality) {
      const evaluation = content.decisionIntelligence?.evaluation || {};
      ragQuality.textContent = `RAG EVAL · ${String(evaluation.status || "PENDING").toUpperCase()} · CITE ${evaluation.metrics?.citationCoveragePct ?? 0}%`;
    }
    const freshnessBoard = document.querySelector("#businessFreshnessBoard");
    if (freshnessBoard) {
      freshnessBoard.dataset.state = freshnessControl.status || "pending";
      freshnessBoard.style.setProperty("--freshness-score", String(score));
    }
    const scoreNode = document.querySelector("#businessFreshnessScore");
    if (scoreNode) {
      scoreNode.textContent = scoreText;
      scoreNode.parentElement?.setAttribute("aria-label", hasFreshnessScore ? `Freshness Score ${scoreText}점, ${freshnessControl.label || "검증 대기"}` : "Freshness Score 다음 검증 실행 대기");
    }
    const modeNode = document.querySelector("#businessFreshnessMode");
    if (modeNode) modeNode.textContent = freshnessControl.label || "다음 검증 실행 대기";
    const componentNodes = {
      contentAge: "#businessFreshnessAge",
      embeddingLag: "#businessFreshnessLag",
      staleRetrievalRate: "#businessFreshnessStale",
      coverageDrift: "#businessFreshnessDrift",
    };
    for (const [key, selector] of Object.entries(componentNodes)) {
      const node = document.querySelector(selector);
      if (node) node.textContent = hasFreshnessScore ? `${Math.round(Number(freshnessControl.components?.[key] || 0))} / 100` : "--";
    }
    const timestampNodes = {
      lastHumanVerifiedAt: ["#businessHumanVerifiedAt", "미등록 · 자동 검증과 분리"],
      sourceChangeDetectedAt: ["#businessSourceChangedAt", "확인 중"],
      indexedAt: ["#businessIndexedAt", "확인 중"],
    };
    for (const [key, [selector, fallback]] of Object.entries(timestampNodes)) {
      const node = document.querySelector(selector);
      const value = freshnessControl.timestamps?.[key];
      if (node) node.textContent = value ? formatKst(value) : fallback;
    }
  }

  function renderDepartmentHomepage(content = {}) {
    const hero = content.hero || {};
    const workbench = hero.departmentWorkbench || {};
    const proof = document.querySelector(".business-hero-proof");
    if (proof && Array.isArray(hero.workProducts) && hero.workProducts.length) {
      proof.innerHTML = hero.workProducts.map((item, index) => `
        <div data-work-product="${escapeBusinessHTML(item.id || String(index + 1))}">
          <dt>${escapeBusinessHTML(item.index || String(index + 1).padStart(2, "0"))}</dt>
          <dd><small>${escapeBusinessHTML(item.label || "TEAM OUTPUT")}</small><strong>${escapeBusinessHTML(item.title || "전략 산출물")}</strong><span>${escapeBusinessHTML(item.detail || "")}</span></dd>
        </div>`).join("");
    }

    const flow = document.querySelector(".business-architecture-flow");
    if (flow && Array.isArray(hero.workflow) && hero.workflow.length) {
      flow.innerHTML = hero.workflow.map((item, index) => `${index ? '<i aria-hidden="true">↓</i>' : ""}
        <div class="business-flow-node${index === 2 ? " business-flow-node--accent" : ""}">
          <small>${escapeBusinessHTML(item.index || String(index + 1).padStart(2, "0"))} · ${escapeBusinessHTML(item.label || "DECISION STEP")}</small>
          <strong>${escapeBusinessHTML(item.title || "")}</strong>
          <span>${escapeBusinessHTML(item.detail || "")}</span>
        </div>`).join("");
    }
    const output = hero.output || {};
    const outputLabel = document.querySelector(".business-visual-result > span");
    const outputTitle = document.querySelector(".business-visual-result > strong");
    if (outputLabel && output.label) outputLabel.textContent = output.label;
    if (outputTitle && output.title) outputTitle.textContent = output.title;

    const queue = document.querySelector("#businessHomeDecisionQueue");
    if (queue && Array.isArray(workbench.agenda) && workbench.agenda.length) {
      queue.innerHTML = workbench.agenda.map((item, index) => {
        const deepLink = /^#console(?:$|\/)/.test(String(item.deepLink || "")) ? item.deepLink : "#console";
        const evidence = Number(item.evidenceCount || 0);
        const sources = Number(item.independentSources || 0);
        return `<a href="${deepLink}" data-decision-id="${escapeBusinessHTML(item.id || String(index + 1))}" data-state="${escapeBusinessHTML(String(item.state || "monitoring").toLowerCase())}">
          <span>${escapeBusinessHTML(item.index || String(index + 1).padStart(2, "0"))} · ${escapeBusinessHTML(item.label || "AI INFRA DECISION")}</span>
          <strong>${escapeBusinessHTML(item.decisionQuestion || item.whatChanged || "다음 의사결정 질문을 검증합니다.")}</strong>
          <p><b>PAIN</b> · ${escapeBusinessHTML(item.customerPain || "고객 문제 검증 중")}</p>
          <small>OUTPUT · ${escapeBusinessHTML(item.deliverable || "Decision Brief")} · 근거 ${evidence}건/${sources}개 출처</small>
        </a>`;
      }).join("");
    }
    const queueStatus = document.querySelector("#businessHomeQueueStatus");
    if (queueStatus) {
      const freshness = Number(content.decisionIntelligence?.freshness?.score || 0);
      const state = workbench.revalidationRequired ? "재검증 필요" : (workbench.status || "MONITORING");
      queueStatus.textContent = `${state} · Freshness ${Math.round(freshness)}/100 · ${formatKst(workbench.indexedAt || workbench.generatedAt)}`;
    }
  }

  function applySiteContent(content = {}) {
    if (!content?.clientArtifact) return;
    document.documentElement.dataset.contentRun = String(content.runId || "");
    const title = document.querySelector(".business-hero-copy h1");
    if (title && content.hero?.titleLines?.length) {
      const [first, ...rest] = content.hero.titleLines;
      title.innerHTML = `${escapeBusinessHTML(first)}<br><em>${escapeBusinessHTML(rest.join(" "))}</em>`;
    }
    renderBusinessList(document.querySelector(".business-hero-thesis"), content.hero?.thesis);
    renderBusinessList(document.querySelector(".business-hero-bullets"), content.hero?.capabilities);
    renderDepartmentHomepage(content);
    const liveDot = document.querySelector(".business-live-dot");
    if (liveDot) liveDot.textContent = content.hero?.status || "Decision-ready";
    const visualResult = document.querySelector(".business-visual-result small");
    if (visualResult) visualResult.textContent = `검증 실행 ${content.runId || "확인 필요"} · 근거 ${content.freshness?.evidenceCount || 0}건 · 자동 생성 ${formatKst(content.generatedAt)}`;
    const configuredSources = Number(content.freshness?.configuredSources || 0);
    const retrievalStats = content.decisionIntelligence?.retrieval?.stats || {};
    const sourceMetric = document.querySelector("#businessDataSources");
    if (sourceMetric) sourceMetric.textContent = configuredSources
      ? `관측 ${content.freshness?.observedSources || 0} · 구성 ${configuredSources} · 검색 문서 ${retrievalStats.documents || 0} · 증분 ${retrievalStats.reindexed || 0}`
      : "다음 검증 실행 반영";
    const cadence = document.querySelector("#businessDataCadence");
    if (cadence) cadence.textContent = `HYBRID REFRESH · EVENT + ${content.freshness?.scheduleHours || 1}H SAFETY POLL`;
    const staticSnapshot = document.querySelector(".console-static-snapshot header p");
    if (staticSnapshot) staticSnapshot.textContent = content.agentCouncil?.subtitle || staticSnapshot.textContent;

    renderDecisionContent(content);
    renderOrganizationOperatingModel(content);
    renderDecisionAutomation(content);
    renderCurrentInsights(content);
    renderAIFactorySystem(content);
    renderWorkloadOptimization(content);
    renderCompetitorContent(content);
    renderCaseClassification(content);
    applyUniversalSectionBindings(content);
    applyDecisionControl(content);
    applyPresentationPolicy(content.presentation);
    setupConsultingCardMotion();
    applyExecutiveCopyStyle(site, content.presentation?.readabilityPolicy);
    highlightBusinessKeyTerms(site, content.presentation);

    const footer = document.querySelector(".business-footer a");
    if (footer) footer.textContent = `© ${content.footer?.year || new Date().getFullYear()} dicacross · ${content.footer?.disclosure || "Independent strategy portfolio based on public information."}`;
  }

  function applyUniversalSectionBindings(content = {}) {
    const automation = content.siteAutomation || {};
    const runId = String(content.runId || automation.runId || "");
    const groups = automation.bindingGroups || {};
    for (const id of automation.sectionIds || []) {
      const section = document.getElementById(String(id || ""));
      if (!section) continue;
      const primaryArtifact = (groups.quant || []).includes(id)
        ? "quant"
        : (groups.live || []).includes(id)
          ? "live"
          : "siteContent";
      section.dataset.contentRun = runId;
      section.dataset.contentMode = primaryArtifact === "siteContent" ? "framework-plus-live" : "verified-live";
      section.dataset.contentArtifact = primaryArtifact;
      section.dataset.contentStatus = "bound";
      section.dataset.contentUpdatedAt = String(content.generatedAt || "");
    }
    document.body.dataset.automationCoverage = `${Number(automation.boundSections || 0)}/${Number(automation.totalSections || 0)}`;
    document.body.dataset.automationRun = runId;
    document.body.dataset.automationStatus = String(automation.status || "unavailable");
  }

  async function getDataManifest({ force = false } = {}) {
    if (force) manifestPromise = null;
    if (!manifestPromise) {
      manifestPromise = fetch("data/data-manifest.json", { cache: "no-store" }).then((response) => {
        if (!response.ok) throw new Error(`Manifest HTTP ${response.status}`);
        return response.json();
      }).catch((error) => {
        manifestPromise = null;
        throw error;
      });
    }
    return manifestPromise;
  }

  async function loadSiteContent({ force = false } = {}) {
    if (force) siteContentPromise = null;
    if (siteContentPromise) return siteContentPromise;
    siteContentPromise = (async () => {
      const manifest = await getDataManifest({ force });
      const cacheVersion = encodeURIComponent(manifest.cacheVersion || manifest.runId || Date.now());
      const response = await fetch(`${SITE_CONTENT_PATH}?v=${cacheVersion}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Site content HTTP ${response.status}`);
      const content = await response.json();
      if (content?.clientArtifact !== true || !content.runId || content.runId !== manifest.runId) {
        throw new Error("Site content runId mismatch");
      }
      const previousRunId = String(window.MEMORY_SITE_CONTENT?.runId || "");
      if (previousRunId && previousRunId !== String(content.runId) && isConsoleHash()) {
        document.body.dataset.snapshotUpdate = "reloading";
        document.body.dataset.nextAutomationRun = String(content.runId);
        window.location.reload();
        return content;
      }
      window.MEMORY_SITE_CONTENT = content;
      applySiteContent(content);
      window.dispatchEvent(new CustomEvent("memory-site-content-ready", { detail: { runId: content.runId } }));
      return content;
    })().catch((error) => {
      siteContentPromise = null;
      console.warn("Verified site content unavailable; retaining last rendered framework", error);
      window.dispatchEvent(new CustomEvent("memory-site-content-error"));
      return null;
    });
    return siteContentPromise;
  }

  function scheduleSiteContentRefresh() {
    window.clearTimeout(siteContentRefreshTimer);
    const minutes = Math.max(1, Number(window.MEMORY_SITE_CONTENT?.siteAutomation?.refresh?.browserRecheckMinutes
      || window.MEMORY_SITE_CONTENT?.freshness?.browserRecheckMinutes
      || 5));
    siteContentRefreshTimer = window.setTimeout(async () => {
      if (!document.hidden) {
        await loadSiteContent({ force: true });
        void updateDataStatus({ force: true });
      }
      scheduleSiteContentRefresh();
    }, minutes * 60 * 1000);
  }

  function recheckSiteContentNow() {
    if (document.hidden) return;
    void loadSiteContent({ force: true }).then(() => {
      void updateDataStatus({ force: true });
      scheduleSiteContentRefresh();
    });
  }

  async function updateDataStatus({ force = false } = {}) {
    const panel = document.querySelector(".business-data-status");
    const dot = document.querySelector("#businessStatusDot");
    const status = document.querySelector("#businessDataStatus");
    const updated = document.querySelector("#businessDataUpdated");
    const expiry = document.querySelector("#businessDataExpiry");
    const artifacts = document.querySelector("#businessDataArtifacts");
    const sources = document.querySelector("#businessDataSources");
    const run = document.querySelector("#businessDataRun");
    if (!status) return;

    try {
      const manifest = await getDataManifest({ force });
      const expiresAt = new Date(manifest.expiresAt).getTime();
      const current = Number.isFinite(expiresAt) && Date.now() <= expiresAt;
      const decisionControl = window.MEMORY_SITE_CONTENT?.decisionControl || {};
      const evidenceFreshness = window.MEMORY_SITE_CONTENT?.decisionIntelligence?.freshness || {};
      const hasFreshnessScore = ["current", "warning", "degraded"].includes(evidenceFreshness.status) && Number.isFinite(Number(evidenceFreshness.score));
      const scoreText = hasFreshnessScore ? String(Math.round(Number(evidenceFreshness.score))) : "--";
      status.textContent = current
        ? `Integrity ${decisionControl.integrity?.status || "PASS"} · Freshness ${scoreText}/100 ${evidenceFreshness.label || "검증 대기"} · Confidence ${decisionControl.confidence?.status || "CHECK"}`
        : "Update delayed · freshness gate exceeded · last verified bundle retained";
      dot?.classList.toggle("is-current", current);
      dot?.classList.toggle("is-delayed", !current);
      if (updated) updated.textContent = formatKst(manifest.generatedAt);
      if (expiry) expiry.textContent = formatKst(manifest.expiresAt);
      if (artifacts) artifacts.textContent = `${Object.keys(manifest.artifacts || {}).length} datasets`;
      if (run) run.textContent = String(manifest.runId || "unavailable").slice(0, 18);
      const freshnessBadge = document.querySelector("#businessDataFreshness");
      if (freshnessBadge) freshnessBadge.textContent = current
        ? `FRESHNESS · ${scoreText}/100 · ${String(evidenceFreshness.status || "PENDING").toUpperCase()}`
        : `FRESHNESS · ${scoreText}/100 · DELAYED`;
      if (panel) panel.hidden = false;
    } catch (error) {
      console.warn("Data freshness status unavailable", error);
      status.textContent = "Status unavailable · fail-closed";
      dot?.classList.remove("is-current");
      dot?.classList.add("is-delayed");
      if (updated) updated.textContent = "마지막 검증 Bundle 유지";
      if (expiry) expiry.textContent = "Console에서 재확인";
      if (artifacts) artifacts.textContent = "새 게시 중단";
      if (sources) sources.textContent = "검증본 유지";
      if (run) run.textContent = "unavailable";
      for (const id of ["businessDataIntegrity", "businessDataFreshness", "businessDataCoverage", "businessDecisionConfidence", "businessRagQuality"]) {
        const badge = document.getElementById(id);
        if (badge) badge.textContent = `${badge.textContent.split("·")[0].trim()} · CHECK`;
      }
      if (panel) panel.hidden = false;
    }
  }

  function setupAudienceTabs() {
    const tabs = [...document.querySelectorAll("[data-audience]")];
    const panels = [...document.querySelectorAll("[data-audience-panel]")];
    for (const tab of tabs) {
      tab.addEventListener("click", () => {
        const audience = tab.dataset.audience;
        for (const item of tabs) item.setAttribute("aria-selected", String(item === tab));
        for (const panel of panels) panel.hidden = panel.dataset.audiencePanel !== audience;
      });
    }
  }

  function setupPainPointFramework() {
    const tabs = [...document.querySelectorAll("[data-framework]")];
    const panels = [...document.querySelectorAll("[data-framework-panel]")];
    for (const tab of tabs) {
      tab.addEventListener("click", () => {
        const customer = tab.dataset.framework;
        for (const item of tabs) item.setAttribute("aria-selected", String(item === tab));
        for (const panel of panels) panel.hidden = panel.dataset.frameworkPanel !== customer;
      });
    }
  }

  function setupDeepCases() {
    const tabs = [...document.querySelectorAll("[data-deep-case]")];
    const panels = [...document.querySelectorAll("[data-deep-case-panel]")];
    for (const tab of tabs) {
      tab.addEventListener("click", () => {
        const caseId = tab.dataset.deepCase;
        for (const item of tabs) item.setAttribute("aria-selected", String(item === tab));
        for (const panel of panels) panel.hidden = panel.dataset.deepCasePanel !== caseId;
      });
    }
  }

  function activateDecisionTab(tab, { focus = false } = {}) {
    const tabs = [...document.querySelectorAll("[data-decision-tab]")];
    const panels = [...document.querySelectorAll("[data-decision-panel]")];
    const decisionId = tab?.dataset.decisionTab;
    if (!decisionId) return;
    for (const item of tabs) {
      const active = item === tab;
      item.setAttribute("aria-selected", String(active));
      item.tabIndex = active ? 0 : -1;
    }
    for (const panel of panels) panel.hidden = panel.dataset.decisionPanel !== decisionId;
    if (focus) tab.focus();
  }

  function setupDecisionLab() {
    const tabs = [...document.querySelectorAll("[data-decision-tab]")];
    for (const tab of tabs) {
      tab.tabIndex = tab.getAttribute("aria-selected") === "true" ? 0 : -1;
      tab.addEventListener("click", () => activateDecisionTab(tab));
      tab.addEventListener("keydown", (event) => {
        const current = tabs.indexOf(tab);
        let next = current;
        if (event.key === "ArrowRight") next = (current + 1) % tabs.length;
        else if (event.key === "ArrowLeft") next = (current - 1 + tabs.length) % tabs.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = tabs.length - 1;
        else return;
        event.preventDefault();
        activateDecisionTab(tabs[next], { focus: true });
      });
    }
  }

  function formatPrice(section) {
    const row = section?.rows?.[0];
    if (!row || !Number.isFinite(Number(row.average))) return "확인 필요";
    const change = Number(row.changePct);
    const changeText = Number.isFinite(change) ? ` · ${change > 0 ? "+" : ""}${change.toFixed(2)}%` : "";
    return `${Number(row.average).toLocaleString("en-US")}${changeText}`;
  }

  function setDecisionMetric(name, value) {
    for (const node of document.querySelectorAll(`[data-live-metric="${name}"]`)) node.textContent = value;
  }

  function updateDecisionBrief(panel, brief) {
    if (!panel || !brief?.latest) return;
    const latest = brief.latest;
    const title = panel.querySelector("[data-live-title]");
    const summary = panel.querySelector("[data-live-summary]");
    const source = panel.querySelector("[data-live-source]");
    if (title && latest.title) title.textContent = latest.title;
    if (summary && latest.summary) summary.textContent = latest.summary;
    if (source && latest.url) {
      source.href = latest.url;
      source.target = "_blank";
      source.rel = "noopener noreferrer";
      source.textContent = `${latest.source || "원문"} 근거 보기 ↗`;
    }
  }

  async function loadDecisionEvidence() {
    const dot = document.querySelector("#decisionDataDot");
    const status = document.querySelector("#decisionDataStatus");
    const updated = document.querySelector("#decisionDataUpdated");
    if (!status) return;
    try {
      await loadSiteContent();
      const response = await fetch(DECISION_CLIENT_PATH, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data?.clientArtifact !== true) throw new Error("Unverified landing artifact");

      for (const panel of document.querySelectorAll("[data-decision-brief]")) {
        const brief = data.briefs?.find((item) => item.id === panel.dataset.decisionBrief);
        updateDecisionBrief(panel, brief);
      }

      const companies = data.marketStructure?.companies || [];
      const skhy = companies.find((item) => item.company === "SKHY");
      const sections = data.prices?.sections || [];
      const dramSpot = sections.find((item) => item.title === "DRAM Spot Price");
      const ssdContract = sections.find((item) => item.title === "PC-Client OEM SSD Contract Price");
      const evidenceCount = Number(data.evidence?.promotedCount || 0);
      const quality = String(data.evidence?.qualityStatus || "review").toUpperCase();
      const freshness = window.MEMORY_SITE_CONTENT?.decisionIntelligence?.freshness || {};
      const freshnessScore = ["current", "warning", "degraded"].includes(freshness.status) ? Math.round(Number(freshness.score || 0)) : "--";
      setDecisionMetric("skhy-hbm-share", skhy?.hbmShare || "확인 필요");
      setDecisionMetric("evidence-count", evidenceCount ? `${evidenceCount}건 · F${freshnessScore}` : `FRESHNESS ${freshnessScore}/100`);
      setDecisionMetric("quality-status", `${quality} · ${freshness.label || "검증 대기"}`);
      setDecisionMetric("dram-spot", formatPrice(dramSpot));
      setDecisionMetric("ssd-contract", formatPrice(ssdContract));

      const expiresAt = new Date(data.expiresAt).getTime();
      const current = Number.isFinite(expiresAt) && Date.now() <= expiresAt;
      dot?.classList.toggle("is-current", current);
      dot?.classList.toggle("is-delayed", !current);
      if (dot) dot.textContent = current ? "Console verified" : "Freshness review";
      status.textContent = `Console 승격 근거 ${evidenceCount || "-"}건 · ${quality} · 전략 답안 자동 연결`;
      if (updated) updated.textContent = `기준 ${formatKst(data.updatedAt)}`;
    } catch (error) {
      console.warn("Decision evidence unavailable", error);
      dot?.classList.remove("is-current");
      dot?.classList.add("is-delayed");
      if (dot) dot.textContent = "Static answer";
      status.textContent = "Console 연결 지연 · 검증된 정적 전략 답안을 유지합니다.";
      if (updated) updated.textContent = "Console에서 최신 근거 재확인";
    } finally {
      applyExecutiveCopyStyle(site, window.MEMORY_SITE_CONTENT?.presentation?.readabilityPolicy);
    }
  }

  function setupReveal() {
    const candidates = [...document.querySelectorAll([
      ".business-hero-visual",
      ".business-section-heading",
      ".business-heading-points",
      ".business-initiative-grid > article",
      ".business-initiative-foundation",
      ".business-quality-thesis",
      ".business-competency-card",
      ".business-strategy-chain > li",
      ".business-pain-framework",
      ".business-solution-card",
      ".business-strategy-artifact > div",
      ".business-ai-factory-system",
      ".business-ai-factory-layers > article",
      ".business-ai-factory-workloads > article",
      ".business-workload-advisory",
      ".business-consulting-process > li",
      ".business-workload-services > article",
      ".business-workload-matrix > article",
      ".business-demand-shift",
      ".business-accelerator-scorecard",
      ".business-kpi-tree",
      ".business-ai-factory-roadmap > li",
      ".business-rag-operating-model",
      ".business-rag-maturity > article",
      ".business-memory-fabric",
      ".business-tco-module",
      ".business-tech-decision-grid > article",
      ".business-tech-proofline",
      ".business-evidence-case",
      ".business-execution-evidence-grid > article",
      ".business-partnership-types > article",
      ".business-partner-map",
      ".business-deep-cases",
      ".business-macro-grid > article",
      ".business-role-fit-grid > article",
      ".business-role-outputs > article",
      ".business-data-status",
      ".business-status-rules",
      ".business-about-card",
    ].join(","))];
    for (const element of candidates) element.classList.add("business-reveal");
    setupSequentialBusinessWarmup(candidates);
  }

  function setupSequentialBusinessWarmup(candidates = []) {
    if (businessWarmupStarted) return;
    businessWarmupStarted = true;
    const sections = [...document.querySelectorAll(".business-site > main > .business-section")];
    const revealSection = (section) => {
      section.dataset.progressiveState = "ready";
      for (const element of candidates) {
        if (element === section || section.contains(element)) element.classList.add("is-visible");
      }
    };
    candidates.filter((element) => !element.closest(".business-section")).forEach((element) => element.classList.add("is-visible"));
    if (!sections.length) return;

    let cursor = 0;
    revealSection(sections[cursor++]);
    const revealNext = () => scheduleIdleStep(() => {
      const section = sections[cursor++];
      if (section) revealSection(section);
      document.body.dataset.businessWarmupReady = String(cursor);
      if (cursor < sections.length) revealNext();
      else document.body.dataset.businessWarmup = "ready";
    });
    if (cursor < sections.length) revealNext();
  }

  function setupInfographicSequence() {
    const groups = document.querySelectorAll([
      ".business-initiative-grid",
      ".business-competency-grid",
      ".business-strategy-chain",
      ".business-strategy-artifact",
      ".business-ai-factory-layers",
      ".business-ai-factory-workloads",
      ".business-ai-factory-sequence",
      ".business-consulting-process",
      ".business-workload-services",
      ".business-workload-matrix",
      ".business-ai-factory-roadmap",
      ".business-rag-maturity",
      ".business-tech-decision-grid",
      ".business-execution-evidence-grid",
      ".business-automation-flow",
      ".business-partnership-types",
      ".business-case-classification",
      ".business-role-outputs",
    ].join(","));
    for (const group of groups) {
      [...group.children].forEach((item, index) => item.style.setProperty("--sequence-index", String(index)));
    }
  }

  function setupConsultingCardMotion() {
    const cards = [...document.querySelectorAll([
      ".business-case-logic > li",
      ".business-option-portfolio > article",
      ".business-delivery-grid > *",
      ".business-partner-raci > article",
      ".business-competency-grid > article",
      ".business-strategy-chain > li",
      ".business-strategy-artifact > div",
      ".business-ai-factory-layers > article",
      ".business-ai-factory-workloads > article",
      ".business-ai-factory-sequence > li",
      ".business-ai-factory-signals > a",
      ".business-consulting-process > li",
      ".business-workload-services > article",
      ".business-workload-sources > a",
      ".business-workload-matrix > article",
      ".business-demand-shift",
      ".business-accelerator-scorecard",
      ".business-kpi-tree",
      ".business-ai-factory-roadmap > li",
      ".business-rag-operating-model",
      ".business-rag-maturity > article",
      ".business-fabric-stack > article",
      ".business-tco-metrics > article",
      ".business-tech-decision-grid > article",
      ".business-competitor-grid > article",
      ".business-execution-evidence-grid > article",
      ".business-evidence-case",
      ".business-automation-flow > li",
      ".business-status-rules > li",
      ".business-partnership-types > article",
      ".business-case-classification > article",
      ".business-deep-case-grid > section",
      ".business-macro-grid > article",
      ".business-role-fit-grid > article",
      ".business-role-outputs > article",
      ".business-contact-card",
    ].join(","))];
    cards.forEach((card, index) => {
      card.classList.add("business-consulting-motion");
      card.dataset.hoverMode = inferHoverContrastMode(card);
      const hasInteractiveContent = card.matches("a, button, input, select, textarea, [tabindex]")
        || Boolean(card.querySelector("a, button, input, select, textarea, [tabindex]"));
      if (!hasInteractiveContent) card.tabIndex = 0;
      if (!card.style.getPropertyValue("--sequence-index")) {
        card.style.setProperty("--sequence-index", String(index % 4));
      }
    });

    if (!("IntersectionObserver" in window)) {
      cards.forEach((card) => card.classList.add("is-visible"));
    } else {
      consultingMotionObserver ||= new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          consultingMotionObserver.unobserve(entry.target);
        }
      }, { rootMargin: "80px 0px", threshold: 0.04 });
      cards.forEach((card) => {
        if (card.dataset.consultingMotionObserved === "1") return;
        card.dataset.consultingMotionObserved = "1";
        consultingMotionObserver.observe(card);
      });
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (reduceMotion || !finePointer) return;

    for (const card of cards) {
      if (card.dataset.consultingMotionBound === "1") continue;
      card.dataset.consultingMotionBound = "1";
      let frame = 0;
      card.addEventListener("pointermove", (event) => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          const bounds = card.getBoundingClientRect();
          const x = ((event.clientX - bounds.left) / bounds.width) - .5;
          const y = ((event.clientY - bounds.top) / bounds.height) - .5;
          card.style.setProperty("--tilt-x", `${(x * 4).toFixed(2)}deg`);
          card.style.setProperty("--tilt-y", `${(-y * 3).toFixed(2)}deg`);
        });
      }, { passive: true });
      card.addEventListener("pointerleave", () => {
        cancelAnimationFrame(frame);
        card.style.setProperty("--tilt-x", "0deg");
        card.style.setProperty("--tilt-y", "0deg");
      }, { passive: true });
    }
  }

  function parseRgb(value = "") {
    const source = String(value || "").trim().toLowerCase();
    const numericSource = source.startsWith("color(")
      ? source.replace(/^color\(\s*[a-z0-9-]+\s+/, "")
      : source;
    const channels = numericSource.match(/[\d.]+/g)?.map(Number) || [];
    if (channels.length < 3 || (channels.length > 3 && channels[3] < .35)) return null;
    const rgb = channels.slice(0, 3);
    return source.startsWith("color(") ? rgb.map((channel) => channel * 255) : rgb;
  }

  function surfaceLuminance(node) {
    let current = node;
    while (current && current !== document.documentElement) {
      const rgb = parseRgb(getComputedStyle(current).backgroundColor);
      if (rgb) {
        const channels = rgb.map((value) => {
          const normalized = value / 255;
          return normalized <= .03928 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4;
        });
        return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
      }
      current = current.parentElement;
    }
    return 1;
  }

  function inferHoverContrastMode(card) {
    return surfaceLuminance(card) < .32 ? "dark-to-light" : "light-to-dark";
  }

  const READABILITY_TEXT_SELECTOR = [
    "h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "dd", "dt",
    "small", "strong", "b", "em", "span", "a", "button", "label", "time", "cite", "figcaption",
    "header", "footer", "section", "article", "div", "th", "td", "i", "text",
  ].join(",");

  function directReadableText(node) {
    return [...(node?.childNodes || [])]
      .filter((child) => child.nodeType === Node.TEXT_NODE)
      .some((child) => String(child.nodeValue || "").trim());
  }

  function colorChannels(value = "") {
    const source = String(value || "").trim().toLowerCase();
    const numericSource = source.startsWith("color(")
      ? source.replace(/^color\(\s*[a-z0-9-]+\s+/, "")
      : source;
    const channels = numericSource.match(/[\d.]+/g)?.map(Number) || [];
    if (channels.length < 3) return null;
    const rgb = channels.slice(0, 3);
    return {
      rgb: source.startsWith("color(") ? rgb.map((channel) => channel * 255) : rgb,
      alpha: channels[3] ?? 1,
    };
  }

  function relativeLuminance(rgb = []) {
    const channels = rgb.map((value) => {
      const normalized = value / 255;
      return normalized <= .03928 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4;
    });
    return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
  }

  function solidReadableSurface(node) {
    let current = node;
    while (current && current !== document.documentElement) {
      const style = getComputedStyle(current);
      if (style.backgroundImage && style.backgroundImage !== "none") return null;
      const color = colorChannels(style.backgroundColor);
      if (color && color.alpha >= .6) return color.rgb;
      current = current.parentElement;
    }
    return [255, 255, 255];
  }

  function applySparseConsoleEmphasis(root = document.body) {
    if (!root?.querySelectorAll || !document.body.classList.contains("consulting-system")) return;
    const candidates = [...root.querySelectorAll(".strategy-highlight, .answer-term")];
    candidates.forEach((node) => node.classList.remove("ui-key-term"));
    const scopeCounts = new Map();
    let total = 0;
    for (const node of candidates) {
      if (total >= 36) break;
      const scope = node.closest(".sc-card, .decision-card, .decision-flip-card, article, section, .board") || node.parentElement;
      if (!scope || (scopeCounts.get(scope) || 0) >= 1) continue;
      node.classList.add("ui-key-term");
      scopeCounts.set(scope, 1);
      total += 1;
    }
    document.body.dataset.consoleKeyTerms = String(total);
  }

  function applyReadabilityGuard(root = document.body) {
    if (!root) return;
    const nodes = [];
    if (root.nodeType === Node.ELEMENT_NODE && root.matches?.(READABILITY_TEXT_SELECTOR)) nodes.push(root);
    if (root.querySelectorAll) nodes.push(...root.querySelectorAll(READABILITY_TEXT_SELECTOR));

    let adjusted = 0;
    let errors = 0;
    for (const node of nodes) {
      try {
      if (!directReadableText(node) || node.closest("script, style, template, [aria-hidden='true']")) continue;
      const bounds = node.getBoundingClientRect();
      node.classList.remove("ui-contrast-on-dark", "ui-contrast-on-light");
      const style = getComputedStyle(node);
      if (!bounds.width || !bounds.height || style.display === "none" || style.visibility === "hidden") continue;

      const fontSize = Number.parseFloat(style.fontSize || "0");
      if (Number.isFinite(fontSize) && fontSize < 12) {
        node.classList.add("ui-text-floor");
        adjusted += 1;
      }

      const foreground = colorChannels(style.color);
      const opacity = Number.parseFloat(style.opacity || "1");
      if (Boolean(foreground && foreground.alpha < .72) || opacity < .72) node.classList.add("ui-readable-opacity");

      const background = solidReadableSurface(node);
      if (!foreground || !background) continue;
      const foregroundLum = relativeLuminance(foreground.rgb);
      const backgroundLum = relativeLuminance(background);
      const contrast = (Math.max(foregroundLum, backgroundLum) + .05) / (Math.min(foregroundLum, backgroundLum) + .05);
      if (contrast >= 4.5) continue;
      node.classList.add(backgroundLum < .32 ? "ui-contrast-on-dark" : "ui-contrast-on-light");
      } catch {
        errors += 1;
      }
    }
    document.body.dataset.readabilityAdjusted = String(adjusted);
    document.body.dataset.readabilityErrors = String(errors);
    if (root === document.body || root === document.documentElement) applySparseConsoleEmphasis(document.body);
  }

  function setupReadabilityGuard() {
    if (!document.body || document.body.dataset.readabilityGuard === "1") return;
    document.body.dataset.readabilityGuard = "1";
    let frame = 0;
    const pendingRoots = new Set([document.body]);
    const flush = () => {
      frame = 0;
      const roots = [...pendingRoots];
      pendingRoots.clear();
      roots.forEach((root) => {
        try { applyReadabilityGuard(root); } catch { /* keep later refreshes alive */ }
      });
    };
    const schedule = (root = document.body) => {
      if (root) pendingRoots.add(root.nodeType === Node.TEXT_NODE ? root.parentElement : root);
      if (!frame) frame = requestAnimationFrame(flush);
    };
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") schedule(mutation.target);
        else if (mutation.type === "attributes") schedule(mutation.target);
        else mutation.addedNodes.forEach((node) => schedule(node));
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["hidden", "data-progressive-state", "data-deferred-state"],
    });
    schedule(document.body);
    window.addEventListener("memory-console-ready", () => {
      schedule(document.body);
      [250, 1200, 4200].forEach((delay) => window.setTimeout(() => applyReadabilityGuard(document.body), delay));
    });
    window.setTimeout(() => applyReadabilityGuard(document.body), 8200);
    window.__applyReadabilityGuard = applyReadabilityGuard;
    window.addEventListener("resize", () => schedule(document.body), { passive: true });
    const refreshInteractiveContrast = (event) => {
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      const surface = target?.closest?.("[data-hover-mode], .sc-card, .decision-card, .decision-flip-card, .domain-agent-workstream, .ai-council-agenda-card") || target;
      if (!surface) return;
      schedule(surface);
      window.setTimeout(() => schedule(surface), 240);
    };
    window.addEventListener("pointerover", refreshInteractiveContrast, { passive: true, capture: true });
    window.addEventListener("pointerout", refreshInteractiveContrast, { passive: true, capture: true });
    window.addEventListener("focusin", refreshInteractiveContrast, { passive: true, capture: true });
    window.addEventListener("focusout", refreshInteractiveContrast, { passive: true, capture: true });
    window.addEventListener("pagehide", () => observer.disconnect(), { once: true });
  }

  function applyPresentationPolicy(policy = {}) {
    presentationPolicy = policy || null;
    if (!site || !policy) return;
    const readability = policy.readabilityPolicy || {};
    const maxCharacters = Math.min(82, Math.max(58, Number(readability.bodyMaxCharacters || 72)));
    const minimumLineHeight = Math.min(1.9, Math.max(1.55, Number(readability.minimumBodyLineHeight || 1.65)));
    site.style.setProperty("--business-copy-max", `${maxCharacters}ch`);
    site.style.setProperty("--business-body-leading", String(minimumLineHeight));
    site.dataset.contentSource = policy.refreshPolicy?.contentSource || "verified-site-content-client";
    site.dataset.contentRun = String(policy.refreshPolicy?.runId || document.documentElement.dataset.contentRun || "");
    site.dataset.emphasisStyle = policy.emphasisPolicy?.style || "underline-only";
  }

  function clearBusinessKeyTerms(root = site) {
    for (const mark of root?.querySelectorAll("mark.business-key-term") || []) {
      mark.replaceWith(document.createTextNode(mark.textContent || ""));
    }
    root?.normalize();
  }

  function escapeRegExp(value = "") {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function highlightBusinessKeyTerms(root = site, policy = presentationPolicy) {
    const surface = root?.querySelector("main") || root;
    const emphasis = policy?.emphasisPolicy || {};
    const terms = [...new Set((policy?.emphasisTerms || []).map((term) => String(term || "").trim()).filter(Boolean))];
    if (!surface || !("TreeWalker" in window) || !terms.length) return;
    clearBusinessKeyTerms(surface);
    const pattern = new RegExp(`(${terms.sort((a, b) => b.length - a.length).map(escapeRegExp).join("|")})`, "giu");
    const targets = (emphasis.targets || ["h1", "h2", "h3", "h4", "strong"]).filter((target) => /^[a-z][a-z\d-]*$/i.test(target));
    const targetSelector = targets.join(",");
    const maxPerSection = Math.max(1, Number(emphasis.maxPerSection || 1));
    const maxTotal = Math.min(12, Math.max(1, Number(emphasis.maxTotal || 10)));
    const candidates = [];
    const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        const value = node.nodeValue || "";
        if (!parent || !value.trim()) return NodeFilter.FILTER_REJECT;
        if (parent.closest("mark, script, style, textarea, select, option, code, pre, [aria-hidden='true']")) return NodeFilter.FILTER_REJECT;
        if (!targetSelector || !parent.closest(targetSelector)) return NodeFilter.FILTER_REJECT;
        pattern.lastIndex = 0;
        return pattern.test(value) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    while (walker.nextNode()) candidates.push(walker.currentNode);

    const sectionCounts = new Map();
    let total = 0;
    for (const node of candidates) {
      if (total >= maxTotal) break;
      const section = node.parentElement?.closest("section, article, [data-decision-panel]") || surface;
      if ((sectionCounts.get(section) || 0) >= maxPerSection) continue;
      const value = node.nodeValue || "";
      const fragment = document.createDocumentFragment();
      let cursor = 0;
      let inserted = 0;
      pattern.lastIndex = 0;
      for (const match of value.matchAll(pattern)) {
        if (inserted >= maxPerSection || total >= maxTotal) break;
        const index = match.index ?? 0;
        if (index > cursor) fragment.append(value.slice(cursor, index));
        const mark = document.createElement("mark");
        mark.className = "business-key-term";
        mark.textContent = match[0];
        fragment.append(mark);
        cursor = index + match[0].length;
        inserted += 1;
        total += 1;
      }
      if (!inserted) continue;
      if (cursor < value.length) fragment.append(value.slice(cursor));
      node.replaceWith(fragment);
      sectionCounts.set(section, (sectionCounts.get(section) || 0) + inserted);
    }
  }

  function setupBusinessExperience() {
    if (businessReady) return;
    businessReady = true;
    applyExecutiveCopyStyle(site);
    void loadSiteContent().then(scheduleConsoleAssetWarmup);
    scheduleSiteContentRefresh();
    document.addEventListener("visibilitychange", recheckSiteContentNow);
    window.addEventListener("online", recheckSiteContentNow);
    setupAudienceTabs();
    setupPainPointFramework();
    setupDeepCases();
    setupDecisionLab();
    setupInfographicSequence();
    setupReveal();
    setupConsultingCardMotion();
    void updateDataStatus();
    void loadDecisionEvidence();
  }

  window.addEventListener("memory-console-ready", () => {
    finishConsoleStartup();
    applyUniversalSectionBindings(window.MEMORY_SITE_CONTENT || {});
  });

  function updateBusinessScrollState() {
    if (view !== "business") return;
    header?.classList.toggle("is-scrolled", window.scrollY > 18);
    const offset = (header?.offsetHeight || 76) + 40;
    let current = "home";
    for (const section of businessSections) {
      if (section.getBoundingClientRect().top <= offset) current = section.id;
    }
    setActiveNav(current);
  }

  menuButton?.addEventListener("click", () => setMenu(!document.body.classList.contains("business-menu-open")));
  nav?.addEventListener("click", (event) => {
    const link = event.target.closest("a[href^='#']");
    if (link) setMenu(false);
  });
  for (const trigger of document.querySelectorAll("[data-open-console]")) {
    trigger.addEventListener("click", () => void openConsole());
  }
  consoleExit?.addEventListener("click", () => openBusiness("home"));
  window.addEventListener("popstate", syncFromLocation);
  window.addEventListener("hashchange", syncFromLocation);
  window.addEventListener("scroll", updateBusinessScrollState, { passive: true });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 980) setMenu(false);
    updateBusinessScrollState();
  }, { passive: true });

  setupReadabilityGuard();
  if (isConsoleHash()) void openConsole({ updateHistory: false });
  else {
    view = "business";
    setupBusinessExperience();
    const initialId = location.hash.slice(1) || "home";
    requestAnimationFrame(() => {
      document.getElementById(initialId)?.scrollIntoView({ behavior: "instant", block: "start" });
      updateBusinessScrollState();
    });
  }
})();
