import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { consultingBullet, formatPublicDate, sourceLabel } from "../assets/js/public-copy-policy.js";

const root = new URL("../", import.meta.url);
const read = (relativePath) => readFile(new URL(relativePath, root), "utf8");
const readJSON = async (relativePath) => JSON.parse(await read(relativePath));

assert.equal(formatPublicDate("2026-08-05"), "8/05");
assert.equal(formatPublicDate("2026-08-25T23:59:59Z"), "8/25");
assert.equal(formatPublicDate("2026. 7. 18."), "7/18");
assert.equal(formatPublicDate("2026-02-30"), "");
assert.equal(formatPublicDate("2026-Q1"), "");
assert.equal(formatPublicDate(""), "");
assert.equal(sourceLabel("2026-08-05"), "8/05 · 원문 ↗");
assert.equal(sourceLabel("invalid"), "원문 ↗");

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
assert.doesNotMatch(staticVisible, /\b(?:19|20)\d{2}[-.]\d{1,2}[-.]\d{1,2}\b/, "visible dates must use M/DD");
assert.doesNotMatch(`${index}\n${alias}\n${renderer}`, /근거\s*원문/, "public source label must be 원문");
assert.doesNotMatch(renderer, /\$\{text\([^\n}]*(?:publishedAt|asOf)[^\n}]*\}/, "raw dates must not reach labels");
assert.match(renderer, /linkMarkup\(item\.latest\.url, item\.latest\.publishedAt\)/);
assert.match(renderer, /linkMarkup\(url, entry\.asOf\)/);

const staticSourceLabels = [...index.matchAll(/<a\b[^>]+href="https?:\/\/[^\"]+"[^>]*>([^<]*원문[^<]*)<\/a>/g)].map((match) => match[1].trim());
assert.equal(staticSourceLabels.length, 3, "Executive signal cards need three source links");
for (const label of staticSourceLabels) assert.match(label, /^(?:[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01]) · 원문 ↗$/);

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
const narrativeEnding = /(?:[가-힣]다|[가-힣](?:인가|는가|은가)|합니다|됩니다|습니다|선택하세요)[.!?。]?$/u;
const sentenceStop = /[가-힣][.!?。]$/u;
const findings = readerCopy.filter(({ value }) => narrativeEnding.test(value.trim()) || sentenceStop.test(value.trim()));
if (findings.length) {
  for (const finding of findings.slice(0, 20)) console.error(`${finding.path}: ${finding.value}`);
}
assert.deepEqual(findings, [], "reader copy must use consulting fragments");

console.log(JSON.stringify({
  status: "public-copy-contract-pass",
  sourceLabels: staticSourceLabels.length,
  checkedCopy: readerCopy.length,
}, null, 2));
