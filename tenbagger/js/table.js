// Reusable data table: click a header to sort (ascending → descending → off),
// Shift+click to add a sort key, missing values always last, frozen header
// and first column, keyboard row navigation, column chooser, CSV export and
// stacked cards on narrow screens.
import { esc, isNum } from "./format.js";

export function sortRows(rows, sort, columns) {
  if (!sort?.length) return rows;
  const byKey = Object.fromEntries(columns.map((c) => [c.key, c]));
  const keyed = rows.map((row) => ({ row, values: sort.map((s) => byKey[s.key]?.value?.(row)) }));
  keyed.sort((a, b) => {
    for (let i = 0; i < sort.length; i += 1) {
      const x = a.values[i], y = b.values[i];
      const xm = x === null || x === undefined || x === "" || (typeof x === "number" && !Number.isFinite(x));
      const ym = y === null || y === undefined || y === "" || (typeof y === "number" && !Number.isFinite(y));
      if (xm && ym) continue;
      if (xm) return 1; // missing last in both directions
      if (ym) return -1;
      const cmp = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "ko");
      if (cmp) return sort[i].dir === "desc" ? -cmp : cmp;
    }
    return 0;
  });
  return keyed.map((k) => k.row);
}

/** Header click: asc → desc → removed; Shift keeps the other keys (multi-sort). */
export function nextSort(sort, key, multi) {
  const current = sort.find((s) => s.key === key);
  const others = multi ? sort.filter((s) => s.key !== key) : [];
  if (!current) return [...others, { key, dir: "asc" }];
  if (current.dir === "asc") return multi ? sort.map((s) => (s.key === key ? { key, dir: "desc" } : s)) : [{ key, dir: "desc" }];
  return others;
}

export function describeSort(sort, columns) {
  if (!sort?.length) return "정렬 없음";
  const label = Object.fromEntries(columns.map((c) => [c.key, c.label]));
  return sort.map((s, i) => `${i + 1}. ${label[s.key] || s.key} ${s.dir === "asc" ? "오름차순" : "내림차순"}`).join(" → ") + " · 값 없는 행은 항상 맨 아래";
}

export function toCsv(rows, columns) {
  const cell = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.map((c) => cell(c.label)).join(","), ...rows.map((r) => columns.map((c) => cell(c.csv ? c.csv(r) : c.value?.(r))).join(","))].join("\n");
}

export function renderTable(host, opts) {
  const { columns, rows, sort = [], visible, density = "compact", summary = "", rowKey, onSort, onOpen, onColumns, onDensity, selectable = false, selected = new Set(), onSelect, card, csvName = "export" } = opts;
  const shown = columns.filter((c) => c.fixed || visible.includes(c.key));
  const sorted = sortRows(rows, sort, columns);
  const arrow = (key) => {
    const i = sort.findIndex((s) => s.key === key);
    if (i < 0) return '<span class="sort-arrow" aria-hidden="true">↕</span>';
    return `<span class="sort-arrow on" aria-hidden="true">${sort[i].dir === "asc" ? "▲" : "▼"}${sort.length > 1 ? `<sub>${i + 1}</sub>` : ""}</span>`;
  };
  const ariaSort = (key) => { const s = sort.find((x) => x.key === key); return s ? (s.dir === "asc" ? "ascending" : "descending") : "none"; };
  host.innerHTML = `
    <div class="tbl-summary">${summary}</div>
    <div class="tbl-tools">
      <span class="muted sort-desc">${esc(describeSort(sort, columns))}</span>
      <span class="spacer"></span>
      <details class="col-chooser"><summary class="btn">열 선택</summary><div class="col-menu">${columns.filter((c) => !c.fixed).map((c) => `<label><input type="checkbox" value="${esc(c.key)}" ${visible.includes(c.key) ? "checked" : ""}> ${esc(c.label)}</label>`).join("")}</div></details>
      <button type="button" class="btn" data-density aria-pressed="${density === "comfortable"}">${density === "compact" ? "넓게 보기" : "촘촘하게 보기"}</button>
      <button type="button" class="btn" data-csv>CSV 내보내기</button>
    </div>
    <div class="tbl-wrap density-${density}"><table class="grid">
      <thead><tr>${selectable ? '<th class="sel"><span class="sr">선택</span></th>' : ""}${shown.map((c) => `<th scope="col" class="${c.num ? "r" : ""} ${c.fixed ? "first" : ""}" aria-sort="${ariaSort(c.key)}">${c.sortable === false ? esc(c.label) : `<button type="button" class="th-btn" data-sort="${esc(c.key)}" title="${esc(c.title || "클릭 정렬 · Shift+클릭 다중 정렬")}">${esc(c.label)} ${arrow(c.key)}</button>`}</th>`).join("")}</tr></thead>
      <tbody>${sorted.length ? sorted.map((r) => `<tr tabindex="0" data-key="${esc(rowKey(r))}">${selectable ? `<td class="sel"><input type="checkbox" aria-label="비교에 추가" data-select="${esc(rowKey(r))}" ${selected.has(rowKey(r)) ? "checked" : ""}></td>` : ""}${shown.map((c) => `<td class="${c.num ? "r" : ""} ${c.fixed ? "first" : ""}">${c.render(r)}</td>`).join("")}</tr>`).join("")
        : `<tr><td colspan="${shown.length + (selectable ? 1 : 0)}" class="empty">조건에 맞는 행이 없습니다. 필터를 줄여 보세요.</td></tr>`}</tbody>
    </table></div>
    ${card ? `<ol class="cards">${sorted.map((r) => `<li class="card" tabindex="0" data-key="${esc(rowKey(r))}">${card(r)}</li>`).join("")}</ol>` : ""}`;
  host.querySelectorAll("[data-sort]").forEach((b) => b.addEventListener("click", (e) => onSort(nextSort(sort, b.dataset.sort, e.shiftKey))));
  host.querySelector("[data-density]").addEventListener("click", () => onDensity(density === "compact" ? "comfortable" : "compact"));
  host.querySelector("[data-csv]").addEventListener("click", () => {
    const blob = new Blob([`﻿${toCsv(sorted, shown)}`], { type: "text/csv;charset=utf-8" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${csvName}.csv` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  host.querySelectorAll(".col-menu input").forEach((i) => i.addEventListener("change", () => onColumns([...host.querySelectorAll(".col-menu input:checked")].map((x) => x.value))));
  host.querySelectorAll("[data-select]").forEach((i) => i.addEventListener("change", (e) => { e.stopPropagation(); onSelect?.(i.dataset.select, i.checked); }));
  const byKey = new Map(sorted.map((r) => [rowKey(r), r]));
  const open = (el, e) => { if (e.target.closest("a,button,input,label")) return; const r = byKey.get(el.dataset.key); if (r) onOpen(r, sorted); };
  host.querySelectorAll("tbody tr[data-key], .cards li").forEach((tr) => {
    tr.addEventListener("click", (e) => open(tr, e));
    tr.addEventListener("keydown", (e) => {
      if (e.key === "Enter") open(tr, e);
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const next = e.key === "ArrowDown" ? tr.nextElementSibling : tr.previousElementSibling;
        next?.focus();
      }
    });
  });
  return sorted;
}

export const numValue = (v) => (isNum(v) ? v : null);
