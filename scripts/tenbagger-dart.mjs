import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Korean financial statements from DART OpenAPI (opendart.fss.or.kr).
 *
 * Runs only when the DART_API_KEY environment variable is set (a repository
 * secret the owner adds; the key is never written to code or data). Writes
 * data/tenbagger/dart-cache.json, which scripts/tenbagger-collect.mjs prefers
 * over the yfinance snapshot for KRX/KOSDAQ listings and labels "filed".
 *
 * Quarterly reports state income items as the quarter (thstrm_amount) and the
 * year-to-date (thstrm_add_amount, with the prior year's same YTD in
 * frmtrm_add_amount); cash-flow items are year-to-date. Trailing twelve months
 * = YTD + last fiscal year − prior year's same YTD. Period ends assume a
 * December fiscal year, which the report code implies for most KRX filers.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const UNIVERSE = resolve(root, "data/tenbagger/universe.json");
const OUT = resolve(root, "data/tenbagger/dart-cache.json");
const API = "https://opendart.fss.or.kr/api";
const REPORTS = [["11014", "09-30", 9], ["11012", "06-30", 6], ["11013", "03-31", 3]];

const amount = (value) => {
  const n = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) && String(value ?? "").trim() !== "" ? n : null;
};

/** One account's value from a fnlttSinglAcntAll list: by IFRS id first, then by Korean name. */
export function pick(list, { ids = [], names = [], sj = null, field = "thstrm_amount" }) {
  const rows = (list || []).filter((r) => !sj || (Array.isArray(sj) ? sj.includes(r.sj_div) : r.sj_div === sj));
  const byId = rows.find((r) => ids.includes(r.account_id));
  const byName = byId || rows.find((r) => names.some((n) => String(r.account_nm || "").replace(/\s/g, "") === n));
  return byName ? amount(byName[field]) : null;
}

const REVENUE = { ids: ["ifrs-full_Revenue", "ifrs_Revenue"], names: ["매출액", "영업수익", "수익(매출액)", "매출"], sj: ["IS", "CIS"] };
const OCF = { ids: ["ifrs-full_CashFlowsFromUsedInOperatingActivities", "ifrs_CashFlowsFromUsedInOperatingActivities"], names: ["영업활동현금흐름", "영업활동으로인한현금흐름"], sj: "CF" };
const CAPEX = { ids: ["ifrs-full_PurchaseOfPropertyPlantAndEquipment", "ifrs_PurchaseOfPropertyPlantAndEquipment"], names: ["유형자산의취득"], sj: "CF" };
const CASH = { ids: ["ifrs-full_CashAndCashEquivalents", "ifrs_CashAndCashEquivalents"], names: ["현금및현금성자산"], sj: "BS" };
const GROSS = { ids: ["ifrs-full_GrossProfit", "ifrs_GrossProfit"], names: ["매출총이익"], sj: ["IS", "CIS"] };
const OPINC = { ids: ["dart_OperatingIncomeLoss", "ifrs-full_ProfitLossFromOperatingActivities"], names: ["영업이익", "영업이익(손실)"], sj: ["IS", "CIS"] };
const DEBT = [["단기차입금"], ["장기차입금"], ["사채"], ["유동성장기부채"]];
const STI = { ids: ["dart_ShortTermDepositsNotClassifiedAsCashEquivalents"], names: ["단기금융상품", "단기투자자산"], sj: "BS" };

/** Fundamentals from a latest report (quarterly or annual) and the prior annual report. */
export function dartFundamentals({ latest, latestCode, year, annualPrior }) {
  const isAnnual = latestCode === "11011";
  const meta = REPORTS.find(([code]) => code === latestCode);
  const end = isAnnual ? `${year}-12-31` : `${year}-${meta[1]}`;
  const revYtd = pick(latest, { ...REVENUE, field: isAnnual ? "thstrm_amount" : "thstrm_add_amount" }) ?? (isAnnual ? null : pick(latest, REVENUE));
  const revPriorYtd = pick(latest, { ...REVENUE, field: isAnnual ? "frmtrm_amount" : "frmtrm_add_amount" });
  const ocfYtd = pick(latest, OCF);
  const ocfPriorYtd = pick(latest, { ...OCF, field: "frmtrm_amount" });
  const capexYtd = pick(latest, CAPEX);
  const capexPriorYtd = pick(latest, { ...CAPEX, field: "frmtrm_amount" });
  const fyRev = annualPrior ? pick(annualPrior, REVENUE) : null;
  const fyOcf = annualPrior ? pick(annualPrior, OCF) : null;
  const fyCapex = annualPrior ? pick(annualPrior, CAPEX) : null;
  const ttm = (ytd, fy, prior) => (isAnnual ? ytd : ytd !== null && fy !== null && prior !== null ? ytd + fy - prior : null);
  const revenueTtm = ttm(revYtd, fyRev, revPriorYtd);
  const ocfTtm = ttm(ocfYtd, fyOcf, ocfPriorYtd);
  const capexTtm = ttm(capexYtd === null ? null : Math.abs(capexYtd), fyCapex === null ? null : Math.abs(fyCapex), capexPriorYtd === null ? null : Math.abs(capexPriorYtd));
  const cash = pick(latest, CASH);
  const stiValue = pick(latest, STI);
  const sti = stiValue || 0;
  const gp = pick(latest, { ...GROSS, field: isAnnual ? "thstrm_amount" : "thstrm_add_amount" });
  const oi = pick(latest, { ...OPINC, field: isAnnual ? "thstrm_amount" : "thstrm_add_amount" });
  const debtParts = DEBT.map((names) => pick(latest, { names, sj: "BS" })).filter((v) => v !== null);
  return {
    currency: "KRW",
    revenueTtm,
    revenueBasis: isAnnual ? "fiscal-year" : "ttm",
    revenueEnd: end,
    revenueGrowthPct: revYtd !== null && revPriorYtd > 0 ? Number(((revYtd / revPriorYtd - 1) * 100).toFixed(1)) : null,
    revenueGrowthBasis: isAnnual ? "fiscal-year YoY" : "year-to-date YoY",
    operatingCashFlowTtm: ocfTtm,
    capexTtm,
    fcfTtm: ocfTtm !== null && capexTtm !== null ? ocfTtm - capexTtm : null,
    cashAndShortTermInvestments: cash !== null ? cash + sti : null,
    cashOnly: cash,
    shortTermInvestments: stiValue,
    debt: debtParts.length ? debtParts.reduce((a, b) => a + b, 0) : null,
    grossMarginPct: gp !== null && revYtd > 0 ? Number((gp / revYtd * 100).toFixed(1)) : null,
    operatingMarginPct: oi !== null && revYtd > 0 ? Number((oi / revYtd * 100).toFixed(1)) : null,
    fcfEnd: end,
    cashEnd: end,
    status: "filed",
  };
}

