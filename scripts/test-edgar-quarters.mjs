import assert from "node:assert/strict";
import { micronFundamentalsFromFacts } from "./crawl.mjs";

// Micron FY2026 shape: three 10-Q quarters, then a 10-K that carries the
// fiscal year (not its fourth quarter) and the year-end balance sheet.
const quarter = (start, end, val, fp, form = "10-Q") => ({ start, end, val, fp, form, fy: 2026, filed: "2026-06-25" });
const facts = { facts: { "us-gaap": {
  RevenueFromContractWithCustomerExcludingAssessedTax: { units: { USD: [
    quarter("2025-08-29", "2025-11-27", 13643e6, "Q1"),
    quarter("2025-11-28", "2026-02-26", 23860e6, "Q2"),
    quarter("2026-02-27", "2026-05-28", 41456e6, "Q3"),
    { start: "2025-08-29", end: "2026-09-03", val: 140000e6, fp: "FY", form: "10-K", fy: 2026, filed: "2026-10-15" },
  ] } },
  GrossProfit: { units: { USD: [
    quarter("2025-08-29", "2025-11-27", 7646e6, "Q1"),
    quarter("2025-11-28", "2026-02-26", 17755e6, "Q2"),
    quarter("2026-02-27", "2026-05-28", 35056e6, "Q3"),
    { start: "2025-08-29", end: "2026-09-03", val: 110000e6, fp: "FY", form: "10-K", fy: 2026, filed: "2026-10-15" },
  ] } },
  InventoryNet: { units: { USD: [{ end: "2026-09-03", val: 10372e6, form: "10-K", fy: 2026, fp: "FY", filed: "2026-10-15" }] } },
} } };

const result = micronFundamentalsFromFacts(facts);
const q4 = result.history.revenue.at(-1);
assert.equal(q4.date, "2026-09-03", "the 10-K year-end becomes the latest quarter");
assert.equal(q4.value, 140000e6 - 13643e6 - 23860e6 - 41456e6, "Q4 = FY - (Q1+Q2+Q3)");
assert.equal(q4.fp, "Q4");
assert.equal(q4.derived, "FY-9M", "a derived quarter says so");
assert.equal(q4.start, "2026-05-29");
assert.equal(result.history.grossProfit.at(-1).value, 110000e6 - 7646e6 - 17755e6 - 35056e6);
assert.equal(result.revenue.end, "2026-09-03", "the headline quarter follows the derived history");
assert.equal(result.revenue.derived, "FY-9M");

// With a quarter missing the fourth quarter cannot be derived and is not.
const gap = structuredClone(facts);
gap.facts["us-gaap"].RevenueFromContractWithCustomerExcludingAssessedTax.units.USD.splice(1, 1);
const partial = micronFundamentalsFromFacts(gap);
assert.equal(partial.history.revenue.at(-1).date, "2026-05-28", "no derivation without all three quarters");

console.log(JSON.stringify({ edgarQuarters: "pass" }));
