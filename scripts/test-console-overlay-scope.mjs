import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJSON = async (file) => JSON.parse(await readFile(path.join(root, file), "utf8"));
const readText = (file) => readFile(path.join(root, file), "utf8");

const [base, capital, roadmap, profileSource, consoleSource, profileCSS] = await Promise.all([
  readJSON("data/company-directory-client.json"),
  readJSON("data/console-capital-plans.json"),
  readJSON("data/console-chip-roadmap.json"),
  readText("assets/js/company-profile.js"),
  readText("assets/js/strategy-experience.js"),
  readText("assets/css/company-profile.css"),
]);

const profile = (id) => base.profiles.find((item) => item.id === id);
const generation = (id, matcher) => roadmap.accounts[id]?.generations?.find((item) => matcher.test(item.name));

// Shared home data remains the untouched baseline; console corrections live in
// separate overlays and are fetched only for the console route/renderer.
assert.equal(profile("nvidia")?.roadmap?.demandBridge, undefined);
assert.match(profileSource, /consoleRouteActive\(\) \? "console" : "home"/);
assert.match(profileSource, /mode === "console"\s*\? mergeConsoleDirectory/);
assert.match(consoleSource, /fetchConsoleCompanyDirectory\(\)/);
assert.match(consoleSource, /console-capital-plans\.json/);
assert.match(consoleSource, /console-chip-roadmap\.json/);

// A verified crawler observation always wins over a curated console baseline.
for (const source of [profileSource, consoleSource]) {
  assert.match(source, /capexBasis === "관측"/);
  assert.match(source, /commentBasis === "관측"/);
  assert.match(source, /next\.capex = base\.capex/);
  assert.match(source, /next\.comment = base\.comment/);
}

// Console-only visual additions must not leak into the home modal.
assert.match(profileSource, /state\.consoleMode \? roadmap\.demandBridge : null/);
assert.match(profileSource, /is-console-context/);
const bridgeSelectors = profileCSS.split("\n").filter((line) => line.includes("company-roadmap-bridge") && line.includes("{"));
assert.ok(bridgeSelectors.length >= 8);
assert.ok(bridgeSelectors.every((line) => line.includes(".company-profile-modal.is-console-context")));

// Google: publication date and connected-vs-active pod counts are distinct.
const google = capital.plans.google;
assert.match(google.plan, /1,152칩 연결/);
assert.match(google.plan, /1,024칩 활성/);
assert.ok(google.sources.some((item) => item.url.includes("2026_Q2_Earnings_Transcript.pdf")));
assert.ok(google.sources.some((item) => item.url.includes("goog-20260630.htm")));
assert.equal(google.sources.find((item) => item.url.includes("tpu-8t-and-tpu-8i"))?.observedAt, "2026-04-22");
const tpu8i = generation("google", /TPU 8i/);
assert.match(tpu8i.bandwidth, /최대 1,152칩 연결/);
assert.match(tpu8i.bandwidth, /최대 1,024칩 활성/);
assert.equal(tpu8i.ramp, "2026-04-22 공식 발표");

// NVIDIA: quarter end and SEC filing date are separate, and the $279B bridge
// is explicitly not presented as an HBM-only commitment.
const nvidia = capital.plans.nvidia;
assert.equal(nvidia.quarterEnd, "2026-07-26");
assert.equal(nvidia.filedAt, "2026-08-26");
assert.equal(nvidia.asOf, "2026-08-26");
assert.match(nvidia.comment, /HBM 단독 금액.*아님/);
assert.equal(roadmap.demandBridge.quarterEnd, "2026-07-26");
assert.equal(roadmap.demandBridge.filedAt, "2026-08-26");
assert.equal(roadmap.demandBridge.rows.reduce((sum, item) => sum + Number(item.amount.replace(/[^0-9]/g, "")), 0), 279);
assert.match(roadmap.demandBridge.note, /HBM 단독 금액.*해석하지 않음/);

// OpenAI: the 10GW multi-year rack target and Jalapeño qualification/deployment
// plan are two independent timelines.
const openai = capital.plans.openai;
assert.match(openai.capex, /H2'26.*배치 시작 목표/);
assert.match(openai.capex, /2029년 말 완료 목표/);
assert.match(openai.plan, /Production Qualification 진행/);
assert.match(openai.plan, /배치 시작 계획.*2026년 말/);
assert.match(openai.plan, /별도 관리/);
assert.ok(generation("openai", /Jalapeño · OpenAI Compute/));
assert.ok(generation("openai", /10GW Custom Accelerator Program/));
assert.match(generation("openai", /Jalapeño/)?.url || "", /jalapeno-first-results/);
assert.match(generation("openai", /10GW/)?.url || "", /openai-and-broadcom-announce-strategic-collaboration/);

// Anthropic: 5/6 capacity/service event and the later 6/4 contract boundary are
// dated independently; the official multi-provider portfolio includes Fluidstack.
const anthropic = capital.plans.anthropic;
assert.equal(anthropic.asOf, "2026-06-04");
assert.equal(anthropic.planLabel, "CAPACITY EVENT · 5/6");
assert.equal(anthropic.commentLabel, "SERVICE EFFECT · 5/6");
assert.equal(anthropic.contractLabel, "CONTRACT BOUNDARY · 6/4");
assert.match(anthropic.capex, /Fluidstack 500억\$/);
assert.match(anthropic.contractBoundary, /90일 통지 해지 가능/);

console.log("Console-only company overlays, source dates, and scope isolation: OK");
