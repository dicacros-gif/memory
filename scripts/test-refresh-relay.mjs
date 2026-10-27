import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ACTIVE_POLL_MINUTES, DUE_MINUTES, LOOP_MINUTES, MIN_DISPATCH_GAP_MINUTES, nextRelayStep } from "./refresh-relay.mjs";

const MINUTE = 60_000;
const now = Date.parse("2026-10-27T06:00:00Z");
const deadline = now + LOOP_MINUTES * MINUTE;
const checkedAgo = (minutes) => new Date(now - minutes * MINUTE).toISOString();
const pagesWorkflow = await readFile(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");

// The relay and the crawl's own gate use one freshness rule.
assert.match(pagesWorkflow, new RegExp(`"\\$age" -ge ${DUE_MINUTES}`), "relay and gate must agree on when data is due");

// Fresh data: sleep until it is due, not a minute longer.
assert.deepEqual(nextRelayStep({ now, lastCheckedAt: checkedAgo(30), deadline }), { action: "wait", minutes: DUE_MINUTES - 30 + 1 });
// Due data with no crawl running: dispatch.
assert.deepEqual(nextRelayStep({ now, lastCheckedAt: checkedAgo(DUE_MINUTES), deadline }), { action: "dispatch" });
// Unreadable status counts as due, as in the gate.
assert.deepEqual(nextRelayStep({ now, lastCheckedAt: null, deadline }), { action: "dispatch" });
// A crawl already queued or running is never doubled; poll until it ends.
assert.deepEqual(nextRelayStep({ now, lastCheckedAt: checkedAgo(400), activeRuns: 1, deadline }), { action: "wait", minutes: ACTIVE_POLL_MINUTES });
// A crawl that failed before committing leaves the data due; retries are spaced.
assert.deepEqual(
  nextRelayStep({ now, lastCheckedAt: checkedAgo(400), lastDispatchAt: now - 20 * MINUTE, deadline }),
  { action: "wait", minutes: MIN_DISPATCH_GAP_MINUTES - 20 + 1 },
);
// A wait that would outlive the job hands over to the next relay run instead.
assert.deepEqual(nextRelayStep({ now, lastCheckedAt: checkedAgo(10), deadline: now + 60 * MINUTE }), { action: "handoff" });
assert.deepEqual(nextRelayStep({ now, lastCheckedAt: checkedAgo(10), deadline: now }), { action: "handoff" });

// The workflow keeps the chain alive and bounded.
const relayWorkflow = await readFile(new URL("../.github/workflows/refresh-relay.yml", import.meta.url), "utf8");
const relayScript = await readFile(new URL("./refresh-relay.mjs", import.meta.url), "utf8");
assert.match(relayWorkflow, /permissions:\s*\n\s*actions: write\s*\n\s*contents: read/, "dispatching needs actions: write and nothing more");
assert.match(relayWorkflow, /concurrency:\s*\n\s*group: refresh-relay\s*\n\s*cancel-in-progress: false/, "one relay runs, at most one waits");
assert.match(relayWorkflow, /workflow_dispatch:/, "the relay hands over by dispatching itself");
assert.match(relayWorkflow, /cron: "41 \*\/6 \* \* \*"/, "a cron restarts a broken chain");
const timeout = Number(relayWorkflow.match(/timeout-minutes: (\d+)/)?.[1]);
assert.ok(timeout > LOOP_MINUTES && timeout < 360, "the loop ends and hands over before the job is killed");
assert.match(relayScript, /dispatch\("refresh-relay\.yml"\)/);
assert.match(relayScript, /dispatch\("pages\.yml", \{ refresh_scope: "full" \}\)/);
assert.match(pagesWorkflow, /workflow_dispatch:\s*\n\s*inputs:\s*\n\s*refresh_scope:/, "the crawl accepts the relay's dispatch");

console.log(JSON.stringify({ refreshRelay: "pass", dueMinutes: DUE_MINUTES, loopMinutes: LOOP_MINUTES, timeoutMinutes: timeout }));
