import { readFileSync } from "node:fs";
import {
  hasUntranslatedScript,
  isNewsLocalizationPublishable,
  localizedNewsSummary,
  localizedNewsTitle,
} from "../assets/js/news-localization.js";

/**
 * Pure, deterministic transforms for the daily intelligence pipeline.
 *
 * These functions deliberately return "insufficient"/null when direct
 * evidence is missing. Presentation metadata may name an account or node, but
 * it must never supply a substitute score, direction, relationship, or audit
 * date.
 */

const DAY_MS = 86_400_000;
const STRATEGY_ACCOUNT_MODEL = Object.freeze(JSON.parse(readFileSync(new URL("../data/accounts.json", import.meta.url), "utf8")));
export const STRATEGY_ACCOUNT_REGISTRY = Object.freeze(STRATEGY_ACCOUNT_MODEL.accounts || []);

const ACCOUNT_ACTION_RE = /(capex|capital expenditure|data ?center|cloud|server|storage|accelerator|gpu|asic|shipment|production|demand|order|contract|capacity|expand|increase|ramp|invest|launch|adoption|upgrade|delay|cut|cancel|slowdown|출하|생산|수요|발주|계약|투자|증설|확대|증가|도입|전환|지연|축소|감산|취소|云|服务器|存储|出货|产量|需求|订单|合同|投资|扩产|增加|采用|升级|推迟|削减|减产)/i;
const ACCOUNT_UP_RE = /(expand|expansion|increase|surge|ramp|accelerat|record|invest|order|contract|launch|upgrade|adopt|확대|증가|급증|증설|상향|투자|발주|계약|확보|출시|도입|扩产|增设|加码|投资|合同|中标|上调|抢购|激增|采用|升级)/i;
const ACCOUNT_DOWN_RE = /(cut|delay|pause|halt|cancel|slowdown|shortfall|decline|축소|지연|보류|중단|하향|감산|취소|감소|减产|下调|推迟|放缓|叫停|下降)/i;
const RELATION_ACTION_RE = /(partner(?:ship)?|collaborat(?:e|es|ed|ion|ive)?|co-?develop|joint venture|supply agreement|supply contract|supplier|customer|invest(?:ment|s|ed)? in|acquir(?:e|es|ed|ing)|merger|license agreement|strategic alliance|파트너십|협력|공동 개발|합작|공급 계약|공급사|고객사|투자|인수|합병|라이선스 계약|战略合作|合作|联合开发|合资|供应协议|供应合同|供应商|客户|投资|收购|并购|许可协议)/i;

export const DEMAND_ACCOUNT_REGISTRY = [
  { id: "azure", category: "hyperscaler", name: "Microsoft · Azure", aliases: ["microsoft azure", "microsoft", "azure", "maia", "마이크로소프트", "애저", "微软", "微軟"], context: ["cloud", "data center", "capex", "maia", "openai", "ai infrastructure", "hbm", "云", "数据中心", "人工智能", "资本支出", "클라우드", "데이터센터"] },
  { id: "aws", category: "hyperscaler", name: "Amazon · AWS", aliases: ["amazon web services", "aws", "trainium"], context: ["cloud", "data center", "capex", "trainium", "s3"] },
  { id: "google", category: "hyperscaler", name: "Google Cloud", aliases: ["google cloud", "alphabet", "tpu", "ironwood"], context: ["cloud", "data center", "capex", "tpu", "ironwood"] },
  { id: "meta", category: "hyperscaler", name: "Meta", aliases: ["meta platforms", "meta", "mtia"], context: ["data center", "capex", "mtia", "ai infrastructure"] },
  { id: "oracle", category: "hyperscaler", name: "Oracle · OpenAI", aliases: ["oracle cloud", "oracle", "stargate"], context: ["cloud", "data center", "capex", "stargate", "openai"] },
  { id: "xai", category: "hyperscaler", name: "xAI", aliases: ["xai", "colossus", "grok"], context: ["data center", "gpu", "colossus", "capex", "server"] },
  { id: "china", category: "hyperscaler", name: "중국 클라우드", aliases: ["alibaba cloud", "alibaba", "tencent cloud", "tencent", "bytedance", "阿里云", "阿里巴巴", "腾讯云", "腾讯", "字节跳动"], context: ["cloud", "server", "data center", "云", "服务器", "数据中心"] },
  { id: "tesla", category: "auto", name: "Tesla", aliases: ["tesla", "테슬라"], context: ["vehicle", "automotive", "fsd", "car", "차량", "자동차"] },
  { id: "byd", category: "auto", name: "BYD", aliases: ["byd", "比亚迪"], context: ["vehicle", "automotive", "adas", "ev", "汽车", "자동차"] },
  { id: "hyundai", category: "auto", name: "Hyundai · Kia", aliases: ["hyundai motor", "hyundai", "kia", "현대차", "기아"], context: ["vehicle", "automotive", "adas", "sdv", "차량", "자동차"] },
  { id: "tier1", category: "auto", name: "Bosch · Continental · Denso", aliases: ["bosch", "continental", "denso"], context: ["automotive", "adas", "domain controller", "zonal", "차량"] },
  { id: "vw", category: "auto", name: "Volkswagen", aliases: ["volkswagen", "폭스바겐"], context: ["vehicle", "automotive", "adas", "sdv", "car"] },
  { id: "toyota", category: "auto", name: "Toyota", aliases: ["toyota", "도요타", "토요타"], context: ["vehicle", "automotive", "adas", "car", "차량"] },
  { id: "apple", category: "mobile", name: "Apple iPhone", aliases: ["iphone", "아이폰", "apple intelligence"], context: ["smartphone", "mobile", "iphone", "스마트폰"] },
  { id: "samsung-mx", category: "mobile", name: "Samsung MX", aliases: ["samsung mx", "galaxy", "갤럭시"], context: ["smartphone", "mobile", "galaxy", "스마트폰"] },
  { id: "xiaomi", category: "mobile", name: "Xiaomi", aliases: ["xiaomi", "샤오미", "小米"], context: ["smartphone", "mobile", "phone", "스마트폰", "手机"] },
  { id: "oppo-vivo", category: "mobile", name: "Oppo · Vivo", aliases: ["oppo", "vivo"], context: ["smartphone", "mobile", "phone", "스마트폰", "手机"] },
  { id: "transsion", category: "mobile", name: "Transsion", aliases: ["transsion", "tecno", "infinix"], context: ["smartphone", "mobile", "phone", "手机"] },
  { id: "lenovo", category: "pc", name: "Lenovo", aliases: ["lenovo", "联想", "레노버"], context: ["pc", "notebook", "laptop", "copilot", "电脑"] },
  { id: "dell", category: "pc", name: "Dell", aliases: ["dell", "델"], context: ["pc", "notebook", "laptop", "workstation", "server"] },
  { id: "hp", category: "pc", name: "HP", aliases: ["hp inc", "hewlett-packard", "hewlett packard"], context: ["pc", "notebook", "laptop", "workstation"] },
  { id: "apple-mac", category: "pc", name: "Apple Mac", aliases: ["macbook", "mac mini", "mac studio", "imac"], context: ["pc", "mac", "computer", "laptop"] },
  { id: "azure-st", category: "datacenter", name: "Azure Storage", aliases: ["azure storage", "azure blob", "microsoft fabric"], context: ["storage", "data lake", "ssd", "server"] },
  { id: "aws-st", category: "datacenter", name: "AWS Storage", aliases: ["amazon s3", "aws storage", "elastic block store"], context: ["storage", "s3", "data lake", "ssd"] },
  { id: "solidigm-dc", category: "datacenter", name: "Solidigm", aliases: ["solidigm", "솔리다임"], context: ["enterprise ssd", "essd", "qlc", "data center", "storage"] },
  { id: "google-st", category: "datacenter", name: "Google Storage", aliases: ["google cloud storage", "google storage", "gcs"], context: ["storage", "data lake", "ssd", "server"] },
  { id: "china-dc", category: "datacenter", name: "중국 클라우드 스토리지", aliases: ["alibaba cloud storage", "tencent cloud storage", "阿里云存储", "腾讯云存储"], context: ["storage", "ssd", "存储", "服务器"] },
];

export const RELATION_ENTITY_REGISTRY = [
  { id: "skhy", aliases: ["sk hynix", "skhy", "sk하이닉스", "海力士"] },
  { id: "nvidia-ai", aliases: ["nvidia", "엔비디아", "英伟达"] },
  { id: "tsmc", aliases: ["tsmc", "台积电"] },
  { id: "samsung", aliases: ["samsung electronics", "samsung semiconductor", "삼성전자", "三星电子"] },
  { id: "micron", aliases: ["micron", "마이크론", "美光"] },
  { id: "cxmt", aliases: ["cxmt", "changxin memory", "长鑫存储"] },
  { id: "ymtc", aliases: ["ymtc", "yangtze memory", "长江存储"] },
  { id: "kioxia-sandisk", aliases: ["kioxia", "sandisk", "키옥시아", "铠侠"] },
  { id: "solidigm", aliases: ["solidigm", "솔리다임"] },
  { id: "jcet", aliases: ["jcet", "长电科技"] },
  { id: "xmc", aliases: ["xmc", "武汉新芯"] },
  { id: "tfme", aliases: ["tfme", "通富微电"] },
  { id: "naura", aliases: ["naura", "北方华创"] },
  { id: "amec", aliases: ["amec", "中微公司"] },
  { id: "acm", aliases: ["acm research", "盛美上海"] },
  { id: "smic", aliases: ["smic", "中芯国际"] },
  { id: "china-fund", aliases: ["china big fund", "big fund iii", "国家大基金", "大基金三期"] },
  { id: "tencent", aliases: ["tencent", "腾讯"] },
  { id: "alibaba-bytedance", aliases: ["alibaba", "bytedance", "阿里巴巴", "字节跳动"] },
  { id: "huawei-ascend", aliases: ["huawei ascend", "ascend 910", "华为昇腾", "昇腾"] },
  { id: "global-equip", aliases: ["asml", "applied materials", "lam research", "tokyo electron"] },
  { id: "kr-supply", aliases: ["hanmi semiconductor", "한미반도체", "jusung engineering", "주성엔지니어링", "wonik ips", "원익ips"] },
  { id: "eda-ip", aliases: ["synopsys", "cadence design", "arm holdings"] },
];

