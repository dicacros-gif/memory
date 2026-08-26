import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const json = (relativePath) => JSON.parse(read(relativePath));

const directory = json("data/company-directory-client.json");
const manifest = json("data/data-manifest.json");
const index = read("index.html");
const runtime = read("assets/js/strategy-experience.js");
const workflow = read(".github/workflows/pages.yml");
const profiles = new Map((directory.profiles || []).map((profile) => [profile.id, profile]));
const required = [
  "nvidia", "google", "microsoft", "aws", "oracle", "meta", "apple", "tesla", "openai", "anthropic", "spacex",
  "broadcom", "marvell", "tsmc", "skhynix", "samsung", "micron", "cxmt",
  "sandisk", "solidigm", "kioxia", "intel", "imec", "ibm",
];

assert.equal(directory.runId, manifest.runId, "company directory and browser manifest must share one runId");
assert.ok(directory.profiles.length >= 20, "directory must cover customers, partners, suppliers, and semiconductor ecosystem companies");
for (const id of required) {
  const profile = profiles.get(id);
  assert.ok(profile, `${id} company profile is required`);
  assert.ok(profile.memoryLens?.pain && profile.memoryLens?.proposal && profile.memoryLens?.gate, `${id} requires a decision-ready memory lens`);
  assert.ok(profile.chipLens?.primaryChip, `${id} requires a chip lens`);
  assert.ok(profile.dataCenterLens?.systemBottleneck && profile.dataCenterLens?.executionGate, `${id} requires a data-center lens`);
  assert.equal(profile.executiveLens?.actions?.length, 3, `${id} requires an automated 90-day executive action plan`);
  assert.equal(profile.accountBrief?.organizationRaci?.length, 3, `${id} requires GSM, HBM Business, and MSR account actions`);
  assert.equal(profile.accountBrief?.decisionFlow?.length, 4, `${id} requires account-to-deal decision flow`);
  assert.ok((profile.evidence || []).every((item) => String(item.date || "").startsWith("2026")), `${id} profile must expose only 2026 articles`);
}
assert.deepEqual(profiles.get("broadcom").chipLens.servesAccounts.map((item) => item.id), ["google", "meta", "openai", "anthropic"]);
assert.deepEqual(profiles.get("marvell").chipLens.servesAccounts.map((item) => item.id), ["google", "microsoft", "aws"]);
for (const id of ["sandisk", "solidigm", "kioxia", "intel", "imec", "ibm"]) {
  assert.ok(profiles.get(id).sources.length > 0, `${id} must remain linked to its source-catalog automation entry`);
}
assert.ok(profiles.get("apple").chipLens.portfolio.some((item) => /Private Cloud|PCC/i.test(`${item.name} ${item.publicSpec}`)), "Apple profile must cover on-device and Private Cloud Compute");
assert.equal(manifest.artifacts?.companyDirectory?.path, "data/company-directory-client.json");
assert.match(index, /id="accountList"[\s\S]*data-account="nvidia"/);
assert.match(index, /id="accountDetail"[^>]*aria-live="polite"/);
assert.match(runtime, /fetchVerifiedArtifact\("company-directory-client\.json", "companyDirectory"\)/);
assert.match(runtime, /const preferredAccounts = \["nvidia", "google", "microsoft", "aws", "meta", "openai", "anthropic", "broadcom", "marvell", "dell"\]/);
assert.match(runtime, /accountBrief\?\.decisionFlow/);
assert.match(runtime, /memoryLens\?\.buyingCriteria/);
assert.match(runtime, /capitalPlan\?\.memoryRead/);
assert.match(runtime, /executiveLens\?\.actions/);
assert.match(runtime, /data-account/);
assert.match(runtime, /aria-pressed/);
assert.doesNotMatch(runtime, /MutationObserver/);
assert.match(workflow, /paths-ignore:[\s\S]*data\/company-directory-client\.json/);
assert.match(workflow, /git add[^\n]*data\/company-directory-client\.json/);

console.log(JSON.stringify({
  ok: true,
  runId: directory.runId,
  profiles: directory.profiles.length,
  lenses: ["account", "pain", "next-memory", "deal-gate"],
  partnerRollups: { broadcom: 4, marvell: 3 },
}, null, 2));
