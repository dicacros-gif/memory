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

assert.equal(routes.length, 7, "sidebar routes should cover the seven active SK hynix AI Infra work areas");
assert.equal(new Set(routes.map((route) => route.id)).size, routes.length, "route ids must be unique");
assert.equal(new Set(routes.map((route) => route.jump)).size, routes.length, "route landmarks must be unique");
assert.deepEqual(
  routes.slice(0, 2).map((route) => route.id),
  ["biz-consulting", "c-level"],
  "the console must start with customer diagnosis followed by executive decision",
);
assert.deepEqual(
  routes.slice(0, 2).map((route) => route.jump),
  ["strategy-consulting", "c-level-cockpit"],
  "the first tab targets must match the right-hand document order",
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
assert.equal(routes.at(-1).id, "ecosystem", "Partner ecosystem must remain at the bottom");
assert.deepEqual(
  routes.map((route) => route.label),
  ["고객 문제", "경영 판단", "솔루션 설계", "시장 인사이트", "신규 Biz", "수요·사례", "협력 생태계"],
  "left navigation must stay MECE and show only the decision-critical labels",
);
assert.deepEqual(
  groups.map((group) => group.label),
  ["판단 기준", "실행 영역"],
  "navigation groups must separate decision inputs from execution domains",
);
for (const retiredRoute of ["executive-summary", "policy", "china-workforce", "competitors", "talent", "workbench", "market-map", "strategy-actions", "stock"]) {
  assert.ok(!routes.some((route) => route.id === retiredRoute), `retired route must stay removed: ${retiredRoute}`);
}
for (const retiredSection of ["overview-content", "policy-makers", "china-fab-infra", "china-talent-strategy", "china-community", "china-nand", "china-dynamics", "talent-radar", "workbench", "memory-market-map", "china-deep-dive"]) {
  assert.match(html, new RegExp(`id="${retiredSection}"[^>]*\\shidden(?:\\s|>)`), `retired section must remain hidden: ${retiredSection}`);
}
assert.doesNotMatch(html, /CEO 챌린지|id="ceoChallengeSelect"|id="ceoAgentAnswer"/, "the casual CEO challenge must not appear in the executive board");
assert.doesNotMatch(app, /id: "china-dram"/, "China DRAM decision axis should be retired");
assert.doesNotMatch(app, /id: "china",\s+accent: "#DB2777"/, "China consulting lens should be retired");
assert.match(app, /const manifestPromise = loadDataManifest\(\);/, "critical manifest request must start early");
assert.match(app, /function schedulePolicyArtifacts\(\)[\s\S]*?loadJSON\("data\/crawl-audit\.json"[\s\S]*?loadJSON\("data\/crawl-exclusions\.json"[\s\S]*?requestIdleCallback/, "the evidence audit must load after the decision control plane is interactive");
assert.match(app, /function updateScrollSpyFromGeometry\(\)/, "scroll spy must use cached geometry");
assert.match(app, /function scheduleProgressiveDeferredSections\(definitions\)[\s\S]*?const first = queue\[cursor\+\+\][\s\S]*?preloadDeferredSectionData\(first\.id\)\.finally/, "deferred route data should prewarm without rendering hidden boards");
assert.match(app, /function setupRouteAccordions\(\)[\s\S]*?routePanelNodes\.set[\s\S]*?console-route-toggle[\s\S]*?setActiveRoutePanel/, "left navigation routes must own foldable right-hand panels");
assert.match(app, /toolbar\.hidden = false;[\s\S]*?node\.classList\.remove\("console-route-inactive"\)/, "all route panels must remain in the natural right-hand scroll stream");
assert.match(app, /function jumpTo\(id\)[\s\S]*?setActiveRoutePanel\(id, \{ expand: true \}\)[\s\S]*?await ensureDeferredSection\(id, \{ refreshGeometry: false \}\)/, "a route panel must open before its deferred data finishes rendering");
assert.match(app, /function ensureRouteDeferredSections\(id\)[\s\S]*?routeDeferredSectionIds\(id\)[\s\S]*?await ensureDeferredSection\(ids\[index\], \{ refreshGeometry: false \}\)/, "all boards owned by the active route must hydrate without scrolling");
assert.match(app, /function updateScrollSpyFromGeometry\(\)[\s\S]*?syncSidebarRoute\(navTarget, \{ reveal: true \}\)[\s\S]*?\[activeIndex, activeIndex \+ 1\][\s\S]*?ensureRouteDeferredSections\(route\.jump\)/, "right-hand scrolling must update the left tab and hydrate the next route ahead");
assert.match(app, /const prewarm = \(\) => prewarmRoutePanel[\s\S]*?pointerenter[\s\S]*?pointerdown/, "navigation intent must prewarm the selected route without waiting for a click-render round trip");
assert.match(css, /\.console-route-collapsed\s*\{\s*display:\s*none !important;/, "only explicitly folded route content may leave the natural scroll layout");
assert.match(css, /\.console-route-toggle\s*\{[\s\S]*?transition:\s*none;[\s\S]*?\.console-route-toggle:hover,/, "route folding must react without a delayed transition");
assert.doesNotMatch(app, /function observeDeferredSections\(|rootMargin: "900px 0px"/, "deferred loading must not wait for viewport intersection");
assert.match(css, /\.deferred-section\s*\{[\s\S]*?content-visibility:\s*auto;/, "offscreen sections must skip paint");
assert.doesNotMatch(css, /#(?:overview|strategy-consulting|overview-content)\s*\{[^}]*\border\s*:/, "opening sections must not be visually reordered with CSS");
assert.match(css, /\.sb-item,\s*\.sb-cat\s*\{[\s\S]*?background-color 0s, color 0s;/, "sidebar inversion colours must switch without interpolation");
assert.match(css, /#intelligenceConsole \.sb-item:is\(:hover, :focus-visible, :focus-within\)[\s\S]*?animation:\s*none !important;/, "sidebar hover motion must not reuse delayed entrance animation");
assert.match(css, /#intelligenceConsole \.sb-cat:is\(:hover, :focus-visible, :focus-within\)[\s\S]*?animation:\s*none !important;/, "sidebar category inversion must not reuse delayed entrance animation");
assert.doesNotMatch(css, /@keyframes sb-(?:tab-lift|label-bounce)/, "retired slow sidebar hover keyframes must stay removed");
assert.match(css, /Site-wide instant inversion contract[\s\S]*?animation-delay:\s*0s !important;/, "console hover descendants must never inherit stagger delays");
assert.match(landingCss, /Site-wide instant inversion contract[\s\S]*?animation-delay:\s*0s !important;/, "landing hover descendants must never inherit stagger delays");
assert.match(app, /btn\.removeAttribute\("title"\);[\s\S]*?btn\.dataset\.tooltip = label;/, "sidebar navigation must not use delayed native title tooltips");

const businessNavLabels = [...html.matchAll(/<nav class="business-nav"[\s\S]*?<\/nav>/g)]
  .flatMap((match) => [...match[0].matchAll(/<a href="#[^"]+">([^<]+)<\/a>/g)].map((link) => link[1]));
assert.deepEqual(businessNavLabels, [
  "Home",
  "Customer Pain",
  "Workload Solutions",
  "New Biz",
  "Tech &amp; Market",
  "Partners &amp; Cases",
  "Execution Model",
], "the public site must expose the AI Infra strategy information architecture");
assert.match(html, /business-console-label--full">Open Intelligence Console<\/span>[\s\S]*?business-console-label--short"[^>]*>Console<\/span>/, "the header CTA must expose full and compact non-overlapping labels");
assert.match(landingCss, /body\.landing-mode\s*\{[^}]*margin:\s*0;[^}]*max-width:\s*100%;[^}]*overflow-x:\s*clip;/, "the public page must stay within the viewport width without the browser's default body margin");
assert.match(landingCss, /\.business-container\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*100%;[^}]*padding-inline:\s*clamp\(24px, 4vw, 72px\);/, "every landing section must use the full viewport width with responsive gutters");
assert.match(landingCss, /\.business-site :is\(img, picture, video, svg, canvas, iframe, table\)\s*\{[^}]*max-width:\s*100%;/, "site media and data visuals must respect max-width 100%");
assert.doesNotMatch(html, /business-contract-funnel/, "the removed partnership spotlight funnel must stay deleted");
assert.match(landingCss, /\.business-header\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*100%;[^}]*grid-template-columns:\s*auto minmax\(0, 1fr\) auto;/, "the fixed header must use a shrink-safe full-width grid");
assert.match(landingCss, /@media \(max-width: 1600px\)[\s\S]*?\.business-console-label--full\s*\{[^}]*display:\s*none;[\s\S]*?\.business-console-label--short\s*\{[^}]*display:\s*inline;/, "the console CTA must shorten before it can collide with navigation");
assert.match(landingCss, /@media \(max-width: 1120px\)[\s\S]*?\.business-menu-button\s*\{[^}]*display:\s*grid;[\s\S]*?\.business-nav\s*\{[^}]*position:\s*absolute;[^}]*display:\s*none;/, "medium-width navigation must collapse before header items overlap");
assert.match(html, /id="intelligenceConsole" hidden/, "the Intelligence Console must stay outside the initial visible layer");
assert.doesNotMatch(html, /<script[^>]+src="assets\/js\/app\.js/, "the heavy console app must not load with the public landing page");
assert.doesNotMatch(html, /<link[^>]+href="assets\/css\/styles\.css/, "the heavy console stylesheet must not load with the public landing page");
assert.match(html, /assets\/js\/landing\.min\.js\?v=infra-[a-f0-9]{12}/, "the lightweight landing controller must use the minified AI Infra revision");
assert.doesNotMatch(html, /LIVE DECISION QUEUE · CONSOLE-CONNECTED|businessHomeQueueStatus/, "the removed live decision queue header must stay deleted");
const homepageDecisionQueue = html.match(/<div class="business-decision-queue-grid"[\s\S]*?<\/div>/)?.[0] || "";
assert.doesNotMatch(homepageDecisionQueue, /<small>OUTPUT ·/, "the removed homepage decision output row must stay deleted");
assert.doesNotMatch(html, /을 하나의 답안으로 연결/, "the removed decision-lab heading suffix must stay deleted");
assert.match(landingCss, /\.business-hero-actions :is\(a, button\)\s*\{[^}]*min-height:\s*48px;[^}]*line-height:\s*1\.35;[^}]*overflow:\s*visible;/, "hero actions must preserve complete text glyphs at every zoom level");
assert.match(landingCss, /@media \(max-width: 1200px\)[\s\S]*?\.business-decision-queue\s*\{[^}]*position:\s*relative;/, "the decision queue must leave the overlay layer before it can cover hero actions");
assert.doesNotMatch(html, /DEPARTMENT DECISION SYSTEM|business-visual-head/, "the removed hero decision-status header must stay deleted");
assert.doesNotMatch(html, /DEPARTMENT OUTPUT|business-visual-result/, "the removed hero department-output card must stay deleted");
assert.doesNotMatch(html, /business-decision-data-note|decisionDataDot|decisionDataStatus|decisionDataUpdated/, "the removed Console verified status bar must stay deleted");
assert.doesNotMatch(html, /원문 문장·날짜·제품 Stage 없으면 승격하지 않음/, "the removed evidence-promotion sentence must stay deleted");
const decisionAutomationSection = html.match(/<section class="business-section business-decision-automation"[\s\S]*?<\/section>/)?.[0] || "";
assert.doesNotMatch(decisionAutomationSection.match(/^<section[^>]*>/)?.[0] || "", /data-frame=/, "the removed Decision Automation frame label must stay deleted");
const decisionEvidenceLoader = landing.match(/async function loadDecisionEvidence\(\)[\s\S]*?\n  \}/)?.[0] || "";
assert.doesNotMatch(decisionEvidenceLoader, /if \(!status\) return;/, "removing the status bar must not stop decision-data refresh");
assert.match(decisionEvidenceLoader, /if \(status\) status\.textContent/, "the optional deleted status node must remain safely guarded");
assert.doesNotMatch(html, />[^<]*\bOS\b[^<]*</, "standalone OS wording must not appear in public landing copy");
assert.match(html, /class="business-footer"[\s\S]*?href="https:\/\/www\.linkedin\.com\/in\/dicacross\/"[\s\S]*?© 2026 dicacross · Independent strategy portfolio based on public information/, "the public portfolio credit must link to the dicacross LinkedIn profile");
assert.doesNotMatch(html, /메모리를 판매하는 것이 아니라/, "the removed sales-negation headline must stay deleted");
assert.doesNotMatch(html, /직무 적합성을 세 가지|검증 가능한 역량으로 압축합니다/, "the removed role-fit headline must stay deleted");
assert.doesNotMatch(html, /SK hynix AI Infra에서 만들고 싶은/, "the removed aspiration heading must stay deleted");
assert.doesNotMatch(html, /Memory Strategy 조직은 전망을 만드는 데서 끝나지 않습니다/, "the removed narrative sentence must stay deleted");
assert.doesNotMatch(html, /data-frame="McKINSEY · THREE HORIZONS"/, "the removed Three Horizons frame label must stay deleted");
assert.match(html, /class="business-initiative-foundation"/, "the initiative infographic must include a visible foundation layer");
assert.match(html, /data-frame="BAIN · RESULTS DELIVERY"/, "the capability system must expose its results-delivery frame");
assert.doesNotMatch(html, /id="decision-lab"[^>]*data-frame=/, "the removed decision-lab frame label must stay absent");
assert.doesNotMatch(html, /data-frame="BCG · 2×2 SCENARIO MATRIX"/, "the removed scenario-matrix frame label must stay deleted");
assert.match(html, /Hypothesis → Test → Trigger → Decision/, "deep cases must show the decision-validation sequence");
assert.match(landing, /function setupInfographicSequence\(\)/, "the landing controller must stagger infographic sequences");
assert.match(landingCss, /@keyframes consultingArrowPulse/, "the infographic system must animate directional flow");
assert.match(app, /id: "executive-decision"[\s\S]*?render: renderExecutiveDecision[\s\S]*?data: \["decisionHistory"\]/, "Technology & Memory must use the compact decision bundle");
assert.match(app, /path: "data\/decision-history-client\.json"/, "the compact decision history artifact must be loaded on demand");
assert.match(app, /function setupDecisionHistoryPreload\(\)/, "Technology & Memory history must prewarm on navigation intent and idle time");
assert.match(app, /BACKTEST_YEAR_OPTIONS_CACHE[\s\S]*?BACKTEST_CLOSE_CACHE/, "Technology & Memory must cache repeated backtest option scans");
assert.match(app, /section\.dataset\.deferredDataMs[\s\S]*?section\.dataset\.deferredRenderMs/, "deferred performance timings must remain observable in the DOM");
assert.match(app, /Move to the reserved framework shell immediately[\s\S]*?alignTarget\(\);[\s\S]*?await ensureDeferredSection\(id, \{ refreshGeometry: false \}\)/, "deferred navigation must reveal its reserved shell before waiting for data");
assert.match(html, /class="decision-loading-framework"[\s\S]*?01<\/b> SIGNAL[\s\S]*?05<\/b> ACTION/, "Technology & Memory must expose a consulting-framework loading shell");
assert.match(html, /exec-backtest-memory-wave-960\.webp/, "the decision board must use the responsive backtest image");
assert.match(css, /Executive consulting geometry system[\s\S]*?\.consulting-system \.sc-card \{[\s\S]*?border-top: 1px solid var\(--line\);[\s\S]*?box-shadow: none;/, "strategy cards must remove colored top rails and glow shadows");
assert.match(css, /Professional consulting infographic — dark decision canvas[\s\S]*?clip-path:polygon\(0 0,calc\(100% - 18px\)[\s\S]*?transform:translateY\(-2px\) !important;/, "console strategy matrices must use angular infographic frames with restrained motion");
assert.doesNotMatch(app, /class="[^"]*\bsc-(?:card|partner|tech-card|pillar-card|asic-priority-card)\b[^"]*"[^>]*style="--(?:sc|asic)-accent/, "strategy cards must not receive per-card decorative accent rails");
assert.match(css, /\.consulting-system \.sc-card-flow \{[\s\S]*?grid-template-columns: 1\.18fr 1fr 1fr 1\.14fr 1\.24fr;/, "opportunity cards must use a five-step decision map");
assert.match(css, /#execDecisionRunCouncil[\s\S]*?background: transparent;[\s\S]*?box-shadow: none;/, "the executive framework must not use glowing AI-style action controls");
assert.match(landing, /function loadAppScript\(\)[\s\S]*?assets\/js\/app\.min\.js\?v=\$\{CONSOLE_REVISION\}/, "the minified console app must load only after an explicit console request");
assert.match(landing, /assets\/css\/styles\.min\.css\?v=\$\{CONSOLE_REVISION\}/, "minified console-only styling must load on demand");
assert.match(html, /location\.hash\.startsWith\("#console"\)[\s\S]*?consoleStylesPreload[\s\S]*?consoleAppPreload/, "direct console and deep-link entry must discover the console bundles during head parsing");
assert.match(html, /consolePosterPreload[\s\S]*?memory-hero-poster\.webp/, "the persistent opening image must be preloaded for direct console entry");
assert.match(landing, /function primeConsoleAssets\(\)[\s\S]*?consoleStylesPreload[\s\S]*?consoleAppPreload/, "console bundles must be primed in parallel before activation");
assert.match(landing, /function primeConsoleAssets\(\)[\s\S]*?consolePosterPreload[\s\S]*?memory-hero-poster\.webp/, "console warmup must include the persistent opening image");
assert.match(landing, /const consoleReady = loadConsole\(\);[\s\S]*?await loadStylesheet\(\);[\s\S]*?activeConsoleLayer\.hidden = false;[\s\S]*?finishConsoleStartup\(\);[\s\S]*?await consoleReady;/, "the styled console shell must appear while data hydration continues");
assert.match(html, /id="consoleStaticSnapshot"[\s\S]*?SIGNAL[\s\S]*?DIAGNOSE[\s\S]*?KILL Criteria|id="consoleStaticSnapshot"[\s\S]*?Kill Criteria/, "direct console entry must expose an indexable decision snapshot instead of an empty loader");
assert.match(html, /#console\/c-level-cockpit\/hbm4-foundry[\s\S]*?#console\/c-level-cockpit\/post-hbm/, "the static console snapshot must expose stable decision deep links");
assert.equal((html.match(/<h1\b/g) || []).length, 1, "the document must expose exactly one H1");
assert.match(html, /class="tb-title"[\s\S]*?id="consoleExit"[\s\S]*?← Site<\/button>[\s\S]*?<h2>AI Infra Strategy<\/h2>/, "the Site control and console title must share one title group");
assert.doesNotMatch(html, /SK hynix AI Infra Strategy Console/, "the compact console title must not repeat the SK hynix label");
assert.match(css, /\.tb-title \{[\s\S]*?display:\s*flex;[\s\S]*?align-items:\s*center;[\s\S]*?gap:\s*8px;/, "the Site control and console title must render on one row");
assert.match(landing, /function isConsoleHash\([\s\S]*?startsWith\(`\$\{CONSOLE_HASH\}\//, "the landing controller must keep console deep links inside the console view");
assert.match(app, /function consoleDeepLinkState\([\s\S]*?function applyConsoleDeepLink\(/, "the console must parse and apply section/item deep links");
assert.doesNotMatch(app, /cLevelCopyLink|copyTextToClipboard|data-(?:agent|advanced|number|talent|work|decision|infra|inspector|investment|nand|policy|projection)-copy/, "the console must not render clipboard controls");
assert.match(app, /function aiInfraCouncilDeepLink\([\s\S]*?syncAiInfraCouncilDeepLink/, "agenda selection must keep a stable URL without a copy control");
assert.match(css, /\.main > section:not\(#overview\):not\(#strategy-consulting\) \{[\s\S]*?content-visibility:\s*auto;/, "below-fold console sections must skip initial layout and paint while the opening visual stays fully rendered");
assert.match(landing, /nav\?\.classList\.toggle\("is-open", open\)/, "the mobile menu controller must activate the responsive navigation state");
assert.match(landing, /fetch\("data\/data-manifest\.json", \{ cache: force \? "reload" : "no-cache" \}\)/, "the business site must revalidate the current manifest without disabling repeat-visit caching");
for (const evidenceLabel of ["HYPOTHESIS", "MODELED"]) {
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
assert.match(html, /id="solutions"[\s\S]*?CUSTOMER SITUATION[\s\S]*?BOTTLENECK TEST[\s\S]*?ARCHITECTURE OPTIONS[\s\S]*?EXECUTION GATES/, "solutions must retain the strategy deliverable after removing its decorative header");
assert.match(html, /id="workload-map"[\s\S]*?TRAINING[\s\S]*?REAL-TIME INFERENCE[\s\S]*?BATCH INFERENCE[\s\S]*?ENTERPRISE RAG[\s\S]*?AI AGENT[\s\S]*?MULTIMODAL/, "the workload contract must cover six distinct workload families");
assert.match(html, /Performance[\s\S]*?per Watt[\s\S]*?Token \/ Query[\s\S]*?Total Cost of/, "technology options must connect to system-economics metrics");
assert.match(html, /id="macro"[\s\S]*?Competition &amp; Supply Chain[\s\S]*?글로벌 경쟁 · Packaging[\s\S]*?Policy &amp; Geopolitics/, "competition and policy must remain subordinate macro decision inputs");
assert.match(html, /id="team-operating-model"[\s\S]*?CUSTOMER STRATEGY[\s\S]*?WORKLOAD OPTIMIZATION[\s\S]*?NEW BIZ &amp; INSIGHTS[\s\S]*?PARTNERS &amp; EXECUTION/, "the portfolio must expose the organization's four MECE operating workstreams");
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
const competitorRenderer = landing.match(/function renderCompetitorContent\(content = \{\}\)[\s\S]*?\n  \}/)?.[0] || "";
assert.doesNotMatch(competitorRenderer, /item\.dataStatus|<dt>SOURCES<\/dt>|<dt>AS OF<\/dt>/, "competitor cards must not repeat shared status, source count, or period metadata");
assert.doesNotMatch(html, /ANNOUNCEMENT[\s\S]*?LOI[\s\S]*?DEFINITIVE CONTRACT[\s\S]*?REVENUE RECOGNITION/, "the deleted flagship record must not return");
assert.doesNotMatch(html, /skhynix-nvidia-partnership-2026/, "the partnership must not retain the invalid SK hynix source URL");
assert.equal((html.match(/<div><span>0[1-4] · (?:PAGED|PREFILL|RACK-SCALE|RAG)/g) || []).length, 4, "tech insights must expose four change-to-decision cards");
assert.match(html, /<dt>FACT<\/dt>[\s\S]*?<dt>IMPLICATION<\/dt>[\s\S]*?<dt>DECISION QUESTION<\/dt>[\s\S]*?<dt>ACTION GATE<\/dt>/, "every technology card must close the consulting chain with an action gate");
assert.equal((html.match(/<article><span>0[1-6] · (?:ACCELERATOR|HYPERSCALER|SERVER|FOUNDRY|STORAGE|AI SERVING)/g) || []).length, 6, "partner strategy must cover six commercialization gates");
assert.match(html, /id="deep-cases"[\s\S]*?data-deep-case="agentic"[\s\S]*?data-deep-case="training"[\s\S]*?data-deep-case="rag"/, "the portfolio must expose three deep business cases");
assert.equal((html.match(/WHAT WOULD CHANGE MY MIND\?/g) || []).length, 3, "every deep case must declare decision reversal conditions");
assert.match(html, /Goodput·P99·Quality·System TCO[\s\S]*?Goodput·Utilization·Recovery·Qualification[\s\S]*?Recall\/Quality·Retrieval P99·Cost\/Query·Reliability/, "deep cases must declare baseline-relative decision triggers");
assert.match(landing, /function setupDeepCases\(\)[\s\S]*?data-deep-case-panel/, "deep-case tabs must switch the visible strategy case");
assert.doesNotMatch(html, /id="automation"|businessFreshnessBoard|AUTOMATED · FAIL-CLOSED INTELLIGENCE LOOP/, "the removed automation status board must stay deleted");
for (const removedVisual of [
  /HTML에는 최신 경영진 답안/,
  /진단 항목은 실제 고객 성과/,
  /RECONSTRUCTED · DECISION PACK/,
  /공개 사실 기반 재구성 전략 산출물/,
  /CURRENT VERIFIED SIGNALS/,
  /id="aiFactoryEvidenceNote"/,
  /id="workloadOptimizationThesis"/,
  /id="ragLiveControl"/,
  /id="ragQualityKpis"/,
  /business-collaboration-models/,
  /id="caseClassification"/,
  /data-frame="(?:BCG · STRATEGY PALETTE|ECOSYSTEM MAP · COMMERCIAL GATES|TEAM OPERATING MODEL · 3 WORKSTREAMS)"/,
  /Organization Mandate · Repeatable Decisions/,
  /External Context · Decision Input/,
]) assert.doesNotMatch(html, removedVisual, `removed screenshot content must stay deleted: ${removedVisual}`);
assert.doesNotMatch(landing, /decision-os-brief-meta|<small>KILL CRITERIA<\/small>/, "decision cards must not recreate deleted metadata and kill rows");
assert.doesNotMatch(landing, /updateDataStatus|applyDecisionControl|renderCaseClassification/, "deleted visual controls must not retain dead rendering work");
assert.doesNotMatch(html, /console-data-health|Data Health · Decision Use Gate|DECISION OBJECT STANDARD/, "the redundant console data-health board must stay removed");
assert.doesNotMatch(app, /renderConsoleDataHealth|renderCrawlHeartbeat|crawlHeartbeat/, "removed console status panels must not retain rendering work");
assert.doesNotMatch(css, /\.console-data-health|\.crawl-heartbeat/, "removed console status panels must not retain unused styling");
assert.match(app, /function finalizeConsoleLoadingLabels\(\)[\s\S]*?선택 인사이트 최신화[\s\S]*?선택 인사이트 업데이트 확인/, "unresolved loading labels must show an audience-facing insight state without crawl counters");
assert.doesNotMatch(app, /현재 실행에서 승격 근거 없음|Reference only|LIVE DATA UNAVAILABLE|Decision use disabled/, "empty-state metadata must not expose internal promotion jargon or English failure copy");
assert.doesNotMatch(html, /Prompt Engineering/, "prompt engineering must not appear as a top-level AI memory theme");
assert.match(html, /aria-label="AI Infra 전략 질문"/, "the console question field must state its bounded AI Infra strategy purpose");
assert.match(landingCss, /\.business-reveal[\s\S]*?\.business-reveal\.is-visible/, "business sections should progressively reveal without blocking layout");
assert.match(landingCss, /\.business-insights \.business-section-heading--split > div \{[\s\S]*?min-width:\s*0;[\s\S]*?max-width:\s*100%;/, "the insight heading column must stay within its grid track");
assert.match(landingCss, /\.business-insights \.business-section-heading h2 \{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*100%;[\s\S]*?overflow-wrap:\s*break-word;/, "the issue-tree title must wrap instead of overflowing into the evidence column");
assert.match(landingCss, /\.business-module-heading--evidence\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*100%;[^}]*grid-template-columns:\s*minmax\(220px, \.72fr\) minmax\(0, 1\.6fr\) minmax\(300px, 1fr\);/, "the evidence ladder heading must use the full row without clipping any column");
assert.match(landingCss, /\.business-site main :where\(p, dd\)\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*100%;/, "body copy must be allowed to use its full grid track");

console.log(JSON.stringify({
  ok: true,
  routes: routes.length,
  sections: sectionOrder.size,
  lastRoute: routes.at(-1).id,
}, null, 2));
