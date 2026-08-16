import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [html, app, css] = await Promise.all([
  readFile(new URL("index.html", root), "utf8"),
  readFile(new URL("assets/js/app.js", root), "utf8"),
  readFile(new URL("assets/css/styles.css", root), "utf8"),
]);

assert.match(html, /메모리 시장에 대해 물어보세요 · Pain Point·Workload·신규 Biz/, "top query must ask for a memory-market AI Infra strategy problem");
assert.match(html, /aria-label="AI Infra 전략 질문"/, "top query must expose the strategy intent to assistive technology");

for (const label of [
  "Customer Pain",
  "Workload & DC",
  "Memory Solution",
  "New Biz & Partner",
  "Tech & Market",
  "Executive Action",
]) {
  assert.ok(app.includes(label), `missing AI Infra question category: ${label}`);
}

for (const agent of [
  "Customer Strategist",
  "Serving & Rack Architect",
  "Architecture & Qualification Lead",
  "New Biz & Partner Lead",
  "Evidence Auditor",
  "Executive Decision Lead",
]) {
  assert.ok(app.includes(agent), `missing AI Infra strategy agent: ${agent}`);
}

assert.match(app, /Business Outcome → Workload\/SLO → Dominant Bottleneck → HW\/SW Options → 90-Day Gate/, "agent flow must follow the bottleneck-first consulting value chain");
assert.match(app, /AI Infra 전략 실행/, "agent surfaces must use action-oriented run labels");
assert.doesNotMatch(app, /토론 실행|Agent 실행 대기|Memory 시장에 대해 물어보세요/, "legacy market-search and debate labels must be removed");
assert.match(app, /let agentTtsEnabled = false/, "speech must remain disabled so it cannot block the result");
assert.match(app, /window\.localStorage\.removeItem\(AGENT_TTS_STORAGE_KEY\)/, "legacy speech preferences must not re-enable the slow path");
assert.doesNotMatch(app, /container\.prepend\(video\)/, "agent execution must not inject decorative background video");
assert.match(app, /container\.classList\.remove\("agent-debate-has-video"\)/, "agent execution must enforce the flat consulting treatment");
assert.match(app, /body\.innerHTML = `\$\{qaStrategyPackHTML\(pair, query\)\}\$\{currentBriefHTML\}/, "strategy answers must render immediately and answer before live evidence");

assert.match(css, /\.qa-strategy-flow\s*\{[\s\S]*?grid-template-columns:\s*repeat\(5/, "question answers must show a five-stage consulting flow");
assert.match(css, /AI Infra Agent OS: flat consulting geometry/, "agent UI must use the flat consulting visual override");

console.log("AI Infra Agent OS checks passed.");
