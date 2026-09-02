/**
 * Evidence-integrity primitives shared by the crawler and its regression
 * tests.  They deliberately prefer an explicit "unverified" state to an
 * attractive but potentially incorrect translated or derived number.
 */

export const PRICE_CHANGE_REVIEW_THRESHOLD_PCT = 400;

const CURRENCY_ALIASES = new Map([
  ["usd", "USD"], ["us$", "USD"], ["$", "USD"], ["dollar", "USD"], ["dollars", "USD"], ["달러", "USD"], ["美元", "USD"],
  ["cny", "CNY"], ["rmb", "CNY"], ["cn¥", "CNY"], ["yuan", "CNY"], ["위안", "CNY"], ["人民币", "CNY"], ["人民幣", "CNY"],
  ["krw", "KRW"], ["₩", "KRW"], ["won", "KRW"], ["원", "KRW"],
  ["eur", "EUR"], ["€", "EUR"], ["euro", "EUR"], ["euros", "EUR"], ["유로", "EUR"], ["欧元", "EUR"], ["歐元", "EUR"],
  ["twd", "TWD"], ["nt$", "TWD"], ["대만달러", "TWD"], ["新台币", "TWD"], ["新台幣", "TWD"], ["新臺幣", "TWD"], ["台幣", "TWD"], ["臺幣", "TWD"],
  ["hkd", "HKD"], ["hk$", "HKD"], ["港元", "HKD"], ["港币", "HKD"], ["港幣", "HKD"], ["홍콩달러", "HKD"],
  ["jpy", "JPY"], ["日元", "JPY"], ["日圆", "JPY"], ["日圓", "JPY"], ["円", "JPY"], ["엔", "JPY"],
]);

// Exponents, not floating-point multipliers: every supported conversion is exact.
const MAGNITUDE_ALIASES = new Map([
  ["trillion", 12], ["billion", 9], ["million", 6], ["thousand", 3],
  ["조", 12], ["천억", 11], ["백억", 10], ["십억", 9], ["억", 8], ["천만", 7], ["백만", 6], ["십만", 5], ["만", 4], ["천", 3], ["백", 2], ["십", 1],
  ["万亿", 12], ["萬億", 12], ["兆", 12], ["亿", 8], ["億", 8], ["千万", 7], ["千萬", 7], ["百万", 6], ["百萬", 6], ["万", 4], ["萬", 4], ["千", 3], ["百", 2], ["十", 1],
]);

function alternatives(values) {
  return [...values].sort((left, right) => right.length - left.length)
    .map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + (/^[a-z]+$/i.test(value) ? "\\b" : ""))
    .join("|");
}

const CURRENCY_PATTERN = alternatives([...CURRENCY_ALIASES.keys(), "元", "¥"]);
const MAGNITUDE_PATTERN = alternatives(MAGNITUDE_ALIASES.keys());
// Capture malformed comma groups as one token so they fail closed, not as two numbers.
const NUMBER_PATTERN = "[+−-]?(?:\\d(?:[\\d,]*\\d)?(?:\\.\\d+)?|\\.\\d+)";
const AMOUNT_PATTERN = `${NUMBER_PATTERN}(?:\\s*(?:${MAGNITUDE_PATTERN}))?(?:\\s*${NUMBER_PATTERN}\\s*(?:${MAGNITUDE_PATTERN}))*`;
const PERCENT_PATTERN = "percentage\\s+points?\\b|percent(?:age)?\\s+points?\\b|퍼센트\\s*포인트|%\\s*p\\b|%포인트|percent\\b|per\\s+cent\\b|퍼센트|%|成";

function decimalParts(raw) {
  const value = String(raw).replace(/−/g, "-").replace(/^([+-]?)\./, (_match, sign) => `${sign}0.`);
  if (value.length > 128 || !/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(value)) return null;
  const [whole, fraction = ""] = value.replace(/,/g, "").split(".");
  return { coefficient: BigInt(`${whole}${fraction}`), scale: fraction.length };
}

