#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [auditSource, workflowSource] = await Promise.all([
  fs.readFile(path.join(ROOT, "scripts", "audit-contrast.mjs"), "utf8"),
  fs.readFile(path.join(ROOT, ".github", "workflows", "pages.yml"), "utf8"),
]);

function section(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0 && endIndex > startIndex, `missing source section: ${start}`);
  return source.slice(startIndex, endIndex);
}

const sessionSource = section(auditSource, "class Session {", "async function connect");
const connectSource = section(auditSource, "async function connect", "// The page-side measurement");
const mainSource = section(auditSource, "async function main()", "main().catch");

assert.match(
  connectSource,
  /\/json\/new\?[\s\S]*?signal:\s*AbortSignal\.timeout\(DEVTOOLS_CONNECT_TIMEOUT_MS\)/,
  "DevTools target creation must have a bounded fetch",
);
assert.match(
  connectSource,
  /setTimeout\([\s\S]*?devtools socket open timed out[\s\S]*?DEVTOOLS_CONNECT_TIMEOUT_MS/,
  "WebSocket open must have a deadline",
);
assert.match(
  sessionSource,
  /send\(method, params = \{\}\)[\s\S]*?setTimeout\([\s\S]*?DEVTOOLS_COMMAND_TIMEOUT_MS/,
  "every DevTools command must have a response deadline",
);
assert.match(sessionSource, /addEventListener\("close"[\s\S]*?rejectPending/, "socket close must reject pending commands");
assert.match(sessionSource, /addEventListener\("error"[\s\S]*?rejectPending/, "socket error must reject pending commands");
assert.match(sessionSource, /rejectPending\(error\)[\s\S]*?clearTimeout\(entry\.timer\)[\s\S]*?pending\.clear\(\)/, "pending timers and commands must be cleared together");
assert.match(
  mainSource,
  /finally \{[\s\S]*?session\?\.close\(\)[\s\S]*?\/json\/close\/[\s\S]*?AbortSignal\.timeout\(DEVTOOLS_CLEANUP_TIMEOUT_MS\)[\s\S]*?chrome\.child\.kill\(\)[\s\S]*?server\.closeAllConnections\?\.\(\)/,
  "cleanup must remain bounded and run for every exit path",
);

const contrastStep = workflowSource.match(
  /^\s{6}- name: Audit rendered text contrast\r?\n[\s\S]*?(?=^\s{6}- name:|(?![\s\S]))/m,
)?.[0] || "";
assert.match(contrastStep, /^\s{8}timeout-minutes:\s*8\s*$/m, "contrast workflow step must have an eight-minute cap");
assert.match(contrastStep, /^\s{8}run:\s*pnpm run audit:contrast\s*$/m, "contrast step must still run the complete audit");

console.log(JSON.stringify({
  auditContrastLifecycle: true,
  connectTimeout: true,
  commandTimeout: true,
  cleanupTimeout: true,
  workflowTimeoutMinutes: 8,
}, null, 2));
