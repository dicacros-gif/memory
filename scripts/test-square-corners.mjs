import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

// The console and the landing page paint square surfaces end to end. The
// user-requested exceptions are the numeral badges inside the public process
// modules, the console rail marker, and the central value-chain hub.

const RADIUS = /(?:-webkit-|-moz-)?border(?:-(?:top|bottom)-(?:left|right))?-radius\s*:\s*([^;{}]+)/gi;
const CIRCULAR_GATE_SELECTOR = ".business-site .business-strategy-chain > li > span:first-child";

const flat = (value) => String(value).replace(/\s+/g, " ").trim();

const NUMERAL_MARKER_SELECTOR = [
  "#intelligenceConsole :is(",
  ".sc-framework-steps > li > b,",
  "#hyperscaler-demand .hs-logic-step > b,",
  ".number-lens-summary > .number-brief-card > b,",
  "details.sc-report > summary.sc-report-head > strong > b",
  ")",
].join("\n  ").replace(/\s+/g, " ").trim();

const APPROVED_CIRCLES = [
  { file: "assets/css/landing.css", selector: CIRCULAR_GATE_SELECTOR },
  { file: "assets/css/landing.css", selector: ".business-case-logic li > span::before" },
  { file: "assets/css/landing.css", selector: ".business-partner-core" },
  { file: "assets/css/mbb-frames.css", selector: ".mbb-capital-index" },
  { file: "assets/css/mbb-frames.css", selector: ".mbb-oem-selector button::before" },
  { file: "assets/css/mbb-frames.css", selector: ".mbb-frame[data-frame=\"oem-channel-programs\"] .mbb-record .mbb-index" },
  { file: "assets/css/styles.css", selector: "#intelligenceConsole .sb-ico" },
  // Every step numeral in the console, declared together so the exception is
  // one rule rather than one per component.
  { file: "assets/css/styles.css", selector: NUMERAL_MARKER_SELECTOR },
  { file: "assets/css/styles.css", selector: "#intelligenceConsole .visual-insight-route > span::before" },
];

const offenders = [];

const scan = (label, text) => {
  for (const match of text.matchAll(RADIUS)) {
    const value = match[1].trim();
    const ruleStart = text.lastIndexOf("}", match.index) + 1;
    // A comment can sit between the previous rule and this selector; strip it
    // so the approved-circle comparison sees the selector alone.
    const selector = text.slice(ruleStart, text.indexOf("{", ruleStart)).replace(/\/\*[\s\S]*?\*\//g, " ").trim();
    // These circles are deliberate marks or hubs, not rounded card surfaces.
    if (value === "50%" && APPROVED_CIRCLES.some((entry) => entry.file === label && flat(entry.selector) === flat(selector))) continue;
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
  // Each bundle may ship exactly the circles its source declares, and only
  // on the numeral marker named here.
  const approved = {
    "landing.min.css": [
      /\.business-site \.business-strategy-chain>li>span:first-child\{[^}]*border-radius:50%/i,
      /\.business-case-logic li>span:{1,2}before\{[^}]*border-radius:50%/i,
      /\.business-partner-core\{[^}]*border-radius:50%/i,
    ],
    "mbb-frames.min.css": [
      /\.mbb-capital-index\{[^}]*border-radius:50%/i,
      /\.mbb-oem-selector button:{1,2}before\{[^}]*border-radius:50%/i,
      /\.mbb-frame\[data-frame=oem-channel-programs\] \.mbb-record \.mbb-index\{[^}]*border-radius:50%/i,
    ],
    "styles.min.css": [
      /#intelligenceConsole \.sb-ico\{[^}]*border-radius:50%/i,
      // Every console step numeral, declared as one rule.
      /\.sc-framework-steps>li>b[^{]*\{[^}]*border-radius:50%/i,
      /\.visual-insight-route>span:{1,2}before\{[^}]*border-radius:50%/i,
    ],
  }[file];
  if (approved) {
    const selectors = Array.isArray(approved) ? approved : [approved];
    assert.equal(radii.length, selectors.length, `${file} must ship only its approved circular marks`);
    for (const radius of radii) assert.equal(radius[1].trim(), "50%", `${file} approved marks must stay circular`);
    for (const selector of selectors) assert.match(text, selector, `${file} may round only its approved marks`);
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
// A selector is usually written more than once — the shape in one rule, a
// later correction in another — so collect every block it opens.
const rulesFor = (needle) => {
  const blocks = [];
  let at = consoleCss.indexOf(needle);
  while (at >= 0) {
    const open = consoleCss.indexOf("{", at);
    if (open >= 0) blocks.push(consoleCss.slice(open, consoleCss.indexOf("}", open)));
    at = consoleCss.indexOf(needle, at + needle.length);
  }
  return blocks;
};
for (const [selector, shape] of [
  [".visual-insight-route > span {", "--shape-ribbon"],
  [".number-lens-summary > .number-brief-card {", "--shape-ribbon"],
  [".number-lens-tabs button {", "--shape-cut"],
  ["#hyperscaler-demand .forecast-cat-tab {", "--shape-ribbon"],
]) {
  const pattern = new RegExp(`clip-path:\\s*var\\(${shape}\\)`);
  assert.ok(
    rulesFor(selector).some((block) => pattern.test(block)),
    `${selector.trim()} must take its shape from ${shape}`,
  );
}

console.log("square surfaces intact; approved circular markers and value-chain hub intact");
