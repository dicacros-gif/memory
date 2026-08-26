/**
 * Frame copy stability gate.
 *
 * Rendered frames are passed through the public copy normaliser, which rewrites
 * sentence and question endings. That is right for prose written elsewhere and
 * wrong for copy authored directly in the frame model: a label like
 * "무엇을 사는가" comes out as "무엇을 사 여부", and a decision question ending
 * in "할 것인가" loses its verb.
 *
 * So the invariant is that authored frame copy must already be in the form the
 * normaliser would leave alone — what the file says is what the screen shows.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { consultingBullet } from "../assets/js/public-copy-policy.js";

const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const model = await read("../data/mbb-frames.json");
const capital = await read("../data/capital-plans.json");

// Keys holding identifiers, class names or markup rather than reader copy.
// `quote` is exempt for the opposite reason: it is rendered verbatim and must
// never be reshaped, so it is checked for accuracy by reading, not by this gate.
const SKIP_KEYS = new Set([
  "id", "type", "mount", "anchor", "position", "accent", "name",
  "step", "min", "unit", "placeholder", "quote",
]);

const findings = [];
let checked = 0;

const walk = (value, path, key = "") => {
  if (typeof value === "string") {
    if (SKIP_KEYS.has(key)) return;
    // Titles carry an authored line break for the headline rhythm.
    const copy = value.replaceAll("<br />", " ").replaceAll("<br>", " ").trim();
    if (!copy || !/[가-힣]/.test(copy)) return;
    checked += 1;
    const normalized = consultingBullet(copy);
    if (normalized !== copy) findings.push({ path, before: copy, after: normalized });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${path}[${index}]`, key));
    return;
  }
  if (value && typeof value === "object") {
    for (const [childKey, child] of Object.entries(value)) walk(child, `${path}.${childKey}`, childKey);
  }
};

walk(model.frames, "frames");
walk(capital.plans, "capital");

if (findings.length) {
  console.error(`frame copy the renderer would rewrite (${findings.length}):`);
  for (const finding of findings.slice(0, 20)) {
    console.error(`  ${finding.path}\n    authored: ${finding.before}\n    rendered: ${finding.after}`);
  }
}
console.log(JSON.stringify({ checked, findings: findings.length }));
assert.equal(findings.length, 0, "authored frame copy must render unchanged");
