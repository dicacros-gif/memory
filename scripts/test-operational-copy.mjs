/**
 * Operational-copy gate.
 *
 * The site exists to surface insight and strategy, so pipeline bookkeeping must
 * never reach a reader: observation counts, crawl vocabulary, evidence tallies,
 * audit wiring status, and empty-state placeholders. Rendered markup, the
 * template literals that produce copy, and the client-facing data files are all
 * checked, because any of the three can put such a phrase on screen.
 */
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { BANNED_READER_COPY, NEGATED_READER_COPY } from "./reader-copy-rules.mjs";

const PAGES = ["index.html", "console/index.html"];
const MODELS = [
  "data/strategy-experience.json",
  "data/strategy-spine.json",
  "data/mbb-frames.json",
  "data/capital-plans.json",
];

const rel = (file) => new URL(`../${file}`, import.meta.url);

// Scan only what a page actually loads. Bundles that no page references can
// still sit in the repo, and their copy never reaches a reader, so gating them
// would fail on dead code instead of on the site.
async function loadedSources() {
  const scripts = new Set();
  const pages = [];
  for (const page of PAGES) {
    let html;
    try {
      html = await readFile(rel(page), "utf8");
    } catch {
      continue;
    }
    pages.push(page);
    for (const match of html.matchAll(/<script[^>]+src="([^"]+)"/g)) {
      const src = match[1].split("?")[0].replace(/^\.\.\//, "").replace(/^\.\//, "");
      if (!src.endsWith(".js")) continue;
      scripts.add(src.replace(/\.min\.js$/, ".js"));
    }
  }

  // A bundle can pull in modules and load further chunks at runtime, and their
  // copy reaches the same screen, so follow both one level out.
  for (const entry of [...scripts]) {
    let source;
    try {
      source = await readFile(rel(entry), "utf8");
    } catch {
      continue;
    }
    for (const match of source.matchAll(/from\s+"\.\/([\w.-]+\.js)"/g)) scripts.add(`assets/js/${match[1]}`);
    for (const match of source.matchAll(/assets\/js\/([\w-]+)\.min\.js/g)) scripts.add(`assets/js/${match[1]}.js`);
  }

  return [...pages, ...scripts, ...MODELS];
}

const SOURCES = await loadedSources();

const BANNED = BANNED_READER_COPY;

// Policy prose that names a banned phrase in order to forbid it, and the gate's
// own vocabulary, are not reader-facing copy.
const ALLOW_LINE = /eslint|@ts-|https?:\/\/|BANNED|ALLOW_LINE|NEGATED|test-operational-copy/;

// Negated mentions state what a screen deliberately omits (shared rule).
const NEGATED = NEGATED_READER_COPY;

const findings = [];
let scanned = 0;

for (const file of SOURCES) {
  let text;
  try {
    text = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
  } catch {
    continue; // A source that has been retired is not a failure.
  }
  scanned++;
  const lines = text.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    if (ALLOW_LINE.test(line)) continue;
    // Source comments never reach a reader.
    if (/^\s*(?:\/\/|\*|\/\*)/.test(line)) continue;
    for (const banned of BANNED) {
      banned.re.lastIndex = 0;
      let match;
      while ((match = banned.re.exec(line))) {
        if (NEGATED.test(line.slice(match.index + match[0].length, match.index + match[0].length + 14))) continue;
        findings.push({
          file,
          line: index + 1,
          id: banned.id,
          phrase: match[0].trim(),
          why: banned.why,
          context: line.trim().slice(Math.max(0, match.index - 40), match.index + 60).slice(0, 100),
        });
      }
    }
  }
}

if (findings.length) {
  console.error(`operational copy on reader-facing surfaces (${findings.length}):`);
  for (const f of findings.slice(0, 30)) console.error(`  ${f.file}:${f.line}  [${f.id}] "${f.phrase}" — ${f.why}`);
}
console.log(JSON.stringify({ scanned, findings: findings.length }));
assert.equal(findings.length, 0, "reader-facing copy must carry insight and strategy, not pipeline bookkeeping");

// Console links keep their semantic source labels, but never expose a standalone
// external-link glyph. The glyph was visually rendered as `[ ↗]` in some cards.
const consoleLinkSources = [
  "assets/js/app.js",
  "assets/js/company-profile.js",
  "assets/js/account-one-pagers.js",
];
for (const file of consoleLinkSources) {
  const source = await readFile(rel(file), "utf8");
  assert.doesNotMatch(source, /↗/, `${file} must not render external-link arrow markers`);
}
