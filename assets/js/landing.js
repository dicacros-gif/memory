(() => {
  "use strict";

  const BUSINESS_TITLE = "Memory Intelligence · AI Memory Strategy & Execution";
  const CONSOLE_HASH = "#console";
  const CONSOLE_REVISION = "infra-20260815-02";
  const site = document.querySelector("#businessSite");
  const consoleLayer = document.querySelector("#intelligenceConsole");
  const header = document.querySelector("#businessHeader");
  const nav = document.querySelector("#businessNav");
  const menuButton = document.querySelector("#businessMenuButton");
  const consoleExit = document.querySelector("#consoleExit");
  const navLinks = [...document.querySelectorAll("#businessNav a[href^='#']")];
  const businessSections = navLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);
  let consoleLoadPromise = null;
  let view = "business";

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
      link.href = `assets/css/styles.css?v=${CONSOLE_REVISION}`;
      link.addEventListener("load", () => {
        link.dataset.ready = "1";
        resolve();
      }, { once: true });
      link.addEventListener("error", reject, { once: true });
      const landingStyles = document.querySelector('link[href^="assets/css/landing.css"]');
      document.head.insertBefore(link, landingStyles || null);
    });
  }

  function loadConsole() {
    if (consoleLoadPromise) return consoleLoadPromise;
    consoleLoadPromise = loadStylesheet().then(() => new Promise((resolve, reject) => {
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
      script.src = `assets/js/app.js?v=${CONSOLE_REVISION}`;
      script.addEventListener("load", () => {
        script.dataset.ready = "1";
        resolve();
      }, { once: true });
      script.addEventListener("error", reject, { once: true });
      document.body.appendChild(script);
    }));
    return consoleLoadPromise;
  }

  async function openConsole({ updateHistory = true } = {}) {
    if (!site || !consoleLayer) return;
    view = "console";
    setMenu(false);
    site.hidden = true;
    consoleLayer.hidden = false;
    document.body.classList.remove("landing-mode", "business-menu-open");
    document.body.classList.add("console-mode");
    prepareConsoleMedia();
    if (updateHistory && location.hash !== CONSOLE_HASH) history.pushState({ view: "console" }, "", CONSOLE_HASH);
    window.scrollTo({ top: 0, behavior: "instant" });

    for (const trigger of document.querySelectorAll("[data-open-console]")) trigger.setAttribute("aria-busy", "true");
    try {
      await loadConsole();
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
    if (!site || !consoleLayer) return;
    view = "business";
    document.title = BUSINESS_TITLE;
    document.body.classList.add("landing-mode");
    document.body.classList.remove("console-mode", "business-menu-open", "menu-open", "crawl-moderation-open");
    consoleLayer.hidden = true;
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
    if (location.hash === CONSOLE_HASH) {
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

  async function updateDataStatus() {
    const dot = document.querySelector("#businessStatusDot");
    const status = document.querySelector("#businessDataStatus");
    const updated = document.querySelector("#businessDataUpdated");
    const expiry = document.querySelector("#businessDataExpiry");
    const artifacts = document.querySelector("#businessDataArtifacts");
    if (!status) return;

    try {
      const response = await fetch("data/data-manifest.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const manifest = await response.json();
      const expiresAt = new Date(manifest.expiresAt).getTime();
      const current = Number.isFinite(expiresAt) && Date.now() <= expiresAt;
      status.textContent = current ? "Verified · current" : "Update delayed · freshness gate exceeded";
      dot?.classList.toggle("is-current", current);
      dot?.classList.toggle("is-delayed", !current);
      if (updated) updated.textContent = formatKst(manifest.generatedAt);
      if (expiry) expiry.textContent = formatKst(manifest.expiresAt);
      if (artifacts) artifacts.textContent = `${Object.keys(manifest.artifacts || {}).length} datasets`;
    } catch (error) {
      console.warn("Data freshness status unavailable", error);
      status.textContent = "Status unavailable";
      dot?.classList.add("is-delayed");
      if (updated) updated.textContent = "확인 불가";
      if (expiry) expiry.textContent = "확인 불가";
      if (artifacts) artifacts.textContent = "확인 불가";
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

  function setupReveal() {
    const candidates = document.querySelectorAll([
      ".business-section-heading",
      ".business-competency-card",
      ".business-strategy-chain > li",
      ".business-pain-framework",
      ".business-solution-card",
      ".business-workload-matrix > article",
      ".business-tco-module",
      ".business-execution-roadmap",
      ".business-report-grid > article",
      ".business-evidence-case",
      ".business-partner-map",
      ".business-case-card",
      ".business-macro-grid > article",
      ".business-role-fit-grid > article",
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

  setupAudienceTabs();
  setupPainPointFramework();
  setupReveal();
  void updateDataStatus();
  if (location.hash === CONSOLE_HASH) void openConsole({ updateHistory: false });
  else {
    view = "business";
    const initialId = location.hash.slice(1) || "home";
    requestAnimationFrame(() => {
      document.getElementById(initialId)?.scrollIntoView({ behavior: "instant", block: "start" });
      updateBusinessScrollState();
    });
  }
})();
