#!/usr/bin/env node
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { startServer, findChrome, launchChrome, connect } from './audit-contrast.mjs';
import { CONSOLE_ROUTE_IDS, CONSOLE_ROUTE_LANDMARKS } from './console-route-contract.mjs';

// Text ranges reveal ancestor clipping even when the text element itself has
// overflow:visible. Existing geometry audits only checked its own scroll box.
export const TEXT_REFLOW_SCAN = String.raw`(() => {
  const issues=[], seen=new Set();
  const root=document.querySelector('[data-reflow-root]') || document.body;
  const visible=e=>e && e.getClientRects().length && !e.closest('[hidden],[aria-hidden="true"],.sr-only,.visually-hidden,.site-document-title,.is-exiting,.is-entering,svg,script,style') && getComputedStyle(e).visibility!=='hidden';
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()) {
    const node=walker.currentNode, e=node.parentElement;
    if(!node.textContent.trim() || !visible(e))continue;
    // Collapsed native disclosure content can retain layout boxes in Chromium.
    const closed=e.closest('details:not([open])');
    if(closed && !closed.querySelector(':scope > summary')?.contains(e))continue;
    const range=document.createRange();range.selectNodeContents(node);
    const rects=[...range.getClientRects()].filter(r=>r.width>1 && r.height>1);
    let scrollsX=false, scrollsY=false;
    for(let parent=e;parent && parent!==document.body;parent=parent.parentElement) {
      if(!visible(parent))break;
      const style=getComputedStyle(parent), box=parent.getBoundingClientRect();
      if(Number(style.opacity)<.05)break;
      const cut=style.clipPath!=='none';
      // A reachable scroll axis is exempt, not the entire ancestor chain.
      // Vertical scrolling must not hide horizontal clipping (or vice versa).
      scrollsX ||= /auto|scroll/.test(style.overflowX) && parent.scrollWidth>parent.clientWidth+3;
      scrollsY ||= /auto|scroll/.test(style.overflowY) && parent.scrollHeight>parent.clientHeight+3;
      const xClip=!scrollsX && (cut || /hidden|clip/.test(style.overflowX));
      const yClip=!scrollsY && (cut || /hidden|clip/.test(style.overflowY));
      if(!xClip && !yClip)continue;
      for(const r of rects) {
        if((xClip && (r.left<box.left-3 || r.right>box.right+3)) || (yClip && (r.top<box.top-4 || r.bottom>box.bottom+4))) {
          const item={kind:'ancestor-text-clip',owner:parent.id||parent.className,text:node.textContent.trim().slice(0,95),left:Math.round(r.left-box.left),top:Math.round(r.top-box.top),right:Math.round(r.right-box.right),bottom:Math.round(r.bottom-box.bottom)};
          const key=JSON.stringify(item);if(!seen.has(key)){seen.add(key);issues.push(item);}break;
        }
      }
    }
  }
  // Decorative card boundaries must contain every line, whether clipping is
  // currently enabled or not. This also catches a future overflow:visible patch.
  for(const card of root.querySelectorAll('.is-player, #aiTechnologyTrends article, #aiTechnologyTrends details')) {
    if(!visible(card))continue;
    if(card.matches('details:not([open])'))continue;
    const box=card.getBoundingClientRect(), tw=document.createTreeWalker(card,NodeFilter.SHOW_TEXT);
    while(tw.nextNode()) {
      if(!tw.currentNode.textContent.trim() || !visible(tw.currentNode.parentElement))continue;
      const range=document.createRange();range.selectNodeContents(tw.currentNode);
      for(const r of range.getClientRects())if(r.width>1 && (r.left<box.left-3 || r.right>box.right+3)) {
        issues.push({kind:'card-text-escape',owner:card.className,text:tw.currentNode.textContent.trim().slice(0,95),right:Math.round(r.right-box.right)});break;
      }
    }
  }
  if(document.documentElement.scrollWidth>innerWidth+4)issues.push({kind:'page-overflow',width:innerWidth,actual:document.documentElement.scrollWidth});
  return issues;
})()`;

