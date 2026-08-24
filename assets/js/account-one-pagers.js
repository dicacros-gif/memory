const escapeHTML = (value) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

const labels = (items = []) => items.map((item) => item?.label).filter(Boolean).join(" · ");
const join = (items = []) => items.filter(Boolean).join(" · ");
const highlight = (value) => escapeHTML(value).replace(/\b(HBM|KV Cache|TPOT|TCO|Base Die|AI-D|AI-N|CoWoS|Qualification|LTA)\b/gi, "<mark>$1</mark>");

export function renderExecutiveOnePagers(pages = []) {
  if (!pages.length) return "";
  return `<details class="sc-report"><summary class="sc-report-head"><strong>EXECUTIVE ACCOUNT ONE-PAGERS</strong><span>Pain · 경쟁 리스크 · Deal · 90D Gate</span></summary><div class="sc-partner-grid">${pages.map((page) => `<article class="sc-partner"><span class="sc-tech-en">${escapeHTML(page.layer || "END CUSTOMER")}</span><strong>${escapeHTML(page.headline || page.accountId)}</strong><div class="sc-partner-row"><b>PAIN</b><span>${escapeHTML(labels(page.topPainAxes) || "신호 확인 필요")}</span></div><div class="sc-partner-row"><b>RISK</b><span>${escapeHTML(labels(page.whyLost) || "공개 근거 확인 필요")}</span></div><div class="sc-partner-row"><b>OPTION</b><span>${escapeHTML((page.recommendedProductIds || []).join(" · ") || "Requirement Lock 우선")}</span></div><div class="sc-decision-gate"><b>GATE</b><span>${escapeHTML(page.decisionQuestion)}</span></div></article>`).join("")}</div></details>`;
}

export function renderAccountEcosystem({ ecosystem = {}, layerModel = {} } = {}) {
  const partners = Array.isArray(ecosystem.partners) ? ecosystem.partners : [];
  if (!partners.length) return "";
  const layer = (id) => layerModel.layers?.find((item) => item.id === id) || {};
  const partnerCriteria = layer("asic-partner").buyingCriteria || [];
  const customerCriteria = layer("end-customer").buyingCriteria || [];
  return `<section class="sc-broadcom-board sc-partner-ecosystem" aria-labelledby="partnerEcosystemTitle"><header class="sc-broadcom-head"><div><span>${escapeHTML(ecosystem.eyebrow || "CUSTOM SILICON PARTNER ECOSYSTEM")}</span><h4 id="partnerEcosystemTitle">${escapeHTML(ecosystem.title || "Broadcom · Marvell → Big Tech / Hyperscaler")}</h4></div><p>${escapeHTML(ecosystem.description)}</p></header><div class="sc-partner-hierarchy" aria-label="ASIC Partner와 Big Tech 고객 계층">${partners.map((partner) => { const served = Array.isArray(partner.accounts) ? partner.accounts : []; const rollup = partner.rollup || {}; const pains = (rollup.topPainAxes || []).filter((item) => Number(item.mentions || 0) > 0).slice(0, 3); return `<section class="sc-partner-lane" style="--lane-accent:${escapeHTML(partner.accent || "#D05A2B")}"><article class="sc-partner sc-partner-node" tabindex="0" style="--sc-accent:${escapeHTML(partner.accent || "#D05A2B")}"><span class="sc-tech-en">01 · ASIC PARTNER</span><strong>${escapeHTML(partner.company)}</strong><p>${escapeHTML(partner.chip)}</p><div class="sc-partner-row"><b>BUYING</b><span>${escapeHTML(join(partner.buyingCriteria || partnerCriteria))}</span></div><div class="sc-partner-row"><b>ROLL-UP</b><span>${escapeHTML(join(served.map((account) => account.company)))}</span></div>${pains.length ? `<div class="sc-partner-row"><b>PAIN SIGNAL</b><span>${escapeHTML(join(pains.map((item) => `${item.label} ${item.mentions}`)))}</span></div>` : ""}</article><div class="sc-hierarchy-arrow" aria-hidden="true">↓</div><div class="sc-partner-children" aria-label="${escapeHTML(partner.company)} 연결 고객">${served.map((account) => `<article class="sc-hyperscaler-node" tabindex="0" style="--account-accent:${escapeHTML(account.accent || partner.accent || "#2D6BFF")}"><span>02 · BIG TECH / HYPERSCALER</span><strong>${escapeHTML(account.company)}</strong><small>${escapeHTML(account.chip)}</small><dl><div><dt>MEMORY PAIN</dt><dd>${highlight(account.pain)}</dd></div><div><dt>SKH OPTION</dt><dd>${highlight(account.memory)}</dd></div><div><dt>GATE</dt><dd>${escapeHTML(account.gate)}</dd></div></dl></article>`).join("")}</div></section>`; }).join("")}</div><div class="sc-hierarchy-criteria"><b>HYPERSCALER BUYING CRITERIA</b><span>${escapeHTML(join(customerCriteria))}</span></div><p class="sc-broadcom-policy">${escapeHTML(ecosystem.evidencePolicy)}</p></section>`;
}

