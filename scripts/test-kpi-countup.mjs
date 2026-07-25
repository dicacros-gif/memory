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

assert.match(app, /let memoryMarketModeTimer = 0;/, "market-map carousel must retain one rotation timer");
assert.match(app, /window\.setInterval\(\(\) => \{[\s\S]*?\}, 5000\);/, "market-map views should rotate on a five-second cadence");
assert.match(app, /board\.addEventListener\("mouseenter", stopMemoryMarketModeRotation\)/, "market-map carousel should pause on pointer hover");
assert.match(app, /data-memory-rotation-toggle/, "market-map carousel should offer a pause and resume control");
assert.match(css, /\.memory-map-tabs\[data-rotation-running="true"\] \.memory-map-cycle-progress b/, "market-map carousel should show five-second progress");
assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.memory-map-cycle-progress b/s, "market-map carousel should respect reduced-motion settings");
assert.match(app, /let chinaTalentGalleryInteractionPaused = false;/, "talent gallery should track temporary interaction pauses");
assert.match(app, /image\.classList\.toggle\("is-next", !active && relative === 1\);/, "talent gallery should position the upcoming slide beside the active slide");
assert.match(app, /image\.classList\.toggle\("is-previous", !active && relative === total - 1\);/, "talent gallery should position the previous slide beside the active slide");
assert.match(app, /panel\.addEventListener\("mouseenter", \(\) => \{\s*chinaTalentGalleryInteractionPaused = true;/s, "talent gallery should pause while a user inspects it");
assert.match(css, /#china-talent-strategy \.policy-layout \{[\s\S]*?grid-template-areas:\s*"panel"\s*"focus";/, "talent gallery should use the full board width before the detail panel");
assert.match(css, /\.talent-strategy-gallery-image\.is-previous/, "talent gallery should render a previous-slide preview");
assert.match(css, /\.talent-strategy-gallery-image\.is-next/, "talent gallery should render a next-slide preview");
assert.match(css, /@keyframes talentGalleryCarouselProgress/, "talent gallery should show the five-second rotation progress");
assert.match(html, /aria-roledescription="carousel"/, "talent gallery should expose its carousel role to assistive technology");
assert.doesNotMatch(app, /전략 참고용으로 전체 내용을 제공하며 수치와 결론은 재검증 전 의사결정 입력값으로 사용하지 않음/, "baseline disclaimer should not be rendered");
assert.doesNotMatch(app, /SKHY 판단/, "SKHY labels should use the neutral Insight label");
assert.match(app, /bodyLead: "Insight"/, "executive insight cards should use the Insight label");
assert.match(html, /styles\.css\?v=baseline-label-20260725-11/, "CSS cache key should include this integrated revision");
assert.match(html, /app\.js\?v=baseline-label-20260725-11/, "JavaScript cache key should include this integrated revision");

console.log("KPI typography and hover count-up checks passed.");
