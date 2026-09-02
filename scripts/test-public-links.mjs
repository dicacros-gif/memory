import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sanitizeSourceUrl, articleCanonicalUrl, preserveLandingArtifactsForConsoleCrawl } from "./crawl.mjs";
import { applyPublicLinkPolicy, PUBLIC_LINK_POLICY, NON_PUBLIC_LINK_FIELDS, classifyLinkResponse } from "./public-link-policy.mjs";

const read = name => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), "utf8"));
const board = "https://english.moef.go.kr/pc/selectTbPressCenterDtl.do?boardCd=N0001&seq=5899";
assert.equal(sanitizeSourceUrl(board), board, "preserve government document identity");
assert.equal(sanitizeSourceUrl(`${board}&utm_source=test#top`), board);
assert.equal(sanitizeSourceUrl("https://example.com/read?newsid=123&language=ko&docId=AbC"), "https://example.com/read?newsid=123&language=ko&docId=AbC");
assert.equal(sanitizeSourceUrl("https://forums.servethehome.com/index.php?threads/memory.12345/"), "https://forums.servethehome.com/index.php?threads/memory.12345/");
assert.equal(sanitizeSourceUrl("https://forums.servethehome.com/index.php?threads/memory.12345/&utm_source=test"), "https://forums.servethehome.com/index.php?threads/memory.12345/");
assert.equal(sanitizeSourceUrl("https://example.com/read?docId=AbC%2fDef%20G&sig=a%2Bb%3D&utm_source=test"), "https://example.com/read?docId=AbC%2fDef%20G&sig=a%2Bb%3D");
for (const invalid of ["javascript:alert(1)", "data:text/html,bad", "https://user:pass@example.com/"]) assert.equal(sanitizeSourceUrl(invalid), "");
assert.equal(articleCanonicalUrl('<link rel="canonical" href="/press/a?docId=abc">', "https://example.com/old"), "https://example.com/press/a?docId=abc");
assert.equal(articleCanonicalUrl('<link rel="canonical" href="https://example.com/press/a">'), "https://example.com/press/a");
assert.equal(articleCanonicalUrl('<link rel="canonical" href="/">', "https://example.com/news/article"), "https://example.com/news/article");
assert.equal(articleCanonicalUrl('<link rel="canonical" href="/pc/selectTbPressCenterDtl.do">', board), board);
assert.equal(articleCanonicalUrl('<link rel="canonical" href="?boardCd=N0001">', board), board, "partial query stripping also loses article identity");
assert.equal(articleCanonicalUrl('<link rel="canonical" href="?boardCd=N0001&seq=6117">', board), board, "canonical cannot silently substitute a different record");

for (const status of [401, 403, 429]) assert.equal(classifyLinkResponse({ status }), "blocked");
for (const status of [404, 410]) assert.equal(classifyLinkResponse({ status }), "broken");
assert.equal(classifyLinkResponse({ status: 200, title: "Page not found | Oracle" }), "soft-404");
assert.equal(classifyLinkResponse({ status: 200, title: "Just a moment..." }), "blocked");
assert.equal(classifyLinkResponse({ status: 200, url: "https://example.com/news/article", finalUrl: "https://example.com/" }), "redirect-review");

const old = PUBLIC_LINK_POLICY.corrections[0].from;
const current = PUBLIC_LINK_POLICY.corrections[0].to;
const removed = PUBLIC_LINK_POLICY.unavailable[0].url;
const raw = { profile: { name: "Account", sources: [{ url: old }, { url: removed }] }, industrySourceChecks: { old: { url: old, httpStatus: 404 } } };
const before = JSON.stringify(raw);
const projected = applyPublicLinkPolicy(raw);
assert.equal(JSON.stringify(raw), before, "never mutate raw historical evidence");
assert.deepEqual(projected.profile.sources, [{ url: current }]);
assert.equal(projected.profile.name, "Account", "an unavailable citation must not remove its account");
assert.deepEqual(projected.industrySourceChecks, raw.industrySourceChecks, "preserve dated probe results honestly");
assert.deepEqual(applyPublicLinkPolicy(projected), projected, "policy must be idempotent");
assert.deepEqual(applyPublicLinkPolicy({ evidenceUrls: [old, removed] }), { evidenceUrls: [current] }, "URL arrays follow the same publication policy");
assert.deepEqual(applyPublicLinkPolicy({ name: "Chip", hbmUrl: removed }), { name: "Chip", hbmUrl: null }, "unavailable optional field URLs cannot remain clickable");
assert.deepEqual(applyPublicLinkPolicy({ name: "Company", sourceUrl: removed, sources: [{ url: current }] }), { name: "Company", sourceUrl: null, sources: [{ url: current }] }, "preserve a company and its other evidence when its primary URL is unavailable");
const originalPublisher = applyPublicLinkPolicy({ sourceUrl: "https://www.stcn.com/article/detail/4046758.html", source: "证券时报", titleKo: "Old", summary: "Old", translation: { summary: { status: "verified" } } });
assert.equal(originalPublisher.source, "界面新闻");
assert.equal(originalPublisher.sourceUrl, "https://www.jiemian.com/article/14842205.html");
assert.equal(originalPublisher.translation, undefined, "old translation validation cannot endorse corrected copy");

const retained = preserveLandingArtifactsForConsoleCrawl({ landingDecision: {}, companyDirectory: {}, manifest: { artifacts: { landingDecision: {}, siteContent: {}, siteContentExtended: {} } } }, { siteContent: { sources: [{ url: old }] }, siteContentExtended: { sources: [{ url: old }] } }, "test-run");
assert.equal(retained.siteContent.sources[0].url, current, "console-only crawl cannot resurrect repaired URLs");

const retired = new Set([...PUBLIC_LINK_POLICY.corrections.map(r => r.from), ...PUBLIC_LINK_POLICY.unavailable.map(r => r.url)]);
const failures = [];
function walk(value, path) {
  if (Array.isArray(value)) return value.forEach((item, i) => walk(item, `${path}[${i}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (NON_PUBLIC_LINK_FIELDS.has(key)) continue;
    if (typeof child === "string" && /^(?:link|href|.*url)$/i.test(key) && retired.has(child)) failures.push(`${path}.${key}: ${child}`);
    else if (typeof child === "object") walk(child, `${path}.${key}`);
  }
}
const artifacts = ["source-catalog", "company-intelligence", "chip-roadmap", "console-chip-roadmap-source", "live-client", "site-content-client", "site-content-extended-client", "company-directory-client", "console-chip-roadmap"];
for (const name of artifacts) walk(read(name), name);
const app = readFileSync(new URL("../assets/js/app.js", import.meta.url), "utf8");
const hardcodedLinks = new Set([...app.matchAll(/["'`](https?:\/\/[^"'`\s<>]+)["'`]/g)].map(match => match[1]));
for (const url of retired) assert.ok(!hardcodedLinks.has(url), `hardcoded retired link: ${url}`);
assert.deepEqual(failures, [], "public artifacts must not expose known retired destinations");
console.log(JSON.stringify({ ok: true, corrections: PUBLIC_LINK_POLICY.corrections.length, unavailable: PUBLIC_LINK_POLICY.unavailable.length, artifacts: artifacts.length }));
