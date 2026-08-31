import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

// The console and the landing page paint square corners end to end: cards,
// panels, chips, badges and nodes all meet at a right angle, the way a printed
// consulting page does. A rounded corner anywhere breaks that read, so the
// contract is enforced globally rather than component by component — no
// stylesheet, and no inline style, may declare a border-radius at all.

const RADIUS = /(?:-webkit-|-moz-)?border(?:-(?:top|bottom)-(?:left|right))?-radius\s*:\s*([^;{}]+)/gi;

const offenders = [];

const scan = (label, text) => {
  for (const match of text.matchAll(RADIUS)) {
    const value = match[1].trim();
    // `0` would be harmless, but it is also dead weight: the initial value is
    // already square. Anything at all is reported so the sweep stays complete.
    const line = text.slice(0, match.index).split(/\r?\n/).length;
    offenders.push(`${label}:${line} → ${match[0].trim()}${value === "0" ? "  (redundant)" : ""}`);
  }
};

for (const file of readdirSync("assets/css")) {
  if (!file.endsWith(".css") || file.endsWith(".min.css")) continue;
  scan(`assets/css/${file}`, readFileSync(`assets/css/${file}`, "utf8"));
}
for (const file of ["index.html", "console/index.html"]) {
  scan(file, readFileSync(file, "utf8"));
}
for (const file of readdirSync("assets/js")) {
  if (!file.endsWith(".js") || file.endsWith(".min.js")) continue;
  scan(`assets/js/${file}`, readFileSync(`assets/js/${file}`, "utf8"));
}

assert.equal(
  offenders.length,
  0,
  `every surface must keep square corners; found ${offenders.length} radius declaration(s):\n  ${offenders.slice(0, 20).join("\n  ")}`,
);

// The built bundles are what the browser actually loads, so check them too —
// a stale build would otherwise keep serving rounded corners silently.
for (const file of readdirSync("assets/css")) {
  if (!file.endsWith(".min.css")) continue;
  const text = readFileSync(`assets/css/${file}`, "utf8");
  assert.ok(
    !/border-radius\s*:/i.test(text),
    `${file} still ships a border-radius; run npm run build:assets`,
  );
}

// Square corners are the ground rule; the consulting shapes are cut into that
// ground with clip-path, which leaves every corner square by definition. The
// step diagrams have to keep drawing from the shared shapes rather than each
// re-inventing a polygon, so the run of them stays one visual language.
const brand = readFileSync("assets/css/brand-system.css", "utf8");
for (const token of ["--shape-ribbon", "--shape-ribbon-lead", "--shape-cut"]) {
  assert.ok(brand.includes(`${token}:`), `${token} must be defined once, in brand-system.css`);
}

const consoleCss = readFileSync("assets/css/styles.css", "utf8");
const ruleFor = (needle) => {
  const at = consoleCss.lastIndexOf(needle);
  if (at < 0) return "";
  const open = consoleCss.indexOf("{", at);
  return open < 0 ? "" : consoleCss.slice(open, consoleCss.indexOf("}", open));
};
for (const [selector, shape] of [
  [".visual-insight-route > span {", "--shape-ribbon"],
  [".number-lens-summary > .number-brief-card {", "--shape-ribbon"],
  [".number-lens-tabs button {", "--shape-cut"],
  ["#hyperscaler-demand .forecast-cat-tab {", "--shape-ribbon"],
]) {
  assert.match(
    ruleFor(selector),
    new RegExp(`clip-path:\\s*var\\(${shape}\\)`),
    `${selector.trim()} must take its shape from ${shape}`,
  );
}

console.log("square corners: 0 radius declarations across stylesheets, markup and bundles");
