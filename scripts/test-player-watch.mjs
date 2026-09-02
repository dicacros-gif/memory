import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// The industry-shift tab reads an authored roster and overlays live crawl rows
// on it. Nothing else in the repo reads that file, so nothing else would notice
// if it went missing, lost a field, or named a company the directory does not
// know — the tab would render an empty chain and thirteen blank cards, and the
// navigation test would still pass. This test is that notice. It also holds
// the copy to the line between what is authored and what is refreshed.

const root = new URL("../", import.meta.url);
const read = (rel) => readFile(new URL(rel, root), "utf8");

const roster = JSON.parse(await read("data/ai-player-watch.json"));
const directory = JSON.parse(await read("data/company-directory-client.json"));
const app = await read("assets/js/app.js");
const index = await read("index.html");
const workflow = await read(".github/workflows/pages.yml");

// --- shape -----------------------------------------------------------------
assert.equal(roster.schemaVersion, "1.0", "roster schemaVersion must be 1.0");
assert.match(String(roster.asOf || ""), /^\d{4}-\d{2}$/, "roster asOf must be a YYYY-MM writing date — the board prints it as the frame's clock");

const COUNTERS = new Set(["tech", "dc", "players", "requirements", "axes", "opportunities"]);
assert.equal(roster.chain.length, 6, "the causal chain has six links");
const counters = roster.chain.map((step) => step.counter);
assert.deepEqual([...new Set(counters)].length, 6, "each chain link owns one counter");
for (const step of roster.chain) {
  assert.ok(COUNTERS.has(step.counter), `chain counter ${step.counter} is not computed by industryShiftCounters`);
  for (const field of ["index", "label", "en", "hint", "counterLabel"]) {
    assert.ok(String(step[field] || "").trim(), `chain step ${step.counter} is missing ${field}`);
  }
}
const playersStep = roster.chain.find((step) => step.counter === "players");
assert.match(playersStep.counterLabel, /LIVE/i, "the players counter counts live signals now, and its label must say so — the roster size is a constant");

// --- players --------------------------------------------------------------
const knownIds = new Set((directory.profiles || []).map((profile) => profile.id));
assert.ok(knownIds.size > 20, "company directory must be loaded");

const players = roster.tiers.flatMap((tier) => tier.players || []);
assert.equal(roster.tiers.length, 2, "two tiers: demand-side hyperscalers and supply-side silicon");
assert.equal(players.length, 13, "eight hyperscalers and five silicon vendors");
assert.equal(new Set(players.map((player) => player.id)).size, players.length, "player ids must be unique");

for (const player of players) {
  const where = `player ${player.id}`;
  for (const field of ["name", "role", "signalId", "constraint", "memoryRead", "ask"]) {
    assert.ok(String(player[field] || "").trim(), `${where} is missing ${field}`);
  }
  assert.ok(Array.isArray(player.aliases) && player.aliases.length >= 1, `${where} needs at least one alias — LATEST rows match news by alias`);
  assert.ok(["reported", "framework"].includes(player.basis), `${where} basis must be reported or framework`);
  // The signal id is the join key into company-signals / org-signals /
  // memory-demand. Those artifacts only carry companies that moved this cycle,
  // so the check is against the canonical directory, which carries all of them.
  assert.ok(knownIds.has(player.signalId), `${where} signalId "${player.signalId}" is not a company the directory knows — its live rows would never resolve`);
  assert.ok(!/#[0-9a-fA-F]{6}/.test(JSON.stringify(player)), `${where} must not carry a hex colour — the palette gate owns colour`);
  if (player.basis === "reported") {
    assert.match(player.sourceUrl || "", /^https:\/\//, `${where} reported facts need a primary source`);
    assert.match(player.sourceDate || "", /^\d{4}-\d{2}-\d{2}$/, `${where} needs its own source date`);
  }
}

assert.ok(roster.channel.keynote.isParaphrase, "the keynote summary must not masquerade as a direct quotation");
assert.match(roster.channel.keynote.sourceUrl || "", /^https:\/\//);

// --- channel --------------------------------------------------------------
assert.equal((roster.channel.tiers || []).length, 3, "OEM/ODM ladder has three tiers");
for (const tier of roster.channel.tiers) {
  assert.ok(String(tier.label || tier.name || "").trim(), "channel tier needs a label");
  assert.ok((tier.companies || tier.members || tier.names || []).length >= 3, `channel tier ${tier.label || tier.id} lists at least three companies`);
}

// --- wiring ---------------------------------------------------------------
assert.match(app, /path:\s*"data\/ai-player-watch\.json"/, "app.js must load the roster from its committed path");
assert.match(app, /playerHasLiveSignal/, "the PLAYERS counter must count live signals, not the roster");
assert.match(app, /공식 발표·보도와 전략 가설 분리/, "reader copy must distinguish evidence from interpretation");
assert.doesNotMatch(index, /id="industryShiftMeta"/, "collection clocks must not appear in the public heading");
assert.match(index, /Industry &amp; data center shift/, "the section must describe its decision context");
assert.doesNotMatch(index, /auto-refreshed radar/, "stale eyebrow copy");

// Static artifacts must carry the revision query so an edited roster is not
// pinned in a browser cache for the life of the origin.
assert.match(app, /definition\.managed === false\s*\?\s*\(revision \?/, "managed:false artifacts must be revision-busted");

// The roster is authored, not generated: it must be tracked, and it must NOT be
// in the crawl's generated-file commit list, or a crawl would overwrite an
// author's edit with whatever it happened to hold.
assert.doesNotMatch(workflow, /ai-player-watch\.json/, "pages.yml must not treat the authored roster as a generated artifact");

console.log(`player watch: ${players.length} players resolve in the directory, chain of ${roster.chain.length} with live-count label, copy separates frame from overlay`);