export const AGENT_ROLE_RULES = {
  brief: ["hbm", "dram", "nand", "semiconductor sales", "memory price", "메모리 가격", "반도체 매출"],
  ceo: ["capital expenditure", "capex", "long-term contract", "contract", "market outlook", "customer demand", "투자 계획", "장기 계약", "계약", "시장 전망", "고객 수요"],
  cfo: ["revenue", "operating margin", "contract price", "capital expenditure", "investment commitment", "매출", "영업이익률", "계약 가격", "재무 약정"],
  cto: ["hbm4", "hbm4e", "yield", "bandwidth", "base die", "cxl", "hybrid bonding", "tsv", "수율", "대역폭", "베이스 다이", "하이브리드 본딩", "패키징"],
  cso: ["market forecast", "market share", "customer qualification", "competition", "시장 전망", "점유율", "고객 인증", "경쟁"],
  strategy: ["market forecast", "market share", "customer qualification", "competition", "시장 전망", "점유율", "고객 인증", "경쟁"],
  coo: ["production capacity", "fab expansion", "wafer starts", "shipment", "supply agreement", "yield", "생산능력", "팹 증설", "웨이퍼", "출하", "공급 계약", "수율"],
  policy: ["bureau of industry and security", "export control", "chip export", "regulation", "export license", "chips act", "entity list", "sanction", "trade restriction", "수출 통제", "반도체 규제", "수출 허가", "제재", "엔티티 리스트", "지원법"],
  china: ["cxmt", "ymtc", "china", "chinese", "长鑫", "长江", "中国", "중국"],
  market: ["spot price", "contract price", "price", "customer demand", "demand", "shipment", "market forecast", "현물 가격", "계약 가격", "가격", "고객 수요", "수요", "출하", "시장 전망"],
  risk: ["delay", "production cut", "decline", "shortage", "restriction", "oversupply", "지연", "감산", "하락", "공급과잉", "수출 통제"],
  devil: ["delay", "production cut", "decline", "downside", "challenge", "shortfall", "지연", "축소", "하방", "부족"],
  audit: ["regulatory filing", "10-q", "20-f", "sec filing", "wsts", "semiconductor industry association", "공시 원문", "사업보고서", "공식 통계"],
  data: ["year over year", "yoy", "cagr", "%", "gbps", "billion", "million", "전년 대비", "증가율", "감소율"],
};

function normalizeText(value = "") {
  return String(value || "").normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

function directUrl(value = "") {
  const raw = String(value || "").trim();
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol) || url.hostname === "news.google.com") return "";
    url.hash = "";
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) url.searchParams.delete(key);
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function exactDate(value = "") {
  return String(value || "").match(/\b20\d{2}-\d{2}-\d{2}\b/)?.[0] || "";
}

function ageInDays(date, now) {
  const time = new Date(`${date}T00:00:00Z`).getTime();
  return Number.isFinite(time) ? Math.max(0, Math.floor((now.getTime() - time) / DAY_MS)) : Infinity;
}

function aliasRegExp(alias = "") {
  const escaped = normalizeText(alias).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  if (!escaped) return null;
  // Han-script names commonly attach to surrounding characters, but Latin
  // and Hangul aliases require real Unicode token boundaries ("델" must not
  // match "모델", just as "aws" must not match "flaws").
  return /[\u3400-\u9fff]/u.test(alias)
    ? new RegExp(escaped, "iu")
    : new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "iu");
}

function aliasMatch(text, aliases = []) {
  for (const alias of aliases) {
    const re = aliasRegExp(alias);
    const match = re?.exec(text);
    if (match) return { alias, index: match.index + String(match[1] || "").length };
  }
  return null;
}

function exactTermMatch(text = "", term = "") {
  const re = aliasRegExp(term);
  return Boolean(re?.test(normalizeText(text)));
}

function completeEvidenceQuote(item = {}) {
  const rawTitle = String(item.title || "").replace(/\s+/g, " ").trim();
  const title = hasUntranslatedScript(rawTitle) ? "" : rawTitle;
  const raw = String(item.quote || title).replace(/\s+/g, " ").trim();
  const quoteKind = item.quoteKind || "source-summary";
  if (!raw || raw === title) return { quote: title, quality: "title", quoteKind: item.quote ? quoteKind : "title" };
  if (hasUntranslatedScript(raw)) return { quote: title, quality: "title-fallback", quoteKind: "title" };
  if (/(?:为求职者提供|在线直招|求职找工作|all rights reserved|copyright|about us|welcome to|招聘信息)/iu.test(raw)) {
    return { quote: title, quality: "title-fallback", quoteKind: "title" };
  }
  const visiblyCut = /(?:\.\.\.|…|[,:;·—-])$/u.test(raw)
    || /\b(?:and|or|to|of|for|with|by|from|that|which|as|at|in|on)$/i.test(raw)
    || /(?:및|또는|위해|통해|대한|관련|하는|하며|에서|으로|打造了|的|和|与|及|为|在|将|已|正)$/u.test(raw);
  if (!visiblyCut) return { quote: raw, quality: "complete-summary", quoteKind };
  const completeSentences = raw.match(/[^.!?。！？]+[.!?。！？]+/gu) || [];
  const recovered = completeSentences.join(" ").replace(/\s+/g, " ").trim();
  return recovered
    ? { quote: recovered, quality: "complete-sentences", quoteKind }
    : { quote: title, quality: "title-fallback", quoteKind: "title" };
}

function corpusDisplayCopy(item = {}) {
  // Source text remains available for matching, never as a display fallback.
  const selectedSummary = item.summaryKo || item.summary || item.snippet || item.contextKo || "";
  const displayItem = { ...item, summaryKo: selectedSummary, summary: selectedSummary };
  if (!isNewsLocalizationPublishable(displayItem)) return null;
  const title = localizedNewsTitle(displayItem);
  const localizedSummary = selectedSummary
    ? localizedNewsSummary(displayItem)
    : "";
  const summary = normalizeText(localizedSummary) === normalizeText(selectedSummary) ? localizedSummary : "";
  return {
    title: String(title || "").trim(),
    summary: String(summary || "").trim(),
    summaryKind: /[가-힣]/u.test(summary) && normalizeText(summary) !== normalizeText(item.summaryOriginal || item.snippet || "")
      ? "translated-summary"
      : "source-summary",
  };
}

function observedInCurrentRun(item = {}, now = new Date()) {
  const verification = item.verification && typeof item.verification === "object" ? item.verification : {};
  const origin = String(verification.origin || item.origin || "").trim();
  if (typeof verification.observedThisRun === "boolean") {
    return verification.observedThisRun && (!origin || origin === "live-crawl");
  }
  if (item.preservedSeed || item.curated || item.continuityFallback || item.historical || /curated|previous|seed|archive/i.test(origin)) return false;
  const crawledAt = new Date(String(item.crawledAt || "")).getTime();
  return Number.isFinite(crawledAt) && Math.abs(now.getTime() - crawledAt) <= 2 * DAY_MS;
}

