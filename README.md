# SK hynix Memory Intelligence

메모리 가격, 경쟁사 동향, 하이닉스 관점의 투자 후보 스타트업을 매일 자동 업데이트하는 정적 대시보드입니다. GitHub Actions가 공개 데이터를 크롤링하고, `data/live.json`을 갱신한 뒤 GitHub Pages로 배포합니다.

## 주요 기능

| 영역 | 내용 | 출처 |
| --- | --- | --- |
| 메모리 가격 | DRAM, NAND, wafer, module, SSD 공개 가격표 | TrendForce Price Trends / DRAMeXchange |
| CorpDev 업무별 대시보드 | M&A, CVC, 투자전략, 포트폴리오 value-up, 리스크 분석별 메모리 업계 신호 | 크롤링 데이터 + 고정 업무 프레임 |
| 주가 | SK하이닉스, 삼성전자, Micron 1개월 추이 | Yahoo Finance chart API |
| 경쟁사 동향 | 삼성전자, Micron, CXMT, Kioxia/WD, YMTC 뉴스 레이더 | Google News RSS |
| 스타트업 레이더 | CXL, photonics, chiplet, near-memory compute 투자 후보 | 정적 전략 적합도 + Google News RSS |
| 뉴스/키워드 | DRAM, NAND, HBM, 공급, AI 수요별 뉴스와 트렌딩 키워드 | Google News RSS |

## 파일 구조

| 경로 | 설명 |
| --- | --- |
| `index.html` | 단일 페이지 대시보드 |
| `assets/css/styles.css` | 대시보드 스타일 |
| `assets/js/app.js` | 데이터 렌더링과 필터 인터랙션 |
| `data/baseline.json` | 고정 가정값, 시뮬레이터 설정, 면책 문구 |
| `data/live.json` | 크롤러가 생성하는 라이브 데이터 |
| `data/price-history.json` | TrendForce spot/contract 가격 누적 히스토리 |
| `scripts/crawl.mjs` | Node.js 크롤러 |
| `.github/workflows/pages.yml` | TrendForce 30분 폴링, 가격 히스토리 커밋, Pages 배포 |

## 로컬 실행

`file://`로 열면 브라우저 `fetch`가 차단될 수 있으므로 HTTP 서버로 실행하세요.

```bash
python -m http.server 8000
```

크롤러 실행:

```bash
node scripts/crawl.mjs
```

Node 18 이상이면 별도 의존성 없이 동작합니다.

## 자동 업데이트

TrendForce는 공개 webhook을 제공하지 않으므로 GitHub Actions가 30분마다 공개 가격표를 폴링합니다.

1. 공개 spot price와 contract price 표를 크롤링합니다.
2. `Last Update`, 평균가, 변동률이 바뀐 품목만 `data/price-history.json`에 새 포인트로 누적합니다.
3. 가격 히스토리가 바뀐 경우에만 `data/live.json`과 `data/price-history.json`을 `main` 브랜치에 커밋합니다.
4. 최신 대시보드를 GitHub Pages로 배포합니다.

수동 갱신은 Actions 탭에서 `Poll TrendForce & Deploy to Pages` 워크플로를 `workflow_dispatch`로 실행하면 됩니다.

## 배포 URL

저장소가 GitHub Pages를 사용하도록 활성화되면 일반적으로 아래 주소에서 확인할 수 있습니다.

```text
https://dicacros-gif.github.io/memory/
```

조직 또는 계정 정책으로 자동 활성화가 막히면 GitHub 저장소의 Settings → Pages → Source를 **GitHub Actions**로 설정하세요.

## 면책

공개 데이터 기반 정보 제공 및 내부 검토 보조용입니다. 투자 조언, 인수 권유, 또는 공급 계약 판단을 대체하지 않습니다.
