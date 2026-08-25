import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSiteContentClient, validateSiteContent } from "./site-content.mjs";

const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const text = (path) => readFileSync(path, "utf8");
const payload = json("data/live.json");
const quant = json("data/quant.json");
const baseline = json("data/baseline.json");
const artifactCore = json("data/site-content-client.json");
const artifactExtended = json("data/site-content-extended-client.json");
const artifact = {
  ...artifactCore,
  ...artifactExtended,
  agentCouncil: { ...(artifactCore.agentCouncil || {}), ...(artifactExtended.agentCouncil || {}) },
};
const manifest = json("data/data-manifest.json");
const workflow = text(".github/workflows/pages.yml");
const packageConfig = text("package.json");
const landing = text("assets/js/landing.js");
const app = text("assets/js/app.js");
const accountViews = text("assets/js/account-one-pagers.js");
const styles = text("assets/css/styles.css");
const index = text("index.html");
const consoleSnapshot = text("console/index.html");
const executiveSnapshot = json("data/executive-latest.json");
const quarantine = json("data/crawl-quarantine.json");
const crawler = text("scripts/crawl.mjs");
const alertReporter = text("scripts/report-source-health.mjs");

const rebuilt = buildSiteContentClient({ payload, quant });
assert.deepEqual(validateSiteContent(rebuilt), { ok: true, errors: [] });
const rebuiltCopy = [];
const collectCopy = (value) => {
  if (typeof value === "string") rebuiltCopy.push(value);
  else if (Array.isArray(value)) value.forEach(collectCopy);
  else if (value && typeof value === "object") Object.values(value).forEach(collectCopy);
};
collectCopy(rebuilt);
assert.doesNotMatch(rebuiltCopy.join("\n"), /[가-힣]+다(?:[.!?。]|\s*$)/m, "automated site content must use executive bullet endings");
assert.ok(rebuilt.freshness.configuredSources >= 42);
assert.ok(rebuilt.freshness.officialConfigured >= 33);
assert.equal(rebuilt.freshness.scheduleHours, 1);
assert.equal(rebuilt.freshness.browserRecheckMinutes, 5);
assert.deepEqual(rebuilt.hero.titleLines, ["AI Infra Strategy", "Hyperscaler Roadmap to Memory Business"]);
assert.equal(rebuilt.hero.capabilities.length, 3, "the homepage strategy scope must cover three MECE pillars");
assert.equal(artifact.runId, payload.runId, "site content must use the verified live runId");
assert.equal(manifest.runId, artifact.runId, "manifest and site content must be atomic");
assert.ok((quarantine.items || []).every((item) => item.reason && item.reason !== "?" && item.reasonLabel && item.reasonLabel !== "?"), "every quarantine record must expose an auditable primary reason");
assert.ok((quarantine.items || []).every((item) => item.reasons.length === item.reasonLabels.length), "quarantine reason codes and labels must map one-to-one");
assert.match(crawler, /new Date\(publishedAt\)\.getUTCFullYear\(\) < 2026[\s\S]*?reasons\.push\("pre-2026-date"\)/, "pre-2026 content must be quarantined in the pipeline rather than hidden in the UI");
assert.match(alertReporter, /DECISION_SIGNAL_MARKER[\s\S]*?activeDecisionSignals[\s\S]*?supplier-change[\s\S]*?deal-event/, "supplier and contract changes must feed the automated alert channel");
assert.match(manifest.cacheVersion, new RegExp(`^${manifest.runId}-[a-f0-9]{16}$`), "content hash must invalidate browser caches independently of runId");
assert.equal(manifest.artifacts.siteContent.path, "data/site-content-client.json");
assert.equal(manifest.artifacts.siteContentExtended.path, "data/site-content-extended-client.json");
assert.equal(artifactExtended.runId, artifactCore.runId, "extended site content must share the atomic runId");
assert.equal(artifactCore.strategyBoard.customerPortfolio.broadcomEcosystem.accounts.length, 3, "Broadcom roll-up must hydrate with the first console snapshot");
assert.equal(artifactCore.strategyBoard.customerPortfolio.partnerEcosystem.partners.length, 2, "Broadcom and Marvell must hydrate as top-level ASIC partners");
assert.deepEqual(
  artifactCore.strategyBoard.customerPortfolio.partnerEcosystem.partners.find((item) => item.id === "marvell")?.accounts.map((item) => item.id),
  ["microsoft", "aws"],
  "Marvell must roll up Microsoft and AWS below the partner level",
);
assert.equal(artifactCore.strategyBoard.customerPortfolio.executiveOnePagers.length, 8, "account one-pagers must hydrate without waiting for the extended payload");
assert.equal(artifactCore.strategyBoard.customerPortfolio.layerModel.layers.length, 3, "the three-level account chain must be available at first paint");
assert.equal(artifact.generation.failClosed, true);
assert.equal(artifact.schemaVersion, "1.1");
const sectionIds = [...index.matchAll(/<section\b[^>]*\bid=["']([^"']+)["']/gi)].map((match) => match[1]);
const uniqueSectionIds = [...new Set(sectionIds)];
assert.equal(artifact.siteAutomation.status, "all-sections-bound");
assert.equal(artifact.siteAutomation.totalSections, uniqueSectionIds.length);
assert.equal(artifact.siteAutomation.boundSections, uniqueSectionIds.length);
assert.equal(artifact.siteAutomation.refresh.safetyPollHours, 1);
assert.equal(artifact.siteAutomation.refresh.browserRecheckMinutes, 5);
assert.equal(artifact.siteAutomation.refresh.atomicManifest, true);
assert.equal(artifact.siteAutomation.refresh.failClosed, true);
assert.deepEqual(artifact.siteAutomation.sectionIds.slice().sort(), uniqueSectionIds.sort());
assert.equal(new Set(Object.values(artifact.siteAutomation.bindingGroups).flat()).size, uniqueSectionIds.length);
assert.equal(artifact.organizationOperatingModel.workstreams.length, 3);
assert.equal(artifact.organizationOperatingModel.decisionLoop.length, 5);
assert.equal(Object.hasOwn(artifact.organizationOperatingModel, "capabilityProofs"), false);
assert.equal(Object.hasOwn(artifact.organizationOperatingModel, "cadence"), false);
assert.ok(artifact.organizationOperatingModel.workstreams.every((item) => item.inputs.length >= 4 && item.outputs.length >= 4 && item.gate && item.kpis.length >= 3));
assert.deepEqual(artifact.organizationOperatingModel.workstreams.map((item) => item.id), ["account-intelligence", "tech-portfolio-strategy", "executive-deal-execution"]);
assert.equal(artifact.organizationOperatingModel.liveEvidenceCount, 3);
assert.equal(artifact.organizationOperatingModel.automation.taxonomy, "three-pillar-mece");
assert.equal(artifact.organizationOperatingModel.automation.duplicateCount, 0);
for (const field of ["inputs", "questions", "outputs", "kpis"]) {
  const values = artifact.organizationOperatingModel.workstreams.flatMap((item) => item[field]);
  assert.equal(new Set(values.map((value) => value.toLocaleLowerCase("ko-KR").replace(/[^\p{L}\p{N}]+/gu, ""))).size, values.length, `${field} must stay MECE across pillars`);
}
assert.ok(artifact.organizationOperatingModel.workstreams.every((item) => item.currentSignal?.title && /^https?:\/\//.test(item.currentSignal?.url || "")), "each strategy workstream must connect to a current Console source");
assert.equal(new Set(artifact.organizationOperatingModel.workstreams.map((item) => item.currentSignal?.url)).size, 3, "MECE pillars must not repeat the same current source");
const duplicateSignalPayload = structuredClone(payload);
for (const brief of duplicateSignalPayload.intelligence?.briefs || []) {
  if (["hbm", "dram", "nand", "demand"].includes(brief.id)) {
    brief.latest = {
      ...(brief.latest || {}),
      title: "동일 최신 기사",
      url: "https://example.com/shared-latest-signal",
    };
  }
}
const duplicateSignalContent = buildSiteContentClient({ payload: duplicateSignalPayload, quant });
assert.equal(new Set(duplicateSignalContent.organizationOperatingModel.workstreams.map((item) => item.currentSignal?.url)).size, 3, "official baselines must prevent source collisions after a refresh");
assert.ok(duplicateSignalContent.organizationOperatingModel.workstreams.some((item) => item.currentSignal?.evidenceLevel === "Official baseline"), "source collision fallback must remain explicit");
assert.equal(rebuilt.hero.workProducts.length, 3);
assert.equal(rebuilt.hero.workflow.length, 4);
assert.equal(rebuilt.hero.departmentWorkbench.source, "accounts.projects");
assert.equal(rebuilt.hero.departmentWorkbench.agenda.length, 3);
assert.equal(rebuilt.hero.departmentWorkbench.metrics.length, 0);
assert.ok(rebuilt.hero.departmentWorkbench.agenda.every((item) => item.customerPain && item.recommendation && item.action90d && item.owner && item.accounts.length));
assert.equal(new Set(rebuilt.hero.departmentWorkbench.agenda.map((item) => item.meceAxis)).size, 3, "homepage customer projects must be MECE");
assert.equal(new Set(rebuilt.hero.departmentWorkbench.agenda.map((item) => item.decisionQuestion)).size, 3, "homepage customer project questions must not repeat");
assert.ok(rebuilt.hero.departmentWorkbench.agenda.every((item) => item.deliverable), "each homepage decision must name its output");
assert.equal(artifact.presentation.emphasisPolicy.style, "underline-only");
assert.equal(artifact.presentation.emphasisPolicy.maxPerSection, 1);
assert.ok(artifact.presentation.emphasisPolicy.maxTotal <= 10);
assert.deepEqual(artifact.presentation.readabilityPolicy.hoverModes, ["light-to-dark", "dark-to-light"]);
assert.equal(rebuilt.presentation.readabilityPolicy.copyStyle, "executive-bullets");
assert.equal(rebuilt.presentation.readabilityPolicy.sentenceStops, "omit");
assert.ok(rebuilt.presentation.readabilityPolicy.paragraphMaxCharacters <= 92);
assert.ok(rebuilt.presentation.readabilityPolicy.listMaxCharacters <= 78);
assert.ok(rebuilt.presentation.readabilityPolicy.detailMaxCharacters <= 72);
assert.match(packageConfig, /check:fast[\s\S]*?test-default-contrast-highlight\.mjs[\s\S]*?test-korean-bullet-copy\.mjs/, "every scheduled refresh must reject contrast and copy regressions");
assert.equal(artifact.presentation.refreshPolicy.runId, artifact.runId);
assert.equal(artifact.presentation.refreshPolicy.scheduleHours, artifact.freshness.scheduleHours);
assert.equal(artifact.decisionIntelligence.retrieval.mode, "incremental-extractive");
assert.equal(artifact.decisionIntelligence.evaluation.failClosed, true);
assert.equal(artifact.decisionIntelligence.evaluation.metrics.unsupportedClaimPct, 0);
assert.ok(Number.isInteger(artifact.decisionIntelligence.claimEvents.stats.structuredEvents));
assert.equal(artifact.decisionIntelligence.decisionAutomation.briefs.length, 4);
assert.equal(artifact.decisionIntelligence.decisionAutomation.meceAxes.length, 4);
assert.equal(new Set(artifact.decisionIntelligence.decisionAutomation.briefs.map((brief) => brief.decisionQuestion)).size, 4);
assert.equal(artifact.decisionIntelligence.decisionAutomation.catalogCoverage.configured, artifact.freshness.configuredSources);
assert.ok(artifact.decisionIntelligence.decisionAutomation.briefs.every((brief) => brief.trigger && brief.killCriteria && brief.action90d));
assert.ok(artifact.decisionIntelligence.decisionAutomation.briefs.every((brief) => brief.factBoundary && brief.hypothesisStatus === "strategy-hypothesis"));
assert.ok(artifact.decisionIntelligence.decisionAutomation.briefs.every((brief) => Number.isInteger(brief.officialFactCount) && Number.isInteger(brief.marketEstimateCount)));
assert.equal(rebuilt.decisionIntelligence.freshness.thresholds.current, 85);
assert.equal(rebuilt.decisionIntelligence.freshness.thresholds.warning, 70);
assert.deepEqual(Object.keys(rebuilt.decisionIntelligence.freshness.components).sort(), ["contentAge", "coverageDrift", "embeddingLag", "staleRetrievalRate"].sort());
assert.ok(artifact.decisionCases.length >= 4);
assert.ok(artifact.agentCouncil.agendas.length >= 6);
assert.equal(artifact.workloadOptimization.process.length, 6);
assert.equal(artifact.workloadOptimization.serviceLines.length, 6);
assert.equal(artifact.workloadOptimization.ragOperatingModel.pipeline.length, 13);
assert.equal(artifact.workloadOptimization.ragOperatingModel.maturity.length, 6);
assert.ok(Number.isFinite(artifact.workloadOptimization.ragOperatingModel.liveControl.freshnessScore));
assert.ok(artifact.workloadOptimization.sources.length >= 5);
assert.ok(rebuilt.strategyBoard.tech.memoryMap.length >= 4);
assert.deepEqual(rebuilt.strategyBoard.tech.pillars.map((item) => item.id), ["custom-hbm", "ai-d", "ai-n"]);
const hbfTrack = rebuilt.strategyBoard.tech.memoryMap.find((item) => item.id === "hbf-open-standard");
assert.ok(hbfTrack, "HBF must be present as an explicit architecture track");
assert.match(`${hbfTrack.tech} ${hbfTrack.context} ${hbfTrack.impact}`, /Open Standard.*Lighthouse PoC/i);
assert.doesNotMatch(JSON.stringify(hbfTrack), /Emerging|Watch/i, "HBF must advance from watch to standardized Lighthouse PoC");
const maasTrack = rebuilt.strategyBoard.tech.memoryMap.find((item) => item.id === "memory-as-a-service");
assert.equal(maasTrack?.commercialStatus, "strategy-hypothesis", "MaaS subscription economics must remain a strategy hypothesis");
assert.ok(maasTrack?.evidence?.status, "MaaS must retain an automated evidence status");
assert.ok(rebuilt.strategyBoard.tech.memoryMap.every((item) => item.evidence?.status), "every memory track must expose evidence status");
assert.deepEqual(
  rebuilt.strategyBoard.tech.trackingFramework.layers.map((item) => item.id),
  ["compute", "interconnect", "package", "memory-tier"],
  "technology radar must preserve the MECE compute-to-memory decision chain",
);
for (const trackId of [
  "hbf-open-standard",
  "hbs-research",
  "three-d-packaging",
  "chiplet-ucie",
  "glass-substrate",
  "silicon-photonics-cpo",
  "ai-network-fabric",
  "quantum-computing",
  "neuromorphic-computing",
  "photonic-computing",
]) {
  const track = rebuilt.strategyBoard.tech.memoryMap.find((item) => item.id === trackId);
  assert.ok(track, `${trackId} must be present in the memory technology radar`);
  assert.ok(track.layer && track.horizon && track.impact && track.memory && track.decision && track.gate, `${trackId} must expose memory impact and a decision gate`);
}
assert.equal(
  rebuilt.strategyBoard.tech.memoryMap.find((item) => item.id === "hbs-research")?.evidence?.status,
  "research-monitoring",
  "HBS must remain clearly labeled as a research track",
);
assert.ok(
  ["research-monitoring", "official-monitoring", "official-fact", "market-estimate"].includes(
    rebuilt.strategyBoard.tech.memoryMap.find((item) => item.id === "photonic-computing")?.evidence?.status,
  ),
  "photonic computing must retain an explicit evidence class",
);
assert.equal(rebuilt.strategyBoard.customerPortfolio.accounts.length, 13);
assert.deepEqual(rebuilt.strategyBoard.customerPortfolio.layerModel.summary.map((item) => item.id), ["asic-partner", "end-customer", "foundry-package"]);
assert.ok(rebuilt.strategyBoard.customerPortfolio.layerModel.partnerRollups.some((item) => item.partnerId === "broadcom" && item.accountIds.includes("openai")));
assert.ok(rebuilt.strategyBoard.customerPortfolio.accounts.some((item) => item.id === "marvell" && item.layer === "asic-partner"));
assert.equal(rebuilt.strategyBoard.customerPortfolio.partnerEcosystem.partners.length, 2);
assert.deepEqual(
  rebuilt.strategyBoard.customerPortfolio.partnerEcosystem.partners.find((item) => item.id === "marvell")?.accounts.map((item) => item.id),
  ["microsoft", "aws"],
);
assert.deepEqual(rebuilt.strategyBoard.customerPortfolio.groups.map((item) => item.id), ["gpu", "hyperscaler-asic", "design-ecosystem", "edge-physical"]);
assert.deepEqual(
  rebuilt.strategyBoard.customerPortfolio.missionModel.lanes.map((item) => item.id),
  ["account", "pain", "portfolio", "ecosystem", "deal"],
  "AI Infra mission value chain must remain MECE and data-driven",
);
assert.deepEqual(
  rebuilt.strategyBoard.customerPortfolio.missionModel.organizations.map((item) => item.label),
  ["GSM", "HBM Business", "MSR"],
  "AI Infra execution ownership must remain explicit",
);
assert.ok(rebuilt.strategyBoard.customerPortfolio.accounts.every((item) => item.evidence?.status));
assert.ok(rebuilt.strategyBoard.customerPortfolio.accounts.some((item) => item.company === "SpaceX"));
assert.ok(rebuilt.strategyBoard.customerPortfolio.accounts.some((item) => item.company === "Anthropic" && item.xpuEcosystem?.source?.url));
assert.ok(rebuilt.strategyBoard.customerPortfolio.accounts.some((item) => item.company === "OpenAI" && item.xpuEcosystem?.claim === "verified-fact"));
assert.ok(rebuilt.strategyBoard.customerPortfolio.competitiveFrame.some((item) => item.company === "CXMT"));
const competitiveDynamics = rebuilt.strategyBoard.customerPortfolio.competitiveDynamics;
assert.deepEqual(
  competitiveDynamics.layers.map((item) => item.id),
  ["end-customer", "asic-partner", "foundry-package", "memory-supply"],
  "competitive dynamics must preserve the end-customer-to-memory value chain",
);
assert.deepEqual(
  competitiveDynamics.types.map((item) => item.id),
  ["competition", "partnership", "investment", "supply"],
  "competitive dynamics must expose the four executive relationship lenses",
);
assert.ok(competitiveDynamics.relations.some((item) => item.type === "partnership" && item.from === "broadcom" && item.to === "google"));
assert.ok(competitiveDynamics.relations.some((item) => item.type === "partnership" && item.from === "marvell" && item.to === "aws"));
assert.ok(competitiveDynamics.relations.some((item) => item.type === "competition" && item.from === "skhynix" && item.to === "samsung"));
assert.ok(competitiveDynamics.relations.some((item) => item.type === "investment" && item.from === "skhynix" && item.to === "tsmc"));
assert.ok(competitiveDynamics.relations.some((item) => item.type === "supply" && item.from === "skhynix"));
assert.ok(competitiveDynamics.companies.every((item) => item.company && item.layer && item.portfolio && Number.isInteger(item.relationCount)));
assert.ok(competitiveDynamics.companies.every((item) => item.pain && item.memoryOption && Array.isArray(item.buyingCriteria)), "each circular node must carry its right-panel decision context");
assert.match(accountViews, /sc-dynamics-map[\s\S]*?sc-dynamics-node[\s\S]*?data-dynamics-detail/, "competitive dynamics must render circular nodes with a linked right-side detail panel");
assert.match(accountViews, /data-dynamics-layer[\s\S]*?data-dynamics-type[\s\S]*?data-dynamics-jump/, "layer, relationship, and connected-company controls must stay interactive");
assert.match(accountViews, /data-dynamics-links[\s\S]*?dynamicsEdge[\s\S]*?is-active/, "competitive dynamics must draw and highlight relation paths for the selected company");
assert.match(styles, /\.sc-dynamics-node\s*\{[\s\S]*?border-radius:\s*50%[\s\S]*?\.sc-dynamics-detail\s*\{/, "competitive dynamics must preserve the circular selectable map and detailed panel");
assert.match(styles, /\.sc-dynamics-links path\.is-active\s*\{[\s\S]*?stroke-width:\s*3/, "selected relation paths must remain visually distinct");
assert.equal(rebuilt.strategyBoard.customerPortfolio.contractGate.ruleId, "contract-structure");
assert.equal(rebuilt.strategyBoard.customerPortfolio.focusAccounts.length, 8);
assert.ok(rebuilt.strategyBoard.customerPortfolio.focusAccounts.every((item) => ["UNVERIFIED", "REQUEST", "DESIGN", "QUALIFICATION", "PRODUCTION"].includes(item.stageLedger.stage)), "every account must expose an evidence-gated Custom HBM stage");
assert.ok(rebuilt.strategyBoard.customerPortfolio.focusAccounts.filter((item) => item.stageLedger.stage === "UNVERIFIED").every((item) => item.stageLedger.label === "고객 제안 단계 검토"), "unverified stages must use audience-facing review language without crawl jargon");
assert.equal(rebuilt.strategyBoard.customerPortfolio.pillars.length, 3);
assert.deepEqual(
  rebuilt.strategyBoard.customerPortfolio.asicPortfolio.accounts.map((item) => item.id),
  ["google", "microsoft", "aws", "apple", "spacex", "nvidia", "meta", "tesla"],
  "priority ASIC portfolio must keep the customer decision order",
);
assert.equal(rebuilt.strategyBoard.customerPortfolio.asicPortfolio.evidencePolicy, undefined, "ASIC portfolio must not render the removed disclosure line");
assert.doesNotMatch(accountViews, /sc-asic-policy|미공개 사양은 추정하지 않음|공식 원문 기준/, "removed ASIC disclosure copy must not return through renderer fallbacks");
assert.match(app, /function shortKstDate\(value\)[\s\S]*?toLocaleDateString\("en-US"[\s\S]*?month: "numeric"[\s\S]*?day: "numeric"/, "date-only labels must use compact M/D formatting");
assert.match(app, /reports\.map\([\s\S]*?shortKstDate\(item\.publishedAt\)/, "AI application report dates must render as M/D");
assert.doesNotMatch(app, /고객 Pain과 사업 영향 기준으로 핵심 인사이트만 선별|유사 신호 통합 · 수치와 인용은 연결 원문에서 확인/, "removed insight-selection disclosure must not return");
assert.doesNotMatch(app, /scoreRingHTML\(item\.confidence, "Data"\)/, "executive decision cards must not expose internal DATA scores");
assert.match(app, /item\.directSignalModel === "hbm" \? "" : `<div class="decision-card-metrics">/, "HBM decision cards must hide internal evidence counts");
assert.match(app, /direct \? "" : `<div class="agent-debate-metrics">/, "HBM council must hide internal count metrics");
assert.doesNotMatch(app, /HBM 라이브 overlay|직접 신호 모델 · AI 수요/, "HBM decision header must not expose raw signal counts");
assert.doesNotMatch(app, /직접 신호 점수 \$\{fmtNum\(active\.directMetrics\?\.score/, "HBM decision payload must not expose internal signal scores");
assert.doesNotMatch(app, /직접 신호 점수/, "executive views must not expose internal HBM signal scores");
assert.match(app, /metrics: item\.directSignalModel === "hbm" \? \[\] : \[/, "executive workbench must hide internal HBM evidence counts");
assert.match(app, /hideCounts: active\.directSignalModel === "hbm"/, "HBM decision frames must suppress internal evidence counts");
assert.doesNotMatch(app, /canonical 원문 \$\{fmtNum\(active\.directMetrics\?\.evidenceCount/, "HBM audit copy must not expose raw evidence counts");
assert.ok(
  rebuilt.strategyBoard.customerPortfolio.asicPortfolio.accounts.every((item) => item.chipPortfolio?.length && item.chipPortfolio.every((chip) => chip.memoryPain && chip.memoryProposal && chip.source?.url)),
  "every priority ASIC card must connect workload, memory implication, proposal, and source",
);
assert.ok(
  rebuilt.strategyBoard.customerPortfolio.asicPortfolio.accounts.filter((item) => ["apple", "spacex"].includes(item.id)).every((item) => item.chipPortfolio.every((chip) => chip.publicSpec.includes("미공개"))),
  "Apple and SpaceX cards must not invent undisclosed memory specifications",
);
assert.equal(rebuilt.strategyBoard.customerPortfolio.supplierMatrix.rows.length, 8);
assert.ok(rebuilt.strategyBoard.customerPortfolio.productMap.some((item) => item.id === "ai-d-e"));
assert.equal(rebuilt.strategyBoard.customerPortfolio.roadmap90d.length, 3);
assert.equal(rebuilt.strategyBoard.customerPortfolio.baseDieStrategy.ladder.length, 4);
assert.deepEqual(
  rebuilt.strategyBoard.customerPortfolio.baseDieStrategy.decisionFrame.map((item) => item.label),
  ["CUSTOMER VALUE", "ARCHITECTURE", "ECONOMICS", "EXECUTION GATE"],
);
assert.ok(
  rebuilt.strategyBoard.customerPortfolio.baseDieStrategy.ladder.every((item) => item.claim && item.gate),
  "every Base Die option must separate claim status from its decision gate",
);
assert.equal(rebuilt.strategyBoard.customerPortfolio.transformerMemory.qkv.length, 3);
assert.equal(rebuilt.strategyBoard.customerPortfolio.transformerMemory.sources.length, 5);
assert.ok(
  rebuilt.strategyBoard.customerPortfolio.transformerMemory.sources.every((item) => item.url && item.sourceClass && item.tier),
  "KV Cache strategy sources must stay traceable after client generation",
);
assert.deepEqual(
  rebuilt.strategyBoard.customerPortfolio.transformerMemory.flow.map((item) => item.label),
  ["Q · K · V", "AUTOREGRESSIVE", "KV CACHE", "FULL CACHE READ", "TPOT · GOODPUT"],
);
assert.ok(rebuilt.strategyBoard.customerPortfolio.transformerMemory.flow.every((item) => item.painAxis && item.productIds?.length));
assert.ok(rebuilt.strategyBoard.partners.models.length >= 3);
assert.ok(rebuilt.strategyBoard.playbooks.length >= 3);
const maasPlaybook = rebuilt.strategyBoard.playbooks.find((item) => /MaaS|Memory-as-a-Service/i.test(item.segment || ""));
assert.equal(maasPlaybook?.commercialStatus, "strategy-hypothesis");
assert.ok(rebuilt.strategyBoard.playbooks.every((item) => item.evidence?.status), "every playbook must expose evidence status");
assert.equal(rebuilt.strategyBoard.reports.length, rebuilt.strategyBoard.evidenceCount);
assert.ok(rebuilt.strategyBoard.reports.every((item) => item.url && item.source && item.evidenceLevel && item.topics.length));
assert.equal(artifact.aiFactorySystem.architectureLayers.length, 9);
assert.equal(artifact.aiFactorySystem.workloads.length, 6);
assert.deepEqual(artifact.aiFactorySystem.workloads.map((item) => item.id), ["training", "realtime-inference", "batch-inference", "rag", "agentic", "multimodal"]);
assert.ok(artifact.aiFactorySystem.workloads.every((item) => item.evidence?.status && item.capacityMode));
assert.equal(artifact.aiFactorySystem.decisionSequence.length, 8);
assert.equal(artifact.aiFactorySystem.roadmap.length, 5);
assert.equal(artifact.aiFactorySystem.acceleratorDecision, undefined, "the removed accelerator scorecard must not remain in generated content");
assert.equal(artifact.aiFactorySystem.kpiTree.formulas.length, 4);
assert.ok(artifact.aiFactorySystem.demandShift.evidence.status);
assert.ok(artifact.aiFactorySystem.sources.length >= 8);
assert.equal(artifact.aiFactorySystem.pillarCoverage.length, 7);
assert.equal(artifact.aiFactorySystem.automation.failClosed, true);
assert.equal(artifact.aiFactorySystem.automation.totalWorkloads, 6);
assert.equal(artifact.aiFactorySystem.automation.activeWorkloads, 6);
assert.ok(Number.isInteger(artifact.aiFactorySystem.automation.promotedWorkloads));
assert.equal(artifact.aiFactorySystem.automation.refreshMode, "event + safety-poll + incremental-reindex");
assert.equal(artifact.caseClassification.length, 3);
assert.ok(artifact.decisionControl.integrity.status);
assert.ok(artifact.decisionControl.freshness.status);
assert.ok(artifact.decisionControl.coverage.status);
assert.ok(artifact.decisionControl.confidence.status);
assert.ok(artifact.workloadOptimization.sources.every((item) => item.url && item.status));
assert.ok(artifact.insights.every((item) => item.latest.title && item.decision && item.action));
assert.ok(rebuilt.insights.every((item) => item.hypothesis?.status === "unverified"));
assert.ok(rebuilt.decisionCases.every((item) => item.hypothesis?.label === "근거 미검증"));
assert.ok(artifact.decisionCases.every((item) => item.signals.length === 3 && item.sources.length >= 3));
assert.ok(artifact.competitors.every((item) => !item.hbmShare || (item.asOf && item.sourceUrl)));
assert.ok(artifact.competitors.every((item) => item.hbmShare !== "58%" || item.sourceUrl), "HBM share must never be an unprovenanced baseline value");
assert.ok(!JSON.stringify(artifact).includes("$500B+"), "generated content must not retain a fixed partnership value");
assert.ok(!JSON.stringify(artifact).includes("솔리드다임"), "generated site content must normalize the Solidigm Korean name");

const changedPayload = structuredClone(payload);
changedPayload.runId = "automation-contract-test";
changedPayload.updatedAt = "2031-01-02T03:04:05.000Z";
changedPayload.expiresAt = "2031-01-03T03:04:05.000Z";
changedPayload.news.unshift({
  title: "AUTOMATED RAG SERVING MEMORY SIGNAL",
  summary: "KV cache and retrieval memory architecture update",
  link: "https://example.com/automated-rag-memory-signal",
  source: "Official Test Source",
  sourceClass: "official",
  date: "2031-01-02",
});
const hbm = changedPayload.intelligence.briefs.find((item) => item.id === "hbm");
hbm.latest.title = "AUTOMATED CURRENT HBM SIGNAL";
hbm.latest.summary = "AUTOMATED CURRENT HBM SUMMARY";
hbm.decision = "AUTOMATED CURRENT HBM DECISION";
hbm.reversalKpi = "AUTOMATED CURRENT HBM REVERSAL";
const changedQuant = structuredClone(quant);
changedQuant.runId = changedPayload.runId;
changedQuant.decisionIntelligence.runId = changedPayload.runId;
const changedAutomationBrief = changedQuant.decisionIntelligence.decisionAutomation.briefs.find((item) => item.id === "custom-memory");
changedAutomationBrief.customerPain = "AUTOMATED CONSOLE CUSTOMER PAIN";
changedAutomationBrief.hypothesis = "AUTOMATED CONSOLE RECOMMENDATION";
changedAutomationBrief.action90d = "AUTOMATED CONSOLE 90D ACTION";
changedAutomationBrief.evidenceCount = 99;
const changed = buildSiteContentClient({ payload: changedPayload, quant: changedQuant });
const changedHbm = changed.decisionCases.find((item) => item.panelId === "hbm");
assert.equal(changed.runId, changedPayload.runId);
assert.equal(changed.generatedAt, changedPayload.updatedAt);
assert.equal(changedHbm.latest.title, hbm.latest.title);
assert.equal(changedHbm.decision, hbm.decision);
assert.equal(changedHbm.stop, hbm.reversalKpi);
assert.ok(changed.hero.currentDecisions.includes(hbm.decision));
assert.deepEqual(changed.hero.thesis, changed.hero.scope);
const changedHomepageAgenda = changed.hero.departmentWorkbench.agenda.find((item) => item.id === "broadcom-account-intelligence");
assert.ok(changedHomepageAgenda, "the main page must retain the curated Broadcom account-strategy portfolio");
assert.equal(changed.hero.departmentWorkbench.source, "accounts.projects");
assert.equal(changed.hero.departmentWorkbench.agenda.length, 3);
assert.notEqual(changedHomepageAgenda.customerPain, changedAutomationBrief.customerPain, "console automation briefs must not replace the main strategy summary");
assert.deepEqual(
  changed.strategyBoard.customerPortfolio.broadcomEcosystem.accounts.map((item) => item.id),
  ["google", "meta", "openai"],
  "Broadcom ecosystem must separate Google, Meta, and OpenAI account strategies",
);
assert.ok(changed.strategyBoard.customerPortfolio.broadcomEcosystem.accounts.every((item) => item.broadcomStrategy.pains.length >= 3 && item.broadcomStrategy.proposal.length >= 3));
assert.deepEqual(changed.organizationOperatingModel.units.map((item) => item.label), ["GSM", "HBM BUSINESS", "MSR"]);
assert.match(changed.organizationOperatingModel.source.url, /^https:\/\/news\.skhynix\.com\//);
assert.equal(changed.hero.departmentWorkbench.runId, changedPayload.runId);
assert.equal(changed.presentation.refreshPolicy.runId, changedPayload.runId);
assert.equal(changed.presentation.refreshPolicy.generatedAt, changedPayload.updatedAt);
assert.ok(changed.strategyBoard.reports.some((item) => item.title === "AUTOMATED RAG SERVING MEMORY SIGNAL"));

assert.match(workflow, /cron: "17 \* \* \* \*"/);
assert.match(workflow, /repository_dispatch:[\s\S]*earnings-release[\s\S]*industry-report[\s\S]*source-update/);
assert.match(workflow, /data\/site-content-client\.json/);
assert.match(workflow, /data\/site-content-extended-client\.json/);
assert.match(workflow, /npm run prerender:decision/);
assert.match(workflow, /npm run check:fast/);
assert.match(workflow, /data\/executive-latest\.json/);
assert.match(workflow, /console\/index\.html/);
assert.match(workflow, /data\/refresh-events\.json/);
assert.match(workflow, /INTELLIGENCE_EVENT_KEY/);
assert.match(landing, /SITE_CONTENT_PATH = "data\/site-content-client\.json"/);
assert.match(landing, /SITE_CONTENT_EXTENDED_PATH = "data\/site-content-extended-client\.json"/);
assert.doesNotMatch(landing, /teamCapabilityProofs|teamCadence/);
assert.doesNotMatch(index, /CAPABILITY SYSTEM|MANAGEMENT CADENCE|업무를 지탱하는 검증 가능한 역량|회의가 아니라 산출물이 남는 운영 주기/);
assert.match(landing, /content\.runId !== manifest\.runId/);
assert.match(landing, /browserRecheckMinutes/);
assert.match(landing, /function applyUniversalSectionBindings\(content = \{\}\)/);
assert.match(landing, /section\.dataset\.contentRun/);
assert.match(landing, /document\.addEventListener\("visibilitychange", recheckSiteContentNow\)/);
assert.match(landing, /window\.addEventListener\("online", recheckSiteContentNow\)/);
assert.match(landing, /function renderWorkloadOptimization\(content = \{\}\)/);
assert.match(landing, /function renderDepartmentHomepage\(content = \{\}\)/);
assert.match(landing, /hero\.departmentWorkbench/);
assert.match(landing, /#businessHomeDecisionQueue/);
assert.doesNotMatch(landing, /<small>OUTPUT · \$\{escapeBusinessHTML\(item\.deliverable/, "automated refresh must not restore the removed homepage output row");
assert.match(landing, /function renderOrganizationOperatingModel\(content = \{\}\)/);
assert.match(landing, /function renderAIFactorySystem\(content = \{\}\)/);
assert.match(landing, /#workloadMatrix/);
assert.doesNotMatch(landing, /#acceleratorScorecard/);
assert.match(landing, /#ragQualityPipeline/);
assert.doesNotMatch(landing, /businessRagQuality|businessFreshnessScore|retrievalStats\.reindexed|renderCaseClassification|applyDecisionControl|updateDataStatus/);
assert.doesNotMatch(landing, /business-hypothesis-badge/, "the removed unverified evidence badge must stay absent");
assert.match(index, /id="workload-optimization"/);
assert.match(index, /id="team-operating-model"/);
assert.match(index, /id="ai-factory-system"/);
assert.match(index, /id="aiFactoryRoadmap"/);
assert.doesNotMatch(index, /id="acceleratorScorecard"/);
assert.match(index, /id="ragOperatingModel"/);
assert.match(index, /Useful AI Work/);
assert.doesNotMatch(index, /id="businessFreshnessBoard"|id="automation"/);
assert.match(index, /id="decision-automation"/);
assert.match(index, /id="decisionAutomationBriefs"/);
assert.doesNotMatch(
  index,
  /AUTOMATED EVIDENCE CONTROL|business-workload-evidence|workloadEvidencePolicy|workloadEvidenceSources/,
  "the deleted workload evidence control must not be regenerated",
);
assert.doesNotMatch(
  landing,
  /workloadEvidencePolicy|workloadEvidenceSources|business-workload-evidence|business-workload-sources/,
  "the landing renderer must not recreate the deleted workload evidence control",
);
assert.doesNotMatch(
  index,
  /business-fabric-output|business-source-note|MINIMIZE[\s\S]*?MAXIMIZE/,
  "the deleted memory-fabric outcome and source rows must not be regenerated",
);
assert.doesNotMatch(
  landing,
  /business-memory-fabric \.business-source-note|primarySourceNote/,
  "the landing renderer must not recreate the deleted memory-fabric source row",
);
assert.doesNotMatch(
  index,
  /decision-os-control|decisionAutomationState|decisionAutomationAsOf|decisionCatalogCoverage|decisionClaimEvents|decisionVerifiedEvents|decisionReadyBriefs/,
  "the deleted decision-state summary control must not be regenerated",
);
assert.doesNotMatch(
  landing,
  /decisionAutomationState|decisionAutomationAsOf|decisionCatalogCoverage|decisionClaimEvents|decisionVerifiedEvents|decisionReadyBriefs/,
  "the landing renderer must not recreate the deleted decision-state summary control",
);
assert.match(index, /Source → ClaimEvent → Decision → Execution/);
assert.doesNotMatch(index, /Content Age|Embedding Lag|Stale Retrieval|Coverage Drift/);
assert.match(app, /window\.MEMORY_SITE_CONTENT\?\.agentCouncil\?\.agendas/);
assert.match(app, /window\.MEMORY_SITE_CONTENT\?\.strategyBoard/);
assert.match(app, /CUSTOMER & ASIC RADAR/);
assert.match(app, /AI INFRA · 3 CUSTOMER PROJECTS/);
assert.match(app, /aiInfraMissionNodes/);
assert.match(index, /AI Infra Strategic Value Chain/);
assert.match(styles, /--node-surface: var\(--panel\)/);
assert.match(styles, /--node-ink: #fff/);
assert.doesNotMatch(app, /GPU vs ASIC DEMAND MIX|CRAWL MEASURED|공식 Baseline · 최근 크롤 · 고객별 딥링크/);
const hbfModule = baseline.architectureMatrix?.advancedModules?.find((module) => module.id === "hbf-inference-tier");
assert.ok(hbfModule, "the HBF decision module must remain available");
assert.equal(hbfModule.scorecards.length, 4, "the HBF gate must stay MECE across four decision dimensions");
assert.deepEqual(hbfModule.scorecards.map((item) => item.label), ["시장 역할", "제품 검증", "고객 채택", "투자 게이트"]);
assert.equal(hbfModule.signals.length, 0, "the HBF module must not repeat scorecard content as signal chips");
assert.equal(hbfModule.actions.length, 1, "the HBF module must expose one non-duplicative executive rule");
assert.doesNotMatch(app, /const llmMap = \[|const partners = \[|const plays = \[/, "strategy board content must come from the generated site model");
assert.match(landing, /document\.body\.dataset\.snapshotUpdate = "blocked"/);
assert.match(landing, /document\.body\.dataset\.snapshotUpdate = "applied"/);
assert.doesNotMatch(landing, /window\.location\.reload\(\)/, "run mismatches must reconcile data without a reload loop");
assert.match(app, /replace\(\/솔리드다임\/g, "솔리다임"\)/, "the interactive console must normalize stale Solidigm labels at render time");
assert.match(index, /infra-[a-f0-9]{12}/);
assert.doesNotMatch(
  index,
  /data-live-source[^>]*>[\s\S]*?<\/a><\/div>\s*<dl>/,
  "decision evidence panels must not restore the deleted summary metric blocks",
);
assert.match(index, /Hyperscaler Roadmap to Memory Business/);
assert.doesNotMatch(index, /LIVE DECISION QUEUE · CONSOLE-CONNECTED|businessHomeQueueStatus/);
assert.match(index, /id="departmentDecisionQueue"/);
assert.doesNotMatch(index, /business-hero-proof|CUSTOMER ACCOUNT BRIEF|WORKLOAD-TO-MEMORY|EXECUTIVE EXECUTION PACK/, "the removed homepage output summary row must stay absent");
assert.doesNotMatch(index, /CONSOLE · LATEST EVIDENCE/, "the removed latest evidence label must stay absent");
assert.doesNotMatch(index, /PUBLIC CASE RECONSTRUCTION|ANONYMIZED CLIENT CASE|id="caseClassification"/);
assert.doesNotMatch(index, /ANONYMIZED USE CASE|GPU Compute보다|MODELED THRESHOLD/);
assert.doesNotMatch(app, /익명화 Case/);
assert.equal(executiveSnapshot.runId, artifact.runId);
assert.equal(executiveSnapshot.decisions.length, artifact.decisionIntelligence.decisionAutomation.briefs.length);
assert.ok(executiveSnapshot.decisions.every((brief) => brief.factBoundary && brief.hypothesisStatus === "strategy-hypothesis"));
assert.equal(new Set(executiveSnapshot.decisions.map((brief) => brief.decisionQuestion)).size, executiveSnapshot.decisions.length, "pre-rendered executive decisions must have unique questions");
assert.match(consoleSnapshot, /AI Infra Strategy · Executive Snapshot/);
assert.match(consoleSnapshot, /AI INFRA · THREE STRATEGY PILLARS/);
assert.equal((consoleSnapshot.match(/class="workstream-card"/g) || []).length, 3);
assert.equal((consoleSnapshot.match(/class="workstream-signal"/g) || []).length, 3);
assert.match(consoleSnapshot, /MECE DECISION ARCHITECTURE · ONE OWNER PER QUESTION/);
assert.match(consoleSnapshot, /ClaimEvent/);
assert.doesNotMatch(consoleSnapshot, /STAGE · (?:CUSTOMER_QUALIFICATION|ARCHITECTURE_BENCHMARK|BUSINESS_CASE|SCALE_GATE)|KILL CRITERIA/);
assert.doesNotMatch(consoleSnapshot, /로드 중|연결 중/);
const consoleVisibleCopy = consoleSnapshot
  .replace(/<(script|style|code|pre|textarea|option)\b[\s\S]*?<\/\1>/gi, "")
  .replace(/<[^>]+>/g, "\n");
assert.doesNotMatch(consoleVisibleCopy, /[가-힣]+다(?:[.!?。]|\s*$)/m, "pre-rendered Console copy must use executive bullet endings");
assert.match(text("scripts/prerender-decision.mjs"), /normalizeHtmlExecutiveCopy/, "daily pre-render must retain the bullet-copy policy");
const consoleDecisionTitles = [...consoleSnapshot.matchAll(/<article class="decision-card">[\s\S]*?<h2>(.*?)<\/h2>/g)].map((match) => match[1]);
assert.equal(consoleDecisionTitles.length, 4);
assert.equal(new Set(consoleDecisionTitles).size, 4, "pre-rendered decision card headlines must never repeat");

console.log(JSON.stringify({
  ok: true,
  runId: artifact.runId,
  decisions: artifact.decisionCases.length,
  insights: artifact.insights.length,
  agendas: artifact.agentCouncil.agendas.length,
  competitors: artifact.competitors.length,
  refresh: "event-first + hourly safety poll + 5-minute in-page revalidation",
}, null, 2));
