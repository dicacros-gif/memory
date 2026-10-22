import assert from "node:assert/strict";
import { buildQualityReport, isRetailDealNews } from "./crawl.mjs";
import { normalizeKoreanTerminology } from "./translation-pipeline.mjs";
import { achievedStageMatch } from "./decision-intelligence.mjs";

// A faithful Korean summary can be shorter than its English source; the
// summary floor is about the source text the evidence gate validated.
const article = (index, summary) => ({
  title: `Memory article ${index}`,
  sourceUrl: `https://example.com/news/${index}`,
  summaryOriginal: "Micron shares fell five percent after guidance.",
  summary,
  language: "english",
});
const news = Array.from({ length: 30 }, (_, index) => article(index, index === 0 ? "마이크론 주가 5% 하락" : undefined));
const report = buildQualityReport({ news });
const summaries = report.checks.find((check) => check.id === "news_summaries");
assert.ok(summaries, "the quality report carries the news_summaries check");
assert.equal(summaries.passed, true, "a short verified translation must not fail the source-summary check");

const missing = buildQualityReport({ news: [...news, { ...article(99), summaryOriginal: "", summary: "" }] });
assert.equal(missing.checks.find((check) => check.id === "news_summaries").passed, false, "an article without any source summary still fails the gate");

// Retail shopping posts are quarantined; industry news written with the same
// words is not.
for (const title of [
  "Save $249 on 32GB of DDR5 with this 3-item Newegg bundle",
  "Score a 1440p-ready gaming PC with an RTX 5060 Ti 16GB for under $1,500 right now",
  "4TB Samsung 990 Pro M.2 SSD falls 27%, hits 20 cents per gig",
  "Pick up this DDR5 gaming PC for only $899",
]) assert.equal(isRetailDealNews({ title }), true, title);
for (const title of [
  "Samsung strikes deal with Nvidia for HBM4 supply",
  "DRAM spot prices hit record low",
  "SK hynix to save $2 billion via process shift",
  "Intel sells Altera stake for under $9 billion",
  "Nvidia shares 20% off peak",
]) assert.equal(isRetailDealNews({ title }), false, title);

// Everyday-sense mistranslations of chip terms are corrected; the same words
// outside the chip sense are left alone.
assert.equal(normalizeKoreanTerminology("기억력의 약화가 진입점을 만들었다"), "메모리의 약화가 진입점을 만들었다");
assert.equal(normalizeKoreanTerminology("HBM 생산 및 첨단 포장 시설"), "HBM 생산 및 첨단 패키징 시설");
assert.equal(normalizeKoreanTerminology("포장 장비 업체"), "패키징 장비 업체");
assert.equal(normalizeKoreanTerminology("도로 포장 공사"), "도로 포장 공사");

// A stage keyword in intent form is a plan, not an achieved stage.
const ADOPTION = "platform adoption|selected for|powered by|탑재|채택";
assert.equal(achievedStageMatch("HBM4가 NVIDIA Rubin에 탑재될 예정", ADOPTION), false);
assert.equal(achievedStageMatch("Rubin will be powered by HBM4", ADOPTION), false);
assert.equal(achievedStageMatch("Samsung is expected to be selected for the program", ADOPTION), false);
assert.equal(achievedStageMatch("HBM4를 Rubin에 탑재했으며 내년 양산 확대 예정", ADOPTION), true);
assert.equal(achievedStageMatch("Rubin is powered by HBM4", ADOPTION), true);

// Rewrites keep the source's hedges: reported, scheduled, analysts' view.
const hedged = normalizeKoreanTerminology("SKHY가 실리콘밸리에 고대역폭 메모리(HBM) 설계팀을 꾸리는 것으로 알려지면서 미국의 주요 칩 고객사와 공동 설계 작업을 심화할 예정이다. 분석가들은 이를 HBM 경쟁이 맞춤형, 공동 개발 단계로 전환하고 있다는 증거로 보고 있습니다.");
assert.match(hedged, /보도/);
assert.match(hedged, /예정/);
assert.match(hedged, /분석가/);

console.log(JSON.stringify({ qualityGate: "pass" }));
