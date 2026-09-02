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
assert.ok(chineseCurrencyTranslation.reasons.includes("currency-mismatch:CNY"), "Chinese magnitudes must be parsed as money, not waived as plain-number mismatches");

const equivalentNumericTranslations = [
  ["长鑫科技计划募资295亿元。", "CXMT는 295억 위안을 조달할 계획입니다.", "simplified Chinese 亿 and Korean 억"],
  ["存货金额为30.07亿元。", "재고는 30억700만위안입니다.", "fractional 亿 and compound 억/만"],
  ["營收人民幣30.07億元。", "매출은 30억 700만 위안입니다.", "explicit traditional CNY"],
  ["面板出货22.5億片。", "패널 출하량은 22억5000만개입니다.", "non-monetary traditional magnitude"],
  ["月产能20万片。", "월 생산능력은 200,000장입니다.", "non-monetary simplified magnitude"],
  ["需要3~4萬顆閥門。", "밸브는 30,000~40,000개 필요합니다.", "range with shared trailing magnitude"],
  ["有8成會員支持。", "회원의 80%가 지지합니다.", "成 means ten percentage points per unit"],
  ["成本占3~4成。", "비용 비중은 30~40%입니다.", "range with shared 成"],
  ["公司投资2,000,000美元。", "회사는 200만 달러를 투자했습니다.", "multiple comma groups"],
  ["公司投资1,100.5万美元。", "회사는 1100만5천달러를 투자했습니다.", "grouped decimal and compound Korean magnitude"],
  ["公司收入新台幣1,100億元。", "회사 매출은 NT$1,100억입니다.", "explicit Taiwan currency overrides bare 元"],
  ["公司收入新台币1100亿元。", "회사 매출은 1100억 대만달러입니다.", "simplified Taiwan currency must remain TWD"],
  ["Revenue was USD 0.29 billion.", "매출은 2억9000만 달러였습니다.", "decimal conversion is exact, without binary floating-point rounding"],
  ["投入0美元。", "투자액은 0달러입니다.", "zero currency amount"],
  ["收入-100美元。", "매출은 -100달러입니다.", "negative sign adjacent to Chinese prose"],
  ["損失人民幣-1.2億元。", "손실은 -1억2000만 위안입니다.", "negative compound amount applies sign to the whole amount"],
  ["Price: $.5.", "가격은 0.5달러입니다.", "leading decimal point"],
  ["In 2026, revenue was $100.", "2026년 매출은 100달러였습니다.", "sentence comma is not part of a number"],
  ["2026-09-03", "2026년 9월 3일", "date hyphens are not negative signs or ranges"],
  ["公司投资5百万元。", "회사는 500만 위안을 투자했습니다.", "supported Chinese compound magnitude is not an unparsed written number"],
];
for (const [original, translated, label] of equivalentNumericTranslations) {
  const audit = auditTranslationFidelity(original, translated);
  assert.equal(audit.status, "verified", `${label}: ${audit.reasons.join(", ")}`);
  assert.equal(audit.tokenMatchPct, 100, label);
}

const distortedNumericTranslations = [
  ["存货金额为30.07亿元。", "재고는 30억7천만 위안입니다.", "the stored 30.07亿元 mistranslation must be rejected"],
  ["公司投资100美元。", "회사는 101달러를 투자했습니다.", "no blanket 1.5 percent amount tolerance"],
  ["公司投资295亿元。", "회사는 295개 공장을 건설했습니다.", "currency cannot become an unrelated count"],
  ["公司签署16项协议。", "회사는 18개 계약을 체결했습니다.", "Chinese prose does not excuse a changed number"],
  ["月产能20万片。", "월 생산능력은 2,000,000장입니다.", "tenfold production-volume error"],
  ["需要3~4萬。", "수요는 30,000~400,000입니다.", "range endpoints must both match"],
  ["需要3~4萬。", "수요는 40,000~30,000입니다.", "range direction cannot be reversed"],
  ["有8成會員支持。", "회원의 8%가 지지합니다.", "成 conversion cannot lose its factor of ten"],
  ["公司投资100美元。", "회사는 100달러를 투자하고 공장999개를 건설했습니다.", "target-only numeric claims"],
  ["公司投资100美元。", "회사는 100달러와 100달러를 투자했습니다.", "target-only repeated currency amount"],
  ["The company paid $100 and $100.", "회사는 100달러를 지급했습니다.", "one amount cannot satisfy two source occurrences"],
  ["2025年和2025年", "2025년", "one number cannot satisfy two source occurrences"],
  ["The company plans an expansion.", "회사는 공장 3개를 확장할 계획입니다.", "added number with a number-free source"],
  ["公司收入新台幣1,100億元。", "회사 매출은 1100억 위안입니다.", "TWD cannot become CNY"],
  ["公司收入1,100億元。", "회사 매출은 1100억 위안입니다.", "bare traditional 元 is not established as CNY"],
  ["售价100元。", "판매가는 100위안입니다.", "bare 元 without a supported currency context is ambiguous"],
  ["Price ¥100.", "가격은 100엔입니다.", "ambiguous yen/yuan symbol"],
  ["公司投资1,10美元。", "회사는 110달러를 투자했습니다.", "malformed comma groups must fail closed"],
  ["公司投资五亿元。", "회사는 5억 위안을 투자했습니다.", "unsupported written-out Chinese number"],
  ["公司投资2京美元。", "회사는 2달러를 투자했습니다.", "unsupported magnitude cannot be silently dropped"],
  ["公司投资USD 2京。", "회사는 2달러를 투자했습니다.", "currency prefix cannot hide an unsupported magnitude"],
  ["收入-100美元。", "매출은 100달러입니다.", "negative sign cannot be silently dropped"],
  ["Growth was 8%.", "성장률은 8입니다.", "percent unit cannot be silently dropped"],
  ["Growth was 8 percentage points.", "성장률은 8%입니다.", "percentage points are not percent"],
  ["Price: $.5.", "가격은 5달러입니다.", "leading decimal point cannot be silently dropped"],
  ["The amount was $9007199254740993.", "금액은 9007199254740992달러였습니다.", "integers beyond Number.MAX_SAFE_INTEGER remain distinct"],
];
for (const [original, translated, label] of distortedNumericTranslations) {
  assert.equal(auditTranslationFidelity(original, translated).status, "unverified", label);
}

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
