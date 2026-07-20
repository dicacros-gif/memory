const DAY_MS = 86_400_000;
const YEAR_DAYS = 365.2425;

export const QUANT_HISTORY_SCHEMA_VERSION = "1.0";

export const QUANT_HORIZONS = Object.freeze([
  Object.freeze({ id: "1y", label: "1년", years: 1, nominalDays: 365, toleranceDays: 30 }),
  Object.freeze({ id: "3y", label: "3년", years: 3, nominalDays: 1_095, toleranceDays: 60 }),
  Object.freeze({ id: "5y", label: "5년", years: 5, nominalDays: 1_825, toleranceDays: 90 }),
]);

export const QUANT_CADENCE_RULES = Object.freeze({
  // Fourteen calendar days accommodates exchange closures (for example Golden
  // Week) while still rejecting a missing multi-week daily-data block.
  daily: Object.freeze({ minPointsPerYear: 180, maxGapDays: 14, maxEndLagDays: 14 }),
  // Monthly source archives occasionally omit one publication month. Accept a
  // single missing month, but keep two consecutive omissions fail-closed.
  monthly: Object.freeze({ minPointsPerYear: 10, maxGapDays: 75, maxEndLagDays: 50 }),
  quarterly: Object.freeze({ minPointsPerYear: 3, maxGapDays: 200, maxEndLagDays: 150 }),
  // Sparse archive anchors are evidence, but not a continuous return series. They
  // remain in the contract with diagnostics and can never pass a fixed horizon.
  sparse: Object.freeze({ minPointsPerYear: 2, maxGapDays: 400, maxEndLagDays: 190 }),
});

export const QUANT_SERIES_KINDS = Object.freeze(["price", "rate", "flow"]);

const PRICE_METRIC_IDS = new Set([
  "quant-usdkrw",
  "quant-usdtwd",
  "quant-nvda",
  "quant-amd",
]);

const DEFAULT_VALUE_KEYS = Object.freeze([
  "value",
  "close",
  "average",
  "revenue",
  "amount",
]);

