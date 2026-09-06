#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const html = await read("../index.html");
const app = await read("../assets/js/app.js");
const landing = await read("../assets/js/landing.js");
const landingCss = await read("../assets/css/landing.css");
const css = await read("../assets/css/styles.css");
const frames = JSON.parse(await read("../data/mbb-frames.json"));
const history = JSON.parse(await read("../data/market-history.json"));
const packageModel = JSON.parse(await read("../package.json"));

for (const copy of [
  "Global Memory Equity Intelligence",
  "AI·메모리 사이클,",
  "미국·한국·중국·일본 상장 종목",
  "글로벌 반도체·메모리 투자 밸류체인",
  "AI 수요를 반도체 이익으로 번역",
  "기술 우위를 이익 지속성으로 검증",
  "좋은 산업과 좋은 주가를 분리",
  "투자 판단을 한 장으로 정리",
  "투자 권유 아님",
]) assert.ok(html.includes(copy), `investor experience missing: ${copy}`);

assert.match(html, /class="investor-landing" id="investorLanding"[\s\S]*?<video class="investor-hero-video"/,
  "the neutral investor landing must keep the visual hero treatment");
assert.match(landingCss, /body\.landing-mode > #businessSite,[\s\S]*?display: none !important/,
  "the former company-strategy landing must not appear in landing mode");
assert.match(landing, /const investorSite = document\.querySelector\("#investorLanding"\)/,
  "the controller must switch the new investor landing with the console");
assert.match(landing, /openConsole\(\{ updateHistory = true, targetHash = "" \}[\s\S]*?requestedHash[\s\S]*?HashChangeEvent\("hashchange"\)/,
  "investor calls-to-action must retain their deep-linked console destination");
assert.match(app, /label: "시장·사이클"[\s\S]*?label: "국가별 종목"[\s\S]*?label: "투자 밸류체인"[\s\S]*?label: "투자 판단"[\s\S]*?label: "가격·원문 데이터"/,
  "the console must follow the investor decision journey");
assert.match(css, /Independent investor console[\s\S]*?investor-market-pulse[\s\S]*?investor-tech-matrix[\s\S]*?investor-scenario-grid/,
  "the new investment boards must have a complete responsive visual system");

assert.doesNotMatch(html, /<img[^>]+(?:sk-hynix|skhynix)[^>]*class="sb-mark"|<img class="sb-mark"/i,
  "the site chrome must not retain an SK hynix logo");
assert.doesNotMatch(html.match(/<div class="investor-landing"[\s\S]*?<div class="business-site"/)?.[0] || "", /memory-hero(?:-lite)?\.mp4|memory-hero-poster\.webp/,
  "the visible investor landing must not reuse issuer-branded hero media");
assert.match(html, /class="sb-mark"[^>]*>MI</,
  "the site chrome must use the neutral Memory Intelligence mark");
assert.doesNotMatch(app.match(/const SIDE_NAV_ROUTES = \[[\s\S]*?\n  \];/)?.[0] || "", /SKHY|SK hynix|하이닉스/,
  "navigation must not privilege one issuer");

assert.equal((frames.frames || []).some((frame) => frame.id === "economics-calculator"), false,
  "the former calculator frame must be deleted");
for (const command of Object.values(packageModel.scripts || {})) {
  assert.doesNotMatch(command, /calculator|memory-economics|strategy-economics/i,
    "build and refresh automation must not regenerate the removed calculator");
}

const indexes = Object.values(history.indexes || {});
for (const stockId of ["skhy-stock", "samsung-stock", "micron-stock"]) {
  assert.ok(indexes.some((item) => item.id === stockId), `${stockId} must remain in the neutral investment universe`);
}

assert.match(landingCss, /@media \(max-width: 1050px\)[\s\S]*?@media \(max-width: 700px\)/,
  "the investor landing must adapt at tablet and mobile widths");
assert.match(css, /@media \(max-width: 1280px\)[\s\S]*?@media \(max-width: 820px\)[\s\S]*?@media \(max-width: 560px\)/,
  "the investment console must adapt without clipped text across common widths");

console.log("neutral investor experience contract passed");
