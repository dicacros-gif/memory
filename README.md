# Memory Intelligence

## Data reliability pipeline

The published dashboard is generated through a fail-closed evidence pipeline:

1. Collect public price, market, news, policy, hiring, and community candidates.
2. Normalize canonical URLs, dates, languages, and source summaries.
3. Promote only records that pass every evidence check; place rejected candidates in `data/crawl-quarantine.json`.
4. Build management briefs only from promoted official, research, or authoritative-media evidence.
5. Generate `data/site-content-client.json` from the same verified run, combining current evidence with the approved consulting framework in `data/site-content-model.json`.
6. Run `scripts/audit-content.mjs` and publish the data and site-content bundle atomically only when every critical check passes.
7. Reject stale, incomplete, or mismatched bundles in the browser instead of falling back to unverified cached data.

### Automated site content

- The landing hero, decision cases, evidence synthesis, same-metric competitor cards, partner spotlight, and Console agent agendas share one verified `runId`.
- Time-sensitive values, dates, sources, and recommendations are generated from the current intelligence briefs. HTML contains neutral fail-closed placeholders rather than fixed market claims.
- The browser checks for a new manifest every 15 minutes while the page remains open. A partially published or mismatched artifact is never mixed with the prior run.
- The GitHub Actions agent runs four reconciliation refreshes per day (six-hour interval) from `data/source-catalog.json`; event webhooks can still trigger an earlier refresh. If collection or validation fails, the last verified bundle remains published.
- The catalog separates primary company/customer sources, standards, filings, market data, industry research, and authoritative media. Source coverage and the observed/configured ratio are generated into the landing bundle on every verified run.
- The AI Factory system view tracks seven independent evidence pillars: power/cooling, network/fabric, data/storage, scheduling/orchestration, LLM serving, accelerator/memory, and economics/governance. Each pillar exposes `fresh`, `observed`, or `coverage-gap` rather than inferring readiness from a different domain.
- Official IEA, ASHRAE, Kubernetes/Kueue, Kubernetes DRA, Slurm, NVIDIA, and vLLM sources are monitored through catalog-driven discovery and health checks. Vendor performance claims remain `Watch` unless workload, model, version, SLO, and observation date are reproducible.
- The generated `aiFactorySystem` contract carries the 9-layer architecture, six workload KPI sets, eight execution gates, source status, pillar coverage, and the latest promoted signal into the landing page and Console agent council.

### Decision automation

- `scripts/decision-intelligence.mjs` converts eligible official and research evidence into a versioned `ClaimEvent` ledger: entity, product, event, stage, metric, event date, source, evidence span, confidence, supersession, and contradiction state.
- Product progress is handled as an explicit state machine (`ANNOUNCED → SAMPLE → QUALIFICATION → MASS_PRODUCTION → COMMERCIAL_SHIPMENT → PLATFORM_ADOPTION → REVENUE`). Search relevance alone cannot advance a stage.
- Four consulting briefs—custom memory, agentic memory tiering, enterprise RAG, and AI Factory—are rebuilt from the current evidence. Each exposes customer pain, options, economics, 90-day action, owner, KPI, trigger, and kill criteria.
- A brief reaches `DECISION_READY` only when retrieval quality passes, independent-source coverage passes, and at least one linked `ClaimEvent` is verified. Otherwise it remains `EVIDENCE_READY` or `MONITORING`.
- Source operations are measured by configured-versus-observed coverage and decision-useful yield, not catalog size. Coverage gaps remain visible instead of being replaced by an inferred claim.
- `scripts/prerender-decision.mjs` produces `console/index.html` and `data/executive-latest.json`, so crawlers, link previews, and readers without JavaScript receive the latest verified executive snapshot.
- The publishing workflow uses a fast fail-closed gate on every refresh. `.github/workflows/deep-qa.yml` runs the broader regression suite nightly so slow checks do not delay every verified update.

### Integrity safeguards

