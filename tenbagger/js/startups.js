// Startups and Investors: each startup's profile with the ownership map
// listed company → investing vehicle → startup, percentage and amount kept
// apart, and the reverse view from a listed company to its startup stakes.
import { esc, isNum, money, UNDISCLOSED, NO_DATA, srcBtn, day } from "./format.js";
import { go, companyUrl } from "./state.js";
import { openPanel } from "./company.js";

const ENTITY = { startup: "스타트업", subsidiary: "비상장 자회사", acquired: "피인수", listed: "상장 완료", "ipo-filed": "상장 신청", delisted: "상장폐지" };
const STATUS = { completed: "완료", pending: "진행·미확정", historical: "과거 지분" };
const SRC = { filing: "공시", company: "회사 발표", press: "보도" };

function relRow(r, companies) {
  const listed = r.listedIds.map((id) => companies.get(id)).filter(Boolean);
  const holder = listed.length ? listed.map((c) => `<a href="${companyUrl(c.id)}" data-open="${esc(c.id)}">${esc(c.name)}</a> <span class="sub">${esc(c.ticker)}</span>`).join("<br>") : `${esc(r.parent)} <span class="sub">${esc(r.tickers.join(", "))}</span>`;
  return `<tr class="${r.status === "historical" ? "past" : ""}"><td class="first">${holder}</td><td>${esc(r.vehicle || "직접")}</td>
    <td class="r">${isNum(r.pctOwned) ? `<b>${r.pctOwned}%</b>` : UNDISCLOSED}</td><td class="r">${isNum(r.amountUsd) ? money(r.amountUsd) : UNDISCLOSED}</td>
    <td>${r.holding === "indirect" ? "간접" : "직접"}</td><td>${esc(r.basis === "not stated" ? "기준 미기재" : r.basis)}</td>
    <td>${esc(r.measuredAt || "")}${r.predatesLatestRound ? ' <span class="chip chip-warn" title="이후 투자 라운드로 희석됐을 수 있음">이후 라운드 전</span>' : ""}</td>
    <td>${esc(STATUS[r.status] || r.status)}</td><td>${srcBtn(r.source.url, SRC[r.source.type] || "출처")}</td>
    <td class="r">${r.exposure ? `<span title="${esc(r.exposure.basis)}">${r.exposure.pctOfHolderCap}% <span class="chip chip-est">추정</span></span>` : NO_DATA}</td></tr>`;
}

export function renderStartups(root, { startups, companies, params }) {
  const byId = new Map(companies.map((c) => [c.id, c]));
  const q = (params.q || "").toLowerCase();
  const list = startups.filter((s) => (!params.ind || s.industry === params.ind) && (!q || s.name.toLowerCase().includes(q)));
  const holders = companies.filter((c) => c.holdings?.length).sort((a, b) => a.name.localeCompare(b.name));
  root.innerHTML = `<section class="view-head"><h1>스타트업과 상장 투자자</h1>
    <p class="lede">비상장 기업과 그 지분을 가진 상장사를 연결합니다. 지분율과 투자 금액은 따로 표시하며, 지분율은 공개된 경우에만 적습니다(금액·기업가치로 역산하지 않음).</p>
    <label class="inline">상장사 기준으로 보기 <select data-holder><option value="">상장사 선택…</option>${holders.map((c) => `<option value="${esc(c.id)}">${esc(c.name)} (${c.holdings.length})</option>`).join("")}</select></label></section>
    <div class="st-grid">${list.map((s) => `<article class="st-card" tabindex="0" data-st="${esc(s.id)}">
      <h2>${esc(s.name)} <span class="chip">${esc(ENTITY[s.entityType] || s.entityType)}</span></h2>
      <p class="sub">${esc(s.industryName)} · ${esc(s.country || "")}</p><p>${esc(s.what || "")}</p>
      <p class="sub">최근 기업가치 ${s.financing.length ? money(s.financing.at(-1).valuationUsd) : NO_DATA}${s.financing.at(-1)?.date ? ` · ${esc(s.financing.at(-1).date)}` : ""}</p>
      <p class="sub">상장 투자자 ${s.current.length}곳 · 지분율 공개 ${s.disclosedCount}곳</p></article>`).join("")}</div>`;
  root.querySelector("[data-holder]").addEventListener("change", (e) => e.target.value && go("startups", {}, `holder/${e.target.value}`));
  root.querySelectorAll("[data-st]").forEach((el) => {
    const open = () => go("startups", {}, el.dataset.st);
    el.addEventListener("click", open);
    el.addEventListener("keydown", (e) => { if (e.key === "Enter") open(); });
  });
}

