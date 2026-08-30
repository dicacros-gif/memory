import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSourceCatalogSnapshot, catalogSourceForUrl, loadSourceCatalog } from "./source-catalog.mjs";
import { isEvidenceDocumentUrl } from "./evidence-document.mjs";
import { executiveBulletCopy } from "./executive-copy.mjs";
import { normalizeKoreanTerminology } from "./translation-pipeline.mjs";

// The relationship map admits two evidence tiers: an official/filing backbone
// and authoritative-media corroboration. Estimates and hypotheses stay out.
// The builder and the validator both read these, so the published policy and
// the rule that enforces it cannot drift apart.
const VERIFIED_VIEW_SOURCE_CLASSES = Object.freeze(["official", "filing", "authoritative-media"]);
const VERIFIED_VIEW_EVIDENCE_GRADES = Object.freeze(["OFFICIAL", "FILING", "CORROBORATED"]);
const VERIFIED_VIEW_POLICY_SUMMARY = "업체: 검증 관계의 양 끝점 · 관계선: verified-fact · 공식 원문·공시 또는 authoritative-media 교차 · 최근 36개월 · 기업쌍당 대표 1건";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const model = Object.freeze(JSON.parse(readFileSync(resolve(root, "data", "site-content-model.json"), "utf8")));
const accountModel = Object.freeze(JSON.parse(readFileSync(resolve(root, "data", "accounts.json"), "utf8")));
const capitalPlanModel = Object.freeze(JSON.parse(readFileSync(resolve(root, "data", "capital-plans.json"), "utf8")));
const technologyMemoryMap = Object.freeze(JSON.parse(readFileSync(resolve(root, "data", "technology-memory-map.json"), "utf8")));
const sourceCatalog = loadSourceCatalog();
const siteMarkup = readFileSync(resolve(root, "index.html"), "utf8");
const RETIRED_SECTION_IDS = new Set([
  "ai-factory-system", "aiFactoryKpiTree", "workload-optimization", "ragOperatingModel",
  "workload-map", "memory-fabric", "strategy-architecture", "macro",
]);