- Korean news localisation uses the free Google Translate endpoint without an API key. Titles and source summaries are packed into marker batches of at most 3,600 characters, paced at a minimum 0.4-second interval, and retried four times with 0.8→1.6→3.2→6.4-second exponential backoff.
- Successful translations are cached by a SHA-256 digest of the normalised source text, so they are reused until that source text changes. Failed or low-quality results are never cached; the source-language text remains visible and the row is retried first on the next run.
- Korean translations are language- and token-audited against the source: residual English prose is rejected, and numeric, percentage, magnitude, and currency values must agree after normalising units (for example, CNY 29.5bn and 295억 위안). Failed checks are recorded in `crawl-audit.json` as `unverified` with the next-run self-healing state.
- Price-change calculations preserve their raw value for audit, but moves above the review threshold or with inadequate observation coverage are marked `review-required` and are not used as decision-grade momentum.
- Brief labels distinguish `사실(1차 확인)` (current-run official evidence) from `보도됨(1차 미확인)` (reported research/media evidence). A report is never promoted to a first-party fact by its label.
- `crawl-audit.json` exposes translation fidelity, price-source count/cross-check status, and per-channel collection timestamps. A single-source price series is explicitly labeled `single-source`, not cross-validated.
- Current brief text is emitted by a deterministic template (`llmUsed: false`) from linked source fields. Any future LLM path must declare the model/run and add sentence-level source-entailment checks before it can be promoted.
- The static-site “hide” control is device-local only. It does not claim administrator authentication or alter the shared crawl policy; shared exclusions remain in `data/crawl-exclusions.json`.

`data/crawl-audit.json` records each run and `data/live.json` contains the promoted evidence ledger. Curated and previous-run rows are kept only in explicit `reference-only` archives; they cannot enter live counts, briefs, quality gates, or quantitative drivers. This pipeline reduces unsupported claims; it does not turn estimates or reported claims into facts.

중국 메모리 경쟁사와 공급망을 추적하는 정적 대시보드입니다. `bizdevelopment1-max/ai` 스타일을 참고해 좌측 카테고리, 상단 자연어 Q&A, 보드형 카드, 글꼴 애니메이션, 드롭다운 질문/답변 인터랙션으로 구성했습니다.

## 주요 구성

| 영역 | 내용 | 데이터 |
| --- | --- | --- |
| Memory Categories | DRAM/CXMT, NAND/YMTC, 첨단 패키징, 소부장·장비, 인재/IP, 지정학 | `data/baseline.json` + live 대조 |
| China Competitors | CXMT, YMTC, JCET/TFME, XMC, Naura, AMEC, ACM Research, Shanghai Sinyang/Anji | 크롤 신호 + 벤치마킹 원문 |
| Intelligence Sources | CITIC/CICC/HSBC, Boss Zhipin, Maimai, TechInsights, Yole, DigiTimes, 36Kr, EE Times | 외신·현장 신호 크롤 |
| Competitive Dynamics | 범용 DRAM 가격 하방, NAND/eSSD 교란, 패키징 우회, 소부장 국산화, 인재/IP 이동 | 관계선별 근거 카운트 live |
| Scenario / Forecast | Bear·Base·Bull 배수, 프로젝션 가중치, 수요처 계정 신호 | `data/quant.json` (2026E 제3자 전망과 이번 실행 관측을 분리) |
| Quant Metrics | 환율·NVDA·AMD 5년 일봉, Micron 최근 20개 공시 분기(EDGAR), TSMC 최대 61개월 공식 월매출, 가격 모멘텀 | `data/quant.json` + `data/market-history.json` |
| Quant Backtest | 1년·3년·5년 고정 기간 누적 변화, CAGR, 최대 낙폭, 실제 커버리지·최대 공백 | `data/quant-backtest.json` |
| Spot / Contract Prices | TrendForce spot·contract + Wayback 공개 스냅샷 60개월 월별 증분 백필 | `data/price-history.json` |
| Foreign / China News | 한국 출처를 제외한 외신·중국 중심 메모리 기사 | Google News RSS + 증거 게이트 |

크롤링과 사이트 콘텐츠 재생성은 GitHub Actions에서 3시간마다 실행됩니다. 1·3·5년 성과는 cadence별 시작 허용 오차, 최소 실제 커버리지, 최소 관측 수, 최대 공백, 종료점 최신성을 모두 충족할 때만 계산합니다. 각 시작·종료값에는 포인트 원문/Wayback 근거와 단순 시리즈 출처를 구분해 기록합니다. 제품군 판단은 버전이 고정된 대표 품목만 동일가중 proxy로 사용하고 구성 품목과 실제 관측 구간을 노출합니다. 공개 메모리 가격 아카이브는 빈 구간을 보간하지 않으며 연속성이 부족하면 `데이터 부족`으로 표시합니다.

