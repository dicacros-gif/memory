import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const content=html.split('id="aiTechnologyTrends"')[1]?.split('<div id="industryShift">')[0];
assert.ok(content,'technical layer must live inside the existing industry route');
assert.equal((content.match(/<details /g)||[]).length,4,'four keyboard-accessible technical disclosures');
assert.equal((content.match(/<summary>/g)||[]).length,4);
for(const term of ['GPT-5.6 Sol','Claude Fable 5.1','Gemini 3.8 Flash','Qwen3.8-Flash-Next','ENCODER-ONLY','DECODER-ONLY','ENCODER–DECODER','Dense / MoE','MHA / GQA / MLA','Vector DB','Rerank','Prefill','Decode','Qualification'])assert.ok(content.includes(term),term);
for(const value of ['1,050,000','1,000,000','128,000','1,048,576','65,536','262,144','671B','37B'])assert.ok(content.includes(value),value);
for(const boundary of ['공식 API 문서에 레이어 수','공식 overview에 내부 Transformer','최신 모델 순위가 아님','전체 저장 가중치를 뜻하지 않음','KV cache는 생성 중 attention 상태','비공개 구조에 이 식을 대입','활성 파라미터·KV 구현은 미공개','벡터 DB 외에 키워드 검색'])assert.ok(content.includes(boundary),boundary);
assert.doesNotMatch(content,/GPT-5\.6[^<]{0,60}(?:decoder-only|671B)|Fable 5\.1[^<]{0,60}(?:decoder-only|671B)/i,'no invented proprietary model architecture');
const links=[...content.matchAll(/<a\s+href="([^"]+)"([^>]*)>/g)];
assert.ok(new Set(links.map(m=>m[1])).size>=20,'local claims retain specific primary citations');
for(const [,href,attrs] of links){assert.equal(new URL(href).protocol,'https:');assert.match(attrs,/rel="noopener noreferrer"/);}
const css=readFileSync(new URL('../assets/css/styles.css',import.meta.url),'utf8');
assert.match(css,/container:\s*player-card \/ inline-size/);
assert.match(css,/@container player-card \(max-width: 420px\)/,'card width, not only viewport width, triggers stacked rows');
const audit=readFileSync(new URL('./audit-text-reflow.mjs',import.meta.url),'utf8');
assert.match(audit,/NodeFilter.SHOW_TEXT/);
assert.match(audit,/range.getClientRects\(\)/);
assert.match(audit,/style.clipPath/,'ancestor clipping must be audited');
assert.match(audit,/data-player=\\"broadcom/,'silicon tab is exercised');
console.log(JSON.stringify({aiTechnology:'pass',models:4,topics:4,primarySources:new Set(links.map(m=>m[1])).size,cardReflow:true}));
