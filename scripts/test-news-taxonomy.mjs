#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  PUBLIC_NEWS_CATEGORY_IDS,
  classifyPublicNewsCategory,
} from "./crawl.mjs";

assert.deepEqual(PUBLIC_NEWS_CATEGORY_IDS, [
  "hbm",
  "cxl",
  "nand",
  "aidemand",
  "packaging",
  "dram",
  "equipment",
]);

const fixtures = [
  ["hbm", { category: "hbm", title: "Custom HBM4E customer qualification and supply ramp" }],
  ["cxl", { category: "cxl", title: "CMM-Ax uses Structera A for CXL processing-near-memory" }],
  ["nand", { category: "china_nand", title: "YMTC enterprise SSD built on Xtacking NAND" }],
  ["aidemand", { category: "account_intel", title: "AWS Trainium rack expands AI infrastructure demand" }],
  ["packaging", { category: "packaging", title: "TSMC CoWoS and hybrid bonding packaging capacity" }],
  ["dram", { category: "china", title: "CXMT server DDR5 contract changes commodity DRAM supply" }],
  ["equipment", { category: "equipment", title: "NAURA and AMEC memory etch equipment qualification" }],
];

for (const [expected, item] of fixtures) {
  assert.equal(classifyPublicNewsCategory(item), expected, `${item.title} must map to ${expected}`);
}

const appSource = await readFile(new URL("../assets/js/app.js", import.meta.url), "utf8");
const filteredNewsSource = appSource.match(/function filteredNews[\s\S]*?function newsCompanies/)?.[0] || "";
assert.match(filteredNewsSource, /return item\.category === categoryId;/, "news tabs must use one primary category instead of overlapping keyword matches");
assert.doesNotMatch(filteredNewsSource, /terms\.some|keywords/, "legacy overlapping keyword filter must stay retired");

const crawlSource = await readFile(new URL("./crawl.mjs", import.meta.url), "utf8");
for (const label of ["Custom HBM · HBM4", "CXL Pooling · PNM", "AI-NAND · eSSD", "AI Infra 수요", "베이스 다이 · 패키징", "범용 DRAM · CXMT", "장비 · 소재 공급망"]) {
  assert.ok(crawlSource.includes(label), `crawler query plan must expose ${label}`);
}

console.log(JSON.stringify({ ok: true, categories: PUBLIC_NEWS_CATEGORY_IDS.length, fixtures: fixtures.length }));
