#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [html, app, styles, companyProfile, accountOnePagers] = await Promise.all([
  readFile(new URL("index.html", root), "utf8"),
  readFile(new URL("assets/js/app.js", root), "utf8"),
  readFile(new URL("assets/css/styles.css", root), "utf8"),
  readFile(new URL("assets/js/company-profile.js", root), "utf8"),
  readFile(new URL("assets/js/account-one-pagers.js", root), "utf8"),
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

assert.match(app, /function isExpired\(value\)[\s\S]*?return !Number\.isFinite\(expiresAt\) \|\| Date\.now\(\) > expiresAt;/, "missing expiry must fail closed instead of appearing current");
assert.doesNotMatch(app, /function setNewsFreshness\(|#newsFreshness/, "the removed news verification-date badge must stay out of the console runtime");
assert.doesNotMatch(html, /<p class="eyebrow">NEWS<\/p>|id="newsFreshness"/, "the removed NEWS eyebrow and verification-date badge must stay out of the page");
assert.match(app, /id: "ecosystem",[\s\S]*?desc: "COMPETITIVE DYNAMICS · VALUE CHAIN"/, "the value-chain route must use the competitive-dynamics label");
assert.doesNotMatch(app, /검증 관계 지도 · 글로벌·중국 지수/, "the retired global and China index subtitle must stay out of the route");

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
assert.match(app, /const eligibleTrends = trends\.filter\(\(item\) => item\.trend\.observedWindowValid === true\)/, "price headline movers must use a continuous observed window");
assert.match(app, /filter\(\(trend\) => trend\.observedWindowValid === true\)/, "MECE price highlights must use only verified observed windows");
assert.match(app, /실측 누적 · \$\{fmtNum\(Math\.round\(Number\(trend\.coverageDays/, "shorter observed windows must show their actual duration");
assert.match(app, /const change = trend\.observedWindowValid === true \? formatChange\(trend\) : "—";/, "price rows must show a return only for a continuous observed window");
assert.match(app, /실측 검증 변동/, "price headline must label the observed-window basis");
assert.match(app, /실측 이력 축적 중/, "missing observed coverage must fail closed in reader-facing copy");
assert.match(app, /const changePct = observedWindowValid \? observedChangePct : Number\.NaN;/, "market index returns must use the observed-window validation contract");
assert.match(app, /function marketPeerCardsHTML[\s\S]*?const changeLabel = periodComplete \? formatChange\(item\.trend\) : "—";/, "market peer cards must hide returns without a continuous observed window");
assert.match(app, /function renderMarketIndexPanel[\s\S]*?실측 누적 변화/, "the market index panel must label the observed-window return basis");
assert.match(app, /function equityPeriodWindow[\s\S]*?selectedPeriodWindow\(marketIndexPoints\(index\), period\)/, "equity returns must share the selected-period completeness contract");
assert.match(app, /const observedWindowValid = scoped\.length >= 2[\s\S]*?if \(!observedWindowValid\) return null;/, "equity returns should calculate over a continuous observed range when the selected period is incomplete");
assert.match(app, /const comparable = series\.filter\(\(item\) => item\.observedWindowValid === true && Number\.isFinite\(item\.changePct\)\)/, "equity rankings and breadth must use validated observed ranges");
assert.doesNotMatch(app, /coverageDays >= Math\.min\(120, period\.days \* 0\.55\)/, "a short listing must not qualify for a five-year equity return");
assert.doesNotMatch(app, /visible = eligible[\s\S]*?state\.selected = visible\.map/, "period changes must not silently replace selected companies");
assert.doesNotMatch(app, /연속 실측 구간이 없는 종목은 수익률·순위·그룹 평균에서 제외/, "the removed equity methodology note must stay out of the reader-facing console");
assert.match(app, /const productKey = selectedExecProductId \|\| "all";/, "backtest close status must be scoped to the active product selection");
assert.match(app, /backtestObservation\(series, option\.firstTime, horizon\)\.eligible/, "backtest close status must reuse the complete observation contract");
assert.match(app, /row\.series\.length > 0 && row\.series\.some/, "every selected quantitative product must have an eligible series before a backtest closes");
assert.doesNotMatch(app, /\}\)\)\.filter\(\(row\) => row\.series\.length\)/, "missing product series must not disappear before close-state evaluation");
assert.match(app, /const requiredPointCount = Math\.max\(3, Math\.ceil\(period\.days \/ maxGapDays\) \+ 1\);/, "selected-period returns must require internal observation density");
assert.doesNotMatch(app, /\$\{fmtNum\(card\.count\)\} rows/, "operational row counts must not be rendered");

assert.match(styles, /\.news-tabs button\s*\{[\s\S]*?word-break: keep-all;[\s\S]*?white-space: nowrap;/, "news taxonomy labels must stay readable without the retired source-tab selector");
assert.match(styles, /\.sb-cat span \{[\s\S]*?word-break:\s*keep-all;[\s\S]*?overflow-wrap:\s*normal;/, "sidebar category labels must not split into vertical characters");
assert.match(styles, /\.sb-filter-head \{[\s\S]*?word-break:\s*keep-all;[\s\S]*?overflow-wrap:\s*normal;/, "sidebar filter labels must not split into vertical characters");
assert.match(styles, /\.decision-proxy-disclaimer/, "market proxy disclaimer must have a dedicated visual treatment");
assert.doesNotMatch(accountOnePagers, /기업 상세 프로필 열기|sc-dynamics-profile/, "the removed company profile CTA must stay out of the relationship detail panel");
assert.doesNotMatch(styles, /\.sc-dynamics-profile/, "the removed company profile CTA must not leave dead layout styles");

assert.match(app, /const groupIndexLabel = \(value, fallback\)[\s\S]*?Number\.parseInt[\s\S]*?String\(parsed\)/, "account group indexes must render without leading zeroes");
assert.doesNotMatch(app, /계정별 공개 근거를 기준으로|Gate는 각 전용 영역에서 판단|새로 확인된 고객/, "retired account-evidence guidance and new-customer copy must stay out of the console");
assert.doesNotMatch(app, /<span>의사결정 안건<\/span>|선택한 카테고리의 숫자 지표가 없습니다\.|label: "검증 입력"|<article class="hs-readout"><span>EVIDENCE STATUS/, "retired labels and summary cards must not render");
assert.match(app, /const tabRows = enrichedPriceRows\(activeCategory\)\.filter\(priceRowHasNumericHistory\);[\s\S]*?visibleFilters\.forEach/, "price categories without numeric history must stay hidden");
assert.match(app, /const rows = sourceRows\.filter\(priceRowHasNumericHistory\);[\s\S]*?if \(sourceRows\.length\) \{[\s\S]*?section\.hidden = true;/, "history-only placeholder categories must not render as rows");
assert.doesNotMatch(app, /class="hs-card-top"/, "account demand cards must not repeat the retired direction-history label");
assert.doesNotMatch(app, /class="hs-pull-label"/, "account demand cards must not repeat the retired memory-demand label");
assert.doesNotMatch(app, /<em>\$\{fmtNum\(pairs\.length\)\}개<\/em>/, "the question library must not render a standalone result-count badge");
assert.doesNotMatch(app, /연결 가격|qa-current-price|qaRelatedPrices/, "linked price summaries and lists must stay out of QA detail views");
assert.match(app, /<strong><b>0<\/b><span>WHAT CHANGED · 7D<\/span><\/strong>/, "the seven-day change window must sit before account groups as index zero instead of looking like index seven");
assert.ok(
  app.indexOf("<strong><b>0</b><span>WHAT CHANGED · 7D</span></strong>") < app.indexOf("${groupedAccounts.length ? groupedAccounts.map"),
  "the zero-indexed change window must render before account groups one through six",
);
assert.match(app, /groupIndexLabel\(group\.index, groupIndex \+ 1\)/, "every account group, including Other Accounts, must use one numbering rule");
assert.match(app, /sc-report sc-consulting-report[\s\S]*?data-group-tone="\$\{\(groupIndex % 5\) \+ 1\}"/, "account groups must carry an explicit consulting tone instead of depending on DOM position");
assert.match(app, /--account-columns:\$\{/, "account grids must expose their desktop column contract");
assert.match(styles, /\.sc-consulting-report\[data-group-tone="1"\][\s\S]*?\.sc-consulting-report\[data-group-tone="5"\]/, "account groups must expose the complete five-tone consulting palette");
assert.match(styles, /@media \(max-width: 1100px\)[\s\S]*?repeat\(2,[\s\S]*?:has\(> :only-child\)/, "account groups must collapse to two tablet columns while preserving a full-width single account");
assert.match(app, /const setPageLocked = \(locked\)[\s\S]*?qa-library-open[\s\S]*?backdrop\.hidden = !locked/, "the QA library must lock and dim the background as one overlay state");
assert.match(styles, /html\.qa-library-open,[\s\S]*?body\.qa-library-open \{[\s\S]*?overflow: hidden !important/, "an open QA library must prevent background scrolling");
assert.match(styles, /\.qa-backdrop \{[\s\S]*?position: fixed;[\s\S]*?inset: 0;[\s\S]*?z-index: 1000;/, "the QA library must provide a full-page backdrop");
assert.match(app, /const NEWS_INITIAL_RENDER_LIMIT = 9;/, "the verified news archive must show a useful first page instead of one teaser");
assert.match(app, /sortedItems\.slice\(0, initialCount\)\.forEach\(appendItem\)/, "the first news page must render before expansion");
assert.doesNotMatch(app, /개 후속 기사 펼치기/, "news controls must not expose crawl-style operational counts");
assert.match(app, /a\.dataset\.briefCopy = "verbatim";[\s\S]*?a\.dataset\.copyVerbatim = "1";[\s\S]*?a\.textContent = newsTitle\(item\);/, "source headlines must preserve exact whitespace and punctuation across both copy normalizers");
assert.doesNotMatch(app, /a\.innerHTML = strategicHighlightHTML\(newsTitle\(item\)\)/, "headline highlighting must not join words or corrupt source evidence");

assert.match(companyProfile, /function roadmapFieldHTML/, "roadmap fields must have a dedicated evidence renderer");
assert.match(companyProfile, /row\.fieldEvidence\?\.\[field\]/, "roadmap fields must read their own provenance descriptor");
assert.match(companyProfile, /!value \|\| !url \|\| !\/\^\\d\{1,2\}\\\/\\d\{1,2\}\$\//, "roadmap fields without value, exact URL, or day-level date must fail closed");
assert.match(companyProfile, /공식 기반 해석/, "roadmap interpretation must be distinct from official fact");
assert.match(companyProfile, /공식 공개 경계/, "roadmap disclosure boundaries must remain explicit");
assert.doesNotMatch(companyProfile.match(/function roadmapHTML[\s\S]*?\n  function baselineHTML/)?.[0] || "", /row\.(?:hbm|bandwidth|ramp|attach) \|\| "미확인"/, "roadmap must not expose unsupported placeholders as content");

console.log(JSON.stringify({ status: "console-evidence-ux-pass" }, null, 2));
