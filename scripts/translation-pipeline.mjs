import { createHash } from "node:crypto";

export const KO_TRANSLATION_BATCH_MAX_CHARS = 3_600;
export const KO_TRANSLATION_MIN_INTERVAL_MS = 400;
export const KO_TRANSLATION_MAX_RETRIES = 4;
export const KO_TRANSLATION_BACKOFF_BASE_MS = 800;
export const KO_TRANSLATION_CACHE_SCHEMA_VERSION = "1.0";

const MARKER_PREFIX = "ZXQKOTR";
const MARKER_SUFFIX = "QXZ";

function normalizeSourceText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

const CUSTOM_HBM_CO_DESIGN_PATTERN = /SKHY가 실리콘밸리에 고대역폭 메모리\(HBM\) 설계팀을 꾸리는 것으로 알려지면서 미국의 주요 칩 고객사와 공동 설계 작업을 심화할 (?:예정이다|예정)\.?\s*(?:·\s*)?분석가들은 이를 HBM 경쟁이 맞춤형, 공동 개발 단계로 전환하고 있다는 증거로 보고 (?:있습니다|있음)\.?/gu;
const CUSTOM_HBM_CO_DESIGN_BULLET = "실리콘밸리 HBM 설계팀 구축 · 주요 고객 공동 설계 확대 · Custom HBM 경쟁 전환 신호";

export function normalizeKoreanTerminology(value = "") {
  return normalizeSourceText(value)
    .replace(/솔리드다임/g, "솔리다임")
    .replace(CUSTOM_HBM_CO_DESIGN_PATTERN, CUSTOM_HBM_CO_DESIGN_BULLET);
}

export function normalizeKoreanPayload(value, seen = new WeakMap()) {
  if (typeof value === "string") return normalizeKoreanTerminology(value);
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return seen.get(value);
  const output = Array.isArray(value) ? [] : {};
  seen.set(value, output);
  for (const [key, item] of Object.entries(value)) output[key] = normalizeKoreanPayload(item, seen);
  return output;
}

export function translationCacheKey(value = "") {
  return createHash("sha256")
    .update(`ko\n${normalizeSourceText(value)}`)
    .digest("hex");
}

export function koreanTranslationQualityGate(original = "", translated = "") {
  const source = normalizeSourceText(original);
  const target = normalizeSourceText(translated);
  const hangulCount = (target.match(/[가-힣]/g) || []).length;
  const sourceHanCount = (source.match(/[㐀-䶿一-鿿豈-﫿]/g) || []).length;
  const hanCount = (target.match(/[㐀-䶿一-鿿豈-﫿]/g) || []).length;
  const contentCount = (target.match(/[A-Za-z가-힣一-龥]/g) || []).length;
  const hangulRatio = contentCount ? hangulCount / contentCount : 0;
  const reasons = [];

  if (!source || !target) reasons.push("empty");
  if (target.includes("\uFFFD")) reasons.push("replacement-character");
  if (/ZXQKOTR\s*\d{4}\s*QXZ/i.test(target)) reasons.push("marker-residue");
  if (source.toLowerCase() === target.toLowerCase() && !/[가-힣]/.test(source)) reasons.push("source-unchanged");
  if (!/[가-힣]/.test(source) && hangulCount < 4) reasons.push("insufficient-hangul");
  if (!/[가-힣]/.test(source) && hangulRatio < 0.08) reasons.push("low-hangul-ratio");
  if (sourceHanCount > 0 && hanCount > 0) reasons.push("residual-han-script");
  if (source.length >= 20 && target.length < Math.max(8, Math.floor(source.length * 0.18))) reasons.push("too-short");
  if (target.length > Math.max(240, source.length * 4)) reasons.push("too-long");

  return {
    status: reasons.length ? "unverified" : "verified",
    reasons,
    hangulCount,
    hanCount,
    hangulRatio: Number(hangulRatio.toFixed(3)),
  };
}

function marker(index) {
  return `${MARKER_PREFIX}${String(index).padStart(4, "0")}${MARKER_SUFFIX}`;
}

export function buildMarkerBatches(values = [], maxChars = KO_TRANSLATION_BATCH_MAX_CHARS) {
  const batches = [];
  let current = [];
  let currentLength = 0;

  for (const value of values) {
    const text = normalizeSourceText(value);
    if (!text) continue;
    const partLength = marker(current.length).length + text.length + 2;
    if (current.length && currentLength + partLength > maxChars) {
      batches.push(current);
      current = [];
      currentLength = 0;
    }
    current.push(text);
    currentLength += marker(current.length - 1).length + text.length + 2;
  }
  if (current.length) batches.push(current);
  return batches;
}

function markerPayload(values = []) {
  return values.map((value, index) => `${marker(index)}\n${value}`).join("\n");
}

export function parseMarkerTranslation(value = "", expectedCount = 0) {
  const text = String(value || "");
  const matches = [...text.matchAll(/ZXQKOTR\s*(\d{4})\s*QXZ/gi)];
  if (matches.length !== expectedCount) return null;
  const output = Array(expectedCount).fill("");
  for (let index = 0; index < matches.length; index += 1) {
    const id = Number(matches[index][1]);
    if (!Number.isInteger(id) || id < 0 || id >= expectedCount) return null;
    const start = Number(matches[index].index) + matches[index][0].length;
    const end = index + 1 < matches.length ? Number(matches[index + 1].index) : text.length;
    output[id] = normalizeKoreanTerminology(text.slice(start, end));
  }
  return output.every(Boolean) ? output : null;
}

