#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { startServer, findChrome, launchChrome, connect } from "./audit-contrast.mjs";
import { CONSOLE_ROUTE_IDS } from "./console-route-contract.mjs";

// Real rendered geometry, including both sides of responsive breakpoints.
// No app state injection: navigate with the same route controls as a reader.
const widths = process.argv.includes("--quick") ? [2200, 1440, 390, 1900] : [2560, 2200, 2101, 2100, 1900, 1801, 1800, 1501, 1500, 1440, 1321, 1320, 1101, 1100, 901, 900, 768, 600, 390, 1900];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const binary = findChrome();
if (!binary) throw new Error("layout audit requires Chrome/Edge/Chromium; set CHROME_PATH");
let server, chrome, session, targetId;
const results = [];
// The map hydrates from its verified relationship view, not the first fallback
// node that happens to paint. Check exact coverage against the served artifact;
// do not assume a fixed lane count or silently accept partially loaded content.
const siteContent = JSON.parse(readFileSync(new URL("../data/site-content-client.json", import.meta.url), "utf8"));
const dynamics = siteContent.strategyBoard.customerPortfolio.competitiveDynamics;
const extendedDynamics = JSON.parse(readFileSync(new URL("../data/site-content-extended-client.json", import.meta.url), "utf8")).strategyBoard.customerPortfolio.competitiveDynamics;
const relationshipView = dynamics.views[dynamics.defaultView || "skhynixVerified"];
const allowedRelations = new Set(relationshipView.relationIds);
const expectedCompanyIds = [...new Set(dynamics.relations
  .filter((relation) => allowedRelations.has(relation.id))
  .flatMap((relation) => [relation.from, relation.to]))].sort();
const expectedLaneIds = dynamics.layers
  .filter((lane) => lane.companies.some((company) => expectedCompanyIds.includes(company.id)))
  .map((lane) => lane.id);
assert.ok(expectedLaneIds.includes("memory-supply") && expectedCompanyIds.includes("samsung"), "verified map must include the memory supplier audit target");
const renderedMapCoverage = `(() => {
  const visible = (element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
  return {
    lanes: [...document.querySelectorAll('#equity-value-chain [data-dynamics-lane]')].filter(visible).map((element) => element.dataset.dynamicsLane),
    companies: [...document.querySelectorAll('#equity-value-chain .sc-dynamics-map [data-dynamics-company]')].filter(visible).map((element) => element.dataset.dynamicsCompany).sort(),
  };
})()`;

async function verifyMapCoverage() {
  try {
    await until(`(() => {
      const actual = ${renderedMapCoverage};
      return JSON.stringify(actual.lanes) === ${JSON.stringify(JSON.stringify(expectedLaneIds))}
        && JSON.stringify(actual.companies) === ${JSON.stringify(JSON.stringify(expectedCompanyIds))};
    })()`, "complete verified value-chain lanes and companies");
  } catch (error) {
    console.error(JSON.stringify({ expected: { lanes: expectedLaneIds, companies: expectedCompanyIds }, actual: await session.evaluate(renderedMapCoverage) }));
    throw error;
  }
  const actual = await session.evaluate(renderedMapCoverage);
  assert.deepEqual(actual.lanes, expectedLaneIds, "every verified value-chain lane must render in order");
  assert.deepEqual(actual.companies, expectedCompanyIds, "every verified company must render exactly once");
}

