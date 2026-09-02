import assert from "node:assert/strict";
import {
  KO_TRANSLATION_BACKOFF_BASE_MS,
  KO_TRANSLATION_BATCH_MAX_CHARS,
  KO_TRANSLATION_MAX_RETRIES,
  KO_TRANSLATION_MIN_INTERVAL_MS,
  buildMarkerBatches,
  createGoogleKoTranslator,
  koreanTranslationQualityGate,
  koreanTranslationAudit,
  revalidateTranslationPayload,
  normalizeKoreanDisplayPayload,
  normalizeKoreanPayload,
  normalizeKoreanTerminology,
  parseMarkerTranslation,
  translationCacheKey,
} from "./translation-pipeline.mjs";

assert.equal(KO_TRANSLATION_BATCH_MAX_CHARS, 3_600);
assert.equal(KO_TRANSLATION_MIN_INTERVAL_MS, 400);
assert.equal(KO_TRANSLATION_MAX_RETRIES, 4);
assert.equal(KO_TRANSLATION_BACKOFF_BASE_MS, 800);

const originals = [
  "Memory supply remains tight while demand expands.",
  "The company raised its capital expenditure plan to USD 10 billion.",
  "HBM demand is accelerating in AI servers.",
];

const batches = buildMarkerBatches(originals, 120);
assert.ok(batches.length >= 2, "marker batching must keep every request under its character budget");
assert.ok(batches.every((batch) => batch.reduce((sum, text, index) => sum + text.length + `ZXQKOTR${String(index).padStart(4, "0")}QXZ`.length + 2, 0) <= 120));

const parsed = parseMarkerTranslation(
  "ZXQKOTR0000QXZ 메모리 공급이 빠듯합니다 ZXQKOTR0001QXZ 설비투자 계획을 상향했습니다",
  2,
);
assert.deepEqual(parsed, ["메모리 공급이 빠듯합니다", "설비투자 계획을 상향했습니다"]);
assert.equal(normalizeKoreanTerminology("솔리드다임 뉴스룸"), "솔리다임 뉴스룸");
const duplicateDisplayFixture = "공동 공동 창조와 저온 저온 테스트 · '작업 작업' 모드";
assert.equal(normalizeKoreanTerminology(duplicateDisplayFixture), duplicateDisplayFixture, "global terminology normalization must preserve source repetition");
assert.deepEqual(
  normalizeKoreanDisplayPayload({
    title: "HBM 유입 유입 변화",
    summary: duplicateDisplayFixture,
    originalTitle: "Memory Memory inflow shift",
    summaryOriginal: "共同共创",
    excerpt: "ir ir utility utility",
    sourceUrl: "https://example.com/repeat/repeat",
  }),
  {
    title: "HBM 유입 변화",
    summary: "공동 창조와 저온 테스트 · '작업' 모드",
    originalTitle: "Memory Memory inflow shift",
    summaryOriginal: "共同共创",
    excerpt: "ir ir utility utility",
    sourceUrl: "https://example.com/repeat/repeat",
  },
  "only display fields may collapse accidental adjacent tokens; source evidence must stay intact",
);
const longCoDesignCopy = "SKHY가 실리콘밸리에 고대역폭 메모리(HBM) 설계팀을 꾸리는 것으로 알려지면서 미국의 주요 칩 고객사와 공동 설계 작업을 심화할 예정이다. 분석가들은 이를 HBM 경쟁이 맞춤형, 공동 개발 단계로 전환하고 있다는 증거로 보고 있습니다.";
const conciseCoDesignCopy = "실리콘밸리 HBM 설계팀 구축 · 주요 고객 공동 설계 확대 · Custom HBM 경쟁 전환 신호";
assert.equal(normalizeKoreanTerminology(longCoDesignCopy), conciseCoDesignCopy);
assert.deepEqual(
  normalizeKoreanPayload({ title: "솔리드다임 뉴스룸", nested: [{ summary: longCoDesignCopy }] }),
  { title: "솔리다임 뉴스룸", nested: [{ summary: conciseCoDesignCopy }] },
  "published nested payloads must normalize stale terminology before serialization",
);
assert.equal(koreanTranslationQualityGate(originals[0], originals[0]).status, "unverified");
assert.equal(koreanTranslationQualityGate(originals[0], "메모리 공급이 빠듯한 가운데 수요가 확대되고 있습니다").status, "verified");
assert.ok(
  koreanTranslationQualityGate(originals[0], "메모리 메모리 공급이 빠듯한 가운데 수요가 확대되고 있습니다").reasons.includes("adjacent-token-duplicate"),
  "raw translations with adjacent duplicate tokens must fail the quality gate",
);
assert.equal(
  koreanTranslationQualityGate("Bora Bora expands memory supply.", "보라 보라 지역에서 메모리 공급을 확대합니다").status,
  "verified",
  "an intentional adjacent repetition present in the source must be preserved",
);
assert.ok(
  koreanTranslationQualityGate(
    originals[0],
    "메모리 공급이 빠듯하지만 the company will expand supply with new capacity",
  ).reasons.includes("residual-english-prose"),
  "partially translated English prose must not pass the Korean quality gate",
);
assert.equal(
  koreanTranslationQualityGate("长鑫存储扩大DRAM产能", "长鑫存储는 DRAM 생산능력을 확대합니다").status,
  "unverified",
  "Chinese-source translations must not retain Han-script text",
);
assert.equal(
  koreanTranslationQualityGate("长鑫存储扩大DRAM产能", "창신메모리는 DRAM 생산능력을 확대합니다").status,
  "verified",
);

