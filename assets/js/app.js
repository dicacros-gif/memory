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
    timezone: "Asia/Seoul",
    prices: { sections: [], watchedItems: [] },
    news: [],
    categories: [],
    benchmarkSignals: { stream: [] },
    newsStats: {},
    health: [],
  };

  const KOREAN_SOURCE_RE =
    /(yonhap|korea ?herald|korea ?times|koreatimes|koreaherald|chosun|joongang|joong ?ang|donga|dong-?a|hankyung|hankyoreh|ked ?global|kedglobal|maeil|maekyung|pulse ?news|business ?korea|businesskorea|et ?news|etnews|the ?elec|thelec|zdnet ?korea|sedaily|seoul ?economic|aju ?(business|news|press)|korea ?economic|korea ?joongang|korea ?biz ?wire|koreabizwire|inews24|edaily|mt\.co\.kr|mk\.co\.kr|dt\.co\.kr|\.kr\b|korea ?pro|the ?korea|naver|daum|fnnews|newspim|moneytoday|heraldcorp)/i;
  const MEMORY_NEWS_RE =
    /(memory|dram|nand|hbm|ddr|lpddr|gddr|ssd|semiconductor|chip|wafer|foundry|packaging|interconnect|cxl|trendforce|dramexchange|micron|samsung|sk hynix|hynix|kioxia|western digital|sandisk|cxmt|changxin|ymtc|yangtze|jcet|tfme|xmc|wuhan xinxin|naura|amec|acm research|techinsights|yole|big fund|export control|china chip|chinese chip)/i;
  const CHINA_NEWS_RE =
    /(china|chinese|cxmt|changxin|ymtc|yangtze|jcet|tfme|xmc|wuhan|naura|amec|huawei|tencent|alibaba|baidu|lenovo|big fund|36kr|pandaily|caixin|yicai|scmp|kraneshares|sina|sohu|eastmoney|huxiu|jiwei|c114|digitimes asia)/i;
  const APPLE_CONTENT_RE =
    /\b(apple|aapl|iphone|ipad|macbook|9to5mac|applemagazine)\b|애플|아이폰|아이패드|맥북/i;
  const SOURCE_SUFFIX_RE = /\s[-–—]\s(?:[A-Za-z0-9가-힣 .·&]+)$/;
  const CATEGORY_INSIGHTS = {
    hbm: "HBM 인증·수율·고객 승인 속도를 삼성·마이크론과 비교",
    dram: "DDR5·LPDDR·범용 DRAM 가격과 고객 인증 변화 추적",
    nand: "YMTC·eSSD·NAND 계약가 회복 사이클과 공급 압력 비교",
    cxl: "CXL 메모리 풀링·컨트롤러·스위치 생태계 진입 타이밍 관찰",
    packaging: "HBM 적층·하이브리드 본딩·OSAT 우회로와 장비 병목 점검",
    aidemand: "AI 서버·가속기 수요가 메모리 믹스와 가격에 주는 영향 확인",
    china: "중국 내수 고객·정책·공급망 내재화 신호를 경쟁사별로 추적",
    equipment: "Naura·AMEC·ACM 등 장비 국산화와 공정 recipe 흡수 속도 관찰",
    geopolitics: "수출통제·허가 예외·중국 자본 투입이 공급망을 바꾸는지 점검",
    talent: "핵심 엔지니어 이동·채용 JD·IP 신호가 기술 격차를 줄이는지 확인",
  };
  const CATEGORY_ACCENTS = {
    all: "#4322A8",
    dram: "#7A38D6",
    nand: "#1428A0",
    packaging: "#0E8F6E",
    equipment: "#0A6E63",
    talent: "#C026D3",
    geopolitics: "#2D6BFF",
    hbm: "#7A38D6",
    cxl: "#0891B2",
    aidemand: "#16A34A",
    china: "#1428A0",
  };

  let BASE = null;
  let LIVE = emptyLive;
  let activeCategory = "all";
  let priceFilter = "all";
  let newsCategory = "all";
  let newsSearch = "";
  let typeTimer = null;

  async function loadJSON(path, fallback) {
    try {
      const res = await fetch(path, { cache: "no-store" });
      if (!res.ok) throw new Error(`${path} ${res.status}`);
      return await res.json();
    } catch (error) {
      console.warn(error.message);
      return fallback;
    }
  }

  async function init() {
    [BASE, LIVE] = await Promise.all([
      loadJSON("data/baseline.json", null),
      loadJSON("data/live.json", emptyLive),
    ]);

    if (!BASE) {
      document.body.innerHTML = "<main class=\"empty\">baseline.json을 불러오지 못했습니다.</main>";
      return;
    }

    renderChrome();
    renderSidebarCategories();
    renderKpis();
    renderCategories();
    renderChannels();
    renderCompanies();
    renderDynamics();
    renderModels();
    renderResponses();
    renderPrices();
    renderNews();
    setupQA();
    setupInteractions();
    setupScrollSpy();
    animateCounts();
  }

  function memoryCategories() {
    return BASE.memoryCategories || [];
  }

  function categoryAccent(id) {
    return CATEGORY_ACCENTS[id] || CATEGORY_ACCENTS.all;
  }

  function activeCategoryData() {
    return memoryCategories().find((item) => item.id === activeCategory) || memoryCategories()[0];
  }

  function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
  }

  function fmtDate(iso) {
    if (!iso) return "아직 수집 전";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      dateStyle: "medium",
      timeStyle: "short",
    }) + " KST";
  }

  function fmtNum(value, digits = 0) {
    const n = Number(value);
    if (Number.isNaN(n)) return escapeHTML(value);
    return n.toLocaleString("ko-KR", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }

  function countHTML(value, opts = {}) {
    const n = Number(value);
    if (Number.isNaN(n)) return escapeHTML(value);
    const { prefix = "", suffix = "", decimals = 0 } = opts;
    return `<span class="count" data-to="${n}" data-prefix="${escapeHTML(prefix)}" data-suffix="${escapeHTML(suffix)}" data-decimals="${decimals}">${escapeHTML(prefix)}0${escapeHTML(suffix)}</span>`;
  }

  function animateCounts(root = document) {
    const counts = $$(".count", root);
    const run = (node) => {
      if (node.dataset.done === "1") return;
      node.dataset.done = "1";
      const to = Number(node.dataset.to || 0);
      const prefix = node.dataset.prefix || "";
      const suffix = node.dataset.suffix || "";
      const decimals = Number(node.dataset.decimals || 0);
      const start = performance.now();
      const dur = 850;
      const step = (now) => {
        const k = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - k, 3);
        node.textContent = prefix + fmtNum(to * eased, decimals) + suffix;
        if (k < 1) requestAnimationFrame(step);
        else node.textContent = prefix + fmtNum(to, decimals) + suffix;
      };
      requestAnimationFrame(step);
    };

    if (!("IntersectionObserver" in window)) {
      counts.forEach(run);
      return;
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) run(entry.target);
      });
    }, { threshold: 0.3 });
    counts.forEach((node) => io.observe(node));
  }

  function renderChrome() {
    document.title = BASE.meta?.title || document.title;
    const saved = localStorage.getItem("memory-theme") || "light";
    document.documentElement.dataset.theme = saved;
    $("#themeBtn").addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      localStorage.setItem("memory-theme", next);
    });
  }

  function renderSidebarCategories() {
    const wrap = $("#sideCategories");
    wrap.innerHTML = "";
    memoryCategories().forEach((category) => {
      const btn = el("button", `sb-cat${category.id === activeCategory ? " active" : ""}`);
      btn.type = "button";
      btn.dataset.category = category.id;
      btn.style.setProperty("--local-accent", categoryAccent(category.id));
      btn.innerHTML = `<span>${escapeHTML(category.label)}</span><small>${escapeHTML(category.en)}</small>`;
      btn.addEventListener("click", () => {
        setCategory(category.id);
        jumpTo("categories");
      });
      wrap.appendChild(btn);
    });
  }

  function setCategory(id) {
    activeCategory = id;
    const cat = activeCategoryData();
    $("#categoryMeta").textContent = `${cat.label} · ${cat.desc}`;
    $$(".sb-cat").forEach((btn) => btn.classList.toggle("active", btn.dataset.category === id));
    renderCategories();
    renderChannels();
    renderCompanies();
    renderDynamics();
    renderModels();
    renderNews();
    animateCounts();
  }

  function renderKpis() {
    const strip = $("#overview");
    strip.innerHTML = "";
    (BASE.kpis || []).forEach((kpi, index) => {
      const node = el("article", "kpi reveal");
      node.style.animationDelay = `${index * 35}ms`;
      node.innerHTML = `
        <span>${escapeHTML(kpi.label)}</span>
        <strong>${countHTML(kpi.value, {
          prefix: kpi.prefix || "",
          suffix: kpi.suffix || "",
          decimals: kpi.decimals || 0,
        })}</strong>
        <small>${escapeHTML(kpi.note)}</small>
      `;
      strip.appendChild(node);
    });
  }

  function relatedToActive(item) {
    if (activeCategory === "all") return true;
    return (item.linkedCategories || []).includes(activeCategory);
  }

  function renderCategories() {
    const grid = $("#categoryGrid");
    grid.innerHTML = "";
    const active = activeCategoryData();
    $("#categoryMeta").textContent = `${active.label} · ${active.desc}`;
    memoryCategories().filter((cat) => cat.id !== "all").forEach((cat, index) => {
      const stats = categoryStats(cat.id);
      const card = el("article", `card reveal${cat.id === activeCategory ? " active" : ""}`);
      card.style.animationDelay = `${index * 35}ms`;
      card.style.setProperty("--local-accent", categoryAccent(cat.id));
      card.innerHTML = `
        <div class="card-top">
          <div>
            <span class="chip accent">${escapeHTML(cat.en)}</span>
            <h3>${escapeHTML(cat.label)}</h3>
          </div>
          <button class="chip" type="button" data-cat="${escapeHTML(cat.id)}">보기</button>
        </div>
        <p>${escapeHTML(cat.desc)}</p>
        <div class="metric-row">
          <div class="metric"><strong>${countHTML(stats.companies)}</strong><span>업체</span></div>
          <div class="metric"><strong>${countHTML(stats.news)}</strong><span>외신</span></div>
          <div class="metric"><strong>${countHTML(stats.prices)}</strong><span>가격</span></div>
        </div>
        <div class="tag-row">${(cat.keywords || []).slice(0, 5).map((tag) => `<span class="tag">${escapeHTML(tag)}</span>`).join("")}</div>
      `;
      card.querySelector("[data-cat]").addEventListener("click", () => setCategory(cat.id));
      grid.appendChild(card);
    });
  }

  function categoryStats(id) {
    return {
      companies: (BASE.companies || []).filter((c) => (c.linkedCategories || []).includes(id)).length,
      news: filteredNews(id).length,
      prices: priceRowsFor(id).length,
    };
  }

  function renderChannels() {
    const grid = $("#channelGrid");
    grid.innerHTML = "";
    (BASE.channels || []).filter(relatedToActive).forEach((item, index) => {
      const card = el("article", "card reveal");
      card.style.animationDelay = `${index * 35}ms`;
      card.style.setProperty("--local-accent", categoryAccent((item.linkedCategories || [])[0]));
      card.innerHTML = `
        <div class="card-top">
          <div>
            <span class="chip accent">${escapeHTML(item.source)}</span>
            <h3>${escapeHTML(item.title)}</h3>
          </div>
        </div>
        <p>${escapeHTML(item.desc)}</p>
        <ul class="watch-list">${(item.signals || []).map((s) => `<li>${escapeHTML(s)}</li>`).join("")}</ul>
      `;
      grid.appendChild(card);
    });
    if (!grid.children.length) grid.appendChild(el("div", "empty", "선택한 카테고리의 정보 소스가 없습니다."));
  }

  function renderCompanies() {
    const grid = $("#companyGrid");
    const items = (BASE.companies || []).filter(relatedToActive);
    $("#competitorMeta").textContent = `${items.length}개 업체 · ${activeCategoryData().label}`;
    grid.innerHTML = "";
    items.forEach((company, index) => {
      const card = el("article", "card reveal");
      card.style.animationDelay = `${index * 35}ms`;
      card.style.setProperty("--local-accent", categoryAccent((company.linkedCategories || [])[0]));
      card.innerHTML = `
        <div class="card-top">
          <div>
            <span class="chip accent">${escapeHTML(company.category)}</span>
            <h3>${escapeHTML(company.name)}</h3>
            <span class="source-tag">${escapeHTML(company.fullName)}</span>
          </div>
          <div class="score" style="--score:${Number(company.score || 0)}"><span>${escapeHTML(company.score || "")}</span></div>
        </div>
        <p>${escapeHTML(company.summary)}</p>
        <div class="metric-row">
          ${(company.metrics || []).slice(0, 3).map((m) => `<div class="metric"><strong>${escapeHTML(m.value)}</strong><span>${escapeHTML(m.label)}</span></div>`).join("")}
        </div>
        <ul class="watch-list">${(company.watch || []).slice(0, 4).map((w) => `<li>${escapeHTML(w)}</li>`).join("")}</ul>
        <div class="insight-box"><span>Benchmark insight</span>${escapeHTML(company.insight)}</div>
      `;
      grid.appendChild(card);
    });
    if (!items.length) grid.appendChild(el("div", "empty", "선택한 카테고리의 경쟁사 카드가 없습니다."));
  }

  function renderDynamics() {
    const grid = $("#dynamicGrid");
    grid.innerHTML = "";
    (BASE.dynamics || []).filter(relatedToActive).forEach((item, index) => {
      const card = el("article", "card reveal");
      card.style.animationDelay = `${index * 35}ms`;
      card.style.setProperty("--local-accent", categoryAccent((item.linkedCategories || [])[0]));
      card.innerHTML = `
        <span class="chip accent">${escapeHTML(item.axis)}</span>
        <h3>${escapeHTML(item.title)}</h3>
        <p>${escapeHTML(item.desc)}</p>
        <div class="tag-row">${(item.players || []).map((p) => `<span class="tag">${escapeHTML(p)}</span>`).join("")}</div>
        <ul class="watch-list">${(item.watch || []).map((w) => `<li>${escapeHTML(w)}</li>`).join("")}</ul>
      `;
      grid.appendChild(card);
    });
    if (!grid.children.length) grid.appendChild(el("div", "empty", "선택한 카테고리의 경쟁 다이나믹스가 없습니다."));
  }

  function renderModels() {
    const grid = $("#modelGrid");
    grid.innerHTML = "";
    (BASE.monetizationModels || []).filter(relatedToActive).forEach((item, index) => {
      const card = el("article", "card reveal");
      card.style.animationDelay = `${index * 35}ms`;
      card.style.setProperty("--local-accent", categoryAccent((item.linkedCategories || [])[0]));
      card.innerHTML = `
        <h3>${escapeHTML(item.title)}</h3>
        <p>${escapeHTML(item.logic)}</p>
        <div class="metric-row">
          <div class="metric"><strong>Metric</strong><span>${escapeHTML(item.metric)}</span></div>
          <div class="metric"><strong>Watch</strong><span>${escapeHTML(item.watch)}</span></div>
          <div class="metric"><strong>Fit</strong><span>${(item.linkedCategories || []).map(categoryName).join(" · ")}</span></div>
        </div>
      `;
      grid.appendChild(card);
    });
    if (!grid.children.length) grid.appendChild(el("div", "empty", "선택한 카테고리의 벤치마킹 모델이 없습니다."));
  }

  function renderResponses() {
    const grid = $("#responseGrid");
    grid.innerHTML = "";
    (BASE.responses || []).forEach((item, index) => {
      const card = el("article", "card reveal");
      card.style.animationDelay = `${index * 35}ms`;
      card.innerHTML = `
        <div class="card-top">
          <div>
            <span class="chip accent">${escapeHTML(item.priority)}</span>
            <h3>${escapeHTML(item.title)}</h3>
          </div>
        </div>
        <p>${escapeHTML(item.desc)}</p>
        <ul class="watch-list">${(item.actions || []).map((a) => `<li>${escapeHTML(a)}</li>`).join("")}</ul>
      `;
      grid.appendChild(card);
    });
  }

  function categoryName(id) {
    return memoryCategories().find((cat) => cat.id === id)?.label || id;
  }

  function setupInteractions() {
    $$("[data-jump]").forEach((btn) => {
      btn.addEventListener("click", () => jumpTo(btn.dataset.jump));
    });

    $("#mobileMenu").addEventListener("click", () => document.body.classList.add("menu-open"));
    $("#backdrop").addEventListener("click", () => document.body.classList.remove("menu-open"));

    $("#newsSearch").addEventListener("input", (event) => {
      newsSearch = event.target.value.trim().toLowerCase();
      renderNewsList();
    });
  }

  function jumpTo(id) {
    const target = document.getElementById(id);
    if (!target) return;
    document.body.classList.remove("menu-open");
    const lastSection = $$("main > section").at(-1);
    target.scrollIntoView({ behavior: "smooth", block: target === lastSection ? "end" : "start" });
  }

  function setupScrollSpy() {
    const sections = ["overview", "prices", "news", "categories", "competitors", "dynamics", "monetization", "response", "intelligence"];
    const update = () => {
      const y = window.scrollY + 96;
      let active = "overview";
      sections.forEach((id) => {
        const node = document.getElementById(id);
        if (node && node.offsetTop <= y) active = id;
      });
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        active = sections[sections.length - 1];
      }
      const lastNode = document.getElementById(sections[sections.length - 1]);
      if (lastNode && lastNode.getBoundingClientRect().top < window.innerHeight * 0.72) {
        active = sections[sections.length - 1];
      }
      $$(".sb-item").forEach((btn) => btn.classList.toggle("active", btn.dataset.jump === active));
    };
    window.addEventListener("scroll", update, { passive: true });
    update();
  }

  /* ---------------- Q&A ---------------- */
  function setupQA() {
    const input = $("#qaInput");
    const toggle = $("#qaToggle");
    const drop = $("#qaDrop");

    const openDrop = () => {
      renderQADrop(input.value);
      drop.hidden = false;
    };
    const closeDrop = () => { drop.hidden = true; };

    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      if (drop.hidden) openDrop();
      else closeDrop();
    });

    input.addEventListener("focus", openDrop);
    input.addEventListener("input", () => {
      if (!drop.hidden) renderQADrop(input.value);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        closeDrop();
        answerQuestion(input.value);
      }
      if (event.key === "Escape") closeDrop();
    });
    document.addEventListener("click", (event) => {
      if (!$("#qaBox").contains(event.target)) closeDrop();
    });
  }

  function renderQADrop(filter = "") {
    const drop = $("#qaDrop");
    const data = BASE.qa || { cats: [], pairs: [] };
    const q = String(filter || "").toLowerCase();
    const cats = data.cats || [];
    const pairs = (data.pairs || []).filter((pair) => {
      if (!q) return true;
      const hay = `${pair.q} ${pair.a} ${(pair.keywords || []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });

    drop.innerHTML = "";
    cats.forEach((cat) => {
      const groupPairs = pairs.filter((pair) => pair.cat === cat.id);
      if (!groupPairs.length) return;
      const group = el("div", "qa-group");
      group.appendChild(el("div", "qa-group-title", escapeHTML(cat.name)));
      groupPairs.forEach((pair) => {
        const btn = el("button", "qa-option", escapeHTML(pair.q));
        btn.type = "button";
        btn.style.setProperty("--qa", cat.color || "var(--accent)");
        btn.addEventListener("click", () => {
          $("#qaInput").value = pair.q;
          drop.hidden = true;
          answerQuestion(pair.q);
        });
        group.appendChild(btn);
      });
      drop.appendChild(group);
    });

    if (!drop.children.length) {
      drop.appendChild(el("div", "empty", "일치하는 질문이 없습니다. Enter를 누르면 가장 가까운 답변을 찾습니다."));
    }
  }

  function answerQuestion(query) {
    const data = BASE.qa || { pairs: [] };
    const q = String(query || "").trim();
    if (!q) return;

    const scored = (data.pairs || []).map((pair) => {
      const tokens = [pair.q].concat(pair.keywords || []).map((x) => String(x).toLowerCase());
      const hay = q.toLowerCase();
      const score = tokens.reduce((acc, token) => acc + (token && hay.includes(token) ? 3 : 0), 0) +
        (pair.q.toLowerCase().includes(hay) ? 5 : 0);
      return { pair, score };
    }).sort((a, b) => b.score - a.score);

    const best = scored[0]?.score > 0 ? scored[0].pair : data.pairs[0];
    showAnswer(best || { q, a: "관련 답변을 찾지 못했습니다.", nav: "overview" });
  }

  function showAnswer(pair) {
    const overlay = $("#qaAnswer");
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    overlay.innerHTML = `
      <div class="answer-panel" role="dialog" aria-modal="true">
        <div class="answer-head">
          <span>A</span>
          <strong>${escapeHTML(pair.q)}</strong>
          <button type="button" id="answerClose">닫기</button>
        </div>
        <div class="answer-body" id="answerBody"></div>
        <div class="answer-foot">
          <button type="button" id="answerJump">관련 섹션으로 이동</button>
        </div>
      </div>
    `;

    $("#answerClose").addEventListener("click", closeAnswer);
    $("#answerJump").addEventListener("click", () => {
      closeAnswer();
      jumpTo(pair.nav || "overview");
    });
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeAnswer();
    }, { once: true });

    typeAnswer(pair.a || "");
  }

  function closeAnswer() {
    if (typeTimer) clearInterval(typeTimer);
    typeTimer = null;
    $("#qaAnswer").hidden = true;
    $("#qaAnswer").innerHTML = "";
    document.body.style.overflow = "";
  }

  function typeAnswer(text) {
    const body = $("#answerBody");
    const highlighted = highlight(text);
    const plain = text;
    let i = 0;
    if (typeTimer) clearInterval(typeTimer);
    typeTimer = setInterval(() => {
      i += Math.max(2, Math.ceil(plain.length / 130));
      if (i >= plain.length) {
        clearInterval(typeTimer);
        typeTimer = null;
        body.innerHTML = highlighted;
        return;
      }
      body.textContent = plain.slice(0, i) + "▋";
    }, 18);
  }

  function highlight(text) {
    return escapeHTML(text).replace(
      /(CXMT|YMTC|XMC|JCET|Naura|AMEC|TrendForce|HBM4?E?|DRAM|NAND|DDR5|LPDDR|CXL|IP|TSV|EUV|DUV|Big Fund|빅펀드|메기|비대칭|마이크로데이터)/g,
      "<b>$1</b>",
    );
  }

  /* ---------------- Prices ---------------- */
  function allPriceRows() {
    const sections = LIVE.prices?.sections || [];
    return sections.flatMap((section) => (section.rows || []).map((row) => ({
      ...row,
      sectionTitle: section.title,
      group: section.group,
      lastUpdate: section.lastUpdate,
      sourceUrl: section.sourceUrl,
    })));
  }

  function priceRowsFor(categoryId = activeCategory) {
    let rows = allPriceRows();
    if (categoryId === "dram") rows = rows.filter((row) => /dram|ddr|lpddr|gddr/i.test(`${row.group} ${row.sectionTitle} ${row.item}`));
    if (categoryId === "nand") rows = rows.filter((row) => /nand|ssd|flash|wafer|ufs|emmc/i.test(`${row.group} ${row.sectionTitle} ${row.item}`));
    if (priceFilter === "spot") rows = rows.filter((row) => /spot|street/i.test(row.sectionTitle || ""));
    if (priceFilter === "contract") rows = rows.filter((row) => /contract/i.test(row.sectionTitle || ""));
    return rows;
  }

  function renderPrices() {
    const tabs = $("#priceTabs");
    tabs.innerHTML = "";
    [
      ["all", "전체"],
      ["spot", "Spot"],
      ["contract", "Contract"],
    ].forEach(([id, label]) => {
      const btn = el("button", id === priceFilter ? "active" : "", label);
      btn.type = "button";
      btn.addEventListener("click", () => {
        priceFilter = id;
        renderPrices();
      });
      tabs.appendChild(btn);
    });

    renderPriceSummary();
    renderPriceRows();
  }

  function renderPriceSummary() {
    const rows = priceRowsFor();
    const summary = $("#priceSummary");
    const up = rows.filter((row) => Number(row.changePct) > 0).length;
    const down = rows.filter((row) => Number(row.changePct) < 0).length;
    const contract = rows.filter((row) => /contract/i.test(row.sectionTitle || "")).length;
    const spot = rows.filter((row) => /spot|street/i.test(row.sectionTitle || "")).length;
    const updated = LIVE.prices?.updatedAt || LIVE.updatedAt;
    const cards = [
      ["Rows", rows.length, "선택 조건 가격 항목"],
      ["Spot", spot, "현물·street price"],
      ["Contract", contract, "계약가 항목"],
      ["Up / Down", `${up}/${down}`, fmtDate(updated)],
    ];
    summary.innerHTML = cards.map(([label, value, note]) => `
      <article class="card">
        <span class="chip accent">${escapeHTML(label)}</span>
        <h3>${typeof value === "number" ? countHTML(value) : escapeHTML(value)}</h3>
        <p>${escapeHTML(note)}</p>
      </article>
    `).join("");
  }

  function renderPriceRows() {
    const tbody = $("#priceRows");
    const rows = priceRowsFor();
    tbody.innerHTML = "";
    if (!rows.length) {
      tbody.appendChild(el("tr", null, "<td colspan=\"6\" class=\"empty\">가격 데이터가 아직 없습니다.</td>"));
      return;
    }

    rows.slice(0, 22).forEach((row) => {
      const tr = el("tr");
      const change = formatChange(row);
      tr.innerHTML = `
        <td><span class="source-tag">${escapeHTML(row.group || "")}</span></td>
        <td><span class="price-main">${escapeHTML(row.item)}</span><span class="price-sub">${escapeHTML(row.sectionTitle || "")}</span></td>
        <td>${escapeHTML(row.averageRaw || formatPrice(row.average))}</td>
        <td><span class="change ${escapeHTML(row.direction || "flat")}">${escapeHTML(change)}</span></td>
        <td></td>
        <td><a class="rainbow" href="${escapeHTML(row.sourceUrl || "#")}" target="_blank" rel="noopener">${escapeHTML(row.lastUpdate || "TrendForce")}</a></td>
      `;
      tr.children[4].appendChild(sparkline((row.history || []).map((p) => p.average).filter((x) => x != null), row.direction));
      tbody.appendChild(tr);
    });
  }

  function formatPrice(value) {
    if (value == null || Number.isNaN(Number(value))) return "-";
    const n = Number(value);
    return n >= 100 ? n.toFixed(2) : n.toFixed(3);
  }

  function formatChange(row) {
    const n = Number(row.changePct);
    if (!Number.isNaN(n)) return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
    return String(row.changeRaw || "-").replace(/\?\?/g, "");
  }

  function sparkline(vals, direction = "flat") {
    if (!vals || vals.length < 2) return el("span", "price-sub", "history 대기");
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    const w = 96;
    const h = 30;
    const step = w / (vals.length - 1);
    const d = vals.map((v, i) => `${i ? "L" : "M"}${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`).join(" ");
    const color = direction === "down" ? "#2563eb" : direction === "up" ? "#dc2626" : "#6f7b90";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "spark");
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("preserveAspectRatio", "none");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", color);
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.appendChild(path);
    return svg;
  }

  /* ---------------- News ---------------- */
  function rawNews() {
    const live = LIVE.news || [];
    const clean = live.filter((item) => isForeignNews(item) && isMemoryRelevant(item) && !isAppleContent(item));
    return clean.length ? clean : (BASE.fallbackNews || []);
  }

  function isForeignNews(item) {
    const src = `${item.source || ""} ${item.link || ""}`.toLowerCase();
    if (!item || !item.title) return false;
    if (KOREAN_SOURCE_RE.test(src)) return false;
    return true;
  }

  function isMemoryRelevant(item) {
    const hay = `${item.title || ""} ${item.titleKo || ""} ${item.summary || ""} ${item.source || ""}`.toLowerCase();
    return MEMORY_NEWS_RE.test(hay);
  }

  function isAppleContent(item) {
    const hay = `${item.title || ""} ${item.titleKo || ""} ${item.summary || ""} ${item.source || ""} ${item.link || ""}`;
    return APPLE_CONTENT_RE.test(hay);
  }

  function newsTitle(item) {
    return cleanKoreanTitle(item.titleKo || item.title || "");
  }

  function cleanKoreanTitle(title) {
    return String(title || "")
      .replace(SOURCE_SUFFIX_RE, "")
      .replace(/\bSamsung\b/g, "삼성")
      .replace(/\bMicron\b/g, "마이크론")
      .replace(/\bNVIDIA\b/g, "엔비디아")
      .replace(/\bSK Hynix\b/gi, "SK하이닉스")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isChinaArticle(item) {
    if (item.category === "china") return true;
    const hay = `${item.category || ""} ${item.source || ""} ${item.link || ""} ${item.title || ""} ${item.titleKo || ""} ${item.summary || ""}`;
    return CHINA_NEWS_RE.test(hay);
  }

  function insightLines(item) {
    const title = newsTitle(item);
    const summary = cleanKoreanTitle(item.summary || title);
    const category = CATEGORY_INSIGHTS[item.category] || "메모리 업계 가격·고객·공급망 변화를 함께 점검";
    const signal = isChinaArticle(item)
      ? "중국 신호: 내수 고객, 정책 지원, 장비·패키징 우회 가능성 확인"
      : "외신 신호: 해외 검증 보도 기준으로 가격·수요·경쟁 구도 확인";
    const meta = `${item.source || "출처 미상"}${item.date || item.published ? ` · ${item.date || item.published}` : ""}`;
    return [
      `핵심: ${clipText(summary, 78)}`,
      `벤치마킹: ${category}`,
      `체크포인트: ${signal} · ${meta}`,
    ];
  }

  function clipText(text, limit) {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    if (clean.length <= limit) return clean;
    return `${clean.slice(0, limit - 1).trim()}…`;
  }

  function filteredNews(categoryId = activeCategory) {
    const cat = memoryCategories().find((item) => item.id === categoryId);
    const terms = (cat?.keywords || []).map((term) => term.toLowerCase());
    return rawNews().filter((item) => {
      if (!categoryId || categoryId === "all") return true;
      if (item.category === categoryId) return true;
      const hay = `${item.title || ""} ${item.titleKo || ""} ${item.summary || ""} ${item.source || ""}`.toLowerCase();
      return terms.some((term) => hay.includes(term));
    });
  }

  function renderNews() {
    const tabs = $("#newsTabs");
    tabs.innerHTML = "";
    const cats = memoryCategories().filter((cat) => cat.id !== "all");
    const options = [{ id: "all", label: "전체", count: rawNews().length }].concat(cats.map((cat) => ({
      id: cat.id,
      label: cat.label,
      count: filteredNews(cat.id).length,
    })));

    if (activeCategory !== "all" && options.some((opt) => opt.id === activeCategory)) {
      newsCategory = activeCategory;
    }

    options.forEach((opt) => {
      const btn = el("button", opt.id === newsCategory ? "active" : "", `${escapeHTML(opt.label)} ${opt.count}`);
      btn.type = "button";
      btn.addEventListener("click", () => {
        newsCategory = opt.id;
        renderNewsList();
        $$("#newsTabs button").forEach((b) => b.classList.toggle("active", b === btn));
      });
      tabs.appendChild(btn);
    });

    renderNewsList();
  }

  function renderNewsList() {
    const base = newsCategory === "all" ? rawNews() : filteredNews(newsCategory);
    const items = base.filter((item) => {
      if (!newsSearch) return true;
      return `${item.title || ""} ${item.titleKo || ""} ${item.summary || ""} ${item.source || ""}`.toLowerCase().includes(newsSearch);
    });
    const chinaItems = items.filter(isChinaArticle);
    const foreignItems = items.filter((item) => !isChinaArticle(item));
    $("#newsStats").textContent = `· ${items.length}건`;
    $("#chinaNewsCount").textContent = `${chinaItems.length}건`;
    $("#foreignNewsCount").textContent = `${foreignItems.length}건`;
    renderNewsBucket($("#chinaNewsList"), chinaItems, "조건에 맞는 중국 기사 없음");
    renderNewsBucket($("#foreignNewsList"), foreignItems, "조건에 맞는 외신 기사 없음");
  }

  function renderNewsBucket(list, items, emptyMessage) {
    list.innerHTML = "";
    if (!items.length) {
      list.appendChild(el("li", null, `<span class="empty">${escapeHTML(emptyMessage)}</span>`));
      return;
    }

    items.slice(0, 42).forEach((item) => {
      const li = el("li");
      const a = el("a");
      a.href = item.link || "#";
      a.target = "_blank";
      a.rel = "noopener";
      const insights = insightLines(item);
      a.innerHTML = `
        <span>
          <span class="source-tag">${escapeHTML(item.source || "Foreign source")}</span>
          <span class="news-title">${escapeHTML(newsTitle(item))}</span>
          <span class="news-insights">
            ${insights.map((line) => `<span>${escapeHTML(line)}</span>`).join("")}
          </span>
        </span>
        <span class="news-meta">${escapeHTML(item.date || item.published || "")}</span>
      `;
      li.appendChild(a);
      list.appendChild(li);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
