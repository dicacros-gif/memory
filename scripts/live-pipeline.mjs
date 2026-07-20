/**
 * Pure, deterministic transforms for the daily intelligence pipeline.
 *
 * These functions deliberately return "insufficient"/null when direct
 * evidence is missing. Presentation metadata may name an account or node, but
 * it must never supply a substitute score, direction, relationship, or audit
 * date.
 */

const DAY_MS = 86_400_000;

const ACCOUNT_ACTION_RE = /(capex|capital expenditure|data ?center|cloud|server|storage|accelerator|gpu|asic|shipment|production|demand|order|contract|capacity|expand|increase|ramp|invest|launch|adoption|upgrade|delay|cut|cancel|slowdown|출하|생산|수요|발주|계약|투자|증설|확대|증가|도입|전환|지연|축소|감산|취소|云|服务器|存储|出货|产量|需求|订单|合同|投资|扩产|增加|采用|升级|推迟|削减|减产)/i;
const ACCOUNT_UP_RE = /(expand|expansion|increase|surge|ramp|accelerat|record|invest|order|contract|launch|upgrade|adopt|확대|증가|급증|증설|상향|투자|발주|계약|확보|출시|도입|扩产|增设|加码|投资|合同|中标|上调|抢购|激增|采用|升级)/i;
const ACCOUNT_DOWN_RE = /(cut|delay|pause|halt|cancel|slowdown|shortfall|decline|축소|지연|보류|중단|하향|감산|취소|감소|减产|下调|推迟|放缓|叫停|下降)/i;
const RELATION_ACTION_RE = /(partner(?:ship)?|collaborat(?:e|es|ed|ion|ive)?|co-?develop|joint venture|supply agreement|supply contract|supplier|customer|invest(?:ment|s|ed)? in|acquir(?:e|es|ed|ing)|merger|license agreement|strategic alliance|파트너십|협력|공동 개발|합작|공급 계약|공급사|고객사|투자|인수|합병|라이선스 계약|战略合作|合作|联合开发|合资|供应协议|供应合同|供应商|客户|投资|收购|并购|许可协议)/i;

