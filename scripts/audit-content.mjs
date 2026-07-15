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
  ]) {
    const index = text.indexOf(phrase);
    if (index >= 0) addIssue("error", file, `repeated news boilerplate at line ${lineFor(text, index)}`, phrase);
  }

  const placeholderPattern = file.endsWith(".js")
    ? /\b(?:TODO|TBD)\b/g
    : /\b(?:TODO|TBD|undefined|NaN)\b/g;
  for (const match of text.matchAll(placeholderPattern)) {
    addIssue("warn", file, `placeholder token at line ${lineFor(text, match.index)}`, match[0]);
  }
}

const baseline = JSON.parse(await readFile(resolve(root, "data/baseline.json"), "utf8"));
const numericKpis = (baseline.kpis || []).filter((item) => /\d/.test(String(item.value || "")));
const missingKpiSources = numericKpis.filter((item) => !String(item.sourceUrl || "").trim());
for (const item of missingKpiSources) {
  addIssue("error", "data/baseline.json", "numeric KPI without sourceUrl", item.label || item.id || "");
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

const live = JSON.parse(await readFile(resolve(root, "data/live.json"), "utf8"));
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
for (const item of news) {
  const title = String(item.title || "").trim();
  const key = title.toLowerCase().replace(/\s[-–—]\s[^-–—|]+$/g, "").replace(/[^a-z0-9가-힣一-鿿]+/g, "");
  if (/^\s*\[(?:news|뉴스)\]/i.test(title)) addIssue("error", "data/live.json", "news title contains forbidden prefix", title);
  if (key && newsTitleKeys.has(key)) addIssue("error", "data/live.json", "duplicate news title", title);
  if (key) newsTitleKeys.add(key);
}
if (news.length && summarizedNews.length / news.length < 0.5) {
  addIssue("warn", "data/live.json", "fewer than half of news items have article-specific summaries", `${summarizedNews.length}/${news.length}`);
}
if (news.length && directNews.length / news.length < 0.5) {
  addIssue("warn", "data/live.json", "fewer than half of news items resolve to direct source URLs", `${directNews.length}/${news.length}`);
}

const errors = checks.filter((item) => item.level === "error");
const warnings = checks.filter((item) => item.level === "warn");
console.log(JSON.stringify({
  ok: errors.length === 0,
  files: textFiles.length,
  numericKpis: numericKpis.length,
  priceRows: priceRows.length,
  stockSeries: stocks.length,
  summarizedNews: `${summarizedNews.length}/${news.length}`,
  errors,
  warnings,
}, null, 2));

if (errors.length) process.exit(1);
