import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [html, app, css] = await Promise.all([
  readFile(new URL("index.html", root), "utf8"),
  readFile(new URL("assets/js/app.js", root), "utf8"),
  readFile(new URL("assets/css/styles.css", root), "utf8"),
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

assert.match(app, /function distributeVisualStories\(\)[\s\S]*?visual-bridge-system[\s\S]*?memory-visual-story[\s\S]*?visual-bridge-execution[\s\S]*?memory-scroll-story[\s\S]*?visual-bridge-demand[\s\S]*?ai-demand-scroll-story/);
assert.match(app, /document\.body\.classList\.add\("consulting-system"\);\s*distributeVisualStories\(\);\s*setupMediaExperience\(\);/, "visuals must be distributed before media initialization");
assert.match(app, /let storyInView = false;[\s\S]*?const canAutoPlay = \(\) => storyInView/, "offscreen visual stories must not autoplay");
assert.match(app, /storyVisibilityObserver[\s\S]*?rootMargin: "240px 0px"[\s\S]*?storyVisibilityObserver\.observe\(story\)/, "the carousel must hydrate near its new reading position");

for (const phrase of [
  "워크로드 병목에서 메모리 요구사항을 도출",
  "검증된 판단을 Owner·KPI·Stage-Gate로 전환",
  "RAG·Vector DB가",
  "LOI와 전망을 확정 주문으로 계산하지 않음",
  "Partner RACI",
  "Kill Criteria",
]) assert.ok(html.includes(phrase) || app.includes(phrase), `missing contextual visual insight: ${phrase}`);

assert.match(css, /Distributed visual synthesis bridges/);
assert.match(css, /\.visual-insight-bridge-head\s*\{[\s\S]*?grid-template-columns:/);
assert.match(css, /\.visual-insight-route\s*\{[\s\S]*?grid-template-columns:/);
assert.match(css, /@media \(max-width: 680px\)[\s\S]*?\.visual-insight-route\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);

console.log(JSON.stringify({
  bridges: 3,
  visualModules: 3,
  revision: "infra-20260817-39",
}, null, 2));
