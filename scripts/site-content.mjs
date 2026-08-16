import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSourceCatalogSnapshot, catalogSourceForUrl, loadSourceCatalog } from "./source-catalog.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const model = Object.freeze(JSON.parse(readFileSync(resolve(root, "data", "site-content-model.json"), "utf8")));
const sourceCatalog = loadSourceCatalog();

const directUrl = (value = "") => /^https?:\/\//i.test(String(value || "")) && !/news\.google\.com/i.test(String(value || ""));
const compact = (value = "", limit = 180) => {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(1, limit - 1)).trimEnd()}…`;
};
const publishedAt = (item = {}, fallback = null) => item.publishedAt || item.date || item.observedAt || item.crawledAt || fallback || null;
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
  };
}

function buildCompetitors(quant = {}) {
  return (quant.marketStructure?.companies || [])
    .filter((company) => ["SKHY", "삼성전자", "마이크론"].includes(company?.company))
    .map((company) => ({
      company: company.company,
      hbmShare: company.hbmShare || null,
      dramShare: company.dramShare2026 || company.dramShare2025 || null,
      nandShare: company.nandShare2026 || null,
      asOf: company.asOf || null,
      source: company.source || null,
      sourceUrl: directUrl(company.sourceUrl) ? company.sourceUrl : "",
      dataStatus: company.dataStatus || company.basis || "review",
    }));
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
  return {
    title: framework.title || "AI Factory System Optimization",
    thesis: framework.thesis || "Workload SLO와 단위경제성으로 AI Factory 전체 시스템을 공동 최적화합니다.",
    northStar: framework.northStar || {},
    architectureLayers: framework.architectureLayers || [],
    workloads: framework.workloads || [],
    decisionSequence: framework.decisionSequence || [],
    roadmap: framework.roadmap || [],
    evidencePolicy: framework.evidencePolicy || [],
    sources,
    signals: buildAIFactorySignals(payload, sourceIds),
    pillarCoverage,
    automation: {
      status: activePillars >= 6 ? "SYSTEM-COVERED" : activePillars >= 3 ? "PARTIAL" : "COVERAGE-GAP",
      activePillars,
      totalPillars: AI_FACTORY_PILLARS.length,
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

function buildWorkloadOptimization(payload = {}, sourceCoverage = {}, generatedAt = null) {
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

export function validateSiteContent(content = {}) {
  const errors = [];
  if (content.schemaVersion !== "1.0") errors.push("schemaVersion");
  if (!content.runId) errors.push("runId");
  if (!content.generatedAt || Number.isNaN(Date.parse(content.generatedAt))) errors.push("generatedAt");
  if (!Array.isArray(content.decisionCases) || content.decisionCases.length < 4) errors.push("decisionCases");
  if (!Array.isArray(content.insights) || content.insights.length < 4) errors.push("insights");
  if (!Array.isArray(content.agentCouncil?.agendas) || content.agentCouncil.agendas.length < 4) errors.push("agentCouncil.agendas");
  if (!Array.isArray(content.workloadOptimization?.process) || content.workloadOptimization.process.length < 6) errors.push("workloadOptimization.process");
  if (!Array.isArray(content.workloadOptimization?.serviceLines) || content.workloadOptimization.serviceLines.length < 3) errors.push("workloadOptimization.serviceLines");
  if (!Array.isArray(content.workloadOptimization?.sources) || content.workloadOptimization.sources.length < 4) errors.push("workloadOptimization.sources");
  if (!Array.isArray(content.aiFactorySystem?.architectureLayers) || content.aiFactorySystem.architectureLayers.length < 8) errors.push("aiFactorySystem.architectureLayers");
  if (!Array.isArray(content.aiFactorySystem?.workloads) || content.aiFactorySystem.workloads.length < 6) errors.push("aiFactorySystem.workloads");
  if (!Array.isArray(content.aiFactorySystem?.decisionSequence) || content.aiFactorySystem.decisionSequence.length < 8) errors.push("aiFactorySystem.decisionSequence");
  if (!Array.isArray(content.aiFactorySystem?.sources) || content.aiFactorySystem.sources.length < 8) errors.push("aiFactorySystem.sources");
  if (!Array.isArray(content.aiFactorySystem?.pillarCoverage) || content.aiFactorySystem.pillarCoverage.length < 6) errors.push("aiFactorySystem.pillarCoverage");
  if (!content.aiFactorySystem?.automation?.status) errors.push("aiFactorySystem.automation");
  if (!Array.isArray(content.caseClassification) || content.caseClassification.length !== 3) errors.push("caseClassification");
  if (!content.decisionControl?.integrity?.status || !content.decisionControl?.freshness?.status || !content.decisionControl?.coverage?.status || !content.decisionControl?.confidence?.status) errors.push("decisionControl");
  if (Number(content.freshness?.configuredSources || 0) < 20) errors.push("freshness.configuredSources");
  if (Number(content.freshness?.officialConfigured || 0) < 15) errors.push("freshness.officialConfigured");
  for (const item of content.insights || []) {
    if (!item?.latest?.title || !item?.decision || !item?.action) errors.push(`insight:${item?.id || "unknown"}`);
    if (item?.latest?.url && !directUrl(item.latest.url)) errors.push(`insight-url:${item?.id || "unknown"}`);
  }
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
  const content = {
    schemaVersion: "1.0",
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
    decisionControl: buildDecisionControl(payload, sourceCoverage, generatedAt, expiresAt),
    hero: {
      titleLines: model.strategyMandate?.titleLines || [],
      thesis: topDecisions.length ? topDecisions : model.strategyMandate?.scope || [],
      scope: model.strategyMandate?.scope || [],
      capabilities: model.strategyMandate?.capabilities || [],
      status: `${String(payload.quality?.status || "review").toUpperCase()} · 출처 ${sourceCoverage.observedSources || 0}개 관측 · ${String(generatedAt).slice(0, 10)}`,
    },
    decisionCases,
    insights,
    competitors: buildCompetitors(quant),
    partnerSpotlight,
    aiFactorySystem: buildAIFactorySystem(payload, sourceCoverage, generatedAt),
    workloadOptimization: buildWorkloadOptimization(payload, sourceCoverage, generatedAt),
    caseClassification: model.caseClassification || [],
    agentCouncil: {
      title: "AI Infra Strategy Agent Council",
      subtitle: `최신 검증 근거 ${insights.length}개 축을 Business Outcome·Workload/SLO·지배 병목·경제성·실행 Gate로 재구성`,
      agendas: profiles,
    },
    footer: {
      year: new Date(generatedAt).getUTCFullYear(),
      disclosure: "Independent strategy portfolio based on public information; not an official SK hynix website.",
    },
  };
  const validation = validateSiteContent(content);
  if (!validation.ok) throw new Error(`site content validation failed: ${validation.errors.join(", ")}`);
  return content;
}

export { model as siteContentModel };
