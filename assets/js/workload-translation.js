/**
 * AI 기술 → 시스템 변화 → 메모리 요구 → 제품축 → 신규 사업.
 *
 * The brief draws this chain in every revision, and the landing page carried
 * the process (account fact → diagnosis → design → gate) but not the causal
 * chain itself. Writing it out would have frozen it: the workload terms that
 * matter change with the feed.
 *
 * So the rows come from the same rule table the crawl already uses to turn an
 * observed technology into a memory requirement, and each row says whether the
 * last crawl actually saw that technology or whether it is still framework
 * waiting for an observation. Nothing here is authored per row.
 */
(() => {
  const script = document.currentScript;
  const revision = new URL(script?.src || location.href).searchParams.get("v") || "";
  const base = script?.src || location.href;
  const mount = document.querySelector("[data-workload-translation]");
  if (!mount || mount.dataset.mounted) return;

  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

  const url = (name) => new URL(`../../data/${name}?v=${encodeURIComponent(revision || "current")}`, base).href;

  const ensureStyles = () => {
    if (document.querySelector("link[data-workload-translation-css]")) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = new URL(`../css/workload-translation.min.css?v=${encodeURIComponent(revision || "current")}`, base).href;
    link.dataset.workloadTranslationCss = "1";
    document.head.appendChild(link);
  };

  // The workload side of the table. Accelerator parts and packaging belong to
  // the supply chain view; what belongs here is what the model is doing.
  const WORKLOAD = [
    "Long Context", "KV Cache", "RAG", "Vector DB", "Agentic Inference",
    "MoE", "Multimodal Inference", "Context Caching", "Disaggregated Inference",
  ];

  // Which product a memory requirement lands on decides which business it
  // becomes. The mapping is by product axis, so a new workload rule inherits it.
  const NEW_BIZ = {
    HBM: ["Custom HBM · 세대 선행 물량 약정", "Bandwidth/$"],
    "AI-DRAM": ["Memory-centric AI architecture · 계층 설계", "$/query"],
    "AI-NAND": ["검색 계층 전용 스토리지 · 고용량 eSSD", "Capacity/$"],
    CXL: ["CXL 메모리 풀링 · 유휴 GPU 회수", "GPU Utilization"],
    default: ["맞춤 메모리 컨설팅", "TCO"],
  };
  const bizFor = (axis) => {
    const key = Object.keys(NEW_BIZ).find((name) => name !== "default" && String(axis || "").includes(name));
    return NEW_BIZ[key] || NEW_BIZ.default;
  };

  // 업체별 레벨. Membership is a structural public fact and lives in the
  // registry; what each company is actually doing comes from the crawl, so a
  // company the feed has said nothing about shows its name and no case rather
  // than an invented one.
  // 시장 규모와 시점. Figures a memory plan is actually sized against: how much
  // HBM the market consumes, how much packaging exists to put it in, and when
  // the committed spend lands. A total hides the timing, which is the part
  // that decides when a contract has to be signed.
  // 제품 → 채택 계정, 역방향. The account view scatters one product across
  // many cards, which makes volume impossible to sum. This groups the same
  // roadmap rows by the memory generation they name, so a new generation or a
  // new adopter appears here without anyone editing a registry.
  const PRODUCT_TOKENS = [
    ["NVHBM", /NVHBM/],
    ["HBM4E", /HBM4E/i],
    ["HBM4", /HBM4(?!E)/i],
    ["HBM3E", /HBM3E/i],
    ["SOCAMM", /SOCAMM/i],
    ["CXL", /CXL/i],
    ["LPDDR", /LPDDR/i],
  ];
  const productAdoptionHTML = (roadmap) => {
    const accounts = roadmap?.accounts;
    if (!accounts) return "";
    const byProduct = new Map();
    for (const [accountId, row] of Object.entries(accounts)) {
      for (const generation of row.generations || []) {
        const haystack = [generation.name, generation.hbm, generation.bandwidth, generation.hbmDemand].filter(Boolean).join(" ");
        for (const [token, test] of PRODUCT_TOKENS) {
          if (!test.test(haystack)) continue;
          if (!byProduct.has(token)) byProduct.set(token, []);
          byProduct.get(token).push({ accountId, name: generation.name, status: generation.status || "" });
          break; // the most specific generation token wins
        }
      }
    }
    const rows = [...byProduct].filter(([, list]) => list.length);
    if (!rows.length) return "";
    return `
      <header class="wt-head wt-head--levels">
        <small>제품 축 → 채택 계정 · 역방향</small>
        <h3>같은 제품이 어느 계정들에 걸려 있는가</h3>
        <p>세대별 로드맵에서 자동 집계 · 계정 화면에 흩어진 동일 제품을 물량 합산이 가능한 축으로 재정렬</p>
      </header>
      <div class="wt-products">
        ${rows.map(([token, list]) => `
          <article>
            <b>${esc(token)}</b>
            <ul>${list.map((item) => `<li><span>${esc(item.accountId.toUpperCase())}</span>${esc(item.name)}<i>${esc(item.status)}</i></li>`).join("")}</ul>
          </article>`).join("")}
      </div>`;
  };

  const marketHTML = (roadmap) => {
    const market = roadmap?.market;
    if (!market?.rows?.length) return "";
    const sourceLink = (url, label) => (url
      ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`
      : esc(label));
    const scale = market?.rows?.length ? `
      <div class="wt-market-rows">
        ${market.rows.map((row) => `
          <article>
            <b>${esc(row.metric)}</b>
            <span class="wt-market-now">${esc(row.now)}</span>
            <i aria-hidden="true">→</i>
            <span class="wt-market-next">${esc(row.next)}</span>
            <em>${esc(row.read)}</em>
          </article>`).join("")}
      </div>` : "";
    return `
      <header class="wt-head wt-head--levels">
        <small>시장 규모 · 시점</small>
        <h3>얼마나 쓰이고, 담을 자리는 얼마나 있고, 돈은 언제 떨어지는가</h3>
        <p>${esc(market?.note || "")} ${market?.source ? sourceLink(market.sourceUrl, market.source) : ""}</p>
      </header>
      ${scale}`;
  };

  const levelsHTML = (levels, live) => {
    if (!Array.isArray(levels) || !levels.length) return "";
    const caseFor = (id) => {
      const pain = live.pains?.[id]?.painPoints?.[0];
      if (pain) return { text: pain.pain, tag: "관측 Pain" };
      const chip = live.silicon?.[id]?.programs?.[0];
      if (chip) return { text: `${chip.program} · ${chip.relation}`, tag: "관측 실리콘" };
      const req = live.companies?.[id]?.requirements?.[0];
      if (req) return { text: req.memoryNeed, tag: "파생 요구" };
      return null;
    };
    return `
      <header class="wt-head wt-head--levels">
        <small>밸류체인 레벨 · 업체별 정리</small>
        <h3>어느 레벨의 누구에게, 무엇을 근거로 무엇을 제안하는가</h3>
        <p>레벨 소속은 공개 구조 · 업체별 사례는 최신 공개 근거에 연결 · 근거가 없으면 사례 비움</p>
      </header>
      <div class="wt-levels">
        ${levels.map((level) => `
          <section class="wt-level">
            <div class="wt-level-head">
              <small>${esc(level.label)}</small>
              <strong>${esc(level.title)}</strong>
              <p>${esc(level.constraint)}</p>
              <dl>
                <div><dt>메모리 요구</dt><dd>${esc(level.memoryAsk)}</dd></div>
                <div><dt>증명 지표</dt><dd>${esc(level.metric)}</dd></div>
              </dl>
            </div>
            <ul>
              ${(level.members || []).map((member) => {
                const found = caseFor(member.id);
                return `<li${found ? " class=\"is-observed\"" : ""}><b>${esc(member.name)}</b>${found ? `<span>${esc(found.text)}</span><i>${esc(found.tag)}</i>` : ""}</li>`;
              }).join("")}
            </ul>
          </section>`).join("")}
      </div>`;
  };

  const load = (name, key) => fetch(url(name), { credentials: "omit" })
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => (key ? data?.[key] : data) || null)
    .catch(() => null);

  Promise.all([load("technology-memory-map.json", "rules"), load("memory-demand.json", "companies"), load("value-chain-levels.json", "levels"), load("silicon-map.json", "accounts"), load("pain-points.json", "accounts"), load("chip-roadmap.json")])
    .then(([rules, companies, levels, silicon, pains, roadmap]) => {
      if (!rules) return;

      // An observation is a company the last crawl actually tied to this
      // technology. Counting them is what separates a live row from framework.
      const observed = new Map();
      for (const [id, row] of Object.entries(companies || {})) {
        for (const requirement of row?.requirements || []) {
          const key = requirement.technology;
          if (!key) continue;
          if (!observed.has(key)) observed.set(key, new Set());
          observed.get(key).add(id);
        }
      }

      const rows = WORKLOAD
        .map((name) => ({ name, rule: rules[name] }))
        .filter((row) => row.rule)
        .map((row) => {
          const [newBiz, metric] = bizFor(row.rule.productAxis);
          const accounts = observed.get(row.name);
          return { ...row, newBiz, metric, accounts: accounts ? accounts.size : 0 };
        })
        // Observed rows first: a reader should meet the live ones before the
        // ones still waiting for evidence.
        .sort((a, b) => b.accounts - a.accounts);
      if (!rows.length) return;

      ensureStyles();
      mount.dataset.mounted = "1";
      mount.innerHTML = `
        <header class="wt-head">
          <small>AI 기술 → 메모리 수요 번역</small>
          <h3>기술 변화가 어느 제품과 어느 사업으로 떨어지는가</h3>
          <p>규칙 표에서 생성 · 최근 크롤이 실제로 관측한 기술은 계정 수를 표시하고, 관측이 없으면 프레임워크로 표기</p>
        </header>
        <div class="wt-rows" role="list">
          ${rows.map((row) => `
            <article role="listitem" class="wt-row${row.accounts ? " is-observed" : ""}">
              <b class="wt-tech">${esc(row.name)}</b>
              <span class="wt-step">${esc(row.rule.systemShift)}</span>
              <span class="wt-step">${esc(row.rule.memoryNeed)}</span>
              <span class="wt-axis">${esc(row.rule.productAxis)}</span>
              <span class="wt-biz">${esc(row.newBiz)}</span>
              <span class="wt-metric">${esc(row.metric)}</span>
              <i class="wt-state">${row.accounts ? `관측 · 계정 ${row.accounts}` : "프레임워크"}</i>
            </article>`).join("")}
        </div>
        ${levelsHTML(levels, { companies, silicon, pains })}
        ${marketHTML(roadmap)}
        ${productAdoptionHTML(roadmap)}`;
    })
    .catch(() => {});
})();
