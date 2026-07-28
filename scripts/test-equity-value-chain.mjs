#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../assets/js/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../assets/css/styles.css", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const crawler = await readFile(new URL("./crawl.mjs", import.meta.url), "utf8");

assert.match(html, /id="equity-value-chain"/, "the value-chain equity dashboard must be mounted at the bottom of the site");
assert.ok(
  html.indexOf('id="equity-value-chain"') > html.indexOf('id="response"'),
  "the equity dashboard should remain below the existing analysis boards",
);
assert.ok(
  html.indexOf('id="marketIndexPanel"') > html.indexOf('id="equity-value-chain"'),
  "the SOX and listed-peer dashboard must follow the richer value-chain dashboard",
);
assert.ok(
  html.indexOf('id="marketIndexPanel"') < html.indexOf('class="site-author-footer"'),
  "the SOX and listed-peer dashboard must remain the final content screen before the footer",
);
assert.match(css, /#equity-value-chain\s*\{\s*order:\s*29;\s*\}/,
  "the value-chain dashboard must have an explicit bottom-of-page order");
assert.match(css, /#marketIndexPanel\s*\{\s*order:\s*30;\s*\}/,
  "the SOX and listed-peer dashboard must have the final content order");
assert.match(app, /\{ id: "equity-value-chain", render: renderEquityValueChain, data: \["marketHistory"\] \}/,
  "the heavy equity dashboard must lazy-load the market artifact");
assert.match(app, /id: "stock"[\s\S]*?label: "Stock 분석"[\s\S]*?jump: "equity-value-chain"/,
  "the sidebar must expose a dedicated Stock analysis route");
assert.match(app, /\{ label: "시장·리스크", routes: \["market", "stock", "policy"\] \}/,
  "Stock analysis should align with the market and risk navigation group");
assert.match(app, /function setupScrollSpy[\s\S]*?activeTop = Number\.NEGATIVE_INFINITY[\s\S]*?top <= y && top >= activeTop/,
  "scroll spy must follow real document position rather than sidebar declaration order");
