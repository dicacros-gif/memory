import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { collapseRedundantParenthetical, consultingBullet, formatPublicDate, formatPublicTemporalCopy, neutralizePublicBrand, sourceLabel } from "../assets/js/public-copy-policy.js";

const root = new URL("../", import.meta.url);
const read = (relativePath) => readFile(new URL(relativePath, root), "utf8");
const readJSON = async (relativePath) => JSON.parse(await read(relativePath));

// The day survives only inside the reference year; every earlier year is
// stamped as 'YY.M월 so a stale date cannot pass for a recent one.
assert.equal(formatPublicDate("2026-08-05"), "8/5");
assert.equal(formatPublicDate("2024-03-18"), "'24.3월");
assert.equal(formatPublicDate("2026-08-25T23:59:59Z"), "8/25");
assert.equal(formatPublicDate("2026. 7. 18."), "7/18");
assert.equal(formatPublicDate("2025-08"), "'25.8월");
assert.equal(formatPublicDate("2025년 8월"), "'25.8월");
assert.equal(formatPublicDate("2025년 8월 7일"), "'25.8월");
assert.equal(formatPublicDate("2026-02-30"), "");
assert.equal(formatPublicDate("2026-13"), "");
assert.equal(formatPublicDate("2026-Q1"), "");
assert.equal(formatPublicDate(""), "");

// Translated copy glosses a company name in brackets, and when both halves
// come back as the same English name the reader gets "SK hynix (SK hynix)".
// A gloss that repeats what it follows carries nothing; a real one survives.
assert.equal(collapseRedundantParenthetical("SK hynix (SK hynix)"), "SK hynix");
assert.equal(collapseRedundantParenthetical("SK hynix (SK Hynix)"), "SK hynix");
assert.equal(collapseRedundantParenthetical("창신 메모리(Changxin Memory)"), "창신 메모리(Changxin Memory)");
assert.equal(collapseRedundantParenthetical("NVIDIA (NVDA)"), "NVIDIA (NVDA)");
assert.equal(formatPublicTemporalCopy("2025년 8월 발표 · 2025-08-07 검증"), "'25.8월 발표 · '25.8월 검증");
assert.equal(formatPublicTemporalCopy("2025년 8월부터"), "'25.8월부터");
assert.equal(formatPublicTemporalCopy("2025년 2월 30일"), "2025년 2월 30일");
assert.equal(formatPublicTemporalCopy("처리량 2025.8GB · 비중 2025.2%"), "처리량 2025.8GB · 비중 2025.2%");
assert.equal(sourceLabel("2026-08-05"), "8/5");
assert.equal(sourceLabel("invalid"), "출처");
assert.equal(neutralizePublicBrand("SK hynix 판단 · SK하이닉스 제품 · SKHY"), "Memory Business 판단 · Memory Business 제품 · Memory Business");

for (const [input, expected] of [
  ["확대합니다.", "확대"],
  ["검증이 필요합니다.", "검증이 필요"],
  ["메모리 투자는 기다린다.", "메모리 투자는 보류"],
  ["확대합니다. 검증합니다.", "확대 · 검증"],
  ["사업으로 가능한가?", "사업으로 가능성"],
]) assert.equal(consultingBullet(input), expected, input);

const [index, alias, renderer, frames, companies, siteContent, spine, capital] = await Promise.all([
  read("index.html"),
  read("console/index.html"),
  read("assets/js/strategy-experience.js"),
  readJSON("data/mbb-frames.json"),
  readJSON("data/company-directory-client.json"),
  readJSON("data/site-content-client.json"),
  readJSON("data/strategy-spine.json"),
  readJSON("data/capital-plans.json"),
]);

