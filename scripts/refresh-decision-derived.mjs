#!/usr/bin/env node

/**
 * Rebuilds deterministic Decision Intelligence derivatives from the last
 * verified knowledge index without network access.
 */
import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDecisionIntelligence, loadIntelligencePolicy } from "./decision-intelligence.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const quantPath = resolve(root, "data", "quant.json");
const livePath = resolve(root, "data", "live.json");
const [quant, live] = await Promise.all([
  readFile(quantPath, "utf8").then(JSON.parse),
  readFile(livePath, "utf8").then(JSON.parse),
]);
if (!quant.runId || quant.runId !== live.runId) throw new Error("quant/live verified runId mismatch");
const previous = quant.decisionIntelligence || {};
const documents = (previous.knowledgeIndex?.documents || []).map((document) => ({
  feedId: document.feedId || null,
  sourceId: document.sourceId,
  source: document.source,
  sourceClass: document.sourceClass,
  title: document.title,
  url: document.url,
  publishedAt: document.publishedAt,
  observedAt: document.observedAt,
  lastHumanVerifiedAt: document.lastHumanVerifiedAt || null,
  freshnessDays: document.freshnessDays,
  text: (document.chunks || []).map((chunk) => chunk.text).join("\n"),
})).filter((document) => document.text && document.url);
if (!documents.length) throw new Error("verified knowledge index is empty");

const next = buildDecisionIntelligence({
  documents,
  previous,
  policy: loadIntelligencePolicy(),
  runId: quant.runId,
  now: new Date(live.updatedAt || quant.updatedAt || Date.now()),
  feedStatus: previous.feedStatus || [],
  refreshTrigger: "derived-policy-refresh",
});
if (next.evaluation?.status !== "pass") throw new Error("derived Decision Intelligence failed closed evaluation");
quant.decisionIntelligence = { ...next, publishStatus: "verified-current" };
live.quant = quant;

async function replaceJson(path, value) {
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}
await Promise.all([replaceJson(quantPath, quant), replaceJson(livePath, live)]);

console.log(JSON.stringify({
  ok: true,
  runId: quant.runId,
  documents: documents.length,
  claimEvents: next.claimEvents.stats,
  decisionState: next.decisionAutomation.state,
  decisionReady: next.decisionAutomation.funnel.decisionReadyBriefs,
}, null, 2));
