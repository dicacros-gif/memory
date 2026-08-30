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
const [app, consoleCapital] = await Promise.all([
  read("assets/js/app.js"),
  read("data/console-capital-plans.json"),
]);
const consoleDecisionCopy = consoleCapital;
const baselineModel = JSON.parse(baseline);
const roadmapModel = JSON.parse(chipRoadmap);
const framesModel = JSON.parse(frames);
const signalModel = JSON.parse(companySignals);
const capitalModel = JSON.parse(consoleCapital);
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
  "MTIA 400(Iris)",
  "2026-09 양산",
]) {
  assert.ok(!publicCopy.includes(unsupported), `unsupported claim must stay out of public copy: ${unsupported}`);
}
assert.doesNotMatch(consoleDecisionCopy, /(?:OpenAI.{0,180})?(?:컴퓨트 지출 500억|연 500억 달러|매출 대비 2배|매출의 2배)/,
  "unverified OpenAI spend and revenue-multiple claims must stay out of console decision content");
assert.match(consoleCapital, /OpenAI InferenceX 측정 · 공개 3개 모델에서 Peak AI work\/W 1\.5~1\.9배 · End-to-end latency 1\.7~3\.6배/,
  "OpenAI must use its official measured Jalapeño results");
assert.match(capitalModel.plans.openai.capex, /배치 시작 목표/,
  "OpenAI's H2 2026 deployment must remain a target rather than a completed fact");
assert.match(capitalModel.plans.openai.plan, /배치 시작 계획/,
  "OpenAI's year-end deployment must remain a plan rather than a completed fact");
assert.doesNotMatch(app, /UNSUPPORTED_JALAPENO_BENCHMARK_RE[^\n]*(?:1\[\.,\]5|1\.5)[^\n]*(?:1\[\.,\]9|1\.9)/,
  "the runtime sanitizer must not discard OpenAI's first-party Jalapeño measurements");
assert.match(app, /UNSUPPORTED_JALAPENO_BENCHMARK_RE = \/\(\?:gb200\|gb300\)/,
  "the runtime sanitizer must still block unsupported GB200/GB300 outperformance claims");
assert.match(consoleCapital, /메모리 공급사·최종 성능 미공개|Production Qualification·Memory 구성/,
  "OpenAI demand conversion must remain gated on disclosed production facts");
assert.match(consoleCapital, /Anthropic 5\/6 공식 발표[\s\S]*?SpaceX 6\/4 공시 · 계약 범위/,
  "Anthropic's service-limit announcement and the later SpaceX contract filing must remain separate");
assert.equal(capitalModel.plans.anthropic.capitalLabel, "CAPACITY PORTFOLIO",
  "third-party capacity commitments must not be presented as Anthropic CapEx");
assert.match(capitalModel.plans.anthropic.contractBoundary, /월 12\.5억\$[\s\S]*2029년 5월[\s\S]*90일 통지 해지 가능/,
  "the SpaceX contract term and termination boundary must remain visible");
assert.match(profile, /plan\.capitalLabel \|\| "CAPEX"/,
  "the company profile must render the correct capital label");
assert.match(profile, /plan\.contractLabel \|\| "CONTRACT BOUNDARY"/,
  "the company profile must render the contract-boundary label in console mode");
assert.match(profile, /state\.consoleMode \? plan\.contractBoundary : null/,
  "the company profile must render the contract boundary rather than hiding it in JSON");
assert.match(consoleCapital, /https:\/\/openai\.com\/index\/jalapeno-first-results\//,
  "Jalapeño results must link to OpenAI's first-party benchmark disclosure");
assert.match(consoleCapital, /https:\/\/www\.anthropic\.com\/news\/higher-limits-spacex/,
  "Anthropic capacity effects must link to the first-party announcement");
assert.match(consoleCapital, /https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/1181412\/000162828026041013\/japanfwp_06042026\.htm/,
  "later SpaceX contract terms must link to the filing rather than media summaries");
assert.match(consoleCapital, /공급·캐파 약정 2,790억\$[\s\S]*?주로 메모리와 제조 시설[\s\S]*?HBM 단독 금액이나 특정 공급사 물량 아님/,
  "NVIDIA commitments must be decision-useful without being misread as HBM-only demand");
assert.match(companyBaseline, /공급·캐파 약정 2,790억\$\(10-Q · 주로 메모리 및 제조시설 · HBM 단독 금액 아님\)/,
  "the company baseline must preserve the filing boundary instead of calling $279B memory procurement");
assert.doesNotMatch(companyBaseline, /2,790억\$\(10-Q, 주로 메모리 조달\)/,
  "the company baseline must not collapse memory and manufacturing-facility commitments into HBM demand");
assert.match(consoleCapital, /FY27 잔여 920억\$ · FY28 870억\$ · FY29 880억\$ · FY30 이후 합계 120억\$/,
  "NVIDIA commitments must expose the filed maturity schedule rather than a single headline total");