export function renderStartup(root, { startup: s, companies }) {
  const byId = new Map(companies.map((c) => [c.id, c]));
  const current = s.relationships.filter((r) => r.status !== "historical");
  const past = s.relationships.filter((r) => r.status === "historical");
  const head = `<tr><th class="first">상장사</th><th>투자 주체</th><th class="r">지분율</th><th class="r">투자 금액</th><th>보유</th><th>지분 기준</th><th>측정일</th><th>상태</th><th>근거</th><th class="r">보유사 시총 대비</th></tr>`;
  const map = current.map((r) => {
    const c = r.listedIds.map((id) => byId.get(id)).find(Boolean);
    return `<li class="own-path"><span class="node listed">${c ? `<a href="${companyUrl(c.id)}" data-open="${esc(c.id)}">${esc(c.name)}</a>` : esc(r.parent)}</span><span class="edge">→</span>${r.vehicle ? `<span class="node vehicle">${esc(r.vehicle)}</span><span class="edge">→</span>` : ""}<span class="node startup">${esc(s.name)}</span><span class="edge-label">${isNum(r.pctOwned) ? `${r.pctOwned}%` : "지분율 미공개"}</span></li>`;
  }).join("");
  root.innerHTML = `<section class="view-head"><p><a href="#startups">← 스타트업 목록</a></p><h1>${esc(s.name)} <span class="chip">${esc(ENTITY[s.entityType] || s.entityType)}</span></h1>
      <p class="lede">${esc(s.what || "")}</p><p class="sub">${esc(s.industryName)} · ${esc(s.country || "")}${s.stage ? ` · 단계: ${esc(s.stage)}` : ""}</p></section>
    <section><h2>자금 조달</h2>${s.financing.length ? `<ul>${s.financing.map((f) => `<li>${esc(f.date || "날짜 없음")} · ${esc(f.label || "")} ${money(f.valuationUsd)} ${srcBtn(f.url, "원문")}</li>`).join("")}</ul>` : `<p>${NO_DATA}</p>`}
      <p class="sub">누적 조달액 ${isNum(s.totalRaisedUsd) ? money(s.totalRaisedUsd) : NO_DATA}</p>
      ${s.milestones.length ? `<h3>상업화 이정표</h3><ul>${s.milestones.map((m) => `<li>${esc(m.date || "")} ${esc(m.text || m)} ${srcBtn(m.url, "원문")}</li>`).join("")}</ul>` : ""}</section>
    <section><h2>지분 구조</h2><ul class="own-map">${map || '<li class="muted">현재 지분 관계 자료 없음</li>'}</ul>
      <div class="tbl-wrap"><table class="grid"><thead>${head}</thead><tbody>${current.map((r) => relRow(r, byId)).join("")}</tbody></table></div>
      <p class="muted">보유사 시총 대비 = 지분율 × 최근 비상장 기업가치 ÷ 보유사 시가총액(추정). 지분율이 없으면 계산하지 않습니다.</p>
      ${past.length ? `<details><summary>과거 지분 ${past.length}건 (현재 노출에서 제외)</summary><div class="tbl-wrap"><table class="grid"><thead>${head}</thead><tbody>${past.map((r) => relRow(r, byId)).join("")}</tbody></table></div></details>` : ""}</section>`;
  const order = [...root.querySelectorAll("[data-open]")].map((a) => a.dataset.open);
  root.querySelectorAll("[data-open]").forEach((a) => a.addEventListener("click", (e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); openPanel(a.dataset.open, order); }));
}

export function renderHolder(root, { company: c, startups }) {
  root.innerHTML = `<section class="view-head"><p><a href="#startups">← 스타트업 목록</a></p><h1>${esc(c.name)}의 비상장 투자</h1>
    <p class="lede"><a href="${companyUrl(c.id)}">${esc(c.ticker)} 상세 보기</a></p></section>
    <div class="tbl-wrap"><table class="grid"><thead><tr><th class="first">스타트업</th><th>투자 주체</th><th class="r">지분율</th><th class="r">투자 금액</th><th>측정일</th><th>상태</th><th>근거</th></tr></thead><tbody>
    ${c.holdings.map((h) => `<tr><td class="first"><a href="#startups/${esc(h.startupId)}">${esc(h.startup)}</a></td><td>${esc(h.vehicle || "직접")}</td><td class="r">${isNum(h.pctOwned) ? `<b>${h.pctOwned}%</b>` : UNDISCLOSED}</td><td class="r">${isNum(h.amountUsd) ? money(h.amountUsd) : UNDISCLOSED}</td><td>${esc(h.measuredAt || "")}</td><td>${esc(STATUS[h.status] || h.status)}</td><td>${srcBtn(h.source.url, SRC[h.source.type] || "출처")}</td></tr>`).join("")}
    </tbody></table></div>`;
}
