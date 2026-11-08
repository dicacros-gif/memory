// Formatting shared by every ten-bagger view: one unit style, explicit
// missing states, and the full value on hover.
export const isNum = (v) => typeof v === "number" && Number.isFinite(v);
export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const NO_DATA = '<span class="nd" title="수집된 값이 없습니다">자료 없음</span>';
export const UNDISCLOSED = '<span class="nd" title="공개 자료에 수치가 없습니다">미공개</span>';
export const day = (v) => (v ? String(v).slice(0, 10) : "");

const SYM = { USD: "$", KRW: "₩", JPY: "¥", EUR: "€", GBP: "£", HKD: "HK$", CNY: "CN¥", TWD: "NT$", CHF: "CHF ", CAD: "C$", AUD: "A$" };

/** 1.2B / 3.4T style with the currency, full value in the title. */
export function money(value, currency = "USD", { html = true } = {}) {
  if (!isNum(value)) return html ? NO_DATA : "";
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  let text;
  if (currency === "KRW") {
    text = abs >= 1e12 ? `${(abs / 1e12).toFixed(2)}조` : abs >= 1e8 ? `${Math.round(abs / 1e8).toLocaleString("ko-KR")}억` : `${Math.round(abs).toLocaleString("ko-KR")}`;
    text = `${sign}₩${text}`;
  } else {
    const sym = SYM[currency] ?? `${currency} `;
    text = abs >= 1e12 ? `${(abs / 1e12).toFixed(2)}T` : abs >= 1e9 ? `${(abs / 1e9).toFixed(2)}B` : abs >= 1e6 ? `${(abs / 1e6).toFixed(1)}M` : abs >= 1e3 ? `${(abs / 1e3).toFixed(1)}K` : abs.toFixed(2);
    text = `${sign}${sym}${text}`;
  }
  if (!html) return text;
  return `<span class="num" title="${esc(`${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${currency}`)}">${esc(text)}</span>`;
}

/** Signed percent with ✓-style sign pairing: colour never carries meaning alone. */
export function pct(v, { digits = 1, signed = true, html = true, plain = false } = {}) {
  if (!isNum(v)) return html ? NO_DATA : "";
  const text = `${signed && v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(digits)}%`;
  if (!html) return text;
  return plain ? `<span class="num">${text}</span>` : `<span class="num ${v > 0 ? "pos" : v < 0 ? "neg" : ""}">${text}</span>`;
}

export function years(v) {
  if (!isNum(v)) return NO_DATA;
  return `<span class="num ${v < 1.5 ? "neg" : ""}">${v.toFixed(1)}년</span>`;
}

export function multiple(v, suffix = "x") {
  return isNum(v) ? `<span class="num">${v.toFixed(1)}${suffix}</span>` : NO_DATA;
}

/** Data status chip: filed / provider snapshot / estimate / press / access failed / no data. */
export function statusChip(status, title = "") {
  const map = {
    filed: ["filed", "공시"], "provider snapshot": ["snap", "데이터 제공사"], estimate: ["est", "추정"],
    press: ["press", "보도"], company: ["comp", "회사 발표"], filing: ["filed", "공시"], "access failed": ["fail", "접근 실패"],
    "no data": ["nd", "자료 없음"], "review required": ["warn", "검토 필요"], stale: ["warn", "갱신 지연"],
  };
  const [cls, label] = map[status] || ["nd", status || "자료 없음"];
  return `<span class="chip chip-${cls}" title="${esc(title || label)}">${esc(label)}</span>`;
}

export const marketLabel = (m) => ({ US: "미국", KR: "한국", OTHER: "기타" }[m] || m);
export const link = (url, text, cls = "") => (url ? `<a class="${cls}" href="${esc(url)}" target="_blank" rel="noopener">${esc(text)}</a>` : esc(text));
export const srcBtn = (url, text = "원문") => (url ? `<a class="src-btn" href="${esc(url)}" target="_blank" rel="noopener" title="원문 공시·출처 열기">${esc(text)} ↗</a>` : "");

/** USD value of an amount in a listing currency, using the published FX only for KRW. */
export function toUsd(value, currency, fx) {
  if (!isNum(value)) return null;
  if (currency === "USD") return value;
  if (currency === "KRW" && isNum(fx?.rate)) return value / fx.rate;
  return null;
}
