import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computeClientRevision, normalizeForHash } from "./sync-client-revision.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const revision = computeClientRevision();
const index = read("index.html");
const alias = read("console/index.html");
const revisionSource = read("scripts/sync-client-revision.mjs");

assert.match(revision, /^infra-[a-f0-9]{12}$/);
assert.ok(index.includes(`strategy-experience.min.css?v=${revision}`));
assert.ok(index.includes(`strategy-experience.min.js?v=${revision}`));
assert.doesNotMatch(index, /(?:landing|styles|app|company-profile|strategy-spine)\.min\.(?:css|js)/, "inactive legacy bundles must not return to the root payload");
assert.match(revisionSource, /assets\/js\/strategy-experience\.js/);
assert.match(revisionSource, /assets\/js\/strategy-economics-model\.js/);
assert.match(revisionSource, /assets\/js\/public-copy-policy\.js/);
assert.match(revisionSource, /assets\/css\/strategy-experience\.css/);
assert.doesNotMatch(revisionSource, /replaceRevision\("console\/index\.html"/, "the static compatibility alias must not carry an asset revision");
assert.match(revisionSource, /replace\(\/\\r\\n\?\/g, "\\n"\)/, "revision hashing must be stable across operating-system line endings");
assert.equal(normalizeForHash("alpha\r\nbeta\r\n"), normalizeForHash("alpha\nbeta\n"));

const publicRevisions = new Set(index.match(/infra-(?:[a-f0-9]{12}|[0-9]{8}-[0-9]{2})/gi) || []);
assert.deepEqual([...publicRevisions], [revision]);
assert.doesNotMatch(alias, /infra-[a-f0-9]{12}/);

console.log(JSON.stringify({ revision, status: "active-assets-synchronized" }, null, 2));
