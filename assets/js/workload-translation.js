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

  // The memory tier is the graphic axis: one token set colours the chips and
  // drives the demand chart, so a new rule joins both without an edit here.
  const TIERS = [
    { id: "HBM", label: "HBM", test: /HBM/i },
    { id: "AI-DRAM", label: "AI-DRAM", test: /DRAM/i },
    { id: "CXL", label: "CXL", test: /CXL/i },
    { id: "AI-NAND", label: "AI-NAND", test: /NAND|eSSD/i },
  ];
  // Maturity ladder, most proven first.
  const STAGES = ["SCALE", "QUALIFY", "POC"];
  const tiersOf = (axis) => String(axis || "")
    .split("·")
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => ({ token, tier: TIERS.find((tier) => tier.test.test(token))?.id || "" }));

  const load = (name, key) => fetch(url(name), { credentials: "omit" })
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => (key ? data?.[key] : data) || null)
    .catch(() => null);

  Promise.all([load("technology-memory-map.json", "rules"), load("memory-demand.json", "companies")])
    .then(([rules, companies]) => {
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
          return { ...row, newBiz, metric, tiers: tiersOf(row.rule.productAxis), accounts: accounts ? accounts.size : 0 };
        })
        // Observed rows first: a reader should meet the live ones before the
        // ones still waiting for evidence.
        .sort((a, b) => b.accounts - a.accounts);
      if (!rows.length) return;

      // How many workloads land on each tier. Counted, not authored — the
      // chart is the argument that a tier is demanded broadly, so it has to
      // move when a rule does.
      const demand = TIERS
        .map((tier) => ({
          ...tier,
          count: rows.filter((row) => row.tiers.some((token) => token.tier === tier.id)).length,
        }))
        .filter((tier) => tier.count)
        .sort((left, right) => right.count - left.count);
      const stacked = rows.filter((row) => new Set(row.tiers.map((token) => token.tier).filter(Boolean)).size >= 3).length;
      const observedRows = rows.filter((row) => row.accounts).length;
      const tierSet = (row) => new Set(row.tiers.map((token) => token.tier).filter(Boolean));
      const avgTiers = (rows.reduce((sum, row) => sum + tierSet(row).size, 0) / rows.length).toFixed(1);
      const stageCount = (list) => STAGES
        .map((stage) => ({ stage, count: list.filter((row) => (row.rule.stage || "") === stage).length }));

      // A tier demanded broadly but never demanded alone is where the other
      // tiers attach. That is a different claim from most-demanded, and it is
      // the one that decides whether a part or a stack gets proposed.
      const hub = demand.find((tier) => !rows.some((row) => tierSet(row).size === 1 && tierSet(row).has(tier.id)));
      const stages = stageCount(rows);

      // The business column repeated itself on every row because a workload's
      // business follows its product axis. Grouping by it says the same thing
      // once and turns the repetition into the structure.
      const lanes = [];
      for (const row of rows) {
        let lane = lanes.find((item) => item.biz === row.newBiz);
        if (!lane) lanes.push((lane = { biz: row.newBiz, metric: row.metric, rows: [] }));
        lane.rows.push(row);
      }
      lanes.sort((left, right) => right.rows.length - left.rows.length);

      ensureStyles();
      mount.dataset.mounted = "1";
      // Authored dense copy — exempt from the landing copy rewriter, which
      // splits numbers on commas and truncates data-heavy lines.
      mount.dataset.copyVerbatim = "1";
      mount.innerHTML = `
        <header class="wt-head">
          <small>AI 기술 → 메모리 수요 번역</small>
          <h3>기술 변화가 어느 제품과 어느 사업으로 떨어지는가</h3>
          <p>규칙 표에서 생성 · 최근 크롤이 실제로 관측한 기술은 계정 수를 표시하고, 관측이 없으면 프레임워크로 표기</p>
        </header>
        <ol class="wt-spine" aria-label="번역 순서">
          ${["AI 기술", "시스템 변화", "메모리 요구", "제품 계층", "신규 사업 · 지표"]
            .map((step, index) => `<li><span>${String(index + 1).padStart(2, "0")}</span><b>${esc(step)}</b></li>`).join("")}
        </ol>

        <figure class="wt-demand">
          <figcaption>
            <small>계층별 수요 집중도</small>
            <b>워크로드 ${rows.length}개 중 몇 개가 이 계층을 요구하는가</b>
          </figcaption>
          <ul>
            ${demand.map((tier) => `
              <li data-tier="${esc(tier.id)}">
                <b>${esc(tier.label)}</b>
                <span class="wt-bar"><i style="--w:${Math.round((tier.count / rows.length) * 100)}%"></i></span>
                <em>${tier.count}<small> / ${rows.length}</small></em>
              </li>`).join("")}
          </ul>
          <ul class="wt-reads">
            ${hub ? `<li><b>허브 계층</b><span>${esc(hub.label)}은 ${hub.count}/${rows.length}에 걸리면서 <em>단독으로 요구된 적이 0회</em> — 다른 계층이 붙는 자리이지, 단독 판매 축이 아님</span></li>` : ""}
            <li><b>제안 단위</b><span>워크로드당 평균 ${avgTiers}개 계층 · ${stacked}개는 3개 이상을 동시에 요구 — 단품이 아니라 계층 조합이 제안 단위</span></li>
            <li><b>성숙도 분포</b><span>${stages.map((item) => `${esc(item.stage)} ${item.count}`).join(" · ")} — 관측 ${observedRows}/${rows.length}, 나머지는 근거 확보 전 프레임워크</span></li>
          </ul>
        </figure>

        <div class="wt-lanes">
          ${lanes.map((lane, index) => `
            <section class="wt-lane">
              <header>
                <small>사업 축 ${String(index + 1).padStart(2, "0")}</small>
                <strong>${esc(lane.biz)}</strong>
                <dl>
                  <div><dt>증명 지표</dt><dd>${esc(lane.metric)}</dd></div>
                  <div><dt>수렴 워크로드</dt><dd>${lane.rows.length}개 · 관측 ${lane.rows.filter((row) => row.accounts).length}개</dd></div>
                </dl>
                <ul class="wt-lane-stages" aria-label="성숙도 분포">
                  ${stageCount(lane.rows).map((item) => `<li data-stage="${esc(item.stage)}"${item.count ? "" : " data-empty=\"1\""}><b>${esc(item.stage)}</b><span>${item.count}</span></li>`).join("")}
                </ul>
              </header>
              <ol class="wt-chain" role="list">
                ${lane.rows.map((row) => `
                  <li class="wt-row${row.accounts ? " is-observed" : ""}">
                    <b class="wt-tech">${esc(row.name)}<i data-stage="${esc(row.rule.stage || "")}">${esc(row.rule.stage || "—")}</i></b>
                    <span class="wt-step">${esc(row.rule.systemShift)}</span>
                    <span class="wt-step wt-step--need">${esc(row.rule.memoryNeed)}</span>
                    <ul class="wt-tiers">
                      ${row.tiers.map((token) => `<li${token.tier ? ` data-tier="${esc(token.tier)}"` : ""}>${esc(token.token)}</li>`).join("")}
                    </ul>
                    <span class="wt-gate">${esc(row.rule.gate || "")}</span>
                    <i class="wt-state">${row.accounts ? `관측 · 계정 ${row.accounts}` : "프레임워크"}</i>
                  </li>`).join("")}
              </ol>
            </section>`).join("")}
        </div>
        <p class="wt-foot">관측 ${observedRows}개 · 프레임워크 ${rows.length - observedRows}개 · 관측은 최근 크롤이 해당 기술을 계정에 연결한 경우</p>
`;
    })
    .catch(() => {});
})();
