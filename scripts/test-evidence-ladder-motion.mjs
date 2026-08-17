import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [html, css, landing] = await Promise.all([
  readFile(new URL("index.html", root), "utf8"),
  readFile(new URL("assets/css/landing.css", root), "utf8"),
  readFile(new URL("assets/js/landing.js", root), "utf8"),
]);

function relativeLuminance(hex) {
  const channels = hex.match(/[a-f\d]{2}/gi).map((value) => Number.parseInt(value, 16) / 255);
  const [red, green, blue] = channels.map((value) => value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return .2126 * red + .7152 * green + .0722 * blue;
}

function contrastRatio(foreground, background) {
  const values = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}

const hoverContrastPairs = [
  ["#f7fbff", "#102c43"],
  ["#d4e2eb", "#102c43"],
  ["#72ddca", "#102c43"],
  ["#102c43", "#f7fbff"],
  ["#40596c", "#f7fbff"],
  ["#08766f", "#f7fbff"],
];
const minimumHoverContrast = Math.min(...hoverContrastPairs.map(([foreground, background]) => contrastRatio(foreground, background)));
assert.ok(minimumHoverContrast >= 4.5, `hover text contrast must remain WCAG AA; received ${minimumHoverContrast.toFixed(2)}:1`);

assert.match(html, /EXECUTIVE EVIDENCE SYNTHESIS · 4-STEP FRAME/);
assert.match(html, /SOURCE GRADE → BUSINESS IMPACT → GATE QUESTION → OWNER · KPI · KILL CRITERIA/);
assert.equal((html.match(/class="business-evidence-decision-path"/g) || []).length, 1, "the indexable fallback must expose one neutral decision path");
assert.match(landing, /content\.insights[\s\S]*?business-execution-evidence-grid[\s\S]*?business-evidence-decision-path/, "current evidence themes must be generated from the same-run insight artifact");
assert.ok((html.match(/<dt>ACTION GATE<\/dt>/g) || []).length >= 4, "each technology issue must close with an action gate");
for (const label of ["01 · FACT", "02 · IMPLICATION", "03 · DECISION", "04 · ACTION / KILL"]) {
  assert.ok(html.includes(label), `missing framework stage: ${label}`);
}
assert.match(landing, /item\.fact[\s\S]*?item\.implication[\s\S]*?item\.decision[\s\S]*?item\.action/);
assert.match(html, /business-evidence-case-framework[\s\S]*?FACT · CURRENT[\s\S]*?BUSINESS IMPLICATION[\s\S]*?DECISION QUESTION[\s\S]*?ACTION \/ KILL GATE/);

assert.match(css, /\.business-module-heading--evidence h3\s*\{\s*color:\s*#102c43/);
assert.match(css, /\.business-execution-evidence-grid h4\s*\{\s*color:\s*#102c43/);
assert.match(css, /\.business-execution-evidence-grid dd\s*\{\s*color:\s*#102c43/);
assert.match(css, /\.business-site \.business-consulting-motion:is\(:hover, :focus-within\)[\s\S]*?background:\s*var\(--motion-surface-hover\) !important[\s\S]*?box-shadow:[\s\S]*?translate3d\(0, -8px, 22px\)/);
assert.match(css, /--motion-copy-hover:\s*#f7fbff[\s\S]*?--motion-muted-hover:\s*#d4e2eb[\s\S]*?--motion-accent-hover:\s*#72ddca/);
assert.match(css, /:where\(h1, h2, h3, h4, h5, h6, p, li, dd, strong, span, em, time, cite, a\)[\s\S]*?color:\s*var\(--motion-copy-hover\) !important[\s\S]*?-webkit-text-fill-color:\s*currentColor/);
assert.match(css, /Dark surfaces are detected at runtime[\s\S]*?\[data-hover-mode="dark-to-light"\][\s\S]*?--motion-surface-hover:\s*#f7fbff[\s\S]*?--motion-copy-hover:\s*#102c43/);
assert.match(css, /@keyframes consultingCardDrift/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.business-site \.business-consulting-motion[\s\S]*?animation:\s*none !important/);

assert.match(landing, /function setupConsultingCardMotion\(\)/);
assert.match(landing, /\.business-competency-grid > article[\s\S]*?\.business-partnership-types > article[\s\S]*?\.business-role-outputs > article/);
assert.match(landing, /consultingMotionObserver[\s\S]*?IntersectionObserver[\s\S]*?consultingMotionObserved/);
assert.match(landing, /consultingMotionBound[\s\S]*?pointermove/);
assert.match(landing, /card\.dataset\.hoverMode = inferHoverContrastMode\(card\)/);
assert.match(landing, /hasInteractiveContent[\s\S]*?card\.tabIndex = 0/, "non-interactive consulting cards must expose the focus inversion state to keyboard users");
assert.match(landing, /function surfaceLuminance\(node\)[\s\S]*?function inferHoverContrastMode\(card\)/);
assert.match(landing, /requestAnimationFrame[\s\S]*?--tilt-x[\s\S]*?--tilt-y/);
assert.match(landing, /setupReveal\(\);\s*setupConsultingCardMotion\(\);/);
assert.match(landing, /renderPartnerContent\(content\);[\s\S]*?renderCaseClassification\(content\);[\s\S]*?setupConsultingCardMotion\(\);/, "dynamically regenerated cards must receive the same motion and contrast behavior");
assert.match(landing, /infra-20260817-35/);

console.log(JSON.stringify({
  decisionThemes: "generated-current",
  consultingStages: 4,
  contrastModes: ["default", "hover-inverted"],
  minimumHoverContrast: `${minimumHoverContrast.toFixed(2)}:1`,
  motion: ["viewport-idle-drift", "pointer-tilt", "3d-depth", "reduced-motion"],
}, null, 2));
