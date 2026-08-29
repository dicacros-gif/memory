#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [app, styles, companyProfile] = await Promise.all([
  readFile(new URL("assets/js/app.js", root), "utf8"),
  readFile(new URL("assets/css/styles.css", root), "utf8"),
  readFile(new URL("assets/js/company-profile.js", root), "utf8"),
]);

function sourceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `missing source block: ${startMarker}`);
  return source.slice(start, end).trim();
}

const selectedPeriodWindowSource = sourceBetween(app, "function selectedPeriodWindow", "\n  function marketIndexTrend");
const selectedPeriodWindow = Function(`${selectedPeriodWindowSource}; return selectedPeriodWindow;`)();
const day = 86400000;
const seriesEvery = (days, interval = 30) => {
  const points = [];
  for (let offset = 0; offset < days; offset += interval) points.push({ time: offset * day });
  if (points.at(-1)?.time !== days * day) points.push({ time: days * day });
  return points;
};
const shortListing = selectedPeriodWindow(seriesEvery(120), { id: "5y", label: "5년", days: 365 * 5 });
const fullFiveYears = selectedPeriodWindow(seriesEvery(365 * 5), { id: "5y", label: "5년", days: 365 * 5 });
const shortOneYear = selectedPeriodWindow(seriesEvery(335), { id: "1y", label: "1년", days: 365 });
const nearFiveYears = selectedPeriodWindow(seriesEvery(1735), { id: "5y", label: "5년", days: 365 * 5 });
const exactOneYear = selectedPeriodWindow(seriesEvery(365), { id: "1y", label: "1년", days: 365 });
const endpointOnlyOneYear = selectedPeriodWindow([{ time: 0 }, { time: 365 * day }], { id: "1y", label: "1년", days: 365 });
assert.equal(shortListing.isPeriodComplete, false, "120 days of history must not qualify as a five-year return");
assert.equal(shortOneYear.isPeriodComplete, false, "335 days of history must not qualify as a one-year return");
assert.equal(nearFiveYears.isPeriodComplete, false, "a five-year window missing 90 days must fail closed");
assert.equal(exactOneYear.isPeriodComplete, true, "an exact one-year observation must remain eligible");
assert.equal(fullFiveYears.isPeriodComplete, true, "a complete five-year observation must remain eligible");
assert.equal(endpointOnlyOneYear.isPeriodComplete, false, "two endpoints must not masquerade as a continuous one-year return");

assert.match(app, /\{ id: "quarter", label: "90일", days: 90 \}/, "90-day price view must be available");
assert.match(app, /let pricePeriod = "quarter";/, "90-day price view must be the default");

const freshness = app.match(/function setNewsFreshness\(\)[\s\S]*?\n  }/)?.[0] || "";
assert.match(freshness, /latestVerifiedAt/, "news freshness must use the latest verified publication time");
assert.match(freshness, /published === false/, "unpublished refreshes must fail closed");
assert.match(freshness, /isExpired\(DATA_MANIFEST\?\.expiresAt\)/, "expired manifests must never appear current");
assert.match(app, /function isExpired\(value\)[\s\S]*?return !Number\.isFinite\(expiresAt\) \|\| Date\.now\(\) > expiresAt;/, "missing expiry must fail closed instead of appearing current");
assert.doesNotMatch(freshness, /lastCheckedAt/, "a check time is not a freshness time");
assert.match(freshness, /검증 기준일/, "verified news may expose only its reader-facing verification date");
assert.doesNotMatch(freshness, /업데이트 지연|재검증 필요|조건에 맞는 결과 없음/, "pipeline states must fail closed instead of reaching readers");

