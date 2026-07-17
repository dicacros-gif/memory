#!/usr/bin/env node
/**
 * SKHY memory intelligence crawler.
 *
 * Collects public memory price tables, listed peer stocks, memory news,
 * competitor signals, and startup radar data for the static dashboard.
 * Node 18+ only; no external dependencies.
 */
import { readFile, writeFile, mkdir, rename, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "data", "live.json");
const HISTORY_OUT = resolve(__dirname, "..", "data", "price-history.json");
const MARKET_HISTORY_OUT = resolve(__dirname, "..", "data", "market-history.json");
const CRAWL_EXCLUSIONS_OUT = resolve(__dirname, "..", "data", "crawl-exclusions.json");
const TRENDFORCE_ORIGIN = "https://www.trendforce.com";
const PRICE_HISTORY_LOOKBACK_DAYS = 365 * 5;
const PRICE_HISTORY_RETENTION_POINTS = 365 * 5 + 60;
const MARKET_HISTORY_LOOKBACK_DAYS = 365 * 5;
const MARKET_HISTORY_RETENTION_POINTS = 365 * 5 + 60;
const NEWS_STREAM_LIMIT = 48;
const NEWS_ENRICH_CONCURRENCY = 5;
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

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
let crawlExclusionKeys = new Set();

async function writeJsonSafely(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const body = `${JSON.stringify(value, null, 2)}\n`;
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, body, { encoding: "utf8" });
  try {
    await rename(temporary, path);
  } catch (error) {
    if (!["EEXIST", "EPERM", "EACCES"].includes(error?.code)) throw error;
    await writeFile(path, body, { encoding: "utf8" });
    await rm(temporary, { force: true });
  }
}

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
  return crawlModerationKeys(type, item).some((key) => crawlExclusionKeys.has(key));
}

async function loadCrawlExclusions() {
  try {
    const parsed = JSON.parse(await readFile(CRAWL_EXCLUSIONS_OUT, "utf8"));
    const records = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.items) ? parsed.items : []);
    crawlExclusionKeys = new Set(records.flatMap((record) => {
      if (typeof record === "string") return [record];
      if (Array.isArray(record?.keys)) return record.keys;
      return record?.key ? [record.key] : [];
    }).map((key) => String(key || "").trim()).filter(Boolean));
    console.log(`크롤 제외 목록: ${crawlExclusionKeys.size}개 식별 키`);
  } catch (error) {
    crawlExclusionKeys = new Set();
    console.log(`크롤 제외 목록 없음: ${error.message}`);
  }
}

const TICKERS = [
  { id: "samsung", label: "삼성전자", symbol: "005930.KS" },
  { id: "skhynix", label: "SKHY", symbol: "000660.KS" },
  { id: "micron", label: "Micron", symbol: "MU" },
];

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
];

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
  { id: "hbm", label: "HBM·AI Memory", queries: ["HBM4 memory AI accelerator", "high bandwidth memory HBM", "SK hynix TSMC HBM4 base die", "Samsung HBM4 1c DRAM 4nm base die", "NVIDIA Rubin HBM4 11.7Gbps 36GB 48GB", "Micron HBM4 36GB 12H high volume production NVIDIA Vera Rubin", "Nvidia SK hynix multi-year HBM4 Vera Rubin co-development", "SK hynix HBM market share 58 Counterpoint Q1 2026 revenue", "TrendForce Rubin share 29 percent 22 percent 2026 Blackwell 71", "CXMT HBM3 delayed mass production 2027", "CXMT HBM3 delayed 2H 2026 mass production unlikely industry sources", "ChinaTalk mapping China's HBM advancement CXMT HBM3 HBM3E", "HBM export control China December 2024 SK hynix Samsung Micron", "SK hynix Q1 2026 HBM4 Vera Rubin HBM4E 2027"] },
  { id: "dram", label: "DRAM·DDR", queries: ["DRAM DDR5 server memory price", "DRAM market demand", "CXMT DDR5 yield cost per bit die size Samsung 40 percent December 2024 historical", "CXMT DDR5 4800 product specification process node teardown estimate 16nm 17nm", "CXMT IPO final offering 57.9 billion yuan July 2026", "CXMT IPO planned 29.5 billion yuan final 57.9 billion yuan", "Counterpoint DRAM market share Q1 2026 Samsung SK hynix Micron CXMT revenue 8 percent", "TrendForce CXMT wafer capacity 10 percent DRAM production capacity", "CXMT 2027 DRAM share forecast 13.9 percent", "TrendForce 3Q26 DRAM contract price 13 18 NAND 10 15", "UBS Q3 2026 DRAM 32 percent NAND 30 percent forecast", "CXMT Tencent 20 billion yuan server DRAM supply deal Reuters"] },
  { id: "nand", label: "NAND·SSD", queries: ["NAND flash enterprise SSD price", "SSD memory demand", "YMTC Xtacking 4.0 12.66 Gb/mm2 TechInsights 512Gb", "YMTC 1Tb 294 layer 20.5 Gb/mm2 estimate", "YMTC enterprise SSD customer China", "NAND contract price China eSSD", "YMTC NAND market share 2026 HSBC Qianhai 13 percent", "NAND contract price Q2 2026 70 75 TrendForce", "YMTC homegrown NAND production line US sanctions"] },
  { id: "china_nand", label: "China NAND Business", queries: ["YMTC eSSD Xtacking customer", "YMTC Wuhan Phase 3 NAND domestic equipment", "XMC Wuhan Xinxin NAND packaging", "JCET TFME advanced packaging NAND controller", "JCET XDFOI HBM AI packaging", "TFME advanced packaging China memory", "Naura AMEC ACM Research YMTC NAND equipment", "AMEC etch YMTC NAND", "ACM Research cleaning YMTC NAND", "YMTC controller firmware enterprise SSD", "China NAND subsidy server SSD procurement", "Chinese memory chips 15 percent cheaper YMTC CXMT", "China memory capacity expansion 2027 YMTC CXMT"] },
  { id: "skhynix_projection", label: "SKHY Product Projection", queries: ["SK hynix HBM4 server DRAM product mix", "SK hynix enterprise SSD Solidigm AI server storage", "SK hynix LPDDR UFS mobile memory demand", "SK hynix CXL memory module server roadmap", "SK hynix automotive memory edge AI", "SK hynix Nasdaq ADR SKHY 26.5 billion July 2026 SEC Reuters", "memory product mix AI server terminal NAND DRAM"] },
  { id: "cxl", label: "CXL·Next Memory", queries: ["CXL memory pooling", "CXL switch memory expansion", "CXL memory tester module", "CXL 3.1 memory module CMM-D", "Pangea v3 CXL 3.2", "4F2 vertical gate 3D DRAM SK hynix"] },
  { id: "packaging", label: "Packaging·Photonics", queries: ["advanced packaging HBM hybrid bonding", "silicon photonics interconnect memory", "HBM TC bonder equipment supply chain", "JCET XDFOI advanced packaging HBM", "XMC Wuhan HBM packaging", "YMTC sells 39 percent XMC stake Caixin Global 68.2 29.2", "TFME advanced packaging memory", "Huawei Ascend HBM packaging China"] },
  { id: "aidemand", label: "AI Demand", queries: ["AI memory demand data center", "AI accelerator memory bandwidth", "TrendForce global memory market 2027 1.28 trillion 2026 889.3 billion Agentic AI", "TrendForce DRAM 618.7 NAND 270.6 2026 memory market"] },
  { id: "benchmark", label: "China Benchmark", queries: ["China memory benchmark CXMT YMTC", "Chinese semiconductor equipment localization memory"] },
  { id: "china", label: "China·Geopolitics", queries: ["CXMT YMTC China memory", "China DRAM NAND export control", "CXMT revenue 2025 DRAM capacity", "YMTC Wuhan Phase 3 domestic equipment Naura AMEC", "YMTC existing Wuhan fabs 160000 200000 wpm source discrepancy", "YMTC sells XMC stake state-backed buyer Caixin Global June 2026", "BIS China memory export control VEU", "US VEU revocation SK hynix Samsung Intel China fabs annual license 2026", "MATCH Act DUV restriction cryogenic etch blanket ban removed Reuters", "HR 8170 MATCH Act House Foreign Affairs Committee 36-8 latest official action", "S.4281 MATCH Act Senate Banking Housing Urban Affairs latest official action", "CXMT IPO final offering 57.9 billion yuan July 2026", "CXMT IPO 15 percent overallotment 66.6 billion yuan", "CXMT HBM3 mass production order materials components unlikely 2026", "CXMT DDR5 yield cost per bit die size Samsung 40 percent December 2024", "CXMT yield engineer HBM TSV recruitment", "YMTC Xtacking eSSD engineer recruitment", "Huawei Ascend memory supply YMTC CXMT", "Tencent Alibaba ByteDance CXMT DRAM supply", "Tsinghua career CXMT YMTC semiconductor recruitment", "Nvidia H20 export controls China HBM memory demand The Diplomat"] },
  { id: "china_infra", label: "China Fab Infra", queries: ["SK hynix Wuxi fab water power land expansion", "SK hynix Wuxi K7 environmental impact assessment cleanroom expansion", "Wuxi high-tech bonded zone SK hynix land water electricity", "SK hynix Wuxi C2F additional cleanroom equipment installation", "BIS VEU SK hynix Wuxi fab capacity upgrade"] },
  { id: "china_talent_strategy", label: "China Talent Strategy", queries: ["SK hynix China hiring Wuxi Dalian Chongqing semiconductor", "China memory talent retention IP compliance semiconductor", "CXMT YMTC hiring yield TSV HBM engineer", "China enterprise SSD firmware FAE hiring memory", "Wuxi semiconductor EHS facility utilities hiring fab"] },
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
    id: "hbm",
    label: "HBM 권위 소스",
    queries: [
      "HBM4 memory source:Reuters",
      "HBM4 memory source:Bloomberg",
      "HBM4 memory source:Nikkei Asia",
      "HBM4 memory source:TrendForce",
      "HBM memory source:EE Times",
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
    ],
  },
];

