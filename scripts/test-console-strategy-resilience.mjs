/**
 * Console strategy and stale-snapshot regression contract.
 *
 * The executive boards must preserve their qualitative decision framework when
 * a synchronized public snapshot ages out.  Expiry lowers freshness; it must
 * not erase the last verified evidence.  Integrity failures (run/schema/bundle
 * mismatch) still fail closed.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const app = readFileSync(resolve(root, "assets/js/app.js"), "utf8");
const css = readFileSync(resolve(root, "assets/css/styles.css"), "utf8");

const currentStatusRule = css.match(/\.tb-data-status\.is-current\s*\{([^}]*)\}/)?.[1] || "";
assert.match(currentStatusRule, /color:\s*#fff;/,
  "the fresh-data badge must use readable light text");
assert.match(currentStatusRule, /background:\s*var\(--teal\);/,
  "the fresh-data badge must invert on its own teal rather than inherit the dark topbar");
assert.match(currentStatusRule, /-webkit-text-fill-color:\s*#fff;/,
  "the fresh-data badge must survive the global text-fill guard");
const currentStatusSurface = css.match(/--teal:\s*(#[\da-f]{6})\s*;/i)?.[1] || "";
const relativeLuminance = (hex = "") => {
  const channels = hex.match(/[\da-f]{2}/gi)?.map((value) => Number.parseInt(value, 16) / 255) || [];
  const linear = channels.map((value) => value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
};
const currentStatusContrast = (relativeLuminance("ffffff") + .05) / (relativeLuminance(currentStatusSurface) + .05);
assert.ok(currentStatusSurface && currentStatusContrast >= 4.5,
  `the fresh-data badge must retain WCAG AA contrast; received ${currentStatusContrast.toFixed(2)}:1`);

function section(start, end) {
  const from = app.indexOf(start);
  assert.notEqual(from, -1, `missing source marker: ${start}`);
  const to = app.indexOf(end, from + start.length);
  assert.notEqual(to, -1, `missing source marker after ${start}: ${end}`);
  return app.slice(from, to);
}

/* ------------------------------------------------------ decision framework */

const blueprint = section("const NUMBER_DECISION_BLUEPRINT = [", "const SECTION_LABELS =");
const expectedStages = ["QUESTION", "DIAGNOSIS", "MEMORY OPTION", "BUSINESS CASE", "DECISION"];
let cursor = -1;
for (const label of expectedStages) {
  const next = blueprint.indexOf(`label: "${label}"`, cursor + 1);
  assert.ok(next > cursor, `${label} must appear once in decision order`);
  cursor = next;
}
assert.equal((blueprint.match(/^\s+id: "(?:question|diagnosis|option|business|decision)",$/gm) || []).length, 5,
  "the number board must expose exactly five strategy lanes");
assert.deepEqual([...blueprint.matchAll(/^\s+step: "(\d+)",$/gm)].map((match) => match[1]), ["1", "2", "3", "4", "5"],
  "decision steps must be unpadded and continuous");
