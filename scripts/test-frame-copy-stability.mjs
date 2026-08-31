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
 * prose normaliser would leave alone. Date-only display normalization is the
 * sole permitted difference: raw source values stay intact while reader copy
 * uses M/D or 'YY.M월.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { consultingBullet, formatPublicTemporalCopy } from "../assets/js/public-copy-policy.js";

const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const model = await read("../data/mbb-frames.json");
const capital = await read("../data/capital-plans.json");

const frameCopy = JSON.stringify(model.frames);
assert.doesNotMatch(frameCopy, /Google · Meta · OpenAI · Anthropic — 상호 경쟁 관계/, "Google and Anthropic must not be described as only mutual competitors");
assert.match(frameCopy, /Google–Anthropic은 투자·Cloud\/TPU 협력 병존/, "the account matrix must disclose the Google–Anthropic investment and infrastructure relationship");

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
    const expected = formatPublicTemporalCopy(copy);
    const normalized = consultingBullet(copy);
    if (normalized !== expected) findings.push({ path, before: copy, after: normalized });
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
