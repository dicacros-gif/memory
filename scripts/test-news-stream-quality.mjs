/**
 * What the browser is allowed to call news.
 *
 * The stream had accumulated homepages, product pages, careers pages, glossary
 * entries and Wikipedia articles — more than half of it — because the discovery
 * gate screened publishers but never asked whether the thing at the end of the
 * link was a document. It also carried our own newsroom and a Korean corporate
 * domain. These assertions run against the shipped artifact, so a regression is
 * caught at the artifact rather than at the next crawl.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isEvidenceDocumentUrl } from "./evidence-document.mjs";
import { dedupeEnrichedNews, isForeignItem, isPublishableNewsItem, OTHER_COMPANY_RE, SKHYNIX_SUBJECT_RE, stripNewsLabel, verifiedNewsLanguage } from "./crawl.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (name) => JSON.parse(readFileSync(resolve(root, "data", name), "utf8"));
const auditContent = readFileSync(resolve(root, "scripts", "audit-content.mjs"), "utf8");

const live = readJson("live-client.json");
const news = live.news || [];
assert.ok(news.length > 0, "the browser stream must carry news");

// The self-coverage rule is the crawler's own, so the artifact is held to the
// exact list of companies the gate accepts.
const KOREAN_DOMAIN_RE = /\.kr(\/|$|:)|semiconductor\.samsung\.com|news\.samsung\.com/i;

for (const item of news) {
  const url = item.link || item.sourceUrl || item.url || "";
  const label = `${item.source || "?"} · ${String(item.titleKo || item.title || "").slice(0, 48)}`;

  assert.ok(url, `${label} must carry a source url`);
  assert.ok(
    isEvidenceDocumentUrl(url),
    `${label} points at a place, not a document: ${url}`,
  );
  assert.doesNotMatch(url, KOREAN_DOMAIN_RE, `${label} is a Korean domain and must not be crawled`);
  assert.doesNotMatch(url, /news\.skhynix\.com/i, `${label} is our own newsroom`);

  const subject = `${item.originalTitle || ""} ${item.title || ""} ${item.titleKo || ""} ${item.summary || ""}`;
  if (!SKHYNIX_SUBJECT_RE.test(subject)) continue;
  assert.match(
    subject.replace(SKHYNIX_SUBJECT_RE, " "),
    OTHER_COMPANY_RE,
    `${label} names SK hynix and no one else, so it is self-coverage rather than a market story`,
  );
}

// Two items pointing at the same article is one item twice.
const keys = news.map((item) => String(item.link || item.sourceUrl || item.url || "").replace(/[#?].*$/, "").replace(/\/$/, ""));
assert.equal(new Set(keys).size, keys.length, "the stream must not carry the same article twice");

const japaneseArticle = {
  title: "AI時代のメモリと半導体市場を分析",
  originalTitle: "AI時代のメモリと半導体市場を分析",
  language: "japanese",
  streamLanguage: "japanese",
  source: "EE Times Japan",
  link: "https://eetimes.itmedia.co.jp/ee/articles/2608/30/news001.html",
};
assert.equal(verifiedNewsLanguage(japaneseArticle), "japanese");
assert.equal(isForeignItem(japaneseArticle), true, "a Japanese authoritative article must be crawlable");
assert.match(auditContent, /new Set\(\["english", "japanese", "chinese"\]\)/, "content audit must recognize every publisher language accepted by the crawler");
assert.match(auditContent, /language === "japanese" \? kanaCount : hanCount/, "content audit must reject residual Japanese source script from Korean display fields");
assert.equal(isPublishableNewsItem({
  ...japaneseArticle,
  title: "SK hynix announces new HBM memory",
  originalTitle: "SK hynix announces new HBM memory",
  language: "english",
  streamLanguage: "english",
}), false, "SK hynix-only coverage must be removed even outside its newsroom");
assert.equal(isPublishableNewsItem({
  ...japaneseArticle,
  title: "NVIDIA and SK hynix expand HBM4 co-development",
  originalTitle: "NVIDIA and SK hynix expand HBM4 co-development",
  language: "english",
  streamLanguage: "english",
}), true, "a market story naming an independent counterparty must remain eligible");
assert.equal(isPublishableNewsItem({
  ...japaneseArticle,
  title: "Micron expands HBM capacity",
  originalTitle: "Micron expands HBM capacity",
  link: "https://example.co.kr/news/1",
}), false, "Korean sites must be rejected by hostname");

// A feed's section label ("[News]", "[Insights]") is navigation, not part of
// the headline. The publisher-feed path once skipped title cleaning and the
// nightly content audit failed on it for three nights running.
assert.equal(stripNewsLabel("[News] ASE Reportedly Raises Advanced Packaging Quotes"), "ASE Reportedly Raises Advanced Packaging Quotes");
assert.equal(stripNewsLabel("[Insights] Memory Spot Price Update: DRAM Spot Prices"), "Memory Spot Price Update: DRAM Spot Prices");
assert.equal(stripNewsLabel("News: Micron ships HBM4 samples"), "Micron ships HBM4 samples");
assert.equal(stripNewsLabel("Newsom signs chip bill"), "Newsom signs chip bill", "a bare 'News' with no separator is a word, not a label");
assert.equal(stripNewsLabel("News Corp invests in AI"), "News Corp invests in AI");
{
  const [carried] = dedupeEnrichedNews([{
    title: "[News] Lenovo Reportedly Sees Higher Memory Prices Into 2030",
    originalTitle: "[News] Lenovo Reportedly Sees Higher Memory Prices Into 2030",
    titleKo: "[인사이트] 레노버, 2030년까지 메모리 가격 상승 전망",
    source: "trendforce.com",
    sourceUrl: "https://www.trendforce.com/news/2026/10/20/news-lenovo-memory-prices/",
    link: "https://www.trendforce.com/news/2026/10/20/news-lenovo-memory-prices/",
  }]);
  assert.equal(carried.title, "Lenovo Reportedly Sees Higher Memory Prices Into 2030", "continuity copies are cleaned on the way in");
  assert.equal(carried.originalTitle, carried.title);
  assert.equal(carried.titleKo, "레노버, 2030년까지 메모리 가격 상승 전망");
}

console.log(JSON.stringify({ status: "news-stream-quality-pass", items: news.length }));
