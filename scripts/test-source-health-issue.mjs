#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  DECISION_SIGNAL_MARKER,
  PIPELINE_HEALTH_MARKER,
  SOURCE_HEALTH_MARKER,
  activeDecisionSignals,
  decisionSignalIssueBody,
  sourceHealthIssueBody,
  syncDecisionSignalIssue,
  syncPipelineFailureIssue,
  syncSourceHealthIssue,
} from "./report-source-health.mjs";

const alertQuant = {
  runId: "42",
  updatedAt: "2026-07-20T12:00:00Z",
  sourceHealth: { sources: { "yahoo:usdkrw": {
    id: "yahoo:usdkrw",
    label: "USD/KRW",
    failureStreak: 3,
    alertThreshold: 3,
    alert: true,
    lastAttemptAt: "2026-07-20T12:00:00Z",
    lastSuccessAt: "2026-07-18T12:00:00Z",
    errors: ["timeout ``` injected\ncontrol"],
  } } },
};

const body = sourceHealthIssueBody(alertQuant, "https://github.com/acme/repo/actions/runs/42");
assert.ok(body.includes(SOURCE_HEALTH_MARKER));
assert.ok(!body.includes("timeout ``` injected"), "triple-backtick injection must be neutralized");
const inactiveAlertQuant = { ...alertQuant, sourceHealth: { sources: {
  "yahoo:usdkrw": { ...alertQuant.sourceHealth.sources["yahoo:usdkrw"], attempted: false },
} } };
assert.ok(!sourceHealthIssueBody(inactiveAlertQuant).includes("### USD/KRW"), "unattempted historical failures must not keep an incident open");

const decisionQuant = {
  ...alertQuant,
  strategyAccountIntelligence: { whatChanged: { items: [
    { id: "supplier:google:samsung", kind: "supplier-change", headline: "Google · dual-source", accountId: "google", changeType: "dual-source", asOf: "2026-07-20", source: "Official", sourceUrl: "https://example.com/supply" },
    { id: "pain-rise:google:bandwidth", kind: "pain-rise", headline: "Google · 대역폭 상승", accountId: "google", asOf: "2026-07-20" },
  ] } },
};
assert.equal(activeDecisionSignals(decisionQuant).length, 1, "GitHub alerts must include only supplier and deal changes");
assert.ok(decisionSignalIssueBody(decisionQuant).includes(DECISION_SIGNAL_MARKER));

function mockFetch(responses, calls) {
  return async (url, options = {}) => {
    calls.push({ url, options });
    const next = responses.shift();
    return { ok: true, status: next.status || 200, json: async () => next.json, text: async () => "" };
  };
}

{
  const calls = [];
  const result = await syncSourceHealthIssue({
    quant: alertQuant,
    repository: "acme/repo",
    token: "token",
    fetchImpl: mockFetch([{ json: [] }, { json: { number: 7 } }], calls),
  });
  assert.equal(result.action, "created");
  assert.equal(calls.filter((call) => call.options.method === "POST").length, 1);
}

{
  const calls = [];
  const result = await syncDecisionSignalIssue({
    quant: decisionQuant,
    repository: "acme/repo",
    token: "token",
    fetchImpl: mockFetch([{ json: [] }, { json: { number: 11 } }], calls),
  });
  assert.equal(result.action, "created");
  assert.ok(JSON.parse(calls.at(-1).options.body).body.includes(DECISION_SIGNAL_MARKER));
}

{
  const calls = [];
  const result = await syncSourceHealthIssue({
    quant: alertQuant,
    repository: "acme/repo",
    token: "token",
    fetchImpl: mockFetch([{ json: [{ number: 7, state: "open", body: SOURCE_HEALTH_MARKER }] }, { json: { number: 7 } }], calls),
  });
  assert.equal(result.action, "updated");
  assert.equal(calls.at(-1).options.method, "PATCH");
}

{
  const calls = [];
  const recovered = { ...alertQuant, sourceHealth: { sources: { "yahoo:usdkrw": { ...alertQuant.sourceHealth.sources["yahoo:usdkrw"], failureStreak: 0, alert: false } } } };
  const result = await syncSourceHealthIssue({
    quant: recovered,
    repository: "acme/repo",
    token: "token",
    fetchImpl: mockFetch([
      { json: [{ number: 7, state: "open", body: SOURCE_HEALTH_MARKER }] },
      { json: { id: 1 } },
      { json: { number: 7, state: "closed" } },
    ], calls),
  });
  assert.equal(result.action, "closed");
  assert.deepEqual(calls.slice(1).map((call) => call.options.method), ["POST", "PATCH"]);
}

{
  const calls = [];
  const result = await syncPipelineFailureIssue({
    jobResult: "failure",
    repository: "acme/repo",
    token: "token",
    fetchImpl: mockFetch([{ json: [] }, { json: { number: 9 } }], calls),
  });
  assert.equal(result.action, "created");
  const payload = JSON.parse(calls.at(-1).options.body);
  assert.ok(payload.body.includes(PIPELINE_HEALTH_MARKER));
}

{
  const calls = [];
  const result = await syncPipelineFailureIssue({
    jobResult: "success",
    repository: "acme/repo",
    token: "token",
    fetchImpl: mockFetch([
      { json: [{ number: 9, state: "open", body: PIPELINE_HEALTH_MARKER }] },
      { json: { id: 2 } },
      { json: { number: 9, state: "closed" } },
    ], calls),
  });
  assert.equal(result.action, "closed");
}

console.log("source health issue tests passed");
