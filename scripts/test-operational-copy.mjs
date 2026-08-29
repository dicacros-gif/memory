/**
 * Operational-copy gate.
 *
 * The site exists to surface insight and strategy, so pipeline bookkeeping must
 * never reach a reader: observation counts, crawl vocabulary, evidence tallies,
 * audit wiring status, and empty-state placeholders. Rendered markup, the
 * template literals that produce copy, and the client-facing data files are all
 * checked, because any of the three can put such a phrase on screen.
 */
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const PAGES = ["index.html", "console/index.html"];
const MODELS = [
  "data/strategy-experience.json",
  "data/strategy-spine.json",
  "data/mbb-frames.json",
  "data/capital-plans.json",
];

const rel = (file) => new URL(`../${file}`, import.meta.url);

// Scan only what a page actually loads. Bundles that no page references can
// still sit in the repo, and their copy never reaches a reader, so gating them
// would fail on dead code instead of on the site.
async function loadedSources() {
  const scripts = new Set();
  const pages = [];
  for (const page of PAGES) {
    let html;
    try {
      html = await readFile(rel(page), "utf8");
    } catch {
      continue;
    }
    pages.push(page);
    for (const match of html.matchAll(/<script[^>]+src="([^"]+)"/g)) {
      const src = match[1].split("?")[0].replace(/^\.\.\//, "").replace(/^\.\//, "");
      if (!src.endsWith(".js")) continue;
      scripts.add(src.replace(/\.min\.js$/, ".js"));
    }
  }

  // A bundle can pull in modules and load further chunks at runtime, and their
  // copy reaches the same screen, so follow both one level out.
  for (const entry of [...scripts]) {
    let source;
    try {
      source = await readFile(rel(entry), "utf8");
    } catch {
      continue;
    }
    for (const match of source.matchAll(/from\s+"\.\/([\w.-]+\.js)"/g)) scripts.add(`assets/js/${match[1]}`);
    for (const match of source.matchAll(/assets\/js\/([\w-]+)\.min\.js/g)) scripts.add(`assets/js/${match[1]}.js`);
  }

  return [...pages, ...scripts, ...MODELS];
}

const SOURCES = await loadedSources();

