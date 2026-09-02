#!/usr/bin/env node
// Inventory reader-facing citations, including lazy-loaded panels and archives.
// Network failures are observations, never authority to delete source evidence.
import { readFileSync, existsSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { classifyLinkResponse, NON_PUBLIC_LINK_FIELDS } from "./public-link-policy.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const option = (name, fallback) => args.find(a => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=") || fallback;
const output = resolve(root, option("output", ".tmp/public-link-audit.json"));
const network = args.includes("--network");
const only = option("host", "");
const max = Number(option("max", "0"));
const decode = value => value.replace(/&amp;/g, "&").replace(/&#(?:0*39|x27);/g, "'").trim();
const records = new Map();
const local = [];
const files = new Set(["index.html", "console/index.html"]);
const excluded = new Set(["data/crawl-audit.json", "data/crawl-exclusions.json", "data/refresh-status.json", "data/quant.json"]);
const owners = ["accounts", "company-baseline", "source-catalog", "console-capital-plans-source", "console-chip-roadmap-source", "site-content-model", "chip-roadmap", "capital-plans", "quant-model", "intelligence-policy"];
for (const name of owners) files.add(`data/${name}.json`);
for (const entry of Object.values(JSON.parse(readFileSync(resolve(root, "data/data-manifest.json"), "utf8")).artifacts)) files.add(entry.path);
const scripts = readdirSync(resolve(root, "assets/js")).filter(n => n.endsWith(".js") && !n.endsWith(".min.js"));
for (const name of scripts) {
  const file = `assets/js/${name}`;
  files.add(file);
  const text = readFileSync(resolve(root, file), "utf8");
  for (const match of text.matchAll(/["'`](data\/[\w-]+\.json)["'`]/g)) if (!excluded.has(match[1])) files.add(match[1]);
}
function add(value, file, path, label = "") {
  if (typeof value !== "string") return;
  const url = decode(value);
  if (!/^https?:\/\//i.test(url)) return;
  let parsed;
  try { parsed = new URL(url); } catch { return; }
  // Fragments do not affect HTTP reachability. Keep the original in occurrences.
  parsed.hash = "";
  const key = parsed.href;
  if (!records.has(key)) records.set(key, { url: key, occurrences: [] });
  const occurrence = { file, path, label: String(label).slice(0, 240), href: url };
  records.get(key).occurrences.push(occurrence);
}
function walk(value, file, path = "") {
  if (Array.isArray(value)) return value.forEach((v, i) => walk(v, file, `${path}[${i}]`));
  if (typeof value === "string" && /^https?:\/\//i.test(value)) return add(value, file, path);
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (NON_PUBLIC_LINK_FIELDS.has(key)) continue;
    if (/^(?:link|href|.*url)$/i.test(key) && !/logo|image|icon|feed|endpoint/i.test(key)) {
      add(child, file, `${path}.${key}`, value.label || value.title || value.name || value.source || "");
    } else if (typeof child === "object") walk(child, file, `${path}.${key}`);
  }
}
for (const file of files) {
  if (!existsSync(resolve(root, file))) continue;
  const text = readFileSync(resolve(root, file), "utf8");
  if (file.endsWith(".json")) walk(JSON.parse(text), file);
  else {
    if (file.endsWith(".js")) for (const match of text.matchAll(/["'`](https?:\/\/[^"'`\s<>]+)["'`]/g)) {
      if (!match[1].includes("${") && !/\.(?:png|jpe?g|svg|webp|mp4|woff2?)(?:[?#]|$)/i.test(match[1])) add(match[1], file, `offset:${match.index}`);
    }
    for (const match of text.matchAll(/\bhref\s*=\s*["']([^"']+)["']/g)) {
    const href = decode(match[1]);
    if (/\$\{|<%/.test(href)) continue;
    add(href, file, `offset:${match.index}`);
    if (!file.endsWith(".html") || /^(https?:|mailto:|tel:|data:|javascript:)/i.test(href)) continue;
    const target = new URL(href, `https://site.invalid/${file}`);
    const targetPath = target.pathname.endsWith("/") ? `${target.pathname}index.html` : target.pathname;
    const disk = resolve(root, `.${targetPath}`);
    let status = existsSync(disk) ? "ok" : "missing-file";
    if (status === "ok" && target.hash && disk.endsWith(".html")) {
      const id = decodeURIComponent(target.hash.slice(1));
      const html = readFileSync(disk, "utf8");
      if (!html.includes(`id="${id}"`) && !html.includes(`id='${id}'`)) status = "dynamic-anchor-review";
    }
    local.push({ file, href, target: relative(root, disk), status });
    }
  }
}
let items = [...records.values()].sort((a, b) => {
  const authored = item => item.occurrences.some(o => owners.some(n => o.file === `data/${n}.json`));
  return Number(authored(b)) - Number(authored(a)) || a.url.localeCompare(b.url);
});
if (only) items = items.filter(item => new URL(item.url).hostname.includes(only));
if (max) items = items.slice(0, max);
let previous = {};
if (args.includes("--resume") && existsSync(output)) previous = Object.fromEntries(JSON.parse(readFileSync(output, "utf8")).external.map(item => [item.url, item]));
let complete = 0;
const save = () => {
  const counts = {};
  for (const item of items) counts[item.status || "unchecked"] = (counts[item.status || "unchecked"] || 0) + 1;
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify({ checkedAt: new Date().toISOString(), scope: [...files].sort(), counts, local, external: items }, null, 2) + "\n");
  return counts;
};
async function probe(item) {
  const cached = previous[item.url];
  if (cached?.checkedAt && !(args.includes("--retry-errors") && ["network-error", "server-error"].includes(cached.status))) {
    Object.assign(item, { ...cached, occurrences: item.occurrences }); return;
  }
  try {
    const response = await fetch(item.url, { signal: AbortSignal.timeout(14000), redirect: "follow", headers: {
      "user-agent": "Mozilla/5.0 (compatible; MemorySourceLinkAudit/1.0)", accept: "text/html,application/pdf;q=0.9,*/*;q=0.8",
    } });
    let body = "";
    if (/text\/html|application\/xhtml/.test(response.headers.get("content-type") || "")) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      try {
        while (body.length < 180000) {
          const { done, value } = await reader.read();
          if (done) break;
          body += decoder.decode(value, { stream: true });
          if (body.includes("</title>") && body.length > 24000) break;
        }
      } finally { await reader.cancel().catch(() => {}); }
    } else await response.body?.cancel();
    item.httpStatus = response.status;
    item.finalUrl = response.url;
    item.title = decode(body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ") || "");
    item.status = classifyLinkResponse({ status: response.status, title: item.title, finalUrl: response.url, url: item.url });
  } catch (error) { item.status = "network-error"; item.error = error.cause?.code || error.name || "fetch-failed"; }
  item.checkedAt = new Date().toISOString();
}
if (network) {
  let cursor = 0;
  console.log(`Checking ${items.length} unique source URLs; ${local.length} local links.`);
  await Promise.all(Array.from({ length: Number(option("concurrency", "10")) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      await probe(item);
      if (++complete % 50 === 0) console.log(JSON.stringify({ complete, total: items.length, counts: save() }));
    }
  }));
}
console.log(JSON.stringify({ report: relative(root, output), uniqueExternal: items.length, local: local.length, counts: save(), localIssues: local.filter(l => l.status !== "ok") }, null, 2));
