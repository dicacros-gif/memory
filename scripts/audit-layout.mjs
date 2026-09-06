#!/usr/bin/env node
import assert from "node:assert/strict";
import { startServer, findChrome, launchChrome, connect } from "./audit-contrast.mjs";
import { CONSOLE_ROUTE_IDS, CONSOLE_ROUTE_LANDMARKS } from "./console-route-contract.mjs";

// Real rendered geometry, including both sides of responsive breakpoints.
// No app state injection: navigate and switch markets with the same controls as a reader.
const widths = process.argv.includes("--quick")
  ? [2200, 1440, 390, 1900]
  : [2560, 2200, 2101, 2100, 1900, 1801, 1800, 1501, 1500, 1440, 1321, 1320, 1101, 1100, 901, 900, 768, 600, 390, 1900];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const binary = findChrome();
if (!binary) throw new Error("layout audit requires Chrome/Edge/Chromium; set CHROME_PATH");

const EQUITY_MARKETS = Object.freeze(["us", "korea", "china", "japan"]);
const ROUTE_CHECKS = Object.freeze([
  { route: "signal", section: "investor-overview", ready: "#investorOverview .investor-market-pulse" },
  { route: "biz-consulting", section: "investor-universe", ready: "#investorUniverse .investor-universe-grid" },
  { route: "workload-requirement", section: "equity-value-chain", ready: "#equityPeriodControls [data-equity-region-tab]" },
  { route: "hyperscaler-demand", section: "investor-demand", ready: "#investor-demand .investor-readthrough-grid" },
  { route: "partnerships", section: "investor-technology", ready: "#investor-technology .investor-tech-matrix" },
  { route: "analysis", section: "investor-risk", ready: "#investor-risk .investor-scenario-grid" },
  { route: "c-level", section: "investor-thesis", ready: "#investor-thesis .investor-thesis-flow" },
  { route: "price", section: "prices", ready: "#prices .price-table" },
]);
assert.deepEqual(ROUTE_CHECKS.map((item) => item.route), CONSOLE_ROUTE_IDS, "layout routes must follow the public navigation contract");
assert.deepEqual(ROUTE_CHECKS.map((item) => item.section), CONSOLE_ROUTE_LANDMARKS, "layout landmarks must follow the public navigation contract");

let server, chrome, session, targetId;
const results = [];

async function until(expression, description) {
  for (let attempt = 0; attempt < 160; attempt += 1) {
    if (await session.evaluate(expression)) return;
    await wait(250);
  }
  throw new Error(`layout audit timed out: ${description}`);
}

async function activate({ route, section, ready }) {
  const clicked = await session.evaluate(`(() => {
    const button = document.querySelector('.sb-item[data-route="${route}"]');
    if (!button) return false;
    button.click();
    document.querySelector('#${section}')?.scrollIntoView({ block: 'start', behavior: 'instant' });
    return true;
  })()`);
  assert.ok(clicked, `${route}: navigation control must exist`);
  await until(`(() => {
    const visible = (element) => element && element.getClientRects().length > 0
      && getComputedStyle(element).visibility !== 'hidden';
    return document.querySelector('.sb-item[data-route="${route}"]')?.classList.contains('active')
      && visible(document.querySelector('#${section}'))
      && visible(document.querySelector(${JSON.stringify(ready)}));
  })()`, `${section} rendered and visible`);
  await session.evaluate("document.fonts.ready.then(() => true)");
  await wait(240);
}

