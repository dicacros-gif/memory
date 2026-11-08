import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Integrity audit for the ten-bagger data. Fails (exit 1) on:
 *   - a file that is not strict JSON (NaN/Infinity written by Python fail here)
 *   - duplicate listing tickers inside one industry, or one id for two tickers
 *   - a stake without a date or a source URL
 *   - a private company that carries a listing ticker
 *   - a reporting period or measurement date in the future
 *   - a non-finite number in a numeric field
 * Run in check:fast against the committed files and in the pipeline before
 * the ten-bagger artifacts are committed.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = resolve(root, "data/tenbagger");

export function auditUniverse(universe, today = new Date().toISOString().slice(0, 10)) {
  const problems = [];
  for (const s of universe.sectors || []) {
    const seen = new Set();
    for (const c of s.publicCompanies || []) {
      if (seen.has(c.ticker)) problems.push(`duplicate ticker in ${s.id}: ${c.ticker}`);
      seen.add(c.ticker);
    }
    for (const st of s.startups || []) {
      const listed = st.status === "listed" || st.entityType === "listed";
      if (st.ticker && !listed) problems.push(`private company with a ticker: ${st.name} (${st.ticker})`);
      for (const h of st.holders || []) {
        if (!h.asOf) problems.push(`stake without a date: ${st.name} ← ${h.holder}`);
        if (!/^https?:\/\//.test(h.url || "")) problems.push(`stake without a source: ${st.name} ← ${h.holder}`);
        if (h.asOf && h.asOf > today) problems.push(`future-dated stake: ${st.name} ← ${h.holder} ${h.asOf}`);
        if (h.pctOwned !== null && h.pctOwned !== undefined && !(Number.isFinite(h.pctOwned) && h.pctOwned > 0 && h.pctOwned <= 100)) problems.push(`invalid stake %: ${st.name} ← ${h.holder}`);
      }
    }
    for (const g of s.growth || []) if (g.publishedAt && g.publishedAt > today) problems.push(`future-dated forecast: ${s.id} ${g.institution}`);
  }
  return problems;
}

export function auditCompanies(doc, today = new Date().toISOString().slice(0, 10)) {
  const problems = [];
  const ids = new Map();
  for (const c of doc?.companies || []) {
    if (ids.has(c.id) && ids.get(c.id) !== c.ticker) problems.push(`id ${c.id} maps to ${ids.get(c.id)} and ${c.ticker}`);
    ids.set(c.id, c.ticker);
    for (const key of ["revenueEnd", "balanceSheetEnd"]) if (c[key] && c[key] > today) problems.push(`future period ${key} ${c[key]}: ${c.ticker}`);
  }
  return problems;
}

/** Any number in the tree that is not finite (only possible from hand-built objects). */
export function nonFinite(value, path = "$", out = []) {
  if (typeof value === "number" && !Number.isFinite(value)) out.push(path);
  else if (Array.isArray(value)) value.forEach((v, i) => nonFinite(v, `${path}[${i}]`, out));
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) nonFinite(v, `${path}.${k}`, out);
  return out;
}

async function main() {
  const problems = [];
  const files = (await readdir(DIR)).filter((f) => f.endsWith(".json") && !f.endsWith("-cache.json"));
  const docs = {};
  for (const f of files) {
    try { docs[f] = JSON.parse(await readFile(resolve(DIR, f), "utf8")); } catch (error) { problems.push(`${f}: not strict JSON (${error.message})`); }
  }
  for (const sub of ["bars"]) {
    let names = [];
    try { names = (await readdir(resolve(DIR, sub))).filter((f) => f.endsWith(".json")); } catch { /* none yet */ }
    for (const f of names) {
      try { JSON.parse(await readFile(resolve(DIR, sub, f), "utf8")); } catch (error) { problems.push(`${sub}/${f}: not strict JSON (${error.message})`); }
    }
  }
  if (docs["universe.json"]) problems.push(...auditUniverse(docs["universe.json"]));
  if (docs["companies.json"]) problems.push(...auditCompanies(docs["companies.json"]));
  for (const [f, d] of Object.entries(docs)) for (const p of nonFinite(d).slice(0, 5)) problems.push(`${f}: non-finite number at ${p}`);
  if (problems.length) {
    for (const p of problems.slice(0, 50)) console.log(`::error::ten-bagger audit: ${p}`);
    console.log(JSON.stringify({ tenbaggerAudit: "failed", problems: problems.length }));
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify({ tenbaggerAudit: "pass", files: files.length }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
