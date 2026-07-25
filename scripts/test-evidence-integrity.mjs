import assert from "node:assert/strict";
import {
  assessPriceChange,
  auditTranslationFidelity,
  evidenceClaimLabel,
} from "./evidence-integrity.mjs";

const correctCnyTranslation = auditTranslationFidelity(
  "The exchange approved a CNY 29.5 billion plan with a 15 percent greenshoe.",
  "거래소는 295억 위안 계획과 15% 초과배정을 승인했습니다.",
);
assert.equal(correctCnyTranslation.status, "verified", "CNY billion and Korean 억 must normalise to the same amount");
assert.equal(correctCnyTranslation.tokenMatchPct, 100);

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

console.log("evidence integrity tests passed");
