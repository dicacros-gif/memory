import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildIntelligence, evidenceDocumentUrl } from "./crawl.mjs";

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

// Synthetic articles exercise the real generator, not only the last committed
// snapshot. A fresh crawl previously selected the same Sandisk document for
// both NAND and demand, failing only after the remote crawl had finished.
const sharedUrl = "https://investor.sandisk.com/news-releases/news-release-details/sandisk-and-sk-hynix-advance-global-standardization-high";
const article = (id, url, title, summary) => ({
  title, originalTitle: title, summary, summaryOriginal: summary,
  summarySource: "source-meta", source: "Official newsroom", sourceUrl: url,
  link: url, date: "2026-09-02", language: "english", category: "industry",
  verification: {
    id, sourceClass: "official", structuredFactEligible: true,
    origin: "live-crawl", observedThisRun: true,
  },
});
const shared = article("shared", sharedUrl,
  "NAND flash SSD standardization supports AI data center inference serving",
  "The release describes flash storage standards for data center inference serving with implementation details and a dated technical roadmap.");
const trackingDuplicate = article("shared-tracking", `${sharedUrl}?utm_source=duplicate#overview`, shared.title, shared.summary);
const alternate = article("demand-alternate", "https://blogs.microsoft.com/blog/2026/09/02/data-center-update/",
  "Microsoft expands data center infrastructure",
  "Microsoft describes additional infrastructure capacity and the schedule for facilities coming online across multiple locations.");
for (const news of [[shared, alternate], [shared, trackingDuplicate, alternate]]) {
  const briefs = buildIntelligence({ news }).briefs;
  const nand = briefs.find((brief) => brief.id === "nand");
  const demand = briefs.find((brief) => brief.id === "demand");
  assert.equal(nand?.latest.url, sharedUrl);
  assert.equal(nand?.latest.provenanceId, "shared");
  assert.equal(demand?.latest.url, alternate.sourceUrl);
  assert.equal(demand?.latest.provenanceId, "demand-alternate");
  assert.equal(demand?.latest.title, alternate.title);
  assert.equal(demand?.latest.summary, alternate.summary);
}
const limited = buildIntelligence({ news: [shared, trackingDuplicate] }).briefs;
assert.equal(limited.find((brief) => brief.id === "nand")?.latest.url, sharedUrl);
assert.equal(limited.some((brief) => brief.id === "demand"), false,
  "without independent evidence, omit demand instead of recycling a source");

