(() => {
  "use strict";

  const BUSINESS_TITLE = "AI Infra Strategy OS · Workload to Revenue";
  const CONSOLE_HASH = "#console";
  const CONSOLE_REVISION = "infra-20260816-08";
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
  let businessReady = false;
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

  function ensurePreload(id, as, href, priority = "auto") {
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "preload";
    link.as = as;
    link.href = href;
    link.fetchPriority = priority;
    document.head.appendChild(link);
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

  function renderBusinessList(node, items = []) {
    if (!node || !Array.isArray(items) || !items.length) return;
    node.innerHTML = items.map((item) => `<li>${escapeBusinessHTML(item)}</li>`).join("");
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

  function renderCompetitorContent(content = {}) {
    const competitors = content.competitors || [];
    if (!competitors.length) return;
    const heading = document.querySelector(".business-competitor-benchmark .business-module-heading p");
    if (heading) heading.textContent = `${competitors.map((item) => item.asOf).filter(Boolean)[0] || String(content.generatedAt || "").slice(0, 10)} 기준 · 동일 출처·동일 지표 비교 · 최신 검증본 자동 반영`;
    const grid = document.querySelector(".business-competitor-grid");
    if (!grid) return;
    grid.innerHTML = competitors.map((item) => `
      <article>
        <header><span>${escapeBusinessHTML(item.company)}</span><strong>${escapeBusinessHTML(item.dataStatus || "review")}</strong></header>
        <dl><div><dt>HBM SHARE</dt><dd>${escapeBusinessHTML(item.hbmShare || "미공개")}</dd></div><div><dt>DRAM SHARE</dt><dd>${escapeBusinessHTML(item.dramShare || "미공개")}</dd></div><div><dt>AS OF</dt><dd>${escapeBusinessHTML(item.asOf || "확인 필요")}</dd></div></dl>
        <div><a href="${escapeBusinessHTML(safeBusinessUrl(item.sourceUrl, "#console"))}" target="_blank" rel="noopener noreferrer">${escapeBusinessHTML(item.source || "근거") } ↗</a></div>
      </article>`).join("");
  }

  function renderPartnerContent(content = {}) {
    const partner = content.partnerSpotlight;
    const card = document.querySelector(".business-flagship-partnership");
    if (!partner || !card) return;
    const title = card.querySelector("#flagshipPartnershipTitle");
    const status = card.querySelector(".business-flagship-status strong");
    const time = card.querySelector(".business-flagship-status time");
    if (title) title.textContent = partner.title;
    if (status) status.textContent = `${partner.evidenceLevel || "WATCH"} · ${String(partner.sourceClass || "SOURCE").toUpperCase()}`;
    if (time) {
      const date = String(partner.publishedAt || content.generatedAt || "").slice(0, 10);
      time.dateTime = date;
      time.textContent = date || "기준일 확인";
    }
    const metrics = card.querySelector(".business-flagship-metrics");
    if (metrics) metrics.innerHTML = `
      <div><strong>${escapeBusinessHTML(content.freshness?.evidenceCount || 0)}</strong><span>승격 근거<br>전체 건수</span></div>
      <div><strong>${escapeBusinessHTML(partner.evidenceLevel || "WATCH")}</strong><span>현재 근거<br>등급</span></div>
      <div><strong>${escapeBusinessHTML(String(partner.publishedAt || "").slice(0, 10) || "N/A")}</strong><span>원문<br>기준일</span></div>
      <div><strong>${escapeBusinessHTML(content.freshness?.briefCount || 0)}</strong><span>전략 Brief<br>자동 연결</span></div>`;
    const values = card.querySelector(".business-contract-values");
    if (values) values.innerHTML = `
      <div><dt>PUBLIC SIGNAL</dt><dd>${escapeBusinessHTML(partner.title)}</dd></div>
      <div><dt>BINDING VALUE</dt><dd>확정 계약·물량은 공식 원문 확인 전 미확정</dd></div>
      <div><dt>REVENUE GATE</dt><dd>Qualification → Capacity → Shipment → 매출 인식 분리</dd></div>`;
    const source = card.querySelector(".business-flagship-bottom a");
    if (source) {
      source.href = safeBusinessUrl(partner.url, "#console");
      source.textContent = `${partner.source || "원문"} ↗`;
    }
    const caveat = card.querySelector(".business-flagship-caveat");
    if (caveat) caveat.textContent = `${partner.summary} 공개 발표·보도는 확정 계약과 구분하며 고객 인증·물량 약정·출하·매출 인식 Gate를 별도로 검증합니다.`;
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
    const liveDot = document.querySelector(".business-live-dot");
    if (liveDot) liveDot.textContent = content.hero?.status || "Decision-ready";
    const visualResult = document.querySelector(".business-visual-result small");
    if (visualResult) visualResult.textContent = `검증 실행 ${content.runId || "확인 필요"} · 근거 ${content.freshness?.evidenceCount || 0}건 · 자동 생성 ${formatKst(content.generatedAt)}`;
    const staticSnapshot = document.querySelector(".console-static-snapshot header p");
    if (staticSnapshot) staticSnapshot.textContent = content.agentCouncil?.subtitle || staticSnapshot.textContent;

    renderDecisionContent(content);
    renderCurrentInsights(content);
    renderCompetitorContent(content);
    renderPartnerContent(content);

    const footer = document.querySelector(".business-footer a");
    if (footer) footer.textContent = `© ${content.footer?.year || new Date().getFullYear()} dicacross · ${content.footer?.disclosure || "Independent strategy portfolio based on public information."}`;
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
    siteContentRefreshTimer = window.setTimeout(async () => {
      if (!document.hidden) {
        await loadSiteContent({ force: true });
        void updateDataStatus({ force: true });
      }
      scheduleSiteContentRefresh();
    }, 15 * 60 * 1000);
  }

  async function updateDataStatus({ force = false } = {}) {
    const panel = document.querySelector(".business-data-status");
    const dot = document.querySelector("#businessStatusDot");
    const status = document.querySelector("#businessDataStatus");
    const updated = document.querySelector("#businessDataUpdated");
    const expiry = document.querySelector("#businessDataExpiry");
    const artifacts = document.querySelector("#businessDataArtifacts");
    const run = document.querySelector("#businessDataRun");
    if (!status) return;

    try {
      const manifest = await getDataManifest({ force });
      const expiresAt = new Date(manifest.expiresAt).getTime();
      const current = Number.isFinite(expiresAt) && Date.now() <= expiresAt;
      status.textContent = current ? "Verified · current" : "Update delayed · freshness gate exceeded";
      dot?.classList.toggle("is-current", current);
      dot?.classList.toggle("is-delayed", !current);
      if (updated) updated.textContent = formatKst(manifest.generatedAt);
      if (expiry) expiry.textContent = formatKst(manifest.expiresAt);
      if (artifacts) artifacts.textContent = `${Object.keys(manifest.artifacts || {}).length} datasets`;
      if (run) run.textContent = String(manifest.runId || "unavailable").slice(0, 18);
      if (panel) panel.hidden = false;
    } catch (error) {
      console.warn("Data freshness status unavailable", error);
      status.textContent = "Status unavailable · fail-closed";
      dot?.classList.remove("is-current");
      dot?.classList.add("is-delayed");
      if (updated) updated.textContent = "마지막 검증 Bundle 유지";
      if (expiry) expiry.textContent = "Console에서 재확인";
      if (artifacts) artifacts.textContent = "새 게시 중단";
      if (run) run.textContent = "unavailable";
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
      setDecisionMetric("skhy-hbm-share", skhy?.hbmShare || "확인 필요");
      setDecisionMetric("evidence-count", evidenceCount ? `${evidenceCount}건` : "확인 필요");
      setDecisionMetric("quality-status", quality);
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
    }
  }

  function setupReveal() {
    const candidates = document.querySelectorAll([
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
      ".business-workload-matrix > article",
      ".business-memory-fabric",
      ".business-tco-module",
      ".business-tech-decision-grid > article",
      ".business-tech-proofline",
      ".business-evidence-case",
      ".business-execution-evidence-grid > article",
      ".business-flagship-partnership",
      ".business-partnership-types > article",
      ".business-partner-map",
      ".business-deep-cases",
      ".business-macro-grid > article",
      ".business-role-fit-grid > article",
      ".business-role-outputs > article",
      ".business-data-status",
      ".business-status-rules",
      ".business-about-card",
    ].join(","));
    if (!("IntersectionObserver" in window)) {
      for (const element of candidates) element.classList.add("is-visible");
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px -8%", threshold: 0.08 });
    for (const element of candidates) {
      element.classList.add("business-reveal");
      observer.observe(element);
    }
  }

  function setupInfographicSequence() {
    const groups = document.querySelectorAll([
      ".business-initiative-grid",
      ".business-competency-grid",
      ".business-strategy-chain",
      ".business-strategy-artifact",
      ".business-workload-matrix",
      ".business-tech-decision-grid",
      ".business-execution-evidence-grid",
      ".business-automation-flow",
      ".business-partnership-types",
      ".business-role-outputs",
    ].join(","));
    for (const group of groups) {
      [...group.children].forEach((item, index) => item.style.setProperty("--sequence-index", String(index)));
    }
  }

  function setupConsultingCardMotion() {
    const cards = [...document.querySelectorAll([
      ".business-insights .business-tech-decision-grid > article",
      ".business-insights .business-competitor-grid > article",
      ".business-execution-evidence-grid > article",
      ".business-evidence-case",
    ].join(","))];
    cards.forEach((card, index) => {
      card.classList.add("business-consulting-motion");
      if (!card.style.getPropertyValue("--sequence-index")) {
        card.style.setProperty("--sequence-index", String(index % 4));
      }
    });

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (reduceMotion || !finePointer) return;

    for (const card of cards) {
      let frame = 0;
      card.addEventListener("pointermove", (event) => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          const bounds = card.getBoundingClientRect();
          const x = ((event.clientX - bounds.left) / bounds.width) - .5;
          const y = ((event.clientY - bounds.top) / bounds.height) - .5;
          card.style.setProperty("--tilt-x", `${(x * 5).toFixed(2)}deg`);
          card.style.setProperty("--tilt-y", `${(-y * 4).toFixed(2)}deg`);
        });
      }, { passive: true });
      card.addEventListener("pointerleave", () => {
        cancelAnimationFrame(frame);
        card.style.setProperty("--tilt-x", "0deg");
        card.style.setProperty("--tilt-y", "0deg");
      }, { passive: true });
    }
  }

  function setupBusinessExperience() {
    if (businessReady) return;
    businessReady = true;
    void loadSiteContent();
    scheduleSiteContentRefresh();
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

  window.addEventListener("memory-console-ready", finishConsoleStartup);

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
