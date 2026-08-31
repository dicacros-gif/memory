const escapeHTML = (value) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

const labels = (items = []) => items.map((item) => item?.label).filter(Boolean).join(" · ");
const join = (items = []) => items.filter(Boolean).join(" · ");
const highlight = (value) => escapeHTML(value).replace(/\b(HBM|KV Cache|TPOT|TCO|Base Die|AI-D|AI-N|CoWoS|Qualification|LTA)\b/gi, "<mark>$1</mark>");
const shortDate = (value) => String(value || "").match(/^\d{4}-\d{2}-\d{2}/)?.[0]?.replaceAll("-", ".") || "";
let dynamicsInstance = 0;

export function renderExecutiveOnePagers(pages = []) {
  if (!pages.length) return "";
  return `<details class="sc-report"><summary class="sc-report-head"><strong>EXECUTIVE ACCOUNT ONE-PAGERS</strong><span>Pain · 경쟁 리스크 · Deal · Execution Gate</span></summary><div class="sc-partner-grid">${pages.map((page) => `<article class="sc-partner"><span class="sc-tech-en">${escapeHTML(page.layer || "END CUSTOMER")}</span><strong data-company-id="${escapeHTML(page.accountId)}">${escapeHTML(page.headline || page.accountId)}</strong><div class="sc-partner-row"><b>PAIN</b><span>${escapeHTML(labels(page.topPainAxes) || "신호 확인 필요")}</span></div><div class="sc-partner-row"><b>RISK</b><span>${escapeHTML(labels(page.whyLost) || "원문 확인 필요")}</span></div><div class="sc-partner-row"><b>OPTION</b><span>${escapeHTML((page.recommendedProductIds || []).join(" · ") || "Requirement Lock 우선")}</span></div><div class="sc-decision-gate"><b>GATE</b><span>${escapeHTML(page.decisionQuestion)}</span></div></article>`).join("")}</div></details>`;
}

export function renderAccountEcosystem({ ecosystem = {}, layerModel = {} } = {}) {
  const partners = Array.isArray(ecosystem.partners) ? ecosystem.partners : [];
  if (!partners.length) return "";
  const layer = (id) => layerModel.layers?.find((item) => item.id === id) || {};
  const partnerCriteria = layer("asic-partner").buyingCriteria || [];
  const customerCriteria = layer("end-customer").buyingCriteria || [];
  return `<section class="sc-broadcom-board sc-partner-ecosystem" aria-labelledby="partnerEcosystemTitle"><header class="sc-broadcom-head"><div><span>${escapeHTML(ecosystem.eyebrow || "CUSTOM SILICON PARTNER ECOSYSTEM")}</span><h4 id="partnerEcosystemTitle">${escapeHTML(ecosystem.title || "Broadcom · Marvell → Big Tech / Hyperscaler")}</h4></div><p>${escapeHTML(ecosystem.description)}</p></header><div class="sc-partner-hierarchy" aria-label="ASIC Partner와 Big Tech 고객 계층">${partners.map((partner) => { const served = Array.isArray(partner.accounts) ? partner.accounts : []; const rollup = partner.rollup || {}; const pains = (rollup.topPainAxes || []).filter((item) => Number(item.mentions || 0) > 0).slice(0, 3); return `<section class="sc-partner-lane" style="--lane-accent:${escapeHTML(partner.accent || "#C26262")}"><article class="sc-partner sc-partner-node" style="--sc-accent:${escapeHTML(partner.accent || "#C26262")}"><span class="sc-tech-en">01 · ASIC PARTNER</span><strong data-company-id="${escapeHTML(partner.id)}">${escapeHTML(partner.company)}</strong><p>${escapeHTML(partner.chip)}</p><div class="sc-partner-row"><b>BUYING</b><span>${escapeHTML(join(partner.buyingCriteria || partnerCriteria))}</span></div><div class="sc-partner-row"><b>ROLL-UP</b><span>${escapeHTML(join(served.map((account) => account.company)))}</span></div>${pains.length ? `<div class="sc-partner-row"><b>PAIN SIGNAL</b><span>${escapeHTML(join(pains.map((item) => `${item.label} ${item.mentions}`)))}</span></div>` : ""}</article><div class="sc-hierarchy-arrow" aria-hidden="true">↓</div><div class="sc-partner-children" aria-label="${escapeHTML(partner.company)} 연결 고객">${served.map((account) => `<article class="sc-hyperscaler-node" style="--account-accent:${escapeHTML(account.accent || partner.accent || "#447BA6")}"><span>02 · BIG TECH / HYPERSCALER</span><strong data-company-id="${escapeHTML(account.id)}">${escapeHTML(account.company)}</strong><small>${escapeHTML(account.chip)}</small><dl><div><dt>MEMORY PAIN</dt><dd>${highlight(account.pain)}</dd></div><div><dt>SKH OPTION</dt><dd>${highlight(account.memory)}</dd></div><div><dt>GATE</dt><dd>${escapeHTML(account.gate)}</dd></div></dl></article>`).join("")}</div></section>`; }).join("")}</div><div class="sc-hierarchy-criteria"><b>HYPERSCALER BUYING CRITERIA</b><span>${escapeHTML(join(customerCriteria))}</span></div></section>`;
}

