import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [frames, capital, baseline, accounts, strategySpine, policy, companySignals] = await Promise.all([
  read("data/mbb-frames.json"),
  read("data/capital-plans.json"),
  read("data/baseline.json"),
  read("data/accounts.json"),
  read("data/strategy-spine.json"),
  read("data/intelligence-policy.json"),
  read("data/company-signals.json"),
]);
const publicCopy = `${frames}\n${capital}\n${baseline}\n${accounts}\n${strategySpine}`;

for (const unsupported of [
  "Amazon · HBM 직접 조달",
  "HBM 직접 조달 구조",
  "신규 Infra 가용화 12~24개월",
  "2027년 중반 Backorder",
  "8천 명 감원 후 자체 AI Infra 재배분",
  "외부 조달이 막힌 뒤 자체 인프라로 재배분",
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
]) {
  assert.ok(publicCopy.includes(required), `fact-corrected decision copy missing: ${required}`);
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

console.log(JSON.stringify({ correctedClaims: 11, governedFeeds: 8 }));
