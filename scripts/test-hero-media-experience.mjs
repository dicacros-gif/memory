import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const [html, landing, app, css, fullVideo, liteVideo] = await Promise.all([
  readFile(new URL("index.html", root), "utf8"),
  readFile(new URL("assets/js/landing.js", root), "utf8"),
  readFile(new URL("assets/js/app.js", root), "utf8"),
  readFile(new URL("assets/css/styles.css", root), "utf8"),
  stat(new URL("assets/media/memory-hero.mp4", root)),
  stat(new URL("assets/media/memory-hero-lite.mp4", root)),
]);

const videoTag = html.match(/<video[^>]*id="memoryHeroVideo"[^>]*>/)?.[0] || "";
assert.ok(videoTag, "the Console hero must expose its original background video");
for (const attribute of ["autoplay", "muted", "loop", "playsinline", "disablepictureinpicture", "aria-hidden=\"true\""]) {
  assert.match(videoTag, new RegExp(`(?:\\s|^)${attribute}(?:\\s|=|>)`), `hero video is missing ${attribute}`);
}
assert.match(videoTag, /preload="none"/, "the hero video must not block the Console shell");
assert.match(videoTag, /poster="assets\/media\/memory-hero-poster\.webp"/, "the persistent poster must paint before video hydration");
assert.match(html, /<source media="\(min-width: 1280px\)" data-src="assets\/media\/memory-hero\.mp4" type="video\/mp4"\s*\/?>/);
assert.match(html, /<source data-src="assets\/media\/memory-hero-lite\.mp4" type="video\/mp4"\s*\/?>/);
assert.ok(liteVideo.size < fullVideo.size, "the compact fallback must stay smaller than the original video");
assert.ok(fullVideo.size < 3_000_000 && liteVideo.size < 1_100_000, "hero video transfers must stay within their measured media budgets");

assert.match(html, /id="memoryHeroInsight"[^>]*aria-live="off"[^>]*aria-atomic="true"/);
assert.match(html, /id="overview"[^>]*aria-label="AI Infra 전략 인사이트"[^>]*aria-roledescription="carousel"/, "the rotating region must keep a stable accessible name");
for (const id of ["memoryHeroKicker", "memoryHeroTitle", "memoryHeroSummary", "memoryHeroCounter", "memoryHeroToggle"]) {
  assert.match(html, new RegExp(`id="${id}"`), `missing coordinated hero field ${id}`);
}
assert.doesNotMatch(html, /memory-hero-static/, "the static-only hero must not replace the restored video");

const insightLiteral = landing.match(/const CONSOLE_HERO_INSIGHTS = (\[[\s\S]*?\n  \]);/)?.[1];
assert.ok(insightLiteral, "the hero insight collection must remain a readable source literal");
const insights = vm.runInNewContext(`(${insightLiteral})`);
assert.equal(insights.length, 6, "the hero must rotate six decision insights");
assert.equal(new Set(insights.map((item) => item.title)).size, insights.length, "hero titles must be unique");
for (const item of insights) {
  assert.ok(item.kicker && item.title && item.summary, "every hero insight needs a kicker, title and summary");
}
const approvedLiteral = app.match(/const insightPools = (\[[\s\S]*?\n    \]);/)?.[1];
assert.ok(approvedLiteral, "the approved Console insight pool must remain a readable source literal");
const approvedInsights = vm.runInNewContext(`(${approvedLiteral})`).flat();
for (const item of insights.slice(1)) {
  assert.ok(
    approvedInsights.some((approved) => approved.kicker === item.kicker && approved.title === item.title && approved.body === item.summary),
    `hero insight must reuse one exact approved Console tuple: ${item.title}`,
  );
}

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`unterminated ${name}`);
}

const buildQueue = vm.runInNewContext(`(${extractFunction(landing, "buildHeroInsightQueue")})`);
for (let previous = 0; previous < insights.length; previous += 1) {
  let cursor = 0;
  const samples = [.02, .88, .31, .67, .14, .53, .95];
  const queue = buildQueue(insights.length, previous, () => samples[cursor++ % samples.length]);
  assert.equal(queue.length, insights.length);
  assert.equal(new Set(queue).size, insights.length, "each shuffle bag must contain every insight exactly once");
  assert.notEqual(queue[0], previous, "a new shuffle bag must not repeat the previous insight at its boundary");
}
assert.match(landing, /buildHeroInsightQueue\(CONSOLE_HERO_INSIGHTS\.length, activeIndex\)\.filter\(\(index\) => index !== activeIndex\)/, "the initially visible insight must count as consumed");

assert.match(landing, /const saveData = Boolean\(navigator\.connection\?\.saveData\)/);
assert.match(landing, /const canVideoRun = \(\) => canRun\(\) && videoOptedIn/);
assert.match(landing, /function setupConsoleHeroExperience\(\)[\s\S]*?source\.src = source\.dataset\.src[\s\S]*?video\.load\(\)/, "video bytes must attach only during deferred hydration");
assert.match(landing, /requestIdleCallback[\s\S]*?timeout: 900/, "video hydration must yield to the interactive shell");
assert.match(landing, /CONSOLE_HERO_ROTATION_MS = 6200[\s\S]*?setTimeout\(showNextInsight, CONSOLE_HERO_ROTATION_MS\)/);
assert.match(landing, /resetInsightTransition[\s\S]*?clearTimeout\(transitionTimer\)[\s\S]*?classList\.remove\("is-exiting", "is-entering"\)/);
assert.match(landing, /IntersectionObserver[\s\S]*?heroObserver\?\.observe\(hero\)/, "offscreen hero motion must pause");
assert.match(landing, /visibilitychange[\s\S]*?onVisibilityChange/, "background tabs must pause hero motion");
assert.match(landing, /prefers-reduced-motion: reduce[\s\S]*?onMotionPreferenceChange[\s\S]*?userPaused = true/, "reduced-motion changes must pause motion immediately");
assert.match(landing, /toggle\.addEventListener\("click"[\s\S]*?userPaused = !userPaused[\s\S]*?syncToggle\(\)/, "one control must pause and resume both video and insight rotation");
assert.match(landing, /memory-console-visible/);
assert.match(landing, /memory-console-hidden/);

assert.match(css, /\.memory-hero-video,[\s\S]*?\.memory-hero-shade[\s\S]*?position: sticky/);
assert.match(css, /\.memory-hero-insight\.is-exiting[\s\S]*?translate3d/);
assert.match(css, /\.memory-hero-insight\.is-entering[\s\S]*?transition: none/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.memory-hero-insight[\s\S]*?transition: none/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.memory-hero-toggle[\s\S]*?transform: none/);

console.log(JSON.stringify({
  insights: insights.length,
  fullVideoBytes: fullVideo.size,
  liteVideoBytes: liteVideo.size,
  rotationMs: 6200,
}, null, 2));
