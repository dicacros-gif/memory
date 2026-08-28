import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSiteContentClient, validateSiteContent } from "./site-content.mjs";

await import("./test-fact-corrections.mjs");

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
const mbbFrames = text("assets/js/mbb-frames.js");
const styles = text("assets/css/styles.css");
const index = text("index.html");
const consoleSnapshot = text("console/index.html");
const executiveSnapshot = json("data/executive-latest.json");
const quarantine = json("data/crawl-quarantine.json");
const crawler = text("scripts/crawl.mjs");
const alertReporter = text("scripts/report-source-health.mjs");

assert.match(index, /assets\/js\/workload-translation\.min\.js\?v=infra-[a-f0-9]{12}/, "the causal-chain and account-level infographic must be wired into the landing page");

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
assert.equal(rebuilt.freshness.scheduleHours, 6);
assert.equal(rebuilt.freshness.browserRecheckMinutes, 5);
assert.deepEqual(rebuilt.hero.titleLines, ["AI Infra Pain", "to Memory Growth"]);
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
  ["google", "microsoft", "aws"],
  "Marvell must roll up Google, Microsoft, and AWS below the partner level",
);
assert.ok(artifactCore.strategyBoard.customerPortfolio.executiveOnePagers.length >= 8, "account one-pagers must hydrate without waiting for the extended payload");
assert.equal(
  artifactCore.strategyBoard.customerPortfolio.executiveOnePagers.length,
  quant.strategyAccountIntelligence.focusAccountCount,
  "the first-paint payload must carry every focus account discovered by the current crawl",
);
assert.equal(artifactCore.strategyBoard.customerPortfolio.layerModel.layers.length, 3, "the three-level account chain must be available at first paint");
// Counted, this pins the board to a moment: accounts merge and accounts get
// added. What must hold is that the frames still have companies to name.
assert.ok(artifactCore.strategyBoard.customerPortfolio.accounts.length >= 16,
  `company examples must be available to the first-paint frames, got ${artifactCore.strategyBoard.customerPortfolio.accounts.length}`);