function makeCorpus(context = {}, now = new Date(), windowDays = 30) {
  const rows = []
    .concat(context.news || [])
    .concat(context.communitySignals?.items || [])
    .concat(context.benchmarkSignals?.stream || [])
    .concat(context.brokerResearch?.items || []);
  const seen = new Set();
  return rows.map((item, index) => {
    const displayCopy = corpusDisplayCopy(item);
    if (!displayCopy) return null;
    const { title, summary, summaryKind } = displayCopy;
    const originalTitle = item.originalTitle || item.title || "";
    const url = directUrl(item.verification?.canonicalUrl || item.link || item.sourceUrl || item.url || "");
    const date = exactDate(item.date || item.publishedAt || item.sourceDate || item.updatedAt || "");
    const source = item.source || item.platform || "News";
    const category = item.category || item.theme || "";
    const verification = item.verification && typeof item.verification === "object" ? item.verification : {};
    return {
      id: verification.id || item.id || `${date}:${index}`,
      title: String(title).trim(),
      summary: String(summary).trim(),
      summaryKind,
      text: normalizeText(`${source} ${category} ${originalTitle} ${item.summaryOriginal || ""} ${title} ${summary}`),
      source,
      sourceClass: verification.sourceClass || item.sourceClass || "news",
      origin: verification.origin || item.origin || (item.preservedSeed || item.curated ? "curated-seed" : ""),
      observedThisRun: observedInCurrentRun(item, now),
      url,
      date,
      category,
    };
  }).filter((item) => {
    if (!item) return false;
    if (!item.title || hasUntranslatedScript(item.title) || hasUntranslatedScript(item.summary)) return false;
    if (!item.text || !item.url || !item.date || !item.observedThisRun || ageInDays(item.date, now) > windowDays) return false;
    const key = item.url || `${item.date}:${item.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function evidenceDirection(text = "") {
  const up = ACCOUNT_UP_RE.test(text);
  const down = ACCOUNT_DOWN_RE.test(text);
  if (up && !down) return "up";
  if (down && !up) return "down";
  return "flat";
}

function authorityWeight(sourceClass = "") {
  const value = normalizeText(sourceClass);
  if (/official|filing|primary/.test(value)) return 1;
  if (/authoritative|research|broker/.test(value)) return 0.9;
  return 0.72;
}

function evidenceSourceId(item = {}) {
  try {
    return new URL(String(item.url || "")).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return normalizeText(item.source || "unknown");
  }
}

function officialEvidence(item = {}) {
  return /official|filing|primary/.test(normalizeText(item.sourceClass));
}

function relationActionNearPair(text = "", leftIndex = 0, rightIndex = 0) {
  if (Math.abs(leftIndex - rightIndex) > 520) return false;
  const actionRe = new RegExp(RELATION_ACTION_RE.source, "gi");
  for (const match of text.matchAll(actionRe)) {
    const actionIndex = Number(match.index || 0);
    if (Math.max(Math.abs(actionIndex - leftIndex), Math.abs(actionIndex - rightIndex)) <= 220) return true;
  }
  return false;
}

export function buildDemandAccountSignals(context = {}, previous = {}, nowInput = new Date()) {
  const now = new Date(nowInput);
  const corpus = makeCorpus(context, now, 30);
  const accounts = {};
  for (const account of DEMAND_ACCOUNT_REGISTRY) {
    const hits = [];
    for (const item of corpus) {
      const entity = aliasMatch(item.text, account.aliases);
      if (!entity) continue;
      const start = Math.max(0, entity.index - 180);
      const window = item.text.slice(start, entity.index + 260);
      const hasContext = account.context.some((term) => normalizeText(window).includes(normalizeText(term)));
      if (!hasContext && !ACCOUNT_ACTION_RE.test(window)) continue;
      hits.push({
        title: item.title || item.originalTitle,
        source: item.source,
        sourceClass: item.sourceClass,
        url: item.url,
        date: item.date,
        snippet: item.summary || item.title,
        direction: evidenceDirection(window),
        matchedAlias: entity.alias,
      });
    }
    hits.sort((a, b) => String(b.date).localeCompare(String(a.date)) || authorityWeight(b.sourceClass) - authorityWeight(a.sourceClass));
    const up = hits.filter((item) => item.direction === "up").length;
    const down = hits.filter((item) => item.direction === "down").length;
    const directional = up + down;
    const balance = directional ? (up - down) / directional : 0;
    const sourceCount = new Set(hits.map((item) => item.source)).size;
    const independentSourceCount = new Set(hits.map(evidenceSourceId)).size;
    const officialEvidenceCount = hits.filter(officialEvidence).length;
    const minEvidenceMet = independentSourceCount >= 2 || officialEvidenceCount >= 1;
    const observedDirection = !hits.length ? "insufficient" : balance >= 0.25 ? "up" : balance <= -0.25 ? "down" : "flat";
    const direction = minEvidenceMet ? observedDirection : "insufficient";
    const directionImpact = balance * Math.min(24, hits.length * 4 + sourceCount * 3);
    const activityImpact = Math.min(12, Math.log2(hits.length + 1) * 4 + sourceCount);
    const pullScore = minEvidenceMet
      ? Math.round(Math.max(0, Math.min(100, 50 + directionImpact + activityImpact)))
      : null;
    const confidence = minEvidenceMet ? Math.round(Math.min(96, 28 + hits.length * 11 + independentSourceCount * 5 + officialEvidenceCount * 8)) : 0;
    const driverLabel = direction === "up" ? "▲ 확대" : direction === "down" ? "▼ 축소" : direction === "flat" ? "→ 혼조" : "근거 부족";
    accounts[account.id] = {
      id: account.id,
      category: account.category,
      name: account.name,
      status: minEvidenceMet ? "live" : "insufficient",
      mentions: hits.length,
      evidenceCount: hits.length,
      sourceCount,
      independentSourceCount,
      officialEvidenceCount,
      minEvidenceMet,
      evidenceQuality: officialEvidenceCount ? "official-confirmed" : independentSourceCount >= 2 ? "corroborated" : hits.length ? "single-source" : "none",
      up,
      down,
      direction,
      observedDirection,
      driverLabel,
      pullScore,
      confidence,
      latest: hits[0] || null,
      evidence: hits.slice(0, 3),
      note: minEvidenceMet
        ? `${driverLabel} · 독립 근거 교차 확인 · 확장 신호 ${up}·축소 신호 ${down}`
        : hits.length
          ? "판단 보류 · 독립 근거 기준 미충족"
        : "판단 보류 · 직접 근거 미확인",
    };
  }
  const values = Object.values(accounts);
  return {
    schemaVersion: "2.1",
    updatedAt: now.toISOString(),
    windowDays: 30,
    registryVersion: "2026-07-20",
    expectedCount: DEMAND_ACCOUNT_REGISTRY.length,
    accountCount: values.length,
    evidencedAccountCount: values.filter((item) => item.status === "live").length,
    insufficientAccountCount: values.filter((item) => item.status !== "live").length,
    coverage: {
      evidenced: values.filter((item) => item.status === "live").length,
      total: values.length,
      pct: values.length ? Math.round(values.filter((item) => item.status === "live").length / values.length * 1000) / 10 : 0,
    },
    accounts,
    method: "versioned account registry · current-run entity/context co-match · 30d direct-link evidence · 2 independent sources or 1 official/filing source before scoring; no seed or static score fallback",
    previousUpdatedAt: previous?.updatedAt || null,
  };
}

function strategyAccountCorpus(context = {}, now = new Date(), windowDays = 56) {
  const rows = []
    .concat(context.news || [])
    .concat(context.communitySignals?.items || [])
    .concat(context.benchmarkSignals?.stream || [])
    .concat(context.brokerResearch?.items || []);
  const seen = new Set();
  return rows.map((item, index) => {
    const displayCopy = corpusDisplayCopy(item);
    if (!displayCopy) return null;
    const { title, summary } = displayCopy;
    const url = directUrl(item.verification?.canonicalUrl || item.link || item.sourceUrl || item.url || "");
    const date = exactDate(item.date || item.publishedAt || item.sourceDate || item.updatedAt || "");
    const origin = String(item.verification?.origin || item.origin || "");
    const sourceClass = item.verification?.sourceClass || item.sourceClass || "news";
    return {
      id: item.verification?.id || item.id || `${date}:${index}`,
      title: String(title).trim(),
      summary: String(summary).trim(),
      text: normalizeText(`${item.source || ""} ${item.category || ""} ${item.originalTitle || item.title || ""} ${item.summaryOriginal || ""} ${title} ${summary}`),
      source: item.source || item.platform || "News",
      sourceClass,
      origin,
      url,
      date,
    };
  }).filter((item) => {
    if (!item) return false;
    if (!item.title || hasUntranslatedScript(item.title) || hasUntranslatedScript(item.summary)) return false;
    if (!item.text || !item.url || !item.date || ageInDays(item.date, now) > windowDays) return false;
    if (/curated|seed|archive|continuity|previous/i.test(item.origin)) return false;
    const key = item.url || `${item.date}:${item.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mondayStamp(value = "") {
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return "";
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - (day === 0 ? 6 : day - 1));
  return date.toISOString().slice(0, 10);
}

function weeklySeries(corpus = [], weeks = 8, now = new Date()) {
  const current = new Date(now);
  const currentMonday = new Date(`${mondayStamp(current.toISOString().slice(0, 10))}T00:00:00Z`);
  const points = [];
  for (let offset = weeks - 1; offset >= 0; offset -= 1) {
    const start = new Date(currentMonday);
    start.setUTCDate(start.getUTCDate() - offset * 7);
    points.push({ week: start.toISOString().slice(0, 10), count: 0 });
  }
  const byWeek = new Map(points.map((point) => [point.week, point]));
  for (const item of corpus) {
    const point = byWeek.get(mondayStamp(item.date));
    if (point) point.count += 1;
  }
  return points;
}

function accountHit(item = {}, account = {}) {
  return (account.aliases || []).some((alias) => aliasMatch(item.text, [alias]));
}

function taxonomyHit(item = {}, taxonomy = {}) {
  return (taxonomy.aliases || []).some((alias) => exactTermMatch(item.text, alias));
}

function accountTechnicalHits(corpus = [], account = {}, taxonomy = [], now = new Date()) {
  const accountRows = corpus.filter((item) => accountHit(item, account));
  return taxonomy.map((axis) => {
    const hits = accountRows.filter((item) => taxonomyHit(item, axis));
    const weekly = weeklySeries(hits, 8, now);
    const current = weekly.at(-1)?.count || 0;
    const previous = weekly.at(-2)?.count || 0;
    return {
      id: axis.id,
      index: axis.index,
      label: axis.label,
      accent: axis.accent,
      productIds: axis.productIds || [],
      mentions: hits.length,
      sourceCount: new Set(hits.map(evidenceSourceId)).size,
      weekly,
      trend: current > previous ? "up" : current < previous ? "down" : "flat",
      delta: current - previous,
      risingTwoWeeks: weekly.length >= 3
        && weekly.at(-3).count < weekly.at(-2).count
        && weekly.at(-2).count < weekly.at(-1).count,
      latest: hits[0] || null,
    };
  }).sort((left, right) => right.mentions - left.mentions || right.sourceCount - left.sourceCount || String(left.index).localeCompare(String(right.index)));
}

function extractGenerationSpec(text = "") {
  const value = String(text || "");
  const capacity = value.match(/\b(\d{2,4}(?:\.\d+)?)\s*GB\b/i);
  const bandwidth = value.match(/\b(\d+(?:\.\d+)?)\s*TB\s*\/\s*s\b/i);
  const generation = value.match(/\b(HBM(?:3E|4E|4)|TPU\s*v?\d+[a-z]?|Trainium\s*\d+|Maia\s*\d+|MTIA\s*\d+)\b/i);
  if (!capacity && !bandwidth) return null;
  return {
    generation: generation?.[1] || null,
    capacityGb: capacity ? Number(capacity[1]) : null,
    bandwidthTbps: bandwidth ? Number(bandwidth[1]) : null,
  };
}

function intelligenceEventId(kind, values = []) {
  return `${kind}:${values.map((value) => normalizeText(value).replace(/[^a-z0-9가-힣-]+/giu, "-").replace(/^-|-$/g, "")).join(":")}`;
}

function recentWithinDays(value = "", now = new Date(), days = 7) {
  const date = new Date(`${exactDate(value)}T00:00:00Z`).getTime();
  return Number.isFinite(date) && now.getTime() - date <= days * DAY_MS && date <= now.getTime() + DAY_MS;
}

function generationProgression(generations = []) {
  const rows = (generations || []).filter((item) => Number.isFinite(Number(item.bandwidthTbps)) || Number.isFinite(Number(item.capacityGb)));
  const latest = rows.at(-1) || null;
  const previous = rows.at(-2) || null;
  const ratio = (field) => {
    const before = Number(previous?.[field]);
    const after = Number(latest?.[field]);
    return before > 0 && after > 0 ? Math.round(after / before * 100) / 100 : null;
  };
  return {
    status: rows.length >= 2 ? "measured" : "insufficient",
    generations: rows,
    latest,
    previous,
    bandwidthMultiplier: ratio("bandwidthTbps"),
    capacityMultiplier: ratio("capacityGb"),
  };
}

function dealEventType(text = "") {
  if (/prepay|prepayment|선급/i.test(text)) return "prepayment";
  if (/capacity commitment|binding volume|물량 커밋|binding/i.test(text)) return "capacity-commitment";
  if (/mou|memorandum|양해각서/i.test(text)) return "mou";
  if (/\blta\b|long[- ]term agreement|long[- ]term supply|multi[- ]year (?:agreement|contract)|장기공급계약|다년 계약/i.test(text)) return "long-term-agreement";
  return null;
}

function dealEvidenceStage(item = {}, lens = {}) {
  const text = item.text || "";
  const ranked = [...(lens.stages || [])].reverse().find((stage) => (stage.aliases || []).some((alias) => exactTermMatch(text, alias)));
  if (ranked) return ranked.id;
  return officialEvidence(item) ? "confirmed" : "reported";
}

function supplierChangeType(text = "") {
  if (/disqualified|failed qualification|인증 탈락/i.test(text)) return "disqualified";
  if (/qualified|인증 완료/i.test(text)) return "qualified";
  if (/switch supplier|supplier switch|공급사 전환/i.test(text)) return "supplier-switch";
  if (/dual-source|dual source|second source|이원화|세컨드 소스/i.test(text)) return "dual-source";
  return "relationship-change";
}

export function buildStrategyAccountIntelligence(context = {}, previous = {}, nowInput = new Date()) {
  const now = new Date(nowInput);
  const corpus = strategyAccountCorpus(context, now, 56);
  const painTaxonomy = STRATEGY_ACCOUNT_MODEL.painTaxonomy || [];
  const whyLostTaxonomy = STRATEGY_ACCOUNT_MODEL.whyLostTaxonomy || [];
  const accounts = {};
  for (const account of STRATEGY_ACCOUNT_REGISTRY) {
    const hits = corpus.filter((item) => accountHit(item, account))
      .sort((left, right) => String(right.date).localeCompare(String(left.date)) || authorityWeight(right.sourceClass) - authorityWeight(left.sourceClass));
    accounts[account.id] = {
      id: account.id,
      mentions: hits.length,
      sourceCount: new Set(hits.map(evidenceSourceId)).size,
      officialEvidenceCount: hits.filter(officialEvidence).length,
      weekly: weeklySeries(hits, 8, now),
      latest: hits[0] || null,
      layer: account.layer || "end-customer",
      servesAccounts: account.servesAccounts || [],
      painAxes: accountTechnicalHits(corpus, account, painTaxonomy, now),
      whyLost: accountTechnicalHits(corpus, account, whyLostTaxonomy, now),
      generationProgression: generationProgression(account.generations || []),
      evidence: hits.slice(0, 4).map((item) => ({
        title: item.title,
        source: item.source,
        sourceClass: item.sourceClass,
        url: item.url,
        date: item.date,
      })),
    };
  }
  const focusAccounts = STRATEGY_ACCOUNT_REGISTRY.filter((account) => account.focus !== false);
  const gpuIds = new Set(focusAccounts.filter((account) => account.demandClass === "gpu").map((account) => account.id));
  const asicIds = new Set(focusAccounts.filter((account) => account.demandClass === "asic").map((account) => account.id));
  const demandRows = corpus.map((item) => ({
    item,
    gpu: [...gpuIds].some((id) => accountHit(item, STRATEGY_ACCOUNT_REGISTRY.find((account) => account.id === id))),
    asic: [...asicIds].some((id) => accountHit(item, STRATEGY_ACCOUNT_REGISTRY.find((account) => account.id === id))),
  }));
  const demandWeekly = weeklySeries(corpus, 8, now).map((point) => {
    const rows = demandRows.filter(({ item }) => mondayStamp(item.date) === point.week);
    const gpu = rows.filter((row) => row.gpu).length;
    const asic = rows.filter((row) => row.asic).length;
    const total = gpu + asic;
    return { week: point.week, gpu, asic, total, gpuPct: total ? Math.round(gpu / total * 1000) / 10 : 0, asicPct: total ? Math.round(asic / total * 1000) / 10 : 0 };
  });
  const claimEvents = context.decisionIntelligence?.claimEvents?.events || [];
  const customStageRank = { REQUEST: 10, DESIGN: 20, QUALIFICATION: 30, PRODUCTION: 40 };
  const stageFromEvent = (event = {}) => {
    const stage = String(event.stage?.id || "").toUpperCase();
    if (/COMMERCIAL|PRODUCTION|PLATFORM_ADOPTION/.test(stage)) return { id: "PRODUCTION", label: "Custom HBM 양산 근거" };
    if (/QUALIFICATION|SAMPLE|VALIDATION/.test(stage)) return { id: "QUALIFICATION", label: "Custom HBM 인증 근거" };
    if (/ANNOUNCED|DISCLOSED|ROADMAP|DESIGN/.test(stage)) return { id: "DESIGN", label: "Custom HBM 공동설계 근거" };
    return { id: "REQUEST", label: "Custom HBM 요청 근거" };
  };
  for (const account of focusAccounts) {
    const matches = claimEvents.filter((event) => {
      if (event.claimType !== "verified-fact" || event.contradictionStatus === "conflict") return false;
      const text = normalizeText(`${event.entity?.label || ""} ${event.product?.label || ""} ${event.evidenceSpan || ""}`);
      return accountHit({ text }, account) && /custom hbm|custom memory|co[- ]design|공동설계|맞춤형 hbm/i.test(text);
    }).map((event) => ({ ...stageFromEvent(event), event }))
      .sort((left, right) => customStageRank[right.id] - customStageRank[left.id] || String(right.event.asOf || "").localeCompare(String(left.event.asOf || "")));
    const promoted = matches[0];
    accounts[account.id].customHbmStage = promoted ? {
      id: promoted.id,
      label: promoted.label,
      sourceId: promoted.event.sourceId || null,
      sourceUrl: directUrl(promoted.event.sourceUrl),
      asOf: promoted.event.asOf || promoted.event.publishedAt || null,
    } : { id: "UNVERIFIED", label: "고객 제안 단계 검토", sourceId: null, sourceUrl: null, asOf: null };
  }
  const claimDealEvents = claimEvents.filter((event) => event.ruleId === STRATEGY_ACCOUNT_MODEL.dealSchema?.ruleId)
    .filter((event) => /(?:LTA|long[- ]term|prepay|binding volume|contract|장기|선급|계약)/i.test(`${event.entity?.label || ""} ${event.product?.label || ""} ${event.evidenceSpan || ""}`))
    .map((event) => {
      const text = `${event.entity?.label || ""} ${event.product?.label || ""} ${event.evidenceSpan || ""}`;
      const accountId = STRATEGY_ACCOUNT_REGISTRY.find((account) => accountHit({ text: normalizeText(text) }, account))?.id || null;
      const eventType = dealEventType(text);
      if (!accountId || !eventType) return null;
      return {
        accountId,
        status: event.claimType === "verified-fact" ? "official-fact" : "market-estimate",
        evidenceStage: event.claimType === "verified-fact" ? "confirmed" : "reported",
        eventType,
        source: event.source || "원문",
        sourceUrl: directUrl(event.sourceUrl),
        asOf: event.asOf || event.publishedAt || null,
        evidenceSpan: event.evidenceSpan || "",
      };
    }).filter(Boolean);
  const dealLens = STRATEGY_ACCOUNT_MODEL.dealEventLens || {};
  const crawlDealEvents = corpus.filter((item) => (dealLens.terms || []).some((term) => exactTermMatch(item.text, term)))
    .map((item) => {
      const account = STRATEGY_ACCOUNT_REGISTRY.find((candidate) => accountHit(item, candidate));
      if (!account) return null;
      const evidenceStage = dealEvidenceStage(item, dealLens);
      const eventType = dealEventType(item.text);
      if (!eventType) return null;
      return {
        accountId: account.id,
        status: evidenceStage === "reported" ? "market-estimate" : "official-fact",
        evidenceStage,
        eventType,
        source: item.source || "원문",
        sourceUrl: directUrl(item.url),
        asOf: item.date || null,
        evidenceSpan: item.title || "계약 구조 변화",
      };
    }).filter(Boolean);
  const dealEventSeen = new Set();
  const dealEvents = [...claimDealEvents, ...crawlDealEvents]
    .filter((event) => {
      const key = `${event.accountId || ""}:${event.eventType || ""}:${event.sourceUrl || ""}:${event.asOf || ""}`;
      if (dealEventSeen.has(key)) return false;
      dealEventSeen.add(key);
      return true;
    })
    .sort((left, right) => String(right.asOf || "").localeCompare(String(left.asOf || "")));
  const applicationSignals = (STRATEGY_ACCOUNT_MODEL.applicationMap || []).map((application) => {
    const hits = corpus.filter((item) => (application.aliases || []).some((alias) => exactTermMatch(item.text, alias)));
    const sourceCount = new Set(hits.map(evidenceSourceId)).size;
    const rule = application.promotionRule || {};
    const promoted = hits.length >= Number(rule.minMentions || Infinity) && sourceCount >= Number(rule.minSources || Infinity);
    const accountIds = focusAccounts.filter((account) => hits.some((item) => accountHit(item, account))).map((account) => account.id);
    return { ...application, mentions: hits.length, sourceCount, accountIds, weekly: weeklySeries(hits, 8, now), latest: hits[0] || null, promotionStatus: promoted ? "ai-d-e-opportunity" : "monitoring" };
  });
  const technologyOpportunities = (STRATEGY_ACCOUNT_MODEL.technologyOpportunityLenses || []).map((technology) => {
    const hits = corpus.filter((item) => (technology.aliases || []).some((alias) => exactTermMatch(item.text, alias)));
    const sourceCount = new Set(hits.map(evidenceSourceId)).size;
    const rule = technology.promotionRule || {};
    const promoted = hits.length >= Number(rule.minMentions || Infinity) && sourceCount >= Number(rule.minSources || Infinity);
    return {
      ...technology,
      mentions: hits.length,
      sourceCount,
      weekly: weeklySeries(hits, 8, now),
      latest: hits[0] || null,
      status: promoted ? "opportunity-candidate" : "monitoring",
    };
  });
  const horizonPortfolio = ["H1", "H2", "H3"].map((horizon) => ({
    horizon,
    items: technologyOpportunities.filter((item) => item.horizon === horizon && item.status === "opportunity-candidate"),
  }));
  const painAlerts = focusAccounts.flatMap((account) => (accounts[account.id]?.painAxes || [])
    .filter((axis) => axis.risingTwoWeeks)
    .map((axis) => ({
      id: intelligenceEventId("pain-rise", [account.id, axis.id, axis.weekly.at(-1)?.week]),
      accountId: account.id,
      axisId: axis.id,
      label: axis.label,
      asOf: axis.weekly.at(-1)?.week || now.toISOString().slice(0, 10),
      weekly: axis.weekly.slice(-3),
      latest: axis.latest,
    })));
  const generationCandidates = focusAccounts.flatMap((account) => corpus
    .filter((item) => officialEvidence(item) && accountHit(item, account))
    .map((item) => ({ item, spec: extractGenerationSpec(`${item.title} ${item.summary}`) }))
    .filter(({ spec }) => spec)
    .slice(0, 3)
    .map(({ item, spec }) => ({
      id: intelligenceEventId("generation", [account.id, item.date, item.url, spec.generation || "spec"]),
      accountId: account.id,
      status: "pending-review",
      ...spec,
      source: item.source,
      sourceUrl: item.url,
      asOf: item.date,
      title: item.title,
    })));
  const supplierAliases = new Map((STRATEGY_ACCOUNT_MODEL.suppliers || []).map((supplier) => [supplier.id, supplier.aliases || [supplier.id, supplier.label]]));
  const changeTerms = STRATEGY_ACCOUNT_MODEL.supplierChangeLens?.terms || [];
  const supplierAlerts = corpus.flatMap((item) => {
    if (!changeTerms.some((term) => exactTermMatch(item.text, term))) return [];
    const account = STRATEGY_ACCOUNT_REGISTRY.find((candidate) => accountHit(item, candidate));
    if (!account) return [];
    return (STRATEGY_ACCOUNT_MODEL.suppliers || []).filter((supplier) => (supplierAliases.get(supplier.id) || []).some((alias) => exactTermMatch(item.text, alias)))
      .map((supplier) => ({
        id: intelligenceEventId("supplier", [account.id, supplier.id, supplierChangeType(item.text), item.date, item.url]),
        accountId: account.id,
        supplierId: supplier.id,
        changeType: supplierChangeType(item.text),
        status: officialEvidence(item) ? "official-fact" : "market-estimate",
        source: item.source,
        sourceUrl: item.url,
        asOf: item.date,
        title: item.title,
      }));
  }).sort((left, right) => String(right.asOf || "").localeCompare(String(left.asOf || "")));
  const relationLens = STRATEGY_ACCOUNT_MODEL.ecosystemRelationLens || {};
  const relationEvidence = new Map();
  for (const item of corpus) {
    const matchedAccounts = STRATEGY_ACCOUNT_REGISTRY.map((account) => {
      const matches = (account.aliases || []).map((alias) => aliasMatch(item.text, [alias])).filter(Boolean).sort((left, right) => left.index - right.index);
      return matches[0] ? { id: account.id, company: account.company, index: matches[0].index } : null;
    }).filter(Boolean);
    if (matchedAccounts.length < 2) continue;
    const matchedTypes = (relationLens.types || []).filter((type) => (type.aliases || []).some((alias) => exactTermMatch(item.text, alias)));
    if (!matchedTypes.length) continue;
    for (let left = 0; left < matchedAccounts.length; left += 1) {
      for (let right = left + 1; right < matchedAccounts.length; right += 1) {
        const a = matchedAccounts[left];
        const b = matchedAccounts[right];
        if (!relationActionNearPair(item.text, a.index, b.index)) continue;
        const [from, to] = [a, b].sort((x, y) => x.id.localeCompare(y.id));
        for (const type of matchedTypes) {
          const key = `${type.id}:${from.id}:${to.id}`;
          const row = relationEvidence.get(key) || { key, type: type.id, from: from.id, to: to.id, fromCompany: from.company, toCompany: to.company, evidence: [], sources: new Set() };
          row.evidence.push({ title: item.title, source: item.source, sourceClass: item.sourceClass, sourceUrl: item.url, asOf: item.date });
          row.sources.add(evidenceSourceId(item));
          relationEvidence.set(key, row);
        }
      }
    }
  }
  const relationshipAlerts = [...relationEvidence.values()].map((row) => {
    const evidence = row.evidence.sort((left, right) => String(right.asOf || "").localeCompare(String(left.asOf || "")));
    const officialEvidenceCount = evidence.filter(officialEvidence).length;
    const promoted = officialEvidenceCount >= 1 || row.sources.size >= 2;
    return {
      id: intelligenceEventId("ecosystem-relation", [row.type, row.from, row.to]),
      type: row.type,
      from: row.from,
      to: row.to,
      title: `${row.fromCompany} ↔ ${row.toCompany}`,
      detail: evidence[0]?.title || "관계 변화",
      status: promoted ? "evidence-connected" : "candidate",
      sourceCount: row.sources.size,
      officialEvidenceCount,
      source: evidence[0]?.source || "원문",
      sourceUrl: evidence[0]?.sourceUrl || "",
      asOf: evidence[0]?.asOf || null,
      evidence: evidence.slice(0, 3),
    };
  }).sort((left, right) => String(right.asOf || "").localeCompare(String(left.asOf || "")));
  for (const event of dealEvents) {
    event.id = intelligenceEventId("deal", [event.accountId || "unknown", event.eventType, event.asOf || "", event.sourceUrl || ""]);
  }
  const recentChangeItems = [
    ...relationshipAlerts.filter((item) => item.status === "evidence-connected" && recentWithinDays(item.asOf, now)).map((item) => ({ ...item, kind: "ecosystem-relation", headline: `${item.title} · ${item.type}` })),
    ...supplierAlerts.filter((item) => recentWithinDays(item.asOf, now)).map((item) => ({ ...item, kind: "supplier-change", headline: item.title || `${item.accountId} · ${item.changeType}` })),
    ...dealEvents.filter((item) => recentWithinDays(item.asOf, now)).map((item) => ({ ...item, kind: "deal-event", headline: item.evidenceSpan || `${item.accountId} · ${item.eventType}` })),
    ...painAlerts.filter((item) => recentWithinDays(item.asOf, now)).map((item) => ({ ...item, kind: "pain-rise", headline: `${item.accountId} · ${item.label} 신호 상승` })),
    ...technologyOpportunities.filter((item) => item.status === "opportunity-candidate" && recentWithinDays(item.latest?.date, now)).map((item) => ({
      id: intelligenceEventId("opportunity", [item.id, item.latest?.date, item.latest?.url]),
      kind: "opportunity-candidate",
      headline: `${item.label} · ${item.horizon} 기회 후보`,
      asOf: item.latest?.date,
      source: item.latest?.source,
      sourceUrl: item.latest?.url,
      accountId: null,
    })),
  ].sort((left, right) => String(right.asOf || "").localeCompare(String(left.asOf || "")));
  const previousChangeIds = new Set(previous?.whatChanged?.recentIds || []);
  const annotatedChangeItems = recentChangeItems.map((item) => ({
    ...item,
    isNew: !previousChangeIds.has(item.id),
  }));
  const whatChanged = {
    windowDays: 7,
    generatedAt: now.toISOString(),
    items: annotatedChangeItems.slice(0, 12),
    newItems: annotatedChangeItems.filter((item) => item.isNew).slice(0, 12),
    newCount: annotatedChangeItems.filter((item) => item.isNew).length,
    recentIds: [...new Set(recentChangeItems.map((item) => item.id))],
    counts: recentChangeItems.reduce((acc, item) => ({ ...acc, [item.kind]: (acc[item.kind] || 0) + 1 }), {}),
  };
  for (const account of focusAccounts) {
    accounts[account.id].applicationOpportunityTags = applicationSignals
      .filter((item) => item.promotionStatus === "ai-d-e-opportunity" && item.accountIds.includes(account.id))
      .map((item) => item.productId);
  }
  const partnerRollups = STRATEGY_ACCOUNT_REGISTRY.filter((account) => account.layer === "asic-partner").map((partner) => {
    const served = (partner.servesAccounts || []).map((id) => accounts[id]).filter(Boolean);
    const axisTotals = painTaxonomy.map((axis) => ({
      id: axis.id,
      label: axis.label,
      mentions: served.reduce((sum, item) => sum + Number(item.painAxes?.find((row) => row.id === axis.id)?.mentions || 0), 0),
    })).sort((left, right) => right.mentions - left.mentions);
    return {
      partnerId: partner.id,
      layer: partner.layer,
      accountIds: partner.servesAccounts || [],
      accountCount: served.length,
      buyingCriteria: partner.buyingCriteria || [],
      topPainAxes: axisTotals.slice(0, 3),
    };
  });
  const executiveOnePagers = focusAccounts.map((account) => {
    const intelligence = accounts[account.id] || {};
    const topPainAxes = (intelligence.painAxes || []).filter((axis) => axis.mentions > 0).slice(0, 3);
    const recommendedProductIds = [...new Set(topPainAxes.flatMap((axis) => axis.productIds || []))];
    return {
      accountId: account.id,
      headline: `${account.company} · ${account.chip}`,
      layer: account.layer || "end-customer",
      decisionQuestion: account.gate,
      topPainAxes,
      whyLost: (intelligence.whyLost || []).filter((item) => item.mentions > 0).slice(0, 2),
      generationProgression: intelligence.generationProgression,
      recommendedProductIds,
      dealEvents: dealEvents.filter((event) => event.accountId === account.id).slice(0, 3),
      supplierAlerts: supplierAlerts.filter((event) => event.accountId === account.id).slice(0, 3),
      whatChanged: whatChanged.items.filter((event) => event.accountId === account.id).slice(0, 4),
      evidence: intelligence.evidence || [],
    };
  });
  return {
    schemaVersion: "2.0",
    registryVersion: STRATEGY_ACCOUNT_MODEL.registryVersion,
    updatedAt: now.toISOString(),
    windowDays: 56,
    accountCount: STRATEGY_ACCOUNT_REGISTRY.length,
    focusAccountCount: focusAccounts.length,
    accounts,
    layerModel: STRATEGY_ACCOUNT_MODEL.layerModel || {},
    layerSummary: (STRATEGY_ACCOUNT_MODEL.layerModel?.layers || []).map((layer) => ({
      ...layer,
      accountIds: STRATEGY_ACCOUNT_REGISTRY.filter((account) => account.layer === layer.id).map((account) => account.id),
    })),
    painTaxonomy,
    whyLostTaxonomy,
    partnerRollups,
    executiveOnePagers,
    demandMix: {
      label: "GPU · ASIC CUSTOMER PORTFOLIO",
      measurement: "동일 관측 묶음 내 계정 언급 비중",
      weekly: demandWeekly,
      latest: demandWeekly.at(-1) || { gpu: 0, asic: 0, total: 0, gpuPct: 0, asicPct: 0 },
      externalEstimate: { status: "separate-source-required", range: null },
    },
    supplierMatrix: {
      suppliers: STRATEGY_ACCOUNT_MODEL.suppliers || [],
      rows: focusAccounts.map((account) => ({
        accountId: account.id,
        cells: (STRATEGY_ACCOUNT_MODEL.suppliers || []).map((supplier) => {
          const relation = (STRATEGY_ACCOUNT_MODEL.supplierRelations || []).find((item) => item.accountId === account.id && item.supplierId === supplier.id);
          const alerts = supplierAlerts.filter((item) => item.accountId === account.id && item.supplierId === supplier.id).slice(0, 3);
          return { ...(relation || { accountId: account.id, supplierId: supplier.id, status: "unconfirmed", sourceId: null, asOf: null }), alerts, latestAlert: alerts[0] || null };
        }),
      })),
      alerts: supplierAlerts,
    },
    ecosystemRelationships: {
      promotionRule: relationLens.promotion || "공식·공시 1개 또는 독립 출처 2개",
      events: relationshipAlerts,
      promoted: relationshipAlerts.filter((item) => item.status === "evidence-connected"),
      status: relationshipAlerts.some((item) => item.status === "evidence-connected") ? "evidence-connected" : "monitoring",
    },
    deals: {
      schema: STRATEGY_ACCOUNT_MODEL.dealSchema || {},
      events: dealEvents,
      status: dealEvents.length ? "evidence-connected" : "monitoring",
    },
    productMap: STRATEGY_ACCOUNT_MODEL.productMap || [],
    applicationSignals,
    painAlerts,
    generationCandidates,
    technologyOpportunities,
    horizonPortfolio,
    whatChanged,
    roadmap90d: STRATEGY_ACCOUNT_MODEL.roadmap90d || [],
    previousUpdatedAt: previous?.updatedAt || null,
    method: "계정 별칭 1개 + 기술·계약·공급변화 용어 1개 교차 → MECE Pain·Why-lost·Deal·Supplier Alert 분류; 관계 승격은 근거 단계별 fail-closed",
  };
}

function roleEvidenceCandidates(context = {}, quant = {}, now = new Date()) {
  const news = makeCorpus(context, now, 30).map((item) => ({
    kind: "article",
    title: item.title,
    quote: item.summary || item.title,
    quoteKind: item.summary ? item.summaryKind : "title",
    source: item.source,
    sourceUrl: item.url,
    date: item.date,
    sourceClass: item.sourceClass,
    titleText: normalizeText(item.title),
    text: item.text,
  }));
  const figures = (quant.liveFigures?.items || []).filter((item) => (
    item.origin === "live-crawl" && item.observedThisRun === true
  )).map((item) => ({
    kind: "figure",
    title: item.contextKo || item.snippet || item.value,
    quote: item.contextKo || item.snippet || "",
    quoteKind: item.contextKo && normalizeText(item.contextKo) !== normalizeText(item.snippet)
      ? "translated-summary"
      : "source-summary",
    value: item.value || "",
    source: item.source || "원문",
    sourceUrl: directUrl(item.url),
    date: exactDate(item.date),
    sourceClass: item.sourceClass || "research",
    titleText: normalizeText(`${item.topic?.label || ""} ${item.contextKo || item.snippet || ""}`),
    text: normalizeText(`${item.topic?.id || ""} ${item.topic?.label || ""} ${item.contextKo || ""} ${item.snippet || ""} ${item.value || ""}`),
  })).filter((item) => item.sourceUrl && item.date && ageInDays(item.date, now) <= 30);
  return news.concat(figures).sort((a, b) => String(b.date).localeCompare(String(a.date)) || authorityWeight(b.sourceClass) - authorityWeight(a.sourceClass));
}

export function buildAgentBriefing(context = {}, quant = {}, nowInput = new Date()) {
  const now = new Date(nowInput);
  const candidates = roleEvidenceCandidates(context, quant, now);
  const used = new Set();
  const roles = {};
  const roleEntries = Object.entries(AGENT_ROLE_RULES);
  for (const [role, terms] of roleEntries) {
    const ranked = candidates.map((item) => {
      const matchedTitle = terms.filter((term) => exactTermMatch(item.titleText, term));
      const matchedBody = terms.filter((term) => exactTermMatch(item.text, term));
      const matched = [...new Set(matchedTitle.concat(matchedBody))];
      const recency = Math.max(0, 30 - ageInDays(item.date, now)) / 30;
      const eligible = matchedTitle.length > 0 || matched.length >= 2 || item.kind === "figure";
      const score = matchedTitle.length * 18 + matched.length * 8 + authorityWeight(item.sourceClass) * 5 + recency * 3
        + (item.kind === "figure" && ["cfo", "market", "data", "audit"].includes(role) ? 4 : 0)
        + (used.has(item.sourceUrl) ? -7 : 0);
      return { item, matched, matchedTitle, eligible, score };
    }).filter((item) => item.eligible && item.matched.length).sort((a, b) => b.score - a.score || String(b.item.date).localeCompare(String(a.item.date)));
    // A malformed live figure must not hide the next usable article/figure.
    const chosen = ranked.map((candidate) => ({ ...candidate, selectedQuote: completeEvidenceQuote(candidate.item) }))
      .find((candidate) => candidate.selectedQuote.quote && !hasUntranslatedScript(candidate.item.title) && !hasUntranslatedScript(candidate.selectedQuote.quote));
    if (!chosen) {
      roles[role] = { status: "insufficient", source: null, sourceUrl: "", date: "", quote: "", matchedKeywords: [] };
      continue;
    }
    used.add(chosen.item.sourceUrl);
    const selectedQuote = chosen.selectedQuote;
    roles[role] = {
      status: "live",
      kind: chosen.item.kind,
      title: chosen.item.title,
      quote: selectedQuote.quote,
      quoteQuality: selectedQuote.quality,
      quoteKind: selectedQuote.quoteKind,
      value: chosen.item.value || null,
      source: chosen.item.source,
      sourceUrl: chosen.item.sourceUrl,
      date: chosen.item.date,
      matchedKeywords: chosen.matched,
    };
  }
  return {
    schemaVersion: "1.1",
    runId: quant.runId || null,
    expiresAt: quant.expiresAt || null,
    updatedAt: now.toISOString(),
    windowDays: 30,
    sourceCount: new Set(Object.values(roles).map((item) => item.sourceUrl).filter(Boolean)).size,
    roles,
    metrics: {
      dramSpot30dPct: Number.isFinite(Number(quant.memoryMomentum?.dramSpot30dPct)) ? Number(quant.memoryMomentum.dramSpot30dPct) : null,
      nandSpot30dPct: Number.isFinite(Number(quant.memoryMomentum?.nandSpot30dPct)) ? Number(quant.memoryMomentum.nandSpot30dPct) : null,
      usdkrw: Number.isFinite(Number(quant.fx?.usdkrw?.value)) ? Number(quant.fx.usdkrw.value) : null,
      nvda90dPct: Number.isFinite(Number(quant.aiDemandProxy?.nvda?.changePct90d)) ? Number(quant.aiDemandProxy.nvda.changePct90d) : null,
    },
    method: "role-keyword ranking over current-run 30d direct-link articles and verbatim live figures; one dated source attached per role; curated/previous-run seeds excluded",
  };
}

export function buildRelationCandidates(context = {}, nowInput = new Date(), threshold = 3) {
  const now = new Date(nowInput);
  const corpus = makeCorpus({ news: context.news || [] }, now, 30);
  const pairs = new Map();
  for (const item of corpus) {
    const entities = RELATION_ENTITY_REGISTRY.map((entity) => {
      const match = aliasMatch(item.text, entity.aliases);
      return match ? { id: entity.id, index: match.index } : null;
    }).filter(Boolean);
    const unique = [...new Map(entities.map((entity) => [entity.id, entity])).values()].sort((a, b) => a.id.localeCompare(b.id));
    for (let left = 0; left < unique.length; left += 1) {
      for (let right = left + 1; right < unique.length; right += 1) {
        const from = unique[left].id;
        const to = unique[right].id;
        const id = `${from}--${to}`;
        const row = pairs.get(id) || { id, from, to, evidence: [], sources: new Set() };
        const relationSignal = relationActionNearPair(item.text, unique[left].index, unique[right].index);
        row.evidence.push({ title: item.title || item.originalTitle, source: item.source, sourceClass: item.sourceClass, url: item.url, date: item.date, relationSignal });
        row.sources.add(evidenceSourceId(item));
        pairs.set(id, row);
      }
    }
  }
  const items = [...pairs.values()].map((item) => {
    item.evidence.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const relationEvidenceCount = item.evidence.filter((evidence) => evidence.relationSignal).length;
    const officialEvidenceCount = item.evidence.filter(officialEvidence).length;
    const promotionReady = item.evidence.length >= threshold
      && relationEvidenceCount >= 1
      && (item.sources.size >= 2 || officialEvidenceCount >= 1);
    return {
      id: `candidate-${item.id}`,
      from: item.from,
      to: item.to,
      evidenceCount: item.evidence.length,
      sourceCount: item.sources.size,
      independentSourceCount: item.sources.size,
      officialEvidenceCount,
      relationEvidenceCount,
      lastSeenAt: item.evidence[0]?.date || null,
      status: promotionReady ? "promotion-review" : "candidate",
      evidence: item.evidence,
    };
  }).sort((a, b) => b.evidenceCount - a.evidenceCount || String(b.lastSeenAt).localeCompare(String(a.lastSeenAt)));
  return {
    schemaVersion: "1.1",
    updatedAt: now.toISOString(),
    windowDays: 30,
    promotionThreshold: threshold,
    candidateCount: items.length,
    promotionReviewCount: items.filter((item) => item.status === "promotion-review").length,
    items,
    method: "current-run 30d same-article entity co-occurrence · direct links deduplicated · promotion requires relation language plus independent-source or official evidence; curated/previous-run seeds excluded",
  };
}

const BASELINE_STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "being", "but", "by", "can", "could", "did", "do", "does",
  "for", "from", "had", "has", "have", "how", "if", "in", "into", "is", "it", "its", "may", "might", "more", "most",
  "no", "not", "of", "on", "or", "our", "out", "over", "should", "than", "that", "the", "their", "these", "they", "this",
  "those", "to", "under", "was", "we", "were", "what", "when", "where", "which", "while", "will", "with", "would", "you",
  "about", "across", "after", "before", "between", "current", "latest", "new", "using", "based", "per", "versus", "via",
  "memory", "market", "track", "tracking", "watch", "signal", "signals", "action", "actions", "linkedcategories", "architecture",
  "메모리", "시장", "추적", "확인", "기준", "확대", "경쟁", "공급", "합니다", "입니다", "있습니다", "위한", "함께", "아니라",
  "보다", "제품", "고객", "기술", "후보", "목표", "대한", "관련", "통해", "따라", "현재", "최신", "별도", "경우", "관리",
  "사용", "판단", "필요", "해당", "자료", "근거", "전망", "정도", "수준", "대비", "기반", "표시", "검토", "분리",
]);

function baselineTargets(baseline = {}) {
  const targets = [];
  const seen = new Set();
  const slugId = (value = "") => String(value).toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-|-$/g, "");
  const push = (target) => {
    if (!target.id || seen.has(target.id)) return;
    seen.add(target.id);
    targets.push(target);
  };
  const walk = (value, path = "root") => {
    if (!value || typeof value !== "object") return;
    const baseId = slugId(value.id || `${value.company || "baseline"}-${value.title || path}`);
    if (!Array.isArray(value) && (value.thesis || Array.isArray(value.facts))) {
      push({
        id: baseId,
        path,
        value,
        text: [value.thesis || ""].concat(value.facts || []).join(" "),
        fields: [value.thesis ? "thesis" : null, Array.isArray(value.facts) ? "facts" : null].filter(Boolean),
      });
      (value.facts || []).forEach((fact, index) => {
        if (typeof fact !== "string" || fact.trim().length < 20) return;
        push({
          id: `${baseId}-fact-${index + 1}`,
          path: `${path}.facts[${index}]`,
          value: { ...value, thesis: fact, facts: [] },
          text: fact,
          fields: [`facts[${index}]`],
        });
      });
    }
    if (!Array.isArray(value)) {
      for (const field of ["summary", "note", "alt", "insight", "a"]) {
        const text = value[field];
        if (typeof text !== "string" || text.trim().length < 20) continue;
        push({
          id: `${baseId}-${field}`,
          path: `${path}.${field}`,
          value: { ...value, thesis: text, facts: [] },
          text,
          fields: [field],
        });
      }
    }
    if (Array.isArray(value)) value.forEach((item, index) => walk(item, `${path}[${index}]`));
    else Object.entries(value).forEach(([key, item]) => walk(item, `${path}.${key}`));
  };
  walk(baseline);
  return targets;
}

