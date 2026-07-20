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
import { DEMAND_ACCOUNT_REGISTRY, RELATION_ENTITY_REGISTRY } from "./live-pipeline.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const textFiles = [
  "index.html",
  "assets/js/app.js",
  "data/baseline.json",
  "data/live.json",
  "data/quant.json",
  "data/quant-model.json",
  "data/price-history.json",
  "data/market-history.json",
  "data/crawl-audit.json",
  "data/crawl-quarantine.json",
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
const stylesText = await readFile(resolve(root, "assets/css/styles.css"), "utf8");
const crawlText = await readFile(resolve(root, "scripts/crawl.mjs"), "utf8");

const liveFigureStyles = stylesText.match(/\/\* ---------------- Live figures[\s\S]*?\/\* ---------------- Semantic emphasis/)?.[0] || "";
if (!/const groupedItems = groupLiveFigures\(items\)/.test(appText)) {
  addIssue("error", "assets/js/app.js", "live figures must group observations into story cards");
}
if (/\.(?:lf-snippet|lf-context)\s*\{[^}]*?(?:line-clamp|overflow:\s*hidden)/s.test(liveFigureStyles)) {
  addIssue("error", "assets/css/styles.css", "live figure titles and summaries must not be line-clamped or hidden");
}
if (/snippet:\s*clause\.slice|contextKo:\s*article\.textKo\.slice/.test(crawlText)) {
  addIssue("error", "scripts/crawl.mjs", "live figure source text must not be cut at a fixed character count");
}
for (const checkId of ["news_observed_this_run", "news_observed_english", "news_observed_chinese"]) {
  if (!crawlText.includes(`id: "${checkId}"`)) {
    addIssue("error", "scripts/crawl.mjs", "quality gate must require current-run crawled news instead of curated seeds", checkId);
  }
}
if (/citations\.concat\(brokerResearchFallback\(\)\)/.test(appText) || /citations[^\n]*\.concat\(BROKER_REPORT_SEEDS\)/.test(crawlText)) {
  addIssue("error", "assets/js/app.js", "URL-less broker baselines must not be injected into live research cards");
}

