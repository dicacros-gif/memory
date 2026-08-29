#!/usr/bin/env node
// The decision-evidence card prints a headline and a summary. Feeds routinely
// end the headline with the outlet's own name and open the summary by restating
// the headline, so the card said the outlet twice and the claim twice before it
// said anything new.
//
// The rules that fix that live inside landing.js's IIFE and cannot be imported,
// so this gate lifts them out of the source and runs them against the real
// artifact. That way the test exercises the shipped implementation rather than a
// copy of it, and it fails if either the rule or the data drifts.

import assert from "node:assert/strict";
import fs from "node:fs";

const landing = fs.readFileSync("assets/js/landing.js", "utf8");

function lift(name) {
  const start = landing.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist in assets/js/landing.js`);
  let depth = 0;
  let index = landing.indexOf("{", start);
  const open = index;
  for (; index < landing.length; index += 1) {
    if (landing[index] === "{") depth += 1;
    else if (landing[index] === "}") {
      depth -= 1;
      if (!depth) break;
    }
  }
  return landing.slice(start, index + 1);
}

function liftConst(name) {
  const pattern = new RegExp(`const ${name} = [\\s\\S]*?;\\r?\\n`);
  const match = landing.match(pattern);
  assert.ok(match, `${name} must exist in assets/js/landing.js`);
  return match[0];
}

const sandbox = [
  liftConst("BRIEF_PARTICLE"),
  liftConst("BRIEF_ENDING"),
  liftConst("BRIEF_GENERIC_LATIN"),
  lift("stripSourceSuffix"),
  lift("briefTokens"),
  lift("briefSignals"),
  lift("dropHeadlineEcho"),
  "return { stripSourceSuffix, dropHeadlineEcho };",
].join("\n");

// eslint-disable-next-line no-new-func
const { stripSourceSuffix, dropHeadlineEcho } = new Function(sandbox)();

// --- the outlet suffix -----------------------------------------------------
assert.equal(
  stripSourceSuffix("메모리는 62%를 차지합니다 - digittimes", "digitimes"),
  "메모리는 62%를 차지합니다",
  "a trailing outlet name must go, even when the feed spells it differently",
);
assert.equal(
  stripSourceSuffix("HBM4 - 차세대 표준", "digitimes"),
  "HBM4 - 차세대 표준",
  "a dash that is part of the headline must survive",
);
assert.equal(stripSourceSuffix("HBM4 공급", ""), "HBM4 공급", "no source means nothing to strip");

// --- the restated first sentence -------------------------------------------
const echo = dropHeadlineEcho(
  "새로운 비용 분석에 따르면 메모리 칩은 Nvidia의 차세대 AI 플랫폼인 Vera Rubin 비용의 약 62%를 차지합니다."
  + " 가장 큰 단일 품목은 HBM4가 아니라 Vera CPU에 장착된 LPDDR5X 메모리 모듈인 SOCAMM2로, 슈퍼칩당 20,000달러에 가깝습니다.",
  "메모리는 Nvidia Vera Rubin 비용의 62%를 차지합니다. HBM4가 아닌 SOCAMM2가 비용을 주도합니다",
);
assert.ok(!echo.includes("새로운 비용 분석에 따르면"), "a first sentence that only restates the headline must be dropped");
assert.ok(echo.includes("LPDDR5X"), "the sentence carrying the new part must survive");
assert.ok(echo.includes("20,000달러"), "the figure that is not in the headline must survive");

// A first sentence that carries a figure of its own is not an echo, even when
// it is built from the headline's words.
const kept = dropHeadlineEcho(
  "메모리 가격이 전 분기 대비 34% 올랐습니다. TrendForce는 2027년 68%를 예상합니다.",
  "메모리 가격 급등",
);
assert.ok(kept.startsWith("메모리 가격이 전 분기"), "a first sentence with a figure of its own must survive");

// A first sentence that only restates the headline goes, whatever its wording.
const pruned = dropHeadlineEcho(
  "메모리 가격이 급등했습니다. TrendForce는 2027년 68%를 예상합니다.",
  "메모리 가격 급등",
);
assert.equal(pruned, "TrendForce는 2027년 68%를 예상합니다.", "a pure restatement of the headline is dropped");

// --- against the shipped artifact ------------------------------------------
const artifact = "data/landing-decision-client.json";
if (fs.existsSync(artifact)) {
  const briefs = JSON.parse(fs.readFileSync(artifact, "utf8")).briefs || [];
  let trimmedTitles = 0;
  let trimmedSummaries = 0;
  for (const brief of briefs) {
    const latest = brief?.latest;
    if (!latest?.title) continue;
    const headline = stripSourceSuffix(latest.title, latest.source);
    if (headline !== latest.title) trimmedTitles += 1;
    assert.ok(headline.length > 8, `a headline must not be trimmed to nothing: ${latest.title}`);
    if (!latest.summary) continue;
    const summary = dropHeadlineEcho(latest.summary, headline);
    assert.ok(summary.trim().length > 0, `a summary must never be emptied: ${latest.summary}`);
    if (summary !== latest.summary) trimmedSummaries += 1;
    // Whatever survives must still be a suffix of the original: the rule drops
    // leading sentences, it never rewrites one.
    assert.ok(latest.summary.includes(summary.slice(0, 24)), "the rule may drop sentences, never edit them");
  }
  console.log(JSON.stringify({ briefs: briefs.length, trimmedTitles, trimmedSummaries }));
} else {
  console.log(JSON.stringify({ briefs: 0, note: "artifact absent; rule tested on fixtures only" }));
}

console.log("decision brief dedup test passed");