// A brief leads with current evidence. A July HBM article with more topic
// words in its title outranked this week's HBM news for three months; the
// strongest document of the last three weeks now wins, and an older one leads
// only when nothing recent qualifies.
{
  const daysAgo = (days) => new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const older = { ...article("hbm-older", "https://news.example.com/2026/hbm4-hbm4e-rubin-base-die-cowos",
    "HBM4 and HBM4E base die for Rubin on CoWoS: high bandwidth memory roadmap",
    "The report describes HBM4 and HBM4E base die plans for Rubin systems on CoWoS with dated qualification milestones."), date: daysAgo(25) };
  const recent = { ...article("hbm-recent", "https://news.example.com/2026/hbm4-qualification-update",
    "Supplier completes HBM4 qualification",
    "The supplier says its HBM4 stacks completed customer qualification and lists the shipment schedule for the next quarter."), date: daysAgo(3) };
  const lead = (news) => buildIntelligence({ news }).briefs.find((brief) => brief.id === "hbm")?.latest.provenanceId;
  assert.equal(lead([older, recent]), "hbm-recent", "this week's qualifying document leads over an older, wordier one");
  assert.equal(lead([older]), "hbm-older", "an older document still leads when nothing recent qualifies");
  // A summary that failed the Korean translation gate makes the site panel
  // fall back to pending, so a translated document leads over it.
  const translated = { ...recent, sourceUrl: "https://news.example.com/2026/hbm4-qualification-translated",
    link: "https://news.example.com/2026/hbm4-qualification-translated",
    summary: "공급사는 HBM4 스택이 고객 인증을 마쳤다고 밝히고 다음 분기 출하 일정을 제시했습니다. 인증 일정과 패키징 할당이 함께 공개됐습니다.",
    verification: { ...recent.verification, id: "hbm-translated" } };
  assert.equal(lead([older, recent, translated]), "hbm-translated", "a translated document leads over one that failed the translation gate");
  // ...but only at near-equal relevance. Ranking translation first made a
  // 3D NAND article the capital brief over an IPO filing.
  const capitalLead = (news) => buildIntelligence({ news }).briefs.find((brief) => brief.id === "capital")?.latest.provenanceId;
  const ipo = { ...article("capital-ipo", "https://news.example.com/2026/memory-maker-ipo-filing",
    "Memory maker files for Nasdaq IPO offering to fund capex",
    "The company filed its IPO registration for a Nasdaq listing and says the offering funds capex for a new fab over the next two years."), date: daysAgo(2) };
  const nandOffering = { ...article("capital-weak", "https://news.example.com/2026/next-gen-3d-nand",
    "Next-generation 3D NAND doubles bit density, offering extreme performance",
    "새로운 3D NAND는 400단 이상으로 비트 밀도를 두 배로 높이며 클라이언트 SSD의 용량과 성능을 개선할 수 있을지 주목됩니다."), date: daysAgo(2) };
  // The NAND lens takes its own, stronger document, as in the live run, so the
  // weak one is left competing for the capital lens.
  const nandLead = { ...article("nand-lead", "https://news.example.com/2026/nand-ssd-flash-solidigm",
    "NAND flash and enterprise SSD supply tighten as Solidigm and YMTC cut output",
    "NAND flash makers including Solidigm and YMTC cut output, tightening enterprise SSD and eSSD supply for AI storage into next year."), date: daysAgo(2) };
  const mixed = buildIntelligence({ news: [ipo, nandOffering, nandLead] }).briefs;
  assert.equal(mixed.find((brief) => brief.id === "nand")?.latest.provenanceId, "nand-lead", "relevance outranks translation");
  assert.equal(capitalLead([ipo, nandOffering, nandLead]), "capital-ipo");
}

// A topic term is a word: "dram" inside "micro-dramas" is not DRAM news.
{
  const drama = article("dram-drama", "https://news.example.com/2026/ai-micro-dramas-compute",
    "Video platform denies AI micro-dramas consume half of AI computing power",
    "The platform said only a tenth of its computing power trains video generation models for micro-dramas, amid an industry controversy.");
  assert.equal(buildIntelligence({ news: [drama] }).briefs.some((brief) => brief.id === "dram"), false,
    "a substring of another word must not qualify a document for a topic");
}

// When another lens already owns the primary fact's document, an alternate
// source must not inherit that fact's identity/stage.
const primary = article("primary-fact", "https://www.sec.gov/Archives/edgar/data/1234/20260902/offering.htm",
  "DRAM maker CXMT announces IPO offering",
  "The filing describes the IPO offering and the company's DRAM production plans with dated financial information.");
const capitalAlternate = article("capital-alternate", "https://investor.example.com/news-releases/2026-09-02-capex-update",
  "Company announces capex investment",
  "The company provides its capital investment schedule and the expected timing of the facilities in this announcement.");
const facts = { events: [{ id: "cxmt-ipo-offering", topicIds: ["capital"], current: {
  provenanceId: "primary-fact", stageId: "offering", publishedAt: "2026-09-02", sourceUrl: primary.sourceUrl,
} }] };
const alternateFact = buildIntelligence({ news: [primary, capitalAlternate], facts }).briefs.find((brief) => brief.id === "capital");
assert.equal(alternateFact?.latest.provenanceId, "capital-alternate");
assert.equal(alternateFact?.latest.factId, null);
assert.equal(alternateFact?.latest.factStage, null);
const originalFact = buildIntelligence({ news: [capitalAlternate], facts: { events: [{ ...facts.events[0], current: {
  ...facts.events[0].current, provenanceId: "capital-alternate",
} }] } }).briefs.find((brief) => brief.id === "capital");
assert.equal(originalFact?.latest.factId, "cxmt-ipo-offering", "a selected primary fact keeps its identity");
assert.equal(originalFact?.latest.factStage, "offering");

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
