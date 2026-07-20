#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appText = await readFile(resolve(root, "assets/js/app.js"), "utf8");
const helperMatch = appText.match(/  function normalizeLiveFigureKey[\s\S]*?\n  let liveFiguresTopic = "all";/);
assert.ok(helperMatch, "live-figure grouping helpers are missing from app.js");
const helperBlock = helperMatch[0].replace(/\n  let liveFiguresTopic = "all";$/, "");

const memoryWallTitle = "메모리 병목은 HBM 캐파를 넘어 시스템 효율 문제로 확장";
const memoryCycleTitle = "3Q26 가격 상방 뒤 4Q26 모멘텀 둔화 가능성";
const samsungTitle = "삼성, AI 컴퓨팅용 HBM4 상업 출하 발표";
const reportLocator = "Global Technology: Innovating the Next-Generation Memory";
const samsungUrl = "https://example.com/samsung-hbm4";
const evidence = {
  brokerResearch: {
    items: [
      {
        id: "memory-wall",
        title: memoryWallTitle,
        summary: "2027년 클라우드 CapEx에서 메모리 비중은 40%로 높아지지만, 범용 메모리 대역폭 개선은 14%에 그친다는 분석입니다.",
      },
      {
        id: "memory-cycle",
        title: memoryCycleTitle,
        summary: "3Q26 DRAM 가격은 20~30% 이상 오를 수 있지만 4Q26에는 정체될 수 있습니다. Micron은 16개 전략고객계약에서 $22B의 재무 약정을 확보했습니다.",
      },
    ],
  },
  news: [
    {
      id: "samsung-hbm4",
      titleKo: samsungTitle,
      sourceUrl: samsungUrl,
      summary: "4nm 로직 베이스 다이 기반 HBM4를 11.7Gbps로 상업 출하했으며 최대 13Gbps까지 확장 가능하다고 발표했습니다.",
    },
  ],
};
const sandbox = {};
vm.runInNewContext(`
  const LIVE = ${JSON.stringify(evidence)};
  ${helperBlock}
  globalThis.groupLiveFiguresForTest = groupLiveFigures;
`, sandbox);

const group = (items) => JSON.parse(JSON.stringify(sandbox.groupLiveFiguresForTest(items)));
const legacyItem = (overrides) => ({
  source: "Morgan Stanley",
  sourceLocator: reportLocator,
  date: "2026-07-16",
  sourceClass: "research",
  claimLayer: "research-model",
  kind: "percent",
  topic: { id: "other", label: "지표" },
  ...overrides,
});
const fixture = [
  legacyItem({ contextKo: memoryWallTitle, value: "40%", canonical: { family: "percent", number: 40 }, topic: { id: "capex", label: "투자" }, snippet: "메모리 비중은 40%입니다." }),
  legacyItem({ contextKo: memoryWallTitle, value: "14%", canonical: { family: "percent", number: 14 }, topic: { id: "capex", label: "투자" }, snippet: "대역폭 개선은 14%입니다." }),
  legacyItem({ contextKo: memoryCycleTitle, value: "$22B", kind: "usd", canonical: { family: "currency-usd", number: 22 }, snippet: "Micron은 $22B를 확보했습니다." }),
  legacyItem({ contextKo: memoryCycleTitle, value: "30%", canonical: { family: "percent", number: 30 }, topic: { id: "price", label: "가격" }, snippet: "DRAM 가격은 30% 오를 수 있습니다." }),
  legacyItem({ contextKo: "Agentic AI 수요", value: "77%", canonical: { family: "percent", number: 77 }, snippet: "DRAM 수요가 77% 높아질 수 있습니다." }),
  legacyItem({ contextKo: "CXL 시장 전망", value: "$4.0B", kind: "usd", canonical: { family: "currency-usd", number: 4 }, snippet: "CXL 시장은 $4.0B로 전망됩니다." }),
  {
    contextKo: samsungTitle, value: "11.7Gbps", kind: "speed", canonical: { family: "speed-gbps", number: 11.7 }, topic: { id: "other", label: "지표" }, snippet: "HBM4 ships at 11.7Gbps, scalable to 13Gbps.", source: "Samsung", url: samsungUrl, sourceLocator: samsungUrl, date: "2026-02-11", sourceClass: "official", claimLayer: "official-fact",
  },
  {
    contextKo: samsungTitle, value: "13Gbps", kind: "speed", canonical: { family: "speed-gbps", number: 13 }, topic: { id: "other", label: "지표" }, snippet: "HBM4 ships at 11.7Gbps, scalable to 13Gbps.", source: "Samsung", url: samsungUrl, sourceLocator: samsungUrl, date: "2026-02-11", sourceClass: "official", claimLayer: "official-fact",
  },
  { storyId: "scmp-ipo", storyTitle: "CXMT IPO", storySummary: "CXMT IPO는 약 212배 초과청약됐습니다.", value: "212 times", canonical: { family: "multiple", number: 212 }, topic: { id: "capital", label: "IPO·자본" } },
  { storyId: "digitimes-ipo", storyTitle: "CXMT 자금 조달", storySummary: "CXMT는 IPO로 US$4.3B 조달을 추진합니다.", value: "US$4.3B", canonical: { family: "currency-usd", number: 4.3 }, topic: { id: "capital", label: "IPO·자본" } },
  { storyId: "semianalysis-cxmt", storyTitle: "CXMT HBM 제약", storySummary: "8단 HBM3 수율은 약 25%로 추정되며 HBM 기여는 제한적입니다.", value: "25%", canonical: { family: "percent", number: 25 }, topic: { id: "capacity", label: "캐파" } },
];
const groups = group(fixture);