export function renderCompetitiveDynamics(model = {}) {
  const layers = Array.isArray(model.layers) ? model.layers : [];
  const relations = Array.isArray(model.relations) ? model.relations : [];
  const companies = Array.isArray(model.companies) ? model.companies : [];
  if (!layers.length || !relations.length) return "";
  const first = companies[0] || {};
  return `<section class="sc-broadcom-board" aria-labelledby="competitiveDynamicsTitle"><header class="sc-broadcom-head"><div><span>${escapeHTML(model.eyebrow || "COMPETITIVE DYNAMICS · VALUE CHAIN")}</span><h4 id="competitiveDynamicsTitle">${escapeHTML(model.title || "경쟁 · 파트너십 · 투자 · 공급 관계 지도")}</h4></div><p>${escapeHTML(model.description)}</p></header><div class="sc-kpi-strip" role="toolbar" aria-label="관계 유형 필터"><button type="button" class="sc-playbook-status is-fact" data-dynamics-type="all" aria-pressed="true">전체 · ${relations.length}</button>${(model.types || []).map((type) => `<button type="button" class="sc-playbook-status is-monitoring" data-dynamics-type="${escapeHTML(type.id)}" aria-pressed="false">${escapeHTML(type.label)} · ${Number(type.count || 0)}</button>`).join("")}</div><div class="sc-partner-hierarchy" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))" aria-label="AI 메모리 밸류체인">${layers.map((layer) => `<section class="sc-partner-lane"><header class="sc-report-head"><strong>${escapeHTML(layer.index)} · ${escapeHTML(layer.label)}</strong><span>${escapeHTML(layer.role)}</span></header><div class="sc-partner-children">${(layer.companies || []).map((company) => `<button type="button" class="sc-partner sc-partner-node" data-dynamics-company="${escapeHTML(company.id)}" style="width:100%;text-align:left;--sc-accent:${escapeHTML(company.accent || "#255ba8")}"><span class="sc-tech-en">${Number(company.relationCount || 0)} RELATIONS</span><strong>${escapeHTML(company.company)}</strong><p>${escapeHTML(company.portfolio)}</p></button>`).join("")}</div></section>`).join("")}</div><div class="sc-report"><div class="sc-report-head"><strong>RELATIONSHIP MAP</strong><span>업체 선택 → 연결 관계 · 개요</span></div><div class="sc-partner-grid">${relations.map((relation) => `<article class="sc-partner" data-dynamics-relation="${escapeHTML(relation.type)}" data-from="${escapeHTML(relation.from)}" data-to="${escapeHTML(relation.to)}" tabindex="0"><span class="sc-tech-en">${escapeHTML(relation.type.toUpperCase())}</span><strong>${escapeHTML(relation.title)}</strong><p>${escapeHTML(relation.detail)}</p></article>`).join("")}</div></div><article class="sc-partner"><span class="sc-tech-en">COMPANY OVERVIEW</span><strong data-profile-company>${escapeHTML(first.company || "업체 선택")}</strong><div class="sc-partner-row"><b>VALUE CHAIN</b><span data-profile-role>${escapeHTML(first.role || "")}</span></div><div class="sc-partner-row"><b>PORTFOLIO</b><span data-profile-portfolio>${escapeHTML(first.portfolio || "")}</span></div><div class="sc-partner-row"><b>POSITION</b><span data-profile-position>${escapeHTML(first.position || "")}</span></div><div class="sc-decision-gate"><b>DECISION</b><span data-profile-decision>${escapeHTML(first.decision || "")}</span></div></article></section>`;
}

export function bindCompetitiveDynamics(root, model = {}) {
  if (!root) return;
  const relations = [...root.querySelectorAll("[data-dynamics-relation]")];
  const filters = [...root.querySelectorAll("[data-dynamics-type]")];
  const companies = new Map((model.companies || []).map((company) => [company.id, company]));
  const applyFilter = (type = "all", companyId = "") => {
    relations.forEach((card) => { card.hidden = (type !== "all" && card.dataset.dynamicsRelation !== type) || (companyId && card.dataset.from !== companyId && card.dataset.to !== companyId); });
    filters.forEach((button) => { const active = button.dataset.dynamicsType === type; button.ariaPressed = String(active); button.classList.toggle("is-fact", active); button.classList.toggle("is-monitoring", !active); });
  };
  filters.forEach((button) => button.addEventListener("click", () => applyFilter(button.dataset.dynamicsType || "all")));
  root.querySelectorAll("[data-dynamics-company]").forEach((button) => button.addEventListener("click", () => {
    const company = companies.get(button.dataset.dynamicsCompany || "");
    if (!company) return;
    root.querySelector("[data-profile-company]").textContent = company.company || "";
    root.querySelector("[data-profile-role]").textContent = company.role || "";
    root.querySelector("[data-profile-portfolio]").textContent = company.portfolio || "";
    root.querySelector("[data-profile-position]").textContent = company.position || "";
    root.querySelector("[data-profile-decision]").textContent = company.decision || "";
    applyFilter("all", company.id);
  }));
}
