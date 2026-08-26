import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (relativePath) => readFile(new URL(relativePath, root), "utf8");
const [html, js, css, alias] = await Promise.all([
  read("index.html"),
  read("assets/js/strategy-experience.js"),
  read("assets/css/strategy-experience.css"),
  read("console/index.html"),
]);

const attr = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] || "";
const tabTags = [...html.matchAll(/<button\b[^>]*\brole="tab"[^>]*>/g)].map((match) => match[0]);
const panelTags = [...html.matchAll(/<section\b[^>]*\brole="tabpanel"[^>]*>/g)].map((match) => match[0]);

assert.match(html, /<main class="view" id="executiveView">/);
assert.match(html, /<main class="view" id="consoleView" hidden>/);
assert.equal(tabTags.length, 6, "Console must expose exactly six analysis tabs");
assert.equal(panelTags.length, 6, "Console must expose exactly six analysis panels");
assert.equal(new Set(tabTags.map((tag) => attr(tag, "data-console-tab"))).size, 6);
assert.equal(new Set(panelTags.map((tag) => attr(tag, "data-console-panel"))).size, 6);

for (const [index, tab] of tabTags.entries()) {
  const id = attr(tab, "id");
  const panelId = attr(tab, "aria-controls");
  const panel = panelTags.find((tag) => attr(tag, "id") === panelId);
  assert.ok(id && panel, `${id || "tab"} must control a real panel`);
  assert.equal(attr(panel, "aria-labelledby"), id);
  assert.equal(attr(tab, "aria-selected"), index === 0 ? "true" : "false");
  assert.equal(attr(tab, "tabindex"), index === 0 ? "0" : "-1");
  assert.equal(/\shidden(?:\s|>)/.test(panel), index !== 0);
}

