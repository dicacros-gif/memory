/** Evidence-linked strategy chain gate. */
import assert from "node:assert/strict";
import { buildStrategyOpportunities } from "./strategy-opportunities.mjs";

const requirement = (overrides = {}) => ({
  technology: "CXL",
  systemShift: "KV Cache가 GPU 밖의 공유 메모리 계층으로 이동",
  memoryNeed: "낮은 지연의 CXL 확장 메모리와 일관성 검증",
  productAxis: "CXL Pooling · PNM",
  stage: "PoC",
  gate: "Latency · Interoperability · TCO",
  hold: "반복",
  evidenceCount: 2,
  evidence: "공식 CXL 제품 발표",
  source: "Company Newsroom",
  url: "https://example.com/official-cxl",
  lastSeen: "2026-08-28",
  ...overrides,
});

const accounts = [
  { id: "nvidia", company: "NVIDIA", layer: "end-customer" },
  { id: "cxmt", company: "CXMT", layer: "memory-supplier" },
  { id: "marvell", company: "Marvell", layer: "asic-partner" },
];
const pain = {
  nvidia: { painPoints: [{
    id: "inference-kv-cache",
    pain: "Long-context 추론의 KV Cache 용량·지연 병목",
    answer: "CXL PNM으로 KV Cache offload",
    products: ["CXL", "PNM"],
    newBiz: "CXL PNM 공동 PoC",
    metric: "TTFT · Throughput/W · Cost/query",
  }] },
};

const built = buildStrategyOpportunities({
  accounts,
  memoryDemand: {
    nvidia: { requirements: [requirement()] },
    cxmt: { requirements: [requirement()] },
    marvell: { requirements: [requirement({ evidenceCount: 1 })] },
  },
  painPoints: pain,
  runId: "gate",
  now: new Date("2026-08-29T00:00:00Z"),
});

const nvidia = built.accounts.nvidia.opportunities[0];
assert.equal(nvidia.status, "validated");
for (const field of ["signal", "systemShift", "painPoint", "memoryRequirement", "newBiz", "economics", "executionGate"]) {
  assert.ok(nvidia[field], `validated chain must state ${field}`);
}
assert.equal(built.accounts.cxmt, undefined, "memory suppliers must not inherit buyer opportunity chains");
assert.equal(built.accounts.marvell.opportunities[0].status, "watch", "one upstream observation remains a watch item");
assert.equal(built.portfolio.length, 1, "only validated demand-side chains enter the portfolio roll-up");

const noLink = buildStrategyOpportunities({
  accounts: [accounts[0]],
  memoryDemand: { nvidia: { requirements: [requirement({ url: "" })] } },
  painPoints: pain,
});
assert.deepEqual(noLink.accounts, {}, "a requirement without a direct source URL must fail closed");

console.log(JSON.stringify({ status: "strategy-opportunities-pass", ...built.coverage }, null, 2));