const visibleText = (html) => html
  .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
  .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, "\n")
  .replace(/&(?:amp|nbsp|lt|gt|quot|#39);/g, " ");

const staticVisible = `${visibleText(index)}\n${visibleText(alias)}`;
const consoleVisible = visibleText(index.slice(index.indexOf('id="console"')));
assert.doesNotMatch(staticVisible, /\b(?:19|20)\d{2}[-.]\d{1,2}[-.]\d{1,2}\b/, "visible dates must use M/D");
assert.doesNotMatch(consoleVisible, /삼성전자|마이크론|에스케이\s*하이닉스/i, "console company names must use their English names");
assert.doesNotMatch(`${index}\n${alias}\n${renderer}`, /근거\s*원문/, "public source label must be 원문");
for (const account of ["OpenAI", "Azure", "Google", "Anthropic", "NVIDIA", "Dell"]) assert.match(JSON.stringify(siteContent), new RegExp(account), `generated strategy content needs named account: ${account}`);
assert.doesNotMatch(renderer, /\$\{text\([^\n}]*(?:publishedAt|asOf)[^\n}]*\}/, "raw dates must not reach labels");
assert.match(renderer, /linkMarkup\(item\.latest\.url, item\.latest\.publishedAt\)/);
assert.match(renderer, /linkMarkup\(url, entry\.asOf\)/);

assert.doesNotMatch(consoleVisible, /↗/, "console source labels must not expose arrow glyphs");

const contentStrings = [];
const collectStrings = (value, path = "") => {
  if (typeof value === "string") contentStrings.push({ path, value });
  else if (Array.isArray(value)) value.forEach((item, index) => collectStrings(item, `${path}[${index}]`));
  else if (value && typeof value === "object") Object.entries(value).forEach(([key, item]) => collectStrings(item, path ? `${path}.${key}` : key));
};
collectStrings(frames, "mbb");

const preferred = new Set(["nvidia", "google", "microsoft", "aws", "meta", "openai", "anthropic", "broadcom", "marvell", "dell"]);
for (const profile of companies.profiles || []) {
  if (!preferred.has(profile.id)) continue;
  for (const value of [
    profile.summary,
    profile.accountBrief?.mandate,
    ...(profile.accountBrief?.decisionFlow || []).map((item) => item.value),
    ...(profile.memoryLens?.buyingCriteria || []),
    profile.capitalPlan?.memoryRead,
    ...(profile.executiveLens?.actions || []).flatMap((item) => [item.title, item.detail]),
  ]) if (value) contentStrings.push({ path: `company.${profile.id}`, value: consultingBullet(value) });
}

for (const item of siteContent.decisionCases || []) {
  if (!["agentic-inference", "enterprise-rag"].includes(item.id)) continue;
  for (const value of [item.answerTitle, item.decision, ...(item.kpis || [])]) if (value) contentStrings.push({ path: `case.${item.id}`, value: consultingBullet(value) });
}
const dynamics = siteContent.strategyBoard?.customerPortfolio?.competitiveDynamics || {};
for (const item of dynamics.relations || dynamics.relationships || []) {
  for (const value of [item.title, item.detail, item.memoryImplication, item.decisionImpact]) if (value) contentStrings.push({ path: "relationship", value: consultingBullet(value) });
}
for (const item of [...(spine.verticalWorkloads || []), ...(spine.partnerModels || [])]) {
  for (const value of Object.values(item)) if (typeof value === "string") contentStrings.push({ path: "strategy-spine", value: consultingBullet(value) });
}
for (const [id, plan] of Object.entries(capital.plans || {})) {
  for (const key of ["capex", "plan", "comment", "memoryRead", "tier"]) if (plan[key]) contentStrings.push({ path: `capital.${id}.${key}`, value: consultingBullet(plan[key]) });
}

const staticNodes = staticVisible.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
const readerCopy = [
  ...staticNodes.map((value) => ({ path: "static", value })),
  ...contentStrings,
];
const narrativeEnding = /(?:합니다|됩니다|습니다)[.!。]?$/u;
const sentenceStop = /[가-힣][.!。]$/u;
const findings = readerCopy.filter(({ value }) => narrativeEnding.test(value.trim()) || sentenceStop.test(value.trim()));
if (findings.length) {
  for (const finding of findings.slice(0, 20)) console.error(`${finding.path}: ${finding.value}`);
}
assert.deepEqual(findings, [], "reader copy must use consulting fragments");

console.log(JSON.stringify({
  status: "public-copy-contract-pass",
  sourceLabelPolicy: "M/D without arrow glyph",
  checkedCopy: readerCopy.length,
}, null, 2));
