import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");
const deepQa = await readFile(new URL("../.github/workflows/deep-qa.yml", import.meta.url), "utf8");
const crawler = await readFile(new URL("./crawl.mjs", import.meta.url), "utf8");
const pathsIgnore = workflow.split(/\n\s*schedule:/, 1)[0];

const generatedPaths = [
  "data/company-signals.json",
  "data/memory-demand.json",
  "data/silicon-map.json",
  "data/pain-points.json",
  "data/org-signals.json",
  "data/refresh-status.json",
];

for (const path of generatedPaths) {
  assert.match(pathsIgnore, new RegExp(`- \\\"${path.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\\"`), `${path} must not retrigger the crawler`);
}
assert.doesNotMatch(pathsIgnore, /company-signals\.json data\/memory-demand\.json/, "generated paths must be separate YAML entries");
assert.match(workflow, /Recover a degraded source run once/);
assert.match(workflow, /CRAWL_RECOVERY_MODE=1 pnpm run crawl/);
assert.doesNotMatch(workflow, /CRAWL_RECOVERY_MODE=1 CRAWL_SKIP_KO_TRANSLATION=1/,
  "the recovery pass must retry uncached translation failures instead of preserving them");
assert.match(workflow, /Synchronize retained verified clients after a degraded crawl[\s\S]*checked-degraded[\s\S]*refresh-client-artifacts\.mjs --console-only/,
  "a degraded crawl that retains verified histories must rebuild only the matching Console browser artifacts");
assert.match(workflow, /Pre-render executive decision snapshot[\s\S]*Rebuild cache-busted browser assets[\s\S]*pnpm run build:assets[\s\S]*Validate refreshed intelligence/,
  "a crawl that changes revision inputs must rebuild browser assets before validation");
assert.match(workflow, /git add[^\n]*index\.html[^\n]*assets\/js\/landing\.js[^\n]*assets\/js\/landing\.min\.js/,
  "the crawler commit must retain its synchronized public revision files");
assert.match(crawler, /googleNewsCircuitOpen = CRAWL_RECOVERY_MODE/);
assert.match(crawler, /news_english", critical: true, passed: languageCounts\.english >= 6/,
  "the multilingual stream must not be rejected by the retired English-only floor");
assert.match(deepQa, /pnpm install --frozen-lockfile/);
assert.match(deepQa, /pnpm run check:deep/);
assert.ok(workflow.indexOf("pnpm run audit:public-experience:quick") > workflow.indexOf("pnpm run check:fast"));
assert.ok(workflow.indexOf("pnpm run audit:public-experience:quick") < workflow.indexOf("name: Commit refreshed intelligence data"));
assert.match(deepQa, /pnpm run audit:public-experience\s/);

console.log(JSON.stringify({ ok: true, generatedPaths: generatedPaths.length, recoveryPass: true, deepQaPinned: true }));
