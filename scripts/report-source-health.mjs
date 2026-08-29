#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const SOURCE_HEALTH_MARKER = "<!-- memory-source-health -->";
export const PIPELINE_HEALTH_MARKER = "<!-- memory-crawl-pipeline-health -->";
export const DECISION_SIGNAL_MARKER = "<!-- memory-decision-signals -->";

function clean(value = "", limit = 500) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/```/g, "`\u200b``")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

export function activeSourceAlerts(quant = {}) {
  return Object.values(quant.sourceHealth?.sources || {})
    .filter((item) => item?.attempted !== false)
    .filter((item) => item?.alert || Number(item?.failureStreak || 0) >= Number(item?.alertThreshold || 3))
    .sort((a, b) => Number(b.failureStreak || 0) - Number(a.failureStreak || 0) || String(a.id).localeCompare(String(b.id)));
}

export function sourceHealthIssueBody(quant = {}, runUrl = "") {
  const alerts = activeSourceAlerts(quant);
  const lines = [
    SOURCE_HEALTH_MARKER,
    "## 자동 수집 소스 경보",
    "",
    `검증 실행: ${clean(quant.runId || "unknown")}`,
    `데이터 갱신: ${clean(quant.updatedAt || quant.sourceHealth?.updatedAt || "unknown")}`,
    runUrl ? `워크플로: ${clean(runUrl, 900)}` : "워크플로: 링크 없음",
    "",
    "동일한 안정 ID가 검증 완료된 실행에서 3회 이상 연속 실패했습니다.",
    "",
  ];
  for (const item of alerts) {
    lines.push(`### ${clean(item.label || item.id)}`);
    lines.push("");
    lines.push(`- ID: \`${clean(item.id)}\``);
    lines.push(`- 연속 실패: **${Number(item.failureStreak || 0)}회**`);
    lines.push(`- 마지막 시도: ${clean(item.lastAttemptAt || "unknown")}`);
    lines.push(`- 마지막 성공: ${clean(item.lastSuccessAt || "없음")}`);
    const errors = (item.errors || []).map((error) => clean(error)).filter(Boolean);
    if (errors.length) {
      lines.push("- 최근 오류:");
      lines.push("");
      lines.push("```text");
      lines.push(errors.slice(0, 4).join("\n"));
      lines.push("```");
    }
    lines.push("");
  }
  lines.push("이 이슈는 `scripts/report-source-health.mjs`가 중복 없이 갱신하며, 모든 경보가 해제되면 자동으로 닫습니다.");
  return lines.join("\n");
}

export function activeDecisionSignals(quant = {}) {
  return (quant.strategyAccountIntelligence?.whatChanged?.items || [])
    .filter((item) => ["supplier-change", "deal-event"].includes(item?.kind))
    .filter((item) => item?.id && item?.headline)
    .slice(0, 12);
}

export function decisionSignalIssueBody(quant = {}, runUrl = "") {
  const items = activeDecisionSignals(quant);
  const lines = [
    DECISION_SIGNAL_MARKER,
    "## 공급·계약 변화 자동 경보",
    "",
    `검증 실행: ${clean(quant.runId || "unknown")}`,
    `데이터 갱신: ${clean(quant.updatedAt || quant.strategyAccountIntelligence?.whatChanged?.generatedAt || "unknown")}`,
    runUrl ? `워크플로: ${clean(runUrl, 900)}` : "워크플로: 링크 없음",
    "",
    "최근 7일 변화 중 공급관계 또는 LTA·물량·선급금 신호만 표시합니다.",
    "",
  ];
  for (const item of items) {
    lines.push(`### ${clean(item.headline)}`);
    lines.push("");
    lines.push(`- 유형: **${item.kind === "supplier-change" ? "공급관계" : "계약"}**`);
    if (item.accountId) lines.push(`- 계정: ${clean(item.accountId)}`);
    if (item.changeType || item.eventType) lines.push(`- 변화: ${clean(item.changeType || item.eventType)}`);
    lines.push(`- 기준일: ${clean(item.asOf || "unknown")}`);
    if (item.sourceUrl) lines.push(`- 근거: ${clean(item.source || "원문")} · ${clean(item.sourceUrl, 900)}`);
    lines.push("");
  }
  lines.push("이 이슈는 동일 이벤트 ID로 중복을 억제하며 새 변화가 없으면 자동으로 닫습니다.");
  return lines.join("\n");
}

