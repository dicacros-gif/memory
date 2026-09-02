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
import { applyPublicLinkPolicy } from "./public-link-policy.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = (name) => resolve(root, "data", name);
const readJson = async (name) => JSON.parse(await readFile(dataPath(name), "utf8"));
const serializedJsonBytes = (value) => Buffer.byteLength(`${JSON.stringify(value, null, 2)}\n`, "utf8");
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
  currentManifest,
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
  readJson("data-manifest.json"),
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
  bundle.landingDecision = applyPublicLinkPolicy(currentLandingDecision);
  bundle.siteContent = applyPublicLinkPolicy(currentSiteContent);
  bundle.siteContentExtended = applyPublicLinkPolicy(currentSiteContentExtended);
  bundle.manifest.artifacts.landingDecision.bytes = serializedJsonBytes(bundle.landingDecision);
  bundle.manifest.artifacts.siteContent.bytes = serializedJsonBytes(bundle.siteContent);
  bundle.manifest.artifacts.siteContentExtended.bytes = serializedJsonBytes(bundle.siteContentExtended);
  const revision = createHash("sha256").update(JSON.stringify({
    runId: payload.runId,
    landingDecision: bundle.landingDecision,
    siteContent: bundle.siteContent,
    siteContentExtended: bundle.siteContentExtended,
    companyDirectory: bundle.companyDirectory,
  })).digest("hex").slice(0, 16);
  bundle.manifest.cacheVersion = `${payload.runId}-${revision}`;
  // This maintenance command does not rebuild the prerendered executive or
  // Console snapshots. Preserve their manifest contracts instead of silently
  // dropping valid artifacts owned by the later prerender step.
  for (const id of ["executiveSnapshot", "consoleSnapshot"]) {
    if (currentManifest?.artifacts?.[id]) bundle.manifest.artifacts[id] = currentManifest.artifacts[id];
  }
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
  // Console-only mode retains editorial content, but still persists reviewed
  // link repairs; otherwise the manifest and files would describe different bytes.
  [dataPath("landing-decision-client.json"), bundle.landingDecision],
  [dataPath("site-content-client.json"), bundle.siteContent],
  [dataPath("site-content-extended-client.json"), bundle.siteContentExtended],
  [dataPath("company-directory-client.json"), bundle.companyDirectory],
  [dataPath("console-capital-plans.json"), bundle.consoleCapitalPlans],
  [dataPath("console-chip-roadmap.json"), bundle.consoleChipRoadmap],
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