function baselineKeywords(item = {}) {
  const raw = [item.id, item.company, item.title, item.label, item.source, item.publisher, item.badge, item.thesis]
    .concat(item.facts || [], item.signals || [], item.watch || [], item.linkedCategories || [])
    .join(" ")
    .normalize("NFKC")
    .toLowerCase();
  return [...new Set(raw
    .split(/[^a-z0-9가-힣²³]+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3
      && !/^20\d{2}$/.test(word)
      && !/^q[1-4]$/.test(word)
      && !BASELINE_STOP_WORDS.has(word)))]
    .slice(0, 40);
}

const BASELINE_ENTITY_ANCHOR_RE = /^(?:cxmt|ymtc|tsmc|micron|samsung|skhy|hynix|solidigm|hbf|panmnesia|pangea|china|chinese|중국|wsts|sia|trendforce|counterpoint|techinsights|yole|semianalysis|reuters|digitimes|idc)$/i;
const BASELINE_TECH_ANCHOR_RE = /^(?:hbm3e?|hbm4e?|dram|nand|xtacking|cowos|cxl|lpddr5x|ddr6|essd|hybrid|bonding|base|die)$/i;

function baselineAnchorKeywords(item = {}, keywords = []) {
  const identity = [item.id, item.company, item.title, item.label, item.source, item.publisher, item.badge]
    .join(" ")
    .normalize("NFKC")
    .toLowerCase()
    .split(/[^a-z0-9가-힣]+/)
    .filter(Boolean);
  const entityAnchors = [...new Set(identity.filter((word) => BASELINE_ENTITY_ANCHOR_RE.test(word)))];
  if (entityAnchors.length) return entityAnchors;
  return keywords.filter((word) => BASELINE_TECH_ANCHOR_RE.test(word)).slice(0, 8);
}