const CAPITAL_RAISE = /유상증자|전환사채|신주인수권부사채|교환사채|증권신고서/;
export function dartFilings(list = []) {
  return list.slice(0, 15).map((r) => ({
    form: r.report_nm, date: `${r.rcept_dt.slice(0, 4)}-${r.rcept_dt.slice(4, 6)}-${r.rcept_dt.slice(6, 8)}`,
    url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${r.rcept_no}`, capitalRaise: CAPITAL_RAISE.test(r.report_nm || ""),
  }));
}

async function api(path, params) {
  const url = `${API}/${path}?${new URLSearchParams({ crtfc_key: process.env.DART_API_KEY, ...params })}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${path} HTTP ${response.status}`);
  return response.json();
}

async function corpCodes() {
  const response = await fetch(`${API}/corpCode.xml?crtfc_key=${encodeURIComponent(process.env.DART_API_KEY)}`, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`corpCode HTTP ${response.status}`);
  const dir = await mkdtemp(join(tmpdir(), "dart-"));
  try {
    const zip = join(dir, "corp.zip");
    await writeFile(zip, Buffer.from(await response.arrayBuffer()));
    const xml = execFileSync("unzip", ["-p", zip], { maxBuffer: 256 * 1024 * 1024 }).toString("utf8");
    const map = new Map();
    for (const m of xml.matchAll(/<corp_code>(\d+)<\/corp_code>[\s\S]*?<stock_code>\s*(\d{6})\s*<\/stock_code>/g)) map.set(m[2], m[1]);
    return map;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function statements(corp, year, code) {
  for (const fs of ["CFS", "OFS"]) {
    const json = await api("fnlttSinglAcntAll.json", { corp_code: corp, bsns_year: String(year), reprt_code: code, fs_div: fs });
    if (json.status === "000" && json.list?.length) return json.list;
  }
  return null;
}

async function main() {
  if (!process.env.DART_API_KEY) {
    console.log(JSON.stringify({ tenbaggerDart: "skipped", reason: "DART_API_KEY secret not set; Korean financials stay provider snapshots" }));
    return;
  }
  const universe = JSON.parse(await readFile(UNIVERSE, "utf8"));
  const tickers = new Set();
  for (const s of universe.sectors || []) {
    for (const c of s.publicCompanies || []) if (/^(KRX|KOSDAQ|KOSPI):\d{6}$/.test(c.ticker)) tickers.add(c.ticker);
    for (const st of s.startups || []) for (const h of st.holders || []) for (const t of String(h.holderTicker || "").split("/")) if (/^(KRX|KOSDAQ|KOSPI):\d{6}$/.test(t.trim())) tickers.add(t.trim());
  }
  const codes = await corpCodes();
  const year = new Date().getUTCFullYear();
  const out = {};
  const errors = [];
  const since = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10).replace(/-/g, "");
  for (const ticker of tickers) {
    const corp = codes.get(ticker.split(":")[1]);
    if (!corp) { errors.push(`${ticker}: no DART corp code`); continue; }
    try {
      let latest = null, latestCode = null, latestYear = null;
      for (const y of [year, year - 1]) {
        for (const [code] of REPORTS) {
          latest = await statements(corp, y, code);
          if (latest) { latestCode = code; latestYear = y; break; }
        }
        if (latest) break;
        latest = await statements(corp, y - 1, "11011");
        if (latest) { latestCode = "11011"; latestYear = y - 1; break; }
      }
      if (!latest) { errors.push(`${ticker}: no statements`); continue; }
      const annualPrior = latestCode === "11011" ? null : await statements(corp, latestYear - 1, "11011");
      const listing = await api("list.json", { corp_code: corp, bgn_de: since, page_count: "30" }).catch(() => null);
      out[ticker] = {
        ...dartFundamentals({ latest, latestCode, year: latestYear, annualPrior }),
        filings: dartFilings(listing?.list || []),
        source: "DART OpenAPI 단일회사 전체 재무제표",
        sourceUrl: `https://dart.fss.or.kr/dsab007/main.do?option=corp&textCrpCik=${corp}`,
      };
    } catch (error) {
      errors.push(`${ticker}: ${error.message}`);
    }
  }
  await writeFile(`${OUT}.tmp`, `${JSON.stringify({ generatedAt: new Date().toISOString(), tickers: out, errors }, null, 1)}\n`);
  await rename(`${OUT}.tmp`, OUT);
  console.log(JSON.stringify({ tenbaggerDart: "written", companies: Object.keys(out).length, requested: tickers.size, errors: errors.length }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
