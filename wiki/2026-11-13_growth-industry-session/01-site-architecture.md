# 01. 사이트 구성

정적 사이트(GitHub Pages)이며 빌드 서버가 없습니다. 브라우저가 `data/` 아래 JSON을 직접 읽고, GitHub Actions가 매일 그 JSON을 다시 만들어 커밋합니다.

## 페이지

| 경로 | 역할 |
|---|---|
| `index.html` | 메인(반도체·메모리 인텔리전스 랜딩). 상단 내비에 "반도체 터미널", "미래 성장 산업" 링크. FUTURE GROWTH RADAR 카드(`assets/js/tenbagger-radar.js`, `data/tenbagger/landing-client.json`) |
| `console/index.html` | 의사결정 콘솔(사전 렌더링: `scripts/prerender-decision.mjs`) |
| `terminal/index.html` | 블룸버그 스타일 반도체 터미널(`data/terminal-*.json`, `data/terminal-ohlcv/`) |
| `tenbagger/index.html` | **미래 성장 산업 앱**: 산업 · 상장 기업(스크리너) · 스타트업·투자자 · 과거 10배 · 출처와 방법 |
| `tenbagger/company.html?id=us-nasdaq-nvda` | 종목 상세(일간 차트, 퀀트 그리드, 업종 내 위치, 런웨이, 지분) |

## 미래 성장 산업 앱 모듈 (`tenbagger/js/`)

| 파일 | 역할 |
|---|---|
| `app.js` | 해시 라우팅(`#industries`, `#companies?…`, `#companies/runway`, `#startups`, `#history`, `#sources`), 단축키 1–4·9 |
| `data.js` | JSON 로더, 일간 바(`data/tenbagger/bars/`) 로더(KRX/KOSDAQ 별칭) |
| `industries.js` | 산업 카드(전망·관측·과거 10배·중앙값), 다이제스트, 잠재력 히트맵 |
| `positioning.js` | 수급·포지션 모니터, 건강 지도, 종목 포지션(RSI·범위 위치·상대 강도) |
| `screener.js` / `presets.js` | 스크리너 열·필터·프리셋(브라우저와 빌드가 함께 사용) |
| `company.js` / `company-page.js` | 종목 상세: 퀀트 그리드, 업종 내 백분위, 대차대조표 XBRL 항목 |
| `runway.js` | 현금·런웨이 모니터 |
| `startups.js`, `history.js`, `sources.js`, `evidence.js` | 스타트업 지분 지도, 과거 10배 사례·코호트, 출처와 방법, 지표 근거 연구 |
| `table.js`, `format.js`, `state.js`, `chart.js` | 공통 테이블(다중 정렬·CSV), 포맷, URL 상태, lightweight-charts |

## 데이터 파일 (`data/tenbagger/`)

| 파일 | 만드는 스크립트 | 내용 |
|---|---|---|
| `universe.json` | 리서치(수동·에이전트) | 산업·기업·스타트업·전망·근거(사람이 관리하는 유일한 입력) |
| `metrics.json` | `tenbagger-collect.mjs` | 종목별 가격·SEC/Yahoo 재무·밸류에이션·컨센서스 |
| `screen.json` | `tenbagger-screen.mjs` | TradingView 전 시장 스캔, 업종 실측, 팩터 리더, 발굴 |
| `companies.json` | `tenbagger-build.mjs` | 화면용 기업 레코드(퀀트·순위·보충 출처 포함) |
| `industries.json`, `startups.json`, `history.json`, `digest.json`, `landing-client.json` | `tenbagger-build.mjs` | 산업 집계, 스타트업, 과거 10배, 일간 변화, 메인 카드 |
| `positioning.json` | `tenbagger-positioning.mjs` | 산업 지수·모멘텀·변동성·폭, 종목 포지션 |
| `fx.json` | `tenbagger-fx.mjs` | FRED 환율 12개 통화 |
| `cohort.json` | `tenbagger/collect_cohort.py` | 과거 코호트(10배 기본률, 주 1회) |
| `status.json`, `changelog.json`, `source-checks.json` | build / verify-sources | 출처 상태, 상장 확인, 편입 변경, 출처 재확인 |
| `bars/*.json` | `tenbagger/collect_yf.py` | 5년 일간 OHLCV(차트용). 더 이상 참조되지 않는 파일은 빌드가 자동 정리 |

캐시(`yf-cache.json`, `tv-cache.json`, `dart-cache.json`)는 실행 중에만 쓰이고 커밋하지 않습니다(`.gitignore`).

## 실행에 필요한 파일의 기준

- 워크플로(`.github/workflows/*.yml`)가 직접 실행하거나, 워크플로가 부르는 `npm run …` 스크립트(사전 스크립트 포함)가 실행하거나, 그 스크립트가 import하는 파일
- 사이트 HTML/JS/CSS가 불러오는 파일과 데이터
- 배포 전 품질 게이트로 실행되는 `scripts/test-*.mjs`(예: `npm run check:fast`)는 실행 경로에 포함되므로 유지
