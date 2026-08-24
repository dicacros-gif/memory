import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceFiles = [
  "assets/js/landing.js",
  "assets/js/app.js",
  "assets/js/company-profile.js",
  "assets/css/landing.css",
  "assets/css/styles.css",
  "assets/css/company-profile.css",
];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

export function normalizeForHash(text) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/infra-(?:[a-f0-9]{12}|[0-9]{8}-[0-9]{2})/gi, "infra-REVISION");
}

export function computeClientRevision() {
  const hash = crypto.createHash("sha256");
  for (const relativePath of sourceFiles) {
    hash.update(relativePath);
    hash.update("\0");
    hash.update(normalizeForHash(read(relativePath)));
    hash.update("\0");
  }
  return `infra-${hash.digest("hex").slice(0, 12)}`;
}

function replaceRevision(relativePath, revision) {
  const target = path.join(root, relativePath);
  const source = fs.readFileSync(target, "utf8");
  const next = source.replace(/infra-(?:[a-f0-9]{12}|[0-9]{8}-[0-9]{2})/gi, revision);
  if (source !== next) fs.writeFileSync(target, next, "utf8");
}

export function syncClientRevision() {
  const revision = computeClientRevision();
  replaceRevision("assets/js/landing.js", revision);
  replaceRevision("index.html", revision);
  replaceRevision("console/index.html", revision);
  process.stdout.write(`${revision}\n`);
  return revision;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  syncClientRevision();
}
