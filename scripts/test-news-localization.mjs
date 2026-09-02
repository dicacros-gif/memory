import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import {
  hasUntranslatedScript, hasBrokenLocalizationText, hasKnownEntityTranslationMismatch,
  isLocalizationDisplayTextSafe, requiresNewsLocalization, localizedNewsTitle,
  localizedNewsSummary, isNewsLocalizationPublishable, sanitizeLocalizedPublication,
} from "../assets/js/news-localization.js";

for (const text of ["半導體", "メモリ", "ひらがな", "𠀀", "ｶﾀｶﾅ", "㍂", "한국어와 原文"])
  assert.equal(hasUntranslatedScript(text), true, `Unicode source-script detection: ${text}`);
for (const text of ["NVIDIA", "Lam Research", "RAG · KV cache · HBM", "한국어 설명", "Jalapeño", "α · β"])
  assert.equal(isLocalizationDisplayTextSafe(text), true, `legitimate display copy: ${text}`);
for (const text of ["bad�text", "bad\u0000text", "FranÃ§ois", "ZXQKOTR0001QXZ", "반도체 인텔리전스ɂτA2026N2li4`6j̐E̔㍂̊τʃLOɂāA{gbv̓LINVAŁAgbv20ВAłLт8ʂɃNCτB (1/2)"])
  assert.equal(hasBrokenLocalizationText(text), true, `corrupt text must fail: ${text}`);

const chinese = {
  title: "AI 資料中心採用新記憶體",
  originalTitle: "AI 資料中心採用新記憶體",
  titleKo: "AI 데이터센터가 새로운 메모리를 채택",
  summaryOriginal: "新的記憶體可支援資料中心運算需求。",
  summary: "새로운 메모리가 데이터센터의 연산 수요를 지원합니다.",
  language: "chinese", source: "科技新报", sourceUrl: "https://technews.tw/example/",
  translation: { title: { status: "verified" }, summary: { status: "verified" } },
};
assert.equal(localizedNewsTitle(chinese), chinese.titleKo);
assert.equal(localizedNewsSummary(chinese), chinese.summary);
assert.equal(isNewsLocalizationPublishable(chinese), true);
assert.equal(requiresNewsLocalization({ language: "zh-Hant", title: "NVIDIA" }), true);
assert.equal(requiresNewsLocalization({ language: "ja-JP", title: "NVIDIA" }), true);
assert.equal(requiresNewsLocalization({ title: "English headline", summaryOriginal: "日本語の原文" }), true);
assert.equal(localizedNewsTitle({ ...chinese, titleKo: "한국어 原文" }), "");
assert.equal(localizedNewsTitle({ ...chinese, titleKo: "" }), "");
assert.equal(localizedNewsSummary({ ...chinese, summary: chinese.summaryOriginal }), "");
assert.equal(localizedNewsSummary({ ...chinese, summary: "한국어 メモリ" }), "");
assert.equal(isNewsLocalizationPublishable({ ...chinese, summary: "", summaryKo: "" }), false);
assert.equal(isNewsLocalizationPublishable({ title: "정상 제목", language: "ja" }), true, "title-only records need no invented summary");
assert.equal(localizedNewsTitle({ ...chinese, translation: { title: { status: "unverified" } } }), "");
assert.equal(localizedNewsSummary({ ...chinese, translation: { summary: { status: "verified", fidelityStatus: "unverified" } } }), "");
assert.equal(localizedNewsSummary({ ...chinese, summaryLanguage: "source-original" }), "");

const english = {
  language: "english", originalTitle: "NVIDIA and Micron expand AI memory collaboration",
  title: "NVIDIA and Micron expand AI memory collaboration", titleKo: "잘못된 原文 제목",
  summaryOriginal: "The companies are expanding AI memory collaboration.", summary: "번역�실패",
  translation: { title: { status: "unverified" }, summary: { status: "unverified" } },
  sourceUrl: "https://example.com/article",
};
assert.equal(localizedNewsTitle(english), english.originalTitle);
assert.equal(localizedNewsSummary(english), english.summaryOriginal);
assert.equal(isNewsLocalizationPublishable(english), true, "English source fallback remains supported");
assert.equal(localizedNewsTitle({ ...chinese, language: "english" }), chinese.titleKo, "an incorrect English tag cannot bypass original-script detection");
assert.equal(localizedNewsTitle({ ...chinese, title: "English only", titleKo: "", language: "english" }), "");

const lam = { ...chinese, originalTitle: "科林研發看 CPO 瓶頸在材料", titleKo: "Colin R&D는 CPO 소재 병목을 설명" };
assert.equal(hasKnownEntityTranslationMismatch("科林研发", "콜린의 CPO 개발"), true);
assert.equal(hasKnownEntityTranslationMismatch("科林研發", "Lam Research의 CPO 개발"), false);
assert.equal(localizedNewsTitle(lam), "");
assert.equal(isNewsLocalizationPublishable(lam), false);

