import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// A research house lends authority. A card that says "Goldman Sachs" over a
// TrendForce article borrows that authority for a claim the bank never
// published — the article merely mentioned it, and a mention-based match
// promoted the mention to the byline. The crawler already knows each house's
// own domain (BROKER_OFFICIAL_DOMAINS in scripts/crawl.mjs); this asserts that
// nothing downstream attributes a house outside it.
//
// Brands on their own domains are unaffected: "Microsoft" on blogs.microsoft.com
// and "TSMC 3DFabric" on 3dfabric.tsmc.com are correct labels, and only the
// houses listed here are checked at all.
const RESEARCH_HOUSE_DOMAINS = {
  "morgan-stanley": ["morganstanley.com"],
  "goldman-sachs": ["goldmansachs.com"],
  jpmorgan: ["jpmorgan.com"],
  ubs: ["ubs.com"],
  citi: ["citigroup.com", "citi.com"],
  bofa: ["bofa.com", "bankofamerica.com"],
  jefferies: ["jefferies.com"],
  barclays: ["barclays.com"],
  nomura: ["nomura.com"],
  mizuho: ["mizuho.com"],
  hsbc: ["hsbc.com"],
};

const hostOf = (value) => {
  try { return new URL(String(value)).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
};

const onOwnDomain = (id, url) => {
  const host = hostOf(url);
  if (!host) return true;
  return (RESEARCH_HOUSE_DOMAINS[id] || []).some((domain) => host === domain || host.endsWith(`.${domain}`));
};

const ARTIFACTS = [
  "data/executive-latest.json",
  "data/insight-ledger.json",
  "data/site-content-client.json",
  "data/site-content-extended-client.json",
  "data/landing-decision-client.json",
];

const conflicts = [];
const walk = (node, file) => {
  if (Array.isArray(node)) return node.forEach((item) => walk(item, file));
  if (!node || typeof node !== "object") return;
  // A record that types itself a citation is already telling the truth: the
  // article cites the house, it was not published by it. Only a byline lies.
  if (node.evidenceType === "news-citation") return;
  const id = node.sourceId || node.institutionId;
  const url = node.url || node.sourceUrl;
  if (typeof id === "string" && RESEARCH_HOUSE_DOMAINS[id] && typeof url === "string" && url) {
    // A citation of a house is legitimate as long as it is not presented as the
    // house's own publication. The byline is what must not lie.
    const presentedAsHouse = String(node.source || node.institution || "")
      .toLowerCase()
      .replace(/[^a-z]/g, "")
      .includes(id.replace(/-/g, "").slice(0, 7));
    if (presentedAsHouse && !onOwnDomain(id, url)) {
      conflicts.push(`${file}: source "${node.source || node.institution}" (${id}) on ${hostOf(url)}`);
    }
  }
  Object.values(node).forEach((value) => walk(value, file));
};

let scanned = 0;
for (const relative of ARTIFACTS) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) continue;
  scanned += 1;
  walk(JSON.parse(fs.readFileSync(absolute, "utf8")), relative);
}

const unique = [...new Set(conflicts)];
if (unique.length) {
  console.error(`research-house attribution conflicts (${unique.length}):`);
  for (const line of unique) console.error(`  ${line}`);
}
assert.deepEqual(unique, [], "a research house must not be the byline on another publisher's domain");

console.log(JSON.stringify({ status: "source-attribution-pass", scanned, houses: Object.keys(RESEARCH_HOUSE_DOMAINS).length }));
