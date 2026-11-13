# 세션 위키 — 미래 성장 산업 리서치 사이트 (2026-10-23 ~ 2026-11-13)

저장소 `dicacros-gif/memory`(GitHub Pages 정적 사이트)에서 진행한 작업을 정리한 위키입니다.
작업 브랜치는 `claude/gracious-curie-oidxdr`이고, 모든 변경은 PR로 `main`에 머지되었습니다.

## 문서 목록

| 문서 | 내용 |
|---|---|
| [01-site-architecture.md](01-site-architecture.md) | 사이트 구성(페이지·모듈·데이터 파일)과 실행에 필요한 파일 |
| [02-pipeline-and-operations.md](02-pipeline-and-operations.md) | 자동 갱신 워크플로, 단계별 동작, 운영·점검 방법, 시크릿 |
| [03-data-sources-and-indicators.md](03-data-sources-and-indicators.md) | 데이터 출처, 모든 퀀트 지표의 정의·보충 규칙·근거 연구 |
| [04-industries.md](04-industries.md) | 25개 성장 산업과 추적 종목 현황 |
| [05-work-log.md](05-work-log.md) | PR별 작업 이력(#6 ~ #47) |
| [06-cleanup-log.md](06-cleanup-log.md) | 2026-11-13 정리 작업: 삭제한 파일·브랜치와 복구 방법 |
| [audits/](audits/) | 이전에 `docs/`에 있던 감사 문서 3건(이동) |

## 한눈에 보기 (2026-11-13 데이터 기준)

- **추적 종목:** 492개(미국 255 · 한국 135 · 기타 102), 성장 산업 25개, 비상장 스타트업 58개
- **매일 자동 갱신:** 가격·재무·컨센서스·퀀트 지표·산업 수급(`.github/workflows/tenbagger.yml`, 매일 21:17 UTC + 관련 파일 변경 시)
- **퀀트 지표(종목당 30여 개):** 성장(매출 성장·3년 CAGR·가속·내년 컨센서스), 수익성(총이익/자산·ROE·Rule of 40), 현금(FCF 수익률·순현금·런웨이), 규율(자산증가−EBITDA증가·발생액·3년 희석), 추정치(EPS 수정·서프라이즈), 가격(모멘텀·RSI·12개월 범위 위치·산업 대비 상대 강도), 산업 내 백분위 순위
- **원칙:** 모든 수치는 출처 URL과 날짜가 있거나 비워 둠("자료 없음"). 무료·로그인 없는 출처만 사용. 보충 값은 `filledFrom`으로 출처를 표시.

## 남은 과제

1. **한국 분기 재무:** 저장소 시크릿 `DART_API_KEY`(DART OpenAPI 무료 키)를 추가하면 한국 종목이 공시 분기 재무로 바뀌고 매출 가속 등 분기 지표가 생깁니다.
2. **유럽 5종목 데이터 없음:** Roche·Air Liquide·Saab·4iG·Eni(스타트업 지분 보유사)는 Yahoo 요청 제한으로 아직 수집되지 않습니다.
3. **산업 리서치 근거:** 신규 산업 종목의 근거 문구는 검색 결과 발췌 기반이며, 상장 여부는 파이프라인이 매일 TradingView·SEC로 확인합니다.
