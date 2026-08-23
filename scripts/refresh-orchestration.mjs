import { createHash } from "node:crypto";

const hash = (value = "") => createHash("sha256").update(String(value)).digest("hex");
const validDate = (value) => Number.isFinite(Date.parse(String(value || "")));

export function validateRefreshLedger(ledger = {}) {
  const errors = [];
  if (ledger.schemaVersion !== "1.0") errors.push("schemaVersion");
  if (!Array.isArray(ledger.events)) errors.push("events");
  for (const event of ledger.events || []) {
    if (!/^[a-f0-9]{64}$/.test(String(event.idempotencyKeyHash || ""))) errors.push("event.idempotencyKeyHash");
    if (!event.trigger || !validDate(event.processedAt)) errors.push("event.shape");
    if (Object.hasOwn(event, "idempotencyKey")) errors.push("event.rawIdempotencyKey");
  }
  return { ok: errors.length === 0, errors };
}

function latencyTarget(trigger = "", policy = {}) {
  const targets = policy.refreshOrchestration?.latencyTargets || {};
  const target = targets[trigger] || targets[trigger.replace(/^repository_dispatch:/, "")] || targets.scheduled || { hours: 3 };
  return Number(target.minutes || 0) * 60000 + Number(target.hours || 0) * 3600000;
}

export function buildRefreshRequest({ env = process.env, policy = {}, now = new Date(), runId = null } = {}) {
  const trigger = String(env.INTELLIGENCE_REFRESH_TRIGGER || "scheduled").trim() || "scheduled";
  const rawKey = String(env.INTELLIGENCE_EVENT_KEY || "").trim();
  const occurredAt = validDate(env.INTELLIGENCE_EVENT_OCCURRED_AT) ? new Date(env.INTELLIGENCE_EVENT_OCCURRED_AT).toISOString() : null;
  const targetMs = latencyTarget(trigger, policy);
  const latencyMs = occurredAt ? Math.max(0, now.getTime() - Date.parse(occurredAt)) : null;
  return {
    trigger,
    channel: rawKey ? "event" : "poll",
    source: String(env.INTELLIGENCE_EVENT_SOURCE || trigger).slice(0, 120),
    idempotencyKeyHash: rawKey ? hash(rawKey) : hash(`${trigger}|${runId || now.toISOString()}`),
    dedupeEligible: Boolean(rawKey),
    occurredAt,
    receivedAt: now.toISOString(),
    latencyTargetMs: targetMs,
    latencyMs,
    latencyStatus: latencyMs == null ? "not-applicable" : latencyMs <= targetMs ? "met" : "missed",
  };
}

export function isDuplicateRefreshRequest(ledger = {}, request = {}) {
  return request.dedupeEligible === true
    && (ledger.events || []).some((event) => event.idempotencyKeyHash === request.idempotencyKeyHash && event.status === "published");
}

export function recordRefreshRequest(ledger = {}, request = {}, { runId = null, processedAt = new Date().toISOString(), status = "published" } = {}, policy = {}) {
  const limit = Math.max(10, Number(policy.refreshOrchestration?.idempotencyLedgerLimit || 100));
  const processedLatencyMs = request.occurredAt && validDate(processedAt)
    ? Math.max(0, Date.parse(processedAt) - Date.parse(request.occurredAt))
    : request.latencyMs;
  const event = {
    idempotencyKeyHash: request.idempotencyKeyHash,
    trigger: request.trigger,
    channel: request.channel,
    source: request.source,
    occurredAt: request.occurredAt,
    receivedAt: request.receivedAt,
    processedAt,
    runId,
    status,
    latencyTargetMs: request.latencyTargetMs,
    latencyMs: processedLatencyMs,
    latencyStatus: processedLatencyMs == null ? "not-applicable" : processedLatencyMs <= request.latencyTargetMs ? "met" : "missed",
  };
  const events = [event, ...(ledger.events || []).filter((item) => item.idempotencyKeyHash !== event.idempotencyKeyHash)].slice(0, limit);
  return {
    schemaVersion: "1.0",
    strategy: policy.refreshOrchestration?.strategy || "webhook-first-poll-reconciliation",
    safetyPollHours: Number(policy.refreshOrchestration?.safetyPollHours || 1),
    updatedAt: processedAt,
    events,
  };
}
