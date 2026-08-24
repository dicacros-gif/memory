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
const consoleIndex = read("console/index.html");
const runtime = read("assets/js/company-profile.js");
const styles = read("assets/css/company-profile.css");
const workflow = read(".github/workflows/pages.yml");
const profiles = new Map((directory.profiles || []).map((profile) => [profile.id, profile]));
const required = [
  "nvidia", "google", "microsoft", "aws", "meta", "apple", "tesla", "openai", "anthropic", "spacex",
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
}
assert.deepEqual(profiles.get("broadcom").chipLens.servesAccounts.map((item) => item.id), ["google", "meta", "openai"]);
assert.deepEqual(profiles.get("marvell").chipLens.servesAccounts.map((item) => item.id), ["microsoft", "aws"]);
for (const id of ["sandisk", "solidigm", "kioxia", "intel", "imec", "ibm"]) {
  assert.ok(profiles.get(id).sources.length > 0, `${id} must remain linked to its source-catalog automation entry`);
}
assert.ok(profiles.get("apple").chipLens.portfolio.some((item) => /Private Cloud|PCC/i.test(`${item.name} ${item.publicSpec}`)), "Apple profile must cover on-device and Private Cloud Compute");
assert.match(index, /assets\/js\/company-profile\.min\.js\?v=infra-[a-f0-9]{12}/);
assert.match(consoleIndex, /assets\/js\/company-profile\.min\.js\?v=infra-[a-f0-9]{12}/);
assert.match(runtime, /data-company-lens="memory"[\s\S]*data-company-lens="chip"[\s\S]*data-company-lens="datacenter"/);
assert.match(runtime, /MutationObserver/);
assert.match(runtime, /company-directory-client\.json/);
assert.match(styles, /transition:color 70ms linear,background-color 70ms linear/);
assert.match(styles, /\.company-profile-modal::backdrop/);
assert.match(workflow, /paths-ignore:[\s\S]*data\/company-directory-client\.json/);
assert.match(workflow, /git add[^\n]*data\/company-directory-client\.json/);

console.log(JSON.stringify({
  ok: true,
  runId: directory.runId,
  profiles: directory.profiles.length,
  lenses: ["memory", "chip", "datacenter"],
  partnerRollups: { broadcom: 3, marvell: 2 },
}, null, 2));