const measure = String.raw`(() => {
  const failures = [];
  const root = document.querySelector('[data-layout-root]') || document.body;
  const visible = (element) => element && element.getClientRects().length > 0
    && getComputedStyle(element).visibility !== 'hidden'
    && !element.closest('[hidden], [aria-hidden="true"], .sr-only, .visually-hidden');
  const rect = (element) => element.getBoundingClientRect();
  const selector = (element) => element.id
    ? '#' + element.id
    : element.tagName.toLowerCase() + [...element.classList].slice(0, 3).map((name) => '.' + name).join('');
  const record = (kind, element, detail) => failures.push({
    kind,
    selector: selector(element),
    text: (element.innerText || element.textContent || '').trim().slice(0, 90),
    detail,
  });
  const textRects = (element) => {
    const output = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent.trim() || !visible(node.parentElement) || node.parentElement.closest('svg')) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      output.push(...range.getClientRects());
    }
    return output.filter((item) => item.width > 1 && item.height > 1);
  };

  const title = document.querySelector('.topbar .tb-title h2');
  if (visible(title) && title.scrollWidth > title.clientWidth + 1) {
    record('topbar-title-clipped', title, [title.clientWidth, title.scrollWidth]);
  }
  const titleGroup = document.querySelector('.topbar .tb-title');
  const status = document.querySelector('.topbar .tb-data-status');
  if (visible(titleGroup) && visible(status)) {
    const a = rect(titleGroup), b = rect(status);
    if (Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 4 && a.right > b.left + 2) {
      record('topbar-status-overlap', titleGroup, Math.round(a.right - b.left));
    }
  }
  const actions = document.querySelector('.topbar .tb-actions');
  if (visible(titleGroup) && visible(actions)) {
    const a = rect(titleGroup), b = rect(actions);
    if (Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 4 && a.right > b.left + 2) {
      record('topbar-overlap', titleGroup, Math.round(a.right - b.left));
    }
  }
  if (document.documentElement.scrollWidth > innerWidth + 4) {
    failures.push({ kind: 'page-overflow', width: innerWidth, scrollWidth: document.documentElement.scrollWidth });
  }

  // Check text ranges against clipping ancestors. Reachable scroll containers
  // are allowed; hidden or clipped copy is not.
  const textElements = root.querySelectorAll('h1,h2,h3,h4,p,li,dt,dd,strong,small,em,button,a,th,td,label,summary');
  for (const element of textElements) {
    if (!visible(element) || !(element.textContent || '').trim()) continue;
    const ranges = textRects(element);
    if (!ranges.length) continue;
    for (let ancestor = element; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
      if (!root.contains(ancestor)) break;
      const style = getComputedStyle(ancestor);
      const box = rect(ancestor);
      const scrollX = /auto|scroll/.test(style.overflowX) && ancestor.scrollWidth > ancestor.clientWidth + 3;
      const scrollY = /auto|scroll/.test(style.overflowY) && ancestor.scrollHeight > ancestor.clientHeight + 3;
      const clipsX = !scrollX && /hidden|clip/.test(style.overflowX);
      const clipsY = !scrollY && /hidden|clip/.test(style.overflowY);
      if (clipsX || clipsY) {
        const clipped = ranges.find((item) =>
          (clipsX && (item.left < box.left - 3 || item.right > box.right + 3))
          || (clipsY && (item.top < box.top - 4 || item.bottom > box.bottom + 4)));
        if (clipped) {
          record('text-clipped', element, {
            owner: selector(ancestor),
            right: Math.round(clipped.right - box.right),
            bottom: Math.round(clipped.bottom - box.bottom),
          });
          break;
        }
      }
      if (ancestor === root) break;
    }
  }

  if (root.matches('#investor-universe')) {
    for (const card of root.querySelectorAll('.investor-universe-card')) {
      const box = rect(card);
      const children = [...card.children].filter(visible).map(rect);
      const lastBottom = Math.max(box.top, ...children.map((item) => item.bottom));
      const tail = box.bottom - lastBottom;
      if (tail > 72) record('universe-card-empty-tail', card, Math.round(tail));
    }
  }

  if (root.matches('#equity-value-chain')) {
    const tabs = [...root.querySelectorAll('[data-equity-region-tab]')].filter(visible);
    const selected = tabs.filter((tab) => tab.getAttribute('aria-selected') === 'true');
    const panels = [...root.querySelectorAll('[data-equity-region]')].filter(visible);
    if (tabs.length !== 4) failures.push({ kind: 'equity-market-tab-count', actual: tabs.length });
    if (selected.length !== 1) failures.push({ kind: 'equity-market-selection-count', actual: selected.length });
    if (panels.length !== 1) failures.push({ kind: 'equity-region-panel-count', actual: panels.length });
    if (selected[0] && panels[0] && selected[0].dataset.equityRegionTab !== panels[0].dataset.equityRegion) {
      failures.push({ kind: 'equity-market-panel-mismatch', tab: selected[0].dataset.equityRegionTab, panel: panels[0].dataset.equityRegion });
    }
    for (let index = 0; index < tabs.length; index += 1) {
      const a = rect(tabs[index]);
      for (let other = index + 1; other < tabs.length; other += 1) {
        const b = rect(tabs[other]);
        const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (overlapX > 2 && overlapY > 2) record('equity-market-tab-overlap', tabs[other], { overlapX: Math.round(overlapX), overlapY: Math.round(overlapY) });
      }
    }
    if (panels[0]?.scrollWidth > panels[0]?.clientWidth + 4) {
      record('equity-region-overflow', panels[0], [panels[0].clientWidth, panels[0].scrollWidth]);
    }
    if (root.getBoundingClientRect().height > Math.max(6000, innerHeight * 6)) {
      record('equity-runaway-height', root, Math.round(root.getBoundingClientRect().height));
    }
    const chart = root.querySelector('.equity-chart-svg');
    const canvas = root.querySelector('.equity-chart-canvas');
    if (visible(chart) && visible(canvas)) {
      const a = rect(chart), b = rect(canvas);
      if (a.left < b.left - 2 || a.right > b.right + 2 || a.bottom > b.bottom + 2) {
        record('equity-chart-clipped', chart, { width: Math.round(a.width), canvas: Math.round(b.width) });
      }
    }
  }

  if (innerWidth <= 600) {
    const scrollTop = document.querySelector('#scrollTop');
    if (visible(scrollTop)) record('mobile-scroll-top-overlay', scrollTop, rect(scrollTop));
  }
  return [...new Map(failures.map((finding) => [JSON.stringify(finding), finding])).values()];
})()`;

