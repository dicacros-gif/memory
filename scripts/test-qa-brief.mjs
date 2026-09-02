import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { QA_BRIEF_GUIDES, QA_SOLUTION_OPTIONS, qaEvidenceScore, qaEvidenceIdentity, qaEvidenceTitle, selectQaEvidence } from "../assets/js/qa-brief-model.js";
const app = readFileSync("assets/js/app.js", "utf8");
const html = readFileSync("index.html", "utf8");
const begin = app.indexOf("  const AI_INFRA_QA_PRESETS = Object.freeze([");
const end = app.indexOf("  const CATEGORY_RENDER_BUDGET_MS", begin);
const presets = vm.runInNewContext(app.slice(begin, end) + "\nAI_INFRA_QA_PRESETS");
assert.equal(presets.length, 8);
for (const pair of presets) {
  assert.ok(pair.a.length > 25, `${pair.cat}: actual answer required`);
  for (const key of ["pain","workload","memory","business","action","partner","kill"]) assert.ok(pair.strategy[key], `${pair.cat}:${key}`);
  assert.ok(html.includes(`id="${pair.nav}"`), `invalid navigation ${pair.nav}`);
  assert.ok(QA_BRIEF_GUIDES[pair.cat]);
  assert.doesNotMatch(pair.strategy.kill, /5%|10%|2개/);
}
const extract = name => {const start=app.indexOf(`  function ${name}(`);return app.slice(start, app.indexOf("\n  function ",start+1));};
const context = vm.createContext({QA_BRIEF_GUIDES, QA_SOLUTION_OPTIONS, executiveBulletCopy:v=>v, escapeHTML:v=>String(v??"")});
vm.runInContext(extract("qaStrategyPackHTML"),context);
for(const pair of presets) {
  const rendered=context.qaStrategyPackHTML(pair,pair.q);
  assert.ok(rendered.includes(pair.a));
  assert.ok(rendered.indexOf(pair.a)<rendered.indexOf('class="qa-strategy-flow"'));
  assert.equal((rendered.match(/class="qa-stage-number"/g)||[]).length,5);
  assert.ok(rendered.includes(QA_BRIEF_GUIDES[pair.cat].output));
  assert.ok(!rendered.includes(pair.q), "question is only shown in dialog header");
}
const question={cat:"solution",keywords:["HBM","맞춤형","cxl"]};
const article={title:"Micron announces custom HBM4E architecture",sourceUrl:"https://www.micron.com/about/newsroom/press-releases/hbm4e",date:"2026-08-12"};
assert.ok(qaEvidenceScore(article,question)>0);
for(const [topic,title] of [["dram","Micron DDR5 DRAM production expansion"],["nand","Micron unveils NAND SSD for AI inference"]]) {
  const scoped={...question,liveTopic:topic};
  assert.ok(qaEvidenceScore({...article,title},scoped)>0);
  assert.equal(qaEvidenceScore(article,scoped),0,"live topics cannot borrow unrelated HBM evidence");
}
for(const bad of [
  {...article,title:"채용 | 마이크론 테크놀로지 주식회사",sourceUrl:"https://micron.com/careers",category:"hbm",summary:"Custom HBM CXL"},
  {...article,title:"Micron careers for HBM architecture engineers"},
  {...article,title:"HBM, HBM2란 무엇입니까? 기본 정의"},
  {...article,title:"주간 뉴스 정리: SK hynix HBM 공동 설계"},
  {...article,title:"Company news",category:"hbm",summary:"HBM CXL qualification"},
  {...article,title:"Chinese CXMT DRAM doesn't look like the budget savior many were expecting"},
  {...article,title:"DDR5 DRAM module prices track the big three"},
  {...article,summary:"HBM \uFFFD\uFFFD source extraction",translation:{summary:{status:"verified"}}},
  {...article,language:"japanese",summaryOriginal:"TSMCɒoɒoɒoɒoɒoɒoɒoɒo corrupted source",translation:{summary:{status:"verified"}}},
  {...article,sourceUrl:"javascript:alert(1)"},
  {...article,sourceUrl:"https://news.google.com/articles/123"},
]) assert.equal(qaEvidenceScore(bad,question),0, bad.title);
assert.ok(qaEvidenceScore({...article,title:"New DDR5 RDIMM memory for enterprise servers"},question)>0);
assert.ok(qaEvidenceScore({...article,title:"d-Matrix stacks its AI accelerator on custom DRAM"},question)>0);
assert.equal(qaEvidenceTitle("맞춤형 AI 칩 협력에 성공한 것으로 알려졌습니다_뉴스"),"맞춤형 AI 칩 협력에 성공한 것으로 알려졌음");
assert.equal(qaEvidenceTitle("NVIDIA's HBM architecture"),"NVIDIA's HBM architecture");
assert.equal(selectQaEvidence([article,{...article,sourceUrl:article.sourceUrl+"?utm_source=weekly#top"}],question).length,1);
assert.equal(qaEvidenceIdentity({url:article.sourceUrl}),qaEvidenceIdentity(article));
assert.match(extract("qaRelatedNews"),/isAuthoritativeNews[\s\S]*isNonArticleNewsPage/);
assert.doesNotMatch(extract("qaLiveContextHTML"),/crawledAt|LIVE.updatedAt/);
assert.doesNotMatch(extract("qaIntelligenceBrief"),/intelligenceTopicId/);
assert.match(extract("currentQAData"),/liveIntelligenceBrief\(brief.id\)\?\.latest\?\.url/);
assert.match(extract("currentQAData"),/strategy: template.strategy/);
assert.match(extract("showAnswer"),/aria-labelledby="qaAnswerTitle"/);
assert.match(extract("showAnswer"),/event.key === "Escape"/);
assert.match(extract("answerQuestion"),/selectedQaCategory === "all" \|\| pair.cat === selectedQaCategory/);
console.log("QA brief: 8 complete frames, answer-first, scoped sources, numeric gates and destinations passed");
