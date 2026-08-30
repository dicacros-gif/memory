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
// A percentage outside 0–100 used to return null, which dropped every row that
// depended on it — enter 999 for a saving rate and the TCO, ROI and payback
// cards vanished with nothing to say why. Out-of-range is a typo, not a reason
// to answer a different question in silence: it is clamped, and the clamp is
// reported so the card can show which number was actually used.
const ratioWith = (report) => (value, field, label) => {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const parsed = num(value);
  if (parsed === null) return null;
  const clamped = Math.min(100, Math.max(0, parsed));
  if (clamped !== parsed) {
    report({ field, label, reason: "범위 초과", entered: parsed, applied: clamped, unit: "%" });
  }
  return clamped / 100;
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
  // Values the reader typed that the model could not use as typed. The caller
  // marks the field; nothing here is silently substituted without an entry.
  const invalid = [];
  const reportInvalid = (entry) => {
    if (!invalid.some((item) => item.field === entry.field)) invalid.push(entry);
  };
  const ratio = ratioWith(reportInvalid);
  // Present-but-unusable is not the same as absent. Absent falls through to the
  // documented default; a number that cannot be a duration is refused, because
  // substituting one silently is how "0년" came to print a three-year total.
  const blank = (value) => value === undefined || value === null || String(value).trim() === "";
  const duration = (value, field, label, fallback) => {
    if (blank(value)) return fallback;
    const parsed = num(value);
    if (parsed !== null && parsed > 0) return parsed;
    reportInvalid({ field, label, reason: "기간은 0보다 커야 함", entered: parsed, applied: null, unit: "년" });
    return null;
  };
  const dailyQueriesM = positive(input.dailyQueriesMillions);
  const tokensPerQuery = positive(input.tokensPerQuery);
  const costPerMillionTokens = positive(input.costPerMillionTokens);
  const savingRate = ratio(input.tieringSavingPercent, "tieringSavingPercent", "계층화 절감률");
  const rackPowerKw = positive(input.rackPowerKw);
  const powerSavingRate = ratio(input.powerSavingPercent, "powerSavingPercent", "전력 절감률");
  const incrementalCapexM = positive(input.incrementalCapexMillions);
  const memoryShareRate = ratio(input.memoryShareOfSavingPercent, "memoryShareOfSavingPercent", "메모리 기여 비중");
  const winRate = ratio(input.targetWinSharePercent, "targetWinSharePercent", "목표 점유율");
  const bandwidthTBs = positive(input.bandwidthTBPerSecond);
  const capacityTB = positive(input.capacityTB);
  const systemCostM = positive(input.systemCostMillions);
  const powerPriceUsdPerKwh = positive(input.powerPriceUsdPerKwh);
  const horizonYears = duration(input.horizonYears, "horizonYears", "평가 기간", 3);
  const rackCount = positive(input.rackCount);
  const hbmGbPerRack = positive(input.hbmGbPerRack);
  const hbmAspUsdPerGb = positive(input.hbmAspUsdPerGb);
  const grossMarginRate = ratio(input.grossMarginPercent, "grossMarginPercent", "매출총이익률");
  const qualLeadMonths = positive(input.qualLeadMonths);
  const rampQuarters = positive(input.rampQuarters);
  const deployShareRate = ratio(input.deploySharePercent, "deploySharePercent", "계정 내 배포 지분");
  const supplyCapRacks = positive(input.supplyCapRacks);
  const hbmSharePercentRate = ratio(input.hbmSharePercent, "hbmSharePercent", "가정 HBM 배분율");
  const marginUpliftPoints = positive(input.marginUpliftPoints);
  const depreciationYears = duration(input.depreciationYears, "depreciationYears", "감가 연수", null);
  const hbm4eSharePercentRate = ratio(input.hbm4eSharePercent, "hbm4eSharePercent", "HBM4E 전환 비중");
  const hbm4ePremiumPercentRate = ratio(input.hbm4ePremiumPercent, "hbm4ePremiumPercent", "HBM4E 프리미엄");

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

  push("tco", horizonYears ? `TCO · ${horizonYears}년 기준` : "TCO", [
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
  // Two ramp factors come off one input, and they are deliberately different.
  //
  // Savings are a FLOW: what matters is the average attainment of the annual
  // run-rate across the first twelve months. Under a linear deployment the
  // exact average is 1 - Q/8 while the ramp finishes inside the year, and
  // 2/Q once it runs past it. The old form, min(1, 2/Q), returned exactly 1
  // for every Q <= 2 — no derate at all — while its comment claimed it
  // "never flatters the case". At Q=2 the truth is 0.75, so it flattered by a
  // third, on three of the calculator's presets.
  const rampAvgAttainment = rampQuarters
    ? (rampQuarters >= 4 ? 2 / rampQuarters : 1 - rampQuarters / 8)
    : null;
  // Revenue is a STOCK: the HBM content of the racks that ship. What matters
  // is the cumulative delivered share inside the year, which is 4/Q capped at
  // 1. At Q=4 every rack ships inside year one (1.0) while only half the
  // year's savings accrue (0.5) — the 2x gap is the stock-versus-flow
  // relation, not two premises disagreeing.
  const rampDeliveredShare = rampQuarters ? Math.min(1, 4 / rampQuarters) : null;
  const rampFactor = rampAvgAttainment;
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
      formula: "증분 CapEx ÷ (월 절감액 × 램프 평균가동 × 배포 지분) + 인증 리드타임",
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
  // A richer mix carries a richer margin. The cap belongs on the uplift, which
  // is a sales assumption, not on the base margin the user typed: the old
  // Math.min(0.75, base + uplift) silently rewrote an 80% input to 75% with no
  // basis stated anywhere in the code, the data or the tests. 20 points is the
  // same ceiling the product-mix buttons already apply when they fill this
  // field (assets/js/mbb-frames.js), so the model and the control now agree.
  const MARGIN_UPLIFT_CAP_POINTS = 20;
  const appliedMarginUplift = Math.min(MARGIN_UPLIFT_CAP_POINTS, marginUpliftPoints || 0);
  const effectiveMarginRate = grossMarginRate !== null
    ? Math.min(1, grossMarginRate + appliedMarginUplift / 100)
    : null;
  const hbmGrossProfit = hbmRevenue !== null && effectiveMarginRate !== null ? hbmRevenue * effectiveMarginRate : null;
  // A share of the fleet moving to HBM4E carries the published premium; the
  // rest stays at the current band.
  const hbm4eRevenue = hbmRevenue !== null && hbm4eSharePercentRate !== null && hbm4ePremiumPercentRate !== null
    ? hbmRevenue * (1 + hbm4eSharePercentRate * hbm4ePremiumPercentRate)
    : null;
  const hbm4eUplift = hbm4eRevenue !== null && hbmRevenue !== null ? hbm4eRevenue - hbmRevenue : null;
  // Year-one recognition shares the deploy share and the same linear-deployment
  // assumption as the payback, but takes the cumulative delivered share rather
  // than the average run-rate attainment the payback needs on a flow. Reading
  // the named factor rather than repeating the expression is what stops the
  // two from drifting apart in a later edit.
  const firstYearRevenue = hbmRevenue !== null && (rampQuarters || deployShareRate !== null)
    ? hbmRevenue * (rampDeliveredShare ?? 1) * (deployShareRate ?? 1)
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
      formula: "HBM 매출 × 램프 출하분 × 배포 지분",
      note: "전체 물량이 아니라 첫 해에 실제로 인식되는 몫 · 출하분(4÷램프분기, 최대 1)은 회수에 쓰는 평균가동과 다른 값",
    },
    supplyShortfallRacks !== null && {
      id: "supplyShortfall",
      label: "공급 제약으로 못 받는 랙",
      note: "우리 매출만 제한 · 고객이 얻는 절감액과 회수 기간에는 반영되지 않는다",
      value: round(supplyShortfallRacks, 0),
      unit: "rack",
      formula: "요구 랙 − 공급 상한 랙",
      note: "패키징·HBM 배분이 상한 · 이 몫은 수요가 있어도 매출이 되지 않음",
    },
    // Guarded on the profit row, not on the rate: num("") is 0, not null, so a
    // blank form yields a 0% rate rather than no rate. This row exists to
    // explain the profit below it, so it appears exactly when that does.
    hbmGrossProfit !== null && effectiveMarginRate !== null && {
      id: "appliedMargin",
      label: "적용 매출총이익률",
      value: round(effectiveMarginRate * 100, 1),
      unit: "%",
      formula: `입력 매출총이익률 + 제품 조합 가산(최대 ${MARGIN_UPLIFT_CAP_POINTS}%p)`,
      note: "이익 계산에 실제로 쓰인 값 · 가산 상한이 걸리면 여기서 보인다",
    },
    hbmGrossProfit !== null && {
      id: "hbmGrossProfit",
      label: "HBM 매출총이익",
      value: round(hbmGrossProfit / MILLION, 2),
      unit: "M USD",
      formula: "HBM 매출 × 적용 매출총이익률",
    },
    rackCost !== null && {
      id: "rackCost",
      label: "$ / rack · 요구 랙 기준",
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
      label: "메모리 귀속 절감액 · 이 계정 몫",
      value: round(sam, 2),
      unit: "M USD/yr",
      formula: "연간 절감액 × 메모리 기여 비중",
      note: "한 계정 절감액의 메모리 배분 · 시장 SAM이 아님",
    },
    som !== null && {
      id: "som",
      label: "수주 가능액 · 목표 점유 기준",
      value: round(som, 2),
      unit: "M USD/yr",
      formula: "메모리 귀속 절감액 × 목표 점유율",
      note: "Qualification을 통과할 수 있는 범위로 좁힌 값",
    },
  ]);

  return { groups, missing: [...new Set(missing)], invalid };
}

