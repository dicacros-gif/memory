#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { formatPublicDate } from "../assets/js/public-copy-policy.js";
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

const readerExecutionCopy = (value = "") => String(value ?? "")
  .replace(/90-Day Roadmap/gi, "Execution Roadmap")
  .replace(/90-Day Gate/gi, "Execution Gate")
  .replace(/90일 실행/g, "단계별 실행")
  .replace(/0[–-]30D/gi, "DIAGNOSE")
  .replace(/31[–-]60D/gi, "PROVE")
  .replace(/61[–-]90D/gi, "COMMIT")
  .replace(/31[–-]90D/gi, "PROVE");
const escape = (value = "") => readerExecutionCopy(value)
  .replace(/솔리드다임/g, "솔리다임")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");
// Reader-facing dates follow the site convention of M/DD; a value that is not a
// real date is dropped rather than printed as a placeholder.
const date = (value = "") => formatPublicDate(value);
const stageLabel = (value = "") => ({
  PLATFORM_ADOPTION: "플랫폼 채택",
  COMMERCIAL_SHIPMENT: "상업 출하",
  MASS_PRODUCTION: "양산",
  QUALIFICATION: "고객 인증",
  SAMPLE: "샘플",
  DESIGN: "공동 설계",
  REQUEST: "요구 확인",
  MONITORING: "관측",
  DISCLOSED: "공개",
}[String(value || "").toUpperCase()] || "단계 확인");
const evidenceLevelLabel = (value = "") => ({
  reported: "보도",
  watch: "관측",
  official: "공식",
  "official baseline": "공식 기준",
}[String(value || "").toLowerCase()] || "관측");
const claimStateLabel = (event = {}) => event.claimType === "verified-fact" ? "공식 확인" : "시장 추정";
const claimSummary = (event = {}) => {
  const rule = String(event.ruleId || "");
  const product = String(event.product?.id || "").toLowerCase();
  if (rule === "hbm4-production-stage" && product === "hbm4e") return "12단 HBM4E 고객 샘플 출하 · 성능·전력 효율 개선 · 양산 일정은 고객 협의 기준";
  if (rule === "hbm4-production-stage") return "HBM4 상업 출하와 생산 확대 단계 확인 · 고객 인증과 실제 공급 물량은 별도 관리";
  if (rule === "competitor-ramp") return "HBM4 수율 개선 보도 · 고객 인증·공급 물량은 공식 발표와 분리";
  if (rule === "capacity-commitment") return "AI Memory 생산 능력 확대 신호 · 투자 계획과 확정 고객 물량은 분리 판단";
  if (rule === "customer-silicon-roadmap" && product === "socamm2") return "192GB SOCAMM2 양산 · Vera Rubin용 고용량·저전력 시스템 메모리 적용";
  if (rule === "customer-silicon-roadmap" && product === "maia") return "Maia 200 추론 가속기 공개 · Memory 공급사·구체 구성은 공식 미공개";
  const span = String(event.evidenceSpan || "").replace(/\s+/g, " ").trim();
  if (/[가-힣]/u.test(span)) return span.slice(0, 240);
  return `${event.entity?.label || "기업"} ${event.product?.label || "제품"} · ${stageLabel(event.stage?.id)} 근거 확인 · 세부 조건은 원문 기준`;
};
const automation = content.decisionIntelligence?.decisionAutomation || {};
const claimLedger = content.decisionIntelligence?.claimEvents || {};
const freshness = content.decisionIntelligence?.freshness || {};
const briefs = automation.briefs || [];
const executiveClaims = (claimLedger.events || []).filter((item) => item.isCurrentStage).slice(0, 8);
const currentClaims = (() => {
  const seen = new Set();
  const issuerCounts = new Map();
  const ranked = (claimLedger.events || [])
    .filter((item) => item.isCurrentStage
      && ["verified-fact", "market-estimate"].includes(item.claimType)
      && item.entity?.id
      && item.product?.id
      && Number.isFinite(Date.parse(item.asOf || item.publishedAt || ""))
      && /^https?:\/\//i.test(String(item.sourceUrl || "")))
    .sort((left, right) => {
      const confidence = Number(right.claimType === "verified-fact") - Number(left.claimType === "verified-fact");
      if (confidence) return confidence;
      return Date.parse(right.asOf || right.publishedAt) - Date.parse(left.asOf || left.publishedAt);
    });
  const selected = [];
  for (const item of ranked) {
    const issuer = String(item.entity.id);
    const key = [issuer, item.product.id, item.stage?.id, item.sourceUrl].join("|");
    if (seen.has(key) || Number(issuerCounts.get(issuer) || 0) >= 2) continue;
    seen.add(key);
    issuerCounts.set(issuer, Number(issuerCounts.get(issuer) || 0) + 1);
    selected.push(item);
    if (selected.length >= 8) break;
  }
  return selected;
})();
const organization = content.organizationOperatingModel || {};
const latestBriefEvidence = (brief = {}) => [...(brief.evidence || [])]
  .sort((a, b) => {
    const time = (item) => {
      const value = Date.parse(item?.publishedAt || item?.asOf || item?.date || "");
      return Number.isFinite(value) ? value : 0;
    };
    return time(b) - time(a);
  })[0] || null;

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
  funnel: automation.funnel || {},
  decisions: briefs.map((brief) => {
    const latestEvidence = latestBriefEvidence(brief);
    return ({
    id: brief.id,
    label: brief.label,
    meceAxis: brief.meceAxis,
    decisionQuestion: brief.decisionQuestion,
    decisionStage: brief.decisionStage,
    deliverable: brief.deliverable,
    status: brief.status,
    whatChanged: brief.whatChanged,
    latestSignal: latestEvidence?.title || brief.latestSignal,
    sourceStage: latestEvidence?.stage || brief.sourceStage,
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
    evidence: [...(brief.evidence || [])]
      .sort((a, b) => Date.parse(b.publishedAt || b.asOf || 0) - Date.parse(a.publishedAt || a.asOf || 0))
      .slice(0, 5),
    });
  }),
  organizationOperatingModel: organization,
  claimEvents: executiveClaims,
  policy: "Deterministic source/date/stage gates; no uncited generated claim is published.",
};

