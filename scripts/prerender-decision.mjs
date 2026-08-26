#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const contentPath = resolve(root, "data", "site-content-client.json");
const extendedContentPath = resolve(root, "data", "site-content-extended-client.json");
const executivePath = resolve(root, "data", "executive-latest.json");
const consolePath = resolve(root, "console", "index.html");
const manifestPath = resolve(root, "data", "data-manifest.json");

const initialContent = JSON.parse(await readFile(contentPath, "utf8"));
const extendedContent = JSON.parse(await readFile(extendedContentPath, "utf8"));
const content = {
  ...initialContent,
  ...extendedContent,
  agentCouncil: { ...(initialContent.agentCouncil || {}), ...(extendedContent.agentCouncil || {}) },
};
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

if (!content.clientArtifact || !content.runId || !content.generatedAt || initialContent.runId !== extendedContent.runId) {
  throw new Error("verified site-content-client.json is required for pre-render");
}
if (manifest.runId !== content.runId) throw new Error("manifest and site content runId must match before pre-render");

const automation = content.decisionIntelligence?.decisionAutomation || {};
const claimLedger = content.decisionIntelligence?.claimEvents || {};
const freshness = content.decisionIntelligence?.freshness || {};
const catalog = automation.catalogCoverage || {};
const briefs = automation.briefs || [];
const currentClaims = (claimLedger.events || []).filter((item) => item.isCurrentStage).filter((_, index) => index < 8);
const organization = content.organizationOperatingModel || {};

const executive = {
  schemaVersion: "1.1",
  type: "executive-decision-snapshot",
  runId: content.runId,
  generatedAt: content.generatedAt,
  expiresAt: content.expiresAt,
  state: automation.state || "MONITORING",
  freshness: {
    score: Number(freshness.score || 0),
    status: freshness.status || "pending",
    label: freshness.label || "검증 대기",
  },
  sourceCoverage: catalog,
  funnel: automation.funnel || {},
  decisions: briefs.map((brief) => ({
    id: brief.id,
    label: brief.label,
    meceAxis: brief.meceAxis,
    decisionQuestion: brief.decisionQuestion,
    decisionStage: brief.decisionStage,
    deliverable: brief.deliverable,
    status: brief.status,
    whatChanged: brief.whatChanged,
    latestSignal: brief.latestSignal,
    sourceStage: brief.sourceStage,
    stage: brief.stage,
    confidence: brief.confidence,
    customerPain: brief.customerPain,
    factBoundary: brief.factBoundary,
    hypothesisStatus: brief.hypothesisStatus,
    officialFactCount: Number(brief.officialFactCount || 0),
    marketEstimateCount: Number(brief.marketEstimateCount || 0),
    hypothesis: brief.hypothesis,
    options: brief.options,
    economics: brief.economics,
    action90d: brief.action90d,
    owner: brief.owner,
    kpis: brief.kpis,
    trigger: brief.trigger,
    killCriteria: brief.killCriteria,
    evidence: (brief.evidence || []).filter((_, index) => index < 5),
  })),
  organizationOperatingModel: organization,
  claimEvents: currentClaims,
  policy: "Deterministic source/date/stage gates; no uncited generated claim is published.",
};

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Intelligence Console로 이동</title>
  <meta name="robots" content="noindex,follow" />
  <meta http-equiv="refresh" content="0; url=../#console/account-intelligence" />
  <link rel="canonical" href="https://dicacros-gif.github.io/memory/" />
</head>
<body>
  <main>
    <h1>Intelligence Console로 이동합니다</h1>
    <p>자동으로 이동하지 않으면 <a href="../#console/account-intelligence">Intelligence Console 열기</a>를 선택하세요.</p>
  </main>
  <script>window.location.replace(new URL("../#console/account-intelligence", window.location.href).href);</script>
</body>
</html>
`;

await mkdir(dirname(executivePath), { recursive: true });
await mkdir(dirname(consolePath), { recursive: true });
const executiveBody = `${JSON.stringify(executive, null, 2)}\n`;
const artifacts = { ...(manifest.artifacts || {}) };
delete artifacts.consoleSnapshot;
manifest.artifacts = {
  ...artifacts,
  executiveSnapshot: { path: "data/executive-latest.json", bytes: Buffer.byteLength(executiveBody, "utf8") },
};
await Promise.all([
  writeFile(executivePath, executiveBody, "utf8"),
  writeFile(consolePath, html, "utf8"),
  writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
]);

console.log(JSON.stringify({
  ok: true,
  runId: content.runId,
  decisions: briefs.length,
  claimEvents: currentClaims.length,
  executiveBytes: Buffer.byteLength(executiveBody, "utf8"),
  consoleAliasBytes: Buffer.byteLength(html, "utf8"),
}, null, 2));
