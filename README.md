# SK hynix CorpDev & Investment Intelligence

하이닉스 관점의 **M&A·지분투자·CVC·포트폴리오 밸류업**과 **반도체 미래 기술 동향**을 매일 자동 업데이트하는 투자 의사결정 대시보드입니다. GitHub Actions 에이전트가 **외신(foreign press) 중심**의 공개 데이터를 크롤링하고, `data/live.json`을 갱신한 뒤 GitHub Pages로 배포합니다.

## 주요 기능

| 영역 | 내용 | 출처 |
| --- | --- | --- |
| 투자 인텔리전스 Q&A | 카테고리별 드롭다운 질문 선택 + 자연어 검색, 타이핑 애니메이션 답변 | 정적 Q&A 모델 + 라이브 데이터 |
| 반도체·미래기술 동향 | HBM4/4E/5, CXL, PIM, AI-D DRAM, 포토닉스, 패키징 로드맵 | 정적 기술 모델 + 외신 |
| M&A·지분투자 기회 | 소수지분·제휴·JV·인수 구조별 국내외 타깃 발굴 레이더 | 정적 전략 적합도 + 딜플로우 외신 |
| CVC·펀드 유니버스 | 직접 소수지분 후보 + 전문 펀드 LP 커버리지 | 정적 전략 모델 + 외신 |
| 투자 포트폴리오 | Kioxia·Solidigm·AI Company 등 보유 지분율·밸류업 방향 | 공개 보도·기업 발표 기반 추정 |
| Deal 실행 프로세스 | 발굴→전략→포트폴리오→구조→실사→평가(Financial Modeling) | 정적 프로세스 + 밸류에이션 미니 모델 |
| 수익성·리스크 코크핏 | 기대수익 × 리스크 매트릭스, 핵심 리스크 팩터 | 정적 분석 모델 |
| 메모리 가격 | DRAM, NAND, wafer, SSD 공개 가격표 | TrendForce Price Trends / DRAMeXchange |
| 외신 뉴스·딜플로우 | HBM·DRAM·NAND·CXL·패키징·M&A 외신과 트렌딩 키워드 | Google News RSS (en-US, 외신 필터) |
| 주가 | SK하이닉스, 삼성전자, Micron 1개월 추이 | Yahoo Finance chart API |
| 경쟁사·CVC 레이더 | 삼성·Micron·CXMT·Kioxia/WD·YMTC, CXL·포토닉스 스타트업 | 외신 빈도 + 전략 적합도 |

## 외신 중심 뉴스

`scripts/crawl.mjs`는 Google News의 **US 영문판(`hl=en-US&gl=US&ceid=US:en`)** 을 질의하고, `isForeignItem()`이 다음을 제거해 외신만 남깁니다.

- 한글이 포함된 헤드라인
- 한국계 매체(연합·코리아헤럴드·조선·중앙·한경(KED)·ETNews·TheElec·`.kr` 도메인 등)

## 글꼴 애니메이션

스크롤 기반 IntersectionObserver 엔진(`assets/js/app.js`)이 숫자 카운트업, 지분율 게이지, 카드 reveal을 뷰포트 진입 시 재생하고, 벗어나면 리셋해 다시 볼 때마다 재생합니다. `prefers-reduced-motion`은 즉시 표시로 처리합니다.

## 파일 구조

| 경로 | 설명 |
| --- | --- |
| `index.html` | 단일 페이지 대시보드 |
| `assets/css/styles.css` | 대시보드 + 애니메이션 + 드롭다운 + 신규 섹션 스타일 |
| `assets/js/app.js` | 렌더링·애니메이션 엔진·Q&A 드롭다운·밸류에이션 모델 |
| `data/baseline.json` | Q&A, 포트폴리오, M&A, CVC·펀드, 기술 동향, deal 프로세스, 리스크/수익, 시뮬레이터 등 정적 모델 |
| `data/live.json` | 에이전트가 생성하는 라이브 데이터(외신 뉴스·딜플로우·가격·주가·레이더) |
| `data/price-history.json` | TrendForce 가격 누적 히스토리 |
| `scripts/crawl.mjs` | Node.js 외신·투자 인텔리전스 크롤러(에이전트) |
| `.github/workflows/pages.yml` | 매일 크롤 → 커밋 → Pages 배포 |

## 로컬 실행

`file://`로 열면 브라우저 `fetch`가 차단되므로 HTTP 서버로 실행하세요.

```bash
python -m http.server 8000
```

크롤러(에이전트) 실행:

```bash
node scripts/crawl.mjs
```

Node 18 이상이면 별도 의존성 없이 동작합니다.

## 자동 업데이트 (Daily Agent)

GitHub Actions가 **매일 06:00·18:00 KST**(`cron: 0 21 * * *`, `0 9 * * *`)에 에이전트를 실행합니다.

1. 외신 뉴스, 딜플로우(M&A·투자), 가격표, 경쟁사·CVC 레이더를 크롤링합니다.
2. `data/live.json`(과 변경 시 `data/price-history.json`)을 `main`에 커밋합니다.
3. 최신 대시보드를 GitHub Pages로 배포합니다.

수동 갱신은 Actions 탭에서 `Daily Intelligence Agent — Crawl & Deploy` 워크플로를 `workflow_dispatch`로 실행하면 됩니다.

## 배포 URL

```text
https://dicacros-gif.github.io/memory/
```

조직 또는 계정 정책으로 자동 활성화가 막히면 GitHub 저장소의 Settings → Pages → Source를 **GitHub Actions**로 설정하세요.

## 면책

본 대시보드는 공개 데이터 기반 정보 제공 및 내부 검토 보조용입니다. 투자 조언, 인수 권유, 또는 공급 계약 판단을 대체하지 않습니다. 지분율·밸류에이션 수치는 공개 자료 기반 추정이며 미공개 항목은 '소수지분'으로 표기합니다.
