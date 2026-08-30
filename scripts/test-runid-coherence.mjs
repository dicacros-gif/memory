import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const manifest = readJson("data/data-manifest.json");
const runId = String(manifest.runId || "").trim();

assert.ok(runId, "data manifest must carry a runId");
assert.doesNotMatch(runId, /^local-/i, "a local runId must never reach the public data manifest");
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
  const raw = fs.readFileSync(absolutePath);
  const bytes = /\.(?:json|html)$/i.test(relativePath)
    ? Buffer.byteLength(raw.toString("utf8").replace(/\r\n/g, "\n"), "utf8")
    : raw.byteLength;
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

// The refresh job validates generated files before it commits them. Keep every
// manifest-owned artifact in that commit, otherwise Pages can receive a new
// manifest with an older Console artifact even though CI passed in the runner.
const workflow = fs.readFileSync(path.join(root, ".github/workflows/pages.yml"), "utf8");
const stagedLine = workflow.match(/^\s*git add (.+)$/m)?.[1] || "";
const stagedPaths = new Set(stagedLine.trim().split(/\s+/).filter(Boolean));
for (const relativePath of checked) {
  assert.ok(stagedPaths.has(relativePath), `${relativePath} must be staged by the intelligence refresh job`);
}

console.log(JSON.stringify({ status: "coherent", runId, artifacts: checked.length }, null, 2));
