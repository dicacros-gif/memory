import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const app = readFileSync(resolve(root, "assets", "js", "app.js"), "utf8");
const strategyExperience = readFileSync(resolve(root, "assets", "js", "strategy-experience.js"), "utf8");

function comparable(value = "") {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/^\s*\d{1,2}\s*[.·:\-]?\s*/, "")
    .replace(/[\s·•:：/|>→—–_.\-]+/g, "")
    .trim();
}

function sourceBlock(startMarker, endMarker) {
  const start = app.indexOf(startMarker);
  const end = app.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `${startMarker} source block must exist`);
  return app.slice(start, end);
}

const datePolicy = Function(
  `"use strict"; ${sourceBlock("function compactFullDateLabel", "function dedupeRepeatedDisplayCopy")}; return { compactYearMonthLabel, normalizeConsoleDateCopy };`,
)();
assert.equal(datePolicy.compactYearMonthLabel(2025, 8), "'25.8월");
assert.equal(datePolicy.normalizeConsoleDateCopy("2025년 8월"), "'25.8월");
assert.equal(datePolicy.normalizeConsoleDateCopy("2025-08"), "'25.8월");
assert.equal(datePolicy.normalizeConsoleDateCopy("2025. 8."), "'25.8월");
assert.equal(datePolicy.normalizeConsoleDateCopy("2025년 8월 7일"), "8/7");
assert.equal(datePolicy.normalizeConsoleDateCopy("2025년 8월부터"), "'25.8월부터");
assert.equal(datePolicy.normalizeConsoleDateCopy("2025-08-25"), "8/25");
assert.equal(datePolicy.normalizeConsoleDateCopy("2025-08-25T23:59:59Z"), "8/25");
assert.equal(datePolicy.normalizeConsoleDateCopy("2025. 8. 7."), "8/7");
assert.equal(datePolicy.normalizeConsoleDateCopy("2025년"), "2025년");
assert.equal(datePolicy.normalizeConsoleDateCopy("2025-02-30"), "2025-02-30");
assert.equal(datePolicy.normalizeConsoleDateCopy("2025년 2월 30일"), "2025년 2월 30일");
assert.equal(datePolicy.normalizeConsoleDateCopy("처리량 2025.8GB"), "처리량 2025.8GB");
assert.equal(datePolicy.normalizeConsoleDateCopy("비중 2025.2%"), "비중 2025.2%");
assert.match(app, /label: compactYearMonthLabel\(item\.year, item\.month\)/, "backtest options must use the compact year-month policy before rendering");
assert.match(app, /return dedupeRepeatedDisplayCopy\(bullet\)/, "every non-verbatim Console text node must remove repeated display copy");
assert.match(
  app,
  /\["title", "aria-label", "placeholder"\][\s\S]*?dedupeRepeatedDisplayCopy\(normalizeConsoleDateCopy\(current\)\)/,
  "tooltips and accessible labels must share the date and duplicate-copy display policy",
);

const forecastChipPolicy = Function(
  `"use strict"; ${sourceBlock("function forecastChipDisplayLabel", "function isUsableAccountSignal")}; return forecastChipDisplayLabel;`,
)();
assert.equal(
  forecastChipPolicy({ company: "Apple", chip: "Apple Silicon · Private Cloud Compute" }),
  "Silicon · Private Cloud Compute",
  "account and chip labels must not repeat the company name",
);
assert.equal(
  forecastChipPolicy({ company: "Google", chip: "TPU7x · Ironwood" }),
  "TPU7x · Ironwood",
  "distinct chip labels must remain unchanged",
);
assert.ok(
  (app.match(/forecastChipDisplayLabel\((?:selectedAccount|account)\)/g) || []).length >= 4,
  "forecast account tabs, cards and focus views must share the company-prefix dedupe policy",
);

