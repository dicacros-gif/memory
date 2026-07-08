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

const errors = checks.filter((item) => item.level === "error");
const warnings = checks.filter((item) => item.level === "warn");
console.log(JSON.stringify({
  ok: errors.length === 0,
  files: textFiles.length,
  numericKpis: numericKpis.length,
  errors,
  warnings,
}, null, 2));

if (errors.length) process.exit(1);