async function measureSection(section) {
  const marked = await session.evaluate(`(() => {
    document.querySelectorAll('[data-layout-root]').forEach((element) => element.removeAttribute('data-layout-root'));
    const root = document.querySelector(${JSON.stringify(section)});
    if (!root) return false;
    root.setAttribute('data-layout-root', '');
    return true;
  })()`);
  assert.ok(marked, `${section}: layout root must exist`);
  return session.evaluate(measure);
}

async function verifyUniverse(width) {
  await until(`(() => {
    const cards = [...document.querySelectorAll('#investorUniverse .investor-universe-card')];
    return cards.length === 4 && cards.every((card) => Number.parseInt(card.querySelector('header b')?.textContent || '0', 10) > 0);
  })()`, "four hydrated listed-equity market cards");
  const geometry = await session.evaluate(`(() => ({
    cards: [...document.querySelectorAll('#investorUniverse .investor-universe-card')].map((card) => {
      const box = card.getBoundingClientRect();
      const bottoms = [...card.children].filter((element) => element.getClientRects().length).map((element) => element.getBoundingClientRect().bottom);
      return { market: card.dataset.investorMarket, width: Math.round(box.width), height: Math.round(box.height), tail: Math.round(box.bottom - Math.max(...bottoms)) };
    }),
    gridColumns: getComputedStyle(document.querySelector('#investorUniverse .investor-universe-grid')).gridTemplateColumns,
  }))()`);
  assert.equal(geometry.cards.length, 4, `${width}: every listed market must render once`);
  assert.ok(geometry.cards.every((card) => card.tail <= 72), `${width}: universe cards must not stretch into empty panels`);
  return geometry;
}

