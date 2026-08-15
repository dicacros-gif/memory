import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [html, css, landing] = await Promise.all([
  readFile(new URL("index.html", root), "utf8"),
  readFile(new URL("assets/css/landing.css", root), "utf8"),
  readFile(new URL("assets/js/landing.js", root), "utf8"),
]);

assert.match(html, /EXECUTIVE EVIDENCE SYNTHESIS · 4-STEP FRAME/);
assert.match(html, /SOURCE GRADE → BUSINESS IMPACT → GATE QUESTION → OWNER · KPI · KILL CRITERIA/);
assert.equal((html.match(/class="business-evidence-decision-path"/g) || []).length, 3, "all evidence themes must use the decision path");
assert.ok((html.match(/<dt>ACTION GATE<\/dt>/g) || []).length >= 4, "each technology issue must close with an action gate");
for (const label of ["01 · FACT", "02 · IMPLICATION", "03 · DECISION", "04 · ACTION GATE"]) {
  assert.ok(html.includes(label), `missing framework stage: ${label}`);
}
assert.match(html, /Owner · Sales\/Production\/Finance · KPI · Qual-to-Volume Lead Time · Kill/);
assert.match(html, /Owner · Product\/Tech\/Biz · KPI · 90-day Benchmark·Design-in Pipeline · Kill/);
assert.match(html, /Owner · Account Strategy · KPI · Qual Pipeline·Customer Mix · Kill/);
assert.match(html, /business-evidence-case-framework[\s\S]*?FACT · CONFIRMED[\s\S]*?BUSINESS IMPLICATION[\s\S]*?DECISION QUESTION[\s\S]*?ACTION \/ KILL GATE/);

assert.match(css, /\.business-module-heading--evidence h3\s*\{\s*color:\s*#102c43/);
assert.match(css, /\.business-execution-evidence-grid h4\s*\{\s*color:\s*#102c43/);
assert.match(css, /\.business-execution-evidence-grid dd\s*\{\s*color:\s*#102c43/);
assert.match(css, /\.business-insights \.business-consulting-motion:is\(:hover, :focus-within\)[\s\S]*?background:\s*#102c43[\s\S]*?box-shadow:[\s\S]*?translate3d\(0, -9px, 24px\)/);
assert.match(css, /@keyframes consultingCardDrift/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.business-insights \.business-consulting-motion[\s\S]*?animation:\s*none !important/);

assert.match(landing, /function setupConsultingCardMotion\(\)/);
assert.match(landing, /requestAnimationFrame[\s\S]*?--tilt-x[\s\S]*?--tilt-y/);
assert.match(landing, /setupReveal\(\);\s*setupConsultingCardMotion\(\);/);
assert.match(landing, /infra-20260816-04/);

console.log(JSON.stringify({
  decisionThemes: 3,
  consultingStages: 4,
  contrastModes: ["default", "hover-inverted"],
  motion: ["idle-drift", "pointer-tilt", "reduced-motion"],
}, null, 2));
