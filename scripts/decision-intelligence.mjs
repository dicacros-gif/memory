import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const INTELLIGENCE_POLICY_PATH = resolve(root, "data", "intelligence-policy.json");

const hash = (value = "") => createHash("sha256").update(String(value)).digest("hex").slice(0, 20);
const compact = (value = "", max = 12000) => String(value || "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
const sourceRank = { official: 3, research: 2, "authoritative-media": 1 };

function compile(pattern = "") {
  try { return new RegExp(String(pattern), "i"); } catch { return /$a/; }
}

function matchesAll(value = "", patterns = []) {
  return (patterns || []).every((pattern) => compile(pattern).test(value));
}

function matchesAny(value = "", patterns = []) {
  return (patterns || []).some((pattern) => compile(pattern).test(value));
}

function validUrl(value = "") {
  try { return new URL(String(value)).protocol === "https:"; } catch { return false; }
}

function canonicalUrl(value = "") {
  try {
    const url = new URL(String(value));
    url.hash = "";
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) url.searchParams.delete(key);
    return url.toString().replace(/\/$/, "");
  } catch { return ""; }
}

export function htmlToDecisionText(html = "") {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(?:br|hr)\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:p|li|tr|h[1-6]|section|article|div)>/gi, "\n")
    .replace(/<\/(?:td|th)>/gi, " | ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, value) => String.fromCodePoint(Number.parseInt(value, 16)))
    .replace(/&#(\d+);/g, (_, value) => String.fromCodePoint(Number(value)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]*\|[ \t]*/g, " | ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function validateIntelligencePolicy(policy = {}) {
  const errors = [];
  if (policy.schemaVersion !== "1.0") errors.push("schemaVersion");
  if (!Array.isArray(policy.directFeeds) || policy.directFeeds.length < 4) errors.push("directFeeds");
  if (!Array.isArray(policy.metrics) || policy.metrics.length < 2) errors.push("metrics");
  if (!Array.isArray(policy.eventRules) || policy.eventRules.length < 3) errors.push("eventRules");
  if (!Array.isArray(policy.claimEvents?.stages) || policy.claimEvents.stages.length < 5) errors.push("claimEvents.stages");
  if (!Array.isArray(policy.claimEvents?.eligibleSourceClasses) || !policy.claimEvents.eligibleSourceClasses.includes("official")) errors.push("claimEvents.eligibleSourceClasses");
  if (!Array.isArray(policy.decisionAutomation?.briefs) || policy.decisionAutomation.briefs.length < 3) errors.push("decisionAutomation.briefs");
  if (!Array.isArray(policy.decisionAutomation?.states) || !policy.decisionAutomation.states.includes("DECISION_READY")) errors.push("decisionAutomation.states");
  const meceAxes = policy.decisionAutomation?.meceAxes || [];
  const briefs = policy.decisionAutomation?.briefs || [];
  const axisIds = new Set(meceAxes.map((axis) => axis.id).filter(Boolean));
  if (meceAxes.length !== 4 || axisIds.size !== 4 || !meceAxes.every((axis) => axis.label && axis.owns && axis.excludes)) errors.push("decisionAutomation.meceAxes");
  if (new Set(briefs.map((brief) => brief.meceAxis)).size !== briefs.length || !briefs.every((brief) => axisIds.has(brief.meceAxis))) errors.push("decisionAutomation.briefs.meceAxis");
  if (new Set(briefs.map((brief) => compact(brief.decisionQuestion).toLowerCase())).size !== briefs.length || !briefs.every((brief) => brief.decisionQuestion && brief.decisionStage && brief.deliverable)) errors.push("decisionAutomation.briefs.decisionContract");
  if (!Array.isArray(policy.retrieval?.tracks) || policy.retrieval.tracks.length < 3) errors.push("retrieval.tracks");
  if (policy.retrieval?.onlyChangedDocuments !== true) errors.push("retrieval.onlyChangedDocuments");
  if (policy.evaluation?.failClosed !== true) errors.push("evaluation.failClosed");
  const freshness = policy.freshnessScoring || {};
  const weights = freshness.weights || {};
  const weightTotal = ["contentAge", "embeddingLag", "staleRetrievalRate", "coverageDrift"]
    .reduce((sum, key) => sum + Number(weights[key] || 0), 0);
  if (Math.abs(weightTotal - 1) > 0.0001) errors.push("freshnessScoring.weights");
  if (Number(freshness.thresholds?.current) !== 85 || Number(freshness.thresholds?.warning) !== 70) errors.push("freshnessScoring.thresholds");
  if (!policy.refreshOrchestration?.latencyTargets || Number(policy.refreshOrchestration?.safetyPollHours) !== 1) errors.push("refreshOrchestration");
  const ids = new Set();
  for (const feed of policy.directFeeds || []) {
    if (!feed.id || ids.has(`feed:${feed.id}`)) errors.push(`feed:${feed.id || "missing"}`);
    ids.add(`feed:${feed.id}`);
    if (!feed.sourceId || !validUrl(feed.url)) errors.push(`feed:${feed.id}:source`);
  }
  for (const metric of policy.metrics || []) {
    if (!metric.id || ids.has(`metric:${metric.id}`)) errors.push(`metric:${metric.id || "missing"}`);
    ids.add(`metric:${metric.id}`);
    if (!metric.dimension || metric.unit !== "%" || !Array.isArray(metric.entities)) errors.push(`metric:${metric.id}:shape`);
    if (metric.periodGranularity && !["quarter", "year", "any"].includes(metric.periodGranularity)) errors.push(`metric:${metric.id}:periodGranularity`);
  }
  return { ok: errors.length === 0, errors };
}

export function loadIntelligencePolicy(path = INTELLIGENCE_POLICY_PATH) {
  const policy = JSON.parse(readFileSync(path, "utf8"));
  const validation = validateIntelligencePolicy(policy);
  if (!validation.ok) throw new Error(`intelligence policy validation failed: ${validation.errors.join(", ")}`);
  return Object.freeze(policy);
}

export function canonicalPeriod(value = "") {
  const text = String(value || "");
  const qFirst = text.match(/\bQ([1-4])\s*[-/]?\s*(20\d{2})\b/i);
  if (qFirst) return `${qFirst[2]}-Q${qFirst[1]}`;
  const yearFirst = text.match(/(20\d{2})\s*(?:년)?\s*[-/]?\s*(?:Q([1-4])|([1-4])\s*분기)/i);
  if (yearFirst) return `${yearFirst[1]}-Q${yearFirst[2] || yearFirst[3]}`;
  const year = text.match(/\b(20\d{2})\b/);
  return year ? year[1] : "";
}

function periodTokens(value = "", { quarterOnly = false } = {}) {
  const tokens = [];
  const re = /(?:\bQ[1-4]\s*[-/]?\s*20\d{2}\b|20\d{2}\s*(?:년)?\s*[-/]?\s*(?:Q[1-4]\b|[1-4]\s*분기)|\b20\d{2}\b)/gi;
  for (const match of String(value || "").matchAll(re)) {
    const period = canonicalPeriod(match[0]);
    if (!period || (quarterOnly && !/-Q[1-4]$/.test(period)) || tokens.includes(period)) continue;
    tokens.push(period);
  }
  return tokens;
}

function percentValues(value = "") {
  return [...String(value || "").matchAll(/(?<![\d.])(-?\d{1,3}(?:\.\d+)?)\s*%/g)]
    .map((match) => Number(match[1]))
    .filter((number) => Number.isFinite(number) && number >= 0 && number <= 100);
}

function metricPeriodAllowed(metric = {}, period = "") {
  if (metric.periodGranularity === "quarter") return /^20\d{2}-Q[1-4]$/.test(String(period));
  if (metric.periodGranularity === "year") return /^20\d{2}$/.test(String(period));
  return /^(?:20\d{2}|20\d{2}-Q[1-4])$/.test(String(period));
}

function sectionText(text = "", anchors = []) {
  const lower = text.toLowerCase();
  const starts = anchors.map((anchor) => lower.indexOf(String(anchor).toLowerCase())).filter((index) => index >= 0);
  if (!starts.length) return text;
  const start = Math.max(0, Math.min(...starts) - 400);
  return text.slice(start, start + 16000);
}

// A research house lends authority, so its name may only be the byline on its
// own publication. Elsewhere the article merely cites it — the URL's publisher
// is who published the claim. The crawler holds the same domain list in
// BROKER_OFFICIAL_DOMAINS; this is the boundary that enforces it.
const RESEARCH_HOUSE_DOMAINS = {
  "morgan-stanley": ["morganstanley.com"],
  "goldman-sachs": ["goldmansachs.com"],
  jpmorgan: ["jpmorgan.com"],
  ubs: ["ubs.com"],
  citi: ["citigroup.com", "citi.com"],
  bofa: ["bofa.com", "bankofamerica.com"],
  jefferies: ["jefferies.com"],
  barclays: ["barclays.com"],
  nomura: ["nomura.com"],
  mizuho: ["mizuho.com"],
  hsbc: ["hsbc.com"],
};

const publisherFromUrl = (value) => {
  try {
    const host = new URL(String(value)).hostname.toLowerCase().replace(/^www\./, "");
    const bare = host.split(".").filter((part) => !["com", "co", "kr", "net", "org", "news", "tw"].includes(part)).pop() || host;
    return bare.charAt(0).toUpperCase() + bare.slice(1);
  } catch {
    return "";
  }
};

export function attributedSource(document = {}, url = "") {
  const id = String(document.sourceId || "");
  const domains = RESEARCH_HOUSE_DOMAINS[id];
  if (!domains) return { sourceId: document.sourceId, source: document.source, citedInstitution: "" };
  let host = "";
  try { host = new URL(String(url || document.url || "")).hostname.toLowerCase().replace(/^www\./, ""); } catch { host = ""; }
  const own = host && domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  if (!host || own) return { sourceId: document.sourceId, source: document.source, citedInstitution: "" };
  const publisher = publisherFromUrl(url || document.url);
  return {
    sourceId: host,
    source: publisher || host,
    citedInstitution: document.source || "",
  };
}
function observation({ metric, entity, period, value, document, feed }) {
  const sourceUrl = canonicalUrl(document.url || feed.url);
  const key = `${metric.id}|${entity.id}|${period}|${document.sourceId}|${sourceUrl}`;
  return {
    id: hash(key),
    metricId: metric.id,
    metricLabel: metric.label,
    dimension: metric.dimension,
    entityId: entity.id,
    company: entity.company,
    period,
    value: Number(value),
    unit: metric.unit,
    ...(() => {
      const attributed = attributedSource(document, sourceUrl);
      return { sourceId: attributed.sourceId, source: attributed.source, citedInstitution: attributed.citedInstitution };
    })(),
    sourceClass: document.sourceClass,
    sourceUrl,
    publishedAt: document.publishedAt || null,
    observedAt: document.observedAt || null,
    feedId: feed.id || null,
    observedThisRun: true,
  };
}

function extractMetricTable(document, feed, metric) {
  const documentText = String(document.text || "");
  const lines = documentText.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const anchors = (feed.sectionAnchors || []).map((anchor) => compile(anchor));
  const anchorIndexes = lines
    .map((line, index) => anchors.some((anchor) => anchor.test(line)) && !matchesAny(line, feed.sectionExcludePatterns) ? index : -1)
    .filter((index) => index >= 0);
  const candidates = [];
  const tableCandidate = (observations, terminalPeriod) => {
    const latest = observations.filter((item) => item.period === terminalPeriod);
    const entityCount = new Set(latest.map((item) => item.entityId)).size;
    const latestTotal = latest.reduce((sum, item) => sum + Number(item.value || 0), 0);
    return {
      observations,
      terminalPeriod,
      entityCount,
      compositionGap: entityCount === (metric.entities || []).length ? Math.abs(100 - latestTotal) : 999,
    };
  };

  // Crawled publisher pages are sometimes flattened into one pipe-delimited
  // line. Parse the table cells directly so navigation text or a preceding
  // DRAM table cannot shift the vendor/value alignment.
  for (const anchorText of feed.sectionAnchors || []) {
    const lower = documentText.toLowerCase();
    const needle = String(anchorText).toLowerCase();
    let from = 0;
    while (needle && from < lower.length) {
      const anchorIndex = lower.indexOf(needle, from);
      if (anchorIndex < 0) break;
      from = anchorIndex + needle.length;
      const scoped = documentText.slice(from, from + 5000);
      const cells = scoped.split("|").map((cell) => cell.replace(/\s+/g, " ").trim()).filter(Boolean);
      let headerIndex = -1;
      let periods = [];
      for (let index = 0; index < Math.min(cells.length, 40); index += 1) {
        const run = [];
        for (let cursor = index; cursor < Math.min(cells.length, index + 8); cursor += 1) {
          const quarterTokens = periodTokens(cells[cursor], { quarterOnly: true });
          const period = quarterTokens[0];
          if (quarterTokens.length !== 1 || cells[cursor].length > 18 || /[–—]/.test(cells[cursor]) || !/^20\d{2}-Q[1-4]$/.test(period)) break;
          run.push(period);
        }
        if (run.length >= 2) {
          headerIndex = index;
          periods = run;
          break;
        }
      }
      if (headerIndex < 0) continue;
      const block = cells.slice(headerIndex + periods.length, headerIndex + periods.length + 36);
      const observations = [];
      for (const entity of metric.entities || []) {
        const entityPattern = new RegExp(`^(?:${entity.aliases.map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})$`, "i");
        const entityIndex = block.findIndex((cell) => entityPattern.test(cell));
        if (entityIndex < 0) continue;
        const values = block.slice(entityIndex + 1, entityIndex + 1 + periods.length).map((cell) => percentValues(cell)[0]);
        if (values.length !== periods.length || values.some((value) => !Number.isFinite(value))) continue;
        periods.forEach((period, valueIndex) => observations.push(observation({ metric, entity, period, value: values[valueIndex], document, feed })));
      }
      if (observations.length) candidates.push(tableCandidate(observations, periods.at(-1)));
    }
  }

  // A publisher page may contain DRAM and HBM tables with identical vendor
  // rows. Only inspect a table immediately following the requested section
  // anchor, then select the candidate with the newest terminal period.
  for (const anchorIndex of anchorIndexes) {
    const headerCandidates = lines.slice(anchorIndex + 1, anchorIndex + 38)
      .map((line, offset) => ({ offset, periods: periodTokens(line, { quarterOnly: true }) }))
      .filter((candidate) => candidate.periods.length >= 2)
      .sort((left, right) => right.periods.length - left.periods.length || left.offset - right.offset);
    if (!headerCandidates.length) continue;
    const absoluteHeaderIndex = anchorIndex + 1 + headerCandidates[0].offset;
    const periods = periodTokens(lines[absoluteHeaderIndex], { quarterOnly: true });
    const block = lines.slice(absoluteHeaderIndex + 1, absoluteHeaderIndex + 12);
    const observations = [];
    for (const entity of metric.entities || []) {
      const entityPattern = new RegExp(entity.aliases.map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i");
      const row = block.find((line) => entityPattern.test(line) && percentValues(line).length >= periods.length);
      if (!row || matchesAny(row, metric.excludePatterns)) continue;
      const values = percentValues(row).slice(-periods.length);
      periods.forEach((period, valueIndex) => observations.push(observation({ metric, entity, period, value: values[valueIndex], document, feed })));
    }
    if (observations.length) candidates.push(tableCandidate(observations, periods.at(-1)));
  }
  candidates.sort((left, right) => periodOrder(right.terminalPeriod) - periodOrder(left.terminalPeriod)
    || right.entityCount - left.entityCount
    || left.compositionGap - right.compositionGap);
  return candidates[0]?.observations || [];
}

function extractParallelSeries(document, feed, metric) {
  const scoped = sectionText(document.text, feed.sectionAnchors);
  const lines = scoped.split(/\n+|(?<=[.!?])\s+/).map((line) => line.trim()).filter(Boolean);
  const output = [];
  const entity = metric.entities?.[0];
  if (!entity) return output;
  for (const line of lines) {
    if (!matchesAll(line, metric.requiredPatterns) || matchesAny(line, metric.excludePatterns)) continue;
    const values = percentValues(line);
    const periods = periodTokens(line).filter((period) => /^20\d{2}$/.test(period));
    if (values.length < 2 || periods.length < 2) continue;
    const pairCount = Math.min(values.length, periods.length);
    const pairedValues = values.slice(-pairCount);
    const pairedPeriods = periods.slice(-pairCount);
    pairedPeriods.forEach((period, index) => output.push(observation({ metric, entity, period, value: pairedValues[index], document, feed })));
    break;
  }
  return output;
}

function extractNarrativeMetrics(document, policy) {
  const output = [];
  const lines = String(document.text || "").split(/\n+|(?<=[.!?])\s+/).map((line) => line.trim()).filter(Boolean);
  for (const metric of policy.metrics || []) {
    for (const line of lines) {
      if (!matchesAll(line, metric.requiredPatterns) || matchesAny(line, metric.excludePatterns)) continue;
      const values = percentValues(line);
      if (!values.length) continue;
      for (const entity of metric.entities || []) {
        if (!entity.aliases.some((alias) => line.toLowerCase().includes(alias.toLowerCase()))) continue;
        const aliasIndex = Math.max(...entity.aliases.map((alias) => line.toLowerCase().indexOf(alias.toLowerCase())));
        const near = line.slice(Math.max(0, aliasIndex - 80), aliasIndex + 260);
        const nearValues = percentValues(near);
        const value = nearValues[0] ?? values[0];
        const period = canonicalPeriod(line) || canonicalPeriod(document.publishedAt);
        if (metricPeriodAllowed(metric, period)) output.push(observation({ metric, entity, period, value, document, feed: { id: document.feedId || "narrative" } }));
      }
    }
  }
  return output;
}

export function extractMetricObservations(documents = [], policy = loadIntelligencePolicy()) {
  const feeds = new Map((policy.directFeeds || []).map((feed) => [feed.id, feed]));
  const metrics = new Map((policy.metrics || []).map((metric) => [metric.id, metric]));
  const output = [];
  for (const document of documents) {
    const feed = feeds.get(document.feedId);
    if (feed?.metricId && metrics.has(feed.metricId)) {
      const metric = metrics.get(feed.metricId);
      if (feed.kind === "metric-table") output.push(...extractMetricTable(document, feed, metric));
      if (feed.kind === "parallel-series") output.push(...extractParallelSeries(document, feed, metric));
    }
    // A direct metric feed has a publisher-specific parser and denominator.
    // Re-running generic narrative extraction over that page can confuse a
    // nearby DRAM or margin percentage for the HBM metric.
    if (feed || ["official", "research"].includes(document.sourceClass)) {
      const narrative = extractNarrativeMetrics(document, policy)
        .filter((item) => item.metricId !== feed?.metricId);
      output.push(...narrative);
    }
  }
  const byKey = new Map();
  for (const item of output) byKey.set(`${item.metricId}|${item.entityId}|${item.period}|${item.sourceId}`, item);
  return [...byKey.values()];
}

function periodOrder(value = "") {
  const match = String(value).match(/^(20\d{2})(?:-Q([1-4]))?$/);
  return match ? Number(match[1]) * 10 + Number(match[2] || 4) : 0;
}

function displayRange(min, max, unit = "%") {
  const clean = (value) => Number.isInteger(value) ? String(value) : Number(value).toFixed(1).replace(/\.0$/, "");
  return min === max ? `${clean(min)}${unit}` : `${clean(min)}–${clean(max)}${unit}`;
}

export function buildMetricConsensus({ current = [], previous = {}, policy = loadIntelligencePolicy(), now = new Date() } = {}) {
  const metricMap = new Map((policy.metrics || []).map((metric) => [metric.id, metric]));
  const merged = new Map();
  for (const item of previous.observations || []) {
    const metric = metricMap.get(item.metricId);
    if (!metric || !metricPeriodAllowed(metric, item.period)) continue;
    const age = Date.parse(item.publishedAt || item.observedAt || "");
    const retentionDays = Number(metric?.freshnessDays || policy.scope?.retentionDays || 540) * 2;
    if (Number.isFinite(age) && now.getTime() - age > retentionDays * 864e5) continue;
    merged.set(`${item.metricId}|${item.entityId}|${item.period}|${item.sourceId}`, { ...item, observedThisRun: false });
  }
  for (const item of current) {
    const metric = metricMap.get(item.metricId);
    if (!metric || !metricPeriodAllowed(metric, item.period)) continue;
    merged.set(`${item.metricId}|${item.entityId}|${item.period}|${item.sourceId}`, { ...item, observedThisRun: true });
  }

  const groups = new Map();
  for (const item of merged.values()) {
    const key = `${item.metricId}|${item.entityId}|${item.period}|${item.dimension}`;
    const group = groups.get(key) || [];
    group.push(item);
    groups.set(key, group);
  }
  const series = [...groups.values()].map((items) => {
    const values = items.map((item) => Number(item.value)).filter(Number.isFinite).sort((a, b) => a - b);
    const sources = [...new Map(items.map((item) => [item.sourceId, {
      id: item.sourceId,
      name: item.source,
      sourceClass: item.sourceClass,
      url: item.sourceUrl,
      publishedAt: item.publishedAt,
      value: item.value,
    }])).values()].sort((a, b) => (sourceRank[b.sourceClass] || 0) - (sourceRank[a.sourceClass] || 0));
    const min = values[0];
    const max = values.at(-1);
    const difference = max - min;
    const tolerance = Number(policy.consensus?.differenceTolerancePctPoint || 0.5);
    return {
      metricId: items[0].metricId,
      metricLabel: items[0].metricLabel,
      dimension: items[0].dimension,
      entityId: items[0].entityId,
      company: items[0].company,
      period: items[0].period,
      unit: items[0].unit,
      min,
      max,
      midpoint: Number(((min + max) / 2).toFixed(2)),
      display: displayRange(min, max, items[0].unit),
      representation: difference > tolerance ? "range" : "point",
      sourceCount: sources.length,
      confidence: sources.length >= Number(policy.consensus?.minimumIndependentSourcesForHighConfidence || 2) ? "high" : "single-source",
      sources,
      observedThisRun: items.some((item) => item.observedThisRun),
    };
  }).sort((left, right) => periodOrder(left.period) - periodOrder(right.period));

  const latest = [];
  const entityGroups = new Map();
  for (const item of series) {
    const key = `${item.metricId}|${item.entityId}`;
    const rows = entityGroups.get(key) || [];
    rows.push(item);
    entityGroups.set(key, rows);
  }
  for (const rows of entityGroups.values()) {
    const currentRow = rows.at(-1);
    const previousRow = rows.at(-2);
    const currentPeriodMatch = String(currentRow.period).match(/^(20\d{2})(?:-Q([1-4]))?$/);
    const yearAgoPeriod = currentPeriodMatch
      ? `${Number(currentPeriodMatch[1]) - 1}${currentPeriodMatch[2] ? `-Q${currentPeriodMatch[2]}` : ""}`
      : null;
    const yearAgoRow = rows.find((item) => item.period === yearAgoPeriod) || null;
    latest.push({
      ...currentRow,
      priorPeriod: previousRow?.period || null,
      priorMidpoint: previousRow?.midpoint ?? null,
      changePctPoint: previousRow ? Number((currentRow.midpoint - previousRow.midpoint).toFixed(2)) : null,
      direction: previousRow ? currentRow.midpoint > previousRow.midpoint ? "up" : currentRow.midpoint < previousRow.midpoint ? "down" : "flat" : "new",
      yearAgoPeriod: yearAgoRow?.period || null,
      yearAgoMidpoint: yearAgoRow?.midpoint ?? null,
      yearAgoChangePctPoint: yearAgoRow ? Number((currentRow.midpoint - yearAgoRow.midpoint).toFixed(2)) : null,
    });
  }
  return {
    method: policy.consensus?.method,
    observations: [...merged.values()],
    series,
    latest,
    conflictCount: series.filter((item) => item.representation === "range").length,
  };
}

function chunkText(value = "", size = 900, overlap = 120, limit = 14) {
  const text = compact(value, size * limit * 2);
  if (!text) return [];
  const chunks = [];
  let offset = 0;
  while (offset < text.length && chunks.length < limit) {
    let end = Math.min(text.length, offset + size);
    if (end < text.length) {
      const breakAt = Math.max(text.lastIndexOf(". ", end), text.lastIndexOf("\n", end));
      if (breakAt > offset + size * 0.55) end = breakAt + 1;
    }
    const body = text.slice(offset, end).trim();
    if (body) chunks.push({ id: hash(`${offset}:${body}`), text: body });
    if (end >= text.length) break;
    offset = Math.max(offset + 1, end - overlap);
  }
  return chunks;
}

export function buildIncrementalKnowledgeIndex({ documents = [], previous = {}, policy = loadIntelligencePolicy(), now = new Date() } = {}) {
  const allowed = new Set(policy.retrieval?.allowedSourceClasses || []);
  const configuredFeedIds = new Set((policy.directFeeds || []).map((feed) => feed.id));
  const previousMap = new Map((previous.documents || []).map((document) => [document.id, document]));
  const currentIds = new Set();
  const next = [];
  let added = 0;
  let changed = 0;
  let unchanged = 0;
  for (const raw of documents.slice(0, Number(policy.scope?.maxDocuments || 240))) {
    if (raw.feedId && raw.feedId !== "narrative" && !configuredFeedIds.has(raw.feedId)) continue;
    const url = canonicalUrl(raw.url);
    const text = compact(raw.text);
    if (!url || !text || !allowed.has(raw.sourceClass)) continue;
    const id = hash(url);
    const contentHash = hash(text);
    currentIds.add(id);
    const before = previousMap.get(id);
    if (before?.contentHash === contentHash) {
      unchanged += 1;
      next.push({
        ...before,
        feedId: raw.feedId || before.feedId || null,
        sourceId: raw.sourceId || before.sourceId,
        source: raw.source || before.source,
        sourceClass: raw.sourceClass || before.sourceClass,
        title: compact(raw.title || before.title || raw.source || "Source document", 180),
        url,
        // Metadata repairs do not require re-embedding unchanged body text.
        // A newly parsed source date must still replace the prior null value.
        publishedAt: raw.publishedAt || before.publishedAt || null,
        observedAt: raw.observedAt || before.observedAt,
        freshnessDays: Number(raw.freshnessDays || before.freshnessDays || policy.freshnessScoring?.defaults?.contentAgeDays || 180),
        lastHumanVerifiedAt: raw.lastHumanVerifiedAt || before.lastHumanVerifiedAt || null,
        sourceChangeDetectedAt: before.sourceChangeDetectedAt || before.indexedAt || before.observedAt || null,
        status: "current",
      });
      continue;
    }
    if (before) changed += 1; else added += 1;
    next.push({
      id,
      sourceId: raw.sourceId,
      feedId: raw.feedId || null,
      source: raw.source,
      sourceClass: raw.sourceClass,
      title: compact(raw.title || raw.source || "Source document", 180),
      url,
      publishedAt: raw.publishedAt || null,
      observedAt: raw.observedAt || now.toISOString(),
      indexedAt: now.toISOString(),
      sourceChangeDetectedAt: raw.observedAt || now.toISOString(),
      lastHumanVerifiedAt: raw.lastHumanVerifiedAt || null,
      freshnessDays: Number(raw.freshnessDays || policy.freshnessScoring?.defaults?.contentAgeDays || 180),
      contentHash,
      status: "current",
      chunks: chunkText(text, Number(policy.retrieval?.chunkCharacters || 900), Number(policy.retrieval?.chunkOverlapCharacters || 120), Number(policy.retrieval?.maxChunksPerDocument || 14)),
    });
  }

  let retained = 0;
  for (const before of previousMap.values()) {
    if (currentIds.has(before.id)) continue;
    // A removed direct feed is a deliberate retirement, not a transient
    // outage.  Never keep its old document alive as dead console content.
    if (before.feedId && !configuredFeedIds.has(before.feedId)) continue;
    const observed = Date.parse(before.observedAt || before.indexedAt || before.publishedAt || "");
    if (!Number.isFinite(observed) || now.getTime() - observed > Number(policy.scope?.retentionDays || 540) * 864e5) continue;
    retained += 1;
    next.push({ ...before, status: "retained-last-verified" });
  }
  next.sort((a, b) => String(b.publishedAt || b.observedAt || "").localeCompare(String(a.publishedAt || a.observedAt || "")));
  return {
    schemaVersion: "1.0",
    mode: policy.retrieval?.mode,
    generatedAt: now.toISOString(),
    stats: {
      documents: next.length,
      chunks: next.reduce((sum, document) => sum + (document.chunks?.length || 0), 0),
      added,
      changed,
      unchanged,
      retained,
      reindexed: added + changed,
    },
    documents: next.slice(0, Number(policy.scope?.maxDocuments || 240)),
  };
}

function buildRetrievalPacks(index = {}, policy = loadIntelligencePolicy()) {
  return (policy.retrieval?.tracks || []).map((track) => {
    const ranked = [];
    for (const document of index.documents || []) {
      for (const chunk of document.chunks || []) {
        const text = chunk.text.toLowerCase();
        const score = track.terms.reduce((sum, term) => sum + (text.includes(String(term).toLowerCase()) ? 1 : 0), 0)
          + (sourceRank[document.sourceClass] || 0) * 0.25;
        if (score <= 0) continue;
        ranked.push({
          score,
          chunkId: chunk.id,
          title: document.title,
          excerpt: compact(chunk.text, 340),
          sourceId: document.sourceId,
          feedId: document.feedId || null,
          source: document.source,
          sourceClass: document.sourceClass,
          url: document.url,
          publishedAt: document.publishedAt,
          indexedAt: document.indexedAt || null,
          sourceChangeDetectedAt: document.sourceChangeDetectedAt || null,
          lastHumanVerifiedAt: document.lastHumanVerifiedAt || null,
          freshnessDays: Number(document.freshnessDays || policy.freshnessScoring?.defaults?.contentAgeDays || 180),
          documentStatus: document.status || "current",
        });
      }
    }
    const evidence = ranked.sort((a, b) => b.score - a.score || String(b.publishedAt || "").localeCompare(String(a.publishedAt || ""))).slice(0, 4);
    return {
      id: track.id,
      label: track.label,
      decisionQuestion: track.decisionQuestion,
      status: evidence.length >= 2 ? "grounded" : evidence.length ? "partial" : "coverage-gap",
      evidence,
    };
  });
}

const clampScore = (value) => Math.max(0, Math.min(100, Number.isFinite(Number(value)) ? Number(value) : 0));
const roundedScore = (value) => Number(clampScore(value).toFixed(1));

function recencyScore(document = {}, now = new Date(), defaultDays = 180) {
  const published = Date.parse(document.publishedAt || document.observedAt || "");
  if (!Number.isFinite(published)) return 0;
  const targetDays = Math.max(1, Number(document.freshnessDays || defaultDays));
  const ageDays = Math.max(0, (now.getTime() - published) / 864e5);
  if (ageDays <= targetDays) return 100;
  return clampScore(100 * (2 - ageDays / targetDays));
}

function embeddingLagScore(document = {}, targetMinutes = 15) {
  const changed = Date.parse(document.sourceChangeDetectedAt || "");
  const indexed = Date.parse(document.indexedAt || "");
  if (!Number.isFinite(changed) || !Number.isFinite(indexed) || indexed < changed) return 0;
  const lagMinutes = (indexed - changed) / 60000;
  const target = Math.max(1, Number(targetMinutes || 15));
  if (lagMinutes <= target) return 100;
  return clampScore(100 * (2 - lagMinutes / target));
}

function latestTimestamp(values = []) {
  return values.filter(Boolean).sort((a, b) => Date.parse(b) - Date.parse(a))[0] || null;
}

export function buildFreshnessScore({ index = {}, packs = [], consensus = {}, feedStatus = [], previous = {}, policy = loadIntelligencePolicy(), now = new Date() } = {}) {
  const config = policy.freshnessScoring || {};
  const defaultDays = Number(config.defaults?.contentAgeDays || 180);
  const lagTargetMinutes = Number(config.defaults?.embeddingLagMinutes || 15);
  const documentMap = new Map((index.documents || []).map((document) => [canonicalUrl(document.url), document]));
  const citedUrls = new Set(packs.flatMap((pack) => pack.evidence || []).map((item) => canonicalUrl(item.url)).filter(Boolean));
  const activeDocuments = [...citedUrls].map((url) => documentMap.get(url)).filter(Boolean);
  const scoredDocuments = activeDocuments.length ? activeDocuments : (index.documents || []);
  const contentAge = scoredDocuments.length
    ? scoredDocuments.reduce((sum, document) => sum + recencyScore(document, now, defaultDays), 0) / scoredDocuments.length
    : 0;
  const embeddingLag = scoredDocuments.length
    ? scoredDocuments.reduce((sum, document) => sum + embeddingLagScore(document, lagTargetMinutes), 0) / scoredDocuments.length
    : 0;
  const citations = packs.flatMap((pack) => pack.evidence || []);
  const staleCitations = citations.filter((citation) => {
    const document = documentMap.get(canonicalUrl(citation.url)) || citation;
    return document.status === "retained-last-verified" || recencyScore(document, now, defaultDays) < 100;
  });
  const staleRetrievalRatePct = citations.length ? 100 * staleCitations.length / citations.length : 100;
  const staleRetrievalRate = 100 - staleRetrievalRatePct;
  const feedsConfigured = Math.max(1, (policy.directFeeds || []).length);
  const feedCoveragePct = 100 * feedStatus.filter((item) => ["fetched", "fixture", "retained-not-due"].includes(item.status)).length / feedsConfigured;
  const trackCoveragePct = packs.length ? 100 * packs.filter((pack) => pack.status !== "coverage-gap").length / packs.length : 0;
  const expectedMetrics = Math.max(1, (policy.metrics || []).reduce((sum, metric) => sum + Math.max(1, metric.entities?.length || 0), 0));
  const metricCoveragePct = 100 * Math.min(expectedMetrics, consensus.latest?.length || 0) / expectedMetrics;
  const currentCoveragePct = (feedCoveragePct + trackCoveragePct + metricCoveragePct) / 3;
  const previousCoverage = Number(previous.freshness?.coverage?.currentPct);
  const coverageDropPctPoint = Number.isFinite(previousCoverage) ? Math.max(0, previousCoverage - currentCoveragePct) : 0;
  const coverageDrift = Number.isFinite(previousCoverage)
    ? 100 - coverageDropPctPoint * 2
    : currentCoveragePct;
  const components = {
    contentAge: roundedScore(contentAge),
    embeddingLag: roundedScore(embeddingLag),
    staleRetrievalRate: roundedScore(staleRetrievalRate),
    coverageDrift: roundedScore(coverageDrift),
  };
  const weights = config.weights || { contentAge: 0.35, embeddingLag: 0.2, staleRetrievalRate: 0.25, coverageDrift: 0.2 };
  const score = roundedScore(Object.entries(components).reduce((sum, [key, value]) => sum + value * Number(weights[key] || 0), 0));
  const currentThreshold = Number(config.thresholds?.current || 85);
  const warningThreshold = Number(config.thresholds?.warning || 70);
  const status = score >= currentThreshold ? "current" : score >= warningThreshold ? "warning" : "degraded";
  const label = status === "current" ? "최신" : status === "warning" ? "재검증 필요" : "저하 모드";
  return {
    framework: config.method || "evidence-freshness-v1",
    score,
    status,
    label,
    revalidationRequired: score < currentThreshold,
    thresholds: { current: currentThreshold, warning: warningThreshold },
    weights,
    components,
    diagnostics: {
      staleRetrievalRatePct: roundedScore(staleRetrievalRatePct),
      feedCoveragePct: roundedScore(feedCoveragePct),
      trackCoveragePct: roundedScore(trackCoveragePct),
      metricCoveragePct: roundedScore(metricCoveragePct),
      coverageDropPctPoint: roundedScore(coverageDropPctPoint),
      activeDocumentCount: scoredDocuments.length,
    },
    coverage: { currentPct: roundedScore(currentCoveragePct), previousPct: Number.isFinite(previousCoverage) ? roundedScore(previousCoverage) : null },
    timestamps: {
      lastHumanVerifiedAt: latestTimestamp(scoredDocuments.map((document) => document.lastHumanVerifiedAt)),
      sourceChangeDetectedAt: latestTimestamp(scoredDocuments.map((document) => document.sourceChangeDetectedAt)),
      indexedAt: latestTimestamp(scoredDocuments.map((document) => document.indexedAt)),
    },
    generatedAt: now.toISOString(),
  };
}

function detectEvents(documents = [], previousIndex = {}, policy = loadIntelligencePolicy()) {
  const previousMap = new Map((previousIndex.documents || []).map((document) => [document.id, document]));
  const feedMap = new Map((policy.directFeeds || []).map((feed) => [feed.id, feed]));
  const rules = new Map((policy.eventRules || []).map((rule) => [rule.id, rule]));
  const eligibleSourceClasses = new Set(policy.claimEvents?.eligibleSourceClasses || ["official", "research"]);
  const output = [];
  for (const document of documents) {
    if (!eligibleSourceClasses.has(document.sourceClass)) continue;
    const feed = feedMap.get(document.feedId);
    const candidateRules = feed?.eventRuleIds?.map((id) => rules.get(id)).filter(Boolean) || [...rules.values()];
    for (const rule of candidateRules) {
      const documentId = hash(canonicalUrl(document.url));
      const contentHash = hash(compact(document.text));
      const changed = previousMap.get(documentId)?.contentHash !== contentHash;
      if (!matchesAll(document.text, rule.patterns) && !(feed?.triggerOnChange === true && changed)) continue;
      output.push({
        id: hash(`${rule.id}|${documentId}|${contentHash}`),
        ruleId: rule.id,
        label: rule.label,
        priority: rule.priority,
        sourceId: document.sourceId,
        source: document.source,
        sourceClass: document.sourceClass,
        title: document.title,
        url: canonicalUrl(document.url),
        publishedAt: document.publishedAt || null,
        changed,
      });
    }
  }
  return output.sort((a, b) => Number(b.changed) - Number(a.changed) || String(b.publishedAt || "").localeCompare(String(a.publishedAt || ""))).slice(0, 24);
}

function firstPatternLabel(value = "", definitions = []) {
  const definition = definitions.find((item) => matchesAny(value, item.patterns));
  return definition ? { id: definition.id, label: definition.label } : null;
}

function evidenceSpan(value = "", rule = {}, minimumCharacters = 28) {
  const text = String(value || "");
  const segments = text
    .split(/\n+|(?<=[.!?])\s+/)
    .map((item) => compact(item, 760))
    .filter((item) => item.length >= minimumCharacters);
  const ranked = segments.map((segment) => ({
    segment,
    score: (rule.patterns || []).reduce((sum, pattern) => sum + (compile(pattern).test(segment) ? 4 : 0), 0)
      + (rule.productPatterns || []).reduce((sum, pattern) => sum + (compile(pattern).test(segment) ? 2 : 0), 0),
  })).filter((item) => item.score > 0).sort((left, right) => right.score - left.score || right.segment.length - left.segment.length);
  if (ranked[0]) return ranked[0].segment;
  const anchor = (rule.patterns || []).map((pattern) => text.search(compile(pattern))).find((index) => index >= 0);
  if (!Number.isFinite(anchor)) return "";
  return compact(text.slice(Math.max(0, anchor - 220), anchor + 520), 760);
}

function numericEvidence(value = "") {
  const tokens = [...String(value || "").matchAll(/(?<![\w.])(\d+(?:\.\d+)?)\s*(%|gbps(?:\/pin)?|tb\/s|gb|tb|mw|gw|w|billion|million|trillion|억|조|년|개)/gi)]
    .map((match) => `${match[1]} ${match[2]}`.replace(/\s+%/, "%"));
  return [...new Set(tokens)].slice(0, 8);
}

function explicitOpposition(value = "") {
  const negative = "(?:\\bnot\\b|den(?:y|ies|ied)|cancel(?:s|led)?|withdraw(?:s|n)?|중단|철회|부인)";
  const lifecycle = "(?:production|shipment|qualification|certification|partnership|agreement|collaboration|standard(?:ization)?|sample|roadmap|plan|양산|출하|인증|협력|계약|표준|샘플|계획)";
  return new RegExp(`${negative}.{0,90}${lifecycle}|${lifecycle}.{0,90}${negative}`, "i").test(String(value || ""));
}

function resolveClaimStage(value = "", rule = {}, policy = loadIntelligencePolicy()) {
  if (rule.fixedStage === true) {
    const fixed = (policy.claimEvents?.stages || []).find((stage) => stage.id === rule.defaultStage);
    if (fixed) return { id: fixed.id, rank: Number(fixed.rank || 0) };
  }
  const lifecycleText = String(value || "");
  // A sample shipment can mention a future mass-production plan in the same
  // release.  The present, evidenced product stage is still SAMPLE; future
  // intent must not be promoted to an achieved manufacturing stage.
  const isHbm4eSample = /\bhbm4e\b/i.test(lifecycleText)
    && /\b(?:ship(?:s|ped)?|deliver(?:s|ed)?)?\s*samples?\b|샘플\s*(?:출하|제공)/i.test(lifecycleText);
  const futureMassProduction = /(?:plan|aim|target|expect|intend|will)[^.!?]{0,120}(?:mass|volume)\s+production|양산[^.!?]{0,60}(?:계획|목표|예정)/i.test(lifecycleText);
  const achievedMassProduction = /\b(?:began|begins|started|starts|entered|commenced|in)\s+(?:mass|volume)\s+production\b|양산\s*(?:개시|시작|돌입|중)/i.test(lifecycleText);
  if (isHbm4eSample && futureMassProduction && !achievedMassProduction) {
    const sample = (policy.claimEvents?.stages || []).find((stage) => stage.id === "SAMPLE");
    if (sample) return { id: sample.id, rank: Number(sample.rank || 0) };
  }
  const stages = (policy.claimEvents?.stages || [])
    .filter((stage) => matchesAny(value, stage.patterns))
    .sort((left, right) => Number(right.rank || 0) - Number(left.rank || 0));
  const fallback = (policy.claimEvents?.stages || []).find((stage) => stage.id === rule.defaultStage);
  const stage = stages[0] || fallback || { id: "DISCLOSED", rank: 0 };
  return { id: stage.id, rank: Number(stage.rank || 0) };
}

/**
 * Converts source documents into an immutable, citation-bearing event ledger.
 * No date, number, stage, entity or product is inferred from model knowledge:
 * each field must resolve from the source text, title or deterministic policy.
 */
export function buildClaimEventLedger({ documents = [], previous = {}, policy = loadIntelligencePolicy(), now = new Date() } = {}) {
  const config = policy.claimEvents || {};
  const eligible = new Set(config.eligibleSourceClasses || ["official", "research"]);
  const rules = policy.eventRules || [];
  const rulesById = new Map(rules.map((rule) => [rule.id, rule]));
  const feedsById = new Map((policy.directFeeds || []).map((feed) => [feed.id, feed]));
  const raw = [];
  for (const document of documents) {
    if (!eligible.has(document.sourceClass) || !validUrl(document.url)) continue;
    if (config.requirePublishedAt && !document.publishedAt) continue;
    const fullText = `${document.title || ""}\n${document.text || ""}`;
    const feed = feedsById.get(document.feedId);
    const candidateRules = feed?.eventRuleIds?.map((id) => rulesById.get(id)).filter(Boolean) || rules;
    for (const rule of candidateRules) {
      if (!matchesAll(fullText, rule.patterns)) continue;
      const span = evidenceSpan(fullText, rule, Number(config.minimumEvidenceCharacters || 28));
      if (config.requireEvidenceSpan && span.length < Number(config.minimumEvidenceCharacters || 28)) continue;
      const entity = firstPatternLabel(`${document.source || ""} ${document.title || ""} ${span}`, config.entityPatterns || []);
      const product = firstPatternLabel(`${document.title || ""} ${span}`, config.productPatterns || []);
      if (!entity || !product) continue;
      const stage = resolveClaimStage(`${document.title || ""} ${span}`, rule, policy);
      const sourceUrl = canonicalUrl(document.url);
      raw.push({
        id: hash(`${rule.id}|${entity.id}|${product.id}|${stage.id}|${document.sourceId}|${sourceUrl}|${document.publishedAt}`),
        ruleId: rule.id,
        eventType: rule.eventType || "source-change",
        label: rule.label,
        entity,
        product,
        stage,
        metrics: numericEvidence(span),
        evidenceSpan: span,
        sourceId: document.sourceId,
        feedId: document.feedId || null,
        source: document.source,
        sourceClass: document.sourceClass,
        sourceUrl,
        publishedAt: document.publishedAt,
        observedAt: document.observedAt || now.toISOString(),
        confidence: document.sourceClass === "official" ? "confirmed-primary" : "research-observed",
        claimType: document.sourceClass === "official" ? "verified-fact" : "market-estimate",
        asOf: document.publishedAt,
      });
    }
  }

  const unique = new Map();
  for (const event of raw) unique.set(`${event.ruleId}|${event.entity.id}|${event.product.id}|${event.stage.id}|${event.sourceUrl}`, event);
  const events = [...unique.values()];
  const groups = new Map();
  for (const event of events) {
    // Product maturity, partnership execution and supply risk are independent
    // lifecycles.  Do not let a partnership announcement supersede a product
    // standardization event merely because both mention the same product.
    const key = `${event.entity.id}|${event.product.id}|${event.eventType}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(event);
  }
  for (const group of groups.values()) {
    group.sort((left, right) => Number(right.stage.rank) - Number(left.stage.rank)
      || Number(right.sourceClass === "official") - Number(left.sourceClass === "official")
      || String(right.publishedAt).localeCompare(String(left.publishedAt)));
    for (const event of group) {
      const peers = group.filter((item) => item.stage.id === event.stage.id);
      const independentSources = new Set(peers.map((item) => item.sourceId)).size;
      const hasPrimary = peers.some((item) => item.sourceClass === "official");
      const affirmative = peers.some((item) => !explicitOpposition(item.evidenceSpan));
      const opposing = peers.some((item) => explicitOpposition(item.evidenceSpan));
      event.independentSources = independentSources;
      // Promotion is attached to the individual claim, not inherited from a
      // peer at the same product stage.  A research report can corroborate a
      // primary disclosure, but it must never be labelled as primary itself.
      event.promotionStatus = event.sourceClass === "official"
        ? "verified-primary"
        : hasPrimary || independentSources >= 2
          ? "corroborated"
          : "review";
      // Different documents commonly disclose complementary capacity, speed
      // and thermal figures.  A numerical-token difference is not itself a
      // contradiction; only explicit affirmative/opposing stage language is.
      event.contradictionStatus = affirmative && opposing ? "review" : "clear";
    }
    const trusted = group.filter((event) => event.promotionStatus !== "review" && event.contradictionStatus === "clear");
    const latest = trusted[0] || group[0];
    for (const event of group) {
      event.isCurrentStage = event.id === latest.id;
      const lowerStage = Number(event.stage.rank) < Number(latest.stage.rank);
      const olderSameRule = event.ruleId === latest.ruleId
        && String(event.publishedAt || "") < String(latest.publishedAt || "");
      event.supersededBy = event.id !== latest.id && (lowerStage || olderSameRule) ? latest.id : null;
    }
  }
  events.sort((left, right) => Number(right.isCurrentStage) - Number(left.isCurrentStage)
    || Number(right.stage.rank) - Number(left.stage.rank)
    || String(right.publishedAt).localeCompare(String(left.publishedAt)));
  const limited = events.slice(0, Number(config.maxEvents || 48));
  const previousEvents = previous.events || [];
  const previousIds = new Set(previousEvents.map((item) => item.id));
  return {
    schemaVersion: config.schemaVersion || "1.0",
    generatedAt: now.toISOString(),
    stats: {
      eligibleDocuments: documents.filter((document) => eligible.has(document.sourceClass) && validUrl(document.url)).length,
      structuredEvents: limited.length,
      verifiedEvents: limited.filter((event) => event.promotionStatus !== "review" && event.contradictionStatus === "clear").length,
      currentStages: limited.filter((event) => event.isCurrentStage).length,
      newEvents: limited.filter((event) => !previousIds.has(event.id)).length,
      contradictionReviews: limited.filter((event) => event.contradictionStatus === "review").length,
    },
    events: limited,
  };
}

function uniqueEvidence(items = []) {
  const byUrl = new Map();
  for (const item of items) {
    const url = canonicalUrl(item.url || item.sourceUrl);
    if (!url || byUrl.has(url)) continue;
    byUrl.set(url, { ...item, url });
  }
  return [...byUrl.values()];
}

export function buildAutomatedDecisionBriefs({ claimLedger = {}, packs = [], evaluation = {}, policy = loadIntelligencePolicy(), now = new Date() } = {}) {
  const packMap = new Map(packs.map((pack) => [pack.id, pack]));
  const minIndependent = Number(policy.decisionAutomation?.minimumIndependentEvidence || 2);
  const minPrimary = Number(policy.decisionAutomation?.minimumPrimaryEvidence || 1);
  return (policy.decisionAutomation?.briefs || []).map((brief) => {
    const claims = (claimLedger.events || []).filter((event) => (brief.claimRuleIds || []).includes(event.ruleId));
    const claimEvidence = claims.map((event) => ({
      id: event.id,
      ruleId: event.ruleId,
      feedId: event.feedId,
      title: `${event.entity.label} · ${event.product.label} · ${event.stage.id}`,
      source: event.source,
      sourceId: event.sourceId,
      sourceClass: event.sourceClass,
      url: event.sourceUrl,
      publishedAt: event.publishedAt,
      stage: event.stage.id,
      confidence: event.confidence,
      claimType: event.claimType,
      asOf: event.asOf || event.publishedAt,
      excerpt: event.evidenceSpan,
    }));
    const retrievalEvidence = (brief.trackIds || []).flatMap((trackId) => packMap.get(trackId)?.evidence || []);
    const evidence = uniqueEvidence([...claimEvidence, ...retrievalEvidence]).slice(0, 8);
    const independentSources = new Set(evidence.map((item) => item.sourceId || item.source).filter(Boolean)).size;
    const primaryEvidence = evidence.filter((item) => item.sourceClass === "official").length;
    const officialFactCount = evidence.filter((item) => item.claimType === "verified-fact"
      || (item.sourceClass === "official" && item.claimType !== "market-estimate")).length;
    const marketEstimateCount = evidence.filter((item) => item.claimType === "market-estimate"
      || item.sourceClass === "research").length;
    const hasConflict = claims.some((event) => event.contradictionStatus === "review");
    const verifiedClaims = claims.filter((event) => event.promotionStatus !== "review" && event.contradictionStatus === "clear").length;
    const latestClaim = claims.filter((event) => event.isCurrentStage)[0] || claims[0] || null;
    const status = hasConflict
      ? "CONFLICT_REVIEW"
      : evaluation.status === "pass" && verifiedClaims > 0 && independentSources >= minIndependent && primaryEvidence >= minPrimary
        ? "DECISION_READY"
        : evidence.length ? "EVIDENCE_READY" : "MONITORING";
    return {
      id: brief.id,
      label: brief.label,
      meceAxis: brief.meceAxis,
      decisionQuestion: brief.decisionQuestion,
      decisionStage: brief.decisionStage,
      deliverable: brief.deliverable,
      status,
      updatedAt: now.toISOString(),
      // The source event is shared evidence.  The card headline is the
      // track-specific executive question so one market event can inform
      // several decisions without cloning the same conclusion across cards.
      whatChanged: brief.decisionQuestion,
      latestSignal: latestClaim ? `${latestClaim.entity.label} · ${latestClaim.product.label} · ${latestClaim.stage.id}` : "구조화된 Stage Event 관측 대기",
      sourceStage: latestClaim?.stage.id || "MONITORING",
      stage: brief.decisionStage,
      confidence: latestClaim?.promotionStatus || "evidence-gap",
      customerPain: brief.customerPain,
      factBoundary: brief.factBoundary || "공식 원문·제품 Stage·날짜가 확인된 내용만 사실로 승격 · 전망 수치는 시장 추정치로 분리",
      hypothesisStatus: brief.hypothesisStatus || "strategy-hypothesis",
      hypothesis: brief.hypothesis,
      options: brief.options || [],
      economics: brief.economics || [],
      action90d: brief.action90d,
      owner: brief.owner,
      kpis: brief.kpis || [],
      trigger: brief.trigger,
      killCriteria: brief.killCriteria,
      evidenceCount: evidence.length,
      officialFactCount,
      marketEstimateCount,
      independentSources,
      primaryEvidence,
      verifiedClaims,
      evidence,
    };
  });
}

function buildSourceOperations({ documents = [], feedStatus = [], observations = [], claimLedger = {}, packs = [], policy = loadIntelligencePolicy(), now = new Date() } = {}) {
  const usefulFeedIds = new Set([
    ...observations.map((item) => item.feedId),
    ...(claimLedger.events || []).map((item) => item.feedId),
    ...packs.flatMap((pack) => pack.evidence || []).map((item) => item.feedId),
  ].filter(Boolean));
  const documentByFeed = new Map(documents.filter((item) => item.feedId).map((item) => [item.feedId, item]));
  const sources = (policy.directFeeds || []).map((feed) => {
    const status = feedStatus.find((item) => item.id === feed.id) || {};
    const document = documentByFeed.get(feed.id);
    return {
      id: feed.id,
      sourceId: feed.sourceId,
      latencyClass: feed.latencyClass,
      refreshMode: feed.refreshMode,
      transportStatus: status.status || "not-observed",
      attempts: Number(status.attempts || 0),
      lastSuccessAt: document?.observedAt || status.lastSuccessAt || null,
      lastUsefulObservationAt: usefulFeedIds.has(feed.id) ? document?.observedAt || now.toISOString() : null,
      usefulObservation: usefulFeedIds.has(feed.id),
      eventYield: (claimLedger.events || []).filter((item) => item.feedId === feed.id).length,
    };
  });
  const fetched = sources.filter((item) => ["fetched", "fixture", "retained-not-due"].includes(item.transportStatus)).length;
  const useful = sources.filter((item) => item.usefulObservation).length;
  return {
    configured: sources.length,
    observed: fetched,
    useful,
    observationRatePct: sources.length ? Number((100 * fetched / sources.length).toFixed(1)) : 0,
    usefulYieldPct: fetched ? Number((100 * useful / fetched).toFixed(1)) : 0,
    sources,
  };
}

function evaluate({ index, packs, consensus, policy, now }) {
  const citations = packs.flatMap((pack) => pack.evidence || []);
  const citationCoveragePct = citations.length ? 100 * citations.filter((item) => validUrl(item.url)).length / citations.length : 0;
  const trackCoveragePct = packs.length ? 100 * packs.filter((pack) => pack.status !== "coverage-gap").length / packs.length : 0;
  const allDocuments = index.documents || [];
  const freshDocuments = allDocuments.filter((document) => {
    const observed = Date.parse(document.publishedAt || document.observedAt || "");
    return Number.isFinite(observed) && now.getTime() - observed <= 180 * 864e5;
  });
  const freshDocumentPct = allDocuments.length ? 100 * freshDocuments.length / allDocuments.length : 0;
  const primaryOrResearchPct = allDocuments.length ? 100 * allDocuments.filter((document) => ["official", "research"].includes(document.sourceClass)).length / allDocuments.length : 0;
  const conflicting = (consensus.series || []).filter((item) => item.sourceCount > 1 && item.min !== item.max);
  const conflictDisclosurePct = conflicting.length ? 100 * conflicting.filter((item) => item.representation === "range").length / conflicting.length : 100;
  const metrics = {
    citationCoveragePct: Number(citationCoveragePct.toFixed(1)),
    trackCoveragePct: Number(trackCoveragePct.toFixed(1)),
    freshDocumentPct: Number(freshDocumentPct.toFixed(1)),
    primaryOrResearchPct: Number(primaryOrResearchPct.toFixed(1)),
    conflictDisclosurePct: Number(conflictDisclosurePct.toFixed(1)),
    unsupportedClaimPct: 0,
  };
  const thresholds = policy.evaluation || {};
  const passed = metrics.citationCoveragePct >= Number(thresholds.minimumCitationCoveragePct || 100)
    && metrics.trackCoveragePct >= Number(thresholds.minimumTrackCoveragePct || 75)
    && metrics.freshDocumentPct >= Number(thresholds.minimumFreshDocumentPct || 60)
    && metrics.primaryOrResearchPct >= Number(thresholds.minimumPrimaryOrResearchPct || 80)
    && metrics.unsupportedClaimPct <= Number(thresholds.maximumUnsupportedClaimPct || 0);
  return {
    framework: thresholds.framework,
    status: passed ? "pass" : "review",
    failClosed: thresholds.failClosed === true,
    groundingMode: "extractive-only; no uncited generated claim is published",
    metrics,
  };
}

export function buildDecisionIntelligence({ documents = [], previous = {}, policy = loadIntelligencePolicy(), runId = null, now = new Date(), feedStatus = [], refreshTrigger = "scheduled" } = {}) {
  const observations = extractMetricObservations(documents, policy);
  const consensus = buildMetricConsensus({ current: observations, previous: previous.metrics || {}, policy, now });
  const index = buildIncrementalKnowledgeIndex({ documents, previous: previous.knowledgeIndex || {}, policy, now });
  const retrievalPacks = buildRetrievalPacks(index, policy);
  const events = detectEvents(documents, previous.knowledgeIndex || {}, policy);
  const evaluation = evaluate({ index, packs: retrievalPacks, consensus, policy, now });
  const freshness = buildFreshnessScore({ index, packs: retrievalPacks, consensus, feedStatus, previous, policy, now });
  const claimEvents = buildClaimEventLedger({ documents, previous: previous.claimEvents || {}, policy, now });
  const decisionBriefs = buildAutomatedDecisionBriefs({ claimLedger: claimEvents, packs: retrievalPacks, evaluation, policy, now });
  const sourceOperations = buildSourceOperations({ documents, feedStatus, observations, claimLedger: claimEvents, packs: retrievalPacks, policy, now });
  const readyBriefs = decisionBriefs.filter((brief) => brief.status === "DECISION_READY").length;
  return {
    schemaVersion: "1.3",
    runId,
    generatedAt: now.toISOString(),
    refreshTrigger,
    scope: policy.scope?.id,
    feedStatus,
    metrics: consensus,
    eventTriggers: events,
    claimEvents,
    decisionAutomation: {
      schemaVersion: policy.decisionAutomation?.schemaVersion || "1.0",
      meceAxes: policy.decisionAutomation?.meceAxes || [],
      state: claimEvents.stats.contradictionReviews > 0 ? "CONFLICT_REVIEW" : readyBriefs > 0 ? "DECISION_READY" : claimEvents.stats.structuredEvents > 0 ? "EVIDENCE_READY" : "MONITORING",
      funnel: {
        sourceDocuments: index.stats.documents,
        structuredEvents: claimEvents.stats.structuredEvents,
        verifiedEvents: claimEvents.stats.verifiedEvents,
        decisionReadyBriefs: readyBriefs,
        executionTrackingBriefs: decisionBriefs.filter((brief) => brief.status === "EXECUTION_TRACKING").length,
      },
      sourceOperations,
      briefs: decisionBriefs,
    },
    retrieval: {
      mode: policy.retrieval?.mode,
      stats: index.stats,
      packs: retrievalPacks,
    },
    freshness,
    evaluation,
    knowledgeIndex: index,
  };
}

export function decisionMetric(decisionIntelligence = {}, metricId = "", entityId = "") {
  return (decisionIntelligence.metrics?.latest || []).find((item) => item.metricId === metricId && item.entityId === entityId) || null;
}
