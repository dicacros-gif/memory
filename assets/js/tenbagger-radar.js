// Landing "FUTURE GROWTH RADAR": today's changes for an investor, from
// data/tenbagger/landing-client.json (scripts/tenbagger-build.mjs): growth
// industries by observed revenue growth next to their forecast range, screener
// presets with what newly entered, new offering filings and large price moves.
// The section stays hidden unless that artifact loads with something to show.
(function tenbaggerRadar() {
  const section = document.querySelector("[data-tenbagger-radar]");
  if (!section) return;
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v) => typeof v === "number" && Number.isFinite(v);
  const pct = (v) => (num(v) ? `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%` : "자료 없음");
  const usd = (v) => (!num(v) ? "자료 없음" : v >= 1e12 ? `$${(v / 1e12).toFixed(2)}T` : v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : `$${Math.round(v / 1e6)}M`);
  const day = (v) => (v ? String(v).slice(0, 10) : "");
  const company = (c) => `<a href="tenbagger/company.html?id=${encodeURIComponent(c.id)}">${esc(c.name)}</a>${c.ticker ? ` <small>${esc(c.ticker)}</small>` : ""}`;
  const card = (title, note, items, more) => (items.length
    ? `<article class="investor-tenbagger-card"><h3>${esc(title)}</h3><p>${note}</p><ol>${items.join("")}</ol>${more ? `<p class="investor-tenbagger-more">${more}</p>` : ""}</article>` : "");

  fetch("data/tenbagger/landing-client.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (!d || d.schemaVersion !== "2.0") return;
      const industries = (d.industries || []).map((i) => `<li><b><a href="tenbagger/#industries/${encodeURIComponent(i.id)}">${esc(i.name)}</a></b><span>관측 매출 성장 ${esc(pct(i.observed))} (상장사 ${esc(i.observedN)}곳) · 기관 전망 ${i.forecast ? `연 ${esc(i.forecast[0])}~${esc(i.forecast[1])}%` : "자료 없음"}</span></li>`);
      const presets = (d.presets || []).map((p) => `<li><b><a href="tenbagger/#companies?preset=${encodeURIComponent(p.key)}">${esc(p.label)}</a> · ${esc(p.count)}개</b><span>${esc(p.rule)}${p.entered.length ? ` · 새로 충족: ${p.entered.map(company).join(", ")}` : ""}</span></li>`);
      const events = [
        ...(d.raises || []).map((r) => `<li><b>${company(r)}</b><span>${esc(r.date)} ${esc(r.form)} 증자 관련 공시 · <a href="${esc(r.url)}" target="_blank" rel="noopener">원문</a></span></li>`),
        ...(d.moves || []).map((m) => `<li><b>${company(m)}</b><span>직전 갱신 대비 ${esc(pct(m.changePct))}</span></li>`),
        ...(d.added || []).map((a) => `<li><b>${company(a)}</b><span>추적 대상에 추가(상장 확인 완료)</span></li>`),
        ...(d.startupChanges || []).map((s) => `<li><b><a href="tenbagger/#startups/${encodeURIComponent(s.id)}">${esc(s.name)}</a></b><span>상태 변경 ${esc(s.from)} → ${esc(s.to)}</span></li>`),
      ];
      const body = [
        card("성장 산업", "추적 상장사의 실제 매출 성장(관측)과 기관 전망을 따로 표시", industries),
        card("스크리너 프리셋", "조건을 그대로 공개 · 매수 의견 아님", presets),
        card("오늘의 변화", "직전 데이터 갱신 이후 공시·가격·편입 변화", events.slice(0, 10)),
      ].filter(Boolean);
      if (!body.length) return;
      section.querySelector("[data-tenbagger-body]").innerHTML = body.join("");
      section.querySelector("[data-tenbagger-meta]").textContent = `재무·가격 ${day(d.dataDate) || "-"} 기준 · 추적 상장사 ${d.counts?.companies ?? "-"}곳(미국 ${d.counts?.us ?? "-"} · 한국 ${d.counts?.kr ?? "-"}) · SEC·DART·Yahoo Finance·TradingView·FRED · 투자 권유 아님`;
      section.hidden = false;
    })
    .catch(() => {});
})();
