import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [html, app, css, landingCss] = await Promise.all([
  readFile(new URL("index.html", root), "utf8"),
  readFile(new URL("assets/js/app.js", root), "utf8"),
  readFile(new URL("assets/css/styles.css", root), "utf8"),
  readFile(new URL("assets/css/landing.css", root), "utf8"),
]);

const position = (token) => {
  const index = html.indexOf(token);
  assert.notEqual(index, -1, `missing ${token}`);
  return index;
};

assert.ok(
  position('id="overview-content"') < position('id="visual-bridge-system"')
    && position('id="visual-bridge-system"') < position('id="c-level-cockpit"'),
  "system visual bridge must follow the text-heavy Executive Summary",
);
assert.ok(
  position('id="executive-decision"') < position('id="visual-bridge-execution"')
    && position('id="visual-bridge-execution"') < position('id="management-strategy"'),
  "execution visual bridge must follow the decision backtest",
);
assert.ok(
  position('id="hyperscaler-demand"') < position('id="visual-bridge-demand"')
    && position('id="visual-bridge-demand"') < position('id="workbench"'),
  "demand visual bridge must follow customer demand forecasting",
);
assert.ok(
  position('id="ai-matrix"') < position('id="visual-bridge-competition"')
    && position('id="visual-bridge-competition"') < position('id="china-benchmark-video-story"'),
  "competitive visual bridge must follow the text-heavy AI memory matrix",
);

assert.match(app, /function distributeVisualStories\(\)[\s\S]*?visual-bridge-system[\s\S]*?memory-visual-story[\s\S]*?visual-bridge-execution[\s\S]*?memory-scroll-story[\s\S]*?visual-bridge-demand[\s\S]*?ai-demand-scroll-story[\s\S]*?visual-bridge-competition[\s\S]*?competitive-scroll-story/);
assert.match(app, /document\.body\.classList\.add\("consulting-system"\);\s*distributeVisualStories\(\);\s*setupMediaExperience\(\);/, "visuals must be distributed before media initialization");
assert.match(app, /let storyInView = false;[\s\S]*?const canAutoPlay = \(\) => storyInView/, "offscreen visual stories must not autoplay");
assert.match(app, /storyVisibilityObserver[\s\S]*?rootMargin: "240px 0px"[\s\S]*?storyVisibilityObserver\.observe\(story\)/, "the carousel must hydrate near its new reading position");

for (const phrase of [
  "워크로드 병목에서 메모리 요구사항을 도출",
  "검증된 판단을 Owner·KPI·Stage-Gate로 전환",
  "Agentic·RAG 수요는",
  "PoC → Qualification → Binding Order → Revenue Recognition",
  "경쟁사 비교를 고객 승률과 실행 조건으로 전환",
  "점유율보다 고객·Workload별",
  "Partner RACI",
  "Kill Criteria",
]) assert.ok(html.includes(phrase) || app.includes(phrase), `missing contextual visual insight: ${phrase}`);

assert.match(css, /Distributed visual synthesis bridges/);
assert.match(css, /\.visual-insight-bridge-head\s*\{[\s\S]*?grid-template-columns:/);
assert.match(css, /\.visual-insight-route\s*\{[\s\S]*?grid-template-columns:/);
assert.match(css, /@media \(max-width: 680px\)[\s\S]*?\.visual-insight-route\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
assert.match(css, /Hidden-state layout contract[\s\S]*?\.consulting-system \[hidden\][\s\S]*?display:\s*none !important;/, "hidden image modules must not leak into the main reading flow");
assert.match(html, /class="memory-visual-story"[^>]*data-surface="dark"[^>]*data-slide-tone="subtle-black"/, "the three-image carousel must declare its subdued dark surface");
assert.equal((html.match(/data-memory-slide=/g) || []).length, 3, "the dark carousel must keep exactly three slides");
assert.match(app, /const transitionModes = \["fade", "sweep", "glide"\]/, "the dark carousel must use only gentle transitions");
assert.match(css, /Dark three-slide carousel treatment[\s\S]*?memoryStoryDarkSlide[\s\S]*?memoryStoryDarkLeave/, "the dark carousel must combine a black image treatment with subtle horizontal motion");
assert.equal((html.match(/class="business-hero-media-slide"/g) || []).length, 3, "the first-page black surface must contain exactly three background images");
assert.match(landingCss, /@keyframes businessHeroMediaSlide[\s\S]*?opacity:\s*1[\s\S]*?opacity:\s*0/, "the hero background must crossfade gently");
assert.match(landingCss, /prefers-reduced-motion:\s*reduce[\s\S]*?business-hero-media-slide[\s\S]*?animation:\s*none/, "the hero background must respect reduced motion");

console.log(JSON.stringify({
  bridges: 4,
  visualModules: 4,
  revision: "infra-20260901-04",
}, null, 2));
