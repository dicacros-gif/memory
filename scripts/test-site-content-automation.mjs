import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSiteContentClient, validateSiteContent } from "./site-content.mjs";

const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const text = (path) => readFileSync(path, "utf8");
const payload = json("data/live.json");
const quant = json("data/quant.json");
const artifactCore = json("data/site-content-client.json");
const artifactExtended = json("data/site-content-extended-client.json");
const artifact = {
  ...artifactCore,
  ...artifactExtended,
  agentCouncil: { ...(artifactCore.agentCouncil || {}), ...(artifactExtended.agentCouncil || {}) },
};
const manifest = json("data/data-manifest.json");
const executiveSnapshot = json("data/executive-latest.json");
const index = text("index.html");
const runtime = text("assets/js/strategy-experience.js");
const consoleAlias = text("console/index.html");
const workflow = text(".github/workflows/pages.yml");
const crawler = text("scripts/crawl.mjs");
const alertReporter = text("scripts/report-source-health.mjs");

const rebuilt = buildSiteContentClient({ payload, quant });
assert.deepEqual(validateSiteContent(rebuilt), { ok: true, errors: [] });
assert.equal(rebuilt.generation.failClosed, true);
assert.equal(rebuilt.schemaVersion, "1.1");
assert.equal(artifact.runId, payload.runId, "site content must use the verified live runId");
assert.equal(artifactExtended.runId, artifactCore.runId, "core and extended artifacts must be atomic");
assert.equal(manifest.runId, artifact.runId, "manifest and site content must be atomic");
assert.match(manifest.cacheVersion, new RegExp(`^${manifest.runId}-[a-f0-9]{16}$`));
assert.equal(manifest.artifacts.siteContent.path, "data/site-content-client.json");
assert.equal(manifest.artifacts.siteContentExtended.path, "data/site-content-extended-client.json");

const sectionIds = [...index.matchAll(/<section\b[^>]*\bid=["']([^"']+)["']/gi)].map((match) => match[1]);
const uniqueSectionIds = [...new Set(sectionIds)];
const requiredPanels = [
  "panel-account-intelligence",
  "panel-workload-architecture",
  "panel-tech-next-memory",
  "panel-competitive-ecosystem",
  "panel-economics-deal",
  "panel-execution-cases",
];
assert.equal(artifact.siteAutomation.status, "all-sections-bound");
assert.equal(artifact.siteAutomation.totalSections, uniqueSectionIds.length);
assert.equal(artifact.siteAutomation.boundSections, uniqueSectionIds.length);
assert.deepEqual([...artifact.siteAutomation.sectionIds].sort(), [...uniqueSectionIds].sort());
assert.ok(requiredPanels.every((id) => artifact.siteAutomation.sectionIds.includes(id)));
assert.equal(new Set(Object.values(artifact.siteAutomation.bindingGroups).flat()).size, uniqueSectionIds.length);
assert.equal(artifact.siteAutomation.refresh.atomicManifest, true);
assert.equal(artifact.siteAutomation.refresh.failClosed, true);

