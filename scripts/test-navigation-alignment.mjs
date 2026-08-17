#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [html, app, css, landing, landingCss] = await Promise.all([
  readFile(resolve(root, "index.html"), "utf8"),
  readFile(resolve(root, "assets/js/app.js"), "utf8"),
  readFile(resolve(root, "assets/css/styles.css"), "utf8"),
  readFile(resolve(root, "assets/js/landing.js"), "utf8"),
  readFile(resolve(root, "assets/css/landing.css"), "utf8"),
]).then((files) => files.map((content) => content.replace(/\r\n/g, "\n")));

function extractLiteral(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `missing literal: ${startMarker}`);
  return source.slice(start + startMarker.length, end).trim();
}

const routes = Function(
  `"use strict"; return (${extractLiteral(
    app,
    "const SIDE_NAV_ROUTES = ",
    ";\n  const ROUTE_DISPLAY",
  )});`,
)();
const groups = Function(
  `"use strict"; return (${extractLiteral(
    app,
    "const SIDE_NAV_GROUPS = ",
    ";\n  const SIDE_NAV_ICONS",
  )});`,
)();

const sectionOrder = new Map();
for (const match of html.matchAll(/<(?:main|section)\b[^>]*\bid="([^"]+)"/g)) {
  if (!sectionOrder.has(match[1])) sectionOrder.set(match[1], sectionOrder.size);
}

assert.ok(routes.length >= 10, "sidebar routes should cover the full dashboard");
assert.equal(new Set(routes.map((route) => route.id)).size, routes.length, "route ids must be unique");
assert.equal(new Set(routes.map((route) => route.jump)).size, routes.length, "route landmarks must be unique");
assert.deepEqual(
  routes.slice(0, 3).map((route) => route.id),
  ["home", "biz-consulting", "executive-summary"],
  "opening route must stay video → strategy consulting → executive summary",
);
assert.deepEqual(
  routes.slice(0, 3).map((route) => route.jump),
  ["overview", "strategy-consulting", "overview-content"],
  "opening tab targets must match the right-hand document order",
);

let previousJump = -1;
for (const route of routes) {
  assert.ok(sectionOrder.has(route.jump), `missing jump target: ${route.id} -> ${route.jump}`);
  const jumpIndex = sectionOrder.get(route.jump);
  assert.ok(jumpIndex > previousJump, `route order must follow document order: ${route.id}`);
  previousJump = jumpIndex;

  let previousSection = -1;
  for (const section of route.sections) {
    assert.ok(sectionOrder.has(section), `missing owned section: ${route.id} -> ${section}`);
    const index = sectionOrder.get(section);
    assert.ok(index >= jumpIndex, `owned section precedes its route landmark: ${route.id} -> ${section}`);
    assert.ok(index > previousSection, `owned sections must be ordered: ${route.id}`);
    previousSection = index;
  }
}

