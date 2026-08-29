import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [frames, capital, baseline, accounts, strategySpine, policy, companySignals, companyBaseline, sourceCatalog, profile, painPointRules, chipRoadmap] = await Promise.all([
  read("data/mbb-frames.json"),
  read("data/capital-plans.json"),
  read("data/baseline.json"),
  read("data/accounts.json"),
  read("data/strategy-spine.json"),
  read("data/intelligence-policy.json"),
  read("data/company-signals.json"),
  read("data/company-baseline.json"),
  read("data/source-catalog.json"),
  read("assets/js/company-profile.js"),
  read("data/pain-point-rules.json"),
  read("data/chip-roadmap.json"),
]);
const publicCopy = `${frames}\n${capital}\n${baseline}\n${accounts}\n${strategySpine}\n${companyBaseline}`;
const baselineModel = JSON.parse(baseline);
const roadmapModel = JSON.parse(chipRoadmap);
const signalModel = JSON.parse(companySignals);
const collectStrings = (value, output = []) => {
  if (typeof value === "string") output.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, output));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => collectStrings(item, output));
  return output;
};

for (const unsupported of [
  "Amazon · HBM 직접 조달",
  "HBM 직접 조달 구조",
  "신규 Infra 가용화 12~24개월",
  "2027년 중반 Backorder",
  "8천 명 감원 후 자체 AI Infra 재배분",
  "외부 조달이 막힌 뒤 자체 인프라로 재배분",
  "토큰당 비용이 NVIDIA GPU 대비 50% 낮다고 주장",
  "Starlink Silicon · STARMIND",
  "High-endurance AI-N",
  "2026 Deployment",
  "Rubin Ultra 주력 SKU의 HBM 구성을 12-Hi 288GB에서 8-Hi 192GB로 축소 검토",
  "OPENAI · CFO",
  "컴퓨트가 가장 희소한 자원 (CFO)",
  "SpaceX 재계약 경유",
]) {
  assert.ok(!publicCopy.includes(unsupported), `unsupported claim must stay out of public copy: ${unsupported}`);
}

for (const unverifiedSignal of [
  "Jalapeño' 성능이 NVIDIA GB300을 능가",
  "Jalapeño AI 추론 칩 출시, 삼성이 HBM4 공급",
]) {
  assert.ok(!companySignals.includes(unverifiedSignal), `unverified secondary headline must stay out of structured signals: ${unverifiedSignal}`);
}

for (const value of collectStrings(signalModel)) {
  assert.doesNotMatch(value,
    /(?:Jalape(?:ño|n)o?).{0,160}(?:(?:Samsung|삼성).{0,50}HBM4|GB300.{0,50}(?:능가|outperform))/i,
    `unverified Jalapeño supplier or benchmark claim must fail closed: ${value}`);
}

for (const required of [
  "CXL Pooling · PNM",
  "처리량 최대 5.5×(1 GPU)",
  "3.6×(2 GPU)",
  "Micron·Samsung·SK hynix 3사 병렬 협력",
  "Jalapeño Engineering Sample",
  "SpaceX Colossus I/II",
  "Greg Brockman · President & Co-Founder",
  "약 32.5만 NVIDIA GPU",
  "월 12.5억$",
  "272MB SRAM",
  "SOCAMM2 · Server DRAM",
  "iHBM 열저항 30%↓",
  "M15X 장기 총투자 20조원 이상",
  "$500B+ 종합 이니셔티브",
  "1c LPDDR6 10.7Gbps+",
  "CXL PROCESSING-NEAR-MEMORY",
  "단일 GPU 대비 최대 5.5배",
  "GPU당 288GB HBM4·22TB/s",
  "MTIA 300 MEMORY",
  "TPU 8t · TPU 8i",
  "STARMIND · Vendor-agnostic Compute Module",
  "SpaceXAI · Grok",
]) {
  assert.ok(publicCopy.includes(required), `fact-corrected decision copy missing: ${required}`);
}

assert.ok(sourceCatalog.includes('"publishedAt": "2025-12-02"'),
  "Trainium4 NVLink Fusion source date must match the official 2025 announcement");
assert.ok(sourceCatalog.includes('"id": "marvell-skhynix-cmmax-2026"'),
  "CMM-Ax must be a governed official source");
assert.ok(sourceCatalog.includes('"id": "spacex-ai-prospectus-2026"'),
  "SpaceX AI ownership and Anthropic contract terms must use the official prospectus");
assert.ok(sourceCatalog.includes('"id": "openai-broadcom-10gw-2025"'),
  "OpenAI's 10GW deployment window must use the official collaboration announcement");
assert.match(profile, /\["PAIN POINT", row\.painPoint \|\| row\.constraint\]/,
  "company baseline UI must call the constraint a Pain Point");
assert.match(await read("scripts/company-directory.mjs"), /UNVERIFIED_PROFILE_EVIDENCE_RE/,
  "unsupported supplier and benchmark headlines must fail closed in company profiles");
assert.ok(!painPointRules.includes("3D 수직 적층"),
  "training pain response must separate current delivery from generic stacking language");
for (const unsupportedRoadmapClaim of ["LPDDR5X 192GB", "NVIDIA Rubin GPU + Vera CPU 탑재", "토큰당 비용 50% 절감 주장", "주력 SKU 8-Hi 192GB"]) {
  assert.ok(!chipRoadmap.includes(unsupportedRoadmapClaim), `unsupported roadmap claim must fail closed: ${unsupportedRoadmapClaim}`);
}
for (const value of collectStrings([baselineModel, roadmapModel])) {
  assert.doesNotMatch(value, /(?:HBM4.{0,50}12\s*Gbps|12\s*Gbps.{0,50}HBM4)/i,
    `12Gbps must not render as a generic HBM4 achieved speed or requirement: ${value}`);
}
const hbm4Speed = (baselineModel.kpis || []).find((row) => row.label === "HBM4 업체별 확인 속도");
assert.ok(hbm4Speed, "HBM4 speed KPI must be framed as vendor-confirmed values");
assert.deepEqual((hbm4Speed.sources || []).map((row) => `${row.vendor}:${row.speed}`),
  ["SK hynix:11.7Gbps", "Micron:>11Gbps"]);
assert.match(hbm4Speed.alt, /단일 속도 일괄 표기 금지/);
for (const governedRoadmapFact of [/TPU 8t[^\n]*Training/, /TPU 8i[^\n]*Inference/, /Vendor-agnostic Compute Module/, /AI4 대비 Memory Capacity 9배/]) {
  assert.match(chipRoadmap, governedRoadmapFact, `governed roadmap fact missing: ${governedRoadmapFact}`);
}
for (const executionAxis of ["Custom HBM", "CXL-PNM · CMM-Ax", "AI-NAND · QLC eSSD", "PIM · Hybrid Bonding"]) {
  assert.ok(strategySpine.includes(executionAxis), `technology execution axis missing: ${executionAxis}`);
}

for (const feed of [
  "skhynix-hbm4e-sample-2026",
  "skhynix-socamm2-production-2026",
  "skhynix-ihbm-thermal-2026",
  "marvell-cmm-ax-pnm-2026",
  "openai-jalapeno-2026",
  "anthropic-spacex-capacity-2026",
  "skhynix-dell-forum-2026",
  "skhynix-lpddr6-edge-2026",
]) {
  assert.ok(policy.includes(`\"id\": \"${feed}\"`), `missing governed official feed: ${feed}`);
}

console.log(JSON.stringify({ correctedClaims: 18, governedFeeds: 8 }));
