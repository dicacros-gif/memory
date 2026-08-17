import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [html, css, landing] = await Promise.all([
  readFile(new URL("index.html", root), "utf8"),
  readFile(new URL("assets/css/landing.css", root), "utf8"),
  readFile(new URL("assets/js/landing.js", root), "utf8"),
]);

const heroList = html.match(/<ul class="business-hero-thesis business-copy-list"[\s\S]*?<\/ul>/)?.[0] ?? "";
assert.equal((heroList.match(/<li>/g) ?? []).length, 3, "hero thesis must contain three Korean bullets");
const heroScope = html.match(/<ul class="business-hero-bullets"[\s\S]*?<\/ul>/)?.[0] ?? "";
assert.equal((heroScope.match(/<li>/g) ?? []).length, 3, "hero scope must contain three intact strategy rows");
assert.doesNotMatch(heroScope, /Partner &amp; Execution/, "the clipped Partner & Execution row must stay removed");
assert.doesNotMatch(html, />[^<]*Workbench[^<]*</i, "Workbench must not appear in user-facing copy");
assert.doesNotMatch(html, /id="businessHomeQueueMetrics"/, "the redundant homepage automation metrics row must stay removed");
assert.doesNotMatch(css, /\.business-decision-queue-metrics/, "removed homepage metrics must not leave layout CSS behind");

const answerLists = [...html.matchAll(/<ul class="business-answer-bullets">([\s\S]*?)<\/ul>/g)];
assert.equal(answerLists.length, 4, "each decision case must use a bullet answer");
for (const [, content] of answerLists) {
  assert.equal((content.match(/<li>/g) ?? []).length, 3, "each decision answer must contain three concise bullets");
}

for (const phrase of [
  "고객 현황·기술·전략과 Workload Trace에서 우선 해결할 Pain Point 구조화",
  "고객 문제와 구매 기준",
  "공식 · 표준 · 논문 · 시장 신호",
  "칩 Roadmap · 메모리 요구사항",
  "의사결정 변화 · 실행 Trigger 우선",
  "시장성 · 차별화 · 단위경제성",
]) assert.ok(html.includes(phrase), `missing Korean supporting copy: ${phrase}`);

assert.doesNotMatch(html, /메모리를 판매하는 것이 아니라/);
assert.doesNotMatch(html, /직무 적합성을 세 가지/);
assert.match(html, /infra-20260817-56/);
assert.match(css, /\.business-copy-list li::before/);
assert.match(css, /Korean supporting copy uses compact consulting-style bullets/);
assert.match(css, /\.business-site p\.business-copy-point::before/);
assert.match(landing, /function removeBusinessSentenceStops\(value = ""\)/);
assert.match(landing, /function compactBusinessCopy\(value = "", maxCharacters = 84\)/);
assert.match(landing, /function applyExecutiveCopyStyle\(root = site, policy = \{\}\)/);
assert.match(landing, /paragraphMaxCharacters \|\| 92/);
assert.match(landing, /listMaxCharacters \|\| 78/);
assert.match(landing, /memory-console-ready[\s\S]*?applyExecutiveCopyStyle\(consoleRoot/, "dynamically rendered Console copy must use the executive bullet policy");

console.log(JSON.stringify({
  heroBullets: 3,
  decisionAnswerLists: answerLists.length,
  revision: "infra-20260817-56",
}, null, 2));
