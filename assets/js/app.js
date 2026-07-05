(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const el = (tag, cls, html) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html != null) node.innerHTML = html;
    return node;
  };

  const emptyLive = {
    updatedAt: null,
    timezone: "Asia/Seoul",
    prices: { sections: [], watchedItems: [] },
    news: [],
    categories: [],
    benchmarkSignals: { stream: [] },
    newsStats: {},
    health: [],
  };
  const emptyHistory = {
    updatedAt: null,
    timezone: "Asia/Seoul",
    items: {},
  };

  const KOREAN_SOURCE_RE =
    /(yonhap|korea ?herald|korea ?times|koreatimes|koreaherald|chosun|joongang|joong ?ang|donga|dong-?a|hankyung|hankyoreh|ked ?global|kedglobal|maeil|maekyung|pulse ?news|business ?korea|businesskorea|et ?news|etnews|the ?elec|thelec|zdnet ?korea|sedaily|seoul ?economic|aju ?(business|news|press)|korea ?economic|korea ?joongang|korea ?biz ?wire|koreabizwire|inews24|edaily|mt\.co\.kr|mk\.co\.kr|dt\.co\.kr|\.kr\b|korea ?pro|the ?korea|naver|daum|fnnews|newspim|moneytoday|heraldcorp)/i;
  const MEMORY_NEWS_RE =
    /(memory|dram|nand|hbm|ddr|lpddr|gddr|ssd|semiconductor|chip|wafer|foundry|packaging|interconnect|cxl|trendforce|dramexchange|micron|samsung|sk hynix|hynix|kioxia|western digital|sandisk|cxmt|changxin|ymtc|yangtze|jcet|tfme|xmc|wuhan xinxin|naura|amec|acm research|techinsights|yole|big fund|export control|china chip|chinese chip)/i;
  const CHINA_NEWS_RE =
    /(china|chinese|cxmt|changxin|ymtc|yangtze|jcet|tfme|xmc|wuhan|naura|amec|huawei|tencent|alibaba|baidu|lenovo|big fund|36kr|pandaily|caixin|yicai|scmp|kraneshares|sina|sohu|eastmoney|huxiu|jiwei|c114|digitimes asia)/i;
  const APPLE_CONTENT_RE =
    /\b(apple|applem|aapl|iphone|ipad|macbook|9to5mac|applemagazine)\b|애플|아이폰|아이패드|맥북/i;
  const SOURCE_SUFFIX_RE = /\s[-–—]\s(?:[A-Za-z0-9가-힣 .·&]+)$/;
  const HIDDEN_SECTIONS = new Set(["corpdev"]);
  const HIDDEN_CATEGORY_IDS = new Set(["corpdev"]);
  const COMPANY_NEWS_ALIASES = {
    cxmt: ["cxmt", "changxin", "changxin memory", "changxin memory technologies"],
    ymtc: ["ymtc", "yangtze memory", "yangtze memory technologies", "yangtze"],
    jcet: ["jcet", "tfme", "tongfu", "huatian", "osat", "xdf oi", "xdfoi"],
    xmc: ["xmc", "wuhan xinxin", "xinxin semiconductor"],
    naura: ["naura", "north micro", "naura technology", "북방화창"],
    amec: ["amec", "advanced micro-fabrication", "중웨이", "중웨이반도체"],
    acm: ["acm research", "acmrcsh", "acm", "盛美"],
    materials: ["shanghai sinyang", "sinyang", "anji", "anji technology", "anjimicro", "상하이신양", "안지과기"],
  };
  const CATEGORY_INSIGHTS = {
    hbm: "HBM 인증·수율·고객 승인 속도를 삼성·마이크론과 비교",
    dram: "DDR5·LPDDR·범용 DRAM 가격과 고객 인증 변화 추적",
    nand: "YMTC·eSSD·NAND 계약가 회복 사이클과 공급 압력 비교",
    cxl: "CXL 메모리 풀링·컨트롤러·스위치 생태계 진입 타이밍 관찰",
    packaging: "HBM 적층·하이브리드 본딩·OSAT 우회로와 장비 병목 점검",
    aidemand: "AI 서버·가속기 수요가 메모리 믹스와 가격에 주는 영향 확인",
    china: "중국 내수 고객·정책·공급망 내재화 신호를 경쟁사별로 추적",
    equipment: "Naura·AMEC·ACM 등 장비 국산화와 공정 recipe 흡수 속도 관찰",
    geopolitics: "수출통제·허가 예외·중국 자본 투입이 공급망을 바꾸는지 점검",
    talent: "핵심 엔지니어 이동·채용 JD·IP 신호가 기술 격차를 줄이는지 확인",
    operations: "SK하이닉스 중국 운영, 다롄/Solidigm, VEU 규제 리스크를 별도 점검",
  };
  const CATEGORY_ACCENTS = {
    all: "#4322A8",
    dram: "#7A38D6",
    nand: "#1428A0",
    packaging: "#0E8F6E",
    equipment: "#0A6E63",
    talent: "#C026D3",
    geopolitics: "#2D6BFF",
    hbm: "#7A38D6",
    cxl: "#0891B2",
    aidemand: "#16A34A",
    china: "#1428A0",
    operations: "#475569",
  };
  const COLOR_PRESETS = [
    { name: "Violet", sidebar: "#4322A8", sidebarHi: "#6145B6", sidebarLow: "#24125B", accent: "#4322A8", blue: "#1428A0", teal: "#0A9D8E", purple: "#7A38D6", green: "#0E8A50" },
    { name: "Navy", sidebar: "#0B1F4D", sidebarHi: "#173B84", sidebarLow: "#071229", accent: "#0F62FE", blue: "#1428A0", teal: "#0A9D8E", purple: "#9333EA", green: "#0E8A50" },
    { name: "Cobalt", sidebar: "#1428A0", sidebarHi: "#2D6BFF", sidebarLow: "#07145F", accent: "#2D6BFF", blue: "#1428A0", teal: "#0891B2", purple: "#C026D3", green: "#16A34A" },
    { name: "Teal", sidebar: "#0A6E63", sidebarHi: "#0A9D8E", sidebarLow: "#06413C", accent: "#0A9D8E", blue: "#1668E3", teal: "#0A9D8E", purple: "#6D28D9", green: "#0E8A50" },
    { name: "Graphite", sidebar: "#10131C", sidebarHi: "#2B3144", sidebarLow: "#070A12", accent: "#7A38D6", blue: "#2D6BFF", teal: "#0A9D8E", purple: "#7A38D6", green: "#16A34A" },
  ];
  const NAV_ACCENTS = {
    overview: "#FFFFFF",
    "executive-decision": "#FDE68A",
    "management-strategy": "#A7F3D0",
    "strategic-investment-decision": "#FBCFE8",
    "daily-review": "#A7F3D0",
    numbers: "#FDE68A",
    projection: "#FBBF24",
    workbench: "#B9A7FF",
    "ai-matrix": "#C4B5FD",
    crawler: "#7EE7C8",
    prices: "#FFD166",
    news: "#93C5FD",
    "china-nand": "#66D9E8",
    "china-dynamics": "#7DD3FC",
    "talent-radar": "#F0ABFC",
    "china-deep-dive": "#86EFAC",
    categories: "#C4B5FD",
    competitors: "#F0ABFC",
    dynamics: "#FDBA74",
    monetization: "#A7F3D0",
    response: "#FCA5A5",
    intelligence: "#BAE6FD",
  };
  const CHINA_DYNAMIC_AXES = [
    {
      id: "capacity",
      title: "캐파·내수 고객 재편",
      label: "캐파/고객",
      theme: "capacity",
      categoryIds: ["china", "dram", "aidemand"],
      keywords: ["cxmt", "smic", "xmc", "capacity", "fab", "huawei", "tencent", "alibaba", "baidu"],
      pulse: "CXMT·SMIC·XMC 증설과 중국 빅테크 조달이 메모리 수요의 내부 순환을 키우는지 추적",
      watch: ["월별 캐파 증설", "내수 AI 고객 인증", "장기 공급 계약", "팹 가동률"],
    },
    {
      id: "equipment",
      title: "장비 국산화·공정 병목",
      label: "장비",
      theme: "equipment",
      categoryIds: ["equipment", "geopolitics"],
      keywords: ["naura", "amec", "acm", "equipment", "localization", "etch", "deposition", "cmp"],
      pulse: "EUV 제약을 식각·증착·세정·CMP 국산화로 얼마나 우회하는지 보는 공급망 회복력 축",
      watch: ["국산 장비 qual", "recipe 이전", "수출통제 노출", "소재·부품 병목"],
    },
    {
      id: "packaging",
      title: "첨단 패키징 우회로",
      label: "패키징",
      theme: "packaging",
      categoryIds: ["packaging", "hbm"],
      keywords: ["jcet", "tfme", "xmc", "packaging", "hbm", "hybrid bonding", "cpo", "chiplet"],
      pulse: "선단 노광 격차를 OSAT·XMC·CPO·hybrid bonding으로 보완하는 중국 AI 패키징 생태계",
      watch: ["HBM 조립 우회", "CPO·실리콘 브리지", "fan-out/RDL", "열·테스트 병목"],
    },
    {
      id: "talent",
      title: "인재·IP·수율 레시피",
      label: "인재/IP",
      theme: "talent",
      categoryIds: ["talent", "packaging"],
      keywords: ["talent", "hiring", "engineer", "ip", "yield", "tsv", "hybrid bonding", "xtacking", "campus recruiting", "tsinghua", "boss zhipin", "ymtc careers", "cxmt careers"],
      pulse: "공식 채용·로컬 JD·대학 파이프라인·전문 매체/IP 신호로 수율 엔지니어 이동과 공정 노하우 유출 가능성을 조기 감지",
      watch: ["TSV/HBM JD 증가", "CXMT/YMTC 공식 채용", "칭화대 캠퍼스 리크루팅", "수율 엔지니어 이동", "IP 분쟁"],
    },
    {
      id: "policy",
      title: "정책 자본·수출통제 반작용",
      label: "정책",
      theme: "capacity",
      categoryIds: ["china", "geopolitics"],
      keywords: ["export control", "sanction", "big fund", "stride", "china", "entity list", "license"],
      pulse: "수출통제가 중국 빅펀드·지방정부 자본 투입과 내재화 속도를 오히려 높이는지 관찰",
      watch: ["Big Fund III", "Entity List", "허가 예외", "지방정부 보조금"],
    },
  ];
  const CHINA_NAND_BUSINESS_LAYERS = [
    {
      id: "ymtc",
      label: "YMTC",
      role: "NAND·eSSD 공격수",
      title: "Xtacking 4.0 기반 중국 NAND 자립 전략",
      score: 92,
      linkedCategories: ["nand", "packaging", "equipment"],
      keywords: ["ymtc", "yangtze", "xtacking", "essd", "wuhan phase 3", "nand", "flash"],
      metrics: [
        { label: "NAND 점유율", value: "13%" },
        { label: "셀 밀도", value: "20.5Gb/mm²" },
        { label: "제품 축", value: "eSSD" },
      ],
      strategy: [
        "Xtacking으로 셀 어레이와 로직 웨이퍼를 분리해 미세화 제약을 우회",
        "중국 서버·스마트폰 고객을 묶어 eSSD와 고용량 NAND 내수 수요를 흡수",
        "우한 Phase 3에서 국산 장비와 패키징/테스트를 결합해 자급형 IDM으로 이동",
      ],
      crawl: ["YMTC Xtacking 4.0", "enterprise SSD customer", "Wuhan Phase 3", "domestic NAND equipment", "controller firmware"],
      decisions: ["NAND contract price 하방 압력", "Solidigm/eSSD 고객 방어", "Xtacking 세대별 밀도·수율 검증", "국산 장비 qual 속도"],
      risk: "수율 안정화가 확인되면 가격 경쟁이 아니라 기업용 SSD 고객 침투가 핵심 위협으로 바뀝니다.",
    },
    {
      id: "xmc",
      label: "XMC",
      role: "패키징·우한 생태계",
      title: "YMTC와 연결된 패키징·테스트 우회로",
      score: 84,
      linkedCategories: ["nand", "packaging", "china"],
      keywords: ["xmc", "wuhan xinxin", "xinxin", "packaging", "hbm", "nand", "wuhan"],
      metrics: [
        { label: "역할", value: "패키징/테스트" },
        { label: "거점", value: "우한" },
        { label: "감시", value: "HBM/NAND" },
      ],
      strategy: [
        "NAND·DRAM 다이를 후공정으로 묶어 선단 공정 격차를 일부 보완",
        "우한 지방정부 투자와 YMTC 생태계를 결합해 장비·패키징 클러스터를 형성",
        "HBM 조립 보도는 과장 가능성을 분리하고, 실제 장비 반입·테스트 캐파를 확인",
      ],
      crawl: ["XMC HBM packaging", "Wuhan Xinxin investment", "advanced packaging equipment", "NAND package test"],
      decisions: ["후공정 병목/캐파", "패키징 소재·장비 소싱", "우한 클러스터 투자", "XMC/YMTC 협력 범위"],
      risk: "패키징 우회로가 안정되면 NAND/eSSD와 AI 메모리 모두에서 중국 공급망 자립도가 높아집니다.",
    },
    {
      id: "jcet",
      label: "JCET·TFME",
      role: "OSAT 상용화 축",
      title: "XDFOI·fan-out 기반 첨단 패키징 확대",
      score: 79,
      linkedCategories: ["packaging", "nand", "hbm"],
      keywords: ["jcet", "tfme", "tongfu", "huatian", "xdf oi", "xdfoi", "fan-out", "advanced packaging"],
      metrics: [
        { label: "플랫폼", value: "XDFOI" },
        { label: "역할", value: "OSAT" },
        { label: "초점", value: "AI/NAND" },
      ],
      strategy: [
        "실리콘 브리지·fan-out·RDL로 CoWoS 의존도를 낮추는 중국형 패키징 옵션을 확장",
        "NAND 컨트롤러, eSSD, AI 가속기 후공정까지 묶어 공급망 협상력을 확보",
        "수율·열·테스트 병목은 실제 양산 규모와 고객 인증으로 검증",
      ],
      crawl: ["JCET XDFOI", "Tongfu advanced packaging", "fan-out RDL China", "OSAT AI memory"],
      decisions: ["패키징 대체 가능성", "테스트 병목", "소재/기판 수요", "고객 인증 뉴스"],
      risk: "OSAT가 고객 인증을 확보하면 중국 업체는 선단 노광 약점을 후공정으로 보완할 수 있습니다.",
    },
    {
      id: "equipment",
      label: "Naura·AMEC·ACM",
      role: "장비 내재화",
      title: "NAND 공정 장비 국산화와 recipe 흡수",
      score: 86,
      linkedCategories: ["equipment", "nand", "geopolitics"],
      keywords: ["naura", "amec", "acm research", "equipment localization", "etch", "deposition", "cleaning", "cmp"],
      metrics: [
        { label: "축", value: "식각/증착/세정" },
        { label: "감시", value: "tool qual" },
        { label: "리스크", value: "recipe" },
      ],
      strategy: [
        "EUV가 아닌 식각·증착·세정·CMP 내재화로 NAND 공정 안정성을 끌어올림",
        "국산 장비 qual과 YMTC Phase 3 램프업이 함께 나오면 공급량 확대 가능성이 상승",
        "한국 소부장에는 JV·공동개발·레시피 이전 압력이 커질 수 있음",
      ],
      crawl: ["Naura NAND equipment", "AMEC etch YMTC", "ACM cleaning China memory", "domestic equipment qualification"],
      decisions: ["국산 장비 승인 속도", "소재·부품 병목", "한국 소부장 노출", "수출통제 반작용"],
      risk: "장비 국산화가 품질 기준을 넘으면 중국 NAND 캐파는 규제보다 내부 공급망 속도에 좌우됩니다.",
    },
    {
      id: "cxmt",
      label: "CXMT",
      role: "DRAM 가격 압력",
      title: "DRAM 물량 공세가 NAND 수익성에 주는 간접 압력",
      score: 74,
      linkedCategories: ["dram", "nand", "china"],
      keywords: ["cxmt", "changxin", "dram", "ddr5", "lpddr5x", "ipo", "capacity"],
      metrics: [
        { label: "제품", value: "DDR5/LPDDR" },
        { label: "자본", value: "IPO" },
        { label: "압력", value: "Legacy ASP" },
      ],
      strategy: [
        "DDR5·LPDDR 물량과 중국 빅테크 장기계약으로 범용 메모리 가격 협상력을 확대",
        "NAND 직접 경쟁사는 아니지만 메모리 업황 전반의 ASP와 고객 협상력을 흔듦",
        "HBM 위협보다 레거시 가격 하방과 캐파 증설 속도가 우선 감시 대상",
      ],
      crawl: ["CXMT IPO capacity", "CXMT DDR5 customer", "China DRAM contract", "Tencent supply agreement"],
      decisions: ["DRAM/NAND 가격 전이", "고객 협상력", "범용 제품 원가 방어", "중국 내수 보조금"],
      risk: "DRAM 가격 하방이 NAND 믹스 개선 효과를 상쇄할 수 있어 메모리 포트폴리오 단위로 봐야 합니다.",
    },
    {
      id: "policy",
      label: "정책자본·규제",
      role: "자본/수출통제",
      title: "빅펀드와 수출통제 반작용",
      score: 81,
      linkedCategories: ["geopolitics", "nand", "equipment"],
      keywords: ["big fund", "export control", "bis", "entity list", "match act", "license", "sanction"],
      metrics: [
        { label: "자본", value: "Big Fund" },
        { label: "규제", value: "BIS" },
        { label: "효과", value: "내재화" },
      ],
      strategy: [
        "제재는 단기 장비 조달을 막지만 장기적으로 내재화 투자와 대체 공급망 형성을 촉진",
        "BIS/VEU, Entity List, MATCH Act, 네덜란드·일본 동참 여부를 YMTC 증설과 같이 추적",
        "정책자본은 NAND 가격 경쟁과 장비 국산화의 자금원으로 연결",
      ],
      crawl: ["BIS China memory export control", "MATCH Act DUV China", "Big Fund III NAND", "Entity List YMTC"],
      decisions: ["규제 이벤트 캘린더", "캐파 지연/가속", "소부장 매출 노출", "중국 내수 조달 전환"],
      risk: "규제가 강해질수록 중국은 글로벌 공급망과 다른 조달 체계를 고착화할 가능성이 큽니다.",
    },
  ];
  const NAND_BUSINESS_WORKFLOWS = [
    {
      label: "기회 발굴",
      desc: "YMTC eSSD, XMC 패키징, 장비 국산화, 채용 JD를 연결해 사업·투자·제휴 후보군을 도출",
      output: "테마 후보",
      linkedCategories: ["nand", "packaging", "equipment"],
    },
    {
      label: "전략 수립",
      desc: "NAND 가격, 고객 인증, 캐파, 수출통제 이벤트를 묶어 방어/공격/옵션 전략으로 구분",
      output: "전략 맵",
      linkedCategories: ["nand", "geopolitics"],
    },
    {
      label: "포트폴리오 점검",
      desc: "Solidigm·eSSD·범용 NAND·HBM 자본 배분을 같이 보며 중복과 공백을 점검",
      output: "Value-up 과제",
      linkedCategories: ["nand", "operations"],
    },
    {
      label: "제휴·계약 구조",
      desc: "장기 공급계약, 장비/소재 제휴, 소수지분 투자, 공동개발 옵션을 리스크별로 구분",
      output: "구조안",
      linkedCategories: ["nand", "equipment", "packaging"],
    },
    {
      label: "실사·모델링",
      desc: "기술 성숙도, 수율, 고객 PoC, IP, 규제 노출, EV/Revenue·DCF·시너지 민감도를 확인",
      output: "의사결정 메모",
      linkedCategories: ["nand", "talent", "geopolitics"],
    },
    {
      label: "수익성·리스크",
      desc: "NAND contract/spot 가격, eSSD 믹스, 중국 보조금 물량, IP/인재 방어 비용을 지표화",
      output: "리스크 스코어",
      linkedCategories: ["nand", "dram", "talent"],
    },
  ];
  const PROJECTION_START_MONTHS = 30;
  const PROJECTION_YEAR_COUNT = 5;
  const PROJECTION_SCENARIOS = [
    {
      id: "neutral",
      label: "중립",
      sub: "Base case",
      tone: "현재 크롤링 가격·뉴스·중국 벤치마크 신호를 그대로 반영한 기준 케이스",
      scoreBias: 0,
      serverLift: 0,
      storageLift: 0,
      terminalLift: 0,
      legacyLift: 0,
      riskLabel: "기준",
    },
    {
      id: "best",
      label: "Best",
      sub: "Upside case",
      tone: "HBM·서버 DRAM·eSSD 수요가 강하고 중국 범용 가격 압력이 완화되는 상방 케이스",
      scoreBias: 8,
      serverLift: 4.6,
      storageLift: 2.5,
      terminalLift: -1.3,
      legacyLift: -2.2,
      riskLabel: "상방",
    },
    {
      id: "worst",
      label: "Worst",
      sub: "Downside case",
      tone: "HBM4 인증 지연, 중국 캐파 확대, 범용 DRAM/NAND 가격 하방을 크게 반영한 방어 케이스",
      scoreBias: -10,
      serverLift: -4.8,
      storageLift: -3.0,
      terminalLift: 3.4,
      legacyLift: 3.8,
      riskLabel: "하방",
    },
  ];
  const SKHYNIX_PRODUCT_PROJECTION = [
    {
      id: "ai-server",
      label: "AI 서버향",
      short: "AI 서버",
      demand: "Server",
      title: "HBM·DDR5·CXL 중심 프리미엄 서버 포트폴리오",
      startShare: 48,
      endShare: 58,
      baseScore: 91,
      sensitivity: 1.18,
      linkedCategories: ["hbm", "dram", "cxl", "aidemand", "packaging"],
      products: ["HBM3E/HBM4", "DDR5 RDIMM/MRDIMM", "CXL Memory", "Custom HBM"],
      keywords: ["hbm", "hbm4", "hbm3e", "nvidia", "rubin", "ai accelerator", "data center", "server", "cxl", "ddr5", "rdimm", "mrdimm", "tsmc", "cowos"],
      priceTerms: ["dram", "ddr5", "gddr", "module"],
      thesis: "AI 서버는 30개월 뒤에도 SK하이닉스 제품 믹스의 최우선 축입니다. HBM4 베이스 다이, DDR5 고용량 모듈, CXL 확장 메모리가 함께 서버 ASP를 방어합니다.",
      assumptions: ["HBM4/Custom HBM 고객 인증 유지", "NVIDIA·ASIC 고객의 대역폭 요구 지속", "DDR5 고용량 모듈과 CXL이 서버당 메모리 탑재량 확대"],
      triggers: ["HBM4 Rubin 인증", "CoWoS/패키징 할당량", "DDR5 contract 가격", "CXL 서버 PoC"],
      actions: ["HBM 고객 락인", "서버 DRAM 원가·수율 개선", "CXL 컨트롤러/IP 옵션 확보"],
      risk: "HBM4 속도 요구 상향과 패키징 병목이 양산 일정을 밀면 서버향 비중은 높아져도 매출 인식이 늦어질 수 있습니다.",
    },
    {
      id: "dc-storage",
      label: "데이터센터 스토리지향",
      short: "eSSD",
      demand: "Server",
      title: "eSSD·QLC·Solidigm 기반 서버 스토리지 포트폴리오",
      startShare: 21,
      endShare: 22,
      baseScore: 78,
      sensitivity: 1.05,
      linkedCategories: ["nand", "aidemand", "operations", "china"],
      products: ["Enterprise SSD", "QLC NAND", "Solidigm", "PCIe Gen5/Gen6 SSD"],
      keywords: ["essd", "enterprise ssd", "solidigm", "qlc", "nand", "data center ssd", "server ssd", "pcie", "storage"],
      priceTerms: ["nand", "ssd", "wafer", "flash"],
      thesis: "AI 서버 증설은 스토리지 계층에도 연결됩니다. eSSD와 QLC는 NAND 수익성 방어 축이지만 YMTC의 내수 eSSD 침투와 계약가 변동을 같이 봐야 합니다.",
      assumptions: ["AI 학습/추론 데이터셋 증가", "엔터프라이즈 SSD 계약가 회복", "Solidigm 제품 믹스 개선"],
      triggers: ["NAND contract 가격", "YMTC eSSD 고객 뉴스", "서버 SSD 조달/인증", "QLC 제품 전환"],
      actions: ["eSSD 고객 방어", "QLC 원가 로드맵", "중국 내수 SSD 침투율 조기경보"],
      risk: "YMTC가 eSSD 고객 인증과 내수 보조금을 동시에 확보하면 가격보다 고객 침투 속도가 더 큰 변수입니다.",
    },
    {
      id: "mobile-pc",
      label: "모바일·PC 단말향",
      short: "단말",
      demand: "Terminal",
      title: "LPDDR·UFS·Client SSD 중심 단말 포트폴리오",
      startShare: 21,
      endShare: 12,
      baseScore: 61,
      sensitivity: .82,
      linkedCategories: ["dram", "nand", "china"],
      products: ["LPDDR5X/LPDDR6", "UFS", "Client SSD", "Mobile NAND"],
      keywords: ["lpddr", "lpddr5x", "lpddr6", "ufs", "client ssd", "pc ssd", "smartphone", "mobile", "pc", "notebook", "terminal"],
      priceTerms: ["nand", "ssd", "module", "dram", "lpddr"],
      thesis: "단말향은 절대 수요가 남아 있지만, AI 서버 우선 투자와 중국 범용 메모리 물량 공세로 비중이 낮아지는 방어형 축입니다.",
      assumptions: ["스마트폰/PC 교체 수요는 완만", "LPDDR·UFS는 원가 경쟁 압력 확대", "서버향 캐파 우선 배분 지속"],
      triggers: ["LPDDR5X/6 고객 인증", "client SSD contract 가격", "CXMT DDR5/LPDDR 뉴스", "YMTC 모바일 NAND 공급"],
      actions: ["고부가 모바일 제품 선별", "범용 단말 제품 cash-cost floor 관리", "중국 가격 하방에 대한 빠른 믹스 조정"],
      risk: "CXMT와 YMTC의 범용 제품 공급이 늘면 단말향 ASP는 구조적으로 압박받을 가능성이 큽니다.",
    },
    {
      id: "auto-edge",
      label: "오토·엣지향",
      short: "오토/엣지",
      demand: "Terminal",
      title: "차량·엣지 AI용 고신뢰 메모리 옵션",
      startShare: 5,
      endShare: 5,
      baseScore: 64,
      sensitivity: .75,
      linkedCategories: ["dram", "nand", "aidemand"],
      products: ["Automotive DRAM", "Industrial NAND", "Edge AI Memory", "Embedded SSD"],
      keywords: ["automotive memory", "vehicle", "edge ai", "industrial", "embedded", "adas", "on-device ai", "inference"],
      priceTerms: ["dram", "nand", "ssd"],
      thesis: "차량·엣지는 서버만큼 크지는 않지만 장주기 인증과 고신뢰 요구가 있어 가격 하락기에 방어적 수익성을 제공할 수 있습니다.",
      assumptions: ["차량용 인증 주기 유지", "온디바이스 AI와 엣지 추론 확대", "산업용 NAND의 장기 공급 계약 확대"],
      triggers: ["차량용 메모리 인증", "엣지 AI SoC 채택", "산업용 장기계약", "온디바이스 AI 수요"],
      actions: ["장기공급 계약", "고신뢰 제품 포트폴리오", "엣지 AI 고객 개발"],
      risk: "인증 주기가 길어 단기 매출 기여는 제한적이며, 범용 단말과 섞어 보면 성장성이 과소평가될 수 있습니다.",
    },
    {
      id: "legacy",
      label: "레거시·범용 방어",
      short: "레거시",
      demand: "Commodity",
      title: "DDR4·범용 NAND·가격 하방 방어 포트폴리오",
      startShare: 5,
      endShare: 3,
      baseScore: 48,
      sensitivity: .65,
      linkedCategories: ["dram", "nand", "china", "geopolitics"],
      products: ["DDR4", "Commodity DRAM", "Retail SSD", "Wafer/Legacy NAND"],
      keywords: ["ddr4", "legacy", "commodity", "spot price", "contract price", "cxmt", "ymtc", "oversupply", "wafer"],
      priceTerms: ["dram", "nand", "wafer", "spot", "contract"],
      thesis: "레거시는 성장 축이 아니라 현금흐름과 고객 유지 방어 축입니다. 중국 물량 공세가 가장 먼저 가격을 흔드는 영역입니다.",
      assumptions: ["중국 보조금 물량 확대", "범용 DRAM/NAND 가격 변동성 확대", "고마진 서버향 캐파 우선 배분"],
      triggers: ["CXMT 캐파 증설", "YMTC wafer/SSD 가격", "Spot-contract spread", "BIS/수출통제 반작용"],
      actions: ["cash-cost floor", "재고 회전 관리", "저수익 SKU 축소"],
      risk: "가격 방어가 실패하면 서버향 성장에도 전사 믹스 개선 속도가 둔화될 수 있습니다.",
    },
  ];
  const EXEC_DECISION_PRODUCTS = [
    {
      id: "hbm-ai-server",
      label: "HBM·AI 서버",
      demand: "서버향",
      category: "hbm",
      products: ["HBM3E/HBM4", "Custom HBM", "서버 DDR5", "CXL Memory"],
      priceTerms: ["ddr5", "gddr", "module", "dram contract", "dram spot"],
      chinaTerms: ["cxmt", "hbm", "ddr5", "ai server", "rubin"],
      decisionBias: "growth",
      rationale: "AI 서버향은 HBM 직접 가격표가 없으므로 DDR5/GDDR/모듈 가격을 프리미엄 메모리 proxy로 사용합니다.",
      upside: "가격 모멘텀이 양수이고 중국 HBM 실질 양산 신호가 약하면 증설·고객 락인이 우선입니다.",
      downside: "HBM4 인증 지연이나 서버 DRAM 가격 약세가 확인되면 고객별 할당과 수율 리스크를 보수적으로 봅니다.",
    },
    {
      id: "server-dram",
      label: "서버 DRAM",
      demand: "서버향",
      category: "dram",
      products: ["DDR5 RDIMM", "MRDIMM", "고용량 서버 DIMM"],
      priceTerms: ["ddr5", "so-dimm", "dram contract", "dram spot"],
      chinaTerms: ["cxmt", "ddr5", "server dram", "dram capacity"],
      decisionBias: "growth",
      rationale: "TrendForce DRAM spot/contract와 DDR5 품목을 사용해 서버 DRAM 가격 방향을 검증합니다.",
      upside: "DDR5 가격 상승이 이어지면 서버향 캐파 우선 배분과 장기계약 확대가 유효합니다.",
      downside: "DDR5 spot 약세 또는 CXMT DDR5 캐파 확대 신호가 강하면 보수적 재고/가격 방어가 필요합니다.",
    },
    {
      id: "enterprise-ssd",
      label: "eSSD·Solidigm",
      demand: "서버향 스토리지",
      category: "nand",
      products: ["Enterprise SSD", "QLC NAND", "Solidigm", "PCIe Gen5/Gen6 SSD"],
      priceTerms: ["nand flash contract", "pc-client oem ssd", "ssd", "tlc", "qlc"],
      chinaTerms: ["ymtc", "essd", "xtacking", "server ssd", "wuhan"],
      decisionBias: "balanced",
      rationale: "eSSD 전용 공개 가격이 제한적이므로 NAND contract와 SSD/OEM SSD 품목을 실제 proxy로 사용합니다.",
      upside: "NAND 계약가와 SSD 가격이 동반 상승하면 eSSD 믹스 확대와 Solidigm value-up이 우선입니다.",
      downside: "YMTC eSSD 고객 인증 또는 NAND wafer 약세가 나오면 중국 가격 침투 리스크를 높게 봅니다.",
    },
    {
      id: "mobile-pc-terminal",
      label: "모바일·PC 단말",
      demand: "단말향",
      category: "dram",
      products: ["LPDDR5X/LPDDR6", "UFS", "Client SSD", "모바일 NAND"],
      priceTerms: ["lpddr", "so-dimm", "module", "client", "ufs", "memory card", "microsd", "pc-client"],
      chinaTerms: ["cxmt", "ymtc", "lpddr", "ufs", "client ssd"],
      decisionBias: "defense",
      rationale: "LPDDR/UFS 공개 가격이 제한되어 module, SO-DIMM, PC-client SSD, memory card 가격을 단말 proxy로 사용합니다.",
      upside: "단말 proxy 가격이 개선되면 고부가 LPDDR/UFS SKU 중심으로 선별 확대합니다.",
      downside: "중국 범용 제품 공급과 client SSD 약세가 보이면 저수익 SKU 축소와 원가 방어가 우선입니다.",
    },
    {
      id: "auto-edge",
      label: "오토·엣지",
      demand: "오토·엣지",
      category: "aidemand",
      products: ["Automotive DRAM", "Industrial NAND", "Embedded SSD", "Edge AI Memory"],
      priceTerms: ["dram", "nand", "ssd", "embedded", "industrial"],
      chinaTerms: ["edge ai", "automotive memory", "industrial nand", "china"],
      decisionBias: "balanced",
      rationale: "차량/산업용 전용 공개 가격이 없으므로 DRAM/NAND/SSD 전체 가격 방향과 뉴스 신호를 보조 지표로 사용합니다.",
      upside: "가격 안정과 인증 뉴스가 같이 나오면 장기공급계약 중심의 옵션 확대가 적합합니다.",
      downside: "범용 가격 약세가 심하면 오토·엣지는 수익성 방어용으로만 제한 배분합니다.",
    },
    {
      id: "legacy-commodity",
      label: "레거시·범용",
      demand: "범용 방어",
      category: "dram",
      products: ["DDR4", "DDR3", "Commodity DRAM", "Retail SSD", "Wafer NAND"],
      priceTerms: ["ddr4", "ddr3", "ett", "wafer", "mlc", "retail", "street"],
      chinaTerms: ["cxmt", "ymtc", "legacy", "commodity", "oversupply"],
      decisionBias: "defense",
      rationale: "중국 물량 공세가 가장 먼저 반영되는 DDR4/eTT/wafer/SSD street 가격을 실제 방어 지표로 사용합니다.",
      upside: "레거시 가격이 상승해도 구조적 성장으로 보지 않고 현금흐름 회수와 재고 정상화에 초점을 둡니다.",
      downside: "가격 하락이 확인되면 생산/재고/저수익 SKU를 빠르게 줄이는 의사결정이 필요합니다.",
    },
    {
      id: "china-exposure",
      label: "중국 노출·가격 압력",
      demand: "중국 포함",
      category: "china",
      products: ["CXMT DRAM 압력", "YMTC NAND/eSSD", "중국 장비 국산화", "레거시 가격"],
      priceTerms: ["ddr4", "ddr5", "ett", "nand", "wafer", "ssd", "mlc", "tlc"],
      chinaTerms: ["cxmt", "ymtc", "naura", "amec", "xmc", "jcet", "china capacity", "big fund"],
      decisionBias: "risk",
      rationale: "중국 업체별 실적/캐파의 과거 가격 직접 데이터는 없으므로 중국 영향이 큰 DDR4/eTT/NAND/SSD 가격을 실제 proxy로 사용합니다.",
      upside: "중국 관련 가격 proxy가 상승해도 의사결정은 확대보다 경쟁 압력 완화 여부 확인에 둡니다.",
      downside: "중국 proxy 가격이 하락하면 가격 하방, 고객 침투, 수출통제 반작용을 즉시 경영진 안건으로 올립니다.",
    },
  ];
  const INVESTMENT_STRATEGY_PILLARS = [
    {
      id: "hbm-premium",
      label: "AI 서버/HBM 초격차",
      role: "Core growth",
      allocation: "45%",
      horizon: "30개월 이후 5년",
      capital: "직접 CAPEX + 전략 제휴",
      title: "HBM4·Custom HBM·서버 DRAM에 자본을 우선 배분",
      thesis: "AI 서버향 제품군은 가격·뉴스·프로젝션 신호가 동시에 강한 축입니다. TSMC/패키징 병목, 고객 인증, DDR5/CXL 확장을 한 묶음으로 보고 프리미엄 믹스를 방어해야 합니다.",
      actions: ["HBM4 고객 인증과 베이스 다이 협력 고정", "패키징·테스트 병목 업체 투자 후보 추적", "서버 DRAM·CXL 옵션을 후속 포트폴리오로 연결"],
      triggers: ["HBM4 Rubin 인증", "CoWoS/첨단 패키징 할당", "DDR5 contract 가격", "AI accelerator 수요"],
      linkedCategories: ["hbm", "aidemand", "packaging", "dram"],
      keywords: ["hbm", "hbm4", "hbm3e", "nvidia", "rubin", "tsmc", "cowos", "server", "ddr5", "cxl"],
      baseScore: 88,
    },
    {
      id: "china-nand",
      label: "중국 NAND/eSSD 대응",
      role: "Defense growth",
      allocation: "18%",
      horizon: "상시",
      capital: "고객 방어 + 선택적 제휴",
      title: "YMTC·XMC·JCET 신호를 eSSD 방어 투자로 전환",
      thesis: "YMTC의 Xtacking, 우한 Phase 3, eSSD 고객 인증은 NAND 수익성에 직접 영향을 줍니다. 가격 방어와 고객 락인을 동시에 보는 투자 테마가 필요합니다.",
      actions: ["eSSD 고객 인증 방어", "Solidigm/QLC value-up 과제 추적", "중국 내수 보조금·공급계약 신호를 조기 경보로 연결"],
      triggers: ["YMTC eSSD 인증", "NAND contract 가격", "Wuhan Phase 3", "XMC HBM packaging"],
      linkedCategories: ["nand", "china", "packaging"],
      keywords: ["ymtc", "xtacking", "essd", "solidigm", "qlc", "nand", "xmc", "wuhan", "jcet"],
      baseScore: 78,
    },
    {
      id: "equipment-materials",
      label: "소부장·장비 초크포인트",
      role: "Supply hedge",
      allocation: "12%",
      horizon: "18~36개월",
      capital: "소수지분 + 장기 공급계약",
      title: "장비·소재 병목을 전략적 투자 후보로 분리",
      thesis: "Naura·AMEC·ACM 등 중국 장비 내재화는 단순 경쟁 뉴스가 아니라 원가·수율·수출통제 리스크입니다. 핵심 소재와 장비의 대체 조달 옵션을 투자 관점에서 봐야 합니다.",
      actions: ["핵심 소재 recipe/IP 방어 조건 설정", "장기 공급계약과 소수지분 투자 병행", "중국 JV 요구와 기술 이전 리스크 분리"],
      triggers: ["Big Fund III", "NAURA", "AMEC", "ACM Research", "export control"],
      linkedCategories: ["equipment", "geopolitics", "talent"],
      keywords: ["naura", "amec", "acm", "equipment", "big fund", "export control", "materials", "eda"],
      baseScore: 74,
    },
    {
      id: "post-hbm",
      label: "Post-HBM 옵션",
      role: "Option value",
      allocation: "10%",
      horizon: "3~5년",
      capital: "옵션형 소수지분 + 후속투자권",
      title: "CXL·PIM·3D DRAM을 차세대 선택권으로 확보",
      thesis: "HBM 이후의 병목은 CXL, PIM, 3D DRAM, 포토닉 인터커넥트로 이동합니다. 현재 매출 기여보다 기술 옵션 가치와 고객 PoC 신호를 기준으로 투자해야 합니다.",
      actions: ["CXL 컨트롤러/IP 후보 롱리스트", "PIM·3D DRAM 장비/EDA 의존도 추적", "후속투자권 포함 소수지분 구조 설계"],
      triggers: ["CXL 3.1/3.2", "PIM", "3D DRAM", "silicon photonics", "controller IP"],
      linkedCategories: ["cxl", "hbm", "packaging", "aidemand"],
      keywords: ["cxl", "pim", "3d dram", "photonics", "interconnect", "controller", "memory expansion"],
      baseScore: 70,
    },
    {
      id: "talent-ip",
      label: "인재/IP 방어",
      role: "Risk shield",
      allocation: "8%",
      horizon: "즉시",
      capital: "보상·법무·보안 투자",
      title: "수율 엔지니어와 공정 레시피를 투자 리스크로 관리",
      thesis: "중국 업체의 채용·인재 이동은 기술 격차를 줄이는 선행 신호입니다. 방어 투자는 비용이 아니라 HBM·DRAM 수율 자산을 보호하는 옵션입니다.",
      actions: ["핵심 수율 인력 보상 패키지 강화", "이직·접근권·IP 이상징후 모니터링", "Boss Zhipin·캠퍼스 채용 신호 크롤링"],
      triggers: ["CXMT hiring", "yield engineer", "Boss Zhipin", "IP leak", "Korean engineer"],
      linkedCategories: ["talent", "dram", "geopolitics"],
      keywords: ["hiring", "talent", "yield", "engineer", "ip", "boss zhipin", "cxmt"],
      baseScore: 76,
    },
    {
      id: "legacy-cash",
      label: "레거시 현금흐름 방어",
      role: "Cash defense",
      allocation: "7%",
      horizon: "상시",
      capital: "원가 절감 + SKU 선택",
      title: "DDR4·범용 NAND는 증설보다 가격 하방 방어에 집중",
      thesis: "CXMT·YMTC의 물량 공세는 레거시 가격을 먼저 흔듭니다. 투자는 성장 CAPEX보다 cash-cost floor, 재고 회전, 고객별 가격 방어에 집중해야 합니다.",
      actions: ["저마진 SKU 축소", "cash-cost floor와 재고 회전 KPI 관리", "중국 캐파·spot/contract spread 조기 경보"],
      triggers: ["DDR4 spot", "CXMT capacity", "YMTC wafer", "oversupply", "contract price"],
      linkedCategories: ["dram", "nand", "china"],
      keywords: ["ddr4", "legacy", "commodity", "spot", "contract", "cxmt", "ymtc", "oversupply", "wafer"],
      baseScore: 68,
    },
  ];
  const STRATEGIC_INVESTMENT_DECISIONS = [
    {
      id: "hbm-packaging-jv",
      label: "HBM 패키징 병목",
      option: "JV / 인수 검토",
      stage: "Go",
      capital: "대형 전략 투자",
      title: "HBM 베이스 다이·패키징·테스트 병목을 통합 투자 안건으로 상정",
      logic: "AI 서버/HBM 프리미엄이 유지되는 케이스에서는 패키징 병목이 매출 인식과 고객 락인의 핵심 제약입니다.",
      gate: ["고객 인증 일정", "패키징 capacity", "수율 ramp", "TSMC/OSAT 협력 조건"],
      action: "전략 제휴와 지분투자 병행, 병목 업체는 인수/JV까지 검토",
      linkedStrategy: "hbm-premium",
      linkedCategories: ["hbm", "packaging", "aidemand"],
      keywords: ["hbm", "packaging", "cowos", "tsmc", "osat", "test", "base die"],
      baseScore: 86,
    },
    {
      id: "cxl-minority",
      label: "CXL·PIM 옵션",
      option: "소수지분 + 후속투자권",
      stage: "Option",
      capital: "중소형 옵션 투자",
      title: "CXL 컨트롤러/IP와 PIM 생태계를 미래 선택권으로 확보",
      logic: "표준과 수요가 아직 완전히 확정되지 않았으므로 통제권보다 후속투자권과 고객 PoC 데이터가 중요합니다.",
      gate: ["CXL 3.1/3.2 채택", "고객 PoC", "컨트롤러 IP 성숙도", "서버 OEM 협력"],
      action: "소수지분, 공동개발권, 후속투자권 중심으로 구조화",
      linkedStrategy: "post-hbm",
      linkedCategories: ["cxl", "hbm", "aidemand"],
      keywords: ["cxl", "pim", "controller", "ip", "memory expansion", "server"],
      baseScore: 72,
    },
    {
      id: "nand-customer-defense",
      label: "NAND/eSSD 고객 방어",
      option: "장기 공급계약 / 가격 방어",
      stage: "Defend",
      capital: "선택적 방어 투자",
      title: "YMTC eSSD·내수 보조금 신호를 고객 방어 의사결정으로 연결",
      logic: "중국 NAND가 원가보다 고객 인증을 먼저 흔들 경우, 투자 판단은 증설보다 고객 방어·Solidigm value-up이 우선입니다.",
      gate: ["YMTC 고객 인증", "NAND contract 가격", "eSSD 입찰", "중국 보조금"],
      action: "핵심 고객 장기계약, QLC/eSSD 제품 믹스 개선, 저수익 영역 축소",
      linkedStrategy: "china-nand",
      linkedCategories: ["nand", "china"],
      keywords: ["ymtc", "essd", "solidigm", "qlc", "nand", "customer", "contract"],
      baseScore: 80,
    },
    {
      id: "equipment-supply-hedge",
      label: "소부장 공급망",
      option: "전략 제휴 / 공급계약",
      stage: "Watch",
      capital: "헤지성 투자",
      title: "장비·소재 초크포인트는 공급 안정성과 IP 조건을 함께 보고 결정",
      logic: "중국 장비 내재화와 수출통제 변화가 동시에 움직이면 공급 안정성 확보가 재무 수익률만큼 중요해집니다.",
      gate: ["수출통제 변화", "장비 qualify", "소재 recipe 이전 요구", "대체 공급 가능성"],
      action: "핵심 공급사 장기계약, 소수지분, JV 제안은 IP 조건부로 제한",
      linkedStrategy: "equipment-materials",
      linkedCategories: ["equipment", "geopolitics"],
      keywords: ["naura", "amec", "equipment", "materials", "export control", "big fund"],
      baseScore: 74,
    },
    {
      id: "talent-ip-shield",
      label: "인재/IP 방어",
      option: "보상·법무·보안 투자",
      stage: "Go",
      capital: "즉시 집행",
      title: "핵심 수율 인력과 공정 레시피를 투자 자산으로 보호",
      logic: "인재 유출은 장비 제약보다 빠르게 기술 격차를 줄일 수 있어 방어 의사결정의 우선순위가 높습니다.",
      gate: ["핵심 인력 이탈", "채용 JD 급증", "IP 소송/수사", "공정 데이터 접근 이상"],
      action: "핵심 인력 보상, 접근권 통제, 이직 모니터링, 법적 방어 예산 선집행",
      linkedStrategy: "talent-ip",
      linkedCategories: ["talent", "geopolitics", "dram"],
      keywords: ["talent", "hiring", "yield", "ip", "engineer", "cxmt"],
      baseScore: 82,
    },
    {
      id: "legacy-capex-hold",
      label: "레거시 증설",
      option: "보류 / 원가 방어",
      stage: "Hold",
      capital: "CAPEX 억제",
      title: "범용 DRAM/NAND 증설은 보류하고 가격 하방 방어 KPI로 관리",
      logic: "중국 캐파가 레거시 가격을 압박하는 국면에서는 성장 투자보다 원가·재고·고객 선택이 의사결정 핵심입니다.",
      gate: ["DDR4/eTT 가격", "spot-contract spread", "CXMT 캐파", "YMTC wafer 가격"],
      action: "저수익 SKU 축소, 재고 회전 관리, 범용 CAPEX 보수화",
      linkedStrategy: "legacy-cash",
      linkedCategories: ["dram", "nand", "china"],
      keywords: ["ddr4", "legacy", "commodity", "spot", "contract", "capacity", "oversupply"],
      baseScore: 68,
    },
  ];
  const CHINA_DEEP_DIVE = [
    {
      id: "dram-euv-duv",
      tag: "DRAM 공정",
      title: "CXMT 16nm(G4) 진입과 EUV 부재 한계",
      thesis: "TechInsights 분석 기준 CXMT는 16nm(G4) DDR5 모듈을 양산하고 15nm 진입을 노리지만, EUV 없이 DUV 멀티패터닝으로 선단 D램을 밀어붙이는 구조적 한계가 큽니다",
      facts: ["Gloway DDR5-6000 양산 확인", "DDR5 수율은 90%+ 확정이 아니라 80%대 Watch", "15nm는 2026년 말 목표"],
      risk: "DUV 반복 노광은 공정 스텝·마스크 비용·변동성을 키우며, HBM3는 열·패키징·소재·수율 병목으로 2026년 내 의미 있는 양산이 어렵다는 평가가 우세합니다",
      implication: "HBM 선두와의 격차는 3~4년 유지 가능성이 높고, CXMT의 실제 위협은 IPO 자금 투입 이후 레거시 DRAM 가격 하방에서 먼저 나타납니다",
      linkedCategories: ["dram", "packaging", "equipment"],
    },
    {
      id: "ymtc-xtacking",
      tag: "NAND 구조",
      title: "YMTC Xtacking 4.0과 최신 NAND 밀도 선도",
      thesis: "YMTC는 로직 제어 웨이퍼와 메모리 셀 웨이퍼를 분리 가공한 뒤 하이브리드 본딩하는 Xtacking 4.0으로 기존 NAND 구조를 우회하고, 최신 294단급 제품에서 높은 셀 밀도를 확보했습니다",
      facts: ["NAND 점유율 2025년 1분기 8% → 2026년 1분기 13%", "Xtacking 4.0 최신 밀도 20.5Gb/mm²", "294단급·활성층 약 270단 제품 확인"],
      risk: "기존 4.41Gb/mm² 수치는 초기 세대 지표라 최신 경쟁력을 과소평가합니다. 다만 수율 안정화는 별도 검증이 필요합니다",
      implication: "SK하이닉스는 NAND 가격뿐 아니라 eSSD·데이터센터 고객 확대와 YMTC의 기술 선도 지표를 동시에 봐야 합니다",
      linkedCategories: ["nand", "packaging"],
    },
    {
      id: "wuhan-phase3",
      tag: "우한 3공장",
      title: "YMTC 우한 Phase 3와 D램 병행 생산",
      thesis: "미국 제재 이후 YMTC는 우한 3공장에 국산 장비를 대거 투입하고, 일부 캐파를 D램과 TSV 패키징 준비로 돌리며 종합 메모리 기업화를 시도합니다",
      facts: ["2026년 하반기 가동 목표", "핵심 장비 50%+ 국산 장비", "캐파 50%를 D램 제조 라인에 할당한 것으로 관찰"],
      risk: "국산 장비 qual과 공정 recipe 안정화가 지연되면 NAND·D램 동시 확장 전략은 수율 병목에 부딪힐 수 있습니다",
      implication: "YMTC는 단순 NAND 경쟁사가 아니라 NAND·D램·TSV 적층을 묶는 중국형 IDM 후보로 추적해야 합니다",
      linkedCategories: ["nand", "dram", "equipment", "packaging"],
    },
    {
      id: "advanced-packaging",
      tag: "첨단 패키징",
      title: "JCET·XMC의 패키징 우회로",
      thesis: "중국은 7nm 이하 선단 공정 제약을 2.5D/3D 이종 집적과 하이브리드 본딩 기반 첨단 패키징으로 우회하려 합니다",
      facts: ["JCET 2025년 첨단 패키징 매출 270억 위안 확인", "XMC 월 3,000장 HBM 패키징 장비 보도", "XMC 2,600억 위안 투자 수치는 검증 미완료"],
      risk: "CXMT·YMTC 베이스 다이를 XMC가 고대역폭 패키징으로 묶는 구조가 자리 잡을 수 있지만, 투자 규모 수치는 확인/미확인을 분리해야 합니다",
      implication: "SK하이닉스는 HBM 다이 경쟁뿐 아니라 OSAT·인터포저·언더필·테스트 병목을 함께 보는 패키징 레이더가 필요합니다",
      linkedCategories: ["packaging", "hbm", "geopolitics"],
    },
    {
      id: "big-fund-equipment",
      tag: "소부장",
      title: "빅펀드 3기와 장비·소재 국산화",
      thesis: "빅펀드 3기는 단순 팹 증설보다 EUV·EDA·첨단 화학 소재 같은 초크포인트에 자본을 집중하고 있습니다",
      facts: ["빅펀드 3기 약 475억 달러", "Yole 기준 장비 국산화율 2025년 23.2%", "중국 내 팹·핵심 공정 기준은 35~40%+ 보도"],
      risk: "집계 기준에 따라 국산화율 수치가 달라집니다. AMEC 식각, Naura 종합장비, ACM 세정이 서방 장비를 대체하고 소재 기업은 JV·공동 R&D를 통해 recipe 흡수를 시도합니다",
      implication: "한국 소부장 파트너의 JV 제안, 소재 recipe 이전, 중국 내수 우선 공급권 요구를 조기 탐지해야 합니다",
      linkedCategories: ["equipment", "geopolitics", "talent"],
    },
    {
      id: "match-act",
      tag: "규제 리스크",
      title: "MATCH Act와 DUV·극저온 식각 제한 변수",
      thesis: "2026년 4월 발의된 MATCH Act는 침수 DUV 리소그래피와 극저온 식각 장비의 대중 수출 제한을 강화하고 동맹국 동참을 요구하는 규제 변수입니다",
      facts: ["DUV·극저온 식각 장비 제한 논의", "150일 내 동맹국 동참 요구", "YMTC Phase 4·5와 CXMT 장비 교체 타임라인에 영향"],
      risk: "통과 시 중국 선단 메모리 캐파가 현재 수준에 묶일 수 있지만, 동시에 국산 장비 50%+ 승인 요건과 내재화 투자를 더 가속할 수 있습니다",
      implication: "BIS/VEU, MATCH Act, 네덜란드·일본 동참 여부를 YMTC Phase 3 이후 팹 일정과 연결해 추적해야 합니다",
      linkedCategories: ["geopolitics", "equipment", "china"],
    },
    {
      id: "talent-ip",
      tag: "인재/IP",
      title: "수율 엔지니어와 IP 유출 리스크",
      thesis: "중국의 기술 추격은 설계 도면보다 수율 안정화 경험이 풍부한 현장 인력과 공정 데이터 확보에 초점을 맞춥니다",
      facts: ["한국 출신 엔지니어 유입 신호", "Boss Zhipin 기반 핀셋 채용", "D램 설계·공정 데이터 유출 사건"],
      risk: "수율 recipe와 생산 안정화 경험이 이동하면 장비 제약보다 빠르게 기술 격차가 좁혀질 수 있습니다",
      implication: "핵심 엔지니어 보상, 접근권 최소화, 퇴직 후 IP 모니터링, 채용 플랫폼 크롤링을 한 보드에서 묶어야 합니다",
      linkedCategories: ["talent", "dram", "packaging"],
    },
    {
      id: "bifurcation",
      tag: "미래 방향",
      title: "자급자족 생태계와 공급망 분리",
      thesis: "미국 중심 밸류체인과 중국 대체 생태계가 장기적으로 분리되며, 시장은 호환성이 낮은 두 공급망으로 갈라질 가능성이 커지고 있습니다",
      facts: ["수출통제 반작용", "장비·EDA·소재 초크포인트 집중", "내수 고객과 보조금 기반 수요 흡수"],
      risk: "제재는 중국의 외부 의존도를 낮추는 촉매로 작동하고, 글로벌 고객의 이중 공급망 전략을 강화합니다",
      implication: "SK하이닉스는 중국 내수 가격·캐파 신호와 비중국 프리미엄 고객 락인을 동시에 관리해야 합니다",
      linkedCategories: ["geopolitics", "china", "dram", "nand"],
    },
    {
      id: "skhynix-response",
      tag: "대응 전략",
      title: "SK하이닉스 대응 축",
      thesis: "중국은 HBM4 최선단보다 레거시 DRAM·NAND와 패키징 우회로에서 비대칭 위협을 먼저 만들 가능성이 큽니다",
      facts: ["HBM·PIM 초격차 유지", "레거시 D램 원가 방어", "중국 로컬 마이크로데이터 조기경보"],
      risk: "글로벌 세트 업체의 가격 협상력과 중국 보조금 물량이 결합하면 범용 메모리 단가가 급격히 흔들릴 수 있습니다",
      implication: "핵심 고객 연대, 범용 제품 cash-cost floor, Xueqiu·Boss Zhipin·특허·채용 신호 크롤링, 핵심 인력 방어가 함께 필요합니다",
      linkedCategories: ["dram", "nand", "talent", "geopolitics"],
    },
  ];
  const WORKBENCH_MODES = [
    {
      id: "review",
      label: "리뷰 큐",
      sub: "Digest · Diff · Status",
      section: "daily-review",
    },
    {
      id: "executive",
      label: "경영진 의사결정",
      sub: "Decision · Backtest",
      section: "executive-decision",
    },
    {
      id: "strategy-formulation",
      label: "경영전략 수립",
      sub: "Capital · Theme",
      section: "management-strategy",
    },
    {
      id: "investment-decision",
      label: "전략적 의사 결정",
      sub: "M&A · JV · Minority",
      section: "strategic-investment-decision",
    },
    {
      id: "crawler",
      label: "크롤링 관제",
      sub: "Source · Health · Map",
      section: "crawler",
    },
    {
      id: "dynamics",
      label: "중국 다이내믹스",
      sub: "캐파 · 장비 · 패키징",
      section: "china-dynamics",
    },
    {
      id: "nand",
      label: "NAND 전략",
      sub: "YMTC · eSSD · XMC",
      section: "china-nand",
    },
    {
      id: "talent",
      label: "인재 레이더",
      sub: "Hiring · Campus · IP",
      section: "talent-radar",
    },
    {
      id: "projection",
      label: "제품 프로젝션",
      sub: "Server · Terminal · 30M+",
      section: "projection",
    },
    {
      id: "architecture",
      label: "AI Matrix",
      sub: "HBM · CXL · Commodity",
      section: "ai-matrix",
    },
    {
      id: "competition",
      label: "경쟁 구도",
      sub: "CXMT · YMTC · OSAT",
      section: "dynamics",
    },
    {
      id: "monetization",
      label: "수익화 모델",
      sub: "Margin · Mix · Platform",
      section: "monetization",
    },
    {
      id: "response",
      label: "대응 액션",
      sub: "P0/P1 execution",
      section: "response",
    },
    {
      id: "intelligence",
      label: "정보 채널",
      sub: "Finance · Hiring · Teardown",
      section: "intelligence",
    },
  ];
  const MECE_GROUPS = [
    {
      id: "daily",
      label: "매일 업데이트",
      desc: "크롤링 성공 여부와 오늘 바뀐 가격·뉴스·중국 신호",
      cadence: "Daily crawler",
      sections: ["executive-decision", "daily-review", "crawler", "prices", "news", "china-nand", "china-dynamics", "talent-radar"],
    },
    {
      id: "quant",
      label: "실시간 분석",
      desc: "숫자 KPI, 제품군 프로젝션, 선택형 인텔리전스 워크벤치",
      cadence: "Interactive",
      sections: ["numbers", "projection", "workbench"],
    },
    {
      id: "benchmark",
      label: "기준 벤치마킹",
      desc: "중국 메모리 기술·경쟁사·카테고리 기준 프레임",
      cadence: "Reference layer",
      sections: ["ai-matrix", "china-deep-dive", "categories", "competitors"],
    },
    {
      id: "strategy",
      label: "전략·대응",
      desc: "경영전략 수립, 전략적 투자 의사결정, 경쟁 다이내믹스, 대응 액션",
      cadence: "Decision layer",
      sections: ["management-strategy", "strategic-investment-decision", "dynamics", "monetization", "response", "intelligence"],
    },
  ];
  const NEWS_SOURCE_TABS = [
    { id: "english", label: "영어권 기사", countId: "foreignNewsCount", bucketId: "foreignNewsBucket", listId: "foreignNewsList" },
    { id: "chinese", label: "중국어 기사", countId: "chinaNewsCount", bucketId: "chinaNewsBucket", listId: "chinaNewsList" },
  ];
  const QUANT_LENSES = [
    { id: "all", label: "전체", sub: "All KPI", categories: [] },
    { id: "market", label: "시장/가격", sub: "Spot · Contract · WSTS", categories: ["dram", "nand", "aidemand"], keywords: ["가격", "spot", "contract", "wsts", "market", "성장", "매출", "규모"] },
    { id: "hbm", label: "HBM/Post-HBM", sub: "HBM4 · CXL · 3D DRAM", categories: ["hbm", "cxl", "packaging", "aidemand"], keywords: ["hbm", "rubin", "cxl", "pim", "3d dram", "cowos", "tsmc"] },
    { id: "china-risk", label: "중국 리스크", sub: "CXMT · YMTC · 정책", categories: ["china", "geopolitics", "equipment", "talent"], keywords: ["cxmt", "ymtc", "big fund", "match", "veU", "중국", "국산화", "수출통제"] },
    { id: "pipeline", label: "수집상태", sub: "Freshness · Health", categories: ["operations"], keywords: ["freshness", "health", "crawler", "rows", "뉴스", "수집", "pipeline"] },
  ];
  const SECTION_LABELS = {
    "executive-decision": "경영진 의사결정",
    "management-strategy": "경영전략 수립",
    "strategic-investment-decision": "전략적 의사 결정",
    "daily-review": "일일 리뷰 큐",
    numbers: "숫자 대시보드",
    projection: "제품군 프로젝션",
    crawler: "전체 크롤링 관제",
    "ai-matrix": "AI 메모리 매트릭스",
    "china-dynamics": "중국 반도체 다이내믹스",
    "china-nand": "중국 NAND 사업 강화",
    "talent-radar": "인재·채용 레이더",
    "china-deep-dive": "중국 심층 벤치마킹",
    dynamics: "경쟁 다이나믹스",
    monetization: "벤치마킹 모델",
    response: "대응 대시보드",
    intelligence: "정보 획득 채널",
    categories: "메모리 카테고리",
    competitors: "중국 경쟁사",
    news: "중국·외신 기사",
    prices: "TrendForce 가격",
  };
  const CRAWL_PIPELINE = [
    {
      id: "trendforce-price",
      label: "TrendForce 가격",
      source: "DRAM/NAND spot·contract 공개 가격표",
      method: "HTML 가격 테이블 파싱 → 품목별 history 누적",
      fields: ["평균가", "변동률", "업데이트 시각", "품목별 trend"],
      filters: ["DRAM/NAND 그룹화", "Spot/Contract 분리", "가격 historyKey 매핑"],
      output: "Spot / Contract 가격 추이",
      section: "prices",
      linkedCategories: ["dram", "nand"],
      healthKeys: ["가격:", "가격히스토리"],
    },
    {
      id: "executive-backtest",
      label: "경영진 의사결정 백테스트",
      source: "price-history.json 실제 가격 포인트 · live.json 중국 뉴스/벤치마킹 신호",
      method: "선택한 과거 수집일 기준으로 당시까지의 가격 모멘텀을 계산하고, 이후 최신 수집가까지 실제 변화율로 의사결정 적중 여부 검증",
      fields: ["과거 수집일", "제품군", "당시 판단", "이후 실제 변화율", "관측 품목 수", "데이터 충분성"],
      filters: ["HBM proxy", "서버 DRAM", "eSSD/NAND", "단말 proxy", "레거시", "중국 가격 압력"],
      output: "경영진 의사결정 · 백테스트",
      section: "executive-decision",
      linkedCategories: ["hbm", "dram", "nand", "aidemand", "china", "geopolitics"],
      healthKeys: ["가격:", "가격히스토리", "뉴스:China", "벤치마킹:China"],
    },
    {
      id: "ai-architecture-signal",
      label: "HBM/CXL 아키텍처",
      source: "HBM4 · Custom HBM · CXL/PIM · TC 본더 · 장비 계약",
      method: "공식 로드맵, 해외 리서치, 장비 공시, 소송/특허 신호를 Premium AI Matrix와 Supply Chain Explorer로 분류",
      fields: ["HBM 점유율", "고객 인증", "베이스 다이", "TC 본더", "CXL 테스터"],
      filters: ["HBM/CXL 키워드", "소부장 vendor alias", "특허·계약·수율 신호", "첨부 보고서 Watch 항목"],
      output: "AI 메모리 매트릭스",
      section: "ai-matrix",
      linkedCategories: ["hbm", "cxl", "aidemand", "packaging", "equipment"],
      healthKeys: ["뉴스:HBM", "뉴스:CXL", "벤치마킹:Advanced Packaging"],
    },
    {
      id: "foundry-memory-fusion",
      label: "파운드리-메모리 융합",
      source: "SK하이닉스-TSMC HBM4 · 삼성 1c/4nm 턴키 · CoWoS/패키징 할당",
      method: "HBM4 base die, foundry node, CoWoS, Rubin 인증, logic die yield 신호를 고도화 인사이트 모듈로 연결",
      fields: ["base die node", "CoWoS allocation", "logic die yield", "custom HBM sample", "Rubin qualification"],
      filters: ["HBM4", "TSMC", "Samsung 4nm", "CoWoS", "Rubin", "base die"],
      output: "파운드리-메모리 융합 시너지 트래커",
      section: "ai-matrix",
      linkedCategories: ["hbm", "packaging", "aidemand"],
      healthKeys: ["뉴스:HBM", "벤치마킹:Advanced Packaging"],
    },
    {
      id: "foreign-news",
      label: "영어권 기사",
      source: "Google News RSS · 해외 기술/금융/반도체 매체",
      method: "카테고리별 영어 질의 → 한국 매체·비관련 소비자기기 기사 제외",
      fields: ["제목", "출처", "날짜", "링크", "3줄 인사이트"],
      filters: ["memory 키워드", "한국 출처 제외", "업체/카테고리 매칭"],
      output: "영어권 기사 탭",
      section: "news",
      linkedCategories: ["hbm", "dram", "nand", "cxl", "packaging", "aidemand"],
      healthKeys: ["뉴스:"],
    },
    {
      id: "china-news",
      label: "중국 기사·중국 신호",
      source: "CXMT·YMTC·JCET·XMC·Naura·AMEC 중심 RSS 질의",
      method: "중국 업체/정책/장비 키워드로 기사 분류 → 중국어 기사 탭과 다이내믹스에 동시 연결",
      fields: ["중국 업체", "정책/수출통제", "장비/패키징", "내수 고객"],
      filters: ["China 키워드", "중국 생태계 업체명", "정책·장비·패키징 축"],
      output: "중국어 기사 · 중국 반도체 다이내믹스",
      section: "china-dynamics",
      linkedCategories: ["china", "dram", "nand", "equipment", "packaging", "geopolitics"],
      healthKeys: ["뉴스:China", "벤치마킹:"],
    },
    {
      id: "china-capa-warning",
      label: "중국 잉여 캐파 경보",
      source: "CXMT 매출/캐파 · YMTC Phase 3 · Naura/AMEC 국산 장비 · BIS 수출통제",
      method: "중국 wafer start, 국산 장비 비중, DDR5/NAND 가격 spread, 미국 규제 이벤트를 조기경보 점수로 분류",
      fields: ["wafer starts", "domestic tooling", "spot-contract spread", "BIS update", "risk score"],
      filters: ["CXMT/YMTC", "capacity", "domestic equipment", "export control", "DRAM/NAND price"],
      output: "중국 잉여 캐파 조기경보",
      section: "china-dynamics",
      linkedCategories: ["dram", "nand", "china", "equipment", "geopolitics"],
      healthKeys: ["뉴스:China", "벤치마킹:China Capacity", "벤치마킹:Equipment Localization"],
    },
    {
      id: "china-nand-business",
      label: "중국 NAND 사업 강화",
      source: "YMTC Xtacking/eSSD · XMC 패키징 · JCET/TFME · Naura/AMEC/ACM · BIS/Big Fund",
      method: "업체 전략, 가격, 고객, 장비, 정책, 채용 신호를 중국 NAND 사업 판단 보드로 연결",
      fields: ["NAND 가격", "eSSD 고객", "Xtacking", "우한 Phase 3", "장비 국산화", "사업 체크리스트"],
      filters: ["YMTC/XMC/JCET", "NAND/eSSD", "domestic equipment", "export control", "hiring/IP"],
      output: "중국 NAND 사업 강화 인텔리전스",
      section: "china-nand",
      linkedCategories: ["nand", "packaging", "equipment", "china", "geopolitics"],
      healthKeys: ["뉴스:NAND", "뉴스:China", "벤치마킹:China NAND", "벤치마킹:China Capacity"],
    },
    {
      id: "skhynix-product-projection",
      label: "SK하이닉스 제품군 프로젝션",
      source: "TrendForce 가격 · HBM/AI 서버 뉴스 · NAND/eSSD · 중국 캐파/장비/정책 신호",
      method: "현재 수집 데이터를 서버향, 데이터센터 스토리지, 단말, 오토·엣지, 레거시 방어 축으로 재분류해 T+30개월부터 5년 믹스 지수 계산",
      fields: ["수요처", "제품군", "T+30M 믹스", "5Y 믹스", "신호 점수", "리스크"],
      filters: ["HBM/DDR5/CXL", "eSSD/QLC/Solidigm", "LPDDR/UFS/client SSD", "CXMT/YMTC 캐파", "Spot/contract 가격"],
      output: "제품군 프로젝션",
      section: "projection",
      linkedCategories: ["hbm", "dram", "nand", "cxl", "aidemand", "china"],
      healthKeys: ["뉴스:HBM", "뉴스:NAND", "뉴스:AI", "가격:", "벤치마킹:China Capacity"],
    },
    {
      id: "talent-hiring-radar",
      label: "인재·채용 레이더",
      source: "CXMT/YMTC 공식 채용 · Boss Zhipin/Liepin/Maimai · Tsinghua/HUST · ijiwei/IP",
      method: "TSV, Yield, Advanced Packaging, Xtacking, eSSD, tool qual, campus recruiting 키워드를 전략 축으로 분류",
      fields: ["공식 JD", "로컬 채용", "대학 취업센터", "전문 매체/IP", "경보 수준"],
      filters: ["CXMT/YMTC alias", "TSV/HBM/yield", "Xtacking/eSSD", "campus recruiting", "IP/non-compete"],
      output: "인재·채용 레이더",
      section: "talent-radar",
      linkedCategories: ["talent", "dram", "nand", "packaging", "equipment"],
      healthKeys: ["벤치마킹:Talent", "뉴스:China"],
    },
    {
      id: "benchmark-signals",
      label: "벤치마킹 신호",
      source: "China Capacity · Equipment Localization · Advanced Packaging · Talent/IP",
      method: "테마별 질의 결과를 캐파·장비·패키징·인재/IP 축으로 재분류",
      fields: ["캐파", "장비 국산화", "패키징 우회", "인재/IP"],
      filters: ["중복 제거", "테마별 keyword scoring", "다이내믹스 축 매핑"],
      output: "중국 반도체 다이내믹스 · 심층 벤치마킹",
      section: "china-deep-dive",
      linkedCategories: ["china", "equipment", "packaging", "talent", "geopolitics"],
      healthKeys: ["벤치마킹:"],
    },
    {
      id: "competitors",
      label: "경쟁사·주가",
      source: "Samsung · Micron · CXMT · YMTC · Kioxia/WD · 상장 peer 시세",
      method: "업체별 뉴스 질의와 주가 API 대체 소스를 결합해 압력 점수 산출",
      fields: ["기사 건수", "watch word", "pressure score", "주가 변동"],
      filters: ["업체 alias", "watch word hit", "카테고리 매칭"],
      output: "중국 경쟁사 · 경쟁 다이나믹스",
      section: "competitors",
      linkedCategories: ["dram", "nand", "hbm", "china"],
      healthKeys: ["경쟁사:", "주가:"],
    },
    {
      id: "startup-radar",
      label: "스타트업 레이더",
      source: "CXL · 포토닉스 · near-memory · AI interconnect 스타트업",
      method: "후보별 최신 기사/펀딩/고객 신호를 점수화해 SK하이닉스 전략 적합도에 연결",
      fields: ["fit score", "funding/news", "PoC", "파트너십"],
      filters: ["CXL/HBM/광 I/O 키워드", "투자 적합도", "고객 신호"],
      output: "대응 대시보드 · 정보 획득 채널",
      section: "response",
      linkedCategories: ["cxl", "hbm", "packaging", "aidemand"],
      healthKeys: ["스타트업:"],
    },
    {
      id: "post-hbm-architecture",
      label: "Post-HBM 아키텍처",
      source: "CXL 3.1/3.2 · Pangea v3 · 4F² VG/3D DRAM · IP/기판/테스터 밸류체인",
      method: "CXL 표준, 서버 PoC, 3D DRAM 로드맵, 국내 소부장 밸류체인 신호를 Next-Gen Architecture Viewer로 분류",
      fields: ["CXL standard", "Pangea v3", "4F2 VG", "controller IP", "tester/substrate"],
      filters: ["CXL 3.1/3.2", "3D DRAM", "4F2 VG", "Openedges/FADU/TLB", "Exicon/Neosem"],
      output: "Post-HBM 생태계 확장",
      section: "ai-matrix",
      linkedCategories: ["cxl", "dram", "equipment", "aidemand"],
      healthKeys: ["뉴스:CXL", "벤치마킹:CXL and PIM Value Chain"],
    },
    {
      id: "ko-insight",
      label: "정제·한글 인사이트",
      source: "수집 기사 제목/요약/카테고리 메타데이터",
      method: "한국어 제목 정리 → 3줄 인사이트 → 자연어 검색/상세 패널에 주입",
      fields: ["한국어 제목", "핵심 요약", "벤치마킹 포인트", "체크포인트"],
      filters: ["제목 출처 suffix 제거", "날짜 1회 표기", "중복 기사 제거"],
      output: "자연어 검색 · 기사 탭 · 상세 패널",
      section: "news",
      linkedCategories: ["all"],
      healthKeys: ["번역:KO"],
    },
  ];

  let BASE = null;
  let LIVE = emptyLive;
  let HISTORY = emptyHistory;
  let activeCategory = "all";
  let priceFilter = "all";
  let newsCategory = "all";
  let newsSearch = "";
  let newsCompany = "all";
  let newsSource = "english";
  let workbenchMode = "review";
  let selectedInsightId = null;
  let reviewView = "today";
  let selectedReviewId = null;
  let numberLens = "all";
  let dynamicFocusId = null;
  let modelFocusId = null;
  let chinaNandFocusId = "ymtc";
  let managementStrategyFocusId = "hbm-premium";
  let strategicDecisionFocusId = "hbm-packaging-jv";
  let projectionFocusId = "ai-server";
  let projectionScenario = "neutral";
  let execDecisionFocusId = "hbm-ai-server";
  let selectedBacktestDate = "";
  let responsePriority = "all";
  let paletteIndex = 0;
  let typeTimer = null;
  let numberOrder = [];
  let numberFolded = {};
  let draggedNumberId = null;

  async function loadJSON(path, fallback) {
    try {
      const res = await fetch(path, { cache: "no-store" });
      if (!res.ok) throw new Error(`${path} ${res.status}`);
      return await res.json();
    } catch (error) {
      console.warn(error.message);
      return fallback;
    }
  }

  async function init() {
    [BASE, LIVE, HISTORY] = await Promise.all([
      loadJSON("data/baseline.json", null),
      loadJSON("data/live.json", emptyLive),
      loadJSON("data/price-history.json", emptyHistory),
    ]);

    if (!BASE) {
      document.body.innerHTML = "<main class=\"empty\">baseline.json을 불러오지 못했습니다.</main>";
      return;
    }

    renderChrome();
    renderSidebarCategories();
    renderKpis();
    renderExecutiveDecision();
    renderManagementStrategy();
    renderStrategicInvestmentDecision();
    renderDailyReview();
    renderNumberDashboard();
    renderProductProjection();
    renderCategories();
    renderChannels();
    renderCompanies();
    renderDynamics();
    renderModels();
    renderResponses();
    renderCrawlerBoard();
    renderArchitectureMatrix();
    renderPrices();
    renderNews();
    renderChinaNandBusiness();
    renderChinaDynamics();
    renderTalentRadar();
    renderChinaDeepDive();
    renderWorkbench();
    setupQA();
    setupInteractions();
    setupScrollSpy();
    animateCounts();
    animateMeters();
  }

  function memoryCategories() {
    return visibleItems(BASE.memoryCategories || []);
  }

  function categoryAccent(id) {
    return CATEGORY_ACCENTS[id] || CATEGORY_ACCENTS.all;
  }

  function activeCategoryData() {
    return memoryCategories().find((item) => item.id === activeCategory) || memoryCategories()[0];
  }

  function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
  }

  function fmtDate(iso) {
    if (!iso) return "아직 수집 전";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      dateStyle: "medium",
      timeStyle: "short",
    }) + " KST";
  }

  function fmtNum(value, digits = 0) {
    const n = Number(value);
    if (Number.isNaN(n)) return escapeHTML(value);
    return n.toLocaleString("ko-KR", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }

  function countHTML(value, opts = {}) {
    const n = Number(value);
    if (Number.isNaN(n)) return escapeHTML(value);
    const { prefix = "", suffix = "", decimals = 0 } = opts;
    return `<span class="count" data-to="${n}" data-prefix="${escapeHTML(prefix)}" data-suffix="${escapeHTML(suffix)}" data-decimals="${decimals}">${escapeHTML(prefix)}0${escapeHTML(suffix)}</span>`;
  }

  function clamp(value, min = 0, max = 100) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function itemIds(item = {}) {
    return []
      .concat(item.id || [])
      .concat(item.section || [])
      .concat(item.category || [])
      .concat(item.categories || [])
      .concat(item.linkedCategories || [])
      .concat(item.categoryIds || [])
      .map((id) => String(id || "").toLowerCase());
  }

  function isHiddenItem(item = {}) {
    const ids = itemIds(item);
    if (ids.some((id) => HIDDEN_SECTIONS.has(id) || HIDDEN_CATEGORY_IDS.has(id))) return true;
    const text = `${item.kind || ""} ${item.type || ""} ${item.label || ""} ${item.title || ""}`.toLowerCase();
    return text.includes("corp dev") || text.includes("corpdev");
  }

  function visibleItems(items = []) {
    return items.filter((item) => !isHiddenItem(item));
  }

  function hoursSince(value) {
    if (!value) return Infinity;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return Infinity;
    return (Date.now() - date.getTime()) / 36e5;
  }

  function healthEntries(keys = []) {
    return (LIVE.health || []).filter((entry) => {
      const step = String(entry?.step || "");
      return keys.some((key) => step.startsWith(key) || step.includes(key));
    });
  }

  function freshnessState({ updatedAt, count = 0, healthKeys = [], staleHours = 36 } = {}) {
    const entries = healthEntries(healthKeys);
    const hasFailure = entries.some((entry) => !entry.ok);
    if (!count || hasFailure) return { cls: "fail", label: "Fail" };
    if (hoursSince(updatedAt) > staleHours) return { cls: "stale", label: "Stale" };
    return { cls: "ok", label: "OK" };
  }

  function freshnessHTML({ label, updatedAt, source, count, healthKeys, staleHours }) {
    const state = freshnessState({ updatedAt, count, healthKeys, staleHours });
    const updated = updatedAt ? fmtDate(updatedAt) : "성공 기록 없음";
    const sourceText = source ? ` · ${source}` : "";
    return `<span class="freshness-badge ${state.cls}">${escapeHTML(state.label)} · ${escapeHTML(label)} · ${escapeHTML(updated)}${escapeHTML(sourceText)}</span>`;
  }

  function setFreshness(target, options) {
    const node = typeof target === "string" ? $(target) : target;
    if (!node) return;
    const state = freshnessState(options);
    const updated = options.updatedAt ? fmtDate(options.updatedAt) : "성공 기록 없음";
    const sourceText = options.source ? ` · ${options.source}` : "";
    node.className = `freshness-badge ${state.cls}`;
    node.textContent = `${state.label} · ${options.label} · ${updated}${sourceText}`;
  }

  function factBadge(label, status = "watch") {
    const cls = String(status || "watch").toLowerCase();
    return `<span class="claim-badge ${escapeHTML(cls)}">${escapeHTML(label || status || "검증")}</span>`;
  }

  function animateCounts(root = document) {
    const counts = $$(".count", root);
    const run = (node) => {
      if (node.dataset.done === "1") return;
      node.dataset.done = "1";
      const to = Number(node.dataset.to || 0);
      const prefix = node.dataset.prefix || "";
      const suffix = node.dataset.suffix || "";
      const decimals = Number(node.dataset.decimals || 0);
      const start = performance.now();
      const dur = 850;
      const step = (now) => {
        const k = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - k, 3);
        node.textContent = prefix + fmtNum(to * eased, decimals) + suffix;
        if (k < 1) requestAnimationFrame(step);
        else node.textContent = prefix + fmtNum(to, decimals) + suffix;
      };
      requestAnimationFrame(step);
    };

    if (!("IntersectionObserver" in window)) {
      counts.forEach(run);
      return;
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) run(entry.target);
      });
    }, { threshold: 0.3 });
    counts.forEach((node) => io.observe(node));
  }

  function animateMeters(root = document) {
    const meters = $$("[data-fill-to], [data-score-to]", root);
    const run = (node) => {
      if (node.dataset.meterDone === "1") return;
      node.dataset.meterDone = "1";
      const target = clamp(node.dataset.fillTo ?? node.dataset.scoreTo ?? 0);
      const start = performance.now();
      const dur = Number(node.dataset.meterDur || 1100);
      const step = (now) => {
        const k = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - k, 3);
        const value = target * eased;
        if (node.dataset.fillTo != null) node.style.width = `${value}%`;
        if (node.dataset.scoreTo != null) node.style.setProperty("--score", value);
        if (k < 1) requestAnimationFrame(step);
        else {
          if (node.dataset.fillTo != null) node.style.width = `${target}%`;
          if (node.dataset.scoreTo != null) node.style.setProperty("--score", target);
        }
      };
      requestAnimationFrame(step);
    };

    if (!("IntersectionObserver" in window)) {
      meters.forEach(run);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) run(entry.target);
      });
    }, { threshold: 0.25 });
    meters.forEach((node) => io.observe(node));
  }

  function renderChrome() {
    document.title = BASE.meta?.title || document.title;
    const saved = localStorage.getItem("memory-theme") || "light";
    document.documentElement.dataset.theme = saved;
    const savedPalette = Number(localStorage.getItem("memory-palette-index") || 0);
    applyPalette(savedPalette);
    setSidebarCollapsed(localStorage.getItem("memory-sidebar-collapsed") === "1", { persist: false, cycle: false });
    decorateSidebarItems();
    syncChromeMetrics();
    window.addEventListener("resize", syncChromeMetrics, { passive: true });
    document.fonts?.ready?.then(syncChromeMetrics).catch(() => {});

    $("#themeBtn").addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      localStorage.setItem("memory-theme", next);
    });

    $("#paletteBtn")?.addEventListener("click", () => cyclePalette());
    $("#sidebarFold")?.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleSidebarCollapsed();
    });
    $("#sidebar")?.addEventListener("click", (event) => {
      if (event.target.closest("button, a, input, select")) return;
      if (window.matchMedia?.("(max-width: 980px)")?.matches) {
        document.body.classList.remove("menu-open");
        cyclePalette();
        return;
      }
      toggleSidebarCollapsed();
    });
  }

  function syncChromeMetrics() {
    const topbar = $(".topbar");
    if (!topbar) return;
    const height = Math.ceil(topbar.getBoundingClientRect().height || 64);
    document.documentElement.style.setProperty("--topbar-h", `${height}px`);
  }

  function chromeOffset() {
    const raw = getComputedStyle(document.documentElement).getPropertyValue("--topbar-h");
    const height = Number.parseFloat(raw);
    return Number.isFinite(height) ? height + 18 : 82;
  }

  function normalizePaletteIndex(index) {
    const n = Number(index);
    if (!Number.isFinite(n)) return 0;
    return ((Math.trunc(n) % COLOR_PRESETS.length) + COLOR_PRESETS.length) % COLOR_PRESETS.length;
  }

  function applyPalette(index, options = {}) {
    paletteIndex = normalizePaletteIndex(index);
    const palette = COLOR_PRESETS[paletteIndex] || COLOR_PRESETS[0];
    const root = document.documentElement;
    root.style.setProperty("--sidebar", palette.sidebar);
    root.style.setProperty("--sidebar-hi", palette.sidebarHi);
    root.style.setProperty("--sidebar-low", palette.sidebarLow);
    root.style.setProperty("--accent", palette.accent);
    root.style.setProperty("--brand", palette.accent);
    root.style.setProperty("--blue", palette.blue);
    root.style.setProperty("--teal", palette.teal);
    root.style.setProperty("--purple", palette.purple);
    root.style.setProperty("--green", palette.green);
    root.dataset.palette = palette.name.toLowerCase();
    localStorage.setItem("memory-palette-index", String(paletteIndex));

    const btn = $("#paletteBtn");
    if (btn) {
      btn.title = `색상 변경 · ${palette.name}`;
      btn.setAttribute("aria-label", `색상 변경 · ${palette.name}`);
      if (options.pulse) {
        btn.classList.remove("is-cycling");
        void btn.offsetWidth;
        btn.classList.add("is-cycling");
        window.setTimeout(() => btn.classList.remove("is-cycling"), 480);
      }
    }
  }

  function cyclePalette() {
    applyPalette(paletteIndex + 1, { pulse: true });
  }

  function setSidebarCollapsed(collapsed, options = {}) {
    const shouldCollapse = Boolean(collapsed);
    document.body.classList.toggle("sidebar-collapsed", shouldCollapse);
    if (options.persist !== false) {
      localStorage.setItem("memory-sidebar-collapsed", shouldCollapse ? "1" : "0");
    }
    const btn = $("#sidebarFold");
    if (btn) {
      btn.setAttribute("aria-label", shouldCollapse ? "사이드바 펼치기" : "사이드바 접기");
      btn.title = shouldCollapse ? "사이드바 펼치기 · 색상 변경" : "사이드바 접기 · 색상 변경";
    }
    if (options.cycle) cyclePalette();
  }

  function toggleSidebarCollapsed() {
    setSidebarCollapsed(!document.body.classList.contains("sidebar-collapsed"), { cycle: true });
  }

  function decorateSidebarItems() {
    $$(".sb-item").forEach((btn) => {
      const id = btn.dataset.jump || "";
      const accent = NAV_ACCENTS[id] || "rgba(255,255,255,.92)";
      btn.style.setProperty("--nav-active", accent);
      const label = btn.querySelector(".sb-label strong")?.textContent?.trim();
      if (label) btn.title = label;
    });
  }

  function renderSidebarCategories() {
    const wrap = $("#sideCategories");
    wrap.innerHTML = "";
    memoryCategories().forEach((category) => {
      const btn = el("button", `sb-cat${category.id === activeCategory ? " active" : ""}`);
      btn.type = "button";
      btn.dataset.category = category.id;
      btn.style.setProperty("--local-accent", categoryAccent(category.id));
      btn.innerHTML = `<span>${escapeHTML(category.label)}</span><small>${escapeHTML(category.en)}</small>`;
      btn.addEventListener("click", () => {
        setCategory(category.id);
        jumpTo("categories");
      });
      wrap.appendChild(btn);
    });
  }

  function setCategory(id) {
    activeCategory = HIDDEN_CATEGORY_IDS.has(String(id || "").toLowerCase()) ? "all" : id;
    const cat = activeCategoryData();
    $("#categoryMeta").textContent = `${cat.label} · ${cat.desc}`;
    $$(".sb-cat").forEach((btn) => btn.classList.toggle("active", btn.dataset.category === id));
    renderDailyReview();
    renderExecutiveDecision();
    renderNumberDashboard();
    renderProductProjection();
    renderCategories();
    renderChannels();
    renderCompanies();
    renderDynamics();
    renderModels();
    renderNews();
    renderCrawlerBoard();
    renderArchitectureMatrix();
    renderChinaDeepDive();
    renderTalentRadar();
    renderChinaNandBusiness();
    renderWorkbench();
    animateCounts();
    animateMeters();
  }

  function executiveStrategyLines() {
    const nandRows = nandPriceRows().length;
    const chinaSignals = CHINA_NAND_BUSINESS_LAYERS.reduce((sum, item) => sum + nandBusinessSignalCount(item), 0);
    return [
      {
        label: "중국 업체 전략",
        title: "YMTC는 NAND/eSSD, CXMT는 DRAM 가격, XMC·JCET는 패키징 우회로",
        body: "중국 메모리 전략은 한 업체의 단일 추격이 아니라 NAND 기술, DRAM 캐파, 후공정, 장비 국산화, 정책자본이 분업하는 구조입니다.",
        jump: "china-nand",
        value: chinaSignals,
        unit: "signal",
      },
      {
        label: "NAND 비즈니스",
        title: "TrendForce 가격과 YMTC/XMC 신호를 매일 먼저 확인",
        body: "NAND contract/spot, eSSD 고객, Xtacking 세대, 우한 Phase 3, 국산 장비 qual을 묶어 가격 하방과 고객 침투를 판단합니다.",
        jump: "prices",
        value: nandRows,
        unit: "rows",
      },
      {
        label: "제품군 프로젝션",
        title: "30개월 후부터 5년간 서버향·단말향 믹스 변화를 추적",
        body: "현재 크롤링된 HBM, NAND/eSSD, 단말, 중국 캐파 신호를 반영해 SK하이닉스 제품군의 수요처별 시나리오를 매일 갱신합니다.",
        jump: "projection",
        value: projectionTotalSignals(),
        unit: "signals",
      },
      {
        label: "필요 업무",
        title: "기회 발굴·전략 수립·포트폴리오·실사·수익성 관리",
        body: "첨부 이미지의 사업개발 업무 항목은 중국 NAND 관점에서 후보 발굴, 제휴/계약 구조, 모델링, value-up, 리스크 대응 체크리스트로 반영했습니다.",
        jump: "china-nand",
        value: NAND_BUSINESS_WORKFLOWS.length,
        unit: "checks",
      },
    ];
  }

  function renderExecutiveSummary() {
    const brief = $("#execBrief");
    const strategy = $("#execStrategy");
    if (!brief || !strategy) return;
    const health = LIVE.health || [];
    const ok = health.filter((entry) => entry.ok).length;
    const status = freshnessState({
      updatedAt: LIVE.updatedAt,
      count: rawNews().length + allPriceRows().length + health.length,
      healthKeys: ["뉴스", "가격:"],
      staleHours: 36,
    });
    setFreshness("#execFreshness", {
      label: "Executive Summary",
      updatedAt: LIVE.updatedAt,
      source: "daily crawler",
      count: rawNews().length + allPriceRows().length + health.length,
      healthKeys: ["뉴스", "가격:"],
      staleHours: 36,
    });

    const cards = [
      { label: "수집 상태", value: `${ok}/${health.length}`, note: status.label, jump: "crawler" },
      { label: "NAND 가격", value: nandPriceRows().length, note: "Spot·contract rows", jump: "prices" },
      { label: "중국 기사", value: rawNews().filter(isChinaArticle).length, note: "중국어·중국 관련", jump: "news" },
      { label: "제품 예측", value: projectionTotalSignals(), note: "30M+5Y 신호", jump: "projection" },
      { label: "사업 체크", value: NAND_BUSINESS_WORKFLOWS.length, note: "전략 업무 항목", jump: "china-nand" },
    ];
    brief.innerHTML = `
      <div class="exec-card-grid">
        ${cards.map((card) => `
          <button class="exec-stat reveal" type="button" data-jump="${escapeHTML(card.jump)}">
            <span>${escapeHTML(card.label)}</span>
            <strong>${typeof card.value === "number" ? countHTML(card.value) : escapeHTML(card.value)}</strong>
            <small>${escapeHTML(card.note)}</small>
          </button>
        `).join("")}
      </div>
      <div class="exec-bullets">
        ${executiveStrategyLines().map((item) => `
          <button class="exec-line reveal" type="button" data-jump="${escapeHTML(item.jump)}">
            <span>${escapeHTML(item.label)}</span>
            <strong>${escapeHTML(item.title)}</strong>
            <p>${escapeHTML(item.body)}</p>
          </button>
        `).join("")}
      </div>
    `;

    strategy.innerHTML = CHINA_NAND_BUSINESS_LAYERS.slice(0, 6).map((item, index) => `
      <button class="exec-strategy-card reveal" type="button" data-exec-nand="${escapeHTML(item.id)}" style="--local-accent:${categoryAccent((item.linkedCategories || [])[0])}; animation-delay:${index * 30}ms">
        <span>${escapeHTML(item.label)}</span>
        <strong>${escapeHTML(item.role)}</strong>
        <small>${escapeHTML(item.strategy[0] || item.title)}</small>
      </button>
    `).join("");

    brief.querySelectorAll("[data-jump]").forEach((btn) => btn.addEventListener("click", () => jumpTo(btn.dataset.jump)));
    strategy.querySelectorAll("[data-exec-nand]").forEach((btn) => {
      btn.addEventListener("click", () => {
        chinaNandFocusId = btn.dataset.execNand;
        renderChinaNandBusiness();
        jumpTo("china-nand");
      });
    });
    animateCounts(brief);
  }

  function renderKpis() {
    renderExecutiveSummary();
    const strip = $("#kpiStrip") || $("#overview");
    strip.innerHTML = "";
    (BASE.kpis || []).slice(0, 6).forEach((kpi, index) => {
      const node = el("article", "kpi reveal");
      node.style.animationDelay = `${index * 35}ms`;
      node.innerHTML = `
        <span>${escapeHTML(kpi.label)}</span>
        <strong>${countHTML(kpi.value, {
          prefix: kpi.prefix || "",
          suffix: kpi.suffix || "",
          decimals: kpi.decimals || 0,
        })}</strong>
        <div class="kpi-meta">
          ${factBadge(kpi.badge || kpi.status || "OK", kpi.statusClass || kpi.status || "ok")}
          ${kpi.sourceDate ? `<span class="source-tag">${escapeHTML(kpi.sourceDate)}</span>` : ""}
        </div>
        <small>${escapeHTML(kpi.note)}</small>
        ${kpi.alt ? `<em class="kpi-alt">${escapeHTML(kpi.alt)}</em>` : ""}
      `;
      strip.appendChild(node);
    });
  }

  function setCopyState(button, label = "복사됨") {
    if (!button) return;
    const original = button.dataset.originalText || button.textContent || "복사";
    button.dataset.originalText = original;
    button.classList.add("copied");
    button.textContent = label;
    window.setTimeout(() => {
      button.classList.remove("copied");
      button.textContent = original;
    }, 1100);
  }

  async function copyTextToClipboard(text, button) {
    const value = String(text || "").trim();
    if (!value) return;
    try {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(value);
          setCopyState(button);
          return;
        } catch {
          // Fall through to the legacy path for localhost and embedded browsers.
        }
      }
      const area = document.createElement("textarea");
      area.value = value;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      if (!ok) throw new Error("execCommand copy returned false");
      setCopyState(button);
    } catch (error) {
      console.warn("copy failed", error);
      showCopyFallback(value);
      setCopyState(button, "복사 준비");
    }
  }

  function showCopyFallback(value) {
    let panel = $(".copy-fallback");
    if (!panel) {
      panel = el("div", "copy-fallback", `
        <div class="copy-fallback-head">
          <strong>복사 텍스트</strong>
          <button type="button" data-copy-fallback-close>닫기</button>
        </div>
        <textarea readonly></textarea>
      `);
      document.body.appendChild(panel);
      panel.querySelector("[data-copy-fallback-close]")?.addEventListener("click", () => {
        panel.hidden = true;
      });
    }
    const area = panel.querySelector("textarea");
    area.value = value;
    panel.hidden = false;
    area.focus();
    area.select();
  }

  function payloadPlainText(payload) {
    const data = normalizePayload(payload);
    const lines = [
      `[${data.type}] ${data.title}`,
      data.body,
    ];
    if (data.metrics.length) {
      lines.push("", "숫자/지표");
      data.metrics.forEach((metric) => {
        lines.push(`- ${metric.label || "Metric"}: ${metric.value ?? metric}`);
      });
    }
    if (data.watch.length) {
      lines.push("", "체크포인트");
      data.watch.forEach((item) => lines.push(`- ${item}`));
    }
    if (data.tags.length) lines.push("", `관련 플레이어: ${data.tags.join(" · ")}`);
    if (data.categories.length) lines.push(`카테고리: ${data.categories.map(categoryName).join(" · ")}`);
    return lines.filter((line) => line !== null && line !== undefined).join("\n");
  }

  function copyPayload(payload, button) {
    copyTextToClipboard(payloadPlainText(payload), button);
  }

  function inferKpiCategories(kpi) {
    const hay = `${kpi.label || ""} ${kpi.note || ""} ${kpi.alt || ""}`.toLowerCase();
    const out = [];
    [
      ["hbm", /hbm|premium|ai/],
      ["dram", /dram|ddr|lpddr|cxmt/],
      ["nand", /nand|ssd|ymtc|solidigm/],
      ["packaging", /packaging|tsv|bonder|hybrid/],
      ["equipment", /equipment|tool|naura|amec|localization/],
      ["geopolitics", /wsts|export|sanction|regulation|big fund/],
    ].forEach(([id, re]) => {
      if (re.test(hay)) out.push(id);
    });
    return out;
  }

  function numberDisplayValue(item) {
    const n = Number(item.value);
    if (Number.isNaN(n)) return String(item.value ?? "");
    return `${item.prefix || ""}${fmtNum(n, item.decimals || 0)}${item.suffix || ""}`;
  }

  function numberRelated(item) {
    if (activeCategory === "all") return true;
    const cats = item.linkedCategories || [];
    return !cats.length || cats.includes(activeCategory);
  }

  function numberLensData(id = numberLens) {
    return QUANT_LENSES.find((lens) => lens.id === id) || QUANT_LENSES[0];
  }

  function numberLensRelated(item, lensId = numberLens) {
    const lens = numberLensData(lensId);
    if (!lens || lens.id === "all") return true;
    const cats = item.linkedCategories || [];
    const hay = `${item.kind || ""} ${item.title || ""} ${item.note || ""} ${item.alt || ""} ${item.source || ""}`.toLowerCase();
    const categoryHit = (lens.categories || []).some((id) => cats.includes(id));
    const keywordHit = (lens.keywords || []).some((term) => hay.includes(String(term).toLowerCase()));
    return categoryHit || keywordHit;
  }

  function renderNumberLensControls(allItems) {
    const wrap = $("#numberLensTabs");
    if (!wrap) return;
    wrap.innerHTML = "";
    QUANT_LENSES.forEach((lens) => {
      const count = allItems.filter((item) => numberLensRelated(item, lens.id)).length;
      const btn = el("button", lens.id === numberLens ? "active" : "");
      btn.type = "button";
      btn.dataset.numberLens = lens.id;
      btn.innerHTML = `<strong>${escapeHTML(lens.label)}</strong><small>${escapeHTML(lens.sub)} · ${fmtNum(count)}</small>`;
      btn.addEventListener("click", () => {
        numberLens = lens.id;
        renderNumberDashboard();
      });
      wrap.appendChild(btn);
    });
  }

  function renderNumberLensSummary(items, allItems) {
    const wrap = $("#numberLensSummary");
    if (!wrap) return;
    const lens = numberLensData();
    const ok = items.filter((item) => String(item.statusClass || item.status || "").toLowerCase() === "ok").length;
    const watch = items.filter((item) => /watch|stale/i.test(`${item.statusClass || ""} ${item.status || ""} ${item.badge || ""}`)).length;
    const p1 = dailyReviewItems().filter((item) => (item.priorityBand === "P1" || Number(item.priorityScore || 0) >= 85) && reviewRelated(item)).length;
    const visibleCats = Array.from(new Set(items.flatMap((item) => item.linkedCategories || []))).filter(Boolean);
    const topCat = visibleCats.slice(0, 3).map(categoryName).join(" · ") || activeCategoryData()?.label || "전체";
    const cards = [
      { label: "Lens", value: lens.label, note: lens.sub },
      { label: "Visible KPI", value: items.length, note: `${fmtNum(allItems.length)}개 중 선택` },
      { label: "OK / Watch", value: `${ok}/${watch}`, note: "출처·전망 버전 상태" },
      { label: "P1 queue", value: p1, note: "일일 리뷰 큐와 연결" },
      { label: "Topic", value: topCat, note: "정량 탭 분류 축" },
    ];
    wrap.innerHTML = cards.map((card) => `
      <article class="number-lens-card">
        <span>${escapeHTML(card.label)}</span>
        <strong>${typeof card.value === "number" ? countHTML(card.value) : escapeHTML(card.value)}</strong>
        <small>${escapeHTML(card.note)}</small>
      </article>
    `).join("");
  }

  function dailyReviewData() {
    return BASE.dailyReview || {
      summary: [],
      facets: [],
      schemaFields: [],
      queueSeed: [],
      savedViews: [
        { id: "today", label: "Today" },
        { id: "changed", label: "Changed" },
        { id: "p1", label: "P1" },
        { id: "pipeline", label: "Pipeline" },
      ],
    };
  }

  function reviewRelated(item) {
    if (activeCategory === "all") return true;
    const cats = item.linkedCategories || item.categories || [];
    return !cats.length || cats.includes("all") || cats.includes(activeCategory);
  }

  function reviewShortDate(value) {
    if (!value) return "수집 대기";
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return `${date.getMonth() + 1}/${date.getDate()}일`;
    return formatNewsDate(value) || String(value);
  }

  function reviewPriorityClass(priority = "P3") {
    return String(priority || "P3").toLowerCase().replace(/[^a-z0-9-]/g, "");
  }

  function reviewStatusClass(status = "New") {
    return String(status || "New").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  }

  function reviewViewMatches(item) {
    if (reviewView === "changed") return /changed|updated|diff|metric/i.test(item.changeType || "");
    if (reviewView === "p1") return item.priorityBand === "P1" || Number(item.priorityScore || 0) >= 85;
    if (reviewView === "pipeline") return item.primaryType === "pipeline" || item.primaryType === "price" || item.pipelineAlert;
    return true;
  }

  function liveReviewItems() {
    const health = LIVE.health || [];
    const ok = health.filter((entry) => entry.ok).length;
    const fail = Math.max(health.length - ok, 0);
    const priceRows = allPriceRows();
    const pricesState = freshnessState({
      updatedAt: LIVE.prices?.updatedAt || LIVE.updatedAt,
      count: priceRows.length,
      healthKeys: ["가격:"],
      staleHours: 30,
    });
    const news = rawNews();
    const chinaNews = news.filter(isChinaArticle);
    const englishNews = news.filter((item) => !isChinaArticle(item));
    const newsState = freshnessState({
      updatedAt: LIVE.updatedAt,
      count: news.length,
      healthKeys: ["뉴스", "외신", "중국"],
      staleHours: 36,
    });
    const categorySignals = categorySignalTotal();
    const benchmarkSignals = benchmarkSignalTotal();
    const firstNews = news[0];
    const items = [
      {
        id: "live-news-digest",
        primaryType: "news",
        priorityBand: newsState.cls === "fail" ? "P1" : "P2",
        priorityScore: newsState.cls === "fail" ? 88 : 74,
        reviewStatus: newsState.cls === "fail" ? "In Review" : "New",
        changeType: "New",
        title: `영어권 ${fmtNum(englishNews.length)}건 · 중국어 ${fmtNum(chinaNews.length)}건 기사 검토`,
        summary: "중복 제거 후 노출되는 외신·중국 기사 묶음을 당일 digest로 검토합니다. 기사 탭에서 업체 드롭다운과 언어 탭을 함께 확인하세요.",
        source: "Google News RSS / curated foreign & China sources",
        sourceUrl: firstNews?.link || "",
        publishedAt: firstNews?.date || LIVE.updatedAt,
        crawledAt: LIVE.updatedAt,
        section: "news",
        linkedCategories: ["china", "dram", "nand", "hbm", "geopolitics"],
        topics: ["News", "China", "Memory"],
        entities: ["CXMT", "YMTC", "SK hynix", "Samsung", "Micron"],
        insights: [
          `화면 노출 뉴스는 ${fmtNum(news.length)}건이며 중국어 기사 ${fmtNum(chinaNews.length)}건, 영어권 기사 ${fmtNum(englishNews.length)}건으로 분리됩니다.`,
          "동일 보도 재전송은 canonical URL과 제목 fingerprint 기준 exact/near dedupe로 확장해야 합니다.",
          "P1 승격 후보는 가격, 수출통제, 고객계약, 캐파 증설, 수율·패키징 병목 기사입니다.",
        ],
        metrics: [
          { label: "News", value: `${fmtNum(news.length)}건` },
          { label: "China", value: `${fmtNum(chinaNews.length)}건` },
          { label: "Status", value: newsState.label },
        ],
      },
      {
        id: "live-price-freshness",
        primaryType: "price",
        priorityBand: pricesState.cls === "fail" ? "P1" : "P2",
        priorityScore: pricesState.cls === "fail" ? 91 : 78,
        reviewStatus: pricesState.cls === "fail" ? "In Review" : "New",
        changeType: priceRows.length ? "Changed" : "Pipeline alert",
        title: `TrendForce Spot/Contract 가격 freshness와 rows 검토`,
        summary: "메모리 현물가와 계약가 rows가 비어 있거나 stale이면 전일/관찰 품목 폴백과 수집 실패 UI를 함께 확인해야 합니다.",
        source: LIVE.prices?.source || "TrendForce / DRAMeXchange",
        sourceUrl: LIVE.prices?.sourceUrl || "https://www.trendforce.com/",
        publishedAt: LIVE.prices?.updatedAt || LIVE.updatedAt,
        crawledAt: LIVE.updatedAt,
        section: "prices",
        linkedCategories: ["dram", "nand"],
        topics: ["Spot price", "Contract price", "Freshness"],
        entities: ["TrendForce", "DRAMeXchange"],
        pipelineAlert: pricesState.cls !== "ok",
        insights: [
          `현재 가격 rows는 ${fmtNum(priceRows.length)}개이며 상태는 ${pricesState.label}입니다.`,
          "Spot은 단기 유통 재고, Contract는 분기 협상력과 제품 믹스의 결과로 분리해서 봐야 합니다.",
          "Rows가 0이면 공개 테이블 구조 변경, 접근 실패, 수집 실패 중 어느 단계인지 pipeline health를 먼저 봅니다.",
        ],
        metrics: [
          { label: "Rows", value: `${fmtNum(priceRows.length)}개` },
          { label: "Status", value: pricesState.label },
          { label: "Updated", value: reviewShortDate(LIVE.prices?.updatedAt || LIVE.updatedAt) },
        ],
      },
      {
        id: "live-pipeline-health",
        primaryType: "pipeline",
        priorityBand: fail ? "P1" : "P3",
        priorityScore: fail ? 94 : 58,
        reviewStatus: fail ? "In Review" : "Confirmed",
        changeType: fail ? "Pipeline alert" : "OK",
        title: `수집 파이프라인 health ${ok}/${health.length}`,
        summary: "가격, 뉴스, 벤치마킹, 한글 인사이트 단계별 성공/실패를 먼저 확인해 오늘 digest의 신뢰도를 판정합니다.",
        source: "GitHub Actions daily crawler",
        sourceUrl: "https://github.com/dicacros-gif/memory/actions",
        publishedAt: LIVE.updatedAt,
        crawledAt: LIVE.updatedAt,
        section: "crawler",
        linkedCategories: ["operations", "geopolitics"],
        topics: ["Pipeline", "Freshness", "Observability"],
        entities: ["GitHub Actions", "live.json", "price-history.json"],
        pipelineAlert: Boolean(fail),
        insights: [
          fail ? `${fmtNum(fail)}개 단계가 점검 대상입니다. 실패 단계의 msg를 먼저 확인하세요.` : "현재 health 단계는 정상입니다.",
          `뉴스 원천 신호 ${fmtNum(categorySignals)}개, 벤치마킹 신호 ${fmtNum(benchmarkSignals)}개를 downstream 보드로 분배합니다.`,
          "다음 단계는 source-level freshness, parse success rate, duplicate ratio를 별도 KPI로 저장하는 것입니다.",
        ],
        metrics: [
          { label: "Health", value: `${ok}/${health.length}` },
          { label: "Fail", value: `${fmtNum(fail)}개` },
          { label: "Updated", value: reviewShortDate(LIVE.updatedAt) },
        ],
      },
    ];
    return items;
  }

  function dailyReviewItems() {
    const seed = dailyReviewData().queueSeed || [];
    return visibleItems(seed.concat(liveReviewItems()))
      .map((item) => ({
        ...item,
        categories: item.linkedCategories || item.categories || [],
        body: item.summary || item.body || "",
      }))
      .filter(reviewRelated)
      .sort((a, b) => Number(b.priorityScore || 0) - Number(a.priorityScore || 0));
  }

  function renderDailyReview() {
    const summary = $("#reviewSummary");
    const controls = $("#reviewControls");
    const queue = $("#reviewQueue");
    const detail = $("#reviewDetail");
    const schema = $("#reviewSchema");
    if (!summary || !controls || !queue || !detail || !schema) return;

    const allItems = dailyReviewItems();
    const items = allItems.filter(reviewViewMatches);
    if (!items.some((item) => item.id === selectedReviewId)) selectedReviewId = items[0]?.id || null;
    const selected = items.find((item) => item.id === selectedReviewId) || items[0] || null;
    const data = dailyReviewData();
    const newCount = allItems.filter((item) => /new/i.test(item.changeType || "") || item.reviewStatus === "New").length;
    const changedCount = allItems.filter((item) => /changed|updated|diff|metric/i.test(item.changeType || "")).length;
    const p1Count = allItems.filter((item) => item.priorityBand === "P1" || Number(item.priorityScore || 0) >= 85).length;
    const pipelineCount = allItems.filter((item) => item.pipelineAlert || item.primaryType === "pipeline").length;
    const topTopics = Array.from(new Set(allItems.flatMap((item) => item.topics || []))).slice(0, 4).join(" · ") || "HBM · DRAM · NAND · China";
    const meta = $("#reviewMeta");
    if (meta) {
      const state = freshnessState({
        updatedAt: LIVE.updatedAt,
        count: rawNews().length + allPriceRows().length + (LIVE.health || []).length,
        healthKeys: ["뉴스", "가격:", "벤치마킹"],
        staleHours: 36,
      });
      meta.className = `freshness-badge ${state.cls}`;
      meta.textContent = `${state.label} · 리뷰 큐 · ${fmtDate(LIVE.updatedAt)} · ${fmtNum(allItems.length)}개`;
    }

    const cards = [
      { label: "New since last review", value: newCount, note: "새로 들어온 기사·가격·수집 신호" },
      { label: "Changed items", value: changedCount, note: "수치·상태·중요도 변경 재검토" },
      { label: "P1 queue", value: p1Count, note: "사업 영향·신규성·출처 신뢰도 상위" },
      { label: "Pipeline alerts", value: pipelineCount, note: "수집 실패·stale·rows 없음" },
      { label: "Topic snapshot", value: topTopics, note: activeCategoryData()?.label || "전체 카테고리" },
    ];
    summary.innerHTML = cards.map((card) => `
      <article class="review-stat">
        <span>${escapeHTML(card.label)}</span>
        <strong>${typeof card.value === "number" ? countHTML(card.value) : escapeHTML(card.value)}</strong>
        <small>${escapeHTML(card.note)}</small>
      </article>
    `).join("");

    const views = data.savedViews || [];
    controls.innerHTML = views.map((view) => {
      const viewCount = allItems.filter((item) => {
        if (view.id === "today") return true;
        if (view.id === "changed") return /changed|updated|diff|metric/i.test(item.changeType || "");
        if (view.id === "p1") return item.priorityBand === "P1" || Number(item.priorityScore || 0) >= 85;
        if (view.id === "pipeline") return item.pipelineAlert || item.primaryType === "pipeline" || item.primaryType === "price";
        return true;
      }).length;
      return `<button type="button" class="${view.id === reviewView ? "active" : ""}" data-review-view="${escapeHTML(view.id)}">
        <strong>${escapeHTML(view.label)}</strong><small>${fmtNum(viewCount)}</small>
      </button>`;
    }).join("");
    controls.querySelectorAll("[data-review-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        reviewView = btn.dataset.reviewView || "today";
        selectedReviewId = null;
        renderDailyReview();
      });
    });

    queue.innerHTML = "";
    if (!items.length) {
      queue.appendChild(el("div", "empty", "선택한 view와 카테고리에 맞는 리뷰 항목이 없습니다."));
    }
    items.forEach((item, index) => {
      const card = el("article", `review-item reveal${item.id === selected?.id ? " active" : ""}`);
      card.style.animationDelay = `${index * 25}ms`;
      card.style.setProperty("--local-accent", categoryAccent((item.linkedCategories || [])[0]));
      card.dataset.reviewId = item.id;
      card.innerHTML = `
        <div class="review-item-main">
          <div class="review-item-head">
            <span class="review-priority ${reviewPriorityClass(item.priorityBand)}">${escapeHTML(item.priorityBand || "P3")}</span>
            <span class="review-status ${reviewStatusClass(item.reviewStatus)}">${escapeHTML(item.reviewStatus || "New")}</span>
            <span class="review-change">${escapeHTML(item.changeType || "New")}</span>
            <span class="review-score">${fmtNum(item.priorityScore || 0)}</span>
          </div>
          <h3>${escapeHTML(item.title)}</h3>
          <p>${escapeHTML(clipText(item.summary || item.body || "", 142))}</p>
          <div class="review-item-foot">
            <span>${escapeHTML(item.primaryType || "item")}</span>
            <span>${escapeHTML(item.source || "source")}</span>
            <span>${escapeHTML(reviewShortDate(item.publishedAt || item.crawledAt))}</span>
          </div>
        </div>
      `;
      card.addEventListener("click", () => {
        selectedReviewId = item.id;
        renderDailyReview();
      });
      queue.appendChild(card);
    });

    renderReviewDetail(selected);

    schema.innerHTML = `
      ${(data.facets || []).map((facet) => `
        <article class="review-schema-card">
          <span>${escapeHTML(facet.axis)}</span>
          <strong>${escapeHTML(facet.rule)}</strong>
          <p>${(facet.values || []).map(escapeHTML).join(" · ")}</p>
        </article>
      `).join("")}
      ${(data.schemaFields || []).slice(0, 4).map((group) => `
        <article class="review-schema-card muted">
          <span>${escapeHTML(group.group)}</span>
          <strong>${escapeHTML((group.fields || []).slice(0, 3).join(" · "))}</strong>
          <p>${escapeHTML(group.purpose || "item-level provenance")}</p>
        </article>
      `).join("")}
    `;
    animateCounts(summary);
  }

  function renderReviewDetail(item) {
    const detail = $("#reviewDetail");
    if (!detail) return;
    if (!item) {
      detail.innerHTML = `<div class="empty">리뷰 항목을 선택하면 provenance, diff, 우선순위 근거가 열립니다.</div>`;
      return;
    }
    const data = dailyReviewData();
    const formula = data.priorityFormula || {};
    const weights = formula.weights || {};
    const categories = (item.linkedCategories || item.categories || []).map(categoryName).filter(Boolean);
    detail.style.setProperty("--local-accent", categoryAccent((item.linkedCategories || [])[0]));
    detail.innerHTML = `
      <div class="review-detail-head">
        <span class="review-priority ${reviewPriorityClass(item.priorityBand)}">${escapeHTML(item.priorityBand || "P3")}</span>
        <span class="review-status ${reviewStatusClass(item.reviewStatus)}">${escapeHTML(item.reviewStatus || "New")}</span>
        <h3>${escapeHTML(item.title)}</h3>
        <p>${escapeHTML(item.summary || item.body || "")}</p>
      </div>
      <div class="metric-row">${metricCards(item.metrics || [], 4)}</div>
      <div class="review-detail-block">
        <strong>3줄 인사이트</strong>
        <ul class="watch-list">${(item.insights || []).slice(0, 3).map((line) => `<li>${escapeHTML(line)}</li>`).join("")}</ul>
      </div>
      <div class="review-detail-grid">
        <div>
          <span>Primary type</span>
          <strong>${escapeHTML(item.primaryType || "item")}</strong>
        </div>
        <div>
          <span>Published</span>
          <strong>${escapeHTML(reviewShortDate(item.publishedAt))}</strong>
        </div>
        <div>
          <span>Crawled</span>
          <strong>${escapeHTML(reviewShortDate(item.crawledAt || LIVE.updatedAt))}</strong>
        </div>
        <div>
          <span>Score</span>
          <strong>${fmtNum(item.priorityScore || 0)}</strong>
        </div>
      </div>
      <div class="review-detail-block">
        <strong>카테고리 · 엔티티</strong>
        <div class="tag-row">
          ${categories.map((name) => `<span class="tag">${escapeHTML(name)}</span>`).join("") || "<span class=\"tag\">전체</span>"}
          ${(item.entities || []).slice(0, 5).map((entity) => `<span class="tag">${escapeHTML(entity)}</span>`).join("")}
        </div>
      </div>
      <div class="review-formula">
        <strong>Priority formula</strong>
        <p>${escapeHTML(formula.expression || "impact + novelty + source reliability - duplicate penalty")}</p>
        <div>${Object.entries(weights).map(([key, value]) => `<span>${escapeHTML(key)} ${escapeHTML(value)}</span>`).join("")}</div>
      </div>
      <div class="review-detail-actions">
        <button type="button" data-review-copy>복사</button>
        <button type="button" data-review-inspector>상세 패널</button>
        <button type="button" data-review-jump="${escapeHTML(item.section || "daily-review")}">관련 보드</button>
        ${item.sourceUrl ? `<a href="${escapeHTML(item.sourceUrl)}" target="_blank" rel="noopener">원문</a>` : ""}
      </div>
    `;
    detail.querySelector("[data-review-copy]")?.addEventListener("click", (event) => copyPayload(item, event.currentTarget));
    detail.querySelector("[data-review-inspector]")?.addEventListener("click", () => openInspector(item));
    detail.querySelector("[data-review-jump]")?.addEventListener("click", (event) => jumpTo(event.currentTarget.dataset.reviewJump));
  }

  function numberDashboardItems() {
    const health = LIVE.health || [];
    const ok = health.filter((entry) => entry.ok).length;
    const fail = Math.max(health.length - ok, 0);
    const priceState = freshnessState({
      updatedAt: LIVE.prices?.updatedAt || LIVE.updatedAt,
      count: allPriceRows().length,
      healthKeys: ["가격:"],
      staleHours: 30,
    });
    const newsState = freshnessState({
      updatedAt: LIVE.updatedAt,
      count: rawNews().length,
      healthKeys: ["뉴스", "외신", "중국"],
      staleHours: 36,
    });
    const baseItems = (BASE.kpis || []).map((kpi, index) => ({
      id: `kpi-${index}`,
      kind: "KPI",
      title: kpi.label,
      value: kpi.value,
      prefix: kpi.prefix || "",
      suffix: kpi.suffix || "",
      decimals: kpi.decimals || 0,
      note: kpi.note,
      alt: kpi.alt,
      badge: kpi.badge || kpi.status || "KPI",
      statusClass: kpi.statusClass || kpi.status || "watch",
      source: kpi.source || "baseline",
      sourceDate: kpi.sourceDate || "",
      sourceUrl: kpi.sourceUrl || "",
      linkedCategories: kpi.linkedCategories || inferKpiCategories(kpi),
    }));
    const liveItems = [
      {
        id: "live-price-rows",
        kind: "Crawler",
        title: "Spot / Contract 가격 rows",
        value: allPriceRows().length,
        suffix: "건",
        note: `${fmtNum(LIVE.prices?.sections?.length || 0)}개 TrendForce 표 · 품목별 rows 기준`,
        badge: priceState.label,
        statusClass: priceState.cls,
        source: "TrendForce crawler",
        sourceDate: fmtDate(LIVE.prices?.updatedAt || LIVE.updatedAt),
        linkedCategories: ["dram", "nand"],
      },
      {
        id: "live-foreign-news",
        kind: "News",
        title: "영어권 기사",
        value: rawNews().filter((item) => !isChinaArticle(item)).length,
        suffix: "건",
        note: "Reuters · Bloomberg · FT · TrendForce · TechInsights 중심",
        badge: newsState.label,
        statusClass: newsState.cls,
        source: "foreign news crawler",
        sourceDate: fmtDate(LIVE.updatedAt),
        linkedCategories: ["hbm", "dram", "nand", "packaging", "geopolitics"],
      },
      {
        id: "live-china-news",
        kind: "News",
        title: "중국어 기사",
        value: rawNews().filter(isChinaArticle).length,
        suffix: "건",
        note: "财新 · 第一财经 · 集微网 · 观察者网 등 중국 생태계 신호",
        badge: newsState.label,
        statusClass: newsState.cls,
        source: "china news crawler",
        sourceDate: fmtDate(LIVE.updatedAt),
        linkedCategories: ["china", "dram", "nand", "equipment", "packaging"],
      },
      {
        id: "live-crawler-health",
        kind: "Health",
        title: "수집 성공 단계",
        value: ok,
        suffix: `/${health.length}`,
        note: fail ? `${fmtNum(fail)}개 수집 단계 점검 필요` : "가격·뉴스·벤치마킹 수집 단계 정상",
        badge: fail ? "Fail" : "OK",
        statusClass: fail ? "fail" : "ok",
        source: "GitHub Actions daily crawler",
        sourceDate: fmtDate(LIVE.updatedAt),
        linkedCategories: [],
      },
    ];
    const projectionSegments = productProjectionSegments();
    const projectionRows = projectionSeries(projectionSegments);
    const projectionItems = [
      {
        id: "projection-server-share",
        kind: "Projection",
        title: "5년차 서버향 제품 믹스",
        value: projectionGroupShare(projectionRows, ["ai-server", "dc-storage"]),
        suffix: "%",
        decimals: 1,
        note: "AI 서버향 HBM/DDR5/CXL과 데이터센터 eSSD를 합산한 지수형 믹스",
        badge: "30M+5Y",
        statusClass: "watch",
        source: "crawler-derived projection",
        sourceDate: fmtDate(LIVE.updatedAt),
        linkedCategories: ["hbm", "dram", "nand", "aidemand"],
      },
      {
        id: "projection-terminal-share",
        kind: "Projection",
        title: "5년차 단말향 제품 믹스",
        value: projectionGroupShare(projectionRows, ["mobile-pc", "auto-edge"]),
        suffix: "%",
        decimals: 1,
        note: "모바일/PC 단말과 오토·엣지 고신뢰 제품을 합산한 방어형 수요처",
        badge: "30M+5Y",
        statusClass: "watch",
        source: "crawler-derived projection",
        sourceDate: fmtDate(LIVE.updatedAt),
        linkedCategories: ["dram", "nand", "aidemand"],
      },
      {
        id: "projection-signal-total",
        kind: "Projection",
        title: "제품군 프로젝션 입력 신호",
        value: projectionTotalSignals(),
        suffix: "건",
        note: "현재 live.json의 가격 rows, 뉴스, 중국 벤치마킹 신호를 제품군별로 재분류",
        badge: "Live input",
        statusClass: "ok",
        source: "live.json",
        sourceDate: fmtDate(LIVE.updatedAt),
        linkedCategories: ["operations", "china"],
      },
    ];
    return visibleItems(baseItems.concat(liveItems, projectionItems));
  }

  function orderedNumberItems(items) {
    if (!numberOrder.length) {
      try {
        numberOrder = JSON.parse(localStorage.getItem("memory-number-order") || "[]");
      } catch {
        numberOrder = [];
      }
    }
    try {
      numberFolded = JSON.parse(localStorage.getItem("memory-number-folded") || "{}") || {};
    } catch {
      numberFolded = {};
    }
    const ids = items.map((item) => item.id);
    const order = numberOrder.filter((id) => ids.includes(id)).concat(ids.filter((id) => !numberOrder.includes(id)));
    return order.map((id) => items.find((item) => item.id === id)).filter(Boolean);
  }

  function saveNumberPrefs() {
    localStorage.setItem("memory-number-order", JSON.stringify(numberOrder));
    localStorage.setItem("memory-number-folded", JSON.stringify(numberFolded));
  }

  function numberProgress(item) {
    const n = Number(item.value);
    if (Number.isNaN(n)) return 64;
    if (String(item.suffix || "").includes("%")) return Math.max(6, Math.min(100, n));
    if (String(item.statusClass || "").toLowerCase() === "fail") return 22;
    if (String(item.statusClass || "").toLowerCase() === "stale") return 58;
    return Math.max(12, Math.min(100, n * 8));
  }

  function freshnessScore(state, count = 1) {
    if (!count) return 14;
    if (state?.cls === "ok") return 96;
    if (state?.cls === "stale") return 58;
    if (state?.cls === "fail") return 24;
    return 70;
  }

  function workbenchModeForSection(section) {
    return WORKBENCH_MODES.find((mode) => mode.section === section)?.id || "";
  }

  function sectionTelemetry(section) {
    const health = LIVE.health || [];
    const healthOk = health.filter((entry) => entry.ok).length;
    const newsCount = rawNews().length;
    const chinaSignalCount = CHINA_DYNAMIC_AXES.reduce((sum, axis) => sum + axisSignalCount(axis), 0);
    const priceState = freshnessState({
      updatedAt: LIVE.prices?.updatedAt || LIVE.updatedAt,
      count: allPriceRows().length,
      healthKeys: ["가격:"],
      staleHours: 30,
    });
    const newsState = freshnessState({
      updatedAt: LIVE.updatedAt,
      count: newsCount,
      healthKeys: ["뉴스", "외신", "중국"],
      staleHours: 36,
    });
    const talentData = talentRadarData();
    const architecture = architectureMatrix();
    const backtests = executiveBacktests();
    const testedBacktests = backtests.filter((item) => item.outcome.hit !== null);
    const hitBacktests = backtests.filter((item) => item.outcome.hit === true);

    const map = {
      "executive-decision": {
        value: testedBacktests.length,
        unit: `/${backtests.length}`,
        status: "Backtest",
        score: testedBacktests.length ? clamp((hitBacktests.length / testedBacktests.length) * 100, 18, 100) : 18,
        note: "제품군별 실제 가격 백테스트",
      },
      "management-strategy": {
        value: managementStrategyItems().length,
        unit: "테마",
        status: "Strategy",
        score: managementStrategyItems().length ? clamp(managementStrategyItems().reduce((sum, item) => sum + item.score, 0) / managementStrategyItems().length) : 0,
        note: "투자 테마·자본 배분",
      },
      "strategic-investment-decision": {
        value: strategicInvestmentDecisionItems().length,
        unit: "옵션",
        status: "Investment",
        score: strategicInvestmentDecisionItems().length ? clamp(strategicInvestmentDecisionItems().reduce((sum, item) => sum + item.score, 0) / strategicInvestmentDecisionItems().length) : 0,
        note: "투자/JV/방어 판단",
      },
      "daily-review": {
        value: dailyReviewItems().length,
        unit: "개",
        status: "Review",
        score: clamp(dailyReviewItems().length * 7, dailyReviewItems().length ? 30 : 0, 100),
        note: "오늘 검토할 digest queue",
      },
      crawler: {
        value: healthOk,
        unit: `/${health.length}`,
        status: health.length && healthOk === health.length ? "OK" : "Check",
        score: health.length ? clamp((healthOk / health.length) * 100) : 0,
        note: "수집 성공 단계",
      },
      prices: {
        value: allPriceRows().length,
        unit: "rows",
        status: priceState.label,
        score: freshnessScore(priceState, allPriceRows().length),
        note: "Spot·contract 가격 rows",
      },
      news: {
        value: newsCount,
        unit: "건",
        status: newsState.label,
        score: freshnessScore(newsState, newsCount),
        note: "영어권·중국어 기사",
      },
      "china-nand": {
        value: CHINA_NAND_BUSINESS_LAYERS.reduce((sum, item) => sum + nandBusinessSignalCount(item), 0),
        unit: "signal",
        status: "NAND",
        score: clamp(54 + Math.min(CHINA_NAND_BUSINESS_LAYERS.reduce((sum, item) => sum + nandBusinessSignalCount(item), 0), 40)),
        note: "YMTC·XMC·eSSD·장비",
      },
      "china-dynamics": {
        value: chinaSignalCount,
        unit: "signal",
        status: axisMomentum(chinaSignalCount).label,
        score: clamp(chinaSignalCount * 1.35, chinaSignalCount ? 28 : 0, 100),
        note: "캐파·장비·패키징·정책",
      },
      "talent-radar": {
        value: (talentData.companySignals || []).length + (talentData.meceSources || []).length,
        unit: "축",
        status: "Hiring",
        score: clamp(((talentData.companySignals || []).length + (talentData.meceSources || []).length) * 12, 20, 100),
        note: "채용·IP·캠퍼스 신호",
      },
      numbers: {
        value: numberDashboardItems().filter(numberRelated).length,
        unit: "KPI",
        status: "Quant",
        score: clamp(numberDashboardItems().filter(numberRelated).length * 5, 28, 100),
        note: "움직이는 정량 대시보드",
      },
      projection: {
        value: projectionTotalSignals(),
        unit: "signal",
        status: "Projection",
        score: clamp(58 + Math.min(projectionTotalSignals(), 180) * .18),
        note: "30개월 후~5년 제품 믹스",
      },
      workbench: {
        value: WORKBENCH_MODES.length,
        unit: "탭",
        status: "Interactive",
        score: 92,
        note: "선택형 분석 워크벤치",
      },
      "ai-matrix": {
        value: (architecture.tracks || []).length + (architecture.shareMatrix || []).length + (architecture.roadmap || []).length,
        unit: "노드",
        status: "Matrix",
        score: 84,
        note: "HBM·CXL·commodity 프레임",
      },
      "china-deep-dive": {
        value: CHINA_DEEP_DIVE.filter(relatedToActive).length,
        unit: "건",
        status: "Benchmark",
        score: clamp(CHINA_DEEP_DIVE.filter(relatedToActive).length * 12, 26, 100),
        note: "중국 업체 심층 벤치마킹",
      },
      categories: {
        value: Math.max(memoryCategories().length - 1, 0),
        unit: "개",
        status: "분류",
        score: 88,
        note: "메모리 업계 카테고리",
      },
      competitors: {
        value: (BASE.companies || []).filter(relatedToActive).length,
        unit: "사",
        status: "Peer",
        score: clamp((BASE.companies || []).filter(relatedToActive).length * 13, 24, 100),
        note: "CXMT·YMTC·OSAT·장비",
      },
      dynamics: {
        value: (BASE.dynamics || []).filter(relatedToActive).length,
        unit: "축",
        status: "Dynamics",
        score: 82,
        note: "경쟁 다이나믹스 관계 맵",
      },
      monetization: {
        value: (BASE.monetizationModels || []).filter(relatedToActive).length,
        unit: "모델",
        status: "Margin",
        score: 78,
        note: "수익화·가격·믹스 모델",
      },
      response: {
        value: (BASE.responses || []).filter((item) => relatedToActive({ ...item, linkedCategories: responseLinkedCategories(item) })).length,
        unit: "액션",
        status: "Action",
        score: 76,
        note: "SK하이닉스 대응 체크리스트",
      },
      intelligence: {
        value: visibleItems(BASE.channels || []).filter(relatedToActive).length,
        unit: "채널",
        status: "Source",
        score: 72,
        note: "금융·채용·기술분석 채널",
      },
    };
    const item = map[section] || { value: 0, unit: "", status: "Watch", score: 50, note: SECTION_LABELS[section] || section };
    return {
      ...item,
      section,
      label: SECTION_LABELS[section] || section,
      mode: workbenchModeForSection(section),
      score: clamp(item.score),
    };
  }

  function renderNumberLiveRibbon() {
    const wrap = $("#numberLiveRibbon");
    if (!wrap) return;
    const items = ["prices", "news", "projection", "china-nand", "crawler"].map(sectionTelemetry);
    wrap.innerHTML = items.map((item) => `
      <button class="quant-ribbon-card reveal" type="button" data-jump="${escapeHTML(item.section)}" style="--local-accent:${categoryAccent((item.section === "projection" && "hbm") || (item.section === "china-nand" && "nand") || (item.section === "china-dynamics" && "china") || (item.section === "prices" && "dram") || (item.section === "news" && "geopolitics") || "operations")}">
        <span class="score-ring compact" data-score-to="${item.score}" style="--score:0">
          <span class="score-value">${countHTML(Math.round(item.score))}</span>
          <small>/100</small>
        </span>
        <span class="quant-ribbon-copy">
          <small>${escapeHTML(item.status)} · ${escapeHTML(item.note)}</small>
          <strong>${escapeHTML(item.label)}</strong>
          <span>${countHTML(item.value)}${escapeHTML(item.unit)} · ${escapeHTML(fmtDate(LIVE.updatedAt))}</span>
        </span>
      </button>
    `).join("");
    wrap.querySelectorAll("[data-jump]").forEach((btn) => {
      btn.addEventListener("click", () => jumpTo(btn.dataset.jump));
    });
    animateCounts(wrap);
    animateMeters(wrap);
  }

  function numberPlainText(item) {
    return [
      `[${item.kind || "KPI"}] ${item.title}`,
      `값: ${numberDisplayValue(item)}`,
      `상태: ${item.badge || item.statusClass || "Watch"}`,
      `출처: ${item.source || "baseline"}${item.sourceDate ? ` · ${item.sourceDate}` : ""}`,
      item.note ? `요약: ${item.note}` : "",
      item.alt ? `비교: ${item.alt}` : "",
      item.linkedCategories?.length ? `카테고리: ${item.linkedCategories.map(categoryName).join(" · ")}` : "",
    ].filter(Boolean).join("\n");
  }

  function renderNumberDashboard() {
    const grid = $("#numberGrid");
    if (!grid) return;
    const allItems = orderedNumberItems(numberDashboardItems().filter(numberRelated));
    const items = allItems.filter((item) => numberLensRelated(item));
    renderNumberLiveRibbon();
    renderNumberLensControls(allItems);
    renderNumberLensSummary(items, allItems);
    const meta = $("#numberMeta");
    if (meta) meta.textContent = `${numberLensData().label} · ${fmtNum(items.length)}개 지표 · ${activeCategoryData()?.label || "전체"} · ${fmtDate(LIVE.updatedAt)}`;
    grid.innerHTML = "";
    items.forEach((item, index) => {
      const payload = {
        type: item.kind || "숫자 대시보드",
        tag: item.badge,
        title: item.title,
        body: item.note,
        section: "numbers",
        categories: item.linkedCategories || [],
        watch: [item.alt, item.source, item.sourceDate].filter(Boolean),
        metrics: [
          { label: "Value", value: numberDisplayValue(item) },
          { label: "Status", value: item.badge || item.statusClass || "Watch" },
          { label: "Source", value: item.source || "baseline" },
        ],
      };
      const folded = Boolean(numberFolded[item.id]);
      const card = el("article", `number-card reveal${folded ? " folded" : ""}`);
      card.draggable = true;
      card.dataset.numberId = item.id;
      card.style.animationDelay = `${index * 30}ms`;
      card.style.setProperty("--local-accent", categoryAccent((item.linkedCategories || [])[0]));
      card.innerHTML = `
        <div class="number-card-head">
          <span class="chip accent">${escapeHTML(item.kind || "KPI")}</span>
          <div class="number-actions">
            <button class="copy-btn" type="button" data-copy-number="${escapeHTML(item.id)}">복사</button>
            <button class="copy-btn ghost" type="button" data-number-toggle="${escapeHTML(item.id)}" aria-expanded="${folded ? "false" : "true"}">${folded ? "펼치기" : "접기"}</button>
          </div>
        </div>
        <h3>${escapeHTML(item.title)}</h3>
        <strong class="number-value">${countHTML(item.value, {
          prefix: item.prefix || "",
          suffix: item.suffix || "",
          decimals: item.decimals || 0,
        })}</strong>
        <div class="number-body">
          <div class="number-status">
            ${factBadge(item.badge || item.statusClass || "Watch", item.statusClass || "watch")}
            <span>${escapeHTML(item.sourceDate || "")}</span>
          </div>
          <p>${escapeHTML(item.note || "")}</p>
          ${item.alt ? `<small>${escapeHTML(item.alt)}</small>` : ""}
          <div class="number-bar" aria-label="0 to 100 gauge"><i data-fill-to="${numberProgress(item)}" style="width:0%"></i></div>
          <div class="number-scale"><span>0</span><span>${fmtNum(numberProgress(item))}/100</span></div>
          <div class="number-source">${escapeHTML(item.source || "baseline")}</div>
        </div>
      `;
      card.querySelector("[data-copy-number]")?.addEventListener("click", (event) => copyTextToClipboard(numberPlainText(item), event.currentTarget));
      card.querySelector("[data-number-toggle]")?.addEventListener("click", () => {
        numberFolded[item.id] = !numberFolded[item.id];
        saveNumberPrefs();
        renderNumberDashboard();
      });
      card.addEventListener("dragstart", () => {
        draggedNumberId = item.id;
        card.classList.add("dragging");
      });
      card.addEventListener("dragend", () => {
        draggedNumberId = null;
        card.classList.remove("dragging");
        $$(".number-card.drop-target").forEach((node) => node.classList.remove("drop-target"));
      });
      card.addEventListener("dragover", (event) => {
        event.preventDefault();
        if (draggedNumberId && draggedNumberId !== item.id) card.classList.add("drop-target");
      });
      card.addEventListener("dragleave", () => card.classList.remove("drop-target"));
      card.addEventListener("drop", (event) => {
        event.preventDefault();
        card.classList.remove("drop-target");
        if (!draggedNumberId || draggedNumberId === item.id) return;
        const allIds = numberDashboardItems().map((entry) => entry.id);
        const currentOrder = (numberOrder.length ? numberOrder : allIds).filter((id) => allIds.includes(id));
        allIds.forEach((id) => {
          if (!currentOrder.includes(id)) currentOrder.push(id);
        });
        const from = currentOrder.indexOf(draggedNumberId);
        const to = currentOrder.indexOf(item.id);
        if (from < 0 || to < 0) return;
        currentOrder.splice(from, 1);
        currentOrder.splice(to, 0, draggedNumberId);
        numberOrder = currentOrder;
        saveNumberPrefs();
        renderNumberDashboard();
      });
      makeInspectable(card, payload);
      grid.appendChild(card);
    });
    if (!grid.children.length) grid.appendChild(el("div", "empty", "선택한 카테고리의 숫자 지표가 없습니다."));
    animateCounts(grid);
    animateMeters(grid);
  }

  function relatedToActive(item) {
    if (isHiddenItem(item)) return false;
    if (activeCategory === "all") return true;
    return (item.linkedCategories || []).includes(activeCategory);
  }

  function renderCategories() {
    const grid = $("#categoryGrid");
    grid.innerHTML = "";
    const active = activeCategoryData();
    $("#categoryMeta").textContent = `${active.label} · ${active.desc}`;
    memoryCategories().filter((cat) => cat.id !== "all").forEach((cat, index) => {
      const stats = categoryStats(cat.id);
      const card = el("article", `card reveal${cat.id === activeCategory ? " active" : ""}`);
      card.style.animationDelay = `${index * 35}ms`;
      card.style.setProperty("--local-accent", categoryAccent(cat.id));
      card.innerHTML = `
        <div class="card-top">
          <div>
            <span class="chip accent">${escapeHTML(cat.en)}</span>
            <h3>${escapeHTML(cat.label)}</h3>
          </div>
          <button class="chip" type="button" data-cat="${escapeHTML(cat.id)}">보기</button>
        </div>
        <p>${escapeHTML(cat.desc)}</p>
        <div class="metric-row">
          <div class="metric"><strong>${countHTML(stats.companies)}</strong><span>업체</span></div>
          <div class="metric"><strong>${countHTML(stats.news)}</strong><span>외신</span></div>
          <div class="metric"><strong>${countHTML(stats.prices)}</strong><span>가격</span></div>
        </div>
        <div class="tag-row">${(cat.keywords || []).slice(0, 5).map((tag) => `<span class="tag">${escapeHTML(tag)}</span>`).join("")}</div>
      `;
      card.querySelector("[data-cat]").addEventListener("click", () => setCategory(cat.id));
      makeInspectable(card, {
        type: "메모리 카테고리",
        tag: cat.en,
        title: cat.label,
        body: cat.desc,
        section: "categories",
        categories: [cat.id],
        watch: cat.keywords || [],
        metrics: [
          { label: "업체", value: fmtNum(stats.companies) },
          { label: "외신", value: fmtNum(stats.news) },
          { label: "가격", value: fmtNum(stats.prices) },
        ],
      });
      grid.appendChild(card);
    });
  }

  function categoryStats(id) {
    return {
      companies: (BASE.companies || []).filter((c) => (c.linkedCategories || []).includes(id)).length,
      news: filteredNews(id).length,
      prices: priceRowsFor(id).length,
    };
  }

  function renderChannels() {
    const grid = $("#channelGrid");
    grid.innerHTML = "";
    visibleItems(BASE.channels || []).filter(relatedToActive).forEach((item, index) => {
      const card = el("article", "card reveal");
      card.style.animationDelay = `${index * 35}ms`;
      card.style.setProperty("--local-accent", categoryAccent((item.linkedCategories || [])[0]));
      card.innerHTML = `
        <div class="card-top">
          <div>
            <span class="chip accent">${escapeHTML(item.source)}</span>
            <h3>${escapeHTML(item.title)}</h3>
          </div>
        </div>
        <p>${escapeHTML(item.desc)}</p>
        <ul class="watch-list">${(item.signals || []).map((s) => `<li>${escapeHTML(s)}</li>`).join("")}</ul>
      `;
      makeInspectable(card, {
        type: "정보 채널",
        tag: item.source,
        title: item.title,
        body: item.desc,
        section: "intelligence",
        categories: item.linkedCategories || [],
        watch: item.signals || [],
        metrics: [
          { label: "Signals", value: fmtNum((item.signals || []).length) },
          { label: "Source", value: item.source },
          { label: "Fit", value: (item.linkedCategories || []).map(categoryName).join(" · ") || "전체" },
        ],
      });
      grid.appendChild(card);
    });
    if (!grid.children.length) grid.appendChild(el("div", "empty", "선택한 카테고리의 정보 소스가 없습니다."));
  }

  function renderCompanies() {
    const grid = $("#companyGrid");
    const items = (BASE.companies || []).filter(relatedToActive);
    $("#competitorMeta").textContent = `${items.length}개 업체 · ${activeCategoryData().label}`;
    grid.innerHTML = "";
    items.forEach((company, index) => {
      const card = el("article", "card reveal");
      card.style.animationDelay = `${index * 35}ms`;
      card.style.setProperty("--local-accent", categoryAccent((company.linkedCategories || [])[0]));
      card.innerHTML = `
        <div class="card-top">
          <div>
            <span class="chip accent">${escapeHTML(company.category)}</span>
            <h3>${escapeHTML(company.name)}</h3>
            <span class="source-tag">${escapeHTML(company.fullName)}</span>
            ${company.claimStatus ? factBadge(company.claimStatus, company.claimClass || "watch") : ""}
          </div>
          <div class="score" style="--score:${Number(company.score || 0)}"><span>${escapeHTML(company.score || "")}</span></div>
        </div>
        <p>${escapeHTML(company.summary)}</p>
        <div class="metric-row">
          ${(company.metrics || []).slice(0, 3).map((m) => `<div class="metric"><strong>${escapeHTML(m.value)}</strong><span>${escapeHTML(m.label)}</span></div>`).join("")}
        </div>
        <ul class="watch-list">${(company.watch || []).slice(0, 4).map((w) => `<li>${escapeHTML(w)}</li>`).join("")}</ul>
        <div class="insight-box"><span>Benchmark insight</span>${escapeHTML(company.insight)}</div>
      `;
      makeInspectable(card, {
        type: "중국 경쟁사",
        tag: company.category,
        title: company.name,
        body: `${company.summary} ${company.insight || ""}`,
        section: "competitors",
        categories: company.linkedCategories || [],
        watch: company.watch || [],
        metrics: company.metrics || [],
      });
      grid.appendChild(card);
    });
    if (!items.length) grid.appendChild(el("div", "empty", "선택한 카테고리의 경쟁사 카드가 없습니다."));
  }

  function pipelineRelated(item) {
    if (activeCategory === "all") return true;
    const cats = item.linkedCategories || [];
    return !cats.length || cats.includes("all") || cats.includes(activeCategory);
  }

  function healthMatches(entry, keys = []) {
    const step = String(entry?.step || "");
    return keys.some((key) => step.startsWith(key) || step.includes(key));
  }

  function pipelineHealth(item) {
    return (LIVE.health || []).filter((entry) => healthMatches(entry, item.healthKeys || []));
  }

  function healthStatus(entries) {
    if (!entries.length) return { label: "대기", cls: "idle" };
    return entries.every((entry) => entry.ok) ? { label: "정상", cls: "ok" } : { label: "점검", cls: "fail" };
  }

  function categorySignalTotal() {
    return (LIVE.categories || []).reduce((sum, category) => {
      const count = Number(category.count ?? category.items?.length ?? 0);
      return sum + (Number.isFinite(count) ? count : 0);
    }, 0);
  }

  function benchmarkSignalTotal() {
    return Number(LIVE.benchmarkSignals?.stats?.total ?? LIVE.benchmarkSignals?.stream?.length ?? 0) || 0;
  }

  function parseHealthCount(entries) {
    return entries.reduce((sum, entry) => {
      const match = String(entry.msg || "").match(/(\d+)/);
      return sum + (match ? Number(match[1]) : 0);
    }, 0);
  }

  function pipelineSignalCount(item) {
    const health = pipelineHealth(item);
    if (item.id === "trendforce-price") return allPriceRows().length;
    if (item.id === "executive-backtest") return historyItems().length;
    if (item.id === "ai-architecture-signal") {
      const newsCount = rawNews().filter((news) => {
        const hay = `${news.title || ""} ${news.titleKo || ""} ${news.summary || ""} ${news.category || ""}`.toLowerCase();
        return /(hbm|cxl|pim|bonder|packaging|rubin|nvidia|micron|samsung|sk hynix|test|controller)/i.test(hay);
      }).length;
      const matrix = BASE.architectureMatrix || {};
      return newsCount + (matrix.roadmap || []).length + (matrix.valueChain || []).length;
    }
    if (item.id === "foreign-news") return rawNews().filter((news) => !isChinaArticle(news)).length;
    if (item.id === "china-news") return rawNews().filter(isChinaArticle).length;
    if (item.id === "china-nand-business") return CHINA_NAND_BUSINESS_LAYERS.reduce((sum, layer) => sum + nandBusinessSignalCount(layer), 0);
    if (item.id === "skhynix-product-projection") return projectionTotalSignals();
    if (item.id === "talent-hiring-radar") {
      const axis = CHINA_DYNAMIC_AXES.find((entry) => entry.id === "talent");
      return axisSignalCount(axis) + (BASE.talentRadar?.companySignals?.length || 0);
    }
    if (item.id === "benchmark-signals") return benchmarkSignalTotal();
    if (item.id === "competitors") return (LIVE.competitors?.competitors || []).length || parseHealthCount(health);
    if (item.id === "startup-radar") return (LIVE.startups?.candidates || []).length || parseHealthCount(health);
    if (item.id === "ko-insight") return parseHealthCount(health) || rawNews().length;
    return parseHealthCount(health);
  }

  function crawlerPipelineItems() {
    return CRAWL_PIPELINE
      .filter(pipelineRelated)
      .map((item) => {
        const health = pipelineHealth(item);
        const status = healthStatus(health);
        return {
          ...item,
          health,
          status,
          signalCount: pipelineSignalCount(item),
        };
      });
  }

  function renderCrawlerBoard() {
    const summary = $("#crawlerSummary");
    const flow = $("#crawlerFlow");
    const taxonomy = $("#crawlerTaxonomy");
    const healthWrap = $("#crawlerHealth");
    const meta = $("#crawlerMeta");
    if (!summary || !flow || !taxonomy || !healthWrap) return;

    const health = LIVE.health || [];
    const ok = health.filter((entry) => entry.ok).length;
    const fail = Math.max(health.length - ok, 0);
    const priceRows = allPriceRows().length;
    const priceSections = LIVE.prices?.sections?.length || 0;
    const visibleNews = rawNews().length;
    const chinaNews = rawNews().filter(isChinaArticle).length;
    const categorySignals = categorySignalTotal();
    const benchmarkSignals = benchmarkSignalTotal();
    const pipelineItems = crawlerPipelineItems();

    if (meta) meta.textContent = `${fmtNum(pipelineItems.length)}개 수집 채널 · ${fmtDate(LIVE.updatedAt)}`;

    const cards = [
      { label: "Run health", value: `${ok}/${health.length}`, note: fail ? `${fmtNum(fail)}개 단계 점검 필요` : "전체 수집 단계 정상" },
      { label: "가격 테이블", value: priceRows, note: `${fmtNum(priceSections)}개 TrendForce 표` },
      { label: "뉴스 원천 신호", value: categorySignals, note: `화면 노출 ${fmtNum(visibleNews)}건` },
      { label: "중국·벤치마킹", value: chinaNews + benchmarkSignals, note: `중국 기사 ${fmtNum(chinaNews)}건 · 테마 ${fmtNum(benchmarkSignals)}건` },
      { label: "업데이트", value: fmtDate(LIVE.updatedAt), note: "GitHub Actions daily crawler" },
    ];
    summary.innerHTML = cards.map((card) => `
      <article class="crawler-stat">
        <span>${escapeHTML(card.label)}</span>
        <strong>${typeof card.value === "number" ? countHTML(card.value) : escapeHTML(card.value)}</strong>
        <small>${escapeHTML(card.note)}</small>
      </article>
    `).join("");

    const compactStages = [
      { label: "수집", value: `${fmtNum(ok)}/${fmtNum(health.length)}`, note: fail ? `${fmtNum(fail)}개 점검 필요` : "정상", cls: fail ? "fail" : "ok" },
      { label: "정제", value: fmtNum(categorySignals + benchmarkSignals), note: "뉴스·벤치마킹 분류", cls: "ok" },
      { label: "대시보드", value: fmtNum(pipelineItems.length), note: "주요 보드 연결", cls: "ok" },
    ];
    flow.innerHTML = compactStages.map((stage) => `
      <article class="crawler-card compact">
        <div class="crawler-card-head">
          <span class="chip accent">${escapeHTML(stage.label)}</span>
          <span class="crawler-status ${escapeHTML(stage.cls)}">${escapeHTML(stage.note)}</span>
        </div>
        <h3>${escapeHTML(stage.value)}</h3>
      </article>
    `).join("");

    const taxonomyRows = []
      .concat((LIVE.categories || []).map((category) => ({
        type: "뉴스",
        label: category.label || category.id,
        count: Number(category.count ?? category.items?.length ?? 0) || 0,
      })))
      .concat((LIVE.benchmarkSignals?.themes || []).map((theme) => ({
        type: "벤치마킹",
        label: theme.label || theme.id,
        count: Number(theme.count ?? theme.items?.length ?? 0) || 0,
      })))
      .filter((row) => row.count > 0)
      .filter((row) => {
        if (activeCategory === "all") return true;
        const hay = `${row.label} ${row.type}`.toLowerCase();
        return hay.includes(activeCategory.toLowerCase()) || categoryName(activeCategory).includes(row.label);
      });

    taxonomy.innerHTML = taxonomyRows.length ? taxonomyRows.map((row) => `
      <div class="crawler-tax-row">
        <span>${escapeHTML(row.type)}</span>
        <strong>${escapeHTML(row.label)}</strong>
        <em>${fmtNum(row.count)}건</em>
      </div>
    `).join("") : `<div class="empty">선택한 카테고리에 직접 연결된 분류 로그가 없습니다.</div>`;

    const healthOk = health.filter((entry) => entry.ok).length;
    const healthMeta = $("#crawlerHealthMeta");
    if (healthMeta) healthMeta.textContent = `${fmtNum(healthOk)}/${fmtNum(health.length)} 정상`;
    const healthIssues = health.filter((entry) => !entry.ok).slice(0, 6);
    healthWrap.innerHTML = healthIssues.length ? healthIssues.map((entry) => `
      <div class="health-chip fail">
        <strong>${escapeHTML(entry.step || "step")}</strong>
        <span>${escapeHTML(entry.msg || "")}</span>
      </div>
    `).join("") : `
      <div class="health-chip ok">
        <strong>전체 수집 로그</strong>
        <span>${fmtNum(healthOk)}/${fmtNum(health.length)} 정상 · 상세 로그는 숨김</span>
      </div>
    `;
  }

  function architectureMatrix() {
    return BASE.architectureMatrix || {
      summary: [],
      tracks: [],
      advancedModules: [],
      shareMatrix: [],
      roadmap: [],
      valueChain: [],
      platformModules: [],
    };
  }

  function architectureRelated(item) {
    if (activeCategory === "all") return true;
    const cats = item.linkedCategories || [];
    return !cats.length || cats.includes(activeCategory);
  }

  function renderArchitectureMatrix() {
    const matrix = architectureMatrix();
    const summary = $("#architectureSummary");
    const tracksWrap = $("#architectureTracks");
    const advancedWrap = $("#advancedInsightModules");
    const shareWrap = $("#architectureShareMatrix");
    const roadmapWrap = $("#architectureRoadmap");
    const valueWrap = $("#valueChainMap");
    const moduleWrap = $("#platformModules");
    const meta = $("#architectureMeta");
    if (!summary || !tracksWrap || !advancedWrap || !shareWrap || !roadmapWrap || !valueWrap || !moduleWrap) return;

    const tracks = (matrix.tracks || []).filter(architectureRelated);
    const advancedModules = (matrix.advancedModules || []).filter(architectureRelated);
    const shareRows = (matrix.shareMatrix || []).filter(architectureRelated);
    const roadmap = matrix.roadmap || [];
    const valueChain = (matrix.valueChain || []).filter(architectureRelated);
    const modules = matrix.platformModules || [];
    if (meta) {
      const objectCount = tracks.length + advancedModules.length + shareRows.length + roadmap.length + valueChain.length + modules.length;
      meta.textContent = `${fmtNum(objectCount)}개 객체 · ${activeCategoryData().label} · ${matrix.sourceNote || "첨부 보고서 반영"}`;
    }

    summary.innerHTML = (matrix.summary || []).map((line, index) => `
      <article class="ai-summary-line">
        <span>${String(index + 1).padStart(2, "0")}</span>
        <p>${escapeHTML(line)}</p>
      </article>
    `).join("");

    tracksWrap.innerHTML = "";
    tracks.forEach((track, index) => {
      const card = el("article", "arch-track-card reveal");
      card.style.animationDelay = `${index * 35}ms`;
      card.style.setProperty("--local-accent", categoryAccent((track.linkedCategories || [])[0]));
      card.innerHTML = `
        <div class="arch-track-head">
          <span class="chip accent">${escapeHTML(track.label)}</span>
          ${factBadge("Watch", "watch")}
        </div>
        <h3>${escapeHTML(track.title)}</h3>
        <p>${escapeHTML(track.thesis)}</p>
        <div class="metric-row">${metricCards(track.metrics || [], 3)}</div>
        <div class="tag-row">${(track.watch || []).map((item) => `<span class="tag">${escapeHTML(item)}</span>`).join("")}</div>
      `;
      makeInspectable(card, {
        type: "AI 메모리 트랙",
        tag: track.label,
        title: track.title,
        body: track.thesis,
        section: "ai-matrix",
        categories: track.linkedCategories || [],
        watch: track.watch || [],
        metrics: track.metrics || [],
      });
      tracksWrap.appendChild(card);
    });
    if (!tracksWrap.children.length) tracksWrap.appendChild(el("div", "empty", "선택한 카테고리의 AI 메모리 트랙이 없습니다."));

    advancedWrap.innerHTML = "";
    advancedModules.forEach((module, index) => {
      const payload = {
        type: "고도화 인사이트 모듈",
        tag: module.badge || module.subtitle,
        title: module.title,
        body: module.thesis,
        section: "ai-matrix",
        categories: module.linkedCategories || [],
        watch: (module.signals || []).concat(module.actions || []),
        tags: (module.sources || []).map((source) => source.label || source.url || "Source"),
        metrics: (module.scorecards || []).map((score) => ({
          label: score.label,
          value: score.value,
        })),
      };
      const card = el("article", "advanced-module-card reveal");
      card.style.animationDelay = `${index * 35}ms`;
      card.style.setProperty("--local-accent", categoryAccent((module.linkedCategories || [])[0]));
      card.innerHTML = `
        <div class="advanced-module-head">
          <div>
            <span class="chip accent">${escapeHTML(module.subtitle || "Insight module")}</span>
            <h3>${escapeHTML(module.title)}</h3>
          </div>
          <div class="advanced-module-actions">
            ${factBadge(module.badge || "Watch", module.status || "watch")}
            <button class="copy-btn" type="button" data-copy-advanced>복사</button>
          </div>
        </div>
        <p>${escapeHTML(module.thesis || "")}</p>
        <div class="advanced-score-grid">
          ${(module.scorecards || []).map((score) => `
            <div class="advanced-score">
              <strong>${escapeHTML(score.value)}</strong>
              <span>${escapeHTML(score.label)}</span>
              <small>${escapeHTML(score.note || "")}</small>
            </div>
          `).join("")}
        </div>
        <div class="tag-row">${(module.signals || []).map((signal) => `<span class="tag">${escapeHTML(signal)}</span>`).join("")}</div>
        ${(module.actions || []).length ? `<ul class="watch-list">${module.actions.map((action) => `<li>${escapeHTML(action)}</li>`).join("")}</ul>` : ""}
        ${(module.sources || []).length ? `<div class="source-row">${module.sources.map((source) => `<a href="${escapeHTML(source.url || "#")}" target="_blank" rel="noopener">${escapeHTML(source.label || source.url || "Source")}</a>`).join("")}</div>` : ""}
      `;
      card.querySelector("[data-copy-advanced]")?.addEventListener("click", (event) => copyPayload(payload, event.currentTarget));
      makeInspectable(card, payload);
      advancedWrap.appendChild(card);
    });
    if (!advancedWrap.children.length) advancedWrap.appendChild(el("div", "empty", "선택한 카테고리의 고도화 인사이트 모듈이 없습니다."));

    shareWrap.innerHTML = "";
    shareRows.forEach((row, index) => {
      const card = el("article", "share-card reveal");
      card.style.animationDelay = `${index * 25}ms`;
      card.style.setProperty("--local-accent", categoryAccent((row.linkedCategories || [])[0]));
      card.innerHTML = `
        <div class="share-head">
          <div>
            <span class="chip accent">${escapeHTML(row.type || "Benchmark")}</span>
            <h3>${escapeHTML(row.company)}</h3>
          </div>
          <span class="share-hbm">${escapeHTML(row.hbmShare || "-")}</span>
        </div>
        <div class="share-metrics">
          <div><strong>${escapeHTML(row.dramShare2025 || "-")}</strong><span>2025 DRAM</span></div>
          <div><strong>${escapeHTML(row.dramShare2026 || "-")}</strong><span>2026 DRAM</span></div>
          <div><strong>${escapeHTML(row.nandShare2026 || "-")}</strong><span>2026 NAND</span></div>
        </div>
        <p>${escapeHTML(row.position || "")}</p>
        <ul class="watch-list">${(row.watch || []).slice(0, 4).map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul>
      `;
      makeInspectable(card, {
        type: "경쟁사 벤치마크",
        tag: row.type,
        title: row.company,
        body: row.position,
        section: "ai-matrix",
        categories: row.linkedCategories || [],
        watch: row.watch || [],
        metrics: [
          { label: "HBM", value: row.hbmShare || "-" },
          { label: "2026 DRAM", value: row.dramShare2026 || "-" },
          { label: "2026 NAND", value: row.nandShare2026 || "-" },
        ],
      });
      shareWrap.appendChild(card);
    });
    if (!shareWrap.children.length) shareWrap.appendChild(el("div", "empty", "선택한 카테고리의 경쟁사 매트릭스가 없습니다."));

    roadmapWrap.innerHTML = roadmap.map((item, index) => `
      <article class="roadmap-card reveal" style="animation-delay:${index * 25}ms">
        <span>${escapeHTML(item.period)}</span>
        <h4>${escapeHTML(item.title)}</h4>
        <p>${escapeHTML(item.detail)}</p>
        <div class="tag-row">${(item.checkpoints || []).map((point) => `<span class="tag">${escapeHTML(point)}</span>`).join("")}</div>
      </article>
    `).join("");

    valueWrap.innerHTML = "";
    valueChain.forEach((node, index) => {
      const card = el("article", "value-node reveal");
      card.style.animationDelay = `${index * 25}ms`;
      card.style.setProperty("--local-accent", categoryAccent((node.linkedCategories || [])[0]));
      card.innerHTML = `
        <div class="value-node-head">
          <span class="chip accent">${escapeHTML(node.segment)}</span>
          <small>${fmtNum((node.players || []).length)} vendors</small>
        </div>
        <h3>${escapeHTML((node.players || []).join(" · "))}</h3>
        <p>${escapeHTML(node.role || "")}</p>
        <div class="insight-box"><span>Risk overlay</span>${escapeHTML(node.risk || "")}</div>
        <div class="tag-row">${(node.signals || []).map((signal) => `<span class="tag">${escapeHTML(signal)}</span>`).join("")}</div>
      `;
      makeInspectable(card, {
        type: "Supply Chain Explorer",
        tag: node.segment,
        title: (node.players || []).join(" · "),
        body: `${node.role || ""} ${node.risk || ""}`,
        section: "ai-matrix",
        categories: node.linkedCategories || [],
        watch: node.signals || [],
        tags: node.players || [],
        metrics: [
          { label: "Vendors", value: fmtNum((node.players || []).length) },
          { label: "Segment", value: node.segment },
          { label: "Risk", value: "Overlay" },
        ],
      });
      valueWrap.appendChild(card);
    });
    if (!valueWrap.children.length) valueWrap.appendChild(el("div", "empty", "선택한 카테고리의 밸류체인 노드가 없습니다."));

    moduleWrap.innerHTML = modules.map((module, index) => `
      <article class="platform-module reveal" style="animation-delay:${index * 25}ms">
        <span class="chip accent">${escapeHTML(module.name)}</span>
        <p>${escapeHTML(module.function)}</p>
        <div class="module-foot">
          <strong>${escapeHTML(module.users)}</strong>
          <span>${escapeHTML(module.differentiation)}</span>
        </div>
      </article>
    `).join("");
  }

  function liveBenchmarkTheme(id) {
    return (LIVE.benchmarkSignals?.themes || []).find((theme) => theme.id === id) || null;
  }

  function liveNewsCategory(id) {
    return (LIVE.categories || []).find((category) => category.id === id) || null;
  }

  function axisSignalCount(axis) {
    if (!axis) return 0;
    const theme = liveBenchmarkTheme(axis.theme);
    const themeCount = Number(theme?.count ?? theme?.items?.length ?? 0) || 0;
    const categoryCount = (axis.categoryIds || []).reduce((sum, id) => {
      const category = liveNewsCategory(id);
      return sum + (Number(category?.count ?? category?.items?.length ?? 0) || 0);
    }, 0);
    return themeCount + categoryCount;
  }

  function axisMomentum(count) {
    if (count >= 80) return { label: "High", cls: "high" };
    if (count >= 30) return { label: "Active", cls: "active" };
    return { label: "Watch", cls: "watch" };
  }

  function axisLiveItems(axis) {
    const keywords = (axis.keywords || []).map((word) => word.toLowerCase());
    const items = [];
    const theme = liveBenchmarkTheme(axis.theme);
    if (theme?.items) items.push(...theme.items);
    (axis.categoryIds || []).forEach((id) => {
      const category = liveNewsCategory(id);
      if (category?.items) items.push(...category.items);
    });
    items.push(...rawNews().filter((item) => {
      const hay = `${item.title || ""} ${item.titleKo || ""} ${item.summary || ""} ${item.source || ""}`.toLowerCase();
      return keywords.some((keyword) => hay.includes(keyword));
    }));

    const seen = new Set();
    return items.filter((item) => {
      const key = `${item.title || ""} ${item.source || ""}`.toLowerCase().replace(/\s+/g, " ").trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 4);
  }

  function nandPriceRows() {
    return allPriceRows().filter((row) => /nand|ssd|flash|wafer|ufs|emmc/i.test(`${row.group || ""} ${row.sectionTitle || ""} ${row.item || ""}`));
  }

  function nandBusinessSignalCount(item) {
    const keywords = (item.keywords || []).map((keyword) => String(keyword).toLowerCase());
    if (!keywords.length) return 0;
    const newsCount = rawNews().filter((news) => {
      const hay = `${news.title || ""} ${news.titleKo || ""} ${news.summary || ""} ${news.source || ""}`.toLowerCase();
      return keywords.some((keyword) => hay.includes(keyword));
    }).length;
    const themeCount = (LIVE.benchmarkSignals?.themes || []).reduce((sum, theme) => {
      const hay = `${theme.id || ""} ${theme.label || ""}`.toLowerCase();
      return sum + (keywords.some((keyword) => hay.includes(keyword)) ? Number(theme.count ?? theme.items?.length ?? 0) || 0 : 0);
    }, 0);
    const priceCount = (item.linkedCategories || []).includes("nand") ? Math.min(nandPriceRows().length, 12) : 0;
    return newsCount + themeCount + priceCount;
  }

  function nandBusinessLinks(item, limit = 4) {
    const keywords = (item.keywords || []).map((keyword) => String(keyword).toLowerCase());
    const seen = new Set();
    return rawNews().filter((news) => {
      const hay = `${news.title || ""} ${news.titleKo || ""} ${news.summary || ""} ${news.source || ""}`.toLowerCase();
      return keywords.some((keyword) => hay.includes(keyword));
    }).filter((news) => {
      const key = `${news.title || ""} ${news.source || ""}`.toLowerCase().replace(/\s+/g, " ").trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, limit);
  }

  function renderChinaNandBusiness() {
    const summary = $("#chinaNandSummary");
    const map = $("#chinaNandMap");
    const focus = $("#chinaNandFocus");
    const playbook = $("#chinaNandPlaybook");
    const meta = $("#chinaNandMeta");
    if (!summary || !map || !focus || !playbook) return;

    const layers = CHINA_NAND_BUSINESS_LAYERS.filter((item) => {
      if (activeCategory === "all") return true;
      return (item.linkedCategories || []).includes(activeCategory);
    });
    const visibleLayers = layers.length ? layers : CHINA_NAND_BUSINESS_LAYERS;
    if (!visibleLayers.some((item) => item.id === chinaNandFocusId)) chinaNandFocusId = visibleLayers[0]?.id || "ymtc";
    const selected = visibleLayers.find((item) => item.id === chinaNandFocusId) || visibleLayers[0];
    const totalSignals = visibleLayers.reduce((sum, item) => sum + nandBusinessSignalCount(item), 0);
    const nandRows = nandPriceRows();
    const ymtcLinks = nandBusinessLinks(CHINA_NAND_BUSINESS_LAYERS.find((item) => item.id === "ymtc") || {}, 6);
    if (meta) meta.textContent = `${fmtNum(totalSignals)}개 신호 · NAND 가격 ${fmtNum(nandRows.length)} rows · ${fmtDate(LIVE.updatedAt)}`;

    const summaryCards = [
      { label: "NAND 가격 rows", value: nandRows.length, note: "Spot·contract·SSD·wafer" },
      { label: "YMTC/XMC 신호", value: ymtcLinks.length, note: "Xtacking·eSSD·우한 클러스터" },
      { label: "전략 축", value: visibleLayers.length, note: "업체·장비·정책 분리" },
      { label: "업무 체크", value: NAND_BUSINESS_WORKFLOWS.length, note: "발굴·전략·실사·수익성" },
    ];
    summary.innerHTML = summaryCards.map((card) => `
      <article class="nand-stat reveal">
        <span>${escapeHTML(card.label)}</span>
        <strong>${countHTML(card.value)}</strong>
        <small>${escapeHTML(card.note)}</small>
      </article>
    `).join("");

    map.innerHTML = visibleLayers.map((item, index) => {
      const count = nandBusinessSignalCount(item);
      const score = clamp(item.score + Math.min(count, 12) - 6);
      return `
        <button class="nand-node reveal${item.id === selected?.id ? " active" : ""}" type="button" data-nand-node="${escapeHTML(item.id)}" style="--local-accent:${categoryAccent((item.linkedCategories || [])[0])}; animation-delay:${index * 32}ms">
          ${scoreRingHTML(score, "Score")}
          <span>
            <small>${escapeHTML(item.role)}</small>
            <strong>${escapeHTML(item.label)}</strong>
            <em>${fmtNum(count)} signals</em>
          </span>
        </button>
      `;
    }).join("");

    if (selected) {
      const links = nandBusinessLinks(selected, 4);
      const payload = {
        type: "중국 NAND 사업 강화",
        tag: selected.role,
        title: selected.title,
        body: selected.risk,
        section: "china-nand",
        categories: selected.linkedCategories || [],
        watch: selected.decisions || [],
        tags: selected.crawl || [],
        metrics: selected.metrics || [],
        links,
      };
      focus.style.setProperty("--local-accent", categoryAccent((selected.linkedCategories || [])[0]));
      focus.innerHTML = `
        <div class="nand-focus-head">
          <span class="chip accent">${escapeHTML(selected.role)}</span>
          <h3>${escapeHTML(selected.title)}</h3>
          <p>${escapeHTML(selected.risk)}</p>
        </div>
        <div class="metric-row">${metricCards(selected.metrics || [], 3)}</div>
        <div class="nand-focus-block">
          <strong>업체 전략</strong>
          <ul class="watch-list">${(selected.strategy || []).map((line) => `<li>${escapeHTML(line)}</li>`).join("")}</ul>
        </div>
        <div class="nand-focus-block">
          <strong>매일 크롤링 키워드</strong>
          <div class="tag-row">${(selected.crawl || []).map((tag) => `<span class="tag">${escapeHTML(tag)}</span>`).join("")}</div>
        </div>
        <div class="nand-focus-block">
          <strong>사업 판단 포인트</strong>
          <ul class="watch-list">${(selected.decisions || []).map((line) => `<li>${escapeHTML(line)}</li>`).join("")}</ul>
        </div>
        ${links.length ? `
          <div class="nand-focus-block">
            <strong>관련 최신 기사</strong>
            <ul class="work-link-list">${links.map((link) => `<li><a href="${escapeHTML(link.link || "#")}" target="_blank" rel="noopener">${escapeHTML(newsTitle(link) || link.title || "Signal")}</a></li>`).join("")}</ul>
          </div>
        ` : ""}
        <div class="focus-actions">
          <button type="button" data-nand-copy>복사</button>
          <button type="button" data-nand-inspector>상세 패널</button>
          <button type="button" data-nand-news>기사 보기</button>
        </div>
      `;
      focus.querySelector("[data-nand-copy]")?.addEventListener("click", (event) => copyPayload(payload, event.currentTarget));
      focus.querySelector("[data-nand-inspector]")?.addEventListener("click", () => openInspector(payload));
      focus.querySelector("[data-nand-news]")?.addEventListener("click", () => jumpTo("news"));
    } else {
      focus.innerHTML = `<div class="empty">선택한 카테고리의 중국 NAND 전략 항목이 없습니다.</div>`;
    }

    playbook.innerHTML = NAND_BUSINESS_WORKFLOWS.filter((item) => {
      if (activeCategory === "all") return true;
      return (item.linkedCategories || []).includes(activeCategory);
    }).map((item, index) => `
      <article class="nand-work-card reveal" style="--local-accent:${categoryAccent((item.linkedCategories || [])[0])}; animation-delay:${index * 25}ms">
        <span class="chip accent">${String(index + 1).padStart(2, "0")}</span>
        <h3>${escapeHTML(item.label)}</h3>
        <p>${escapeHTML(item.desc)}</p>
        <strong>${escapeHTML(item.output)}</strong>
      </article>
    `).join("") || `<div class="empty">선택한 카테고리의 사업 체크리스트가 없습니다.</div>`;

    map.querySelectorAll("[data-nand-node]").forEach((btn) => {
      btn.addEventListener("click", () => {
        chinaNandFocusId = btn.dataset.nandNode;
        renderChinaNandBusiness();
      });
      btn.addEventListener("mouseenter", () => {
        if (chinaNandFocusId === btn.dataset.nandNode) return;
        chinaNandFocusId = btn.dataset.nandNode;
        renderChinaNandBusiness();
      });
    });
    animateCounts(summary);
    animateCounts(map);
    animateMeters(map);
  }

  function historyItems() {
    const items = Object.values(HISTORY?.items || {}).filter((item) => Array.isArray(item.points) && item.points.length);
    if (items.length) return items;
    return allPriceRows().filter((row) => Array.isArray(row.history) && row.history.length).map((row) => ({
      key: row.historyKey || `${row.sectionTitle || ""}::${row.item || ""}`,
      item: row.item,
      sectionTitle: row.sectionTitle,
      group: row.group,
      sourceUrl: row.sourceUrl,
      points: row.history,
    }));
  }

  function pointTime(point) {
    const value = point?.crawledAt || point?.sourceUpdate || point?.date || "";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }

  function pointDateLabel(value) {
    if (!value) return "데이터 없음";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function backtestDateOptions() {
    const times = new Map();
    historyItems().forEach((series) => {
      (series.points || []).forEach((point) => {
        const t = pointTime(point);
        if (t) times.set(new Date(t).toISOString(), pointDateLabel(t));
      });
    });
    return Array.from(times.entries())
      .sort((a, b) => new Date(a[0]) - new Date(b[0]))
      .map(([value, label]) => ({ value, label }));
  }

  function ensureBacktestDate() {
    const options = backtestDateOptions();
    if (!options.length) {
      selectedBacktestDate = "";
      return null;
    }
    if (!options.some((item) => item.value === selectedBacktestDate)) {
      selectedBacktestDate = options[Math.max(0, options.length - 2)]?.value || options[0].value;
    }
    return selectedBacktestDate;
  }

  function historyMatchesProduct(series, product) {
    const hay = `${series.key || ""} ${series.item || ""} ${series.sectionTitle || ""} ${series.group || ""}`.toLowerCase();
    return (product.priceTerms || []).some((term) => hay.includes(String(term).toLowerCase()));
  }

  function productHistorySeries(product) {
    return historyItems().filter((series) => historyMatchesProduct(series, product));
  }

  function sortedPoints(series) {
    return (series.points || [])
      .filter((point) => Number.isFinite(Number(point.average)))
      .map((point) => ({ ...point, _time: pointTime(point) }))
      .filter((point) => point._time)
      .sort((a, b) => a._time - b._time);
  }

  function backtestObservation(series, selectedTime) {
    const points = sortedPoints(series);
    const startIndex = points.findLastIndex((point) => point._time <= selectedTime);
    if (startIndex < 0) return null;
    const start = points[startIndex];
    const previous = startIndex > 0 ? points[startIndex - 1] : null;
    const latest = points[points.length - 1];
    if (!latest || latest._time <= start._time) return null;
    const startAvg = Number(start.average);
    const latestAvg = Number(latest.average);
    const previousAvg = Number(previous?.average);
    if (!Number.isFinite(startAvg) || !Number.isFinite(latestAvg) || !startAvg) return null;
    const actualChange = (latestAvg / startAvg - 1) * 100;
    const priorChange = Number.isFinite(previousAvg) && previousAvg ? (startAvg / previousAvg - 1) * 100 : null;
    return {
      key: series.key,
      item: series.item || series.key,
      sectionTitle: series.sectionTitle || "",
      group: series.group || "",
      sourceUrl: series.sourceUrl || "",
      start,
      previous,
      latest,
      startAvg,
      latestAvg,
      actualChange,
      priorChange,
      days: Math.max(0, (latest._time - start._time) / 864e5),
    };
  }

  function average(values = []) {
    const nums = values.filter((value) => Number.isFinite(Number(value))).map(Number);
    if (!nums.length) return null;
    return nums.reduce((sum, value) => sum + value, 0) / nums.length;
  }

  function decisionFromMomentum(product, priorMomentum, coverage, chinaSignalCount) {
    if (coverage < 2 || priorMomentum == null) {
      return {
        label: "데이터 부족",
        cls: "insufficient",
        action: "추정 금지",
        logic: "선택 시점 이전 가격 포인트가 부족해 당시 판단을 만들 수 없습니다.",
      };
    }
    if (product.decisionBias === "risk") {
      if (priorMomentum <= -0.35 || chinaSignalCount >= 40) {
        return { label: "방어 강화", cls: "defend", action: "가격·고객 방어", logic: "중국 proxy 가격 약세 또는 중국 신호가 강해 가격 하방 리스크를 우선합니다." };
      }
      if (priorMomentum >= 0.5) return { label: "압력 완화 확인", cls: "hold", action: "확인 후 선별 대응", logic: "중국 proxy 가격은 양호하지만 확대보다 침투율과 고객 인증을 확인합니다." };
      return { label: "관찰 유지", cls: "hold", action: "일일 감시", logic: "방향성이 약해 가격·뉴스·캐파 데이터를 더 쌓습니다." };
    }
    if (product.decisionBias === "defense") {
      if (priorMomentum <= -0.45) return { label: "축소·방어", cls: "defend", action: "저수익 SKU 축소", logic: "단말/범용 proxy 가격이 약세라 원가와 재고 방어가 우선입니다." };
      if (priorMomentum >= 0.65) return { label: "선별 확대", cls: "expand", action: "고부가 SKU 중심", logic: "방어형 제품군도 가격 모멘텀이 확인된 SKU는 선별 확대합니다." };
      return { label: "유지", cls: "hold", action: "믹스 조정", logic: "가격 방향성이 중립이라 서버향 우선 배분을 유지합니다." };
    }
    if (priorMomentum >= 0.55) return { label: "확대", cls: "expand", action: "캐파·고객 락인", logic: "선택 시점까지 실제 가격 모멘텀이 양수라 성장 제품군 확대 판단입니다." };
    if (priorMomentum <= -0.45) return { label: "보수", cls: "defend", action: "가격 방어", logic: "선택 시점까지 가격 약세가 확인되어 보수적 공급/가격 관리가 필요합니다." };
    return { label: "유지", cls: "hold", action: "옵션 유지", logic: "방향성이 약해 장기 고객과 옵션 투자를 유지합니다." };
  }

  function outcomeFromDecision(decision, actualChange) {
    if (decision.cls === "insufficient" || actualChange == null) return { label: "검증 불가", cls: "insufficient", hit: null };
    if (decision.cls === "expand") {
      return actualChange > 0 ? { label: "확대 적중", cls: "hit", hit: true } : { label: "확대 역행", cls: "miss", hit: false };
    }
    if (decision.cls === "defend") {
      return actualChange < 0 ? { label: "방어 적중", cls: "hit", hit: true } : { label: "방어 기회비용", cls: "miss", hit: false };
    }
    return Math.abs(actualChange) <= 0.6 ? { label: "유지 적중", cls: "hit", hit: true } : { label: "유지 재검토", cls: "watch", hit: null };
  }

  function productBacktest(product, selectedIso = ensureBacktestDate()) {
    const selectedTime = selectedIso ? new Date(selectedIso).getTime() : 0;
    const matched = productHistorySeries(product);
    const observations = matched.map((series) => backtestObservation(series, selectedTime)).filter(Boolean);
    const priorMomentum = average(observations.map((item) => item.priorChange));
    const actualChange = average(observations.map((item) => item.actualChange));
    const avgDays = average(observations.map((item) => item.days)) || 0;
    const chinaSignalCount = rawNews().filter((news) => {
      const hay = `${news.title || ""} ${news.titleKo || ""} ${news.summary || ""} ${news.source || ""}`.toLowerCase();
      return (product.chinaTerms || []).some((term) => hay.includes(String(term).toLowerCase()));
    }).length + (product.id === "china-exposure" ? benchmarkSignalTotal() : 0);
    const decision = decisionFromMomentum(product, priorMomentum, observations.length, chinaSignalCount);
    const outcome = outcomeFromDecision(decision, actualChange);
    const confidence = observations.length
      ? clamp(30 + Math.min(observations.length, 12) * 5 + Math.min(avgDays, 20) * 1.2)
      : 0;
    return {
      ...product,
      observations,
      matchedCount: matched.length,
      priorMomentum,
      actualChange,
      avgDays,
      chinaSignalCount,
      decision,
      outcome,
      confidence,
      latestAt: observations.reduce((latest, item) => Math.max(latest, item.latest._time || 0), 0),
    };
  }

  function executiveBacktests() {
    const selected = ensureBacktestDate();
    return EXEC_DECISION_PRODUCTS.map((product) => productBacktest(product, selected));
  }

  function decisionClassLabel(item) {
    if (!item.observations.length) return "데이터 부족";
    return `${fmtNum(item.observations.length)}개 품목 · ${fmtNum(item.confidence)}점`;
  }

  function renderBacktestDateSelect() {
    const select = $("#backtestDateSelect");
    if (!select) return;
    const options = backtestDateOptions();
    ensureBacktestDate();
    select.innerHTML = options.length ? options.map((option) => `
      <option value="${escapeHTML(option.value)}"${option.value === selectedBacktestDate ? " selected" : ""}>${escapeHTML(option.label)}</option>
    `).join("") : `<option value="">가격 히스토리 없음</option>`;
    select.onchange = () => {
      selectedBacktestDate = select.value;
      renderExecutiveDecision();
    };
  }

  function renderExecutiveDecision() {
    const summary = $("#execDecisionSummary");
    const grid = $("#execDecisionGrid");
    const focus = $("#execDecisionFocus");
    const evidence = $("#execDecisionEvidence");
    const meta = $("#execDecisionMeta");
    const coverage = $("#backtestCoverage");
    if (!summary || !grid || !focus || !evidence) return;

    renderBacktestDateSelect();
    const selected = ensureBacktestDate();
    const items = executiveBacktests();
    if (!items.some((item) => item.id === execDecisionFocusId)) execDecisionFocusId = items[0]?.id || "hbm-ai-server";
    const active = items.find((item) => item.id === execDecisionFocusId) || items[0];
    const historyCount = historyItems().length;
    const hitItems = items.filter((item) => item.outcome.hit === true).length;
    const testedItems = items.filter((item) => item.outcome.hit !== null).length;
    const latestAtRaw = items.length ? Math.max(...items.map((item) => item.latestAt || 0), 0) : 0;
    const latestAt = Number.isFinite(latestAtRaw) ? latestAtRaw : 0;
    const hitRate = testedItems ? hitItems / testedItems * 100 : null;
    if (meta) meta.textContent = `${pointDateLabel(selected)} 선택 · ${fmtNum(historyCount)}개 가격 series · ${latestAt ? pointDateLabel(latestAt) : "최신 결과 없음"}까지 검증`;
    if (coverage) coverage.textContent = `실제 가격 series ${fmtNum(historyCount)}개 · 추정 없는 backtest`;

    const summaryCards = [
      { label: "선택 과거 시점", value: pointDateLabel(selected), note: "당시까지 확인된 가격 포인트만 사용" },
      { label: "최신 검증 시점", value: latestAt ? pointDateLabel(latestAt) : "없음", note: "선택일 이후 실제 수집 결과" },
      { label: "검증 제품군", value: testedItems, note: `${fmtNum(items.length)}개 중 결과 판정 가능`, suffix: "개" },
      { label: "적중률", value: hitRate == null ? "검증 불가" : hitRate, note: "확대/방어/유지 판단 기준", suffix: "%", decimals: 0 },
      { label: "중국 신호", value: rawNews().filter(isChinaArticle).length + benchmarkSignalTotal(), note: "뉴스·벤치마킹 최신 신호", suffix: "건" },
    ];
    summary.innerHTML = summaryCards.map((card) => `
      <article class="decision-stat reveal">
        <span>${escapeHTML(card.label)}</span>
        <strong>${typeof card.value === "number" ? countHTML(card.value, { suffix: card.suffix || "", decimals: card.decimals || 0 }) : escapeHTML(card.value)}</strong>
        <small>${escapeHTML(card.note)}</small>
      </article>
    `).join("");

    grid.innerHTML = items.map((item, index) => `
      <button class="decision-card reveal${item.id === active?.id ? " active" : ""}" type="button" data-decision-product="${escapeHTML(item.id)}" style="--local-accent:${categoryAccent(item.category)}; animation-delay:${index * 25}ms">
        <div class="decision-card-top">
          ${scoreRingHTML(item.confidence, "Data")}
          <span>
            <small>${escapeHTML(item.demand)}</small>
            <strong>${escapeHTML(item.label)}</strong>
            <em>${escapeHTML(item.decision.label)} · ${escapeHTML(item.outcome.label)}</em>
          </span>
        </div>
        <div class="decision-card-metrics">
          <span>당시 ${item.priorMomentum == null ? "NA" : `${fmtNum(item.priorMomentum, 2)}%`}</span>
          <span>이후 ${item.actualChange == null ? "NA" : `${fmtNum(item.actualChange, 2)}%`}</span>
          <span>${escapeHTML(decisionClassLabel(item))}</span>
        </div>
      </button>
    `).join("") || `<div class="empty">선택한 카테고리에 연결된 경영진 의사결정 항목이 없습니다.</div>`;

    if (active) {
      const payload = {
        type: "경영진 의사결정 백테스트",
        tag: active.demand,
        title: active.label,
        body: `${active.rationale} 선택 시점 판단: ${active.decision.label}. 이후 실제 변화: ${active.actualChange == null ? "데이터 부족" : `${fmtNum(active.actualChange, 2)}%`}.`,
        section: "executive-decision",
        categories: [active.category],
        watch: [active.decision.logic, active.upside, active.downside],
        tags: active.products || [],
        metrics: [
          { label: "당시 모멘텀", value: active.priorMomentum == null ? "NA" : `${fmtNum(active.priorMomentum, 2)}%` },
          { label: "이후 실제 변화", value: active.actualChange == null ? "NA" : `${fmtNum(active.actualChange, 2)}%` },
          { label: "관측 품목", value: fmtNum(active.observations.length) },
          { label: "중국 신호", value: fmtNum(active.chinaSignalCount) },
        ],
      };
      focus.style.setProperty("--local-accent", categoryAccent(active.category));
      focus.innerHTML = `
        <div class="decision-focus-head">
          <span class="chip accent">${escapeHTML(active.demand)}</span>
          <h3>${escapeHTML(active.label)}</h3>
          <p>${escapeHTML(active.rationale)}</p>
        </div>
        <div class="decision-verdict ${escapeHTML(active.decision.cls)}">
          <strong>${escapeHTML(active.decision.label)}</strong>
          <span>${escapeHTML(active.decision.action)}</span>
          <small>${escapeHTML(active.decision.logic)}</small>
        </div>
        <div class="metric-row">
          <div class="metric"><strong>${active.priorMomentum == null ? "NA" : `${fmtNum(active.priorMomentum, 2)}%`}</strong><span>선택 시점 직전</span></div>
          <div class="metric"><strong>${active.actualChange == null ? "NA" : `${fmtNum(active.actualChange, 2)}%`}</strong><span>이후 실제</span></div>
          <div class="metric"><strong>${fmtNum(active.observations.length)}</strong><span>관측 품목</span></div>
        </div>
        <div class="decision-outcome ${escapeHTML(active.outcome.cls)}">
          <strong>${escapeHTML(active.outcome.label)}</strong>
          <span>선택일 ${escapeHTML(pointDateLabel(selected))} → 최신 ${escapeHTML(active.latestAt ? pointDateLabel(active.latestAt) : "없음")}</span>
        </div>
        <div class="decision-focus-block">
          <strong>SK하이닉스 제품군</strong>
          <div class="tag-row">${(active.products || []).map((product) => `<span class="tag">${escapeHTML(product)}</span>`).join("")}</div>
        </div>
        <div class="decision-focus-block">
          <strong>경영진 체크포인트</strong>
          <ul class="watch-list">
            <li>${escapeHTML(active.upside)}</li>
            <li>${escapeHTML(active.downside)}</li>
            <li>중국 관련 최신 신호 ${fmtNum(active.chinaSignalCount)}건은 과거 판정에는 넣지 않고 현재 리스크 overlay로만 표시합니다.</li>
          </ul>
        </div>
        <div class="focus-actions">
          <button type="button" data-decision-copy>복사</button>
          <button type="button" data-decision-inspector>상세 패널</button>
          <button type="button" data-decision-prices>가격표 보기</button>
        </div>
      `;
      focus.querySelector("[data-decision-copy]")?.addEventListener("click", (event) => copyPayload(payload, event.currentTarget));
      focus.querySelector("[data-decision-inspector]")?.addEventListener("click", () => openInspector(payload));
      focus.querySelector("[data-decision-prices]")?.addEventListener("click", () => jumpTo("prices"));

      evidence.innerHTML = `
        <div class="crawler-panel-head">
          <h3>백테스트 근거 데이터</h3>
          <span>실제 가격 series · proxy 명시 · 선택 시점 이후 결과</span>
        </div>
        ${active.observations.length ? `
          <div class="decision-table-wrap">
            <table class="decision-table">
              <thead>
                <tr>
                  <th>품목</th>
                  <th>가격표</th>
                  <th>선택일 가격</th>
                  <th>최신 가격</th>
                  <th>실제 변화</th>
                  <th>관측 기간</th>
                </tr>
              </thead>
              <tbody>
                ${active.observations.slice(0, 16).map((obs) => `
                  <tr>
                    <td>${escapeHTML(obs.item)}</td>
                    <td>${escapeHTML(obs.sectionTitle || obs.group)}</td>
                    <td>${fmtNum(obs.startAvg, 3)}</td>
                    <td>${fmtNum(obs.latestAvg, 3)}</td>
                    <td><span class="change ${obs.actualChange > 0 ? "up" : obs.actualChange < 0 ? "down" : "flat"}">${obs.actualChange > 0 ? "+" : ""}${fmtNum(obs.actualChange, 2)}%</span></td>
                    <td>${fmtNum(obs.days, 1)}일</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : `<div class="empty">선택한 시점 이후 실제 결과를 계산할 수 있는 가격 포인트가 없습니다. 더 많은 일일 수집이 누적되면 자동으로 백테스트가 열립니다.</div>`}
      `;
    } else {
      focus.innerHTML = `<div class="empty">제품군을 선택하면 의사결정 근거가 열립니다.</div>`;
      evidence.innerHTML = "";
    }

    grid.querySelectorAll("[data-decision-product]").forEach((btn) => {
      btn.addEventListener("click", () => {
        execDecisionFocusId = btn.dataset.decisionProduct;
        renderExecutiveDecision();
      });
      btn.addEventListener("mouseenter", () => {
        if (execDecisionFocusId === btn.dataset.decisionProduct) return;
        execDecisionFocusId = btn.dataset.decisionProduct;
        renderExecutiveDecision();
      });
    });
    animateCounts(summary);
    animateCounts(grid);
    animateMeters(grid);
  }

  function investmentPriceRows(item) {
    const terms = (item.keywords || []).map((term) => String(term).toLowerCase()).filter(Boolean);
    if (!terms.length) return [];
    return allPriceRows().filter((row) => {
      const hay = `${row.group || ""} ${row.sectionTitle || ""} ${row.item || ""}`.toLowerCase();
      return terms.some((term) => hay.includes(term));
    });
  }

  function investmentPriceMomentum(item) {
    const values = investmentPriceRows(item)
      .map((row) => Number(row.changePct))
      .filter((value) => Number.isFinite(value));
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function investmentEvidenceLinks(item, limit = 4) {
    const terms = (item.keywords || []).map((term) => String(term).toLowerCase()).filter(Boolean);
    const seen = new Set();
    return rawNews().filter((news) => {
      const hay = `${news.title || ""} ${news.titleKo || ""} ${news.summary || ""} ${news.source || ""}`.toLowerCase();
      return terms.some((term) => hay.includes(term));
    }).filter((news) => {
      const key = `${news.title || ""} ${news.source || ""}`.toLowerCase().replace(/\s+/g, " ").trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, limit);
  }

  function investmentSignalCount(item) {
    const terms = (item.keywords || []).map((term) => String(term).toLowerCase()).filter(Boolean);
    const categoryCount = (item.linkedCategories || []).reduce((sum, id) => {
      const category = liveNewsCategory(id);
      return sum + (Number(category?.count ?? category?.items?.length ?? 0) || 0);
    }, 0);
    const axisCount = CHINA_DYNAMIC_AXES.reduce((sum, axis) => {
      const axisText = `${axis.id || ""} ${axis.title || ""} ${axis.label || ""} ${(axis.keywords || []).join(" ")}`.toLowerCase();
      const categoryHit = (axis.categoryIds || []).some((id) => (item.linkedCategories || []).includes(id));
      return sum + (categoryHit || terms.some((term) => axisText.includes(term)) ? axisSignalCount(axis) : 0);
    }, 0);
    return investmentEvidenceLinks(item, 999).length + Math.round(categoryCount / 8) + axisCount + investmentPriceRows(item).length;
  }

  function managementStrategyItems() {
    return INVESTMENT_STRATEGY_PILLARS.map((item) => {
      const signals = investmentSignalCount(item);
      const priceMomentum = investmentPriceMomentum(item);
      const chinaRisk = (item.linkedCategories || []).includes("china") ? rawNews().filter(isChinaArticle).length * .06 : 0;
      const score = clamp(item.baseScore + Math.min(signals, 160) * .08 + priceMomentum * 1.8 + chinaRisk);
      return {
        ...item,
        signals,
        priceRows: investmentPriceRows(item).length,
        priceMomentum,
        score,
        links: investmentEvidenceLinks(item, 5),
      };
    });
  }

  function strategicInvestmentDecisionItems() {
    const strategyMap = new Map(managementStrategyItems().map((item) => [item.id, item]));
    return STRATEGIC_INVESTMENT_DECISIONS.map((item) => {
      const strategy = strategyMap.get(item.linkedStrategy);
      const signals = investmentSignalCount(item) + Math.round((strategy?.signals || 0) * .45);
      const priceMomentum = investmentPriceMomentum(item);
      const score = clamp(item.baseScore + Math.min(signals, 180) * .07 + priceMomentum * 1.5 + ((strategy?.score || 0) - 70) * .18);
      return {
        ...item,
        strategy,
        signals,
        priceRows: investmentPriceRows(item).length,
        priceMomentum,
        score,
        links: investmentEvidenceLinks(item, 5).concat(strategy?.links || []).slice(0, 5),
      };
    });
  }

  function investmentAverageScore(items = []) {
    return items.length ? items.reduce((sum, item) => sum + item.score, 0) / items.length : 0;
  }

  function investmentPayload(item, section) {
    return {
      type: section === "management-strategy" ? "경영전략 수립" : "전략적 의사 결정",
      tag: item.role || item.option || "Investment",
      title: item.title,
      body: item.thesis || item.logic,
      section,
      categories: item.linkedCategories || [],
      watch: (item.triggers || item.gate || []).concat(item.actions || item.action || []),
      tags: [item.label, item.capital, item.allocation, item.stage].filter(Boolean),
      links: item.links || [],
      metrics: [
        { label: "Score", value: fmtNum(item.score) },
        { label: "Signal", value: fmtNum(item.signals) },
        { label: "Price rows", value: fmtNum(item.priceRows || 0) },
      ],
    };
  }

  function investmentSummaryHTML(cards) {
    return cards.map((card) => `
      <article class="investment-stat reveal">
        <span>${escapeHTML(card.label)}</span>
        <strong>${typeof card.value === "number" ? countHTML(card.value, { suffix: card.suffix || "", decimals: card.decimals || 0 }) : escapeHTML(card.value)}</strong>
        <small>${escapeHTML(card.note)}</small>
      </article>
    `).join("");
  }

  function renderInvestmentFocus(target, item, section) {
    if (!target || !item) return;
    const payload = investmentPayload(item, section);
    target.style.setProperty("--local-accent", categoryAccent((item.linkedCategories || [])[0]));
    target.innerHTML = `
      <div class="investment-focus-head">
        <span class="chip accent">${escapeHTML(item.label)} · ${escapeHTML(item.role || item.option)}</span>
        <h3>${escapeHTML(item.title)}</h3>
        <p>${escapeHTML(item.thesis || item.logic)}</p>
      </div>
      <div class="metric-row">
        <div class="metric"><strong>${fmtNum(item.score)}</strong><span>Score</span></div>
        <div class="metric"><strong>${fmtNum(item.signals)}</strong><span>Signal</span></div>
        <div class="metric"><strong>${item.allocation ? escapeHTML(item.allocation) : escapeHTML(item.stage || "Gate")}</strong><span>${item.allocation ? "배분" : "판단"}</span></div>
      </div>
      <div class="investment-focus-block">
        <strong>투자 관점</strong>
        <p>${escapeHTML(item.capital || item.action || "")}</p>
      </div>
      <div class="investment-focus-block">
        <strong>${section === "management-strategy" ? "전략 실행" : "의사결정 게이트"}</strong>
        <ul class="watch-list">${(item.actions || item.gate || []).map((line) => `<li>${escapeHTML(line)}</li>`).join("")}</ul>
      </div>
      <div class="investment-focus-block">
        <strong>매일 확인할 신호</strong>
        <ul class="watch-list">${(item.triggers || item.gate || []).map((line) => `<li>${escapeHTML(line)}</li>`).join("")}</ul>
      </div>
      ${item.links?.length ? `
        <div class="investment-focus-block">
          <strong>관련 최신 기사/신호</strong>
          <ul class="work-link-list">${item.links.map((link) => `<li><a href="${escapeHTML(link.link || "#")}" target="_blank" rel="noopener">${escapeHTML(newsTitle(link) || link.title || "Signal")}</a></li>`).join("")}</ul>
        </div>
      ` : ""}
      <div class="focus-actions">
        <button type="button" data-investment-copy>복사</button>
        <button type="button" data-investment-inspector>상세 패널</button>
        <button type="button" data-investment-workbench>워크벤치</button>
      </div>
    `;
    target.querySelector("[data-investment-copy]")?.addEventListener("click", (event) => copyPayload(payload, event.currentTarget));
    target.querySelector("[data-investment-inspector]")?.addEventListener("click", () => openInspector(payload));
    target.querySelector("[data-investment-workbench]")?.addEventListener("click", () => {
      workbenchMode = section === "management-strategy" ? "strategy-formulation" : "investment-decision";
      selectedInsightId = null;
      renderWorkbench();
      jumpTo("workbench");
    });
  }

  function renderManagementStrategy() {
    const summary = $("#managementStrategySummary");
    const flow = $("#managementStrategyFlow");
    const grid = $("#managementStrategyGrid");
    const focus = $("#managementStrategyFocus");
    const meta = $("#managementStrategyMeta");
    if (!summary || !flow || !grid || !focus) return;

    const items = managementStrategyItems();
    if (!items.some((item) => item.id === managementStrategyFocusId)) managementStrategyFocusId = items[0]?.id || "hbm-premium";
    const selected = items.find((item) => item.id === managementStrategyFocusId) || items[0];
    const totalSignals = items.reduce((sum, item) => sum + item.signals, 0);
    const avgScore = investmentAverageScore(items);
    const chinaSignals = rawNews().filter(isChinaArticle).length + benchmarkSignalTotal();
    if (meta) meta.textContent = `${fmtNum(items.length)}개 투자 테마 · ${fmtNum(totalSignals)}개 신호 · ${fmtDate(LIVE.updatedAt)}`;

    summary.innerHTML = investmentSummaryHTML([
      { label: "투자 테마", value: items.length, note: "성장·방어·옵션·리스크 분리", suffix: "개" },
      { label: "평균 확신도", value: avgScore, note: "크롤링 신호 기반 점수", suffix: "%", decimals: 0 },
      { label: "중국 관련 신호", value: chinaSignals, note: "뉴스·벤치마킹·정책 신호", suffix: "건" },
      { label: "가격 근거", value: allPriceRows().length, note: "TrendForce spot/contract rows", suffix: "rows" },
    ]);

    const flowSteps = [
      { label: "1. 수집", note: "가격·뉴스·채용·중국 다이내믹스" },
      { label: "2. 전략 가설", note: "HBM 성장, NAND 방어, CXL 옵션" },
      { label: "3. 투자 테마", note: "CAPEX·JV·소수지분·공급계약" },
      { label: "4. KPI", note: "신호 수, 가격 모멘텀, 실행 게이트" },
    ];
    flow.innerHTML = flowSteps.map((step, index) => `
      <article class="investment-flow-step reveal" style="animation-delay:${index * 30}ms">
        <strong>${escapeHTML(step.label)}</strong>
        <span>${escapeHTML(step.note)}</span>
      </article>
    `).join("");

    grid.innerHTML = items.map((item, index) => `
      <button class="investment-card reveal${item.id === selected?.id ? " active" : ""}" type="button" data-management-strategy="${escapeHTML(item.id)}" style="--local-accent:${categoryAccent((item.linkedCategories || [])[0])}; animation-delay:${index * 25}ms">
        ${scoreRingHTML(item.score, "Score")}
        <span>
          <small>${escapeHTML(item.role)} · ${escapeHTML(item.allocation)}</small>
          <strong>${escapeHTML(item.label)}</strong>
          <em>${fmtNum(item.signals)} signals · ${escapeHTML(item.capital)}</em>
        </span>
      </button>
    `).join("");
    renderInvestmentFocus(focus, selected, "management-strategy");
    grid.querySelectorAll("[data-management-strategy]").forEach((btn) => {
      btn.addEventListener("click", () => {
        managementStrategyFocusId = btn.dataset.managementStrategy;
        renderManagementStrategy();
      });
    });
    animateCounts(summary);
    animateCounts(grid);
    animateMeters(grid);
  }

  function renderStrategicInvestmentDecision() {
    const summary = $("#strategicDecisionSummary");
    const grid = $("#strategicDecisionGrid");
    const focus = $("#strategicDecisionFocus");
    const evidence = $("#strategicDecisionEvidence");
    const meta = $("#strategicDecisionMeta");
    if (!summary || !grid || !focus || !evidence) return;

    const items = strategicInvestmentDecisionItems();
    if (!items.some((item) => item.id === strategicDecisionFocusId)) strategicDecisionFocusId = items[0]?.id || "hbm-packaging-jv";
    const selected = items.find((item) => item.id === strategicDecisionFocusId) || items[0];
    const totalSignals = items.reduce((sum, item) => sum + item.signals, 0);
    const goCount = items.filter((item) => /go/i.test(item.stage)).length;
    const defendCount = items.filter((item) => /defend|hold/i.test(item.stage)).length;
    if (meta) meta.textContent = `${fmtNum(items.length)}개 투자 옵션 · ${fmtNum(totalSignals)}개 근거 신호 · ${fmtDate(LIVE.updatedAt)}`;

    summary.innerHTML = investmentSummaryHTML([
      { label: "투자 옵션", value: items.length, note: "인수·JV·소수지분·방어·보류", suffix: "개" },
      { label: "Go 안건", value: goCount, note: "즉시 상정 가능한 투자 판단", suffix: "개" },
      { label: "방어/보류", value: defendCount, note: "중국 가격 압력 대응 안건", suffix: "개" },
      { label: "평균 확신도", value: investmentAverageScore(items), note: "전략 테마와 live 신호 결합", suffix: "%", decimals: 0 },
    ]);

    grid.innerHTML = items.map((item, index) => `
      <button class="investment-card reveal${item.id === selected?.id ? " active" : ""}" type="button" data-strategic-decision="${escapeHTML(item.id)}" style="--local-accent:${categoryAccent((item.linkedCategories || [])[0])}; animation-delay:${index * 25}ms">
        ${scoreRingHTML(item.score, "Fit")}
        <span>
          <small>${escapeHTML(item.stage)} · ${escapeHTML(item.option)}</small>
          <strong>${escapeHTML(item.label)}</strong>
          <em>${fmtNum(item.signals)} signals · ${escapeHTML(item.capital)}</em>
        </span>
      </button>
    `).join("");
    renderInvestmentFocus(focus, selected, "strategic-investment-decision");

    const evidenceLinks = selected?.links || [];
    evidence.innerHTML = `
      <div>
        <span>Decision evidence</span>
        <strong>${escapeHTML(selected?.label || "투자 옵션")}</strong>
        <small>${escapeHTML(selected?.action || "")}</small>
      </div>
      <ul class="work-link-list">
        ${evidenceLinks.length ? evidenceLinks.map((link) => `<li><a href="${escapeHTML(link.link || "#")}" target="_blank" rel="noopener">${escapeHTML(newsTitle(link) || link.title || "Signal")}</a></li>`).join("") : `<li><em>현재 선택 옵션에 연결된 최신 기사 신호가 없습니다.</em></li>`}
      </ul>
    `;

    grid.querySelectorAll("[data-strategic-decision]").forEach((btn) => {
      btn.addEventListener("click", () => {
        strategicDecisionFocusId = btn.dataset.strategicDecision;
        renderStrategicInvestmentDecision();
      });
    });
    animateCounts(summary);
    animateCounts(grid);
    animateMeters(grid);
  }

  function projectionAnchorDate() {
    const date = new Date(LIVE.updatedAt || Date.now());
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }

  function addMonths(date, months) {
    const copy = new Date(date.getTime());
    const day = copy.getDate();
    copy.setMonth(copy.getMonth() + months);
    if (copy.getDate() < day) copy.setDate(0);
    return copy;
  }

  function projectionWindowData() {
    const anchor = projectionAnchorDate();
    const start = addMonths(anchor, PROJECTION_START_MONTHS);
    const years = Array.from({ length: PROJECTION_YEAR_COUNT }, (_, index) => String(start.getFullYear() + index));
    const end = addMonths(start, PROJECTION_YEAR_COUNT * 12 - 1);
    return {
      anchor,
      start,
      end,
      years,
      rangeLabel: `${start.getFullYear()}~${end.getFullYear()}`,
      detail: `${start.getFullYear()}.${start.getMonth() + 1} 시작 · ${PROJECTION_YEAR_COUNT}년`,
    };
  }

  function textHasAny(text, terms = []) {
    const hay = String(text || "").toLowerCase();
    return terms.some((term) => hay.includes(String(term || "").toLowerCase()));
  }

  function projectionPriceRows(segment) {
    const terms = (segment.priceTerms || segment.keywords || []).map((term) => String(term).toLowerCase());
    return allPriceRows().filter((row) => {
      const hay = `${row.group || ""} ${row.sectionTitle || ""} ${row.item || ""}`.toLowerCase();
      return terms.some((term) => hay.includes(term));
    });
  }

  function projectionPriceMomentum(segment) {
    const values = projectionPriceRows(segment)
      .map((row) => Number(row.changePct))
      .filter((value) => Number.isFinite(value));
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function projectionNewsLinks(segment, limit = 4) {
    const terms = (segment.keywords || []).map((term) => String(term).toLowerCase()).filter(Boolean);
    const seen = new Set();
    return rawNews().filter((news) => {
      const hay = `${news.title || ""} ${news.titleKo || ""} ${news.summary || ""} ${news.source || ""}`.toLowerCase();
      return terms.some((term) => hay.includes(term));
    }).filter((news) => {
      const key = `${news.title || ""} ${news.source || ""}`.toLowerCase().replace(/\s+/g, " ").trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, limit);
  }

  function projectionSignalCount(segment) {
    const terms = (segment.keywords || []).map((term) => String(term).toLowerCase()).filter(Boolean);
    const newsCount = projectionNewsLinks(segment, 999).length;
    const categoryCount = (segment.linkedCategories || []).reduce((sum, id) => {
      const category = liveNewsCategory(id);
      return sum + (Number(category?.count ?? category?.items?.length ?? 0) || 0);
    }, 0);
    const benchmarkCount = (LIVE.benchmarkSignals?.themes || []).reduce((sum, theme) => {
      const hay = `${theme.id || ""} ${theme.label || ""}`.toLowerCase();
      return sum + (terms.some((term) => hay.includes(term)) ? Number(theme.count ?? theme.items?.length ?? 0) || 0 : 0);
    }, 0);
    return newsCount + Math.round(categoryCount / 6) + benchmarkCount + projectionPriceRows(segment).length;
  }

  function projectionTotalSignals() {
    return SKHYNIX_PRODUCT_PROJECTION.reduce((sum, segment) => sum + projectionSignalCount(segment), 0);
  }

  function productProjectionSegments() {
    const chinaPressure = axisSignalCount(CHINA_DYNAMIC_AXES.find((axis) => axis.id === "capacity")) + axisSignalCount(CHINA_DYNAMIC_AXES.find((axis) => axis.id === "policy"));
    return SKHYNIX_PRODUCT_PROJECTION.map((segment) => {
      const signals = projectionSignalCount(segment);
      const priceMomentum = projectionPriceMomentum(segment);
      const chinaPenalty = segment.id === "legacy" || segment.id === "mobile-pc" ? Math.min(chinaPressure, 100) * .06 : 0;
      const storageChinaWatch = segment.id === "dc-storage" ? Math.min(axisSignalCount(CHINA_DYNAMIC_AXES.find((axis) => axis.id === "equipment")), 60) * .05 : 0;
      const score = clamp(segment.baseScore + Math.min(signals, 160) * .08 + priceMomentum * 2 - chinaPenalty + storageChinaWatch);
      return {
        ...segment,
        signals,
        priceRows: projectionPriceRows(segment).length,
        priceMomentum,
        score,
        links: projectionNewsLinks(segment, 4),
      };
    });
  }

  function projectionScenarioData(id = projectionScenario) {
    return PROJECTION_SCENARIOS.find((scenario) => scenario.id === id) || PROJECTION_SCENARIOS[0];
  }

  function projectionScenarioDelta(segment, scenario, ratio) {
    if (!segment || !scenario || scenario.id === "neutral") return 0;
    const chinaPressure = axisSignalCount(CHINA_DYNAMIC_AXES.find((axis) => axis.id === "capacity")) + axisSignalCount(CHINA_DYNAMIC_AXES.find((axis) => axis.id === "equipment")) + rawNews().filter(isChinaArticle).length;
    let delta = 0;
    if (segment.id === "ai-server") delta += scenario.serverLift || 0;
    if (segment.id === "dc-storage") delta += scenario.storageLift || 0;
    if (segment.id === "mobile-pc" || segment.id === "auto-edge") delta += scenario.terminalLift || 0;
    if (segment.id === "legacy") delta += scenario.legacyLift || 0;

    if (scenario.id === "best" && segment.id === "ai-server") delta += Math.min(segment.signals || 0, 140) * .018;
    if (scenario.id === "best" && segment.id === "dc-storage") delta += Math.max(segment.priceMomentum || 0, 0) * .22;
    if (scenario.id === "worst" && (segment.id === "mobile-pc" || segment.id === "legacy")) delta += Math.min(chinaPressure, 140) * .026;
    if (scenario.id === "worst" && segment.id === "ai-server") delta -= Math.max(segment.priceMomentum || 0, 0) * .16;

    return delta * ratio;
  }

  function projectionSeries(segments = productProjectionSegments(), scenarioId = projectionScenario) {
    const scenario = projectionScenarioData(scenarioId);
    const horizon = projectionWindowData();
    return horizon.years.map((year, index) => {
      const ratio = horizon.years.length <= 1 ? 0 : index / (horizon.years.length - 1);
      const raw = segments.map((segment) => {
        const base = segment.startShare + (segment.endShare - segment.startShare) * ratio;
        const liveBoost = (segment.score + scenario.scoreBias - 75) * segment.sensitivity * .09 * ratio;
        const priceBoost = segment.priceMomentum * .18 * ratio;
        return {
          segment,
          raw: Math.max(1, base + liveBoost + priceBoost + projectionScenarioDelta(segment, scenario, ratio)),
        };
      });
      const total = raw.reduce((sum, item) => sum + item.raw, 0) || 1;
      return {
        year,
        scenario: scenario.id,
        index,
        items: raw.map((item) => ({
          segment: item.segment,
          share: item.raw / total * 100,
        })),
      };
    });
  }

  function projectionScenarioSeriesMap(segments = productProjectionSegments()) {
    return PROJECTION_SCENARIOS.reduce((map, scenario) => {
      map[scenario.id] = projectionSeries(segments, scenario.id);
      return map;
    }, {});
  }

  function projectionShare(series, segmentId, point = -1) {
    const row = series.at(point) || series[series.length - 1];
    const found = row?.items?.find((item) => item.segment.id === segmentId);
    return found ? found.share : 0;
  }

  function projectionGroupShare(series, ids = [], point = -1) {
    return ids.reduce((sum, id) => sum + projectionShare(series, id, point), 0);
  }

  function projectionSegmentPayload(segment, series, scenario = projectionScenarioData()) {
    const start = projectionShare(series, segment.id, 0);
    const end = projectionShare(series, segment.id, -1);
    return {
      type: "제품군 프로젝션",
      tag: `${segment.demand} · ${scenario.label}`,
      title: segment.title,
      body: `${scenario.label} case: ${scenario.tone} ${segment.thesis} ${segment.risk}`,
      section: "projection",
      categories: segment.linkedCategories || [],
      watch: (segment.triggers || []).concat(segment.actions || []),
      tags: segment.products || [],
      links: segment.links || [],
      metrics: [
        { label: "T+30M", value: `${fmtNum(start, 1)}%` },
        { label: "5Y", value: `${fmtNum(end, 1)}%` },
        { label: "Case", value: scenario.label },
        { label: "Signal", value: fmtNum(segment.signals) },
        { label: "Score", value: fmtNum(segment.score) },
      ],
    };
  }

  function projectionDriverCards(segments, series, scenario = projectionScenarioData()) {
    const serverScore = (segments.find((item) => item.id === "ai-server")?.score || 0) * .58 + (segments.find((item) => item.id === "dc-storage")?.score || 0) * .42;
    const terminalScore = (segments.find((item) => item.id === "mobile-pc")?.score || 0) * .72 + (segments.find((item) => item.id === "auto-edge")?.score || 0) * .28;
    const chinaSignals = axisSignalCount(CHINA_DYNAMIC_AXES.find((axis) => axis.id === "capacity")) + axisSignalCount(CHINA_DYNAMIC_AXES.find((axis) => axis.id === "equipment")) + rawNews().filter(isChinaArticle).length;
    const nandMomentum = projectionPriceMomentum(segments.find((item) => item.id === "dc-storage") || {});
    return [
      {
        label: "선택 시나리오",
        value: scenario.label,
        score: clamp(70 + (scenario.id === "best" ? 16 : scenario.id === "worst" ? -12 : 0)),
        note: scenario.tone,
      },
      {
        label: "서버향 프리미엄",
        value: projectionGroupShare(series, ["ai-server", "dc-storage"]),
        suffix: "%",
        score: clamp(serverScore),
        note: "HBM·서버 DRAM·eSSD가 전사 믹스를 끌어올리는 축",
      },
      {
        label: "단말향 방어",
        value: projectionGroupShare(series, ["mobile-pc", "auto-edge"]),
        suffix: "%",
        score: clamp(terminalScore),
        note: "LPDDR·UFS·client SSD는 가격 방어와 고부가 선별이 핵심",
      },
      {
        label: "중국 가격 압력",
        value: chinaSignals,
        suffix: "건",
        score: clamp(chinaSignals * 1.15, 20, 100),
        note: "CXMT·YMTC 캐파, 장비 국산화, 정책자본 신호를 반영",
      },
      {
        label: "NAND/eSSD 모멘텀",
        value: nandMomentum,
        suffix: "%",
        decimals: 2,
        score: clamp(58 + nandMomentum * 8 + (segments.find((item) => item.id === "dc-storage")?.signals || 0) * .22),
        note: "TrendForce NAND/SSD 가격 rows와 eSSD 기사 신호 기반",
      },
    ];
  }

  function renderProductProjection() {
    const summary = $("#projectionSummary");
    const stack = $("#projectionStack");
    const tabs = $("#projectionTabs");
    const scenarioTabs = $("#projectionScenarioTabs");
    const scenarioChart = $("#projectionScenarioChart");
    const focus = $("#projectionFocus");
    const drivers = $("#projectionDrivers");
    const meta = $("#projectionMeta");
    const windowNode = $("#projectionWindow");
    if (!summary || !stack || !tabs || !scenarioTabs || !scenarioChart || !focus || !drivers) return;

    const horizon = projectionWindowData();
    const segments = productProjectionSegments();
    const scenario = projectionScenarioData();
    const scenarioMap = projectionScenarioSeriesMap(segments);
    const series = scenarioMap[scenario.id] || projectionSeries(segments, scenario.id);
    if (!segments.some((item) => item.id === projectionFocusId)) projectionFocusId = segments[0]?.id || "ai-server";
    const selected = segments.find((item) => item.id === projectionFocusId) || segments[0];
    const serverShare = projectionGroupShare(series, ["ai-server", "dc-storage"]);
    const terminalShare = projectionGroupShare(series, ["mobile-pc", "auto-edge"]);
    const bestServerShare = projectionGroupShare(scenarioMap.best || series, ["ai-server", "dc-storage"]);
    const worstServerShare = projectionGroupShare(scenarioMap.worst || series, ["ai-server", "dc-storage"]);
    const totalSignals = segments.reduce((sum, segment) => sum + segment.signals, 0);

    if (meta) meta.textContent = `${scenario.label} case · ${horizon.detail} · ${fmtNum(totalSignals)}개 신호 · ${fmtDate(LIVE.updatedAt)}`;
    if (windowNode) windowNode.textContent = `${horizon.rangeLabel} · 현재 수집일 +${PROJECTION_START_MONTHS}개월부터`;

    const summaryCards = [
      { label: "선택 케이스", value: scenario.label, note: scenario.tone },
      { label: "서버향 믹스", value: serverShare, note: "AI 서버 + 데이터센터 스토리지", suffix: "%", decimals: 1 },
      { label: "단말향 믹스", value: terminalShare, note: "모바일/PC + 오토/엣지", suffix: "%", decimals: 1 },
      { label: "서버향 3-case 범위", value: `${fmtNum(worstServerShare, 1)}~${fmtNum(bestServerShare, 1)}%`, note: "Worst~Best 5Y 민감도 범위" },
      { label: "크롤링 신호", value: totalSignals, note: "뉴스·가격·벤치마킹 반영", suffix: "건" },
    ];
    summary.innerHTML = summaryCards.map((card) => `
      <article class="projection-stat reveal">
        <span>${escapeHTML(card.label)}</span>
        <strong>${typeof card.value === "number" ? countHTML(card.value, { suffix: card.suffix || "", decimals: card.decimals || 0 }) : escapeHTML(card.value)}</strong>
        <small>${escapeHTML(card.note)}</small>
      </article>
    `).join("");

    scenarioTabs.innerHTML = PROJECTION_SCENARIOS.map((item) => {
      const itemSeries = scenarioMap[item.id] || series;
      const selectedShare = selected ? projectionShare(itemSeries, selected.id, -1) : 0;
      return `
        <button class="projection-scenario-tab reveal${item.id === scenario.id ? " active" : ""}" type="button" data-projection-scenario="${escapeHTML(item.id)}">
          <span>${escapeHTML(item.label)}</span>
          <strong>${escapeHTML(item.sub)}</strong>
          <em>${selected ? escapeHTML(selected.short) : "Product"} 5Y ${fmtNum(selectedShare, 1)}%</em>
        </button>
      `;
    }).join("");

    scenarioChart.innerHTML = PROJECTION_SCENARIOS.map((item, index) => {
      const itemSeries = scenarioMap[item.id] || series;
      const itemServer = projectionGroupShare(itemSeries, ["ai-server", "dc-storage"]);
      const itemTerminal = projectionGroupShare(itemSeries, ["mobile-pc", "auto-edge"]);
      const itemSelected = selected ? projectionShare(itemSeries, selected.id, -1) : 0;
      return `
        <button class="scenario-card reveal${item.id === scenario.id ? " active" : ""}" type="button" data-projection-scenario="${escapeHTML(item.id)}" style="animation-delay:${index * 35}ms">
          <div class="scenario-card-head">
            <span>${escapeHTML(item.label)}</span>
            <strong>${countHTML(itemSelected, { suffix: "%", decimals: 1 })}</strong>
          </div>
          <p>${escapeHTML(item.tone)}</p>
          <div class="scenario-bars">
            <div class="scenario-bar-row">
              <span>서버향</span>
              <i><b data-fill-to="${clamp(itemServer)}" style="width:0%"></b></i>
              <em>${fmtNum(itemServer, 1)}%</em>
            </div>
            <div class="scenario-bar-row">
              <span>단말향</span>
              <i><b data-fill-to="${clamp(itemTerminal)}" style="width:0%"></b></i>
              <em>${fmtNum(itemTerminal, 1)}%</em>
            </div>
            <div class="scenario-bar-row">
              <span>${selected ? escapeHTML(selected.short) : "선택"}</span>
              <i><b data-fill-to="${clamp(itemSelected)}" style="width:0%"></b></i>
              <em>${fmtNum(itemSelected, 1)}%</em>
            </div>
          </div>
        </button>
      `;
    }).join("");

    stack.innerHTML = series.map((row, rowIndex) => `
      <article class="projection-year reveal" style="animation-delay:${rowIndex * 30}ms">
        <div class="projection-year-head">
          <strong>${escapeHTML(row.year)}</strong>
          <span>${rowIndex === 0 ? "T+30M" : `Y+${rowIndex}`}</span>
        </div>
        <div class="projection-bar" aria-label="${escapeHTML(row.year)} 제품군 믹스">
          ${row.items.map((item) => `
            <button class="projection-bar-seg${item.segment.id === selected?.id ? " active" : ""}" type="button" data-projection-seg="${escapeHTML(item.segment.id)}" style="--w:${item.share.toFixed(2)}%;--local-accent:${categoryAccent((item.segment.linkedCategories || [])[0])}" title="${escapeHTML(item.segment.label)} ${fmtNum(item.share, 1)}%">
              <span>${escapeHTML(item.segment.short)}</span>
            </button>
          `).join("")}
        </div>
        <div class="projection-year-list">
          ${row.items.map((item) => `
            <button type="button" data-projection-seg="${escapeHTML(item.segment.id)}">
              <span style="--local-accent:${categoryAccent((item.segment.linkedCategories || [])[0])}"></span>
              <em>${escapeHTML(item.segment.short)}</em>
              <strong>${fmtNum(item.share, 1)}%</strong>
            </button>
          `).join("")}
        </div>
      </article>
    `).join("");

    tabs.innerHTML = segments.map((segment, index) => {
      const endShare = projectionShare(series, segment.id, -1);
      return `
        <button class="projection-tab reveal${segment.id === selected?.id ? " active" : ""}" type="button" data-projection-tab="${escapeHTML(segment.id)}" style="--local-accent:${categoryAccent((segment.linkedCategories || [])[0])}; animation-delay:${index * 25}ms">
          ${scoreRingHTML(segment.score, "Score")}
          <span>
            <small>${escapeHTML(segment.demand)}</small>
            <strong>${escapeHTML(segment.label)}</strong>
            <em>5Y ${fmtNum(endShare, 1)}% · ${fmtNum(segment.signals)} signals</em>
          </span>
        </button>
      `;
    }).join("");

    if (selected) {
      const payload = projectionSegmentPayload(selected, series, scenario);
      const startShare = projectionShare(series, selected.id, 0);
      const endShare = projectionShare(series, selected.id, -1);
      focus.style.setProperty("--local-accent", categoryAccent((selected.linkedCategories || [])[0]));
      focus.innerHTML = `
        <div class="projection-focus-head">
          <span class="chip accent">${escapeHTML(selected.label)} · ${escapeHTML(scenario.label)}</span>
          <h3>${escapeHTML(selected.title)}</h3>
          <p>${escapeHTML(selected.thesis)}</p>
        </div>
        <div class="metric-row">
          <div class="metric"><strong>${fmtNum(startShare, 1)}%</strong><span>T+30개월</span></div>
          <div class="metric"><strong>${fmtNum(endShare, 1)}%</strong><span>5년차</span></div>
          <div class="metric"><strong>${fmtNum(selected.signals)}</strong><span>크롤링 신호</span></div>
        </div>
        <div class="projection-focus-block">
          <strong>제품군</strong>
          <div class="tag-row">${(selected.products || []).map((product) => `<span class="tag">${escapeHTML(product)}</span>`).join("")}</div>
        </div>
        <div class="projection-focus-block scenario-note">
          <strong>선택 케이스</strong>
          <p>${escapeHTML(scenario.tone)}</p>
        </div>
        <div class="projection-focus-block">
          <strong>전망 가정</strong>
          <ul class="watch-list">${(selected.assumptions || []).map((line) => `<li>${escapeHTML(line)}</li>`).join("")}</ul>
        </div>
        <div class="projection-focus-block">
          <strong>매일 확인할 트리거</strong>
          <ul class="watch-list">${(selected.triggers || []).map((line) => `<li>${escapeHTML(line)}</li>`).join("")}</ul>
        </div>
        <div class="insight-box"><span>리스크</span>${escapeHTML(selected.risk)}</div>
        ${selected.links?.length ? `
          <div class="projection-focus-block">
            <strong>관련 최신 기사</strong>
            <ul class="work-link-list">${selected.links.map((link) => `<li><a href="${escapeHTML(link.link || "#")}" target="_blank" rel="noopener">${escapeHTML(newsTitle(link) || link.title || "Signal")}</a></li>`).join("")}</ul>
          </div>
        ` : ""}
        <div class="focus-actions">
          <button type="button" data-projection-copy>복사</button>
          <button type="button" data-projection-inspector>상세 패널</button>
          <button type="button" data-projection-news>기사 보기</button>
        </div>
      `;
      focus.querySelector("[data-projection-copy]")?.addEventListener("click", (event) => copyPayload(payload, event.currentTarget));
      focus.querySelector("[data-projection-inspector]")?.addEventListener("click", () => openInspector(payload));
      focus.querySelector("[data-projection-news]")?.addEventListener("click", () => jumpTo("news"));
    }

    drivers.innerHTML = projectionDriverCards(segments, series, scenario).map((driver, index) => `
      <article class="projection-driver reveal" style="animation-delay:${index * 25}ms">
        <div>
          <span>${escapeHTML(driver.label)}</span>
          <strong>${countHTML(driver.value, { suffix: driver.suffix || "", decimals: driver.decimals || 0 })}</strong>
          <small>${escapeHTML(driver.note)}</small>
        </div>
        ${scoreRingHTML(driver.score, "Gauge")}
      </article>
    `).join("");

    $$("#projectionStack [data-projection-seg], #projectionTabs [data-projection-tab]").forEach((btn) => {
      const id = btn.dataset.projectionSeg || btn.dataset.projectionTab;
      btn.addEventListener("click", () => {
        projectionFocusId = id;
        renderProductProjection();
      });
      btn.addEventListener("mouseenter", () => {
        if (projectionFocusId === id) return;
        projectionFocusId = id;
        renderProductProjection();
      });
    });
    $$("#projectionScenarioTabs [data-projection-scenario], #projectionScenarioChart [data-projection-scenario]").forEach((btn) => {
      btn.addEventListener("click", () => {
        projectionScenario = btn.dataset.projectionScenario || "neutral";
        renderProductProjection();
      });
    });
    animateCounts(summary);
    animateCounts(scenarioTabs);
    animateCounts(scenarioChart);
    animateCounts(stack);
    animateCounts(tabs);
    animateCounts(drivers);
    animateMeters(scenarioChart);
    animateMeters(tabs);
    animateMeters(drivers);
  }

  function renderChinaDynamics() {
    const overview = $("#chinaDynamicsOverview");
    const grid = $("#chinaDynamicsGrid");
    const summary = $("#chinaDynamicsSummary");
    if (!overview || !grid) return;

    const chinaNewsCount = rawNews().filter(isChinaArticle).length;
    const chinaCategorySignals = Number(liveNewsCategory("china")?.count ?? chinaNewsCount) || chinaNewsCount;
    const benchmarkSignals = Number(LIVE.benchmarkSignals?.stats?.total ?? LIVE.benchmarkSignals?.stream?.length ?? 0) || 0;
    const equipmentSignals = axisSignalCount(CHINA_DYNAMIC_AXES.find((axis) => axis.id === "equipment"));
    const packagingSignals = axisSignalCount(CHINA_DYNAMIC_AXES.find((axis) => axis.id === "packaging"));
    const totalChinaSignals = benchmarkSignals + chinaCategorySignals;
    $("#chinaDynamicsMeta").textContent = `${fmtNum(totalChinaSignals)}개 핵심 신호 · ${fmtDate(LIVE.updatedAt)}`;

    if (summary) {
      const summaryLines = [
        `중국 메모리 생태계는 CXMT·YMTC 중심의 캐파 확대와 내수 AI 고객 확보를 통해 범용 DRAM/NAND 영향력을 키우고 있습니다`,
        `Naura·AMEC·ACM 장비 국산화 신호 ${fmtNum(equipmentSignals)}건과 JCET·XMC 패키징 우회 신호 ${fmtNum(packagingSignals)}건이 선단 제약을 보완하는 축입니다`,
        `빅펀드·수출통제 반작용, 인재/IP 이동, 수율 레시피 유출 가능성은 SK하이닉스가 별도로 추적해야 할 핵심 리스크입니다`,
      ];
      summary.innerHTML = summaryLines.map((line) => `<p>${escapeHTML(line)}</p>`).join("");
    }

    const overviewItems = [
      { label: "중국 기사", value: chinaNewsCount, note: "CXMT·YMTC·장비·패키징 관련" },
      { label: "벤치마킹 신호", value: benchmarkSignals, note: "캐파·장비·패키징·인재/IP" },
      { label: "장비 국산화", value: equipmentSignals, note: "Naura·AMEC·ACM 축" },
      { label: "패키징 우회로", value: packagingSignals, note: "JCET·XMC·HBM 조립" },
    ];
    overview.innerHTML = overviewItems.map((item) => `
      <article class="dyn-stat">
        <span>${escapeHTML(item.label)}</span>
        <strong>${countHTML(item.value)}</strong>
        <small>${escapeHTML(item.note)}</small>
      </article>
    `).join("");

    grid.innerHTML = "";
    CHINA_DYNAMIC_AXES.forEach((axis, index) => {
      const count = axisSignalCount(axis);
      const momentum = axisMomentum(count);
      const items = axisLiveItems(axis);
      const card = el("article", "china-dyn-card reveal");
      card.style.animationDelay = `${index * 35}ms`;
      card.style.setProperty("--local-accent", categoryAccent((axis.categoryIds || [])[0]));
      card.innerHTML = `
        <div class="dyn-card-head">
          <span class="chip accent">${escapeHTML(axis.label)}</span>
          <span class="dyn-level ${escapeHTML(momentum.cls)}">${escapeHTML(momentum.label)} · ${fmtNum(count)}</span>
        </div>
        <h3>${escapeHTML(axis.title)}</h3>
        <p>${escapeHTML(axis.pulse)}</p>
        <div class="tag-row">${(axis.watch || []).map((item) => `<span class="tag">${escapeHTML(item)}</span>`).join("")}</div>
        <ul class="dyn-feed">
          ${items.length ? items.map((item) => `
            <li>
              <span>${escapeHTML(item.source || item.theme || "Signal")}</span>
              <a href="${escapeHTML(item.link || "#")}" target="_blank" rel="noopener">${escapeHTML(newsTitle(item) || item.title || "")}</a>
            </li>
          `).join("") : `<li><span>Signal</span><em>수집된 최신 신호 없음</em></li>`}
        </ul>
      `;
      makeInspectable(card, {
        type: "중국 반도체 다이내믹스",
        tag: axis.label,
        title: axis.title,
        body: axis.pulse,
        section: "china-dynamics",
        categories: axis.categoryIds || [],
        watch: axis.watch || [],
        links: items,
        metrics: [
          { label: "Signal", value: fmtNum(count) },
          { label: "Momentum", value: momentum.label },
          { label: "Article", value: fmtNum(items.length) },
        ],
      });
      grid.appendChild(card);
    });
  }

  function talentRadarData() {
    return BASE.talentRadar || {
      summary: [],
      companySignals: [],
      meceSources: [],
      keywordTaxonomy: [],
      warningRules: [],
    };
  }

  function talentRelated(item) {
    if (activeCategory === "all") return true;
    const cats = item.linkedCategories || [];
    return !cats.length || cats.includes(activeCategory);
  }

  function renderTalentRadar() {
    const data = talentRadarData();
    const summary = $("#talentSummary");
    const companies = $("#talentCompanyGrid");
    const sources = $("#talentSourceGrid");
    const keywords = $("#talentKeywordGrid");
    const rules = $("#talentRuleGrid");
    const meta = $("#talentRadarMeta");
    if (!summary || !companies || !sources || !keywords || !rules) return;

    const companyItems = (data.companySignals || []).filter(talentRelated);
    const sourceItems = (data.meceSources || []).filter(talentRelated);
    const keywordItems = data.keywordTaxonomy || [];
    const ruleItems = data.warningRules || [];
    const liveTalentSignals = axisSignalCount(CHINA_DYNAMIC_AXES.find((axis) => axis.id === "talent"));
    if (meta) {
      meta.textContent = `${fmtNum(companyItems.length + sourceItems.length + keywordItems.length + ruleItems.length)}개 객체 · ${activeCategoryData().label} · 채용 신호 ${fmtNum(liveTalentSignals)}건`;
    }

    summary.innerHTML = (data.summary || []).map((line, index) => `
      <article class="talent-summary-line">
        <span>${String(index + 1).padStart(2, "0")}</span>
        <p>${escapeHTML(line)}</p>
      </article>
    `).join("");

    companies.innerHTML = "";
    companyItems.forEach((item, index) => {
      const payload = {
        type: "인재·채용 레이더",
        tag: item.company,
        title: item.title,
        body: item.thesis,
        section: "talent-radar",
        categories: item.linkedCategories || [],
        watch: (item.signals || []).concat(item.risk ? [item.risk] : []),
        tags: [item.company],
        metrics: item.metrics || [],
      };
      const card = el("article", "talent-company-card reveal");
      card.style.animationDelay = `${index * 35}ms`;
      card.style.setProperty("--local-accent", categoryAccent((item.linkedCategories || [])[0] || "talent"));
      card.innerHTML = `
        <div class="talent-card-head">
          <div>
            <span class="chip accent">${escapeHTML(item.company)}</span>
            <h3>${escapeHTML(item.title)}</h3>
          </div>
          <button class="copy-btn" type="button" data-copy-talent>복사</button>
        </div>
        <p>${escapeHTML(item.thesis || "")}</p>
        <div class="talent-metric-grid">${metricCards(item.metrics || [], 4)}</div>
        <div class="tag-row">${(item.signals || []).map((signal) => `<span class="tag">${escapeHTML(signal)}</span>`).join("")}</div>
        <div class="insight-box"><span>Risk interpretation</span>${escapeHTML(item.risk || "")}</div>
      `;
      card.querySelector("[data-copy-talent]")?.addEventListener("click", (event) => copyPayload(payload, event.currentTarget));
      makeInspectable(card, payload);
      companies.appendChild(card);
    });
    if (!companies.children.length) companies.appendChild(el("div", "empty", "선택한 카테고리의 회사별 채용 신호가 없습니다."));

    sources.innerHTML = "";
    sourceItems.forEach((item, index) => {
      const payload = {
        type: "크롤링 타깃",
        tag: item.axis,
        title: item.axis,
        body: item.why,
        section: "talent-radar",
        categories: item.linkedCategories || [],
        watch: item.signals || [],
        tags: (item.targets || []).map((target) => target.name),
        metrics: [
          { label: "Targets", value: fmtNum((item.targets || []).length) },
          { label: "Signals", value: fmtNum((item.signals || []).length) },
        ],
      };
      const card = el("article", "talent-source-card reveal");
      card.style.animationDelay = `${index * 30}ms`;
      card.style.setProperty("--local-accent", categoryAccent((item.linkedCategories || [])[0] || "talent"));
      card.innerHTML = `
        <div class="talent-card-head">
          <div>
            <span class="chip accent">${escapeHTML(item.axis)}</span>
            <h3>${escapeHTML(item.why || "")}</h3>
          </div>
          <button class="copy-btn" type="button" data-copy-source>복사</button>
        </div>
        <div class="source-row">${(item.targets || []).map((target) => `<a href="${escapeHTML(target.url || "#")}" target="_blank" rel="noopener">${escapeHTML(target.name || target.url || "Target")}</a>`).join("")}</div>
        <div class="tag-row">${(item.signals || []).map((signal) => `<span class="tag">${escapeHTML(signal)}</span>`).join("")}</div>
      `;
      card.querySelector("[data-copy-source]")?.addEventListener("click", (event) => copyPayload(payload, event.currentTarget));
      makeInspectable(card, payload);
      sources.appendChild(card);
    });
    if (!sources.children.length) sources.appendChild(el("div", "empty", "선택한 카테고리의 크롤링 타깃이 없습니다."));

    keywords.innerHTML = keywordItems.map((item, index) => `
      <article class="talent-keyword-card reveal" style="animation-delay:${index * 25}ms">
        <span class="chip accent">${escapeHTML(item.cluster)}</span>
        <div class="tag-row">${(item.keywords || []).map((keyword) => `<span class="tag">${escapeHTML(keyword)}</span>`).join("")}</div>
        <p>${escapeHTML(item.interpretation || "")}</p>
      </article>
    `).join("");

    rules.innerHTML = ruleItems.map((item, index) => `
      <article class="talent-rule-card reveal level-${escapeHTML(String(item.level || "watch").toLowerCase())}" style="animation-delay:${index * 25}ms">
        <strong>${escapeHTML(item.level || "Watch")}</strong>
        <p>${escapeHTML(item.rule || "")}</p>
      </article>
    `).join("");
  }

  function renderChinaDeepDive() {
    const grid = $("#chinaDeepGrid");
    const summary = $("#chinaDeepSummary");
    const meta = $("#chinaDeepMeta");
    if (!grid) return;

    const items = CHINA_DEEP_DIVE.filter(relatedToActive);
    if (meta) meta.textContent = `${fmtNum(items.length)}개 심층 항목 · ${activeCategoryData().label}`;
    if (summary) {
      const lines = [
        "중국 반도체의 핵심 방향은 EUV 부재를 DUV 멀티패터닝·Xtacking·첨단 패키징으로 우회하는 것입니다",
        "DRAM은 CXMT의 레거시 가격 압박, NAND는 YMTC의 내수 보조금과 Xtacking 확장이 먼저 위협으로 나타납니다",
        "SK하이닉스는 HBM 초격차와 동시에 레거시 원가 방어, 소부장/JV 감시, 인재/IP 리스크 방어를 병행해야 합니다",
      ];
      summary.innerHTML = lines.map((line) => `<p>${escapeHTML(line)}</p>`).join("");
    }

    grid.innerHTML = "";
    items.forEach((item, index) => {
      const card = el("article", "china-deep-card reveal");
      card.style.animationDelay = `${index * 35}ms`;
      card.style.setProperty("--local-accent", categoryAccent((item.linkedCategories || [])[0]));
      card.innerHTML = `
        <div class="deep-card-head">
          <span class="chip accent">${escapeHTML(item.tag)}</span>
          <span class="deep-index">${String(index + 1).padStart(2, "0")}</span>
        </div>
        <h3>${escapeHTML(item.title)}</h3>
        <p>${escapeHTML(item.thesis)}</p>
        <div class="deep-facts">
          ${(item.facts || []).map((fact) => `<span>${escapeHTML(fact)}</span>`).join("")}
        </div>
        <div class="insight-box"><span>리스크</span>${escapeHTML(item.risk)}</div>
        <div class="deep-implication"><strong>SK하이닉스 시사점</strong><span>${escapeHTML(item.implication)}</span></div>
      `;
      makeInspectable(card, {
        type: "중국 심층 벤치마킹",
        tag: item.tag,
        title: item.title,
        body: item.thesis,
        section: "china-deep-dive",
        categories: item.linkedCategories || [],
        watch: [item.risk, item.implication].concat(item.facts || []),
        metrics: (item.facts || []).slice(0, 3).map((fact, idx) => ({ label: `핵심 ${idx + 1}`, value: fact })),
      });
      grid.appendChild(card);
    });

    if (!items.length) grid.appendChild(el("div", "empty", "선택한 카테고리의 심층 벤치마킹 항목이 없습니다."));
  }

  function inferCategoriesFromText(text) {
    const hay = String(text || "").toLowerCase();
    return memoryCategories()
      .filter((cat) => cat.id !== "all")
      .filter((cat) => (cat.keywords || []).some((term) => hay.includes(String(term).toLowerCase())))
      .map((cat) => cat.id);
  }

  function responseLinkedCategories(item) {
    if (item.linkedCategories?.length) return item.linkedCategories;
    return inferCategoriesFromText(`${item.title || ""} ${item.desc || ""} ${(item.actions || []).join(" ")}`);
  }

  function workbenchItems(mode = workbenchMode) {
    let items = [];
    if (mode === "review") {
      items = dailyReviewItems().map((item) => ({
        id: `review-${item.id}`,
        mode,
        type: "일일 리뷰 큐",
        tag: `${item.priorityBand || "P3"} · ${item.reviewStatus || "New"}`,
        title: item.title,
        body: item.summary || item.body,
        section: item.section || "daily-review",
        categories: item.linkedCategories || item.categories || [],
        watch: (item.insights || []).concat(item.topics || []),
        metrics: [
          { label: "Score", value: fmtNum(item.priorityScore || 0) },
          { label: "Change", value: item.changeType || "New" },
          { label: "Source", value: item.source || "source" },
        ],
        links: item.sourceUrl ? [{ title: item.source || item.title, link: item.sourceUrl }] : [],
      }));
    }

    if (mode === "executive") {
      items = executiveBacktests().map((item) => ({
        id: `executive-${item.id}`,
        mode,
        type: "경영진 의사결정 백테스트",
        tag: `${item.demand} · ${item.decision.label}`,
        title: item.label,
        body: `${item.rationale} 이후 실제 변화 ${item.actualChange == null ? "데이터 부족" : `${fmtNum(item.actualChange, 2)}%`} · ${item.outcome.label}`,
        section: "executive-decision",
        categories: [item.category],
        watch: [item.decision.logic, item.upside, item.downside],
        metrics: [
          { label: "당시", value: item.priorMomentum == null ? "NA" : `${fmtNum(item.priorMomentum, 2)}%` },
          { label: "이후", value: item.actualChange == null ? "NA" : `${fmtNum(item.actualChange, 2)}%` },
          { label: "품목", value: fmtNum(item.observations.length) },
        ],
        tags: item.products || [],
      }));
    }

    if (mode === "strategy-formulation") {
      items = managementStrategyItems().map((item) => ({
        id: `strategy-${item.id}`,
        mode,
        type: "경영전략 수립",
        tag: `${item.role} · ${item.allocation}`,
        title: item.title,
        body: item.thesis,
        section: "management-strategy",
        categories: item.linkedCategories || [],
        watch: (item.triggers || []).concat(item.actions || []),
        metrics: [
          { label: "Score", value: fmtNum(item.score) },
          { label: "Signal", value: fmtNum(item.signals) },
          { label: "Capital", value: item.capital },
        ],
        tags: [item.label, item.horizon, item.allocation].filter(Boolean),
        links: item.links || [],
      }));
    }

    if (mode === "investment-decision") {
      items = strategicInvestmentDecisionItems().map((item) => ({
        id: `investment-${item.id}`,
        mode,
        type: "전략적 의사 결정",
        tag: `${item.stage} · ${item.option}`,
        title: item.title,
        body: item.logic,
        section: "strategic-investment-decision",
        categories: item.linkedCategories || [],
        watch: (item.gate || []).concat(item.action || []),
        metrics: [
          { label: "Score", value: fmtNum(item.score) },
          { label: "Signal", value: fmtNum(item.signals) },
          { label: "Capital", value: item.capital },
        ],
        tags: [item.label, item.option, item.stage].filter(Boolean),
        links: item.links || [],
      }));
    }

    if (mode === "crawler") {
      items = crawlerPipelineItems().map((item) => ({
        id: `crawler-${item.id}`,
        mode,
        type: "크롤링 관제",
        tag: item.label,
        title: item.output,
        body: `${item.source} · ${item.method}`,
        section: item.section,
        categories: item.linkedCategories || [],
        watch: item.fields.concat(item.filters),
        metrics: [
          { label: "신호", value: fmtNum(item.signalCount) },
          { label: "Health", value: item.status.label },
          { label: "Steps", value: fmtNum(item.health.length) },
        ],
      }));
    }

    if (mode === "nand") {
      items = CHINA_NAND_BUSINESS_LAYERS.map((item) => ({
        id: `nand-${item.id}`,
        mode,
        type: "중국 NAND 사업 강화",
        tag: item.role,
        title: item.title,
        body: item.risk,
        section: "china-nand",
        categories: item.linkedCategories || [],
        watch: (item.decisions || []).concat(item.crawl || []),
        metrics: (item.metrics || []).concat([
          { label: "Signal", value: fmtNum(nandBusinessSignalCount(item)) },
          { label: "Score", value: fmtNum(item.score) },
        ]),
        tags: [item.label].concat(item.crawl || []),
        links: nandBusinessLinks(item, 3),
      }));
    }

    if (mode === "architecture") {
      const matrix = architectureMatrix();
      items = []
        .concat((matrix.tracks || []).map((track, index) => ({
          id: `arch-track-${track.id || index}`,
          mode,
          type: "AI 메모리 트랙",
          tag: track.label,
          title: track.title,
          body: track.thesis,
          section: "ai-matrix",
          categories: track.linkedCategories || [],
          watch: track.watch || [],
          metrics: track.metrics || [],
        })))
        .concat((matrix.shareMatrix || []).map((row, index) => ({
          id: `arch-share-${index}`,
          mode,
          type: "경쟁사 벤치마크",
          tag: row.type,
          title: row.company,
          body: row.position,
          section: "ai-matrix",
          categories: row.linkedCategories || [],
          watch: row.watch || [],
          metrics: [
            { label: "HBM", value: row.hbmShare || "-" },
            { label: "2026 DRAM", value: row.dramShare2026 || "-" },
            { label: "2026 NAND", value: row.nandShare2026 || "-" },
          ],
        })))
        .concat((matrix.roadmap || []).map((item, index) => ({
          id: `arch-roadmap-${index}`,
          mode,
          type: "기술 로드맵",
          tag: item.period,
          title: item.title,
          body: item.detail,
          section: "ai-matrix",
          categories: inferCategoriesFromText(`${item.title} ${item.detail} ${(item.checkpoints || []).join(" ")}`),
          watch: item.checkpoints || [],
          metrics: [
            { label: "Period", value: item.period },
            { label: "Owner", value: item.owner },
            { label: "Checkpoints", value: fmtNum((item.checkpoints || []).length) },
          ],
        })))
        .concat((matrix.valueChain || []).map((node, index) => ({
          id: `arch-value-${index}`,
          mode,
          type: "Supply Chain Explorer",
          tag: node.segment,
          title: (node.players || []).join(" · "),
          body: `${node.role || ""} ${node.risk || ""}`,
          section: "ai-matrix",
          categories: node.linkedCategories || [],
          watch: node.signals || [],
          tags: node.players || [],
          metrics: [
            { label: "Vendors", value: fmtNum((node.players || []).length) },
            { label: "Segment", value: node.segment },
            { label: "Risk", value: "Overlay" },
          ],
        })));
    }

    if (mode === "dynamics") {
      items = CHINA_DYNAMIC_AXES.map((axis) => {
        const count = axisSignalCount(axis);
        const momentum = axisMomentum(count);
        const links = axisLiveItems(axis).slice(0, 3);
        return {
          id: `axis-${axis.id}`,
          mode,
          type: "중국 반도체 다이내믹스",
          tag: axis.label,
          title: axis.title,
          body: axis.pulse,
          section: "china-dynamics",
          categories: axis.categoryIds || [],
          watch: axis.watch || [],
          metrics: [
            { label: "Signal", value: fmtNum(count) },
            { label: "Momentum", value: momentum.label },
            { label: "Article", value: fmtNum(links.length) },
          ],
          links,
        };
      });
    }

    if (mode === "talent") {
      const data = talentRadarData();
      items = []
        .concat((data.companySignals || []).map((item, index) => ({
          id: `talent-company-${index}`,
          mode,
          type: "인재·채용 레이더",
          tag: item.company,
          title: item.title,
          body: item.thesis,
          section: "talent-radar",
          categories: item.linkedCategories || [],
          watch: (item.signals || []).concat(item.risk ? [item.risk] : []),
          metrics: item.metrics || [],
          tags: [item.company],
        })))
        .concat((data.meceSources || []).map((item, index) => ({
          id: `talent-source-${index}`,
          mode,
          type: "크롤링 타깃",
          tag: item.axis,
          title: item.axis,
          body: item.why,
          section: "talent-radar",
          categories: item.linkedCategories || [],
          watch: item.signals || [],
          metrics: [
            { label: "Targets", value: fmtNum((item.targets || []).length) },
            { label: "Signals", value: fmtNum((item.signals || []).length) },
          ],
          tags: (item.targets || []).map((target) => target.name),
        })));
    }

    if (mode === "projection") {
      const segments = productProjectionSegments();
      const series = projectionSeries(segments);
      items = segments.map((segment) => {
        const startShare = projectionShare(series, segment.id, 0);
        const endShare = projectionShare(series, segment.id, -1);
        return {
          id: `projection-${segment.id}`,
          mode,
          type: "제품군 프로젝션",
          tag: segment.label,
          title: segment.title,
          body: `${segment.thesis} ${segment.risk}`,
          section: "projection",
          categories: segment.linkedCategories || [],
          watch: (segment.triggers || []).concat(segment.actions || []),
          metrics: [
            { label: "T+30M", value: `${fmtNum(startShare, 1)}%` },
            { label: "5Y", value: `${fmtNum(endShare, 1)}%` },
            { label: "Signal", value: fmtNum(segment.signals) },
          ],
          tags: segment.products || [],
          links: segment.links || [],
        };
      });
    }

    if (mode === "competition") {
      items = (BASE.dynamics || []).map((item, index) => ({
        id: `competition-${index}`,
        mode,
        type: "경쟁 다이나믹스",
        tag: item.axis,
        title: item.title,
        body: item.desc,
        section: "dynamics",
        categories: item.linkedCategories || [],
        watch: item.watch || [],
        metrics: [
          { label: "Players", value: fmtNum((item.players || []).length) },
          { label: "Watch", value: fmtNum((item.watch || []).length) },
          { label: "Category", value: (item.linkedCategories || []).map(categoryName).join(" · ") || "전체" },
        ],
        tags: item.players || [],
      }));
    }

    if (mode === "monetization") {
      items = (BASE.monetizationModels || []).map((item, index) => ({
        id: `model-${index}`,
        mode,
        type: "수익화 모델",
        tag: (item.linkedCategories || []).map(categoryName).join(" · ") || "Benchmark",
        title: item.title,
        body: item.logic,
        section: "monetization",
        categories: item.linkedCategories || [],
        watch: [item.metric, item.watch].filter(Boolean),
        metrics: [
          { label: "Metric", value: item.metric },
          { label: "Watch", value: item.watch },
          { label: "Fit", value: (item.linkedCategories || []).map(categoryName).join(" · ") || "전체" },
        ],
      }));
    }

    if (mode === "response") {
      items = (BASE.responses || []).map((item, index) => ({
        id: `response-${index}`,
        mode,
        type: "대응 액션",
        tag: item.priority,
        title: item.title,
        body: item.desc,
        section: "response",
        categories: responseLinkedCategories(item),
        watch: item.actions || [],
        metrics: [
          { label: "Priority", value: item.priority },
          { label: "Actions", value: fmtNum((item.actions || []).length) },
          { label: "Owner view", value: "전략·운영" },
        ],
      }));
    }

    if (mode === "intelligence") {
      items = visibleItems(BASE.channels || []).map((item, index) => ({
        id: `channel-${index}`,
        mode,
        type: "정보 채널",
        tag: item.source,
        title: item.title,
        body: item.desc,
        section: "intelligence",
        categories: item.linkedCategories || [],
        watch: item.signals || [],
        metrics: [
          { label: "Signals", value: fmtNum((item.signals || []).length) },
          { label: "Source", value: item.source },
          { label: "Fit", value: (item.linkedCategories || []).map(categoryName).join(" · ") || "전체" },
        ],
      }));
    }

    return visibleItems(items).filter((item) => {
      if (activeCategory === "all") return true;
      if (!item.categories || !item.categories.length) return true;
      return item.categories.includes(activeCategory);
    });
  }

  function renderWorkbenchMece() {
    const wrap = $("#workbenchMece");
    if (!wrap) return;
    const activeMode = WORKBENCH_MODES.find((mode) => mode.id === workbenchMode);
    wrap.innerHTML = MECE_GROUPS.map((group) => {
      const sections = group.sections.map(sectionTelemetry);
      const groupScore = sections.length ? Math.round(sections.reduce((sum, item) => sum + item.score, 0) / sections.length) : 0;
      const total = sections.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
      return `
        <article class="mece-group-card reveal" data-mece-group="${escapeHTML(group.id)}">
          <div class="mece-group-head">
            <div>
              <span>${escapeHTML(group.cadence)}</span>
              <strong>${escapeHTML(group.label)}</strong>
            </div>
            <span class="score-ring tiny" data-score-to="${groupScore}" style="--score:0">
              <span class="score-value">${countHTML(groupScore)}</span>
              <small>/100</small>
            </span>
          </div>
          <p>${escapeHTML(group.desc)}</p>
          <div class="mece-group-meter"><i data-fill-to="${groupScore}" style="width:0%"></i></div>
          <div class="mece-node-list">
            ${sections.map((item) => `
              <button class="mece-node${item.section === activeMode?.section ? " active" : ""}" type="button" data-mece-section="${escapeHTML(item.section)}" data-mece-mode="${escapeHTML(item.mode)}">
                <span>
                  <strong>${escapeHTML(item.label)}</strong>
                  <small>${escapeHTML(item.note)}</small>
                </span>
                <em>${countHTML(item.value)}${escapeHTML(item.unit)}</em>
              </button>
            `).join("")}
          </div>
          <div class="mece-group-foot">
            <span>${escapeHTML(fmtNum(total))} signals</span>
            <span>${escapeHTML(group.sections.length)} boards</span>
          </div>
        </article>
      `;
    }).join("");

    wrap.querySelectorAll("[data-mece-section]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.meceMode) {
          workbenchMode = btn.dataset.meceMode;
          selectedInsightId = null;
          renderWorkbench();
        }
        jumpTo(btn.dataset.meceSection);
      });
    });
    animateCounts(wrap);
    animateMeters(wrap);
  }

  function renderWorkbench() {
    const tabs = $("#workbenchTabs");
    const stage = $("#workbenchStage");
    const detail = $("#workbenchDetail");
    if (!tabs || !stage || !detail) return;

    renderWorkbenchMece();
    tabs.innerHTML = "";
    WORKBENCH_MODES.forEach((mode) => {
      const count = workbenchItems(mode.id).length;
      const btn = el("button", mode.id === workbenchMode ? "active" : "");
      btn.type = "button";
      btn.dataset.workMode = mode.id;
      btn.innerHTML = `
        <strong>${escapeHTML(mode.label)}</strong>
        <small>${escapeHTML(mode.sub)} · ${fmtNum(count)}</small>
      `;
      btn.addEventListener("click", () => {
        workbenchMode = mode.id;
        selectedInsightId = null;
        renderWorkbench();
      });
      tabs.appendChild(btn);
    });

    const mode = WORKBENCH_MODES.find((item) => item.id === workbenchMode) || WORKBENCH_MODES[0];
    const items = workbenchItems(workbenchMode);
    if (!items.some((item) => item.id === selectedInsightId)) {
      selectedInsightId = items[0]?.id || null;
    }
    const selected = items.find((item) => item.id === selectedInsightId) || items[0];
    $("#workbenchMeta").textContent = `${mode.label} · ${activeCategoryData().label} · ${fmtNum(items.length)}개 객체`;

    stage.innerHTML = "";
    if (!items.length) {
      stage.appendChild(el("div", "empty", "선택한 카테고리에 연결된 인터랙티브 객체가 없습니다."));
      renderWorkbenchDetail(null);
      return;
    }

    items.forEach((item, index) => {
      const card = el("article", `work-card reveal${item.id === selected?.id ? " selected" : ""}`);
      card.style.animationDelay = `${index * 25}ms`;
      card.style.setProperty("--local-accent", categoryAccent((item.categories || [])[0]));
      card.dataset.workItem = item.id;
      card.innerHTML = `
        <div class="work-card-head">
          <span class="chip accent">${escapeHTML(item.tag || item.type)}</span>
          <span class="work-card-section">${escapeHTML(SECTION_LABELS[item.section] || item.section)}</span>
        </div>
        <h3>${escapeHTML(item.title)}</h3>
        <p>${escapeHTML(clipText(item.body, 116))}</p>
        <div class="work-card-foot">
          ${(item.metrics || []).slice(0, 2).map((metric) => `<span>${escapeHTML(metric.label)}: ${escapeHTML(metric.value)}</span>`).join("")}
        </div>
      `;
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", `${item.title} 선택`);
      card.addEventListener("click", () => {
        selectedInsightId = item.id;
        renderWorkbench();
      });
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectedInsightId = item.id;
          renderWorkbench();
        }
      });
      stage.appendChild(card);
    });

    renderWorkbenchDetail(selected);
  }

  function metricCards(metrics = [], limit = 3) {
    return metrics.slice(0, limit).map((metric) => `
      <div class="metric">
        <strong>${escapeHTML(metric.value ?? metric)}</strong>
        <span>${escapeHTML(metric.label || "Metric")}</span>
      </div>
    `).join("");
  }

  function renderWorkbenchDetail(item) {
    const detail = $("#workbenchDetail");
    if (!detail) return;
    if (!item) {
      detail.innerHTML = `<div class="empty">분석 객체를 선택하면 상세 맥락이 열립니다.</div>`;
      return;
    }
    const categories = (item.categories || []).map(categoryName).filter(Boolean);
    detail.style.setProperty("--local-accent", categoryAccent((item.categories || [])[0]));
    detail.innerHTML = `
      <div class="work-detail-head">
        <span class="chip accent">${escapeHTML(item.type || "Insight")}</span>
        <h3>${escapeHTML(item.title)}</h3>
        <p>${escapeHTML(item.body)}</p>
      </div>
      <div class="metric-row">${metricCards(item.metrics || [], 3)}</div>
      <div class="work-detail-block">
        <strong>관찰 포인트</strong>
        <ul class="watch-list">${(item.watch || []).slice(0, 5).map((watch) => `<li>${escapeHTML(watch)}</li>`).join("")}</ul>
      </div>
      <div class="work-detail-block">
        <strong>연결 카테고리</strong>
        <div class="tag-row">${categories.length ? categories.map((name, index) => `<button class="tag as-button" type="button" data-work-cat="${escapeHTML((item.categories || [])[index])}">${escapeHTML(name)}</button>`).join("") : "<span class=\"tag\">전체</span>"}</div>
      </div>
      ${item.links?.length ? `
        <div class="work-detail-block">
          <strong>관련 최신 신호</strong>
          <ul class="work-link-list">
            ${item.links.map((link) => `
              <li><a href="${escapeHTML(link.link || "#")}" target="_blank" rel="noopener">${escapeHTML(newsTitle(link) || link.title || link.source || "Signal")}</a></li>
            `).join("")}
          </ul>
        </div>
      ` : ""}
      <div class="work-detail-actions">
        <button type="button" data-copy-work>인사이트 복사</button>
        <button type="button" data-open-inspector>상세 패널 열기</button>
        <button type="button" data-work-jump="${escapeHTML(item.section)}">관련 보드로 이동</button>
      </div>
    `;

    detail.querySelector("[data-copy-work]")?.addEventListener("click", (event) => copyPayload(item, event.currentTarget));
    detail.querySelector("[data-open-inspector]")?.addEventListener("click", () => openInspector(item));
    detail.querySelectorAll("[data-work-jump]").forEach((btn) => {
      btn.addEventListener("click", () => jumpTo(btn.dataset.workJump));
    });
    detail.querySelectorAll("[data-work-cat]").forEach((btn) => {
      btn.addEventListener("click", () => {
        setCategory(btn.dataset.workCat);
        jumpTo("categories");
      });
    });
  }

  function makeInspectable(card, payload) {
    card.classList.add("inspectable");
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `${payload.title || "항목"} 상세 보기`);
    card.addEventListener("click", (event) => {
      if (event.target.closest("a, button")) return;
      openInspector(payload);
    });
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openInspector(payload);
    });
  }

  function normalizePayload(payload) {
    return {
      type: payload.type || payload.tag || "Benchmark insight",
      tag: payload.tag || payload.type || "",
      title: payload.title || "상세 정보",
      body: payload.body || payload.desc || payload.summary || payload.logic || "",
      section: payload.section || "workbench",
      categories: payload.categories || payload.linkedCategories || payload.categoryIds || [],
      watch: payload.watch || payload.actions || payload.signals || [],
      metrics: payload.metrics || [],
      links: payload.links || [],
      tags: payload.tags || payload.players || [],
    };
  }

  function openInspector(payload) {
    const data = normalizePayload(payload);
    const overlay = $("#inspector");
    if (!overlay) return;
    overlay.hidden = false;
    overlay.style.setProperty("--local-accent", categoryAccent((data.categories || [])[0]));
    document.body.style.overflow = "hidden";
    overlay.innerHTML = `
      <div class="inspector-panel" role="dialog" aria-modal="true">
        <div class="inspector-head">
          <div>
            <span class="chip accent">${escapeHTML(data.type)}</span>
            <h3>${escapeHTML(data.title)}</h3>
          </div>
          <button type="button" data-close-inspector>닫기</button>
        </div>
        <div class="inspector-body">
          <p>${escapeHTML(data.body)}</p>
          ${data.metrics.length ? `<div class="metric-row">${metricCards(data.metrics, 4)}</div>` : ""}
          ${data.tags.length ? `<div class="tag-row">${data.tags.map((tag) => `<span class="tag">${escapeHTML(tag)}</span>`).join("")}</div>` : ""}
          ${data.watch.length ? `
            <div class="inspector-block">
              <strong>체크포인트</strong>
              <ul class="watch-list">${data.watch.map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul>
            </div>
          ` : ""}
          ${data.categories.length ? `
            <div class="inspector-block">
              <strong>카테고리</strong>
              <div class="tag-row">${data.categories.map((id) => `<button class="tag as-button" type="button" data-inspector-cat="${escapeHTML(id)}">${escapeHTML(categoryName(id))}</button>`).join("")}</div>
            </div>
          ` : ""}
          ${data.links.length ? `
            <div class="inspector-block">
              <strong>관련 기사·신호</strong>
              <ul class="work-link-list">
                ${data.links.map((link) => `<li><a href="${escapeHTML(link.link || "#")}" target="_blank" rel="noopener">${escapeHTML(newsTitle(link) || link.title || link.source || "Signal")}</a></li>`).join("")}
              </ul>
            </div>
          ` : ""}
        </div>
        <div class="inspector-actions">
          <button type="button" data-inspector-copy>인사이트 복사</button>
          <button type="button" data-inspector-jump="${escapeHTML(data.section)}">관련 보드로 이동</button>
        </div>
      </div>
    `;
    overlay.querySelector("[data-close-inspector]")?.addEventListener("click", closeInspector);
    overlay.querySelector("[data-inspector-copy]")?.addEventListener("click", (event) => copyTextToClipboard(payloadPlainText(data), event.currentTarget));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeInspector();
    }, { once: true });
    overlay.querySelectorAll("[data-inspector-cat]").forEach((btn) => {
      btn.addEventListener("click", () => {
        closeInspector();
        setCategory(btn.dataset.inspectorCat);
        jumpTo("categories");
      });
    });
    overlay.querySelector("[data-inspector-jump]")?.addEventListener("click", (event) => {
      closeInspector();
      jumpTo(event.currentTarget.dataset.inspectorJump);
    });
  }

  function closeInspector() {
    const overlay = $("#inspector");
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    overlay.innerHTML = "";
    document.body.style.overflow = "";
  }

  function renderCategoryControls(targetId, sourceItems, targetSection) {
    const wrap = $(`#${targetId}`);
    if (!wrap) return;
    const cats = memoryCategories();
    const visibleSourceItems = visibleItems(sourceItems);
    wrap.innerHTML = "";
    cats.forEach((cat) => {
      const count = cat.id === "all"
        ? visibleSourceItems.length
        : visibleSourceItems.filter((item) => (item.linkedCategories || []).includes(cat.id)).length;
      if (cat.id !== "all" && !count) return;
      const btn = el("button", cat.id === activeCategory ? "active" : "");
      btn.type = "button";
      btn.style.setProperty("--local-accent", categoryAccent(cat.id));
      btn.innerHTML = `<span>${escapeHTML(cat.label)}</span><small>${fmtNum(count)}</small>`;
      btn.addEventListener("click", () => {
        setCategory(cat.id);
        jumpTo(targetSection);
      });
      wrap.appendChild(btn);
    });
  }

  function renderResponseControls() {
    const wrap = $("#responseControls");
    if (!wrap) return;
    const items = BASE.responses || [];
    const priorities = ["all"].concat(Array.from(new Set(items.map((item) => item.priority).filter(Boolean))));
    wrap.innerHTML = "";
    priorities.forEach((priority) => {
      const count = priority === "all" ? items.length : items.filter((item) => item.priority === priority).length;
      const btn = el("button", priority === responsePriority ? "active" : "");
      btn.type = "button";
      btn.innerHTML = `<span>${priority === "all" ? "전체" : escapeHTML(priority)}</span><small>${fmtNum(count)}</small>`;
      btn.addEventListener("click", () => {
        responsePriority = priority;
        renderResponses();
      });
      wrap.appendChild(btn);
    });
  }

  function dynamicsPayload(item) {
    return {
      type: "경쟁 다이나믹스",
      tag: item.axis,
      title: item.title,
      body: item.desc,
      section: "dynamics",
      categories: item.linkedCategories || [],
      watch: item.watch || [],
      tags: item.players || [],
      metrics: [
        { label: "Players", value: fmtNum((item.players || []).length) },
        { label: "Watch", value: fmtNum((item.watch || []).length) },
        { label: "Fit", value: (item.linkedCategories || []).map(categoryName).join(" · ") || "전체" },
      ],
    };
  }

  function stablePanelKey(prefix, item, index) {
    return `${prefix}-${item.id || item.title || item.axis || index}`;
  }

  function dynamicScore(item) {
    return clamp(38 + (item.players || []).length * 9 + (item.watch || []).length * 8 + itemNewsLinks(item, 5).length * 4);
  }

  function modelScore(item) {
    const flow = moneyFlowFromModel(item);
    return clamp(42 + (item.linkedCategories || []).length * 12 + (item.metric ? 14 : 0) + (item.watch ? 10 : 0) + (flow.lever ? 8 : 0));
  }

  function scoreRingHTML(score, label = "Score") {
    const safe = clamp(score);
    return `
      <div class="score-ring" data-score-to="${safe}" style="--score:0">
        <span class="score-value">${countHTML(safe)}</span>
        <small>${escapeHTML(label)}</small>
      </div>
    `;
  }

  function orbitPoint(index, total, radius = 39, start = -90) {
    const angle = start + (360 / Math.max(total, 1)) * index;
    const rad = angle * Math.PI / 180;
    return {
      x: 50 + Math.cos(rad) * radius,
      y: 50 + Math.sin(rad) * radius,
      angle,
      length: radius,
    };
  }

  function itemNewsLinks(item, limit = 3) {
    const terms = (item.players || item.entities || item.tags || [])
      .concat(item.title || "", item.axis || "")
      .map((term) => String(term || "").toLowerCase())
      .filter((term) => term.length > 2);
    if (!terms.length) return [];
    return rawNews().filter((news) => {
      const hay = `${news.title || ""} ${news.titleKo || ""} ${news.summary || ""} ${news.source || ""}`.toLowerCase();
      return terms.some((term) => hay.includes(term));
    }).slice(0, limit).map((news) => ({
      title: newsTitle(news),
      link: news.link,
      source: news.source,
    }));
  }

  function renderDynamicFocusPanel(items) {
    const panel = $("#dynamicFocusPanel");
    if (!panel) return;
    if (!items.length) {
      panel.innerHTML = `<div class="empty">경쟁 축을 선택하면 정량 readout이 열립니다.</div>`;
      return;
    }
    if (!items.some((item, index) => stablePanelKey("dynamic", item, index) === dynamicFocusId)) {
      dynamicFocusId = stablePanelKey("dynamic", items[0], 0);
    }
    const index = items.findIndex((item, i) => stablePanelKey("dynamic", item, i) === dynamicFocusId);
    const item = items[index] || items[0];
    const payload = dynamicsPayload(item);
    const links = itemNewsLinks(item);
    const categories = (item.linkedCategories || []).map(categoryName).filter(Boolean);
    panel.style.setProperty("--local-accent", categoryAccent((item.linkedCategories || [])[0]));
    panel.innerHTML = `
      <div class="focus-head">
        <span class="chip accent">${escapeHTML(item.axis || "Dynamic")}</span>
        <h3>${escapeHTML(item.title)}</h3>
        <p>${escapeHTML(item.desc || "")}</p>
      </div>
      <div class="focus-readout">
        <div><strong>${fmtNum((item.players || []).length)}</strong><span>Players</span></div>
        <div><strong>${fmtNum((item.watch || []).length)}</strong><span>Watch</span></div>
        <div><strong>${escapeHTML(categories[0] || "전체")}</strong><span>Primary axis</span></div>
      </div>
      <div class="focus-score-row">
        ${scoreRingHTML(dynamicScore(item), "Impact")}
        <div class="focus-score-copy"><strong>0 -> 100</strong><span>Selected axis power</span></div>
      </div>
      <div class="focus-block">
        <strong>경쟁 플레이어</strong>
        <div class="tag-row">${(item.players || []).map((p) => `<span class="tag">${escapeHTML(p)}</span>`).join("") || "<span class=\"tag\">시장 전체</span>"}</div>
      </div>
      <div class="focus-block">
        <strong>관찰 지표</strong>
        <ul class="watch-list">${(item.watch || []).map((w) => `<li>${escapeHTML(w)}</li>`).join("")}</ul>
      </div>
      ${links.length ? `
        <div class="focus-block">
          <strong>관련 최신 신호</strong>
          <ul class="work-link-list">${links.map((link) => `<li><a href="${escapeHTML(link.link || "#")}" target="_blank" rel="noopener">${escapeHTML(link.title || link.source || "Signal")}</a></li>`).join("")}</ul>
        </div>
      ` : ""}
      <div class="focus-actions">
        <button type="button" data-focus-copy>복사</button>
        <button type="button" data-focus-inspector>상세 패널</button>
        <button type="button" data-focus-workbench>워크벤치</button>
      </div>
    `;
    panel.querySelector("[data-focus-copy]")?.addEventListener("click", (event) => copyPayload(payload, event.currentTarget));
    panel.querySelector("[data-focus-inspector]")?.addEventListener("click", () => openInspector({ ...payload, links }));
    panel.querySelector("[data-focus-workbench]")?.addEventListener("click", () => {
      workbenchMode = "competition";
      selectedInsightId = null;
      renderWorkbench();
      jumpTo("workbench");
    });
  }

  function renderDynamicRelationMap(items) {
    const wrap = $("#dynamicRelationMap");
    if (!wrap) return;
    wrap.innerHTML = "";
    if (!items.length) {
      wrap.appendChild(el("div", "empty", "선택한 카테고리의 관계 맵이 없습니다."));
      return;
    }
    const orbitHead = el("div", "relation-head", `
      <div>
        <span>Interactive dynamics</span>
        <strong>${escapeHTML(activeCategoryData()?.label || "All")} 0 -> 100 map</strong>
      </div>
      <small>Hover or click each circular node to change the readout</small>
    `);
    const orbit = el("div", "orbit-map dynamic-orbit");
    const stage = el("div", "orbit-stage");
    const hub = el("button", "orbit-center", `<strong>Dynamics</strong><span>${fmtNum(items.length)} axes</span>`);
    hub.type = "button";
    hub.addEventListener("click", () => {
      dynamicFocusId = items[0] ? stablePanelKey("dynamic", items[0], 0) : null;
      renderDynamics();
    });
    stage.appendChild(hub);
    items.forEach((item, index) => {
      const key = stablePanelKey("dynamic", item, index);
      const point = orbitPoint(index, items.length);
      const score = dynamicScore(item);
      const accent = categoryAccent((item.linkedCategories || [])[0]);
      const line = el("i", `orbit-line${key === dynamicFocusId ? " selected" : ""}`);
      line.style.setProperty("--angle", `${point.angle}deg`);
      line.style.setProperty("--len", `${point.length}%`);
      line.style.setProperty("--local-accent", accent);
      const node = el("button", `orbit-node${key === dynamicFocusId ? " selected" : ""}`);
      node.type = "button";
      node.style.setProperty("--x", `${point.x}%`);
      node.style.setProperty("--y", `${point.y}%`);
      node.style.setProperty("--local-accent", accent);
      node.innerHTML = `
        ${scoreRingHTML(score, "Power")}
        <strong>${escapeHTML(item.axis || item.title || "Dynamic")}</strong>
        <span>${fmtNum((item.players || []).length)} players</span>
      `;
      const select = () => {
        if (dynamicFocusId === key) return;
        dynamicFocusId = key;
        renderDynamics();
      };
      node.addEventListener("mouseenter", select);
      node.addEventListener("focus", select);
      node.addEventListener("click", select);
      stage.append(line, node);
    });
    orbit.appendChild(stage);
    wrap.append(orbitHead, orbit);
    animateCounts(wrap);
    animateMeters(wrap);
  }

  function modelPayload(item) {
    return {
      type: "수익화 모델",
      tag: (item.linkedCategories || []).map(categoryName).join(" · ") || "Benchmark",
      title: item.title,
      body: item.logic,
      section: "monetization",
      categories: item.linkedCategories || [],
      watch: [item.metric, item.watch].filter(Boolean),
      metrics: [
        { label: "Metric", value: item.metric },
        { label: "Watch", value: item.watch },
        { label: "Fit", value: (item.linkedCategories || []).map(categoryName).join(" · ") || "전체" },
      ],
    };
  }

  function renderModelFocusPanel(items) {
    const panel = $("#modelFocusPanel");
    if (!panel) return;
    if (!items.length) {
      panel.innerHTML = `<div class="empty">수익화 레버를 선택하면 정량 readout이 열립니다.</div>`;
      return;
    }
    if (!items.some((item, index) => stablePanelKey("model", item, index) === modelFocusId)) {
      modelFocusId = stablePanelKey("model", items[0], 0);
    }
    const index = items.findIndex((item, i) => stablePanelKey("model", item, i) === modelFocusId);
    const item = items[index] || items[0];
    const payload = modelPayload(item);
    const flowInfo = moneyFlowFromModel(item);
    const links = itemNewsLinks({ ...item, players: [item.title, flowInfo.from, flowInfo.to] });
    panel.style.setProperty("--local-accent", categoryAccent((item.linkedCategories || [])[0]));
    panel.innerHTML = `
      <div class="focus-head">
        <span class="chip accent">${escapeHTML(flowInfo.lever)}</span>
        <h3>${escapeHTML(item.title)}</h3>
        <p>${escapeHTML(item.logic || "")}</p>
      </div>
      <div class="focus-readout">
        <div><strong>${escapeHTML(item.metric || "-")}</strong><span>Core metric</span></div>
        <div><strong>${escapeHTML(flowInfo.to)}</strong><span>Revenue pool</span></div>
        <div><strong>${escapeHTML((item.linkedCategories || []).map(categoryName).join(" · ") || "전체")}</strong><span>Fit</span></div>
      </div>
      <div class="focus-score-row">
        ${scoreRingHTML(modelScore(item), "Revenue")}
        <div class="focus-score-copy"><strong>0 -> 100</strong><span>Selected money lever</span></div>
      </div>
      <div class="focus-flow">
        <span>${escapeHTML(flowInfo.from)}</span>
        <i></i>
        <span>${escapeHTML(flowInfo.to)}</span>
      </div>
      <div class="focus-block">
        <strong>수익화 Watch</strong>
        <ul class="watch-list">
          <li>${escapeHTML(item.watch || "가격·고객·캐파 변화")}</li>
          <li>${escapeHTML(flowInfo.lever)} 지표를 가격/뉴스/대응 큐와 같이 확인</li>
        </ul>
      </div>
      ${links.length ? `
        <div class="focus-block">
          <strong>관련 최신 신호</strong>
          <ul class="work-link-list">${links.map((link) => `<li><a href="${escapeHTML(link.link || "#")}" target="_blank" rel="noopener">${escapeHTML(link.title || link.source || "Signal")}</a></li>`).join("")}</ul>
        </div>
      ` : ""}
      <div class="focus-actions">
        <button type="button" data-model-copy>복사</button>
        <button type="button" data-model-inspector>상세 패널</button>
        <button type="button" data-model-workbench>워크벤치</button>
      </div>
    `;
    panel.querySelector("[data-model-copy]")?.addEventListener("click", (event) => copyPayload(payload, event.currentTarget));
    panel.querySelector("[data-model-inspector]")?.addEventListener("click", () => openInspector({ ...payload, links }));
    panel.querySelector("[data-model-workbench]")?.addEventListener("click", () => {
      workbenchMode = "monetization";
      selectedInsightId = null;
      renderWorkbench();
      jumpTo("workbench");
    });
  }

  function moneyFlowFromModel(item) {
    const cats = item.linkedCategories || [];
    if (cats.includes("hbm")) return { from: "AI GPU·ASIC 고객", to: "SK hynix HBM", lever: "ASP 프리미엄" };
    if (cats.includes("dram")) return { from: "PC·모바일·중국 빅테크", to: "범용 DRAM", lever: "원가 방어" };
    if (cats.includes("nand")) return { from: "클라우드·eSSD 고객", to: "NAND·Solidigm", lever: "믹스 전환" };
    if (cats.includes("packaging")) return { from: "장비·OSAT 생태계", to: "첨단 패키징", lever: "수율·캐파" };
    if (cats.includes("cxl")) return { from: "데이터센터 플랫폼", to: "CXL/PIM", lever: "플랫폼 옵션" };
    return { from: "시장 신호", to: "벤치마킹 모델", lever: "관찰 지표" };
  }

  function renderMoneyFlowMap(items) {
    const wrap = $("#moneyFlowMap");
    if (!wrap) return;
    wrap.innerHTML = "";
    if (!items.length) {
      wrap.appendChild(el("div", "empty", "No monetization map for the selected category."));
      return;
    }
    const orbitHead = el("div", "relation-head", `
      <div>
        <span>Interactive monetization</span>
        <strong>Revenue lever 0 -> 100 map</strong>
      </div>
      <small>Hover or click each circular node to inspect the money flow</small>
    `);
    const orbit = el("div", "orbit-map money-orbit");
    const stage = el("div", "orbit-stage");
    const hub = el("button", "orbit-center", `<strong>Money flow</strong><span>${fmtNum(items.length)} levers</span>`);
    hub.type = "button";
    hub.addEventListener("click", () => {
      modelFocusId = items[0] ? stablePanelKey("model", items[0], 0) : null;
      renderModels();
    });
    stage.appendChild(hub);
    items.forEach((item, index) => {
      const key = stablePanelKey("model", item, index);
      const point = orbitPoint(index, items.length, 38);
      const flowInfo = moneyFlowFromModel(item);
      const score = modelScore(item);
      const accent = categoryAccent((item.linkedCategories || [])[0]);
      const line = el("i", `orbit-line${key === modelFocusId ? " selected" : ""}`);
      line.style.setProperty("--angle", `${point.angle}deg`);
      line.style.setProperty("--len", `${point.length}%`);
      line.style.setProperty("--local-accent", accent);
      const node = el("button", `orbit-node money${key === modelFocusId ? " selected" : ""}`);
      node.type = "button";
      node.style.setProperty("--x", `${point.x}%`);
      node.style.setProperty("--y", `${point.y}%`);
      node.style.setProperty("--local-accent", accent);
      node.innerHTML = `
        ${scoreRingHTML(score, "Revenue")}
        <strong>${escapeHTML(flowInfo.lever || item.title || "Lever")}</strong>
        <span>${escapeHTML(item.metric || flowInfo.to || "Metric")}</span>
      `;
      const select = () => {
        if (modelFocusId === key) return;
        modelFocusId = key;
        renderModels();
      };
      node.addEventListener("mouseenter", select);
      node.addEventListener("focus", select);
      node.addEventListener("click", select);
      stage.append(line, node);
    });
    orbit.appendChild(stage);
    wrap.append(orbitHead, orbit);
    animateCounts(wrap);
    animateMeters(wrap);
  }

  function renderDynamics() {
    const grid = $("#dynamicGrid");
    renderCategoryControls("dynamicControls", BASE.dynamics || [], "dynamics");
    const items = (BASE.dynamics || []).filter(relatedToActive);
    if (!items.some((item, index) => stablePanelKey("dynamic", item, index) === dynamicFocusId)) {
      dynamicFocusId = items[0] ? stablePanelKey("dynamic", items[0], 0) : null;
    }
    renderDynamicRelationMap(items);
    renderDynamicFocusPanel(items);
    grid.innerHTML = "";
    items.forEach((item, index) => {
      const payload = dynamicsPayload(item);
      const key = stablePanelKey("dynamic", item, index);
      const card = el("article", `card reveal${key === dynamicFocusId ? " selected" : ""}`);
      card.style.animationDelay = `${index * 35}ms`;
      card.style.setProperty("--local-accent", categoryAccent((item.linkedCategories || [])[0]));
      card.dataset.dynamicKey = key;
      card.innerHTML = `
        <div class="card-top">
          <span class="chip accent">${escapeHTML(item.axis)}</span>
          <button class="copy-btn" type="button" data-copy-dynamic>복사</button>
        </div>
        <h3>${escapeHTML(item.title)}</h3>
        <p>${escapeHTML(item.desc)}</p>
        <div class="tag-row">${(item.players || []).map((p) => `<span class="tag">${escapeHTML(p)}</span>`).join("")}</div>
        <ul class="watch-list">${(item.watch || []).map((w) => `<li>${escapeHTML(w)}</li>`).join("")}</ul>
      `;
      card.querySelector("[data-copy-dynamic]")?.addEventListener("click", (event) => copyPayload(payload, event.currentTarget));
      card.addEventListener("click", (event) => {
        if (event.target.closest("button, a")) return;
        dynamicFocusId = key;
        renderDynamics();
      });
      grid.appendChild(card);
    });
    if (!grid.children.length) grid.appendChild(el("div", "empty", "선택한 카테고리의 경쟁 다이나믹스가 없습니다."));
    animateCounts($("#dynamics") || grid);
    animateMeters($("#dynamics") || grid);
  }

  function renderModels() {
    const grid = $("#modelGrid");
    renderCategoryControls("modelControls", BASE.monetizationModels || [], "monetization");
    const items = (BASE.monetizationModels || []).filter(relatedToActive);
    if (!items.some((item, index) => stablePanelKey("model", item, index) === modelFocusId)) {
      modelFocusId = items[0] ? stablePanelKey("model", items[0], 0) : null;
    }
    renderMoneyFlowMap(items);
    renderModelFocusPanel(items);
    grid.innerHTML = "";
    items.forEach((item, index) => {
      const payload = modelPayload(item);
      const flowInfo = moneyFlowFromModel(item);
      const key = stablePanelKey("model", item, index);
      const card = el("article", `biz-card reveal${key === modelFocusId ? " selected" : ""}`);
      card.style.animationDelay = `${index * 35}ms`;
      card.style.setProperty("--local-accent", categoryAccent((item.linkedCategories || [])[0]));
      card.innerHTML = `
        <div class="biz-card-head">
          <span class="chip accent">${escapeHTML(flowInfo.lever)}</span>
          <button class="copy-btn" type="button" data-copy-model>복사</button>
        </div>
        <h3>${escapeHTML(item.title)}</h3>
        <p>${escapeHTML(item.logic)}</p>
        <div class="biz-metrics">
          <div class="biz-metric"><strong>Metric</strong><span>${escapeHTML(item.metric)}</span></div>
          <div class="biz-metric"><strong>Watch</strong><span>${escapeHTML(item.watch)}</span></div>
          <div class="biz-metric"><strong>Fit</strong><span>${(item.linkedCategories || []).map(categoryName).join(" · ")}</span></div>
        </div>
      `;
      card.querySelector("[data-copy-model]")?.addEventListener("click", (event) => copyPayload(payload, event.currentTarget));
      card.addEventListener("click", (event) => {
        if (event.target.closest("button, a")) return;
        modelFocusId = key;
        renderModels();
      });
      grid.appendChild(card);
    });
    if (!grid.children.length) grid.appendChild(el("div", "empty", "선택한 카테고리의 벤치마킹 모델이 없습니다."));
    animateCounts($("#monetization") || grid);
    animateMeters($("#monetization") || grid);
  }

  function renderResponses() {
    const grid = $("#responseGrid");
    renderResponseControls();
    grid.innerHTML = "";
    (BASE.responses || [])
      .filter((item) => responsePriority === "all" || item.priority === responsePriority)
      .forEach((item, index) => {
      const card = el("article", "card reveal");
      card.style.animationDelay = `${index * 35}ms`;
      card.innerHTML = `
        <div class="card-top">
          <div>
            <span class="chip accent">${escapeHTML(item.priority)}</span>
            <h3>${escapeHTML(item.title)}</h3>
          </div>
        </div>
        <p>${escapeHTML(item.desc)}</p>
        <ul class="watch-list">${(item.actions || []).map((a) => `<li>${escapeHTML(a)}</li>`).join("")}</ul>
      `;
      makeInspectable(card, {
        type: "대응 액션",
        tag: item.priority,
        title: item.title,
        body: item.desc,
        section: "response",
        categories: responseLinkedCategories(item),
        watch: item.actions || [],
        metrics: [
          { label: "Priority", value: item.priority },
          { label: "Actions", value: fmtNum((item.actions || []).length) },
          { label: "Owner view", value: "전략·운영" },
        ],
      });
      grid.appendChild(card);
    });
  }

  function categoryName(id) {
    return memoryCategories().find((cat) => cat.id === id)?.label || id;
  }

  function setupInteractions() {
    $$("[data-jump]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.classList.contains("sb-item")) {
          $$(".sb-item").forEach((item) => item.classList.toggle("active", item === btn));
        }
        jumpTo(btn.dataset.jump);
      });
    });

    $("#mobileMenu").addEventListener("click", () => document.body.classList.add("menu-open"));
    $("#backdrop").addEventListener("click", () => document.body.classList.remove("menu-open"));

    $("#newsSearch").addEventListener("input", (event) => {
      newsSearch = event.target.value.trim().toLowerCase();
      renderNewsList();
    });

    $("#newsCompanySelect")?.addEventListener("change", (event) => {
      newsCompany = event.target.value;
      renderNews();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeInspector();
    });
  }

  function jumpTo(id) {
    const target = document.getElementById(id);
    if (!target) return;
    document.body.classList.remove("menu-open");
    const y = Math.max(0, target.getBoundingClientRect().top + window.scrollY - chromeOffset());
    window.scrollTo({ top: y, behavior: "smooth" });
  }

  function setupScrollSpy() {
    const sections = ["overview", "executive-decision", "management-strategy", "strategic-investment-decision", "daily-review", "crawler", "prices", "news", "china-nand", "china-dynamics", "talent-radar", "numbers", "projection", "workbench", "ai-matrix", "china-deep-dive", "categories", "competitors", "dynamics", "monetization", "response", "intelligence"];
    const update = () => {
      const y = window.scrollY + chromeOffset() + 22;
      let active = "overview";
      sections.forEach((id) => {
        const node = document.getElementById(id);
        if (node && node.offsetTop <= y) active = id;
      });
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        active = sections[sections.length - 1];
      }
      const lastNode = document.getElementById(sections[sections.length - 1]);
      if (lastNode && lastNode.getBoundingClientRect().top < window.innerHeight * 0.72) {
        active = sections[sections.length - 1];
      }
      $$(".sb-item").forEach((btn) => btn.classList.toggle("active", btn.dataset.jump === active));
    };
    window.addEventListener("scroll", update, { passive: true });
    update();
  }

  /* ---------------- Q&A ---------------- */
  function setupQA() {
    const input = $("#qaInput");
    const toggle = $("#qaToggle");
    const drop = $("#qaDrop");

    const openDrop = () => {
      renderQADrop(input.value);
      drop.hidden = false;
    };
    const closeDrop = () => { drop.hidden = true; };

    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      if (drop.hidden) openDrop();
      else closeDrop();
    });

    input.addEventListener("focus", openDrop);
    input.addEventListener("input", () => {
      if (!drop.hidden) renderQADrop(input.value);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        closeDrop();
        answerQuestion(input.value);
      }
      if (event.key === "Escape") closeDrop();
    });
    document.addEventListener("click", (event) => {
      if (!$("#qaBox").contains(event.target)) closeDrop();
    });
  }

  function renderQADrop(filter = "") {
    const drop = $("#qaDrop");
    const data = BASE.qa || { cats: [], pairs: [] };
    const q = String(filter || "").toLowerCase();
    const queryTerms = q.split(/\s+/).map((term) => term.trim()).filter(Boolean);
    const cats = data.cats || [];
    const pairs = (data.pairs || []).filter((pair) => {
      if (!q) return true;
      const hay = `${pair.q} ${pair.a} ${(pair.keywords || []).join(" ")}`.toLowerCase();
      return hay.includes(q) || queryTerms.every((term) => hay.includes(term));
    });

    drop.innerHTML = "";
    cats.forEach((cat) => {
      const groupPairs = pairs.filter((pair) => pair.cat === cat.id);
      if (!groupPairs.length) return;
      const group = el("div", "qa-group");
      group.appendChild(el("div", "qa-group-title", escapeHTML(cat.name)));
      groupPairs.forEach((pair) => {
        const btn = el("button", "qa-option", escapeHTML(pair.q));
        btn.type = "button";
        btn.style.setProperty("--qa", cat.color || "var(--accent)");
        btn.addEventListener("click", () => {
          $("#qaInput").value = pair.q;
          drop.hidden = true;
          answerQuestion(pair.q);
        });
        group.appendChild(btn);
      });
      drop.appendChild(group);
    });

    if (!drop.children.length) {
      drop.appendChild(el("div", "empty", "일치하는 질문이 없습니다. Enter를 누르면 가장 가까운 답변을 찾습니다."));
    }
  }

  function answerQuestion(query) {
    const data = BASE.qa || { pairs: [] };
    const q = String(query || "").trim();
    if (!q) return;

    const scored = (data.pairs || []).map((pair) => {
      const tokens = [pair.q].concat(pair.keywords || []).map((x) => String(x).toLowerCase());
      const hay = q.toLowerCase();
      const pairHay = `${pair.q} ${pair.a} ${(pair.keywords || []).join(" ")}`.toLowerCase();
      const queryTerms = hay.split(/\s+/).map((term) => term.trim()).filter(Boolean);
      const score = tokens.reduce((acc, token) => acc + (token && hay.includes(token) ? 3 : 0), 0) +
        queryTerms.reduce((acc, term) => acc + (term && pairHay.includes(term) ? 2 : 0), 0) +
        (pair.q.toLowerCase().includes(hay) ? 5 : 0);
      return { pair, score };
    }).sort((a, b) => b.score - a.score);

    const best = scored[0]?.score > 0 ? scored[0].pair : data.pairs[0];
    showAnswer(best || { q, a: "관련 답변을 찾지 못했습니다.", nav: "overview" });
  }

  function showAnswer(pair) {
    const overlay = $("#qaAnswer");
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    overlay.innerHTML = `
      <div class="answer-panel" role="dialog" aria-modal="true">
        <div class="answer-head">
          <span>A</span>
          <strong>${escapeHTML(pair.q)}</strong>
          <button type="button" id="answerClose">닫기</button>
        </div>
        <div class="answer-body" id="answerBody"></div>
        <div class="answer-foot">
          <button type="button" id="answerJump">관련 섹션으로 이동</button>
        </div>
      </div>
    `;

    $("#answerClose").addEventListener("click", closeAnswer);
    $("#answerJump").addEventListener("click", () => {
      closeAnswer();
      jumpTo(pair.nav || "overview");
    });
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeAnswer();
    }, { once: true });

    typeAnswer(pair.a || "");
  }

  function closeAnswer() {
    if (typeTimer) clearInterval(typeTimer);
    typeTimer = null;
    $("#qaAnswer").hidden = true;
    $("#qaAnswer").innerHTML = "";
    document.body.style.overflow = "";
  }

  function typeAnswer(text) {
    const body = $("#answerBody");
    const highlighted = highlight(text);
    const plain = text;
    let i = 0;
    if (typeTimer) clearInterval(typeTimer);
    typeTimer = setInterval(() => {
      i += Math.max(2, Math.ceil(plain.length / 130));
      if (i >= plain.length) {
        clearInterval(typeTimer);
        typeTimer = null;
        body.innerHTML = highlighted;
        return;
      }
      body.textContent = plain.slice(0, i) + "▋";
    }, 18);
  }

  function highlight(text) {
    return escapeHTML(text).replace(
      /(CXMT|YMTC|XMC|JCET|Naura|AMEC|TrendForce|HBM4?E?|DRAM|NAND|DDR5|LPDDR|CXL|IP|TSV|EUV|DUV|Big Fund|빅펀드|메기|비대칭|마이크로데이터)/g,
      "<b>$1</b>",
    );
  }

  /* ---------------- Prices ---------------- */
  function allPriceRows() {
    const sections = LIVE.prices?.sections || [];
    const rows = sections.flatMap((section) => (section.rows || []).map((row) => ({
      ...row,
      sectionTitle: section.title,
      group: section.group,
      lastUpdate: section.lastUpdate,
      sourceUrl: section.sourceUrl,
    })));
    if (rows.length) return rows;
    return (LIVE.prices?.watchedItems || []).map((row) => ({
      ...row,
      sectionTitle: row.sectionTitle,
      group: row.group,
      lastUpdate: row.lastUpdate,
      sourceUrl: row.sourceUrl,
      fallback: true,
    }));
  }

  function priceRowsFor(categoryId = activeCategory) {
    let rows = allPriceRows();
    if (categoryId === "dram") rows = rows.filter((row) => /dram|ddr|lpddr|gddr/i.test(`${row.group} ${row.sectionTitle} ${row.item}`));
    if (categoryId === "nand") rows = rows.filter((row) => /nand|ssd|flash|wafer|ufs|emmc/i.test(`${row.group} ${row.sectionTitle} ${row.item}`));
    if (priceFilter === "spot") rows = rows.filter((row) => /spot|street/i.test(row.sectionTitle || ""));
    if (priceFilter === "contract") rows = rows.filter((row) => /contract/i.test(row.sectionTitle || ""));
    return rows;
  }

  function renderPrices() {
    const tabs = $("#priceTabs");
    tabs.innerHTML = "";
    [
      ["all", "전체"],
      ["spot", "Spot"],
      ["contract", "Contract"],
    ].forEach(([id, label]) => {
      const btn = el("button", id === priceFilter ? "active" : "", label);
      btn.type = "button";
      btn.addEventListener("click", () => {
        priceFilter = id;
        renderPrices();
      });
      tabs.appendChild(btn);
    });

    renderPriceSummary();
    renderPriceRows();
    setFreshness("#priceFreshness", {
      label: "가격",
      updatedAt: LIVE.prices?.updatedAt || LIVE.updatedAt,
      source: LIVE.prices?.source || "TrendForce",
      count: allPriceRows().length,
      healthKeys: ["가격:"],
      staleHours: 30,
    });
  }

  function renderPriceSummary() {
    const rows = priceRowsFor();
    const summary = $("#priceSummary");
    const up = rows.filter((row) => Number(row.changePct) > 0).length;
    const down = rows.filter((row) => Number(row.changePct) < 0).length;
    const contract = rows.filter((row) => /contract/i.test(row.sectionTitle || "")).length;
    const spot = rows.filter((row) => /spot|street/i.test(row.sectionTitle || "")).length;
    const updated = LIVE.prices?.updatedAt || LIVE.updatedAt;
    const status = freshnessState({ updatedAt: updated, count: allPriceRows().length, healthKeys: ["가격:"], staleHours: 30 });
    const cards = [
      ["Status", status.label, LIVE.prices?.source || "TrendForce / DRAMeXchange"],
      ["Rows", rows.length, "선택 조건 가격 항목"],
      ["Spot", spot, "현물·street price"],
      ["Contract", contract, "계약가 항목"],
      ["Up / Down", `${up}/${down}`, fmtDate(updated)],
    ];
    summary.innerHTML = cards.map(([label, value, note]) => `
      <article class="card">
        <span class="chip accent">${escapeHTML(label)}</span>
        <h3>${typeof value === "number" ? countHTML(value) : escapeHTML(value)}</h3>
        <p>${escapeHTML(note)}</p>
      </article>
    `).join("");
  }

  function renderPriceRows() {
    const tbody = $("#priceRows");
    const rows = priceRowsFor();
    tbody.innerHTML = "";
    if (!rows.length) {
      const entries = healthEntries(["가격:"]);
      const failed = entries.filter((entry) => !entry.ok).map((entry) => entry.msg).filter(Boolean).join(" · ");
      const msg = failed || "TrendForce 공개 테이블 구조 변경, 접근 실패, 또는 아직 수집된 rows가 없습니다.";
      tbody.appendChild(el("tr", null, `<td colspan="6" class="empty"><span class="data-state fail">Fail · 가격 rows 없음</span><br>${escapeHTML(msg)}<br>마지막 시도: ${escapeHTML(fmtDate(LIVE.prices?.updatedAt || LIVE.updatedAt))}</td>`));
      return;
    }

    rows.slice(0, 22).forEach((row) => {
      const tr = el("tr");
      const change = formatChange(row);
      tr.innerHTML = `
        <td><span class="source-tag">${escapeHTML(row.group || "")}</span></td>
        <td><span class="price-main">${escapeHTML(row.item)}</span><span class="price-sub">${escapeHTML(row.sectionTitle || "")}</span></td>
        <td>${escapeHTML(row.averageRaw || formatPrice(row.average))}</td>
        <td><span class="change ${escapeHTML(row.direction || "flat")}">${escapeHTML(change)}</span></td>
        <td></td>
        <td><a class="rainbow" href="${escapeHTML(row.sourceUrl || "#")}" target="_blank" rel="noopener">${escapeHTML(row.lastUpdate || "TrendForce")}</a></td>
      `;
      tr.children[4].appendChild(sparkline((row.history || []).map((p) => p.average).filter((x) => x != null), row.direction));
      tbody.appendChild(tr);
    });
  }

  function formatPrice(value) {
    if (value == null || Number.isNaN(Number(value))) return "-";
    const n = Number(value);
    return n >= 100 ? n.toFixed(2) : n.toFixed(3);
  }

  function formatChange(row) {
    const n = Number(row.changePct);
    if (!Number.isNaN(n)) return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
    return String(row.changeRaw || "-").replace(/\?\?/g, "");
  }

  function sparkline(vals, direction = "flat") {
    if (!vals || vals.length < 2) return el("span", "price-sub", "history 대기");
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    const w = 96;
    const h = 30;
    const step = w / (vals.length - 1);
    const d = vals.map((v, i) => `${i ? "L" : "M"}${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`).join(" ");
    const color = direction === "down" ? "#2563eb" : direction === "up" ? "#dc2626" : "#6f7b90";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "spark");
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("preserveAspectRatio", "none");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", color);
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.appendChild(path);
    return svg;
  }

  /* ---------------- News ---------------- */
  function rawNews() {
    const live = LIVE.news || [];
    const curated = BASE.curatedNews || [];
    const clean = dedupeNews(live.concat(curated)
      .filter((item) => isForeignNews(item) && isMemoryRelevant(item) && !isAppleContent(item)));
    return clean.length ? clean : (BASE.fallbackNews || []);
  }

  function dedupeNews(items = []) {
    const seen = new Set();
    return items.filter((item) => {
      const key = `${item.link || ""} ${item.title || ""}`.toLowerCase().replace(/\s+/g, " ").trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function isForeignNews(item) {
    const src = `${item.source || ""} ${item.link || ""}`.toLowerCase();
    if (!item || !item.title) return false;
    if (KOREAN_SOURCE_RE.test(src)) return false;
    return true;
  }

  function isMemoryRelevant(item) {
    if (item.curated || item.category) return true;
    const hay = `${item.title || ""} ${item.titleKo || ""} ${item.summary || ""} ${item.source || ""}`.toLowerCase();
    return MEMORY_NEWS_RE.test(hay);
  }

  function isAppleContent(item) {
    const hay = `${item.title || ""} ${item.titleKo || ""} ${item.summary || ""} ${item.source || ""} ${item.link || ""}`;
    return APPLE_CONTENT_RE.test(hay);
  }

  function newsTitle(item) {
    return cleanKoreanTitle(item.titleKo || item.title || "");
  }

  function cleanKoreanTitle(title) {
    return String(title || "")
      .replace(SOURCE_SUFFIX_RE, "")
      .replace(/\bSamsung\b/g, "삼성")
      .replace(/\bMicron\b/g, "마이크론")
      .replace(/\bNVIDIA\b/g, "엔비디아")
      .replace(/\bSK Hynix\b/gi, "SK하이닉스")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isChinaArticle(item) {
    if (item.language === "chinese") return true;
    if (item.category === "china") return true;
    const hay = `${item.category || ""} ${item.source || ""} ${item.link || ""} ${item.title || ""} ${item.titleKo || ""} ${item.summary || ""}`;
    return CHINA_NEWS_RE.test(hay);
  }

  function insightLines(item) {
    const title = newsTitle(item);
    const summary = cleanKoreanTitle(item.summary || title);
    const category = CATEGORY_INSIGHTS[item.category] || "메모리 업계 가격·고객·공급망 변화를 함께 점검";
    const signal = isChinaArticle(item)
      ? "중국 신호: 내수 고객, 정책 지원, 장비·패키징 우회 가능성 확인"
      : "외신 신호: 해외 검증 보도 기준으로 가격·수요·경쟁 구도 확인";
    const meta = item.source || "출처 미상";
    return [
      `핵심: ${clipText(summary, 78)}`,
      `벤치마킹: ${category}`,
      `체크포인트: ${signal} · ${meta}`,
    ];
  }

  function formatNewsDate(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const numeric = raw.match(/(?:20\d{2}[.\-/년]\s*)?(\d{1,2})[.\-/월]\s*(\d{1,2})/);
    if (numeric) return `${Number(numeric[1])}/${Number(numeric[2])}일`;
    const english = raw.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})\b/i);
    if (english) {
      const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
        .indexOf(english[1].slice(0, 3).toLowerCase()) + 1;
      if (month > 0) return `${month}/${Number(english[2])}일`;
    }
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return `${parsed.getMonth() + 1}/${parsed.getDate()}일`;
    }
    return raw;
  }

  function clipText(text, limit) {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    if (clean.length <= limit) return clean;
    return `${clean.slice(0, limit - 1).trim()}…`;
  }

  function filteredNews(categoryId = activeCategory) {
    const cat = memoryCategories().find((item) => item.id === categoryId);
    const terms = (cat?.keywords || []).map((term) => term.toLowerCase());
    return rawNews().filter((item) => {
      if (!categoryId || categoryId === "all") return true;
      if (item.category === categoryId) return true;
      const hay = `${item.title || ""} ${item.titleKo || ""} ${item.summary || ""} ${item.source || ""}`.toLowerCase();
      return terms.some((term) => hay.includes(term));
    });
  }

  function newsCompanies() {
    return BASE.companies || [];
  }

  function newsCompanyTerms(company) {
    if (!company) return [];
    const pieces = [
      company.id,
      company.name,
      company.fullName,
      ...(COMPANY_NEWS_ALIASES[company.id] || []),
    ];
    return Array.from(new Set(pieces.flatMap((piece) => String(piece || "")
      .split(/[\/·,()]+/)
      .map((term) => term.toLowerCase().replace(/\s+/g, " ").trim())
      .filter((term) => term.length > 1))));
  }

  function newsMatchesCompany(item, companyId = newsCompany) {
    if (!companyId || companyId === "all") return true;
    const company = newsCompanies().find((entry) => entry.id === companyId);
    if (!company) return true;
    const hay = `${item.title || ""} ${item.titleKo || ""} ${item.summary || ""} ${item.source || ""} ${item.link || ""}`.toLowerCase();
    return newsCompanyTerms(company).some((term) => hay.includes(term));
  }

  function newsMatchesSource(item, sourceId = newsSource) {
    return sourceId === "chinese" ? isChinaArticle(item) : item.language === "english" || !isChinaArticle(item);
  }

  function newsBaseForCategory(categoryId = newsCategory) {
    return categoryId === "all" ? rawNews() : filteredNews(categoryId);
  }

  function newsForView(categoryId = newsCategory, companyId = newsCompany, sourceId = newsSource) {
    return newsBaseForCategory(categoryId)
      .filter((item) => newsMatchesCompany(item, companyId))
      .filter((item) => newsMatchesSource(item, sourceId));
  }

  function renderNewsCompanySelect() {
    const select = $("#newsCompanySelect");
    if (!select) return;
    const current = newsCompany;
    const categoryBase = newsBaseForCategory(newsCategory).filter((item) => newsMatchesSource(item));
    const options = [{ id: "all", label: "전체 업체", count: categoryBase.length }].concat(newsCompanies().map((company) => ({
      id: company.id,
      label: company.name,
      count: categoryBase.filter((item) => newsMatchesCompany(item, company.id)).length,
    })));

    select.innerHTML = options.map((option) =>
      `<option value="${escapeHTML(option.id)}">${escapeHTML(option.label)} · ${fmtNum(option.count)}건</option>`
    ).join("");
    select.value = options.some((option) => option.id === current) ? current : "all";
    newsCompany = select.value;
  }

  function renderNewsSourceTabs() {
    const wrap = $("#newsSourceTabs");
    if (!wrap) return;
    wrap.innerHTML = "";
    NEWS_SOURCE_TABS.forEach((tab) => {
      const count = newsForView(newsCategory, newsCompany, tab.id).length;
      const btn = el("button", tab.id === newsSource ? "active" : "", `${escapeHTML(tab.label)} ${fmtNum(count)}건`);
      btn.type = "button";
      btn.addEventListener("click", () => {
        newsSource = tab.id;
        renderNews();
      });
      wrap.appendChild(btn);
    });
  }

  function renderNews() {
    const tabs = $("#newsTabs");
    tabs.innerHTML = "";
    const cats = memoryCategories().filter((cat) => cat.id !== "all");
    const options = [{ id: "all", label: "전체", count: newsForView("all").length }].concat(cats.map((cat) => ({
      id: cat.id,
      label: cat.label,
      count: newsForView(cat.id).length,
    })));

    if (activeCategory !== "all" && options.some((opt) => opt.id === activeCategory)) {
      newsCategory = activeCategory;
    }

    renderNewsCompanySelect();
    renderNewsSourceTabs();

    options.forEach((opt) => {
      const btn = el("button", opt.id === newsCategory ? "active" : "", `${escapeHTML(opt.label)} ${opt.count}`);
      btn.type = "button";
      btn.addEventListener("click", () => {
        newsCategory = opt.id;
        renderNewsCompanySelect();
        renderNewsSourceTabs();
        renderNewsList();
        $$("#newsTabs button").forEach((b) => b.classList.toggle("active", b === btn));
      });
      tabs.appendChild(btn);
    });

    renderNewsList();
  }

  function renderNewsList() {
    const base = newsForView(newsCategory);
    const items = base.filter((item) => {
      if (!newsSearch) return true;
      return `${item.title || ""} ${item.titleKo || ""} ${item.summary || ""} ${item.source || ""}`.toLowerCase().includes(newsSearch);
    });
    const activeTab = NEWS_SOURCE_TABS.find((tab) => tab.id === newsSource) || NEWS_SOURCE_TABS[0];
    const allVisible = newsForView(newsCategory, newsCompany, "english").length + newsForView(newsCategory, newsCompany, "chinese").length;
    $("#newsStats").textContent = `· ${fmtNum(items.length)}건 / 전체 ${fmtNum(allVisible)}건`;
    NEWS_SOURCE_TABS.forEach((tab) => {
      const bucket = $(`#${tab.bucketId}`);
      const count = $(`#${tab.countId}`);
      const sourceCount = newsForView(newsCategory, newsCompany, tab.id).filter((item) => {
        if (!newsSearch) return true;
        return `${item.title || ""} ${item.titleKo || ""} ${item.summary || ""} ${item.source || ""}`.toLowerCase().includes(newsSearch);
      }).length;
      if (bucket) bucket.hidden = tab.id !== newsSource;
      if (count) count.textContent = `${fmtNum(sourceCount)}건`;
    });
    setFreshness("#newsFreshness", {
      label: "뉴스",
      updatedAt: LIVE.updatedAt,
      source: "Google News RSS + 큐레이션",
      count: rawNews().length,
      healthKeys: ["뉴스:"],
      staleHours: 18,
    });
    renderNewsBucket($(`#${activeTab.listId}`), items, `조건에 맞는 ${activeTab.label} 없음`);
  }

  function renderNewsBucket(list, items, emptyMessage) {
    list.innerHTML = "";
    if (!items.length) {
      list.appendChild(el("li", null, `<span class="empty">${escapeHTML(emptyMessage)}</span>`));
      return;
    }

    items.slice(0, 42).forEach((item) => {
      const li = el("li");
      const a = el("a");
      a.href = item.link || "#";
      a.target = "_blank";
      a.rel = "noopener";
      const insights = insightLines(item);
      a.innerHTML = `
        <span>
          <span class="source-tag">${escapeHTML(item.source || "Foreign source")}</span>
          <span class="news-title">${escapeHTML(newsTitle(item))}</span>
          <span class="news-insights">
            ${insights.map((line) => `<span>${escapeHTML(line)}</span>`).join("")}
          </span>
        </span>
        <span class="news-meta">${escapeHTML(formatNewsDate(item.date || item.published))}</span>
      `;
      li.appendChild(a);
      list.appendChild(li);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