const groupedRoutes = groups.flatMap((group) => group.routes);
assert.deepEqual(groupedRoutes, routes.map((route) => route.id), "sidebar groups must preserve route order");
assert.equal(routes.at(-1).id, "stock", "Stock analysis must remain at the bottom");
assert.deepEqual(
  groups.map((group) => group.label),
  ["AI Infra Decisions", "Technology & Commercialization", "Market & External Context"],
  "navigation should use the customer-first decision information architecture",
);
for (const retiredRoute of ["policy", "china-workforce", "competitors", "talent", "workbench", "market-map", "strategy-actions"]) {
  assert.ok(!routes.some((route) => route.id === retiredRoute), `retired route must stay removed: ${retiredRoute}`);
}
for (const retiredSection of ["policy-makers", "china-fab-infra", "china-talent-strategy", "china-community", "china-nand", "china-dynamics", "talent-radar", "workbench", "memory-market-map", "china-deep-dive"]) {
  assert.match(html, new RegExp(`id="${retiredSection}"[^>]*\\shidden(?:\\s|>)`), `retired section must remain hidden: ${retiredSection}`);
}
assert.doesNotMatch(html, /CEO 챌린지|id="ceoChallengeSelect"|id="ceoAgentAnswer"/, "the casual CEO challenge must not appear in the executive board");
assert.doesNotMatch(app, /id: "china-dram"/, "China DRAM decision axis should be retired");
assert.doesNotMatch(app, /id: "china",\s+accent: "#DB2777"/, "China consulting lens should be retired");
assert.match(app, /const manifestPromise = loadDataManifest\(\);/, "critical manifest request must start early");
assert.match(app, /const auditPromise = loadJSON\("data\/crawl-audit\.json"/, "the evidence audit must load with the decision control plane");
assert.match(app, /function updateScrollSpyFromGeometry\(\)/, "scroll spy must use cached geometry");
assert.match(app, /function scheduleProgressiveDeferredSections\(definitions\)[\s\S]*?const first = queue\[cursor\+\+\][\s\S]*?ensureDeferredSection\(first\.id\)\.finally/, "the first strategy section should be ready immediately and later sections should follow without scrolling");
assert.doesNotMatch(app, /function observeDeferredSections\(|rootMargin: "900px 0px"/, "deferred loading must not wait for viewport intersection");
assert.match(css, /\.deferred-section\s*\{[\s\S]*?content-visibility:\s*auto;/, "offscreen sections must skip paint");
assert.doesNotMatch(css, /#(?:overview|strategy-consulting|overview-content)\s*\{[^}]*\border\s*:/, "opening sections must not be visually reordered with CSS");

const businessNavLabels = [...html.matchAll(/<nav class="business-nav"[\s\S]*?<\/nav>/g)]
  .flatMap((match) => [...match[0].matchAll(/<a href="#[^"]+">([^<]+)<\/a>/g)].map((link) => link[1]));
assert.deepEqual(businessNavLabels, [
  "Home",
  "Team OS",
  "Decision Lab",
  "Strategy",
  "Solutions",
  "Tech &amp; Market",
  "Partners &amp; Cases",
  "Macro Intel",
], "the public site must expose the AI Infra strategy information architecture");
assert.match(html, /business-console-label--full">Open Intelligence Console<\/span>[\s\S]*?business-console-label--short"[^>]*>Console<\/span>/, "the header CTA must expose full and compact non-overlapping labels");
assert.match(landingCss, /body\.landing-mode\s*\{[^}]*margin:\s*0;[^}]*max-width:\s*100%;[^}]*overflow-x:\s*clip;/, "the public page must stay within the viewport width without the browser's default body margin");
assert.match(landingCss, /\.business-site :is\(img, picture, video, svg, canvas, iframe, table\)\s*\{[^}]*max-width:\s*100%;/, "site media and data visuals must respect max-width 100%");
assert.doesNotMatch(html, /business-contract-funnel/, "the removed partnership spotlight funnel must stay deleted");
assert.match(landingCss, /\.business-header\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*100%;[^}]*grid-template-columns:\s*auto minmax\(0, 1fr\) auto;/, "the fixed header must use a shrink-safe full-width grid");
assert.match(landingCss, /@media \(max-width: 1440px\)[\s\S]*?\.business-console-label--full\s*\{[^}]*display:\s*none;[\s\S]*?\.business-console-label--short\s*\{[^}]*display:\s*inline;/, "the console CTA must shorten before it can collide with navigation");
assert.match(landingCss, /@media \(max-width: 1120px\)[\s\S]*?\.business-menu-button\s*\{[^}]*display:\s*grid;[\s\S]*?\.business-nav\s*\{[^}]*position:\s*absolute;[^}]*display:\s*none;/, "medium-width navigation must collapse before header items overlap");
assert.match(html, /id="intelligenceConsole" hidden/, "the Intelligence Console must stay outside the initial visible layer");
assert.doesNotMatch(html, /<script[^>]+src="assets\/js\/app\.js/, "the heavy console app must not load with the public landing page");
assert.doesNotMatch(html, /<link[^>]+href="assets\/css\/styles\.css/, "the heavy console stylesheet must not load with the public landing page");
assert.match(html, /assets\/js\/landing\.min\.js\?v=infra-20260817-47/, "the lightweight landing controller must use the minified AI Infra revision");
assert.match(html, /class="business-footer"[\s\S]*?href="https:\/\/www\.linkedin\.com\/in\/dicacross\/"[\s\S]*?© 2026 dicacross · Independent strategy portfolio based on public information/, "the public portfolio credit must link to the dicacross LinkedIn profile");
assert.doesNotMatch(html, /메모리를 판매하는 것이 아니라/, "the removed sales-negation headline must stay deleted");
assert.doesNotMatch(html, /직무 적합성을 세 가지|검증 가능한 역량으로 압축합니다/, "the removed role-fit headline must stay deleted");
assert.doesNotMatch(html, /SK hynix AI Infra에서 만들고 싶은/, "the removed aspiration heading must stay deleted");
assert.doesNotMatch(html, /Memory Strategy 조직은 전망을 만드는 데서 끝나지 않습니다/, "the removed narrative sentence must stay deleted");
assert.match(html, /data-frame="McKINSEY · THREE HORIZONS"/, "the initiative system must expose a consulting-frame label");
assert.match(html, /class="business-initiative-foundation"/, "the initiative infographic must include a visible foundation layer");
assert.match(html, /data-frame="BAIN · RESULTS DELIVERY"/, "the capability system must expose its results-delivery frame");
assert.match(html, /data-frame="BCG · 2×2 SCENARIO MATRIX"/, "external context must use a 2x2 scenario frame");
assert.match(html, /Hypothesis → Test → Trigger → Decision/, "deep cases must show the decision-validation sequence");
assert.match(landing, /function setupInfographicSequence\(\)/, "the landing controller must stagger infographic sequences");
assert.match(landingCss, /@keyframes consultingArrowPulse/, "the infographic system must animate directional flow");
assert.match(app, /id: "executive-decision"[\s\S]*?render: renderExecutiveDecision[\s\S]*?data: \["decisionHistory"\]/, "Technology & Memory must use the compact decision bundle");
assert.match(app, /path: "data\/decision-history-client\.json"/, "the compact decision history artifact must be loaded on demand");
assert.match(app, /function setupDecisionHistoryPreload\(\)/, "Technology & Memory history must prewarm on navigation intent and idle time");
assert.match(app, /BACKTEST_YEAR_OPTIONS_CACHE[\s\S]*?BACKTEST_CLOSE_CACHE/, "Technology & Memory must cache repeated backtest option scans");
assert.match(app, /section\.dataset\.deferredDataMs[\s\S]*?section\.dataset\.deferredRenderMs/, "deferred performance timings must remain observable in the DOM");
assert.match(app, /Move to the reserved framework shell immediately[\s\S]*?alignTarget\(\);[\s\S]*?await ensureDeferredSection\(id\)/, "deferred navigation must reveal its reserved shell before waiting for data");
assert.match(html, /class="decision-loading-framework"[\s\S]*?01<\/b> SIGNAL[\s\S]*?05<\/b> ACTION/, "Technology & Memory must expose a consulting-framework loading shell");
assert.match(html, /exec-backtest-memory-wave-960\.webp/, "the decision board must use the responsive backtest image");
assert.match(css, /Executive consulting geometry system[\s\S]*?\.consulting-system \.sc-card \{[\s\S]*?border-top: 1px solid var\(--line\);[\s\S]*?box-shadow: none;/, "strategy cards must remove colored top rails and glow shadows");
assert.match(css, /\.consulting-system \.sc-card-flow \{[\s\S]*?grid-template-columns: 1\.18fr 1fr 1fr 1\.14fr 1\.24fr;/, "opportunity cards must use a five-step decision map");
assert.match(css, /#execDecisionRunCouncil[\s\S]*?background: transparent;[\s\S]*?box-shadow: none;/, "the executive framework must not use glowing AI-style action controls");
assert.match(landing, /function loadAppScript\(\)[\s\S]*?assets\/js\/app\.min\.js\?v=\$\{CONSOLE_REVISION\}/, "the minified console app must load only after an explicit console request");
assert.match(landing, /assets\/css\/styles\.min\.css\?v=\$\{CONSOLE_REVISION\}/, "minified console-only styling must load on demand");
assert.match(html, /location\.hash\.startsWith\("#console"\)[\s\S]*?consolePosterPreload[\s\S]*?memory-hero-poster\.webp/, "direct console and deep-link entry must discover the LCP poster during head parsing");
assert.match(landing, /function primeConsoleAssets\(\)[\s\S]*?consoleAppPreload[\s\S]*?consolePosterPreload/, "console assets must be primed in parallel before activation");
assert.match(landing, /await loadStylesheet\(\);[\s\S]*?activeConsoleLayer\.hidden = false;[\s\S]*?await loadConsole\(\);/, "the console must stay hidden until its stylesheet is ready");
assert.match(html, /id="consoleStaticSnapshot"[\s\S]*?SIGNAL[\s\S]*?DIAGNOSE[\s\S]*?KILL Criteria|id="consoleStaticSnapshot"[\s\S]*?Kill Criteria/, "direct console entry must expose an indexable decision snapshot instead of an empty loader");
assert.match(html, /#console\/c-level-cockpit\/hbm4-foundry[\s\S]*?#console\/c-level-cockpit\/post-hbm/, "the static console snapshot must expose stable decision deep links");
assert.match(landing, /function isConsoleHash\([\s\S]*?startsWith\(`\$\{CONSOLE_HASH\}\//, "the landing controller must keep console deep links inside the console view");
assert.match(app, /function consoleDeepLinkState\([\s\S]*?function applyConsoleDeepLink\(/, "the console must parse and apply section/item deep links");
assert.match(app, /id="cLevelCopyLink"[\s\S]*?copyTextToClipboard/, "executive agenda cards must expose a shareable link control");
assert.match(css, /\.main > section:not\(#overview\):not\(#strategy-consulting\) \{[\s\S]*?content-visibility:\s*auto;/, "below-fold console sections must skip initial layout and paint");
assert.match(landing, /nav\?\.classList\.toggle\("is-open", open\)/, "the mobile menu controller must activate the responsive navigation state");
assert.match(landing, /fetch\("data\/data-manifest\.json", \{ cache: "no-store" \}\)/, "the business site must disclose current manifest freshness");
for (const evidenceLabel of ["CONFIRMED", "RECONSTRUCTED", "HYPOTHESIS", "MODELED"]) {
  assert.match(html, new RegExp(evidenceLabel), `the portfolio must expose the ${evidenceLabel} evidence label`);
}
assert.match(html, /id="pain-framework"[\s\S]*?Business Pain → Root Bottleneck[\s\S]*?data-framework="edge"/, "the landing must provide a customer-selectable bottleneck-first diagnostic");
assert.match(landing, /function setupPainPointFramework\(\)[\s\S]*?data-framework-panel/, "the pain-point diagnostic must switch customer-specific panels");
assert.equal((html.match(/class="business-competency-card"/g) || []).length, 3, "the public portfolio must compress core competencies to three");
assert.match(html, /Customer Problem Structuring[\s\S]*?Full-Stack AI Infra Translation[\s\S]*?Executive Strategy &amp; Business Case/, "the three competencies must map directly to the target role");
assert.match(html, /id="initiatives"[\s\S]*?Bottleneck-First Consulting[\s\S]*?Serving &amp; Rack Architecture[\s\S]*?Custom Memory Co-Design/, "the hero must lead into three bottleneck-first strategic initiatives");
assert.doesNotMatch(html, /data-diagnostic-stage=|business-consulting-funnel|business-execution-roadmap/, "repeated diagnostic, funnel, and roadmap frameworks must be removed");
assert.match(html, /Business Outcome[\s\S]*?Workload \/ SLO[\s\S]*?System Symptom[\s\S]*?Dominant Bottleneck[\s\S]*?Benchmark \/ Economics[\s\S]*?매출 \/ 반복 발주/, "the public strategy chain must use one bottleneck-to-revenue loop");
assert.match(html, /AI Infra Decision Process · 10 Gates[\s\S]*?Co-Design \/ Qualification[\s\S]*?Risk \/ Readiness[\s\S]*?Capacity \/ 양산 확대/, "the consulting process must separate qualification/readiness from volume ramp");
assert.match(html, /What Would Change Our Mind\?/, "the strategy loop must expose an explicit decision-reversal board");
assert.match(html, /SLO·Quality·Goodput·System Economics가 합의 Baseline을 통과하지 못함/, "the strategy loop must define a baseline-relative technology kill criterion");
assert.match(html, /Qualification·Package\/Yield·Interoperability·Capacity가 합의 Readiness를 충족하지 못함/, "the strategy loop must define a baseline-relative supply kill criterion");
assert.match(html, /Committed Volume·지불의사·Reference 재사용성이 합의 사업성 기준에 미달/, "the strategy loop must define a baseline-relative commercial kill criterion");
assert.match(html, /RECONSTRUCTED · DECISION PACK[\s\S]*?CUSTOMER SITUATION[\s\S]*?BOTTLENECK TEST[\s\S]*?ARCHITECTURE OPTIONS[\s\S]*?EXECUTION GATES/, "solutions must show a strategy deliverable instead of another process diagram");
assert.match(html, /id="workload-map"[\s\S]*?TRAINING[\s\S]*?REAL-TIME INFERENCE[\s\S]*?BATCH INFERENCE[\s\S]*?ENTERPRISE RAG[\s\S]*?AI AGENT[\s\S]*?MULTIMODAL/, "the workload contract must cover six distinct workload families");
assert.match(html, /Performance[\s\S]*?per Watt[\s\S]*?Token \/ Query[\s\S]*?Total Cost of/, "technology options must connect to system-economics metrics");
assert.match(html, /id="macro"[\s\S]*?Competition &amp; Supply Chain[\s\S]*?글로벌 경쟁 · Packaging[\s\S]*?Policy &amp; Geopolitics/, "competition and policy must remain subordinate macro decision inputs");
assert.match(html, /id="team-operating-model"[\s\S]*?CUSTOMER STRATEGY[\s\S]*?NEW BUSINESS[\s\S]*?AI INFRA EXECUTION/, "the portfolio must expose the organization's three operating workstreams");
assert.match(html, /id="teamDecisionLoop"[\s\S]*?Customer \/ Market Signal[\s\S]*?PoC · Qualification · Ramp/, "the team operating model must connect signal to ramp");
assert.match(landing, /function renderOrganizationOperatingModel\(content = \{\}\)/, "the operating model must refresh from generated content");
assert.match(html, /id="tco-evidence"[\s\S]*?최신 검증 근거 연결 중[\s\S]*?판단 변경 KPI 연결 중/, "the worked case must start from a neutral current-data placeholder");
assert.match(landing, /function renderCurrentInsights\([\s\S]*?workedInsight\.latest\?\.url/, "the worked case must bind to a current verified source");
assert.doesNotMatch(html, /OBSERVABILITY GATE|AUTOMATED PILLAR COVERAGE|FLAGSHIP COLLABORATION MODEL · CURRENT RECORD/, "the three requested status panels must stay deleted");
assert.doesNotMatch(html, /\$500B\+|79\.3T|60\.5T|\+82%/, "time-sensitive partnership and performance claims must not be hardcoded in HTML");
assert.doesNotMatch(landing, /function renderPartnerContent\(|#aiFactoryCoverage|#decisionObservationRate/, "deleted panels must not retain rendering work");
assert.match(html, /id="memory-fabric"[\s\S]*?HBM4 · Custom HBM[\s\S]*?Host DRAM · SOCAMM2 · RDIMM\/MRDIMM[\s\S]*?CXL Capacity Tier[\s\S]*?High-capacity eSSD[\s\S]*?HBF Context Tier/, "the site must present maturity-aware full-stack memory tiers");
assert.match(html, /NAND\/eSSD를 독립 의사결정 축으로[\s\S]*?TLC eSSD[\s\S]*?HBF Option[\s\S]*?QLC eSSD/, "AI storage must be elevated to an equal performance, bandwidth, and density decision track");
assert.match(landing, /function renderCurrentInsights\([\s\S]*?business-execution-evidence-grid/, "the execution proofboard must be generated from current briefs");
assert.match(landing, /function renderCompetitorContent\([\s\S]*?content\.competitors/, "Right to Win must bind to same-run competitor metrics");
assert.doesNotMatch(html, /ANNOUNCEMENT[\s\S]*?LOI[\s\S]*?DEFINITIVE CONTRACT[\s\S]*?REVENUE RECOGNITION/, "the deleted flagship record must not return");
assert.doesNotMatch(html, /skhynix-nvidia-partnership-2026/, "the partnership must not retain the invalid SK hynix source URL");
assert.equal((html.match(/<div><span>0[1-4] · (?:PAGED|PREFILL|RACK-SCALE|RAG)/g) || []).length, 4, "tech insights must expose four change-to-decision cards");
assert.match(html, /<dt>FACT<\/dt>[\s\S]*?<dt>IMPLICATION<\/dt>[\s\S]*?<dt>DECISION QUESTION<\/dt>[\s\S]*?<dt>ACTION GATE<\/dt>/, "every technology card must close the consulting chain with an action gate");
assert.equal((html.match(/<article><span>0[1-6] · (?:ACCELERATOR|HYPERSCALER|SERVER|FOUNDRY|STORAGE|AI SERVING)/g) || []).length, 6, "partner strategy must cover six commercialization gates");
assert.match(html, /id="deep-cases"[\s\S]*?data-deep-case="agentic"[\s\S]*?data-deep-case="training"[\s\S]*?data-deep-case="rag"/, "the portfolio must expose three deep business cases");
assert.equal((html.match(/WHAT WOULD CHANGE MY MIND\?/g) || []).length, 3, "every deep case must declare decision reversal conditions");
assert.match(html, /Goodput·P99·Quality·System TCO[\s\S]*?Goodput·Utilization·Recovery·Qualification[\s\S]*?Recall\/Quality·Retrieval P99·Cost\/Query·Reliability/, "deep cases must declare baseline-relative decision triggers");
assert.match(landing, /function setupDeepCases\(\)[\s\S]*?data-deep-case-panel/, "deep-case tabs must switch the visible strategy case");
assert.match(html, /id="automation" aria-live="polite"[\s\S]*?FAIL-CLOSED[\s\S]*?businessDataIntegrity[\s\S]*?businessDataFreshness[\s\S]*?businessDataCoverage[\s\S]*?businessDecisionConfidence[\s\S]*?HYBRID REFRESH[\s\S]*?businessFreshnessScore[\s\S]*?id="businessDataSources"[\s\S]*?id="businessDataRun"/, "the public site must separate integrity, quantitative freshness, coverage, confidence, and traceable run");
assert.match(landing, /Status unavailable · fail-closed[\s\S]*?마지막 검증 Bundle 유지[\s\S]*?panel\.hidden = false/, "automation status failures must remain visible and fail closed");
assert.doesNotMatch(html, /console-data-health|Data Health · Decision Use Gate|DECISION OBJECT STANDARD/, "the redundant console data-health board must stay removed");
assert.doesNotMatch(app, /renderConsoleDataHealth|renderCrawlHeartbeat|crawlHeartbeat/, "removed console status panels must not retain rendering work");
assert.doesNotMatch(css, /\.console-data-health|\.crawl-heartbeat/, "removed console status panels must not retain unused styling");
assert.match(app, /function finalizeConsoleLoadingLabels\(\)[\s\S]*?LIVE DATA UNAVAILABLE/, "unresolved loading labels must become explicit fail-closed states");
assert.doesNotMatch(html, /Prompt Engineering/, "prompt engineering must not appear as a top-level AI memory theme");
assert.match(html, /aria-label="AI Infra 전략 질문"/, "the console question field must state its bounded AI Infra strategy purpose");
assert.match(landingCss, /\.business-reveal[\s\S]*?\.business-reveal\.is-visible/, "business sections should progressively reveal without blocking layout");
assert.match(landingCss, /\.business-insights \.business-section-heading--split > div \{[\s\S]*?min-width:\s*0;[\s\S]*?max-width:\s*100%;/, "the insight heading column must stay within its grid track");
assert.match(landingCss, /\.business-insights \.business-section-heading h2 \{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*100%;[\s\S]*?overflow-wrap:\s*break-word;/, "the issue-tree title must wrap instead of overflowing into the evidence column");

console.log(JSON.stringify({
  ok: true,
  routes: routes.length,
  sections: sectionOrder.size,
  lastRoute: routes.at(-1).id,
}, null, 2));
