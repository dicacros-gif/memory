# 05. 작업 이력 (PR)

모든 PR은 `claude/gracious-curie-oidxdr` → `main`으로 머지되었습니다. 저장소: https://github.com/dicacros-gif/memory/pulls?q=is%3Apr+is%3Amerged

## 반도체 인텔리전스·터미널 (2026-10-23 ~ 10-27)

| PR | 날짜 | 내용 |
|---|---|---|
| #6 | 2026-10-23 | feat: generated investment memo and semiconductor terminal |
| #7 | 2026-10-23 | feat: terminal alerts, brokers, correlation, ETFs and a live landing |
| #8 | 2026-10-23 | Terminal: Bloomberg tickers, sector keys, security bar, related functions, BTST backtest; next-refresh indicators |
| #10 | 2026-10-23 | fix: drop pipeline-cadence wording from landing freshness line |
| #11 | 2026-10-23 | chore: regenerate client artifacts on merged main data |
| #12 | 2026-10-23 | chore: regenerate client artifacts on merged main data |
| #13 | 2026-10-26 | fix: retry headless Chrome launch in rendered audits |
| #14 | 2026-10-27 | ci: make the refresh run survive transient runner failures |
| #15 | 2026-10-27 | ci: two-hourly freshness gate so dropped or failed runs are retried |
| #16 | 2026-10-27 | fix: publish current news and briefs, refresh hourly-gated |
| #17 | 2026-10-27 | ci: scheduler-independent refresh relay |
| #18 | 2026-10-27 | fix: a brief's translation fallback must not block publication |
| #19 | 2026-10-27 | fix: gate the news that ships, not only the news that was crawled |
| #20 | 2026-10-27 | fix: brief relevance over translation; topic terms match whole words |
| #21 | 2026-10-27 | Merge remote-tracking branch 'origin/main' into claude/gracious-curie-oidxdr |

## 미래 성장 산업 앱 (2026-11-08 ~ 11-13)

| PR | 날짜 | 내용 |
|---|---|---|
| #22 | 2026-11-08 | data: space & defense sector re-researched with live sources (SpaceX now NASDAQ:SPCX) |
| #23 | 2026-11-08 | fix: ten-bagger prices via yfinance (plain Yahoo requests got HTTP 429); SEC concept by latest period |
| #24 | 2026-11-08 | ten-bagger market screen, landing radar, nav link |
| #25 | 2026-11-08 | feat: ten-bagger stock detail (daily chart + data-built explanation), startup stake view, research factor score |
| #26 | 2026-11-08 | data: coverage expansion — bottleneck layers, Korean small/mid caps, cybersecurity and energy storage, value-chain layers |
| #27 | 2026-11-08 | feat: daily investor brief (preset entries/exits, new offerings, big moves, additions) on the main page and app; data-pending state |
| #28 | 2026-11-08 | feat: minimum-revenue filter and small-revenue-base label in the screener |
| #29 | 2026-11-08 | feat: growth-industry flows & positioning monitor; FX for every market (fixes non-USD market caps) |
| #30 | 2026-11-08 | feat: forward P/E & PEG, industry 10x-potential heatmap, cash & runway monitor, visual daily changes |
| #31 | 2026-11-08 | fix: next earnings date falls back to Yahoo's earnings calendar |
| #32 | 2026-11-08 | feat: fill missing data, more quant indicators (daily), SEC balance-sheet fixes |
| #33 | 2026-11-08 | data: four new growth industries — obesity & metabolic, fintech & digital assets, autonomy & mobility, medtech & AI diagnostics |
| #34 | 2026-11-08 | feat: long-horizon quant indicators, industry medians, balance-sheet provenance |
| #35 | 2026-11-08 | data: three more growth industries — power grid, gene & cell therapy, satcom & 6G |
| #36 | 2026-11-08 | fix: fill data gaps (parallel Yahoo fetch, TradingView ratios), revenue acceleration |
| #37 | 2026-11-08 | data: three more growth industries — critical minerals, drones & counter-UAS, data-center power & cooling |
| #38 | 2026-11-08 | fix: Yahoo rate limits (shared cool-down + retry pass), filled cash for missing STI |
| #39 | 2026-11-08 | feat: industry percentile ranks and relative strength vs industry |
| #40 | 2026-11-08 | data: three more growth industries — edge-AI devices, advanced packaging materials, water infrastructure |
| #41 | 2026-11-08 | fix: SEC short-term investments — current debt-securities concepts filers use |
| #42 | 2026-11-09 | feat: consensus estimates, investment discipline, gross profitability, 3y dilution |
| #43 | 2026-11-09 | feat: research evidence for the quant indicators; 12-month price-range position |
| #44 | 2026-11-09 | fix: share-count dilution adjusted for stock splits |
| #45 | 2026-11-09 | feat: earnings surprises, accruals, gross profit for filers without the tag; fill gaps |
| #46 | 2026-11-09 | data: three more growth industries — K-beauty exports, silicon photonics & optics, hydrogen & fuel cells |
| #47 | 2026-11-13 | chore: 저장소 정리(미사용 스크립트·테스트·미디어·오래된 차트 파일 삭제, 위키로 문서 이동), 오래된 차트 파일 자동 정리 |

## 주요 결정 기록

- **환각 금지:** 출처 URL·날짜가 없는 수치는 게시하지 않음. 리서치 에이전트가 찾은 종목도 파이프라인 상장 확인 전에는 비공개.
- **무료 출처만:** SEC·DART·Yahoo·TradingView·FRED. 유료 데이터·로그인 없음.
- **"10배 점수" 같은 설명 없는 단일 점수는 만들지 않음:** 대신 지표별 정의·근거·업종 내 백분위를 보여 줌.
- **Yahoo 요청 제한 대응:** 순차 → 3개 병렬(429 증가로 실패) → 2개 워커 + 공동 대기 + 재시도로 정착(415/420 갱신).
- **안티그라비티·Neodo 리서치:** 세션에서 접근 가능한 결과물(브랜치·파일·세션)이 없어 반영하지 못했고, 대신 학술 근거 리서치로 지표를 보강함.