function baselineQuantTokens(text = "") {
  const unitPattern = "%|percentage\\s*points?|bps?|gb\\s*\\/\\s*s|gbps|gb\\s*\\/\\s*mm[²2]|gb|tb|mb|kb|wpm|wafers?|layers?|nm|mm[²2]|cny|rmb|yuan|dollars?|trillion|billion|million|thousand|[kmbt](?:\\+)?|억\\s*위안|억|조|만|명|장|개|배|층";
  const pattern = new RegExp(`(?:[$€£¥₩]\\s*)?[+\\-]?\\d+(?:,\\d{3})*(?:\\.\\d+)?\\s*(?:${unitPattern})`, "giu");
  return [...new Set((String(text || "").normalize("NFKC").match(pattern) || []).map((token) => token
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/,/g, "")
    .replace(/^\+/, "")
    .replace(/percentagepoints?/g, "%p")
    .replace(/gb\/s/g, "gbps")
    .replace(/gb\/mm2/g, "gb/mm²")
    .replace(/mm2/g, "mm²")
    .replace(/trillion/g, "t")
    .replace(/billion/g, "b")
    .replace(/million/g, "m")
    .replace(/thousand/g, "k")
    .replace(/dollars?/g, "usd")
    .replace(/yuan|rmb/g, "cny")
    .replace(/\+$/g, "")))];
}

