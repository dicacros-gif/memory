import assert from "node:assert/strict";
import "./test-qa-brief.mjs";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { executiveBulletCopy, normalizeHtmlExecutiveCopy } from "./executive-copy.mjs";
import { conflictingNewsFigures, isEditorialNewsItem } from "../assets/js/news-identity.js";
import { isLocalizationDisplayTextSafe } from "../assets/js/news-localization.js";
import { sameNewsStory, dedupeEnrichedNews, publishVerifiedBundle } from "./crawl.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
assert.equal(isEditorialNewsItem({sourceUrl:"https://www.kucoin.com/news/sandisk-investment"}),false);
assert.equal(isEditorialNewsItem({sourceUrl:"https://www.trendforce.com/price/dram/dram_spot"}),false);
assert.equal(isEditorialNewsItem({sourceUrl:"https://www.sandisk.com/company/newsroom/press-releases/2026/2026-08-20-new-memory"}),true);
assert.equal(isEditorialNewsItem({url:"https://example.com/article"}),true, "legacy URL field remains supported");
assert.equal(isEditorialNewsItem({sourceUrl:"https://example.com/news",summaryKo:"시장 연구 보고서를 제공하여 기업의 경쟁력을 높입니다."}),false);
const [app, landing, html] = await Promise.all([read("assets/js/app.js"), read("assets/js/landing.js"), read("index.html")]);
const extract = (source, name) => {
  const start = source.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, `missing ${name}`);
  return source.slice(start, source.indexOf("\n  function ", start + 1));
};
const context = vm.createContext({ executiveBulletCopy, conflictingNewsFigures, isLocalizationDisplayTextSafe,
  normalizeBrandName: v => v, normalizeConsoleDateCopy: v => v, dedupeRepeatedDisplayCopy: v => v,
  stripTrailingSource: v => v, uniqueSourceLabel: v => v, cleanKoreanTitle: v => v,
  SOURCE_SUFFIX_RE: /\s+-\s+Publisher$/, newsPublisherText: v => v.source || "", articleStreamLanguage: () => "english", URL });
for (const name of ["executiveBulletText", "canonicalNewsUrlKey", "canonicalNewsTitleKey", "canonicalNewsStoryKey", "mergeNewsDuplicate", "dedupeNews", "newsDecisionSignificance", "compareNewsItems"]) vm.runInContext(extract(app, name), context);
context.newsTimestamp = item => Date.parse(item.date) || 0;
context.newsAuthorityScore = () => 1;
context.canonicalNewsKey = context.canonicalNewsUrlKey;
vm.runInContext(extract(landing, "executiveBusinessBulletText"), context);
vm.runInContext(extract(app, "publishablePlayerStatement"), context);
vm.runInContext(extract(app, "playerAliasPattern"), context);
assert.ok(context.playerAliasPattern(["AWS", "Amazon"]).test("Amazon AI investment"));
assert.doesNotMatch(extract(app, "industryShiftPlayerHTML"), /playerAliasPattern\(player\)/, "the card passes aliases, not its object, to the matcher");
for (const text of ["s infrastructure, including expanding its AI fleet with AMD", "s Supply Commitments Soar to $279B", "AI 搶記憶體產能，Google 要求 Android 應用程式降低占用系統資源"]) {
  assert.equal(context.publishablePlayerStatement({text,kind:"직접 인용",url:"https://example.com/article"}),false);
}
for (const [input, expected] of [
  ["캐나다", "캐나다"], ["혼다", "혼다"], ["프라다", "프라다"],
  ["수요가 좋다.", "수요가 좋음"], ["시장 규모가 크다.", "시장 규모가 큼"],
  ["가격이 다릅니다.", "가격이 다름"], ["공급이 빠릅니다.", "공급이 빠름"],
  ["가격이 올랐다.", "가격이 올랐음"],
  ["HBM 48GB · $20 billion · 다만 고객 인증이 필요합니다.", "HBM 48GB · $20 billion · 다만 고객 인증이 필요"],
]) for (const convert of [executiveBulletCopy, context.executiveBulletText, context.executiveBusinessBulletText]) {
  assert.equal(convert(input), expected);
  assert.equal(convert(convert(input)), expected, "copy conversion must be idempotent");
}
const quote = '<blockquote>수요가 좋다.</blockquote><q>가격이 다릅니다.</q>';
assert.equal(normalizeHtmlExecutiveCopy(quote), quote, "quotations must not be rewritten");
assert.match(app, /"q", "blockquote", "\[data-copy-verbatim\]"/);
assert.match(landing, /q, blockquote, \[data-copy-verbatim\]/);
assert.doesNotMatch(html, /id="(?:consoleDataStatus|industryShiftMeta|newsStats)"/);
assert.doesNotMatch(extract(app, "renderIndustryShift"), /6시간|검증 회차|기준 프레임.*작성/);
assert.doesNotMatch(extract(app, "industryShiftChainHTML"), /<em>|counterLabel/);
assert.doesNotMatch(extract(app, "industryShiftLedgerHTML"), /slice\(0, 180\)|seenCount|<time>/);
assert.doesNotMatch(extract(app, "renderNumberAnalysis"), /fmtDate\(LIVE.updatedAt\)/);
assert.match(extract(app, "setFreshness"), /node.hidden = true/);
assert.doesNotMatch(extract(landing, "compactBusinessCopy"), /split\(.*1\)|selected\.join/);

