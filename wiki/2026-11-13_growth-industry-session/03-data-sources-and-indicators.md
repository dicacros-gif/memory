# 03. 데이터 출처와 퀀트 지표

## 출처 (모두 무료·로그인 없음)

| 출처 | 쓰는 곳 |
|---|---|
| SEC EDGAR companyfacts·submissions | 미국 상장사 재무(TTM·분기·연간), 대차대조표, 발행주식 수, 증자 공시 |
| DART OpenAPI | 한국 재무(키가 있을 때) |
| Yahoo Finance (yfinance 0.2.65) | 가격·일간 바·밸류에이션·컨센서스·EPS 추정치 추이·실적 서프라이즈·분할 이력·공매도·다음 실적일 |
| TradingView 공개 스크리너 | 전 시장 스캔, 업종 실측, 상장 확인, 빈 값 보충(P/S·P/E·ROE·부채비율·베타·총자산·다음 실적일) |
| FRED | 환율 12개 통화 |
| 기관 리포트(산업 전망) | `universe.json`의 `growth[]` — URL·발행일·정의 필수, 리포스트로만 확인된 수치는 제외 |

## 보충 규칙 (`filledFrom`)

1차 출처(SEC/DART → Yahoo)가 비어 있을 때만 다음 출처로 채우고, 종목 레코드의 `filledFrom`에 필드별 출처를 기록합니다. 예: `grossMarginPct ← SEC revenue − cost of revenue`, `shortTermInvestments ← Yahoo totalCash − filed cash`, `fcfYieldPct ← TradingView`(양수일 때만).

## 퀀트 지표 정의 (`companies.json` → `quant`)

| 그룹 | 지표 | 정의 |
|---|---|---|
| 성장 | 매출 성장률 | 최근 회계연도(또는 누적) 전년 대비 |
| | 매출 3년 CAGR | 최근 회계연도 매출 ÷ 약 3년 전 회계연도 매출(공시 연간 4개년 이상) |
| | 매출 가속(%p) | 최근 분기 매출 YoY − 직전 분기 매출 YoY(분기 6개 필요) |
| | 내년 매출 성장(컨센서스) | Yahoo 애널리스트 평균의 다음 회계연도 성장률 |
| 수익성 | 총이익/자산 | 매출총이익 ÷ 총자산(Novy-Marx 2013) |
| | ROE·순이익률 | Yahoo, 없으면 TradingView |
| | Rule of 40 | 매출 성장률 + FCF 마진 |
| 현금 | FCF 수익률 | 최근 12개월 FCF ÷ 시가총액(같은 통화) |
| | 순현금/시총 | (현금 + 단기투자 − 차입금) ÷ 시가총액, 같은 재무상태표 날짜 |
| | 런웨이 | FCF 마이너스일 때 (현금[+단기투자]) ÷ 연간 소진 |
| 규율 | 자산증가 − EBITDA증가(%p) | 최근 회계연도 총자산 증가율 − EBITDA 증가율(둘 다 양수 EBITDA) |
| | 발생액 비율 | (순이익 − 영업현금흐름) ÷ 총자산(Sloan 1996) |
| | 1년·3년 희석 | 공시 발행주식 수 변화, **주식분할 보정**, 50배 초과 변화는 오류로 보고 비움 |
| 추정치 | EPS 추정치 30·90일 변화 | 다음 회계연도 EPS 컨센서스의 30·90일 전 대비 변화, 상향·하향 횟수 |
| | EPS 서프라이즈 | 최근 4분기 컨센서스 상회 횟수와 평균 서프라이즈 % |
| 가격 | 모멘텀 z·RSI(14)·6개월·1년 최대 낙폭 | 일간 바로 계산 |
| | 12개월 가격 범위 위치 | 0 = 12개월 저점, 100 = 고점(Yartseva 2025의 매수 시점 변수) |
| | 산업 대비 상대 강도 | 종목 수익률 − 소속 산업 동일가중 지수 수익률(3개월·1년) |
| 밸류에이션 | 선행 P/E·PEG·P/S·P/S÷성장률·목표가 괴리·애널리스트 의견 | Yahoo, P/S는 공시 매출 기준(없으면 TradingView) |
| 순위 | 업종 내 백분위 | 첫 번째 소속 산업 안에서 지표별 0–100(높을수록 상위; P/S·P/E·희석·발생액·자산증가−EBITDA증가는 낮을수록 상위), 값이 있는 기업 5곳 이상일 때만 |

### 데이터 품질 가드

- 순현금: 공시 순현금과 Yahoo 최근 분기 순현금(같은 통화)의 부호가 다르고 차이가 시총의 5% 초과면 "확인 필요" 표시.
- 단기투자: SEC 개념 목록(`ShortTermInvestments`, `MarketableSecuritiesCurrent`, `DebtSecuritiesCurrent` 등) → 없으면 합계 개념 − 현금 → 없으면 Yahoo(금융업 제외). 쓰인 XBRL 항목을 `balanceSheetConcepts`에 기록.
- 통화가 다른 값끼리는 비율을 계산하지 않음(FX로 시가총액만 USD 환산).

## 지표 근거 연구 (사이트 "출처와 방법" 페이지에도 표시)

| 연구 | 연결 지표 |
|---|---|
| Yartseva (2025) *The Alchemy of Multibagger Stocks*, CAFE WP 33 | 팩터 점수(크기·가치·수익성·FCF 수익률), 자산증가−EBITDA증가, 12개월 범위 위치 |
| Novy-Marx (2013), *JFE* | 총이익/자산 |
| Cooper·Gulen·Schill (2008), *JF* | 자산 증가 |
| Chan·Jegadeesh·Lakonishok (1996), *JF* | EPS 추정치 수정, 모멘텀, 상대 강도 |
| Pontiff·Woodgate (2008), *JF* | 희석 |
| Sloan (1996), *The Accounting Review* | 발생액 비율 |
| Bernard·Thomas (1989), *JAR* | EPS 서프라이즈 |
| Bessembinder (2018), *JFE* | 10배 기본률(맥락) |
| Mayer (2015) *100 Baggers* | 성장·자본수익률·작은 규모·내부자 지분(맥락) |

초록·검색 발췌로 확인한 요약이며, 본문 인용이 아닙니다. 원문 링크는 `tenbagger/js/evidence.js`에 있습니다.