const tabindexTags = [...html.matchAll(/<[^>]+\btabindex="[^"]+"[^>]*>/g)].map((match) => match[0]);
assert.equal(tabindexTags.length, 6, "only the roving tab set should declare tabindex");
assert.ok(tabindexTags.every((tag) => /\brole="tab"/.test(tag)));
assert.equal((html.match(/<ol class="causal-chain">/g) || []).length, 1, "the site must use one canonical strategy chain");
assert.match(html, /Market Shift[\s\S]*Account Pain[\s\S]*Full-stack Diagnosis[\s\S]*Memory Requirement[\s\S]*Portfolio &amp; New Biz[\s\S]*Economics &amp; Execution/);
assert.match(html, /01 · WHY[\s\S]*02 · WHO[\s\S]*03 · WHAT[\s\S]*04 · TRANSLATE[\s\S]*05 · SO WHAT[\s\S]*06 · NOW WHAT/);
assert.match(html, /01 · MEMORY STRATEGY[\s\S]*02 · NEW BUSINESS[\s\S]*03 · AI INFRA EXECUTION/);
assert.match(html, /AI Infra Strategy<br \/><em>Hyperscaler Roadmap to Memory Business<\/em>/);
assert.match(html, /legacy-strategy-flow[\s\S]*CUSTOMER PROBLEM[\s\S]*FULL-STACK DIAGNOSIS[\s\S]*STRATEGIC OPTIONS[\s\S]*EXECUTION GATE/);
assert.match(html, /legacy-account-grid[\s\S]*OpenAI[\s\S]*Anthropic[\s\S]*Microsoft Azure[\s\S]*Google[\s\S]*Amazon AWS[\s\S]*Meta[\s\S]*NVIDIA[\s\S]*Dell · OEM\/ODM/);
assert.match(html, /상용 사례[\s\S]*공동개발[\s\S]*프로토타입/);
assert.match(html, /ACCOUNT INTELLIGENCE[\s\S]*Tech &amp; Portfolio[\s\S]*Deal &amp; Execution/);
const priorityScope = html.match(/<section class="legacy-decision-queue"[\s\S]*?<\/section>/)?.[0] || "";
assert.match(priorityScope, /01 · OPENAI \/ ANTHROPIC[\s\S]*02 · AZURE \/ GOOGLE \/ AWS[\s\S]*03 · NVIDIA \/ BROADCOM \/ MARVELL[\s\S]*04 · DELL \/ OEM \/ ODM/);
assert.doesNotMatch(priorityScope, /100점|평균\s*\d|\d+(?:\.\d+)?점/, "priority board must not invent numeric scores");
assert.equal((html.match(/class="panel-method"/g) || []).length, 6, "each Console lens needs one consulting method frame");
assert.match(html, /console-proof-chain[\s\S]*QUESTION[\s\S]*EVIDENCE[\s\S]*ANALYSIS[\s\S]*OUTPUT[\s\S]*GATE/);
assert.doesNotMatch(html, /runId|크롤|로드 중|연결 중|현재 실행|consoleTemplate|\bbusiness-|McKINSEY|BCG|BAIN/i, "public copy must not expose operations or retired frameworks");
assert.doesNotMatch(html, /(?:landing|styles|app|company-profile|strategy-spine)\.min\.(?:css|js)/);

for (const filename of ["data-manifest.json", "company-directory-client.json", "site-content-client.json", "insight-ledger.json", "strategy-spine.json"]) {
  assert.ok(js.includes(`"${filename}"`), `${filename} must be wired into the active experience`);
}
assert.match(js, /fetchVerifiedArtifact\("company-directory-client\.json", "companyDirectory"\)/);
assert.match(js, /fetchVerifiedArtifact\("site-content-client\.json", "siteContent", \{ requireClientArtifact: true \}\)/);
assert.match(js, /fetchVerifiedArtifact\("insight-ledger\.json", "insightLedger", \{ requireClientArtifact: true \}\)/);
assert.match(js, /payload\?\.clientArtifact !== true/);
assert.match(js, /payload\?\.runId[^\n]+manifest\.runId/);
assert.match(js, /requestIdleCallback/);
assert.match(html, /id="verticalWorkloadGrid"[\s\S]*퍼블릭 클라우드[\s\S]*로보틱스/);
assert.match(html, /id="partnerModelGrid"[\s\S]*AI 개발 업체[\s\S]*데이터센터 운영사[\s\S]*IT 컨설팅 펌/);
assert.match(js, /renderVerticalWorkloads/);
assert.match(js, /renderPartnerModels/);
assert.match(js, /ArrowLeft[\s\S]*ArrowRight[\s\S]*Home[\s\S]*End/);
assert.match(js, /aria-selected/);
assert.match(js, /aria-pressed/);
assert.match(js, /skipLink\.setAttribute\("href", next\.view === "console" \? "#consoleContent" : "#mainContent"\)/);
assert.match(js, /document\.title = next\.view === "console"/);
assert.match(js, /heading\.focus\(\{ preventScroll: true \}\)/);
assert.match(js, /safeHref/);
assert.match(js, /https:[\s\S]*http:/);
assert.doesNotMatch(js, /MutationObserver|\.slice\(/, "active UI must not poll the whole DOM or truncate copy");
assert.doesNotMatch(js, /textContent\s*=\s*[^;]*(?:runId|seenCount)|innerHTML\s*=\s*[^;]*(?:runId|seenCount)/);

assert.match(css, /:focus-visible/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(css, /@media \(max-width: 860px\)[\s\S]*body \{ font-size: 15px; \}/);
assert.match(css, /\.hero-north-star[\s\S]*clip-path:\s*polygon\(/, "North Star must use a consulting geometry");
assert.match(css, /\.causal-chain li[\s\S]*clip-path:\s*polygon\(/, "strategy method must use connected chevrons");
assert.match(css, /\.panel-method[\s\S]*grid-template-columns/, "Console lenses must expose a reusable consulting frame");
assert.doesNotMatch(css, /text-overflow|line-clamp|white-space:\s*nowrap/);
assert.doesNotMatch(css, /\.(?:change-card|project-card|outcome-card|case-card):(?:hover|focus)/, "static cards must not pretend to be interactive");

assert.match(alias, /<meta name="robots" content="noindex,follow"/);
assert.match(alias, /http-equiv="refresh" content="0; url=\.\.\/#console\/account-intelligence"/);
assert.match(alias, /rel="canonical" href="https:\/\/dicacros-gif\.github\.io\/memory\/"/);
assert.match(alias, /location\.replace\(new URL\("\.\.\/#console\/account-intelligence"/);
assert.match(alias, /<a href="\.\.\/#console\/account-intelligence">Intelligence Console 열기<\/a>/);

console.log(JSON.stringify({ ok: true, tabs: tabTags.length, panels: panelTags.length, activeBundles: 2 }, null, 2));
