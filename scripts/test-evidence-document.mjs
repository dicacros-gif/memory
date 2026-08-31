import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evidenceDocumentUrl } from "./crawl.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// A decision card names a source and a date. Both are lies when the source is a
// company's front page: its meta description is a permanent marketing line, and
// the date is the day the crawler looked. "Empower your data center and AI" on
// solidigm.com was published as the sole evidence under 수요·고객, and the same
// page was simultaneously the NAND·eSSD headline — one tagline, two decisions.
const PLACES = [
  "https://www.solidigm.com/",
  "https://www.micron.com/",
  "https://jp.micron.com/",
  "https://www.sandisk.com/",
  "https://www.cxmt.com/en/",
  "https://news.solidigm.com/en-WW/",
  "https://www.solidot.org/story",
  "https://www.micron.com/about/careers",
  "https://www.micron.com/products/memory/hbm",
  "https://www.micron.com/products/storage/nand-flash",
  "https://www.sandisk.com/product-portfolio",
  "https://www.solidigm.com/our-story.html",
  // A company page under a container: /site/ passed the leading-segment test
  // and made this the headline evidence under two decisions.
  "https://www.xmcwh.com/en/site/about-XMC",
  "https://example.com/en/company/overview",
  "https://en.wikipedia.org/wiki/Micron_Technology",
  "https://www.google.com/finance/quote/MU:NASDAQ",
  "https://companiesmarketcap.com/cxmt/marketcap/",
  "https://www.tomshardware.com/reviews/glossary-hbm-hbm2-high-bandwidth-memory-definition,5889.html",
];

// Documents: something happened, on a day, at a URL that names it.
const DOCUMENTS = [
  "https://www.trendforce.com/news/2026/07/21/news-amds-first-rack-scale-ai-system-helios-challenges-nvidia-with-hbm4-memory-edge-but-reportedly-comes-at-a-higher-price/",
  "https://blogs.microsoft.com/blog/2026/07/20/microsoft-expands-azure-ai-and-hpc-infrastructure-with-amd/",
  "https://www.cnbc.com/2026/07/27/cxmt-china-market-debut-chipmaker-ipo.html",
  "https://finance.technews.tw/2026/08/29/cxmt/",
  "https://www.ithome.com.tw/news/178512",
  "https://hothardware.com/news/sk-hynix-spins-off-solidigm-form-10-billion-ai-company-us",
  "https://news.skhynix.com/sk-hynix-develops-hbm4/",
];

for (const url of PLACES) {
  assert.equal(evidenceDocumentUrl({ sourceUrl: url }), "", `a place must not be evidence: ${url}`);
}
for (const url of DOCUMENTS) {
  assert.equal(evidenceDocumentUrl({ sourceUrl: url }), url, `a document must stay evidence: ${url}`);
}

// And the published artifact must hold to it, so a brief built before the gate
// existed cannot survive a rebuild.
const artifact = path.join(root, "data", "landing-decision-client.json");
if (fs.existsSync(artifact)) {
  const briefs = JSON.parse(fs.readFileSync(artifact, "utf8")).briefs || [];
  const places = briefs
    .filter((brief) => brief?.latest?.url && !evidenceDocumentUrl({ sourceUrl: brief.latest.url }))
    .map((brief) => `${brief.id}: ${brief.latest.url}`);
  assert.deepEqual(places, [], "a published decision card must cite a document, not a landing page");

  // One page cannot be the evidence under two different decisions.
  const byUrl = new Map();
  for (const brief of briefs) {
    const url = brief?.latest?.url;
    if (!url) continue;
    byUrl.set(url, [...(byUrl.get(url) || []), brief.id]);
  }
  const shared = [...byUrl.entries()].filter(([, ids]) => ids.length > 1).map(([url, ids]) => `${url} → ${ids.join(", ")}`);
  assert.deepEqual(shared, [], "two decision cards must not rest on the same source page");
}

console.log(JSON.stringify({ status: "evidence-document-pass", places: PLACES.length, documents: DOCUMENTS.length }));
