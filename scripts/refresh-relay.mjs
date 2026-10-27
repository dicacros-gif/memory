import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Scheduler-independent refresh relay.
 *
 * GitHub starts this repository's scheduled runs hours late and drops slots
 * outright: after the crawl moved to an hourly freshness gate, seven hours
 * passed without a single scheduled run. The relay does not wait on the
 * scheduler. One job reads the published refresh status, waits until the data
 * is due (the same 330-minute rule as the gate in pages.yml), dispatches the
 * crawl, and before its own time limit dispatches its successor. A
 * workflow_dispatch made with GITHUB_TOKEN starts a new run, so the chain
 * keeps itself alive; the cron entries in refresh-relay.yml only restart it if
 * it ever breaks.
 */

export const DUE_MINUTES = 330;
// A crawl that fails before committing leaves lastCheckedAt old. Without a gap
// the relay would dispatch failing crawls back to back.
export const MIN_DISPATCH_GAP_MINUTES = 90;
export const ACTIVE_POLL_MINUTES = 10;
// GitHub-hosted jobs stop at 360 minutes; the job timeout is 350.
export const LOOP_MINUTES = 335;

const MINUTE = 60_000;

/**
 * Decide the relay's next step. Pure, so the schedule can be tested without a
 * clock or the GitHub API.
 * @returns {{action: "dispatch"} | {action: "wait", minutes: number} | {action: "handoff"}}
 */
export function nextRelayStep({ now, lastCheckedAt, activeRuns = 0, lastDispatchAt = null, deadline }) {
  const remaining = (deadline - now) / MINUTE;
  if (!(remaining >= 1)) return { action: "handoff" };
  const checked = Date.parse(lastCheckedAt || "");
  const age = Number.isFinite(checked) ? (now - checked) / MINUTE : Infinity;
  const sinceDispatch = lastDispatchAt === null ? Infinity : (now - lastDispatchAt) / MINUTE;
  let wait;
  if (activeRuns > 0) {
    wait = ACTIVE_POLL_MINUTES;
  } else if (age >= DUE_MINUTES && sinceDispatch >= MIN_DISPATCH_GAP_MINUTES) {
    return { action: "dispatch" };
  } else {
    wait = Math.max(age < DUE_MINUTES ? DUE_MINUTES - age : 0, MIN_DISPATCH_GAP_MINUTES - sinceDispatch, 0) + 1;
  }
  if (wait > remaining) return { action: "handoff" };
  return { action: "wait", minutes: Math.ceil(wait) };
}

async function github(path, { method = "GET", body, accept = "application/vnd.github+json" } = {}) {
  const response = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}${path}`, {
    method,
    headers: {
      Accept: accept,
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`${method} ${path}: HTTP ${response.status}`);
  return response.status === 204 ? null : response.json();
}

async function readLastCheckedAt() {
  const status = await github("/contents/data/refresh-status.json?ref=main", { accept: "application/vnd.github.raw+json" });
  return status?.lastCheckedAt || null;
}

async function countActiveCrawls() {
  let total = 0;
  for (const status of ["queued", "in_progress", "pending", "waiting", "requested"]) {
    const page = await github(`/actions/workflows/pages.yml/runs?branch=main&status=${status}&per_page=1`);
    total += Number(page?.total_count || 0);
  }
  return total;
}

const dispatch = (workflow, inputs) => github(`/actions/workflows/${workflow}/dispatches`, {
  method: "POST",
  body: { ref: "main", ...(inputs ? { inputs } : {}) },
});

const sleep = (minutes) => new Promise((resolve) => setTimeout(resolve, minutes * MINUTE));

async function main() {
  const deadline = Date.now() + LOOP_MINUTES * MINUTE;
  let lastDispatchAt = null;
  for (;;) {
    let step;
    try {
      const [lastCheckedAt, activeRuns] = [await readLastCheckedAt(), await countActiveCrawls()];
      step = nextRelayStep({ now: Date.now(), lastCheckedAt, activeRuns, lastDispatchAt, deadline });
      console.log(JSON.stringify({ at: new Date().toISOString(), lastCheckedAt, activeRuns, step }));
      if (step.action === "dispatch") {
        await dispatch("pages.yml", { refresh_scope: "full" });
        lastDispatchAt = Date.now();
        console.log("::notice::published data was due; dispatched the crawl");
        continue;
      }
    } catch (error) {
      // The API blinking must not end the chain; try again shortly.
      console.log(`::warning::relay check failed: ${error.message}`);
      step = Date.now() + ACTIVE_POLL_MINUTES * MINUTE < deadline ? { action: "wait", minutes: ACTIVE_POLL_MINUTES } : { action: "handoff" };
    }
    if (step.action === "handoff") break;
    await sleep(step.minutes);
  }
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await dispatch("refresh-relay.yml");
      console.log("::notice::handed over to the next relay run");
      return;
    } catch (error) {
      console.log(`::warning::handoff attempt ${attempt} failed: ${error.message}`);
      await sleep(attempt);
    }
  }
  // The cron entries in refresh-relay.yml restart a broken chain.
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