async function verifyCompanyDetail(companyId, width) {
  const expectedRelations = extendedDynamics.relations.filter(relation => allowedRelations.has(relation.id) && [relation.from, relation.to].includes(companyId));
  assert.ok(expectedRelations.length, `${companyId}: verified detail fixture required`);
  await session.evaluate(`document.querySelector('[data-dynamics-company="${companyId}"]').click()`);
  // The initial core artifact has relation IDs but not the reading content.
  // Measuring that skeleton would falsely report an improved panel height.
  const firstBody = expectedRelations.find(relation => relation.detail)?.detail;
  assert.ok(firstBody, `${companyId}: full evidence body required`);
  await until(`document.querySelector('[data-dynamics-detail]').textContent.includes(${JSON.stringify(firstBody)})`, `${companyId}: extended relationship evidence`);
  await session.evaluate("document.fonts.ready.then(() => true)");
  await wait(250);
  const geometry = await session.evaluate(`(() => {
    const box = name => {const r=document.querySelector('#equity-value-chain .sc-dynamics-'+name).getBoundingClientRect();return {width:r.width,height:r.height,x:r.x,y:r.y,right:r.right};};
    return {layout:box('layout'),stage:box('stage'),detail:box('detail')};
  })()`);
  if(width > 1100) {
    assert.ok(geometry.detail.width >= 459, `${width}: detail must have a readable width`);
    assert.ok(Math.abs(geometry.detail.y-geometry.stage.y)<2, `${width}: detail must stay beside the map`);
    assert.ok(geometry.stage.right <= geometry.detail.x, `${width}: panels must not overlap`);
    assert.ok(geometry.stage.width / geometry.layout.width <= .70, `${width}: map must leave space for reading`);
    if(companyId === 'asus' && width >= 1900 && expectedRelations.length === 1) {
      assert.ok(geometry.detail.height < 590, `${width}: single-relation detail is unnecessarily tall (${geometry.detail.height})`);
    }
  } else {
    assert.ok(Math.abs(geometry.detail.width-geometry.layout.width)<2, `${width}: stacked detail uses full available width`);
  }
  // Expand by clicking the actual disclosures; all current and historical
  // evidence remains reachable instead of being clipped to reduce height.
  await session.evaluate(`document.querySelectorAll('[data-dynamics-detail] .sc-dynamics-relations > section > details:not([open]) > summary').forEach(element=>element.click())`);
  await session.evaluate(`document.querySelectorAll('[data-dynamics-detail] .sc-dynamics-history:not([open]) > summary').forEach(element=>element.click())`);
  const coverage = await session.evaluate(`(() => {
    const root=document.querySelector('[data-dynamics-detail]');
    return {relations:[...root.querySelectorAll('.sc-dynamics-relation')].filter(e=>e.getClientRects().length).length, links:[...root.querySelectorAll('a[href]')].map(a=>a.href)};
  })()`);
  assert.equal(coverage.relations, expectedRelations.length, `${companyId}: all relationship cards remain visible when expanded`);
  for(const relation of expectedRelations) {
    for(const record of [relation, ...(relation.evidenceHistory || [])]) {
      if(record.source?.url) assert.ok(coverage.links.includes(record.source.url), `${companyId}: retained evidence link ${record.source.url}`);
    }
  }
  return {width:Math.round(geometry.detail.width),height:Math.round(geometry.detail.height),relations:coverage.relations};
}

async function until(expression, description) {
  for (let attempt = 0; attempt < 160; attempt += 1) {
    if (await session.evaluate(expression)) return;
    await wait(250);
  }
  throw new Error(`layout audit timed out: ${description}`);
}

async function activate(route, section, readySelector) {
  await session.evaluate(`document.querySelector('.sb-item[data-route="${route}"]').click()`);
  await session.evaluate(`document.querySelector('#${section}').scrollIntoView({block:'start',behavior:'instant'})`);
  await until(`(() => {
    const visible = (element) => element && element.getClientRects().length > 0
      && getComputedStyle(element).visibility !== 'hidden';
    return visible(document.querySelector('#${section}'))
      && visible(document.querySelector(${JSON.stringify(readySelector)}));
  })()`, `${section} rendered and visible`);
  await session.evaluate("document.fonts.ready.then(() => true)");
  await wait(450);
}

