/**
 * Verified strategy-chain derivation.
 *
 * Converts one observed company technology into the complete decision chain
 * the console is meant to answer.  It never invents a market size or a saving:
 * economics contains only the KPI that must be measured, and a row without a
 * direct source URL is not published.
 */

const DEMAND_SIDE_LAYERS = new Set([
  "end-customer",
  "oem-tier-1",
  "oem-tier-2",
  "oem-tier-3",
]);

const norm = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const day = (value) => String(value || "").slice(0, 10);
const tokens = (value) => new Set(norm(value).toLowerCase().split(/[^a-z0-9가-힣]+/).filter((item) => item.length >= 2));

function overlapScore(requirement = {}, pain = {}) {
  const need = tokens(`${requirement.productAxis} ${requirement.technology} ${requirement.memoryNeed}`);
  const answer = tokens(`${(pain.products || []).join(" ")} ${pain.answer}`);
  let score = 0;
  for (const token of need) if (answer.has(token)) score += 1;
  if (/hbm/i.test(requirement.productAxis || "") && /hbm/i.test((pain.products || []).join(" "))) score += 4;
  if (/nand|ssd/i.test(requirement.productAxis || "") && /nand|ssd/i.test((pain.products || []).join(" "))) score += 4;
  if (/dram|lpddr/i.test(requirement.productAxis || "") && /dram|socamm/i.test((pain.products || []).join(" "))) score += 3;
  if (/cxl/i.test(requirement.productAxis || "") && /cxl/i.test((pain.products || []).join(" "))) score += 4;
  return score;
}

function selectPain(requirement, painPoints = []) {
  return painPoints
    .map((pain) => ({ pain, score: overlapScore(requirement, pain) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.pain || null;
}

function upstreamOption(layer, requirement = {}) {
  if (layer === "asic-partner") return {
    painPoint: `${requirement.systemShift}에 맞춰 XPU·Base Die·PHY와 메모리 사양을 동시에 확정해야 함`,
    solution: `${requirement.productAxis} 공동설계 · 인터페이스·전력·열 Requirement Lock`,
    newBiz: "Custom Silicon·Memory 공동설계 Design Win",
    metric: "NRE 회수 · Qualification Lead Time · Design Win",
  };
  if (layer === "foundry-package") return {
    painPoint: `${requirement.systemShift}가 Package Yield·Capacity 일정과 동시에 걸림`,
    solution: `${requirement.productAxis}와 Logic·Package 공정의 공동 Ramp 계획`,
    newBiz: "Known-good-die·Package Capacity 연동 공급",
    metric: "Package Throughput · Yield · Ramp Lead Time",
  };
  return null;
}

/**
 * @returns {{schemaVersion, clientArtifact, runId, generatedAt, coverage, accounts, portfolio}}
 */
export function buildStrategyOpportunities({
  accounts = [],
  memoryDemand = {},
  painPoints = {},
  runId = null,
  now = new Date(),
} = {}) {
  const accountById = new Map(accounts.filter((item) => item?.id).map((item) => [item.id, item]));
  const out = {};
  const portfolio = new Map();
  let validated = 0;
  let watch = 0;

  for (const [accountId, row] of Object.entries(memoryDemand || {})) {
    const account = accountById.get(accountId);
    if (!account) continue;
    const layer = account.layer || "";
    const demandSide = DEMAND_SIDE_LAYERS.has(layer);
    const upstream = upstreamOption(layer, {});
    if (!demandSide && !upstream) continue;

    const chains = [];
    for (const requirement of row.requirements || []) {
      if (!/^https?:\/\//i.test(String(requirement.url || ""))) continue;
      const pain = demandSide
        ? selectPain(requirement, painPoints[accountId]?.painPoints || [])
        : upstreamOption(layer, requirement);
      if (!pain) continue;

      const evidenceCount = Math.max(1, Number(requirement.evidenceCount || requirement.seenCount || 1));
      const status = evidenceCount >= 2 && demandSide ? "validated" : "watch";
      if (status === "validated") validated += 1;
      else watch += 1;
      const chain = {
        id: `${accountId}:${norm(requirement.technology).toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-")}:${pain.id || layer}`,
        accountId,
        account: account.company || account.name || accountId,
        layer,
        status,
        statusLabel: status === "validated" ? "반복 근거" : "추가 검증",
        signal: `${requirement.technology} · ${requirement.hold || "관측"}`,
        systemShift: requirement.systemShift,
        painPoint: pain.pain || pain.painPoint,
        memoryRequirement: requirement.memoryNeed,
        productAxis: requirement.productAxis,
        solution: pain.answer || pain.solution,
        products: pain.products || [requirement.productAxis],
        newBiz: pain.newBiz,
        economics: pain.metric,
        executionGate: requirement.gate,
        stage: requirement.stage,
        evidence: {
          title: requirement.evidence,
          source: requirement.source || "원문",
          url: requirement.url,
          asOf: day(requirement.lastSeen || requirement.firstSeen),
          count: evidenceCount,
        },
      };
      chains.push(chain);

      if (status === "validated") {
        const key = `${chain.productAxis}:${chain.newBiz}`;
        const bucket = portfolio.get(key) || {
          productAxis: chain.productAxis,
          newBiz: chain.newBiz,
          economics: chain.economics,
          accounts: new Set(),
          technologies: new Set(),
          latestAt: "",
        };
        bucket.accounts.add(accountId);
        bucket.technologies.add(requirement.technology);
        if (chain.evidence.asOf > bucket.latestAt) bucket.latestAt = chain.evidence.asOf;
        portfolio.set(key, bucket);
      }
    }
    if (!chains.length) continue;
    const seen = new Set();
    out[accountId] = {
      opportunities: chains
        .sort((a, b) => (a.status === b.status ? String(b.evidence.asOf).localeCompare(String(a.evidence.asOf)) : a.status === "validated" ? -1 : 1))
        .filter((item) => {
          const key = `${item.painPoint}:${item.productAxis}:${item.newBiz}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 4),
    };
  }

  return {
    schemaVersion: "1.0",
    clientArtifact: true,
    runId,
    generatedAt: new Date(now).toISOString(),
    coverage: {
      accounts: Object.keys(out).length,
      validated,
      watch,
      policy: "direct-source; repeated-evidence-for-validation; no-invented-economics",
    },
    accounts: out,
    portfolio: [...portfolio.values()]
      .map((item) => ({
        ...item,
        accounts: [...item.accounts].sort(),
        accountCount: item.accounts.size,
        technologies: [...item.technologies].sort(),
      }))
      .sort((a, b) => b.accountCount - a.accountCount || String(b.latestAt).localeCompare(String(a.latestAt)))
      .slice(0, 12),
  };
}
