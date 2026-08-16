import assert from "node:assert/strict";
import { loadIntelligencePolicy } from "./decision-intelligence.mjs";
import {
  buildRefreshRequest,
  isDuplicateRefreshRequest,
  recordRefreshRequest,
  validateRefreshLedger,
} from "./refresh-orchestration.mjs";

const policy = loadIntelligencePolicy();
const now = new Date("2026-08-16T12:00:00.000Z");
const event = buildRefreshRequest({
  policy,
  now,
  runId: "refresh-test",
  env: {
    INTELLIGENCE_REFRESH_TRIGGER: "earnings-release",
    INTELLIGENCE_EVENT_KEY: "provider-secret-event-42",
    INTELLIGENCE_EVENT_OCCURRED_AT: "2026-08-16T11:55:00.000Z",
    INTELLIGENCE_EVENT_SOURCE: "SK hynix IR RSS relay",
  },
});
assert.equal(event.channel, "event");
assert.equal(event.latencyTargetMs, 10 * 60 * 1000);
assert.equal(event.latencyStatus, "met");
assert.equal(event.idempotencyKeyHash.length, 64);
assert.ok(!JSON.stringify(event).includes("provider-secret-event-42"), "raw idempotency keys must never be persisted");

const ledger = recordRefreshRequest(
  { schemaVersion: "1.0", events: [] },
  event,
  { runId: "refresh-test", processedAt: now.toISOString() },
  policy,
);
assert.deepEqual(validateRefreshLedger(ledger), { ok: true, errors: [] });
assert.equal(isDuplicateRefreshRequest(ledger, event), true);

const missed = buildRefreshRequest({
  policy,
  now,
  env: {
    INTELLIGENCE_REFRESH_TRIGGER: "earnings-release",
    INTELLIGENCE_EVENT_KEY: "another-event",
    INTELLIGENCE_EVENT_OCCURRED_AT: "2026-08-16T11:40:00.000Z",
  },
});
assert.equal(missed.latencyStatus, "missed");
assert.equal(isDuplicateRefreshRequest(ledger, missed), false);

const safetyPoll = buildRefreshRequest({ policy, now, runId: "scheduled-run", env: { INTELLIGENCE_REFRESH_TRIGGER: "schedule" } });
assert.equal(safetyPoll.channel, "poll");
assert.equal(safetyPoll.dedupeEligible, false);
assert.equal(isDuplicateRefreshRequest(ledger, safetyPoll), false);
assert.equal(policy.refreshOrchestration.safetyPollHours, 3);

console.log(JSON.stringify({ ok: true, strategy: ledger.strategy, latency: event.latencyStatus, duplicateSuppressed: true }, null, 2));
