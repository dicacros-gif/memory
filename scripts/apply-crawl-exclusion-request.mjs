#!/usr/bin/env node

import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CRAWL_EXCLUSION_TYPES,
  crawlExclusionKeySet,
  crawlExclusionRecordId,
  crawlExclusionRecords,
  purgeCrawlExclusions,
} from "./crawl-exclusions.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = resolve(root, "data");
const exclusionsPath = resolve(dataDir, "crawl-exclusions.json");
const requestMarker = "<!-- memory-crawl-exclusion:v1 -->";
const body = String(process.env.EXCLUSION_REQUEST_BODY || "");

if (!body.includes(requestMarker)) throw new Error("missing crawl exclusion request marker");
const fenced = body.match(/```json\s*([\s\S]*?)```/i);
if (!fenced) throw new Error("missing crawl exclusion JSON payload");

let request;
try {
  request = JSON.parse(fenced[1]);
} catch {
  throw new Error("invalid crawl exclusion JSON payload");
}

const type = String(request?.type || "").toLowerCase();
if (request?.version !== 1 || !CRAWL_EXCLUSION_TYPES.includes(type)) {
  throw new Error("unsupported crawl exclusion request");
}

const expectedPrefix = `${type}:`;
const keys = Array.from(new Set((Array.isArray(request.keys) ? request.keys : [])
  .map((key) => String(key || "").trim())
  .filter((key) => key.startsWith(expectedPrefix) && key.length <= 900)));
if (!keys.length) throw new Error("crawl exclusion request has no valid keys");

const current = JSON.parse(await readFile(exclusionsPath, "utf8"));
const records = crawlExclusionRecords(current);
const existingKeys = crawlExclusionKeySet(current);
const newKeys = keys.filter((key) => !existingKeys.has(key));
const now = new Date().toISOString();

if (newKeys.length) {
  records.push({
    id: crawlExclusionRecordId(newKeys),
    type,
    keys: newKeys,
    label: String(request.label || "").trim().slice(0, 180),
    sourceUrl: String(request.sourceUrl || "").trim().slice(0, 900),
    requestedAt: String(request.requestedAt || "").trim() || now,
    approvedAt: now,
    approval: {
      repository: String(process.env.GITHUB_REPOSITORY || ""),
      issue: Number(process.env.EXCLUSION_ISSUE_NUMBER || 0) || null,
      actor: String(process.env.EXCLUSION_ACTOR || ""),
      authorAssociation: String(process.env.EXCLUSION_AUTHOR_ASSOCIATION || ""),
    },
  });
}

const nextExclusions = {
  version: 1,
  updatedAt: now,
  items: records,
};
const exclusionKeys = crawlExclusionKeySet(nextExclusions);
const protectedFiles = new Set([
  "baseline.json",
  "company-intelligence.json",
  "crawl-exclusions.json",
  "quant-model.json",
  "translation-cache.json",
]);
const files = (await readdir(dataDir))
  .filter((name) => name.endsWith(".json") && !protectedFiles.has(name));
const updates = [[exclusionsPath, nextExclusions]];
const purgeSummary = {};

for (const name of files) {
  const path = resolve(dataDir, name);
  const parsed = JSON.parse(await readFile(path, "utf8"));
  const purged = purgeCrawlExclusions(parsed, exclusionKeys);
  if (purged.removed > 0) {
    purgeSummary[name] = purged.removed;
    updates.push([path, purged.value]);
  }
}

const staged = [];
try {
  for (const [path, value] of updates) {
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.${process.pid}.${Date.now()}.${staged.length}.tmp`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    staged.push({ path, temporary });
  }
  for (const entry of staged) await rename(entry.temporary, entry.path);
} catch (error) {
  await Promise.all(staged.map(({ temporary }) => rm(temporary, { force: true })));
  throw error;
}

console.log(JSON.stringify({
  ok: true,
  id: crawlExclusionRecordId(newKeys.length ? newKeys : keys),
  addedKeys: newKeys.length,
  purged: purgeSummary,
}, null, 2));
