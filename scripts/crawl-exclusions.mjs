import { createHash } from "node:crypto";

export const CRAWL_EXCLUSION_TYPES = Object.freeze([
  "news",
  "research",
  "community",
  "price",
]);

export function normalizeCrawlExclusionUrl(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    parsed.hash = "";
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
      parsed.searchParams.delete(key);
    }
    return parsed.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return raw.replace(/#.*$/, "").replace(/\/$/, "").toLowerCase();
  }
}

export function normalizeCrawlExclusionText(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

export function crawlModerationKeys(type = "news", item = {}) {
  const prefix = String(type || "news").toLowerCase();
  if (!CRAWL_EXCLUSION_TYPES.includes(prefix)) return [];
  const keys = [];
  const add = (kind, value) => {
    const clean = String(value || "").trim();
    if (clean) keys.push(`${prefix}:${kind}:${clean}`);
  };

  if (prefix === "price") {
    add("history", item.historyKey);
    const signature = [item.sectionTitle || item.group, item.item]
      .map(normalizeCrawlExclusionText)
      .filter(Boolean)
      .join("|");
    add("item", signature);
  } else {
    [item.sourceUrl, item.link, item.url]
      .forEach((value) => add("url", normalizeCrawlExclusionUrl(value)));
    add("id", normalizeCrawlExclusionText(item.id));
    const signature = [item.title || item.titleKo, item.source || item.platform]
      .map(normalizeCrawlExclusionText)
      .filter(Boolean)
      .join("|");
    add("title", signature);
  }
  return Array.from(new Set(keys));
}

export function crawlExclusionRecords(payload = {}) {
  if (Array.isArray(payload)) return payload;
  return Array.isArray(payload?.items) ? payload.items : [];
}

export function crawlExclusionKeySet(payload = {}) {
  return new Set(crawlExclusionRecords(payload).flatMap((record) => {
    if (typeof record === "string") return [record];
    if (Array.isArray(record?.keys)) return record.keys;
    return record?.key ? [record.key] : [];
  }).map((key) => String(key || "").trim()).filter(Boolean));
}

export function isCrawlExcluded(type, item = {}, exclusions = new Set()) {
  const keys = exclusions instanceof Set ? exclusions : crawlExclusionKeySet(exclusions);
  const requestedType = String(type || "").toLowerCase();
  const types = ["news", "research"].includes(requestedType)
    ? ["news", "research"]
    : [requestedType];
  return types.some((candidateType) => crawlModerationKeys(candidateType, item).some((key) => keys.has(key)));
}

const DROP = Symbol("crawl-exclusion-drop");

function matchingTypes(keys) {
  const types = new Set();
  for (const key of keys) {
    const type = String(key || "").split(":", 1)[0];
    if (CRAWL_EXCLUSION_TYPES.includes(type)) types.add(type);
  }
  return [...types];
}

function objectMatchesExclusion(item, contextKey, types, keys) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return false;
  return types.some((type) => {
    const candidate = type === "price" && contextKey && !item.historyKey
      ? { ...item, historyKey: contextKey }
      : item;
    return crawlModerationKeys(type, candidate).some((key) => keys.has(key));
  });
}

/**
 * Removes excluded crawl records from arbitrary generated JSON without
 * manufacturing replacement data. Direct matching array rows/map entries are
 * dropped; parent containers and unrelated evidence are preserved.
 */
export function purgeCrawlExclusions(value, exclusions = new Set()) {
  const keys = exclusions instanceof Set ? exclusions : crawlExclusionKeySet(exclusions);
  const types = matchingTypes(keys);
  const stats = { removed: 0 };

  if (!keys.size || !types.length) return { value, removed: 0 };

  const visit = (current, contextKey = "") => {
    if (Array.isArray(current)) {
      const next = [];
      for (const item of current) {
        const visited = visit(item);
        if (visited === DROP) {
          stats.removed += 1;
          continue;
        }
        next.push(visited);
      }
      return next;
    }
    if (!current || typeof current !== "object") return current;
    if (objectMatchesExclusion(current, contextKey, types, keys)) return DROP;

    const next = {};
    for (const [key, child] of Object.entries(current)) {
      const visited = visit(child, key);
      if (visited === DROP) {
        stats.removed += 1;
        continue;
      }
      next[key] = visited;
    }
    return next;
  };

  const next = visit(value);
  return {
    value: next === DROP ? null : next,
    removed: stats.removed + (next === DROP ? 1 : 0),
  };
}

export function crawlExclusionRecordId(keys = []) {
  return createHash("sha256")
    .update([...new Set(keys)].sort().join("\n"))
    .digest("hex")
    .slice(0, 20);
}
