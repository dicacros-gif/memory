/**
 * Memory economics.
 *
 * The board names the metrics a proposal is judged on — $/token, Performance/W,
 * Bandwidth/$, TCO, ROI, TAM/SAM/SOM — but naming them is not proving them.
 * This turns a customer baseline into those numbers, and every result carries
 * the formula that produced it so a reader can check the arithmetic rather than
 * trust the output.
 *
 * Fail-closed: a metric whose inputs are incomplete is omitted, never estimated
 * and never shown as zero.
 */

const MILLION = 1e6;
const BILLION = 1e9;

const num = (value) => {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
};
const positive = (value) => {
  const parsed = num(value);
  return parsed !== null && parsed > 0 ? parsed : null;
};
const ratio = (value) => {
  const parsed = num(value);
  return parsed !== null && parsed >= 0 && parsed <= 100 ? parsed / 100 : null;
};

const round = (value, digits = 2) => {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

/**
 * @param {object} input customer baseline, all optional
 * @returns {{groups: Array<{id, label, rows: Array<{id, label, value, unit, formula, note}>}>, missing: string[]}}
 */
export function computeMemoryEconomics(input = {}) {
  const dailyQueriesM = positive(input.dailyQueriesMillions);
  const tokensPerQuery = positive(input.tokensPerQuery);
  const costPerMillionTokens = positive(input.costPerMillionTokens);
  const savingRate = ratio(input.tieringSavingPercent);
  const rackPowerKw = positive(input.rackPowerKw);
  const powerSavingRate = ratio(input.powerSavingPercent);
  const incrementalCapexM = positive(input.incrementalCapexMillions);
  const memoryShareRate = ratio(input.memoryShareOfSavingPercent);
  const winRate = ratio(input.targetWinSharePercent);
  const bandwidthTBs = positive(input.bandwidthTBPerSecond);
  const capacityTB = positive(input.capacityTB);
  const systemCostM = positive(input.systemCostMillions);

  const missing = [];
  const need = (condition, label) => {
    if (!condition) missing.push(label);
    return condition;
  };

  const groups = [];
  const push = (id, label, rows) => {
    const kept = rows.filter((row) => row && row.value !== null && row.value !== undefined);
    if (kept.length) groups.push({ id, label, rows: kept });
  };

  /* --------------------------------------------------------- workload volume */

  const dailyTokens = dailyQueriesM && tokensPerQuery ? dailyQueriesM * MILLION * tokensPerQuery : null;
  const annualTokens = dailyTokens !== null ? dailyTokens * 365 : null;
  need(annualTokens !== null, "일일 Query · Query당 Token");

  push("volume", "WORKLOAD VOLUME", [
    dailyTokens !== null && {
      id: "dailyTokens",
      label: "일일 Token",
      value: round(dailyTokens / BILLION, 2),
      unit: "B tokens/day",
      formula: "일일 Query × Query당 Token",
    },
    annualTokens !== null && {
      id: "annualTokens",
      label: "연간 Token",
      value: round(annualTokens / BILLION, 1),
      unit: "B tokens/yr",
      formula: "일일 Token × 365",
    },
  ]);

  /* ------------------------------------------------------------- unit economics */

  const annualCost = annualTokens !== null && costPerMillionTokens
    ? (annualTokens / MILLION) * costPerMillionTokens
    : null;
  need(annualCost !== null, "현재 $ / 1M Token");

  const costPerQuery = costPerMillionTokens && tokensPerQuery
    ? (costPerMillionTokens / MILLION) * tokensPerQuery
    : null;
  const costPerToken = costPerMillionTokens ? costPerMillionTokens / MILLION : null;

  const proposedCostPerMillion = costPerMillionTokens && savingRate !== null
    ? costPerMillionTokens * (1 - savingRate)
    : null;
  const annualSaving = annualCost !== null && savingRate !== null ? annualCost * savingRate : null;
  const proposedCostPerQuery = proposedCostPerMillion && tokensPerQuery
    ? (proposedCostPerMillion / MILLION) * tokensPerQuery
    : null;

  push("unit", "UNIT ECONOMICS", [
    costPerToken !== null && {
      id: "costPerToken",
      label: "$ / token",
      value: round(costPerToken, 8),
      unit: "USD",
      formula: "$ / 1M Token ÷ 1,000,000",
    },
    costPerQuery !== null && {
      id: "costPerQuery",
      label: "$ / query",
      value: round(costPerQuery, 6),
      unit: "USD",
      formula: "$ / token × Query당 Token",
    },
    proposedCostPerQuery !== null && {
      id: "proposedCostPerQuery",
      label: "$ / query · 계층화 후",
      value: round(proposedCostPerQuery, 6),
      unit: "USD",
      formula: "$ / query × (1 − 절감률)",
    },
    annualCost !== null && {
      id: "annualCost",
      label: "연간 추론 비용",
      value: round(annualCost / MILLION, 2),
      unit: "M USD/yr",
      formula: "연간 Token ÷ 1M × $ / 1M Token",
    },
    annualSaving !== null && {
      id: "annualSaving",
      label: "연간 절감액",
      value: round(annualSaving / MILLION, 2),
      unit: "M USD/yr",
      formula: "연간 추론 비용 × 절감률",
    },
  ]);

  /* ----------------------------------------------------------------- physics */

  const freedPowerKw = rackPowerKw && powerSavingRate !== null ? rackPowerKw * powerSavingRate : null;
  const addedRacks = rackPowerKw && freedPowerKw !== null ? freedPowerKw / rackPowerKw : null;
  const bandwidthPerMillion = bandwidthTBs && systemCostM ? bandwidthTBs / systemCostM : null;
  const capacityPerMillion = capacityTB && systemCostM ? capacityTB / systemCostM : null;
  const tokensPerKwYear = annualTokens !== null && rackPowerKw ? annualTokens / (rackPowerKw * 8760) : null;

  push("physics", "PHYSICS · PER-WATT AND PER-DOLLAR", [
    freedPowerKw !== null && {
      id: "freedPower",
      label: "확보 전력",
      value: round(freedPowerKw, 1),
      unit: "kW/rack",
      formula: "랙 전력 × 전력 절감률",
    },
    addedRacks !== null && {
      id: "addedRacks",
      label: "추가 배치 가능",
      value: round(addedRacks, 2),
      unit: "rack / 기존 rack",
      formula: "확보 전력 ÷ 랙 전력",
      note: "전력이 확장을 먼저 제한하는 계정에서 절감을 매출 가능 용량으로 환산",
    },
    tokensPerKwYear !== null && {
      id: "tokensPerKw",
      label: "Performance/W",
      value: round(tokensPerKwYear / MILLION, 2),
      unit: "M tokens / kW·yr",
      formula: "연간 Token ÷ (랙 전력 × 8,760h)",
    },
    bandwidthPerMillion !== null && {
      id: "bandwidthPerDollar",
      label: "Bandwidth / $",
      value: round(bandwidthPerMillion, 3),
      unit: "TB/s per $1M",
      formula: "시스템 대역폭 ÷ 시스템 비용",
    },
    capacityPerMillion !== null && {
      id: "capacityPerDollar",
      label: "Capacity / $",
      value: round(capacityPerMillion, 2),
      unit: "TB per $1M",
      formula: "시스템 용량 ÷ 시스템 비용",
    },
  ]);

  /* -------------------------------------------------------------- investment */

  const roi = annualSaving !== null && incrementalCapexM
    ? (annualSaving / MILLION - incrementalCapexM) / incrementalCapexM
    : null;
  const paybackMonths = annualSaving !== null && incrementalCapexM && annualSaving > 0
    ? (incrementalCapexM / (annualSaving / MILLION)) * 12
    : null;

  push("investment", "INVESTMENT RETURN", [
    roi !== null && {
      id: "roi",
      label: "1년차 ROI",
      value: round(roi * 100, 1),
      unit: "%",
      formula: "(연간 절감액 − 증분 CapEx) ÷ 증분 CapEx",
    },
    paybackMonths !== null && {
      id: "payback",
      label: "회수 기간",
      value: round(paybackMonths, 1),
      unit: "개월",
      formula: "증분 CapEx ÷ 월 절감액",
      note: "고객 구매 승인 기준 안에 들어오는지가 채택을 가름",
    },
  ]);

  /* ------------------------------------------------------------ our position */

  const sam = annualSaving !== null && memoryShareRate !== null
    ? (annualSaving / MILLION) * memoryShareRate
    : null;
  const som = sam !== null && winRate !== null ? sam * winRate : null;

  push("position", "OUR POSITION", [
    annualCost !== null && {
      id: "tam",
      label: "TAM · 이 계정의 연간 추론 지출",
      value: round(annualCost / MILLION, 2),
      unit: "M USD/yr",
      formula: "연간 추론 비용",
      note: "계정 단위 상한 · 시장 전체가 아니라 이 고객에서 다툴 수 있는 최대치",
    },
    sam !== null && {
      id: "sam",
      label: "SAM · 메모리로 회수 가능한 몫",
      value: round(sam, 2),
      unit: "M USD/yr",
      formula: "연간 절감액 × 메모리 기여 비중",
    },
    som !== null && {
      id: "som",
      label: "SOM · 목표 점유 기준 수주 가능액",
      value: round(som, 2),
      unit: "M USD/yr",
      formula: "SAM × 목표 점유율",
      note: "Qualification을 통과할 수 있는 범위로 좁힌 값",
    },
  ]);

  return { groups, missing: [...new Set(missing)] };
}

/**
 * The single sentence the numbers support, or nothing when they do not yet
 * support one.
 */
export function economicsVerdict(result = {}) {
  const rows = new Map((result.groups || []).flatMap((group) => group.rows.map((row) => [row.id, row])));
  const payback = rows.get("payback");
  const som = rows.get("som");
  const addedRacks = rows.get("addedRacks");
  if (!payback && !som) return "";

  const parts = [];
  if (payback) parts.push(`회수 ${payback.value}개월`);
  if (addedRacks) parts.push(`랙당 ${addedRacks.value}배 증설 여력`);
  if (som) parts.push(`수주 가능 ${som.value}M USD/yr`);
  if (!parts.length) return "";

  const verdict = payback && payback.value <= 18
    ? "구매 승인 기준 안 · 제안 가능"
    : payback
      ? "회수 기간이 길어 계층 구성 재설계 필요"
      : "추가 입력 후 판단";
  return `${parts.join(" · ")} → ${verdict}`;
}
