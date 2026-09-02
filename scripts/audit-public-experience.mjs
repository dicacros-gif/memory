#!/usr/bin/env node
import assert from "node:assert/strict";
import { startServer, findChrome, launchChrome, connect, SCANNER } from "./audit-contrast.mjs";
import { CONSOLE_ROUTE_IDS, CONSOLE_ROUTE_LANDMARKS } from "./console-route-contract.mjs";

// Real pointer/focus states, without calling the app's contrast repair hook.
// The older stress audit forces every element hovered at once; both are useful.
const quick = process.argv.includes("--quick");
const widths = quick ? [1440] : [1440, 390];
const themes = quick ? ["light"] : ["light", "dark"];
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let server, chrome, session, targetId;
const results = [];
async function until(expression) {
  for (let i = 0; i < 160; i++) {
    if (await session.evaluate(expression)) return;
    await wait(250);
  }
  throw new Error(`render timeout: ${expression}`);
}
const geometry = String.raw`(() => {
  const findings = [];
  const visible = e => e.getClientRects().length && !e.closest('[hidden], [aria-hidden="true"]') && getComputedStyle(e).visibility !== 'hidden';
  if(document.documentElement.scrollWidth > innerWidth + 4) findings.push({kind:'page-overflow', width:innerWidth, actual:document.documentElement.scrollWidth});
  const publicText = document.body.innerText;
  const telemetry = publicText.match(/CURRENT\s*·\s*\d|LAST VERIFIED|DATA CHECK|6시간 주기|TECH SIGNALS|DC SIGNALS|LIVE PLAYERS|COVERAGE GAP|검증 회차|\d+건\s*·\s*(?:현재|마지막) 검증본/g);
  if(telemetry) findings.push({kind:'public-telemetry', text:[...new Set(telemetry)]});
  const priceBadge = document.querySelector('#priceFreshness');
  if(priceBadge && visible(priceBadge) && priceBadge.textContent.trim()) findings.push({kind:'public-refresh-badge',text:priceBadge.textContent});
  for(const e of document.querySelectorAll('h1,h2,h3,h4,p,dd,dt,button,strong,small')) {
    if(!visible(e) || !e.textContent.trim() || e.closest('svg, .sr-only, .visually-hidden'))continue;
    const s=getComputedStyle(e), r=e.getBoundingClientRect();
    if(r.width < 2 || r.height < 2 || s.display==='inline')continue;
    if(/hidden|clip/.test(s.overflowX) && e.scrollWidth > e.clientWidth+3)
      findings.push({kind:'horizontal-clip', selector:e.tagName+'.'+e.className,text:e.textContent.trim().slice(0,90)});
    if(/hidden|clip/.test(s.overflowY) && e.scrollHeight > e.clientHeight+3)
      findings.push({kind:'vertical-clip', selector:e.tagName+'.'+e.className,text:e.textContent.trim().slice(0,90)});
    if(Number(s.opacity) < .05 && !e.matches('button') && !e.closest('.crawl-remove-button')) findings.push({kind:'invisible-copy',text:e.textContent.trim().slice(0,90)});
  }
  return findings;
})()`;
async function snapshot(label, { contrast = true } = {}) {
  const findings = [...await session.evaluate(geometry)];
  if (contrast) findings.push(...(await session.evaluate(SANNER())).map(f => ({ kind: 'contrast', ...f })));
  results.push({ label, findings });
  console.log(JSON.stringify({ label, findings: findings.slice(0, 35), total: findings.length }));
}
// Scope hover measurements to the owning card so every descendant is checked
// on the first paint, without unrelated offscreen content adding audit latency.
function SANNER(selector = "body *") {
  return SCANNER.replace('document.querySelectorAll("body *")', `document.querySelectorAll(${JSON.stringify(selector)})`);
}
async function hoverControls(label) {
  const selectors = await session.evaluate(`(() => {
    const root=document.querySelector('#intelligenceConsole');
    const candidates=[...root.querySelectorAll('button:not(.company-profile-link), article a[href]')].filter(e=>e.getClientRects().length && !e.closest('.sidebar,.topbar,[hidden]'));
    const selected=[], kinds=new Set();
    for(const e of candidates){ const kind=e.className || e.tagName; if(kinds.has(kind))continue; kinds.add(kind); e.dataset.auditControl=String(selected.length); selected.push('[data-audit-control="'+selected.length+'"]'); if(selected.length===4)break; }
    return selected;
  })()`);
  for (const selector of selectors) {
    const point = await session.evaluate(`(() => {const e=document.querySelector(${JSON.stringify(selector)}); e.scrollIntoView({block:'center',behavior:'instant'}); const r=e.getBoundingClientRect(); const owner=e.closest('article')||e; document.querySelectorAll('[data-audit-surface]').forEach(n=>n.removeAttribute('data-audit-surface'));owner.setAttribute('data-audit-surface','');return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    await session.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...point });
    for (const state of ["enter", "settled"]) {
      if (state === "settled") await wait(180);
      const findings = await session.evaluate(SANNER('[data-audit-surface], [data-audit-surface] *'));
      if (findings.length) { results.push({label:`${label}:${selector}:${state}`,findings});console.log(JSON.stringify(results.at(-1))); }
    }
    await session.send("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: 1, ...point });
    const pressed = await session.evaluate(SANNER('[data-audit-surface], [data-audit-surface] *'));
    if (pressed.length) results.push({label:`${label}:pressed`,findings:pressed});
    // Release outside: exercise :active without navigating/submitting.
    await session.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 1, y: 1 });
    await session.send("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: 1, x: 1, y: 1 });
    await session.evaluate(`document.querySelector(${JSON.stringify(selector)})?.focus({preventScroll:true})`);
    const focused = await session.evaluate(SANNER('[data-audit-surface], [data-audit-surface] *'));
    if (focused.length) results.push({label:`${label}:focus`,findings:focused});
  }
}
async function auditQuestionWorkspace(label) {
  await session.evaluate("window.scrollTo(0,0); document.querySelector('#qaToggle').click()");
  await until("document.querySelector('#qaDrop')?.hidden===false && document.querySelectorAll('#qaDrop .qa-option').length>=8");
  await wait(200);
  const check = async (name, selector) => {
    const findings = await session.evaluate(SANNER(selector));
    const overflow = await session.evaluate(`(()=>{const root=document.querySelector(${JSON.stringify(selector.split(',')[0])});return [...root.querySelectorAll('strong,p,small,button,h3,h4')].filter(e=>e.getClientRects().length && e.clientWidth>0 && getComputedStyle(e).display!=='inline' && e.scrollWidth>e.clientWidth+3).map(e=>({kind:'qa-overflow',text:e.textContent.slice(0,70)}));})()`);
    results.push({label:`${label}:${name}`,findings:[...findings,...overflow]});
    console.log(JSON.stringify(results.at(-1)));
  };
  await check('question-library','#qaDrop, #qaDrop *');
  const cards=await session.evaluate("[...document.querySelectorAll('#qaDrop .qa-option')].slice(0,8).map(e=>e.getAttribute('aria-label'))");
  for(const question of cards) {
    await session.evaluate(`document.querySelectorAll('#qaDrop .qa-option').forEach(e=>{if(e.getAttribute('aria-label')===${JSON.stringify(question)})e.click()})`);
    await until("document.querySelector('#qaAnswer')?.hidden===false && document.querySelector('.qa-answer-lead')?.textContent.length>20");
    await wait(100);
    assert.equal(await session.evaluate("document.querySelector('#qaAnswer').innerText.includes('Micron careers')"),false);
    assert.equal(await session.evaluate("[...document.querySelectorAll('.qa-stage-number')].map(e=>e.textContent).join(',')"),'1,2,3,4,5');
    await check(`answer:${question}`,'#qaAnswer, #qaAnswer *');
    if(question.includes('맞춤형')) {
      const point=await session.evaluate("(()=>{const e=document.querySelector('.qa-strategy-flow article'); e.scrollIntoView({block:'center'}); const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
      await session.send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
      await wait(150); await check('answer:hover','#qaAnswer, #qaAnswer *');
      await session.evaluate("document.querySelector('.qa-strategy-stop').scrollIntoView({block:'center'})");
      await check('answer:execution','#qaAnswer, #qaAnswer *');
    }
    await session.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await until("document.querySelector('#qaAnswer')?.hidden===true");
    assert.equal(await session.evaluate("document.body.style.overflow"),'');
    await session.evaluate("document.querySelector('#qaToggle').click()");
  }
  await session.evaluate("document.querySelector('.qa-library-close').click()");
  assert.equal(await session.evaluate("document.body.classList.contains('qa-library-open')"),false);
}
try {
  const started=await startServer(); server=started.server;
  chrome=await launchChrome(findChrome(),"1440x1000");
  ({session,targetId}=await connect(chrome.port,"about:blank"));
  await session.send("Page.enable"); await session.send("Runtime.enable");
  const origin=`http://127.0.0.1:${started.port}`;
  for(const width of widths) {
    await session.send("Emulation.setDeviceMetricsOverride", {width,height:1000,deviceScaleFactor:1,mobile:false});
    await session.send("Page.navigate", {url:origin+'/index.html#console'});
    await until("document.querySelectorAll('.sb-item[data-route]').length===8 && document.querySelectorAll('.is-player').length>0");
    for(const theme of themes) {
      if(await session.evaluate("document.documentElement.dataset.theme")!==theme) await session.evaluate("document.querySelector('#themeBtn').click()");
      await until(`document.documentElement.dataset.theme==='${theme}' && !document.documentElement.classList.contains('ui-theme-switching')`);
      for(let i=0;i<CONSOLE_ROUTE_IDS.length;i++) {
        const route=CONSOLE_ROUTE_IDS[i], landmark=CONSOLE_ROUTE_LANDMARKS[i];
        await session.evaluate(`document.querySelector('.sb-item[data-route="${route}"]').click()`);
        await until(`document.querySelector('#${landmark}')?.getClientRects().length > 0`);
        // Hydrate each actual section of the route, not just its first card.
        await session.evaluate(`(async()=>{for(const e of document.querySelectorAll('#intelligenceConsole .main section[id]')){if(!e.getClientRects().length)continue;e.scrollIntoView({block:'start',behavior:'instant'});await new Promise(r=>setTimeout(r,40));}window.scrollTo(0,0);})()`);
        await session.evaluate("document.fonts.ready.then(()=>true)"); await wait(500);
        const label=`${width}:${theme}:${route}`;
        await snapshot(label);
        if(width===1440) await hoverControls(label);
      }
      await auditQuestionWorkspace(`${width}:${theme}`);
    }
    await session.send("Page.navigate", {url:origin+'/index.html'});
    await until("document.querySelector('.business-hero h2')?.getClientRects().length > 0");
    await session.evaluate(`(async()=>{for(const e of document.querySelectorAll('#businessMain > section')){e.scrollIntoView({behavior:'instant'});await new Promise(r=>setTimeout(r,60));}window.scrollTo(0,0);})()`);
    await wait(800); await snapshot(`${width}:landing`);
  }
  await session.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  const moving=await session.evaluate(`getComputedStyle(document.querySelector('.business-framework-panel dl>div'),'::after').animationName`);
  assert.equal(moving,'none');
  for(const result of results.filter(r=>r.findings.length)) console.error(JSON.stringify({failedState:result.label, findings:result.findings}));
  assert.equal(results.reduce((n,r)=>n+r.findings.length,0),0,'public experience regressions');
  console.log(JSON.stringify({publicExperience:'pass',views:results.length,widths,themes,reducedMotion:true}));
} catch(error) {console.error(error.stack);process.exitCode=1;} finally {
  session?.close();
  if(chrome){try{if(targetId)await fetch(`http://127.0.0.1:${chrome.port}/json/close/${targetId}`,{signal:AbortSignal.timeout(2000)});}catch{} chrome.child.kill();}
  server?.close();server?.closeAllConnections?.();
}
