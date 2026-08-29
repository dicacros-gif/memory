#!/usr/bin/env node
/**
 * SKHY memory intelligence crawler.
 *
 * Collects public memory price tables, listed peer stocks, memory news,
 * competitor signals, and startup radar data for the static dashboard.
 * Node 18+ only; no external dependencies.
 */
import { readFile, writeFile, mkdir, rename, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { request as httpsRequest } from "node:https";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  STRATEGY_ACCOUNT_REGISTRY,
  buildAgentBriefing,
  buildBaselineFreshness,
  buildDemandAccountSignals,
  buildStrategyAccountIntelligence,
  buildIndustryPulse,
  buildRelationCandidates,
} from "./live-pipeline.mjs";
import {
  buildQuantBacktestSummary,
  calculateAllHorizonStats,
} from "./quant-history.mjs";
import {
  assessPriceChange,
  auditTranslationFidelity,
  evidenceClaimLabel,
  supersededNumericClaimReason,
} from "./evidence-integrity.mjs";
import {
  createGoogleKoTranslator,
  koreanTranslationQualityGate,
  normalizeKoreanDisplayPayload,
  normalizeKoreanPayload,
  normalizeKoreanTerminology,
  translationCacheKey,
} from "./translation-pipeline.mjs";
import {
  crawlExclusionKeySet,
  crawlModerationKeys as sharedCrawlModerationKeys,
  purgeCrawlExclusions,
} from "./crawl-exclusions.mjs";
import { buildSiteContentClient } from "./site-content.mjs";
import { buildCompanyDirectory, setObservedCapital, setCompanySignals, setMemoryDemand, setSiliconMap, setPainPoints, setStrategyOpportunities, setOrgSignals } from "./company-directory.mjs";
import { buildInsightLedger } from "./insight-ledger.mjs";
import { buildCapitalSignals } from "./capital-signals.mjs";
import { buildCompanySignals } from "./company-signals.mjs";
import { deriveMemoryDemand } from "./memory-demand.mjs";
import { buildSiliconMap } from "./silicon-map.mjs";
import { buildPainPoints } from "./pain-points.mjs";
import { buildStrategyOpportunities } from "./strategy-opportunities.mjs";
import { buildOrgSignals } from "./org-signals.mjs";
import { OEM_ODM_AUTOMATION, buildOemOdmQueryPlan, matchingOemOdmAccountIds } from "./oem-odm-automation.mjs";
import {
  buildSourceCatalogSnapshot,
  catalogSourceForUrl,
  loadSourceCatalog,
  sourceCatalogDiscoveryMonitors,
  sourceCatalogHealthProbes,
} from "./source-catalog.mjs";
import {
  buildDecisionIntelligence,
  decisionMetric,
  htmlToDecisionText,
  loadIntelligencePolicy,
} from "./decision-intelligence.mjs";
import {
  buildRefreshRequest,
  isDuplicateRefreshRequest,
  recordRefreshRequest,
  validateRefreshLedger,
} from "./refresh-orchestration.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "data", "live.json");
const HISTORY_OUT = resolve(__dirname, "..", "data", "price-history.json");
const MARKET_HISTORY_OUT = resolve(__dirname, "..", "data", "market-history.json");
const QUANT_BACKTEST_OUT = resolve(__dirname, "..", "data", "quant-backtest.json");
const LIVE_CLIENT_OUT = resolve(__dirname, "..", "data", "live-client.json");
const QUANT_CLIENT_OUT = resolve(__dirname, "..", "data", "quant-client.json");
const PRICE_HISTORY_CLIENT_OUT = resolve(__dirname, "..", "data", "price-history-client.json");
const MARKET_HISTORY_CLIENT_OUT = resolve(__dirname, "..", "data", "market-history-client.json");
const QUANT_BACKTEST_CLIENT_OUT = resolve(__dirname, "..", "data", "quant-backtest-client.json");
const DECISION_HISTORY_CLIENT_OUT = resolve(__dirname, "..", "data", "decision-history-client.json");
const INSIGHT_LEDGER_OUT = resolve(__dirname, "..", "data", "insight-ledger.json");
const COMPANY_SIGNALS_OUT = resolve(__dirname, "..", "data", "company-signals.json");
const MEMORY_DEMAND_OUT = resolve(__dirname, "..", "data", "memory-demand.json");
const SILICON_MAP_OUT = resolve(__dirname, "..", "data", "silicon-map.json");
const PAIN_POINTS_OUT = resolve(__dirname, "..", "data", "pain-points.json");
const ORG_SIGNALS_OUT = resolve(__dirname, "..", "data", "org-signals.json");
const LANDING_DECISION_CLIENT_OUT = resolve(__dirname, "..", "data", "landing-decision-client.json");
const SITE_CONTENT_CLIENT_OUT = resolve(__dirname, "..", "data", "site-content-client.json");
const SITE_CONTENT_EXTENDED_CLIENT_OUT = resolve(__dirname, "..", "data", "site-content-extended-client.json");
const COMPANY_DIRECTORY_CLIENT_OUT = resolve(__dirname, "..", "data", "company-directory-client.json");
const DATA_MANIFEST_OUT = resolve(__dirname, "..", "data", "data-manifest.json");
const CRAWL_EXCLUSIONS_OUT = resolve(__dirname, "..", "data", "crawl-exclusions.json");
const CRAWL_AUDIT_OUT = resolve(__dirname, "..", "data", "crawl-audit.json");
const CRAWL_QUARANTINE_OUT = resolve(__dirname, "..", "data", "crawl-quarantine.json");
const TRANSLATION_CACHE_OUT = resolve(__dirname, "..", "data", "translation-cache.json");
const REFRESH_EVENTS_OUT = resolve(__dirname, "..", "data", "refresh-events.json");
const REFRESH_STATUS_OUT = resolve(__dirname, "..", "data", "refresh-status.json");
const QUANT_OUT = resolve(__dirname, "..", "data", "quant.json");
const QUANT_MODEL_IN = resolve(__dirname, "..", "data", "quant-model.json");
const BASELINE_IN = resolve(__dirname, "..", "data", "baseline.json");
const SOURCE_CATALOG = loadSourceCatalog();
const INTELLIGENCE_POLICY = loadIntelligencePolicy();
const CATALOG_DISCOVERY_MONITORS = sourceCatalogDiscoveryMonitors(SOURCE_CATALOG);
const CATALOG_OFFICIAL_PROBES = sourceCatalogHealthProbes(SOURCE_CATALOG);
const LIVE_SCHEMA_VERSION = "4.0";
const EVIDENCE_METHODOLOGY_VERSION = "4.0-source-provenance";
const TRENDFORCE_ORIGIN = "https://www.trendforce.com";
const PRICE_HISTORY_LOOKBACK_DAYS = 365 * 5;
const PRICE_HISTORY_RETENTION_POINTS = 365 * 5 + 60;
const MARKET_HISTORY_LOOKBACK_DAYS = 365 * 5;
const MARKET_HISTORY_RETENTION_POINTS = 365 * 5 + 60;
const NEWS_STREAM_LIMIT = 48;
const NEWS_ENRICH_CONCURRENCY = 4;
const NEWS_PROVIDER_FAILURE_LIMIT = 3;
const OEM_ODM_QUERY_PLAN = buildOemOdmQueryPlan();
const COMMUNITY_MAX_ITEMS = 96;
const COMMUNITY_RETENTION_DAYS = 365 * 5;
const KST_DAY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 12_000;
const SOURCE_TIMEOUT_MS = Object.freeze({
  default: FETCH_TIMEOUT_MS,
  news: 8_000,
  price: 16_000,
  official: 14_000,
  document: 10_000,
});
// Headline translation is a convenience layer, never a reason to prevent a
// validated crawl bundle from being published.  The public endpoint can rate
// limit or stall without returning an error, so keep its timeout and total
// crawl budget deliberately smaller than primary-source collection.
const KO_TRANSLATION_TIMEOUT_MS = Math.max(1_000, Number(process.env.KO_TRANSLATION_TIMEOUT_MS || 8_000));
const KO_TRANSLATION_BUDGET_MS = Math.max(0, Number(process.env.KO_TRANSLATION_BUDGET_MS || 300_000));
const KO_BRIEF_TRANSLATION_RESERVE_MS = Math.max(0, Number(process.env.KO_BRIEF_TRANSLATION_RESERVE_MS || 30_000));
const SKIP_KO_TRANSLATION = /^(?:1|true|yes)$/i.test(
  String(process.env.CRAWL_SKIP_KO_TRANSLATION || process.env.SKIP_KO_TRANSLATION || ""),
);
const CRAWL_RECOVERY_MODE = /^(?:1|true|yes)$/i.test(String(process.env.CRAWL_RECOVERY_MODE || ""));

function fetchSignal(source = "default") {
  const timeout = Number(SOURCE_TIMEOUT_MS[source] || SOURCE_TIMEOUT_MS.default);
  return AbortSignal.timeout(timeout);
}

function sourceTimeoutClass(url = "") {
  const value = String(url || "").toLowerCase();
  if (/trendforce|price|dramexchange/.test(value)) return "price";
  if (/news\.google|google\.com\/_\/dotssplashui/.test(value)) return "news";
  if (/sec\.gov|twse|wsts|semiconductors\.org|investor\.tsmc\.com|\.gov\//.test(value)) return "official";
  if (/\.pdf(?:$|[?#])/.test(value)) return "document";
  return "default";
}

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
let crawlExclusionKeys = new Set();

function normalizeCrawlExclusionUrl(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    parsed.hash = "";
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
      parsed.searchParams.delete(key);
    }
    return parsed.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return raw.replace(/#.*$/, "").replace(/\/$/, "").toLowerCase();
  }
}

function normalizeCrawlExclusionText(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣一-鿿]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function crawlModerationKeys(type = "data", item = {}) {
  const prefix = String(type || "data").toLowerCase();
  const keys = [];
  const add = (kind, value) => {
    const clean = String(value || "").trim();
    if (clean) keys.push(`${prefix}:${kind}:${clean}`);
  };

  if (prefix === "price") {
    add("history", item.historyKey);
    const signature = [item.sectionTitle || item.group, item.item]
      .map(normalizeCrawlExclusionText)
      .filter(Boolean)
      .join("|");
    add("item", signature);
  } else {
    [item.sourceUrl, item.link, item.url].forEach((value) => add("url", normalizeCrawlExclusionUrl(value)));
    add("id", normalizeCrawlExclusionText(item.id));
    const signature = [item.title || item.titleKo, item.source || item.platform]
      .map(normalizeCrawlExclusionText)
      .filter(Boolean)
      .join("|");
    add("title", signature);
  }
  return Array.from(new Set(keys));
}

function isCrawlerExcluded(type, item = {}) {
  const requestedType = String(type || "").toLowerCase();
  const types = ["news", "research"].includes(requestedType)
    ? ["news", "research"]
    : [requestedType];
  return types.some((candidateType) => sharedCrawlModerationKeys(candidateType, item)
    .some((key) => crawlExclusionKeys.has(key)));
}

async function loadCrawlExclusions() {
  try {
    const parsed = JSON.parse(await readFile(CRAWL_EXCLUSIONS_OUT, "utf8"));
    crawlExclusionKeys = crawlExclusionKeySet(parsed);
    console.log(`크롤 제외 목록: ${crawlExclusionKeys.size}개 식별 키`);
  } catch (error) {
    crawlExclusionKeys = new Set();
    console.log(`크롤 제외 목록 없음: ${error.message}`);
  }
}

const TICKERS = [
  { id: "samsung", label: "삼성전자", symbol: "005930.KS", currency: "KRW" },
  { id: "skhynix", label: "SKHY", symbol: "000660.KS", currency: "KRW" },
  { id: "micron", label: "Micron", symbol: "MU", currency: "USD" },
];

const STOCK_MAX_AGE_DAYS = 5;

function equityIndex(id, symbol, label, labelKo = label) {
  return {
    id,
    symbol,
    label,
    labelKo,
    source: "Yahoo Finance chart API",
    sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/`,
  };
}

const MARKET_EQUITY_META = {
  "skhy-stock": { region: "global", valueChain: "memory", exchange: "KRX", shortName: "SK hynix" },
  "samsung-stock": { region: "global", valueChain: "memory", exchange: "KRX", shortName: "Samsung" },
  "micron-stock": { region: "global", valueChain: "memory", exchange: "NASDAQ", shortName: "Micron" },
  "sandisk-stock": { region: "global", valueChain: "memory", exchange: "NASDAQ", shortName: "SanDisk" },
  "wdc-stock": { region: "global", valueChain: "memory", exchange: "NASDAQ", shortName: "Western Digital" },
  "kioxia-stock": { region: "global", valueChain: "memory", exchange: "TSE", shortName: "Kioxia" },
  "nvidia-stock": { region: "global", valueChain: "ai-chip", exchange: "NASDAQ", shortName: "NVIDIA" },
  "amd-stock": { region: "global", valueChain: "ai-chip", exchange: "NASDAQ", shortName: "AMD" },
  "broadcom-stock": { region: "global", valueChain: "ai-chip", exchange: "NASDAQ", shortName: "Broadcom" },
  "marvell-stock": { region: "global", valueChain: "ai-chip", exchange: "NASDAQ", shortName: "Marvell" },
  "qualcomm-stock": { region: "global", valueChain: "ai-chip", exchange: "NASDAQ", shortName: "Qualcomm" },
  "arm-stock": { region: "global", valueChain: "design-ip", exchange: "NASDAQ", shortName: "Arm" },
  "synopsys-stock": { region: "global", valueChain: "design-ip", exchange: "NASDAQ", shortName: "Synopsys" },
  "cadence-stock": { region: "global", valueChain: "design-ip", exchange: "NASDAQ", shortName: "Cadence" },
  "tsmc-stock": { region: "global", valueChain: "foundry", exchange: "NYSE", shortName: "TSMC" },
  "umc-stock": { region: "global", valueChain: "foundry", exchange: "NYSE", shortName: "UMC" },
  "globalfoundries-stock": { region: "global", valueChain: "foundry", exchange: "NASDAQ", shortName: "GlobalFoundries" },
  "asml-stock": { region: "global", valueChain: "equipment", exchange: "NASDAQ", shortName: "ASML" },
  "applied-materials-stock": { region: "global", valueChain: "equipment", exchange: "NASDAQ", shortName: "Applied Materials" },
  "lam-research-stock": { region: "global", valueChain: "equipment", exchange: "NASDAQ", shortName: "Lam Research" },
  "kla-stock": { region: "global", valueChain: "equipment", exchange: "NASDAQ", shortName: "KLA" },
  "tokyo-electron-stock": { region: "global", valueChain: "equipment", exchange: "TSE", shortName: "Tokyo Electron" },
  "kokusai-stock": { region: "global", valueChain: "equipment", exchange: "TSE", shortName: "Kokusai Electric" },
  "asm-stock": { region: "global", valueChain: "equipment", exchange: "Euronext Amsterdam", shortName: "ASM International" },
  "axcelis-stock": { region: "global", valueChain: "equipment", exchange: "NASDAQ", shortName: "Axcelis" },
  "onto-stock": { region: "global", valueChain: "equipment", exchange: "NYSE", shortName: "Onto Innovation" },
  "entegris-stock": { region: "global", valueChain: "materials", exchange: "NASDAQ", shortName: "Entegris" },
  "shinetsu-stock": { region: "global", valueChain: "materials", exchange: "TSE", shortName: "Shin-Etsu" },
  "sumco-stock": { region: "global", valueChain: "materials", exchange: "TSE", shortName: "SUMCO" },
  "globalwafers-stock": { region: "global", valueChain: "materials", exchange: "Taipei Exchange", shortName: "GlobalWafers" },
  "ase-stock": { region: "global", valueChain: "packaging", exchange: "NYSE", shortName: "ASE" },
  "amkor-stock": { region: "global", valueChain: "packaging", exchange: "NASDAQ", shortName: "Amkor" },
  "teradyne-stock": { region: "global", valueChain: "packaging", exchange: "NASDAQ", shortName: "Teradyne" },
  "advantest-stock": { region: "global", valueChain: "packaging", exchange: "TSE", shortName: "Advantest" },
  "disco-stock": { region: "global", valueChain: "packaging", exchange: "TSE", shortName: "DISCO" },
  "besi-stock": { region: "global", valueChain: "packaging", exchange: "Euronext Amsterdam", shortName: "BESI" },
  "arista-stock": { region: "global", valueChain: "interconnect", exchange: "NYSE", shortName: "Arista" },
  "coherent-stock": { region: "global", valueChain: "interconnect", exchange: "NYSE", shortName: "Coherent" },
  "lumentum-stock": { region: "global", valueChain: "interconnect", exchange: "NASDAQ", shortName: "Lumentum" },
  "astera-stock": { region: "global", valueChain: "interconnect", exchange: "NASDAQ", shortName: "Astera Labs" },
  "credo-stock": { region: "global", valueChain: "interconnect", exchange: "NASDAQ", shortName: "Credo" },
  "vertiv-stock": { region: "global", valueChain: "infrastructure", exchange: "NYSE", shortName: "Vertiv" },
  "eaton-stock": { region: "global", valueChain: "infrastructure", exchange: "NYSE", shortName: "Eaton" },
  "supermicro-stock": { region: "global", valueChain: "infrastructure", exchange: "NASDAQ", shortName: "Supermicro" },
  "dell-stock": { region: "global", valueChain: "infrastructure", exchange: "NYSE", shortName: "Dell" },
  "celestica-stock": { region: "global", valueChain: "infrastructure", exchange: "NYSE", shortName: "Celestica" },
  "honhai-stock": { region: "global", valueChain: "infrastructure", exchange: "TWSE", shortName: "Hon Hai" },
  "quanta-stock": { region: "global", valueChain: "infrastructure", exchange: "TWSE", shortName: "Quanta" },
  "inventec-stock": { region: "global", valueChain: "infrastructure", exchange: "TWSE", shortName: "Inventec" },
  "monolithic-power-stock": { region: "global", valueChain: "infrastructure", exchange: "NASDAQ", shortName: "Monolithic Power" },
  "rambus-stock": { region: "global", valueChain: "memory", exchange: "NASDAQ", shortName: "Rambus" },
  "seagate-stock": { region: "global", valueChain: "memory", exchange: "NASDAQ", shortName: "Seagate" },
  "silicon-motion-stock": { region: "global", valueChain: "memory", exchange: "NASDAQ", shortName: "Silicon Motion" },

  "cxmt-stock": {
    region: "china",
    valueChain: "memory",
    exchange: "SSE STAR",
    shortName: "CXMT",
    listedAt: "2026-07-27",
    newListing: true,
    officialSourceUrl: "https://www.sse.com.cn/assortment/stock/list/info/announcement/",
    quoteReference: "Investing.com",
    quoteReferenceUrl: "https://kr.investing.com/equities/cxmt-corp",
    quoteReferenceCurrency: "CNY",
  },
  "gigadevice-stock": { region: "china", valueChain: "memory", exchange: "SSE", shortName: "GigaDevice" },
  "biwin-stock": { region: "china", valueChain: "memory", exchange: "SSE STAR", shortName: "BIWIN" },
  "longsys-stock": { region: "china", valueChain: "memory", exchange: "SZSE ChiNext", shortName: "Longsys" },
  "smic-stock": { region: "china", valueChain: "foundry", exchange: "SSE STAR", shortName: "SMIC" },
  "hua-hong-stock": { region: "china", valueChain: "foundry", exchange: "SSE STAR", shortName: "Hua Hong" },
  "naura-stock": { region: "china", valueChain: "equipment", exchange: "SZSE", shortName: "NAURA" },
  "amec-stock": { region: "china", valueChain: "equipment", exchange: "SSE STAR", shortName: "AMEC" },
  "acm-shanghai-stock": { region: "china", valueChain: "equipment", exchange: "SSE STAR", shortName: "ACM Shanghai" },
  "piotech-stock": { region: "china", valueChain: "equipment", exchange: "SSE STAR", shortName: "Piotech" },
  "kingsemi-stock": { region: "china", valueChain: "equipment", exchange: "SSE STAR", shortName: "Kingsemi" },
  "hwatsing-stock": { region: "china", valueChain: "equipment", exchange: "SSE STAR", shortName: "Hwatsing" },
  "jcet-stock": { region: "china", valueChain: "packaging", exchange: "SSE", shortName: "JCET" },
  "tongfu-stock": { region: "china", valueChain: "packaging", exchange: "SZSE", shortName: "Tongfu" },
  "huatian-stock": { region: "china", valueChain: "packaging", exchange: "SZSE", shortName: "Huatian" },
  "montage-stock": { region: "china", valueChain: "design-ip", exchange: "SSE STAR", shortName: "Montage" },
  "verisilicon-stock": { region: "china", valueChain: "design-ip", exchange: "SSE STAR", shortName: "VeriSilicon" },
  "empyrean-stock": { region: "china", valueChain: "design-ip", exchange: "SZSE ChiNext", shortName: "Empyrean" },
  "primarius-stock": { region: "china", valueChain: "design-ip", exchange: "SSE STAR", shortName: "Primarius" },
  "rockchip-stock": { region: "china", valueChain: "ai-chip", exchange: "SSE", shortName: "Rockchip" },
  "loongson-stock": { region: "china", valueChain: "ai-chip", exchange: "SSE STAR", shortName: "Loongson" },
  "cambricon-stock": { region: "china", valueChain: "ai-chip", exchange: "SSE STAR", shortName: "Cambricon" },
  "hygon-stock": { region: "china", valueChain: "ai-chip", exchange: "SSE STAR", shortName: "Hygon" },
  "omnivision-stock": { region: "china", valueChain: "analog-power", exchange: "SSE", shortName: "OmniVision" },
  "wingtech-stock": { region: "china", valueChain: "analog-power", exchange: "SSE", shortName: "Wingtech" },
  "silan-stock": { region: "china", valueChain: "analog-power", exchange: "SSE", shortName: "Silan Micro" },
  "anji-stock": { region: "china", valueChain: "materials", exchange: "SSE STAR", shortName: "Anji Micro" },
  "nsig-stock": { region: "china", valueChain: "materials", exchange: "SSE STAR", shortName: "NSIG" },
  "kfmi-stock": { region: "china", valueChain: "materials", exchange: "SZSE ChiNext", shortName: "KFMI" },
  "shennan-stock": { region: "china", valueChain: "substrates", exchange: "SZSE", shortName: "Shennan Circuits" },
  "victory-giant-stock": { region: "china", valueChain: "substrates", exchange: "SZSE ChiNext", shortName: "Victory Giant" },
  "shengyi-stock": { region: "china", valueChain: "substrates", exchange: "SSE", shortName: "Shengyi Technology" },
  "eoptolink-stock": { region: "china", valueChain: "interconnect", exchange: "SZSE ChiNext", shortName: "Eoptolink" },
  "innolight-stock": { region: "china", valueChain: "interconnect", exchange: "SZSE ChiNext", shortName: "Zhongji Innolight" },
  "accelink-stock": { region: "china", valueChain: "interconnect", exchange: "SZSE", shortName: "Accelink" },
  "inspur-stock": { region: "china", valueChain: "infrastructure", exchange: "SZSE", shortName: "Inspur" },
};

const MARKET_INDEXES = [
  {
    id: "sox",
    symbol: "^SOX",
    label: "PHLX Semiconductor Index",
    labelKo: "필라델피아 반도체 지수",
    source: "Yahoo Finance history · Nasdaq official latest",
    sourceUrl: "https://indexes.nasdaq.com/Index/Overview/SOX",
  },
  {
    id: "skhy-stock",
    symbol: "000660.KS",
    label: "SK hynix",
    labelKo: "SKHY 주가",
    source: "Yahoo Finance chart API",
    sourceUrl: "https://finance.yahoo.com/quote/000660.KS/",
  },
  {
    id: "samsung-stock",
    symbol: "005930.KS",
    label: "Samsung Electronics",
    labelKo: "삼성전자 주가",
    source: "Yahoo Finance chart API",
    sourceUrl: "https://finance.yahoo.com/quote/005930.KS/",
  },
  {
    id: "micron-stock",
    symbol: "MU",
    label: "Micron Technology",
    labelKo: "Micron 주가",
    source: "Yahoo Finance chart API",
    sourceUrl: "https://finance.yahoo.com/quote/MU/",
  },
  {
    id: "sandisk-stock",
    symbol: "SNDK",
    label: "SanDisk",
    labelKo: "SanDisk 주가",
    source: "Yahoo Finance chart API",
    sourceUrl: "https://finance.yahoo.com/quote/SNDK/",
  },
  {
    id: "wdc-stock",
    symbol: "WDC",
    label: "Western Digital",
    labelKo: "Western Digital 주가",
    source: "Yahoo Finance chart API",
    sourceUrl: "https://finance.yahoo.com/quote/WDC/",
  },
  {
    id: "kioxia-stock",
    symbol: "285A.T",
    label: "Kioxia Holdings",
    labelKo: "Kioxia 주가",
    source: "Yahoo Finance chart API",
    sourceUrl: "https://finance.yahoo.com/quote/285A.T/",
  },
  {
    id: "naura-stock",
    symbol: "002371.SZ",
    label: "NAURA Technology",
    labelKo: "NAURA 주가",
    source: "Yahoo Finance chart API",
    sourceUrl: "https://finance.yahoo.com/quote/002371.SZ/",
  },
  {
    id: "amec-stock",
    symbol: "688012.SS",
    label: "AMEC",
    labelKo: "AMEC 주가",
    source: "Yahoo Finance chart API",
    sourceUrl: "https://finance.yahoo.com/quote/688012.SS/",
  },
  {
    id: "acm-shanghai-stock",
    symbol: "688082.SS",
    label: "ACM Research Shanghai",
    labelKo: "ACM Shanghai 주가",
    source: "Yahoo Finance chart API",
    sourceUrl: "https://finance.yahoo.com/quote/688082.SS/",
  },
  {
    id: "jcet-stock",
    symbol: "600584.SS",
    label: "JCET Group",
    labelKo: "JCET 주가",
    source: "Yahoo Finance chart API",
    sourceUrl: "https://finance.yahoo.com/quote/600584.SS/",
  },
  {
    id: "gigadevice-stock",
    symbol: "603986.SS",
    label: "GigaDevice",
    labelKo: "GigaDevice 주가",
    source: "Yahoo Finance chart API",
    sourceUrl: "https://finance.yahoo.com/quote/603986.SS/",
  },
  {
    id: "smic-stock",
    symbol: "688981.SS",
    label: "SMIC",
    labelKo: "SMIC 주가",
    source: "Yahoo Finance chart API",
    sourceUrl: "https://finance.yahoo.com/quote/688981.SS/",
  },
  equityIndex("nvidia-stock", "NVDA", "NVIDIA"),
  equityIndex("amd-stock", "AMD", "Advanced Micro Devices", "AMD"),
  equityIndex("broadcom-stock", "AVGO", "Broadcom"),
  equityIndex("marvell-stock", "MRVL", "Marvell Technology", "Marvell"),
  equityIndex("qualcomm-stock", "QCOM", "Qualcomm"),
  equityIndex("arm-stock", "ARM", "Arm Holdings", "Arm"),
  equityIndex("synopsys-stock", "SNPS", "Synopsys"),
  equityIndex("cadence-stock", "CDNS", "Cadence Design Systems", "Cadence"),
  equityIndex("tsmc-stock", "TSM", "Taiwan Semiconductor Manufacturing", "TSMC"),
  equityIndex("umc-stock", "UMC", "United Microelectronics", "UMC"),
  equityIndex("globalfoundries-stock", "GFS", "GlobalFoundries"),
  equityIndex("asml-stock", "ASML", "ASML"),
  equityIndex("applied-materials-stock", "AMAT", "Applied Materials"),
  equityIndex("lam-research-stock", "LRCX", "Lam Research"),
  equityIndex("kla-stock", "KLAC", "KLA"),
  equityIndex("tokyo-electron-stock", "8035.T", "Tokyo Electron"),
  equityIndex("kokusai-stock", "6525.T", "Kokusai Electric"),
  equityIndex("asm-stock", "ASM.AS", "ASM International"),
  equityIndex("axcelis-stock", "ACLS", "Axcelis Technologies", "Axcelis"),
  equityIndex("onto-stock", "ONTO", "Onto Innovation"),
  equityIndex("entegris-stock", "ENTG", "Entegris"),
  equityIndex("shinetsu-stock", "4063.T", "Shin-Etsu Chemical", "Shin-Etsu"),
  equityIndex("sumco-stock", "3436.T", "SUMCO"),
  equityIndex("globalwafers-stock", "6488.TWO", "GlobalWafers"),
  equityIndex("ase-stock", "ASX", "ASE Technology"),
  equityIndex("amkor-stock", "AMKR", "Amkor Technology", "Amkor"),
  equityIndex("teradyne-stock", "TER", "Teradyne"),
  equityIndex("advantest-stock", "6857.T", "Advantest"),
  equityIndex("disco-stock", "6146.T", "DISCO"),
  equityIndex("besi-stock", "BESI.AS", "BE Semiconductor Industries", "BESI"),
  equityIndex("arista-stock", "ANET", "Arista Networks", "Arista"),
  equityIndex("coherent-stock", "COHR", "Coherent"),
  equityIndex("lumentum-stock", "LITE", "Lumentum"),
  equityIndex("astera-stock", "ALAB", "Astera Labs"),
  equityIndex("credo-stock", "CRDO", "Credo Technology", "Credo"),
  equityIndex("vertiv-stock", "VRT", "Vertiv"),
  equityIndex("eaton-stock", "ETN", "Eaton"),
  equityIndex("supermicro-stock", "SMCI", "Super Micro Computer", "Supermicro"),
  equityIndex("dell-stock", "DELL", "Dell Technologies", "Dell"),
  equityIndex("celestica-stock", "CLS", "Celestica"),
  equityIndex("honhai-stock", "2317.TW", "Hon Hai Precision Industry", "Hon Hai"),
  equityIndex("quanta-stock", "2382.TW", "Quanta Computer", "Quanta"),
  equityIndex("inventec-stock", "2356.TW", "Inventec"),
  equityIndex("monolithic-power-stock", "MPWR", "Monolithic Power Systems", "Monolithic Power"),
  equityIndex("rambus-stock", "RMBS", "Rambus"),
  equityIndex("seagate-stock", "STX", "Seagate Technology", "Seagate"),
  equityIndex("silicon-motion-stock", "SIMO", "Silicon Motion"),

  equityIndex("cxmt-stock", "688825.SS", "CXMT Corporation", "CXMT"),
  equityIndex("biwin-stock", "688525.SS", "BIWIN Storage Technology", "BIWIN"),
  equityIndex("longsys-stock", "301308.SZ", "Longsys Electronics", "Longsys"),
  equityIndex("hua-hong-stock", "688347.SS", "Hua Hong Semiconductor", "Hua Hong"),
  equityIndex("piotech-stock", "688072.SS", "Piotech"),
  equityIndex("kingsemi-stock", "688037.SS", "Kingsemi"),
  equityIndex("hwatsing-stock", "688120.SS", "Hwatsing Technology", "Hwatsing"),
  equityIndex("tongfu-stock", "002156.SZ", "Tongfu Microelectronics", "Tongfu"),
  equityIndex("huatian-stock", "002185.SZ", "Huatian Technology", "Huatian"),
  equityIndex("montage-stock", "688008.SS", "Montage Technology", "Montage"),
  equityIndex("verisilicon-stock", "688521.SS", "VeriSilicon"),
  equityIndex("empyrean-stock", "301269.SZ", "Empyrean Technology", "Empyrean"),
  equityIndex("primarius-stock", "688206.SS", "Primarius Technologies", "Primarius"),
  equityIndex("omnivision-stock", "603501.SS", "OmniVision Integrated Circuits", "OmniVision"),
  equityIndex("rockchip-stock", "603893.SS", "Rockchip Electronics", "Rockchip"),
  equityIndex("loongson-stock", "688047.SS", "Loongson Technology", "Loongson"),
  equityIndex("cambricon-stock", "688256.SS", "Cambricon Technologies", "Cambricon"),
  equityIndex("hygon-stock", "688041.SS", "Hygon Information Technology", "Hygon"),
  equityIndex("wingtech-stock", "600745.SS", "Wingtech Technology", "Wingtech"),
  equityIndex("silan-stock", "600460.SS", "Hangzhou Silan Microelectronics", "Silan Micro"),
  equityIndex("anji-stock", "688019.SS", "Anji Microelectronics", "Anji Micro"),
  equityIndex("nsig-stock", "688126.SS", "National Silicon Industry Group", "NSIG"),
  equityIndex("kfmi-stock", "300666.SZ", "Konfoong Materials International", "KFMI"),
  equityIndex("shennan-stock", "002916.SZ", "Shennan Circuits"),
  equityIndex("victory-giant-stock", "300476.SZ", "Victory Giant Technology", "Victory Giant"),
  equityIndex("shengyi-stock", "600183.SS", "Shengyi Technology"),
  equityIndex("eoptolink-stock", "300502.SZ", "Eoptolink Technology", "Eoptolink"),
  equityIndex("innolight-stock", "300308.SZ", "Zhongji Innolight"),
  equityIndex("accelink-stock", "002281.SZ", "Accelink Technologies", "Accelink"),
  equityIndex("inspur-stock", "000977.SZ", "Inspur Electronic Information", "Inspur"),
].map((index) => ({
  ...index,
  ...(MARKET_EQUITY_META[index.id] || {}),
}));

const PRICE_PAGES = [
  {
    id: "dram",
    label: "DRAM",
    url: "https://www.trendforce.com/price/dram/dram_spot",
    sections: ["DRAM Spot Price", "DRAM Contract Price", "Module Spot Price", "GDDR Spot Price"],
  },
  {
    id: "nand",
    label: "NAND / Storage",
    url: "https://www.trendforce.com/price/flash/flash_spot",
    sections: [
      "NAND Flash Spot Price",
      "NAND Flash Contract Price",
      "Wafer Spot Price",
      "Memory Card Spot Price",
      "PC-Client OEM SSD Contract Price",
      "SSD Street Price",
    ],
  },
];

// Foreign-press-centric news themes. All queries are English so Google News
// returns international outlets; Korean-language items and Korean outlets are
// dropped downstream by isForeignItem().
const CATEGORIES = [
  // Who says what, and from which chair. The account briefs carried an
  // executive line and an organisation that were both written by hand, and the
  // reason automation produced nothing was upstream: not one query asked for
  // people. Every term below was checked against the feed; the two that
  // returned almost nothing were replaced rather than left in to look thorough.
  {
    id: "exec_org",
    label: "Executive · Organisation",
    queries: [
      "Nvidia CEO AI infrastructure", "Microsoft CTO Azure AI infrastructure",
      "Meta head of infrastructure AI", "AWS vice president compute",
      "Broadcom president semiconductor AI", "OpenAI CFO compute spending",
      "Marvell CEO custom silicon", "Anthropic executive compute capacity",
      "Dell CEO AI server", "Google Cloud CEO AI infrastructure",
      "Oracle executive AI data center", "AMD CEO data center GPU",
    ],
  },
  // Accelerator programmes, not accelerator companies. One query per company
  // hid that AWS runs a training part and an inference part, and that it buys
  // NVIDIA while designing its own. Every term was checked against the feed:
  // "AWS Inferentia" returns 87, "AWS Nvidia GPU" 100, "Meta MTIA" 100.
  {
    id: "silicon_programs",
    label: "Accelerator Programs",
    queries: [
      "AWS Inferentia", "AWS Trainium", "Amazon Trainium HBM", "AWS Nvidia GPU",
      "AWS custom silicon", "Microsoft Maia", "Meta MTIA", "Google Ironwood TPU",
      "AMD MI350 HBM", "Groq LPU", "Nvidia Blackwell HBM", "hyperscaler custom ASIC",
    ],
  },
  {
    id: "oem_odm",
    label: "Server OEM · ODM",
    // Each term was checked against the feed before being added; the ones that
    // returned nothing were replaced rather than left in to look thorough.
    // "HPE AI server" and "Fujitsu AI server" return zero, "Hewlett Packard
    // Enterprise AI" and "Inventec" return a full page.
    queries: OEM_ODM_QUERY_PLAN.map((entry) => entry.query),
    queryOwners: Object.fromEntries(OEM_ODM_QUERY_PLAN.map((entry) => [entry.query, entry.accountIds])),
  },
  { id: "hbm", label: "Custom HBM · HBM4", queries: ["custom HBM HBM4 HBM4E customer qualification", "HBM4 memory AI accelerator", "high bandwidth memory HBM", "SK hynix TSMC HBM4 base die", "Samsung HBM4 1c DRAM 4nm base die", "NVIDIA Rubin HBM4 11.7Gbps 36GB 48GB", "Micron HBM4 36GB 12H high volume production NVIDIA Vera Rubin", "Nvidia SK hynix multi-year HBM4 Vera Rubin co-development", "Marvell custom HBM compute architecture SK hynix Samsung Micron", "SK hynix HBM market share Counterpoint 2026 revenue", "HBM4 qualification yield supply allocation packaging capacity"] },
  { id: "dram", label: "범용 DRAM · CXMT", queries: ["server DRAM DDR5 RDIMM contract price", "DRAM DDR5 server memory price", "CXMT DDR5 server qualification customer contract", "CXMT DDR5 yield cost per bit", "Counterpoint DRAM market share Samsung SK hynix Micron CXMT", "TrendForce CXMT wafer capacity DRAM production capacity", "CXMT Tencent server DRAM supply deal Reuters", "server DDR5 contract spot spread"] },
  { id: "nand", label: "AI-NAND · eSSD", queries: ["AI data center enterprise SSD QLC demand", "SK hynix Solidigm enterprise SSD AI server", "Pure Storage SK hynix DirectFlash QLC", "High Bandwidth Flash HBF AI inference", "NAND flash enterprise SSD price", "YMTC enterprise SSD customer qualification China", "YMTC Xtacking enterprise SSD", "NAND contract price China eSSD", "YMTC NAND market share 2026"] },
  { id: "china_nand", label: "China NAND Business", queries: ["YMTC eSSD Xtacking customer", "YMTC Wuhan Phase 3 NAND domestic equipment", "XMC Wuhan Xinxin 12-inch specialty wafer foundry 3D IC", "XMC HBM packaging project equipment customer qualification", "JCET TFME advanced packaging NAND controller", "JCET XDFOI HBM AI packaging", "TFME advanced packaging China memory", "Naura AMEC ACM Research YMTC NAND equipment", "AMEC etch YMTC NAND", "ACM Research cleaning YMTC NAND", "YMTC controller firmware enterprise SSD", "China NAND subsidy server SSD procurement", "Chinese memory chips 15 percent cheaper YMTC CXMT", "China memory capacity expansion 2027 YMTC CXMT"] },
  { id: "skhynix_projection", label: "SKHY Product Projection", queries: ["SK hynix HBM4 server DRAM product mix", "SK hynix enterprise SSD Solidigm AI server storage", "SK hynix LPDDR UFS mobile memory demand", "SK hynix CXL memory module server roadmap", "SK hynix automotive memory edge AI", "SK hynix Nasdaq ADR SKHY 26.5 billion July 2026 SEC Reuters", "memory product mix AI server terminal NAND DRAM"] },
  { id: "capital", label: "Capital Markets·Investment", queries: ["site:sec.gov/Archives/edgar/data/2120882 SK hynix ADS Nasdaq prospectus", "site:english.sse.com.cn CXMT final offering 57.9 billion yuan", "CXMT STAR Market registration plan 29.5 billion yuan final offering 57.9 billion yuan", "Micron strategic customer agreements 16 customers official", "memory semiconductor capital expenditure long term agreement"] },
  { id: "cxl", label: "CXL Pooling · PNM", queries: ["CXL memory pooling AI inference", "Marvell Structera A SK hynix CMM-Ax PNM KV cache", "processing near memory CXL AI inference", "SK hynix Niagara CXL memory 8 hosts", "CXL switch memory expansion", "CXL 3.1 memory module CMM-D", "Pangea v3 CXL 3.2", "CXL memory controller qualification server"] },
  { id: "packaging", label: "베이스 다이 · 패키징", queries: ["HBM4 logic base die foundry partnership", "advanced packaging HBM hybrid bonding", "TSMC CoWoS HBM 3DFabric official", "CoWoS interposer HBM allocation advanced packaging", "HBM thermal management iHBM hybrid bonding", "silicon photonics CPO memory interconnect", "HBM TC bonder equipment supply chain", "JCET TFME XDFOI advanced packaging HBM OSAT"] },
  { id: "aidemand", label: "AI Infra 수요", queries: ["hyperscaler AI infrastructure memory demand", "AI accelerator roadmap memory bandwidth capacity power", "AI server OEM ODM rack memory qualification", "AWS Trainium Inferentia Bedrock memory", "Google TPU Ironwood memory", "Microsoft Maia AI infrastructure memory", "Meta MTIA AI infrastructure memory", "NVIDIA Rubin rack memory architecture", "enterprise RAG inference memory storage demand"] },
  { id: "equipment", label: "장비 · 소재 공급망", queries: ["memory semiconductor equipment materials supply chain", "HBM packaging equipment TC bonder inspection", "DRAM NAND etch deposition cleaning CMP equipment", "NAURA AMEC ACM Research memory qualification", "SK hynix semiconductor materials equipment supplier", "China memory equipment localization server DRAM NAND"] },
  { id: "benchmark", label: "China Benchmark", queries: ["China memory benchmark CXMT YMTC", "Chinese semiconductor equipment localization memory"] },
  { id: "china", label: "China·Geopolitics", queries: ["CXMT YMTC China memory", "China DRAM NAND export control", "CXMT revenue 2025 DRAM capacity", "YMTC Wuhan Phase 3 domestic equipment Naura AMEC", "YMTC existing Wuhan fabs 160000 200000 wpm source discrepancy", "YMTC sells XMC stake state-backed buyer Caixin Global June 2026", "XMC STAR Market review withdrawn May 2026", "BIS China memory export control VEU", "Reuters H200 China shipments CXMT Entity List held off July 2026", "US VEU revocation SK hynix Samsung Intel China fabs annual license 2026", "MATCH Act DUV restriction cryogenic etch blanket ban removed Reuters", "HR 8170 MATCH Act House Foreign Affairs Committee latest official action", "S.4281 MATCH Act Senate Banking Housing Urban Affairs latest official action", "Apple seeks approval buy CXMT memory China devices Reuters", "CXMT HBM3 mass production order materials components unlikely 2026", "CXMT DDR5 yield cost per bit die size Samsung 40 percent December 2024", "CXMT yield engineer HBM TSV recruitment", "YMTC Xtacking eSSD engineer recruitment", "Huawei Ascend memory supply YMTC CXMT", "Tencent Alibaba ByteDance CXMT DRAM supply", "Tsinghua career CXMT YMTC semiconductor recruitment", "Nvidia H20 export controls China HBM memory demand The Diplomat"] },
  { id: "china_infra", label: "China Fab Infra", queries: ["SK hynix Wuxi fab water power land expansion", "SK hynix Wuxi 1z 1a 180000 190000 wafer capacity upgrade", "SK hynix Wuxi 581 billion won investment 2025 TrendForce", "SK hynix Wuxi K7 environmental impact assessment cleanroom expansion", "Wuxi high-tech bonded zone SK hynix land water electricity", "SK hynix Wuxi C2F additional cleanroom equipment installation", "BIS VEU SK hynix Wuxi fab capacity upgrade"] },
  { id: "china_talent_strategy", label: "China Talent Strategy", queries: ["SK hynix China hiring Wuxi Dalian Chongqing semiconductor", "China memory talent retention IP compliance semiconductor", "CXMT YMTC hiring yield TSV HBM engineer", "China enterprise SSD firmware FAE hiring memory", "Wuxi semiconductor EHS facility utilities hiring fab", "CXMT IPO filing Micron Samsung alumni international talent base DIGITIMES"] },
  // Account-scoped coverage. Topic queries above are product-centric, so only
  // NVIDIA surfaced often enough to classify; every other account resolved to
  // zero pain-axis hits. Queries come from the account registry so adding an
  // account to accounts.json automatically extends crawl coverage.
  { id: "account_intel", label: "Account Intelligence", queries: STRATEGY_ACCOUNT_REGISTRY.flatMap((account) => account.newsQueries || []) },
  // The OEM and ODM tiers carry the rack references our certification reuses,
  // but no topic query above reaches them, so they showed one or two items in a
  // whole run. Queries stay short: the feed matches all terms, and a six-word
  // query returned a tenth of what a three-word one did.
];

const CHINESE_CATEGORIES = [
  { id: "dram", label: "DRAM·CXMT 중국어", queries: ["长鑫存储 腾讯 DRAM 供应 合同", "长鑫存储 IPO 科创板 DRAM 产能", "长鑫存储 DDR5 LPDDR5X 量产"] },
  { id: "nand", label: "NAND·YMTC 중국어", queries: ["长江存储 武汉 三期 2026 下半年 量产", "长江存储 A股 IPO NAND 产能", "长江存储 Xtacking 企业级 SSD"] },
  { id: "equipment", label: "장비 국산화 중국어", queries: ["长江存储 长鑫存储 国产设备 扩产", "北方华创 中微公司 长江存储 长鑫存储", "半导体设备 国产化 存储 长江 长鑫"] },
  { id: "china", label: "중국 메모리 정책 중국어", queries: ["中国 存储 芯片 供应链 大基金 长江 长鑫", "两存 扩产 半导体 存储 IPO", "长鑫 长江 存储 超级周期"] },
];

// High-authority monitors run in addition to the broad topic queries. Keeping
// them separate makes source coverage explicit without mixing language and
// subject classification.
const ENGLISH_AUTHORITY_MONITORS = [
  {
    id: "industry",
    label: "WSTS·SIA 공식 산업 통계",
    queries: [
      "site:wsts.org/76/Recent-News-Release semiconductor market forecast",
      "site:wsts.org/76/103 semiconductor market WSTS",
      "site:semiconductors.org/global-semiconductor-sales WSTS monthly sales",
      "site:semiconductors.org/news-events/latest-news semiconductor sales",
    ],
  },
  {
    id: "account-demand",
    label: "수요처 계정 실적·CapEx·출하",
    queries: [
      "site:blogs.microsoft.com/blog/2026 Microsoft Azure AI infrastructure AMD Helios",
      "site:microsoft.com/en-us/investor/events/fy-2026 Azure capital expenditures AI infrastructure",
      "\"Microsoft Azure\" AI data center capex Maia",
      "\"Amazon Web Services\" AI data center capex Trainium",
      "\"Google Cloud\" AI data center capex TPU",
      "\"Meta Platforms\" AI infrastructure data center capex MTIA",
      "\"Oracle Cloud\" OpenAI Stargate data center capex",
      "\"xAI\" Colossus data center expansion",
      "Alibaba Tencent ByteDance cloud AI capex server",
      "Tesla BYD Hyundai automotive memory ADAS production",
      "Bosch Continental Denso automotive memory domain controller",
      "Volkswagen Toyota automotive semiconductor memory ADAS",
      "Apple iPhone Samsung Galaxy Xiaomi smartphone memory shipment",
      "Oppo Vivo Transsion smartphone memory shipment",
      "Lenovo Dell HP AI PC memory shipment",
      "Azure Storage Amazon S3 Google Cloud Storage enterprise SSD",
      "Solidigm enterprise SSD QLC data center demand",
    ],
  },
  {
    id: "hbm",
    label: "HBM 권위 소스",
    queries: [
      "HBM4 memory source:Reuters",
      "HBM4 memory source:Bloomberg",
      "HBM4 memory source:Nikkei Asia",
      "HBM4 memory source:TrendForce",
      "HBM memory source:EE Times",
      "site:jedec.org HBM memory standard",
      "site:spectrum.ieee.org HBM semiconductor memory",
      "site:semiengineering.com HBM advanced packaging memory",
      "site:news.skhynix.com CES 2026 cHBM AiMX CMM-Ax HBM4",
      "site:semiconductor.samsung.com/news-events/news HBM4 HBM4E Custom HBM 2027",
    ],
  },
  {
    id: "dram",
    label: "DRAM 권위 소스",
    queries: [
      "DRAM memory market source:Reuters",
      "DRAM memory market source:Financial Times",
      "DRAM memory market source:TrendForce",
      "DRAM market share source:Counterpoint Research",
      "site:semiengineering.com DRAM memory manufacturing",
      "site:semiconductor-digest.com DRAM memory semiconductor",
      "site:eetimes.com DRAM memory technology",
      "site:trendforce.com/presscenter/news 3Q26 conventional DRAM contract 13 18 NAND 10 15",
      "site:semimedia.cc SK hynix Wuxi 1a 180000 190000 wafer",
    ],
  },
  {
    id: "nand",
    label: "NAND 권위 소스",
    queries: [
      "NAND enterprise SSD source:Reuters",
      "NAND enterprise SSD source:TrendForce",
      "NAND technology source:TechInsights",
      "NAND memory source:Nikkei Asia",
      "site:electronicsweekly.com NAND memory SSD",
      "site:theregister.com NAND SSD memory",
      "site:digitimes.com NAND memory storage",
    ],
  },
  {
    id: "china",
    label: "중국 메모리 영문 권위 소스",
    queries: [
      "CXMT YMTC memory source:Reuters",
      "CXMT YMTC memory source:Caixin Global",
      "CXMT YMTC memory source:South China Morning Post",
      "CXMT YMTC memory source:Nikkei Asia",
      "site:scmp.com CXMT YMTC semiconductor memory",
      "site:caixinglobal.com CXMT YMTC memory",
      "site:asia.nikkei.com CXMT YMTC semiconductor",
      "site:semiengineering.com China semiconductor equipment memory",
      "site:semi.org China memory semiconductor equipment",
      "site:theregister.com Chinese memory ban CXMT YMTC supply",
      "site:newsletter.semianalysis.com CXMT DRAM capacity HBM",
      "site:technode.com YMTC NAND market share",
      "site:xmcwh.com/en/site XMC 12-inch wafer foundry 3D IC specialty memory",
      "site:trendforce.com/news SK hynix Wuxi Dalian 581 billion 2025 investment",
    ],
  },
  {
    id: "capital",
    label: "자본시장·공식 공시 원문",
    queries: [
      "site:sec.gov/Archives/edgar/data/2120882 424B4 SK hynix ADS",
      "site:sec.gov/Archives/edgar/data/2120882 F-6 SK hynix",
      "site:english.sse.com.cn CXMT offering 57.9 billion yuan 8.66",
      "site:english.sse.com.cn CXMT investment plan 29.5 billion yuan",
      "site:investors.micron.com strategic customer agreements Micron",
      "site:bis.gov foreign-owned semiconductor fabs China VEU",
      "site:wsts.org 2026 global semiconductor market forecast",
      "site:trendforce.com/presscenter 2026 memory market 889.3",
    ],
  },
  {
    id: "cxl",
    label: "CXL·차세대 메모리 원문",
    queries: [
      "site:marvell.com CMM-Ax Structera SK hynix CXL processing near memory KV cache",
      "site:semiconductor.samsung.com CXL memory pooling KV cache",
      "site:panmnesia.com CXL memory ISCA",
      "site:sandisk.com 10th-generation 3D flash Kioxia",
    ],
  },
  {
    id: "packaging",
    label: "패키징 권위 소스",
    queries: [
      "site:trendforce.com hybrid bonding HBM4E",
      "site:newsletter.semianalysis.com ECTC HBM packaging",
      "site:tsmc.com CoWoS HBM 3DFabric",
      "site:investor.tsmc.com annual report CoWoS advanced packaging",
      "site:sandisk.com High Bandwidth Flash HBF SK hynix",
      "site:opencompute.org High Bandwidth Flash HBF",
      "site:micron.com HBM4 NVIDIA Vera Rubin production",
      "site:news.samsung.com HBM4 commercial shipment",
    ],
  },
];

// Brokerage research is collected as a separate evidence class. Search results
// may be either a broker's own publication or an authoritative article quoting
// a named house; the two are kept distinct in buildBrokerResearch().
const BROKER_RESEARCH_MONITORS = [
  {
    id: "broker-research",
    label: "글로벌 증권사 메모리 리서치",
    queries: [
      'memory semiconductor outlook "Morgan Stanley"',
      'DRAM NAND HBM outlook "Goldman Sachs"',
      'memory chip cycle forecast "JPMorgan"',
      'DRAM NAND price forecast "UBS"',
      'memory semiconductor outlook "Bernstein"',
      'DRAM HBM forecast "Citi"',
      'memory semiconductor outlook "BofA Securities"',
      'memory chip outlook "Jefferies"',
      'DRAM NAND forecast "Barclays"',
      'memory semiconductor outlook "Nomura"',
      'site:ubs.com memory semiconductor research',
      'site:jpmorgan.com insights semiconductor memory',
      'site:goldmansachs.com insights memory semiconductor',
      'site:morganstanley.com insights memory semiconductor',
    ],
  },
];

const BROKER_RULES = [
  { id: "morgan-stanley", name: "Morgan Stanley", aliases: ["morgan stanley", "大摩", "모건스탠리"], accent: "#00a98f" },
  { id: "goldman-sachs", name: "Goldman Sachs", aliases: ["goldman sachs", "高盛", "골드만삭스"], accent: "#d6a428" },
  { id: "jpmorgan", name: "JPMorgan", aliases: ["jpmorgan", "jp morgan", "j.p. morgan", "摩根大通", "jp모건"], accent: "#2563eb" },
  { id: "ubs", name: "UBS", aliases: ["ubs", "瑞银"], accent: "#e11d48" },
  { id: "bernstein", name: "Bernstein", aliases: ["bernstein", "伯恩斯坦"], accent: "#7c3aed" },
  { id: "citi", name: "Citi", aliases: ["citigroup", "citi research", "花旗", "씨티"], accent: "#0284c7" },
  { id: "bofa", name: "BofA Securities", aliases: ["bofa securities", "bank of america", "美银", "뱅크오브아메리카"], accent: "#dc2626" },
  { id: "jefferies", name: "Jefferies", aliases: ["jefferies", "杰富瑞"], accent: "#0f766e" },
  { id: "barclays", name: "Barclays", aliases: ["barclays", "巴克莱"], accent: "#0891b2" },
  { id: "nomura", name: "Nomura", aliases: ["nomura", "野村", "노무라"], accent: "#ef4444" },
  { id: "daiwa", name: "Daiwa", aliases: ["daiwa", "大和证券", "다이와"], accent: "#f97316" },
  { id: "macquarie", name: "Macquarie", aliases: ["macquarie", "麦格理", "맥쿼리"], accent: "#14b8a6" },
  { id: "mizuho", name: "Mizuho", aliases: ["mizuho", "瑞穗", "미즈호"], accent: "#1d4ed8" },
  { id: "hsbc", name: "HSBC", aliases: ["hsbc", "汇丰", "홍콩상하이은행"], accent: "#e31b23" },
];

// These report extracts were supplied as source documents and serve as a
// continuity baseline. Fresh crawled citations rank ahead of them; report
// metadata is never presented as a public URL when the document is private.
const BROKER_REPORT_DOCUMENTS = [
  {
    id: "ms-next-gen-memory-20260716",
    institution: "Morgan Stanley",
    title: "Global Technology: Innovating the Next-Generation Memory",
    publishedAt: "2026-07-16",
    authors: "Charlie Chan · Daisy Dai · Shawn Kim 외",
    fileName: "GREATER_20260716_0122-1.pdf",
    focus: "메모리 병목이 HBM 공급을 넘어 데이터 이동·공정·패키징·시스템 효율 문제로 확장",
    corePoints: [
      "Agentic AI 확산 시 2030년 DRAM 수요가 기준 전망보다 26~77% 증가할 수 있는 시나리오",
      "2027년 클라우드 CapEx 내 메모리 비중 40% 전망과 범용 메모리 대역폭 개선 +14%의 격차",
      "설계·공정·패키징·주변장치·통합·소재의 여섯 혁신 축을 차세대 메모리 생태계로 제시",
    ],
    metrics: ["2030E 클라우드 메모리 $418B", "2027E CapEx mix 40%", "2030E 차세대 메모리 $23B"],
    topicCount: 6,
  },
  {
    id: "ms-key-debates-20260717",
    institution: "Morgan Stanley",
    title: "Global Technology - Key Debates: AI, Memory, Substrates & MLCC",
    publishedAt: "2026-07-17",
    authors: "Shawn Kim 외 3인",
    fileName: "insight_1pager_MSglobaltech_20260718.html",
    focus: "4Q26 가격 고점 가능성에도 구속형 LTA와 Agentic AI 신규 수요가 메모리 사이클을 연장",
    corePoints: [
      "메모리 가격은 4Q26 전후 고점 가능성이 있으나 3~5년 LTA가 이익의 가시성을 높이는 구조",
      "HBM·NAND 공급 부족이 2026~2027년 이어지고 AI 수요가 NAND·CPU·DRAM으로 확장",
      "ABF 기판과 MLCC까지 AI 서버 스펙 상향의 수혜 범위가 넓어지는 공급망 재평가 논쟁",
    ],
    metrics: ["2027E HBM $94B", "2030E Agentic AI DRAM 221EB", "2027E AI 서버 MLCC $893M"],
    topicCount: 3,
  },
];

const BROKER_REPORT_SEEDS = [
  {
    id: "ms-memory-wall-20260716",
    documentId: "ms-next-gen-memory-20260716",
    institution: "Morgan Stanley",
    institutionId: "morgan-stanley",
    evidenceType: "direct-report",
    label: "SYSTEM BOTTLENECK",
    title: "메모리 병목은 HBM 캐파를 넘어 시스템 효율 문제로 확장",
    summary: "2027년 클라우드 CapEx에서 메모리 비중은 40%로 높아지지만, 2024~2026년 범용 메모리 대역폭 개선은 14%에 그쳐 토큰 증가 속도와의 격차가 커진다는 분석입니다.",
    metrics: ["2027 클라우드 CapEx 중 메모리 40%", "토큰 >320x vs 대역폭 +14%"],
    insight: "SKHY는 HBM, 서버 DRAM, eSSD, 인터커넥트와 패키징을 고객 시스템 단위의 하나의 용량 로드맵으로 관리해야 합니다.",
    reversalKpi: "AI CapEx 둔화, 토큰 증가율 하락, 소프트웨어 메모리 효율 개선",
    publishedAt: "2026-07-16",
    source: "Morgan Stanley",
    sourceRef: "Global Technology: Innovating the Next-Generation Memory",
    accent: "#00a98f",
  },
  {
    id: "ms-agentic-ai-demand-20260716",
    documentId: "ms-next-gen-memory-20260716",
    institution: "Morgan Stanley",
    institutionId: "morgan-stanley",
    evidenceType: "direct-report",
    label: "AGENTIC AI DEMAND",
    title: "Agentic AI가 서버 DRAM·스토리지까지 수요 범위를 넓힘",
    summary: "에이전트의 작업 분해와 도구 호출이 CPU 오케스트레이션과 메모리 접근량을 늘려 2030년 DRAM 수요를 기준 전망보다 26~77% 높일 수 있다는 시나리오입니다.",
    metrics: ["2030 DRAM 증분 +26~77%", "2030 클라우드 메모리 $418B"],
    insight: "SKHY는 GPU 출하량뿐 아니라 CPU utilization, 추론 토큰, KV cache, 서버당 DRAM과 eSSD 탑재량을 고객 수요 지표로 묶어야 합니다.",
    reversalKpi: "에이전트당 토큰 감소, CPU utilization 하락, 서버당 메모리 탑재량 정체",
    publishedAt: "2026-07-16",
    source: "Morgan Stanley",
    sourceRef: "Global Technology: Innovating the Next-Generation Memory",
    accent: "#0e7490",
  },
  {
    id: "ms-memory-cycle-20260716",
    documentId: "ms-next-gen-memory-20260716",
    institution: "Morgan Stanley",
    institutionId: "morgan-stanley",
    evidenceType: "direct-report",
    label: "CYCLE & CONTRACT",
    title: "3Q26 가격 상방 뒤 4Q26 모멘텀 둔화 가능성",
    summary: "3Q26 DRAM 가격은 20~30% 이상 오를 수 있지만 전년 대비 가격 모멘텀은 4Q26에 정체될 수 있습니다. Micron은 16개 전략고객계약에서 $22B의 재무 약정을 확보했습니다.",
    metrics: ["3Q26 DRAM +20~30%", "Micron SCA 16건 · $22B"],
    insight: "SKHY는 프리미엄 물량을 장기계약으로 잠그되 가격 공식, 최소 구매와 재협상 조항을 고객별로 비교하고 범용 증설은 단계 집행해야 합니다.",
    reversalKpi: "고객 재고 증가, 소비 수요 파괴, 경쟁사 bit growth 조기 회복",
    publishedAt: "2026-07-16",
    source: "Morgan Stanley",
    sourceRef: "Global Technology: Innovating the Next-Generation Memory",
    accent: "#ef8d22",
  },
  {
    id: "ms-hbm4e-economics-20260716",
    documentId: "ms-next-gen-memory-20260716",
    institution: "Morgan Stanley",
    institutionId: "morgan-stanley",
    evidenceType: "direct-report",
    label: "HBM4E ECONOMICS",
    title: "HBM4E는 ASP보다 웨이퍼 생산성 하락이 자본배분 핵심",
    summary: "2026~2028년 HBM ASP는 연 15% 상승할 수 있지만 HBM4E 전환 시 die density가 24Gb에서 32Gb로 높아지고 웨이퍼당 gross die는 추가로 20% 감소할 수 있습니다.",
    metrics: ["HBM ASP +15% YoY", "HBM4E gross die/wafer -20%"],
    insight: "SKHY는 고객 가격 공식에 수율, 패키징 처리량과 웨이퍼 생산성 저하를 함께 반영해 HBM4E의 실제 기여이익을 관리해야 합니다.",
    reversalKpi: "수율 조기 안정, 고객 인증 지연, LTA 가격 재협상",
    publishedAt: "2026-07-16",
    source: "Morgan Stanley",
    sourceRef: "Global Technology: Innovating the Next-Generation Memory",
    accent: "#9a4fd4",
  },
  {
    id: "ms-hbf-essd-tiering-20260716",
    documentId: "ms-next-gen-memory-20260716",
    institution: "Morgan Stanley",
    institutionId: "morgan-stanley",
    evidenceType: "direct-report",
    label: "NAND MOVES UP",
    title: "AI 추론은 NAND를 저장장치에서 메모리 계층으로 끌어올림",
    summary: "HBF는 HBM과 유사한 대역폭에 8~16배 용량을 목표로 하고, Kioxia는 KV cache와 GPU 직접 연결용 SSD 계층을 제시합니다. 보고서 내 샘플 시점은 2H26~1H27 범위로 읽어야 합니다.",
    metrics: ["HBF 용량 8~16x", "샘플 2H26~1H27"],
    insight: "SKHY는 SanDisk와 HBF 표준화를 진행하면서 Solidigm eSSD를 포함한 workload tier별 제품·고객 로드맵을 함께 설계해야 합니다.",
    reversalKpi: "샘플 성능 미달, 고객 피드백 지연, HBF 표준화 일정 후퇴",
    publishedAt: "2026-07-16",
    source: "Morgan Stanley",
    sourceRef: "Global Technology: Innovating the Next-Generation Memory",
    accent: "#5b67d8",
  },
  {
    id: "ms-cxl-mrdimm-efficiency-20260716",
    documentId: "ms-next-gen-memory-20260716",
    institution: "Morgan Stanley",
    institutionId: "morgan-stanley",
    evidenceType: "direct-report",
    label: "CXL & MRDIMM",
    title: "CXL·MRDIMM은 증설 없이 서버당 메모리 효율을 높이는 축",
    summary: "MRDIMM은 DDR5 부품으로 유효 12,800MT/s를 구현하고, CXL MXC·스위치 시장은 2030년 $4.0B로 전망됩니다. CXL은 로컬 DDR5보다 약 60% 느려 cold page 중심으로 적합합니다.",
    metrics: ["MRDIMM 12,800MT/s", "CXL 2030E $4.0B"],
    insight: "SKHY는 CXL 지연시간과 서버 수 절감 효과를 고객 PoC에서 동시에 측정하고, MRDIMM 인증과 묶어 시스템 비용 절감형 포트폴리오로 관리해야 합니다.",
    reversalKpi: "지연 민감 workload 비중, 고객 PoC 경제성, 소프트웨어 상용화 지연",
    publishedAt: "2026-07-16",
    source: "Morgan Stanley",
    sourceRef: "Global Technology: Innovating the Next-Generation Memory",
    accent: "#2563eb",
  },
  {
    id: "ms-cycle-lta-20260717",
    documentId: "ms-key-debates-20260717",
    institution: "Morgan Stanley",
    institutionId: "morgan-stanley",
    evidenceType: "direct-report",
    label: "CYCLE & LTA",
    title: "4Q26 가격 고점 가능성과 구속형 LTA의 사이클 연장 효과",
    summary: "DRAM 계약가격 증가율은 고점에서 둔화되고 재고는 2Q26부터 다시 늘어 4Q26 전후 가격 고점 가능성이 제시됩니다. 다만 LTA가 3~5년 물량·가격공식·선수금을 포함하는 구조로 강화되면서 이익 가시성과 밸류에이션 재평가 여력이 생긴다는 분석입니다.",
    metrics: ["가격 고점 4Q26E", "LTA 3~5년", "FY27 P/E 삼성 3.8x · SKHY 3.9x"],
    insight: "가격 고점 여부와 별개로 고객별 LTA의 최소구매·가격공식·선수금·재협상 조항을 계약가치의 핵심 지표로 관리해야 합니다.",
    reversalKpi: "DRAM·NAND 재고 주수, contract·spot 가격, LTA 재협상과 선수금 유지",
    publishedAt: "2026-07-17",
    source: "Morgan Stanley",
    sourceRef: "Global Technology - Key Debates: AI, Memory, Substrates & MLCC",
    accent: "#c28a20",
  },
  {
    id: "ms-hbm-nand-supply-20260717",
    documentId: "ms-key-debates-20260717",
    institution: "Morgan Stanley",
    institutionId: "morgan-stanley",
    evidenceType: "direct-report",
    label: "AI SUPPLY STACK",
    title: "HBM·NAND 공급 부족이 2027년까지 이어지는 시나리오",
    summary: "HBM 시장은 2023년 $3B에서 2027년 $94B로 확대되고 DRAM 공급충족률은 2026년 -17%, 2027년 -15%로 추정됩니다. AI향 NAND 수요 비중은 2025년 18%에서 2027년 41%로 높아지며 2026년 공급충족률은 -15%로 제시됩니다.",
    metrics: ["2027E HBM $94B", "2026E DRAM -17%", "2027E AI NAND 609EB · 41%"],
    insight: "HBM 수율·TSV 캐파와 함께 AI eSSD용 NAND 물량을 고객별로 배분해 DRAM과 NAND 공급 부족을 하나의 AI 메모리 스택으로 관리해야 합니다.",
    reversalKpi: "HBM·DRAM fulfillment, AI NAND 수요 비중, TSV·NAND 증설 속도",
    publishedAt: "2026-07-17",
    source: "Morgan Stanley",
    sourceRef: "Global Technology - Key Debates: AI, Memory, Substrates & MLCC",
    accent: "#0e7490",
  },
  {
    id: "ms-agentic-components-20260717",
    documentId: "ms-key-debates-20260717",
    institution: "Morgan Stanley",
    institutionId: "morgan-stanley",
    evidenceType: "direct-report",
    label: "AGENTIC AI & COMPONENTS",
    title: "Agentic AI 수요가 CPU·DRAM에서 ABF·MLCC까지 확장",
    summary: "Agentic AI는 불 케이스에서 2030년까지 최대 $238B의 신규 CPU 수요와 221EB의 증분 DRAM 수요를 만들 수 있다는 추정입니다. ABF 기판은 2027년 이후 공급 부족 전환, AI 서버 MLCC 수요는 2027년 $893M으로 확대되는 시나리오가 함께 제시됩니다.",
    metrics: ["2030E CPU $238B", "2030E DRAM 221EB", "2027E AI 서버 MLCC $893M"],
    insight: "GPU 출하 외에 CPU 오케스트레이션, 서버당 DRAM, ABF 기판과 고용량 MLCC를 AI 인프라 수요의 연쇄 지표로 추적해야 합니다.",
    reversalKpi: "Agentic AI 도입 속도, CPU utilization, ABF 가동률, 랙당 MLCC 탑재액",
    publishedAt: "2026-07-17",
    source: "Morgan Stanley",
    sourceRef: "Global Technology - Key Debates: AI, Memory, Substrates & MLCC",
    accent: "#6d5bd0",
  },
];

const BROKER_RESEARCH_FRAMEWORK = {
  title: "AI 메모리 병목: 수요·수익성·아키텍처",
  subtitle: "AI 메모리 투자는 HBM 물량만이 아니라 데이터 이동, 웨이퍼 생산성, 계약의 질과 서버 총비용을 함께 최적화해야 함",
  asOf: "2026-07-16",
  sourceRef: "Global Technology: Innovating the Next-Generation Memory",
  demand: [
    { label: "Agentic AI", metric: "2030 DRAM +26~77%", detail: "CPU 오케스트레이션과 메모리 접근량 증가 시나리오" },
    { label: "Cloud memory", metric: "2030E $418B", detail: "클라우드 메모리 지출, 2026년 이후 연평균 8%" },
    { label: "CapEx mix", metric: "2027E 40%", detail: "클라우드 CapEx 내 메모리 비중 추정" },
  ],
  bottlenecks: [
    { label: "데이터 이동", detail: "토큰 증가 >320x 대비 범용 메모리 대역폭 개선은 +14%" },
    { label: "웨이퍼 경제성", detail: "HBM4E 전환 시 웨이퍼당 gross die가 추가로 20% 감소 가능" },
    { label: "지연시간", detail: "CXL은 로컬 DDR5보다 약 60% 느려 cold page 중심 적용 필요" },
  ],
  options: [
    { label: "HBM4E", metric: "ASP +15% · gross die/wafer -20%", gate: "수율 · 고객 가격 공식 · 패키징" },
    { label: "HBF · AI SSD", metric: "HBF 용량 8~16x", gate: "샘플 · 표준화 · workload 인증" },
    { label: "MRDIMM · CXL", metric: "12,800MT/s · 2030E $4.0B", gate: "지연시간 · 고객 PoC · 총비용" },
  ],
  decisions: [
    { label: "시스템 배분", action: "HBM·서버 DRAM·eSSD·패키징을 고객별 하나의 용량 로드맵으로 배분" },
    { label: "계약 수익성", action: "가격 공식에 수율·웨이퍼 생산성·최소구매·재협상 조항을 함께 반영" },
    { label: "NAND 상향", action: "HBF 표준화와 Solidigm eSSD를 workload tier별 공동 로드맵으로 연결" },
    { label: "효율형 옵션", action: "CXL·MRDIMM은 고객 PoC에서 지연시간과 서버 총비용 절감을 함께 검증" },
  ],
  scenarios: [
    { id: "bear", label: "Bear", excludingHbm: 16.9, includingHbm: 160 },
    { id: "base", label: "Base", excludingHbm: 23.0, includingHbm: 276 },
    { id: "bull", label: "Bull", excludingHbm: 41.4, includingHbm: 342 },
  ],
};

const CHINESE_AUTHORITY_MONITORS = [
  {
    id: "dram",
    label: "DRAM 중국어 권위 소스",
    queries: [
      "财新 长鑫存储 DRAM",
      "site:yicai.com 长鑫存储 DDR5",
      "site:stcn.com 长鑫存储 DRAM",
      "site:laoyaoba.com 长鑫存储",
      "site:ijiwei.com 长鑫存储",
      "site:eet-china.com 长鑫存储 DDR5",
      "site:technews.tw 长鑫存储 DRAM",
      "site:finance.technews.tw 长鑫存储 扩产",
      "site:solidot.org 长鑫存储 DRAM",
    ],
  },
  {
    id: "nand",
    label: "NAND 중국어 권위 소스",
    queries: [
      "财新 长江存储 NAND",
      "site:yicai.com 长江存储 Xtacking",
      "site:chinaflashmarket.com 长江存储 NAND SSD",
      "site:seminews.com.cn 长江存储 NAND",
      "site:21jingji.com 长江存储 存储芯片",
      "site:huxiu.com 长江存储 NAND",
      "site:finance.sina.com.cn 长江存储 IPO",
      "site:cnyes.com 长江存储 NAND",
    ],
  },
  {
    id: "equipment",
    label: "장비 중국어 권위 소스",
    queries: [
      "site:stcn.com 半导体设备 存储芯片",
      "经济观察网 半导体设备 存储",
      "site:ijiwei.com 北方华创 中微公司 存储",
      "site:china.semi.org.cn 半导体设备 存储",
      "site:csia.net.cn 存储芯片 半导体设备",
      "site:eet-china.com 北方华创 中微公司",
      "site:finance.sina.com.cn HBM 测试设备 存储",
      "site:finance.sina.com.cn DDR4 合约价 存储",
    ],
  },
];

// High-value source articles remain available as a reference archive when a
// daily search result rolls out of the RSS window. They are intentionally kept
// out of the live stream and its quality counts: the summaries below are
// curated metadata, not evidence that the source was observed in this run.
const PRESERVED_NEWS_SEEDS = [
  {
    id: "marvell-skhynix-cmmax-2026",
    category: "cxl",
    language: "english",
    title: "Marvell Structera and SK hynix CMM-Ax accelerate long-context AI inference",
    titleKo: "Marvell·SK hynix, CMM-Ax CXL-PNM으로 Long-context 추론 처리량 실증",
    source: "Marvell",
    sourceType: "기업 공식",
    evidenceLevel: "Official joint demo",
    date: "2026-08-05",
    link: "https://www.marvell.com/blogs/accelerating-ai-infrastructure-marvell-structera-sk-hynix-cxl-memory.html",
    summaryOriginal: "CMM-Ax combines Marvell Structera A with SK hynix DDR5 to offload KV cache through CXL and reports up to 5.5x single-GPU and 3.6x dual-GPU throughput on Llama3-8B-1048K.",
    summary: "CMM-Ax는 Structera A와 SK hynix DDR5를 결합한 CXL Processing-Near-Memory. Llama3-8B-1048K 기준 단일 GPU 대비 최대 5.5배, Dual GPU 대비 최대 3.6배 처리량을 실증했으며 PIM과 별도 기술 축으로 관리함.",
  },
  {
    id: "sse-cxmt-final-offering",
    category: "dram",
    language: "english",
    title: "CXMT prices STAR Market offering at CNY 57.9 billion before greenshoe",
    titleKo: "CXMT, 초과배정 전 기본 공모액 579억 위안 확정",
    source: "Shanghai Stock Exchange",
    sourceType: "거래소 공시",
    evidenceLevel: "Reported",
    date: "2026-07-16",
    link: "https://english.sse.com.cn/news/newsrelease/voice/c/c_20260716_10825660.shtml",
    summaryOriginal: "The Shanghai Stock Exchange reported base proceeds of CNY 57.9 billion before a 15 percent greenshoe, after an earlier CNY 29.5 billion registration-stage investment-project plan.",
    summary: "초과배정 전 기본 공모액은 579억 위안. 기존 295억 위안은 등록 단계의 최초 조달 목표이자 투자 프로젝트 계획액이므로, 최종 발행가·주식수 기준 공모액과 분리해 자금 집행을 추적함.",
  },
  {
    id: "sse-cxmt-registration-plan",
    category: "capital",
    language: "english",
    title: "CXMT receives STAR Market registration approval with CNY 29.5 billion investment plan",
    titleKo: "CXMT, 295억 위안 투자 프로젝트 계획으로 상장 등록 승인",
    source: "Shanghai Stock Exchange",
    sourceType: "거래소 공시",
    evidenceLevel: "Reported",
    date: "2026-06-15",
    link: "https://english.sse.com.cn/news/newsrelease/voice/c/c_20260615_10821916.shtml",
    summaryOriginal: "The Shanghai Stock Exchange reported registration approval and an initial CNY 29.5 billion investment-project funding plan before final pricing.",
    summary: "상장 등록 단계 증권신고서의 295억 위안은 투자 프로젝트 계획액임. 7월 최종 발행가와 주식수로 확정된 기본 공모액 579억 위안보다 앞선 단계이므로 현재 조달액으로 표시하지 않음.",
  },
  {
    id: "sec-skhynix-nasdaq-ads",
    category: "capital",
    language: "english",
    title: "SK hynix prices Nasdaq ADS offering at USD 149 per ADS",
    titleKo: "SKHY, Nasdaq ADS 공모가를 주당 149달러로 확정",
    source: "U.S. SEC",
    sourceType: "정부 공시",
    evidenceLevel: "Reported",
    date: "2026-07-10",
    link: "https://www.sec.gov/Archives/edgar/data/2120882/000119312526299963/d32785d424b4.htm",
    summaryOriginal: "SK hynix's final prospectus states that 177.9 million ADSs were offered at USD 149 each and approved for Nasdaq listing under the symbol SKHY.",
    summary: "SEC 최종 투자설명서 기준 1억 7,790만 ADS를 주당 149달러에 공모했고 Nasdaq 종목코드는 SKHY임. 공모 규모는 두 수치의 곱인 약 265억 달러이며 시장가치나 후속 주가 성과와 분리해 관리함.",
  },
  {
    id: "bis-china-fab-veu-revocation",
    category: "policy",
    language: "english",
    title: "BIS revokes VEU authorizations for foreign-owned semiconductor fabs in China",
    titleKo: "BIS, 중국 내 외국계 반도체 Fab의 VEU 특례 종료",
    source: "U.S. Bureau of Industry and Security",
    sourceType: "정부 공시",
    evidenceLevel: "Reported",
    date: "2025-08-29",
    link: "https://www.bis.gov/press-release/department-commerce-closes-export-controls-loophole-foreign-owned-semiconductor-fabs-china",
    summaryOriginal: "BIS ended VEU license-free treatment for foreign-owned semiconductor fabs in China, while stating an intent to license existing operations but not capacity expansion or technology upgrades.",
    summary: "BIS는 중국 내 외국계 반도체 Fab의 VEU 무허가 특례를 종료함. 기존 Fab 운영을 위한 허가는 의도하지만 캐파 확대나 기술 업그레이드 허가는 의도하지 않는다고 밝혀 운영 유지와 증설을 분리해야 함.",
  },
  {
    id: "census-bis-c79-fab-license",
    category: "policy",
    language: "english",
    title: "AES adds C79 code for exports under BIS H-prefix fab licenses",
    titleKo: "미 Census, 중국 내 전 VEU Fab의 H-prefix 라이선스 신고코드 C79 시행",
    source: "U.S. Census Bureau",
    sourceType: "정부 공지",
    evidenceLevel: "Reported",
    date: "2026-01-05",
    link: "https://content.govdelivery.com/accounts/USCENSUS/bulletins/4008e2b",
    summaryOriginal: "Effective December 31, 2025, AES license code C79 replaced C57 for exports under BIS H-prefix individual fab licenses issued to former VEU semiconductor fabs in China.",
    summary: "C79는 중국 내 전 VEU 반도체 Fab에 발급된 BIS H-prefix 개별 Fab 라이선스의 AES 신고코드임. 2025년 12월 31일부터 C57을 대체했으며, 새로운 blanket ban으로 해석하지 않음.",
  },
  {
    id: "micron-sixteen-sca",
    category: "dram",
    language: "english",
    title: "Micron expands strategic customer agreements to sixteen customers",
    titleKo: "Micron, 전략 고객 계약을 16개로 확대",
    source: "Micron",
    sourceType: "기업 공식",
    evidenceLevel: "Reported",
    date: "2026-07-06",
    link: "https://investors.micron.com/news-releases/news-release-details/micron-and-ford-sign-strategic-agreement-strengthen-long-term",
    summaryOriginal: "Micron said its agreement with Ford was one of sixteen Strategic Customer Agreements discussed on its fiscal third-quarter 2026 financial conference call.",
    summary: "Micron 공식 발표는 Ford 계약이 FY2026 3분기 실적발표에서 언급한 16개 Strategic Customer Agreement 중 하나라고 확인함. 제품별 물량 비중과 총 계약액은 별도 공시가 없는 한 추정하지 않음.",
  },
  {
    id: "micron-fq3-2026-results",
    category: "dram",
    language: "english",
    title: "Micron reports record fiscal third-quarter 2026 results",
    titleKo: "Micron FY2026 3분기 매출 414.56억 달러·GAAP 총마진 84.6%",
    source: "Micron",
    sourceType: "기업 공식",
    evidenceLevel: "Reported",
    date: "2026-06-24",
    link: "https://investors.micron.com/node/50671",
    summaryOriginal: "Micron reported fiscal third-quarter 2026 revenue of USD 41.456 billion, GAAP gross margin of 84.6 percent and non-GAAP gross margin of 84.9 percent.",
    summary: "Micron FY2026 3분기 공식 실적은 매출 414.56억 달러, GAAP 총마진 84.6%, non-GAAP 총마진 84.9%임. 실적과 향후 계약가 전망을 분리해 메모리 사이클을 판단함.",
  },
  {
    id: "sse-cxmt-prospectus-financials",
    category: "capital",
    language: "english",
    title: "CXMT prospectus reports 2025 and first-quarter 2026 financials",
    titleKo: "CXMT 투자설명서, 2025년·2026년 1분기 실적 공개",
    source: "Shanghai Stock Exchange",
    sourceType: "거래소 공시",
    evidenceLevel: "Reported",
    date: "2026-05-28",
    link: "https://english.sse.com.cn/news/newsrelease/voice/c/c_20260528_10819990.shtml",
    summaryOriginal: "CXMT reported 2025 revenue of CNY 61.799 billion and first-quarter 2026 revenue of CNY 50.80 billion with net profit of CNY 33.012 billion.",
    summary: "SSE가 인용한 투자설명서 기준 CXMT의 2025년 매출은 617.99억 위안, 2026년 1분기 매출은 508억 위안, 순이익은 330.12억 위안임. 연간·분기 수치와 매출·순이익을 혼용하지 않음.",
  },
  {
    id: "wsts-spring-2026-forecast",
    category: "demand",
    language: "english",
    title: "WSTS raises 2026 semiconductor market forecast above USD 1.5 trillion",
    titleKo: "WSTS, 2026년 반도체 시장 전망을 1.5조 달러 이상으로 상향",
    source: "WSTS",
    sourceType: "산업 통계",
    evidenceLevel: "Reported",
    date: "2026-06-02",
    link: "https://www.wsts.org/76/103/Global-Semiconductor-Market-Surges-Beyond-15T-2026",
    summaryOriginal: "WSTS Spring 2026 forecasts the global semiconductor market above USD 1.5 trillion in 2026, with memory above USD 800 billion and growth around 250 percent year over year.",
    summary: "WSTS Spring 2026은 2026년 세계 반도체 시장을 1.5조 달러 이상, 메모리를 8,000억 달러 이상으로 전망함. 이전 전망과 최신 전망은 같은 기관의 개정 시계열로 관리하며 실적과 혼용하지 않음.",
  },
  {
    id: "trendforce-memory-market-revision-2026",
    category: "demand",
    language: "english",
    title: "TrendForce raises 2026 memory market forecast to USD 889.3 billion",
    titleKo: "TrendForce, 2026년 메모리 시장 전망을 8,893억 달러로 상향",
    source: "TrendForce",
    sourceType: "산업 분석",
    evidenceLevel: "Reported",
    date: "2026-05-29",
    link: "https://www.trendforce.com/presscenter/news/20260529-13068.html",
    summaryOriginal: "TrendForce raised its 2026 memory market forecast from USD 551.6 billion to USD 889.3 billion and its 2027 forecast from USD 842.7 billion to more than USD 1.28 trillion.",
    summary: "TrendForce는 2026년 메모리 시장 전망을 5,516억 달러에서 8,893억 달러로, 2027년 전망을 8,427억 달러에서 1.28조 달러 이상으로 상향함. WSTS 전체 반도체 전망과 범위를 구분함.",
  },
  {
    id: "scmp-cxmt-ipo-oversubscription",
    category: "dram",
    language: "english",
    title: "CXMT oversubscribed about 212 times in Shanghai IPO",
    titleKo: "CXMT IPO, 최종 배정 기준 약 212배 초과청약",
    source: "South China Morning Post",
    sourceType: "외신",
    evidenceLevel: "Reported",
    date: "2026-07-17",
    link: "https://www.scmp.com/tech/article/3360892/chinese-memory-giant-cxmt-oversubscribed-212-times-mega-shanghai-ipo",
    summaryOriginal: "The final retail allocation implied roughly 212-times oversubscription, while the online tranche before claw-back was reported at 243.93 times.",
    summary: "최종 배정률 약 0.47%에서 역산한 약 212배와 claw-back 전 온라인 트랜치 243.93배는 산식·단계가 다른 값. 최근 일부 중국 대형 IPO보다 낮았다는 시장 맥락도 함께 봄.",
  },
  {
    id: "sandisk-skhynix-hbf-standardization",
    category: "packaging",
    language: "english",
    title: "Sandisk and SK hynix begin global standardization of High Bandwidth Flash",
    titleKo: "Sandisk·SKHY, HBF 글로벌 표준화 착수",
    source: "Sandisk",
    sourceType: "기업 공식",
    evidenceLevel: "Reported",
    date: "2026-02-25",
    link: "https://www.sandisk.com/company/newsroom/press-releases/2026/2026-02-25-sandisk-and-sk-hynix-begin-global-standardization-of-next-generation-memory-solution-high-bandwidth-flash-hbf",
    summaryOriginal: "Sandisk and SK hynix announced joint HBF standardization work under the Open Compute Project for high-capacity AI inference memory tiers.",
    summary: "HBF를 AI 추론용 고용량 메모리 계층으로 표준화하는 공동 작업을 시작한 기업 발표. HBM 대체 확정이 아니라 표준·샘플·고객 채택을 순서대로 검증함.",
  },
  {
    id: "micron-hbm4-volume-production",
    category: "hbm",
    language: "english",
    title: "Micron begins high-volume production of HBM4 for NVIDIA Vera Rubin",
    titleKo: "Micron, NVIDIA Vera Rubin용 HBM4 대량생산 발표",
    source: "Micron",
    sourceType: "기업 공식",
    evidenceLevel: "Reported",
    date: "2026-03-16",
    link: "https://investors.micron.com/news-releases/news-release-details/micron-high-volume-production-hbm4-designed-nvidia-vera-rubin",
    summaryOriginal: "Micron announced volume shipments of 36GB 12-high HBM4 designed for NVIDIA Vera Rubin, with 48GB 16-high samples also disclosed.",
    summary: "36GB 12단 HBM4의 Vera Rubin용 대량생산·출하를 발표. 회사 발표와 NVIDIA의 공급사별 확정 물량 배분은 서로 다른 근거로 관리함.",
  },
  {
    id: "samsung-hbm4-commercial-shipment",
    category: "hbm",
    language: "english",
    title: "Samsung ships commercial HBM4 for AI computing",
    titleKo: "삼성, AI 컴퓨팅용 HBM4 상업 출하 발표",
    source: "Samsung",
    sourceType: "기업 공식",
    evidenceLevel: "Reported",
    date: "2026-02-11",
    link: "https://news.samsung.com/global/samsung-ships-industry-first-commercial-hbm4-with-ultimate-performance-for-ai-computing",
    summaryOriginal: "Samsung announced commercial HBM4 shipments with a 4nm logic base die and transfer speeds of 11.7Gbps, scalable up to 13Gbps.",
    summary: "4nm 로직 베이스 다이 기반 HBM4를 11.7Gbps로 상업 출하했으며 최대 13Gbps까지 확장 가능하다고 발표. 실제 고객별 인증·반복 발주·배정 물량은 별도 증거로 확인함.",
  },
  {
    id: "the-register-china-memory-ban",
    category: "china",
    language: "english",
    title: "Chinese memory ban would cut off RAMpocalypse relief",
    titleKo: "중국 메모리 금지가 공급 부족 완화를 막을 수 있다는 분석",
    source: "The Register",
    sourceType: "외신",
    evidenceLevel: "Reported",
    date: "2026-07-17",
    link: "https://www.theregister.com/2026/07/17/chinese_memory_ban_would_cut_off_rampocalypse_relief/",
    summaryOriginal: "Proposed restrictions on Chinese memory suppliers could remove an alternative source of DRAM and NAND while global memory supply remains tight.",
    summary: "중국 메모리 조달 제한이 공급 대안을 줄여 가격 압력을 키울 수 있다는 정책·수급 분석. 규제 강화 효과와 고객의 대체 조달 비용을 함께 판단해야 함.",
  },
  {
    id: "reuters-cxmt-tencent",
    category: "dram",
    language: "english",
    title: "China's CXMT wins server DRAM supply deal with Tencent",
    titleKo: "CXMT, 텐센트 서버 DRAM 장기 공급계약 확보",
    source: "Reuters",
    sourceType: "외신",
    evidenceLevel: "Reported",
    date: "2026-06-29",
    link: "https://www.reuters.com/world/china/chinas-cxmt-wins-3-billion-memory-supply-deal-with-tencent-sources-say-2026-06-29/",
    summaryOriginal: "Reuters reported a server DRAM supply agreement worth more than CNY 20 billion, about USD 2.94 billion, while sources differed on whether the term was three or five years.",
    summary: "계약 규모는 200억 위안 초과(약 $2.94B)로 보도됐고 기간은 소식통별 3년 또는 5년으로 엇갈림. 고객 승인 확대는 확정 공시 전까지 Reported로 관리.",
  },
  {
    id: "tomshardware-cxmt-capacity",
    category: "dram",
    language: "english",
    title: "CXMT close to matching Micron's memory capacity in 2026, research claims",
    titleKo: "연구 모델, CXMT의 2026년 DRAM 캐파가 Micron에 근접할 가능성 제시",
    source: "Tom's Hardware",
    sourceType: "외신",
    evidenceLevel: "Reported",
    date: "2026-07-15",
    link: "https://www.tomshardware.com/pc-components/dram/cxmt-close-to-matching-microns-memory-capacity-in-2026-research-claims-would-put-china-on-track-to-become-worlds-second-largest-dram-producer",
    summaryOriginal: "The article reports a Citrini Research capacity model, not audited wafer output, and notes that CXMT could approach Micron's wafer capacity if the modeled expansion is completed.",
    summary: "Citrini Research의 캐파 모델을 소개한 기사로 실제 비트 아웃풋 확정치가 아님. 웨이퍼 캐파와 수율·다이 크기·비트 원가를 분리해 범용 DRAM 압력을 판단.",
  },
  {
    id: "semianalysis-cxmt-dram",
    category: "dram",
    language: "english",
    title: "China's CXMT Is Set to Challenge DRAM Incumbents",
    titleKo: "SemiAnalysis, CXMT의 범용 DRAM 확장과 HBM 제약 분석",
    source: "SemiAnalysis",
    sourceType: "산업 리서치",
    evidenceLevel: "Research model",
    date: "2026-06-23",
    link: "https://newsletter.semianalysis.com/p/chinas-cxmt-is-set-to-challenge-dram",
    summaryOriginal: "SemiAnalysis models CXMT wafer capacity at about 350 kwspm by end-2026, 420 kwspm by end-2027, and 500 kwspm by end-2028, while estimating roughly 25% yield for 8-high HBM3 and describing HBM as a minimal contributor to output.",
    summary: "SemiAnalysis 연구모델은 CXMT 캐파를 2026년 말 350K, 2027년 말 420K, 2028년 말 500K wpm으로 추정하고 8단 HBM3 수율을 약 25%로 모델링함. 회사 가이던스나 실측값이 아니며, 현재 핵심 위협은 HBM 동급화보다 DDR5·LPDDR·서버 DRAM 물량과 비트 원가 압력임.",
  },
  {
    id: "technode-ymtc-share",
    category: "nand",
    language: "english",
    title: "YMTC NAND market share climbs to 13% as global competition intensifies",
    titleKo: "YMTC NAND 점유율 13% 보도, 상위권 경쟁 심화",
    source: "TechNode",
    sourceType: "외신",
    evidenceLevel: "Reported",
    date: "2026-06-22",
    link: "https://technode.com/2026/06/22/ymtc-nand-market-share-climbs-to-13-as-global-competition-intensifies/",
    summaryOriginal: "TechNode reports that YMTC's NAND share reached 13 percent, citing market research as competition in client and enterprise storage intensified.",
    summary: "YMTC의 NAND 점유율 13% 보도를 시장조사 기준으로 추적. 점유율 산식과 기준 분기를 확인한 뒤 eSSD 고객 침투와 가격 영향을 분리해 반영.",
  },
  {
    id: "trendforce-hybrid-bonding",
    category: "packaging",
    language: "english",
    title: "Samsung and SK hynix Reportedly Reconsider Hybrid Bonding Timeline",
    titleKo: "삼성·SKHY, 하이브리드 본딩 적용 시점 재검토",
    source: "TrendForce",
    sourceType: "분석",
    evidenceLevel: "Reported",
    date: "2026-07-07",
    link: "https://www.trendforce.com/news/2026/07/07/news-samsung-sk-hynix-reportedly-reconsider-hybrid-bonding-timeline-16-high-hbm4e-may-be-earliest-adoption/",
    summaryOriginal: "TrendForce reports that 16-high HBM4E may become the earliest hybrid-bonding adoption point as suppliers continue thermocompression bonding for HBM4.",
    summary: "하이브리드 본딩 도입이 16단 HBM4E까지 늦춰질 수 있다는 업계 보도. 본딩 장비 CAPEX보다 HBM4 수율과 고객 인증 일정에 우선순위를 둘 필요.",
  },
  {
    id: "samsung-cxl-pooling",
    category: "cxl",
    language: "english",
    title: "Breaking AI Memory Limits with CXL Memory Pooling",
    titleKo: "삼성, CXL 메모리 풀링 기반 AI 추론 평가 공개",
    source: "Samsung Semiconductor",
    sourceType: "기업 공식",
    evidenceLevel: "Reported",
    date: "2026-07-09",
    link: "https://semiconductor.samsung.com/news-events/tech-blog/breaking-ai-memory-limits-with-cxl-memory-pooling/",
    summaryOriginal: "Samsung evaluated a 1 TB CXL memory pool for KV cache offloading and reported near-DRAM performance in its disclosed test environment.",
    summary: "1TB CXL 메모리 풀을 KV 캐시 오프로딩에 적용한 기업 공개 평가. 특정 테스트 환경 결과이므로 독립 재현 전까지 Post-HBM 제품 옵션의 검증 신호로 사용.",
  },
  {
    id: "sandisk-kioxia-bics10",
    category: "nand",
    language: "english",
    title: "Sandisk Announces Sampling of BiCS10 1Tb TLC 3D NAND Flash Memory",
    titleKo: "Sandisk, 332단 BiCS10 1Tb TLC 샘플링 개시",
    source: "Sandisk",
    sourceType: "기업 공식",
    evidenceLevel: "Reported",
    date: "2026-07-02",
    link: "https://www.sandisk.com/company/newsroom/press-releases/2026/2026-07-02-sandisk-announces-bics10-1tb-tlc",
    summaryOriginal: "Sandisk announced sampling of 332-layer BiCS10 1Tb TLC with up to 4.8Gb/s interface speed and 59 percent higher bit density than BiCS8.",
    summary: "Sandisk 공식 발표는 332단 BiCS10 1Tb TLC의 샘플링, 최대 4.8Gb/s 인터페이스, BiCS8 대비 비트 밀도 59% 개선을 제시함. 샘플링을 양산 출하나 고객 인증 완료로 해석하지 않음.",
  },
  {
    id: "panmnesia-isca-cxl",
    category: "cxl",
    language: "english",
    title: "Panmnesia Unveils Silicon-Proven CXL Results at ISCA 2026",
    titleKo: "Panmnesia, ISCA 2026에서 실리콘 검증 CXL 결과 공개",
    source: "Panmnesia",
    sourceType: "기업 공식",
    evidenceLevel: "Reported",
    date: "2026-07-03",
    link: "https://panmnesia.com/news/en/2026-07-03-panmnesia-isca2026-eng/",
    summaryOriginal: "Panmnesia presented silicon-proven CXL results at ISCA 2026, providing an implementation signal for memory expansion and pooling architectures.",
    summary: "실리콘 검증 CXL 결과를 공개한 기업 발표. 상용 배포 규모와 고객 검증을 별도로 확인해 CXL 메모리 풀링 투자 우선순위를 판단.",
  },
  {
    id: "sina-ymtc-ipo",
    category: "nand",
    language: "chinese",
    title: "长江存储IPO辅导披露重要进展",
    titleKo: "YMTC IPO 지도 절차의 진행 상황 공개",
    source: "新浪财经",
    sourceType: "중국어권 보도",
    evidenceLevel: "Watch",
    date: "2026-07-16",
    link: "https://finance.sina.com.cn/wm/2026-07-16/doc-inihzfcy1427559.shtml",
    summaryOriginal: "报道披露长江存储IPO辅导进展，并将融资预期与AI存储需求周期联系起来。",
    summary: "YMTC IPO 지도 절차의 진행을 다룬 중국어 보도. 공모 규모·일정·자금 용도는 거래소 문서로 교차검증하기 전까지 Watch로 유지.",
  },
  {
    id: "technews-china-memory-capex",
    category: "china",
    language: "chinese",
    title: "中国记忆体双雄扩产设备支出升温",
    titleKo: "CXMT·YMTC 확장에 따른 장비 지출 확대 보도",
    source: "科技新报 财经",
    sourceType: "중국어권 보도",
    evidenceLevel: "Watch",
    date: "2026-07-14",
    link: "https://finance.technews.tw/2026/07/14/chinas-two-memory-chip-giants-are-spending-heavily-to-expand-production/",
    summaryOriginal: "报道汇总长鑫存储与长江存储的扩产和设备支出预期，相关产能数字仍需用公司或设备订单交叉验证。",
    summary: "중국 메모리 양사의 확장·장비 지출 전망을 정리한 보도. 예상 캐파는 실제 장비 발주와 wafer start로 확인될 때만 공급 전망에 반영.",
  },
  {
    id: "cnyes-nand-cycle",
    category: "nand",
    language: "chinese",
    title: "AI需求与消费库存推动NAND周期分化",
    titleKo: "AI 수요와 소비 재고가 만드는 NAND 사이클 분화",
    source: "钜亨网",
    sourceType: "중국어권 보도",
    evidenceLevel: "Watch",
    date: "2026-07-10",
    link: "https://hao.cnyes.com/post/258401",
    summaryOriginal: "文章讨论AI服务器需求与消费电子库存之间的分化，并引用机构观点分析NAND供需拐点。",
    summary: "AI 서버용 NAND 강세와 모바일·PC 재고 부담의 분화를 다룬 분석. eSSD와 client NAND를 한 방향으로 합산하지 않고 별도 가격 시나리오로 관리.",
  },
  {
    id: "sina-cxmt-decade",
    category: "dram",
    language: "chinese",
    title: "长鑫存储十年投入后的盈利与扩张观察",
    titleKo: "CXMT의 수익 전환과 확장 속도에 대한 중국어권 관찰",
    source: "新浪财经",
    sourceType: "중국어권 보도",
    evidenceLevel: "Watch",
    date: "2026-07-08",
    link: "https://finance.sina.com.cn/roll/2026-07-08/doc-inihaicz1520241.shtml",
    summaryOriginal: "报道回顾长鑫存储长期投入、盈利变化与扩产预期，财务数字仍需以上交所文件为准。",
    summary: "CXMT의 장기 투자와 수익 전환을 다룬 보도. 분기·연간 단위 혼용을 피하고 SSE 공시와 일치하는 수치만 경영 지표로 승격.",
  },
  {
    id: "solidot-china-fabs",
    category: "china",
    language: "chinese",
    title: "长鑫与长江存储新工厂扩产计划观察",
    titleKo: "CXMT·YMTC 신규 팹 확장 계획 관찰",
    source: "Solidot 奇客",
    sourceType: "중국어권 보도",
    evidenceLevel: "Watch",
    date: "2026-07-08",
    link: "https://www.solidot.org/story?sid=84783",
    summaryOriginal: "文章汇总长鑫与长江存储新工厂建设和投产时间表，计划值不等同于实际月产能。",
    summary: "신규 팹 건설·가동 일정을 요약한 보도. 계획 캐파를 실제 생산량으로 보지 않고 장비 설치·qualification·wafer start를 순차 확인.",
  },
  {
    id: "technews-cxmt-pricing",
    category: "dram",
    language: "chinese",
    title: "长鑫存储DRAM价格策略转向盈利优先",
    titleKo: "CXMT DRAM 가격 전략이 저가 침투에서 수익성 중심으로 이동",
    source: "科技新报",
    sourceType: "중국어권 보도",
    evidenceLevel: "Watch",
    date: "2026-07-06",
    link: "https://technews.tw/2026/07/06/changxin-memory-technologies-co-ltd-abandons-its-strategy-of-low-price-promotions-to-seize-market-share/",
    summaryOriginal: "报道认为长鑫存储的DRAM定价差距收窄，并讨论成本与盈利策略变化。",
    summary: "CXMT의 ASP 격차 축소와 수익성 우선 전략을 다룬 보도. 실제 고객 계약가와 비트 원가를 확인해 저가 공세 여부를 재판단.",
  },
  {
    id: "sina-hbm-test-equipment",
    category: "equipment",
    language: "chinese",
    title: "HBM需求带动存储测试设备新机会",
    titleKo: "HBM 수요가 중국 테스트 장비 기회를 확대한다는 보도",
    source: "新浪财经",
    sourceType: "중국어권 보도",
    evidenceLevel: "Watch",
    date: "2026-07-02",
    link: "https://finance.sina.com.cn/jjxw/2026-07-02/doc-inifmmmu2634865.shtml",
    summaryOriginal: "报道讨论HBM需求对测试设备的拉动，但设备订单不等同于客户qualification或量产份额。",
    summary: "HBM 테스트 장비 수요 확대를 다룬 중국어 보도. 장비 채용·개발 신호는 고객 qualification과 반복 발주가 확인되기 전까지 보조 지표로만 사용.",
  },
  {
    id: "sina-ddr4-contract",
    category: "dram",
    language: "chinese",
    title: "DDR4 8Gb合约价第三季度上涨预期",
    titleKo: "DDR4 8Gb 3분기 계약가 상승 전망",
    source: "新浪财经",
    sourceType: "중국어권 보도",
    evidenceLevel: "Watch",
    date: "2026-07-09",
    link: "https://finance.sina.com.cn/tech/roll/2026-07-09/doc-inihesky8304032.shtml",
    summaryOriginal: "报道引用市场预测讨论DDR4 8Gb第三季度合约价上涨，仍需与TrendForce公开价格区间交叉验证。",
    summary: "DDR4 8Gb 계약가 상승 전망을 다룬 보도. 단일 상단값을 확정치로 쓰지 않고 TrendForce 공개 시계열과 일치할 때 레거시 방어 판단에 반영.",
  },
];

// Public China field signals are collected separately from reported news.
// Community posts remain unverified, are never promoted into the fact layer,
// and retain no author/profile identifiers. Login-gated pages are not scraped.
const COMMUNITY_PLATFORM_RULES = [
  { id: "xueqiu", label: "雪球", domains: ["xueqiu.com"], sourceClass: "community", defaultType: "market" },
  { id: "zhihu", label: "知乎", domains: ["zhihu.com"], sourceClass: "community", defaultType: "technology" },
  { id: "eastmoney", label: "东方财富股吧", domains: ["guba.eastmoney.com", "caifuhao.eastmoney.com"], sourceClass: "community", defaultType: "market" },
  { id: "v2ex", label: "V2EX", domains: ["v2ex.com"], sourceClass: "community", defaultType: "consumer" },
  { id: "chiphell", label: "Chiphell", domains: ["chiphell.com"], sourceClass: "community", defaultType: "consumer" },
  { id: "smzdm", label: "什么值得买", domains: ["smzdm.com"], sourceClass: "community", defaultType: "consumer" },
  { id: "nga", label: "NGA", domains: ["nga.cn", "bbs.nga.cn"], sourceClass: "community", defaultType: "technology" },
  { id: "maimai", label: "脉脉", domains: ["maimai.cn"], sourceClass: "workplace-community", defaultType: "workplace" },
  { id: "nowcoder", label: "牛客", domains: ["nowcoder.com"], sourceClass: "workplace-community", defaultType: "workplace" },
  { id: "kanzhun", label: "看准", domains: ["kanzhun.com"], sourceClass: "workplace-community", defaultType: "workplace" },
  { id: "boss", label: "BOSS直聘", domains: ["zhipin.com"], sourceClass: "job-board", defaultType: "workplace" },
  { id: "liepin", label: "猎聘", domains: ["liepin.com"], sourceClass: "job-board", defaultType: "workplace" },
  { id: "zhaopin", label: "智联招聘", domains: ["zhaopin.com"], sourceClass: "job-board", defaultType: "workplace" },
  { id: "cxmt-careers", label: "CXMT 채용", domains: ["cxmt.zhiye.com", "cxmt.com"], sourceClass: "official-career", defaultType: "workplace" },
  { id: "xmc-careers", label: "XMC 채용", domains: ["whxmc.zhiye.com"], sourceClass: "official-career", defaultType: "workplace" },
  { id: "campus-career", label: "대학 취업센터", domains: ["jy.xmu.edu.cn", "zjc.sasu.edu.cn", "eie.scu.edu.cn"], sourceClass: "official-career", defaultType: "workplace" },
  { id: "csf-public", label: "中国半导体论坛 공개글", domains: ["search.iczhiku.com", "picture.iczhiku.com", "eet-china.com"], sourceClass: "community", defaultType: "technology" },
  { id: "eeworld", label: "EEWorld论坛", domains: ["bbs.eeworld.com.cn", "eeworld.com.cn"], sourceClass: "expert-community", defaultType: "technology" },
  { id: "21ic", label: "21ic论坛", domains: ["bbs.21ic.com"], sourceClass: "expert-community", defaultType: "technology" },
  { id: "mbb", label: "面包板论坛", domains: ["mbb.eet-china.com"], sourceClass: "expert-community", defaultType: "technology" },
  { id: "wechat-public", label: "반도체 공개 위챗", domains: ["mp.weixin.qq.com"], sourceClass: "community", defaultType: "technology" },
  { id: "icjob", label: "创芯人才网", domains: ["icjob.top"], sourceClass: "job-board", defaultType: "workplace" },
  { id: "xinjiangic", label: "芯匠人才网", domains: ["xinjiangic.com"], sourceClass: "job-board", defaultType: "workplace" },
  { id: "51icjob", label: "高芯圈", domains: ["51icjob.com"], sourceClass: "job-board", defaultType: "workplace" },
  { id: "bdtlietou", label: "优仕达", domains: ["bdtlietou.com"], sourceClass: "job-board", defaultType: "workplace" },
  { id: "hewa", label: "禾蛙", domains: ["hewa.cn"], sourceClass: "job-board", defaultType: "workplace" },
  { id: "semiwiki", label: "SemiWiki Forum", domains: ["semiwiki.com"], sourceClass: "expert-community", defaultType: "technology" },
  { id: "servethehome", label: "ServeTheHome Forums", domains: ["forums.servethehome.com"], sourceClass: "expert-community", defaultType: "technology" },
  { id: "anandtech", label: "AnandTech Forums", domains: ["forums.anandtech.com"], sourceClass: "expert-community", defaultType: "technology" },
  { id: "reddit-semiconductor", label: "Reddit 반도체", domains: ["reddit.com"], sourceClass: "community", defaultType: "technology" },
  { id: "borecraft", label: "NewMaxx SSD", domains: ["borecraft.com"], sourceClass: "expert-community", defaultType: "technology" },
];

const COMMUNITY_DISCOVERY_QUERIES = [
  { query: "site:xueqiu.com 长鑫存储 DRAM DDR5", platformId: "xueqiu" },
  { query: "site:xueqiu.com 长江存储 NAND Xtacking", platformId: "xueqiu" },
  { query: "site:xueqiu.com 北方华创 中微公司 存储 设备 验证", platformId: "xueqiu" },
  { query: "site:zhihu.com 长鑫存储 DDR5 HBM", platformId: "zhihu" },
  { query: "site:zhihu.com 长江存储 NAND SSD", platformId: "zhihu" },
  { query: "site:zhihu.com 长鑫存储 招聘 良率 工艺", platformId: "zhihu" },
  { query: "site:v2ex.com 长鑫存储 长江存储 内存", platformId: "v2ex" },
  { query: "site:chiphell.com 长鑫存储 DDR5 内存", platformId: "chiphell" },
  { query: "site:chiphell.com 长江存储 SSD Xtacking", platformId: "chiphell" },
  { query: "site:smzdm.com 长鑫存储 DDR5 兼容 评测", platformId: "smzdm" },
  { query: "site:smzdm.com 长江存储 企业级 SSD Xtacking", platformId: "smzdm" },
  { query: "site:nga.cn 长鑫存储 DDR5 长江存储 SSD", platformId: "nga" },
  { query: "site:maimai.cn 长鑫存储 招聘 良率", platformId: "maimai" },
  { query: "site:maimai.cn 长江存储 封装 测试 招聘", platformId: "maimai" },
  { query: "site:nowcoder.com 长鑫存储 工艺 良率 面试", platformId: "nowcoder" },
  { query: "site:nowcoder.com/enterprise/5758 长鑫存储 2027 提前批 工艺", platformId: "nowcoder" },
  { query: "site:nowcoder.com 长江存储 封装 测试 校招", platformId: "nowcoder" },
  { query: "site:kanzhun.com 长鑫存储 工艺 工程师 面试", platformId: "kanzhun" },
  { query: "site:kanzhun.com 长江存储 工艺 封装 招聘", platformId: "kanzhun" },
  { query: "site:zhipin.com 长鑫存储 良率 工艺 招聘", platformId: "boss" },
  { query: "site:zhipin.com 长江存储 封装 测试 产品 招聘", platformId: "boss" },
  { query: "site:zhipin.com 中微公司 刻蚀 TSV 招聘", platformId: "boss" },
  { query: "site:zhipin.com 北方华创 薄膜 刻蚀 招聘", platformId: "boss" },
  { query: "site:liepin.com 长鑫存储 工艺 良率 招聘", platformId: "liepin" },
  { query: "site:liepin.com 长江存储 封装 测试 招聘", platformId: "liepin" },
  { query: "site:zhaopin.com 长鑫存储 良率 工艺 招聘", platformId: "zhaopin" },
  { query: "site:zhaopin.com/companydetail/jobs-CZ604839930 长鑫存储 良率 失效 分析", platformId: "zhaopin" },
  { query: "site:zhihu.com/p/2046257095788574179 长鑫存储 2027 校园招聘", platformId: "zhihu" },
  { query: "site:jy.xmu.edu.cn 新芯股份 2026 校园招聘", platformId: "campus-career" },
  { query: "site:cxmt.zhiye.com 长鑫存储 校园招聘", platformId: "cxmt-careers" },
  { query: "site:whxmc.zhiye.com 新芯 校园招聘", platformId: "xmc-careers" },
  { query: "site:search.iczhiku.com 长鑫存储 长江存储 半导体", platformId: "csf-public" },
  { query: "site:bbs.eeworld.com.cn 长鑫存储 DDR5 长江存储 NAND", platformId: "eeworld" },
  { query: "site:bbs.21ic.com 长鑫存储 长江存储 存储芯片", platformId: "21ic" },
  { query: "site:mbb.eet-china.com 长鑫存储 长江存储 半导体", platformId: "mbb" },
  { query: "site:mp.weixin.qq.com 半导体行业观察 长鑫存储 长江存储", platformId: "wechat-public" },
  { query: "site:icjob.top 长鑫存储 长江存储 工艺 良率 招聘", platformId: "icjob" },
  { query: "site:xinjiangic.com 长鑫存储 长江存储 半导体 招聘", platformId: "xinjiangic" },
  { query: "site:51icjob.com 长鑫存储 长江存储 工艺 封装", platformId: "51icjob" },
  { query: "site:bdtlietou.com 长鑫存储 长江存储 半导体 人才", platformId: "bdtlietou" },
  { query: "site:hewa.cn 长鑫存储 长江存储 半导体 招聘", platformId: "hewa" },
  { query: "site:semiwiki.com/forum CXMT YMTC memory", platformId: "semiwiki", locale: "en" },
  { query: "site:forums.servethehome.com YMTC SSD CXMT DDR5", platformId: "servethehome", locale: "en" },
  { query: "site:forums.anandtech.com CXMT DDR5 YMTC SSD", platformId: "anandtech", locale: "en" },
  { query: "site:reddit.com/r/Semiconductors CXMT YMTC memory", platformId: "reddit-semiconductor", locale: "en" },
  { query: "site:reddit.com/r/hardware CXMT DDR5 YMTC SSD", platformId: "reddit-semiconductor", locale: "en" },
  { query: "site:borecraft.com YMTC SSD CXMT memory", platformId: "borecraft", locale: "en" },
];

// XenForo exposes public search result pages without requiring a member login.
// Only the thread title, matched excerpt, timestamp, and thread URL are kept;
// author/profile data is deliberately discarded.
const COMMUNITY_DIRECT_SEARCHES = [
  { url: "https://semiwiki.com/forum/search/1/?q=CXMT&o=date", platformId: "semiwiki" },
  { url: "https://semiwiki.com/forum/search/1/?q=YMTC&o=date", platformId: "semiwiki" },
  { url: "https://forums.servethehome.com/index.php?search/1/&q=CXMT&o=date", platformId: "servethehome" },
  { url: "https://forums.servethehome.com/index.php?search/1/&q=YMTC&o=date", platformId: "servethehome" },
];

const COMMUNITY_HISTORY_SEEDS = [
  {
    platformId: "xueqiu",
    type: "market",
    title: "长鑫存储与长江存储的供应链分工讨论",
    titleKo: "CXMT·YMTC 공급망 역할을 나눠 본 커뮤니티 토론",
    summary: "투자자들은 CXMT를 DRAM, YMTC를 NAND 축으로 구분하고 장비·소재 수혜 연결고리를 토론했습니다. 개별 수치보다 어떤 공급망 기업이 반복해서 언급되는지 보는 자료입니다.",
    link: "https://xueqiu.com/2786522622/397346597",
    date: "2026-06-29",
    historical: true,
    importance: 86,
  },
  {
    platformId: "xueqiu",
    type: "market",
    title: "长鑫存储IPO与半导体设备讨论",
    titleKo: "CXMT IPO 기대와 중국 장비주 연결 토론",
    summary: "커뮤니티는 CXMT의 자금 조달 기대를 국산 장비·소재 수요와 연결했습니다. 실제 조달액과 자금 사용처는 거래소 공시로 별도 검증해야 합니다.",
    link: "https://www.xueqiu.com/6600079272/390606880/408163672",
    date: "2026-05-24",
    historical: true,
    importance: 82,
  },
  {
    platformId: "xueqiu",
    type: "market",
    title: "国产存储扩产与设备材料讨论",
    titleKo: "중국 메모리 증설과 장비·소재 파급 토론",
    summary: "중국 메모리 증설이 식각·증착·세정·소재 업체에 미칠 영향을 논의한 과거 글입니다. 장비 qualification이나 발주 수치는 공식 자료와 교차 확인할 때만 사용합니다.",
    link: "https://xueqiu.com/1980283165/386139941",
    date: "2026-04-28",
    historical: true,
    importance: 79,
  },
  {
    platformId: "xueqiu",
    type: "market",
    title: "长鑫存储与长江存储战略角色讨论",
    titleKo: "CXMT·YMTC의 전략적 역할과 지배구조 토론",
    summary: "투자자들이 두 메모리 기업의 역할과 자본 관계를 토론한 글입니다. 지분·지배구조 주장은 확인되지 않은 커뮤니티 의견으로 두고 거래소·기업 공시가 나올 때만 사실로 사용합니다.",
    link: "https://www.xueqiu.com/3668938448/389331999/407841840",
    date: "2026-05-22",
    historical: true,
    importance: 78,
  },
  {
    platformId: "xueqiu",
    type: "market",
    title: "国产存储材料供应链讨论",
    titleKo: "중국 메모리 소재 공급망 관심 변화",
    summary: "커뮤니티에서 메모리 증설과 소재 공급업체의 연결 가능성을 논의했습니다. 특정 공급 관계는 미검증이므로 반복 언급 빈도만 관찰하고 고객·납품 사실은 공시로 확인합니다.",
    link: "https://www.xueqiu.com/4481940052/389654930/407619465",
    date: "2026-05-20",
    historical: true,
    importance: 75,
  },
  {
    platformId: "zhihu",
    type: "workplace",
    title: "长鑫存储2027届校园招聘信息",
    titleKo: "CXMT 2027 캠퍼스 채용 직무·근무지 공개",
    summary: "공개 채용 안내는 연구개발·공정·장비 등 모집 축과 근무지 변화를 보여줍니다. 채용 방향은 기술 우선순위의 선행 신호지만 실제 인원과 프로젝트 규모를 뜻하지는 않습니다.",
    link: "https://zhuanlan.zhihu.com/p/2046257095788574179",
    date: "2026-06-05",
    historical: true,
    importance: 88,
  },
  {
    platformId: "zhihu",
    type: "consumer",
    title: "DDR5价格与消费者装机体验讨论",
    titleKo: "DDR5 가격 조정과 소비자 체감 토론",
    summary: "사용자들이 DDR5 소매가격과 구매 시점을 논의했습니다. 소비자 체감은 유통 재고의 약한 선행 신호로만 보고 TrendForce Spot·Contract 흐름과 함께 비교합니다.",
    link: "https://www.zhihu.com/tardis/jm/ans/2031120811633927844",
    date: "2026-04-24",
    historical: true,
    importance: 76,
  },
  {
    platformId: "zhaopin",
    type: "workplace",
    title: "长鑫存储良率工程师招聘",
    titleKo: "CXMT 수율 엔지니어 공개 채용 공고",
    summary: "공개 채용 공고에서 수율 개선 직무 수요를 확인할 수 있습니다. 공고 존재는 공정 안정화 우선순위의 신호지만 채용 인원이나 실제 수율 수준을 의미하지는 않습니다.",
    link: "https://www.zhaopin.com/jobdetail/CC604839930J40810641007.htm",
    period: "공개 채용",
    historical: true,
    importance: 90,
  },
  {
    platformId: "zhaopin",
    type: "workplace",
    title: "长鑫存储公开职位覆盖良率、失效分析、测试与生产",
    titleKo: "CXMT 공개 채용이 수율·불량 분석·테스트·생산으로 확장",
    summary: "2026년 7월 17일 공개 페이지 스냅샷에는 207개 직무가 표시되고, FT 수율 개선·전기적 불량 분석·어레이/ATE 테스트·생산 직무가 함께 노출됩니다. 페이지 수는 수시로 바뀌며 실제 채용 인원이나 수율 수준을 뜻하지 않습니다.",
    insight: "SKHY는 총 공고 수보다 수율·불량 분석·테스트 직무의 재게시 기간과 지역 분포를 추적해 CXMT의 양산 안정화 병목이 어디에 남아 있는지 판단해야 합니다.",
    validation: "활성 공고 수의 일별 스냅샷 · 수율/FA/테스트 비중 · 근무지 · 재게시 주기",
    link: "https://www.zhaopin.com/companydetail/jobs-CZ604839930/",
    observedAt: "2026-07-17",
    period: "2026년 7월 17일 공개 확인",
    historical: false,
    importance: 94,
  },
  {
    platformId: "v2ex",
    type: "technology",
    title: "长鑫DRAM与长江存储NAND的区别讨论",
    titleKo: "개발자 커뮤니티의 CXMT DRAM·YMTC NAND 구분 토론",
    summary: "개발자 커뮤니티가 CXMT의 DRAM과 YMTC의 NAND 사업을 구분해 설명한 과거 토론입니다. 오래된 글이므로 현재 기술·점유율 근거가 아니라 용어와 시장 인식 변화의 기준점으로만 보존합니다.",
    link: "https://global.v2ex.com/t/983732",
    period: "2023년 10월",
    historical: true,
    importance: 72,
  },
  {
    platformId: "campus-career",
    type: "workplace",
    title: "武汉新芯2026届校园招聘简章",
    titleKo: "XMC 2026 캠퍼스 채용 공개 자료",
    summary: "대학 취업센터에 공개된 XMC 채용 자료는 공정·장비·제품·지원 직무의 채용 방향을 확인하는 출발점입니다. 채용 직무는 기술 우선순위 신호이며 채용 규모로 확대 해석하지 않습니다.",
    link: "https://jy.xmu.edu.cn/attachment/xdu/ueditor/file/20250822/4368_%E6%96%B0%E8%8A%AF%E8%82%A1%E4%BB%BD2026%E5%B1%8A%E6%A0%A1%E5%9B%AD%E6%8B%9B%E8%81%98%E7%AE%80%E7%AB%A0.pdf",
    date: "2025-08-22",
    historical: true,
    importance: 84,
  },
  {
    platformId: "boss",
    type: "workplace",
    title: "长鑫存储公开岗位出现失效分析、量测与厂务气体方向",
    titleKo: "CXMT 공개 채용에 불량 분석·계측·Fab 유틸리티 직무 노출",
    summary: "BOSS直聘의 CXMT 공개 기업 페이지에서 불량 분석, 계측 공정, 반도체 제품, Fab 가스 설비 관련 직무가 함께 확인됩니다. 공정 안정화와 생산 운영 역량을 동시에 보강하는 신호로 보되 실제 채용 인원은 공개되지 않았습니다.",
    insight: "SKHY는 중국 DRAM의 제품 발표보다 불량 분석·계측·유틸리티 직무가 반복되는 기간을 추적해 양산 안정화 병목이 이동하는지 판단해야 합니다.",
    validation: "직무별 활성 공고 수 · 근무지 · 재게시 주기 · 공정/유틸리티 비중",
    link: "https://m.zhipin.com/companys/380a8a617d34f3501HFz3dm8EVU~.html",
    observedAt: "2026-07-17",
    period: "2026년 7월 공개 확인",
    historical: false,
    importance: 94,
  },
  {
    platformId: "liepin",
    type: "workplace",
    title: "长鑫存储公开职位覆盖AI架构、后端成本与供应链职能",
    titleKo: "CXMT 채용 직무가 AI 아키텍처·후단 원가·공급망으로 확장",
    summary: "猎聘의 CXMT 공개 채용 페이지에는 AI 아키텍처, 후단 원가 전략, 구매·통관 등 기술과 운영 직무가 함께 노출됩니다. 단일 직무 수보다 제품 개발과 원가·공급망 기능이 동시에 나타나는지를 관찰합니다.",
    insight: "SKHY는 CXMT의 위협을 웨이퍼 캐파만으로 보지 말고 설계·원가·조달을 묶는 운영 체계 구축 신호로 평가해야 합니다.",
    validation: "활성 직무군 · 기술/운영 직무 비중 · 근무지 · 동일 직무 재게시 주기",
    link: "https://www.liepin.com/company-jobs/9728935/",
    observedAt: "2026-07-17",
    period: "2026년 7월 공개 확인",
    historical: false,
    importance: 91,
  },
  {
    platformId: "nowcoder",
    type: "workplace",
    title: "长鑫存储2027提前批覆盖工艺、硬件与技术支持",
    titleKo: "CXMT 2027 조기 채용에서 공정·하드웨어·기술지원 직무 확인",
    summary: "牛客의 공개 기업 채용 페이지는 2026년 4월 갱신된 CXMT 조기 채용 일정과 허페이·시안·베이징·상하이 근무지를 제시합니다. 채용 분야는 전자·반도체, 하드웨어, 기계, 화공, 기술지원으로 분산되어 있습니다.",
    insight: "지역별 직무 배치는 Fab 운영과 R&D 기능의 분업 방향을 보여주는 선행 신호입니다. SKHY는 핵심 수율 인력의 이동보다 먼저 캠퍼스 인재 파이프라인의 직무 믹스 변화를 봐야 합니다.",
    validation: "채용 도시 · 직무군 · 지원 기간 · 공식 채용 페이지 일치 여부",
    link: "https://www.nowcoder.com/enterprise/5758/?page=1&recruitType=0",
    date: "2026-04-23",
    period: "2026년 4월 갱신",
    historical: false,
    importance: 89,
  },
  {
    platformId: "nowcoder",
    type: "workplace",
    title: "长鑫存储PE面试集中在CVD、工艺认知与产线适配",
    titleKo: "CXMT 공정 면접에서 CVD·공정 이해·교대 적응을 반복 확인",
    summary: "牛客의 공개 면접 경험에는 CVD 원리, 공정 엔지니어 역할, 소재 연구와 공정 통합의 연결, 24시간 생산 라인 교대 적응 질문이 반복됩니다. 개인 경험담이므로 채용 정책 확정값이 아니라 직무 요구 역량의 보조 신호입니다.",
    insight: "SKHY는 경쟁사의 양산 역량을 추정할 때 채용 공고 수보다 공정 기초·라인 안정성·교대 운영을 묻는 면접 패턴이 장기간 반복되는지 확인해야 합니다.",
    validation: "동일 질문 반복 빈도 · 공정 직무 비중 · 게시 시점 · 공식 JD와의 일치",
    link: "https://www.nowcoder.com/enterprise/5758/interview",
    observedAt: "2026-07-17",
    period: "2026년 7월 공개 확인",
    historical: false,
    importance: 92,
  },
  {
    platformId: "zhihu",
    type: "technology",
    title: "微星验证长鑫DDR5在AMD平台达到8000至8200MT/s",
    titleKo: "MSI가 CXMT DDR5의 AMD 플랫폼 8000~8200MT/s 구동을 공개",
    summary: "知乎 공개 글은 MSI의 BIOS 튜닝으로 CXMT 16Gb DDR5가 AMD AM5 플랫폼에서 8000MT/s 이상 구동된 사례를 다룹니다. 플랫폼 호환성 개선 신호지만 DRAM 수율, 비트 원가, 대규모 OEM 인증을 의미하지는 않습니다.",
    insight: "SKHY는 고클럭 시연 자체보다 메인보드 지원 범위, 모듈 ASP, OEM 인증, 반품률이 함께 개선되는지를 가격 방어 판단의 반증 KPI로 둬야 합니다.",
    validation: "지원 메인보드 수 · OEM 인증 · 모듈 ASP · 장기 안정성/반품률",
    link: "https://zhuanlan.zhihu.com/p/2057735650443636764",
    date: "2026-07-07",
    historical: false,
    importance: 93,
  },
  {
    platformId: "zhihu",
    type: "technology",
    title: "长江存储TiPro9000 PCIe 5.0与Xtacking 4.0讨论",
    titleKo: "YMTC TiPro9000과 Xtacking 4.0의 소비자 SSD 적용 논의",
    summary: "知乎 공개 답변은 TiPro9000 PCIe 5.0 SSD와 Xtacking 4.0 기반 NAND의 성능·발열·플랫폼 구성을 논의합니다. 개별 사용자 평가이므로 기업용 SSD 인증이나 출하 점유율로 확대 해석하지 않습니다.",
    insight: "SKHY는 YMTC의 기술 위협을 층수만으로 비교하지 말고 컨트롤러 조합, 채널 재고, 펌웨어 안정성, 기업용 고객 인증으로 분해해야 합니다.",
    validation: "NAND/컨트롤러 세대 · 채널 재고 · 펌웨어 업데이트 · eSSD 고객 인증",
    link: "https://www.zhihu.com/question/7719659161/answer/68573401830",
    observedAt: "2026-07-17",
    period: "2026년 7월 공개 확인",
    historical: false,
    importance: 88,
  },
  {
    platformId: "smzdm",
    type: "technology",
    title: "长江存储PE501企业级QLC SSD公开评测",
    titleKo: "YMTC PE501 기업용 QLC SSD의 공개 제품 평가",
    summary: "什么值得买의 공개 글은 YMTC PE501 PCIe 5.0 기업용 SSD와 Xtacking 4.0 기반 QLC 구성을 다룹니다. 제품 노출은 eSSD 진입 의지의 신호지만 실제 하이퍼스케일러 인증과 출하 물량은 별도 근거가 필요합니다.",
    insight: "SKHY는 공개 벤치마크보다 고객 qualification 기간, 펌웨어 검증, 보증 정책, 반복 수주가 확인되는 시점을 eSSD 방어 투자 게이트로 삼아야 합니다.",
    validation: "기업 고객 인증 · 반복 수주 · 펌웨어 검증 · 보증/내구성 조건",
    link: "https://post.smzdm.com/p/a5rzwqe7/",
    observedAt: "2026-07-17",
    period: "2026년 6월 공개 글",
    historical: false,
    importance: 90,
  },
  {
    platformId: "boss",
    type: "workplace",
    title: "中微公司公开岗位覆盖刻蚀设备与TSV应用",
    titleKo: "AMEC 공개 채용에서 식각 장비·TSV 응용 직무 확인",
    summary: "BOSS直聘의 AMEC 공개 기업 페이지에는 CCP·ICP 식각 장비와 TSV 응용에 연결되는 기술·장비 직무가 노출됩니다. 채용 정보는 고객 qualification 완료나 양산 장비 점유율을 뜻하지 않습니다.",
    insight: "SKHY는 중국 장비 내재화 위험을 채용 건수로 확정하지 말고 TSV·식각 응용 인력, 고객 반복 발주, 공정 qualification 기간을 함께 추적해야 합니다.",
    validation: "TSV/식각 직무 비중 · 고객 반복 발주 · 공정 qualification · 서비스 거점",
    link: "https://m.zhipin.com/companys/66a2d4d6cefbca221XZ63dq6FVs~.html",
    observedAt: "2026-07-17",
    period: "2026년 7월 공개 확인",
    historical: false,
    importance: 90,
  },
];

const COMPETITORS = [
  {
    id: "samsung",
    label: "Samsung Electronics",
    shortLabel: "Samsung",
    segment: "DRAM · NAND · HBM · 패키징",
    baseline: "DRAM 점유율과 턴키 패키징 역량이 강점. HBM4 인증·수율·고객 전환 속도를 매일 확인.",
    queries: ["Samsung Electronics HBM4 DRAM NAND AI memory"],
    watchWords: ["HBM4", "HBM3E", "Nvidia", "Broadcom", "foundry", "packaging", "yield"],
    pressureBase: 28,
  },
  {
    id: "micron",
    label: "Micron",
    shortLabel: "Micron",
    segment: "DRAM · HBM · 미국 AI 고객",
    baseline: "미국 상장 프리미엄과 HBM 고객 다변화가 강점. 선급계약·CAPEX·HBM4 로드맵 확인.",
    queries: ["Micron HBM AI memory DRAM guidance", "Micron FY2026 capex above 25 billion SEC", "Micron strategic customer agreements 16 100 billion 22 billion", "Micron Anthropic AI memory storage architecture agreement"],
    watchWords: ["HBM", "HBM4", "guidance", "AI", "contract", "SCA", "Anthropic", "capacity", "earnings"],
    pressureBase: 30,
  },
  {
    id: "cxmt",
    label: "CXMT",
    shortLabel: "CXMT",
    segment: "중국 DRAM · DDR5",
    baseline: "레거시 DRAM 가격 하방 압력과 중국 내수 수요의 핵심 변수. DDR5 양산 뉴스 확인.",
    queries: ["CXMT ChangXin DRAM DDR5 China memory"],
    watchWords: ["DDR5", "China", "capacity", "sanction", "yield", "price"],
    pressureBase: 22,
  },
  {
    id: "kioxia",
    label: "Kioxia / SanDisk",
    shortLabel: "Kioxia·SanDisk",
    segment: "NAND · 엔터프라이즈 SSD",
    baseline: "NAND 공급 조절, SSD 계약가, 일본·미국 자본 지출 동향이 하이닉스 NAND 전략에 직접 영향.",
    queries: ["Kioxia SanDisk NAND SSD BiCS investment", "Kioxia SanDisk Yokkaichi joint venture 2034 1.165 billion", "Kioxia 10th generation BiCS Kitakami production July 2026"],
    watchWords: ["NAND", "SSD", "enterprise", "wafer", "capacity", "IPO"],
    pressureBase: 20,
  },
  {
    id: "ymtc",
    label: "YMTC",
    shortLabel: "YMTC",
    segment: "중국 NAND / SSD",
    baseline: "중국 NAND 내재화와 가격 경쟁의 장기 변수. 제재 우회, 양산 수율, 고객 확대 확인.",
    queries: ["YMTC Yangtze Memory NAND China Xtacking", "YMTC enterprise SSD customer", "YMTC Wuhan Phase 3 NAND equipment"],
    watchWords: ["NAND", "Xtacking", "China", "sanction", "capacity", "smartphone", "eSSD", "Wuhan", "firmware"],
    pressureBase: 18,
  },
];

const STARTUPS = [
  {
    id: "xcena",
    name: "XCENA",
    area: "CXL 기반 컴퓨테이셔널 메모리",
    stage: "Growth",
    geography: "Korea / US",
    fitScore: 88,
    thesis: "AI 추론 병목을 메모리 가까이에서 처리하는 CXL 모듈형 접근.",
    whyHynix: "HBM 이후의 CXL 메모리 확장·근접연산 제품 포트폴리오 옵션.",
    watch: "서버 OEM PoC, CXL 3.0 상호운용성, 메모리 모듈 공급 파트너십",
    queries: ["XCENA CXL computational memory startup"],
    tags: ["CXL", "near-memory", "AI inference"],
  },
  {
    id: "celestial-ai",
    name: "Celestial AI",
    area: "광 인터커넥트 · chip-to-memory fabric",
    stage: "Late-stage",
    geography: "US",
    fitScore: 86,
    thesis: "AI 가속기와 메모리 사이 대역폭·전력 병목을 포토닉 패브릭으로 완화.",
    whyHynix: "HBM 패키지와 광 I/O 결합 가능성, 차세대 AI 메모리 차별화.",
    watch: "패키징 파트너, 광엔진 수율, 대형 고객 양산 일정",
    queries: ["Celestial AI Photonic Fabric memory interconnect"],
    tags: ["photonics", "interconnect", "HBM"],
  },
  {
    id: "lightmatter",
    name: "Lightmatter",
    area: "포토닉 컴퓨팅 · AI 인터커넥트",
    stage: "Late-stage",
    geography: "US",
    fitScore: 80,
    thesis: "AI 클러스터 내부 데이터 이동 비용을 광 기반 네트워크로 낮추는 접근.",
    whyHynix: "HBM 수요를 만드는 AI 클러스터 병목을 이해하고 공동 레퍼런스 설계 가능.",
    watch: "Passage 채택 고객, GPU·ASIC 패키지 통합 로드맵",
    queries: ["Lightmatter Passage photonic interconnect AI"],
    tags: ["photonics", "AI cluster", "interconnect"],
  },
  {
    id: "ayar-labs",
    name: "Ayar Labs",
    area: "in-package 광 I/O (optical chiplet)",
    stage: "Late-stage",
    geography: "US",
    fitScore: 82,
    thesis: "TeraPHY 광 I/O 칩렛으로 패키지 내부 대역폭·전력 병목을 해소.",
    whyHynix: "HBM·가속기 패키지에 광 I/O를 통합하는 차세대 메모리 인터페이스 옵션.",
    watch: "UCIe-optical, 파운드리·패키징 파트너, 대형 고객 채택",
    queries: ["Ayar Labs optical IO chiplet memory funding"],
    tags: ["photonics", "optical I/O", "chiplet"],
  },
  {
    id: "xconn",
    name: "XConn Technologies",
    area: "CXL 스위치 · 메모리 풀링",
    stage: "Scale-up",
    geography: "US",
    fitScore: 78,
    thesis: "CXL 스위치로 서버 메모리 풀링과 확장성을 높이는 인프라 레이어.",
    whyHynix: "CXL 메모리 모듈 수요 창출 및 데이터센터 레퍼런스 확보.",
    watch: "CXL 3.0 스위치 인증, hyperscaler PoC, MemVerge 등 SW 생태계",
    queries: ["XConn Technologies CXL switch memory pooling"],
    tags: ["CXL", "switch", "memory pooling"],
  },
  {
    id: "memverge",
    name: "MemVerge",
    area: "메모리 가상화 · CXL 소프트웨어",
    stage: "Scale-up",
    geography: "US",
    fitScore: 76,
    thesis: "CXL·DRAM·스토리지를 워크로드 단위로 묶는 소프트웨어 계층.",
    whyHynix: "하드웨어 모듈만이 아니라 운영 소프트웨어까지 포함한 CXL GTM 강화.",
    watch: "CXL 풀링 레퍼런스, 클라우드 배포, 파트너 스위치·메모리 호환성",
    queries: ["MemVerge CXL memory pooling software"],
    tags: ["CXL", "software", "memory virtualization"],
  },
  {
    id: "unifabrix",
    name: "UnifabriX",
    area: "CXL 메모리 · Smart Memory Node",
    stage: "Series A",
    geography: "Israel",
    fitScore: 75,
    thesis: "CXL 기반 메모리 풀링 어플라이언스로 AI 워크로드 대역폭·용량 확장.",
    whyHynix: "CXL 모듈 수요와 레퍼런스 아키텍처 공동 설계 가능.",
    watch: "MAX over CXL, 하이퍼스케일 PoC, 표준 적합성",
    queries: ["UnifabriX CXL memory pooling startup"],
    tags: ["CXL", "memory node", "pooling"],
  },
  {
    id: "eliyan",
    name: "Eliyan",
    area: "chiplet 인터커넥트 (NuLink)",
    stage: "Series B",
    geography: "US",
    fitScore: 74,
    thesis: "유기 기판 위 고대역 칩렛 연결로 실리콘 인터포저 의존도를 낮춤.",
    whyHynix: "HBM·칩렛 패키지 비용·대역폭 구조를 바꾸는 인터커넥트 옵션.",
    watch: "NuLink/UMI 채택, 메모리·로직 패키지 레퍼런스",
    queries: ["Eliyan chiplet interconnect NuLink memory"],
    tags: ["chiplet", "interconnect", "packaging"],
  },
  {
    id: "dmatrix",
    name: "d-Matrix",
    area: "디지털 in-memory compute (추론)",
    stage: "Late-stage",
    geography: "US",
    fitScore: 73,
    thesis: "메모리 중심 추론 가속으로 AI 추론 비용·전력을 낮추는 접근.",
    whyHynix: "near-memory/PIM 생태계 신호와 메모리 중심 컴퓨팅 수요 파악.",
    watch: "Corsair 채택, 추론 TCO, 메모리 파트너십",
    queries: ["d-Matrix in-memory compute AI inference funding"],
    tags: ["in-memory", "inference", "near-memory"],
  },
  {
    id: "enfabrica",
    name: "Enfabrica",
    area: "AI 네트워크·메모리 패브릭",
    stage: "Late-stage",
    geography: "US",
    fitScore: 71,
    thesis: "GPU-메모리-네트워크를 잇는 패브릭으로 메모리 확장·공유를 가속.",
    whyHynix: "CXL/메모리 패브릭 수요와 데이터센터 메모리 확장 구조 이해.",
    watch: "ACF SuperNIC, 하이퍼스케일 채택, CXL 연계",
    queries: ["Enfabrica AI network memory fabric funding"],
    tags: ["fabric", "memory", "networking"],
  },
  {
    id: "primemas",
    name: "Primemas",
    area: "CXL · chiplet hub SoC",
    stage: "Series B",
    geography: "US / Asia",
    fitScore: 70,
    thesis: "AI·CXL용 칩렛 허브 SoC로 메모리 확장과 이기종 연결을 단순화.",
    whyHynix: "HBM·CXL·chiplet 생태계 사이의 컨트롤러 IP 옵션.",
    watch: "제품 샘플링, UCIe/CXL 호환성, 서버 플랫폼 채택",
    queries: ["Primemas CXL chiplet hub SoC memory"],
    tags: ["chiplet", "CXL", "controller"],
  },
  {
    id: "neurophos",
    name: "Neurophos",
    area: "실리콘 포토닉 AI 연산",
    stage: "Early-growth",
    geography: "US",
    fitScore: 68,
    thesis: "광 기반 AI 연산이 대규모 메모리 대역폭 요구를 바꿀 수 있는 장기 옵션.",
    whyHynix: "HBM 수요 구조 변화와 광 I/O 패키징 협력 가능성을 조기 탐색.",
    watch: "2028 양산 가능성, SRAM/벡터 유닛 통합, 파운드리 호환성",
    queries: ["Neurophos silicon photonics AI compute startup"],
    tags: ["photonics", "AI compute", "long option"],
  },
];

// Foreign benchmark themes feeding the China memory signal radar.
const BENCHMARK_SIGNAL_THEMES = [
  { id: "capacity", label: "China Capacity", queries: ["CXMT capacity DRAM wafer China", "YMTC NAND capacity Xtacking China", "CXMT Shanghai fab DRAM wafer start", "CXMT IPO proceeds wafer capacity", "YMTC Wuhan Phase 3 30000 initial 50000 by 2027 100000 full capacity", "YMTC Wuhan Line 1 100000 Line 2 60000 160000 wpm existing fabs 200000 source discrepancy", "Counterpoint CXMT 11 percent DRAM market share Q1 2026", "CXMT 300000 wafers per month 2026 600000 target", "China memory capacity expansion 120000 140000 wafers 2026"] },
  { id: "china_nand_business", label: "China NAND Business", queries: ["YMTC eSSD customer NAND China", "YMTC Xtacking 4.0 enterprise SSD", "XMC Wuhan Xinxin NAND packaging", "JCET TFME NAND controller advanced packaging", "JCET XDFOI advanced packaging memory", "TFME advanced packaging China memory", "Naura AMEC ACM YMTC NAND equipment", "AMEC etch YMTC NAND", "ACM Research cleaning YMTC NAND", "China server SSD procurement YMTC", "YMTC NAND share 13 percent 2026", "Chinese memory chips price advantage 15 percent"] },
  { id: "skhynix_product_projection", label: "SKHY Product Projection", queries: ["SK hynix HBM4 DDR5 CXL server roadmap", "SK hynix Solidigm enterprise SSD AI server demand", "SK hynix LPDDR UFS client SSD product mix", "memory AI server product mix projection DRAM NAND HBM", "automotive edge AI memory SK hynix"] },
  { id: "equipment", label: "Equipment Localization", queries: ["China semiconductor equipment localization NAURA Technology Group AMEC", "Chinese chip equipment localization memory", "China semiconductor equipment localization rate paid research source verification", "Yole 2026 39 percent 2030 localization 2025 52 percent China semiconductor equipment", "MATCH Act DUV lithography cryogenic etching China removed blanket ban", "YMTC homegrown NAND production line NAURA AMEC ACM", "Naura Qomola HPD30 hybrid bonding SEMICON China 2026", "ACM Research IR first quarter 2026 results revenue 231.263 shipments 240.7", "ACM Research Entity List 2025 China revenue concentration"] },
  { id: "china_infra", label: "China Fab Infrastructure", queries: ["SK hynix Wuxi K7 plot water power fab expansion", "SK hynix Wuxi environmental impact assessment wastewater reuse", "Wuxi bonded zone SK hynix comprehensive bonded zone expansion", "BIS VEU SK hynix China fab capacity upgrade", "Wuxi semiconductor fab water electricity land use"] },
  { id: "china_talent_strategy", label: "China Talent Strategy", queries: ["SK hynix China workforce strategy Wuxi Dalian Chongqing", "China memory hiring strategy IP retention compliance", "CXMT YMTC Boss Zhipin yield engineer hiring", "China semiconductor campus recruiting Tsinghua memory engineer", "China fab EHS facility water power engineer hiring", "CXMT Zhu Yiming engineer DIGITIMES SCMP", "CXMT IPO filing Micron Samsung alumni international talent base DIGITIMES"] },
  { id: "packaging", label: "Advanced Packaging", queries: ["JCET advanced packaging AI memory", "JCET XDFOI HBM AI packaging", "TFME advanced packaging memory China", "Huawei Ascend HBM packaging supply chain", "HBM TC bonder patent equipment"] },
  { id: "cxl", label: "CXL and PIM Value Chain", queries: ["CXL memory tester Exicon Neosem", "CXL controller IP memory pooling PIM", "CXL 3.1 module substrate TLB", "Openedges CXL controller IP", "FADU CXL memory controller"] },
  { id: "talent", label: "Talent and IP Signals", queries: ["China semiconductor talent hiring memory", "CXMT engineer hiring DRAM", "CXMT TSV yield engineer recruitment", "YMTC Xtacking eSSD engineer recruitment", "ijiwei CXMT YMTC recruitment engineer", "Tsinghua career CXMT YMTC semiconductor recruitment", "Boss Zhipin CXMT YMTC yield engineer", "Liepin CXMT YMTC semiconductor engineer", "Maimai CXMT YMTC memory engineer", "CNIPA CXMT YMTC HBM TSV patent", "China memory IP litigation Korean engineer CXMT YMTC"] },
];

// Preserve decision-relevant foreign reporting even when a daily search result
// temporarily drops out. These seeds are merged with fresh search results and
// deduplicated by canonical title; reported estimates never become confirmed facts.
const BENCHMARK_SIGNAL_SEEDS = [
  {
    themeId: "capacity",
    title: "CXMT close to matching Micron's memory capacity in 2026, research claims — would put China on track to become world's second-largest DRAM producer - Tom's Hardware",
    titleKo: "연구 모델은 CXMT의 2026년 DRAM 캐파가 Micron에 근접할 수 있다고 추정",
    source: "Tom's Hardware",
    sourceType: "외신",
    evidenceLevel: "Reported",
    date: "2026-07-15",
    link: "https://www.tomshardware.com/pc-components/dram/cxmt-close-to-matching-microns-memory-capacity-in-2026-research-claims-would-put-china-on-track-to-become-worlds-second-largest-dram-producer",
    summary: "Tom's Hardware가 인용한 연구는 CXMT의 2026년 월 투입 캐파가 Micron에 근접할 가능성을 제시합니다. 이는 연구 모델 기반 전망이며 실제 웨이퍼 투입, 비트 생산량, 수율을 확정하지 않습니다.",
    insight: "SKHY는 명목 캐파보다 양품 비트 출하와 DDR5 계약가 전이를 확인한 뒤 범용 DRAM 방어 강도를 높여야 합니다.",
    validation: "월 웨이퍼 투입 · 양품 비트 출하 · DDR5 수율 · 고객 출하 · Spot/Contract spread",
  },
  {
    themeId: "capacity",
    title: "Can China’s memory chip giant CXMT keep thriving after IPO and AI boom? - South China Morning Post",
    titleKo: "SCMP가 CXMT의 IPO 이후 성장 지속성과 AI 수요 의존도를 분석",
    source: "South China Morning Post",
    sourceType: "외신",
    evidenceLevel: "Reported",
    date: "2026-07-02",
    link: "https://news.google.com/rss/articles/CBMi0gFBVV95cUxNVEVjX2d6NWNyZzhCcTZjb21GbVVwam9oOEs4aHBxdU91SlE3SlBYWjlSenBGWjRkS2Q4bFNkQnZ1LXF3TDltVmpjWWYwQ2Vybkx0SHFMMnlMUkFrOVFBUkhNUWtscUJ1YVRKSnpEbVNuckRZR2ptekRVSU1Ec0xheW1kOEJIWm8zVU5TSFI0ZEFtRnlMc2lNTmwzVUJ6UEVkYzF6aWJQbjFZOVdDMzJOdXBnaDNnMmx6MVpSTUhfTW1Jc18xallZNkplOE43Rk05OUHSAdIBQVVfeXFMTTAwU1B3bDZSUHNTblNrdWpicGtfWTF4S2l5N2YwREhsSVdFOWlmZjVsOXdkT1dJYnNGWWQtYVZHQ1I2UE1VY3p2aTJFZ1N2NHBQLXpCMjk1TlJoUjRKTEFwQk05TzYtZ2psM3Frb3pST0dNZ2NWTG80UkotRGMxQTV6ZTRRajN6cHNKbjlhOXJkLXFVTEpSd2g5NWtmMWpVZS1Oa3ZUREp4dVo3dDhtc2Q3V0ZDU3FsSXFDQjJrbVZTenF5TFJ4eU05dTEySGJlalRB?oc=5",
    summary: "SCMP는 IPO 자금, AI 수요, 중국 내 고객 기반이 CXMT 성장의 지속성을 얼마나 뒷받침하는지 분석합니다. 기사 분석은 고객 주문과 실제 출하를 분리해 읽어야 합니다.",
    insight: "SKHY는 IPO 규모 자체보다 자금 집행이 범용 DRAM 캐파와 고객 승인으로 전환되는 속도를 추적해야 합니다.",
    validation: "IPO 자금 집행 · 장비 반입 · 고객 승인 · 실제 출하 · ASP",
  },
  {
    themeId: "capacity",
    title: "EXCLUSIVE: China's CXMT wins $3 billion memory supply deal with Tencent, sources say - Reuters",
    titleKo: "Reuters가 CXMT-텐센트 200억 위안 이상 메모리 공급계약을 보도",
    source: "Reuters",
    sourceType: "외신",
    evidenceLevel: "Reported",
    date: "2026-06-29",
    link: "https://www.reuters.com/world/china/chinas-cxmt-wins-3-billion-memory-supply-deal-with-tencent-sources-say-2026-06-29/",
    summary: "Reuters는 익명 소식통을 인용해 계약 규모를 200억 위안 이상, 약 $2.94B로 보도했습니다. 계약 기간은 소식통별 3년 또는 5년으로 엇갈려 회사 공시 전까지 Reported로 유지합니다.",
    insight: "SKHY에는 금액보다 중국 서버 DRAM 승인 공급사 진입과 장기 물량이 가격 협상력에 미치는 영향이 핵심입니다.",
    validation: "회사 공시 · 계약 기간 · 연간 출하 물량 · 제품 믹스 · 실제 매출 인식",
  },
  {
    themeId: "capacity",
    title: "China’s CXMT Is Set to Challenge DRAM Incumbents - SemiAnalysis",
    titleKo: "SemiAnalysis가 CXMT의 DRAM 공급 확대와 원가·사이클 영향을 분석",
    source: "SemiAnalysis",
    sourceType: "분석",
    evidenceLevel: "Reported",
    date: "2026-06-23",
    link: "https://newsletter.semianalysis.com/p/chinas-cxmt-is-set-to-challenge-dram",
    summary: "SemiAnalysis는 CXMT의 캐파 확대뿐 아니라 메모리 가격 사이클과 ASP가 실적 개선을 크게 좌우한다고 분석합니다. 모델 수치는 공시와 실제 출하로 교차 확인해야 합니다.",
    insight: "SKHY는 CXMT의 점유율 상승과 업황 상승 효과를 분리해 범용 DRAM의 구조적 위협을 과대평가하지 않아야 합니다.",
    validation: "양품 비트 출하 · ASP · 제품별 원가 · 공시 매출 · 고객 믹스",
  },
  {
    themeId: "capacity",
    title: "YMTC NAND share rises to 13%, alarming South Korean rivals - digitimes",
    titleKo: "DigiTimes가 YMTC NAND 점유율 13% 상승을 보도",
    source: "DigiTimes",
    sourceType: "외신",
    evidenceLevel: "Reported",
    date: "2026-06-22",
    link: "https://news.google.com/rss/articles/CBMihgFBVV95cUxPRUlBc1FMUndzdlVLa0IzNHZPUG5vM29xSDlWS1J1TXBYSG9QT0NfYWZDMXhPa3M1cm5GNkxSZi11X2RWQVVHdXc1VnBZSXRsSmJ6dTVTTjhUSUlwTzF0R1hpRzRrajBHME1IcmxDbzVuNXdrbm1sYU5WR29aLW8wNlgzeFFqUQ?oc=5",
    summary: "DigiTimes는 YMTC의 NAND 점유율이 13%까지 상승했다고 보도합니다. 점유율은 조사기관·분기·매출 또는 출하 기준에 따라 달라질 수 있어 기준 확인 전 Reported로 둡니다.",
    insight: "SKHY는 단일 점유율보다 eSSD 고객 인증, 중국 내수 흡수, 계약가와 실제 출하의 동행 여부를 방어 투자 기준으로 봐야 합니다.",
    validation: "조사기관·기준 분기 · 매출/출하 기준 · eSSD 고객 인증 · 계약가",
  },
  {
    themeId: "china_talent_strategy",
    title: "Meet CXMT’s Zhu Yiming: the man building China’s memory-chip giant - South China Morning Post",
    titleKo: "SCMP가 CXMT 창업자 Zhu Yiming의 기술·조직 전략을 조명",
    source: "South China Morning Post",
    sourceType: "외신",
    evidenceLevel: "Reported",
    date: "2026-07-13",
    link: "https://www.scmp.com/tech/article/3360285/meet-cxmts-zhu-yiming-engineer-building-chinas-answer-global-memory-chip-giants",
    summary: "SCMP 프로필은 Zhu Yiming을 중심으로 CXMT의 기술 축적과 조직 구축 경로를 설명합니다. 인물 기사는 조직 역량의 맥락이며 채용 인원이나 수율을 증명하지 않습니다.",
    insight: "SKHY는 개인 이력보다 핵심 엔지니어의 장기 재직, 공정 통합 리더십, 후계 구조가 기술 격차 축소에 미치는 영향을 추적해야 합니다.",
    validation: "핵심 리더 재직 · 조직 개편 · 공정 책임자 이동 · 특허·제품 출시",
  },
  {
    themeId: "china_talent_strategy",
    title: "The low-profile engineer who built CXMT into a DRAM heavyweight - DIGITIMES",
    titleKo: "DigiTimes가 CXMT를 DRAM 강자로 키운 핵심 엔지니어를 분석",
    source: "DigiTimes",
    sourceType: "외신",
    evidenceLevel: "Reported",
    date: "2026-07-17",
    link: "https://www.digitimes.com/news/a20260717VL207/cxmt-dram-ipo-manufacturing-samsung.html?chid=10",
    summary: "DigiTimes는 CXMT의 제조 역량 형성 과정과 핵심 엔지니어의 역할을 분석합니다. 인물 서사는 기술 조직을 이해하는 보조 근거이며 수율·캐파 확정값으로 사용하지 않습니다.",
    insight: "SKHY는 경쟁사 인재 위험을 개인 스카우트 건수보다 공정 통합·수율·제품화 리더십이 한 조직에 결집되는지로 평가해야 합니다.",
    validation: "핵심 인력 재직 · 공정 책임 범위 · 제품 전환 · 특허 · 고객 인증",
  },
  {
    themeId: "china_talent_strategy",
    title: "CXMT IPO filing reveals Micron and Samsung alumni at heart of China's DRAM push - DIGITIMES",
    titleKo: "CXMT IPO 공시에서 Micron·Samsung 출신 인재 기반이 확인됐다는 분석",
    source: "DigiTimes",
    sourceType: "외신",
    evidenceLevel: "Reported",
    date: "2026-07-16",
    link: "https://www.digitimes.com/news/a20260716VL215/cxmt-ipo-micron-samsung-dram.html?mod=3&q=cxmt",
    summary: "DigiTimes는 CXMT IPO 공시가 글로벌 DRAM 경쟁을 위해 구축한 국제 인재 기반을 드러낸다고 보도합니다. 공개 기사와 공시 맥락만 사용하며 개인별 경력·인원은 원문 확인 전 확정하지 않습니다.",
    insight: "SKHY는 스카우트 건수보다 경쟁사의 공정 통합·수율·제품화 책임자가 어떤 기능 조합으로 배치되는지를 핵심 인재 방어 기준으로 봐야 합니다.",
    validation: "IPO 공시 · 핵심 인력 이력 · 조직 책임 범위 · 특허 · 제품 인증",
  },
];

const CHINA_INFRA_SOURCE_PAGES = [
  {
    id: "wuxi-bonded-zone",
    site: "wuxi",
    label: "Wuxi bonded zone expansion",
    url: "https://en.wuxi.gov.cn/2025-07/31/c_1113622.htm",
    // The municipal page is periodically reset while the wider crawl is
    // opening many public sources.  Give its source-level request one extra
    // bounded recovery cycle after fetchText's own transient retry.
    retryAttempts: 3,
    markers: ["3.49 square kilometers", "SK hynix", "1.11 square kilometers", "$10 billion"],
  },
  {
    id: "bis-veu",
    site: "all",
    label: "BIS VEU China fabs",
    url: "https://www.bis.gov/press-release/department-commerce-closes-export-controls-loophole-foreign-owned-semiconductor-fabs-china",
    publishedAt: "2025-08-29",
    markers: ["foreign-owned semiconductor fabs", "China", "license"],
  },
  {
    id: "census-bis-c79",
    site: "all",
    label: "AES C79 former VEU fab license reporting",
    url: "https://content.govdelivery.com/accounts/USCENSUS/bulletins/4008e2b",
    publishedAt: "2026-01-05",
    markers: ["C79", "C57", "H-prefix", "individual fab license"],
  },
  {
    id: "wuxi-1a-upgrade",
    site: "wuxi",
    label: "Wuxi 1a process upgrade",
    url: "https://www.semimedia.cc/sk-hynix-completes-wuxi-dram-fab-upgrade-enabling-advanced-1a-process-production/",
    fallbackUrls: [
      "https://www.trendforce.com/news/2026/03/27/news-memory-giants-china-investments-soar-in-2025-samsung-xian-up-67-5-sk-hynix-wuxi-dalian-hit-trillion-won/",
    ],
    publishedAt: "2026-01-22",
    markers: ["1a", "180,000", "190,000", "90%"],
  },
  {
    id: "wuxi-dalian-investment-2025",
    site: "all",
    label: "Wuxi and Dalian 2025 investment",
    url: "https://www.trendforce.com/news/2026/03/27/news-memory-giants-china-investments-soar-in-2025-samsung-xian-up-67-5-sk-hynix-wuxi-dalian-hit-trillion-won/",
    publishedAt: "2026-03-27",
    markers: ["581 billion", "440.6 billion", "Wuxi", "Dalian"],
  },
];

// Account-demand pages that expose durable canonical URLs but can be missed
// by news-index timing. They are fetched and content-validated on every run;
// registry metadata alone is never promoted as evidence.
const DIRECT_ACCOUNT_SOURCES = [
  {
    category: "account-demand",
    title: "Microsoft expands Azure AI and HPC infrastructure with AMD",
    link: "https://blogs.microsoft.com/blog/2026/07/20/microsoft-expands-azure-ai-and-hpc-infrastructure-with-amd/",
    source: "Microsoft",
    date: "2026-07-20",
  },
  {
    category: "account-demand",
    title: "AMD Helios AI rack challenges NVIDIA with HBM4 memory edge; Microsoft joins as latest customer",
    link: "https://www.trendforce.com/news/2026/07/21/news-amds-first-rack-scale-ai-system-helios-challenges-nvidia-with-hbm4-memory-edge-but-reportedly-comes-at-a-higher-price/",
    source: "TrendForce",
    date: "2026-07-21",
  },
];

const STOPWORDS = new Set([
  "memory", "chip", "chips", "price", "prices", "market", "report", "says", "said",
  "the", "and", "for", "with", "from", "that", "this", "are", "will", "has", "new",
  "its", "into", "amid", "could", "would", "their", "than", "over", "after", "more",
  "how", "why", "what", "may", "can", "out", "but", "not", "you", "your", "inc",
  "ltd", "corp", "company", "tech", "news", "update", "billion", "million", "yahoo",
  "google", "reuters", "bloomberg", "apple", "applem", "aapl", "iphone", "ipad", "macbook",
]);

// Foreign-press filter: drop Korean-language items and Korean-origin outlets so
// the dashboard stays 외신(foreign press) 중심. Applied at the single fetch choke point.
const KOREAN_SOURCE_RE = new RegExp(
  [
    "yonhap",
    "yna\\.co\\.kr",
    "korea ?herald",
    "koreaherald",
    "koreaherald\\.com",
    "korea ?times",
    "koreatimes",
    "koreatimes\\.co\\.kr",
    "chosun",
    "biz\\.chosun\\.com",
    "chosun\\.com",
    "joongang",
    "joong ?ang",
    "joins\\.com",
    "koreajoongangdaily",
    "donga",
    "dong-?a",
    "hankyung",
    "hankyoreh",
    "ked ?global",
    "kedglobal",
    "kedglobal\\.com",
    "maeil",
    "maekyung",
    "pulse ?news",
    "pulsenews",
    "pulsenews\\.co\\.kr",
    "business ?korea",
    "businesskorea",
    "businesspost",
    "et ?news",
    "etnews",
    "etnews\\.com",
    "the ?elec",
    "thelec",
    "zdnet ?korea",
    "sedaily",
    "sedaily\\.com",
    "seoul ?economic",
    "aju ?(business|news|press)",
    "korea ?economic",
    "korea ?joongang",
    "korea ?biz ?wire",
    "koreabizwire",
    "inews24",
    "edaily",
    "mt\\.co\\.kr",
    "mk\\.co\\.kr",
    "dt\\.co\\.kr",
    "\\.kr\\b",
    "korea ?pro",
    "the ?korea",
    "naver",
    "daum",
    "fnnews",
    "newspim",
    "moneytoday",
    "heraldcorp",
    "ytn",
    "ddaily"
  ].join("|"),
  "i"
);
const LOW_CONFIDENCE_NEWS_RE = /(ad hoc news|indexbox|36\s*kr|36kr|borncity|mjengo|blockchain\.news|odaily|zamin\.uz|finance\.biggo|crypto briefing|weex|fortrinawwer|siliconanalysts|nand-research|reddit|facebook|linkedin\.com|x\.com|twitter\.com)/i;
const SKHYNIX_NEWSROOM_RE = /news\.skhynix\.com|sk\s*hynix\s*newsroom|skhy\s*newsroom/i;
const AUTHORITATIVE_EN_NEWS_RE =
  /(reuters|bloomberg|financial times|ft\.com|nikkei|cnbc|associated press|apnews|sec\.gov|nasdaq|trendforce|dramexchange|techinsights|yole|counterpoint|tom'?s hardware|tomshardware|south china morning post|scmp|caixin global|caixinglobal|digitimes|ee times|eetimes|semianalysis|semimedia|techwire asia|the register|business insider|network world|evertiq|technode|techspot|japan times|electronics weekly|semiconductor engineering|semiengineering|semiconductor digest|solid state technology|ieee spectrum|jedec|semi\.org|businesswire|pr newswire|solidigm|intel|micron|tsmc|open compute project|opencompute\.org|u\.s\. bis|bis\.gov|govinfo|census\.gov|content\.govdelivery\.com\/accounts\/USCENSUS|wsts|acm research ir|cxmt|xmcwh\.com|shanghai stock exchange|samsung|samsung semiconductor|semiconductor\.samsung\.com|sandisk|panmnesia|morganstanley\.com|goldmansachs\.com|jpmorgan\.com|ubs\.com|citigroup\.com|bofa\.com|bankofamerica\.com|barclays\.com|nomura\.com|jefferies\.com|mizuho)/i;
const AUTHORITATIVE_CN_NEWS_RE =
  /(财新|caixin|第一财经|yicai|21财经|21世纪经济报道|21jingji|证券时报|stcn|中国经营报|cb\.com\.cn|东方财富|eastmoney|新浪财经|sina finance|澎湃新闻|the paper|虎嗅|huxiu|电子工程专辑|eet-china|集微网|爱集微|ijiwei|laoyaoba|半导体新闻网|seminews|经济观察网|eeo\.com\.cn|techweb|chinaflashmarket|闪存市场|semi china|中国半导体行业协会|csia|科技新报|technews\.tw|钜亨网|cnyes\.com|solidot|奇客|xinhuanet)/i;
const MEMORY_NEWS_RE =
  /(memory|dram|nand|hbm|ddr[345]?|lpddr|gddr|ssd|solidigm|cxl|wafer|memory chip|sk hynix|skhy|micron|kioxia|sandisk|cxmt|changxin|ymtc|yangtze memory|xmc|wuhan xinxin|存储|存儲|内存|记忆体|記憶體|闪存|固态|晶圆|长鑫|長鑫|长江存储|長江存儲|长存|武汉新芯)/i;
const FACT_EVENT_SEED_IDS = new Set([
  "sse-cxmt-final-offering",
  "sse-cxmt-registration-plan",
  "sec-skhynix-nasdaq-ads",
  "bis-china-fab-veu-revocation",
  "census-bis-c79-fab-license",
  "micron-sixteen-sca",
  "wsts-spring-2026-forecast",
  "trendforce-memory-market-revision-2026",
]);
const NEWS_MARKET_NOISE_RE =
  /\bETF\b|指数|领涨|领跌|净买入|净卖出|吸金|中签|打新|牛股|涨停|跌停|股价|个股|股票行情|认购|申购|抽签|赚钱|热度观测日志/i;

// Hangul / Hangul Jamo / kana / CJK / surrogate / specials. Stripped from
// titles so a Latin headline stays clean even if a multibyte char mis-decoded,
// and a genuinely Korean/CJK headline collapses to a short fragment we drop.
const NON_LATIN_RE = /[ᄀ-ᇿ　-ヿ㐀-䶿一-鿿가-힣\uD800-\uDFFF豈-﫿￹-￿]/g;
const CJK_RE = /[一-鿿]/;
const HAN_RE = /[㐀-䶿一-鿿豈-﫿]/g;
const LATIN_RE = /[A-Za-z]/g;

function cleanTitle(value) {
  return String(value || "")
    .replace(NON_LATIN_RE, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function stripNewsLabel(value = "") {
  return String(value)
    .replace(/^\s*(?:\[(?:news|뉴스)\]|(?:news|뉴스))\s*[:：-]?\s*/i, "")
    .trim();
}

function cleanLocalizedTitle(value, locale = "en") {
  if (locale === "zh") return stripNewsLabel(stripHTML(value).replace(/\s{2,}/g, " ").trim());
  return stripNewsLabel(cleanTitle(value));
}

function stripPublisherSuffixBySource(value = "", source = "") {
  let title = String(value || "").trim();
  const publisher = String(source || "").trim();
  if (!title || !publisher) return title;
  let changed = true;
  while (changed) {
    changed = false;
    for (const separator of [" - ", " – ", " — ", " | ", " : "]) {
      const suffix = `${separator}${publisher}`;
      if (!title.toLowerCase().endsWith(suffix.toLowerCase())) continue;
      title = title.slice(0, -suffix.length).trim();
      changed = true;
      break;
    }
  }
  return title;
}

function normalizeNewsPublisherSuffix(item = {}) {
  const source = item.source || "";
  return {
    ...item,
    title: stripPublisherSuffixBySource(item.title, source),
    ...(item.originalTitle ? { originalTitle: stripPublisherSuffixBySource(item.originalTitle, source) } : {}),
    ...(item.titleKo ? { titleKo: stripPublisherSuffixBySource(item.titleKo, source) } : {}),
  };
}

function scriptCount(value = "", re) {
  return (String(value).match(re) || []).length;
}

function verifiedNewsLanguage(item = {}) {
  const title = String(item.originalTitle || item.title || "").trim();
  const declared = String(item.streamLanguage || item.language || "").toLowerCase();
  const han = scriptCount(title, HAN_RE);
  const latin = scriptCount(title, LATIN_RE);
  if (declared === "chinese" && han >= 2) return "chinese";
  if (declared === "english" && han === 0 && latin >= 6) return "english";
  if (han >= 2 && han >= Math.ceil(latin * 0.12)) return "chinese";
  if (han === 0 && latin >= 6) return "english";
  return "";
}

function cleanKoNewsText(value) {
  return String(value || "")
    .replace(/^\s*(?:\[(?:news|뉴스)\]|(?:news|뉴스))\s*[:：-]?\s*/i, "")
    .replace(/\s*\[(?:news|뉴스)\]\s*/gi, " ")
    .replace(/\s*丨\s*/g, " · ")
    .replace(/SK\s*하이닉스/g, "SKHY")
    .replace(/SK하이닉스/g, "SKHY")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function canonicalNewsKey(item = {}) {
  const title = String(item.title || "")
    .replace(/\s[-–—]\s[^-–—|]+$/g, "")
    .split(/\s[—–]\s/)[0]
    .toLowerCase()
    .replace(/[^a-z0-9가-힣一-鿿 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const titleKey = /[一-鿿가-힣]/.test(title)
    ? title.replace(/\s+/g, "").slice(0, 96)
    : title.split(" ").slice(0, 10).join(" ");
  const language = verifiedNewsLanguage(item) || "unknown";
  if (titleKey) return `${language}|title:${titleKey}`;
  const url = String(item.link || item.sourceUrl || "").trim();
  if (url && !/news\.google\.com\/(?:rss\/)?articles/i.test(url)) {
    try {
      const parsed = new URL(url);
      parsed.hash = "";
      for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
        parsed.searchParams.delete(key);
      }
      return `${language}|url:${parsed.toString().replace(/\/$/, "").toLowerCase()}`;
    } catch {
      return `${language}|url:${url.replace(/#.*$/, "").replace(/\/$/, "").toLowerCase()}`;
    }
  }
  return "";
}

const NEWS_ENTITY_ALIASES = Object.freeze({
  sk_hynix: ["sk hynix", "skhy", "sk하이닉스", "에스케이하이닉스", "하이닉스"],
  samsung: ["samsung electronics", "samsung", "삼성전자", "三星电子", "三星電子"],
  micron: ["micron technology", "micron", "마이크론", "美光"],
  nvidia: ["nvidia", "엔비디아", "英伟达", "英偉達"],
  tsmc: ["taiwan semiconductor manufacturing", "tsmc", "台积电", "台積電"],
  amd: ["advanced micro devices", "amd", "超威半导体", "超微半導體"],
  asml: ["asml", "阿斯麦", "艾司摩爾"],
  broadcom: ["broadcom", "브로드컴", "博通"],
  cxmt: ["changxin memory", "changxin", "cxmt", "长鑫存储", "長鑫存儲", "长鑫科技", "長鑫科技"],
  ymtc: ["ymtc", "yangtze memory", "长江存储", "長江存儲"],
  smic: ["smic", "semiconductor manufacturing international", "中芯国际", "中芯國際"],
  naura: ["naura", "north china huachuang", "北方华创", "北方華創"],
  amec: ["amec", "advanced micro-fabrication equipment", "中微公司", "中微半导体"],
  jcet: ["jcet", "jiangsu changjiang electronics", "长电科技", "長電科技"],
  kioxia: ["kioxia", "키옥시아", "铠侠", "鎧俠"],
  sandisk: ["sandisk", "샌디스크", "闪迪", "閃迪"],
  western_digital: ["western digital", "wdc", "웨스턴디지털", "西部数据"],
  intel: ["intel", "인텔", "英特尔", "英特爾"],
  apple: ["apple", "애플", "苹果公司"],
  microsoft: ["microsoft", "마이크로소프트", "微软", "微軟"],
  amazon: ["amazon", "aws", "아마존", "亚马逊", "亞馬遜"],
  google: ["google", "alphabet", "구글", "谷歌"],
  meta: ["meta platforms", "meta", "메타 플랫폼", "元宇宙平台"],
  tesla: ["tesla", "테슬라", "特斯拉"],
});

const NEWS_STORY_STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "have", "in", "into",
  "is", "it", "its", "of", "on", "or", "says", "said", "the", "to", "with", "will", "after",
  "new", "news", "report", "reports", "update", "latest", "company", "market", "industry",
  "대한", "통해", "위한", "관련", "전망", "발표", "보도", "시장", "기업", "업계",
]);

const NEWS_MECE_AXES = Object.freeze([
  "demand-customers",
  "price-cycle",
  "supply-capacity",
  "technology-product",
  "capital-competition",
  "policy-risk",
  "operations-talent",
]);

function normalizedNewsIdentityText(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/\s[-–—|:]\s*(?:reuters|bloomberg|cnbc|nikkei asia|digitimes|trendforce|tom'?s hardware|the register|ee times|scmp|south china morning post)\s*$/i, "")
    .replace(/[’']/g, "")
    .replace(/([a-z가-힣一-鿿])\.(?=\s|$)/gi, "$1 ")
    .replace(/[^a-z0-9가-힣一-鿿.%$¥₩]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function newsEntityTags(item = {}) {
  const haystack = normalizedNewsIdentityText([
    item.originalTitle,
    item.title,
    item.titleKo,
    item.summaryOriginal,
    item.summary,
  ].filter(Boolean).join(" "));
  if (!haystack) return [];
  return Object.entries(NEWS_ENTITY_ALIASES)
    .filter(([, aliases]) => aliases.some((alias) => haystack.includes(normalizedNewsIdentityText(alias))))
    .map(([entity]) => entity);
}

function newsStoryTokens(item = {}) {
  const normalized = normalizedNewsIdentityText([
    item.originalTitle,
    item.title,
    item.titleKo,
    item.summaryOriginal,
    item.summary,
  ].filter(Boolean).join(" "));
  return [...new Set(normalized.split(" ")
    .map((token) => /^[a-z]{6,}$/i.test(token) ? token.replace(/(?:ing|ed|es|s)$/i, "") : token)
    .filter((token) => token.length >= 2 && !NEWS_STORY_STOPWORDS.has(token))
    .slice(0, 36))];
}

function newsPublishedTime(item = {}) {
  const value = Number(item.ts || new Date(item.date || item.publishedAt || item.crawledAt || 0).getTime());
  return Number.isFinite(value) ? value : 0;
}

export function sameNewsStory(a = {}, b = {}) {
  const aEntities = newsEntityTags(a);
  const bEntities = newsEntityTags(b);
  if (!aEntities.length || !bEntities.some((entity) => aEntities.includes(entity))) return false;
  const aTime = newsPublishedTime(a);
  const bTime = newsPublishedTime(b);
  if (aTime && bTime && Math.abs(aTime - bTime) > 3 * 864e5) return false;
  const aTokens = newsStoryTokens(a);
  const bTokens = newsStoryTokens(b);
  if (aTokens.length < 4 || bTokens.length < 4) return false;
  const overlap = aTokens.filter((token) => bTokens.includes(token)).length;
  const union = new Set([...aTokens, ...bTokens]).size;
  const jaccard = union ? overlap / union : 0;
  const containment = overlap / Math.max(1, Math.min(aTokens.length, bTokens.length));
  return jaccard >= 0.72 || containment >= 0.77;
}

export function classifyNewsMeceAxis(item = {}) {
  const category = String(item.category || "").toLowerCase();
  const text = normalizedNewsIdentityText([
    item.originalTitle,
    item.title,
    item.titleKo,
    item.summaryOriginal,
    item.summary,
    category,
  ].filter(Boolean).join(" "));
  if (category === "account-demand"
    || /\b(?:capex|shipment|customer|hyperscaler|cloud|server demand|smartphone|pc demand|order|contract win)\b|수요|출하|고객|订单|需求/i.test(text)) {
    return "demand-customers";
  }
  if (/\b(?:spot price|contract price|pricing|asp|gross margin|price hike|price decline|inventory cycle)\b|가격|재고|마진|涨价|降价/i.test(text)) {
    return "price-cycle";
  }
  if (/\b(?:capacity|wafer|fab|production line|supply shortage|allocation|output|utilization)\b|캐파|생산능력|공급부족|产能|扩产|供给/i.test(text)) {
    return "supply-capacity";
  }
  if (/\b(?:ipo|funding|investment|acquisition|merger|stake|valuation|market share|partnership)\b|상장|투자|인수|지분|估值|融资/i.test(text)) {
    return "capital-competition";
  }
  if (/\b(?:export control|sanction|regulation|tariff|subsidy|license|policy|government)\b|규제|정책|수출통제|制裁|监管|补贴/i.test(text)) {
    return "policy-risk";
  }
  if (/\b(?:hiring|layoff|workforce|executive|organization|talent|operations)\b|채용|인력|임원|조직|招聘|裁员/i.test(text)) {
    return "operations-talent";
  }
  return "technology-product";
}

export const PUBLIC_NEWS_CATEGORY_IDS = Object.freeze([
  "hbm",
  "cxl",
  "nand",
  "aidemand",
  "packaging",
  "dram",
  "equipment",
]);

const PUBLIC_NEWS_CATEGORY_HINTS = Object.freeze({
  hbm: "hbm",
  cxl: "cxl",
  nand: "nand",
  china_nand: "nand",
  aidemand: "aidemand",
  "account-demand": "aidemand",
  account_intel: "aidemand",
  silicon_programs: "aidemand",
  oem_odm: "aidemand",
  industry: "aidemand",
  packaging: "packaging",
  dram: "dram",
  equipment: "equipment",
});

const PUBLIC_NEWS_CATEGORY_RULES = Object.freeze({
  hbm: /\b(?:custom\s*hbm|nvhbm|hbm(?:3e|4e?|5)?|high\s+bandwidth\s+memory|vera\s+rubin)\b|고대역폭\s*메모리/i,
  cxl: /\b(?:cxl|cmm[-\s]?(?:ax|d)|structera|processing[-\s]near[-\s]memory|pnm|memory\s+pool(?:ing)?)\b|메모리\s*풀링|근접\s*연산/i,
  nand: /\b(?:ai[-\s]?nand|nand|e-?ssd|enterprise\s+ssd|solidigm|ymtc|xtacking|directflash|qlc|hbf|high\s+bandwidth\s+flash)\b|엔터프라이즈\s*ssd/i,
  aidemand: /\b(?:ai\s+infra(?:structure)?|hyperscaler|ai\s+server|server\s+oem|server\s+odm|accelerator|trainium|inferentia|bedrock|tpu|ironwood|maia|mtia|gpu|nvl\d+|rack[-\s]scale|data\s*cent(?:er|re)|agentic|rag)\b/i,
  packaging: /\b(?:base\s+die|logic\s+base|cowos|3dfabric|advanced\s+packag|hybrid\s+bond|tsv|interposer|glass\s+substrate|cpo|silicon\s+photonic|chiplet|ucie|tc\s+bonder|thermal\s+management|ihbm)\b|베이스\s*다이|하이브리드\s*본딩|첨단\s*패키징/i,
  dram: /\b(?:commodity\s+dram|server\s+dram|dram|ddr[3-6]|lpddr\d*x?|rdimm|mrdimm|cxmt|changxin|spot[-\s]contract)\b|범용\s*dram|서버\ud5a5\s*dram/i,
  equipment: /\b(?:naura|amec|acm\s+research|semiconductor\s+equipment|etch(?:ing)?|deposition|cvd|cmp|cleaning|lithograph|inspection|metrology|photoresist|precursor)\b|장비|소재|식각|증착|세정|계측/i,
});

/**
 * Assigns one decision category to every article. Collection sources may use
 * operational buckets such as `account_intel` or `oem_odm`; those are retained
 * in `sourceCategory` while the reader-facing category remains MECE.
 */
export function classifyPublicNewsCategory(item = {}) {
  const sourceCategory = String(item.sourceCategory || item.category || "").toLowerCase();
  const title = normalizedNewsIdentityText([
    item.originalTitle,
    item.title,
    item.titleKo,
  ].filter(Boolean).join(" "));
  const body = normalizedNewsIdentityText([
    title,
    item.summaryOriginal,
    item.summary,
  ].filter(Boolean).join(" "));
  const scores = Object.fromEntries(PUBLIC_NEWS_CATEGORY_IDS.map((id) => [id, 0]));
  const hinted = PUBLIC_NEWS_CATEGORY_HINTS[sourceCategory];
  if (hinted) scores[hinted] += 3;
  for (const id of PUBLIC_NEWS_CATEGORY_IDS) {
    const rule = PUBLIC_NEWS_CATEGORY_RULES[id];
    if (rule.test(title)) scores[id] += 8;
    if (rule.test(body)) scores[id] += 2;
  }
  const priority = ["cxl", "nand", "equipment", "packaging", "hbm", "dram", "aidemand"];
  return priority.reduce((best, id) => scores[id] > scores[best] ? id : best, hinted || "aidemand");
}

function publisherText(item = {}) {
  const source = String(item.source || "").trim();
  if (source) return source;
  const parts = String(item.title || "").split(/\s[-–—]\s/).map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

function isForeignItem(item) {
  if (!item || !item.title) return false;
  const language = verifiedNewsLanguage(item);
  if (!language) return false;
  // After cleanTitle, a real Korean/CJK headline collapses to a tiny Latin
  // fragment - drop those, and drop Korean-origin outlets. Keeps a clean
  // Latin-script international (foreign-press) feed.
  if (language === "chinese") {
    if (!CJK_RE.test(item.title)) return false;
  } else if (item.title.replace(/[^A-Za-z]/g, "").length < 6) {
    return false;
  }
  const src = `${item.source || ""} ${item.title || ""} ${item.link || ""}`.toLowerCase();
  if (!MEMORY_NEWS_RE.test(`${item.originalTitle || item.title || ""} ${item.source || ""}`)
    && !FACT_EVENT_SEED_IDS.has(item.id)) return false;
  if (NEWS_MARKET_NOISE_RE.test(item.originalTitle || item.title || "")) return false;
  if (KOREAN_SOURCE_RE.test(src)) return false;
  if (SKHYNIX_NEWSROOM_RE.test(src)) return false;
  if (LOW_CONFIDENCE_NEWS_RE.test(`${item.title || ""} ${item.source || ""} ${item.link || ""}`)) return false;
  const authority = `${publisherText(item)} ${item.link || ""}`;
  if (language === "chinese") return AUTHORITATIVE_CN_NEWS_RE.test(authority);
  return AUTHORITATIVE_EN_NEWS_RE.test(authority);
}

const health = [];
function note(step, ok, msg = "") {
  if (/(^|[\s/])0(\uAC74|\uAC1C)(?=$|[\s/])/.test(String(msg || ""))) {
    console.log(`- ${step}${msg ? " — " + msg : ""} → 제외`);
    return;
  }
  health.push({ step, ok, msg });
  console.log(`${ok ? "✓" : "✗"} ${step}${msg ? " — " + msg : ""}`);
}

function noteSkipped(step, msg = "") {
  console.log(`- ${step}${msg ? " — " + msg : ""} → 미관측`);
}

async function fetchText(url) {
  let lastError;
  // Retry only transient server/rate-limit failures once.  This preserves a
  // bounded crawl while reducing false source failures from public feeds.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await fetch(url, {
        signal: fetchSignal(sourceTimeoutClass(url)),
        headers: {
          "User-Agent": BROWSER_UA,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      if (!res.ok) {
        const retryable = res.status === 408 || res.status === 429 || res.status >= 500;
        if (retryable && attempt === 0) {
          const retryAfter = Number(res.headers.get("retry-after"));
          await sleep(Number.isFinite(retryAfter) ? Math.min(retryAfter * 1_000, 3_000) : 550);
          continue;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      // Decode explicitly as UTF-8 from raw bytes. Relying on res.text()'s
      // charset detection mangled typographic punctuation (curly quotes, dashes)
      // in foreign headlines into garbage codepoints, so force UTF-8 here.
      const buf = await res.arrayBuffer();
      return new TextDecoder("utf-8").decode(buf);
    } catch (error) {
      lastError = error;
      const networkFailure = error?.name === "AbortError"
        || error?.name === "TimeoutError"
        || /(?:fetch failed|network|socket|econn|etimedout|enotfound)/i.test(String(error?.message || ""));
      if (attempt === 0 && networkFailure) {
        await sleep(350);
        continue;
      }
    }
  }
  throw lastError || new Error("fetch failed");
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => { try { return String.fromCodePoint(parseInt(hex, 16)); } catch { return ""; } })
    .replace(/&#(\d+);/g, (_, dec) => { try { return String.fromCodePoint(parseInt(dec, 10)); } catch { return ""; } })
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/&#9650;/g, "▲")
    .replace(/&#9660;/g, "▼")
    .replace(/&amp;/g, "&");
}

function stripHTML(html) {
  return decodeEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[\uD800-\uDFFF]/g, "") // strip stray surrogate code units (decode garbage)
    .replace(/�/g, "") // strip replacement chars
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(value) {
  const match = String(value || "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function directionFrom(value) {
  const text = String(value || "");
  if (text.includes("▼") || /^-/.test(text.trim())) return "down";
  if (text.includes("▲") || /^\+/.test(text.trim())) return "up";
  return "flat";
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function headerKey(label) {
  return String(label || "")
    .replace(/[^a-zA-Z0-9가-힣 ]/g, " ")
    .trim()
    .split(/\s+/)
    .map((part, i) => {
      const lower = part.toLowerCase();
      return i === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
}

function getField(row, labels) {
  const keys = labels.map(headerKey);
  const field = row.fields.find((item) => keys.includes(item.key));
  return field ? field.value : "";
}

function priceHistoryKey(section, row) {
  return `${section.id}::${row.item}`.toLowerCase();
}

function absoluteTrendForceUrl(url) {
  if (!url) return "";
  try {
    return new URL(decodeEntities(url), TRENDFORCE_ORIGIN).toString();
  } catch {
    return "";
  }
}

function priceChartUrlWithDays(url, days = PRICE_HISTORY_LOOKBACK_DAYS) {
  const absolute = absoluteTrendForceUrl(url);
  if (!absolute) return "";
  try {
    const parsed = new URL(absolute);
    parsed.searchParams.set("days", String(days));
    return parsed.toString();
  } catch {
    return absolute;
  }
}

function extractHistoryUrl(html) {
  const match = String(html || "").match(/openDxiChart\('([^']+)'\)/i);
  return match ? absoluteTrendForceUrl(match[1]) : "";
}

function parseRemoteChartPoints(text, row = {}) {
  const points = [];
  const seen = new Set();
  const add = (dateText, valueText) => {
    const value = Number(String(valueText || "").replace(/,/g, ""));
    if (!Number.isFinite(value)) return;
    const date = new Date(dateText);
    if (Number.isNaN(date.getTime())) return;
    const key = `${date.toISOString().slice(0, 10)}::${value}`;
    if (seen.has(key)) return;
    seen.add(key);
    points.push({
      source: "TrendForce price chart",
      sourceUpdate: date.toISOString().slice(0, 10),
      date: date.toISOString(),
      average: value,
      averageRaw: value >= 100 ? value.toFixed(2) : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, ""),
      changePct: null,
      changeRaw: "",
      direction: row.direction || "flat",
    });
  };

  // Common chart encodings: ["2026-07-01", 47.067], ["2026/07/01", 47.067]
  for (const match of String(text || "").matchAll(/["'](\d{4}[-/]\d{1,2}[-/]\d{1,2})["']\s*,\s*["']?(-?\d+(?:\.\d+)?)["']?/g)) {
    add(match[1].replace(/\//g, "-"), match[2]);
  }

  // Some chart libraries encode Date.UTC(2026, 6, 1), 47.067
  for (const match of String(text || "").matchAll(/Date\.UTC\(\s*(\d{4})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})\s*\)\s*,\s*["']?(-?\d+(?:\.\d+)?)["']?/g)) {
    const year = Number(match[1]);
    const month = Number(match[2]) + 1;
    const day = Number(match[3]);
    add(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, match[4]);
  }

  return points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function kstPriceDayKey(value = "") {
  const parsed = value ? new Date(value) : null;
  if (!parsed || !Number.isFinite(parsed.getTime())) return "";
  const parts = KST_DAY_FORMATTER.formatToParts(parsed).reduce((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function trendForceObservationIso(value = "") {
  const text = String(value || "").trim();
  if (!text) return null;
  const detailed = text.match(/(20\d{2})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})(?:\s*\(GMT\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?\))?/i);
  if (detailed) {
    const [, year, month, day, hour, minute, sign = "+", offsetHour = "8", offsetMinute = "0"] = detailed;
    const offset = (Number(offsetHour) * 60 + Number(offsetMinute)) * (sign === "-" ? -1 : 1);
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)) - offset * 60000).toISOString();
  }
  const dateOnly = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (dateOnly) {
    return new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 4)).toISOString();
  }
  return null;
}

function priceObservationTime(point = {}) {
  return point.sourceObservedAt
    || point.observedAt
    || trendForceObservationIso(point.sourceUpdate)
    || point.date
    || point.crawledAt
    || point.updatedAt
    || "";
}

export function pricePointCoversMonth(point = {}, targetMonth = "") {
  const time = Date.parse(priceObservationTime(point));
  return Number.isFinite(time)
    && /^20\d{2}-(?:0[1-9]|1[0-2])$/.test(String(targetMonth))
    && new Date(time).toISOString().slice(0, 7) === targetMonth;
}

export function mergePricePoints(existing = [], incoming = []) {
  const byKey = new Map();
  const keyFor = (point) => {
    const rawTime = priceObservationTime(point);
    return kstPriceDayKey(rawTime) || String(point.sourceUpdate || rawTime || "unknown").slice(0, 10);
  };
  const normalize = (point = {}) => {
    const originalDate = point.date || point.crawledAt || null;
    const observedAt = priceObservationTime(point);
    return {
      ...point,
      ...(observedAt ? { date: observedAt, sourceObservedAt: observedAt } : {}),
      capturedAt: point.capturedAt || point.crawledAt || null,
      ...(point.origin === "web.archive.org" ? { snapshotAt: point.snapshotAt || originalDate } : {}),
    };
  };
  const add = (point) => {
    const normalized = normalize(point);
    const key = keyFor(normalized);
    const previous = byKey.get(key);
    const sameObservation = previous
      && Number(previous.average) === Number(normalized.average)
      && String(previous.changeRaw || "") === String(normalized.changeRaw || "")
      && String(previous.sourceUpdate || "") === String(normalized.sourceUpdate || "")
      && String(previous.origin || "") === String(normalized.origin || "")
      && String(previous.archiveUrl || "") === String(normalized.archiveUrl || "");
    if (sameObservation) return;
    const previousCapture = Date.parse(previous?.capturedAt || previous?.crawledAt || 0) || 0;
    const nextCapture = Date.parse(normalized.capturedAt || normalized.crawledAt || 0) || 0;
    if (!previous || nextCapture >= previousCapture) byKey.set(key, normalized);
  };
  existing.forEach(add);
  incoming.forEach(add);
  return Array.from(byKey.values())
    .sort((a, b) => new Date(priceObservationTime(a) || 0).getTime() - new Date(priceObservationTime(b) || 0).getTime())
    .slice(-PRICE_HISTORY_RETENTION_POINTS);
}

async function fetchRemotePriceHistory(row, chartState) {
  if (!row.historyUrl) return { status: "no-url", points: [] };
  if (chartState.blocked) return { status: chartState.status || "login_required", points: [] };
  const url = priceChartUrlWithDays(row.historyUrl, PRICE_HISTORY_LOOKBACK_DAYS);
  if (!url) return { status: "no-url", points: [] };
  try {
    const res = await fetch(url, {
      signal: fetchSignal("price"),
      redirect: "manual",
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml,application/json,*/*;q=0.8",
        Referer: row.sourceUrl || TRENDFORCE_ORIGIN,
      },
    });
    const buf = await res.arrayBuffer();
    const text = new TextDecoder("utf-8").decode(buf);
    if (res.status === 401 || res.status === 403 || /\/login\?redirect=|Gold\+\s*Members|login/i.test(text.slice(0, 6000))) {
      chartState.blocked = true;
      chartState.status = res.status === 401 || res.status === 403 ? `login_required:${res.status}` : "login_required";
      return { status: chartState.status, points: [], url };
    }
    if (!res.ok) return { status: `http:${res.status}`, points: [], url };
    const points = parseRemoteChartPoints(text, row);
    return { status: points.length ? "ok" : "empty", points, url };
  } catch (error) {
    return { status: `error:${error.message}`, points: [], url };
  }
}

/* ---------- prices ---------- */
function parsePriceTables(html, page) {
  const sections = [];
  const sectionRe = /<div class="price-title">([\s\S]*?)<\/div>([\s\S]*?)(?=<div class="price-title">|<div class="related-report|<section class="related|$)/gi;
  let sectionMatch;

  while ((sectionMatch = sectionRe.exec(html)) !== null) {
    const rawTitle = stripHTML(sectionMatch[1]).replace(/\s+/g, " ").trim();
    const title = page.sections.find((allowed) => rawTitle.startsWith(allowed));
    if (!title) continue;

    const block = sectionMatch[2];
    const updateMatch = /Last Update\s*([^<\n]+)/i.exec(block);
    const lastUpdate = updateMatch ? updateMatch[1].trim() : "";
    const tableMatch = /<table[\s\S]*?<\/table>/i.exec(block);
    if (!tableMatch) continue;

    const table = tableMatch[0];
    const headers = [...table.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)]
      .map((match) => stripHTML(match[1]))
      .filter((label) => label && label !== "History");

    const rows = [];
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    while ((rowMatch = rowRe.exec(table)) !== null) {
      const rawCells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
        .map((match) => match[1]);
      const cells = rawCells.map((cell) => stripHTML(cell));
      if (rawCells.length < 3 || !cells[0]) continue;
      const historyUrl = extractHistoryUrl(rowMatch[1]);

      const fields = headers.slice(1).map((label, index) => ({
        key: headerKey(label),
        label,
        value: cells[index + 1] || "",
        number: parseNumber(cells[index + 1]),
      }));
      const changeText =
        getField({ fields }, ["Session Change", "Average Change", "Change"]) ||
        cells.find((cell) => cell.includes("%")) ||
        "";
      const avgText = getField({ fields }, ["Session Average", "Average", "Avg"]);

      rows.push({
        item: cells[0],
        average: parseNumber(avgText),
        averageRaw: avgText,
        changePct: parseNumber(changeText),
        changeRaw: changeText,
        direction: directionFrom(changeText),
        historyUrl,
        historyDays: historyUrl ? parseNumber(new URL(historyUrl).searchParams.get("days")) : null,
        fields,
      });
    }

    sections.push({
      id: `${page.id}-${slug(title)}`,
      group: page.label,
      title,
      lastUpdate,
      sourceUrl: page.url,
      rows: rows.slice(0, 10),
    });
  }

  return sections;
}

async function collectPrices() {
  const sections = [];
  for (const page of PRICE_PAGES) {
    try {
      const html = await fetchText(page.url);
      const parsed = parsePriceTables(html, page);
      sections.push(...parsed);
      note(`가격:${page.label}`, parsed.length > 0, `${parsed.length}개 표`);
    } catch (error) {
      note(`가격:${page.label}`, false, error.message);
    }
    await sleep(350);
  }

  for (const section of sections) {
    for (const row of section.rows) {
      row.historyKey = priceHistoryKey(section, row);
    }
    section.rows = section.rows.filter((row) => !isCrawlerExcluded("price", {
      ...row,
      sectionTitle: section.title,
      group: section.group,
      sourceUrl: section.sourceUrl,
    }));
  }

  const activeSections = sections.filter((section) => section.rows.length > 0);

  const watchedItems = activeSections.flatMap((section) =>
    section.rows.slice(0, 4).map((row) => ({
      historyKey: row.historyKey,
      sectionId: section.id,
      sectionTitle: section.title,
      group: section.group,
      item: row.item,
      average: row.average,
      averageRaw: row.averageRaw,
      changePct: row.changePct,
      changeRaw: row.changeRaw,
      direction: row.direction,
      historyUrl: row.historyUrl,
      historyDays: row.historyDays,
      fields: row.fields,
      lastUpdate: section.lastUpdate,
      sourceUrl: section.sourceUrl,
    })),
  );

  return {
    updatedAt: new Date().toISOString(),
    source: "TrendForce Price Trends / DRAMeXchange public tables",
    sections: activeSections,
    watchedItems,
  };
}

async function loadPriceHistory() {
  try {
    const raw = await readFile(HISTORY_OUT, "utf8");
    const parsed = JSON.parse(raw);
    return {
      schemaVersion: parsed.schemaVersion || "2.0",
      updatedAt: parsed.updatedAt || null,
      runId: parsed.runId || null,
      validatedAt: parsed.validatedAt || null,
      expiresAt: parsed.expiresAt || null,
      timezone: parsed.timezone || "Asia/Seoul",
      items: parsed.items && typeof parsed.items === "object" ? parsed.items : {},
      archiveBackfill: parsed.archiveBackfill && typeof parsed.archiveBackfill === "object" ? parsed.archiveBackfill : null,
    };
  } catch {
    return { schemaVersion: "2.0", updatedAt: null, timezone: "Asia/Seoul", items: {}, archiveBackfill: null };
  }
}

async function updatePriceHistory(prices) {
  const history = await loadPriceHistory();
  let changed = false;
  const crawledAt = new Date().toISOString();
  // Run the migration independently of the live-page result. A temporary
  // TrendForce outage must not leave old crawl-date copies in stored history.
  for (const item of Object.values(history.items || {})) {
    const normalized = mergePricePoints(item.points || [], []);
    if (JSON.stringify(normalized) !== JSON.stringify(item.points || [])) {
      item.points = normalized;
      changed = true;
    }
  }
  const chartState = { blocked: false, status: "not_checked" };
  let chartRows = 0;
  let chartPoints = 0;
  let chartStatus = "not_checked";

  for (const section of prices.sections || []) {
    for (const row of section.rows || []) {
      if (row.average == null && row.changePct == null) continue;
      const key = row.historyKey || priceHistoryKey(section, row);
      const current = history.items[key] || {
        key,
        item: row.item,
        sectionId: section.id,
        sectionTitle: section.title,
        group: section.group,
        sourceUrl: section.sourceUrl,
        points: [],
      };
      current.item = row.item;
      current.sectionId = section.id;
      current.sectionTitle = section.title;
      current.group = section.group;
      current.sourceUrl = section.sourceUrl;
      current.historyUrl = row.historyUrl || current.historyUrl || "";
      current.historyDays = row.historyDays || current.historyDays || null;

      if (row.historyUrl) {
        const remote = await fetchRemotePriceHistory({ ...row, sourceUrl: section.sourceUrl }, chartState);
        chartStatus = remote.status || chartStatus;
        if (remote.points.length) {
          chartRows += 1;
          chartPoints += remote.points.length;
          const merged = mergePricePoints(current.points, remote.points);
          if (JSON.stringify(merged) !== JSON.stringify(current.points)) {
            current.points = merged;
            changed = true;
          }
          current.remoteHistory = {
            status: "ok",
            source: "TrendForce priceChart",
            sourceUrl: remote.url,
            pointCount: remote.points.length,
            lookbackDays: PRICE_HISTORY_LOOKBACK_DAYS,
          };
        } else if (
          !current.remoteHistory ||
          current.remoteHistory.status !== remote.status ||
          current.remoteHistory.lookbackDays !== PRICE_HISTORY_LOOKBACK_DAYS ||
          current.remoteHistory.sourceUrl !== (remote.url || priceChartUrlWithDays(row.historyUrl, PRICE_HISTORY_LOOKBACK_DAYS))
        ) {
          current.remoteHistory = {
            status: remote.status,
            source: "TrendForce priceChart",
            sourceUrl: remote.url || priceChartUrlWithDays(row.historyUrl, PRICE_HISTORY_LOOKBACK_DAYS),
            pointCount: 0,
            lookbackDays: PRICE_HISTORY_LOOKBACK_DAYS,
            fallback: "public-table daily accumulation",
          };
          changed = true;
        }
      }

      const sourceObservedAt = trendForceObservationIso(section.lastUpdate) || crawledAt;
      const point = {
        date: sourceObservedAt,
        sourceObservedAt,
        sourceUpdate: section.lastUpdate || "",
        crawledAt,
        capturedAt: crawledAt,
        average: row.average,
        averageRaw: row.averageRaw || "",
        changePct: row.changePct,
        changeRaw: row.changeRaw || "",
        direction: row.direction || "flat",
      };
      const normalizedPoints = mergePricePoints(current.points, []);
      if (JSON.stringify(normalizedPoints) !== JSON.stringify(current.points)) {
        current.points = normalizedPoints;
        changed = true;
      }
      const last = current.points[current.points.length - 1];
      const isNewPoint =
        !last ||
        kstPriceDayKey(priceObservationTime(last)) !== kstPriceDayKey(sourceObservedAt) ||
        last.sourceUpdate !== point.sourceUpdate ||
        last.average !== point.average ||
        last.changeRaw !== point.changeRaw;

      if (isNewPoint) {
        current.points = mergePricePoints(current.points, [point]);
        changed = true;
      }
      history.items[key] = current;
    }
  }

  if (changed) {
    history.updatedAt = crawledAt;
    note("가격히스토리", true, "신규 포인트 검증 대기");
  } else {
    note("가격히스토리", true, "변경 없음");
  }
  if (chartRows) {
    note("TrendForce차트", true, `${chartRows}개 품목 · ${chartPoints}개 과거 포인트 병합`);
  } else if (chartStatus !== "not_checked") {
    note("TrendForce차트", true, `${chartStatus} · 공개 테이블 일일 누적 사용`);
  }

  return history;
}

function attachPriceHistory(prices, history) {
  const attach = (row) => {
    const series = history.items[row.historyKey];
    row.history = series ? series.points.slice(-PRICE_HISTORY_RETENTION_POINTS) : [];
  };

  for (const section of prices.sections || []) {
    for (const row of section.rows || []) attach(row);
  }
  for (const row of prices.watchedItems || []) attach(row);
}

/* ---------- stocks ---------- */
export function normalizeYahooStockResult(result, {
  symbol = result?.meta?.symbol || "",
  expectedCurrency = null,
  now = new Date(),
  maxAgeDays = STOCK_MAX_AGE_DAYS,
} = {}) {
  if (!result) throw new Error("빈 주가 결과");
  const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];
  const closes = Array.isArray(result.indicators?.quote?.[0]?.close)
    ? result.indicators.quote[0].close
    : [];
  const observations = timestamps.map((timestamp, index) => ({
    timestamp: Number(timestamp),
    close: Number(closes[index]),
  })).filter((item) => (
    Number.isFinite(item.timestamp)
    && item.timestamp > 0
    && Number.isFinite(item.close)
    && item.close > 0
  ));
  const currency = String(result.meta?.currency || "").trim().toUpperCase() || null;
  if (expectedCurrency && currency !== String(expectedCurrency).toUpperCase()) {
    throw new Error(`통화 불일치: ${currency || "미상"} / 예상 ${expectedCurrency}`);
  }

  const nowMs = Number.isFinite(now?.getTime?.()) ? now.getTime() : Date.now();
  const nowSeconds = nowMs / 1000;
  const regularSession = result.meta?.currentTradingPeriod?.regular || {};
  const regularStart = Number(regularSession.start);
  const regularEnd = Number(regularSession.end);
  const marketOpen = Number.isFinite(regularStart)
    && Number.isFinite(regularEnd)
    && nowSeconds >= regularStart
    && nowSeconds < regularEnd;
  // Yahoo includes the current intraday bar in a 1d chart. The dashboard is a
  // close-price monitor, so remove that partial bar until the exchange's
  // regular session has ended.
  if (marketOpen && observations.at(-1)?.timestamp >= regularStart - 60) {
    observations.pop();
  }
  if (observations.length < 2) throw new Error("종가 관측 부족");

  const latest = observations.at(-1);
  const previous = observations.at(-2);
  const latestAtMs = latest.timestamp * 1000;
  const ageDays = (nowMs - latestAtMs) / 864e5;
  if (ageDays < -0.75) throw new Error("미래 시점 주가 관측");
  const fresh = ageDays <= maxAgeDays;
  const changePct = ((latest.close - previous.close) / previous.close) * 100;
  return {
    symbol,
    latestClose: Number(latest.close.toFixed(2)),
    prevClose: Number(previous.close.toFixed(2)),
    changePct: Number(changePct.toFixed(2)),
    points: observations.slice(-22).map((item) => Number(item.close.toFixed(2))),
    currency,
    asOf: new Date(latestAtMs).toISOString(),
    exchangeTimezoneName: result.meta?.exchangeTimezoneName || null,
    priceType: "completed-close",
    sourceStatus: fresh ? "current" : "stale",
    stale: !fresh,
    ageDays: Number(Math.max(0, ageDays).toFixed(2)),
  };
}

export function selectFreshestYahooStockResult(entries = [], options = {}) {
  const candidates = [];
  const errors = [];
  for (const entry of entries) {
    const result = entry?.result || entry;
    try {
      candidates.push({
        ...normalizeYahooStockResult(result, options),
        quoteSource: entry?.url || null,
      });
    } catch (error) {
      errors.push(String(error?.message || error || "invalid quote"));
    }
  }
  if (!candidates.length) {
    throw new Error(errors.filter(Boolean).join(" · ") || "no valid stock result");
  }
  candidates.sort((left, right) => (
    new Date(right.asOf).getTime() - new Date(left.asOf).getTime()
    || right.points.length - left.points.length
  ));
  return {
    ...candidates[0],
    quoteCandidates: candidates.length,
  };
}

async function fetchStock(symbol, options = {}) {
  const requestAt = Date.now();
  const period1 = Math.floor((requestAt - 40 * 864e5) / 1000);
  const period2 = Math.floor((requestAt + 2 * 864e5) / 1000);
  // Explicit periods plus a run-scoped cache key prevent a regional Yahoo CDN
  // from serving yesterday's one-month range after a new market close.
  const path = `/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d&includePrePost=false&events=div%2Csplits&_=${requestAt}`;
  const hosts = ["query2.finance.yahoo.com", "query1.finance.yahoo.com"];
  const settled = await Promise.allSettled(hosts.map(async (host) => {
    const url = `https://${host}${path}`;
    const txt = await fetchText(url);
    const json = JSON.parse(txt);
    const result = json?.chart?.result?.[0];
    if (!result) throw new Error(`${host}: empty result`);
    return { result, url };
  }));
  const entries = [];
  const errors = [];
  for (const outcome of settled) {
    if (outcome.status === "fulfilled") entries.push(outcome.value);
    else errors.push(String(outcome.reason?.message || outcome.reason || "quote request failed"));
  }
  try {
    return selectFreshestYahooStockResult(entries, { ...options, symbol });
  } catch (error) {
    const details = [...errors, String(error?.message || error || "")].filter(Boolean).join(" · ");
    throw new Error(details || "stock lookup failed");
  }
}

async function collectStocks(previousStocks = {}) {
  const stocks = {};
  for (const ticker of TICKERS) {
    try {
      stocks[ticker.id] = {
        ...(await fetchStock(ticker.symbol, { expectedCurrency: ticker.currency })),
        label: ticker.label,
      };
      const current = stocks[ticker.id].sourceStatus === "current";
      note(
        `주가:${ticker.label}`,
        current,
        `${stocks[ticker.id].latestClose} ${stocks[ticker.id].currency} (${stocks[ticker.id].changePct}%) · ${stocks[ticker.id].asOf}${current ? "" : " · 시세 지연"}`,
      );
    } catch (error) {
      const previous = previousStocks?.[ticker.id];
      const canRetain = previous
        && Number(previous.latestClose) > 0
        && String(previous.currency || "").toUpperCase() === ticker.currency;
      stocks[ticker.id] = canRetain ? {
        ...previous,
        label: ticker.label,
        sourceStatus: "previous-run",
        stale: true,
        retainedAt: new Date().toISOString(),
        fetchError: String(error.message || error).slice(0, 240),
      } : null;
      note(
        `주가:${ticker.label}`,
        false,
        canRetain ? `${error.message} · 이전 검증 종가 유지` : error.message,
      );
    }
    await sleep(350);
  }
  return stocks;
}

async function fetchYahooChartResult(symbol, range = "5y", interval = "1d") {
  const path = `/v8/finance/chart/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`;
  const hosts = ["query2.finance.yahoo.com", "query1.finance.yahoo.com"];
  let lastErr;

  for (const host of hosts) {
    try {
      const txt = await fetchText(`https://${host}${path}`);
      const json = JSON.parse(txt);
      const result = json?.chart?.result?.[0];
      if (!result) throw new Error("empty yahoo chart result");
      return result;
    } catch (error) {
      lastErr = error;
    }
    await sleep(350);
  }

  throw lastErr || new Error("yahoo chart fetch failed");
}

export function yahooChartPageUrl(symbol, range = "5y", interval = "1d") {
  const ticker = String(symbol || "").trim();
  if (!ticker) return "";
  const params = new URLSearchParams({ range: String(range), interval: String(interval) });
  return `https://finance.yahoo.com/chart/${encodeURIComponent(ticker)}/?${params.toString()}`;
}

function yahooHistoryPoints(result = {}) {
  const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const adjustedCloses = result.indicators?.adjclose?.[0]?.adjclose || [];
  const points = timestamps
    .map((ts, index) => {
      const rawClose = Number(closes[index]);
      const adjustedClose = Number(adjustedCloses[index]);
      const close = Number.isFinite(adjustedClose) && adjustedClose > 0 ? adjustedClose : rawClose;
      if (!Number.isFinite(close) || close <= 0) return null;
      const time = Number(ts) * 1000;
      return {
        date: new Date(time).toISOString(),
        time,
        close: Number(close.toFixed(2)),
        value: Number(close.toFixed(2)),
        rawClose: Number.isFinite(rawClose) && rawClose > 0 ? Number(rawClose.toFixed(2)) : null,
        adjusted: Number.isFinite(adjustedClose) && adjustedClose > 0,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.time - b.time);
  return points;
}

function marketCurrency(index = {}, result = {}) {
  const symbol = String(index.symbol || "").toUpperCase();
  if (/\.(?:SS|SZ)$/.test(symbol)) return "CNY";
  if (/\.KS$/.test(symbol)) return "KRW";
  if (/\.T$/.test(symbol)) return "JPY";
  const reported = String(result.meta?.currency || "").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(reported)) return reported;
  return "USD";
}

export function mergeMarketPoints(existing = [], incoming = []) {
  const byDay = new Map();
  const add = (point = {}) => {
    const time = Number(point.time || new Date(point.date || 0).getTime());
    const close = Number(point.close ?? point.value);
    if (!Number.isFinite(time) || !Number.isFinite(close) || close <= 0) return;
    const day = new Date(time).toISOString().slice(0, 10);
    byDay.set(day, {
      date: new Date(time).toISOString(),
      time,
      close: Number(close.toFixed(2)),
      value: Number(close.toFixed(2)),
      rawClose: point.rawClose != null && Number.isFinite(Number(point.rawClose)) && Number(point.rawClose) > 0
        ? Number(Number(point.rawClose).toFixed(2))
        : null,
      adjusted: Boolean(point.adjusted),
    });
  };
  existing.forEach(add);
  incoming.forEach(add);
  return Array.from(byDay.values())
    .sort((a, b) => a.time - b.time)
    .slice(-MARKET_HISTORY_RETENTION_POINTS);
}

async function fetchNasdaqSoxLatest() {
  const sourceUrl = "https://indexes.nasdaq.com/Index/Overview/SOX";
  const html = await fetchText(sourceUrl);
  const dateRaw = html.match(/DATA\s+AS\s+OF\s+(\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1] || "";
  const valueRaw = html.match(/data-current-value=["']([\d,.]+)["']/i)?.[1] || "";
  const close = Number(valueRaw.replace(/,/g, ""));
  const parts = dateRaw.split("/").map(Number);
  if (parts.length !== 3 || !parts.every(Number.isFinite) || !Number.isFinite(close) || close <= 0) {
    throw new Error("Nasdaq SOX official latest parse failed");
  }
  const [month, day, year] = parts;
  const time = Date.UTC(year, month - 1, day, 20, 0, 0);
  return {
    point: {
      date: new Date(time).toISOString(),
      time,
      close: Number(close.toFixed(2)),
      value: Number(close.toFixed(2)),
    },
    source: "Nasdaq Global Indexes",
    sourceUrl,
    asOf: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

async function loadMarketHistory() {
  try {
    const raw = await readFile(MARKET_HISTORY_OUT, "utf8");
    const parsed = JSON.parse(raw);
    return {
      schemaVersion: parsed.schemaVersion || "2.0",
      updatedAt: parsed.updatedAt || null,
      metricsUpdatedAt: parsed.metricsUpdatedAt || null,
      runId: parsed.runId || null,
      validatedAt: parsed.validatedAt || null,
      timezone: parsed.timezone || "Asia/Seoul",
      source: parsed.source || "Yahoo Finance chart API",
      indexes: parsed.indexes && typeof parsed.indexes === "object" ? parsed.indexes : {},
      metrics: parsed.metrics && typeof parsed.metrics === "object" ? parsed.metrics : {},
      metricDefinitions: parsed.metricDefinitions && typeof parsed.metricDefinitions === "object"
        ? parsed.metricDefinitions
        : {},
    };
  } catch {
    return {
      updatedAt: null,
      schemaVersion: "2.0",
      metricsUpdatedAt: null,
      timezone: "Asia/Seoul",
      source: "Yahoo Finance chart API",
      indexes: {},
      metrics: {},
      metricDefinitions: {},
    };
  }
}

async function updateMarketHistory() {
  const history = await loadMarketHistory();
  let changed = false;
  const crawledAt = new Date().toISOString();

  for (const index of MARKET_INDEXES) {
    try {
      const result = await fetchYahooChartResult(index.symbol, "5y", "1d");
      let incoming = yahooHistoryPoints(result);
      let latestSource = "Yahoo Finance chart API";
      let latestSourceUrl = index.sourceUrl;
      if (index.id === "sox") {
        try {
          const official = await fetchNasdaqSoxLatest();
          incoming = mergeMarketPoints(incoming, [official.point]);
          latestSource = official.source;
          latestSourceUrl = official.sourceUrl;
          note("market:SOX official", true, `${official.asOf} · ${official.point.close}`);
        } catch (error) {
          note("market:SOX official", false, error.message);
        }
      }
      const previous = history.indexes[index.id]?.points || [];
      const merged = mergeMarketPoints(previous, incoming);
      const latest = merged[merged.length - 1] || null;
      const previousPoint = merged.length > 1 ? merged[merged.length - 2] : null;
      const first = merged[0] || null;
      const dailyChangePct = latest && previousPoint?.close
        ? ((latest.close - previousPoint.close) / previousPoint.close) * 100
        : null;
      const cumulativeChangePct = latest && first?.close
        ? ((latest.close - first.close) / first.close) * 100
        : null;
      const next = {
        ...index,
        updatedAt: crawledAt,
        range: "5y",
        interval: "1d",
        chartUrl: yahooChartPageUrl(index.symbol, "5y", "1d"),
        currency: marketCurrency(index, result),
        exchangeName: result.meta?.exchangeName || null,
        latestSource,
        latestSourceUrl,
        regularMarketTime: result.meta?.regularMarketTime ? new Date(result.meta.regularMarketTime * 1000).toISOString() : null,
        latest,
        dailyChangePct: dailyChangePct == null ? null : Number(dailyChangePct.toFixed(2)),
        cumulativeChangePct: cumulativeChangePct == null ? null : Number(cumulativeChangePct.toFixed(2)),
        periods: calculateAllHorizonStats(merged, {
          cadence: "daily",
          seriesKind: "price",
          asOf: crawledAt,
          source: index.source || history.source || "Yahoo Finance chart API",
          sourceUrl: index.sourceUrl,
        }),
        pointCount: merged.length,
        points: merged,
      };
      if (JSON.stringify(history.indexes[index.id]) !== JSON.stringify(next)) changed = true;
      history.indexes[index.id] = next;
      note(`market:${index.symbol}`, true, `${merged.length} points`);
    } catch (error) {
      const current = history.indexes[index.id] || { ...index, points: [] };
      history.indexes[index.id] = {
        ...current,
        ...index,
        lastError: error.message,
        lastErrorAt: crawledAt,
      };
      note(`market:${index.symbol}`, false, error.message);
    }
    await sleep(350);
  }

  if (changed) history.updatedAt = crawledAt;

  return history;
}

export function summarizeMarketHistory(history = {}) {
  const indexes = {};
  for (const [id, index] of Object.entries(history.indexes || {})) {
    const { points, ...summary } = index || {};
    indexes[id] = summary;
  }
  return {
    runId: history.runId || null,
    validatedAt: history.validatedAt || null,
    expiresAt: history.expiresAt || null,
    updatedAt: history.updatedAt || null,
    metricsUpdatedAt: history.metricsUpdatedAt || null,
    timezone: history.timezone || "Asia/Seoul",
    source: history.source || "Yahoo Finance chart API",
    indexes,
    metrics: Object.fromEntries(Object.entries(history.metrics || {}).map(([id, metric]) => {
      const points = Array.isArray(metric?.points) ? metric.points : [];
      return [id, {
        ...(metric || {}),
        points: undefined,
        pointCount: points.length,
        first: points[0] || null,
        latest: points[points.length - 1] || null,
      }];
    })),
    metricDefinitions: history.metricDefinitions || {},
  };
}

/* ---------- news ---------- */
function parseRSS(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = re.exec(xml)) !== null) {
    const block = match[1];
    const pick = (tag) => {
      const tagMatch = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`).exec(block);
      return tagMatch ? tagMatch[1] : "";
    };
    const title = stripHTML(pick("title"));
    if (!title) continue;
    items.push({
      title,
      link: stripHTML(pick("link")),
      pubDate: pick("pubDate").trim(),
      source: stripHTML(pick("source")),
      rssDescription: stripHTML(pick("description")),
    });
  }
  return items;
}

function ymd(dateStr) {
  const date = new Date(dateStr);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

let googleNewsFailureStreak = 0;
// Google answers a throttled run with 200 OK and an empty channel, which is
// indistinguishable from an unproductive query at the call site. In a long run
// that silently cost most of the collection: 75 of the categories returned
// nothing while the same queries returned a full page on their own. So a run of
// consecutive empty replies is read as pacing, not as absence, and the query is
// retried once after a pause before its emptiness is believed.
let googleNewsEmptyStreak = 0;
const NEWS_EMPTY_STREAK_LIMIT = 5;
const NEWS_THROTTLE_BACKOFF_MS = 20000;
// A degraded primary pass is retried once by the workflow. The recovery pass
// deliberately starts on Bing RSS instead of repeating the same Google News
// failure mode, while keeping the identical evidence and publication gates.
let googleNewsCircuitOpen = CRAWL_RECOVERY_MODE;

async function fetchBingNews(query, category = "", locale = "en") {
  const isChinese = locale === "zh";
  const edition = isChinese
    ? { setlang: "zh-Hans", mkt: "zh-CN" }
    : { setlang: "en-US", mkt: "en-US" };
  const url = `https://www.bing.com/search?format=rss&setlang=${edition.setlang}&mkt=${edition.mkt}&count=20&q=${encodeURIComponent(query)}`;
  const xml = await fetchText(url);
  return parseRSS(xml)
    .map((item) => {
      const link = sanitizeSourceUrl(item.link || "");
      let source = "Bing RSS";
      try {
        source = new URL(link).hostname.replace(/^www\./, "");
      } catch {
        // Keep the provider label when a result has no usable direct URL.
      }
      return {
        title: cleanLocalizedTitle(item.title, locale),
        originalTitle: cleanLocalizedTitle(item.title, locale),
        link,
        sourceUrl: link,
        source,
        date: ymd(item.pubDate),
        ts: new Date(item.pubDate).getTime() || 0,
        category,
        language: isChinese ? "chinese" : "english",
        streamLanguage: isChinese ? "chinese" : "english",
        languageVerified: true,
        discoveryProvider: "bing-rss",
      };
    })
    .filter(isForeignItem);
}

async function fetchGoogleNews(query, category = "", locale = "en") {
  const isChinese = locale === "zh";
  const edition = isChinese
    ? { hl: "zh-CN", gl: "CN", ceid: "CN:zh-Hans" }
    : { hl: "en-US", gl: "US", ceid: "US:en" };
  if (googleNewsCircuitOpen) return fetchBingNews(query, category, locale);
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query + " when:30d")}&hl=${edition.hl}&gl=${edition.gl}&ceid=${edition.ceid}`;
  let xml = "";
  try {
    xml = await fetchText(url);
    googleNewsFailureStreak = 0;
  } catch (error) {
    googleNewsFailureStreak += 1;
    if (googleNewsFailureStreak >= NEWS_PROVIDER_FAILURE_LIMIT) {
      googleNewsCircuitOpen = true;
      console.warn(`Google News RSS 연속 실패 ${googleNewsFailureStreak}회: 남은 검색을 Bing RSS로 전환`);
    }
    try {
      return await fetchBingNews(query, category, locale);
    } catch (fallbackError) {
      throw new Error(`Google News ${error.message}; Bing RSS ${fallbackError.message}`);
    }
  }
  const parse = (source) => parseRSS(source)
    .map((item) => ({
      title: cleanLocalizedTitle(item.title, locale),
      originalTitle: cleanLocalizedTitle(item.title, locale),
      link: item.link,
      source: cleanLocalizedTitle(item.source, locale),
      date: ymd(item.pubDate),
      ts: new Date(item.pubDate).getTime() || 0,
      category,
      language: isChinese ? "chinese" : "english",
      streamLanguage: isChinese ? "chinese" : "english",
      languageVerified: true,
    }))
    .filter(isForeignItem);

  let items = parse(xml);
  if (items.length) {
    googleNewsEmptyStreak = 0;
    return items;
  }
  googleNewsEmptyStreak += 1;
  if (googleNewsEmptyStreak === NEWS_EMPTY_STREAK_LIMIT) {
    console.warn(`Google News RSS 연속 빈 응답 ${googleNewsEmptyStreak}회: ${NEWS_THROTTLE_BACKOFF_MS / 1000}초 대기 후 재시도`);
  }
  if (googleNewsEmptyStreak >= NEWS_EMPTY_STREAK_LIMIT) {
    await sleep(NEWS_THROTTLE_BACKOFF_MS);
    try {
      items = parse(await fetchText(url));
    } catch {
      items = [];
    }
    googleNewsEmptyStreak = 0;
    if (items.length) return items;

    // A second empty response after the shared pause means the provider is
    // throttling this runner. Stop multiplying 20/40/60... second sleeps over
    // hundreds of queries: fail over once and keep the verified refresh inside
    // the workflow deadline. Future runs probe Google again from a clean process.
    googleNewsCircuitOpen = true;
    console.warn("Google News RSS 재시도도 빈 응답: 남은 검색을 Bing RSS로 전환");
    try {
      return await fetchBingNews(query, category, locale);
    } catch {
      return [];
    }
  }
  return items;
}

function normalizePreservedNewsSeed(seed = {}) {
  const language = seed.language === "chinese" ? "chinese" : "english";
  const title = cleanLocalizedTitle(seed.title, language === "chinese" ? "zh" : "en");
  const sourceUrl = sanitizeSourceUrl(seed.link || seed.sourceUrl || "");
  return {
    ...seed,
    title,
    originalTitle: title,
    sourceUrl,
    link: sourceUrl,
    ts: new Date(`${seed.date || "1970-01-01"}T00:00:00Z`).getTime() || 0,
    language,
    streamLanguage: language,
    languageVerified: true,
    summarySource: "curated-source",
    preservedSeed: true,
    curated: true,
  };
}

function htmlAttributes(tag = "") {
  const attrs = {};
  for (const match of String(tag).matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    attrs[String(match[1] || "").toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attrs;
}

function isCompleteArticleSummary(value = "") {
  const clean = stripHTML(value).replace(/\s+/g, " ").trim();
  if (!clean) return false;
  if (/(?:网站.{0,80}(?:资讯平台|专业提供)|由人民日报社主管主办|全天候\s*7\s*\*\s*24\s*小时财经|trendforce news operates independently|curating key semiconductor and tech updates|dive into our proprietary testing data|compare hardware with detailed benchmarks|all rights reserved|copyright)/iu.test(clean)) return false;
  if (/(?:\(AI generated\)|[（(]AI生成[）)])/iu.test(clean)) return false;
  if (/(?:\.{3,}|…|[-–—])\s*$/u.test(clean)) return false;
  if (/\b(?:a|an|the|to|of|for|with|and|or|by|from|at|in|on)$/i.test(clean) && clean.length >= 120) return false;
  if (scriptCount(clean, HAN_RE) > 0 && clean.length >= 80 && !/[。！？.!?][”’"']?$/u.test(clean)) return false;
  if (clean.length >= 615 && !/[.!?。！？][”’"']?$/u.test(clean)) return false;
  return true;
}

function articleMetaDescription(html = "", title = "") {
  const candidates = [];
  for (const match of String(html).matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = htmlAttributes(match[0]);
    const key = String(attrs.name || attrs.property || "").toLowerCase();
    if (["description", "og:description", "twitter:description"].includes(key) && attrs.content) {
      candidates.push(attrs.content);
    }
  }
  const normalizedTitle = stripHTML(title).toLowerCase().replace(/\s+/g, " ").trim();
  return candidates
    .map((value) => stripHTML(value).replace(/\s+/g, " ").trim())
    .find((value) => {
      const lower = value.toLowerCase();
      if (value.length < 45 || lower === normalizedTitle) return false;
      if (/^(subscribe|sign in|log in|access denied|enable javascript|latest news|breaking news)/i.test(value)) return false;
      return isCompleteArticleSummary(value);
    }) || "";
}

function articleLeadParagraph(html = "", title = "") {
  const normalizedTitle = stripHTML(title).toLowerCase().replace(/\s+/g, " ").trim();
  for (const match of String(html).matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const value = stripHTML(match[1]).replace(/\s+/g, " ").trim();
    const lower = value.toLowerCase();
    if (value.length < 80 || lower === normalizedTitle) continue;
    if (/^(subscribe|sign in|log in|access denied|enable javascript|latest news|breaking news|cookie|privacy)/i.test(value)) continue;
    if (isCompleteArticleSummary(value)) return value;
  }
  return "";
}

function sanitizeSourceUrl(value = "") {
  try {
    const parsed = new URL(value);
    if (!/^https?:$/i.test(parsed.protocol)) return "";
    parsed.hash = "";
    const xenForoThreadQuery = /(?:^|\.)servethehome\.com$/i.test(parsed.hostname) && /^\?threads\//i.test(parsed.search);
    const allow = new Set(["id", "article", "story", "p", "page"]);
    if (!xenForoThreadQuery) {
      for (const [key, paramValue] of Array.from(parsed.searchParams.entries())) {
        if (!allow.has(key.toLowerCase()) || paramValue.length > 80 || /(?:电话|微信|上门|模特|兼职|escort|telegram|whatsapp)/i.test(paramValue)) {
          parsed.searchParams.delete(key);
        }
      }
    }
    return parsed.toString();
  } catch {
    return "";
  }
}

function articleCanonicalUrl(html = "", fallback = "") {
  for (const match of String(html).matchAll(/<link\b[^>]*>/gi)) {
    const attrs = htmlAttributes(match[0]);
    if (String(attrs.rel || "").toLowerCase() === "canonical" && /^https?:\/\//i.test(attrs.href || "")) {
      return sanitizeSourceUrl(attrs.href);
    }
  }
  return sanitizeSourceUrl(fallback);
}

async function resolveGoogleNewsUrl(link = "") {
  if (!/news\.google\.com\/(?:rss\/)?articles\//i.test(link)) return link;
  const articleId = new URL(link).pathname.split("/").filter(Boolean).at(-1) || "";
  if (!articleId) return "";
  const landingUrl = new URL(link);
  landingUrl.searchParams.set("hl", "en-US");
  landingUrl.searchParams.set("gl", "US");
  landingUrl.searchParams.set("ceid", "US:en");
  const landing = await fetchText(landingUrl.toString());
  const timestamp = landing.match(/data-n-a-ts=["']([^"']+)["']/i)?.[1] || "";
  const signature = landing.match(/data-n-a-sg=["']([^"']+)["']/i)?.[1] || "";
  if (!timestamp || !signature) return "";

  const request = JSON.stringify([
    "garturlreq",
    [["X", "X", ["X", "X"], null, null, 1, 1, "US:en", null, 1, null, null, null, null, null, 0, 1], "X", "X", 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0],
    articleId,
    Number(timestamp),
    signature,
  ]);
  const body = new URLSearchParams({ "f.req": JSON.stringify([[["Fbv4je", request]]]) }).toString();
  const response = await fetch("https://news.google.com/_/DotsSplashUi/data/batchexecute", {
    signal: fetchSignal("news"),
    method: "POST",
    headers: {
      "User-Agent": BROWSER_UA,
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body,
  });
  if (!response.ok) throw new Error(`Google News decode HTTP ${response.status}`);
  const text = await response.text();
  const payload = JSON.parse(text.replace(/^\)\]\}'\s*/, ""));
  const decoded = JSON.parse(payload?.[0]?.[2] || "[]")?.[1] || "";
  return /^https?:\/\//i.test(decoded) ? decoded : "";
}

async function enrichNewsItem(item = {}, cached = null) {
  const preservedSummary = String(item.summaryOriginal || "").trim();
  const preservedSourceUrl = sanitizeSourceUrl(item.sourceUrl || item.link || "");
  if (item.preservedSeed && isCompleteArticleSummary(preservedSummary) && preservedSourceUrl) {
    return {
      ...item,
      sourceUrl: preservedSourceUrl,
      link: preservedSourceUrl,
      summarySource: "curated-source",
    };
  }
  const cachedSourceUrl = sanitizeSourceUrl(cached?.sourceUrl || "");
  let resolvedUrl = cachedSourceUrl;
  try {
    resolvedUrl ||= await resolveGoogleNewsUrl(item.link || "");
    if (!resolvedUrl) return { ...item, summarySource: "headline" };
    const html = await fetchText(resolvedUrl);
    const summaryOriginal = (articleMetaDescription(html, item.title) || articleLeadParagraph(html, item.title)).slice(0, 620);
    return {
      ...item,
      sourceUrl: articleCanonicalUrl(html, resolvedUrl) || resolvedUrl,
      summaryOriginal,
      summarySource: summaryOriginal ? "source-meta" : "headline",
    };
  } catch {
    return {
      ...item,
      ...(resolvedUrl ? { sourceUrl: sanitizeSourceUrl(resolvedUrl) } : {}),
      summarySource: "headline",
    };
  }
}

async function collectDirectAccountSources() {
  const output = [];
  for (const source of DIRECT_ACCOUNT_SOURCES) {
    const item = {
      ...source,
      originalTitle: source.title,
      sourceUrl: source.link,
      ts: new Date(`${source.date}T00:00:00Z`).getTime(),
      language: "english",
      streamLanguage: "english",
      languageVerified: true,
      discoveryProvider: "direct-source-monitor",
    };
    const enriched = await enrichNewsItem(item);
    if (enriched.summarySource === "source-meta" && isCompleteArticleSummary(enriched.summaryOriginal)) {
      output.push(enriched);
      continue;
    }
    note(`직접소스:${source.source}`, false, "본문 요약 검증 실패 · 증거 승격 제외");
  }
  return output;
}

async function enrichNewsItems(items = [], previousItems = [], { emitHealth = true } = {}) {
  const previousByKey = new Map(previousItems.map((item) => [canonicalNewsKey(item), item]));
  const output = items.slice();
  let cursor = 0;
  const worker = async () => {
    while (cursor < output.length) {
      const index = cursor;
      cursor += 1;
      const item = output[index];
      output[index] = await enrichNewsItem(item, previousByKey.get(canonicalNewsKey(item)) || null);
      await sleep(120);
    }
  };
  await Promise.all(Array.from({ length: Math.min(NEWS_ENRICH_CONCURRENCY, output.length) }, worker));
  const sourceCount = output.filter((item) => item.summaryOriginal && item.sourceUrl).length;
  if (emitHealth) {
    note("뉴스원문요약", sourceCount > 0, `${sourceCount}/${output.length}건 원문 메타 확보`);
  }
  return output;
}

/* ---------- best-effort EN->KO headline translation (no API key) ---------- */
let _trCount = 0;
const TR_CAP = 800;
let koTranslator = null;
let koTranslationRunStats = null;

function koTranslationDeadline() {
  return KO_TRANSLATION_BUDGET_MS > 0 ? Date.now() + KO_TRANSLATION_BUDGET_MS : 0;
}

function koTranslationBudgetExpired(deadline = 0) {
  return Number.isFinite(deadline) && deadline > 0 && Date.now() >= deadline;
}

function translationQuality(original = "", translated = "") {
  const language = koreanTranslationQualityGate(original, translated);
  const fidelity = auditTranslationFidelity(original, translated);
  const chineseUnitNormalization = scriptCount(original, HAN_RE) > 0
    && fidelity.reasons?.length > 0
    && fidelity.reasons.every((reason) => String(reason).startsWith("number-mismatch:"));
  const fidelityAccepted = fidelity.status === "verified" || chineseUnitNormalization;
  return {
    status: language.status === "verified" && fidelityAccepted ? "verified" : "unverified",
    reasons: [
      ...language.reasons,
      ...(fidelityAccepted ? [] : (fidelity.reasons || [])),
    ],
    language,
    fidelity,
    chineseUnitNormalization,
  };
}

function recordTranslationAudit(item, field, original, translated) {
  const audit = translationQuality(original, translated);
  item.translation = {
    ...(item.translation || {}),
    [field]: {
      ...audit.fidelity,
      fidelityStatus: audit.fidelity.status,
      fidelityReasons: audit.fidelity.reasons || [],
      chineseUnitNormalization: audit.chineseUnitNormalization,
      languageStatus: audit.language.status,
      languageReasons: audit.language.reasons,
      hangulCount: audit.language.hangulCount,
      hanCount: audit.language.hanCount,
      hangulRatio: audit.language.hangulRatio,
      residualEnglishProseWords: audit.language.residualEnglishProseWords,
      status: audit.status,
      checkedAt: new Date().toISOString(),
      cacheState: audit.status === "verified" ? "verified" : "not-written",
      retry: audit.status === "verified" ? null : "next-run",
      display: audit.status === "verified"
        ? "translated"
        : (verifiedNewsLanguage(item) === "chinese" ? "translation-pending" : "source-original"),
    },
  };
  return audit.status === "verified";
}

function hasReusableTranslation(original = "", translated = "") {
  return Boolean(translated && translationQuality(original, translated).status === "verified");
}

async function addKoField(arr, limit, deadline, field) {
  const items = (arr || []).slice(0, limit || (arr || []).length);
  const tasks = [];
  for (const item of items) {
    if (_trCount >= TR_CAP || koTranslationBudgetExpired(deadline)) break;
    if (!item) continue;
    const original = field === "title" ? String(item.title || "") : String(item.summaryOriginal || "");
    const current = field === "title" ? String(item.titleKo || "") : String(item.summary || "");
    if (!original || hasReusableTranslation(original, current)) continue;
    tasks.push({ item, original });
    _trCount += 1;
  }
  if (!tasks.length || !koTranslator) return;

  // A failed public-endpoint attempt is deliberately not cached. Prioritise
  // those self-healing retries ahead of never-attempted background rows on the
  // next run, while preserving recency within each group.
  tasks.sort((left, right) => Number(right.item?.translation?.[field]?.status === "unverified")
    - Number(left.item?.translation?.[field]?.status === "unverified"));

  const translated = await koTranslator.translateTexts(tasks.map((task) => task.original), { deadline });
  for (const task of tasks) {
    const cleanKo = cleanKoNewsText(translated.get(task.original) || "");
    const verified = recordTranslationAudit(task.item, field, task.original, cleanKo);
    if (field === "title") {
      if (verified) task.item.titleKo = cleanKo;
      else delete task.item.titleKo;
    } else {
      if (verified) task.item.summary = cleanKo;
      else if (verifiedNewsLanguage(task.item) === "chinese") delete task.item.summary;
      else task.item.summary = task.original;
    }
  }
}

async function addKoTitles(arr, limit, deadline = 0) {
  return addKoField(arr, limit, deadline, "title");
}

async function addKoSummaries(arr, limit, deadline = 0) {
  return addKoField(arr, limit, deadline, "summary");
}

async function fetchCategory(cat, seen, locale = "en") {
  const items = [];
  for (const query of cat.queries) {
    try {
      const queryItems = (await fetchGoogleNews(query, cat.id, locale)).map((item) => ({
        ...item,
        discoveryQuery: query,
        automationAccountIds: cat.queryOwners?.[query] || [],
      }));
      for (const item of queryItems) {
        const key = canonicalNewsKey(item);
        if (seen.has(key)) continue;
        seen.add(key);
        items.push(item);
      }
    } catch (error) {
      note(`뉴스:${cat.label}/${query}`, false, error.message);
    }
    await sleep(350);
  }
  items.sort((a, b) => b.ts - a.ts);
  if (items.length > 0) {
    note(`뉴스:${cat.label}`, true, `${items.length}건`);
  } else {
    console.log(`- 뉴스:${cat.label} 결과 없음 → 카테고리 제외`);
  }
  return items;
}

function newsStats(items) {
  const now = Date.now();
  const within = (ms) => items.filter((item) => item.ts && now - item.ts <= ms).length;
  return {
    total: items.length,
    total24h: within(24 * 3600e3),
    "7d": within(7 * 24 * 3600e3),
    "30d": within(30 * 24 * 3600e3),
    languages: {
      english: items.filter((item) => verifiedNewsLanguage(item) === "english").length,
      chinese: items.filter((item) => verifiedNewsLanguage(item) === "chinese").length,
    },
  };
}

function mergeNewsCategory(categories, cat, items, sampleLimit = 12) {
  if (!items.length) return;
  const sample = items.slice(0, sampleLimit).map(({ ts, category, ...rest }) => rest);
  const existing = categories.find((entry) => entry.id === cat.id);
  if (existing) {
    existing.count += items.length;
    existing.items = existing.items.concat(sample).slice(0, 16);
    return;
  }
  categories.push({ id: cat.id, label: cat.label, count: items.length, items: sample });
}

export function dedupeEnrichedNews(items = [], { preferPreservedSeed = false } = {}) {
  items = items.map(normalizeNewsPublisherSuffix);
  const selected = [];
  const byUrl = new Map();
  const byTitle = new Map();
  const observationRank = (item = {}) => {
    if (item.preservedSeed) return preferPreservedSeed ? 3 : 0;
    return item.continuityFallback ? 1 : 2;
  };
  const mergeObservation = (primary = {}, secondary = {}) => ({
    ...secondary,
    ...primary,
    sourceUrl: primary.sourceUrl || secondary.sourceUrl,
    link: primary.link || secondary.link,
    title: primary.title || secondary.title,
    titleKo: primary.titleKo || secondary.titleKo,
    summaryOriginal: primary.summaryOriginal || secondary.summaryOriginal,
    summary: primary.summary || secondary.summary,
    translation: primary.translation || secondary.translation,
  });
  for (const item of items) {
    const directUrl = sanitizeSourceUrl(item.sourceUrl || "");
    const urlKey = directUrl
      ? `url:${directUrl.toLowerCase().replace(/\/$/, "")}`
      : "";
    const titleKey = canonicalNewsKey(item);
    if (!urlKey && !titleKey) continue;
    const exactIndex = (urlKey ? byUrl.get(urlKey) : undefined)
      ?? (titleKey ? byTitle.get(titleKey) : undefined);
    const storyIndex = exactIndex === undefined
      ? selected.findIndex((existing) => sameNewsStory(existing, item))
      : -1;
    const index = exactIndex ?? (storyIndex >= 0 ? storyIndex : undefined);
    if (index === undefined) {
      const nextIndex = selected.length;
      selected.push(item);
      if (urlKey) byUrl.set(urlKey, nextIndex);
      if (titleKey) byTitle.set(titleKey, nextIndex);
      continue;
    }
    const existing = selected[index];
    // A source fetched/discovered in the current run must win over both a
    // previous-run continuity copy and a curated reference seed. URL and title
    // are independent identity gates so syndication URLs cannot duplicate one
    // article in the public dataset.
    if (!existing || observationRank(item) > observationRank(existing)) {
      selected[index] = mergeObservation(item, existing);
    } else {
      selected[index] = mergeObservation(existing, item);
    }
    if (urlKey) byUrl.set(urlKey, index);
    if (titleKey) byTitle.set(titleKey, index);
  }
  return selected;
}

function normalizePreviousNewsFallback(item = {}) {
  const language = verifiedNewsLanguage(item);
  const sourceUrl = sanitizeSourceUrl(directNewsUrl(item) || item.sourceUrl || item.link || "");
  if (!language || !sourceUrl || /news\.google\.com/i.test(sourceUrl)) return null;
  const ts = new Date(item.date || item.publishedAt || item.crawledAt || 0).getTime() || 0;
  return {
    ...item,
    sourceUrl,
    link: sourceUrl,
    ts,
    language,
    streamLanguage: language,
    languageVerified: true,
    continuityFallback: true,
  };
}

function extractTrending(allNews) {
  const counts = new Map();
  for (const item of allNews) {
    const tokens = item.title
      .replace(/[^\uAC00-\uD7A3a-zA-Z0-9 ]/g, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => {
        if (!token) return false;
        const lower = token.toLowerCase();
        if (STOPWORDS.has(lower)) return false;
        const isHangul = /[\uAC00-\uD7A3]/.test(token);
        return isHangul ? token.length >= 2 : token.length >= 3;
      });
    const uniq = new Set(tokens.map((token) => token.toLowerCase()));
    for (const key of uniq) {
      const display = tokens.find((token) => token.toLowerCase() === key) || key;
      const cur = counts.get(key) || { term: display, count: 0 };
      cur.count += 1;
      counts.set(key, cur);
    }
  }
  return [...counts.values()]
    .filter((item) => item.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 16);
}

/**
 * Keeps the live stream bounded while reserving one current article for each
 * OEM / ODM account that actually appeared in the run.  The former category-
 * wide guarantee could push hundreds of query results through translation and
 * still fail to cover the individual companies.
 */
export function selectNewsStreamItems(items = [], limit = NEWS_STREAM_LIMIT) {
  const ordered = [...items].sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0));
  const selected = [];
  const selectedKeys = new Set();
  const add = (item) => {
    if (!item || selected.length >= limit) return false;
    const key = canonicalNewsKey(item) || sanitizeSourceUrl(item.sourceUrl || item.link || "");
    if (!key || selectedKeys.has(key)) return false;
    selectedKeys.add(key);
    selected.push(item);
    return true;
  };

  for (const account of OEM_ODM_AUTOMATION) {
    add(ordered.find((item) => matchingOemOdmAccountIds(item).includes(account.id)));
  }
  // Accelerator programmes and the OEM/ODM tiers get a guaranteed slot for the
  // same reason account coverage does: they lose the recency race against
  // general market news and then look like they have no signal at all.
  for (const category of ["account-demand", "account_intel", "silicon_programs", "exec_org", "oem_odm", "industry"]) {
    for (const item of ordered.filter((candidate) => candidate.category === category)) add(item);
  }
  for (const item of ordered) add(item);
  return selected;
}

async function collectNews(previousNews = [], previousReferenceNews = []) {
  const seen = new Set();
  const categories = [];
  const preserved = PRESERVED_NEWS_SEEDS
    .map(normalizePreservedNewsSeed)
    .filter((item) => isForeignItem(item) && !isCrawlerExcluded("news", item));
  const previousReferences = previousNews
    .concat(previousReferenceNews)
    .map(normalizePreviousNewsFallback)
    .filter(Boolean)
    .filter((item) => !isCrawlerExcluded("news", item));
  const referenceNews = dedupeEnrichedNews(preserved.concat(previousReferences), { preferPreservedSeed: true })
    .sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0))
    .map(({ ts, verification: _verification, ...item }) => {
      const sourceCategory = item.sourceCategory || item.category || "uncategorized";
      return {
        ...item,
        sourceCategory,
        category: classifyPublicNewsCategory({ ...item, sourceCategory }),
        referenceOnly: true,
        referenceOrigin: item.preservedSeed ? "curated-seed" : "previous-verified-run",
        origin: "reference-archive",
        observedThisRun: false,
        dataStatus: "reference-only",
      };
    });
  let all = [];

  for (const cat of CATEGORIES.concat(ENGLISH_AUTHORITY_MONITORS, BROKER_RESEARCH_MONITORS)) {
    const items = (await fetchCategory(cat, seen)).filter((item) => !isCrawlerExcluded("news", item));
    all = all.concat(items);
    mergeNewsCategory(categories, cat, items);
  }

  for (const monitor of CATALOG_DISCOVERY_MONITORS) {
    const items = (await fetchCategory(monitor, seen)).filter((item) => !isCrawlerExcluded("news", item));
    all = all.concat(items);
    mergeNewsCategory(categories, { id: "source-catalog", label: "AI Infra 공식·산업 출처 카탈로그" }, items, 16);
  }

  for (const cat of CHINESE_CATEGORIES.concat(CHINESE_AUTHORITY_MONITORS)) {
    const items = (await fetchCategory(cat, seen, "zh")).filter((item) => !isCrawlerExcluded("news", item));
    all = all.concat(items);
    mergeNewsCategory(categories, cat, items, 10);
  }

  const directAccountSources = (await collectDirectAccountSources())
    .filter((item) => !isCrawlerExcluded("news", item));
  if (directAccountSources.length) {
    all = all.concat(directAccountSources);
    mergeNewsCategory(categories, { id: "account-demand", label: "수요처 계정 실적·CapEx·출하" }, directAccountSources);
  }

  all = all.filter((item) => verifiedNewsLanguage(item));
  all.sort((a, b) => b.ts - a.ts);
  const selected = ["english", "chinese"]
    .flatMap((language) => selectNewsStreamItems(
      all.filter((item) => verifiedNewsLanguage(item) === language),
      NEWS_STREAM_LIMIT,
    ))
    .sort((a, b) => b.ts - a.ts);
  let latestNews = dedupeEnrichedNews(await enrichNewsItems(selected, previousNews))
    .filter((item) => !isCrawlerExcluded("news", item))
    .sort((a, b) => (b.ts || 0) - (a.ts || 0));

  const freshLanguageCounts = {
    english: latestNews.filter((item) => verifiedNewsLanguage(item) === "english").length,
    chinese: latestNews.filter((item) => verifiedNewsLanguage(item) === "chinese").length,
  };
  if (latestNews.length < 24 || freshLanguageCounts.english < 12 || freshLanguageCounts.chinese < 4) {
    // Fail closed instead of allowing previous-run rows to satisfy a live-news
    // threshold. Continuity copies remain available through referenceNews.
    note("뉴스연속성", false, `이번 실행 직접 수집 ${freshLanguageCounts.english + freshLanguageCounts.chinese}건 · 참조 전용 ${referenceNews.length}건은 라이브 집계에서 제외`);
  }
  return {
    categories,
    news: latestNews.map(({ ts, ...rest }) => rest),
    referenceNews,
    trending: extractTrending(all),
    newsStats: newsStats(latestNews),
    allNews: all,
  };
}

function compactPricePointForClient(point = {}) {
  return {
    date: point.date || null,
    sourceObservedAt: point.sourceObservedAt || point.observedAt || null,
    sourceUpdate: point.sourceUpdate || "",
    average: Number.isFinite(Number(point.average)) ? Number(point.average) : null,
    averageRaw: point.averageRaw || "",
    changePct: Number.isFinite(Number(point.changePct)) ? Number(point.changePct) : null,
    changeRaw: point.changeRaw || "",
    direction: point.direction || "flat",
    origin: point.origin || null,
    archiveUrl: point.archiveUrl || null,
  };
}

function compactMarketPointForClient(point = {}) {
  const time = Number(point.time || new Date(point.date || 0).getTime());
  const close = Number(point.close ?? point.value);
  if (!Number.isFinite(time) || !Number.isFinite(close) || close <= 0) return null;
  // Browser charts only need a timestamp and close. The audit artifact retains
  // the ISO date and full point provenance.
  return [time, close];
}

function compactPriceRowForClient(row = {}) {
  const { history: _history, ...rest } = row;
  return rest;
}

function compactTranslationForClient(translation = null) {
  if (!translation || typeof translation !== "object") return translation;
  const compactPart = (part = null) => part && typeof part === "object"
    ? { status: part.status || null, display: part.display || null }
    : part;
  return {
    title: compactPart(translation.title),
    summary: compactPart(translation.summary),
  };
}

function compactVerificationForClient(verification = null) {
  if (!verification || typeof verification !== "object") return verification;
  return {
    id: verification.id || null,
    status: verification.status || null,
    canonicalUrl: verification.canonicalUrl || null,
    origin: verification.origin || null,
    observedThisRun: verification.observedThisRun === true,
    evidenceLevel: verification.evidenceLevel || null,
    sourceClass: verification.sourceClass || null,
    freshness: verification.freshness || null,
    claimClass: verification.claimClass || null,
    claimStage: verification.claimStage || null,
    claimType: verification.claimType || null,
    structuredFactEligible: verification.structuredFactEligible !== false,
    entities: Array.isArray(verification.entities) ? verification.entities : [],
    meceAxis: verification.meceAxis || null,
    checks: verification.checks || {},
  };
}

function compactNewsItemForClient(item = {}) {
  const next = { ...item };
  const claimPolicy = newsClaimPolicy(item);
  const displayTitle = intelligenceTitle(next);
  if (displayTitle) next.title = displayTitle;
  if (next.originalTitle === next.title) delete next.originalTitle;
  if (next.link === next.sourceUrl) delete next.link;
  if (next.translation) next.translation = compactTranslationForClient(next.translation);
  if (next.verification || claimPolicy.claimClass !== "general-news") {
    next.verification = compactVerificationForClient({
      ...(next.verification || {}),
      claimClass: claimPolicy.claimClass,
      claimStage: claimPolicy.claimStage,
      claimType: claimPolicy.claimType,
      structuredFactEligible: claimPolicy.structuredFactEligible,
    });
  }
  return next;
}

function hasDirectBrowserSource(item = {}) {
  const value = item.sourceUrl || item.url || item.link || "";
  try {
    const url = new URL(String(value));
    return ["http:", "https:"].includes(url.protocol)
      && !/(^|\.)news\.google\.com$|(^|\.)google\.com$/i.test(url.hostname);
  } catch {
    return false;
  }
}

function compactPriceHistoryForClient(history = {}) {
  return {
    schemaVersion: history.schemaVersion || "2.0",
    clientArtifact: true,
    runId: history.runId || null,
    updatedAt: history.updatedAt || null,
    validatedAt: history.validatedAt || null,
    expiresAt: history.expiresAt || null,
    timezone: history.timezone || "Asia/Seoul",
    // The browser needs chart points and availability, not every crawl-time
    // parser field or the full archive retry log.  The complete evidence DB
    // remains in price-history.json for audits and future recomputation.
    archiveBackfill: history.archiveBackfill ? {
      schemaVersion: history.archiveBackfill.schemaVersion || null,
      monthsRequested: history.archiveBackfill.monthsRequested || null,
      updatedAt: history.archiveBackfill.updatedAt || null,
      coverage: history.archiveBackfill.coverage || null,
    } : null,
    items: Object.fromEntries(Object.entries(history.items || {}).map(([key, item]) => [key, {
      key: item.key || key,
      sectionId: item.sectionId || null,
      sectionTitle: item.sectionTitle || item.title || null,
      group: item.group || null,
      item: item.item || null,
      source: item.source || null,
      sourceUrl: item.sourceUrl || null,
      historyUrl: item.historyUrl || null,
      historyDays: item.historyDays || null,
      updatedAt: item.updatedAt || null,
      points: (item.points || []).map(compactPricePointForClient),
    }])),
  };
}

const MARKET_PRICE_BOARD_IDS = new Set([
  "sox",
  "skhy-stock",
  "samsung-stock",
  "micron-stock",
  "sandisk-stock",
  "wdc-stock",
  "kioxia-stock",
  "naura-stock",
  "amec-stock",
  "acm-shanghai-stock",
  "jcet-stock",
  "gigadevice-stock",
  "smic-stock",
]);

// The Technology & Memory decision board uses a deliberately small subset of
// the full price/equity history. Keeping this contract explicit prevents a
// sidebar click from downloading every stock series before the board appears.
const EXECUTIVE_DECISION_PRICE_SERIES_IDS = new Set([
  "dram-dram-spot-price::ddr5 16gb (2gx8) 4800/5600",
  "dram-dram-spot-price::ddr5 16gb (2gx8) ett",
  "dram-dram-contract-price::ddr5 8gb so-dimm",
  "dram-module-spot-price::ddr5 rdimm 32gb 4800/5600",
  "nand-nand-flash-contract-price::nand 128gb 16gx8 mlc",
  "nand-wafer-spot-price::512gb tlc",
  "nand-pc-client-oem-ssd-contract-price::1tb-msata/m.2 tlc pcie-value grade",
  "dram-module-spot-price::ddr5 udimm 16gb 4800/5600",
  "nand-pc-client-oem-ssd-contract-price::512gb-msata/m.2 tlc pcie-value grade",
  "nand-memory-card-spot-price::microsd 128gb",
  "dram-dram-contract-price::ddr4 16gb 2gx8",
  "dram-dram-spot-price::ddr4 16gb (2gx8) 3200",
  "dram-dram-spot-price::ddr4 16gb (2gx8) ett",
  "nand-nand-flash-spot-price::mlc 64gb 8gbx8",
  "nand-wafer-spot-price::256gb tlc",
  "nand-ssd-street-price::adata",
  "nand-nand-flash-contract-price::nand 64gb 8gx8 mlc",
]);

const EXECUTIVE_DECISION_MARKET_SERIES_IDS = new Set([
  "sox",
  "skhy-stock",
  "samsung-stock",
  "micron-stock",
  "sandisk-stock",
  "wdc-stock",
  "naura-stock",
  "amec-stock",
  "jcet-stock",
  "gigadevice-stock",
  "smic-stock",
]);

function sampleEquityPointWindow(points = [], maxPoints = 0) {
  if (!maxPoints || points.length <= maxPoints) return points;
  const lastIndex = points.length - 1;
  const sampled = [];
  for (let index = 0; index < maxPoints; index += 1) {
    sampled.push(points[Math.round((index / Math.max(1, maxPoints - 1)) * lastIndex)]);
  }
  return sampled.filter((point, index) => index === 0 || point[0] !== sampled[index - 1][0]);
}

function compactEquityPointsForClient(id, points = []) {
  const compact = (points || []).map(compactMarketPointForClient).filter(Boolean);
  if (compact.length <= 260) return compact;
  const latestTime = Number(compact.at(-1)?.[0] || 0);
  const recentCutoff = latestTime - (400 * 24 * 60 * 60 * 1000);
  const recentStart = compact.findIndex((point) => point[0] >= recentCutoff);
  const splitAt = recentStart > 0 ? recentStart : 0;
  const archive = compact.slice(0, splitAt);
  const recent = compact.slice(splitAt);
  const isCorePriceBoard = MARKET_PRICE_BOARD_IDS.has(id);
  const archiveLimit = isCorePriceBoard ? 120 : 72;
  const recentLimit = isCorePriceBoard ? 240 : 168;
  return [
    ...sampleEquityPointWindow(archive, archiveLimit),
    ...sampleEquityPointWindow(recent, recentLimit),
  ].filter((point, index, sampled) => index === 0 || point[0] !== sampled[index - 1][0]);
}

function compactMarketHistoryForClient(history = {}) {
  return {
    schemaVersion: history.schemaVersion || "2.0",
    clientArtifact: true,
    runId: history.runId || null,
    updatedAt: history.updatedAt || null,
    validatedAt: history.validatedAt || null,
    expiresAt: history.expiresAt || null,
    timezone: history.timezone || "Asia/Seoul",
    source: history.source || null,
    indexes: Object.fromEntries(Object.entries(history.indexes || {}).map(([id, index]) => {
      const points = compactEquityPointsForClient(id, index.points || []);
      return [id, {
        id: index.id || id,
        label: index.label || null,
        labelKo: index.labelKo || null,
        shortName: index.shortName || index.labelKo || index.label || null,
        symbol: index.symbol || null,
        currency: index.currency || null,
        exchangeName: index.exchangeName || null,
        exchange: index.exchange || null,
        region: index.region || null,
        valueChain: index.valueChain || null,
        listedAt: index.listedAt || null,
        newListing: index.newListing === true,
        officialSourceUrl: index.officialSourceUrl || null,
        quoteReference: index.quoteReference || null,
        quoteReferenceUrl: index.quoteReferenceUrl || null,
        quoteReferenceCurrency: index.quoteReferenceCurrency || null,
        source: index.source || null,
        sourceUrl: index.sourceUrl || null,
        chartUrl: index.chartUrl || null,
        updatedAt: index.updatedAt || null,
        latest: index.latest || null,
        latestSource: index.latestSource || null,
        latestSourceUrl: index.latestSourceUrl || null,
        regularMarketTime: index.regularMarketTime || null,
        pointCount: Number(index.pointCount || (index.points || []).length),
        clientPointCount: points.length,
        points,
      }];
    })),
    // Metric point provenance stays in the database-only file.  UI market
    // cards consume index time series and quant-backtest summaries instead.
    metrics: {},
  };
}

function compactQuantForClient(quant = {}) {
  // Dashboard heartbeat charts use the explicit 30-day windows.  Five-year FX
  // and equity proxy series remain in quant.json / market-history.json for
  // audit and research export, avoiding another large initial JSON parse.
  const next = JSON.parse(JSON.stringify(quant || {}));
  for (const group of [next.fx, next.aiDemandProxy]) {
    for (const item of Object.values(group || {})) delete item.history5y;
  }
  // The full incremental retrieval corpus remains in quant.json for the next
  // automation run. Browsers receive only evaluation, metric consensus and
  // retrieval-pack summaries, avoiding a large first-load parse.
  if (next.decisionIntelligence?.knowledgeIndex) delete next.decisionIntelligence.knowledgeIndex;
  return { ...next, clientArtifact: true };
}

function compactQuantBacktestForClient(backtest = {}) {
  return {
    schemaVersion: backtest.schemaVersion || "1.0",
    clientArtifact: true,
    runId: backtest.runId || null,
    generatedAt: backtest.generatedAt || null,
    validatedAt: backtest.validatedAt || null,
    expiresAt: backtest.expiresAt || null,
    coverage: backtest.coverage || {},
    horizons: backtest.horizons || {},
    series: Object.fromEntries(Object.entries(backtest.series || {}).map(([id, series]) => [id, {
      id: series.id || id,
      domain: series.domain || null,
      periods: Object.fromEntries(Object.entries(series.periods || {}).map(([period, stats]) => [
        period,
        { eligible: stats?.eligible === true },
      ])),
    }])),
  };
}

function decisionPointTime(point = {}) {
  if (Array.isArray(point)) return Number(point[0]) || 0;
  const direct = Number(point.time || 0);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const parsed = Date.parse(point.sourceObservedAt || point.observedAt || point.date || point.sourceUpdate || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function sampleDecisionMonthPoints(points = [], mapPoint = (point) => point) {
  const months = new Map();
  for (const point of points || []) {
    const time = decisionPointTime(point);
    if (!time) continue;
    const date = new Date(time);
    const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const previous = months.get(month);
    if (!previous || time > previous.time) months.set(month, { time, point });
  }
  return Array.from(months.values())
    .sort((left, right) => left.time - right.time)
    .map(({ point, time }) => mapPoint(point, time))
    .filter(Boolean);
}

function compactDecisionPriceSeries(item = {}, key = "") {
  return {
    key: item.key || key,
    sectionTitle: item.sectionTitle || null,
    group: item.group || null,
    item: item.item || null,
    sourceUrl: item.sourceUrl || null,
    points: sampleDecisionMonthPoints(item.points || [], (point, time) => {
      const average = Number(point?.average);
      if (!Number.isFinite(average)) return null;
      return { date: new Date(time).toISOString(), average };
    }),
  };
}

function compactDecisionMarketSeries(index = {}, id = "") {
  return {
    id: index.id || id,
    label: index.label || null,
    labelKo: index.labelKo || null,
    source: index.source || null,
    sourceUrl: index.sourceUrl || null,
    chartUrl: index.chartUrl || null,
    points: sampleDecisionMonthPoints(index.points || [], (point, time) => {
      const value = Number(Array.isArray(point) ? point[1] : point?.close ?? point?.value);
      return Number.isFinite(value) && value > 0 ? [time, value] : null;
    }),
  };
}

function compactDecisionHistoryForClient({ priceHistory = {}, marketHistory = {}, quantBacktest = {} } = {}) {
  const price = compactPriceHistoryForClient(priceHistory);
  const market = compactMarketHistoryForClient(marketHistory);
  const backtest = compactQuantBacktestForClient(quantBacktest);
  price.items = Object.fromEntries(Object.entries(price.items || {})
    .filter(([id]) => EXECUTIVE_DECISION_PRICE_SERIES_IDS.has(id))
    .map(([id, item]) => [id, compactDecisionPriceSeries(item, id)]));
  market.indexes = Object.fromEntries(Object.entries(market.indexes || {})
    .filter(([id]) => EXECUTIVE_DECISION_MARKET_SERIES_IDS.has(id))
    .map(([id, index]) => [id, compactDecisionMarketSeries(index, id)]));
  const allowedBacktestIds = new Set([
    ...Object.keys(price.items).map((id) => `price:${id}`),
    ...Object.keys(market.indexes).map((id) => `market:${id}`),
  ]);
  backtest.series = Object.fromEntries(Object.entries(backtest.series || {})
    .filter(([id]) => allowedBacktestIds.has(id)));
  return {
    schemaVersion: "1.0",
    clientArtifact: true,
    runId: price.runId || market.runId || backtest.runId || null,
    generatedAt: price.updatedAt || market.updatedAt || backtest.generatedAt || null,
    expiresAt: price.expiresAt || market.expiresAt || backtest.expiresAt || null,
    priceHistory: price,
    marketHistory: market,
    quantBacktest: backtest,
  };
}

const CLIENT_NEWS_YEAR = "2026";

function clientArticleDate(item = {}) {
  return String(item.publishedAt || item.date || "").trim();
}

function isCurrentClientArticle(item = {}) {
  return clientArticleDate(item).startsWith(CLIENT_NEWS_YEAR);
}

function compactCurrentNews(items = []) {
  return items
    .filter(isCurrentClientArticle)
    .filter((item) => newsClaimPolicy(item).disposition !== "quarantine")
    .map(compactNewsItemForClient);
}

function clientClaimUrlKey(value = "") {
  return String(value || "").trim().replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();
}

function quarantinedClientClaimKeys(items = []) {
  const quarantined = items.filter((item) => (
    item?.reason === "unverified_jalapeno_claim"
    || (item?.reasons || []).includes("unverified_jalapeno_claim")
    || newsClaimPolicy(item).disposition === "quarantine"
  ));
  return {
    urls: new Set(quarantined.map((item) => clientClaimUrlKey(directNewsUrl(item))).filter(Boolean)),
    titles: new Set(quarantined.flatMap((item) => [item.title, item.originalTitle, item.titleKo])
      .map((title) => String(title || "").trim().toLowerCase())
      .filter(Boolean)),
  };
}

function pruneQuarantinedClientClaims(value, blockedUrls = new Set(), blockedTitles = new Set()) {
  if (Array.isArray(value)) {
    return value
      .map((item) => pruneQuarantinedClientClaims(item, blockedUrls, blockedTitles))
      .filter((item) => item != null);
  }
  if (!value || typeof value !== "object") return value;
  const directUrls = [
    value.sourceUrl,
    value.url,
    value.link,
    value.canonicalUrl,
  ]
    .map(clientClaimUrlKey)
    .filter(Boolean);
  if (directUrls.some((url) => blockedUrls.has(url))) return null;
  const directTitles = [value.title, value.originalTitle, value.titleKo]
    .map((title) => String(title || "").trim().toLowerCase())
    .filter(Boolean);
  if (directTitles.some((title) => blockedTitles.has(title))) return null;
  // Production payload.news contains promoted items only. Re-evaluate each
  // accumulated card so a stale derived claim cannot survive merely because
  // its source article was already removed from the current news array.
  if (directTitles.length && newsClaimPolicy(value).disposition === "quarantine") return null;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    pruneQuarantinedClientClaims(item, blockedUrls, blockedTitles),
  ]));
}

function pruneEmptyQuarantinedBriefs(value = {}) {
  if (!value?.intelligence || !Array.isArray(value.intelligence.briefs)) return value;
  return {
    ...value,
    intelligence: {
      ...value.intelligence,
      briefs: value.intelligence.briefs.filter((brief) => brief?.latest?.url),
    },
  };
}

function stripRepeatedPublisherSuffix(value = "") {
  let text = String(value || "").trim();
  let match = text.match(/^(.*?)(?:\s[|–—-]\s)([^|–—-]+?)\s[-–—]\s\2$/i);
  while (match) {
    text = `${match[1]} | ${match[2]}`.trim();
    match = text.match(/^(.*?)(?:\s[|–—-]\s)([^|–—-]+?)\s[-–—]\s\2$/i);
  }
  return text;
}

function pruneOldDatedArticles(value, parentKey = "") {
  if (Array.isArray(value)) return value
    .map((item) => pruneOldDatedArticles(item, parentKey))
    .filter((item) => item != null);
  if (typeof value === "string" && /title|headline|evidence/i.test(parentKey)) {
    return stripRepeatedPublisherSuffix(value);
  }
  if (!value || typeof value !== "object") return value;
  const date = clientArticleDate(value);
  const articleLike = Boolean(
    date
    && (value.url || value.link)
    && (value.title || value.headline || value.source || value.excerpt || /news|evidence|signal|event|article|document/i.test(parentKey)),
  );
  if (articleLike && !date.startsWith(CLIENT_NEWS_YEAR)) return null;
  const normalized = Object.fromEntries(Object.entries(value)
    .map(([key, item]) => [key, pruneOldDatedArticles(item, key)])
    .filter(([, item]) => item != null));
  if (articleLike) {
    const displayTitle = intelligenceTitle(normalized);
    if (displayTitle) normalized.title = displayTitle;
  }
  return normalized;
}

export function compactLiveForClient(payload = {}, quarantinedClaims = []) {
  const {
    quant: _quant,
    priceHistory: _priceHistory,
    marketHistory: _marketHistory,
    sourceRegistry: _sourceRegistry,
    signals: _signals,
    competitors: _competitors,
    newsStats: _newsStats,
    quarantineSummary: _quarantineSummary,
    ...rest
  } = payload;
  const evidence = payload.evidence ? {
    promotedCount: Number(payload.evidence.promotedCount || 0),
  } : null;
  const news = compactCurrentNews(payload.news || []);
  const referenceNews = payload.referenceNews && typeof payload.referenceNews === "object"
    ? {
        ...payload.referenceNews,
        items: compactCurrentNews(payload.referenceNews.items || []),
      }
    : payload.referenceNews;
  const categories = (payload.categories || []).map((category) => ({
    ...category,
    items: compactCurrentNews(category.items || []),
  }));
  const communitySignals = payload.communitySignals && typeof payload.communitySignals === "object"
    ? {
        ...payload.communitySignals,
        items: compactCurrentNews(payload.communitySignals.items || []),
      }
    : payload.communitySignals;
  const benchmarkSignals = payload.benchmarkSignals && typeof payload.benchmarkSignals === "object"
    ? {
        ...payload.benchmarkSignals,
        stream: compactCurrentNews(payload.benchmarkSignals.stream || []),
        themes: (payload.benchmarkSignals.themes || []).map((theme) => ({
          ...theme,
          items: compactCurrentNews(theme.items || []),
        })),
        // Discovery/reference archives remain in live.json for audits and future
        // recomputation. They are not rendered and often contain RSS relay URLs,
        // so they do not belong in the browser's first-load artifact.
        referenceArchive: undefined,
        discoveryArchive: undefined,
      }
    : payload.benchmarkSignals;
  const startups = payload.startups && typeof payload.startups === "object"
    ? {
        ...payload.startups,
        candidates: (payload.startups.candidates || []).map((candidate) => ({
          ...candidate,
          recentNews: compactCurrentNews((candidate.recentNews || []).filter(hasDirectBrowserSource)),
        })),
      }
    : payload.startups;
  const prices = payload.prices && typeof payload.prices === "object"
    ? {
        ...payload.prices,
        sections: (payload.prices.sections || []).map((section) => ({
          ...section,
          rows: (section.rows || []).map(compactPriceRowForClient),
        })),
        watchedItems: (payload.prices.watchedItems || []).map(compactPriceRowForClient),
      }
    : payload.prices;
  const blockedClaims = quarantinedClientClaimKeys([
    ...(payload.news || []),
    ...(quarantinedClaims || []),
  ]);
  return pruneEmptyQuarantinedBriefs(pruneQuarantinedClientClaims({
    ...rest,
    clientArtifact: true,
    evidence,
    news,
    referenceNews,
    categories,
    communitySignals,
    benchmarkSignals,
    startups,
    prices,
  }, blockedClaims.urls, blockedClaims.titles));
}

export function buildLandingDecisionClient({ payload = {}, quant = {} } = {}) {
  const allowedBriefIds = new Set(["hbm", "dram", "nand", "demand"]);
  const briefs = (payload.intelligence?.briefs || [])
    .filter((brief) => allowedBriefIds.has(brief?.id) && brief?.latest?.url)
    .map((brief) => ({
      id: brief.id,
      label: brief.label,
      latest: {
        title: brief.latest.title || "",
        summary: brief.latest.summary || "",
        source: brief.latest.source || "",
        url: brief.latest.url || "",
        observedAt: brief.latest.observedAt || brief.latest.crawledAt || payload.updatedAt || null,
        dataStatus: brief.latest.dataStatus || "live-observed",
      },
    }));
  const automatedMetrics = quant.decisionIntelligence?.metrics?.latest || [];
  const companies = (quant.marketStructure?.companies || [])
    .filter((company) => ["SKHY", "삼성전자", "마이크론"].includes(company?.company))
    .map((company) => {
      const metric = hbmMetricForCompany({ metrics: { latest: automatedMetrics } }, company.company);
      const primarySource = metric?.sources?.[0] || null;
      return {
        company: company.company,
        // Never ship a volatile HBM share from the editorial baseline.
        hbmShare: metric?.display || null,
        dramShare: company.dramShare2026 || null,
        asOf: metric?.period || null,
        source: metric?.sources?.map((source) => source.name).filter(Boolean).join(" · ") || null,
        sourceUrl: primarySource?.url || null,
        dataStatus: metric ? (metric.representation === "range" ? `range-${metric.sourceCount}-sources` : metric.confidence) : "automation-pending",
        trend: metric ? {
          direction: metric.direction || "new",
          changePctPoint: metric.changePctPoint ?? null,
          priorPeriod: metric.priorPeriod || null,
          yearAgoPeriod: metric.yearAgoPeriod || null,
          yearAgoChangePctPoint: metric.yearAgoChangePctPoint ?? null,
          sourceCount: Number(metric.sourceCount || 0),
        } : null,
      };
    });
  const priceSections = (payload.prices?.sections || [])
    .filter((section) => ["DRAM Spot Price", "DRAM Contract Price", "PC-Client OEM SSD Contract Price"].includes(section?.title))
    .map((section) => ({
      title: section.title,
      group: section.group,
      lastUpdate: section.lastUpdate || null,
      sourceUrl: section.sourceUrl || payload.prices?.source?.url || null,
      rows: (section.rows || []).slice(0, 2).map((row) => ({
        item: row.item,
        average: Number.isFinite(Number(row.average)) ? Number(row.average) : null,
        changePct: Number.isFinite(Number(row.changePct)) ? Number(row.changePct) : null,
        direction: row.direction || null,
      })),
    }));
  return {
    schemaVersion: "1.0",
    runId: payload.runId || quant.runId || null,
    updatedAt: payload.updatedAt || quant.updatedAt || null,
    expiresAt: payload.expiresAt || quant.expiresAt || null,
    clientArtifact: true,
    evidence: {
      promotedCount: Number(payload.evidence?.promotedCount || payload.news?.length || 0),
      qualityStatus: payload.quality?.status || "unavailable",
    },
    briefs,
    marketStructure: { companies },
    prices: { sections: priceSections },
  };
}

function compactDecisionIntelligenceForInitial(content = {}) {
  const automation = content.decisionAutomation || {};
  return {
    schemaVersion: content.schemaVersion || null,
    status: content.status || null,
    generatedAt: content.generatedAt || null,
    runId: content.runId || null,
    freshness: content.freshness || {},
    evaluation: content.evaluation || {},
    decisionAutomation: {
      state: automation.state || null,
      funnel: automation.funnel || {},
      catalogCoverage: automation.catalogCoverage || {},
      briefs: (automation.briefs || []).map((brief) => ({
        id: brief.id || null,
        label: brief.label || null,
        status: brief.status || null,
        whatChanged: brief.whatChanged || null,
        hypothesis: brief.hypothesis || null,
        factBoundary: brief.factBoundary || null,
        customerPain: brief.customerPain || null,
        action90d: brief.action90d || null,
      })),
    },
  };
}

/**
 * Splits the generated strategy model into a first-paint contract and a
 * background extension.  The initial artifact contains the homepage,
 * customer/ASIC portfolio and decision cards; long RAG, AI Factory and agent
 * operating models hydrate immediately afterwards without blocking paint.
 */
function splitSiteContentForClient(content = {}) {
  const portfolio = content.strategyBoard?.customerPortfolio || {};
  const compactAxis = (axis = {}) => ({
    id: axis.id || null,
    label: axis.label || null,
    mentions: Number(axis.mentions || 0),
  });
  const compactAccount = (account) => ({
    id: account.id || null,
    company: account.company || null,
    chip: account.chip || null,
    chipStage: account.chipStage || null,
    group: account.group || null,
    demandClass: account.demandClass || null,
    pain: account.pain || null,
    memory: account.memory || null,
    gate: account.gate || null,
    accent: account.accent || null,
    evidence: account.evidence ? {
      status: account.evidence.status || null,
      label: account.evidence.label || null,
      source: account.evidence.source || null,
      url: account.evidence.url || null,
      asOf: account.evidence.asOf || null,
    } : null,
  });
  const initialAccounts = (portfolio.accounts || []).map(compactAccount);
  const initialFocusAccounts = (portfolio.focusAccounts || []).map(compactAccount);
  const ecosystem = portfolio.broadcomEcosystem || {};
  const initialEcosystem = {
    eyebrow: ecosystem.eyebrow || null,
    title: ecosystem.title || null,
    description: ecosystem.description || null,
    decisionFlow: ecosystem.decisionFlow || [],
    evidencePolicy: ecosystem.evidencePolicy || null,
    partner: ecosystem.partner ? {
      company: ecosystem.partner.company || null,
      accent: ecosystem.partner.accent || null,
      buyingCriteria: ecosystem.partner.buyingCriteria || [],
    } : null,
    rollup: ecosystem.rollup ? {
      buyingCriteria: ecosystem.rollup.buyingCriteria || [],
      topPainAxes: (ecosystem.rollup.topPainAxes || []).map(compactAxis),
    } : null,
    accounts: (ecosystem.accounts || []).map((account) => ({
      id: account.id || null,
      company: account.company || null,
      chip: account.chip || null,
      accent: account.accent || null,
      pain: account.pain || null,
      gate: account.gate || null,
      painAxes: (account.painAxes || []).map(compactAxis),
      broadcomStrategy: account.broadcomStrategy ? {
        status: account.broadcomStrategy.status || null,
        accountQuestion: account.broadcomStrategy.accountQuestion || null,
        customerStrategy: account.broadcomStrategy.customerStrategy || null,
        pains: account.broadcomStrategy.pains || [],
        proposal: account.broadcomStrategy.proposal || [],
        gate90d: account.broadcomStrategy.gate90d || null,
        source: account.broadcomStrategy.source ? {
          name: account.broadcomStrategy.source.name || null,
          url: account.broadcomStrategy.source.url || null,
        } : null,
      } : null,
    })),
  };
  const partnerEcosystem = portfolio.partnerEcosystem || {};
  const initialPartnerEcosystem = {
    eyebrow: partnerEcosystem.eyebrow || null,
    title: partnerEcosystem.title || null,
    description: partnerEcosystem.description || null,
    evidencePolicy: partnerEcosystem.evidencePolicy || null,
    partners: (partnerEcosystem.partners || []).map((partner) => ({
      id: partner.id || null,
      company: partner.company || null,
      chip: partner.chip || null,
      accent: partner.accent || null,
      buyingCriteria: partner.buyingCriteria || [],
      rollup: partner.rollup ? {
        topPainAxes: (partner.rollup.topPainAxes || []).map(compactAxis),
      } : null,
      accounts: (partner.accounts || []).map((account) => ({
        id: account.id || null,
        company: account.company || null,
        chip: account.chip || null,
        accent: account.accent || null,
        pain: account.pain || null,
        memory: account.memory || null,
        gate: account.gate || null,
      })),
    })),
  };
  const initialOnePagers = (portfolio.executiveOnePagers || []).map((page) => ({
    accountId: page.accountId || null,
    headline: page.headline || null,
    layer: page.layer || null,
    decisionQuestion: page.decisionQuestion || null,
    topPainAxes: (page.topPainAxes || []).map(compactAxis),
    whyLost: (page.whyLost || []).map(compactAxis),
    recommendedProductIds: page.recommendedProductIds || [],
  }));
  const fullCompetitiveDynamics = portfolio.competitiveDynamics || {};
  const defaultDynamicsViewId = fullCompetitiveDynamics.defaultView || null;
  const defaultDynamicsView = defaultDynamicsViewId
    ? fullCompetitiveDynamics.views?.[defaultDynamicsViewId] || null
    : null;
  const defaultDynamicsCompanyIds = new Set(defaultDynamicsView?.companyIds || []);
  const defaultDynamicsRelationIds = new Set(defaultDynamicsView?.relationIds || []);
  const defaultDynamicsLayerIds = new Set(defaultDynamicsView?.layerIds || []);
  const compactDynamicsRelation = ({
    id, type, from, to, title, detail, domain, memoryImplication, decisionImpact,
    claim, sourceClass, evidenceGrade, effectiveAt, status, source,
  } = {}) => ({
    id, type, from, to, title, detail, domain, memoryImplication, decisionImpact,
    claim, sourceClass, evidenceGrade, effectiveAt, status, source,
  });
  const initialDynamicsRelations = (fullCompetitiveDynamics.relations || [])
    .filter((relation) => defaultDynamicsView
      ? defaultDynamicsRelationIds.has(relation.id)
      : (["OFFICIAL", "FILING"].includes(String(relation.evidenceGrade || "").toUpperCase())
        || relation.claim === "verified-fact"))
    .map(compactDynamicsRelation);
  const initialDynamicsRelationCounts = initialDynamicsRelations.reduce((counts, relation) => {
    counts.set(relation.from, Number(counts.get(relation.from) || 0) + 1);
    counts.set(relation.to, Number(counts.get(relation.to) || 0) + 1);
    return counts;
  }, new Map());
  const extendedDynamicsCompanies = (fullCompetitiveDynamics.companies || [])
    .filter((company) => !defaultDynamicsView || defaultDynamicsCompanyIds.has(company.id))
    .map((company) => ({ ...company, relationCount: Number(initialDynamicsRelationCounts.get(company.id) || 0) }));
  const extendedDynamicsCompanyById = new Map(extendedDynamicsCompanies.map((company) => [company.id, company]));
  const extendedDynamicsLayers = (fullCompetitiveDynamics.layers || [])
    .filter((layer) => !defaultDynamicsView || defaultDynamicsLayerIds.has(layer.id))
    .map((layer) => ({
      ...layer,
      companies: (layer.companies || []).map((company) => extendedDynamicsCompanyById.get(company.id)).filter(Boolean),
    }))
    .filter((layer) => (layer.companies || []).length);
  const extendedCompetitiveDynamics = {
    eyebrow: fullCompetitiveDynamics.eyebrow || null,
    title: fullCompetitiveDynamics.title || null,
    description: fullCompetitiveDynamics.description || null,
    updatedAt: fullCompetitiveDynamics.updatedAt || null,
    defaultView: defaultDynamicsViewId,
    views: defaultDynamicsViewId && defaultDynamicsView
      ? { [defaultDynamicsViewId]: defaultDynamicsView }
      : {},
    types: defaultDynamicsView?.types || fullCompetitiveDynamics.types || [],
    layers: extendedDynamicsLayers,
    companies: extendedDynamicsCompanies,
    relations: initialDynamicsRelations,
  };
  // Keep every registered company in the first client snapshot so the map
  // never collapses to relation endpoints while the large extended payload is
  // downloading. A compact node contract preserves the transfer budget.
  const initialDynamicsCompanies = extendedDynamicsCompanies.map((company) => ({
    id: company.id,
    company: company.company,
    layer: company.layer,
    portfolio: company.portfolio,
    decision: company.decision,
    pain: company.pain,
    memoryOption: company.memoryOption,
    buyingCriteria: company.buyingCriteria,
    stage: company.stage,
    accent: company.accent,
    logo: company.logo,
    priorityTier: company.priorityTier,
    systemRole: company.systemRole,
    collaborationValue: company.collaborationValue,
    relationCount: company.relationCount,
  }));
  const initialDynamicsCompanyById = new Map(initialDynamicsCompanies.map((company) => [company.id, company]));
  const initialDynamicsLayers = extendedDynamicsLayers
    .map((layer) => ({
      ...layer,
      companies: (layer.companies || []).map((company) => initialDynamicsCompanyById.get(company.id)).filter(Boolean),
    }))
    .filter((layer) => (layer.companies || []).length);
  const initialDynamicsLayerIds = initialDynamicsLayers.map((layer) => layer.id);
  const initialDynamicsView = defaultDynamicsView ? {
    ...defaultDynamicsView,
    companyScope: "site-company-registry",
    companyIds: initialDynamicsCompanies.map((company) => company.id),
    layerIds: initialDynamicsLayerIds,
    evidencePolicy: {
      ...(defaultDynamicsView.evidencePolicy || {}),
      summary: "업체: 사이트 기업 레지스트리 전체 · 관계선: SK hynix 직접 verified-fact · 공식 원문 · 최근 36개월 · 기업쌍당 대표 1건",
    },
    counts: {
      ...(defaultDynamicsView.counts || {}),
      companies: initialDynamicsCompanies.length,
      connectedCompanies: defaultDynamicsView.counts?.connectedCompanies || 0,
      unconnectedCompanies: defaultDynamicsView.counts?.unconnectedCompanies || 0,
      layers: initialDynamicsLayerIds.length,
    },
  } : null;
  const initialCompetitiveDynamics = {
    ...extendedCompetitiveDynamics,
    views: defaultDynamicsViewId && initialDynamicsView
      ? { [defaultDynamicsViewId]: initialDynamicsView }
      : {},
    layers: initialDynamicsLayers,
    companies: initialDynamicsCompanies,
  };
  const siteContent = {
    schemaVersion: content.schemaVersion,
    runId: content.runId,
    generatedAt: content.generatedAt,
    expiresAt: content.expiresAt,
    clientArtifact: true,
    generation: content.generation,
    siteAutomation: content.siteAutomation,
    freshness: content.freshness,
    presentation: content.presentation,
    decisionControl: content.decisionControl,
    decisionIntelligence: compactDecisionIntelligenceForInitial(content.decisionIntelligence),
    hero: content.hero,
    decisionCases: content.decisionCases,
    insights: content.insights,
    competitors: content.competitors,
    partnerSpotlight: content.partnerSpotlight,
    strategyBoard: {
      customerPortfolio: {
        groups: portfolio.groups || [],
        accounts: initialAccounts,
        focusAccounts: initialFocusAccounts,
        oemChannel: portfolio.oemChannel || null,
        broadcomEcosystem: initialEcosystem,
        partnerEcosystem: initialPartnerEcosystem,
        layerModel: portfolio.layerModel || {},
        executiveOnePagers: initialOnePagers,
        // The initial payload keeps a verified-endpoint fallback. The deferred
        // strategy artifact expands the same evidence-gated relationship set
        // to every company registered in the site's Dynamics roster.
        competitiveDynamics: { ...initialCompetitiveDynamics, deferredTo: "siteContentExtended" },
      },
    },
    caseClassification: content.caseClassification,
    agentCouncil: {
      title: content.agentCouncil?.title || null,
      subtitle: content.agentCouncil?.subtitle || null,
    },
    footer: content.footer,
  };
  const siteContentExtended = {
    schemaVersion: content.schemaVersion,
    runId: content.runId,
    generatedAt: content.generatedAt,
    expiresAt: content.expiresAt,
    clientArtifact: true,
    decisionIntelligence: content.decisionIntelligence,
    strategyBoard: {
      ...content.strategyBoard,
      customerPortfolio: {
        ...content.strategyBoard?.customerPortfolio,
        competitiveDynamics: extendedCompetitiveDynamics,
      },
    },
    organizationOperatingModel: content.organizationOperatingModel,
    ecosystemExecution: content.ecosystemExecution,
    aiFactorySystem: content.aiFactorySystem,
    workloadOptimization: content.workloadOptimization,
    agentCouncil: content.agentCouncil,
  };
  return { siteContent, siteContentExtended };
}

/**
 * Builds browser-specific artifacts from the fully provenanced data bundle.
 * Database files retain every source and audit field; these copies contain
 * only what the static UI renders.  All files share one runId, so a browser
 * never combines a fresh card with another run's history.
 */
export function buildClientDataBundle({
  payload = {},
  quant = {},
  priceHistory = {},
  marketHistory = {},
  quantBacktest = {},
  quarantinedClaims = [],
} = {}) {
  const blockedClaims = quarantinedClientClaimKeys([
    ...(payload.news || []),
    ...(quarantinedClaims || []),
  ]);
  payload = pruneEmptyQuarantinedBriefs(pruneQuarantinedClientClaims({
    ...payload,
    news: (payload.news || []).filter((item) => newsClaimPolicy(item).disposition !== "quarantine"),
  }, blockedClaims.urls, blockedClaims.titles) || {});
  quant = pruneQuarantinedClientClaims(quant, blockedClaims.urls, blockedClaims.titles) || {};
  const runId = payload.runId || quant.runId || marketHistory.runId || priceHistory.runId || null;
  const live = pruneOldDatedArticles(compactLiveForClient(payload, quarantinedClaims));
  const clientQuant = compactQuantForClient(quant);
  const price = compactPriceHistoryForClient(priceHistory);
  const market = compactMarketHistoryForClient(marketHistory);
  const backtest = compactQuantBacktestForClient(quantBacktest);
  const decisionHistory = compactDecisionHistoryForClient({ priceHistory, marketHistory, quantBacktest });
  const landingDecision = pruneOldDatedArticles(buildLandingDecisionClient({ payload, quant }));
  const fullSiteContent = pruneOldDatedArticles(buildSiteContentClient({ payload, quant }));
  const { siteContent, siteContentExtended } = splitSiteContentForClient(fullSiteContent);
  setObservedCapital(buildCapitalSignals({
    news: payload.news || [],
    accounts: STRATEGY_ACCOUNT_REGISTRY,
    now: new Date(payload.updatedAt || Date.now()),
  }));
  // Spending, executive statements and technology moves accumulate per company
  // across crawls, so a revised figure reads as a revision, not a replacement.
  let previousSignals = {};
  try {
    previousSignals = JSON.parse(readFileSync(COMPANY_SIGNALS_OUT, "utf8"));
  } catch {
    previousSignals = {};
  }
  // Signals attach by company alias, and the directory is where every alias
  // lives, so it is built once to supply them and again to carry the result.
  // Without this the OEM and ODM tiers would track nothing. Build the
  // directory from the full server model: the browser Dynamics payload is a
  // deliberately narrow, evidence-qualified view and must not delete company
  // profiles that remain available elsewhere in the console.
  const directoryAliases = buildCompanyDirectory({
    siteContentExtended: fullSiteContent,
    runId,
    generatedAt: payload.updatedAt || quant.updatedAt || null,
  });
  const signalAccounts = [
    ...STRATEGY_ACCOUNT_REGISTRY,
    ...(directoryAliases.profiles || []).map((profile) => ({
      id: profile.id,
      name: profile.name,
      company: profile.name,
      nameKo: profile.nameKo,
      aliases: profile.aliases || [],
      layer: profile.layer,
    })),
  ];
  const companySignals = buildCompanySignals({
    news: payload.news || [],
    accounts: signalAccounts,
    previous: previousSignals,
    now: new Date(payload.updatedAt || Date.now()),
    runId,
  });
  setCompanySignals(companySignals.companies);
  // The technology→memory translation lives once as rules and is applied to
  // whatever the crawl observed, so a new company or term needs no data edit.
  let technologyMemoryMap = { rules: {} };
  try {
    technologyMemoryMap = JSON.parse(readFileSync(resolve(__dirname, "..", "data", "technology-memory-map.json"), "utf8"));
  } catch {
    technologyMemoryMap = { rules: {} };
  }
  const memoryDemand = deriveMemoryDemand({
    signals: companySignals,
    map: technologyMemoryMap,
    runId,
    now: new Date(payload.updatedAt || Date.now()),
  });
  setMemoryDemand(memoryDemand.companies);
  // Which accelerator programmes each account is actually associated with,
  // observed rather than listed, so a second programme or a second supplier
  // appears without anyone editing a file.
  let acceleratorRegistry = { programs: {} };
  let previousSilicon = {};
  try {
    acceleratorRegistry = JSON.parse(readFileSync(resolve(__dirname, "..", "data", "accelerator-programs.json"), "utf8"));
  } catch {
    acceleratorRegistry = { programs: {} };
  }
  try {
    previousSilicon = JSON.parse(readFileSync(SILICON_MAP_OUT, "utf8"));
  } catch {
    previousSilicon = {};
  }
  const siliconMap = buildSiliconMap({
    news: payload.news || [],
    accounts: signalAccounts,
    registry: acceleratorRegistry,
    previous: previousSilicon,
    now: new Date(payload.updatedAt || Date.now()),
    runId,
  });
  setSiliconMap(siliconMap.accounts);
  // 고객 요구 → 메모리 요구 → 제품 → 신규 사업. The middle links are already
  // derived; these are the two ends, from a rule table rather than a
  // paragraph per account.
  let painRules = { rules: [] };
  try {
    painRules = JSON.parse(readFileSync(resolve(__dirname, "..", "data", "pain-point-rules.json"), "utf8"));
  } catch {
    painRules = { rules: [] };
  }
  const painPoints = buildPainPoints({
    silicon: siliconMap.accounts,
    memoryDemand: memoryDemand.companies,
    rules: painRules,
    accounts: signalAccounts,
    now: new Date(payload.updatedAt || Date.now()),
    runId,
  });
  setPainPoints(painPoints.accounts);
  // Publish a complete decision chain only when the account, requirement and
  // source remain connected. This is the single MECE path consumed by the
  // profile UI and insight ledger; suppliers no longer inherit buyer pain.
  const strategyOpportunities = buildStrategyOpportunities({
    accounts: signalAccounts,
    memoryDemand: memoryDemand.companies,
    painPoints: painPoints.accounts,
    now: new Date(payload.updatedAt || Date.now()),
    runId,
  });
  setStrategyOpportunities(strategyOpportunities.accounts);
  // Who holds which chair and what they said, observed rather than listed.
  let previousOrg = {};
  try {
    previousOrg = JSON.parse(readFileSync(ORG_SIGNALS_OUT, "utf8"));
  } catch {
    previousOrg = {};
  }
  const orgSignals = buildOrgSignals({
    news: payload.news || [],
    accounts: signalAccounts,
    previous: previousOrg,
    now: new Date(payload.updatedAt || Date.now()),
    runId,
  });
  setOrgSignals(orgSignals.accounts);
  const companyDirectory = buildCompanyDirectory({
    siteContentExtended: fullSiteContent,
    runId,
    generatedAt: payload.updatedAt || quant.updatedAt || null,
    publicArtifact: true,
  });
  // Carry the previous ledger forward so insights accumulate across crawls
  // instead of resetting to the current seven-day window.
  let previousLedger = {};
  try {
    previousLedger = JSON.parse(readFileSync(INSIGHT_LEDGER_OUT, "utf8"));
  } catch {
    previousLedger = {};
  }
  const insightLedger = buildInsightLedger({
    intelligence: quant.strategyAccountIntelligence || {},
    strategyOpportunities,
    previous: previousLedger,
    now: new Date(payload.updatedAt || quant.updatedAt || Date.now()),
    runId,
  });
  const displayBundle = pruneQuarantinedClientClaims(normalizeKoreanDisplayPayload({
    live,
    quant: clientQuant,
    priceHistory: price,
    marketHistory: market,
    quantBacktest: backtest,
    decisionHistory,
    landingDecision,
    siteContent,
    siteContentExtended,
    insightLedger,
    companySignals,
    memoryDemand,
    siliconMap,
    painPoints,
    strategyOpportunities,
    orgSignals,
    companyDirectory,
  }), blockedClaims.urls, blockedClaims.titles) || {};
  const clientRevision = createHash("sha256")
    .update(JSON.stringify({
      runId,
      landingDecision: displayBundle.landingDecision,
      siteContent: displayBundle.siteContent,
      siteContentExtended: displayBundle.siteContentExtended,
      companyDirectory: displayBundle.companyDirectory,
    }))
    .digest("hex")
    .slice(0, 16);
  const serializedBytes = (value) => Buffer.byteLength(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  const artifacts = {
    live: { path: "data/live-client.json", bytes: serializedBytes(displayBundle.live) },
    quant: { path: "data/quant-client.json", bytes: serializedBytes(displayBundle.quant) },
    priceHistory: { path: "data/price-history-client.json", bytes: serializedBytes(displayBundle.priceHistory) },
    marketHistory: { path: "data/market-history-client.json", bytes: serializedBytes(displayBundle.marketHistory) },
    quantBacktest: { path: "data/quant-backtest-client.json", bytes: serializedBytes(displayBundle.quantBacktest) },
    decisionHistory: { path: "data/decision-history-client.json", bytes: serializedBytes(displayBundle.decisionHistory) },
    landingDecision: { path: "data/landing-decision-client.json", bytes: serializedBytes(displayBundle.landingDecision) },
    siteContent: { path: "data/site-content-client.json", bytes: serializedBytes(displayBundle.siteContent) },
    siteContentExtended: { path: "data/site-content-extended-client.json", bytes: serializedBytes(displayBundle.siteContentExtended) },
    companyDirectory: { path: "data/company-directory-client.json", bytes: serializedBytes(displayBundle.companyDirectory) },
    insightLedger: { path: "data/insight-ledger.json", bytes: serializedBytes(displayBundle.insightLedger) },
    companySignals: { path: "data/company-signals.json", bytes: serializedBytes(displayBundle.companySignals) },
    memoryDemand: { path: "data/memory-demand.json", bytes: serializedBytes(displayBundle.memoryDemand) },
    siliconMap: { path: "data/silicon-map.json", bytes: serializedBytes(displayBundle.siliconMap) },
    painPoints: { path: "data/pain-points.json", bytes: serializedBytes(displayBundle.painPoints) },
    orgSignals: { path: "data/org-signals.json", bytes: serializedBytes(displayBundle.orgSignals) },
  };
  return {
    manifest: {
      schemaVersion: "1.0",
      runId,
      generatedAt: payload.updatedAt || quant.updatedAt || null,
      expiresAt: payload.expiresAt || quant.expiresAt || null,
      cacheVersion: `${runId || "run"}-${clientRevision}`,
      artifacts,
    },
    ...displayBundle,
  };
}

async function writeVerifiedBundle(entries = []) {
  const staged = [];
  try {
    for (const [path, value] of entries) {
      await mkdir(dirname(path), { recursive: true });
      const temporary = `${path}.${process.pid}.${Date.now()}.${staged.length}.tmp`;
      await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8" });
      staged.push({ path, temporary });
    }
    // Client artifacts must exist before their manifest points at them; the
    // full live DB remains the final public commit marker for data consumers.
    const publishRank = (path) => path === OUT ? 2 : path === DATA_MANIFEST_OUT ? 1 : 0;
    staged.sort((a, b) => publishRank(a.path) - publishRank(b.path));
    for (const entry of staged) {
      try {
        await rename(entry.temporary, entry.path);
      } catch (error) {
        if (!["EEXIST", "EPERM", "EACCES"].includes(error?.code)) throw error;
        const body = await readFile(entry.temporary, "utf8");
        await writeFile(entry.path, body, { encoding: "utf8" });
        await rm(entry.temporary, { force: true });
      }
    }
  } catch (error) {
    await Promise.all(staged.map(({ temporary }) => rm(temporary, { force: true })));
    throw error;
  }
}

const BROKER_OFFICIAL_DOMAINS = {
  "morgan-stanley": ["morganstanley.com"],
  "goldman-sachs": ["goldmansachs.com"],
  jpmorgan: ["jpmorgan.com"],
  ubs: ["ubs.com"],
  citi: ["citigroup.com", "citi.com"],
  bofa: ["bofa.com", "bankofamerica.com"],
  jefferies: ["jefferies.com"],
  barclays: ["barclays.com"],
  nomura: ["nomura.com"],
  mizuho: ["mizuho.com"],
  hsbc: ["hsbc.com"],
};

const BROKER_MEMORY_TOPIC_RE = /(?:memory|semiconductor|dram|ddr[345]?|lpddr|hbm|nand|ssd|cxl|pim|hbf|cowos|wafer|메모리|반도체|디램|낸드|存储|記憶體|半导体|半導體|内存|記憶體)/i;
const BROKER_AUTHORITY_RE = /(?:reuters|bloomberg|ft\.com|financial times|nikkei|cnbc|wall street journal|wsj|associated press|apnews|south china morning post|scmp|caixin|digitimes|trendforce|tom's hardware|techinsights)/i;

function brokerText(item = {}) {
  return [item.title, item.titleKo, item.summary, item.summaryOriginal, item.source, item.sourceUrl, item.link]
    .map((value) => String(value || ""))
    .join(" ");
}

function brokerRuleFor(item = {}) {
  const text = brokerText(item).toLowerCase();
  return BROKER_RULES.find((rule) => rule.aliases.some((alias) => {
    const key = alias.toLowerCase();
    if (/^[a-z0-9 .&-]+$/.test(key)) {
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
      return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i").test(text);
    }
    return text.includes(key);
  })) || null;
}

function brokerOfficialSource(rule, value = "") {
  if (!rule) return false;
  try {
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
    return (BROKER_OFFICIAL_DOMAINS[rule.id] || []).some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function brokerTopic(item = {}) {
  const text = brokerText(item).toLowerCase();
  if (/(?:cxmt|ymtc|changxin|yangtze memory|china memory|长鑫|長鑫|长江存储|中國記憶體|中国存储)/i.test(text)) return "china";
  if (/(?:hbm|rubin|cowos|advanced packaging|hybrid bonding|tsv)/i.test(text)) return "hbm";
  if (/(?:nand|ssd|solidigm|hbf|flash)/i.test(text)) return "nand";
  if (/(?:cxl|pim|mrdimm|next-generation memory|next generation memory)/i.test(text)) return "next-memory";
  if (/(?:capex|capacity|wafer|fab|equipment|supply growth|bit growth)/i.test(text)) return "capacity";
  if (/(?:price|pricing|asp|contract|spot|shortage|inventory|cycle|revenue forecast|market forecast)/i.test(text)) return "cycle";
  return "strategy";
}

function brokerTopicFrame(topic) {
  return {
    china: {
      label: "CHINA COMPETITION",
      insight: "SKHY는 중국 업체의 매출·캐파 전망을 범용 DRAM과 NAND 가격 방어, 고객 승인 변화에 연결해 봐야 합니다.",
      reversalKpi: "공식 캐파, 고객 인증, contract 가격",
    },
    hbm: {
      label: "HBM & PACKAGING",
      insight: "SKHY는 점유율 전망보다 고객 인증, HBM4 수율, 베이스 다이와 패키징 병목의 실제 개선 속도를 우선 확인해야 합니다.",
      reversalKpi: "고객 인증, HBM4 수율, 패키징 처리량",
    },
    nand: {
      label: "NAND & eSSD",
      insight: "SKHY는 NAND 전망을 eSSD 고객 믹스, Solidigm 수익성, wafer·contract 가격의 동행 여부로 검증해야 합니다.",
      reversalKpi: "eSSD 고객 믹스, NAND contract 가격, 재고일수",
    },
    "next-memory": {
      label: "NEXT MEMORY",
      insight: "SKHY는 차세대 메모리를 확정 매출이 아닌 고객 샘플, 표준화, 양산 주문을 통과해야 하는 옵션 포트폴리오로 관리해야 합니다.",
      reversalKpi: "표준 채택, 고객 샘플, 양산 주문",
    },
    capacity: {
      label: "CAPACITY & CAPEX",
      insight: "SKHY는 투자액 자체보다 경쟁사의 wafer 투입, 장비 반입, 수율 안정화가 실제 bit growth로 이어지는 시점을 봐야 합니다.",
      reversalKpi: "wafer 투입, 장비 반입, bit growth",
    },
    cycle: {
      label: "CYCLE CHECK",
      insight: "SKHY는 증권사 가격 전망을 공개 contract·spot 가격, 고객 재고와 대조하고 상방·하방 시나리오를 분리해 사용해야 합니다.",
      reversalKpi: "contract·spot spread, 고객 재고, 수요 전망",
    },
    strategy: {
      label: "SECTOR VIEW",
      insight: "SKHY는 증권사 전망을 회사 가이던스와 분리하고 고객, 가격, 공급의 실측 지표가 같은 방향인지 확인해야 합니다.",
      reversalKpi: "고객 주문, 가격, 공급 실측",
    },
  }[topic];
}

function brokerMetrics(item = {}) {
  const text = `${item.titleKo || item.title || ""} ${item.summary || item.summaryOriginal || ""}`;
  const matches = [
    ...text.matchAll(/(?:US\$|\$)\s?\d+(?:\.\d+)?\s?(?:T|B|bn|billion|trillion)\b/gi),
    ...text.matchAll(/\b\d+(?:\.\d+)?\s?(?:~|\-|to)\s?\d+(?:\.\d+)?\s?%|\b\d+(?:\.\d+)?\s?%/gi),
    ...text.matchAll(/\b\d+(?:\.\d+)?\s?(?:조|억)\s?(?:원|위안|달러)/g),
  ].map((match) => match[0].replace(/\s+/g, " ").trim());
  return [...new Set(matches)].slice(0, 2);
}

function brokerResearchHistoryKey(item = {}) {
  const sourceUrl = String(item.sourceUrl || "").toLowerCase().replace(/[?#].*$/, "").replace(/\/$/, "");
  return sourceUrl || String(item.id || `${item.institution || ""}:${item.publishedAt || ""}:${item.title || ""}`).toLowerCase();
}

function validAccumulatedBrokerItem(item = {}) {
  return item.origin === "live-crawl"
    && /^https?:\/\//i.test(String(item.sourceUrl || ""))
    && !/news\.google\.com/i.test(String(item.sourceUrl || ""))
    && /^20\d{2}-\d{2}-\d{2}$/.test(String(item.publishedAt || ""))
    && String(item.title || "").trim()
    && String(item.summary || "").trim().length >= 35
    && new Set(["direct-report", "news-citation"]).has(String(item.evidenceType || ""));
}

export function buildBrokerResearch(news = [], previousBrokerResearch = {}) {
  const generatedAt = new Date().toISOString();
  const citations = news.map((item) => {
    if (item.verification?.origin !== "live-crawl" || item.verification?.observedThisRun !== true) return null;
    const rule = brokerRuleFor(item);
    const sourceUrl = directNewsUrl(item);
    const text = brokerText(item);
    if (!rule || !sourceUrl || !BROKER_MEMORY_TOPIC_RE.test(text)) return null;
    const official = brokerOfficialSource(rule, sourceUrl);
    const authoritativeCitation = BROKER_AUTHORITY_RE.test(`${item.source || ""} ${sourceUrl}`);
    if (!official && !authoritativeCitation) return null;
    const summary = compactArticleSummary(item);
    const title = intelligenceTitle(item);
    if (!title || summary.length < 35) return null;
    const topic = brokerTopic(item);
    const frame = brokerTopicFrame(topic);
    const publishedAt = item.date || item.publishedAt || null;
    const evidenceType = official ? "direct-report" : "news-citation";
    return {
      id: `broker-${rule.id}-${slug(title).slice(0, 72)}`,
      institution: rule.name,
      institutionId: rule.id,
      evidenceType,
      label: frame.label,
      title,
      summary,
      metrics: brokerMetrics(item),
      insight: frame.insight,
      reversalKpi: frame.reversalKpi,
      publishedAt,
      source: item.source || rule.name,
      sourceRef: evidenceType === "direct-report" ? `${rule.name} 공식 발간물` : `${rule.name} 인용 기사`,
      sourceUrl,
      origin: "live-crawl",
      observedThisRun: true,
      validatedAt: item.verification?.validatedAt || generatedAt,
      accent: rule.accent,
    };
  }).filter(Boolean);

  const deduped = [];
  const seen = new Set();
  for (const item of citations.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))) {
    const key = item.sourceUrl.toLowerCase().replace(/[?#].*$/, "").replace(/\/$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  const previousItems = Array.isArray(previousBrokerResearch?.items)
    ? previousBrokerResearch.items.filter(validAccumulatedBrokerItem)
    : [];
  const previousByKey = new Map(previousItems.map((item) => [brokerResearchHistoryKey(item), item]));
  const currentItems = deduped.map((item) => {
    const previous = previousByKey.get(brokerResearchHistoryKey(item));
    return {
      ...item,
      observedThisRun: true,
      firstObservedAt: previous?.firstObservedAt || previous?.validatedAt || previousBrokerResearch?.updatedAt || generatedAt,
      lastObservedAt: generatedAt,
    };
  });
  const merged = new Map(currentItems.map((item) => [brokerResearchHistoryKey(item), item]));
  for (const previous of previousItems) {
    const key = brokerResearchHistoryKey(previous);
    if (merged.has(key)) continue;
    merged.set(key, {
      ...previous,
      observedThisRun: false,
      firstObservedAt: previous.firstObservedAt || previous.validatedAt || previousBrokerResearch?.updatedAt || null,
      lastObservedAt: previous.lastObservedAt || previous.validatedAt || previousBrokerResearch?.updatedAt || null,
    });
  }
  const items = [...merged.values()].sort((a, b) => (
    new Date(b.publishedAt || b.lastObservedAt || 0) - new Date(a.publishedAt || a.lastObservedAt || 0)
  ));
  return {
    schemaVersion: "2.1",
    updatedAt: generatedAt,
    methodology: "공개 원문 URL과 정확한 날짜가 확인된 증권사 공식 발간물·권위 매체 인용을 실행 간 누적하고 중복 URL만 병합함.",
    institutions: [...new Set(items.map((item) => item.institution))],
    reportCount: items.filter((item) => item.evidenceType === "direct-report").length,
    citationCount: items.filter((item) => item.evidenceType === "news-citation").length,
    currentRunCount: currentItems.length,
    accumulatedCount: items.length,
    baseline: {
      status: "revalidation-required",
      documentCount: BROKER_REPORT_DOCUMENTS.length,
      documents: BROKER_REPORT_DOCUMENTS.map((document) => ({
        ...document,
        dataStatus: "provided-document",
        sourceUrl: null,
      })),
      itemCount: BROKER_REPORT_SEEDS.length,
      items: BROKER_REPORT_SEEDS.map((item) => ({
        ...item,
        dataStatus: "baseline-revalidation",
        sourceUrl: null,
        lastCheckedAt: null,
      })),
      asOf: BROKER_RESEARCH_FRAMEWORK.asOf,
      sourceRef: BROKER_RESEARCH_FRAMEWORK.sourceRef,
      lastCheckedAt: null,
      reason: "공개 원문 URL과 이번 실행 관측 기록이 없어 라이브 카드에서 제외",
    },
    framework: {
      ...BROKER_RESEARCH_FRAMEWORK,
      dataStatus: "baseline",
      lastCheckedAt: null,
      revalidationRequired: true,
    },
    items,
  };
}

/* ---------- China public community and hiring signals ---------- */
const COMMUNITY_ENTITY_RE = /(长鑫(?:存储)?|长江存储|长存|武汉新芯|新芯|北方华创|中微公司|华为海思|CXMT|YMTC|XMC|NAURA|AMEC)/i;
const COMMUNITY_MEMORY_RE = /(存储芯片|存储器|内存|半导体|DRAM|DDR[345]|LPDDR|HBM|NAND|SSD|Xtacking|晶圆|良率|制程|工艺|TSV|封装|光刻|刻蚀|设备|材料|校招|招聘|工程师)/i;
const COMMUNITY_WORKPLACE_RE = /(招聘|校招|社招|岗位|职位|薪资|面试|员工|工程师|工艺整合|良率|人才|跳槽|入职|career|job|hiring|yield engineer)/i;
const COMMUNITY_CONSUMER_RE = /(装机|消费者|价格|涨价|降价|颗粒|内存条|固态硬盘|零售|购买|兼容|超频|玩家|retail|consumer|price)/i;
const COMMUNITY_TECH_RE = /(DDR[345]|LPDDR|HBM|NAND|SSD|Xtacking|TSV|封装|工艺|制程|良率|晶圆|光刻|刻蚀|技术|架构|性能|带宽|yield|process|technology)/i;
const COMMUNITY_FORUM_NOISE_RE = /\b(?:expired|for sale|sold|shipping|coupon|deal thread)\b|\$\s*\d+(?:\.\d+)?/i;
const COMMUNITY_BLOCKED_URLS = new Set([
  "https://www.zhihu.com/question/1976016436326581047/answer/2005694488211907035",
]);

function communityPlatform(id = "") {
  return COMMUNITY_PLATFORM_RULES.find((rule) => rule.id === id) || null;
}

function domainMatches(hostname = "", domain = "") {
  const host = String(hostname || "").toLowerCase().replace(/^www\./, "");
  const target = String(domain || "").toLowerCase().replace(/^www\./, "");
  return host === target || host.endsWith(`.${target}`);
}

function communityPlatformForUrl(value = "", preferredId = "") {
  try {
    const host = new URL(value).hostname;
    const preferred = communityPlatform(preferredId);
    if (preferred?.domains.some((domain) => domainMatches(host, domain))) return preferred;
    return COMMUNITY_PLATFORM_RULES.find((rule) => rule.domains.some((domain) => domainMatches(host, domain))) || null;
  } catch {
    return null;
  }
}

function cleanCommunityTitle(value = "", platformLabel = "") {
  let title = stripNewsLabel(stripHTML(value)).replace(/\s+/g, " ").trim();
  const labels = [platformLabel, "雪球", "知乎", "东方财富股吧", "东方财富", "V2EX", "Chiphell", "什么值得买", "NGA", "脉脉", "牛客", "看准", "BOSS直聘", "猎聘", "智联招聘", "EEWorld论坛", "21ic论坛", "面包板论坛", "SemiWiki Forum", "ServeTheHome Forums", "AnandTech Forums", "Reddit"]
    .filter(Boolean)
    .map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (labels.length) title = title.replace(new RegExp(`\\s*(?:[-–—|·]|\\|)\\s*(?:${labels.join("|")})\\s*$`, "i"), "").trim();
  return title.slice(0, 220);
}

function cleanCommunitySummary(value = "", title = "") {
  let summary = stripHTML(value)
    .replace(/\b(?:cached|similar pages?|translate this result)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const normalizedTitle = String(title || "").replace(/\s+/g, " ").trim();
  if (normalizedTitle && summary.toLowerCase().startsWith(normalizedTitle.toLowerCase())) {
    summary = summary.slice(normalizedTitle.length).replace(/^\s*[-–—:：|·]+\s*/, "").trim();
  }
  return summary.slice(0, 520);
}

function communityTypeFor(text = "", fallback = "market") {
  if (COMMUNITY_WORKPLACE_RE.test(text)) return "workplace";
  if (COMMUNITY_CONSUMER_RE.test(text)) return "consumer";
  if (COMMUNITY_TECH_RE.test(text)) return "technology";
  return fallback || "market";
}

function communityTypeLabel(type = "") {
  return ({
    workplace: "직장·채용",
    technology: "기술·제품",
    market: "투자·산업",
    consumer: "소비자 체감",
  })[type] || "현장 신호";
}

function communityEntities(text = "") {
  const entities = [];
  const add = (label, re) => { if (re.test(text) && !entities.includes(label)) entities.push(label); };
  add("CXMT", /长鑫(?:存储)?|CXMT/i);
  add("YMTC", /长江存储|长存|YMTC/i);
  add("XMC", /武汉新芯|新芯|XMC/i);
  add("Naura", /北方华创|NAURA/i);
  add("AMEC", /中微公司|AMEC/i);
  add("Huawei", /华为|海思|Huawei|HiSilicon/i);
  return entities;
}

function communityTopics(text = "", type = "market") {
  const topics = [];
  const add = (label, re) => { if (re.test(text) && !topics.includes(label)) topics.push(label); };
  add("DRAM", /DRAM|DDR[345]|LPDDR|长鑫/i);
  add("NAND", /NAND|SSD|Xtacking|长江存储|长存/i);
  add("HBM", /HBM|TSV|高带宽/i);
  add("패키징", /封装|TSV|堆叠|hybrid bonding/i);
  add("장비·소재", /设备|材料|光刻|刻蚀|北方华创|中微公司/i);
  if (type === "workplace") topics.push("채용");
  if (type === "consumer") topics.push("가격·가용성");
  return Array.from(new Set(topics)).slice(0, 4);
}

function communityInsight(type = "market", text = "") {
  if (type === "workplace" && /(良率|工艺整合|失效分析|量测|CVD|制程|yield|process)/i.test(text)) {
    return "공정 통합·불량 분석·계측 직무의 반복은 양산 안정화 병목이 어디에 남아 있는지 보여주는 보조 신호입니다. 실제 수율은 공시·제품 원가·고객 인증으로 별도 검증합니다.";
  }
  if (type === "workplace" && /(封装|测试|TSV|混合键合|hybrid bonding)/i.test(text)) {
    return "패키징·테스트 직무가 장기간 함께 늘어나는지 확인해 NAND·HBM 후공정 내재화 방향을 판단합니다. 공개 채용만으로 설비 캐파나 양산 진입을 확정하지 않습니다.";
  }
  if (type === "workplace" && /(设备|厂务|气体|刻蚀|薄膜|北方华创|中微公司)/i.test(text)) {
    return "장비·Fab 유틸리티 직무는 생산 운영과 현장 서비스 역량의 보조 신호입니다. 고객 반복 발주와 qualification 근거가 붙을 때만 장비 대체 위험을 상향합니다.";
  }
  if (type === "technology" && /(长鑫|CXMT).*(DDR5|LPDDR)|(?:DDR5|LPDDR).*(长鑫|CXMT)/i.test(text)) {
    return "플랫폼 호환성과 고클럭 시연은 제품 인식 개선 신호지만 수율·비트 원가를 증명하지 않습니다. OEM 인증, 모듈 ASP, 반품률이 함께 개선되는지 확인합니다.";
  }
  if (type === "technology" && /(长江存储|长存|YMTC).*(SSD|NAND|Xtacking)|(?:SSD|NAND|Xtacking).*(长江存储|长存|YMTC)/i.test(text)) {
    return "YMTC 제품 신호는 컨트롤러·NAND 세대, 펌웨어 안정성, 채널 재고, 기업 고객 인증으로 분해해 SKHY eSSD 방어 우선순위에 반영합니다.";
  }
  if (/(北方华创|中微公司|NAURA|AMEC)/i.test(text)) {
    return "중국 장비 업체의 기술·인력 신호는 반복 발주와 고객 qualification을 확인하기 전까지 공급망 관심 변화로만 사용합니다.";
  }
  return ({
    workplace: "직무·공정 키워드의 반복 빈도로 기술 병목을 추적하되, 실제 채용 인원과 프로젝트 규모는 공식 공시로 확인합니다.",
    technology: "사용자 기술 논쟁은 제품 인식과 병목의 약한 신호로만 사용하고 수율·성능 수치는 공식 자료로 교차 검증합니다.",
    market: "반복 언급되는 기업·장비·자금 흐름을 관심 변화로 추적하되 계약·캐파·점유율은 사실 근거로 승격하지 않습니다.",
    consumer: "소비자 가격·가용성 체감은 유통 재고의 보조 신호로 보고 실제 Spot·Contract 시계열과 함께 판단합니다.",
  })[type] || "반복 빈도와 방향만 현장 신호로 사용하고 수치·사실은 공식 원문으로 검증합니다.";
}

function communityValidation(type = "market", text = "") {
  if (type === "workplace") return "활성 직무 수 · 직무 믹스 · 근무지 · 재게시 주기";
  if (type === "market") return "공식 CAPEX·투자 공시 · 고객 계약 · 캐파 · 매출·점유율";
  if (/(长鑫|CXMT).*(DDR5|LPDDR)|(?:DDR5|LPDDR).*(长鑫|CXMT)/i.test(text)) return "OEM 인증 · 모듈 ASP · 장기 안정성 · 반품률";
  if (/(长江存储|长存|YMTC).*(SSD|NAND|Xtacking)|(?:SSD|NAND|Xtacking).*(长江存储|长存|YMTC)/i.test(text)) return "NAND/컨트롤러 세대 · 채널 재고 · 펌웨어 · 고객 인증";
  if (/(北方华创|中微公司|NAURA|AMEC)/i.test(text)) return "고객 qualification · 반복 발주 · 서비스 거점 · 국산 장비 비중";
  if (type === "consumer") return "소매가 · 재고 · 후기 반복 빈도 · Spot/Contract spread";
  return "공식 공시 · 설비 발주 · 고객 계약 · 동일 신호 반복 여부";
}

function communityScore(item = {}) {
  const ageDays = item.ts ? Math.max(0, (Date.now() - item.ts) / 864e5) : COMMUNITY_RETENTION_DAYS;
  const recency = Math.max(0, 24 - Math.min(24, ageDays / 15));
  const sourceWeight = item.sourceClass === "official-career" ? 18 : item.sourceClass === "job-board" ? 10 : item.sourceClass === "expert-community" ? 7 : 4;
  const entityWeight = Math.min(12, (item.entities || []).length * 4);
  const contentWeight = Math.min(16, Math.floor(String(item.summaryOriginal || item.summary || "").length / 28));
  return Math.round(Math.min(100, 38 + recency + sourceWeight + entityWeight + contentWeight));
}

function communityStableId(value = "") {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `cn-${(hash >>> 0).toString(36)}`;
}

function communityKey(item = {}) {
  const normalizedTitle = String(item.title || item.titleKo || "").toLowerCase().replace(/[^a-z0-9一-鿿가-힣]+/g, "").slice(0, 140);
  if (item.sourceClass === "expert-community" && normalizedTitle) {
    return `expert-title:${item.platformId || "forum"}:${normalizedTitle}`;
  }
  const url = sanitizeSourceUrl(item.link || item.sourceUrl || "");
  if (url) {
    try {
      const parsed = new URL(url);
      parsed.hash = "";
      parsed.pathname = parsed.pathname.replace(/\/post-\d+\/?$/i, "").replace(/\/$/, "");
      return `url:${parsed.toString().toLowerCase()}`;
    } catch {
      return `url:${url.replace(/\/$/, "").toLowerCase()}`;
    }
  }
  return `title:${normalizedTitle.slice(0, 120)}`;
}

function communityEvidence(rule = {}) {
  if (rule.sourceClass === "official-career") return { evidenceLevel: "공개 채용", verification: "Public listing" };
  if (rule.sourceClass === "job-board") return { evidenceLevel: "공개 채용", verification: "Listing signal" };
  return { evidenceLevel: "커뮤니티 신호", verification: "Unverified" };
}

function normalizeCommunityItem(item = {}, preferredPlatformId = "") {
  const sourceUrl = sanitizeSourceUrl(item.link || item.sourceUrl || "");
  if (COMMUNITY_BLOCKED_URLS.has(sourceUrl.replace(/\/$/, ""))) return null;
  const rule = communityPlatformForUrl(sourceUrl, preferredPlatformId || item.platformId);
  if (!sourceUrl || !rule) return null;
  const title = cleanCommunityTitle(item.title, rule.label);
  const summaryOriginal = cleanCommunitySummary(item.rssDescription || item.summaryOriginal || "", title);
  const combined = `${title} ${summaryOriginal}`;
  if (rule.sourceClass === "expert-community" && COMMUNITY_FORUM_NOISE_RE.test(title)) return null;
  const path = new URL(sourceUrl).pathname.replace(/\/$/, "");
  const genericCareerPortal = rule.sourceClass === "official-career" && /\/(?:join\.html|social|campus|campus\/jobs)$/i.test(path);
  const hasCareerSignal = /(招聘|校招|社招|岗位|职位|工程师|研发|工艺|设备|良率|career|careers|job|jobs|hiring|engineer|process|yield)/i.test(combined);
  if (genericCareerPortal && !/(工程师|工艺|设备|研发|良率|岗位|职位|engineer|process|yield)/i.test(combined)) return null;
  if (rule.sourceClass === "official-career" && !hasCareerSignal) return null;
  if (!COMMUNITY_ENTITY_RE.test(combined) || !COMMUNITY_MEMORY_RE.test(combined)) return null;
  if (summaryOriginal.length < 28) return null;
  const type = communityTypeFor(combined, rule.defaultType);
  const observedAt = item.observedAt || "";
  const ts = new Date(item.pubDate || item.date || item.publishedAt || observedAt || 0).getTime() || 0;
  const evidence = communityEvidence(rule);
  const normalized = {
    id: communityStableId(sourceUrl || title),
    platformId: rule.id,
    platform: rule.label,
    sourceClass: rule.sourceClass,
    type,
    typeLabel: communityTypeLabel(type),
    title,
    titleKo: item.titleKo || "",
    summaryOriginal,
    summary: item.summary || "",
    insight: item.insight || communityInsight(type, combined),
    validation: item.validation || communityValidation(type, combined),
    link: sourceUrl,
    sourceUrl,
    date: ymd(item.pubDate || item.date || item.publishedAt || observedAt),
    observedAt: observedAt ? ymd(observedAt) : "",
    period: item.period || "",
    ts,
    crawledAt: new Date().toISOString(),
    entities: communityEntities(combined),
    topics: communityTopics(combined, type),
    historical: Boolean(item.historical || (ts && Date.now() - ts > 90 * 864e5)),
    importance: Number(item.importance || 0),
    ...evidence,
  };
  normalized.score = communityScore(normalized);
  return normalized;
}

function normalizeCommunitySeed(seed = {}) {
  const rule = communityPlatform(seed.platformId);
  const sourceUrl = sanitizeSourceUrl(seed.link || seed.sourceUrl || "");
  if (!rule || !sourceUrl) return null;
  const type = seed.type || rule.defaultType;
  const combined = `${seed.title || ""} ${seed.titleKo || ""} ${seed.summary || ""}`;
  const observedAt = seed.observedAt || "";
  const ts = new Date(seed.date || observedAt || 0).getTime() || 0;
  const evidence = communityEvidence(rule);
  const item = {
    id: communityStableId(sourceUrl),
    platformId: rule.id,
    platform: rule.label,
    sourceClass: rule.sourceClass,
    type,
    typeLabel: communityTypeLabel(type),
    title: seed.title || seed.titleKo || "",
    titleKo: seed.titleKo || "",
    summaryOriginal: "",
    summary: seed.summary || "",
    insight: seed.insight || communityInsight(type, combined),
    validation: seed.validation || communityValidation(type, combined),
    link: sourceUrl,
    sourceUrl,
    date: seed.date || "",
    observedAt: observedAt ? ymd(observedAt) : "",
    period: seed.period || "",
    ts,
    crawledAt: new Date().toISOString(),
    entities: communityEntities(combined),
    topics: communityTopics(combined, type),
    historical: seed.historical !== false,
    importance: Number(seed.importance || 75),
    origin: "curated-seed",
    observedThisRun: false,
    dataStatus: "reference-only",
    ...evidence,
  };
  item.score = Math.max(communityScore(item), item.importance);
  return item;
}

function communitySignalProvenance(item = {}, origin = "unclassified", observedThisRun = false) {
  const isLive = origin === "live-crawl" && observedThisRun === true;
  return {
    ...item,
    origin,
    observedThisRun: isLive,
    dataStatus: isLive ? "live-observed" : "reference-only",
  };
}

function isVerifiedCommunityLiveItem(item = {}) {
  const sourceUrl = sanitizeSourceUrl(item.sourceUrl || item.link || "");
  return item.origin === "live-crawl"
    && item.observedThisRun === true
    && item.dataStatus === "live-observed"
    && validHttpUrl(sourceUrl)
    && !/news\.google\.com/i.test(sourceUrl);
}

function mergeCommunityItems(first = {}, second = {}) {
  const firstContent = String(first.summary || first.summaryOriginal || "").length + (first.titleKo ? 80 : 0);
  const secondContent = String(second.summary || second.summaryOriginal || "").length + (second.titleKo ? 80 : 0);
  const primary = secondContent > firstContent ? second : first;
  const other = primary === first ? second : first;
  return {
    ...other,
    ...primary,
    titleKo: primary.titleKo || other.titleKo || "",
    summary: primary.summary || other.summary || "",
    summaryOriginal: primary.summaryOriginal || other.summaryOriginal || "",
    date: primary.date || other.date || "",
    period: primary.period || other.period || "",
    observedAt: primary.observedAt || other.observedAt || "",
    validation: primary.validation || other.validation || "",
    ts: Math.max(Number(primary.ts || 0), Number(other.ts || 0)),
    historical: Boolean(primary.historical || other.historical),
    importance: Math.max(Number(primary.importance || 0), Number(other.importance || 0)),
    score: Math.max(Number(primary.score || 0), Number(other.score || 0)),
  };
}

async function fetchBingCommunity(query = "", locale = "zh") {
  const edition = locale === "en"
    ? { setlang: "en-US", mkt: "en-US" }
    : { setlang: "zh-Hans", mkt: "zh-CN" };
  const url = `https://www.bing.com/search?format=rss&setlang=${edition.setlang}&mkt=${edition.mkt}&count=20&q=${encodeURIComponent(query)}`;
  const xml = await fetchText(url);
  return parseRSS(xml);
}

function parseXenForoCommunitySearch(html = "", baseUrl = "") {
  const items = [];
  const source = String(html);
  const starts = Array.from(source.matchAll(/<li\b[^>]*class=["'][^"']*block-row[^"']*["'][^>]*>/gi));
  const rows = starts.map((match, index) => source.slice(match.index, starts[index + 1]?.index ?? source.length));
  for (const row of rows) {
    const titleBlock = row.match(/<h3\b[^>]*class=["'][^"']*contentRow-title[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i)?.[1] || "";
    const anchor = titleBlock.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!anchor) continue;
    const title = stripHTML(anchor[2]).replace(/\s+/g, " ").trim();
    const summary = stripHTML(row.match(/<div\b[^>]*class=["'][^"']*contentRow-snippet[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || "")
      .replace(/\s+/g, " ")
      .trim();
    const epoch = Number(row.match(/<time\b[^>]*data-time=["'](\d+)["']/i)?.[1] || 0);
    let link = "";
    try {
      link = new URL(anchor[1], baseUrl).toString();
    } catch {
      continue;
    }
    items.push({
      title,
      link,
      rssDescription: summary,
      pubDate: epoch ? new Date(epoch * 1000).toISOString() : "",
    });
  }
  return items;
}

async function fetchDirectCommunitySearch(target = {}) {
  const html = await fetchText(target.url);
  return parseXenForoCommunitySearch(html, target.url);
}

function buildCommunityBriefs(items = []) {
  const definitions = [
    {
      id: "yield-talent",
      title: "공정·수율 인력",
      match: (item) => item.type === "workplace" && /(良率|工艺|失效|量测|CVD|制程|공정|수율)/i.test(`${item.title} ${item.summary} ${(item.topics || []).join(" ")}`),
      signal: "공정 통합·불량 분석·계측·라인 운영 직무가 반복되는지 관찰",
      implication: "SKHY는 핵심 수율 인력 리텐션과 중국 DRAM 양산 안정화 속도를 같은 인력 리스크 보드에서 검토",
      validation: "활성 JD 수 · 직무 믹스 · 지역 · 재게시 주기",
    },
    {
      id: "product-validation",
      title: "제품·호환성 검증",
      match: (item) => item.type === "technology" || item.type === "consumer",
      signal: "DDR5 플랫폼 호환성과 NAND·eSSD 제품 노출을 구분해 관찰",
      implication: "SKHY는 시연 성능보다 OEM 인증·가격·펌웨어·반복 수주가 붙는 시점을 경쟁 강도 상향 조건으로 사용",
      validation: "OEM 인증 · ASP · 펌웨어 · 반품률 · 반복 수주",
    },
    {
      id: "equipment-localization",
      title: "장비·현장 서비스",
      match: (item) => /(北方华创|中微公司|NAURA|AMEC|设备|刻蚀|薄膜|TSV|장비|식각)/i.test(`${item.title} ${item.summary} ${(item.entities || []).join(" ")} ${(item.topics || []).join(" ")}`),
      signal: "식각·TSV·Fab 유틸리티 인력과 장비 토론의 동시 증가 여부를 관찰",
      implication: "SKHY는 채용 신호를 장비 대체율로 환산하지 않고 고객 qualification·반복 발주가 확인될 때 공급망 시나리오를 변경",
      validation: "고객 qualification · 반복 발주 · 서비스 거점 · 장비 비중",
    },
    {
      id: "capital-attention",
      title: "자본·산업 관심",
      match: (item) => item.type === "market",
      signal: "IPO·증설·공급망 기업의 반복 언급으로 시장 관심의 방향만 관찰",
      implication: "SKHY는 커뮤니티 기대를 캐파 사실로 승격하지 않고 거래소 공시와 장비 발주로 교차 확인",
      validation: "거래소 공시 · 자금 용도 · 설비 발주 · 고객 계약",
    },
  ];
  return definitions.map((definition) => {
    const matched = items.filter(definition.match);
    const latestAt = matched.reduce((latest, item) => Math.max(latest, Number(item.ts || 0)), 0);
    return {
      id: definition.id,
      title: definition.title,
      count: matched.length,
      sourceCount: new Set(matched.map((item) => item.platformId).filter(Boolean)).size,
      recent30d: matched.filter((item) => item.ts && Date.now() - item.ts <= 30 * 864e5).length,
      latestAt: latestAt ? new Date(latestAt).toISOString() : null,
      signal: definition.signal,
      implication: definition.implication,
      validation: definition.validation,
    };
  }).filter((brief) => brief.count > 0);
}

async function collectCommunitySignals(previousItems = []) {
  const discovered = [];
  for (const target of COMMUNITY_DIRECT_SEARCHES) {
    try {
      const results = await fetchDirectCommunitySearch(target);
      results.forEach((result) => {
        const item = normalizeCommunityItem(result, target.platformId);
        if (item) discovered.push(communitySignalProvenance(item, "live-crawl", true));
      });
    } catch (error) {
      console.log(`- 중국현장:${target.platformId} 직접 수집 지연 — ${error.message}`);
    }
    await sleep(180);
  }
  for (const target of COMMUNITY_DISCOVERY_QUERIES) {
    try {
      const results = await fetchBingCommunity(target.query, target.locale || "zh");
      results.forEach((result) => {
        const item = normalizeCommunityItem(result, target.platformId);
        if (item) discovered.push(communitySignalProvenance(item, "live-crawl", true));
      });
    } catch (error) {
      console.log(`- 중국현장:${target.platformId} 검색 지연 — ${error.message}`);
    }
    await sleep(180);
  }

  const previous = (previousItems || []).map((item) => {
    const normalized = normalizeCommunityItem({
      ...item,
      rssDescription: item.summaryOriginal || item.summary || "",
      pubDate: item.date || item.publishedAt || "",
    }, item.platformId);
    return normalized ? communitySignalProvenance(normalized, "previous-run", false) : null;
  }).filter(Boolean);
  const seeds = COMMUNITY_HISTORY_SEEDS.map(normalizeCommunitySeed).filter(Boolean);
  const liveByKey = new Map();
  discovered.forEach((item) => {
    const key = communityKey(item);
    if (!key) return;
    const merged = liveByKey.has(key) ? mergeCommunityItems(liveByKey.get(key), item) : item;
    liveByKey.set(key, communitySignalProvenance(merged, "live-crawl", true));
  });
  const referenceByKey = new Map();
  [...seeds, ...previous].forEach((item) => {
    const key = communityKey(item);
    if (!key) return;
    const existing = referenceByKey.get(key);
    const merged = existing ? mergeCommunityItems(existing, item) : item;
    const origins = Array.from(new Set([
      ...(existing?.referenceOrigins || [existing?.origin]),
      ...(item.referenceOrigins || [item.origin]),
    ].filter(Boolean)));
    referenceByKey.set(key, {
      ...communitySignalProvenance(merged, origins.includes("previous-run") ? "previous-run" : "curated-seed", false),
      referenceOrigins: origins,
    });
  });

  const retentionCutoff = Date.now() - COMMUNITY_RETENTION_DAYS * 864e5;
  const items = Array.from(liveByKey.values())
    .filter((item) => !isCrawlerExcluded("community", item))
    .filter((item) => !item.ts || item.ts >= retentionCutoff || item.importance >= 70)
    .sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0) || Number(b.score || 0) - Number(a.score || 0))
    .slice(0, COMMUNITY_MAX_ITEMS);
  const referenceItems = Array.from(referenceByKey.values())
    .filter((item) => !isCrawlerExcluded("community", item))
    .filter((item) => !item.ts || item.ts >= retentionCutoff || item.importance >= 70)
    .sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0) || Number(b.score || 0) - Number(a.score || 0))
    .slice(0, COMMUNITY_MAX_ITEMS);
  const typeCounts = Object.fromEntries(["workplace", "technology", "market", "consumer"]
    .map((type) => [type, items.filter((item) => item.type === type).length])
    .filter(([, count]) => count > 0));
  const platformCounts = Object.fromEntries(COMMUNITY_PLATFORM_RULES
    .map((rule) => [rule.id, items.filter((item) => item.platformId === rule.id).length])
    .filter(([, count]) => count > 0));
  const latestAt = items.reduce((latest, item) => Math.max(latest, Number(item.ts || 0)), 0);
  note("중국현장신호", items.length >= 5, `이번 실행 ${items.length}건 · ${Object.keys(platformCounts).length}개 공개 채널 · 참고 아카이브 ${referenceItems.length}건`);
  return {
    schemaVersion: "2.0-live-observed-only",
    mode: "live-observed-only",
    updatedAt: new Date().toISOString(),
    latestPublishedAt: latestAt ? new Date(latestAt).toISOString() : null,
    source: "Public Chinese forums · expert communities · public hiring listings · Bing Web Search RSS discovery",
    total: items.length,
    recent30d: items.filter((item) => item.ts && Date.now() - item.ts <= 30 * 864e5).length,
    historicalCount: items.filter((item) => item.historical).length,
    sourceCount: Object.keys(platformCounts).length,
    typeCounts,
    platformCounts,
    briefs: buildCommunityBriefs(items),
    items,
    referenceArchive: {
      schemaVersion: "1.0",
      mode: "reference-only",
      itemCount: referenceItems.length,
      methodology: "curated seeds and previous-run continuity copies; excluded from live counts, briefs, quality thresholds, and quantitative drivers",
      items: referenceItems,
    },
  };
}

/* ---------- competitor and startup radar ---------- */
function countThemes(items, words) {
  const themes = words.map((word) => ({ label: word, count: 0 }));
  for (const item of items) {
    const lower = item.title.toLowerCase();
    for (const theme of themes) {
      if (lower.includes(theme.label.toLowerCase())) theme.count += 1;
    }
  }
  return themes.filter((theme) => theme.count > 0).sort((a, b) => b.count - a.count).slice(0, 5);
}

async function collectEntityItems(entity) {
  const seen = new Set();
  const items = [];
  for (const query of entity.queries) {
    try {
      const queryItems = await fetchGoogleNews(query, entity.id);
      for (const item of queryItems) {
        if (isCrawlerExcluded("news", item)) continue;
        const key = item.title.replace(/\s+/g, " ").toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        items.push(item);
      }
    } catch (error) {
      note(`레이더:${entity.label || entity.name}/${query}`, false, error.message);
    }
    await sleep(300);
  }
  items.sort((a, b) => b.ts - a.ts);
  return items;
}

async function collectCompetitors() {
  const competitors = [];
  for (const competitor of COMPETITORS) {
    const items = await collectEntityItems(competitor);
    const stats = newsStats(items);
    const themes = countThemes(items, competitor.watchWords);
    const pressureScore = Math.min(
      100,
      competitor.pressureBase + Math.min(45, stats.total * 2) + Math.min(20, stats.total24h * 4) + themes.length * 3,
    );
    if (!items.length) {
      note(`경쟁사:${competitor.shortLabel}`, false, `${items.length}건 / score ${pressureScore}`);
      continue;
    }
    competitors.push({
      ...competitor,
      pressureScore,
      stats,
      themes,
      recentNews: items.slice(0, 5).map(({ ts, category, ...rest }) => rest),
    });
    note(`경쟁사:${competitor.shortLabel}`, items.length > 0, `${items.length}건 / score ${pressureScore}`);
  }
  competitors.sort((a, b) => b.pressureScore - a.pressureScore);
  return {
    updatedAt: new Date().toISOString(),
    competitors,
  };
}

async function collectStartups() {
  const candidates = [];
  for (const startup of STARTUPS) {
    const entity = { id: startup.id, label: startup.name, queries: startup.queries };
    const items = await collectEntityItems(entity);
    const stats = newsStats(items);
    const themes = countThemes(items, startup.tags.concat(["funding", "partnership", "customer", "CXL", "HBM"]));
    const momentum = Math.min(18, stats.total * 1.5) + Math.min(12, stats.total24h * 4) + themes.length * 1.5;
    const score = Math.min(100, Math.round(startup.fitScore + momentum));
    if (!items.length) {
      note(`스타트업:${startup.name}`, true, `${items.length}건 / score ${score}`);
      continue;
    }
    candidates.push({
      ...startup,
      score,
      momentum: Math.round(momentum),
      status: score >= 90 ? "우선 검토" : score >= 80 ? "공동 PoC" : score >= 72 ? "관찰 강화" : "장기 옵션",
      stats,
      themes,
      recentNews: items.slice(0, 4).map(({ ts, category, ...rest }) => rest),
    });
    note(`스타트업:${startup.name}`, true, `${items.length}건 / score ${score}`);
  }
  candidates.sort((a, b) => b.score - a.score);
  return {
    updatedAt: new Date().toISOString(),
    candidates,
    methodology: "정적 전략 적합도에 최근 30일 뉴스 모멘텀을 더한 내부 검토용 점수입니다.",
  };
}

/* ---------- benchmark signal stream (foreign press) ---------- */
function normalizeBenchmarkSeed(seed = {}) {
  const link = String(seed.link || seed.sourceUrl || "").trim();
  const date = ymd(seed.date || seed.publishedAt || "");
  if (!seed.themeId || !seed.title || !link || !date) return null;
  return {
    themeId: seed.themeId,
    title: seed.title,
    originalTitle: seed.title,
    titleKo: seed.titleKo || "",
    summary: seed.summary || "",
    insight: seed.insight || "",
    validation: seed.validation || "",
    source: seed.source || "",
    sourceType: seed.sourceType || "외신",
    evidenceLevel: seed.evidenceLevel || "Reported",
    claimType: "보도·분석",
    link,
    sourceUrl: link,
    date,
    ts: new Date(`${date}T00:00:00Z`).getTime() || 0,
    category: seed.themeId,
    language: "english",
    streamLanguage: "english",
    languageVerified: true,
    preservedSeed: true,
    origin: "curated-seed",
    observedThisRun: false,
    dataStatus: "reference-only",
  };
}

function benchmarkDirectSourceUrl(item = {}) {
  const sourceUrl = sanitizeSourceUrl(item.sourceUrl || item.link || "");
  return sourceUrl && !/news\.google\.com/i.test(sourceUrl) ? sourceUrl : "";
}

function isVerifiedBenchmarkLiveItem(item = {}) {
  return item.origin === "live-crawl"
    && item.observedThisRun === true
    && item.dataStatus === "live-observed"
    && item.summarySource === "source-meta"
    && Boolean(benchmarkDirectSourceUrl(item))
    && isCompleteArticleSummary(item.summaryOriginal || "")
    && !supersededNumericClaimReason(item);
}

function benchmarkDiscoveryOnly(item = {}, reason = "source-not-revalidated") {
  return {
    ...item,
    origin: "search-discovery",
    observedThisRun: false,
    discoveredThisRun: true,
    dataStatus: "discovery-only",
    discoveryReason: reason,
  };
}

async function collectBenchmarkSignals() {
  const candidateSeen = new Set();
  const referenceSeen = new Set();
  const themes = [];
  let stream = [];
  const referenceItems = [];
  const discoveryItems = [];

  for (const seed of BENCHMARK_SIGNAL_SEEDS) {
    const item = normalizeBenchmarkSeed(seed);
    if (!item || isCrawlerExcluded("news", item)) continue;
    const key = canonicalNewsKey(item);
    if (!key || referenceSeen.has(key)) continue;
    referenceSeen.add(key);
    referenceItems.push(item);
  }

  for (const theme of BENCHMARK_SIGNAL_THEMES) {
    const items = [];
    for (const query of theme.queries) {
      try {
        const queryItems = await fetchGoogleNews(query, theme.id);
        for (const item of queryItems) {
          if (isCrawlerExcluded("news", item)) continue;
          const key = canonicalNewsKey(item);
          if (!key || candidateSeen.has(key)) continue;
          candidateSeen.add(key);
          items.push(item);
        }
      } catch (error) {
        note(`벤치마킹:${theme.label}/${query}`, false, error.message);
      }
      await sleep(320);
    }
    items.sort((a, b) => b.ts - a.ts);
    const enrichmentLimit = Math.min(18, items.length);
    // Benchmark discovery has its own theme-level health result below.
    // Individual candidates that lack direct-source metadata are quarantined
    // as discovery-only and must not inflate the dashboard-wide source-failure
    // count before that theme-level decision is made.
    const enriched = await enrichNewsItems(items.slice(0, enrichmentLimit), [], { emitHealth: false });
    const validatedItems = [];
    let supersededCount = 0;
    for (const item of enriched) {
      const supersededReason = supersededNumericClaimReason(item);
      if (supersededReason) {
        // Do not carry an obsolete amount into the benchmark stream, agent
        // corpus, or discovery archive once a newer primary-source document
        // resolves the same transaction.
        supersededCount += 1;
        note(`벤치마킹:${theme.label}:superseded`, true, supersededReason);
        continue;
      }
      const sourceUrl = benchmarkDirectSourceUrl(item);
      const hasCurrentSourceSummary = item.summarySource === "source-meta"
        && sourceUrl
        && isCompleteArticleSummary(item.summaryOriginal || "");
      if (!hasCurrentSourceSummary) {
        discoveryItems.push(benchmarkDiscoveryOnly(item, sourceUrl ? "source-summary-unavailable" : "indirect-source-url"));
        continue;
      }
      validatedItems.push({
        ...item,
        sourceUrl,
        link: sourceUrl,
        origin: "live-crawl",
        observedThisRun: true,
        dataStatus: "live-observed",
        preservedSeed: false,
        crawledAt: new Date().toISOString(),
      });
    }
    for (const item of items.slice(enrichmentLimit)) {
      discoveryItems.push(benchmarkDiscoveryOnly(item, "not-source-revalidated"));
    }
    if (validatedItems.length > 0) {
      themes.push({
        id: theme.id,
        label: theme.label,
        count: validatedItems.length,
        items: validatedItems.slice(0, 10).map(({ ts, category, ...rest }) => rest),
      });
      stream = stream.concat(validatedItems);
      note(`벤치마킹:${theme.label}`, true, `원문 재검증 ${validatedItems.length}건 · 발견 전용 ${items.length - validatedItems.length - supersededCount}건 · 최신값 대체 ${supersededCount}건`);
    } else {
      note(`벤치마킹:${theme.label}`, false, `원문 재검증 0건 · 발견 전용 ${items.length - supersededCount}건 · 최신값 대체 ${supersededCount}건`);
    }
  }

  stream.sort((a, b) => b.ts - a.ts);
  return {
    schemaVersion: "2.0-live-observed-only",
    mode: "live-observed-only",
    updatedAt: new Date().toISOString(),
    themes,
    stream: stream.slice(0, 40).map(({ ts, category, ...rest }) => ({ ...rest, theme: category || "" })),
    stats: newsStats(stream),
    referenceArchive: {
      schemaVersion: "1.0",
      mode: "reference-only",
      itemCount: referenceItems.length,
      methodology: "curated benchmark seeds; excluded from live stream, theme counts, stats, briefs, quality thresholds, and quantitative drivers",
      items: referenceItems.map(({ ts, category, ...rest }) => ({ ...rest, theme: category || "" })),
    },
    discoveryArchive: {
      schemaVersion: "1.0",
      mode: "discovery-only",
      itemCount: discoveryItems.length,
      methodology: "current-run search results whose direct source page and source summary were not both revalidated; excluded from live stream, theme counts, stats, briefs, quality thresholds, and quantitative drivers",
      items: discoveryItems
        .sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0))
        .slice(0, 120)
        .map(({ ts, category, ...rest }) => ({ ...rest, theme: category || "" })),
    },
  };
}

function isTransientSourceError(error) {
  const message = String(error?.message || error || "");
  return error?.name === "AbortError"
    || error?.name === "TimeoutError"
    || /(?:fetch failed|network|socket|econn|etimedout|enotfound|HTTP (?:408|425|429|5\d\d))/i.test(message);
}

// fetchText already retries one transient transport failure.  Source pages
// that are important to the dashboard can request a small number of complete
// recovery cycles so an isolated CDN reset does not turn a verified public
// record into a failed source-health event.
export async function fetchSourceTextWithRetry(source = {}, {
  fetchTextImpl = fetchText,
  sleepImpl = sleep,
} = {}) {
  const urls = [source.url, ...(Array.isArray(source.fallbackUrls) ? source.fallbackUrls : [])]
    .map((value) => String(value || "").trim())
    .filter((value, index, values) => value && values.indexOf(value) === index);
  if (!urls.length) throw new Error("source URL missing");
  const maxAttempts = Math.max(1, Math.min(3, Number(source.retryAttempts || 1)));
  let lastError;
  let totalAttempts = 0;
  for (const url of urls) {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      totalAttempts += 1;
      try {
        return { html: await fetchTextImpl(url), attempts: totalAttempts, url };
      } catch (error) {
        lastError = error;
        if (!isTransientSourceError(error) || attempt === maxAttempts - 1) break;
        await sleepImpl(550 * (attempt + 1));
      }
    }
  }
  throw lastError || new Error("source fetch failed");
}

function currentDecisionDocuments(context = {}) {
  const rows = [
    ...(context.news || []).map((item) => ({
      sourceId: catalogSourceForUrl(directNewsUrl(item), SOURCE_CATALOG)?.id || item.verification?.sourceClass || "news",
      source: item.source || item.publisher || "News source",
      sourceClass: structuredNewsSourceClass(item),
      title: item.titleKo || item.title || "Memory intelligence source",
      url: directNewsUrl(item),
      publishedAt: exactEvidenceDate(item),
      observedAt: item.verification?.validatedAt || context.generatedAt || new Date().toISOString(),
      lastHumanVerifiedAt: item.verification?.humanVerifiedAt || item.lastHumanVerifiedAt || null,
      freshnessDays: Number(item.freshnessDays || 180),
      text: `${item.originalTitle || item.title || ""}\n${item.summaryOriginal || item.summary || ""}`,
      feedId: null,
      claimClass: item.verification?.claimClass || newsClaimPolicy(item).claimClass,
      claimStage: item.verification?.claimStage || newsClaimPolicy(item).claimStage,
    })),
    ...(context.brokerResearch?.items || []).map((item) => ({
      sourceId: item.institutionId || "broker-research",
      source: item.institution || item.source || "Research",
      sourceClass: "research",
      title: item.title || "Memory research",
      url: item.sourceUrl || item.url || "",
      publishedAt: exactEvidenceDate(item),
      observedAt: item.observedAt || context.generatedAt || new Date().toISOString(),
      lastHumanVerifiedAt: item.lastHumanVerifiedAt || null,
      freshnessDays: Number(item.freshnessDays || 180),
      text: `${item.title || ""}\n${item.summary || ""}\n${item.insight || ""}`,
      feedId: null,
    })),
  ];
  return rows.filter((item) => validHttpUrl(item.url) && item.text.trim());
}

async function collectDecisionIntelligenceDocuments(context = {}) {
  const observedAt = new Date().toISOString();
  const settled = await Promise.all((INTELLIGENCE_POLICY.directFeeds || []).map(async (feed) => {
    const catalogSource = SOURCE_CATALOG.sources.find((source) => source.id === feed.sourceId);
    if (!catalogSource) return { feed, status: "invalid-source", error: "source catalog id missing" };
    try {
      const { html, attempts, url } = await fetchSourceTextWithRetry({
        url: feed.url,
        retryAttempts: 2,
      });
      const isPdf = /\.pdf(?:$|[?#])/i.test(String(url || feed.url || ""))
        || /^%PDF-/i.test(String(html || "").slice(0, 12));
      if (isPdf) {
        return {
          feed,
          status: "fetched-metadata",
          attempts,
          document: {
            feedId: feed.id,
            sourceId: catalogSource.id,
            source: catalogSource.name,
            sourceClass: catalogSource.sourceClass,
            title: catalogSource.name,
            url,
            publishedAt: documentPublicationDate("", url),
            observedAt,
            lastHumanVerifiedAt: feed.lastHumanVerifiedAt || null,
            freshnessDays: Number(feed.freshnessDays || 180),
            text: `Official PDF source metadata only · ${catalogSource.name} · ${feed.kind || "document"} · locator-based extraction required before any numeric or strategic claim is promoted`,
          },
        };
      }
      const text = htmlToDecisionText(html).slice(0, 180000);
      if (text.length < 120) throw new Error("source text too short");
      const rawTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || catalogSource.name;
      return {
        feed,
        status: "fetched",
        attempts,
        document: {
          feedId: feed.id,
          sourceId: catalogSource.id,
          source: catalogSource.name,
          sourceClass: catalogSource.sourceClass,
          title: stripHTML(rawTitle).slice(0, 180),
          url,
          publishedAt: documentPublicationDate(html, url),
          observedAt,
          lastHumanVerifiedAt: feed.lastHumanVerifiedAt || null,
          freshnessDays: Number(feed.freshnessDays || 180),
          text,
        },
      };
    } catch (error) {
      return { feed, status: "unavailable", error: String(error?.message || error).slice(0, 240) };
    }
  }));
  const direct = settled.map((item) => item.document).filter(Boolean);
  const current = currentDecisionDocuments({ ...context, generatedAt: observedAt });
  const byUrl = new Map();
  for (const document of [...current, ...direct]) byUrl.set(normalizeCrawlExclusionUrl(document.url), document);
  const feedStatus = settled.map((item) => ({
    id: item.feed.id,
    sourceId: item.feed.sourceId,
    kind: item.feed.kind,
    status: item.status,
    attempts: item.attempts || 0,
    error: item.error || null,
  }));
  return { documents: [...byUrl.values()], feedStatus };
}

async function collectChinaInfra() {
  const sources = [];
  for (const source of CHINA_INFRA_SOURCE_PAGES) {
    try {
      const { html, attempts, url: resolvedUrl } = await fetchSourceTextWithRetry(source);
      const text = stripHTML(html).slice(0, 240000);
      const description = articleMetaDescription(html, source.label);
      const markers = (source.markers || []).map((marker) => ({
        marker,
        hit: text.toLowerCase().includes(String(marker).toLowerCase()),
      }));
      const hitCount = markers.filter((marker) => marker.hit).length;
      sources.push({
        id: source.id,
        site: source.site,
        label: source.label,
        url: source.url,
        resolvedUrl,
        publishedAt: source.publishedAt || null,
        ok: true,
        markerHits: hitCount,
        markers,
        excerpt: description || text.slice(0, 360),
        crawledAt: new Date().toISOString(),
        attempts,
      });
      note(`중국Fab인프라:${source.label}`, hitCount > 0, `${hitCount}/${markers.length} markers · ${attempts}회 확인`);
    } catch (error) {
      sources.push({
        id: source.id,
        site: source.site,
        label: source.label,
        url: source.url,
        publishedAt: source.publishedAt || null,
        ok: false,
        error: error.message,
        crawledAt: new Date().toISOString(),
      });
      note(`중국Fab인프라:${source.label}`, false, error.message);
    }
    await sleep(250);
  }
  return {
    updatedAt: new Date().toISOString(),
    sources,
    signals: sources.filter((source) => source.ok),
    methodology: "Official/source pages are fetched daily. Marker hits are used only as freshness and availability checks; land ownership, water allocation, and power quota require primary permits before a Go decision.",
  };
}

function buildSignals({ prices, competitors, startups, newsStats: stats }) {
  const topPriceMoves = prices.watchedItems
    .filter((item) => item.changePct != null)
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, 5);

  const topCompetitor = competitors.competitors[0] || null;
  const topStartup = startups.candidates[0] || null;

  return {
    topPriceMoves,
    topCompetitor: topCompetitor
      ? {
          id: topCompetitor.id,
          label: topCompetitor.shortLabel,
          score: topCompetitor.pressureScore,
          theme: topCompetitor.themes[0]?.label || topCompetitor.segment,
        }
      : null,
    topStartup: topStartup
      ? {
          id: topStartup.id,
          name: topStartup.name,
          score: topStartup.score,
          status: topStartup.status,
          area: topStartup.area,
        }
      : null,
    observations: [
      `최근 30일 메모리 뉴스 ${stats["30d"] || 0}건, 24시간 신규 ${stats.total24h || 0}건.`,
      topPriceMoves[0]
        ? `${topPriceMoves[0].item} 가격 변동 ${topPriceMoves[0].changeRaw || "확인 필요"}.`
        : "공개 메모리 가격표 수집 대기.",
      topCompetitor ? `${topCompetitor.shortLabel} 경쟁 압력 ${topCompetitor.pressureScore}/100.` : "경쟁사 뉴스 수집 대기.",
      topStartup ? `${topStartup.name} ${topStartup.status} 후보, 전략 적합도 ${topStartup.score}/100.` : "스타트업 레이더 수집 대기.",
    ],
  };
}

/* ---------- main ---------- */
function seedTranslationCache(cache = {}, payload = {}) {
  const entries = {
    ...(cache && typeof cache === "object" && cache.entries && typeof cache.entries === "object" ? cache.entries : {}),
  };
  const visited = new WeakSet();
  const add = (original, translated) => {
    const normalized = normalizeKoreanTerminology(translated);
    if (!original || !normalized || translationQuality(original, normalized).status !== "verified") return;
    const key = translationCacheKey(original);
    if (entries[key]?.translated === normalized) return;
    entries[key] = {
      translated: normalized,
      updatedAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
    };
  };
  const visit = (value) => {
    if (!value || typeof value !== "object" || visited.has(value)) return;
    visited.add(value);
    add(value.title, value.titleKo);
    add(value.summaryOriginal, value.summary);
    for (const child of Object.values(value)) {
      if (child && typeof child === "object") visit(child);
    }
  };
  visit(payload);
  return {
    schemaVersion: "1.0",
    targetLanguage: "ko",
    updatedAt: cache?.updatedAt || null,
    entryCount: Object.keys(entries).length,
    entries,
  };
}

async function loadPreviousData() {
  const readJson = async (path, fallback) => {
    try {
      return JSON.parse(await readFile(path, "utf8"));
    } catch {
      return fallback;
    }
  };
  const [previous, quant, baseline, quantModel, translationCache] = await Promise.all([
    readJson(OUT, {}),
    readJson(QUANT_OUT, {}),
    readJson(BASELINE_IN, {}),
    readJson(QUANT_MODEL_IN, {}),
    readJson(TRANSLATION_CACHE_OUT, {}),
  ]);
  return {
    news: Array.isArray(previous.news) ? previous.news : [],
    referenceNews: Array.isArray(previous.referenceNews?.items) ? previous.referenceNews.items : [],
    stocks: previous.stocks && typeof previous.stocks === "object" ? previous.stocks : {},
    brokerResearch: previous.brokerResearch && typeof previous.brokerResearch === "object" ? previous.brokerResearch : {},
    communityItems: [
      ...(Array.isArray(previous.communitySignals?.items) ? previous.communitySignals.items : []),
      ...(Array.isArray(previous.communitySignals?.referenceArchive?.items) ? previous.communitySignals.referenceArchive.items : []),
    ],
    quant: quant && typeof quant === "object" ? quant : {},
    baseline: baseline && typeof baseline === "object" ? baseline : {},
    quantModel: quantModel && typeof quantModel === "object" ? quantModel : {},
    translationCache: seedTranslationCache(translationCache, previous),
  };
}

const FACT_EVENT_DEFINITIONS = [
  {
    id: "cxmt-ipo-offering",
    entity: "CXMT",
    label: "CXMT STAR Market 공모",
    topicIds: ["capital", "china", "policy"],
    match: /(?:cxmt|changxin|长鑫).*(?:ipo|offering|listing|공모|상장)/i,
    stages: [
      {
        id: "final-base-offering",
        label: "발행가·기본 공모액 확정",
        rank: 30,
        sourceMatch: /(?:20260716_10825660|sets-shanghai-ipo-price)/i,
        match: /(?:sets shanghai ipo price|offer price|base offering|기본 공모액|발행가)/i,
        metricRules: {
          baseOfferingCnyB: [
            { match: /(\d+(?:\.\d+)?)\s*billion\s*yuan/i },
            { match: /(\d+(?:\.\d+)?)\s*억\s*위안/i, scale: 0.1 },
          ],
          offerPriceCny: [
            { match: /(?:offer price(?: at)?|발행가(?:는)?)\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*(?:yuan|위안)/i },
          ],
          greenshoePct: [
            { match: /(\d+(?:\.\d+)?)\s*percent\s*(?:overallotment|greenshoe)/i },
            { match: /(?:overallotment|greenshoe)[^\d]{0,30}(\d+(?:\.\d+)?)\s*percent/i },
            { match: /(\d+(?:\.\d+)?)\s*%[^.]{0,30}(?:초과배정|greenshoe)/i },
          ],
        },
      },
      {
        id: "registration-plan",
        label: "상장 등록·투자 프로젝트 계획",
        rank: 10,
        sourceMatch: /(?:20260615_10821916|greenlights-ipo-registration)/i,
        match: /(?:ipo registration|plans? to raise|investment plan|투자 프로젝트 계획|상장 등록)/i,
        metricRules: {
          investmentPlanCnyB: [
            { match: /(\d+(?:\.\d+)?)\s*billion\s*yuan/i },
            { match: /(\d+(?:\.\d+)?)\s*억\s*위안/i, scale: 0.1 },
          ],
        },
      },
    ],
  },
  {
    id: "skhynix-nasdaq-ads",
    entity: "SK hynix",
    label: "SKHY Nasdaq ADS 공모",
    topicIds: ["capital"],
    match: /(?:sk hynix|skhy).*(?:ads|adr|nasdaq|american depositary)/i,
    stages: [
      {
        id: "final-prospectus",
        label: "최종 투자설명서·공모가 확정",
        rank: 30,
        sourceMatch: /d32785d424b4/i,
        match: /(?:final prospectus|american depositary shares?|per ads|최종 투자설명서)/i,
        metricRules: {
          adsM: [
            { match: /(\d+(?:\.\d+)?)\s*million\s*(?:american depositary shares?|ads)/i },
            { match: /(\d+(?:\.\d+)?)\s*백만\s*(?:ads|주)/i },
          ],
          offerPriceUsd: [
            { match: /(?:\$|usd\s*)(\d+(?:\.\d+)?)\s*(?:per\s*ads|per\s*share)/i },
            { match: /(?:주당|ads당)\s*(\d+(?:\.\d+)?)\s*달러/i },
          ],
        },
      },
      {
        id: "registration",
        label: "ADS 등록",
        rank: 10,
        match: /(?:form f-6|registration|등록)/i,
        metricRules: {},
      },
    ],
  },
  {
    id: "bis-china-fab-licensing",
    entity: "BIS",
    label: "중국 내 외국계 Fab 라이선스",
    topicIds: ["policy", "china"],
    match: /(?:bis|bureau of industry and security|veu).*(?:china|fab|semiconductor|중국)/i,
    stages: [
      {
        id: "veu-revoked-individual-license",
        label: "VEU 특례 종료·개별 라이선스 전환",
        rank: 20,
        match: /(?:closes-export-controls-loophole|90fr-42321|revok|특례 종료|license-free treatment)/i,
        metricRules: {},
      },
      {
        id: "veu-general-authorization",
        label: "VEU 일반승인",
        rank: 10,
        match: /(?:2023\.10\.13|general authorization|일반승인)/i,
        metricRules: {},
      },
    ],
  },
  {
    id: "micron-strategic-customer-agreements",
    entity: "Micron",
    label: "Micron 장기 전략고객계약",
    topicIds: ["dram", "demand", "capital"],
    match: /(?:micron).*(?:strategic customer agreement|\bsca\b|전략 고객 계약)/i,
    stages: [
      {
        id: "sixteen-sca",
        label: "16개 SCA 확인",
        rank: 20,
        match: /(?:sixteen|16개)/i,
        metricRules: {
          agreements: [
            { match: /(\d+)\s*(?:key\s*)?(?:strategic\s*)?customers?/i },
            { match: /(?:agreements? with|expanded to)\s*(\d+)\s*customers?/i },
            { match: /(\d+)\s*개[^.]{0,40}(?:strategic\s*)?customer agreements?/i },
          ],
        },
      },
      {
        id: "first-five-year-sca",
        label: "첫 5년 SCA 체결",
        rank: 10,
        match: /(?:first five-year|첫 5년)/i,
        metricRules: {
          termYears: [
            { match: /(\d+)[-\s]*year\s*(?:strategic\s*)?customer agreement/i },
            { match: /(\d+)년(?:짜리|간)?\s*(?:전략적\s*)?고객계약/i },
          ],
        },
      },
    ],
  },
  {
    id: "wsts-2026-market-forecast",
    entity: "WSTS",
    label: "WSTS 2026 반도체 시장 전망 개정",
    topicIds: ["demand", "capital"],
    match: /(?:wsts).*(?:2026|semiconductor market|반도체 시장)/i,
    stages: [
      {
        id: "spring-2026",
        label: "Spring 2026 전망",
        rank: 20,
        match: /(?:spring 2026|1\.5\s*trillion|1\.51t|1\.5조)/i,
        metricRules: {
          semiconductorMarketUsdT: [
            { match: /(?:semiconductor market|market)[^\d$]{0,80}(?:usd\s*|\$)(\d+(?:\.\d+)?)\s*trillion/i },
            { match: /(?:usd\s*|\$)(\d+(?:\.\d+)?)\s*trillion[^.]{0,80}(?:semiconductor|market)/i },
          ],
          memoryMarketUsdB: [
            { match: /memory[^.]{0,100}(?:usd\s*|\$)(\d+(?:\.\d+)?)\s*billion/i },
            { match: /(?:usd\s*|\$)(\d+(?:\.\d+)?)\s*billion[^.]{0,80}memory/i },
          ],
        },
      },
      {
        id: "autumn-2025",
        label: "Autumn 2025 전망",
        rank: 10,
        match: /(?:autumn 2025|975\.46|975\s*billion)/i,
        metricRules: {
          semiconductorMarketUsdB: [
            { match: /(?:usd\s*|\$)(\d+(?:\.\d+)?)\s*billion/i },
          ],
        },
      },
    ],
  },
  {
    id: "trendforce-memory-market-revision",
    entity: "TrendForce",
    label: "TrendForce 메모리 시장 전망 개정",
    topicIds: ["demand", "dram", "nand"],
    match: /(?:trendforce).*(?:memory market|메모리 시장)/i,
    stages: [
      {
        id: "may-2026-revision",
        label: "2026년 5월 개정",
        rank: 20,
        match: /(?:20260529-13068|889\.3|8,893억|1\.28\s*trillion|1\.28조)/i,
        metricRules: {
          market2026UsdB: [
            { match: /2026[^.]{0,120}(?:usd\s*|\$)(\d+(?:\.\d+)?)\s*billion/i },
            { match: /(?:usd\s*|\$)(\d+(?:\.\d+)?)\s*billion[^.]{0,120}2026/i },
          ],
          market2027UsdT: [
            { match: /2027[^\n]{0,160}?(?:usd\s*|\$)(\d+(?:\.\d+)?)\s*trillion/i },
            { match: /(?:usd\s*|\$)(\d+(?:\.\d+)?)\s*trillion[^\n]{0,160}?2027/i },
          ],
        },
      },
    ],
  },
];

const INTELLIGENCE_TOPICS = [
  {
    id: "hbm",
    label: "HBM·AI 서버",
    terms: ["hbm", "hbm4", "hbm4e", "rubin", "high bandwidth memory", "cowos", "base die"],
    priceTerms: [],
    priceProxy: false,
    decision: "고객 인증·공급 일정·베이스 다이·패키징 병목을 함께 확인한 뒤 프리미엄 캐파를 배분합니다.",
    reversal: "고객별 HBM4 인증 일정, 패키징 할당 또는 양산 수율의 공식 변경",
  },
  {
    id: "dram",
    label: "DRAM·범용 가격",
    terms: ["dram", "ddr5", "ddr4", "lpddr", "cxmt", "changxin", "server memory"],
    priceTerms: ["ddr5 16gb", "ddr4 16gb", "rdimm"],
    decision: "Spot 방향이 계약가로 전이되는지와 CXMT 고객·캐파 신호를 함께 확인해 범용 DRAM 가격 방어 강도를 정합니다.",
    reversal: "DDR5 Spot 누적 하락 뒤 계약가 하락이 확인되거나 CXMT 매출 점유율이 2%p 이상 변동",
  },
  {
    id: "nand",
    label: "NAND·eSSD",
    terms: ["nand", "ssd", "essd", "ymtc", "xtacking", "solidigm", "flash"],
    priceTerms: ["nand", "tlc", "mlc", "ssd"],
    decision: "NAND 계약가·웨이퍼 가격·eSSD 고객 신호를 분리해 Dalian/Solidigm의 제품 믹스와 가격 방어를 결정합니다.",
    reversal: "NAND 계약가와 웨이퍼 가격이 동시에 반전하거나 YMTC 고객 인증·가동률이 공식 확인",
  },
  {
    id: "china",
    label: "중국 경쟁",
    terms: ["cxmt", "ymtc", "xmc", "jcet", "naura", "amec", "china memory", "중국", "长鑫", "长江存储"],
    priceTerms: ["ddr5", "nand", "tlc"],
    priceProxy: true,
    decision: "DRAM 가격, NAND·eSSD, 패키징, 장비 내재화를 별도 축으로 보고 공식 투자·고객·양산 신호가 겹칠 때만 경보를 높입니다.",
    reversal: "공식 공시·고객 계약·장비 반입·양산 램프 가운데 두 개 이상의 독립 근거가 같은 방향으로 확인",
  },
  {
    id: "policy",
    label: "정책·Fab",
    terms: ["bis", "chips act", "match act", "export control", "license", "policy", "regulation", "veu"],
    priceTerms: [],
    decision: "법안, 시행 규칙, 라이선스 조건을 구분하고 중국 Fab 안건을 운영 유지·캐파 확대·기술 업그레이드로 나눠 결재합니다.",
    reversal: "정부 원문에서 법적 상태·적용 품목·라이선스 조건이 변경",
    primaryFactIds: ["bis-china-fab-licensing"],
  },
  {
    id: "demand",
    label: "수요·고객",
    terms: ["ai demand", "server shipment", "smartphone shipment", "pc shipment", "hyperscaler", "accelerator", "data center"],
    priceTerms: ["rdimm", "ddr5", "ssd"],
    priceProxy: true,
    decision: "출하량과 대당 탑재량을 분리하고 고객 CapEx·전력·패키징 제약을 반영해 제품군 시나리오를 갱신합니다.",
    reversal: "공식 출하 전망 또는 고객 CapEx가 기준 시나리오 대비 10% 이상 변경",
  },
  {
    id: "capital",
    label: "자본시장·CAPEX",
    terms: ["ipo", "offering", "ads", "adr", "nasdaq", "capex", "fundraising", "공모", "상장", "설비투자"],
    priceTerms: [],
    decision: "공모 계획액, 확정 조달액, 조건부 초과배정과 연간 CAPEX를 같은 숫자로 합치지 않고 자금 용도와 공급 증가 시점을 따로 판단합니다.",
    reversal: "최종 투자설명서, 거래소 공시, 이사회 CAPEX 가이던스 또는 실제 자금 집행 일정 변경",
    primaryFactIds: ["cxmt-ipo-offering", "skhynix-nasdaq-ads"],
  },
];

const OFFICIAL_SOURCE_RE = /(?:\.gov(?:\/|$)|govinfo\.gov|congress\.gov|sec\.gov|census\.gov|content\.govdelivery\.com\/accounts\/USCENSUS|english\.sse\.com\.cn|hkexnews\.hk|investors?\.|ir\.|newsroom\.|company\/(?:news|press)|blogs\.microsoft\.com\/blog|microsoft\.com\/en-us\/investor|news\.samsung\.com|news\.skhynix\.com|semiconductor\.samsung\.com\/(?:[^/]+\/)*news-events\/news|xmcwh\.com\/(?:en\/)?site\/(?:about-XMC|news|details))/i;
const ANALYSIS_SOURCE_RE = /(?:trendforce\.com\/(?:presscenter|price|news)|counterpointresearch\.com|techinsights\.com|wsts\.org|yolegroup\.com|newsletter\.semianalysis\.com)/i;
const AUTHORITATIVE_MEDIA_RE = /(?:reuters|bloomberg|ft\.com|financial times|nikkei|cnbc|associated press|apnews|south china morning post|scmp|caixin global|caixinglobal|digitimes|ee times|tom's hardware)/i;
const ESTIMATE_RE = /(?:forecast|estimate|reportedly|sources? (?:said|say)|could|may |might|expected|projection|전망|추정|보도|소식통)/i;
const LOW_VALUE_INTELLIGENCE_RE = /(?:ram price tracking|lowest price on ddr|best (?:ram|ssd)|buying guide|deal tracker)/i;

function directNewsUrl(item = {}) {
  for (const value of [item.sourceUrl, item.link]) {
    const url = String(value || "").trim();
    if (/^https?:\/\//i.test(url) && !/news\.google\.com/i.test(url)) return url;
  }
  return "";
}

function intelligenceSource(item = {}) {
  const url = directNewsUrl(item);
  const sourceText = `${item.source || ""} ${url}`;
  const content = `${item.title || ""} ${item.titleKo || ""} ${item.summary || item.summaryOriginal || ""}`;
  const isOfficial = OFFICIAL_SOURCE_RE.test(sourceText);
  const isAnalysis = ANALYSIS_SOURCE_RE.test(sourceText);
  const isMedia = AUTHORITATIVE_MEDIA_RE.test(sourceText);
  const companyView = /\badata\b/i.test(content);
  const estimated = ESTIMATE_RE.test(content);
  const claimPolicy = newsClaimPolicy(item);
  const structuredFactEligible = claimPolicy.structuredFactEligible !== false;
  const forcedEstimate = claimPolicy.claimType === "market-estimate";
  const chineseOnly = String(item.language || "").toLowerCase() === "chinese";
  const observedThisRun = wasSourceObservedThisRun(item);
  const evidenceLevel = !chineseOnly && url && isOfficial && observedThisRun && !estimated && !companyView && structuredFactEligible
    ? "Confirmed"
    : !chineseOnly && url && (isMedia || isAnalysis || forcedEstimate) && !estimated && !companyView
      ? "Reported"
      : "Watch";
  return {
    sourceType: chineseOnly ? "중국어 보도" : isOfficial ? "공식" : isMedia ? "외신" : isAnalysis ? "분석" : "내부추정",
    claimType: companyView ? "업체전망" : estimated || forcedEstimate ? "전망·추정" : evidenceClaimLabel({
      evidenceLevel,
      sourceClass: isOfficial && structuredFactEligible ? "official" : isMedia ? "authoritative-media" : isAnalysis || forcedEstimate ? "research" : "general-media",
      observedThisRun,
    }),
    evidenceLevel,
    sourceScore: chineseOnly ? (url ? 2 : 0) : isOfficial ? 5 : isMedia ? 4 : isAnalysis ? 4 : url ? 2 : 0,
  };
}

function intelligenceText(item = {}) {
  return `${item.titleKo || ""} ${item.title || ""} ${item.summary || ""} ${item.summaryOriginal || ""} ${item.category || ""}`.toLowerCase();
}

function intelligenceNewsScore(item, topic) {
  const title = `${item.titleKo || ""} ${item.title || ""}`.toLowerCase();
  const body = intelligenceText(item);
  if (LOW_VALUE_INTELLIGENCE_RE.test(title)) return 0;
  if (topic.id === "dram" && /(?:cxmt|changxin|长鑫)/i.test(body) && /(?:ipo|fundrais|listing|공모|상장)/i.test(body)) return 0;
  const matches = topic.terms.reduce((sum, term) => {
    const key = term.toLowerCase();
    return sum + (title.includes(key) ? 4 : body.includes(key) ? 1 : 0);
  }, 0);
  if (!matches || !directNewsUrl(item)) return 0;
  const ageDays = Math.max(0, (Date.now() - new Date(item.date || item.publishedAt || 0).getTime()) / 864e5);
  const recency = Number.isFinite(ageDays) ? Math.max(0, 4 - ageDays / 14) : 0;
  const summaryBonus = compactArticleSummary(item).length >= 45 ? 5 : -6;
  return matches + intelligenceSource(item).sourceScore + recency + summaryBonus;
}

function intelligenceBriefTranslationItems(briefs = [], items = []) {
  const byEvidenceId = new Map(items.map((item) => [item.verification?.id, item]));
  const seen = new Set();
  return briefs.map((brief) => byEvidenceId.get(brief.latest?.provenanceId) || null)
    .filter((item) => item && String(item.language || "").toLowerCase() === "english")
    .filter((item) => directNewsUrl(item) && String(item.summaryOriginal || item.summary || "").trim())
    .filter((item) => {
      const key = directNewsUrl(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function intelligencePriceRows(prices = {}) {
  return (prices.sections || []).flatMap((section) => (section.rows || []).map((row) => ({
    ...row,
    group: section.group,
    sectionTitle: section.title,
    lastUpdate: section.lastUpdate,
    sourceUrl: section.sourceUrl,
  })));
}

function priceEvidenceForTopic(rows, topic) {
  if (!topic.priceTerms.length) return null;
  const ranked = rows
    .map((row) => {
      const text = `${row.group || ""} ${row.sectionTitle || ""} ${row.item || ""}`.toLowerCase();
      const score = topic.priceTerms.reduce((sum, term) => sum + (text.includes(term.toLowerCase()) ? 1 : 0), 0);
      const history = Array.isArray(row.history) ? row.history : [];
      return { row, score, history };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.history.length - a.history.length);
  if (!ranked.length) return null;
  const { row, history } = ranked[0];
  const first = Number(history[0]?.average);
  const latest = Number(row.average);
  const periodChangePct = Number.isFinite(first) && first > 0 && Number.isFinite(latest)
    ? Number((((latest - first) / first) * 100).toFixed(2))
    : null;
  const periodChangeValidation = assessPriceChange({
    periodChangePct,
    observedPoints: history.length,
    firstObservedAt: history[0]?.crawledAt || history[0]?.date || null,
    lastObservedAt: row.lastUpdate || history.at(-1)?.crawledAt || history.at(-1)?.date || null,
  });
  return {
    item: row.item,
    group: row.group,
    table: row.sectionTitle,
    latest,
    latestRaw: row.averageRaw || String(row.average || ""),
    dailyChangePct: Number.isFinite(Number(row.changePct)) ? Number(row.changePct) : null,
    periodChangePct,
    periodChangeValidation,
    observedPoints: history.length,
    firstObservedAt: history[0]?.crawledAt || null,
    lastUpdate: row.lastUpdate || null,
    sourceUrl: row.sourceUrl || "",
    sourceCount: row.sourceUrl ? 1 : 0,
    crossCheckStatus: row.sourceUrl ? "single-source" : "unverified",
    isProxy: Boolean(topic.priceProxy),
  };
}

function compactArticleSummary(item = {}) {
  const localized = cleanKoNewsText(item.summary || "");
  if (localized && !/중국 최대의 삼성전자/.test(localized) && (localized.match(/[가-힣]/g) || []).length >= 10) {
    return localized.length > 260 ? `${localized.slice(0, 257).trim()}...` : localized;
  }
  // Translation is an enhancement, not a source of invented text. When the
  // translation endpoint is unavailable, retain the source-language summary
  // and mark it in the UI instead of dropping verified live evidence.
  const original = String(item.summaryOriginal || item.summary || "").replace(/\s+/g, " ").trim();
  return original.length > 260 ? `${original.slice(0, 257).trim()}...` : original;
}

function intelligenceSummaryLanguage(item = {}) {
  const localized = cleanKoNewsText(item.summary || "");
  return (localized.match(/[가-힣]/g) || []).length >= 10 ? "ko" : "source-original";
}

function intelligenceTitle(item = {}) {
  let title = cleanKoNewsText(item.titleKo || item.title || "");
  const source = cleanKoNewsText(item.source || "");
  if (!title || !source) return title;
  let changed = true;
  while (changed) {
    changed = false;
    for (const separator of [" - ", " – ", " — ", " | "]) {
      const suffix = `${separator}${source}`;
      if (title.toLowerCase().endsWith(suffix.toLowerCase())) {
        title = title.slice(0, -suffix.length).trim();
        changed = true;
        break;
      }
    }
  }
  return title;
}

function factEventText(item = {}) {
  return `${item.id || ""} ${item.title || ""} ${item.titleKo || ""} ${item.summaryOriginal || ""} ${item.summary || ""} ${directNewsUrl(item)}`;
}

function factStageText(item = {}) {
  return `${item.id || ""} ${item.title || ""} ${item.originalTitle || ""} ${item.titleKo || ""} ${directNewsUrl(item)}`;
}

function extractStageMetrics(text = "", metricRules = {}) {
  const metrics = {};
  for (const [key, rules] of Object.entries(metricRules || {})) {
    for (const rule of rules || []) {
      const match = String(text).match(rule.match);
      if (!match) continue;
      const rawValue = Number(String(match[1] || "").replace(/,/g, ""));
      if (!Number.isFinite(rawValue)) continue;
      const scale = Number.isFinite(Number(rule.scale)) ? Number(rule.scale) : 1;
      const precision = Number.isInteger(rule.precision) ? rule.precision : 4;
      metrics[key] = Number((rawValue * scale).toFixed(precision));
      break;
    }
  }
  if (Number.isFinite(metrics.adsM) && Number.isFinite(metrics.offerPriceUsd)) {
    metrics.grossProceedsUsdB = Number(((metrics.adsM * metrics.offerPriceUsd) / 1000).toFixed(4));
  }
  return metrics;
}

function factSourcePriority(sourceClass = "") {
  return sourceClass === "official" ? 4 : sourceClass === "research" ? 3 : sourceClass === "authoritative-media" ? 2 : 1;
}

function buildFactTimeline(news = [], generatedAt = new Date().toISOString()) {
  const events = FACT_EVENT_DEFINITIONS.map((definition) => {
    const observations = [];
    for (const item of news) {
      if (item.verification?.structuredFactEligible === false) continue;
      const text = factEventText(item);
      if (!definition.match.test(text)) continue;
      const stageText = factStageText(item);
      const stage = definition.stages.find((candidate) => candidate.sourceMatch?.test(stageText))
        || definition.stages.find((candidate) => candidate.match.test(stageText))
        || definition.stages.find((candidate) => candidate.match.test(text));
      if (!stage) continue;
      const sourceClass = structuredNewsSourceClass(item);
      if (!['official', 'research', 'authoritative-media'].includes(sourceClass)) continue;
      observations.push({
        stageId: stage.id,
        stageLabel: stage.label,
        stageRank: stage.rank,
        metrics: extractStageMetrics(text, stage.metricRules),
        title: intelligenceTitle(item),
        summary: compactArticleSummary(item),
        source: item.source || "Unknown",
        sourceUrl: directNewsUrl(item),
        publishedAt: item.date || item.publishedAt || null,
        provenanceId: item.verification?.id || null,
        sourceClass,
        evidenceOrigin: item.verification?.origin || newsEvidenceOrigin(item),
      });
    }
    observations.sort((a, b) => (
      b.stageRank - a.stageRank
      || factSourcePriority(b.sourceClass) - factSourcePriority(a.sourceClass)
      || new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0)
    ));
    if (!observations.length) return null;
    const current = observations[0];
    return {
      id: definition.id,
      entity: definition.entity,
      label: definition.label,
      topicIds: definition.topicIds,
      status: current.sourceClass === "official" ? "Confirmed" : "Reported",
      current,
      history: observations,
      supersededStages: [...new Set(observations.slice(1).map((item) => item.stageId).filter((id) => id !== current.stageId))],
    };
  }).filter(Boolean);

  const currentFacts = events.map((event) => event.current);
  return {
    generatedAt,
    methodology: "event-stage-resolution-v1",
    eventCount: events.length,
    currentFactCount: currentFacts.length,
    officialCurrentFacts: events.filter((event) => event.current.sourceClass === "official").length,
    events,
  };
}

function buildSourceRegistry({ prices = {}, news = [], communitySignals = {}, brokerResearch = {}, facts = {}, marketHistory = {}, quant = {} }) {
  const priceTables = Array.isArray(prices.sections) ? prices.sections.length : 0;
  const communityItems = Array.isArray(communitySignals.items) ? communitySignals.items.length : 0;
  const brokerItems = Array.isArray(brokerResearch.items) ? brokerResearch.items.length : 0;
  const factEvents = Array.isArray(facts.events) ? facts.events.length : 0;
  const marketSeries = Object.values(marketHistory.indexes || {}).length
    + Object.values(marketHistory.stocks || {}).length;
  const catalog = buildSourceCatalogSnapshot({
    catalog: SOURCE_CATALOG,
    news,
    industrySourceChecks: quant.industrySourceChecks || {},
  });
  return {
    version: "3.0-catalog-driven-registry",
    generatedAt: new Date().toISOString(),
    catalog,
    promotionPolicy: [
      "direct canonical URL required",
      "published date and source summary required",
      "community and hiring observations remain signal-only",
      "event stage and source authority resolve conflicting numbers",
    ],
    channels: [
      { id: "prices", mode: "structured-daily", sources: priceTables, records: intelligencePriceRows(prices).length },
      { id: "english-news", mode: "authority-monitor-and-search", sources: ENGLISH_AUTHORITY_MONITORS.length + CATALOG_DISCOVERY_MONITORS.length, records: news.filter((item) => verifiedNewsLanguage(item) === "english").length },
      { id: "source-catalog", mode: "catalog-driven-discovery-and-health", sources: catalog.configuredSources, records: catalog.observedSources },
      { id: "chinese-news", mode: "authority-monitor-and-search", sources: CHINESE_AUTHORITY_MONITORS.length, records: news.filter((item) => verifiedNewsLanguage(item) === "chinese").length },
      { id: "broker-research", mode: "direct-report-and-citation", sources: BROKER_RESEARCH_MONITORS.length, records: brokerItems },
      { id: "community-hiring", mode: "public-signal-monitor", sources: Object.keys(COMMUNITY_PLATFORM_RULES).length, records: communityItems, promotion: "signal-only" },
      { id: "market-history", mode: "daily-time-series", sources: marketSeries, records: marketSeries },
      { id: "quantitative-metrics", mode: "last-good-with-provenance", sources: quant.sourceHealth?.total || 0, records: (quant.marketStructure?.kpis?.length || 0) + (quant.marketStructure?.companies?.length || 0) },
      { id: "fact-timeline", mode: "event-stage-resolution", sources: FACT_EVENT_DEFINITIONS.length, records: factEvents },
    ],
  };
}

function buildIntelligence({ news = [], prices = {}, stats = {}, chinaInfra = {}, facts = {} }) {
  const generatedAt = new Date().toISOString();
  const priceRows = intelligencePriceRows(prices);
  const newsCandidates = news;
  const factEvents = Array.isArray(facts.events) ? facts.events : [];
  const directItems = news.filter((item) => directNewsUrl(item));
  const summarized = news.filter((item) => String(item.summary || item.summaryOriginal || "").trim());
  const briefs = INTELLIGENCE_TOPICS.map((topic) => {
    const ranked = newsCandidates
      .map((item) => ({ item, score: intelligenceNewsScore(item, topic), sourceMeta: intelligenceSource(item) }))
      .filter(({ item, score, sourceMeta }) => (
        score > 0
        && compactArticleSummary(item)
        && ["공식", "외신", "분석"].includes(sourceMeta.sourceType)
      ))
      .sort((a, b) => b.score - a.score || new Date(b.item.date || 0) - new Date(a.item.date || 0));
    const relatedFacts = factEvents
      .filter((event) => event.topicIds.includes(topic.id))
      .sort((a, b) => new Date(b.current.publishedAt || 0) - new Date(a.current.publishedAt || 0));
    const primaryFact = relatedFacts.find((event) => (topic.primaryFactIds || []).includes(event.id));
    const factTop = primaryFact
      ? news.find((item) => item.verification?.id === primaryFact.current.provenanceId)
      : null;
    const top = factTop || ranked[0]?.item;
    if (!top) return null;
    const sourceMeta = intelligenceSource(top);
    const price = priceEvidenceForTopic(priceRows, topic);
    const displayPriceChange = price?.periodChangeValidation?.displayPeriodChangePct;
    const priceSentence = price && Number.isFinite(displayPriceChange)
      ? `${price.item}은 공개 누적 ${price.observedPoints}개 관측에서 ${displayPriceChange >= 0 ? "+" : ""}${displayPriceChange.toFixed(2)}% 변했습니다${price.isProxy ? "(직접 가격이 아닌 proxy)" : ""}.`
      : price?.periodChangeValidation?.status === "review-required"
        ? `${price.item}의 누적 변동률은 관측 구간 또는 이상치 검증이 필요해 의사결정 수치로 사용하지 않습니다.`
        : "";
    return {
      id: topic.id,
      label: topic.label,
      generatedAt,
      generation: {
        method: "deterministic-template",
        llmUsed: false,
        sourceEntailment: "not-applicable",
      },
      evidenceCount: ranked.length + relatedFacts.length + (price ? 1 : 0),
      latest: {
        title: intelligenceTitle(top),
        originalTitle: top.title,
        summary: compactArticleSummary(top),
        summaryLanguage: intelligenceSummaryLanguage(top),
        source: top.source || "Unknown",
        url: directNewsUrl(top),
        publishedAt: top.date || top.publishedAt || null,
        language: top.language || null,
        sourceType: sourceMeta.sourceType,
        claimType: sourceMeta.claimType,
        evidenceLevel: sourceMeta.evidenceLevel,
        translationStatus: top.translation?.summary?.status || top.translation?.title?.status || null,
        translationMatchPct: top.translation?.summary?.tokenMatchPct ?? top.translation?.title?.tokenMatchPct ?? null,
        provenanceId: top.verification?.id || null,
        sourceClass: structuredNewsSourceClass(top),
        factId: primaryFact?.id || null,
        factStage: primaryFact?.current.stageId || null,
      },
      price,
      factReferences: relatedFacts.map((event) => ({
        id: event.id,
        label: event.label,
        status: event.status,
        stage: event.current.stageId,
        metrics: event.current.metrics,
        sourceUrl: event.current.sourceUrl,
        publishedAt: event.current.publishedAt,
      })),
      insight: [compactArticleSummary(top), priceSentence].filter(Boolean).join(" "),
      decision: topic.decision,
      reversalKpi: topic.reversal,
    };
  }).filter(Boolean);
  const directSourceRatio = news.length ? directItems.length / news.length : 0;
  const summaryRatio = news.length ? summarized.length / news.length : 0;
  const validationStatus = briefs.length >= 4 && priceRows.length > 0 && directSourceRatio >= 0.5 ? "OK" : "Watch";
  return {
    generatedAt,
    methodologyVersion: EVIDENCE_METHODOLOGY_VERSION,
    generation: {
      method: "deterministic-template",
      llmUsed: false,
      sourceEntailment: "not-applicable",
    },
    validation: {
      status: validationStatus,
      newsItems: Number(stats.total || news.length),
      displayedNews: news.length,
      directSources: directItems.length,
      directSourceRatio: Number(directSourceRatio.toFixed(3)),
      summarizedItems: summarized.length,
      summaryRatio: Number(summaryRatio.toFixed(3)),
      priceRows: priceRows.length,
      briefCount: briefs.length,
      factEvents: factEvents.length,
    },
    briefs,
    executive: briefs
      .slice()
      .sort((a, b) => new Date(b.latest.publishedAt || 0) - new Date(a.latest.publishedAt || 0) || b.evidenceCount - a.evidenceCount)
      .slice(0, 3)
      .map((brief) => brief.id),
  };
}

function qualityCanonicalUrl(item = {}) {
  const raw = directNewsUrl(item) || item.sourceUrl || item.url || "";
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    parsed.hash = "";
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "oc"]) {
      parsed.searchParams.delete(key);
    }
    return parsed.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return String(raw).replace(/#.*$/, "").replace(/\/$/, "").toLowerCase();
  }
}

function evidenceId(value = "") {
  return createHash("sha256").update(String(value || "")).digest("hex").slice(0, 20);
}

function newsSourceClass(item = {}) {
  const sourceText = `${item.source || ""} ${directNewsUrl(item)}`;
  const catalogSource = catalogSourceForUrl(directNewsUrl(item), SOURCE_CATALOG);
  if (catalogSource?.sourceClass) return catalogSource.sourceClass;
  if (OFFICIAL_SOURCE_RE.test(sourceText)
    || /(?:news\.samsung\.com|news\.skhynix\.com|investors\.micron\.com|sandisk\.com\/company\/newsroom|english\.sse\.com\.cn)/i.test(sourceText)) {
    return "official";
  }
  if (ANALYSIS_SOURCE_RE.test(sourceText)) return "research";
  if (AUTHORITATIVE_MEDIA_RE.test(sourceText)) return "authoritative-media";
  return "general-media";
}

function normalizedStructuredSourceClass(value = "") {
  const sourceClass = String(value || "").trim().toLowerCase();
  if (["official", "official-primary", "filing"].includes(sourceClass)) return "official";
  if (["research", "analysis"].includes(sourceClass)) return "research";
  if (["authoritative-media", "reported"].includes(sourceClass)) return "authoritative-media";
  if (["general-media", "news"].includes(sourceClass)) return "general-media";
  return "";
}

function structuredNewsSourceClass(item = {}) {
  const policy = item.verification?.structuredFactEligible === false
    ? { structuredFactEligible: false }
    : newsClaimPolicy(item);
  if (policy.structuredFactEligible === false) return "ineligible";
  return normalizedStructuredSourceClass(item.verification?.sourceClass) || newsSourceClass(item);
}

function newsEvidenceOrigin(item = {}) {
  if (item.preservedSeed) return "curated-seed";
  if (item.continuityFallback) return "previous-verified-run";
  return "live-crawl";
}

function wasSourceObservedThisRun(item = {}) {
  return newsEvidenceOrigin(item) === "live-crawl" && item.summarySource === "source-meta";
}

const JALAPENO_PRODUCT_RE = /\bjalape(?:ñ|n)o\b/i;
const JALAPENO_SUPPLIER_ASSERTION_RE = /(?:samsung|삼성|sk\s*hynix|sk\s*하이닉스|micron|마이크론).{0,48}(?:hbm4|high[- ]bandwidth memory)|(?:hbm4|high[- ]bandwidth memory).{0,48}(?:samsung|삼성|sk\s*hynix|sk\s*하이닉스|micron|마이크론)/i;
const JALAPENO_BENCHMARK_ASSERTION_RE = /(?:benchmark|tokens?\s*\/\s*s|tokens?\s+per\s+second|throughput|latency|outperform|faster\s+than|slower\s+than|beats?|능가|성능\s*(?:우위|향상|개선)|처리량\s*(?:향상|개선)|\b\d+(?:\.\d+)?\s*(?:x|배)\b|\b\d+(?:\.\d+)?\s*%)/i;
const JALAPENO_RELEASE_ASSERTION_RE = /(?:launched?|debut(?:ed)?|commercial(?:ly)?\s+available|general availability|출시|상용화|정식\s*가동)/i;
const HBM4_12_SPEED_RE = /\bhbm4\b[\s\S]{0,100}\b12(?:\.0+)?\s*(?:gbps|gb\/s|gbit\/s|기가비트(?:\/초|\s*초당))\b|\b12(?:\.0+)?\s*(?:gbps|gb\/s|gbit\/s|기가비트(?:\/초|\s*초당))\b[\s\S]{0,100}\bhbm4\b/i;
const SPEED_ASSERTION_RE = /(?:achiev(?:e|ed|es|ing)?|attain(?:ed|s|ing)?|sustain(?:ed|s|ing)?|capable|require(?:d|ment|s)?|target(?:ed|s)?|ship(?:ped|ping|s)?|mass\s+production|high[- ]volume\s+production|commercial(?:ly)?|달성|요구(?:치|사항)?|목표(?:치)?|출하|양산|상용화|지속\s*속도)/i;

const JALAPENO_FIRST_PARTY_DOMAINS = Object.freeze(["openai.com", "broadcom.com"]);
const HBM4_SPEED_FIRST_PARTIES = Object.freeze([
  { domains: ["samsung.com"], entity: /(?:samsung|삼성)/i },
  { domains: ["micron.com"], entity: /(?:micron|마이크론)/i },
  { domains: ["skhynix.com"], entity: /(?:sk\s*hynix|sk\s*하이닉스)/i },
  { domains: ["nvidia.com"], entity: /(?:nvidia|엔비디아)/i },
  { domains: ["amd.com"], entity: /\bamd\b/i },
]);

function claimText(item = {}) {
  return [item.originalTitle, item.title, item.titleKo, item.summaryOriginal, item.summary]
    .filter(Boolean)
    .join(" · ")
    .replace(/\s+/g, " ")
    .trim();
}

function claimSourceMatches(item = {}, domains = []) {
  try {
    const host = new URL(directNewsUrl(item)).hostname;
    return domains.some((domain) => domainMatches(host, domain));
  } catch {
    return false;
  }
}

function vendorSpecificClaimSource(item = {}, text = "") {
  return HBM4_SPEED_FIRST_PARTIES.some((party) => (
    party.entity.test(text) && claimSourceMatches(item, party.domains)
  ));
}

function productClaimStage(text = "") {
  if (/(?:mass\s+production|high[- ]volume\s+production|양산)/i.test(text)) return "volume-production";
  if (/(?:commercial\s+shipment|ship(?:ped|ping|s)?|출하)/i.test(text)) return "shipping";
  if (/(?:qualification|qualified|certif|인증)/i.test(text)) return "qualification";
  if (/(?:engineering\s+sample|sample|샘플)/i.test(text)) return "engineering-sample";
  if (/(?:require(?:d|ment|s)?|target(?:ed|s)?|요구(?:치|사항)?|목표(?:치)?)/i.test(text)) return "target-requirement";
  if (/(?:achiev(?:e|ed|es|ing)?|attain(?:ed|s|ing)?|sustain(?:ed|s|ing)?|capable|달성|지속\s*속도)/i.test(text)) return "verified-performance";
  return "disclosed";
}

/**
 * Claim-level boundary applied before a crawled article can feed public news
 * or a structured decision fact.  Source-class alone is insufficient: an
 * official page for one company cannot confirm another vendor's product
 * supplier, benchmark or interface-speed assertion.
 */
export function newsClaimPolicy(item = {}) {
  const text = claimText(item);
  const jalapeno = JALAPENO_PRODUCT_RE.test(text);
  const jalapenoAssertion = jalapeno && (
    JALAPENO_SUPPLIER_ASSERTION_RE.test(text)
    || JALAPENO_BENCHMARK_ASSERTION_RE.test(text)
    || JALAPENO_RELEASE_ASSERTION_RE.test(text)
  );
  if (jalapeno) {
    const firstParty = claimSourceMatches(item, JALAPENO_FIRST_PARTY_DOMAINS);
    const quarantine = jalapenoAssertion && !firstParty;
    return {
      claimClass: "jalapeno-product-claim",
      claimStage: firstParty ? productClaimStage(text) : quarantine ? "unverified-secondary" : "market-estimate",
      claimType: firstParty ? "official-fact" : quarantine ? "unverified-claim" : "market-estimate",
      disposition: firstParty ? "allow" : quarantine ? "quarantine" : "market-estimate",
      structuredFactEligible: firstParty,
      reason: quarantine ? "unverified_jalapeno_claim" : firstParty ? null : "jalapeno_first_party_missing",
    };
  }

  if (HBM4_12_SPEED_RE.test(text) && SPEED_ASSERTION_RE.test(text)) {
    const firstParty = vendorSpecificClaimSource(item, text);
    return {
      claimClass: "hbm4-interface-speed",
      claimStage: firstParty ? productClaimStage(text) : "market-estimate",
      claimType: firstParty ? "official-fact" : "market-estimate",
      disposition: firstParty ? "allow" : "market-estimate",
      structuredFactEligible: firstParty,
      reason: firstParty ? null : "hbm4_speed_first_party_missing",
    };
  }

  return {
    claimClass: "general-news",
    claimStage: "reported",
    claimType: "source-classified",
    disposition: "allow",
    structuredFactEligible: true,
    reason: null,
  };
}

const QUARANTINE_REASON_LABELS = Object.freeze({
  direct_source_missing: "직접 원문 URL 없음",
  canonical_url_missing: "정규 URL 확인 실패",
  language_unverified: "언어 검증 실패",
  source_summary_missing: "원문 요약 불충분",
  published_date_invalid: "발행일 파싱 실패",
  published_date_future: "미래 발행일",
  published_date_outside_retention: "보존 기간 초과",
  "pre-2026-date": "2026년 이전 발행",
  canonical_duplicate: "정규 URL 중복",
  story_duplicate: "동일 기사 중복",
  moderation_excluded: "운영 제외 요청",
  unverified_jalapeno_claim: "1차 확인 없는 제품 주장",
});

function quarantineReasonLabel(code = "") {
  return QUARANTINE_REASON_LABELS[code] || (code.startsWith("numeric_claim_superseded") ? "최신 수치로 대체" : "기타 품질 조건");
}

export function validateNewsEvidence(items = [], validatedAt = new Date().toISOString()) {
  const promoted = [];
  const quarantined = [];
  const seen = new Set();
  const seenStories = [];
  const now = new Date(validatedAt).getTime();
  const maxAgeMs = 365 * 5 * 864e5;

  for (const item of items) {
    const sourceUrl = directNewsUrl(item);
    const canonicalUrl = qualityCanonicalUrl(item);
    const language = verifiedNewsLanguage(item);
    const summary = String(item.summaryOriginal || item.summary || "").replace(/\s+/g, " ").trim();
    const publishedAt = new Date(item.date || item.publishedAt || 0).getTime();
    const reasons = [];

    if (!sourceUrl || /news\.google\.com/i.test(sourceUrl)) reasons.push("direct_source_missing");
    if (!canonicalUrl) reasons.push("canonical_url_missing");
    if (!language) reasons.push("language_unverified");
    if (summary.length < 20 || !isCompleteArticleSummary(summary)) reasons.push("source_summary_missing");
    if (!Number.isFinite(publishedAt) || publishedAt <= 0) reasons.push("published_date_invalid");
    if (Number.isFinite(publishedAt) && publishedAt > now + 48 * 3600e3) reasons.push("published_date_future");
    if (Number.isFinite(publishedAt) && now - publishedAt > maxAgeMs) reasons.push("published_date_outside_retention");
    if (Number.isFinite(publishedAt) && publishedAt > 0 && new Date(publishedAt).getUTCFullYear() < 2026) reasons.push("pre-2026-date");
    if (canonicalUrl && seen.has(canonicalUrl)) reasons.push("canonical_duplicate");
    if (seenStories.some((existing) => sameNewsStory(existing, item))) reasons.push("story_duplicate");
    if (isCrawlerExcluded("news", item)) reasons.push("moderation_excluded");
    const supersededReason = supersededNumericClaimReason(item);
    if (supersededReason) reasons.push(supersededReason);
    const claimPolicy = newsClaimPolicy(item);
    if (claimPolicy.disposition === "quarantine" && claimPolicy.reason) reasons.push(claimPolicy.reason);

    const id = evidenceId(canonicalUrl || `${item.title || ""}|${item.date || ""}`);
    if (reasons.length) {
      quarantined.push({
        id,
        title: String(item.title || "").slice(0, 240),
        source: String(item.source || "").slice(0, 120),
        sourceUrl: sourceUrl || "",
        canonicalUrl: canonicalUrl || "",
        publishedAt: item.date || item.publishedAt || null,
        language: language || String(item.streamLanguage || item.language || "unknown"),
        category: item.category || "uncategorized",
        origin: newsEvidenceOrigin(item),
        reason: [...new Set(reasons)][0],
        reasonLabel: quarantineReasonLabel([...new Set(reasons)][0]),
        reasons: [...new Set(reasons)],
        reasonLabels: [...new Set(reasons)].map((code) => ({ code, label: quarantineReasonLabel(code) })),
        quarantinedAt: validatedAt,
      });
      continue;
    }

    seen.add(canonicalUrl);
    seenStories.push(item);
    const ageDays = Math.max(0, Math.floor((now - publishedAt) / 864e5));
    const entities = newsEntityTags(item);
    const meceAxis = classifyNewsMeceAxis(item);
    const checks = {
      directSource: true,
      canonicalUrl: true,
      language: true,
      sourceSummary: true,
      publishedDate: true,
      retention: true,
      moderation: true,
      duplicate: true,
      storyIdentity: true,
      claimBoundary: true,
    };
    const sourceCategory = item.sourceCategory || item.category || "uncategorized";
    const publicCategory = classifyPublicNewsCategory({ ...item, sourceCategory });
    promoted.push({
      ...item,
      sourceCategory,
      category: publicCategory,
      sourceUrl,
      link: sourceUrl,
      language,
      streamLanguage: language,
      languageVerified: true,
      entities,
      meceAxis,
      verification: {
        id,
        status: "promoted",
        validatedAt,
        canonicalUrl,
        sourceClass: newsSourceClass(item),
        origin: newsEvidenceOrigin(item),
        observedThisRun: wasSourceObservedThisRun(item),
        freshness: ageDays <= 120 ? "current" : "archive",
        ageDays,
        entities,
        meceAxis,
        claimClass: claimPolicy.claimClass,
        claimStage: claimPolicy.claimStage,
        claimType: claimPolicy.claimType,
        structuredFactEligible: claimPolicy.structuredFactEligible,
        checks,
      },
    });
  }

  return { promoted, quarantined };
}

function rebuildNewsCategories(news = [], previousCategories = []) {
  const labels = new Map(previousCategories.map((item) => [item.id, item.label]));
  const grouped = new Map();
  for (const item of news) {
    const id = item.category || "uncategorized";
    const current = grouped.get(id) || { id, label: labels.get(id) || id, count: 0, items: [] };
    current.count += 1;
    if (current.items.length < 16) current.items.push(item);
    grouped.set(id, current);
  }
  return [...grouped.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function buildEvidenceLedger(news = [], validatedAt = new Date().toISOString()) {
  const items = news.map((item) => ({
    id: item.verification?.id,
    canonicalUrl: item.verification?.canonicalUrl,
    sourceClass: item.verification?.sourceClass,
    origin: item.verification?.origin,
    observedThisRun: Boolean(item.verification?.observedThisRun),
    freshness: item.verification?.freshness,
    entities: item.verification?.entities || item.entities || [],
    meceAxis: item.verification?.meceAxis || item.meceAxis || null,
    language: item.streamLanguage || item.language,
    publishedAt: item.date || item.publishedAt || null,
    validatedAt: item.verification?.validatedAt || validatedAt,
  }));
  return {
    methodologyVersion: EVIDENCE_METHODOLOGY_VERSION,
    generatedAt: validatedAt,
    promotedCount: items.length,
    items,
  };
}

function buildQuarantineReport(runId, items = [], generatedAt = new Date().toISOString()) {
  const reasonCounts = {};
  const normalizedItems = items.map((item) => {
    const reasons = [...new Set((item.reasons || []).filter(Boolean))];
    const reason = item.reason || reasons[0] || "unknown-quality-condition";
    return {
      ...item,
      reason,
      reasonLabel: item.reasonLabel || quarantineReasonLabel(reason),
      reasons: reasons.length ? reasons : [reason],
      reasonLabels: reasons.length
        ? reasons.map((code) => ({ code, label: quarantineReasonLabel(code) }))
        : [{ code: reason, label: quarantineReasonLabel(reason) }],
    };
  });
  for (const item of normalizedItems) {
    for (const reason of item.reasons || []) reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
  }
  return {
    schemaVersion: "1.0",
    runId,
    generatedAt,
    retention: "latest-200-metadata-only",
    total: normalizedItems.length,
    reasonCounts,
    items: normalizedItems.slice(0, 200),
  };
}

function buildCrawlAudit(payload = {}, quarantine = {}) {
  const sourceClasses = {};
  const origins = {};
  const translationStates = { verified: 0, unverified: 0, attempted: 0 };
  const translationMatches = [];
  for (const item of payload.news || []) {
    const sourceClass = item.verification?.sourceClass || "missing";
    const origin = item.verification?.origin || "missing";
    sourceClasses[sourceClass] = (sourceClasses[sourceClass] || 0) + 1;
    origins[origin] = (origins[origin] || 0) + 1;
    for (const field of ["title", "summary"]) {
      const translation = item.translation?.[field];
      if (!translation) continue;
      translationStates.attempted += 1;
      if (translation.status === "verified") translationStates.verified += 1;
      else translationStates.unverified += 1;
      if (Number.isFinite(Number(translation.tokenMatchPct))) translationMatches.push(Number(translation.tokenMatchPct));
    }
  }
  const priceRows = (payload.prices?.sections || []).flatMap((section) => section.rows || []);
  const priceSources = [...new Set(priceRows.map((row) => {
    try { return new URL(String(row.sourceUrl || "")).hostname.toLowerCase(); } catch { return ""; }
  }).filter(Boolean))];
  const briefPrices = (payload.intelligence?.briefs || []).map((brief) => brief.price).filter(Boolean);
  const priceReviewRequired = briefPrices.filter((price) => price.periodChangeValidation?.status === "review-required").length;
  return {
    schemaVersion: "1.0",
    runId: payload.runId,
    generatedAt: payload.updatedAt,
    status: payload.quality?.status || "rejected",
    methodologyVersion: EVIDENCE_METHODOLOGY_VERSION,
    promoted: {
      news: payload.news?.length || 0,
      priceRows: payload.quality?.metrics?.priceRows || 0,
      communitySignals: payload.quality?.metrics?.communitySignals || 0,
      benchmarkSignals: payload.quality?.metrics?.benchmarkSignals || 0,
      intelligenceBriefs: payload.intelligence?.briefs?.length || 0,
      factEvents: payload.facts?.events?.length || 0,
      sourceChannels: payload.sourceRegistry?.channels?.length || 0,
    },
    referenceOnly: {
      news: Number(payload.referenceNews?.itemCount || 0),
      communitySignals: Number(payload.communitySignals?.referenceArchive?.itemCount || 0),
      benchmarkSignals: Number(payload.benchmarkSignals?.referenceArchive?.itemCount || 0),
      benchmarkDiscoveries: Number(payload.benchmarkSignals?.discoveryArchive?.itemCount || 0),
    },
    quarantined: {
      news: quarantine.total || 0,
      reasonCounts: quarantine.reasonCounts || {},
    },
    sourceClasses,
    origins,
    translation: {
      ...translationStates,
      sourceOriginal: translationStates.unverified,
      selfHealing: {
        retryPolicy: "unverified rows are not cached and are retried first on the next run",
        ...(koTranslationRunStats || {}),
      },
      averageTokenMatchPct: translationMatches.length
        ? Number((translationMatches.reduce((sum, value) => sum + value, 0) / translationMatches.length).toFixed(1))
        : null,
    },
    priceVerification: {
      sourceCount: priceSources.length,
      crossCheckStatus: priceSources.length >= 2 ? "cross-checked" : "single-source",
      reviewRequired: priceReviewRequired,
    },
    sourceCatalog: payload.sourceRegistry?.catalog || null,
    channelAsOf: payload.quality?.channels || {},
    checks: payload.quality?.checks || [],
  };
}

function buildQualityReport(payload = {}) {
  const news = Array.isArray(payload.news) ? payload.news : [];
  const community = Array.isArray(payload.communitySignals?.items) ? payload.communitySignals.items : [];
  const benchmark = Array.isArray(payload.benchmarkSignals?.stream) ? payload.benchmarkSignals.stream : [];
  const liveCommunity = community.filter(isVerifiedCommunityLiveItem);
  const liveBenchmark = benchmark.filter(isVerifiedBenchmarkLiveItem);
  const briefs = Array.isArray(payload.intelligence?.briefs) ? payload.intelligence.briefs : [];
  const brokerItems = Array.isArray(payload.brokerResearch?.items) ? payload.brokerResearch.items : [];
  const brokerFramework = payload.brokerResearch?.framework || null;
  const factEvents = Array.isArray(payload.facts?.events) ? payload.facts.events : [];
  const sourceChannels = Array.isArray(payload.sourceRegistry?.channels) ? payload.sourceRegistry.channels : [];
  const sourceCatalog = payload.sourceRegistry?.catalog || {};
  const essentialSourceChannels = sourceChannels.filter((channel) => !["broker-research", "fact-timeline"].includes(channel.id));
  const priceRows = (payload.prices?.sections || []).flatMap((section) => section.rows || []);
  const marketIndexes = Object.values(payload.marketHistory?.indexes || {});
  const stocks = Object.values(payload.stocks || {});
  const directNews = news.filter((item) => /^https?:\/\//i.test(directNewsUrl(item)) && !/news\.google\.com/i.test(directNewsUrl(item)));
  const summarizedNews = news.filter((item) => String(item.summary || item.summaryOriginal || "").trim().length >= 20);
  const provenanceNews = news.filter((item) => (
    item.verification?.status === "promoted"
    && item.verification?.id
    && item.verification?.canonicalUrl
    && Object.values(item.verification?.checks || {}).every(Boolean)
  ));
  const currentNews = provenanceNews.filter((item) => item.verification?.freshness === "current");
  const observedNews = currentNews.filter((item) => (
    item.verification?.origin === "live-crawl"
    && item.verification?.observedThisRun === true
  ));
  const liveOnlyNews = provenanceNews.filter((item) => (
    item.verification?.origin === "live-crawl"
    && item.verification?.observedThisRun === true
  ));
  const observedLanguageCounts = observedNews.reduce((counts, item) => {
    const language = verifiedNewsLanguage(item);
    if (language === "english" || language === "chinese") counts[language] += 1;
    return counts;
  }, { english: 0, chinese: 0 });
  const languageCounts = news.reduce((counts, item) => {
    const language = verifiedNewsLanguage(item);
    if (language === "english" || language === "chinese") counts[language] += 1;
    return counts;
  }, { english: 0, chinese: 0 });
  const canonicalUrls = news.map(qualityCanonicalUrl).filter(Boolean);
  const duplicateCount = canonicalUrls.length - new Set(canonicalUrls).size;
  const validMarkets = marketIndexes.filter((item) => Number(item?.latest?.close ?? item?.latest?.value) > 0);
  const validStocks = stocks.filter((item) => (
    Number(item?.latestClose) > 0
    && item?.sourceStatus === "current"
    && item?.stale !== true
    && /^20\d{2}-\d{2}-\d{2}T/.test(String(item?.asOf || ""))
  ));
  const promotedEvidenceIds = new Set(news.map((item) => item.verification?.id).filter(Boolean));
  const validFacts = factEvents.filter((event) => (
    event.current?.provenanceId
    && promotedEvidenceIds.has(event.current.provenanceId)
    && /^https?:\/\//i.test(String(event.current?.sourceUrl || ""))
    && ["official", "research", "authoritative-media"].includes(String(event.current?.sourceClass || ""))
  ));
  const cxmtOffering = factEvents.find((event) => event.id === "cxmt-ipo-offering");
  const cxmtBaseOffering = Number(cxmtOffering?.current?.metrics?.baseOfferingCnyB);
  const cxmtOfferingResolved = Boolean(
    cxmtOffering?.current?.stageId === "final-base-offering"
    && Number.isFinite(cxmtBaseOffering)
    && cxmtBaseOffering > 0
    && /^https?:\/\//i.test(String(cxmtOffering.current.sourceUrl || ""))
  );
  const validBriefs = briefs.filter((brief) => (
    /^https?:\/\//i.test(String(brief.latest?.url || ""))
    && !/news\.google\.com/i.test(String(brief.latest?.url || ""))
    && String(brief.latest?.summary || "").trim().length >= 20
    && String(brief.decision || "").trim()
    && String(brief.reversalKpi || "").trim()
    && String(brief.latest?.provenanceId || "").trim()
    && ["official", "research", "authoritative-media"].includes(String(brief.latest?.sourceClass || ""))
  ));
  const validBrokerItems = brokerItems.filter((item) => {
    const linkedEvidence = /^https?:\/\//i.test(String(item.sourceUrl || "")) && !/news\.google\.com/i.test(String(item.sourceUrl || ""));
    return linkedEvidence
      && item.origin === "live-crawl"
      && typeof item.observedThisRun === "boolean"
      && /^20\d{2}-\d{2}-\d{2}$/.test(String(item.publishedAt || ""))
      && String(item.institution || "").trim()
      && String(item.title || "").trim()
      && String(item.summary || "").trim().length >= 35
      && String(item.insight || "").trim()
      && String(item.reversalKpi || "").trim();
  });
  const currentBrokerItems = validBrokerItems.filter((item) => item.observedThisRun === true);
  const validBrokerFramework = Boolean(
    brokerFramework
    && brokerFramework.dataStatus === "live-observed"
    && String(brokerFramework.lastCheckedAt || "").match(/^20\d{2}-\d{2}-\d{2}$/)
    && String(brokerFramework.sourceRef || "").trim()
    && Array.isArray(brokerFramework.demand) && brokerFramework.demand.length >= 3
    && Array.isArray(brokerFramework.bottlenecks) && brokerFramework.bottlenecks.length >= 3
    && Array.isArray(brokerFramework.options) && brokerFramework.options.length >= 3
    && Array.isArray(brokerFramework.decisions) && brokerFramework.decisions.length >= 4
    && Array.isArray(brokerFramework.scenarios) && brokerFramework.scenarios.length === 3
  );
  const directSourceRatio = news.length ? directNews.length / news.length : 0;
  const summaryRatio = news.length ? summarizedNews.length / news.length : 0;
  const provenanceCoverage = news.length ? provenanceNews.length / news.length : 0;
  const checks = [
    { id: "price_rows", critical: true, passed: priceRows.length >= 10, observed: priceRows.length, threshold: 10 },
    { id: "news_total", critical: true, passed: news.length >= 24, observed: news.length, threshold: 24 },
    { id: "news_english", critical: true, passed: languageCounts.english >= 12, observed: languageCounts.english, threshold: 12 },
    { id: "news_chinese", critical: true, passed: languageCounts.chinese >= 4, observed: languageCounts.chinese, threshold: 4 },
    { id: "news_direct_sources", critical: true, passed: directSourceRatio === 1, observed: Number(directSourceRatio.toFixed(3)), threshold: 1 },
    { id: "news_summaries", critical: true, passed: summaryRatio === 1, observed: Number(summaryRatio.toFixed(3)), threshold: 1 },
    { id: "news_provenance", critical: true, passed: provenanceCoverage === 1, observed: Number(provenanceCoverage.toFixed(3)), threshold: 1 },
    { id: "news_live_only", critical: true, passed: liveOnlyNews.length === news.length, observed: liveOnlyNews.length, threshold: news.length },
    { id: "news_current", critical: true, passed: currentNews.length >= 12, observed: currentNews.length, threshold: 12 },
    { id: "news_observed_this_run", critical: true, passed: observedNews.length >= 12, observed: observedNews.length, threshold: 12 },
    { id: "news_observed_english", critical: true, passed: observedLanguageCounts.english >= 6, observed: observedLanguageCounts.english, threshold: 6 },
    { id: "news_observed_chinese", critical: true, passed: observedLanguageCounts.chinese >= 2, observed: observedLanguageCounts.chinese, threshold: 2 },
    { id: "news_duplicates", critical: true, passed: duplicateCount === 0, observed: duplicateCount, threshold: 0 },
    { id: "community_signals", critical: true, passed: liveCommunity.length >= 5, observed: liveCommunity.length, threshold: 5 },
    { id: "community_live_only", critical: true, passed: liveCommunity.length === community.length, observed: liveCommunity.length, threshold: community.length },
    { id: "benchmark_live_only", critical: true, passed: liveBenchmark.length === benchmark.length, observed: liveBenchmark.length, threshold: benchmark.length },
    { id: "decision_briefs", critical: true, passed: validBriefs.length >= 6, observed: validBriefs.length, threshold: 6 },
    { id: "fact_timeline_integrity", critical: true, passed: validFacts.length === factEvents.length, observed: validFacts.length, threshold: factEvents.length },
    { id: "cxmt_offering_stage", critical: false, passed: !cxmtOffering || cxmtOfferingResolved, observed: cxmtOffering?.current?.stageId || "not-observed-this-run", threshold: "final-base-offering when observed" },
    {
      id: "source_registry",
      critical: true,
      passed: sourceChannels.length >= 7 && essentialSourceChannels.every((channel) => Number(channel.records || 0) > 0),
      observed: essentialSourceChannels.filter((channel) => Number(channel.records || 0) > 0).length,
      threshold: essentialSourceChannels.length,
    },
    {
      id: "source_catalog",
      critical: true,
      passed: Number(sourceCatalog.configuredSources || 0) >= 24
        && Number(sourceCatalog.officialConfigured || 0) >= 16
        && Number(sourceCatalog.discoveryQueries || 0) >= 20
        && sourceCatalog.failClosed === true,
      observed: Number(sourceCatalog.configuredSources || 0),
      threshold: 24,
    },
    {
      id: "source_catalog_observed",
      critical: false,
      passed: Number(sourceCatalog.observedSources || 0) >= 4,
      observed: Number(sourceCatalog.observedSources || 0),
      threshold: 4,
    },
    { id: "broker_research", critical: false, passed: validBrokerItems.length >= 1, observed: validBrokerItems.length, threshold: 1 },
    { id: "broker_framework", critical: false, passed: validBrokerFramework, observed: validBrokerFramework ? 1 : 0, threshold: 1 },
    { id: "market_indexes", critical: true, passed: validMarkets.length >= 3, observed: validMarkets.length, threshold: 3 },
    { id: "peer_stocks", critical: true, passed: validStocks.length >= 2, observed: validStocks.length, threshold: 2 },
  ];
  const failures = checks.filter((check) => check.critical && !check.passed);
  return {
    status: failures.length ? "rejected" : "verified",
    verifiedAt: failures.length ? null : payload.updatedAt,
    methodologyVersion: EVIDENCE_METHODOLOGY_VERSION,
    checks,
    failures: failures.map((check) => check.id),
    metrics: {
      priceRows: priceRows.length,
      newsItems: news.length,
      englishNews: languageCounts.english,
      chineseNews: languageCounts.chinese,
      directSourceRatio: Number(directSourceRatio.toFixed(3)),
      summaryRatio: Number(summaryRatio.toFixed(3)),
      provenanceCoverage: Number(provenanceCoverage.toFixed(3)),
      liveOnlyNews: liveOnlyNews.length,
      currentNews: currentNews.length,
      observedThisRunNews: observedNews.length,
      observedThisRunEnglish: observedLanguageCounts.english,
      observedThisRunChinese: observedLanguageCounts.chinese,
      quarantinedNews: Number(payload.quarantineSummary?.total || 0),
      duplicateCount,
      communitySignals: liveCommunity.length,
      communityReferenceSignals: Number(payload.communitySignals?.referenceArchive?.itemCount || 0),
      benchmarkSignals: liveBenchmark.length,
      benchmarkReferenceSignals: Number(payload.benchmarkSignals?.referenceArchive?.itemCount || 0),
      benchmarkDiscoverySignals: Number(payload.benchmarkSignals?.discoveryArchive?.itemCount || 0),
      decisionBriefs: validBriefs.length,
      factEvents: validFacts.length,
      sourceChannels: sourceChannels.length,
      configuredSources: Number(sourceCatalog.configuredSources || 0),
      observedCatalogSources: Number(sourceCatalog.observedSources || 0),
      officialCatalogSources: Number(sourceCatalog.officialConfigured || 0),
      officialObservedSources: Number(sourceCatalog.officialObserved || 0),
      catalogDiscoveryQueries: Number(sourceCatalog.discoveryQueries || 0),
      brokerResearch: validBrokerItems.length,
      brokerResearchCurrent: currentBrokerItems.length,
      brokerFramework: validBrokerFramework ? 1 : 0,
      brokerNewsCitations: validBrokerItems.filter((item) => item.evidenceType === "news-citation").length,
      marketIndexes: validMarkets.length,
      peerStocks: validStocks.length,
    },
    channels: {
      prices: payload.prices?.updatedAt || payload.updatedAt,
      news: payload.updatedAt,
      community: payload.communitySignals?.updatedAt || payload.updatedAt,
      brokerResearch: payload.brokerResearch?.updatedAt || payload.updatedAt,
      markets: payload.marketHistory?.updatedAt || payload.updatedAt,
    },
  };
}

/* ---------------- Quantitative metrics pipeline (data/quant.json) ----------------
 * Live numbers that replace hardcoded UI constants: FX, AI-demand stock proxies,
 * Micron fundamentals (SEC EDGAR), TSMC monthly revenue (TWSE OpenAPI), and
 * memory price momentum derived from our own accumulated price history.
 * Every metric carries value + asOf + source so the UI can show provenance. */

const QUANT_FX = [
  { id: "usdkrw", symbol: "KRW=X", fredId: "DEXKOUS", label: "USD/KRW", currency: "KRW", sourceUrl: "https://fred.stlouisfed.org/series/DEXKOUS", fallbackSourceUrl: "https://finance.yahoo.com/quote/KRW=X/" },
  { id: "usdtwd", symbol: "TWD=X", fredId: "DEXTAUS", label: "USD/TWD", currency: "TWD", sourceUrl: "https://fred.stlouisfed.org/series/DEXTAUS", fallbackSourceUrl: "https://finance.yahoo.com/quote/TWD=X/" },
];

const QUANT_AI_PROXIES = [
  { id: "nvda", symbol: "NVDA", label: "NVIDIA", sourceUrl: "https://finance.yahoo.com/quote/NVDA/" },
  { id: "amd", symbol: "AMD", label: "AMD", sourceUrl: "https://finance.yahoo.com/quote/AMD/" },
];

function quantSeriesChangePct(points = [], daysAgo = 30) {
  const latest = points[points.length - 1];
  if (!latest) return null;
  const target = latest.time - daysAgo * 86400000;
  let base = points[0];
  for (const point of points) {
    if (point.time <= target) base = point;
    else break;
  }
  if (!base || !Number.isFinite(base.close) || base.close <= 0) return null;
  return Number((((latest.close - base.close) / base.close) * 100).toFixed(2));
}

async function fetchFredHistory(entry) {
  const start = new Date(Date.now() - (365 * 5 + 10) * 864e5).toISOString().slice(0, 10);
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(entry.fredId)}&cosd=${start}`;
  const csv = await fetchText(url);
  const points = String(csv).split(/\r?\n/).slice(1).map((line) => {
    const [date, rawValue] = line.split(",");
    const value = Number(rawValue);
    const time = Date.parse(`${date}T00:00:00.000Z`);
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(String(date)) || !Number.isFinite(time) || !Number.isFinite(value) || value <= 0) return null;
    return { date: new Date(time).toISOString(), time, close: value, value, rawClose: value, adjusted: false };
  }).filter(Boolean).sort((a, b) => a.time - b.time);
  if (points.length < 2) throw new Error(`FRED ${entry.fredId} history empty`);
  return { points, source: "Federal Reserve H.10 via FRED", sourceUrl: entry.sourceUrl, currency: entry.currency };
}

async function collectQuantSeries(entry) {
  let result = null;
  let points = [];
  let source = "Yahoo Finance chart API";
  let sourceUrl = entry.fallbackSourceUrl || entry.sourceUrl;
  let currency = entry.currency || null;
  let sourceFallback = false;
  let fredError = null;
  if (entry.fredId) {
    try {
      const fred = await fetchFredHistory(entry);
      points = fred.points;
      source = fred.source;
      sourceUrl = fred.sourceUrl;
      currency = fred.currency;
    } catch (error) {
      sourceFallback = true;
      fredError = error;
    }
  }
  if (!points.length) {
    try {
      result = await fetchYahooChartResult(entry.symbol, "5y", "1d");
    } catch (error) {
      if (fredError) throw new Error(`FRED ${entry.fredId}: ${fredError.message}; Yahoo fallback: ${error.message}`);
      throw error;
    }
    points = yahooHistoryPoints(result);
    currency = result.meta?.currency || currency;
  }
  if (fredError) {
    // The provider is degraded, but the data channel succeeded through the
    // documented Yahoo fallback. Record that distinction without creating a
    // false source-outage streak or operations alert.
    note(`quant:FRED ${entry.label}`, true, `FRED unavailable · Yahoo fallback ${points.length} observations`);
  }
  const latest = points[points.length - 1];
  if (!latest) throw new Error("empty series");
  const evaluatedAt = new Date().toISOString();
  const maxEndLagDays = 14;
  const endLagDays = Math.max(0, (Date.parse(evaluatedAt) - Number(latest.time || Date.parse(latest.date))) / 864e5);
  const staleEnd = !Number.isFinite(endLagDays) || endLagDays > maxEndLagDays;
  // Anchor eligibility to the crawl clock, not to the series' own last row.
  // Otherwise a feed that stopped months ago would always appear current.
  const periods = calculateAllHorizonStats(points, { cadence: "daily", asOf: evaluatedAt });
  return {
    id: entry.id,
    label: entry.label,
    symbol: entry.symbol,
    status: staleEnd ? "stale" : "live",
    value: staleEnd ? null : latest.close,
    currency,
    asOf: latest.date.slice(0, 10),
    evaluatedAt,
    latestObservationAt: latest.date.slice(0, 10),
    endLagDays: Number.isFinite(endLagDays) ? Number(endLagDays.toFixed(2)) : null,
    maxEndLagDays,
    changePct30d: staleEnd ? null : quantSeriesChangePct(points, 30),
    changePct90d: staleEnd ? null : quantSeriesChangePct(points, 90),
    changePct1y: staleEnd ? null : periods["1y"].cumulativePct,
    changePct3y: staleEnd ? null : periods["3y"].cumulativePct,
    changePct5y: staleEnd ? null : periods["5y"].cumulativePct,
    periods,
    history5y: {
      cadence: "daily",
      unit: currency,
      status: staleEnd ? "stale" : points.length >= 2 ? "live" : "accumulating",
      sourceUrl,
      usesAdjustedClose: points.some((point) => point.adjusted),
      points: points.map((point) => ({ date: point.date.slice(0, 10), value: point.close })),
    },
    history30d: {
      cadence: "daily",
      unit: currency,
      status: staleEnd ? "stale" : points.length >= 2 ? "live" : "accumulating",
      sourceUrl,
      points: points
        .filter((point) => latest.time - point.time <= 35 * 86400000)
        .map((point) => ({ date: point.date.slice(0, 10), value: point.close })),
    },
    source,
    sourceUrl,
    sourceFallback,
  };
}

// SEC EDGAR companyfacts: filed 10-Q/10-K XBRL values, no key required.
async function fetchEdgarMicronFundamentals() {
  const url = "https://data.sec.gov/api/xbrl/companyfacts/CIK0000723125.json";
  const res = await fetch(url, {
    signal: fetchSignal("official"),
    headers: { "User-Agent": "memory-intelligence-dashboard admin@dicacros.dev", Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const gaap = json?.facts?.["us-gaap"] || {};
  const quarterlyHistory = (tags) => {
    let best = [];
    for (const tag of tags) {
      const units = gaap[tag]?.units?.USD;
      if (!Array.isArray(units)) continue;
      const byEnd = new Map();
      for (const row of units) {
        const durationDays = row.start && row.end ? (Date.parse(row.end) - Date.parse(row.start)) / 864e5 : NaN;
        if (!["10-Q", "10-K"].includes(row.form) || !Number.isFinite(durationDays) || durationDays < 60 || durationDays > 130) continue;
        if (!Number.isFinite(Number(row.val))) continue;
        const previous = byEnd.get(row.end);
        if (!previous || Date.parse(row.filed || 0) >= Date.parse(previous.filed || 0)) byEnd.set(row.end, row);
      }
      const rows = [...byEnd.values()]
        .sort((a, b) => Date.parse(a.end) - Date.parse(b.end))
        .slice(-20)
        .map((row) => ({ tag, date: row.end, value: Number(row.val), start: row.start, form: row.form, filed: row.filed, fy: row.fy, fp: row.fp }));
      if (rows.length > best.length) best = rows;
    }
    return best;
  };
  const instantHistory = (tags) => {
    let best = [];
    for (const tag of tags) {
      const units = gaap[tag]?.units?.USD;
      if (!Array.isArray(units)) continue;
      const byEnd = new Map();
      for (const row of units) {
        if (!["10-Q", "10-K"].includes(row.form) || !row.end || !Number.isFinite(Number(row.val))) continue;
        const previous = byEnd.get(row.end);
        if (!previous || Date.parse(row.filed || 0) >= Date.parse(previous.filed || 0)) byEnd.set(row.end, row);
      }
      const rows = [...byEnd.values()]
        .sort((a, b) => Date.parse(a.end) - Date.parse(b.end))
        .slice(-20)
        .map((row) => ({ tag, date: row.end, value: Number(row.val), form: row.form, filed: row.filed, fy: row.fy, fp: row.fp }));
      if (rows.length > best.length) best = rows;
    }
    return best;
  };
  const pickQuarterly = (tags) => {
    for (const tag of tags) {
      const units = gaap[tag]?.units?.USD;
      if (!Array.isArray(units)) continue;
      const row = units
        .filter((r) => (r.form === "10-Q" || r.form === "10-K") && r.start && r.end)
        .filter((r) => new Date(r.end) - new Date(r.start) < 130 * 86400000)
        .sort((a, b) => new Date(b.end) - new Date(a.end))[0];
      if (row) return { tag, value: row.val, start: row.start, end: row.end, form: row.form, fy: row.fy, fp: row.fp };
    }
    return null;
  };
  const pickInstant = (tag) => {
    const units = gaap[tag]?.units?.USD || [];
    const row = units
      .filter((r) => r.end && (r.form === "10-Q" || r.form === "10-K"))
      .sort((a, b) => new Date(b.end) - new Date(a.end))[0];
    return row ? { tag, value: row.val, end: row.end, form: row.form, fy: row.fy, fp: row.fp } : null;
  };
  const revenue = pickQuarterly(["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet"]);
  const inventory = pickInstant("InventoryNet");
  const grossProfit = pickQuarterly(["GrossProfit"]);
  const history = {
    cadence: "quarterly",
    revenue: quarterlyHistory(["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet"]),
    grossProfit: quarterlyHistory(["GrossProfit"]),
    inventory: instantHistory(["InventoryNet"]),
  };
  if (!revenue && !inventory) throw new Error("EDGAR facts empty");
  return {
    company: "Micron Technology",
    cik: "0000723125",
    revenue,
    grossProfit,
    inventory,
    history,
    source: "SEC EDGAR companyfacts (10-Q/10-K XBRL)",
    sourceUrl: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000723125&type=10-Q",
  };
}

const TSMC_MONTHS = new Map([
  ["jan", 1], ["feb", 2], ["mar", 3], ["apr", 4], ["may", 5], ["jun", 6],
  ["jul", 7], ["aug", 8], ["sep", 9], ["sept", 9], ["oct", 10], ["nov", 11], ["dec", 12],
]);

function isTsmcCloudflareChallenge(html = "") {
  return /<title>Just a moment<\/title>|challenges\.cloudflare\.com|__cf_chl_/i.test(String(html));
}

export function parseTsmcAnnualRevenueHtml(html, year, sourceUrl) {
  const points = [];
  for (const rowMatch of String(html || "").matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => stripHTML(cell[1]).trim());
    if (cells.length < 3) continue;
    const monthName = cells[0].toLowerCase().replace(/[^a-z]/g, "");
    const month = TSMC_MONTHS.get(monthName);
    const revenueMillionTwd = Number(String(cells[1]).replace(/[^\d.-]/g, ""));
    const yoyPct = Number(String(cells[2]).replace(/[^\d.-]/g, ""));
    if (!month || !Number.isFinite(revenueMillionTwd) || revenueMillionTwd <= 0) continue;
    points.push({
      date: `${year}-${String(month).padStart(2, "0")}`,
      revenueMillionTwd,
      revenueBillionTwd: Number((revenueMillionTwd / 1000).toFixed(1)),
      yoyPct: Number.isFinite(yoyPct) ? yoyPct : null,
      sourceUrl,
    });
  }
  return points;
}

async function fetchTsmcOfficialRevenueHistory() {
  const currentYear = new Date().getUTCFullYear();
  const years = Array.from({ length: 6 }, (_, index) => currentYear - 5 + index);
  const settled = await Promise.allSettled(years.map(async (year) => {
    const sourceUrl = `https://investor.tsmc.com/english/monthly-revenue/${year}`;
    let points = [];
    try {
      const html = await fetchText(sourceUrl);
      if (isTsmcCloudflareChallenge(html)) throw new Error("TSMC official IR access challenged");
      points = parseTsmcAnnualRevenueHtml(html, year, sourceUrl);
    } catch (error) {
      // Do not multiply a known bot challenge into 24 Wayback requests. The
      // latest TWSE disclosure still succeeds and archive history remains
      // explicitly unavailable for this run.
      if (/TSMC official IR access challenged/i.test(String(error?.message || ""))) throw error;
      points = [];
    }
    if (!points.length) {
      const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(sourceUrl)}&output=json&from=${year}&to=${currentYear + 1}&filter=statuscode:200&filter=mimetype:text/html&collapse=digest&limit=20`;
      const rows = JSON.parse(await fetchArchiveText(cdxUrl));
      const timestamps = (Array.isArray(rows) ? rows.slice(1) : []).map((row) => row[1]).filter(Boolean).sort();
      for (const timestamp of timestamps.slice(-4).reverse()) {
        const archiveUrl = `https://web.archive.org/web/${timestamp}id_/${sourceUrl}`;
        points = parseTsmcAnnualRevenueHtml(await fetchArchiveText(archiveUrl, 2), year, sourceUrl)
          .map((point) => ({ ...point, archiveUrl }));
        if (points.length) break;
      }
    }
    if (!points.length) throw new Error(`TSMC ${year} table empty`);
    return points;
  }));
  const points = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  if (!points.length) throw new Error("TSMC official annual history unavailable");
  return points.sort((a, b) => a.date.localeCompare(b.date)).slice(-61);
}

// TWSE OpenAPI: official monthly revenue disclosures for TWSE-listed companies.
async function fetchTsmcMonthlyRevenue() {
  const url = "https://openapi.twse.com.tw/v1/opendata/t187ap05_L";
  const res = await fetch(url, {
    signal: fetchSignal("official"),
    headers: { "User-Agent": BROWSER_UA, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rows = await res.json();
  if (!Array.isArray(rows) || !rows.length) throw new Error("empty TWSE payload");
  const keys = Object.keys(rows[0]);
  const codeKey = keys.find((k) => /代號|Code/i.test(k));
  const monthKey = keys.find((k) => /資料年月/.test(k));
  const revenueKey = keys.find((k) => /當月營收/.test(k) && !/累計|上月|去年/.test(k));
  const yoyKey = keys.find((k) => /去年同月增減/.test(k));
  const momKey = keys.find((k) => /上月比較增減/.test(k));
  const row = rows.find((r) => String(r[codeKey] ?? "") === "2330");
  if (!row || !revenueKey) throw new Error("TSMC row/fields missing");
  const num = (v) => {
    const n = Number(String(v ?? "").replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  };
  const roc = String(row[monthKey] || "");
  const rocMatch = roc.match(/^(\d{3})(\d{2})$/);
  const month = rocMatch ? `${1911 + Number(rocMatch[1])}-${rocMatch[2]}` : null;
  const value = num(row[revenueKey]);
  if (!Number.isFinite(value)) throw new Error("TSMC revenue parse failed");
  let officialHistory = [];
  let officialHistoryError = null;
  try {
    officialHistory = await fetchTsmcOfficialRevenueHistory();
    // The IR archive is a working live source even when the current calendar
    // window exposes slightly fewer than the 60 points requested by the UI.
    // Keep the dataset "partial" below 60, but do not count a successfully
    // parsed official archive as a crawler failure. Coverage gaps remain
    // visible to the backtest audit instead of inflating source-health errors.
    note(
      "quant:TSMC history",
      officialHistory.length > 0,
      `공식 IR 월매출 ${officialHistory.length}개월${officialHistory.length < 60 ? " · 부분 이력" : ""}`,
    );
  } catch (error) {
    officialHistoryError = error;
    // The public IR site can challenge automated requests. TWSE remains the
    // primary official disclosure for the latest monthly figure, so this is a
    // documented archive limitation rather than a failed live-data channel.
    note("quant:TSMC history", true, "IR archive unavailable · TWSE official current disclosure retained");
  }
  return {
    company: "TSMC (2330)",
    month,
    revenueThousandTwd: value,
    revenueBillionTwd: Number((value / 1e6).toFixed(1)),
    yoyPct: num(row[yoyKey]),
    momPct: num(row[momKey]),
    revenueHistory: {
      cadence: "monthly",
      unit: "B TWD",
      status: officialHistory.length >= 60 ? "live" : (officialHistory.length ? "partial" : "unavailable"),
      points: officialHistory.map((point) => ({ date: point.date, value: point.revenueBillionTwd, sourceUrl: point.sourceUrl, archiveUrl: point.archiveUrl || null })),
    },
    yoyHistory: {
      cadence: "monthly",
      unit: "% YoY",
      status: officialHistory.length >= 60 ? "live" : (officialHistory.length ? "partial" : "unavailable"),
      points: officialHistory.filter((point) => Number.isFinite(point.yoyPct)).map((point) => ({ date: point.date, value: point.yoyPct, sourceUrl: point.sourceUrl, archiveUrl: point.archiveUrl || null })),
    },
    officialHistoryStatus: officialHistory.length >= 60 ? "live" : (officialHistory.length ? "partial" : "unavailable"),
    officialHistoryError: officialHistoryError?.message || null,
    note: String(row["備註"] || "").slice(0, 120) || null,
    source: "TWSE OpenAPI 月營業收入 (official disclosure)",
    sourceUrl: "https://openapi.twse.com.tw/v1/opendata/t187ap05_L",
  };
}

export function siaMonthlyPdfFallbackUrls(now = new Date()) {
  const reference = Number.isFinite(now?.getTime?.()) ? now : new Date();
  const currentMonth = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const urls = [];
  // SIA publishes the table/graph roughly two months after the measured month.
  // Probe the three most recent expected publications so the fallback rolls
  // forward automatically without treating an old PDF as permanently current.
  for (let lag = 2; lag <= 4; lag += 1) {
    const dataMonth = new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() - lag, 1));
    const publicationMonth = new Date(Date.UTC(dataMonth.getUTCFullYear(), dataMonth.getUTCMonth() + 2, 1));
    if (publicationMonth > currentMonth) continue;
    urls.push(
      `https://www.semiconductors.org/wp-content/uploads/${publicationMonth.getUTCFullYear()}/${String(publicationMonth.getUTCMonth() + 1).padStart(2, "0")}/${monthNames[dataMonth.getUTCMonth()]}-${dataMonth.getUTCFullYear()}-GSR-Table-and-Graph.pdf`,
    );
  }
  return urls;
}

const OFFICIAL_INDUSTRY_PROBES = [
  { id: "marvell-skhynix-cmmax-2026", label: "Marvell·SK hynix CMM-Ax CXL-PNM", url: "https://www.marvell.com/blogs/accelerating-ai-infrastructure-marvell-structera-sk-hynix-cxl-memory.html", pattern: /CMM-Ax.{0,800}(?:5\.5x|3\.6x)|Structera\s+A.{0,800}SK\s+hynix/is },
  { id: "wsts", label: "WSTS forecast", url: "https://www.wsts.org/76/Recent-News-Release", pattern: /WSTS|World Semiconductor Trade Statistics/i },
  {
    id: "sia",
    label: "SIA monthly sales",
    url: "https://www.semiconductors.org/news-events/latest-news/",
    // GitHub-hosted runners can receive an isolated 403 from the public news
    // index. Keep the source of record inside SIA and fall back first to the
    // WordPress JSON/search and RSS endpoints, then to SIA's market-data hubs.
    fallbackUrls: [
      "https://www.semiconductors.org/wp-json/wp/v2/search?search=Global%20Semiconductor%20Sales&per_page=5",
      "https://www.semiconductors.org/feed/",
      "https://www.semiconductors.org/policies/tax/market-data/?type=post",
      "https://www.semiconductors.org/policies/market-data/",
    ],
    pdfFallbackUrls: siaMonthlyPdfFallbackUrls(),
    pattern: /Semiconductor Industry Association|Global Semiconductor Sales|Market Data/i,
  },
  // These direct source checks make the decision-grade market and regulatory
  // cards fail visibly when the primary page moves or its asserted figure no
  // longer appears. They are health checks only; a reachable page never turns
  // a forecast or a reported figure into an actual result.
  { id: "trendforce-memory-2026", label: "TrendForce 2026/2027 memory forecast", url: "https://www.trendforce.com/presscenter/news/20260529-13068.html", pattern: /889\.3\s*billion|1\.28\s*trillion/i },
  { id: "trendforce-rubin-mix-2026", label: "TrendForce NVIDIA 2026 product mix", url: "https://www.trendforce.com/presscenter/news/20260408-13003.html", pattern: /Rubin.{0,200}(?:29%|29 percent).{0,200}(?:22%|22 percent)|Blackwell.{0,200}(?:61%|61 percent).{0,200}(?:71%|71 percent)/is },
  { id: "trendforce-memory-price-3q26", label: "TrendForce 3Q26 DRAM and NAND contract prices", url: "https://www.trendforce.com/presscenter/news/20260703-13134.html", pattern: /DRAM.{0,400}13.{0,40}18%|NAND.{0,400}10.{0,40}15%/is },
  {
    id: "company-skhynix-leadership",
    label: "SK hynix official leadership",
    url: "https://www.skhynix.com/company/UI-FR-CP0301/",
    fallbackUrls: ["https://news.skhynix.com/invention-day-2026/"],
    pattern: /Kwak\s+Noh-Jung|President\s*(?:&|and)\s*CEO|Chief\s+Development\s+Officer|Ahn\s+Hyun/i,
  },
  {
    id: "company-samsung-leadership",
    label: "Samsung Electronics official leadership",
    url: "https://news.samsung.com/global/samsung-electronics-announces-new-leadership-4",
    fallbackUrls: [
      "https://www.samsung.com/global/ir/governance-csr/board-committee/",
      "https://www.samsung.com/global/ir/governance-csr/board-of-directors/",
    ],
    pattern: /Young\s+Hyun\s+Jun|Tae\s+Moon\s+Roh|TM\s+Roh|DS\s+Division/i,
  },
  {
    id: "company-micron-leadership",
    label: "Micron official leadership",
    url: "https://www.micron.com/about/company/leadership/",
    fallbackUrls: [
      "https://www.micron.com/about/company/leadership/scott-deboer",
      "https://www.micron.com/about/company",
    ],
    pattern: /Sanjay\s+Mehrotra|Scott\s+(?:J\.\s+)?DeBoer|leadership/i,
  },
  {
    id: "company-nvidia-leadership",
    label: "NVIDIA official leadership",
    url: "https://investor.nvidia.com/governance/management-team/default.aspx",
    fallbackUrls: [
      "https://www.nvidia.com/en-eu/about-nvidia/governance/management-team/jensen-huang/",
      "https://www.nvidia.com/en-eu/about-nvidia/governance/management-team/colette-kress/",
    ],
    pattern: /Jensen\s+Huang|Colette\s+Kress|management\s+team/i,
  },
  {
    id: "company-tsmc-leadership",
    label: "TSMC official executives",
    url: "https://www.tsmc.com/english/aboutTSMC/executives",
    fallbackUrls: [
      "https://www.sec.gov/Archives/edgar/data/1046179/000162828026025362/tsm-20251231.htm",
      "https://www.sec.gov/Archives/edgar/data/1046179/000162828026025362/exhibit131.htm",
      // NVIDIA's issuer-distributed release includes a direct quotation from
      // TSMC and identifies C.C. Wei's current role. It remains available when
      // both TSMC and SEC block the GitHub-hosted runner by IP.
      "https://www.globenewswire.com/news-release/2026/06/01/3304000/0/en/NVIDIA-and-TSMC-Bring-AI-Into-Fabs-to-Advance-Semiconductor-Design-and-Manufacturing.html",
    ],
    retryAttempts: 3,
    pattern: /C\.?\s*C\.?\s*Wei|Y\.?\s*P\.?\s*Chyn|Wendell\s+Huang|executives/i,
  },
  {
    id: "company-amd-leadership",
    label: "AMD official leadership",
    url: "https://www.amd.com/en/corporate/leadership.html",
    fallbackUrls: ["https://www.amd.com/en/corporate.html"],
    pattern: /Lisa\s+Su|Mark\s+Papermaster|leadership/i,
  },
  {
    id: "company-asml-leadership",
    label: "ASML board of management",
    url: "https://www.asml.com/en/company/governance/board-of-management",
    pattern: /Christophe\s+Fouquet|Roger\s+Dassen|board\s+of\s+management/i,
  },
  {
    id: "company-broadcom-leadership",
    label: "Broadcom official leadership",
    url: "https://investors.broadcom.com/board-member/hock-e-tan",
    fallbackUrls: [
      "https://investors.broadcom.com/news-releases/news-release-details/broadcom-announces-planned-chief-financial-officer-transition",
      "https://investors.broadcom.com/corporate-governance/board-of-directors",
    ],
    pattern: /Hock\s+E\.?\s+Tan|Amie\s+Thuener|President\s*(?:&|and)\s*Chief\s+Executive\s+Officer/i,
  },
  {
    id: "company-jcet-profile",
    label: "JCET official company and governance profile",
    url: "https://www.jcetglobal.com/en",
    fallbackUrls: [
      // JCET supplied this result release directly to the distributor. Keep
      // it ahead of SSE mirrors because the exchange intermittently drops
      // connections from GitHub-hosted runners.
      "https://www.prnewswire.com/news-releases/jcet-reports-42-7-yoy-surge-in-q1-2026-net-profit-attributable-to-shareholders-302755543.html",
      "https://english.sse.com.cn/news/newsrelease/voice/c/c_20260629_10823788.shtml",
      "https://english.sse.com.cn/news/newsrelease/digest/c/c_20250423_10777555.shtml",
    ],
    retryAttempts: 3,
    pattern: /turnkey|packaging|testing|committee|JCET/i,
  },
  {
    id: "company-smic-profile",
    label: "SMIC official company profile",
    url: "https://www.smics.com/en/site/about_summary",
    fallbackUrls: [
      "https://www.smics.com/en",
      "https://english.sse.com.cn/news/newsrelease/voice/c/c_20260414_10815146.shtml",
      "https://big5.sse.com.cn/site/cht/www.sse.com.cn/star/en/marketdata/snapshot/c/5481443.shtml",
    ],
    pdfFallbackUrls: [
      "https://www1.hkexnews.hk/listedco/listconews/sehk/2025/0409/2025040900322.pdf",
    ],
    retryAttempts: 3,
    pattern: /Semiconductor\s+Manufacturing\s+International|SMIC|foundry/i,
  },
  {
    id: "company-naura-profile",
    label: "NAURA official company profile",
    url: "https://www.naura.com/about/",
    fallbackUrls: ["https://www-a.naura.com/about/index.html", "https://www.naura.com/"],
    retryAttempts: 3,
    pattern: /NAURA|002371|semiconductor|北方华创/i,
  },
  {
    id: "company-amec-profile",
    label: "AMEC official company profile",
    url: "https://www.amec-inc.com/",
    fallbackUrls: ["https://www.amec-inc.com/uploads/files/20250611/17496080859885.pdf"],
    retryAttempts: 3,
    pattern: /AMEC|688012|etch|MOCVD|中微公司/i,
  },
  {
    id: "xmc-company-profile",
    label: "XMC official company classification",
    url: "https://www.xmcwh.com/en/site/about-XMC",
    retryAttempts: 3,
    pattern: /12-inch.{0,400}(?:wafer foundry|3D IC)|specialty memory/is,
  },
  {
    id: "samsung-hbm4-roadmap",
    label: "Samsung HBM4 and Custom HBM roadmap",
    url: "https://semiconductor.samsung.com/kr/news-events/news/samsung-ships-industry-first-commercial-hbm4-with-ultimate-performance-for-ai-computing/",
    fallbackUrls: ["https://news.samsung.com/global/samsung-ships-industry-first-commercial-hbm4-with-ultimate-performance-for-ai-computing"],
    pattern: /11\.7\s*Gbps.{0,500}13\s*Gbps|HBM4E.{0,400}Custom HBM/is,
  },
  {
    id: "skhynix-ces-2026-ai-memory",
    label: "SK hynix CES 2026 AI memory portfolio",
    url: "https://news.skhynix.com/sk-hynix-showcases-next-generation-ai-memory-innovations-at-ces-2026/",
    pattern: /cHBM.{0,800}AiMX.{0,800}CMM-Ax/is,
  },
  {
    id: "sse-cxmt-final-offering",
    label: "SSE / China Daily CXMT final offering",
    url: "https://english.sse.com.cn/news/newsrelease/voice/c/c_20260716_10825660.shtml",
    // SSE republishes the China Daily report but intermittently blocks hosted
    // runners. Verify the same article at its original publisher before
    // declaring the evidence source unavailable.
    fallbackUrls: [
      "https://www.chinadaily.com.cn/a/202607/15/WS6a56f42da310986e2b4655b8.html",
    ],
    pattern: /57\.9\s*billion|579\.2\s*billion|8\.66\s*yuan/i,
  },
  {
    id: "sse-cxmt-financials",
    label: "SSE / Global Times CXMT prospectus financials",
    url: "https://english.sse.com.cn/news/newsrelease/voice/c/c_20260528_10819990.shtml",
    fallbackUrls: [
      "https://www.globaltimes.cn/page/202605/1362091.shtml",
    ],
    retryAttempts: 3,
    pattern: /61\.799\s*billion.{0,300}50\.80\s*billion.{0,300}33\.012\s*billion/is,
  },
  {
    id: "micron-fq3-2026",
    label: "Micron fiscal Q3 2026 results",
    url: "https://investors.micron.com/node/50671",
    fallbackUrls: ["https://investors.micron.com/node/50671/pdf"],
    pattern: /41[,\s]?456|41\.46\s*billion.{0,500}84\.6/is,
  },
  {
    id: "micron-sixteen-sca",
    label: "Micron sixteen strategic customer agreements",
    url: "https://investors.micron.com/news-releases/news-release-details/micron-and-ford-sign-strategic-agreement-strengthen-long-term",
    pattern: /one\s+of\s+the\s+16.{0,120}fiscal\s+third-quarter\s+2026/is,
  },
  {
    id: "counterpoint-dram-q1-2026",
    label: "Counterpoint Q1 2026 DRAM revenue shares",
    url: "https://japan.counterpointresearch.com/insights/global-dram-revenue-surges-to-near-dollar-100-billion-mark-in-q1-2026/",
    fallbackUrls: ["https://germany.counterpointresearch.com/insights/pr/weltweiter-dram-umsatz-steigt-im-q1-2026-um-80-auf-rekordhoch/"],
    pattern: /CXMT.{0,120}(?:8%|8 percent)|Samsung.{0,120}(?:38%|38 percent)/is,
  },
  {
    id: "sandisk-bics10-sampling",
    label: "Sandisk BiCS10 sampling",
    url: "https://www.sandisk.com/company/newsroom/press-releases/2026/2026-07-02-sandisk-announces-bics10-1tb-tlc",
    pattern: /332\s+(?:memory\s+)?layers.{0,300}4\.8\s*Gb\/s|59\s*percent\s+bit\s+density/is,
  },
  { id: "census-former-veu-c79", label: "Census former-VEU C79 license reporting", url: "https://content.govdelivery.com/accounts/USCENSUS/bulletins/4008e2b", pattern: /C79|H-prefix|former VEU/i },
];

const OFFICIAL_PROBE_RETRYABLE_STATUSES = new Set([403, 408, 425, 429, 500, 502, 503, 504]);

function officialProbeMatches(pattern, html = "") {
  if (pattern?.global || pattern?.sticky) pattern.lastIndex = 0;
  return Boolean(pattern?.test(String(html || "")));
}

function officialProbeHeaders(url, retry = false) {
  let referer = "";
  try { referer = `${new URL(url).origin}/`; } catch { /* URLs are curated constants */ }
  // SEC asks automated clients to identify the application and a contact
  // location. Using a generic browser signature can produce a policy 403 on
  // hosted runners even though the filing itself is public.
  if (/^https:\/\/(?:www\.)?sec\.gov\//i.test(String(url || ""))) {
    return {
      "User-Agent": "MemoryIntelligenceDashboard/1.0 (https://github.com/dicacros-gif/memory)",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate",
      ...(retry ? {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      } : {}),
    };
  }
  // Micron IR's CDN returns a 200 response containing an empty bot-challenge
  // shell when a browser-style Accept header is sent from hosted runners. A
  // normal User-Agent without content negotiation returns the complete public
  // release. Keep this source-specific quirk out of the shared probe profile.
  if (/^https:\/\/investors\.micron\.com\//i.test(String(url || ""))) {
    return {
      "User-Agent": BROWSER_UA,
      "Accept-Language": "en-US,en;q=0.9",
      ...(retry ? {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        ...(referer ? { Referer: referer } : {}),
      } : {}),
    };
  }
  const acceptsJson = /\/wp-json\//i.test(String(url || ""));
  const acceptsPdf = /\.pdf(?:$|[?#])/i.test(String(url || ""));
  return {
    "User-Agent": BROWSER_UA,
    Accept: acceptsJson
      ? "application/json,text/plain;q=0.9,*/*;q=0.8"
      : acceptsPdf
        ? "application/pdf,*/*;q=0.8"
        : "text/html,application/xhtml+xml,application/rss+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    ...(retry ? {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      ...(referer ? { Referer: referer } : {}),
    } : {}),
  };
}

// A direct primary-page verification must remain the source of record.  Public
// publisher CDNs nevertheless produce isolated 403s and short-lived 5xxs, so
// retry those responses with a cache-busting browser profile before marking a
// source failed. A declared fallback is only used when it is the publisher's
// first-party endpoint or the original article mirrored by the official page,
// and it must independently match the same evidence marker.
export async function checkOfficialIndustryProbe(probe = {}, {
  fetchImpl = fetch,
  sleepImpl = sleep,
  signalFactory = (url) => fetchSignal(sourceTimeoutClass(url)),
} = {}) {
  const candidates = [
    ...[probe.url, ...(probe.fallbackUrls || [])].filter(Boolean).map((url) => ({ url, kind: "text" })),
    ...(probe.pdfFallbackUrls || []).filter(Boolean).map((url) => ({ url, kind: "pdf" })),
  ].filter((candidate, index, list) => list.findIndex((entry) => entry.url === candidate.url) === index);
  const attempts = [];
  const maxAttempts = Math.max(1, Math.min(3, Number(probe.retryAttempts || 2)));
  for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
    const { url, kind } = candidates[candidateIndex];
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const response = await fetchImpl(url, {
          signal: signalFactory(url),
          redirect: "follow",
          headers: officialProbeHeaders(url, attempt > 0),
        });
        const html = await response.text();
        const verifiedPdf = kind === "pdf"
          && /^%PDF-/i.test(String(html || "").slice(0, 12))
          && String(html || "").length >= 512;
        const matched = response.ok && (verifiedPdf || officialProbeMatches(probe.pattern, html));
        const status = Number(response.status) || 0;
        attempts.push({ url, status, matched, kind });
        if (matched) {
          return {
            reachable: true,
            httpStatus: status,
            verifiedUrl: response.url || url,
            verifiedFormat: verifiedPdf ? "pdf" : "text",
            fallbackUsed: candidateIndex > 0,
            attempts,
          };
        }
        // A missing marker means the page can no longer verify this source;
        // continue to a declared first-party fallback, but do not call it live.
        if (!OFFICIAL_PROBE_RETRYABLE_STATUSES.has(status) || attempt === maxAttempts - 1) break;
      } catch (error) {
        const message = String(error?.message || error || "fetch failed").slice(0, 300);
        attempts.push({ url, error: message });
        const transient = error?.name === "AbortError"
          || error?.name === "TimeoutError"
          || /(?:fetch failed|network|socket|econn|etimedout|enotfound)/i.test(message);
        if (!transient || attempt === maxAttempts - 1) break;
      }
      // Keep retry traffic bounded while giving a WAF/CDN a chance to rotate.
      await sleepImpl(450 + candidateIndex * 200);
    }
  }
  const last = attempts.at(-1) || {};
  return {
    reachable: false,
    httpStatus: Number.isFinite(last.status) ? last.status : null,
    attempts,
    error: last.error || (last.status ? `HTTP ${last.status} 또는 본문 표식 불일치` : "source check failed"),
  };
}

export async function collectOfficialIndustrySourceChecks(options = {}) {
  const checkedAt = new Date().toISOString();
  const probeIds = new Set();
  const probes = OFFICIAL_INDUSTRY_PROBES.concat(CATALOG_OFFICIAL_PROBES).filter((probe) => {
    if (probeIds.has(probe.id)) return false;
    probeIds.add(probe.id);
    return true;
  });
  const entries = await Promise.all(probes.map(async (probe) => {
    const result = await checkOfficialIndustryProbe(probe, options);
    const status = result.reachable ? (result.fallbackUsed ? "connected-fallback" : "connected") : "failed";
    const detail = result.reachable
      ? `${probe.label} ${result.fallbackUsed ? "공식 대체 경로" : "직접 연결"} · ${result.attempts.length}회 확인`
      : result.error;
    note(`official:${probe.id}`, result.reachable, detail);
    return [probe.id, {
      id: probe.id,
      label: probe.label,
      url: probe.url,
      reachable: result.reachable,
      checkedAt,
      status,
      httpStatus: result.httpStatus,
      verifiedUrl: result.verifiedUrl || null,
      fallbackUsed: Boolean(result.fallbackUsed),
      attempts: result.attempts,
      ...(result.error ? { error: result.error } : {}),
    }];
  }));
  return Object.fromEntries(entries);
}

// Memory price momentum from our own accumulated TrendForce history.
export function quantMemoryMomentum(priceHistory = {}) {
  const calc = (prefix, daysAgo) => {
    const changes = [];
    const spans = [];
    for (const item of Object.values(priceHistory.items || {})) {
      if (!String(item.key || "").startsWith(prefix)) continue;
      const points = (item.points || [])
        .map((p) => ({ time: new Date(p.date || p.crawledAt || 0).getTime(), average: Number(p.average) }))
        .filter((p) => Number.isFinite(p.time) && p.time > 0 && Number.isFinite(p.average) && p.average > 0)
        .sort((a, b) => a.time - b.time);
      if (points.length < 2) continue;
      const latest = points[points.length - 1];
      // Use the observation nearest the requested horizon. Requiring a point
      // to be older than the exact target skipped valid 25-day observations
      // and incorrectly fell back to much older archive points.
      const selected = points.slice(0, -1).map((point) => ({
        point,
        spanDays: (latest.time - point.time) / 86400000,
      })).filter((candidate) => candidate.spanDays >= daysAgo * 0.5 && candidate.spanDays <= daysAgo * 1.8)
        .sort((a, b) => Math.abs(a.spanDays - daysAgo) - Math.abs(b.spanDays - daysAgo))[0];
      if (!selected) continue;
      const base = selected.point;
      const spanDays = selected.spanDays;
      changes.push(((latest.average - base.average) / base.average) * 100);
      spans.push(spanDays);
    }
    if (!changes.length) return { value: null, spanDays: null, seriesCount: 0 };
    changes.sort((a, b) => a - b);
    spans.sort((a, b) => a - b);
    return {
      value: Number(changes[Math.floor(changes.length / 2)].toFixed(2)),
      spanDays: Number(spans[Math.floor(spans.length / 2)].toFixed(1)),
      seriesCount: changes.length,
    };
  };
  const dram30 = calc("dram-dram-spot-price::", 30);
  const dram90 = calc("dram-dram-spot-price::", 90);
  const nand30 = calc("nand-nand-flash-spot-price::", 30);
  const nand90 = calc("nand-nand-flash-spot-price::", 90);
  return {
    dramSpot30dPct: dram30.value,
    dramSpot90dPct: dram90.value,
    nandSpot30dPct: nand30.value,
    nandSpot90dPct: nand90.value,
    coverage: { dram30, dram90, nand30, nand90 },
    source: "TrendForce 공개 테이블 자체 축적 히스토리",
    asOf: new Date().toISOString().slice(0, 10),
  };
}

async function collectQuantMetricsLegacy(priceHistory) {
  const quant = {
    schemaVersion: "1.0",
    updatedAt: new Date().toISOString(),
    timezone: "Asia/Seoul",
    fx: {},
    aiDemandProxy: {},
    fundamentals: {},
    foundry: {},
    memoryMomentum: null,
  };
  for (const entry of QUANT_FX) {
    try {
      quant.fx[entry.id] = await collectQuantSeries(entry);
      note(`quant:FX ${entry.label}`, true, `${quant.fx[entry.id].value} (${quant.fx[entry.id].asOf})`);
    } catch (error) {
      quant.fx[entry.id] = null;
      note(`quant:FX ${entry.label}`, false, error.message);
    }
    await sleep(320);
  }
  for (const entry of QUANT_AI_PROXIES) {
    try {
      quant.aiDemandProxy[entry.id] = await collectQuantSeries(entry);
      note(`quant:AI ${entry.label}`, true, `${quant.aiDemandProxy[entry.id].value} · 90d ${quant.aiDemandProxy[entry.id].changePct90d}%`);
    } catch (error) {
      quant.aiDemandProxy[entry.id] = null;
      note(`quant:AI ${entry.label}`, false, error.message);
    }
    await sleep(320);
  }
  try {
    quant.fundamentals.micron = await fetchEdgarMicronFundamentals();
    const rev = quant.fundamentals.micron.revenue;
    note("quant:Micron EDGAR", true, rev ? `분기매출 $${(rev.value / 1e9).toFixed(2)}B (${rev.end})` : "재고만 수집");
  } catch (error) {
    quant.fundamentals.micron = null;
    note("quant:Micron EDGAR", false, error.message);
  }
  try {
    quant.foundry.tsmcMonthly = await fetchTsmcMonthlyRevenue();
    const t = quant.foundry.tsmcMonthly;
    note("quant:TSMC 월매출", true, `${t.month} · ${t.revenueBillionTwd}B TWD · YoY ${t.yoyPct != null ? t.yoyPct.toFixed(1) : "?"}%`);
  } catch (error) {
    quant.foundry.tsmcMonthly = null;
    note("quant:TSMC 월매출", false, error.message);
  }
  quant.memoryMomentum = quantMemoryMomentum(priceHistory);
  return quant;
}

function quantClamp(value, min = 0, max = 100) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function quantMean(values = []) {
  const valid = values.map(Number).filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function quantMetric(value, { asOf = null, source = "Model seed", sourceUrl = null, status = "assumption" } = {}) {
  return { value, asOf, source, sourceUrl, status };
}

function defaultForecastInputs(model = {}) {
  const configured = model.forecastInputs || {};
  return {
    version: configured.version || "2.0",
    categories: structuredClone(configured.categories || {}),
    modelUpdatedAt: model.updatedAt || null,
    methodology: model.methodology || null,
  };
}

function defaultProjectionExposure(model = {}) {
  return structuredClone(model.projectionModel?.caseWeights || {});
}

function mergeForecastInputs(previous = {}, model = {}) {
  const seed = defaultForecastInputs(model);
  const categories = {};
  const priorObservations = [];
  for (const [id, values] of Object.entries(seed.categories)) {
    categories[id] = {};
    for (const [field, configured] of Object.entries(values || {})) {
      const prior = previous.categories?.[id]?.[field];
      const priorDate = String(prior?.asOf || "").match(/\b20\d{2}-\d{2}-\d{2}\b/)?.[0] || null;
      const configuredDate = String(configured?.asOf || "").match(/\b20\d{2}-\d{2}-\d{2}\b/)?.[0] || null;
      const priorIsValidObservation = prior?.status === "live-observed"
        && Boolean(priorDate)
        && validHttpUrl(prior?.sourceUrl)
        && Number.isFinite(Number(prior?.value));
      const priorIsNewer = priorIsValidObservation
        && (!configuredDate || String(priorDate).localeCompare(configuredDate) >= 0);
      if (priorIsNewer) {
        priorObservations.push({
          category: id,
          field,
          ...prior,
          status: "previous-observation",
          claimType: "prior-run-observation",
          period: prior.period || priorDate,
          observed: false,
          observedThisRun: false,
        });
      }
      // A previous run can be inspected as provenance, but it cannot become a
      // current live input merely because no newer article was found today.
      categories[id][field] = configured;
    }
  }
  return {
    ...seed,
    categories,
    updatedAt: previous.updatedAt || null,
    acceptedObservations: [],
    priorObservations,
  };
}

function evidenceText(item = {}) {
  return [
    item.originalTitle,
    item.title,
    item.titleKo,
    item.koTitle,
    item.summaryOriginal,
    item.summary,
    item.koSummary,
    item.description,
    item.note,
  ]
    .filter(Boolean).join(" ");
}

function validHttpUrl(value = "") {
  try {
    const url = new URL(String(value));
    return ["http:", "https:"].includes(url.protocol) && url.hostname !== "news.google.com";
  } catch {
    return false;
  }
}

function exactEvidenceDate(item = {}) {
  for (const candidate of [item.date, item.publishedAt, item.updatedAt, item.sourceDate]) {
    const match = String(candidate || "").match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    if (match) return match[1];
  }
  return null;
}

function directEvidenceItems(context = {}) {
  const news = (context.news || []).map((item) => ({
    ...item,
    evidenceText: `${item.originalTitle || item.title || ""}. ${item.summaryOriginal || item.summary || ""}`,
    evidenceUrl: directNewsUrl(item),
    evidenceDate: exactEvidenceDate(item),
    evidenceSourceClass: structuredNewsSourceClass(item),
  }));
  const facts = (context.facts?.events || []).map((event) => event.current).filter(Boolean).map((item) => ({
    ...item,
    evidenceText: evidenceText(item),
    evidenceUrl: item.sourceUrl || item.url || item.link || "",
    evidenceDate: exactEvidenceDate(item),
    evidenceSourceClass: "official",
  }));
  return [...news, ...facts]
    .filter((item) => ["official", "research", "authoritative-media"].includes(item.evidenceSourceClass))
    .filter((item) => validHttpUrl(item.evidenceUrl) && Boolean(item.evidenceDate));
}

function compileQuantRule(rule = {}) {
  try {
    return {
      ...rule,
      subjectRe: new RegExp(rule.subject, "i"),
      measureRe: new RegExp(rule.measure, "i"),
      valueRe: new RegExp(rule.value, "i"),
    };
  } catch {
    return null;
  }
}

function parsedRuleValue(match, rule = {}) {
  const raw = Number(String(match?.[1] || "").replace(/,/g, ""));
  if (!Number.isFinite(raw) || raw <= 0) return null;
  const unit = String(match?.[2] || "").toLowerCase();
  const unitScale = Number(rule.unitScale?.[unit]);
  const scale = Number.isFinite(unitScale) ? unitScale : Number(rule.scale ?? 1);
  return Number((raw * (Number.isFinite(scale) ? scale : 1)).toFixed(4));
}

function findQuantRuleObservation(text = "", rule = {}, expectedValue = null) {
  const normalized = String(text).replace(/\s+/g, " ").trim();
  if (!normalized || !rule.valueRe || !rule.subjectRe || !rule.measureRe) return null;

  const valueFlags = `${rule.valueRe.flags.replace(/g/g, "")}g`;
  const valuePattern = new RegExp(rule.valueRe.source, valueFlags);
  const expected = Number(expectedValue);
  const hasExpected = Number.isFinite(expected);

  for (const match of normalized.matchAll(valuePattern)) {
    const value = parsedRuleValue(match, rule);
    if (value == null) continue;
    if (hasExpected && Math.abs(value - expected) > Math.max(0.01, Math.abs(expected) * 0.002)) continue;

    const matchIndex = Number(match.index) || 0;
    const start = Math.max(0, matchIndex - 520);
    const end = Math.min(normalized.length, matchIndex + match[0].length + 220);
    const context = normalized.slice(start, end).trim();
    rule.subjectRe.lastIndex = 0;
    rule.measureRe.lastIndex = 0;
    if (!rule.subjectRe.test(context) || !rule.measureRe.test(context)) continue;
    const excerptStart = Math.max(0, matchIndex - 170);
    const excerptEnd = Math.min(normalized.length, matchIndex + match[0].length + 140);
    return { value, clause: normalized.slice(excerptStart, excerptEnd).trim(), context };
  }
  return null;
}

function documentPublicationDate(html = "", url = "") {
  const source = String(html || "");
  const candidates = [
    /(?:article:published_time|datePublished)[^>\n]{0,180}?(20\d{2}-\d{2}-\d{2})/i,
    /"datePublished"\s*:\s*"(20\d{2}-\d{2}-\d{2})/i,
    /<time[^>]+datetime=["'](20\d{2}-\d{2}-\d{2})/i,
    /\b(20\d{2}-\d{2}-\d{2})\b/,
  ];
  for (const pattern of candidates) {
    const match = source.match(pattern);
    if (match?.[1]) return match[1];
  }
  // Several official newsrooms expose the publication date only as visible
  // English copy (for example "August 4, 2026") instead of ISO metadata.
  // Preserve the source date rather than substituting the crawl timestamp.
  const englishDate = source.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(20\d{2})\b/i);
  if (englishDate) {
    const months = {
      january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
      july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
    };
    const month = months[englishDate[1].toLowerCase()];
    const day = Number(englishDate[2]);
    if (month && day >= 1 && day <= 31) {
      return `${englishDate[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  const pathDate = String(url).match(/\/(20\d{2})\/(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\//);
  return pathDate ? `${pathDate[1]}-${pathDate[2]}-${pathDate[3]}` : null;
}

async function probeDocumentReachability(url) {
  const headers = {
    "User-Agent": BROWSER_UA,
    Accept: "application/pdf,text/html,application/xhtml+xml,*/*;q=0.8",
  };
  let response = await fetch(url, { method: "HEAD", signal: fetchSignal(sourceTimeoutClass(url)), headers });
  if (!response.ok && [403, 405, 501].includes(response.status)) {
    response = await fetch(url, {
      signal: fetchSignal(sourceTimeoutClass(url)),
      headers: { ...headers, Range: "bytes=0-4095" },
    });
    if (response.body) await response.body.cancel();
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return {
    contentType: response.headers.get("content-type") || "",
    contentLength: Number(response.headers.get("content-length")) || null,
  };
}

async function checkForecastSource(category, input = {}, compiledRule = null) {
  const checkedAt = new Date().toISOString();
  const sourceUrl = String(input.sourceUrl || "");
  const expectedValue = Number(input.value);
  const base = {
    category,
    field: "units",
    source: input.source || null,
    sourceUrl,
    sourceDate: exactEvidenceDate({ sourceDate: input.asOf }),
    expectedValue: Number.isFinite(expectedValue) ? expectedValue : null,
    checkedAt,
  };
  if (!validHttpUrl(sourceUrl)) return { ...base, ok: false, status: "invalid-source", message: "direct source URL missing" };
  try {
    const isPdf = /\.pdf(?:$|[?#])/i.test(sourceUrl);
    if (isPdf) {
      const metadata = await probeDocumentReachability(sourceUrl);
      return {
        ...base,
        ...metadata,
        // Reachability alone does not verify the configured numeric value.
        ok: false,
        reachable: true,
        valueVerified: false,
        status: "source-reachable-value-unverified",
        validation: "document reachability rechecked; configured numeric value was not machine-verified",
        message: "source reachable but configured numeric value remains unverified",
        locator: input.locator || null,
      };
    }
    const html = await fetchText(sourceUrl);
    const observed = compiledRule ? findQuantRuleObservation(stripHTML(html), compiledRule, expectedValue) : null;
    const sourceDate = documentPublicationDate(html, sourceUrl) || base.sourceDate;
    const valueVerified = Boolean(observed)
      && Number.isFinite(expectedValue)
      && Math.abs(observed.value - expectedValue) <= Math.max(0.01, Math.abs(expectedValue) * 0.002);
    return {
      ...base,
      sourceDate,
      ok: valueVerified,
      reachable: true,
      valueVerified,
      observedValue: observed?.value ?? null,
      snippet: observed?.clause?.slice(0, 220) || null,
      status: valueVerified ? "source-value-verified" : "source-value-mismatch",
      validation: "source text, subject, measure and numeric value matched in one clause",
      message: valueVerified ? null : "configured value was not found with its subject and measure",
    };
  } catch (error) {
    return { ...base, ok: false, reachable: false, valueVerified: false, status: "source-unavailable", message: error.message };
  }
}

async function collectForecastSourceChecks(model = {}) {
  const configured = model.forecastInputs || {};
  const compiledRules = new Map((configured.extractionRules || [])
    .map(compileQuantRule)
    .filter(Boolean)
    .map((rule) => [`${rule.category}:${rule.field}`, rule]));
  const entries = Object.entries(configured.categories || {})
    .map(([category, fields]) => ({ category, input: fields?.units }))
    .filter(({ input }) => validHttpUrl(input?.sourceUrl));
  const settled = await Promise.all(entries.map(({ category, input }) => checkForecastSource(
    category,
    input,
    compiledRules.get(`${category}:units`) || null,
  )));
  for (const item of settled) {
    const detail = item.valueVerified
      ? `${item.status} · ${item.sourceDate || "날짜 미확인"}`
      : item.reachable
        ? `${item.status} · 접근 가능 / 값 미검증`
        : item.message || item.status;
    // Source connectivity and numeric validation answer different questions.
    // A reachable source with an unparsed PDF is surfaced as a validation gap
    // in forecastInputs, not as a crawler failure or repeated outage alert.
    note(`forecast-${item.category}`, item.reachable, detail);
  }
  return {
    updatedAt: new Date().toISOString(),
    total: settled.length,
    ok: settled.filter((item) => item.ok).length,
    reachable: settled.filter((item) => item.reachable).length,
    valueVerified: settled.filter((item) => item.valueVerified).length,
    items: Object.fromEntries(settled.map((item) => [item.category, item])),
  };
}

function refreshForecastInputs(previous = {}, context = {}, model = {}) {
  const output = mergeForecastInputs(previous, model);
  const evidence = directEvidenceItems(context)
    .sort((a, b) => String(b.evidenceDate).localeCompare(String(a.evidenceDate)));
  const rules = (model.forecastInputs?.extractionRules || []).map(compileQuantRule).filter(Boolean);
  const accepted = [];
  for (const rule of rules) {
    const matches = [];
    for (const item of evidence) {
      const observation = findQuantRuleObservation(item.evidenceText || evidenceText(item), rule);
      if (observation) matches.push({ item, ...observation });
    }
    const hit = matches[0];
    if (!hit || !output.categories?.[rule.category]) continue;
    output.categories[rule.category][rule.field] = {
      value: hit.value,
      asOf: hit.item.evidenceDate,
      source: hit.item.source || hit.item.publisher || "Crawled evidence",
      sourceUrl: hit.item.evidenceUrl,
      status: "live-observed",
      claimType: "current-run-observation",
      period: hit.item.evidenceDate,
      observed: true,
      sourceClass: hit.item.evidenceSourceClass,
      snippet: hit.clause.slice(0, 220),
      capturedAt: new Date().toISOString(),
    };
    accepted.push({ category: rule.category, field: rule.field, sourceUrl: hit.item.evidenceUrl });
  }
  output.updatedAt = new Date().toISOString();
  output.acceptedObservations = accepted;
  output.methodology = model.methodology || output.methodology || null;
  return output;
}

/* ---------------- Live quantitative figure extractor ----------------
 * Mines the freshly crawled article corpus for numeric claims and keeps them
 * verbatim (value + the source's own sentence + link + date). No number is
 * invented or reinterpreted, so the "live figures" layer is hallucination-safe:
 * every figure is exactly what a dated, named source published today. */

const LIVE_FIGURE_DOMAIN_RE = /(hbm|dram|nand|ddr|lpddr|ssd|wafer|메모리|memory|存储|内存|점유|share|시장|market|市场|ipo|공모|募|증설|capacity|캐파|产能|매출|revenue|营收|营业|이익|profit|利润|盈|가격|price|spot|수율|yield|良率|capex|投资|투자|估值|valuation|市值|hynix|하이닉스|삼성|samsung|micron|마이크론|cxmt|长鑫|ymtc|长江|tsmc|台积)/i;

// Value patterns (multilingual). Each capture keeps the source's exact wording.
const LIVE_FIGURE_VALUE_RES = [
  { kind: "usd", re: /(?:US)?\$\s?\d[\d,]*(?:\.\d+)?\s*(?:trillion|billion|million|bn|B\b|M\b)?/g },
  { kind: "cny", re: /\d[\d,]*(?:\.\d+)?\s*(?:trillion|billion|million|bn|B\b|M\b)\s*(?:yuan|CNY|RMB)/gi },
  { kind: "cjk-money", re: /\d[\d,]*(?:\.\d+)?\s*(?:万亿|兆|亿|億|억|조|만억)\s*(?:美元|美金|美刀|元|人民币|위안|달러|원)?/g },
  { kind: "percent", re: /[-+]?\d+(?:\.\d+)?\s*%/g },
  { kind: "speed", re: /\d+(?:\.\d+)?\s*(?:Gbps|Gb\/s)/gi },
  { kind: "density", re: /\d+(?:\.\d+)?\s*Gb\s*\/\s*mm(?:²|2)/gi },
  { kind: "multiple", re: /\d+(?:\.\d+)?\s*(?:倍|배|times|x)\b/gi },
];

function canonicalFigureValue(raw = "", explicitKind = "") {
  const text = String(raw).replace(/,/g, "").trim();
  const number = Number(text.match(/[-+]?\d+(?:\.\d+)?/)?.[0]);
  if (!Number.isFinite(number)) return null;
  const lower = text.toLowerCase();
  if (explicitKind === "percent" || /%/.test(text)) return { number, family: "percent", displayUnit: "%" };
  if (explicitKind === "multiple" || /(?:倍|배|times|x)\b/i.test(text)) return { number, family: "multiple", displayUnit: "x" };
  if (explicitKind === "speed" || /gbps|gb\/s/i.test(text)) return { number, family: "speed-gbps", displayUnit: "Gbps" };
  if (explicitKind === "density" || /gb\s*\/\s*mm/i.test(text)) return { number, family: "density-gb-mm2", displayUnit: "Gb/mm2" };

  const isUsd = explicitKind === "usd" || /\$|usd|美元|美金|美刀|달러/i.test(text);
  const isCny = explicitKind === "cny" || /yuan|cny|rmb|人民币|위안|元|亿|億/i.test(text);
  const isKrw = /(?:억원|조원|\bkrw\b)/i.test(text);
  if (isUsd || isCny || explicitKind === "cjk-money") {
    let multiplier = 1;
    if (/trillion|\bT\b|万亿|조/i.test(text)) multiplier = 1e12;
    else if (/billion|\bbn\b|\bB\b/i.test(text)) multiplier = 1e9;
    else if (/million|\bM\b/i.test(text)) multiplier = 1e6;
    else if (/亿|億|억/i.test(text)) multiplier = 1e8;
    const family = isUsd ? "currency-usd" : isCny ? "currency-cny" : isKrw ? "currency-krw" : "currency-unspecified";
    return { number: number * multiplier, family, displayUnit: family };
  }
  return { number, family: "number", displayUnit: "" };
}

function canonicalBaselineValue(item = {}) {
  const text = `${item.prefix || ""}${item.value ?? ""}${item.suffix || item.unit || ""}`;
  return canonicalFigureValue(text);
}

function figureValuesEquivalent(baseline, observed) {
  if (!baseline || !observed || baseline.family !== observed.family) return false;
  const difference = Math.abs(baseline.number - observed.number);
  if (["percent", "speed-gbps", "density-gb-mm2"].includes(baseline.family)) {
    return difference <= Math.max(0.2, Math.abs(baseline.number) * 0.006);
  }
  return difference <= Math.max(1e-9, Math.abs(baseline.number) * 0.02);
}

function classifyLiveFigure(text) {
  if (/(点유|점유|share|份额)/i.test(text)) return { id: "share", label: "점유율" };
  if (/(ipo|공모|募|估值|valuation|市值|超额|초과청약|배정)/i.test(text)) return { id: "capital", label: "IPO·자본" };
  if (/(市场|시장|market|tam|规模|규모)/i.test(text)) return { id: "market", label: "시장규모" };
  if (/(가격|价格|price|spot|上涨|暴涨|하락|상승)/i.test(text)) return { id: "price", label: "가격" };
  if (/(增设|증설|产能|capacity|캐파|wafer|晶圆|扩产)/i.test(text)) return { id: "capacity", label: "캐파" };
  if (/(매출|营收|营业|revenue|利润|profit|이익|盈|扭亏)/i.test(text)) return { id: "earnings", label: "실적" };
  if (/(capex|投资|투자|资本)/i.test(text)) return { id: "capex", label: "투자" };
  return { id: "other", label: "지표" };
}

function splitClauses(text = "") {
  return String(text)
    .split(/(?<=[.。!?！？;；])\s+|[\n\r]+|(?<=다)\s+(?=[A-Z가-힣])/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length >= 8);
}

export function extractLiveFigures(context = {}) {
  const articles = [
    ...(context.news || []).map((n) => {
      const sourceClass = structuredNewsSourceClass(n);
      const sourceMeta = intelligenceSource(n);
      const claimLayer = sourceClass === "research" || sourceMeta.claimType === "전망·추정"
        ? "research-model"
        : sourceClass === "official"
          ? "official-fact"
          : "reported-fact";
      return {
        text: `${n.originalTitle || n.title || ""}. ${n.summaryOriginal || n.summary || ""}`,
        textKo: `${n.titleKo || n.title || ""}`,
        storyId: n.verification?.id || n.id || directNewsUrl(n),
        storyTitle: n.titleKo || n.title || "",
        storySummary: n.summary || n.summaryOriginal || "",
        source: n.source || "News",
        url: directNewsUrl(n),
        date: exactEvidenceDate(n),
        sourceClass,
        claimLayer,
        origin: n.verification?.origin || "",
        observedThisRun: n.verification?.observedThisRun === true,
        extractionMode: "web-verbatim",
        sourceLocator: directNewsUrl(n),
        allowed: ["official", "research", "authoritative-media"].includes(sourceClass)
          && n.verification?.origin === "live-crawl"
          && n.verification?.observedThisRun === true
          && validHttpUrl(directNewsUrl(n))
          && Boolean(exactEvidenceDate(n)),
      };
    }),
    ...(context.brokerResearch?.items || []).map((b) => {
      const locator = b.sourceUrl || b.url || b.sourceRef || b.reportTitle || "";
      return {
        text: `${b.title || ""}. ${b.summary || ""} ${b.insight || ""}`,
        textKo: b.title || "",
        storyId: b.id || `${b.institutionId || b.institution || "broker"}:${b.title || "research"}`,
        storyTitle: b.title || "",
        storySummary: b.summary || "",
        source: b.institution || b.source || "Broker",
        url: validHttpUrl(locator) ? locator : "",
        date: exactEvidenceDate(b),
        sourceClass: "research",
        claimLayer: "research-model",
        origin: b.origin || "",
        observedThisRun: b.observedThisRun === true,
        extractionMode: "report-extract",
        sourceLocator: locator,
        allowed: Boolean(b.origin === "live-crawl" && b.observedThisRun === true && exactEvidenceDate(b) && validHttpUrl(locator)),
      };
    }),
  ].filter((a) => a.allowed && a.text && LIVE_FIGURE_DOMAIN_RE.test(a.text));

  const seen = new Set();
  const figures = [];
  for (const article of articles) {
    const perArticle = [];
    const perArticleValues = new Set();
    for (const clause of splitClauses(article.text)) {
      if (!LIVE_FIGURE_DOMAIN_RE.test(clause)) continue;
      for (const { kind, re } of LIVE_FIGURE_VALUE_RES) {
        re.lastIndex = 0;
        let match;
        while ((match = re.exec(clause)) !== null) {
          const raw = match[0].replace(/\s+/g, " ").trim();
          // Reject bare years / dates masquerading as figures.
          if (/^\+?\d{4}\s*%?$/.test(raw) && /^(19|20)\d{2}$/.test(raw.replace(/[^\d]/g, ""))) continue;
          if (/^\d{1,2}\s*%$/.test(raw) && /\b(20\d{2})\b/.test(clause) && /月|년|年|일|월/.test(clause) && Number(raw.replace(/[^\d]/g, "")) <= 31) {
            if (!/(점유|share|가격|price|上涨|증가|하락|성장|growth|yoy|증감)/i.test(clause)) continue;
          }
          const normValue = raw.replace(/[,\s元]/g, "");
          if (perArticleValues.has(normValue)) continue; // one figure per distinct value per article
          const canonical = canonicalFigureValue(raw, kind);
          if (!canonical) continue;
          const key = `${article.sourceLocator || article.url}::${canonical.family}::${canonical.number}::${clause.slice(0, 40)}`.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          perArticleValues.add(normValue);
          perArticle.push({
            value: raw,
            kind,
            topic: classifyLiveFigure(clause),
            // Verbatim source sentence (original language) = ground truth, no
            // translation-introduced drift. Korean title kept as a context label.
            snippet: clause,
            contextKo: article.textKo,
            storyId: article.storyId,
            storyTitle: article.storyTitle || article.textKo,
            storySummary: article.storySummary,
            source: article.source,
            url: article.url,
            date: article.date || null,
            sourceClass: article.sourceClass,
            claimLayer: article.claimLayer,
            origin: article.origin,
            observedThisRun: article.observedThisRun,
            canonical,
            extractionMode: article.extractionMode,
            sourceLocator: article.sourceLocator,
          });
        }
      }
    }
    // Keep the two most substantive figures per article (currency/market over
    // bare percents) to avoid one story flooding the panel.
    const selected = perArticle
      .map((item, index) => ({ item, index }))
      .sort((a, b) => (b.item.kind === "percent" ? 0 : 2) - (a.item.kind === "percent" ? 0 : 2)
        || b.item.value.length - a.item.value.length
        || a.index - b.index)
      .slice(0, 2)
      .sort((a, b) => a.index - b.index)
      .map(({ item }) => item);
    figures.push(...selected);
  }
  figures.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const topicCounts = {};
  for (const figure of figures) topicCounts[figure.topic.id] = (topicCounts[figure.topic.id] || 0) + 1;
  return {
    updatedAt: new Date().toISOString(),
    total: figures.length,
    topicCounts,
    items: figures.slice(0, 60),
    method: "current-run authority-gated extraction · curated/previous-run seeds excluded · 웹 원문과 리포트 추출문을 구분하고 출처·날짜·단위를 보존",
  };
}

function kpiCorroborationRule(item = {}) {
  const label = String(item.label || "");
  const source = String(item.source || "");
  const rules = [
    { test: /글로벌.*반도체.*시장|semiconductor.*market/i, subject: /(semiconductor|반도체|半导体)/i, measure: /(market|시장|市场)/i },
    { test: /메모리.*성장률|memory.*growth/i, subject: /(memory|메모리|存储)/i, measure: /(growth|성장|增长|yoy)/i },
    { test: /메모리.*시장.*규모|memory.*market.*size/i, subject: /(memory|메모리|存储)/i, measure: /(market|시장|市场|size|규모)/i },
    { test: /SKHY.*HBM.*점유|SK hynix.*HBM.*share/i, subject: /(sk hynix|skhy|하이닉스)/i, measure: /(hbm).*(share|점유|份额)|(share|점유|份额).*(hbm)/i },
    { test: /DRAM.*Top3.*점유/i, subject: /(dram)/i, measure: /(top\s*3|삼성|samsung).*(share|점유|份额)|(share|점유|份额).*(top\s*3)/i },
    { test: /HBM4.*속도|HBM4.*speed/i, subject: /(hbm4)/i, measure: /(gbps|gb\/s|speed|속도)/i },
    { test: /범용.*DRAM.*CXMT.*점유|CXMT.*DRAM.*share/i, subject: /(cxmt|长鑫)/i, measure: /(dram).*(share|점유|份额)|(share|점유|份额).*(dram)/i },
    { test: /중국.*메모리.*가격.*할인/i, subject: /(china|chinese|중국|中国).*(memory|메모리|存储)/i, measure: /(discount|할인|折价|price|가격|价格)/i },
    { test: /CXMT.*2025.*매출/i, subject: /(cxmt|长鑫)/i, measure: /(2025).*(revenue|매출|营收)|(revenue|매출|营收).*(2025)/i },
    { test: /CXMT.*IPO.*공모/i, subject: /(cxmt|长鑫)/i, measure: /(ipo|offering|공모|募资|发行)/i },
    { test: /YMTC.*Phase\s*3.*장비/i, subject: /(ymtc|长江存储).*(phase\s*3|3기|三期)/i, measure: /(equipment|장비|设备|domestic|국산|国产)/i },
    { test: /NAND.*2026.*전망/i, subject: /(nand)/i, measure: /(2026).*(market|시장|revenue|매출|forecast|전망)|(forecast|전망).*(2026)/i },
    { test: /빅펀드.*3기|big fund.*3/i, subject: /(big fund|빅펀드|大基金)/i, measure: /(3|iii|三期).*(capital|fund|자본|基金)|(capital|fund|자본|基金).*(3|iii|三期)/i },
    { test: /YMTC.*NAND.*점유/i, subject: /(ymtc|长江存储)/i, measure: /(nand).*(share|점유|份额)|(share|점유|份额).*(nand)/i },
    { test: /YMTC.*NAND.*밀도/i, subject: /(ymtc|长江存储)/i, measure: /(density|밀도|密度|gb\s*\/\s*mm)/i },
    { test: /중국.*장비.*국산화율/i, subject: /(china|중국|中国).*(equipment|장비|设备)/i, measure: /(localization|국산화|国产化)/i },
    { test: /CXMT.*R&D.*인력/i, subject: /(cxmt|长鑫)/i, measure: /(r&d|research|연구|研发).*(staff|headcount|인력|人员)/i },
  ];
  return rules.find((rule) => rule.test.test(`${label} ${source}`)) || null;
}

// A baseline KPI is corroborated only when subject, measure, unit family and
// numeric value all agree in the same dated, directly linked source sentence.
function corroborateKpi(item = {}, liveFigures = {}) {
  const items = liveFigures.items || [];
  const rule = kpiCorroborationRule(item);
  const baselineValue = canonicalBaselineValue(item);
  if (!rule || !baselineValue) return null;
  const hit = items.find((figure) => {
    const text = `${figure.snippet || ""} ${figure.contextKo || ""}`;
    return figure.claimLayer !== "research-model"
      && figure.extractionMode === "web-verbatim"
      && validHttpUrl(figure.url)
      && Boolean(figure.date)
      && rule.subject.test(text)
      && rule.measure.test(text)
      && figureValuesEquivalent(baselineValue, figure.canonical);
  });
  return hit || null;
}

/* Account, council, relationship, freshness, and official-industry transforms
 * live in scripts/live-pipeline.mjs so fixtures can test them without network. */

function marketMetricProvenance(metric = null) {
  if (!metric) return null;
  const sources = metric.sources || [];
  return {
    asOf: metric.period || null,
    source: sources.map((source) => source.name).filter(Boolean).join(" · ") || null,
    sourceUrl: sources[0]?.url || null,
    basis: "automated-metric-consensus",
    dataStatus: metric.representation === "range" ? `range-${metric.sourceCount}-sources` : metric.confidence || "single-source",
    sourceCount: metric.sourceCount || 0,
    representation: metric.representation || "point",
    direction: metric.direction || "new",
    changePctPoint: metric.changePctPoint ?? null,
    priorPeriod: metric.priorPeriod || null,
    yearAgoPeriod: metric.yearAgoPeriod || null,
    yearAgoChangePctPoint: metric.yearAgoChangePctPoint ?? null,
  };
}

function hbmMetricForCompany(decisionIntelligence = {}, company = "") {
  const id = /skhy|hynix|하이닉스/i.test(company)
    ? "skhynix"
    : /samsung|삼성/i.test(company)
      ? "samsung"
      : /micron|마이크론/i.test(company)
        ? "micron"
        : "";
  return id ? decisionMetric(decisionIntelligence, "hbm-revenue-share", id) : null;
}

function buildMarketStructure(previous = {}, baseline = {}, liveFigures = {}, decisionIntelligence = {}) {
  const automatedSkhynixHbm = decisionMetric(decisionIntelligence, "hbm-revenue-share", "skhynix");
  const kpis = (baseline.kpis || []).map((item, index) => {
    if (/SKHY.*HBM.*점유|SK hynix.*HBM.*share/i.test(String(item.label || ""))) {
      const provenance = marketMetricProvenance(automatedSkhynixHbm);
      return {
        id: item.id || `kpi-${index}`,
        baselineIndex: index,
        label: item.label,
        value: automatedSkhynixHbm?.display || null,
        prefix: "",
        unit: "",
        asOf: provenance?.asOf || null,
        source: provenance?.source || null,
        sourceUrl: provenance?.sourceUrl || null,
        basis: provenance?.basis || "automation-unavailable",
        dataStatus: provenance?.dataStatus || "unavailable",
        liveCorroboration: null,
        metricConsensus: automatedSkhynixHbm || null,
        status: automatedSkhynixHbm ? "reported" : "watch",
      };
    }
    const corroboration = corroborateKpi(item, liveFigures);
    const sourceUrl = item.sourceUrl || item.url || null;
    const isWatch = /watch|확인/i.test(`${item.status || ""} ${item.source || ""}`);
    return {
      id: item.id || `kpi-${index}`,
      baselineIndex: index,
      label: item.label,
      value: item.value,
      prefix: item.prefix || "",
      unit: item.unit || item.suffix || "",
      asOf: corroboration?.date || item.sourceDate || item.date || item.period || baseline.meta?.updatedAt || null,
      source: corroboration?.source || item.source || null,
      sourceUrl: corroboration?.url || sourceUrl,
      basis: corroboration ? "source-observation" : "source-baseline",
      dataStatus: corroboration ? "live-verified" : isWatch ? "watch" : "last-verified",
      liveCorroboration: corroboration
        ? { value: corroboration.value, canonical: corroboration.canonical, snippet: corroboration.snippet, source: corroboration.source, url: corroboration.url, date: corroboration.date }
        : null,
      status: isWatch ? "watch" : "reported",
    };
  });
  const findKpi = (pattern) => kpis.find((item) => pattern.test(String(item.label || "")));
  const dramKpi = findKpi(/DRAM.*Top3.*점유/i);
  const cxmtKpi = findKpi(/CXMT.*점유/i);
  const ymtcKpi = findKpi(/YMTC.*NAND.*점유/i);
  const provenanceFromKpi = (kpi) => kpi ? {
    asOf: kpi.asOf,
    source: kpi.source,
    sourceUrl: kpi.sourceUrl,
    basis: kpi.basis,
    dataStatus: kpi.dataStatus,
  } : null;
  const companies = (baseline.architectureMatrix?.shareMatrix || []).map((item) => {
    const company = String(item.company || "");
    const isGlobalDramVendor = /skhy|samsung|micron|삼성|마이크론/i.test(company);
    const automatedHbm = hbmMetricForCompany(decisionIntelligence, company);
    const fieldProvenance = {
      hbmShare: isGlobalDramVendor ? marketMetricProvenance(automatedHbm) : null,
      dramShare2025: isGlobalDramVendor ? {
        ...provenanceFromKpi(dramKpi),
        asOf: "2025 Q1",
      } : null,
      dramShare2026: isGlobalDramVendor
        ? provenanceFromKpi(dramKpi)
        : /cxmt/i.test(company) ? provenanceFromKpi(cxmtKpi) : null,
      nandShare2026: /ymtc/i.test(company) ? provenanceFromKpi(ymtcKpi) : null,
    };
    const reference = Object.values(fieldProvenance).find(Boolean) || null;
    return {
      company: item.company,
      hbmShare: automatedHbm?.display || null,
      dramShare2025: fieldProvenance.dramShare2025 ? item.dramShare2025 : null,
      dramShare2026: fieldProvenance.dramShare2026 ? item.dramShare2026 : null,
      nandShare2026: fieldProvenance.nandShare2026 ? item.nandShare2026 : null,
      fieldProvenance,
      asOf: reference?.asOf || null,
      source: reference?.source || null,
      sourceUrl: reference?.sourceUrl || null,
      hbmMetric: automatedHbm ? {
        period: automatedHbm.period,
        display: automatedHbm.display,
        representation: automatedHbm.representation,
        sourceCount: automatedHbm.sourceCount,
        direction: automatedHbm.direction,
        changePctPoint: automatedHbm.changePctPoint,
        priorPeriod: automatedHbm.priorPeriod,
        yearAgoPeriod: automatedHbm.yearAgoPeriod,
        yearAgoChangePctPoint: automatedHbm.yearAgoChangePctPoint,
      } : null,
      basis: reference?.basis || "source-baseline",
      dataStatus: reference?.dataStatus || "last-verified",
    };
  });
  return {
    updatedAt: new Date().toISOString(),
    kpis,
    companies,
  };
}

function buildQuantDrivers(quant = {}, context = {}) {
  const momentum = quant.memoryMomentum || {};
  const priceMomentum = quantMean([momentum.dramSpot30dPct, momentum.dramSpot90dPct, momentum.nandSpot30dPct, momentum.nandSpot90dPct]) || 0;
  const aiMarket = quantMean([quant.aiDemandProxy?.nvda?.changePct90d, quant.aiDemandProxy?.amd?.changePct90d]) || 0;
  const isLiveObserved = (item = {}) => item.verification
    ? item.verification.origin === "live-crawl"
      && item.verification.observedThisRun === true
      && item.verification.status === "promoted"
    : item.origin === "live-crawl"
      && item.observedThisRun === true
      && item.dataStatus === "live-observed";
  const liveNews = (context.news || []).filter(isLiveObserved);
  const liveCommunity = (context.communitySignals?.items || []).filter(isVerifiedCommunityLiveItem);
  const liveBenchmark = (context.benchmarkSignals?.stream || []).filter(isVerifiedBenchmarkLiveItem);
  const chinaCandidates = [
    ...liveNews,
    ...liveCommunity,
    ...liveBenchmark,
  ]
    .filter((item) => /(?:cxmt|ymtc|xmc|china|chinese|中国|长鑫|长江)/i.test(evidenceText(item)));
  const chinaItems = Array.from(new Map(chinaCandidates.map((item) => [
    qualityCanonicalUrl(item) || canonicalNewsKey(item),
    item,
  ]).filter(([key]) => key)).values());
  const authoritative = liveNews
    .filter((item) => /(?:reuters|bloomberg|financial times|nikkei|trendforce|counterpoint|techinsights|official|sec|wsts)/i.test(`${item.source || ""} ${item.publisher || ""}`));
  return {
    priceMomentum: Number(priceMomentum.toFixed(2)),
    aiMarketMomentum: Number(aiMarket.toFixed(2)),
    tsmcRevenueYoY: Number.isFinite(quant.foundry?.tsmcMonthly?.yoyPct) ? Number(quant.foundry.tsmcMonthly.yoyPct.toFixed(2)) : null,
    chinaPressure: quantClamp(chinaItems.length * 1.4, 0, 100),
    authorityEvidence: authoritative.length,
    chinaEvidence: chinaItems.length,
  };
}

function smoothValue(previous, next, alpha = .22) {
  return Number.isFinite(Number(previous))
    ? Number((Number(previous) * (1 - alpha) + Number(next) * alpha).toFixed(4))
    : Number(Number(next).toFixed(4));
}

function buildScenarioCalibration(previous = {}, drivers = {}, model = {}) {
  const config = model.scenarioModel || {};
  const strengthConfig = config.strength || {};
  const referenceTsmcYoY = Number(strengthConfig.tsmcReferenceYoY ?? 20);
  const strength = quantClamp(
    (drivers.priceMomentum || 0) * Number(strengthConfig.priceMomentum ?? 0)
      + (drivers.aiMarketMomentum || 0) * Number(strengthConfig.aiMarketMomentum ?? 0)
      + ((drivers.tsmcRevenueYoY ?? referenceTsmcYoY) - referenceTsmcYoY) * Number(strengthConfig.tsmcRevenueYoY ?? 0)
      + (drivers.chinaPressure || 0) * Number(strengthConfig.chinaPressure ?? 0),
    Number(strengthConfig.min ?? -30),
    Number(strengthConfig.max ?? 30),
  );
  const target = {};
  for (const [scenarioId, fields] of Object.entries(config.scenarios || {})) {
    target[scenarioId] = {};
    for (const [field, rule] of Object.entries(fields || {})) {
      const base = Number(rule.base ?? 0);
      const strengthAdjustment = Number(rule.strengthDivisor)
        ? strength / Number(rule.strengthDivisor)
        : 0;
      const chinaAdjustment = Number(rule.chinaDivisor)
        ? (drivers.chinaPressure || 0) / Number(rule.chinaDivisor)
        : 0;
      target[scenarioId][field] = quantClamp(
        base + strengthAdjustment + chinaAdjustment,
        Number(rule.min ?? -Infinity),
        Number(rule.max ?? Infinity),
      );
    }
  }
  const alpha = Number(config.smoothingAlpha ?? .22);
  const scenarios = {};
  for (const [id, values] of Object.entries(target)) {
    scenarios[id] = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, smoothValue(previous.scenarios?.[id]?.[key], value, alpha)]));
  }
  return {
    updatedAt: new Date().toISOString(),
    method: config.method || "unconfigured",
    smoothingAlpha: alpha,
    strength: Number(strength.toFixed(2)),
    drivers,
    scenarios,
  };
}

function buildProjectionCalibration(previous = {}, scenarioCalibration = {}, model = {}) {
  const config = model.projectionModel || {};
  const drivers = scenarioCalibration.drivers || {};
  const base = defaultProjectionExposure(model);
  const normalization = config.driverNormalization || {};
  const pressure = (drivers.chinaPressure || 0) / Number(normalization.chinaPressureDivisor || 100);
  const price = quantClamp(
    drivers.priceMomentum || 0,
    Number(normalization.priceMin ?? -40),
    Number(normalization.priceMax ?? 40),
  ) / Number(normalization.priceDivisor || 40);
  const adjustment = config.caseAdjustment || {};
  const alpha = Number(config.smoothingAlpha ?? .22);
  const weights = {};
  for (const [id, values] of Object.entries(base)) {
    const exposure = Number(values.china || 0);
    const neutralTarget = Number(values.neutral || 0)
      + price * Number(adjustment.neutral?.price || 0)
      + exposure * pressure * Number(adjustment.neutral?.exposurePressure || 0);
    const bestTarget = Number(values.best || 0)
      + Math.max(price, 0) * Number(adjustment.best?.positivePrice || 0)
      + Math.max(exposure, 0) * pressure * Number(adjustment.best?.exposurePressure || 0);
    const worstTarget = Number(values.worst || 0)
      + Math.max(price, 0) * Number(adjustment.worst?.positivePrice || 0)
      + Math.max(exposure, 0) * pressure * Number(adjustment.worst?.exposurePressure || 0);
    weights[id] = {
      ...values,
      neutral: smoothValue(previous.caseWeights?.[id]?.neutral, neutralTarget, alpha),
      best: smoothValue(previous.caseWeights?.[id]?.best, bestTarget, alpha),
      worst: smoothValue(previous.caseWeights?.[id]?.worst, worstTarget, alpha),
    };
  }
  const calibrated = scenarioCalibration.scenarios || {};
  const output = config.scenarioOutputs || {};
  const neutralTarget = {
    scoreBias: (calibrated.base?.demandMul - 1) * Number(output.neutral?.scoreBiasDemand || 0) || 0,
    serverLift: price * Number(output.neutral?.serverPrice || 0),
    storageLift: price * Number(output.neutral?.storagePrice || 0),
    terminalLift: pressure * Number(output.neutral?.terminalPressure || 0),
  };
  const bestTarget = {
    scoreBias: Number(output.best?.scoreBiasBase || 0) + Math.max(price, 0) * Number(output.best?.scoreBiasPrice || 0),
    serverLift: Number(output.best?.serverBase || 0) + Math.max(price, 0) * Number(output.best?.serverPrice || 0),
    storageLift: Number(output.best?.storageBase || 0) + Math.max(price, 0) * Number(output.best?.storagePrice || 0),
    terminalLift: Number(output.best?.terminalBase || 0) + pressure * Number(output.best?.terminalPressure || 0),
  };
  const worstTarget = {
    scoreBias: Number(output.worst?.scoreBiasBase || 0) + pressure * Number(output.worst?.scoreBiasPressure || 0),
    serverLift: Number(output.worst?.serverBase || 0) + pressure * Number(output.worst?.serverPressure || 0),
    storageLift: Number(output.worst?.storageBase || 0) + pressure * Number(output.worst?.storagePressure || 0),
    terminalLift: Number(output.worst?.terminalBase || 0) + pressure * Number(output.worst?.terminalPressure || 0),
  };
  const smoothScenario = (id, target) => Object.fromEntries(
    Object.entries(target).map(([key, value]) => [key, smoothValue(previous.scenarios?.[id]?.[key], value, alpha)]),
  );
  return {
    updatedAt: new Date().toISOString(),
    method: config.method || "unconfigured",
    modelVersion: model.schemaVersion || null,
    modelUpdatedAt: model.updatedAt || null,
    smoothingAlpha: alpha,
    drivers: { price, pressure },
    model: {
      horizon: structuredClone(config.horizon || {}),
      segments: structuredClone(config.segments || {}),
      segmentScoring: structuredClone(config.segmentScoring || {}),
      deltaFormula: structuredClone(config.deltaFormula || {}),
      seriesFormula: structuredClone(config.seriesFormula || {}),
      driverCards: structuredClone(config.driverCards || {}),
    },
    caseWeights: weights,
    scenarios: {
      neutral: smoothScenario("neutral", neutralTarget),
      best: smoothScenario("best", bestTarget),
      worst: smoothScenario("worst", worstTarget),
    },
  };
}

export function sourceHealthId(step = "unknown") {
  const value = String(step || "unknown");
  const exact = [
    [/^quant:FRED USD\/KRW/i, "fred:usdkrw"],
    [/^quant:FRED USD\/TWD/i, "fred:usdtwd"],
    [/^quant:FX USD\/KRW/i, "fx:usdkrw"],
    [/^quant:FX USD\/TWD/i, "fx:usdtwd"],
    [/^quant:AI NVIDIA/i, "yahoo:nvda"],
    [/^quant:AI AMD/i, "yahoo:amd"],
    [/^quant:Micron EDGAR/i, "sec:micron"],
    [/^quant:TSMC history/i, "tsmc:ir-history"],
    [/^quant:TSMC 월매출/i, "twse:tsmc-monthly"],
    [/^TrendForce차트/i, "trendforce:chart"],
    [/^official-industry:wsts-sia/i, "official:wsts-sia"],
  ].find(([pattern]) => pattern.test(value));
  if (exact) return exact[1];
  if (value.startsWith("가격백필:")) return `wayback:${value.slice("가격백필:".length).replace(/[^a-z0-9가-힣]+/gi, ":").replace(/^:|:$/g, "").toLowerCase()}`;
  return value.replace(/\s+/g, "-").replace(/[^a-z0-9가-힣:_-]/gi, "").toLowerCase() || "unknown";
}

export function sourceHealthSnapshot(previous = {}, observations = health) {
  const grouped = new Map();
  for (const item of observations) {
    const id = sourceHealthId(item.step || item.name || "unknown");
    const current = grouped.get(id) || {
      id,
      label: item.step || item.name || id,
      ok: false,
      attempts: 0,
      successfulAttempts: 0,
      failedAttempts: 0,
      errors: [],
    };
    current.attempts += 1;
    if (item.ok) current.successfulAttempts += 1;
    else current.failedAttempts += 1;
    // A logical channel may have several bounded fetch batches. It is failed
    // only when every attempted batch fails. Mixed results remain visible as
    // "degraded" while valid observations continue to flow.
    current.ok = current.successfulAttempts > 0;
    current.degraded = current.successfulAttempts > 0 && current.failedAttempts > 0;
    if (!item.ok && item.msg) current.errors.push(String(item.msg).replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 400));
    grouped.set(id, current);
  }
  const attemptedAt = new Date().toISOString();
  const legacyIds = {
    "fx:usdkrw": ["yahoo:usdkrw"],
    "fx:usdtwd": ["yahoo:usdtwd"],
  };
  const migratedLegacyIds = new Set([...grouped.keys()].flatMap((id) => legacyIds[id] || []));
  const sources = Object.fromEntries(Object.entries(previous.sources || {})
    .filter(([id]) => !["quant", "가격백필", "official:wsts-sia"].includes(id)
      && id.toLowerCase() !== "trendforce차트"
      && !migratedLegacyIds.has(id))
    .map(([id, item]) => [id, {
      ...item,
      id,
      attempted: false,
      attempts: 0,
    }]));
  for (const [id, item] of grouped.entries()) {
    const before = previous.sources?.[id]
      || (legacyIds[id] || []).map((legacyId) => previous.sources?.[legacyId]).find(Boolean)
      || {};
    const failureStreak = item.ok ? 0 : Number(before.failureStreak || 0) + 1;
    sources[id] = {
      ...item,
      attempted: true,
      status: item.ok ? (item.degraded ? "degraded" : "ok") : "failed",
      failureStreak,
      alertThreshold: 3,
      lastAttemptAt: attemptedAt,
      lastSuccessAt: item.ok ? attemptedAt : before.lastSuccessAt || null,
      alert: failureStreak >= 3,
    };
  }
  const values = Object.values(sources);
  const attemptedValues = values.filter((item) => item.attempted);
  return {
    schemaVersion: "2.0",
    updatedAt: attemptedAt,
    ok: attemptedValues.filter((item) => item.ok).length,
    total: attemptedValues.length,
    catalogTotal: values.length,
    unattempted: values.filter((item) => !item.attempted).map((item) => item.id),
    failed: attemptedValues.filter((item) => !item.ok).map((item) => item.id),
    degraded: attemptedValues.filter((item) => item.degraded).map((item) => item.id),
    // A source intentionally not attempted in this run retains its history,
    // but it is not an active consecutive-failure incident.
    alerts: attemptedValues.filter((item) => item.alert).map((item) => item.id),
    sources,
  };
}

function quantHistoryCoverage(priceHistory = {}, marketHistory = {}) {
  const priceSeries = Object.values(priceHistory.items || {});
  const pricePoints = priceSeries.reduce((sum, item) => sum + (item.points?.length || 0), 0);
  const marketSeries = Object.values(marketHistory.indexes || {});
  const marketPoints = marketSeries.reduce((sum, item) => sum + (item.points?.length || 0), 0);
  const metricSeries = Object.values(marketHistory.metrics || {});
  const metricPoints = metricSeries.reduce((sum, item) => sum + (item.points?.length || 0), 0);
  let periods = {};
  try {
    const generatedAt = marketHistory.updatedAt || priceHistory.updatedAt || new Date().toISOString();
    periods = buildQuantBacktestSummary({ priceHistory, marketHistory, generatedAt }).coverage;
  } catch {
    periods = {};
  }
  return {
    updatedAt: new Date().toISOString(),
    priceSeries: priceSeries.length,
    pricePoints,
    marketSeries: marketSeries.length,
    marketPoints,
    metricSeries: metricSeries.length,
    metricPoints,
    periods,
    failClosed: true,
    disclaimer: "Public observations only; unavailable historical observations are never interpolated or fabricated.",
  };
}

function normalizeObservationDate(value = "") {
  const text = String(value || "");
  const exactDates = [...text.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g)].map((match) => match[1]);
  if (exactDates.length) return exactDates.at(-1);
  const quarter = text.match(/\b(20\d{2})\s*[- ]?Q([1-4])\b/i);
  if (quarter) {
    const year = Number(quarter[1]);
    const quarterNumber = Number(quarter[2]);
    const month = quarterNumber * 3;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  }
  const month = text.match(/\b(20\d{2})-(0[1-9]|1[0-2])\b/);
  if (month) {
    const year = Number(month[1]);
    const monthNumber = Number(month[2]);
    const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    return `${year}-${month[2]}-${String(lastDay).padStart(2, "0")}`;
  }
  return null;
}

export function quantMetricSeriesIdentity(id = "", label = "", unit = "") {
  const canonical = [id, label, unit]
    .map((value) => String(value || "").normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim())
    .join("|");
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

function stableKpiSeriesId(label = "", unit = "") {
  return `kpi-${quantMetricSeriesIdentity("baseline-kpi", label, unit)}`;
}

export function appendQuantHistory(marketHistory = {}, quant = {}) {
  marketHistory.metrics ||= {};
  marketHistory.metricDefinitions ||= {};
  marketHistory.quarantinedMetrics ||= [];
  const capturedAt = quant.updatedAt || new Date().toISOString();
  let metricsChanged = false;
  const validMetricPoint = (point = {}) => Number.isFinite(Number(point.value))
    && normalizeObservationDate(point.date) === point.date
    && validHttpUrl(point.sourceUrl)
    && ["live-verified", "last-verified"].includes(point.dataStatus);

  // Earlier builds copied baseline values onto every crawl date. Keep only
  // observations that carry their own source date and direct source URL.
  for (const [id, metric] of Object.entries(marketHistory.metrics)) {
    if (/^kpi-\d+$/.test(id)) {
      marketHistory.quarantinedMetrics.push({
        id,
        label: metric?.label || null,
        unit: metric?.unit || null,
        pointCount: Array.isArray(metric?.points) ? metric.points.length : 0,
        reason: "unstable-index-series-id",
        quarantinedAt: capturedAt,
      });
      delete marketHistory.metrics[id];
      delete marketHistory.metricDefinitions[id];
      metricsChanged = true;
      continue;
    }
    const points = (Array.isArray(metric?.points) ? metric.points : []).filter(validMetricPoint);
    if (!points.length) {
      delete marketHistory.metrics[id];
      delete marketHistory.metricDefinitions[id];
      metricsChanged = true;
      continue;
    }
    marketHistory.metrics[id] = {
      ...metric,
      seriesIdentity: metric.seriesIdentity || quantMetricSeriesIdentity(id, metric.label, metric.unit),
      points,
    };
  }
  const candidates = [];
  for (const item of quant.marketStructure?.kpis || []) {
    const numeric = Number(item.value);
    const observationDate = normalizeObservationDate(item.asOf);
    if (Number.isFinite(numeric)
      && observationDate
      && validHttpUrl(item.sourceUrl)
      && ["live-verified", "last-verified"].includes(item.dataStatus)) candidates.push({
      id: stableKpiSeriesId(item.label, item.unit || ""),
      label: item.label,
      value: numeric,
      unit: item.unit || "",
      source: item.source,
      sourceUrl: item.sourceUrl,
      asOf: item.asOf,
      observationDate,
      dataStatus: item.dataStatus,
    });
  }
  for (const company of quant.marketStructure?.companies || []) {
    for (const field of ["hbmShare", "dramShare2025", "dramShare2026", "nandShare2026"]) {
      const provenance = company.fieldProvenance?.[field];
      const numeric = Number(String(company[field] || "").replace(/[^\d.-]/g, ""));
      const observationDate = normalizeObservationDate(provenance?.asOf);
      if (Number.isFinite(numeric)
        && observationDate
        && validHttpUrl(provenance?.sourceUrl)
        && ["live-verified", "last-verified"].includes(provenance?.dataStatus)) candidates.push({
        id: `share-${String(company.company).toLowerCase()}-${field}`,
        label: `${company.company} ${field}`,
        value: numeric,
        unit: "%",
        source: provenance.source,
        sourceUrl: provenance.sourceUrl,
        asOf: provenance.asOf,
        observationDate,
        dataStatus: provenance.dataStatus,
      });
    }
  }
  for (const point of candidates) {
    const expectedIdentity = quantMetricSeriesIdentity(point.id, point.label, point.unit || "");
    const existing = marketHistory.metrics[point.id] || null;
    const existingIdentity = existing
      ? existing.seriesIdentity || quantMetricSeriesIdentity(point.id, existing.label, existing.unit || "")
      : null;
    if (existing && existingIdentity !== expectedIdentity) {
      marketHistory.quarantinedMetrics.push({
        id: point.id,
        label: existing.label || null,
        unit: existing.unit || null,
        seriesIdentity: existingIdentity,
        expectedIdentity,
        pointCount: Array.isArray(existing.points) ? existing.points.length : 0,
        reason: "series-identity-mismatch",
        quarantinedAt: capturedAt,
      });
    }
    const current = existing && existingIdentity === expectedIdentity
      ? existing
      : { id: point.id, label: point.label, unit: point.unit || "", points: [] };
    const points = Array.isArray(current.points)
      ? current.points.filter((item) => item.date !== point.observationDate && validMetricPoint(item))
      : [];
    points.push({
      date: point.observationDate,
      value: point.value,
      source: point.source || null,
      sourceUrl: point.sourceUrl,
      asOf: point.asOf,
      dataStatus: point.dataStatus,
      capturedAt,
    });
    points.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    marketHistory.metrics[point.id] = {
      ...current,
      id: point.id,
      label: point.label,
      unit: point.unit || current.unit || "",
      seriesIdentity: expectedIdentity,
      source: point.source || current.source || null,
      sourceUrl: point.sourceUrl,
      asOf: point.asOf || point.observationDate,
      updatedAt: capturedAt,
      points: points.slice(-2200),
    };
    metricsChanged = true;
    marketHistory.metricDefinitions[point.id] = {
      label: point.label,
      unit: point.unit || "",
      provenance: point.source || null,
      sourceUrl: point.sourceUrl,
      seriesIdentity: expectedIdentity,
      policy: "source observation date only; no daily interpolation",
    };
  }
  const appendSeries = ({ id, label, unit, cadence, source, sourceUrl, asOf = null, points = [] }) => {
    if (!validHttpUrl(sourceUrl)) return;
    const expectedIdentity = quantMetricSeriesIdentity(id, label, unit);
    const existing = marketHistory.metrics[id] || null;
    const existingIdentity = existing
      ? existing.seriesIdentity || quantMetricSeriesIdentity(id, existing.label, existing.unit)
      : null;
    if (existing && existingIdentity !== expectedIdentity) {
      marketHistory.quarantinedMetrics.push({
        id,
        label: existing.label || null,
        unit: existing.unit || null,
        seriesIdentity: existingIdentity,
        expectedIdentity,
        pointCount: Array.isArray(existing.points) ? existing.points.length : 0,
        reason: "series-identity-mismatch",
        quarantinedAt: capturedAt,
      });
    }
    const current = existing && existingIdentity === expectedIdentity
      ? existing
      : { id, label, unit, points: [] };
    const merged = new Map((current.points || []).filter(validMetricPoint).map((point) => [point.date, point]));
    for (const point of points) {
      const date = normalizeObservationDate(point.date);
      const value = Number(point.value);
      if (!date || !Number.isFinite(value)) continue;
      merged.set(date, { date, value, source, sourceUrl: point.sourceUrl || sourceUrl, asOf: point.date, dataStatus: "live-verified", capturedAt });
    }
    const nextPoints = [...merged.values()].sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(-2200);
    if (!nextPoints.length) return;
    const metricAsOf = asOf || nextPoints.at(-1)?.asOf || nextPoints.at(-1)?.date || null;
    marketHistory.metrics[id] = {
      ...current,
      id,
      label,
      unit,
      seriesIdentity: expectedIdentity,
      ...(cadence ? { cadence } : {}),
      source: source || current.source || null,
      sourceUrl,
      asOf: metricAsOf,
      updatedAt: capturedAt,
      points: nextPoints,
    };
    metricsChanged = true;
    marketHistory.metricDefinitions[id] = { label, unit, provenance: source, sourceUrl, seriesIdentity: expectedIdentity, policy: "source observation date only; no interpolation" };
  };
  appendSeries({
    id: "quant-usdkrw",
    label: "USD/KRW",
    unit: "KRW",
    cadence: "daily",
    source: quant.fx?.usdkrw?.source,
    sourceUrl: quant.fx?.usdkrw?.sourceUrl,
    asOf: quant.fx?.usdkrw?.asOf,
    points: quant.fx?.usdkrw?.history5y?.points || quant.fx?.usdkrw?.history30d?.points,
  });
  appendSeries({
    id: "quant-usdtwd",
    label: "USD/TWD",
    unit: "TWD",
    cadence: "daily",
    source: quant.fx?.usdtwd?.source,
    sourceUrl: quant.fx?.usdtwd?.sourceUrl,
    asOf: quant.fx?.usdtwd?.asOf,
    points: quant.fx?.usdtwd?.history5y?.points || quant.fx?.usdtwd?.history30d?.points,
  });
  appendSeries({
    id: "quant-nvda",
    label: "NVIDIA",
    unit: quant.aiDemandProxy?.nvda?.currency || "USD",
    cadence: "daily",
    source: quant.aiDemandProxy?.nvda?.source,
    sourceUrl: quant.aiDemandProxy?.nvda?.sourceUrl,
    asOf: quant.aiDemandProxy?.nvda?.asOf,
    points: quant.aiDemandProxy?.nvda?.history5y?.points || quant.aiDemandProxy?.nvda?.history30d?.points,
  });
  appendSeries({
    id: "quant-amd",
    label: "AMD",
    unit: quant.aiDemandProxy?.amd?.currency || "USD",
    cadence: "daily",
    source: quant.aiDemandProxy?.amd?.source,
    sourceUrl: quant.aiDemandProxy?.amd?.sourceUrl,
    asOf: quant.aiDemandProxy?.amd?.asOf,
    points: quant.aiDemandProxy?.amd?.history5y?.points || quant.aiDemandProxy?.amd?.history30d?.points,
  });
  appendSeries({
    id: "quant-tsmc-yoy",
    label: "TSMC monthly revenue YoY",
    unit: "% YoY",
    cadence: "monthly",
    source: quant.foundry?.tsmcMonthly?.source,
    sourceUrl: quant.foundry?.tsmcMonthly?.sourceUrl,
    asOf: quant.foundry?.tsmcMonthly?.month,
    points: quant.foundry?.tsmcMonthly?.yoyHistory?.points,
  });
  appendSeries({
    id: "quant-tsmc-revenue",
    label: "TSMC monthly revenue",
    unit: "B TWD",
    cadence: "monthly",
    source: quant.foundry?.tsmcMonthly?.source,
    sourceUrl: quant.foundry?.tsmcMonthly?.sourceUrl,
    asOf: quant.foundry?.tsmcMonthly?.month,
    points: quant.foundry?.tsmcMonthly?.revenueHistory?.points,
  });
  const micronHistory = quant.fundamentals?.micron?.history || {};
  const micronSource = quant.fundamentals?.micron?.source;
  const micronSourceUrl = quant.fundamentals?.micron?.sourceUrl;
  for (const [field, label] of [["revenue", "Micron quarterly revenue"], ["grossProfit", "Micron quarterly gross profit"], ["inventory", "Micron inventory"]]) {
    appendSeries({
      id: `quant-micron-${field.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`,
      label,
      unit: "USD B",
      cadence: "quarterly",
      source: micronSource,
      sourceUrl: micronSourceUrl,
      asOf: (micronHistory[field] || []).at(-1)?.date || null,
      points: (micronHistory[field] || []).map((point) => ({ ...point, value: Number((Number(point.value) / 1e9).toFixed(3)) })),
    });
  }
  marketHistory.quarantinedMetrics = marketHistory.quarantinedMetrics
    .filter((item) => item?.id && item?.reason)
    .slice(-100);
  if (metricsChanged) marketHistory.metricsUpdatedAt = capturedAt;
}

export async function collectLastGood(fetcher, previous, step, successMessage, { maxStaleDays = 3, report = true } = {}) {
  const attemptedAt = new Date().toISOString();
  try {
    const value = await fetcher();
    if (value?.status === "stale") {
      const next = {
        ...value,
        status: "stale",
        lastSuccessAt: previous?.lastSuccessAt || null,
        lastFetchSucceededAt: attemptedAt,
        lastAttemptAt: attemptedAt,
        staleAfterDays: maxStaleDays,
        expiresAt: null,
        failureStreak: Number(previous?.failureStreak || 0),
      };
      if (report) note(step, false, `source series stale · latest ${value.latestObservationAt || value.asOf || "unknown"} · lag ${value.endLagDays ?? "?"}d`);
      return next;
    }
    const next = {
      ...value,
      status: "live",
      lastSuccessAt: attemptedAt,
      lastAttemptAt: attemptedAt,
      staleAfterDays: maxStaleDays,
      expiresAt: new Date(Date.parse(attemptedAt) + maxStaleDays * 864e5).toISOString(),
      failureStreak: 0,
    };
    if (report) note(step, true, successMessage(next));
    return next;
  } catch (error) {
    const failureStreak = Number(previous?.failureStreak || 0) + 1;
    const previousSuccessAt = Date.parse(String(previous?.lastSuccessAt || previous?.updatedAt || previous?.asOf || ""));
    const staleAgeDays = Number.isFinite(previousSuccessAt) ? Math.max(0, (Date.parse(attemptedAt) - previousSuccessAt) / 864e5) : Infinity;
    if (report) note(step, false, error.message);
    if (previous && staleAgeDays <= maxStaleDays) {
      return {
        ...previous,
        status: "stale",
        lastAttemptAt: attemptedAt,
        lastError: error.message,
        staleAgeDays: Number(staleAgeDays.toFixed(2)),
        staleAfterDays: maxStaleDays,
        expiresAt: new Date(previousSuccessAt + maxStaleDays * 864e5).toISOString(),
        failureStreak,
      };
    }
    return {
      status: "unavailable",
      lastAttemptAt: attemptedAt,
      lastSuccessAt: Number.isFinite(previousSuccessAt) ? new Date(previousSuccessAt).toISOString() : null,
      lastError: error.message,
      staleAgeDays: Number.isFinite(staleAgeDays) ? Number(staleAgeDays.toFixed(2)) : null,
      staleAfterDays: maxStaleDays,
      expiredPrevious: Boolean(previous),
      failureStreak,
    };
  }
}

async function collectQuantMetrics(priceHistory, context = {}) {
  const previous = context.previousQuant || {};
  const model = context.quantModel || {};
  const quant = {
    schemaVersion: "2.0",
    runId: context.runId || null,
    updatedAt: new Date().toISOString(),
    timezone: "Asia/Seoul",
    fx: {},
    aiDemandProxy: {},
    fundamentals: {},
    foundry: {},
    memoryMomentum: quantMemoryMomentum(priceHistory),
    model: {
      schemaVersion: model.schemaVersion || null,
      updatedAt: model.updatedAt || null,
      methodology: model.methodology || null,
      scenarioMethod: model.scenarioModel?.method || null,
      projectionMethod: model.projectionModel?.method || null,
    },
  };
  for (const entry of QUANT_FX) {
    quant.fx[entry.id] = await collectLastGood(
      () => collectQuantSeries(entry), previous.fx?.[entry.id], `quant:FX ${entry.label}`,
      (value) => `${value.value} (${value.asOf})`,
      { maxStaleDays: 3 },
    );
    await sleep(320);
  }
  for (const entry of QUANT_AI_PROXIES) {
    quant.aiDemandProxy[entry.id] = await collectLastGood(
      () => collectQuantSeries(entry), previous.aiDemandProxy?.[entry.id], `quant:AI ${entry.label}`,
      (value) => `${value.value} · 90d ${value.changePct90d}%`,
      { maxStaleDays: 3 },
    );
    await sleep(320);
  }
  quant.fundamentals.micron = await collectLastGood(
    fetchEdgarMicronFundamentals, previous.fundamentals?.micron, "quant:Micron EDGAR",
    (value) => value.revenue ? `분기매출 $${(value.revenue.value / 1e9).toFixed(2)}B (${value.revenue.end})` : "재고만 수집",
    { maxStaleDays: 130 },
  );
  quant.foundry.tsmcMonthly = await collectLastGood(
    fetchTsmcMonthlyRevenue, previous.foundry?.tsmcMonthly, "quant:TSMC 월매출",
    (value) => `${value.month} · ${value.revenueBillionTwd}B TWD · YoY ${value.yoyPct != null ? Number(value.yoyPct).toFixed(1) : "?"}%`,
    { maxStaleDays: 50 },
  );
  {
    const current = quant.foundry.tsmcMonthly;
    const mergeMonthly = (...collections) => {
      const byMonth = new Map();
      for (const point of collections.flat()) {
        if (!/^20\d{2}-\d{2}$/.test(String(point?.date)) || !Number.isFinite(Number(point?.value))) continue;
        byMonth.set(point.date, { ...point, value: Number(point.value) });
      }
      return [...byMonth.values()].sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(-61);
    };
    if (current) {
      const sourceUrl = current.sourceUrl || previous.foundry?.tsmcMonthly?.sourceUrl || null;
      const yoyPoints = mergeMonthly(
        previous.foundry?.tsmcMonthly?.yoyHistory?.points || [],
        current.yoyHistory?.points || [],
        /^20\d{2}-\d{2}$/.test(String(current.month)) && Number.isFinite(Number(current.yoyPct))
          ? [{ date: current.month, value: Number(current.yoyPct), sourceUrl }]
          : [],
      );
      const revenuePoints = mergeMonthly(
        previous.foundry?.tsmcMonthly?.revenueHistory?.points || [],
        current.revenueHistory?.points || [],
        /^20\d{2}-\d{2}$/.test(String(current.month)) && Number.isFinite(Number(current.revenueBillionTwd))
          ? [{ date: current.month, value: Number(current.revenueBillionTwd), sourceUrl }]
          : [],
      );
      current.yoyHistory = {
        cadence: "monthly",
        unit: "% YoY",
        status: yoyPoints.length >= 60 ? "live" : (yoyPoints.length >= 2 ? "partial" : "accumulating"),
        sourceUrl,
        points: yoyPoints,
      };
      current.revenueHistory = {
        cadence: "monthly",
        unit: "B TWD",
        status: revenuePoints.length >= 60 ? "live" : (revenuePoints.length >= 2 ? "partial" : "accumulating"),
        sourceUrl,
        points: revenuePoints,
      };
    }
  }
  quant.forecastInputs = refreshForecastInputs(previous.forecastInputs, context, model);
  quant.forecastInputs.sourceChecks = await collectForecastSourceChecks(model);
  for (const [category, check] of Object.entries(quant.forecastInputs.sourceChecks.items || {})) {
    const input = quant.forecastInputs.categories?.[category]?.units;
    if (!input) continue;
    const sameSource = String(input.sourceUrl || "").replace(/\/$/, "") === String(check.sourceUrl || "").replace(/\/$/, "");
    const sameValue = Number.isFinite(Number(input.value))
      && Number.isFinite(Number(check.expectedValue))
      && Math.abs(Number(input.value) - Number(check.expectedValue)) <= Math.max(0.01, Math.abs(Number(check.expectedValue)) * 0.002);
    // A configured-model source check must not be attached to a different
    // current-run observation that happened to replace that category input.
    if (!sameSource || !sameValue) continue;
    input.lastCheckedAt = check.checkedAt;
    input.sourceReachable = Boolean(check.reachable);
    input.sourceValueVerified = Boolean(check.valueVerified);
    input.sourceCheckStatus = check.status;
    input.status = check.valueVerified
      ? "live-verified"
      : check.reachable ? "source-reachable-value-unverified" : "source-unavailable";
    if (check.snippet) input.sourceSnippet = check.snippet;
  }
  quant.liveFigures = extractLiveFigures(context);
  note("quant:라이브 수치", quant.liveFigures.total > 0, `원문 정량 수치 ${quant.liveFigures.total}건 추출`);
  const decisionDocuments = await collectDecisionIntelligenceDocuments(context);
  const candidateDecisionIntelligence = buildDecisionIntelligence({
    documents: decisionDocuments.documents,
    previous: previous.decisionIntelligence || {},
    policy: INTELLIGENCE_POLICY,
    runId: context.runId || null,
    now: new Date(),
    feedStatus: decisionDocuments.feedStatus,
    refreshTrigger: process.env.INTELLIGENCE_REFRESH_TRIGGER || "scheduled-6h",
  });
  quant.decisionIntelligence = candidateDecisionIntelligence.evaluation?.status === "pass"
    ? { ...candidateDecisionIntelligence, publishStatus: "verified-current" }
    : previous.decisionIntelligence?.evaluation?.status === "pass"
      ? {
          ...previous.decisionIntelligence,
          publishStatus: "retained-last-verified",
          lastAttempt: {
            runId: context.runId || null,
            generatedAt: candidateDecisionIntelligence.generatedAt,
            refreshTrigger: candidateDecisionIntelligence.refreshTrigger,
            evaluation: candidateDecisionIntelligence.evaluation,
            feedStatus: candidateDecisionIntelligence.feedStatus,
          },
        }
      : { ...candidateDecisionIntelligence, publishStatus: "review-no-prior-bundle" };
  const fetchedDecisionFeeds = decisionDocuments.feedStatus.filter((item) => item.status === "fetched").length;
  note(
    "derived:decision-intelligence",
    quant.decisionIntelligence.evaluation?.status === "pass",
    `직접 피드 ${fetchedDecisionFeeds}/${decisionDocuments.feedStatus.length} · ClaimEvent ${quant.decisionIntelligence.claimEvents?.stats?.structuredEvents || 0}건 · Decision Ready ${quant.decisionIntelligence.decisionAutomation?.funnel?.decisionReadyBriefs || 0}건 · 증분 재색인 ${quant.decisionIntelligence.retrieval?.stats?.reindexed || 0}건 · 평가 ${quant.decisionIntelligence.evaluation?.status || "review"}`,
  );
  quant.accountSignals = buildDemandAccountSignals(context, previous.accountSignals);
  note(
    "derived:account-signals",
    quant.accountSignals.accountCount === 27,
    `수요처 27개 전수 · 직접 근거 ${quant.accountSignals.evidencedAccountCount > 0 ? `${quant.accountSignals.evidencedAccountCount}개` : "미관측"}`,
  );
  quant.strategyAccountIntelligence = buildStrategyAccountIntelligence(
    { ...context, decisionIntelligence: quant.decisionIntelligence },
    previous.strategyAccountIntelligence,
  );
  note(
    "derived:strategy-account-intelligence",
    quant.strategyAccountIntelligence.focusAccountCount === 7,
    `핵심 계정 ${quant.strategyAccountIntelligence.focusAccountCount}개 · 전체 렌즈 ${quant.strategyAccountIntelligence.accountCount}개 · 주간 GPU/ASIC 실측 ${quant.strategyAccountIntelligence.demandMix?.latest?.total || 0}건`,
  );
  quant.relationCandidates = buildRelationCandidates(context);
  note("derived:relation-candidates", true, `신규 관계 후보 ${quant.relationCandidates.candidateCount}개 · 승격 검토 ${quant.relationCandidates.promotionReviewCount}개`);
  quant.baselineFreshness = buildBaselineFreshness(context.baseline, context, previous.baselineFreshness);
  note("derived:baseline-freshness", true, `기준 서술 ${quant.baselineFreshness.total}개 · 재검증 ${quant.baselineFreshness.revalidate}개`);
  quant.industrySourceChecks = await collectOfficialIndustrySourceChecks();
  quant.industryPulse = buildIndustryPulse(context, new Date(), quant.industrySourceChecks);
  note("derived:official-industry", true, `공식 산업 통계 연결 ${quant.industryPulse.connected}/${quant.industryPulse.total} · 최신 기사 관측 ${quant.industryPulse.observed}/${quant.industryPulse.total}`);
  quant.agentBriefing = buildAgentBriefing(context, quant);
  note("derived:agent-briefing", quant.agentBriefing.sourceCount > 0, `역할별 최신 근거 ${quant.agentBriefing.sourceCount}개 출처`);
  quant.marketStructure = buildMarketStructure(previous.marketStructure, context.baseline, quant.liveFigures, quant.decisionIntelligence);
  const drivers = buildQuantDrivers(quant, context);
  quant.scenarioCalibration = buildScenarioCalibration(previous.scenarioCalibration, drivers, model);
  quant.projectionCalibration = buildProjectionCalibration(previous.projectionCalibration, quant.scenarioCalibration, model);
  quant.sourceHealth = sourceHealthSnapshot(previous.sourceHealth);
  quant.historyCoverage = quantHistoryCoverage(priceHistory, context.marketHistory);
  return quant;
}

/* ---------------- Wayback Machine price-history backfill ----------------
 * TrendForce's own priceChart API is login-only (403), so quarterly/1y/5y
 * history is reconstructed from public web.archive.org snapshots of the same
 * price pages, parsed with the same table parser. Points are tagged with
 * origin=web.archive.org and only merged into series we already track. */

export function archiveMonthlyTargets(months = 60, now = new Date()) {
  const targets = [];
  for (let monthsAgo = months; monthsAgo >= 1; monthsAgo -= 1) {
    const target = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo + 1, 0, 12);
    targets.push({
      id: new Date(target).toISOString().slice(0, 7),
      target,
      windowDays: 35,
    });
  }
  return targets;
}
const ARCHIVE_BACKFILL_MAX_SNAPSHOTS_PER_RUN = 8;
// Sunday (KST) runs get a bigger budget so exact monthly coverage converges faster.
const ARCHIVE_BACKFILL_SUNDAY_CAP = 12;
const ARCHIVE_SNAPSHOT_CANDIDATES_PER_JOB = 3;

function cdxDayStamp(time) {
  return new Date(time).toISOString().slice(0, 10).replace(/-/g, "");
}

// Wayback needs patience: slower responses than 12s default and transient 503s.
async function fetchArchiveText(url, tries = 3) {
  let lastErr;
  for (let attempt = 0; attempt < tries; attempt += 1) {
    try {
      return await new Promise((resolveText, rejectText) => {
        const request = (requestUrl, redirectsLeft = 3) => {
          const req = httpsRequest(requestUrl, {
            headers: {
              // Wayback's CDX edge currently rejects a full Chrome UA from
              // Node with HTTP 498, while its documented generic client path
              // accepts the same request. Keep this transport intentionally
              // minimal and choose the media type by endpoint.
              "User-Agent": "Mozilla/5.0",
              Accept: requestUrl.includes("/cdx/") ? "application/json" : "text/html",
            },
          }, (res) => {
            const status = Number(res.statusCode || 0);
            if (status >= 300 && status < 400 && res.headers.location && redirectsLeft > 0) {
              res.resume();
              request(new URL(res.headers.location, requestUrl).href, redirectsLeft - 1);
              return;
            }
            const chunks = [];
            res.on("data", (chunk) => chunks.push(chunk));
            res.on("end", () => {
              if (status < 200 || status >= 300) {
                rejectText(new Error(`HTTP ${status || "unknown"}`));
                return;
              }
              resolveText(Buffer.concat(chunks).toString("utf8"));
            });
          });
          req.setTimeout(30000, () => req.destroy(new Error("archive request timeout")));
          req.on("error", rejectText);
          req.end();
        };
        request(url);
      });
    } catch (error) {
      lastErr = error;
      await sleep(4000 * (attempt + 1));
    }
  }
  throw lastErr || new Error("archive fetch failed");
}

export function archiveReplayUrls(timestamp, sourceUrl) {
  const base = `https://web.archive.org/web/${timestamp}`;
  // id_ is the cleanest raw replay. if_ is an independent replay path that
  // remains parseable when id_ is temporarily rejected with HTTP 498.
  return [`${base}id_/${sourceUrl}`, `${base}if_/${sourceUrl}`];
}

function cdxTimestampToIso(ts = "") {
  const m = String(ts).match(/^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/);
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 12), +(m[5] || 0), +(m[6] || 0))).toISOString();
}

export function archiveSnapshotMatchesMonth(timestamp = "", targetMonth = "") {
  return /^20\d{2}-(?:0[1-9]|1[0-2])$/.test(String(targetMonth))
    && String(timestamp).slice(0, 6) === String(targetMonth).replace("-", "");
}

// TrendForce renamed items over the years (e.g. "16G" -> "16Gb"), so archived
// rows are matched to today's series via a normalized key.
function normalizedHistoryKey(key = "") {
  return String(key)
    .toLowerCase()
    .replace(/(\d)\s*gb\b/g, "$1g") // fold 16gb -> 16g so both eras collide
    .replace(/\s+/g, ""); // whitespace-insensitive: "(2gx8)3200" == "(2gx8) 3200"
}

/* Legacy-era archive sources: before ~2024 TrendForce served NAND prices at
 * /price/flash with <h2> section headings instead of price-title divs, but the
 * spot-price item names are identical to today's (SLC 2Gb 256MBx8, MLC 64Gb
 * 8GBx8, 3D TLC 256Gb...). Only exact-match sections are mapped — memory-card
 * items were named differently back then (C10/U1 vs today's plain capacity),
 * so they are deliberately excluded to avoid cross-product contamination. */
const ARCHIVE_LEGACY_SOURCES = [
  {
    pageId: "nand",
    url: "https://www.trendforce.com/price/flash",
    sections: [
      { legacyTitle: "Flash Spot Price", canonicalId: "nand-nand-flash-spot-price", title: "NAND Flash Spot Price", group: "NAND / Storage" },
    ],
  },
];

const DRAMEXCHANGE_HOME_ROUTE_MAP = new Map([
  ["dram_spot", { canonicalId: "dram-dram-spot-price", title: "DRAM Spot Price", group: "DRAM" }],
  ["nationalcontractdramdetail", { canonicalId: "dram-dram-contract-price", title: "DRAM Contract Price", group: "DRAM" }],
  ["module_spot", { canonicalId: "dram-module-spot-price", title: "Module Spot Price", group: "DRAM" }],
  ["gddr_spot", { canonicalId: "dram-gddr-spot-price", title: "GDDR Spot Price", group: "DRAM" }],
  ["flash_spot", { canonicalId: "nand-nand-flash-spot-price", title: "NAND Flash Spot Price", group: "NAND / Storage" }],
  ["nationalcontractflashdetail", { canonicalId: "nand-nand-flash-contract-price", title: "NAND Flash Contract Price", group: "NAND / Storage" }],
  ["wafer_spot", { canonicalId: "nand-wafer-spot-price", title: "Wafer Spot Price", group: "NAND / Storage" }],
  ["memorycard_spot", { canonicalId: "nand-memory-card-spot-price", title: "Memory Card Spot Price", group: "NAND / Storage" }],
  ["pcclientoemssd", { canonicalId: "nand-pc-client-oem-ssd-contract-price", title: "PC-Client OEM SSD Contract Price", group: "NAND / Storage" }],
  ["ssd_street", { canonicalId: "nand-ssd-street-price", title: "SSD Street Price", group: "NAND / Storage" }],
]);

const ARCHIVE_AGGREGATE_SOURCES = [
  {
    id: "dramexchange-home",
    url: "https://www.dramexchange.com/",
  },
];

function parseLegacyPriceTables(html, source) {
  const sections = [];
  for (const map of source.sections || []) {
    // Anchor on the <h2> heading, not the first text occurrence — the same
    // label also appears in the page's nav links before any table.
    const headingRe = new RegExp(`<h2[^>]*>\\s*${map.legacyTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
    const headingMatch = headingRe.exec(html);
    if (!headingMatch) continue;
    const idx = headingMatch.index;
    const nextH2 = html.indexOf("<h2", idx + headingMatch[0].length);
    const seg = html.slice(idx, nextH2 > 0 ? nextH2 : idx + 14000);
    const tableMatch = /<table[\s\S]*?<\/table>/i.exec(seg);
    if (!tableMatch) continue;
    const rowsRaw = [...tableMatch[0].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
      .map((m) => [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => stripHTML(c[1])));
    if (rowsRaw.length < 2) continue;
    const header = rowsRaw[0];
    const avgIdx = header.findIndex((h) => /session average|^average$/i.test(h));
    const chgIdx = header.findIndex((h) => /session change|^change$/i.test(h));
    if (avgIdx < 0) continue;
    const rows = rowsRaw.slice(1)
      .filter((r) => r.length > avgIdx && r[0] && !/^item$/i.test(r[0]))
      .map((r) => ({
        item: r[0],
        average: parseNumber(r[avgIdx]),
        averageRaw: r[avgIdx] || "",
        changePct: chgIdx >= 0 ? parseNumber(r[chgIdx]) : null,
        changeRaw: chgIdx >= 0 ? r[chgIdx] || "" : "",
        direction: chgIdx >= 0 ? directionFrom(r[chgIdx]) : "flat",
      }))
      .filter((r) => r.average != null);
    if (rows.length) {
      sections.push({ id: map.canonicalId, title: map.title, group: map.group, lastUpdate: "", sourceUrl: source.url, rows });
    }
  }
  return sections;
}

// DRAMeXchange's public homepage carried multiple DRAM and NAND tables in one
// document before TrendForce split them into today's price URLs. The route on
// each item link is used as the section identity, so similarly named products
// from different tables can never be cross-merged. Product rows still need an
// exact normalized name match in mergeArchiveSections; no speed-bin aliases or
// interpolated observations are introduced.
export function parseDramexchangeLegacyHome(html, sourceUrl = "https://www.dramexchange.com/") {
  const grouped = new Map();
  const tables = [...String(html || "").matchAll(/<table[^>]*>[\s\S]*?<\/table>/gi)].map((match) => match[0]);

  for (const table of tables) {
    if (!/Session Average|Average Change|Session Change/i.test(table)) continue;
    const rawRows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => match[1]);
    if (rawRows.length < 2) continue;

    const headerCells = [...rawRows[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((match) => stripHTML(match[1]));
    const avgIdx = headerCells.findIndex((label) => /session average|^average$/i.test(label));
    const chgIdx = headerCells.findIndex((label) => /session change|average change|^change$/i.test(label));
    if (avgIdx < 0) continue;

    for (const rawRow of rawRows.slice(1)) {
      const rawCells = [...rawRow.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) => match[1]);
      if (rawCells.length <= avgIdx) continue;
      const routeMatch = rawCells[0].match(/href=["'][^"']*\/Price\/([^"'/?#]+)/i);
      if (!routeMatch) continue;
      const sectionMap = DRAMEXCHANGE_HOME_ROUTE_MAP.get(routeMatch[1].toLowerCase());
      if (!sectionMap) continue;

      const cells = rawCells.map((cell) => stripHTML(cell));
      const item = cells[0];
      const averageRaw = cells[avgIdx] || "";
      const changeRaw = chgIdx >= 0 ? cells[chgIdx] || "" : "";
      const average = parseNumber(averageRaw);
      if (!item || average == null) continue;

      if (!grouped.has(sectionMap.canonicalId)) {
        grouped.set(sectionMap.canonicalId, {
          id: sectionMap.canonicalId,
          title: sectionMap.title,
          group: sectionMap.group,
          lastUpdate: "",
          sourceUrl,
          rows: [],
        });
      }
      grouped.get(sectionMap.canonicalId).rows.push({
        item,
        average,
        averageRaw,
        changePct: chgIdx >= 0 ? parseNumber(changeRaw) : null,
        changeRaw,
        direction: chgIdx >= 0 ? directionFrom(changeRaw) : "flat",
      });
    }
  }

  return [...grouped.values()];
}

async function backfillPriceHistoryFromArchive(history) {
  let attemptsThisRun = 0;
  let aggregateAttemptsThisRun = 0;
  let pointsAdded = 0;
  const forceBackfill = /^(?:1|true|yes)$/i.test(String(process.env.BACKFILL_FORCE || ""));
  const kstDay = new Date(Date.now() + 9 * 3600000).getUTCDay();
  const backfillCap = Number(process.env.BACKFILL_MAX) > 0
    ? Number(process.env.BACKFILL_MAX)
    : (kstDay === 0 ? ARCHIVE_BACKFILL_SUNDAY_CAP : ARCHIVE_BACKFILL_MAX_SNAPSHOTS_PER_RUN);
  const aggregateBackfillCap = Number(process.env.BACKFILL_AGGREGATE_MAX) > 0
    ? Number(process.env.BACKFILL_AGGREGATE_MAX)
    : (kstDay === 0 ? 8 : 4);
  const attemptedAt = new Date().toISOString();
  const manifest = history.archiveBackfill && typeof history.archiveBackfill === "object"
    ? history.archiveBackfill
    : { schemaVersion: "2.0", monthsRequested: 60, attempts: {} };
  manifest.schemaVersion = "3.0";
  manifest.monthsRequested = 60;
  manifest.attempts ||= {};
  const monthlyTargets = archiveMonthlyTargets();
  const targetMonthIds = new Set(monthlyTargets.map((period) => period.id));
  const cdxCache = new Map();
  let skippedByRetryThisRun = 0;
  const normalizedIndex = new Map();
  for (const item of Object.values(history.items || {})) {
    const norm = normalizedHistoryKey(item.key);
    if (norm && !normalizedIndex.has(norm)) normalizedIndex.set(norm, item);
  }

  // Merge parsed archive sections into today's tracked series; returns count.
  const mergeArchiveSections = (sections, snapTs, sourceUrl) => {
    const snapIso = cdxTimestampToIso(snapTs);
    const capturedAt = new Date().toISOString();
    let merged = 0;
    for (const section of sections || []) {
      for (const row of section.rows || []) {
        if (row.average == null && row.changePct == null) continue;
        const key = row.historyKey || priceHistoryKey(section, row);
        const current = history.items[key] || normalizedIndex.get(normalizedHistoryKey(key));
        if (!current) continue; // only enrich series we track today
        const sourceObservedAt = trendForceObservationIso(section.lastUpdate) || snapIso;
        const point = {
          date: sourceObservedAt,
          sourceObservedAt,
          sourceUpdate: section.lastUpdate || "",
          snapshotAt: snapIso,
          crawledAt: capturedAt,
          capturedAt,
          average: row.average,
          averageRaw: row.averageRaw || "",
          changePct: row.changePct,
          changeRaw: row.changeRaw || "",
          direction: row.direction || "flat",
          origin: "web.archive.org",
          archiveUrl: `https://web.archive.org/web/${snapTs}/${sourceUrl}`,
        };
        const next = mergePricePoints(current.points, [point]);
        if (JSON.stringify(next) !== JSON.stringify(current.points)) {
          current.points = next;
          merged += 1;
          pointsAdded += 1;
        }
      }
    }
    return merged;
  };

  const cdxSnapshots = async (url, target, windowMs) => {
    // A single five-year CDX query is expensive and is frequently rejected
    // with HTTP 498. Query only the target month's ± window; the run budget
    // already limits how many months are requested.
    const from = target - windowMs;
    const to = target + windowMs;
    const cacheKey = `${url}:${cdxDayStamp(from)}:${cdxDayStamp(to)}`;
    if (!cdxCache.has(cacheKey)) {
      const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&output=json&from=${cdxDayStamp(from)}&to=${cdxDayStamp(to)}&filter=${encodeURIComponent("statuscode:200")}&filter=${encodeURIComponent("mimetype:text/html")}&collapse=${encodeURIComponent("timestamp:8")}&limit=250`;
      cdxCache.set(cacheKey, fetchArchiveText(cdxUrl).then((text) => {
        const rows = JSON.parse(text);
        return (Array.isArray(rows) ? rows.slice(1) : []).map((row) => row[1]).filter(Boolean);
      }));
    }
    const snapshots = await cdxCache.get(cacheKey);
    return snapshots.filter((timestamp) => {
      const time = Date.parse(cdxTimestampToIso(timestamp));
      return Number.isFinite(time) && Math.abs(time - target) <= windowMs;
    });
  };

  const cdxCatalog = async (url) => {
    const first = monthlyTargets[0];
    const last = monthlyTargets.at(-1);
    const from = cdxDayStamp(first.target - first.windowDays * 86400000);
    const to = cdxDayStamp(last.target + last.windowDays * 86400000);
    const cacheKey = `${url}:${from}:${to}:catalog`;
    if (!cdxCache.has(cacheKey)) {
      const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&output=json&from=${from}&to=${to}&filter=${encodeURIComponent("statuscode:200")}&filter=${encodeURIComponent("mimetype:text/html")}&collapse=${encodeURIComponent("timestamp:8")}&limit=2000`;
      cdxCache.set(cacheKey, fetchArchiveText(cdxUrl).then((text) => {
        const rows = JSON.parse(text);
        return (Array.isArray(rows) ? rows.slice(1) : []).map((row) => row[1]).filter(Boolean);
      }));
    }
    return cdxCache.get(cacheKey);
  };

  const closestSnapshots = (snapshots, target, limit = ARCHIVE_SNAPSHOT_CANDIDATES_PER_JOB) => snapshots
    .map((ts) => ({ ts, diff: Math.abs(new Date(cdxTimestampToIso(ts)).getTime() - target) }))
    .sort((a, b) => a.diff - b.diff)
    .slice(0, Math.max(1, limit))
    .map((item) => item.ts);

  // One archived DRAMeXchange homepage contains several public DRAM/NAND
  // tables. A single 5-year CDX catalog request therefore replaces up to 120
  // month-by-page lookups and restores pre-2025 exact-product observations.
  // Each run stays bounded; BACKFILL_AGGREGATE_MAX=60 performs a one-time full
  // recovery while scheduled runs continue filling any remaining months.
  for (const source of ARCHIVE_AGGREGATE_SOURCES) {
    if (aggregateAttemptsThisRun >= aggregateBackfillCap) break;
    let catalog = [];
    try {
      catalog = await cdxCatalog(source.url);
    } catch (error) {
      note(`가격백필:${source.id}·catalog`, false, error.message);
      continue;
    }
    for (const period of [...monthlyTargets].sort((left, right) => right.target - left.target)) {
      if (aggregateAttemptsThisRun >= aggregateBackfillCap) break;
      const uncovered = Object.values(history.items || {}).filter((item) =>
        !(item.points || []).some((point) => pricePointCoversMonth(point, period.id)));
      if (!uncovered.length) continue;

      const jobId = `aggregate:${source.id}:${period.id}`;
      const priorAttempt = manifest.attempts[jobId];
      const retryDays = priorAttempt?.status === "failed" ? 1 : 30;
      if (!forceBackfill && priorAttempt?.attemptedAt && Date.now() - Date.parse(priorAttempt.attemptedAt) < retryDays * 864e5) {
        skippedByRetryThisRun += 1;
        continue;
      }

      const available = catalog.filter((timestamp) => {
        // Never let a neighbouring month stand in for a missing target month.
        // This is an exact archived observation, not a backfilled estimate.
        return archiveSnapshotMatchesMonth(timestamp, period.id);
      });
      if (!available.length) {
        manifest.attempts[jobId] = { attemptedAt, status: "no-snapshot", uncoveredSeries: uncovered.length };
        aggregateAttemptsThisRun += 1;
        continue;
      }

      aggregateAttemptsThisRun += 1;
      const candidates = closestSnapshots(available, period.target);
      const archiveAttempts = [];
      let merged = 0;
      let coveredAfter = 0;
      let parsedSuccessfully = false;
      for (const snapshot of candidates) {
        for (const archivedUrl of archiveReplayUrls(snapshot, source.url)) {
          try {
            const html = await fetchArchiveText(archivedUrl);
            const sections = parseDramexchangeLegacyHome(html, source.url);
            parsedSuccessfully = sections.length > 0;
            const mergedHere = mergeArchiveSections(sections, snapshot, source.url);
            merged += mergedHere;
            coveredAfter = uncovered.filter((item) =>
              (item.points || []).some((point) => pricePointCoversMonth(point, period.id))).length;
            archiveAttempts.push({ snapshot, snapshotUrl: archivedUrl, parsedSections: sections.length, mergedSeries: mergedHere, coveredTargetSeries: coveredAfter });
            break;
          } catch (error) {
            archiveAttempts.push({ snapshot, snapshotUrl: archivedUrl, error: String(error?.message || error).slice(0, 300) });
          }
        }
        if (parsedSuccessfully) break;
        if (snapshot !== candidates.at(-1)) await sleep(900);
      }
      const bestAttempt = archiveAttempts.find((item) => !item.error) || archiveAttempts[0] || null;
      manifest.attempts[jobId] = {
        attemptedAt,
        status: coveredAfter > 0 ? "merged" : (merged > 0 ? "target-miss" : "empty"),
        snapshot: bestAttempt?.snapshot || null,
        snapshotUrl: bestAttempt?.snapshotUrl || null,
        snapshotCandidatesTried: archiveAttempts.length,
        uncoveredSeries: uncovered.length,
        mergedSeries: merged,
        coveredTargetSeries: coveredAfter,
      };
      note(`가격백필:${source.id}·${period.id}`, coveredAfter > 0, `${archiveAttempts.length}개 스냅샷 · 목표월 ${coveredAfter}/${uncovered.length}개 · 변경 ${merged}개`);
      await sleep(900);
    }
  }

  const jobs = monthlyTargets
    .flatMap((period) => PRICE_PAGES.map((page) => ({ page, period })))
    // Fill the decision screen's most recent closeable windows first. Without
    // this ordering, a small daily budget can be consumed indefinitely by
    // sparse 2021 snapshots while recent monthly gaps remain visible.
    .sort((left, right) => right.period.target - left.period.target);
  for (const { page, period } of jobs) {
    if (attemptsThisRun >= backfillCap) break;
    const target = period.target;
    const windowMs = period.windowDays * 86400000;
    const pageItems = Object.values(history.items || {}).filter((item) =>
      String(item.sectionId || "").startsWith(`${page.id}-`) || String(item.key || "").startsWith(`${page.id}-`));
    if (!pageItems.length) continue;
    const uncovered = pageItems.filter((item) => !(item.points || []).some((point) => pricePointCoversMonth(point, period.id)));
    if (!uncovered.length) continue;

    const jobId = `${page.id}:${period.id}`;
    const priorAttempt = manifest.attempts[jobId];
    const priorWasPartial = priorAttempt?.status === "partial"
      || (priorAttempt?.status === "merged"
        && Number(priorAttempt?.coveredTargetSeries || 0) < Number(priorAttempt?.uncoveredSeries || 0));
    const transientReplayFailure = priorAttempt?.status === "failed"
      && /\bHTTP (?:429|498|502|503|504)\b/i.test(String(priorAttempt?.error || ""));
    const retryDays = transientReplayFailure
      ? 0.25
      : priorWasPartial || priorAttempt?.status === "failed"
        ? 7
      : ["no-snapshot", "empty", "target-miss", "merged"].includes(priorAttempt?.status) ? 30 : 7;
    if (!forceBackfill && priorAttempt?.attemptedAt && Date.now() - Date.parse(priorAttempt.attemptedAt) < retryDays * 864e5) {
      skippedByRetryThisRun += 1;
      continue;
    }

    attemptsThisRun += 1;
    try {
      let source = page;
      let snapshots = await cdxSnapshots(page.url, target, windowMs);
      let legacy = false;
      if (!snapshots.length) {
        source = ARCHIVE_LEGACY_SOURCES.find((item) => item.pageId === page.id);
        if (source) {
          snapshots = await cdxSnapshots(source.url, target, windowMs);
          legacy = true;
        }
      }
      if (!source || !snapshots.length) {
        manifest.attempts[jobId] = { attemptedAt, status: "no-snapshot", uncoveredSeries: uncovered.length };
        noteSkipped(`가격백필:${page.id}·${period.id}`, "현행·레거시 URL 모두 스냅샷 없음");
        await sleep(900);
        continue;
      }

      const candidates = closestSnapshots(snapshots, target);
      let merged = 0;
      let coveredAfter = 0;
      const archiveAttempts = [];
      for (const snapshot of candidates) {
        for (const archivedUrl of archiveReplayUrls(snapshot, source.url)) {
          try {
            const html = await fetchArchiveText(archivedUrl);
            const sections = legacy ? parseLegacyPriceTables(html, source) : parsePriceTables(html, page);
            const mergedHere = mergeArchiveSections(sections, snapshot, source.url);
            merged += mergedHere;
            coveredAfter = uncovered.filter((item) => (item.points || []).some((point) => pricePointCoversMonth(point, period.id))).length;
            archiveAttempts.push({ snapshot, snapshotUrl: archivedUrl, mergedSeries: mergedHere, coveredTargetSeries: coveredAfter });
            break;
          } catch (error) {
            archiveAttempts.push({ snapshot, snapshotUrl: archivedUrl, error: String(error?.message || error).slice(0, 300) });
          }
        }
        if (coveredAfter >= uncovered.length) break;
        if (snapshot !== candidates.at(-1)) {
          // Avoid replay throttling when one monthly job has several nearby
          // snapshots. This runs below the fold and does not delay first paint.
          await sleep(1200);
        }
      }
      const bestAttempt = archiveAttempts.find((item) => !item.error) || archiveAttempts[0] || null;
      manifest.attempts[jobId] = {
        attemptedAt,
        status: coveredAfter >= uncovered.length && coveredAfter > 0
          ? "merged"
          : coveredAfter > 0 ? "partial" : (merged > 0 ? "target-miss" : "empty"),
        snapshot: bestAttempt?.snapshot || null,
        snapshotUrl: bestAttempt?.snapshotUrl || null,
        snapshotCandidatesTried: archiveAttempts.length,
        uncoveredSeries: uncovered.length,
        mergedSeries: merged,
        coveredTargetSeries: coveredAfter,
      };
      note(`가격백필:${page.id}·${period.id}${legacy ? "·legacy" : ""}`, coveredAfter > 0, `${archiveAttempts.length}개 스냅샷 · 목표월 ${coveredAfter}/${uncovered.length}개 · 변경 ${merged}개`);
    } catch (error) {
      manifest.attempts[jobId] = { attemptedAt, status: "failed", error: String(error.message || error).slice(0, 300), uncoveredSeries: uncovered.length };
      note(`가격백필:${page.id}·${period.id}`, false, error.message);
    }
    await sleep(1800);
  }
  manifest.updatedAt = attemptedAt;
  manifest.attemptsThisRun = attemptsThisRun;
  manifest.aggregateAttemptsThisRun = aggregateAttemptsThisRun;
  manifest.pointsAddedThisRun = pointsAdded;
  manifest.skippedByRetryThisRun = skippedByRetryThisRun;
  const coverageSeries = Object.fromEntries(Object.entries(history.items || {}).map(([key, item]) => {
    const months = new Set((item.points || []).map((point) => {
      const time = Date.parse(priceObservationTime(point));
      return Number.isFinite(time) ? new Date(time).toISOString().slice(0, 7) : null;
    }).filter((month) => month && targetMonthIds.has(month)));
    return [key, {
      observedMonths: months.size,
      targetMonths: monthlyTargets.length,
      coverageRatio: Number((months.size / monthlyTargets.length).toFixed(4)),
      firstMonth: [...months].sort()[0] || null,
      lastMonth: [...months].sort().at(-1) || null,
    }];
  }));
  const totalSeriesMonths = Object.keys(coverageSeries).length * monthlyTargets.length;
  const observedSeriesMonths = Object.values(coverageSeries).reduce((sum, item) => sum + item.observedMonths, 0);
  manifest.coverage = {
    targetStartMonth: monthlyTargets[0]?.id || null,
    targetEndMonth: monthlyTargets.at(-1)?.id || null,
    targetMonths: monthlyTargets.length,
    seriesCount: Object.keys(coverageSeries).length,
    observedSeriesMonths,
    totalSeriesMonths,
    coverageRatio: totalSeriesMonths ? Number((observedSeriesMonths / totalSeriesMonths).toFixed(4)) : 0,
    series: coverageSeries,
  };
  history.archiveBackfill = manifest;
  if (skippedByRetryThisRun > 0) {
    note("가격백필:재시도캐시", true, `최근 시도 ${skippedByRetryThisRun}개 작업 건너뜀 (실패 7일 · 그 외 30일)`);
  }
  if (pointsAdded > 0) history.updatedAt = attemptedAt;
  return pointsAdded;
}

async function main() {
  await loadCrawlExclusions();
  const runId = process.env.GITHUB_RUN_ID || `local-${Date.now()}`;
  let refreshLedger = { schemaVersion: "1.0", events: [] };
  try { refreshLedger = JSON.parse(await readFile(REFRESH_EVENTS_OUT, "utf8")); } catch { /* first run */ }
  const ledgerValidation = validateRefreshLedger(refreshLedger);
  if (!ledgerValidation.ok) throw new Error(`refresh event ledger validation failed: ${ledgerValidation.errors.join(", ")}`);
  const refreshRequest = buildRefreshRequest({ env: process.env, policy: INTELLIGENCE_POLICY, now: new Date(), runId });
  if (isDuplicateRefreshRequest(refreshLedger, refreshRequest)) {
    console.log(`Duplicate refresh event suppressed: ${refreshRequest.trigger} · ${refreshRequest.idempotencyKeyHash.slice(0, 12)}`);
    return { published: false, duplicate: true };
  }
  const previous = await loadPreviousData();
  koTranslator = createGoogleKoTranslator({
    cache: previous.translationCache,
    timeoutMs: KO_TRANSLATION_TIMEOUT_MS,
    userAgent: BROWSER_UA,
    qualityGate: (original, translated) => translationQuality(original, translated).status === "verified",
  });
  const [prices, stocks, newsPayload, communitySignals, competitors, startups, benchmarkSignals, chinaInfra] = await Promise.all([
    collectPrices(),
    collectStocks(previous.stocks),
    collectNews(previous.news, previous.referenceNews),
    collectCommunitySignals(previous.communityItems),
    collectCompetitors(),
    collectStartups(),
    collectBenchmarkSignals(),
    collectChinaInfra(),
  ]);
  const priceHistory = await updatePriceHistory(prices);
  try {
    const backfilled = await backfillPriceHistoryFromArchive(priceHistory);
    if (backfilled > 0) note("가격백필:합계", true, `아카이브 과거점 ${backfilled}개 병합`);
  } catch (error) {
    note("가격백필:합계", false, error.message);
  }
  attachPriceHistory(prices, priceHistory);
  const marketHistory = await updateMarketHistory();
  let quant = null;

  const evidenceValidatedAt = new Date().toISOString();
  const evidenceGate = validateNewsEvidence(newsPayload.news, evidenceValidatedAt);
  const news = evidenceGate.promoted;
  const categories = rebuildNewsCategories(news, newsPayload.categories);
  const trending = extractTrending(news);
  const stats = newsStats(news.map((item) => ({
    ...item,
    ts: new Date(item.date || item.publishedAt || 0).getTime() || 0,
  })));
  const quarantineReport = buildQuarantineReport(runId, evidenceGate.quarantined, evidenceValidatedAt);
  note("뉴스증거게이트", news.length >= 24, `승격 ${news.length}건 · 격리 ${quarantineReport.total}건`);

  // Best-effort Korean headlines (no API key; keep source-language text when
  // translation is skipped, rate-limited, or exceeds its bounded budget).
  try {
    const translationDeadline = SKIP_KO_TRANSLATION ? 0 : koTranslationDeadline();
    if (SKIP_KO_TRANSLATION || translationDeadline === 0) {
      noteSkipped("번역:KO", "환경 설정으로 생략 · 원문/기존 번역 유지");
    } else {
      // Reserve a final slice of the bounded translation budget for the exact
      // articles selected for the executive briefing.  Generic feed ordering
      // must not leave the visible decision cards untranslated.
      const streamDeadline = Math.max(Date.now(), translationDeadline - KO_BRIEF_TRANSLATION_RESERVE_MS);
      const accumulatedNews = [...news, ...(newsPayload.referenceNews || [])];
      const chineseNews = accumulatedNews.filter((item) => verifiedNewsLanguage(item) === "chinese");
      const englishNews = accumulatedNews.filter((item) => verifiedNewsLanguage(item) === "english");
      await addKoTitles(chineseNews, chineseNews.length, streamDeadline);
      await addKoSummaries(chineseNews, chineseNews.length, streamDeadline);
      await addKoTitles(englishNews, englishNews.length, streamDeadline);
      await addKoSummaries(englishNews, englishNews.length, streamDeadline);
      await addKoTitles(communitySignals.items, 30, streamDeadline);
      await addKoSummaries(communitySignals.items, 30, streamDeadline);
      await addKoTitles(benchmarkSignals.stream, 24, streamDeadline);
      for (const competitor of competitors.competitors) {
        if (koTranslationBudgetExpired(streamDeadline)) break;
        await addKoTitles(competitor.recentNews, 2, streamDeadline);
      }
      for (const startup of startups.candidates) {
        if (koTranslationBudgetExpired(streamDeadline)) break;
        await addKoTitles(startup.recentNews, 2, streamDeadline);
      }
      const provisionalFacts = buildFactTimeline(news, evidenceValidatedAt);
      const provisionalBriefs = buildIntelligence({ news, prices, stats, chinaInfra, facts: provisionalFacts }).briefs;
      const briefingItems = intelligenceBriefTranslationItems(provisionalBriefs, news);
      await addKoSummaries(briefingItems, briefingItems.length, translationDeadline);
      const translationStats = koTranslator.stats;
      koTranslationRunStats = { ...translationStats };
      note(
        "번역:KO",
        true,
        `${translationStats.translated}건 신규 · 캐시 ${translationStats.cacheHits}건 · 요청 ${translationStats.requests}회`
        + `${translationStats.retries ? ` · 재시도 ${translationStats.retries}회` : ""}`
        + `${translationStats.qualityRejected ? ` · 품질게이트 폴백 ${translationStats.qualityRejected}건` : ""}`
        + `${koTranslationBudgetExpired(translationDeadline) ? " · 시간 예산 도달, 다음 실행 재시도" : ""}`,
      );
    }
  } catch (error) {
    note("번역:KO", false, error.message);
  }

  const signals = buildSignals({ prices, competitors, startups, newsStats: stats });
  const facts = buildFactTimeline(news, evidenceValidatedAt);
  const intelligence = buildIntelligence({ news, prices, stats, chinaInfra, facts });
  const brokerResearch = buildBrokerResearch(news, previous.brokerResearch);
  note("증권사 리서치", true, `이번 실행 ${brokerResearch.currentRunCount}건 · 누적 공개 원문 ${brokerResearch.accumulatedCount}건`);
  quant = await collectQuantMetrics(priceHistory, {
    runId,
    previousQuant: previous.quant,
    baseline: previous.baseline,
    quantModel: previous.quantModel,
    news,
    communitySignals,
    benchmarkSignals,
    brokerResearch,
    facts,
    marketHistory,
  });
  appendQuantHistory(marketHistory, quant);
  const quantBacktest = buildQuantBacktestSummary({
    priceHistory,
    marketHistory,
    generatedAt: quant.updatedAt,
    runId,
  });
  quant.validatedAt = new Date().toISOString();
  quant.expiresAt = new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString();
  for (const key of ["accountSignals", "strategyAccountIntelligence", "agentBriefing", "relationCandidates", "baselineFreshness", "industryPulse"]) {
    if (!quant[key] || typeof quant[key] !== "object") continue;
    quant[key].runId = runId;
    quant[key].validatedAt = quant.validatedAt;
    quant[key].expiresAt = quant.expiresAt;
  }
  quant.historyCoverage = {
    ...quantHistoryCoverage(priceHistory, marketHistory),
    periods: quantBacktest.coverage,
    contractSchemaVersion: quantBacktest.schemaVersion,
  };
  const sourceRegistry = buildSourceRegistry({ prices, news, communitySignals, brokerResearch, facts, marketHistory, quant });
  const okCount = health.filter((item) => item.ok).length;
  const languageCounts = {
    english: news.filter((item) => verifiedNewsLanguage(item) === "english").length,
    chinese: news.filter((item) => verifiedNewsLanguage(item) === "chinese").length,
  };
  console.log(`\n수집 완료: ${okCount}/${health.length} 단계 성공, 기사 ${news.length}건(영문 ${languageCounts.english || 0} / 중문 ${languageCounts.chinese || 0}), 중국 현장 신호 ${communitySignals.items.length}건, 벤치마킹 신호 ${benchmarkSignals.stream.length}건, 가격표 ${prices.sections.length}개`);

  const payload = {
    schemaVersion: LIVE_SCHEMA_VERSION,
    runId,
    updatedAt: new Date().toISOString(),
    expiresAt: quant.expiresAt,
    timezone: "Asia/Seoul",
    stocks,
    quant,
    quantBacktest: {
      schemaVersion: quantBacktest.schemaVersion,
      generatedAt: quantBacktest.generatedAt,
      runId: quantBacktest.runId,
      coverage: quantBacktest.coverage,
    },
    prices,
    priceHistory,
    marketHistory: summarizeMarketHistory(marketHistory),
    competitors,
    startups,
    benchmarkSignals,
    chinaInfra,
    communitySignals,
    signals,
    facts,
    sourceRegistry,
    intelligence,
    brokerResearch,
    categories,
    news,
    referenceNews: {
      schemaVersion: "1.0",
      mode: "reference-only",
      generatedAt: evidenceValidatedAt,
      itemCount: newsPayload.referenceNews?.length || 0,
      methodology: "cumulative English and Chinese article archive with curated seeds and prior verified runs; excluded from live evidence promotion, derived signals, and quality counts",
      items: newsPayload.referenceNews || [],
    },
    trending,
    newsStats: stats,
    evidence: buildEvidenceLedger(news, evidenceValidatedAt),
    quarantineSummary: {
      total: quarantineReport.total,
      reasonCounts: quarantineReport.reasonCounts,
    },
    health,
  };

  payload.quality = buildQualityReport(payload);
  if (payload.quality.status !== "verified") {
    if (payload.quality.failures.includes("fact_timeline_integrity")) {
      console.error("사실 타임라인 진단:", JSON.stringify((facts.events || []).map((event) => ({
        id: event.id,
        stage: event.current?.stageId,
        source: event.current?.source,
        provenanceId: event.current?.provenanceId,
      })), null, 2));
    }
    // A transient source outage must not turn the scheduled job into a hard
    // failure or overwrite the last verified bundle.  Nothing is published
    // here: the dashboard continues to serve its prior verified run and the
    // source-health workflow can escalate repeated failures separately.
    console.warn(`quality gate rejected new crawl; retained previous verified bundle: ${payload.quality.failures.join(", ")}`);
    await writeVerifiedBundle([[REFRESH_STATUS_OUT, {
      schemaVersion: "1.0",
      status: "checked-degraded",
      lastCheckedAt: payload.updatedAt,
      latestVerifiedAt: previous.live?.updatedAt || null,
      published: false,
      failures: payload.quality.failures,
      observed: {
        newsItems: payload.news?.length || 0,
        successfulStages: payload.health?.filter((item) => item.ok).length || 0,
        totalStages: payload.health?.length || 0,
      },
    }]]);
    return { published: false, failures: payload.quality.failures };
  }

  priceHistory.runId = runId;
  priceHistory.validatedAt = payload.updatedAt;
  priceHistory.expiresAt = quant.expiresAt;
  marketHistory.runId = runId;
  marketHistory.validatedAt = payload.updatedAt;
  marketHistory.expiresAt = quant.expiresAt;
  quantBacktest.validatedAt = payload.updatedAt;
  quantBacktest.expiresAt = quant.expiresAt;
  payload.marketHistory.runId = runId;
  payload.marketHistory.validatedAt = payload.updatedAt;
  payload.marketHistory.expiresAt = quant.expiresAt;
  payload.priceHistory.validatedAt = payload.updatedAt;
  payload.priceHistory.expiresAt = quant.expiresAt;
  payload.quantBacktest.validatedAt = payload.updatedAt;
  payload.quantBacktest.expiresAt = quant.expiresAt;
  const publishedPayload = normalizeKoreanPayload(purgeCrawlExclusions(payload, crawlExclusionKeys).value);
  const publishedQuant = normalizeKoreanPayload(purgeCrawlExclusions(quant, crawlExclusionKeys).value);
  const publishedPriceHistory = normalizeKoreanPayload(purgeCrawlExclusions(priceHistory, crawlExclusionKeys).value);
  const publishedMarketHistory = normalizeKoreanPayload(purgeCrawlExclusions(marketHistory, crawlExclusionKeys).value);
  const publishedQuantBacktest = normalizeKoreanPayload(purgeCrawlExclusions(quantBacktest, crawlExclusionKeys).value);
  const publishedQuarantine = normalizeKoreanPayload(purgeCrawlExclusions(quarantineReport, crawlExclusionKeys).value);
  const publishedRefreshLedger = recordRefreshRequest(
    refreshLedger,
    refreshRequest,
    { runId, processedAt: payload.updatedAt, status: "published" },
    INTELLIGENCE_POLICY,
  );
  publishedPayload.quant = publishedQuant;
  publishedPayload.priceHistory = publishedPriceHistory;
  publishedPayload.marketHistory = summarizeMarketHistory(publishedMarketHistory);
  publishedPayload.quantBacktest = {
    schemaVersion: publishedQuantBacktest.schemaVersion,
    generatedAt: publishedQuantBacktest.generatedAt,
    runId: publishedQuantBacktest.runId,
    coverage: publishedQuantBacktest.coverage,
    validatedAt: publishedQuantBacktest.validatedAt,
    expiresAt: publishedQuantBacktest.expiresAt,
  };
  publishedPayload.quality = buildQualityReport(publishedPayload);
  const crawlAudit = buildCrawlAudit(publishedPayload, publishedQuarantine);
  const clientBundle = buildClientDataBundle({
    payload: publishedPayload,
    quant: publishedQuant,
    priceHistory: publishedPriceHistory,
    marketHistory: publishedMarketHistory,
    quantBacktest: publishedQuantBacktest,
    quarantinedClaims: publishedQuarantine.items || [],
  });
  await writeVerifiedBundle([
    [REFRESH_STATUS_OUT, {
      schemaVersion: "1.0",
      status: "published",
      lastCheckedAt: publishedPayload.updatedAt,
      latestVerifiedAt: publishedPayload.updatedAt,
      published: true,
      failures: [],
      observed: {
        newsItems: publishedPayload.news?.length || 0,
        successfulStages: publishedPayload.health?.filter((item) => item.ok).length || 0,
        totalStages: publishedPayload.health?.length || 0,
      },
    }],
    [HISTORY_OUT, publishedPriceHistory],
    [MARKET_HISTORY_OUT, publishedMarketHistory],
    [QUANT_BACKTEST_OUT, publishedQuantBacktest],
    [QUANT_OUT, publishedQuant],
    [LIVE_CLIENT_OUT, clientBundle.live],
    [QUANT_CLIENT_OUT, clientBundle.quant],
    [PRICE_HISTORY_CLIENT_OUT, clientBundle.priceHistory],
    [MARKET_HISTORY_CLIENT_OUT, clientBundle.marketHistory],
    [QUANT_BACKTEST_CLIENT_OUT, clientBundle.quantBacktest],
    [DECISION_HISTORY_CLIENT_OUT, clientBundle.decisionHistory],
    [LANDING_DECISION_CLIENT_OUT, clientBundle.landingDecision],
    [SITE_CONTENT_CLIENT_OUT, clientBundle.siteContent],
    [SITE_CONTENT_EXTENDED_CLIENT_OUT, clientBundle.siteContentExtended],
    [COMPANY_DIRECTORY_CLIENT_OUT, clientBundle.companyDirectory],
    [INSIGHT_LEDGER_OUT, clientBundle.insightLedger],
    [COMPANY_SIGNALS_OUT, clientBundle.companySignals],
    [MEMORY_DEMAND_OUT, clientBundle.memoryDemand],
    [SILICON_MAP_OUT, clientBundle.siliconMap],
    [PAIN_POINTS_OUT, clientBundle.painPoints],
    [ORG_SIGNALS_OUT, clientBundle.orgSignals],
    [CRAWL_QUARANTINE_OUT, publishedQuarantine],
    [CRAWL_AUDIT_OUT, crawlAudit],
    [TRANSLATION_CACHE_OUT, koTranslator?.snapshot() || previous.translationCache],
    [REFRESH_EVENTS_OUT, publishedRefreshLedger],
    [DATA_MANIFEST_OUT, clientBundle.manifest],
    [OUT, publishedPayload],
  ]);
  console.log(`검증 데이터 묶음 저장: ${OUT}`);
}

if (process.env.BACKFILL_DEBUG) {
  const history = await loadPriceHistory();
  const page = PRICE_PAGES[0];
  const ts = process.env.BACKFILL_TS || "20250811165422";
  const html = process.env.BACKFILL_FILE
    ? await readFile(process.env.BACKFILL_FILE, "utf8")
    : await fetchArchiveText(`https://web.archive.org/web/${ts}id_/${page.url}`);
  const parsed = parsePriceTables(html, page);
  console.log("sections:", (parsed || []).map((s) => `${s.id} (${s.rows?.length} rows)`));
  for (const section of (parsed || []).slice(0, 2)) {
    for (const row of (section.rows || []).slice(0, 4)) {
      const key = row.historyKey || priceHistoryKey(section, row);
      const hit = history.items[key] ? "EXACT" : (normalizedHistoryKey(key) && Object.values(history.items).some((i) => normalizedHistoryKey(i.key) === normalizedHistoryKey(key)) ? "NORM" : "MISS");
      console.log(`[${hit}] key=${key} · avg=${row.average}`);
    }
  }
  console.log("today keys sample:", Object.keys(history.items).slice(0, 6));
  process.exit(0);
}

async function runArchiveBackfillOnly() {
  const history = await loadPriceHistory();
  const added = await backfillPriceHistoryFromArchive(history);
  await writeVerifiedBundle([[HISTORY_OUT, history]]);
  console.log(`가격 아카이브 백필 완료: 추가 ${added}개 · ${HISTORY_OUT}`);
}

async function runMarketHistoryOnly() {
  const marketHistory = await updateMarketHistory();
  await writeVerifiedBundle([[MARKET_HISTORY_OUT, marketHistory]]);
  console.log(`상장사 시장 이력 갱신 완료: ${Object.keys(marketHistory.indexes || {}).length}개 · ${MARKET_HISTORY_OUT}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const run = process.argv.includes("--backfill-only")
    ? runArchiveBackfillOnly
    : process.argv.includes("--market-only")
      ? runMarketHistoryOnly
      : main;
  run().catch((error) => {
    console.error("크롤러 치명적 오류:", error);
    process.exit(1);
  });
}
