(() => {
  "use strict";

  const BUSINESS_TITLE = "AI Infra Strategy · Customer Pain to Executive Action";
  const CONSOLE_HASH = "#console";
  const CONSOLE_REVISION = "infra-28c36e733547";
  const DECISION_CLIENT_PATH = "data/landing-decision-client.json";
  const SITE_CONTENT_PATH = "data/site-content-client.json";
  const SITE_CONTENT_EXTENDED_PATH = "data/site-content-extended-client.json";
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
  let siteContentExtendedPromise = null;
  let siteContentRefreshTimer = 0;
  let consultingMotionObserver = null;
  let businessNavObserver = null;
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
      if (!performance.getEntriesByName("memory-console-shell").length) performance.mark("memory-console-shell");
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
    const heroImage = document.querySelector(".memory-hero-static");
    if (heroImage?.decode) heroImage.decode().catch(() => {});
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
    ensurePreload("consoleAppPreload", "script", `assets/js/app.min.js?v=${CONSOLE_REVISION}`, isConsoleHash() ? "high" : "low");
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
    // Start CSS and JavaScript together because both resources are already
    // preloaded for an explicit #console visit.
    consoleLoadPromise = Promise.all([loadStylesheet(), loadAppScript()]);
    // Start the customer/ASIC snapshot immediately after the interactive shell.
    // requestIdleCallback can be postponed indefinitely in throttled/background
    // tabs, which previously left lower console boards empty until scrolling.
    void consoleLoadPromise.then(() => window.setTimeout(warmConsolePortfolio, 80));
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
      const consoleReady = loadConsole();
      await loadStylesheet();
      activeConsoleLayer.hidden = false;
      document.body.classList.remove("landing-mode", "business-menu-open", "console-loading");
      document.body.classList.add("console-mode", "console-startup");
      // Reveal the styled shell immediately. Data boards continue hydrating in
      // document order instead of keeping the static loading snapshot on top.
      finishConsoleStartup();
      await consoleReady;
      if (document.body.dataset.consoleReady === "1") finishConsoleStartup();
      else consoleStartupTimer = window.setTimeout(finishConsoleStartup, 6000);
    } catch (error) {
      console.error("Intelligence Console failed to load", error);
      document.querySelector("#consoleStyles:not([data-ready='1'])")?.remove();
      document.querySelector("#consoleApp:not([data-ready='1'])")?.remove();
      consoleLoadPromise = null;
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
    if (window.MEMORY_SITE_CONTENT?.clientArtifact) applySiteContent(window.MEMORY_SITE_CONTENT);
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

  function executiveBusinessBulletText(value = "") {
    return String(value ?? "")
      .replace(/할 수 없습니다(?=[.!?。]|\s*$)/g, "불가")
      .replace(/할 수 있습니다(?=[.!?。]|\s*$)/g, "가능")
      .replace(/해야 합니다(?=[.!?。]|\s*$)/g, "필요")
      .replace(/필요가 있습니다(?=[.!?。]|\s*$)/g, "필요")
      .replace(/가능성이 (?:큽니다|높습니다)(?=[.!?。]|\s*$)/g, "가능성 높음")
      .replace(/가능성이 낮습니다(?=[.!?。]|\s*$)/g, "가능성 낮음")
      .replace(/아닙니다(?=[.!?。]|\s*$)/g, "아님")
      .replace(/봅니다(?=[.!?。]|\s*$)/g, "판단")
      .replace(/([가-힣]+)납니다(?=[.!?。]|\s*$)/g, "$1남")
      .replace(/([가-힣]+)줍니다(?=[.!?。]|\s*$)/g, "$1줌")
      .replace(/([가-힣]+)둡니다(?=[.!?。]|\s*$)/g, "$1둠")
      .replace(/([가-힣]+)되었습니다(?=[.!?。]|\s*$)/g, "$1")
      .replace(/([가-힣]+)했습니다(?=[.!?。]|\s*$)/g, "$1")
      .replace(/([가-힣]+)됐습니다(?=[.!?。]|\s*$)/g, "$1")
      .replace(/([가-힣]+)았습니다(?=[.!?。]|\s*$)/g, "$1았음")
      .replace(/([가-힣]+)었습니다(?=[.!?。]|\s*$)/g, "$1었음")
      .replace(/([가-힣]+)였습니다(?=[.!?。]|\s*$)/g, "$1였음")
      .replace(/([가-힣]+)입니다(?=[.!?。]|\s*$)/g, "$1")
      .replace(/([가-힣]+)합니다(?=[.!?。]|\s*$)/g, "$1")
      .replace(/([가-힣]+)됩니다(?=[.!?。]|\s*$)/g, "$1")
      .replace(/([가-힣]+)집니다(?=[.!?。]|\s*$)/g, "$1짐")
      .replace(/([가-힣]+)립니다(?=[.!?。]|\s*$)/g, "$1림")
      .replace(/([가-힣]+)듭니다(?=[.!?。]|\s*$)/g, "$1듦")
      .replace(/([가-힣]+)봅니다(?=[.!?。]|\s*$)/g, "$1 판단")
      .replace(/([가-힣]+)습니다(?=[.!?。]|\s*$)/g, "$1음")
      .replace(/입니다(?=[.!?。]|\s*$)/g, "")
      .replace(/합니다(?=[.!?。]|\s*$)/g, "")
      .replace(/됩니다(?=[.!?。]|\s*$)/g, "됨")
      .replace(/습니다(?=[.!?。]|\s*$)/g, "음")
      .replace(/([가-힣]+)니다(?=[.!?。]|\s*$)/g, "$1")
      .replace(/([가-힣]+)였다(?=[.!?。]|\s*$)/g, "$1")
      .replace(/([가-힣]+)했다(?=[.!?。]|\s*$)/g, "$1")
      .replace(/([가-힣]+)됐다(?=[.!?。]|\s*$)/g, "$1")
      .replace(/([가-힣]+)이다(?=[.!?。]|\s*$)/g, "$1")
      .replace(/([가-힣]+)있다(?=[.!?。]|\s*$)/g, "$1있음")
      .replace(/([가-힣]+)없다(?=[.!?。]|\s*$)/g, "$1없음")
      .replace(/([가-힣]+)한다(?=[.!?。]|\s*$)/g, "$1")
      .replace(/([가-힣]+)된다(?=[.!?。]|\s*$)/g, "$1")
      .replace(/([가-힣]+)하다(?=[.!?。]|\s*$)/g, "$1")
      .replace(/([가-힣]+)다(?=[.!?。]|\s*$)/g, "$1");
  }

  function removeBusinessSentenceStops(value = "") {
    return executiveBusinessBulletText(value)
      .replace(/([A-Za-z\u3131-\u318e\uac00-\ud7a3\d%)\]"'”’])[.\u3002](?=\s|$)/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
  }

  function removeDiscardedBusinessSentence(value = "") {
    return String(value || "")
      .replace(/(?:^|[.!?…·]\s*)Investing\.com에 따르면 KeyBanc 기술 리더십 포럼 2026에서[\s\S]*?계획이라고 말(?:했습니다)?[.!?…]?/giu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function compactBusinessCopy(value = "", maxCharacters = 84) {
    const original = removeDiscardedBusinessSentence(value)
      .replace(/\s*(?:…|\.{3})+\s*$/u, "")
      .replace(/…/gu, " · ")
      .replace(/\s+·\s+·\s+/gu, " · ")
      .replace(/\s{2,}/g, " ")
      .trim();
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
    return compact.slice(0, boundary > 48 ? boundary : maxCharacters).trimEnd();
  }

  function applyExecutiveCopyStyle(root = site, policy = {}) {
    if (!root) return;
    const paragraphLimit = Number(policy.paragraphMaxCharacters || 92);
    const listLimit = Number(policy.listMaxCharacters || 78);
    const detailLimit = Number(policy.detailMaxCharacters || 72);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    for (const textNode of textNodes) {
      const parent = textNode.parentElement;
      if (!parent || parent.closest("script, style, code, pre, [data-copy-verbatim]")) continue;
      const originalText = String(textNode.nodeValue || "").trim();
      const cleaned = removeDiscardedBusinessSentence(textNode.nodeValue);
      textNode.nodeValue = executiveBusinessBulletText(cleaned)
        .replace(/([A-Za-z\u3131-\u318e\uac00-\ud7a3\d%)\]"'”’])[.\u3002](?=\s|$)/g, "$1")
        .replace(/\s*(?:…|\.{3})+\s*$/u, "")
        .replace(/…/gu, " · ")
        .replace(/\s+·\s+·\s+/gu, " · ");
      if (originalText && !cleaned && parent.matches("p, li, dd, figcaption")) parent.hidden = true;
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
    const preserveFullCopy = node.hasAttribute("data-copy-verbatim");
    node.innerHTML = items
      .map((item) => preserveFullCopy
        ? removeBusinessSentenceStops(removeDiscardedBusinessSentence(item))
        : compactBusinessCopy(item, 78))
      .filter(Boolean)
      .map((item) => `<li>${escapeBusinessHTML(item)}</li>`)
      .join("");
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

      const live = panel.querySelector(":scope > .business-live-evidence");
      const liveTitle = live?.querySelector("[data-live-title]");
      const liveSummary = live?.querySelector("[data-live-summary]");
      const liveSource = live?.querySelector("[data-live-source]");
      if (liveTitle) liveTitle.textContent = decision.latest?.title || "최신 근거 확인 필요";
      if (liveSummary) {
        const summaryCopy = removeDiscardedBusinessSentence(decision.latest?.summary || "검증된 근거가 수집되면 자동 갱신");
        liveSummary.hidden = !summaryCopy;
        liveSummary.textContent = summaryCopy;
      }
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

  function setupHeroMediaRotation() {
    const media = document.querySelector(".business-hero-media");
    if (!media || media.dataset.rotationSetup === "1") return;
    media.dataset.rotationSetup = "1";
    const images = [...media.querySelectorAll("img")];
    let fallback = 0;
    const activate = () => {
      window.clearTimeout(fallback);
      if (media.dataset.rotationReady === "1") return;
      media.dataset.rotationReady = "1";
      document.body.dataset.heroMedia = "ready";
    };
    const prepare = () => window.setTimeout(() => scheduleIdleStep(() => {
      const secondary = images.slice(1);
      fallback = window.setTimeout(activate, 1400);
      if (!secondary.length) {
        activate();
        return;
      }
      Promise.allSettled(secondary.map((image) => {
        image.loading = "eager";
        image.fetchPriority = "low";
        return typeof image.decode === "function" ? image.decode() : Promise.resolve();
      })).then(activate);
    }, 900), 1200);
    if (document.readyState === "complete") prepare();
    else window.addEventListener("load", prepare, { once: true });
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

    const units = document.querySelector("#teamOperatingUnits");
    if (units && model.units?.length) {
      units.innerHTML = model.units.map((unit) => `<article tabindex="0">
        <header><span>${escapeBusinessHTML(unit.index || "")} · ${escapeBusinessHTML(unit.label || "")}</span><b>${escapeBusinessHTML(unit.index || "")}</b></header>
        <h3>${escapeBusinessHTML(unit.title || "")}</h3>
        <p>${escapeBusinessHTML(unit.role || "")}</p>
        <small>OUTPUT</small><strong>${escapeBusinessHTML(unit.output || "")}</strong>
      </article>`).join("");
      const next = model.nextMemoryStrategy;
      if (next) units.insertAdjacentHTML("beforeend", `<aside><span>${escapeBusinessHTML(next.label || "NEXT MEMORY STRATEGY")}</span><strong>${escapeBusinessHTML(next.role || "")}</strong><p>${escapeBusinessHTML((next.outputs || []).join(" · "))}</p></aside>`);
    }

    const loop = document.querySelector("#teamDecisionLoop");
    if (loop && model.decisionLoop?.length) {
      loop.innerHTML = model.decisionLoop.map((step, index) => `<li><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeBusinessHTML(step)}</strong></li>`).join("");
    }

    const workstreams = document.querySelector("#teamWorkstreams");
    if (workstreams && model.workstreams?.length) {
      workstreams.innerHTML = model.workstreams.map((item) => {
        const signal = item.currentSignal;
        const liveSignal = signal ? `<aside class="business-team-live">
          <small>LIVE SIGNAL · ${escapeBusinessHTML(String(signal.evidenceLevel || "WATCH").toUpperCase())}</small>
          <strong>${escapeBusinessHTML(signal.title)}</strong>
          <a href="${escapeBusinessHTML(safeBusinessUrl(signal.url, "#console"))}" target="_blank" rel="noopener noreferrer">${escapeBusinessHTML(signal.source || "원문")} · ${escapeBusinessHTML(String(signal.publishedAt || "").slice(0, 10) || "기준일 확인")} ↗</a>
        </aside>` : "";
        return `
          <article data-team-workstream="${escapeBusinessHTML(item.id)}" tabindex="0">
            <header><span>${escapeBusinessHTML(item.index)} · ${escapeBusinessHTML(item.label)}</span><b>${escapeBusinessHTML(item.index)}</b></header>
            <h3>${escapeBusinessHTML(item.title)}</h3>
            <p>${escapeBusinessHTML(item.mandate)}</p>
            ${liveSignal}
            <dl>
              <div><dt>INPUT</dt><dd>${escapeBusinessHTML((item.inputs || []).join(" · "))}</dd></div>
              <div><dt>KEY QUESTIONS</dt><dd><ul>${(item.questions || []).map((question) => `<li>${escapeBusinessHTML(question)}</li>`).join("")}</ul></dd></div>
              <div><dt>OUTPUT</dt><dd>${escapeBusinessHTML((item.outputs || []).join(" · "))}</dd></div>
              <div class="business-team-gate"><dt>DECISION GATE</dt><dd>${escapeBusinessHTML(item.gate)}</dd></div>
            </dl>
            <footer><small>KPI</small><strong>${escapeBusinessHTML((item.kpis || []).join(" · "))}</strong></footer>
          </article>`;
      }).join("");
    }

  }

  function renderDecisionAutomation(content = {}) {
    const automation = content.decisionIntelligence?.decisionAutomation;
    if (!automation) return;
    const briefs = document.querySelector("#decisionAutomationBriefs");
    if (briefs && automation.briefs?.length) {
      briefs.innerHTML = automation.briefs.map((brief, index) => {
        return `<article tabindex="0" data-decision-brief="${escapeBusinessHTML(brief.id)}">
          <header><span>${String(index + 1).padStart(2, "0")} · ${escapeBusinessHTML(brief.label)}</span><b>${escapeBusinessHTML(String(brief.status || "MONITORING").replaceAll("_", " "))}</b></header>
          <h3>${escapeBusinessHTML(brief.whatChanged || brief.hypothesis)}</h3>
          <dl class="decision-os-evidence-split"><div><dt>FACT BOUNDARY</dt><dd>${escapeBusinessHTML(brief.factBoundary || "공식 원문·Stage·날짜가 확인된 내용만 사실로 승격")}</dd></div><div><dt>HYPOTHESIS</dt><dd>${escapeBusinessHTML(brief.hypothesis)}</dd></div></dl>
          <ul><li>${escapeBusinessHTML(brief.customerPain)}</li><li>90D · ${escapeBusinessHTML(brief.action90d)}</li></ul>
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
        <header><span>${escapeBusinessHTML(item.company)}</span></header>
        <dl><div><dt>HBM SHARE</dt><dd>${escapeBusinessHTML(item.hbmShare || "미공개")}</dd></div><div><dt>TREND</dt><dd>${escapeBusinessHTML(trend)}</dd></div><div><dt>DRAM SHARE</dt><dd>${escapeBusinessHTML(item.dramShare || "미공개")}</dd></div></dl>
        <div><a href="${escapeBusinessHTML(safeBusinessUrl(item.sourceUrl, "#console"))}" target="_blank" rel="noopener noreferrer">${escapeBusinessHTML(item.source || "근거") } ↗</a></div>
      </article>`;
    }).join("");
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
    const flowStages = [...(flow?.querySelectorAll("[data-flow-stage]") || [])];
    if (flowStages.length && Array.isArray(hero.workflow) && hero.workflow.length) {
      flowStages.forEach((stage, index) => {
        const item = hero.workflow[index];
        stage.hidden = !item;
        if (!item) return;
        const indexNode = stage.querySelector("[data-flow-index]");
        const titleNode = stage.querySelector("[data-flow-title]");
        const detailNode = stage.querySelector("[data-flow-detail]");
        const stepLabel = `${item.index || String(index + 1).padStart(2, "0")} · ${item.label || "DECISION STEP"}`;
        if (indexNode) indexNode.textContent = stepLabel;
        if (titleNode) titleNode.textContent = item.title || "";
        if (detailNode) detailNode.textContent = item.detail || "";
        stage.setAttribute("aria-label", [stepLabel, item.title, item.detail].filter(Boolean).join(" · "));
      });
    }
    const queue = document.querySelector("#businessHomeDecisionQueue");
    if (queue && Array.isArray(workbench.agenda) && workbench.agenda.length) {
      queue.innerHTML = workbench.agenda.map((item, index) => {
        const deepLink = /^#console(?:$|\/)/.test(String(item.deepLink || "")) ? item.deepLink : "#console";
        return `<a href="${deepLink}" data-decision-id="${escapeBusinessHTML(item.id || String(index + 1))}" data-state="${escapeBusinessHTML(String(item.state || "monitoring").toLowerCase())}">
          <span>${escapeBusinessHTML(item.index || String(index + 1).padStart(2, "0"))} · ${escapeBusinessHTML(item.label || "AI INFRA DECISION")}</span>
          <strong>${escapeBusinessHTML(item.decisionQuestion || item.whatChanged || "다음 의사결정 질문을 검증합니다.")}</strong>
          <p><b>PAIN</b> · ${escapeBusinessHTML(item.customerPain || "고객 문제 검증 중")}</p>
          <p><b>PROPOSAL</b> · ${escapeBusinessHTML(item.recommendation || "맞춤형 메모리 제안")}</p>
          <small><b>90D GATE</b> · ${escapeBusinessHTML(item.action90d || "고객 합의 Gate")}</small>
        </a>`;
      }).join("");
    }
  }

  function renderLandingAccountStrip(content = {}) {
    const board = content.strategyBoard?.customerPortfolio || {};
    const focusAccounts = Array.isArray(board.focusAccounts) ? board.focusAccounts : [];
    const priorityIds = Array.isArray(board.asicPortfolio?.priorityAccountIds) ? board.asicPortfolio.priorityAccountIds : [];
    const priorityRank = new Map(priorityIds.map((id, index) => [id, index]));
    const accounts = focusAccounts.slice().sort((left, right) => {
      const leftRank = priorityRank.has(left.id) ? priorityRank.get(left.id) : Number.MAX_SAFE_INTEGER;
      const rightRank = priorityRank.has(right.id) ? priorityRank.get(right.id) : Number.MAX_SAFE_INTEGER;
      return leftRank - rightRank;
    });
    const host = document.querySelector("#businessKeyAccounts");
    if (host && accounts.length) {
      host.innerHTML = accounts.map((account) => `
        <a href="#console/account/${escapeBusinessHTML(account.id || "")}" style="--account-accent:${escapeBusinessHTML(account.accent || "#0A84B8")}">
          <span data-company-id="${escapeBusinessHTML(account.id || "")}">${escapeBusinessHTML(account.company || "")}</span>
          <strong>${escapeBusinessHTML(account.chip || "")}</strong>
          <small>${escapeBusinessHTML(account.pain || "")}</small>
          <b>${escapeBusinessHTML(account.memory || "맞춤형 Memory Proposal")}</b>
        </a>`).join("");
    }
    const mixHost = document.querySelector("#businessDemandMix");
    if (mixHost) mixHost.replaceChildren();

    const broadcom = board.broadcomEcosystem || {};
    const broadcomHost = document.querySelector("#businessBroadcomAccounts");
    const broadcomFlow = document.querySelector("#businessBroadcomFlow");
    const broadcomTitle = document.querySelector("#broadcomAccountStrategyTitle");
    const broadcomSection = document.querySelector("#broadcomAccountStrategy");
    const broadcomAccounts = Array.isArray(broadcom.accounts) ? broadcom.accounts : [];
    if (broadcomTitle && broadcom.title) broadcomTitle.textContent = broadcom.title;
    if (broadcomFlow && broadcom.decisionFlow?.length) {
      broadcomFlow.innerHTML = broadcom.decisionFlow.map((step) => `<li><b>${escapeBusinessHTML(step.index || "")}</b><span>${escapeBusinessHTML(step.label || "")}</span><strong>${escapeBusinessHTML(step.value || "")}</strong></li>`).join("");
    }
    if (broadcomHost && broadcomAccounts.length) {
      broadcomHost.innerHTML = broadcomAccounts.map((account) => {
        const strategy = account.broadcomStrategy || {};
        return `<article tabindex="0" data-status="${/공식/.test(String(strategy.status || "")) ? "official" : "reported"}" style="--account-accent:${escapeBusinessHTML(account.accent || "#0A84B8")}">
          <header><div><span data-company-id="${escapeBusinessHTML(account.id || "")}">${escapeBusinessHTML(account.company || "")}</span><h3>${escapeBusinessHTML(account.chip || "")}</h3></div><em>${escapeBusinessHTML(strategy.status || "관계 확인")}</em></header>
          <p>${escapeBusinessHTML(strategy.accountQuestion || account.pain || "")}</p>
          <dl><div><dt>PAIN</dt><dd>${escapeBusinessHTML((strategy.pains || []).join(" · "))}</dd></div><div><dt>SKH OPTION</dt><dd>${escapeBusinessHTML((strategy.proposal || []).join(" · "))}</dd></div><div><dt>90D GATE</dt><dd>${escapeBusinessHTML(strategy.gate90d || account.gate || "")}</dd></div></dl>
          <a href="#console/account/${escapeBusinessHTML(account.id || "")}">계정 전략 열기 →</a>
        </article>`;
      }).join("");
    } else if (broadcomSection) broadcomSection.hidden = true;
  }

  function applySiteContent(content = {}) {
    if (!content?.clientArtifact) return;
    document.documentElement.dataset.contentRun = String(content.runId || "");
    const title = document.querySelector(".business-hero-copy h2");
    if (title && content.hero?.titleLines?.length) {
      const [first, ...rest] = content.hero.titleLines;
      title.innerHTML = `${escapeBusinessHTML(first)}<br><em>${escapeBusinessHTML(rest.join(" "))}</em>`;
    }
    renderBusinessList(document.querySelector(".business-hero-bullets"), content.hero?.capabilities);
    renderDepartmentHomepage(content);
    renderLandingAccountStrip(content);
    const staticSnapshot = document.querySelector(".console-static-snapshot header p");
    if (staticSnapshot) staticSnapshot.textContent = content.agentCouncil?.subtitle || staticSnapshot.textContent;

    renderDecisionContent(content);
    renderOrganizationOperatingModel(content);
    renderDecisionAutomation(content);
    renderCurrentInsights(content);
    renderAIFactorySystem(content);
    renderWorkloadOptimization(content);
    renderCompetitorContent(content);
    applyUniversalSectionBindings(content);
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
      manifestPromise = fetch("data/data-manifest.json", { cache: force ? "reload" : "no-cache" }).then((response) => {
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
    if (force) {
      siteContentPromise = null;
      siteContentExtendedPromise = null;
    }
    if (siteContentPromise) return siteContentPromise;
    siteContentPromise = (async () => {
      const fetchSnapshot = async (manifest, reload = false) => {
        const cacheVersion = encodeURIComponent(manifest.cacheVersion || manifest.runId || Date.now());
        const response = await fetch(`${SITE_CONTENT_PATH}?v=${cacheVersion}`, { cache: reload ? "reload" : "force-cache" });
        if (!response.ok) throw new Error(`Site content HTTP ${response.status}`);
        return { content: await response.json(), cacheVersion };
      };
      let manifest = await getDataManifest({ force });
      let snapshot = await fetchSnapshot(manifest, force);
      if (snapshot.content?.clientArtifact !== true || !snapshot.content.runId || snapshot.content.runId !== manifest.runId) {
        manifest = await getDataManifest({ force: true });
        snapshot = await fetchSnapshot(manifest, true);
      }
      const { content, cacheVersion } = snapshot;
      if (content?.clientArtifact !== true || !content.runId || content.runId !== manifest.runId) {
        document.body.dataset.snapshotUpdate = "blocked";
        throw new Error("Site content runId mismatch after reconciliation");
      }
      document.body.dataset.snapshotUpdate = "applied";
      document.body.dataset.snapshotRun = String(content.runId);
      window.MEMORY_SITE_CONTENT = content;
      applySiteContent(content);
      window.dispatchEvent(new CustomEvent("memory-site-content-ready", { detail: { runId: content.runId } }));
      void loadExtendedSiteContent({ content, cacheVersion, force });
      return content;
    })().catch((error) => {
      siteContentPromise = null;
      console.warn("Verified site content unavailable; retaining last rendered framework", error);
      window.dispatchEvent(new CustomEvent("memory-site-content-error"));
      return null;
    });
    return siteContentPromise;
  }

  async function loadExtendedSiteContent({ content, cacheVersion, force = false } = {}) {
    if (force) siteContentExtendedPromise = null;
    if (siteContentExtendedPromise) return siteContentExtendedPromise;
    siteContentExtendedPromise = (async () => {
      const response = await fetch(`${SITE_CONTENT_EXTENDED_PATH}?v=${cacheVersion}`, { cache: force ? "reload" : "force-cache" });
      if (!response.ok) throw new Error(`Extended site content HTTP ${response.status}`);
      const extended = await response.json();
      if (extended?.clientArtifact !== true || !extended.runId || extended.runId !== content?.runId) {
        throw new Error("Extended site content runId mismatch");
      }
      const merged = {
        ...content,
        ...extended,
        agentCouncil: { ...(content.agentCouncil || {}), ...(extended.agentCouncil || {}) },
      };
      window.MEMORY_SITE_CONTENT = merged;
      applySiteContent(merged);
      window.dispatchEvent(new CustomEvent("memory-site-content-ready", { detail: { runId: merged.runId, extended: true } }));
      return merged;
    })().catch((error) => {
      siteContentExtendedPromise = null;
      console.warn("Extended strategy content unavailable; retaining the initial decision contract", error);
      return content;
    });
    return siteContentExtendedPromise;
  }

  function warmConsolePortfolio() {
    void loadSiteContent();
  }

  function scheduleSiteContentRefresh() {
    window.clearTimeout(siteContentRefreshTimer);
    const minutes = Math.max(1, Number(window.MEMORY_SITE_CONTENT?.siteAutomation?.refresh?.browserRecheckMinutes
      || window.MEMORY_SITE_CONTENT?.freshness?.browserRecheckMinutes
      || 5));
    siteContentRefreshTimer = window.setTimeout(async () => {
      if (!document.hidden) {
        await loadSiteContent({ force: true });
      }
      scheduleSiteContentRefresh();
    }, minutes * 60 * 1000);
  }

  function recheckSiteContentNow() {
    if (document.hidden) return;
    void loadSiteContent({ force: true }).then(() => {
      scheduleSiteContentRefresh();
    });
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
    if (summary && latest.summary) {
      const summaryCopy = removeDiscardedBusinessSentence(latest.summary);
      summary.hidden = !summaryCopy;
      summary.textContent = summaryCopy;
    }
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
    try {
      await loadSiteContent();
      const fetchDecisionSnapshot = async (manifest, reload = false) => {
        const version = encodeURIComponent(manifest.cacheVersion || manifest.runId || Date.now());
        const response = await fetch(`${DECISION_CLIENT_PATH}?v=${version}`, { cache: reload ? "reload" : "force-cache" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      };
      let manifest = await getDataManifest();
      let data = await fetchDecisionSnapshot(manifest);
      const siteRunId = String(window.MEMORY_SITE_CONTENT?.runId || "");
      if (data?.clientArtifact !== true || data.runId !== manifest.runId || (siteRunId && data.runId !== siteRunId)) {
        manifest = await getDataManifest({ force: true });
        await loadSiteContent({ force: true });
        data = await fetchDecisionSnapshot(manifest, true);
      }
      if (data?.clientArtifact !== true || data.runId !== manifest.runId || data.runId !== String(window.MEMORY_SITE_CONTENT?.runId || "")) {
        throw new Error("Decision artifact runId mismatch after reconciliation");
      }

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
      if (dot) dot.textContent = current ? "Console current" : "Update review";
      if (status) status.textContent = current ? "고객 과제와 선택 인사이트 최신화" : "선택 인사이트 업데이트 확인";
      if (updated) updated.textContent = `기준 ${formatKst(data.updatedAt)}`;
    } catch (error) {
      console.warn("Decision evidence unavailable", error);
      dot?.classList.remove("is-current");
      dot?.classList.add("is-delayed");
      if (dot) dot.textContent = "Static answer";
      if (status) status.textContent = "Console 연결 지연 · 검증된 정적 전략 답안 유지";
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
      ".business-workload-matrix > article",
      ".business-ai-factory-roadmap > li",
      ".business-rag-maturity > article",
      ".business-fabric-stack > article",
      ".business-tco-metrics > article",
      ".business-tech-decision-grid > article",
      ".business-competitor-grid > article",
      ".business-execution-evidence-grid > article",
      ".business-automation-flow > li",
      ".business-status-rules > li",
      ".business-partnership-types > article",
      ".business-case-classification > article",
      ".business-macro-grid > article",
      ".business-role-fit-grid > article",
      ".business-role-outputs > article",
    ].join(","))];
    const darkSectionSelector = ".business-hero, .business-solutions, .business-partners, .business-about, .business-team-operating";
    cards.forEach((card, index) => {
      card.classList.add("business-consulting-motion");
      if (!card.dataset.hoverMode) {
        card.dataset.hoverMode = card.closest(darkSectionSelector) ? "dark-to-light" : "light-to-dark";
      }
      card.dataset.hoverModeResolved = "1";
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

  function gradientReadableSurface(value = "") {
    const colors = String(value || "").match(/(?:rgba?|color)\([^)]*\)/gi) || [];
    const samples = colors.map(colorChannels).filter(Boolean);
    if (!samples.length) return null;
    const averageAlpha = samples.reduce((sum, sample) => sum + sample.alpha, 0) / samples.length;
    if (averageAlpha < .6) return null;
    return [0, 1, 2].map((channel) => samples.reduce((sum, sample) => sum + sample.rgb[channel], 0) / samples.length);
  }

  function computedReadableSurface(style) {
    const gradient = style?.backgroundImage && style.backgroundImage !== "none"
      ? gradientReadableSurface(style.backgroundImage)
      : null;
    return gradient || parseRgb(style?.backgroundColor || "");
  }

  function cachedComputedStyle(node, cache) {
    if (!cache) return getComputedStyle(node);
    if (!cache.has(node)) cache.set(node, getComputedStyle(node));
    return cache.get(node);
  }

  function surfaceLuminance(node, styleCache = null, surfaceCache = null) {
    if (surfaceCache?.has(node)) return surfaceCache.get(node);
    const visited = [];
    let current = node;
    while (current && current !== document.documentElement) {
      visited.push(current);
      const rgb = computedReadableSurface(cachedComputedStyle(current, styleCache));
      if (rgb) {
        const channels = rgb.map((value) => {
          const normalized = value / 255;
          return normalized <= .03928 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4;
        });
        const luminance = .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
        visited.forEach((element) => surfaceCache?.set(element, luminance));
        return luminance;
      }
      current = current.parentElement;
    }
    visited.forEach((element) => surfaceCache?.set(element, 1));
    return 1;
  }

  function inferHoverContrastMode(card, styleCache = null, surfaceCache = null) {
    return surfaceLuminance(card, styleCache, surfaceCache) < .32 ? "dark-to-light" : "light-to-dark";
  }

  const READABILITY_TEXT_SELECTOR = [
    "h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "dd", "dt",
    "small", "strong", "b", "em", "span", "a", "button", "label", "time", "cite", "figcaption",
    "th", "td", "i", "text",
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

  function solidReadableSurface(node, styleCache = null, surfaceCache = null) {
    if (surfaceCache?.has(node)) return surfaceCache.get(node);
    const visited = [];
    let current = node;
    while (current && current !== document.documentElement) {
      visited.push(current);
      const style = cachedComputedStyle(current, styleCache);
      const gradient = gradientReadableSurface(style.backgroundImage);
      if (gradient) {
        visited.forEach((element) => surfaceCache?.set(element, gradient));
        return gradient;
      }
      const color = colorChannels(style.backgroundColor);
      if (color && color.alpha >= .6) {
        visited.forEach((element) => surfaceCache?.set(element, color.rgb));
        return color.rgb;
      }
      current = current.parentElement;
    }
    const fallback = [255, 255, 255];
    visited.forEach((element) => surfaceCache?.set(element, fallback));
    return fallback;
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

    const styleCache = new WeakMap();
    const surfaceCache = new WeakMap();
    const updates = [];
    let adjusted = 0;
    let errors = 0;
    for (const node of nodes) {
      try {
      if (!directReadableText(node) || node.closest("script, style, template, [hidden], [aria-hidden='true']")) continue;
      const style = cachedComputedStyle(node, styleCache);
      if (style.display === "none" || style.visibility === "hidden" || style.contentVisibility === "hidden") continue;

      const fontSize = Number.parseFloat(style.fontSize || "0");
      const needsFloor = Number.isFinite(fontSize) && fontSize < 12;
      if (needsFloor) adjusted += 1;

      const foreground = colorChannels(style.color);
      const opacity = Number.parseFloat(style.opacity || "1");
      const needsOpacity = Boolean(foreground && foreground.alpha < .72) || opacity < .72;

      let contrastMode = "";
      const background = solidReadableSurface(node, styleCache, surfaceCache);
      if (foreground && background) {
        const foregroundLum = relativeLuminance(foreground.rgb);
        const backgroundLum = relativeLuminance(background);
        const contrast = (Math.max(foregroundLum, backgroundLum) + .05) / (Math.min(foregroundLum, backgroundLum) + .05);
        if (contrast < 4.5) contrastMode = backgroundLum < .18 ? "ui-contrast-on-dark" : "ui-contrast-on-light";
      }
      updates.push({ node, needsFloor, needsOpacity, contrastMode });
      } catch {
        errors += 1;
      }
    }
    for (const update of updates) {
      if (update.needsFloor) update.node.classList.add("ui-text-floor");
      if (update.needsOpacity) update.node.classList.add("ui-readable-opacity");
      if (!update.contrastMode) continue;
      update.node.classList.remove("ui-contrast-on-dark", "ui-contrast-on-light");
      update.node.classList.add(update.contrastMode);
    }
    document.body.dataset.readabilityAdjusted = String(adjusted);
    document.body.dataset.readabilityErrors = String(errors);
    if (root === document.body || root === document.documentElement) applySparseConsoleEmphasis(document.body);
  }

  function setupReadabilityGuard() {
    if (!document.body || document.body.dataset.readabilityGuard === "1") return;
    document.body.dataset.readabilityGuard = "1";
    let copyTimer = 0;
    let auditFrame = 0;
    const pendingRoots = new Set();
    const auditRoots = new Set();
    const flushAudit = () => {
      auditFrame = 0;
      const roots = [...auditRoots];
      auditRoots.clear();
      roots.forEach((root) => {
        try { applyReadabilityGuard(root); } catch { /* keep later refreshes alive */ }
      });
    };
    const flushCopy = () => {
      copyTimer = 0;
      const roots = [...pendingRoots];
      pendingRoots.clear();
      roots.forEach((root) => {
        try {
          applyExecutiveCopyStyle(root, presentationPolicy?.readabilityPolicy || {});
          auditRoots.add(root);
        } catch { /* keep later refreshes alive */ }
      });
      if (!auditFrame) auditFrame = requestAnimationFrame(flushAudit);
    };
    const schedule = (root = document.body) => {
      const element = root?.nodeType === Node.TEXT_NODE ? root.parentElement : root;
      if (element) {
        const scopedRoot = element.closest?.("#intelligenceConsole .main > section") || element;
        for (const pending of [...pendingRoots]) {
          if (pending === scopedRoot || pending.contains?.(scopedRoot)) return;
          if (scopedRoot.contains?.(pending)) pendingRoots.delete(pending);
        }
        pendingRoots.add(scopedRoot);
      }
      if (!copyTimer) copyTimer = window.setTimeout(flushCopy, 80);
    };
    const scheduleSequence = (roots = [], delay = 0, onComplete = null) => {
      const queue = [...new Set(roots.filter(Boolean))];
      let cursor = 0;
      const next = () => scheduleIdleStep(() => {
        const root = queue[cursor++];
        if (root) schedule(root);
        if (cursor < queue.length) window.setTimeout(next, 90);
        else onComplete?.();
      }, 500);
      window.setTimeout(next, delay);
    };
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) schedule(node);
        });
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
    let sectionObserver = null;
    window.addEventListener("memory-console-ready", () => {
      const consoleRoot = document.querySelector("#intelligenceConsole") || document.body;
      const sections = [...consoleRoot.querySelectorAll(":scope .main > section")];
      const targets = sections.length ? sections : [consoleRoot];
      if (!("IntersectionObserver" in window)) {
        scheduleSequence(targets, 120, () => applySparseConsoleEmphasis(consoleRoot));
        return;
      }
      sectionObserver?.disconnect();
      sectionObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          schedule(entry.target);
          sectionObserver.unobserve(entry.target);
        }
      }, { rootMargin: "360px 0px", threshold: .01 });
      targets.forEach((section) => sectionObserver.observe(section));
      scheduleIdleStep(() => applySparseConsoleEmphasis(consoleRoot), 700);
    });
    window.__applyReadabilityGuard = applyReadabilityGuard;
    window.addEventListener("resize", () => {
      const visibleSection = document.elementFromPoint(window.innerWidth / 2, Math.min(window.innerHeight / 2, 480))?.closest("section");
      if (visibleSection) schedule(visibleSection);
    }, { passive: true });
    window.addEventListener("pagehide", () => {
      window.clearTimeout(copyTimer);
      observer.disconnect();
      sectionObserver?.disconnect();
    }, { once: true });
  }

  function applyPresentationPolicy(policy = {}) {
    presentationPolicy = policy || null;
    if (!site || !policy) return;
    const readability = policy.readabilityPolicy || {};
    const maxCharacters = Math.min(76, Math.max(56, Number(readability.bodyMaxCharacters || 68)));
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
    setupHeroMediaRotation();
    window.setTimeout(() => scheduleIdleStep(() => void loadSiteContent().then(scheduleConsoleAssetWarmup), 120), 80);
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
    setupBusinessNavObserver();
    void loadDecisionEvidence();
  }

  window.addEventListener("memory-console-ready", () => {
    finishConsoleStartup();
    applyUniversalSectionBindings(window.MEMORY_SITE_CONTENT || {});
  });

  function setupBusinessNavObserver() {
    if (businessNavObserver || !("IntersectionObserver" in window) || !businessSections.length) return;
    const visibleSections = new Map();
    businessNavObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visibleSections.set(entry.target, entry.boundingClientRect.top);
        else visibleSections.delete(entry.target);
      }
      const current = [...visibleSections.entries()].sort((a, b) => Math.abs(a[1]) - Math.abs(b[1]))[0]?.[0];
      if (current?.id) setActiveNav(current.id);
    }, { rootMargin: "-108px 0px -68% 0px", threshold: [0, .01] });
    businessSections.forEach((section) => businessNavObserver.observe(section));
  }

  function updateBusinessScrollState() {
    if (view !== "business") return;
    header?.classList.toggle("is-scrolled", window.scrollY > 18);
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
    setActiveNav(initialId);
    if (initialId !== "home") {
      requestAnimationFrame(() => document.getElementById(initialId)?.scrollIntoView({ behavior: "instant", block: "start" }));
    }
  }
})();