전망 숫자는 `2026E third-party forecast`로 표시하며, 링크 접근 성공과 숫자 본문 대조 성공을 분리합니다. PDF에 접속할 수 있어도 해당 값이 본문에서 기계적으로 확인되지 않으면 계산 입력으로 승격하지 않습니다. 원문 정량 수치(liveFigures)는 이번 실행에서 직접 확인된 기사 문장에서 추출해 출처·날짜와 함께 표시합니다.

## 투자위원회 메모 (매 실행 자동 생성)

`scripts/investment-memo.mjs`가 검증 실행본에서 투자 판단을 다시 계산해 `data/investment-memo-client.json`으로 발행합니다. 손으로 입력한 수치·날짜는 없습니다.

| 구성 | 입력 | 규칙 |
| --- | --- | --- |
| 요인 스코어카드 (−2~+2) | 메모리 현물·계약가, TSMC 월매출, Micron EDGAR 분기, 애널리스트 추정치(OpenBB), 바스켓 주가 위치, 중국 신호·환율 | 가중치·임계값은 `data/investment-memo-model.json` |
| 업종 의견 | 가중 점수 | ≥ +0.75 비중확대 · ≤ −0.75 비중축소 · 그 외 중립 · 커버리지 60% 미만이면 판단 보류 |
| 논지 폐기 조건 | 9개 점검 지표 | 경고·폐기 자동 판정 · 폐기 조건 2개 이상이면 의견 한 단계 하향 |
| 시나리오 | 종합 점수·경고 수 | Bull·Base·Bear 확률과 확인 지표 |
| 커버리지 신호 | 일별 종가 | 200일선·50일선·52주 고점 기준 추세 규칙 |

메모는 콘솔 1번 화면(결론), 4~6번 화면(이번 실행 검증 수치), 7번 화면(전체 메모)과 랜딩의 "오늘의 투자 판단"에 표시됩니다. 직전 실행 대비 의견·점수 변화와 최근 90회 이력을 함께 남깁니다.

## 반도체 터미널 (`terminal/`)

블룸버그 터미널 방식의 반도체 투자 화면입니다. 명령줄(`MU GP`, `000660 DES`, `MON`, `HELP`)과 기능 키(1~0, N, S)로 이동합니다.

| 기능 | 내용 |
| --- | --- |
| TOP | IC 메모 · 요인 스코어카드 · 폐기 조건 · 메모리 커버리지 · 시나리오 · 메모리 가격 · 추정치 · 실적 일정 · 매크로 |
| MON | 반도체 전 종목 모니터 (지역·체인 필터, 정렬, 스파크라인) |
| GP | KLineChart 캔들 차트 · MA·BOLL·VOL·MACD·RSI |
| DES | 시세·밸류에이션·수익성·컨센서스·추정치 변화·다음 실적·동종 종목 |
| EQRV | 배수 대비 성장 산점도 · 순위 |
| MEM · ECO | TrendForce 메모리 가격 · FRED 매크로·환율·SOX |
| SCRN | TradingView 글로벌 반도체 스크리너 (지연) |
| CAL · RISK · NEWS · SRC | 실적 일정·검증 촉매 · 폐기 조건·시나리오 · 뉴스 · 소스 상태·라이선스 |

데이터는 `scripts/terminal/collect_market.py`가 GitHub Actions 정기 실행마다 수집합니다. 계정·API 키·로그인이 필요 없는 소스만 사용합니다.

| 사용 | 용도 |
| --- | --- |
| OpenBB Platform (`openbb-core` + 무료 `yfinance` 공급자) | 시세, 밸류에이션 배수, 컨센서스, 실적 일정, EPS 추정치 변화, 투자의견 분포, OHLCV, 업종 순위, 기업 뉴스 |
| FinanceDataReader | FRED 시리즈(키 불필요 CSV), KRX 상장 정보 캐시 |
| TradingView-Screener | 로그인 없는 공개 스캐너 (지연 시세) |
| KLineChart | 차트 렌더링 (Apache-2.0, `assets/vendor/klinecharts/`) |

제외: OpenBB Workspace(구독), pykrx(KRX 로그인 필요), TradingView-API(계정 세션), tvdatafeed(비공식·중복), QuantConnect LEAN(데이터 구독·실행 엔진), Fincept Terminal(설치형 앱, 기능 구성만 참고), Lightweight Charts(지표 부족으로 KLineChart 선택). 수집이 실패하면 마지막 수집값을 유지하고 크롤은 그대로 발행합니다.

