import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  crawlExclusionKeySet,
  crawlModerationKeys,
  isCrawlExcluded,
  normalizeCrawlExclusionUrl,
  purgeCrawlExclusions,
} from "./crawl-exclusions.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const removedNews = {
  id: "story-1",
  title: "Memory supply expands",
  source: "Example",
  sourceUrl: "https://example.com/story?utm_source=test",
};
const keptNews = {
  id: "story-2",
  title: "Independent article",
  source: "Example",
  sourceUrl: "https://example.com/kept",
};
const newsKeys = crawlModerationKeys("news", removedNews);
const priceKeys = crawlModerationKeys("price", {
  historyKey: "dram|ddr5",
  sectionTitle: "DRAM",
  item: "DDR5",
});
const exclusions = {
  version: 1,
  items: [
    { type: "news", keys: newsKeys },
    { type: "price", keys: priceKeys },
  ],
};
const exclusionKeys = crawlExclusionKeySet(exclusions);

assert.equal(
  normalizeCrawlExclusionUrl("https://example.com/story?utm_source=test#section"),
  "https://example.com/story",
  "tracking parameters and fragments must not create duplicate exclusions",
);
assert.equal(isCrawlExcluded("news", removedNews, exclusionKeys), true);
assert.equal(
  isCrawlExcluded("research", removedNews, { items: [{ type: "news", keys: newsKeys }] }),
  true,
  "news and research views of the same source must share one durable exclusion",
);
assert.equal(isCrawlExcluded("news", keptNews, exclusionKeys), false);

const purged = purgeCrawlExclusions({
  news: [removedNews, keptNews],
  priceHistory: {
    items: {
      "dram|ddr5": { points: [{ date: "2026-07-31", average: 1 }] },
      "nand|slc": { points: [{ date: "2026-07-31", average: 2 }] },
    },
  },
}, exclusionKeys);
assert.deepEqual(purged.value.news, [keptNews], "excluded news must be removed from existing generated data");
assert.equal(purged.value.priceHistory.items["dram|ddr5"], undefined, "excluded price history must be removed");
assert.ok(purged.value.priceHistory.items["nand|slc"], "unrelated price history must be preserved");
assert.equal(purged.removed, 2);

const [app, workflow, crawler, audit] = await Promise.all([
  readFile(resolve(root, "assets", "js", "app.js"), "utf8"),
  readFile(resolve(root, ".github", "workflows", "crawl-exclusion.yml"), "utf8"),
  readFile(resolve(root, "scripts", "crawl.mjs"), "utf8"),
  readFile(resolve(root, "scripts", "audit-content.mjs"), "utf8"),
]);

assert.match(app, /type="password"/, "the moderation gate must mask password input");
assert.match(app, /window\.crypto\.subtle\.digest\("SHA-256"/, "the browser must compare a digest, not a visible password");
assert.doesNotMatch(app, /value\s*=\s*["']0["']/, "the password must never be rendered as an input value");
assert.match(app, /issues\/new/, "approved browser deletion must create a durable repository request");
assert.match(app, /saveLocalCrawlExclusion[\s\S]+crawlExclusionRequestUrl/, "the browser must hide the item before permanent processing");
assert.match(workflow, /author_association == 'OWNER'/, "permanent deletion must require repository authority");
assert.match(workflow, /apply-crawl-exclusion-request\.mjs/, "approved requests must update the repository exclusion list");
assert.match(workflow, /npm run refresh:derived[\s\S]+npm run refresh:client-data/, "existing derived and browser data must be rebuilt");
assert.match(crawler, /purgeCrawlExclusions\(payload, crawlExclusionKeys\)/, "future crawl output must enforce exclusions");
assert.match(audit, /news\|research\|community\|price/, "all moderated crawl record types must pass schema validation");

console.log("crawl exclusion checks passed");
