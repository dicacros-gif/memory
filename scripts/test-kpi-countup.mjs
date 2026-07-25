import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../assets/js/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../assets/css/styles.css", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

assert.match(
  app,
  /const node = el\("article", `kpi kpi-value-card reveal\$\{isSecondRow \? " kpi-share-card" : ""\}`\);/,
  "all six KPI cards should receive the large-value typography class",
);
assert.match(app, /node\.dataset\.countReplay = "hover";/, "KPI cards should opt into hover replay");
assert.match(app, /from: 0,\s*to: countTarget\(node\),/s, "hover replay should always start from zero");
assert.match(app, /document\.addEventListener\("pointerover", replayOnEntry/, "pointer entry should replay the count-up");
assert.match(app, /document\.addEventListener\("focusin", replayOnEntry\)/, "keyboard focus should replay the count-up");
assert.match(app, /previous instanceof Node && scope\.contains\(previous\)/, "moving inside one card should not restart the animation");
assert.match(app, /setCountValue\(node, origin\);\s*const start = performance\.now\(\);/s, "the counter should visibly reset to zero before the first frame");
assert.match(app, /if \(reducedMotion\) \{\s*node\.classList\.remove\("is-counting"\);\s*setCountValue\(node, target\);/s, "reduced motion should show the target immediately");

assert.match(css, /\.kpi-value-card > strong \{[\s\S]*?font-family: "Space Grotesk", var\(--display\);[\s\S]*?font-size: clamp\(54px, 4\.5vw, 72px\);[\s\S]*?font-weight: 700;/, "KPI values should use one professional display treatment");
assert.match(css, /font-variant-numeric: lining-nums tabular-nums;/, "KPI figures should use aligned professional numerals");
assert.match(css, /\.kpi-value-card > strong > \.count \{[\s\S]*?font: inherit;/, "the inner counter must inherit the large value size");
assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.kpi-value-card > strong > \.count\.is-counting/s, "count-up motion should respect reduced-motion settings");

assert.match(app, /let memoryMarketModeTimer = 0;/, "market-map carousel must retain one rotation timer");
assert.match(app, /window\.setInterval\(\(\) => \{[\s\S]*?\}, 5000\);/, "market-map views should rotate on a five-second cadence");
assert.match(app, /board\.addEventListener\("mouseenter", stopMemoryMarketModeRotation\)/, "market-map carousel should pause on pointer hover");
assert.match(app, /data-memory-rotation-toggle/, "market-map carousel should offer a pause and resume control");
assert.match(css, /\.memory-map-tabs\[data-rotation-running="true"\] \.memory-map-cycle-progress b/, "market-map carousel should show five-second progress");
assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.memory-map-cycle-progress b/s, "market-map carousel should respect reduced-motion settings");
assert.match(app, /let chinaTalentGalleryInteractionPaused = false;/, "talent gallery should track temporary interaction pauses");
assert.match(app, /image\.classList\.toggle\("is-next", !active && relative === 1\);/, "talent gallery should position the upcoming slide beside the active slide");
assert.match(app, /image\.classList\.toggle\("is-previous", !active && relative === total - 1\);/, "talent gallery should position the previous slide beside the active slide");
assert.match(app, /panel\.addEventListener\("mouseenter", \(\) => \{\s*chinaTalentGalleryInteractionPaused = true;/s, "talent gallery should pause while a user inspects it");
assert.match(css, /#china-talent-strategy \.policy-layout \{[\s\S]*?grid-template-columns: minmax\(400px, \.85fr\) minmax\(0, 1\.35fr\);[\s\S]*?grid-template-areas: "focus panel";/, "operational workforce plan should stay left of the talent gallery");
assert.match(css, /\.talent-strategy-gallery-image\.is-previous/, "talent gallery should render a previous-slide preview");
assert.match(css, /\.talent-strategy-gallery-image\.is-next/, "talent gallery should render a next-slide preview");
assert.match(css, /@keyframes talentGalleryCarouselProgress/, "talent gallery should show the five-second rotation progress");
assert.match(html, /aria-roledescription="carousel"/, "talent gallery should expose its carousel role to assistive technology");
assert.doesNotMatch(app, /전략 참고용으로 전체 내용을 제공하며 수치와 결론은 재검증 전 의사결정 입력값으로 사용하지 않음/, "baseline disclaimer should not be rendered");
assert.doesNotMatch(app, /SKHY 판단/, "SKHY labels should use the neutral Insight label");
assert.match(app, /bodyLead: "Insight"/, "executive insight cards should use the Insight label");
assert.match(app, /function briefingBulletLines\(value = ""\)/, "broker summaries should be split into bullet-safe lines");
assert.match(app, /briefingBulletListHTML\(item\.body\)/, "broker article bodies should render as bullet lists");
assert.match(app, /class="exec-report-decision-list"/, "broker insights and reversal conditions should render as bullet lists");
assert.match(app, /class="exec-flow-node reveal/, "executive summary should render as a compact signal-to-decision flow");
assert.match(app, /class="exec-flow-signal"/, "executive flow nodes should retain the core evidence text");
assert.match(css, /\.exec-report-bullet-list > li::before/, "broker bullet lists should have a visual bullet marker");
assert.match(css, /\.exec-report-decision-list > li\.is-continuation/, "multi-line broker points should retain their bullet alignment");
assert.match(css, /\.exec-flow-node:not\(:last-child\)::after/, "executive flow nodes should have directional infographic connectors");
assert.match(css, /\.exec-strategy-index \{/, "ecosystem strategy cards should include numbered infographic nodes");
assert.match(css, /\.china-nand-focus\[data-nand-focus="policy"\] \{[\s\S]*?inset 0 5px 0 var\(--policy-violet\);/, "policy selection should emphasize the complete panel");
assert.match(css, /\.china-nand-focus\[data-nand-focus="policy"\] \.nand-focus-head h3 \{[\s\S]*?text-decoration: none;/, "policy heading should not use isolated text highlighting");
assert.match(css, /\.china-nand-focus\[data-nand-focus="policy"\] :is\(\.strategy-highlight, \.answer-term\) \{[\s\S]*?text-decoration: none !important;/, "policy content should not use isolated term highlighting");
assert.match(app, /<p>\$\{escapeHTML\(line\)\}<\/p>/, "AI matrix summaries should render plain text without isolated term highlighting");
assert.doesNotMatch(css, /\.ai-summary-line \.strategy-highlight/, "AI matrix summaries should not style individual highlighted terms");
assert.match(css, /\.ai-summary-line \{[\s\S]*?inset 0 4px 0 var\(--ai-summary-accent\)/, "AI matrix summaries should emphasize the complete card");
assert.match(app, /carouselPreview = false/, "image sliders should support optional adjacent-slide previews");
assert.match(app, /slide\.classList\.toggle\("is-next", carouselPreview && !active && relative === 1\);/, "talent filmstrip should position the next slide at the right edge");
assert.match(app, /slide\.classList\.toggle\("is-previous", carouselPreview && !active && relative === slides\.length - 1\);/, "talent filmstrip should position the previous slide at the left edge");
assert.match(app, /autoDelay: 5000,[\s\S]*?carouselPreview: true,[\s\S]*?transitionModes:/, "talent filmstrip should advance through the adjacent previews every five seconds");
assert.match(css, /#talent-radar \.talent-split \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/, "talent filmstrip should use the full board width rather than leave a right-side panel empty");
assert.match(css, /#talent-radar \.talent-radar-slider \.china-capital-slide\.is-previous/, "talent filmstrip should show a previous-slide preview");
assert.match(css, /#talent-radar \.talent-radar-slider \.china-capital-slide\.is-next/, "talent filmstrip should show a next-slide preview");
assert.match(css, /#china-talent-strategy \.policy-focus \{[\s\S]*?position: sticky;/, "operational workforce plan should remain visible while the image carousel moves");
assert.doesNotMatch(app, /BASELINE 분리/, "broker reports should not show a baseline-separation notice");
assert.doesNotMatch(app, /재검증 완료 전 라이브 카드와 별도 관리/, "broker reports should not show a separate-management disclaimer");
assert.match(app, /<h4 id="baselineReportsTitle">제공 리포트 \$\{fmtNum\(count\)\}건<\/h4>/, "provided broker reports should remain visible without a revalidation label");
assert.match(app, /const mustWaitForEnglishSpeech = Boolean\(agentTtsEnabled && agentSpeechSupported\(\) && englishSpeech\);/, "each agent turn should explicitly wait for its English TTS source");
assert.match(app, /if \(!typed \|\| !speechFinished \|\| completed \|\| !alive\(\)\) return;/, "the next agent must not be scheduled before typing and English TTS finish");
assert.match(app, /speakAgentTurn\(turn, i\)\.finally\(\(\) => \{[\s\S]*?speechFinished = true;[\s\S]*?completeTurn\(\);/s, "the sequence should unlock only after the TTS promise settles");
assert.match(app, /Do not pre-reveal queued agents[\s\S]*?schedule\(\(\) => speak\(0\), AGENT_DEBATE_TIMING\.rosterSettleMs\);/s, "queued agents should not appear before the prior English voice has ended");
assert.match(html, /styles\.css\?v=agent-tts-sequence-20260725-19/, "CSS cache key should include this integrated revision");
assert.match(html, /app\.js\?v=agent-tts-sequence-20260725-19/, "JavaScript cache key should include this integrated revision");

console.log("KPI typography and hover count-up checks passed.");
