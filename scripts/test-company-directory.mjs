import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isWithinPublicArticleWindow, publicArticleCutoff } from "./public-article-window.mjs";
import { buildCompanyDirectory } from "./company-directory.mjs";

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
// Facts verified by hand expire after 365 days and the profile is withheld
// until re-verified; that is curation, not a crawl failure. Shape checks on the
// curated catalog therefore read the unfiltered catalog for a withheld id.
const staleIds = new Set((directory.withheldProfiles || [])
  .filter((entry) => entry.status === "stale")
  .map((entry) => entry.id));
const catalogProfiles = new Map(buildCompanyDirectory({
  siteContentExtended: json("data/site-content-extended-client.json"),
  runId: directory.runId,
  generatedAt: directory.generatedAt,
  publicArtifact: false,
}).profiles.map((profile) => [profile.id, profile]));
const profileOf = (id) => profiles.get(id) || (staleIds.has(id) ? catalogProfiles.get(id) : undefined);
const required = [
  "nvidia", "google", "microsoft", "aws", "meta", "tesla", "spacexai", "openai", "anthropic", "oracle",
  "broadcom", "marvell", "tsmc", "skhynix", "samsung", "micron", "cxmt",
  "dell", "hpe", "lenovo", "supermicro", "foxconn",
  "amd", "alchip", "guc", "wiwynn", "inventec", "gigabyte", "asus",
  // Apple was withheld while it had no dated first-party evidence. The PCC
  // expansion, the AFM 3 post and the Broadcom commitment supply it now.
  "apple",
];
const withheld = ["quanta-qct", "cisco", "fujitsu"];
assert.match(runtime, /String\(row\.amount\)\.replace\(\/\(\[\\d,.\]\+\)억 달러\/g,[\s\S]*?\.replace\(\/ billion\/g, "B"\)\.replace\(\/ million\/g, "M"\)/, "CAPEX amounts must render with compact $B and $M units");

assert.equal(directory.runId, manifest.runId, "company directory and browser manifest must share one runId");
assert.ok(directory.profiles.length + staleIds.size >= 20, "directory must cover customers, partners, suppliers, and semiconductor ecosystem companies");
assert.equal(directory.automation?.failClosed, true, "the public company directory must declare fail-closed publication");
assert.ok(directory.coverage?.catalog > directory.coverage?.published, "the public directory must report withheld profiles without publishing them");
for (const profile of directory.profiles || []) {
  assert.equal(profile.publication?.status, "verified", `${profile.id} must pass the publication gate before browser exposure`);
  assert.match(profile.verifiedAt || "", /^\d{4}-\d{2}-\d{2}$/, `${profile.id} must expose its verification date`);
  const urls = [profile.officialUrl, ...(profile.sources || []).map((source) => source.url), ...(profile.baseline?.sources || []).map((source) => source.url)];
  assert.ok(urls.some((url) => /^https?:\/\//.test(url || "")), `${profile.id} must retain a source URL`);
}
for (const id of required) {
  const profile = profiles.get(id);
  // A required profile whose hand-verified facts passed 365 days is withheld by
  // design; that is a curation task (re-verify company-intelligence.json), not
  // a reason to stop the day's publication.
  if (!profile && staleIds.has(id)) continue;
  assert.ok(profile, `${id} company profile is required`);
  assert.ok(profile.memoryLens?.pain && profile.memoryLens?.proposal && profile.memoryLens?.gate, `${id} requires a decision-ready memory lens`);
  assert.ok(profile.chipLens?.primaryChip, `${id} requires a chip lens`);
  assert.ok(profile.dataCenterLens?.systemBottleneck && profile.dataCenterLens?.executionGate, `${id} requires a data-center lens`);
  assert.equal(profile.executiveLens?.actions?.length, 3, `${id} requires an automated 90-day executive action plan`);
  assert.equal(profile.accountBrief?.organizationRaci?.length, 3, `${id} requires GSM, HBM Business, and MSR account actions`);
  assert.equal(profile.accountBrief?.decisionFlow?.length, 4, `${id} requires account-to-deal decision flow`);
  assert.ok((profile.evidence || []).every((item) => isWithinPublicArticleWindow(item.date, publicArticleCutoff(directory.generatedAt))), `${id} profile must expose only articles from the year before the directory was built`);
}
for (const id of withheld) assert.ok(!profiles.has(id), `${id} must be withheld until its evidence is refreshed`);
assert.deepEqual(profileOf("broadcom").chipLens.servesAccounts.map((item) => item.id), ["google", "meta", "openai", "anthropic"]);
assert.deepEqual(profileOf("marvell").chipLens.servesAccounts.map((item) => item.id), ["google", "microsoft", "aws"]);
for (const id of ["dell", "hpe", "lenovo", "supermicro"]) assert.equal(profileOf(id).layer, "oem-tier-1", `${id} must open as a Tier 1 Strategic OEM profile`);
assert.match(profileOf("supermicro").logo || "", /supermicro\.com/, "Supermicro profile must display its company mark instead of SU initials");
assert.equal(profileOf("foxconn").layer, "oem-tier-2", "Foxconn must open as a verified Tier 2 AI Server ODM profile");
for (const id of ["wiwynn", "inventec"]) assert.equal(profileOf(id).layer, "oem-tier-2", `${id} must publish as a verified Tier 2 AI Server ODM profile`);
for (const id of ["gigabyte", "asus"]) assert.equal(profileOf(id).layer, "oem-tier-3", `${id} must publish as a verified Tier 3 AI infrastructure profile`);
assert.match(profileOf("wiwynn").officialUrl || "", /wiwynn\.com/, "Wiwynn profile must retain the official Vera Rubin source");
assert.match(profileOf("inventec").officialUrl || "", /inventec\.com/, "Inventec profile must retain the official Vera Rubin source");
assert.match(profileOf("gigabyte").officialUrl || "", /gigabyte\.com/, "GIGABYTE profile must retain the official Vera Rubin source");
assert.match(profileOf("asus").officialUrl || "", /asus\.com/, "ASUS profile must retain the official rack-validation source");
assert.ok(profileOf("hpe").aliases.includes("Hewlett Packard Enterprise"), "HPE profile must carry the productive crawl identity");
assert.ok(profileOf("foxconn").aliases.includes("Hon Hai"), "Foxconn profile must match its legal company name");
assert.equal(profileOf("skhynix").layer, "memory-supplier", "existing supplier profile layers must remain unchanged");
assert.ok(!profileOf("tesla").aliases.some((alias) => /^space\s*x$/i.test(alias)), "Tesla and SpaceXAI must remain separate accounts");
assert.ok(profileOf("spacexai").aliases.some((alias) => /^xai$/i.test(alias)), "SpaceXAI must preserve xAI as a crawl alias");
assert.match(index, /assets\/js\/company-profile\.min\.js\?v=infra-[a-f0-9]{12}/);
assert.doesNotMatch(consoleIndex, /company-profile\.min\.js/, "the static investor snapshot must not inject issuer logos or dialogs");
assert.match(runtime, /data-company-lens="overview"[\s\S]*data-company-lens="memory"[\s\S]*data-company-lens="chip"[\s\S]*data-company-lens="datacenter"/);
assert.match(runtime, /GSM → HBM Business → MSR/);
assert.match(runtime, /MutationObserver/);
assert.match(runtime, /company-directory-client\.json/);
assert.match(runtime, /profile\?\.publication\?\.status === "verified"/, "the browser must independently reject unverified profiles");
assert.match(runtime, /const companyName = \(profile = \{\}\) => profile\.name \|\| profile\.nameKo \|\| "Company";/, "company profile titles must prefer one English company name without bilingual duplication");
assert.match(runtime, /data-company-profile-logo/, "company profile headers must render verified logo sources with a monogram fallback");
assert.doesNotMatch(runtime, /closest\?\.\("[^\"]*data-dynamics-company/, "circular dynamics nodes must update the linked detail panel instead of opening the company modal");
assert.match(styles, /transition:color 70ms linear,background-color 70ms linear/);
assert.match(styles, /\.company-profile-modal::backdrop/);
assert.match(styles, /\.company-profile-modal\{position:fixed;inset:0;margin:auto/, "company profile dialog must be centered in the viewport");
assert.match(styles, /\.company-account-flow/);
assert.match(styles, /\.company-raci/);
assert.match(styles, /\.company-profile-executive-strip \{[\s\S]*?linear-gradient\(105deg, #f2fbf9 0%, #eef4fc 52%, #fff7e7 100%\)/, "profile summary strip must use a light consulting gradient");
assert.match(styles, /\.company-profile-modal \*[\s\S]*?transition: none !important;/, "profile hover colours must repaint atomically without a delayed unreadable state");
assert.match(runtime, /EXECUTIVE ACTION/);
assert.match(workflow, /paths-ignore:[\s\S]*data\/company-directory-client\.json/);
assert.match(workflow, /git add[^\n]*data\/company-directory-client\.json/);

console.log(JSON.stringify({
  ok: true,
  runId: directory.runId,
  profiles: directory.profiles.length,
  lenses: ["overview", "memory", "chip", "datacenter"],
  partnerRollups: { broadcom: 4, marvell: 2 },
}, null, 2));
