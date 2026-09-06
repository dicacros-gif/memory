import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CONSOLE_ROUTE_IDS, CONSOLE_ROUTE_LANDMARKS } from "./console-route-contract.mjs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../assets/css/styles.css", import.meta.url), "utf8");
const audit = readFileSync(new URL("./audit-text-reflow.mjs", import.meta.url), "utf8");

const investorTechnology = html.match(
  /<section class="board investor-tech-board" id="investor-technology"[\s\S]*?<\/section>/,
)?.[0] || "";
assert.ok(investorTechnology, "the investor technology board must be mounted in the Console");
assert.match(
  investorTechnology,
  /aria-labelledby="investorTechnologyTitle"[\s\S]*?<h2 id="investorTechnologyTitle">기술 우위를 이익 지속성으로 검증<\/h2>/,
  "the technology route needs a stable accessible heading",
);
assert.match(
  investorTechnology,
  /class="investor-tech-matrix" role="table" aria-label="메모리 기술 투자 검증 매트릭스"/,
  "the technology comparison must expose table semantics",
);
assert.equal((investorTechnology.match(/role="row"/g) || []).length, 5, "the matrix needs one heading and four technology rows");
assert.equal((investorTechnology.match(/role="columnheader"/g) || []).length, 4, "the matrix needs four named comparison columns");
assert.equal((investorTechnology.match(/role="cell"/g) || []).length, 16, "all four investment checks must be exposed for every technology row");
for (const term of [
  "HBM4·HBM4E",
  "DDR5·MRDIMM·CXL",
  "NAND·eSSD·HBF",
  "패키징·광통신·전력",
  "시연 → 인증 → 양산 → 반복 주문",
  "논지 폐기 조건",
]) assert.ok(investorTechnology.includes(term), `investor technology board is missing: ${term}`);

// Retain the detailed technical appendix behind the investor-facing synthesis.
const content = html.split('id="aiTechnologyTrends"')[1]?.split('<div id="industryShift">')[0];
assert.ok(content, "the detailed technical layer must remain available behind the investor route");
assert.equal((content.match(/<details /g) || []).length, 4, "four keyboard-accessible technical disclosures");
assert.equal((content.match(/<summary>/g) || []).length, 4);
for (const term of [
  "GPT-5.6 Sol",
  "Claude Fable 5.1",
  "Gemini 3.8 Flash",
  "Qwen3.8-Flash-Next",
  "ENCODER-ONLY",
  "DECODER-ONLY",
  "ENCODER–DECODER",
  "Dense / MoE",
  "MHA / GQA / MLA",
  "Vector DB",
  "Rerank",
  "Prefill",
  "Decode",
  "Qualification",
]) assert.ok(content.includes(term), term);
for (const value of ["1,050,000", "1,000,000", "128,000", "1,048,576", "65,536", "262,144", "671B", "37B"]) {
  assert.ok(content.includes(value), value);
}
for (const boundary of [
  "공식 API 문서에 레이어 수",
  "공식 overview에 내부 Transformer",
  "최신 모델 순위가 아님",
  "전체 저장 가중치를 뜻하지 않음",
  "KV cache는 생성 중 attention 상태",
  "비공개 구조에 이 식을 대입",
  "활성 파라미터·KV 구현은 미공개",
  "벡터 DB 외에 키워드 검색",
]) assert.ok(content.includes(boundary), boundary);
assert.doesNotMatch(
  content,
  /GPT-5\.6[^<]{0,60}(?:decoder-only|671B)|Fable 5\.1[^<]{0,60}(?:decoder-only|671B)/i,
  "no invented proprietary model architecture",
);
const links = [...content.matchAll(/<a\s+href="([^"]+)"([^>]*)>/g)];
assert.ok(new Set(links.map((match) => match[1])).size >= 20, "local claims retain specific primary citations");
for (const [, href, attrs] of links) {
  assert.equal(new URL(href).protocol, "https:");
  assert.match(attrs, /rel="noopener noreferrer"/);
}

assert.match(
  css,
  /\.investor-tech-row\s*\{[\s\S]*?grid-template-columns:\s*\.7fr 1\.25fr 1fr 1fr;[\s\S]*?min-width:\s*0;/,
  "the desktop technology matrix must distribute four readable columns",
);
assert.match(
  css,
  /\.investor-tech-row > \*\s*\{[\s\S]*?min-width:\s*0;[\s\S]*?overflow-wrap:\s*anywhere;/,
  "long technology terms must be allowed to reflow inside their cells",
);
assert.match(
  css,
  /@media \(max-width: 820px\)[\s\S]*?\.investor-tech-row\s*\{\s*grid-template-columns:\s*1fr;[\s\S]*?\.investor-tech-row\.is-head\s*\{\s*display:\s*none;[\s\S]*?\.investor-tech-row > span:nth-child\(4\)::before\s*\{\s*content:\s*"반증 조건";/,
  "the technology matrix must become a labelled single-column mobile layout",
);
assert.match(css, /container:\s*player-card \/ inline-size/);
assert.match(css, /@container player-card \(max-width: 420px\)/, "legacy research cards must still reflow by their own width");

const technologyRouteIndex = CONSOLE_ROUTE_LANDMARKS.indexOf("investor-technology");
assert.ok(technologyRouteIndex >= 0, "the technology board must be an owned Console route landmark");
assert.equal(CONSOLE_ROUTE_IDS[technologyRouteIndex], "partnerships", "the stable partnerships deep link must open the technology board");
assert.match(audit, /NodeFilter\.SHOW_TEXT/);
assert.match(audit, /range\.getClientRects\(\)/);
assert.match(audit, /style\.clipPath/, "ancestor clipping must be audited");
assert.match(audit, /quick\?\[540,1024,1440\]:\[320,360,390,/, "the full reflow audit must include phone widths");
assert.ok(audit.includes("CONSOLE_ROUTE_LANDMARKS[i]"), "the audit must wait for the route's actual rendered landmark");
assert.ok(audit.includes("await scan(`${width}:${route}`)"), "the audit must scan every rendered route at every viewport");
assert.doesNotMatch(audit, /data-player=\\"broadcom/, "technology QA must not depend on a Broadcom-only hover path");

console.log(JSON.stringify({
  aiTechnology: "pass",
  investorRows: 4,
  models: 4,
  topics: 4,
  primarySources: new Set(links.map((match) => match[1])).size,
  mobileReflow: true,
}));
