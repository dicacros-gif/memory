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
  ["핵심 역량", "Business Strategy & Solutions", "Tech & Market Insights", "Data Lab"],
  "navigation should use the focused consulting information architecture",
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
assert.match(app, /\.filter\(\(\[id\]\) => id !== "community"\)/, "community heartbeat should be excluded from the executive summary");

assert.match(app, /const manifestPromise = loadDataManifest\(\);/, "critical manifest request must start early");
assert.match(app, /function updateScrollSpyFromGeometry\(\)/, "scroll spy must use cached geometry");
assert.match(app, /function observeDeferredSections\(definitions\)[\s\S]*?new IntersectionObserver[\s\S]*?rootMargin: "900px 0px"/, "deferred sections should hydrate shortly before entering the viewport");
assert.match(app, /void ensureDeferredSection\("strategy-consulting"\);/, "the first strategy section should be ready immediately after the hero");
assert.doesNotMatch(app, /hydrateDeferredSectionsSequentially|scheduleSequentialDeferredHydration/, "deep sections must not auto-hydrate in the background");
assert.match(css, /\.deferred-section\s*\{[\s\S]*?content-visibility:\s*auto;/, "offscreen sections must skip paint");
assert.doesNotMatch(css, /#(?:overview|strategy-consulting|overview-content)\s*\{[^}]*\border\s*:/, "opening sections must not be visually reordered with CSS");

const businessNavLabels = [...html.matchAll(/<nav class="business-nav"[\s\S]*?<\/nav>/g)]
  .flatMap((match) => [...match[0].matchAll(/<a href="#[^"]+">([^<]+)<\/a>/g)].map((link) => link[1]));
assert.deepEqual(businessNavLabels, [
  "Home",
  "Strategy",
  "Solutions",
  "Tech &amp; Market",
  "Partners &amp; Cases",
  "Macro Intel",
  "Role Fit",
], "the public site must expose the AI Infra strategy information architecture");
assert.match(html, /id="intelligenceConsole" hidden/, "the Intelligence Console must stay outside the initial visible layer");
assert.doesNotMatch(html, /<script[^>]+src="assets\/js\/app\.js/, "the heavy console app must not load with the public landing page");
assert.doesNotMatch(html, /<link[^>]+href="assets\/css\/styles\.css/, "the heavy console stylesheet must not load with the public landing page");
assert.match(html, /assets\/js\/landing\.js\?v=infra-20260815-04/, "the lightweight landing controller must use the AI Infra revision");
assert.match(landing, /function loadAppScript\(\)[\s\S]*?assets\/js\/app\.js\?v=\$\{CONSOLE_REVISION\}/, "the console app must load only after an explicit console request");
assert.match(landing, /assets\/css\/styles\.css\?v=\$\{CONSOLE_REVISION\}/, "console-only styling must load on demand");
assert.match(html, /location\.hash !== "#console"[\s\S]*?consolePosterPreload[\s\S]*?memory-hero-poster\.webp/, "direct console entry must discover its LCP poster during head parsing");
assert.match(landing, /function primeConsoleAssets\(\)[\s\S]*?consoleAppPreload[\s\S]*?consolePosterPreload/, "console assets must be primed in parallel before activation");
assert.match(landing, /await loadStylesheet\(\);[\s\S]*?consoleLayer\.hidden = false;[\s\S]*?await loadConsole\(\);/, "the console must stay hidden until its stylesheet is ready");
assert.match(css, /\.main > section:not\(#overview\):not\(#strategy-consulting\) \{[\s\S]*?content-visibility:\s*auto;/, "below-fold console sections must skip initial layout and paint");
assert.match(landing, /nav\?\.classList\.toggle\("is-open", open\)/, "the mobile menu controller must activate the responsive navigation state");
assert.match(landing, /fetch\("data\/data-manifest\.json", \{ cache: "no-store" \}\)/, "the business site must disclose current manifest freshness");
assert.match(html, /PUBLIC CASE RECONSTRUCTION[\s\S]*?HYPOTHETICAL STRATEGY CASE/, "public facts and strategy simulations must use explicit case labels");
assert.match(html, /id="pain-framework"[\s\S]*?Customer Pain Point Framework[\s\S]*?data-framework="edge"/, "the landing must provide a customer-selectable pain-point diagnostic");
assert.match(landing, /function setupPainPointFramework\(\)[\s\S]*?data-framework-panel/, "the pain-point diagnostic must switch customer-specific panels");
assert.match(html, /Customer Pain Point[\s\S]*?AI Workload[\s\S]*?System Bottleneck[\s\S]*?Memory Requirement[\s\S]*?Qualification &amp; Ramp[\s\S]*?Executive Decision \/ KPI/, "the public strategy chain must connect diagnosis to execution");
assert.match(html, /id="workload-map"[\s\S]*?Large-scale Training[\s\S]*?Long-context \/ Agentic AI[\s\S]*?Physical AI/, "the representative workload-to-memory map must cover five workload families");
assert.match(html, /Performance[\s\S]*?per Watt[\s\S]*?Token \/ Query[\s\S]*?Total Cost of/, "technology options must connect to system-economics metrics");
assert.match(html, /id="macro"[\s\S]*?China Memory &amp; Supply Chain[\s\S]*?Policy &amp; Geopolitics/, "China and policy must remain subordinate macro decision inputs");
assert.match(html, /id="role-fit"[\s\S]*?Strategic Problem Solving[\s\S]*?AI Infra Execution Strategy/, "the portfolio must make role fit and execution capabilities explicit");
assert.match(html, /https:\/\/news\.skhynix\.com\/en\/hbf-at-fms-2026\//, "the HBF evidence case must link to the official primary source");
assert.match(html, /FLAGSHIP COLLABORATION MODEL[\s\S]*?ANNOUNCED · LOI[\s\S]*?\$500B\+[\s\S]*?2 GW/, "the NVIDIA partnership must be framed as an announced SK Group initiative with stage status");
assert.match(html, /SK하이닉스 단독 계약액이나 확정 매출이 아니라/, "the flagship partnership must distinguish initiative scope from SK hynix revenue");
assert.match(html, /id="memory-fabric"[\s\S]*?HBM4 · Custom HBM[\s\S]*?AI-DRAM · SOCAMM · CXL[\s\S]*?AI-NAND · HBF · eSSD/, "the site must present a full-stack tiered memory architecture");
assert.match(html, /https:\/\/news\.skhynix\.com\/en\/fms-2026\//, "the tiered-memory architecture must link to the official FMS source");
assert.match(html, /2Q26 AI Memory Execution[\s\S]*?₩79\.3T[\s\S]*?₩60\.5T[\s\S]*?76%/, "the execution proofboard must include the official Q2 scale evidence");
assert.match(html, /Custom Memory Beyond HBM[\s\S]*?HBM → DRAM · NAND/, "custom memory must extend across the full portfolio");
assert.match(html, /Custom ASIC Diversification[\s\S]*?\+82%[\s\S]*?1\/3/, "the ASIC diversification signal must retain its forecast context");
assert.match(html, /<aside class="business-data-status" aria-live="polite" hidden>/, "public data status placeholders must stay hidden until verified data arrives");
assert.doesNotMatch(html, /데이터 상태 확인 중|>확인 중</, "unfinished data-loading copy must not ship in public markup");
assert.doesNotMatch(html, /Prompt Engineering/, "prompt engineering must not appear as a top-level AI memory theme");
assert.match(html, /aria-label="Evidence Search"/, "the console evidence field must not imply unsupported generative Q&A");
assert.match(landingCss, /\.business-reveal[\s\S]*?\.business-reveal\.is-visible/, "business sections should progressively reveal without blocking layout");

console.log(JSON.stringify({
  ok: true,
  routes: routes.length,
  sections: sectionOrder.size,
  lastRoute: routes.at(-1).id,
}, null, 2));
