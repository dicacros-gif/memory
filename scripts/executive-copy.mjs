import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { executiveBulletCopy } from "../assets/js/executive-copy-core.js";

export { executiveBulletCopy } from "../assets/js/executive-copy-core.js";

export function normalizeHtmlExecutiveCopy(markup = "") {
  const blocks = [];
  const masked = String(markup).replace(/<(script|style|code|pre|textarea|option|q|blockquote)\b[\s\S]*?<\/\1>/gi, (block) => {
    const token = `\u0000EXECUTIVE_COPY_BLOCK_${blocks.length}\u0000`;
    blocks.push(block);
    return token;
  });
  const normalized = masked.replace(/>([^<>]+)</g, (match, text) => `>${executiveBulletCopy(text)}<`);
  return normalized.replace(/\u0000EXECUTIVE_COPY_BLOCK_(\d+)\u0000/g, (_, index) => blocks[Number(index)] || "");
}

if (process.argv.includes("--write-index")) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const file = resolve(root, "index.html");
  const current = readFileSync(file, "utf8");
  const normalized = normalizeHtmlExecutiveCopy(current);
  if (normalized !== current) writeFileSync(file, normalized, "utf8");
}
