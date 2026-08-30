import assert from "node:assert/strict";
import {
  compactLiveForClient,
  extractLiveFigures,
  isNonArticleNewsPage,
  newsClaimPolicy,
  sanitizeConsoleClientCopy,
  sanitizePublishedClaimArtifacts,
  sanitizeTranslationCacheClaims,
  validateNewsEvidence,
} from "./crawl.mjs";

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
assert.equal(supplierPolicy.claimStage, "supplier-undisclosed");
assert.equal(supplierPolicy.disposition, "quarantine");
assert.equal(supplierPolicy.structuredFactEligible, false);

for (const supplier of ["Samsung", "SK hynix", "Micron"]) {
  const forgedOfficialSupplier = article({
    title: `OpenAI Jalapeño uses ${supplier} HBM`,
    originalTitle: `OpenAI Jalapeño uses ${supplier} HBM`,
    summaryOriginal: `${supplier} is described as the HBM supplier even though OpenAI has made no supplier disclosure.`,
    summary: `${supplier} is described as the HBM supplier even though OpenAI has made no supplier disclosure.`,
    source: "OpenAI",
    sourceUrl: "https://openai.com/index/jalapeno-first-results/",
    link: "https://openai.com/index/jalapeno-first-results/",
  });
  assert.equal(newsClaimPolicy(forgedOfficialSupplier).disposition, "quarantine",
    `${supplier} attribution must remain blocked even when a genuine OpenAI results URL is reused`);
}

const embeddedOfficialLink = article({
  title: "OpenAI Jalapeño benchmark report",
  originalTitle: "OpenAI Jalapeño benchmark report",
  summaryOriginal: "A secondary story claims Jalapeño beats GB300 and embeds https://openai.com/index/jalapeno-first-results/ in its text.",
  summary: "A secondary story claims Jalapeño beats GB300 and embeds https://openai.com/index/jalapeno-first-results/ in its text.",
  sourceUrl: "https://example.com/secondary-jalapeno-report",
  link: "https://openai.com/index/jalapeno-first-results/",
});
assert.equal(newsClaimPolicy(embeddedOfficialLink).disposition, "quarantine",
  "an embedded or fallback official link cannot replace the direct secondary source URL");

const spoofedOfficialHost = article({
  title: "OpenAI Jalapeño first results",
  originalTitle: "OpenAI Jalapeño first results",
  summaryOriginal: "Jalapeño records 1.5–1.9x peak AI work per watt and 1.7–3.6x lower latency.",
  summary: "Jalapeño records 1.5–1.9x peak AI work per watt and 1.7–3.6x lower latency.",
  sourceUrl: "https://openai.com.evil.example/index/jalapeno-first-results/",
  link: "https://openai.com.evil.example/index/jalapeno-first-results/",
});
assert.equal(newsClaimPolicy(spoofedOfficialHost).disposition, "quarantine",
  "lookalike hosts must never satisfy the exact OpenAI source rule");

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

const observedArticle = article({
  title: "Verified source page observed in this crawl",
  originalTitle: "Verified source page observed in this crawl",
  sourceUrl: "https://example.com/news/observed-current-run",
  link: "https://example.com/news/observed-current-run",
});
const feedOnlyArticle = article({
  title: "Feed summary remains after the source page fetch fails",
  originalTitle: "Feed summary remains after the source page fetch fails",
  sourceUrl: "https://example.com/news/feed-only-current-run",
  link: "https://example.com/news/feed-only-current-run",
  summarySource: "headline",
});
const observationGate = validateNewsEvidence([observedArticle, feedOnlyArticle], validatedAt);
assert.equal(observationGate.promoted.length, 1,
  "one unobserved feed row must not discard a separately verified current-run article");
assert.equal(observationGate.promoted[0].sourceUrl, observedArticle.sourceUrl);
assert.equal(observationGate.quarantined.length, 1);
assert.equal(observationGate.quarantined[0].reason, "source_not_observed_this_run");
assert.equal(observationGate.quarantined[0].reasonLabel, "이번 실행 원문 확인 실패");

