#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeHtmlExecutiveCopy } from "./executive-copy.mjs";
import { computeClientRevision } from "./sync-client-revision.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const contentPath = resolve(root, "data", "site-content-client.json");
const extendedContentPath = resolve(root, "data", "site-content-extended-client.json");
const executivePath = resolve(root, "data", "executive-latest.json");
const consolePath = resolve(root, "console", "index.html");
const manifestPath = resolve(root, "data", "data-manifest.json");
const initialContent = JSON.parse(await readFile(contentPath, "utf8"));
const extendedContent = JSON.parse(await readFile(extendedContentPath, "utf8"));
const content = {
  ...initialContent,
  ...extendedContent,
  agentCouncil: { ...(initialContent.agentCouncil || {}), ...(extendedContent.agentCouncil || {}) },
};
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const clientRevision = computeClientRevision();

if (!content.clientArtifact || !content.runId || !content.generatedAt || initialContent.runId !== extendedContent.runId) {
  throw new Error("verified site-content-client.json is required for pre-render");
}
if (manifest.runId !== content.runId) throw new Error("manifest and site content runId must match before pre-render");

const escape = (value = "") => String(value ?? "")
  .replace(/솔리드다임/g, "솔리다임")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");
const date = (value = "") => String(value || "").slice(0, 10) || "확인 필요";
const automation = content.decisionIntelligence?.decisionAutomation || {};
const claimLedger = content.decisionIntelligence?.claimEvents || {};
const freshness = content.decisionIntelligence?.freshness || {};
const catalog = automation.catalogCoverage || {};
const briefs = automation.briefs || [];
const meceAxes = automation.meceAxes || [];
const currentClaims = (claimLedger.events || []).filter((item) => item.isCurrentStage).slice(0, 8);
const organization = content.organizationOperatingModel || {};
const projects = (content.strategyBoard?.projects || []).slice(0, 3);

const executive = {
  schemaVersion: "1.1",
  type: "executive-decision-snapshot",
  runId: content.runId,
  generatedAt: content.generatedAt,
  expiresAt: content.expiresAt,
  state: automation.state || "MONITORING",
  freshness: {
    score: Number(freshness.score || 0),
    status: freshness.status || "pending",
    label: freshness.label || "검증 대기",
  },
  sourceCoverage: catalog,
  funnel: automation.funnel || {},
  decisions: briefs.map((brief) => ({
    id: brief.id,
    label: brief.label,
    meceAxis: brief.meceAxis,
    decisionQuestion: brief.decisionQuestion,
    decisionStage: brief.decisionStage,
    deliverable: brief.deliverable,
    status: brief.status,
    whatChanged: brief.whatChanged,
    latestSignal: brief.latestSignal,
    sourceStage: brief.sourceStage,
    stage: brief.stage,
    confidence: brief.confidence,
    customerPain: brief.customerPain,
    factBoundary: brief.factBoundary,
    hypothesisStatus: brief.hypothesisStatus,
    officialFactCount: Number(brief.officialFactCount || 0),
    marketEstimateCount: Number(brief.marketEstimateCount || 0),
    hypothesis: brief.hypothesis,
    options: brief.options,
    economics: brief.economics,
    action90d: brief.action90d,
    owner: brief.owner,
    kpis: brief.kpis,
    trigger: brief.trigger,
    killCriteria: brief.killCriteria,
    evidence: (brief.evidence || []).slice(0, 5),
  })),
  organizationOperatingModel: organization,
  claimEvents: currentClaims,
  policy: "Deterministic source/date/stage gates; no uncited generated claim is published.",
};

