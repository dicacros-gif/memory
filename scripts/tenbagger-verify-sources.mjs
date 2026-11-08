/**
 * Re-opens every source URL in data/tenbagger/universe.json and records
 * whether it is reachable and whether the cited figure appears on the page.
 * The research agents could not always re-open sources from their sandbox;
 * this check runs where the network is open (GitHub Actions) and is what the
 * page uses to tell a re-confirmed figure from a merely cited one.
 * Runs at most weekly unless --force.
 */
import { readFile, writeFile, rename } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const UNIVERSE = resolve(root, "data/tenbagger/universe.json");
const OUT = resolve(root, "data/tenbagger/source-checks.json");
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const WEEK = 7 * 864e5;

/** Figures a page should contain for the claim to count as re-confirmed. */
export function figureTokens(value) {
  if (value === null || value === undefined) return [];
  if (typeof value === "number") {
    const out = [String(value)];
    if (value >= 1e9) out.push(String(Number((value / 1e9).toFixed(1))).replace(/\.0$/, ""));
    else if (value >= 1e6) out.push(String(Number((value / 1e6).toFixed(1))).replace(/\.0$/, ""));
    return out;
  }
  return [...String(value).matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => m[0]).filter((t) => t.replace(/\D/g, "").length >= 2);
}

export function claims(universe = {}) {
  const out = [];
  for (const s of universe.sectors || []) {
    for (const g of s.growth || []) out.push({ url: g.url, tokens: figureTokens(g.targetValue) });
    for (const c of s.publicCompanies || []) out.push({ url: c.sourceUrl, tokens: [] });
    for (const x of s.startups || []) {
      if (x.valuationUrl) out.push({ url: x.valuationUrl, tokens: figureTokens(x.valuationUsd) });
      for (const h of x.holders || []) out.push({ url: h.url, tokens: [...figureTokens(h.pctOwned), ...figureTokens(h.amountUsd)] });
    }
  }
  for (const c of universe.history?.cases || []) out.push({ url: c.url, tokens: [] });
  return out.filter((c) => /^https?:\/\//.test(c.url || ""));
}

export function textFound(html = "", tokens = []) {
  if (!tokens.length) return null;
  const text = String(html).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
  return tokens.some((t) => text.includes(t) || text.includes(t.replace(/,/g, "")));
}

async function main() {
  const force = process.argv.includes("--force");
  let previous = null;
  try { previous = JSON.parse(await readFile(OUT, "utf8")); } catch { /* first run */ }
  if (!force && previous?.checkedAt && Date.now() - Date.parse(previous.checkedAt) < WEEK) {
    console.log(JSON.stringify({ tenbaggerSources: "fresh", checkedAt: previous.checkedAt }));
    return;
  }
  const universe = JSON.parse(await readFile(UNIVERSE, "utf8"));
  const byUrl = new Map();
  for (const claim of claims(universe)) {
    const entry = byUrl.get(claim.url) || { url: claim.url, tokens: new Set() };
    claim.tokens.forEach((t) => entry.tokens.add(t));
    byUrl.set(claim.url, entry);
  }
  const entries = [...byUrl.values()];
  const results = {};
  let next = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < entries.length) {
      const { url, tokens } = entries[next++];
      try {
        const response = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,application/pdf;q=0.9,*/*;q=0.8" }, redirect: "follow", signal: AbortSignal.timeout(20_000) });
        const type = response.headers.get("content-type") || "";
        const body = /html|text|json/.test(type) ? await response.text() : "";
        results[url] = { status: response.status, ok: response.ok, figureFound: response.ok ? textFound(body, [...tokens]) : null };
      } catch (error) {
        results[url] = { status: 0, ok: false, figureFound: null, error: String(error.message || error).slice(0, 120) };
      }
    }
  }));
  const out = { checkedAt: new Date().toISOString(), urls: entries.length, reachable: Object.values(results).filter((r) => r.ok).length, results };
  await writeFile(`${OUT}.tmp`, `${JSON.stringify(out, null, 2)}\n`);
  await rename(`${OUT}.tmp`, OUT);
  console.log(JSON.stringify({ tenbaggerSources: "written", urls: out.urls, reachable: out.reachable }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
