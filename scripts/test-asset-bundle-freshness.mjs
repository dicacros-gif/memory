import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assetBuildSpecs, buildAssets } from "./build-assets.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const compiled = await buildAssets({ syncRevision: false, write: false });
const stale = [];

for (const spec of assetBuildSpecs) {
  const expected = fs.readFileSync(path.join(root, spec.outfile));
  const actual = Buffer.from(compiled.get(spec.outfile) || []);
  if (!expected.equals(actual)) stale.push(spec.outfile);
}

assert.deepEqual(
  stale,
  [],
  `generated asset bundles are stale: ${stale.join(", ")}. Run \"pnpm run build:assets\" and commit the outputs`,
);

console.log(JSON.stringify({ status: "fresh", assets: assetBuildSpecs.length }, null, 2));
