# Public source-link maintenance

The September 3, 2026 review covers static anchors, URLs declared in client JavaScript, the data manifest, lazy-loaded data (including the research archive), and the authored inputs that generate those artifacts. Internal navigation is also covered by `test:navigation-alignment` and the browser public-experience audit.

The final HTTP inventory contained 1,753 unique external destinations and 34 static local links: 1,328 returned usable responses, 96 blocked automated access, 327 could not be reached by the audit client, and 2 returned server errors. No confirmed 404/410 or detected soft-404 remained in the reader-facing inventory. This is **not a claim that every external page was verified**: most connection failures were on Yahoo Finance and the Internet Archive. Selected blocked official sources were additionally checked through indexed official content or the browser.

## Repairs and provenance

- Oracle AI infrastructure, Solidigm newsroom, TechInsights blog index, Cisco supplier PDF and SpaceX STARMIND: exact current official destinations.
- Broadcom XDSiP: exact official PDF; platform maxima and individual product configurations are now distinguished in the roadmap.
- Micron: retired biography replaced with the official leadership transition announcement; titles updated to match that source.
- TechInsights YMTC and The Register: corrected exact article URLs.
- One deleted Securities Times syndicated article: original Jiemian article with matching title/date; publisher attribution corrected.
- Another deleted Securities Times article: excluded from public reference lists; raw archive retained.
- Wuxi's unavailable 2017 consultation: retained as non-clickable historical attribution, not a final approval. Only the land-use claim links to the separately scoped 2018 official plan.

`data/public-link-policy.json` holds reviewed, exact-match corrections. The publication step applies them to fresh and retained artifacts. It never changes the dated raw crawl database, probe attempts, or the inaccessible original into a purportedly verified new observation. A publisher portal is not substituted for an unavailable article or privately supplied report.

## Commands

```sh
pnpm run test:public-links
pnpm run audit:links
node scripts/audit-public-links.mjs --network --resume
node scripts/audit-public-links.mjs --network --resume --retry-errors
node scripts/audit-public-links.mjs --network --host=oracle.com --output=.tmp/oracle-links.json
```

The detailed local report is `.tmp/public-link-audit.json` (not deployed). `--resume` reuses observations from the existing report; omit it for a fresh audit. Use a different output path for a filtered run to retain the full report. HTTP 403/429, timeouts and transient server errors are reported separately, not labelled as deleted pages and not automatically removed.

The offline regression runs in `check:fast` and checks corrected destinations, retained-snapshot repairs, publisher attribution, non-destructive archive handling, query-based article identity and relative canonical links. External site downtime does not make the whole site disappear.
