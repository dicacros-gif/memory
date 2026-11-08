// Daily price chart for a company, loaded only when the company is opened.
// US listings use the TradingView Advanced Chart widget locked to the exact
// exchange:ticker (volume, moving averages, RSI, fullscreen built in).
// Listings the widget cannot show (KRX/KOSDAQ and other venues) use the daily
// bars the pipeline stores (Yahoo Finance via yfinance) drawn with
// lightweight-charts, with an exact TradingView link beside it.
import { bars } from "./data.js";
import { esc } from "./format.js";

const LWC = "https://cdn.jsdelivr.net/npm/lightweight-charts@4.2.3/dist/lightweight-charts.standalone.production.js";
const TV = "https://s3.tradingview.com/tv.js";
const TV_EXCHANGE = { NYSEAMERICAN: "AMEX", KOSDAQ: "KRX", KOSPI: "KRX", TSE: "TSE", HKEX: "HKEX", SWX: "SIX", AMS: "EURONEXT" };
// Venues confirmed to render in the free embed; others fall back to stored bars.
const TV_EMBED = new Set(["NASDAQ", "NYSE", "AMEX"]);

const scripts = new Map();
function loadScript(src) {
  if (!scripts.has(src)) {
    scripts.set(src, new Promise((resolve, reject) => {
      const s = Object.assign(document.createElement("script"), { src, async: true });
      s.onload = resolve;
      s.onerror = () => { scripts.delete(src); reject(new Error(`load failed: ${src}`)); };
      document.head.append(s);
    }));
  }
  return scripts.get(src);
}

export function tvSymbol(ticker) {
  const [exchange, code] = String(ticker).split(":");
  return `${TV_EXCHANGE[exchange] || exchange}:${code}`;
}
export const tvUrl = (ticker) => `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol(ticker))}`;

const sma = (values, n) => values.map((_, i) => (i + 1 < n ? null : values.slice(i + 1 - n, i + 1).reduce((a, b) => a + b, 0) / n));
function rsi(values, n = 14) {
  const out = new Array(values.length).fill(null);
  let gain = 0, loss = 0;
  for (let i = 1; i < values.length; i += 1) {
    const d = values[i] - values[i - 1];
    if (i <= n) { gain += Math.max(d, 0); loss += Math.max(-d, 0); if (i === n) out[i] = 100 - 100 / (1 + (gain / n) / ((loss / n) || 1e-9)); continue; }
    gain = (gain * (n - 1) + Math.max(d, 0)) / n;
    loss = (loss * (n - 1) + Math.max(-d, 0)) / n;
    out[i] = 100 - 100 / (1 + gain / (loss || 1e-9));
  }
  return out;
}

const RANGES = [["1M", 22], ["6M", 126], ["1Y", 252], ["5Y", 1300], ["전체", Infinity]];

