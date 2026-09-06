#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CONSOLE_ROUTE_IDS, CONSOLE_ROUTE_LANDMARKS, readConsoleRoutes } from "./console-route-contract.mjs";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const app = await read("../assets/js/app.js");
const html = await read("../index.html");
const landing = await read("../assets/js/landing.js");
const css = await read("../assets/css/styles.css");

const routes = readConsoleRoutes(app);
const groupLiteral = app.match(/const SIDE_NAV_GROUPS = (\[[\s\S]*?\]);\s*const SIDE_NAV_ICONS/)?.[1];
assert.ok(groupLiteral, "sidebar group table must be readable");
const groups = Function(`"use strict"; return (${groupLiteral});`)();

assert.equal(routes.length, 8, "the investor console must have seven decision stages and one source-data stage");
assert.deepEqual(routes.map((route) => route.id), CONSOLE_ROUTE_IDS,
  "stable route ids must remain compatible with saved console links");
assert.deepEqual(routes.map((route) => route.jump), CONSOLE_ROUTE_LANDMARKS,
  "route landmarks must follow the investor decision journey");
assert.deepEqual(routes.map((route) => route.label), [
  "시장·사이클",
  "국가별 종목",
  "투자 밸류체인",
  "수요·실적 전환",
  "기술·경쟁 구도",
  "밸류에이션·리스크",
  "투자 판단",
  "가격·원문 데이터",
]);

const sectionIds = new Set([...html.matchAll(/<(?:main|section)\b[^>]*\bid="([^"]+)"/g)].map((match) => match[1]));
const owned = [];
for (const route of routes) {
  assert.equal(route.sections[0], route.jump, `${route.id} must begin at its own landmark`);
  assert.ok(sectionIds.has(route.jump), `missing investor route target: ${route.jump}`);
  for (const section of route.sections) {
    assert.ok(sectionIds.has(section), `missing owned section: ${route.id} → ${section}`);
    owned.push(section);
  }
}
assert.equal(new Set(owned).size, owned.length, "each visible investor board must have exactly one route owner");

assert.deepEqual(groups.map((group) => group.label), ["시장 · Market", "비교 · Compare", "판단 · Decide", "원자료 · Data"],
  "sidebar groups must use investor language");
assert.deepEqual(groups.flatMap((group) => group.routes), CONSOLE_ROUTE_IDS,
  "sidebar groups must preserve the full route order");
assert.deepEqual(routes.at(-1).sections, ["prices", "news"],
  "TrendForce pricing and source news must close the console in tab 8");

assert.match(html, /id="consoleStaticSnapshot"[\s\S]*?MARKET CYCLE[\s\S]*?EQUITY UNIVERSE[\s\S]*?VALUE CHAIN[\s\S]*?SOURCE DATA/,
  "direct console entry must expose an indexable investor summary");
assert.match(html, /class="sb-logo"[^>]*data-jump="investor-overview"/,
  "the neutral brand control must return to the investor overview");
assert.match(html, /class="tb-title"[\s\S]*?id="consoleExit"[\s\S]*?Semiconductor Equity Intelligence/,
  "the console title must state its investment purpose");
assert.doesNotMatch(html, /<img class="sb-mark"|brands\/sk-hynix\.svg/,
  "site chrome must not retain the former issuer logo");

for (const legacyId of ["strategy-consulting", "visual-bridge-system", "c-level-cockpit", "visual-bridge-execution", "memory-visual-story", "memory-scroll-story", "projection", "numbers", "hyperscaler-demand", "ai-matrix"]) {
  assert.match(html, new RegExp(`id="${legacyId}"[^>]*\\bhidden\\b`), `${legacyId} must stay outside the investor navigation`);
}

assert.match(app, /function reorderRoutePanels\(main\)[\s\S]*?SIDE_NAV_ROUTES\.forEach[\s\S]*?createDocumentFragment/,
  "runtime boards must be physically reordered to the same sequence as the sidebar");
assert.match(app, /function consoleDeepLinkState\([\s\S]*?function applyConsoleDeepLink\(/,
  "investor boards must retain stable console deep links");
assert.match(app, /aria-controls="\$\{escapeHTML\(nodes\.map\([\s\S]*?aria-label="\$\{escapeHTML\(route\.label\)\} 접기"/,
  "route disclosure controls must name and own their board group");
assert.match(landing, /function isConsoleHash\([\s\S]*?startsWith\(`\$\{CONSOLE_HASH\}\//,
  "deep links must remain inside the console view");
assert.match(landing, /const investorSite = document\.querySelector\("#investorLanding"\)[\s\S]*?async function openConsole/,
  "the landing controller must hand off from the investor landing to the console");
assert.match(css, /investor-causal-flow[\s\S]*?investor-tech-matrix[\s\S]*?investor-scenario-grid/,
  "demand, technology and risk routes must retain their investor infographic system");

console.log("investor navigation alignment passed");
