import assert from "node:assert/strict";
import { compactLiveForClient, extractLiveFigures, newsClaimPolicy, validateNewsEvidence } from "./crawl.mjs";

const validatedAt = "2026-08-29T00:00:00.000Z";

function article(overrides = {}) {
  return {
    title: "AI memory product update",
    originalTitle: "AI memory product update",
    summaryOriginal: "The source describes a current memory product update and provides enough context for evidence validation.",
    summary: "The source describes a current memory product update and provides enough context for evidence validation.",
    summarySource: "source-meta",
    source: "Example publication",
    sourceUrl: "https://example.com/news/memory-product-update",
    link: "https://example.com/news/memory-product-update",
    date: "2026-08-28",
    publishedAt: "2026-08-28",
    language: "english",
    streamLanguage: "english",
    category: "hbm",
    ...overrides,
  };
}

const secondarySupplierClaim = article({
  title: "OpenAI Jalapeño uses Samsung HBM4",
  originalTitle: "OpenAI Jalapeño uses Samsung HBM4",
  summaryOriginal: "A secondary report attributes Samsung HBM4 to OpenAI Jalapeño without a first-party supplier disclosure.",
  summary: "A secondary report attributes Samsung HBM4 to OpenAI Jalapeño without a first-party supplier disclosure.",
  source: "Secondary technology report",
  sourceUrl: "https://example.com/news/openai-jalapeno-samsung-hbm4",
  link: "https://example.com/news/openai-jalapeno-samsung-hbm4",
});
const supplierPolicy = newsClaimPolicy(secondarySupplierClaim);
assert.equal(supplierPolicy.claimClass, "jalapeno-product-claim");
assert.equal(supplierPolicy.claimStage, "unverified-secondary");
assert.equal(supplierPolicy.disposition, "quarantine");
assert.equal(supplierPolicy.structuredFactEligible, false);

const secondaryBenchmarkClaim = article({
  title: "OpenAI Jalapeño benchmark is 2x faster than GPUs",
  originalTitle: "OpenAI Jalapeño benchmark is 2x faster than GPUs",
  summaryOriginal: "A secondary article claims a two times throughput advantage before OpenAI has published a measured benchmark.",
  summary: "A secondary article claims a two times throughput advantage before OpenAI has published a measured benchmark.",
  sourceUrl: "https://example.com/news/openai-jalapeno-benchmark",
  link: "https://example.com/news/openai-jalapeno-benchmark",
});
assert.equal(newsClaimPolicy(secondaryBenchmarkClaim).disposition, "quarantine");
assert.equal(newsClaimPolicy(article({
  title: "OpenAI Jalapeño claims 30% lower latency",
  originalTitle: "OpenAI Jalapeño claims 30% lower latency",
  sourceUrl: "https://example.com/news/openai-jalapeno-latency-claim",
  link: "https://example.com/news/openai-jalapeno-latency-claim",
})).disposition, "quarantine", "percentage benchmark claims also require a first-party source");

const quarantined = validateNewsEvidence([secondarySupplierClaim], validatedAt);
assert.equal(quarantined.promoted.length, 0, "unconfirmed Jalapeño supplier claims must not reach the public news stream");
assert.equal(quarantined.quarantined.length, 1);
assert.equal(quarantined.quarantined[0].reason, "unverified_jalapeno_claim");

const compatibilityBundle = compactLiveForClient({
  runId: "claim-gate-fixture",
  updatedAt: validatedAt,
  expiresAt: "2026-08-30T00:00:00.000Z",
  news: [secondarySupplierClaim],
  intelligence: {
    briefs: [{
      id: "hbm",
      latest: {
        title: secondarySupplierClaim.title,
        url: secondarySupplierClaim.sourceUrl,
      },
    }],
    accounts: [{
      id: "openai",
      company: "OpenAI",
      latest: {
        title: secondarySupplierClaim.title,
        url: secondarySupplierClaim.sourceUrl,
      },
      gate: "공식 공급사 공개 전까지 공급사 가정 제외",
    }],
  },
});
assert.equal(compatibilityBundle.news.length, 0, "client rebuilds must re-run the claim gate on older payloads");
assert.equal(compatibilityBundle.intelligence.briefs.length, 0, "quarantined URLs must also be removed from derived client cards");
assert.equal(compatibilityBundle.intelligence.accounts.length, 1, "a blocked nested article must not delete the surrounding account");
assert.equal(compatibilityBundle.intelligence.accounts[0].latest, null, "only the blocked nested evidence should be removed");
assert.equal(compatibilityBundle.intelligence.accounts[0].gate, "공식 공급사 공개 전까지 공급사 가정 제외");

const productionShapedBundle = compactLiveForClient({
    runId: "production-shaped-claim-gate",
    updatedAt: validatedAt,
    expiresAt: "2026-08-30T00:00:00.000Z",
    quality: { status: "verified" },
    news: [],
    intelligence: {
      accounts: [{
        id: "openai",
        company: "OpenAI",
        latest: {
          title: secondarySupplierClaim.title,
          url: secondarySupplierClaim.sourceUrl,
        },
        gate: "공식 공급사 공개 전까지 공급사 가정 제외",
      }],
    },
  }, [{
    title: secondarySupplierClaim.title,
    sourceUrl: secondarySupplierClaim.sourceUrl,
    canonicalUrl: secondarySupplierClaim.sourceUrl,
    reason: "unverified_jalapeno_claim",
    reasons: ["unverified_jalapeno_claim"],
  }]);
