const escapeHTML = (value) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

const labels = (items = []) => items.map((item) => item?.label).filter(Boolean).join(" · ");
const join = (items = []) => items.filter(Boolean).join(" · ");
const highlight = (value) => escapeHTML(value).replace(/\b(HBM|KV Cache|TPOT|TCO|Base Die|AI-D|AI-N|CoWoS|Qualification|LTA)\b/gi, "<mark>$1</mark>");

export function renderExecutiveOnePagers(pages = []) {
  if (!pages.length) return "";
  return `<details class="sc-report"><summary class="sc-report-head"><strong>EXECUTIVE ACCOUNT ONE-PAGERS</strong><span>Pain · 경쟁 리스크 · Deal · 90D Gate</span></summary><div class="sc-partner-grid">${pages.map((page) => `<article class="sc-partner"><span class="sc-tech-en">${escapeHTML(page.layer || "END CUSTOMER")}</span><strong data-company-id="${escapeHTML(page.accountId)}">${escapeHTML(page.headline || page.accountId)}</strong><div class="sc-partner-row"><b>PAIN</b><span>${escapeHTML(labels(page.topPainAxes) || "신호 확인 필요")}</span></div><div class="sc-partner-row"><b>RISK</b><span>${escapeHTML(labels(page.whyLost) || "공개 근거 확인 필요")}</span></div><div class="sc-partner-row"><b>OPTION</b><span>${escapeHTML((page.recommendedProductIds || []).join(" · ") || "Requirement Lock 우선")}</span></div><div class="sc-decision-gate"><b>GATE</b><span>${escapeHTML(page.decisionQuestion)}</span></div></article>`).join("")}</div></details>`;
}

export function renderAccountEcosystem({ ecosystem = {}, layerModel = {} } = {}) {
  const partners = Array.isArray(ecosystem.partners) ? ecosystem.partners : [];
  if (!partners.length) return "";
  const layer = (id) => layerModel.layers?.find((item) => item.id === id) || {};
  const partnerCriteria = layer("asic-partner").buyingCriteria || [];
  const customerCriteria = layer("end-customer").buyingCriteria || [];
  return `<section class="sc-broadcom-board sc-partner-ecosystem" aria-labelledby="partnerEcosystemTitle"><header class="sc-broadcom-head"><div><span>${escapeHTML(ecosystem.eyebrow || "CUSTOM SILICON PARTNER ECOSYSTEM")}</span><h4 id="partnerEcosystemTitle">${escapeHTML(ecosystem.title || "Broadcom · Marvell → Big Tech / Hyperscaler")}</h4></div><p>${escapeHTML(ecosystem.description)}</p></header><div class="sc-partner-hierarchy" aria-label="ASIC Partner와 Big Tech 고객 계층">${partners.map((partner) => { const served = Array.isArray(partner.accounts) ? partner.accounts : []; const rollup = partner.rollup || {}; const pains = (rollup.topPainAxes || []).filter((item) => Number(item.mentions || 0) > 0).slice(0, 3); return `<section class="sc-partner-lane" style="--lane-accent:${escapeHTML(partner.accent || "#D05A2B")}"><article class="sc-partner sc-partner-node" style="--sc-accent:${escapeHTML(partner.accent || "#D05A2B")}"><span class="sc-tech-en">01 · ASIC PARTNER</span><strong data-company-id="${escapeHTML(partner.id)}">${escapeHTML(partner.company)}</strong><p>${escapeHTML(partner.chip)}</p><div class="sc-partner-row"><b>BUYING</b><span>${escapeHTML(join(partner.buyingCriteria || partnerCriteria))}</span></div><div class="sc-partner-row"><b>ROLL-UP</b><span>${escapeHTML(join(served.map((account) => account.company)))}</span></div>${pains.length ? `<div class="sc-partner-row"><b>PAIN SIGNAL</b><span>${escapeHTML(join(pains.map((item) => `${item.label} ${item.mentions}`)))}</span></div>` : ""}</article><div class="sc-hierarchy-arrow" aria-hidden="true">↓</div><div class="sc-partner-children" aria-label="${escapeHTML(partner.company)} 연결 고객">${served.map((account) => `<article class="sc-hyperscaler-node" style="--account-accent:${escapeHTML(account.accent || partner.accent || "#2D6BFF")}"><span>02 · BIG TECH / HYPERSCALER</span><strong data-company-id="${escapeHTML(account.id)}">${escapeHTML(account.company)}</strong><small>${escapeHTML(account.chip)}</small><dl><div><dt>MEMORY PAIN</dt><dd>${highlight(account.pain)}</dd></div><div><dt>SKH OPTION</dt><dd>${highlight(account.memory)}</dd></div><div><dt>GATE</dt><dd>${escapeHTML(account.gate)}</dd></div></dl></article>`).join("")}</div></section>`; }).join("")}</div><div class="sc-hierarchy-criteria"><b>HYPERSCALER BUYING CRITERIA</b><span>${escapeHTML(join(customerCriteria))}</span></div></section>`;
}

