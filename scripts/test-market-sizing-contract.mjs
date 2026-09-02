import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [app, html, quant, live] = await Promise.all([
  readFile(new URL("assets/js/app.js", root), "utf8"),
  readFile(new URL("index.html", root), "utf8"),
  readFile(new URL("data/quant-client.json", root), "utf8").then(JSON.parse),
  readFile(new URL("data/live-client.json", root), "utf8").then(JSON.parse),
]);

const contractSource = app
  .split("// MARKET_SIZING_CONTRACT_START")[1]
  ?.split("// MARKET_SIZING_CONTRACT_END")[0]
  ?.trim();
assert.ok(contractSource, "market-sizing validator source must stay extractable for fixture tests");
const validateMarketSizingContract = vm.runInNewContext(`(${contractSource})`, { URL, Date, Number, String, Array, Object, RegExp });

const now = Date.parse("2026-09-02T12:00:00.000Z");
const context = {
  quantRunId: "run-2026-09-02",
  liveRunId: "run-2026-09-02",
  expiresAt: "2026-09-03T00:00:00.000Z",
  now,
};
const complete = {
  schemaVersion: "1.0",
  runId: "run-2026-09-02",
  sourceUrl: "https://example.com/research/ai-memory-market",
  sourceTitle: "Primary market study",
  asOf: "2026-08-31",
  currency: "USD",
  baseYear: 2026,
  valueUnit: "million",
  sizingBasis: "global-ai-memory-revenue",
  scenario: "base",
  assumption: "HBM, server DRAM and enterprise SSD; global revenue; calendar 2026",
  confidence: "corroborated",
  tam: 100_000,
  sam: 40_000,
  som: 8_000,
};

const approved = validateMarketSizingContract(complete, context);
assert.ok(approved, "a complete coherent market-sizing record must validate");
assert.deepEqual([approved.tam, approved.sam, approved.som], [100_000, 40_000, 8_000]);
assert.equal(approved.state, "verified");
assert.equal(
  validateMarketSizingContract(complete, { ...context, expiresAt: "2026-09-01T00:00:00.000Z" })?.state,
  "stale",
  "an otherwise coherent expired record may render only as the last verified snapshot",
);

for (const field of [
  "schemaVersion", "runId", "sourceUrl", "asOf", "currency", "baseYear", "valueUnit",
  "sizingBasis", "scenario", "assumption", "confidence", "tam", "sam", "som",
]) {
  const partial = { ...complete };
  delete partial[field];
  assert.equal(validateMarketSizingContract(partial, context), null, `missing ${field} must reject the complete record`);
}

for (const [field, value] of [
  ["tam", 0], ["tam", -1], ["tam", Number.NaN], ["tam", Number.POSITIVE_INFINITY],
  ["sam", 100_001], ["som", 40_001], ["valueUnit", "accounts"], ["currency", "US$"],
  ["baseYear", 2026.5], ["scenario", ""], ["assumption", ""], ["confidence", ""],
  ["sizingBasis", "customer-account-serviceable-deal-value"],
]) {
  assert.equal(validateMarketSizingContract({ ...complete, [field]: value }, context), null, `${field}=${String(value)} must be rejected`);
}

for (const sourceUrl of ["javascript:alert(1)", "ftp://example.com/data", "https://user:pass@example.com/data"])
  assert.equal(validateMarketSizingContract({ ...complete, sourceUrl }, context), null, `unsafe source URL must be rejected: ${sourceUrl}`);
for (const asOf of ["2026-Q3", "2026-02-30", "2026-09", "2099-01-01"])
  assert.equal(validateMarketSizingContract({ ...complete, asOf }, context), null, `non-exact or future date must be rejected: ${asOf}`);

assert.equal(validateMarketSizingContract({ ...complete, schemaVersion: "1.1" }, context), null, "unknown schema must fail closed");
assert.equal(validateMarketSizingContract(complete, { ...context, quantRunId: "other-run" }), null, "quant run mismatch must fail closed");
assert.equal(validateMarketSizingContract(complete, { ...context, liveRunId: "other-run" }), null, "live run mismatch must fail closed");
assert.equal(
  validateMarketSizingContract(quant.marketSizing || quant.marketStructure?.kpis?.[0], {
    quantRunId: quant.runId,
    liveRunId: live.runId,
    expiresAt: quant.expiresAt,
    now,
  }),
  null,
  "a general market KPI must not be promoted into TAM/SAM/SOM",
);

assert.match(html, /id="marketSizingPanel"\s+aria-live="polite"/, "Number Analysis needs a dedicated market-sizing surface");
const renderer = app.slice(app.indexOf("function renderMarketSizingContract()"), app.indexOf("function renderNumberAnalysis()"));
assert.match(renderer, /\[QUANT\?\.marketSizing, LIVE\?\.marketSizing\]/, "renderer may inspect only the dedicated market-sizing contract");
assert.match(renderer, /data-sizing-state="pending"[\s\S]*?시장 규모 검증 대기[\s\S]*?수치 미표시/, "invalid or absent data must render an explicit pending state");
assert.match(renderer, /data-market-value="\$\{item\.key\}"/, "verified records must expose explicit TAM/SAM/SOM values");
assert.match(renderer, /계정별 Serviceable Value와 일반 시장 KPI는 시장 규모로 자동 환산하지 않습니다/, "account value and generic KPIs must stay outside market sizing");
const pendingBranch = renderer.slice(renderer.indexOf("if (!sizing)"), renderer.indexOf("const unit ="));
assert.doesNotMatch(pendingBranch, /data-market-value|countHTML|\.tam\b|\.sam\b|\.som\b/, "pending markup must contain no fabricated numeric output");

console.log(JSON.stringify({ ok: true, contractFields: 14, values: 3, currentState: "pending" }, null, 2));
