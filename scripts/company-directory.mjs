import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (name) => JSON.parse(readFileSync(resolve(root, "data", name), "utf8"));
// Investment posture per company: CapEx, plan, an executive line, and what it
// means for memory demand. Kept beside the profile builders so every builder
// can attach it.
const CAPITAL_PLANS = (() => {
  try { return readJson("capital-plans.json").plans || {}; } catch { return {}; }
})();
// Crawl-observed spending signals override nothing — they sit beside the
// curated baseline so a stale hand-written figure is visibly superseded by
// what the feed actually reported.
let OBSERVED_CAPITAL = {};
export function setObservedCapital(signals = {}) { OBSERVED_CAPITAL = signals || {}; }
// Crawl-accumulated spending, executive statements and technology moves. A
// company with none of the three simply omits the block.
let COMPANY_SIGNALS = {};
export function setCompanySignals(signals = {}) { COMPANY_SIGNALS = signals || {}; }

// Memory requirements derived from what the crawl observed, not authored per
// company. Absent for a company the feed has said nothing about.
let MEMORY_DEMAND = {};
export function setMemoryDemand(demand = {}) { MEMORY_DEMAND = demand || {}; }
const memoryDemandFor = (id) => {
  const row = MEMORY_DEMAND[id];
  return row?.requirements?.length ? row.requirements : null;
};
const signalsFor = (id) => {
  const row = COMPANY_SIGNALS[id];
  if (!row) return null;
  const capex = row.capex || [];
  const quotes = row.quotes || [];
  const tech = row.tech || [];
  if (!capex.length && !quotes.length && !tech.length) return null;
  return { capex, quotes, tech };
};

const capitalPlanFor = (id) => {
  const curated = CAPITAL_PLANS[id] || null;
  const observed = OBSERVED_CAPITAL[id] || null;
  if (!curated && !observed) return null;
  return { ...(curated || {}), ...(observed ? { observed } : {}) };
};

const accountModel = readJson("accounts.json");
const sourceCatalog = readJson("source-catalog.json");
const legacyIntelligence = readJson("company-intelligence.json");
const PUBLIC_ARTICLE_YEAR = "2026";

const layerLabels = Object.freeze({
  "end-customer": "Big Tech · Hyperscaler",
  "asic-partner": "ASIC · XPU Design Partner",
  "foundry-package": "Foundry · Advanced Packaging",
  "memory-supplier": "Memory Supplier",
  "oem-tier-1": "Tier 1 · Strategic OEM",
  "oem-tier-2": "Tier 2 · AI Server ODM",
  "oem-tier-3": "Tier 3 · System / AI Infrastructure",
  "semiconductor-ecosystem": "Semiconductor Ecosystem",
});

const canonicalLegacyIds = Object.freeze({
  "skhy-stock": "skhynix",
  "samsung-stock": "samsung",
  "micron-stock": "micron",
  "nvidia-stock": "nvidia",
  "tsmc-stock": "tsmc",
  "broadcom-stock": "broadcom",
  "cxmt-stock": "cxmt",
  "amd-stock": "amd",
  "asml-stock": "asml",
  "smic-stock": "smic",
  "naura-stock": "naura",
  "amec-stock": "amec",
  "jcet-stock": "jcet",
});

