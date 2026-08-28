import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function collect(relativeDir, extensions) {
  const absoluteDir = path.join(root, relativeDir);
  if (!fs.existsSync(absoluteDir)) return [];
  return fs.readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.posix.join(relativeDir.replaceAll("\\", "/"), entry.name);
    if (entry.isDirectory()) return collect(relativePath, extensions);
    return extensions.has(path.extname(entry.name).toLowerCase()) ? [relativePath] : [];
  });
}

const files = [
  "index.html",
  "console/index.html",
  "scripts/prerender-decision.mjs",
  ...collect("assets/css", new Set([".css"])),
  ...collect("assets/js", new Set([".js"])),
  ...collect("assets/icons", new Set([".svg"])),
];

const approvedFamilies = new Set(["noto sans kr", "pretendard", "helvetica", "roboto"]);
const globalKeywords = new Set(["inherit", "initial", "revert", "revert-layer", "unset"]);
const bannedFamilies = [
  "Arial Narrow",
  "Roboto Condensed",
  "Pretendard Variable",
  "Times New Roman",
  "Liberation Mono",
  "SFMono-Regular",
  "ui-monospace",
  "system-ui",
  "sans-serif",
  "monospace",
  "Consolas",
  "Courier New",
  "Courier",
  "Georgia",
  "Segoe UI",
  "Arial",
  "Inter",
  "serif",
  "cursive",
  "fantasy",
  "fangsong",
];

function splitTopLevelCommas(value) {
  const parts = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (quote) {
      if (char === quote && value[index - 1] !== "\\") quote = "";
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === "(") depth += 1;
    else if (char === ")") depth = Math.max(0, depth - 1);
    else if (char === "," && depth === 0) {
      parts.push(value.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(value.slice(start));
  return parts;
}

function literalFamilyCandidates(value) {
  let normalized = value.replace(/!important/gi, "").trim();
  let previous = "";
  while (normalized !== previous) {
    previous = normalized;
    normalized = normalized
      .replace(/var\(\s*--[-\w]+\s*\)/gi, "")
      .replace(/var\(\s*--[-\w]+\s*,\s*([^()]+)\)/gi, "$1");
  }
  return splitTopLevelCommas(normalized)
    .map((candidate) => candidate.trim().replace(/^["']|["']$/g, "").trim())
    .filter(Boolean)
    .filter((candidate) => !candidate.startsWith("var("));
}

const violations = [];
const declarationPatterns = [
  /font-family\s*:\s*([^;}{]+)/gi,
  /--(?:type-(?:display|body|ui|data)|font|sans|display|mono|business-font|business-display|business-mono)\s*:\s*([^;}{]+)/gi,
];

for (const relativePath of files) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  for (const pattern of declarationPatterns) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      const declaration = match[1];
      for (const family of bannedFamilies) {
        const escaped = family.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (new RegExp(`(?<![A-Za-z])${escaped}(?![A-Za-z])`, "i").test(declaration)) {
          violations.push(`${relativePath}: ${family}`);
        }
      }
      for (const candidate of literalFamilyCandidates(declaration)) {
        const normalized = candidate.toLowerCase();
        if (!approvedFamilies.has(normalized) && !globalKeywords.has(normalized)) {
          violations.push(`${relativePath}: unapproved family ${JSON.stringify(candidate)}`);
        }
      }
    }
  }
  if (/pretendardvariable|\/variable\/pretendard/i.test(source)) {
    violations.push(`${relativePath}: Pretendard Variable loader`);
  }
}

const uniqueViolations = [...new Set(violations)];
assert.deepEqual(uniqueViolations, [], `unapproved font families found:\n${uniqueViolations.join("\n")}`);

const brand = fs.readFileSync(path.join(root, "assets/css/brand-system.css"), "utf8");
for (const contract of [
  '--type-display: Helvetica, Pretendard, "Noto Sans KR", Roboto;',
  '--type-body: Roboto, "Noto Sans KR", Pretendard, Helvetica;',
  '--type-ui: Roboto, "Noto Sans KR", Pretendard, Helvetica;',
  '--type-data: Roboto, Helvetica, Pretendard, "Noto Sans KR";',
]) {
  assert.ok(brand.includes(contract), `missing typography role contract: ${contract}`);
}

const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const prerender = fs.readFileSync(path.join(root, "scripts/prerender-decision.mjs"), "utf8");
const landing = fs.readFileSync(path.join(root, "assets/js/landing.js"), "utf8");
const app = fs.readFileSync(path.join(root, "assets/js/app.js"), "utf8");
const landingCss = fs.readFileSync(path.join(root, "assets/css/landing.css"), "utf8");
const consoleCss = fs.readFileSync(path.join(root, "assets/css/styles.css"), "utf8");
assert.match(index, /assets\/css\/brand-system\.min\.css\?v=infra-[a-f0-9]{12}/);
assert.match(prerender, /assets\/css\/brand-system\.min\.css\?v=\$\{clientRevision\}/);
for (const source of [landing, app, prerender]) {
  assert.match(source, /dataset\.approvedFace|data-approved-face/);
  assert.match(source, /pretendard@v1\.3\.9\/dist\/web\/static\/pretendard\.css/);
  assert.match(source, /family=Noto\+Sans\+KR/);
  assert.match(source, /family=Roboto/);
}

for (const source of [landingCss, consoleCss]) {
  assert.doesNotMatch(source, /--(?:display|mono|sans|business-mono)\s*:\s*var\(--font\)/);
  assert.doesNotMatch(source, /font-family\s*:\s*var\(--font\)\s*!important/);
}

assert.match(consoleCss, /\.projection-account-tab dt[\s\S]*?white-space:\s*nowrap;/);
assert.match(consoleCss, /\.projection-account-stat strong[\s\S]*?font-size:\s*18px/);

for (const relativePath of [
  "assets/js/company-profile.js",
  "assets/js/mbb-frames.js",
  "assets/js/workload-translation.js",
  "assets/js/strategy-spine.js",
]) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  assert.match(source, /insertBefore\(link, brandStyles \|\| null\)/, `${relativePath} must load before the brand system`);
}

console.log(JSON.stringify({
  status: "approved-fonts-only",
  families: ["Noto Sans KR", "Pretendard", "Helvetica", "Roboto"],
  scannedFiles: files.length,
}, null, 2));
