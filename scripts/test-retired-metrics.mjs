import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  RETIRED_COMBINED_HBM4_METRIC_ID,
  isRetiredCombinedHbm4Metric,
  purgeRetiredCombinedHbm4Artifacts,
} from "./retired-metrics.mjs";

const retired = {
  id: RETIRED_COMBINED_HBM4_METRIC_ID,
  label: "HBM4 Rubin 요구 속도",
  source: "SKHY / Micron IR",
};
const keep = { id: "vendor-skhynix-hbm4-speed", label: "SK hynix HBM4 시연", source: "SK hynix" };
const baseline = { kpis: [{ ...retired, label: "HBM4 업체별 확인 속도" }, keep] };
const quant = {
  marketStructure: {
    kpis: [
      { ...retired, baselineIndex: 5 },
      { ...keep, baselineIndex: 6 },
    ],
  },
  baselineFreshness: {
    total: 2,
    current: 1,
    revalidate: 1,
    conflictCandidates: 0,
    items: {
      "baseline-root-kpis-5-note": {
        id: "baseline-root-kpis-5-note",
        path: "root.kpis[5].note",
        title: "HBM4 업체별 확인 속도",
        status: "revalidate",
      },
      "baseline-root-kpis-6-note": {
        id: "baseline-root-kpis-6-note",
        path: "root.kpis[6].note",
        title: "SK hynix HBM4 시연",
        status: "current",
      },
    },
  },
};
const marketHistory = {
  metrics: { [RETIRED_COMBINED_HBM4_METRIC_ID]: retired, keep },
  metricDefinitions: { [RETIRED_COMBINED_HBM4_METRIC_ID]: retired, keep },
};
const quantBacktest = {
  series: { [`metric:${RETIRED_COMBINED_HBM4_METRIC_ID}`]: retired, keep },
};

const removedPaths = purgeRetiredCombinedHbm4Artifacts({ baseline, quant, marketHistory, quantBacktest });
assert.ok(removedPaths.length >= 6, "every known retired-metric contract must be purged");
assert.deepEqual(baseline.kpis, [keep]);
assert.deepEqual(quant.marketStructure.kpis, [{ ...keep, baselineIndex: 0 }]);
assert.deepEqual(Object.keys(quant.baselineFreshness.items), ["baseline-root-kpis-0-note"]);
assert.equal(quant.baselineFreshness.items["baseline-root-kpis-0-note"].id, "baseline-root-kpis-0-note");
assert.equal(quant.baselineFreshness.items["baseline-root-kpis-0-note"].path, "root.kpis[0].note");
assert.equal(quant.baselineFreshness.total, 1);
assert.equal(quant.baselineFreshness.current, 1);
assert.equal(quant.baselineFreshness.revalidate, 0);
assert.equal(marketHistory.metrics[RETIRED_COMBINED_HBM4_METRIC_ID], undefined);
assert.equal(marketHistory.metricDefinitions[RETIRED_COMBINED_HBM4_METRIC_ID], undefined);
assert.equal(quantBacktest.series[`metric:${RETIRED_COMBINED_HBM4_METRIC_ID}`], undefined);
assert.equal(isRetiredCombinedHbm4Metric("vendor-skhynix-hbm4-speed", keep), false,
  "a vendor-specific official disclosure must remain eligible");

const forbidden = [
  RETIRED_COMBINED_HBM4_METRIC_ID,
  "HBM4 업체별 확인 속도",
  "HBM4 Rubin 요구 속도",
  "SKHY / Micron IR",
];
for (const name of [
  "baseline.json",
  "quant.json",
  "live.json",
  "market-history.json",
  "quant-backtest.json",
  "quant-client.json",
]) {
  const source = await readFile(resolve("data", name), "utf8");
  for (const marker of forbidden) {
    assert.ok(!source.includes(marker), `${name} must not contain retired aggregate marker: ${marker}`);
  }
}

console.log(JSON.stringify({ ok: true, checkedFiles: 6, removedPaths: removedPaths.length }, null, 2));
