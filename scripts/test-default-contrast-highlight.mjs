import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [html, css, consoleCss, consoleApp, landing, modelText, artifactText] = await Promise.all([
  readFile(new URL("index.html", root), "utf8"),
  readFile(new URL("assets/css/landing.css", root), "utf8"),
  readFile(new URL("assets/css/styles.css", root), "utf8"),
  readFile(new URL("assets/js/app.js", root), "utf8"),
  readFile(new URL("assets/js/landing.js", root), "utf8"),
  readFile(new URL("data/site-content-model.json", root), "utf8"),
  readFile(new URL("data/site-content-client.json", root), "utf8"),
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
  ["#102c43", "#eaf1f5"],
  ["#40596c", "#eaf1f5"],
  ["#f7fbff", "#17394f"],
  ["#d4e2eb", "#17394f"],
  ["#6f4c00", "#fff4cf"],
];
const minimumDefaultContrast = Math.min(...defaultContrastPairs.map(([foreground, background]) => contrastRatio(foreground, background)));
assert.ok(minimumDefaultContrast >= 4.5, `default text contrast must remain WCAG AA; received ${minimumDefaultContrast.toFixed(2)}:1`);

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
assert.match(consoleCss, /\.consulting-system \.sc-card \{[\s\S]*?--sc-readable-ink:\s*#13263a;[\s\S]*?--sc-hover-surface:\s*#102b3d;/, "consulting strategy cards must define explicit readable and inverted palettes");
assert.match(consoleCss, /\.consulting-system \.sc-card:is\(:hover, :focus-visible, :focus-within\)[\s\S]*?background:\s*var\(--sc-hover-surface\);[\s\S]*?color:\s*var\(--sc-hover-ink\);/, "consulting strategy cards must invert their full surface on hover and keyboard focus");
assert.match(consoleCss, /\.consulting-system \.sc-card:is\(:hover, :focus-visible, :focus-within\) \.strategy-highlight \{[\s\S]*?color:\s*var\(--sc-hover-key\) !important;[\s\S]*?-webkit-text-fill-color:\s*var\(--sc-hover-key\);/, "highlighted strategy terms must remain readable on the inverted surface");
assert.match(consoleCss, /\.consulting-system \.sc-card-flow \{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*100%;[\s\S]*?min-width:\s*0;/, "the five-step consulting map must remain within the card width");
assert.match(consoleApp, /<article class="sc-card" tabindex="0"/, "consulting strategy cards must expose the same inversion to keyboard users");

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
assert.match(landing, /function setupReadabilityGuard\(\)[\s\S]*?MutationObserver[\s\S]*?memory-console-ready/, "the readability audit must cover both initial and asynchronously rendered Console content");
assert.match(landing, /READABILITY_TEXT_SELECTOR[\s\S]*?"th", "td", "i", "text"/, "dense tables and chart labels must be included in the computed typography audit");
assert.match(landing, /function applySparseConsoleEmphasis[\s\S]*?total >= 36[\s\S]*?consoleKeyTerms/, "Console emphasis must remain sparse across dynamically rendered sections");
assert.match(css, /Site-wide readability and consulting visual governance[\s\S]*?\.business-site :is\(\.ui-text-floor\)[\s\S]*?font-size:\s*clamp\(12px, \.65vw, 13px\) !important;/, "landing typography must define a computed minimum-size contract");
assert.match(css, /data-hover-mode="light-to-dark"[\s\S]*?--motion-surface-hover:\s*#102c43;[\s\S]*?data-hover-mode="dark-to-light"[\s\S]*?--motion-surface-hover:\s*#f7fbff;/, "landing hover inversion must provide explicit palettes in both directions");
assert.match(consoleCss, /Console typography, inversion and infographic contract[\s\S]*?\.consulting-system \.ui-text-floor[\s\S]*?font-size:\s*clamp\(12px, \.65vw, 13px\) !important;/, "Console typography must share the computed minimum-size contract");
assert.match(consoleCss, /\.visual-insight-route span::before[\s\S]*?counter\(insight-route, decimal-leading-zero\)[\s\S]*?border-radius:\s*50%;/, "visual synthesis routes must use numbered consulting badges");
assert.match(consoleCss, /\.strategy-highlight, \.answer-term\):not\(\.ui-key-term\)[\s\S]*?box-shadow:\s*none !important;[\s\S]*?\.strategy-highlight, \.answer-term\)\.ui-key-term[\s\S]*?inset 0 -2px 0 #d5a400/, "only selected Console terms may receive the amber underline");
assert.match(consoleCss, /\.decision-card, \.decision-flip-card, \.domain-agent-workstream[\s\S]*?--console-hover-surface:\s*#102b3d;[\s\S]*?\[data-theme="dark"\][\s\S]*?--console-hover-surface:\s*#f8fafc;/, "Console decision cards must invert legibly in light and dark modes");
assert.match(html, /infra-20260817-40/);
assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.business-competency-output[\s\S]*?grid-column:\s*2 !important[\s\S]*?\.business-llm-causal-chain,[\s\S]*?\.business-contract-funnel[\s\S]*?overflow-x:\s*visible/);

console.log(JSON.stringify({
  defaultContrast: `${minimumDefaultContrast.toFixed(2)}:1`,
  correctedSurface: "framework-panel + workload-map",
  keywordHighlight: "sparse amber underline only",
  typographyFloor: "computed 12px",
  inversionModes: "light-to-dark + dark-to-light",
  dynamicRefresh: true,
}, null, 2));
