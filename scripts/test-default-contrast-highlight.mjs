import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [html, css, landing, modelText, artifactText] = await Promise.all([
  readFile(new URL("index.html", root), "utf8"),
  readFile(new URL("assets/css/landing.css", root), "utf8"),
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
assert.match(css, /Automation status is always legible[\s\S]*?\.business-data-status \{[\s\S]*?color:\s*#f7fbff;[\s\S]*?background:[\s\S]*?#071522;[\s\S]*?\.business-data-status\.business-reveal \{[\s\S]*?opacity:\s*1;/, "automation text must remain visible before reveal animation completes");
assert.match(css, /\.business-data-status :is\(\.business-data-status-main strong, \.business-automation-flow strong, dd\)[\s\S]*?color:\s*#f7fbff;[\s\S]*?\.business-data-status :is\(small, dt, \.business-automation-flow small\)[\s\S]*?color:\s*#c5d4de;/, "automation labels and values must use high-contrast default colors");

assert.deepEqual(artifact.presentation.emphasisTerms, model.presentation.emphasisTerms);
assert.equal(artifact.presentation.emphasisPolicy.style, "underline-only");
assert.ok(artifact.presentation.emphasisPolicy.maxTotal <= 10);
assert.equal(artifact.presentation.emphasisPolicy.maxPerSection, 1);
assert.match(landing, /function highlightBusinessKeyTerms\(root = site, policy = presentationPolicy\)/);
assert.match(landing, /createTreeWalker[\s\S]*?NodeFilter\.SHOW_TEXT/);
assert.match(landing, /parent\.closest\("mark, script, style[\s\S]*?business-key-term/);
assert.match(landing, /maxPerSection[\s\S]*?maxTotal[\s\S]*?total >= maxTotal/);
assert.match(landing, /highlightBusinessKeyTerms\(site, content\.presentation\)/, "every generated refresh must reapply the sparse emphasis policy");
assert.match(landing, /applyPresentationPolicy\(content\.presentation\)/);
assert.match(html, /infra-20260816-22/);
assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.business-competency-output[\s\S]*?grid-column:\s*2 !important[\s\S]*?\.business-llm-causal-chain,[\s\S]*?\.business-contract-funnel[\s\S]*?overflow-x:\s*visible/);

console.log(JSON.stringify({
  defaultContrast: `${minimumDefaultContrast.toFixed(2)}:1`,
  correctedSurface: "framework-panel + workload-map",
  keywordHighlight: "sparse amber underline only",
  dynamicRefresh: true,
}, null, 2));
