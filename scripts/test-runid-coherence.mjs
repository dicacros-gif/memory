import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
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
assert.ok(checked.includes("console/index.html"), "manifest must include the pre-rendered console snapshot");

console.log(JSON.stringify({ status: "coherent", runId, artifacts: checked.length }, null, 2));
