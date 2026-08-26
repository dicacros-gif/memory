(() => {
  "use strict";

  const executiveView = document.querySelector("#executiveView");
  const consoleView = document.querySelector("#consoleView");
  const tabs = [...document.querySelectorAll("[data-console-tab]")];
  const panels = [...document.querySelectorAll("[data-console-panel]")];
  const consoleIds = new Set(tabs.map((tab) => tab.dataset.consoleTab));
  const defaultTab = "account-intelligence";

  function currentRoute() {
    const match = location.hash.match(/^#console(?:\/([^/?#]+))?/);
    if (!match) return { view: "executive", tab: defaultTab };
    return { view: "console", tab: consoleIds.has(match[1]) ? match[1] : defaultTab };
  }

  function selectTab(id, { focus = false } = {}) {
    const selected = consoleIds.has(id) ? id : defaultTab;
    tabs.forEach((tab) => {
      const active = tab.dataset.consoleTab === selected;
      tab.setAttribute("aria-selected", active ? "true" : "false");
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus({ preventScroll: true });
    });
    panels.forEach((panel) => { panel.hidden = panel.dataset.consolePanel !== selected; });
    document.body.dataset.consoleTab = selected;
  }

  function syncRoute({ focus = false } = {}) {
    const route = currentRoute();
    const consoleOpen = route.view === "console";
    executiveView.hidden = consoleOpen;
    consoleView.hidden = !consoleOpen;
    document.body.classList.toggle("console-mode", consoleOpen);
    document.querySelector('[data-view-link="executive"]')?.setAttribute("aria-current", consoleOpen ? "false" : "page");
    document.querySelector('[data-view-link="console"]')?.setAttribute("aria-current", consoleOpen ? "page" : "false");
    document.title = consoleOpen
      ? "Intelligence Console · AI Infra Strategy"
      : "AI Infra Strategy · SK hynix Memory Growth";
    if (consoleOpen) selectTab(route.tab, { focus });
    const skip = document.querySelector(".skip-link");
    if (skip) skip.href = consoleOpen ? "#consoleContent" : "#mainContent";
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      const id = tab.dataset.consoleTab;
      if (location.hash === `#console/${id}`) selectTab(id);
      else location.hash = `console/${id}`;
    });
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      let next = index;
      if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = tabs.length - 1;
      const id = tabs[next].dataset.consoleTab;
      history.replaceState(null, "", `#console/${id}`);
      selectTab(id, { focus: true });
    });
  });

  function setupEconomics() {
    const form = document.querySelector("#economicsForm");
    const empty = document.querySelector("#economicsEmpty");
    const results = document.querySelector("#economicsResults");
    if (!form || !empty || !results) return;
    const formatMoney = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value);
    const formatNumber = (value, suffix = "") => `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(value)}${suffix}`;
    const render = () => {
      const data = new FormData(form);
      const values = Object.fromEntries([...data.entries()].map(([key, value]) => [key, Number(value)]));
      const required = [values.dailyQueries, values.tokensPerQuery, values.costPerMillion, values.costReduction, values.incrementalCapex];
      if (required.some((value) => !Number.isFinite(value) || value <= 0) || values.costReduction >= 100) {
        empty.hidden = false;
        results.hidden = true;
        results.replaceChildren();
        return;
      }
      const annualTokens = values.dailyQueries * 1_000_000 * values.tokensPerQuery * 365;
      const baselineCost = annualTokens / 1_000_000 * values.costPerMillion;
      const proposedUnitCost = values.costPerMillion * (1 - values.costReduction / 100);
      const annualSaving = baselineCost * values.costReduction / 100;
      const capex = values.incrementalCapex * 1_000_000;
      const paybackMonths = annualSaving > 0 ? capex / annualSaving * 12 : NaN;
      const roi3y = capex > 0 ? ((annualSaving * 3 - capex) / capex) * 100 : NaN;
      const grossMargin = Number.isFinite(values.grossMargin) && values.grossMargin > 0 ? values.grossMargin : null;
      const cards = [
        ["연간 처리 Token", formatNumber(annualTokens / 1_000_000_000, "B"), "Workload scale"],
        ["제안 $ / 1M Token", formatMoney(proposedUnitCost), `${formatNumber(values.costReduction, "%")} 절감 가정`],
        ["연간 원가 절감", formatMoney(annualSaving), "SLO·Quality 통과 기준"],
        ["투자 회수기간", formatNumber(paybackMonths, "개월"), "증분 CapEx 기준"],
        ["3년 ROI", formatNumber(roi3y, "%"), "세전·단순 회수 모델"],
        ["목표 Gross Margin", grossMargin ? formatNumber(grossMargin, "%") : "미입력", "Deal floor"],
      ];
      results.innerHTML = cards.map(([label, value, note]) => `<article><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`).join("");
      empty.hidden = true;
      results.hidden = false;
    };
    form.addEventListener("input", render);
    render();
  }

  function setupRelationFilters() {
    const buttons = [...document.querySelectorAll("[data-relation-filter]")];
    buttons.forEach((button) => button.addEventListener("click", () => {
      buttons.forEach((candidate) => candidate.setAttribute("aria-pressed", candidate === button ? "true" : "false"));
      document.querySelector("#relationshipGrid")?.setAttribute("data-filter", button.dataset.relationFilter || "all");
    }));
  }

  window.addEventListener("hashchange", () => syncRoute({ focus: true }));
  setupEconomics();
  setupRelationFilters();
  syncRoute();
})();
