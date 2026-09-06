#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CONSOLE_ROUTE_IDS, readConsoleRoutes } from "./console-route-contract.mjs";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const app = await read("../assets/js/app.js");
const css = await read("../assets/css/styles.css");
const html = await read("../index.html");
const history = JSON.parse(await read("../data/market-history.json"));

assert.match(html, /id="equity-value-chain"/, "the investment value-chain board must be mounted");
assert.match(html, /글로벌 반도체·메모리 투자 밸류체인/, "the board must declare its investor purpose");
assert.match(html, /id="investor-overview"[\s\S]*?id="investor-universe"/, "market overview and listed-equity universe must precede the chart");
assert.doesNotMatch(html, /class="sb-mark"[^>]*src=|brands\/sk-hynix\.svg/, "the console brand must not use an SK hynix logo");

assert.deepEqual(readConsoleRoutes(app).map((route) => route.id), CONSOLE_ROUTE_IDS,
  "the existing eight stable route ids must remain deep-link compatible");
assert.match(app, /id: "workload-requirement"[\s\S]*?label: "투자 밸류체인"[\s\S]*?sections: \["equity-value-chain"\]/,
  "route 3 must own the restored investment value chain");
assert.match(app, /id: "equity-value-chain",[\s\S]{0,100}render: renderEquityValueChain,[\s\S]{0,100}data: \["marketHistory", "enterpriseProfiles"\]/,
  "the chart must load its price history and issuer profiles on demand");
assert.match(app, /const EQUITY_VISIBLE_REGIONS = Object\.freeze\(\["us", "korea", "china", "japan"\]\)/,
  "the public universe must cover U.S., Korea, China, and Japan listing markets");
for (const [region, exchange] of [["us", "NASDAQ"], ["korea", "KRX"], ["china", "SSE"], ["japan", "TSE"]]) {
  assert.match(app, new RegExp(`${region}: \\{[\\s\\S]*?exchanges: \\[[\\s\\S]*?"${exchange}"`), `${region} must use exchange-based filtering`);
}
assert.match(app, /defaultSelected: \["samsung-stock", "skhy-stock"\]/,
  "SK hynix must remain an ordinary Korea-listed comparison company");
const equityStateBlock = app.match(/const equityChainState = \{[\s\S]*?\n  \};/)?.[0] || "";
assert.doesNotMatch(equityStateBlock, /skhynixVerified/,
  "the investor chart must not retain an SK hynix-anchored default view");

const renderStart = app.indexOf("function renderEquityValueChain()");
const renderEnd = app.indexOf("function priceSeriesColor", renderStart);
const renderBlock = renderStart >= 0 && renderEnd > renderStart ? app.slice(renderStart, renderEnd) : "";
assert.match(renderBlock, /controls\.hidden = false;[\s\S]*?panels\.hidden = false;/,
  "the value-chain chart controls and panels must be visible");
assert.match(renderBlock, /data-equity-region-tab[\s\S]*?renderEquityRegion\(activeRegion\)/,
  "the chart must expose four market tabs and render the selected market through one chart contract");
assert.match(renderBlock, /role="tab"[\s\S]*?aria-selected=/,
  "market selection must remain keyboard-readable and stateful");
assert.match(app, /function applyConsoleDeepLink\(\)[\s\S]*?equityChainState\.activeRegion = item;[\s\S]*?await ensureDeferredSection\(section\);[\s\S]*?renderEquityValueChain\(\)/,
  "changing an open-console region hash must rerender the selected market rather than only changing the URL");
assert.match(app, /state\.mode === "stock"[\s\S]*?equity-ticker-grid/,
  "the long issuer directory must expand only in individual-stock mode");
assert.doesNotMatch(renderBlock, /renderCompetitiveDynamicsInEcosystem/,
  "the restored equity chart must not mount the former issuer-centered relationship map");
assert.match(app, /const EQUITY_CHAIN_PERIODS = \[[\s\S]*?"1개월"[\s\S]*?"6개월"[\s\S]*?"1년"[\s\S]*?"5년"[\s\S]*?"전체"/,
  "the chart must expose useful comparison periods");
assert.match(app, /밸류체인 그룹 트렌드[\s\S]*?개별 종목/,
  "readers must be able to switch between industry groups and individual equities");
assert.match(app, /function wireEquityChartTooltip[\s\S]*?pointermove/,
  "the price chart must retain sourced interactive tooltips");
assert.match(app, /class="equity-chart-sources"[\s\S]*?href="\$\{escapeHTML\(item\.sourceUrl\)\}"/,
  "every visible series must retain its direct source link");
assert.match(app, /최초 종가 100 기준/,
  "cross-currency comparisons must be normalized instead of comparing absolute prices");

const indexes = Object.values(history.indexes || {});
const counts = {
  us: indexes.filter((item) => item.region === "global" && ["NASDAQ", "NYSE"].includes(item.exchange)).length,
  korea: indexes.filter((item) => item.region === "global" && item.exchange === "KRX").length,
  china: indexes.filter((item) => item.region === "china" && ["SSE", "SSE STAR", "SZSE", "SZSE ChiNext"].includes(item.exchange)).length,
  japan: indexes.filter((item) => item.region === "global" && item.exchange === "TSE").length,
};
for (const [market, count] of Object.entries(counts)) {
  assert.ok(count > 0, `${market} listing market must retain at least one collected equity`);
}
assert.ok(indexes.some((item) => item.id === "skhy-stock"), "SK hynix price history must remain available as investable coverage");
assert.ok(indexes.some((item) => item.id === "samsung-stock"), "Samsung price history must remain available for neutral comparison");
assert.ok(indexes.some((item) => item.id === "micron-stock"), "Micron price history must remain available for neutral comparison");

assert.match(css, /\.equity-chart-shell \{[\s\S]*?var\(--equity-navy\)/,
  "the chart must keep its professional dark investment-terminal treatment");
assert.match(css, /\.equity-ticker-grid button:is\(:hover, :focus-visible\)[\s\S]*?color:\s*var\(--console-ink-inverse\)/,
  "equity controls must preserve readable hover contrast");
assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.equity-chart-line/,
  "equity motion must respect reduced-motion preferences");

console.log(`equity value-chain investor contract passed · US ${counts.us} · KRX ${counts.korea} · China ${counts.china} · TSE ${counts.japan}`);