const first = { title: "NVIDIA announces a major expansion of its global accelerator production capacity investment at $10 billion", source: "Reuters", sourceUrl: "https://reuters.com/technology/investment-10", date: "2026-09-02" };
const revised = { ...first, title: first.title.replace("$10", "$20"), sourceUrl: "https://reuters.com/technology/investment-20" };
assert.equal(sameNewsStory(first, revised), false);
assert.equal(dedupeEnrichedNews([first, revised, first]).length, 2);
assert.equal(context.dedupeNews([first, revised, first]).length, 2);
assert.equal(context.dedupeNews([first, revised, { ...first, sourceUrl: "https://example.com/syndicated" }]).length, 2);
const originalTitleKey = context.canonicalNewsTitleKey;
let keyEvaluations = 0;
context.canonicalNewsTitleKey = item => { keyEvaluations += 1; return originalTitleKey(item); };
context.dedupeNews(Array.from({length:200}, (_, i) => ({...first, title:`${String.fromCharCode(65+i%26)}${String.fromCharCode(65+Math.floor(i/26))} memory architecture qualification`, sourceUrl:`https://example.com/article-${i}`})));
assert.ok(keyEvaluations <= 200, "new titles must use indexed candidates, not rescan the entire retained archive");
context.canonicalNewsTitleKey = originalTitleKey;
const lowImpact = { ...first, title: "NVIDIA stock price weekly roundup", sourceUrl: "https://example.com/roundup" };
const decision = { ...first, title: "NVIDIA HBM qualification and supply agreement", sourceUrl: "https://example.com/agreement" };
assert.ok(context.compareNewsItems(decision, lowImpact) < 0, "decision evidence must precede same-week stock commentary");
const ranked = [first, revised, lowImpact, decision];
for (const a of ranked) for (const b of ranked) for (const c of ranked) {
  if (context.compareNewsItems(a,b) <= 0 && context.compareNewsItems(b,c) <= 0) assert.ok(context.compareNewsItems(a,c) <= 0, "ranking must be transitive");
}
const other = { ...first, source: "Other publisher", sourceUrl: "https://example.com/news/nvidia-investment", summaryOriginal: "Text supplied only by the other publisher." };
for (const row of [dedupeEnrichedNews([first, other])[0], context.mergeNewsDuplicate(first, other)]) {
  assert.equal(row.summaryOriginal, row.sourceUrl === first.sourceUrl ? first.summaryOriginal : other.summaryOriginal, "a source cannot borrow another publisher's text");
}
const verified = JSON.parse(await read("data/live.json"));
let writes = 0;
const write = async () => { writes += 1; };
await publishVerifiedBundle(structuredClone(verified), [], { write });
assert.equal(writes, 1);
const pruned = structuredClone(verified); pruned.news = [];
writes = 0;
await assert.rejects(publishVerifiedBundle(pruned, [], { write }), e => e.code === "UNVERIFIED_PUBLICATION");
assert.equal(writes, 0, "a rejected final payload cannot overwrite last-known-good content");
const mismatched = structuredClone(verified);
mismatched.intelligence.briefs.forEach(brief => { brief.latest.url = "https://example.com/unrelated"; });
await assert.rejects(publishVerifiedBundle(mismatched, [], {write}), e => e.code === "UNVERIFIED_PUBLICATION");
assert.equal(writes, 0, "decision briefs must refer to their actual promoted evidence");
console.log(JSON.stringify({ publicExperience: "pass", copy: "runtime+build", numericalUpdates: "preserved", finalPublication: "fail-closed" }));
