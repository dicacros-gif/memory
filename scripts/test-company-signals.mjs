import assert from "node:assert/strict";
import { buildCompanySignals } from "./company-signals.mjs";
import { selectNewsStreamItems } from "./crawl.mjs";
import { OEM_ODM_AUTOMATION, buildOemOdmQueryPlan, matchingOemOdmAccountIds } from "./oem-odm-automation.mjs";

const accounts = [
  { id: "dell", name: "Dell", aliases: ["Dell Technologies"] },
  // The directory can supply the same account again. It must enrich aliases,
  // not double-count one article.
  { id: "dell", name: "Dell Technologies", aliases: ["PowerEdge"] },
  { id: "quanta-qct", name: "Quanta / QCT", aliases: ["Quanta", "QCT"] },
  { id: "micron", name: "Micron", aliases: ["마이크론"] },
];

const dellArticle = {
  title: "Dell Technologies expands PowerEdge AI systems with HBM4",
  source: "Example",
  sourceUrl: "https://example.com/dell-hbm4",
  date: "2026-08-25",
  ts: Date.parse("2026-08-25T08:00:00Z"),
  language: "english",
};

const first = buildCompanySignals({
  news: [dellArticle],
  accounts,
  now: new Date("2026-08-26T00:00:00Z"),
  runId: "run-a",
});
assert.equal(first.companies.dell.tech[0].label, "HBM4");
assert.equal(first.companies.dell.tech[0].seenCount, 1, "duplicate account aliases must not double-count one article");
assert.equal(first.addedThisRun, 1);
assert.equal(first.coverageThisRun.dell.articleCount, 1);

const replay = buildCompanySignals({
  news: [dellArticle],
  accounts,
  previous: first,
  now: new Date("2026-08-26T01:00:00Z"),
  runId: "run-b",
});
assert.equal(replay.addedThisRun, 0, "replaying the same evidence must be idempotent");
assert.equal(replay.companies.dell.tech[0].seenCount, 1);

const secondArticle = {
  ...dellArticle,
  title: "PowerEdge roadmap keeps HBM4 in the next rack generation",
  sourceUrl: "https://example.com/dell-hbm4-roadmap",
};
const expanded = buildCompanySignals({
  news: [dellArticle, secondArticle],
  accounts,
  previous: replay,
  now: new Date("2026-08-26T02:00:00Z"),
  runId: "run-c",
});
assert.equal(expanded.addedThisRun, 1);
assert.equal(expanded.companies.dell.tech[0].seenCount, 2, "distinct source evidence should increase signal strength once");

const stanceAndTrend = [
  {
    title: "Dell expects Z-Angle memory packaging to expand HBM capacity",
    sourceUrl: "https://example.com/z-angle-dell",
    source: "Example",
    date: "2026-08-25",
  },
  {
    title: "Industry lab validates Z-Angle memory packaging for accelerator capacity",
    sourceUrl: "https://example.com/z-angle-lab",
    source: "Example",
    date: "2026-08-25",
  },
  {
    title: "775 micron memory pitch enters packaging discussion",
    sourceUrl: "https://example.com/775-micron",
    source: "Example",
    date: "2026-08-25",
  },
];
const discovery = buildCompanySignals({
  news: stanceAndTrend,
  accounts,
  now: new Date("2026-08-26T03:00:00Z"),
  runId: "run-discovery",
});
assert.equal(discovery.companies.dell.stances[0].verb, "expects", "company position should survive as a structured signal");
assert.equal(discovery.trendCandidates[0].term, "Z-Angle");
assert.equal(discovery.trendCandidates[0].seenCount, 2);
assert.equal(discovery.coverageThisRun.micron.articleCount, 0, "a measurement must not be mistaken for Micron the company");

const discoveryReplay = buildCompanySignals({
  news: stanceAndTrend,
  accounts,
  previous: discovery,
  now: new Date("2026-08-26T04:00:00Z"),
  runId: "run-discovery-replay",
});
assert.equal(discoveryReplay.trendCandidates[0].seenCount, 2, "replaying a discovery must not inflate the trend count");
assert.equal(discoveryReplay.companies.dell.stances[0].seenCount, 1, "replaying a position must remain idempotent");

const guarded = buildCompanySignals({
  news: [{
    title: "OpenAI Jalapeño outperforms GB300 with Samsung HBM4",
    sourceUrl: "https://example.com/unverified-jalapeno",
    source: "Secondary report",
    date: "2026-08-26",
  }],
  accounts: [{ id: "openai", name: "OpenAI" }],
  previous: {
    companies: {
      openai: {
        tech: [{
          key: "tech:GB300",
          label: "GB300",
          headline: "OpenAI Jalapeño 출시 · 삼성 HBM4 공급",
          url: "https://example.com/carried-rumour",
          asOf: "2026-08-26",
        }],
      },
    },
  },
  now: new Date("2026-08-26T05:00:00Z"),
  runId: "run-claim-guard",
});
assert.equal(guarded.companies.openai, undefined, "unverified Jalapeño performance and supplier claims must not become structured facts");