function baselinePeriodTokens(text = "") {
  const normalized = String(text || "").normalize("NFKC").toLowerCase();
  const years = normalized.match(/\b20\d{2}\b/g) || [];
  const quarters = normalized.match(/(?:\bq[1-4]\s*20\d{2}\b|\b20\d{2}\s*(?:년\s*)?q[1-4]\b)/g) || [];
  return [...new Set(quarters.concat(years).map((value) => value.replace(/년|\s+/g, "")))];
}

function baselineClaimMatch(target = {}, item = {}) {
  const keywords = baselineKeywords(target.value);
  const anchors = baselineAnchorKeywords(target.value, keywords);
  const claimKeywords = keywords.filter((keyword) => !anchors.includes(keyword));
  const matchedAnchors = anchors.filter((keyword) => exactTermMatch(item.text, keyword));
  const matchedClaims = claimKeywords.filter((keyword) => exactTermMatch(item.text, keyword));
  const targetQuant = baselineQuantTokens(target.text);
  const articleQuant = baselineQuantTokens(item.text);
  const matchedQuant = targetQuant.filter((token) => articleQuant.includes(token));
  const targetPeriods = baselinePeriodTokens(target.text);
  const articlePeriods = baselinePeriodTokens(item.text);
  const matchedPeriods = targetPeriods.filter((token) => articlePeriods.includes(token));
  const anchorReady = matchedAnchors.length >= 1;
  const claimReady = matchedClaims.length >= 2;
  const periodReady = !targetPeriods.length || matchedPeriods.length >= 1;
  const quantReady = !targetQuant.length || matchedQuant.length === targetQuant.length;
  const related = anchorReady && claimReady && periodReady;
  return {
    item,
    keywords,
    matchedAnchors,
    matchedClaims,
    targetQuant,
    matchedQuant,
    targetPeriods,
    matchedPeriods,
    related,
    exact: related && quantReady,
    score: matchedAnchors.length * 20
      + matchedClaims.reduce((sum, keyword) => sum + Math.min(8, keyword.length), 0)
      + matchedQuant.length * 24
      + matchedPeriods.length * 10,
  };
}