const investorChecks = [
  {
    label: "CYCLE",
    question: "가격·재고·가동률은 업황의 어느 구간을 가리키는가",
    boundary: "Spot·Contract 가격과 기업 가이던스를 분리 · 확인되지 않은 물량은 실적에 반영하지 않음",
    interpretation: "가격 상승이 출하 증가와 함께 나타나는지 확인 · 재고 조정만으로 발생한 단기 반등은 구분",
    options: "회복 초기 · 공급 제약 · 피크아웃",
    metrics: "DRAM·NAND 가격 · 재고일수 · 가동률 · CapEx",
    action: "가격·재고·공급 지표가 같은 방향으로 전환될 때만 사이클 판단 강도를 높임",
  },
  {
    label: "EARNINGS",
    question: "AI 수요와 제품 믹스가 어느 기업의 매출·마진으로 먼저 전이되는가",
    boundary: "고객 발표·샘플·인증·양산·매출 인식을 서로 다른 단계로 관리",
    interpretation: "HBM·서버 DRAM·eSSD·패키징 병목의 가격 결정력과 증분 마진을 기업별로 비교",
    options: "선행 수혜 · 동행 수혜 · 후행 수혜",
    metrics: "출하량 · ASP · 제품 믹스 · 매출총이익률 · 현금흐름",
    action: "제품 단계와 실적 기여 시점을 연결하고, 공급사·고객사 가이던스가 교차 확인될 때 반영",
  },
  {
    label: "VALUATION & RISK",
    question: "좋은 산업 전망이 이미 주가에 반영됐는가",
    boundary: "주가 성과와 산업 전망을 동일시하지 않음 · 통화와 거래시장이 다른 종목은 기준을 분리",
    interpretation: "실적 상향 폭과 밸류에이션 확장 폭을 나누고, 공급 과잉·수요 둔화·기술 지연을 반증 조건으로 기록",
    options: "기대 미반영 · 적정 반영 · 과도한 선반영",
    metrics: "Forward EPS · P/B · EV/EBITDA · 환율 · 정책 리스크",
    action: "Base·Bull·Bear 조건과 논지 폐기 기준을 먼저 정한 뒤 종목 간 보상 대비 위험을 비교",
  },
  {
    label: "PORTFOLIO",
    question: "같은 메모리 사이클 노출을 중복 보유하고 있지 않은가",
    boundary: "종목 수가 아니라 매출원·고객·제품·통화·정책 민감도의 실제 중복도를 확인",
    interpretation: "설계·장비·메모리·패키징·네트워크·시스템 중 서로 다른 이익 전이 구간을 조합",
    options: "집중 · 단계 분산 · 현금 대기",
    metrics: "상관관계 · 실적 민감도 · 환율 · 유동성 · 이벤트 일정",
    action: "단일 고객·제품·국가 충격이 전체 논지를 동시에 훼손하지 않도록 반증 조건과 노출을 함께 점검",
  },
];
const decisionCards = investorChecks.map((item, index) => `
  <article class="decision-card">
    <header><span>${String(index + 1)} · ${escape(item.label)}</span><b>INVESTOR CHECK</b></header>
    <h2>${escape(item.question)}</h2>
    <div class="decision-scope"><span>RESEARCH GATE</span><strong>FACT / INTERPRETATION / RISK</strong><em>투자 권유 아님</em></div>
    <div class="decision-grid">
      <section class="is-fact-boundary"><small>FACT BOUNDARY</small><p>${escape(item.boundary)}</p></section>
      <section class="is-hypothesis"><small>INVESTMENT READ</small><p>${escape(item.interpretation)}</p></section>
      <section><small>SCENARIOS</small><p>${escape(item.options)}</p></section>
      <section><small>CHECK METRICS</small><p>${escape(item.metrics)}</p></section>
      <section><small>NEXT CHECK</small><p>${escape(item.action)}</p></section>
    </div>
  </article>`).join("");
