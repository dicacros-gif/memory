import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSourceCatalogSnapshot, catalogSourceForUrl, loadSourceCatalog } from "./source-catalog.mjs";
import { executiveBulletCopy } from "./executive-copy.mjs";
import { normalizeKoreanTerminology } from "./translation-pipeline.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const model = Object.freeze(JSON.parse(readFileSync(resolve(root, "data", "site-content-model.json"), "utf8")));
const accountModel = Object.freeze(JSON.parse(readFileSync(resolve(root, "data", "accounts.json"), "utf8")));
const sourceCatalog = loadSourceCatalog();
const siteMarkup = readFileSync(resolve(root, "index.html"), "utf8");

const LANDING_SECTION_IDS = new Set([
  "home", "departmentDecisionQueue", "keyAccounts", "decision-lab", "decision-automation", "initiatives",
  "competencies", "ai-strategy", "pain-framework", "solutions", "ai-factory-system",
  "aiFactoryKpiTree", "workload-optimization", "ragOperatingModel",
  "workload-map", "memory-fabric", "insights", "execution-evidence", "businessFreshnessBoard",
  "partners", "deep-cases", "macro", "team-operating-model",
]);
const MARKET_SECTION_PATTERN = /price|market|equity|number|projection|demand|benchmark|investment|capital/i;
const SIGNAL_SECTION_PATTERN = /news|community|china|talent|policy|deep-dive|categories|response/i;

function buildSiteAutomation({ runId = null, generatedAt = null, sourceCoverage = {} } = {}) {
  const sectionIds = [...siteMarkup.matchAll(/<section\b[^>]*\bid=["']([^"']+)["']/gi)]
    .map((match) => match[1])
    .filter((id, index, list) => id && list.indexOf(id) === index);
  const landing = sectionIds.filter((id) => LANDING_SECTION_IDS.has(id));
  const quant = sectionIds.filter((id) => !LANDING_SECTION_IDS.has(id) && MARKET_SECTION_PATTERN.test(id));
  const live = sectionIds.filter((id) => !LANDING_SECTION_IDS.has(id) && !MARKET_SECTION_PATTERN.test(id) && SIGNAL_SECTION_PATTERN.test(id));
  const siteContent = sectionIds.filter((id) => !quant.includes(id) && !live.includes(id));
  return {
    schemaVersion: "1.0",
    status: sectionIds.length ? "all-sections-bound" : "unavailable",
    runId,
    generatedAt,
    totalSections: sectionIds.length,
    boundSections: sectionIds.length,
    refresh: {
      eventFirst: true,
      safetyPollHours: Number(sourceCoverage.scheduleHours || sourceCatalog.refreshPolicy.scheduleHours),
      browserRecheckMinutes: Number(sourceCoverage.browserRecheckMinutes || sourceCatalog.refreshPolicy.browserRecheckMinutes),
      incrementalReindex: true,
      atomicManifest: true,
      failClosed: true,
    },
    lanes: {
      framework: "versioned-approved-model",
      evidence: "catalog-crawl-and-incremental-reindex",
      decision: "verified-site-content-generation",
      delivery: "atomic-manifest-and-browser-recheck",
    },
    sectionIds,
    bindingGroups: { landing, siteContent, live, quant },
  };
}

