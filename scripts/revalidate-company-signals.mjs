/**
 * Re-check stored company signals against the article each one cites.
 *
 * Attribution used to take a 260-character window either side of a company
 * mention, which spans several sentences and therefore several companies. One
 * TrendForce item read "NVIDIA's Vera Rubin faces a challenger. AMD ships
 * Helios, and Microsoft joins Meta, OpenAI and Oracle as its latest customer",
 * and the window handed NVIDIA's platform to OpenAI, Meta, Oracle and Microsoft
 * as their own observed technology — inverting the story the article told.
 *
 * The extractor now attributes by sentence, but the store accumulates across
 * crawls and carries its prior rows forward, so entries written under the old
 * rule survive on their own. This re-runs the current rule against the article
 * a row cites and drops the row when that article no longer supports it. A row
 * whose article has aged out of the corpus cannot be checked and is kept: the
 * point is to remove what the evidence contradicts, not what it is silent on.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { attributedText, extractTech, itemText } from "./company-signals.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = (name) => resolve(root, "data", name);
const readJson = (name) => JSON.parse(readFileSync(dataPath(name), "utf8"));

const lower = (value) => String(value ?? "").trim().toLowerCase();

const live = readJson("live.json");
const signals = readJson("company-signals.json");
const directory = readJson("company-directory-client.json");

const aliasesById = new Map((directory.profiles || []).map((profile) => [
  profile.id,
  [...new Set([profile.name, profile.nameKo, ...(profile.aliases || []), ...(profile.autoLinkAliases || [])]
    .filter(Boolean).map(lower))],
]));

const corpus = new Map();
for (const item of live.news || []) {
  const url = String(item.link || item.sourceUrl || item.url || "").trim();
  if (url) corpus.set(url, item);
}

let checked = 0;
let unverifiable = 0;
const dropped = [];

for (const [companyId, store] of Object.entries(signals.companies || {})) {
  const aliases = aliasesById.get(companyId) || [companyId];
  if (!Array.isArray(store.tech)) continue;
  store.tech = store.tech.filter((entry) => {
    const item = corpus.get(String(entry.url || "").trim());
    if (item) {
      checked += 1;
      const owned = extractTech(attributedText(itemText(item), aliases));
      if (owned.includes(entry.label)) return true;
      dropped.push({ companyId, label: entry.label, headline: String(entry.headline || "").slice(0, 72) });
      return false;
    }
    // The article has aged out, but the stored headline is often the whole
    // claim. Judge on it only when it carries the technology itself: SK hynix's
    // Hot Chips headline says "SK hynix pushes hybrid bonding for HBM5. The
    // company extends MR-MUF through Nvidia Rubin", and the second sentence had
    // handed HBM5 and hybrid bonding to NVIDIA. When the headline does not name
    // the technology the term came from the body, which is gone, so nothing can
    // be concluded and the row stays.
    unverifiable += 1;
    const headline = String(entry.headline || "");
    if (!extractTech(headline).includes(entry.label)) return true;
    if (extractTech(attributedText(headline, aliases)).includes(entry.label)) return true;
    dropped.push({ companyId, label: entry.label, headline: headline.slice(0, 72), basis: "headline" });
    return false;
  });
}

const report = {
  status: "company-signal-revalidation",
  checkedAgainstCorpus: checked,
  articleNoLongerInCorpus: unverifiable,
  dropped: dropped.length,
};

if (process.argv.includes("--write")) {
  writeFileSync(dataPath("company-signals.json"), `${JSON.stringify(signals, null, 2)}\n`, "utf8");
  report.written = true;
}

console.log(JSON.stringify(report, null, 2));
for (const row of dropped) {
  console.log(`  dropped  ${row.companyId.padEnd(12)} ${String(row.label).padEnd(16)} "${row.headline}"`);
}
