#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [framesSource, siteContentSource, rendererSource] = await Promise.all([
  read("data/mbb-frames.json"),
  read("data/site-content-client.json"),
  read("assets/js/mbb-frames.js"),
]);

const frames = JSON.parse(framesSource);
const siteContent = JSON.parse(siteContentSource);
const frame = frames.frames.find((candidate) => candidate.id === "hyperscaler-constraints");
assert.ok(frame, "the hyperscaler Pain Point frame must exist");

const entries = frame.groups.flatMap((group) => group.entries || []);
assert.equal(entries.length, 6, "the active Pain Point board must keep all six account entries");

const accountIds = new Map([
  ["Meta", "meta"],
  ["OpenAI", "openai"],
  ["Anthropic", "anthropic"],
  ["Microsoft · Azure", "microsoft"],
  ["Google", "google"],
  ["AWS", "aws"],
]);
const expectedProvenance = new Map([
  ["Meta", ["https://about.fb.com/news/2026/03/expanding-metas-custom-silicon-to-power-our-ai-workloads/", "2026-03-11"]],
  ["OpenAI", ["https://openai.com/index/openai-broadcom-jalapeno-inference-chip/", "2026-06-24"]],
  ["Anthropic", ["https://www.anthropic.com/news/google-broadcom-partnership-compute", "2026-04-21"]],
  ["Microsoft · Azure", ["https://blogs.microsoft.com/blog/2026/01/26/maia-200-the-ai-accelerator-built-for-inference/", "2026-01-26"]],
  ["Google", ["https://cloud.google.com/blog/topics/google-cloud-next/welcome-to-google-cloud-next26", "2026-04-22"]],
  ["AWS", ["https://nvidianews.nvidia.com/news/aws-and-nvidia-to-deliver-2-million-additional-gpus-and-next-generation-infrastructure-for-agentic-and-physical-ai", "2026-08-26"]],
]);
const accounts = new Map(
  (siteContent.strategyBoard?.customerPortfolio?.accounts || []).map((account) => [account.id, account]),
);

for (const entry of entries) {
  const account = accounts.get(accountIds.get(entry.name));
  assert.ok(account, `${entry.name} must map to an active site-content account`);
  assert.equal(entry.constraint, `PAIN POINT · ${account.pain}`, `${entry.name} must reuse the verified account pain`);
  assert.equal(entry.read, account.memory, `${entry.name} must reuse the verified memory option`);
  assert.equal(entry.move, account.gate.replace(/\s*·\s*$/, ""), `${entry.name} must reuse the verified decision gate`);

  const [sourceUrl, asOf] = expectedProvenance.get(entry.name) || [];
  assert.equal(entry.sourceUrl, sourceUrl, `${entry.name} must link its authoritative source`);
  assert.equal(entry.asOf, asOf, `${entry.name} must carry the exact source date`);
  assert.equal(entry.evidenceTier, "TIER 1 · OFFICIAL", `${entry.name} must identify the primary-source tier`);
  assert.doesNotThrow(() => new URL(entry.sourceUrl), `${entry.name} source URL must parse`);
}

assert.doesNotMatch(
  JSON.stringify(frame),
  /SpaceX|GPU 22만|300MW|사용 한도 완화|2026년 초 Compute 제약/,
  "event-specific SpaceX and unsupported capacity claims must stay out of the Pain Point board",
);
assert.match(rendererSource, /const constraintEvidence = \(entry = \{\}\) => \{[\s\S]*?safeHref\(entry\.sourceUrl\)/, "constraint evidence must use the dedicated source URL");
assert.match(rendererSource, /if \(!href \|\| !date \|\| !evidenceTier\)[\s\S]*?전략 가설 · 직접 근거 대기/, "incomplete provenance must fail closed to a pending strategy hypothesis");
assert.match(rendererSource, /data-evidence-status="verified"[\s\S]*?<b>직접 근거<\/b>[\s\S]*?evidenceTier[\s\S]*?<time datetime=/, "complete provenance must render a linked tier and date badge");

console.log(JSON.stringify({
  hyperscalerPainProvenance: "pass",
  activeEntries: entries.length,
  evidenceTier: "TIER 1 · OFFICIAL",
  missingEvidenceFallback: "전략 가설 · 직접 근거 대기",
}, null, 2));