assert.match(app, /const EQUITY_CHAIN_PERIODS = \[[\s\S]*?"1개월"[\s\S]*?"6개월"[\s\S]*?"1년"[\s\S]*?"5년"[\s\S]*?"전체"/,
  "the chart should expose the reference period controls");
assert.match(app, /밸류체인 그룹 트렌드[\s\S]*?개별 종목/,
  "the chart should switch between grouped value chains and individual stocks");
assert.match(app, /lanes:\s*\[[\s\S]*?01 설계[\s\S]*?02 제조[\s\S]*?03 통합[\s\S]*?04 시스템[\s\S]*?function equityArchitectureHTML/,
  "the expanded universe should be explained as a four-lane value-chain architecture");
assert.match(app, /AI 가속기·CPU·ASIC[\s\S]*?EDA·CPU IP[\s\S]*?웨이퍼·소재[\s\S]*?AI 서버·전력·냉각/,
  "the global value chain should cover design through system infrastructure");
assert.match(app, /AI 칩·CPU·엣지 SoC[\s\S]*?센서·아날로그·전력[\s\S]*?PCB·패키지 기판[\s\S]*?광모듈·네트워크/,
  "the China value chain should cover compute, analog, substrates, and optical interconnect");
assert.match(app, /function wireEquityChartTooltip[\s\S]*?pointermove/,
  "the chart must provide a pointer crosshair and value tooltip");
assert.match(app, /const EQUITY_CHART_VIEW = Object\.freeze\(\{[\s\S]*?right: 0[\s\S]*?left: 0/,
  "the price plot must use the full SVG width without dead horizontal margins");
assert.match(app, /function equityChartHTML[\s\S]*?const \{ width, height, pad, axisInset \} = EQUITY_CHART_VIEW[\s\S]*?width="\$\{plotWidth\}"/,
  "the visible chart and pointer hit area must share the full-width plot geometry");
assert.match(app, /const hitRect = hit\.getBoundingClientRect\(\)[\s\S]*?\(event\.clientX - hitRect\.left\) \/ Math\.max\(1, hitRect\.width\)/,
  "pointer movement must use the exact rendered hit area so both visual edges remain reachable");
assert.match(app, /function equityNearestPoint[\s\S]*?const snappedTime = equityNearestPoint\(observedTimeline, targetTime\)/,
  "the crosshair must snap to a real observed trading timestamp");
assert.match(app, /EQUITY_STOCK_COLORS\[ordinal % EQUITY_STOCK_COLORS\.length\]/,
  "simultaneously selected companies must receive distinct series colors");
assert.match(app, /const point = equityPointAtOrBefore\(item\.points, snappedTime\)[\s\S]*?기준 거래일[\s\S]*?종가 \$\{escapeHTML\(equityCloseLabel\(point\.close, item\.currency\)\)\}[\s\S]*?point\.source/,
  "the tooltip must distinguish normalized comparison values from sourced actual closes");
assert.match(app, /equityCloseLabel\(latest\.close, index\.currency\)[\s\S]*?shortKstDate\(latest\.time\)/,
  "each stock control must show its latest actual close, currency, and trading date");
assert.match(app, /class="equity-chart-sources"[\s\S]*?href="\$\{escapeHTML\(item\.sourceUrl\)\}"/,
  "visible chart series must retain direct links to their collected price sources");
assert.match(app, /const group = equityGroupSeries\(indexes, period, category\.id\)\[0\]/,
  "value-chain cards and chart lines must share one comparable-universe calculation");
assert.match(app, /기간 선도[\s\S]*?기간 하위[\s\S]*?상승 폭[\s\S]*?비교 기준/,
  "the chart should calculate an executive trend readout");
assert.match(css, /\.equity-chart-shell \{[\s\S]*?var\(--equity-navy\)/,
  "the chart should use the professional dark reference treatment");
assert.match(css, /\.equity-chart-shell \{[\s\S]*?padding:\s*13px 0;/,
  "the chart canvas must span the full card width while controls retain their own inset");
assert.match(app, /class="equity-chart-svg"[\s\S]*?preserveAspectRatio="none"/,
  "the SVG plot must not retain hidden horizontal letterboxing");
assert.match(css, /\.equity-region-panel \{[\s\S]*?--equity-region-pad:[\s\S]*?padding:\s*var\(--equity-region-pad\)/,
  "the equity panel must expose its responsive inset for a full-bleed plot");
assert.match(css, /\.equity-chart-shell \{[\s\S]*?width:\s*calc\(100% \+ var\(--equity-region-pad\) \+ var\(--equity-region-pad\)\)[\s\S]*?margin-inline:\s*calc\(0px - var\(--equity-region-pad\)\)/,
  "the Yahoo-style dark chart surface must extend to both edges of the equity panel");
assert.match(css, /\.equity-chart-hover-dot \{[\s\S]*?var\(--series-color\)/,
  "the chart must expose a visible per-series marker at the hovered observation");
assert.match(css, /\.equity-ticker-grid button:is\(:hover, :focus-visible\)[\s\S]*?translateY\(-4px\)/,
  "listed-company controls should have a clear hover interaction");
assert.match(app, /const EQUITY_LOCAL_LOGOS = Object\.freeze\([\s\S]*?function equityCompanyLogoHTML[\s\S]*?loading="lazy"/,
  "listed-company cards must reuse local logos and lazy-load remaining company marks");
assert.match(app, /const EQUITY_COMPANY_DOMAINS = Object\.freeze\([\s\S]*?"amd-stock": "amd\.com"[\s\S]*?"cxmt-stock": "cxmt\.com"/,
  "global and China listed-company cards must include configured corporate-domain logo sources");
assert.match(app, /const EQUITY_GENERIC_FAVICON_IDS = new Set\([\s\S]*?!EQUITY_GENERIC_FAVICON_IDS\.has\(index\.id\)/,
  "generic globe favicons must fall back to a readable company monogram");
assert.match(app, /class="equity-ticker-identity"[\s\S]*?equityCompanyLogoHTML\(index\)[\s\S]*?class="equity-ticker-name"/,
  "each listed-company card must place its company logo beside the company identity");
assert.match(css, /\.equity-ticker-grid button:is\(:hover, :focus-visible\) \{[\s\S]*?scale\(1\.018\)[\s\S]*?linear-gradient\(145deg, #172b46 0%, #0d4f5a 58%, #087f72 100%\)/,
  "listed-company cards must invert to a professional animated gradient on hover");
assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.equity-chart-line/,
  "equity motion must respect reduced-motion settings");

assert.match(crawler, /equityIndex\("cxmt-stock", "688825\.SS"/,
  "CXMT must use its verified Shanghai STAR ticker");
assert.match(crawler, /"cxmt-stock": \{[\s\S]*?exchange: "SSE STAR"[\s\S]*?listedAt: "2026-07-27"/,
  "CXMT listing metadata must retain its exchange and debut date");
assert.match(crawler, /"cxmt-stock": \{[\s\S]*?quoteReferenceUrl: "https:\/\/kr\.investing\.com\/equities\/cxmt-corp"/,
  "CXMT must retain the user's direct Investing.com quote reference");
assert.match(crawler, /function marketCurrency[\s\S]*?\\\.\(\?:SS\|SZ\)\$[\s\S]*?return "CNY"/,
  "Shanghai and Shenzhen securities must never fall back to a USD label");
for (const chain of ["ai-chip", "memory", "foundry", "equipment", "packaging", "design-ip", "materials", "analog-power", "substrates", "interconnect", "infrastructure"]) {
  assert.match(crawler, new RegExp(`region: "china", valueChain: "${chain}"`),
    `China coverage should include the ${chain} value chain`);
}
for (const chain of ["ai-chip", "memory", "foundry", "equipment", "packaging", "design-ip", "materials", "interconnect", "infrastructure"]) {
  assert.match(crawler, new RegExp(`region: "global", valueChain: "${chain}"`),
    `Global coverage should include the ${chain} value chain`);
}
for (const ticker of [
  "688825.SS", "688981.SS", "002371.SZ", "688012.SS", "600584.SS", "688008.SS", "688019.SS",
  "688041.SS", "300308.SZ", "300502.SZ", "300476.SZ", "000977.SZ",
]) {
  assert.ok(crawler.includes(ticker), `China universe should include ${ticker}`);
}
for (const ticker of ["ARM", "SNPS", "CDNS", "ENTG", "COHR", "ALAB", "ETN", "SMCI", "6857.T", "6488.TWO"]) {
  assert.ok(crawler.includes(`"${ticker}"`), `Global universe should include ${ticker}`);
}
assert.match(crawler, /function sampleEquityPointWindow[\s\S]*?function compactEquityPointsForClient[\s\S]*?recentCutoff[\s\S]*?archiveLimit[\s\S]*?recentLimit/,
  "equity history should preserve recent detail while sampling the older archive");

console.log(JSON.stringify({
  ok: true,
  regions: 2,
  globalValueChains: 9,
  chinaValueChains: 11,
}, null, 2));