const directUrl = (value = "") => /^https?:\/\//i.test(String(value || "")) && !/news\.google\.com/i.test(String(value || ""));
const compact = (value = "", limit = 180) => {
  const text = normalizeKoreanTerminology(executiveBulletCopy(String(value || "")))
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(1, limit - 1)).trimEnd()}…`;
};
const canonicalExecutiveKey = (value = "") => compact(value, 500)
  .toLocaleLowerCase("ko-KR")
  .replace(/[^\p{L}\p{N}]+/gu, "");
const dedupeExecutiveList = (items = [], seen = new Set()) => {
  const unique = [];
  let suppressed = 0;
  for (const item of items || []) {
    const value = compact(item, 220);
    const key = canonicalExecutiveKey(value);
    if (!key || seen.has(key)) {
      suppressed += 1;
      continue;
    }
    seen.add(key);
    unique.push(value);
  }
  return { items: unique, suppressed };
};
const publishedAt = (item = {}, fallback = null) => item.publishedAt || item.date || item.observedAt || item.crawledAt || fallback || null;
const normalizeDisplayPayload = (value) => {
  if (typeof value === "string") return normalizeKoreanTerminology(executiveBulletCopy(value));
  if (Array.isArray(value)) return value.map(normalizeDisplayPayload);
  if (value && typeof value === "object") return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, normalizeDisplayPayload(item)]),
  );
  return value;
};
const sourceClass = (item = {}) => item.sourceClass || item.verification?.sourceClass || "unclassified";
const evidenceLevel = (item = {}) => item.evidenceLevel || item.verification?.evidenceLevel || item.verification?.label || "Watch";
const briefLatest = (brief = {}, fallbackAt = null) => {
  const latest = brief.latest || {};
  return {
    title: compact(latest.title || brief.label || "최신 근거 확인 필요", 150),
    summary: compact(latest.summary || brief.insight || "검증된 최신 근거가 연결될 때 자동 갱신됩니다.", 260),
    source: compact(latest.source || "출처 확인 필요", 70),
    url: directUrl(latest.url) ? latest.url : "",
    publishedAt: publishedAt(latest, fallbackAt),
    evidenceLevel: evidenceLevel(latest),
    sourceClass: sourceClass(latest),
  };
};

function latestPartnerSignal(payload = {}, fallback = {}) {
  const partnerTerms = /partner|alliance|collabor|cooperation|co-design|mou|loi|partnership|teams? up|expand\w* with|협력|파트너|공동|제휴|연합|동맹/i;
  const aiMemoryTerms = /memory|hbm|dram|nand|ssd|cxl|ai|accelerator|data.?center|메모리|반도체|스토리지|데이터센터/i;
  const classScore = { official: 18, filing: 18, research: 12, "authoritative-media": 9, "general-media": 4 };
  const candidates = (payload.news || []).map((item) => {
    const title = item.titleKo || item.title || "";
    const summary = item.summaryKo || item.summary || "";
    const text = `${title} ${item.originalTitle || ""} ${summary}`;
    const url = item.sourceUrl || item.link || "";
    if (!directUrl(url) || !partnerTerms.test(text) || !aiMemoryTerms.test(text)) return null;
    const date = publishedAt(item, payload.updatedAt);
    const timestamp = Date.parse(String(date || ""));
    return {
      item,
      title,
      summary,
      url,
      date,
      score: (classScore[sourceClass(item)] || 0) + (Number.isFinite(timestamp) ? timestamp / 8.64e7 / 100000 : 0),
    };
  }).filter(Boolean).sort((a, b) => b.score - a.score)[0];

  if (!candidates) return {
    title: fallback.title || "최신 파트너 근거 확인 필요",
    summary: fallback.summary || "검증된 파트너 신호가 수집되면 자동 갱신됩니다.",
    source: fallback.source || "검증 대기",
    url: fallback.url || "",
    publishedAt: fallback.publishedAt || payload.updatedAt || null,
    evidenceLevel: fallback.evidenceLevel || "Watch",
    sourceClass: fallback.sourceClass || "unclassified",
  };

  const item = candidates.item;
  return {
    title: compact(candidates.title, 170),
    summary: compact(candidates.summary, 300),
    source: compact(item.source || item.publisher || "원문", 70),
    url: candidates.url,
    publishedAt: candidates.date,
    evidenceLevel: evidenceLevel(item),
    sourceClass: sourceClass(item),
  };
}

function strategyBoardTopicMatches(text = "", topics = []) {
  const haystack = String(text || "").toLocaleLowerCase("en-US");
  return (topics || []).filter((topic) => (topic.terms || []).some((term) => haystack.includes(String(term || "").toLocaleLowerCase("en-US"))));
}

function buildStrategyBoard(payload = {}, generatedAt = null, decisionIntelligence = {}, strategyAccountIntelligence = {}) {
  const board = model.strategyBoard || {};
  const reportPolicy = board.reportPolicy || {};
  const topics = reportPolicy.topics || [];
  const limit = Math.max(1, Number(reportPolicy.limit || 6));
  const freshDays = Math.max(1, Number(reportPolicy.freshDays || 120));
  const generatedMs = Date.parse(String(generatedAt || ""));
  const sourceScore = { official: 50, filing: 48, research: 38, "authoritative-media": 30, "general-media": 12, unclassified: 0 };
  const seen = new Set();
  const reports = (payload.news || []).map((item) => {
    const title = item.titleKo || item.title || "";
    const summary = item.summaryKo || item.summary || "";
    const matches = strategyBoardTopicMatches(`${title} ${item.originalTitle || ""} ${summary}`, topics);
    const url = item.sourceUrl || item.link || "";
    if (!matches.length || !directUrl(url)) return null;
    const canonical = String(url).replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();
    if (!canonical || seen.has(canonical)) return null;
    seen.add(canonical);
    const date = publishedAt(item, generatedAt);
    const timestamp = Date.parse(String(date || ""));
    const ageDays = Number.isFinite(generatedMs) && Number.isFinite(timestamp)
      ? Math.max(0, Math.round((generatedMs - timestamp) / 86400000))
      : null;
    const itemSourceClass = sourceClass(item);
    return {
      title: compact(title, 128),
      summary: compact(summary, 180),
      url,
      source: compact(item.source || item.publisher || "원문", 64),
      publishedAt: date,
      sourceClass: itemSourceClass,
      evidenceLevel: evidenceLevel(item),
      topics: matches.map((topic) => ({ id: topic.id, label: topic.label })),
      freshness: ageDays == null ? "unknown" : ageDays <= freshDays ? "fresh" : "stale",
      ageDays,
      score: (sourceScore[itemSourceClass] || 0)
        + (ageDays == null ? 0 : Math.max(0, freshDays - ageDays) / freshDays * 20)
        + matches.length * 4,
    };
  }).filter(Boolean).sort((a, b) => b.score - a.score || String(b.publishedAt || "").localeCompare(String(a.publishedAt || "")))
    .slice(0, limit)
    .map(({ score, ...item }) => item);

  const claimEvents = decisionIntelligence.claimEvents?.events || [];
  const sourceById = new Map((sourceCatalog.sources || []).map((source) => [source.id, source]));
  const bindClaimEvidence = (item = {}) => {
    const { claimRuleIds = [], sourceIds = [], matchTerms = [], ...displayItem } = item;
    const ruleIds = new Set(claimRuleIds);
    const sourceIdSet = new Set(sourceIds);
    const normalizedTerms = matchTerms.map((term) => String(term || "").toLocaleLowerCase("en-US")).filter(Boolean);
    const candidates = claimEvents.filter((event) => ruleIds.has(event.ruleId))
      .filter((event) => !sourceIdSet.size || sourceIdSet.has(event.sourceId))
      .filter((event) => !normalizedTerms.length || normalizedTerms.some((term) => `${event.entity?.label || ""} ${event.product?.label || ""} ${event.evidenceSpan || ""}`.toLocaleLowerCase("en-US").includes(term)))
      .sort((left, right) => Number(right.isCurrentStage) - Number(left.isCurrentStage)
        || Number(right.claimType === "verified-fact") - Number(left.claimType === "verified-fact")
        || String(right.asOf || right.publishedAt || "").localeCompare(String(left.asOf || left.publishedAt || "")));
    const current = candidates[0] || null;
    const fallbackSource = sourceIds.map((id) => sourceById.get(id)).find((source) => directUrl(source?.url));
    const fallbackStatus = fallbackSource?.sourceClass === "research"
      ? "research-monitoring"
      : fallbackSource?.sourceClass === "official"
        ? "official-monitoring"
        : "monitoring";
    const fallbackLabel = fallbackSource?.sourceClass === "research"
      ? "RESEARCH MONITOR"
      : fallbackSource?.sourceClass === "official"
        ? "OFFICIAL SOURCE MONITOR"
        : "SOURCE MONITORING";
    return {
      ...displayItem,
      evidence: current ? {
        status: current.claimType === "verified-fact" ? "official-fact" : "market-estimate",
        label: current.claimType === "verified-fact" ? "OFFICIAL FACT" : "MARKET ESTIMATE",
        stage: current.stage?.id || current.stage || "DISCLOSED",
        source: compact(current.source || "원문", 60),
        url: directUrl(current.sourceUrl) ? current.sourceUrl : "",
        asOf: current.asOf || current.publishedAt || null,
      } : {
        status: fallbackStatus,
        label: fallbackLabel,
        source: fallbackSource?.name || "",
        url: fallbackSource?.url || "",
        asOf: null,
      },
    };
  };
  const tech = board.tech || {};
  const customerPortfolio = {
    ...(board.customerPortfolio || {}),
    eyebrow: accountModel.title || "ACCOUNT INTELLIGENCE",
    title: "Key Account Roadmap → Next Memory → Deal Gate",
    description: accountModel.description || "고객별 Chip Roadmap을 Pain Point·Memory Requirement·계약 Gate로 분리",
    disclosure: accountModel.evidencePolicy || "공급 관계와 계약 조건은 직접 근거 전까지 미확인",
    missionModel: accountModel.missionModel || {},
    pillars: accountModel.pillars || [],
    asicPortfolio: accountModel.asicPortfolio || {},
    broadcomEcosystem: accountModel.broadcomEcosystem || {},
    partnerEcosystem: accountModel.partnerEcosystem || {},
    layerModel: accountModel.layerModel || {},
    painTaxonomy: accountModel.painTaxonomy || [],
    whyLostTaxonomy: accountModel.whyLostTaxonomy || [],
    projects: accountModel.projects || [],
    groups: accountModel.groups || [],
    accounts: accountModel.accounts || [],
    mixTracker: {
      label: "GPU · ASIC CUSTOMER PORTFOLIO",
      status: "measured-crawl-separate-from-estimate",
      display: strategyAccountIntelligence.demandMix?.measurement || "동일 크롤 Corpus 내 계정 언급 비중",
      decision: "크롤 실측과 제3자 수요 추정은 분리 표기",
    },
    contractGate: {
      label: "LTA · PREPAYMENT · CAPACITY",
      fields: accountModel.dealSchema?.fields || [],
      ruleId: accountModel.dealSchema?.ruleId || "contract-structure",
      fallback: accountModel.dealSchema?.fallback || "공식 계약 조건 미공개",
    },
  };
  const accounts = (customerPortfolio.accounts || []).map((item) => {
    const accountSignal = strategyAccountIntelligence.accounts?.[item.id] || {};
    const rawCustomHbmStage = accountSignal.customHbmStage || item.customHbmStage || { id: "UNVERIFIED", label: "고객 제안 단계 검토", sourceId: null };
    const customHbmStage = {
      ...rawCustomHbmStage,
      label: /근거 미관측|crawl/i.test(String(rawCustomHbmStage.label || ""))
        ? "고객 제안 단계 검토"
        : rawCustomHbmStage.label,
    };
    const bound = bindClaimEvidence({
      ...item,
      matchTerms: item.aliases || [],
      stage: customHbmStage.label,
    });
    return {
      ...bound,
      focus: item.focus !== false,
      demandClass: item.demandClass || "other",
      layer: item.layer || "end-customer",
      servesAccounts: item.servesAccounts || [],
      buyingCriteria: item.buyingCriteria || [],
      mentions: Number(accountSignal.mentions || 0),
      sourceCount: Number(accountSignal.sourceCount || 0),
      officialEvidenceCount: Number(accountSignal.officialEvidenceCount || 0),
      weekly: accountSignal.weekly || [],
      painAxes: accountSignal.painAxes || [],
      whyLost: accountSignal.whyLost || [],
      generationProgression: accountSignal.generationProgression || { status: "insufficient", generations: [] },
      evidenceStream: accountSignal.evidence || [],
      chipStage: item.stage?.label || item.stage?.id || "Chip Roadmap 확인 필요",
      baseline: (item.baseline || []).map((metric) => {
        const source = sourceById.get(metric.sourceId);
        return { ...metric, source: source ? { id: source.id, name: source.name, url: source.url } : null };
      }),
      chipPortfolio: (item.chipPortfolio || []).map((chip) => {
        const source = sourceById.get(chip.sourceId);
        return { ...chip, source: source ? { id: source.id, name: source.name, url: source.url, sourceClass: source.sourceClass } : null };
      }),
      xpuEcosystem: item.xpuEcosystem ? {
        ...item.xpuEcosystem,
        source: sourceById.get(item.xpuEcosystem.sourceId) || null,
      } : null,
      broadcomStrategy: item.broadcomStrategy ? {
        ...item.broadcomStrategy,
        source: sourceById.get(item.broadcomStrategy.sourceId) || null,
      } : null,
      stageLedger: {
        stage: customHbmStage.id,
        label: customHbmStage.label,
        source: sourceById.get(customHbmStage.sourceId) || null,
      },
    };
  });
  const groupCounts = new Map();
  for (const account of accounts) groupCounts.set(account.group, Number(groupCounts.get(account.group) || 0) + 1);
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const priorityAccountIds = customerPortfolio.asicPortfolio?.priorityAccountIds || [];
  const priorityAsicAccounts = priorityAccountIds.map((id) => accountById.get(id)).filter(Boolean);
  const broadcomAccountIds = customerPortfolio.broadcomEcosystem?.accountIds || [];
  const broadcomAccounts = broadcomAccountIds.map((id) => accountById.get(id)).filter((account) => account?.broadcomStrategy);
  const partnerAccountIds = customerPortfolio.partnerEcosystem?.partnerAccountIds
    || (strategyAccountIntelligence.partnerRollups || []).map((item) => item.partnerId);
  const partnerEcosystemPartners = partnerAccountIds.map((partnerId) => {
    const partner = accountById.get(partnerId);
    if (!partner) return null;
    const rollup = (strategyAccountIntelligence.partnerRollups || []).find((item) => item.partnerId === partnerId) || null;
    return {
      id: partner.id,
      company: partner.company,
      chip: partner.chip,
      accent: partner.accent,
      buyingCriteria: partner.buyingCriteria || [],
      rollup: rollup ? { topPainAxes: rollup.topPainAxes || [] } : null,
      accounts: (partner.servesAccounts || []).map((id) => accountById.get(id)).filter(Boolean).map((account) => ({
        id: account.id,
        company: account.company,
        chip: account.chip,
        accent: account.accent,
        pain: account.pain,
        memory: account.memory,
        gate: account.gate,
      })),
    };
  }).filter(Boolean);
  const projects = (customerPortfolio.projects || []).map((project) => {
    const projectAccounts = (project.accounts || []).map((id) => accountById.get(id)).filter(Boolean);
    const signalTerms = (project.signalTerms || []).map((term) => String(term || "").toLocaleLowerCase()).filter(Boolean);
    const selectedInsight = projectAccounts.flatMap((account) => (account.evidenceStream || []).map((item) => ({
      ...item,
      account: account.company,
    }))).filter((item) => {
      if (!signalTerms.length) return false;
      const haystack = `${item.title || ""} ${item.summary || ""} ${item.source || ""}`.toLocaleLowerCase();
      const matchedTerms = signalTerms.filter((term) => haystack.includes(term));
      return matchedTerms.length >= Math.min(2, signalTerms.length);
    }).sort((left, right) => String(right.date || "").localeCompare(String(left.date || "")))[0] || null;
    return {
      ...project,
      accountLabels: projectAccounts.map((account) => account.company),
      selectedInsight,
    };
  });
  const contractEvent = claimEvents.filter((event) => event.ruleId === customerPortfolio.contractGate?.ruleId)
    .filter((event) => /(?:LTA|long[- ]term|prepay|binding volume|contract|장기|선급|계약)/i.test(`${event.entity?.label || ""} ${event.product?.label || ""} ${event.evidenceSpan || ""}`))
    .sort((left, right) => String(right.asOf || right.publishedAt || "").localeCompare(String(left.asOf || left.publishedAt || "")))[0] || null;
  const dynamicsLayers = [
    { id: "end-customer", index: "01", label: "BIG TECH / HYPERSCALER", role: "AI Chip Roadmap · Workload · Buying Criteria" },
    { id: "asic-partner", index: "02", label: "ASIC DESIGN PARTNER", role: "XPU Architecture · Cost · Qualification" },
    { id: "foundry-package", index: "03", label: "FOUNDRY & PACKAGE", role: "Logic Node · CoWoS · Ramp" },
    { id: "memory-supply", index: "04", label: "MEMORY SUPPLIER", role: "HBM · AI-D · AI-N · Capacity" },
  ];
  const supplierProfiles = new Map([
    ["skhynix", { portfolio: "Custom HBM · AI-D · AI-N", position: "AI Memory 공동설계 · Full-stack Memory", decision: "계정별 Architecture Lock · LTA · Capacity" }],
    ["samsung", { portfolio: "HBM · Foundry · Package", position: "로직·메모리·패키징 통합 경쟁", decision: "HBM4 Ramp · Yield · Qualification" }],
    ["micron", { portfolio: "HBM · DRAM · NAND", position: "미국 공급망 · 효율 경쟁", decision: "Customer Qualification · Supply Mix" }],
    ["cxmt", { portfolio: "DRAM · LPDDR", position: "중국 범용 메모리 경쟁", decision: "승인 · 캐파 · Contract Price" }],
  ]);
  const dynamicsNodes = [
    ...accounts.filter((account) => ["end-customer", "asic-partner", "foundry-package"].includes(account.layer)).map((account) => ({
      id: account.id,
      company: account.company,
      layer: account.layer,
      role: dynamicsLayers.find((layer) => layer.id === account.layer)?.role || "Value Chain",
      portfolio: account.chip || account.memory || "",
      position: account.relationship || account.pain || "",
      decision: account.gate || "",
      pain: account.pain || "공개 Workload 병목 확인 필요",
      memoryOption: account.memory || "Requirement Lock 우선",
      buyingCriteria: account.buyingCriteria || [],
      baseline: account.baseline || [],
      stage: account.stage || null,
      demandClass: account.demandClass || "ecosystem",
      servesAccounts: (account.servesAccounts || []).map((id) => accountById.get(id)?.company).filter(Boolean),
      latestSignal: (account.evidenceStream || [])
        .filter((item) => item?.title)
        .sort((left, right) => String(right.date || "").localeCompare(String(left.date || "")))[0] || null,
      evidenceCount: Number((account.evidenceStream || []).length),
      accent: account.accent || "#255ba8",
      source: account.evidence?.url ? { name: account.evidence.source || "원문", url: account.evidence.url } : null,
    })),
    ...(accountModel.suppliers || []).map((supplier) => {
      const profile = supplierProfiles.get(supplier.id) || {};
      const source = (supplier.sourceIds || []).map((id) => sourceById.get(id)).find((item) => directUrl(item?.url));
      return {
        id: supplier.id,
        company: supplier.label,
        layer: "memory-supply",
        role: dynamicsLayers.find((layer) => layer.id === "memory-supply")?.role,
        portfolio: profile.portfolio || "Memory Portfolio",
        position: profile.position || "Memory Supply",
        decision: profile.decision || "Supply · Qualification · Economics",
        pain: supplier.id === "skhynix" ? "고객별 Workload·수율·Capacity 동시 최적화" : "시장·가격·Qualification 경쟁 변화 추적",
        memoryOption: profile.portfolio || "Memory Portfolio",
        buyingCriteria: ["성능", "수율", "공급 안정성", "계약 경제성"],
        baseline: [],
        stage: { id: "MONITORING", label: "공급 구도 추적" },
        demandClass: "supplier",
        servesAccounts: [],
        latestSignal: null,
        evidenceCount: 0,
        accent: supplier.id === "skhynix" ? "#0b625f" : supplier.id === "samsung" ? "#255ba8" : supplier.id === "micron" ? "#62429b" : "#8a5700",
        source: source ? { name: source.name, url: source.url } : null,
      };
    }),
  ];
  const dynamicsNodeById = new Map(dynamicsNodes.map((node) => [node.id, node]));
  const dynamicsRelations = [];
  const dynamicsRelationKeys = new Set();
  const addDynamicsRelation = (relation) => {
    if (!dynamicsNodeById.has(relation.from) || !dynamicsNodeById.has(relation.to)) return;
    const key = `${relation.type}:${relation.from}:${relation.to}`;
    if (dynamicsRelationKeys.has(key)) return;
    dynamicsRelationKeys.add(key);
    dynamicsRelations.push({ id: key, ...relation });
  };
  for (const partner of accounts.filter((account) => Array.isArray(account.servesAccounts) && account.servesAccounts.length)) {
    for (const targetId of partner.servesAccounts) {
      const target = accountById.get(targetId);
      if (!target) continue;
      addDynamicsRelation({
        type: "partnership",
        from: partner.id,
        to: targetId,
        title: `${partner.company} × ${target.company}`,
        detail: partner.layer === "asic-partner" ? "XPU 설계 · Memory 선정 · Qualification 공동 실행" : "Logic Node · Package · Ramp 실행 연계",
        status: partner.evidence?.status || "monitoring",
        source: partner.evidence?.url ? { name: partner.evidence.source || "원문", url: partner.evidence.url } : null,
      });
    }
  }
  for (const relation of accountModel.supplierRelations || []) {
    if (!relation.status || /해당 없음|unconfirmed/i.test(relation.status)) continue;
    const supplier = dynamicsNodeById.get(relation.supplierId);
    const customer = dynamicsNodeById.get(relation.accountId);
    const source = sourceById.get(relation.sourceId);
    if (!supplier || !customer) continue;
    addDynamicsRelation({
      type: "supply",
      from: relation.supplierId,
      to: relation.accountId,
      title: `${supplier.company} → ${customer.company}`,
      detail: relation.note || relation.status,
      status: relation.status,
      source: source && directUrl(source.url) ? { name: source.name, url: source.url } : null,
    });
  }
  for (const competitor of (accountModel.suppliers || []).filter((supplier) => supplier.id !== "skhynix")) {
    const source = (competitor.sourceIds || []).map((id) => sourceById.get(id)).find((item) => directUrl(item?.url));
    addDynamicsRelation({
      type: "competition",
      from: "skhynix",
      to: competitor.id,
      title: `SK hynix ↔ ${competitor.label}`,
      detail: supplierProfiles.get(competitor.id)?.position || "Memory Portfolio · Qualification · Supply 경쟁",
      status: "competitive-monitor",
      source: source ? { name: source.name, url: source.url } : null,
    });
  }
  const tsmcSource = sourceById.get(accountModel.baseDieStrategy?.foundryDependency?.sourceId || "tsmc-3dfabric");
  addDynamicsRelation({
    type: "investment",
    from: "skhynix",
    to: "tsmc",
    title: "SK hynix → TSMC Logic Base Die",
    detail: "공정 Slot · CoWoS Capacity · 공동개발 투자 의사결정 추적",
    status: "capacity-watch",
    source: tsmcSource && directUrl(tsmcSource.url) ? { name: tsmcSource.name, url: tsmcSource.url } : null,
  });
  const dynamicsCompanies = dynamicsNodes.map((node) => ({
    ...node,
    relationCount: dynamicsRelations.filter((relation) => relation.from === node.id || relation.to === node.id).length,
  }));
  const dynamicsRelationCounts = dynamicsRelations.reduce((counts, relation) => {
    counts[relation.type] = Number(counts[relation.type] || 0) + 1;
    return counts;
  }, {});
  const competitiveDynamics = {
    eyebrow: "COMPETITIVE DYNAMICS · VALUE CHAIN",
    title: "경쟁 · 파트너십 · 투자 · 공급 관계 지도",
    description: "고객 Roadmap부터 ASIC 설계·파운드리·메모리 공급까지 의사결정 사슬 연결",
    updatedAt: generatedAt,
    types: [
      { id: "competition", label: "경쟁", count: Number(dynamicsRelationCounts.competition || 0) },
      { id: "partnership", label: "파트너십", count: Number(dynamicsRelationCounts.partnership || 0) },
      { id: "investment", label: "투자", count: Number(dynamicsRelationCounts.investment || 0) },
      { id: "supply", label: "공급", count: Number(dynamicsRelationCounts.supply || 0) },
    ],
    // Enrich once so the layered view and the flat company list share the same
    // relationCount. The layered nodes previously shipped without it, so every
    // company rendered "0 RELATIONS" in the value-chain map.
    layers: dynamicsLayers.map((layer) => ({
      ...layer,
      companies: dynamicsCompanies.filter((node) => node.layer === layer.id),
    })),
    companies: dynamicsCompanies,
    relations: dynamicsRelations,
  };
  return {
    schemaVersion: board.schemaVersion || "1.0",
    generatedAt,
    status: reports.length ? "evidence-connected" : "evidence-pending",
    tech: {
      ...tech,
      memoryMap: (tech.memoryMap || []).map(bindClaimEvidence),
    },
    customerPortfolio: {
      ...customerPortfolio,
      groups: (customerPortfolio.groups || []).map((group) => ({ ...group, accountCount: Number(groupCounts.get(group.id) || 0) })),
      accounts,
      asicPortfolio: {
        ...(customerPortfolio.asicPortfolio || {}),
        accounts: priorityAsicAccounts,
      },
      broadcomEcosystem: {
        ...(customerPortfolio.broadcomEcosystem || {}),
        accounts: broadcomAccounts,
        partner: accountById.get(customerPortfolio.broadcomEcosystem?.partnerAccountId || "broadcom") || null,
        rollup: (strategyAccountIntelligence.partnerRollups || []).find((item) => item.partnerId === (customerPortfolio.broadcomEcosystem?.partnerAccountId || "broadcom")) || null,
      },
      partnerEcosystem: {
        ...(customerPortfolio.partnerEcosystem || {}),
        partners: partnerEcosystemPartners,
      },
      competitiveDynamics,
      layerModel: {
        ...(customerPortfolio.layerModel || {}),
        summary: (customerPortfolio.layerModel?.layers || []).map((layer) => ({
          ...layer,
          accountIds: (strategyAccountIntelligence.layerSummary || []).find((item) => item.id === layer.id)?.accountIds
            || accounts.filter((account) => account.layer === layer.id).map((account) => account.id),
        })),
        partnerRollups: strategyAccountIntelligence.partnerRollups || [],
      },
      painTaxonomy: strategyAccountIntelligence.painTaxonomy || customerPortfolio.painTaxonomy || [],
      whyLostTaxonomy: strategyAccountIntelligence.whyLostTaxonomy || customerPortfolio.whyLostTaxonomy || [],
      executiveOnePagers: strategyAccountIntelligence.executiveOnePagers || [],
      projects,
      pillars: customerPortfolio.pillars || [],
      verifiedAccounts: accounts.filter((account) => account.evidence?.status === "official-fact").length,
      monitoredAccounts: accounts.length,
      focusAccounts: accounts.filter((account) => account.focus),
      demandMix: customerPortfolio.mixTracker,
      contractGate: {
        ...(customerPortfolio.contractGate || {}),
        evidence: contractEvent ? {
          status: contractEvent.claimType === "verified-fact" ? "official-fact" : "market-estimate",
          label: contractEvent.claimType === "verified-fact" ? "OFFICIAL FACT" : "MARKET ESTIMATE",
          source: compact(contractEvent.source || "원문", 60),
          url: directUrl(contractEvent.sourceUrl) ? contractEvent.sourceUrl : "",
          asOf: contractEvent.asOf || contractEvent.publishedAt || null,
        } : { status: "monitoring", label: "CONTRACT DISCLOSURE MONITOR" },
      },
      dealDashboard: strategyAccountIntelligence.deals || { status: "monitoring", events: [], schema: accountModel.dealSchema || {} },
      supplierMatrix: {
        ...(strategyAccountIntelligence.supplierMatrix || {}),
        suppliers: (accountModel.suppliers || []).map((supplier) => ({
          ...supplier,
          sources: (supplier.sourceIds || []).map((id) => sourceById.get(id)).filter(Boolean).map((source) => ({ id: source.id, name: source.name, url: source.url })),
        })),
        legend: accountModel.supplierRelationLegend || {},
        // Cell precedence: crawl-derived rows first, then the sourced relation
        // registry, then fail-closed "unconfirmed". Every registry cell carries
        // its claim tier (공식/보도/추적) and source so a reported relation is
        // never shown as a confirmed fact.
        rows: (strategyAccountIntelligence.supplierMatrix?.rows
          || accounts.filter((account) => account.focus).map((account) => ({
            accountId: account.id,
            cells: (accountModel.suppliers || []).map((supplier) => ({ accountId: account.id, supplierId: supplier.id, status: "unconfirmed", sourceId: null, asOf: null })),
          }))
        ).map((row) => ({
          ...row,
          // Crawl-derived evidence wins. Any cell still unconfirmed is enriched
          // from the sourced relation registry, tagged with its claim tier so a
          // reported relation is never displayed as a confirmed fact.
          cells: (row.cells || []).map((cell) => {
            const registryRelation = (accountModel.supplierRelations || [])
              .find((item) => item.accountId === row.accountId && item.supplierId === cell.supplierId);
            const relation = cell.status && cell.status !== "unconfirmed" ? cell : registryRelation;
            if (!relation) return { ...cell, claim: "watch", alerts: cell.alerts || [], latestAlert: cell.latestAlert || null };
            const source = sourceById.get(relation.sourceId) || null;
            return {
              ...cell,
              ...relation,
              status: relation.status || "unconfirmed",
              claim: relation.claim || "watch",
              claimLabel: (accountModel.supplierRelationLegend || {})[relation.claim || "watch"]?.label || "추적",
              note: relation.note || "",
              sourceId: relation.sourceId || null,
              source: source ? { id: source.id, name: source.name, url: source.url } : null,
              asOf: relation.asOf || null,
              alerts: cell.alerts || relation.alerts || [],
              latestAlert: cell.latestAlert || relation.latestAlert || null,
            };
          }),
        })),
      },
      baseDieStrategy: accountModel.baseDieStrategy ? {
        ...accountModel.baseDieStrategy,
        source: sourceById.get(accountModel.baseDieStrategy.sourceId) || null,
        foundryDependency: accountModel.baseDieStrategy.foundryDependency ? {
          ...accountModel.baseDieStrategy.foundryDependency,
          source: sourceById.get(accountModel.baseDieStrategy.foundryDependency.sourceId) || null,
        } : null,
        chipletTracking: accountModel.baseDieStrategy.chipletTracking ? {
          ...accountModel.baseDieStrategy.chipletTracking,
          source: sourceById.get(accountModel.baseDieStrategy.chipletTracking.sourceId) || null,
          accountLabels: (accountModel.baseDieStrategy.chipletTracking.accounts || [])
            .map((id) => accounts.find((account) => account.id === id)?.company).filter(Boolean),
        } : null,
      } : null,
      transformerMemory: accountModel.transformerMemory ? {
        ...accountModel.transformerMemory,
        sources: (accountModel.transformerMemory.sourceIds || [])
          .map((id) => sourceById.get(id))
          .filter(Boolean)
          .map((source) => ({
            id: source.id,
            name: source.name,
            url: source.url,
            sourceClass: source.sourceClass,
            tier: source.tier,
          })),
      } : null,
      competitiveFrame: (accountModel.suppliers || []).filter((supplier) => supplier.id !== "skhynix").map((supplier) => ({
        company: supplier.label,
        focus: supplier.id === "samsung" ? "HBM·Foundry·Package 통합" : supplier.id === "micron" ? "HBM 효율·미국 공급망" : "범용 DRAM·중국 고객 침투",
        gate: supplier.id === "cxmt" ? "DDR5/LPDDR 승인 · 캐파 · Contract Price" : "HBM4 Ramp · Yield · Customer Qualification",
        sources: (supplier.sourceIds || []).map((id) => sourceById.get(id)).filter(Boolean).map((source) => ({ id: source.id, name: source.name, url: source.url })),
      })),
      productMap: (strategyAccountIntelligence.productMap || accountModel.productMap || []).map((item) => ({
        ...item,
        accountLabels: (item.accounts || []).map((id) => accounts.find((account) => account.id === id)?.company).filter(Boolean),
        source: sourceById.get(item.sourceId) || null,
        status: "strategy-mapping",
      })),
      applicationSignals: strategyAccountIntelligence.applicationSignals || [],
      painAlerts: strategyAccountIntelligence.painAlerts || [],
      generationCandidates: strategyAccountIntelligence.generationCandidates || [],
      technologyOpportunities: strategyAccountIntelligence.technologyOpportunities || [],
      horizonPortfolio: strategyAccountIntelligence.horizonPortfolio || [],
      whatChanged: strategyAccountIntelligence.whatChanged || { windowDays: 7, items: [], recentIds: [], counts: {} },
      roadmap90d: strategyAccountIntelligence.roadmap90d || accountModel.roadmap90d || [],
    },
    partners: board.partners || {},
    playbooks: (board.playbooks || []).map(bindClaimEvidence),
    disclosure: board.disclosure || "전략 플레이북 · 공개 근거 기반 검증 가설",
    reports,
    reportPolicy: {
      limit,
      freshDays,
      topics: topics.map((topic) => ({ id: topic.id, label: topic.label, terms: topic.terms || [] })),
    },
    evidenceCount: reports.length,
    freshEvidenceCount: reports.filter((item) => item.freshness === "fresh").length,
  };
}

function buildOrganizationOperatingModel(insights = [], generatedAt = null, runId = null) {
  const operatingModel = model.organizationOperatingModel || {};
  const organizationSource = (sourceCatalog.sources || []).find((source) => source.id === operatingModel.sourceId) || null;
  const insightMap = new Map((insights || []).map((item) => [item.id, item]));
  const usedInsightIds = new Set();
  const usedSignalUrls = new Set();
  const fieldSeen = {
    inputs: new Set(),
    questions: new Set(),
    outputs: new Set(),
    kpis: new Set(),
  };
  let suppressedItems = 0;
  const workstreams = (operatingModel.workstreams || []).map((workstream) => {
    const candidates = (workstream.evidenceIds || [])
      .map((id) => insightMap.get(id))
      .filter((item) => item?.latest?.title && directUrl(item.latest?.url))
      .sort((a, b) => String(b.latest?.publishedAt || "").localeCompare(String(a.latest?.publishedAt || "")));
    const current = candidates.find((item) => !usedInsightIds.has(item.id) && !usedSignalUrls.has(item.latest.url));
    const fallbackSource = current ? null : (workstream.fallbackSourceIds || [])
      .map((id) => (sourceCatalog.sources || []).find((source) => source.id === id))
      .find((source) => directUrl(source?.url) && !usedSignalUrls.has(source.url));
    if (current?.id) usedInsightIds.add(current.id);
    const signalUrl = current?.latest?.url || fallbackSource?.url || null;
    if (signalUrl) usedSignalUrls.add(signalUrl);
    const meceFields = Object.fromEntries(Object.entries(fieldSeen).map(([field, seen]) => {
      const deduped = dedupeExecutiveList(workstream[field], seen);
      suppressedItems += deduped.suppressed;
      return [field, deduped.items];
    }));
    return {
      ...workstream,
      ...meceFields,
      currentSignal: current ? {
        title: compact(current.latest.title, 112),
        decision: compact(current.decision || current.implication, 126),
        source: compact(current.latest.source || "원문", 54),
        url: current.latest.url,
        publishedAt: current.latest.publishedAt || generatedAt,
        evidenceLevel: current.latest.evidenceLevel || "Watch",
      } : fallbackSource ? {
        title: compact(`${fallbackSource.name} · 공식 Baseline`, 112),
        decision: compact(workstream.mandate, 126),
        source: compact(fallbackSource.name || "공식 원문", 54),
        url: fallbackSource.url,
        publishedAt: generatedAt,
        evidenceLevel: "Official baseline",
      } : null,
    };
  });
  return {
    ...operatingModel,
    source: organizationSource,
    runId,
    generatedAt,
    workstreams,
    liveEvidenceCount: workstreams.filter((item) => item.currentSignal).length,
    automation: {
      taxonomy: "three-pillar-mece",
      duplicateSuppression: "canonical-field-key",
      duplicateCount: 0,
      suppressedItems,
      dynamicEvidence: true,
    },
  };
}

function buildInsight(brief = {}, fallbackAt = null) {
  const latest = briefLatest(brief, fallbackAt);
  return {
    id: brief.id || "brief",
    label: brief.label || "Memory Intelligence",
    evidenceCount: Number(brief.evidenceCount || 0),
    latest,
    fact: latest.summary,
    implication: compact(brief.insight || latest.summary, 250),
    decision: compact(brief.decision || "추가 검증 후 의사결정 안건으로 승격합니다.", 240),
    action: compact(brief.reversalKpi || "핵심 KPI와 출처가 바뀌면 결론을 재검토합니다.", 220),
    hypothesis: {
      status: brief.hypothesisVerifiedAt ? "verified" : "unverified",
      label: brief.hypothesisVerifiedAt ? "근거 검증 완료" : "근거 미검증",
      verifiedAt: brief.hypothesisVerifiedAt || null,
      scope: "전략 가설 · 고객 내부 Trace와 계약 조건 확인 전",
    },
  };
}

function buildCompetitors(quant = {}) {
  const automatedMetrics = quant.decisionIntelligence?.metrics?.latest || [];
  const entityId = (company = "") => /skhy|hynix|하이닉스/i.test(company)
    ? "skhynix"
    : /samsung|삼성/i.test(company)
      ? "samsung"
      : /micron|마이크론/i.test(company)
        ? "micron"
        : "";
  return (quant.marketStructure?.companies || [])
    .filter((company) => ["SKHY", "삼성전자", "마이크론"].includes(company?.company))
    .map((company) => {
      const metric = automatedMetrics.find((item) => item.metricId === "hbm-revenue-share" && item.entityId === entityId(company.company));
      const primarySource = metric?.sources?.[0] || null;
      return {
        company: company.company,
        // Volatile HBM figures are never read from baseline/shareMatrix.
        hbmShare: metric?.display || null,
        dramShare: company.dramShare2026 || company.dramShare2025 || null,
        nandShare: company.nandShare2026 || null,
        asOf: metric?.period || null,
        source: metric?.sources?.map((source) => source.name).filter(Boolean).join(" · ") || null,
        sourceUrl: directUrl(primarySource?.url) ? primarySource.url : "",
        dataStatus: metric ? (metric.representation === "range" ? `range-${metric.sourceCount}-sources` : metric.confidence) : "automation-pending",
        trend: metric ? {
          direction: metric.direction || "new",
          changePctPoint: metric.changePctPoint ?? null,
          priorPeriod: metric.priorPeriod || null,
          yearAgoPeriod: metric.yearAgoPeriod || null,
          yearAgoChangePctPoint: metric.yearAgoChangePctPoint ?? null,
          sourceCount: Number(metric.sourceCount || 0),
          representation: metric.representation || "point",
        } : null,
      };
    });
}

function buildDecisionIntelligenceContent(quant = {}) {
  const current = quant.decisionIntelligence || {};
  const evaluation = current.evaluation || {};
  const retrieval = current.retrieval || {};
  const freshness = current.freshness || {};
  return {
    schemaVersion: current.schemaVersion || "1.0",
    status: evaluation.status || "pending-next-verified-run",
    generatedAt: current.generatedAt || quant.updatedAt || null,
    runId: current.runId || quant.runId || null,
    refreshTrigger: current.refreshTrigger || "pending-next-verified-run",
    metrics: (current.metrics?.latest || []).map((metric) => ({
      metricId: metric.metricId,
      metricLabel: metric.metricLabel,
      dimension: metric.dimension,
      entityId: metric.entityId,
      company: metric.company,
      period: metric.period,
      display: metric.display,
      representation: metric.representation,
      sourceCount: Number(metric.sourceCount || 0),
      confidence: metric.confidence,
      direction: metric.direction,
      changePctPoint: metric.changePctPoint ?? null,
      priorPeriod: metric.priorPeriod || null,
      yearAgoPeriod: metric.yearAgoPeriod || null,
      yearAgoChangePctPoint: metric.yearAgoChangePctPoint ?? null,
      sources: (metric.sources || []).map((source) => ({
        id: source.id,
        name: source.name,
        sourceClass: source.sourceClass,
        url: directUrl(source.url) ? source.url : "",
        publishedAt: source.publishedAt || null,
        value: source.value,
      })),
    })),
    eventTriggers: (current.eventTriggers || []).slice(0, 12),
    claimEvents: {
      schemaVersion: current.claimEvents?.schemaVersion || "1.0",
      generatedAt: current.claimEvents?.generatedAt || current.generatedAt || null,
      stats: current.claimEvents?.stats || {
        eligibleDocuments: 0,
        structuredEvents: 0,
        verifiedEvents: 0,
        currentStages: 0,
        newEvents: 0,
        contradictionReviews: 0,
      },
      events: (current.claimEvents?.events || []).slice(0, 16).map((event) => ({
        id: event.id,
        ruleId: event.ruleId,
        eventType: event.eventType,
        label: event.label,
        entity: event.entity,
        product: event.product,
        stage: event.stage,
        metrics: event.metrics || [],
        evidenceSpan: compact(event.evidenceSpan, 420),
        source: event.source,
        sourceId: event.sourceId,
        sourceClass: event.sourceClass,
        sourceUrl: directUrl(event.sourceUrl) ? event.sourceUrl : "",
        publishedAt: event.publishedAt || null,
        confidence: event.confidence,
        claimType: event.claimType || (event.sourceClass === "official" ? "verified-fact" : "market-estimate"),
        asOf: event.asOf || event.publishedAt || null,
        promotionStatus: event.promotionStatus,
        contradictionStatus: event.contradictionStatus,
        isCurrentStage: event.isCurrentStage === true,
        supersededBy: event.supersededBy || null,
      })),
    },
    decisionAutomation: {
      schemaVersion: current.decisionAutomation?.schemaVersion || "1.0",
      meceAxes: (current.decisionAutomation?.meceAxes || []).map((axis) => ({
        id: axis.id,
        label: compact(axis.label, 72),
        owns: compact(axis.owns, 180),
        excludes: compact(axis.excludes, 180),
      })),
      state: current.decisionAutomation?.state || "MONITORING",
      funnel: current.decisionAutomation?.funnel || {
        sourceDocuments: 0,
        structuredEvents: 0,
        verifiedEvents: 0,
        decisionReadyBriefs: 0,
        executionTrackingBriefs: 0,
      },
      sourceOperations: current.decisionAutomation?.sourceOperations || {
        configured: 0,
        observed: 0,
        useful: 0,
        observationRatePct: 0,
        usefulYieldPct: 0,
        sources: [],
      },
      briefs: (current.decisionAutomation?.briefs || []).map((brief) => ({
        ...brief,
        evidence: (brief.evidence || []).slice(0, 5).map((item) => ({
          ...item,
          excerpt: compact(item.excerpt, 320),
          url: directUrl(item.url) ? item.url : "",
        })),
      })),
    },
    feedStatus: (current.feedStatus || []).map((feed) => ({
      id: feed.id,
      sourceId: feed.sourceId,
      kind: feed.kind,
      status: feed.status,
    })),
    retrieval: {
      mode: retrieval.mode || "incremental-extractive",
      stats: retrieval.stats || { documents: 0, chunks: 0, reindexed: 0 },
      packs: (retrieval.packs || []).map((pack) => ({
        id: pack.id,
        label: pack.label,
        decisionQuestion: pack.decisionQuestion,
        status: pack.status,
        evidenceCount: Number(pack.evidence?.length || 0),
        citations: (pack.evidence || []).slice(0, 3).map((item) => ({
          title: item.title,
          source: item.source,
          sourceClass: item.sourceClass,
          url: directUrl(item.url) ? item.url : "",
          publishedAt: item.publishedAt || null,
          indexedAt: item.indexedAt || null,
          sourceChangeDetectedAt: item.sourceChangeDetectedAt || null,
          lastHumanVerifiedAt: item.lastHumanVerifiedAt || null,
          stale: item.documentStatus === "retained-last-verified",
        })),
      })),
    },
    freshness: {
      framework: freshness.framework || "evidence-freshness-v1",
      score: Number(freshness.score || 0),
      status: freshness.status || "pending",
      label: freshness.label || "다음 검증 실행 대기",
      revalidationRequired: freshness.revalidationRequired !== false,
      thresholds: freshness.thresholds || { current: 85, warning: 70 },
      weights: freshness.weights || { contentAge: 0.35, embeddingLag: 0.2, staleRetrievalRate: 0.25, coverageDrift: 0.2 },
      components: freshness.components || { contentAge: 0, embeddingLag: 0, staleRetrievalRate: 0, coverageDrift: 0 },
      diagnostics: freshness.diagnostics || {},
      coverage: freshness.coverage || { currentPct: 0, previousPct: null },
      timestamps: freshness.timestamps || { lastHumanVerifiedAt: null, sourceChangeDetectedAt: null, indexedAt: null },
      generatedAt: freshness.generatedAt || current.generatedAt || null,
    },
    evaluation: {
      framework: evaluation.framework || "grounded-retrieval-quality-loop",
      status: evaluation.status || "pending",
      failClosed: evaluation.failClosed !== false,
      groundingMode: evaluation.groundingMode || "extractive-only",
      metrics: evaluation.metrics || {
        citationCoveragePct: 0,
        trackCoveragePct: 0,
        freshDocumentPct: 0,
        primaryOrResearchPct: 0,
        conflictDisclosurePct: 100,
        unsupportedClaimPct: 0,
      },
    },
  };
}

function buildWorkloadSignals(payload = {}, allowedSourceIds = []) {
  const allowed = new Set(allowedSourceIds);
  const workloadTerms = /kv.?cache|pagedattention|distserve|mooncake|prefill|decode|goodput|scheduler|context cach|context engineering|prompt cach|offload|tiered memory|rag|vector|workload|benchmark|rack.?scale|liquid.?cool|data.?center/i;
  const classScore = { official: 20, research: 12, "authoritative-media": 8 };
  return (payload.news || [])
    .map((item) => {
      const url = item?.verification?.canonicalUrl || item.sourceUrl || item.link || item.url || "";
      const catalogSource = catalogSourceForUrl(url, sourceCatalog);
      const title = item.titleKo || item.title || "";
      const summary = item.summaryKo || item.summary || "";
      if (!catalogSource || !allowed.has(catalogSource.id) || !directUrl(url) || !workloadTerms.test(`${title} ${summary}`)) return null;
      const date = publishedAt(item, payload.updatedAt);
      const timestamp = Date.parse(String(date || ""));
      return {
        id: `${catalogSource.id}-${String(date || "watch").slice(0, 10)}`,
        title: compact(title, 150),
        summary: compact(summary, 240),
        source: catalogSource.name,
        sourceId: catalogSource.id,
        url,
        publishedAt: date,
        evidenceLevel: evidenceLevel(item),
        sourceClass: catalogSource.sourceClass,
        score: (classScore[catalogSource.sourceClass] || 0) + (Number.isFinite(timestamp) ? timestamp / 8.64e7 / 100000 : 0),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ score: _score, ...item }) => item);
}

const AI_FACTORY_PILLARS = [
  { id: "facility", label: "POWER / COOLING", terms: /power|electric|energy|grid|mw|rack.?kw|cool|thermal|liquid|cdus?|pue|전력|냉각|열|계통/i, topics: ["power", "cooling", "liquid-cooling", "energy", "grid", "water"] },
  { id: "fabric", label: "NETWORK / FABRIC", terms: /network|fabric|rdma|infiniband|roce|nvlink|collective|rail|oversubscription|네트워크|패브릭|통신/i, topics: ["network", "rack-scale"] },
  { id: "data", label: "DATA / STORAGE", terms: /storage|nvme|ssd|parallel.?file|object|vector|retrieval|checkpoint|cache|스토리지|검색|체크포인트/i, topics: ["storage", "enterprise-ssd", "ai-storage", "nvme", "kv-cache"] },
  { id: "orchestration", label: "SCHEDULER / ORCHESTRATION", terms: /scheduler|scheduling|kueue|slurm|quota|preemption|topology|resource.?allocation|queue|스케줄|자원|큐/i, topics: ["scheduler", "orchestration", "queue", "resource-allocation", "gpu"] },
  { id: "serving", label: "LLM SERVING", terms: /serving|inference|pagedattention|prefill|decode|kv.?cache|batching|routing|vllm|dynamo|추론|서빙/i, topics: ["inference", "paged-attention", "prefill-decode", "kv-cache", "offloading", "goodput"] },
  { id: "accelerator", label: "ACCELERATOR / MEMORY", terms: /accelerator|gpu|tpu|asic|hbm|dram|cxl|memory|가속기|메모리/i, topics: ["accelerator", "hbm", "dram", "cxl", "memory-pooling"] },
  { id: "economics", label: "ECONOMICS / GOVERNANCE", terms: /tco|cost|capex|opex|economics|finops|governance|security|risk|비용|경제성|보안|거버넌스/i, topics: ["economics", "financial", "scenario"] },
];

function classifyAIFactoryPillar(text = "", source = {}) {
  const topics = new Set(source.topics || []);
  return AI_FACTORY_PILLARS.find((pillar) => pillar.terms.test(text)
    || pillar.topics.some((topic) => topics.has(topic))) || AI_FACTORY_PILLARS[AI_FACTORY_PILLARS.length - 1];
}

function buildAIFactorySignals(payload = {}, allowedSourceIds = []) {
  const allowed = new Set(allowedSourceIds);
  const classScore = { official: 24, research: 14, "authoritative-media": 8 };
  const systemTerms = /ai.?factory|data.?cent(er|re)|power|cool|network|fabric|storage|scheduler|orchestrat|serving|inference|accelerator|gpu|tpu|hbm|kv.?cache|rag|workload|benchmark|전력|냉각|네트워크|스토리지|스케줄|추론|가속기|워크로드/i;
  return (payload.news || [])
    .map((item) => {
      const url = item?.verification?.canonicalUrl || item.sourceUrl || item.link || item.url || "";
      const catalogSource = catalogSourceForUrl(url, sourceCatalog);
      const title = item.titleKo || item.title || "";
      const summary = item.summaryKo || item.summary || "";
      const text = `${title} ${item.originalTitle || ""} ${summary}`;
      if (!catalogSource || !allowed.has(catalogSource.id) || !directUrl(url) || !systemTerms.test(text)) return null;
      const date = publishedAt(item, payload.updatedAt);
      const timestamp = Date.parse(String(date || ""));
      const pillar = classifyAIFactoryPillar(text, catalogSource);
      return {
        id: `${catalogSource.id}-${pillar.id}-${String(date || "watch").slice(0, 10)}`,
        pillar: pillar.id,
        pillarLabel: pillar.label,
        title: compact(title, 150),
        summary: compact(summary, 240),
        source: catalogSource.name,
        sourceId: catalogSource.id,
        url,
        publishedAt: date,
        evidenceLevel: evidenceLevel(item),
        sourceClass: catalogSource.sourceClass,
        score: (classScore[catalogSource.sourceClass] || 0) + (Number.isFinite(timestamp) ? timestamp / 8.64e7 / 100000 : 0),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .filter((item, index, rows) => rows.findIndex((candidate) => candidate.pillar === item.pillar) === index)
    .slice(0, AI_FACTORY_PILLARS.length)
    .map(({ score: _score, ...item }) => item);
}

function buildWorkloadEvidence(payload = {}, allowedSourceIds = [], workloads = []) {
  const allowed = new Set(allowedSourceIds);
  const classScore = { official: 30, research: 20, "authoritative-media": 8 };
  const candidates = (payload.news || []).map((item) => {
    const url = item?.verification?.canonicalUrl || item.sourceUrl || item.link || item.url || "";
    const catalogSource = catalogSourceForUrl(url, sourceCatalog);
    if (!catalogSource || !allowed.has(catalogSource.id) || !directUrl(url)) return null;
    const title = item.titleKo || item.title || "";
    const summary = item.summaryKo || item.summary || "";
    const text = `${title} ${item.originalTitle || ""} ${summary}`.toLowerCase();
    const date = publishedAt(item, payload.updatedAt);
    const timestamp = Date.parse(String(date || ""));
    return {
      title: compact(title, 150),
      summary: compact(summary, 220),
      text,
      source: catalogSource.name,
      sourceId: catalogSource.id,
      sourceClass: catalogSource.sourceClass,
      url,
      publishedAt: date,
      evidenceLevel: evidenceLevel(item),
      baseScore: (classScore[catalogSource.sourceClass] || 0) + (Number.isFinite(timestamp) ? timestamp / 8.64e7 / 100000 : 0),
    };
  }).filter(Boolean);

  return workloads.map((workload) => {
    const terms = (workload.signalTerms || []).map((term) => String(term).toLowerCase());
    const matches = candidates.map((candidate) => {
      const matchedTerms = terms.filter((term) => candidate.text.includes(term));
      return matchedTerms.length ? { ...candidate, matchedTerms, score: candidate.baseScore + matchedTerms.length * 8 } : null;
    }).filter(Boolean).sort((a, b) => b.score - a.score);
    const best = matches[0];
    const monitor = (workload.monitorSourceIds || [])
      .map((id) => sourceCatalog.sources.find((source) => source.id === id && allowed.has(id)))
      .find(Boolean);
    return {
      ...workload,
      evidence: best ? {
        status: best.evidenceLevel || "watch",
        title: best.title,
        summary: best.summary,
        source: best.source,
        sourceId: best.sourceId,
        sourceClass: best.sourceClass,
        url: best.url,
        publishedAt: best.publishedAt,
        matchedTerms: best.matchedTerms,
      } : monitor ? {
        status: "monitoring",
        title: "공식·연구 원문 증분 모니터링",
        summary: "소스 변경이 감지되면 이 Workload의 Retrieval Track을 증분 재색인합니다.",
        source: monitor.name,
        sourceId: monitor.id,
        sourceClass: monitor.sourceClass,
        url: monitor.url,
        publishedAt: null,
        matchedTerms: [],
      } : {
        status: "coverage-gap",
        title: "최신 검증 근거 관측 대기",
        summary: "다음 증분 수집에서 이 Workload의 공식·연구 근거를 재확인합니다.",
        source: "자동 수집 대기",
        sourceId: null,
        sourceClass: null,
        url: "",
        publishedAt: null,
        matchedTerms: [],
      },
    };
  });
}

function buildForecastSignal(payload = {}, allowedSourceIds = [], forecast = {}) {
  const [result] = buildWorkloadEvidence(payload, allowedSourceIds, [{
    id: "demand-transition",
    label: forecast.label || "DEMAND TRANSITION · FORECAST",
    signalTerms: forecast.signalTerms || [],
  }]);
  return {
    ...forecast,
    evidence: result?.evidence || { status: "coverage-gap" },
  };
}

function buildAIFactorySystem(payload = {}, sourceCoverage = {}, generatedAt = null) {
  const framework = model.aiFactorySystem || {};
  const observed = new Set(sourceCoverage.observedSourceIds || []);
  const fresh = new Set(sourceCoverage.freshSourceIds || []);
  const sourceIds = framework.sourceIds || [];
  const sources = sourceIds.map((id) => sourceCatalog.sources.find((source) => source.id === id)).filter(Boolean).map((source) => ({
    id: source.id,
    name: source.name,
    sourceClass: source.sourceClass,
    url: source.url,
    topics: source.topics,
    status: fresh.has(source.id) ? "fresh" : observed.has(source.id) ? "observed" : "monitoring",
  }));
  const pillarCoverage = AI_FACTORY_PILLARS.map((pillar) => {
    const relevant = sources.filter((source) => pillar.topics.some((topic) => source.topics.includes(topic)));
    const observedCount = relevant.filter((source) => source.status !== "monitoring").length;
    const freshCount = relevant.filter((source) => source.status === "fresh").length;
    return {
      id: pillar.id,
      label: pillar.label,
      configured: relevant.length,
      observed: observedCount,
      fresh: freshCount,
      status: freshCount > 0 ? "fresh" : observedCount > 0 ? "observed" : "coverage-gap",
    };
  });
  const activePillars = pillarCoverage.filter((pillar) => pillar.status !== "coverage-gap").length;
  const signals = buildAIFactorySignals(payload, sourceIds);
  const workloads = buildWorkloadEvidence(payload, sourceIds, framework.workloads || []);
  const connectedWorkloads = workloads.filter((workload) => Boolean(workload.evidence?.url)).length;
  const promotedWorkloads = workloads.filter((workload) => !["coverage-gap", "monitoring"].includes(workload.evidence?.status)).length;
  return {
    title: framework.title || "AI Factory System Optimization",
    thesis: framework.thesis || "Workload SLO와 단위경제성으로 AI Factory 전체 시스템을 공동 최적화합니다.",
    northStar: framework.northStar || {},
    architectureLayers: framework.architectureLayers || [],
    workloads,
    decisionSequence: framework.decisionSequence || [],
    roadmap: framework.roadmap || [],
    demandShift: buildForecastSignal(payload, sourceIds, framework.demandShift || {}),
    kpiTree: framework.kpiTree || {},
    evidencePolicy: framework.evidencePolicy || [],
    sources,
    signals,
    pillarCoverage,
    automation: {
      status: activePillars >= 6 ? "SYSTEM-COVERED" : connectedWorkloads === workloads.length ? "SOURCE-CONNECTED" : activePillars >= 3 ? "PARTIAL" : "COVERAGE-GAP",
      activePillars,
      totalPillars: AI_FACTORY_PILLARS.length,
      activeWorkloads: connectedWorkloads,
      promotedWorkloads,
      totalWorkloads: workloads.length,
      refreshMode: "event + safety-poll + incremental-reindex",
      scheduleHours: Number(sourceCoverage.scheduleHours || sourceCatalog.refreshPolicy.scheduleHours),
      failClosed: true,
    },
    generatedAt,
    runId: payload.runId || null,
  };
}

function buildDecisionControl(payload = {}, sourceCoverage = {}, generatedAt = null, expiresAt = null) {
  const qualityStatus = String(payload.quality?.status || "unavailable").toLowerCase();
  const integrityPassed = /verified|pass|current|healthy/.test(qualityStatus);
  const configured = Number(sourceCoverage.configuredSources || 0);
  const observed = Number(sourceCoverage.observedSources || 0);
  const fresh = Number(sourceCoverage.freshObservedSources || 0);
  const observedRatio = configured ? observed / configured : 0;
  const freshRatio = configured ? fresh / configured : 0;
  const generatedTime = Date.parse(String(generatedAt || ""));
  const expiryTime = Date.parse(String(expiresAt || ""));
  const current = Number.isFinite(generatedTime) && Number.isFinite(expiryTime) && generatedTime <= expiryTime;
  const coverage = observedRatio >= 0.7 ? "FULL" : observedRatio >= 0.15 ? "PARTIAL" : "LOW";
  const confidence = integrityPassed && current && observedRatio >= 0.7
    ? "HIGH"
    : integrityPassed && current && observedRatio >= 0.15
      ? "CONDITIONAL"
      : "REVIEW";
  return {
    integrity: { status: integrityPassed ? "PASS" : "REVIEW", detail: qualityStatus || "unavailable" },
    freshness: { status: current ? "CURRENT" : "CHECK", generatedAt, expiresAt },
    coverage: { status: coverage, observed, configured, ratio: Number(observedRatio.toFixed(3)), freshRatio: Number(freshRatio.toFixed(3)) },
    confidence: { status: confidence, basis: "integrity × freshness × source coverage" },
  };
}

function buildWorkloadOptimization(payload = {}, sourceCoverage = {}, generatedAt = null, decisionIntelligence = {}) {
  const framework = model.workloadOptimization || {};
  const observed = new Set(sourceCoverage.observedSourceIds || []);
  const fresh = new Set(sourceCoverage.freshSourceIds || []);
  const sourceIds = framework.sourceIds || [];
  const sources = sourceIds.map((id) => sourceCatalog.sources.find((source) => source.id === id)).filter(Boolean).map((source) => ({
    id: source.id,
    name: source.name,
    tier: source.tier,
    sourceClass: source.sourceClass,
    url: source.url,
    topics: source.topics,
    status: fresh.has(source.id) ? "fresh" : observed.has(source.id) ? "observed" : "monitoring",
  }));
  return {
    title: framework.title || "Data Center Workload Optimization",
    thesis: framework.thesis || "고객 Workload를 실측하고 Memory Architecture 대안을 동일 KPI에서 비교합니다.",
    process: framework.process || [],
    serviceLines: framework.serviceLines || [],
    evidencePolicy: framework.evidencePolicy || [],
    ragOperatingModel: {
      ...(framework.ragOperatingModel || {}),
      liveControl: {
        freshnessScore: Number(decisionIntelligence.freshness?.score || 0),
        freshnessStatus: decisionIntelligence.freshness?.status || "pending",
        retrievalStatus: decisionIntelligence.evaluation?.status || "pending",
        citationCoveragePct: Number(decisionIntelligence.evaluation?.metrics?.citationCoveragePct || 0),
        trackCoveragePct: Number(decisionIntelligence.evaluation?.metrics?.trackCoveragePct || 0),
        indexedAt: decisionIntelligence.freshness?.timestamps?.indexedAt || null,
      },
    },
    sources,
    currentSignals: buildWorkloadSignals(payload, sourceIds),
    generatedAt,
    runId: payload.runId || null,
  };
}

function buildProfile(profile = {}, brief = {}, partner = {}, generatedAt = null) {
  const isPartner = profile.panelId === "partner";
  const latest = isPartner ? partner : briefLatest(brief, generatedAt);
  const decision = compact(brief.decision || profile.fallbackDecision, 320);
  const stop = compact(brief.reversalKpi || profile.fallbackStop, 300);
  const sourceLabel = latest.source || "검증 대기";
  const sourceDate = latest.publishedAt ? String(latest.publishedAt).slice(0, 10) : "기준일 확인 필요";
  const signals = [
    [`${latest.evidenceLevel || "WATCH"} · ${String(latest.sourceClass || "SOURCE").toUpperCase()}`, latest.title, latest.summary],
    ["EXECUTIVE DECISION", compact(profile.answerTitle, 80), decision],
    ["REVERSAL KPI", "판단 변경 조건", stop],
  ];
  const sources = [
    [latest.evidenceLevel || "WATCH", `${sourceLabel} · ${sourceDate}`, latest.url || ""],
    ["CONTROL", "고객 Trace·계약·Qualification은 내부 검증 전 공개 근거와 분리", ""],
    ["CONTROL", "Modeled threshold는 고객 Baseline 승인 후 결재 사용", ""],
  ];

  return {
    id: profile.id,
    panelId: profile.panelId,
    briefId: profile.briefId,
    index: profile.index,
    phase: profile.phase,
    tabLabel: profile.tabLabel,
    title: profile.title,
    subtitle: `${sourceLabel} 최신 근거 · ${sourceDate}`,
    answerTitle: profile.answerTitle,
    recommendation: profile.recommendation,
    question: profile.question,
    decision,
    hypothesis: {
      status: brief.hypothesisVerifiedAt ? "verified" : "unverified",
      label: brief.hypothesisVerifiedAt ? "근거 검증 완료" : "근거 미검증",
      verifiedAt: brief.hypothesisVerifiedAt || null,
      scope: "전략 가설 · 고객 내부 Trace와 계약 조건 확인 전",
    },
    stop,
    latest,
    evidenceCount: Number(brief.evidenceCount || 0),
    signals,
    lenses: profile.lenses || [],
    horizons: profile.horizons || [],
    kpis: profile.kpis || [],
    partners: profile.partners || [],
    useCase: profile.useCase || "",
    sources,
    deepLink: profile.deepLink || "#console",
  };
}

function buildDepartmentHomepage({ decisionIntelligence = {}, sourceCoverage = {}, payload = {}, insights = [], generatedAt = null } = {}) {
  const automation = decisionIntelligence.decisionAutomation || {};
  const freshness = decisionIntelligence.freshness || {};
  const deepLinks = {
    "custom-memory": "#console/c-level-cockpit/hbm4-foundry",
    "agentic-tiering": "#console/c-level-cockpit/post-hbm",
    "enterprise-rag": "#console/ai-matrix",
    "ai-factory": "#console/ai-factory",
    "nvidia-base-die": "#console/account/nvidia",
    "hyperscaler-asic-matrix": "#console/account/google",
    "agentic-memory-tier": "#console/c-level-cockpit/post-hbm",
  };
  const strategicProjects = Array.isArray(accountModel.projects) ? accountModel.projects : [];
  const agenda = strategicProjects.map((project, index) => ({
      id: project.id || `project-${index + 1}`,
      index: project.index || String(index + 1).padStart(2, "0"),
      label: compact(project.label || "AI Infra Project", 72),
      meceAxis: project.id || `project-${index + 1}`,
      state: "PROJECT",
      stage: "90_DAY_GATE",
      decisionQuestion: compact(project.title || "고객 과제를 선택합니다", 140),
      whatChanged: compact(project.proposal || "고객별 제안 구성", 140),
      latestSignal: compact(project.pain || "고객 Pain 확인", 100),
      customerPain: compact(project.pain || "고객 Pain 확인", 150),
      recommendation: compact(project.proposal || "맞춤형 메모리 제안", 180),
      action90d: compact(project.gate90d || "90일 Gate", 160),
      deliverable: compact(project.deliverable || "Customer Decision Pack", 120),
      owner: "AI Infra Strategy",
      kpis: (project.kpis || []).slice(0, 3).map((item) => compact(item, 48)),
      accounts: project.accounts || [],
      accent: project.accent || "#0A84B8",
      deepLink: deepLinks[project.id] || "#console",
    }));
  if (!agenda.length) agenda.push(...(automation.briefs || [])
    .slice(0, 3)
    .map((brief, index) => ({
      id: brief.id || `decision-${index + 1}`,
      index: String(index + 1).padStart(2, "0"),
      label: compact(brief.label || "AI Infra Decision", 72),
      meceAxis: compact(brief.meceAxis || "decision", 48),
      state: brief.status || "MONITORING",
      stage: brief.stage || "EVIDENCE_REVIEW",
      decisionQuestion: compact(brief.decisionQuestion || brief.whatChanged || "다음 의사결정 질문을 검증합니다.", 140),
      whatChanged: compact(brief.whatChanged || "새 근거가 수집되면 변경 내용을 갱신합니다.", 140),
      latestSignal: compact(brief.latestSignal || "새 근거 관측 대기", 100),
      customerPain: compact(brief.customerPain || "고객 Pain과 Workload 근거를 확인합니다.", 150),
      recommendation: compact(brief.hypothesis || "검증된 선택지를 비교합니다.", 180),
      action90d: compact(brief.action90d || "Owner와 다음 검증 과제를 지정합니다.", 160),
      deliverable: compact(brief.deliverable || "Decision Brief · 90-Day Action", 120),
      owner: compact(brief.owner || "AI Infra Strategy", 100),
      kpis: (brief.kpis || []).slice(0, 3).map((item) => compact(item, 48)),
      evidenceCount: Number(brief.evidenceCount || 0),
      independentSources: Number(brief.independentSources || 0),
      confidence: brief.confidence || "review",
      deepLink: deepLinks[brief.id] || "#console",
    })));
  if (agenda.length < 3) {
    const fallbackLinks = {
      hbm: "#console/c-level-cockpit/hbm4-foundry",
      demand: "#console/c-level-cockpit/post-hbm",
      nand: "#console/ai-matrix",
      partner: "#console/ai-factory",
    };
    for (const insight of insights) {
      if (agenda.length >= 4 || agenda.some((item) => item.id === insight.id)) continue;
      agenda.push({
        id: insight.id || `verified-brief-${agenda.length + 1}`,
        index: String(agenda.length + 1).padStart(2, "0"),
        label: compact(insight.label || "Verified Intelligence", 72),
        meceAxis: `fallback-${insight.id || agenda.length + 1}`,
        state: "MONITORING",
        stage: "EVIDENCE_REVIEW",
        decisionQuestion: compact(insight.decision || insight.latest?.title || "다음 의사결정 질문을 검증합니다.", 140),
        whatChanged: compact(insight.latest?.title || "최신 근거 검토", 120),
        latestSignal: compact(insight.latest?.title || "새 근거 관측 대기", 100),
        customerPain: compact(insight.implication || insight.fact || "고객 Pain과 Workload 근거를 확인합니다.", 150),
        recommendation: compact(insight.decision || "검증된 선택지를 비교합니다.", 180),
        action90d: compact(insight.action || "Owner와 다음 검증 과제를 지정합니다.", 160),
        deliverable: "Evidence Review · Decision Brief",
        owner: "AI Infra Strategy",
        kpis: [],
        evidenceCount: Number(insight.evidenceCount || 0),
        independentSources: insight.latest?.source ? 1 : 0,
        confidence: insight.latest?.evidenceLevel || "review",
        deepLink: fallbackLinks[insight.id] || "#console",
      });
    }
  }
  return {
    source: strategicProjects.length ? "accounts.projects" : "decisionIntelligence.decisionAutomation.briefs",
    runId: payload.runId || decisionIntelligence.runId || null,
    generatedAt,
    status: "PROJECT_PORTFOLIO",
    agenda,
    metrics: [],
    revalidationRequired: freshness.revalidationRequired === true,
    indexedAt: freshness.timestamps?.indexedAt || null,
  };
}

export function validateSiteContent(content = {}) {
  const errors = [];
  if (content.schemaVersion !== "1.1") errors.push("schemaVersion");
  if (!content.runId) errors.push("runId");
  if (!content.generatedAt || Number.isNaN(Date.parse(content.generatedAt))) errors.push("generatedAt");
  if (content.siteAutomation?.status !== "all-sections-bound") errors.push("siteAutomation.status");
  if (!Array.isArray(content.siteAutomation?.sectionIds) || content.siteAutomation.sectionIds.length < 60) errors.push("siteAutomation.sectionIds");
  if (Number(content.siteAutomation?.totalSections || 0) !== Number(content.siteAutomation?.boundSections || -1)) errors.push("siteAutomation.coverage");
  const boundIds = Object.values(content.siteAutomation?.bindingGroups || {}).flat();
  if (new Set(boundIds).size !== content.siteAutomation?.sectionIds?.length || !content.siteAutomation.sectionIds.every((id) => boundIds.includes(id))) errors.push("siteAutomation.sectionContract");
  if (content.siteAutomation?.refresh?.atomicManifest !== true || content.siteAutomation?.refresh?.failClosed !== true) errors.push("siteAutomation.refresh");
  if (!Array.isArray(content.decisionCases) || content.decisionCases.length < 4) errors.push("decisionCases");
  if (!Array.isArray(content.insights) || content.insights.length < 4) errors.push("insights");
  if (!Array.isArray(content.agentCouncil?.agendas) || content.agentCouncil.agendas.length < 4) errors.push("agentCouncil.agendas");
  if (!Array.isArray(content.workloadOptimization?.process) || content.workloadOptimization.process.length < 6) errors.push("workloadOptimization.process");
  if (!Array.isArray(content.workloadOptimization?.serviceLines) || content.workloadOptimization.serviceLines.length < 6) errors.push("workloadOptimization.serviceLines");
  if (!Array.isArray(content.workloadOptimization?.sources) || content.workloadOptimization.sources.length < 4) errors.push("workloadOptimization.sources");
  if (!Array.isArray(content.workloadOptimization?.ragOperatingModel?.pipeline) || content.workloadOptimization.ragOperatingModel.pipeline.length < 13) errors.push("workloadOptimization.ragOperatingModel.pipeline");
  if (!Array.isArray(content.workloadOptimization?.ragOperatingModel?.maturity) || content.workloadOptimization.ragOperatingModel.maturity.length < 6) errors.push("workloadOptimization.ragOperatingModel.maturity");
  const strategyBoard = content.strategyBoard || {};
  if (!Array.isArray(strategyBoard.tech?.memoryMap) || strategyBoard.tech.memoryMap.length < 4) errors.push("strategyBoard.tech.memoryMap");
  if (!(strategyBoard.tech?.memoryMap || []).every((item) => item.evidence?.status)) errors.push("strategyBoard.tech.memoryMap.evidence");
  const maasTrack = (strategyBoard.tech?.memoryMap || []).find((item) => item.id === "memory-as-a-service");
  if (!maasTrack || maasTrack.commercialStatus !== "strategy-hypothesis") errors.push("strategyBoard.tech.maas");
  if (!Array.isArray(strategyBoard.partners?.models) || strategyBoard.partners.models.length < 3) errors.push("strategyBoard.partners.models");
  if (!Array.isArray(strategyBoard.customerPortfolio?.accounts) || strategyBoard.customerPortfolio.accounts.length < 10) errors.push("strategyBoard.customerPortfolio.accounts");
  if (!(strategyBoard.customerPortfolio?.accounts || []).every((item) => item.evidence?.status)) errors.push("strategyBoard.customerPortfolio.evidence");
  if (!Array.isArray(strategyBoard.customerPortfolio?.groups) || strategyBoard.customerPortfolio.groups.length < 4) errors.push("strategyBoard.customerPortfolio.groups");
  if (!Array.isArray(strategyBoard.customerPortfolio?.projects) || strategyBoard.customerPortfolio.projects.length !== 3) errors.push("strategyBoard.customerPortfolio.projects");
  const broadcomAccounts = strategyBoard.customerPortfolio?.broadcomEcosystem?.accounts || [];
  if (!Array.isArray(broadcomAccounts) || broadcomAccounts.length !== 3) errors.push("strategyBoard.customerPortfolio.broadcomEcosystem.accounts");
  if (!broadcomAccounts.every((item) => item?.broadcomStrategy?.pains?.length >= 3 && item?.broadcomStrategy?.proposal?.length >= 3 && directUrl(item?.broadcomStrategy?.source?.url))) errors.push("strategyBoard.customerPortfolio.broadcomEcosystem.contract");
  const partnerEcosystem = strategyBoard.customerPortfolio?.partnerEcosystem?.partners || [];
  if (!Array.isArray(partnerEcosystem) || partnerEcosystem.length !== 2) errors.push("strategyBoard.customerPortfolio.partnerEcosystem.partners");
  const marvellNode = partnerEcosystem.find((item) => item.id === "marvell");
  if (!marvellNode || !["aws", "microsoft"].every((id) => (marvellNode.accounts || []).some((account) => account.id === id))) errors.push("strategyBoard.customerPortfolio.partnerEcosystem.marvell");
  if (!Array.isArray(strategyBoard.playbooks) || strategyBoard.playbooks.length < 3) errors.push("strategyBoard.playbooks");
  if (!(strategyBoard.playbooks || []).every((item) => item.evidence?.status)) errors.push("strategyBoard.playbooks.evidence");
  const maasPlaybook = (strategyBoard.playbooks || []).find((item) => item.id === "memory-as-a-service");
  if (!maasPlaybook || maasPlaybook.commercialStatus !== "strategy-hypothesis") errors.push("strategyBoard.playbooks.maas");
  if (!Array.isArray(strategyBoard.reports)) errors.push("strategyBoard.reports");
  if ((strategyBoard.reports || []).some((item) => !directUrl(item.url))) errors.push("strategyBoard.reportUrls");
  if (Number(strategyBoard.evidenceCount || 0) !== (strategyBoard.reports || []).length) errors.push("strategyBoard.evidenceCount");
  if (!Array.isArray(content.aiFactorySystem?.architectureLayers) || content.aiFactorySystem.architectureLayers.length < 8) errors.push("aiFactorySystem.architectureLayers");
  if (!Array.isArray(content.aiFactorySystem?.workloads) || content.aiFactorySystem.workloads.length < 6) errors.push("aiFactorySystem.workloads");
  if (!(content.aiFactorySystem?.workloads || []).every((item) => item?.evidence?.status)) errors.push("aiFactorySystem.workloads.evidence");
  if (!Array.isArray(content.aiFactorySystem?.decisionSequence) || content.aiFactorySystem.decisionSequence.length < 8) errors.push("aiFactorySystem.decisionSequence");
  if (!Array.isArray(content.aiFactorySystem?.roadmap) || content.aiFactorySystem.roadmap.length < 5) errors.push("aiFactorySystem.roadmap");
  if (!Array.isArray(content.aiFactorySystem?.sources) || content.aiFactorySystem.sources.length < 8) errors.push("aiFactorySystem.sources");
  if (!Array.isArray(content.aiFactorySystem?.pillarCoverage) || content.aiFactorySystem.pillarCoverage.length < 6) errors.push("aiFactorySystem.pillarCoverage");
  if (!Array.isArray(content.aiFactorySystem?.kpiTree?.formulas) || content.aiFactorySystem.kpiTree.formulas.length < 4) errors.push("aiFactorySystem.kpiTree.formulas");
  if (!content.aiFactorySystem?.automation?.status) errors.push("aiFactorySystem.automation");
  if (!Array.isArray(content.presentation?.emphasisTerms) || content.presentation.emphasisTerms.length < 4) errors.push("presentation.emphasisTerms");
  if (content.presentation?.emphasisPolicy?.style !== "underline-only") errors.push("presentation.emphasisPolicy");
  if (Number(content.presentation?.emphasisPolicy?.maxTotal || 0) > 12) errors.push("presentation.emphasisPolicy.maxTotal");
  if (!Array.isArray(content.presentation?.readabilityPolicy?.hoverModes) || content.presentation.readabilityPolicy.hoverModes.length !== 2) errors.push("presentation.readabilityPolicy.hoverModes");
  if (!Array.isArray(content.organizationOperatingModel?.decisionLoop) || content.organizationOperatingModel.decisionLoop.length < 5) errors.push("organizationOperatingModel.decisionLoop");
  if (!Array.isArray(content.organizationOperatingModel?.units) || content.organizationOperatingModel.units.map((item) => item.label).join("|") !== "GSM|HBM BUSINESS|MSR") errors.push("organizationOperatingModel.units");
  if (!directUrl(content.organizationOperatingModel?.source?.url)) errors.push("organizationOperatingModel.source");
  if (!Array.isArray(content.organizationOperatingModel?.workstreams) || content.organizationOperatingModel.workstreams.length !== 3) errors.push("organizationOperatingModel.workstreams");
  if (!(content.organizationOperatingModel?.workstreams || []).every((item) => item?.mandate && item?.inputs?.length >= 4 && item?.questions?.length >= 3 && item?.outputs?.length >= 4 && item?.gate && item?.kpis?.length >= 3)) errors.push("organizationOperatingModel.workstreamContract");
  if ((content.organizationOperatingModel?.workstreams || []).map((item) => item.id).join("|") !== "account-intelligence|tech-portfolio-strategy|executive-deal-execution") errors.push("organizationOperatingModel.meceIds");
  if (content.organizationOperatingModel?.automation?.taxonomy !== "three-pillar-mece" || Number(content.organizationOperatingModel?.automation?.duplicateCount ?? 1) !== 0) errors.push("organizationOperatingModel.meceAutomation");
  for (const field of ["inputs", "questions", "outputs", "kpis"]) {
    const values = (content.organizationOperatingModel?.workstreams || []).flatMap((item) => item[field] || []).map(canonicalExecutiveKey);
    if (new Set(values).size !== values.length) errors.push(`organizationOperatingModel.mece.${field}`);
  }
  if (!Array.isArray(content.hero?.workProducts) || content.hero.workProducts.length !== 3) errors.push("hero.workProducts");
  if (!Array.isArray(content.hero?.workflow) || content.hero.workflow.length !== 4) errors.push("hero.workflow");
  if (!Array.isArray(content.hero?.departmentWorkbench?.agenda) || content.hero.departmentWorkbench.agenda.length < 3) errors.push("hero.departmentWorkbench.agenda");
  const agenda = content.hero?.departmentWorkbench?.agenda || [];
  if (new Set(agenda.map((item) => item.meceAxis)).size !== agenda.length) errors.push("hero.departmentWorkbench.agenda.meceAxis");
  if (new Set(agenda.map((item) => compact(item.decisionQuestion).toLowerCase())).size !== agenda.length || !agenda.every((item) => item.deliverable)) errors.push("hero.departmentWorkbench.agenda.decisionContract");
  if (!Array.isArray(content.hero?.departmentWorkbench?.metrics)) errors.push("hero.departmentWorkbench.metrics");
  if (!["accounts.projects", "decisionIntelligence.decisionAutomation.briefs"].includes(content.hero?.departmentWorkbench?.source)) errors.push("hero.departmentWorkbench.source");
  if (!Array.isArray(content.caseClassification) || content.caseClassification.length !== 3) errors.push("caseClassification");
  if (!content.decisionControl?.integrity?.status || !content.decisionControl?.freshness?.status || !content.decisionControl?.coverage?.status || !content.decisionControl?.confidence?.status) errors.push("decisionControl");
  if (content.decisionIntelligence?.evaluation?.failClosed !== true) errors.push("decisionIntelligence.evaluation.failClosed");
  if (content.decisionIntelligence?.retrieval?.mode !== "incremental-extractive") errors.push("decisionIntelligence.retrieval.mode");
  if (Number(content.decisionIntelligence?.evaluation?.metrics?.unsupportedClaimPct ?? 1) !== 0) errors.push("decisionIntelligence.unsupportedClaimPct");
  const freshnessScore = Number(content.decisionIntelligence?.freshness?.score);
  if (!Number.isFinite(freshnessScore) || freshnessScore < 0 || freshnessScore > 100) errors.push("decisionIntelligence.freshness.score");
  if (Number(content.decisionIntelligence?.freshness?.thresholds?.current) !== 85 || Number(content.decisionIntelligence?.freshness?.thresholds?.warning) !== 70) errors.push("decisionIntelligence.freshness.thresholds");
  if (!Number.isInteger(Number(content.decisionIntelligence?.claimEvents?.stats?.structuredEvents))) errors.push("decisionIntelligence.claimEvents");
  if (!Array.isArray(content.decisionIntelligence?.decisionAutomation?.briefs) || content.decisionIntelligence.decisionAutomation.briefs.length < 3) errors.push("decisionIntelligence.decisionAutomation.briefs");
  if (!Array.isArray(content.decisionIntelligence?.decisionAutomation?.meceAxes) || content.decisionIntelligence.decisionAutomation.meceAxes.length !== 4) errors.push("decisionIntelligence.decisionAutomation.meceAxes");
  if (!content.decisionIntelligence?.decisionAutomation?.state) errors.push("decisionIntelligence.decisionAutomation.state");
  for (const key of ["contentAge", "embeddingLag", "staleRetrievalRate", "coverageDrift"]) {
    const value = Number(content.decisionIntelligence?.freshness?.components?.[key]);
    if (!Number.isFinite(value) || value < 0 || value > 100) errors.push(`decisionIntelligence.freshness.components.${key}`);
  }
  if (Number(content.freshness?.configuredSources || 0) < 20) errors.push("freshness.configuredSources");
  if (Number(content.freshness?.officialConfigured || 0) < 15) errors.push("freshness.officialConfigured");
  for (const item of content.insights || []) {
    if (!item?.latest?.title || !item?.decision || !item?.action) errors.push(`insight:${item?.id || "unknown"}`);
    if (item?.latest?.url && !directUrl(item.latest.url)) errors.push(`insight-url:${item?.id || "unknown"}`);
  }
  if (!(content.insights || []).every((item) => item.hypothesis?.status)) errors.push("insights.hypothesis");
  if (!(content.decisionCases || []).every((item) => item.hypothesis?.status)) errors.push("decisionCases.hypothesis");
  return { ok: errors.length === 0, errors };
}

export function buildSiteContentClient({ payload = {}, quant = {} } = {}) {
  const generatedAt = payload.updatedAt || quant.updatedAt || new Date().toISOString();
  const briefMap = new Map((payload.intelligence?.briefs || []).map((brief) => [brief.id, brief]));
  const insights = (payload.intelligence?.briefs || []).map((brief) => buildInsight(brief, generatedAt));
  const fallbackPartner = briefLatest(briefMap.get("demand") || briefMap.get("hbm") || {}, generatedAt);
  const partnerSpotlight = latestPartnerSignal(payload, fallbackPartner);
  const sourceCoverage = buildSourceCatalogSnapshot({
    catalog: sourceCatalog,
    news: payload.news || [],
    industrySourceChecks: quant.industrySourceChecks || {},
  });
  const profiles = (model.profiles || []).map((profile) => buildProfile(
    profile,
    briefMap.get(profile.briefId) || {},
    partnerSpotlight,
    generatedAt,
  ));
  const decisionCases = profiles.filter((profile) => ["hbm", "demand", "nand", "partner"].includes(profile.panelId));
  const topDecisions = ["hbm", "demand", "nand"]
    .map((id) => insights.find((item) => item.id === id)?.decision)
    .filter(Boolean);
  const expiresAt = payload.expiresAt || quant.expiresAt || null;
  const decisionIntelligence = buildDecisionIntelligenceContent(quant);
  decisionIntelligence.decisionAutomation.catalogCoverage = {
    configured: Number(sourceCoverage.configuredSources || 0),
    observed: Number(sourceCoverage.observedSources || 0),
    fresh: Number(sourceCoverage.freshObservedSources || 0),
    observationRatePct: Number(sourceCoverage.observationCoveragePct || 0),
    officialConfigured: Number(sourceCoverage.officialConfigured || 0),
    officialObserved: Number(sourceCoverage.officialObserved || 0),
    officialFresh: Number(sourceCoverage.officialFreshObserved || 0),
    targetPct: 90,
  };
  const departmentWorkbench = buildDepartmentHomepage({
    decisionIntelligence,
    sourceCoverage,
    payload,
    insights,
    generatedAt,
  });
  const strategyBoard = buildStrategyBoard(payload, generatedAt, decisionIntelligence, quant.strategyAccountIntelligence || {});
  const content = {
    schemaVersion: "1.1",
    runId: payload.runId || quant.runId || null,
    generatedAt,
    expiresAt,
    clientArtifact: true,
    generation: {
      method: "verified-data-plus-approved-framework",
      frameworkVersion: model.schemaVersion,
      failClosed: true,
      sourceRunId: payload.runId || quant.runId || null,
    },
    siteAutomation: buildSiteAutomation({
      runId: payload.runId || quant.runId || null,
      generatedAt,
      sourceCoverage,
    }),
    freshness: {
      status: payload.quality?.status || "unavailable",
      evidenceCount: Number(payload.evidence?.promotedCount || payload.news?.length || 0),
      briefCount: insights.length,
      sourceCount: new Set(insights.map((item) => item.latest.source).filter(Boolean)).size,
      configuredSources: Number(sourceCoverage.configuredSources || 0),
      observedSources: Number(sourceCoverage.observedSources || 0),
      freshObservedSources: Number(sourceCoverage.freshObservedSources || 0),
      staleObservedSources: Number(sourceCoverage.staleObservedSources || 0),
      officialConfigured: Number(sourceCoverage.officialConfigured || 0),
      officialObserved: Number(sourceCoverage.officialObserved || 0),
      officialFreshObserved: Number(sourceCoverage.officialFreshObserved || 0),
      discoveryQueries: Number(sourceCoverage.discoveryQueries || 0),
      connectedHealthChecks: Number(sourceCoverage.connectedHealthChecks || 0),
      healthChecks: Number(sourceCoverage.healthChecks || 0),
      scheduleHours: Number(sourceCoverage.scheduleHours || sourceCatalog.refreshPolicy.scheduleHours),
      browserRecheckMinutes: Number(sourceCoverage.browserRecheckMinutes || sourceCatalog.refreshPolicy.browserRecheckMinutes),
      sourceCatalogVersion: sourceCoverage.version || sourceCatalog.schemaVersion,
    },
    presentation: {
      ...(model.presentation || {}),
      refreshPolicy: {
        ...(model.presentation?.refreshPolicy || {}),
        scheduleHours: Number(sourceCoverage.scheduleHours || sourceCatalog.refreshPolicy.scheduleHours),
        browserRecheckMinutes: Number(sourceCoverage.browserRecheckMinutes || sourceCatalog.refreshPolicy.browserRecheckMinutes),
        sourceCatalogVersion: sourceCoverage.version || sourceCatalog.schemaVersion,
        runId: payload.runId || quant.runId || null,
        generatedAt,
      },
    },
    decisionControl: buildDecisionControl(payload, sourceCoverage, generatedAt, expiresAt),
    decisionIntelligence,
    hero: {
      titleLines: model.strategyMandate?.titleLines || [],
      thesis: model.strategyMandate?.scope || [],
      currentDecisions: topDecisions,
      scope: model.strategyMandate?.scope || [],
      capabilities: model.strategyMandate?.capabilities || [],
      workProducts: model.strategyMandate?.workProducts || [],
      workflow: model.strategyMandate?.workflow || [],
      output: model.strategyMandate?.output || {},
      departmentWorkbench,
      status: `3개 고객 과제 · ${String(generatedAt).slice(0, 10)}`,
    },
    organizationOperatingModel: buildOrganizationOperatingModel(
      insights,
      generatedAt,
      payload.runId || quant.runId || null,
    ),
    decisionCases,
    insights,
    competitors: buildCompetitors(quant),
    partnerSpotlight,
    aiFactorySystem: buildAIFactorySystem(payload, sourceCoverage, generatedAt),
    workloadOptimization: buildWorkloadOptimization(payload, sourceCoverage, generatedAt, decisionIntelligence),
    strategyBoard,
    caseClassification: model.caseClassification || [],
    agentCouncil: {
      title: "AI Infra Strategy Agent Council",
      subtitle: "고객 Pain · Workload/SLO · 메모리 대안 · 경제성 · 90일 Gate",
      agendas: profiles,
    },
    footer: {
      year: new Date(generatedAt).getUTCFullYear(),
      disclosure: "Independent strategy portfolio based on public information; not an official SK hynix website.",
    },
  };
  const normalizedContent = normalizeDisplayPayload(content);
  const validation = validateSiteContent(normalizedContent);
  if (!validation.ok) throw new Error(`site content validation failed: ${validation.errors.join(", ")}`);
  return normalizedContent;
}

export { model as siteContentModel };