for (const landing of [
  article({ title: "Solidigm Newsroom", originalTitle: "Solidigm Newsroom", sourceUrl: "https://news.solidigm.com/en-WW/", link: "https://news.solidigm.com/en-WW/" }),
  article({ title: "World-class SSD data storage solutions", originalTitle: "World-class SSD data storage solutions", sourceUrl: "https://www.solidigm.com/", link: "https://www.solidigm.com/" }),
  article({ title: "About Solidigm", originalTitle: "About Solidigm", sourceUrl: "https://www.solidigm.com/our-story.html", link: "https://www.solidigm.com/our-story.html" }),
]) assert.equal(isNonArticleNewsPage(landing), true, `${landing.sourceUrl} must not render as an article`);

const articleWithRootQuery = article({
  title: "A current memory industry article",
  originalTitle: "A current memory industry article",
  sourceUrl: "https://publisher.example/?p=904203",
  link: "https://publisher.example/?p=904203",
});
assert.equal(isNonArticleNewsPage(articleWithRootQuery), false, "a root URL with an article identifier must remain eligible");

const nonArticleGate = validateNewsEvidence([article({
  title: "Solidigm Newsroom",
  originalTitle: "Solidigm Newsroom",
  sourceUrl: "https://news.solidigm.com/en-WW/",
  link: "https://news.solidigm.com/en-WW/",
})], validatedAt);
assert.equal(nonArticleGate.promoted.length, 0, "newsroom landing pages must not reach the public news stream");
assert.ok(nonArticleGate.quarantined[0].reasons.includes("non_article_page"));

