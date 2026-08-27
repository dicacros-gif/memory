/**
 * Silicon map gate.
 *
 * The failure this replaces was modelling a company as having one accelerator.
 * That collapsed AWS's training part and inference part into a single entry and
 * lost the fact that an account can run silicon it did not design. So the gate
 * holds three things: the registry keeps training and inference apart, the
 * derivation never asserts a relationship the feed has not repeated, and a
 * co-mention is never dressed up as procurement.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildSiliconMap } from "./silicon-map.mjs";

const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const registry = await read("../data/accelerator-programs.json");

/* ------------------------------------------------------------ registry shape */

const programs = registry.programs || {};
assert.ok(Object.keys(programs).length >= 10, "the registry must cover the programmes the feed names");

for (const [name, program] of Object.entries(programs)) {
  for (const field of ["designer", "role", "pattern", "memoryProfile"]) {
    assert.ok(program[field] && String(program[field]).trim(), `${name} must state ${field}`);
  }
  assert.match(program.role, /^(training|inference|both|host)$/, `${name} role must be one of the four`);
  assert.doesNotThrow(() => new RegExp(program.pattern, "i"), `${name} pattern must compile`);
}

// The specific error this exists to prevent: one company, one chip.
assert.equal(programs.Trainium?.role, "training", "Trainium is the training part");
assert.equal(programs.Inferentia?.role, "inference", "Inferentia is the inference part");
assert.equal(programs.Trainium?.designer, programs.Inferentia?.designer, "and both are AWS");
assert.notEqual(programs.Trainium?.memoryProfile, programs.Inferentia?.memoryProfile,
  "training and inference must not share a memory profile");

/* -------------------------------------------------------------- fail-closed */

const accounts = [
  { id: "aws", name: "AWS", aliases: ["Amazon", "Amazon Web Services"] },
  { id: "nvidia", name: "NVIDIA", aliases: ["Nvidia"] },
];

assert.deepEqual(
  buildSiliconMap({ news: [], accounts, registry }).accounts,
  {},
  "no observation must produce no pairing",
);

// One article naming two things together is a coincidence, not a relationship.
const single = buildSiliconMap({
  news: [{ title: "AWS deploys Blackwell systems", date: "2026-08-20", link: "https://example.com/a" }],
  accounts,
  registry,
});
assert.equal(single.accounts.aws, undefined, "a single co-mention must not create a relationship");

// Repeat it and it becomes a signal — labelled as a co-mention, never as buying.
const repeated = buildSiliconMap({
  news: [
    { title: "AWS deploys Blackwell systems", date: "2026-08-20", link: "https://example.com/a" },
    { title: "AWS expands Blackwell capacity", date: "2026-08-22", link: "https://example.com/b" },
  ],
  accounts,
  registry,
});
const awsRow = repeated.accounts.aws?.programs?.[0];
assert.ok(awsRow, "a repeated pairing must surface");
assert.equal(awsRow.program, "Blackwell");
assert.equal(awsRow.relation, "동시 언급", "someone else's silicon is co-mentioned, not procured");
assert.equal(awsRow.designer, "NVIDIA");

// An account's own programme needs no repetition, because the designer is a
// registry fact rather than an inference from the feed.
const own = buildSiliconMap({
  news: [{ title: "AWS ships Inferentia for inference workloads", date: "2026-08-21", link: "https://example.com/c" }],
  accounts,
  registry,
});
const inferentia = own.accounts.aws?.programs?.find((row) => row.program === "Inferentia");
assert.ok(inferentia, "an account's own programme surfaces on first sighting");
assert.equal(inferentia.relation, "자체 설계");
assert.equal(own.accounts.aws.coversInference, true);
assert.equal(own.accounts.aws.coversTraining, false, "one inference part does not imply a training part");

// Both parts together, which is the shape the single-chip model could not hold.
const both = buildSiliconMap({
  news: [
    { title: "AWS ships Inferentia for inference workloads", date: "2026-08-21", link: "https://example.com/c" },
    { title: "AWS scales Trainium training clusters", date: "2026-08-22", link: "https://example.com/d" },
  ],
  accounts,
  registry,
});
assert.equal(both.accounts.aws.coversTraining, true);
assert.equal(both.accounts.aws.coversInference, true);
assert.ok(both.accounts.aws.programs.length >= 2, "training and inference are separate rows");

console.log(JSON.stringify({
  status: "silicon-map-pass",
  programs: Object.keys(programs).length,
  roles: [...new Set(Object.values(programs).map((program) => program.role))].sort(),
}, null, 2));
