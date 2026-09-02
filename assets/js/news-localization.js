// Shared publication boundary: retain source evidence, never display a failed
// CJK translation as if it were Korean copy. No network or browser dependencies.
const SOURCE_SCRIPT_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
const HANGUL_RE = /[가-힣]/u;
const LOCALIZATION_LANGUAGE_RE = /^(?:chinese|japanese|zh(?:[-_].*)?|ja(?:[-_].*)?|中文|日本語)$/i;
const DISPLAY_KEYS = new Set([
  "title", "titleKo", "headline", "subtitle", "summary", "summaryKo",
  "quote", "excerpt", "evidence", "text", "body", "description", "message",
  "label", "name", "note", "caption", "statement", "insight", "validation",
  "fact", "implication", "decision", "action", "question", "answer", "thesis",
  "recommendation", "meaning", "rationale", "detail", "demand", "role", "stance",
]);
const PROVENANCE_KEYS = new Set([
  "aliases", "alias", "originalTitle", "summaryOriginal", "originalText",
  "rssDescription", "discoveryQuery", "sourceTitle", "sourceOriginalTitle",
  "source", "provenance", "sourceProvenance", "url", "link", "sourceUrl",
  "canonicalUrl", "language", "streamLanguage", "sourceLanguage", "lang",
]);

const clean = (value) => typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "";

export function hasUntranslatedScript(value = "") {
  return SOURCE_SCRIPT_RE.test(String(value || ""));
}

export function hasBrokenLocalizationText(value = "") {
  const text = String(value || "");
  if (/[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(text)) return true;
  if (/ZXQKOTR\s*\d{4}\s*QXZ|ï¿½|â€[™œž“”˜]|ðŸ|Ã[\u0080-\u00BF]|Â[\u0080-\u00BF]/u.test(text)) return true;
  // Legacy Japanese decoding can produce IPA/extended-Latin fragments without
  // U+FFFD. Avoid rejecting legitimate accents, a Greek variable or company name.
  const decodingFragments = (text.match(/[\u0242\u0243\u0250-\u02AFƁƂƃƕ]/gu) || []).length;
  return decodingFragments >= 3 && /[A-Za-z0-9]/u.test(text);
}

export function hasKnownEntityTranslationMismatch(original = "", translated = "") {
  return /科林研[發发]|\bLam\s+Research\b/iu.test(String(original || ""))
    && /\bColin\s*R\s*&\s*D\b|콜린/iu.test(String(translated || ""));
}

export function isLocalizationDisplayTextSafe(value = "") {
  return Boolean(clean(value)) && !hasUntranslatedScript(value) && !hasBrokenLocalizationText(value);
}

export function requiresNewsLocalization(item = {}) {
  if (!item || typeof item !== "object") return false;
  return [item.language, item.streamLanguage, item.sourceLanguage, item.lang]
    .some((language) => LOCALIZATION_LANGUAGE_RE.test(String(language || "").trim()))
    || [item.originalTitle, item.summaryOriginal, item.title, item.headline]
      .some((value) => hasUntranslatedScript(value));
}

function rejectedTranslation(item, field) {
  const audit = item.translation?.[field];
  return item.translationStatus === "unverified"
    || item.translation?.status === "unverified"
    || (field === "summary" && item.summaryLanguage === "source-original")
    || [audit?.status, audit?.languageStatus, audit?.fidelityStatus].includes("unverified")
    || ["translation-pending", "source-original"].includes(audit?.display);
}

function originalEvidence(item) {
  return [item.originalTitle, item.summaryOriginal, item.title, item.headline].filter(Boolean).join(" ");
}

function localizedField(item = {}, field) {
  if (!item || typeof item !== "object") return "";
  const needsKorean = requiresNewsLocalization(item);
  const candidates = field === "title"
    ? [item.titleKo, item.title, item.headline]
    : [item.summaryKo, item.summary];
  const source = originalEvidence(item);
  const acceptable = (value, requireHangul = needsKorean) => {
    const text = clean(value);
    return isLocalizationDisplayTextSafe(text)
      && (!requireHangul || HANGUL_RE.test(text))
      && !hasKnownEntityTranslationMismatch(source, text);
  };
  if (!rejectedTranslation(item, field)) {
    const accepted = candidates.find((value) => acceptable(value));
    if (accepted) return clean(accepted);
  }
  // English originals remain useful if a Korean translation fails. The source
  // may not be used as a back door for Chinese, Japanese or corrupted text.
  if (!needsKorean) {
    const originals = field === "title"
      ? [item.originalTitle, item.title, item.headline]
      : [item.summaryOriginal, item.summary];
    const accepted = originals.find((value) => acceptable(value, false));
    if (accepted) return clean(accepted);
  }
  return "";
}

export function localizedNewsTitle(item = {}) {
  return localizedField(item, "title");
}

export function localizedNewsSummary(item = {}) {
  return localizedField(item, "summary");
}

export function isNewsLocalizationPublishable(item = {}) {
  if (!localizedNewsTitle(item)) return false;
  if (clean(item.quote) && (!isLocalizationDisplayTextSafe(item.quote)
    || hasKnownEntityTranslationMismatch(originalEvidence(item), item.quote))) return false;
  const hasSummary = [item.summaryKo, item.summary, item.summaryOriginal].some((value) => clean(value));
  return !hasSummary || Boolean(localizedNewsSummary(item));
}

function articleLike(value) {
  return Boolean(value && typeof value === "object"
    && (value.url || value.link || value.sourceUrl || value.verification?.canonicalUrl)
    && (value.title || value.titleKo || value.headline || value.originalTitle));
}

// Pure copy: public text is sanitized, while original evidence and source-title
// provenance stay untouched for language detection, attribution and auditing.
export function sanitizeLocalizedPublication(value) {
  const seen = new WeakMap();
  const visit = (current, key = "") => {
    if (PROVENANCE_KEYS.has(key)) return current;
    if (typeof current === "string") {
      return (!key || DISPLAY_KEYS.has(key)) && current.trim() && !isLocalizationDisplayTextSafe(current)
        ? undefined : current;
    }
    if (!current || typeof current !== "object") return current;
    if (seen.has(current)) return seen.get(current);
    if (Array.isArray(current)) {
      const output = [];
      seen.set(current, output);
      for (const entry of current) {
        const next = visit(entry, key);
        if (next != null) output.push(next);
      }
      return output;
    }
    const article = articleLike(current);
    if (article && !isNewsLocalizationPublishable(current)) return null;
    if (!article && (current.url || current.sourceUrl || current.link)
      && (current.kind || current.speaker || current.attributionVersion)
      && clean(current.text || current.statement)
      && !isLocalizationDisplayTextSafe(current.text || current.statement)) return null;
    const input = { ...current };
    if (article) {
      const title = localizedNewsTitle(current);
      const summary = localizedNewsSummary(current);
      if (current.title && title !== current.title && !current.originalTitle) input.originalTitle = current.title;
      if ("title" in current || "titleKo" in current) input.title = title;
      if ("titleKo" in current) input.titleKo = title;
      if ("headline" in current) input.headline = title;
      if (summary) {
        if (current.summary && summary !== current.summary && !current.summaryOriginal) input.summaryOriginal = current.summary;
        input.summary = summary;
        if ("summaryKo" in current) input.summaryKo = summary;
      }
    }
    const output = {};
    seen.set(current, output);
    for (const [childKey, entry] of Object.entries(input)) {
      const next = visit(entry, childKey);
      if (next !== undefined && next !== null) output[childKey] = next;
    }
    return output;
  };
  return visit(value) ?? null;
}
