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
assert.match(app, /const EQUITY_CHAIN_PERIODS = \[[\s\S]*?"1개월"[\s\S]*?"6개월"[\s\S]*?"1년"[\s\S]*?"5년"[\s\S]*?"전체"/,
  "the chart should expose the reference period controls");
assert.match(app, /밸류체인 그룹 트렌드[\s\S]*?개별 종목/,
  "the chart should switch between grouped value chains and individual stocks");
assert.match(app, /function wireEquityChartTooltip[\s\S]*?pointermove/,
  "the chart must provide a pointer crosshair and value tooltip");
assert.match(app, /const pointerViewX = \(\(event\.clientX - rect\.left\) \/ Math\.max\(1, rect\.width\)\) \* width[\s\S]*?\(pointerViewX - pad\.left\) \/ plotWidth/,
  "pointer movement must be mapped into the SVG plot area rather than the full element width");
assert.match(app, /function equityNearestPoint[\s\S]*?const snappedTime = equityNearestPoint\(observedTimeline, targetTime\)/,
  "the crosshair must snap to a real observed trading timestamp");
assert.match(app, /EQUITY_STOCK_COLORS\[ordinal % EQUITY_STOCK_COLORS\.length\]/,
  "simultaneously selected companies must receive distinct series colors");
assert.match(app, /const point = equityPointAtOrBefore\(item\.points, snappedTime\)[\s\S]*?기준 거래일[\s\S]*?종가 \$\{escapeHTML\(equityCloseLabel\(point\.close, item\.currency\)\)\}[\s\S]*?item\.source/,
  "the tooltip must distinguish normalized comparison values from sourced actual closes");
assert.match(app, /class="equity-chart-sources"[\s\S]*?href="\$\{escapeHTML\(item\.sourceUrl\)\}"/,
  "visible chart series must retain direct links to their collected price sources");
assert.match(app, /const group = equityGroupSeries\(indexes, period, category\.id\)\[0\]/,
  "value-chain cards and chart lines must share one comparable-universe calculation");
assert.match(app, /기간 선도[\s\S]*?기간 하위[\s\S]*?상승 폭[\s\S]*?비교 기준/,
  "the chart should calculate an executive trend readout");
assert.match(css, /\.equity-chart-shell \{[\s\S]*?var\(--equity-navy\)/,
  "the chart should use the professional dark reference treatment");
assert.match(css, /\.equity-chart-hover-dot \{[\s\S]*?var\(--series-color\)/,
  "the chart must expose a visible per-series marker at the hovered observation");
assert.match(css, /\.equity-ticker-grid button:is\(:hover, :focus-visible\)[\s\S]*?translateY\(-3px\)/,
  "listed-company controls should have a clear hover interaction");
assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.equity-chart-line/,
  "equity motion must respect reduced-motion settings");

assert.match(crawler, /equityIndex\("cxmt-stock", "688825\.SS"/,
  "CXMT must use its verified Shanghai STAR ticker");
assert.match(crawler, /"cxmt-stock": \{[\s\S]*?exchange: "SSE STAR"[\s\S]*?listedAt: "2026-07-27"/,
  "CXMT listing metadata must retain its exchange and debut date");
for (const chain of ["memory", "foundry", "equipment", "packaging", "design-ip", "materials"]) {
  assert.match(crawler, new RegExp(`region: "china", valueChain: "${chain}"`),
    `China coverage should include the ${chain} value chain`);
}
for (const ticker of ["688825.SS", "688981.SS", "002371.SZ", "688012.SS", "600584.SS", "688008.SS", "688019.SS"]) {
  assert.ok(crawler.includes(ticker), `China universe should include ${ticker}`);
}
assert.match(crawler, /function compactEquityPointsForClient[\s\S]*?compact\.length \/ 300/,
  "non-core equity history should be downsampled for browser performance");

console.log(JSON.stringify({
  ok: true,
  regions: 2,
  chinaValueChains: 6,
}, null, 2));
