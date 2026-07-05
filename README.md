# SKHY China Memory Benchmark Dashboard

중국 메모리 경쟁사와 공급망을 추적하는 정적 대시보드입니다. `bizdevelopment1-max/ai` 스타일을 참고해 좌측 카테고리, 상단 자연어 Q&A, 보드형 카드, 글꼴 애니메이션, 드롭다운 질문/답변 인터랙션으로 구성했습니다.

## 주요 구성

| 영역 | 내용 | 데이터 |
| --- | --- | --- |
| Memory Categories | DRAM/CXMT, NAND/YMTC, 첨단 패키징, 소부장·장비, 인재/IP, 지정학 | `data/baseline.json` |
| China Competitors | CXMT, YMTC, JCET/TFME, XMC, Naura, AMEC, ACM Research, Shanghai Sinyang/Anji | 첨부 벤치마킹 원문 기반 |
| Intelligence Sources | CITIC/CICC/HSBC, Boss Zhipin, Maimai, TechInsights, Yole, DigiTimes, 36Kr, EE Times | 정적 모델 + 외신 |
| Competitive Dynamics | 범용 DRAM 가격 하방, NAND/eSSD 교란, 패키징 우회, 소부장 국산화, 인재/IP 이동 | 정적 모델 |
| Benchmark Models | HBM 인증, 레거시 DRAM 가격, NAND/eSSD 믹스, CXL 번들, 패키징 우회 | 정적 모델 |
| Spot / Contract Prices | TrendForce DRAM/NAND spot 및 contract price | `scripts/crawl.mjs` |
| Foreign / China News | 한국 출처를 제외한 외신·중국 중심 메모리 기사 | Google News RSS + 필터 |

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
| `data/baseline.json` | 중국 벤치마킹 정적 데이터 모델 |
| `data/live.json` | daily crawler가 갱신하는 가격·뉴스 데이터 |
| `data/price-history.json` | TrendForce 가격 이력 |
| `scripts/crawl.mjs` | TrendForce 가격, 외신 뉴스, 경쟁사 신호 수집 |
| `.github/workflows/pages.yml` | GitHub Actions 배포 |

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
