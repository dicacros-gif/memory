import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const [html, landing, css, landingCss, investorVideo, investorPoster] = await Promise.all([
  readFile(new URL("index.html", root), "utf8"),
  readFile(new URL("assets/js/landing.js", root), "utf8"),
  readFile(new URL("assets/css/styles.css", root), "utf8"),
  readFile(new URL("assets/css/landing.css", root), "utf8"),
  stat(new URL("assets/media/investor-equity-hero.mp4", root)),
  stat(new URL("assets/media/investor-equity-hero-poster.webp", root)),
]);

const investorLanding = html.match(
  /<div class="investor-landing" id="investorLanding">[\s\S]*?<div class="business-site" id="businessSite"[^>]*>/,
)?.[0] || "";
assert.ok(investorLanding, "the neutral investor landing must own the public hero");
assert.match(
  html,
  /<h1 class="site-document-title">Global Memory Equity Intelligence<\/h1>/,
  "the investor experience needs one document-level accessible name",
);
assert.match(
  investorLanding,
  /class="investor-brand"[^>]*aria-label="Global Memory Equity Intelligence 홈"/,
  "the investor brand link needs a stable accessible name",
);
assert.match(investorLanding, /<nav class="investor-nav" aria-label="투자 리서치 메뉴">/, "the investor navigation must be named");

const investorVideoTag = investorLanding.match(/<video[^>]*class="investor-hero-video"[^>]*>/)?.[0] || "";
assert.ok(investorVideoTag, "the investor hero must keep its background video");
for (const attribute of ["autoplay", "muted", "loop", "playsinline", 'aria-hidden="true"']) {
  assert.match(investorVideoTag, new RegExp(`(?:\\s|^)${attribute}(?:\\s|=|>)`), `investor hero video is missing ${attribute}`);
}
assert.match(investorVideoTag, /preload="metadata"/, "the lightweight investor video must avoid eager full transfer");
assert.match(investorVideoTag, /poster="assets\/media\/investor-equity-hero-poster\.webp"/, "the investor hero needs a neutral persistent poster");
assert.match(
  investorLanding,
  /<source src="assets\/media\/investor-equity-hero\.mp4" type="video\/mp4"\s*\/>/,
  "the public landing must use the neutral investor hero asset",
);
assert.match(
  investorLanding,
  /<section class="investor-hero" id="home">[\s\S]*?<h2>AI·메모리 사이클,[\s\S]*?주가와 밸류체인[\s\S]*?으로 해석<\/h2>/,
  "the hero heading must state the investor purpose",
);

const investorActions = investorLanding.match(/<div class="investor-hero-actions">([\s\S]*?)<\/div>/)?.[1] || "";
const investorCtas = [...investorActions.matchAll(/<a\s+([^>]*)>([\s\S]*?)<\/a>/g)];
assert.equal(investorCtas.length, 2, "the hero must expose two focused investor actions");
assert.deepEqual(
  investorCtas.map(([, attrs]) => attrs.match(/href="([^"]+)"/)?.[1]),
  ["#console/investor-overview", "#console/equity-value-chain"],
  "hero actions must deep-link to the overview and value-chain chart",
);
for (const [, attrs, label] of investorCtas) {
  assert.match(attrs, /data-open-console/, "each investor action must use the Console transition controller");
  assert.ok(label.replace(/<[^>]+>/g, "").trim().length >= 6, "each investor action needs a useful accessible label");
}
assert.match(investorLanding, /공개 정보 기반 리서치 도구 · 투자 권유가 아니며/, "the hero must retain its investment disclaimer");