const before = JSON.stringify(chinese);
const publication = sanitizeLocalizedPublication({
  articles: [chinese, { ...chinese, titleKo: "" }, english, lam],
  aliases: ["聯發科", "世芯"], source: { title: "原文來源", url: "https://example.com/來源" },
  originalTitle: "原文", summaryOriginal: "保留原文", rssDescription: "原始描述",
  company: { name: "NVIDIA", ticker: "NVDA" },
  note: "TPU向 HBM 수요", excerpt: "English 中文 日本語 PRODUCTS COMPANY SUPPORT",
  evidence: "未翻譯證據", nested: { title: "정상 섹션", quote: "일본어 メモリ", summary: "", caption: " " },
});
assert.equal(JSON.stringify(chinese), before, "publication must not mutate source evidence");
assert.equal(publication.articles.length, 2, "only failed articles are excluded");
assert.equal(publication.articles[0].title, chinese.titleKo);
assert.equal(publication.articles[0].originalTitle, chinese.originalTitle);
assert.equal(publication.articles[1].titleKo, english.originalTitle);
assert.deepEqual(publication.aliases, ["聯發科", "世芯"]);
assert.equal(publication.source.title, "原文來源");
assert.equal(publication.summaryOriginal, "保留原文");
assert.equal(publication.rssDescription, "原始描述");
assert.equal(publication.company.name, "NVIDIA");
for (const key of ["note", "excerpt", "evidence"]) assert.equal(key in publication, false);
assert.equal("quote" in publication.nested, false);
assert.equal(publication.nested.summary, "", "empty schema fields are preserved");
assert.equal(publication.nested.caption, " ");
const noOriginalTitle = { ...chinese }; delete noOriginalTitle.originalTitle;
assert.equal(sanitizeLocalizedPublication(noOriginalTitle).originalTitle, chinese.title, "normalization preserves a legacy source title");
assert.equal(sanitizeLocalizedPublication({ title: "原文", url: "https://example.com/a" }), null);
assert.equal(sanitizeLocalizedPublication({ title: "정상 제목", quote: "未翻譯的直接引用", url: "https://example.com/a" }), null, "a rejected quotation cannot be silently turned into a title-only briefing");
assert.equal(sanitizeLocalizedPublication({ kind: "보도", text: "未翻譯的發言", url: "https://example.com/a" }), null, "failed source-linked statements are excluded");
assert.equal(sanitizeLocalizedPublication("壞字元"), null);
assert.equal(sanitizeLocalizedPublication(""), "");

// Execute the real browser helpers without bootstrapping the DOM. Keep the
// browser-only functions thin so pipeline and runtime share one language gate.
const appPath = fileURLToPath(new URL("../assets/js/app.js", import.meta.url));
const app = readFileSync(appPath, "utf8");
const browserFunction = (name) => {
  const start = app.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, `browser helper exists: ${name}`);
  const next = app.indexOf("\n  function ", start + 1);
  return app.slice(start, next < 0 ? app.length : next).trim();
};
const context = vm.createContext({
  localizedNewsTitle, localizedNewsSummary, isNewsLocalizationPublishable, isLocalizationDisplayTextSafe,
  QUANT: { agentBriefing: { roles: {} } }, LIVE: {},
});
for (const name of ["hasCurrencyTranslationMismatch", "sourceSafeTitle", "sourceSafeSummary", "localizedBriefingEvidence", "previousAgentBriefingEvidence"])
  vm.runInContext(browserFunction(name), context);
context.sample = { ...chinese, titleKo: "" };
assert.equal(vm.runInContext("sourceSafeTitle(sample)", context), "", "no raw-title browser fallback");
context.sample = { ...chinese, summary: chinese.summaryOriginal };
assert.equal(vm.runInContext("sourceSafeSummary(sample)", context), "", "no raw-summary browser fallback");
context.sample = { title: "정상 제목", quote: "國際半導體產業協會 SEMI", sourceUrl: "https://example.com/a" };
assert.equal(vm.runInContext("localizedBriefingEvidence(sample)", context), null, "legacy quotes cannot bypass the gate");
context.QUANT.agentBriefing.roles.coo = context.sample;
assert.equal(vm.runInContext('previousAgentBriefingEvidence("coo")', context), null);
context.sample = { title: "Lam Research의 CPO 소재 병목", quote: "광 손실을 줄일 소재 검증이 필요", sourceUrl: "https://example.com/a" };
assert.equal(vm.runInContext("localizedBriefingEvidence(sample).quote", context), context.sample.quote);
for (const name of ["currentRunNews", "archivedNews", "renderNewsBucket", "rawCommunitySignals"])
  assert.match(browserFunction(name), /isNewsLocalizationPublishable/, `${name} gates publication`);
assert.match(browserFunction("playerSignalEntry"), /isLocalizationDisplayTextSafe\(item\.text\)/, "organisation statements use the display gate");
assert.doesNotMatch(browserFunction("sourceSafeTitle"), /return String\(item.originalTitle/, "failed source titles are never restored");

console.log(JSON.stringify({ status: "news-localization-pass", unicode: true, sourcePreserved: true, browserFallbacks: "fail-closed" }));
