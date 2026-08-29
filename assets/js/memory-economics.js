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
  const powerPriceUsdPerKwh = positive(input.powerPriceUsdPerKwh);
  const horizonYears = positive(input.horizonYears) || 3;
  const rackCount = positive(input.rackCount);
  const hbmGbPerRack = positive(input.hbmGbPerRack);
  const hbmAspUsdPerGb = positive(input.hbmAspUsdPerGb);
  const grossMarginRate = ratio(input.grossMarginPercent);
  const qualLeadMonths = positive(input.qualLeadMonths);
  const rampQuarters = positive(input.rampQuarters);
  const deployShareRate = ratio(input.deploySharePercent);
  const supplyCapRacks = positive(input.supplyCapRacks);
  const hbmSharePercentRate = ratio(input.hbmSharePercent);
  const marginUpliftPoints = positive(input.marginUpliftPoints);
  const depreciationYears = positive(input.depreciationYears);
  const hbm4eSharePercentRate = ratio(input.hbm4eSharePercent);
  const hbm4ePremiumPercentRate = ratio(input.hbm4ePremiumPercent);

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

  const bandwidthPerKw = bandwidthTBs && rackPowerKw ? bandwidthTBs / rackPowerKw : null;
  const capacityPerKw = capacityTB && rackPowerKw ? capacityTB / rackPowerKw : null;

  push("physics", "PHYSICS · PER-WATT AND PER-DOLLAR", [
    bandwidthPerKw !== null && {
      id: "bandwidthPerKw",
      label: "Bandwidth / W",
      value: round(bandwidthPerKw, 3),
      unit: "TB/s per kW",
      formula: "시스템 대역폭 ÷ 랙 전력",
    },
    capacityPerKw !== null && {
      id: "capacityPerKw",
      label: "Capacity / W",
      value: round(capacityPerKw, 3),
      unit: "TB per kW",
      formula: "시스템 용량 ÷ 랙 전력",
    },
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

  /* --------------------------------------------------------------- TCO */

  // Baseline: what the workload costs to run today over the horizon, plus
  // the capex already planned. Proposed: the same workload with the tiered
  // memory configuration, less the power the freed headroom no longer draws.
  const horizonCost = annualCost !== null ? annualCost * horizonYears : null;
  const horizonSaving = annualSaving !== null ? annualSaving * horizonYears : null;
  const freedPowerValue = freedPowerKw !== null && powerPriceUsdPerKwh !== null
    ? freedPowerKw * 8760 * horizonYears * powerPriceUsdPerKwh
    : null;
  // The incremental capex sits on the proposed side only: it is what buys the saving.
  const baselineTco = horizonCost;
  const proposedTco = horizonCost !== null && horizonSaving !== null
    ? horizonCost - horizonSaving + (incrementalCapexM || 0) * MILLION - (freedPowerValue || 0)
    : null;
  // Hyperscalers moved server depreciation out to five to six years, so the
  // capex charged inside the horizon is the depreciated share, not all of it.
  const depreciatedCapex = incrementalCapexM && depreciationYears
    ? (incrementalCapexM * MILLION) * Math.min(1, horizonYears / depreciationYears)
    : null;
  const cohortTco = horizonCost !== null && horizonSaving !== null && depreciatedCapex !== null
    ? horizonCost - horizonSaving + depreciatedCapex - (freedPowerValue || 0)
    : null;
  const tcoSaving = baselineTco !== null && proposedTco !== null ? baselineTco - proposedTco : null;
  const tcoSavingRate = tcoSaving !== null && baselineTco ? tcoSaving / baselineTco : null;

  push("tco", `TCO · ${horizonYears}년 기준`, [
    baselineTco !== null && {
      id: "baselineTco",
      label: "기준 TCO",
      value: round(baselineTco / MILLION, 2),
      unit: "M USD",
      formula: "연간 추론 비용 × 기간",
    },
    proposedTco !== null && {
      id: "proposedTco",
      label: "메모리 계층화 적용 TCO",
      value: round(proposedTco / MILLION, 2),
      unit: "M USD",
      formula: "기준 TCO − 절감액 + 증분 CAPEX − 전력 절감 가치",
      note: powerPriceUsdPerKwh === null ? "전력 단가 미입력 · 전력 절감 가치는 제외하고 계산" : "",
    },
    cohortTco !== null && {
      id: "cohortTco",
      label: "감가 반영 TCO",
      value: round(cohortTco / MILLION, 2),
      unit: "M USD",
      formula: "기준 TCO − 절감액 + (증분 CapEx × 평가기간 ÷ 감가연수) − 전력 절감 가치",
      note: "서버 감가를 5~6년으로 늘린 정책을 반영 · 전액 즉시 비용화한 값과 구분",
    },
    tcoSaving !== null && {
      id: "tcoSaving",
      label: "절감액",
    value: round(tcoSaving / MILLION, 2),
      unit: "M USD",
      formula: "기준 TCO − 적용 TCO",
    },
    tcoSavingRate !== null && {
      id: "tcoSavingRate",
      label: "절감률",
      value: round(tcoSavingRate * 100, 1),
      unit: "%",
      formula: "절감액 ÷ 기준 TCO",
    },
    freedPowerValue !== null && {
      id: "freedPowerValue",
      label: `전력 절감 가치 · ${horizonYears}년 누적`,
      value: round(freedPowerValue / MILLION, 2),
      unit: "M USD",
      formula: "확보 전력 × 8,760h × 기간 × 전력 단가",
    },
  ]);
  // A ramp of N quarters delivers on average half of the annual saving in
  // year one, so the factor is bounded at 1 and never flatters the case.
  const rampFactor = rampQuarters ? Math.min(1, 1 / Math.max(1, rampQuarters / 2)) : null;
  const effectiveMonthlySaving = annualSaving !== null && (rampFactor !== null || deployShareRate !== null)
    ? (annualSaving / 12) * (rampFactor ?? 1) * (deployShareRate ?? 1)
    : null;
  const effectivePaybackMonths = effectiveMonthlySaving && incrementalCapexM
    ? (incrementalCapexM * MILLION) / effectiveMonthlySaving + (qualLeadMonths || 0)
    : null;

  push("investment", "INVESTMENT RETURN", [
    roi !== null && {
      id: "roi",
      label: "1년차 ROI",
      value: round(roi * 100, 1),
      unit: "%",
      formula: "(연간 절감액 − 증분 CapEx) ÷ 증분 CapEx",
    },
    effectivePaybackMonths !== null && {
      id: "effectivePayback",
      label: "실효 회수 기간",
      value: round(effectivePaybackMonths, 1),
      unit: "개월",
      formula: "증분 CapEx ÷ (월 절감액 × 램프 × 배포 지분) + 인증 리드타임",
      note: "재인증·램프·계정 내 배포 지분을 반영 · 단순 회수보다 이 값으로 승인받는다",
    },
    paybackMonths !== null && effectivePaybackMonths === null && {
      id: "payback",
      label: "회수 기간 · 이상값",
      value: round(paybackMonths, 1),
      unit: "개월",
      formula: "증분 CapEx ÷ 월 절감액",
      note: "인증·램프·배포 지분을 넣지 않은 상한 · 인증 리드타임과 램프를 입력하면 실효 회수로 대체된다",
    },
  ]);

  /* ------------------------------------------------------------ our position */

  const sam = annualSaving !== null && memoryShareRate !== null
    ? (annualSaving / MILLION) * memoryShareRate
    : null;
  const som = sam !== null && winRate !== null ? sam * winRate : null;

  // Demand asks for rackCount; packaging decides how many of them exist.
  const servedRacks = rackCount
    ? (supplyCapRacks ? Math.min(rackCount, supplyCapRacks) : rackCount)
    : null;
  const supplyShortfallRacks = rackCount && supplyCapRacks && rackCount > supplyCapRacks
    ? rackCount - supplyCapRacks
    : null;
  const hbmRevenue = servedRacks && hbmGbPerRack && hbmAspUsdPerGb
    ? servedRacks * hbmGbPerRack * hbmAspUsdPerGb * (hbmSharePercentRate ?? 1)
    : null;
  // A richer mix carries a richer margin: the uplift is added in points and
  // capped, so a full product stack cannot imply an implausible band.
  const effectiveMarginRate = grossMarginRate !== null
    ? Math.min(0.75, grossMarginRate + (marginUpliftPoints || 0) / 100)
    : null;
  const hbmGrossProfit = hbmRevenue !== null && effectiveMarginRate !== null ? hbmRevenue * effectiveMarginRate : null;
  // A share of the fleet moving to HBM4E carries the published premium; the
  // rest stays at the current band.
  const hbm4eRevenue = hbmRevenue !== null && hbm4eSharePercentRate !== null && hbm4ePremiumPercentRate !== null
    ? hbmRevenue * (1 + hbm4eSharePercentRate * hbm4ePremiumPercentRate)
    : null;
  const hbm4eUplift = hbm4eRevenue !== null && hbmRevenue !== null ? hbm4eRevenue - hbmRevenue : null;
  // Year-one recognition follows the same ramp and deploy share the payback
  // uses, so the two numbers cannot tell different stories.
  const firstYearRevenue = hbmRevenue !== null && (rampQuarters || deployShareRate !== null)
    ? hbmRevenue * (rampQuarters ? Math.min(1, 4 / rampQuarters) : 1) * (deployShareRate ?? 1)
    : null;
  const rackCost = systemCostM && rackCount ? (systemCostM * MILLION) / rackCount : null;

  const appliedAsp = hbmAspUsdPerGb;

  push("position", "OUR POSITION", [
    appliedAsp !== null && hbmRevenue !== null && {
      id: "appliedAsp",
      label: "적용 ASP",
      value: round(appliedAsp, 1),
      unit: "$ / GB",
      formula: "시나리오 적용 후 실제 계산에 쓰인 값",
      note: "화면 입력값이 아니라 이 값으로 매출이 계산된다",
    },
    servedRacks !== null && hbmRevenue !== null && {
      id: "servedRacks",
      label: "적용 랙 수",
      value: round(servedRacks, 0),
      unit: "rack",
      formula: "요구 랙과 공급 상한 중 작은 값",
    },
    hbmRevenue !== null && {
      id: "hbmRevenue",
      label: "HBM 매출 add-on",
      value: round(hbmRevenue / MILLION, 2),
      unit: "M USD",
      formula: "랙 수 × 랙당 HBM GB × GB당 ASP",
      note: "ASP는 브로커 추정 밴드 · HBM3E $17~18/GB → HBM4 $31~32/GB(NVIDIA)·$35~36/GB(기타 ASIC), 2027 $53/GB 전망",
    },
    hbm4eRevenue !== null && {
      id: "hbm4eRevenue",
      label: "HBM4E 전환 후 매출",
      value: round(hbm4eRevenue / MILLION, 2),
      unit: "M USD",
      formula: "HBM 매출 × (1 + 4E 비중 × 프리미엄)",
      note: "프리미엄은 공개 밴드 기준 가정 · 전환 비중은 입력값",
    },
    hbm4eUplift !== null && {
      id: "hbm4eUplift",
      label: "세대 전환 증분",
      value: round(hbm4eUplift / MILLION, 2),
      unit: "M USD",
      formula: "HBM4E 전환 후 매출 − 현행 매출",
    },
    firstYearRevenue !== null && {
      id: "firstYearRevenue",
      label: "1년차 인식 매출",
      value: round(firstYearRevenue / MILLION, 2),
      unit: "M USD",
      formula: "HBM 매출 × 램프 × 배포 지분",
      note: "전체 물량이 아니라 첫 해에 실제로 인식되는 몫",
    },
    supplyShortfallRacks !== null && {
      id: "supplyShortfall",
      label: "공급 제약으로 못 받는 랙",
      value: round(supplyShortfallRacks, 0),
      unit: "rack",
      formula: "요구 랙 − 공급 상한 랙",
      note: "패키징·HBM 배분이 상한 · 이 몫은 수요가 있어도 매출이 되지 않음",
    },
    hbmGrossProfit !== null && {
      id: "hbmGrossProfit",
      label: "HBM 매출총이익",
      value: round(hbmGrossProfit / MILLION, 2),
      unit: "M USD",
      formula: "HBM 매출 × 매출총이익률",
    },
    rackCost !== null && {
      id: "rackCost",
      label: "$ / rack",
      value: round(rackCost / 1000, 1),
      unit: "K USD",
      formula: "시스템 비용 ÷ 랙 수",
    },
    annualCost !== null && {
      id: "tam",
      label: "Account Serviceable · 이 고객의 연간 추론 지출",
      value: round(annualCost / MILLION, 2),
      unit: "M USD/yr",
      formula: "연간 추론 비용",
      note: "한 계정에서 다툴 수 있는 최대치 · 시장 전체 TAM이 아님",
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
// The same three numbers the verdict line quotes, but kept apart so the UI can
// lead with the decision instead of burying it in a sentence. State is the
// executive read: approve inside the 12-month bar, redesign past it, pending
// while the inputs cannot support a payback at all.
export function economicsDecision(result = {}) {
  const rows = new Map((result.groups || []).flatMap((group) => group.rows.map((row) => [row.id, row])));
  const effective = rows.get("effectivePayback");
  const payback = effective || rows.get("payback");
  const som = rows.get("som");
  const hbmRevenue = rows.get("hbmRevenue");
  const metrics = [];
  if (payback) metrics.push({ label: effective ? "실효 회수" : "단순 회수", value: String(payback.value), unit: "개월" });
  if (hbmRevenue) metrics.push({ label: "HBM 매출 add", value: String(hbmRevenue.value), unit: "M USD" });
  if (som) metrics.push({ label: "SOM", value: String(som.value), unit: "M USD/yr" });
  if (!metrics.length) return null;
  const state = payback ? (payback.value <= 12 ? "approve" : "redesign") : "pending";
  const decision = state === "approve"
    ? "구매 승인 기준 안 · 제안 가능"
    : state === "redesign"
      ? "회수 기간이 길어 계층 구성 재설계 필요"
      : "추가 입력 후 판단";
  return { state, decision, metrics };
}

export function economicsVerdict(result = {}) {
  const decision = economicsDecision(result);
  if (!decision) return "";
  const parts = decision.metrics.map((metric) => (metric.label.endsWith("회수")
    ? `회수 ${metric.value}개월(${metric.label === "실효 회수" ? "실효" : "단순"})`
    : `${metric.label} ${metric.value}${metric.unit}`));
  return `${parts.join(" · ")} → ${decision.decision}`;
}
