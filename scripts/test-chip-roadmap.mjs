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

const roadmap = JSON.parse(await readFile(new URL("../data/chip-roadmap.json", import.meta.url), "utf8"));
const accountModel = JSON.parse(await readFile(new URL("../data/accounts.json", import.meta.url), "utf8"));
const profile = await readFile(new URL("../assets/js/company-profile.js", import.meta.url), "utf8");

const accounts = roadmap.accounts || {};
assert.ok(Object.keys(accounts).length >= 6, "the matrix must cover the accounts whose generations matter");

const known = new Set((accountModel.accounts || []).map((row) => row.id));
let generations = 0;

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

// The demand bridge is a curve, not a total.
assert.ok((roadmap.demandBridge?.rows || []).length >= 3, "the supply commitment must be shown by period");
assert.equal(roadmap.demandBridge.url,
  "https://www.sec.gov/Archives/edgar/data/1045810/000104581026000075/nvda-20260726.htm");
assert.match(roadmap.demandBridge.note, /주로 메모리와 제조 시설/);
assert.match(roadmap.demandBridge.note, /HBM 단독 금액.*해석하지 않음/);

assert.ok(profile.includes("company-roadmap"), "the brief must render the matrix");
assert.ok(profile.includes("미확인"), "an unconfirmed cell must say so rather than showing nothing");

console.log(JSON.stringify({
  status: "chip-roadmap-pass",
  accounts: Object.keys(accounts).length,
  generations,
}, null, 2));