const investorResearchGates = [
  ["시장 사이클", "가격·재고·가동률·CapEx", "단일 가격 신호만으로 방향을 확정하지 않음"],
  ["수요 전이", "AI CapEx·서버 출하·제품 채택", "발표와 실제 출하·매출 인식을 구분"],
  ["기업 실적", "ASP·제품 믹스·마진·현금흐름", "산업 성장률을 기업 성장률로 그대로 대입하지 않음"],
  ["가치와 위험", "밸류에이션·환율·정책·반증 조건", "목표가격보다 논지 폐기 기준을 먼저 확인"],
];
const meceCards = investorResearchGates.map((axis, index) => `
  <article class="mece-card">
    <span>${String(index + 1)} · ${escape(axis[0])}</span>
    <h3>${escape(axis[1])}</h3>
    <p><b>BOUNDARY</b> · ${escape(axis[2])}</p>
  </article>`).join("");
const claimCards = currentClaims.map((event) => `
  <article class="claim-card ${event.claimType === "verified-fact" ? "is-fact" : "is-estimate"}">
    <header><span>${escape(event.product?.label || "제품")}</span><b>${escape(stageLabel(event.stage?.id))}</b></header>
    <h3>${escape(event.entity?.label || "Entity")} · ${escape(event.label || event.eventType)}</h3>
    <p>${escape(claimSummary(event))}</p>
    <footer><span>${escape(claimStateLabel(event))}</span><a href="${escape(event.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escape(event.source)} · ${escape(date(event.asOf || event.publishedAt))}</a></footer>
  </article>`).join("");