로컬 수집: `pip install -r scripts/terminal/requirements.txt && pnpm run collect:terminal`

## 한국 소스 제외

기사 피드는 한국 매체를 제외하도록 UI와 크롤러 양쪽에서 필터링합니다.

제외 예시:

- Yonhap/YNA, Chosun/biz.chosun, JoongAng/joins, Donga, Hankyung, KED Global
- Korea Times, Korea Herald, Business Korea, Business Post, The Elec, ETNews, ZDNet Korea
- SE Daily/Seoul Economic, Pulse/Maeil/MK, Aju, Edaily, MT, Fnnews, Newspim
- `*.kr`, `chosun.com`, `kedglobal.com`, `sedaily.com`, `mk.co.kr`, Naver, Daum 등

허용 방향:

- Reuters, Bloomberg, CNBC, TechInsights, Yole Group
- DigiTimes, 36Kr, EE Times, TrendForce 등 외신·중국/대만권 기술 미디어

## 파일 구조

| 경로 | 설명 |
| --- | --- |
| `index.html` | 단일 페이지 대시보드 |
| `assets/css/styles.css` | 레이아웃, 좌측 탭, Q&A, 보드, 애니메이션 스타일 |
| `assets/js/app.js` | 데이터 렌더링, 카테고리 필터, Q&A, 가격/뉴스 필터 |
| `data/baseline.json` | 중국 벤치마킹 기준 데이터 모델 (live 대조로 신선도 표시) |
| `data/live.json` | daily crawler가 갱신하는 라이브 번들 + 집계에서 제외된 reference/discovery archive |
| `data/site-content-model.json` | 수집 데이터와 분리된 승인형 컨설팅 프레임워크·업무 축 |
| `data/source-catalog.json` | 공식·고객·표준·공시·시장·리서치 출처, 탐색 질의, 최신성 SLA |
| `data/site-content-client.json` | 최신 검증 근거로 자동 생성되는 메인·Console 공통 콘텐츠 |
| `data/quant.json` | 정량 지표·시나리오 보정·원문 수치·계정 신호 (매 크롤 재계산) |
| `data/quant-backtest.json` | 1·3·5년 고정 기간 통계와 시리즈별 커버리지 감사 계약 |
| `data/price-history.json` | TrendForce 가격 이력 + web.archive.org 백필 과거점 |
| `data/market-history.json` | SOX·주가 등 시장지수 5년 이력 + quant 시계열 |
| `data/crawl-audit.json` | 크롤 실행별 감사 기록 |
| `data/crawl-quarantine.json` | 증거 게이트에서 격리된 후보 |
| `data/crawl-exclusions.json` | 재수집·재노출을 막는 기사·현장 신호·가격 품목 식별 키 |
| `scripts/crawl.mjs` | TrendForce 가격, 외신 뉴스, 경쟁사 신호 수집 |
| `scripts/site-content.mjs` | 검증 Brief를 전략 답안·경쟁 비교·파트너 사례·Agent 안건으로 생성 |
| `.github/workflows/pages.yml` | GitHub Actions 배포 |

## 수집 제외

기사 카드, 중국 현장 신호 카드, 가격 행에 마우스를 올리면 `×`가 나타납니다. 확인 비밀번호 입력 후 삭제하면 브라우저의 차단 목록에 URL·제목·품목 식별 키가 저장되어 다음 데이터 갱신에도 다시 표시되지 않습니다.

정적 GitHub Pages는 저장소를 직접 수정할 수 없으므로 전체 사용자와 daily crawler에 공통 적용할 항목은 같은 식별 키를 `data/crawl-exclusions.json`에 추가합니다. 크롤러는 뉴스, 경쟁사 레이더, 벤치마킹, 중국 현장 신호, 가격 표를 만들기 전에 이 파일을 읽어 제외합니다.

## 로컬 실행

```bash
python -m http.server 8000
```

브라우저에서 `http://127.0.0.1:8000/`을 엽니다.

크롤러 수동 실행:

```bash
node scripts/crawl.mjs
```

## 배포 URL

```text
https://dicacros-gif.github.io/memory/
```

## 면책

이 대시보드는 공개 자료와 사용자가 제공한 벤치마킹 원문을 바탕으로 만든 내부 검토용 정보 화면입니다. 매수·매도 의견이나 공급 계약 판단을 대체하지 않습니다.
