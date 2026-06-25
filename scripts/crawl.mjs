#!/usr/bin/env node
/**
 * SK hynix memory intelligence crawler.
 *
 * Collects public memory price tables, listed peer stocks, memory news,
 * competitor signals, and startup radar data for the static dashboard.
 * Node 18+ only; no external dependencies.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "data", "live.json");
const HISTORY_OUT = resolve(__dirname, "..", "data", "price-history.json");

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

const TICKERS = [
  { id: "samsung", label: "삼성전자", symbol: "005930.KS" },
  { id: "skhynix", label: "SK하이닉스", symbol: "000660.KS" },
  { id: "micron", label: "Micron", symbol: "MU" },
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
  { id: "hbm", label: "HBM·AI Memory", queries: ["HBM4 memory AI accelerator", "high bandwidth memory HBM"] },
  { id: "dram", label: "DRAM·DDR", queries: ["DRAM DDR5 server memory price", "DRAM market demand"] },
  { id: "nand", label: "NAND·SSD", queries: ["NAND flash enterprise SSD price", "SSD memory demand"] },
  { id: "cxl", label: "CXL·Next Memory", queries: ["CXL memory pooling", "CXL switch memory expansion"] },
  { id: "packaging", label: "Packaging·Photonics", queries: ["advanced packaging HBM hybrid bonding", "silicon photonics interconnect memory"] },
  { id: "aidemand", label: "AI Demand", queries: ["AI memory demand data center", "AI accelerator memory bandwidth"] },
  { id: "dealflow", label: "M&A·Investment", queries: ["semiconductor memory M&A acquisition", "memory startup funding round investment", "SK hynix investment stake"] },
  { id: "china", label: "China·Geopolitics", queries: ["CXMT YMTC China memory", "China DRAM NAND export control"] },
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
    label: "Kioxia / Western Digital",
    shortLabel: "Kioxia·WD",
    segment: "NAND · 엔터프라이즈 SSD",
    baseline: "NAND 공급 조절, SSD 계약가, 일본·미국 투자 동향이 하이닉스 NAND 전략에 직접 영향.",
    queries: ["Kioxia Western Digital NAND SSD IPO"],
    watchWords: ["NAND", "SSD", "enterprise", "wafer", "capacity", "IPO"],
    pressureBase: 20,
  },
  {
    id: "ymtc",
    label: "YMTC",
    shortLabel: "YMTC",
    segment: "중국 NAND · Xtacking",
    baseline: "중국 NAND 내재화와 가격 경쟁의 장기 변수. 제재 우회, 양산 수율, 고객 확대 확인.",
    queries: ["YMTC Yangtze Memory NAND China Xtacking"],
    watchWords: ["NAND", "Xtacking", "China", "sanction", "capacity", "smartphone"],
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

// Foreign deal-flow themes feeding the M&A / CVC / portfolio radars.
const DEALFLOW = [
  { id: "ma", label: "Memory M&A", queries: ["semiconductor memory acquisition deal", "memory company merger acquisition"] },
  { id: "funding", label: "Startup Funding", queries: ["CXL memory startup funding round", "photonics interconnect startup Series funding"] },
  { id: "skhynix", label: "SK hynix CorpDev", queries: ["SK hynix investment acquisition stake", "SK hynix Solidigm Kioxia"] },
];

const STOPWORDS = new Set([
  "memory", "chip", "chips", "price", "prices", "market", "report", "says", "said",
  "the", "and", "for", "with", "from", "that", "this", "are", "will", "has", "new",
  "its", "into", "amid", "could", "would", "their", "than", "over", "after", "more",
  "how", "why", "what", "may", "can", "out", "but", "not", "you", "your", "inc",
  "ltd", "corp", "company", "tech", "news", "update", "billion", "million", "yahoo",
  "google", "reuters", "bloomberg",
]);

// Foreign-press filter: drop Korean-language items and Korean-origin outlets so
// the dashboard stays 외신(foreign press) 중심. Applied at the single fetch choke point.
const KOREAN_SOURCE_RE = /(yonhap|korea ?herald|korea ?times|koreatimes|koreaherald|chosun|joongang|joong ?ang|donga|dong-?a|hankyung|hankyoreh|ked ?global|kedglobal|maeil|maekyung|pulse ?news|business ?korea|businesskorea|et ?news|etnews|the ?elec|thelec|zdnet ?korea|sedaily|seoul ?economic|aju ?(business|news)|korea ?economic|korea ?joongang|korea ?biz ?wire|koreabizwire|inews24|edaily|mt\.co\.kr|mk\.co\.kr|dt\.co\.kr|\.kr\b|korea ?pro|the ?korea)/i;

function isForeignItem(item) {
  if (!item || !item.title) return false;
  if (/[가-힣]/.test(item.title)) return false; // Korean-language headline
  const src = `${item.source || ""} ${item.link || ""}`.toLowerCase();
  if (KOREAN_SOURCE_RE.test(src)) return false;
  return true;
}

const health = [];
function note(step, ok, msg = "") {
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
  return res.text();
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
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
      const cells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
        .map((match) => stripHTML(match[1]))
        .filter(Boolean);
      if (cells.length < 3) continue;

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
  }

  const watchedItems = sections.flatMap((section) =>
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
      fields: row.fields,
      lastUpdate: section.lastUpdate,
      sourceUrl: section.sourceUrl,
    })),
  );

  return {
    updatedAt: new Date().toISOString(),
    source: "TrendForce Price Trends / DRAMeXchange public tables",
    sections,
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

      const point = {
        sourceUpdate: section.lastUpdate || "",
        crawledAt,
        average: row.average,
        averageRaw: row.averageRaw || "",
        changePct: row.changePct,
        changeRaw: row.changeRaw || "",
        direction: row.direction || "flat",
      };
      const last = current.points[current.points.length - 1];
      const isNewPoint =
        !last ||
        last.sourceUpdate !== point.sourceUpdate ||
        last.average !== point.average ||
        last.changeRaw !== point.changeRaw;

      if (isNewPoint) {
        current.points.push(point);
        current.points = current.points.slice(-180);
        changed = true;
      }
      history.items[key] = current;
    }
  }

  if (changed) {
    history.updatedAt = crawledAt;
    await mkdir(dirname(HISTORY_OUT), { recursive: true });
    await writeFile(HISTORY_OUT, JSON.stringify(history, null, 2) + "\n", { encoding: "utf8" });
    note("가격히스토리", true, "신규 포인트 저장");
  } else {
    note("가격히스토리", true, "변경 없음");
  }

  return history;
}

function attachPriceHistory(prices, history) {
  const attach = (row) => {
    const series = history.items[row.historyKey];
    row.history = series ? series.points.slice(-24) : [];
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
      const closes = (result.indicators?.quote?.[0]?.close || []).filter((value) => value != null);
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
    });
  }
  return items;
}

function ymd(dateStr) {
  const date = new Date(dateStr);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

async function fetchGoogleNews(query, category = "") {
  // US English edition → international outlets; Korean items dropped by isForeignItem().
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query + " when:30d")}&hl=en-US&gl=US&ceid=US:en`;
  const xml = await fetchText(url);
  return parseRSS(xml)
    .map((item) => ({
      title: item.title,
      link: item.link,
      source: item.source,
      date: ymd(item.pubDate),
      ts: new Date(item.pubDate).getTime() || 0,
      category,
    }))
    .filter(isForeignItem);
}

async function fetchCategory(cat, seen) {
  const items = [];
  for (const query of cat.queries) {
    try {
      const queryItems = await fetchGoogleNews(query, cat.id);
      for (const item of queryItems) {
        const key = item.title.replace(/\s+/g, " ").toLowerCase();
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
  note(`뉴스:${cat.label}`, items.length > 0, `${items.length}건`);
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

async function collectNews() {
  const seen = new Set();
  const categories = [];
  let all = [];

  for (const cat of CATEGORIES) {
    const items = await fetchCategory(cat, seen);
    all = all.concat(items);
    categories.push({
      id: cat.id,
      label: cat.label,
      count: items.length,
      items: items.slice(0, 12).map(({ ts, category, ...rest }) => rest),
    });
  }

  all.sort((a, b) => b.ts - a.ts);
  return {
    categories,
    news: all.slice(0, 60).map(({ ts, ...rest }) => rest),
    trending: extractTrending(all),
    newsStats: newsStats(all),
    allNews: all,
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

/* ---------- deal flow (M&A / CVC / SK hynix CorpDev, foreign press) ---------- */
async function collectDealflow() {
  const seen = new Set();
  const themes = [];
  let stream = [];

  for (const theme of DEALFLOW) {
    const items = [];
    for (const query of theme.queries) {
      try {
        const queryItems = await fetchGoogleNews(query, theme.id);
        for (const item of queryItems) {
          const key = item.title.replace(/\s+/g, " ").toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          items.push(item);
        }
      } catch (error) {
        note(`딜플로우:${theme.label}/${query}`, false, error.message);
      }
      await sleep(320);
    }
    items.sort((a, b) => b.ts - a.ts);
    themes.push({
      id: theme.id,
      label: theme.label,
      count: items.length,
      items: items.slice(0, 10).map(({ ts, category, ...rest }) => rest),
    });
    stream = stream.concat(items);
    note(`딜플로우:${theme.label}`, items.length > 0, `${items.length}건`);
  }

  stream.sort((a, b) => b.ts - a.ts);
  return {
    updatedAt: new Date().toISOString(),
    themes,
    stream: stream.slice(0, 40).map(({ ts, category, ...rest }) => ({ ...rest, theme: category || "" })),
    stats: newsStats(stream),
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
async function main() {
  const [prices, stocks, newsPayload, competitors, startups, dealflow] = await Promise.all([
    collectPrices(),
    collectStocks(),
    collectNews(),
    collectCompetitors(),
    collectStartups(),
    collectDealflow(),
  ]);
  const priceHistory = await updatePriceHistory(prices);
  attachPriceHistory(prices, priceHistory);

  const { categories, news, trending, newsStats: stats } = newsPayload;
  const signals = buildSignals({ prices, competitors, startups, newsStats: stats });
  const okCount = health.filter((item) => item.ok).length;
  console.log(`\n수집 완료: ${okCount}/${health.length} 단계 성공, 외신 뉴스 ${news.length}건, 딜플로우 ${dealflow.stream.length}건, 가격표 ${prices.sections.length}개`);

  const payload = {
    updatedAt: new Date().toISOString(),
    timezone: "Asia/Seoul",
    stocks,
    prices,
    priceHistory,
    competitors,
    startups,
    dealflow,
    signals,
    categories,
    news,
    trending,
    newsStats: stats,
    health,
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(payload, null, 2) + "\n", { encoding: "utf8" });
  console.log(`저장: ${OUT}`);
}

main().catch((error) => {
  console.error("크롤러 치명적 오류:", error);
  process.exit(1);
});
