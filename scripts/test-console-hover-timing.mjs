import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const brand = fs.readFileSync(path.join(root, "assets/css/brand-system.css"), "utf8");
const landing = fs.readFileSync(path.join(root, "assets/js/landing.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");

const start = brand.indexOf("Console-wide zero-lag interaction contract");
const end = brand.indexOf("End console-wide zero-lag interaction contract");
assert.ok(start >= 0 && end > start, "brand CSS must end with the console-wide zero-lag contract");
const contract = brand.slice(start, end);

for (const selector of [
  "article", "li", "tr", "button", "summary", "a[href]", "label",
  "[role=\"button\"]", "[tabindex]", "[data-hover-mode]",
  "-card", "-row", "-tile", "-node", "-chip", "-item", "-step",
  "-tab", "-cat", "-toggle", "-head", "-detail", "-summary",
  "-track", "-lane", "-option", "-metric",
]) {
  assert.ok(contract.includes(selector), `zero-lag contract must cover ${selector}`);
}

assert.match(
  contract,
  /transition-property:\s*transform, box-shadow\s*!important;/,
  "interactive surfaces may animate spatial cues only",
);
assert.match(
  contract,
  /\.ui-contrast-on-dark,[\s\S]*?\.ui-contrast-on-light,[\s\S]*?transition-property:\s*none\s*!important;/,
  "readability ink utilities must repaint without a transition frame",
);
for (const declaration of contract.matchAll(/transition(?:-property)?:\s*([^;]+);/g)) {
  assert.doesNotMatch(
    declaration[1],
    /(?:^|[\s,])(all|color|background(?:-color)?|-webkit-text-fill-color|fill|stroke|opacity)(?:[\s,]|$)/,
    `paint property must not be animated in zero-lag contract: ${declaration[0]}`,
  );
}

assert.match(
  landing,
  /const CACHED_INTERACTION_INK[\s\S]*?clearCachedInteractionInk\(surface\);[\s\S]*?scheduleAudit\(surface\);/,
  "cached contrast ink must be removed synchronously before the next-frame audit",
);
assert.match(
  landing,
  /const related = event\.relatedTarget[\s\S]*?surface\.contains\(related\)\) return;/,
  "pointer movement inside one surface must not restart the readability audit",
);
assert.match(
  index,
  /#intelligenceConsole :is\([\s\S]*?button[\s\S]*?summary[\s\S]*?\[class\*="-node"\][\s\S]*?transition-delay:\s*0s !important;/,
  "critical CSS must apply the immediate-paint contract before the full bundle arrives",
);

console.log("console hover timing contract passed");
