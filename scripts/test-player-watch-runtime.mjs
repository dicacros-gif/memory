import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../assets/js/app.js", import.meta.url), "utf8");
function fn(name) {
  const start = source.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, `missing function ${name}`);
  const end = source.indexOf("\n  function ", start + 1);
  return source.slice(start, end);
}
const player = { id: "aws", aliases: ["AWS", "Amazon"] };
let news = [];
const context = {
  LIVE: { runId: "100" },
  DATA_MANIFEST: { runId: "100", cacheVersion: "unchanged", artifacts: { companySignals: {} } },
  COMPANY_SIGNALS: { companies: { aws: { tech: [{ label: "HBM" }] } }, coverageThisRun: {} },
  secondaryDataPromises: new Map(), secondaryDataReady: new Set(), secondaryDataFallback: new Set(),
  emptyHistory: {}, emptyMarketHistory: {}, emptyQuantBacktest: {},
  selectSameRunArtifact: (value) => value,
  managedDataPath: (_id, path) => path,
  currentRunNews: () => news,
  rawNews: () => [{ title: "Amazon archive only", link: "https://example.com/archive" }],
};
vm.createContext(context);
for (const name of ["sameRunArtifact", "playerAliasPattern", "playerNewsItems", "playerHasLiveSignal", "loadSecondaryArtifact"]) {
  vm.runInContext(fn(name), context);
}
for (const runId of ["99", "101", "", undefined, "not-a-run"]) {
  assert.equal(context.sameRunArtifact({ runId }), null, `reject mixed/invalid run ${runId}`);
}
const good = { runId: "100", companies: {} };
assert.equal(context.sameRunArtifact(good), good);
assert.equal(context.playerHasLiveSignal(player), false, "retained or archived rows are not live coverage");
assert.equal(context.playerNewsItems(player).length, 0, "LATEST cannot contain the reference archive");
context.COMPANY_SIGNALS.coverageThisRun.aws = { articleCount: 1 };
assert.equal(context.playerHasLiveSignal(player), true);
context.COMPANY_SIGNALS.coverageThisRun.aws.articleCount = 0;
news = [{ title: "Amazon new verified announcement", link: "https://example.com/current", date: "2026-09-02" }];
assert.equal(context.playerHasLiveSignal(player), true);
news = [{ title: "Laws update", link: "https://example.com/unrelated" }];
assert.equal(context.playerHasLiveSignal(player), false, "AWS must not match inside words");
news = [{title:"NVIDIA GPU supply update",summary:"AWS is mentioned as a customer",entities:["aws"],link:"https://example.com/partner"}];
assert.equal(context.playerNewsItems(player).length,0,"a summary co-mention must not duplicate a partner's headline across player cards");

const requests = [];
let payload = { runId: "101", companies: {} };
context.loadJSON = async (path, _fallback, options) => {
  requests.push({ path, ...options });
  return payload;
};
await context.loadSecondaryArtifact("companySignals");
assert.equal(context.COMPANY_SIGNALS, null);
assert.ok(context.secondaryDataFallback.has("companySignals"));
assert.ok(!context.secondaryDataReady.has("companySignals"));
assert.ok(!context.secondaryDataPromises.has("companySignals"), "validation failure must release cached promise for retry");
payload = good;
await context.loadSecondaryArtifact("companySignals");
assert.equal(requests.at(-1).cache, "reload", "retry must bypass cached rejected response");
assert.ok(context.secondaryDataReady.has("companySignals"));
assert.ok(!context.secondaryDataFallback.has("companySignals"));
assert.equal(context.COMPANY_SIGNALS, good);
await context.loadSecondaryArtifact("playerWatch");
assert.equal(requests.at(-1).cache, "no-cache", "authored data must revalidate even with an unchanged manifest");

assert.match(source, /voice\.kind === "직접 인용"/, "reported statements must not be presented as direct quotations");
for (const name of ["compactFullDateLabel", "compactYearMonthLabel", "normalizeConsoleDateCopy", "shortKstDate", "shortKstDateWithYear"]) {
  vm.runInContext(fn(name), context);
}
for (const year of [2024, 2025]) {
  const stamp = `${year}-12-10`;
  const label = context.shortKstDateWithYear(stamp);
  assert.match(label, new RegExp(`^'${String(year).slice(2)} `), "historical source labels must retain their year");
  assert.equal(context.normalizeConsoleDateCopy(label), label, "the later copy-normalization pass must preserve the year");
}
assert.match(source, /REPORTED · \$\{shortKstDateWithYear\(player\.sourceDate\)\}/, "player sources must use the year-aware label");
console.log(JSON.stringify({ playerWatchRuntime: "pass", snapshotIsolation: true, retryRecovery: true, archiveExcluded: true }));
