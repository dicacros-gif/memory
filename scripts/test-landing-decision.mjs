import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [html, landing, css, manifestText, decisionText, workflow, liveText] = await Promise.all([
  readFile(resolve(root, "index.html"), "utf8"),
  readFile(resolve(root, "assets/js/landing.js"), "utf8"),
  readFile(resolve(root, "assets/css/landing.css"), "utf8"),
  readFile(resolve(root, "data/data-manifest.json"), "utf8"),
  readFile(resolve(root, "data/landing-decision-client.json"), "utf8"),
  readFile(resolve(root, ".github/workflows/pages.yml"), "utf8"),
  readFile(resolve(root, "data/live.json"), "utf8"),
]);

const manifest = JSON.parse(manifestText);
const decision = JSON.parse(decisionText);
const live = JSON.parse(liveText);
const tabs = [...html.matchAll(/data-decision-tab="([^"]+)"/g)].map((match) => match[1]);
const panels = [...html.matchAll(/data-decision-panel="([^"]+)"/g)].map((match) => match[1]);

assert.deepEqual(tabs, ["hbm", "demand", "nand", "partner"], "decision lab must expose four focused consulting cases");
assert.deepEqual(panels, tabs, "each decision tab must have an indexable answer panel");
for (const phrase of [
  "EXECUTIVE ANSWER",
  "CUSTOMER JTBD",
  "WORKLOAD DIAGNOSIS",
  "QUALIFY &amp; REPEAT",
  "STOP / REFRAME",
  "PARTNERS &amp; CLIENTS · RACI",
]) assert.ok(html.includes(phrase), `decision lab must include ${phrase}`);
assert.doesNotMatch(html, /business-decision-method|01 · ANSWER FIRST/, "the removed five-step answer strip must stay absent");

assert.equal(decision.clientArtifact, true, "landing data must be a client-safe artifact");
assert.equal(decision.runId, manifest.runId, "landing artifact and manifest must be atomic");
assert.equal(manifest.artifacts?.landingDecision?.path, "data/landing-decision-client.json");
assert.ok(Buffer.byteLength(decisionText, "utf8") < 20_000, "landing artifact must stay below 20KB");
const publishedBriefIds = decision.briefs.map((item) => item.id);
const approvedBriefIds = new Set(["hbm", "dram", "nand", "demand"]);
const expectedBriefIds = (live.intelligence?.briefs || [])
  .filter((item) => approvedBriefIds.has(item?.id) && item?.latest?.url)
  .map((item) => item.id);
assert.ok(publishedBriefIds.length >= 3 && publishedBriefIds.length <= 4, "landing must retain three to four evidence-backed market briefs");
assert.equal(new Set(publishedBriefIds).size, publishedBriefIds.length, "landing brief categories must be unique");
assert.deepEqual(publishedBriefIds, expectedBriefIds, "landing must mirror only the currently verified approved briefs");
assert.ok(decision.briefs.every((item) => item.latest?.url), "a brief without a traceable source must fail closed");

assert.match(landing, /const DECISION_CLIENT_PATH = "data\/landing-decision-client\.json"/);
assert.match(landing, /setupDecisionLab\(\)/);
assert.match(landing, /loadDecisionEvidence\(\)/);
assert.doesNotMatch(landing, /fetch\([^\n]*(live-client|quant-client)\.json/, "landing must not fetch heavyweight Console datasets");
assert.match(css, /\.business-decision-case/);
assert.match(css, /@media \(max-width: 820px\)/);
assert.match(workflow, /data\/landing-decision-client\.json/);

console.log(JSON.stringify({
  tabs: tabs.length,
  briefs: decision.briefs.length,
  bytes: Buffer.byteLength(decisionText, "utf8"),
  runId: decision.runId,
}, null, 2));
