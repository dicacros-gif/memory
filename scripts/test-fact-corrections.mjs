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
]) {
  assert.ok(!publicCopy.includes(unsupported), `unsupported claim must stay out of public copy: ${unsupported}`);
}

for (const unverifiedSignal of [
  "Jalapeño' 성능이 NVIDIA GB300을 능가",
  "Jalapeño AI 추론 칩 출시, 삼성이 HBM4 공급",
]) {
  assert.ok(!companySignals.includes(unverifiedSignal), `unverified secondary headline must stay out of structured signals: ${unverifiedSignal}`);
}

for (const required of [
  "CXL Pooling · PNM",
  "처리량 최대 5.5×(1 GPU)",
  "3.6×(2 GPU)",
  "Micron·Samsung·SK hynix 3사 병렬 협력",
  "Jalapeño Engineering Sample",
  "SpaceX Colossus 1",
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
]) {
  assert.ok(publicCopy.includes(required), `fact-corrected decision copy missing: ${required}`);
}

assert.ok(sourceCatalog.includes('"publishedAt": "2025-12-02"'),
  "Trainium4 NVLink Fusion source date must match the official 2025 announcement");
assert.ok(sourceCatalog.includes('"id": "marvell-skhynix-cmmax-2026"'),
  "CMM-Ax must be a governed official source");
assert.match(profile, /\["PAIN POINT", row\.painPoint \|\| row\.constraint\]/,
  "company baseline UI must call the constraint a Pain Point");
assert.match(await read("scripts/company-directory.mjs"), /UNVERIFIED_PROFILE_EVIDENCE_RE/,
  "unsupported supplier and benchmark headlines must fail closed in company profiles");
assert.ok(!painPointRules.includes("3D 수직 적층"),
  "training pain response must separate current delivery from generic stacking language");
for (const unsupportedRoadmapClaim of ["LPDDR5X 192GB", "NVIDIA Rubin GPU + Vera CPU 탑재", "토큰당 비용 50% 절감 주장", "주력 SKU 8-Hi 192GB"]) {
  assert.ok(!chipRoadmap.includes(unsupportedRoadmapClaim), `unsupported roadmap claim must fail closed: ${unsupportedRoadmapClaim}`);
}
for (const governedRoadmapFact of ["TPU 8t (Training)", "TPU 8i (Inference)", "Vendor-agnostic Compute Module", "AI4 대비 Memory Capacity 9배"]) {
  assert.ok(chipRoadmap.includes(governedRoadmapFact), `governed roadmap fact missing: ${governedRoadmapFact}`);
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
