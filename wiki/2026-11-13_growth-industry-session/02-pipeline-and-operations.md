# 02. 자동 갱신 파이프라인과 운영

## 워크플로

| 파일 | 언제 | 하는 일 |
|---|---|---|
| `pages.yml` | 매시 23분(신선도 게이트), 수동, push | 반도체 크롤·파생 데이터·사전 렌더링·품질 게이트(`check:fast` 등) 후 GitHub Pages 배포 |
| `refresh-relay.yml` | 주기 실행 | 스케줄러 지연 대비 재실행. 미래 성장 산업 데이터(`status.json`)가 26시간보다 오래되면 `tenbagger.yml`을 다시 실행 |
| `tenbagger.yml` | **매일 21:17 UTC**, 수동(`force_cohort`), `universe.json`·관련 스크립트 push | 미래 성장 산업 데이터 전체 갱신(아래) |
| `deep-qa.yml` | 매일 18:47 UTC | 렌더링 감사(레이아웃·대비·리플로) |
| `crawl-exclusion.yml` | 요청 시 | 크롤 제외 요청 반영 |

## `tenbagger.yml` 단계 (순서대로)

1. **TradingView 시장 스캔** (`scripts/tenbagger/collect_tv.py`): 전 시장 약 3.2만 종목, 시장별 1회 요청. 컬럼은 하나씩 시험해 거부되면 건너뜀.
2. **FX** (`tenbagger-fx.mjs`): FRED 12개 통화 환율.
3. **Yahoo** (`tenbagger/collect_yf.py`): 가격·5년 일간 바·연간/분기 재무·밸류에이션·컨센서스·분할 이력·실적 서프라이즈.
   - 2개 워커, 요청 제한(429) 시 15초 공동 대기, 간격 자동 조정, 마지막에 재시도 1회, 예산 15분(컨센서스는 11분까지).
4. **과거 코호트** (`collect_cohort.py`): 주 1회, 10배 기본률.
5. **DART** (`tenbagger-dart.mjs`): `DART_API_KEY` 시크릿이 있을 때만.
6. **수집·스크린·빌드·포지션·출처 재확인**: `tenbagger-collect.mjs` → `tenbagger-screen.mjs` → `tenbagger-build.mjs` → `tenbagger-positioning.mjs` → `tenbagger-verify-sources.mjs`.
7. **무결성 감사** (`tenbagger-audit.mjs`): 실패하면 커밋하지 않고 이전 데이터 유지.
8. **커밋**: `data/tenbagger`만 커밋. 충돌 시 rebase, 그래도 실패하면 최신 main 위에 데이터만 다시 커밋.

## 운영 체크리스트

- **실행 결과 확인:** Actions → "Ten-bagger research data"의 마지막 실행. 로그의 `{"tenbaggerYf": … "tickers": N, "requested": M}`와 `{"tenbagger": … "freshPrices": …}` 줄이 수집률입니다(2026-11-09 기준 415/420).
- **즉시 다시 돌리기:** Actions → Ten-bagger research data → Run workflow (과거 코호트를 다시 만들려면 `force_cohort` 체크).
- **산업·종목 추가:** `data/tenbagger/universe.json`의 `sectors[]`에 추가하고 `verification: "pending"`, `sourceUrl`, `evidence`를 채웁니다. 파이프라인이 TradingView 스캔·SEC 티커 맵으로 상장을 확인한 뒤에만 화면에 나옵니다. 과거 10배 발생률을 계산하려면 `scripts/tenbagger-build.mjs`의 `sectorIndustries`에 TradingView 업종 이름을 추가합니다.
- **로컬 점검:** `npm run check:fast` (배포 전 게이트와 동일), 미래 성장 산업 테스트만: `node scripts/test-tenbagger.mjs`.

## 시크릿

| 이름 | 필요 여부 | 효과 |
|---|---|---|
| `DART_API_KEY` | 선택(권장) | 한국 종목을 DART 공시 분기 재무로 갱신. 없으면 Yahoo 연간 재무 스냅숏 |

코드에는 어떤 키도 넣지 않습니다. 브라우저 코드는 API 키 없이 공개 JSON만 읽습니다.