function cacheEntriesFromPayload(cache = {}) {
  const source = cache && typeof cache === "object" && cache.entries && typeof cache.entries === "object"
    ? cache.entries
    : {};
  return new Map(Object.entries(source));
}

export function createGoogleKoTranslator({
  cache = {},
  fetchImpl = globalThis.fetch,
  sleepImpl = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  timeoutMs = 8_000,
  minIntervalMs = KO_TRANSLATION_MIN_INTERVAL_MS,
  maxRetries = KO_TRANSLATION_MAX_RETRIES,
  backoffBaseMs = KO_TRANSLATION_BACKOFF_BASE_MS,
  batchMaxChars = KO_TRANSLATION_BATCH_MAX_CHARS,
  userAgent = "Mozilla/5.0",
  qualityGate = (_original, translated) => koreanTranslationQualityGate("", translated).status === "verified",
  maxCacheEntries = 5_000,
} = {}) {
  const entries = cacheEntriesFromPayload(cache);
  const stats = {
    requests: 0,
    retries: 0,
    cacheHits: 0,
    translated: 0,
    qualityRejected: 0,
    markerFallbacks: 0,
  };
  let nextRequestAt = 0;

  const deadlineExpired = (deadline = 0) => Number.isFinite(deadline) && deadline > 0 && Date.now() >= deadline;

  async function waitForPacing(deadline = 0) {
    const waitMs = Math.max(0, nextRequestAt - Date.now());
    if (waitMs > 0) {
      if (deadline && Date.now() + waitMs >= deadline) return false;
      await sleepImpl(waitMs);
    }
    nextRequestAt = Date.now() + minIntervalMs;
    return true;
  }

  async function requestTranslation(text, deadline = 0) {
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      if (deadlineExpired(deadline)) return "";
      if (attempt > 0) {
        const delay = backoffBaseMs * (2 ** (attempt - 1));
        if (deadline && Date.now() + delay >= deadline) return "";
        stats.retries += 1;
        await sleepImpl(delay);
      }
      if (!(await waitForPacing(deadline))) return "";
      stats.requests += 1;
      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ko&dt=t&q=${encodeURIComponent(text)}`;
        const response = await fetchImpl(url, {
          signal: AbortSignal.timeout(timeoutMs),
          headers: { "User-Agent": userAgent, Accept: "application/json" },
        });
        if (!response.ok) {
          if (response.status === 429 || response.status >= 500) continue;
          return "";
        }
        const body = await response.arrayBuffer();
        const json = JSON.parse(new TextDecoder("utf-8").decode(body));
        return normalizeKoreanTerminology((json[0] || []).map((segment) => (segment && segment[0]) || "").join(""));
      } catch {
        // Network timeouts and transient endpoint errors use the same bounded
        // exponential retry path. A final failure is intentionally not cached.
      }
    }
    return "";
  }

  function cachedTranslation(original) {
    const key = translationCacheKey(original);
    const entry = entries.get(key);
    const translated = normalizeKoreanTerminology(entry?.translated);
    if (!translated || !qualityGate(original, translated)) return "";
    entry.translated = translated;
    entry.lastUsedAt = new Date().toISOString();
    stats.cacheHits += 1;
    return translated;
  }

  function storeTranslation(original, translated) {
    const clean = normalizeKoreanTerminology(translated);
    if (!qualityGate(original, clean)) {
      stats.qualityRejected += 1;
      return "";
    }
    const now = new Date().toISOString();
    entries.set(translationCacheKey(original), {
      translated: clean,
      updatedAt: now,
      lastUsedAt: now,
    });
    stats.translated += 1;
    return clean;
  }

  async function translateTexts(values = [], { deadline = 0 } = {}) {
    const originals = [...new Set(values.map(normalizeSourceText).filter(Boolean))];
    const output = new Map();
    const pending = [];

    for (const original of originals) {
      const cached = cachedTranslation(original);
      if (cached) output.set(original, cached);
      else pending.push(original);
    }

    for (const batch of buildMarkerBatches(pending, batchMaxChars)) {
      if (deadlineExpired(deadline)) break;
      const translatedPayload = await requestTranslation(markerPayload(batch), deadline);
      let translated = parseMarkerTranslation(translatedPayload, batch.length);
      if (!translated) {
        stats.markerFallbacks += 1;
        translated = [];
        for (const original of batch) {
          if (deadlineExpired(deadline)) {
            translated.push("");
            continue;
          }
          translated.push(await requestTranslation(original, deadline));
        }
      }
      batch.forEach((original, index) => {
        const accepted = storeTranslation(original, translated[index] || "");
        if (accepted) output.set(original, accepted);
      });
    }
    return output;
  }

  function snapshot() {
    const sorted = [...entries.entries()]
      .sort((left, right) => String(right[1]?.lastUsedAt || right[1]?.updatedAt || "").localeCompare(String(left[1]?.lastUsedAt || left[1]?.updatedAt || "")))
      .slice(0, maxCacheEntries)
      .map(([key, entry]) => [key, {
        ...entry,
        translated: normalizeKoreanTerminology(entry?.translated),
      }]);
    return {
      schemaVersion: KO_TRANSLATION_CACHE_SCHEMA_VERSION,
      targetLanguage: "ko",
      updatedAt: new Date().toISOString(),
      entryCount: sorted.length,
      entries: Object.fromEntries(sorted),
    };
  }

  return {
    stats,
    translateTexts,
    snapshot,
  };
}
