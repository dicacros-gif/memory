import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

// One palette, held by a rule rather than by discipline.
//
// Colour on this site used to be picked per component: 568 distinct saturated
// hexes with nothing relating them. The rule that replaced them is simple —
// a deep colour may carry full chroma -- the reference's own teal is #007f78 --
// and a colour must get
// quieter as it gets lighter, because a light, vivid fill is what reads as
// amateur. This test states that ceiling so a new colour cannot drift past it
// without someone deciding to move the ceiling itself.

const root = new URL("../", import.meta.url);

// [lightness ceiling, maximum saturation]. The ceiling loosens as a colour
// darkens: a deep shade can carry full chroma and still look composed, while a
// light one turns fluorescent. These are the outer bounds, deliberately looser
// than the values the palette actually uses, so the test catches a colour that
// left the system rather than arguing about a shade inside it.
const SAT_CEILING = [[30, 100], [48, 80], [66, 58], [74, 50], [84, 46], [101, 34]];
// A colour with almost no chroma reads as a neutral, whatever its nominal
// saturation: near-white and near-black are exempt.
const MIN_CHROMA = 26;
// Rounding when a colour is converted through HSL and back.
const TOLERANCE = 4;

const hsl = (rgb) => {
  const [r, g, b] = rgb.map((v) => v / 255);
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  const l = (mx + mn) / 2;
  return { s: (d ? d / (1 - Math.abs(2 * l - 1)) : 0) * 100, l: l * 100 };
};

const ceilingFor = (l) => (SAT_CEILING.find(([limit]) => l <= limit) || [0, 34])[1];

const listing = async (dir, keep) => {
  const files = await readdir(new URL(dir, root));
  return files.filter(keep).map((file) => dir + file);
};

const sources = [
  ...(await listing("assets/css/", (f) => f.endsWith(".css") && !f.endsWith(".min.css"))),
  ...(await listing("assets/js/", (f) => f.endsWith(".js") && !f.endsWith(".min.js"))),
  ...(await listing("data/", (f) => f.endsWith(".json"))),
  "index.html",
  "console/index.html",
];

const offenders = new Map();
for (const rel of sources) {
  const text = await readFile(new URL(rel, root), "utf8");
  for (const match of text.matchAll(/#([0-9a-fA-F]{6})\b/g)) {
    const hex = `#${match[1].toLowerCase()}`;
    const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    if (Math.max(...rgb) - Math.min(...rgb) < MIN_CHROMA) continue;
    const { s, l } = hsl(rgb);
    const ceiling = ceilingFor(l);
    if (s <= ceiling + TOLERANCE) continue;
    const key = `${hex} (saturation ${Math.round(s)} at lightness ${Math.round(l)}, ceiling ${ceiling})`;
    const seen = offenders.get(key) || new Set();
    seen.add(rel);
    offenders.set(key, seen);
  }
}

const report = [...offenders.entries()]
  .slice(0, 15)
  .map(([key, files]) => `${key}\n      in ${[...files].slice(0, 3).join(", ")}`);

assert.equal(
  offenders.size,
  0,
  `colours must stay inside the palette ceiling; ${offenders.size} exceed it:\n    ${report.join("\n    ")}`,
);

// The ramp every sequence steps through has to exist for those sequences to
// reference it.
const brand = await readFile(new URL("assets/css/brand-system.css", root), "utf8");
for (let step = 1; step <= 7; step += 1) {
  assert.match(brand, new RegExp(`--cat-${step}:\\s*#[0-9a-f]{6};`), `the categorical ramp must define step ${step}`);
}

console.log(`palette discipline: every colour inside its ceiling across ${sources.length} files, ramp intact`);
