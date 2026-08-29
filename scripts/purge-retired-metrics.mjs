#!/usr/bin/env node

import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { purgeRetiredCombinedHbm4Artifacts } from "./retired-metrics.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = (name) => resolve(root, "data", name);

const contracts = [
  ["baseline.json", "baseline"],
  ["quant.json", "quant"],
  ["live.json", "payload"],
  ["market-history.json", "marketHistory"],
  ["quant-backtest.json", "quantBacktest"],
  ["quant-client.json", "quant"],
];

async function writeAtomically(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

const report = {};
for (const [name, contract] of contracts) {
  const path = dataPath(name);
  const source = await readFile(path, "utf8");
  const value = JSON.parse(source);
  const removedPaths = purgeRetiredCombinedHbm4Artifacts({ [contract]: value });
  const next = `${JSON.stringify(value, null, 2)}\n`;
  if (next !== source) await writeAtomically(path, value);
  report[name] = { changed: next !== source, removedPaths };
}

console.log(JSON.stringify({ ok: true, files: report }, null, 2));