let requestCount = 0;
const waits = [];
const translations = [
  { status: 429, payload: [] },
  { status: 429, payload: [] },
  { status: 429, payload: [] },
  { status: 429, payload: [] },
  {
    status: 200,
    payload: [[[
      "ZXQKOTR0000QXZ 메모리 공급이 빠듯한 가운데 수요가 확대되고 있습니다 "
      + "ZXQKOTR0001QXZ 회사는 설비투자 계획을 100억 달러로 상향했습니다 "
      + "ZXQKOTR0002QXZ 인공지능 서버에서 HBM 수요가 가속화되고 있습니다",
    ]]],
  },
];
const fakeFetch = async () => {
  const fixture = translations[Math.min(requestCount, translations.length - 1)];
  requestCount += 1;
  return {
    ok: fixture.status === 200,
    status: fixture.status,
    arrayBuffer: async () => new TextEncoder().encode(JSON.stringify(fixture.payload)).buffer,
  };
};
const translator = createGoogleKoTranslator({
  fetchImpl: fakeFetch,
  sleepImpl: async (ms) => waits.push(ms),
  minIntervalMs: 0,
  backoffBaseMs: 800,
  maxRetries: 4,
  batchMaxChars: 3_600,
  qualityGate: (original, translated) => koreanTranslationQualityGate(original, translated).status === "verified",
});
const translated = await translator.translateTexts(originals);
assert.equal(requestCount, 5, "four HTTP 429 responses should recover on the final bounded attempt");
assert.deepEqual(waits, [800, 1_600, 3_200, 6_400], "retries should use 0.8→6.4 second exponential backoff");
assert.equal(translated.size, 3);
assert.equal(translator.stats.retries, 4);
assert.equal(translator.stats.rateLimited, 4);
assert.equal(translator.stats.pending, 0);
assert.equal(translator.stats.batches, 1);

const cachedTranslator = createGoogleKoTranslator({
  cache: translator.snapshot(),
  fetchImpl: async () => {
    throw new Error("cache hit must not call the endpoint");
  },
  minIntervalMs: 0,
  qualityGate: (original, localized) => koreanTranslationQualityGate(original, localized).status === "verified",
});
const cached = await cachedTranslator.translateTexts(originals);
assert.equal(cached.size, 3);
assert.equal(cachedTranslator.stats.cacheHits, 3);

