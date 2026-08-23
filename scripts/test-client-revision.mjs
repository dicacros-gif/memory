import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computeClientRevision, normalizeForHash } from "./sync-client-revision.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const revision = computeClientRevision();
const index = read("index.html");
const landing = read("assets/js/landing.js");
const landingMin = read("assets/js/landing.min.js");
const revisionSource = read("scripts/sync-client-revision.mjs");

assert.match(revision, /^infra-[a-f0-9]{12}$/);
assert.ok(index.includes(`const revision = "${revision}"`));
assert.ok(index.includes(`landing.min.css?v=${revision}`));
assert.ok(index.includes(`landing.min.js?v=${revision}`));
assert.ok(landing.includes(`const CONSOLE_REVISION = "${revision}"`));
assert.ok(landingMin.includes(revision), "minified landing bundle must carry the same deterministic revision");
assert.match(revisionSource, /replace\(\/\\r\\n\?\/g, "\\n"\)/, "client revision hashing must be stable across Windows and Linux line endings");
assert.equal(normalizeForHash("alpha\r\nbeta\r\n"), normalizeForHash("alpha\nbeta\n"), "CRLF and LF sources must produce the same revision input");

const publicRevisions = new Set(`${index}\n${landing}`.match(/infra-(?:[a-f0-9]{12}|[0-9]{8}-[0-9]{2})/gi) || []);
assert.deepEqual([...publicRevisions], [revision]);

console.log(JSON.stringify({ revision, status: "deterministic-and-synchronized" }, null, 2));
