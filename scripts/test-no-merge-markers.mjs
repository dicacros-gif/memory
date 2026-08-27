#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const textExtensions = new Set([".css", ".html", ".js", ".json", ".mjs", ".yaml", ".yml"]);
const trackedFiles = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
  .split(/\r?\n/)
  .filter((file) => file && textExtensions.has(extname(file)));
const markerPattern = /^(?:<<<<<<<|=======|>>>>>>>)(?: .*)?$/m;
const violations = [];

for (const file of trackedFiles) {
  const content = await readFile(resolve(root, file), "utf8");
  if (markerPattern.test(content)) violations.push(file);
}

assert.deepEqual(violations, [], `unresolved merge markers in deployable files: ${violations.join(", ")}`);
console.log(JSON.stringify({ ok: true, checked: trackedFiles.length }, null, 2));
