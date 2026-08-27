/**
 * Chip roadmap gate.
 *
 * Collapsing a programme's generations into one line erased the attach curve:
 * a part that ships every six months changes capacity and bandwidth each time,
 * and carrying the previous generation's capacity forward over-counts the ones
 * that shrink — Rubin Ultra is smaller than Rubin, not larger. So the gate holds
 * that generations stay separate, that an unconfirmed cell stays empty rather
 * than being filled with a guess, and that a claimed spec is checkable.
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

// The specific correction this encodes: a later generation can be smaller.
const nvidia = accounts.nvidia?.generations || [];
const rubin = nvidia.find((row) => row.name.startsWith("Rubin ("));
const ultra = nvidia.find((row) => row.name.includes("Ultra"));
assert.ok(rubin && ultra, "Rubin and Rubin Ultra must be separate rows");
assert.match(rubin.hbm, /288GB/);
assert.match(ultra.hbm, /192GB/, "the shrinking generation must be recorded as shrinking");

// And that an orbital payload running someone else's silicon is filed as theirs.
const starmind = (accounts.tesla?.generations || []).find((row) => row.name.includes("STARMIND"));
assert.ok(starmind, "STARMIND must appear as its own track entry");
assert.match(starmind.hbm, /NVIDIA/, "it must be recorded as NVIDIA silicon, not as custom silicon");

// Meta's cadence is the whole point of separating generations.
const meta = accounts.meta?.generations || [];
assert.ok(meta.length >= 4, "a six-month cadence must show as four rows, not one");
assert.match(meta[0].hbm, /216GB/);
assert.match(meta[1].hbm, /288GB/, "the capacity step between generations must be visible");

// The demand bridge is a curve, not a total.
assert.ok((roadmap.demandBridge?.rows || []).length >= 3, "the supply commitment must be shown by period");
assert.match(roadmap.demandBridge.url, /^https:\/\//);

assert.ok(profile.includes("company-roadmap"), "the brief must render the matrix");
assert.ok(profile.includes("미확인"), "an unconfirmed cell must say so rather than showing nothing");

console.log(JSON.stringify({
  status: "chip-roadmap-pass",
  accounts: Object.keys(accounts).length,
  generations,
}, null, 2));
