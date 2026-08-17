import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { executiveBulletCopy, normalizeHtmlExecutiveCopy } from "./executive-copy.mjs";

const root = new URL("../", import.meta.url);
const [html, css, landing, app] = await Promise.all([
  readFile(new URL("index.html", root), "utf8"),
  readFile(new URL("assets/css/landing.css", root), "utf8"),
  readFile(new URL("assets/js/landing.js", root), "utf8"),
  readFile(new URL("assets/js/app.js", root), "utf8"),
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
assert.match(html, /infra-20260817-70/);
assert.match(css, /\.business-copy-list li::before/);
assert.match(css, /Korean supporting copy uses compact consulting-style bullets/);
assert.match(css, /\.business-site p\.business-copy-point::before/);
assert.match(landing, /function removeBusinessSentenceStops\(value = ""\)/);
assert.match(landing, /function compactBusinessCopy\(value = "", maxCharacters = 84\)/);
assert.match(landing, /function applyExecutiveCopyStyle\(root = site, policy = \{\}\)/);
assert.match(landing, /function executiveBusinessBulletText\(value = ""\)/);
assert.match(landing, /function removeDiscardedBusinessSentence\(value = ""\)/, "the landing page must remove the discarded clipped evidence sentence");
assert.match(landing, /Investing\\\.com에 따르면 KeyBanc 기술 리더십 포럼 2026에서/, "the clipped KeyBanc attribution must remain covered by the display filter");
assert.match(landing, /liveSummary\.hidden = !summaryCopy/, "an empty evidence summary must leave no visual gap");
assert.match(landing, /summary\.hidden = !summaryCopy/, "refreshed evidence must use the same removal policy");
assert.match(landing, /paragraphMaxCharacters \|\| 92/);
assert.match(landing, /listMaxCharacters \|\| 78/);
assert.match(landing, /memory-console-ready[\s\S]*?applyExecutiveCopyStyle\(consoleRoot/, "dynamically rendered Console copy must use the executive bullet policy");
assert.match(app, /function executiveBulletText\(value = ""\)/);
assert.doesNotMatch(app.match(/const BRIEF_COPY_EXEMPT_SELECTOR[\s\S]*?\.join\(","\);/)?.[0] || "", /\.agent-answer|\.qa-answer|\.answer-panel/, "generated answers must follow the bullet-copy policy");

const discardedCopyFunction = landing.match(/function removeDiscardedBusinessSentence\(value = ""\) \{[\s\S]*?\n  \}/)?.[0] || "";
const removeDiscardedBusinessSentence = Function(`${discardedCopyFunction}; return removeDiscardedBusinessSentence;`)();
assert.equal(
  removeDiscardedBusinessSentence("메모리 거대 기업은 맞춤형 HBM을 선택 중. Investing.com에 따르면 KeyBanc 기술 리더십 포럼 2026에서 Micron EVP는 맞춤형 SKU에 대해 고객과 협력할 계획이라고 말했습니다."),
  "메모리 거대 기업은 맞춤형 HBM을 선택 중",
  "the clipped attribution sentence must be removed without deleting the useful lead",
);

for (const [source, expected] of [
  ["검증된 근거를 표시합니다.", "검증된 근거를 표시"],
  ["투자를 확대하지 않습니다.", "투자를 확대하지 않음"],
  ["세 가지 옵션이 있습니다.", "세 가지 옵션이 있음"],
  ["고객 검증이 필요합니다.", "고객 검증이 필요"],
  ["실제 고객 성과가 아닙니다.", "실제 고객 성과가 아님"],
  ["경제성 관점에서 봅니다.", "경제성 관점에서 판단"],
]) assert.equal(executiveBulletCopy(source), expected, `sentence ending must become an executive bullet: ${source}`);

const visibleMarkup = html
  .replace(/<(script|style|code|pre|textarea|option)\b[\s\S]*?<\/\1>/gi, "")
  .replace(/<[^>]+>/g, "\n");
assert.doesNotMatch(visibleMarkup, /[가-힣]+다(?:[.!?。]|\s*$)/m, "static user-facing copy must not end in 다");
assert.equal(normalizeHtmlExecutiveCopy(html), html, "checked-in HTML must already use normalized executive bullets");

console.log(JSON.stringify({
  heroBullets: 3,
  decisionAnswerLists: answerLists.length,
  revision: "infra-20260817-70",
}, null, 2));