const list = (items = []) => items.map((item) => `<li>${escape(item)}</li>`).join("");
const decisionCards = briefs.map((brief, index) => `
  <article class="decision-card">
    <header><span>${String(index + 1).padStart(2, "0")} · ${escape(brief.label)}</span><b>EXECUTIVE REVIEW</b></header>
    <h2>${escape(brief.decisionQuestion || brief.whatChanged || brief.hypothesis)}</h2>
    <div class="decision-scope"><span>${escape(brief.meceAxis || "decision")}</span><strong>${escape(brief.deliverable || "Executive Decision Brief")}</strong><em>FACT / HYPOTHESIS 분리</em></div>
    <div class="decision-grid">
      <section><small>CUSTOMER PAIN</small><p>${escape(brief.customerPain)}</p></section>
      <section class="is-fact-boundary"><small>FACT BOUNDARY</small><p>${escape(brief.factBoundary)}</p></section>
      <section class="is-hypothesis"><small>STRATEGY HYPOTHESIS</small><p>${escape(brief.hypothesis)}</p></section>
      <section><small>OPTIONS</small><ul>${list(brief.options)}</ul></section>
      <section><small>ECONOMICS</small><ul>${list(brief.economics)}</ul></section>
      <section><small>90-DAY ACTION</small><p>${escape(brief.action90d)}</p></section>
      <section><small>OWNER / KPI</small><p>${escape(brief.owner)}</p><ul>${list(brief.kpis)}</ul></section>
    </div>
  </article>`).join("");
const meceCards = meceAxes.map((axis, index) => `
  <article class="mece-card">
    <span>${String(index + 1).padStart(2, "0")} · ${escape(axis.label)}</span>
    <h3>${escape(axis.owns)}</h3>
    <p><b>BOUNDARY</b> · ${escape(axis.excludes)}</p>
  </article>`).join("");
const claimCards = currentClaims.map((event) => `
  <article class="claim-card ${event.claimType === "verified-fact" ? "is-fact" : "is-estimate"}">
    <header><span>${escape(event.product?.label || "PRODUCT")}</span><b>${escape(event.stage?.id || "MONITORING")}</b></header>
    <h3>${escape(event.entity?.label || "Entity")} · ${escape(event.label || event.eventType)}</h3>
    <p>${escape(event.evidenceSpan)}</p>
    <footer><span>${escape(event.claimType === "verified-fact" ? "OFFICIAL FACT" : "MARKET ESTIMATE")} · ${escape(event.promotionStatus || event.confidence)}</span><a href="${escape(event.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escape(event.source)} · ${escape(date(event.asOf || event.publishedAt))} ↗</a></footer>
  </article>`).join("") || `<article class="claim-card"><h3>ClaimEvent 관측 대기</h3><p>원문 문장·날짜·제품 Stage Gate를 통과한 사건만 이 영역에 게시됩니다.</p></article>`;
const workstreamCards = (organization.workstreams || []).map((item) => `
  <article class="workstream-card">
    <header><span>${escape(item.index)} · ${escape(item.label)}</span><b>${escape(item.index)}</b></header>
    <h3>${escape(item.title)}</h3><p>${escape(item.mandate)}</p>
    ${item.currentSignal ? `<aside class="workstream-signal"><small>LIVE SIGNAL · ${escape(item.currentSignal.evidenceLevel || "WATCH")}</small><strong>${escape(item.currentSignal.title)}</strong><a href="${escape(item.currentSignal.url)}" target="_blank" rel="noopener noreferrer">${escape(item.currentSignal.source || "원문")} · ${escape(date(item.currentSignal.publishedAt))} ↗</a></aside>` : ""}
    <dl><div><dt>INPUT</dt><dd>${escape((item.inputs || []).join(" · "))}</dd></div><div><dt>OUTPUT</dt><dd>${escape((item.outputs || []).join(" · "))}</dd></div><div><dt>GATE</dt><dd>${escape(item.gate)}</dd></div><div><dt>KPI</dt><dd>${escape((item.kpis || []).join(" · "))}</dd></div></dl>
  </article>`).join("");
const projectStrip = projects.map((item, index) => `
  <article class="hero-project">
    <small>${String(index + 1).padStart(2, "0")} · ${escape((item.customers || []).join(" · "))}</small>
    <strong>${escape(item.title)}</strong>
    <span>${escape(item.proposal)}</span>
    <b>90D · ${escape(item.gate90d)}</b>
  </article>`).join("");
const jsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: "AI Infra Decision Intelligence Snapshot",
  dateModified: content.generatedAt,
  description: "검증된 원문에서 구조화한 AI Memory 및 AI Factory 의사결정 Snapshot",
  creator: { "@type": "Person", name: "dicacross", url: "https://www.linkedin.com/in/dicacross/" },
  distribution: { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: "https://dicacros-gif.github.io/memory/data/executive-latest.json" },
}).replace(/</g, "\\u003c");

const html = normalizeHtmlExecutiveCopy(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AI Infra Strategy · Executive Snapshot</title>
  <meta name="description" content="고객 Pain·맞춤형 Memory Strategy·신규 Biz·AI Infra 실행을 검증된 ClaimEvent·Owner·KPI·Kill Criteria로 연결한 경영진 Snapshot" />
  <link rel="canonical" href="https://dicacros-gif.github.io/memory/console/" />
  <meta property="og:title" content="AI Infra Strategy · Executive Snapshot" />
  <meta property="og:description" content="Source → ClaimEvent → Decision → Execution" />
  <meta property="og:url" content="https://dicacros-gif.github.io/memory/console/" />
  <script type="application/ld+json">${jsonLd}</script>
  <style>
    :root{color-scheme:light;--navy:#10263a;--ink:#1d3142;--muted:#586a77;--line:#b8c4cb;--paper:#f4f1e8;--teal:#0e7777;--gold:#bd861d}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:Arial,"Noto Sans KR",sans-serif;line-height:1.55}a{color:inherit}.wrap{width:min(1200px,calc(100% - 32px));margin:auto}.top{padding:18px 0;border-bottom:1px solid var(--line);background:#fff}.top .wrap{display:flex;justify-content:space-between;gap:20px;align-items:center}.brand{font-weight:900;letter-spacing:.04em}.top nav{display:flex;gap:10px}.top nav a{padding:9px 12px;border:1px solid var(--line);text-decoration:none;font-size:12px;font-weight:800}.hero{padding:64px 0 38px}.eyebrow,small{font:800 10px/1.35 ui-monospace,monospace;letter-spacing:.09em;color:var(--teal)}h1{max-width:950px;margin:12px 0 18px;color:var(--navy);font-size:clamp(38px,7vw,82px);line-height:.98;letter-spacing:-.055em}.hero>div>p{max-width:74ch;color:var(--muted);font-size:17px}.hero-projects{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;margin-top:30px;border:1px solid var(--line);background:var(--line)}.hero-project{display:grid;min-width:0;gap:8px;padding:22px;background:#fff}.hero-project strong{color:var(--navy);font-size:18px}.hero-project span{color:var(--muted);font-size:13px}.hero-project b{padding-top:10px;border-top:1px solid #d7dfe3;color:var(--teal);font-size:12px}.section{padding:42px 0}.section-head{display:flex;justify-content:space-between;gap:30px;align-items:end;margin-bottom:18px}.section-head h2{max-width:780px;margin:6px 0 0;color:var(--navy);font-size:clamp(28px,4vw,48px);line-height:1.05}.section-head p{max-width:52ch;margin:0;color:var(--muted)}.workstreams,.claims{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.workstream-card,.claim-card,.decision-card,.mece-card{border:1px solid var(--line);border-top:4px solid var(--teal);background:#fff}.workstream-card{min-width:0;padding:20px}.workstream-card header{display:flex;justify-content:space-between;gap:12px}.workstream-card header span{color:var(--teal);font:800 10px/1.3 ui-monospace,monospace}.workstream-card header b{display:grid;place-items:center;width:38px;height:38px;border-radius:50%;color:#fff;background:var(--teal)}.workstream-card h3{color:var(--navy)}.workstream-card p,.workstream-card dd{color:var(--muted);font-size:12px}.workstream-card dl{display:grid;gap:8px}.workstream-card dl div{padding:10px;background:#f2f5f6}.workstream-card dt{color:var(--teal);font:800 9px/1.3 ui-monospace,monospace}.workstream-card dd{margin:5px 0 0}.mece{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;border-left:1px solid var(--line)}.mece-card{min-width:0;padding:20px;border-left:0}.mece-card span{color:var(--teal);font:800 10px/1.35 ui-monospace,monospace}.mece-card h3{min-height:6.5em;margin:16px 0;color:var(--navy);font-size:16px}.mece-card p{margin:0;padding-top:14px;border-top:1px solid #d7dfe3;color:var(--muted);font-size:12px}.mece-card h3,.mece-card p,.decision-scope,.decision-card footer{overflow-wrap:anywhere;word-break:break-word}.claims{grid-template-columns:repeat(2,minmax(0,1fr))}.claim-card{padding:20px}.claim-card.is-fact{border-top-color:var(--teal)}.claim-card.is-estimate{border-top-color:var(--gold);background:#fffdf7}.claim-card.is-estimate footer>span{color:#765510;text-decoration:underline;text-decoration-color:#e2bd50;text-decoration-thickness:2px;text-underline-offset:3px}.claim-card header,.decision-card>header{display:flex;justify-content:space-between;gap:12px}.claim-card header span,.decision-card>header span,.claim-card header b,.decision-card>header b{font:800 10px/1.3 ui-monospace,monospace}.claim-card header span,.decision-card>header span{color:var(--teal)}.claim-card h3{margin:16px 0 8px;color:var(--navy)}.claim-card p{color:var(--muted)}.claim-card footer,.decision-card footer{display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;margin-top:16px;padding-top:12px;border-top:1px solid #d7dfe3;font-size:11px}.decisions{display:grid;gap:18px}.decision-card{padding:24px}.decision-card h2{max-width:32ch;margin:19px 0 12px;color:var(--navy);font-size:clamp(23px,3vw,37px);line-height:1.16}.decision-scope{display:flex;flex-wrap:wrap;gap:8px 18px;margin-bottom:18px;padding:10px 12px;background:#eef4f3;color:var(--muted);font-size:11px}.decision-scope span{color:var(--teal);font-weight:900;text-transform:uppercase}.decision-scope em{font-style:normal;font-weight:900}.decision-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border:1px solid #d1d9de}.decision-grid section{min-width:0;padding:17px;border-right:1px solid #d1d9de;border-bottom:1px solid #d1d9de}.decision-grid section:nth-child(3n){border-right:0}.decision-grid .is-fact-boundary{background:#eef8f6}.decision-grid .is-hypothesis{background:#f5f1fb;border-top:3px solid #7455a6}.decision-grid p,.decision-grid ul{margin:8px 0 0;color:var(--muted);font-size:13px}.decision-grid ul{padding-left:18px}.gates{display:grid;grid-template-columns:1fr 1fr;margin-top:14px}.gates div{padding:17px;border:1px solid #c9d2d8}.gates div+div{border-left:0}.gates strong{display:block;margin-top:7px;font-size:13px}.gates div:last-child{border-color:#d0b26b;background:#fff9e9}.method{display:grid;grid-template-columns:repeat(5,1fr);padding:0;list-style:none;border:1px solid var(--line);background:#fff}.method li{padding:18px;border-right:1px solid var(--line)}.method li:last-child{border-right:0}.method b{display:block;margin-top:8px;color:var(--navy)}footer.page{padding:28px 0 44px;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}@media(max-width:820px){.hero-projects{grid-template-columns:1fr}.workstreams,.claims,.decision-grid,.method,.mece{grid-template-columns:1fr}.decision-grid section,.method li{border-right:0}.mece-card h3{min-height:0}.gates{grid-template-columns:1fr}.gates div+div{border-left:1px solid #c9d2d8;border-top:0}.section-head{display:grid}.top .wrap{align-items:flex-start;flex-direction:column}}@media(max-width:520px){.top nav{flex-wrap:wrap}h1{font-size:42px}}
    .workstreams{grid-template-columns:repeat(2,minmax(0,1fr))}.workstream-signal{display:grid;gap:6px;margin:14px 0;padding:12px;border:1px solid #b9d7d3;background:#eef8f6}.workstream-signal strong{color:var(--navy);font-size:13px;line-height:1.4}.workstream-signal a{width:fit-content;max-width:100%;color:var(--teal);font-size:11px;font-weight:800;overflow-wrap:anywhere}@media(max-width:820px){.workstreams{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <header class="top"><div class="wrap"><div class="brand">AI INFRA STRATEGY</div><nav><a href="../">Strategy Summary</a><a href="../#console">Explore Console</a></nav></div></header>
  <main>
    <section class="hero"><div class="wrap"><span class="eyebrow">CUSTOMER STRATEGY · NEW BIZ · AI INFRA EXECUTION</span><h1>Customer Pain → Business Option → Execution</h1><p>고객별 Pain을 맞춤형 Memory Solution·신규 Biz·파트너·90일 실행 Gate로 전환</p><div class="hero-projects">${projectStrip}</div></div></section>
    <section class="section"><div class="wrap"><div class="section-head"><div><span class="eyebrow">SK HYNIX AI INFRA · FOUR WORKSTREAMS</span><h2>${escape(organization.title || "SK hynix AI Infra Strategy Operating Model")}</h2></div><p>${escape(organization.thesis || "고객 Pain → 맞춤형 Memory Solution → 신규 Biz·Partner → 경영진 실행 판단")}</p></div><div class="workstreams">${workstreamCards}</div></div></section>
    <section class="section"><div class="wrap"><div class="section-head"><div><span class="eyebrow">MECE DECISION ARCHITECTURE · ONE OWNER PER QUESTION</span><h2>근거는 공유하고, 판단 책임은 네 영역으로 분리</h2></div><p>Tech &amp; Market Signal은 공용 Evidence Base에서 한 번만 관리합니다. 각 의사결정 카드는 고유한 Pain·산출물·경계·Gate를 소유합니다.</p></div><div class="mece">${meceCards}</div></div></section>
    <section class="section"><div class="wrap"><div class="section-head"><div><span class="eyebrow">WHAT CHANGED · STRUCTURED EVENT LEDGER</span><h2>발표와 양산·출하·채택을 같은 말로 보지 않습니다</h2></div><p>Entity·Product·Stage·수치·근거 문장이 원문에서 확인된 사건만 표시하며, 더 높은 Stage가 나오면 이전 Claim을 Superseded로 전환합니다.</p></div><div class="claims">${claimCards}</div></div></section>
    <section class="section"><div class="wrap"><div class="section-head"><div><span class="eyebrow">EXECUTIVE DECISION BRIEFS</span><h2>한 안건에 Pain·선택지·경제성·중단 조건을 연결</h2></div><p>AI는 근거를 구조화하고 가설을 비교합니다. 날짜·수치·제품 Stage·승격 여부는 deterministic Gate가 통제합니다.</p></div><div class="decisions">${decisionCards}</div></div></section>
  </main>
  <footer class="page"><div class="wrap"><a href="https://www.linkedin.com/in/dicacross/" target="_blank" rel="noopener noreferrer">© ${new Date(content.generatedAt).getUTCFullYear()} dicacross · Independent strategy portfolio based on public information; not an official SK hynix website.</a></div></footer>
  <script src="../assets/js/company-profile.min.js?v=${clientRevision}" defer></script>
</body>
</html>\n`);

await mkdir(dirname(executivePath), { recursive: true });
await mkdir(dirname(consolePath), { recursive: true });
const executiveBody = `${JSON.stringify(executive, null, 2)}\n`;
manifest.artifacts = {
  ...(manifest.artifacts || {}),
  executiveSnapshot: { path: "data/executive-latest.json", bytes: Buffer.byteLength(executiveBody, "utf8") },
  consoleSnapshot: { path: "console/index.html", bytes: Buffer.byteLength(html, "utf8") },
};
await Promise.all([
  writeFile(executivePath, executiveBody, "utf8"),
  writeFile(consolePath, html, "utf8"),
  writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
]);

console.log(JSON.stringify({
  ok: true,
  runId: content.runId,
  decisions: briefs.length,
  claimEvents: currentClaims.length,
  executiveBytes: Buffer.byteLength(executiveBody, "utf8"),
  consoleBytes: Buffer.byteLength(html, "utf8"),
}, null, 2));
