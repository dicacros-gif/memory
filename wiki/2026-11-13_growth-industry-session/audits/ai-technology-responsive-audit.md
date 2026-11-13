# AI technology and responsive reading audit

Reviewed: 2026-09-03. Scope: the existing GitHub Pages site and console; no new application or publishing platform.

## Content placement and evidence

The existing `industry-shift` board contains `aiTechnologyTrends`, a native, keyboard-accessible reading layer with four disclosures:

1. GPT-5.6 Sol, Claude Fable 5.1, Gemini 3.8 Flash and Qwen3.8-Flash-Next: public specifications, operating features and explicit disclosure limits.
2. Encoder-only, decoder-only and encoder–decoder structures; independent Dense/MoE and MHA/MQA/GQA/MLA design axes.
3. RAG, vector storage, hybrid search, reranking, long context and agentic retrieval, with retrieval and generation quality gates.
4. Serving optimizations and conditional HBM–DRAM/CXL–eSSD implications, followed by a customer PoC sequence.

The layer cites 25 distinct primary documents inline. Product API limits are not treated as measured GPU memory, and undisclosed proprietary internals are not inferred. Historical open-model examples explain architecture; they are not presented as a latest-model leaderboard. Qwen Flash-Next is labelled experimental. Model cards and API specifications are distinct evidence types; the Gemini input/output limits are taken from its API specification.

This is reviewed editorial content, not an automatic claim that a crawler can discover proprietary architecture. Existing news and signal feeds remain separate. Direct network probes can be blocked or fail TLS independently of document availability; such probes are not reported as verified 404s or successful checks.

## Layout corrections

- Player cards, including Broadcom: explicit shrinkable grid tracks; wrap long links and evidence badges; stack label/value rows when the **card** is at most 420 CSS pixels wide.
- News: remove the three-line title clamp.
- Insight route and mover ribbons: shrinkable tracks and wrapping within their decorative boundaries.
- Landing account, OEM and memory-tier cards: responsive columns and long-token wrapping.
- AI Factory demand transition: remove fixed column minima that exceeded its inner width near the 900px breakpoint.
- Dark-mode evidence links: explicit readable normal, hover and keyboard-focus colors.

No source text is deleted or made smaller merely to conceal an overflow. Existing intentionally scrollable tables and diagram canvases retain their navigation.

## Regression checks

`pnpm run test:ai-technology` checks content placement, model numbers, disclosure boundaries, primary-source links and the card-width layout contract. It is included in `check:fast`.

`pnpm run audit:text-reflow` inspects browser text ranges against clipping ancestors and player/technical card boundaries. Its default widths are 320, 360, 390, 540, 768, 900, 1024, 1280, 1440, 1920 and 2560 CSS pixels. At each width it exercises eight console routes, the silicon tab, a real Broadcom hover, and the landing page: 121 states in total. All technical disclosures are expanded during the scan.

The isolated audit browser forces offscreen `content-visibility` sections to render, preventing retained child geometry from being compared with estimated placeholder dimensions. It does not remove overflow or clipping rules. Intentional independent scrolling remains allowed. Clip paths are checked against their bounding rectangles, not their exact polygon rasterization; visual inspection and the existing layout audit complement this check.

The existing `audit:layout` covers 20 width/selection cases. `audit:public-experience` covers 78 route, light/dark, hover/focus/pressed and reduced-motion states, now including the expanded technical content. The nightly deep-QA workflow runs all three browser audits and retains the text-reflow JSON report.

## Reproduction

```sh
pnpm run check:deep
pnpm run audit:layout
pnpm run audit:public-experience
pnpm run audit:text-reflow
```

For a focused breakpoint investigation: `node scripts/audit-text-reflow.mjs --widths=900`. Findings are written to `.tmp/text-reflow-audit.json`, which is not shipped to readers.
