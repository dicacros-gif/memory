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
  accountOnePagerJs: "assets/js/account-one-pagers.js",
  accountOnePagerMinJs: "assets/js/account-one-pagers.min.js",
  companyProfileJs: "assets/js/company-profile.js",
  companyProfileMinJs: "assets/js/company-profile.min.js",
  companyProfileCss: "assets/css/company-profile.css",
  companyProfileMinCss: "assets/css/company-profile.min.css",
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
assert.match(files.html.text, /assets\/js\/company-profile\.min\.js\?v=infra-[a-f0-9]{12}/);
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
assert.match(files.landingJs.text, /window\.setTimeout\(\(\) => scheduleIdleStep\(\(\) => void loadSiteContent\(\)\.then\(scheduleConsoleAssetWarmup\), 120\), 80\)/, "strategy content must hydrate early without waiting for scroll");
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
assert.match(files.appJs.text, /account-one-pagers\.min\.js\?v=/, "account views must be code split from the primary console bundle");
assert.match(files.appJs.text, /window\.AccountStrategyViews/, "lazy account views must use a resilient classic-script fallback");
assert.match(files.appJs.text, /DEFERRED_HEAVY_WARMUP_DELAY_MS\s*=\s*6_500/);
assert.match(files.appJs.text, /waitForWarmupWindow\(definition\)[\s\S]*?preloadDeferredSectionData\(definition\.id\)/);
assert.match(files.appJs.text, /function loadSecondaryData\(requirements = \[\], \{ sequential = false \} = \{\}\)[\s\S]*?ids\.reduce/);
assert.match(files.appJs.text, /section\.dataset\.backgroundPreload = "true";[\s\S]*?preloadDeferredSectionData\(definition\.id\)/);
assert.match(files.appJs.text, /function setupDeferredRecovery\(definitions\)[\s\S]*?window\.addEventListener\("online"[\s\S]*?window\.setInterval\(recover, 60_000\)/);
assert.match(files.appJs.text, /DEFERRED_RETRY_DELAYS\s*=\s*\[900, 2_400, 6_000\][\s\S]*?DEFERRED_RETRY_COOLDOWN_MS\s*=\s*120_000/);
assert.match(files.appJs.text, /function loadJSON\(path, fallback, options = \{\}\)[\s\S]*?options\.attempts[\s\S]*?options\.onFallback/);
assert.match(files.appJs.text, /function scheduleOverviewDetails\(\)/);
assert.match(files.appJs.text, /function scheduleInteractiveEnhancements\(\)/);
assert.match(files.appJs.text, /function schedulePolicyArtifacts\(\)/);
assert.match(files.appJs.text, /performance\.mark\("memory-console-interactive"\);[\s\S]*?window\.dispatchEvent\(new Event\("memory-console-ready"\)\);[\s\S]*?scheduleInteractiveEnhancements\(\);[\s\S]*?scheduleOverviewDetails\(\);[\s\S]*?schedulePolicyArtifacts\(\);/);
assert.doesNotMatch(files.appJs.text, /function observeDeferredSections\(/);
assert.match(files.appJs.text, /window\.requestIdleCallback\(prepareDrop/);
assert.doesNotMatch(files.appJs.text, /scheduleHeroVideo|memoryHeroVideo/);
assert.doesNotMatch(files.html.text, /memory-hero-lite\.mp4|memoryHeroVideo/);
assert.match(files.html.text, /class="memory-video-hero"[\s\S]*?class="memory-hero-static"[\s\S]*?memory-hero-poster\.webp/);
assert.match(files.stylesCss.text, /\.memory-video-hero[\s\S]*?\.memory-hero-static[\s\S]*?\.memory-hero-content/);
assert.match(files.appJs.text, /function renderNewsBucket\([\s\S]*?rendered < 12[\s\S]*?requestIdleCallback\(appendBatch, \{ timeout: 320 \}\)/);
assert.match(files.stylesCss.text, /\.news-card-item \{[\s\S]*?content-visibility:\s*auto;[\s\S]*?contain-intrinsic-size:\s*auto 340px;/);

for (const [sourceKey, minKey, minimumRawSaving] of [
  ["landingCss", "landingMinCss", 0.15],
  ["stylesCss", "stylesMinCss", 0.15],
  ["landingJs", "landingMinJs", 0.18],
  ["appJs", "appMinJs", 0.18],
  ["companyProfileJs", "companyProfileMinJs", 0.18],
]) {
  const minimumPercent = Math.round(minimumRawSaving * 100);
  assert.ok(
    files[minKey].bytes < files[sourceKey].bytes * (1 - minimumRawSaving),
    `${minKey} must reduce raw transfer size by at least ${minimumPercent}%`,
  );
  assert.ok(files[minKey].gzipBytes < files[sourceKey].gzipBytes, `${minKey} must reduce gzip transfer size`);
}

assert.ok(files.appMinJs.gzipBytes < 300 * 1024, "console JavaScript gzip budget must stay below 300KiB");
assert.ok(files.accountOnePagerMinJs.gzipBytes < 5_250, "lazy account intelligence views chunk must stay below 5.25KB gzip");
assert.ok(files.companyProfileMinJs.gzipBytes < 12_000, "company intelligence runtime must stay below 12KB gzip");
assert.ok(files.companyProfileMinCss.gzipBytes < 6_400, "company intelligence styles must stay below 6.4KB gzip");
// The Q&A consulting frame is part of the interactive console bundle. Keep the
// redesign inside a one-KiB allowance rather than dropping contrast or geometry.
assert.ok(files.stylesMinCss.gzipBytes < 107 * 1024, "console CSS gzip budget must stay below 107KiB");

console.log(JSON.stringify({
  revision,
  rootRuntimeGzipKb: Math.round((files.html.gzipBytes + files.landingMinCss.gzipBytes + files.landingMinJs.gzipBytes + files.companyProfileMinJs.gzipBytes) / 1024),
  consoleRuntimeGzipKb: Math.round((files.stylesMinCss.gzipBytes + files.appMinJs.gzipBytes) / 1024),
  heroMedia: "three-image-rotation",
  lazyConsoleTemplate: true,
  progressiveNoScrollHydration: true,
  stagedHeavyDataWarmupMs: 6500,
  deferredRecovery: "bounded-retry-plus-cooldown",
}, null, 2));