const dynamicsTypeMeta = {
  competition: { label: "경쟁", accent: "#c28484" },
  partnership: { label: "파트너십", accent: "#538cb8" },
  investment: { label: "투자", accent: "#4fbab3" },
  supply: { label: "공급", accent: "#c1ab81" },
  integration: { label: "플랫폼 통합", accent: "#31a9a1" },
  exploration: { label: "협력 논의", accent: "#c8b38e" },
  qualification: { label: "시스템 검증", accent: "#61c2bb" },
  adjacency: { label: "전략 유사", accent: "#7ea1bc" },
  hypothesis: { label: "협력 후보", accent: "#dcd4c4" },
};

const dynamicsLayerLabel = (layers = [], id = "") => layers.find((layer) => layer.id === id)?.label || "VALUE CHAIN";
// Without a logo the node falls back to a monogram, not the company name --
// the full name in a 27px mark overflows and collides with the label printed
// directly beneath it.
const dynamicsMonogram = (name = "") => {
  const words = String(name).trim().split(/[\s.\-_/]+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) {
    const word = words[0];
    // An acronym is already a mark, so it is kept whole up to four
    // characters; an ordinary name is cut to two.
    const acronym = word === word.toUpperCase() && word.length <= 4;
    return (acronym || word.length <= 3 ? word : word.slice(0, 2)).toUpperCase();
  }
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
};

const dynamicsLogoHTML = (company = {}) => {
  const source = company.logo || "";
  const name = company.shortName || company.company || "Company";
  return source
    ? `<img src="${escapeHTML(source)}" alt="" loading="lazy" decoding="async" />`
    : `<b aria-hidden="true">${escapeHTML(dynamicsMonogram(name))}</b>`;
};

const dynamicsLineKind = (relation = {}) => {
  if (relation.type === "qualification") return "qualification";
  if (relation.type === "exploration") return "exploration";
  const status = join([relation.status, relation.domain]).toLowerCase();
  if (/qualification|compatib|validation|검증|호환|ccl/.test(status)) return "qualification";
  if (/explor|discussion|review|협력 논의|논의 중|검토 중/.test(status)) return "exploration";
  return "official";
};
// The map admits evidence up to 36 months old, so a qualification from three
// years ago sits in the same list as one from last week. Dropping it would
// lose real evidence; saying how old it is costs nothing and stops a stale
// line reading as a current one.
const RELATION_STALE_MONTHS = 18;
function relationAgeNote(relation = {}) {
  const suppliedMonths = Number(relation.ageMonths);
  const stamp = Date.parse(String(relation.effectiveAt || ""));
  const months = Number.isFinite(suppliedMonths)
    ? suppliedMonths
    : Number.isNaN(stamp) ? 0 : Math.floor((Date.now() - stamp) / (1000 * 60 * 60 * 24 * 30.44));
  if (months < RELATION_STALE_MONTHS) return "";
  return months >= 24 ? `${Math.floor(months / 12)}년 경과` : `${months}개월 경과`;
}

