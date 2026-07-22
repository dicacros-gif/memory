// Accumulate broker/authority research citations into data/research-archive.json.
// Sources: current data/live.json PLUS every past version of data/live.json in
// git history, so previously-shown citations are recovered and never dropped.
// This file is owned by the update loop (the crawler never overwrites it).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const RESEARCH_SOURCE_RE = /morgan stanley|goldman|jpmorgan|\bciti\b|\bubs\b|counterpoint|trendforce|techinsights|\byole\b|semianalysis|bloomberg|reuters|nikkei|digitimes|mizuho|nomura|jefferies|omdia|gartner|\bidc\b|ee times|semiconductor engineering/i;

function normUrl(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const u = new URL(raw);
    u.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach((k) => u.searchParams.delete(k));
    return u.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return raw.replace(/#.*$/, "").replace(/\/$/, "").toLowerCase();
  }
}

function citationsFrom(live) {
  const out = [];
  for (const n of live?.news || []) {
    const url = String(n.link || n.sourceUrl || "");
    if (!/^https?:\/\//.test(url)) continue;
    const hay = `${n.source || ""} ${n.title || ""} ${n.originalTitle || ""} ${n.summary || ""}`;
    if (!RESEARCH_SOURCE_RE.test(hay)) continue;
    out.push({
      title: n.titleKo || n.title || "",
      source: n.source || "",
      url,
      date: String(n.date || n.publishedAt || "").slice(0, 10),
      level: n.verification?.evidenceLevel || "",
    });
  }
  return out;
}

const merged = new Map();
function ingest(list) {
  for (const c of list) {
    const key = normUrl(c.url);
    if (!key) continue;
    const prev = merged.get(key);
    // Keep the earliest first-seen date but the richest title/source.
    if (!prev) { merged.set(key, { ...c, urlKey: key }); continue; }
    if (!prev.title && c.title) prev.title = c.title;
    if (!prev.source && c.source) prev.source = c.source;
    if (!prev.date && c.date) prev.date = c.date;
  }
}

// 1) Existing archive (preserve accumulated entries).
if (existsSync("data/research-archive.json")) {
  try { ingest(JSON.parse(readFileSync("data/research-archive.json", "utf8")).items || []); } catch {}
}

// 2) Historical versions of live.json from git (recover previously-shown items).
let commits = [];
try {
  commits = execSync("git log --format=%H -- data/live.json", { encoding: "utf8" })
    .split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 60);
} catch {}
for (const sha of commits) {
  try {
    const blob = execSync(`git show ${sha}:data/live.json`, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    ingest(citationsFrom(JSON.parse(blob)));
  } catch {}
}

// 3) Current working-tree live.json (freshest crawl).
try { ingest(citationsFrom(JSON.parse(readFileSync("data/live.json", "utf8")))); } catch {}

const items = [...merged.values()]
  .filter((c) => c.url && c.title)
  .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

writeFileSync("data/research-archive.json", JSON.stringify({
  note: "Accumulating broker/authority research citations. Owned by the update loop; crawler does not overwrite. Recovered from live.json history + each fresh crawl.",
  updatedAt: new Date().toISOString().slice(0, 10),
  count: items.length,
  items,
}, null, 2) + "\n");

console.log(`research-archive.json: ${items.length} accumulated citations from ${commits.length} historical commits`);
