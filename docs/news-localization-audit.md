# News localization publication audit

## Cause and scope

- `makeCorpus` and `strategyAccountCorpus` preferred `summaryOriginal` over the existing Korean translation. Derived account summaries and executive quotes therefore reintroduced Chinese source prose.
- The browser restored Chinese/Japanese original titles when localization was rejected. Retained artifacts and organisation statements had additional bypasses.
- A Chinese-source exception waived every numeric mismatch. Corrupt Japanese decoding and a `科林研發` → `Colin R&D` company-name translation also passed the old gate.

## Publication contract

- Raw source titles, summaries, URLs, aliases and crawl timestamps remain available for audit/retry.
- Chinese/Japanese news must have a usable Korean title and, when a source summary exists, a usable Korean summary. Failed articles are excluded from public projections, not replaced with generic insight text.
- English originals remain an allowed fallback. A successful language check is not evidence of numerical fidelity: both checks must pass.
- Cached translations are revalidated. Publication validation runs regardless of network budget, before derived text generation and again at the final client boundary. Retained console-only artifacts and legacy browser payloads use the same boundary.
- Numeric comparison is exact for supported decimal amounts, currencies, Chinese/Korean magnitudes and ranges. Ambiguous traditional `元`, unsupported written-number conversions and unproven semantic conversions are held, not guessed. The gate is not a proof of every sentence's meaning.
- No publisher-wide ban: healthy translations from the same Chinese source remain visible. Rejected raw records remain recoverable and eligible for next-run translation.

## Free endpoint retained

- Google Translate public endpoint; no paid model or API key introduced.
- Marker payloads at most 3,600 characters, including a single oversized source.
- Minimum 400ms request spacing with distinct slots for concurrent callers.
- Initial request plus four bounded retries, exponential 800/1,600/3,200/6,400ms backoff.
- Only complete, quality-accepted translations enter the source-keyed cache.
- Existing source limits, crawl concurrency and six-hour cadence unchanged.

## Verification

- Latest preserved crawl run: `33667141145`. Replay does not claim a new crawl or refresh market values.
- Real endpoint replay: one marker request for 13 fields; one accepted repair (`Lam Research`), twelve rejected fields retained for retry. No rate-limit/network error in this sample; future endpoint availability is not guaranteed.
- Current raw stream: 31 articles; public stream: 19, including 12 localized Chinese/Japanese articles. Twelve current CJK articles fail publication requirements; raw records preserved.
- Five shipped news/account/strategy artifact families: no Han/Kana or broken encoding in tested public text fields. Provenance fields intentionally excluded from that scan.
- `pnpm run check`: passed. Existing forecast-input/freshness warnings remain; no new forecast values manufactured.
- Text reflow: 30 route/hover states at 540, 1024 and 1440 CSS pixels; zero clipping findings.
- In-app TSMC/silicon cards: five cards checked, no residual Chinese/Japanese prose; unsafe old quotation absent.
- Main JS gzip increases 1,545 bytes (0.48%) for runtime publication safety; explicitly measured under a 317KiB budget.

Maintenance: `node scripts/repair-news-localization.mjs --write --translate-limit=30`, then regenerate client artifacts and prerender. Without `--write`, the repair reports changes without publishing them; translation is disabled unless an explicit positive limit is supplied.