function directionPolarity(text = "") {
  const normalized = normalizeText(text);
  const positive = /(growth|increase|expand|ramp|surge|improve|성장|증가|확대|증설|개선|상향)/i.test(normalized);
  const negative = /(decline|decrease|delay|cut|contraction|slowdown|감소|축소|지연|하락|감산|둔화)/i.test(normalized);
  return positive === negative ? 0 : positive ? 1 : -1;
}

export function buildBaselineFreshness(baseline = {}, context = {}, previous = {}, nowInput = new Date()) {
  const now = new Date(nowInput);
  const methodologyVersion = "3.0";
  const previousTrusted = previous?.methodologyVersion === methodologyVersion;
  const corpus = makeCorpus({ news: context.news || [], brokerResearch: context.brokerResearch || {} }, now, 45);
  const items = {};
  for (const target of baselineTargets(baseline)) {
    const evaluated = corpus.map((item) => baselineClaimMatch(target, item));
    const matches = evaluated.filter((match) => match.exact)
      .sort((a, b) => b.score - a.score || String(b.item.date).localeCompare(String(a.item.date)));
    const relatedMatches = evaluated.filter((match) => match.related && !match.exact)
      .sort((a, b) => b.score - a.score || String(b.item.date).localeCompare(String(a.item.date)));
    const evidenceView = ({ item, matchedAnchors, matchedClaims, matchedQuant, matchedPeriods }) => ({
      title: item.title || item.originalTitle,
      source: item.source,
      url: item.url,
      date: item.date,
      matchedKeywords: matchedClaims.slice(0, 8),
      matchedAnchors: matchedAnchors.slice(0, 5),
      matchedQuantTokens: matchedQuant.slice(0, 8),
      matchedPeriodTokens: matchedPeriods.slice(0, 5),
      matchQuality: "claim-exact",
    });
    const currentEvidence = matches.slice(0, 5).map(evidenceView);
    const relatedEvidence = relatedMatches.slice(0, 3).map((match) => ({
      ...evidenceView(match),
      matchQuality: "related-unverified",
    }));
    const previousItem = previousTrusted ? (previous?.items?.[target.id] || {}) : {};
    const previousEvidence = (previousItem.evidence || []).filter((item) => directUrl(item.url) && exactDate(item.date)).slice(0, 5);
    const evidence = currentEvidence.length ? currentEvidence : previousEvidence;
    const lastCheckedAt = now.toISOString().slice(0, 10);
    const latestMatchDate = matches.map(({ item }) => item.date).filter(Boolean).sort((a, b) => String(b).localeCompare(String(a)))[0];
    const previousEvidenceAt = previousEvidence.map((item) => exactDate(item.date)).filter(Boolean).sort((a, b) => String(b).localeCompare(String(a)))[0];
    const lastEvidenceAt = latestMatchDate || previousEvidenceAt || null;
    const ageDays = lastEvidenceAt ? ageInDays(lastEvidenceAt, now) : null;
    const baselinePolarity = directionPolarity(target.text || target.value.thesis || (target.value.facts || []).join(" "));
    const opposing = baselinePolarity && matches.find(({ item }) => directionPolarity(item.text) === -baselinePolarity);
    const previousConflict = !matches.length
      && directUrl(previousItem.conflictEvidence?.url)
      && exactDate(previousItem.conflictEvidence?.date)
      ? previousItem.conflictEvidence
      : null;
    const conflictEvidence = opposing ? {
      ...evidenceView(opposing),
      matchQuality: "claim-exact-opposing-language",
    } : previousConflict;
    const conflictCandidate = Boolean(conflictEvidence && ageInDays(conflictEvidence.date, now) <= 14);
    const status = conflictCandidate ? "conflict-candidate" : (!lastEvidenceAt || ageDays > 14 ? "revalidate" : "current");
    items[target.id] = {
      id: target.id,
      path: target.path,
      title: target.value.title || target.value.label || target.value.company || target.id,
      fields: target.fields,
      status,
      lastCheckedAt,
      lastEvidenceAt,
      ageDays,
      evidenceCount: evidence.length,
      evidence,
      relatedEvidenceCount: relatedEvidence.length,
      relatedEvidence,
      conflictCandidate,
      conflictEvidence,
      reviewReason: conflictCandidate
        ? "동일 주체·지표·기간·수치 근거에 반대 방향어가 있어 사람 검토 필요"
        : evidence.length
          ? "동일 주체·지표·기간과 정량 토큰을 최신 직접 링크에서 대조 완료"
          : relatedEvidence.length
            ? "관련 기사는 있으나 주장 수치까지 일치하지 않아 재검증 필요"
            : "주장 단위 직접 대조 근거 없음",
    };
  }
  const values = Object.values(items);
  return {
    schemaVersion: "3.0",
    methodologyVersion,
    updatedAt: now.toISOString(),
    staleAfterDays: 14,
    total: values.length,
    current: values.filter((item) => item.status === "current").length,
    revalidate: values.filter((item) => item.status === "revalidate").length,
    conflictCandidates: values.filter((item) => item.status === "conflict-candidate").length,
    items,
    method: "baseline claim-level audit vs current-run 45d direct-link evidence; same entity/source anchor plus at least two claim terms and period overlap required; every quantitative token must match for current status; related-only articles never refresh freshness; opposing wording is review-only",
  };
}