const investorLenses = [
  ["CYCLE & PRICING", "메모리 업황", "DRAM·NAND Spot/Contract 가격과 재고·가동률·CapEx를 함께 읽어 사이클 위치를 판단", "가격 · 재고 · 공급", "회복·공급 제약·피크아웃 구분", "지표 간 방향 일치", "사이클 오판 최소화"],
  ["AI DEMAND", "수요와 병목", "Hyperscaler CapEx·가속기 출하·서버 구성 변화가 HBM·DRAM·NAND 수요로 전이되는 경로를 추적", "AI CapEx · 서버 · 전력", "병목 위치와 수혜 시차 확인", "발표→채택→매출 단계 검증", "실적 전환 시점"],
  ["EQUITY READ-THROUGH", "종목과 밸류체인", "미국·한국·중국·일본 상장사를 설계·장비·메모리·패키징·네트워크·시스템 단계로 비교", "공시 · 실적 · 주가", "물량·가격·마진 전이 확인", "촉매·위험·반증 조건 기록", "보상 대비 위험"],
];
const workstreamCards = investorLenses.map((item) => `
  <article class="workstream-card">
    <header><span>${escape(item[0])}</span></header>
    <h3>${escape(item[1])}</h3><p>${escape(item[2])}</p>
    <aside class="workstream-signal"><small>INVESTOR RULE</small><strong>${escape(item[5])}</strong></aside>
    <dl><div><dt>INPUT</dt><dd>${escape(item[3])}</dd></div><div><dt>QUESTION</dt><dd>${escape(item[4])}</dd></div><div><dt>GATE</dt><dd>${escape(item[5])}</dd></div><div><dt>OUTPUT</dt><dd>${escape(item[6])}</dd></div></dl>
  </article>`).join("");
const investorMarkets = [
  ["UNITED STATES", "미국 상장", "AI 가속기·EDA/IP·장비·네트워크·전력·냉각", "NASDAQ · NYSE · ADR"],
  ["KOREA", "한국 KRX", "HBM·DRAM·NAND·소재·장비", "KRX · 통화 KRW"],
  ["CHINA", "중국 본토", "메모리·장비 국산화·파운드리·패키징", "SSE · STAR · SZSE"],
  ["JAPAN", "일본 TSE", "NAND·웨이퍼 소재·전공정 장비·테스트", "TSE · 통화 JPY"],
];
const projectStrip = investorMarkets.map((item, index) => `
  <article class="hero-project">
    <small>${String(index + 1)} · ${escape(item[0])}</small>
    <strong>${escape(item[1])}</strong>
    <span>${escape(item[2])}</span>
    <b>LISTING BASIS · ${escape(item[3])}</b>
  </article>`).join("");
const jsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: "Global Memory Equity Intelligence Snapshot",
  dateModified: content.generatedAt,
  description: "공개 원문에서 구조화한 글로벌 반도체·메모리 투자 리서치 Snapshot",
  creator: { "@type": "Person", name: "dicacross", url: "https://www.linkedin.com/in/dicacross/" },
  distribution: { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: "https://dicacros-gif.github.io/memory/data/executive-latest.json" },
}).replace(/</g, "\\u003c");

const normalizeConsoleTaxonomy = (value) => String(value || "")
  .replaceAll("Custom HBM·AI-D·AI-N", "Custom HBM·Server DRAM/CXL·AI-NAND/eSSD")
  .replaceAll("HBM·AI-D·AI-N", "HBM·Server DRAM/CXL·AI-NAND/eSSD")
  .replaceAll("AI-D·AI-N/HBF", "Server DRAM/CXL·AI-NAND/eSSD·HBF")
  .replaceAll("Custom HBM · AI-D · AI-N", "Custom HBM · Server DRAM/CXL · AI-NAND/eSSD")
  .replace(/\bAI-D\b/g, "AI-DRAM")
  .replace(/\bAI-N\b/g, "AI-NAND")
  .replaceAll("Roboto,Roboto", "Roboto,Helvetica");

