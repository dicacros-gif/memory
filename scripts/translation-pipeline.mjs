import { createHash } from "node:crypto";
import { auditTranslationFidelity } from "./evidence-integrity.mjs";
import { hasBrokenLocalizationText, hasUntranslatedScript } from "../assets/js/news-localization.js";

export const KO_TRANSLATION_BATCH_MAX_CHARS = 3_600;
export const KO_TRANSLATION_MIN_INTERVAL_MS = 400;
export const KO_TRANSLATION_MAX_RETRIES = 4;
export const KO_TRANSLATION_BACKOFF_BASE_MS = 800;
export const KO_TRANSLATION_CACHE_SCHEMA_VERSION = "1.0";

const MARKER_PREFIX = "ZXQKOTR";
const MARKER_SUFFIX = "QXZ";
const ENGLISH_PROSE_WORD_RE = /\b(?:a|an|the|and|or|but|to|of|for|with|from|into|by|at|in|on|as|that|this|these|those|while|after|before|will|would|could|should|has|have|had|is|are|was|were|been|being)\b/gi;
const ADJACENT_DUPLICATE_TOKEN_RE = /(^|[\s'"“‘(\[])([A-Za-z가-힣][A-Za-z가-힣0-9_-]{1,})(?:\s+\2)+(?=$|[\s'"”’),.?!。！？\]])/giu;
const DISPLAY_COPY_KEYS = new Set([
  "title",
  "titleKo",
  "summary",
  "summaryKo",
  "headline",
  "subtitle",
  "description",
  "body",
  "message",
  "label",
  "demand",
  "role",
  "stance",
]);

function normalizeSourceText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

const CUSTOM_HBM_CO_DESIGN_PATTERN = /SKHY가 실리콘밸리에 고대역폭 메모리\(HBM\) 설계팀을 꾸리는 것으로 알려지면서 미국의 주요 칩 고객사와 공동 설계 작업을 심화할 (?:예정이다|예정)\.?\s*(?:·\s*)?분석가들은 이를 HBM 경쟁이 맞춤형, 공동 개발 단계로 전환하고 있다는 증거로 보고 (?:있습니다|있음)\.?/gu;
const CUSTOM_HBM_CO_DESIGN_BULLET = "실리콘밸리 HBM 설계팀 구축 · 주요 고객 공동 설계 확대 · Custom HBM 경쟁 전환 신호";

export function normalizeKoreanTerminology(value = "") {
  return normalizeSourceText(value)
    .replace(/솔리드다임/g, "솔리다임")
    .replace(/고급 패키징/g, "첨단 패키징")
    .replace(/패널 수준의 포장 크기/g, "패널 레벨 패키징 규격")
    .replace(/TPU向/g, "TPU용")
    .replace(/Data CenterWorkloadOptimization/g, "Data Center Workload Optimization")
    .replace(/New Biz& Partnership/g, "New Biz & Partnership")
    .replace(/CSP\/Data center\s*·\s*workload& TCO/gi, "CSP / Data Center · Workload & TCO")
    .replace(/TSMC\/AdvancedPackaging/g, "TSMC / Advanced Packaging")
    .replace(/AMDHelios/g, "AMD Helios")
    .replace(/CXMT고객/g, "CXMT 고객")
    .replace(/(\d{2})\s*·(?=\p{L})/gu, "$1 · ")
    .replace(/무한\s+Xinxin\s*Semiconductor/gi, "우한 신신 Semiconductor")
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

export function normalizeKoreanDisplayCopy(value = "") {
  return normalizeKoreanTerminology(value)
    .replace(ADJACENT_DUPLICATE_TOKEN_RE, "$1$2");
}

export function normalizeKoreanDisplayPayload(value, key = "", seen = new WeakMap()) {
  if (typeof value === "string") {
    return DISPLAY_COPY_KEYS.has(key) ? normalizeKoreanDisplayCopy(value) : value;
  }
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return seen.get(value);
  const output = Array.isArray(value) ? [] : {};
  seen.set(value, output);
  for (const [childKey, item] of Object.entries(value)) {
    output[childKey] = normalizeKoreanDisplayPayload(item, childKey, seen);
  }
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
  const residualEnglishProseWords = (target.match(ENGLISH_PROSE_WORD_RE) || []).length;
  const targetClauses = target
    .split(/[.!?。！？]+/u)
    .map((clause) => clause.toLowerCase().replace(/[^a-z0-9가-힣一-龥]+/gu, "").trim())
    .filter((clause) => clause.length >= 18);
  const duplicateClause = targetClauses.some((clause, index) => targetClauses.indexOf(clause) !== index);
  const adjacentDuplicateToken = new RegExp(ADJACENT_DUPLICATE_TOKEN_RE.source, ADJACENT_DUPLICATE_TOKEN_RE.flags).test(target);
  const sourceAdjacentDuplicateToken = new RegExp(ADJACENT_DUPLICATE_TOKEN_RE.source, ADJACENT_DUPLICATE_TOKEN_RE.flags).test(source);
  const reasons = [];

  if (!source || !target) reasons.push("empty");
  if (target.includes("\uFFFD")) reasons.push("replacement-character");
  if (/ZXQKOTR\s*\d{4}\s*QXZ/i.test(target)) reasons.push("marker-residue");
  if (source.toLowerCase() === target.toLowerCase() && !/[가-힣]/.test(source)) reasons.push("source-unchanged");
  const foreignSource = !/[가-힣]/.test(source) || hasUntranslatedScript(source);
  if (foreignSource && hangulCount < 4) reasons.push("insufficient-hangul");
  if (foreignSource && hangulRatio < 0.18) reasons.push("low-hangul-ratio");
  if (foreignSource && residualEnglishProseWords >= 3) reasons.push("residual-english-prose");
  if (hanCount > 0) reasons.push("residual-han-script");
  if (hasUntranslatedScript(target) && !hanCount) reasons.push("residual-kana-script");
  if (hasBrokenLocalizationText(source) || hasBrokenLocalizationText(target)) reasons.push("broken-source-encoding");
  if (/科林[研硏][發发]|科林研[發发]/u.test(source) && /Colin|콜린/iu.test(target)) reasons.push("entity-mismatch:Lam-Research");
  if (source.length >= 20 && target.length < Math.max(8, Math.floor(source.length * 0.18))) reasons.push("too-short");
  if (target.length > Math.max(240, source.length * 4)) reasons.push("too-long");
  if (duplicateClause) reasons.push("duplicate-clause");
  if (adjacentDuplicateToken && !sourceAdjacentDuplicateToken) reasons.push("adjacent-token-duplicate");

  return {
    status: reasons.length ? "unverified" : "verified",
    reasons,
    hangulCount,
    hanCount,
    hangulRatio: Number(hangulRatio.toFixed(3)),
    residualEnglishProseWords,
  };
}

// Every caller, including cache reuse, must pass both language and numeric
// fidelity. Chinese magnitude conversions are handled by the numeric parser,
// never by waiving all number mismatches for a Chinese source.
export function koreanTranslationAudit(original = "", translated = "") {
  const language = koreanTranslationQualityGate(original, translated);
  const fidelity = auditTranslationFidelity(original, translated);
  return { status: language.status === "verified" && fidelity.status === "verified" ? "verified" : "unverified", language, fidelity };
}

export function revalidateTranslationPayload(value, stats = { checked: 0, rejected: 0 }, seen = new WeakSet()) {
  if (!value || typeof value !== "object" || seen.has(value)) return stats;
  seen.add(value);
  if (!Array.isArray(value)) {
    for (const [field, original, translated] of [
      ["title", value.originalTitle || value.title, value.titleKo],
      ["summary", value.summaryOriginal, value.summaryKo || value.summary],
    ]) {
      if (!original || !translated) continue;
      const audit = koreanTranslationAudit(original, translated);
      stats.checked += 1;
      if (audit.status !== "verified") stats.rejected += 1;
      value.translation = { ...value.translation, [field]: {
        ...value.translation?.[field],
        ...audit.fidelity,
        reasons: [...audit.language.reasons, ...audit.fidelity.reasons],
        status: audit.status,
        languageStatus: audit.language.status,
        languageReasons: audit.language.reasons,
        fidelityStatus: audit.fidelity.status,
        fidelityReasons: audit.fidelity.reasons,
        chineseUnitNormalization: false,
        cacheState: audit.status === "verified" ? "verified" : "not-written",
        retry: audit.status === "verified" ? null : "next-run",
        display: audit.status === "verified" ? "translated" : "translation-pending",
      } };
    }
  }
  for (const item of Object.values(value)) revalidateTranslationPayload(item, stats, seen);
  return stats;
}

export function protectTranslationEntities(value = "") {
  // Unambiguous registered company name: do not translate 科林 literally as Colin.
  return normalizeSourceText(value).replace(/科林研[發发]/gu, "Lam Research");
}

function splitRequestText(value, maxChars) {
  const text = normalizeSourceText(value);
  const parts = [];
  let remaining = text;
  while (remaining.length > maxChars) {
    const window = remaining.slice(0, maxChars);
    const boundaries = [...window.matchAll(/[。！？.!?;；]\s*|\s+/gu)];
    const last = boundaries.at(-1);
    let end = last && last.index >= maxChars / 2 ? last.index + last[0].length : maxChars;
    if (/[\uD800-\uDBFF]/u.test(remaining[end - 1])) end -= 1;
    parts.push(remaining.slice(0, end).trim());
    remaining = remaining.slice(end).trim();
  }
  if (remaining) parts.push(remaining);
  return parts;
}

function marker(index) {
  return `${MARKER_PREFIX}${String(index).padStart(4, "0")}${MARKER_SUFFIX}`;
}

export function buildMarkerBatches(values = [], maxChars = KO_TRANSLATION_BATCH_MAX_CHARS) {
  if (!Number.isFinite(maxChars) || maxChars <= marker(0).length + 3) throw new Error("translation batch budget is too small");
  const batches = [];
  let current = [];
  let currentLength = 0;

  for (const value of values.flatMap((value) => splitRequestText(value, maxChars - marker(0).length - 2))) {
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
  qualityGate = (original, translated) => koreanTranslationAudit(original, translated).status === "verified",
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
    batches: 0,
    singleFallbackRequests: 0,
    rateLimited: 0,
    transientFailures: 0,
    networkErrors: 0,
    nonRetryableFailures: 0,
    deadlineSkipped: 0,
    pending: 0,
  };
  let nextRequestAt = 0;

  const deadlineExpired = (deadline = 0) => Number.isFinite(deadline) && deadline > 0 && Date.now() >= deadline;

  async function waitForPacing(deadline = 0) {
    // Reserve the slot before awaiting; parallel callers cannot take the same
    // slot after a shared sleep and burst the free endpoint.
    const startAt = Math.max(Date.now(), nextRequestAt);
    const waitMs = Math.max(0, startAt - Date.now());
    if (deadline && startAt >= deadline) return false;
    nextRequestAt = startAt + minIntervalMs;
    if (waitMs > 0) {
      if (deadline && Date.now() + waitMs >= deadline) return false;
      await sleepImpl(waitMs);
    }
    return !deadlineExpired(deadline);
  }

  async function requestTranslation(text, deadline = 0) {
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      if (deadlineExpired(deadline)) {
        stats.deadlineSkipped += 1;
        return "";
      }
      if (attempt > 0) {
        const delay = backoffBaseMs * (2 ** (attempt - 1));
        if (deadline && Date.now() + delay >= deadline) {
          stats.deadlineSkipped += 1;
          return "";
        }
        stats.retries += 1;
        await sleepImpl(delay);
      }
      if (!(await waitForPacing(deadline))) {
        stats.deadlineSkipped += 1;
        return "";
      }
      stats.requests += 1;
      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ko&dt=t&q=${encodeURIComponent(text)}`;
        const response = await fetchImpl(url, {
          signal: AbortSignal.timeout(timeoutMs),
          headers: { "User-Agent": userAgent, Accept: "application/json" },
        });
        if (!response.ok) {
          if (response.status === 429) {
            stats.rateLimited += 1;
            continue;
          }
          if (response.status >= 500) {
            stats.transientFailures += 1;
            continue;
          }
          stats.nonRetryableFailures += 1;
          return "";
        }
        const body = await response.arrayBuffer();
        const json = JSON.parse(new TextDecoder("utf-8").decode(body));
        return normalizeKoreanTerminology((json[0] || []).map((segment) => (segment && segment[0]) || "").join(""));
      } catch {
        stats.networkErrors += 1;
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
    if (!translated || !qualityGate(original, translated)) {
      entries.delete(key);
      return "";
    }
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
      sourceChars: normalizeSourceText(original).length,
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

    const segments = new Map(pending.map((original) => [original,
      splitRequestText(protectTranslationEntities(original), batchMaxChars - marker(0).length - 2),
    ]));
    const segmentTranslations = new Map();
    for (const batch of buildMarkerBatches([...new Set([...segments.values()].flat())], batchMaxChars)) {
      if (deadlineExpired(deadline)) break;
      stats.batches += 1;
      const translatedPayload = await requestTranslation(markerPayload(batch), deadline);
      let translated = parseMarkerTranslation(translatedPayload, batch.length);
      if (!translated) {
        stats.markerFallbacks += 1;
        stats.singleFallbackRequests += batch.length;
        translated = [];
        for (const original of batch) {
          if (deadlineExpired(deadline)) {
            translated.push("");
            continue;
          }
          translated.push(await requestTranslation(original, deadline));
        }
      }
      batch.forEach((segment, index) => segmentTranslations.set(segment, translated[index] || ""));
    }
    for (const [original, parts] of segments) {
      // Cache only a complete, full-source-validated translation. Partial chunks
      // never become a published summary or a successful cache entry.
      const localized = parts.map((part) => segmentTranslations.get(part) || "");
      const accepted = storeTranslation(original, localized.every(Boolean) ? localized.join(" ") : "");
      if (accepted) output.set(original, accepted);
    }
    stats.pending += originals.filter((original) => !output.has(original)).length;
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
