import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const readText = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const manifest = readJson("data/data-manifest.json");
const runId = String(manifest.runId || "").trim();

assert.ok(runId, "data manifest must carry a runId");
assert.ok(manifest.cacheVersion?.startsWith(`${runId}-`), "cacheVersion must be derived from the active runId");

const rawArtifacts = [
  "data/live.json",
  "data/quant.json",
  "data/price-history.json",
  "data/market-history.json",
  "data/quant-backtest.json",
];

for (const relativePath of rawArtifacts) {
  const payload = readJson(relativePath);
  assert.equal(String(payload.runId || ""), runId, `${relativePath} must match manifest runId`);
}

const checked = [];
for (const artifact of Object.values(manifest.artifacts || {})) {
  const relativePath = String(artifact?.path || "").trim();
  assert.ok(relativePath, "every manifest artifact must declare a path");
  const absolutePath = path.join(root, relativePath);
  assert.ok(fs.existsSync(absolutePath), `${relativePath} must exist before deployment`);
  const bytes = fs.statSync(absolutePath).size;
  assert.equal(bytes, artifact.bytes, `${relativePath} byte count must match the manifest`);

  if (relativePath.endsWith(".json")) {
    const payload = readJson(relativePath);
    assert.equal(String(payload.runId || ""), runId, `${relativePath} must match manifest runId`);
    if (!["data/company-directory-client.json", "data/executive-latest.json"].includes(relativePath)) {
      assert.equal(payload.clientArtifact, true, `${relativePath} must be a validated client artifact`);
    }
  }
  checked.push(relativePath);
}

assert.ok(checked.includes("data/live-client.json"), "manifest must include the live client artifact");
assert.ok(checked.includes("data/quant-client.json"), "manifest must include the quant client artifact");
assert.ok(checked.includes("data/executive-latest.json"), "manifest must include the executive decision artifact");
assert.ok(checked.includes("data/insight-ledger.json"), "manifest must include the insight ledger artifact");
assert.ok(!checked.includes("console/index.html"), "the compatibility alias must not become a third data snapshot");

const ledger = readJson("data/insight-ledger.json");
assert.equal(ledger.clientArtifact, true, "insight ledger must be a validated client artifact");
assert.ok(Array.isArray(ledger.entries), "insight ledger must expose an entries array");
for (const entry of ledger.entries) {
  assert.ok(String(entry.id || "").trim(), "every insight ledger entry must have a stable id");
  assert.ok(Number.isInteger(entry.seenCount) && entry.seenCount >= 1, `${entry.id || "ledger entry"} must preserve a positive seenCount`);
}

assert.match(readText("scripts/crawl.mjs"), /\[INSIGHT_LEDGER_OUT,\s*clientBundle\.insightLedger\]/, "crawl publish transaction must write the insight ledger");
assert.match(readText("scripts/refresh-client-artifacts.mjs"), /\[dataPath\("insight-ledger\.json"\),\s*bundle\.insightLedger\]/, "offline refresh must republish the insight ledger");
const workflow = readText(".github/workflows/pages.yml");
assert.ok((workflow.match(/data\/insight-ledger\.json/g) || []).length >= 2, "workflow must ignore and git-add the generated insight ledger");

console.log(JSON.stringify({ status: "coherent", runId, artifacts: checked.length }, null, 2));