const CHINESE_AUTHORITY_MONITORS = [
  {
    id: "dram",
    label: "DRAM 중국어 권위 소스",
    queries: ["财新 长鑫存储 DRAM", "第一财经 长鑫存储 DDR5", "集微网 长鑫存储"],
  },
  {
    id: "nand",
    label: "NAND 중국어 권위 소스",
    queries: ["财新 长江存储 NAND", "第一财经 长江存储 Xtacking", "集微网 长江存储"],
  },
  {
    id: "equipment",
    label: "장비 중국어 권위 소스",
    queries: ["证券时报 半导体设备 存储芯片", "经济观察网 半导体设备 存储", "集微网 北方华创 中微公司"],
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
  { query: "site:cxmt.zhiye.com 长鑫存储 校园招聘", platformId: "cxmt-careers" },
  { query: "site:whxmc.zhiye.com 新芯 校园招聘", platformId: "xmc-careers" },
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
    queries: ["Micron HBM AI memory DRAM guidance"],
    watchWords: ["HBM", "HBM4", "guidance", "AI", "contract", "capacity", "earnings"],
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
    queries: ["Kioxia SanDisk NAND SSD BiCS investment"],
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
  { id: "china_talent_strategy", label: "China Talent Strategy", queries: ["SK hynix China workforce strategy Wuxi Dalian Chongqing", "China memory hiring strategy IP retention compliance", "CXMT YMTC Boss Zhipin yield engineer hiring", "China semiconductor campus recruiting Tsinghua memory engineer", "China fab EHS facility water power engineer hiring"] },
  { id: "packaging", label: "Advanced Packaging", queries: ["JCET advanced packaging AI memory", "JCET XDFOI HBM AI packaging", "XMC HBM packaging China", "TFME advanced packaging memory China", "Huawei Ascend HBM packaging supply chain", "HBM TC bonder patent equipment"] },
  { id: "cxl", label: "CXL and PIM Value Chain", queries: ["CXL memory tester Exicon Neosem", "CXL controller IP memory pooling PIM", "CXL 3.1 module substrate TLB", "Openedges CXL controller IP", "FADU CXL memory controller"] },
  { id: "talent", label: "Talent and IP Signals", queries: ["China semiconductor talent hiring memory", "CXMT engineer hiring DRAM", "CXMT TSV yield engineer recruitment", "YMTC Xtacking eSSD engineer recruitment", "ijiwei CXMT YMTC recruitment engineer", "Tsinghua career CXMT YMTC semiconductor recruitment", "Boss Zhipin CXMT YMTC yield engineer", "Liepin CXMT YMTC semiconductor engineer", "Maimai CXMT YMTC memory engineer", "CNIPA CXMT YMTC HBM TSV patent", "China memory IP litigation Korean engineer CXMT YMTC"] },
];

const CHINA_INFRA_SOURCE_PAGES = [
  {
    id: "wuxi-bonded-zone",
    site: "wuxi",
    label: "Wuxi bonded zone expansion",
    url: "https://en.wuxi.gov.cn/2025-07/31/c_1113622.htm",
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
const EXCLUDED_NEWS_RE = /\b(apple|applem|aapl|iphone|ipad|macbook|9to5mac|applemagazine)\b|애플|아이폰|아이패드|맥북/i;
const LOW_CONFIDENCE_NEWS_RE = /(ad hoc news|indexbox|36\s*kr|36kr|borncity|mjengo|blockchain\.news|odaily|zamin\.uz|finance\.biggo|crypto briefing|weex|fortrinawwer|siliconanalysts|nand-research|reddit|facebook|linkedin\.com|x\.com|twitter\.com)/i;
const SKHYNIX_NEWSROOM_RE = /news\.skhynix\.com|sk\s*hynix\s*newsroom|skhy\s*newsroom/i;
const AUTHORITATIVE_EN_NEWS_RE =
  /(reuters|bloomberg|financial times|ft\.com|nikkei|cnbc|associated press|apnews|sec\.gov|nasdaq|trendforce|dramexchange|techinsights|yole|counterpoint|tom'?s hardware|tomshardware|south china morning post|scmp|caixin global|caixinglobal|digitimes|ee times|eetimes|semianalysis|techwire asia|the register|business insider|network world|evertiq|technode|techspot|japan times|electronics weekly|businesswire|pr newswire|solidigm|intel|u\.s\. bis|bis\.gov|govinfo|wsts|acm research ir|cxmt|shanghai stock exchange)/i;
const AUTHORITATIVE_CN_NEWS_RE =
  /(财新|caixin|第一财经|yicai|21财经|21世纪经济报道|证券时报|stcn|中国经营报|cb\.com\.cn|电子工程专辑|eet-china|集微网|ijiwei|经济观察网|eeo\.com\.cn|techweb|chinaflashmarket)/i;
const MEMORY_NEWS_RE =
  /(memory|dram|nand|hbm|ddr[345]?|lpddr|gddr|ssd|solidigm|cxl|wafer|memory chip|sk hynix|skhy|micron|kioxia|sandisk|cxmt|changxin|ymtc|yangtze memory|xmc|wuhan xinxin|存储|内存|闪存|固态|晶圆|长鑫|长江存储|长存|武汉新芯)/i;
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
    ? title.slice(0, 96)
    : title.split(" ").slice(0, 10).join(" ");
  const language = verifiedNewsLanguage(item) || "unknown";
  if (titleKey) return `${language}|title:${titleKey}|${publisherText(item).toLowerCase().trim()}`;
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
  if (!MEMORY_NEWS_RE.test(`${item.originalTitle || item.title || ""} ${item.source || ""}`)) return false;
  if (NEWS_MARKET_NOISE_RE.test(item.originalTitle || item.title || "")) return false;
  if (KOREAN_SOURCE_RE.test(src)) return false;
  if (SKHYNIX_NEWSROOM_RE.test(src)) return false;
  if (EXCLUDED_NEWS_RE.test(`${item.title || ""} ${item.source || ""} ${item.link || ""}`)) return false;
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

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  // Decode explicitly as UTF-8 from raw bytes. Relying on res.text()'s
  // charset detection mangled typographic punctuation (curly quotes, dashes)
  // in foreign headlines into garbage codepoints, so force UTF-8 here.
  const buf = await res.arrayBuffer();
  return new TextDecoder("utf-8").decode(buf);
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

function mergePricePoints(existing = [], incoming = []) {
  const byKey = new Map();
  const keyFor = (point) => {
    const rawTime = point.date || point.crawledAt || point.updatedAt || "";
    return kstPriceDayKey(rawTime) || String(point.sourceUpdate || rawTime || "unknown").slice(0, 10);
  };
  existing.forEach((point) => byKey.set(keyFor(point), point));
  incoming.forEach((point) => byKey.set(keyFor(point), point));
  return Array.from(byKey.values())
    .sort((a, b) => new Date(a.date || a.crawledAt || a.sourceUpdate || 0).getTime() - new Date(b.date || b.crawledAt || b.sourceUpdate || 0).getTime())
    .slice(-PRICE_HISTORY_RETENTION_POINTS);
}

async function fetchRemotePriceHistory(row, chartState) {
  if (!row.historyUrl) return { status: "no-url", points: [] };
  if (chartState.blocked) return { status: chartState.status || "login_required", points: [] };
  const url = priceChartUrlWithDays(row.historyUrl, PRICE_HISTORY_LOOKBACK_DAYS);
  if (!url) return { status: "no-url", points: [] };
  try {
    const res = await fetch(url, {
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
      updatedAt: parsed.updatedAt || null,
      timezone: parsed.timezone || "Asia/Seoul",
      items: parsed.items && typeof parsed.items === "object" ? parsed.items : {},
    };
  } catch {
    return { updatedAt: null, timezone: "Asia/Seoul", items: {} };
  }
}

async function updatePriceHistory(prices) {
  const history = await loadPriceHistory();
  let changed = false;
  const crawledAt = new Date().toISOString();
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

      const point = {
        date: crawledAt,
        sourceUpdate: section.lastUpdate || "",
        crawledAt,
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
        kstPriceDayKey(last.date || last.crawledAt) !== kstPriceDayKey(point.date) ||
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
    await writeJsonSafely(HISTORY_OUT, history);
    note("가격히스토리", true, "신규 포인트 저장");
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
async function fetchStock(symbol) {
  const path = `/v8/finance/chart/${encodeURIComponent(symbol)}?range=1mo&interval=1d`;
  const hosts = ["query2.finance.yahoo.com", "query1.finance.yahoo.com"];
  let lastErr;

  for (const host of hosts) {
    try {
      const txt = await fetchText(`https://${host}${path}`);
      const json = JSON.parse(txt);
      const result = json?.chart?.result?.[0];
      if (!result) throw new Error("빈 결과");
      const closes = (result.indicators?.quote?.[0]?.close || [])
        .map(Number)
        .filter((value) => Number.isFinite(value) && value > 0);
      if (closes.length < 2) throw new Error("종가 부족");
      const latestClose = closes[closes.length - 1];
      const prevClose = closes[closes.length - 2];
      const changePct = ((latestClose - prevClose) / prevClose) * 100;
      const points = closes.slice(-22).map((value) => Number(value.toFixed(2)));
      return {
        symbol,
        latestClose: Number(latestClose.toFixed(2)),
        prevClose: Number(prevClose.toFixed(2)),
        changePct: Number(changePct.toFixed(2)),
        points,
        currency: result.meta?.currency || null,
      };
    } catch (error) {
      lastErr = error;
    }
    await sleep(350);
  }

  throw lastErr || new Error("주가 조회 실패");
}

async function collectStocks() {
  const stocks = {};
  for (const ticker of TICKERS) {
    try {
      stocks[ticker.id] = { ...(await fetchStock(ticker.symbol)), label: ticker.label };
      note(`주가:${ticker.label}`, true, `${stocks[ticker.id].latestClose} (${stocks[ticker.id].changePct}%)`);
    } catch (error) {
      stocks[ticker.id] = null;
      note(`주가:${ticker.label}`, false, error.message);
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

function yahooHistoryPoints(result = {}) {
  const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const points = timestamps
    .map((ts, index) => {
      const close = Number(closes[index]);
      if (!Number.isFinite(close) || close <= 0) return null;
      const time = Number(ts) * 1000;
      return {
        date: new Date(time).toISOString(),
        time,
        close: Number(close.toFixed(2)),
        value: Number(close.toFixed(2)),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.time - b.time);
  return points;
}

function mergeMarketPoints(existing = [], incoming = []) {
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
      updatedAt: parsed.updatedAt || null,
      timezone: parsed.timezone || "Asia/Seoul",
      source: parsed.source || "Yahoo Finance chart API",
      indexes: parsed.indexes && typeof parsed.indexes === "object" ? parsed.indexes : {},
    };
  } catch {
    return { updatedAt: null, timezone: "Asia/Seoul", source: "Yahoo Finance chart API", indexes: {} };
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
        currency: result.meta?.currency || "USD",
        exchangeName: result.meta?.exchangeName || null,
        latestSource,
        latestSourceUrl,
        regularMarketTime: result.meta?.regularMarketTime ? new Date(result.meta.regularMarketTime * 1000).toISOString() : null,
        latest,
        dailyChangePct: dailyChangePct == null ? null : Number(dailyChangePct.toFixed(2)),
        cumulativeChangePct: cumulativeChangePct == null ? null : Number(cumulativeChangePct.toFixed(2)),
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
      changed = true;
    }
    await sleep(350);
  }

  if (changed) {
    history.updatedAt = crawledAt;
    await writeJsonSafely(MARKET_HISTORY_OUT, history);
  }

  return history;
}

function summarizeMarketHistory(history = {}) {
  const indexes = {};
  for (const [id, index] of Object.entries(history.indexes || {})) {
    const { points, ...summary } = index || {};
    indexes[id] = summary;
  }
  return {
    updatedAt: history.updatedAt || null,
    timezone: history.timezone || "Asia/Seoul",
    source: history.source || "Yahoo Finance chart API",
    indexes,
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

async function fetchGoogleNews(query, category = "", locale = "en") {
  const isChinese = locale === "zh";
  const edition = isChinese
    ? { hl: "zh-CN", gl: "CN", ceid: "CN:zh-Hans" }
    : { hl: "en-US", gl: "US", ceid: "US:en" };
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query + " when:30d")}&hl=${edition.hl}&gl=${edition.gl}&ceid=${edition.ceid}`;
  const xml = await fetchText(url);
  return parseRSS(xml)
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
  if (/(?:\.{3,}|…|[-–—])\s*$/u.test(clean)) return false;
  if (/\b(?:a|an|the|to|of|for|with|and|or|by|from|at|in|on)$/i.test(clean) && clean.length >= 120) return false;
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

function sanitizeSourceUrl(value = "") {
  try {
    const parsed = new URL(value);
    if (!/^https?:$/i.test(parsed.protocol)) return "";
    parsed.hash = "";
    const allow = new Set(["id", "article", "story", "p", "page"]);
    for (const [key, paramValue] of Array.from(parsed.searchParams.entries())) {
      if (!allow.has(key.toLowerCase()) || paramValue.length > 80 || /(?:电话|微信|上门|模特|兼职|escort|telegram|whatsapp)/i.test(paramValue)) {
        parsed.searchParams.delete(key);
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
  const cachedSummary = String(cached?.summaryOriginal || "").trim();
  const cachedSourceUrl = sanitizeSourceUrl(cached?.sourceUrl || "");
  if (isCompleteArticleSummary(cachedSummary) && cachedSourceUrl) {
    return {
      ...item,
      sourceUrl: cachedSourceUrl,
      summaryOriginal: cached.summaryOriginal,
      summary: cached.summary || "",
      summarySource: cached.summarySource || "source-meta",
    };
  }
  let resolvedUrl = cachedSourceUrl;
  try {
    resolvedUrl ||= await resolveGoogleNewsUrl(item.link || "");
    if (!resolvedUrl) return { ...item, summarySource: "headline" };
    const html = await fetchText(resolvedUrl);
    const summaryOriginal = articleMetaDescription(html, item.title).slice(0, 620);
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

async function enrichNewsItems(items = [], previousItems = []) {
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
  note("뉴스원문요약", sourceCount > 0, `${sourceCount}/${output.length}건 원문 메타 확보`);
  return output;
}

/* ---------- best-effort EN->KO headline translation (no API key) ---------- */
let _trCount = 0;
const TR_CAP = 210;

async function translateKo(text) {
  if (!text) return "";
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ko&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, { headers: { "User-Agent": BROWSER_UA, Accept: "application/json" } });
    if (!res.ok) return "";
    const buf = await res.arrayBuffer();
    const json = JSON.parse(new TextDecoder("utf-8").decode(buf));
    const parts = (json[0] || []).map((seg) => (seg && seg[0]) || "").join("");
    return String(parts || "").replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}

async function addKoTitles(arr, limit) {
  const items = (arr || []).slice(0, limit || (arr || []).length);
  for (const item of items) {
    if (_trCount >= TR_CAP) break;
    if (!item || !item.title || item.titleKo) continue;
    const ko = await translateKo(item.title);
    const cleanKo = cleanKoNewsText(ko);
    if (cleanKo && cleanKo !== item.title) item.titleKo = cleanKo;
    _trCount += 1;
    await sleep(120);
  }
}

async function addKoSummaries(arr, limit) {
  const items = (arr || []).slice(0, limit || (arr || []).length);
  for (const item of items) {
    if (_trCount >= TR_CAP) break;
    if (!item?.summaryOriginal || item.summary) continue;
    const ko = await translateKo(item.summaryOriginal);
    const cleanKo = cleanKoNewsText(ko);
    item.summary = cleanKo || item.summaryOriginal;
    _trCount += 1;
    await sleep(120);
  }
}

async function fetchCategory(cat, seen, locale = "en") {
  const items = [];
  for (const query of cat.queries) {
    try {
      const queryItems = await fetchGoogleNews(query, cat.id, locale);
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

async function collectNews(previousNews = []) {
  const seen = new Set();
  const categories = [];
  let all = [];

  for (const cat of CATEGORIES.concat(ENGLISH_AUTHORITY_MONITORS)) {
    const items = (await fetchCategory(cat, seen)).filter((item) => !isCrawlerExcluded("news", item));
    all = all.concat(items);
    mergeNewsCategory(categories, cat, items);
  }

  for (const cat of CHINESE_CATEGORIES.concat(CHINESE_AUTHORITY_MONITORS)) {
    const items = (await fetchCategory(cat, seen, "zh")).filter((item) => !isCrawlerExcluded("news", item));
    all = all.concat(items);
    mergeNewsCategory(categories, cat, items, 10);
  }

  all = all.filter((item) => verifiedNewsLanguage(item));
  all.sort((a, b) => b.ts - a.ts);
  const selected = ["english", "chinese"]
    .flatMap((language) => all.filter((item) => verifiedNewsLanguage(item) === language).slice(0, NEWS_STREAM_LIMIT))
    .sort((a, b) => b.ts - a.ts);
  const latestNews = (await enrichNewsItems(selected, previousNews))
    .filter((item) => !isCrawlerExcluded("news", item));
  return {
    categories,
    news: latestNews.map(({ ts, ...rest }) => rest),
    trending: extractTrending(all),
    newsStats: newsStats(all),
    allNews: all,
  };
}

/* ---------- China public community and hiring signals ---------- */
const COMMUNITY_ENTITY_RE = /(长鑫(?:存储)?|长江存储|长存|武汉新芯|新芯|北方华创|中微公司|华为海思|CXMT|YMTC|XMC|NAURA|AMEC)/i;
const COMMUNITY_MEMORY_RE = /(存储芯片|存储器|内存|半导体|DRAM|DDR[345]|LPDDR|HBM|NAND|SSD|Xtacking|晶圆|良率|制程|工艺|TSV|封装|光刻|刻蚀|设备|材料|校招|招聘|工程师)/i;
const COMMUNITY_WORKPLACE_RE = /(招聘|校招|社招|岗位|职位|薪资|面试|员工|工程师|工艺整合|良率|人才|跳槽|入职|career|job|hiring|yield engineer)/i;
const COMMUNITY_CONSUMER_RE = /(装机|消费者|价格|涨价|降价|颗粒|内存条|固态硬盘|零售|购买|兼容|超频|玩家|retail|consumer|price)/i;
const COMMUNITY_TECH_RE = /(DDR[345]|LPDDR|HBM|NAND|SSD|Xtacking|TSV|封装|工艺|制程|良率|晶圆|光刻|刻蚀|技术|架构|性能|带宽|yield|process|technology)/i;
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
  const labels = [platformLabel, "雪球", "知乎", "东方财富股吧", "东方财富", "V2EX", "Chiphell", "什么值得买", "NGA", "脉脉", "牛客", "看准", "BOSS直聘", "猎聘", "智联招聘"]
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
  const sourceWeight = item.sourceClass === "official-career" ? 18 : item.sourceClass === "job-board" ? 10 : 4;
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
  const url = sanitizeSourceUrl(item.link || item.sourceUrl || "");
  if (url) return `url:${url.replace(/\/$/, "").toLowerCase()}`;
  return `title:${String(item.title || item.titleKo || "").toLowerCase().replace(/[^a-z0-9一-鿿가-힣]+/g, "").slice(0, 120)}`;
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
  const path = new URL(sourceUrl).pathname.replace(/\/$/, "");
  const genericCareerPortal = rule.sourceClass === "official-career" && /\/(?:join\.html|social|campus|campus\/jobs)$/i.test(path);
  if (genericCareerPortal && !/(工程师|工艺|设备|研发|良率|岗位|职位|engineer|process|yield)/i.test(combined)) return null;
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
    ...evidence,
  };
  item.score = Math.max(communityScore(item), item.importance);
  return item;
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

async function fetchBingCommunity(query = "") {
  const url = `https://www.bing.com/search?format=rss&setlang=zh-Hans&mkt=zh-CN&count=20&q=${encodeURIComponent(query)}`;
  const xml = await fetchText(url);
  return parseRSS(xml);
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
  for (const target of COMMUNITY_DISCOVERY_QUERIES) {
    try {
      const results = await fetchBingCommunity(target.query);
      results.forEach((result) => {
        const item = normalizeCommunityItem(result, target.platformId);
        if (item) discovered.push(item);
      });
    } catch (error) {
      console.log(`- 중국현장:${target.platformId} 검색 지연 — ${error.message}`);
    }
    await sleep(180);
  }

  const previous = (previousItems || []).map((item) => normalizeCommunityItem({
    ...item,
    rssDescription: item.summaryOriginal || item.summary || "",
    pubDate: item.date || item.publishedAt || "",
  }, item.platformId)).filter(Boolean);
  const seeds = COMMUNITY_HISTORY_SEEDS.map(normalizeCommunitySeed).filter(Boolean);
  const byKey = new Map();
  [...seeds, ...previous, ...discovered].forEach((item) => {
    const key = communityKey(item);
    if (!key) return;
    byKey.set(key, byKey.has(key) ? mergeCommunityItems(byKey.get(key), item) : item);
  });

  const retentionCutoff = Date.now() - COMMUNITY_RETENTION_DAYS * 864e5;
  const items = Array.from(byKey.values())
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
  note("중국현장신호", items.length > 0, `${items.length}건 · ${Object.keys(platformCounts).length}개 공개 채널`);
  return {
    updatedAt: new Date().toISOString(),
    latestPublishedAt: latestAt ? new Date(latestAt).toISOString() : null,
    source: "Public community pages · public hiring listings · Bing Web Search RSS discovery",
    total: items.length,
    recent30d: items.filter((item) => item.ts && Date.now() - item.ts <= 30 * 864e5).length,
    historicalCount: items.filter((item) => item.historical).length,
    sourceCount: Object.keys(platformCounts).length,
    typeCounts,
    platformCounts,
    briefs: buildCommunityBriefs(items),
    items,
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
async function collectBenchmarkSignals() {
  const seen = new Set();
  const themes = [];
  let stream = [];

  for (const theme of BENCHMARK_SIGNAL_THEMES) {
    const items = [];
    for (const query of theme.queries) {
      try {
        const queryItems = await fetchGoogleNews(query, theme.id);
        for (const item of queryItems) {
          if (isCrawlerExcluded("news", item)) continue;
          const key = canonicalNewsKey(item);
          if (seen.has(key)) continue;
          seen.add(key);
          items.push(item);
        }
      } catch (error) {
        note(`벤치마킹:${theme.label}/${query}`, false, error.message);
      }
      await sleep(320);
    }
    items.sort((a, b) => b.ts - a.ts);
    if (items.length > 0) {
      themes.push({
        id: theme.id,
        label: theme.label,
        count: items.length,
        items: items.slice(0, 10).map(({ ts, category, ...rest }) => rest),
      });
      stream = stream.concat(items);
      note(`벤치마킹:${theme.label}`, true, `${items.length}건`);
    } else {
      console.log(`- 벤치마킹:${theme.label} 결과 없음 → 테마 제외`);
    }
  }

  stream.sort((a, b) => b.ts - a.ts);
  return {
    updatedAt: new Date().toISOString(),
    themes,
    stream: stream.slice(0, 40).map(({ ts, category, ...rest }) => ({ ...rest, theme: category || "" })),
    stats: newsStats(stream),
  };
}

async function collectChinaInfra() {
  const sources = [];
  for (const source of CHINA_INFRA_SOURCE_PAGES) {
    try {
      const html = await fetchText(source.url);
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
        publishedAt: source.publishedAt || null,
        ok: true,
        markerHits: hitCount,
        markers,
        excerpt: description || text.slice(0, 360),
        crawledAt: new Date().toISOString(),
      });
      note(`중국Fab인프라:${source.label}`, hitCount > 0, `${hitCount}/${markers.length} markers`);
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
async function loadPreviousData() {
  try {
    const previous = JSON.parse(await readFile(OUT, "utf8"));
    return {
      news: Array.isArray(previous.news) ? previous.news : [],
      communityItems: Array.isArray(previous.communitySignals?.items) ? previous.communitySignals.items : [],
    };
  } catch {
    return { news: [], communityItems: [] };
  }
}

const INTELLIGENCE_TOPICS = [
  {
    id: "hbm",
    label: "HBM·AI 서버",
    terms: ["hbm", "hbm4", "hbm4e", "rubin", "high bandwidth memory", "cowos", "base die"],
    priceTerms: ["ddr5", "rdimm", "gddr6"],
    priceProxy: true,
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
];

const OFFICIAL_SOURCE_RE = /(?:\.gov(?:\/|$)|govinfo\.gov|congress\.gov|sec\.gov|hkexnews\.hk|investors?\.|ir\.|newsroom\.|company\/(?:news|press))/i;
const ANALYSIS_SOURCE_RE = /(?:trendforce\.com\/(?:presscenter|price|news)|counterpointresearch\.com|techinsights\.com|wsts\.org|yolegroup\.com)/i;
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
  const chineseOnly = String(item.language || "").toLowerCase() === "chinese";
  return {
    sourceType: chineseOnly ? "중국어 보도" : isOfficial ? "공식" : isMedia ? "외신" : isAnalysis ? "분석" : "내부추정",
    claimType: companyView ? "업체전망" : estimated ? "전망·추정" : "사실",
    evidenceLevel: !chineseOnly && url && (isOfficial || isMedia || isAnalysis) && !estimated && !companyView ? "Confirmed" : "Watch",
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
  return {
    item: row.item,
    group: row.group,
    table: row.sectionTitle,
    latest,
    latestRaw: row.averageRaw || String(row.average || ""),
    dailyChangePct: Number.isFinite(Number(row.changePct)) ? Number(row.changePct) : null,
    periodChangePct,
    observedPoints: history.length,
    firstObservedAt: history[0]?.crawledAt || null,
    lastUpdate: row.lastUpdate || null,
    sourceUrl: row.sourceUrl || "",
    isProxy: Boolean(topic.priceProxy),
  };
}

function compactArticleSummary(item = {}) {
  const hay = `${item.title || ""} ${item.titleKo || ""} ${item.summary || item.summaryOriginal || ""}`.toLowerCase();
  if (/cxmt|changxin/.test(hay) && /(?:8\.5|8\.54|57\.9).{0,24}(?:bn|billion|달러|위안)|largest chinese chip ipo/.test(hay)) {
    return "Nikkei Asia와 Reuters는 CXMT의 확정 공모 규모가 579억 위안(약 $8.5B)이라고 보도했습니다. 초기 계획액 295억 위안과 최종 공모액을 분리해 봐야 합니다.";
  }
  if (/(?:ymtc|yangtze).{0,80}(?:xmc|wuhan xinxin)|(?:xmc|wuhan xinxin).{0,80}(?:ymtc|yangtze)/.test(hay) && /(?:39%|39 percent|stake|지분|control)/.test(hay)) {
    return "Caixin Global은 YMTC가 XMC 지분 39%를 매각해 보유율을 68.2%에서 29.2%로 낮추는 거래를 보도했습니다. 거래 종결 전까지 XMC 거버넌스 변경은 Watch로 관리합니다.";
  }
  if (/rubin/.test(hay) && /(?:29%|29 percent)/.test(hay) && /(?:22%|22 percent)/.test(hay)) {
    return "TrendForce는 2026년 NVIDIA 고급 GPU 출하에서 Rubin 비중 전망을 29%에서 22%로 낮췄습니다. 공급사별 HBM4 배분과는 다른 제품 믹스 전망입니다.";
  }
  if (/\bubs\b/.test(hay) && /(dram|ddr)/.test(hay) && /nand/.test(hay) && /(32|30)/.test(hay)) {
    return "UBS의 3Q26 DRAM +32%, NAND +30% 전망은 TrendForce 기준선보다 높은 애널리스트 상방 시나리오입니다. 실제 contract 가격과 전제를 분리해 추적합니다.";
  }
  if (/lenovo/.test(hay) && /ymtc/.test(hay) && /(?:outside china|overseas|shipping|notebook|laptop)/.test(hay)) {
    return "DigiTimes는 중국 외 지역에서 판매되는 Lenovo 노트북 일부에 YMTC SSD가 탑재됐다고 보도했습니다. 중국 NAND의 해외 OEM 채택이 확인된 사례입니다.";
  }
  if (/sk hynix|skhy/.test(hay) && /(?:memory shortage|worst year)/.test(hay) && /2030/.test(hay)) {
    return "SKHY 경영진은 메모리 공급 부족이 2027년에 가장 심해지고 2030년까지 이어질 수 있다고 전망했습니다. 이는 회사 전망이므로 수요·캐파 실측과 분리해 봐야 합니다.";
  }
  if (/\badata\b/.test(hay) && /(dram|nand)/.test(hay) && /(20|30|35|40)/.test(hay)) {
    return "ADATA 경영진의 3Q26 체감 전망은 DRAM +20~30%, NAND +35~40%이며, TrendForce 공식 시장 전망(DRAM +13~18%, NAND +10~15%)과 분리해 상방 시나리오로만 봅니다.";
  }
  if (/hbm/.test(hay) && /2027/.test(hay) && /(double|2배|4~5|4-5)/.test(hay)) {
    return "Digitimes의 가격 상승 전망은 전체 HBM이 아니라 HBM4 기준이며, 2026년 하반기 약 $2/Gb에서 2027년 $4~5/Gb 이상 가능성을 제시한 업계 추정입니다.";
  }
  const value = cleanKoNewsText(item.summary || item.summaryOriginal || "");
  if (!value) return "";
  if (/중국 최대의 삼성전자/.test(value)) return "";
  const hangulCount = (value.match(/[가-힣]/g) || []).length;
  if (hangulCount < 10) return "";
  return value.length > 260 ? `${value.slice(0, 257).trim()}...` : value;
}

function intelligenceTitle(item = {}) {
  let title = cleanKoNewsText(item.titleKo || item.title || "");
  const source = cleanKoNewsText(item.source || "");
  if (!title || !source) return title;
  for (const separator of [" - ", " – ", " — ", " | "]) {
    const suffix = `${separator}${source}`;
    if (title.toLowerCase().endsWith(suffix.toLowerCase())) {
      title = title.slice(0, -suffix.length).trim();
      break;
    }
  }
  return title;
}

function buildIntelligence({ news = [], prices = {}, stats = {}, chinaInfra = {} }) {
  const generatedAt = new Date().toISOString();
  const priceRows = intelligencePriceRows(prices);
  const policyFallbacks = (chinaInfra.sources || [])
    .filter((source) => source.ok && /bis|veu|export/i.test(`${source.id || ""} ${source.label || ""}`) && /^https?:\/\//i.test(source.url || ""))
    .map((source) => {
      const summary = source.id === "bis-veu"
        ? "BIS는 기존 VEU 참여사가 중국 내 기존 팹을 운영하기 위한 수출 라이선스 신청은 허용할 의향이 있지만, 캐파 확대나 기술 업그레이드 목적의 라이선스는 허용하지 않겠다고 밝혔습니다."
        : source.excerpt || "";
      return {
        title: `${source.label} official update`,
        titleKo: `${source.label} 공식 원문 업데이트`,
        summaryOriginal: summary,
        summary,
        source: "U.S. BIS",
        sourceUrl: source.url,
        date: source.publishedAt || String(source.crawledAt || generatedAt).slice(0, 10),
        category: "policy",
      };
    });
  const newsCandidates = news.concat(policyFallbacks);
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
    const top = ranked[0]?.item;
    if (!top) return null;
    const sourceMeta = intelligenceSource(top);
    const price = priceEvidenceForTopic(priceRows, topic);
    const priceSentence = price && price.periodChangePct != null
      ? `${price.item}은 공개 누적 ${price.observedPoints}개 관측에서 ${price.periodChangePct >= 0 ? "+" : ""}${price.periodChangePct.toFixed(2)}% 변했습니다${price.isProxy ? "(직접 가격이 아닌 proxy)" : ""}.`
      : "";
    return {
      id: topic.id,
      label: topic.label,
      generatedAt,
      evidenceCount: ranked.length + (price ? 1 : 0),
      latest: {
        title: intelligenceTitle(top),
        originalTitle: top.title,
        summary: compactArticleSummary(top),
        source: top.source || "Unknown",
        url: directNewsUrl(top),
        publishedAt: top.date || top.publishedAt || null,
        sourceType: sourceMeta.sourceType,
        claimType: sourceMeta.claimType,
        evidenceLevel: sourceMeta.evidenceLevel,
      },
      price,
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
    methodologyVersion: "2.0-evidence-gated",
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

function buildQualityReport(payload = {}) {
  const news = Array.isArray(payload.news) ? payload.news : [];
  const community = Array.isArray(payload.communitySignals?.items) ? payload.communitySignals.items : [];
  const briefs = Array.isArray(payload.intelligence?.briefs) ? payload.intelligence.briefs : [];
  const priceRows = (payload.prices?.sections || []).flatMap((section) => section.rows || []);
  const marketIndexes = Object.values(payload.marketHistory?.indexes || {});
  const stocks = Object.values(payload.stocks || {});
  const directNews = news.filter((item) => /^https?:\/\//i.test(directNewsUrl(item)) && !/news\.google\.com/i.test(directNewsUrl(item)));
  const summarizedNews = news.filter((item) => String(item.summary || item.summaryOriginal || "").trim().length >= 20);
  const languageCounts = news.reduce((counts, item) => {
    const language = verifiedNewsLanguage(item);
    if (language === "english" || language === "chinese") counts[language] += 1;
    return counts;
  }, { english: 0, chinese: 0 });
  const canonicalUrls = news.map(qualityCanonicalUrl).filter(Boolean);
  const duplicateCount = canonicalUrls.length - new Set(canonicalUrls).size;
  const validMarkets = marketIndexes.filter((item) => Number(item?.latest?.close ?? item?.latest?.value) > 0);
  const validStocks = stocks.filter((item) => Number(item?.latestClose) > 0);
  const validBriefs = briefs.filter((brief) => (
    /^https?:\/\//i.test(String(brief.latest?.url || ""))
    && !/news\.google\.com/i.test(String(brief.latest?.url || ""))
    && String(brief.latest?.summary || "").trim().length >= 20
    && String(brief.decision || "").trim()
    && String(brief.reversalKpi || "").trim()
  ));
  const directSourceRatio = news.length ? directNews.length / news.length : 0;
  const summaryRatio = news.length ? summarizedNews.length / news.length : 0;
  const checks = [
    { id: "price_rows", critical: true, passed: priceRows.length >= 10, observed: priceRows.length, threshold: 10 },
    { id: "news_total", critical: true, passed: news.length >= 24, observed: news.length, threshold: 24 },
    { id: "news_english", critical: true, passed: languageCounts.english >= 12, observed: languageCounts.english, threshold: 12 },
    { id: "news_chinese", critical: true, passed: languageCounts.chinese >= 4, observed: languageCounts.chinese, threshold: 4 },
    { id: "news_direct_sources", critical: true, passed: directSourceRatio >= 0.9, observed: Number(directSourceRatio.toFixed(3)), threshold: 0.9 },
    { id: "news_summaries", critical: true, passed: summaryRatio >= 0.55, observed: Number(summaryRatio.toFixed(3)), threshold: 0.55 },
    { id: "news_duplicates", critical: true, passed: duplicateCount === 0, observed: duplicateCount, threshold: 0 },
    { id: "community_signals", critical: true, passed: community.length >= 5, observed: community.length, threshold: 5 },
    { id: "decision_briefs", critical: true, passed: validBriefs.length >= 6, observed: validBriefs.length, threshold: 6 },
    { id: "market_indexes", critical: true, passed: validMarkets.length >= 3, observed: validMarkets.length, threshold: 3 },
    { id: "peer_stocks", critical: true, passed: validStocks.length >= 2, observed: validStocks.length, threshold: 2 },
  ];
  const failures = checks.filter((check) => check.critical && !check.passed);
  return {
    status: failures.length ? "rejected" : "verified",
    verifiedAt: failures.length ? null : payload.updatedAt,
    methodologyVersion: "3.0-evidence-gated",
    checks,
    failures: failures.map((check) => check.id),
    metrics: {
      priceRows: priceRows.length,
      newsItems: news.length,
      englishNews: languageCounts.english,
      chineseNews: languageCounts.chinese,
      directSourceRatio: Number(directSourceRatio.toFixed(3)),
      summaryRatio: Number(summaryRatio.toFixed(3)),
      duplicateCount,
      communitySignals: community.length,
      decisionBriefs: validBriefs.length,
      marketIndexes: validMarkets.length,
      peerStocks: validStocks.length,
    },
    channels: {
      prices: payload.prices?.updatedAt || payload.updatedAt,
      news: payload.updatedAt,
      community: payload.communitySignals?.updatedAt || payload.updatedAt,
      markets: payload.marketHistory?.updatedAt || payload.updatedAt,
    },
  };
}

async function main() {
  await loadCrawlExclusions();
  const previous = await loadPreviousData();
  const [prices, stocks, newsPayload, communitySignals, competitors, startups, benchmarkSignals, chinaInfra] = await Promise.all([
    collectPrices(),
    collectStocks(),
    collectNews(previous.news),
    collectCommunitySignals(previous.communityItems),
    collectCompetitors(),
    collectStartups(),
    collectBenchmarkSignals(),
    collectChinaInfra(),
  ]);
  const priceHistory = await updatePriceHistory(prices);
  attachPriceHistory(prices, priceHistory);
  const marketHistory = await updateMarketHistory();

  const { categories, news, trending, newsStats: stats } = newsPayload;

  // Best-effort Korean headlines (no API key; English fallback on any failure).
  try {
    await addKoTitles(news, 72);
    await addKoSummaries(news, 72);
    await addKoTitles(communitySignals.items, 30);
    await addKoSummaries(communitySignals.items, 30);
    await addKoTitles(benchmarkSignals.stream, 24);
    for (const competitor of competitors.competitors) await addKoTitles(competitor.recentNews, 2);
    for (const startup of startups.candidates) await addKoTitles(startup.recentNews, 2);
    note("번역:KO", true, `${_trCount}건`);
  } catch (error) {
    note("번역:KO", false, error.message);
  }

  const signals = buildSignals({ prices, competitors, startups, newsStats: stats });
  const intelligence = buildIntelligence({ news, prices, stats, chinaInfra });
  const okCount = health.filter((item) => item.ok).length;
  const languageCounts = {
    english: news.filter((item) => verifiedNewsLanguage(item) === "english").length,
    chinese: news.filter((item) => verifiedNewsLanguage(item) === "chinese").length,
  };
  console.log(`\n수집 완료: ${okCount}/${health.length} 단계 성공, 기사 ${news.length}건(영문 ${languageCounts.english || 0} / 중문 ${languageCounts.chinese || 0}), 중국 현장 신호 ${communitySignals.items.length}건, 벤치마킹 신호 ${benchmarkSignals.stream.length}건, 가격표 ${prices.sections.length}개`);

  const payload = {
    schemaVersion: "3.0",
    runId: process.env.GITHUB_RUN_ID || `local-${Date.now()}`,
    updatedAt: new Date().toISOString(),
    timezone: "Asia/Seoul",
    stocks,
    prices,
    priceHistory,
    marketHistory: summarizeMarketHistory(marketHistory),
    competitors,
    startups,
    benchmarkSignals,
    chinaInfra,
    communitySignals,
    signals,
    intelligence,
    categories,
    news,
    trending,
    newsStats: stats,
    health,
  };

  payload.quality = buildQualityReport(payload);
  if (payload.quality.status !== "verified") {
    throw new Error(`quality gate rejected crawl: ${payload.quality.failures.join(", ")}`);
  }

  await writeJsonSafely(OUT, payload);
  console.log(`저장: ${OUT}`);
}

main().catch((error) => {
  console.error("크롤러 치명적 오류:", error);
  process.exit(1);
});