const dynamicsTypeMeta = {
  competition: { label: "경쟁", accent: "#ff5a67" },
  partnership: { label: "파트너십", accent: "#4d7fff" },
  investment: { label: "투자", accent: "#20bfa6" },
  supply: { label: "공급", accent: "#e7a11a" },
  adjacency: { label: "전략 유사", accent: "#a78bfa" },
  hypothesis: { label: "협력 후보", accent: "#ffd166" },
};

const dynamicsLayerLabel = (layers = [], id = "") => layers.find((layer) => layer.id === id)?.label || "VALUE CHAIN";
const dynamicsInitials = (value = "") => String(value).split(/\s+/).map((part) => part[0]).join("").slice(0, 3).toUpperCase();

function renderDynamicsDetail(company = {}, relations = [], companies = [], layers = []) {
  const companyById = new Map(companies.map((item) => [item.id, item]));
  const connected = relations.filter((relation) => relation.from === company.id || relation.to === company.id);
  const grouped = Object.keys(dynamicsTypeMeta).map((type) => ({
    type,
    ...dynamicsTypeMeta[type],
    items: connected.filter((relation) => relation.type === type),
  })).filter((group) => group.items.length);
  const baseline = Array.isArray(company.baseline) ? company.baseline.slice(0, 3) : [];
  const criteria = Array.isArray(company.buyingCriteria) ? company.buyingCriteria.slice(0, 4) : [];
  const serves = Array.isArray(company.servesAccounts) ? company.servesAccounts : [];
  const signal = company.latestSignal || null;
  const relationGroups = grouped.map((group) => `<section style="--relation-accent:${group.accent}"><header><b>${group.label}</b></header>${group.items.map((relation) => {
    const otherId = relation.from === company.id ? relation.to : relation.from;
    const other = companyById.get(otherId) || {};
    const meta = join([relation.evidenceGrade, relation.effectiveAt, relation.status || "관찰"]);
    return `<div class="sc-dynamics-relation"><button type="button" data-dynamics-jump="${escapeHTML(otherId)}">${escapeHTML(other.company || otherId)}</button>${relation.domain ? `<b class="sc-dynamics-relation-domain">${escapeHTML(relation.domain)}</b>` : ""}<p>${escapeHTML(relation.detail)}</p>${relation.memoryImplication ? `<p class="sc-dynamics-memory"><b>MEMORY</b>${highlight(relation.memoryImplication)}</p>` : ""}${relation.decisionImpact ? `<p class="sc-dynamics-action"><b>ACTION</b>${escapeHTML(relation.decisionImpact)}</p>` : ""}<small>${escapeHTML(meta)}</small>${relation.source?.url ? `<a href="${escapeHTML(relation.source.url)}" target="_blank" rel="noopener">원문 ↗</a>` : ""}</div>`;
  }).join("")}</section>`).join("");
  const priority = Boolean(company.priorityTier);
  return `<div class="sc-dynamics-detail-head" style="--company-accent:${escapeHTML(company.accent || "#21b5a7")}"><span>${escapeHTML(dynamicsLayerLabel(layers, company.layer))}</span><div><strong>${escapeHTML(company.company || "업체 선택")}</strong><em>${escapeHTML(company.stage?.label || `${connected.length}개 관계`)}</em></div><p>${escapeHTML(company.portfolio || company.role || "메모리 의사결정 맥락")}</p></div><div class="sc-dynamics-facts"><div><b>${priority ? "SYSTEM ROLE" : "MEMORY PAIN"}</b><p>${highlight(priority ? company.systemRole || company.role : company.pain || company.position || "공개 Workload 병목 확인 필요")}</p></div><div><b>${priority ? "협력 가치" : "SKH OPTION"}</b><p>${highlight(priority ? company.collaborationValue || company.position : company.memoryOption || company.portfolio || "Requirement Lock 우선")}</p></div><div><b>${priority ? "MEMORY 제안" : "BUYING CRITERIA"}</b><p>${highlight(priority ? company.memoryOption || company.portfolio : join(criteria) || join(serves) || "성능 · 일정 · 공급 · 경제성")}</p></div><div><b>${priority ? "실행 GATE" : "DECISION GATE"}</b><p>${highlight(company.decision || (priority ? "Qualification · Volume" : "Qualification · Capacity · TCO"))}</p></div></div>${baseline.length ? `<div class="sc-dynamics-baseline">${baseline.map((item) => `<span><b>${escapeHTML(item.label)}</b>${escapeHTML(item.value)}</span>`).join("")}</div>` : ""}${signal ? `<div class="sc-dynamics-signal"><b>최근 계정 신호</b><p>${escapeHTML(signal.title)}</p><span>${escapeHTML(join([signal.source, signal.date]))}</span>${signal.url ? `<a href="${escapeHTML(signal.url)}" target="_blank" rel="noopener">원문 ↗</a>` : ""}</div>` : ""}<div class="sc-dynamics-relations">${relationGroups || `<p class="sc-dynamics-empty">직접 연결 관계 확인 전</p>`}</div><button type="button" class="sc-dynamics-profile" data-company-id="${escapeHTML(company.id || "")}">기업 상세 프로필 열기 <span aria-hidden="true">↗</span></button>`;
}