const measure = String.raw`(() => {
  const failures = [];
  const visible = e => e && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
  const rect = e => e.getBoundingClientRect();
  const record = (kind, e, detail) => failures.push({kind, text:e.textContent.trim().slice(0,90), detail});
  const textRects = e => {
    const out = [];
    const walker = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent.trim() || !visible(node.parentElement)) continue;
      const range = document.createRange(); range.selectNodeContents(node);
      out.push(...range.getClientRects());
    }
    return out.filter(r => r.width && r.height);
  };
  const title = document.querySelector('.topbar .tb-title h2');
  if (visible(title) && title.scrollWidth > title.clientWidth + 1) record('topbar-title-clipped',title,[title.clientWidth,title.scrollWidth]);
  const titleGroup = document.querySelector('.topbar .tb-title');
  const status = document.querySelector('.topbar .tb-data-status');
  if (visible(title) && visible(status)) {
    const a=rect(title), b=rect(status);
    if (Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>4 && a.right>b.left+2) record('topbar-status-overlap',title,a.right-b.left);
  }
  const actions = document.querySelector('.topbar .tb-actions');
  if (visible(titleGroup) && visible(actions)) {
    const a=rect(titleGroup), b=rect(actions);
    if (Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>4 && a.right>b.left+2) record('topbar-overlap',titleGroup,a.right-b.left);
  }
  if(document.documentElement.scrollWidth > innerWidth+4) failures.push({kind:'page-overflow',width:innerWidth,scrollWidth:document.documentElement.scrollWidth});
  const map = document.querySelector('#equity-value-chain .sc-dynamics-map');
  if (visible(map)) {
    if(map.scrollWidth>map.clientWidth+4) record('map-overflow',map,[map.clientWidth,map.scrollWidth]);
    for(const header of map.querySelectorAll('section > header')) {
      const lane=rect(header.closest('section'));
      for(const r of textRects(header)) if(r.left<lane.left-2 || r.right>lane.right+2) record('lane-header-overflow',header,Math.round(r.right-lane.right));
    }
    for(const e of document.querySelectorAll('#equity-value-chain .sc-dynamics-layers button strong, #equity-value-chain .sc-dynamics-facts p')) {
      const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);
      while(walker.nextNode()) {
        const node=walker.currentNode;
        for(const match of node.textContent.matchAll(/[A-Za-z]{4,}/g)) {
          const range=document.createRange();range.setStart(node,match.index);range.setEnd(node,match.index+match[0].length);
          const rows=new Set([...range.getClientRects()].map(r=>Math.round(r.top)));
          if(rows.size>1) record('relationship-midword-wrap',e,match[0]);
        }
      }
      if(e.scrollWidth>e.clientWidth+4) record('rail-overflow',e,e.scrollWidth-e.clientWidth);
    }
    const detail=document.querySelector('#equity-value-chain .sc-dynamics-detail');
    if(visible(detail) && /auto|scroll/.test(getComputedStyle(detail).overflowY) && detail.scrollHeight>detail.clientHeight+4) record('nested-detail-scroll',detail,detail.scrollHeight-detail.clientHeight);
    for(const e of document.querySelectorAll('#equity-value-chain .sc-dynamics-node strong, #equity-value-chain .sc-dynamics-detail-head, #equity-value-chain .sc-dynamics-facts > div, #equity-value-chain .sc-dynamics-relation')) {
      if(!visible(e))continue;
      const box=rect(e);
      if(e.scrollWidth>e.clientWidth+2)record('relationship-text-overflow',e,e.scrollWidth-e.clientWidth);
      for(const r of textRects(e)) if(r.left<box.left-2 || r.right>box.right+2 || r.bottom>box.bottom+2)record('relationship-text-clipped',e,{right:Math.round(r.right-box.right),bottom:Math.round(r.bottom-box.bottom)});
    }
    const svg=map.querySelector('[data-dynamics-links]');
    if(svg && (Math.abs(Number(svg.getAttribute('width'))-map.clientWidth)>2 || Math.abs(Number(svg.getAttribute('height'))-map.clientHeight)>2)) record('relationship-lines-stale',map,svg.getAttribute('viewBox'));
  }
  for(const e of document.querySelectorAll('#numbers .quant-decision-step')) {
    if(!visible(e))continue;
    const box=rect(e), s=getComputedStyle(e);
    const right=box.right-(s.clipPath==='none'?0:20);
    for(const r of textRects(e)) if(r.right>right+2 || r.left<box.left-2 || r.bottom>box.bottom+2) record('decision-ribbon-clip',e,{right:Math.round(r.right-right),bottom:Math.round(r.bottom-box.bottom)});
  }
  for(const e of document.querySelectorAll('.is-player > header, .is-basis')) {
    if(visible(e) && e.scrollWidth>e.clientWidth+4)record('player-header-overflow',e,e.scrollWidth-e.clientWidth);
  }
  return failures;
})()`;

