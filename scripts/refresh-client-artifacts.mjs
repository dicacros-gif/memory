#!/usr/bin/env node

/**
 * Rebuilds the browser-only data artifacts from the already verified database
 * bundle.  This is intentionally network-free: it is useful after a UI
 * contract change and never manufactures or refreshes market/news data.
 */
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildClientDataBundle } from "./crawl.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = (name) => resolve(root, "data", name);
const readJson = async (name) => JSON.parse(await readFile(dataPath(name), "utf8"));
const readBytes = async (name) => (await readFile(dataPath(name))).byteLength;
const consoleOnly = process.argv.includes("--console-only");

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

const [
  payload,
  quant,
  priceHistory,
  marketHistory,
  quantBacktest,
  quarantine,
  currentLandingDecision,
  currentSiteContent,
  currentSiteContentExtended,
  currentLandingDecisionBytes,
  currentSiteContentBytes,
  currentSiteContentExtendedBytes,
] = await Promise.all([
  readJson("live.json"),
  readJson("quant.json"),
  readJson("price-history.json"),
  readJson("market-history.json"),
  readJson("quant-backtest.json"),
  readJson("crawl-quarantine.json"),
  readJson("landing-decision-client.json"),
  readJson("site-content-client.json"),
  readJson("site-content-extended-client.json"),
  readBytes("landing-decision-client.json"),
  readBytes("site-content-client.json"),
  readBytes("site-content-extended-client.json"),
]);
const bundle = buildClientDataBundle({
  payload,
  quant,
  priceHistory,
  marketHistory,
  quantBacktest,
  quarantinedClaims: quarantine.items || [],
});
if (consoleOnly) {
  for (const artifact of [currentLandingDecision, currentSiteContent, currentSiteContentExtended]) {
    if (!artifact?.runId || artifact.runId !== payload.runId) {
      throw new Error("console-only refresh requires landing artifacts from the same verified runId");
    }
  }
  bundle.landingDecision = currentLandingDecision;
  bundle.siteContent = currentSiteContent;
  bundle.siteContentExtended = currentSiteContentExtended;
  bundle.manifest.artifacts.landingDecision.bytes = currentLandingDecisionBytes;
  bundle.manifest.artifacts.siteContent.bytes = currentSiteContentBytes;
  bundle.manifest.artifacts.siteContentExtended.bytes = currentSiteContentExtendedBytes;
  const revision = createHash("sha256").update(JSON.stringify({
    runId: payload.runId,
    landingDecision: currentLandingDecision,
    siteContent: currentSiteContent,
    siteContentExtended: currentSiteContentExtended,
    companyDirectory: bundle.companyDirectory,
  })).digest("hex").slice(0, 16);
  bundle.manifest.cacheVersion = `${payload.runId}-${revision}`;
}
if (!bundle.manifest.runId || bundle.manifest.runId !== payload.runId) {
  throw new Error("cannot build client artifacts without a matching verified runId");
}
const entries = [
  [dataPath("live-client.json"), bundle.live],
  [dataPath("quant-client.json"), bundle.quant],
  [dataPath("price-history-client.json"), bundle.priceHistory],
  [dataPath("market-history-client.json"), bundle.marketHistory],
  [dataPath("quant-backtest-client.json"), bundle.quantBacktest],
  [dataPath("decision-history-client.json"), bundle.decisionHistory],
  ...(!consoleOnly ? [
    [dataPath("landing-decision-client.json"), bundle.landingDecision],
    [dataPath("site-content-client.json"), bundle.siteContent],
    [dataPath("site-content-extended-client.json"), bundle.siteContentExtended],
  ] : []),
  [dataPath("company-directory-client.json"), bundle.companyDirectory],
  [dataPath("insight-ledger.json"), bundle.insightLedger],
  [dataPath("company-signals.json"), bundle.companySignals],
  [dataPath("memory-demand.json"), bundle.memoryDemand],
  [dataPath("silicon-map.json"), bundle.siliconMap],
  [dataPath("pain-points.json"), bundle.painPoints],
  [dataPath("org-signals.json"), bundle.orgSignals],
  [dataPath("data-manifest.json"), bundle.manifest],
];
await writeAtomically(entries);

console.log(JSON.stringify({
  ok: true,
  mode: consoleOnly ? "console-only" : "all-client-artifacts",
  runId: bundle.manifest.runId,
  artifactBytes: Object.fromEntries(Object.entries(bundle.manifest.artifacts).map(([id, item]) => [id, item.bytes])),
}, null, 2));