export function renderCompetitiveDynamics(model = {}) {
  const layers = Array.isArray(model.layers) ? model.layers : [];
  const relations = Array.isArray(model.relations) ? model.relations : [];
  const companies = Array.isArray(model.companies) ? model.companies : [];
  if (!layers.length || !relations.length) return "";
  const first = companies[0] || {};
  return `<section class="sc-broadcom-board sc-dynamics-board" aria-labelledby="competitiveDynamicsTitle"><header class="sc-broadcom-head"><div><span>${escapeHTML(model.eyebrow || "COMPETITIVE DYNAMICS · VALUE CHAIN")}</span><h4 id="competitiveDynamicsTitle">${escapeHTML(model.title || "경쟁 · 파트너십 · 투자 · 공급 관계 지도")}</h4></div><p>${escapeHTML(model.description)}</p></header><div class="sc-dynamics-layout"><nav class="sc-dynamics-layers" aria-label="밸류체인 계층 필터"><b>AI VALUE CHAIN</b><button type="button" data-dynamics-layer="all" aria-pressed="true"><span>ALL</span><strong>전체 밸류체인</strong><em>${companies.length}</em></button>${layers.map((layer) => `<button type="button" data-dynamics-layer="${escapeHTML(layer.id)}" aria-pressed="false"><span>${escapeHTML(layer.index)}</span><strong>${escapeHTML(layer.label)}</strong><em>${Number(layer.companies?.length || 0)}</em></button>`).join("")}</nav><div class="sc-dynamics-stage"><div class="sc-dynamics-toolbar" role="toolbar" aria-label="관계 유형 필터"><button type="button" data-dynamics-type="all" aria-pressed="true"><i style="--relation-accent:#9cb0c3"></i>전체 <em>${relations.length}</em></button>${(model.types || []).map((type) => `<button type="button" data-dynamics-type="${escapeHTML(type.id)}" aria-pressed="false"><i style="--relation-accent:${escapeHTML(dynamicsTypeMeta[type.id]?.accent || "#9cb0c3")}"></i>${escapeHTML(type.label)} <em>${Number(type.count || 0)}</em></button>`).join("")}</div><div class="sc-dynamics-map" aria-label="업체 원형 관계 지도" style="--dynamics-layer-count:${Math.max(layers.length, 1)}"><svg class="sc-dynamics-links" data-dynamics-links aria-hidden="true"></svg>${layers.map((layer) => `<section data-dynamics-lane="${escapeHTML(layer.id)}"><header><b>${escapeHTML(layer.index)}</b><span>${escapeHTML(layer.label)}</span></header><div>${(layer.companies || []).map((company) => `<button type="button" class="sc-dynamics-node${company.id === first.id ? " is-selected" : ""}" data-dynamics-company="${escapeHTML(company.id)}" aria-pressed="${company.id === first.id ? "true" : "false"}" aria-label="${escapeHTML(company.company)} 관계 보기" style="--company-accent:${escapeHTML(company.accent || "#21b5a7")}"><span>${escapeHTML(dynamicsInitials(company.company))}</span><strong>${escapeHTML(company.company)}</strong><em>${Number(company.relationCount || 0)}</em></button>`).join("")}</div></section>`).join("")}</div></div><aside class="sc-dynamics-detail" data-dynamics-detail aria-live="polite">${renderDynamicsDetail(first, relations, companies, layers)}</aside></div></section>`;
}

