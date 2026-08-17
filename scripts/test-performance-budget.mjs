import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const root = new URL("../", import.meta.url);
const paths = {
  html: "index.html",
  landingCss: "assets/css/landing.css",
  landingMinCss: "assets/css/landing.min.css",
  stylesCss: "assets/css/styles.css",
  stylesMinCss: "assets/css/styles.min.css",
  landingJs: "assets/js/landing.js",
  landingMinJs: "assets/js/landing.min.js",
  appJs: "assets/js/app.js",
  appMinJs: "assets/js/app.min.js",
  heroVideo: "assets/media/memory-hero.mp4",
  heroVideoLite: "assets/media/memory-hero-lite.mp4",
};

const entries = await Promise.all(Object.entries(paths).map(async ([key, path]) => {
  const url = new URL(path, root);
  const [buffer, info] = await Promise.all([readFile(url), stat(url)]);
  return [key, { text: buffer.toString("utf8"), bytes: info.size, gzipBytes: gzipSync(buffer).byteLength }];
}));
const files = Object.fromEntries(entries);

assert.match(files.html.text, /<template id="consoleTemplate">[\s\S]*?id="intelligenceConsole"[\s\S]*?<\/template>/);
assert.match(files.html.text, /assets\/css\/landing\.min\.css\?v=infra-20260817-76/);
assert.match(files.html.text, /assets\/js\/landing\.min\.js\?v=infra-20260817-76/);
assert.match(files.landingJs.text, /function ensureConsoleMarkup\(\)/);
assert.match(files.landingJs.text, /assets\/css\/styles\.min\.css/);
assert.match(files.landingJs.text, /assets\/js\/app\.min\.js/);
assert.match(files.landingCss.text, /content-visibility:\s*auto/);
assert.match(files.landingCss.text, /contain-intrinsic-size:\s*auto 2400px/);
assert.match(files.landingCss.text, /business-section\[data-progressive-state="ready"\][\s\S]*?content-visibility:\s*auto/);
assert.match(files.landingCss.text, /business-hero-media\[data-rotation-ready="1"\][\s\S]*?businessHeroMediaSlide/);
assert.match(files.landingJs.text, /function setupSequentialBusinessWarmup\(/);
assert.match(files.landingJs.text, /function scheduleConsoleAssetWarmup\(/);
assert.match(files.landingJs.text, /function setupHeroMediaRotation\([\s\S]*?dataset\.rotationReady = "1"[\s\S]*?Promise\.allSettled/);
assert.match(files.landingJs.text, /window\.setTimeout\(\(\) => scheduleIdleStep\(\(\) => void loadSiteContent\(\)\.then\(scheduleConsoleAssetWarmup\), 600\), 900\)/);
assert.match(files.landingJs.text, /function setupBusinessNavObserver\([\s\S]*?IntersectionObserver[\s\S]*?entry\.boundingClientRect\.top/);
assert.match(files.landingJs.text, /const updates = \[\];[\s\S]*?updates\.push[\s\S]*?for \(const update of updates\)/);
assert.doesNotMatch(files.landingJs.text.match(/function applyReadabilityGuard\([\s\S]*?\n  \}\n\n  function setupReadabilityGuard/)?.[0] || "", /getBoundingClientRect/);
assert.match(files.html.text, /hbm-system\.webp" alt="" width="1920" height="1072" fetchpriority="high"/);
assert.doesNotMatch(files.landingJs.text, /rootMargin:\s*"0px 0px -8%"/);
assert.match(files.appJs.text, /function scheduleProgressiveDeferredSections\(/);
assert.doesNotMatch(files.appJs.text, /function observeDeferredSections\(/);
assert.match(files.appJs.text, /window\.requestIdleCallback\(prepareDrop/);
assert.match(files.appJs.text, /memory-console-ready", scheduleHeroVideo/);
assert.match(files.html.text, /data-src="assets\/media\/memory-hero-lite\.mp4"/);

for (const [sourceKey, minKey, minimumRawSaving] of [
  ["landingCss", "landingMinCss", 0.15],
  ["stylesCss", "stylesMinCss", 0.15],
  ["landingJs", "landingMinJs", 0.18],
  ["appJs", "appMinJs", 0.18],
]) {
  const minimumPercent = Math.round(minimumRawSaving * 100);
  assert.ok(
    files[minKey].bytes < files[sourceKey].bytes * (1 - minimumRawSaving),
    `${minKey} must reduce raw transfer size by at least ${minimumPercent}%`,
  );
  assert.ok(files[minKey].gzipBytes < files[sourceKey].gzipBytes, `${minKey} must reduce gzip transfer size`);
}

assert.ok(files.appMinJs.gzipBytes < 300_000, "console JavaScript gzip budget must stay below 300KB");
assert.ok(files.stylesMinCss.gzipBytes < 105_000, "console CSS gzip budget must stay below 105KB");
assert.ok(files.heroVideoLite.bytes < 1_100_000, "console hero video must stay below 1.1MB");
assert.ok(files.heroVideoLite.bytes < files.heroVideo.bytes * 0.4, "console hero video must reduce transfer size by at least 60%");

console.log(JSON.stringify({
  revision: "infra-20260817-76",
  rootRuntimeGzipKb: Math.round((files.html.gzipBytes + files.landingMinCss.gzipBytes + files.landingMinJs.gzipBytes) / 1024),
  consoleRuntimeGzipKb: Math.round((files.stylesMinCss.gzipBytes + files.appMinJs.gzipBytes) / 1024),
  heroVideoKb: Math.round(files.heroVideoLite.bytes / 1024),
  lazyConsoleTemplate: true,
  progressiveNoScrollHydration: true,
}, null, 2));