const html = normalizeConsoleTaxonomy(normalizeHtmlExecutiveCopy(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Memory Equity Intelligence · Investor Snapshot</title>
  <meta name="description" content="AI 수요·메모리 사이클·밸류체인·실적·밸류에이션 근거를 비교하는 개인투자자용 Snapshot" />
  <link rel="canonical" href="https://dicacros-gif.github.io/memory/console/" />
  <meta property="og:title" content="Memory Equity Intelligence · Investor Snapshot" />
  <meta property="og:description" content="Public Source → Verified Signal → Earnings Driver → Investor Watchpoint" />
  <meta property="og:url" content="https://dicacros-gif.github.io/memory/console/" />
  <script type="application/ld+json">${jsonLd}</script>
  <style>
    :root{color-scheme:light;--navy:#0f2638;--ink:#1d3141;--muted:#586a77;--line:#b8c4cb;--paper:#f2f5f6;--teal:#157771;--blue:#3c7199;--violet:#3e7096;--gold:#b08b45}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:Pretendard,"Noto Sans KR",Roboto,Helvetica;line-height:1.55;letter-spacing:-.01em}a{color:inherit}.wrap{width:min(1200px,calc(100% - 32px));margin:auto}.top{padding:18px 0;border-bottom:1px solid var(--line);background:#fff}.top .wrap{display:flex;justify-content:space-between;gap:20px;align-items:center}.brand{font-weight:900;letter-spacing:.04em}.top nav{display:flex;gap:10px}.top nav a{padding:9px 12px;border:1px solid var(--line);text-decoration:none;font-size:12px;font-weight:800}.hero{padding:64px 0 38px}.eyebrow,small{font:800 10px/1.35 Poppins,Pretendard;letter-spacing:.09em;color:var(--teal)}h1{max-width:950px;margin:12px 0 18px;color:var(--navy);font-size:clamp(38px,7vw,82px);line-height:.98;letter-spacing:-.055em}.hero>div>p{max-width:74ch;color:var(--muted);font-size:17px}.hero-projects{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;margin-top:30px;border:1px solid var(--line);background:var(--line)}.hero-project{display:grid;min-width:0;gap:8px;padding:22px;background:#fff}.hero-project strong{color:var(--navy);font-size:18px}.hero-project span{color:var(--muted);font-size:13px}.hero-project b{padding-top:10px;border-top:1px solid #d7dfe3;color:var(--teal);font-size:12px}.section{padding:42px 0}.section-head{display:flex;justify-content:space-between;gap:30px;align-items:end;margin-bottom:18px}.section-head h2{max-width:780px;margin:6px 0 0;color:var(--navy);font-size:clamp(28px,4vw,48px);line-height:1.05}.section-head p{max-width:52ch;margin:0;color:var(--muted)}.workstreams,.claims{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.workstream-card,.claim-card,.decision-card,.mece-card{border:1px solid var(--line);border-top:4px solid var(--teal);background:#fff;clip-path:polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,0 100%)}.workstream-card{min-width:0;padding:20px}.workstream-card header{display:flex;justify-content:space-between;gap:12px}.workstream-card header span{color:var(--teal);font:800 10px/1.3 Poppins,Pretendard}.workstream-card header b{display:grid;place-items:center;width:38px;height:38px;color:#fff;background:var(--teal)}.workstream-card h3{color:var(--navy)}.workstream-card p,.workstream-card dd{color:var(--muted);font-size:12px}.workstream-card dl{display:grid;gap:8px}.workstream-card dl div{padding:10px;background:#f2f5f6}.workstream-card dt{color:var(--teal);font:800 9px/1.3 Poppins,Pretendard}.workstream-card dd{margin:5px 0 0}.consulting-flow{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;margin:24px 0 0;padding:0;list-style:none}.consulting-flow li{min-width:0;padding:20px 24px;border-top:4px solid var(--teal);background:#fff;clip-path:polygon(0 0,calc(100% - 18px) 0,100% 50%,calc(100% - 18px) 100%,0 100%,14px 50%)}.consulting-flow li:first-child{clip-path:polygon(0 0,calc(100% - 18px) 0,100% 50%,calc(100% - 18px) 100%,0 100%)}.consulting-flow li:nth-child(2){border-color:var(--blue)}.consulting-flow li:nth-child(3){border-color:var(--violet)}.consulting-flow li:nth-child(4){border-color:var(--gold)}.consulting-flow strong{display:block;margin:8px 0 5px;color:var(--navy)}.consulting-flow span{color:var(--muted);font-size:11px}.mece{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;border-left:1px solid var(--line)}.mece-card{min-width:0;padding:20px;border-left:0}.mece-card span{color:var(--teal);font:800 10px/1.35 Poppins,Pretendard}.mece-card h3{min-height:6.5em;margin:16px 0;color:var(--navy);font-size:16px}.mece-card p{margin:0;padding-top:14px;border-top:1px solid #d7dfe3;color:var(--muted);font-size:12px}.mece-card h3,.mece-card p,.decision-scope,.decision-card footer{overflow-wrap:anywhere;word-break:break-word}.claims{grid-template-columns:repeat(2,minmax(0,1fr))}.claim-card{padding:20px}.claim-card.is-fact{border-top-color:var(--teal)}.claim-card.is-estimate{border-top-color:var(--gold);background:#fffdf7}.claim-card.is-estimate footer>span{color:#765415;text-decoration:underline;text-decoration-color:#cbbea7;text-decoration-thickness:2px;text-underline-offset:3px}.claim-card header,.decision-card>header{display:flex;justify-content:space-between;gap:12px}.claim-card header span,.decision-card>header span,.claim-card header b,.decision-card>header b{font:800 10px/1.3 Poppins,Pretendard}.claim-card header span,.decision-card>header span{color:var(--teal)}.claim-card h3{margin:16px 0 8px;color:var(--navy)}.claim-card p{color:var(--muted)}.claim-card footer,.decision-card footer{display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;margin-top:16px;padding-top:12px;border-top:1px solid #d7dfe3;font-size:11px}.decisions{display:grid;gap:18px}.decision-card{padding:24px}.decision-card h2{max-width:32ch;margin:19px 0 12px;color:var(--navy);font-size:clamp(23px,3vw,37px);line-height:1.16}.decision-scope{display:flex;flex-wrap:wrap;gap:8px 18px;margin-bottom:18px;padding:10px 12px;background:#eef4f3;color:var(--muted);font-size:11px}.decision-scope span{color:var(--teal);font-weight:900;text-transform:uppercase}.decision-scope em{font-style:normal;font-weight:900}.decision-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border:1px solid #d1d9de}.decision-grid section{min-width:0;padding:17px;border-right:1px solid #d1d9de;border-bottom:1px solid #d1d9de}.decision-grid section:nth-child(3n){border-right:0}.decision-grid .is-fact-boundary{background:#eef8f6}.decision-grid .is-hypothesis{background:#f1f7fb;border-top:3px solid #446985}.decision-grid p,.decision-grid ul{margin:8px 0 0;color:var(--muted);font-size:13px}.decision-grid ul{padding-left:18px}.gates{display:grid;grid-template-columns:1fr 1fr;margin-top:14px}.gates div{padding:17px;border:1px solid #c9d2d8}.gates div+div{border-left:0}.gates strong{display:block;margin-top:7px;font-size:13px}.gates div:last-child{border-color:#c7b38d;background:#fff9e9}.method{display:grid;grid-template-columns:repeat(5,1fr);padding:0;list-style:none;border:1px solid var(--line);background:#fff}.method li{padding:18px;border-right:1px solid var(--line)}.method li:last-child{border-right:0}.method b{display:block;margin-top:8px;color:var(--navy)}footer.page{padding:28px 0 44px;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}@media(max-width:820px){.hero-projects,.workstreams,.claims,.decision-grid,.method,.mece,.consulting-flow{grid-template-columns:1fr}.consulting-flow li,.consulting-flow li:first-child{clip-path:polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,0 100%)}.decision-grid section,.method li{border-right:0}.mece-card h3{min-height:0}.gates{grid-template-columns:1fr}.gates div+div{border-left:1px solid #c9d2d8;border-top:0}.section-head{display:grid}.top .wrap{align-items:flex-start;flex-direction:column}}@media(max-width:520px){.top nav{flex-wrap:wrap}h1{font-size:42px}}
    .workstreams{grid-template-columns:repeat(3,minmax(0,1fr))}.workstream-signal{display:grid;gap:6px;margin:14px 0;padding:12px;border:1px solid #bed6d6;background:#eef8f6}.workstream-signal strong{color:var(--navy);font-size:13px;line-height:1.4}.workstream-signal a{width:fit-content;max-width:100%;color:var(--teal);font-size:11px;font-weight:800;overflow-wrap:anywhere}@media(max-width:820px){.workstreams{grid-template-columns:1fr}}
  </style>
  <link rel="stylesheet" href="../assets/css/brand-system.min.css?v=${clientRevision}" />
  <script>
    (() => {
      const approvedFaces = [
        { marker: "pretendard", href: "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css" },
        { marker: "poppins", href: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" },
      ];
      const load = () => approvedFaces.forEach((face) => {
        if (document.querySelector('link[data-approved-face="' + face.marker + '"]')) return;
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = face.href;
        link.dataset.approvedFace = face.marker;
        document.head.appendChild(link);
      });
      if ("requestIdleCallback" in window) window.requestIdleCallback(load, { timeout: 900 });
      else window.setTimeout(load, 60);
    })();
  </script>
</head>
<body class="console-static-mode">
  <header class="top"><div class="wrap"><div class="brand">MEMORY EQUITY INTELLIGENCE</div><nav><a href="../">투자 리서치 홈</a><a href="../#console/investor-overview">투자 대시보드</a></nav></div></header>
  <main>
    <section class="hero"><div class="wrap"><span class="eyebrow">GLOBAL MEMORY EQUITY · PUBLIC-EVIDENCE SNAPSHOT</span><h1>AI·메모리 사이클 → 밸류체인 → 종목 판단</h1><p>AI CapEx와 메모리 가격·공급·기술 전환이 미국·한국·중국·일본 상장사의 출하·매출·마진·밸류에이션으로 이어지는 경로를 공개 근거로 점검</p><ol class="consulting-flow"><li><small>01 · DEMAND</small><strong>최종 수요</strong><span>AI CapEx · 서버 · 디바이스</span></li><li><small>02 · SUPPLY</small><strong>공급과 병목</strong><span>Wafer · Yield · Package · Power</span></li><li><small>03 · PRICE / MIX</small><strong>가격과 제품 믹스</strong><span>Spot · Contract · HBM · DRAM · NAND</span></li><li><small>04 · EARNINGS</small><strong>실적 전이</strong><span>출하 · ASP · Margin · Cash Flow</span></li><li><small>05 · THESIS</small><strong>가치와 위험</strong><span>Valuation · Catalyst · Invalidation</span></li></ol><div class="hero-projects">${projectStrip}</div></div></section>
    <section class="section"><div class="wrap"><div class="section-head"><div><span class="eyebrow">INVESTMENT RESEARCH LENSES</span><h2>산업 성장과 종목 수익률 사이의 전이 경로를 분리</h2></div><p>수요·공급·가격·제품 단계·실적·밸류에이션을 한 번에 비교하되, 사실과 해석 및 위험 조건을 섞지 않습니다.</p></div><div class="workstreams">${workstreamCards}</div></div></section>
    <section class="section"><div class="wrap"><div class="section-head"><div><span class="eyebrow">FOUR RESEARCH GATES · NO SINGLE-SIGNAL CONCLUSION</span><h2>같은 뉴스도 사이클·실적·가격 반영도를 따로 확인</h2></div><p>공식 원문과 관측값을 공용 Evidence Base에서 관리하고, 확인되지 않은 수치와 전망은 기업 실적에 반영하지 않습니다.</p></div><div class="mece">${meceCards}</div></div></section>
    <section class="section"><div class="wrap"><div class="section-head"><div><span class="eyebrow">VERIFIED PUBLIC SIGNALS · STRUCTURED EVENT LEDGER</span><h2>발표·샘플·인증·양산·출하·매출을 서로 다른 단계로 구분</h2></div><p>원문을 Entity·Product·Stage·수치 단위의 ClaimEvent로 구조화 · 보도와 공식 확인을 분리</p></div><div class="claims">${claimCards}</div></div></section>
    <section class="section"><div class="wrap"><div class="section-head"><div><span class="eyebrow">INVESTOR THESIS CHECKLIST</span><h2>촉매보다 먼저 사실 경계와 논지 폐기 조건을 확인</h2></div><p>가격·제품·실적·주가를 연결하되, 각 단계가 교차 검증되기 전에는 결론 강도를 높이지 않습니다.</p></div><div class="decisions">${decisionCards}</div></div></section>
  </main>
  <footer class="page"><div class="wrap"><a href="https://www.linkedin.com/in/dicacross/" target="_blank" rel="noopener noreferrer">© ${new Date(content.generatedAt).getUTCFullYear()} dicacross · 공개 정보 기반 개인 투자 리서치 · 특정 종목 추천 또는 매매 권유가 아닙니다.</a></div></footer>
</body>
</html>\n`));

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
