(() => {
  "use strict";

  const script = document.currentScript;
  const revision = new URL(script?.src || location.href).searchParams.get("v") || "current";
  const directoryUrl = new URL(`../../data/company-directory-client.json?v=${encodeURIComponent(revision)}`, script?.src || location.href);
  const accountsUrl = new URL(`../../data/accounts.json?v=${encodeURIComponent(revision)}`, script?.src || location.href);
  const manifestUrl = new URL(`../../data/data-manifest.json?v=${encodeURIComponent(revision)}`, script?.src || location.href);
  const consoleCapitalUrl = new URL(`../../data/console-capital-plans.json?v=${encodeURIComponent(revision)}`, script?.src || location.href);
  const consoleRoadmapUrl = new URL(`../../data/console-chip-roadmap.json?v=${encodeURIComponent(revision)}`, script?.src || location.href);
  const styleUrl = new URL(`../css/company-profile.min.css?v=${encodeURIComponent(revision)}`, script?.src || location.href);
  const SELF_COMPANY_ID = "skhynix";
  const excluded = "script,style,template,noscript,textarea,input,select,option,code,pre,a,button,summary,[contenteditable],[data-company-id],.company-profile-modal,.company-profile-link";
  const state = {
    directory: null,
    byId: new Map(),
    aliasMap: new Map(),
    aliasPattern: null,
    accountById: new Map(),
    accountAliasMap: new Map(),
    activeLens: "overview",
    consoleMode: false,
    loadedMode: "",
  };
  let directoryPromise = null;
  let accountDirectoryPromise = null;
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
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    if (typeof window.memoryFormatConsoleTemporal === "function") {
      try {
        const shared = window.memoryFormatConsoleTemporal(raw);
        if (shared && shared !== raw) return shared;
      } catch {
        // The profile remains usable even if the host formatter is replaced.
      }
    }

    const dayMatch = raw.match(/^((?:19|20)\d{2})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/)
      || raw.match(/^((?:19|20)\d{2})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?$/)
      || raw.match(/^((?:19|20)\d{2})년\s*(\d{1,2})월\s*(\d{1,2})일$/);
    if (dayMatch) {
      const year = Number(dayMatch[1]);
      const month = Number(dayMatch[2]);
      const day = Number(dayMatch[3]);
      const calendar = new Date(Date.UTC(year, month - 1, day));
      if (calendar.getUTCFullYear() === year
        && calendar.getUTCMonth() + 1 === month
        && calendar.getUTCDate() === day) return `${month}/${day}`;
      return raw;
    }

    const monthMatch = raw.match(/^((?:19|20)\d{2})-(\d{1,2})$/)
      || raw.match(/^((?:19|20)\d{2})\.\s*(\d{1,2})\.?$/)
      || raw.match(/^((?:19|20)\d{2})년\s*(\d{1,2})월$/);
    if (!monthMatch) return raw;
    const month = Number(monthMatch[2]);
    return month >= 1 && month <= 12 ? `'${monthMatch[1].slice(-2)}.${month}월` : raw;
  };
  const companyName = (profile = {}) => profile.name || profile.nameKo || "Company";
  const consoleRouteActive = () => /^#console(?:\/|$)/.test(location.hash);

  const safeExternalUrl = (value = "") => {
    try {
      const url = new URL(String(value ?? "").trim());
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
    } catch {
      return "";
    }
  };

  const safeLogoSource = (value = "") => {
    const raw = String(value ?? "").trim();
    if (/^assets\/img\/brands\/[a-z0-9._-]+\.(?:svg|png|webp)$/i.test(raw)) return raw;
    return safeExternalUrl(raw);
  };

  const capitalFieldEvidence = (plan = {}, field = "", value = "", strict = true) => {
    const body = String(value ?? "").trim();
    const basis = String(plan?.[`${field}Basis`] ?? "").trim();
    const url = safeExternalUrl(plan?.[`${field}Url`]);
    const date = shortDate(plan?.[`${field}AsOf`]);
    const hasDayPrecision = /^\d{1,2}\/\d{1,2}$/.test(date);
    if (!body || (strict && (!basis || !url || !hasDayPrecision))) return null;
    return { value: body, basis, url, date: hasDayPrecision ? date : "" };
  };

  function mergeSources(base = [], overlay = []) {
    const seen = new Set();
    return [...overlay, ...base].filter((source) => {
      const key = `${source?.url || ""}|${source?.observedAt || source?.date || ""}`;
      if (!source?.url || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function mergeCapitalPlan(base = {}, overlay = {}) {
    const keepObservedCapex = base.capexBasis === "관측";
    const keepObservedComment = base.commentBasis === "관측";
    const ownerFor = (field) => Object.prototype.hasOwnProperty.call(overlay, field) ? overlay : base;
    const capexOwner = ownerFor("capex");
    const planOwner = ownerFor("plan");
    const commentOwner = ownerFor("comment");
    const contractOwner = ownerFor("contractBoundary");
    const memoryReadOwner = ownerFor("memoryRead");
    const outlookOwner = ownerFor("outlook");
    const next = {
      ...base,
      ...overlay,
      outlook: { ...(outlookOwner.outlook || {}) },
      sources: mergeSources(base.sources, overlay.sources),
      observed: base.observed || overlay.observed,
      capexBasis: capexOwner.capexBasis,
      capexUrl: capexOwner.capexUrl,
      capexAsOf: capexOwner.capexAsOf,
      planBasis: planOwner.planBasis,
      planUrl: planOwner.planUrl,
      planAsOf: planOwner.planAsOf,
      commentBasis: commentOwner.commentBasis,
      commentUrl: commentOwner.commentUrl,
      commentAsOf: commentOwner.commentAsOf,
      contractBoundaryBasis: contractOwner.contractBoundaryBasis,
      contractBoundaryUrl: contractOwner.contractBoundaryUrl,
      contractBoundaryAsOf: contractOwner.contractBoundaryAsOf,
      memoryReadBasis: memoryReadOwner.memoryReadBasis,
      memoryReadUrl: memoryReadOwner.memoryReadUrl,
      memoryReadAsOf: memoryReadOwner.memoryReadAsOf,
      outlookBasis: outlookOwner.outlookBasis,
      outlookUrl: outlookOwner.outlookUrl,
      outlookAsOf: outlookOwner.outlookAsOf,
    };
    if (keepObservedCapex) {
      next.capex = base.capex;
      next.capexBasis = base.capexBasis;
      next.capexUrl = base.capexUrl;
      next.capexAsOf = base.capexAsOf;
    }
    if (keepObservedComment) {
      next.comment = base.comment;
      next.commentBasis = base.commentBasis;
      next.commentUrl = base.commentUrl;
      next.commentAsOf = base.commentAsOf;
    }
    return next;
  }

  function mergeConsoleDirectory(directory = {}, capitalPayload = {}, roadmapPayload = {}) {
    const plans = capitalPayload?.plans || {};
    const accounts = roadmapPayload?.accounts || {};
    return {
      ...directory,
      profiles: (directory.profiles || []).map((profile) => {
        const capital = plans[profile.id];
        const roadmap = accounts[profile.id];
        if (!capital && !roadmap) return profile;
        const next = { ...profile };
        if (capital) next.capitalPlan = mergeCapitalPlan(profile.capitalPlan, capital);
        if (roadmap) next.roadmap = { ...(profile.roadmap || {}), ...roadmap };
        if (profile.id === "nvidia" && roadmapPayload.demandBridge) {
          next.roadmap = { ...(next.roadmap || profile.roadmap || {}), demandBridge: roadmapPayload.demandBridge };
        }
        return next;
      }),
    };
  }

  async function fetchJSON(url, label, reload = false) {
    const response = await fetch(url, { cache: reload ? "reload" : "no-cache" });
    if (!response.ok) throw new Error(`${label} HTTP ${response.status}`);
    return response.json();
  }

  function verifiedConsoleOverlay(payload = {}, manifest = {}, artifactKey = "", filename = "") {
    const descriptor = manifest?.artifacts?.[artifactKey];
    const declaredPath = String(descriptor?.path || "").replaceAll("\\", "/");
    const manifestExpiry = Date.parse(String(manifest?.expiresAt || ""));
    const descriptorExpiry = Date.parse(String(descriptor?.expiresAt || ""));
    const payloadExpiry = Date.parse(String(payload?.expiresAt || ""));
    const valid = String(manifest?.runId || "")
      && declaredPath === `data/${filename}`
      && String(payload?.runId || "") === String(manifest.runId)
      && payload?.clientArtifact === true
      && Number.isFinite(manifestExpiry)
      && Number.isFinite(descriptorExpiry)
      && Number.isFinite(payloadExpiry)
      && payloadExpiry === descriptorExpiry
      && descriptorExpiry <= manifestExpiry
      && Date.now() <= payloadExpiry;
    if (!valid) throw new Error(`${filename}: stale or mismatched console overlay`);
    return payload;
  }

  function ensureStyle() {
    if (document.getElementById("companyProfileStyles")) return;
    const link = document.createElement("link");
    link.id = "companyProfileStyles";
    link.rel = "stylesheet";
    link.href = styleUrl.href;
    const brandStyles = document.querySelector('link[href*="brand-system.min.css"]');
    document.head.insertBefore(link, brandStyles || null);
  }

  function normalizeAlias(value = "") {
    return String(value).toLocaleLowerCase("en-US").replace(/\s+/g, " ").trim();
  }

  function normalizeProfileId(value = "") {
    return normalizeAlias(String(value || "").replace(/-stock$/, ""));
  }

  function prepareAccountDirectory(payload = {}) {
    const accounts = Array.isArray(payload.accounts) ? payload.accounts : [];
    state.accountById = new Map();
    state.accountAliasMap = new Map();
    for (const account of accounts) {
      if (!account?.id) continue;
      const id = normalizeProfileId(account.id);
      state.accountById.set(id, account);
      const aliases = [
        account.id,
        account.company,
        account.name,
        ...(Array.isArray(account.aliases) ? account.aliases : []),
      ];
      for (const alias of aliases) {
        const normalized = normalizeAlias(alias);
        if (normalized.length >= 3 && !state.accountAliasMap.has(normalized)) {
          state.accountAliasMap.set(normalized, id);
        }
      }
    }
    return payload;
  }

  async function loadAccountDirectory({ reload = false } = {}) {
    if (reload || !state.accountById.size || !accountDirectoryPromise) accountDirectoryPromise = null;
    if (accountDirectoryPromise) return accountDirectoryPromise;
    accountDirectoryPromise = fetchJSON(accountsUrl, "Accounts registry", reload)
      .then((payload) => prepareAccountDirectory(payload))
      .catch((error) => {
        console.warn("Accounts registry unavailable", error);
        return null;
      });
    return accountDirectoryPromise;
  }

  function toOverviewFallbackProfile(account = {}) {
    const chip = String(account.chip || "").trim();
    const baselineItems = [];
    if (account.baseline) {
      for (const row of account.baseline) {
        if (row?.label || row?.value) {
          baselineItems.push({ label: row.label, value: row.value });
        }
      }
    } else if (chip) {
      baselineItems.push({ label: "Platform", value: chip });
    }
    const portfolio = Array.isArray(account.chipPortfolio) ? account.chipPortfolio : [];
    const chipCards = portfolio
      .map((item = {}) => ({
        name: item.name || chip || "",
        type: item.type || "CHIP PROGRAM",
        publicSpec: item.publicSpec || "",
        workload: item.workload || "",
        memoryPain: item.memoryPain || "",
      }))
      .filter((item) => item.name || item.publicSpec || item.workload || item.memoryPain);

    const relations = [];
    if (account.relationship) relations.push({ supplier: account.relationship, status: "context", note: "관계 요건/범위는 공개 자료 기준" });

    return {
      id: normalizeProfileId(account.id || ""),
      name: account.company || account.name || "Company",
      layerLabel: "프로필 미발행 · 계정 모델 기준",
      isFallbackProfile: true,
      layer: account.layer || "account",
      summary: chip || "계정 기반 개요",
      accent: account.accent || "#586b7c",
      publication: { status: "verified" },
      verifiedAt: "",
      officialUrl: account.officialUrl || "",
      overview: {
        role: account.relationship ? `역할: ${account.relationship}` : "고객 AI Infra 전략 계정",
      },
      dataCenterLens: {
        operatingQuestion: account.memory || account.pain || "",
      },
      accountBrief: {
        mandate: account.pain || `${account.company || "해당 기업"}의 AI Infra 인사이트를 계정 단위로 정리`,
        businessStatus: baselineItems.slice(0, 4),
        decisionFlow: [
          { index: "01", label: "ROADMAP", value: chip || "공개 범위 확인 중" },
          { index: "02", label: "PAIN", value: account.pain || "관측 기반 추적 필요" },
        ],
      },
      chip: account.chip,
      memory: account.memory,
      relationship: account.relationship,
      memoryLens: {
        pain: account.pain || "워크로드 기반 메모리 요구 확정 필요",
        proposal: account.memory || "요구사항 정합성 확인 필요",
        gate: account.gate || "정의된 Execution Gate 필요",
        buyingCriteria: Array.isArray(account.buyingCriteria) ? account.buyingCriteria : [],
      },
      chipLens: {
        primaryChip: chip,
        portfolio: chipCards,
      },
      silicon: {
        programs: (Array.isArray(account.painSignals) ? account.painSignals : [])
          .map((program) => ({
            program,
            relation: "account-derived",
            roleLabel: "",
            // An unknown designer is omitted, not printed as a placeholder:
            // "설계 N/A" tells the reader nothing the missing line would not.
            designer: "",
            memoryProfile: "",
            headline: program,
          })),
      },
      chipPortfolio: chipCards,
      roadmap: {
        generations: [],
      },
      signals: {
        capex: account.capexSignals || [],
      },
      org: {
        people: [],
        statements: [],
      },
      painPoints: [
        {
          pain: account.pain || "",
          cause: "계정별 공개 공개자료 기반",
          answer: account.gate || "요구사항 정합성 확정 필요",
          products: [account.memory || "", account.chip || ""].filter(Boolean),
          newBiz: account.memory ? `${account.memory} 연동` : "공개 확인 필요",
          metric: account.relationship || "근거 기반 업데이트 후 반영",
          basis: account.relationship || "공개 및 검증자료",
        },
      ],
      baseline: {
        chipStrategy: chip || "",
        painPoint: account.pain || "",
        memoryRead: account.memory || "",
        sources: relations.length ? [{ label: "account", url: "" }] : [],
      },
      evidence: [],
      capitalPlan: null,
      strategyOpportunities: [],
      roadmaps: [],
      organization: [],
      newsQueries: account.newsQueries || [],
      supplierRelations: relations,
      memoryLensSource: account.sourceIds || [],
    };
  }

  function escapeRegExp(value = "") {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function prepareDirectory(directory = {}) {
    state.directory = directory;
    // The generator already withholds stale and unverified profiles. Keep the
    // browser defensive as well: malformed or hand-edited data must fail
    // closed instead of silently becoming a clickable company claim.
    const profiles = (directory.profiles || []).filter((profile) => profile?.publication?.status === "verified");
    state.byId = new Map(
      profiles
        .map((profile) => [normalizeProfileId(profile.id), profile])
        .filter(([id]) => id)
    );
    state.aliasMap = new Map();
    for (const profile of profiles) {
      const normalizedId = normalizeProfileId(profile.id);
      // Our own name is not a company to look up from inside our own console.
      if (normalizedId === SELF_COMPANY_ID) continue;
      for (const alias of profile.autoLinkAliases || [profile.name, profile.nameKo, profile.id, profile.nameKo || profile.name]) {
        const normalized = normalizeAlias(alias);
        if (normalized.length >= 3 && !state.aliasMap.has(normalized)) state.aliasMap.set(normalized, normalizedId);
      }
    }
    const aliases = [...state.aliasMap.keys()].sort((a, b) => b.length - a.length);
    state.aliasPattern = aliases.length
      ? new RegExp(`(^|[^\\p{L}\\p{N}_])(${aliases.map(escapeRegExp).join("|")})(?=$|[^\\p{L}\\p{N}_])`, "giu")
      : null;
    return directory;
  }

  async function loadDirectory({ reload = false } = {}) {
    const mode = consoleRouteActive() ? "console" : "home";
    if (reload || state.loadedMode !== mode) directoryPromise = null;
    if (directoryPromise) return directoryPromise;
    state.loadedMode = mode;
    const overlayPromise = mode === "console"
      ? fetchJSON(manifestUrl, "Data manifest", reload).then(async (manifest) => {
        const [capitalResult, roadmapResult] = await Promise.allSettled([
          fetchJSON(consoleCapitalUrl, "Console capital plans", reload)
            .then((payload) => verifiedConsoleOverlay(payload, manifest, "consoleCapitalPlans", "console-capital-plans.json")),
          fetchJSON(consoleRoadmapUrl, "Console chip roadmap", reload)
            .then((payload) => verifiedConsoleOverlay(payload, manifest, "consoleChipRoadmap", "console-chip-roadmap.json")),
        ]);
        if (capitalResult.status === "rejected") console.warn(capitalResult.reason?.message || capitalResult.reason);
        if (roadmapResult.status === "rejected") console.warn(roadmapResult.reason?.message || roadmapResult.reason);
        return {
          manifest,
          capital: capitalResult.status === "fulfilled" ? capitalResult.value : {},
          roadmap: roadmapResult.status === "fulfilled" ? roadmapResult.value : {},
        };
      }).catch((error) => (console.warn(error.message), { manifest: null, capital: {}, roadmap: {} }))
      : Promise.resolve({ manifest: null, capital: null, roadmap: null });
    directoryPromise = Promise.all([
      fetchJSON(directoryUrl, "Company directory", reload),
      overlayPromise,
    ])
      .then(([baseDirectory, overlays]) => {
        const { manifest, capital: capitalPayload, roadmap: roadmapPayload } = overlays;
        if ((consoleRouteActive() ? "console" : "home") !== mode) return loadDirectory({ reload: true });
        if (mode === "console") {
          const descriptor = manifest?.artifacts?.companyDirectory;
          const declaredPath = String(descriptor?.path || "").replaceAll("\\", "/");
          if (!String(manifest?.runId || "")
            || declaredPath !== "data/company-directory-client.json"
            || String(baseDirectory?.runId || "") !== String(manifest.runId)
            || baseDirectory?.clientArtifact !== true) {
            throw new Error("company-directory-client.json: manifest/run mismatch");
          }
        }
        const directory = mode === "console"
          ? mergeConsoleDirectory(baseDirectory, capitalPayload, roadmapPayload)
          : baseDirectory;
        const currentRun = String(window.MEMORY_SITE_CONTENT?.runId || "");
        if (!reload && currentRun && directory.runId && currentRun !== String(directory.runId)) return loadDirectory({ reload: true });
        state.consoleMode = mode === "console";
        prepareDirectory(directory);
        ensureStyle();
        scheduleLinking(document.body);
        window.dispatchEvent(new CustomEvent("memory-company-directory-ready", { detail: { runId: directory.runId, profiles: state.byId.size } }));
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
  const roadmapBasisLabel = (sourceClass = "", basis = "") => {
    const key = `${String(sourceClass).trim().toLowerCase()}|${String(basis).trim().toLowerCase()}`;
    return ({
      "official|fact": "공식",
      "official|interpretation": "공식 기반 해석",
      "official|disclosure-boundary": "공식 공개 경계",
      "reported|reported": "보도",
      "reported|interpretation": "보도 기반 해석",
      "broker-direct|estimate": "증권사 추정",
    })[key] || "";
  };

  function roadmapFieldHTML(row = {}, field = "", className = "") {
    const evidence = row.fieldEvidence?.[field] || {};
    const value = String(row?.[field] ?? "").trim();
    const url = safeExternalUrl(evidence.url || row?.[`${field}Url`]);
    const date = shortDate(evidence.observedAt || row?.[`${field}AsOf`]);
    const sourceClass = String(evidence.sourceClass || row?.[`${field}Class`] || "").trim();
    const basis = String(evidence.basis || row?.[`${field}Basis`] || "").trim();
    const label = roadmapBasisLabel(sourceClass, basis);
    if (!value || !url || !/^\d{1,2}\/\d{1,2}$/.test(date) || !label) {
      return `<span class="${escapeHTML(className)} is-empty" aria-hidden="true"></span>`;
    }
    return `<span class="${escapeHTML(className)}"><a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(value)}</a><i>${escapeHTML(label)} · ${escapeHTML(date)}</i></span>`;
  }

  function roadmapHTML(profile = {}) {
    const roadmap = profile.roadmap;
    const rows = roadmap?.generations || [];
    if (!rows.length) return "";
    const demandBridge = state.consoleMode ? roadmap.demandBridge : null;
    return `<section class="company-roadmap" aria-label="세대별 칩 로드맵">
      <header>
        <div><small>CHIP ROADMAP · BY GENERATION</small></div>
        ${roadmap.track ? `<b>${escapeHTML(roadmap.track)}</b>` : ""}
      </header>
      <div class="company-roadmap-rows">${rows.map((row) => {
        const disclosureBoundary = Object.values(row.fieldEvidence || {}).some((evidence) => evidence?.basis === "disclosure-boundary");
        return `
        <article${disclosureBoundary ? ` class="is-undisclosed"` : ""}>
          <b>${row.url ? `<a href="${escapeHTML(row.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(row.name)}</a>` : escapeHTML(row.name)}${disclosureBoundary ? `<small>사양 미공개 · 산정 제외</small>` : ""}</b>
          ${roadmapFieldHTML(row, "hbm")}
          ${roadmapFieldHTML(row, "bandwidth")}
          ${roadmapFieldHTML(row, "ramp")}
          ${roadmapFieldHTML(row, "attach", "company-roadmap-attach")}
          ${row.hbmDemand ? roadmapFieldHTML(row, "hbmDemand", "company-roadmap-demand") : ""}
        </article>`; }).join("")}</div>
      ${demandBridge?.rows?.length ? `<aside class="company-roadmap-bridge" aria-label="공식 공급 및 캐파 약정">
        <header><small>SUPPLY &amp; CAPACITY COMMITMENTS · 10-Q</small><strong>${escapeHTML(demandBridge.label || "공식 약정 시점 분산")}</strong></header>
        <div>${demandBridge.rows.map((item) => `<span><b>${escapeHTML(item.period || "")}</b><strong>${escapeHTML(item.amount || "")}</strong></span>`).join("")}</div>
        <p>${escapeHTML(demandBridge.note || "")}</p>
        ${demandBridge.url ? `<a href="${escapeHTML(demandBridge.url)}" target="_blank" rel="noopener noreferrer">NVIDIA 10-Q</a>` : ""}
      </aside>` : ""}
    </section>`;
  }

  function baselineHTML(profile = {}) {
    const rows = profile.memoryLens?.baseline || [];
    if (!rows.length) return "";
    return `<div class="company-profile-baseline">${rows.map((item) => `<div><small>${escapeHTML(item.label || "PUBLIC SPEC")}</small><strong>${escapeHTML(item.value || "공개 확인 필요")}</strong></div>`).join("")}</div>`;
  }

  const RELATION_TYPE_LABEL = {
    partnership: "파트너십", supply: "공급", investment: "투자", integration: "플랫폼 통합",
    qualification: "인증·검증", exploration: "협력 탐색", competition: "경쟁", adjacency: "인접",
  };

  // The ecosystem registry already carries this company's relationships with a
  // source, a date and a grade on each one. Until now only the value-chain map
  // read it, so an ODM profile showed an empty ecosystem while the same
  // relationship was drawn two sections away.
  function verifiedRelationsHTML(profile = {}) {
    const relations = profile.ecosystem?.verifiedRelations || [];
    if (!relations.length) return "";
    return `
      <div class="company-profile-relations">
        <header><b>검증된 관계 ${relations.length}건</b><span>관계별 출처 · 기준일 · 근거 등급</span></header>
        ${relations.slice(0, 8).map((item) => {
    const stamp = [item.evidenceGrade, item.effectiveAt ? shortDate(item.effectiveAt) || item.effectiveAt : ""].filter(Boolean).join(" · ");
    const arrow = item.direction === "out" ? "→" : "←";
    return `<article><strong>${escapeHTML(arrow)} ${escapeHTML(item.counterpart || item.counterpartId)}</strong><span>${escapeHTML(RELATION_TYPE_LABEL[item.type] || item.type || "관계")}${stamp ? ` · ${escapeHTML(stamp)}` : ""}</span>${item.detail ? `<p>${escapeHTML(item.detail)}</p>` : ""}${item.source?.url ? `<a href="${escapeHTML(item.source.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(item.source.name || "원문")}</a>` : ""}</article>`;
  }).join("")}
      </div>`;
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
        <div class="company-profile-thesis company-profile-thesis--account"><span>${escapeHTML(memoryLensLabels(profile).overview)}</span><strong>${escapeHTML(brief.mandate || profile.summary || "AI Infra 의사결정 연결")}</strong><p>${escapeHTML(profile.dataCenterLens?.operatingQuestion || profile.memoryLens?.gate || "고객 Roadmap과 Memory Buying Criteria를 동일 화면에 연결")}</p></div>
        <div class="company-account-facts">${facts.map((item) => `<article><small>${escapeHTML(item.label)}</small><strong>${escapeHTML(item.value)}</strong></article>`).join("")}</div>
        ${flow.length ? `<div class="company-account-flow" aria-label="고객 전략 연결 구조">${flow.map((item, index) => `<article><i>${escapeHTML(item.index || String(index + 1))}</i><small>${escapeHTML(item.label)}</small><strong>${escapeHTML(item.value)}</strong></article>`).join("")}</div>` : ""}
        <section class="company-raci"><header><div><small>AI INFRA EXECUTION</small></div><span>GSM → HBM Business → MSR</span></header><div>${raci.map((item) => `<article><small>${escapeHTML(item.owner)}</small><strong>${escapeHTML(item.role)}</strong><p>${escapeHTML(item.action)}</p></article>`).join("")}</div></section>
        ${(priorities.length || leaders.length) ? `<div class="company-profile-grid company-profile-grid--account">
          ${priorities.length ? `<article><small>STRATEGIC PRIORITIES</small><h4>우선 확인 안건</h4><ul>${priorities.map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul></article>` : ""}
          ${leaders.length ? `<article><small>LEADERSHIP / BUYING CENTER</small><h4>공개 조직 신호</h4><ul>${leaders.map((item) => `<li><b>${escapeHTML(item.name || item.role)}</b>${item.name && item.role ? `<span>${escapeHTML(item.role)}</span>` : ""}</li>`).join("")}</ul></article>` : ""}
          <article><small>PROFILE CONTROL</small><h4>공개 기준</h4><ul><li>${escapeHTML(profile.layerLabel || "Company")}</li><li>${escapeHTML(profile.verifiedAt ? `최종 확인 ${shortDate(profile.verifiedAt) || profile.verifiedAt}${provenanceSuffix(profile)}` : "2026 공개 원문 우선")}</li>${profile.officialUrl ? `<li><a href="${escapeHTML(profile.officialUrl)}" target="_blank" rel="noopener noreferrer">기업·제품 공식 원문</a></li>` : ""}</ul></article>
        </div>` : ""}
        ${roadmapHTML(profile)}
        ${verifiedRelationsHTML(profile)}
        ${baselineHTML(profile)}
        ${orgHTML(profile)}
        ${painPointsHTML(profile)}
        ${capitalPlanHTML(profile)}
        ${executiveLensHTML(profile)}
      </section>`;
  }

  // The three cards were written for an account: a customer's pain, our
  // proposal to them, the gate they hold us to. A memory maker is not an
  // account, so on Samsung, Micron and CXMT the same headings read as if we
  // were selling to a competitor and as if their ramp problem were our
  // customer's. The fields already carry the right facts; only the headings
  // were wrong. One table, keyed on the layer the directory already assigns.
  const MEMORY_LENS_LABELS = {
    "memory-supplier": {
      overview: "COMPETITIVE READ",
      thesis: "COMPETITIVE READ",
      pain: "01 · 실행 과제",
      painTitle: "Execution challenge",
      proposal: "02 · 메모리 포지션",
      proposalTitle: "Memory position",
      gate: "03 · 확인 지표",
      gateTitle: "Verification gate",
    },
    default: {
      overview: "LAYER MANDATE",
      thesis: "MEMORY THESIS",
      pain: "01 · CUSTOMER PAIN",
      painTitle: "Memory bottleneck",
      proposal: "02 · MEMORY OPTION",
      proposalTitle: "Memory proposal",
      gate: "03 · DECISION GATE",
      gateTitle: "Qualification criteria",
    },
  };

  function memoryLensLabels(profile = {}) {
    return MEMORY_LENS_LABELS[profile.layer] || MEMORY_LENS_LABELS.default;
  }

  // A bare date does not say whether it is fresh. Samsung and Micron were last
  // checked 29 days ago while CXMT was checked today, and the date alone read
  // the same on all three. The count of sources behind it stays out: how many
  // originals agree is bookkeeping, how old the newest one is is not.
  function provenanceSuffix(profile = {}) {
    const age = Number(profile.publication?.ageDays);
    if (!Number.isFinite(age)) return "";
    return age <= 0 ? " · 오늘 확인" : ` · ${age}일 경과`;
  }

  function memoryLensHTML(profile = {}) {
    const lens = profile.memoryLens || {};
    const relations = lens.supplierRelations || [];
    const labels = memoryLensLabels(profile);
    return `
      <section class="company-lens-panel is-active" data-company-lens-panel="memory">
        <div class="company-profile-thesis"><span>${escapeHTML(labels.thesis)}</span><strong>${escapeHTML(lens.pain || "")}</strong><p>${escapeHTML(lens.proposal || "Requirement Lock 우선")}</p></div>
        ${baselineHTML(profile)}
        ${lens.buyingCriteria?.length ? `<div class="company-buying-criteria"><b>BUYING CRITERIA</b>${lens.buyingCriteria.map((item, index) => `<span><i>${String(index + 1)}</i>${escapeHTML(item)}</span>`).join("")}</div>` : ""}
        <div class="company-profile-grid">
          <article><small>${escapeHTML(labels.pain)}</small><h4>${escapeHTML(labels.painTitle)}</h4><p>${escapeHTML(lens.pain || "공개 확인 필요")}</p></article>
          <article><small>${escapeHTML(labels.proposal)}</small><h4>${escapeHTML(labels.proposalTitle)}</h4><p>${escapeHTML(lens.proposal || "Requirement Lock 우선")}</p></article>
          <article><small>${escapeHTML(labels.gate)}</small><h4>${escapeHTML(labels.gateTitle)}</h4><p>${escapeHTML(lens.gate || "동일 Workload·SLO 검증")}</p></article>
        </div>
        ${lens.painAxes?.length ? `<div class="company-profile-axis"><header><b>실측 Pain signal</b><span>최근 검증 데이터 기준</span></header>${lens.painAxes.map((axis) => `<div><span>${escapeHTML(axis.label)}</span><i style="--axis:${Math.min(100, Math.max(8, Number(axis.mentions || 0) * 14))}%"></i><b>${Number(axis.mentions || 0)}</b></div>`).join("")}</div>` : ""}
        ${relations.length ? `<div class="company-profile-relations"><header><b>Supplier relationship</b><span>확정·추정·미확인 분리</span></header>${relations.map((item) => `<article><strong>${escapeHTML(item.supplier)}</strong><span>${escapeHTML(item.status)}</span><p>${escapeHTML(item.note)}</p>${item.source?.url ? `<a href="${escapeHTML(item.source.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(item.source.name || "원문")}</a>` : ""}</article>`).join("")}</div>` : ""}
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
            ${row.designer ? `<p class="company-silicon-designer">설계 ${escapeHTML(row.designer)}</p>` : ""}
            <p class="company-silicon-memory">${escapeHTML(row.memoryProfile)}</p>
            ${row.url
              ? `<a href="${escapeHTML(row.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(row.headline)}</a>`
              : `<p class="company-silicon-evidence">${escapeHTML(row.headline)}</p>`}
          </li>`).join("")}</ul>
      </section>`;
  }

  // Twenty of the thirty-three profiles opened a Chip tab onto one card that
  // said "공개 확인 필요" three times over — a title, a workload and a memory
  // pain, none of them known. list(portfolio, null) manufactured that card out
  // of an empty array. The tab now appears only when the lens holds something,
  // and each field appears only when it has a value.
  function hasChipLens(profile = {}) {
    const lens = profile.chipLens || {};
    return Boolean(lens.primaryChip || lens.portfolio?.length || lens.generations?.length || lens.servesAccounts?.length || profile.silicon?.programs?.length);
  }

  function chipFactsHTML(item = {}) {
    const rows = [
      ["WORKLOAD", item.workload],
      ["MEMORY PAIN", item.memoryPain],
    ].filter(([, value]) => value);
    if (!rows.length) return "";
    return `<dl>${rows.map(([label, value]) => `<div><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value)}</dd></div>`).join("")}</dl>`;
  }

  function chipLensHTML(profile = {}) {
    const lens = profile.chipLens || {};
    const portfolio = lens.portfolio || [];
    const generations = lens.generations || [];
    const cards = portfolio.length
      ? portfolio
      : (lens.primaryChip ? [{ name: lens.primaryChip, publicSpec: "공개 원문 기반 세대·스펙 추적" }] : []);
    return `
      <section class="company-lens-panel" data-company-lens-panel="chip" hidden>
        ${siliconProgramsHTML(profile)}
        ${lens.primaryChip ? `<div class="company-profile-thesis"><span>CHIP THESIS</span><strong>${escapeHTML(lens.primaryChip)}</strong><p>${escapeHTML(lens.partner?.role || "Compute·Memory·Package 경계를 고객 Roadmap과 함께 추적")}</p></div>` : ""}
        <div class="company-profile-grid company-profile-grid--chips">
          ${cards.map((item, index) => `<article><small>${String(index + 1)} · ${escapeHTML(item.type || "CHIP PLATFORM")}</small><h4>${escapeHTML(item.name || lens.primaryChip || "")}</h4>${item.publicSpec ? `<p>${escapeHTML(item.publicSpec)}</p>` : ""}${chipFactsHTML(item)}</article>`).join("")}
        </div>
        ${generations.length ? `<div class="company-generation-flow"><header><b>Generation roadmap</b><span>공개 스펙 기준</span></header>${generations.map((item, index) => `<div><i>${String(index + 1)}</i><strong>${escapeHTML(item.name)}</strong><span>${item.capacityGb ? `${escapeHTML(item.capacityGb)}GB` : "용량 확인 필요"}</span><span>${item.bandwidthTbps ? `${escapeHTML(item.bandwidthTbps)}TB/s` : "대역폭 확인 필요"}</span></div>`).join("")}</div>` : ""}
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
            <b>${escapeHTML(String(row.amount).replace(/([\d,.]+)억 달러/g, (_, amount) => `$${+amount.replace(/,/g, "") / 10}B`).replace(/ billion/g, "B").replace(/ million/g, "M"))}</b>
            ${signalLink(row, row.headline)}
            <em>${escapeHTML([shortDate(row.asOf), persistence(row.seenCount)].filter(Boolean).join(" · "))}</em>
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
            <p><b>${escapeHTML(row.verb)}</b>${signalLink(row, row.source || "원문")}<em>${escapeHTML(shortDate(row.asOf))}</em></p>
          </li>`).join("")}</ul>
      </section>` : "";

    const quoteBlock = quotes.length ? `
      <section class="company-track-block">
        <header><small>EXECUTIVE VIEW · 직접 발언</small><h4>경영진이 무엇을 문제로 지목했는가</h4></header>
        <ul class="company-track-quotes">${quotes.map((row) => `
          <li>
            <blockquote>${escapeHTML(row.quote)}</blockquote>
            <p><b>${escapeHTML(row.role)}</b>${signalLink(row, row.headline)}<em>${escapeHTML(shortDate(row.asOf))}</em></p>
          </li>`).join("")}</ul>
      </section>` : "";

    const techBlock = tech.length ? `
      <section class="company-track-block">
        <header><small>TECHNOLOGY · 반복 등장</small><h4>어떤 기술로 이동하고 있는가</h4></header>
        <ul class="company-track-tech">${tech.map((row) => `
          <li data-hold="${escapeHTML(persistence(row.seenCount) || "관측")}">
            <b>${escapeHTML(row.label)}</b>
            <span>${escapeHTML(persistence(row.seenCount) || "관측")}</span>
            <em>${escapeHTML(row.firstSeen && row.firstSeen !== row.lastSeen ? `${shortDate(row.firstSeen)} → ${shortDate(row.lastSeen)}` : shortDate(row.lastSeen))}</em>
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
        <div><small>CHIP &amp; DATA CENTER STRATEGY</small></div>
      </header>
      ${observedSilicon ? `<p class="company-baseline-observed"><i>관측 실리콘</i><span>${escapeHTML(observedSilicon)}</span></p>` : ""}
      <dl>${lines.map(([label, value]) => `<div><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value)}</dd></div>`).join("")}</dl>
      ${sources.length ? `<ul class="company-baseline-sources">${sources.map((item) => `<li><a href="${escapeHTML(item.url)}" target="_blank" rel="noopener noreferrer"><small>${escapeHTML(sourceLabel(item))}${item.observedAt ? ` · ${escapeHTML(shortDate(item.observedAt))}` : ""}</small><strong>${escapeHTML(item.label === "공개 근거" ? "원문" : item.label || "원문")}</strong></a></li>`).join("")}</ul>` : ""}
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
          <em>${escapeHTML([row.speaker && `${row.speaker}${row.role ? ` · ${row.role}` : ""}`, row.kind, shortDate(row.date)].filter(Boolean).join(" · "))}</em>
        </li>`).join("")}</ul>
      </div>` : "";
    return `<section class="company-org" aria-label="조직과 발언">
      <header><div><small>ORGANISATION &amp; VOICE</small></div></header>
      <div>${peopleBlock}${saidBlock}</div>
    </section>`;
  }

  function strategyOpportunitiesHTML(profile = {}) {
    const opportunities = (profile.strategyOpportunities || []).slice(0, 3);
    if (!opportunities.length) return "";
    return `<section class="company-strategy-chain" aria-label="원문이 연결된 사업 기회">
      <header><div><small>SIGNAL → SYSTEM → PAIN → MEMORY → NEW BIZ → GATE</small><strong>원문이 연결된 사업 기회</strong></div><span>근거 없는 시장 규모·절감액 제외</span></header>
      <div>${opportunities.map((item) => `<article>
        <div data-chain-step="1"><small>SIGNAL</small>${item.evidence?.url ? `<a href="${escapeHTML(item.evidence.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(item.signal)}</a>` : `<strong>${escapeHTML(item.signal)}</strong>`}<p>${escapeHTML([item.evidence?.source, shortDate(item.evidence?.asOf)].filter(Boolean).join(" · "))}</p></div>
        <div data-chain-step="2"><small>SYSTEM / PAIN</small><strong>${escapeHTML(item.systemShift)}</strong><p>${escapeHTML(item.painPoint)}</p></div>
        <div data-chain-step="3"><small>MEMORY</small><strong>${escapeHTML(item.memoryRequirement)}</strong><p>${escapeHTML([item.productAxis, ...(item.products || [])].filter(Boolean).join(" · "))}</p></div>
        <div data-chain-step="4"><small>NEW BIZ / KPI</small><strong>${escapeHTML(item.newBiz)}</strong><p>${escapeHTML(item.economics)}</p></div>
        <div data-chain-step="5"><small>EXECUTION GATE</small><strong>${escapeHTML(item.executionGate)}</strong><p>${escapeHTML([item.stage, item.statusLabel].filter(Boolean).join(" · "))}</p></div>
      </article>`).join("")}</div>
    </section>`;
  }

  function painPointsHTML(profile = {}) {
    // The strategy chain is the canonical presentation. Raw pain cards remain
    // a fail-safe only for older profiles that have not yet earned a complete
    // source-linked chain, preventing the same claim from appearing twice.
    const strategy = strategyOpportunitiesHTML(profile);
    if (strategy) return strategy;
    const cards = profile.painPoints || [];
    if (!cards.length) return "";
    return `<section class="company-pain" aria-label="고객 Pain Point와 메모리 연결">
      <header><div><small>PAIN POINT → MEMORY → NEW BIZ</small></div></header>
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
    const strictEvidence = state.consoleMode;
    const spendDetail = [plan.outlook?.buys, plan.outlook?.converts].filter(Boolean).join(" → ");
    const planValue = state.consoleMode ? plan.plan : [plan.plan, spendDetail].filter(Boolean).join(" · ");
    const rows = [
      [state.consoleMode ? (plan.capitalLabel || "CAPEX") : "CAPEX", capitalFieldEvidence(plan, "capex", plan.capex, strictEvidence)],
      [state.consoleMode ? (plan.planLabel || "INVESTMENT PLAN") : "INVESTMENT PLAN", capitalFieldEvidence(plan, "plan", planValue, strictEvidence)],
      [state.consoleMode ? (plan.commentLabel || "EXECUTIVE COMMENT") : "EXECUTIVE COMMENT", capitalFieldEvidence(plan, "comment", plan.comment, strictEvidence)],
      [state.consoleMode ? (plan.contractLabel || "CONTRACT BOUNDARY") : "CONTRACT BOUNDARY", capitalFieldEvidence(plan, "contractBoundary", state.consoleMode ? plan.contractBoundary : null, strictEvidence)],
    ].filter(([, evidence]) => evidence)
      .map(([label, evidence], position) => [String(position + 1), label, evidence]);
    const memoryRead = capitalFieldEvidence(plan, "memoryRead", plan.memoryRead, strictEvidence);
    const outlook = capitalFieldEvidence(plan, "outlook", plan.outlook?.window, strictEvidence);
    // Already shown as the CAPEX line when it is the observed figure.
    const seen = plan.capexBasis === "관측" ? null : plan.observed;
    const observedUrl = safeExternalUrl(seen?.url);
    const observedDate = shortDate(seen?.date);
    const visibleObserved = seen && (!state.consoleMode || (observedUrl && /^\d{1,2}\/\d{1,2}$/.test(observedDate)));
    if (!rows.length && !visibleObserved && !memoryRead && !outlook) return "";
    const observedRow = visibleObserved ? `<div class="company-capital-observed">
      <b>OBSERVED</b>
      ${observedUrl ? `<a href="${escapeHTML(observedUrl)}" target="_blank" rel="noopener noreferrer">${escapeHTML(seen.headline)}</a>` : `<span>${escapeHTML(seen.headline)}</span>`}
      <em>${escapeHTML([seen.amount, observedDate].filter(Boolean).join(" · "))}</em>
    </div>` : "";
    return `<div class="company-capital">
      <div class="company-capital-head"><small>CAPITAL &amp; INVESTMENT</small><h4>투자 계획과 메모리 해석</h4>${plan.tier && plan.tier !== "보도" ? `<b>${escapeHTML(plan.tier)}</b>` : ""}</div>
      <dl>${rows.map(([index, label, evidence]) => {
        const body = evidence.url
          ? `<a href="${escapeHTML(evidence.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(evidence.value)}</a>`
          : escapeHTML(evidence.value);
        const mark = evidence.basis ? `<i data-basis="${escapeHTML(evidence.basis)}">${escapeHTML([evidence.basis, evidence.date].filter(Boolean).join(" · "))}</i>` : "";
        return `<div><dt><span class="company-capital-index">${escapeHTML(index)}</span><span>${escapeHTML(label)}</span></dt><dd>${body}${mark}</dd></div>`;
      }).join("")}</dl>
      ${(memoryRead || outlook) ? `<div class="company-capital-read">
        ${memoryRead ? `<p><b>MEMORY READ</b><span>${memoryRead.url ? `<a href="${escapeHTML(memoryRead.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(memoryRead.value)}</a>` : escapeHTML(memoryRead.value)}${memoryRead.basis ? `<i data-basis="${escapeHTML(memoryRead.basis)}">${escapeHTML([memoryRead.basis, memoryRead.date].filter(Boolean).join(" · "))}</i>` : ""}</span></p>` : ""}
        ${outlook ? `<p><b>INSIGHT</b><span>${outlook.url ? `<a href="${escapeHTML(outlook.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(outlook.value)}</a>` : escapeHTML(outlook.value)}${outlook.basis ? `<i data-basis="${escapeHTML(outlook.basis)}">${escapeHTML([outlook.basis, outlook.date].filter(Boolean).join(" · "))}</i>` : ""}</span></p>` : ""}
      </div>` : ""}
      ${observedRow}
    </div>`;
  }

  function executiveLensHTML(profile = {}) {
    const lens = profile.executiveLens || {};
    const actions = lens.actions || [];
    if (!actions.length) return "";
    const signals = unique([...(lens.painSignals || []), ...(lens.riskSignals || [])]).slice(0, 4);
    return `<section class="company-executive-plan" aria-label="단계별 실행 제안">
      <header><div><small>EXECUTIVE ACTION</small><strong>${escapeHTML(lens.question || "다음 의사결정 질문")}</strong></div>${signals.length ? `<p>${signals.map((item) => `<span>${escapeHTML(item)}</span>`).join("")}</p>` : ""}</header>
      <div>${actions.map((item) => `<article><small>${escapeHTML(item.phase)}</small><strong>${escapeHTML(item.title)}</strong><p>${escapeHTML(item.detail)}</p></article>`).join("")}</div>
    </section>`;
  }

  function evidenceHTML(profile = {}) {
    const sources = unique([...(profile.evidence || [])]
      .filter((item) => item?.url && String(item.date || item.publishedAt || item.asOf || "").startsWith("2026"))
      .map((item) => JSON.stringify(item))).map((item) => JSON.parse(item)).slice(0, 6);
    if (!sources.length) return "";
    return `<footer class="company-profile-evidence"><header><b>2026 KEY SIGNALS</b></header><div>${sources.map((item) => `<a href="${escapeHTML(item.url)}" target="_blank" rel="noopener noreferrer"><small>${escapeHTML(sourceLabel(item))}</small><strong>${escapeHTML(item.title || item.name || item.source || "공개 원문")}</strong><span>${escapeHTML(shortDate(item.date || item.asOf || ""))}</span></a>`).join("")}</div></footer>`;
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
    const monogram = (profile.name || profile.nameKo || "C").replace(/[^a-z0-9가-힣]/gi, "").slice(0, 2).toUpperCase();
    const logoUrl = safeLogoSource(profile.logo);
    dialog.classList.toggle("is-console-context", state.consoleMode);
    dialog.innerHTML = `
      <div class="company-profile-shell" style="--company-accent:${escapeHTML(profile.accent || "#1e5a73")}">
        <header class="company-profile-head">
          <div class="company-profile-monogram" aria-hidden="true"><span>${escapeHTML(monogram)}</span>${logoUrl ? `<img src="${escapeHTML(logoUrl)}" alt="" loading="eager" decoding="async" referrerpolicy="no-referrer" data-company-profile-logo>` : ""}</div>
          <div><small>${escapeHTML(profile.layerLabel || "COMPANY INTELLIGENCE")}</small><h2 id="companyProfileTitle">${escapeHTML(companyName(profile))}</h2><p>${escapeHTML(profile.summary || "메모리·칩·데이터센터 관점의 기업 프로필")}</p></div>
          <button type="button" class="company-profile-close" data-company-close aria-label="기업 정보 닫기">×</button>
        </header>
        ${profile.isFallbackProfile ? `<p class="company-profile-stub" role="status">이 기업은 아직 검증된 프로필이 발행되지 않았습니다 · 아래는 계정 모델에 있는 항목만 표시하며 근거·최종 확인일·공급 관계는 프로필 발행 후 추가됩니다</p>` : ""}
        <div class="company-profile-executive-strip">
          ${profile.overview?.role ? `<div><small>ROLE</small><strong>${escapeHTML(profile.overview.role)}</strong></div>` : ""}
          ${profile.overview?.platform ? `<div><small>CHIP / PLATFORM</small><strong>${escapeHTML(profile.overview.platform)}</strong></div>` : ""}
          ${axis ? `<div><small>${escapeHTML(axis.label)}</small><strong>${escapeHTML(axis.value)}</strong></div>` : ""}
          ${(profile.dataCenterLens?.operatingQuestion || profile.memoryLens?.gate) ? `<div><small>MEMORY QUESTION</small><strong>${escapeHTML(profile.dataCenterLens?.operatingQuestion || profile.memoryLens?.gate)}</strong></div>` : ""}
        </div>
        <nav class="company-profile-tabs" role="tablist" aria-label="기업 분석 관점">
          <button type="button" data-company-lens="overview" role="tab">Account Brief</button>
          <button type="button" data-company-lens="memory" role="tab">Memory</button>
          ${hasChipLens(profile) ? '<button type="button" data-company-lens="chip" role="tab">Chip</button>' : ""}
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
    dialog.querySelector("[data-company-profile-logo]")?.addEventListener("error", (event) => event.currentTarget.remove(), { once: true });
    setLens(state.activeLens || "overview");
  }

  async function openProfile(id) {
    const [directory] = await Promise.all([loadDirectory(), loadAccountDirectory()]);
    if (!directory) return;
    const normalizedId = normalizeProfileId(id);
    // Same reason: no company card for the company whose console this is.
    if (normalizedId === SELF_COMPANY_ID) return;
    const directProfile = state.byId.get(normalizedId);
    const accountId = state.accountAliasMap.get(normalizedId) || normalizedId;
    const accountProfile = state.accountById.get(accountId) || state.accountById.get(normalizedId);
    const profile = directProfile
      || (accountProfile ? toOverviewFallbackProfile(accountProfile) : null);
    if (!profile) {
      // Not every account has a published profile. Rather than swallow the
      // click, hand the reader to the console route that does have the account.
      const account = String(id).replace(/-stock$/, "");
      if (account) {
        window.location.hash = `#console/account/${account}`;
      }
      return;
    }
    ensureStyle();
    ensureDialog();
    state.activeLens = "overview";
    renderDialog(profile);
    document.body.classList.add("company-profile-open");
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    dialog.querySelector("[data-company-close]")?.focus({ preventScroll: true });
  }

  // A card can now carry the company id itself and still hold its own links.
  // A click on a link inside the trigger is a navigation the card offered on
  // purpose, so it wins; a company name nested inside someone else's link still
  // opens the profile, which is the older arrangement and stays unchanged.
  function linkOwnsClick(target) {
    const trigger = target?.closest?.("[data-company-id],[data-account-id],[data-equity-stock]");
    const link = target?.closest?.("a[href], button[data-open-console]");
    return Boolean(trigger && link && link !== trigger && trigger.contains(link));
  }

  document.addEventListener("click", (event) => {
    if (linkOwnsClick(event.target)) return;
    const id = resolveCompanyId(event.target);
    if (!id) return;
    event.preventDefault();
    event.stopPropagation();
    void openProfile(id);
  }, true);

  document.addEventListener("keydown", (event) => {
    if (!["Enter", " "].includes(event.key)) return;
    if (linkOwnsClick(event.target)) return;
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
  window.addEventListener("hashchange", () => {
    const mode = consoleRouteActive() ? "console" : "home";
    if (mode === state.loadedMode) return;
    if (dialog?.open) dialog.close();
    void loadDirectory({ reload: true });
  });
})();
