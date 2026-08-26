import { calculateEconomics } from "./strategy-economics-model.js";
import { consultingBullet, sourceLabel } from "./public-copy-policy.js";

(() => {
  "use strict";

  const tabIds = [
    "account-intelligence",
    "workload-architecture",
    "tech-next-memory",
    "competitive-ecosystem",
    "economics-deal",
    "execution-cases"
  ];
  const preferredAccounts = ["nvidia", "google", "microsoft", "aws", "meta", "openai", "anthropic", "broadcom", "marvell", "dell"];
  const dataCache = new Map();
  const scriptElement = document.currentScript || document.querySelector('script[src*="strategy-experience"]');
  const scriptUrl = new URL(scriptElement?.src || "assets/js/strategy-experience.js", document.baseURI);
  const revision = scriptUrl.searchParams.get("v") || "";
  let activeRelationFilter = "all";
  let selectedAccountId = "nvidia";
  let routeInitialized = false;

  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

  const text = (value) => typeof value === "string" ? value.trim() : "";
  const copy = (value) => consultingBullet(text(value));
  const list = (value) => Array.isArray(value) ? value : [];
  const safeHref = (value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
    } catch {
      return "";
    }
  };
  const linkMarkup = (url, dateValue = "") => {
    const href = safeHref(url);
    return href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(sourceLabel(dateValue))}</a>` : "";
  };
  const dataUrl = (filename) => {
    const url = new URL(`../../data/${filename}`, scriptUrl);
    if (revision) url.searchParams.set("v", revision);
    return url;
  };
  const fetchJSON = (filename) => {
    if (!dataCache.has(filename)) {
      dataCache.set(filename, fetch(dataUrl(filename), { cache: "no-store" }).then((response) => {
        if (!response.ok) throw new Error(`${filename}: ${response.status}`);
        return response.json();
      }).then((payload) => {
        if (!payload || typeof payload !== "object") throw new Error(`${filename}: invalid payload`);
        return payload;
      }));
    }
    return dataCache.get(filename);
  };
  const fetchVerifiedArtifact = async (filename, artifactKey, { requireClientArtifact = false } = {}) => {
    const manifest = await fetchJSON("data-manifest.json");
    const descriptor = manifest?.artifacts?.[artifactKey];
    const declaredPath = text(descriptor?.path).replaceAll("\\", "/");
    if (!text(manifest?.runId) || declaredPath !== `data/${filename}`) throw new Error(`${filename}: manifest mismatch`);
    const payload = await fetchJSON(filename);
    if (text(payload?.runId) !== text(manifest.runId)) throw new Error(`${filename}: run mismatch`);
    if (requireClientArtifact && payload?.clientArtifact !== true) throw new Error(`${filename}: not a client artifact`);
    return payload;
  };

  const route = () => {
    const match = location.hash.match(/^#console(?:\/([^/?#]+))?/);
    if (!match) return { view: "executive", tab: null };
    return { view: "console", tab: tabIds.includes(match[1]) ? match[1] : tabIds[0] };
  };

  const setCurrentLink = (view) => {
    document.querySelectorAll("[data-view-link]").forEach((link) => {
      if (link.dataset.viewLink === view) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  };

  const selectTab = (id, { focus = false, hydrate = true } = {}) => {
    const selectedId = tabIds.includes(id) ? id : tabIds[0];
    document.querySelectorAll("[data-console-tab]").forEach((tab) => {
      const selected = tab.dataset.consoleTab === selectedId;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus();
    });
    document.querySelectorAll("[data-console-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.consolePanel !== selectedId;
    });
    if (hydrate) loadTabData(selectedId);
  };

  const syncRoute = () => {
    const next = route();
    const executive = document.getElementById("executiveView");
    const consoleView = document.getElementById("consoleView");
    const skipLink = document.querySelector(".skip-link");
    const previousView = executive?.hidden ? "console" : "executive";
    if (executive) executive.hidden = next.view !== "executive";
    if (consoleView) consoleView.hidden = next.view !== "console";
    if (skipLink) skipLink.setAttribute("href", next.view === "console" ? "#consoleContent" : "#mainContent");
    document.title = next.view === "console"
      ? "Intelligence Console · AI Infra Strategy"
      : "AI Infra Strategy · From Customer Pain to Memory Growth";
    setCurrentLink(next.view);
    if (next.view === "console") {
      selectTab(next.tab);
      if (location.hash === "#console") history.replaceState(null, "", `#console/${next.tab}`);
    }
    if (routeInitialized && previousView !== next.view) {
      window.scrollTo({ top: 0, behavior: "auto" });
      const heading = document.getElementById(next.view === "console" ? "consoleTitle" : "northStarTitle");
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
        heading.addEventListener("blur", () => heading.removeAttribute("tabindex"), { once: true });
      }
    }
    routeInitialized = true;
  };

  const platformFor = (profile) => {
    const status = list(profile?.accountBrief?.businessStatus).find((item) => text(item?.label) === "CHIP / PLATFORM");
    return text(status?.value)
      || text(list(profile?.accountBrief?.decisionFlow).find((item) => text(item?.label) === "ACCOUNT")?.value)
      || text(profile?.chipLens?.primaryChip)
      || text(list(profile?.memoryLens?.baseline)[0]?.value)
      || text(profile?.layerLabel);
  };

  const accountProfiles = (payload) => {
    const profiles = list(payload?.profiles).filter((profile) => text(profile?.id) && text(profile?.name));
    return preferredAccounts
      .map((id) => profiles.find((profile) => profile.id === id))
      .filter(Boolean)
      .filter((_, index) => index < 8);
  };

  const renderAccountDetail = (profile) => {
    const target = document.getElementById("accountDetail");
    if (!target || !profile) return;
    const flow = list(profile?.accountBrief?.decisionFlow).filter((item) => text(item?.label) && text(item?.value));
    const buyingCriteria = list(profile?.memoryLens?.buyingCriteria).map(text).filter(Boolean);
    const capitalRead = text(profile?.capitalPlan?.memoryRead);
    const actions = list(profile?.executiveLens?.actions).filter((item) => text(item?.title) || text(item?.detail));
    const source = list(profile?.sources).find((item) => safeHref(item?.url));
    const flowMarkup = flow.length ? `<div class="account-flow">${flow.map((item, index) => `<article><span>${esc(text(item.index) || String(index + 1).padStart(2, "0"))} · ${esc(copy(item.label))}</span><strong>${esc(copy(item.value))}</strong></article>`).join("")}</div>` : "";
    const criteriaMarkup = buyingCriteria.length ? `<article class="detail-card"><span class="card-index">BUYING CRITERIA</span><h4>선행 Lock 항목</h4><ul>${buyingCriteria.map((item) => `<li>${esc(copy(item))}</li>`).join("")}</ul></article>` : "";
    const capitalMarkup = capitalRead ? `<article class="detail-card"><span class="card-index">CAPITAL LENS</span><h4>투자 신호 → Memory Implication</h4><p>${esc(copy(capitalRead))}</p></article>` : "";
    const actionsMarkup = actions.length ? `<article class="detail-card"><span class="card-index">90-DAY ACTION</span><h4>Requirement → Deal</h4><ul>${actions.map((item) => `<li><b>${esc(text(item.phase))} ${esc(copy(item.title))}</b>${text(item.detail) ? ` · ${esc(copy(item.detail))}` : ""}</li>`).join("")}</ul></article>` : "";
    target.innerHTML = `<article class="account-summary"><span>${esc(text(profile.layerLabel) || "ACCOUNT")} · ACCOUNT BRIEF</span><h3>${esc(profile.name)}${platformFor(profile) ? ` · ${esc(platformFor(profile))}` : ""}</h3><p>${esc(copy(text(profile.summary) || text(profile.accountBrief?.mandate)))}</p>${source ? linkMarkup(source.url) : ""}</article>${flowMarkup}<div class="detail-columns">${criteriaMarkup}${capitalMarkup}${actionsMarkup}</div>`;
  };

  const renderAccounts = (payload) => {
    const profiles = accountProfiles(payload);
    const target = document.getElementById("accountList");
    if (!target || !profiles.length) return;
    if (!profiles.some((profile) => profile.id === selectedAccountId)) selectedAccountId = profiles[0].id;
    target.innerHTML = profiles.map((profile) => `<button class="account-button" type="button" aria-pressed="${profile.id === selectedAccountId}" data-account="${esc(profile.id)}"><strong>${esc(profile.name)}</strong>${platformFor(profile) ? `<small>${esc(copy(platformFor(profile)))}</small>` : ""}</button>`).join("");
    renderAccountDetail(profiles.find((profile) => profile.id === selectedAccountId));
    target.onclick = (event) => {
      const button = event.target.closest("[data-account]");
      if (!button) return;
      const profile = profiles.find((item) => item.id === button.dataset.account);
      if (!profile) return;
      selectedAccountId = profile.id;
      target.querySelectorAll("[data-account]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      renderAccountDetail(profile);
    };
  };

  const renderWorkloadCases = (payload) => {
    const target = document.getElementById("workloadCases");
    if (!target) return;
    const cases = list(payload?.decisionCases)
      .filter((item) => ["agentic-inference", "enterprise-rag"].includes(item?.id))
      .filter((item) => text(item?.answerTitle) && text(item?.decision));
    if (!cases.length) return;
    target.innerHTML = cases.map((item) => {
      const kpis = list(item.kpis).map(text).filter(Boolean);
      const evidence = item.latest && safeHref(item.latest.url) ? linkMarkup(item.latest.url, item.latest.publishedAt) : "";
      return `<article class="decision-case"><div><span class="card-index">${esc(text(item.tabLabel) || text(item.phase))}</span><h3>${esc(copy(item.answerTitle))}</h3></div><p>${esc(copy(item.decision))}${evidence ? `<br />${evidence}` : ""}</p><p><b>GATE</b><br />${esc(kpis.map(copy).join(" · "))}</p></article>`;
    }).join("");
  };

  const ledgerMappings = [
    {
      match: /(hbf|hbs)/i,
      kicker: "BEYOND HBM",
      label: "CONTEXT TIER",
      title: "HBF·HBS → Context Capacity Tier 부상",
      implication: "Long Context·RAG → 데이터 수명별 계층화 → HBM·AI-D·AI-N Attach 검증",
      decision: "AI-N/HBF를 단품이 아니라 전체 Memory Hierarchy의 경제성으로 평가",
      gate: "Lighthouse Workload · Interoperability · Cost/Query"
    },
    {
      match: /(hybrid|bonding|3d package|chiplet)/i,
      kicker: "PACKAGE",
      label: "PACKAGE",
      title: "적층·열·수율 → 동시 설계 변수",
      implication: "HBM 사양 + Base Die·Bonding·Package Capacity → 고객 일정 동시 Lock",
      decision: "우선 계정별 Package Requirement와 Qualification 일정을 공동 잠금",
      gate: "Thermal · Yield · Qualification Schedule"
    },
    {
      match: /(cpo|silicon photonics|scale-up|scale-out network)/i,
      kicker: "DATA MOVEMENT",
      label: "FABRIC",
      title: "CPO·Silicon Photonics → Fabric 전력까지 확장",
      implication: "Rack Goodput·Energy/Task → XPU–HBM–Network 통합 비교",
      decision: "XPU–HBM–Fabric을 공동 Reference Architecture로 검증",
      gate: "Goodput/MW · Bytes/Task · Partner RACI"
    }
  ];

  const mappedLedgerEntries = (payload) => {
    const seen = new Set();
    return list(payload?.entries).map((entry) => {
      const headline = text(entry?.headline);
      const detail = text(entry?.detail);
      const url = safeHref(entry?.url);
      const mapping = ledgerMappings.find((candidate) => candidate.match.test(`${headline} ${detail}`));
      if (!mapping || !detail || !url || seen.has(mapping.kicker)) return null;
      seen.add(mapping.kicker);
      return { entry, mapping, url };
    }).filter(Boolean);
  };

  const renderLedger = (payload) => {
    const mapped = mappedLedgerEntries(payload);
    if (mapped.length < 3) return;
    const selected = mapped.filter((_, index) => index < 3);
    const changeGrid = document.getElementById("changeGrid");
    if (changeGrid) {
      changeGrid.innerHTML = selected.map(({ entry, mapping, url }, index) => `<article class="change-card"><span class="card-index">${String(index + 1).padStart(2, "0")} · ${esc(mapping.kicker)}</span><h3>${esc(mapping.title)}</h3><p>${esc(mapping.implication)}</p><dl><div><dt>DECISION</dt><dd>${esc(mapping.decision)}</dd></div><div><dt>NEXT GATE</dt><dd>${esc(mapping.gate)}</dd></div></dl>${linkMarkup(url, entry.asOf)}</article>`).join("");
    }
    const opportunityGrid = document.getElementById("opportunityGrid");
    if (opportunityGrid) {
      opportunityGrid.innerHTML = selected.map(({ entry, mapping, url }) => `<article class="relationship-card"><header><span>${esc(copy(entry.headline) || mapping.kicker)}</span><b>${esc(mapping.label)}</b></header><h3>${esc(mapping.title)}</h3><p>${esc(mapping.implication)}</p><p class="impact">NEXT GATE · ${esc(mapping.gate)}</p>${linkMarkup(url, entry.asOf)}</article>`).join("");
    }
  };

  const relationshipScore = (item) => {
    let score = 0;
    if (safeHref(item?.source?.url)) score += 4;
    if (text(item?.decisionImpact)) score += 3;
    if (text(item?.memoryImplication)) score += 3;
    if (["FILING", "OFFICIAL"].includes(text(item?.evidenceGrade).toUpperCase())) score += 3;
    if (text(item?.effectiveAt)) score += 1;
    return score;
  };
  const relationshipsFrom = (payload) => {
    const dynamics = payload?.strategyBoard?.customerPortfolio?.competitiveDynamics;
    const relations = list(dynamics?.relations).length ? list(dynamics.relations) : list(dynamics?.relationships);
    return relations
      .filter((item) => text(item?.type) && text(item?.title) && text(item?.detail))
      .sort((a, b) => relationshipScore(b) - relationshipScore(a) || text(b?.effectiveAt).localeCompare(text(a?.effectiveAt)))
      .filter((_, index) => index < 12);
  };
  const applyRelationshipFilter = (filter = activeRelationFilter) => {
    activeRelationFilter = filter;
    document.querySelectorAll("[data-relation-filter]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.relationFilter === filter)));
    document.querySelectorAll("[data-relation-type]").forEach((card) => {
      card.hidden = filter !== "all" && card.dataset.relationType !== filter;
    });
  };
  const renderRelationships = (payload) => {
    const target = document.getElementById("relationshipGrid");
    const relations = relationshipsFrom(payload);
    if (!target || !relations.length) return;
    target.innerHTML = relations.map((item) => {
      const implication = text(item.memoryImplication);
      const impact = text(item.decisionImpact);
      const evidence = text(item.evidenceGrade) || text(item.status);
      return `<article class="relationship-card" data-relation-type="${esc(item.type)}"><header><span>${esc(item.type.toUpperCase())}</span>${evidence ? `<b>${esc(evidence)}</b>` : ""}</header><h3>${esc(copy(item.title))}</h3><p>${esc(copy(item.detail))}</p>${implication ? `<p>${esc(copy(implication))}</p>` : ""}${impact ? `<p class="impact">사업 판단 · ${esc(copy(impact))}</p>` : ""}${item.source ? linkMarkup(item.source.url, item.effectiveAt) : ""}</article>`;
    }).join("");
    applyRelationshipFilter();
  };

  const renderVerticalWorkloads = (payload) => {
    const target = document.getElementById("verticalWorkloadGrid");
    const rows = list(payload?.verticalWorkloads).filter((item) => text(item?.label) && text(item?.workload) && text(item?.memoryNeed) && text(item?.product));
    if (!target || rows.length < 3) return;
    target.innerHTML = rows.map((item) => `<article class="ecosystem-card"><span>${esc(copy(item.label))}</span><h3>${esc(copy(item.workload))}</h3><p>${esc(copy(item.memoryNeed))} → ${esc(copy(item.product))}</p></article>`).join("");
  };

  const renderPartnerModels = (payload) => {
    const target = document.getElementById("partnerModelGrid");
    const rows = list(payload?.partnerModels).filter((item) => text(item?.label) && text(item?.role) && text(item?.contribution) && text(item?.output));
    if (!target || rows.length !== 3) return;
    target.innerHTML = rows.map((item) => `<article class="case-card"><span class="case-stage">${esc(copy(item.label))}</span><h3>${esc(copy(item.role))}</h3><dl><div><dt>기여</dt><dd>${esc(copy(item.contribution))}</dd></div>${text(item.touchpoint) ? `<div><dt>접점</dt><dd>${esc(copy(item.touchpoint))}</dd></div>` : ""}<div><dt>공동 산출물</dt><dd>${esc(copy(item.output))}</dd></div></dl></article>`).join("");
  };

  const loadTabData = (id) => {
    if (id === "account-intelligence") fetchVerifiedArtifact("company-directory-client.json", "companyDirectory").then(renderAccounts).catch(() => {});
    if (id === "workload-architecture") {
      fetchVerifiedArtifact("site-content-client.json", "siteContent", { requireClientArtifact: true }).then(renderWorkloadCases).catch(() => {});
      fetchJSON("strategy-spine.json").then(renderVerticalWorkloads).catch(() => {});
    }
    if (id === "tech-next-memory") fetchVerifiedArtifact("insight-ledger.json", "insightLedger", { requireClientArtifact: true }).then(renderLedger).catch(() => {});
    if (id === "competitive-ecosystem") fetchVerifiedArtifact("site-content-client.json", "siteContent", { requireClientArtifact: true }).then(renderRelationships).catch(() => {});
    if (id === "execution-cases") fetchJSON("strategy-spine.json").then(renderPartnerModels).catch(() => {});
  };

  const setupTabs = () => {
    document.querySelectorAll("[data-console-tab]").forEach((tab) => {
      tab.addEventListener("click", () => {
        const nextHash = `#console/${tab.dataset.consoleTab}`;
        if (location.hash === nextHash) selectTab(tab.dataset.consoleTab);
        else location.hash = nextHash;
      });
      tab.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const current = tabIds.indexOf(tab.dataset.consoleTab);
        let next = current;
        if (event.key === "ArrowRight") next = (current + 1) % tabIds.length;
        if (event.key === "ArrowLeft") next = (current - 1 + tabIds.length) % tabIds.length;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = tabIds.length - 1;
        location.hash = `#console/${tabIds[next]}`;
        selectTab(tabIds[next], { focus: true });
      });
    });
  };

  const setupRelationshipFilters = () => {
    document.querySelectorAll("[data-relation-filter]").forEach((button) => {
      button.addEventListener("click", () => applyRelationshipFilter(button.dataset.relationFilter));
    });
  };

  const money = (value) => new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1_000_000 ? 0 : value < .01 ? 6 : value < 1 ? 4 : 2
  }).format(value);
  const setupEconomics = () => {
    const form = document.getElementById("economicsForm");
    const empty = document.getElementById("economicsEmpty");
    const results = document.getElementById("economicsResults");
    if (!form || !empty || !results) return;
    const update = () => {
      const values = Object.fromEntries(new FormData(form).entries());
      const economics = calculateEconomics(values);
      empty.hidden = Boolean(economics);
      results.hidden = !economics;
      if (!economics) {
        results.replaceChildren();
        return;
      }
      const outputs = [
        ["ANNUAL TOKEN", `${(economics.annualTokens / 1_000_000_000_000).toFixed(2)}T`, "Workload volume"],
        ["BASELINE COST", money(economics.baselineAnnualCost), "현재 Run-rate"],
        ["PROPOSED COST", money(economics.proposedAnnualCost), "동일 품질·SLO 가정"],
        ["$/1M TOKEN", money(economics.proposedCostPerMillion), "제안 단위 원가"],
        ["$/QUERY", money(economics.proposedCostPerQuery), "동일 품질·SLO 가정"],
        ["ANNUAL SAVING", money(economics.annualSaving), "Qualification 후 확정"],
        ["PAYBACK", `${economics.paybackMonths.toFixed(1)}개월`, "증분 CapEx 기준"],
        ["3-YEAR ROI", `${economics.threeYearRoi.toFixed(1)}%`, "세전·할인 전"]
      ];
      if (economics.grossMargin !== null) outputs.push(["TARGET GM", `${economics.grossMargin.toFixed(1)}%`, "Commercial guardrail"]);
      if (economics.market) {
        outputs.push(["TAM", `$${economics.market.tamMillion.toFixed(1)}M`, "전체 대상 계정"]);
        outputs.push(["SAM", `$${economics.market.samMillion.toFixed(1)}M`, "Qualification 가능"]);
        outputs.push(["SOM", `$${economics.market.somMillion.toFixed(1)}M`, "수주 가능 범위"]);
      }
      if (economics.efficiency.performancePerWatt !== null) outputs.push(["PERFORMANCE/W", economics.efficiency.performancePerWatt.toFixed(4), "Query/s per Watt"]);
      if (economics.efficiency.bandwidthPerMillion !== null) outputs.push(["BANDWIDTH/$", `${economics.efficiency.bandwidthPerMillion.toFixed(1)} GB/s`, "$1M Solution Cost"]);
      if (economics.efficiency.capacityPerMillion !== null) outputs.push(["CAPACITY/$", `${economics.efficiency.capacityPerMillion.toFixed(1)} TB`, "$1M Solution Cost"]);
      results.innerHTML = outputs.map(([label, value, note]) => `<article><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></article>`).join("");
    };
    form.addEventListener("input", update);
    form.addEventListener("submit", (event) => event.preventDefault());
  };

  // The report exhibits are reading depth, not first paint, so they load after
  // the brief is interactive and stay out of the initial payload.
  const loadReportFrames = () => {
    if (document.querySelector("script[data-report-frames]")) return;
    const tag = document.createElement("script");
    tag.src = new URL(`mbb-frames.min.js${revision ? `?v=${encodeURIComponent(revision)}` : ""}`, scriptUrl).href;
    tag.dataset.reportFrames = "1";
    document.body.appendChild(tag);
  };

  const hydrateMainWhenIdle = () => {
    const hydrate = () => {
      loadReportFrames();
      return fetchVerifiedArtifact("insight-ledger.json", "insightLedger", { requireClientArtifact: true }).then(renderLedger).catch(() => {});
    };
    if ("requestIdleCallback" in window) window.requestIdleCallback(hydrate, { timeout: 1800 });
    else window.setTimeout(hydrate, 300);
  };

  setupTabs();
  setupRelationshipFilters();
  setupEconomics();
  window.addEventListener("hashchange", syncRoute);
  syncRoute();
  hydrateMainWhenIdle();
})();