const quick=process.argv.includes('--quick');
const suppliedWidths=process.argv.find(a=>a.startsWith('--widths='))?.split('=')[1];
const widths=suppliedWidths?suppliedWidths.split(',').map(Number):quick?[540,1024,1440]:[320,360,390,540,768,900,1024,1280,1440,1920,2560];
assert.ok(widths.every(w=>Number.isInteger(w)&&w>=280&&w<=3840),'valid explicit CSS viewport widths');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let server,chrome,session,targetId;
const results=[];
async function until(expression) {
  for(let n=0;n<180;n++){if(await session.evaluate(expression))return;await wait(200);}
  throw new Error('Reflow audit render timeout: '+expression);
}
async function scan(label){
  // Offscreen content-visibility placeholders are deliberately estimated sizes,
  // not the rendered bounds of their retained child layout. Force full layout
  // in this isolated QA browser; keep all actual overflow/clip-path rules intact.
  await session.evaluate(`(async()=>{if(!document.querySelector('#reflow-full-layout')){const s=document.createElement('style');s.id='reflow-full-layout';s.textContent='* { content-visibility: visible !important; }';document.head.append(s);}await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));})()`);
  const findings=await session.evaluate(TEXT_REFLOW_SCAN);results.push({label,findings});console.log(JSON.stringify({label,total:findings.length,findings:findings.slice(0,8)}));
}
try {
  const started=await startServer();server=started.server;
  chrome=await launchChrome(findChrome(),'1440x1000');
  ({session,targetId}=await connect(chrome.port,'about:blank'));
  await session.send('Page.enable');await session.send('Runtime.enable');
  // Prove the scanner distinguishes clipping from reachable scrolling before
  // trusting a zero-finding site run. This fixture lives only in the QA tab.
  await session.evaluate(`document.body.innerHTML='<div id="fixture-mixed" style="width:120px;height:60px;overflow-x:hidden;overflow-y:auto"><div style="height:240px;width:300px;white-space:nowrap">MIXED AXIS MUST DETECT HORIZONTAL CLIPPING</div></div><div id="fixture-scroll" style="width:120px;height:60px;overflow-y:auto"><div style="height:240px;display:flex;align-items:end">Reachable text</div></div><div id="fixture-mixed-x" style="width:120px;height:60px;overflow-x:auto;overflow-y:hidden"><div style="width:400px;height:180px;display:flex;align-items:end">Vertical clipping must remain detected</div></div>'`);
  const fixtureFindings=await session.evaluate(TEXT_REFLOW_SCAN);
  assert.ok(fixtureFindings.some(f=>f.owner==='fixture-mixed'),'mixed-axis clipping must be detected');
  assert.ok(!fixtureFindings.some(f=>f.owner==='fixture-scroll'),'reachable vertical text must remain allowed');
  assert.ok(fixtureFindings.some(f=>f.owner==='fixture-mixed-x'),'horizontal scrolling must not hide vertical clipping');
  for(const width of widths){
    await session.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
    await session.send('Page.navigate',{url:`http://127.0.0.1:${started.port}/index.html#console`});
    await until("document.querySelectorAll('.sb-item[data-route]').length===8 && document.querySelectorAll('.is-player').length>0");
    for(let i=0;i<CONSOLE_ROUTE_IDS.length;i++){
      const route=CONSOLE_ROUTE_IDS[i];
      await session.evaluate(`document.querySelector('.sb-item[data-route="${route}"]').click()`);
      await until(`document.querySelector('#${CONSOLE_ROUTE_LANDMARKS[i]}')?.getClientRects().length>0`);
      await session.evaluate(`(async()=>{for(const e of document.querySelectorAll('#intelligenceConsole .main section[id]')){if(!e.getClientRects().length)continue;e.scrollIntoView({block:'start',behavior:'instant'});await new Promise(r=>setTimeout(r,25));} document.querySelectorAll('#aiTechnologyTrends details').forEach(e=>e.open=true);await document.fonts.ready;})()`);
      await wait(300);await scan(`${width}:${route}`);
      if(route==='signal'){
        await session.evaluate("document.querySelector('[data-industry-tier=\"silicon\"]').click()");
        await until("!!document.querySelector('.is-player[data-player=\"broadcom\"]')");
        await wait(200);await scan(`${width}:silicon`);
        // A real hover must not conceal text. Check the selected card and content.
        const point=await session.evaluate("(()=>{const e=document.querySelector('.is-player[data-player=\"broadcom\"]');e.scrollIntoView({block:'center',behavior:'instant'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:Math.max(2,Math.min(998,r.y+50))};})()");
        await session.send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});await wait(160);await scan(`${width}:broadcom-hover`);
        await session.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});
      }
    }
    if(!quick){
      await session.send('Page.navigate',{url:`http://127.0.0.1:${started.port}/index.html`});
      await until("document.querySelector('.business-hero h2')?.getClientRects().length>0");
      await session.evaluate(`(async()=>{for(const e of document.querySelectorAll('#businessMain > section')){e.scrollIntoView({behavior:'instant'});await new Promise(r=>setTimeout(r,80));}await document.fonts.ready;})()`);
      await wait(600);await scan(`${width}:landing`);
    }
  }
}catch(error){console.error(error.stack);process.exitCode=1;}finally{
  await mkdir(new URL('../.tmp/',import.meta.url),{recursive:true});
  await writeFile(new URL('../.tmp/text-reflow-audit.json',import.meta.url),JSON.stringify({widths,results},null,2));
  session?.close();
  if(chrome){try{if(targetId)await fetch(`http://127.0.0.1:${chrome.port}/json/close/${targetId}`,{signal:AbortSignal.timeout(2000)});}catch{}chrome.child.kill();}
  server?.close();server?.closeAllConnections?.();
}
assert.equal(results.length,widths.length*(quick?10:11),'every requested route/width must complete');
assert.equal(results.reduce((sum,r)=>sum+r.findings.length,0),0,'text reflow regressions; see .tmp/text-reflow-audit.json');
console.log(JSON.stringify({textReflow:'pass',views:results.length,widths}));
