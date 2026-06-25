/* SK hynix CorpDev & Investment Intelligence dashboard renderer. */
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const el = (tag, cls, html) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html != null) node.innerHTML = html;
    return node;
  };

  const emptyLive = {
    updatedAt: null,
    stocks: {},
    prices: { sections: [], watchedItems: [] },
    competitors: { competitors: [] },
    startups: { candidates: [] },
    dealflow: { themes: [], stream: [], stats: {} },
    signals: { observations: [] },
    categories: [],
    news: [],
    trending: [],
    newsStats: {},
    health: [],
  };

  let BASE = null;
  let LIVE = emptyLive;
  let activePrice = "watch";
  let activeCategory = "all";
  let activeMemoryCategory = "all";
  let activeDetailCat = "hbm";
  let searchTerm = "";

  async function loadJSON(path, fallback) {
    try {
      const res = await fetch(path, { cache: "no-store" });
      if (!res.ok) throw new Error(res.status);
      return await res.json();
    } catch (error) {
      console.warn(`[load] ${path} failed`, error.message);
      return fallback;
    }
  }

  async function init() {
    [BASE, LIVE] = await Promise.all([
      loadJSON("data/baseline.json", null),
      loadJSON("data/live.json", emptyLive),
    ]);

    if (!BASE) {
      document.body.innerHTML = '<p style="padding:40px;font-family:sans-serif">baseline.json을 불러올 수 없습니다.</p>';
      return;
    }

    renderHeader();
    renderInsights();
    renderAnalysts();
    renderValueChain();
    renderDcDynamics();
    renderTechTrends();
    renderMemoryCategoryTabs();
    renderCategoryLens();
    renderCategoryDetail();
    renderDynamics();
    renderCorpDev();
    renderDealProcess();
    renderValuation();
    renderPortfolio();
    renderMaTargets();
    renderGrowthGaps();
    renderFunds();
    renderMonetization();
    renderRiskReturn();
    renderPrices();
    renderPriceInsight();
    renderCompetitors();
    renderStartups();
    renderStocks();
    renderNews();
    renderDealflow();
    renderTrending();
    renderScenario();
    renderSources();
    setupQA();
    setupChrome();
    setupScroll();
    rearm();
  }

  /* ============================================================
     Animation engine — scroll-triggered count-up + gauge fills +
     reveal. Each unit owns an IntersectionObserver entry and
     RESETS when scrolled out, so it replays on re-entry.
     ============================================================ */
  const _seen = new WeakSet();
  let _io = null;

  function animEngine() {
    if (_io) return _io;
    _io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const node = entry.target;
          if (entry.isIntersecting) {
            node.classList.add("in");
            if (node.classList.contains("count")) playCount(node);
            else if (node.classList.contains("gauge")) playGauge(node);
          } else {
            node.classList.remove("in");
            if (node.classList.contains("count")) resetCount(node);
            else if (node.classList.contains("gauge")) resetGauge(node);
          }
        });
      },
      { threshold: 0.2, rootMargin: "0px 0px -6% 0px" },
    );
    return _io;
  }

  function armAnimations(root = document) {
    const io = animEngine();
    $$(".count, .gauge, .reveal", root).forEach((node) => {
      if (_seen.has(node)) return;
      _seen.add(node);
      io.observe(node);
    });
  }
  const rearm = () => armAnimations(document);

  function fmtCount(value, dec, comma, prefix, suffix) {
    let body;
    if (comma) {
      body = Number(value.toFixed(dec)).toLocaleString("en-US", {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
      });
    } else {
      body = value.toFixed(dec);
    }
    return prefix + body + suffix;
  }

  function playCount(node) {
    const to = parseFloat(node.dataset.to);
    if (Number.isNaN(to)) return;
    const dec = parseInt(node.dataset.dec || "0", 10);
    const comma = node.dataset.comma === "1";
    const prefix = node.dataset.prefix || "";
    const suffix = node.dataset.suffix || "";
    const dur = 1050;
    cancelAnimationFrame(node._raf);
    let start = null;
    const step = (t) => {
      if (!start) start = t;
      const k = Math.min((t - start) / dur, 1);
      const e = 1 - Math.pow(1 - k, 3);
      node.textContent = fmtCount(to * e, dec, comma, prefix, suffix);
      if (k < 1) node._raf = requestAnimationFrame(step);
      else node.textContent = fmtCount(to, dec, comma, prefix, suffix);
    };
    node._raf = requestAnimationFrame(step);
  }

  function resetCount(node) {
    cancelAnimationFrame(node._raf);
    const dec = parseInt(node.dataset.dec || "0", 10);
    const comma = node.dataset.comma === "1";
    node.textContent = fmtCount(0, dec, comma, node.dataset.prefix || "", node.dataset.suffix || "");
  }

  function playGauge(node) {
    const f = Math.max(0, Math.min(1, parseFloat(node.dataset.fill) || 0));
    const bar = node.firstElementChild;
    if (bar) requestAnimationFrame(() => { bar.style.width = f * 100 + "%"; });
  }

  function resetGauge(node) {
    const bar = node.firstElementChild;
    if (bar) bar.style.width = "0%";
  }

  // Markup helpers that the animation engine arms after insertion.
  function countSpan(value, opts = {}) {
    const { prefix = "", suffix = "", dec = 0, comma = false, cls = "" } = opts;
    const num = Number(value);
    if (Number.isNaN(num)) return `<span class="num ${cls}">${escapeHTML(value)}</span>`;
    return `<span class="num count ${cls}" data-to="${num}" data-prefix="${escapeHTML(prefix)}" data-suffix="${escapeHTML(suffix)}" data-dec="${dec}" data-comma="${comma ? 1 : 0}">${escapeHTML(prefix + (0).toFixed(dec) + suffix)}</span>`;
  }

  function gaugeBar(frac, color) {
    const f = Math.max(0, Math.min(1, Number(frac) || 0));
    return `<span class="gauge" data-fill="${f}"><i style="background:${color || "var(--hynix)"}"></i></span>`;
  }

  /* ---------- shared formatting ---------- */
  function fmtNum(value, digits = 0) {
    if (value == null || Number.isNaN(Number(value))) return "—";
    return Number(value).toLocaleString("ko-KR", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }

  function fmtPrice(value) {
    if (value == null) return "—";
    const digits = Math.abs(value) >= 100 ? 2 : 3;
    return "$" + fmtNum(value, digits);
  }

  function fmtKRW(value) {
    if (value == null) return "—";
    return "₩" + Math.round(value).toLocaleString("ko-KR");
  }

  function fmtUsdM(m) {
    if (m == null || Number.isNaN(Number(m))) return "—";
    return m >= 1000 ? "$" + (m / 1000).toFixed(2) + "B" : "$" + Math.round(m) + "M";
  }

  function formatUpdated(iso) {
    if (!iso) return "아직 갱신 전";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      dateStyle: "medium",
      timeStyle: "short",
    }) + " KST";
  }

  function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
  }

  function shortTitle(title) {
    return String(title || "")
      .replace("NAND Flash", "NAND")
      .replace("PC-Client OEM SSD", "OEM SSD")
      .replace(" Price", "");
  }

  function rangeText(row) {
    const fields = row.fields || [];
    const find = (keys) => fields.find((field) => keys.includes(field.key))?.value || "";
    const high = find(["dailyHigh", "weeklyHigh", "sessionHigh", "high"]);
    const low = find(["dailyLow", "weeklyLow", "sessionLow", "low"]);
    if (!high && !low) return "—";
    return `${low || "—"} ~ ${high || "—"}`;
  }

  function categoryLabel(id) {
    const category = (LIVE.categories || []).find((item) => item.id === id);
    return category ? category.label : id;
  }

  function allNews() {
    return LIVE.news || [];
  }

  // Pool of foreign news + dealflow for tagging section cards by keyword.
  function liveNewsPool() {
    const df = (LIVE.dealflow && LIVE.dealflow.stream) || [];
    return (LIVE.news || []).concat(df);
  }

  function newsFor(terms, limit = 2) {
    if (!terms || !terms.length) return [];
    const needles = terms.map((s) => String(s).toLowerCase());
    const out = [];
    const seen = new Set();
    for (const item of liveNewsPool()) {
      const hay = String(item.title || "").toLowerCase();
      if (!needles.some((n) => hay.includes(n))) continue;
      const key = hay.slice(0, 60);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
      if (out.length >= limit) break;
    }
    return out;
  }

  function renderHeader() {
    $("#headerUpdatedAt").textContent = formatUpdated(LIVE.updatedAt);
  }

  function renderBrief() {
    const wrap = $("#briefList");
    if (!wrap) return;
    wrap.innerHTML = "";
    const labels = ["뉴스", "가격", "경쟁", "투자"];
    const observations = (LIVE.signals && LIVE.signals.observations) || [
      "첫 크롤링 실행 후 요약 신호가 표시됩니다.",
    ];

    observations.slice(0, 4).forEach((text, index) => {
      const item = el("div", "brief-item reveal");
      item.appendChild(el("span", "brief-label", labels[index] || "신호"));
      item.appendChild(el("span", "brief-text", escapeHTML(text)));
      wrap.appendChild(item);
    });
  }

  function renderKPIs() {
    const grid = $("#kpiGrid");
    grid.innerHTML = "";

    const stats = LIVE.newsStats || {};
    const dealCount = (LIVE.dealflow && (LIVE.dealflow.stream || []).length) || 0;
    const maCount = (BASE.maTargets || []).length;
    const cvcCount = (LIVE.startups?.candidates || []).length || (BASE.funds?.items || []).length;
    const portfolioCount = (BASE.portfolio?.holdings || []).length;

    const cards = [
      {
        label: "마지막 업데이트",
        valueHTML: escapeHTML(LIVE.updatedAt ? formatUpdated(LIVE.updatedAt).replace(" KST", "") : "대기 중"),
        detail: "Daily agent · Asia/Seoul",
        accent: true,
      },
      {
        label: "외신 뉴스 (24h)",
        valueHTML: countSpan(stats.total24h || 0, { suffix: "건" }),
        detail: `최근 30일 ${stats["30d"] || stats.total || 0}건`,
      },
      {
        label: "딜플로우 신호",
        valueHTML: countSpan(dealCount, { suffix: "건" }),
        detail: "M&A·투자 외신 스트림",
      },
      {
        label: "M&A·지분 기회",
        valueHTML: countSpan(maCount, { suffix: "개" }),
        detail: "전략 적합도 레이더",
      },
      {
        label: "CVC 투자 후보",
        valueHTML: countSpan(cvcCount, { suffix: "개" }),
        detail: "직접 소수지분 파이프라인",
      },
      {
        label: "포트폴리오 자산",
        valueHTML: countSpan(portfolioCount, { suffix: "개" }),
        detail: "보유 지분·자회사",
      },
    ];

    cards.forEach((card) => {
      const node = el("div", `metric-card reveal${card.accent ? " accent" : ""}`);
      node.appendChild(el("span", null, card.label));
      node.appendChild(el("strong", null, card.valueHTML));
      node.appendChild(el("small", null, escapeHTML(card.detail)));
      grid.appendChild(node);
    });
  }

  /* ---------- semiconductor & future tech trends ---------- */
  function renderTechTrends() {
    const grid = $("#techTrendGrid");
    if (!grid) return;
    grid.innerHTML = "";
    const trends = BASE.techTrends || [];
    if (!trends.length) {
      grid.appendChild(el("div", "empty-state", "기술 동향 데이터 대기 중"));
      return;
    }

    trends.forEach((item) => {
      const news = newsFor((item.tags || []).concat([item.title]), 1);
      const card = el("article", "tech-card reveal");
      card.innerHTML = `
        <div class="tech-top">
          <span class="tech-horizon">${escapeHTML(item.horizon)}</span>
          <span class="tech-status status-${escapeHTML(item.status)}">${escapeHTML(item.status)}</span>
        </div>
        <h3>${escapeHTML(item.title)}</h3>
        <div class="tech-metric">${escapeHTML(item.metric)}</div>
        <p>${escapeHTML(item.summary)}</p>
        <div class="tech-impact"><span>투자 시사점</span>${escapeHTML(item.impact)}</div>
        <div class="tag-row">${(item.tags || []).map((tag) => `<span class="tag">${escapeHTML(tag)}</span>`).join("")}</div>
      `;
      if (news.length) card.appendChild(renderMiniNews(news));
      grid.appendChild(card);
    });
  }

  function newsTitle(item) {
    return (item && (item.titleKo || item.title)) || "";
  }

  /* ---------- weekly strategy insights ---------- */
  function renderInsights() {
    const grid = $("#insightGrid");
    if (!grid) return;
    const data = BASE.insights || { cards: [] };
    const t = $("#insightsTitle"); if (t) t.textContent = data.title || "이번 주 전략 인사이트";
    const m = $("#insightsMeta"); if (m) m.textContent = data.subtitle || "";
    grid.innerHTML = "";
    (data.cards || []).forEach((c) => {
      const card = el("article", `insight-card reveal impact-${c.impact || "medium"}`);
      card.innerHTML = `
        <div class="insight-top">
          <span class="insight-tag">${escapeHTML(c.tag || "")}</span>
          <span class="insight-horizon">${escapeHTML(c.horizon || "")}</span>
        </div>
        <h3>${escapeHTML(c.title)}</h3>
        <p class="insight-judgment">${escapeHTML(c.judgment)}</p>
        <div class="scenario-track">
          ${(c.scenarios || []).map((s) => `
            <div class="scenario-step">
              <span class="scenario-stage">${escapeHTML(s.stage)}</span>
              <strong>${escapeHTML(s.label)}</strong>
              <small>${escapeHTML(s.desc)}</small>
            </div>`).join("")}
        </div>
        <div class="insight-strategy">
          <span class="insight-strategy-label">대응 전략</span>
          ${(c.strategy || []).map((s) => `<span class="strat-chip">${escapeHTML(s)}</span>`).join("")}
        </div>
      `;
      grid.appendChild(card);
    });
  }

  function renderAnalysts() {
    const row = $("#analystRow");
    if (!row) return;
    const data = BASE.analystViews || { items: [] };
    const t = $("#analystTitle"); if (t) t.textContent = data.title || "외국 증권사 리서치";
    row.innerHTML = "";
    (data.items || []).forEach((a) => {
      const card = el("div", "analyst-chip reveal");
      card.innerHTML = `
        <div class="analyst-top"><strong>${escapeHTML(a.firm)}</strong><span class="analyst-stance">${escapeHTML(a.stance)}</span></div>
        ${a.target ? `<span class="analyst-target">${escapeHTML(a.target)}</span>` : ""}
        <small>${escapeHTML(a.note)}</small>`;
      row.appendChild(card);
    });
  }

  /* ---------- AI memory value chain ---------- */
  function renderValueChain() {
    const map = $("#valueChainMap");
    if (!map) return;
    const data = BASE.valueChain || { tiers: [] };
    const t = $("#vcTitle"); if (t) t.textContent = data.title || "";
    const m = $("#vcMeta"); if (m) m.textContent = data.subtitle || "";
    const n = $("#vcNote"); if (n) n.textContent = data.note || "";
    map.innerHTML = "";
    (data.tiers || []).forEach((tier, i) => {
      if (i > 0) map.appendChild(el("span", "vc-arrow", "→"));
      const col = el("div", "vc-tier reveal");
      col.appendChild(el("div", "vc-tier-label", escapeHTML(tier.label)));
      const stack = el("div", "vc-tier-nodes");
      (tier.nodes || []).forEach((node) => {
        const nd = el("div", `vc-node${node.self ? " vc-self" : ""}`);
        nd.innerHTML = `<span class="vc-name">${escapeHTML(node.name)}</span><span class="vc-tip">${escapeHTML(node.note || "")}</span>`;
        stack.appendChild(nd);
      });
      col.appendChild(stack);
      map.appendChild(col);
    });
  }

  /* ---------- AI datacenter dynamics ---------- */
  function renderDcDynamics() {
    const grid = $("#dcDynamicsGrid");
    if (!grid) return;
    const data = BASE.datacenterDynamics || { items: [] };
    const t = $("#dcTitle"); if (t) t.textContent = data.title || "";
    const m = $("#dcMeta"); if (m) m.textContent = data.subtitle || "";
    const n = $("#dcNote"); if (n) n.textContent = data.note || "";
    grid.innerHTML = "";
    (data.items || []).forEach((d) => {
      const card = el("article", `dc-card reveal tone-${d.tone || "watch"}`);
      const shareHtml = d.share ? `<div class="dc-share"><span>점유율</span><strong>${countSpan(d.share, { suffix: "%" })}</strong></div>` : "";
      card.innerHTML = `
        <div class="dc-top"><div class="entity-name">${escapeHTML(d.name)}</div><span class="dc-seg">${escapeHTML(d.seg)}</span></div>
        <p class="dc-role">${escapeHTML(d.role)}</p>
        ${shareHtml}
        <div class="dc-line dc-opp"><span>기회</span>${escapeHTML(d.hynix)}</div>
        <div class="dc-line dc-threat"><span>위협</span>${escapeHTML(d.threat)}</div>
      `;
      grid.appendChild(card);
    });
  }

  /* ---------- growth gaps + synergy targets ---------- */
  function renderGrowthGaps() {
    const grid = $("#growthGapGrid");
    if (!grid) return;
    const data = BASE.growthGaps || { items: [] };
    const t = $("#gapTitle"); if (t) t.textContent = data.title || "성장 갭 · 시너지 기업 발굴";
    grid.innerHTML = "";
    (data.items || []).forEach((g) => {
      const card = el("article", "gap-card reveal");
      card.innerHTML = `
        <div class="gap-head"><span class="gap-dot"></span><h4>${escapeHTML(g.gap)}</h4></div>
        <p>${escapeHTML(g.why)}</p>
        <div class="gap-targets">${(g.targets || []).map((x) => `<span class="tag">${escapeHTML(x)}</span>`).join("")}</div>
      `;
      grid.appendChild(card);
    });
  }

  /* ---------- price insight ---------- */
  function renderPriceInsight() {
    const wrap = $("#priceInsight");
    if (!wrap) return;
    const moves = LIVE.signals?.topPriceMoves || [];
    const top = moves[0];
    if (!top) { wrap.innerHTML = ""; return; }
    const up = (top.changePct || 0) >= 0;
    wrap.innerHTML = `
      <span class="pi-tag ${up ? "up" : "down"}">${up ? "▲ 상승" : "▼ 하락"}</span>
      <span class="pi-text"><strong>${escapeHTML(top.item)}</strong> ${escapeHTML(top.changeRaw || "")} · ${up ? "공급 타이트·전가력 확대" : "수요 약세·감산 대응 점검"} → ${up ? "프리미엄 제품 믹스 집중" : "레거시 감산·고부가 전환"}</span>
    `;
  }

  /* ---------- chrome: theme, accent, collapsible sidebar ---------- */
  function setupChrome() {
    const root = document.documentElement;
    const themeBtn = $("#themeBtn");
    const savedTheme = (() => { try { return localStorage.getItem("inv-theme"); } catch (e) { return null; } })() || "light";
    root.setAttribute("data-theme", savedTheme);
    if (themeBtn) themeBtn.addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("inv-theme", next); } catch (e) {}
    });

    const accents = ["#f05a28", "#2563eb", "#7c3aed", "#047857", "#e11d48"];
    let ai = parseInt((() => { try { return localStorage.getItem("inv-accent"); } catch (e) { return "0"; } })() || "0", 10) || 0;
    const applyAccent = () => root.style.setProperty("--hynix", accents[ai % accents.length]);
    applyAccent();
    const colorBtn = $("#colorBtn");
    if (colorBtn) colorBtn.addEventListener("click", () => { ai = (ai + 1) % accents.length; try { localStorage.setItem("inv-accent", String(ai)); } catch (e) {} applyAccent(); });

    const sc = $("#sideCollapse");
    if (sc) sc.addEventListener("click", () => document.body.classList.toggle("rail-collapsed"));
    const st = $("#sbToggle");
    if (st) st.addEventListener("click", () => document.body.classList.toggle("rail-open"));
    $$(".side-section-head").forEach((h) => {
      h.addEventListener("click", () => h.parentElement.classList.toggle("section-closed"));
    });

    // mobile drawer: backdrop + link clicks close the rail
    const backdrop = $("#sbBackdrop");
    const closeRail = () => document.body.classList.remove("rail-open");
    if (backdrop) backdrop.addEventListener("click", closeRail);
    $$("#sideRail a").forEach((a) => a.addEventListener("click", closeRail));
    $$("#memoryCategoryTabs .side-tab").forEach((b) => b.addEventListener("click", () => {
      if (window.innerWidth <= 1079) closeRail();
    }));
  }

  function memoryCategories() {
    return BASE.memoryCategories || [{ id: "all", label: "전체", en: "All", desc: "", keywords: [] }];
  }

  function activeMemoryConfig() {
    return memoryCategories().find((category) => category.id === activeMemoryCategory) || memoryCategories()[0];
  }

  function setMemoryCategory(id) {
    if (!id || id === "all") id = activeDetailCat;
    activeDetailCat = id;
    activeMemoryCategory = id;
    activeCategory = { hbm: "hbm", dram: "dram", nand: "nand" }[id] || "all";
    renderMemoryCategoryTabs();
    renderCategoryLens();
    renderCategoryDetail();
    renderDynamics();
    renderNews();
    rearm();
    const sec = document.getElementById("categoryLens");
    if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderCategoryDetail() {
    const panel = $("#categoryDetail");
    if (!panel) return;
    const cat = memoryCategories().find((c) => c.id === activeDetailCat)
      || memoryCategories().find((c) => c.id !== "all");
    if (!cat) { panel.innerHTML = ""; return; }
    const stats = categoryStats(cat);
    const news = filteredNewsForCategory(cat.id).slice(0, 5);
    const terms = (cat.keywords || []).map((k) => k.toLowerCase());
    const maHits = (BASE.maTargets || []).filter((t) => {
      const hay = `${(t.match || []).join(" ")} ${t.area} ${t.name}`.toLowerCase();
      return terms.some((term) => hay.includes(term));
    }).slice(0, 3);
    const comp = filteredCompetitorsForCategory(cat.id).slice(0, 3);

    panel.innerHTML = `
      <div class="catd-head">
        <span class="catd-en">${escapeHTML(cat.en)}</span>
        <h3>${escapeHTML(cat.label)}</h3>
        <p>${escapeHTML(cat.desc)}</p>
      </div>
      <div class="catd-stats">
        <div><strong>${countSpan(stats.news)}</strong><span>외신</span></div>
        <div><strong>${countSpan(stats.prices)}</strong><span>가격품목</span></div>
        <div><strong>${countSpan(stats.entities)}</strong><span>관련타깃</span></div>
      </div>
      <div class="tag-row">${(cat.keywords || []).map((t) => `<span class="tag">${escapeHTML(t)}</span>`).join("")}</div>
      <div class="catd-block"><h4>관련 외신</h4><ul class="catd-news"></ul></div>
      ${maHits.length ? `<div class="catd-block"><h4>관련 M&A·투자 기회</h4><div class="catd-ma">${maHits.map((t) => `<span class="catd-ma-item">${escapeHTML(t.name)} · ${escapeHTML(t.structure)}</span>`).join("")}</div></div>` : ""}
      ${comp.length ? `<div class="catd-block"><h4>관련 경쟁사</h4><div class="theme-row">${comp.map((c) => `<span class="theme">${escapeHTML(c.shortLabel || c.label)} ${c.pressureScore || 0}</span>`).join("")}</div></div>` : ""}
    `;
    const ul = panel.querySelector(".catd-news");
    if (news.length) {
      news.forEach((nw) => {
        const li = el("li");
        const a = el("a");
        a.href = nw.link || "#";
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = newsTitle(nw);
        li.appendChild(a);
        ul.appendChild(li);
      });
    } else {
      ul.innerHTML = '<li><span class="empty-state">관련 외신 대기 중</span></li>';
    }
  }

  function renderMemoryCategoryTabs() {
    const wrap = $("#memoryCategoryTabs");
    if (!wrap) return;
    wrap.innerHTML = "";
    memoryCategories().filter((category) => category.id !== "all").forEach((category) => {
      const button = el("button", `side-tab${category.id === activeDetailCat ? " active" : ""}`);
      button.type = "button";
      button.dataset.memoryCat = category.id;
      button.innerHTML = `<span>${escapeHTML(category.label)}</span><small>${escapeHTML(category.en)}</small>`;
      button.addEventListener("click", () => setMemoryCategory(category.id));
      wrap.appendChild(button);
    });
  }

  function renderCategoryLens() {
    const grid = $("#categoryLensGrid");
    if (!grid) return;
    grid.innerHTML = "";
    const active = activeMemoryConfig();
    $("#categoryMeta").textContent = `${active.label} · ${active.desc || "전체 메모리 업계 신호"}`;

    memoryCategories().filter((category) => category.id !== "all").forEach((category) => {
      const stats = categoryStats(category);
      const card = el("article", `category-card reveal${category.id === activeDetailCat ? " active" : ""}`);
      card.innerHTML = `
        <div class="category-card-head">
          <div>
            <span>${escapeHTML(category.en)}</span>
            <h3>${escapeHTML(category.label)}</h3>
          </div>
          <button type="button" data-memory-cat="${escapeHTML(category.id)}">보기</button>
        </div>
        <p>${escapeHTML(category.desc)}</p>
        <div class="category-stat-row">
          <div><strong>${countSpan(stats.news)}</strong><span>뉴스</span></div>
          <div><strong>${countSpan(stats.prices)}</strong><span>가격품목</span></div>
          <div><strong>${countSpan(stats.entities)}</strong><span>관련타깃</span></div>
        </div>
        <div class="tag-row">${category.keywords.slice(0, 5).map((tag) => `<span class="tag">${escapeHTML(tag)}</span>`).join("")}</div>
      `;
      const btn = card.querySelector("button");
      btn.addEventListener("click", () => setMemoryCategory(category.id));
      grid.appendChild(card);
    });
  }

  function categoryStats(category) {
    return {
      news: filteredNewsForCategory(category.id).length,
      prices: filteredPricesForCategory(category.id).length,
      entities: filteredStartupsForCategory(category.id).length + filteredCompetitorsForCategory(category.id).length,
    };
  }

  function filteredNewsForCategory(categoryId) {
    if (!categoryId || categoryId === "all") return allNews();
    const category = memoryCategories().find((item) => item.id === categoryId);
    const terms = (category?.keywords || []).map((item) => item.toLowerCase());
    return allNews().filter((item) => {
      if (["hbm", "dram", "nand"].includes(categoryId) && item.category === categoryId) return true;
      const text = `${item.title || ""} ${item.source || ""}`.toLowerCase();
      return terms.some((term) => text.includes(term));
    });
  }

  function filteredPricesForCategory(categoryId) {
    const rows = (LIVE.prices?.watchedItems || []).concat((LIVE.prices?.sections || []).flatMap((section) =>
      (section.rows || []).map((row) => ({ ...row, sectionTitle: section.title, group: section.group })),
    ));
    if (!categoryId || categoryId === "all") return rows;
    const category = memoryCategories().find((item) => item.id === categoryId);
    const terms = (category?.keywords || []).map((item) => item.toLowerCase());
    return rows.filter((row) => {
      const text = `${row.item || ""} ${row.sectionTitle || ""} ${row.group || ""}`.toLowerCase();
      return terms.some((term) => text.includes(term));
    });
  }

  function filteredStartupsForCategory(categoryId) {
    const startups = LIVE.startups?.candidates || [];
    if (!categoryId || categoryId === "all") return startups;
    const category = memoryCategories().find((item) => item.id === categoryId);
    const terms = (category?.keywords || []).map((item) => item.toLowerCase());
    return startups.filter((item) => {
      const text = `${item.name || ""} ${item.area || ""} ${item.thesis || ""} ${(item.tags || []).join(" ")}`.toLowerCase();
      return terms.some((term) => text.includes(term));
    });
  }

  function filteredCompetitorsForCategory(categoryId) {
    const competitors = LIVE.competitors?.competitors || [];
    if (!categoryId || categoryId === "all") return competitors;
    const category = memoryCategories().find((item) => item.id === categoryId);
    const terms = (category?.keywords || []).map((item) => item.toLowerCase());
    return competitors.filter((item) => {
      const text = `${item.label || ""} ${item.shortLabel || ""} ${item.segment || ""} ${item.baseline || ""} ${(item.themes || []).map((t) => t.label).join(" ")}`.toLowerCase();
      return terms.some((term) => text.includes(term));
    });
  }

  function renderDynamics() {
    const grid = $("#dynamicsGrid");
    if (!grid) return;
    grid.innerHTML = "";
    const items = (BASE.competitiveDynamics || []).filter((item) =>
      activeMemoryCategory === "all" || (item.linkedCategories || []).includes(activeMemoryCategory),
    );
    const source = items.length ? items : BASE.competitiveDynamics || [];

    source.forEach((item) => {
      const linkedNews = (item.linkedCategories || []).flatMap((id) => filteredNewsForCategory(id)).slice(0, 3);
      const card = el("article", "dynamic-card reveal");
      card.innerHTML = `
        <div class="dynamic-axis">${escapeHTML(item.axis)}</div>
        <h3>${escapeHTML(item.title)}</h3>
        <p>${escapeHTML(item.whyItMatters)}</p>
        ${item.insight ? `<div class="mini-insight"><span>인사이트</span>${escapeHTML(item.insight)}</div>` : ""}
        <div class="player-row">${(item.players || []).map((player) => `<span>${escapeHTML(player)}</span>`).join("")}</div>
        <div class="watch-row">${(item.watch || []).map((watch) => `<span>${escapeHTML(watch)}</span>`).join("")}</div>
      `;
      card.appendChild(renderMiniNews(linkedNews));
      grid.appendChild(card);
    });
  }

  function renderMonetization() {
    const grid = $("#monetizationGrid");
    if (!grid) return;
    grid.innerHTML = "";
    const source = BASE.monetizationModels || [];

    source.forEach((model) => {
      const card = el("article", "monetization-card reveal");
      card.innerHTML = `
        <h3>${escapeHTML(model.title)}</h3>
        <p>${escapeHTML(model.revenueLogic)}</p>
        <div class="model-fit">${(model.memoryFit || []).map((fit) => `<span>${escapeHTML(fit)}</span>`).join("")}</div>
        ${model.insight ? `<div class="mini-insight"><span>인사이트</span>${escapeHTML(model.insight)}</div>` : ""}
        <dl>
          <div><dt>핵심 지표</dt><dd>${escapeHTML(model.metric)}</dd></div>
          <div><dt>리스크</dt><dd>${escapeHTML(model.risk)}</dd></div>
        </dl>
      `;
      grid.appendChild(card);
    });
  }

  /* ---------- CorpDev workbench ---------- */
  function renderCorpDev() {
    const grid = $("#corpDevGrid");
    if (!grid) return;
    grid.innerHTML = "";
    const workstreams = BASE.corpDevWorkstreams || [];

    if (!workstreams.length) {
      grid.appendChild(el("div", "empty-state", "CorpDev 업무 대시보드 설정 대기 중"));
      return;
    }

    const context = corpDevContext();
    workstreams.forEach((item) => {
      const card = el("article", "corpdev-card reveal");
      const metrics = corpDevMetrics(item.id, context);
      const actions = item.decisionQuestions || [];

      card.innerHTML = `
        <div class="corpdev-top">
          <span class="corpdev-dashboard">${escapeHTML(item.dashboard)}</span>
          <span class="corpdev-status">${escapeHTML(corpDevStatus(item.id, context))}</span>
        </div>
        <h3>${escapeHTML(item.title)}</h3>
        <p>${escapeHTML(item.memoryLens)}</p>
      `;

      const metricWrap = el("div", "corpdev-metrics");
      metrics.forEach((metric) => {
        metricWrap.appendChild(el("div", "corpdev-metric", `
          <span>${escapeHTML(metric.label)}</span>
          <strong>${escapeHTML(metric.value)}</strong>
          <small>${escapeHTML(metric.detail)}</small>
        `));
      });
      card.appendChild(metricWrap);

      const actionList = el("ul", "corpdev-actions");
      actions.slice(0, 3).forEach((action) => actionList.appendChild(el("li", null, escapeHTML(action))));
      card.appendChild(actionList);
      card.appendChild(el("div", "corpdev-output", `산출물 · ${escapeHTML(item.output || "")}`));
      grid.appendChild(card);
    });
  }

  function corpDevContext() {
    const topPriceMoves = LIVE.signals?.topPriceMoves || [];
    const spotMove = topPriceMoves.find((item) => /spot/i.test(item.sectionTitle || "")) || topPriceMoves[0];
    const contractMove = topPriceMoves.find((item) => /contract/i.test(item.sectionTitle || "")) || topPriceMoves[0];
    const topCompetitor = LIVE.competitors?.competitors?.[0];
    const topStartup = LIVE.startups?.candidates?.[0];
    const startups = LIVE.startups?.candidates || [];
    const competitors = LIVE.competitors?.competitors || [];
    const hbmCategory = (LIVE.categories || []).find((item) => item.id === "hbm");
    const aiCategory = (LIVE.categories || []).find((item) => item.id === "aidemand");
    const dealCategory = (LIVE.categories || []).find((item) => item.id === "dealflow");
    const trending = LIVE.trending || [];
    const highPriorityStartups = startups.filter((item) => (item.score || 0) >= 80).length;
    const cxlStartups = startups.filter((item) => (item.tags || []).some((tag) => /cxl/i.test(tag))).length;

    return {
      spotMove,
      contractMove,
      topCompetitor,
      topStartup,
      startups,
      competitors,
      hbmNews: hbmCategory?.count || 0,
      aiNews: aiCategory?.count || 0,
      dealNews: dealCategory?.count || (LIVE.dealflow?.stream || []).length || 0,
      totalNews: LIVE.newsStats?.total || 0,
      dayNews: LIVE.newsStats?.total24h || 0,
      highPriorityStartups,
      cxlStartups,
      topTrend: trending[0]?.term || "—",
    };
  }

  function corpDevMetrics(id, ctx) {
    const topStartup = ctx.topStartup;
    const topCompetitor = ctx.topCompetitor;
    const spot = ctx.spotMove;
    const contract = ctx.contractMove;
    const startupName = topStartup ? topStartup.name : "—";
    const competitorName = topCompetitor ? (topCompetitor.shortLabel || topCompetitor.label) : "—";

    const common = {
      price: {
        label: "가격 변곡",
        value: spot ? spot.changeRaw : "—",
        detail: spot ? spot.item : "Spot price 대기",
      },
      contract: {
        label: "계약가 신호",
        value: contract ? contract.changeRaw : "—",
        detail: contract ? contract.item : "Contract price 대기",
      },
      competitor: {
        label: "최대 경쟁 압력",
        value: topCompetitor ? `${topCompetitor.pressureScore}/100` : "—",
        detail: competitorName,
      },
      startup: {
        label: "우선 후보",
        value: startupName,
        detail: topStartup ? `${topStartup.status} · ${topStartup.score}/100` : "후보 대기",
      },
      deal: {
        label: "딜플로우 신호",
        value: `${ctx.dealNews}건`,
        detail: "M&A·투자 외신",
      },
    };

    const map = {
      "deal-sourcing": [
        { label: "관찰 타깃", value: `${ctx.startups.length + ctx.competitors.length}개`, detail: "스타트업+경쟁사 레이더" },
        common.deal,
        common.competitor,
      ],
      "cvc-startups": [
        common.startup,
        { label: "CXL 후보", value: `${ctx.cxlStartups}개`, detail: "CXL·메모리 풀링 투자 테마" },
        { label: "우선 검토군", value: `${ctx.highPriorityStartups}개`, detail: "score 80 이상" },
      ],
      "investment-strategy": [
        { label: "HBM 모멘텀", value: `${ctx.hbmNews}건`, detail: "최근 30일 외신" },
        common.contract,
        { label: "상위 키워드", value: ctx.topTrend, detail: "뉴스 제목 빈도 기반" },
      ],
      "deal-execution": [
        common.deal,
        { label: "밸류에이션", value: "EV/Rev · DCF", detail: "Financial modeling" },
        { label: "실사 항목", value: "기술·재무·법률·고객", detail: "DD 체크리스트" },
      ],
      "portfolio-valueup": [
        { label: "협업 후보", value: startupName, detail: topStartup ? topStartup.area : "후보 대기" },
        { label: "AI 수요 뉴스", value: `${ctx.aiNews}건`, detail: "고객 레퍼런스/PoC 신호" },
        { label: "포트폴리오", value: `${(BASE.portfolio?.holdings || []).length}개`, detail: "보유 자산 health check" },
      ],
      "risk-return": [
        common.competitor,
        common.price,
        { label: "24h 뉴스 강도", value: `${ctx.dayNews}건`, detail: `전체 ${ctx.totalNews}건 중 신규` },
      ],
    };

    return map[id] || [common.price, common.competitor, common.startup];
  }

  function corpDevStatus(id, ctx) {
    if (id === "risk-return" && (ctx.topCompetitor?.pressureScore || 0) >= 90) return "리스크 상향";
    if (id === "cvc-startups" && ctx.highPriorityStartups >= 2) return "PoC 검토";
    if (id === "investment-strategy" && ctx.hbmNews >= 60) return "전략 우선";
    if (id === "deal-sourcing" && ctx.dealNews >= 3) return "타깃 갱신";
    if (id === "deal-execution") return "실행 단계";
    if (id === "portfolio-valueup" && ctx.topStartup) return "Value-up 후보";
    return "관찰";
  }

  /* ---------- deal execution process + valuation ---------- */
  function renderDealProcess() {
    const grid = $("#dealProcessGrid");
    if (!grid) return;
    grid.innerHTML = "";
    const steps = BASE.dealProcess || [];
    steps.forEach((step) => {
      const card = el("article", "deal-step reveal");
      card.innerHTML = `
        <div class="deal-step-num">${escapeHTML(step.step)}</div>
        <h3>${escapeHTML(step.title)}</h3>
        <p>${escapeHTML(step.desc)}</p>
        ${step.insight ? `<div class="deal-step-insight"><span>인사이트</span>${escapeHTML(step.insight)}</div>` : ""}
        <div class="deal-step-out">${(step.outputs || []).map((o) => `<span>${escapeHTML(o)}</span>`).join("")}</div>
        <div class="deal-step-tools">${(step.tools || []).map((t) => `<span class="tag">${escapeHTML(t)}</span>`).join("")}</div>
      `;
      grid.appendChild(card);
    });
  }

  function renderValuation() {
    const val = BASE.valuation;
    if (!val) return;
    $("#valTitle").textContent = val.title || "지분가치 미니 모델";
    $("#valDesc").textContent = val.desc || "";
    $("#valNote").textContent = val.note || "";

    const controls = $("#valControls");
    const readouts = $("#valReadouts");
    controls.innerHTML = "";
    const state = { ...val.defaults };
    const order = ["revenueUsdM", "growthPct", "evRevenue", "stakePct", "synergyPct"];

    order.forEach((key) => {
      const range = val.ranges[key];
      if (!range) return;
      const wrap = el("div", "sim-field");
      const label = el("label");
      label.innerHTML = `<span>${escapeHTML(range.label)}</span><span class="val" id="valv-${key}">${state[key]}${escapeHTML(range.suffix || "")}</span>`;
      const input = el("input");
      input.type = "range";
      input.min = range.min;
      input.max = range.max;
      input.step = range.step;
      input.value = state[key];
      input.addEventListener("input", () => {
        state[key] = parseFloat(input.value);
        $(`#valv-${key}`).textContent = state[key] + (range.suffix || "");
        update();
      });
      wrap.appendChild(label);
      wrap.appendChild(input);
      controls.appendChild(wrap);
    });

    function update() {
      const ev = state.revenueUsdM * state.evRevenue;
      const baseStake = ev * (state.stakePct / 100);
      const withSynergy = baseStake * (1 + state.synergyPct / 100);
      $("#valResult").textContent = fmtUsdM(withSynergy);
      $("#valFormula").textContent = `${fmtUsdM(state.revenueUsdM)} × ${state.evRevenue}x × ${state.stakePct}% × (1+${state.synergyPct}%)`;
      readouts.innerHTML = `
        <div><span>기업가치 (EV)</span><strong>${fmtUsdM(ev)}</strong></div>
        <div><span>지분가치 (기본)</span><strong>${fmtUsdM(baseStake)}</strong></div>
        <div><span>성장률 가정</span><strong>${state.growthPct}%</strong></div>
      `;
    }
    update();
  }

  /* ---------- portfolio with equity stakes ---------- */
  function renderPortfolio() {
    const grid = $("#portfolioGrid");
    if (!grid) return;
    grid.innerHTML = "";
    const portfolio = BASE.portfolio || { holdings: [] };
    const holdings = portfolio.holdings || [];
    $("#portfolioMeta").textContent = `보유 ${holdings.length}개 · 지분율·밸류업`;
    $("#portfolioNote").textContent = portfolio.note || "";

    if (!holdings.length) {
      grid.appendChild(el("div", "empty-state", "포트폴리오 데이터 대기 중"));
      return;
    }

    holdings.forEach((h) => {
      const news = newsFor(h.match || [h.name], 1);
      const hasPct = typeof h.stakePct === "number";
      const card = el("article", "portfolio-card reveal");
      card.innerHTML = `
        <div class="portfolio-top">
          <div>
            <div class="entity-name">${escapeHTML(h.name)}</div>
            <div class="entity-segment">${escapeHTML(h.area)} · ${escapeHTML(h.geo || "")}</div>
          </div>
          <span class="portfolio-type">${escapeHTML(h.type)}</span>
        </div>
        <div class="stake-block">
          <div class="stake-line">
            <span class="stake-label">지분율</span>
            <span class="stake-value">${escapeHTML(h.stake)}</span>
          </div>
          ${hasPct ? gaugeBar(Math.min(1, h.stakePct / 100), h.stakePct >= 100 ? "var(--teal)" : "var(--hynix)") : '<div class="stake-undisclosed">소수지분 (미공개)</div>'}
        </div>
        <div class="portfolio-meta-row">
          <div><span>가치</span><strong>${escapeHTML(h.value)}</strong></div>
          <div><span>상태</span><strong>${escapeHTML(h.status)}</strong></div>
        </div>
        <div class="valueup-row"><span>밸류업 방향</span>${escapeHTML(h.valueUp)}</div>
      `;
      if (news.length) card.appendChild(renderMiniNews(news));
      grid.appendChild(card);
    });
  }

  /* ---------- M&A / equity opportunity radar ---------- */
  function renderMaTargets() {
    const grid = $("#maGrid");
    if (!grid) return;
    grid.innerHTML = "";
    const targets = BASE.maTargets || [];
    if (!targets.length) {
      grid.appendChild(el("div", "empty-state", "M&A 기회 데이터 대기 중"));
      return;
    }

    targets.forEach((t) => {
      const news = newsFor(t.match || [t.name], 1);
      const card = el("article", "ma-card reveal");
      card.innerHTML = `
        <div class="ma-top">
          <div>
            <div class="entity-name">${escapeHTML(t.name)}</div>
            <div class="entity-segment">${escapeHTML(t.area)} · ${escapeHTML(t.region || "")}</div>
          </div>
          <div class="fit-ring" style="--score:${t.fit || 0}">
            <span>${countSpan(t.fit || 0)}</span>
          </div>
        </div>
        <div class="ma-structure"><span>딜 구조</span>${escapeHTML(t.structure)}</div>
        <p class="entity-body">${escapeHTML(t.rationale)}</p>
        <div class="tag-row">
          <span class="tag">${escapeHTML(t.stage || "")}</span>
          <span class="tag tag-fit">fit ${countSpan(t.fit || 0)}</span>
        </div>
      `;
      if (news.length) card.appendChild(renderMiniNews(news));
      grid.appendChild(card);
    });
  }

  /* ---------- CVC & fund coverage ---------- */
  function renderFunds() {
    const grid = $("#fundsGrid");
    if (!grid) return;
    grid.innerHTML = "";
    const funds = BASE.funds || { items: [] };
    $("#fundsNote").textContent = funds.note || "";
    (funds.items || []).forEach((f) => {
      const card = el("article", "fund-card reveal");
      card.innerHTML = `
        <div class="fund-top">
          <div class="entity-name">${escapeHTML(f.name)}</div>
          <span class="fund-type">${escapeHTML(f.type)}</span>
        </div>
        <div class="fund-role">${escapeHTML(f.role)}</div>
        <div class="fund-focus"><span>초점</span>${escapeHTML(f.focus)}</div>
        <p class="entity-body">${escapeHTML(f.note)}</p>
        <span class="status-pill">${escapeHTML(f.status)}</span>
      `;
      grid.appendChild(card);
    });
  }

  /* ---------- return & risk cockpit ---------- */
  function renderRiskReturn() {
    const matrix = $("#riskMatrix");
    const factors = $("#riskFactors");
    if (!matrix) return;
    matrix.innerHTML = "";
    const data = BASE.riskReturn || { items: [], factors: [] };

    const typeColor = {
      "내재화": "var(--teal)",
      "자회사": "var(--teal)",
      "보유 자산": "#0ea5e9",
      "인수/JV": "var(--hynix)",
      "소수지분": "#7c3aed",
      "옵션": "var(--amber)",
    };

    (data.items || []).forEach((item, i) => {
      const dot = el("button", "risk-dot reveal");
      dot.style.left = `${Math.max(2, Math.min(96, item.risk))}%`;
      dot.style.bottom = `${Math.max(2, Math.min(96, item.return))}%`;
      dot.style.setProperty("--dotc", typeColor[item.type] || "var(--hynix)");
      dot.style.transitionDelay = `${i * 60}ms`;
      dot.title = `${item.name} · ${item.type} · 기대수익 ${item.return} / 리스크 ${item.risk}`;
      dot.innerHTML = `<i></i><span class="risk-tip">${escapeHTML(item.name)}</span>`;
      matrix.appendChild(dot);
    });

    // quadrant guides
    const guide = el("div", "risk-guides");
    guide.innerHTML = `<span class="rq rq-tl">고수익·저위험</span><span class="rq rq-tr">고수익·고위험</span><span class="rq rq-bl">저수익·저위험</span><span class="rq rq-br">저수익·고위험</span>`;
    matrix.appendChild(guide);

    if (factors) {
      factors.innerHTML = "";
      (data.factors || []).forEach((f) => {
        factors.appendChild(el("li", null, `<strong>${escapeHTML(f.label)}</strong><span>${escapeHTML(f.desc)}</span>`));
      });
    }
  }

  /* ---------- Q&A dropdown (typewriter answers) ---------- */
  let qaTypeTimer = null;
  let qaCurrentAnswer = "";
  let qaCurrentNav = null;

  function qaData() {
    return BASE.qa || { cats: [], pairs: [], intro: "" };
  }

  function setupQA() {
    const data = qaData();
    const sub = $("#qaSub");
    if (sub) sub.textContent = data.intro || "";

    const input = $("#qaInput");
    const toggle = $("#qaToggle");
    const drop = $("#qaDrop");
    const box = $("#qaBox");

    buildQaDrop("");

    const openDrop = () => { drop.hidden = false; box.classList.add("open"); };
    const closeDrop = () => { drop.hidden = true; box.classList.remove("open"); };

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      if (drop.hidden) { buildQaDrop(input.value); openDrop(); } else closeDrop();
    });
    input.addEventListener("focus", () => { buildQaDrop(input.value); openDrop(); });
    input.addEventListener("input", () => { buildQaDrop(input.value); openDrop(); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); closeDrop(); qaSearch(input.value); }
      if (e.key === "Escape") closeDrop();
    });
    document.addEventListener("click", (e) => {
      if (box && !box.contains(e.target)) closeDrop();
    });

    // quick prompts
    const prompts = $("#quickPrompts");
    if (prompts) {
      const examples = ["M&A·지분투자 기회", "포트폴리오 지분율", "CVC 투자 후보", "HBM4 기술 동향", "수익성·리스크"];
      prompts.innerHTML = "";
      examples.forEach((p) => {
        const button = el("button", null, escapeHTML(p));
        button.type = "button";
        button.addEventListener("click", () => { input.value = p; qaSearch(p); });
        prompts.appendChild(button);
      });
    }
  }

  function buildQaDrop(filterText) {
    const drop = $("#qaDrop");
    if (!drop) return;
    const data = qaData();
    const q = String(filterText || "").trim().toLowerCase();
    const pairs = q
      ? data.pairs.filter((p) => p.q.toLowerCase().includes(q) || (p.keywords || []).some((k) => q.includes(k) || k.includes(q)))
      : data.pairs;

    let html = `<div class="qa-drop-title">질문을 선택하거나 입력 후 Enter · 예시 ${pairs.length}개</div><div class="qa-drop-list">`;
    (data.cats || []).forEach((cat) => {
      const items = pairs.filter((p) => p.cat === cat.id);
      if (!items.length) return;
      html += `<div class="qa-cat-head" style="color:${cat.color}"><span class="qa-cat-dot" style="background:${cat.color}"></span>${escapeHTML(cat.name)}</div>`;
      items.forEach((p, i) => {
        html += `<button type="button" class="qa-drop-item" data-q="${escapeHTML(p.q)}" style="--qa:${cat.color}">${escapeHTML(p.q)}</button>`;
      });
    });
    html += "</div>";
    if (!pairs.length) html = '<div class="qa-drop-empty">일치하는 질문이 없습니다. Enter로 자연어 검색하세요.</div>';
    drop.innerHTML = html;

    $$(".qa-drop-item", drop).forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const input = $("#qaInput");
        if (input) input.value = btn.dataset.q;
        drop.hidden = true;
        $("#qaBox").classList.remove("open");
        qaSearch(btn.dataset.q);
      });
    });
  }

  function qaSearch(query) {
    const data = qaData();
    const q = String(query || "").trim().toLowerCase();
    if (!q) return;

    const stripped = q.replace(/[의은는이가을를에서도와과로부터까지만]/g, "");
    const words = q.split(/[\s,./?!·]+/).filter((w) => w.length > 1);

    const scored = data.pairs.map((p) => {
      let score = 0;
      const ql = p.q.toLowerCase();
      (p.keywords || []).forEach((k) => {
        if (q.includes(k) || stripped.includes(k)) score += 12;
        words.forEach((w) => { if (w === k) score += 10; else if (k.startsWith(w) || w.startsWith(k)) score += 5; });
      });
      if (ql.includes(q)) score += 8;
      words.forEach((w) => { if (ql.includes(w)) score += 3; });
      return { p, score };
    });
    scored.sort((a, b) => b.score - a.score);

    if (scored[0] && scored[0].score >= 4) {
      typeOut(scored[0].p.a, scored[0].p.nav);
      return;
    }

    // fallback: synthesize from datasets
    const results = [];
    (BASE.maTargets || []).forEach((t) => {
      if (`${t.name} ${t.area} ${t.rationale}`.toLowerCase().includes(q) || words.some((w) => t.name.toLowerCase().includes(w))) {
        results.push({ text: `M&A 기회 · ${t.name} — ${t.structure}. ${t.rationale}`, nav: "maTargets" });
      }
    });
    (BASE.portfolio?.holdings || []).forEach((h) => {
      if (`${h.name} ${h.area} ${h.valueUp}`.toLowerCase().includes(q) || words.some((w) => h.name.toLowerCase().includes(w))) {
        results.push({ text: `포트폴리오 · ${h.name} (지분율 ${h.stake}) — ${h.valueUp}`, nav: "portfolio" });
      }
    });
    (BASE.techTrends || []).forEach((t) => {
      if (`${t.title} ${t.summary} ${(t.tags || []).join(" ")}`.toLowerCase().includes(q) || words.some((w) => t.title.toLowerCase().includes(w))) {
        results.push({ text: `기술 동향 · ${t.title} (${t.horizon}) — ${t.summary}`, nav: "techTrends" });
      }
    });
    liveNewsPool().forEach((n) => {
      if (words.some((w) => String(n.title || "").toLowerCase().includes(w))) {
        results.push({ text: `외신 · ${n.source || ""}: ${n.title}`, nav: "news" });
      }
    });

    if (results.length) {
      const top = results.slice(0, 3);
      typeOut(top.map((r, i) => `${i + 1}. ${r.text}`).join("\n\n"), top[0].nav);
    } else if (scored[0] && scored[0].score > 0) {
      typeOut(scored[0].p.a, scored[0].p.nav);
    } else {
      typeOut("정확히 일치하는 항목을 찾지 못했습니다. M&A, 포트폴리오, 지분율, CVC, 펀드, HBM4, CXL, 리스크 같은 키워드로 다시 질문해 보세요. 위 드롭다운(▾)에서 예시 질문을 선택할 수도 있습니다.", "corpdev");
    }
  }

  function highlightAnswer(text) {
    const escaped = escapeHTML(text);
    return escaped.replace(/(\$[\d.,]+[BMK]?|\b\d[\d.,]*%|\b\d[\d.,]*x\b|\b\d+TB\/s|\b\d+(?:억|조)\b|HBM\d?E?|CXL|PIM|NAND|DRAM|M&amp;A|CVC|DCF|EV\/Rev(?:enue)?)/g, '<b class="hl">$1</b>');
  }

  function formatAnswer(text) {
    return String(text)
      .split(/\n\n+/)
      .map((para, i) => `<p class="qa-para${i === 0 ? " lead" : ""}">${highlightAnswer(para)}</p>`)
      .join("");
  }

  function typeOut(text, nav) {
    const panel = $("#qaAnswer");
    if (!panel) return;
    qaCurrentAnswer = text;
    qaCurrentNav = nav || null;
    panel.hidden = false;
    panel.classList.add("show");
    if (qaTypeTimer) clearInterval(qaTypeTimer);

    const body = `
      <div class="qa-panel" role="dialog" aria-modal="true">
        <div class="qa-answer-head">
          <span class="qa-ava">A</span>
          <b>Investment Intelligence</b>
          <span class="qa-typing" id="qaTyping">분석 중…</span>
          <button class="qa-close" id="qaClose" aria-label="닫기">✕</button>
        </div>
        <div class="qa-answer-body" id="qaAnswerBody"></div>
        <div class="qa-answer-foot" id="qaAnswerFoot"></div>
      </div>
    `;
    panel.innerHTML = body;
    document.body.classList.add("qa-open");
    $("#qaClose").addEventListener("click", closeAnswer);

    const target = $("#qaAnswerBody");
    let i = 0;
    const plain = text;
    qaTypeTimer = setInterval(() => {
      i += 2;
      if (i >= plain.length) {
        clearInterval(qaTypeTimer);
        qaTypeTimer = null;
        target.innerHTML = formatAnswer(text);
        const typing = $("#qaTyping");
        if (typing) typing.remove();
        renderAnswerFoot(nav);
      } else {
        target.innerHTML = `<p class="qa-para typing">${escapeHTML(plain.slice(0, i))}<span class="qa-cursor">▋</span></p>`;
      }
    }, 16);

    // click on backdrop closes; click inside while typing reveals instantly
    panel.onclick = (e) => {
      if (e.target === panel) { closeAnswer(); return; }
      if (qaTypeTimer && e.target.id !== "qaClose") {
        clearInterval(qaTypeTimer);
        qaTypeTimer = null;
        target.innerHTML = formatAnswer(text);
        const typing = $("#qaTyping");
        if (typing) typing.remove();
        renderAnswerFoot(nav);
      }
    };
  }

  function _escClose(e) { if (e.key === "Escape") closeAnswer(); }
  document.addEventListener("keydown", _escClose);

  function renderAnswerFoot(nav) {
    const foot = $("#qaAnswerFoot");
    if (!foot) return;
    if (!nav) { foot.innerHTML = ""; return; }
    foot.innerHTML = `<button class="qa-go" id="qaGo">해당 섹션으로 이동 →</button>`;
    $("#qaGo").addEventListener("click", (e) => {
      e.stopPropagation();
      const target = document.getElementById(nav);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function closeAnswer() {
    const panel = $("#qaAnswer");
    if (!panel) return;
    if (qaTypeTimer) { clearInterval(qaTypeTimer); qaTypeTimer = null; }
    panel.hidden = true;
    panel.classList.remove("show");
    panel.innerHTML = "";
    document.body.classList.remove("qa-open");
  }

  /* ---------- prices ---------- */
  function renderPrices() {
    const tabs = $("#priceTabs");
    tabs.innerHTML = "";
    const sections = LIVE.prices?.sections || [];
    const options = [{ id: "watch", label: "핵심 품목" }].concat(
      sections.map((section) => ({ id: section.id, label: shortTitle(section.title) })),
    );

    if (!options.some((option) => option.id === activePrice)) activePrice = options[0]?.id || "watch";

    options.forEach((option) => {
      const btn = el("button", option.id === activePrice ? "active" : "", escapeHTML(option.label));
      btn.type = "button";
      btn.dataset.price = option.id;
      btn.addEventListener("click", () => {
        activePrice = option.id;
        renderPrices();
      });
      tabs.appendChild(btn);
    });

    renderPriceRows();
    renderPriceSignals();
  }

  function priceRowsForActive() {
    if (activePrice === "watch") {
      return (LIVE.prices?.watchedItems || []).map((item) => ({
        ...item,
        group: item.group || item.sectionTitle,
        sourceUrl: item.sourceUrl,
      }));
    }

    const section = (LIVE.prices?.sections || []).find((item) => item.id === activePrice);
    if (!section) return [];
    return section.rows.map((row) => ({
      ...row,
      group: section.group,
      sectionTitle: section.title,
      lastUpdate: section.lastUpdate,
      sourceUrl: section.sourceUrl,
    }));
  }

  function renderPriceRows() {
    const tbody = $("#priceRows");
    tbody.innerHTML = "";
    const rows = priceRowsForActive();

    if (!rows.length) {
      tbody.appendChild(el("tr", null, '<td colspan="6" class="empty-state">가격 데이터 대기 중</td>'));
      return;
    }

    rows.slice(0, 14).forEach((row) => {
      const tr = el("tr");
      const avg = row.averageRaw || (row.average != null ? fmtPrice(row.average) : "—");
      const changeClass = row.direction || "flat";
      tr.innerHTML = `
        <td><span class="price-item">${escapeHTML(row.item)}</span><span class="price-sub">${escapeHTML(row.sectionTitle || row.group || "")}</span></td>
        <td>${escapeHTML(avg)}</td>
        <td><span class="change ${changeClass}">${escapeHTML(row.changeRaw || "—")}</span></td>
        <td class="trend-cell"></td>
        <td>${escapeHTML(rangeText(row))}</td>
        <td><a href="${escapeHTML(row.sourceUrl || "#")}" target="_blank" rel="noopener">${escapeHTML(row.lastUpdate || "출처")}</a></td>
      `;
      tr.querySelector(".trend-cell").appendChild(priceSparkline(row.history || []));
      tbody.appendChild(tr);
    });
  }

  function renderPriceSignals() {
    const wrap = $("#priceSignals");
    wrap.innerHTML = "";
    const moves = LIVE.signals?.topPriceMoves || [];
    const cards = moves.length ? moves.slice(0, 5) : [];

    if (!cards.length) {
      wrap.appendChild(el("div", "empty-state", "가격 신호 대기 중"));
      return;
    }

    cards.forEach((move) => {
      const card = el("div", "signal-card reveal");
      card.appendChild(el("span", null, escapeHTML(move.group || "가격")));
      card.appendChild(el("strong", null, escapeHTML(move.item)));
      card.appendChild(el("small", null, `${escapeHTML(move.changeRaw || "—")} · 평균 ${escapeHTML(move.averageRaw || fmtPrice(move.average))}`));
      wrap.appendChild(card);
    });
  }

  function renderCompetitors() {
    const grid = $("#competitorGrid");
    grid.innerHTML = "";
    const competitors = LIVE.competitors?.competitors || [];
    $("#competitorMeta").textContent = competitors.length ? `추적 ${competitors.length}개사` : "";

    if (!competitors.length) {
      grid.appendChild(el("div", "empty-state", "경쟁사 데이터 대기 중"));
      return;
    }

    const KO_NAME = { samsung: "삼성전자", micron: "마이크론", cxmt: "CXMT (창신메모리)", kioxia: "키옥시아·WD", ymtc: "YMTC (양쯔메모리)" };

    competitors.forEach((item) => {
      const koName = KO_NAME[item.id] || item.shortLabel || item.label;
      const lines = String(item.baseline || "").split(/\s*·\s*/).map((s) => s.trim()).filter(Boolean).slice(0, 3);
      const card = el("article", "competitor-card reveal");
      card.innerHTML = `
        <div class="competitor-top">
          <div>
            <div class="entity-name">${escapeHTML(koName)}</div>
            <div class="entity-segment">${escapeHTML(item.segment || "")}</div>
          </div>
          <div class="score-ring" style="--score:${item.pressureScore || 0}"><span>${countSpan(item.pressureScore || 0)}</span></div>
        </div>
        <ul class="insight3">${lines.map((l) => `<li>${escapeHTML(l)}</li>`).join("")}</ul>
      `;

      const themeRow = el("div", "theme-row");
      const themes = item.themes?.length ? item.themes : [{ label: "뉴스", count: item.stats?.total || 0 }];
      themes.slice(0, 4).forEach((theme) => themeRow.appendChild(el("span", "theme", `${escapeHTML(theme.label)} ${theme.count || ""}`)));
      card.appendChild(themeRow);
      card.appendChild(renderMiniNews(item.recentNews || []));
      grid.appendChild(card);
    });
  }

  function renderStartups() {
    const grid = $("#startupGrid");
    grid.innerHTML = "";
    const candidates = LIVE.startups?.candidates || [];
    $("#startupMeta").textContent = LIVE.startups?.methodology || "";

    if (!candidates.length) {
      grid.appendChild(el("div", "empty-state", "CVC 후보 데이터 대기 중"));
      return;
    }

    candidates.forEach((item, index) => {
      const card = el("article", `startup-card reveal${index === 0 ? " featured" : ""}`);
      card.innerHTML = `
        <div class="startup-top">
          <div>
            <div class="entity-name">${escapeHTML(item.name)}</div>
            <div class="entity-segment">${escapeHTML(item.area)} · ${escapeHTML(item.stage || "")}</div>
          </div>
          <span class="status-pill">${escapeHTML(item.status || "")}</span>
        </div>
        <p class="entity-body">${escapeHTML(item.whyHynix || item.thesis || "")}</p>
      `;

      const tagRow = el("div", "tag-row");
      (item.tags || []).slice(0, 4).forEach((tag) => tagRow.appendChild(el("span", "tag", escapeHTML(tag))));
      tagRow.appendChild(el("span", "tag tag-fit", `score ${item.score || 0}`));
      card.appendChild(tagRow);
      card.appendChild(renderMiniNews(item.recentNews || []));
      grid.appendChild(card);
    });
  }

  function renderMiniNews(items) {
    const list = el("ul", "mini-news");
    if (!items || !items.length) {
      list.appendChild(el("li", null, '<span class="empty-state">관련 외신 없음</span>'));
      return list;
    }
    items.slice(0, 2).forEach((news) => {
      const li = el("li");
      const a = el("a");
      a.href = news.link || "#";
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = newsTitle(news);
      li.appendChild(a);
      list.appendChild(li);
    });
    return list;
  }

  function renderStocks() {
    const grid = $("#stockGrid");
    grid.innerHTML = "";
    const stocks = LIVE.stocks || {};
    const order = [
      ["skhynix", "SK하이닉스", "000660.KS"],
      ["samsung", "삼성전자", "005930.KS"],
      ["micron", "Micron", "MU"],
    ];

    order.forEach(([id, label, symbol]) => {
      const stock = stocks[id];
      const card = el("article", "stock-card reveal");
      card.innerHTML = `
        <div class="stock-top">
          <div>
            <div class="entity-name">${escapeHTML(stock?.label || label)}</div>
            <div class="stock-symbol">${escapeHTML(stock?.symbol || symbol)}</div>
          </div>
        </div>
      `;

      const DRIVER = { skhynix: "HBM 리더십·AI 수요 견인", samsung: "HBM4 추격·파운드리 회복", micron: "AI 메모리·실적 서프라이즈" };
      if (stock?.latestClose != null) {
        const usd = stock.currency === "USD" || id === "micron";
        const up = (stock.changePct || 0) >= 0;
        card.appendChild(el("div", "stock-price", usd
          ? countSpan(stock.latestClose, { prefix: "$", dec: 2, comma: true })
          : countSpan(stock.latestClose, { prefix: "₩", dec: 0, comma: true })));
        card.appendChild(el("div", `stock-change ${up ? "up" : "down"}`, `${up ? "▲ +" : "▼ "}${fmtNum(stock.changePct, 2)}%`));
        if (Array.isArray(stock.points) && stock.points.length > 1) {
          card.appendChild(sparkline(stock.points, up));
          const pts = stock.points;
          const m = ((pts[pts.length - 1] - pts[0]) / pts[0]) * 100;
          card.appendChild(el("div", "stock-driver",
            `<span class="stk-1m ${m >= 0 ? "up" : "down"}">1개월 ${m >= 0 ? "+" : ""}${m.toFixed(1)}%</span><span class="stk-driver-txt">${escapeHTML(DRIVER[id] || "")}</span>`));
        }
      } else {
        card.appendChild(el("div", "stock-price", "—"));
        card.appendChild(el("div", "stock-change", "데이터 대기 중"));
      }

      grid.appendChild(card);
    });
  }

  function renderNews() {
    const stats = LIVE.newsStats || {};
    $("#newsStats").textContent = `총 ${stats.total || 0} · 24h ${stats.total24h || 0} · 7d ${stats["7d"] || 0}`;

    const tabs = $("#newsTabs");
    tabs.innerHTML = "";
    const categories = [{ id: "all", label: "전체", count: allNews().length }].concat(LIVE.categories || []);

    categories.forEach((category) => {
      const btn = el("button", `tab-btn${category.id === activeCategory ? " active" : ""}`, `${escapeHTML(category.label)} ${category.count || 0}`);
      btn.type = "button";
      btn.dataset.cat = category.id;
      btn.addEventListener("click", () => {
        activeCategory = category.id;
        renderNewsList();
        syncTabs();
      });
      tabs.appendChild(btn);
    });

    $("#newsSearch").oninput = (event) => {
      searchTerm = event.target.value.trim().toLowerCase();
      renderNewsList();
    };

    renderNewsList();
  }

  function syncTabs() {
    $$("#newsTabs .tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.cat === activeCategory);
    });
  }

  function renderNewsList() {
    const list = $("#newsList");
    list.innerHTML = "";
    let items = activeMemoryCategory === "all" ? allNews() : filteredNewsForCategory(activeMemoryCategory);
    if (activeCategory !== "all") items = items.filter((item) => item.category === activeCategory);
    if (searchTerm) items = items.filter((item) => item.title.toLowerCase().includes(searchTerm));

    if (!items.length) {
      list.appendChild(el("li", null, '<span class="empty-state">조건에 맞는 뉴스가 없습니다.</span>'));
      return;
    }

    items.slice(0, 42).forEach((item) => {
      const li = el("li");
      const a = el("a");
      a.href = item.link || "#";
      a.target = "_blank";
      a.rel = "noopener";
      a.innerHTML = `
        <span class="news-main">
          <span class="news-cat">${escapeHTML(categoryLabel(item.category))}</span>
          <span class="news-title">${escapeHTML(newsTitle(item))}</span>
        </span>
        <span class="news-meta">${escapeHTML(item.source || "")} ${escapeHTML(item.date || "")}</span>
      `;
      li.appendChild(a);
      list.appendChild(li);
    });
  }

  function renderDealflow() {
    const list = $("#dealflowList");
    if (!list) return;
    list.innerHTML = "";
    const stream = (LIVE.dealflow && LIVE.dealflow.stream) || [];
    if (!stream.length) {
      list.appendChild(el("li", null, '<span class="empty-state">딜플로우 외신 대기 중</span>'));
      return;
    }
    stream.slice(0, 8).forEach((item) => {
      const li = el("li");
      const a = el("a");
      a.href = item.link || "#";
      a.target = "_blank";
      a.rel = "noopener";
      a.innerHTML = `<span class="df-title">${escapeHTML(newsTitle(item))}</span><span class="df-meta">${escapeHTML(item.source || "")} ${escapeHTML(item.date || "")}</span>`;
      li.appendChild(a);
      list.appendChild(li);
    });
  }

  function renderTrending() {
    const cloud = $("#trendCloud");
    cloud.innerHTML = "";
    const terms = LIVE.trending || [];
    if (!terms.length) {
      cloud.appendChild(el("div", "empty-state", "키워드 대기 중"));
      return;
    }

    terms.slice(0, 16).forEach((term) => {
      const chip = el("button", "trend-chip", `${escapeHTML(term.term)} <span class="trend-count">${term.count}</span>`);
      chip.type = "button";
      chip.addEventListener("click", () => {
        searchTerm = String(term.term).toLowerCase();
        $("#newsSearch").value = term.term;
        activeCategory = "all";
        renderNewsList();
        syncTabs();
      });
      cloud.appendChild(chip);
    });
  }

  function renderHealth() {
    const list = $("#healthList");
    list.innerHTML = "";
    const items = LIVE.health || [];
    if (!items.length) {
      list.appendChild(el("li", null, '<span>대기 중</span><span class="fail">—</span>'));
      return;
    }

    items.slice(0, 10).forEach((item) => {
      const li = el("li");
      li.appendChild(el("span", null, escapeHTML(item.step)));
      li.appendChild(el("span", item.ok ? "ok" : "fail", item.ok ? "OK" : "FAIL"));
      li.title = item.msg || "";
      list.appendChild(li);
    });
  }

  function renderScenario() {
    const bg = BASE.background || {};
    $("#bgTitle").textContent = bg.title || "메모리 원가 전가 시뮬레이터";
    $("#bgDesc").textContent = bg.desc || "";
    if (bg.formula) $("#bgSource").textContent = `${bg.formula.source} · ${bg.formula.sourceDate}`;

    const simulator = BASE.simulator;
    if (!simulator) return;

    const fields = [
      { key: "costSharePct", label: "메모리 원가 비중", suffix: "%" },
      { key: "priceIncreasePct", label: "메모리 단가 인상", suffix: "%" },
      { key: "passThroughPct", label: "전가율", suffix: "%" },
    ];
    const state = { ...simulator.defaults };
    const controls = $("#simControls");
    const devicesWrap = $("#simDevices");
    controls.innerHTML = "";
    devicesWrap.innerHTML = "";

    fields.forEach((field) => {
      const range = simulator.ranges[field.key];
      const wrap = el("div", "sim-field");
      const label = el("label");
      label.innerHTML = `<span>${escapeHTML(field.label)}</span><span class="val" id="val-${field.key}">${state[field.key]}${field.suffix}</span>`;
      const input = el("input");
      input.type = "range";
      input.min = range.min;
      input.max = range.max;
      input.step = range.step;
      input.value = state[field.key];
      input.addEventListener("input", () => {
        state[field.key] = parseFloat(input.value);
        $(`#val-${field.key}`).textContent = state[field.key] + field.suffix;
        update();
      });
      wrap.appendChild(label);
      wrap.appendChild(input);
      controls.appendChild(wrap);
    });

    simulator.devices.forEach((device) => {
      const row = el("div", "sim-device");
      row.innerHTML = `
        <span class="dev-label">${escapeHTML(device.label)}</span>
        <span class="dev-prices">
          <span class="dev-base">${fmtKRW(device.basePrice)}</span><br>
          <span class="dev-new" id="dev-${device.id}"></span>
        </span>
      `;
      devicesWrap.appendChild(row);
    });

    function update() {
      const inc = (state.costSharePct / 100) * (state.priceIncreasePct / 100) * (state.passThroughPct / 100) * 100;
      $("#simResult").textContent = "+" + inc.toFixed(1) + "%";
      $("#simFormula").textContent = `${state.costSharePct}% × ${state.priceIncreasePct}% × ${state.passThroughPct}%`;
      simulator.devices.forEach((device) => {
        $(`#dev-${device.id}`).textContent = fmtKRW(device.basePrice * (1 + inc / 100));
      });
    }
    update();
  }

  function renderSources() {
    const list = $("#sourceList");
    list.innerHTML = "";
    const sources = (BASE.sources || []).concat(LIVE.prices?.source ? [LIVE.prices.source] : []);
    [...new Set(sources)].forEach((source) => list.appendChild(el("li", null, escapeHTML(source))));
    $("#disclaimer").textContent = BASE.disclaimer || "";
  }

  function priceSparkline(points) {
    const vals = (points || []).map((point) => point.average).filter((value) => value != null);
    if (vals.length < 2) {
      const dash = el("span", "trend-empty", "—");
      dash.title = "히스토리는 다음 가격 갱신부터 누적됩니다.";
      return dash;
    }
    return miniLine(vals, vals[vals.length - 1] >= vals[0] ? "#dc2626" : "#2563eb", "price-spark");
  }

  function sparkline(points, up) {
    const vals = points.filter((value) => value != null);
    if (vals.length < 2) return el("div");
    return miniLine(vals, up ? "#dc2626" : "#2563eb", "stock-spark");
  }

  function miniLine(vals, stroke, cls) {
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    const w = 100;
    const h = 42;
    const step = w / (vals.length - 1);
    const d = vals
      .map((value, index) => `${index === 0 ? "M" : "L"}${(index * step).toFixed(1)},${(h - ((value - min) / range) * h).toFixed(1)}`)
      .join(" ");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("class", cls);
    svg.setAttribute("preserveAspectRatio", "none");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", stroke);
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute("stroke-linecap", "round");
    svg.appendChild(path);
    if (cls === "stock-spark") {
      const mark = (idx, color) => {
        if (idx < 0) return;
        const cx = idx * step;
        const cy = h - ((vals[idx] - min) / range) * h;
        const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        c.setAttribute("cx", cx.toFixed(1));
        c.setAttribute("cy", cy.toFixed(1));
        c.setAttribute("r", "2.8");
        c.setAttribute("fill", color);
        const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
        title.textContent = (color === "#dc2626" ? "고점 " : "저점 ") + vals[idx];
        c.appendChild(title);
        svg.appendChild(c);
      };
      mark(vals.indexOf(max), "#dc2626");
      mark(vals.indexOf(min), "#2563eb");
    }
    return svg;
  }

  function setupScroll() {
    const header = $("#siteHeader");
    window.addEventListener("scroll", () => header.classList.toggle("scrolled", window.scrollY > 8), { passive: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
