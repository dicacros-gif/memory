#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [app, styles] = await Promise.all([
  readFile(new URL("assets/js/app.js", root), "utf8"),
  readFile(new URL("assets/css/styles.css", root), "utf8"),
]);

assert.match(app, /\{ id: "quarter", label: "90일", days: 90 \}/, "90-day price view must be available");
assert.match(app, /let pricePeriod = "quarter";/, "90-day price view must be the default");

const freshness = app.match(/function setNewsFreshness\(\)[\s\S]*?\n  }/)?.[0] || "";
assert.match(freshness, /latestVerifiedAt/, "news freshness must use the latest verified publication time");
assert.match(freshness, /published === false/, "unpublished refreshes must fail closed");
assert.match(freshness, /isExpired\(DATA_MANIFEST\?\.expiresAt\)/, "expired manifests must never appear current");
assert.doesNotMatch(freshness, /lastCheckedAt/, "a check time is not a freshness time");
assert.match(freshness, /재검증 필요/, "stale or degraded news must be labelled for revalidation");

assert.match(app, /function productMarketProxyLabels/, "market proxies must expose their constituents");
assert.match(app, /상장종목 주가 프록시 · 제품 매출\/가격 성장률 아님/, "market proxy disclaimer must be visible");
assert.match(app, /marketProxySymbols\.join\(" · "\)/, "market proxy tickers must be displayed");
assert.match(app, /if \(item\.usesMarketProxy\)[\s\S]*?상장종목 주가 프록시[\s\S]*?제품 성장률 아님/, "proxy percentages must not be primary card KPIs");

assert.match(app, /90일 관측 가격 추이|\$\{period\.label\} 관측 가격 추이/, "price trend copy must identify the observed window");
assert.doesNotMatch(app, /\$\{fmtNum\(card\.count\)\} rows/, "operational row counts must not be rendered");

assert.match(styles, /\.news-tabs button,[\s\S]*?word-break: keep-all;[\s\S]*?white-space: nowrap;/, "news taxonomy labels must stay readable");
assert.match(styles, /\.decision-proxy-disclaimer/, "market proxy disclaimer must have a dedicated visual treatment");

console.log(JSON.stringify({ status: "console-evidence-ux-pass" }, null, 2));