async function verifyEquityMarkets(width) {
  const tabs = await session.evaluate("[...document.querySelectorAll('#equityPeriodControls [data-equity-region-tab]')].map((element) => element.dataset.equityRegionTab)");
  assert.deepEqual(tabs, EQUITY_MARKETS, `${width}: equity market tabs must keep public order`);
  const markets = [];
  const findings = [];
  for (const market of EQUITY_MARKETS) {
    const clicked = await session.evaluate(`(() => {
      const tab = document.querySelector('[data-equity-region-tab="${market}"]');
      if (!tab) return false;
      tab.click();
      return true;
    })()`);
    assert.ok(clicked, `${width}: ${market} market tab must be clickable`);
    await until(`document.querySelector('[data-equity-region-tab="${market}"]')?.getAttribute('aria-selected') === 'true'
      && Boolean(document.querySelector('[data-equity-region="${market}"]'))`, `${market} equity market selection`);
    await session.evaluate("document.fonts.ready.then(() => true)");
    await wait(180);
    const state = await session.evaluate(`(() => {
      const root = document.querySelector('#equity-value-chain').getBoundingClientRect();
      const panel = document.querySelector('[data-equity-region="${market}"]');
      const panelBox = panel.getBoundingClientRect();
      return {
        market: '${market}',
        hash: location.hash,
        panelCount: document.querySelectorAll('#equityValueChainPanels > [data-equity-region]').length,
        listed: Number.parseInt(panel.querySelector('.equity-region-meta b')?.textContent || '0', 10),
        rootHeight: Math.round(root.height),
        panelHeight: Math.round(panelBox.height),
      };
    })()`);
    assert.equal(state.hash, `#console/equity-value-chain/${market}`, `${width}: ${market} tab must update the deep link`);
    assert.equal(state.panelCount, 1, `${width}: only the selected market panel should render`);
    assert.ok(state.listed > 0, `${width}: ${market} market must contain listed equities`);
    markets.push(state);
    findings.push(...await measureSection("#equity-value-chain"));
  }
  return { markets, findings };
}

try {
  const started = await startServer();
  server = started.server;
  chrome = await launchChrome(binary, "1900x1000");
  ({ session, targetId } = await connect(chrome.port, "about:blank"));
  await session.send("Page.enable");
  await session.send("Runtime.enable");
  await session.send("Emulation.setDeviceMetricsOverride", { width: 1900, height: 1000, deviceScaleFactor: 1, mobile: false });
  await session.send("Page.navigate", { url: `http://127.0.0.1:${started.port}/index.html#console/investor-overview` });
  await until(`document.querySelectorAll('.sb-item[data-route]').length === 8
    && Boolean(document.querySelector('#investorOverview .investor-market-pulse'))`, "eight investor routes and hydrated overview");

  const routes = await session.evaluate("[...document.querySelectorAll('.sb-item[data-route]')].map((element) => element.dataset.route)");
  assert.deepEqual(routes, CONSOLE_ROUTE_IDS, "rendered route order must match the public contract");
  assert.equal(routes.indexOf("price"), 7, "price and source data must remain tab 8");

  for (const width of widths) {
    await session.send("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width <= 600 });
    const routeFindings = [];
    let universe = null;
    let equity = null;

    for (const check of ROUTE_CHECKS) {
      await activate(check);
      if (check.route === "biz-consulting") universe = await verifyUniverse(width);
      if (check.route === "workload-requirement") {
        equity = await verifyEquityMarkets(width);
        routeFindings.push(...equity.findings);
      } else {
        routeFindings.push(...await measureSection(`#${check.section}`));
        if (check.route === "signal" && await session.evaluate("Boolean(document.querySelector('#marketIndexPanel')?.getClientRects().length)")) {
          routeFindings.push(...await measureSection("#marketIndexPanel"));
        }
      }
    }

    const findings = [...new Map(routeFindings.map((finding) => [JSON.stringify(finding), finding])).values()];
    results.push({ width, findings });
    console.log(JSON.stringify({ width, universe, equity: equity?.markets || [], findings }));
  }

  assert.equal(results.reduce((sum, result) => sum + result.findings.length, 0), 0, "rendered investor layout regressions");
  console.log(JSON.stringify({ layout: "pass", widths, routes: CONSOLE_ROUTE_IDS.length, equityMarkets: EQUITY_MARKETS.length, priceTab: 8 }));
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
} finally {
  session?.close();
  if (chrome) {
    try {
      if (targetId) await fetch(`http://127.0.0.1:${chrome.port}/json/close/${targetId}`, { signal: AbortSignal.timeout(2000) });
    } catch { /* best effort */ }
    try { chrome.child.kill(); } catch { /* best effort */ }
  }
  server?.close();
  server?.closeAllConnections?.();
}