assert.match(
  landingCss,
  /\.investor-hero-video\s*\{[\s\S]*?object-fit:\s*cover;[\s\S]*?brightness\(\.56\);/,
  "the investor video must fill the hero while preserving copy contrast",
);
assert.match(
  landingCss,
  /\.investor-console-cta:is\(:hover, :focus-visible\),[\s\S]*?\.investor-hero-actions a:is\(:hover, :focus-visible\)/,
  "hero actions must expose the same visible keyboard focus treatment as hover",
);
assert.match(
  landingCss,
  /@media \(max-width: 700px\)[\s\S]*?\.investor-hero-lenses\s*\{\s*grid-template-columns:\s*1fr;/,
  "the investor hero must reflow its lenses on phones",
);
assert.match(
  landingCss,
  /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.investor-hero-video\s*\{\s*display:\s*none;[\s\S]*?\.investor-console-cta, \.investor-hero-actions a\s*\{\s*transition:\s*none;/,
  "the public hero must replace motion with its poster and remove CTA transitions when requested",
);

const videoTag = html.match(/<video[^>]*id="memoryHeroVideo"[^>]*>/)?.[0] || "";
assert.ok(videoTag, "the Console hero must expose its original background video");
for (const attribute of ["autoplay", "muted", "loop", "playsinline", "disablepictureinpicture", "aria-hidden=\"true\""]) {
  assert.match(videoTag, new RegExp(`(?:\\s|^)${attribute}(?:\\s|=|>)`), `hero video is missing ${attribute}`);
}
assert.match(videoTag, /preload="none"/, "the hero video must not block the Console shell");
assert.match(videoTag, /poster="assets\/media\/investor-equity-hero-poster\.webp"/, "the neutral poster must paint before video hydration");
assert.match(html, /<source data-src="assets\/media\/investor-equity-hero\.mp4" type="video\/mp4"\s*\/?>/);
assert.doesNotMatch(investorLanding, /memory-hero(?:-lite)?\.mp4|memory-hero-poster\.webp/, "the public landing must not reuse the issuer-branded hero media");
assert.ok(investorVideo.size < 1_300_000 && investorPoster.size < 100_000, "neutral hero media transfers must stay within their measured budgets");

assert.match(html, /id="memoryHeroInsight"[^>]*aria-live="off"[^>]*aria-atomic="true"/);
assert.match(html, /id="overview"[^>]*aria-label="반도체 투자 인사이트"[^>]*aria-roledescription="carousel"/, "the rotating investor region must keep a stable accessible name");
for (const id of ["memoryHeroKicker", "memoryHeroTitle", "memoryHeroSummary", "memoryHeroCounter"]) {
  assert.match(html, new RegExp(`id="${id}"`), `missing coordinated hero field ${id}`);
}
assert.doesNotMatch(html, /id="memoryHeroToggle"|class="memory-hero-toggle"/, "the hero pause control must stay removed");
assert.doesNotMatch(html, /memory-hero-static/, "the static-only hero must not replace the restored video");

const insightLiteral = landing.match(/const CONSOLE_HERO_INSIGHTS = (\[[\s\S]*?\n  \]);/)?.[1];
assert.ok(insightLiteral, "the hero insight collection must remain a readable source literal");
const insights = vm.runInNewContext(`(${insightLiteral})`);
assert.equal(insights.length, 6, "the hero must rotate six decision insights");
assert.equal(new Set(insights.map((item) => item.title)).size, insights.length, "hero titles must be unique");
for (const item of insights) {
  assert.ok(item.kicker && item.title && item.summary, "every hero insight needs a kicker, title and summary");
}
assert.equal(
  insights.map((item) => item.kicker).join("\n"),
  [
    "AI DEMAND → MEMORY EQUITIES",
    "MARKET CYCLE",
    "LISTED EQUITY UNIVERSE",
    "VALUE-CHAIN READ-THROUGH",
    "EARNINGS SENSITIVITY",
    "THESIS INVALIDATION",
  ].join("\n"),
  "the rotating narrative must cover the complete neutral investor decision path",
);
assert.doesNotMatch(
  JSON.stringify(insights),
  /SKHY|SK hynix|하이닉스 관점|고객 영업|Account Play/i,
  "the public hero must not privilege one issuer or revert to a vendor-sales narrative",
);
assert.equal(insights[0].title, "메모리 사이클을 종목과 밸류체인으로 연결", "the first rotating frame must match the investor overview heading");

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

assert.doesNotMatch(landing, /videoOptedIn|userPaused|syncToggle/, "manual video pause state must stay removed");
assert.match(landing, /const canVideoRun = \(\) => canRun\(\)/);
assert.match(landing, /function setupConsoleHeroExperience\(\)[\s\S]*?source\.src = source\.dataset\.src[\s\S]*?video\.load\(\)/, "video bytes must attach only during deferred hydration");
assert.match(landing, /requestIdleCallback[\s\S]*?timeout: 900/, "video hydration must yield to the interactive shell");
assert.match(landing, /CONSOLE_HERO_ROTATION_MS = 6200[\s\S]*?setTimeout\(showNextInsight, CONSOLE_HERO_ROTATION_MS\)/);
assert.match(landing, /resetInsightTransition[\s\S]*?clearTimeout\(transitionTimer\)[\s\S]*?classList\.remove\("is-exiting", "is-entering"\)/);
assert.match(landing, /IntersectionObserver[\s\S]*?heroObserver\?\.observe\(hero\)/, "offscreen hero motion must pause");
assert.match(landing, /visibilitychange[\s\S]*?onVisibilityChange/, "background tabs must pause hero motion");
assert.match(landing, /onMotionPreferenceChange[\s\S]*?resetInsightTransition\(\)[\s\S]*?scheduleRotation\(\)/, "reduced-motion changes must simplify insight motion without stopping video playback");
assert.match(landing, /video\.addEventListener\("pause", recoverVideoPlayback\)[\s\S]*?video\.addEventListener\("ended", recoverVideoPlayback\)/, "visible hero video must recover from an unexpected stop");
assert.match(landing, /memory-console-visible/);
assert.match(landing, /memory-console-hidden/);

assert.match(css, /\.memory-hero-video,[\s\S]*?\.memory-hero-shade[\s\S]*?position: sticky/);
assert.match(css, /\.memory-hero-insight\.is-exiting[\s\S]*?translate3d/);
assert.match(css, /\.memory-hero-insight\.is-entering[\s\S]*?transition: none/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.memory-hero-insight[\s\S]*?transition: none/);
assert.doesNotMatch(css, /\.memory-hero-toggle/, "removed hero pause control must not leave dead CSS");

console.log(JSON.stringify({
  insights: insights.length,
  investorVideoBytes: investorVideo.size,
  investorPosterBytes: investorPoster.size,
  rotationMs: 6200,
}, null, 2));
