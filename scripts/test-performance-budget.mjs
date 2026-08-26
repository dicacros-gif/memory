import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const root = new URL("../", import.meta.url);
const paths = {
  html: "index.html",
  css: "assets/css/strategy-experience.css",
  minCss: "assets/css/strategy-experience.min.css",
  js: "assets/js/strategy-experience.js",
  minJs: "assets/js/strategy-experience.min.js",
};

const entries = await Promise.all(Object.entries(paths).map(async ([key, relativePath]) => {
  const url = new URL(relativePath, root);
  const [buffer, info] = await Promise.all([readFile(url), stat(url)]);
  return [key, { text: buffer.toString("utf8"), bytes: info.size, gzipBytes: gzipSync(buffer).byteLength }];
}));
const files = Object.fromEntries(entries);

assert.match(files.html.text, /assets\/css\/strategy-experience\.min\.css\?v=infra-[a-f0-9]{12}/);
assert.match(files.html.text, /assets\/js\/strategy-experience\.min\.js\?v=infra-[a-f0-9]{12}/);
assert.equal((files.html.text.match(/<link\b[^>]*rel="stylesheet"/g) || []).length, 1, "initial view must load one stylesheet");
assert.equal((files.html.text.match(/<script\b[^>]*src=/g) || []).length, 1, "initial view must load one script");
assert.doesNotMatch(files.html.text, /data\/(?:live|quant|site-content|company-directory)[^"']+\.json/, "large data artifacts must remain lazy");
assert.doesNotMatch(files.minJs.text, /\brequire\s*\(|\bimport\s+(?:\{|\*|["'])/, "browser bundle must not retain CommonJS or ESM imports");
assert.match(files.minJs.text, /^\(\(\)=>\{/, "active JavaScript must ship as a self-contained browser IIFE");

for (const [sourceKey, minKey] of [["css", "minCss"], ["js", "minJs"]]) {
  assert.ok(files[minKey].bytes < files[sourceKey].bytes * .9, `${minKey} must save at least 10% raw bytes`);
  assert.ok(files[minKey].gzipBytes < files[sourceKey].gzipBytes, `${minKey} must reduce gzip transfer size`);
}

assert.ok(files.html.gzipBytes < 15 * 1024, "HTML gzip budget must stay below 15KiB");
assert.ok(files.minCss.gzipBytes < 8 * 1024, "active CSS gzip budget must stay below 8KiB");
assert.ok(files.minJs.gzipBytes < 8 * 1024, "active JavaScript gzip budget must stay below 8KiB");
const initialGzipBytes = files.html.gzipBytes + files.minCss.gzipBytes + files.minJs.gzipBytes;
assert.ok(initialGzipBytes < 32 * 1024, "initial HTML/CSS/JS payload must stay below 32KiB gzip");

console.log(JSON.stringify({
  initialGzipKb: Number((initialGzipBytes / 1024).toFixed(1)),
  htmlGzipKb: Number((files.html.gzipBytes / 1024).toFixed(1)),
  cssGzipKb: Number((files.minCss.gzipBytes / 1024).toFixed(1)),
  jsGzipKb: Number((files.minJs.gzipBytes / 1024).toFixed(1)),
  initialRequests: 3,
}, null, 2));
