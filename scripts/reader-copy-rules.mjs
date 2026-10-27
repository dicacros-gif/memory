/**
 * Rules for copy a reader sees on a pre-rendered page. The gates in
 * test-operational-copy, test-site-content-automation and
 * test-public-copy-contract hold the published pages to them; producers that
 * place source text on a page (prerender-decision quotes a claim's own
 * sentence) check it here first, so a source sentence that happens to break a
 * rule is not quoted rather than blocking the day's publication.
 */

export const BANNED_READER_COPY = [
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
  { id: "freshness-telemetry", re: /업데이트\s*지연|재검증\s*필요|조건에\s*맞는\s*결과\s*없음/g, why: "파이프라인 상태는 항목을 숨기는 방식으로 처리" },
  { id: "unverified-placeholder", re: /(신호\s*확인\s*필요|확인되지\s*않음|미확인\s*항목|데이터\s*없음|해당\s*없음|준비\s*중입니다|추정치\s*기반)/g, why: "값이 없으면 항목 자체를 감추고 자리표시자를 남기지 않음" },
  { id: "empty-placeholder", re: /(?:^|[>\s"'([])(TBD|N\/A|TODO|Coming soon)(?=[<\s"')\].,]|$)/gi, why: "빈 자리표시자" },
];

// A negated mention — "관측 횟수가 아니라 왜 중요한지" — states what the screen
// deliberately omits. That is editorial stance, not a pipeline reading.
export const NEGATED_READER_COPY = /^\s*(?:[이가은는을를]?\s*)?(?:아니라|아닌|아니고|아니며|아님|없이|하지\s*않|금지|제외|숨김)/;

// Pre-rendered copy uses bullet endings, not plain declarative "~다." endings.
export const PLAIN_KOREAN_ENDING = /[가-힣]+다(?:[.!?。]|\s*$)/m;
// Visible dates use M/D, never a raw year-month-day.
export const RAW_VISIBLE_DATE = /\b(?:19|20)\d{2}[-.]\d{1,2}[-.]\d{1,2}\b/;

/** The id of the first rule `text` breaks, or null when it may be shown. */
export function readerCopyViolation(text = "") {
  const value = String(text || "");
  if (PLAIN_KOREAN_ENDING.test(value)) return "plain-korean-ending";
  if (RAW_VISIBLE_DATE.test(value)) return "raw-visible-date";
  for (const rule of BANNED_READER_COPY) {
    rule.re.lastIndex = 0;
    let match;
    while ((match = rule.re.exec(value))) {
      const after = value.slice(match.index + match[0].length, match.index + match[0].length + 14);
      if (!NEGATED_READER_COPY.test(after)) {
        rule.re.lastIndex = 0;
        return rule.id;
      }
      if (!rule.re.global) break;
    }
    rule.re.lastIndex = 0;
  }
  return null;
}