assert.match(css, /\.number-live-ribbon\s*\{[\s\S]*?grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/,
  "the five-stage ribbon must fill one desktop row");
assert.match(css, /\.number-grid\[data-lanes="5"\]\s*\{[\s\S]*?repeat\(5, minmax\(0, 1fr\)\)/,
  "all five decision lanes must share the available board width");

const decisionMapping = section("function numberDecisionItems(items = [])", "function numberAnalysisItems()");
assert.match(decisionMapping, /const aliases = \[entry\.title, \.\.\.\(entry\.aliases \|\| \[\]\)\]\.map\(cleanInsightText\)/,
  "renamed metrics must be resolved through canonicalized aliases");
assert.match(decisionMapping, /aliases\.map\(\(title\) => byTitle\.get\(title\)\)\.find/,
  "metric resolution must search every alias rather than one retired exact title");
assert.match(decisionMapping, /const resolved = item \|\| \{[\s\S]*?fallbackValue[\s\S]*?dataStatus: "framework"/,
  "every lane must retain a qualitative framework card when no metric alias resolves");
assert.doesNotMatch(decisionMapping, /find\([^\n]*(?:item|candidate)\.title\s*===\s*entry\.title/,
  "decision mapping must not regress to an exact retired-title comparison");

/* ------------------------------------------------------- account ownership */

const accountForecast = section("function forecastHyperscalerAccounts", "function renderHyperscalerDemand()");
assert.match(accountForecast,
  /const order = \["nvidia", "google", "microsoft", "aws", "meta", "openai", "anthropic", "oracle", "apple", "tesla", "spacexai"\]/,
  "Oracle and SpaceXAI must remain distinct demand owners in the governed order");
assert.match(accountForecast, /const signalIds = \{ microsoft: "azure", spacexai: "xai" \}/,
  "only registry-name aliases may bridge account signal ids");
assert.doesNotMatch(accountForecast, /openai\s*:\s*"oracle"/,
  "OpenAI demand must never inherit Oracle's signal identity");

/* ------------------------------------------- coherence versus freshness */

const manifestLoader = section("async function loadDataManifestWithCache", "function managedDataPath");
assert.match(manifestLoader, /const publicRunValid = !\/\^local-\/i\.test\(runId\) && Number\.isFinite\(expiresAt\)/,
  "public snapshot integrity must reject local or malformed runs");
assert.match(manifestLoader, /publicRunFresh: publicRunValid && Date\.now\(\) <= expiresAt/,
  "expiry must be recorded as freshness rather than folded into integrity");
assert.doesNotMatch(manifestLoader, /publicRunValid:\s*[^\n]*Date\.now\(\)/,
  "an expired coherent manifest must not be marked corrupt");

const manifestRun = section("function isManifestRun", "function ensureResearchArchiveLoaded");
assert.match(manifestRun, /String\(data\.runId\) === String\(manifest\.runId\)/,
  "managed artifacts must match the manifest run id");
assert.doesNotMatch(manifestRun, /isExpired|Date\.now|expiresAt/,
  "same-run admission must not reject a snapshot solely because it is old");

const liveSelection = section("function isVerifiedLiveData", "function normalizeLiveData");
assert.match(liveSelection, /allowStale = false/);
assert.match(liveSelection, /if \(allowStale\) return true;/,
  "verified live evidence must support last-verified selection after expiry");
assert.match(liveSelection, /liveDataState = fresh \? "verified" : trusted \? "stale" : "empty"/,
  "live selection must distinguish stale evidence from invalid evidence");
assert.match(liveSelection, /data\.schemaVersion !== "2\.0"/,
  "quant selection must reject incompatible schemas");
assert.match(liveSelection, /runId !== liveRunId/,
  "quant selection must reject a cross-run bundle");
assert.match(liveSelection, /quantDataState = fresh \? "verified" : trusted \? "stale" : "empty"/,
  "quant selection must retain coherent expired data as stale");
assert.match(liveSelection, /if \(sameRun && schemaMatches && sameBundle\) return data;[\s\S]*?return fallback;/,
  "secondary artifacts must fail closed on run, schema, or validation-bundle mismatch");
assert.doesNotMatch(liveSelection.match(/function selectSameRunArtifact[\s\S]*$/)?.[0] || "", /Date\.now\(\)\s*<=|!isExpired/,
  "same-run secondary artifacts must not be erased by wall-clock expiry");

/* ---------------------------------------------- non-empty stale rendering */

const newsRenderer = section("function renderNews()", "function renderNewsList()");
assert.match(newsRenderer, /const newsAvailable = rawNews\(\)\.length > 0/,
  "news availability must follow verified content presence");
assert.doesNotMatch(newsRenderer, /if\s*\(\s*(?:isExpired|!isVerifiedLiveData)/,
  "news rendering must not be gated off by expiry");
assert.match(newsRenderer, /!list\.children\.length/,
  "failed refresh must preserve previously rendered dated news");
assert.doesNotMatch(newsRenderer, /CURRENT|LAST VERIFIED|newsStats/,
  "refresh telemetry must not replace reader-facing insights");

const productRenderer = section("function renderProductProjection()", "function renderChinaDynamics()");
assert.match(productRenderer, /if \(!horizon\.available \|\| !segments\.length \|\| !scenario \|\| !scenarios\.length\) \{[\s\S]*?renderHyperscalerProjection\(\);[\s\S]*?정량 3-Case 산출 보류[\s\S]*?return;/,
  "missing quantitative portfolio inputs must fall back to the account/workload/pain/option/gate framework");
assert.match(productRenderer, /if \(!series\.length\) \{[\s\S]*?renderHyperscalerProjection\(\);[\s\S]*?정량 시나리오 산출 보류[\s\S]*?return;/,
  "an empty scenario series must preserve the qualitative portfolio framework");
assert.doesNotMatch(productRenderer, /if \(!horizon\.available[\s\S]{0,800}(?:summary|stack|tabs|focus|drivers)\.innerHTML = ""/,
  "portfolio fail-closed logic must not clear the board");

const demandRenderer = section("function renderHyperscalerDemand()", "function renderAgentSpeech");
assert.match(demandRenderer, /const quantitativeAvailable = d\.available === true/,
  "demand rendering must separate quantitative readiness from qualitative availability");
assert.doesNotMatch(demandRenderer, /if \(!d\.available\)/,
  "missing demand calibration must not short-circuit the account framework");
for (const stage of ["ACCOUNT", "CHIP ROADMAP", "MEMORY PAIN", "MEMORY OPTION", "EXECUTION GATE"]) {
  assert.ok(demandRenderer.includes(stage), `qualitative demand stage missing: ${stage}`);
}
assert.match(demandRenderer, /sd\.available \? `산업 총수요[\s\S]*?: `정량 계산 대기/,
  "unavailable scenarios must show a bounded wait state instead of fabricated totals");

console.log(JSON.stringify({
  status: "console-strategy-resilience-pass",
  decisionStages: expectedStages.length,
  accountOwners: 11,
  staleSnapshots: "retained-with-label",
}, null, 2));
