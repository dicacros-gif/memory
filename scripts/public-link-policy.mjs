import { readFileSync } from "node:fs";

export const PUBLIC_LINK_POLICY = JSON.parse(readFileSync(new URL("../data/public-link-policy.json", import.meta.url), "utf8"));
// Probe attempts and identity keys are audit records, not clickable citations.
export const NON_PUBLIC_LINK_FIELDS = new Set(["industrySourceChecks", "attempts", "evidenceIds", "seenKeys", "blockedUrls"]);
const keyOf = value => {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (/^utm_|^(?:gclid|fbclid|msclkid)$/i.test(key)) url.searchParams.delete(key);
    return url.href.replace(/\/$/, "");
  } catch { return ""; }
};
const corrections = new Map(PUBLIC_LINK_POLICY.corrections.map(rule => [keyOf(rule.from), rule]));
const unavailable = new Set(PUBLIC_LINK_POLICY.unavailable.map(rule => keyOf(rule.url)));
const directFields = ["url", "sourceUrl", "link", "href", "canonicalUrl"];

export function applyPublicLinkPolicy(value) {
  if (Array.isArray(value)) return value.map(applyPublicLinkPolicy).filter(item => item != null);
  if (typeof value === "string" && /^https?:\/\//i.test(value)) {
    const key = keyOf(value);
    return unavailable.has(key) ? null : corrections.get(key)?.to || value;
  }
  if (!value || typeof value !== "object") return value;
  const direct = directFields.map(key => keyOf(value[key])).filter(Boolean);
  // Remove only the unavailable citation leaf, never the surrounding account
  // or a publisher's other articles. The raw verified database is untouched.
  if (direct.some(url => unavailable.has(url))) return null;
  const rule = direct.map(url => corrections.get(url)).find(Boolean);
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (NON_PUBLIC_LINK_FIELDS.has(key)) result[key] = child;
    else if (typeof child === "string" && /^(?:link|href|.*url)$/i.test(key)) {
      result[key] = corrections.get(keyOf(child))?.to || child;
    } else result[key] = applyPublicLinkPolicy(child);
  }
  if (rule?.displayOverrides) {
    for (const [key, text] of Object.entries(rule.displayOverrides)) if (key in result) result[key] = text;
    // A translation verification of the old publisher boilerplate must not
    // be represented as verification of the newly reviewed editorial text.
    if (result.translation) delete result.translation;
  }
  return result;
}

export function classifyLinkResponse({ status, title = "", finalUrl = "", url = "" }) {
  if ([404, 410].includes(status)) return "broken";
  if ([401, 403, 429].includes(status)) return "blocked";
  if (status >= 500) return "server-error";
  if (status < 200 || status >= 400) return "http-review";
  if (/^(?:\s*404\b|\s*not found\b)|page (?:not found|does not exist)|we (?:couldn.t|can.t) find|요청하신 페이지를 찾|페이지를 찾을 수 없/i.test(title)) return "soft-404";
  if (/access denied|just a moment|attention required|robot check|verify you are human/i.test(title)) return "blocked";
  try {
    if (new URL(url).pathname.split("/").filter(Boolean).length >= 2 && new URL(finalUrl).pathname === "/") return "redirect-review";
  } catch { /* Invalid URL is reported by the network probe. */ }
  return "ok";
}
