// Sources and Methods: how each number is produced, per-source update status
// (last success, stale since), figures needing evidence review, and the
// coverage change log.
import { esc, day, statusChip, srcBtn } from "./format.js";
import { companyUrl } from "./state.js";

const NAMES = { sec: "SEC EDGAR (미국 재무·공시)", dart: "DART OpenAPI (한국 재무·공시)", yahoo: "Yahoo Finance via yfinance (가격·일간 OHLC·비공시 재무)", tradingview: "TradingView 공개 스크리너 (업종 실측·발굴)", fred: "FRED DEXKOUS (원/달러)", cohort: "과거 코호트 (주 1회)" };

export function renderSources(root, { status, sources, changelog, companies }) {
  const byId = new Map((companies || []).map((c) => [c.id, c]));
  const review = Object.entries(sources?.results || {}).filter(([, r]) => r.reviewRequired);
  const failing = Object.entries(sources?.results || {}).filter(([, r]) => !r.ok);
  root.innerHTML = `<section class="view-head"><h1>출처와 방법</h1><p class="lede">공개·무료·로그인 없는 출처만 씁니다. 수집하지 못한 값은 비워 두지 않고 "자료 없음"으로 표시하며, 갱신이 실패하면 마지막 정상 값을 유지하고 지연 상태를 표시합니다.</p></section>
    <section><h2>출처별 갱신 상태</h2><div class="tbl-wrap"><table class="grid"><thead><tr><th class="first">출처</th><th>상태</th><th>마지막 성공</th><th>마지막 시도</th><th>비고</th></tr></thead><tbody>
      ${Object.entries(NAMES).map(([k, label]) => { const s = status?.sources?.[k]; return `<tr><td class="first">${esc(label)}</td><td>${!s ? statusChip("no data", "아직 실행되지 않음") : s.ok ? '<span class="chip chip-filed">✓ 정상</span>' : `<span class="chip chip-fail">✗ 실패</span> ${esc(day(s.staleSince))}부터 지연`}</td><td>${esc(day(s?.lastSuccess) || "—")}</td><td>${esc(day(s?.lastAttempt) || "—")}</td><td class="wrap">${esc(s?.detail || s?.error || (k === "dart" && !s ? "저장소 시크릿 DART_API_KEY가 있을 때만 실행 — 없으면 한국 재무는 데이터 제공사 수치(추정)로 표시" : ""))}</td></tr>`; }).join("")}
    </tbody></table></div></section>
    <section><h2>방법</h2><ul class="method-list">
      <li><b>매출·FCF</b>: 미국 SEC 제출사는 XBRL companyfacts. 분기 공시는 누적값이라 최근 12개월 = 누적 + 직전 회계연도 − 전년 같은 누적. FCF = 영업현금흐름 − 유형자산 취득(같은 기간 끝). 한국은 DART 단일회사 전체 재무제표, 키가 없으면 Yahoo 연간 재무.</li>
      <li><b>FCF 플러스</b>는 이익이 났다는 뜻이 아니라 영업현금흐름이 설비투자보다 컸다는 뜻입니다.</li>
      <li><b>런웨이</b>: FCF 마이너스일 때만. 현금만 / 현금+단기투자 두 가지, 같은 재무상태표 날짜·같은 통화일 때만 계산하며 연간 소진이 일정하다고 가정합니다. 기준일 이후 증자 공시는 따로 표시하고 현금에 더하지 않습니다. 공시 재무의 같은 기간이면 "공시", 데이터 제공사 수치면 "추정".</li>
      <li><b>10배 시나리오</b>: 주당 가치 10배를 매출 성장·FCF 마진·배수·희석으로 계산하며 모든 가정은 기업 상세에서 바꿀 수 있습니다. 시가총액을 산업 전체 매출과 비교하는 방식은 쓰지 않습니다.</li>
      <li><b>교차 확인</b>: TradingView 수치와는 둘 다 최근 4분기 성장률이고 기간 끝이 가까울 때만 비교합니다. 회계연도 성장률과 최근 4분기 성장률은 비교하지 않습니다.</li>
      <li><b>산업 전망</b>: 기관마다 시장 정의·기간이 달라 평균하지 않고 기관별로 정의와 함께 보여 줍니다. 예측(전망)과 관측(상장사 실적)은 따로 표시합니다.</li>
      <li><b>지분율</b>: 공시·회사 발표·보도에 명시된 값만, 근거 유형과 측정일을 붙입니다. 투자 금액이나 기업가치로 지분율을 역산하지 않습니다. 측정 후 새 투자 라운드가 있었다면 "이후 라운드 전"으로 표시합니다.</li>
      <li><b>과거 텐배거</b>: 사후 사례와 전체 시작점 검증을 분리합니다. 현재 상장 종목만 표본이라 생존 편향이 있습니다.</li>
      <li><b>일간 차트</b>: 미국 상장은 TradingView 위젯(지연 시세). 그 외 시장은 Yahoo Finance 일간 수정 OHLC를 저장해 그리며, 공식 재배포 라이선스 시세가 아니므로 정확한 시세는 TradingView 링크에서 확인하세요.</li>
      <li><b>검토 절차</b>: 재무·가격은 매일 자동 갱신됩니다. 출처 페이지의 수치가 바뀐 지분율·산업 전망은 자동으로 덮어쓰지 않고 "검토 필요"로 표시합니다. 매 실행마다 무결성 감사(중복 티커, 날짜·출처 없는 지분, 미래 날짜, 비정상 숫자)를 통과해야 게시됩니다.</li>
    </ul></section>
    <section><h2>검토 필요 (${review.length})</h2>${review.length ? `<ul>${review.map(([url, r]) => `<li>${esc(r.reviewRequired)}부터 · 출처에서 수치가 더 이상 확인되지 않음 ${srcBtn(url, new URL(url).hostname)}</li>`).join("")}</ul>` : '<p class="muted">없음</p>'}
      <p class="sub">출처 재확인 ${esc(day(sources?.checkedAt) || "—")} · 링크 ${sources?.urls ?? "—"}개 중 열림 ${sources?.reachable ?? "—"}개 · 접근 실패 ${failing.length}개</p></section>
    <section><h2>추적 대상 변경 기록</h2>${(changelog?.entries || []).length ? `<ul class="changelog">${changelog.entries.map((e) => `<li><b>${esc(e.date)}</b> ${e.added.length ? `추가 ${e.added.map((id) => `<a href="${companyUrl(id)}">${esc(byId.get(id)?.name || id)}</a>`).join(", ")}` : ""} ${e.removed.length ? `제외 ${e.removed.map(esc).join(", ")}` : ""}</li>`).join("")}</ul>` : '<p class="muted">기록된 변경이 아직 없습니다.</p>'}</section>`;
}
