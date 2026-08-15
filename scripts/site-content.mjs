import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const model = Object.freeze(JSON.parse(readFileSync(resolve(root, "data", "site-content-model.json"), "utf8")));

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
  const content = {
    schemaVersion: "1.0",
    runId: payload.runId || quant.runId || null,
    generatedAt,
    expiresAt: payload.expiresAt || quant.expiresAt || null,
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
    },
    hero: {
      titleLines: model.strategyMandate?.titleLines || [],
      thesis: topDecisions.length ? topDecisions : model.strategyMandate?.scope || [],
      scope: model.strategyMandate?.scope || [],
      capabilities: model.strategyMandate?.capabilities || [],
      status: `${String(payload.quality?.status || "review").toUpperCase()} · ${insights.length}개 전략 Brief · ${String(generatedAt).slice(0, 10)}`,
    },
    decisionCases,
    insights,
    competitors: buildCompetitors(quant),
    partnerSpotlight,
    agentCouncil: {
      title: "AI Infra Strategy Agent Council",
      subtitle: `최신 검증 근거 ${insights.length}개 축을 고객 Pain·Workload·사업성·실행 Gate로 재구성`,
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
