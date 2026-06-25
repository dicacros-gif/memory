/* SK hynix Memory Intelligence dashboard renderer. */
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
    renderBrief();
    renderKPIs();
    renderCorpDev();
    renderPrices();
    renderCompetitors();
    renderStartups();
    renderStocks();
    renderNews();
    renderTrending();
    renderHealth();
    renderScenario();
    renderSources();
    setupScroll();
  }

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

  function renderHeader() {
    $("#headerUpdatedAt").textContent = formatUpdated(LIVE.updatedAt);
  }

  function renderBrief() {
    const wrap = $("#briefList");
    wrap.innerHTML = "";
    const labels = ["뉴스", "가격", "경쟁", "투자"];
    const observations = (LIVE.signals && LIVE.signals.observations) || [
      "첫 크롤링 실행 후 요약 신호가 표시됩니다.",
    ];

    observations.slice(0, 4).forEach((text, index) => {
      const item = el("div", "brief-item");
      item.appendChild(el("span", "brief-label", labels[index] || "신호"));
      item.appendChild(el("span", "brief-text", escapeHTML(text)));
      wrap.appendChild(item);
    });
  }

  function renderKPIs() {
    const grid = $("#kpiGrid");
    grid.innerHTML = "";

    const hbmCategory = (LIVE.categories || []).find((item) => item.id === "hbm");
    const topPrice = (LIVE.signals?.topPriceMoves || [])[0];
    const topCompetitor = LIVE.signals?.topCompetitor;
    const topStartup = LIVE.signals?.topStartup;
    const healthOk = (LIVE.health || []).filter((item) => item.ok).length;
    const healthTotal = (LIVE.health || []).length;

    const cards = [
      {
        label: "마지막 업데이트",
        value: LIVE.updatedAt ? formatUpdated(LIVE.updatedAt).replace(" KST", "") : "대기 중",
        detail: "Asia/Seoul 기준",
        accent: true,
      },
      {
        label: "주요 가격 변동",
        value: topPrice ? topPrice.changeRaw : "—",
        detail: topPrice ? topPrice.item : "TrendForce 수집 대기",
      },
      {
        label: "HBM 뉴스",
        value: `${hbmCategory?.count || 0}건`,
        detail: "최근 30일 Google News",
      },
      {
        label: "경쟁 압력",
        value: topCompetitor ? `${topCompetitor.score}/100` : "—",
        detail: topCompetitor ? topCompetitor.label : "수집 대기",
      },
      {
        label: "투자 후보",
        value: topStartup ? topStartup.name : "—",
        detail: topStartup ? `${topStartup.status} · ${topStartup.score}/100` : "수집 대기",
      },
    ];

    cards.forEach((card) => {
      const node = el("div", `metric-card${card.accent ? " accent" : ""}`);
      node.appendChild(el("span", null, card.label));
      node.appendChild(el("strong", null, escapeHTML(card.value)));
      node.appendChild(el("small", null, escapeHTML(card.detail)));
      grid.appendChild(node);
    });

    if (healthTotal) {
      grid.lastElementChild.title = `크롤링 성공 ${healthOk}/${healthTotal}`;
    }
  }

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
      const card = el("article", "corpdev-card");
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
    const supplyCategory = (LIVE.categories || []).find((item) => item.id === "supply");
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
      supplyNews: supplyCategory?.count || 0,
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
    };

    const map = {
      "deal-sourcing": [
        { label: "관찰 타깃", value: `${ctx.startups.length + ctx.competitors.length}개`, detail: "스타트업+경쟁사 레이더" },
        common.price,
        common.competitor,
      ],
      "cvc-startups": [
        common.startup,
        { label: "CXL 후보", value: `${ctx.cxlStartups}개`, detail: "CXL·메모리 풀링 투자 테마" },
        { label: "우선 검토군", value: `${ctx.highPriorityStartups}개`, detail: "score 80 이상" },
      ],
      "investment-strategy": [
        { label: "HBM 모멘텀", value: `${ctx.hbmNews}건`, detail: "최근 30일 뉴스" },
        common.contract,
        { label: "상위 키워드", value: ctx.topTrend, detail: "뉴스 제목 빈도 기반" },
      ],
      "portfolio-valueup": [
        { label: "협업 후보", value: startupName, detail: topStartup ? topStartup.area : "후보 대기" },
        { label: "AI 수요 뉴스", value: `${ctx.aiNews}건`, detail: "고객 레퍼런스/PoC 신호" },
        { label: "공급 신호", value: `${ctx.supplyNews}건`, detail: "제품화·양산 타이밍 점검" },
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
    if (id === "investment-strategy" && ctx.hbmNews >= 100) return "전략 우선";
    if (id === "deal-sourcing" && ctx.spotMove) return "타깃 갱신";
    if (id === "portfolio-valueup" && ctx.topStartup) return "Value-up 후보";
    return "관찰";
  }

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
      const card = el("div", "signal-card");
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

    competitors.forEach((item) => {
      const card = el("article", "competitor-card");
      card.innerHTML = `
        <div class="competitor-top">
          <div>
            <div class="entity-name">${escapeHTML(item.shortLabel || item.label)}</div>
            <div class="entity-segment">${escapeHTML(item.segment || "")}</div>
          </div>
          <div class="score-ring" style="--score:${item.pressureScore || 0}"><span>${item.pressureScore || 0}</span></div>
        </div>
        <p class="entity-body">${escapeHTML(item.baseline || "")}</p>
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
      grid.appendChild(el("div", "empty-state", "스타트업 데이터 대기 중"));
      return;
    }

    candidates.forEach((item, index) => {
      const card = el("article", `startup-card${index === 0 ? " featured" : ""}`);
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
      tagRow.appendChild(el("span", "tag", `score ${item.score || 0}`));
      card.appendChild(tagRow);
      card.appendChild(renderMiniNews(item.recentNews || []));
      grid.appendChild(card);
    });
  }

  function renderMiniNews(items) {
    const list = el("ul", "mini-news");
    if (!items.length) {
      list.appendChild(el("li", null, '<span class="empty-state">최근 공개 뉴스 없음</span>'));
      return list;
    }
    items.slice(0, 2).forEach((news) => {
      const li = el("li");
      const a = el("a");
      a.href = news.link || "#";
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = news.title;
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
      const card = el("article", "stock-card");
      card.innerHTML = `
        <div class="stock-top">
          <div>
            <div class="entity-name">${escapeHTML(stock?.label || label)}</div>
            <div class="stock-symbol">${escapeHTML(stock?.symbol || symbol)}</div>
          </div>
        </div>
      `;

      if (stock?.latestClose != null) {
        const usd = stock.currency === "USD" || id === "micron";
        const up = (stock.changePct || 0) >= 0;
        card.appendChild(el("div", "stock-price", usd ? "$" + fmtNum(stock.latestClose, 2) : "₩" + fmtNum(stock.latestClose, 0)));
        card.appendChild(el("div", `stock-change ${up ? "up" : "down"}`, `${up ? "▲ +" : "▼ "}${fmtNum(stock.changePct, 2)}%`));
        if (Array.isArray(stock.points) && stock.points.length > 1) card.appendChild(sparkline(stock.points, up));
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

    $("#newsSearch").addEventListener("input", (event) => {
      searchTerm = event.target.value.trim().toLowerCase();
      renderNewsList();
    });

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
    let items = allNews();
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
          <span class="news-title">${escapeHTML(item.title)}</span>
        </span>
        <span class="news-meta">${escapeHTML(item.source || "")} ${escapeHTML(item.date || "")}</span>
      `;
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
    return svg;
  }

  function setupScroll() {
    const header = $("#siteHeader");
    window.addEventListener("scroll", () => header.classList.toggle("scrolled", window.scrollY > 8), { passive: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