function decimalKey({ coefficient, scale }) {
  if (scale < 0) { coefficient *= 10n ** BigInt(-scale); scale = 0; }
  while (scale > 0 && coefficient % 10n === 0n) { coefficient /= 10n; scale -= 1; }
  if (!scale) return String(coefficient);
  const sign = coefficient < 0n ? "-" : "";
  const digits = String(coefficient < 0n ? -coefficient : coefficient).padStart(scale + 1, "0");
  return `${sign}${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}

function parseAmount(text) {
  const parts = [...text.matchAll(new RegExp(`(${NUMBER_PATTERN})\\s*(${MAGNITUDE_PATTERN})?`, "giu"))];
  let total = { coefficient: 0n, scale: 0 };
  let previousExponent = Infinity;
  let cursor = 0;
  for (const [index, match] of parts.entries()) {
    if (text.slice(cursor, match.index).trim()) return null;
    cursor = match.index + match[0].length;
    const decimal = decimalParts(match[1]);
    const exponent = MAGNITUDE_ALIASES.get(String(match[2] || "").toLowerCase()) || 0;
    if (!decimal || (parts.length > 1 && (!match[2] || exponent >= previousExponent || (index > 0 && /^[+−-]/.test(match[1]))))) return null;
    if (index === 0 && decimal.coefficient < 0n) decimal.coefficient *= -1n;
    previousExponent = exponent;
    decimal.scale -= exponent;
    const scale = Math.max(0, total.scale, decimal.scale);
    total = {
      coefficient: total.coefficient * 10n ** BigInt(scale - total.scale) + decimal.coefficient * 10n ** BigInt(scale - decimal.scale),
      scale,
    };
  }
  if (!parts.length || text.slice(cursor).trim()) return null;
  if (/^[−-]/.test(text)) total.coefficient *= -1n;
  return { ...total, exponent: parts.length === 1 ? previousExponent : null, hasMagnitude: parts.some((part) => part[2]) };
}

function numericFacts(text = "") {
  const input = String(text).normalize("NFKC");
  const facts = [];
  const reasons = [];
  const claimed = [];
  const overlaps = (start, end) => claimed.some(([left, right]) => start < right && end > left);
  const context = (start, end, raw) => {
    if (/^\s*[亿億万萬兆京垓秭穰沟溝涧澗载載조억만천백십경]/u.test(input.slice(end))) reasons.push("unsupported-number-unit");
    const prefix = input.slice(0, start).match(new RegExp(`(${CURRENCY_PATTERN})\\s*$`, "iu"))?.[1];
    const suffix = input.slice(end).match(new RegExp(`^\\s*(${CURRENCY_PATTERN})`, "iu"))?.[1];
    const explicit = [prefix, suffix].filter(Boolean).map((value) => CURRENCY_ALIASES.get(value.toLowerCase())).filter(Boolean);
    if (new Set(explicit).size > 1) reasons.push("currency-conflict");
    if (prefix || suffix) {
      // Simplified 亿元/万元 are supported CNY notation. Bare 元/¥ and
      // traditional 億元 remain ambiguous without an explicit currency label.
      const currency = explicit[0] || (suffix === "元" && /[亿万]/u.test(raw) && !prefix ? "CNY" : null);
      if (!currency) reasons.push(`currency-ambiguous:${prefix || suffix}`);
      return { kind: "money", currency: currency || "unknown", exponent: 0 };
    }
    const percent = input.slice(end).match(new RegExp(`^\\s*(${PERCENT_PATTERN})`, "iu"))?.[1];
    if (percent) return { kind: /point|포인트|%\s*p/i.test(percent) ? "percentage-point" : "percent", exponent: percent === "成" ? 1 : 0 };
    return { kind: "number", exponent: 0 };
  };
  const add = (start, end, raw, left, right = null) => {
    if (overlaps(start, end)) return;
    claimed.push([start, end]);
    const unit = context(start, end, raw);
    if (!left || (right === false)) { reasons.push("unsupported-number-format"); return; }
    if (right && !left.hasMagnitude && right.hasMagnitude) {
      // Only a single, explicit trailing scale can be distributed over a range.
      if (right.exponent == null) { reasons.push("unsupported-range-unit"); return; }
      left = { ...left, scale: left.scale - right.exponent };
    }
    const canonical = (amount) => decimalKey({ ...amount, scale: amount.scale - unit.exponent });
    facts.push({ kind: unit.kind, currency: unit.currency, value: right ? `${canonical(left)}..${canonical(right)}` : canonical(left) });
  };

  // Preserve the three date components without interpreting date hyphens as a range.
  for (const match of input.matchAll(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/g)) {
    if (Number(match[2]) < 1 || Number(match[2]) > 12 || Number(match[3]) < 1 || Number(match[3]) > 31) continue;
    claimed.push([match.index, match.index + match[0].length]);
    for (const value of match.slice(1)) facts.push({ kind: "number", value: decimalKey(decimalParts(value)) });
  }
  for (const match of input.matchAll(new RegExp(`(${AMOUNT_PATTERN})\\s*(?:~|～|–|—|-|至|到)\\s*(${AMOUNT_PATTERN})`, "giu"))) {
    add(match.index, match.index + match[0].length, match[0], parseAmount(match[1]), parseAmount(match[2]) || false);
  }
  for (const match of input.matchAll(new RegExp(AMOUNT_PATTERN, "giu"))) {
    add(match.index, match.index + match[0].length, match[0], parseAmount(match[0]));
  }
  const unparsed = claimed.sort((left, right) => right[0] - left[0])
    .reduce((value, [start, end]) => `${value.slice(0, start)}${" ".repeat(end - start)}${value.slice(end)}`, input);
  if (/[零〇一二三四五六七八九两兩十百]+\s*[千万萬億亿兆成]/u.test(unparsed)) reasons.push("unsupported-written-number");
  return { facts, reasons };
}

/**
 * Compare the numerical facts carried by a source string and its translated
 * counterpart. Supported English/Chinese/Korean scales are compared with exact
 * decimal arithmetic; unmatched/extra numbers and ambiguous notation fail closed.
 * This is a numerical gate, not a proof of the surrounding prose's meaning.
 */
export function auditTranslationFidelity(original = "", translated = "") {
  const source = String(original || "").trim();
  const target = String(translated || "").trim();
  if (!source || !target) {
    return { status: "unverified", tokenMatchPct: 0, checkedTokens: 0, matchedTokens: 0, reasons: ["missing-text"] };
  }
  const sourceFacts = numericFacts(source);
  const targetFacts = numericFacts(target);
  const remaining = [...targetFacts.facts];
  const reasons = [...sourceFacts.reasons.map((reason) => `source-${reason}`), ...targetFacts.reasons.map((reason) => `target-${reason}`)];
  let matchedTokens = 0;
  for (const fact of sourceFacts.facts) {
    const index = remaining.findIndex((candidate) => candidate.kind === fact.kind && candidate.currency === fact.currency && candidate.value === fact.value);
    if (index >= 0) {
      matchedTokens += 1;
      remaining.splice(index, 1);
    } else if (fact.kind === "money") {
      const money = remaining.filter((candidate) => candidate.kind === "money");
      const reason = money.some((candidate) => candidate.currency === fact.currency) ? "amount-mismatch" : money.length ? "currency-mismatch" : "currency-missing";
      reasons.push(`${reason}:${fact.currency}`);
    } else {
      reasons.push(`number-mismatch:${fact.value}`);
    }
  }
  for (const fact of remaining) reasons.push(fact.kind === "money" ? `amount-added:${fact.currency}:${fact.value}` : `number-added:${fact.value}`);
  const checkedTokens = sourceFacts.facts.length + remaining.length;
  const tokenMatchPct = checkedTokens ? Number(((matchedTokens / checkedTokens) * 100).toFixed(1)) : reasons.length ? 0 : 100;
  return {
    status: reasons.length ? "unverified" : "verified",
    tokenMatchPct,
    checkedTokens,
    matchedTokens,
    reasons: [...new Set(reasons)],
  };
}

/**
 * Keep a raw price move for auditability, while preventing a poorly-covered
 * or extreme span from being promoted as a decision-grade change.
 */
export function assessPriceChange({
  periodChangePct = null,
  observedPoints = 0,
  firstObservedAt = null,
  lastObservedAt = null,
  thresholdPct = PRICE_CHANGE_REVIEW_THRESHOLD_PCT,
} = {}) {
  const raw = Number(periodChangePct);
  const firstAt = Date.parse(String(firstObservedAt || ""));
  const lastAt = Date.parse(String(lastObservedAt || ""));
  const spanDays = Number.isFinite(firstAt) && Number.isFinite(lastAt) && lastAt >= firstAt
    ? Number(((lastAt - firstAt) / 86400000).toFixed(1))
    : null;
  const reasons = [];
  if (!Number.isFinite(raw)) reasons.push("missing-change");
  if (Number(observedPoints) < 2) reasons.push("insufficient-observations");
  if (spanDays != null && spanDays < 7) reasons.push("short-observation-window");
  if (Number.isFinite(raw) && Math.abs(raw) > Math.abs(Number(thresholdPct))) reasons.push("change-outlier");
  const status = reasons.length ? "review-required" : "verified";
  return {
    status,
    rawPeriodChangePct: Number.isFinite(raw) ? Number(raw.toFixed(2)) : null,
    displayPeriodChangePct: status === "verified" ? Number(raw.toFixed(2)) : null,
    observedPoints: Number(observedPoints) || 0,
    spanDays,
    thresholdPct: Number(thresholdPct),
    reasons,
  };
}

/** A reported article must never be described as a first-party fact. */
export function evidenceClaimLabel({ evidenceLevel = "", sourceClass = "", observedThisRun = false } = {}) {
  const level = String(evidenceLevel || "");
  if (level === "Confirmed" && String(sourceClass) === "official" && observedThisRun) return "사실(1차 확인)";
  if (level === "Reported") return "보도됨(1차 미확인)";
  if (level === "Inferred") return "분석·추론";
  return "검증 대기";
}

/**
 * Prevent a now-obsolete headline amount from being promoted after a primary
 * source publishes the final version of the same transaction.  This is
 * intentionally narrow: it only covers the documented CXMT IPO figure and
 * leaves the earlier CNY 29.5B registration-stage plan available as context.
 */
export function supersededNumericClaimReason(item = {}) {
  const text = `${item.title || ""} ${item.originalTitle || ""} ${item.summaryOriginal || item.summary || ""}`.toLowerCase();
  const cxmtOffering = /(?:cxmt|changxin|长鑫)/i.test(text)
    && /(?:ipo|offering|offered|raise|funding|public offering|공모|상장|募资|发行)/i.test(text);
  if (cxmtOffering && /(?:us\$\s*4[.,]?3\s*(?:b|bn|billion)|\$\s*4[.,]?3\s*(?:b|bn|billion)|4[.,]?3\s*(?:b|bn|billion)\s*(?:ipo|offering|raise|funding))/i.test(text)) {
    return "superseded_by_sse_final_offering";
  }
  return null;
}
