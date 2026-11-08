// Flows-and-positioning views for growth industries: a monitor table with
// percentile gauges (current value inside its own history), an index chart and
// a six-axis health map per industry. Data: data/tenbagger/positioning.json.
import { esc, isNum, pct, NO_DATA, day } from "./format.js";

const REGIME = {
  "de-risking": ["디리스킹", "neg", "3개월 고점 대비 −15% 이하이고 변동성이 1년 중 상위 20%"],
  uptrend: ["상승 추세", "pos", "모멘텀 > 0.5이고 200일선 위 종목 60% 이상"],
  downtrend: ["하락 추세", "neg", "모멘텀 < −0.5이고 200일선 위 종목 40% 이하"],
  neutral: ["중립", "", "위 조건에 해당하지 않음"],
};

/** Min–max track with a diamond at the percentile (0–100) and the 25–75 band. */
export function gauge(p, title = "") {
  if (!isNum(p)) return NO_DATA;
  return `<span class="gauge" title="${esc(title || `자기 이력 대비 ${p} 백분위`)}"><span class="g-band"></span><span class="g-dot" style="left:${Math.max(0, Math.min(100, p))}%"></span></span><span class="num g-val">${p}</span>`;
}

export const regimeChip = (r) => { const [l, cls, t] = REGIME[r] || REGIME.neutral; return `<span class="chip regime ${cls}" title="${esc(t)}">${esc(l)}</span>`; };

export function monitorTable(pos) {
  const rows = (pos?.industries || []).filter((r) => !r.insufficient);
  if (!rows.length) return "";
  return `<section class="pos-monitor"><h2>성장 산업 수급·포지션 모니터 <span class="sub">${esc(day(rows[0].asOf))} 종가 기준 · 산업별 동일가중 지수</span></h2>
    <div class="tbl-wrap"><table class="grid"><thead><tr>
      <th class="first">산업</th><th>국면</th><th title="21·63·126·252일 변동성 조정 수익률 z값 평균">모멘텀 z</th><th>모멘텀 백분위(2년)</th>
      <th class="r">1개월</th><th class="r">3개월</th><th class="r">1년</th><th class="r">3개월 고점 대비</th>
      <th class="r">변동성(21일)</th><th>변동성 백분위(1년)</th><th class="r">200일선 위</th><th class="r">50일선 위</th><th class="r">공매도(중앙값)</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td class="first"><a href="#industries/${esc(r.id)}">${esc(r.name)}</a><div class="sub">${r.members}종목</div></td>
        <td>${regimeChip(r.regime)}</td><td class="r"><span class="num ${r.momentum > 0 ? "pos" : r.momentum < 0 ? "neg" : ""}">${isNum(r.momentum) ? `${r.momentum > 0 ? "+" : ""}${r.momentum.toFixed(2)}` : "자료 없음"}</span></td>
        <td>${gauge(r.momentumPct)}</td><td class="r">${pct(r.return1mPct)}</td><td class="r">${pct(r.return3mPct)}</td><td class="r">${pct(r.return1yPct)}</td><td class="r">${pct(r.drawdown3mPct)}</td>
        <td class="r"><span class="num">${isNum(r.vol21) ? `${r.vol21.toFixed(0)}%` : "자료 없음"}</span>${r.volRange1y ? `<div class="sub">1년 ${r.volRange1y.low}–${r.volRange1y.high}%</div>` : ""}</td>
        <td>${gauge(r.volPct1y, r.volRange1y ? `저점 ${r.volRange1y.low}% (${r.volRange1y.lowDate}) · 고점 ${r.volRange1y.high}% (${r.volRange1y.highDate})` : "")}</td>
        <td class="r">${isNum(r.breadth200) ? `${r.breadth200}%` : NO_DATA}</td><td class="r">${isNum(r.breadth50) ? `${r.breadth50}%` : NO_DATA}</td>
        <td class="r">${isNum(r.shortMedian) ? `${r.shortMedian}%<div class="sub">${r.shortN}종목</div>` : NO_DATA}</td></tr>`).join("")}
    </tbody></table></div>
    <details class="method"><summary>계산 방법</summary><ul>${Object.values(pos.method).map((m) => `<li>${esc(m)}</li>`).join("")}</ul></details></section>`;
}

/** Hexagon: each axis 0–100 from the centre; the larger the area, the healthier. */
export function healthMap(axes) {
  if (!axes?.length) return "";
  const R = 110, C = 150, n = axes.length;
  const pt = (i, v) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [C + Math.cos(a) * R * v, C + Math.sin(a) * R * v]; };
  const ring = (v) => axes.map((_, i) => pt(i, v).map((x) => x.toFixed(1)).join(",")).join(" ");
  const poly = axes.map((a, i) => pt(i, isNum(a.value) ? a.value / 100 : 0).map((x) => x.toFixed(1)).join(",")).join(" ");
  return `<figure class="health"><svg viewBox="0 0 300 300" role="img" aria-label="산업 건강 지도">
      ${[0.25, 0.5, 0.75, 1].map((v) => `<polygon class="ring" points="${ring(v)}"/>`).join("")}
      ${axes.map((_, i) => { const [x, y] = pt(i, 1); return `<line class="spoke" x1="${C}" y1="${C}" x2="${x}" y2="${y}"/>`; }).join("")}
      <polygon class="area" points="${poly}"/>
      ${axes.map((a, i) => { const [x, y] = pt(i, 1.2); return `<text x="${x}" y="${y}" text-anchor="middle">${esc(a.axis)} ${isNum(a.value) ? a.value : "—"}</text>`; }).join("")}
    </svg><figcaption><ul>${axes.map((a) => `<li><b>${esc(a.axis)}</b> ${isNum(a.value) ? a.value : "자료 없음"} — ${esc(a.basis)}</li>`).join("")}</ul>
    <p class="sub">면적이 클수록 해당 산업의 추세·참여·안정성·성장·자금·수급이 양호합니다. 축마다 0–100 백분위이며 예측이 아닙니다.</p></figcaption></figure>`;
}

export function indexChart(series) {
  if (!series?.length) return "";
  const W = 640, H = 160, vals = series.map((p) => p[1]);
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const x = (i) => (i / (series.length - 1)) * W, y = (v) => 8 + (1 - (v - lo) / span) * (H - 24);
  const path = series.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[1]).toFixed(1)}`).join("");
  return `<svg class="idx-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="산업 동일가중 지수 2년"><path d="${path}"/>
    <text x="0" y="${H - 2}">${esc(series[0][0])}</text><text x="${W}" y="${H - 2}" text-anchor="end">${esc(series.at(-1)[0])}</text></svg>`;
}

