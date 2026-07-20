#!/usr/bin/env node
/** Replay network-free derived transforms against the latest verified bundle. */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildAgentBriefing,
  buildBaselineFreshness,
  buildDemandAccountSignals,
  buildIndustryPulse,
  buildRelationCandidates,
} from "./live-pipeline.mjs";
import { quantMemoryMomentum } from "./crawl.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (name) => JSON.parse(await readFile(resolve(root, "data", name), "utf8"));
const [live, quant, baseline, priceHistory] = await Promise.all([
  readJson("live.json"),
  readJson("quant.json"),
  readJson("baseline.json"),
  readJson("price-history.json"),
]);
const context = {
  news: live.news || [],
  communitySignals: live.communitySignals || {},
  benchmarkSignals: live.benchmarkSignals || {},
  brokerResearch: live.brokerResearch || {},
  baseline,
};
quant.runId = live.runId || quant.runId || null;
quant.memoryMomentum = quantMemoryMomentum(priceHistory);
quant.accountSignals = buildDemandAccountSignals(context, quant.accountSignals);
quant.relationCandidates = buildRelationCandidates(context);
quant.baselineFreshness = buildBaselineFreshness(baseline, context, quant.baselineFreshness);
quant.industryPulse = buildIndustryPulse(context, new Date(), quant.industrySourceChecks || {});
quant.agentBriefing = buildAgentBriefing(context, quant);
for (const key of ["accountSignals", "agentBriefing", "relationCandidates", "baselineFreshness", "industryPulse"]) {
  if (!quant[key] || typeof quant[key] !== "object") continue;
  quant[key].runId = quant.runId || null;
  quant[key].validatedAt = quant.validatedAt || null;
  quant[key].expiresAt = quant.expiresAt || null;
}
live.quant = quant;
await Promise.all([
  writeFile(resolve(root, "data", "quant.json"), `${JSON.stringify(quant, null, 2)}\n`, "utf8"),
  writeFile(resolve(root, "data", "live.json"), `${JSON.stringify(live, null, 2)}\n`, "utf8"),
]);
console.log(`derived refresh complete: ${quant.accountSignals.accountCount} accounts · ${quant.relationCandidates.candidateCount} relation candidates · ${quant.baselineFreshness.total} baseline audits`);
