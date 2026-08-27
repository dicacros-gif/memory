#!/usr/bin/env node

/**
 * Rebuilds the browser-only data artifacts from the already verified database
 * bundle.  This is intentionally network-free: it is useful after a UI
 * contract change and never manufactures or refreshes market/news data.
 */
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildClientDataBundle } from "./crawl.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = (name) => resolve(root, "data", name);
const readJson = async (name) => JSON.parse(await readFile(dataPath(name), "utf8"));

async function writeAtomically(entries = []) {
  const staged = [];
  try {
    for (const [path, value] of entries) {
      await mkdir(dirname(path), { recursive: true });
      const temporary = `${path}.${process.pid}.${Date.now()}.${staged.length}.tmp`;
      await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
      staged.push({ path, temporary });
    }
    for (const entry of staged) await rename(entry.temporary, entry.path);
  } catch (error) {
    await Promise.all(staged.map(({ temporary }) => rm(temporary, { force: true })));
    throw error;
  }
}

const [payload, quant, priceHistory, marketHistory, quantBacktest] = await Promise.all([
  readJson("live.json"),
  readJson("quant.json"),
  readJson("price-history.json"),
  readJson("market-history.json"),
  readJson("quant-backtest.json"),
]);
const bundle = buildClientDataBundle({ payload, quant, priceHistory, marketHistory, quantBacktest });
if (!bundle.manifest.runId || bundle.manifest.runId !== payload.runId) {
  throw new Error("cannot build client artifacts without a matching verified runId");
}
await writeAtomically([
  [dataPath("live-client.json"), bundle.live],
  [dataPath("quant-client.json"), bundle.quant],
  [dataPath("price-history-client.json"), bundle.priceHistory],
  [dataPath("market-history-client.json"), bundle.marketHistory],
  [dataPath("quant-backtest-client.json"), bundle.quantBacktest],
  [dataPath("decision-history-client.json"), bundle.decisionHistory],
  [dataPath("landing-decision-client.json"), bundle.landingDecision],
  [dataPath("site-content-client.json"), bundle.siteContent],
  [dataPath("site-content-extended-client.json"), bundle.siteContentExtended],
  [dataPath("company-directory-client.json"), bundle.companyDirectory],
  [dataPath("insight-ledger.json"), bundle.insightLedger],
  [dataPath("company-signals.json"), bundle.companySignals],
  [dataPath("memory-demand.json"), bundle.memoryDemand],
  [dataPath("silicon-map.json"), bundle.siliconMap],
  [dataPath("pain-points.json"), bundle.painPoints],
  [dataPath("data-manifest.json"), bundle.manifest],
]);

console.log(JSON.stringify({
  ok: true,
  runId: bundle.manifest.runId,
  artifactBytes: Object.fromEntries(Object.entries(bundle.manifest.artifacts).map(([id, item]) => [id, item.bytes])),
}, null, 2));