assert.equal(fixture.length, 11);
assert.equal(groups.length, 8, "11 observations should render as 8 story cards");

const memoryWall = groups.find((item) => item.title === memoryWallTitle);
assert.deepEqual(memoryWall?.values, ["40%", "14%"]);
assert.match(memoryWall?.summary || "", /40%/);
assert.match(memoryWall?.summary || "", /14%/);

const memoryCycle = groups.find((item) => item.title === memoryCycleTitle);
assert.deepEqual(memoryCycle?.values, ["30%", "$22B"]);
assert.match(memoryCycle?.summary || "", /3Q26 DRAM 가격/);
assert.match(memoryCycle?.summary || "", /Micron은 16개 전략고객계약/);
assert.deepEqual(memoryCycle?.topics, [{ id: "price", label: "가격" }]);

const samsung = groups.find((item) => item.title === samsungTitle);
assert.deepEqual(samsung?.values, ["11.7Gbps", "13Gbps"]);
assert.match(samsung?.summary || "", /최대 13Gbps까지 확장 가능/);

const storyFixture = group([
  { storyId: "story-a", storyTitle: "같은 제목", storySummary: "첫 스토리 전체 요약", value: "40%", canonical: { family: "percent", number: 40 }, topic: { id: "capex", label: "투자" } },
  { storyId: "story-a", storyTitle: "같은 제목", storySummary: "첫 스토리 전체 요약", value: "14%", canonical: { family: "percent", number: 14 }, topic: { id: "capex", label: "투자" } },
  { storyId: "story-b", storyTitle: "같은 제목", storySummary: "둘째 스토리 전체 요약", value: "30%", canonical: { family: "percent", number: 30 }, topic: { id: "price", label: "가격" } },
]);
assert.equal(storyFixture.length, 2, "storyId must merge one story without merging distinct stories");
assert.deepEqual(storyFixture[0].values, ["40%", "14%"]);

console.log(JSON.stringify({
  ok: true,
  fixtureFigures: fixture.length,
  storyCards: groups.length,
  groupedStories: [memoryWall?.title, memoryCycle?.title, samsung?.title],
}, null, 2));