const dynamicsLineLabel = { official: "공식 계약·공급·통합", exploration: "협력 논의", qualification: "시스템 검증" };

const dynamicsViewIds = (items) => Array.isArray(items)
  ? items.map((item) => typeof item === "string" ? item : item?.id).filter(Boolean)
  : [];

function resolveCompetitiveDynamicsView(model = {}) {
  const viewKey = typeof model.defaultView === "string" ? model.defaultView : "";
  const view = model.views?.[viewKey];
  const companies = Array.isArray(model.companies) ? model.companies : [];
  const relations = Array.isArray(model.relations) ? model.relations : [];
  const layers = Array.isArray(model.layers) ? model.layers : [];
  const types = Array.isArray(model.types) ? model.types : [];
  const companyIds = new Set(dynamicsViewIds(view?.companyIds));
  const relationIds = new Set(dynamicsViewIds(view?.relationIds));
  const layerIds = new Set(dynamicsViewIds(view?.layerIds));
  const typeIds = new Set(dynamicsViewIds(view?.types));
  const exact = (items, ids) => items.length === ids.size && items.every((item) => ids.has(item.id));
  const ready = Boolean(view?.anchorId && companyIds.has(view.anchorId)
    && exact(companies, companyIds) && exact(relations, relationIds)
    && exact(layers, layerIds) && exact(types, typeIds)
    && relations.every((item) => companyIds.has(item.from) && companyIds.has(item.to)));
  return {
    ready,
    viewKey, companies, relations, layers, types,
    anchorId: view?.anchorId || "",
    updatedAt: model.updatedAt || "",
    counts: view?.counts || {},
    companyScope: view?.companyScope || "verified-relation-endpoints",
    policy: view?.evidencePolicy?.summary || "1차 출처로 확인된 직접 관계만 표시 · 미검증 관계 자동 제외",
  };
}