export const DEMAND_ACCOUNT_REGISTRY = [
  { id: "azure", category: "hyperscaler", name: "Microsoft · Azure", aliases: ["microsoft azure", "azure", "maia"], context: ["cloud", "data center", "capex", "maia", "openai"] },
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
  const title = String(item.title || "").replace(/\s+/g, " ").trim();
  const raw = String(item.quote || title).replace(/\s+/g, " ").trim();
  if (!raw || raw === title) return { quote: title, quality: "title" };
  if (/(?:为求职者提供|在线直招|求职找工作|all rights reserved|copyright|about us|welcome to|招聘信息)/iu.test(raw)) {
    return { quote: title, quality: "title-fallback" };
  }
  const visiblyCut = /(?:\.\.\.|…|[,:;·—-])$/u.test(raw)
    || /\b(?:and|or|to|of|for|with|by|from|that|which|as|at|in|on)$/i.test(raw)
    || /(?:및|또는|위해|통해|대한|관련|하는|하며|에서|으로|打造了|的|和|与|及|为|在|将|已|正)$/u.test(raw);
  if (!visiblyCut) return { quote: raw, quality: "complete-summary" };
  const completeSentences = raw.match(/[^.!?。！？]+[.!?。！？]+/gu) || [];
  const recovered = completeSentences.join(" ").replace(/\s+/g, " ").trim();
  return recovered
    ? { quote: recovered, quality: "complete-sentences" }
    : { quote: title, quality: "title-fallback" };
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
    const title = item.titleKo || item.title || item.originalTitle || "";
    const originalTitle = item.originalTitle || item.title || "";
    const summary = item.summaryOriginal || item.summary || item.snippet || item.contextKo || "";
    const url = directUrl(item.verification?.canonicalUrl || item.link || item.sourceUrl || item.url || "");
    const date = exactDate(item.date || item.publishedAt || item.sourceDate || item.updatedAt || "");
    const source = item.source || item.platform || "News";
    const category = item.category || item.theme || "";
    const verification = item.verification && typeof item.verification === "object" ? item.verification : {};
    return {
      id: verification.id || item.id || `${date}:${index}`,
      title: String(title).trim(),
      originalTitle: String(originalTitle).trim(),
      summary: String(summary).trim(),
      text: normalizeText(`${source} ${category} ${originalTitle} ${title} ${summary}`),
      source,
      sourceClass: verification.sourceClass || item.sourceClass || "news",
      origin: verification.origin || item.origin || (item.preservedSeed || item.curated ? "curated-seed" : ""),
      observedThisRun: observedInCurrentRun(item, now),
      url,
      date,
      category,
    };
  }).filter((item) => {
    if (!item.text || !item.url || !item.date || !item.observedThisRun || ageInDays(item.date, now) > windowDays) return false;
    const key = item.url || `${item.date}:${item.originalTitle}`;
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
        snippet: item.summary || item.originalTitle,
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
        ? `${driverLabel} · 최근 30일 직접 근거 ${hits.length}건(독립 출처 ${independentSourceCount}개), 확장어 ${up}·축소어 ${down}`
        : hits.length
          ? `근거 품질 미달 · 최근 30일 ${hits.length}건, 독립 출처 ${independentSourceCount}개 · 점수 산출 보류`
        : "최근 30일 직접 근거 없음 · 고정 점수로 대체하지 않음",
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

function roleEvidenceCandidates(context = {}, quant = {}, now = new Date()) {
  const news = makeCorpus(context, now, 30).map((item) => ({
    kind: "article",
    title: item.title || item.originalTitle,
    quote: item.summary || item.originalTitle,
    source: item.source,
    sourceUrl: item.url,
    date: item.date,
    sourceClass: item.sourceClass,
    titleText: normalizeText(item.title || item.originalTitle),
    text: item.text,
  }));
  const figures = (quant.liveFigures?.items || []).filter((item) => (
    item.origin === "live-crawl" && item.observedThisRun === true
  )).map((item) => ({
    kind: "figure",
    title: item.contextKo || item.snippet || item.value,
    quote: item.snippet || item.contextKo || "",
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
    const chosen = ranked[0];
    if (!chosen) {
      roles[role] = { status: "insufficient", source: null, sourceUrl: "", date: "", quote: "", matchedKeywords: [] };
      continue;
    }
    used.add(chosen.item.sourceUrl);
    const selectedQuote = completeEvidenceQuote(chosen.item);
    roles[role] = {
      status: "live",
      kind: chosen.item.kind,
      title: chosen.item.title,
      quote: selectedQuote.quote,
      quoteQuality: selectedQuote.quality,
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

const BASELINE_STOP_WORDS = new Set(["memory", "메모리", "시장", "추적", "확인", "기준", "확대", "경쟁", "공급", "track", "watch", "signal", "signals", "action", "actions", "linkedcategories", "합니다", "입니다", "있습니다", "위한", "함께", "아니라", "보다", "제품", "고객", "기술", "후보", "목표", "architecture"]);

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
  const raw = [item.id, item.company, item.title, item.label, item.thesis]
    .concat(item.facts || [], item.signals || [], item.watch || [], item.linkedCategories || [])
    .join(" ")
    .normalize("NFKC")
    .toLowerCase();
  return [...new Set(raw.split(/[^a-z0-9가-힣²³]+/).map((word) => word.trim()).filter((word) => word.length >= 3 && !BASELINE_STOP_WORDS.has(word)))].slice(0, 24);
}

const BASELINE_ENTITY_ANCHOR_RE = /^(?:cxmt|ymtc|tsmc|micron|samsung|skhy|hynix|solidigm|hbf|panmnesia|pangea|china|chinese|중국)$/i;
const BASELINE_TECH_ANCHOR_RE = /^(?:hbm3e?|hbm4e?|dram|nand|xtacking|cowos|cxl|lpddr5x|ddr6|essd|hybrid|bonding|base|die)$/i;

function baselineAnchorKeywords(item = {}, keywords = []) {
  const identity = [item.id, item.company, item.title, item.label]
    .join(" ")
    .normalize("NFKC")
    .toLowerCase()
    .split(/[^a-z0-9가-힣]+/)
    .filter(Boolean);
  const entityAnchors = [...new Set(identity.filter((word) => BASELINE_ENTITY_ANCHOR_RE.test(word)))];
  if (entityAnchors.length) return entityAnchors;
  return keywords.filter((word) => BASELINE_TECH_ANCHOR_RE.test(word)).slice(0, 8);
}

function directionPolarity(text = "") {
  const normalized = normalizeText(text);
  const positive = /(growth|increase|expand|ramp|surge|improve|성장|증가|확대|증설|개선|상향)/i.test(normalized);
  const negative = /(decline|decrease|delay|cut|contraction|slowdown|감소|축소|지연|하락|감산|둔화)/i.test(normalized);
  return positive === negative ? 0 : positive ? 1 : -1;
}

export function buildBaselineFreshness(baseline = {}, context = {}, previous = {}, nowInput = new Date()) {
  const now = new Date(nowInput);
  const methodologyVersion = "2.3";
  const previousTrusted = previous?.methodologyVersion === methodologyVersion;
  const corpus = makeCorpus({ news: context.news || [], brokerResearch: context.brokerResearch || {} }, now, 45);
  const items = {};
  for (const target of baselineTargets(baseline)) {
    const keywords = baselineKeywords(target.value);
    const anchors = baselineAnchorKeywords(target.value, keywords);
    const matches = corpus.map((item) => {
      const matched = keywords.filter((keyword) => exactTermMatch(item.text, keyword));
      const matchedAnchors = anchors.filter((keyword) => exactTermMatch(item.text, keyword));
      return { item, matched, matchedAnchors, score: matched.reduce((sum, keyword) => sum + Math.min(8, keyword.length), 0) };
    }).filter((match) => {
      const highSignal = match.matchedAnchors.some((word) => /^(?:hbf|hbm4e?|xtacking|pangea|panmnesia|cowos|lpddr5x|ddr6)$/i.test(word));
      return Boolean(match.matchedAnchors.length && (match.matched.length >= 2 || highSignal));
    }).sort((a, b) => b.score - a.score || String(b.item.date).localeCompare(String(a.item.date)));
    const currentEvidence = matches.slice(0, 5).map(({ item, matched }) => ({
      title: item.title || item.originalTitle,
      source: item.source,
      url: item.url,
      date: item.date,
      matchedKeywords: matched.slice(0, 5),
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
      title: opposing.item.title || opposing.item.originalTitle,
      source: opposing.item.source,
      url: opposing.item.url,
      date: opposing.item.date,
      matchedKeywords: opposing.matched.slice(0, 5),
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
      conflictCandidate,
      conflictEvidence,
      reviewReason: conflictCandidate
        ? "기준 서술과 반대 방향어가 포함된 최신 근거 발견 · 사람 검토 필요"
        : evidence.length ? "최신 직접 링크 근거와 키워드 대조 완료" : "직접 대조 근거 없음",
    };
  }
  const values = Object.values(items);
  return {
    schemaVersion: "2.3",
    methodologyVersion,
    updatedAt: now.toISOString(),
    staleAfterDays: 14,
    total: values.length,
    current: values.filter((item) => item.status === "current").length,
    revalidate: values.filter((item) => item.status === "revalidate").length,
    conflictCandidates: values.filter((item) => item.status === "conflict-candidate").length,
    items,
    method: "baseline thesis/facts/summary/note/alt/insight/Q&A vs current-run 45d direct-link evidence; per-fact stable ids; entity/technology anchor required; unmatched or evidence older than 14d is revalidation-required; opposing wording is review-only",
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