try {
  const started = await startServer(); server = started.server;
  chrome = await launchChrome(binary, "1900x1000");
  ({ session, targetId } = await connect(chrome.port, "about:blank"));
  await session.send("Page.enable");
  await session.send("Runtime.enable");
  await session.send("Emulation.setDeviceMetricsOverride", { width: 1900, height: 1000, deviceScaleFactor: 1, mobile: false });
  await session.send("Page.navigate", { url: `http://127.0.0.1:${started.port}/index.html#console` });
  await until("document.querySelectorAll('.sb-item[data-route]').length === 8 && document.querySelectorAll('.is-player').length > 0", "eight routes and hydrated player roster");
  const routes = await session.evaluate("[...document.querySelectorAll('.sb-item[data-route]')].map(e=>e.dataset.route)");
  assert.deepEqual(routes, CONSOLE_ROUTE_IDS);
  for (const width of widths) {
    await session.send("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await activate("hyperscaler-demand", "equity-value-chain", "#equity-value-chain .sc-dynamics-node");
    await verifyMapCoverage();
    const asusDetail = await verifyCompanyDetail('asus', width);
    const detailFindings = await session.evaluate(measure);
    if([2200,1440,390].includes(width)) {
      await verifyCompanyDetail('nvidia', width);
      detailFindings.push(...await session.evaluate(measure));
    }
    // Select the memory supplier explicitly; do not depend on roster order.
    await session.evaluate(`document.querySelector('[data-dynamics-company="samsung"]').click()`);
    await wait(250);
    const mapFindings = await session.evaluate(measure);
    await activate("partnerships", "numbers", "#numbers .quant-decision-step");
    assert.ok(await session.evaluate("[...document.querySelectorAll('#numbers .quant-decision-step')].filter(e=>e.getClientRects().length).length >= 2"), "decision ribbon must be visible");
    const numbersFindings = await session.evaluate(measure);
    await activate("signal", "industry-shift", ".is-player");
    const radarFindings = await session.evaluate(measure);
    await session.evaluate(`document.querySelector('[data-industry-tier="silicon"]').click()`);
    await until(`Boolean(document.querySelector('.is-player[data-player="marvell"]'))`, "accelerator player tab");
    await wait(450);
    const historicalLabel = await session.evaluate(`document.querySelector('.is-player[data-player="marvell"] .is-basis').textContent`);
    assert.match(historicalLabel, /'24/, "the historical Marvell source must not read as a current-year announcement");
    const siliconFindings = await session.evaluate(measure);
    await session.evaluate(`document.querySelector('[data-industry-tier="hyperscaler"]').click()`);
    await until(`Boolean(document.querySelector('.is-player[data-player="meta"]'))`, "hyperscaler player tab");
    const findings = [...new Map([...detailFindings,...mapFindings,...numbersFindings,...radarFindings,...siliconFindings].map(f=>[JSON.stringify(f),f])).values()];
    results.push({ width, findings });
    console.log(JSON.stringify({ width, detail:asusDetail, findings }));
  }
  assert.equal(results.reduce((sum,r)=>sum+r.findings.length,0), 0, "rendered layout regressions");
  console.log(JSON.stringify({ layout: "pass", widths, priceTab: 8 }));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  session?.close();
  if (chrome) {
    try { if(targetId) await fetch(`http://127.0.0.1:${chrome.port}/json/close/${targetId}`, {signal:AbortSignal.timeout(2000)}); } catch {}
    try { chrome.child.kill(); } catch {}
  }
  server?.close();
  server?.closeAllConnections?.();
}
