import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSiteContentClient, validateSiteContent } from "./site-content.mjs";

const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const text = (path) => readFileSync(path, "utf8");
const payload = json("data/live.json");
const quant = json("data/quant.json");
const artifact = json("data/site-content-client.json");
const manifest = json("data/data-manifest.json");
const workflow = text(".github/workflows/pages.yml");
const landing = text("assets/js/landing.js");
const app = text("assets/js/app.js");
const index = text("index.html");

const rebuilt = buildSiteContentClient({ payload, quant });
assert.deepEqual(validateSiteContent(rebuilt), { ok: true, errors: [] });
assert.ok(rebuilt.freshness.configuredSources >= 42);
assert.ok(rebuilt.freshness.officialConfigured >= 33);
assert.equal(rebuilt.freshness.scheduleHours, 3);
assert.equal(artifact.runId, payload.runId, "site content must use the verified live runId");
assert.equal(manifest.runId, artifact.runId, "manifest and site content must be atomic");
assert.equal(manifest.artifacts.siteContent.path, "data/site-content-client.json");
assert.equal(artifact.generation.failClosed, true);
assert.equal(artifact.presentation.emphasisPolicy.style, "underline-only");
assert.equal(artifact.presentation.emphasisPolicy.maxPerSection, 1);
assert.ok(artifact.presentation.emphasisPolicy.maxTotal <= 10);
assert.deepEqual(artifact.presentation.readabilityPolicy.hoverModes, ["light-to-dark", "dark-to-light"]);
assert.equal(artifact.presentation.refreshPolicy.runId, artifact.runId);
assert.equal(artifact.presentation.refreshPolicy.scheduleHours, artifact.freshness.scheduleHours);
assert.ok(artifact.decisionCases.length >= 4);
assert.ok(artifact.agentCouncil.agendas.length >= 6);
assert.equal(artifact.workloadOptimization.process.length, 6);
assert.equal(artifact.workloadOptimization.serviceLines.length, 3);
assert.ok(artifact.workloadOptimization.sources.length >= 5);
assert.equal(artifact.aiFactorySystem.architectureLayers.length, 9);
assert.equal(artifact.aiFactorySystem.workloads.length, 6);
assert.equal(artifact.aiFactorySystem.decisionSequence.length, 8);
assert.ok(artifact.aiFactorySystem.sources.length >= 8);
assert.equal(artifact.aiFactorySystem.pillarCoverage.length, 7);
assert.equal(artifact.aiFactorySystem.automation.failClosed, true);
assert.equal(artifact.caseClassification.length, 3);
assert.ok(artifact.decisionControl.integrity.status);
assert.ok(artifact.decisionControl.freshness.status);
assert.ok(artifact.decisionControl.coverage.status);
assert.ok(artifact.decisionControl.confidence.status);
assert.ok(artifact.workloadOptimization.sources.every((item) => item.url && item.status));
assert.ok(artifact.insights.every((item) => item.latest.title && item.decision && item.action));
assert.ok(artifact.decisionCases.every((item) => item.signals.length === 3 && item.sources.length >= 3));
assert.ok(artifact.competitors.every((item) => item.asOf && item.sourceUrl));
assert.ok(!JSON.stringify(artifact).includes("$500B+"), "generated content must not retain a fixed partnership value");

const changedPayload = structuredClone(payload);
changedPayload.runId = "automation-contract-test";
changedPayload.updatedAt = "2031-01-02T03:04:05.000Z";
changedPayload.expiresAt = "2031-01-03T03:04:05.000Z";
const hbm = changedPayload.intelligence.briefs.find((item) => item.id === "hbm");
hbm.latest.title = "AUTOMATED CURRENT HBM SIGNAL";
hbm.latest.summary = "AUTOMATED CURRENT HBM SUMMARY";
hbm.decision = "AUTOMATED CURRENT HBM DECISION";
hbm.reversalKpi = "AUTOMATED CURRENT HBM REVERSAL";
const changed = buildSiteContentClient({ payload: changedPayload, quant: { ...quant, runId: changedPayload.runId } });
const changedHbm = changed.decisionCases.find((item) => item.panelId === "hbm");
assert.equal(changed.runId, changedPayload.runId);
assert.equal(changed.generatedAt, changedPayload.updatedAt);
assert.equal(changedHbm.latest.title, hbm.latest.title);
assert.equal(changedHbm.decision, hbm.decision);
assert.equal(changedHbm.stop, hbm.reversalKpi);
assert.ok(changed.hero.thesis.includes(hbm.decision));
assert.equal(changed.presentation.refreshPolicy.runId, changedPayload.runId);
assert.equal(changed.presentation.refreshPolicy.generatedAt, changedPayload.updatedAt);

assert.match(workflow, /cron: "17 \*\/3 \* \* \*"/);
assert.match(workflow, /data\/site-content-client\.json/);
assert.match(landing, /SITE_CONTENT_PATH = "data\/site-content-client\.json"/);
assert.match(landing, /content\.runId !== manifest\.runId/);
assert.match(landing, /15 \* 60 \* 1000/);
assert.match(landing, /function renderWorkloadOptimization\(content = \{\}\)/);
assert.match(landing, /function renderAIFactorySystem\(content = \{\}\)/);
assert.match(index, /id="workload-optimization"/);
assert.match(index, /id="ai-factory-system"/);
assert.match(index, /Useful AI Work/);
assert.match(index, /Samsung SMRC/);
assert.match(app, /window\.MEMORY_SITE_CONTENT\?\.agentCouncil\?\.agendas/);
assert.match(index, /infra-20260816-18/);
assert.match(index, /Bottleneck to Scale/);
assert.match(index, /PUBLIC CASE RECONSTRUCTION[\s\S]*?MODELED STRATEGY CASE[\s\S]*?ANONYMIZED CLIENT CASE/);
assert.doesNotMatch(index, /ANONYMIZED USE CASE|GPU Compute보다|MODELED THRESHOLD/);
assert.doesNotMatch(app, /익명화 Case/);

console.log(JSON.stringify({
  ok: true,
  runId: artifact.runId,
  decisions: artifact.decisionCases.length,
  insights: artifact.insights.length,
  agendas: artifact.agentCouncil.agendas.length,
  competitors: artifact.competitors.length,
  refresh: "3-hour publish + 15-minute in-page revalidation",
}, null, 2));
