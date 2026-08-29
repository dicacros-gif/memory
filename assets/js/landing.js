(() => {
  "use strict";

  const BUSINESS_TITLE = "AI Infra Planning · Customer Pain to Executive Action";
  const CONSOLE_HASH = "#console";
  const CONSOLE_REVISION = "infra-1b12e87b6ed0";
  const DECISION_CLIENT_PATH = "data/landing-decision-client.json";
  const SITE_CONTENT_PATH = "data/site-content-client.json";
  const SITE_CONTENT_EXTENDED_PATH = "data/site-content-extended-client.json";
  // Hangul renders immediately from the fallback stack, so the webfont is
  // requested after first paint and swaps in. Loading it from the document
  // head delayed the headline for a face that is not needed to read it.
  // The approved families: Helvetica (system) and Roboto for Latin, Pretendard
  // and Noto Sans KR for Hangul. All injected after first paint — the initial
  // HTML must not carry a webfont link, which the payload gates enforce.
  const FACE_SHEETS = [
    ["pretendard", "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"],
    ["roboto-noto", "https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&family=Noto+Sans+KR:wght@400;500;700;900&display=swap"],
  ];
  const loadKoreanFace = () => {
    for (const [face, href] of FACE_SHEETS) {
      if (document.querySelector(`link[data-approved-face="${face}"]`)) continue;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.dataset.approvedFace = face;
      document.head.appendChild(link);
    }
  };
  if ("requestIdleCallback" in window) window.requestIdleCallback(loadKoreanFace, { timeout: 2500 });
  else setTimeout(loadKoreanFace, 1200);

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
      // Preserve Console access even when an on-demand bundle is unavailable.
      // The static Console is independently deployable and requires no SPA boot.
      location.assign(new URL("console/", document.baseURI).href);
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
    const clauses = compact.split(/[,;]\s+|\s+(?:그리고|또한|다만)\s+/u).filter(Boolean);
    const selected = [];
    for (const clause of clauses) {
      const candidate = [...selected, clause].join(" · ");
      if (candidate.length > maxCharacters) break;
      selected.push(clause);
    }
    if (selected.length && selected.length < clauses.length) return selected.join(" · ");
    return compact;
  }

  const ISO_DATE = /\b20(\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/g;
  const YEAR_MONTH = /\b20(\d{2})-(0[1-9]|1[0-2])(?!-\d)/g;
  const YEAR_KO = /\b20(\d{2})년/g;
  const CURRENT_YEAR_SHORT = String(new Date().getFullYear()).slice(2);
  function shortenDatesIn(text) {
    return String(text)
      .replace(ISO_DATE, (_, yy, month, day) => (yy === CURRENT_YEAR_SHORT
        ? `${Number(month)}/${Number(day)}`
        : `'${yy} ${Number(month)}/${Number(day)}`))
      .replace(YEAR_MONTH, (_, yy, month) => `'${yy}.${Number(month)}월`)
      .replace(YEAR_KO, (_, yy) => `'${yy}년`);
  }
  function applyDateStyle(root = document.body) {
    if (!root || !root.ownerDocument) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const parent = node.parentElement;
      if (!parent || parent.closest("#intelligenceConsole, script, style, code, pre, time, input, textarea, [data-keep-date]")) continue;
      const next = shortenDatesIn(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
    }
  }
  // A heading that wraps between a word and its separator leaves the middle dot
  // alone at the start of the next line, which reads as a typo. Binding the dot
  // to the word before it with a no-break space moves the break to the word
  // after the dot instead. Rendering is otherwise identical.
  function keepSeparatorsAttached(root = document.body) {
    if (!root || !root.querySelectorAll) return;
    for (const heading of root.querySelectorAll("h1, h2, h3, h4, .eyebrow, .business-kicker")) {
      if (heading.closest("[data-copy-verbatim]")) continue;
      for (const node of heading.childNodes) {
        if (node.nodeType !== Node.TEXT_NODE) continue;
        const next = String(node.nodeValue || "").replace(/ (?=[·→])/g, "\u00a0");
        if (next !== node.nodeValue) node.nodeValue = next;
      }
    }
    // A <br> with nothing but markup in front of it makes textContent read
    // "Painto". The copy rewriter collapses and trims every text node it
    // touches, so the space has to be restored after it runs, not before.
    for (const brk of root.querySelectorAll("br")) {
      if (brk.closest("[data-copy-verbatim]")) continue;
      const previous = brk.previousSibling;
      if (!previous || previous.nodeType !== Node.TEXT_NODE) continue;
      const value = String(previous.nodeValue || "");
      if (!value || /\s$/.test(value)) continue;
      previous.nodeValue = `${value} `;
    }
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
    keepSeparatorsAttached(root);
  }

  function renderBusinessList(node, items = []) {
    if (!node || !Array.isArray(items) || !items.length) return;
    const preserveFullCopy = node.hasAttribute("data-copy-verbatim");
    const preparedItems = items
      .map((item) => preserveFullCopy
        ? removeBusinessSentenceStops(removeDiscardedBusinessSentence(item))
        : compactBusinessCopy(item, 78))
      .filter(Boolean);
    if (node.matches(".business-hero-bullets")) {
      node.innerHTML = preparedItems.map((item) => {
        const [label, ...detail] = String(item).split(" · ");
        return `<li><b>${escapeBusinessHTML(label)}</b><span>${escapeBusinessHTML(detail.join(" · "))}</span></li>`;
      }).join("");
      return;
    }
    node.innerHTML = preparedItems.map((item) => `<li>${escapeBusinessHTML(item)}</li>`).join("");
  }

  // A date stamp only when there is a date; no placeholder stands in for one.
  const evidenceStamp = (value) => {
    const date = String(value || "").slice(0, 10);
    return date ? ` · ${escapeBusinessHTML(shortenDatesIn(date))} ↗` : "";
  };
  function renderDecisionContent(content = {}) {
    // Some cases have no panel on this page, so the authored indices run 01,
    // 02, 03, 06 once the others are skipped. The strip numbers what it
    // actually shows.
    let shown = 0;
    for (const decision of content.decisionCases || []) {
      const panel = document.querySelector(`[data-decision-panel="${CSS.escape(decision.panelId || "")}"]`);
      if (!panel) continue;
      shown += 1;
      const tab = document.querySelector(`[data-decision-tab="${CSS.escape(decision.panelId || "")}"]`);
      if (tab) tab.textContent = `${String(shown).padStart(2, "0")} · ${decision.tabLabel || decision.title}`;
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
          <small>최신 근거 · ${escapeBusinessHTML(({ reported: "보도", watch: "관측", official: "공식", "official baseline": "공식 기준" }[String(signal.evidenceLevel || "").toLowerCase()] || "관측"))}</small>
          <strong>${escapeBusinessHTML(signal.title)}</strong>
          <a href="${escapeBusinessHTML(safeBusinessUrl(signal.url, "#console"))}" target="_blank" rel="noopener noreferrer">${escapeBusinessHTML(signal.source || "원문")}${evidenceStamp(signal.publishedAt)}</a>
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
            <dl><div><dt>SOURCE</dt><dd>${escapeBusinessHTML(latest.source || "근거 연결 대기")}</dd></div><div><dt>AS OF</dt><dd>${escapeBusinessHTML(String(latest.publishedAt || "").slice(0, 10) || "확인 필요")}</dd></div><div><dt>EVIDENCE</dt><dd>${escapeBusinessHTML(item.evidenceCount || 0)}건</dd></div></dl>
            <ol class="business-evidence-decision-path">
              <li><span>01 · FACT</span><strong>${escapeBusinessHTML(item.fact)}</strong></li>
              <li><span>02 · IMPLICATION</span><strong>${escapeBusinessHTML(item.implication)}</strong></li>
              <li><span>03 · DECISION</span><strong>${escapeBusinessHTML(item.decision)}</strong></li>
              <li><span>04 · ACTION / KILL</span><strong>${escapeBusinessHTML(item.action)}</strong></li>
            </ol>
            <a href="${escapeBusinessHTML(href)}" target="_blank" rel="noopener noreferrer">${escapeBusinessHTML(latest.source || "Console 근거 보기")}${evidenceStamp(latest.publishedAt)}</a>
          </article>`;
      }).join("");
      const caveat = document.querySelector(".business-execution-evidence > .business-evidence-caveat");
      if (caveat) caveat.textContent = "";
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
    // The coverage tally read as instrumentation rather than a decision, so it
    // is no longer printed. The counts stay in system.automation for the
    // pipeline that needs them.
    if (status) {
      status.textContent = "";
      status.hidden = true;
    }

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
          ? `<a href="${escapeBusinessHTML(safeBusinessUrl(evidence.url, "#console"))}" target="_blank" rel="noopener noreferrer">${escapeBusinessHTML(evidence.source || "원문")}${evidenceStamp(evidence.publishedAt)}</a>`
          : `<span>${escapeBusinessHTML(evidence.title || "최신 근거 관측 대기")}</span>`;
        return `<article data-workload-contract="${escapeBusinessHTML(workload.id)}"><span>${String(index + 1).padStart(2, "0")} · ${escapeBusinessHTML(workload.label)}</span><h4>${escapeBusinessHTML(workload.northStar)}</h4><dl><div><dt>BOTTLENECK</dt><dd>${escapeBusinessHTML((workload.bottlenecks || []).join(" · "))}</dd></div><div><dt>KPI CONTRACT</dt><dd>${escapeBusinessHTML((workload.kpis || []).join(" · "))}</dd></div><div><dt>CAPACITY PATH</dt><dd>${escapeBusinessHTML(workload.capacityMode || "검증 후 결정")}</dd></div><div><dt>EVIDENCE</dt><dd>${evidenceLine}</dd></div></dl></article>`;
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
    const seenSources = new Set();
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
        ${(() => {
          const href = safeBusinessUrl(item.sourceUrl, "#console");
          if (!href || seenSources.has(href)) return "";
          seenSources.add(href);
          return `<div><a href="${escapeBusinessHTML(safeBusinessUrl(item.sourceUrl, "#console"))}" target="_blank" rel="noopener noreferrer">${escapeBusinessHTML(item.source || "근거") } ↗</a></div>`;
        })()}
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
        // The stage answers a question and is judged on a metric. Both are
        // painted into their own nodes so the copy stays one clause per line
        // instead of one long sentence that wraps.
        const copy = stage.querySelector(".business-spine-copy");
        // Named directly rather than derived from a selector: deriving it
        // silently produced an invalid attribute name, so every hydration
        // pass appended another copy of the same line.
        const paint = (attribute, value, before) => {
          if (!copy) return;
          let node = copy.querySelector(`[${attribute}]`);
          if (!value) { node?.remove(); return; }
          if (!node) {
            node = document.createElement("span");
            node.setAttribute(attribute, "");
            copy.insertBefore(node, before || null);
          }
          node.textContent = value;
        };
        paint("data-flow-ask", item.ask, detailNode || null);
        paint("data-flow-metric", item.metric, null);
        stage.setAttribute("aria-label", [stepLabel, item.title, item.ask, item.detail, item.metric].filter(Boolean).join(" · "));
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
          <small>${escapeBusinessHTML(item.action90d || "고객 합의 Gate")}</small>
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
      // The card used to be one anchor into the console, so every click left the
      // home page. It now reads on its own: the card opens the company profile in
      // place, and the console is one explicit link the reader chooses.
      host.innerHTML = accounts.map((account) => `
        <article data-company-id="${escapeBusinessHTML(account.id || "")}" style="--account-accent:${escapeBusinessHTML(account.accent || "#0A84B8")}">
          <span><button type="button" data-company-id="${escapeBusinessHTML(account.id || "")}">${escapeBusinessHTML(account.company || "")}</button></span>
          <strong>${escapeBusinessHTML(account.chip || "")}</strong>
          <small>${escapeBusinessHTML(account.pain || "")}</small>
          <b>MEMORY MOVE<br />${escapeBusinessHTML(account.memory || "맞춤형 Memory Proposal")}</b>
          <em>INSIGHT<br />${escapeBusinessHTML([account.chipStage, account.gate].filter(Boolean).join(" → ") || "다음 검증 Gate 확인")}</em>

        </article>`).join("");
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
          <dl>${(account.designPartners || []).length ? `<div><dt>DESIGN PARTNER</dt><dd>${(account.designPartners || []).map((partner) => `${escapeBusinessHTML(partner.company)}<i data-partner-grade="${escapeBusinessHTML(partner.grade)}">${escapeBusinessHTML(partner.grade)}</i>`).join(" · ")}</dd></div>` : ""}<div><dt>PAIN</dt><dd>${escapeBusinessHTML((strategy.pains || []).join(" · "))}</dd></div><div><dt>SKH OPTION</dt><dd>${escapeBusinessHTML((strategy.proposal || []).join(" · "))}</dd></div><div><dt>90D GATE</dt><dd>${escapeBusinessHTML(strategy.gate90d || account.gate || "")}</dd></div></dl>
          
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
      // A bare <br> between the two lines joins them in textContent ("Painto"),
      // which is what a screen reader, a copy-paste and in-page search all read.
      // The trailing space renders identically and keeps the words apart.
      title.innerHTML = `${escapeBusinessHTML(first)} <br><em>${escapeBusinessHTML(rest.join(" "))}</em>`;
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
    applyFrameworkAsOf(content);
  }

  // Frames that argue Source → ClaimEvent → Decision while carrying no date of
  // their own read as the one part of the page nobody checked. These six are
  // approved framework rather than observation, so the stamp says which of the
  // two it is and takes its date from the content build — the same generatedAt
  // already written to data-content-updated-at — instead of asserting an
  // observation that never happened.
  const FRAMEWORK_ASOF_SECTIONS = [
    "decision-automation",
    "initiatives",
    "competencies",
    "aiFactoryKpiTree",
    "ragOperatingModel",
    "departmentDecisionQueue",
    "deep-cases",
    "macro",
  ];

  function applyFrameworkAsOf(content = {}) {
    const day = String(content.generatedAt || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return 0;
    const label = shortenDatesIn(day);
    let stamped = 0;
    for (const id of FRAMEWORK_ASOF_SECTIONS) {
      const section = document.getElementById(id);
      if (!section) continue;
      let stamp = section.querySelector("[data-section-asof]");
      if (!stamp) {
        stamp = document.createElement("p");
        stamp.className = "business-section-asof";
        stamp.dataset.sectionAsof = "1";
        const host = section.querySelector(":scope > .business-container") || section;
        host.insertBefore(stamp, host.firstChild);
      }
      const basis = section.dataset.contentArtifact === "siteContent"
        ? "승인 프레임 + 검증 데이터"
        : "검증 데이터";
      const time = document.createElement("time");
      time.dateTime = day;
      time.textContent = label;
      // Two elements, no separator text: the copy normaliser collapses a space
      // before an inline element ("기준 ·8/27"), and a separator carried as its
      // own aria-hidden span is skipped by the readability guard, so it kept a
      // light-surface ink on the two frames that sit on dark ground. The dot is
      // drawn by CSS on the label, in the label's own colour.
      const basisLabel = document.createElement("span");
      basisLabel.textContent = `${basis} 기준`;
      stamp.replaceChildren(basisLabel, time);
      stamped += 1;
    }
    document.body.dataset.frameworkAsOfSections = String(stamped);
    return stamped;
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

  // A feed title often ends in the outlet's own name, which the card already
  // prints under it as the source link — and prints correctly, where the
  // headline suffix is whatever the aggregator typed.
  function stripSourceSuffix(title, source) {
    const raw = String(title || "").trim();
    const name = String(source || "").trim();
    if (!raw || !name) return raw;
    const compact = (value) => value.toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
    const match = raw.match(/^(.*?)[\s]*[-–—|·][\s]*([^-–—|·]{2,40})$/);
    if (!match) return raw;
    const tail = compact(match[2]);
    const outlet = compact(name);
    if (!tail || !outlet) return raw;
    // Aggregators double a letter often enough to matter ("digittimes" for
    // "digitimes"), so a run of the same character counts as one. A different
    // misspelling keeps the suffix rather than risking a cut into the headline.
    const squash = (value) => value.replace(/(.)\1+/g, "$1");
    const echoes = tail === outlet
      || tail.includes(outlet)
      || outlet.includes(tail)
      || squash(tail) === squash(outlet);
    return echoes ? match[1].trim() : raw;
  }

  // Korean nouns carry their particle, so a plain token match reads two forms
  // of the same word as two words.
  const BRIEF_PARTICLE = /(은|는|이|가|을|를|의|에|에서|으로|로|와|과|도|만|보다|까지|부터|인|한)$/;
  const BRIEF_ENDING = /(합니다|습니다|입니다|했습니다|됩니다|한다|이다)$/;
  // Tokens that identify a claim: a figure, or a Latin term long enough to be a
  // product or a company rather than an acronym everybody uses.
  const BRIEF_GENERIC_LATIN = new Set(["ai", "the", "and", "for", "with", "per"]);

  function briefTokens(value) {
    return String(value || "")
      .toLowerCase()
      .split(/[^0-9a-z가-힣%$]+/)
      .filter((token) => token.length > 1)
      .map((token) => token.replace(BRIEF_ENDING, "").replace(BRIEF_PARTICLE, ""))
      .filter((token) => token.length > 1);
  }

  function briefSignals(tokens) {
    return tokens.filter((token) => /[0-9]/.test(token)
      || (/^[a-z0-9]+$/.test(token) && token.length >= 3 && !BRIEF_GENERIC_LATIN.has(token)));
  }

  // Feeds routinely open the summary by restating the headline, so the card
  // said the same thing twice before it said anything new. A sentence is
  // dropped only when it both adds no identifying token the headline lacks and
  // is largely built from the headline's own words — a sentence carrying a
  // fact of its own fails the first test and survives.
  function dropHeadlineEcho(summary, title) {
    const body = String(summary || "").trim();
    if (!body || !title) return body;
    const sentences = body.split(/(?<=[.!?])\s+/).filter((part) => part.trim());
    if (sentences.length < 2) return body;
    const titleTokens = new Set(briefTokens(title));
    const titleSignals = new Set(briefSignals([...titleTokens]));
    const kept = [];
    for (const sentence of sentences) {
      const tokens = briefTokens(sentence);
      if (!tokens.length) continue;
      const unique = [...new Set(tokens)];
      const newSignals = briefSignals(unique).filter((token) => !titleSignals.has(token));
      const shared = unique.filter((token) => titleTokens.has(token)).length / unique.length;
      if (!kept.length && !newSignals.length && shared >= .4) continue;
      kept.push(sentence.trim());
    }
    return kept.length ? kept.join(" ") : body;
  }

  function updateDecisionBrief(panel, brief) {
    if (!panel || !brief?.latest) return;
    const latest = brief.latest;
    const title = panel.querySelector("[data-live-title]");
    const summary = panel.querySelector("[data-live-summary]");
    const source = panel.querySelector("[data-live-source]");
    const headline = stripSourceSuffix(latest.title, latest.source);
    if (title && headline) title.textContent = headline;
    if (summary && latest.summary) {
      const summaryCopy = dropHeadlineEcho(removeDiscardedBusinessSentence(latest.summary), headline);
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
      setDecisionMetric("quality-status", [quality, freshness.label].filter(Boolean).join(" · "));
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
      ".business-rag-operating-model > ol > li",
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
      ".business-kill-gate-grid > article",
      ".business-kpi-tree > div > article",
      ".business-framework-panel",
      ".strategy-solution-system > *",
    ].join(","))];
    const darkSectionSelector = ".business-hero, .business-solutions, .business-partners, .business-about, .business-team-operating";
    // Cards that render on light panels inside a dark section were resolving to
    // dark-to-light, so hovering barely tinted them; they must flip dark.
    const lightPanelSelector = ".business-solution-card, .business-kill-gates, .business-kpi-tree, .strategy-solution-system, .business-pain-framework";
    cards.forEach((card, index) => {
      card.classList.add("business-consulting-motion");
      if (!card.dataset.hoverMode) {
        card.dataset.hoverMode = card.closest(darkSectionSelector) ? "dark-to-light" : "light-to-dark";
      }
      if (card.closest(lightPanelSelector)) card.dataset.hoverMode = "light-to-dark";
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
    const sample = colorChannels(value);
    if (!sample || sample.alpha < .35) return null;
    return sample.rgb;
  }

  function gradientReadableSurface(value = "") {
    const colors = String(value || "").match(/(?:rgba?|color|oklab|oklch)\([^)]*\)/gi) || [];
    const samples = colors.map(colorChannels).filter(Boolean);
    if (!samples.length) return null;
    // Averaging every stop let one `rgba(0, 0, 0, 0)` stop pull an opaque dark
    // gradient toward the light end, and the mean-alpha gate then discarded the
    // layer entirely — which is how a dark section resolved to the light `main`
    // underneath it and its ink was tagged for a light surface. The stop that
    // actually covers the box is the most opaque one.
    const dominant = samples.reduce((best, sample) => (sample.alpha > best.alpha ? sample : best), samples[0]);
    if (dominant.alpha < .35) return null;
    return dominant.rgb;
  }

  function splitBackgroundLayers(value = "") {
    const parts = [];
    let depth = 0;
    let start = 0;
    for (let index = 0; index < value.length; index += 1) {
      const character = value[index];
      if (character === "(") depth += 1;
      else if (character === ")") depth -= 1;
      else if (character === "," && depth === 0) {
        parts.push(value.slice(start, index));
        start = index + 1;
      }
    }
    parts.push(value.slice(start));
    return parts.map((part) => part.trim()).filter(Boolean);
  }

  function compositeOver(sample, base) {
    const alpha = Math.min(Math.max(Number(sample.alpha ?? 1), 0), 1);
    return [0, 1, 2].map((channel) => sample.rgb[channel] * alpha + base[channel] * (1 - alpha));
  }

  // Bottom-most paint layer first: the background-color, then each
  // background-image layer in paint order (CSS paints the first-listed image
  // layer on top of the ones after it).
  function backgroundPaintLayers(style) {
    const layers = [];
    const base = colorChannels(style?.backgroundColor || "");
    if (base && base.alpha > 0) layers.push({ stops: [base], allowsBase: false });
    const image = style?.backgroundImage || "";
    if (image && image !== "none") {
      const parts = splitBackgroundLayers(image);
      for (let index = parts.length - 1; index >= 0; index -= 1) {
        const declared = (parts[index].match(/(?:rgba?|color|oklab|oklch)\([^)]*\)/gi) || [])
          .map(colorChannels)
          .filter(Boolean);
        const stops = declared.filter((sample) => sample.alpha > 0);
        // The layer beneath is only reachable where a stop is fully
        // transparent — a radial that fades out, not a flat 9% tint.
        if (stops.length) layers.push({ stops, allowsBase: declared.some((sample) => sample.alpha < .05) });
      }
    }
    return layers;
  }

  function dedupeSurfaces(surfaces) {
    const seen = new Set();
    const unique = [];
    for (const surface of surfaces) {
      const key = surface.map((channel) => Math.round(channel / 4)).join(":");
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(surface);
    }
    return unique;
  }

  // Every surface a run of text can actually land on, alpha-composited from the
  // nearest opaque ancestor upward. A translucent wash over an opaque light
  // `main` is neither the wash nor `main` — it is the blend, and reading either
  // end of that stack on its own is what produced ink that measured 1.0:1.
  function readableSurfaceCandidates(node, styleCache = null, surfaceCache = null) {
    if (surfaceCache?.has(node)) return surfaceCache.get(node);
    const stack = [];
    let current = node;
    while (current) {
      const style = cachedComputedStyle(current, styleCache);
      stack.push(backgroundPaintLayers(style));
      // An opaque background-colour is the floor of that element's paint: its
      // own background-image sits on top of it, and nothing below it can show
      // through, so the walk stops here even when the element has an image.
      const base = colorChannels(style.backgroundColor || "");
      if (base && base.alpha >= .999) break;
      current = current.parentElement;
    }
    let candidates = [[255, 255, 255]];
    for (let index = stack.length - 1; index >= 0; index -= 1) {
      for (const layer of stack[index]) {
        const next = [];
        for (const base of candidates) {
          for (const stop of layer.stops) next.push(compositeOver(stop, base));
          if (layer.allowsBase) next.push(base);
        }
        candidates = dedupeSurfaces(next).slice(0, 6);
      }
    }
    surfaceCache?.set(node, candidates);
    return candidates;
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

  function cssColorNumber(token = "", percentScale = 1) {
    const source = String(token || "").trim().toLowerCase();
    if (!source || source === "none") return 0;
    const number = Number.parseFloat(source);
    if (!Number.isFinite(number)) return null;
    return source.endsWith("%") ? number * percentScale / 100 : number;
  }

  function oklabToSrgb(lightness, axisA, axisB) {
    const lRoot = lightness + .3963377774 * axisA + .2158037573 * axisB;
    const mRoot = lightness - .1055613458 * axisA - .0638541728 * axisB;
    const sRoot = lightness - .0894841775 * axisA - 1.291485548 * axisB;
    const l = lRoot ** 3;
    const m = mRoot ** 3;
    const s = sRoot ** 3;
    const linear = [
      4.0767416621 * l - 3.3077115913 * m + .2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s,
      -.0041960863 * l - .7034186147 * m + 1.707614701 * s,
    ];
    return linear.map((channel) => {
      const encoded = channel <= .0031308
        ? 12.92 * channel
        : 1.055 * (Math.max(0, channel) ** (1 / 2.4)) - .055;
      return Math.min(255, Math.max(0, encoded * 255));
    });
  }

  function colorChannels(value = "") {
    const source = String(value || "").trim().toLowerCase();
    const functional = source.match(/^(oklab|oklch)\((.*)\)$/i);
    if (functional) {
      const [coordinates = "", alphaToken = "1"] = functional[2].split("/").map((part) => part.trim());
      const tokens = coordinates.split(/\s+/).filter(Boolean);
      if (tokens.length >= 3) {
        const lightness = cssColorNumber(tokens[0], 1);
        let axisA = cssColorNumber(tokens[1], .4);
        let axisB = cssColorNumber(tokens[2], .4);
        if (functional[1].toLowerCase() === "oklch") {
          const chroma = axisA;
          const hueToken = String(tokens[2] || "0").toLowerCase();
          const hueValue = Number.parseFloat(hueToken) || 0;
          const hueDegrees = hueToken.endsWith("turn") ? hueValue * 360
            : hueToken.endsWith("rad") ? hueValue * 180 / Math.PI
              : hueToken.endsWith("grad") ? hueValue * .9
                : hueValue;
          const radians = hueDegrees * Math.PI / 180;
          axisA = chroma * Math.cos(radians);
          axisB = chroma * Math.sin(radians);
        }
        const alpha = cssColorNumber(alphaToken, 1);
        if ([lightness, axisA, axisB, alpha].every(Number.isFinite)) {
          return { rgb: oklabToSrgb(lightness, axisA, axisB), alpha: Math.min(1, Math.max(0, alpha)) };
        }
      }
    }
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

  // The two inks .ui-contrast-on-dark / .ui-contrast-on-light actually paint,
  // kept here so the measurement and the stylesheet cannot drift apart.
  const READABILITY_INK_MODES = [
    ["ui-contrast-on-dark", [247, 251, 255]],
    ["ui-contrast-on-light", [6, 21, 35]],
  ];

  function contrastRatio(foreground, background) {
    const a = relativeLuminance(foreground);
    const b = relativeLuminance(background);
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  }

  function relativeLuminance(rgb = []) {
    const channels = rgb.map((value) => {
      const normalized = value / 255;
      return normalized <= .03928 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4;
    });
    return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
  }

  function solidReadableSurface(node, styleCache = null, surfaceCache = null) {
    const candidates = readableSurfaceCandidates(node, styleCache, surfaceCache);
    return candidates[0] || [255, 255, 255];
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

  // Text painted straight onto the console shell inherits the shell theme and
  // is left to it. A card inside the sidebar that paints its own opaque
  // surface is a different question: the ticker monograms sit on white chips
  // inside the navy rail and measured 1.31:1 there, because the blanket
  // exemption stopped anyone from looking.
  function paintsOwnSurface(node, boundary, styleCache = null) {
    let current = node;
    while (current && current !== boundary) {
      const base = colorChannels(cachedComputedStyle(current, styleCache).backgroundColor || "");
      if (base && base.alpha >= .999) return true;
      current = current.parentElement;
    }
    return false;
  }

  function floatingChrome(node, styleCache = null) {
    let current = node;
    while (current && current !== document.body) {
      const style = cachedComputedStyle(current, styleCache);
      // An opaque surface between the text and the floating ancestor settles
      // the question on its own — a white chip inside a sticky ticker bar is
      // still a white chip. Only text that would have to read against whatever
      // is scrolling underneath is left to its own stylesheet.
      const base = colorChannels(style.backgroundColor || "");
      if (base && base.alpha >= .999) return false;
      if (style.position === "fixed" || style.position === "sticky") return true;
      current = current.parentElement;
    }
    return false;
  }

  function applyReadabilityGuard(root = document.body) {
    if (!root) return;
    const nodes = [];
    if (root.nodeType === Node.ELEMENT_NODE && root.matches?.(READABILITY_TEXT_SELECTOR)) nodes.push(root);
    if (root.querySelectorAll) nodes.push(...root.querySelectorAll(READABILITY_TEXT_SELECTOR));

    // Measure the ink the stylesheet asks for, not the ink a previous pass
    // already substituted. Leaving last pass's tag on meant the second audit
    // saw a passing colour, cleared the tag as no longer needed, and handed
    // the element back the unreadable colour it started with — every re-audit
    // undid the one before it.
    for (const node of nodes) node.classList.remove("ui-contrast-on-dark", "ui-contrast-on-light");

    const styleCache = new WeakMap();
    const surfaceCache = new WeakMap();
    const updates = [];
    let adjusted = 0;
    let errors = 0;
    for (const node of nodes) {
      try {
      if (!directReadableText(node) || node.closest("script, style, template, [hidden], [aria-hidden='true']")) continue;

      // Console chrome owns its contrast through explicit theme and interaction
      // rules. Automatic tags measured during a previous theme/hover state can
      // otherwise survive inversion and turn the light topbar white-on-white or
      // the permanent navy sidebar dark-on-dark. Leave chrome to its CSS contract.
      const chrome = node.closest("#intelligenceConsole .sidebar, #intelligenceConsole .topbar");
      if (chrome && !paintsOwnSurface(node, chrome, styleCache)) {
        node.classList.remove("ui-contrast-on-dark", "ui-contrast-on-light");
        continue;
      }

      // QA cards own an explicit, atomic surface/ink pair. Tagging their copy
      // from a resting or outgoing hover surface can leave the old ink visible
      // after the CSS surface has already changed.
      if (node.closest(".qa-dropdown, .answer-panel")) {
        node.classList.remove("ui-contrast-on-dark", "ui-contrast-on-light");
        continue;
      }

      // A fixed or sticky bar paints over whatever is scrolled beneath it,
      // which its ancestor chain cannot describe: measured at the top of the
      // page the header resolved to the light page ground and took the dark
      // ink, and the dark bar then scrolled in behind that ink.
      if (floatingChrome(node, styleCache)) continue;
      const style = cachedComputedStyle(node, styleCache);
      if (style.display === "none" || style.visibility === "hidden" || style.contentVisibility === "hidden") continue;

      const fontSize = Number.parseFloat(style.fontSize || "0");
      const compactDiagram = Boolean(node.closest(".business-decision-spine"));
      const compactFloor = compactDiagram
        && (node.classList.contains("ui-text-floor-compact") || (Number.isFinite(fontSize) && fontSize < 10));
      const needsFloor = !compactDiagram
        && (node.classList.contains("ui-text-floor") || (Number.isFinite(fontSize) && fontSize < 12));

      const isHeroHeading = node.matches("h1, h2")
        && Boolean(node.closest(".business-hero, .memory-video-hero, .console-hero, .hero"));
      const mobileHero = Boolean(window.matchMedia?.("(max-width: 640px)").matches);
      let headingCap = "";
      if (node.matches("h1, h2")) {
        if (node.classList.contains("ui-heading-hero-cap")
          || (isHeroHeading && Number.isFinite(fontSize) && fontSize > (mobileHero ? 44 : 56))) {
          headingCap = "ui-heading-hero-cap";
        } else if (node.classList.contains("ui-heading-section-cap")
          || (Number.isFinite(fontSize) && fontSize > 46)) {
          headingCap = "ui-heading-section-cap";
        }
      } else if (node.matches("h3, h4")
        && (node.classList.contains("ui-heading-subsection-cap")
          || (Number.isFinite(fontSize) && fontSize > 32))) {
        headingCap = "ui-heading-subsection-cap";
      }
      if (needsFloor || compactFloor || headingCap) adjusted += 1;

      // -webkit-text-fill-color is what actually paints the glyphs, and several
      // console modules set it alongside a different `color`. Measuring `color`
      // there reports a pair that passes while the reader sees one that does
      // not - dark ink on a dark card at 1.01:1.
      const paintedInk = style.webkitTextFillColor && style.webkitTextFillColor !== "currentcolor"
        ? style.webkitTextFillColor
        : style.color;
      const foreground = colorChannels(paintedInk);
      const opacity = Number.parseFloat(style.opacity || "1");
      const needsOpacity = Boolean(foreground && foreground.alpha < .72) || opacity < .72;

      let contrastMode = "";
      const surfaces = readableSurfaceCandidates(node, styleCache, surfaceCache);
      if (foreground && surfaces.length) {
        const scoreInk = (ink) => surfaces.reduce(
          (worst, surface) => Math.min(worst, contrastRatio(ink.alpha < .999 ? compositeOver(ink, surface) : ink.rgb, surface)),
          Infinity,
        );
        const authored = scoreInk(foreground);
        if (authored < 4.5) {
          // Picking the tag from the surface's absolute luminance needs a
          // cut-off, and every cut-off is wrong somewhere: a saturated blue
          // panel sat just above it and took the dark ink, which measured
          // 1.14:1 on it. Score both inks the utility classes can supply and
          // take whichever actually reads — and if neither beats what the
          // author wrote, leave the author's colour alone.
          let bestScore = authored;
          for (const [mode, rgb] of READABILITY_INK_MODES) {
            const score = scoreInk({ rgb, alpha: 1 });
            if (score > bestScore) {
              bestScore = score;
              contrastMode = mode;
            }
          }
        }
      }
      updates.push({ node, needsFloor, compactFloor, headingCap, needsOpacity, contrastMode });
      } catch {
        errors += 1;
      }
    }
    for (const update of updates) {
      if (update.compactFloor) {
        update.node.classList.remove("ui-text-floor");
        update.node.classList.add("ui-text-floor-compact");
      } else if (update.needsFloor) {
        update.node.classList.remove("ui-text-floor-compact");
        update.node.classList.add("ui-text-floor");
      }
      if (update.headingCap) update.node.classList.add(update.headingCap);
      if (update.needsOpacity) update.node.classList.add("ui-readable-opacity");
      update.node.classList.remove("ui-contrast-on-dark", "ui-contrast-on-light");
      if (update.contrastMode) update.node.classList.add(update.contrastMode);
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
          applyDateStyle(root);
          applyExecutiveCopyStyle(root, presentationPolicy?.readabilityPolicy || {});
          auditRoots.add(root);
        } catch { /* keep later refreshes alive */ }
      });
      if (!auditFrame) {
        auditFrame = document.visibilityState === "hidden"
          ? window.setTimeout(flushAudit, 32)
          : requestAnimationFrame(flushAudit);
      }
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
    const scheduleAudit = (root) => {
      if (!root?.nodeType || root.nodeType !== Node.ELEMENT_NODE) return;
      for (const pending of [...auditRoots]) {
        if (pending === root || pending.contains?.(root)) return;
        if (root.contains?.(pending)) auditRoots.delete(pending);
      }
      auditRoots.add(root);
      if (!auditFrame) {
        auditFrame = document.visibilityState === "hidden"
          ? window.setTimeout(flushAudit, 32)
          : requestAnimationFrame(flushAudit);
      }
    };

    const INTERACTION_SCOPE = [
      "article", "li", "tr", "a", "button", "summary", "label",
      "[class*='-card']", "[class*='-row']", "[class*='-tile']", "[class*='-node']",
      "[class*='-chip']", "[class*='-item']", "[class*='-step']",
    ].join(",");
    const auditInteraction = (event) => {
      const element = event.target?.nodeType === Node.ELEMENT_NODE
        ? event.target
        : event.target?.parentElement;
      if (!element?.closest) return;
      const surface = element.closest(INTERACTION_SCOPE) || element;
      // QA inversion is CSS-only: no asynchronous read/write cycle on entry
      // or exit, so the resting colour returns in the very same paint.
      if (surface.closest(".qa-dropdown, .answer-panel")) return;
      scheduleAudit(surface);
    };
    document.addEventListener("pointerover", auditInteraction, { passive: true, capture: true });
    document.addEventListener("pointerout", auditInteraction, { passive: true, capture: true });
    document.addEventListener("focusin", auditInteraction, { passive: true, capture: true });
    document.addEventListener("focusout", auditInteraction, { passive: true, capture: true });

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // A tab panel that was hidden was never audited: the guard skips
        // anything not being rendered. Switching to it then showed the raw
        // authored sizes — a 42px heading where the audited panel beside it
        // reads 32px, and a 9px kicker where the audited one reads 12px. The
        // same card looked like two different cards depending on which tab
        // you were on. Revealing a subtree is a reason to measure it.
        if (mutation.type === "attributes") {
          const target = mutation.target;
          if (target?.nodeType === Node.ELEMENT_NODE && !target.hasAttribute("hidden")) schedule(target);
          continue;
        }
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) schedule(node);
        });
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      // hidden and aria-hidden only: the guard writes classes itself, and
      // observing those would have it retrigger on its own output.
      attributeFilter: ["hidden", "aria-hidden"],
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
    const initialBusinessSections = [...document.querySelectorAll("#businessSite > main > section")];
    scheduleSequence(initialBusinessSections.length ? initialBusinessSections : [document.body], 120);
    window.__applyReadabilityGuard = applyReadabilityGuard;
    window.__readableSurfaceCandidates = readableSurfaceCandidates;
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
    window.setTimeout(() => { try { applyDateStyle(document.body); } catch { /* display only */ } }, 1200);
    window.setTimeout(() => { try { applyDateStyle(document.body); } catch { /* display only */ } }, 4000);
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
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      void openConsole();
    });
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
