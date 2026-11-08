// Screener presets and filters, shared by the browser screener and the daily
// build (scripts/tenbagger-build.mjs uses them for the change digest). Pure:
// no DOM, no imports.
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

export const PRESETS = {
  "cash-growers": { label: "성장하며 현금 창출", params: { g: "20-", fcf: "pos" }, text: "매출 성장률 ≥ +20% 그리고 FCF 플러스" },
  "funding-risk": { label: "고성장·자금 위험", params: { g: "30-", fcf: "neg", rwmax: "2" }, text: "매출 성장률 ≥ +30% 그리고 FCF 마이너스 그리고 런웨이(현금+단기투자) < 2년" },
  "pullback": { label: "조정 중인 성장주", params: { g: "20-", off: "-30" }, text: "매출 성장률 ≥ +20% 그리고 12개월 고점 대비 −30% 이하" },
  "startup-holders": { label: "스타트업 지분 보유 상장사", params: { cov: "holder" }, text: "비상장 스타트업 지분을 가진 상장사(특정 스타트업은 스타트업 화면에서 선택)" },
  "new": { label: "신규 편입", params: { new: "1" }, text: "최근 14일 안에 추적 대상에 추가된 기업" },
};

export const range = (s) => { const [a, b] = String(s || "").split("-"); return [a === "" || a === undefined ? null : Number(a), b === "" || b === undefined ? null : Number(b)]; };
const inRange = (v, [lo, hi]) => (lo === null || (isNum(v) && v >= lo)) && (hi === null || (isNum(v) && v <= hi));

export function applyFilters(companies, p, startups = []) {
  const markets = (p.mkt || "US,KR").split(",");
  const q = (p.q || "").trim().toLowerCase();
  const cap = range(p.cap), g = range(p.g);
  const holdersOf = p.stk ? new Set(startups.find((s) => s.id === p.stk)?.relationships.flatMap((r) => r.listedIds) || []) : null;
  return companies.filter((c) => {
    if (p.mkt !== "all" && !markets.includes(c.market)) return false;
    if (q && !`${c.name} ${c.ticker}`.toLowerCase().includes(q)) return false;
    if (p.ind && !c.industries.some((i) => i.id === p.ind) && c.screen?.sector !== p.ind) return false;
    if ((cap[0] !== null || cap[1] !== null) && !inRange(isNum(c.marketCapUsd) ? c.marketCapUsd / 1e9 : null, cap)) return false;
    if ((g[0] !== null || g[1] !== null) && !inRange(c.revenueGrowthPct, g)) return false;
    if (p.fcf === "pos" && c.fcfPositive !== true) return false;
    if (p.fcf === "neg" && c.fcfPositive !== false) return false;
    if (p.rw && !(c.fcfPositive === true || (isNum(c.runwayCashPlusStiYears) && c.runwayCashPlusStiYears >= Number(p.rw)))) return false;
    if (p.rwmax && !(isNum(c.runwayCashPlusStiYears) && c.runwayCashPlusStiYears < Number(p.rwmax))) return false;
    if (p.ps && !(isNum(c.priceToSales) && c.priceToSales <= Number(p.ps))) return false;
    if (p.off && !(isNum(c.returns?.offHigh12mPct) && c.returns.offHigh12mPct <= Number(p.off))) return false;
    if (p.liq && !(isNum(c._liqUsd) && c._liqUsd >= Number(p.liq) * 1e6)) return false;
    if (p.cov && c.coverage !== p.cov && !(p.cov === "holder" && c.holdings?.length)) return false;
    if (p.new && !c.newlyAdded) return false;
    if (p.status === "filed" && c.data.financials !== "filed") return false;
    if (p.status === "snapshot" && c.data.financials !== "provider snapshot") return false;
    if (p.layer && !c.industries.some((i) => i.layer === p.layer)) return false;
    if (holdersOf && !holdersOf.has(c.id)) return false;
    return true;
  });
}