assert.match(consoleCapital, /https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/1045810\/000104581026000075\/nvda-20260726\.htm/,
  "NVIDIA commitments must link to the filed 10-Q");
assert.deepEqual(capitalModel.plans.google.sources.map((row) => row.url), [
  "https://s206.q4cdn.com/479360582/files/doc_events/2026/Jul/22/2026_Q2_Earnings_Transcript.pdf",
  "https://www.sec.gov/Archives/edgar/data/1652044/000165204426000071/goog-20260630.htm",
  "https://blog.google/company-news/inside-google/message-ceo/alphabet-earnings-q2-2026/",
  "https://cloud.google.com/blog/products/compute/tpu-8t-and-tpu-8i-technical-deep-dive",
], "Google financial and TPU claims must bind to their own first-party sources");
assert.match(capitalModel.plans.google.capex, /Q2 실제 CapEx 449억\$/,
  "Google's forward guidance must be paired with the filed Q2 actual rather than a TPU source");
assert.match(publicCopy, /Vera Rubin NVL72/,
  "the official NVIDIA Vera Rubin NVL72 product name must remain visible");
assert.ok(!publicCopy.includes("NVL144"),
  "the non-official NVL144 product name must stay out of public copy");
assert.match(publicCopy, /FY26 Q4\(2026-07-29\) 공식 · CY2026 CapEx 약 1,750억\$/,
  "Microsoft's $175B CY2026 capex expectation must be dated to FY26 Q4");
assert.doesNotMatch(publicCopy, /FY26 Q3.{0,80}1,750억\$/,
  "Microsoft's $175B CY2026 capex expectation must not be attributed to FY26 Q3");

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
  // The multiple is each configuration measured against itself without CMM-Ax,
  // not against a smaller GPU count. "5.5×(1 GPU)" left that ambiguous and read
  // as a solution that gets worse as the cluster grows.
  "1-GPU 구성 5.5×",
  "2-GPU 구성 3.6×",
  "각 구성의 미적용 대비",
  "Micron·Samsung·SK hynix 3사 병렬 협력",
  "Jalapeño Engineering Sample",
  "SpaceX Colossus 1 전체 Compute Capacity",
  "300MW+ · NVIDIA GPU 22만+",
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
  "H100 1-GPU 구성 최대 5.5×",
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
assert.ok(!(baselineModel.kpis || []).some((row) => row.label === "HBM4 업체별 확인 속도"),
  "unlike vendor HBM4 disclosures must not be combined into one baseline KPI");
const economicsFrame = (framesModel.frames || []).find((frame) => frame.id === "economics-calculator");
assert.equal(economicsFrame?.publicPresetLimit, 1,
  "the public economics board must expose one transparent worked example rather than customer-looking assumptions");
assert.match(economicsFrame?.presets?.[0]?.note || "", /공개 고객 실적이나 계약 수치가 아님/,
  "the worked example must identify modeled inputs before showing calculated outputs");
for (const retiredMarketModule of ["주가 변동성(리스크)", "메모리 사이클 수익성 전망", "HBM4/루빈 점유 전망(시점별)"]) {
  assert.ok(!chipRoadmap.includes(retiredMarketModule), `scope-divergent market module must stay retired: ${retiredMarketModule}`);
}
assert.match(app, /filter\(\(item\) => !isChinaArticle\(item\)\)/,
  "the public strategy news stream must exclude the retired China fab, policy, and talent scope");
const numberDecisionBlueprint = app.match(/const NUMBER_DECISION_BLUEPRINT = \[[\s\S]*?\n  \];\n  const SECTION_LABELS/)?.[0] || "";
assert.doesNotMatch(numberDecisionBlueprint, /CXMT|YMTC|중국 메모리/,
  "the public number-led decision board must stay inside the AI-memory customer, platform, and supply scope");
assert.match(app, /controls\.hidden = true;[\s\S]{0,120}panels\.hidden = true;/,
  "the partner ecosystem must suppress the retired equity index panels");
for (const governedRoadmapFact of [/TPU 8t[^\n]*Training/, /TPU 8i[^\n]*Inference/, /Vendor-agnostic Compute Module/, /AI4 대비 Memory Capacity 9배/]) {
  assert.match(chipRoadmap, governedRoadmapFact, `governed roadmap fact missing: ${governedRoadmapFact}`);
}
for (const executionAxis of [
  "Custom HBM",
  "CXL 메모리 풀링 · Niagara 2.0",
  "CXL-PNM · CMM-Ax",
  "PIM · GDDR6-AiM · AiMX",
  "3D Stacked DRAM · Hybrid Bonding",
  "AI-NAND · QLC eSSD · HBF",
]) {
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
  "skhynix-pim-aimx",
  "skhynix-cxl-niagara",
]) {
  assert.ok(policy.includes(`\"id\": \"${feed}\"`), `missing governed official feed: ${feed}`);
}

console.log(JSON.stringify({ correctedClaims: 22, governedFeeds: 10 }));