const typoOriginal = "Solidigm Newsroom";
const typoKey = translationCacheKey(typoOriginal);
const typoTranslator = createGoogleKoTranslator({
  cache: {
    entries: {
      [typoKey]: { translated: "솔리드다임 뉴스룸", updatedAt: "2026-08-16T00:00:00.000Z" },
    },
  },
  fetchImpl: async () => { throw new Error("normalized cache hit must not call the endpoint"); },
  minIntervalMs: 0,
  qualityGate: (original, localized) => koreanTranslationQualityGate(original, localized).status === "verified",
});
const typoResult = await typoTranslator.translateTexts([typoOriginal]);
assert.equal(typoResult.get(typoOriginal), "솔리다임 뉴스룸");
assert.equal(typoTranslator.snapshot().entries[typoKey].translated, "솔리다임 뉴스룸");

const duplicateOriginal = "HBM inflows shift from Taiwan to Malaysia.";
const duplicateKey = translationCacheKey(duplicateOriginal);
let duplicateHealingCalls = 0;
const duplicateHealingTranslator = createGoogleKoTranslator({
  cache: {
    entries: {
      [duplicateKey]: { translated: "HBM 유입 유입 흐름이 대만에서 말레이시아로 이동합니다", updatedAt: "2026-08-16T00:00:00.000Z" },
    },
  },
  fetchImpl: async () => {
    duplicateHealingCalls += 1;
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => new TextEncoder().encode(JSON.stringify([[['ZXQKOTR0000QXZ HBM 유입 흐름이 대만에서 말레이시아로 이동합니다']]])).buffer,
    };
  },
  minIntervalMs: 0,
  maxRetries: 0,
  qualityGate: (original, localized) => koreanTranslationQualityGate(original, localized).status === "verified",
});
const duplicateHealed = await duplicateHealingTranslator.translateTexts([duplicateOriginal]);
assert.equal(duplicateHealingCalls, 1, "a polluted duplicate cache row must be rejected and retranslated");
assert.equal(duplicateHealingTranslator.stats.cacheHits, 0);
assert.equal(duplicateHealed.get(duplicateOriginal), "HBM 유입 흐름이 대만에서 말레이시아로 이동합니다");
assert.equal(duplicateHealingTranslator.snapshot().entries[duplicateKey].translated, "HBM 유입 흐름이 대만에서 말레이시아로 이동합니다");

let healingCalls = 0;
const rejectedTranslator = createGoogleKoTranslator({
  fetchImpl: async () => {
    healingCalls += 1;
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => new TextEncoder().encode(JSON.stringify([[['ZXQKOTR0000QXZ Memory supply remains tight and the company will expand capacity']]])).buffer,
    };
  },
  minIntervalMs: 0,
  maxRetries: 0,
  qualityGate: (original, localized) => koreanTranslationQualityGate(original, localized).status === "verified",
});
const rejected = await rejectedTranslator.translateTexts([originals[0]]);
assert.equal(rejected.size, 0);
assert.equal(rejectedTranslator.stats.pending, 1);
assert.equal(rejectedTranslator.snapshot().entryCount, 0, "failed quality gates must never enter the cache");

const selfHealingTranslator = createGoogleKoTranslator({
  cache: rejectedTranslator.snapshot(),
  fetchImpl: async () => {
    healingCalls += 1;
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => new TextEncoder().encode(JSON.stringify([[['ZXQKOTR0000QXZ 메모리 공급 제약 지속 · 신규 생산능력 확대로 대응']]])).buffer,
    };
  },
  minIntervalMs: 0,
  maxRetries: 0,
  qualityGate: (original, localized) => koreanTranslationQualityGate(original, localized).status === "verified",
});
const healed = await selfHealingTranslator.translateTexts([originals[0]]);
assert.equal(healed.get(originals[0]), "메모리 공급 제약 지속 · 신규 생산능력 확대로 대응");
assert.equal(healingCalls, 2, "an uncached failed row must be retried and heal on the next run");
assert.equal(selfHealingTranslator.snapshot().entryCount, 1);

