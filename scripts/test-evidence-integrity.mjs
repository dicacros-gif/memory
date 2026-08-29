import assert from "node:assert/strict";
import "./test-news-claim-gate.mjs";
import {
  assessPriceChange,
  auditTranslationFidelity,
  evidenceClaimLabel,
  supersededNumericClaimReason,
} from "./evidence-integrity.mjs";
import {
  classifyNewsMeceAxis,
  dedupeEnrichedNews,
  newsEntityTags,
  sameNewsStory,
} from "./crawl.mjs";

const correctCnyTranslation = auditTranslationFidelity(
  "The exchange approved a CNY 29.5 billion plan with a 15 percent greenshoe.",
  "거래소는 295억 위안 계획과 15% 초과배정을 승인했습니다.",
);
assert.equal(correctCnyTranslation.status, "verified", "CNY billion and Korean 억 must normalise to the same amount");
assert.equal(correctCnyTranslation.tokenMatchPct, 100);

const compoundCnyTranslation = auditTranslationFidelity(
  "The company raised 57.92 billion yuan ($8.6 billion) after pricing the IPO at 8.66 yuan per share.",
  "회사는 IPO 가격을 주당 8.66위안으로 책정한 후 579억 2천만 위안(86억 달러)을 조달했습니다.",
);
assert.equal(compoundCnyTranslation.status, "verified", "compound 억·천만 amounts must retain the same currency value");

const incorrectCurrencyTranslation = auditTranslationFidelity(
  "The exchange approved a CNY 29.5 billion plan.",
  "거래소는 295억 달러 계획을 승인했습니다.",
);
assert.equal(incorrectCurrencyTranslation.status, "unverified", "a yuan-to-dollar translation must be rejected");
assert.ok(incorrectCurrencyTranslation.reasons.some((reason) => reason.startsWith("currency-mismatch:CNY")));

const chineseCurrencyTranslation = auditTranslationFidelity(
  "长鑫科技计划募资295亿元。",
  "CXMT는 295억 달러를 조달할 계획입니다.",
);
assert.equal(chineseCurrencyTranslation.status, "unverified", "Chinese yuan notation must not be translated to dollars");

const incorrectNumberTranslation = auditTranslationFidelity(
  "Micron disclosed 16 strategic agreements.",
  "마이크론은 18개 전략 계약을 공개했습니다.",
);
assert.equal(incorrectNumberTranslation.status, "unverified", "changed non-currency figures must be rejected");

const outlier = assessPriceChange({
  periodChangePct: 791.95,
  observedPoints: 12,
  firstObservedAt: "2026-01-01T00:00:00Z",
  lastObservedAt: "2026-07-01T00:00:00Z",
});
assert.equal(outlier.status, "review-required");
assert.equal(outlier.displayPeriodChangePct, null, "outlier must remain auditable but not decision-grade");
assert.ok(outlier.reasons.includes("change-outlier"));

const normalMove = assessPriceChange({
  periodChangePct: 298,
  observedPoints: 12,
  firstObservedAt: "2026-01-01T00:00:00Z",
  lastObservedAt: "2026-07-01T00:00:00Z",
});
assert.equal(normalMove.status, "verified");
assert.equal(normalMove.displayPeriodChangePct, 298);

assert.equal(evidenceClaimLabel({ evidenceLevel: "Confirmed", sourceClass: "official", observedThisRun: true }), "사실(1차 확인)");
assert.equal(evidenceClaimLabel({ evidenceLevel: "Reported", sourceClass: "authoritative-media", observedThisRun: true }), "보도됨(1차 미확인)");
assert.equal(evidenceClaimLabel({ evidenceLevel: "Watch" }), "검증 대기");

assert.equal(supersededNumericClaimReason({
  title: "CXMT IPO fundraising update",
  summary: "CXMT planned to raise US$4.3B in its public offering.",
}), "superseded_by_sse_final_offering", "obsolete CXMT IPO dollar amount must not return to a live card");
assert.equal(supersededNumericClaimReason({
  title: "CXMT registration-stage investment plan",
  summary: "The prospectus described a CNY 29.5 billion investment-project plan before final pricing.",
}), null, "the earlier CNY 29.5B plan remains valid historical context");

const syndicatedA = {
  title: "Micron expands HBM capacity as AI server demand rises - Reuters",
  source: "Reuters",
  sourceUrl: "https://example.com/reuters-micron-hbm",
  date: "2026-07-30",
  summaryOriginal: "Micron said it would expand HBM capacity to serve rising AI server demand.",
};
const syndicatedB = {
  title: "AI server demand prompts Micron to expand its HBM capacity",
  source: "Partner wire",
  sourceUrl: "https://example.net/micron-ai-capacity",
  date: "2026-07-31",
  summaryOriginal: "Micron will expand HBM capacity as demand from AI servers increases.",
};
assert.ok(newsEntityTags(syndicatedA).includes("micron"), "company aliases must become structured entity tags");
assert.equal(sameNewsStory(syndicatedA, syndicatedB), true, "same event with a syndication title must be recognised");
assert.equal(dedupeEnrichedNews([syndicatedA, syndicatedB]).length, 1, "syndicated copies must collapse to one observation");
assert.equal(classifyNewsMeceAxis(syndicatedA), "demand-customers", "each article must receive one MECE axis");
assert.equal(classifyNewsMeceAxis({
  title: "BIS expands export controls on advanced semiconductor equipment",
  category: "policy",
}), "policy-risk");

console.log("evidence integrity tests passed");