function renderDynamicsDetail(company = {}, relations = [], companies = [], layers = []) {
  const companyById = new Map(companies.map((item) => [item.id, item]));
  const connected = relations.filter((relation) => relation.from === company.id || relation.to === company.id);
  const grouped = [...new Set(connected.map((relation) => relation.type).filter(Boolean))].map((type) => ({
    type,
    ...(dynamicsTypeMeta[type] || { label: type, accent: "#9ab1c2" }),
    items: connected.filter((relation) => relation.type === type),
  })).filter((group) => group.items.length);
  const baseline = Array.isArray(company.baseline) ? company.baseline.slice(0, 3) : [];
  const criteria = Array.isArray(company.buyingCriteria) ? company.buyingCriteria.slice(0, 4) : [];
  const serves = Array.isArray(company.servesAccounts) ? company.servesAccounts : [];
  const signal = company.latestSignal || null;
  const relationGroups = grouped.map((group) => `<section style="--relation-accent:${group.accent}"><header><b>${group.label}</b></header>${group.items.map((relation) => {
    const otherId = relation.from === company.id ? relation.to : relation.from;
    const other = companyById.get(otherId) || {};
    const lineKind = dynamicsLineKind(relation);
    const freshness = relation.freshnessBand === "current" ? "최근 6개월" : relation.freshnessBand === "recent" ? "최근 18개월" : relation.freshnessBand === "history" ? "갱신 검토" : "";
    const meta = join([
      dynamicsLineLabel[lineKind],
      relation.evidenceGrade,
      relation.effectiveAt,
      freshness,
      relationAgeNote(relation),
      relation.status || "관찰",
    ].filter(Boolean));
    const history = Array.isArray(relation.evidenceHistory) ? relation.evidenceHistory : [];
    const historyHTML = history.length ? `<details class="sc-dynamics-history"><summary>이 기업쌍의 이전 공식 근거 ${history.length}건</summary>${history.map((item) => { const historyMeta = join([dynamicsTypeMeta[item.type]?.label || item.type, item.evidenceGrade, item.effectiveAt, item.status]); const historyTitle = item.source?.url ? `<a href="${escapeHTML(item.source.url)}" target="_blank" rel="noopener">${escapeHTML(item.title || "공식 원문")}</a>` : `<b>${escapeHTML(item.title || "공식 근거")}</b>`; return `<article>${historyTitle}${item.detail ? `<p>${escapeHTML(item.detail)}</p>` : ""}<small>${escapeHTML(historyMeta)}</small></article>`; }).join("")}</details>` : "";
    const detail = relation.source?.url
      ? `<a class="sc-dynamics-relation-source" href="${escapeHTML(relation.source.url)}" target="_blank" rel="noopener"><p>${escapeHTML(relation.detail)}</p></a>`
      : `<p>${escapeHTML(relation.detail)}</p>`;
    return `<div class="sc-dynamics-relation"><button type="button" data-dynamics-jump="${escapeHTML(otherId)}">${escapeHTML(other.company || otherId)}</button>${relation.domain ? `<b class="sc-dynamics-relation-domain">${escapeHTML(relation.domain)}</b>` : ""}${detail}${relation.memoryImplication ? `<p class="sc-dynamics-memory"><b>MEMORY</b>${highlight(relation.memoryImplication)}</p>` : ""}${relation.decisionImpact ? `<p class="sc-dynamics-action"><b>ACTION</b>${escapeHTML(relation.decisionImpact)}</p>` : ""}<small>${escapeHTML(meta)}</small>${historyHTML}</div>`;
  }).join("")}</section>`).join("");
  const priority = Boolean(company.priorityTier);
  const signalTitle = signal?.url
    ? `<a class="sc-dynamics-signal-link" href="${escapeHTML(signal.url)}" target="_blank" rel="noopener"><p>${escapeHTML(signal.title)}</p></a>`
    : signal ? `<p>${escapeHTML(signal.title)}</p>` : "";
  return `<div class="sc-dynamics-detail-head" style="--company-accent:${escapeHTML(company.accent || "#34b4ab")}"><span>${escapeHTML(dynamicsLayerLabel(layers, company.layer))}</span><div><strong>${escapeHTML(company.company || "업체 선택")}</strong><em>${escapeHTML(company.stage?.label || `${connected.length}개 관계`)}</em></div><p>${escapeHTML(company.portfolio || company.role || "메모리 의사결정 맥락")}</p></div><div class="sc-dynamics-facts"><div><b>${priority ? "SYSTEM ROLE" : "MEMORY PAIN"}</b><p>${highlight(priority ? company.systemRole || company.role : company.pain || company.position || "공개 Workload 병목 확인 필요")}</p></div><div><b>${priority ? "협력 가치" : "SKH OPTION"}</b><p>${highlight(priority ? company.collaborationValue || company.position : company.memoryOption || company.portfolio || "Requirement Lock 우선")}</p></div><div><b>${priority ? "MEMORY 제안" : "BUYING CRITERIA"}</b><p>${highlight(priority ? company.memoryOption || company.portfolio : join(criteria) || join(serves) || "성능 · 일정 · 공급 · 경제성")}</p></div><div><b>${priority ? "실행 GATE" : "DECISION GATE"}</b><p>${highlight(company.decision || (priority ? "Qualification · Volume" : "Qualification · Capacity · TCO"))}</p></div></div>${baseline.length ? `<div class="sc-dynamics-baseline">${baseline.map((item) => `<span><b>${escapeHTML(item.label)}</b>${escapeHTML(item.value)}</span>`).join("")}</div>` : ""}${signal ? `<div class="sc-dynamics-signal"><b>최근 계정 신호</b>${signalTitle}<span>${escapeHTML(join([signal.source, signal.date]))}</span></div>` : ""}<div class="sc-dynamics-relations">${relationGroups || `<p class="sc-dynamics-empty">직접 연결 관계 확인 전</p>`}</div>`;
}