const verifiedJalapeno = buildCompanySignals({
  news: [{
    title: "OpenAI Jalapeño Custom ASIC first results",
    summary: "Against GB200 and GB300 on disclosed workloads, OpenAI InferenceX measures the Custom ASIC at 1.5–1.9x peak AI work per watt and 1.7–3.6x lower latency.",
    sourceUrl: "https://openai.com/index/jalapeno-first-results/",
    source: "OpenAI",
    date: "2026-08-25",
  }],
  accounts: [{ id: "openai", name: "OpenAI" }],
  now: new Date("2026-08-26T05:10:00Z"),
  runId: "run-verified-jalapeno",
});
assert.ok(verifiedJalapeno.companies.openai,
  "OpenAI's first-party Jalapeño measurements must remain eligible for structured signals");

const forgedOfficialSupplierSignal = buildCompanySignals({
  news: [{
    title: "OpenAI Jalapeño Custom ASIC uses Micron HBM4",
    summary: "Micron supplies HBM4 for OpenAI Jalapeño.",
    sourceUrl: "https://openai.com/index/jalapeno-first-results/",
    source: "OpenAI",
    date: "2026-08-25",
  }],
  accounts: [{ id: "openai", name: "OpenAI" }],
  now: new Date("2026-08-26T05:20:00Z"),
});
assert.equal(forgedOfficialSupplierSignal.companies.openai, undefined,
  "an official results URL must not promote an undisclosed HBM supplier into company signals");

const embeddedOfficialSignal = buildCompanySignals({
  news: [{
    title: "OpenAI Jalapeño Custom ASIC beats GB300",
    summary: "A secondary report embeds https://openai.com/index/jalapeno-first-results/ but claims blanket superiority.",
    sourceUrl: "https://example.com/secondary-openai-report",
    source: "Secondary report",
    date: "2026-08-25",
  }],
  accounts: [{ id: "openai", name: "OpenAI" }],
  now: new Date("2026-08-26T05:30:00Z"),
});
assert.equal(embeddedOfficialSignal.companies.openai, undefined,
  "an official URL embedded in article text must not make secondary claims eligible");

const announcementBenchmarkSignal = buildCompanySignals({
  news: [{
    title: "OpenAI Jalapeño Custom ASIC engineering sample beats GB300",
    summary: "The engineering sample posts 1.5–1.9x peak AI work per watt.",
    sourceUrl: "https://openai.com/index/openai-broadcom-jalapeno-inference-chip/",
    source: "OpenAI",
    date: "2026-08-25",
  }],
  accounts: [{ id: "openai", name: "OpenAI" }],
  now: new Date("2026-08-26T05:40:00Z"),
});
assert.equal(announcementBenchmarkSignal.companies.openai, undefined,
  "the engineering announcement must not promote later performance results");

const roundup = buildCompanySignals({
  news: [{
    title: "Dell and Samsung infrastructure roundup",
    summary: `Dell expands PowerEdge systems. ${"rack architecture ".repeat(30)} Samsung announces HBM4 qualification.`,
    sourceUrl: "https://example.com/roundup",
    source: "Example",
    date: "2026-08-26",
  }],
  accounts: [
    { id: "dell", name: "Dell" },
    { id: "samsung", name: "Samsung" },
  ],
  now: new Date("2026-08-26T06:00:00Z"),
});
assert.equal(roundup.companies.dell, undefined,
  "a technology far from the company mention must not be attributed to that company");
assert.equal(roundup.companies.samsung.tech[0].label, "HBM4",
  "the same roundup must still retain technology stated beside its actual company");

const quantaArticle = {
  title: "Quanta expands AI server rack production",
  sourceUrl: "https://example.com/quanta-rack",
  date: "2026-08-24",
  ts: Date.parse("2026-08-24T08:00:00Z"),
  language: "english",
  category: "oem_odm",
};
assert.deepEqual(matchingOemOdmAccountIds(quantaArticle), ["quanta-qct"]);

const selected = selectNewsStreamItems([
  { ...dellArticle, category: "hbm" },
  quantaArticle,
  { title: "Newest generic memory story", sourceUrl: "https://example.com/generic", ts: Date.now(), language: "english", category: "hbm" },
], 3);
assert.equal(selected.length, 3);
assert(selected.some((item) => item.sourceUrl === dellArticle.sourceUrl), "Dell coverage must survive the stream cap");
assert(selected.some((item) => item.sourceUrl === quantaArticle.sourceUrl), "Quanta coverage must survive the stream cap");

const queryPlan = buildOemOdmQueryPlan();
assert.equal(new Set(queryPlan.map((entry) => entry.query)).size, queryPlan.length, "query plan must be deduplicated");
assert.equal(OEM_ODM_AUTOMATION.length, 12);
assert.equal(OEM_ODM_AUTOMATION.find((entry) => entry.id === "fujitsu")?.queryStatus, "no-productive-query");

console.log("company signal automation test passed");
