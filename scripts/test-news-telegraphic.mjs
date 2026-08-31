import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { toTelegraphic, truncateAtBoundary } from "./crawl.mjs";

// News cards are read by scanning, not by reading: 개조식 puts the fact at the
// end of the line instead of a politeness ending, and a line that stops
// mid-word is worse than a shorter line. Both rules are enforced on what the
// browser actually receives, not only on what the crawler writes.

const root = new URL("../", import.meta.url);

for (const [input, expected] of [
  ["근접할 가능성을 제시합니다.", "근접할 가능성을 제시함"],
  ["수율을 확정하지 않습니다.", "수율을 확정하지 않음"],
  ["지불할 가능성이 가장 낮습니다.", "지불할 가능성이 가장 낮음"],
  ["방어 강도를 높여야 합니다.", "방어 강도를 높여야 함"],
  ["연간 2.5% 감소세로 줄어들 것으로 예상된다.", "연간 2.5% 감소세로 줄어들 것으로 예상됨"],
]) {
  assert.equal(toTelegraphic(input), expected, `개조식 conversion failed for: ${input}`);
}

// An ending the map does not name is left alone rather than half-converted.
assert.equal(toTelegraphic("공급망 비용 압박이 심화"), "공급망 비용 압박이 심화");

// A cap must not leave a stem with its ending sliced off.
const long = "기존 추정치 대비 연간 감소율은 2.5%로 좁아진 것으로 나타남. ".repeat(9);
const cut = truncateAtBoundary(long, 120);
assert.ok(cut.length <= 120, "truncation must respect the cap");
assert.ok(/[음함됨임)\]%]$/.test(cut) || /[가-힣]$/.test(cut), "truncation must end on a complete clause");
assert.ok(!cut.endsWith("좁아진"), "truncation must not stop on a dangling verb stem");

// And the published stream has to satisfy both.
const live = JSON.parse(await readFile(new URL("data/live-client.json", root), "utf8"));
const items = Array.isArray(live.news) ? live.news : [];
assert.ok(items.length > 0, "the client stream must carry news items");

const polite = [];
for (const item of items) {
  for (const field of ["titleKo", "summary", "insight", "validation"]) {
    const value = String(item[field] || "");
    if (!value) continue;
    if (/(?:습니다|합니다|됩니다|입니다)(?:[.\s·]|$)/.test(value)) {
      polite.push(`${item.id || item.link || field}: ${value.slice(0, 60)}`);
    }
  }
}
assert.deepEqual(polite.slice(0, 8), [], `published news copy must be 개조식; ${polite.length} line(s) still end politely`);

console.log(`news copy: ${items.length} items in 개조식, truncation lands on complete clauses`);
