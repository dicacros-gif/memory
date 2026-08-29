import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [html, css, consoleCss, mbbCss, consoleApp, landing, modelText, artifactText, baseline] = await Promise.all([
  readFile(new URL("index.html", root), "utf8"),
  readFile(new URL("assets/css/landing.css", root), "utf8"),
  readFile(new URL("assets/css/styles.css", root), "utf8"),
  readFile(new URL("assets/css/mbb-frames.css", root), "utf8"),
  readFile(new URL("assets/js/app.js", root), "utf8"),
  readFile(new URL("assets/js/landing.js", root), "utf8"),
  readFile(new URL("data/site-content-model.json", root), "utf8"),
  readFile(new URL("data/site-content-client.json", root), "utf8"),
  readFile(new URL("data/baseline.json", root), "utf8"),
]);
const model = JSON.parse(modelText);
const artifact = JSON.parse(artifactText);

function relativeLuminance(hex) {
  const channels = hex.match(/[a-f\d]{2}/gi).map((value) => Number.parseInt(value, 16) / 255);
  const [red, green, blue] = channels.map((value) => value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return .2126 * red + .7152 * green + .0722 * blue;
}

function contrastRatio(foreground, background) {
  const values = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}

const defaultContrastPairs = [
  ["#183248", "#ffffff"],
  ["#08766f", "#ffffff"],
  ["#40596c", "#f5f8fa"],
  ["#c5d4de", "#071522"],
  ["#102c43", "#f7fbff"],
  ["#13263a", "#ffffff"],
  ["#344b61", "#ffffff"],
  ["#f8fbff", "#102b3d"],
  ["#d6e4ee", "#102b3d"],
  ["#13263a", "#f8fafc"],
  ["#40546a", "#f8fafc"],
  ["#102c43", "#eaf1f5"],
  ["#40596c", "#eaf1f5"],
  ["#f7fbff", "#17394f"],
  ["#d4e2eb", "#17394f"],
  ["#6f4c00", "#fff4cf"],
  ["#17324d", "#ffffff"],
  ["#44566d", "#ffffff"],
  ["#f5f9ff", "#111827"],
  ["#c3cfdd", "#111827"],
];
const minimumDefaultContrast = Math.min(...defaultContrastPairs.map(([foreground, background]) => contrastRatio(foreground, background)));
assert.ok(minimumDefaultContrast >= 4.5, `default text contrast must remain WCAG AA; received ${minimumDefaultContrast.toFixed(2)}:1`);

const sidebarStateContrastPairs = [
  // Inactive copy on both ends of the permanent navy rail gradient.
  ["#eef6fa", "#071e2d"],
  ["#eef6fa", "#04111b"],
  ["#bdccd5", "#071e2d"],
  ["#bdccd5", "#04111b"],
  // Hover/focus and selected surfaces.
  ["#121826", "#f8fbff"],
  ["#4b5565", "#f8fbff"],
  ["#121826", "#ffffff"],
  ["#4b5565", "#ffffff"],
  ["#ffffff", "#151b2a"],
  ["#d7dfeb", "#151b2a"],
];
const minimumSidebarContrast = Math.min(...sidebarStateContrastPairs.map(([foreground, background]) => contrastRatio(foreground, background)));
assert.ok(minimumSidebarContrast >= 4.5, `sidebar default, hover, focus and selected text must remain WCAG AA; received ${minimumSidebarContrast.toFixed(2)}:1`);
assert.ok(contrastRatio("#efb641", "#071e2d") >= 3, "sidebar focus ring must remain distinguishable on the navy rail");

assert.match(css, /Default-state contrast contract[\s\S]*?\.business-pain-framework \.business-framework-panel dd[\s\S]*?color:\s*#183248/);
assert.match(css, /\.business-pain-framework \.business-framework-panel dt[\s\S]*?color:\s*#08766f/);
assert.match(css, /\.business-solutions \.business-workload-map[\s\S]*?color:\s*#102c43[\s\S]*?background:\s*#f5f8fa/);
assert.match(css, /\.business-role-outputs p,[\s\S]*?\.business-automation-flow small,[\s\S]*?color:\s*#c5d4de/);
assert.match(css, /Sparse decision emphasis[\s\S]*?mark\.business-key-term[\s\S]*?color:\s*inherit !important[\s\S]*?background:\s*transparent !important[\s\S]*?text-decoration-line:\s*underline[\s\S]*?text-decoration-color:\s*#d5a400/);
assert.doesNotMatch(css, /mark\.business-key-term[\s\S]{0,500}#ffe36b/, "decision terms must not use a filled yellow marker");
assert.match(css, /\.business-competency-card \.business-card-index \{[\s\S]*?inline-size:\s*42px;[\s\S]*?block-size:\s*42px;[\s\S]*?border:\s*2px solid currentColor;[\s\S]*?border-radius:\s*50%;[\s\S]*?font:\s*900 19px\/1 var\(--mono\);/, "capability step numbers must remain large, centered circular badges");
assert.match(css, /\.business-competency-card h3 \{[\s\S]*?font-size:\s*20px;[\s\S]*?\.business-card-evidence li \{[\s\S]*?color:\s*#e8f2f8;[\s\S]*?font-size:\s*12\.5px;/, "capability headings and evidence copy must be larger and explicitly legible on the dark surface");
assert.match(css, /\.business-competency-card > ul:not\(\.business-card-evidence\) li \{[\s\S]*?color:\s*#d9e9f2;[\s\S]*?font:\s*760 11\.5px\/1\.35 var\(--mono\);/, "capability detail rows must use the intended selector and high-contrast copy");
assert.match(css, /\.business-site \.business-competency-card mark\.business-key-term \{[\s\S]*?background:\s*transparent !important;[\s\S]*?text-decoration-color:\s*#ffd24f !important;/, "capability key terms must use a restrained yellow underline without a filled marker");
assert.match(css, /Automation status is always legible[\s\S]*?\.business-data-status \{[\s\S]*?color:\s*#f7fbff;[\s\S]*?background:[\s\S]*?#071522;[\s\S]*?\.business-data-status\.business-reveal \{[\s\S]*?opacity:\s*1;/, "automation text must remain visible before reveal animation completes");
assert.match(css, /\.business-data-status :is\(\.business-data-status-main strong, \.business-automation-flow strong, dd\)[\s\S]*?color:\s*#f7fbff;[\s\S]*?\.business-data-status :is\(small, dt, \.business-automation-flow small\)[\s\S]*?color:\s*#c5d4de;/, "automation labels and values must use high-contrast default colors");
assert.match(css, /\.business-team-workstreams h3 \{[\s\S]*?color:\s*#fff;[\s\S]*?\.business-team-workstreams dd \{[\s\S]*?color:\s*#edf6fb;/, "team workstream cards must remain legible before hover");
assert.match(css, /\.business-team-workstreams > article:is\(:hover, :focus-visible\)[\s\S]*?background:\s*#fff;[\s\S]*?\.business-team-workstreams > article:is\(:hover, :focus-visible\) dd \{ color:\s*#29465c;/, "inverted workstream cards must retain readable text");
assert.match(css, /Nested inversion contract[\s\S]*?\.business-rag-operating-model\[data-hover-mode="dark-to-light"\]:is\(:hover, :focus-within\) > ol > li,[\s\S]*?background:\s*#eaf1f5 !important;/, "RAG pipeline and maturity panels must invert with their parent surface");
assert.match(css, /\.business-rag-operating-model\[data-hover-mode="dark-to-light"\]:is\(:hover, :focus-within\) > ol > li strong,[\s\S]*?color:\s*#102c43 !important;/, "RAG pipeline copy must stay dark on the inverted light panels");
assert.match(css, /\.business-rag-operating-model\[data-hover-mode="dark-to-light"\]:is\(:hover, :focus-within\) \.business-rag-maturity b \{[\s\S]*?color:\s*#071522 !important;[\s\S]*?background:\s*#69dfc3 !important;/, "RAG maturity level badges must retain their own readable contrast");
assert.match(css, /\.business-kpi-tree\[data-hover-mode="light-to-dark"\]:is\(:hover, :focus-within\) article,[\s\S]*?\.business-partner-map\[data-hover-mode="light-to-dark"\]:is\(:hover, :focus-within\) li[\s\S]*?background:\s*#17394f !important;/, "nested KPI and partner panels must darken with a light-to-dark parent");
assert.match(css, /\.business-contact-card\[data-hover-mode="dark-to-light"\]:is\(:hover, :focus-within\) :is\(a, button\)[\s\S]*?color:\s*#102c43 !important;[\s\S]*?background:\s*#ffffff !important;/, "contact actions must remain readable when the dark card flips to paper");
assert.match(consoleCss, /\.consulting-system \.sc-card \{[\s\S]*?--sc-readable-ink:\s*#13263a;[\s\S]*?--sc-hover-surface:\s*color-mix\(in srgb, var\(--sc-accent, #2d6bff\) 24%, #102b3d\);/, "consulting strategy cards must derive varied, readable inverted palettes from each card accent");
assert.match(consoleCss, /#intelligenceConsole #strategyConsulting :is\(article,[\s\S]*?background:\s*rgba\(11,31,47,\.96\) !important;/, "consulting strategy cards must keep their parent canvas fixed in the dark decision system");
assert.doesNotMatch(consoleCss, /\.consulting-system \.sc-card:is\(:hover, :focus-visible, :focus-within\)/, "parent strategy cards must not invert as one oversized hover target");
assert.match(consoleCss, /\.consulting-system :is\(\.sc-case-thesis, \.sc-map-node\):is\(:hover, :focus-visible, :focus-within\)[\s\S]*?background:\s*var\(--sc-hover-surface\);[\s\S]*?color:\s*var\(--sc-hover-ink\);/, "JTBD and 01–05 decision boxes must invert independently");
assert.match(consoleCss, /:is\(\.sc-case-thesis, \.sc-map-node\):is\(:hover, :focus-visible, :focus-within\) \.strategy-highlight \{[\s\S]*?color:\s*var\(--sc-hover-key\) !important;[\s\S]*?-webkit-text-fill-color:\s*var\(--sc-hover-key\);/, "highlighted strategy terms must remain readable inside the active small box");
assert.match(consoleCss, /Decision-box inversion lock[\s\S]*?:is\(\.sc-case-thesis, \.sc-map-node\):is\(:hover, :focus-visible, :focus-within\)[\s\S]*?\.ui-contrast-on-dark, \.ui-contrast-on-light[\s\S]*?color:\s*var\(--sc-hover-ink\) !important;/, "small-box hover colors must outrank cached automatic contrast tags");
assert.match(consoleCss, /\.consulting-system \.sc-card-flow \{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*100%;[\s\S]*?min-width:\s*0;/, "the five-step consulting map must remain within the card width");
assert.match(consoleCss, /#intelligenceConsole #strategyConsulting :is\(\.sc-framework-steps,\.sc-card-flow,\.sc-memory-flow,\.sc-radar-layers\)>li \{[\s\S]*?background:linear-gradient\(125deg,var\(--mbb-step\)[\s\S]*?clip-path:polygon\(/, "multi-stage diagrams must share one continuous consulting ribbon surface");
assert.match(consoleCss, /#intelligenceConsole #strategyConsulting :is\(\.sc-framework-steps,\.sc-card-flow,\.sc-memory-flow,\.sc-radar-layers\)>li:is\(:hover,:focus-visible,:focus-within\) \{[\s\S]*?background:#f7fafb !important;/, "each ribbon stage must invert independently on hover or keyboard focus");
assert.match(mbbCss, /Hover inversion lock:[\s\S]*?\.mbb-section :is\([\s\S]*?\.mbb-record[\s\S]*?:is\(:hover, :focus-within\)[\s\S]*?background: #f3f1eb !important;[\s\S]*?-webkit-text-fill-color: #102635 !important;/, "MBB paper inversion must override cached white-text contrast classes");
assert.match(mbbCss, /\.mbb-section :is\(\.mbb-play, \.mbb-matrix-row\):is\(:hover, :focus-within\) > \*[\s\S]*?background: #f3f1eb !important;[\s\S]*?color: #102635 !important;/, "MBB table rows must invert every cell and keep dark text");
assert.match(consoleCss, /#intelligenceConsole#intelligenceConsole :is\(\.sc-level-index,[\s\S]*?\.sc-radar-layers>li>b\) \{[\s\S]*?background:transparent !important;/, "stage indices must use flat consulting labels rather than circular AI badges");
assert.match(consoleCss, /transition:background \.025s linear,color \.025s linear,border-color \.025s linear,transform \.025s ease-out !important;[\s\S]*?transition-delay:0s !important;/, "stage-card color inversion must occur without perceptible delay");
assert.match(consoleApp, /class="sc-framework-steps"[\s\S]*?<span>Account<\/span>[\s\S]*?<span>Workload<\/span>[\s\S]*?<span>Pain Point<\/span>[\s\S]*?<span>Buying Criteria<\/span>/, "the MECE customer framework must follow the account-to-buying-criteria sequence");
assert.match(consoleApp, /class="sc-framework-steps"[\s\S]*?<b>1<\/b>[\s\S]*?<b>2<\/b>[\s\S]*?<b>3<\/b>[\s\S]*?<b>4<\/b>/, "the four-stage customer framework must use single-digit 1–4 labels without leading zeroes");
assert.match(consoleApp, /class="sc-partner sc-account-card" tabindex="0"/, "every account card must expose its independent inversion to keyboard users");
assert.match(consoleApp, /sc-partner-row"><b>WORKLOAD<\/b>[\s\S]*?sc-partner-row"><b>PAIN POINT<\/b>[\s\S]*?sc-partner-row"><b>BUYING CRITERIA<\/b>/, "account cards must render the three non-overlapping decision dimensions explicitly");
assert.match(consoleCss, /\.consulting-system \.sc-level-index \{[\s\S]*?width:\s*max-content;[\s\S]*?white-space:\s*nowrap;[\s\S]*?word-break:\s*normal;/, "short level indices must never wrap into vertical letters");
assert.match(consoleCss, /\.sc-level-index\.is-input[\s\S]*?\.sc-level-index\.is-hw,[\s\S]*?\.sc-level-index\.is-sw,[\s\S]*?\.sc-level-index\.is-gate/, "decision levels must use a restrained color-coded index system");
assert.match(consoleCss, /\.consulting-system \.score-ring::after \{[\s\S]*?content:\s*none;[\s\S]*?display:\s*none;/, "score tiles must not render a second label over DATA");
assert.match(consoleCss, /\.consulting-system \.score-ring small \{[\s\S]*?position:\s*static;[\s\S]*?white-space:\s*nowrap;/, "score labels must occupy their own non-overlapping row");
assert.match(consoleApp, /data-source-date="\$\{escapeHTML\(item\.publishedAt \|\| ""\)\}"[\s\S]*?<time datetime="\$\{escapeHTML\(item\.publishedAt \|\| reportCutoffDate\)\}">\$\{escapeHTML\(shortKstDate\(item\.publishedAt \|\| reportCutoffDate\) \|\| reportCutoffLabel\)\}<\/time>/, "broker cards must display each source date as M\/D while retaining its machine-readable date");
assert.match(consoleApp, /class="exec-baseline-level-index contrast-surface">L\$\{String\(index \+ 1\)\.padStart\(2, "0"\)\}<\/span>/, "broker cards must render a boxed level index instead of a circular number");
assert.match(consoleCss, /Broker baseline hierarchy[\s\S]*?--report-level-bg:\s*color-mix\(in srgb, var\(--report-accent\) 58%, #102c43\);[\s\S]*?\.exec-baseline-level-index[\s\S]*?border-radius:\s*4px;[\s\S]*?\.exec-baseline-points b[\s\S]*?white-space:\s*nowrap;/, "broker card indices must use accessible colored boxes with non-wrapping labels");
assert.match(consoleCss, /Memory-bypass readability lock[\s\S]*?--mbp-readable-ink:\s*#17324d;[\s\S]*?--mbp-readable-muted:\s*#44566d;[\s\S]*?\.mbp-route-copy strong[\s\S]*?color:\s*var\(--mbp-readable-ink\) !important;[\s\S]*?\.mbp-tl-items li[\s\S]*?color:\s*var\(--mbp-readable-muted\) !important;/, "memory bypass route and timeline copy must stay legible on light cards despite cached contrast classes");
assert.match(consoleCss, /Council agenda contrast lock[\s\S]*?--agenda-surface:\s*#ffffff;[\s\S]*?--agenda-ink:\s*#17324d;[\s\S]*?--agenda-muted:\s*#40546a;/, "council agendas must define an explicit readable palette on light surfaces");
assert.match(consoleCss, /Architecture matrix — consulting decision palette[\s\S]*?\.ai-summary-tone-0[\s\S]*?\.arch-track-tone-1[\s\S]*?\.advanced-module-tone-2/, "the architecture matrix must use one restrained consulting palette across implication, track and evidence layers");
assert.doesNotMatch(baseline, /출처\s*확인\s*필요/, "unverified source placeholders must not render as architecture score values");
assert.match(consoleCss, /\.ai-council-agenda-card:is\(:hover, :focus-visible\)[\s\S]*?--agenda-surface:\s*#17394f;[\s\S]*?--agenda-ink:\s*#f7fbff;[\s\S]*?\[data-theme="dark"\][\s\S]*?--agenda-surface:\s*#f8fafc;[\s\S]*?--agenda-ink:\s*#13263a;/, "council agendas must invert surface and copy together in both themes");
assert.match(consoleCss, /\.ai-council-agenda-card > :is\(strong, span\),[\s\S]*?color:\s*var\(--agenda-ink\) !important;[\s\S]*?-webkit-text-fill-color:\s*var\(--agenda-ink\) !important;/, "cached automatic contrast classes must not hide council agenda copy");
assert.match(consoleCss, /Equity value-chain readability lock[\s\S]*?--equity-readable-ink:\s*#17324d;[\s\S]*?--equity-readable-muted:\s*#40546a;[\s\S]*?--equity-readable-accent:\s*#08766f;/, "the listed value-chain must define an explicit light-surface palette");
assert.match(consoleCss, /\.equity-chain-lane button > span[\s\S]*?color:\s*var\(--equity-item-ink\) !important;[\s\S]*?font-size:\s*11px;[\s\S]*?\.equity-chain-lane button > em[\s\S]*?font-size:\s*10px;/, "value-chain labels and company counts must remain large and readable");
assert.match(consoleCss, /\.equity-chain-lane button:is\(:hover, :focus-visible\)[\s\S]*?--equity-item-ink:\s*#f7fbff;[\s\S]*?background:\s*#17394f !important;[\s\S]*?\[data-theme="dark"\][\s\S]*?--equity-item-ink:\s*#13263a;[\s\S]*?background:\s*#f8fafc !important;/, "value-chain buttons must invert surface and copy together in both themes");

assert.deepEqual(artifact.presentation.emphasisTerms, model.presentation.emphasisTerms);
assert.equal(artifact.presentation.emphasisPolicy.style, "underline-only");
assert.ok(artifact.presentation.emphasisPolicy.maxTotal <= 10);
assert.equal(artifact.presentation.emphasisPolicy.maxPerSection, 1);
for (const term of ["Customer Problem", "Full-Stack AI Infra", "Business Case"]) {
  assert.ok(model.presentation.emphasisTerms.includes(term), `presentation model must preserve the capability emphasis term: ${term}`);
}
assert.match(landing, /function highlightBusinessKeyTerms\(root = site, policy = presentationPolicy\)/);
assert.match(landing, /createTreeWalker[\s\S]*?NodeFilter\.SHOW_TEXT/);
assert.match(landing, /parent\.closest\("mark, script, style[\s\S]*?business-key-term/);
assert.match(landing, /maxPerSection[\s\S]*?maxTotal[\s\S]*?total >= maxTotal/);
assert.match(landing, /highlightBusinessKeyTerms\(site, content\.presentation\)/, "every generated refresh must reapply the sparse emphasis policy");
assert.match(landing, /applyPresentationPolicy\(content\.presentation\)/);
assert.match(landing, /function applyReadabilityGuard\(root = document\.body\)[\s\S]*?fontSize < 12/, "rendered and refreshed text must receive the global 12px readability floor");
assert.match(landing, /function colorChannels\(value = ""\)[\s\S]*?source\.startsWith\("color\("\)[\s\S]*?channel \* 255/, "computed color-mix values must be normalized from CSS color() channels before contrast scoring");
assert.match(landing, /function gradientReadableSurface\(value = ""\)[\s\S]*?const colors = [\s\S]*?samples\.reduce/, "gradient cards must be sampled before assigning an inversion palette");
assert.match(landing, /function computedReadableSurface\(style\)[\s\S]*?gradientReadableSurface\(style\.backgroundImage\)[\s\S]*?parseRgb\(style\?\.backgroundColor/, "hover mode detection must prefer the visible gradient surface");
assert.match(landing, /const styleCache = new WeakMap\(\);[\s\S]*?const updates = \[\];[\s\S]*?updates\.push\(\{ node, needsFloor, needsOpacity, contrastMode \}\)[\s\S]*?for \(const update of updates\)/, "contrast checks must batch computed-style reads before class mutations");
assert.doesNotMatch(landing.match(/function applyReadabilityGuard\([\s\S]*?\n  \}\n\n  function setupReadabilityGuard/)?.[0] || "", /getBoundingClientRect/, "the readability audit must not force geometry for every text node");
assert.match(landing, /function setupReadabilityGuard\(\)[\s\S]*?MutationObserver[\s\S]*?memory-console-ready/, "the readability audit must cover both initial and asynchronously rendered Console content");
assert.match(landing, /memory-console-ready[\s\S]*?IntersectionObserver[\s\S]*?sectionObserver\.unobserve[\s\S]*?rootMargin: "360px 0px"/, "the console readability audit must only scan sections near the viewport");
assert.doesNotMatch(landing, /refreshInteractiveContrast|addEventListener\("pointerover", refreshInteractiveContrast/, "CSS inversion must not trigger computed-style audits on every pointer entry");
assert.doesNotMatch(landing, /setTimeout\(\(\) => schedule\(surface\), 240\)/, "hover contrast must not wait for a delayed second audit");
assert.match(landing, /READABILITY_TEXT_SELECTOR[\s\S]*?"th", "td", "i", "text"/, "dense tables and chart labels must be included in the computed typography audit");
assert.match(landing, /function applySparseConsoleEmphasis[\s\S]*?total >= 36[\s\S]*?consoleKeyTerms/, "Console emphasis must remain sparse across dynamically rendered sections");
assert.match(css, /Site-wide readability and consulting visual governance[\s\S]*?\.business-site :is\(\.ui-text-floor\)[\s\S]*?font-size:\s*clamp\(12px, \.65vw, 13px\) !important;/, "landing typography must define a computed minimum-size contract");
assert.match(css, /data-hover-mode="light-to-dark"[\s\S]*?--motion-surface-hover:\s*#102c43;[\s\S]*?data-hover-mode="dark-to-light"[\s\S]*?--motion-surface-hover:\s*#f7fbff;/, "landing hover inversion must provide explicit palettes in both directions");
assert.match(css, /Instant inversion contract[\s\S]*?business-consulting-motion:is\(:hover, :focus-visible, :focus-within\)[\s\S]*?transition-delay:\s*0s !important;[\s\S]*?\.ui-contrast-on-dark, \.ui-contrast-on-light, \.ui-readable-opacity[\s\S]*?color:\s*var\(--motion-copy-hover\) !important;/, "landing hover colors must switch without inherited reveal delays");
assert.match(consoleCss, /Console typography, inversion and infographic contract[\s\S]*?\.consulting-system \.ui-text-floor[\s\S]*?font-size:\s*clamp\(12px, \.65vw, 13px\) !important;/, "Console typography must share the computed minimum-size contract");
assert.match(consoleCss, /#intelligenceConsole #strategyConsulting :is\(\.sc-framework-steps,\.sc-card-flow,\.sc-memory-flow,\.sc-radar-layers\) \{[\s\S]*?gap:10px !important;/, "all strategy multi-stage maps must read as separated but connected consulting ribbons");
assert.match(consoleCss, /\.strategy-highlight, \.answer-term\):not\(\.ui-key-term\)[\s\S]*?box-shadow:\s*none !important;[\s\S]*?\.strategy-highlight, \.answer-term\)\.ui-key-term[\s\S]*?inset 0 -2px 0 #d5a400/, "only selected Console terms may receive the amber underline");
assert.match(consoleCss, /\.decision-card, \.decision-flip-card, \.domain-agent-workstream[\s\S]*?--console-hover-surface:\s*#102b3d;[\s\S]*?\[data-theme="dark"\][\s\S]*?--console-hover-surface:\s*#f8fafc;/, "Console decision cards must invert legibly in light and dark modes");
assert.match(consoleCss, /Memory-bypass index contrast lock[\s\S]*?\.mbp-thesis-arrow, \.mbp-band-n, \.mbp-tl-marker[\s\S]*?color:\s*#17324d !important;[\s\S]*?\.mbp-route-n[\s\S]*?color:\s*#ffffff !important;[\s\S]*?background:\s*#17324d !important;/, "memory-tier arrows and level indices must retain readable ink over accent surfaces");
assert.match(consoleCss, /Progressive market modules[\s\S]*?\.equity-company-monogram[\s\S]*?color:\s*#17324d !important;[\s\S]*?\.price-sub[\s\S]*?color:\s*#4b5e73 !important;[\s\S]*?data-theme="dark"[\s\S]*?color:\s*#d7e2ee !important;/, "delayed market modules must use mode-safe text colors");
assert.match(consoleCss, /Instant card inversion and contrast lock[\s\S]*?--console-surface:\s*#f8fafc;[\s\S]*?--console-ink:\s*#13263a;[\s\S]*?--console-surface-inverse:\s*#102b3d;[\s\S]*?--console-ink-inverse:\s*#f8fbff;[\s\S]*?\[data-theme="dark"\] #intelligenceConsole[\s\S]*?--console-surface:\s*#102b3d;[\s\S]*?--console-surface-inverse:\s*#f8fafc;/, "Console inversion must swap paired surface and ink tokens in both themes");
assert.match(consoleCss, /#intelligenceConsole :where\([\s\S]*?\):is\(:hover, :focus-visible, :focus-within\)[\s\S]*?transition-delay:\s*0s !important;[\s\S]*?\.ui-contrast-on-dark, \.ui-contrast-on-light[\s\S]*?color:\s*var\(--console-ink-inverse\) !important;/, "active card colors must use the inverse ink token without delay");
assert.match(consoleCss, /Nested news-card contrast lock[\s\S]*?\.consulting-system #intelligenceConsole \.news-card:is\(:hover, :focus-visible, :focus-within\) \.news-insights > li[\s\S]*?background:\s*rgba\(248, 250, 252, \.97\) !important;[\s\S]*?color:\s*#334155 !important;[\s\S]*?> li::before[\s\S]*?color:\s*#08766f !important;/, "nested news bullet rows must retain dark readable ink on light hover surfaces");
assert.match(consoleCss, /Technology-card nested tag contrast lock[\s\S]*?#strategyConsulting \.sc-tech-card \.sc-tech-meta > :is\(span, b\)[\s\S]*?background:\s*#f4f6f7 !important;[\s\S]*?color:\s*#10243a !important;/, "technology-card metadata must keep dark ink on its pale surface in default and inverted states");
assert.match(consoleCss, /Evidence-report row contrast lock[\s\S]*?\.sc-evidence-list li:is\(:hover, :focus-within\)[\s\S]*?background:\s*#f4f7f9 !important;[\s\S]*?\.sc-ev-src[\s\S]*?color:\s*#08766f !important;[\s\S]*?li:is\(:hover, :focus-within\) a[\s\S]*?color:\s*#102c43 !important;/, "evidence rows must invert surface, source, link and date as one readable palette");
assert.match(consoleCss, /Nested paper-surface contrast locks[\s\S]*?\.share-card \.share-metrics > div[\s\S]*?background:\s*#f4f7f9 !important;[\s\S]*?color:\s*#10243a !important;/, "competitor metric tiles must retain dark ink on their paper surfaces");
assert.match(consoleCss, /Nested paper-surface contrast locks[\s\S]*?\.company-strategy-flow > a,[\s\S]*?\.company-focus-card li[\s\S]*?background:\s*#f6f7fb !important;[\s\S]*?color:\s*#10243a !important;/, "company strategy and decision rows must preserve the paper-surface ink pair");
assert.match(consoleCss, /Nested paper-surface contrast locks[\s\S]*?\.company-evidence-meta i[\s\S]*?background:\s*#f1e9ff !important;[\s\S]*?color:\s*#2f2055 !important;/, "company evidence pills must use dark ink on lavender paper");
assert.match(consoleCss, /Professional consulting infographic — dark decision canvas[\s\S]*?\.sc-report,[\s\S]*?border-radius:0 !important;[\s\S]*?box-shadow:none !important;/, "strategy sections must use angular full-perimeter consulting frames instead of rounded AI cards");
assert.match(consoleCss, /#strategyConsulting :is\(article,[\s\S]*?border:1px solid var\(--sc-frame\) !important;[\s\S]*?border-radius:0 !important;[\s\S]*?box-shadow:none !important;/, "customer, technology, and partner cards must share the same flat full-frame system");
assert.match(consoleCss, /#strategyConsulting article:not\(\.sc-card\):is\(:hover,:focus-visible,:focus-within\)[\s\S]*?background:var\(--mbb-local\) !important;[\s\S]*?transform:translateY\(-2px\) !important;/, "small consulting cards must invert immediately with restrained compositor movement");
assert.match(consoleCss, /MBB executive visual system[\s\S]*?--mbb-ink:#102f43;[\s\S]*?--info-cyan:#21d4e8;[\s\S]*?--info-amber:#f5a900;/, "the Console must expose one restrained MBB palette for every executive module");
assert.doesNotMatch(consoleCss, /content:\s*counter\(mbb-board/, "board headings must not render automatic 01-style counter badges");
assert.match(consoleCss, /#strategyConsulting :is\(\.sc-framework-steps,\.sc-card-flow,\.sc-memory-flow,\.sc-radar-layers\)>li[\s\S]*?clip-path:polygon\(0 0,calc\(100% - 18px\) 0,100% 50%/, "the opportunity flow must use connected consulting chevrons instead of generic rounded cards");
assert.match(consoleCss, /Quiet page-build motion[\s\S]*?animation:mbb-section-in \.24s[\s\S]*?@keyframes mbb-section-in[\s\S]*?transform:translateY\(8px\)[\s\S]*?transform:translateY\(0\)/, "consulting sections must animate with a short compositor-only entrance");
assert.doesNotMatch(consoleCss, /@keyframes mbb-flow-pulse/, "stage ribbons must avoid decorative connector animation");
assert.match(consoleCss, /@media \(prefers-reduced-motion:reduce\)[\s\S]*?animation:none !important;[\s\S]*?transition-duration:0s !important;/, "all MBB diagram motion must honor reduced-motion preferences");
assert.match(consoleCss, /Console semantic-mark and source-pill contrast contract[\s\S]*?#ffe45e !important;[\s\S]*?color:\s*#16120a !important;[\s\S]*?-webkit-text-fill-color:\s*#16120a !important;/, "yellow semantic marks must keep dark readable text in default and inverted cards");
assert.match(consoleCss, /\.ni-research-list li\.ni-cite:is\(:hover, :focus-within\) \.ni-cite-src[\s\S]*?background:\s*#dff8f2 !important;[\s\S]*?color:\s*#073b3a !important;/, "publisher pills must keep dark readable text on their pale surface during inversion");
assert.match(consoleCss, /\.ni-cite \.crawl-remove-button:is\(:hover, :focus-visible\)[\s\S]*?background:\s*#ffe45e !important;[\s\S]*?color:\s*#16120a !important;/, "citation close controls must remain readable on hover and keyboard focus");
assert.match(consoleCss, /ASIC evidence-badge contrast lock[\s\S]*?\.sc-asic-priority-card:is\(:hover, :focus-visible, :focus-within\) \.sc-asic-card-head em[\s\S]*?background:\s*#e7f7f4 !important;[\s\S]*?color:\s*#0d4744 !important;[\s\S]*?-webkit-text-fill-color:\s*#0d4744 !important;/, "ASIC evidence badges must keep dark readable ink on their pale surface during card inversion");
assert.match(consoleCss, /Advanced decision module contrast lock[\s\S]*?\.advanced-module-card:is\(:hover, :focus-visible, :focus-within\) \.advanced-score[\s\S]*?background:\s*#f8fafc !important;[\s\S]*?color:\s*#17263a !important;/, "advanced scorecards must keep dark ink on paper during parent-card inversion");
assert.match(consoleCss, /\.advanced-module-card:is\(:hover, :focus-visible, :focus-within\) \.advanced-score strong[\s\S]*?color:\s*#0d5360 !important;[\s\S]*?\.advanced-module-card:is\(:hover, :focus-visible, :focus-within\) \.advanced-score small[\s\S]*?color:\s*#33465a !important;/, "advanced score values and notes must remain visible in the inverted state");
const nestedSurfaceMarkers = [
  '[class*="-tag"]',
  '[class*="-badge"]',
  '[class*="-status"]',
  '[class*="-date"]',
  ".chip",
  ".insight-box",
  ".contrast-surface",
];
for (const selector of nestedSurfaceMarkers) {
  assert.ok(consoleCss.includes(selector), `${selector} must participate in the nested-surface contrast contract`);
}
const nestedSurfaceExclusion = /:not\(:where\([\s\S]*?\.contrast-surface[\s\S]*?\)\s*\*\)/g;
assert.ok((consoleCss.match(nestedSurfaceExclusion) || []).length >= 2, "main and muted inversion rules must both preserve nested surfaces and their descendants");
assert.match(consoleCss, /\.ui-contrast-on-light\):not\(:where\([\s\S]*?\.contrast-surface[\s\S]*?\)\):not\(:where\(/, "primary inversion exclusions must chain onto the text target without a descendant combinator");
assert.match(consoleCss, /\[class\*="-sub"\]\):not\(:where\([\s\S]*?\.contrast-surface[\s\S]*?\)\):not\(:where\(/, "muted inversion exclusions must chain onto the text target without a descendant combinator");
for (const marker of [
  'hs-signal insufficient contrast-surface',
  'baseline-freshness contrast-surface',
  'deep-implication contrast-surface',
  'exec-baseline-document-focus contrast-surface',
  'exec-baseline-metric kpi contrast-surface',
  'market-peer-change contrast-surface',
  '<span class="contrast-surface" style="--series:',
]) {
  assert.ok(consoleApp.includes(marker), `${marker} must opt its self-owned surface out of parent inversion`);
}
assert.doesNotMatch(consoleCss, /Nested surfaces own their ink tokens[\s\S]*?background:\s*#f8fafc !important;/, "the inversion contract must not force a resting nested surface to paper without its original ink pair");
assert.match(consoleCss, /\.talent-roi-story[\s\S]*?--console-surface-inverse:\s*#102b3d;[\s\S]*?--console-ink-inverse:\s*#f8fbff;/, "image-backed talent stories must retain a dark readable hover surface");
assert.match(consoleCss, /\.price-trend-card \.price-axis-label[\s\S]*?fill:\s*var\(--console-muted\) !important;[\s\S]*?\.price-trend-card:is\(:hover, :focus-visible, :focus-within\) \.price-axis-label[\s\S]*?fill:\s*var\(--console-ink-inverse\) !important;/, "SVG price-axis dates must switch between readable base and inverse fills");
assert.match(consoleCss, /\.price-trend-card:is\(:hover, :focus-visible, :focus-within\) \.price-trend-head em[\s\S]*?color:\s*var\(--console-muted-inverse\) !important;/, "price trend status copy must use the inverse muted token with the inverted card surface");
assert.match(consoleCss, /Company fact-row contrast lock[\s\S]*?--company-fact-surface:\s*#eaf1f5;[\s\S]*?--company-fact-ink:\s*#17324d;[\s\S]*?\.company-fact-card li span[\s\S]*?color:\s*var\(--company-fact-ink\) !important;/, "company fact rows must keep dark readable copy on their pale surface");
assert.match(consoleCss, /\.company-fact-card li:is\(:hover, :focus-within\)[\s\S]*?--company-fact-surface:\s*#17394f;[\s\S]*?--company-fact-ink:\s*#f7fbff;[\s\S]*?--company-fact-label:\s*#7fe4d2;/, "company fact rows must invert their surface, value, and label colors together");
assert.match(consoleCss, /Console disclosure button contract[\s\S]*?details\.sc-report > summary\.sc-report-head[\s\S]*?background:\s*var\(--console-surface-inverse\);[\s\S]*?color:\s*var\(--console-ink-inverse\);[\s\S]*?cursor:\s*pointer;/, "collapsible report headers must expose a clear native button surface with paired contrast tokens");
assert.match(consoleCss, /summary\.sc-report-head:is\(:hover, :focus-visible\)[\s\S]*?background:\s*var\(--console-surface\);[\s\S]*?color:\s*var\(--console-ink\);[\s\S]*?summary\.sc-report-head:is\(:hover, :focus-visible\) strong[\s\S]*?translateX\(4px\)/, "report buttons must invert immediately and provide restrained hover motion");
assert.match(consoleCss, /details\.sc-report\[open\] > summary\.sc-report-head::after[\s\S]*?content:\s*"\\2212";/, "open report buttons must expose a visible minus state");
assert.doesNotMatch(consoleApp, /customerRadarContrastStyle/, "runtime style injection must not override the central consulting visual system");
assert.match(html, /id="paletteBtn"[\s\S]*?class="palette-icon"/, "palette control must expose a dedicated live swatch");
assert.match(html, /id="themeBtn"[\s\S]*?data-theme-state="dark"[\s\S]*?class="theme-icon"/, "theme control must render an explicit state icon");
assert.doesNotMatch(html, /id="themeBtn"[^>]*>\s*◐/, "theme control must not use the ambiguous half-circle glyph");
assert.match(consoleApp, /function applyTheme\(theme, options = \{\}\)[\s\S]*?btn\.dataset\.themeState = nextTheme;[\s\S]*?aria-pressed[\s\S]*?현재 \$\{currentLabel\}/, "theme control state, accessible name and icon must stay synchronized");
assert.match(consoleApp, /--palette-color-1[\s\S]*?--palette-color-2[\s\S]*?--palette-color-3[\s\S]*?--palette-sidebar/, "palette swatch must receive the selected preset's actual colors");
assert.match(consoleCss, /Theme-control icons:[\s\S]*?\.palette-btn \.palette-icon[\s\S]*?--palette-color-1[\s\S]*?--palette-color-2[\s\S]*?--palette-color-3[\s\S]*?\.theme-btn\[data-theme-state="dark"\][\s\S]*?\.theme-btn\[data-theme-state="light"\]/, "theme controls must provide live palette, moon and sun artwork without font glyphs");
assert.doesNotMatch(consoleCss, /\.palette-btn \.palette-icon[\s\S]{0,900}?var\(--green\)/, "palette swatch must not mix unrelated semantic green into the selected palette");
assert.match(landing, /averageAlpha < \.6[\s\S]*?backgroundLum < \.18/, "transparent gradients must inherit their base surface and mid-tone panels must use dark ink");
assert.match(html, /infra-[a-f0-9]{12}/);
assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.business-competency-output[\s\S]*?grid-column:\s*2 !important[\s\S]*?\.business-llm-causal-chain,[\s\S]*?\.business-contract-funnel[\s\S]*?overflow-x:\s*visible/);

console.log(JSON.stringify({
  defaultContrast: `${minimumDefaultContrast.toFixed(2)}:1`,
  sidebarContrast: `${minimumSidebarContrast.toFixed(2)}:1`,
  correctedSurface: "framework-panel + workload-map",
  keywordHighlight: "sparse amber underline only",
  typographyFloor: "computed 12px",
  inversionModes: "light-to-dark + dark-to-light",
  dynamicRefresh: true,
}, null, 2));