export function buildIndustryPulse(context = {}, nowInput = new Date(), sourceChecks = {}) {
  const now = new Date(nowInput);
  const corpus = makeCorpus({ news: context.news || [] }, now, 120);
  const definitions = {
    wsts: { label: "WSTS", host: "wsts.org", monitorUrl: "https://www.wsts.org/76/Recent-News-Release" },
    sia: { label: "SIA", host: "semiconductors.org", monitorUrl: "https://www.semiconductors.org/news-events/latest-news/" },
  };
  const sources = {};
  for (const [id, definition] of Object.entries(definitions)) {
    const matches = corpus.filter((item) => {
      try { return new URL(item.url).hostname.endsWith(definition.host); } catch { return false; }
    }).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    sources[id] = {
      id,
      label: definition.label,
      status: matches.length ? "observed" : sourceChecks?.[id]?.reachable ? "connected-awaiting-observation" : "awaiting-observation",
      reachable: Boolean(sourceChecks?.[id]?.reachable || matches.length),
      checkedAt: sourceChecks?.[id]?.checkedAt || null,
      monitorUrl: definition.monitorUrl,
      evidenceCount: matches.length,
      latest: matches[0] ? { title: matches[0].title || matches[0].originalTitle, source: matches[0].source, url: matches[0].url, date: matches[0].date } : null,
    };
  }
  return {
    schemaVersion: "1.1",
    updatedAt: now.toISOString(),
    connected: Object.values(sources).filter((item) => item.reachable).length,
    observed: Object.values(sources).filter((item) => item.evidenceCount > 0).length,
    total: Object.keys(sources).length,
    sources,
    method: "official-domain WSTS forecast and SIA/WSTS monthly-sales monitor",
  };
}
