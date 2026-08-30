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

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (name) => JSON.parse(readFileSync(resolve(root, "data", name), "utf8"));

const live = readJson("live-client.json");
const news = live.news || [];
assert.ok(news.length > 0, "the browser stream must carry news");

const SKHYNIX_SUBJECT_RE = /sk\s*hynix|skhynix|\bskhy\b|하이닉스|solidigm|솔리다임/i;
const KOREAN_DOMAIN_RE = /\.kr(\/|$|:)|semiconductor\.samsung\.com|news\.samsung\.com/i;
const OTHER_COMPANY_RE = /nvidia|samsung|micron|kioxia|sandisk|western digital|ymtc|cxmt|changxin|tsmc|intel|amd|broadcom|marvell|mediatek|apple|google|alphabet|microsoft|meta|amazon|aws|openai|anthropic|oracle|tesla|spacex|coreweave|dell|hpe|lenovo|supermicro|foxconn|wiwynn|inventec|gigabyte|asus|quanta|asml|smic|naura|amec|jcet|alchip|삼성|마이크론|키오시아|샌디스크|엔비디아|인텔/i;

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

console.log(JSON.stringify({ status: "news-stream-quality-pass", items: news.length }));
