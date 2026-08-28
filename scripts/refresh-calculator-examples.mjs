/**
 * The calculator's account examples carry the figure each account has actually
 * announced. Those figures move — a capex guidance is revised, a programme
 * slips a quarter — so the note is regenerated from the capital plan layer the
 * crawl already maintains instead of being retyped into the frame model.
 *
 * The scenario inputs stay authored: they are assumptions, and inventing them
 * from a crawl would be the opposite of what this site promises. Only the
 * evidence line is derived.
 */
import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));

const capital = await read("data/capital-plans.json");
const frames = await read("data/mbb-frames.json");

// Bullet form, no sentence endings: the renderer rewrites prose, and frame copy
// has to survive that untouched (test-frame-copy-stability).
const bullet = (value = "") => String(value)
  .replace(/\s+/g, " ")
  .replace(/[.。]\s*$/u, "")
  .trim();

const firstClause = (value = "", limit = 96) => {
  const text = bullet(value);
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const boundary = Math.max(cut.lastIndexOf(" · "), cut.lastIndexOf(" "));
  return boundary > 40 ? cut.slice(0, boundary) : cut;
};

const evidenceFor = (id) => {
  const plan = capital.plans?.[id];
  if (!plan) return "";
  const parts = [plan.capex, plan.plan].map((value) => firstClause(value)).filter(Boolean);
  return parts.length ? `공개 근거 · ${parts.join(" · ")}` : "";
};

let frame = null;
const walk = (node) => {
  if (Array.isArray(node)) return node.forEach(walk);
  if (node && typeof node === "object") {
    if (!frame && Array.isArray(node.presets) && Array.isArray(node.inputs)) frame = node;
    Object.values(node).forEach(walk);
  }
};
walk(frames);

if (!frame) {
  console.log(JSON.stringify({ script: "refresh-calculator-examples", updated: 0, reason: "calculator frame not found" }));
  process.exit(0);
}

// Which account each example speaks for. Adding an example here is all it takes
// for its evidence line to start refreshing with the crawl.
const ACCOUNTS = { "Microsoft · Maia": "microsoft", "Google · TPU": "google", "Meta · MTIA": "meta", "OpenAI · 자체 가속기": "openai" };

let updated = 0;
for (const preset of frame.presets) {
  const id = ACCOUNTS[preset.label];
  if (!id) continue;
  const note = evidenceFor(id);
  if (!note || note === preset.note) continue;
  preset.note = note;
  updated += 1;
}

if (updated) await writeFile(new URL("data/mbb-frames.json", root), `${JSON.stringify(frames, null, 2)}\n`);
console.log(JSON.stringify({ script: "refresh-calculator-examples", updated, examples: frame.presets.length }));
