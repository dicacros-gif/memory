# 06. 정리 작업 기록 (2026-11-13)

요청: 최종 소스와 실행에 필요한 파일만 남기고 오래된 작업 파일·테스트 파일·다른 브랜치를 삭제, 작업 내용은 위키로 정리.

## 기준

"실행에 필요한 파일" = 워크플로가 실행하는 스크립트(직접 호출, `npm run`과 그 사전 스크립트, import 체인), 사이트가 불러오는 HTML·JS·CSS·미디어·데이터, 배포 전 품질 게이트로 실행되는 테스트. 이 기준을 코드로 계산해 어디에서도 쓰이지 않는 파일만 삭제했습니다.

## 삭제한 파일

| 분류 | 파일 | 이유 |
|---|---|---|
| 스크립트 | `scripts/audit-public-links.mjs`, `scripts/refresh-market-structure.mjs`, `scripts/repair-news-localization.mjs` | 워크플로가 실행하지 않는 수동 도구 |
| 테스트 | `scripts/test-ai-infra-agent-os.mjs`, `test-console-capital-provenance.mjs`, `test-console-hover-timing.mjs`, `test-console-overlay-scope.mjs`, `test-strategy-experience.mjs` | 어떤 게이트에서도 실행되지 않는 테스트 |
| 캐시 | `scripts/terminal/__pycache__/collect_market.cpython-313.pyc` | 커밋된 파이썬 캐시 |
| 미디어 | `assets/media/memory-hero.mp4`, `memory-hero-lite.mp4`, `memory-hero-poster.webp`, `exec-backtest-*.webp` 4개 | 사이트가 더 이상 쓰지 않음(테스트가 사용 금지를 확인하는 은퇴 미디어) |
| 데이터 | `data/value-chain-levels.json` | 어떤 코드도 읽지 않음 |
| 차트 데이터 | `data/tenbagger/bars/` 63개(HKEX·TPEX·TSE 등) | 일간 스크린에서 빠져 어디서도 연결되지 않는 종목. 이후로는 빌드가 자동 정리(전체의 30% 초과 삭제는 막음) |
| package.json | `audit:links`, `refresh:market-structure`, `repair:news-localization` 스크립트, `test:hover-contrast`의 삭제된 파일 호출 | 삭제한 파일을 가리키던 항목 |

## 이동

`docs/`의 감사 문서 3건 → `wiki/2026-11-13_growth-industry-session/audits/` (`docs/` 폴더 제거)

## 유지한 것 (삭제 요청 범위였지만 실행에 필요)

- `npm run check:fast` 등으로 배포 전에 실행되는 `scripts/test-*.mjs` — 잘못된 수치·문구가 게시되지 않게 막는 품질 게이트입니다. 지우려면 워크플로의 게이트도 함께 빼야 하며, 그 경우 게시 전 검증이 사라집니다.
- `scripts/tenbagger/requirements.txt`, `scripts/terminal/requirements.txt` — 워크플로가 `pip install -r`로 사용.
- `assets/vendor/klinecharts/NOTICE` — 번들 차트 라이브러리의 라이선스 고지(배포 시 필수).
- 브랜치 `claude/gracious-curie-oidxdr` — 이 세션의 작업 브랜치(정리 후 `main`과 동일).

## 브랜치

| 브랜치 | 처리 | 복구 |
|---|---|---|
| `codex-deploy` (2026-08-27, `main`과 공통 이력 없음) | **삭제 보류** — 세션의 권한 정책이 원격 브랜치 삭제를 막음. GitHub → Branches에서 직접 삭제하거나 `git push origin --delete codex-deploy` | 삭제 후 복구: `git push origin 148291199dab5323f2dcfde6abecdb071dcffdae:refs/heads/codex-deploy` |

## 복구 방법

정리 직전 `main`: `378de826071c0f6c761bd4f2ab15c06b3bf3b5f1`. 삭제된 파일은 git 이력에 그대로 있습니다.

```bash
git checkout 378de826071c0f6c761bd4f2ab15c06b3bf3b5f1 -- <파일 경로>
```