assert.equal(productionShapedBundle.intelligence.accounts.length, 1,
  "production-shaped pruning must retain the surrounding account");
assert.equal(productionShapedBundle.intelligence.accounts[0].latest, null,
  "quarantine metadata must remove stale derived evidence even when promoted news is empty");

const firstPartyJalapeno = article({
  title: "OpenAI and Broadcom unveil Jalapeño engineering samples",
  originalTitle: "OpenAI and Broadcom unveil Jalapeño engineering samples",
  summaryOriginal: "OpenAI describes engineering samples at target frequency and power while final performance measurements continue.",
  summary: "OpenAI describes engineering samples at target frequency and power while final performance measurements continue.",
  source: "OpenAI",
  sourceUrl: "https://openai.com/index/openai-broadcom-jalapeno-inference-chip/",
  link: "https://openai.com/index/openai-broadcom-jalapeno-inference-chip/",
});
const firstPartyJalapenoPolicy = newsClaimPolicy(firstPartyJalapeno);
assert.equal(firstPartyJalapenoPolicy.disposition, "allow");
assert.equal(firstPartyJalapenoPolicy.claimStage, "engineering-sample");
assert.equal(firstPartyJalapenoPolicy.structuredFactEligible, true);

const secondary12Gbps = article({
  title: "HBM4 12Gbps requirement reportedly achieved",
  originalTitle: "HBM4 12Gbps requirement reportedly achieved",
  summaryOriginal: "A market report says that a generic HBM4 12Gbps requirement has been achieved without naming a first-party vendor source.",
  summary: "A market report says that a generic HBM4 12Gbps requirement has been achieved without naming a first-party vendor source.",
  source: "Market research",
  sourceUrl: "https://www.trendforce.com/news/2026/08/28/hbm4-speed-report",
  link: "https://www.trendforce.com/news/2026/08/28/hbm4-speed-report",
});
const marketPolicy = newsClaimPolicy(secondary12Gbps);
assert.equal(marketPolicy.claimClass, "hbm4-interface-speed");
assert.equal(marketPolicy.claimStage, "market-estimate");
assert.equal(marketPolicy.claimType, "market-estimate");
assert.equal(marketPolicy.structuredFactEligible, false);
const marketGate = validateNewsEvidence([secondary12Gbps], validatedAt);
assert.equal(marketGate.promoted.length, 1, "a sourced market report may remain visible as a market estimate");
assert.equal(marketGate.promoted[0].verification.claimType, "market-estimate");
assert.equal(marketGate.promoted[0].verification.structuredFactEligible, false);
assert.equal(marketGate.promoted[0].verification.claimBoundary, undefined);
assert.equal(marketGate.promoted[0].verification.checks.claimBoundary, true);
assert.equal(
  extractLiveFigures({ news: marketGate.promoted }).items.length,
  0,
  "market estimates may remain visible as news but must not become structured live KPIs",
);

const firstParty12Gbps = article({
  title: "Samsung HBM4 sustains 12Gbps in mass production",
  originalTitle: "Samsung HBM4 sustains 12Gbps in mass production",
  summaryOriginal: "Samsung states that its HBM4 sustains 12Gbps and is now in mass production for commercial systems.",
  summary: "Samsung states that its HBM4 sustains 12Gbps and is now in mass production for commercial systems.",
  source: "Samsung Newsroom",
  sourceUrl: "https://news.samsung.com/global/samsung-hbm4-performance",
  link: "https://news.samsung.com/global/samsung-hbm4-performance",
});
const officialPolicy = newsClaimPolicy(firstParty12Gbps);
assert.equal(officialPolicy.disposition, "allow");
assert.equal(officialPolicy.claimStage, "volume-production");
assert.equal(officialPolicy.claimType, "official-fact");
assert.equal(officialPolicy.structuredFactEligible, true);

const crossVendorOfficialPage = article({
  title: "Micron HBM4 12Gbps requirement update",
  originalTitle: "Micron HBM4 12Gbps requirement update",
  summaryOriginal: "An official industry roundup discusses a Micron HBM4 12Gbps target without a matching Micron first-party disclosure.",
  summary: "An official industry roundup discusses a Micron HBM4 12Gbps target without a matching Micron first-party disclosure.",
  source: "Samsung Newsroom",
  sourceUrl: "https://news.samsung.com/global/industry-hbm4-speed-roundup",
  link: "https://news.samsung.com/global/industry-hbm4-speed-roundup",
});
assert.equal(newsClaimPolicy(crossVendorOfficialPage).structuredFactEligible, false, "an official domain cannot confirm another vendor's speed claim");

const stackHeight = article({
  title: "SK hynix HBM4 12-layer qualification update",
  originalTitle: "SK hynix HBM4 12-layer qualification update",
  summaryOriginal: "The article discusses a twelve-layer HBM4 stack and does not make an interface-speed claim.",
  summary: "The article discusses a twelve-layer HBM4 stack and does not make an interface-speed claim.",
});
assert.equal(newsClaimPolicy(stackHeight).claimClass, "general-news", "12-layer stack height must not be mistaken for 12Gbps");

console.log("news claim gate tests passed");
