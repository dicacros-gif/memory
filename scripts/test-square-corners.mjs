import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

// The console and the landing page paint square surfaces end to end. The sole
// exception is the user-requested numeral inside the public 10-gate strategy
// chain: it is a circular step marker, not a card or panel surface.

const RADIUS = /(?:-webkit-|-moz-)?border(?:-(?:top|bottom)-(?:left|right))?-radius\s*:\s*([^;{}]+)/gi;
const CIRCULAR_GATE_SELECTOR = ".business-site .business-strategy-chain > li > span:first-child";

const offenders = [];

const scan = (label, text) => {
  for (const match of text.matchAll(RADIUS)) {
    const value = match[1].trim();
    const ruleStart = text.lastIndexOf("}", match.index) + 1;
    const selector = text.slice(ruleStart, text.indexOf("{", ruleStart)).trim();
    if (label === "assets/css/landing.css" && selector === CIRCULAR_GATE_SELECTOR && value === "50%") continue;
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
  `every surface except the 10-gate numeral must keep square corners; found ${offenders.length} radius declaration(s):\n  ${offenders.slice(0, 20).join("\n  ")}`,
);

// The built bundles are what the browser actually loads, so check them too —
// a stale build would otherwise keep serving rounded corners silently.
for (const file of readdirSync("assets/css")) {
  if (!file.endsWith(".min.css")) continue;
  const text = readFileSync(`assets/css/${file}`, "utf8");
  const radii = [...text.matchAll(/border-radius\s*:\s*([^;{}]+)/gi)];
  if (file === "landing.min.css") {
    assert.equal(radii.length, 1, `${file} must ship exactly one circular gate marker`);
    assert.equal(radii[0][1].trim(), "50%", `${file} gate marker must stay circular`);
    assert.match(
      text,
      /\.business-site \.business-strategy-chain>li>span:first-child\{[^}]*border-radius:50%/i,
      `${file} may round only the 10-gate numeral`,
    );
  } else {
    assert.equal(radii.length, 0, `${file} still ships an unapproved border-radius; run npm run build:assets`);
  }
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

console.log("square surfaces intact; one approved circular 10-gate numeral marker");
