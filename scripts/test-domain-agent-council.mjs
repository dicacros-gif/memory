import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [html, app, css] = await Promise.all([
  readFile(new URL("index.html", root), "utf8"),
  readFile(new URL("assets/js/app.js", root), "utf8"),
  readFile(new URL("assets/css/styles.css", root), "utf8"),
]);

const productBlock = app.slice(app.indexOf("const EXEC_DECISION_PRODUCTS"), app.indexOf("const AI_INFRA_DECISION_CONTEXTS"));
const contextBlock = app.slice(app.indexOf("const AI_INFRA_DECISION_CONTEXTS"), app.indexOf("const INVESTMENT_STRATEGY_PILLARS"));
const scenarioBlock = app.slice(app.indexOf("const AGENT_FUTURE_SCENARIOS"), app.indexOf("function agentFutureScenario"));
const agentBlock = app.slice(app.indexOf("function executiveDecisionAgentItems"), app.indexOf("function executiveDecisionCouncilConclusion"));
const renderBlock = app.slice(app.indexOf("function executiveDecisionDebateHTML"), app.indexOf("function renderExecutiveDecision"));

for (const id of ["hbm-ai-server", "server-dram", "enterprise-ssd", "mobile-pc-terminal", "auto-edge", "legacy-commodity"]) {
  assert.ok(contextBlock.includes(`"${id}"`), `missing domain context: ${id}`);
}
assert.doesNotMatch(productBlock, /china-exposure|중국 노출·가격 압력/, "policy/China must not remain as an AI Infra product-council domain");
assert.doesNotMatch(scenarioBlock, /중국 공급압력|정책 강화|BIS|VEU/, "domain council scenarios must focus on customer, workload and execution");

for (const phrase of [
  "Customized Memory Consulting · Custom HBM",
  "AI Application & HW/SW · On-device",
  "LLM Serving & Context Economics · Enterprise RAG",
  "Data Center Workload Optimization",
  "Partners & Clients · Repeatable New Biz",
]) assert.ok(app.includes(phrase), `missing council agenda: ${phrase}`);

for (const agent of [
  "Customer Strategist",
  "Serving & Rack Architect",
  "Facility & Energy Lead",
  "AI Application & LLM Lead",
  "Architecture & Qualification Lead",
  "New Biz & Partner Lead",
  "Evidence Auditor",
  "Executive Decision Lead",
]) assert.ok(agentBlock.includes(agent), `missing context-specific agent: ${agent}`);

assert.ok(app.includes("Paged KV · Scheduler · Prefill/Decode · RAG"), "domain contexts must connect current AI serving architecture to infrastructure decisions");
for (const phrase of ["영역별 실행 전략", "domain-council-context", "domain-council-flow", "domain-council-delivery", "STOP / REFRAME"]) {
  assert.ok(renderBlock.includes(phrase), `domain council must render ${phrase}`);
}
assert.match(agentBlock, /aiInfraDomainDecisionFrame\(agent, domain, decisionFrameContext\)/, "each agent must receive the selected domain frame");
assert.doesNotMatch(renderBlock, /class="agent-roster"|class="agent-chat/, "executive council must use flat workstreams rather than generic chat animation");
assert.match(renderBlock, /영역별 전략 팩 생성/);

assert.match(html, /AI Infra 영역별 전략 검증 · Backtest/);
assert.match(html, /infra-20260817-38/);
assert.match(css, /AI Infra Domain Council - context-specific consulting workstreams/);
assert.match(css, /#executive-decision \.domain-agent-council\s*\{[\s\S]*?background:\s*#eef3f7 !important/, "domain council must remain legible in dark and inverted themes");
assert.match(css, /#execDecisionCouncilSelect\s*\{[\s\S]*?color:\s*#10243a !important/, "domain selector text must remain visible in dark and inverted themes");
assert.match(css, /#execDecisionRunCouncil\s*\{[\s\S]*?background:\s*#10243a !important[\s\S]*?color:\s*#fff !important/, "domain strategy action must preserve button contrast");
assert.match(css, /@media \(max-width: 720px\)[\s\S]*?\.c-level-agent-controls\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) !important/, "domain controls must stack on narrow screens");
assert.match(css, /\.domain-council-context\s*\{[\s\S]*?grid-template-columns:\s*repeat\(5/);
assert.match(css, /\.domain-agent-workstream\s*\{[\s\S]*?border-left:\s*4px solid var\(--agent-color\)/);
assert.match(css, /\.domain-agent-council \*[\s\S]*?animation:\s*none !important/);

console.log(JSON.stringify({
  contexts: 6,
  agents: 8,
  agendas: 6,
  revision: "infra-20260817-38",
}, null, 2));