async function githubRequest(fetchImpl, token, url, options = {}) {
  const response = await fetchImpl(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${clean(await response.text(), 700)}`);
  if (response.status === 204) return null;
  return response.json();
}

export async function syncSourceHealthIssue({ quant, repository, token, runUrl = "", fetchImpl = fetch, dryRun = false }) {
  if (!repository || !/^[^/]+\/[^/]+$/.test(repository)) throw new Error("GITHUB_REPOSITORY is required");
  const alerts = activeSourceAlerts(quant);
  const title = "[자동 경보] Memory Intelligence 소스 3회 연속 실패";
  const body = sourceHealthIssueBody(quant, runUrl);
  if (dryRun) return { action: alerts.length ? "would-open-or-update" : "would-close-if-open", alerts: alerts.map((item) => item.id), title, body };
  if (!token) throw new Error("GITHUB_TOKEN is required");
  const base = `https://api.github.com/repos/${repository}`;
  const issues = await githubRequest(fetchImpl, token, `${base}/issues?state=all&per_page=100`);
  const issue = issues.find((item) => !item.pull_request && String(item.body || "").includes(SOURCE_HEALTH_MARKER));
  if (alerts.length) {
    if (issue) {
      await githubRequest(fetchImpl, token, `${base}/issues/${issue.number}`, { method: "PATCH", body: JSON.stringify({ title, body, state: "open" }) });
      return { action: issue.state === "open" ? "updated" : "reopened", issue: issue.number, alerts: alerts.map((item) => item.id) };
    }
    const created = await githubRequest(fetchImpl, token, `${base}/issues`, { method: "POST", body: JSON.stringify({ title, body }) });
    return { action: "created", issue: created.number, alerts: alerts.map((item) => item.id) };
  }
  if (issue?.state === "open") {
    await githubRequest(fetchImpl, token, `${base}/issues/${issue.number}/comments`, { method: "POST", body: JSON.stringify({ body: `자동 확인: ${clean(quant.updatedAt || new Date().toISOString())} 실행에서 3회 연속 실패 경보가 모두 해제되었습니다.` }) });
    await githubRequest(fetchImpl, token, `${base}/issues/${issue.number}`, { method: "PATCH", body: JSON.stringify({ state: "closed" }) });
    return { action: "closed", issue: issue.number, alerts: [] };
  }
  return { action: "none", alerts: [] };
}

export async function syncDecisionSignalIssue({ quant, repository, token, runUrl = "", fetchImpl = fetch, dryRun = false }) {
  if (!repository || !/^[^/]+\/[^/]+$/.test(repository)) throw new Error("GITHUB_REPOSITORY is required");
  const signals = activeDecisionSignals(quant);
  const title = `[자동 경보] 공급·계약 변화 ${signals.length}건`;
  const body = decisionSignalIssueBody(quant, runUrl);
  if (dryRun) return { action: signals.length ? "would-open-or-update" : "would-close-if-open", signals: signals.map((item) => item.id), title, body };
  if (!token) throw new Error("GITHUB_TOKEN is required");
  const base = `https://api.github.com/repos/${repository}`;
  const issues = await githubRequest(fetchImpl, token, `${base}/issues?state=all&per_page=100`);
  const issue = issues.find((item) => !item.pull_request && String(item.body || "").includes(DECISION_SIGNAL_MARKER));
  if (signals.length) {
    if (issue) {
      await githubRequest(fetchImpl, token, `${base}/issues/${issue.number}`, { method: "PATCH", body: JSON.stringify({ title, body, state: "open" }) });
      return { action: issue.state === "open" ? "updated" : "reopened", issue: issue.number, signals: signals.map((item) => item.id) };
    }
    const created = await githubRequest(fetchImpl, token, `${base}/issues`, { method: "POST", body: JSON.stringify({ title, body }) });
    return { action: "created", issue: created.number, signals: signals.map((item) => item.id) };
  }
  if (issue?.state === "open") {
    await githubRequest(fetchImpl, token, `${base}/issues/${issue.number}/comments`, { method: "POST", body: JSON.stringify({ body: `자동 확인: ${clean(quant.updatedAt || new Date().toISOString())} 실행에서 새 공급·계약 변화가 없습니다.` }) });
    await githubRequest(fetchImpl, token, `${base}/issues/${issue.number}`, { method: "PATCH", body: JSON.stringify({ state: "closed" }) });
    return { action: "closed", issue: issue.number, signals: [] };
  }
  return { action: "none", signals: [] };
}

export async function syncPipelineFailureIssue({ jobResult = "success", refreshStatus = null, repository, token, runUrl = "", fetchImpl = fetch, dryRun = false }) {
  if (!repository || !/^[^/]+\/[^/]+$/.test(repository)) throw new Error("GITHUB_REPOSITORY is required");
  // The job can succeed while the crawl throws its bundle away, so the run's
  // own verdict is not enough. refreshStatus null means unknown — fall back to
  // the job result rather than asserting either colour from a file that may
  // belong to another run.
  const unpublished = Boolean(refreshStatus && refreshStatus.status !== "published");
  const failed = jobResult !== "success" || unpublished;
  const title = "[자동 경보] Memory Intelligence 크롤러 실행 실패";
  const body = [
    PIPELINE_HEALTH_MARKER,
    "## 자동 크롤링 파이프라인 경보",
    "",
    `작업 결과: **${clean(jobResult)}**`,
    runUrl ? `워크플로: ${clean(runUrl, 900)}` : "워크플로: 링크 없음",
    "",
    failed
      ? "이번 실행이 검증·커밋 단계까지 완료되지 않아 기존 데이터가 갱신되지 않았습니다."
      : "이번 실행이 검증·커밋 단계까지 정상 완료되었습니다.",
    ...(unpublished
      ? [
        "",
        `게시 상태: **${clean(refreshStatus.status)}** · 새 번들이 품질 게이트를 통과하지 못해 이전 검증본을 계속 서빙합니다.`,
        `실패한 검사: ${clean((refreshStatus.failures || []).join(", ") || "미기재")}`,
        ...((refreshStatus.failedChecks || []).length
          ? [`관측 대 임계: ${clean((refreshStatus.failedChecks || []).map((check) => `${check.id} ${check.observed}/${check.threshold}`).join(" · "), 900)}`]
          : []),
        `관측: 뉴스 ${clean(String(refreshStatus.observed?.newsItems ?? "?"))}건 · 통과 단계 ${clean(String(refreshStatus.observed?.successfulStages ?? "?"))}/${clean(String(refreshStatus.observed?.totalStages ?? "?"))}`,
        `마지막 확인: ${clean(refreshStatus.lastCheckedAt || "미기재")} · 마지막 게시: ${clean(refreshStatus.latestVerifiedAt || "미기재")}`,
      ]
      : []),
  ].join("\n");
  if (dryRun) return { action: failed ? "would-open-or-update" : "would-close-if-open", title, body };
  if (!token) throw new Error("GITHUB_TOKEN is required");
  const base = `https://api.github.com/repos/${repository}`;
  const issues = await githubRequest(fetchImpl, token, `${base}/issues?state=all&per_page=100`);
  const issue = issues.find((item) => !item.pull_request && String(item.body || "").includes(PIPELINE_HEALTH_MARKER));
  if (failed) {
    if (issue) {
      await githubRequest(fetchImpl, token, `${base}/issues/${issue.number}`, { method: "PATCH", body: JSON.stringify({ title, body, state: "open" }) });
      return { action: issue.state === "open" ? "updated" : "reopened", issue: issue.number };
    }
    const created = await githubRequest(fetchImpl, token, `${base}/issues`, { method: "POST", body: JSON.stringify({ title, body }) });
    return { action: "created", issue: created.number };
  }
  if (issue?.state === "open") {
    await githubRequest(fetchImpl, token, `${base}/issues/${issue.number}/comments`, { method: "POST", body: JSON.stringify({ body: `자동 확인: ${new Date().toISOString()} 실행에서 크롤링 파이프라인이 정상 완료되었습니다.` }) });
    await githubRequest(fetchImpl, token, `${base}/issues/${issue.number}`, { method: "PATCH", body: JSON.stringify({ state: "closed" }) });
    return { action: "closed", issue: issue.number };
  }
  return { action: "none" };
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const quant = JSON.parse(await readFile(resolve(root, "data", "quant.json"), "utf8"));
  const runUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : "";
  const repository = process.env.GITHUB_REPOSITORY || "local/dry-run";
  const token = process.env.GITHUB_TOKEN || "";
  const dryRun = process.argv.includes("--dry-run");
  const jobResult = process.env.CRAWL_JOB_RESULT || "success";
  // Unreadable or from another run means unknown, not healthy.
  let refreshStatus = null;
  try {
    const parsed = JSON.parse(await readFile(resolve(root, "data", "refresh-status.json"), "utf8"));
    const sameRun = !parsed.runId || !process.env.GITHUB_RUN_ID || String(parsed.runId) === String(process.env.GITHUB_RUN_ID);
    refreshStatus = sameRun ? parsed : null;
  } catch {
    refreshStatus = null;
  }
  const published = !refreshStatus || refreshStatus.status === "published";
  const pipeline = await syncPipelineFailureIssue({ jobResult, refreshStatus, repository, token, runUrl, dryRun });
  // quant.json is only rewritten on a published run, so on a degraded one its
  // streaks are the last published run's and would clear a real alert.
  const sources = jobResult !== "success"
    ? { action: "skipped-on-pipeline-failure" }
    : published
      ? await syncSourceHealthIssue({ quant, repository, token, runUrl, dryRun })
      : { action: "skipped-stale-quant" };
  const decisions = jobResult !== "success"
    ? { action: "skipped-on-pipeline-failure" }
    : published
      ? await syncDecisionSignalIssue({ quant, repository, token, runUrl, dryRun })
      : { action: "skipped-stale-quant" };
  console.log(JSON.stringify({ pipeline, sources, decisions }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