export function bindCompetitiveDynamics(root, model = {}) {
  if (!root) return;
  root.dataset.dynamicsBound = "true";
  const relations = Array.isArray(model.relations) ? model.relations : [];
  const companyList = Array.isArray(model.companies) ? model.companies : [];
  const companies = new Map(companyList.map((company) => [company.id, company]));
  const filters = [...root.querySelectorAll("[data-dynamics-type]")];
  const layerFilters = [...root.querySelectorAll("[data-dynamics-layer]")];
  const nodes = [...root.querySelectorAll("[data-dynamics-company]")];
  const detail = root.querySelector("[data-dynamics-detail]");
  const map = root.querySelector(".sc-dynamics-map");
  const links = root.querySelector("[data-dynamics-links]");
  const nodeById = new Map(nodes.map((node) => [node.dataset.dynamicsCompany || "", node]));
  const edgeById = new Map();
  let selectedId = companyList[0]?.id || "";
  let activeType = "all";
  let activeLayer = "all";
  let linkFrame = 0;
  const svgNamespace = "http://www.w3.org/2000/svg";
  const relationColor = (type) => dynamicsTypeMeta[type]?.accent || "#9cb0c3";
  if (links) {
    const pairTotals = relations.reduce((totals, relation) => {
      const pair = [relation.from, relation.to].sort().join(":");
      totals.set(pair, Number(totals.get(pair) || 0) + 1);
      return totals;
    }, new Map());
    const pairIndexes = new Map();
    relations.forEach((relation, index) => {
      const path = document.createElementNS(svgNamespace, "path");
      const id = relation.id || `${relation.type}:${relation.from}:${relation.to}:${index}`;
      const pair = [relation.from, relation.to].sort().join(":");
      const pairIndex = Number(pairIndexes.get(pair) || 0);
      pairIndexes.set(pair, pairIndex + 1);
      path.dataset.dynamicsEdge = id;
      path.dataset.dynamicsFrom = relation.from;
      path.dataset.dynamicsTo = relation.to;
      path.dataset.dynamicsRelationType = relation.type;
      path.dataset.pi = String(pairIndex);
      path.dataset.pt = String(pairTotals.get(pair) || 1);
      path.style.setProperty("--relation-accent", relationColor(relation.type));
      links.appendChild(path);
      edgeById.set(id, path);
    });
  }
  const layoutLinks = () => {
    if (!map || !links) return;
    const mapRect = map.getBoundingClientRect();
    const width = Math.max(map.clientWidth, map.scrollWidth);
    const height = Math.max(map.clientHeight, map.scrollHeight);
    links.setAttribute("viewBox", `0 0 ${width} ${height}`);
    links.setAttribute("width", String(width));
    links.setAttribute("height", String(height));
    relations.forEach((relation, index) => {
      const id = relation.id || `${relation.type}:${relation.from}:${relation.to}:${index}`;
      const path = edgeById.get(id);
      const from = nodeById.get(relation.from);
      const to = nodeById.get(relation.to);
      if (!path || !from || !to) return;
      const fromRect = from.getBoundingClientRect();
      const toRect = to.getBoundingClientRect();
      const x1 = fromRect.left - mapRect.left + map.scrollLeft + fromRect.width / 2;
      const y1 = fromRect.top - mapRect.top + map.scrollTop + fromRect.height / 2;
      const x2 = toRect.left - mapRect.left + map.scrollLeft + toRect.width / 2;
      const y2 = toRect.top - mapRect.top + map.scrollTop + toRect.height / 2;
      const bend = Math.max(34, Math.abs(x2 - x1) * .42);
      const direction = x2 >= x1 ? 1 : -1;
      const pairIndex = Number(path.dataset.pi || 0);
      const pairTotal = Number(path.dataset.pt || 1);
      const lane = (pairIndex - (pairTotal - 1) / 2) * 18;
      path.setAttribute("d", `M ${x1} ${y1} C ${x1 + bend * direction} ${y1 + lane}, ${x2 - bend * direction} ${y2 + lane}, ${x2} ${y2}`);
    });
  };
  const scheduleLinkLayout = () => {
    cancelAnimationFrame(linkFrame);
    linkFrame = requestAnimationFrame(layoutLinks);
  };
  const renderSelection = (companyId = selectedId) => {
    const company = companies.get(companyId);
    if (!company) return;
    selectedId = companyId;
    const activeRelations = relations.filter((relation) => (activeType === "all" || relation.type === activeType) && (relation.from === companyId || relation.to === companyId));
    const relatedIds = new Set(activeRelations.flatMap((relation) => [relation.from, relation.to]));
    nodes.forEach((node) => {
      const id = node.dataset.dynamicsCompany || "";
      const selected = id === companyId;
      const related = relatedIds.has(id) && !selected;
      const companyNode = companies.get(id);
      const layerMatch = activeLayer === "all" || companyNode?.layer === activeLayer;
      node.classList.toggle("is-selected", selected);
      node.classList.toggle("is-related", related);
      node.classList.toggle("is-muted", !selected && (!related || !layerMatch));
      node.ariaPressed = String(selected);
    });
    filters.forEach((button) => { button.ariaPressed = String(button.dataset.dynamicsType === activeType); });
    layerFilters.forEach((button) => { button.ariaPressed = String(button.dataset.dynamicsLayer === activeLayer); });
    edgeById.forEach((edge) => {
      const typeMatch = activeType === "all" || edge.dataset.dynamicsRelationType === activeType;
      const selectedMatch = edge.dataset.dynamicsFrom === companyId || edge.dataset.dynamicsTo === companyId;
      const fromLayer = companies.get(edge.dataset.dynamicsFrom)?.layer;
      const toLayer = companies.get(edge.dataset.dynamicsTo)?.layer;
      const layerMatch = activeLayer === "all" || fromLayer === activeLayer || toLayer === activeLayer;
      edge.classList.toggle("is-active", typeMatch && selectedMatch && layerMatch);
      edge.classList.toggle("is-muted", !typeMatch || !selectedMatch || !layerMatch);
    });
    if (detail) detail.innerHTML = renderDynamicsDetail(company, activeType === "all" ? relations : relations.filter((relation) => relation.type === activeType), companyList, model.layers || []);
    scheduleLinkLayout();
  };
  nodes.forEach((button) => button.addEventListener("click", () => renderSelection(button.dataset.dynamicsCompany || selectedId)));
  filters.forEach((button) => button.addEventListener("click", () => {
    activeType = button.dataset.dynamicsType || "all";
    renderSelection();
  }));
  layerFilters.forEach((button) => button.addEventListener("click", () => {
    activeLayer = button.dataset.dynamicsLayer || "all";
    const firstInLayer = activeLayer === "all" ? selectedId : companyList.find((company) => company.layer === activeLayer)?.id;
    renderSelection(firstInLayer || selectedId);
  }));
  root.addEventListener("click", (event) => {
    const jump = event.target.closest("[data-dynamics-jump]");
    const companyId = jump?.dataset.dynamicsJump || "";
    if (companies.has(companyId)) renderSelection(companyId);
  });
  const resizeObserver = "ResizeObserver" in window ? new ResizeObserver(scheduleLinkLayout) : null;
  if (resizeObserver && map) resizeObserver.observe(map);
  window.addEventListener("resize", scheduleLinkLayout, { passive: true });
  document.fonts?.ready?.then(scheduleLinkLayout).catch(() => {});
  renderSelection();
  scheduleLinkLayout();
}