export function industryPositionSection(r) {
  if (!r || r.insufficient) return `<section><h2>수급·포지션</h2><p class="muted">일간 가격 자료가 260거래일 이상인 구성 종목이 3개 미만이라 계산하지 않았습니다.</p></section>`;
  return `<section><h2>수급·포지션 ${regimeChip(r.regime)} <span class="sub">${esc(r.asOf)} · ${r.members}종목 동일가중</span></h2>
    <div class="pos-grid"><div>${indexChart(r.series)}
      <dl class="kv"><div><dt>모멘텀 z</dt><dd>${isNum(r.momentum) ? r.momentum.toFixed(2) : "자료 없음"}</dd></div><div><dt>모멘텀 백분위(2년)</dt><dd>${gauge(r.momentumPct)}</dd></div>
      <div><dt>변동성 21일</dt><dd>${isNum(r.vol21) ? `${r.vol21}%` : "자료 없음"}</dd></div><div><dt>변동성 백분위(1년)</dt><dd>${gauge(r.volPct1y)}</dd></div>
      <div><dt>3개월 고점 대비</dt><dd>${pct(r.drawdown3mPct)}</dd></div><div><dt>200일선 위 종목</dt><dd>${isNum(r.breadth200) ? `${r.breadth200}%` : "자료 없음"}</dd></div></dl></div>
      ${healthMap(r.health)}</div></section>`;
}

export function stockPositionKv(s) {
  if (!s) return "";
  const si = s.shortPctFloat;
  return `<dl class="kv"><div><dt>모멘텀 z</dt><dd class="${s.momentum > 0 ? "pos" : s.momentum < 0 ? "neg" : ""}">${isNum(s.momentum) ? s.momentum.toFixed(2) : "자료 없음"}</dd></div>
    <div><dt>모멘텀 백분위(2년)</dt><dd>${gauge(s.momentumPct)}</dd></div><div><dt>변동성 21일</dt><dd>${isNum(s.vol21) ? `${s.vol21}%` : "자료 없음"}</dd></div>
    <div><dt>이동평균</dt><dd>${s.above200 ? "200일선 위" : "200일선 아래"} · ${s.above50 ? "50일선 위" : "50일선 아래"}</dd></div>
    <div><dt>52주 고점 대비</dt><dd>${pct(s.offHigh252Pct)}</dd></div><div><dt>공매도/유통주식</dt><dd>${isNum(si) ? `${si}%` : "자료 없음"}</dd></div></dl>`;
}