const products = sourceBlock("const EXEC_DECISION_PRODUCTS = [", "const AI_INFRA_DECISION_CONTEXTS = Object.freeze({");
const productRows = [...products.matchAll(/\{\s*id:\s*"([^"]+)"[\s\S]*?label:\s*"([^"]+)"[\s\S]*?demand:\s*"([^"]+)"/g)]
  .map(([, id, label, demand]) => ({ id, label, demand }));
assert.ok(productRows.length >= 6, "executive decision product rows must remain auditable");
assert.deepEqual(
  productRows.filter((item) => comparable(item.label) === comparable(item.demand)),
  [],
  "decision cards must not repeat the same visible copy as both hierarchy and product labels",
);

const categories = sourceBlock("const CATEGORY_DISPLAY = {", "const CATEGORY_ORDER = [");
const categoryRows = [...categories.matchAll(/^\s*([\w-]+):\s*\{\s*label:\s*"([^"]+)",\s*en:\s*"([^"]*)"/gm)]
  .map(([, id, label, secondary]) => ({ id, label, secondary }));
assert.ok(categoryRows.length >= 10, "sidebar category rows must remain auditable");

// A category that carries a secondary label must not spend it saying the same
// thing again. Most carry none at all now, which satisfies this trivially and
// is the point: the row says one thing once.
const repeatedCategories = categoryRows
  .filter((item) => item.secondary)
  .filter((item) => comparable(item.label) === comparable(item.secondary));
assert.deepEqual(repeatedCategories, [], "a category must not print its label twice");
assert.match(app, /function isRepeatedDisplayCopy\([\s\S]*?first === second/, "display-copy comparison guard must remain available");
assert.ok(
  (app.match(/secondaryLabel = isRepeatedDisplayCopy\((?:category|cat)\.label, (?:category|cat)\.en\)/g) || []).length >= 1,
  "every surface that prints a bilingual pair must suppress the equivalent half",
);
assert.ok(
  (app.match(/demandLabel = isRepeatedDisplayCopy\(item\.label, item\.demand\)/g) || []).length >= 2,
  "decision cards and domain selector must suppress duplicate hierarchy labels",
);
assert.match(app, /focusDemandLabel = isRepeatedDisplayCopy\(active\.label, active\.demand\)/, "decision focus must suppress a repeated chip/title pair");
assert.match(app, /visibleTickerName = isRepeatedDisplayCopy\(tickerSymbol, tickerName\)/, "equity cards must not repeat an equivalent symbol and company name");
assert.match(app, /function distinctDisplayCopies\([\s\S]*?seen\.has\(comparable\)/, "multi-field cards must suppress normalized duplicate copy");
assert.ok(
  (app.match(/distinctDisplayCopies\(/g) || []).length >= 4,
  "agent roster, debate and domain workstreams must share the duplicate-copy guard",
);

const strategyMappings = [...strategyExperience.matchAll(/kicker:\s*"([^"]+)"[\s\S]*?label:\s*"([^"]+)"/g)]
  .map(([, kicker, label]) => ({ kicker, label }));
assert.deepEqual(
  strategyMappings.filter((item) => comparable(item.kicker) === comparable(item.label)),
  [],
  "strategy cards must not repeat the same word as kicker and label",
);

const publicArtifacts = [
  "live-client.json",
  "quant-client.json",
  "site-content-client.json",
  "company-directory-client.json",
];
const displayFields = new Set([
  "title",
  "titleKo",
  "summary",
  "summaryKo",
  "headline",
  "subtitle",
  "description",
  "body",
  "message",
  "label",
  "demand",
  "role",
  "stance",
]);
const adjacentDuplicateToken = /(^|[\s'"“‘(\[])([A-Za-z가-힣][A-Za-z가-힣0-9_-]{1,})(?:\s+\2)+(?=$|[\s'"”’),.?!。！？\]])/iu;
const duplicateArtifactCopy = [];

function inspectDisplayFields(value, path = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectDisplayFields(item, [...path, index]));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    const nextPath = [...path, key];
    if (displayFields.has(key) && typeof item === "string" && adjacentDuplicateToken.test(item)) {
      duplicateArtifactCopy.push(`${nextPath.join(".")}: ${item.match(adjacentDuplicateToken)?.[0]?.trim() || item}`);
    } else {
      inspectDisplayFields(item, nextPath);
    }
  }
}

for (const artifact of publicArtifacts) {
  inspectDisplayFields(JSON.parse(readFileSync(resolve(root, "data", artifact), "utf8")), [artifact]);
}
assert.deepEqual(duplicateArtifactCopy, [], "public client artifacts must not contain adjacent duplicate words in display fields");

console.log(`visible copy dedup test passed (${productRows.length} decisions, ${categoryRows.length} categories, ${publicArtifacts.length} artifacts)`);