assert.equal(artifactCore.strategyBoard.customerPortfolio.oemChannel.primaryAccount.id, "dell", "Dell OEM automation must hydrate with the first snapshot");
assert.equal(artifact.generation.failClosed, true);
assert.equal(artifact.schemaVersion, "1.1");
const sectionIds = [...index.matchAll(/<section\b[^>]*\bid=["']([^"']+)["']/gi)].map((match) => match[1]);
const uniqueSectionIds = [...new Set(sectionIds)];
assert.equal(artifact.siteAutomation.status, "all-sections-bound");
assert.equal(artifact.siteAutomation.totalSections, uniqueSectionIds.length);
assert.equal(artifact.siteAutomation.boundSections, uniqueSectionIds.length);
assert.equal(artifact.siteAutomation.refresh.safetyPollHours, 6);
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
assert.deepEqual(rebuilt.hero.workflow.map((item) => item.label), ["ACCOUNT FACT", "SYSTEM DIAGNOSIS", "MEMORY & BUSINESS DESIGN", "EXECUTIVE GATE"]);
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
assert.ok(rebuilt.strategyBoard.customerPortfolio.accounts.length >= 16, `rebuilt account coverage, got ${rebuilt.strategyBoard.customerPortfolio.accounts.length}`);
assert.deepEqual(rebuilt.strategyBoard.customerPortfolio.layerModel.summary.map((item) => item.id), ["asic-partner", "end-customer", "foundry-package"]);
assert.ok(rebuilt.strategyBoard.customerPortfolio.layerModel.partnerRollups.some((item) => item.partnerId === "broadcom" && item.accountIds.includes("openai")));
assert.ok(rebuilt.strategyBoard.customerPortfolio.accounts.some((item) => item.id === "marvell" && item.layer === "asic-partner"));
const awsAccount = rebuilt.strategyBoard.customerPortfolio.accounts.find((item) => item.id === "aws");
assert.match(awsAccount?.chip || "", /Trainium4.*Inferentia2.*Bedrock/);
assert.match(awsAccount?.memory || "", /NVHBM.*Custom HBM Base Die\/PHY/);
assert.equal(awsAccount?.evidence?.source, "AWS × NVIDIA Trainium4 and NVHBM");
assert.ok(
  rebuilt.strategyBoard.customerPortfolio.competitiveDynamics.relations.some((item) => item.id === "aws-nvidia-trainium4-nvhbm-2026" && item.evidenceGrade === "OFFICIAL"),
  "AWS and NVIDIA Trainium4/NVHBM co-design must appear in the Dynamics graph",
);
assert.doesNotMatch(accountViews, /dynamicsInitials/, "Dynamics nodes must use company logos instead of one-letter abbreviations");
assert.match(accountViews, /class="sc-dynamics-logo"/, "Dynamics nodes must render a logo surface");
assert.ok(
  rebuilt.strategyBoard.customerPortfolio.competitiveDynamics.companies.every((item) => item.logo),
  "every Dynamics company must expose a logo instead of a one-letter abbreviation",
);
assert.doesNotMatch(accountViews, />원문 ↗</, "Dynamics evidence titles must be the original-source links");
assert.match(mbbFrames, /class="mbb-record-title-link"/, "executive Pain Point titles must link directly to the source");
assert.doesNotMatch(mbbFrames, /\$\{sourceLink\(card\.source\)\}/, "executive Pain Point cards must not render a separate original-source label");
const strategyConsultingRenderer = app.match(/function renderStrategyConsulting\(\) \{[\s\S]*?(?=\r?\n  function )/)?.[0] || "";
assert.match(strategyConsultingRenderer, /Account[\s\S]*?Workload[\s\S]*?Pain Point[\s\S]*?Buying Criteria/i, "customer-problem route must own the MECE account-to-buying-criteria chain");
assert.doesNotMatch(strategyConsultingRenderer, /scCompetitiveDynamics|scExecutiveOnePagers|scPartnerEcosystem|ACCOUNT × SUPPLIER MATRIX|TECH RADAR → NEXT MEMORY/, "customer-problem route must not repeat ecosystem, executive, supplier, or technology modules");
assert.match(app, /function renderCompetitiveDynamicsInEcosystem\(\)[\s\S]*?equityCompetitiveDynamics[\s\S]*?renderCompetitiveDynamics/, "verified Dynamics must render in the collaboration-ecosystem route");
assert.equal(rebuilt.strategyBoard.customerPortfolio.partnerEcosystem.partners.length, 2);
assert.ok(rebuilt.strategyBoard.customerPortfolio.partnerEcosystem.partners.find((item) => item.id === "broadcom")?.accounts.some((item) => item.id === "anthropic"));
assert.deepEqual(
  rebuilt.strategyBoard.customerPortfolio.partnerEcosystem.partners.find((item) => item.id === "marvell")?.accounts.map((item) => item.id),
  ["google", "microsoft", "aws"],
);
assert.deepEqual(rebuilt.strategyBoard.customerPortfolio.groups.map((item) => item.id), ["gpu", "hyperscaler-asic", "design-ecosystem", "server-oem", "edge-physical"]);
assert.equal(rebuilt.strategyBoard.customerPortfolio.oemChannel.primaryAccount.company, "Dell Technologies");
// The channel covers three tiers now — the ODMs ship racks straight to
// hyperscalers — so pinning the list to Tier 1 would cap the coverage. Tier 1
// must still be there, and every row must declare which tier it is.
{
  const oemIds = rebuilt.strategyBoard.customerPortfolio.oemChannel.accounts.map((item) => item.id);
  for (const id of ["dell", "hpe", "lenovo", "supermicro"]) {
    assert.ok(oemIds.includes(id), `Tier 1 OEM detail must cover ${id}`);
  }
  assert.ok(rebuilt.strategyBoard.customerPortfolio.oemChannel.accounts.every((item) => item.tier),
    "every OEM row must declare its tier");
}
assert.ok(true,
);
assert.ok(rebuilt.strategyBoard.customerPortfolio.oemChannel.accounts.every((item) => item.platform && item.pain && item.memory && item.gate && /^https:\/\//.test(item.source?.url || "")));
assert.deepEqual(rebuilt.strategyBoard.customerPortfolio.oemChannel.groups.map((item) => item.id), ["dell", "brand-oem", "odm"]);
assert.ok(rebuilt.strategyBoard.customerPortfolio.oemChannel.groups.every((item) => /^https:\/\//.test(item.source?.url || "")));
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
// SpaceX is carried inside the merged physical-AI account rather than as a
// row of its own, so the name has to survive on that account.
assert.ok(rebuilt.strategyBoard.customerPortfolio.accounts.some((item) => String(item.company || "").includes("SpaceX")));
assert.ok(rebuilt.strategyBoard.customerPortfolio.accounts.some((item) => item.company === "Anthropic" && item.xpuEcosystem?.source?.url));
assert.ok(rebuilt.strategyBoard.customerPortfolio.accounts.some((item) => item.company === "OpenAI" && item.xpuEcosystem?.claim === "verified-fact"));
assert.ok(rebuilt.strategyBoard.customerPortfolio.competitiveFrame.some((item) => item.company === "CXMT"));
const competitiveDynamics = rebuilt.strategyBoard.customerPortfolio.competitiveDynamics;
assert.deepEqual(
  competitiveDynamics.layers.map((item) => item.id),
  ["end-customer", "asic-partner", "foundry-package", "memory-supply", "oem-tier-1", "oem-tier-2", "oem-tier-3"],
  "competitive dynamics must preserve the existing value chain and append the three OEM/ODM priority tiers",
);
assert.deepEqual(
  competitiveDynamics.types.map((item) => item.id),
  ["competition", "partnership", "investment", "supply", "qualification", "exploration", "adjacency", "hypothesis"],
  "competitive dynamics must expose qualification and exploration without folding them into confirmed supply",
);
assert.ok(competitiveDynamics.relations.some((item) => item.type === "partnership" && item.from === "broadcom" && item.to === "google"));
assert.ok(competitiveDynamics.relations.some((item) => item.type === "partnership" && item.from === "broadcom" && item.to === "anthropic"));
assert.ok(competitiveDynamics.relations.some((item) => item.type === "partnership" && item.from === "marvell" && item.to === "aws"));
const googleMediaTekRelations = competitiveDynamics.relations.filter((item) => [item.from, item.to].includes("google") && [item.from, item.to].includes("mediatek"));
assert.equal(googleMediaTekRelations.length, 1, "Google–MediaTek must render as one explicit relationship, not duplicate generic and supply edges");
assert.equal(googleMediaTekRelations[0]?.id, "google-mediatek-tpu-design-2026");
assert.equal(googleMediaTekRelations[0]?.type, "partnership");
assert.equal(googleMediaTekRelations[0]?.evidenceGrade, "RESEARCH ESTIMATE");
assert.match(`${googleMediaTekRelations[0]?.detail || ""} ${googleMediaTekRelations[0]?.memoryImplication || ""}`, /KGD.*I\/O.*HBM|HBM.*I\/O/i, "Google–MediaTek relation must expose the COT/KGD block split and memory implication");
assert.ok(competitiveDynamics.relations.some((item) => item.type === "competition" && item.from === "skhynix" && item.to === "samsung"));
assert.ok(competitiveDynamics.relations.some((item) => item.type === "partnership" && item.from === "skhynix" && item.to === "tsmc"));
assert.ok(competitiveDynamics.relations.some((item) => item.type === "investment" && item.from === "microsoft" && item.to === "openai"));
assert.ok(competitiveDynamics.relations.some((item) => item.type === "investment" && item.from === "google" && item.to === "anthropic"));
assert.ok(competitiveDynamics.relations.some((item) => item.type === "investment" && item.from === "aws" && item.to === "anthropic"));
assert.ok(competitiveDynamics.relations.some((item) => item.type === "investment" && item.from === "nvidia" && item.to === "anthropic"));
assert.ok(competitiveDynamics.relations.some((item) => item.type === "investment" && item.from === "nvidia" && item.to === "coreweave"));
assert.ok(competitiveDynamics.relations.some((item) => item.type === "investment" && item.from === "nvidia" && item.to === "coherent"));
const nvidiaMarvellInvestment = competitiveDynamics.relations.find((item) => item.type === "investment" && item.from === "nvidia" && item.to === "marvell");
const nvidiaMarvellPartnership = competitiveDynamics.relations.find((item) => item.type === "partnership" && item.from === "nvidia" && item.to === "marvell");
const googleMarvellPartnership = competitiveDynamics.relations.find((item) => item.type === "partnership" && item.from === "marvell" && item.to === "google");
const googleMarvellSupply = competitiveDynamics.relations.find((item) => item.type === "supply" && item.from === "marvell" && item.to === "google");
const googleMarvellEconomicAlignment = competitiveDynamics.relations.find((item) => item.type === "investment" && item.from === "google" && item.to === "marvell");
assert.ok(nvidiaMarvellInvestment?.source?.url && nvidiaMarvellInvestment.memoryImplication && nvidiaMarvellInvestment.decisionImpact, "NVIDIA–Marvell investment must retain filing, memory implication, and account action");
assert.match(nvidiaMarvellPartnership?.domain || "", /NVLINK/i, "NVIDIA–Marvell technology partnership must remain distinct from its equity investment");
assert.match(`${googleMarvellPartnership?.title || ""} ${googleMarvellPartnership?.domain || ""}`, /CUSTOM SILICON|CO-DESIGN/i, "Google–Marvell custom silicon partnership must be explicit");
assert.match(googleMarvellSupply?.detail || "", /custom semiconductor/i, "Google–Marvell custom product supply relation must be explicit");
assert.ok(googleMarvellEconomicAlignment?.detail?.includes("Warrant"), "Google's purchase-linked Marvell warrant must remain a separate economic-alignment edge");
assert.ok(competitiveDynamics.relations.some((item) => item.type === "supply" && item.from === "google" && item.to === "anthropic"));
assert.ok(competitiveDynamics.relations.some((item) => item.type === "supply" && item.from === "aws" && item.to === "anthropic"));
assert.ok(competitiveDynamics.relations.some((item) => item.type === "supply" && item.from === "spacexai" && item.to === "anthropic"));
// Tesla and SpaceXAI are separate legal and buying-center accounts. Keeping
// them separate prevents Colossus and STARMIND signals from contaminating the
// Tesla vehicle/robotics requirement matrix.
const portfolioAccounts = rebuilt.strategyBoard.customerPortfolio.accounts;
assert.ok(portfolioAccounts.some((item) => item.id === "tesla" && item.company === "Tesla"),
  "Tesla must remain a standalone physical-AI account");
assert.ok(portfolioAccounts.some((item) => item.id === "spacexai" && String(item.company || "").includes("Grok")),
  "SpaceXAI and Grok must share the AI-segment account");
assert.ok(!portfolioAccounts.some((item) => item.id === "spacex"), "spacex must not remain a separate account");
assert.ok(competitiveDynamics.relations.some((item) => item.type === "supply" && item.from === "skhynix"));
assert.ok(competitiveDynamics.companies.some((item) => item.id === "coreweave"));
assert.ok(competitiveDynamics.companies.some((item) => item.id === "coherent"));
const oemPriorityOrder = competitiveDynamics.layers
  .filter((item) => item.id.startsWith("oem-tier-"))
  .flatMap((item) => item.companies.map((company) => company.id));
assert.deepEqual(
  oemPriorityOrder,
  ["dell", "hpe", "lenovo", "supermicro", "quanta-qct", "wiwynn", "foxconn", "inventec", "gigabyte", "asus", "cisco", "fujitsu"],
  "OEM/ODM priority nodes must retain the requested tier and company order",
);
assert.equal(competitiveDynamics.companies.find((item) => item.id === "dell")?.layer, "oem-tier-1", "Dell must move only inside Dynamics while retaining its account data");
assert.equal(competitiveDynamics.relations.filter((item) => item.type === "hypothesis").length, 12, "all authored OEM/ODM hypotheses must remain available outside the verified default view");
assert.ok(competitiveDynamics.relations.filter((item) => item.type === "hypothesis").every((item) => item.domain === "STRATEGIC HYPOTHESIS" && !item.source), "hypothesis edges must not be presented as verified transactions");
assert.ok(competitiveDynamics.relations.every((item) => ["claim", "sourceClass", "evidenceGrade", "effectiveAt", "status"].every((key) => Object.hasOwn(item, key))), "every Dynamics relation must preserve the evidence contract used by the verified view");
const verifiedView = competitiveDynamics.views?.skhynixVerified;
assert.equal(competitiveDynamics.defaultView, "skhynixVerified", "the evidence-gated SK hynix view must be the console default");
assert.equal(verifiedView?.anchorId, "skhynix");
assert.equal(verifiedView?.evidencePolicy?.claim, "verified-fact");
assert.deepEqual(verifiedView?.evidencePolicy?.sourceClasses, ["official", "filing"]);
assert.deepEqual(verifiedView?.evidencePolicy?.evidenceGrades, ["OFFICIAL", "FILING"]);
assert.equal(verifiedView?.evidencePolicy?.historyWindowMonths, 36);
assert.equal(verifiedView?.evidencePolicy?.historyBoundary, "calendar-month-inclusive");
assert.equal(verifiedView?.evidencePolicy?.uniqueEdgePerCompanyPair, true);
assert.equal(verifiedView?.evidencePolicy?.failClosed, true);
assert.equal(verifiedView?.companyScope, "site-company-registry", "the deferred Dynamics view must expose every company already registered in the site's value chain");
assert.equal(verifiedView?.relationScope, "skhynix-verified-direct", "expanding nodes must not broaden the verified relation policy");
assert.deepEqual(
  new Set(verifiedView?.companyIds || []),
  new Set(competitiveDynamics.companies.map((company) => company.id)),
  "the full Dynamics view must include every registered company exactly once",
);
assert.ok(competitiveDynamics.companies.length >= 35, "the existing seven-lane Dynamics roster must expose all 35 site companies and allow later additions");
const verifiedRelations = verifiedView.relationIds.map((id) => competitiveDynamics.relations.find((item) => item.id === id));
assert.ok(verifiedRelations.every(Boolean), "every verified-view relation id must resolve against the preserved full relation set");
const verifiedConnectedCompanies = new Set(verifiedRelations.flatMap((relation) => [relation.from, relation.to]));
assert.equal(verifiedView?.counts?.connectedCompanies, verifiedConnectedCompanies.size, "connected-company count must derive from verified edge endpoints");
assert.equal(verifiedView?.counts?.unconnectedCompanies, competitiveDynamics.companies.length - verifiedConnectedCompanies.size, "unconnected companies must remain visible without fabricated edges");
assert.ok(verifiedRelations.every((item) => item.from === "skhynix" || item.to === "skhynix"), "the default map must remain anchored on SK hynix");
assert.ok(verifiedRelations.every((item) => item.claim === "verified-fact" && ["official", "filing"].includes(item.sourceClass)), "watch, market-estimate, and hypothesis claims must fail closed");
assert.ok(verifiedRelations.every((item) => ["OFFICIAL", "FILING"].includes(item.evidenceGrade) && /^https?:\/\//.test(item.source?.url || "") && item.effectiveAt), "verified edges need an official original source and an effective date");
const verifiedPairs = verifiedRelations.map((item) => [item.from, item.to].sort().join(":"));
assert.equal(new Set(verifiedPairs).size, verifiedPairs.length, "the default map must draw one representative edge per company pair");
assert.equal(verifiedRelations.filter((item) => [item.from, item.to].includes("dell")).length, 1, "Dell must not retain a parallel hypothesis or duplicate official edge in the default view");
assert.ok(competitiveDynamics.relations.some((item) => item.type === "hypothesis" && [item.from, item.to].includes("dell") && !verifiedView.relationIds.includes(item.id)), "the full graph may preserve Dell history/hypotheses, but the default view must suppress the duplicate edge");
assert.ok(!verifiedRelations.some((item) => ["strategy-hypothesis", "watch", "market-estimate"].includes(item.claim) || item.type === "hypothesis"));
assert.ok(!verifiedRelations.some((item) => item.id === "skhynix-guc-hbm3-validation-2022"), "official relationships older than the 36-month calendar window must remain history, not default-view evidence");
assert.ok(verifiedRelations.some((item) => item.id === "skhynix-mediatek-lpddr5t-validation-2023"), "the August 2023 MediaTek validation must remain inside the inclusive August 2026 calendar-month boundary");
assert.deepEqual(
  ["hpe", "meta", "microsoft", "foxconn", "lenovo", "supermicro", "quanta-qct", "cisco", "mediatek"].filter((id) => !verifiedView.companyIds.includes(id)),
  [],
  "current official HPE, Meta, Microsoft, Foxconn, Lenovo, Supermicro, QCT, Cisco, and MediaTek relationships must enter automatically",
);
assert.equal(verifiedRelations.find((item) => [item.from, item.to].includes("microsoft"))?.type, "exploration", "Microsoft must remain an official exploration, not confirmed supply");
assert.equal(verifiedRelations.find((item) => [item.from, item.to].includes("foxconn"))?.type, "exploration", "Foxconn must remain an official exploration, not confirmed supply");
assert.equal(verifiedView.counts.companies, verifiedView.companyIds.length);
assert.equal(verifiedView.counts.relations, verifiedView.relationIds.length);
assert.equal(verifiedView.counts.layers, verifiedView.layerIds.length);
assert.equal(verifiedView.counts.types, verifiedView.types.length);
assert.equal(verifiedView.excludedCount, competitiveDynamics.relations.length - verifiedView.relationIds.length);
assert.ok(verifiedView.layerIds.every((layerId) => competitiveDynamics.layers.find((layer) => layer.id === layerId)?.companies.some((company) => verifiedView.companyIds.includes(company.id))), "the verified view must not expose an empty layer");
assert.ok(verifiedView.types.every((type) => type.count === verifiedRelations.filter((relation) => relation.type === type.id).length), "verified-view type counts must derive from its representative edges");
assert.ok(competitiveDynamics.relations.some((item) => item.claim === "market-estimate" && !verifiedView.relationIds.includes(item.id)), "market estimates must remain available outside the fail-closed default view");
assert.ok(competitiveDynamics.companies.filter((item) => item.priorityTier).every((item) => item.systemRole && item.collaborationValue && item.memoryOption && item.decision), "priority nodes must expose role, collaboration value, memory proposal, and execution gate");
assert.ok(competitiveDynamics.companies.every((item) => item.company && item.layer && item.portfolio && Number.isInteger(item.relationCount)));
assert.ok(competitiveDynamics.companies.every((item) => item.pain && item.memoryOption && Array.isArray(item.buyingCriteria)), "each circular node must carry its right-panel decision context");
assert.match(accountViews, /sc-dynamics-map[\s\S]*?sc-dynamics-node[\s\S]*?data-dynamics-detail/, "competitive dynamics must render circular nodes with a linked right-side detail panel");
assert.match(accountViews, /AI VALUE CHAIN · ALL COMPANIES[\s\S]*?사이트 업체 전체[\s\S]*?검증 관계/, "company coverage and verified relationship counts must be labelled as separate concepts");
assert.match(accountViews, /AI VALUE CHAIN · VERIFIED ENDPOINTS[\s\S]*?검증 관계 업체/, "the transfer-budget fallback must not claim to be the full company roster");
assert.match(accountViews, /Number\(company\.relationCount \|\| 0\) > 0 \? `<em>/, "zero relationship counts must not render as misleading node badges");
assert.match(accountViews, /overviewMode[\s\S]*?!overviewMode && !selected/, "the all-company overview must not hide unconnected companies behind muted opacity");
assert.match(accountViews, /data-dynamics-layer[\s\S]*?data-dynamics-type[\s\S]*?data-dynamics-jump/, "layer, relationship, and connected-company controls must stay interactive");
assert.match(accountViews, /data-dynamics-links[\s\S]*?dynamicsEdge[\s\S]*?is-active/, "competitive dynamics must draw and highlight relation paths for the selected company");
assert.match(accountViews, /dataset\.pi[\s\S]*?dataset\.pt/, "parallel relationship lanes must remain encoded for distinct paths");
assert.match(accountViews, /sc-dynamics-memory[\s\S]*?sc-dynamics-action/, "memory implication and account action must remain visible in the relation detail panel");
assert.match(accountViews, /SYSTEM ROLE[\s\S]*?협력 가치[\s\S]*?MEMORY 제안[\s\S]*?실행 GATE/, "OEM/ODM node selection must render the four requested decision fields");
assert.match(styles, /\.sc-dynamics-node\s*\{[\s\S]*?border-radius:\s*50%[\s\S]*?\.sc-dynamics-detail\s*\{/, "competitive dynamics must preserve the circular selectable map and detailed panel");
assert.match(styles, /\.sc-dynamics-links path\.is-active\s*\{[\s\S]*?stroke-width:\s*var\(--relation-active-width/, "selected relation paths must retain an evidence-class-aware active width");
for (const lineKind of ["official", "exploration", "qualification"]) {
  assert.match(styles, new RegExp(`data-dynamics-line-kind=["']?${lineKind}["']?`), `${lineKind} relationships must have a distinct line treatment`);
}
assert.equal(rebuilt.strategyBoard.customerPortfolio.contractGate.ruleId, "contract-structure");
assert.ok(rebuilt.strategyBoard.customerPortfolio.focusAccounts.length >= 12, `focus account coverage, got ${rebuilt.strategyBoard.customerPortfolio.focusAccounts.length}`);
assert.ok(rebuilt.strategyBoard.customerPortfolio.focusAccounts.every((item) => ["UNVERIFIED", "REQUEST", "DESIGN", "QUALIFICATION", "PRODUCTION"].includes(item.stageLedger.stage)), "every account must expose an evidence-gated Custom HBM stage");
assert.ok(rebuilt.strategyBoard.customerPortfolio.focusAccounts.filter((item) => item.stageLedger.stage === "UNVERIFIED").every((item) => item.stageLedger.label === "고객 제안 단계 검토"), "unverified stages must use audience-facing review language without crawl jargon");
assert.equal(rebuilt.strategyBoard.customerPortfolio.pillars.length, 3);
assert.deepEqual(
  rebuilt.strategyBoard.customerPortfolio.asicPortfolio.accounts.map((item) => item.id),
  ["google", "microsoft", "aws", "apple", "nvidia", "meta", "tesla"],
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
assert.match(app, /<span>BUYING CENTER<\/span>/, "hyperscaler account map must expose the decision-chain buying center");
assert.match(app, /DISCOVER · ACCOUNT/, "hyperscaler strategy must use a consulting-stage flow");
assert.match(app, /<small>WHAT CHANGED<\/small>/, "latest evidence must be framed as a decision signal");
assert.match(styles, /\.projection-account-node[\s\S]*?clip-path:/, "account map must render as a consulting infographic");
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
assert.ok(
  rebuilt.strategyBoard.customerPortfolio.supplierMatrix.rows.length >= 8,
  "supplier matrix must preserve the governed baseline while allowing crawl-discovered account rows to accumulate",
);
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

assert.match(workflow, /cron: "17 \*\/6 \* \* \*"/);
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
assert.match(app, /ACCOUNT → WORKLOAD → PAIN POINT → BUYING CRITERIA/);
assert.match(app, /고객별 지배 병목과 구매 기준/);
assert.doesNotMatch(app, /CUSTOMER & ASIC RADAR|AI INFRA · 3 CUSTOMER PROJECTS/,
  "the MECE customer-problem route must not restore duplicate portfolio and project sections");
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
assert.match(index, /Hyperscaler Pain/);
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
assert.match(consoleSnapshot, /AI Infra Planning · Executive Snapshot/);
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
  refresh: "event-first + six-hour safety poll + 5-minute in-page revalidation",
}, null, 2));