assert.equal(artifact.organizationOperatingModel.workstreams.length, 3);
assert.deepEqual(artifact.organizationOperatingModel.workstreams.map((item) => item.id), [
  "account-intelligence",
  "tech-portfolio-strategy",
  "executive-deal-execution",
]);
assert.equal(artifact.organizationOperatingModel.automation.taxonomy, "three-pillar-mece");
assert.equal(artifact.organizationOperatingModel.automation.duplicateCount, 0);
assert.ok(artifact.organizationOperatingModel.workstreams.every((item) => item.currentSignal?.title && /^https?:\/\//.test(item.currentSignal?.url || "")));

assert.ok(artifact.decisionCases.length >= 4);
assert.equal(artifact.decisionIntelligence.decisionAutomation.briefs.length, 4);
assert.equal(new Set(artifact.decisionIntelligence.decisionAutomation.briefs.map((brief) => brief.decisionQuestion)).size, 4);
assert.ok(artifact.decisionIntelligence.decisionAutomation.briefs.every((brief) => brief.trigger && brief.killCriteria && brief.action90d));
assert.ok(artifact.decisionIntelligence.decisionAutomation.briefs.every((brief) => brief.factBoundary && brief.hypothesisStatus === "strategy-hypothesis"));
assert.equal(artifact.decisionIntelligence.evaluation.failClosed, true);
assert.equal(artifact.decisionIntelligence.evaluation.metrics.unsupportedClaimPct, 0);

assert.equal(artifact.workloadOptimization.process.length, 6);
assert.equal(artifact.workloadOptimization.serviceLines.length, 6);
assert.equal(artifact.workloadOptimization.ragOperatingModel.pipeline.length, 13);
assert.ok(artifact.insights.every((item) => item.latest.title && item.decision && item.action));
assert.ok(artifact.decisionCases.every((item) => item.hypothesis?.label === "근거 미검증"));
assert.ok(artifact.competitors.every((item) => !item.hbmShare || (item.asOf && item.sourceUrl)));

const portfolio = artifact.strategyBoard.customerPortfolio;
assert.ok(portfolio.accounts.length >= 16);
assert.equal(portfolio.focusAccounts.length, 9);
assert.equal(portfolio.partnerEcosystem.partners.length, 2);
assert.equal(portfolio.executiveOnePagers.length, 8);
assert.ok(portfolio.accounts.some((item) => item.id === "oracle"));
assert.ok(portfolio.accounts.some((item) => item.id === "marvell" && item.layer === "asic-partner"));
const dynamics = portfolio.competitiveDynamics;
assert.ok(dynamics.relations.some((item) => item.type === "partnership" && item.from === "marvell" && item.to === "google"));
assert.ok(dynamics.relations.some((item) => item.type === "investment" && item.from === "nvidia" && item.to === "marvell"));
assert.ok(dynamics.relations.some((item) => item.type === "supply" && item.from === "skhynix"));
assert.ok(dynamics.companies.every((item) => item.company && item.layer && item.portfolio && Number.isInteger(item.relationCount)));

assert.equal(executiveSnapshot.runId, artifact.runId);
assert.equal(executiveSnapshot.decisions.length, artifact.decisionIntelligence.decisionAutomation.briefs.length);
assert.ok(executiveSnapshot.decisions.every((brief) => brief.factBoundary && brief.hypothesisStatus === "strategy-hypothesis"));
assert.equal(new Set(executiveSnapshot.decisions.map((brief) => brief.decisionQuestion)).size, executiveSnapshot.decisions.length);
assert.match(consoleAlias, /http-equiv="refresh" content="0; url=\.\.\/#console\/account-intelligence"/);
assert.match(consoleAlias, /location\.replace\(new URL\("\.\.\/#console\/account-intelligence"/);
assert.doesNotMatch(consoleAlias, /Executive Snapshot|workstream-card|decision-card/);

assert.match(runtime, /fetchVerifiedArtifact\("site-content-client\.json", "siteContent", \{ requireClientArtifact: true \}\)/);
assert.match(runtime, /renderWorkloadCases/);
assert.match(runtime, /renderRelationships/);
assert.match(runtime, /dynamics\?\.relations/);
assert.doesNotMatch(runtime, /runId[^\n]*(?:innerHTML|textContent)|(?:innerHTML|textContent)[^\n]*runId/);

assert.match(workflow, /cron: "17 \* \* \* \*"/);
assert.match(workflow, /repository_dispatch:[\s\S]*earnings-release[\s\S]*industry-report[\s\S]*source-update/);
assert.match(workflow, /npm run prerender:decision/);
assert.match(workflow, /npm run check:fast/);
assert.match(workflow, /data\/site-content-client\.json/);
assert.match(workflow, /data\/site-content-extended-client\.json/);
assert.match(workflow, /data\/executive-latest\.json/);
assert.match(workflow, /console\/index\.html/);
assert.match(crawler, /new Date\(publishedAt\)\.getUTCFullYear\(\) < 2026[\s\S]*?reasons\.push\("pre-2026-date"\)/);
assert.match(alertReporter, /DECISION_SIGNAL_MARKER[\s\S]*?activeDecisionSignals[\s\S]*?supplier-change[\s\S]*?deal-event/);

console.log(JSON.stringify({
  ok: true,
  runId: artifact.runId,
  sections: uniqueSectionIds.length,
  consolePanels: requiredPanels.length,
  decisionCases: artifact.decisionCases.length,
  relationships: dynamics.relations.length,
}, null, 2));
