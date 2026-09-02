#!/usr/bin/env node
// Maintenance replay: no new articles, market values or crawl timestamps.
// Revalidate all stored translations, retry a bounded set of current articles,
// and rebuild the two projections that previously preferred original copy.
import { readFile, writeFile, rename } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createGoogleKoTranslator, koreanTranslationAudit, revalidateTranslationPayload } from "./translation-pipeline.mjs";
import { requiresNewsLocalization, hasBrokenLocalizationText } from "../assets/js/news-localization.js";
import { buildAgentBriefing, buildStrategyAccountIntelligence } from "./live-pipeline.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (name) => JSON.parse(await readFile(resolve(root, "data", name), "utf8"));
const [live, quant, baseline, cache] = await Promise.all(["live.json", "quant.json", "baseline.json", "translation-cache.json"].map(readJson));
const report = { runId: live.runId, before: revalidateTranslationPayload(live), retried: 0, repaired: 0 };
const limit = Math.max(0, Math.min(90, Number(process.argv.find((arg) => arg.startsWith("--translate-limit="))?.split("=")[1] || 0)));
const translator = createGoogleKoTranslator({ cache });
const tasks = [];
for (const item of live.news || []) {
  if (!requiresNewsLocalization(item)) continue;
  for (const [field, original, current] of [["titleKo", item.title, item.titleKo], ["summary", item.summaryOriginal, item.summaryKo || item.summary]]) {
    if (!original || hasBrokenLocalizationText(original) || koreanTranslationAudit(original, current).status === "verified") continue;
    tasks.push({ item, field, original });
  }
}
const selected = tasks.slice(0, limit);
if (selected.length) {
  const localized = await translator.translateTexts(selected.map((task) => task.original), { deadline: Date.now() + 90_000 });
  for (const task of selected) {
    report.retried += 1;
    if (!localized.has(task.original)) continue;
    task.item[task.field] = localized.get(task.original);
    if (task.field === "summary" && "summaryKo" in task.item) task.item.summaryKo = localized.get(task.original);
    report.repaired += 1;
  }
  // Copy only exact-source, revalidated translations to duplicate archived rows.
  const replacements = new Map(selected.filter((task) => localized.has(task.original)).map((task) => [task.original, localized.get(task.original)]));
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (replacements.has(value.title)) value.titleKo = replacements.get(value.title);
    if (replacements.has(value.summaryOriginal)) {
      value.summary = replacements.get(value.summaryOriginal);
      if ("summaryKo" in value) value.summaryKo = value.summary;
    }
    for (const child of Object.values(value)) visit(child);
  };
  visit(live);
}
report.after = revalidateTranslationPayload(live);
const context = { news: live.news || [], communitySignals: live.communitySignals || {}, benchmarkSignals: live.benchmarkSignals || {}, brokerResearch: live.brokerResearch || {}, baseline };
for (const [key, build] of [
  ["strategyAccountIntelligence", () => buildStrategyAccountIntelligence({ ...context, decisionIntelligence: quant.decisionIntelligence }, quant.strategyAccountIntelligence, quant.strategyAccountIntelligence?.updatedAt || quant.updatedAt || live.updatedAt)],
  ["agentBriefing", () => buildAgentBriefing(context, quant, quant.agentBriefing?.updatedAt || quant.updatedAt || live.updatedAt)],
]) {
  const previous = quant[key] || {};
  quant[key] = build();
  for (const field of ["runId", "updatedAt", "validatedAt", "expiresAt"]) {
    if (Object.hasOwn(previous, field)) quant[key][field] = previous[field];
  }
}
live.quant = quant;
report.translator = translator.stats;
report.write = process.argv.includes("--write");
if (report.write) {
  for (const [name, value] of [["live.json", live], ["quant.json", quant], ...(selected.length ? [["translation-cache.json", translator.snapshot()]] : [])]) {
    const target = resolve(root, "data", name);
    const temporary = `${target}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temporary, target);
  }
}
console.log(JSON.stringify(report, null, 2));
