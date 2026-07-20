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
import { mergeMarketPoints, quantMemoryMomentum } from "./crawl.mjs";
import { buildQuantBacktestSummary } from "./quant-history.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (name) => JSON.parse(await readFile(resolve(root, "data", name), "utf8"));
const [live, quant, baseline, priceHistory, marketHistory] = await Promise.all([
  readJson("live.json"),
  readJson("quant.json"),
  readJson("baseline.json"),
  readJson("price-history.json"),
  readJson("market-history.json"),
]);
const context = {
  news: live.news || [],
  communitySignals: live.communitySignals || {},
  benchmarkSignals: live.benchmarkSignals || {},
  brokerResearch: live.brokerResearch || {},
  baseline,
};
for (const index of Object.values(marketHistory.indexes || {})) {
  if (Array.isArray(index?.points)) index.points = mergeMarketPoints(index.points, []);
}
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
const quantBacktest = buildQuantBacktestSummary({
  priceHistory,
  marketHistory,
  generatedAt: marketHistory.updatedAt || priceHistory.updatedAt || live.updatedAt,
  runId: live.runId,
});
quantBacktest.validatedAt = live.updatedAt || quant.validatedAt || null;
quant.historyCoverage = {
  ...(quant.historyCoverage || {}),
  periods: quantBacktest.coverage,
  contractSchemaVersion: quantBacktest.schemaVersion,
  failClosed: true,
};
live.quantBacktest = {
  schemaVersion: quantBacktest.schemaVersion,
  generatedAt: quantBacktest.generatedAt,
  runId: quantBacktest.runId,
  coverage: quantBacktest.coverage,
};
await Promise.all([
  writeFile(resolve(root, "data", "quant.json"), `${JSON.stringify(quant, null, 2)}\n`, "utf8"),
  writeFile(resolve(root, "data", "live.json"), `${JSON.stringify(live, null, 2)}\n`, "utf8"),
  writeFile(resolve(root, "data", "market-history.json"), `${JSON.stringify(marketHistory, null, 2)}\n`, "utf8"),
  writeFile(resolve(root, "data", "quant-backtest.json"), `${JSON.stringify(quantBacktest, null, 2)}\n`, "utf8"),
]);
console.log(`derived refresh complete: ${quant.accountSignals.accountCount} accounts · ${quant.relationCandidates.candidateCount} relation candidates · ${quant.baselineFreshness.total} baseline audits`);