assert.match(app, /function productMarketProxyLabels/, "market proxies must expose their constituents");
assert.match(app, /상장종목 주가 프록시 · 제품 매출·실현가격 아님/, "market proxy disclaimer must be visible");
assert.match(app, /공개 가격 프록시 · 제품 매출·실현가격 아님/, "public price proxies must not read as realized product prices");
assert.match(app, /marketProxySymbols\.join\(" · "\)/, "market proxy tickers must be displayed");
assert.match(app, /if \(item\.usesMarketProxy\)[\s\S]*?상장종목 주가 프록시[\s\S]*?제품 매출·실현가격 아님/, "proxy percentages must not be primary card KPIs");
const backtestEvidence = app.match(/function backtestEvidenceHTML\([\s\S]*?\n  function agentInitials/)?.[0] || "";
assert.match(backtestEvidence, /품목·티커/, "backtest evidence must identify its ticker column");
assert.match(backtestEvidence, /const rowSymbol = String\(row\.symbol \|\| ""\)\.trim\(\)/, "each backtest row must preserve its own ticker");
assert.match(backtestEvidence, /const rowKind = row\.proxyKind === "market" \? "상장종목 주가 프록시" : "공개 가격 프록시"/, "backtest rows must label the proxy kind");
assert.doesNotMatch(backtestEvidence, /직접 가격/, "backtest evidence must not imply public proxies are direct realized prices");

assert.match(app, /90일 관측 가격 추이|\$\{period\.label\} 관측 가격 추이/, "price trend copy must identify the observed window");
assert.match(app, /const eligibleTrends = trends\.filter\(\(item\) => item\.trend\.isPeriodComplete !== false[\s\S]*?const leader = changed[\s\S]*?\|\| null;/, "an incomplete price series must never become the headline mover");
assert.match(app, /filter\(\(trend\) => trend\.isPeriodComplete !== false\)/, "MECE price highlights must use only complete selected-period series");
assert.match(app, /실측 누적 · \$\{fmtNum\(Math\.round\(Number\(trend\.coverageDays/, "incomplete price rows must label the actual observed window");
assert.match(app, /const change = trend\.isPeriodComplete === false \? "기간 미충족" : formatChange\(trend\);/, "incomplete price rows must suppress a misleading selected-period percentage");
assert.match(app, /최대 검증 변동/, "price headline must describe a verified period change rather than an all-history maximum");
assert.match(app, /선택 기간을 채운 가격 이력 없음/, "missing selected-period coverage must fail closed in reader-facing copy");
assert.match(app, /const changePct = periodWindow\.isPeriodComplete \? observedChangePct : Number\.NaN;/, "market index returns must fail closed when the selected period is incomplete");
assert.match(app, /function marketPeerCardsHTML[\s\S]*?const changeLabel = periodComplete \? formatChange\(item\.trend\) : "기간 미충족";/, "market peer cards must suppress incomplete-period returns");
assert.match(app, /function renderMarketIndexPanel[\s\S]*?수익률 계산 제외/, "the market index panel must explain why an incomplete return is hidden");
assert.match(app, /function equityPeriodWindow[\s\S]*?selectedPeriodWindow\(marketIndexPoints\(index\), period\)/, "equity returns must share the selected-period completeness contract");
assert.match(app, /if \(!periodWindow\.isPeriodComplete \|\| scoped\.length < 2[\s\S]*?return null;/, "incomplete equity series must be excluded from return calculations");
assert.match(app, /const comparable = series\.filter\(\(item\) => item\.isPeriodComplete !== false && Number\.isFinite\(item\.changePct\)\)/, "equity rankings and breadth must use only complete periods");
assert.doesNotMatch(app, /coverageDays >= Math\.min\(120, period\.days \* 0\.55\)/, "a short listing must not qualify for a five-year equity return");
assert.doesNotMatch(app, /visible = eligible[\s\S]*?state\.selected = visible\.map/, "period changes must not silently replace selected companies");
assert.match(app, /기간 미충족 종목은 수익률·순위·그룹 평균에서 제외/, "equity methodology must disclose incomplete-period exclusion");
assert.match(app, /const productKey = selectedExecProductId \|\| "all";/, "backtest close status must be scoped to the active product selection");
assert.match(app, /backtestObservation\(series, option\.firstTime, horizon\)\.eligible/, "backtest close status must reuse the complete observation contract");
assert.match(app, /row\.series\.length > 0 && row\.series\.some/, "every selected quantitative product must have an eligible series before a backtest closes");
assert.doesNotMatch(app, /\}\)\)\.filter\(\(row\) => row\.series\.length\)/, "missing product series must not disappear before close-state evaluation");
assert.match(app, /const requiredPointCount = Math\.max\(3, Math\.ceil\(period\.days \/ maxGapDays\) \+ 1\);/, "selected-period returns must require internal observation density");
assert.doesNotMatch(app, /\$\{fmtNum\(card\.count\)\} rows/, "operational row counts must not be rendered");

assert.match(styles, /\.news-tabs button,[\s\S]*?word-break: keep-all;[\s\S]*?white-space: nowrap;/, "news taxonomy labels must stay readable");
assert.match(styles, /\.sb-cat span \{[\s\S]*?word-break:\s*keep-all;[\s\S]*?overflow-wrap:\s*normal;/, "sidebar category labels must not split into vertical characters");
assert.match(styles, /\.sb-filter-head \{[\s\S]*?word-break:\s*keep-all;[\s\S]*?overflow-wrap:\s*normal;/, "sidebar filter labels must not split into vertical characters");
assert.match(styles, /\.decision-proxy-disclaimer/, "market proxy disclaimer must have a dedicated visual treatment");

assert.match(companyProfile, /function roadmapFieldHTML/, "roadmap fields must have a dedicated evidence renderer");
assert.match(companyProfile, /row\.fieldEvidence\?\.\[field\]/, "roadmap fields must read their own provenance descriptor");
assert.match(companyProfile, /!value \|\| !url \|\| !\/\^\\d\{1,2\}\\\/\\d\{1,2\}\$\//, "roadmap fields without value, exact URL, or day-level date must fail closed");
assert.match(companyProfile, /공식 기반 해석/, "roadmap interpretation must be distinct from official fact");
assert.match(companyProfile, /공식 공개 경계/, "roadmap disclosure boundaries must remain explicit");
assert.doesNotMatch(companyProfile.match(/function roadmapHTML[\s\S]*?\n  function baselineHTML/)?.[0] || "", /row\.(?:hbm|bandwidth|ramp|attach) \|\| "미확인"/, "roadmap must not expose unsupported placeholders as content");

console.log(JSON.stringify({ status: "console-evidence-ux-pass" }, null, 2));
