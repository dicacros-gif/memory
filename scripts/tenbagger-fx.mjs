import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * FX table from FRED (Federal Reserve H.10 noon buying rates), used to put
 * every market's figures in US dollars. TradingView's per-market scans report
 * market cap in the listing currency, so a conversion is required before any
 * dollar threshold or comparison. Writes data/tenbagger/fx.json; a failed
 * series keeps its last good value and date.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(root, "data/tenbagger/fx.json");

// currency -> [FRED series, true when quoted as USD per unit]
export const SERIES = {
  KRW: ["DEXKOUS", false], JPY: ["DEXJPUS", false], CNY: ["DEXCHUS", false], HKD: ["DEXHKUS", false],
  TWD: ["DEXTAUS", false], CAD: ["DEXCAUS", false], CHF: ["DEXSZUS", false], INR: ["DEXINUS", false],
  SEK: ["DEXSDUS", false], EUR: ["DEXUSEU", true], GBP: ["DEXUSUK", true], AUD: ["DEXUSAL", true],
};
// Sub-units some venues quote in.
const SUBUNIT = { GBX: ["GBP", 100], ILA: ["ILS", 100], ZAC: ["ZAR", 100] };

/** Units of `currency` per 1 USD, or null when unknown. */
export function perUsd(currency, table) {
  if (!currency) return null;
  if (currency === "USD") return 1;
  const sub = SUBUNIT[currency];
  if (sub) { const base = perUsd(sub[0], table); return base === null ? null : base * sub[1]; }
  const rate = table?.rates?.[currency]?.rate;
  return typeof rate === "number" && rate > 0 ? rate : null;
}

export function toUsd(value, currency, table) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const r = perUsd(currency, table);
  return r ? value / r : null;
}

export function parseFred(csv, invert) {
  const rows = String(csv).trim().split(/\r?\n/).slice(1).map((l) => l.split(",")).filter(([, v]) => v && v !== "." && Number.isFinite(Number(v)));
  if (!rows.length) return null;
  const [date, value] = rows.at(-1);
  const v = Number(value);
  return { rate: invert ? 1 / v : v, date };
}

async function main() {
  let previous = null;
  try { previous = JSON.parse(await readFile(OUT, "utf8")); } catch { /* first run */ }
  const rates = { ...(previous?.rates || {}) };
  const failed = [];
  for (const [cur, [series, invert]] of Object.entries(SERIES)) {
    try {
      const r = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${series}`, { signal: AbortSignal.timeout(20_000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const parsed = parseFred(await r.text(), invert);
      if (!parsed) throw new Error("no observations");
      rates[cur] = { ...parsed, series };
    } catch (error) {
      failed.push(`${cur}: ${error.message}`);
    }
  }
  const krw = rates.KRW;
  const out = {
    pair: "KRW per USD", rate: krw?.rate ?? previous?.rate ?? null, date: krw?.date ?? previous?.date ?? null,
    source: "FRED H.10 noon buying rates (DEXKOUS 외)", sourceUrl: "https://fred.stlouisfed.org/series/DEXKOUS",
    rates, generatedAt: new Date().toISOString(), failed,
  };
  await writeFile(`${OUT}.tmp`, `${JSON.stringify(out)}\n`);
  await rename(`${OUT}.tmp`, OUT);
  console.log(JSON.stringify({ tenbaggerFx: "written", currencies: Object.keys(rates).length, failed }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