const BANNED = [
  // `}` catches the interpolated form, e.g. `${count}회 관측`.
  { id: "observation-count", re: /(\d|\})\s*회\s*(관측|수집|시도|크롤|갱신)/g, why: "관측·수집 횟수는 인사이트가 아니라 파이프라인 기록" },
  { id: "crawl-vocabulary", re: /(?<!스)크롤(?:링|러|마다|이|은|을|에서|기준|\s*대상|\s*결과|\s*횟수)?(?=[\s,.·)\]"'`]|$)/g, why: "수집 방식은 독자 화면에 노출하지 않음" },
  { id: "evidence-tally", re: /(?:근거|출처|링크|원문|팩트|기사|공개\s*채널)\s*(?:\d+|\$\{[^}\n]+\})\s*(?:건|개|곳|행)|(?:\d+|\$\{[^}\n]+\})\s*(?:건|개|곳|행)\s*(?:의\s*)?(?:근거|출처|링크|원문|팩트|기사|공개\s*채널)/g, why: "근거·출처 건수는 판단을 바꾸지 않는 계수" },
  { id: "database-telemetry", re: /누적\s*DB|DB\s*근거/g, why: "내부 저장소 규모·명칭은 전략 인사이트가 아님" },
  { id: "row-telemetry", re: /(?:가격|Price)\s+(?:row|rows)\b/gi, why: "가격 테이블 행 수는 내부 운영 정보" },
  { id: "collection-tally", re: /(?:최근\s*30일|과거\s*공개자료|고유\s*원문|가격\s*관측)\s*(?:\d+|\$\{[^}\n]+\})\s*(?:건|개|행)/g, why: "수집 기간별 개수는 전략 판단 대신 운영량을 노출함" },
  { id: "quality-deficit", re: /근거\s*품질\s*미달|점수\s*산출\s*보류/g, why: "검증 실패 상태 대신 전략 판단 경계를 표시해야 함" },
  { id: "metric-tally", re: /label:\s*["'](?:근거|출처|링크|원문|팩트|기사|고유\s*원문|표시\s*원문)["']\s*,\s*value:\s*fmtNum\s*\(/g, why: "검증 관련 metric은 원문 수 대신 검증 기준을 보여야 함" },
  { id: "english-telemetry", re: /(?:\d+|\$\{[^}\n]+\})\s+(?:resolved official facts|linked articles|evidence links)|(?:resolved official facts|linked articles|evidence links)\s+(?:\d+|\$\{[^}\n]+\})/gi, why: "영문 운영 카운터도 독자 화면에 노출하지 않음" },
  { id: "audit-status", re: /감사\s*(미연결|연결|로그|상태|추적|기록|대기)/g, why: "감사 배선 상태는 운영 정보" },
  { id: "collection-status", re: /(수집|검증)\s*(상태|횟수|건수|대기|실패)/g, why: "수집·검증 상태는 운영 정보" },
  { id: "unverified-placeholder", re: /(신호\s*확인\s*필요|확인되지\s*않음|미확인\s*항목|데이터\s*없음|해당\s*없음|준비\s*중입니다|추정치\s*기반)/g, why: "값이 없으면 항목 자체를 감추고 자리표시자를 남기지 않음" },
  { id: "empty-placeholder", re: /(?:^|[>\s"'([])(TBD|N\/A|TODO|Coming soon)(?=[<\s"')\].,]|$)/gi, why: "빈 자리표시자" },
];

// Policy prose that names a banned phrase in order to forbid it, and the gate's
// own vocabulary, are not reader-facing copy.
const ALLOW_LINE = /eslint|@ts-|https?:\/\/|BANNED|ALLOW_LINE|NEGATED|test-operational-copy/;

// A negated mention — "관측 횟수가 아니라 왜 중요한지" — states what the screen
// deliberately omits. That is editorial stance, not a pipeline reading.
const NEGATED = /^\s*(?:[이가은는을를]?\s*)?(?:아니라|아닌|아니고|아니며|아님|없이|하지\s*않|금지|제외|숨김)/;

const findings = [];
let scanned = 0;

for (const file of SOURCES) {
  let text;
  try {
    text = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
  } catch {
    continue; // A source that has been retired is not a failure.
  }
  scanned++;
  const lines = text.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    if (ALLOW_LINE.test(line)) continue;
    // Source comments never reach a reader.
    if (/^\s*(?:\/\/|\*|\/\*)/.test(line)) continue;
    for (const banned of BANNED) {
      banned.re.lastIndex = 0;
      let match;
      while ((match = banned.re.exec(line))) {
        if (NEGATED.test(line.slice(match.index + match[0].length, match.index + match[0].length + 14))) continue;
        findings.push({
          file,
          line: index + 1,
          id: banned.id,
          phrase: match[0].trim(),
          why: banned.why,
          context: line.trim().slice(Math.max(0, match.index - 40), match.index + 60).slice(0, 100),
        });
      }
    }
  }
}

if (findings.length) {
  console.error(`operational copy on reader-facing surfaces (${findings.length}):`);
  for (const f of findings.slice(0, 30)) console.error(`  ${f.file}:${f.line}  [${f.id}] "${f.phrase}" — ${f.why}`);
}
console.log(JSON.stringify({ scanned, findings: findings.length }));
assert.equal(findings.length, 0, "reader-facing copy must carry insight and strategy, not pipeline bookkeeping");

// Console links keep their semantic source labels, but never expose a standalone
// external-link glyph. The glyph was visually rendered as `[ ↗]` in some cards.
const consoleLinkSources = [
  "assets/js/app.js",
  "assets/js/company-profile.js",
  "assets/js/account-one-pagers.js",
];
for (const file of consoleLinkSources) {
  const source = await readFile(rel(file), "utf8");
  assert.doesNotMatch(source, /↗/, `${file} must not render external-link arrow markers`);
}