/** markers: [{date:"YYYY-MM-DD", label, kind:"tenx"|"earnings"|"raise"}] ; zoom: {from, to} */
export async function mountChart(host, { ticker, markers = [], zoom = null, preferBars = false }) {
  const [exchange] = String(ticker).split(":");
  const tvEx = TV_EXCHANGE[exchange] || exchange;
  host.innerHTML = `<div class="chart-head"><div class="chart-ranges" role="group" aria-label="기간"></div><span class="spacer"></span>
    <a class="src-btn" href="${tvUrl(ticker)}" target="_blank" rel="noopener">TradingView에서 ${esc(tvSymbol(ticker))} 열기 ↗</a></div>
    <div class="chart-box" data-chart><div class="skeleton chart-sk"></div></div><div class="chart-rsi" data-rsi></div><p class="chart-note" data-note></p>`;
  if (TV_EMBED.has(tvEx) && !preferBars && !zoom) {
    try {
      await loadScript(TV);
      const box = host.querySelector("[data-chart]");
      box.innerHTML = "";
      const id = `tv_${Math.random().toString(36).slice(2)}`;
      box.id = id;
      box.classList.add("tv");
      // eslint-disable-next-line no-new, no-undef
      new TradingView.widget({
        container_id: id, symbol: tvSymbol(ticker), interval: "D", autosize: true, timezone: "Etc/UTC", locale: "kr",
        theme: document.documentElement.dataset.theme === "light" ? "light" : "dark", style: "1", allow_symbol_change: false, hide_side_toolbar: false,
        studies: ["MASimple@tv-basicstudies", "RSI@tv-basicstudies", "Volume@tv-basicstudies"], withdateranges: true,
      });
      host.querySelector("[data-rsi]").remove();
      host.querySelector(".chart-ranges").remove();
      host.querySelector("[data-note]").textContent = `TradingView 위젯 · ${tvSymbol(ticker)} 고정 · 지연 시세일 수 있음 · 이동평균·RSI·거래량·전체화면은 위젯 메뉴에서`;
      return;
    } catch { /* fall back to stored bars */ }
  }
  const data = await bars(ticker);
  const box = host.querySelector("[data-chart]");
  if (!data?.t?.length) {
    box.innerHTML = `<div class="chart-empty">저장된 일간 가격이 아직 없습니다. 다음 데이터 갱신 후 표시됩니다. <a href="${tvUrl(ticker)}" target="_blank" rel="noopener">TradingView에서 보기 ↗</a></div>`;
    host.querySelector("[data-rsi]").remove();
    return;
  }
  try { await loadScript(LWC); } catch {
    box.innerHTML = `<div class="chart-empty">차트 라이브러리를 불러오지 못했습니다. <a href="${tvUrl(ticker)}" target="_blank" rel="noopener">TradingView에서 보기 ↗</a></div>`;
    return;
  }
  const LW = window.LightweightCharts;
  const dark = document.documentElement.dataset.theme !== "light";
  const colors = { bg: dark ? "#0f1318" : "#ffffff", text: dark ? "#c9d1db" : "#28323c", grid: dark ? "#1c232c" : "#eef1f4", up: "#1f9d55", down: "#d64545" };
  box.innerHTML = "";
  const opts = (h) => ({ height: h, localization: { locale: "ko-KR" }, layout: { background: { color: colors.bg }, textColor: colors.text }, grid: { vertLines: { color: colors.grid }, horzLines: { color: colors.grid } }, rightPriceScale: { borderVisible: false }, timeScale: { borderVisible: false }, crosshair: { mode: 0 } });
  const chart = LW.createChart(box, { ...opts(360), width: box.clientWidth });
  const candles = chart.addCandlestickSeries({ upColor: colors.up, downColor: colors.down, wickUpColor: colors.up, wickDownColor: colors.down, borderVisible: false });
  const rows = data.t.map((time, i) => ({ time, open: data.o[i], high: data.h[i], low: data.l[i], close: data.c[i], value: data.v?.[i] })).filter((r) => r.close > 0 && r.open > 0);
  candles.setData(rows.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));
  const vol = chart.addHistogramSeries({ priceFormat: { type: "volume" }, priceScaleId: "", color: dark ? "#33414f" : "#c8d1da" });
  vol.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
  vol.setData(rows.filter((r) => r.value !== null && r.value !== undefined).map((r) => ({ time: r.time, value: r.value, color: r.close >= r.open ? (dark ? "#1f5137" : "#b9e3c9") : (dark ? "#5a2a2a" : "#f1c3c3") })));
  const closes = rows.map((r) => r.close);
  for (const [n, color] of [[50, "#e3a008"], [200, "#3b82f6"]]) {
    const line = chart.addLineSeries({ color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, title: `MA${n}` });
    line.setData(sma(closes, n).map((v, i) => (v === null ? null : { time: rows[i].time, value: v })).filter(Boolean));
  }
  const inRange = new Set(rows.map((r) => r.time));
  const near = (d) => { const m = rows.find((r) => r.time >= d); return m?.time; };
  const all = [...markers, ...((data.events?.earnings || []).filter((d) => d <= rows.at(-1).time).map((d) => ({ date: d, label: "실적", kind: "earnings" })))];
  const mk = all.map((m) => ({ time: inRange.has(m.date) ? m.date : near(m.date), position: m.kind === "raise" ? "aboveBar" : "belowBar",
    color: m.kind === "tenx" ? "#e3a008" : m.kind === "raise" ? "#d64545" : "#7c8a99", shape: m.kind === "earnings" ? "circle" : m.kind === "raise" ? "arrowDown" : "arrowUp", text: m.label })).filter((m) => m.time).sort((a, b) => (a.time < b.time ? -1 : 1));
  if (mk.length) candles.setMarkers(mk);
  const rsiBox = host.querySelector("[data-rsi]");
  const rsiChart = LW.createChart(rsiBox, { ...opts(90), width: rsiBox.clientWidth, timeScale: { visible: false } });
  const rsiLine = rsiChart.addLineSeries({ color: "#a78bfa", lineWidth: 1, title: "RSI 14", priceLineVisible: false });
  rsiLine.setData(rsi(closes).map((v, i) => (v === null ? null : { time: rows[i].time, value: v })).filter(Boolean));
  chart.timeScale().subscribeVisibleLogicalRangeChange((r) => r && rsiChart.timeScale().setVisibleLogicalRange(r));
  const setRange = (n) => {
    const from = Number.isFinite(n) ? Math.max(0, rows.length - n) : 0;
    chart.timeScale().setVisibleLogicalRange({ from, to: rows.length - 1 });
    chart.priceScale("right").applyOptions({ mode: n >= 1300 ? LW.PriceScaleMode.Logarithmic : LW.PriceScaleMode.Normal });
  };
  const rangesEl = host.querySelector(".chart-ranges");
  rangesEl.innerHTML = `${RANGES.map(([l, n]) => `<button type="button" class="btn sm" data-n="${n}">${l}</button>`).join("")}<button type="button" class="btn sm" data-full>전체화면</button>`;
  rangesEl.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.full !== undefined) { host.requestFullscreen?.(); return; }
    rangesEl.querySelectorAll("[data-n]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    setRange(Number(b.dataset.n === "Infinity" ? Infinity : b.dataset.n));
  });
  if (zoom?.from) {
    const i0 = rows.findIndex((r) => r.time >= zoom.from), i1 = rows.findIndex((r) => r.time >= (zoom.to || rows.at(-1).time));
    if (i0 >= 0) { chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, i0 - 10), to: (i1 >= 0 ? i1 : rows.length - 1) + 10 }); chart.priceScale("right").applyOptions({ mode: LW.PriceScaleMode.Logarithmic }); }
  } else rangesEl.querySelector('[data-n="252"]').click();
  new ResizeObserver(() => { chart.applyOptions({ width: box.clientWidth, height: document.fullscreenElement === host ? Math.max(300, window.innerHeight - 200) : 360 }); rsiChart.applyOptions({ width: rsiBox.clientWidth }); }).observe(host);
  host.querySelector("[data-note]").innerHTML = `일간 수정 OHLCV · ${esc(data.source || "Yahoo Finance")} · 마지막 거래일 ${esc(data.asOf)} · 50·200일 이동평균, RSI(14), 5년 이상은 로그 축 · 표시: ▲10배 구간 시작·도달 · ●실적 발표 · ▼증자 관련 공시`;
}
