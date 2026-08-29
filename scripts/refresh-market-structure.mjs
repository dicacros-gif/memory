#!/usr/bin/env node

/**
 * Rebuild the market KPI layer from the latest verified baseline and
 * Decision Intelligence bundle without making network requests.
 */
import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildMarketStructure } from "./crawl.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = (name) => resolve(root, "data", name);
const readJson = async (name) => JSON.parse(await readFile(dataPath(name), "utf8"));
const [live, quant, baseline] = await Promise.all([
  readJson("live.json"),
  readJson("quant.json"),
  readJson("baseline.json"),
]);

if (!live.runId || live.runId !== quant.runId) throw new Error("live/quant verified runId mismatch");
quant.marketStructure = buildMarketStructure(
  quant.marketStructure || {},
  baseline,
  quant.liveFigures || {},
  quant.decisionIntelligence || {},
);
live.quant = quant;

async function replaceJson(path, value) {
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

await Promise.all([
  replaceJson(dataPath("quant.json"), quant),
  replaceJson(dataPath("live.json"), live),
]);

const hbm = quant.marketStructure.kpis?.find((item) => /SKHY.*HBM.*점유/i.test(String(item.label || "")));
console.log(JSON.stringify({
  ok: true,
  runId: quant.runId,
  hbmShare: hbm?.value || null,
  period: hbm?.asOf || null,
  source: hbm?.source || null,
}, null, 2));