export function renderCompetitiveDynamics(model = {}) {
  const view = resolveCompetitiveDynamicsView(model);
  if (!view.ready) return "";
  const { layers, relations, companies, types, anchorId } = view;
  const first = companies.find((company) => company.id === anchorId) || {};
  const allCompanies = view.companyScope === "site-company-registry";
  const rosterHeading = allCompanies ? "AI VALUE CHAIN · ALL COMPANIES" : "AI VALUE CHAIN · VERIFIED ENDPOINTS";
  const rosterLabel = allCompanies ? "사이트 업체 전체" : "검증 관계 업체";
  const mapLabel = allCompanies ? "사이트 업체 전체 및 검증 관계 지도" : "검증 관계 업체 지도";
  const evidenceGuide = `<div class="sc-dynamics-evidence" aria-label="관계선 및 근거 정책"><div class="sc-dynamics-legend">${Object.entries(dynamicsLineLabel).map(([id, label]) => `<span><i data-dynamics-line-key="${id}"></i>${label}</span>`).join("")}</div><p><b>표시 기준</b>${escapeHTML(view.policy)}</p></div>`;
  const companyPicker = `<label class="sc-dynamics-picker"><span>업체 빠른 찾기</span><select data-dynamics-company-select aria-label="관계도 업체 빠른 찾기">${layers.map((layer) => `<optgroup label="${escapeHTML(layer.label)}">${(layer.companies || []).map((company) => `<option value="${escapeHTML(company.id)}"${company.id === first.id ? " selected" : ""}>${escapeHTML(company.company)} · ${Number(company.relationCount || 0)}</option>`).join("")}</optgroup>`).join("")}</select></label>`;
  return `<section class="sc-broadcom-board sc-dynamics-board" data-dynamics-view="${escapeHTML(view.viewKey)}" aria-labelledby="competitiveDynamicsTitle"><header class="sc-broadcom-head"><div><span id="competitiveDynamicsTitle">${escapeHTML(model.eyebrow || "COMPETITIVE DYNAMICS · VALUE CHAIN")}</span></div><p>${escapeHTML(model.description)}</p></header><div class="sc-dynamics-layout"><nav class="sc-dynamics-layers" aria-label="밸류체인 계층 필터"><b>${rosterHeading}</b><button type="button" data-dynamics-layer="all" aria-pressed="true"><span>ALL</span><strong>${rosterLabel}</strong><em>${companies.length}</em></button>${layers.map((layer) => `<button type="button" data-dynamics-layer="${escapeHTML(layer.id)}" aria-pressed="false"><span>${escapeHTML(layer.index)}</span><strong>${escapeHTML(layer.label)}</strong><em>${Number(layer.companies?.length || 0)}</em></button>`).join("")}</nav><div class="sc-dynamics-stage"><div class="sc-dynamics-toolbar" role="toolbar" aria-label="관계 유형 필터"><button type="button" data-dynamics-type="all" aria-pressed="true"><i style="--relation-accent:#9ab1c2"></i>검증 관계 <em>${relations.length}</em></button>${types.map((type) => `<button type="button" data-dynamics-type="${escapeHTML(type.id)}" aria-pressed="false"><i style="--relation-accent:${escapeHTML(dynamicsTypeMeta[type.id]?.accent || "#9ab1c2")}"></i>${escapeHTML(type.label)} <em>${Number(type.count || 0)}</em></button>`).join("")}${companyPicker}</div>${evidenceGuide}<div class="sc-dynamics-map" aria-label="${mapLabel}" style="--dynamics-layer-count:${Math.max(layers.length, 1)}"><svg class="sc-dynamics-links" data-dynamics-links aria-hidden="true"></svg>${layers.map((layer) => `<section data-dynamics-lane="${escapeHTML(layer.id)}"><header><b>${escapeHTML(layer.index)}</b><span>${escapeHTML(layer.label)}</span></header><div>${(layer.companies || []).map((company) => `<button type="button" class="sc-dynamics-node${company.id === first.id ? " is-selected" : ""}" data-dynamics-company="${escapeHTML(company.id)}" aria-pressed="${company.id === first.id ? "true" : "false"}" aria-label="${escapeHTML(company.company)} 관계 보기" style="--company-accent:${escapeHTML(company.accent || "#34b4ab")}"><span class="sc-dynamics-logo">${dynamicsLogoHTML(company)}</span><strong>${escapeHTML(company.shortName || company.company)}</strong></button>`).join("")}</div></section>`).join("")}</div></div><aside class="sc-dynamics-detail" data-dynamics-detail aria-live="polite">${renderDynamicsDetail(first, relations, companies, layers)}</aside></div></section>`;
}