const round = (value, digits = 2) => {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const isoOrNull = (value) => {
  const time = dateTime(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
};

export function dateTime(value) {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : NaN;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 1e12 ? value * 1_000 : value;
  }
  if (typeof value !== "string" || !value.trim()) return NaN;

  const text = value.trim();
  const gmt = text.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*\(GMT([+-]\d{1,2})(?::?(\d{2}))?\)$/i,
  );
  if (gmt) {
    const [, year, month, day, hour, minute, second = "0", offsetHour, offsetMinute = "0"] = gmt;
    const sign = Number(offsetHour) < 0 ? -1 : 1;
    const offset = Number(offsetHour) * 60 + sign * Number(offsetMinute);
    return Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute) - offset,
      Number(second),
    );
  }

  const plainDate = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (plainDate) {
    return Date.UTC(Number(plainDate[1]), Number(plainDate[2]) - 1, Number(plainDate[3]));
  }

  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function numericValue(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const normalized = value.trim().replaceAll(",", "").replace(/[%$￦₩]/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function pointTime(point) {
  if (!point || typeof point !== "object") return NaN;
  const candidates = [
    point.sourceObservedAt,
    point.observedAt,
    point.date,
    point.sourceUpdate,
    point.regularMarketTime,
    point.time,
    point.crawledAt,
  ];
  for (const candidate of candidates) {
    const time = dateTime(candidate);
    if (Number.isFinite(time)) return time;
  }
  return NaN;
}

function pointValue(point, valueKeys) {
  if (typeof point === "number" || typeof point === "string") return numericValue(point);
  if (!point || typeof point !== "object") return null;
  for (const key of valueKeys) {
    const value = numericValue(point[key]);
    if (value !== null) return value;
  }
  return null;
}

function bucketKey(time, cadence) {
  const iso = new Date(time).toISOString();
  if (cadence === "quarterly") {
    const date = new Date(time);
    return `${date.getUTCFullYear()}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
  }
  return cadence === "monthly" ? iso.slice(0, 7) : iso.slice(0, 10);
}

/**
 * Normalizes heterogeneous crawler points without mutating the input. Duplicate
 * observations on one cadence bucket keep the latest timestamp/value.
 */
export function normalizeHistoryPoints(points, options = {}) {
  const valueKeys = Array.isArray(options.valueKeys) && options.valueKeys.length
    ? options.valueKeys
    : DEFAULT_VALUE_KEYS;
  const cadence = ["monthly", "quarterly"].includes(options.cadence) ? options.cadence : "daily";
  const byBucket = new Map();

  for (const [inputIndex, point] of (Array.isArray(points) ? points : []).entries()) {
    const time = pointTime(point);
    const value = pointValue(point, valueKeys);
    if (!Number.isFinite(time) || value === null) continue;
    const normalized = {
      date: new Date(time).toISOString(),
      time,
      value,
      inputIndex,
    };
    const key = bucketKey(time, cadence);
    const previous = byBucket.get(key);
    if (!previous || time > previous.time || (time === previous.time && inputIndex > previous.inputIndex)) {
      byBucket.set(key, normalized);
    }
  }

  return [...byBucket.values()]
    .sort((a, b) => a.time - b.time || a.inputIndex - b.inputIndex)
    .map(({ inputIndex: _inputIndex, ...point }) => point);
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function inferHistoryCadence(points, options = {}) {
  const normalized = normalizeHistoryPoints(points, { ...options, cadence: "daily" });
  if (normalized.length < 2) return "sparse";
  const gaps = normalized.slice(1).map((point, index) => (point.time - normalized[index].time) / DAY_MS);
  const medianGap = median(gaps);
  if (medianGap !== null && medianGap <= 10) return "daily";
  if (medianGap !== null && medianGap <= 50) return "monthly";
  if (medianGap !== null && medianGap <= 200) return "quarterly";
  return "sparse";
}

function resolveHorizon(horizon) {
  if (typeof horizon === "string") {
    return QUANT_HORIZONS.find((item) => item.id === horizon) || null;
  }
  if (horizon && typeof horizon === "object") {
    const years = Number(horizon.years);
    if (!(years > 0)) return null;
    return {
      id: String(horizon.id || `${years}y`),
      label: String(horizon.label || `${years}년`),
      years,
      nominalDays: Number(horizon.nominalDays) || Math.round(years * 365),
      toleranceDays: Math.max(0, Number(horizon.toleranceDays) || 0),
    };
  }
  return null;
}

function subtractUtcYears(time, years) {
  const date = new Date(time);
  const month = date.getUTCMonth();
  date.setUTCFullYear(date.getUTCFullYear() - years);
  // JS maps Feb 29 to March in non-leap target years; financial horizon
  // boundaries conventionally use the last valid day of February instead.
  if (date.getUTCMonth() !== month) date.setUTCDate(0);
  return date.getTime();
}

function largestGapDays(points, cadence) {
  if (points.length < 2) return null;
  let largest = 0;
  for (let index = 1; index < points.length; index += 1) {
    const currentDate = new Date(points[index].time);
    const previousDate = new Date(points[index - 1].time);
    const currentTime = cadence === "monthly"
      ? Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), 1)
      : cadence === "quarterly"
        ? Date.UTC(currentDate.getUTCFullYear(), Math.floor(currentDate.getUTCMonth() / 3) * 3, 1)
      : points[index].time;
    const previousTime = cadence === "monthly"
      ? Date.UTC(previousDate.getUTCFullYear(), previousDate.getUTCMonth(), 1)
      : cadence === "quarterly"
        ? Date.UTC(previousDate.getUTCFullYear(), Math.floor(previousDate.getUTCMonth() / 3) * 3, 1)
      : points[index - 1].time;
    largest = Math.max(largest, (currentTime - previousTime) / DAY_MS);
  }
  return round(largest, 2);
}

function maxDrawdownPct(points) {
  if (!points.length || !(points[0].value > 0)) return null;
  let peak = points[0].value;
  let drawdown = 0;
  for (const point of points) {
    if (!(point.value >= 0)) return null;
    peak = Math.max(peak, point.value);
    if (peak > 0) drawdown = Math.min(drawdown, ((point.value / peak) - 1) * 100);
  }
  return round(drawdown);
}

function performanceFields(seriesKind, values = {}) {
  if (seriesKind === "rate") {
    return {
      absoluteChange: values.absoluteChange ?? null,
      percentagePointChange: values.percentagePointChange ?? null,
    };
  }
  if (seriesKind === "flow") {
    return {
      absoluteChange: values.absoluteChange ?? null,
      endpointChangePct: values.endpointChangePct ?? null,
    };
  }
  return {
    cumulativePct: values.cumulativePct ?? null,
    cagrPct: values.cagrPct ?? null,
    maxDrawdownPct: values.maxDrawdownPct ?? null,
  };
}

function emptyStats(horizon, cadence, seriesKind, status, reasonCodes = [status]) {
  return {
    horizon: horizon.id,
    years: horizon.years,
    cadence,
    seriesKind,
    eligible: false,
    status,
    reasonCodes,
    pointCount: 0,
    requiredPointCount: Math.ceil(QUANT_CADENCE_RULES[cadence].minPointsPerYear * horizon.years),
    availablePointCount: 0,
    availableSpanDays: 0,
    coverageDays: null,
    coverageRatio: null,
    toleranceDays: horizon.toleranceDays,
    maxAllowedGapDays: QUANT_CADENCE_RULES[cadence].maxGapDays,
    maxEndLagDays: QUANT_CADENCE_RULES[cadence].maxEndLagDays,
    targetStartDate: null,
    startDate: null,
    endDate: null,
    startValue: null,
    endValue: null,
    startOffsetDays: null,
    endLagDays: null,
    largestGapDays: null,
    ...performanceFields(seriesKind),
  };
}

/**
 * Calculates a fixed-period return. A shorter observed range is never silently
 * substituted: all performance fields remain null unless coverage passes.
 */
export function calculateHorizonStats(points, options = {}) {
  const horizon = resolveHorizon(options.horizon || "1y");
  if (!horizon) throw new TypeError(`Unknown quantitative horizon: ${String(options.horizon)}`);
  const seriesKind = QUANT_SERIES_KINDS.includes(options.seriesKind) ? options.seriesKind : "price";
  const inferredCadence = options.cadence || inferHistoryCadence(points, options);
  const cadence = Object.hasOwn(QUANT_CADENCE_RULES, inferredCadence) ? inferredCadence : "sparse";
  const normalized = normalizeHistoryPoints(points, { ...options, cadence });
  if (!normalized.length) return emptyStats(horizon, cadence, seriesKind, "no-data");

  const explicitAsOf = options.asOf !== undefined && options.asOf !== null;
  const requestedAsOf = explicitAsOf ? dateTime(options.asOf) : normalized.at(-1).time;
  if (!Number.isFinite(requestedAsOf)) throw new TypeError(`Invalid asOf date: ${String(options.asOf)}`);
  const available = normalized.filter((point) => point.time <= requestedAsOf);
  if (!available.length) return emptyStats(horizon, cadence, seriesKind, "no-end-point");

  const end = available.at(-1);
  const targetStartTime = subtractUtcYears(end.time, horizon.years);
  const targetStartDate = new Date(targetStartTime).toISOString();
  const toleranceMs = horizon.toleranceDays * DAY_MS;
  const candidates = available.filter((point) => Math.abs(point.time - targetStartTime) <= toleranceMs);
  const start = [...candidates].sort((a, b) => {
    const delta = Math.abs(a.time - targetStartTime) - Math.abs(b.time - targetStartTime);
    return delta || a.time - b.time;
  })[0] || null;
  const rule = QUANT_CADENCE_RULES[cadence];
  const requiredPointCount = Math.ceil(rule.minPointsPerYear * horizon.years);
  const endLagDays = (requestedAsOf - end.time) / DAY_MS;
  const availableSpanDays = (end.time - available[0].time) / DAY_MS;

  if (!start) {
    const result = emptyStats(horizon, cadence, seriesKind, "insufficient-history");
    return {
      ...result,
      pointCount: available.length,
      requiredPointCount,
      availablePointCount: available.length,
      availableSpanDays: round(availableSpanDays, 2),
      coverageRatio: null,
      targetStartDate,
      endDate: end.date,
      endValue: end.value,
      endLagDays: round(endLagDays, 2),
    };
  }

  const window = available.filter((point) => point.time >= start.time && point.time <= end.time);
  const gapDays = largestGapDays(window, cadence);
  const coverageDays = (end.time - start.time) / DAY_MS;
  const startOffsetDays = Math.abs(start.time - targetStartTime) / DAY_MS;
  const reasonCodes = [];
  if (cadence === "sparse") reasonCodes.push("sparse-cadence");
  if (explicitAsOf && endLagDays > rule.maxEndLagDays) reasonCodes.push("stale-end");
  if (window.length < requiredPointCount) reasonCodes.push("insufficient-points");
  if (gapDays !== null && gapDays > rule.maxGapDays) reasonCodes.push("excessive-gap");
  if (seriesKind === "price" && (!(start.value > 0) || window.some((point) => point.value < 0))) {
    reasonCodes.push("invalid-return-values");
  }
  if (seriesKind === "flow" && !(start.value > 0)) reasonCodes.push("invalid-change-base");

  const eligible = reasonCodes.length === 0;
  const absoluteChange = eligible ? end.value - start.value : null;
  const endpointChange = eligible ? ((end.value / start.value) - 1) * 100 : null;
  const elapsedYears = coverageDays / YEAR_DAYS;
  const cagr = eligible && seriesKind === "price" && horizon.years > 1 && elapsedYears > 0
    ? ((end.value / start.value) ** (1 / elapsedYears) - 1) * 100
    : null;
  const performance = seriesKind === "price"
    ? performanceFields(seriesKind, {
        cumulativePct: eligible ? round(endpointChange) : null,
        cagrPct: eligible ? round(cagr) : null,
        maxDrawdownPct: eligible ? maxDrawdownPct(window) : null,
      })
    : seriesKind === "rate"
      ? performanceFields(seriesKind, {
          absoluteChange: eligible ? round(absoluteChange) : null,
          percentagePointChange: eligible ? round(absoluteChange) : null,
        })
      : performanceFields(seriesKind, {
          absoluteChange: eligible ? round(absoluteChange) : null,
          endpointChangePct: eligible ? round(endpointChange) : null,
        });

  return {
    horizon: horizon.id,
    years: horizon.years,
    cadence,
    seriesKind,
    eligible,
    status: eligible ? "eligible" : reasonCodes[0],
    reasonCodes,
    pointCount: window.length,
    requiredPointCount,
    availablePointCount: available.length,
    availableSpanDays: round(availableSpanDays, 2),
    coverageDays: round(coverageDays, 2),
    coverageRatio: round(coverageDays / ((end.time - targetStartTime) / DAY_MS), 4),
    toleranceDays: horizon.toleranceDays,
    maxAllowedGapDays: rule.maxGapDays,
    maxEndLagDays: rule.maxEndLagDays,
    targetStartDate,
    startDate: start.date,
    endDate: end.date,
    startValue: start.value,
    endValue: end.value,
    startOffsetDays: round(startOffsetDays, 2),
    endLagDays: round(endLagDays, 2),
    largestGapDays: gapDays,
    ...performance,
  };
}

export function calculateAllHorizonStats(points, options = {}) {
  return Object.fromEntries(QUANT_HORIZONS.map((horizon) => [
    horizon.id,
    calculateHorizonStats(points, { ...options, horizon }),
  ]));
}

function sortedEntries(value) {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).sort(([left], [right]) => left.localeCompare(right, "en"));
}

export function classifySeriesKind(id, domain = "metric", entry = {}) {
  if (QUANT_SERIES_KINDS.includes(entry?.seriesKind)) return entry.seriesKind;
  if (domain === "price" || domain === "market") return "price";
  const normalized = String(id || "").trim().toLowerCase().replaceAll("_", "-");
  if (PRICE_METRIC_IDS.has(normalized)) return "price";
  if (/(?:^|-)kpi(?:-|$)|share|(?:^|-)yoy(?:-|$)/.test(normalized)) return "rate";
  if (/revenue|gross-?profit|inventory/.test(normalized)) return "flow";
  // Unknown dashboard metrics default to rate so they cannot accidentally emit
  // investable price-return or drawdown statistics.
  return "rate";
}

function seriesRecord(id, entry, domain, asOf) {
  const points = Array.isArray(entry?.points) ? entry.points : [];
  const seriesKind = classifySeriesKind(id, domain, entry);
  // TrendForce price history combines sparse archive anchors with recent daily
  // crawls. Month buckets keep backtests stable as that mix changes over time.
  const cadence = domain === "price"
    ? "monthly"
    : entry?.cadence && Object.hasOwn(QUANT_CADENCE_RULES, entry.cadence)
      ? entry.cadence
      : inferHistoryCadence(points);
  return {
    id,
    domain,
    label: String(entry?.label || entry?.labelKo || entry?.item || id),
    group: entry?.group || null,
    cadence,
    seriesKind,
    unit: entry?.unit || null,
    symbol: entry?.symbol || null,
    currency: entry?.currency || null,
    source: entry?.source || null,
    sourceUrl: entry?.sourceUrl || null,
    observationCount: normalizeHistoryPoints(points, { cadence }).length,
    periods: calculateAllHorizonStats(points, { cadence, seriesKind, asOf }),
  };
}

function coverageSummary(series) {
  return Object.fromEntries(QUANT_HORIZONS.map(({ id }) => {
    const values = Object.values(series);
    const byDomain = {};
    const byCadence = {};
    const bySeriesKind = {};
    for (const item of values) {
      byDomain[item.domain] ||= { total: 0, eligible: 0 };
      byCadence[item.cadence] ||= { total: 0, eligible: 0 };
      bySeriesKind[item.seriesKind] ||= { total: 0, eligible: 0 };
      byDomain[item.domain].total += 1;
      byCadence[item.cadence].total += 1;
      bySeriesKind[item.seriesKind].total += 1;
      if (item.periods[id].eligible) {
        byDomain[item.domain].eligible += 1;
        byCadence[item.cadence].eligible += 1;
        bySeriesKind[item.seriesKind].eligible += 1;
      }
    }
    const eligible = values.filter((item) => item.periods[id].eligible).length;
    return [id, {
      totalSeries: values.length,
      eligibleSeries: eligible,
      unavailableSeries: values.length - eligible,
      byDomain,
      byCadence,
      bySeriesKind,
    }];
  }));
}

/**
 * Creates a stable derived-data contract. `generatedAt` is never filled with the
 * wall clock, so identical inputs produce byte-equivalent objects.
 */
export function buildQuantBacktestSummary({
  priceHistory = {},
  marketHistory = {},
  generatedAt,
  runId,
} = {}) {
  const explicitGeneratedAt = isoOrNull(generatedAt);
  const sourceUpdateTimes = [marketHistory.updatedAt, priceHistory.updatedAt]
    .map(dateTime)
    .filter(Number.isFinite);
  const derivedGeneratedAt = explicitGeneratedAt
    || (sourceUpdateTimes.length ? new Date(Math.max(...sourceUpdateTimes)).toISOString() : null);
  if (!derivedGeneratedAt) throw new TypeError("generatedAt or a valid history updatedAt is required");

  const series = {};
  for (const [id, entry] of sortedEntries(priceHistory.items)) {
    if (Array.isArray(entry?.points) && entry.points.length) {
      series[`price:${id}`] = seriesRecord(id, entry, "price", derivedGeneratedAt);
    }
  }
  for (const [id, entry] of sortedEntries(marketHistory.indexes)) {
    if (Array.isArray(entry?.points) && entry.points.length) {
      series[`market:${id}`] = seriesRecord(id, entry, "market", derivedGeneratedAt);
    }
  }
  for (const [id, entry] of sortedEntries(marketHistory.metrics)) {
    if (Array.isArray(entry?.points) && entry.points.length) {
      series[`metric:${id}`] = seriesRecord(id, entry, "metric", derivedGeneratedAt);
    }
  }

  return {
    schemaVersion: QUANT_HISTORY_SCHEMA_VERSION,
    generatedAt: derivedGeneratedAt,
    runId: runId || marketHistory.runId || priceHistory.runId || null,
    methodology: {
      horizons: QUANT_HORIZONS.map((item) => ({ ...item })),
      cadenceRules: Object.fromEntries(Object.entries(QUANT_CADENCE_RULES).map(([key, value]) => [key, { ...value }])),
      failClosed: true,
      sparseSeriesEligible: false,
      priceDefinition: "fixed-horizon endpoint return, CAGR for periods longer than one year, and maximum drawdown",
      rateDefinition: "absolute and percentage-point change between fixed-horizon endpoints",
      flowDefinition: "absolute and relative percentage change between fixed-horizon endpoints",
      cagrDefinition: "annualized by actual elapsed days; price series only",
      maxDrawdownDefinition: "largest peak-to-trough percentage in the eligible fixed horizon; price series only",
    },
    coverage: coverageSummary(series),
    series,
  };
}
