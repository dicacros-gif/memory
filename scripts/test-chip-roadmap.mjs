/**
 * Chip roadmap gate.
 *
 * Collapsing a programme's generations into one line erased the attach curve:
 * a part that ships every six months changes capacity and bandwidth each time,
 * and carrying the previous generation's capacity forward invents an attach
 * curve. So the gate holds that generations stay separate, that an unconfirmed
 * cell says it is unconfirmed rather than being filled with a report, and that
 * every claimed spec is checkable.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildConsoleRoadmapArtifact } from "./crawl.mjs";

const roadmap = JSON.parse(await readFile(new URL("../data/chip-roadmap.json", import.meta.url), "utf8"));
const consoleRoadmap = JSON.parse(await readFile(new URL("../data/console-chip-roadmap.json", import.meta.url), "utf8"));
const consoleRoadmapSource = JSON.parse(await readFile(new URL("../data/console-chip-roadmap-source.json", import.meta.url), "utf8"));
const accountModel = JSON.parse(await readFile(new URL("../data/accounts.json", import.meta.url), "utf8"));
const profile = await readFile(new URL("../assets/js/company-profile.js", import.meta.url), "utf8");
const directory = await readFile(new URL("./company-directory.mjs", import.meta.url), "utf8");

const accounts = roadmap.accounts || {};
assert.ok(Object.keys(accounts).length >= 6, "the matrix must cover the accounts whose generations matter");

const known = new Set((accountModel.accounts || []).map((row) => row.id));
let generations = 0;

const evidenceFields = ["hbm", "bandwidth", "ramp", "attach", "roleSplit", "supplierDisclosure", "hbmDemand"];
const fieldSuffixes = ["Url", "AsOf", "Class", "Basis"];
for (const [accountId, account] of Object.entries(consoleRoadmapSource.accounts || {})) {
  for (const generation of account.generations || []) {
    for (const field of evidenceFields) {
      if (generation[field] == null || generation[field] === "") continue;
      for (const suffix of fieldSuffixes) {
        assert.ok(generation[`${field}${suffix}`],
          `${accountId}/${generation.name}/${field} must carry field-specific ${suffix}`);
      }
    }
  }
}

const sourceGeneration = (accountId, predicate) =>
  (consoleRoadmapSource.accounts?.[accountId]?.generations || []).find(predicate);

// Source-boundary regressions: first-party announcements must retain their
// qualifiers, programme targets and benchmark conditions before client build.
const sourceNvhbm = sourceGeneration("nvidia", (row) => row.name === "NVHBM");
assert.match(sourceNvhbm?.bandwidth || "", /대역폭 최대 \+30%/);
assert.match(sourceNvhbm?.bandwidth || "", /면적 최대 \+25%/);
assert.match(sourceNvhbm?.ramp || "", /양산·Qualification 일정 미공개/);
assert.doesNotMatch(`${sourceNvhbm?.status} ${sourceNvhbm?.attach}`, /양산|생산 가능한/,
  "NVHBM's architecture announcement must not imply qualified production");

const sourceSocamm = sourceGeneration("nvidia", (row) => row.name.startsWith("SOCAMM"));
assert.match(sourceSocamm?.attach || "", /GPU HBM 구성과 별도 검증/);
assert.doesNotMatch(sourceSocamm?.attach || "", /HBM4 20\.7TB는 불변/,
  "a reported SOCAMM capacity change must not certify an independent GPU HBM configuration");

const sourceMtiaRoadmap = sourceGeneration("meta", (row) => row.name.includes("MTIA 400"));
assert.equal(sourceMtiaRoadmap?.name, "MTIA 400 · 450 · 500");
assert.doesNotMatch(`${sourceMtiaRoadmap?.name} ${sourceMtiaRoadmap?.ramp}`, /Iris|2026-09|2026 Q4/,
  "Meta's official roadmap must not inherit unofficial codenames or exact deployment dates");
assert.equal(sourceMtiaRoadmap?.rampAsOf, "2026-03-11");
assert.match(sourceMtiaRoadmap?.ramp || "", /근시일~2027년/);

const sourceAnthropicCompute = sourceGeneration("aws", (row) => row.name === "Trainium2 · Trainium3");
assert.match(sourceAnthropicCompute?.ramp || "", /2026년 말까지.*약 1GW.*목표/);
assert.equal(sourceAnthropicCompute?.rampBasis, "program-target");
assert.equal(sourceAnthropicCompute?.rampAsOf, "2026-04-20");

const sourceAwsGpuPlan = sourceGeneration("aws", (row) => row.name.startsWith("NVIDIA GPU"));
assert.match(sourceAwsGpuPlan?.ramp || "", /2027~2028년.*200만 개.*계획/);
assert.equal(sourceAwsGpuPlan?.status, "공식 계획");
assert.equal(sourceAwsGpuPlan?.rampAsOf, "2026-08-26");

const sourceJalapeno = sourceGeneration("openai", (row) => row.name.startsWith("Jalapeño"));
assert.match(sourceJalapeno?.bandwidth || "", /비교 시스템 대비/);
assert.match(sourceJalapeno?.bandwidth || "", /GPT-OSS↔GB200/);
assert.match(sourceJalapeno?.bandwidth || "", /DeepSeek-R1·Kimi K2↔GB300/);
assert.match(sourceJalapeno?.bandwidth || "", /8k input\/1k output.*package TDP 정규화/);
assert.match(sourceJalapeno?.hbm || "", /공급사 미공개/);

const sourceBroadcom2nm = sourceGeneration("broadcom", (row) => row.name.includes("3.5D XDSiP"));
assert.match(sourceBroadcom2nm?.ramp || "", /2026-02.*Fujitsu.*최초 2nm.*출하/);
assert.equal(sourceBroadcom2nm?.rampAsOf, "2026-02-26");
assert.equal(sourceBroadcom2nm?.rampBasis, "fact");

const sourceCmmAx = sourceGeneration("marvell", (row) => row.name.includes("CMM-Ax"));
assert.match(sourceCmmAx?.bandwidth || "", /32GB prototype.*512GB\/device.*projection/);
assert.match(sourceCmmAx?.attach || "", /128K~1024K sequence/);
assert.match(sourceCmmAx?.attach || "", /32GB prototype.*512GB\/device projection/);
assert.match(sourceCmmAx?.attach || "", /최대 5\.5×.*최대 3\.6×/);
assert.match(sourceCmmAx?.attach || "", /고객 PoC 재현 전 예상치로 분류/);
assert.equal(sourceCmmAx?.status, "공식 Prototype · Projection");
assert.equal(sourceCmmAx?.observedAt, "2026-08-05");

const hbm4SpeedBoundary = consoleRoadmapSource.hbm4SpeedBoundary;
assert.match(hbm4SpeedBoundary?.rule || "", /공급사별 공식 공개값과 제품 단계를 분리/);
assert.doesNotMatch(JSON.stringify(hbm4SpeedBoundary?.suppliers || []), /12\s*Gbps/i,
  "a target 12Gbps must not be promoted as a generic achieved HBM4 speed");
assert.deepEqual((hbm4SpeedBoundary?.suppliers || []).map((row) => row.supplier), ["SK hynix", "Micron"]);
const skHynixHbm4 = hbm4SpeedBoundary.suppliers.find((row) => row.supplier === "SK hynix");
assert.match(skHynixHbm4?.claim || "", /시연.*11\.7Gbps/);
assert.equal(skHynixHbm4?.stage, "공식 시연");
const micronHbm4 = hbm4SpeedBoundary.suppliers.find((row) => row.supplier === "Micron");
assert.match(micronHbm4?.claim || "", /대량생산.*>11Gb\/s.*>2\.8TB\/s/);
assert.equal(micronHbm4?.stage, "공식 대량생산");
assert.equal(micronHbm4?.asOf, "2026-03-16");

// Row-level provenance authenticates only the row identity/status. It must not
// leak onto fields, and an exact reported descriptor must remain reported even
// when the row itself is official.
const provenanceFixture = buildConsoleRoadmapArtifact({
  schemaVersion: "test",
  reviewedAt: "2026-08-29",
  accounts: {
    sample: {
      track: "fixture",
      generations: [{
        name: "Per-field gate",
        status: "공식 확인",
        url: "https://example.com/official-row",
        observedAt: "2026-08-29",
        sourceClass: "official",
        hbm: "행 URL만 있는 무근거 필드",
        bandwidth: "보도 기반 필드",
        bandwidthUrl: "https://example.com/exact-report",
        bandwidthAsOf: "2026-08-28",
        bandwidthClass: "reported",
        bandwidthBasis: "reported",
        ramp: "공식 일정",
        rampUrl: "https://example.com/exact-official",
        rampAsOf: "2026-08-27",
        rampClass: "official",
        rampBasis: "fact",
        hbmDemand: "공식 URL에 얹은 추정치",
        hbmDemandUrl: "https://example.com/exact-official",
        hbmDemandAsOf: "2026-08-27",
        hbmDemandClass: "official",
        hbmDemandBasis: "fact",
      }],
    },
  },
}, {
  runId: "test-run",
  generatedAt: "2026-08-29T00:00:00.000Z",
  expiresAt: "2026-09-01T00:00:00.000Z",
});
const gatedFixture = provenanceFixture.accounts.sample.generations[0];
assert.equal(gatedFixture.hbm, undefined, "a row-level official URL must not certify hbm");
assert.equal(gatedFixture.bandwidthClass, "reported", "a reported field must retain its own class");
assert.equal(gatedFixture.bandwidthBasis, "reported", "a reported field must retain its own basis");
assert.equal(gatedFixture.rampClass, "official", "an exact official field remains publishable");
assert.equal(gatedFixture.hbmDemand, undefined, "an official product URL must not certify a demand estimate");

for (const [id, row] of Object.entries(accounts)) {
  assert.ok(known.has(id), `${id} must be a real account`);
  assert.ok(row.track && row.track.trim(), `${id} must say which track these parts belong to`);
  assert.ok((row.generations || []).length, `${id} must list generations`);
  const names = new Set();
  for (const generation of row.generations) {
    generations += 1;
    assert.ok(generation.name && generation.name.trim(), `${id} generation must be named`);
    assert.ok(!names.has(generation.name), `${id} must not repeat ${generation.name}`);
    names.add(generation.name);
    assert.ok(generation.status && generation.status.trim(),
      `${generation.name} must say whether it is confirmed, reported or a roadmap item`);
    assert.ok(generation.attach && generation.attach.trim(),
      `${generation.name} must state what it means for our attach — a spec row with no reading is trivia`);
    // A spec that is claimed has to be checkable; a blank cell needs no source.
    if (generation.hbm || generation.bandwidth) {
      assert.ok(generation.url === "" || /^https:\/\//.test(generation.url || ""),
        `${generation.name} must carry a reachable source or none at all`);
    }
  }
}

// Rubin Ultra stays separate, but no exact HBM capacity is published until an
// official product spec supports it.
const nvidia = accounts.nvidia?.generations || [];
const rubin = nvidia.find((row) => row.name.startsWith("Rubin ("));
const ultra = nvidia.find((row) => row.name.includes("Ultra"));
assert.ok(rubin && ultra, "Rubin and Rubin Ultra must be separate rows");
assert.match(rubin.hbm, /288GB/);
assert.match(ultra.hbm, /미공개/, "an unverified Rubin Ultra capacity must fail closed");
assert.doesNotMatch(ultra.hbm, /192GB/);

// SpaceX says the current module is vendor-agnostic; a supplier must not be
// inferred from a secondary report.
const starmind = (accounts.spacexai?.generations || []).find((row) => row.name.includes("STARMIND"));
assert.ok(starmind, "STARMIND must appear as its own track entry");
assert.match(starmind.hbm, /Vendor-agnostic/);
assert.doesNotMatch(starmind.hbm, /NVIDIA/);

// Meta's cadence is the whole point of separating generations.
const meta = accounts.meta?.generations || [];
assert.ok(meta.length >= 4, "a six-month cadence must show as four rows, not one");
assert.match(meta[0].hbm, /216GB/);
assert.match(meta[1].hbm, /미공개/, "future MTIA HBM capacity must wait for an official spec");

const google = accounts.google?.generations || [];
assert.ok(google.some((row) => row.name.includes("TPU 8t")), "training TPU 8t must stay separate");
assert.ok(google.some((row) => row.name.includes("TPU 8i")), "inference TPU 8i must stay separate");
const googleV10 = google.find((row) => row.name.includes("TPU v10"));
assert.equal(googleV10?.status, "브로커 추정", "TPU v10 design-service roles must not render as official facts");
assert.match(googleV10?.hbm || "", /Google compute die KGD.*MediaTek Electrical I\/O Die.*Memory Supplier HBM Chip/, "TPU v10 must preserve the Google–MediaTek–memory supplier block split");
assert.doesNotMatch(googleV10?.attach || "", /레티클 확대는 패키지당 HBM 스택이 늘어난다는 뜻/, "reticle growth must not be treated as proof of higher HBM attach");
const google8t = google.find((row) => row.name.includes("TPU 8t"));
assert.match(google8t?.attach || "", /192→216GB/, "TPU 8t must expose its HBM delta versus Ironwood");

const maia200 = (accounts.microsoft?.generations || []).find((row) => row.name === "Maia 200");
assert.match(`${maia200?.hbm} ${maia200?.bandwidth}`, /272MB SRAM/);
assert.match(`${maia200?.hbm} ${maia200?.bandwidth}`, /140B transistor/);
assert.match(`${maia200?.hbm} ${maia200?.bandwidth}`, /750W/);

const ai5 = (accounts.tesla?.generations || []).find((row) => row.name.startsWith("AI5"));
assert.match(ai5?.hbm || "", /Memory Capacity 9배/);
assert.match(ai5?.ramp || "", /2027년 생산/);

// Jalapeño is an official engineering sample, but its memory supplier and
// comparative benchmark are not disclosed by OpenAI. Keep the implementation
// roles separate so a secondary headline cannot be promoted to a supply fact.
const jalapeno = (accounts.openai?.generations || []).find((row) => row.name === "Jalapeño");
assert.equal(jalapeno?.supplierDisclosure, "메모리 공급사 미공개");
assert.match(jalapeno?.roleSplit?.openai || "", /아키텍처/);
assert.match(jalapeno?.roleSplit?.broadcom || "", /실리콘 구현/);
assert.match(jalapeno?.roleSplit?.celestica || "", /보드·랙·시스템 통합/);
assert.match(jalapeno?.ramp || "", /2026년 말 초기 배치 목표/);
assert.equal(jalapeno?.url, "https://openai.com/index/openai-broadcom-jalapeno-inference-chip/");
assert.doesNotMatch(`${jalapeno?.hbm} ${jalapeno?.bandwidth} ${jalapeno?.attach}`, /Samsung|삼성|GB300.{0,40}(?:능가|outperform)/i);

// Structera X exposes two different migration paths: recycled DDR4 on X 2404
// and DDR5 expansion on X 2504. They must not be collapsed into a vague CXL row.
const structeraX = (accounts.marvell?.generations || []).find((row) => row.name.includes("Structera X 2404"));
assert.ok(structeraX, "Structera X 2404 / X 2504 must appear as an official generation");
assert.match(structeraX.hbm, /X 2404: DDR4 12 DIMM·재사용 지원/);
assert.match(structeraX.hbm, /X 2504: DDR5 8 DIMM 지원/);
assert.match(structeraX.bandwidth, /DDR4 >4TB \/ DDR5 >6TB/);
assert.equal(structeraX.url, "https://www.marvell.com/products/cxl.html");

for (const [accountId, account] of Object.entries(consoleRoadmap.accounts || {})) {
  for (const generation of account.generations || []) {
    assert.ok(Object.keys(generation.fieldEvidence || {}).length,
      `${accountId}/${generation.name} must publish at least one independently evidenced field`);
    for (const field of evidenceFields) {
      if (generation[field] == null || generation[field] === "") continue;
      const evidence = generation.fieldEvidence?.[field];
      assert.ok(evidence, `${accountId}/${generation.name}/${field} must publish its descriptor`);
      assert.equal(generation[`${field}Url`], evidence.url);
      assert.equal(generation[`${field}AsOf`], evidence.observedAt);
      assert.equal(generation[`${field}Class`], evidence.sourceClass);
      assert.equal(generation[`${field}Basis`], evidence.basis);
    }
  }
}

const consoleUltra = consoleRoadmap.accounts.nvidia?.generations?.find((row) => row.name === "Rubin Ultra");
assert.doesNotMatch(consoleUltra?.attach || "", /GTC|1TB|32TB\/s|시연 보도/,
  "Rubin Ultra must not carry an unproven media spec under its official row URL");
for (const name of ["TPU 8t · Sunfish (Training)", "TPU 8i · Zebrafish (Inference)"]) {
  const generation = consoleRoadmap.accounts.google?.generations?.find((row) => row.name === name);
  assert.equal(generation?.attach, undefined,
    `${name} attach interpretation must stay hidden until it has exact field provenance`);
}
assert.equal(Object.values(consoleRoadmap.accounts || {}).flatMap((account) => account.generations || [])
  .some((generation) => generation.hbmDemand), false,
"broker demand estimates without an exact report descriptor must fail closed");
assert.doesNotMatch(JSON.stringify(consoleRoadmap.accounts || {}), /Morgan Stanley|브로커 추정|\[미확인\]/,
  "an official field must not retain embedded broker or unverified clauses");

// The demand bridge is a curve, not a total.
const demandBridge = consoleRoadmap.demandBridge;
assert.equal((demandBridge?.rows || []).length, 6, "the supply commitment must preserve every disclosed fiscal period");
assert.deepEqual((demandBridge?.rows || []).map((row) => `${row.period}:${row.amount}`),
  ["FY2027 잔여:$92B", "FY2028:$87B", "FY2029:$88B", "FY2030:$6B", "FY2031:$5B", "FY2032 이후:$1B"],
  "the NVIDIA maturity curve must preserve each filed amount");
assert.equal((demandBridge?.rows || []).reduce((sum, row) => sum + Number(String(row.amount || "").replace(/[^0-9.]/g, "") || 0), 0), 279,
  "the NVIDIA maturity curve must reconcile to $279B");
assert.match(demandBridge.label, /\$119B.*\$279B/,
  "the bridge must retain the prior-quarter and current totals");
assert.equal(demandBridge.url,
  "https://www.sec.gov/Archives/edgar/data/1045810/000104581026000075/nvda-20260726.htm");
assert.match(demandBridge.note, /주로 메모리와 제조 시설/);
assert.match(demandBridge.note, /HBM 단독 금액.*해석하지 않음/);
assert.match(demandBridge.note, /취소·재조정 가능/);

assert.ok(profile.includes("company-roadmap"), "the brief must render the matrix");
assert.ok(profile.includes("company-roadmap-bridge"), "the NVIDIA brief must render the official demand bridge");
assert.ok(!directory.includes("demandBridge: id === \"nvidia\""),
  "the shared directory must not publish the console-only NVIDIA demand bridge");
assert.ok(profile.includes("미확인"), "an unconfirmed cell must say so rather than showing nothing");

console.log(JSON.stringify({
  status: "chip-roadmap-pass",
  accounts: Object.keys(accounts).length,
  generations,
}, null, 2));
