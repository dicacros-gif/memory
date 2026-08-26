const positive = (value) => Number.isFinite(Number(value)) && Number(value) > 0;
const percentage = (value) => positive(value) && Number(value) < 100;

export function calculateEconomics(input = {}) {
  const required = [
    input.dailyQueries,
    input.tokensPerQuery,
    input.costPerMillion,
    input.costReduction,
    input.incrementalCapex
  ];
  if (!required.every(positive) || !percentage(input.costReduction)) return null;

  const dailyQueries = Number(input.dailyQueries);
  const tokensPerQuery = Number(input.tokensPerQuery);
  const costPerMillion = Number(input.costPerMillion);
  const costReduction = Number(input.costReduction);
  const incrementalCapex = Number(input.incrementalCapex);
  const annualTokens = dailyQueries * 1_000_000 * tokensPerQuery * 365;
  const baselineAnnualCost = annualTokens / 1_000_000 * costPerMillion;
  const annualSaving = baselineAnnualCost * costReduction / 100;
  const proposedAnnualCost = baselineAnnualCost - annualSaving;
  const capex = incrementalCapex * 1_000_000;
  const baselineCostPerQuery = tokensPerQuery / 1_000_000 * costPerMillion;
  const proposedCostPerQuery = baselineCostPerQuery * (1 - costReduction / 100);

  const tamAccounts = Number(input.tamAccounts);
  const samAccounts = Number(input.samAccounts);
  const somAccounts = Number(input.somAccounts);
  const annualDealValue = Number(input.annualDealValue);
  const marketIsValid = [tamAccounts, samAccounts, somAccounts, annualDealValue].every(positive)
    && tamAccounts >= samAccounts && samAccounts >= somAccounts;

  const throughputQps = Number(input.throughputQps);
  const powerKw = Number(input.powerKw);
  const bandwidthGbps = Number(input.bandwidthGbps);
  const usableCapacityTb = Number(input.usableCapacityTb);
  const solutionCostMillion = Number(input.solutionCostMillion);
  const grossMargin = percentage(input.grossMargin) ? Number(input.grossMargin) : null;

  return {
    annualTokens,
    baselineAnnualCost,
    proposedAnnualCost,
    annualSaving,
    paybackMonths: capex / annualSaving * 12,
    threeYearRoi: (annualSaving * 3 - capex) / capex * 100,
    baselineCostPerQuery,
    proposedCostPerQuery,
    proposedCostPerMillion: costPerMillion * (1 - costReduction / 100),
    grossMargin,
    market: marketIsValid ? {
      tamMillion: tamAccounts * annualDealValue,
      samMillion: samAccounts * annualDealValue,
      somMillion: somAccounts * annualDealValue
    } : null,
    efficiency: {
      performancePerWatt: positive(throughputQps) && positive(powerKw) ? throughputQps / (powerKw * 1_000) : null,
      bandwidthPerMillion: positive(bandwidthGbps) && positive(solutionCostMillion) ? bandwidthGbps / solutionCostMillion : null,
      capacityPerMillion: positive(usableCapacityTb) && positive(solutionCostMillion) ? usableCapacityTb / solutionCostMillion : null
    }
  };
}