const hbmDecisionBlock = appText.match(/id:\s*"hbm-ai-server"[\s\S]{0,1800}/)?.[0] || "";
if (!/directSignalModel:\s*"hbm"/.test(hbmDecisionBlock) || !/priceTerms:\s*\[\s*\]/.test(hbmDecisionBlock)) {
  addIssue("error", "assets/js/app.js", "HBM decision model must use direct evidence without commodity-memory price proxies");
}
const hbmCrawlBlock = crawlText.match(/id:\s*"hbm",\s*\r?\n\s*label:\s*"HBM·AI 서버"[\s\S]{0,1000}/)?.[0] || "";
if (!/priceTerms:\s*\[\s*\]/.test(hbmCrawlBlock) || !/priceProxy:\s*false/.test(hbmCrawlBlock)) {
  addIssue("error", "scripts/crawl.mjs", "HBM crawler topic must not attach DRAM, GDDR, or module price rows");
}
for (const phrase of ["프리미엄 메모리 proxy", "DDR5/GDDR/모듈 가격을 프리미엄 메모리", "HBM 직접 가격표가 없으므로"]) {
  if (appText.includes(phrase) || crawlText.includes(phrase)) {
    addIssue("error", "assets/js/app.js", "legacy HBM price-proxy wording remains", phrase);
  }
}
for (const phrase of ["기존 SKHY 전망의 약 $975B", "60~70% 배분", "MATCH Act 위원회 표결 44:0", "하원 외교위 36:8", "약 $3.0B"]) {
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

const isDirectSourceUrl = (value = "") => {
  try {
    const url = new URL(String(value));
    return ["http:", "https:"].includes(url.protocol) && url.hostname !== "news.google.com";
  } catch {
    return false;
  }
};
const exactSourceDate = (value = "") => /^20\d{2}-\d{2}-\d{2}$/.test(String(value));

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

for (const [id, metric] of Object.entries(marketHistory.metrics || {})) {
  const points = Array.isArray(metric.points) ? metric.points : [];
  if (!points.length) addIssue("error", "data/market-history.json", "quant metric has no history points", id);
  if (points.some((point) => !Number.isFinite(Number(point.value)))) {
    addIssue("error", "data/market-history.json", "quant metric contains a non-numeric value", id);
  }
  if (points.some((point) => !exactSourceDate(point.date)
    || !isDirectSourceUrl(point.sourceUrl)
    || !["live-verified", "last-verified"].includes(point.dataStatus))) {
    addIssue("error", "data/market-history.json", "quant history contains a crawl-date copy or unprovenanced point", id);
  }
  if (new Set(points.map((point) => point.date)).size !== points.length) {
    addIssue("error", "data/market-history.json", "quant history contains duplicate observation dates", id);
  }
  const definition = marketHistory.metricDefinitions?.[id];
  if (!definition || !isDirectSourceUrl(definition.sourceUrl)) {
    addIssue("error", "data/market-history.json", "quant metric definition lacks a direct source URL", id);
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
const quant = JSON.parse(await readFile(resolve(root, "data/quant.json"), "utf8"));
const quantModel = JSON.parse(await readFile(resolve(root, "data/quant-model.json"), "utf8"));
const crawlAudit = JSON.parse(await readFile(resolve(root, "data/crawl-audit.json"), "utf8"));
const crawlQuarantine = JSON.parse(await readFile(resolve(root, "data/crawl-quarantine.json"), "utf8"));
const quality = live.quality || {};

if (DEMAND_ACCOUNT_REGISTRY.length !== 27 || new Set(DEMAND_ACCOUNT_REGISTRY.map((item) => item.id)).size !== 27) {
  addIssue("error", "scripts/live-pipeline.mjs", "demand account registry must contain 27 unique ids");
}
const accountSignals = quant.accountSignals || {};
const accountEntries = Object.entries(accountSignals.accounts || {});
const expectedAccountCount = Number(accountSignals.expectedCount || DEMAND_ACCOUNT_REGISTRY.length);
if (expectedAccountCount !== DEMAND_ACCOUNT_REGISTRY.length || Number(accountSignals.accountCount) !== expectedAccountCount || accountEntries.length !== expectedAccountCount) {
  addIssue("error", "data/quant.json", "account signals must emit the complete versioned registry", `${accountSignals.accountCount || 0}/${accountEntries.length}/${expectedAccountCount}`);
}
for (const [id, account] of accountEntries) {
  if (!DEMAND_ACCOUNT_REGISTRY.some((item) => item.id === id)) addIssue("error", "data/quant.json", "orphan account signal", id);
  if (account.status === "insufficient" && account.pullScore != null) addIssue("error", "data/quant.json", "insufficient account has a fallback score", id);
  if (accountSignals.schemaVersion === "2.1") {
    const qualifies = Number(account.independentSourceCount) >= 2 || Number(account.officialEvidenceCount) >= 1;
    if (Boolean(account.minEvidenceMet) !== qualifies || (account.status === "live") !== qualifies) {
      addIssue("error", "data/quant.json", "account evidence quality/status mismatch", id);
    }
  }
  for (const evidence of account.evidence || []) {
    if (!isDirectSourceUrl(evidence.url) || !exactSourceDate(evidence.date)) addIssue("error", "data/quant.json", "account evidence needs direct URL and exact date", id);
  }
}
const accountDefinitionBlock = appText.match(/const FORECAST_CATEGORIES = \[[\s\S]*?const FORECAST_CATEGORY_ORDER/)?.[0] || "";
if (/\b(?:driver|pull|note)\s*:/.test(accountDefinitionBlock)) {
  addIssue("error", "assets/js/app.js", "demand account presentation contains static direction, pull, or narrative fallback");
}
if (/\baccounts\s*:/.test(accountDefinitionBlock) || /account\.(?:tech|region)\b/.test(appText)) {
  addIssue("error", "assets/js/app.js", "demand account identity or technology is duplicated outside the generated live registry");
}

const briefingRoles = Object.entries(quant.agentBriefing?.roles || {});
if (!briefingRoles.length) addIssue("error", "data/quant.json", "daily agent briefing roles are missing");
for (const [role, item] of briefingRoles) {
  if (item.status === "live" && (!isDirectSourceUrl(item.sourceUrl) || !exactSourceDate(item.date) || !String(item.quote || "").trim())) {
    addIssue("error", "data/quant.json", "live agent evidence needs quote, direct URL, and date", role);
  }
  if (item.status === "live" && !String(item.quoteQuality || "").trim()) {
    addIssue("error", "data/quant.json", "live agent evidence lacks quote-completeness status", role);
  }
  if (item.status === "live" && /(?:\.\.\.|…|打造了)$/u.test(String(item.quote || "").trim())) {
    addIssue("error", "data/quant.json", "live agent evidence is visibly truncated", role);
  }
}

for (const [key, schemaVersions] of Object.entries({ accountSignals: ["2.1", "2.0"], agentBriefing: ["1.1", "1.0"], relationCandidates: ["1.1", "1.0"], baselineFreshness: ["2.3", "2.2"], industryPulse: ["1.1", "1.0"] })) {
  const contract = quant[key] || {};
  const contractExpiry = Date.parse(String(contract.expiresAt || ""));
  if (!schemaVersions.includes(contract.schemaVersion) || contract.runId !== quant.runId || contract.expiresAt !== quant.expiresAt || !Number.isFinite(contractExpiry)) {
    addIssue("error", "data/quant.json", "derived live contract schema/run/expiry mismatch", key);
  }
}

const relationThreshold = Number(quant.relationCandidates?.promotionThreshold || 3);
const relationEntityIds = new Set(RELATION_ENTITY_REGISTRY.map((item) => item.id));
for (const item of quant.relationCandidates?.items || []) {
  const urls = (item.evidence || []).map((evidence) => evidence.url).filter(Boolean);
  if (new Set(urls).size !== urls.length || Number(item.evidenceCount) !== urls.length) {
    addIssue("error", "data/quant.json", "relationship candidate evidence must be canonical-unique", item.id);
  }
  const qualityReady = quant.relationCandidates?.schemaVersion === "1.1"
    ? Number(item.relationEvidenceCount) >= 1 && (Number(item.independentSourceCount) >= 2 || Number(item.officialEvidenceCount) >= 1)
    : true;
  const expected = Number(item.evidenceCount) >= relationThreshold && qualityReady ? "promotion-review" : "candidate";
  if (item.status !== expected) addIssue("error", "data/quant.json", "relationship candidate threshold/status mismatch", item.id);
  if (!relationEntityIds.has(item.from) || !relationEntityIds.has(item.to) || item.from === item.to) {
    addIssue("error", "data/quant.json", "relationship candidate has an unknown or identical endpoint", item.id);
  }
  for (const evidence of item.evidence || []) {
    if (!isDirectSourceUrl(evidence.url) || !exactSourceDate(evidence.date)) {
      addIssue("error", "data/quant.json", "relationship evidence needs a direct URL and exact date", item.id);
    }
  }
}

if (Number(quant.baselineFreshness?.total || 0) < 1 || Number(quant.baselineFreshness?.staleAfterDays) !== 14) {
  addIssue("error", "data/quant.json", "baseline freshness audit is missing");
}
for (const item of Object.values(quant.baselineFreshness?.items || {})) {
  if (!exactSourceDate(item.lastCheckedAt)) addIssue("error", "data/quant.json", "baseline audit run date is missing", item.id);
  if (item.status === "current" && (!exactSourceDate(item.lastEvidenceAt) || Number(item.ageDays) > 14)) {
    addIssue("error", "data/quant.json", "current baseline lacks evidence within 14 days", item.id);
  }
  if (item.status === "revalidate" && exactSourceDate(item.lastEvidenceAt) && Number(item.ageDays) <= 14) {
    addIssue("error", "data/quant.json", "fresh baseline evidence is incorrectly marked for revalidation", item.id);
  }
  if (item.status === "conflict-candidate" && (!isDirectSourceUrl(item.conflictEvidence?.url) || !exactSourceDate(item.conflictEvidence?.date))) {
    addIssue("error", "data/quant.json", "conflict badge lacks its actual opposing evidence", item.id);
  }
}
if (quant.sourceHealth?.schemaVersion !== "2.0") addIssue("error", "data/quant.json", "source health must use stable-id schema v2");
if (Object.prototype.hasOwnProperty.call(quant.sourceHealth?.sources || {}, "quant")) addIssue("error", "data/quant.json", "quant providers must not share one failure streak");
const sourceHealthIds = Object.keys(quant.sourceHealth?.sources || {});
if (new Set(sourceHealthIds.map((id) => id.toLowerCase())).size !== sourceHealthIds.length) {
  addIssue("error", "data/quant.json", "source health contains case-colliding ids that break case-insensitive JSON consumers");
}
if (!crawlText.includes("site:wsts.org/76/Recent-News-Release") || !crawlText.includes("site:semiconductors.org/global-semiconductor-sales")) {
  addIssue("error", "scripts/crawl.mjs", "WSTS and SIA official monitors must both be connected");
}
if (live.schemaVersion !== "4.0") {
  addIssue("error", "data/live.json", "live schemaVersion is not current", String(live.schemaVersion || "missing"));
}
if (quant.schemaVersion !== "2.0") {
  addIssue("error", "data/quant.json", "quant schemaVersion is not current", String(quant.schemaVersion || "missing"));
}
if (quantModel.schemaVersion !== "1.0") {
  addIssue("error", "data/quant-model.json", "quant model schemaVersion is not current", String(quantModel.schemaVersion || "missing"));
}
if (quantModel.methodology?.name !== "source-gated-ewma") {
  addIssue("error", "data/quant-model.json", "quant model methodology is not source-gated", String(quantModel.methodology?.name || "missing"));
}
const forecastCategoryEntries = Object.entries(quant.forecastInputs?.categories || {});
if (forecastCategoryEntries.length < 5) {
  addIssue("error", "data/quant.json", "forecast input contract has fewer than five categories", String(forecastCategoryEntries.length));
}
for (const [categoryId, category] of forecastCategoryEntries) {
  for (const field of ["units", "memPerUnit", "skhyShare", "dramYoY", "nandYoY"]) {
    if (!Number.isFinite(Number(category?.[field]?.value))) {
      addIssue("error", "data/quant.json", "forecast input is not numeric", `${categoryId}:${field}`);
    }
    if (!String(category?.[field]?.source || "").trim() || !String(category?.[field]?.asOf || "").trim()) {
      addIssue("error", "data/quant.json", "forecast input lacks source or as-of provenance", `${categoryId}:${field}`);
    }
    const input = category?.[field] || {};
    if (["live-observed", "last-verified"].includes(input.status)
      && (!exactSourceDate(input.asOf) || !isDirectSourceUrl(input.sourceUrl))) {
      addIssue("error", "data/quant.json", "verified forecast input lacks an exact date or direct URL", `${categoryId}:${field}`);
    }
    if (input.status === "watch" && input.sourceUrl && !isDirectSourceUrl(input.sourceUrl)) {
      addIssue("error", "data/quant.json", "watch forecast input has a non-direct source URL", `${categoryId}:${field}`);
    }
  }
}
const forecastChecks = quant.forecastInputs?.sourceChecks || {};
const expectedForecastChecks = forecastCategoryEntries
  .filter(([, category]) => isDirectSourceUrl(category?.units?.sourceUrl))
  .map(([categoryId]) => categoryId);
if (Number(forecastChecks.total) !== expectedForecastChecks.length) {
  addIssue("error", "data/quant.json", "forecast source-check count does not match direct sources", `${forecastChecks.total || 0}/${expectedForecastChecks.length}`);
}
for (const categoryId of expectedForecastChecks) {
  const check = forecastChecks.items?.[categoryId];
  if (!check || !isDirectSourceUrl(check.sourceUrl) || !exactSourceDate(String(check.checkedAt || "").slice(0, 10))) {
    addIssue("error", "data/quant.json", "forecast source check lacks URL or timestamp", categoryId);
    continue;
  }
  if (!check.ok) {
    addIssue("warn", "data/quant.json", "forecast source was not revalidated in the latest crawl", `${categoryId}: ${check.message || check.status || "unknown"}`);
  }
  if (check.status === "source-value-verified" && !check.valueVerified) {
    addIssue("error", "data/quant.json", "forecast source check status contradicts value verification", categoryId);
  }
}
if (quant.forecastInputs?.version !== quantModel.forecastInputs?.version) {
  addIssue("error", "data/quant.json", "forecast input contract does not match quant-model.json", `${quant.forecastInputs?.version || "missing"}/${quantModel.forecastInputs?.version || "missing"}`);
}
if (quant.scenarioCalibration?.method !== quantModel.scenarioModel?.method) {
  addIssue("error", "data/quant.json", "scenario calibration method does not match quant-model.json", String(quant.scenarioCalibration?.method || "missing"));
}
if (quant.projectionCalibration?.method !== quantModel.projectionModel?.method) {
  addIssue("error", "data/quant.json", "projection calibration method does not match quant-model.json", String(quant.projectionCalibration?.method || "missing"));
}
if (quant.projectionCalibration?.modelVersion !== quantModel.schemaVersion) {
  addIssue("error", "data/quant.json", "projection model version does not match quant-model.json", `${quant.projectionCalibration?.modelVersion || "missing"}/${quantModel.schemaVersion || "missing"}`);
}
const projectionModel = quant.projectionCalibration?.model || {};
const expectedSegments = Object.keys(quantModel.projectionModel?.segments || {}).sort();
const actualSegments = Object.keys(projectionModel.segments || {}).sort();
if (expectedSegments.join("|") !== actualSegments.join("|")) {
  addIssue("error", "data/quant.json", "projection segment model does not match quant-model.json", actualSegments.join(", "));
}
const horizon = projectionModel.horizon || {};
if (!Number.isInteger(Number(horizon.startMonths)) || Number(horizon.startMonths) < 0
  || !Number.isInteger(Number(horizon.yearCount)) || Number(horizon.yearCount) < 2) {
  addIssue("error", "data/quant.json", "projection horizon is invalid", JSON.stringify(horizon));
}
for (const [segment, parameters] of Object.entries(projectionModel.segments || {})) {
  for (const key of ["startShare", "endShare", "baseScore", "sensitivity"]) {
    if (!Number.isFinite(Number(parameters?.[key]))) {
      addIssue("error", "data/quant.json", "projection segment parameter is invalid", `${segment}:${key}`);
    }
  }
}
const driverCards = projectionModel.driverCards || {};
for (const key of ["scenarioReference", "scenarioBiasWeight", "chinaSignalWeight", "chinaScoreMin", "nandReference", "nandPriceWeight", "nandSignalWeight"]) {
  if (!Number.isFinite(Number(driverCards[key]))) {
    addIssue("error", "data/quant.json", "projection driver-card parameter is invalid", key);
  }
}
for (const [group, weights] of Object.entries({ serverWeights: driverCards.serverWeights, terminalWeights: driverCards.terminalWeights })) {
  const values = Object.values(weights || {}).map(Number);
  if (!values.length || !values.every(Number.isFinite) || Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) > 0.001) {
    addIssue("error", "data/quant.json", "projection driver weights must be finite and sum to one", group);
  }
}
const projectionScenarioBlock = appText.match(/const PROJECTION_SCENARIOS = \[[\s\S]*?\n  \];\n  const SKHYNIX_PRODUCT_PROJECTION/)?.[0] || "";
if (/(?:scoreBias|serverLift|storageLift|terminalLift)\s*:/.test(projectionScenarioBlock)) {
  addIssue("error", "assets/js/app.js", "projection scenario coefficients must come from quant.json");
}
const projectionPresentationBlock = appText.match(/const SKHYNIX_PRODUCT_PROJECTION = \[[\s\S]*?\n  \];\n  const EXEC_DECISION_PRODUCTS/)?.[0] || "";
if (/(?:startShare|endShare|baseScore|sensitivity)\s*:/.test(projectionPresentationBlock)) {
  addIssue("error", "assets/js/app.js", "projection numeric parameters must come from quant.json");
}
if (/PROJECTION_START_MONTHS|PROJECTION_YEAR_COUNT/.test(appText)) {
  addIssue("error", "assets/js/app.js", "projection horizon must come from quant.json");
}
for (const figure of quant.liveFigures?.items || []) {
  const mode = String(figure.extractionMode || "");
  if (String(quant.liveFigures?.method || "").includes("current-run")
    && (figure.origin !== "live-crawl" || figure.observedThisRun !== true || !isDirectSourceUrl(figure.url))) {
    addIssue("error", "data/quant.json", "live figure was not observed in the current crawl", String(figure.value || "unknown"));
  }
  const storyFields = [figure.storyId, figure.storyTitle, figure.storySummary].filter((value) => String(value || "").trim());
  if (storyFields.length > 0 && storyFields.length < 3) {
    addIssue("error", "data/quant.json", "live figure has incomplete story metadata", String(figure.value || "unknown"));
  }
  if (!figure.canonical || !Number.isFinite(Number(figure.canonical.number)) || !String(figure.canonical.family || "").trim()) {
    addIssue("error", "data/quant.json", "live figure lacks a canonical value and unit family", String(figure.value || "unknown"));
  }
  if (mode === "web-verbatim" && (!exactSourceDate(figure.date) || !isDirectSourceUrl(figure.url))) {
    addIssue("error", "data/quant.json", "web live figure lacks an exact date or direct URL", String(figure.value || "unknown"));
  }
  if (mode === "report-extract" && (!exactSourceDate(figure.date) || !String(figure.sourceLocator || "").trim())) {
    addIssue("error", "data/quant.json", "report figure lacks an exact date or report locator", String(figure.value || "unknown"));
  }
  if (!["web-verbatim", "report-extract"].includes(mode)) {
    addIssue("error", "data/quant.json", "live figure has an unsupported extraction mode", mode || "missing");
  }
}
for (const item of quant.marketStructure?.kpis || []) {
  if (/\d/.test(String(item.value ?? "")) && item.dataStatus !== "watch") {
    if (!String(item.asOf || "").trim() || !isDirectSourceUrl(item.sourceUrl)) {
      addIssue("error", "data/quant.json", "market KPI lacks dated direct-source provenance", item.label || item.id || "unknown");
    }
  }
  const liveEvidence = item.liveCorroboration;
  if (liveEvidence && (!exactSourceDate(liveEvidence.date)
    || !isDirectSourceUrl(liveEvidence.url)
    || !liveEvidence.canonical
    || !Number.isFinite(Number(liveEvidence.canonical.number)))) {
    addIssue("error", "data/quant.json", "KPI live corroboration violates the value/date/source contract", item.label || item.id || "unknown");
  }
}
for (const company of quant.marketStructure?.companies || []) {
  for (const field of ["hbmShare", "dramShare2025", "dramShare2026", "nandShare2026"]) {
    const value = Number(String(company?.[field] ?? "").replace(/[^\d.-]/g, ""));
    if (!Number.isFinite(value) || value <= 0) continue;
    const provenance = company.fieldProvenance?.[field];
    if (!provenance
      || !String(provenance.asOf || "").trim()
      || !isDirectSourceUrl(provenance.sourceUrl)
      || !["live-verified", "last-verified"].includes(provenance.dataStatus)) {
      addIssue("error", "data/quant.json", "company share lacks field-specific provenance", `${company.company || "unknown"}:${field}`);
    }
  }
}
const calibratedScenarios = quant.scenarioCalibration?.scenarios || {};
for (const key of ["unitsMul", "memMul", "shareMul", "demandMul"]) {
  const values = ["bear", "base", "bull"].map((id) => Number(calibratedScenarios[id]?.[key]));
  if (!values.every(Number.isFinite) || !(values[0] < values[1] && values[1] < values[2])) {
    addIssue("error", "data/quant.json", `calibrated ${key} scenarios are not ordered Bear < Base < Bull`, values.join("/"));
  }
}
const caseWeights = quant.projectionCalibration?.caseWeights || {};
if (!Object.keys(caseWeights).length) {
  addIssue("error", "data/quant.json", "projection case weights are missing");
}
for (const [segment, weights] of Object.entries(caseWeights)) {
  for (const key of ["neutral", "best", "worst", "signal", "price", "china"]) {
    const value = Number(weights?.[key]);
    if (!Number.isFinite(value) || Math.abs(value) > 25) {
      addIssue("error", "data/quant.json", "projection calibration is invalid", `${segment}:${key}=${weights?.[key]}`);
    }
  }
}
for (const [scenario, calibration] of Object.entries(quant.projectionCalibration?.scenarios || {})) {
  for (const key of ["scoreBias", "serverLift", "storageLift", "terminalLift"]) {
    if (!Number.isFinite(Number(calibration?.[key]))) {
      addIssue("error", "data/quant.json", "projection scenario calibration is invalid", `${scenario}:${key}`);
    }
  }
}
if (!Number.isFinite(Number(quant.sourceHealth?.total)) || Number(quant.sourceHealth.total) < 1) {
  addIssue("error", "data/quant.json", "source health heartbeat is missing");
}
if (!Number.isFinite(Number(quant.historyCoverage?.pricePoints)) || Number(quant.historyCoverage.pricePoints) < 1) {
  addIssue("error", "data/quant.json", "price history coverage is missing");
}
if (!String(live.runId || "").trim()) {
  addIssue("error", "data/live.json", "live runId is missing");
}
if (quality.methodologyVersion !== "4.0-source-provenance") {
  addIssue("error", "data/live.json", "live methodologyVersion is not current", String(quality.methodologyVersion || "missing"));
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
  const verification = item.verification || {};
  if (verification.status !== "promoted" || !verification.id || !verification.canonicalUrl) {
    addIssue("error", "data/live.json", "news item lacks promoted provenance", item.title || sourceUrl || "unknown");
  }
  const verificationChecks = Object.values(verification.checks || {});
  if (verificationChecks.length < 8 || verificationChecks.some((passed) => !passed)) {
    addIssue("error", "data/live.json", "news item has incomplete provenance checks", verification.id || item.title || "unknown");
  }
  if (!["official", "research", "authoritative-media", "general-media"].includes(String(verification.sourceClass || ""))) {
    addIssue("error", "data/live.json", "news item has invalid source class", `${verification.id || "unknown"}:${verification.sourceClass || "missing"}`);
  }
}
if (news.length && (!languageCounts.english || !languageCounts.chinese)) {
  addIssue("error", "data/live.json", "one article language stream is empty", JSON.stringify(languageCounts));
}
if (news.length && summarizedNews.length !== news.length) {
  addIssue("error", "data/live.json", "not every promoted news item has an article-specific summary", `${summarizedNews.length}/${news.length}`);
}
if (news.length && directNews.length !== news.length) {
  addIssue("error", "data/live.json", "not every promoted news item resolves to a direct source URL", `${directNews.length}/${news.length}`);
}

const evidenceItems = Array.isArray(live.evidence?.items) ? live.evidence.items : [];
if (live.evidence?.methodologyVersion !== "4.0-source-provenance") {
  addIssue("error", "data/live.json", "evidence ledger methodology is not current", String(live.evidence?.methodologyVersion || "missing"));
}
if (Number(live.evidence?.promotedCount) !== news.length || evidenceItems.length !== news.length) {
  addIssue("error", "data/live.json", "evidence ledger count does not match promoted news", `${live.evidence?.promotedCount}/${evidenceItems.length}/${news.length}`);
}
const evidenceIds = new Set(evidenceItems.map((item) => item.id).filter(Boolean));
const promotedNewsById = new Map(news.map((item) => [item.verification?.id, item]));
for (const item of news) {
  if (!evidenceIds.has(item.verification?.id)) {
    addIssue("error", "data/live.json", "promoted news is missing from evidence ledger", item.verification?.id || item.title || "unknown");
  }
}

const brokerResearch = live.brokerResearch || null;
const brokerItems = Array.isArray(brokerResearch?.items) ? brokerResearch.items : [];
if (brokerResearch) {
  const brokerLiveSchema = brokerResearch.schemaVersion === "2.0";
  if (!brokerLiveSchema && brokerItems.length < 6) {
    addIssue("error", "data/live.json", "fewer than six broker research evidence cards", String(brokerItems.length));
  }
  const brokerKeys = new Set();
  for (const item of brokerItems) {
    const evidenceType = String(item.evidenceType || "");
    const hasEvidence = brokerLiveSchema
      ? /^https?:\/\//i.test(String(item.sourceUrl || "")) && !/news\.google\.com/i.test(String(item.sourceUrl || ""))
      : evidenceType === "direct-report"
      ? Boolean(String(item.sourceRef || "").trim())
      : /^https?:\/\//i.test(String(item.sourceUrl || "")) && !/news\.google\.com/i.test(String(item.sourceUrl || ""));
    if (!new Set(["direct-report", "news-citation"]).has(evidenceType)) {
      addIssue("error", "data/live.json", "broker research item has an invalid evidence type", `${item.id || item.title}:${evidenceType || "missing"}`);
    }
    if (!hasEvidence) addIssue("error", "data/live.json", "broker research item lacks linked evidence", item.id || item.title || "unknown");
    if (brokerLiveSchema && (item.origin !== "live-crawl" || item.observedThisRun !== true || !exactSourceDate(item.publishedAt))) {
      addIssue("error", "data/live.json", "broker live item was not observed in the current crawl with an exact date", item.id || item.title || "unknown");
    }
    if (!String(item.institution || "").trim()) addIssue("error", "data/live.json", "broker research item has no institution", item.id || item.title || "unknown");
    if (String(item.summary || "").trim().length < 35) addIssue("error", "data/live.json", "broker research summary is not substantive", item.id || item.title || "unknown");
    if (!String(item.insight || "").trim() || !String(item.reversalKpi || "").trim()) {
      addIssue("error", "data/live.json", "broker research item lacks SKHY implication or reversal KPI", item.id || item.title || "unknown");
    }
    const key = String(item.sourceUrl || `${item.institution}:${item.title}`).toLowerCase().replace(/[?#].*$/, "");
    if (brokerKeys.has(key)) addIssue("error", "data/live.json", "duplicate broker research evidence", key);
    brokerKeys.add(key);
  }
  if (Number(brokerResearch.reportCount || 0) !== brokerItems.filter((item) => item.evidenceType === "direct-report").length) {
    addIssue("error", "data/live.json", "broker direct-report count mismatch", String(brokerResearch.reportCount));
  }
  if (Number(brokerResearch.citationCount || 0) !== brokerItems.filter((item) => item.evidenceType === "news-citation").length) {
    addIssue("error", "data/live.json", "broker news-citation count mismatch", String(brokerResearch.citationCount));
  }
  const framework = brokerResearch.framework || null;
  if (!framework || !String(framework.sourceRef || "").trim()) {
    addIssue("error", "data/live.json", "broker research framework lacks its report source", "missing sourceRef");
  } else {
    const requiredArrays = { demand: 3, bottlenecks: 3, options: 3, decisions: 4, scenarios: 3 };
    for (const [key, minimum] of Object.entries(requiredArrays)) {
      const values = Array.isArray(framework[key]) ? framework[key] : [];
      if (values.length < minimum) addIssue("error", "data/live.json", `broker framework ${key} is incomplete`, `${values.length}/${minimum}`);
    }
    const scenarioById = new Map((framework.scenarios || []).map((item) => [item.id, item]));
    for (const key of ["excludingHbm", "includingHbm"]) {
      const bear = Number(scenarioById.get("bear")?.[key]);
      const base = Number(scenarioById.get("base")?.[key]);
      const bull = Number(scenarioById.get("bull")?.[key]);
      if (![bear, base, bull].every(Number.isFinite) || !(bear < base && base < bull)) {
        addIssue("error", "data/live.json", `broker framework ${key} scenarios are not ordered Bear < Base < Bull`, `${bear}/${base}/${bull}`);
      }
    }
  }
  if (brokerLiveSchema && (brokerResearch.baseline?.status !== "revalidation-required" || brokerResearch.framework?.dataStatus !== "baseline")) {
    addIssue("error", "data/live.json", "URL-less broker material must be separated as a revalidation baseline");
  }
}

const preservedNews = news.filter((item) => item?.preservedSeed);
const preservedByLanguage = {
  english: preservedNews.filter((item) => item.streamLanguage === "english"),
  chinese: preservedNews.filter((item) => item.streamLanguage === "chinese"),
};
if (preservedByLanguage.english.length < 8) {
  addIssue("error", "data/live.json", "fewer than eight preserved English authority articles", String(preservedByLanguage.english.length));
}
if (preservedByLanguage.chinese.length < 7) {
  addIssue("error", "data/live.json", "fewer than seven preserved Chinese-language articles", String(preservedByLanguage.chinese.length));
}
const requiredPreservedNewsIds = [
  "the-register-china-memory-ban",
  "reuters-cxmt-tencent",
  "tomshardware-cxmt-capacity",
  "trendforce-hybrid-bonding",
  "sina-ymtc-ipo",
  "technews-cxmt-pricing",
  "sina-ddr4-contract",
];
for (const id of requiredPreservedNewsIds) {
  if (!preservedNews.some((item) => item.id === id)) {
    addIssue("error", "data/live.json", "required preserved news article is missing", id);
  }
}
for (const item of preservedNews) {
  if (!String(item.summary || "").trim() || !String(item.summaryOriginal || "").trim()) {
    addIssue("error", "data/live.json", "preserved news article lacks source-specific summaries", item.id || item.title || "unknown");
  }
  if (item.streamLanguage === "chinese" && item.evidenceLevel !== "Watch") {
    addIssue("error", "data/live.json", "Chinese-language preserved article was promoted beyond Watch", item.id || item.title || "unknown");
  }
  if (item.streamLanguage === "english") {
    const sourceClass = String(item.verification?.sourceClass || "");
    const usesReportedEvidence = item.evidenceLevel === "Reported";
    const usesResearchModel = sourceClass === "research" && item.evidenceLevel === "Research model";
    if (!usesReportedEvidence && !usesResearchModel) {
      addIssue("error", "data/live.json", "English preserved article has an invalid evidence layer", item.id || item.title || "unknown");
    }
  }
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
  "search.iczhiku.com",
  "picture.iczhiku.com",
  "eet-china.com",
  "bbs.eeworld.com.cn",
  "eeworld.com.cn",
  "bbs.21ic.com",
  "mbb.eet-china.com",
  "mp.weixin.qq.com",
  "icjob.top",
  "xinjiangic.com",
  "51icjob.com",
  "bdtlietou.com",
  "hewa.cn",
  "semiwiki.com",
  "forums.servethehome.com",
  "forums.anandtech.com",
  "reddit.com",
  "borecraft.com",
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

const facts = live.facts || {};
const factEvents = Array.isArray(facts.events) ? facts.events : [];
if (facts.methodology !== "event-stage-resolution-v1") {
  addIssue("error", "data/live.json", "fact timeline methodology is missing or obsolete", String(facts.methodology || "missing"));
}
if (factEvents.length < 6) {
  addIssue("error", "data/live.json", "fewer than six resolved fact events", String(factEvents.length));
}
for (const event of factEvents) {
  const history = Array.isArray(event.history) ? event.history : [];
  const current = event.current || {};
  const highestRank = Math.max(...history.map((item) => Number(item.stageRank || 0)), 0);
  if (!event.id || !current.stageId || !history.length) {
    addIssue("error", "data/live.json", "fact event is incomplete", event.id || "missing");
  }
  if (Number(current.stageRank || 0) !== highestRank) {
    addIssue("error", "data/live.json", "fact event current stage is not the highest resolved stage", `${event.id}:${current.stageId}`);
  }
  if (!/^https?:\/\//i.test(String(current.sourceUrl || "")) || /news\.google\.com/i.test(String(current.sourceUrl || ""))) {
    addIssue("error", "data/live.json", "fact event current stage lacks a direct source URL", event.id || "unknown");
  }
  if (!String(current.provenanceId || "").trim() || !evidenceIds.has(current.provenanceId)) {
    addIssue("error", "data/live.json", "fact event current stage does not resolve to promoted evidence", event.id || "unknown");
  }
  if (!["official", "research", "authoritative-media"].includes(String(current.sourceClass || ""))) {
    addIssue("error", "data/live.json", "fact event uses a non-authoritative current source", `${event.id}:${current.sourceClass || "missing"}`);
  }
  if (communityHostPattern.test(String(current.sourceUrl || ""))) {
    addIssue("error", "data/live.json", "community signal was promoted into a resolved fact event", event.id || "unknown");
  }
}

const cxmtOfferingFact = factEvents.find((event) => event.id === "cxmt-ipo-offering");
if (cxmtOfferingFact?.current?.stageId !== "final-base-offering") {
  addIssue("error", "data/live.json", "CXMT offering did not resolve to the final base offering stage", cxmtOfferingFact?.current?.stageId || "missing");
}
const cxmtBaseOffering = Number(cxmtOfferingFact?.current?.metrics?.baseOfferingCnyB);
if (!Number.isFinite(cxmtBaseOffering) || cxmtBaseOffering <= 0) {
  addIssue("error", "data/live.json", "CXMT final base offering amount was not extracted from its source", String(cxmtOfferingFact?.current?.metrics?.baseOfferingCnyB || "missing"));
}
if (!/^https?:\/\//i.test(String(cxmtOfferingFact?.current?.sourceUrl || ""))) {
  addIssue("error", "data/live.json", "CXMT final base offering is missing its direct source", String(cxmtOfferingFact?.current?.sourceUrl || "missing"));
}
const cxmtOfferingStages = new Set((cxmtOfferingFact?.history || []).map((item) => item.stageId));
for (const requiredStage of ["registration-plan", "final-base-offering"]) {
  if (!cxmtOfferingStages.has(requiredStage)) {
    addIssue("error", "data/live.json", "CXMT offering timeline is missing a required stage", requiredStage);
  }
}

const sourceRegistry = live.sourceRegistry || {};
const sourceChannels = Array.isArray(sourceRegistry.channels) ? sourceRegistry.channels : [];
const sourceChannelIds = new Set(sourceChannels.map((channel) => channel.id));
if (sourceRegistry.version !== "2.0-crawl-channel-registry") {
  addIssue("error", "data/live.json", "source registry version is missing or obsolete", String(sourceRegistry.version || "missing"));
}
for (const requiredChannel of ["prices", "english-news", "chinese-news", "broker-research", "community-hiring", "market-history", "quantitative-metrics", "fact-timeline"]) {
  if (!sourceChannelIds.has(requiredChannel)) {
    addIssue("error", "data/live.json", "source registry is missing a required crawl channel", requiredChannel);
  }
}
for (const channel of sourceChannels) {
  if (Number(channel.records || 0) < 1 && !(channel.id === "broker-research" && brokerResearch?.schemaVersion === "2.0")) {
    addIssue("error", "data/live.json", "source registry channel has no crawl records", channel.id || "unknown");
  }
}
const communityChannel = sourceChannels.find((channel) => channel.id === "community-hiring");
if (communityChannel?.promotion !== "signal-only") {
  addIssue("error", "data/live.json", "community and hiring channel is not restricted to signal-only promotion", String(communityChannel?.promotion || "missing"));
}

const benchmarkThemes = live.benchmarkSignals?.themes || {};
const benchmarkItems = Object.values(benchmarkThemes).flatMap((theme) =>
  Array.isArray(theme?.items) ? theme.items : [],
);
const preservedBenchmarkItems = benchmarkItems.filter((item) => item?.preservedSeed);
if (preservedBenchmarkItems.length < 7) {
  addIssue("error", "data/live.json", "fewer than seven preserved foreign benchmark signals", String(preservedBenchmarkItems.length));
}
for (const item of preservedBenchmarkItems) {
  const sourceUrl = String(item.sourceUrl || item.link || "");
  if (!/^https?:\/\//i.test(sourceUrl)) {
    addIssue("error", "data/live.json", "preserved benchmark signal lacks a source URL", item.id || item.title || "unknown");
  }
  if (String(item.summary || "").trim().length < 28) {
    addIssue("error", "data/live.json", "preserved benchmark signal lacks a substantive summary", item.id || sourceUrl);
  }
  if (!String(item.validation || "").trim()) {
    addIssue("error", "data/live.json", "preserved benchmark signal lacks a validation condition", item.id || sourceUrl);
  }
  if (String(item.evidenceLevel || "") !== "Reported") {
    addIssue("error", "data/live.json", "preserved benchmark signal was promoted beyond Reported", item.id || sourceUrl);
  }
}

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
  if (!["Confirmed", "Reported", "Watch", "Inferred", "Stale"].includes(String(brief.latest?.evidenceLevel || ""))) {
    addIssue("error", "data/live.json", "intelligence brief has an invalid evidence level", `${brief.id || "unknown"}:${brief.latest?.evidenceLevel || "missing"}`);
  }
  if (!String(brief.decision || "").trim() || !String(brief.reversalKpi || "").trim()) {
    addIssue("error", "data/live.json", "intelligence brief lacks decision or reversal KPI", brief.id || "unknown");
  }
  if (!String(brief.latest?.provenanceId || "").trim() || !evidenceIds.has(brief.latest?.provenanceId)) {
    addIssue("error", "data/live.json", "intelligence brief does not resolve to promoted evidence", brief.id || "unknown");
  }
  if (!["official", "research", "authoritative-media"].includes(String(brief.latest?.sourceClass || ""))) {
    addIssue("error", "data/live.json", "intelligence brief uses a non-authoritative source class", `${brief.id || "unknown"}:${brief.latest?.sourceClass || "missing"}`);
  }
  const provenanceNews = promotedNewsById.get(brief.latest?.provenanceId);
  if (brief.latest?.evidenceLevel === "Confirmed" && !provenanceNews?.verification?.observedThisRun) {
    addIssue("error", "data/live.json", "Confirmed brief was not observed from source metadata in this run", brief.id || "unknown");
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
if (Number(validation.factEvents) !== factEvents.length) {
  addIssue("error", "data/live.json", "intelligence factEvents count mismatch", `${validation.factEvents} != ${factEvents.length}`);
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
  factEvents: factEvents.length,
  sourceChannels: sourceChannels.length,
  provenanceCoverage: 1,
  currentNews: news.filter((item) => item.verification?.freshness === "current").length,
  quarantinedNews: crawlQuarantine.total,
  marketIndexes: Object.values(live.marketHistory?.indexes || {}).filter((item) => Number(item?.latest?.close ?? item?.latest?.value) > 0).length,
  peerStocks: stocks.filter(([, stock]) => Number(stock.latestClose) > 0).length,
  ...(brokerResearch ? {
    brokerResearch: brokerItems.length,
    brokerNewsCitations: brokerItems.filter((item) => item.evidenceType === "news-citation").length,
  } : {}),
};
for (const [metric, expected] of Object.entries(expectedQualityMetrics)) {
  if (Number(qualityMetrics[metric]) !== Number(expected)) {
    addIssue("error", "data/live.json", "crawl quality metric does not match payload", `${metric}: ${qualityMetrics[metric]} != ${expected}`);
  }
}
if (Number(qualityMetrics.directSourceRatio) !== 1 || Number(qualityMetrics.summaryRatio) !== 1 || Number(qualityMetrics.provenanceCoverage) !== 1) {
  addIssue("error", "data/live.json", "crawl quality ratios are below deployment thresholds", JSON.stringify({
    directSourceRatio: qualityMetrics.directSourceRatio,
    summaryRatio: qualityMetrics.summaryRatio,
    provenanceCoverage: qualityMetrics.provenanceCoverage,
  }));
}

if (crawlAudit.runId !== live.runId || crawlQuarantine.runId !== live.runId) {
  addIssue("error", "data/crawl-audit.json", "generated artifacts do not share the verified live runId", `${crawlAudit.runId}/${crawlQuarantine.runId}/${live.runId}`);
}
if (crawlAudit.status !== "verified" || crawlAudit.methodologyVersion !== "4.0-source-provenance") {
  addIssue("error", "data/crawl-audit.json", "crawl audit is not a verified current-methodology run", `${crawlAudit.status}/${crawlAudit.methodologyVersion}`);
}
if (Number(crawlAudit.promoted?.news) !== news.length || Number(crawlAudit.quarantined?.news) !== Number(crawlQuarantine.total)) {
  addIssue("error", "data/crawl-audit.json", "crawl audit counts do not match generated data", JSON.stringify({
    promoted: crawlAudit.promoted?.news,
    news: news.length,
    quarantined: crawlAudit.quarantined?.news,
    quarantineFile: crawlQuarantine.total,
  }));
}
if (!Array.isArray(crawlQuarantine.items) || Number(crawlQuarantine.total) !== crawlQuarantine.items.length) {
  addIssue("error", "data/crawl-quarantine.json", "quarantine total does not match metadata items", `${crawlQuarantine.total}/${crawlQuarantine.items?.length}`);
}
const promotedCanonicalUrls = new Set(news.map((item) => item.verification?.canonicalUrl).filter(Boolean));
for (const item of crawlQuarantine.items || []) {
  if (!Array.isArray(item.reasons) || !item.reasons.length) {
    addIssue("error", "data/crawl-quarantine.json", "quarantined item has no rejection reason", item.id || item.title || "unknown");
  }
  if (item.canonicalUrl && promotedCanonicalUrls.has(item.canonicalUrl)) {
    addIssue("error", "data/crawl-quarantine.json", "same canonical URL appears in promoted and quarantined data", item.canonicalUrl);
  }
  for (const forbidden of ["summary", "summaryOriginal", "body", "content", "author", "username", "userId"]) {
    if (Object.prototype.hasOwnProperty.call(item, forbidden)) {
      addIssue("error", "data/crawl-quarantine.json", "quarantine retains prohibited content or identity field", `${item.id || "unknown"}:${forbidden}`);
    }
  }
}
if (priceHistory.runId !== live.runId || marketHistory.runId !== live.runId) {
  addIssue("error", "data/live.json", "history artifacts do not share the verified live runId", `${priceHistory.runId}/${marketHistory.runId}/${live.runId}`);
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
  brokerResearch: brokerItems.length,
  qualityStatus: quality.status,
  errors,
  warnings,
}, null, 2));

if (errors.length) process.exit(1);
