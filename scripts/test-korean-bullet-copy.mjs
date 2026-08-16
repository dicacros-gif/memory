import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [html, css] = await Promise.all([
  readFile(new URL("index.html", root), "utf8"),
  readFile(new URL("assets/css/landing.css", root), "utf8"),
]);

const heroList = html.match(/<ul class="business-hero-thesis business-copy-list"[\s\S]*?<\/ul>/)?.[0] ?? "";
assert.equal((heroList.match(/<li>/g) ?? []).length, 3, "hero thesis must contain three Korean bullets");

const answerLists = [...html.matchAll(/<ul class="business-answer-bullets">([\s\S]*?)<\/ul>/g)];
assert.equal(answerLists.length, 4, "each decision case must use a bullet answer");
for (const [, content] of answerLists) {
  assert.equal((content.match(/<li>/g) ?? []).length, 3, "each decision answer must contain three concise bullets");
}

for (const phrase of [
  "Business Outcome → Workload·SLO → 지배 병목을 먼저 계측",
  "고객 문제와 구매 기준",
  "공식 · 표준 · 논문 · 시장 신호",
  "칩 Roadmap · 메모리 요구사항",
  "의사결정 변화 · 실행 Trigger 우선",
  "시장 매력도 · Right to Win · 사업성",
]) assert.ok(html.includes(phrase), `missing Korean supporting copy: ${phrase}`);

assert.doesNotMatch(html, /메모리를 판매하는 것이 아니라/);
assert.doesNotMatch(html, /직무 적합성을 세 가지/);
assert.match(html, /infra-20260816-22/);
assert.match(css, /\.business-copy-list li::before/);
assert.match(css, /Korean supporting copy uses compact consulting-style bullets/);

console.log(JSON.stringify({
  heroBullets: 3,
  decisionAnswerLists: answerLists.length,
  revision: "infra-20260816-22",
}, null, 2));
