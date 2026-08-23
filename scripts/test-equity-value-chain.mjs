#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../assets/js/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../assets/css/styles.css", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const crawler = await readFile(new URL("./crawl.mjs", import.meta.url), "utf8");
const companyIntelligence = JSON.parse(
  await readFile(new URL("../data/company-intelligence.json", import.meta.url), "utf8"),
);

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
assert.match(app, /\{ id: "equity-value-chain", render: renderEquityValueChain, data: \["marketHistory", "enterpriseProfiles"\] \}/,
  "the heavy equity dashboard must load market history and company intelligence together");
assert.match(app, /enterpriseProfiles:\s*\{[\s\S]*?data\/company-intelligence\.json[\s\S]*?managed:\s*false/,
  "company profiles must load as a small static evidence artifact without the run-manifest gate");
assert.match(app, /id: "ecosystem"[\s\S]*?label: "협력 생태계"[\s\S]*?jump: "equity-value-chain"/,
  "the sidebar must expose a dedicated partner ecosystem route");
assert.match(app, /\{ label: "실행 영역", routes: \["analysis", "market", "partnerships", "hyperscaler-demand", "ecosystem"\] \},\s*\];/,
  "partner ecosystem should close the strategy and solutions group");
assert.match(app, /const SIDE_NAV_ROUTES = \[[\s\S]*?id: "biz-consulting"[\s\S]*?id: "c-level"[\s\S]*?id: "analysis"[\s\S]*?id: "market"[\s\S]*?id: "partnerships"[\s\S]*?id: "hyperscaler-demand"[\s\S]*?id: "ecosystem"/,
  "focused sidebar routes should follow the real SK hynix AI Infra document flow");
assert.match(app, /function refreshScrollSpyGeometry[\s\S]*?getBoundingClientRect\(\)\.top \+ window\.scrollY[\s\S]*?sort\(\(left, right\) => left\.top - right\.top\)[\s\S]*?function updateScrollSpyFromGeometry/,
  "scroll spy must cache real document landmarks rather than force layout on every scroll");
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
assert.match(app, /const hitRect = hit\.getBoundingClientRect\(\)[\s\S]*?\(clientX - hitRect\.left\) \/ Math\.max\(1, hitRect\.width\)/,
  "pointer movement must use the exact rendered hit area so both visual edges remain reachable");
assert.match(app, /function equityNearestPoint[\s\S]*?const snappedTime = equityNearestPoint\(observedTimeline, targetTime\)/,
  "tooltip values must snap to a real observed trading timestamp");
assert.match(app, /const pointerViewX = pad\.left \+ pointerRatio \* plotWidth[\s\S]*?crosshair\.setAttribute\("x1", pointerViewX\.toFixed\(2\)\)/,
  "the crosshair must track the continuous pointer position across the full plot width");
assert.match(app, /let lastSnappedTime = Number\.NaN[\s\S]*?if \(snappedTime !== lastSnappedTime\)[\s\S]*?lastSnappedTime = snappedTime/,
  "expensive tooltip content should update only when the sourced trading date changes");
assert.match(app, /const queuePointer = \(event\) =>[\s\S]*?requestAnimationFrame[\s\S]*?cancelAnimationFrame\(frameId\)/,
  "pointer DOM updates must be coalesced to one render per animation frame");
assert.match(app, /EQUITY_STOCK_COLORS\[ordinal % EQUITY_STOCK_COLORS\.length\]/,
  "simultaneously selected companies must receive distinct series colors");
assert.match(app, /const point = equityPointAtOrBefore\(item\.points, snappedTime\)[\s\S]*?기준 거래일[\s\S]*?종가 \$\{escapeHTML\(equityCloseLabel\(point\.close, item\.currency\)\)\}[\s\S]*?point\.source/,
  "the tooltip must distinguish normalized comparison values from sourced actual closes");
assert.doesNotMatch(app, /source: "실제 종가 동일가중 계산"/,
  "grouped value-chain tooltips must not repeat the equal-weight calculation label");
assert.match(app, /\(point\.source \|\| item\.source\) \? `<small>\$\{escapeHTML\(point\.source \|\| item\.source\)\}<\/small>` : ""/,
  "tooltip source rows must render only when a distinct source label exists");
assert.ok(
  app.includes('${latest ? `<em>${escapeHTML(equityCloseLabel(latest.close, index.currency))}</em>` : ""}'),
  "each stock control must show its latest actual close and currency without a trading date",
);
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
assert.match(css, /\.equity-chain-lane button \{[\s\S]*?border: 1px solid color-mix\(in srgb, var\(--chain-color\) 32%, var\(--line\)\);/,
  "value-chain lane controls should use a complete-card outline");
assert.match(css, /\.equity-chain-lane button \{[\s\S]*?border-inline-start-width: 1px;/,
  "global and China value-chain controls should explicitly keep the leading edge at the same width");
assert.doesNotMatch(css, /\.equity-chain-lane button \{[\s\S]*?border-left:\s*4px solid var\(--chain-color\)/,
  "value-chain lane controls must not use a left-only accent stripe");
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
const soxPeerBlock = app.match(/const SOX_REPRESENTATIVE_PEER_IDS = Object\.freeze\(\[([\s\S]*?)\]\);/)?.[1] || "";
const soxPeerIds = [...soxPeerBlock.matchAll(/"([a-z0-9-]+-stock)"/g)].map((match) => match[1]);
assert.equal(soxPeerIds.length, 12, "the SOX summary must show exactly 12 representative constituents");
assert.equal(new Set(soxPeerIds).size, 12, "the SOX representative list must not contain duplicate companies");
assert.match(app, /const peers = peerData\(SOX_REPRESENTATIVE_PEER_IDS\)/,
  "the SOX summary cards must be sourced from the representative constituent list");
assert.match(app, /const ticker = brand\.abbr \|\| item\.index\.symbol \|\| brand\.name[\s\S]*?market-peer-monogram">\$\{escapeHTML\(ticker\)\}/,
  "SOX summary cards must use stable text tickers instead of remote favicon wordmarks");
const marketPeerCardsBlock = app.match(/function marketPeerCardsHTML[\s\S]*?\n  }\n\n  function renderMarketIndexPanel/)?.[0] || "";
assert.doesNotMatch(marketPeerCardsBlock, /google\.com\/s2\/favicons|<img/,
  "SOX summary cards must not depend on remote images that can bleed into the return value");
assert.match(app, /function marketIndexChartHTML[\s\S]*?market-index-chart-area[\s\S]*?market-index-chart-crosshair[\s\S]*?market-index-chart-hover-dot[\s\S]*?market-index-chart-hit/,
  "the SOX chart must render a Yahoo-style area, crosshair, hover marker, and pointer hit target");
assert.match(app, /function wireMarketIndexChartTooltip[\s\S]*?nearestPoint\(targetTime\)[\s\S]*?shortKstDateWithYear\(point\.time\)[\s\S]*?closeLabel\(point\.value\)[\s\S]*?>종가 · \$\{escapeHTML\(index\.symbol \|\| "SOX"\)\}/,
  "the SOX hover tooltip must snap to a sourced trading date and show its actual close");
assert.match(app, /function wireMarketIndexChartTooltip[\s\S]*?const hitRect = hit\.getBoundingClientRect\(\)[\s\S]*?\(clientX - hitRect\.left\) \/ Math\.max\(1, hitRect\.width\)[\s\S]*?requestAnimationFrame/,
  "the SOX pointer must use the rendered hit area and coalesce movement updates per animation frame");
assert.match(css, /\.market-index-chart-canvas \{[\s\S]*?linear-gradient\(145deg, #111c31 0%, #0b1628 58%, #0c1b2b 100%\)[\s\S]*?\.market-index-chart-area \{[\s\S]*?marketIndexAreaGradient/,
  "the SOX chart must use the professional dark Yahoo-style mountain treatment");
assert.match(css, /\.market-peer-brand \{[\s\S]*?grid-template-columns:\s*minmax\(0, 78px\) minmax\(0, 1fr\)[\s\S]*?\.market-peer-logo \{[\s\S]*?overflow:\s*hidden/,
  "SOX ticker and company name must occupy separate, clipped columns without overlap");
assert.match(css, /\.market-peer-card \.market-peer-change \{[\s\S]*?max-width:\s*100%[\s\S]*?white-space:\s*nowrap/,
  "SOX return values must remain on their own bounded row");
assert.match(app, /const stockLabel = String\(item\.index\.labelKo \|\| item\.index\.label \|\| item\.index\.symbol \|\| ""\)[\s\S]*?\.replace\(\/\\s\*주가\\s\*\$\/u, ""\)[\s\S]*?market-peer-stock-label">\$\{escapeHTML\(stockLabel\)\}/,
  "SOX summary cards must remove the repeated stock-price suffix from company labels");
assert.match(app, /<strong>SOX 대표 구성종목 12<\/strong>/,
  "the SOX summary must identify the 12 cards as index constituents");
assert.doesNotMatch(app, /const chinaPeers = peerData\(/,
  "the SOX summary must not mix a separate China peer group into its 12 constituent cards");
assert.match(css, /\.equity-ticker-grid button:is\(:hover, :focus-visible\) \{[\s\S]*?scale\(1\.018\)[\s\S]*?linear-gradient\(145deg, #172b46 0%, #0d4f5a 58%, #087f72 100%\)/,
  "listed-company cards must invert to a professional animated gradient on hover");
assert.match(css, /\.equity-ticker-grid button\.active:is\(:hover, :focus-visible\) \{[\s\S]*?linear-gradient\(145deg, #17324d 0%, #0d5963 56%, #08796d 100%\)[\s\S]*?\.equity-ticker-grid button\.active:is\(:hover, :focus-visible\) :is\(b, strong, small, em\) \{[\s\S]*?color:\s*#fff[\s\S]*?opacity:\s*1/,
  "selected listed-company cards must retain high-contrast text when hover and focus states overlap");
assert.match(app, /function companyIntelligenceHTML[\s\S]*?companyOrganizationHTML\(profile\)[\s\S]*?companyStrategyHTML\(profile\)[\s\S]*?companyEvidenceHTML\(profile\)[\s\S]*?Corporate facts/,
  "company detail must separate market facts, leadership, official priorities, and recent evidence");
assert.match(app, /function companyRecentNews[\s\S]*?canonicalNewsKey\(item\)[\s\S]*?canonicalNewsStoryKey\(item\)/,
  "company evidence must use canonical story deduplication rather than repeat articles");
assert.match(app, /function companyRecentNews[\s\S]*?profile\.entityAliases[\s\S]*?aliasHits > 0 && entry\.sourceScore >= 3/,
  "company evidence must require both a direct company-entity match and an authoritative source");
assert.match(app, /const detailIndex = indexes\.find\(\(index\) => index\.id === state\.detailId\)[\s\S]*?companyIntelligenceHTML\(region, detailIndex, period\)/,
  "clicking a listed company must drive the inline company intelligence panel");
assert.match(app, /data-equity-stock[\s\S]*?state\.detailId = id[\s\S]*?renderEquityRegion\(region\)/,
  "company selection must update the detail panel in the existing stock region");
assert.match(css, /\.company-intelligence-grid \{[\s\S]*?grid-template-columns:\s*repeat\(2,[\s\S]*?\.company-org-executives \{[\s\S]*?grid-template-columns:\s*repeat\(auto-fit/,
  "company intelligence must use a responsive consulting-style grid and executive organization chart");
assert.match(css, /@keyframes companyPanelReveal[\s\S]*?@keyframes companyConnectorMove/,
  "company cards and organization connectors must include purposeful motion");
assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.equity-chart-line/,
  "equity motion must respect reduced-motion settings");
assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.company-intelligence-panel[\s\S]*?animation:\s*none/,
  "company intelligence motion must respect reduced-motion settings");

assert.equal(companyIntelligence.schemaVersion, "1.0", "company intelligence schema must be versioned");
const companyProfiles = Object.entries(companyIntelligence.profiles || {});
assert.ok(companyProfiles.length >= 13, "company intelligence must cover core global and China decision companies");
for (const [id, profile] of companyProfiles) {
  assert.ok(id.endsWith("-stock"), `${id} must join the market-history index by stock id`);
  assert.match(profile.officialUrl || "", /^https:\/\//, `${id} must retain an official company URL`);
  assert.ok(Array.isArray(profile.organization), `${id} must expose a structured organization array`);
  assert.ok(Array.isArray(profile.entityAliases) && profile.entityAliases.length >= 2,
    `${id} must provide explicit aliases so generic product terms cannot attach another company's article`);
  for (const person of profile.organization) {
    assert.ok(person.role && person.function, `${id} organization entries require role and function`);
    if (person.name) {
      assert.match(person.sourceUrl || "", /^https:\/\//,
        `${id} named executives require a direct official source`);
    }
  }
  for (const priority of profile.officialPriorities || []) {
    assert.ok(priority.title && priority.detail, `${id} official priorities require title and detail`);
    assert.match(priority.sourceUrl || "", /^https:\/\//,
      `${id} official priorities require a direct source`);
  }
}
for (const sourceId of [
  "company-skhynix-leadership",
  "company-samsung-leadership",
  "company-micron-leadership",
  "company-nvidia-leadership",
  "company-tsmc-leadership",
  "company-amd-leadership",
  "company-asml-leadership",
  "company-broadcom-leadership",
  "company-jcet-profile",
  "company-smic-profile",
  "company-naura-profile",
  "company-amec-profile",
]) {
  assert.ok(crawler.includes(`id: "${sourceId}"`), `${sourceId} must be health-checked by the crawler`);
}
assert.match(crawler, /company-tsmc-leadership[\s\S]*?sec\.gov\/Archives\/edgar/,
  "TSMC leadership must fall back to its official SEC filing");
assert.match(crawler, /company-tsmc-leadership[\s\S]*?globenewswire\.com[\s\S]*?NVIDIA-and-TSMC/,
  "TSMC leadership must retain an issuer-distributed fallback for hosted-runner IP blocks");
assert.match(crawler, /MemoryIntelligenceDashboard\/1\.0[\s\S]*?github\.com\/dicacros-gif\/memory/,
  "SEC probes must identify the dashboard instead of impersonating a browser");
assert.match(crawler, /company-jcet-profile[\s\S]*?english\.sse\.com\.cn/,
  "JCET must fall back to an official exchange record when its corporate site blocks hosted runners");
assert.match(crawler, /company-jcet-profile[\s\S]*?prnewswire\.com[\s\S]*?jcet-reports/,
  "JCET must retain its issuer-distributed release for exchange network failures");
assert.match(crawler, /company-smic-profile[\s\S]*?hkexnews\.hk/,
  "SMIC must fall back to an official exchange filing when its corporate site blocks hosted runners");

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