export function bindCompetitiveDynamics(root, model = {}) {
  if (!root) return;
  root.__dynamicsCleanup?.();
  const view = resolveCompetitiveDynamicsView(model);
  if (!view.ready) {
    root.replaceChildren();
    root.dataset.dynamicsStatus = "fail-closed";
    return;
  }
  root.dataset.dynamicsBound = "true";
  root.dataset.dynamicsView = view.viewKey;
  const relations = view.relations;
  const companyList = view.companies;
  const companies = new Map(companyList.map((company) => [company.id, company]));
  const filters = [...root.querySelectorAll("[data-dynamics-type]")];
  const layerFilters = [...root.querySelectorAll("[data-dynamics-layer]")];
  const companySelect = root.querySelector("[data-dynamics-company-select]");
  const nodes = [...root.querySelectorAll("[data-dynamics-company]")];
  const detail = root.querySelector("[data-dynamics-detail]");
  const map = root.querySelector(".sc-dynamics-map");
  const links = root.querySelector("[data-dynamics-links]");
  const nodeById = new Map(nodes.map((node) => [node.dataset.dynamicsCompany || "", node]));
  const edgeById = new Map();
  let selectedId = view.anchorId;
  let activeType = "all";
  let activeLayer = "all";
  let linkFrame = 0;
  const svgNamespace = "http://www.w3.org/2000/svg";
  const relationColor = (type) => dynamicsTypeMeta[type]?.accent || "#9ab1c2";
  if (links) {
    const markerPrefix = `sc-dynamics-arrow-${++dynamicsInstance}`;
    const defs = document.createElementNS(svgNamespace, "defs");
    [...new Set(relations.map((relation) => relation.type))].forEach((type) => {
      const marker = document.createElementNS(svgNamespace, "marker");
      marker.id = `${markerPrefix}-${type}`;
      marker.setAttribute("viewBox", "0 0 8 8");
      marker.setAttribute("refX", "7");
      marker.setAttribute("refY", "4");
      marker.setAttribute("markerWidth", "5");
      marker.setAttribute("markerHeight", "5");
      marker.setAttribute("orient", "auto-start-reverse");
      const arrow = document.createElementNS(svgNamespace, "path");
      arrow.setAttribute("d", "M 0 0 L 8 4 L 0 8 z");
      arrow.setAttribute("fill", relationColor(type));
      marker.appendChild(arrow);
      defs.appendChild(marker);
    });
    links.appendChild(defs);
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
      path.dataset.dynamicsLineKind = dynamicsLineKind(relation);
      const directionMode = relation.direction || "bidirectional";
      path.dataset.dynamicsDirection = directionMode;
      path.dataset.dynamicsEvidenceGrade = relation.evidenceGrade || "";
      path.dataset.dynamicsFreshness = relation.freshnessBand || "unknown";
      path.dataset.pi = String(pairIndex);
      path.dataset.pt = String(pairTotals.get(pair) || 1);
      path.style.setProperty("--relation-accent", relationColor(relation.type));
      const markerUrl = `url(#${markerPrefix}-${relation.type})`;
      if (directionMode === "forward") path.setAttribute("marker-end", markerUrl);
      if (directionMode === "bidirectional") {
        path.setAttribute("marker-start", markerUrl);
        path.setAttribute("marker-end", markerUrl);
      }
      const title = document.createElementNS(svgNamespace, "title");
      title.textContent = join([relation.title, relation.evidenceGrade, relation.effectiveAt, relation.status]);
      path.appendChild(title);
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
      const fromCenterX = fromRect.left - mapRect.left + map.scrollLeft + fromRect.width / 2;
      const fromCenterY = fromRect.top - mapRect.top + map.scrollTop + fromRect.height / 2;
      const toCenterX = toRect.left - mapRect.left + map.scrollLeft + toRect.width / 2;
      const toCenterY = toRect.top - mapRect.top + map.scrollTop + toRect.height / 2;
      const deltaX = toCenterX - fromCenterX;
      const deltaY = toCenterY - fromCenterY;
      const distance = Math.max(1, Math.hypot(deltaX, deltaY));
      const unitX = deltaX / distance;
      const unitY = deltaY / distance;
      const fromRadius = Math.min(fromRect.width, fromRect.height) / 2 + 3;
      const toRadius = Math.min(toRect.width, toRect.height) / 2 + 3;
      const x1 = fromCenterX + unitX * fromRadius;
      const y1 = fromCenterY + unitY * fromRadius;
      const x2 = toCenterX - unitX * toRadius;
      const y2 = toCenterY - unitY * toRadius;
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
    const overviewMode = companyId === view.anchorId && activeType === "all" && activeLayer === "all";
    nodes.forEach((node) => {
      const id = node.dataset.dynamicsCompany || "";
      const selected = id === companyId;
      const related = relatedIds.has(id) && !selected;
      node.classList.toggle("is-selected", selected);
      node.classList.toggle("is-related", related);
      node.classList.toggle("is-muted", !overviewMode && !selected && !related);
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
      const overviewContext = overviewMode && typeMatch && layerMatch;
      edge.classList.toggle("is-active", typeMatch && selectedMatch && layerMatch);
      edge.classList.toggle("is-context", overviewContext && !selectedMatch);
      edge.classList.toggle("is-muted", !typeMatch || (!overviewContext && !selectedMatch) || !layerMatch);
    });
    if (detail) {
      detail.innerHTML = renderDynamicsDetail(company, activeType === "all" ? relations : relations.filter((relation) => relation.type === activeType), companyList, view.layers);
      detail.querySelectorAll("b").forEach((label) => {
        if (label.textContent?.trim() === "SKH OPTION") label.textContent = "MEMORY OPTION";
      });
    }
    if (companySelect) companySelect.value = companyId;
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
  companySelect?.addEventListener("change", () => {
    activeLayer = "all";
    activeType = "all";
    renderSelection(companySelect.value || selectedId);
  });
  const handleRootClick = (event) => {
    const jump = event.target.closest("[data-dynamics-jump]");
    const companyId = jump?.dataset.dynamicsJump || "";
    if (companies.has(companyId)) renderSelection(companyId);
  };
  root.addEventListener("click", handleRootClick);
  const resizeObserver = "ResizeObserver" in window ? new ResizeObserver(scheduleLinkLayout) : null;
  if (resizeObserver && map) resizeObserver.observe(map);
  window.addEventListener("resize", scheduleLinkLayout, { passive: true });
  root.__dynamicsCleanup = () => {
    cancelAnimationFrame(linkFrame);
    resizeObserver?.disconnect();
    window.removeEventListener("resize", scheduleLinkLayout);
    root.removeEventListener("click", handleRootClick);
  };
  document.fonts?.ready?.then(scheduleLinkLayout).catch(() => {});
  renderSelection();
  scheduleLinkLayout();
}