console.log("Translation pipeline checks passed");

assert.equal(koreanTranslationQualityGate("Memory demand is rising", "메모리 수요가 拡大되고 있습니다").status, "unverified");
assert.equal(koreanTranslationQualityGate("メモリ需要が拡大", "메모리 수요가 늘어나고 カタカナ가 남습니다").status, "unverified");
assert.equal(koreanTranslationQualityGate("한국어 混合 消息", "한국어 混合 소식입니다").status, "unverified");
assert.equal(koreanTranslationQualityGate("科林研發擴大半導體設備供應", "Colin R&D는 반도체 장비 공급을 확대합니다").status, "unverified");
assert.equal(koreanTranslationAudit("长鑫科技计划募资295亿元。", "CXMT는 295억 달러의 자금을 조달할 계획입니다").status, "unverified", "language success must not waive a currency error");
const staleNumeric = { title: "长鑫科技计划募资295亿元。", titleKo: "CXMT는 295억 달러의 자금을 조달할 계획입니다", translation: { title: { status: "verified", chineseUnitNormalization: true } } };
revalidateTranslationPayload(staleNumeric);
assert.equal(staleNumeric.translation.title.status, "unverified");
assert.equal(staleNumeric.translation.title.retry, "next-run");
assert.equal(staleNumeric.title, "长鑫科技计划募资295亿元。", "source provenance remains untouched");

const jsonResponse = (text) => ({ ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode(JSON.stringify([[[text]]])).buffer });
const defaultGateTranslator = createGoogleKoTranslator({ minIntervalMs: 0, fetchImpl: async () => jsonResponse("ZXQKOTR0000QXZ 메모리 공급이 빠듯한 가운데 수요가 확대되고 있습니다") });
assert.equal((await defaultGateTranslator.translateTexts([originals[0]])).size, 1, "default gate must validate against the actual source, not an empty string");

const longSource = "Memory bandwidth is important for AI inference. ".repeat(240);
const oversized = buildMarkerBatches([longSource]);
assert.ok(oversized.length > 1);
assert.ok(oversized.every((batch) => batch.reduce((sum, value) => sum + value.length + 15, 0) <= 3600));
const requestSizes = [];
const longTranslator = createGoogleKoTranslator({ minIntervalMs: 0, qualityGate: () => true, fetchImpl: async (url) => {
  const request = new URL(url).searchParams.get("q");
  requestSizes.push(request.length);
  return jsonResponse(request.replace(/Memory bandwidth is important for AI inference\./g, "AI 추론에서 메모리 대역폭이 중요합니다."));
} });
const longResult = await longTranslator.translateTexts([longSource]);
assert.ok(requestSizes.every((size) => size <= 3600), "every network payload, including a single long source, is bounded");
assert.ok(longResult.get(longSource.trim()));
assert.equal(longTranslator.snapshot().entryCount, 1, "cache the complete source, not partial chunks");

const started = [];
const parallelTranslator = createGoogleKoTranslator({ minIntervalMs: 40, qualityGate: () => true, fetchImpl: async () => {
  started.push(Date.now());
  return jsonResponse("ZXQKOTR0000QXZ 메모리 공급 제약을 확인합니다");
} });
await Promise.all(["memory source one", "memory source two", "memory source three"].map((value) => parallelTranslator.translateTexts([value])));
assert.equal(started.length, 3);
assert.ok(started[1] - started[0] >= 30 && started[2] - started[1] >= 30, "concurrent callers must reserve distinct pacing slots");
console.log("Localization safety, exact fidelity, bounded chunks and parallel pacing checks passed");