/**
 * The single sentence the numbers support, or nothing when they do not yet
 * support one.
 */
// The same three numbers the verdict line quotes, but kept apart so the UI can
// lead with the decision instead of burying it in a sentence. State is the
// executive read: approve inside the 12-month bar, redesign past it, pending
// while the inputs cannot support a payback at all.
// Payback bands, in months. The label says whose design is in question: a
// long payback is a statement about the customer's memory hierarchy, not a
// verdict on which of our products were selected — the old wording read as
// the second, which is how "Dell" and "재설계" ended up on the same card.
const BAND = [
  { limit: 11, state: "approve", decision: "구매 승인 기준 안 · 제안 가능", scope: "" },
  { limit: 18, state: "conditional", decision: "계층 구성 최적화로 승인 가능", scope: "고객 메모리 계층 조정 범위" },
  { limit: 36, state: "redesign", decision: "고객 메모리 계층(HBM·CXL·eSSD) 재설계 대상", scope: "SK 제품 조합이 아니라 고객 계층 설계" },
  { limit: Infinity, state: "hold", decision: "현 조건에서는 보류 · 전제 재확인", scope: "회수 기간이 평가 기간을 넘어섬" },
];

export function economicsDecision(result = {}) {
  const rows = new Map((result.groups || []).flatMap((group) => group.rows.map((row) => [row.id, row])));
  const effective = rows.get("effectivePayback");
  const payback = effective || rows.get("payback");
  const som = rows.get("som");
  const hbmRevenue = rows.get("hbmRevenue");
  const metrics = [];
  if (payback) metrics.push({ label: effective ? "실효 회수" : "단순 회수", value: String(payback.value), unit: "개월" });
  if (hbmRevenue) metrics.push({ label: "HBM 매출 add", value: String(hbmRevenue.value), unit: "M USD" });
  if (som) metrics.push({ label: "수주 가능액", value: String(som.value), unit: "M USD/yr" });
  if (!metrics.length) return null;

  // Two bands put a 12.8-month account and a 48-month one under the same
  // badge, so 22 of 27 presets read "재설계" and the badge stopped carrying
  // information. The bands below separate the case that needs a tier tweak
  // from the one that needs the customer's memory hierarchy rebuilt from the
  // one that is simply not a case yet.
  const months = payback ? Number(payback.value) : null;
  const band = months === null ? null : BAND.find((entry) => months <= entry.limit) || BAND[BAND.length - 1];
  const state = band ? band.state : "pending";
  const decision = band ? band.decision : "추가 입력 후 판단";
  const scope = band ? band.scope : "";

  // Every one of these is already computed above; the strip only surfaces
  // them, so the headline answers $/token, TCO, Perf/W and ROI without the
  // reader opening the full tables.
  const economics = ["proposedCostPerQuery", "proposedTco", "tokensPerKw", "bandwidthPerDollar", "capacityPerDollar", "roi"]
    .map((id) => rows.get(id))
    .filter(Boolean)
    .map((row) => ({ label: row.label, value: String(row.value), unit: row.unit || "" }));

  return { state, decision, scope, metrics, economics };
}

export function economicsVerdict(result = {}) {
  const decision = economicsDecision(result);
  if (!decision) return "";
  const parts = decision.metrics.map((metric) => (metric.label.endsWith("회수")
    ? `회수 ${metric.value}개월(${metric.label === "실효 회수" ? "실효" : "단순"})`
    : `${metric.label} ${metric.value}${metric.unit}`));
  return `${parts.join(" · ")} → ${decision.decision}`;
}
