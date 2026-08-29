/**
 * Fail-closed retirement rules for metrics whose historical series combined
 * unlike vendor disclosures into a single value.  The vendor disclosures may
 * still be used independently in governed product records; they must not be
 * represented as one market KPI or time series.
 */

export const RETIRED_COMBINED_HBM4_METRIC_ID = "kpi-60402b48492983fd";

const RETIRED_COMBINED_HBM4_LABELS = new Set([
  "HBM4 Rubin 요구 속도",
  "HBM4 업체별 확인 속도",
]);

const RETIRED_COMBINED_HBM4_SOURCE = "SKHY / Micron IR";

function normalizedMetricId(value = "") {
  return String(value || "").trim().replace(/^metric:/, "");
}

export function isRetiredCombinedHbm4Metric(id = "", metric = {}) {
  const label = String(metric?.label || metric?.title || "").trim();
  const source = String(metric?.source || metric?.provenance || "").trim();
  return normalizedMetricId(id || metric?.id) === RETIRED_COMBINED_HBM4_METRIC_ID
    || RETIRED_COMBINED_HBM4_LABELS.has(label)
    || source === RETIRED_COMBINED_HBM4_SOURCE;
}

function purgeArray(container, key, path, removedPaths) {
  if (!Array.isArray(container?.[key])) return;
  container[key] = container[key].filter((item, index) => {
    if (!isRetiredCombinedHbm4Metric(item?.id, item)) return true;
    removedPaths.push(`${path}.${index}`);
    return false;
  });
}

function normalizeMarketKpiIndexes(marketStructure = {}) {
  const indexMap = new Map();
  if (!Array.isArray(marketStructure?.kpis)) return indexMap;
  marketStructure.kpis.forEach((item, nextIndex) => {
    const previousIndex = Number.isInteger(Number(item?.baselineIndex))
      ? Number(item.baselineIndex)
      : nextIndex;
    indexMap.set(previousIndex, nextIndex);
    if (item && typeof item === "object") item.baselineIndex = nextIndex;
  });
  return indexMap;
}

function purgeRecord(container, key, path, removedPaths) {
  if (!container?.[key] || typeof container[key] !== "object" || Array.isArray(container[key])) return;
  for (const [id, item] of Object.entries(container[key])) {
    if (!isRetiredCombinedHbm4Metric(id, item)) continue;
    delete container[key][id];
    removedPaths.push(`${path}.${id}`);
  }
}

function recountBaselineFreshness(freshness = {}) {
  if (!freshness?.items || typeof freshness.items !== "object") return;
  const items = Object.values(freshness.items);
  freshness.total = items.length;
  freshness.current = items.filter((item) => item?.status === "current").length;
  freshness.revalidate = items.filter((item) => item?.status === "revalidate").length;
  freshness.conflictCandidates = items.filter((item) => item?.conflictCandidate === true).length;
}

function remapFreshnessIndexes(freshness = {}, indexMap = new Map()) {
  if (!freshness?.items || !indexMap.size) return;
  const remapped = {};
  for (const [key, item] of Object.entries(freshness.items)) {
    const match = key.match(/^(baseline-root-kpis-)(\d+)(-.+)$/);
    if (!match || !indexMap.has(Number(match[2]))) {
      remapped[key] = item;
      continue;
    }
    const nextIndex = indexMap.get(Number(match[2]));
    const nextKey = `${match[1]}${nextIndex}${match[3]}`;
    const nextItem = { ...item };
    if (typeof nextItem.id === "string") {
      nextItem.id = nextItem.id.replace(/^(baseline-root-kpis-)\d+(-.+)$/, `$1${nextIndex}$2`);
    }
    if (typeof nextItem.path === "string") {
      nextItem.path = nextItem.path.replace(/^root\.kpis\[\d+\]/, `root.kpis[${nextIndex}]`);
    }
    remapped[nextKey] = nextItem;
  }
  freshness.items = remapped;
}

function purgeFreshness(freshness = {}, path, removedPaths, indexMap = new Map()) {
  purgeRecord(freshness, "items", `${path}.items`, removedPaths);
  remapFreshnessIndexes(freshness, indexMap);
  recountBaselineFreshness(freshness);
}

function purgeQuant(quant = {}, path, removedPaths) {
  purgeArray(quant, "kpis", `${path}.kpis`, removedPaths);
  purgeArray(quant.marketStructure, "kpis", `${path}.marketStructure.kpis`, removedPaths);
  const indexMap = normalizeMarketKpiIndexes(quant.marketStructure);
  purgeFreshness(quant.baselineFreshness, `${path}.baselineFreshness`, removedPaths, indexMap);
}

function purgeMarketHistory(history = {}, path, removedPaths) {
  purgeRecord(history, "metrics", `${path}.metrics`, removedPaths);
  purgeRecord(history, "metricDefinitions", `${path}.metricDefinitions`, removedPaths);
}

function purgeBacktest(backtest = {}, path, removedPaths) {
  purgeRecord(backtest, "series", `${path}.series`, removedPaths);
}

/**
 * Mutates the supplied artifact roots and returns the exact removed paths.
 * Callers should pass only the known data contracts below; this intentionally
 * avoids a broad text scrub that could erase legitimate vendor-specific facts.
 */
export function purgeRetiredCombinedHbm4Artifacts({
  baseline,
  quant,
  payload,
  marketHistory,
  quantBacktest,
} = {}) {
  const removedPaths = [];
  if (baseline) purgeQuant(baseline, "baseline", removedPaths);
  if (quant) purgeQuant(quant, "quant", removedPaths);
  if (marketHistory) purgeMarketHistory(marketHistory, "marketHistory", removedPaths);
  if (quantBacktest) purgeBacktest(quantBacktest, "quantBacktest", removedPaths);
  if (payload) {
    purgeQuant(payload.quant, "payload.quant", removedPaths);
    purgeMarketHistory(payload.marketHistory, "payload.marketHistory", removedPaths);
    purgeBacktest(payload.quantBacktest, "payload.quantBacktest", removedPaths);
  }
  return removedPaths;
}
