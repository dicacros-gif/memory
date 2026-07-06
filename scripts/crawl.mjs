#!/usr/bin/env node
/**
 * SKHY memory intelligence crawler.
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
  { id: "skhynix", label: "SKHY", symbol: "000660.KS" },
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
  { id: "hbm", label: "HBM·AI Memory", queries: ["HBM4 memory AI accelerator", "high bandwidth memory HBM", "SK hynix TSMC HBM4 base die", "Samsung HBM4 1c DRAM 4nm base die", "NVIDIA Rubin HBM4 11Gbps", "CXMT HBM3 delayed mass production 2027", "CXMT HBM3 delayed 2H 2026 mass production unlikely industry sources", "ChinaTalk mapping China's HBM advancement CXMT HBM3 HBM3E", "HBM export control China December 2024 SK hynix Samsung Micron", "SK hynix Q1 2026 HBM4 Vera Rubin HBM4E 2027"] },
  { id: "dram", label: "DRAM·DDR", queries: ["DRAM DDR5 server memory price", "DRAM market demand", "CXMT DDR5 yield 80 percent Citigroup SCMP TechInsights", "CXMT DDR5 4800 product specification process node teardown estimate 16nm 17nm", "CXMT IPO 29.5 billion yuan DRAM capacity SSE revenue 61.799 billion", "Counterpoint DRAM market share Q1 2026 Samsung SK hynix Micron CXMT", "CXMT 2027 DRAM share forecast 13.9 percent", "DRAM contract price Q1 2026 90 95 TrendForce", "CXMT Tencent 20 billion yuan server DRAM supply deal Reuters"] },
  { id: "nand", label: "NAND·SSD", queries: ["NAND flash enterprise SSD price", "SSD memory demand", "YMTC Xtacking 4.0 12.66 Gb/mm2 TechInsights 512Gb", "YMTC 1Tb 294 layer 20.5 Gb/mm2 estimate", "YMTC enterprise SSD customer China", "NAND contract price China eSSD", "YMTC NAND market share 2026 HSBC Qianhai 13 percent", "NAND contract price Q2 2026 70 75 TrendForce", "YMTC homegrown NAND production line US sanctions"] },
  { id: "china_nand", label: "China NAND Business", queries: ["YMTC eSSD Xtacking customer", "YMTC Wuhan Phase 3 NAND domestic equipment", "XMC Wuhan Xinxin NAND packaging", "JCET TFME advanced packaging NAND controller", "Naura AMEC ACM Research YMTC NAND equipment", "YMTC controller firmware enterprise SSD", "China NAND subsidy server SSD procurement", "Chinese memory chips 15 percent cheaper YMTC CXMT", "China memory capacity expansion 2027 YMTC CXMT"] },
  { id: "skhynix_projection", label: "SKHY Product Projection", queries: ["SK hynix HBM4 server DRAM product mix", "SK hynix enterprise SSD Solidigm AI server storage", "SK hynix LPDDR UFS mobile memory demand", "SK hynix CXL memory module server roadmap", "SK hynix automotive memory edge AI", "memory product mix AI server terminal NAND DRAM"] },
  { id: "cxl", label: "CXL·Next Memory", queries: ["CXL memory pooling", "CXL switch memory expansion", "CXL memory tester module", "CXL 3.1 memory module CMM-D", "Pangea v3 CXL 3.2", "4F2 vertical gate 3D DRAM SK hynix"] },
  { id: "packaging", label: "Packaging·Photonics", queries: ["advanced packaging HBM hybrid bonding", "silicon photonics interconnect memory", "HBM TC bonder equipment supply chain"] },
  { id: "aidemand", label: "AI Demand", queries: ["AI memory demand data center", "AI accelerator memory bandwidth"] },
  { id: "benchmark", label: "China Benchmark", queries: ["China memory benchmark CXMT YMTC", "Chinese semiconductor equipment localization memory"] },
  { id: "china", label: "China·Geopolitics", queries: ["CXMT YMTC China memory", "China DRAM NAND export control", "CXMT revenue 2025 DRAM capacity", "YMTC Wuhan Phase 3 domestic equipment Naura AMEC", "YMTC Line 1 100000 Line 2 60000 wpm Wuhan", "BIS China memory export control VEU", "US VEU revocation SK hynix Samsung Intel China fabs annual license 2026", "MATCH Act DUV restriction cryogenic etch blanket ban removed Reuters", "HR 8170 MATCH Act House Foreign Affairs Committee 36-8 S.4281 Senate Banking", "CXMT IPO registration approved STAR Market 29.5 billion yuan", "CXMT yield engineer HBM TSV recruitment", "YMTC Xtacking eSSD engineer recruitment", "Tsinghua career CXMT YMTC semiconductor recruitment", "Nvidia H20 export controls China HBM memory demand The Diplomat"] },
  { id: "china_infra", label: "China Fab Infra", queries: ["SK hynix Wuxi fab water power land expansion", "SK hynix Wuxi K7 environmental impact assessment cleanroom expansion", "Wuxi high-tech bonded zone SK hynix land water electricity", "SK hynix Wuxi C2F additional cleanroom equipment installation", "BIS VEU SK hynix Wuxi fab capacity upgrade"] },
  { id: "china_talent_strategy", label: "China Talent Strategy", queries: ["SK hynix China hiring Wuxi Dalian Chongqing semiconductor", "China memory talent retention IP compliance semiconductor", "CXMT YMTC hiring yield TSV HBM engineer", "China enterprise SSD firmware FAE hiring memory", "Wuxi semiconductor EHS facility utilities hiring fab"] },
];

const CHINESE_CATEGORIES = [
  { id: "dram", label: "DRAM·CXMT 중국어", queries: ["长鑫存储 腾讯 DRAM 供应 合同", "长鑫存储 IPO 科创板 DRAM 产能", "长鑫存储 DDR5 LPDDR5X 量产"] },
  { id: "nand", label: "NAND·YMTC 중국어", queries: ["长江存储 武汉 三期 2026 下半年 量产", "长江存储 A股 IPO NAND 产能", "长江存储 Xtacking 企业级 SSD"] },
  { id: "equipment", label: "장비 국산화 중국어", queries: ["长江存储 长鑫存储 国产设备 扩产", "北方华创 中微公司 长江存储 长鑫存储", "半导体设备 国产化 存储 长江 长鑫"] },
  { id: "china", label: "중국 메모리 정책 중국어", queries: ["中国 存储 芯片 供应链 大基金 长江 长鑫", "两存 扩产 半导体 存储 IPO", "长鑫 长江 存储 超级周期"] },
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
    baseline: "NAND 공급 조절, SSD 계약가, 일본·미국 자본 지출 동향이 하이닉스 NAND 전략에 직접 영향.",
    queries: ["Kioxia Western Digital NAND SSD IPO"],
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
  { id: "capacity", label: "China Capacity", queries: ["CXMT capacity DRAM wafer China", "YMTC NAND capacity Xtacking China", "CXMT Shanghai fab DRAM wafer start", "CXMT IPO proceeds wafer capacity", "YMTC Wuhan Phase 3 50000 wafers", "YMTC Line 1 100000 Line 2 60000 wafers per month", "Counterpoint CXMT 11 percent DRAM market share Q1 2026", "CXMT 300000 wafers per month 2026 600000 target", "China memory capacity expansion 120000 140000 wafers 2026"] },
  { id: "china_nand_business", label: "China NAND Business", queries: ["YMTC eSSD customer NAND China", "YMTC Xtacking 4.0 enterprise SSD", "XMC Wuhan Xinxin NAND packaging", "JCET TFME NAND controller advanced packaging", "Naura AMEC ACM YMTC NAND equipment", "China server SSD procurement YMTC", "YMTC NAND share 13 percent 2026", "Chinese memory chips price advantage 15 percent"] },
  { id: "skhynix_product_projection", label: "SKHY Product Projection", queries: ["SK hynix HBM4 DDR5 CXL server roadmap", "SK hynix Solidigm enterprise SSD AI server demand", "SK hynix LPDDR UFS client SSD product mix", "memory AI server product mix projection DRAM NAND HBM", "automotive edge AI memory SK hynix"] },
  { id: "equipment", label: "Equipment Localization", queries: ["China semiconductor equipment localization NAURA Technology Group AMEC", "Chinese chip equipment localization memory", "China semiconductor equipment localization rate paid research source verification", "MATCH Act DUV lithography cryogenic etching China removed blanket ban", "YMTC homegrown NAND production line NAURA AMEC ACM", "Naura Qomola HPD30 hybrid bonding SEMICON China 2026", "ACM Research IR first quarter 2026 results revenue 231.263 shipments 240.7", "ACM Research Entity List 2025 China revenue concentration"] },
  { id: "china_infra", label: "China Fab Infrastructure", queries: ["SK hynix Wuxi K7 plot water power fab expansion", "SK hynix Wuxi environmental impact assessment wastewater reuse", "Wuxi bonded zone SK hynix comprehensive bonded zone expansion", "BIS VEU SK hynix China fab capacity upgrade", "Wuxi semiconductor fab water electricity land use"] },
  { id: "china_talent_strategy", label: "China Talent Strategy", queries: ["SK hynix China workforce strategy Wuxi Dalian Chongqing", "China memory hiring strategy IP retention compliance", "CXMT YMTC Boss Zhipin yield engineer hiring", "China semiconductor campus recruiting Tsinghua memory engineer", "China fab EHS facility water power engineer hiring"] },
  { id: "packaging", label: "Advanced Packaging", queries: ["JCET advanced packaging AI memory", "XMC HBM packaging China", "HBM TC bonder patent equipment"] },
  { id: "cxl", label: "CXL and PIM Value Chain", queries: ["CXL memory tester Exicon Neosem", "CXL controller IP memory pooling PIM", "CXL 3.1 module substrate TLB", "Openedges CXL controller IP", "FADU CXL memory controller"] },
  { id: "talent", label: "Talent and IP Signals", queries: ["China semiconductor talent hiring memory", "CXMT engineer hiring DRAM", "CXMT TSV yield engineer recruitment", "YMTC Xtacking eSSD engineer recruitment", "ijiwei CXMT YMTC recruitment engineer", "Tsinghua career CXMT YMTC semiconductor recruitment", "Boss Zhipin CXMT YMTC yield engineer", "Liepin CXMT YMTC semiconductor engineer", "Maimai CXMT YMTC memory engineer", "CNIPA CXMT YMTC HBM TSV patent", "China memory IP litigation Korean engineer CXMT YMTC"] },
];

const CHINA_INFRA_SOURCE_PAGES = [
  {
    id: "wuxi-k7-eia",
    site: "wuxi",
    label: "Wuxi K7 EIA",
    url: "https://www.wnd.gov.cn/doc/2017/02/28/2386281.shtml",
    markers: ["K7", "现有厂区", "CleanRoom", "121K", "废水", "中水回用", "MBR", "新城污水处理厂"],
  },
  {
    id: "wuxi-bonded-zone",
    site: "wuxi",
    label: "Wuxi bonded zone expansion",
    url: "https://en.wuxi.gov.cn/2025-07/31/c_1113622.htm",
    markers: ["3.49 square kilometers", "SK hynix", "1.11 square kilometers", "$10 billion"],
  },
  {
    id: "skhynix-china-offices",
    site: "all",
    label: "SKHY China offices",
    url: "https://www.skhynix.com/company/UI-FR-CP06/",
    markers: ["Wuxi", "Chongqing", "Dalian"],
  },
  {
    id: "bis-veu",
    site: "all",
    label: "BIS VEU China fabs",
    url: "https://www.bis.gov/press-release/department-commerce-closes-export-controls-loophole-foreign-owned-semiconductor-fabs-china",
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
  /(reuters|bloomberg|financial times|ft\.com|nikkei|cnbc|trendforce|dramexchange|techinsights|yole|counterpoint|tom'?s hardware|tomshardware|south china morning post|scmp|digitimes|ee times|eetimes|semianalysis|techwire asia|the register|business insider|network world|evertiq|technode|techspot|japan times|electronics weekly|businesswire|pr newswire|solidigm|intel|u\.s\. bis|bis\.gov|wsts|acm research ir|cxmt|shanghai stock exchange)/i;
const AUTHORITATIVE_CN_NEWS_RE =
  /(财新|caixin|第一财经|yicai|21财经|21世纪经济报道|证券时报|stcn|中国经营报|cb\.com\.cn|新浪财经|新浪科技|finance\.sina|电子工程专辑|eet-china|集微网|ijiwei|经济观察网|eeo\.com\.cn|techweb|chinaflashmarket)/i;

// Hangul / Hangul Jamo / kana / CJK / surrogate / specials. Stripped from
// titles so a Latin headline stays clean even if a multibyte char mis-decoded,
// and a genuinely Korean/CJK headline collapses to a short fragment we drop.
const NON_LATIN_RE = /[ᄀ-ᇿ　-ヿ㐀-䶿一-鿿가-힣\uD800-\uDFFF豈-﫿￹-￿]/g;
const CJK_RE = /[一-鿿]/;

function cleanTitle(value) {
  return String(value || "")
    .replace(NON_LATIN_RE, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function cleanLocalizedTitle(value, locale = "en") {
  if (locale === "zh") return stripHTML(value).replace(/\s{2,}/g, " ").trim();
  return cleanTitle(value);
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
  if (titleKey) return `title:${titleKey}|${publisherText(item).toLowerCase().trim()}`;
  const url = String(item.link || item.sourceUrl || "").trim();
  if (url && !/news\.google\.com\/(?:rss\/)?articles/i.test(url)) {
    try {
      const parsed = new URL(url);
      parsed.hash = "";
      for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
        parsed.searchParams.delete(key);
      }
      return `url:${parsed.toString().replace(/\/$/, "").toLowerCase()}`;
    } catch {
      return `url:${url.replace(/#.*$/, "").replace(/\/$/, "").toLowerCase()}`;
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
  // After cleanTitle, a real Korean/CJK headline collapses to a tiny Latin
  // fragment - drop those, and drop Korean-origin outlets. Keeps a clean
  // Latin-script international (foreign-press) feed.
  if (item.language === "chinese") {
    if (!CJK_RE.test(item.title)) return false;
  } else if (item.title.replace(/[^A-Za-z]/g, "").length < 6) {
    return false;
  }
  const src = `${item.source || ""} ${item.title || ""} ${item.link || ""}`.toLowerCase();
  if (KOREAN_SOURCE_RE.test(src)) return false;
  if (SKHYNIX_NEWSROOM_RE.test(src)) return false;
  if (EXCLUDED_NEWS_RE.test(`${item.title || ""} ${item.source || ""} ${item.link || ""}`)) return false;
  if (LOW_CONFIDENCE_NEWS_RE.test(`${item.title || ""} ${item.source || ""} ${item.link || ""}`)) return false;
  const authority = `${publisherText(item)} ${item.link || ""}`;
  if (item.language === "chinese") return AUTHORITATIVE_CN_NEWS_RE.test(authority);
  return AUTHORITATIVE_EN_NEWS_RE.test(authority);
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
      link: item.link,
      source: cleanLocalizedTitle(item.source, locale),
      date: ymd(item.pubDate),
      ts: new Date(item.pubDate).getTime() || 0,
      category,
      language: isChinese ? "chinese" : "english",
    }))
    .filter(isForeignItem);
}

/* ---------- best-effort EN->KO headline translation (no API key) ---------- */
let _trCount = 0;
const TR_CAP = 150;

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
    if (ko && ko !== item.title) item.titleKo = ko;
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
    console.log(`- 뉴스:${cat.label} 0건 → 카테고리 제외`);
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
    if (!items.length) continue;
    categories.push({
      id: cat.id,
      label: cat.label,
      count: items.length,
      items: items.slice(0, 12).map(({ ts, category, ...rest }) => rest),
    });
  }

  for (const cat of CHINESE_CATEGORIES) {
    const items = await fetchCategory(cat, seen, "zh");
    all = all.concat(items);
    if (!items.length) continue;
    const existing = categories.find((entry) => entry.id === cat.id);
    if (existing) {
      existing.count += items.length;
      existing.items = existing.items.concat(items.slice(0, 8).map(({ ts, category, ...rest }) => rest)).slice(0, 12);
    } else {
      categories.push({
        id: cat.id,
        label: cat.label,
        count: items.length,
        items: items.slice(0, 12).map(({ ts, category, ...rest }) => rest),
      });
    }
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
      console.log(`- 벤치마킹:${theme.label} 0건 → 테마 제외`);
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
        ok: true,
        markerHits: hitCount,
        markers,
        excerpt: text.slice(0, 360),
        crawledAt: new Date().toISOString(),
      });
      note(`중국Fab인프라:${source.label}`, hitCount > 0, `${hitCount}/${markers.length} markers`);
    } catch (error) {
      sources.push({
        id: source.id,
        site: source.site,
        label: source.label,
        url: source.url,
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
async function main() {
  const [prices, stocks, newsPayload, competitors, startups, benchmarkSignals, chinaInfra] = await Promise.all([
    collectPrices(),
    collectStocks(),
    collectNews(),
    collectCompetitors(),
    collectStartups(),
    collectBenchmarkSignals(),
    collectChinaInfra(),
  ]);
  const priceHistory = await updatePriceHistory(prices);
  attachPriceHistory(prices, priceHistory);

  const { categories, news, trending, newsStats: stats } = newsPayload;

  // Best-effort Korean headlines (no API key; English fallback on any failure).
  try {
    await addKoTitles(news, 42);
    await addKoTitles(benchmarkSignals.stream, 24);
    for (const competitor of competitors.competitors) await addKoTitles(competitor.recentNews, 2);
    for (const startup of startups.candidates) await addKoTitles(startup.recentNews, 2);
    note("번역:KO", true, `${_trCount}건`);
  } catch (error) {
    note("번역:KO", false, error.message);
  }

  const signals = buildSignals({ prices, competitors, startups, newsStats: stats });
  const okCount = health.filter((item) => item.ok).length;
  console.log(`\n수집 완료: ${okCount}/${health.length} 단계 성공, 외신 뉴스 ${news.length}건, 벤치마킹 신호 ${benchmarkSignals.stream.length}건, 가격표 ${prices.sections.length}개`);

  const payload = {
    updatedAt: new Date().toISOString(),
    timezone: "Asia/Seoul",
    stocks,
    prices,
    priceHistory,
    competitors,
    startups,
    benchmarkSignals,
    chinaInfra,
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