const unique = (items = [], key = (item) => String(item || "")) => {
  const seen = new Set();
  return items.filter((item) => {
    const id = key(item).toLowerCase().replace(/\s+/g, " ").trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

const compactSource = (source = {}) => source?.id && source?.url ? {
  id: source.id,
  name: source.name || source.id,
  url: source.url,
  sourceClass: source.sourceClass || "public",
  tier: source.tier || "reference",
} : null;

const sourceMap = new Map((sourceCatalog.sources || []).map((source) => [source.id, source]));
const resolveSources = (ids = []) => unique(ids.map((id) => compactSource(sourceMap.get(id))).filter(Boolean), (item) => item.url);

const plainStage = (stage) => typeof stage === "string"
  ? { label: stage }
  : stage && typeof stage === "object"
    ? { id: stage.id || "", label: stage.label || stage.id || "공개 확인 필요", sourceId: stage.sourceId || "" }
    : { label: "공개 확인 필요" };

const isCurrentPublicArticle = (item = {}) => {
  const date = String(item.date || item.publishedAt || item.asOf || "").trim();
  return Boolean(item?.url && date.startsWith(PUBLIC_ARTICLE_YEAR));
};

const safeEvidence = (item = {}) => isCurrentPublicArticle(item) ? {
  title: item.title || "공개 근거",
  source: item.source || "원문",
  sourceClass: item.sourceClass || "public",
  url: item.url,
  date: String(item.date || item.publishedAt || item.asOf).slice(0, 10),
} : null;

const profileAliases = (account = {}, legacy = {}) => unique([
  account.company,
  ...(account.aliases || []),
  legacy.name,
  legacy.nameKo,
  ...(legacy.entityAliases || []),
].filter(Boolean));

const autoLinkAliases = (account = {}, legacy = {}) => unique([
  account.company,
  ...String(account.company || "").split(/\s+/).filter((item) => item.replace(/[^a-z0-9가-힣]/gi, "").length >= 3),
  legacy.name,
  legacy.nameKo,
  ...(legacy.entityAliases || []),
].filter((item) => String(item || "").replace(/[^a-z0-9가-힣]/gi, "").length >= 3));

const layerMandate = Object.freeze({
  "end-customer": "고객 AI Chip Roadmap과 Workload 변화를 Memory Requirement로 변환",
  "asic-partner": "최종 고객과 Memory 공급사 사이의 XPU·Base Die·Package 공동설계",
  "foundry-package": "Logic Node·CoWoS·Package Yield·Ramp 일정을 Memory 공급 게이트로 관리",
  "memory-supplier": "고객별 Qualification·Capacity·Portfolio·Margin 조건으로 공급 포지션 관리",
  "oem-tier-1": "전략 OEM의 Rack Platform과 고객 인증을 Memory Attach·Volume으로 전환",
  "oem-tier-2": "Hyperscaler Rack Architecture·BOM·Pilot Yield를 대량 공급 Gate로 전환",
  "oem-tier-3": "System·Fabric·Enterprise Channel별 Memory Reference 구성을 선별 확장",
  "semiconductor-ecosystem": "차세대 기술 로드맵을 HBM·AI-D·AI-N 사업 기회와 실행 리스크로 변환",
});

function accountBrief(account = {}, legacy = {}, overview = {}, memoryLens = {}, chipLens = {}, dataCenterLens = {}) {
  const layer = account.layer || "end-customer";
  const buyingCriteria = unique(memoryLens.buyingCriteria || []).slice(0, 4);
  const baseline = (memoryLens.baseline || []).slice(0, 3);
  const platforms = unique((chipLens.portfolio || []).map((item) => item.name).filter(Boolean));
  const priorities = unique([
    ...(legacy.officialPriorities || []).map((item) => item.title || item.detail),
    memoryLens.pain,
    memoryLens.proposal,
    dataCenterLens.executionGate,
  ]).slice(0, 4);
  return {
    mandate: layerMandate[layer] || layerMandate["semiconductor-ecosystem"],
    businessStatus: [
      { label: "ACCOUNT ROLE", value: layerLabels[layer] || layer },
      { label: "CHIP / PLATFORM", value: overview.platform || chipLens.primaryChip || "공개 확인 필요" },
      { label: "MARKET POSITION", value: overview.relationship || "공개 관계 확인 필요" },
      { label: "EXECUTION STAGE", value: overview.stage?.label || "공개 확인 필요" },
    ],
    decisionFlow: [
      { index: "01", label: "ACCOUNT", value: overview.platform || chipLens.primaryChip || "Chip Roadmap" },
      { index: "02", label: "PAIN", value: memoryLens.pain || "Workload Pain" },
      { index: "03", label: "NEXT MEMORY", value: memoryLens.proposal || "Custom HBM·AI-D·AI-N" },
      { index: "04", label: "DEAL GATE", value: memoryLens.gate || "Qualification·Capacity·LTA" },
    ],
    organizationRaci: [
      {
        owner: "GSM",
        role: "Account Intelligence",
        action: unique([overview.relationship, ...buyingCriteria]).slice(0, 3).join(" · ") || "고객 Roadmap·Buying Center·LTA 협상",
      },
      {
        owner: "HBM BUSINESS",
        role: "Qualification & Capacity",
        action: unique([memoryLens.proposal, memoryLens.gate, ...baseline.map((item) => item.value)]).slice(0, 3).join(" · ") || "Custom HBM·인증·Capacity 실행",
      },
      {
        owner: "MSR",
        role: "Next Memory Pathfinding",
        action: unique([dataCenterLens.architectureAction, ...platforms]).slice(0, 3).join(" · ") || "AI-D·AI-N·미래 Memory 기회 검증",
      },
    ],
    priorities,
  };
}

function accountProfile(account = {}, dynamic = {}, competitive = null, legacy = {}, executive = null) {
  const profileLayer = String(competitive?.layer || "").startsWith("oem-tier-")
    ? competitive.layer
    : account.layer || "end-customer";
  const supplierRelations = (accountModel.supplierRelations || [])
    .filter((relation) => relation.accountId === account.id)
    .map((relation) => ({
      supplierId: relation.supplierId,
      supplier: (accountModel.suppliers || []).find((supplier) => supplier.id === relation.supplierId)?.label || relation.supplierId,
      status: relation.status || "추적",
      claim: relation.claim || "watch",
      note: relation.note || "",
      source: compactSource(sourceMap.get(relation.sourceId)),
    }));
  const sourceIds = unique([
    ...(account.sourceIds || []),
    ...(account.baseline || []).map((item) => item.sourceId),
    account.stage?.sourceId,
    account.xpuEcosystem?.sourceId,
    account.broadcomStrategy?.sourceId,
  ].filter(Boolean));
  const evidence = unique([
    safeEvidence(dynamic.evidence),
    ...(dynamic.evidenceStream || []).slice(0, 4).map(safeEvidence),
  ].filter(Boolean), (item) => item.url);
  const painAxes = (dynamic.painAxes || [])
    .filter((axis) => Number(axis.mentions || 0) > 0)
    .sort((a, b) => Number(b.mentions || 0) - Number(a.mentions || 0))
    .slice(0, 4)
    .map((axis) => ({ id: axis.id, label: axis.label, mentions: axis.mentions, trend: axis.trend, productIds: axis.productIds || [] }));
  const chipPortfolio = unique([
    ...(account.chipPortfolio || []),
    ...(dynamic.chipPortfolio || []),
  ], (item) => item.name || item.publicSpec || JSON.stringify(item));
  const overview = {
    role: competitive?.role || (account.layer === "asic-partner" ? "XPU Architecture · Cost · Qualification" : "AI Chip Roadmap · Workload · Buying Criteria"),
    platform: competitive?.portfolio || account.chip || "공개 확인 필요",
    stage: plainStage(dynamic.chipStage || dynamic.stage || account.stage),
    relationship: competitive?.position || account.relationship || "공개 관계 확인 필요",
  };
  const memoryLens = {
    pain: account.pain || "공개 Workload 신호 확인 필요",
    proposal: account.memory || "Requirement Lock 우선",
    gate: account.gate || "Qualification · TCO · Capacity",
    buyingCriteria: account.buyingCriteria || [],
    baseline: account.baseline || [],
    painAxes,
    supplierRelations,
    decisionFocus: legacy.decisionFocus || [],
  };
  const chipLens = {
    primaryChip: account.chip || "공개 확인 필요",
    portfolio: chipPortfolio,
    generations: account.generations || [],
    generationProgression: dynamic.generationProgression || null,
    partner: account.xpuEcosystem || null,
    servesAccounts: (account.servesAccounts || []).map((id) => {
      const target = (accountModel.accounts || []).find((item) => item.id === id);
      return target ? { id, company: target.company, chip: target.chip } : { id, company: id };
    }),
  };
  const dataCenterLens = {
    demandClass: account.demandClass || "ecosystem",
    workloads: unique(chipPortfolio.map((item) => item.workload).filter(Boolean)),
    systemBottleneck: account.pain || "공개 Workload 신호 확인 필요",
    architectureAction: account.memory || "Memory Requirement Matrix 설계",
    executionGate: account.gate || "동일 Workload·SLO 기반 검증",
    operatingQuestion: account.broadcomStrategy?.accountQuestion || competitive?.decision || account.relationship || "고객 Workload와 Memory TCO를 같은 기준으로 검증",
  };
  return {
    id: account.id,
    name: account.company,
    nameKo: legacy.nameKo || account.company,
    aliases: profileAliases(account, legacy),
    autoLinkAliases: autoLinkAliases(account, legacy),
    layer: profileLayer,
    layerLabel: layerLabels[profileLayer] || profileLayer || "Company",
    group: account.group || "",
    accent: account.accent || "#0b7189",
    summary: legacy.summary || competitive?.position || account.relationship || "메모리·칩·데이터센터 관점의 공개 정보 기반 기업 프로필",
    officialUrl: legacy.officialUrl || resolveSources(sourceIds)[0]?.url || "",
    verifiedAt: legacy.verifiedAt || dynamic.evidence?.asOf || "",
    overview,
    accountBrief: accountBrief(account, legacy, overview, memoryLens, chipLens, dataCenterLens),
    memoryLens,
    chipLens,
    dataCenterLens,
    executiveLens: {
      question: executive?.decisionQuestion || account.broadcomStrategy?.accountQuestion || account.gate || "고객 Workload와 Memory TCO를 같은 기준으로 검증",
      painSignals: (executive?.topPainAxes || painAxes).map((axis) => axis.label).filter(Boolean).slice(0, 3),
      riskSignals: (executive?.whyLost || []).map((axis) => axis.label).filter(Boolean).slice(0, 3),
      recommendedProducts: executive?.recommendedProductIds || [],
      actions: [
        { phase: "0–30D", title: "Requirement Lock", detail: unique([...(account.buyingCriteria || []), ...(account.baseline || []).map((item) => item.label)]).slice(0, 3).join(" · ") || "Workload · SLO · Buying Criteria" },
        { phase: "31–60D", title: "Architecture / TCO", detail: account.memory || "Memory Option · Partner RACI · TCO" },
        { phase: "61–90D", title: "Qualification / Deal", detail: account.gate || "PoC · Capacity · LTA Gate" },
      ],
    },
    ecosystem: {
      partner: account.xpuEcosystem || null,
      servesAccounts: (account.servesAccounts || []).map((id) => ({ id, company: (accountModel.accounts || []).find((item) => item.id === id)?.company || id })),
      supplierRelations,
    },
    organization: legacy.organization || [],
    priorities: legacy.officialPriorities || [],
    capitalPlan: capitalPlanFor(account.id),
    signals: signalsFor(account.id),
    derivedDemand: memoryDemandFor(account.id),
    evidence,
    sources: resolveSources(sourceIds),
  };
}

function legacyProfile(id, legacy = {}) {
  const aliases = profileAliases({ company: legacy.name, aliases: [] }, legacy);
  return {
    id,
    name: legacy.name || legacy.nameKo || id,
    nameKo: legacy.nameKo || legacy.name || id,
    aliases,
    autoLinkAliases: autoLinkAliases({ company: legacy.name }, legacy),
    layer: "semiconductor-ecosystem",
    layerLabel: layerLabels["semiconductor-ecosystem"],
    group: "semiconductor-value-chain",
    accent: "#315b7a",
    summary: legacy.summary || "반도체 밸류체인 공개 정보 기반 기업 프로필",
    officialUrl: legacy.officialUrl || "",
    verifiedAt: legacy.verifiedAt || "",
    overview: {
      role: "Semiconductor Value Chain",
      platform: (legacy.officialPriorities || []).map((item) => item.title).slice(0, 2).join(" · ") || "공개 기업 정보",
      stage: { label: "공식 원문 모니터링" },
      relationship: "메모리 공급망·기술 로드맵 영향 추적",
    },
    memoryLens: {
      pain: legacy.decisionFocus?.[0] || "메모리 밸류체인 영향 확인",
      proposal: legacy.officialPriorities?.[0]?.title || "Memory Impact 검증",
      gate: "공식 Roadmap · 고객 인증 · Capacity",
      buyingCriteria: [],
      baseline: [],
      painAxes: [],
      supplierRelations: [],
      decisionFocus: legacy.decisionFocus || [],
    },
    chipLens: {
      primaryChip: "공개 제품·공정 Roadmap",
      portfolio: (legacy.officialPriorities || []).map((item) => ({ name: item.title, publicSpec: item.detail })),
      generations: [],
      generationProgression: null,
      partner: null,
      servesAccounts: [],
    },
    dataCenterLens: {
      demandClass: "ecosystem",
      workloads: [],
      systemBottleneck: legacy.decisionFocus?.[1] || "AI 인프라 공급망 영향 추적",
      architectureAction: legacy.officialPriorities?.[0]?.detail || "메모리·칩·데이터센터 연결 영향 검증",
      executionGate: "공식 원문 · 제품 Stage · 고객 적용",
      operatingQuestion: legacy.decisionFocus?.[2] || "SK hynix 실행 전략에 미치는 영향은 무엇인가",
    },
    executiveLens: {
      question: legacy.decisionFocus?.[2] || "이 기업 변화가 Memory Buying Criteria를 어떻게 바꾸는가",
      painSignals: (legacy.decisionFocus || []).slice(0, 3),
      riskSignals: [],
      recommendedProducts: [],
      actions: [
        { phase: "0–30D", title: "Signal Check", detail: "공식 Roadmap · 고객 적용 · 기준일" },
        { phase: "31–60D", title: "Impact Model", detail: "Memory · Chip · Package 영향" },
        { phase: "61–90D", title: "Decision Gate", detail: "Partner · PoC · Capacity" },
      ],
    },
    ecosystem: { partner: null, servesAccounts: [], supplierRelations: [] },
    organization: legacy.organization || [],
    priorities: legacy.officialPriorities || [],
    capitalPlan: capitalPlanFor(id),
    signals: signalsFor(id),
    derivedDemand: memoryDemandFor(id),
    evidence: [],
    sources: unique([
      legacy.officialUrl ? { id: `${id}-official`, name: `${legacy.name || legacy.nameKo} 공식`, url: legacy.officialUrl, sourceClass: "official", tier: "primary-company" } : null,
      legacy.leadershipSourceUrl ? { id: `${id}-leadership`, name: "Leadership", url: legacy.leadershipSourceUrl, sourceClass: "official", tier: "primary-company" } : null,
    ].filter(Boolean), (item) => item.url),
  };
}

function sourceCompanyProfile(id, company = {}, sources = []) {
  const topics = unique(sources.flatMap((source) => source.topics || []));
  const aliases = unique([company.name, company.nameKo, ...(company.aliases || [])].filter(Boolean));
  const compactSources = unique(sources.map(compactSource).filter(Boolean), (item) => item.url);
  return {
    id,
    name: company.name || company.nameKo || id,
    nameKo: company.nameKo || company.name || id,
    aliases,
    autoLinkAliases: aliases.filter((item) => String(item).replace(/[^a-z0-9가-힣]/gi, "").length >= 3),
    layer: company.layer || "semiconductor-ecosystem",
    layerLabel: layerLabels[company.layer] || layerLabels["semiconductor-ecosystem"],
    group: "source-catalog-company",
    accent: company.accent || "#315b7a",
    summary: company.summary || "공식 원문에서 메모리·칩·데이터센터 영향을 자동 추적",
    officialUrl: compactSources[0]?.url || "",
    verifiedAt: "",
    overview: {
      role: company.layer === "memory-supplier" ? "Memory Product · Supply · Qualification" : "Technology Roadmap · Ecosystem",
      platform: company.chipFocus || topics.slice(0, 3).join(" · ") || "공개 기술 Roadmap",
      stage: { label: "공식 원문 모니터링" },
      relationship: "SK hynix 제품·파트너·경쟁 영향 추적",
    },
    memoryLens: {
      pain: company.memoryFocus || topics.filter((topic) => /memory|hbm|nand|ssd|cxl|storage/.test(topic)).join(" · ") || "Memory Impact 확인",
      proposal: "Workload Requirement → Memory Architecture → Qualification",
      gate: "공식 Roadmap · 고객 적용 · Capacity · TCO",
      buyingCriteria: [], baseline: [], painAxes: [], supplierRelations: [], decisionFocus: [],
    },
    chipLens: {
      primaryChip: company.chipFocus || topics.filter((topic) => /chip|package|foundry|quantum|photon/.test(topic)).join(" · ") || "공개 Chip Roadmap",
      portfolio: compactSources.map((source) => ({ type: "OFFICIAL ROADMAP", name: source.name, publicSpec: topics.slice(0, 5).join(" · ") })),
      generations: [], generationProgression: null, partner: null, servesAccounts: [],
    },
    dataCenterLens: {
      demandClass: "ecosystem",
      workloads: topics.filter((topic) => /ai|data-center|inference|storage|network/.test(topic)).slice(0, 5),
      systemBottleneck: company.dataCenterFocus || "Rack 성능·전력·가용성 영향 확인",
      architectureAction: company.memoryFocus || "Memory·Chip·Fabric 연결 구조 검증",
      executionGate: "동일 Workload·SLO · 상호운용성 · TCO",
      operatingQuestion: "이 기술 변화가 고객 Memory Buying Criteria를 어떻게 바꾸는가",
    },
    executiveLens: {
      question: "이 기업의 Roadmap이 고객 Memory Buying Criteria를 어떻게 바꾸는가",
      painSignals: topics.slice(0, 3),
      riskSignals: [],
      recommendedProducts: [],
      actions: [
        { phase: "0–30D", title: "Signal Check", detail: "공식 Roadmap · 제품 Stage" },
        { phase: "31–60D", title: "System Impact", detail: "Memory · Chip · Data Center" },
        { phase: "61–90D", title: "Execution Gate", detail: "PoC · Partner · Capacity" },
      ],
    },
    ecosystem: { partner: null, servesAccounts: [], supplierRelations: [] },
    capitalPlan: capitalPlanFor(id),
    signals: signalsFor(id),
    organization: [], priorities: [], evidence: [], sources: compactSources,
  };
}

export function buildCompanyDirectory({ siteContentExtended = {}, runId = null, generatedAt = null } = {}) {
  const portfolio = siteContentExtended?.strategyBoard?.customerPortfolio || {};
  const dynamicAccounts = new Map((portfolio.accounts || []).map((account) => [account.id, account]));
  const competitiveCompanies = new Map((portfolio.competitiveDynamics?.companies || []).map((company) => [company.id, company]));
  const executivePages = new Map((portfolio.executiveOnePagers || []).map((page) => [page.accountId, page]));
  const legacyByCanonicalId = new Map();
  for (const [legacyId, profile] of Object.entries(legacyIntelligence.profiles || {})) {
    legacyByCanonicalId.set(canonicalLegacyIds[legacyId] || legacyId.replace(/-stock$/, ""), profile);
  }
  const profiles = new Map();
  for (const account of accountModel.accounts || []) {
    profiles.set(account.id, accountProfile(
      account,
      dynamicAccounts.get(account.id) || {},
      competitiveCompanies.get(account.id) || null,
      legacyByCanonicalId.get(account.id) || {},
      executivePages.get(account.id) || null,
    ));
  }
  for (const supplier of accountModel.suppliers || []) {
    if (profiles.has(supplier.id)) continue;
    const synthetic = {
      id: supplier.id,
      company: supplier.label,
      aliases: supplier.aliases || [],
      layer: "memory-supplier",
      group: "memory-supplier",
      sourceIds: supplier.sourceIds || [],
      pain: competitiveCompanies.get(supplier.id)?.decision || "고객별 HBM·DRAM·NAND 공급 포지션 변화",
      memory: competitiveCompanies.get(supplier.id)?.portfolio || "HBM · DRAM · NAND",
      gate: "Customer Qualification · Yield · Capacity · Margin",
      relationship: competitiveCompanies.get(supplier.id)?.position || "계정별 공급 관계 추적",
      accent: supplier.id === "skhynix" ? "#008b83" : supplier.id === "samsung" ? "#2458a6" : supplier.id === "micron" ? "#7b57c9" : "#b66032",
    };
    profiles.set(supplier.id, accountProfile(
      synthetic,
      dynamicAccounts.get(supplier.id) || {},
      competitiveCompanies.get(supplier.id) || null,
      legacyByCanonicalId.get(supplier.id) || {},
      executivePages.get(supplier.id) || null,
    ));
  }
  for (const company of competitiveCompanies.values()) {
    if (profiles.has(company.id)) continue;
    const synthetic = {
      id: company.id,
      company: company.company,
      aliases: [company.company],
      layer: company.layer,
      group: "oem-odm-priority",
      sourceIds: [],
      demandClass: company.demandClass || "rack-platform",
      chip: company.portfolio || company.systemRole || company.role,
      pain: company.pain || company.position,
      memory: company.memoryOption || company.portfolio,
      gate: company.decision || "Qualification · Volume",
      relationship: company.collaborationValue || company.position,
      buyingCriteria: company.buyingCriteria || [],
      baseline: company.baseline || [],
      stage: company.stage || { id: "STRATEGIC_HYPOTHESIS", label: "협력 후보 · 검증 전" },
      accent: company.accent || "#315b7a",
    };
    profiles.set(company.id, accountProfile(
      synthetic,
      dynamicAccounts.get(company.id) || {},
      company,
      legacyByCanonicalId.get(company.id) || {},
      executivePages.get(company.id) || null,
    ));
  }
  for (const [id, legacy] of legacyByCanonicalId.entries()) {
    if (!profiles.has(id)) profiles.set(id, legacyProfile(id, legacy));
  }
  const sourceCompanies = new Map();
  for (const source of sourceCatalog.sources || []) {
    if (!source.company?.id) continue;
    const current = sourceCompanies.get(source.company.id) || { company: {}, sources: [] };
    current.company = { ...current.company, ...Object.fromEntries(Object.entries(source.company).filter(([, value]) => value != null && value !== "")) };
    current.sources.push(source);
    sourceCompanies.set(source.company.id, current);
  }
  for (const [id, entry] of sourceCompanies.entries()) {
    if (!profiles.has(id)) profiles.set(id, sourceCompanyProfile(id, entry.company, entry.sources));
  }
  const orderedProfiles = [...profiles.values()].map((profile) => profile.accountBrief ? profile : {
    ...profile,
    accountBrief: accountBrief(
      { layer: profile.layer },
      {},
      profile.overview || {},
      profile.memoryLens || {},
      profile.chipLens || {},
      profile.dataCenterLens || {},
    ),
  }).sort((a, b) => {
    const order = [
      "asic-partner", "end-customer", "foundry-package", "memory-supplier",
      "oem-tier-1", "oem-tier-2", "oem-tier-3",
      "semiconductor-ecosystem",
    ];
    return order.indexOf(a.layer) - order.indexOf(b.layer) || a.name.localeCompare(b.name, "en");
  });
  return {
    schemaVersion: "1.0",
    runId,
    generatedAt,
    automation: {
      registry: "data/accounts.json",
      companyFacts: "data/company-intelligence.json",
      evidence: "data/source-catalog.json + verified customer portfolio",
      refresh: "crawl publish + client artifact refresh",
      failClosed: true,
    },
    profiles: orderedProfiles,
  };
}
