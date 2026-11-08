// Landing "TEN-BAGGER RADAR": the measured industry growth, the curated
// candidates that pass the screen, and new fast growers, from
// data/tenbagger/landing-client.json (scripts/tenbagger-screen.mjs). The
// section stays hidden unless that artifact loads with something to show.
(function tenbaggerRadar() {
  const section = document.querySelector("[data-tenbagger-radar]");
  if (!section) return;
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v) => typeof v === "number" && Number.isFinite(v);
  const pct = (v) => (num(v) ? `${v > 0 ? "+" : ""}${v.toFixed(1)}%` : "");
  const usd = (v) => (!num(v) ? "" : v >= 1e12 ? `$${(v / 1e12).toFixed(2)}T` : v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : `$${Math.round(v / 1e6)}M`);
  const day = (v) => (v ? String(v).slice(0, 10) : "");
  const funded = (c) => (c.fcfPositive ? "FCF 흑자" : num(c.runwayYears) ? `런웨이 ${c.runwayYears}년` : "");

  function card(title, note, rows) {
    if (!rows.length) return "";
    return `<article class="investor-tenbagger-card"><h3>${esc(title)}</h3><p>${esc(note)}</p><ol>${rows.join("")}</ol></article>`;
  }

  fetch("data/tenbagger/landing-client.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (!d) return;
      const industries = (d.industries || []).map((i) => `<li><b>${esc(i.industryKo || i.industry)}</b><span>매출 성장 중앙값 ${esc(pct(i.medianGrowthPct))} · ${esc(i.companies)}곳 · +25% 이상 ${esc(i.shareGrowing25Pct)}%</span></li>`);
      const candidates = (d.candidates || []).map((c) => `<li><b>${esc(c.name)} <small>${esc(c.ticker)}</small></b><span>${esc(c.sectorName)} · 매출 ${esc(pct(c.revenueGrowthPct))} · 시총 ${esc(usd(c.marketCapUsd))} · ${esc(funded(c))}${c.crossChecked === true ? " · 교차검증 일치" : ""}</span></li>`);
      const discovery = (d.discovery || []).map((c) => `<li><b>${esc(c.name)} <small>${esc(c.ticker)}</small></b><span>${esc(c.industryKo || c.industry)} · 매출 ${esc(pct(c.revenueGrowthPct))} · 시총 ${esc(usd(c.marketCapUsd))} · ${esc(funded(c))}</span></li>`);
      const body = [
        card("성장 업종", `최근 12개월 매출 성장률 실측 · ${d.source?.companies ? `${d.source.companies.toLocaleString()}개 상장사` : "상장사"} 기준`, industries),
        card("후보 스크린 통과", `큐레이션 ${d.candidateCount}개 통과 · 시총 $10B 미만 · 매출 +20% 이상 · FCF 흑자 또는 런웨이 2년 이상`, candidates),
        card("목록 밖 신규 고성장", "시총 $0.3B~$10B · 매출 +30% 이상 · 자금 여력 충족", discovery),
      ].filter(Boolean);
      if (!body.length) return;
      const tenX = d.tenX?.total ? ` · 최근 5년 10배 상승 ${d.tenX.total}개 종목, 매출 성장 중앙값 ${pct(d.tenX.traits?.medianRevenueGrowthPct)}` : "";
      section.querySelector("[data-tenbagger-body]").innerHTML = body.join("");
      section.querySelector("[data-tenbagger-meta]").textContent = `시장 ${day(d.marketAsOf) || "-"} · 재무 ${day(d.metricsAsOf) || "-"} 기준${tenX} · TradingView 스크리너·SEC EDGAR·Yahoo Finance · 투자 권유 아님`;
      section.hidden = false;
    })
    .catch(() => {});
})();
