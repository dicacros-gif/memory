/**
 * Evidence-integrity primitives shared by the crawler and its regression
 * tests.  They deliberately prefer an explicit "unverified" state to an
 * attractive but potentially incorrect translated or derived number.
 */

export const PRICE_CHANGE_REVIEW_THRESHOLD_PCT = 400;

const CURRENCY_ALIASES = new Map([
  ["usd", "USD"], ["us$", "USD"], ["$", "USD"], ["dollar", "USD"], ["dollars", "USD"], ["달러", "USD"], ["美元", "USD"],
  ["cny", "CNY"], ["rmb", "CNY"], ["cn¥", "CNY"], ["yuan", "CNY"], ["위안", "CNY"], ["人民币", "CNY"], ["元", "CNY"],
  ["krw", "KRW"], ["₩", "KRW"], ["won", "KRW"], ["원", "KRW"],
  ["eur", "EUR"], ["€", "EUR"], ["euro", "EUR"], ["유로", "EUR"],
  ["twd", "TWD"], ["nt$", "TWD"], ["대만달러", "TWD"],
]);

const MAGNITUDE_ALIASES = new Map([
  ["trillion", 1e12], ["billion", 1e9], ["million", 1e6], ["thousand", 1e3],
  ["조", 1e12], ["억", 1e8], ["만", 1e4],
]);

const CURRENCY_PATTERN = "US\\$|USD|CNY|RMB|CN¥|NT\\$|KRW|EUR|TWD|₩|€|\\$|dollars?|달러|美元|yuan|위안|人民币|元|won|원|euro|유로|대만달러";
const MAGNITUDE_PATTERN = "trillion|billion|million|thousand|조|억|만";
const NUMBER_PATTERN = "\\d+(?:[,.]\\d+)?";

function numberValue(value) {
  const parsed = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizedCurrency(value) {
  return CURRENCY_ALIASES.get(String(value || "").trim().toLowerCase()) || null;
}

function magnitudeMultiplier(value) {
  return MAGNITUDE_ALIASES.get(String(value || "").trim().toLowerCase()) || 1;
}

function closeAmount(left, right) {
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  const denominator = Math.max(1, Math.abs(left), Math.abs(right));
  return Math.abs(left - right) / denominator <= 0.015;
}

function moneyMatches(text = "") {
  const input = String(text || "");
  const matches = [];
  const claimedRanges = [];
  const add = (match, currency, amount, magnitude) => {
    const normalized = normalizedCurrency(currency);
    const value = numberValue(amount);
    if (!normalized || !Number.isFinite(value)) return;
    matches.push({ currency: normalized, amount: value * magnitudeMultiplier(magnitude) });
    claimedRanges.push([match.index, match.index + match[0].length]);
  };
  const prefix = new RegExp(`(${CURRENCY_PATTERN})\\s*(${NUMBER_PATTERN})\\s*(${MAGNITUDE_PATTERN})?`, "giu");
  const suffix = new RegExp(`(${NUMBER_PATTERN})\\s*(${MAGNITUDE_PATTERN})?\\s*(${CURRENCY_PATTERN})`, "giu");
  let match;
  while ((match = prefix.exec(input))) add(match, match[1], match[2], match[3]);
  while ((match = suffix.exec(input))) add(match, match[3], match[1], match[2]);

  const masked = claimedRanges
    .sort((a, b) => b[0] - a[0])
    .reduce((value, [start, end]) => `${value.slice(0, start)} ${value.slice(end)}`, input);
  return { amounts: matches, masked };
}

function numericTokens(text = "") {
  return (String(text || "").match(new RegExp(NUMBER_PATTERN, "g")) || [])
    .map((value) => String(value).replace(/,/g, ""));
}

/**
 * Compare the numerical facts carried by a source string and its translated
 * counterpart.  It validates monetary amounts after normalising English/Korean
 * magnitude units (for example CNY 29.5 billion == 295억 위안).
 */
export function auditTranslationFidelity(original = "", translated = "") {
  const source = String(original || "").trim();
  const target = String(translated || "").trim();
  if (!source || !target) {
    return { status: "unverified", tokenMatchPct: 0, checkedTokens: 0, matchedTokens: 0, reasons: ["missing-text"] };
  }
  const sourceMoney = moneyMatches(source);
  const targetMoney = moneyMatches(target);
  const sourceNumbers = numericTokens(sourceMoney.masked);
  const targetNumbers = numericTokens(targetMoney.masked);
  const reasons = [];
  let checkedTokens = 0;
  let matchedTokens = 0;

  for (const amount of sourceMoney.amounts) {
    checkedTokens += 1;
    const sameCurrency = targetMoney.amounts.filter((candidate) => candidate.currency === amount.currency);
    if (sameCurrency.some((candidate) => closeAmount(candidate.amount, amount.amount))) {
      matchedTokens += 1;
    } else if (sameCurrency.length) {
      reasons.push(`amount-mismatch:${amount.currency}`);
    } else if (targetMoney.amounts.length) {
      reasons.push(`currency-mismatch:${amount.currency}`);
    } else {
      reasons.push(`currency-missing:${amount.currency}`);
    }
  }

  for (const value of sourceNumbers) {
    checkedTokens += 1;
    if (targetNumbers.includes(value)) matchedTokens += 1;
    else reasons.push(`number-mismatch:${value}`);
  }

  const tokenMatchPct = checkedTokens ? Number(((matchedTokens / checkedTokens) * 100).toFixed(1)) : 100;
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
