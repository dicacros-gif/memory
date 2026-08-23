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
};

const entries = await Promise.all(Object.entries(paths).map(async ([key, path]) => {
  const url = new URL(path, root);
  const [buffer, info] = await Promise.all([readFile(url), stat(url)]);
  return [key, { text: buffer.toString("utf8"), bytes: info.size, gzipBytes: gzipSync(buffer).byteLength }];
}));
const files = Object.fromEntries(entries);
const revision = files.html.text.match(/infra-[a-f0-9]{12}/)?.[0] || "revision-missing";

assert.match(files.html.text, /<template id="consoleTemplate">[\s\S]*?id="intelligenceConsole"[\s\S]*?<\/template>/);
assert.match(files.html.text, /assets\/css\/landing\.min\.css\?v=infra-[a-f0-9]{12}/);
assert.match(files.html.text, /assets\/js\/landing\.min\.js\?v=infra-[a-f0-9]{12}/);
assert.match(files.landingJs.text, /function ensureConsoleMarkup\(\)/);
assert.match(files.landingJs.text, /assets\/css\/styles\.min\.css/);
assert.match(files.landingJs.text, /assets\/js\/app\.min\.js/);
assert.match(files.landingJs.text, /consoleLoadPromise = Promise\.all\(\[loadStylesheet\(\), loadAppScript\(\)\]\)/);
assert.doesNotMatch(files.landingJs.text.match(/function loadConsole\(\)[\s\S]*?\n  \}/)?.[0] || "", /loadSiteContent/);
assert.match(files.landingJs.text, /const consoleReady = loadConsole\(\)[\s\S]*?await loadStylesheet\(\)[\s\S]*?finishConsoleStartup\(\)[\s\S]*?await consoleReady/);
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
assert.doesNotMatch(files.html.text, /business-hero-video|ai-infra-hero\.mp4/);
assert.doesNotMatch(files.landingJs.text, /hydrateVideo|video\.dataset\.hydrated/);
assert.match(files.landingJs.text, /memory-console-ready[\s\S]*?new IntersectionObserver[\s\S]*?rootMargin: "360px 0px"/);
assert.doesNotMatch(files.landingJs.text, /refreshInteractiveContrast/);
assert.match(files.html.text, /hbm-system\.webp" alt="" width="1920" height="1072" loading="lazy"/);
assert.doesNotMatch(files.html.text, /hbm-system\.webp"[^>]*fetchpriority="high"/);
assert.doesNotMatch(files.landingJs.text, /rootMargin:\s*"0px 0px -8%"/);
assert.match(files.appJs.text, /function scheduleProgressiveDeferredSections\(/);
assert.match(files.appJs.text, /function scheduleOverviewDetails\(\)/);
assert.match(files.appJs.text, /function scheduleInteractiveEnhancements\(\)/);
assert.match(files.appJs.text, /function schedulePolicyArtifacts\(\)/);
assert.match(files.appJs.text, /performance\.mark\("memory-console-interactive"\);[\s\S]*?window\.dispatchEvent\(new Event\("memory-console-ready"\)\);[\s\S]*?scheduleInteractiveEnhancements\(\);[\s\S]*?scheduleOverviewDetails\(\);[\s\S]*?schedulePolicyArtifacts\(\);/);
assert.doesNotMatch(files.appJs.text, /function observeDeferredSections\(/);
assert.match(files.appJs.text, /window\.requestIdleCallback\(prepareDrop/);
assert.doesNotMatch(files.appJs.text, /scheduleHeroVideo|memoryHeroVideo/);
assert.doesNotMatch(files.html.text, /memory-hero-lite\.mp4|memoryHeroVideo|memory-hero-static|memory-hero-poster\.webp/);
assert.doesNotMatch(files.stylesCss.text, /\.memory-video-hero|\.memory-hero-static|\.memory-hero-content/);
assert.match(files.appJs.text, /function renderNewsBucket\([\s\S]*?rendered < 12[\s\S]*?requestIdleCallback\(appendBatch, \{ timeout: 320 \}\)/);
assert.match(files.stylesCss.text, /\.news-card-item \{[\s\S]*?content-visibility:\s*auto;[\s\S]*?contain-intrinsic-size:\s*auto 340px;/);

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

console.log(JSON.stringify({
  revision,
  rootRuntimeGzipKb: Math.round((files.html.gzipBytes + files.landingMinCss.gzipBytes + files.landingMinJs.gzipBytes) / 1024),
  consoleRuntimeGzipKb: Math.round((files.stylesMinCss.gzipBytes + files.appMinJs.gzipBytes) / 1024),
  heroMedia: "three-image-rotation",
  lazyConsoleTemplate: true,
  progressiveNoScrollHydration: true,
}, null, 2));