const LANDING_SECTION_IDS = new Set([
  "home", "departmentDecisionQueue", "keyAccounts", "strategy-architecture", "decision-lab", "decision-automation", "initiatives",
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
    .filter((id) => !RETIRED_SECTION_IDS.has(id))
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
const normalizedSourceClass = (value = "") => String(value || "").trim().toLocaleLowerCase("en-US");
const normalizedRuleKey = (value = "") => String(value || "").trim().toLocaleLowerCase("en-US");
const technologyRuleIndex = new Map(Object.entries(technologyMemoryMap.rules || {})
  .map(([key, value]) => [normalizedRuleKey(key), { key, ...value }]));
const technologyLensIndex = new Map((accountModel.technologyOpportunityLenses || [])
  .map((lens) => [lens.id, lens]));
export const technologyTranslation = (technology = {}) => {
  const configuredLens = technologyLensIndex.get(technology.id) || {};
  const candidates = [
    ...(technology.memoryMapKeys || configuredLens.memoryMapKeys || []),
    technology.label || configuredLens.label,
    ...(technology.aliases || configuredLens.aliases || []),
  ].map(normalizedRuleKey).filter(Boolean);
  const matched = candidates.map((key) => technologyRuleIndex.get(key)).find(Boolean) || null;
  const latest = technology.latest || {};
  const evidenceReady = technology.status === "opportunity-candidate"
    && Number(technology.sourceCount || 0) >= Number(technology.promotionRule?.minSources || 2)
    && Number(technology.mentions || 0) >= Number(technology.promotionRule?.minMentions || 2)
    && directUrl(latest.url);
  return {
    ...configuredLens,
    ...technology,
    status: evidenceReady ? "opportunity-candidate" : "monitoring",
    evidenceStatus: evidenceReady ? "cross-checked" : "insufficient",
    evidenceLabel: evidenceReady ? `${Number(technology.sourceCount || 0)}-SOURCE SIGNAL` : "MONITORING",
    translation: matched ? {
      ruleId: matched.key,
      systemShift: matched.systemShift || "",
      memoryNeed: matched.memoryNeed || "",
      productAxis: matched.productAxis || "",
      stage: matched.stage || technology.horizon || "MONITOR",
      gate: matched.gate || "고객 Workload 검증",
      status: "approved-rule",
    } : null,
    source: evidenceReady ? {
      name: latest.source || "원문",
      url: latest.url,
      asOf: latest.date || null,
      sourceClass: latest.sourceClass || "unclassified",
    } : null,
  };
};
const compact = (value = "", limit = 180) => {
  const text = collapseRedundantParenthetical(normalizeKoreanTerminology(executiveBulletCopy(String(value || ""))))
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
// A brief with no verified item yet used to print "최신 근거 확인 필요" into the
// title, the summary and the source, so the card said three times that it had
// nothing and never said what it was about. The content the brief already
// carries fills it instead, and `pending` marks the evidence slot as waiting —
// the claim is still not presented as verified, it is just no longer the only
// thing on the card.
// Evidence the ladder is allowed to print. The pipeline already flags an
// untranslated summary, and the console already refuses one; the landing
// prints to the same audience and now holds the same line.
const hangulCount = (value = "") => (String(value).match(/[가-힣]/g) || []).length;
const hanCount = (value = "") => (String(value).match(/[\u3400-\u9fff]/g) || []).length;

// A corporate About/Our Story/Careers page states no dated fact — it is the
// company describing itself, which is not evidence of anything that changed.
// The English list alone let "회사 소개 | 우리의 이야기 | 솔리다임" through and
// onto the NAND price card as that card's headline evidence.
// Same gloss collapse the browser policy applies, run at build time so the
// stored artifact never carries "SK hynix (SK hynix)" in the first place.
const REDUNDANT_PARENTHETICAL = /([\p{L}\p{N}][\p{L}\p{N}\s.&·-]{0,48}?)\s*[(（]\s*([^()（）]{1,50}?)\s*[)）]/gu;
const parenKey = (value = "") => String(value).toLowerCase().replace(/[\s.·-]+/gu, "");
const collapseRedundantParenthetical = (value) => String(value ?? "").replace(
  REDUNDANT_PARENTHETICAL,
  (match, lead, inner) => (parenKey(lead) && parenKey(lead) === parenKey(inner) ? lead : match),
);

const BOILERPLATE_TITLE = /\b(about (the )?(company|us)|our story|company overview|corporate profile|careers|privacy policy|terms of use|contact us|[a-z0-9-]+[-\s]overview)\b|회사\s?소개|우리의\s?이야기|기업\s?개요|회사\s?개요|채용\s?안내|개인정보\s?처리방침|이용\s?약관/i;

// A brief is not just a topic, it is a question. The DRAM brief asks where
// commodity prices are going; a CXMT lawsuit mentions DRAM and answers none
// of it, and it arrived as that card's headline because "about DRAM" was the
// only test being applied. Where a brief has a subject beyond its topic, the
// article has to speak to that subject. Briefs absent from this table keep
// the old behaviour, so this narrows two cards and changes nothing else.
const BRIEF_SUBJECT_TERMS = {
  dram: /price|pricing|contract|spot|asp|가격|단가|계약가|스팟|시황|출하|재고|감산|증산|공급\s?과잉/i,
  nand: /price|pricing|contract|spot|asp|nand|essd|ssd|qlc|tlc|가격|단가|계약가|스팟|시황|웨이퍼|출하|재고|감산/i,
};

function briefSubjectRelevant(brief = {}, latest = {}) {
  const terms = BRIEF_SUBJECT_TERMS[String(brief.id || "")];
  if (!terms) return true;
  return terms.test(`${latest.title || ""} ${latest.summary || ""} ${latest.originalTitle || ""}`);
}

const PROFILE_EVIDENCE_TERMS = {
  "hbm4-foundry": /hbm|custom memory|helios|advanced packaging|base.?die|chiplet|첨단\s?패키징|커스텀\s?메모리/i,
  "agentic-inference": /agentic|inference|serving|token|kv.?cache|goodput|추론|서빙|토큰/i,
  "enterprise-rag": /rag|retrieval|vector|enterprise storage|e?ssd|qlc|ai.?nand|검색|벡터|스토리지/i,
  "partner-new-biz": /sk hynix|skhy|pure storage|marvell|sandisk|partner|collabor|joint|공동개발|협업|파트너/i,
};
const PROFILE_EVIDENCE_DOMAINS = {
  "enterprise-rag": /(?:^|\.)(?:purestorage\.com|sandisk\.com|marvell\.com|skhynix\.com|solidigm\.com)$/i,
  "partner-new-biz": /(?:^|\.)(?:purestorage\.com|marvell\.com|sandisk\.com|skhynix\.com)$/i,
};

function profileEvidenceRelevant(profile = {}, latest = {}) {
  const terms = PROFILE_EVIDENCE_TERMS[profile.id];
  if (!terms) return true;
  let host = "";
  try { host = new URL(String(latest.url || "")).hostname.replace(/^www\./i, ""); } catch { /* fail closed */ }
  const domains = PROFILE_EVIDENCE_DOMAINS[profile.id];
  return (!domains || domains.test(host))
    && terms.test(`${latest.title || ""} ${latest.summary || ""} ${latest.source || ""}`);
}

function usableEvidence(latest = {}) {
  const title = String(latest.title || "");
  const summary = String(latest.summary || "");
  if (!title) return false;
  // A front page is not an article. Its text is the site meta description and
  // its date is the day we crawled, so a panel citing one reports a source and
  // an AS OF that nobody published. solidigm.com was the headline evidence
  // under both 수요·고객 and NAND·eSSD on that path.
  if (!isEvidenceDocumentUrl(latest.url)) return false;
  if (BOILERPLATE_TITLE.test(title)) return false;
  if (latest.translationStatus === "unverified") return false;
  if (latest.summaryLanguage === "source-original") return false;
  // Han script with no Hangul is an untranslated CJK item whichever flag the
  // upstream stage did or did not set.
  for (const value of [title, summary]) {
    if (hanCount(value) >= 6 && hangulCount(value) < 6) return false;
  }
  return true;
}
// brief.insight is the raw source summary with the site's own derived line
// appended. Falling back to it whole handed a rejected article straight back to
// the reader; the derived half is the part that is ours and publishable.
const derivedReading = (brief = {}) => {
  const rawLine = String(brief.latest?.summary || "").trim();
  const reading = String(brief.insight || "").trim();
  if (!rawLine || !reading.startsWith(rawLine)) return reading;
  return reading.slice(rawLine.length).replace(/^[\s·,.]+/, "").trim();
};

const briefLatest = (brief = {}, fallbackAt = null) => {
  const candidate = brief.latest || {};
  const latest = usableEvidence(candidate) && briefSubjectRelevant(brief, candidate) ? candidate : {};
  const pending = !latest.title;
  return {
    pending,
    title: compact(latest.title || brief.label || "", 150),
    summary: compact(latest.summary || derivedReading(brief) || "", 260),
    source: compact(latest.source || "", 70),
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
    // A newsroom index carries the lead story’s teaser but links to a list.
    // Quoting it puts an interview’s claim behind a URL that never shows it.
    if (!isEvidenceDocumentUrl(url)) return null;
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
      ? "RESEARCH"
      : fallbackSource?.sourceClass === "official"
        ? "OFFICIAL"
        : "WATCH";
    return {
      ...displayItem,
      evidence: current ? {
        status: current.claimType === "verified-fact" ? "official-fact" : "market-estimate",
        label: current.claimType === "verified-fact" ? "공식 확인" : "시장 추정",
        stage: ({ PLATFORM_ADOPTION: "플랫폼 채택", COMMERCIAL_SHIPMENT: "상업 출하", MASS_PRODUCTION: "양산", QUALIFICATION: "고객 인증", SAMPLE: "샘플", DESIGN: "공동 설계", REQUEST: "요구 확인" })[current.stage?.id || current.stage] || "공개",
        source: compact(current.source || "원문", 60),
        url: directUrl(current.sourceUrl) ? current.sourceUrl : "",
        asOf: current.asOf || current.publishedAt || null,
      } : {
        status: fallbackStatus,
        label: fallbackLabel,
        source: fallbackSource?.name || "",
        url: fallbackSource?.url || "",
        asOf: fallbackSource?.publishedAt || null,
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
    executionPortfolio: accountModel.executionPortfolio || {},
    layerModel: accountModel.layerModel || {},
    painTaxonomy: accountModel.painTaxonomy || [],
    whyLostTaxonomy: accountModel.whyLostTaxonomy || [],
    projects: accountModel.projects || [],
    groups: accountModel.groups || [],
    accounts: accountModel.accounts || [],
    mixTracker: {
      label: "GPU · ASIC CUSTOMER PORTFOLIO",
      status: "measured-crawl-separate-from-estimate",
      display: strategyAccountIntelligence.demandMix?.measurement || "동일 관측 묶음 내 계정 언급 비중",
      decision: "직접 관측과 제3자 수요 추정 분리",
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
  const publicSource = (sourceId) => {
    const source = sourceById.get(sourceId);
    if (!source || !directUrl(source.url)) return null;
    return {
      id: source.id,
      name: source.name,
      url: source.url,
      sourceClass: source.sourceClass,
      asOf: source.publishedAt || null,
    };
  };
  const executionPortfolio = {
    ...(accountModel.executionPortfolio || {}),
    tracks: (accountModel.executionPortfolio?.tracks || []).map((item) => ({
      ...item,
      source: publicSource(item.sourceId),
    })),
    partnerProof: (accountModel.executionPortfolio?.partnerProof || []).map((item) => ({
      ...item,
      source: publicSource(item.sourceId),
    })),
    channelLayers: (accountModel.executionPortfolio?.channelLayers || []).map((layer) => ({
      ...layer,
      companies: (layer.companies || []).map((item) => ({
        ...item,
        source: publicSource(item.sourceId),
      })),
    })),
    demandSignals: (accountModel.executionPortfolio?.demandSignals || []).map((item) => ({
      ...item,
      source: publicSource(item.sourceId),
    })),
  };
  const dellAccount = accountById.get("dell") || null;
  const dellChannel = accountModel.accounts?.find((account) => account.id === "dell")?.oemChannel || {};
  const dellLatestSignal = (dellAccount?.evidenceStream || [])
    .filter((item) => directUrl(item?.url || item?.sourceUrl || ""))
    .sort((left, right) => String(right.date || right.asOf || "").localeCompare(String(left.date || left.asOf || "")))[0] || null;
  const rackPlatformProfiles = new Map(
    ((model.ecosystemExecution?.layers || []).find((layer) => layer.id === "rack-platforms")?.companies || [])
      .map((company) => [company.id, company]),
  );
  const oemEcosystemSource = publicSource("nvidia-blackwell-oem-ecosystem");
    // Tier 1 brand OEM, Tier 2 ODM shipping racks straight to hyperscalers,
  // Tier 3 system vendors sharing the same NVL72 reference — one list, each
  // row carrying its tier, because qualification transfers along it.
  const OEM_TIERS = {
    dell: "TIER 1", hpe: "TIER 1", lenovo: "TIER 1", supermicro: "TIER 1",
    "quanta-qct": "TIER 2", wiwynn: "TIER 2", foxconn: "TIER 2", inventec: "TIER 2",
    gigabyte: "TIER 3", asus: "TIER 3", cisco: "TIER 3", fujitsu: "TIER 3",
  };
  const FEATURED_OEM_IDS = ["dell", "hpe", "quanta-qct", "foxconn", "cisco"];
  const oemAccountPrograms = FEATURED_OEM_IDS.map((id, index) => {
    if (id === "dell") return {
      id,
      index: String(index + 1).padStart(2, "0"),
      company: dellAccount?.company || "Dell Technologies",
      platform: dellAccount?.chip || "Dell AI Factory · PowerEdge AI Rack",
      stage: dellAccount?.chipStage || "Rack Roadmap 공개",
      pain: dellAccount?.pain || "Rack 전력·냉각·통합 인증·Agentic Inference TCO",
      memory: dellAccount?.memory || "HBM4 · Server DRAM · CXL · eSSD",
      gate: dellAccount?.gate || "Workload SLO · Rack Power · Qualification · Attach · Volume",
      tier: OEM_TIERS[id],
      source: dellLatestSignal ? {
        name: dellLatestSignal.source || "Dell Technologies",
        url: dellLatestSignal.url || dellLatestSignal.sourceUrl,
        asOf: dellLatestSignal.date || dellLatestSignal.asOf || null,
      } : publicSource("dell-agentic-ai-2026"),
    };
    const profile = rackPlatformProfiles.get(id) || {};
    const plan = capitalPlanModel.plans?.[id] || {};
    return {
      id,
      index: String(index + 1).padStart(2, "0"),
      company: profile.name || id.toUpperCase(),
      platform: profile.focus || plan.plan || "AI Server Platform",
      stage: plan.outlook?.window || "공식 Roadmap 모니터",
      pain: profile.pain || plan.comment || "Rack 통합·Qualification·Supply",
      memory: [profile.action, "HBM4·Server DRAM·eSSD Qualification"].filter(Boolean).join(" · "),
      gate: [plan.outlook?.window, plan.outlook?.buys].filter(Boolean).join(" · "),
      tier: OEM_TIERS[id],
      insight: plan.outlook?.converts || plan.comment || "Reference 인증을 Rack 물량으로 전환",
      source: oemEcosystemSource,
    };
  }).filter((account) => account.platform && account.pain && account.memory && account.gate);
  const oemChannel = dellAccount ? {
    schemaVersion: "1.0",
    status: "official-source-connected",
    title: "Server OEM · Rack Platform Account Program",
    lede: "Rack Roadmap → System Pain → Memory Stack → Qualification Gate",
    automation: {
      ruleId: "oem-rack-roadmap",
      cadence: "event+poll",
      failClosed: true,
      decision: "",
    },
    primaryAccount: {
      id: dellAccount.id,
      company: dellAccount.company,
      platform: dellAccount.chip,
      stage: dellAccount.chipStage,
      pain: dellAccount.pain,
      memory: dellAccount.memory,
      gate: dellAccount.gate,
      buyingCriteria: dellAccount.buyingCriteria,
      source: dellLatestSignal ? {
        name: dellLatestSignal.source || "Dell Technologies",
        url: dellLatestSignal.url || dellLatestSignal.sourceUrl,
        asOf: dellLatestSignal.date || dellLatestSignal.asOf || null,
      } : publicSource("dell-agentic-ai-2026"),
    },
    accounts: oemAccountPrograms,
    groups: [
      {
        id: "dell",
        index: "01",
        title: "Dell · PowerEdge XE9712",
        companies: ["Dell Technologies"],
        observation: "Dell AI Factory · GB200 NVL72 Rack · Agentic AI 확장",
        constraint: dellAccount.pain,
        memoryMove: dellAccount.memory,
        gate: dellAccount.gate,
        source: publicSource("dell-agentic-ai-2026"),
      },
      {
        id: "brand-oem",
        index: "02",
        title: "Brand OEM · Blackwell Channel",
        companies: dellChannel.brandOems || ["Dell", "HPE", "Lenovo", "Supermicro"],
        observation: "NVIDIA Blackwell 지원 Server OEM 생태계",
        constraint: "Rack Power · Cooling · System Integration · Qualification",
        memoryMove: "공통 Reference 기반 HBM·Server DRAM·eSSD Qualification Package",
        gate: "Platform별 BOM · Thermal Envelope · Qualification Owner",
        source: publicSource("nvidia-blackwell-oem-ecosystem"),
      },
      {
        id: "odm",
        index: "03",
        title: "ODM · Hyperscaler Rack Channel",
        companies: dellChannel.odms || ["Foxconn", "QCT", "Wiwynn"],
        observation: "NVIDIA Blackwell 지원 대만계 Server ODM 생태계",
        constraint: "Hyperscaler별 Rack 사양 · 제조 Ramp · 공급 일정",
        memoryMove: "OEM 인증 자산 재사용 · ODM별 Attach·Volume 전환",
        gate: "Reference 호환성 · Ramp · Committed Volume · Margin",
        source: publicSource("nvidia-blackwell-oem-ecosystem"),
      },
    ],
  } : null;
  const priorityAccountIds = customerPortfolio.asicPortfolio?.priorityAccountIds || [];
  const priorityAsicAccounts = priorityAccountIds.map((id) => accountById.get(id)).filter(Boolean);
  const broadcomAccountIds = customerPortfolio.broadcomEcosystem?.accountIds || [];
  const DESIGN_PARTNER_GRADES = {
    "official-fact": "공식",
    "official-monitoring": "공식",
    FILING: "공시",
    OFFICIAL: "공식",
    "research-monitoring": "리서치",
    RESEARCH: "리서치",
    "market-estimate": "브로커 추정",
  };
  const asicDesignPartners = accounts.filter((account) => account.layer === "asic-partner");
  const designPartnersFor = (accountId) => asicDesignPartners
    .filter((partner) => (partner.servesAccounts || []).includes(accountId))
    .map((partner) => ({
      id: partner.id,
      company: partner.company,
      chip: compact(partner.chip || "", 90),
      // The grade travels with the partner. A broker-sourced role is shown
      // as a broker-sourced role, not withheld until it is official - which is
      // what removing the weaker-graded partner amounted to.
      grade: DESIGN_PARTNER_GRADES[partner.evidenceGrade || partner.evidence?.status || ""] || "보도",
    }));
  const broadcomAccounts = broadcomAccountIds
    .map((id) => accountById.get(id))
    .filter((account) => account?.broadcomStrategy)
    .map((account) => ({ ...account, designPartners: designPartnersFor(account.id) }));
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
    { id: "end-customer", index: "01", label: "AI CLOUD / MODEL CUSTOMER", role: "Workload · Capacity · Custom Silicon Buying Criteria" },
    { id: "accelerator-platform", index: "02", label: "ACCELERATOR PLATFORM", role: "GPU/XPU Roadmap · Software · Rack Architecture" },
    { id: "asic-partner", index: "03", label: "ASIC DESIGN PARTNER", role: "XPU Architecture · IP · Cost · Qualification" },
    { id: "foundry-package", index: "04", label: "FOUNDRY & PACKAGE", role: "Logic Node · 2.5D/3D Package · Ramp" },
    { id: "network-interconnect", index: "05", label: "NETWORK & OPTICS", role: "Scale-up/out Fabric · Optical I/O · Bandwidth/W" },
    { id: "memory-supply", index: "06", label: "MEMORY SUPPLIER", role: "HBM · AI-DRAM · AI-NAND/eSSD · Capacity" },
    { id: "oem-tier-1", index: "07", label: "TIER 1 · STRATEGIC OEM", role: "AI Rack Platform · Customer Qualification · Volume" },
    { id: "oem-tier-2", index: "08", label: "TIER 2 · AI SERVER ODM", role: "Hyperscaler Rack Architecture · BOM · Ramp" },
    { id: "oem-tier-3", index: "09", label: "TIER 3 · SYSTEM / AI INFRA", role: "System Integration · Fabric · Enterprise Channel" },
  ];
  const oemPriorityProfiles = [
    {
      id: "dell", company: "Dell", layer: "oem-tier-1", priorityTier: "TIER 1 · STRATEGIC OEM", priorityOrder: 1,
      systemRole: "AI Factory · PowerEdge Rack OEM", collaborationValue: "최우선 · Rack Reference 확장",
      portfolio: "Dell AI Factory · PowerEdge AI Rack", pain: "Rack 전력·냉각·통합 인증·Agentic Inference TCO",
      memoryOption: "HBM4 · Server DRAM · CXL · eSSD Reference Stack",
      buyingCriteria: ["Rack Power", "Liquid Cooling", "System Qualification", "Cost/Task", "Time-to-Deploy"],
      decision: "Workload SLO · Rack Power · Qualification · Attach · Volume", accent: "#d6a42f",
    },
    {
      id: "hpe", company: "HPE", layer: "oem-tier-1", priorityTier: "TIER 1 · STRATEGIC OEM", priorityOrder: 2,
      systemRole: "Enterprise AI System · Rack OEM", collaborationValue: "최우선 · Enterprise Reference Stack",
      portfolio: "Enterprise AI System · Private Cloud AI", pain: "Rack 통합·가용성·운영 이식성",
      memoryOption: "HBM · Server DRAM · CXL · eSSD Reference Stack",
      buyingCriteria: ["Interoperability", "Availability", "Serviceability", "Enterprise Support"],
      decision: "공동 Reference 설계 · 상호운용성 · 고객 Qualification · Volume", accent: "#d6a42f",
    },
    {
      id: "lenovo", company: "Lenovo", layer: "oem-tier-1", priorityTier: "TIER 1 · STRATEGIC OEM", priorityOrder: 3,
      systemRole: "Global AI Server · Rack OEM", collaborationValue: "최우선 · 글로벌 인증 재사용",
      portfolio: "Global AI Server · Hybrid AI Infrastructure", pain: "지역별 인증·Thermal·Supply 변동",
      memoryOption: "공통 Memory BOM · 지역별 Qualification 재사용",
      buyingCriteria: ["Regional Certification", "Thermal", "Supply Continuity", "Lifecycle"],
      decision: "공통 BOM Lock · 지역 인증 · 공급 계획 · Commercial Ramp", accent: "#d6a42f",
    },
    {
      id: "supermicro", company: "Supermicro", layer: "oem-tier-1", priorityTier: "TIER 1 · STRATEGIC OEM", priorityOrder: 4,
      systemRole: "고밀도 GPU Rack · Rapid-Ramp OEM", collaborationValue: "최우선 · 빠른 Rack Cell 검증",
      portfolio: "High-density GPU Rack · Liquid Cooling", pain: "Rapid Ramp·Liquid Cooling·Storage 병목",
      memoryOption: "Rack Cell 단위 HBM·Server DRAM·eSSD Validation",
      buyingCriteria: ["Time-to-Market", "Rack Density", "Liquid Cooling", "Storage Endurance"],
      decision: "Pilot Rack · Thermal · Reliability · 반복 주문 Gate", accent: "#d6a42f",
    },
    {
      id: "quanta-qct", company: "Quanta / QCT", layer: "oem-tier-2", priorityTier: "TIER 2 · AI SERVER ODM", priorityOrder: 1,
      systemRole: "Cloud Datacenter · AI Server ODM", collaborationValue: "매우 높음 · CSP Architecture 실행",
      portfolio: "Hyperscaler Rack · Cloud Datacenter Platform", pain: "CSP별 Rack Variant·Qualification·대량 Ramp",
      memoryOption: "Reusable HBM·Server DRAM·eSSD Reference Design",
      buyingCriteria: ["CSP Architecture Lock", "BOM", "Thermal", "Yield", "Volume"],
      decision: "고객 Architecture Lock · BOM · Pilot Yield · Volume Ramp", accent: "#2ba99a",
    },
    {
      id: "wiwynn", company: "Wiwynn", layer: "oem-tier-2", priorityTier: "TIER 2 · AI SERVER ODM", priorityOrder: 2,
      systemRole: "Hyperscale Datacenter System ODM", collaborationValue: "매우 높음 · 직접 Hyperscaler 적용",
      portfolio: "Hyperscale Datacenter System · Rack Integration", pain: "전력밀도·Serviceability·Lifecycle TCO",
      memoryOption: "Memory Tier · Telemetry · Lifecycle 공동 최적화",
      buyingCriteria: ["Power Density", "Serviceability", "Telemetry", "Lifecycle TCO"],
      decision: "Rack SLO · Telemetry · 현장 교체성 · TCO Gate", accent: "#2ba99a",
    },
    {
      id: "foxconn", company: "Foxconn", layer: "oem-tier-2", priorityTier: "TIER 2 · AI SERVER ODM", priorityOrder: 3,
      systemRole: "Hyperscale Rack ODM · 대량 제조", collaborationValue: "매우 높음 · Capacity·BOM 실행",
      portfolio: "Hyperscale AI Rack · System Manufacturing", pain: "물량 Ramp·Package·BOM·납기 동시 관리",
      memoryOption: "Capacity · BOM · Yield 공동 Gate",
      buyingCriteria: ["Volume", "BOM Cost", "Yield", "Delivery", "Package Schedule"],
      decision: "Binding Volume · BOM Lock · Pilot Yield · 납기 Gate", accent: "#2ba99a",
    },
    {
      id: "inventec", company: "Inventec", layer: "oem-tier-2", priorityTier: "TIER 2 · AI SERVER ODM", priorityOrder: 4,
      systemRole: "AI Server · Cloud Platform ODM", collaborationValue: "매우 높음 · 고객별 System 실행",
      portfolio: "AI Server Platform · Cloud System Integration", pain: "고객별 BOM·Platform 인증·양산 수율",
      memoryOption: "HBM·Host DRAM·eSSD 공통 BOM과 고객별 Variant",
      buyingCriteria: ["Customer Design Lock", "BOM", "Pilot Yield", "Volume Ramp"],
      decision: "설계 Lock · EVT/DVT · Pilot Yield · Volume Gate", accent: "#2ba99a",
    },
    {
      id: "gigabyte", company: "Giga Computing (GIGABYTE)", shortName: "Giga Computing", layer: "oem-tier-3", priorityTier: "TIER 3 · SYSTEM / AI INFRA", priorityOrder: 1,
      systemRole: "GPU Server · AI System Vendor", collaborationValue: "선별 협력 · Server Channel 확장",
      portfolio: "GPU Server · Rack-scale AI System", pain: "Platform Variant·Thermal·Channel Attach",
      memoryOption: "Server DRAM·eSSD Reference Configuration",
      buyingCriteria: ["Accelerator Compatibility", "Thermal", "Channel Attach", "Lead Time"],
      decision: "Platform Qualification · Thermal · Channel Volume", accent: "#4d7fff",
    },
    {
      id: "asus", company: "ASUS", layer: "oem-tier-3", priorityTier: "TIER 3 · SYSTEM / AI INFRA", priorityOrder: 2,
      systemRole: "AI Server · Workstation System Vendor", collaborationValue: "선별 협력 · Enterprise·Edge 확장",
      portfolio: "AI Server · Workstation · Edge System", pain: "가속기 호환·Firmware·다중 Channel 운영",
      memoryOption: "Server DRAM·eSSD·Edge Memory Bundle",
      buyingCriteria: ["Compatibility", "Firmware", "Reliability", "Channel Ramp"],
      decision: "Compatibility · Firmware · Reliability · Channel Gate", accent: "#4d7fff",
    },
    {
      id: "cisco", company: "Cisco", layer: "oem-tier-3", priorityTier: "TIER 3 · SYSTEM / AI INFRA", priorityOrder: 3,
      systemRole: "AI Infrastructure · Networking · Enterprise System", collaborationValue: "전략적 · Fabric 연계 검증",
      portfolio: "AI Server · Ethernet Fabric · Enterprise Operations", pain: "GPU Server와 Fabric·Data Tier의 종단 SLO",
      memoryOption: "GPU Server·Fabric·Memory/Data Tier 통합 Validation",
      buyingCriteria: ["Network SLO", "Interoperability", "Observability", "Enterprise Support"],
      decision: "Fabric SLO · 상호운용성 · 운영 지원 · 고객 PoC", accent: "#4d7fff",
    },
    {
      id: "fujitsu", company: "Fujitsu", layer: "oem-tier-3", priorityTier: "TIER 3 · SYSTEM / AI INFRA", priorityOrder: 4,
      systemRole: "Enterprise · HPC System OEM", collaborationValue: "선별 협력 · HPC/AI Workload 확장",
      portfolio: "Enterprise AI · HPC System Platform", pain: "Workload별 성능·신뢰성·지역 공급 조건",
      memoryOption: "HPC/AI Workload별 HBM·Server Memory 구성",
      buyingCriteria: ["Workload Benchmark", "Reliability", "Regional Supply", "Lifecycle"],
      decision: "Benchmark · Reliability · 지역 공급 · Lifecycle Gate", accent: "#4d7fff",
    },
  ];
  const oemPriorityById = new Map(oemPriorityProfiles.map((company) => [company.id, company]));
  const dynamicsLogoDomains = {
    nvidia: "nvidia.com", google: "google.com", microsoft: "microsoft.com", aws: "aws.amazon.com",
    amd: "amd.com",
    apple: "apple.com", spacex: "spacex.com", spacexai: "spacex.com", meta: "meta.com", tesla: "tesla.com",
    dell: "dell.com", oracle: "oracle.com", openai: "openai.com", anthropic: "anthropic.com",
    coreweave: "coreweave.com", broadcom: "broadcom.com", marvell: "marvell.com", coherent: "coherent.com",
    mediatek: "mediatek.com", alchip: "alchip.com", guc: "guc-asic.com",
    tsmc: "tsmc.com", cxmt: "cxmt.com", hpe: "hpe.com", lenovo: "lenovo.com", supermicro: "supermicro.com",
    "quanta-qct": "qct.io", wiwynn: "wiwynn.com", foxconn: "foxconn.com", inventec: "inventec.com",
    gigabyte: "gigabyte.com", asus: "asus.com", cisco: "cisco.com", fujitsu: "fujitsu.com",
  };
  const dynamicsLocalLogos = {
    skhynix: "assets/img/brands/sk-hynix.svg",
    samsung: "assets/img/brands/samsung.svg",
    micron: "assets/img/brands/micron.svg",
  };
  const dynamicsLogoFor = (id = "") => dynamicsLocalLogos[id]
    || (dynamicsLogoDomains[id] ? `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(`https://${dynamicsLogoDomains[id]}`)}&sz=128` : "");
  const supplierProfiles = new Map([
    ["skhynix", { portfolio: "Custom HBM · AI-DRAM · AI-NAND/eSSD", position: "AI Memory 공동설계 · Full-stack Memory", decision: "계정별 Architecture Lock · LTA · Capacity" }],
    ["samsung", { portfolio: "HBM · Foundry · Package", position: "로직·메모리·패키징 통합 경쟁", decision: "HBM4 Ramp · Yield · Qualification" }],
    ["micron", { portfolio: "HBM · DRAM · NAND", position: "미국 공급망 · 효율 경쟁", decision: "Customer Qualification · Supply Mix" }],
    ["cxmt", { portfolio: "DRAM · LPDDR", position: "중국 범용 메모리 경쟁", decision: "승인 · 캐파 · Contract Price" }],
  ]);
  const dynamicsLayerOverrideById = new Map([
    ["nvidia", "accelerator-platform"],
    ["coherent", "network-interconnect"],
  ]);
  const supplementalDynamicsProfiles = [
    {
      id: "amd",
      company: "AMD",
      layer: "accelerator-platform",
      role: "GPU · CPU · AI Compute Platform",
      portfolio: "AMD Instinct GPU · EPYC · ROCm",
      position: "OpenAI 6GW 단계 배치 · 공식 전략 파트너십",
      decision: "Platform Milestone · Rack Qualification · HBM Capacity · Software Readiness",
      pain: "Multi-GW GPU Ramp와 HBM Capacity·Rack Power·Software Enablement 동기화",
      memoryOption: "Instinct 세대별 HBM Qualification · Capacity · Rack Memory Tier 공동 계획",
      buyingCriteria: ["Performance/W", "HBM Capacity", "Rack Qualification", "ROCm Readiness", "Deployment Milestone"],
      baseline: [{ label: "OPENAI", value: "6GW AMD GPU 단계 배치 · 2026 H2 시작 계획" }],
      stage: { id: "ANNOUNCED", label: "공식 발표 · 단계 배치" },
      demandClass: "accelerator-platform",
      servesAccounts: ["OpenAI"],
      latestSignal: null,
      evidenceCount: 1,
      accent: "#d74634",
      logo: dynamicsLogoFor("amd"),
      source: sourceById.get("openai-amd-6gw-2025") ? {
        name: sourceById.get("openai-amd-6gw-2025").name,
        url: sourceById.get("openai-amd-6gw-2025").url,
      } : null,
      priorityTier: "",
      priorityOrder: null,
      systemRole: "GPU · CPU · AI Compute Platform",
      collaborationValue: "6GW Compute Capacity · OpenAI Workload 공동 최적화",
    },
  ];
  const dynamicsNodes = [
    ...accounts.filter((account) => ["end-customer", "asic-partner", "foundry-package"].includes(account.layer)).map((account) => {
      const priorityProfile = oemPriorityById.get(account.id) || null;
      const layerId = priorityProfile?.layer || dynamicsLayerOverrideById.get(account.id) || account.layer;
      return {
        id: account.id,
        company: priorityProfile?.company || account.company,
        layer: layerId,
        role: priorityProfile?.systemRole || dynamicsLayers.find((layer) => layer.id === layerId)?.role || "Value Chain",
        portfolio: priorityProfile?.portfolio || account.chip || account.memory || "",
        position: priorityProfile ? `${priorityProfile.priorityTier} · ${priorityProfile.collaborationValue}` : account.relationship || account.pain || "",
        decision: priorityProfile?.decision || account.gate || "",
        pain: priorityProfile?.pain || account.pain || "공개 Workload 병목 확인 필요",
        memoryOption: priorityProfile?.memoryOption || account.memory || "Requirement Lock 우선",
        buyingCriteria: priorityProfile?.buyingCriteria || account.buyingCriteria || [],
        baseline: account.baseline || [],
        stage: priorityProfile ? { id: "STRATEGIC_HYPOTHESIS", label: "협력 후보 · 검증 전" } : account.stage || null,
        demandClass: account.demandClass || "ecosystem",
        servesAccounts: (account.servesAccounts || []).map((id) => accountById.get(id)?.company).filter(Boolean),
        latestSignal: (account.evidenceStream || [])
          .filter((item) => item?.title)
          .sort((left, right) => String(right.date || "").localeCompare(String(left.date || "")))[0] || null,
        evidenceCount: Number((account.evidenceStream || []).length),
        accent: priorityProfile?.accent || account.accent || "#255ba8",
        logo: dynamicsLogoFor(account.id),
        source: account.evidence?.url ? { name: account.evidence.source || "원문", url: account.evidence.url } : null,
        priorityTier: priorityProfile?.priorityTier || "",
        priorityOrder: priorityProfile?.priorityOrder || null,
        systemRole: priorityProfile?.systemRole || "",
        collaborationValue: priorityProfile?.collaborationValue || "",
      };
    }),
    ...oemPriorityProfiles.filter((company) => !accountById.has(company.id)).map((company) => ({
      ...company,
      role: company.systemRole,
      position: `${company.priorityTier} · ${company.collaborationValue}`,
      baseline: [],
      stage: { id: "STRATEGIC_HYPOTHESIS", label: "협력 후보 · 검증 전" },
      demandClass: "rack-platform",
      servesAccounts: [],
      latestSignal: null,
      evidenceCount: 0,
      logo: dynamicsLogoFor(company.id),
      source: null,
    })),
    ...supplementalDynamicsProfiles,
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
        logo: dynamicsLogoFor(supplier.id),
        source: source ? { name: source.name, url: source.url } : null,
      };
    }),
  ];
  const dynamicsNodeById = new Map(dynamicsNodes.map((node) => [node.id, node]));
  const dynamicsRelations = [];
  const dynamicsRelationKeys = new Set();
  const relationshipPairKey = (relation = {}) => `${relation.type || "relation"}:${[relation.from, relation.to].sort().join(":")}`;
  const companyPairKey = (relation = {}) => [relation.from, relation.to].sort().join(":");
  const explicitRelationshipPairs = new Set((accountModel.ecosystemRelations || []).map(relationshipPairKey));
  const dynamicsSource = (source = null) => source && directUrl(source.url) ? {
    id: source.id || null,
    name: source.name || "원문",
    url: source.url,
    sourceClass: normalizedSourceClass(source.sourceClass),
    asOf: source.publishedAt || source.asOf || null,
  } : null;
  const derivedEvidenceGrade = ({ claim = "", sourceClass = "" } = {}) => {
    const normalizedClaim = String(claim || "").toLocaleLowerCase("en-US");
    const normalizedClass = normalizedSourceClass(sourceClass);
    if (/hypothesis|가설|candidate/.test(normalizedClaim)) return "HYPOTHESIS";
    if (/watch/.test(normalizedClaim)) return "WATCH";
    if (/estimate/.test(normalizedClaim)) return "RESEARCH ESTIMATE";
    if (normalizedClaim !== "verified-fact") return "";
    if (normalizedClass === "official") return "OFFICIAL";
    if (normalizedClass === "filing") return "FILING";
    if (normalizedClass === "authoritative-media") return "CORROBORATED";
    return "";
  };
  const addDynamicsRelation = (relation) => {
    if (!dynamicsNodeById.has(relation.from) || !dynamicsNodeById.has(relation.to)) return;
    const key = relation.id || `${relation.type}:${relation.from}:${relation.to}`;
    if (dynamicsRelationKeys.has(key)) return;
    const source = dynamicsSource(relation.source);
    const claim = relation.claim || "";
    const sourceClass = normalizedSourceClass(relation.sourceClass || source?.sourceClass);
    const evidenceGrade = String(relation.evidenceGrade || derivedEvidenceGrade({ claim, sourceClass })).toUpperCase();
    dynamicsRelationKeys.add(key);
    dynamicsRelations.push({
      ...relation,
      id: key,
      direction: relation.direction || (["supply", "investment"].includes(relation.type) ? "forward" : "bidirectional"),
      claim,
      sourceClass,
      evidenceGrade,
      effectiveAt: relation.effectiveAt || source?.asOf || null,
      status: relation.status || "monitoring",
      source,
    });
  };
  for (const partner of accounts.filter((account) => Array.isArray(account.servesAccounts) && account.servesAccounts.length)) {
    for (const targetId of partner.servesAccounts) {
      const target = accountById.get(targetId);
      if (!target) continue;
      if (explicitRelationshipPairs.has(relationshipPairKey({ type: "partnership", from: partner.id, to: targetId }))) continue;
      addDynamicsRelation({
        type: "partnership",
        from: partner.id,
        to: targetId,
        title: `${partner.company} × ${target.company}`,
        detail: partner.layer === "asic-partner" ? "XPU 설계 · Memory 선정 · Qualification 공동 실행" : "Logic Node · Package · Ramp 실행 연계",
        claim: partner.xpuEcosystem?.claim || "",
        sourceClass: partner.xpuEcosystem?.source?.sourceClass || "",
        evidenceGrade: partner.xpuEcosystem?.claim === "verified-fact" ? "OFFICIAL" : "",
        effectiveAt: partner.evidence?.asOf || null,
        status: partner.evidence?.status || "monitoring",
        source: partner.evidence?.url ? {
          name: partner.evidence.source || "원문",
          url: partner.evidence.url,
          sourceClass: partner.xpuEcosystem?.source?.sourceClass || "",
          asOf: partner.evidence.asOf || null,
        } : null,
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
      claim: relation.claim || "",
      sourceClass: source?.sourceClass || "",
      evidenceGrade: relation.evidenceGrade || "",
      effectiveAt: relation.effectiveAt || source?.publishedAt || null,
      status: relation.status,
      source: dynamicsSource(source),
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
      claim: "competitive-context",
      sourceClass: source?.sourceClass || "",
      evidenceGrade: "CONTEXT",
      effectiveAt: source?.publishedAt || null,
      status: "competitive-monitor",
      source: dynamicsSource(source),
    });
  }
  for (const relation of accountModel.ecosystemRelations || []) {
    const source = sourceById.get(relation.sourceId);
    addDynamicsRelation({
      id: relation.id,
      type: relation.type,
      from: relation.from,
      to: relation.to,
      title: relation.title || `${dynamicsNodeById.get(relation.from)?.company || relation.from} → ${dynamicsNodeById.get(relation.to)?.company || relation.to}`,
      detail: relation.detail || relation.note || "관계 변화 추적",
      domain: relation.domain || "",
      memoryImplication: relation.memoryImplication || "",
      decisionImpact: relation.decisionImpact || "",
      claim: relation.claim || "",
      sourceClass: source?.sourceClass || "",
      status: relation.status || "monitoring",
      effectiveAt: relation.effectiveAt || null,
      evidenceGrade: relation.evidenceGrade || "",
      source: dynamicsSource(source),
    });
  }
  for (const relation of strategyAccountIntelligence.ecosystemRelationships?.promoted || []) {
    const duplicate = dynamicsRelations.some((item) => relationshipPairKey(item) === relationshipPairKey(relation));
    if (duplicate) continue;
    addDynamicsRelation({
      id: relation.id,
      type: relation.type,
      from: relation.from,
      to: relation.to,
      title: relation.title,
      detail: relation.detail || "관계 변화 감지",
      domain: "AUTO-DETECTED",
      memoryImplication: "계정 Roadmap·Memory Interface·Capacity 영향 재검증",
      decisionImpact: "공식 원문 또는 독립 출처 교차 후 계정 전략에 반영",
      claim: relation.claim || (relation.officialEvidenceCount ? "verified-fact" : "corroborated"),
      sourceClass: relation.sourceClass || (relation.officialEvidenceCount ? "official" : "authoritative-media"),
      status: "자동 승격",
      effectiveAt: relation.asOf || null,
      evidenceGrade: relation.officialEvidenceCount ? "OFFICIAL" : "CORROBORATED",
      source: relation.sourceUrl ? {
        name: relation.source || "원문",
        url: relation.sourceUrl,
        sourceClass: relation.sourceClass || (relation.officialEvidenceCount ? "official" : "authoritative-media"),
        asOf: relation.asOf || null,
      } : null,
    });
  }
  for (const company of oemPriorityProfiles) {
    addDynamicsRelation({
      id: `strategic-hypothesis:skhynix:${company.id}`,
      type: "hypothesis",
      from: "skhynix",
      to: company.id,
      title: `SK hynix × ${company.company}`,
      detail: company.systemRole,
      domain: "STRATEGIC HYPOTHESIS",
      memoryImplication: company.memoryOption,
      decisionImpact: company.decision,
      claim: "strategy-hypothesis",
      sourceClass: "",
      status: "협력 후보 · 검증 전",
      evidenceGrade: "HYPOTHESIS",
      effectiveAt: null,
      source: null,
    });
  }
  const dynamicsTypeLabels = {
    competition: "경쟁",
    partnership: "파트너십",
    investment: "투자",
    supply: "공급",
    integration: "플랫폼 통합",
    qualification: "인증·검증",
    exploration: "협력 탐색",
    adjacency: "전략 유사",
    hypothesis: "협력 후보",
  };
  const dynamicsTypeOrder = ["competition", "partnership", "investment", "supply", "integration", "qualification", "exploration", "adjacency", "hypothesis"];
  const generatedDate = new Date(generatedAt);
  const historyCutoffDate = Number.isNaN(generatedDate.getTime()) ? null : new Date(Date.UTC(
    generatedDate.getUTCFullYear(),
    generatedDate.getUTCMonth() - 36,
    1,
  ));
  const historyCutoff = historyCutoffDate ? historyCutoffDate.toISOString().slice(0, 10) : null;
  const relationDate = (relation = {}) => {
    const timestamp = Date.parse(String(relation.effectiveAt || ""));
    return Number.isNaN(timestamp) ? null : timestamp;
  };
  const generatedTimestamp = Number.isNaN(generatedDate.getTime()) ? null : generatedDate.getTime();
  for (const relation of dynamicsRelations) {
    const effectiveTimestamp = relationDate(relation);
    const ageMonths = generatedTimestamp == null || effectiveTimestamp == null
      ? null
      : Math.max(0, Math.floor((generatedTimestamp - effectiveTimestamp) / (1000 * 60 * 60 * 24 * 30.44)));
    relation.ageMonths = ageMonths;
    relation.freshnessBand = ageMonths == null ? "unknown" : ageMonths <= 6 ? "current" : ageMonths <= 18 ? "recent" : "history";
  }
  const verifiedViewEvidencePolicy = {
    summary: VERIFIED_VIEW_POLICY_SUMMARY,
    anchorId: "skhynix",
    claim: "verified-fact",
    sourceClasses: [...VERIFIED_VIEW_SOURCE_CLASSES],
    evidenceGrades: [...VERIFIED_VIEW_EVIDENCE_GRADES],
    requireDirectSource: true,
    requireEffectiveAt: true,
    historyWindowMonths: 36,
    historyCutoff,
    historyBoundary: "calendar-month-inclusive",
    uniqueEdgePerCompanyPair: true,
    representativePriority: ["latest-effectiveAt", "source-class", "relation-type"],
    excludedClaims: ["strategy-hypothesis", "watch", "market-estimate"],
    failClosed: true,
  };
  const isVerifiedViewCandidate = (relation = {}) => {
    if (relation.type === "hypothesis" || relation.claim !== verifiedViewEvidencePolicy.claim) return false;
    if (!relation.source || !directUrl(relation.source.url)) return false;
    if (!verifiedViewEvidencePolicy.sourceClasses.includes(normalizedSourceClass(relation.sourceClass))) return false;
    if (!verifiedViewEvidencePolicy.evidenceGrades.includes(String(relation.evidenceGrade || "").toUpperCase())) return false;
    const effectiveAt = relationDate(relation);
    if (effectiveAt == null || historyCutoffDate == null) return false;
    return effectiveAt >= historyCutoffDate.getTime();
  };
  const representativeSourcePriority = { official: 2, filing: 1 };
  const representativeTypePriority = { partnership: 7, supply: 6, integration: 5, qualification: 4, exploration: 3, investment: 2, adjacency: 1 };
  const compareVerifiedRelations = (left, right) => (relationDate(right) || 0) - (relationDate(left) || 0)
    || Number(representativeSourcePriority[normalizedSourceClass(right.sourceClass)] || 0) - Number(representativeSourcePriority[normalizedSourceClass(left.sourceClass)] || 0)
    || Number(representativeTypePriority[right.type] || 0) - Number(representativeTypePriority[left.type] || 0)
    || String(left.id || "").localeCompare(String(right.id || ""));
  const verifiedRelationGroups = new Map();
  for (const relation of dynamicsRelations.filter(isVerifiedViewCandidate)) {
    const key = companyPairKey(relation);
    if (!verifiedRelationGroups.has(key)) verifiedRelationGroups.set(key, []);
    verifiedRelationGroups.get(key).push(relation);
  }
  const verifiedRelations = [...verifiedRelationGroups.values()]
    .map((relations) => [...relations].sort(compareVerifiedRelations)[0])
    .sort(compareVerifiedRelations);
  const verifiedRelationIds = verifiedRelations.map((relation) => relation.id);
  const connectedCompanyIds = new Set(verifiedRelations.flatMap((relation) => [relation.from, relation.to]));
  connectedCompanyIds.add("skhynix");
  const siteCompanyIds = [
    "skhynix",
    ...dynamicsNodes.map((node) => node.id).filter((id) => id !== "skhynix"),
  ];
  const verifiedCompanyIds = siteCompanyIds.filter((id) => connectedCompanyIds.has(id));
  const verifiedLayerIds = dynamicsLayers
    .filter((layer) => dynamicsNodes.some((node) => connectedCompanyIds.has(node.id) && node.layer === layer.id))
    .map((layer) => layer.id);
  const verifiedTypeCounts = verifiedRelations.reduce((counts, relation) => {
    counts[relation.type] = Number(counts[relation.type] || 0) + 1;
    return counts;
  }, {});
  const verifiedTypes = dynamicsTypeOrder
    .filter((id) => Number(verifiedTypeCounts[id] || 0) > 0)
    .map((id) => ({ id, label: dynamicsTypeLabels[id] || id, count: Number(verifiedTypeCounts[id] || 0) }));
  const verifiedHistory = Object.fromEntries([...verifiedRelationGroups.values()]
    .map((relations) => [...relations].sort(compareVerifiedRelations))
    .filter((relations) => relations.length > 1)
    .map((relations) => [relations[0].id, relations.slice(1).map((relation) => ({
      id: relation.id,
      type: relation.type,
      direction: relation.direction,
      title: relation.title,
      domain: relation.domain,
      detail: relation.detail,
      memoryImplication: relation.memoryImplication,
      decisionImpact: relation.decisionImpact,
      status: relation.status,
      effectiveAt: relation.effectiveAt,
      ageMonths: relation.ageMonths,
      freshnessBand: relation.freshnessBand,
      evidenceGrade: relation.evidenceGrade,
      sourceClass: relation.sourceClass,
      source: relation.source,
    }))]));
  for (const relation of verifiedRelations) {
    relation.evidenceHistory = verifiedHistory[relation.id] || [];
  }
  const verifiedRelationByCompany = new Map();
  for (const relation of verifiedRelations) {
    const otherId = relation.from === "skhynix" ? relation.to : relation.from;
    verifiedRelationByCompany.set(otherId, relation);
  }
  const dynamicsCompanies = dynamicsNodes.map((node) => ({
    ...node,
    stage: node.priorityTier && verifiedRelationByCompany.has(node.id) ? {
      id: verifiedRelationByCompany.get(node.id).type === "exploration" ? "OFFICIAL_EXPLORATION" : "VERIFIED_RELATIONSHIP",
      label: verifiedRelationByCompany.get(node.id).status || "공식 관계",
    } : node.stage,
    relationCount: verifiedRelations.filter((relation) => relation.from === node.id || relation.to === node.id).length,
  }));
  const dynamicsRelationCounts = dynamicsRelations.reduce((counts, relation) => {
    counts[relation.type] = Number(counts[relation.type] || 0) + 1;
    return counts;
  }, {});
  const skhynixVerifiedView = {
    id: "skhynixVerified",
    anchorId: "skhynix",
    companyScope: "verified-connected-companies",
    relationScope: "verified-ecosystem-direct",
    companyIds: verifiedCompanyIds,
    relationIds: verifiedRelationIds,
    layerIds: verifiedLayerIds,
    types: verifiedTypes,
    counts: {
      companies: verifiedCompanyIds.length,
      connectedCompanies: connectedCompanyIds.size,
      unconnectedCompanies: 0,
      relations: verifiedRelationIds.length,
      layers: verifiedLayerIds.length,
      types: verifiedTypes.length,
      byType: verifiedTypeCounts,
      duplicateEvidence: Object.values(verifiedHistory).reduce((sum, items) => sum + items.length, 0),
    },
    excludedCount: dynamicsRelations.length - verifiedRelationIds.length,
    evidencePolicy: verifiedViewEvidencePolicy,
    evidenceHistory: verifiedHistory,
  };
  const competitiveDynamics = {
    eyebrow: "COMPETITIVE DYNAMICS · VALUE CHAIN",
    // The board led with 경쟁 and then showed none: every competition edge
    // carries claim "competitive-context" and grade CONTEXT, which the
    // verified policy excludes by construction. Competitive standing is our
    // reading, not a sourced fact about a relationship between two firms, so
    // the policy is right and the title was wrong.
    title: "파트너십 · 투자 · 공급 · 플랫폼 통합 관계 지도",
    description: "AI 수요 → 가속기 → ASIC → 파운드리·패키징 → 네트워크 → 메모리 → OEM/ODM · 공식 원문 관계만",
    updatedAt: generatedAt,
    types: dynamicsTypeOrder.map((id) => ({ id, label: dynamicsTypeLabels[id] || id, count: Number(dynamicsRelationCounts[id] || 0) })),
    // Enrich once so the layered view and the flat company list share the same
    // relationCount. The layered nodes previously shipped without it, so every
    // company rendered "0 RELATIONS" in the value-chain map.
    layers: dynamicsLayers.map((layer) => ({
      ...layer,
      companies: dynamicsCompanies.filter((node) => node.layer === layer.id),
    })),
    companies: dynamicsCompanies,
    relations: dynamicsRelations,
    defaultView: "skhynixVerified",
    views: { skhynixVerified: skhynixVerifiedView },
  };
  const enrichedTechnologyOpportunities = (strategyAccountIntelligence.technologyOpportunities || [])
    .map(technologyTranslation);
  const enrichedHorizonPortfolio = ["H1", "H2", "H3"].map((horizon) => ({
    horizon,
    items: enrichedTechnologyOpportunities.filter((item) => item.horizon === horizon && item.status === "opportunity-candidate"),
  }));
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
      executionPortfolio,
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
      oemChannel,
      demandMix: customerPortfolio.mixTracker,
      contractGate: {
        ...(customerPortfolio.contractGate || {}),
        evidence: contractEvent ? {
          status: contractEvent.claimType === "verified-fact" ? "official-fact" : "market-estimate",
          label: contractEvent.claimType === "verified-fact" ? "공식 확인" : "시장 추정",
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
      technologyOpportunities: enrichedTechnologyOpportunities,
      horizonPortfolio: enrichedHorizonPortfolio,
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

function buildEcosystemExecution(generatedAt = null, runId = null) {
  const execution = model.ecosystemExecution || {};
  const sources = (execution.sourceIds || [])
    .map((id) => (sourceCatalog.sources || []).find((source) => source.id === id))
    .filter((source) => directUrl(source?.url))
    .map((source) => ({
      id: source.id,
      name: source.name,
      url: source.url,
      sourceClass: source.sourceClass,
      tier: source.tier,
    }));
  return {
    ...execution,
    runId,
    generatedAt,
    sources,
    automation: {
      taxonomy: "account-silicon-rack",
      painAxes: ["data-movement", "bandwidth-capacity", "power-thermal", "qualification-tco"],
      decisionChain: (execution.decisionSpine || []).map((item) => item.label),
      decisionLenses: (execution.decisionLenses || []).map((item) => item.label),
      translationMode: "market-to-pain-to-memory-to-economics-to-execution",
      sourceMode: "catalog-official-first",
      updateMode: "daily-atomic-manifest",
    },
  };
}

// The two upper rungs of the evidence ladder.
//
// brief.insight is the raw source summary with the site's own derived price
// sentence appended, so using it for IMPLICATION printed the FACT again with
// a tail. Splitting it puts the source line on FACT and the derived reading on
// IMPLICATION — and when the source line is not publishable (untranslated, or
// a corporate About page), the measured price observation carries FACT instead,
// which is dated, verified and ours.
function priceObservation(price = {}) {
  if (!price || !price.item) return "";
  const daily = Number(price.dailyChangePct);
  const move = Number.isFinite(daily) ? `일간 ${daily > 0 ? "+" : ""}${daily.toFixed(2)}%` : "";
  return [[price.item, price.table].filter(Boolean).join(" · "), price.latestRaw || price.latest, move]
    .filter((part) => part || part === 0)
    .join(" · ");
}

function ladderRungs(brief = {}, latest = {}) {
  // `latest.summary` already falls back to the derived reading when the source
  // item was rejected, so a pending card must not treat it as a source line —
  // that would put the same sentence on both rungs again.
  const sourceLine = latest.pending ? "" : String(latest.summary || "").trim();
  const derived = compact(derivedReading(brief), 250).trim();
  // With no publishable source line, the measured price observation is the
  // fact: dated, verified, and ours.
  const fact = sourceLine || priceObservation(brief.price) || derived;
  const implication = derived && derived !== fact ? derived : "";
  return {
    fact,
    implication: implication || "원문 해석 연결 전 · 파생 관측만 사용",
  };
}
function buildInsight(brief = {}, fallbackAt = null) {
  const latest = briefLatest(brief, fallbackAt);
  return {
    id: brief.id || "brief",
    label: brief.label || "Memory Intelligence",
    evidenceCount: Number(brief.evidenceCount || 0),
    latest,
    ...ladderRungs(brief, latest),
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
  const candidate = isPartner ? partner : briefLatest(brief, generatedAt);
  const latest = profileEvidenceRelevant(profile, candidate)
    ? candidate
    : { pending: true, title: "", summary: "", source: "", url: "", publishedAt: generatedAt };
  const decision = compact(brief.decision || profile.fallbackDecision, 320);
  const stop = compact(brief.reversalKpi || profile.fallbackStop, 300);
  const pending = Boolean(latest.pending) || !latest.title;
  const sourceLabel = latest.source || "";
  const sourceDate = latest.publishedAt ? String(latest.publishedAt).slice(0, 10) : "";
  // Content first: until a verified item arrives, the evidence row carries the
  // decision this card exists to make, and says plainly that the source is the
  // part still missing.
  const evidenceTitle = latest.title || compact(profile.answerTitle, 150) || profile.title || "";
  const evidenceSummary = latest.summary || compact(profile.question, 260) || decision;
  const signals = [
    ...(!pending ? [[`${latest.evidenceLevel || "WATCH"} · ${String(latest.sourceClass || "SOURCE").toUpperCase()}`,
      evidenceTitle,
      evidenceSummary]] : []),
    ["EXECUTIVE DECISION", compact(profile.answerTitle, 80), decision],
    ["REVERSAL KPI", "판단 변경 조건", stop],
  ];
  const sources = [
    ...(!pending ? [[latest.evidenceLevel || "WATCH", `${sourceLabel} · ${sourceDate}`, latest.url || ""]] : []),
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
    subtitle: pending ? "" : `${sourceLabel} 검증 근거 · ${sourceDate}`,
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
    latest: { ...latest, pending, title: evidenceTitle, summary: evidenceSummary },
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
      owner: "AI Infra Planning",
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
      owner: compact(brief.owner || "AI Infra Planning", 100),
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
        owner: "AI Infra Planning",
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
  if (!Array.isArray(content.siteAutomation?.sectionIds) || !content.siteAutomation.sectionIds.length) errors.push("siteAutomation.sectionIds");
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
  const oemChannel = strategyBoard.customerPortfolio?.oemChannel;
  if (!oemChannel?.primaryAccount || oemChannel.primaryAccount.id !== "dell") errors.push("strategyBoard.customerPortfolio.oemChannel.primaryAccount");
  if (!Array.isArray(oemChannel?.groups) || oemChannel.groups.length !== 3) errors.push("strategyBoard.customerPortfolio.oemChannel.groups");
  if (!(oemChannel?.groups || []).every((group) => directUrl(group?.source?.url))) errors.push("strategyBoard.customerPortfolio.oemChannel.sources");
  if (!Array.isArray(strategyBoard.customerPortfolio?.projects) || strategyBoard.customerPortfolio.projects.length !== 3) errors.push("strategyBoard.customerPortfolio.projects");
  const broadcomAccounts = strategyBoard.customerPortfolio?.broadcomEcosystem?.accounts || [];
  if (!Array.isArray(broadcomAccounts) || broadcomAccounts.length !== 3) errors.push("strategyBoard.customerPortfolio.broadcomEcosystem.accounts");
  if (!broadcomAccounts.every((item) => item?.broadcomStrategy?.pains?.length >= 3 && item?.broadcomStrategy?.proposal?.length >= 3 && directUrl(item?.broadcomStrategy?.source?.url))) errors.push("strategyBoard.customerPortfolio.broadcomEcosystem.contract");
  const partnerEcosystem = strategyBoard.customerPortfolio?.partnerEcosystem?.partners || [];
  if (!Array.isArray(partnerEcosystem) || partnerEcosystem.length !== 2) errors.push("strategyBoard.customerPortfolio.partnerEcosystem.partners");
  const marvellNode = partnerEcosystem.find((item) => item.id === "marvell");
  if (!marvellNode || !["aws", "microsoft"].every((id) => (marvellNode.accounts || []).some((account) => account.id === id))) errors.push("strategyBoard.customerPortfolio.partnerEcosystem.marvell");
  const executionPortfolio = strategyBoard.customerPortfolio?.executionPortfolio || {};
  if (!Array.isArray(executionPortfolio.tracks) || executionPortfolio.tracks.length !== 5) errors.push("strategyBoard.customerPortfolio.executionPortfolio.tracks");
  if (!(executionPortfolio.tracks || []).every((item) => directUrl(item?.source?.url))) errors.push("strategyBoard.customerPortfolio.executionPortfolio.trackSources");
  if (!(executionPortfolio.tracks || []).some((item) => item.id === "pim-aimx" && item.stage === "system-demo")) errors.push("strategyBoard.customerPortfolio.executionPortfolio.pim");
  if (!(executionPortfolio.tracks || []).some((item) => item.id === "vertical-3d-dram" && item.stage === "research")) errors.push("strategyBoard.customerPortfolio.executionPortfolio.3dDram");
  if (!Array.isArray(executionPortfolio.partnerProof) || !["marvell-cmmax", "pure-directflash", "supermicro-aimx"].every((id) => executionPortfolio.partnerProof.some((item) => item.id === id && directUrl(item?.source?.url)))) errors.push("strategyBoard.customerPortfolio.executionPortfolio.partnerProof");
  if (!Array.isArray(executionPortfolio.channelLayers) || executionPortfolio.channelLayers.length !== 3 || !(executionPortfolio.channelLayers || []).every((layer) => (layer.companies || []).every((item) => directUrl(item?.source?.url)))) errors.push("strategyBoard.customerPortfolio.executionPortfolio.channelLayers");
  if (!Array.isArray(executionPortfolio.demandSignals) || executionPortfolio.demandSignals.length !== 3 || !(executionPortfolio.demandSignals || []).every((item) => directUrl(item?.source?.url))) errors.push("strategyBoard.customerPortfolio.executionPortfolio.demandSignals");
  const dynamics = strategyBoard.customerPortfolio?.competitiveDynamics || {};
  const dynamicsView = dynamics.views?.[dynamics.defaultView];
  const dynamicsCompanyById = new Map((dynamics.companies || []).map((company) => [company.id, company]));
  const dynamicsRelationById = new Map((dynamics.relations || []).map((relation) => [relation.id, relation]));
  const viewCompanies = (dynamicsView?.companyIds || []).map((id) => dynamicsCompanyById.get(id));
  const viewRelations = (dynamicsView?.relationIds || []).map((id) => dynamicsRelationById.get(id));
  if (dynamics.defaultView !== "skhynixVerified" || dynamicsView?.anchorId !== "skhynix") errors.push("strategyBoard.customerPortfolio.competitiveDynamics.defaultView");
  if (!dynamicsView || !dynamicsView.companyIds?.includes(dynamicsView.anchorId) || viewCompanies.some((company) => !company)) errors.push("strategyBoard.customerPortfolio.competitiveDynamics.viewCompanies");
  if (!dynamicsView || viewRelations.some((relation) => !relation)) errors.push("strategyBoard.customerPortfolio.competitiveDynamics.viewRelations");
  const viewPairs = viewRelations.filter(Boolean).map((relation) => [relation.from, relation.to].sort().join(":"));
  if (new Set(viewPairs).size !== viewPairs.length) errors.push("strategyBoard.customerPortfolio.competitiveDynamics.uniquePairs");
  const viewCutoff = Date.parse(String(dynamicsView?.evidencePolicy?.historyCutoff || ""));
  if (viewRelations.filter(Boolean).some((relation) => {
    const effectiveAt = Date.parse(String(relation.effectiveAt || ""));
    return relation.claim !== "verified-fact"
      || !VERIFIED_VIEW_SOURCE_CLASSES.includes(String(relation.sourceClass || "").trim().toLocaleLowerCase("en-US"))
      || !VERIFIED_VIEW_EVIDENCE_GRADES.includes(String(relation.evidenceGrade || "").toUpperCase())
      || !directUrl(relation.source?.url)
      || Number.isNaN(effectiveAt)
      || Number.isNaN(viewCutoff)
      || effectiveAt < viewCutoff;
  })) errors.push("strategyBoard.customerPortfolio.competitiveDynamics.evidencePolicy");
  if ((dynamicsView?.layerIds || []).some((layerId) => !(dynamics.layers || []).find((layer) => layer.id === layerId)?.companies?.some((company) => dynamicsView.companyIds.includes(company.id)))) errors.push("strategyBoard.customerPortfolio.competitiveDynamics.emptyLayer");
  if (Number(dynamicsView?.counts?.companies ?? 0) !== Number(dynamicsView?.companyIds?.length ?? -1)
    || Number(dynamicsView?.counts?.relations ?? 0) !== Number(dynamicsView?.relationIds?.length ?? -1)
    || Number(dynamicsView?.excludedCount ?? 0) !== Number((dynamics.relations || []).length - (dynamicsView?.relationIds?.length ?? 0))) errors.push("strategyBoard.customerPortfolio.competitiveDynamics.counts");
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
  if (!Array.isArray(content.ecosystemExecution?.layers) || content.ecosystemExecution.layers.length !== 3) errors.push("ecosystemExecution.layers");
  if (!Array.isArray(content.ecosystemExecution?.decisionSpine) || content.ecosystemExecution.decisionSpine.length !== 6) errors.push("ecosystemExecution.decisionSpine");
  if (!Array.isArray(content.ecosystemExecution?.decisionLenses) || content.ecosystemExecution.decisionLenses.length !== 7) errors.push("ecosystemExecution.decisionLenses");
  if ((content.ecosystemExecution?.layers || []).reduce((sum, layer) => sum + Number(layer.companies?.length || 0), 0) < 18) errors.push("ecosystemExecution.companies");
  if (!Array.isArray(content.ecosystemExecution?.bottlenecks) || content.ecosystemExecution.bottlenecks.length !== 4) errors.push("ecosystemExecution.bottlenecks");
  if (!Array.isArray(content.ecosystemExecution?.technologyResponses) || content.ecosystemExecution.technologyResponses.length !== 3) errors.push("ecosystemExecution.technologyResponses");
  if (!Array.isArray(content.ecosystemExecution?.strategicProjects) || content.ecosystemExecution.strategicProjects.length !== 3) errors.push("ecosystemExecution.strategicProjects");
  if (!Array.isArray(content.ecosystemExecution?.sources) || content.ecosystemExecution.sources.length < 2 || !content.ecosystemExecution.sources.every((source) => directUrl(source.url))) errors.push("ecosystemExecution.sources");
  if (content.ecosystemExecution?.automation?.translationMode !== "market-to-pain-to-memory-to-economics-to-execution") errors.push("ecosystemExecution.automation");
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
    ecosystemExecution: buildEcosystemExecution(
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
      title: "AI Infra Planning Agent Council",
      subtitle: "고객 Pain · Workload/SLO · 메모리 대안 · 경제성 · 90일 Gate",
      agendas: profiles,
    },
    footer: {
      year: new Date(generatedAt).getUTCFullYear(),
      disclosure: "Independent strategy portfolio based on public information",
    },
  };
  const normalizedContent = normalizeDisplayPayload(content);
  const validation = validateSiteContent(normalizedContent);
  if (!validation.ok) throw new Error(`site content validation failed: ${validation.errors.join(", ")}`);
  return normalizedContent;
}

export { model as siteContentModel };
