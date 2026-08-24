import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (name) => JSON.parse(readFileSync(resolve(root, "data", name), "utf8"));

const accountModel = readJson("accounts.json");
const sourceCatalog = readJson("source-catalog.json");
const legacyIntelligence = readJson("company-intelligence.json");

const layerLabels = Object.freeze({
  "end-customer": "Big Tech · Hyperscaler",
  "asic-partner": "ASIC · XPU Design Partner",
  "foundry-package": "Foundry · Advanced Packaging",
  "memory-supplier": "Memory Supplier",
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

const safeEvidence = (item = {}) => item?.url ? {
  title: item.title || "공개 근거",
  source: item.source || "원문",
  sourceClass: item.sourceClass || "public",
  url: item.url,
  date: item.date || item.asOf || "",
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

function accountProfile(account = {}, dynamic = {}, competitive = null, legacy = {}) {
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
  return {
    id: account.id,
    name: account.company,
    nameKo: legacy.nameKo || account.company,
    aliases: profileAliases(account, legacy),
    autoLinkAliases: autoLinkAliases(account, legacy),
    layer: account.layer || "end-customer",
    layerLabel: layerLabels[account.layer] || account.layer || "Company",
    group: account.group || "",
    accent: account.accent || "#0b7189",
    summary: legacy.summary || competitive?.position || account.relationship || "메모리·칩·데이터센터 관점의 공개 정보 기반 기업 프로필",
    officialUrl: legacy.officialUrl || resolveSources(sourceIds)[0]?.url || "",
    verifiedAt: legacy.verifiedAt || dynamic.evidence?.asOf || "",
    overview: {
      role: competitive?.role || (account.layer === "asic-partner" ? "XPU Architecture · Cost · Qualification" : "AI Chip Roadmap · Workload · Buying Criteria"),
      platform: competitive?.portfolio || account.chip || "공개 확인 필요",
      stage: plainStage(dynamic.chipStage || dynamic.stage || account.stage),
      relationship: competitive?.position || account.relationship || "공개 관계 확인 필요",
    },
    memoryLens: {
      pain: account.pain || "공개 Workload 신호 확인 필요",
      proposal: account.memory || "Requirement Lock 우선",
      gate: account.gate || "Qualification · TCO · Capacity",
      buyingCriteria: account.buyingCriteria || [],
      baseline: account.baseline || [],
      painAxes,
      supplierRelations,
      decisionFocus: legacy.decisionFocus || [],
    },
    chipLens: {
      primaryChip: account.chip || "공개 확인 필요",
      portfolio: chipPortfolio,
      generations: account.generations || [],
      generationProgression: dynamic.generationProgression || null,
      partner: account.xpuEcosystem || null,
      servesAccounts: (account.servesAccounts || []).map((id) => {
        const target = (accountModel.accounts || []).find((item) => item.id === id);
        return target ? { id, company: target.company, chip: target.chip } : { id, company: id };
      }),
    },
    dataCenterLens: {
      demandClass: account.demandClass || "ecosystem",
      workloads: unique(chipPortfolio.map((item) => item.workload).filter(Boolean)),
      systemBottleneck: account.pain || "공개 Workload 신호 확인 필요",
      architectureAction: account.memory || "Memory Requirement Matrix 설계",
      executionGate: account.gate || "동일 Workload·SLO 기반 검증",
      operatingQuestion: account.broadcomStrategy?.accountQuestion || competitive?.decision || account.relationship || "고객 Workload와 Memory TCO를 같은 기준으로 검증",
    },
    ecosystem: {
      partner: account.xpuEcosystem || null,
      servesAccounts: (account.servesAccounts || []).map((id) => ({ id, company: (accountModel.accounts || []).find((item) => item.id === id)?.company || id })),
      supplierRelations,
    },
    organization: legacy.organization || [],
    priorities: legacy.officialPriorities || [],
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
    ecosystem: { partner: null, servesAccounts: [], supplierRelations: [] },
    organization: legacy.organization || [],
    priorities: legacy.officialPriorities || [],
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
    ecosystem: { partner: null, servesAccounts: [], supplierRelations: [] },
    organization: [], priorities: [], evidence: [], sources: compactSources,
  };
}

export function buildCompanyDirectory({ siteContentExtended = {}, runId = null, generatedAt = null } = {}) {
  const portfolio = siteContentExtended?.strategyBoard?.customerPortfolio || {};
  const dynamicAccounts = new Map((portfolio.accounts || []).map((account) => [account.id, account]));
  const competitiveCompanies = new Map((portfolio.competitiveDynamics?.companies || []).map((company) => [company.id, company]));
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
  const orderedProfiles = [...profiles.values()].sort((a, b) => {
    const order = ["asic-partner", "end-customer", "foundry-package", "memory-supplier", "semiconductor-ecosystem"];
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