const compatibilityBundle = compactLiveForClient({
  runId: "claim-gate-fixture",
  updatedAt: validatedAt,
  expiresAt: "2026-08-30T00:00:00.000Z",
  evidence: { promotedCount: 1 },
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
assert.equal(compatibilityBundle.evidence.promotedCount, 0, "client evidence count must follow the post-gate browser stream");
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

const firstPartyJalapenoResults = article({
  title: "Jalapeño first results",
  originalTitle: "Jalapeño first results",
  summaryOriginal: "Against GB200 and GB300 on disclosed workloads, InferenceX measured 1.5–1.9x higher peak AI work per watt and 1.7–3.6x lower end-to-end latency across three public models.",
  summary: "Against GB200 and GB300 on disclosed workloads, InferenceX measured 1.5–1.9x higher peak AI work per watt and 1.7–3.6x lower end-to-end latency across three public models.",
  source: "OpenAI",
  sourceUrl: "https://openai.com/index/jalapeno-first-results/",
  link: "https://openai.com/index/jalapeno-first-results/",
});
assert.equal(newsClaimPolicy(firstPartyJalapenoResults).disposition, "allow",
  "OpenAI's first-party measured results must pass the claim gate");
assert.equal(newsClaimPolicy(firstPartyJalapenoResults).claimStage, "verified-performance");

const firstPartyKoreanMetricOrder = article({
  title: "Jalapeño 공식 측정 결과",
  originalTitle: "Jalapeño official measurements",
  summaryOriginal: "OpenAI measured power efficiency at 1.5–1.9x and end-to-end latency at 1.7–3.6x lower.",
  summary: "공개 모델에서 전력 효율은 1.5–1.9배, End-to-end 지연은 1.7–3.6배 낮게 측정됨.",
  source: "OpenAI",
  sourceUrl: "https://openai.com/index/jalapeno-first-results/",
  link: "https://openai.com/index/jalapeno-first-results/",
});
assert.equal(newsClaimPolicy(firstPartyKoreanMetricOrder).disposition, "allow",
  "official Korean translations must pass whether the metric label precedes the number");
assert.equal(newsClaimPolicy(firstPartyKoreanMetricOrder).claimStage, "verified-performance");

const firstPartyQualification = article({
  title: "Jalapeño Production Qualification update",
  originalTitle: "Jalapeño Production Qualification update",
  summaryOriginal: "Production Qualification is ongoing, with OpenAI Compute deployment planned by end of 2026.",
  summary: "Production Qualification is ongoing, with OpenAI Compute deployment planned by end of 2026.",
  source: "OpenAI",
  sourceUrl: "https://openai.com/index/jalapeno-first-results/",
  link: "https://openai.com/index/jalapeno-first-results/",
});
assert.equal(newsClaimPolicy(firstPartyQualification).disposition, "allow",
  "the exact results page may substantiate its qualification and year-end deployment wording");
assert.equal(newsClaimPolicy(firstPartyQualification).claimStage, "qualification");

const blanketOfficialBenchmark = article({
  title: "Jalapeño beats GB300",
  originalTitle: "Jalapeño beats GB300",
  summaryOriginal: "Jalapeño beats GB300 across all production workloads.",
  summary: "Jalapeño beats GB300 across all production workloads.",
  source: "OpenAI",
  sourceUrl: "https://openai.com/index/jalapeno-first-results/",
  link: "https://openai.com/index/jalapeno-first-results/",
});
assert.equal(newsClaimPolicy(blanketOfficialBenchmark).disposition, "quarantine",
  "a genuine results URL cannot substantiate a broader benchmark than the disclosed workload metrics");

const announcementWithResults = article({
  title: "Jalapeño engineering sample benchmark",
  originalTitle: "Jalapeño engineering sample benchmark",
  summaryOriginal: "The engineering sample beats GB300 with 1.5–1.9x higher peak AI work per watt.",
  summary: "The engineering sample beats GB300 with 1.5–1.9x higher peak AI work per watt.",
  source: "OpenAI",
  sourceUrl: "https://openai.com/index/openai-broadcom-jalapeno-inference-chip/",
  link: "https://openai.com/index/openai-broadcom-jalapeno-inference-chip/",
});
assert.equal(newsClaimPolicy(announcementWithResults).disposition, "quarantine",
  "the engineering-sample announcement cannot be used as the source for later benchmark results");

assert.equal(newsClaimPolicy(article({
  title: "Jalapeño memory architecture",
  originalTitle: "Jalapeño memory architecture",
  summaryOriginal: "Jalapeño uses a new memory architecture that is not disclosed on the announcement page.",
  summary: "Jalapeño uses a new memory architecture that is not disclosed on the announcement page.",
  sourceUrl: "https://openai.com/index/openai-broadcom-jalapeno-inference-chip/",
  link: "https://openai.com/index/openai-broadcom-jalapeno-inference-chip/",
})).disposition, "quarantine", "the announcement path is limited to engineering sample and target claims");

assert.equal(newsClaimPolicy(article({
  title: "Jalapeño memory architecture",
  originalTitle: "Jalapeño memory architecture",
  summaryOriginal: "Jalapeño uses a new memory architecture that is not part of the disclosed result metrics.",
  summary: "Jalapeño uses a new memory architecture that is not part of the disclosed result metrics.",
  sourceUrl: "https://openai.com/index/jalapeno-first-results/",
  link: "https://openai.com/index/jalapeno-first-results/",
})).disposition, "quarantine", "the results path is limited to disclosed metrics and lifecycle statements");

const sanitizedConsoleCopy = sanitizeConsoleClientCopy({
  news: [{
    title: "OpenAI Jalapeño supplier update",
    summary: "Samsung will supply HBM4 for the Jalapeño inference chip.",
    url: "https://example.com/unverified-jalapeno-supplier",
  }, {
    title: "OpenAI Jalapeño benchmark update",
    summary: "Jalapeño will outperform GB300 in production workloads.",
    url: "https://example.com/unverified-jalapeno-benchmark",
  }, {
    title: "OpenAI and Broadcom unveil Jalapeño engineering samples",
    summary: "OpenAI describes engineering samples while final performance measurements continue.",
    url: "https://openai.com/index/openai-broadcom-jalapeno-inference-chip/",
  }, {
    title: firstPartyJalapenoResults.title,
    summary: firstPartyJalapenoResults.summary,
    url: firstPartyJalapenoResults.sourceUrl,
  }],
  unsupportedStandalone: "OpenAI Jalapeño는 삼성 HBM4를 사용해 GB300을 능가",
  strategicSignal: "2개 출처 · 롱컨텍스트 추론의 KV cache 병목",
  reviewStatus: "근거 품질 미달 · 점수 산출 보류",
  metadataStatus: "88/96건 원문 메타 확보",
  databaseStatus: "누적 DB · 3건 · Memory demand",
});

assert.equal(sanitizedConsoleCopy.news.length, 2,
  "unsupported Jalapeño supplier and benchmark evidence must be removed from console client payloads");
assert.equal(sanitizedConsoleCopy.news[0].title, firstPartyJalapeno.title,
  "safe OpenAI engineering-sample wording must remain available to the console");
assert.match(sanitizedConsoleCopy.news[1].summary, /1\.5–1\.9x[\s\S]*1\.7–3\.6x/,
  "official Jalapeño measurements must survive console sanitization");
assert.equal(
  sanitizedConsoleCopy.unsupportedStandalone,
  "Jalapeño · 공급사 미공개 · 공개 Workload별 공식 측정값만 사용",
  "unsupported standalone copy must be neutralized to the verified disclosure boundary",
);
assert.equal(sanitizedConsoleCopy.strategicSignal, "롱컨텍스트 추론의 KV cache 병목");
assert.equal(sanitizedConsoleCopy.reviewStatus, "공식·공시 원문 확인 전 전략 판단 보류");
assert.equal(sanitizedConsoleCopy.metadataStatus, "원문 메타 검증");
assert.equal(sanitizedConsoleCopy.databaseStatus, "Memory demand");
assert.doesNotMatch(
  JSON.stringify(sanitizedConsoleCopy),
  /(?:삼성.{0,32}HBM4|GB300.{0,24}능가|\d+\s*개\s*출처|\d+\/\d+건\s*원문\s*메타|누적\s*DB)/i,
  "sanitized console payloads must not retain unsupported claims or pipeline counters",
);

const rawArtifact = sanitizePublishedClaimArtifacts({
  intelligence: {
    accounts: [{
      id: "openai",
      company: "OpenAI",
      latest: {
        headline: "OpenAI Jalapeño supplier update",
        evidenceSpan: "SK hynix supplies HBM4 for Jalapeño",
        sourceUrl: "https://openai.com/index/jalapeno-first-results/",
      },
      gate: "공급사 공개 전까지 가정 제외",
    }],
  },
});
assert.equal(rawArtifact.intelligence.accounts.length, 1,
  "raw-publication sanitation must preserve the surrounding account");
assert.equal(rawArtifact.intelligence.accounts[0].latest, null,
  "full claim surfaces such as evidenceSpan must be sanitized before raw publication");

const retainedCompanyProfile = sanitizePublishedClaimArtifacts({
  profiles: [{
    id: "openai",
    name: "OpenAI",
    summary: "Jalapeño engineering sample and qualification roadmap",
    officialUrl: "https://openai.com/index/openai-broadcom-jalapeno-inference-chip/",
    accountBrief: {
      mandate: "공식 공개 범위 안에서 Chip Roadmap을 Memory Requirement로 전환",
    },
    latest: {
      headline: "OpenAI Jalapeño supplier update",
      evidenceSpan: "Samsung will supply HBM4 for Jalapeño",
      sourceUrl: "https://example.com/unverified-jalapeno-supplier",
    },
  }],
});
assert.equal(retainedCompanyProfile.profiles.length, 1,
  "a verified company profile must not be reclassified and removed as if it were an article");
assert.equal(retainedCompanyProfile.profiles[0].id, "openai");
assert.equal(retainedCompanyProfile.profiles[0].latest, null,
  "an unsupported nested article must still be removed from the retained profile");

const retainedOfficialRetrievalChunk = sanitizePublishedClaimArtifacts({
  results: [{
    score: 2.75,
    chunkId: "openai-official-source-chunk",
    title: "OpenAI and Broadcom unveil LLM-optimized inference chip | OpenAI",
    excerpt: "OpenAI operates across chip architecture, kernels, memory systems, networking, scheduling, and deployment systems.",
    source: "OpenAI Infrastructure",
    sourceClass: "official",
    url: "https://openai.com/index/openai-broadcom-jalapeno-inference-chip/",
    publishedAt: "2026-06-24",
    documentStatus: "current",
  }],
}, [{
  title: "Forged Jalapeño supplier claim",
  summary: "Samsung will supply HBM4 for Jalapeño",
  sourceUrl: "https://openai.com/index/openai-broadcom-jalapeno-inference-chip/",
  reason: "unverified_jalapeno_claim",
}]);
assert.equal(retainedOfficialRetrievalChunk.results.length, 1,
  "a forged claim must not globally blacklist the genuine OpenAI source document");

const cleanedCache = sanitizeTranslationCacheClaims({
  schemaVersion: "1.0",
  entryCount: 2,
  entries: {
    blocked: { translated: "OpenAI Jalapeño에는 마이크론 HBM4가 공급된다." },
    retained: { translated: "OpenAI Jalapeño first results는 1.5–1.9x 전력 효율을 측정했다." },
  },
});
assert.deepEqual(Object.keys(cleanedCache.entries), ["retained"],
  "translation-cache publication must deterministically remove blocked supplier translations");
assert.equal(cleanedCache.entryCount, 1);

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
