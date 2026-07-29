import assert from "node:assert/strict";
import {
  buildMarkerBatches,
  createGoogleKoTranslator,
  koreanTranslationQualityGate,
  parseMarkerTranslation,
} from "./translation-pipeline.mjs";

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
assert.equal(koreanTranslationQualityGate(originals[0], originals[0]).status, "unverified");
assert.equal(koreanTranslationQualityGate(originals[0], "메모리 공급이 빠듯한 가운데 수요가 확대되고 있습니다").status, "verified");

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

console.log("Translation pipeline checks passed");
