#!/usr/bin/env node
/**
 * Lightweight content reliability audit for the static dashboard.
 *
 * This does not fact-check every claim. It catches mechanical quality issues
 * that create trust problems: truncated Korean endings, replacement characters,
 * unresolved conflict markers, and numeric KPI cards without source URLs.
 */
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const textFiles = [
  "index.html",
  "assets/js/app.js",
  "data/baseline.json",
  "data/live.json",
  "data/price-history.json",
  "data/crawl-exclusions.json",
];

const checks = [];

function addIssue(level, file, message, sample = "") {
  checks.push({ level, file, message, sample });
}

function lineFor(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

for (const file of textFiles) {
  const abs = resolve(root, file);
  const text = await readFile(abs, "utf8");

  const conflict = text.match(/<<<<<<<|=======|>>>>>>>/);
  if (conflict) addIssue("error", file, "merge conflict marker", conflict[0]);

  for (const match of text.matchAll(/(?:합니|입니|됩니|했습니|있습니|없습니)(?![다까])/g)) {
    addIssue("error", file, `truncated Korean ending at line ${lineFor(text, match.index)}`, match[0]);
  }

  for (const match of text.matchAll(/\uFFFD/g)) {
    addIssue("error", file, `replacement character at line ${lineFor(text, match.index)}`, match[0]);
  }

  for (const phrase of [
    "가격 · 수요 · 고객 수치를 원문 기준으로 확인",
    "업체 · 캐파 · 정책 수치를 원문 기준으로 분리 검증",
    "공급파 경보",
  ]) {
    const index = text.indexOf(phrase);
    if (index >= 0) addIssue("error", file, `repeated news boilerplate at line ${lineFor(text, index)}`, phrase);
  }

  if (file === "assets/js/app.js" && /\[\/입니다\/g,\s*""\]|\[\/합니다\/g,\s*""\]/.test(text)) {
    addIssue("error", file, "destructive Korean ending normalization can truncate words");
  }

  const placeholderPattern = file.endsWith(".js")
    ? /\b(?:TODO|TBD)\b/g
    : /\b(?:TODO|TBD|undefined|NaN)\b/g;
  for (const match of text.matchAll(placeholderPattern)) {
    addIssue("warn", file, `placeholder token at line ${lineFor(text, match.index)}`, match[0]);
  }
}

const baseline = JSON.parse(await readFile(resolve(root, "data/baseline.json"), "utf8"));
const crawlExclusions = JSON.parse(await readFile(resolve(root, "data/crawl-exclusions.json"), "utf8"));
const crawlExclusionItems = Array.isArray(crawlExclusions) ? crawlExclusions : crawlExclusions.items;
if (!Array.isArray(crawlExclusionItems)) {
  addIssue("error", "data/crawl-exclusions.json", "crawl exclusion items must be an array");
} else {
  const exclusionKeys = new Set();
  for (const record of crawlExclusionItems) {
    const keys = typeof record === "string" ? [record] : (Array.isArray(record?.keys) ? record.keys : [record?.key]);
    const cleanKeys = keys.map((key) => String(key || "").trim()).filter(Boolean);
    if (!cleanKeys.length) addIssue("error", "data/crawl-exclusions.json", "crawl exclusion record has no key", JSON.stringify(record));
    for (const key of cleanKeys) {
      if (!/^(?:news|community|price):(?:url|id|title|history|item):/.test(key)) {
        addIssue("error", "data/crawl-exclusions.json", "crawl exclusion key has an invalid format", key);
      }
      if (exclusionKeys.has(key)) addIssue("error", "data/crawl-exclusions.json", "duplicate crawl exclusion key", key);
      exclusionKeys.add(key);
    }
  }
}
const baselineText = await readFile(resolve(root, "data/baseline.json"), "utf8");
const appText = await readFile(resolve(root, "assets/js/app.js"), "utf8");
for (const phrase of ["기존 SKHY 전망의 약 $975B", "60~70% 배분", "MATCH Act 위원회 표결 44:0"]) {
  if (baselineText.includes(phrase) || appText.includes(phrase)) {
    addIssue("error", phrase === "기존 SKHY 전망의 약 $975B" ? "data/baseline.json" : "assets/js/app.js", "known fact-label conflict remains", phrase);
  }
}
if (/FALSE_MEMORY_NEWS_RE/.test(appText)) {
  addIssue("error", "assets/js/app.js", "legacy false-memory filter can suppress verified events", "FALSE_MEMORY_NEWS_RE");
}
if (/filter\(isChinaArticle\)/.test(appText) && !/function\s+isChinaArticle\s*\(/.test(appText)) {
  addIssue("error", "assets/js/app.js", "China article predicate is referenced but not defined", "isChinaArticle");
}
if (!/SpeechSynthesisUtterance/.test(appText) || !/speechSynthesis/.test(appText)) {
  addIssue("error", "assets/js/app.js", "agent TTS engine is missing");
}
const numericKpis = (baseline.kpis || []).filter((item) => /\d/.test(String(item.value || "")));
const missingKpiSources = numericKpis.filter((item) => !String(item.sourceUrl || "").trim());
for (const item of missingKpiSources) {
  addIssue("error", "data/baseline.json", "numeric KPI without sourceUrl", item.label || item.id || "");
}
for (const item of numericKpis) {
  if (!/^https?:\/\//i.test(String(item.sourceUrl || "")) || /dicacros-gif\.github\.io/i.test(String(item.sourceUrl || ""))) {
    addIssue("error", "data/baseline.json", "numeric KPI has a non-verifiable sourceUrl", item.label || item.id || "");
  }
  if (!String(item.sourceDate || "").trim()) {
    addIssue("error", "data/baseline.json", "numeric KPI has no sourceDate", item.label || item.id || "");
  }
  if (!["OK", "Watch"].includes(String(item.status || ""))) {
    addIssue("error", "data/baseline.json", "numeric KPI has an invalid evidence status", `${item.label || item.id || ""}:${item.status || "missing"}`);
  }
}

const marketHistory = JSON.parse(await readFile(resolve(root, "data/market-history.json"), "utf8"));
for (const [id, index] of Object.entries(marketHistory.indexes || {})) {
  const points = Array.isArray(index.points) ? index.points : [];
  if (points.length < 2) addIssue("error", "data/market-history.json", "market series has fewer than 2 points", id);
  const invalid = points.filter((point) => {
    const value = Number(point.close ?? point.value);
    return !Number.isFinite(value) || value <= 0;
  });
  if (invalid.length) addIssue("error", "data/market-history.json", "market series contains non-positive close", `${id}: ${invalid.length}`);
  const latestValue = Number(index.latest?.close ?? index.latest?.value);
  if (!Number.isFinite(latestValue) || latestValue <= 0) {
    addIssue("error", "data/market-history.json", "market latest value is invalid", `${id}: ${latestValue}`);
  }
  const lastValue = Number(points.at(-1)?.close ?? points.at(-1)?.value);
  if (Number.isFinite(latestValue) && Number.isFinite(lastValue) && latestValue !== lastValue) {
    addIssue("error", "data/market-history.json", "market latest does not match final point", `${id}: ${latestValue} != ${lastValue}`);
  }
  if (Number(index.pointCount || 0) !== points.length) {
    addIssue("error", "data/market-history.json", "market pointCount mismatch", `${id}: ${index.pointCount} != ${points.length}`);
  }
}

const priceHistory = JSON.parse(await readFile(resolve(root, "data/price-history.json"), "utf8"));
const priceDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
for (const [key, item] of Object.entries(priceHistory.items || {})) {
  const points = Array.isArray(item.points) ? item.points : [];
  const dayKeys = new Set();
  let previousTime = 0;
  for (const point of points) {
    const value = Number(point.average);
    const time = new Date(point.date || point.crawledAt || point.updatedAt || 0).getTime();
    if (!Number.isFinite(value) || value <= 0) {
      addIssue("error", "data/price-history.json", "price history contains a non-positive value", `${key}: ${point.average}`);
    }
    if (!Number.isFinite(time) || time <= 0) {
      addIssue("error", "data/price-history.json", "price history contains an invalid timestamp", key);
      continue;
    }
    const dayKey = priceDayFormatter.format(new Date(time));
    if (dayKeys.has(dayKey)) {
      addIssue("error", "data/price-history.json", "price history contains duplicate KST dates", `${key}: ${dayKey}`);
    }
    dayKeys.add(dayKey);
    if (previousTime && time < previousTime) {
      addIssue("error", "data/price-history.json", "price history is not chronological", key);
    }
    previousTime = time;
  }
  if (points.length > 365 * 5 + 60) {
    addIssue("error", "data/price-history.json", "price history exceeds the five-year retention limit", `${key}: ${points.length}`);
  }
}

const live = JSON.parse(await readFile(resolve(root, "data/live.json"), "utf8"));
const quality = live.quality || {};
if (live.schemaVersion !== "3.0") {
  addIssue("error", "data/live.json", "live schemaVersion is not current", String(live.schemaVersion || "missing"));
}
if (quality.status !== "verified") {
  addIssue("error", "data/live.json", "crawl quality gate did not verify the payload", String(quality.status || "missing"));
}
if ((quality.failures || []).length) {
  addIssue("error", "data/live.json", "crawl quality report contains failures", (quality.failures || []).join(", "));
}
for (const check of quality.checks || []) {
  if (check?.critical && !check?.passed) {
    addIssue("error", "data/live.json", "critical crawl quality check failed", check.id || "unknown");
  }
}
const liveUpdatedAt = new Date(quality.verifiedAt || live.updatedAt || 0);
const liveAgeHours = (Date.now() - liveUpdatedAt.getTime()) / 36e5;
if (!Number.isFinite(liveAgeHours) || liveAgeHours < 0 || liveAgeHours > 36) {
  addIssue("error", "data/live.json", "verified live payload is outside the 36-hour freshness window", `${liveAgeHours.toFixed(1)}h`);
}
const stocks = Object.entries(live.stocks || {});
for (const [id, stock] of stocks) {
  const latest = Number(stock.latestClose);
  const previous = Number(stock.prevClose);
  const points = Array.isArray(stock.points) ? stock.points.map(Number) : [];
  if (!Number.isFinite(latest) || latest <= 0) addIssue("error", "data/live.json", "stock latest close is invalid", `${id}: ${latest}`);
  if (points.some((value) => !Number.isFinite(value) || value <= 0)) {
    addIssue("error", "data/live.json", "stock series contains non-positive close", id);
  }
  if (Number.isFinite(latest) && Number.isFinite(previous) && previous > 0) {
    const expected = Number((((latest - previous) / previous) * 100).toFixed(2));
    if (Math.abs(expected - Number(stock.changePct)) > 0.01) {
      addIssue("error", "data/live.json", "stock changePct does not match closes", `${id}: ${stock.changePct} != ${expected}`);
    }
  }
}

const priceRows = (live.prices?.sections || []).flatMap((section) => (section.rows || []).map((row) => ({ section, row })));
for (const { section, row } of priceRows) {
  const average = Number(row.average);
  if (!Number.isFinite(average) || average <= 0) {
    addIssue("error", "data/live.json", "price row average is invalid", `${section.title}: ${row.item}`);
  }
  if (!/^https?:\/\//i.test(String(section.sourceUrl || ""))) {
    addIssue("error", "data/live.json", "price section is missing sourceUrl", section.title || section.id || "");
  }
  const invalidHistory = (row.history || []).filter((point) => {
    const value = Number(point.average);
    return !Number.isFinite(value) || value <= 0;
  });
  if (invalidHistory.length) {
    addIssue("error", "data/live.json", "price history contains non-positive value", `${row.item}: ${invalidHistory.length}`);
  }
}

const news = Array.isArray(live.news) ? live.news : [];
const summarizedNews = news.filter((item) => String(item.summary || item.summaryOriginal || "").trim());
const directNews = news.filter((item) => /^https?:\/\//i.test(String(item.sourceUrl || "")) && !/news\.google\.com/i.test(item.sourceUrl));
const newsTitleKeys = new Set();
const newsUrlKeys = new Set();
const hanCount = (value = "") => (String(value).match(/[㐀-䶿一-鿿豈-﫿]/g) || []).length;
const latinCount = (value = "") => (String(value).match(/[A-Za-z]/g) || []).length;
const languageCounts = { english: 0, chinese: 0 };
for (const item of news) {
  const title = String(item.title || "").trim();
  const language = String(item.streamLanguage || item.language || "").toLowerCase();
  const key = title.toLowerCase().replace(/\s[-–—]\s[^-–—|]+$/g, "").replace(/[^a-z0-9가-힣一-鿿]+/g, "");
  if (/^\s*\[(?:news|뉴스)\]/i.test(title)) addIssue("error", "data/live.json", "news title contains forbidden prefix", title);
  if (!new Set(["english", "chinese"]).has(language)) {
    addIssue("error", "data/live.json", "news item has no verified stream language", title);
  } else if (language === "english" && (hanCount(title) > 0 || latinCount(title) < 6)) {
    addIssue("error", "data/live.json", "Chinese-script title leaked into English stream", title);
  } else if (language === "chinese" && hanCount(title) < 2) {
    addIssue("error", "data/live.json", "non-Chinese title leaked into Chinese stream", title);
  }
  if (languageCounts[language] != null) languageCounts[language] += 1;
  if (key && newsTitleKeys.has(key)) addIssue("error", "data/live.json", "duplicate news title", title);
  if (key) newsTitleKeys.add(key);
  const sourceUrl = String(item.sourceUrl || "").trim();
  if (!/^https?:\/\//i.test(sourceUrl) || /news\.google\.com/i.test(sourceUrl)) {
    addIssue("error", "data/live.json", "news item lacks a direct source URL", title);
  } else {
    let canonicalUrl = sourceUrl.toLowerCase().replace(/#.*$/, "").replace(/\/$/, "");
    try {
      const parsed = new URL(sourceUrl);
      parsed.hash = "";
      for (const param of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "oc"]) parsed.searchParams.delete(param);
      canonicalUrl = parsed.toString().replace(/\/$/, "").toLowerCase();
    } catch {
      // The direct URL format check above already reports malformed values.
    }
    if (newsUrlKeys.has(canonicalUrl)) addIssue("error", "data/live.json", "duplicate canonical news URL", sourceUrl);
    newsUrlKeys.add(canonicalUrl);
  }
}
if (news.length && (!languageCounts.english || !languageCounts.chinese)) {
  addIssue("error", "data/live.json", "one article language stream is empty", JSON.stringify(languageCounts));
}
if (news.length && summarizedNews.length / news.length < 0.55) {
  addIssue("error", "data/live.json", "fewer than 55% of news items have article-specific summaries", `${summarizedNews.length}/${news.length}`);
}
if (news.length && directNews.length / news.length < 0.9) {
  addIssue("error", "data/live.json", "fewer than 90% of news items resolve to direct source URLs", `${directNews.length}/${news.length}`);
}

const community = live.communitySignals || {};
const communityItems = Array.isArray(community.items) ? community.items : [];
const communityAllowedDomains = [
  "xueqiu.com",
  "zhihu.com",
  "guba.eastmoney.com",
  "caifuhao.eastmoney.com",
  "v2ex.com",
  "chiphell.com",
  "smzdm.com",
  "nga.cn",
  "maimai.cn",
  "nowcoder.com",
  "kanzhun.com",
  "zhipin.com",
  "liepin.com",
  "zhaopin.com",
  "cxmt.zhiye.com",
  "cxmt.com",
  "whxmc.zhiye.com",
  "jy.xmu.edu.cn",
  "zjc.sasu.edu.cn",
  "eie.scu.edu.cn",
];
const communityTypes = new Set(["workplace", "technology", "market", "consumer"]);
const communityKeys = new Set();
if (!communityItems.length) addIssue("error", "data/live.json", "China community signal board has no items");
for (const item of communityItems) {
  const url = String(item.sourceUrl || item.link || "");
  let allowed = false;
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    allowed = communityAllowedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    allowed = false;
  }
  if (!allowed) addIssue("error", "data/live.json", "community item uses a non-allowlisted source URL", url || item.id || "missing");
  if (!communityTypes.has(String(item.type || ""))) {
    addIssue("error", "data/live.json", "community item has an invalid type", `${item.id}:${item.type || "missing"}`);
  }
  if (!String(item.titleKo || item.title || "").trim()) {
    addIssue("error", "data/live.json", "community item has no title", item.id || url);
  }
  if (String(item.summary || item.summaryOriginal || "").trim().length < 28) {
    addIssue("error", "data/live.json", "community item has no substantive summary", item.id || url);
  }
  if (!String(item.insight || "").trim()) {
    addIssue("error", "data/live.json", "community item has no decision insight", item.id || url);
  }
  if (!String(item.validation || "").trim()) {
    addIssue("error", "data/live.json", "community item has no validation KPI", item.id || url);
  }
  if (!["커뮤니티 신호", "공개 채용"].includes(String(item.evidenceLevel || ""))) {
    addIssue("error", "data/live.json", "community item has an invalid evidence label", `${item.id}:${item.evidenceLevel || "missing"}`);
  }
  for (const forbidden of ["author", "authorName", "username", "userId", "profile", "displayName"]) {
    if (Object.prototype.hasOwnProperty.call(item, forbidden)) {
      addIssue("error", "data/live.json", "community item retains a personal-identifier field", `${item.id}:${forbidden}`);
    }
  }
  const key = url.replace(/\/$/, "").toLowerCase();
  if (key && communityKeys.has(key)) addIssue("error", "data/live.json", "duplicate community source URL", url);
  if (key) communityKeys.add(key);
}
if (Number(community.total || 0) !== communityItems.length) {
  addIssue("error", "data/live.json", "community total count mismatch", `${community.total} != ${communityItems.length}`);
}
const communityBriefs = Array.isArray(community.briefs) ? community.briefs : [];
if (communityItems.length && communityBriefs.length < 3) {
  addIssue("error", "data/live.json", "fewer than three community decision briefs", String(communityBriefs.length));
}
for (const brief of communityBriefs) {
  if (!brief.id || Number(brief.count || 0) < 1 || !brief.signal || !brief.implication || !brief.validation) {
    addIssue("error", "data/live.json", "community decision brief is incomplete", brief.id || "missing");
  }
}
const communityHostPattern = /(?:xueqiu\.com|zhihu\.com|guba\.eastmoney\.com|v2ex\.com|chiphell\.com|smzdm\.com|nga\.cn|maimai\.cn|nowcoder\.com|kanzhun\.com|zhipin\.com|liepin\.com|zhaopin\.com)/i;

const intelligence = live.intelligence || {};
const briefs = Array.isArray(intelligence.briefs) ? intelligence.briefs : [];
const briefIds = new Set();
if (!intelligence.generatedAt || Number.isNaN(new Date(intelligence.generatedAt).getTime())) {
  addIssue("error", "data/live.json", "intelligence generatedAt is missing or invalid");
} else {
  const ageHours = (Date.now() - new Date(intelligence.generatedAt).getTime()) / 36e5;
  if (ageHours > 36) addIssue("error", "data/live.json", "intelligence is older than 36 hours", `${ageHours.toFixed(1)}h`);
}
if (briefs.length < 6) addIssue("error", "data/live.json", "fewer than six evidence-backed intelligence briefs", String(briefs.length));
for (const brief of briefs) {
  if (briefIds.has(brief.id)) addIssue("error", "data/live.json", "duplicate intelligence brief id", brief.id);
  briefIds.add(brief.id);
  if (!/^https?:\/\//i.test(String(brief.latest?.url || "")) || /news\.google\.com/i.test(String(brief.latest?.url || ""))) {
    addIssue("error", "data/live.json", "intelligence brief lacks a direct source URL", brief.id || "unknown");
  }
  if (!String(brief.latest?.summary || "").trim()) {
    addIssue("error", "data/live.json", "intelligence brief lacks an article summary", brief.id || "unknown");
  }
  const briefSummary = String(brief.latest?.summary || "").trim();
  if ((briefSummary.match(/[가-힣]/g) || []).length < 10) {
    addIssue("error", "data/live.json", "intelligence brief summary is not a substantive Korean summary", brief.id || "unknown");
  }
  if (/중국 최대의 삼성전자/.test(briefSummary)) {
    addIssue("error", "data/live.json", "intelligence brief contains a known malformed translation", brief.id || "unknown");
  }
  if (!["공식", "외신", "분석", "내부추정"].includes(String(brief.latest?.sourceType || ""))) {
    addIssue("error", "data/live.json", "intelligence brief has an invalid source type", `${brief.id || "unknown"}:${brief.latest?.sourceType || "missing"}`);
  }
  if (!["Confirmed", "Watch", "Inferred", "Stale"].includes(String(brief.latest?.evidenceLevel || ""))) {
    addIssue("error", "data/live.json", "intelligence brief has an invalid evidence level", `${brief.id || "unknown"}:${brief.latest?.evidenceLevel || "missing"}`);
  }
  if (!String(brief.decision || "").trim() || !String(brief.reversalKpi || "").trim()) {
    addIssue("error", "data/live.json", "intelligence brief lacks decision or reversal KPI", brief.id || "unknown");
  }
  if (String(brief.latest?.language || "").toLowerCase() === "chinese" && brief.latest?.evidenceLevel === "Confirmed") {
    addIssue("error", "data/live.json", "Chinese-only article was promoted to Confirmed evidence", brief.id || "unknown");
  }
  if (brief.price && !/^https?:\/\//i.test(String(brief.price.sourceUrl || ""))) {
    addIssue("error", "data/live.json", "intelligence price evidence lacks source URL", brief.id || "unknown");
  }
  if (communityHostPattern.test(String(brief.latest?.url || ""))) {
    addIssue("error", "data/live.json", "community signal was promoted into an intelligence fact brief", brief.id || "unknown");
  }
}
const validation = intelligence.validation || {};
if (Number(validation.displayedNews) !== news.length) {
  addIssue("error", "data/live.json", "intelligence displayedNews count mismatch", `${validation.displayedNews} != ${news.length}`);
}
if (Number(validation.priceRows) !== priceRows.length) {
  addIssue("error", "data/live.json", "intelligence priceRows count mismatch", `${validation.priceRows} != ${priceRows.length}`);
}
const qualityMetrics = quality.metrics || {};
const expectedQualityMetrics = {
  priceRows: priceRows.length,
  newsItems: news.length,
  englishNews: languageCounts.english,
  chineseNews: languageCounts.chinese,
  duplicateCount: 0,
  communitySignals: communityItems.length,
  decisionBriefs: briefs.length,
  marketIndexes: Object.values(live.marketHistory?.indexes || {}).filter((item) => Number(item?.latest?.close ?? item?.latest?.value) > 0).length,
  peerStocks: stocks.filter(([, stock]) => Number(stock.latestClose) > 0).length,
};
for (const [metric, expected] of Object.entries(expectedQualityMetrics)) {
  if (Number(qualityMetrics[metric]) !== Number(expected)) {
    addIssue("error", "data/live.json", "crawl quality metric does not match payload", `${metric}: ${qualityMetrics[metric]} != ${expected}`);
  }
}
if (Number(qualityMetrics.directSourceRatio) < 0.9 || Number(qualityMetrics.summaryRatio) < 0.55) {
  addIssue("error", "data/live.json", "crawl quality ratios are below deployment thresholds", JSON.stringify({
    directSourceRatio: qualityMetrics.directSourceRatio,
    summaryRatio: qualityMetrics.summaryRatio,
  }));
}

const errors = checks.filter((item) => item.level === "error");
const warnings = checks.filter((item) => item.level === "warn");
console.log(JSON.stringify({
  ok: errors.length === 0,
  files: textFiles.length,
  numericKpis: numericKpis.length,
  priceRows: priceRows.length,
  priceHistoryItems: Object.keys(priceHistory.items || {}).length,
  stockSeries: stocks.length,
  summarizedNews: `${summarizedNews.length}/${news.length}`,
  communitySignals: communityItems.length,
  intelligenceBriefs: briefs.length,
  qualityStatus: quality.status,
  errors,
  warnings,
}, null, 2));

if (errors.length) process.exit(1);
