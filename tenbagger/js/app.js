// Ten-bagger research app shell: four primary sections plus Sources and
// Methods, one global bar (industry chips, market toggle, search, data date),
// and hash routing so every view is shareable and the back button works.
import { loadAll, skeleton, errorBanner } from "./data.js";
import { esc, day } from "./format.js";
import { parseHash, go, companyUrl } from "./state.js";
import { renderIndustries, renderIndustry } from "./industries.js";
import { renderScreener, renderCompare } from "./screener.js";
import { renderStartups, renderStartup, renderHolder } from "./startups.js";
import { renderHistory } from "./history.js";
import { renderSources } from "./sources.js";
import { openPanel } from "./company.js";

const NAV = [["industries", "성장 산업", "1"], ["companies", "상장 기업", "2"], ["startups", "스타트업·투자자", "3"], ["history", "과거 10배 성장 사례", "4"]];
const main = document.getElementById("view");
const bar = document.getElementById("globalBar");

function theme() {
  const saved = (() => { try { return localStorage.getItem("tb-theme"); } catch { return null; } })();
  // Terminal style: dark unless the reader switched to light.
  document.documentElement.dataset.theme = saved || "dark";
  document.getElementById("themeBtn").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("tb-theme", next); } catch { /* private mode */ }
  });
}

function renderBar(data, route) {
  const { companies, industries } = data;
  const p = route.params;
  bar.innerHTML = `<div class="gb-row">
      <div class="gb-chips" role="group" aria-label="산업">${industries.industries.map((i) => `<a class="chip chip-ind ${p.ind === i.id ? "on" : ""}" href="#companies?ind=${esc(i.id)}">${esc(i.name)}</a>`).join("")}</div>
      <div class="gb-market" role="group" aria-label="시장">${[["US,KR", "미국+한국"], ["US", "미국"], ["KR", "한국"], ["all", "전체"]].map(([v, l]) => `<button type="button" class="btn sm ${((p.mkt || "US,KR") === v) ? "on" : ""}" data-mkt="${v}">${l}</button>`).join("")}</div>
      <div class="gb-search"><input type="search" placeholder="기업명·티커 검색" aria-label="기업 검색" list="coList" value="${esc(route.view === "companies" ? p.q || "" : "")}"><datalist id="coList">${companies.companies.map((c) => `<option value="${esc(c.ticker)}">${esc(c.name)}</option>`).join("")}</datalist></div>
      <span class="gb-date" title="재무·가격 수집 ${esc(companies.metricsAt || "")} · 스크리너 ${esc(companies.screenAt || "")}">데이터 ${esc(day(companies.metricsAt) || day(companies.generatedAt) || "—")}</span></div>`;
  bar.querySelectorAll("[data-mkt]").forEach((b) => b.addEventListener("click", () => go("companies", { ...(route.view === "companies" ? p : {}), mkt: b.dataset.mkt === "US,KR" ? null : b.dataset.mkt })));
  const input = bar.querySelector("input[type=search]");
  input.addEventListener("change", () => {
    const v = input.value.trim();
    const hit = companies.companies.find((c) => c.ticker.toLowerCase() === v.toLowerCase() || c.name.toLowerCase() === v.toLowerCase());
    if (hit) openPanel(hit.id, [hit.id]); else go("companies", { ...(route.view === "companies" ? p : {}), q: v || null });
  });
}

async function render() {
  const route = parseHash();
  document.querySelectorAll(".tb-nav a").forEach((a) => a.setAttribute("aria-current", a.dataset.view === route.view ? "page" : "false"));
  skeleton(main, 8);
  const { data, errors } = await loadAll(["companies", "industries", "startups", "history", "status", "changelog", "sources", "digest"]);
  const need = { industries: ["industries", "companies"], companies: ["companies", "industries", "startups"], startups: ["startups", "companies"], history: ["history"], sources: ["status"] }[route.view];
  const missing = errors.filter((e) => need.includes(e.name));
  if (missing.length) { errorBanner(main, missing, render); return; }
  if (data.companies && data.industries) renderBar(data, route);
  const companies = data.companies?.companies || [];
  const ctx = { digest: data.digest || null, companies, industries: data.industries?.industries || [], startups: data.startups?.startups || [], fx: data.companies?.fx, params: route.params };
  if (route.view === "industries") {
    const ind = route.sub && ctx.industries.find((i) => i.id === route.sub);
    if (ind) renderIndustry(main, { industry: ind, companies }); else renderIndustries(main, ctx);
  } else if (route.view === "companies") {
    if (route.sub === "compare") renderCompare(main, ctx); else renderScreener(main, ctx);
  } else if (route.view === "startups") {
    if (route.sub?.startsWith("holder/")) {
      const c = companies.find((x) => x.id === route.sub.slice(7));
      if (c) renderHolder(main, { company: c, startups: ctx.startups }); else renderStartups(main, ctx);
    } else {
      const s = route.sub && ctx.startups.find((x) => x.id === route.sub);
      if (s) renderStartup(main, { startup: s, companies }); else renderStartups(main, ctx);
    }
  } else if (route.view === "history") renderHistory(main, { history: data.history || {} });
  else renderSources(main, { status: data.status, sources: data.sources, changelog: data.changelog, companies });
  // Legacy deep links (#stock=EXCHANGE:CODE) from the landing page.
  const legacy = /^#stock=(.+)$/.exec(location.hash);
  if (legacy) { const t = decodeURIComponent(legacy[1]); const c = companies.find((x) => x.ticker === t); if (c) location.replace(companyUrl(c.id)); }
  main.focus({ preventScroll: true });
}

theme();
document.querySelector(".tb-nav").innerHTML = `${NAV.map(([v, l, k]) => `<a href="#${v}" data-view="${v}"><kbd>${k}</kbd>${l}</a>`).join("")}`;
window.addEventListener("hashchange", render);
window.addEventListener("tb:route", render);
document.addEventListener("keydown", (e) => {
  if (e.target.closest("input,textarea,select") || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "/") { e.preventDefault(); bar.querySelector("input[type=search]")?.focus(); return; }
  // Terminal-style section keys: 1–4 for the sections, 9 for sources and methods.
  const hit = NAV.find(([, , k]) => k === e.key);
  if (hit) go(hit[0]); else if (e.key === "9") go("sources");
});
render();
