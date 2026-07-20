import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../assets/js/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../assets/css/styles.css", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

assert.match(
  app,
  /const node = el\("article", `kpi kpi-value-card reveal\$\{isSecondRow \? " kpi-share-card" : ""\}`\);/,
  "all six KPI cards should receive the large-value typography class",
);
assert.match(app, /node\.dataset\.countReplay = "hover";/, "KPI cards should opt into hover replay");
assert.match(app, /from: 0,\s*to: countTarget\(node\),/s, "hover replay should always start from zero");
assert.match(app, /document\.addEventListener\("pointerover", replayOnEntry/, "pointer entry should replay the count-up");
assert.match(app, /document\.addEventListener\("focusin", replayOnEntry\)/, "keyboard focus should replay the count-up");
assert.match(app, /previous instanceof Node && scope\.contains\(previous\)/, "moving inside one card should not restart the animation");
assert.match(app, /setCountValue\(node, origin\);\s*const start = performance\.now\(\);/s, "the counter should visibly reset to zero before the first frame");
assert.match(app, /if \(reducedMotion\) \{\s*node\.classList\.remove\("is-counting"\);\s*setCountValue\(node, target\);/s, "reduced motion should show the target immediately");

assert.match(css, /\.kpi-value-card > strong \{[\s\S]*?font-family: "Space Grotesk", var\(--display\);[\s\S]*?font-size: clamp\(54px, 4\.5vw, 72px\);[\s\S]*?font-weight: 700;/, "KPI values should use one professional display treatment");
assert.match(css, /font-variant-numeric: lining-nums tabular-nums;/, "KPI figures should use aligned professional numerals");
assert.match(css, /\.kpi-value-card > strong > \.count \{[\s\S]*?font: inherit;/, "the inner counter must inherit the large value size");
assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.kpi-value-card > strong > \.count\.is-counting/s, "count-up motion should respect reduced-motion settings");

assert.match(html, /styles\.css\?v=live-pipeline-kpi-countup-20260721-2/, "CSS cache key should include this integrated revision");
assert.match(html, /app\.js\?v=live-pipeline-kpi-countup-20260721-2/, "JavaScript cache key should include this integrated revision");

console.log("KPI typography and hover count-up checks passed.");
