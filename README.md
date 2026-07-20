# Memory Intelligence

## Data reliability pipeline

The published dashboard is generated through a fail-closed evidence pipeline:

1. Collect public price, market, news, policy, hiring, and community candidates.
2. Normalize canonical URLs, dates, languages, and source summaries.
3. Promote only records that pass every evidence check; place rejected candidates in `data/crawl-quarantine.json`.
4. Build management briefs only from promoted official, research, or authoritative-media evidence.
5. Run `scripts/audit-content.mjs` and publish the JSON bundle atomically only when every critical check passes.
6. Reject stale, incomplete, or mismatched bundles in the browser instead of falling back to unverified cached data.

`data/crawl-audit.json` records each run and `data/live.json` contains the promoted evidence ledger. Curated or previous-run records can preserve continuity, but only sources observed during the current run can receive the `Confirmed` label. This pipeline reduces unsupported claims; it does not turn estimates or reported claims into facts.

중국 메모리 경쟁사와 공급망을 추적하는 정적 대시보드입니다. `bizdevelopment1-max/ai` 스타일을 참고해 좌측 카테고리, 상단 자연어 Q&A, 보드형 카드, 글꼴 애니메이션, 드롭다운 질문/답변 인터랙션으로 구성했습니다.

## 주요 구성

| 영역 | 내용 | 데이터 |
| --- | --- | --- |
| Memory Categories | DRAM/CXMT, NAND/YMTC, 첨단 패키징, 소부장·장비, 인재/IP, 지정학 | `data/baseline.json` + live 대조 |
| China Competitors | CXMT, YMTC, JCET/TFME, XMC, Naura, AMEC, ACM Research, Shanghai Sinyang/Anji | 크롤 신호 + 벤치마킹 원문 |
| Intelligence Sources | CITIC/CICC/HSBC, Boss Zhipin, Maimai, TechInsights, Yole, DigiTimes, 36Kr, EE Times | 외신·현장 신호 크롤 |
| Competitive Dynamics | 범용 DRAM 가격 하방, NAND/eSSD 교란, 패키징 우회, 소부장 국산화, 인재/IP 이동 | 관계선별 근거 카운트 live |
| Scenario / Forecast | Bear·Base·Bull 배수, 프로젝션 가중치, 수요처 계정 신호 | `data/quant.json` (EMA 보정, 매일 재계산) |
| Quant Metrics | 환율, NVDA/AMD 모멘텀, Micron 10-Q(EDGAR), TSMC 월매출(TWSE), 가격 모멘텀, 원문 정량 수치 | `data/quant.json` |
| Spot / Contract Prices | TrendForce spot·contract + Wayback 아카이브 백필(분기·1년·5년) | `data/price-history.json` |
| Foreign / China News | 한국 출처를 제외한 외신·중국 중심 메모리 기사 | Google News RSS + 증거 게이트 |

크롤링은 GitHub Actions에서 매일 06:00·18:00 KST 두 번 실행되며, 가격 모멘텀은 기준점이 실제 N일 근처일 때만 N일 변동으로 표기합니다(희소 이력 과장 방지). 원문 정량 수치(liveFigures)는 기사 문장에서 그대로 추출해 출처·날짜와 함께 표시하고 재해석하지 않습니다.

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
| `data/live.json` | daily crawler가 갱신하는 가격·뉴스·신호 번들 |
| `data/quant.json` | 정량 지표·시나리오 보정·원문 수치·계정 신호 (매 크롤 재계산) |
| `data/price-history.json` | TrendForce 가격 이력 + web.archive.org 백필 과거점 |
| `data/market-history.json` | SOX·주가 등 시장지수 5년 이력 + quant 시계열 |
| `data/crawl-audit.json` | 크롤 실행별 감사 기록 |
| `data/crawl-quarantine.json` | 증거 게이트에서 격리된 후보 |
| `data/crawl-exclusions.json` | 재수집·재노출을 막는 기사·현장 신호·가격 품목 식별 키 |
| `scripts/crawl.mjs` | TrendForce 가격, 외신 뉴스, 경쟁사 신호 수집 |
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
