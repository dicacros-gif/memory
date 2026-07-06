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
    chinaInfra: { sources: [], signals: [] },
    newsStats: {},
    health: [],
  };
  const emptyHistory = {
    updatedAt: null,
    timezone: "Asia/Seoul",
    items: {},
  };

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
  const LOW_CONFIDENCE_NEWS_RE =
    /(ad hoc news|asia business outlook|indexbox|36\s*kr|36kr|borncity|mjengo|blockchain\.news|odaily|zamin\.uz|finance\.biggo|crypto briefing|weex|fortrinawwer|siliconanalysts|nand-research|reddit|facebook|linkedin\.com|x\.com|twitter\.com)/i;
  const MEMORY_NEWS_RE =
    /(memory|dram|nand|hbm|ddr|lpddr|gddr|ssd|semiconductor|chip|wafer|foundry|packaging|interconnect|cxl|trendforce|dramexchange|micron|samsung|sk hynix|hynix|kioxia|western digital|sandisk|cxmt|changxin|ymtc|yangtze|jcet|tfme|xmc|wuhan xinxin|naura|amec|acm research|techinsights|yole|big fund|export control|china chip|chinese chip)/i;
  const CHINA_NEWS_RE =
    /(china|chinese|cxmt|changxin|ymtc|yangtze|jcet|tfme|xmc|wuhan|naura|amec|huawei|tencent|alibaba|baidu|lenovo|big fund|pandaily|caixin|yicai|scmp|kraneshares|sina|sohu|eastmoney|huxiu|jiwei|c114|digitimes asia)/i;
  const APPLE_CONTENT_RE =
    /\b(apple|applem|aapl|iphone|ipad|macbook|9to5mac|applemagazine)\b|애플|아이폰|아이패드|맥북/i;
  const SOURCE_SUFFIX_RE = /\s[-–—]\s(?:[A-Za-z0-9가-힣 .·&]+)$/;
  const HIDDEN_SECTIONS = new Set(["corpdev", "categories", "response"]);
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
    operations: "SKHY 중국 운영, 다롄/Solidigm, VEU 규제 리스크를 별도 점검",
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
    { name: "Cyan", sidebar: "#071D43", sidebarHi: "#123B7A", sidebarLow: "#050B1A", accent: "#3C82FF", accent1: "#3C82FF", accent2: "#00E6FF", accent3: "#A050FF", accentRgb1: "60, 130, 255", accentRgb2: "0, 230, 255", blue: "#3C82FF", teal: "#00C8A0", purple: "#A050FF", green: "#10B981" },
    { name: "Purple", sidebar: "#25104D", sidebarHi: "#6530B8", sidebarLow: "#120824", accent: "#A050FF", accent1: "#A050FF", accent2: "#FF3CAA", accent3: "#C878FF", accentRgb1: "160, 80, 255", accentRgb2: "255, 60, 170", blue: "#7C7CFF", teal: "#00C8FF", purple: "#A050FF", green: "#10B981" },
    { name: "Emerald", sidebar: "#063D36", sidebarHi: "#008A78", sidebarLow: "#03201D", accent: "#00C8A0", accent1: "#00C8A0", accent2: "#00E5C8", accent3: "#00C8FF", accentRgb1: "0, 200, 160", accentRgb2: "0, 229, 200", blue: "#2563EB", teal: "#00C8A0", purple: "#7C3AED", green: "#00B86B" },
    { name: "Rose", sidebar: "#4A1021", sidebarHi: "#B6204B", sidebarLow: "#220811", accent: "#FF4070", accent1: "#FF4070", accent2: "#FF6B9D", accent3: "#FF8C42", accentRgb1: "255, 64, 112", accentRgb2: "255, 107, 157", blue: "#3C82FF", teal: "#00C8A0", purple: "#C878FF", green: "#10B981" },
    { name: "Amber", sidebar: "#4A2605", sidebarHi: "#B96A0A", sidebarLow: "#201003", accent: "#FF9500", accent1: "#FF9500", accent2: "#FFB830", accent3: "#FF6B28", accentRgb1: "255, 149, 0", accentRgb2: "255, 184, 48", blue: "#3C82FF", teal: "#00AFA0", purple: "#A050FF", green: "#10B981" },
  ];
  const NAV_ACCENTS = {
    overview: "#FFFFFF",
    "executive-decision": "#FDE68A",
    "management-strategy": "#A7F3D0",
    "strategic-investment-decision": "#FBCFE8",
    "policy-makers": "#BFDBFE",
    "china-fab-infra": "#67E8F9",
    "china-talent-strategy": "#F0ABFC",
    numbers: "#FDE68A",
    projection: "#FBBF24",
    workbench: "#B9A7FF",
    "memory-market-map": "#38BDF8",
    "ai-matrix": "#C4B5FD",
    prices: "#FFD166",
    news: "#93C5FD",
    "china-nand": "#66D9E8",
    "china-dynamics": "#7DD3FC",
    "talent-radar": "#F0ABFC",
    "china-deep-dive": "#86EFAC",
    categories: "#C4B5FD",
    competitors: "#F0ABFC",
    response: "#FCA5A5",
  };
  const POLICY_MAKER_LENSES = [
    {
      id: "china",
      label: "중국",
      en: "China",
      subtitle: "자립화 · 지방정부 · 당조직 · 환경규제",
      accentCategory: "china",
      verdict: "조건부 O",
      status: "Watch",
      direction: "반도체 자립, 지방정부 펀드, 공급망 내재화, 외자 안정화가 동시에 움직입니다. SKHY 중국 법인은 현지 운영 연속성과 기술/IP 방어를 분리해 관리해야 합니다.",
      law: "회사법상 당조직 활동 조건 제공 의무, 지방 IC 펀드, 환경 고품질 발전 기조",
      skImpact: "Wuxi DRAM, Chongqing 후공정, Dalian/Solidigm 스토리지 거점은 중국 산업정책과 미국 수출통제 사이에서 기존 운영 중심으로 관리해야 합니다.",
      strategy: "중국 내 고객 대응은 유지하되, 선단 공정 업그레이드·핵심 recipe 이전·JV 구조는 공식 출처와 법무 검토가 충족될 때만 조건부 진행합니다.",
      partyNote: "공개 확인 필요: 공개 출처로 확인되는 것은 중국 회사법의 당조직 조항과 Wuxi 시 당서기 참석 기록입니다. SKHY 중국 법인 내부 당서기 성명은 공개 출처로 확인되지 않아 추정하지 않습니다.",
      sites: [
        { name: "SK hynix Semiconductor (China) Ltd.", role: "Wuxi DRAM production site", note: "공식 오피스 페이지 기준 생산 거점" },
        { name: "SK hynix Semiconductor (Chongqing) Ltd.", role: "Chongqing headquarters", note: "보세구 후공정/운영 리스크 추적" },
        { name: "SK hynix Semiconductor storage technology (Dalian) Co. Ltd", role: "Dalian storage site", note: "Solidigm/NAND 자산과 규제 리스크 별도 추적" },
      ],
      rules: [
        { axis: "산업정책", status: "O", title: "지방정부 반도체 펀드와 내재화", evidence: "Shenzhen은 50억 위안 IC 펀드를 조성하고 자율·효율적 로컬 공급망을 목표로 제시했습니다.", implication: "중국 고객/장비/소부장 신호는 가격 경쟁보다 먼저 중국 내 생태계 속도 지표로 추적합니다.", source: "Shenzhen Government", sourceUrl: "https://www.sz.gov.cn/en_szgov/news/latest/content/post_12177837.html" },
        { axis: "당조직", status: "Watch", title: "회사법상 당조직 활동 조건 제공", evidence: "중국 회사법은 회사 내 공산당 조직 설치와 활동 조건 제공을 규정합니다.", implication: "법정 일반 조항과 특정 법인의 내부 당서기 정보는 분리 표기해야 합니다.", source: "PRC Company Law", sourceUrl: "https://natlex.ilo.org/dyn/natlex2/natlex2/files/download/92643/CHN92643%20Eng.pdf" },
        { axis: "SK 중국 법인", status: "확인필요", title: "법인 내부 당서기 공개 확인", evidence: "SKHY 공식/뉴스룸 공개자료에서 내부 당서기 성명은 확인되지 않았습니다.", implication: "공개 확인 전까지 실명/조직 직책을 추정하지 않고, 현지 정부 접점과 별도 관리합니다.", source: "SKHY Offices", sourceUrl: "https://www.skhynix.com/company/UI-FR-CP06/" },
        { axis: "지역정부 접점", status: "O", title: "Wuxi 시 당서기 참석 기록", evidence: "2019년 Wuxi C2F 완공식에는 Wuxi Party Secretary가 참석했습니다.", implication: "이는 지방정부 정책 접점 증거이지 SKHY 내부 당서기 증거가 아닙니다.", source: "SKHY Newsroom", sourceUrl: "https://news.skhynix.com/sk-hynix-completes-expanded-fab-c2f-in-wuxi-china/" },
        { axis: "환경/인허가", status: "Watch", title: "고수준 보호와 고품질 발전 병행", evidence: "중국 환경정책은 신규 오염물질·POPs 관리와 산업 고도화를 동시에 압박합니다.", implication: "Wuxi/Dalian/Chongqing 인허가·폐수·화학물질 이슈를 생산 연속성 리스크로 별도 추적합니다.", source: "China MEE", sourceUrl: "https://english.mee.gov.cn/News_service/news_release/202405/P020240529333532299021.pdf" },
      ],
      actions: [
        "중국 내 증설/업그레이드 요청은 '운영 유지', '캐파 확대', '기술 업그레이드'로 분리해 승인합니다.",
        "당조직/노조/지방정부 접점은 법무·컴플라이언스 로그로 남기고 내부 직책은 공개 확인 전 추정하지 않습니다.",
        "현지 환경 인허가와 미국 수출통제 이벤트를 같은 리스크 캘린더에 올립니다.",
      ],
    },
    {
      id: "korea",
      label: "한국",
      en: "Korea",
      subtitle: "K-Chips · 금융지원 · 용인 클러스터 · 환경규제 완화",
      accentCategory: "operations",
      verdict: "O",
      status: "OK",
      direction: "한국 정부는 세액공제, 정책금융, R&D·인력, 용수·전력 인프라를 묶어 국내 첨단 반도체 생태계 경쟁력을 높이는 방향입니다.",
      law: "K-Chips 세액공제, 26조원 반도체 생태계 지원 패키지, 화학물질 규제 합리화",
      skImpact: "HBM·선단 DRAM·차세대 패키징·핵심 인력 방어는 한국 내 투자와 연결하고, 중국 법인 리스크는 본사 통제 로그로 끌어올려야 합니다.",
      strategy: "한국 내 첨단 투자를 우선순위로 두고 중국 사업은 현금창출·고객 대응·규제 준수 중심으로 관리합니다. 정책금융/세액공제는 HBM, eSSD, CXL, 환경설비 투자에 연결합니다.",
      partyNote: "한국 탭에서는 중국 당조직 정보를 직접 판단하지 않고, 해외법인 리스크 통제·국가핵심기술 보호·인력 유출 방어 관점으로 연결합니다.",
      sites: [
        { name: "Icheon / Cheongju", role: "국내 제조·R&D 중심", note: "첨단 투자와 국가전략기술 세액공제 연계" },
        { name: "Yongin cluster", role: "용수·전력·도로 인프라", note: "정부 인프라 패키지 추적" },
        { name: "China subsidiaries", role: "해외법인 리스크", note: "본사 기준 IP/인력/규제 통제" },
      ],
      rules: [
        { axis: "세제", status: "O", title: "K-Chips 투자세액공제 확대", evidence: "대기업·중견기업 세액공제율 15%에서 20%, 중소기업 25%에서 30%로 확대가 공표됐습니다.", implication: "한국 내 HBM/선단 공정/환경설비 투자를 우선 검토합니다.", source: "MOEF", sourceUrl: "https://english.moef.go.kr/pc/selectTbPressCenterDtl.do?boardCd=N0001&seq=6117" },
        { axis: "금융", status: "O", title: "26조원 생태계 지원 패키지", evidence: "18.1조원 금융지원, 17조원 저리대출, 8천억원 펀드, 2025~2027년 5조원 R&D·사업화·인력 투자가 제시됐습니다.", implication: "소부장·패키징·CXL·테스트 밸류체인과 공동 투자 후보를 연결합니다.", source: "MOEF", sourceUrl: "https://english.moef.go.kr/pc/selectTbPressCenterDtl.do?boardCd=N0001&seq=5899" },
        { axis: "인프라", status: "O", title: "용수·전력·도로 패키지", evidence: "용인 클러스터 용수 이중관로와 3GW 전력 공급 등 인프라 지원 방향이 공표됐습니다.", implication: "국내 첨단 캐파 병목을 중국 리스크 완충장치로 봅니다.", source: "MOEF", sourceUrl: "https://english.moef.go.kr/pc/selectTbPressCenterDtl.do?boardCd=N0001&seq=5899" },
        { axis: "환경법", status: "Watch", title: "화학물질 규제 합리화", evidence: "환경부는 첨단산업 규제 개선과 2030년까지 8.8조원 이상 경제효과를 언급했습니다.", implication: "화학물질·폐수·온실가스 투자는 인허가 속도와 사회적 수용성을 동시에 관리합니다.", source: "Korea Ministry of Environment", sourceUrl: "https://www.me.go.kr/eng/web/board/read.do%3Bjsessionid%3DbQgYIwaC9B0IXC1md7cW0H3MX3-7KITTl5QdwSO8.mehome1?boardCategoryId=&boardId=1620870&boardMasterId=522&decorator=&maxIndexPages=10&maxPageItems=10&menuId=&orgCd=&pagerOffset=480&searchKey=&searchValue=" },
      ],
      actions: [
        "국내 정책금융·세액공제 대상 투자와 중국 사업 유지투자를 분리해 ROI를 계산합니다.",
        "국가핵심기술·인력 유출 방어를 중국 벤치마킹 탭의 Talent/IP 신호와 연결합니다.",
        "환경 인허가 개선 항목은 실제 공장별 병목 제거 여부로만 성과 판단합니다.",
      ],
      sources: [
        { label: "MOEF support package", url: "https://english.moef.go.kr/pc/selectTbPressCenterDtl.do?boardCd=N0001&seq=5899" },
        { label: "MOEF K-Chips", url: "https://english.moef.go.kr/pc/selectTbPressCenterDtl.do?boardCd=N0001&seq=6117" },
        { label: "Korea Ministry of Environment", url: "https://www.me.go.kr/eng/web/board/read.do%3Bjsessionid%3DbQgYIwaC9B0IXC1md7cW0H3MX3-7KITTl5QdwSO8.mehome1?boardCategoryId=&boardId=1620870&boardMasterId=522&decorator=&maxIndexPages=10&maxPageItems=10&menuId=&orgCd=&pagerOffset=480&searchKey=&searchValue=" },
      ],
    },
    {
      id: "usa",
      label: "미국",
      en: "United States",
      subtitle: "CHIPS Act · BIS export control · outbound investment · NEPA",
      accentCategory: "geopolitics",
      verdict: "조건부 O / 업그레이드 X",
      status: "Watch",
      direction: "미국은 CHIPS 보조금으로 자국 내 제조·R&D를 키우고, 중국 내 선단 반도체 역량 확대를 수출통제와 투자심사로 제한하는 방향입니다.",
      law: "CHIPS and Science Act, BIS VEU 변경, Outbound Investment Program, NEPA",
      skImpact: "SKHY 중국 공장은 기존 운영 유지와 기술 업그레이드·캐파 확대를 분리해 BIS 라이선스 리스크를 관리해야 합니다.",
      strategy: "중국 공장은 기존 fab 운영 연속성, 고객 서비스, 규제 증빙을 우선합니다. 미국/한국 투자와 HBM·AI 메모리 로드맵은 중국 내 업그레이드와 법적으로 분리합니다.",
      partyNote: "미국 탭의 핵심은 중국 내부 정치조직 자체가 아니라, 중국 법인·고객·장비 흐름이 미국 수출통제상 최종용도·최종사용자 리스크로 어떻게 보이는지입니다.",
      sites: [
        { name: "Former VEU China fabs", role: "기존 운영 라이선스", note: "BIS는 기존 fab 운영 허용 취지와 확대/업그레이드 제한 취지를 분리했습니다." },
        { name: "US CHIPS ecosystem", role: "미국 내 R&D·제조 인센티브", note: "미국 내 시설·장비 투자 인센티브와 R&D 프로그램" },
        { name: "Outbound investment", role: "중국 관련 투자 제한/신고", note: "미국인·미국 controlled foreign entity 거래 검토 필요" },
      ],
      rules: [
        { axis: "CHIPS Act", status: "O", title: "미국 내 제조·R&D 인센티브", evidence: "CHIPS for America는 500억 달러 규모이며 R&D 110억 달러, 시설·장비 인센티브 390억 달러를 집행합니다.", implication: "미국 고객·패키징·R&D 협력은 중국 사업과 분리된 투자 트랙으로 관리합니다.", source: "CHIPS.gov / NIST", sourceUrl: "https://www.chips.gov/" },
        { axis: "BIS/VEU", status: "X", title: "중국 fab 캐파 확대·기술 업그레이드", evidence: "BIS는 VEU 특례 종료 후 기존 fab 운영 라이선스는 의도하되, 중국 내 캐파 확대나 기술 업그레이드 라이선스는 의도하지 않는다고 밝혔습니다.", implication: "Wuxi/Dalian/Chongqing 장비·소프트웨어 반입은 운영 유지와 업그레이드를 분리해 증빙해야 합니다.", source: "BIS", sourceUrl: "https://www.bis.gov/press-release/department-commerce-closes-export-controls-loophole-foreign-owned-semiconductor-fabs-china" },
        { axis: "Outbound investment", status: "Watch", title: "중국 첨단기술 투자 신고/금지", evidence: "미 재무부 규칙은 반도체·마이크로일렉트로닉스, 양자, AI를 대상으로 하고 PRC/HK/Macau를 country of concern으로 지정합니다.", implication: "미국인·미국 계열사가 연결된 중국 JV/지분투자/기술협력은 사전 심사가 필요합니다.", source: "U.S. Treasury", sourceUrl: "https://home.treasury.gov/policy-issues/international/outbound-investment-program" },
        { axis: "환경/인허가", status: "Watch", title: "NEPA와 대형 투자 인허가", evidence: "CHIPS 프로그램은 NEPA 항목을 별도 운영하고, 대형 투자 환경검토는 일정 리스크가 될 수 있습니다.", implication: "미국 내 신규 시설·패키징·R&D 투자는 환경 검토 일정을 의사결정 모델에 넣습니다.", source: "CHIPS.gov / NIST", sourceUrl: "https://www.chips.gov/" },
      ],
      actions: [
        "중국 fab 관련 장비·SW·기술 반입은 기존 운영 유지인지, 캐파 확대/업그레이드인지 먼저 분류합니다.",
        "미국 고객 HBM/AI 메모리 계약과 중국 내 범용 제품 운영은 문서상 분리합니다.",
        "미국인이 관여하는 중국 투자·JV·공급계약은 Outbound Investment와 EAR 체크리스트를 거치게 합니다.",
      ],
      sources: [
        { label: "BIS VEU change", url: "https://www.bis.gov/press-release/department-commerce-closes-export-controls-loophole-foreign-owned-semiconductor-fabs-china" },
        { label: "CHIPS for America", url: "https://www.chips.gov/" },
        { label: "Treasury outbound investment", url: "https://home.treasury.gov/policy-issues/international/outbound-investment-program" },
      ],
    },
  ];
  const CHINA_FAB_INFRA_SITES = [
    {
      id: "wuxi",
      label: "Wuxi DRAM",
      en: "Wuxi",
      subtitle: "K7 plot · C2/C2F · DRAM",
      accentCategory: "china",
      verdict: "운영 업그레이드 O / 신규 대규모 Fab는 확인 필요",
      status: "Watch",
      direction: "Wuxi는 기존 C2/C2F DRAM 거점과 K7 부지 내 기술개조·클린룸 확장 근거가 확인됩니다. 2026년 1월 1z→1a 전환 완료 보도로 고부가 DDR5/고성능 DRAM 생산 여력은 개선됐지만, 추가 신규 fab 증설은 토지사용권, 전력 수전, 용수/폐수 처리 여유, BIS 라이선스를 동시에 확인해야 합니다.",
      decision: "기존 fab 효율화·1a 전환·클린룸 단계 확장은 운영 개선으로 인정합니다. 새 fab/대규모 캐파 증설은 전력·용수·토지 권리·미국 수출통제 확인 전까지 X에 가깝게 보수적으로 판단합니다.",
      liveTerms: ["wuxi", "sk hynix", "1a", "1z", "water", "power", "land", "k7", "c2f", "cleanroom", "bonded zone", "environmental impact"],
      sites: [
        { name: "SK hynix Semiconductor (China) Ltd.", role: "Wuxi DRAM production site", note: "공식 오피스 기준 중국 핵심 DRAM 생산 거점" },
        { name: "K7 plot / Wuxi Hi-Tech District Comprehensive Bonded Zone", role: "기존 공장·기술개조 위치", note: "2017년 EIA에 K7 부지·기존 공장 내 증축으로 명시" },
      ],
      checks: [
        { axis: "공정 업그레이드", status: "O", title: "Wuxi 1z→1a 전환 완료", evidence: "SemiMedia는 2026년 1월 Wuxi DRAM 팹이 1z에서 1a로 전환됐고, 12인치 기준 월 18만~19만 장 캐파 중 약 90%가 1a 공정이라고 보도했습니다.", implication: "DDR5·고성능 DRAM 양산 여력과 수익성은 개선 신호지만, 1b/1c 같은 최선단 이전 근거로 해석하지 않습니다.", source: "SemiMedia", sourceUrl: "https://www.semimedia.cc/sk-hynix-completes-wuxi-dram-fab-upgrade-enabling-advanced-1a-process-production/" },
        { axis: "투자 집행", status: "O", title: "2025년 Wuxi 투자 5,810억 원", evidence: "TrendForce가 2025년 Wuxi DRAM 투자액을 5,810억 원으로 정리했습니다. 전년 2,873억 원 대비 102% 증가한 수치로 중국 거점 운영 효율화 신호입니다.", implication: "중국 거점은 단순 유지가 아니라 제재 범위 내 최적화·운영 효율화 투자가 진행된 것으로 추적합니다.", source: "TrendForce", sourceUrl: "https://www.trendforce.com/news/2026/03/27/news-memory-giants-china-investments-soar-in-2025-samsung-xian-up-67-5-sk-hynix-wuxi-dalian-hit-trillion-won/" },
        { axis: "토지/부지", status: "조건부 O", title: "K7 부지 내 기존 공장 확장 근거", evidence: "2017년 WND 환경영향평가는 12인치 IC 라인 6기 기술개조와 CleanRoom 확장을 K7 부지, 기존 공장 내 프로젝트로 명시했습니다.", implication: "기존 부지 내 기술개조·클린룸 확장 근거는 있으나, 남은 토지 면적/토지사용권 기간은 별도 확인해야 합니다.", source: "Wuxi New District EIA", sourceUrl: "https://www.wnd.gov.cn/doc/2017/02/28/2386281.shtml" },
        { axis: "클린룸/공간", status: "조건부 O", title: "C2F 58,000m2 및 추가 클린룸 유연성", evidence: "SKHY는 C2F가 58,000m2 규모이며, 추가 클린룸 공사와 장비 반입 시점은 시장 상황에 따라 유연하게 결정한다고 밝혔습니다.", implication: "공간 병목 완화 근거는 있으나 신규 fab 증설과 동일하게 해석하면 안 됩니다.", source: "SKHY Newsroom", sourceUrl: "https://news.skhynix.com/sk-hynix-completes-expanded-fab-c2f-in-wuxi-china/" },
        { axis: "용수/폐수", status: "Watch", title: "재생수·MBR·신청하수처리장 연계", evidence: "EIA는 산성/불소/동/유기/생활폐수를 분류 처리하고, 재생수 회용 시범공정·MBR 회용·신청하수처리장 연계를 설명합니다.", implication: "기존 승인 범위의 폐수 처리 체계는 확인되나, 추가 캐파는 신규 물 사용량·폐수총량·수질총량 인허가가 필요합니다.", source: "Wuxi New District EIA", sourceUrl: "https://www.wnd.gov.cn/doc/2017/02/28/2386281.shtml" },
        { axis: "전력/유틸리티", status: "확인필요", title: "전력 수전 용량 공개자료 부족", evidence: "확인한 공개자료에는 Wuxi fab의 전력 계약용량, 변전소 여유, 추가 장비 수전 가능량이 숫자로 공개되어 있지 않습니다.", implication: "추가 fab 판단은 전력 quota·변전소·비상전원·냉동기 부하 확인 전까지 보류해야 합니다.", source: "Public source gap", sourceUrl: "https://www.skhynix.com/company/UI-FR-CP06/" },
        { axis: "환경/인허가", status: "O", title: "2017년 프로젝트 환경 타당성 결론", evidence: "EIA는 해당 주소의 건설이 산업정책·지역계획과 부합하고 오염방지 조치가 기술경제적으로 가능하다고 결론 냈습니다.", implication: "동일 범위의 기술개조 근거는 있으나, 신규 fab은 새 EIA·공중의견·배출총량 심사를 다시 봐야 합니다.", source: "Wuxi New District EIA", sourceUrl: "https://www.wnd.gov.cn/doc/2017/02/28/2386281.shtml" },
        { axis: "보세구/물류", status: "Watch", title: "Wuxi 보세구 확장", evidence: "Wuxi Hi-Tech District 종합보세구는 2025년 면적을 1.11km2 늘려 총 3.49km2로 조정됐고, SK hynix premises가 핵심 사례로 언급됐습니다.", implication: "주변 산업·물류 수용력은 긍정 신호지만 SKHY 보유 토지 확대 증거는 아닙니다.", source: "Wuxi Government", sourceUrl: "https://en.wuxi.gov.cn/2025-07/31/c_1113622.htm" },
        { axis: "미국 수출통제", status: "X", title: "캐파 확대·기술 업그레이드 라이선스 리스크", evidence: "BIS는 VEU 특례 종료 후 기존 운영 라이선스는 의도하지만 중국 내 캐파 확대나 기술 업그레이드 라이선스는 의도하지 않는다고 밝혔습니다.", implication: "인프라가 가능해도 장비·SW·공정 업그레이드가 막히면 확장 판단은 No-Go입니다.", source: "BIS", sourceUrl: "https://www.bis.gov/press-release/department-commerce-closes-export-controls-loophole-foreign-owned-semiconductor-fabs-china" },
      ],
    },
    {
      id: "dalian",
      label: "Dalian Storage",
      en: "Dalian",
      subtitle: "NAND / Solidigm · storage site",
      accentCategory: "nand",
      verdict: "Phase 2 Watch / 확장 인프라 확인필요",
      status: "Check",
      direction: "Dalian 법인 주소와 스토리지 거점은 공식 오피스 페이지로 확인됩니다. 2025년 투자 증가와 2026년 하반기 Phase 2 장비 설치 검토 보도는 NAND 캐파 옵션을 다시 열지만, 추가 wafer fab 확장을 판단할 수 있는 토지·용수·전력 수치 공개자료는 부족합니다.",
      decision: "Dalian은 NAND/Solidigm 운영 리스크와 Phase 2 재가동 옵션을 함께 관찰합니다. 신규 fab 확장 후보로 보기 전에 부지 권리·수전 용량·폐수 처리 인허가와 BIS 라이선스를 새로 확인합니다.",
      liveTerms: ["dalian", "phase 2", "solidigm", "sk hynix", "storage", "200-layer", "floating gate", "water", "power", "land"],
      sites: [
        { name: "SK hynix Semiconductor storage technology (Dalian) Co. Ltd", role: "Dalian storage site", note: "공식 오피스 기준 주소 확인" },
      ],
      checks: [
        { axis: "투자 집행", status: "O", title: "2025년 Dalian NAND 투자 4,406억 원", evidence: "TrendForce가 2025년 Dalian NAND 투자액을 4,406억 원으로 정리했습니다. 전년 대비 52% 증가한 수치로 NAND/Solidigm 운영 효율화와 캐파 옵션을 함께 봐야 합니다.", implication: "Dalian은 단순 보유 자산이 아니라 NAND/Solidigm 운영 효율화와 캐파 옵션의 우선 감시 자산입니다.", source: "TrendForce", sourceUrl: "https://www.trendforce.com/news/2026/03/27/news-memory-giants-china-investments-soar-in-2025-samsung-xian-up-67-5-sk-hynix-wuxi-dalian-hit-trillion-won/" },
        { axis: "Phase 2 재가동", status: "Watch", title: "2026년 하반기 Dalian Phase 2 장비 설치 검토", evidence: "TrendForce는 The Bell 보도를 인용해 Dalian Phase 2가 NAND 캐파 확장 후보로 부상했고 2026년 하반기 장비 설치를 계획한다고 전했습니다. Phase 1은 192-layer로 최신 321-layer 대비 2세대 이상 뒤처진 것으로 언급됐습니다.", implication: "중국 내 NAND 캐파 옵션은 살아 있지만, 200-layer 중반대 생산·장비 반입·BIS 허가를 분리 확인해야 합니다.", source: "TrendForce", sourceUrl: "https://www.trendforce.com/news/2026/03/30/news-samsung-reportedly-advances-xian-to-236-layer-nand-sk-hynix-eyes-dalian-upgrade-amid-tight-supply/" },
        { axis: "토지/부지", status: "확인필요", title: "Dalian 토지사용권·확장 부지 미공개", evidence: "공식 오피스는 위치를 제공하지만 추가 fab 후보 면적이나 토지사용권 조건은 공개 확인되지 않았습니다.", implication: "부지 권리 확인 전 신규 fab 확장 판단 금지.", source: "SKHY Offices", sourceUrl: "https://www.skhynix.com/company/UI-FR-CP06/" },
        { axis: "용수/폐수", status: "확인필요", title: "공정 용수·폐수 인허가 미확인", evidence: "Dalian site의 공정 용수 배정량과 폐수 처리 여유는 공개자료로 확인되지 않았습니다.", implication: "NAND/스토리지 공정 확장은 현지 EIA·수자원 허가를 먼저 크롤링해야 합니다.", source: "SKHY Offices", sourceUrl: "https://www.skhynix.com/company/UI-FR-CP06/" },
        { axis: "전력/유틸리티", status: "확인필요", title: "수전 용량·변전소 여유 미확인", evidence: "전력 계약용량과 비상전원 구성은 공개자료가 없습니다.", implication: "전력 신호 없이는 fab 확장 O 판단 불가.", source: "Public source gap", sourceUrl: "https://www.skhynix.com/company/UI-FR-CP06/" },
      ],
    },
    {
      id: "chongqing",
      label: "Chongqing Assembly",
      en: "Chongqing",
      subtitle: "bonded zone · back-end/operations",
      accentCategory: "packaging",
      verdict: "Fab 확장 X / 운영 인프라 Watch",
      status: "Watch",
      direction: "Chongqing 법인은 공식 오피스 기준 중국 내 운영 거점이지만, wafer fab 확장 후보라기보다 후공정/보세구 운영 리스크 관찰 대상으로 보는 것이 안전합니다.",
      decision: "Chongqing은 추가 전공정 fab 후보로 판단하지 않고, 물류·후공정·고객 대응 인프라 탭에서 감시합니다.",
      liveTerms: ["chongqing", "sk hynix", "bonded zone", "assembly", "packaging", "power", "water"],
      sites: [
        { name: "SK hynix Semiconductor (Chongqing) Ltd.", role: "Chongqing headquarters", note: "공식 오피스 기준 보세구 거점" },
      ],
      checks: [
        { axis: "Fab 적합성", status: "X", title: "전공정 fab 확장 근거 부족", evidence: "공식 오피스는 Chongqing 소재 법인을 보여주지만 300mm 전공정 fab 확장 근거는 공개 확인되지 않았습니다.", implication: "fab 확장 후보보다는 후공정/물류 운영 리스크로 분류합니다.", source: "SKHY Offices", sourceUrl: "https://www.skhynix.com/company/UI-FR-CP06/" },
        { axis: "용수/전력", status: "확인필요", title: "후공정 증설 유틸리티 확인 필요", evidence: "공개자료만으로 용수·전력 여유를 판단할 수 없습니다.", implication: "패키징/테스트 증설도 전력·폐수·화학물질 허가를 별도 확인합니다.", source: "Public source gap", sourceUrl: "https://www.skhynix.com/company/UI-FR-CP06/" },
      ],
    },
  ];
  const CHINA_TALENT_STRATEGY_SCENARIOS = [
    {
      id: "operate",
      label: "운영 유지",
      en: "Operate",
      subtitle: "Wuxi · Dalian · Chongqing",
      accentCategory: "operations",
      verdict: "O / 현지 운영 안정화",
      status: "OK",
      direction: "중국 내 기존 거점은 신규 선단 이전보다 운영 연속성, EHS, 설비 유지보수, 고객 품질 대응 인력을 안정적으로 확보하는 것이 우선입니다.",
      decision: "Wuxi DRAM, Dalian storage, Chongqing 운영 거점은 현지 채용을 유지하되 핵심 공정 recipe와 선단 수율 데이터 접근권은 본사 통제 아래 둡니다.",
      keywords: ["wuxi", "dalian", "chongqing", "sk hynix", "ehs", "facility", "quality", "maintenance", "operator", "engineer"],
      roles: [
        { name: "Fab 운영·설비 유지", target: "Wuxi", plan: "장비 PM, facility, utility, EHS, 품질 인력을 현지 상시 풀로 확보" },
        { name: "스토리지 고객 품질", target: "Dalian", plan: "eSSD/SSD 고객 대응, FA, 신뢰성, 물류 운영 인력을 보강" },
        { name: "후공정·보세구 운영", target: "Chongqing", plan: "패키징/테스트 운영, 보세구 통관, 고객 납기 관리 인력을 유지" },
      ],
      channels: ["로컬 채용", "현지 대학·전문대 협력", "협력사 전환 채용", "EHS·facility 인증 인력 풀"],
      gates: [
        { axis: "채용 범위", status: "O", title: "현지 운영·EHS·설비 인력 확보", evidence: "공개 공식 거점은 Wuxi, Dalian, Chongqing으로 확인됩니다.", implication: "중국 법인의 안정 운영을 위한 현지 채용은 O로 판단합니다.", source: "SKHY Offices", sourceUrl: "https://www.skhynix.com/company/UI-FR-CP06/" },
        { axis: "데이터 접근", status: "Watch", title: "공정 데이터 접근권 최소화", evidence: "중국 사업은 미국 수출통제와 한국 국가핵심기술 보호 관점에서 운영 유지와 기술 업그레이드를 분리해야 합니다.", implication: "현지 운영 인력에게 필요한 업무권한만 부여하고 recipe·수율 데이터 접근은 로그화합니다.", source: "BIS", sourceUrl: "https://www.bis.gov/press-release/department-commerce-closes-export-controls-loophole-foreign-owned-semiconductor-fabs-china" },
        { axis: "금지선", status: "X", title: "경쟁사 영업비밀·recipe 반입 금지", evidence: "인력 확보는 합법적 공개 채용과 내부 리텐션 중심으로 설계해야 합니다.", implication: "경쟁사 비밀자료, 수율 recipe, 고객 비공개 데이터를 가져오는 방식은 금지합니다.", source: "Compliance rule", sourceUrl: "https://www.skhynix.com/company/UI-FR-CP06/" },
      ],
      actions: ["중국 거점별 핵심 직무 vacancy를 월별로 점검", "EHS·facility·품질 인력은 로컬 풀을 유지", "접근권·퇴직자 자료 반출 로그를 인사/보안 KPI로 관리"],
    },
    {
      id: "nand-essd",
      label: "NAND/eSSD 강화",
      en: "NAND / eSSD",
      subtitle: "Dalian · Solidigm · customer quality",
      accentCategory: "nand",
      verdict: "조건부 O",
      status: "Watch",
      direction: "중국 NAND·eSSD 사업은 Dalian/Solidigm 자산, 중국 서버 고객, YMTC eSSD 침투 신호를 함께 보며 고객 품질·펌웨어 검증·FAE 인력을 확보해야 합니다.",
      decision: "고객 대응과 제품 검증 인력은 확충하되, 컨트롤러 IP와 펌웨어 핵심 소스 접근은 지역·직무별로 차등 통제합니다.",
      keywords: ["dalian", "solidigm", "enterprise ssd", "essd", "ymtc", "nand", "firmware", "customer quality", "fae", "validation"],
      roles: [
        { name: "eSSD 고객 품질·FAE", target: "Dalian / China customer", plan: "중국 서버·스토리지 고객의 qualification, RMA, FA 대응 속도 강화" },
        { name: "펌웨어 검증·신뢰성", target: "Dalian / global link", plan: "현지 검증 인력은 확대하되 핵심 펌웨어 소스와 보안키 접근은 분리" },
        { name: "NAND 가격·고객 정보 분석", target: "China sales ops", plan: "YMTC, eSSD 조달, NAND 계약가, 내수 보조금 신호를 매일 분석" },
      ],
      channels: ["로컬 경력 채용", "고객 품질/FAE 추천 채용", "대학 펌웨어·스토리지 랩", "중국 서버 고객 공동 품질 워룸"],
      gates: [
        { axis: "사업 필요성", status: "O", title: "Dalian/Solidigm 스토리지 운영과 연결", evidence: "SKHY는 Intel NAND/SSD 사업 1단계 인수를 완료했고 Solidigm을 통해 SSD 사업을 운영합니다.", implication: "eSSD 고객 품질·검증 인력은 중국 사업 방어에 직접 필요합니다.", source: "SKHY Newsroom", sourceUrl: "https://news.skhynix.com/sk-hynix-completes-the-first-phase-of-intel-nand-and-ssd-business-acquisition/" },
        { axis: "IP 통제", status: "Watch", title: "펌웨어·컨트롤러 IP 접근 분리", evidence: "NAND 사업 강화는 고객 대응 인력과 핵심 IP 접근 인력을 분리해야 합니다.", implication: "현지 인력은 검증·품질·고객 대응 중심, 핵심 펌웨어 소스는 본사 통제 중심으로 둡니다.", source: "Internal control logic", sourceUrl: "https://www.skhynix.com/company/UI-FR-CP06/" },
        { axis: "금지선", status: "X", title: "경쟁사 고객 비공개 인증자료 활용 금지", evidence: "YMTC 등 경쟁사 동향은 공개 기사·로컬 채용·특허·가격 신호로만 수집해야 합니다.", implication: "고객 NDA 자료나 경쟁사 비공개 테스트 데이터를 채용 조건으로 요구하지 않습니다.", source: "Compliance rule", sourceUrl: "https://www.skhynix.com/company/UI-FR-CP06/" },
      ],
      actions: ["중국 eSSD 고객별 FAE coverage map 작성", "펌웨어·검증 인력의 접근권 등급화", "YMTC eSSD/내수 조달 신호와 Dalian 채용 계획을 연결"],
    },
    {
      id: "infra-packaging",
      label: "Fab·패키징 확장",
      en: "Infra / Packaging",
      subtitle: "Wuxi utilities · Chongqing backend",
      accentCategory: "packaging",
      verdict: "확인필요",
      status: "Check",
      direction: "추가 fab 또는 패키징 확장은 토지·용수·전력·환경·BIS 제약이 모두 충족될 때만 가능하므로, 생산 인력보다 먼저 유틸리티·EHS·인허가·패키징 산업공학 인력이 필요합니다.",
      decision: "증설 O/X가 확정되기 전에는 설비·수처리·전력·환경 인허가 인력을 option 형태로 확보하고, 선단 공정 이전 직무는 승인 전 채용하지 않습니다.",
      keywords: ["wuxi", "k7", "c2f", "water", "wastewater", "power", "facility", "packaging", "test", "chongqing", "environmental impact"],
      roles: [
        { name: "유틸리티·전력·수처리", target: "Wuxi", plan: "전력 수전, 냉동기 부하, 공정용수, 폐수총량을 숫자로 검증할 현지 전문가 확보" },
        { name: "환경 인허가·정부 대응", target: "Wuxi / Chongqing", plan: "EIA, 보세구, 배출총량, 화학물질 규제 대응 전담" },
        { name: "패키징·테스트 산업공학", target: "Chongqing", plan: "후공정/테스트 증설 가능성만 검토하고 전공정 선단 recipe 직무와 분리" },
      ],
      channels: ["EHS 전문 채용", "전력·수처리 협력사 인력 풀", "지방정부/보세구 인허가 전문가", "패키징 테스트 경력 채용"],
      gates: [
        { axis: "선행조건", status: "확인필요", title: "토지·용수·전력 숫자 확인 전 채용 제한", evidence: "Wuxi K7 EIA와 C2F 근거는 있으나 추가 신규 fab의 전력 수전·남은 부지·용수 배정 숫자는 공개 확인이 부족합니다.", implication: "확장형 생산 인력 채용은 숫자 확인 후 단계적으로 열어야 합니다.", source: "Wuxi EIA", sourceUrl: "https://www.wnd.gov.cn/doc/2017/02/28/2386281.shtml" },
        { axis: "규제", status: "X", title: "BIS 승인 없는 캐파 확대·기술 업그레이드 인력 투입 금지", evidence: "BIS는 기존 운영 라이선스와 중국 내 캐파 확대/기술 업그레이드를 분리했습니다.", implication: "인프라가 가능해도 규제 승인 전 선단 공정 인력 채용은 No-Go입니다.", source: "BIS", sourceUrl: "https://www.bis.gov/press-release/department-commerce-closes-export-controls-loophole-foreign-owned-semiconductor-fabs-china" },
        { axis: "허용범위", status: "O", title: "EHS·facility 검증 인력은 선제 확보 가능", evidence: "공개 EIA와 보세구 자료는 환경·물류·유틸리티 검증 필요성을 보여줍니다.", implication: "확장 여부와 무관하게 시설 안정성과 규제 대응 인력은 확보 가치가 있습니다.", source: "Wuxi Government", sourceUrl: "https://en.wuxi.gov.cn/2025-07/31/c_1113622.htm" },
      ],
      actions: ["전력·용수·폐수 숫자를 채용 승인 게이트로 설정", "facility/EHS 인력은 option pool로 확보", "패키징 인력과 전공정 선단 인력을 별도 승인 체계로 분리"],
    },
    {
      id: "defense",
      label: "리스크 방어",
      en: "Defense",
      subtitle: "IP · retention · compliance",
      accentCategory: "geopolitics",
      verdict: "O / 방어 우선",
      status: "OK",
      direction: "중국 메모리 경쟁이 인재·IP·수율 recipe 축으로 이동할수록 신규 채용보다 핵심 인력 리텐션, 퇴직자 관리, 접근권 통제, 공개 채용 신호 분석 인력이 더 중요합니다.",
      decision: "중국 인력 전략은 확보와 방어를 동시에 보되, 기술 유출 가능성이 있는 직무는 보상·보안·법무 예산을 먼저 배정합니다.",
      keywords: ["talent", "ip", "yield", "retention", "compliance", "trade secret", "engineer", "boss zhipin", "liepin", "maimai", "cnipa"],
      roles: [
        { name: "핵심 인력 리텐션", target: "Korea / China interface", plan: "수율·패키징·펌웨어 핵심 인력의 보상, 경력경로, 이직 위험 신호를 월별 관리" },
        { name: "IP·보안·법무", target: "HQ / China subsidiaries", plan: "퇴직자 자료반출, 접근권, 협력사 계정, 로컬 채용 접촉 로그를 통합" },
        { name: "공개 채용 인텔리전스", target: "China public sources", plan: "Boss Zhipin/Liepin/Maimai, 대학 취업센터, 특허 키워드 수집" },
      ],
      channels: ["리텐션 패키지", "법무·보안 전담 채용", "공개 채용/특허 크롤링", "대학·산학 신호 모니터링"],
      gates: [
        { axis: "방어 투자", status: "O", title: "핵심 수율 인력 리텐션 예산 선집행", evidence: "중국 Talent/IP 레이더는 수율·TSV·Xtacking·캠퍼스 채용 신호를 매일 추적합니다.", implication: "핵심 인력 방어는 비용이 아니라 HBM·DRAM·NAND 수율 자산 보호 옵션입니다.", source: "Talent radar", sourceUrl: "https://dicacros-gif.github.io/memory/" },
        { axis: "공개정보 수집", status: "O", title: "채용 공고·특허·전문매체 기반 조기경보", evidence: "공개 채용과 특허 키워드는 경쟁사의 개발 방향을 합법적으로 추정할 수 있는 선행 신호입니다.", implication: "비공개 정보 없이도 TSV, yield, HBM, Xtacking JD 증가를 경보 지표로 쓸 수 있습니다.", source: "Crawler methodology", sourceUrl: "https://dicacros-gif.github.io/memory/data/live.json" },
        { axis: "금지선", status: "X", title: "인력 확보를 통한 영업비밀 이전 금지", evidence: "채용은 역량 확보가 목적이며 경쟁사 영업비밀·고객 NDA·recipe 이전은 허용하지 않습니다.", implication: "면접·온보딩 단계에서 비공개 자료 반입 금지와 IP 클린룸 원칙을 명시합니다.", source: "Compliance rule", sourceUrl: "https://www.skhynix.com/company/UI-FR-CP06/" },
      ],
      actions: ["핵심 인력 리텐션 스코어를 경영진 탭과 연결", "퇴직자·협력사 접근권 회수를 자동 체크리스트화", "중국 공개 채용 키워드를 주간 경보로 요약"],
    },
  ];
  const CHINA_TALENT_STRATEGY_INVESTMENTS = {
    operate: [
      {
        id: "ops-continuity",
        label: "운영 연속성 인력 풀",
        type: "운영 안정",
        investment: "Wuxi/Dalian/Chongqing 운영·EHS·facility 상시 채용 풀",
        monetization: "가동 중단·품질비용·긴급 외주비를 낮추는 방어형 수익성",
        costIndex: 34,
        payoffIndex: 62,
        riskIndex: 24,
        horizon: "6~12M",
        kpis: ["vacancy coverage", "EHS incident", "utility downtime"],
      },
      {
        id: "quality-response",
        label: "중국 고객 품질 대응",
        type: "고객 방어",
        investment: "FA, reliability, customer quality, logistics 운영 인력 보강",
        monetization: "RMA 대응 속도와 고객 유지율을 높여 가격 협상력 훼손을 방어",
        costIndex: 28,
        payoffIndex: 58,
        riskIndex: 22,
        horizon: "3~9M",
        kpis: ["RMA lead time", "customer issue closure", "on-time delivery"],
      },
    ],
    "nand-essd": [
      {
        id: "essd-fae",
        label: "eSSD FAE·검증 조직",
        type: "매출 방어",
        investment: "중국 서버 고객 qualification, RMA, FAE, validation 전담 인력",
        monetization: "YMTC eSSD 침투에 맞서 Solidigm/eSSD 고객 이탈을 막는 방어 수익",
        costIndex: 46,
        payoffIndex: 75,
        riskIndex: 38,
        horizon: "6~18M",
        kpis: ["qualification win", "RMA closure", "eSSD contract defense"],
      },
      {
        id: "firmware-cleanroom",
        label: "펌웨어 검증 클린룸",
        type: "IP 통제",
        investment: "현지 검증 인력과 핵심 펌웨어 소스 접근권을 분리한 클린룸 운영",
        monetization: "품질 검증 속도를 높이면서 IP 유출 리스크와 재작업 비용을 낮춤",
        costIndex: 42,
        payoffIndex: 70,
        riskIndex: 34,
        horizon: "9~18M",
        kpis: ["firmware defect escape", "access exception", "validation cycle"],
      },
      {
        id: "nand-market-intel",
        label: "NAND 고객·가격 인텔리전스",
        type: "가격 방어",
        investment: "YMTC/eSSD 조달, NAND 계약가, 내수 보조금 신호 분석 인력",
        monetization: "가격 하락 신호를 조기에 반영해 저수익 SKU와 고객 믹스를 조정",
        costIndex: 22,
        payoffIndex: 54,
        riskIndex: 18,
        horizon: "1~6M",
        kpis: ["price alert lead time", "customer signal count", "SKU pruning"],
      },
    ],
    "infra-packaging": [
      {
        id: "utility-ehs-option",
        label: "유틸리티·EHS 옵션 풀",
        type: "증설 옵션",
        investment: "전력·용수·폐수·환경 인허가 전문가를 option pool로 확보",
        monetization: "확장 승인 전 숫자 검증을 앞당겨 잘못된 CAPEX 집행을 방지",
        costIndex: 38,
        payoffIndex: 63,
        riskIndex: 32,
        horizon: "3~12M",
        kpis: ["power quota evidence", "water permit evidence", "EIA readiness"],
      },
      {
        id: "packaging-ie",
        label: "패키징·테스트 산업공학",
        type: "후공정 생산성",
        investment: "Chongqing 후공정/테스트 IE, yield ramp, bottleneck 분석 인력",
        monetization: "후공정 병목과 테스트 cycle time을 줄여 패키징 수익성을 방어",
        costIndex: 48,
        payoffIndex: 68,
        riskIndex: 41,
        horizon: "9~24M",
        kpis: ["test cycle time", "backend yield", "bottleneck removal"],
      },
      {
        id: "permit-readiness",
        label: "인허가 준비 태스크포스",
        type: "규제 리스크",
        investment: "Wuxi 보세구, EIA, BIS 분류, 지방정부 대응 전담",
        monetization: "No-Go 투자를 초기에 차단하고 승인 가능한 운영 유지 투자만 선별",
        costIndex: 25,
        payoffIndex: 56,
        riskIndex: 26,
        horizon: "1~9M",
        kpis: ["permit gap list", "BIS classification", "decision lead time"],
      },
    ],
    defense: [
      {
        id: "retention-shield",
        label: "핵심 인력 리텐션 실드",
        type: "수율 자산 보호",
        investment: "수율·TSV·패키징·펌웨어 핵심 인력 보상과 이직 위험 관리",
        monetization: "수율 노하우 유출을 줄여 HBM/DRAM/NAND 양산 안정성을 방어",
        costIndex: 52,
        payoffIndex: 82,
        riskIndex: 28,
        horizon: "6~24M",
        kpis: ["critical attrition", "retention coverage", "yield recipe access"],
      },
      {
        id: "ip-compliance-automation",
        label: "IP·접근권 자동 통제",
        type: "법무·보안",
        investment: "퇴직자 자료반출, 협력사 계정, 현지 접근권 회수 자동화",
        monetization: "유출·소송·규제 위반의 꼬리 리스크를 낮추는 보험형 ROI",
        costIndex: 36,
        payoffIndex: 74,
        riskIndex: 20,
        horizon: "3~12M",
        kpis: ["access revocation SLA", "exfiltration alert", "audit closure"],
      },
      {
        id: "hiring-intel-crawler",
        label: "채용·특허 조기경보",
        type: "인텔리전스",
        investment: "로컬 채용, 대학, 특허 키워드 크롤링 강화",
        monetization: "경쟁사의 기술 방향을 빠르게 포착해 방어 투자 타이밍을 앞당김",
        costIndex: 18,
        payoffIndex: 60,
        riskIndex: 16,
        horizon: "1~6M",
        kpis: ["keyword drift", "signal freshness", "alert precision"],
      },
    ],
  };
  const CEO_CHALLENGES = [
    {
      id: "evidence-quality",
      label: "근거가 부족한데 왜 실행하나?",
      angle: "Evidence",
      question: "현재 크롤링 데이터가 충분하지 않은데 이 투자 판단을 CEO가 승인해야 하는 이유는 무엇인가?",
    },
    {
      id: "roi-credibility",
      label: "ROI 지수를 믿을 수 있나?",
      angle: "ROI",
      question: "ROI 지수가 실제 재무수익률이 아니라면 의사결정 지표로 쓸 수 있는가?",
    },
    {
      id: "budget-cut",
      label: "예산을 줄이면 무엇을 남기나?",
      angle: "Capital",
      question: "예산이 절반으로 줄면 어떤 투자만 남기고 무엇을 보류해야 하는가?",
    },
    {
      id: "no-go",
      label: "X 게이트가 있으면 중단 아닌가?",
      angle: "Gate",
      question: "No-Go 항목이 있는데 왜 시나리오 전체를 폐기하지 않는가?",
    },
    {
      id: "ip-risk",
      label: "채용이 IP 유출을 키우지 않나?",
      angle: "IP",
      question: "중국 인력 확보가 오히려 핵심 recipe와 영업비밀 유출 리스크를 키우는 것 아닌가?",
    },
    {
      id: "outsourcing",
      label: "외주로 해결하면 안 되나?",
      angle: "Operating model",
      question: "직접 채용보다 협력사·외주로 처리하는 편이 비용 효율적이지 않은가?",
    },
    {
      id: "bis-shock",
      label: "BIS 규제가 더 강해지면?",
      angle: "Policy shock",
      question: "미국 수출통제가 강화되면 이 인력 투자 계획은 어떻게 바뀌어야 하는가?",
    },
    {
      id: "china-zero",
      label: "중국 전용 신호가 0건이면?",
      angle: "Data gap",
      question: "China Talent Strategy 전용 RSS가 0건이면 이 보드를 신뢰해도 되는가?",
    },
    {
      id: "kpi-reversal",
      label: "어떤 KPI면 결정을 뒤집나?",
      angle: "Kill switch",
      question: "어떤 숫자가 나오면 투자 확대 결정을 중단하거나 반대로 확대해야 하는가?",
    },
    {
      id: "strategic-fit",
      label: "SKHY 전략과 무슨 관련인가?",
      angle: "Strategic fit",
      question: "이 인력 투자가 HBM, NAND/eSSD, 중국 법인 운영, 리스크 방어와 어떻게 연결되는가?",
    },
  ];
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
      keywords: ["talent", "hiring", "engineer", "ip", "yield", "tsv", "hybrid bonding", "xtacking", "campus recruiting", "tsinghua", "boss zhipin", "recruitment"],
      pulse: "로컬 JD·대학 파이프라인·전문 매체/IP 신호로 수율 엔지니어 이동과 공정 노하우 유출 가능성을 조기 감지",
      watch: ["TSV/HBM JD 증가", "CXMT/YMTC 공개 채용 신호", "칭화대 캠퍼스 리크루팅", "수율 엔지니어 이동", "IP 분쟁"],
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
        { label: "현재 캐파", value: "~200k wpm" },
        { label: "Phase 3", value: "+50k→100k" },
        { label: "공식 밀도", value: "12.66Gb/mm²" },
        { label: "제품 축", value: "eSSD" },
      ],
      strategy: [
        "Xtacking으로 셀 어레이와 로직 웨이퍼를 분리해 미세화 제약을 우회하되 공식 측정값과 추정치를 분리",
        "중국 서버·스마트폰 고객을 묶어 eSSD와 고용량 NAND 내수 수요를 흡수",
        "우한 Phase 3와 추가 팹 계획은 NAND 캐파뿐 아니라 일부 DRAM 병행 생산 가능성까지 포함해 자급형 IDM 전환 신호로 추적",
      ],
      crawl: ["YMTC Xtacking 4.0", "enterprise SSD customer", "Wuhan Phase 3", "domestic NAND equipment", "additional Wuhan fabs", "DRAM samples"],
      decisions: ["NAND contract price 하방 압력", "Solidigm/eSSD 고객 방어", "Xtacking 세대별 밀도·수율 검증", "국산 장비 qual 속도", "DRAM 병행 생산 가능성"],
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
      score: 82,
      linkedCategories: ["dram", "nand", "china"],
      keywords: ["cxmt", "changxin", "dram", "ddr5", "lpddr5x", "ipo", "capacity"],
      metrics: [
        { label: "매출", value: "~$8B" },
        { label: "캐파", value: "290k wpm" },
        { label: "DRAM 점유", value: "~8%" },
        { label: "가격", value: "15%+↓" },
      ],
      strategy: [
        "2025년 매출과 월 DRAM wafer 캐파가 급증하며 DDR5·LPDDR 물량 기반의 가격 협상력을 확대",
        "NAND 직접 경쟁사는 아니지만 메모리 업황 전반의 ASP와 고객 협상력을 흔듦",
        "HBM 위협보다 레거시 DRAM 가격 하방, IPO 자금의 생산라인 업그레이드, 중국 고객 장기계약이 우선 감시 대상",
      ],
      crawl: ["CXMT IPO capacity", "CXMT DDR5 customer", "China DRAM contract", "Tencent supply agreement", "CXMT wafer capacity 290000"],
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
      tone: "HBM4 ramp·패키징 병목, 중국 캐파 확대, 범용 DRAM/NAND 가격 하방을 크게 반영한 방어 케이스",
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
      thesis: "AI 서버는 30개월 뒤에도 SKHY 제품 믹스의 최우선 축입니다. HBM4 베이스 다이, DDR5 고용량 모듈, CXL 확장 메모리가 함께 서버 ASP를 방어합니다.",
      assumptions: ["HBM4/Custom HBM 고객 인증 유지", "NVIDIA·ASIC 고객의 대역폭 요구 지속", "DDR5 고용량 모듈과 CXL이 서버당 메모리 탑재량 확대"],
      triggers: ["HBM4 Rubin ramp", "CoWoS/패키징 할당량", "DDR5 contract 가격", "CXL 서버 PoC"],
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
      downside: "HBM4 고객별 ramp 지연, CoWoS/패키징 병목, 서버 DRAM 가격 약세가 확인되면 고객별 할당과 수율 리스크를 보수적으로 봅니다.",
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
  const CHINA_BUSINESS_STRATEGY_PILLARS = [
    {
      id: "china-key-account",
      label: "중국 핵심 고객 방어",
      role: "Customer moat",
      businessAxis: "고객/매출",
      allocation: "26%",
      horizon: "0~18개월",
      capital: "장기 공급계약 + 공동 로드맵",
      title: "중국 빅테크·서버 고객을 전략 계정으로 재분류",
      thesis: "중국 고객은 단순 가격 협상 상대가 아니라 YMTC·CXMT 채택 여부를 가장 빨리 보여주는 선행 지표입니다. 서버 DRAM, eSSD, HBM 옵션을 고객별 로드맵으로 묶어 방어해야 합니다.",
      actions: ["중국 빅테크·서버 OEM별 제품군 침투율 추적", "DRAM·eSSD 번들 계약과 가격 방어 조건 설계", "경쟁사 인증 신호 발생 시 72시간 내 계정별 대응안 작성"],
      triggers: ["Tencent DRAM supply", "Huawei AI server", "Alibaba/Baidu capex", "server DDR5", "eSSD tender"],
      linkedCategories: ["china", "aidemand", "dram", "nand"],
      keywords: ["china customer", "tencent", "huawei", "alibaba", "baidu", "lenovo", "server", "ddr5", "essd", "supply contract"],
      baseScore: 86,
    },
    {
      id: "china-nand-essd",
      label: "NAND/eSSD 사업 방어",
      role: "Product defense",
      businessAxis: "제품/가격",
      allocation: "22%",
      horizon: "상시",
      capital: "Solidigm value-up + 고객 락인",
      title: "YMTC의 eSSD·Xtacking 확장을 중국 NAND 사업 방어 KPI로 연결",
      thesis: "YMTC의 기술 진전은 낸드 가격보다 고객 인증에서 먼저 나타납니다. eSSD, QLC, 데이터센터 스토리지와 중국 내수 보조금 신호를 묶어 방어 우선순위를 정해야 합니다.",
      actions: ["중국 eSSD 입찰·고객 인증 신호를 일일 보드 상단에 배치", "Solidigm QLC/eSSD 경쟁력 개선 과제를 가격 추이와 연결", "저마진 소비자 SSD보다 데이터센터 고객 방어를 우선"],
      triggers: ["YMTC eSSD", "Xtacking 4.0", "NAND contract price", "Wuhan Phase 3", "QLC"],
      linkedCategories: ["nand", "china", "packaging"],
      keywords: ["ymtc", "xtacking", "essd", "solidigm", "qlc", "nand", "wuhan", "datacenter ssd"],
      baseScore: 82,
    },
    {
      id: "china-packaging-route",
      label: "패키징 우회로 추적",
      role: "Ecosystem watch",
      businessAxis: "생태계",
      allocation: "17%",
      horizon: "12~36개월",
      capital: "OSAT·테스트·소재 제휴 옵션",
      title: "XMC·JCET의 2.5D/3D 패키징 우회로를 HBM 리스크로 관리",
      thesis: "중국은 EUV 부재를 첨단 패키징으로 우회하려 합니다. XMC, JCET, 인터포저, 테스트, 언더필 신호는 중국 AI 메모리 경쟁력의 실제 속도를 보여줍니다.",
      actions: ["XMC·JCET 투자·장비 반입·고객 인증 기사 자동 태깅", "HBM 베이스 다이와 패키징 수율 신호를 분리 추적", "한국/대만 OSAT 협력 옵션을 경쟁 대응안에 포함"],
      triggers: ["XMC HBM packaging", "JCET XDFOI", "advanced packaging", "interposer", "hybrid bonding"],
      linkedCategories: ["packaging", "hbm", "china", "geopolitics"],
      keywords: ["xmc", "jcet", "xdfoi", "advanced packaging", "hbm packaging", "interposer", "hybrid bonding", "tsv"],
      baseScore: 78,
    },
    {
      id: "china-equipment-localization",
      label: "장비·소재 내재화",
      role: "Supply hedge",
      businessAxis: "공급망",
      allocation: "14%",
      horizon: "18~48개월",
      capital: "대체 조달 + IP 조건부 협력",
      title: "Naura·AMEC·ACM 국산화 속도를 중국 팹 실행력 지표로 사용",
      thesis: "중국 장비 내재화는 단순 소부장 뉴스가 아니라 YMTC·CXMT의 캐파 실현 가능성을 좌우합니다. 수출통제, Big Fund III, 장비 qualify, 소재 recipe 요구를 한 축으로 봐야 합니다.",
      actions: ["Naura·AMEC·ACM 기사와 팹 일정의 동시 발생을 경보화", "한국 소부장 JV 제안은 recipe/IP 이전 조건으로 별도 심사", "BIS·MATCH Act 변화와 장비 반입 신호를 연결"],
      triggers: ["NAURA", "AMEC", "ACM Research", "Big Fund III", "export control", "DUV"],
      linkedCategories: ["equipment", "geopolitics", "china"],
      keywords: ["naura", "amec", "acm", "equipment", "materials", "big fund", "export control", "match act", "duv"],
      baseScore: 76,
    },
    {
      id: "china-ops-regulation",
      label: "중국 운영·규제 리스크",
      role: "Operating risk",
      businessAxis: "운영/규제",
      allocation: "12%",
      horizon: "상시",
      capital: "다롄/Solidigm 운영 시나리오",
      title: "중국 내 운영자산과 BIS/VEU 규제를 사업 연속성 의사결정에 반영",
      thesis: "중국 사업 전략은 경쟁사 벤치마킹만으로 끝나지 않습니다. 다롄 NAND, Solidigm, VEU, 수출통제, 현지 고객 계약을 함께 보며 운영 리스크와 매출 방어를 동시에 판단해야 합니다.",
      actions: ["BIS/VEU 변경을 중국 운영 리스크 배지로 노출", "다롄·Solidigm 관련 기사와 NAND 가격 변동을 같은 타임라인에 배치", "규제 악화 시 고객·생산·재고 전환 시나리오를 즉시 실행"],
      triggers: ["BIS VEU", "Dalian NAND", "Solidigm", "export license", "China operation"],
      linkedCategories: ["geopolitics", "operations", "nand", "china"],
      keywords: ["bis", "veu", "dalian", "solidigm", "export license", "china operation", "regulation"],
      baseScore: 80,
    },
    {
      id: "china-talent-ip",
      label: "인재/IP 조기경보",
      role: "Capability defense",
      businessAxis: "인재/IP",
      allocation: "9%",
      horizon: "즉시",
      capital: "핵심 인력 보상 + 법무/보안",
      title: "중국 채용 공고를 기술 로드맵과 IP 리스크의 선행 신호로 사용",
      thesis: "CXMT와 YMTC의 채용은 향후 공정·패키징·수율 안정화 방향을 보여줍니다. TSV, yield, advanced packaging, DDR5, HBM 키워드가 늘면 기술 격차 축소 속도를 다시 산정해야 합니다.",
      actions: ["CXMT/YMTC 공개 채용 신호와 Boss Zhipin 키워드 빈도 추적", "핵심 수율 인력 보상·접근권·퇴직 모니터링 강화", "채용 급증 신호를 기술 로드맵 리스크와 연결"],
      triggers: ["CXMT hiring", "YMTC recruitment", "Boss Zhipin", "yield engineer", "TSV", "HBM"],
      linkedCategories: ["talent", "dram", "packaging", "geopolitics"],
      keywords: ["hiring", "talent", "yield", "engineer", "boss zhipin", "cxmt", "ymtc recruitment", "tsv", "hbm"],
      baseScore: 84,
    },
  ];
  const CHINA_BUSINESS_DECISIONS = [
    {
      id: "china-key-account-lock",
      label: "핵심 고객 락인",
      option: "장기계약 / 공동개발",
      stage: "Go",
      capital: "우선 집행",
      title: "중국 핵심 고객별 DRAM·eSSD 방어 패키지를 결정",
      logic: "중국 고객이 CXMT·YMTC를 테스트하는 신호가 나오면 가격 대응만으로는 부족합니다. 제품 번들, 인증 지원, 공급 안정성, 장기 물량 조건을 함께 제시해야 합니다.",
      gate: ["경쟁사 인증 신호", "고객별 물량 기여도", "가격 spread", "내수 보조금 영향"],
      action: "계정별 방어안과 승인 가능한 가격/물량 조건을 경영진 안건으로 상정",
      linkedStrategy: "china-key-account",
      linkedCategories: ["china", "aidemand", "dram", "nand"],
      keywords: ["china customer", "tencent", "huawei", "alibaba", "baidu", "server", "supply contract"],
      baseScore: 86,
    },
    {
      id: "china-essd-defense",
      label: "eSSD 방어 투자",
      option: "제품 믹스 / 고객 계약",
      stage: "Defend",
      capital: "선택 집행",
      title: "YMTC 확장에 맞서 Solidigm·QLC·eSSD 사업 방어를 결정",
      logic: "NAND 가격 하락보다 위험한 신호는 중국 데이터센터 고객 인증입니다. 고객 방어와 제품 믹스 개선을 투자 안건으로 묶어야 합니다.",
      gate: ["YMTC eSSD 인증", "NAND contract 가격", "QLC 원가 경쟁력", "중국 서버 수요"],
      action: "핵심 고객 장기계약, Solidigm value-up, 저수익 SKU 축소를 동시에 실행",
      linkedStrategy: "china-nand-essd",
      linkedCategories: ["nand", "china"],
      keywords: ["ymtc", "essd", "solidigm", "qlc", "nand contract", "datacenter ssd"],
      baseScore: 82,
    },
    {
      id: "china-packaging-hedge",
      label: "패키징 대응 옵션",
      option: "제휴 / 소수지분 / 공급권",
      stage: "Watch",
      capital: "조건부 집행",
      title: "XMC·JCET 패키징 우회로에 대응할 OSAT·테스트 옵션을 확보",
      logic: "중국이 선단 공정 제약을 패키징으로 우회하면 HBM 위협은 다이 수율보다 후공정에서 빨라질 수 있습니다. 옵션 확보가 늦으면 대응 비용이 커집니다.",
      gate: ["XMC 설비 반입", "JCET XDFOI 수주", "HBM TSV 키워드", "고객 샘플 출하"],
      action: "OSAT·테스트·소재 파트너 후보를 후속투자권 중심으로 구조화",
      linkedStrategy: "china-packaging-route",
      linkedCategories: ["packaging", "hbm", "china"],
      keywords: ["xmc", "jcet", "advanced packaging", "hbm packaging", "interposer", "tsv"],
      baseScore: 78,
    },
    {
      id: "china-equipment-ip-gate",
      label: "소부장 협력 게이트",
      option: "JV 조건부 / IP 방어",
      stage: "Watch",
      capital: "리스크 심사",
      title: "중국 장비·소재 협력 제안은 IP 이전 조건으로 사전 게이트를 통과",
      logic: "장비·소재 협력은 공급망 헤지일 수 있지만 recipe와 공정 데이터 유출 통로가 될 수 있습니다. JV·공동 R&D 조건을 표준화해야 합니다.",
      gate: ["recipe 이전 요구", "중국 정부펀드 참여", "대체 공급 필요성", "수출통제 예외 가능성"],
      action: "IP 금지선, 데이터 접근권, 공급권 범위를 표준 텀시트로 관리",
      linkedStrategy: "china-equipment-localization",
      linkedCategories: ["equipment", "geopolitics", "talent"],
      keywords: ["equipment", "materials", "joint venture", "recipe", "ip", "big fund", "export control"],
      baseScore: 76,
    },
    {
      id: "china-operation-scenario",
      label: "운영 시나리오 전환",
      option: "생산/재고/고객 전환",
      stage: "Go",
      capital: "운영 의사결정",
      title: "BIS/VEU와 다롄·Solidigm 리스크에 맞춰 사업 연속성 옵션을 결정",
      logic: "중국 내 운영자산과 수출통제 변화는 가격보다 빠르게 공급 가능 물량을 바꿀 수 있습니다. 규제 시나리오별 생산·재고·고객 전환안이 필요합니다.",
      gate: ["BIS/VEU 변경", "라이선스 갱신", "중국 내 고객 계약", "NAND 가격 급변"],
      action: "규제 악화 시 대체 생산, 재고 배분, 고객 우선순위 전환안을 실행",
      linkedStrategy: "china-ops-regulation",
      linkedCategories: ["geopolitics", "operations", "nand"],
      keywords: ["bis", "veu", "dalian", "solidigm", "export license", "operation"],
      baseScore: 80,
    },
    {
      id: "china-talent-retention",
      label: "핵심 인재 방어",
      option: "보상 / 법무 / 보안",
      stage: "Go",
      capital: "즉시 집행",
      title: "수율·패키징 핵심 인력과 공정 데이터를 중국 사업 리스크로 관리",
      logic: "중국 업체의 채용 신호가 강해질수록 장비 제약을 뛰어넘는 기술 이전 리스크가 커집니다. 보상과 접근권 관리가 동시에 필요합니다.",
      gate: ["Yield 채용 급증", "TSV/HBM JD 증가", "퇴직자 접근권", "IP 소송/수사"],
      action: "핵심 인력 보상, 접근권 재점검, 채용 플랫폼 크롤링 경보를 집행",
      linkedStrategy: "china-talent-ip",
      linkedCategories: ["talent", "dram", "packaging"],
      keywords: ["hiring", "yield", "boss zhipin", "ip", "engineer", "tsv", "hbm"],
      baseScore: 84,
    },
    {
      id: "china-legacy-capex",
      label: "레거시 CAPEX 보수화",
      option: "보류 / 원가 방어",
      stage: "Hold",
      capital: "CAPEX 억제",
      title: "CXMT·YMTC 물량 공세 국면에서는 범용 증설보다 원가 방어를 우선",
      logic: "중국 캐파가 DDR4, eTT, 소비자 SSD 가격을 흔들 때 증설은 리스크를 키울 수 있습니다. 가격 하방 방어와 재고 회전이 우선입니다.",
      gate: ["DDR4/eTT spot", "contract spread", "CXMT 캐파", "YMTC wafer 가격"],
      action: "저수익 SKU 축소, 재고 회전, cash-cost floor 경보를 중심으로 운영",
      linkedStrategy: "china-nand-essd",
      linkedCategories: ["dram", "nand", "china"],
      keywords: ["ddr4", "ett", "legacy", "spot", "contract", "cxmt", "ymtc", "oversupply"],
      baseScore: 70,
    },
  ];
  const CHINA_DEEP_DIVE = [
    {
      id: "dram-euv-duv",
      tag: "DRAM 공정",
      title: "CXMT DDR5 수율 80%+와 HBM3 지연",
      thesis: "CXMT는 DDR5 수율 80%+ 구간을 넘기며 범용 DRAM 위협을 현실화했지만, HBM3는 소재·패키징·수율 병목으로 2026년 H1 목표가 철회되고 2027년 의미 있는 물량을 보는 구도입니다",
      facts: ["DDR5 수율 80%+는 2025 Citigroup·2026 SemiAnalysis 모델 기준 Confirmed", "CXMT 공식 노드: DDR5-4800 17nm, TechInsights 16nm는 역분석 추정", "HBM3 H1 2026 목표 철회, 2027년 12-layer HBM3가 현실적 목표"],
      risk: "DUV 반복 노광은 공정 스텝·마스크 비용·변동성을 키웁니다. 단기 HBM 위협보다 DDR5·LPDDR·레거시 DRAM 가격 하방 압력이 더 빠르게 나타날 가능성이 큽니다",
      implication: "HBM 격차는 3년+로 좁혀진 상태로 보고, CXMT의 즉시 위협은 IPO 자금·Tencent 장기계약·DDR5 점유율 상승이 만드는 범용 DRAM 가격 협상력 약화입니다",
      linkedCategories: ["dram", "packaging", "equipment"],
      source: "SCMP / CXMT / Reuters",
      sourceUrl: "https://www.scmp.com/tech/tech-war/article/3296794/chinas-top-memory-chip-maker-cxmt-narrows-tech-gap-leaders-samsung-hynix-micron",
    },
    {
      id: "ymtc-xtacking",
      tag: "NAND 구조",
      title: "YMTC Xtacking 4.0 공식값과 추정값 분리",
      thesis: "YMTC는 로직 제어 웨이퍼와 메모리 셀 웨이퍼를 분리 가공한 뒤 하이브리드 본딩하는 Xtacking 4.0으로 기존 NAND 구조를 우회하지만, 공식 측정 밀도와 추정 밀도는 분리해서 봐야 합니다",
      facts: ["NAND 점유율 2025년 1분기 8% → 2026년 1분기 13%", "TechInsights Gen5 512Gb TLC 공식 밀도 12.66Gb/mm²", "~20.5Gb/mm²는 1Tb/294L(2yyL) 추정치로 별도 Watch"],
      risk: "셀 밀도, 단수, 수율 안정화는 서로 다른 지표입니다. 수율 안정화는 별도 검증 없이 확정 표현하지 않습니다",
      implication: "SKHY는 NAND 가격뿐 아니라 eSSD·데이터센터 고객 확대, 공식 밀도, 추정 밀도, 우한 Phase 3 램프를 분리 추적해야 합니다",
      linkedCategories: ["nand", "packaging"],
      source: "TechInsights",
      sourceUrl: "https://www.techinsights.com/blog/ymtc-xtacking40-breaking-new-ground-3d-nand-technology",
    },
    {
      id: "wuhan-phase3",
      tag: "우한 3공장",
      title: "YMTC 우한 Phase 3와 D램 병행 생산",
      thesis: "미국 제재 이후 YMTC는 우한 3공장에 국산 장비를 대거 투입하고, 일부 캐파를 D램과 TSV 패키징 준비로 돌리며 종합 메모리 기업화를 시도합니다",
      facts: ["기존 Line 1 약 100,000 wpm + Line 2 약 60,000 wpm = 합산 약 160,000 wpm", "우한 Phase 3는 2026년 하반기 가동, 2027년 50,000 wpm 도달 보도", "추가 2개 팹까지 포함하면 장기 캐파 두 배 이상 확대 가능"],
      risk: "국산 장비 qual과 공정 recipe 안정화가 지연되면 NAND·D램 동시 확장 전략은 수율 병목에 부딪힐 수 있습니다",
      implication: "YMTC는 단순 NAND 경쟁사가 아니라 NAND·D램·TSV 적층을 묶는 중국형 IDM 후보로 추적해야 합니다",
      linkedCategories: ["nand", "dram", "equipment", "packaging"],
      source: "Reuters via Evertiq / public capacity reports",
      sourceUrl: "https://evertiq.com/design/2026-04-14-ymtc-plans-new-fabs-to-boost-capacity-amid-rising-us-china-tensions",
    },
    {
      id: "advanced-packaging",
      tag: "첨단 패키징",
      title: "JCET·XMC의 패키징 우회로",
      thesis: "중국은 7nm 이하 선단 공정 제약을 2.5D/3D 이종 집적과 하이브리드 본딩 기반 첨단 패키징으로 우회하려 합니다",
      facts: ["JCET 2025년 첨단 패키징 매출 270억 위안 확인", "XMC 월 3,000장 HBM 패키징 장비 보도", "XMC 2,600억 위안 투자 수치는 검증 미완료"],
      risk: "CXMT·YMTC 베이스 다이를 XMC가 고대역폭 패키징으로 묶는 구조가 자리 잡을 수 있지만, 투자 규모 수치는 확인/미확인을 분리해야 합니다",
      implication: "SKHY는 HBM 다이 경쟁뿐 아니라 OSAT·인터포저·언더필·테스트 병목을 함께 보는 패키징 레이더가 필요합니다",
      linkedCategories: ["packaging", "hbm", "geopolitics"],
    },
    {
      id: "big-fund-equipment",
      tag: "소부장",
      title: "빅펀드 3기와 장비·소재 국산화",
      thesis: "빅펀드 3기는 단순 팹 증설보다 EUV·EDA·첨단 화학 소재 같은 초크포인트에 자본을 집중하고 있습니다",
      facts: ["빅펀드 3기 3,440억 위안·약 $47.5B", "Yole 기준 장비 국산화율 2025년 23.2%", "ACM Research 2025 매출 $901M, Q1 2026 매출 $231.3M, Entity List/미국 부품 조달 리스크"],
      risk: "집계 기준에 따라 국산화율 수치가 달라집니다. AMEC 식각, Naura 종합장비, ACM 세정이 서방 장비를 대체하지만 Entity List와 미국 원산 부품 조달 리스크가 장비 ramp의 새로운 병목입니다",
      implication: "한국 소부장 파트너의 JV 제안, 소재 recipe 이전, 중국 내수 우선 공급권 요구를 조기 탐지해야 합니다",
      linkedCategories: ["equipment", "geopolitics", "talent"],
      source: "Reuters / ACM Research / StockTitan",
      sourceUrl: "https://www.stocktitan.net/news/ACMR/acm-research-reports-first-quarter-2026-3bbkh6alnsih.html",
    },
    {
      id: "match-act",
      tag: "규제 리스크",
      title: "MATCH Act: DUV 제한 유지, 극저온 식각 전국 금지 삭제",
      thesis: "MATCH Act는 아직 법률로 확정되지 않은 의회 법안입니다. 2026년 4월 16일 수정으로 극저온 식각 장비의 전국적 blanket ban은 삭제됐고, DUV 리소그래피 제한과 동맹국 정렬 요구는 유지됩니다",
      facts: ["Cryogenic etch blanket ban removed, Reuters 2026-04-16", "DUV restriction retained", "HR 8170은 2026-04-22 하원 외교위 36:8 통과, S.4281은 2026-04-13 Senate Banking Committee 회부"],
      risk: "법률 확정 전에는 실행 규제로 오인하면 안 됩니다. 다만 통과 시 CXMT·YMTC·SMIC 장비 교체와 우회 조달 타임라인을 늦출 수 있습니다",
      implication: "대시보드는 MATCH Act를 현행 규제가 아니라 정책 Watch로 표시하고, BIS/VEU·네덜란드·일본 동참 여부와 함께 YMTC Phase 3 이후 팹 일정에 연결합니다",
      linkedCategories: ["geopolitics", "equipment", "china"],
      source: "Reuters / Congress trackers",
      sourceUrl: "https://finance.yahoo.com/sectors/technology/articles/us-lawmakers-amend-restrictions-chinese-180025088.html",
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
      implication: "SKHY는 중국 내수 가격·캐파 신호와 비중국 프리미엄 고객 락인을 동시에 관리해야 합니다",
      linkedCategories: ["geopolitics", "china", "dram", "nand"],
    },
    {
      id: "skhynix-response",
      tag: "대응 전략",
      title: "SKHY 대응 축",
      thesis: "중국은 HBM4 최선단보다 레거시 DRAM·NAND와 패키징 우회로에서 비대칭 위협을 먼저 만들 가능성이 큽니다",
      facts: ["HBM·PIM 초격차 유지", "레거시 D램 원가 방어", "중국 로컬 마이크로데이터 조기경보"],
      risk: "글로벌 세트 업체의 가격 협상력과 중국 보조금 물량이 결합하면 범용 메모리 단가가 급격히 흔들릴 수 있습니다",
      implication: "핵심 고객 연대, 범용 제품 cash-cost floor, Xueqiu·Boss Zhipin·특허·채용 신호 크롤링, 핵심 인력 방어가 함께 필요합니다",
      linkedCategories: ["dram", "nand", "talent", "geopolitics"],
    },
  ];
  const WORKBENCH_MODES = [
    {
      id: "executive",
      label: "경영진 의사결정",
      sub: "Decision · Backtest",
      section: "executive-decision",
    },
    {
      id: "strategy-formulation",
      label: "중국 경영전략 수립",
      sub: "Customer · NAND · Risk",
      section: "management-strategy",
    },
    {
      id: "investment-decision",
      label: "중국 전략적 의사 결정",
      sub: "Contract · JV · Defense",
      section: "strategic-investment-decision",
    },
    {
      id: "startup-radar",
      label: "스타트업 투자 후보",
      sub: "CXL · Photonics · PIM",
      section: "workbench",
    },
    {
      id: "policy-makers",
      label: "Policy Maker",
      sub: "China · Korea · US",
      section: "policy-makers",
    },
    {
      id: "china-fab-infra",
      label: "중국 Fab 인프라",
      sub: "Land · Water · Power",
      section: "china-fab-infra",
    },
    {
      id: "china-talent-strategy",
      label: "중국 인력 전략",
      sub: "Scenario · Hiring · IP",
      section: "china-talent-strategy",
    },
    {
      id: "dynamics",
      label: "중국 다이내믹스",
      sub: "캐파 · 장비 · 패키징",
      section: "china-dynamics",
    },
    {
      id: "market-map",
      label: "경쟁·돈의 흐름",
      sub: "Dynamics · Money Flow",
      section: "memory-market-map",
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
      id: "response",
      label: "대응 액션",
      sub: "P0/P1 execution",
      section: "response",
    },
  ];
  const MECE_GROUPS = [
    {
      id: "home",
      label: "홈",
      desc: "일일 인텔리전스",
      cadence: "Daily crawler",
      jump: "overview",
      sections: ["overview"],
    },
    {
      id: "analysis",
      label: "전략·백테스트",
      desc: "백테스트, 경영전략, 제품군 프로젝션, ROI 시나리오",
      cadence: "Decision lab",
      jump: "executive-decision",
      sections: ["executive-decision", "management-strategy", "strategic-investment-decision", "numbers", "projection"],
    },
    {
      id: "market",
      label: "시장",
      desc: "가격·수급 변화와 기사 흐름",
      cadence: "Market data",
      jump: "prices",
      sections: ["prices", "news"],
    },
    {
      id: "competitors",
      label: "경쟁사",
      desc: "CXMT, YMTC, XMC, JCET, Naura, AMEC의 기술·캐파·공급망 변화",
      cadence: "China benchmark",
      jump: "china-nand",
      sections: ["china-nand", "china-dynamics", "ai-matrix", "china-deep-dive"],
    },
    {
      id: "policy",
      label: "정책/Fab",
      desc: "중국·한국·미국 정책 방향, CHIPS/BIS, 중국 Fab 인프라 판단",
      cadence: "Policy watch",
      jump: "policy-makers",
      sections: ["policy-makers", "china-fab-infra"],
    },
    {
      id: "talent",
      label: "인재/IP",
      desc: "채용 공고, 대학 파이프라인, 수율 인력, IP 리스크 조기경보",
      cadence: "Hiring watch",
      jump: "talent-radar",
      sections: ["talent-radar", "china-talent-strategy"],
    },
  ];
  const IA_ROUTES = MECE_GROUPS;
  const SIDE_NAV_ROUTES = [
    ...MECE_GROUPS.filter((route) => route.id === "home"),
    {
      id: "c-level",
      label: "경영진 의사결정",
      desc: "C-level 전략 보드, 의사결정 안건",
      cadence: "C-level cockpit",
      jump: "c-level-cockpit",
      sections: ["c-level-cockpit"],
    },
    {
      id: "workbench",
      label: "분석실",
      desc: "워크벤치, 정량 분석, 에이전트 토론",
      cadence: "Decision lab",
      jump: "workbench",
      sections: ["workbench"],
    },
    {
      id: "market-map",
      label: "경쟁·돈흐름",
      desc: "Competitive Dynamics, Money Flow",
      cadence: "Dynamics",
      jump: "memory-market-map",
      sections: ["memory-market-map"],
    },
    ...MECE_GROUPS.filter((route) => ["analysis", "market", "policy", "competitors", "talent"].includes(route.id)),
  ];
  const ROUTE_DISPLAY = {
    home: {
      label: "홈",
      desc: "일일 인텔리전스",
      cadence: "Daily",
    },
    "c-level": {
      label: "경영진",
      desc: "C-level 전략 보드, 의사결정 안건",
      cadence: "C-level",
    },
    workbench: {
      label: "분석실",
      desc: "워크벤치, 정량 분석, 에이전트 토론, 시나리오 비교",
      cadence: "Decision lab",
    },
    "market-map": {
      label: "경쟁·돈흐름",
      desc: "경쟁, 파트너십, 투자, 공급, 매출 흐름",
      cadence: "Dynamics",
    },
    analysis: {
      label: "전략·백테스트",
      desc: "백테스트, 경영전략, 제품군 프로젝션, ROI 시나리오",
      cadence: "Decision lab",
    },
    market: {
      label: "시장",
      desc: "Spot/Contract 가격, 영어권·중국어 기사, 수급 신호",
      cadence: "Market data",
    },
    competitors: {
      label: "경쟁사",
      desc: "CXMT, YMTC, XMC, JCET, Naura, AMEC 벤치마크",
      cadence: "China benchmark",
    },
    policy: {
      label: "정책/Fab",
      desc: "중국·한국·미국 정책과 중국 Fab 인프라 판단",
      cadence: "Policy watch",
    },
    talent: {
      label: "인재/IP",
      desc: "채용, 대학 파이프라인, 수율 인력, IP 리스크",
      cadence: "Hiring watch",
    },
  };
  const CATEGORY_DISPLAY = {
    all: { label: "전체", en: "All Signals", desc: "수집된 가격·뉴스·벤치마킹 신호 전체" },
    dram: { label: "DRAM · CXMT", en: "DRAM / CXMT", desc: "DDR4·DDR5·LPDDR와 CXMT 가격 하방 압력" },
    nand: { label: "NAND · YMTC", en: "NAND / SSD", desc: "Xtacking, eSSD, YMTC·XMC 공급망 변화" },
    aidemand: { label: "AI 수요 · eSSD", en: "AI Demand", desc: "AI 서버, eSSD, 데이터센터 수요 신호" },
    hbm: { label: "HBM 초격차", en: "HBM Moat", desc: "HBM3E/HBM4, 고객 인증, 베이스 다이·패키징 병목" },
    cxl: { label: "CXL · PIM", en: "CXL / PIM", desc: "Post-HBM, CXL, PIM, 3D DRAM 전환 신호" },
    packaging: { label: "첨단 패키징", en: "Advanced Packaging", desc: "JCET, XMC, 하이브리드 본딩, TSV, 칩렛" },
    equipment: { label: "소부장 · 장비", en: "Equipment / Materials", desc: "Naura, AMEC, ACM과 중국 장비 내재화" },
    geopolitics: { label: "정책 · 규제", en: "Policy / Geopolitics", desc: "BIS, CHIPS, Big Fund, 수출통제 리스크" },
    operations: { label: "SKHY 중국 운영", en: "SKHY China Ops", desc: "Wuxi, Dalian, Solidigm, VEU와 Fab 운영 리스크" },
    talent: { label: "인재 · IP", en: "Talent / IP", desc: "채용, 핵심 수율 인력 이동, IP 방어 신호" },
  };
  const SIDE_NAV_GROUPS = [
    { label: "요약·의사결정", routes: ["home", "c-level", "workbench", "market-map", "analysis"] },
    { label: "시장·정책", routes: ["market", "policy"] },
    { label: "중국·인재", routes: ["competitors", "talent"] },
  ];
  const SIDE_NAV_ICONS = {
    home: "H",
    "c-level": "E",
    workbench: "W",
    "market-map": "F",
    analysis: "A",
    market: "M",
    competitors: "C",
    policy: "P",
    talent: "T",
  };
  const TOPIC_FILTER_GROUPS = [
    { label: "전체", hint: "All", categories: ["all"] },
    { label: "시장·제품", hint: "DRAM·NAND·수요", categories: ["dram", "nand", "aidemand"] },
    { label: "AI·차세대", hint: "HBM·CXL·패키징", categories: ["hbm", "cxl", "packaging"] },
    { label: "중국 공급망", hint: "장비·정책·운영", categories: ["equipment", "geopolitics", "operations"] },
    { label: "인재·IP", hint: "채용·보안", categories: ["talent"] },
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
  ];
  const SECTION_LABELS = {
    overview: "홈",
    "c-level-cockpit": "C-level 전략 보드",
    "executive-decision": "경영진 의사결정",
    "management-strategy": "중국 경영전략 수립",
    "strategic-investment-decision": "중국 전략적 의사 결정",
    "policy-makers": "정책 방향성",
    "china-fab-infra": "중국 Fab 인프라",
    "china-talent-strategy": "중국 인력 전략",
    numbers: "숫자 대시보드",
    projection: "제품군 프로젝션",
    "memory-market-map": "경쟁·돈의 흐름",
    "ai-matrix": "AI 메모리 매트릭스",
    "china-dynamics": "중국 반도체 다이내믹스",
    "china-nand": "중국 NAND 사업 강화",
    "talent-radar": "인재·채용 레이더",
    "china-deep-dive": "중국 심층 벤치마킹",
    workbench: "분석실",
    response: "대응 대시보드",
    categories: "메모리 카테고리",
    news: "중국·외신 기사",
    prices: "TrendForce 가격",
  };
  const SECTION_ORDER = [
    "overview",
    "c-level-cockpit",
    "workbench",
    "memory-market-map",
    "executive-decision",
    "management-strategy",
    "strategic-investment-decision",
    "numbers",
    "projection",
    "prices",
    "news",
    "policy-makers",
    "china-fab-infra",
    "china-nand",
    "china-dynamics",
    "ai-matrix",
    "china-deep-dive",
    "talent-radar",
    "china-talent-strategy",
  ];
  const NAV_SECTION_TARGETS = {
    overview: "overview",
    "c-level-cockpit": "c-level-cockpit",
    workbench: "workbench",
    "memory-market-map": "memory-market-map",
    prices: "prices",
    news: "prices",
    "policy-makers": "policy-makers",
    "china-fab-infra": "policy-makers",
    "china-nand": "china-nand",
    "china-dynamics": "china-nand",
    "ai-matrix": "china-nand",
    "china-deep-dive": "china-nand",
    "talent-radar": "talent-radar",
    "china-talent-strategy": "talent-radar",
    "executive-decision": "executive-decision",
    "management-strategy": "executive-decision",
    "strategic-investment-decision": "executive-decision",
    numbers: "executive-decision",
    projection: "executive-decision",
    response: "executive-decision",
    categories: "china-nand",
  };
  const PRICE_PERIODS = [
    { id: "week", label: "주", days: 7 },
    { id: "quarter", label: "분기", days: 92 },
    { id: "year", label: "1년", days: 365 },
  ];

  let BASE = null;
  let LIVE = emptyLive;
  let HISTORY = emptyHistory;
  let activeCategory = "all";
  let categoryRenderToken = 0;
  let categoryRenderFrame = 0;
  let priceFilter = "all";
  let pricePeriod = "week";
  let priceAsOfDate = "";
  let newsCategory = "all";
  let newsSearch = "";
  let newsCompany = "all";
  let newsSource = "english";
  let workbenchMode = "executive";
  let selectedInsightId = null;
  let memoryMarketMode = "competitive";
  let memoryMarketFocusId = "";
  let memoryMarketEdgeType = "all";
  let memoryMarketNodePositions = {};
  let numberLens = "all";
  let chinaNandFocusId = "ymtc";
  let managementStrategyFocusId = "china-key-account";
  let strategicDecisionFocusId = "china-key-account-lock";
  let policyMakerTab = "china";
  let chinaInfraSite = "wuxi";
  let chinaTalentScenarioId = "operate";
  let ceoChallengeId = "roi-credibility";
  let ceoChallengeTargetId = "scenario";
  let cLevelCouncilDecisionId = "";
  let cLevelCouncilRan = false;
  let execDecisionCouncilRan = false;
  let projectionFocusId = "ai-server";
  let projectionScenario = "neutral";
  let execDecisionFocusId = "hbm-ai-server";
  let selectedBacktestYear = "";
  let selectedExecProductId = "all";
  let responsePriority = "all";
  let paletteIndex = 0;
  let typeTimer = null;
  let selectedQaQuestion = "";
  let numberOrder = [];
  let numberFolded = {};
  let draggedNumberId = null;
  const QA_PLACEHOLDER = "Memory 시장에 대해 물어보세요";
  const CATEGORY_RENDER_BUDGET_MS = 12;

  try {
    memoryMarketNodePositions = JSON.parse(localStorage.getItem("memory-market-node-positions") || "{}") || {};
  } catch (error) {
    memoryMarketNodePositions = {};
  }

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
    LIVE = normalizeLiveData(LIVE);

    if (!BASE) {
      document.body.innerHTML = "<main class=\"empty\">baseline.json을 불러오지 못했습니다.</main>";
      return;
    }

    hideDisabledSections();
    renderChrome();
    renderSidebarNav();
    renderSidebarCategories();
    renderKpis();
    renderCLevelCockpit();
    renderExecutiveDecision();
    renderManagementStrategy();
    renderStrategicInvestmentDecision();
    renderPolicyMakers();
    renderChinaFabInfra();
    renderChinaTalentStrategy();
    renderNumberDashboard();
    renderProductProjection();
    renderCategories();
    renderResponses();
    renderArchitectureMatrix();
    renderPrices();
    renderNews();
    renderChinaNandBusiness();
    renderChinaDynamics();
    renderTalentRadar();
    renderChinaDeepDive();
    renderMemoryMarketMap();
    renderWorkbench();
    setupQA();
    setupInteractions();
    setupScrollSpy();
    normalizeBriefCopy(document.body);
    animateCounts();
    animateMeters();
    setupMouseDrivenMetrics();
  }

  function hideDisabledSections() {
    HIDDEN_SECTIONS.forEach((id) => {
      const node = document.getElementById(id);
      if (node) node.hidden = true;
    });
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

  function briefCopyText(value) {
    if (value == null) return "";
    const original = String(value);
    if (!/[가-힣]/.test(original)) return original;

    let text = original.replace(/\s+/g, " ").trim();
    const proseLike = text.length > 18 || /합니다|됩니다|입니다|습니다|니다|다[.!?。]|[.!?。]\s/.test(text);
    if (!proseLike) return original;

    [
      [/확인해야\s*합니다/g, "확인 필요"],
      [/추적해야\s*합니다/g, "추적 필요"],
      [/계산해야\s*합니다/g, "계산 필요"],
      [/봐야\s*합니다/g, "검토 필요"],
      [/해야\s*합니다/g, "필요"],
      [/필요합니다/g, "필요"],
      [/가능합니다/g, "가능"],
      [/중요합니다/g, "중요"],
      [/아닙니다/g, "아님"],
      [/있습니다/g, "있음"],
      [/없습니다/g, "없음"],
      [/어렵습니다/g, "어려움"],
      [/높습니다/g, "높음"],
      [/낮습니다/g, "낮음"],
      [/큽니다/g, "큼"],
      [/작습니다/g, "작음"],
      [/나타납니다/g, "나타남"],
      [/보입니다/g, "보임"],
      [/움직입니다/g, "움직임"],
      [/봅니다/g, "검토"],
      [/보여줍니다/g, "표시"],
      [/올라옵니다/g, "상승"],
      [/커집니다/g, "확대"],
      [/줄어듭니다/g, "축소"],
      [/흔들립니다/g, "변동"],
      [/됩니다/g, "됨"],
      [/합니다/g, ""],
      [/입니다/g, ""],
      [/습니다/g, "음"],
    ].forEach(([pattern, replacement]) => {
      text = text.replace(pattern, replacement);
    });

    return text
      .replace(/([가-힣)])\.(?=\s|$)/g, "$1 ·")
      .replace(/([가-힣)])다(?=[.!?。]|$)/g, "$1")
      .replace(/[!?。](?=\s|$)/g, " ·")
      .replace(/\s*·\s*/g, " · ")
      .replace(/\s{2,}/g, " ")
      .replace(/\s+([,;:])/g, "$1")
      .replace(/\s*·\s*$/g, "")
      .trim();
  }

  function normalizeBriefCopy(root = document.body) {
    if (!root || typeof document.createTreeWalker !== "function") return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || !/[가-힣]/.test(node.nodeValue || "")) return NodeFilter.FILTER_REJECT;
        if (parent.closest("script, style, textarea, input, select, option, code, pre, .count")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const nodes = [];
    let node = walker.nextNode();
    while (node) {
      nodes.push(node);
      node = walker.nextNode();
    }
    nodes.forEach((textNode) => {
      const next = briefCopyText(textNode.nodeValue);
      if (next !== textNode.nodeValue) textNode.nodeValue = next;
    });
  }

  function normalizeBrandName(value) {
    return String(value ?? "")
      .replace(/SK\s*하이닉스/g, "SKHY")
      .replace(/SK하이닉스/g, "SKHY")
      .replace(/\bSK\s+hynix\b/gi, "SKHY");
  }

  function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = normalizeBrandName(briefCopyText(value));
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

  function positiveCount(item = {}) {
    const count = Number(item.count ?? item.items?.length ?? 0);
    return Number.isFinite(count) ? count : 0;
  }

  function hasPositiveCount(item = {}) {
    return positiveCount(item) > 0;
  }

  function normalizeLiveData(data = emptyLive) {
    const next = { ...emptyLive, ...(data || {}) };
    next.categories = (next.categories || []).filter(hasPositiveCount);
    next.benchmarkSignals = {
      ...(next.benchmarkSignals || {}),
      themes: (next.benchmarkSignals?.themes || []).filter(hasPositiveCount),
      stream: next.benchmarkSignals?.stream || [],
    };
    next.health = (next.health || []).filter((entry) => {
      const step = String(entry?.step || "");
      const msg = String(entry?.msg || "");
      return !(entry?.ok === false && /^(뉴스|벤치마킹):/.test(step) && /0건/.test(msg));
    });
    return next;
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
    if (hasFailure) return { cls: "fail", label: "수집 지연" };
    if (!count) return { cls: "empty", label: "조건에 맞는 결과 없음" };
    if (hoursSince(updatedAt) > staleHours) return { cls: "stale", label: "업데이트 지연" };
    return { cls: "ok", label: "정상" };
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

  function sourceUrlItems(items = []) {
    return items.filter((item) => String(item?.sourceUrl || item?.link || "").trim());
  }

  function proofState({ sourceUrl = "", linkCount = 0, priceRows = 0, signals = 0 } = {}) {
    if (sourceUrl || linkCount > 0 || priceRows > 0) return { cls: "ok", label: "근거 연결" };
    if (signals > 0) return { cls: "watch", label: "신호 기반" };
    return { cls: "fail", label: "검증 필요" };
  }

  function proofBadgeHTML(item = {}) {
    const linkCount = sourceUrlItems(item.links || []).length;
    const state = proofState({
      sourceUrl: item.sourceUrl,
      linkCount,
      priceRows: item.priceRows || 0,
      signals: item.signals || 0,
    });
    const detail = state.cls === "ok"
      ? `출처 ${fmtNum(linkCount)} · 가격 ${fmtNum(item.priceRows || 0)} rows`
      : state.cls === "watch"
        ? `신호 ${fmtNum(item.signals || 0)} · 출처 보강`
        : "숫자 근거 없음";
    return `${factBadge(state.label, state.cls)}<span class="evidence-mini">${escapeHTML(detail)}</span>`;
  }

  function scopedMetricNodes(root, selector) {
    if (!root) return [];
    const nodes = [];
    if (root.matches?.(selector)) nodes.push(root);
    nodes.push(...$$(selector, root));
    return Array.from(new Set(nodes));
  }

  function countTarget(node) {
    const value = Number(node?.dataset?.to || 0);
    return Number.isFinite(value) ? value : 0;
  }

  function setCountValue(node, value) {
    if (!node) return;
    const prefix = node.dataset.prefix || "";
    const suffix = node.dataset.suffix || "";
    const decimals = Number(node.dataset.decimals || 0);
    const safe = Number.isFinite(Number(value)) ? Number(value) : 0;
    node.dataset.motionValue = String(safe);
    node.textContent = prefix + fmtNum(safe, decimals) + suffix;
  }

  function animateCountNode(node, { from = 0, to = countTarget(node), dur = 850, guard = false } = {}) {
    if (!node) return;
    if (guard && node.dataset.done === "1") return;
    node.dataset.done = "1";
    const token = String((Number(node.dataset.countToken || 0) || 0) + 1);
    node.dataset.countToken = token;
    const start = performance.now();
    const origin = Number.isFinite(Number(from)) ? Number(from) : 0;
    const target = Number.isFinite(Number(to)) ? Number(to) : 0;
    const step = (now) => {
      if (node.dataset.countToken !== token) return;
      const k = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - k, 3);
      setCountValue(node, origin + (target - origin) * eased);
      if (k < 1) requestAnimationFrame(step);
      else setCountValue(node, target);
    };
    requestAnimationFrame(step);
  }

  function meterTarget(node) {
    return clamp(node?.dataset?.fillTo ?? node?.dataset?.scoreTo ?? 0);
  }

  function setMeterValue(node, value) {
    if (!node) return;
    const safe = clamp(value);
    node.dataset.motionValue = String(safe);
    if (node.dataset.fillTo != null) node.style.width = `${safe}%`;
    if (node.dataset.scoreTo != null) node.style.setProperty("--score", safe);
  }

  function animateMeterNode(node, { from = 0, to = meterTarget(node), dur = 1100, guard = false } = {}) {
    if (!node) return;
    if (guard && node.dataset.meterDone === "1") return;
    node.dataset.meterDone = "1";
    const token = String((Number(node.dataset.meterToken || 0) || 0) + 1);
    node.dataset.meterToken = token;
    const start = performance.now();
    const origin = clamp(from);
    const target = clamp(to);
    const step = (now) => {
      if (node.dataset.meterToken !== token) return;
      const k = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - k, 3);
      setMeterValue(node, origin + (target - origin) * eased);
      if (k < 1) requestAnimationFrame(step);
      else setMeterValue(node, target);
    };
    requestAnimationFrame(step);
  }

  function sourceLinkHTML(url, label = "원문") {
    const clean = String(url || "").trim();
    if (!clean) return `<span class="data-state fail">출처 URL 없음</span>`;
    return `<a class="source-tag" href="${escapeHTML(clean)}" target="_blank" rel="noopener">${escapeHTML(label)}</a>`;
  }

  function animateCounts(root = document) {
    const counts = $$(".count", root);
    const run = (node) => {
      animateCountNode(node, { from: 0, to: countTarget(node), dur: 850, guard: true });
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
    counts.forEach((node) => {
      io.observe(node);
      const rect = node.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) run(node);
    });
    window.setTimeout(() => counts.forEach(run), 1200);
  }

  function animateMeters(root = document) {
    const meters = $$("[data-fill-to], [data-score-to]", root);
    const run = (node) => {
      animateMeterNode(node, {
        from: 0,
        to: meterTarget(node),
        dur: Number(node.dataset.meterDur || 1100),
        guard: true,
      });
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

  function metricMotionScope(target) {
    if (!(target instanceof Element)) return null;
    const direct = target.closest(".count, [data-fill-to], [data-score-to], .score-ring");
    const scopeSelector = [
      ".c-level-card",
      ".decision-card",
      ".number-card",
      ".metric",
      ".kpi-card",
      ".hub-route-card",
      ".projection-stat",
      ".projection-driver",
      ".projection-tab",
      ".projection-scenario-tab",
      ".mece-group",
      ".lane-card",
      ".gate-card",
      ".agent-debate-metrics > div",
      ".score-ring",
      ".memory-node",
      "article.card",
      "button",
    ].join(", ");
    return direct?.closest(scopeSelector) || target.closest(scopeSelector);
  }

  function cancelMetricAnimations(scope) {
    scopedMetricNodes(scope, ".count").forEach((node) => {
      node.dataset.countToken = String((Number(node.dataset.countToken || 0) || 0) + 1);
    });
    scopedMetricNodes(scope, "[data-fill-to], [data-score-to]").forEach((node) => {
      node.dataset.meterToken = String((Number(node.dataset.meterToken || 0) || 0) + 1);
    });
  }

  function applyMetricMotion(scope, progress) {
    const ratio = clamp(progress, 0, 100) / 100;
    scopedMetricNodes(scope, ".count").forEach((node) => {
      setCountValue(node, countTarget(node) * ratio);
    });
    scopedMetricNodes(scope, "[data-fill-to], [data-score-to]").forEach((node) => {
      setMeterValue(node, meterTarget(node) * ratio);
    });
  }

  function restoreMetricMotion(scope) {
    if (!scope) return;
    scope.classList.remove("metric-motion-active");
    scopedMetricNodes(scope, ".count").forEach((node) => {
      animateCountNode(node, {
        from: Number(node.dataset.motionValue || 0),
        to: countTarget(node),
        dur: 420,
      });
    });
    scopedMetricNodes(scope, "[data-fill-to], [data-score-to]").forEach((node) => {
      animateMeterNode(node, {
        from: Number(node.dataset.motionValue || 0),
        to: meterTarget(node),
        dur: 460,
      });
    });
  }

  let metricMotionBound = false;
  let metricMotionActiveScope = null;
  function setupMouseDrivenMetrics() {
    if (metricMotionBound) return;
    metricMotionBound = true;
    document.addEventListener("pointermove", (event) => {
      const scope = metricMotionScope(event.target);
      if (!scope) return;
      const countNodes = scopedMetricNodes(scope, ".count");
      const meterNodes = scopedMetricNodes(scope, "[data-fill-to], [data-score-to]");
      if (!countNodes.length && !meterNodes.length) return;
      if (metricMotionActiveScope && metricMotionActiveScope !== scope) restoreMetricMotion(metricMotionActiveScope);
      if (metricMotionActiveScope !== scope) {
        metricMotionActiveScope = scope;
        cancelMetricAnimations(scope);
      }
      const rect = scope.getBoundingClientRect();
      const progress = rect.width ? ((event.clientX - rect.left) / rect.width) * 100 : 100;
      scope.classList.add("metric-motion-active");
      applyMetricMotion(scope, progress);
    }, { passive: true });
    document.addEventListener("pointerout", (event) => {
      const scope = metricMotionScope(event.target);
      if (!scope || (event.relatedTarget && scope.contains(event.relatedTarget))) return;
      if (metricMotionActiveScope === scope) metricMotionActiveScope = null;
      restoreMetricMotion(scope);
    }, { passive: true });
  }

  function renderChrome() {
    document.title = BASE.meta?.title || document.title;
    const saved = localStorage.getItem("memory-theme") || "dark";
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
    $("#scrollTop")?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
    updateScrollProgress();
    window.addEventListener("scroll", updateScrollProgress, { passive: true });
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

  function updateScrollProgress() {
    const scroll = $("#scrollProg");
    const top = $("#scrollTop");
    const doc = document.documentElement;
    const max = Math.max(1, doc.scrollHeight - doc.clientHeight);
    const progress = Math.min(100, Math.max(0, (doc.scrollTop / max) * 100));
    if (scroll) scroll.style.width = `${progress}%`;
    if (top) top.classList.toggle("show", window.scrollY > 420);
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
    root.style.setProperty("--accent-1", palette.accent1 || palette.accent);
    root.style.setProperty("--accent-2", palette.accent2 || palette.teal || palette.accent);
    root.style.setProperty("--accent-3", palette.accent3 || palette.purple || palette.accent);
    root.style.setProperty("--accent-rgb-1", palette.accentRgb1 || "60, 130, 255");
    root.style.setProperty("--accent-rgb-2", palette.accentRgb2 || "0, 200, 255");
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
      const id = btn.dataset.route || btn.dataset.jump || "";
      const accent = routeAccent(id) || NAV_ACCENTS[btn.dataset.jump] || "rgba(255,255,255,.92)";
      btn.style.setProperty("--nav-active", accent);
      const label = btn.querySelector(".sb-label strong")?.textContent?.trim();
      if (label) btn.title = label;
    });
  }

  function routeById(id) {
    return SIDE_NAV_ROUTES.find((route) => route.id === id) || IA_ROUTES.find((route) => route.id === id) || null;
  }

  function routeDisplay(route) {
    return { ...route, ...(ROUTE_DISPLAY[route.id] || {}) };
  }

  function categoryDisplay(category) {
    return { ...category, ...(CATEGORY_DISPLAY[category.id] || {}) };
  }

  function renderSidebarNav() {
    const nav = $("#sideNav");
    if (!nav) return;
    nav.innerHTML = SIDE_NAV_GROUPS.map((group) => {
      const items = group.routes.map(routeById).filter(Boolean);
      if (!items.length) return "";
      return `
        <div class="sb-nav-group">
          <div class="sb-nav-group-label">${escapeHTML(group.label)}</div>
          ${items.map((routeSource) => {
            const route = routeDisplay(routeSource);
            const accent = routeAccent(routeSource.id);
            return `
              <button class="sb-item${routeSource.jump === "overview" ? " active" : ""}" type="button" data-jump="${escapeHTML(routeSource.jump)}" data-route="${escapeHTML(routeSource.id)}" style="--nav-active:${escapeHTML(accent)}" title="${escapeHTML(route.desc)}">
                <span class="sb-ico" aria-hidden="true">${escapeHTML(SIDE_NAV_ICONS[routeSource.id] || route.label.slice(0, 1))}</span>
                <span class="sb-label">
                  <strong>${escapeHTML(route.label)}</strong>
                  <small>${escapeHTML(route.desc || route.cadence || "")}</small>
                </span>
              </button>
            `;
          }).join("")}
        </div>
      `;
    }).join("");

    decorateSidebarItems();
  }

  function renderSidebarCategories() {
    const wrap = $("#sideCategories");
    if (!wrap) return;
    wrap.innerHTML = "";
    const byId = new Map(memoryCategories().map((category) => [category.id, categoryDisplay(category)]));
    TOPIC_FILTER_GROUPS.forEach((group) => {
      const categories = group.categories.map((id) => byId.get(id)).filter(Boolean);
      if (!categories.length) return;
      const node = el("div", "sb-filter-group");
      const isGroupActive = categories.some((category) => category.id === activeCategory);
      node.innerHTML = `
        <div class="sb-filter-head${isGroupActive ? " active" : ""}">
          <span>${escapeHTML(group.label)}</span>
          <em>${escapeHTML(group.hint)}</em>
        </div>
        <div class="sb-filter-options"></div>
      `;
      const options = node.querySelector(".sb-filter-options");
      categories.forEach((category) => {
        const btn = el("button", `sb-cat${category.id === activeCategory ? " active" : ""}`);
        btn.type = "button";
        btn.dataset.category = category.id;
        btn.setAttribute("aria-pressed", category.id === activeCategory ? "true" : "false");
        btn.style.setProperty("--local-accent", categoryAccent(category.id));
        btn.title = category.desc || category.label;
        btn.innerHTML = `
          <span>${escapeHTML(category.label)}</span>
          <small>${escapeHTML(category.en)}</small>
        `;
        options.appendChild(btn);
      });
      wrap.appendChild(node);
    });
    wrap.onclick = (event) => {
      const btn = event.target.closest("[data-category]");
      if (!btn || !wrap.contains(btn)) return;
      setCategory(btn.dataset.category, { jumpTo: "c-level-cockpit" });
    };
  }

  function normalizeCategoryId(id) {
    const next = String(id || "all");
    return HIDDEN_CATEGORY_IDS.has(next.toLowerCase()) ? "all" : next;
  }

  function updateCategoryChromeState(pending = false) {
    const cat = activeCategoryData() || { label: "All", desc: "" };
    const meta = $("#categoryMeta");
    if (meta) meta.textContent = `${cat.label} \u00b7 ${cat.desc}`;
    $$(".sb-cat").forEach((btn) => {
      const isActive = btn.dataset.category === activeCategory;
      btn.classList.toggle("active", isActive);
      btn.classList.toggle("is-pending", pending && isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
    $$(".sb-filter-head").forEach((head) => {
      const group = head.closest(".sb-filter-group");
      const hasActive = Boolean(group?.querySelector(".sb-cat.active"));
      head.classList.toggle("active", hasActive);
    });
  }

  function categoryRenderSteps() {
    return [
      renderExecutiveSummary,
      renderCLevelCockpit,
      renderCategories,
      renderExecutiveDecision,
      renderNumberDashboard,
      renderProductProjection,
      renderNews,
      renderArchitectureMatrix,
      renderMemoryMarketMap,
      renderChinaDeepDive,
      renderTalentRadar,
      renderChinaNandBusiness,
      renderWorkbench,
    ];
  }

  function finishCategoryRender(token) {
    if (token !== categoryRenderToken) return;
    categoryRenderFrame = 0;
    document.body.classList.remove("category-updating");
    updateCategoryChromeState(false);
    animateCounts();
    animateMeters();
  }

  function scheduleCategoryRender() {
    const token = ++categoryRenderToken;
    if (categoryRenderFrame) {
      cancelAnimationFrame(categoryRenderFrame);
      categoryRenderFrame = 0;
    }
    const steps = categoryRenderSteps();
    let index = 0;
    const run = () => {
      if (token !== categoryRenderToken) return;
      const start = performance.now();
      while (index < steps.length && performance.now() - start < CATEGORY_RENDER_BUDGET_MS) {
        const step = steps[index];
        index += 1;
        try {
          step();
        } catch (error) {
          console.warn("Category render step failed", error);
        }
      }
      if (index < steps.length) {
        categoryRenderFrame = requestAnimationFrame(run);
      } else {
        finishCategoryRender(token);
      }
    };
    categoryRenderFrame = requestAnimationFrame(run);
  }

  function setCategory(id, options = {}) {
    activeCategory = normalizeCategoryId(id);
    document.body.classList.add("category-updating");
    updateCategoryChromeState(true);
    if (options.jumpTo) requestAnimationFrame(() => jumpTo(options.jumpTo));
    scheduleCategoryRender();
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
        title: "TrendForce 가격과 중국 생태계 변화를 매일 먼저 확인",
        body: "NAND contract/spot, eSSD 고객, Xtacking 세대, 우한 Phase 3, 국산 장비 qual을 묶어 가격 하방과 고객 침투를 판단합니다.",
        jump: "prices",
        value: nandRows,
        unit: "rows",
      },
      {
        label: "제품군 프로젝션",
        title: "30개월 후부터 5년간 서버향·단말향 믹스 변화를 추적",
        body: "현재 크롤링된 HBM, NAND/eSSD, 단말, 중국 캐파 신호를 반영해 SKHY 제품군의 수요처별 시나리오를 매일 갱신합니다.",
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

  function routeAccent(routeId) {
    return {
      home: "#3C82FF",
      workbench: "#22C55E",
      market: "#FFB830",
      policy: "#60A5FA",
      competitors: "#00C8A0",
      talent: "#F0ABFC",
      analysis: "#A050FF",
      methodology: "#94A3B8",
    }[routeId] || "var(--accent)";
  }

  function routeTelemetry(route) {
    const sections = (route.sections || []).map(sectionTelemetry);
    const numericValues = sections.map((item) => Number(item.value)).filter(Number.isFinite);
    const score = sections.length
      ? Math.round(sections.reduce((sum, item) => sum + Number(item.score || 0), 0) / sections.length)
      : 0;
    const signals = numericValues.reduce((sum, value) => sum + value, 0);
    return { sections, score: clamp(score), signals };
  }

  function renderTodayHub() {
    const hero = $("#todayHero");
    const actions = $("#todayActions");
    if (!hero || !actions) return;

    actions.innerHTML = "";
    animateCounts(hero);
  }

  function renderExecutiveSummary() {
    const brief = $("#execBrief");
    const strategy = $("#execStrategy");
    if (!brief || !strategy) return;

    renderTodayHub();

    brief.innerHTML = `
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
    const kpis = (BASE.kpis || []).filter((kpi) => {
      const status = `${kpi.status || ""} ${kpi.statusClass || ""}`.toLowerCase();
      return kpi.showInKpiStrip !== false && !status.includes("stale");
    });
    kpis.slice(0, 6).forEach((kpi, index) => {
      const node = el("article", "kpi reveal");
      node.style.animationDelay = `${index * 35}ms`;
      const hasSourceUrl = String(kpi.sourceUrl || "").trim();
      const statusClass = hasSourceUrl ? (kpi.statusClass || kpi.status || "ok") : "fail";
      const badgeLabel = hasSourceUrl ? (kpi.badge || kpi.status || "출처 있음") : "출처 미첨부";
      node.innerHTML = `
        <span>${escapeHTML(kpi.label)}</span>
        <strong>${countHTML(kpi.value, {
          prefix: kpi.prefix || "",
          suffix: kpi.suffix || "",
          decimals: kpi.decimals || 0,
        })}</strong>
        <div class="kpi-meta">
          ${factBadge(badgeLabel, statusClass)}
          ${kpi.sourceDate ? `<span class="source-tag">${escapeHTML(kpi.sourceDate)}</span>` : ""}
          ${sourceLinkHTML(kpi.sourceUrl, kpi.source || "원문")}
        </div>
        <small>${escapeHTML(kpi.note)}</small>
        ${kpi.alt ? `<em class="kpi-alt">${escapeHTML(kpi.alt)}</em>` : ""}
      `;
      strip.appendChild(node);
    });
  }

  function cLevelDecisionAxes() {
    return [
      {
        id: "hbm-moat",
        label: "HBM/AI 서버 초격차",
        category: "hbm",
        categories: ["hbm", "aidemand", "packaging"],
        owner: "CEO · CTO",
        jump: "executive-decision",
        terms: ["hbm", "hbm4", "hbm4e", "nvidia", "rubin", "tsmc", "cowos", "server", "ai memory"],
        action: "HBM4 ramp, 고객 인증, 패키징 병목을 주간 의사결정 안건으로 유지",
        go: "고객 락인",
        watch: "패키징 병목",
        hold: "근거 보류",
      },
      {
        id: "china-dram",
        label: "중국 DRAM 가격 압력",
        category: "dram",
        categories: ["dram", "china", "operations"],
        owner: "CEO · CFO",
        jump: "prices",
        terms: ["cxmt", "changxin", "dram", "ddr5", "ddr4", "lpddr", "tencent", "capacity", "wpm"],
        action: "CXMT 점유율, 장기계약, DDR5 spot/contract spread를 가격 방어 안건으로 상정",
        go: "가격 방어",
        watch: "중국 캐파",
        hold: "근거 보류",
      },
      {
        id: "legacy-commodity",
        label: "레거시·범용 의사결정",
        category: "dram",
        categories: ["dram", "nand", "aidemand", "operations", "china"],
        owner: "CEO · CFO · 영업",
        jump: "prices",
        terms: ["legacy", "commodity", "dram", "ddr4", "ddr5", "lpddr", "nand", "ssd", "spot", "contract", "cxmt", "ymtc", "kioxia", "sandisk", "solidigm"],
        action: "DDR·LPDDR·NAND spot/contract spread와 CXMT·YMTC·Kioxia-SanDisk 신호를 제품 믹스·가격 방어·고객 배분 안건으로 전환",
        go: "방어 실행",
        watch: "가격/캐파 감시",
        hold: "근거 보류",
      },
      {
        id: "nand-essd",
        label: "NAND/eSSD 방어",
        category: "nand",
        categories: ["nand", "aidemand", "china"],
        owner: "사업총괄 · CFO",
        jump: "china-nand",
        terms: ["ymtc", "yangtze", "nand", "ssd", "essd", "solidigm", "xtacking", "lenovo", "wuhan"],
        action: "eSSD 고객 방어, Solidigm value-up, YMTC OEM 침투를 같은 보드에서 추적",
        go: "고객 방어",
        watch: "YMTC 침투",
        hold: "근거 보류",
      },
      {
        id: "competitive-dynamics",
        label: "경쟁 다이나믹스 대응",
        category: "china",
        categories: ["dram", "nand", "hbm", "packaging", "equipment", "china"],
        owner: "CEO · 전략",
        jump: "memory-market-map",
        terms: ["competitive", "competition", "rival", "samsung", "micron", "cxmt", "ymtc", "kioxia", "sandisk", "jcet", "xmc", "naura", "amec", "hbm", "nand", "dram"],
        action: "경쟁·파트너십·투자·공급 관계를 한 화면에서 비교해 가격 방어, 고객 락인, 제휴 우선순위를 결정",
        go: "관계 재배치",
        watch: "경쟁축 변화",
        hold: "근거 보류",
      },
      {
        id: "money-flow",
        label: "Money Flow 수익성 판단",
        category: "operations",
        categories: ["hbm", "dram", "nand", "aidemand", "operations", "china"],
        owner: "CFO · 사업총괄",
        jump: "memory-market-map",
        terms: ["money flow", "revenue", "sales", "investment", "funding", "capex", "contract", "tencent", "nvidia", "hyperscaler", "solidigm", "wuxi", "dalian", "ipo", "big fund"],
        action: "투자·매출 노출 흐름을 구분해 어디서 현금이 들어오고 어디로 방어 비용이 나가는지 검토",
        go: "수익성 검토",
        watch: "현금흐름 변화",
        hold: "근거 보류",
      },
      {
        id: "customer-supply-lock",
        label: "고객·공급 계약 재가격화",
        category: "aidemand",
        categories: ["hbm", "aidemand", "dram", "nand", "operations"],
        owner: "영업 · SCM",
        jump: "memory-market-map",
        terms: ["nvidia", "ai server", "hyperscaler", "tencent", "alibaba", "bytedance", "contract", "supply", "customer", "essd", "server dram", "hbm"],
        action: "AI 서버 고객 매출, 중국 장기계약, eSSD 침투를 묶어 공급 배분과 가격 재협상 우선순위를 정리",
        go: "계약 재가격화",
        watch: "고객 전환",
        hold: "근거 보류",
      },
      {
        id: "hbm-foundry-alliance",
        label: "HBM4 파운드리 동맹",
        category: "hbm",
        categories: ["hbm", "packaging", "aidemand", "operations"],
        owner: "CEO · CTO · 공급망",
        jump: "memory-market-map",
        terms: ["hbm4", "hbm4e", "tsmc", "cowos", "base die", "nvidia", "rubin", "packaging", "foundry"],
        action: "SKHY-TSMC 동맹, 삼성 턴키, Micron 추격을 같은 관계 보드에서 비교해 HBM4 고객 인증과 패키징 할당 우선순위를 결정",
        go: "고객 락인 강화",
        watch: "인증 일정 감시",
        hold: "근거 보류",
      },
      {
        id: "china-capex-warning",
        label: "중국 캐파·정책자금 경보",
        category: "china",
        categories: ["china", "dram", "nand", "equipment", "geopolitics"],
        owner: "CEO · Policy · CFO",
        jump: "memory-market-map",
        terms: ["cxmt", "ymtc", "big fund", "ipo", "capacity", "wpm", "naura", "amec", "wuhan", "shanghai", "hefei", "policy"],
        action: "CXMT IPO·YMTC 우한 증설·Big Fund 자금을 투자 관계선으로 묶어 레거시 DRAM/NAND 하방 압력 경보로 전환",
        go: "가격 방어 준비",
        watch: "캐파 ramp 감시",
        hold: "근거 보류",
      },
      {
        id: "startup-option-investment",
        label: "Post-HBM 옵션 투자",
        category: "operations",
        categories: ["hbm", "cxl", "packaging", "aidemand", "operations"],
        owner: "CVC · CTO · CFO",
        jump: "memory-market-map",
        terms: ["cxl", "photonic", "photonics", "pim", "xcena", "celestial", "lightmatter", "ayar", "xconn", "startup", "funding"],
        action: "CXL·포토닉스·PIM 후보를 Money Flow 투자 축으로 비교해 직접 투자, 공동 PoC, 관찰 대상을 분리",
        go: "PoC/실사 착수",
        watch: "옵션 유지",
        hold: "근거 보류",
      },
      {
        id: "policy-fab",
        label: "정책/Fab 라이선스",
        category: "geopolitics",
        categories: ["geopolitics", "operations", "china"],
        owner: "법무 · 대외협력",
        jump: "policy-makers",
        terms: ["bis", "veu", "match", "chips", "wuxi", "dalian", "license", "export control", "fab"],
        action: "중국 증설, 운영유지, 기술 업그레이드를 분리해 승인 조건을 관리",
        go: "조건부 승인",
        watch: "규제 이벤트",
        hold: "No-Go",
      },
      {
        id: "packaging-equipment",
        label: "패키징·장비 우회로",
        category: "packaging",
        categories: ["packaging", "equipment", "china"],
        owner: "CTO · 구매",
        jump: "china-dynamics",
        terms: ["jcet", "xmc", "tfme", "naura", "amec", "acm", "packaging", "hybrid bonding", "tsv", "equipment"],
        action: "중국 패키징·장비 qual 신호를 HBM 우회로와 IP 방어 안건으로 연결",
        go: "옵션 투자",
        watch: "국산 장비 qual",
        hold: "근거 보류",
      },
      {
        id: "talent-ip",
        label: "인재/IP 조기경보",
        category: "talent",
        categories: ["talent", "china", "operations"],
        owner: "CHRO · CISO",
        jump: "talent-radar",
        terms: ["talent", "hiring", "yield", "engineer", "ip", "tsv", "boss zhipin", "campus", "maimai"],
        action: "수율 엔지니어, 채용 JD, IP 소송 신호를 리텐션·보안 게이트로 연결",
        go: "방어 강화",
        watch: "채용 신호",
        hold: "근거 보류",
      },
    ];
  }

  function cLevelAxisVisible(axis) {
    if (activeCategory === "all") return true;
    return (axis.categories || []).includes(activeCategory);
  }

  function cLevelTextHasAny(text, terms = []) {
    const hay = String(text || "").toLowerCase();
    return terms.some((term) => hay.includes(String(term || "").toLowerCase()));
  }

  function cLevelNewsFor(axis) {
    return rawNews().filter((item) => {
      const link = String(item.link || item.sourceUrl || "").trim();
      if (!link) return false;
      return cLevelTextHasAny(`${item.title || ""} ${item.titleKo || ""} ${item.summary || ""} ${item.source || ""} ${item.category || ""}`, axis.terms);
    });
  }

  function cLevelBenchmarkFor(axis) {
    return (LIVE.benchmarkSignals?.stream || []).filter((item) => {
      const link = String(item.link || item.sourceUrl || "").trim();
      if (!link) return false;
      return cLevelTextHasAny(`${item.title || ""} ${item.titleKo || ""} ${item.summary || ""} ${item.source || ""} ${item.theme || ""}`, axis.terms);
    });
  }

  function cLevelPriceRowsFor(axis) {
    return allPriceRows().filter((row) => cLevelTextHasAny(`${row.group || ""} ${row.sectionTitle || ""} ${row.item || ""}`, axis.terms));
  }

  function cLevelKpisFor(axis) {
    return (BASE.kpis || []).filter((item) => {
      if (!String(item.sourceUrl || "").trim()) return false;
      return cLevelTextHasAny(`${item.label || ""} ${item.note || ""} ${item.alt || ""} ${item.source || ""}`, axis.terms);
    });
  }

  function cLevelEvidenceFor(axis) {
    return {
      news: cLevelNewsFor(axis),
      benchmark: cLevelBenchmarkFor(axis),
      prices: cLevelPriceRowsFor(axis),
      kpis: cLevelKpisFor(axis),
    };
  }

  function cLevelEvidenceCount(evidence = {}) {
    return (evidence.news || []).length + (evidence.benchmark || []).length + (evidence.prices || []).length + (evidence.kpis || []).length;
  }

  function cLevelPriceMomentum(rows = []) {
    const changes = rows.map((row) => Number(row.changePct)).filter(Number.isFinite);
    if (!changes.length) return 0;
    return changes.reduce((sum, value) => sum + value, 0) / changes.length;
  }

  function cLevelDecisionItem(axis) {
    const evidence = cLevelEvidenceFor(axis);
    const evidenceCount = cLevelEvidenceCount(evidence);
    const linkCount = evidence.news.length + evidence.benchmark.length + evidence.kpis.length;
    const priceRows = evidence.prices.length;
    const priceMomentum = cLevelPriceMomentum(evidence.prices);
    const confidence = clamp(linkCount * 9 + priceRows * 5 + Math.min(20, Math.abs(priceMomentum) * 6), 0, 100);
    let verdict = "Hold";
    if (confidence >= 68) verdict = axis.id === "policy-fab" || axis.id === "talent-ip" || priceMomentum < -0.35 ? "Watch" : "Go";
    else if (confidence >= 34) verdict = "Watch";
    const tone = verdict === "Go" ? axis.go : verdict === "Watch" ? axis.watch : axis.hold;
    return { ...axis, evidence, evidenceCount, linkCount, priceRows, priceMomentum, confidence, verdict, tone };
  }

  function cLevelDecisionItems() {
    return cLevelDecisionAxes()
      .filter(cLevelAxisVisible)
      .map(cLevelDecisionItem)
      .filter((item) => item.evidenceCount > 0)
      .sort((a, b) => b.confidence - a.confidence || b.evidenceCount - a.evidenceCount);
  }

  function cLevelEvidencePool() {
    return cLevelDecisionAxes().flatMap((axis) => {
      const evidence = cLevelEvidenceFor(axis);
      return []
        .concat(evidence.news || [])
        .concat(evidence.benchmark || [])
        .concat(evidence.kpis || [])
        .concat(evidence.prices || []);
    });
  }

  function cLevelEvidenceScore() {
    const items = cLevelDecisionAxes().map(cLevelDecisionItem).filter((item) => item.evidenceCount > 0);
    if (!items.length) return 0;
    return clamp(items.reduce((sum, item) => sum + item.confidence, 0) / items.length);
  }

  function cLevelSourceLinks(decisions = []) {
    const links = [];
    decisions.forEach((item) => {
      item.evidence.news.slice(0, 3).forEach((news) => {
        links.push({
          type: "뉴스",
          title: newsTitle(news),
          source: news.source || "News",
          date: news.date || news.publishedAt || news.crawledAt,
          url: news.link || news.sourceUrl,
          axis: item.label,
        });
      });
      item.evidence.benchmark.slice(0, 2).forEach((news) => {
        links.push({
          type: "벤치마킹",
          title: newsTitle(news),
          source: news.source || news.theme || "Benchmark",
          date: news.date || news.publishedAt || news.crawledAt,
          url: news.link || news.sourceUrl,
          axis: item.label,
        });
      });
      item.evidence.kpis.slice(0, 2).forEach((kpi) => {
        links.push({
          type: "KPI",
          title: kpi.label,
          source: kpi.source || "KPI",
          date: kpi.sourceDate,
          url: kpi.sourceUrl,
          axis: item.label,
        });
      });
      item.evidence.prices.slice(0, 2).forEach((row) => {
        links.push({
          type: "가격",
          title: `${row.group || row.sectionTitle || "Price"} · ${row.item || ""}`,
          source: "TrendForce/DRAMeXchange",
          date: row.lastUpdate || LIVE.prices?.updatedAt,
          url: row.sourceUrl,
          axis: item.label,
        });
      });
    });
    const seen = new Set();
    return links.filter((link) => {
      const key = String(link.url || link.title || "").toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function cLevelAgentItems(decision = {}, decisions = []) {
    const selected = decision || decisions[0];
    const contrast = decisions.find((item) => item.id !== selected?.id) || selected;
    const totalEvidence = selected?.evidenceCount || 0;
    const topLabel = selected?.label || "근거 축 없음";
    const topAction = selected?.action || "sourceUrl과 가격 row가 쌓일 때까지 보류";
    const relatedRelations = memoryMarketRelationsForTerms(selected?.terms || []);
    const moneyRelations = relatedRelations.filter((item) => item.mode === "money");
    const competitiveRelations = relatedRelations.filter((item) => item.mode === "competitive");
    const topRelation = relatedRelations[0];
    const priceRows = selected?.priceRows || 0;
    const linkCount = selected?.linkCount || 0;
    return [
      {
        id: "ceo",
        name: "CEO Agent",
        role: "우선순위",
        color: "#3C82FF",
        message: `${topLabel} 안건을 검토합니다. 근거 ${fmtNum(totalEvidence)}개, 관계 ${fmtNum(relatedRelations.length)}개가 연결됐습니다. 최우선 관계는 ${topRelation ? `${topRelation.from} → ${topRelation.to}` : "아직 없음"}입니다.`,
      },
      {
        id: "cfo",
        name: "CFO Agent",
        role: "수익성",
        color: "#22C55E",
        message: `Money Flow 관점에서는 투자/매출 관계 ${fmtNum(moneyRelations.length)}개를 봅니다. 이 화면의 지수는 회계 ROI가 아니라 실사 우선순위이며, NPV/IRR은 계약 원문과 가격 rows가 붙은 뒤 별도 계산합니다.`,
      },
      {
        id: "cto",
        name: "CTO Agent",
        role: "기술/제품",
        color: "#A050FF",
        message: `${topAction}. 경쟁 관계 ${fmtNum(competitiveRelations.length)}개 중 기술 병목은 HBM 인증, NAND/eSSD, 패키징, 장비 qual로 분리해 봅니다.`,
      },
      {
        id: "policy",
        name: "Policy Agent",
        role: "규제/Fab",
        color: "#FFB830",
        message: "중국 Fab 판단은 운영 유지, 캐파 확대, 기술 업그레이드로 분리합니다. Big Fund, BIS, CHIPS, MATCH 근거가 붙지 않은 투자·공급 관계는 Watch로 남깁니다.",
      },
      {
        id: "market",
        name: "Market Agent",
        role: "가격/고객",
        color: "#00C8A0",
        message: `${topLabel}은 가격 rows ${fmtNum(priceRows)}개와 링크 ${fmtNum(linkCount)}개를 먼저 봅니다. 비교 축은 ${contrast?.label || topLabel}이며, Spot이 먼저 꺾이고 contract가 뒤따르면 공급 배분·가격 재협상 안건으로 전환합니다.`,
      },
      {
        id: "audit",
        name: "Data Auditor",
        role: "팩트 검증",
        color: "#EF4444",
        message: "sourceUrl, 뉴스 link, 가격 row 중 하나도 없으면 관계 그래프와 사실 카드에 올리지 않습니다. 관계선은 실제 크롤링 근거 수로만 두께와 점수를 조정합니다.",
      },
    ];
  }

  function cLevelCouncilConclusion(decision = {}) {
    const evidence = decision.evidenceCount || 0;
    const confidence = Math.round(decision.confidence || 0);
    const verdict = decision.verdict || "Hold";
    const action = decision.action || "추가 근거 수집";
    const direction = verdict === "Go"
      ? "경영진 안건으로 상정"
      : verdict === "Watch"
        ? "조건부 모니터링 후 재심의"
        : "결정 보류";
    return {
      title: `${verdict} · ${direction}`,
      body: `${decision.label || "선택 안건"}은 ${fmtNum(evidence)}개 근거와 신뢰도 ${fmtNum(confidence)}/100 기준으로 ${direction}이 적절합니다.`,
      next: `다음 액션: ${action}`,
    };
  }

  function cLevelDecisionProfile(decision = {}) {
    const profiles = {
      "hbm-moat": {
        question: "HBM4·AI 서버 캐파와 고객 락인을 지금 Go 안건으로 올릴 것인가?",
        ceo: "AI 서버 수요와 HBM 고객 인증이 동시에 붙을 때만 최우선 안건으로 승격합니다.",
        cfo: "프리미엄 ASP와 고객 선급·장기계약 근거가 붙기 전까지는 CAPEX 집행안을 NPV/IRR로 확정하지 않습니다.",
        cto: "HBM4 ramp, 베이스 다이, CoWoS·패키징 할당, 수율 안정화가 같은 방향인지 분리 점검합니다.",
        policy: "미국 고객·첨단 패키징·중국 노출을 분리해 수출통제나 end-use 리스크가 붙는 구간은 별도 승인 게이트로 둡니다.",
        market: "HBM 직접 가격표가 없으면 DDR5/GDDR/모듈 가격과 고객 인증 뉴스를 proxy로 쓰되, proxy임을 명시합니다.",
        audit: "HBM 점유율·고객 인증·양산 일정은 공식/외신/분석 원문 링크가 있는 항목만 사실 카드에 올립니다.",
        next: "고객별 HBM4 ramp, 패키징 병목, 서버 DRAM 가격 약세를 2주 단위로 재검토",
      },
      "china-dram": {
        question: "CXMT발 DDR5·LPDDR 가격 압력을 가격 방어 안건으로 격상할 것인가?",
        ceo: "CXMT 점유율, 장기 공급계약, DDR5/LPDDR 가격 신호가 함께 움직이면 Watch에서 방어 안건으로 올립니다.",
        cfo: "레거시 마진 floor와 고객별 가격 민감도를 먼저 계산하고, 중국 물량 공세는 Bear case에 반영합니다.",
        cto: "CXMT의 DDR5 수율, 공정 노드, HBM 지연은 분리해서 봅니다. 실제 위협은 단기 HBM보다 범용 DRAM 가격입니다.",
        policy: "중국 내수 고객 계약과 BIS/DUV 제한은 별도 트랙입니다. 규제가 있어도 내수 캐파 확대는 가격 압력으로 남깁니다.",
        market: "Spot이 먼저 꺾이고 Contract가 뒤따르면 가격 재협상·재고 축소·고객 방어를 동시에 검토합니다.",
        audit: "CXMT 매출·캐파·점유율 수치는 기준일과 출처가 다르면 하나의 확정치처럼 합치지 않습니다.",
        next: "DDR5 spot/contract spread와 중국 빅테크 계약 보도를 주간 경보로 연결",
      },
      "legacy-commodity": {
        question: "범용 DRAM/NAND 가격 방어를 지금 경영진 안건으로 올릴 것인가?",
        ceo: "레거시·범용은 성장 안건이 아니라 현금흐름 방어 안건입니다. 가격 하방 신호가 확인될 때만 즉시 상정합니다.",
        cfo: "ROI는 재무 수익률이 아니라 실사 우선순위입니다. 저수익 SKU 축소, 재고 회전, cash-cost floor를 먼저 봅니다.",
        cto: "DDR4·DDR5·LPDDR·wafer NAND를 한 묶음으로 판단하지 않고 제품군별 원가·수율·전환 가능성을 따로 봅니다.",
        policy: "중국 캐파 확대와 수출통제 반작용은 레거시 가격 방어의 외부 변수로만 올리고, 증설 승인과 섞지 않습니다.",
        market: "CXMT·YMTC·Kioxia·SanDisk 신호와 spot/contract 가격을 같이 봐야 가격 방어 시점을 놓치지 않습니다.",
        audit: "중복 뉴스와 RSS 재가공 기사 대신 canonical link가 있는 기사와 가격 row만 근거로 씁니다.",
        next: "가격 하방, 고객 이탈, 중국 캐파 신호 중 2개 이상 동시 발생 시 방어 실행 검토",
      },
      "nand-essd": {
        question: "YMTC·eSSD 침투에 맞서 Solidigm/NAND 방어 투자를 집행할 것인가?",
        ceo: "NAND는 가격만 보지 말고 eSSD 고객 인증, Solidigm value-up, 중국 내수 보조금까지 묶어 판단합니다.",
        cfo: "NAND contract와 SSD/OEM proxy가 동반 개선될 때만 믹스 확대를 검토하고, 약세면 고객 방어 예산으로 제한합니다.",
        cto: "YMTC Xtacking, QLC/eSSD, XMC 패키징 연결은 기술 축을 나눠 보되 수율 미확인 수치는 Watch로 둡니다.",
        policy: "우한 클러스터와 국산 장비 qual은 제재 내성의 신호입니다. 다만 SKHY 중국 운영 승인 조건과는 분리합니다.",
        market: "NAND spot/contract가 벌어지고 eSSD 고객 뉴스가 나오면 가격 방어와 장기계약 재협상을 같이 검토합니다.",
        audit: "YMTC 층수·밀도·캐파 수치는 공식값과 분석 추정값을 섞지 않고 별도 표기합니다.",
        next: "eSSD 인증, NAND contract, Solidigm/Dalian 운영 근거를 한 보드에서 재점검",
      },
      "competitive-dynamics": {
        question: "경쟁·파트너십·투자·공급 관계를 오늘의 경영진 경쟁 맵으로 승격할 것인가?",
        ceo: "경쟁 다이나믹스는 단순 뉴스 묶음이 아니라 어느 관계가 SKHY 가격·고객·공급망에 영향을 주는지 보는 안건입니다.",
        cfo: "경쟁 관계가 돈의 흐름으로 연결되지 않으면 투자안이 아니라 모니터링 안건으로 남깁니다.",
        cto: "HBM, DRAM, NAND, 패키징 관계를 한 원형 맵에 올리되 기술 병목은 제품군별로 분리합니다.",
        policy: "중국·미국·한국 정책 이벤트가 관계선의 방향을 바꾸는 경우에만 규제 overlay를 붙입니다.",
        market: "관계선은 가격, 고객 계약, 캐파, 공급 뉴스 중 하나 이상이 확인될 때만 두껍게 표시합니다.",
        audit: "중복 기사에서 나온 관계는 1개 canonical 관계로만 계산합니다.",
        next: "경쟁, 파트너십, 투자, 공급 관계를 각각 가격·고객·정책 보드와 연결",
      },
      "money-flow": {
        question: "투자와 매출의 흐름이 SKHY의 자본배분 우선순위를 바꿀 만큼 강한가?",
        ceo: "돈의 흐름은 누가 투자받고 누가 매출을 확보하는지를 보며, 기술 매력도와 별도로 판단합니다.",
        cfo: "투자 라운드, 장기 공급계약, 고객 매출 근거가 붙은 항목만 자본배분 후보로 승격합니다.",
        cto: "돈이 몰리는 기술이 실제 메모리 병목을 푸는지 CXL, 포토닉스, HBM, NAND별로 검증합니다.",
        policy: "미국 outbound investment와 중국 반도체 투자 제한이 걸리는 후보는 실사 전에 법무 게이트를 통과해야 합니다.",
        market: "매출 신호는 고객 계약, 양산 파트너, 하이퍼스케일러 PoC가 확인될 때 강하게 반영합니다.",
        audit: "조달액·밸류에이션·계약 규모는 발표일과 출처가 있는 항목만 수치로 표시합니다.",
        next: "투자 흐름과 매출 흐름을 분리해 CVC 후보와 고객 방어 후보로 나누기",
      },
      "customer-supply-lock": {
        question: "AI 고객·중국 클라우드·eSSD 고객 계약을 공급 배분 의사결정으로 연결할 것인가?",
        ceo: "고객 락인은 가격보다 먼저 움직이는 신호입니다. 장기계약과 승인 벤더 변화가 있으면 우선순위를 올립니다.",
        cfo: "고객 계약은 ASP 방어와 물량 안정성을 같이 주지만, 할인 조건이 크면 수익성 검토가 먼저입니다.",
        cto: "고객 인증은 제품 성능, 수율, 패키징 병목이 함께 풀릴 때만 공급 약속으로 연결합니다.",
        policy: "중국 클라우드 고객 계약은 내수 정책과 수출통제 조건을 분리해 봅니다.",
        market: "텐센트·알리바바·바이트댄스·NVIDIA 등 고객 신호는 가격 협상력 변화로 해석합니다.",
        audit: "고객 계약 규모와 기간은 외신/공식 출처가 없으면 사실 수치로 쓰지 않습니다.",
        next: "고객 인증, 계약 기간, 공급 가능 캐파를 한 게이트로 묶기",
      },
      "china-capex-warning": {
        question: "CXMT IPO·YMTC 증설·Big Fund를 공급과잉 조기경보로 볼 것인가?",
        ceo: "중국 정책자본은 단일 회사 뉴스가 아니라 DRAM/NAND 공급곡선 변화로 해석합니다.",
        cfo: "보조금 기반 캐파는 단기 적자에도 유지될 수 있으므로 Base/Bear/Bull ASP 민감도에 별도 반영합니다.",
        cto: "Naura·AMEC·ACM 등 장비 내재화는 공정 성능보다 제재 내성 향상 신호로 먼저 봅니다.",
        policy: "Big Fund, 지방정부 펀드, BIS/MATCH 변화는 같은 캘린더에서 보되 법률 확정 전 항목은 Watch로 둡니다.",
        market: "중국 wafer start와 가격 spread가 같은 방향이면 범용 가격 하방 확률을 높입니다.",
        audit: "정책자금 규모와 IPO 조달액은 발표일·통화·승인 단계가 확인된 원문만 사용합니다.",
        next: "IPO 자금 집행, 신규 fab ramp, 가격 spread를 공급과잉 경보 조건으로 묶기",
      },
      "hbm-foundry-alliance": {
        question: "SKHY-TSMC HBM4 파운드리 동맹을 우선 투자·계약 안건으로 확정할 것인가?",
        ceo: "HBM4부터는 메모리 경쟁이 아니라 베이스 다이·패키징·고객 인증 경쟁입니다.",
        cfo: "CoWoS/패키징 할당과 고객 장기계약이 붙을 때만 프리미엄 투자 집행안을 Go로 둡니다.",
        cto: "TSMC base die, 삼성 턴키, Micron ramp를 같은 표에서 비교하고 인증 일정 지연은 별도 리스크로 둡니다.",
        policy: "대만·미국·중국 공급망 노출을 분리해 계약 구조와 수출통제 조건을 같이 검토합니다.",
        market: "NVIDIA/ASIC 고객 인증 일정과 서버 DRAM 가격이 엇갈리면 고객별 할당을 보수적으로 조정합니다.",
        audit: "HBM4 양산·출하·인증 표현은 회사 공식 발표와 외신 보도를 구분해 표시합니다.",
        next: "고객 인증 일정, CoWoS 할당, base die 수율을 같은 스코어보드로 연결",
      },
      "startup-option-investment": {
        question: "CXL·포토닉스·PIM을 지금 CVC/소수지분 옵션으로 집행할 것인가?",
        ceo: "Post-HBM은 즉시 인수보다 옵션 가치와 고객 PoC 신호를 기준으로 단계화합니다.",
        cfo: "Series stage, 누적 조달, 전략 투자자, 양산 파트너가 확인된 후보만 실사 우선순위에 올립니다.",
        cto: "CXL 스위치, 광 I/O, PIM, 3D DRAM은 서로 다른 병목입니다. 같은 기술처럼 묶어 투자하지 않습니다.",
        policy: "미국 outbound investment, 중국 반도체 투자 제한, 고객 데이터 접근권을 투자 조건으로 확인합니다.",
        market: "매출보다 hyperscaler PoC, 표준 호환성, 고객 인증, 공급 파트너가 선행지표입니다.",
        audit: "스타트업 밸류에이션·조달액은 보도일과 라운드가 확인된 외신/공식 릴리스만 반영합니다.",
        next: "PoC 후보와 단순 Watch 후보를 분리하고 후속투자권 조건을 검토",
      },
      "policy-fab": {
        question: "중국 Fab 운영을 유지·확대·기술 업그레이드 중 어디까지 승인할 것인가?",
        ceo: "중국 Fab 안건은 운영 유지, 캐파 확대, 기술 업그레이드를 반드시 분리해 결재합니다.",
        cfo: "운영 유지 CAPEX와 신규 증설 CAPEX의 리스크 할인율을 다르게 둡니다.",
        cto: "Wuxi/Dalian 공정 전환은 수율·장비 반입·고객 인증 가능성을 동시에 확인해야 합니다.",
        policy: "BIS VEU, CHIPS, MATCH, EAR 조건이 확인되지 않은 업그레이드는 No-Go 또는 Watch입니다.",
        market: "중국 내 운영 리스크가 가격 프리미엄을 상쇄하면 고객 배분을 재검토합니다.",
        audit: "정부·규제 원문과 회사 공식 자료가 없는 Fab 확대 주장은 사실 카드에 올리지 않습니다.",
        next: "운영 유지와 기술 업그레이드의 승인 문서·환경 인허가·수출통제 조건을 분리",
      },
      "packaging-equipment": {
        question: "중국 패키징·장비 우회로를 SKHY의 IP/공급망 방어 안건으로 올릴 것인가?",
        ceo: "XMC·JCET·Naura·AMEC 신호는 경쟁 뉴스가 아니라 선단 공정 우회 전략입니다.",
        cfo: "장비 내재화가 가격에 반영되기 전까지는 방어 비용과 대체 조달 옵션을 따로 계산합니다.",
        cto: "TSV, 하이브리드 본딩, fan-out, 식각·증착·세정 장비 qual을 각각 분리해 봅니다.",
        policy: "Entity List와 수출통제 변화는 국산 장비 qual 속도와 반대로 움직일 수 있습니다.",
        market: "중국 OSAT·장비 뉴스가 고객 인증이나 wafer start와 연결될 때만 시장 영향도를 높입니다.",
        audit: "장비 성능·매출·국산화율은 업체 공식/분석 출처별로 분리하고 추정치는 Inferred로 둡니다.",
        next: "패키징 우회와 장비 내재화를 HBM·NAND·DRAM별 리스크로 재분류",
      },
      "talent-ip": {
        question: "중국 인재/IP 신호를 보안·리텐션 예산 안건으로 올릴 것인가?",
        ceo: "수율 엔지니어 이동은 기술 격차를 줄이는 선행 신호이므로 단순 HR 이슈로 보지 않습니다.",
        cfo: "핵심 인력 리텐션 비용은 방어 비용이 아니라 HBM·DRAM 수율 자산 보호 투자로 봅니다.",
        cto: "공정 recipe, 장비 qual, TSV/HBM stacking 경험 이동을 설계도 유출보다 높은 위험으로 봅니다.",
        policy: "non-compete, IP 소송, 출입권한, 중국 채용 플랫폼 신호를 법무·보안 게이트로 연결합니다.",
        market: "경쟁사 채용이 늘어도 제품 가격과 고객 인증으로 전이되지 않으면 Watch 단계에 둡니다.",
        audit: "채용 공고 키워드는 기술 로드맵의 직접 증거가 아니라 6~12개월 선행 신호로만 표시합니다.",
        next: "핵심 수율 인력, JD 키워드, IP 사건을 한 리텐션 보드로 묶기",
      },
    };
    const fallback = {
      question: `${decision.label || "선택 안건"}을 경영진 의사결정 안건으로 올릴 수 있는가?`,
      ceo: "근거 수, 신뢰도, 가격 row, 출처 링크를 기준으로 Go/Watch/Hold를 나눕니다.",
      cfo: "재무 확정치가 없는 항목은 실사 우선순위로만 사용하고 예산 집행 모델은 분리합니다.",
      cto: "기술 병목과 제품군 실행 조건을 섞지 않고 검증 가능한 항목만 남깁니다.",
      policy: "규제·Fab·정책자금 조건은 실행 게이트로 분리합니다.",
      market: "가격·고객·계약 신호가 동시에 움직일 때만 시장 안건으로 승격합니다.",
      audit: "출처 링크나 가격 row가 없는 항목은 사실 레이어로 승격하지 않습니다.",
      next: "근거가 보강될 때까지 주간 모니터링",
    };
    return profiles[decision?.id] || fallback;
  }

  function cLevelAgentItems(decision = {}, decisions = []) {
    const selected = decision || decisions[0] || {};
    const contrast = decisions.find((item) => item.id !== selected?.id) || selected;
    const totalEvidence = selected?.evidenceCount || 0;
    const relatedRelations = memoryMarketRelationsForTerms(selected?.terms || []);
    const moneyRelations = relatedRelations.filter((item) => item.mode === "money");
    const competitiveRelations = relatedRelations.filter((item) => item.mode === "competitive");
    const topRelation = relatedRelations[0];
    const priceRows = selected?.priceRows || 0;
    const linkCount = selected?.linkCount || 0;
    const confidence = Math.round(selected?.confidence || 0);
    const topRelationText = topRelation
      ? `${memoryMarketNodeName(topRelation.from)} → ${memoryMarketNodeName(topRelation.to)}`
      : "근거가 붙은 관계선 없음";
    const profile = cLevelDecisionProfile(selected);
    const verdictMeaning = selected?.verdict === "Go"
      ? "즉시 상정"
      : selected?.verdict === "Watch"
        ? "조건부 재검토"
        : "보류";
    return [
      {
        id: "ceo",
        initials: "CE",
        name: "CEO Agent",
        title: "Chief Executive Officer",
        role: "우선순위·최종 안건화",
        color: "#2D6BFF",
        stance: selected?.verdict === "Go" ? "상정" : selected?.verdict === "Watch" ? "조건부 검토" : "보류",
        message: `질문은 "${profile.question}"입니다. 현재 근거 ${fmtNum(totalEvidence)}개, 신뢰도 ${fmtNum(confidence)}/100으로 ${verdictMeaning}입니다. ${profile.ceo} 핵심 관계는 ${topRelationText}입니다.`,
      },
      {
        id: "cfo",
        initials: "CF",
        name: "CFO Agent",
        title: "Chief Financial Officer",
        role: "수익성·자본배분",
        color: "#00C2A8",
        stance: "투자/매출 분리",
        message: `${profile.cfo} Money Flow 근거는 ${fmtNum(moneyRelations.length)}개입니다. 가격 row ${fmtNum(priceRows)}개와 링크/KPI ${fmtNum(linkCount)}개가 부족하면 재무 ROI가 아니라 1차 필터로만 씁니다.`,
      },
      {
        id: "cto",
        initials: "CT",
        name: "CTO Agent",
        title: "Chief Technology Officer",
        role: "기술·제품 로드맵",
        color: "#8B5CF6",
        stance: "병목 분리",
        message: `${profile.cto} Competitive Dynamics 근거는 ${fmtNum(competitiveRelations.length)}개입니다. 기술 병목은 가격·정책 판단과 섞지 않고 제품군별 실행 조건으로 내립니다.`,
      },
      {
        id: "policy",
        initials: "PO",
        name: "Policy Agent",
        title: "Policy & Fab Risk Lead",
        role: "규제·Fab·정책자금",
        color: "#F59E0B",
        stance: "라이선스 게이트",
        message: `${profile.policy} 실행 조건은 운영 유지, 캐파 확대, 기술 업그레이드를 나눠 승인하는 것입니다. 규제 원문이 없으면 Go가 아니라 Watch입니다.`,
      },
      {
        id: "market",
        initials: "MA",
        name: "Market Agent",
        title: "Market Intelligence Lead",
        role: "가격·고객·계약",
        color: "#10B981",
        stance: "가격 전이 확인",
        message: `${profile.market} 현재 가격 rows ${fmtNum(priceRows)}개와 링크/KPI ${fmtNum(linkCount)}개를 봅니다. 비교 축은 ${contrast?.label || "비교 안건"}이며, Spot/Contract 전이가 확인될 때만 고객·가격 재협상으로 전환합니다.`,
      },
      {
        id: "audit",
        initials: "AU",
        name: "Data Auditor",
        title: "Evidence Gatekeeper",
        role: "팩트 검증·중복 제거",
        color: "#EF4444",
        stance: "근거 게이트",
        message: `${profile.audit} sourceUrl, 뉴스 link, 가격 row 중 하나도 없으면 관계 그래프와 사실 카드에 올리지 않습니다. 중복 기사는 canonical link 기준으로 1건만 반영합니다.`,
      },
    ];
  }

  function cLevelCouncilConclusion(decision = {}) {
    const evidence = decision.evidenceCount || 0;
    const confidence = Math.round(decision.confidence || 0);
    const verdict = decision.verdict || "Hold";
    const action = decision.action || "추가 근거 수집";
    const profile = cLevelDecisionProfile(decision);
    const direction = verdict === "Go"
      ? "경영진 안건으로 상정"
      : verdict === "Watch"
        ? "조건 충족 전까지 모니터링"
        : "의사결정 보류";
    return {
      title: `${verdict} · ${direction}`,
      body: `질문: "${profile.question}" 결론: 검증 근거 ${fmtNum(evidence)}개와 신뢰도 ${fmtNum(confidence)}/100 기준으로 ${direction}이 적절합니다.`,
      next: `다음 액션: ${action}. ${profile.next}`,
    };
  }

  function renderCLevelCockpit() {
    const grid = $("#cLevelDecisionGrid");
    const agents = $("#cLevelAgentGrid");
    if (!grid || !agents) return;

    const decisions = cLevelDecisionItems();

    if (!decisions.length) {
      grid.innerHTML = `
        <article class="empty-card">
          <strong>선택한 필터에서 검증 가능한 근거가 없습니다.</strong>
          <p>전체 필터로 전환하거나 다음 크롤링 이후 sourceUrl/link/가격 row가 들어온 항목만 의사결정 보드에 표시합니다.</p>
        </article>
      `;
      agents.innerHTML = "";
      return;
    }

    if (!decisions.some((item) => item.id === cLevelCouncilDecisionId)) {
      cLevelCouncilDecisionId = (decisions.find((item) => item.id === "legacy-commodity") || decisions[0]).id;
      cLevelCouncilRan = false;
    }
    const selectedDecision = decisions.find((item) => item.id === cLevelCouncilDecisionId) || decisions[0];

    grid.innerHTML = decisions.map((item, index) => `
      <button class="c-level-card ${escapeHTML(item.verdict.toLowerCase())}${item.id === selectedDecision.id ? " council-active" : ""} reveal" type="button" data-council-pick="${escapeHTML(item.id)}" style="--local-accent:${categoryAccent(item.category)}; animation-delay:${index * 35}ms">
        <span class="c-level-card-top">
          <em>${escapeHTML(item.owner)}</em>
          ${factBadge(item.verdict, item.verdict === "Go" ? "ok" : item.verdict === "Watch" ? "watch" : "fail")}
        </span>
        <strong>${escapeHTML(item.label)}</strong>
        <p>${escapeHTML(item.action)}</p>
        <div class="c-level-card-metrics">
          <span><b>${countHTML(item.evidenceCount)}</b><small>근거</small></span>
          <span><b>${countHTML(item.linkCount)}</b><small>링크/KPI</small></span>
          <span><b>${countHTML(item.priceRows)}</b><small>가격 rows</small></span>
        </div>
        <div class="c-level-meter" data-fill-to="${item.confidence}"><i style="width:0"></i></div>
        <small>${escapeHTML(item.tone)} · 신뢰도 ${fmtNum(Math.round(item.confidence))}/100</small>
      </button>
    `).join("");

    const agentItems = cLevelAgentItems(selectedDecision, decisions);
    const conclusion = cLevelCouncilConclusion(selectedDecision);
    const selectedProfile = cLevelDecisionProfile(selectedDecision);
    const rosterStepDelay = 120;
    const chatStartDelay = agentItems.length * rosterStepDelay + 720;
    const councilStepDelay = 820;
    const councilConclusionDelay = chatStartDelay + agentItems.length * councilStepDelay + 760;
    agents.innerHTML = `
      <div class="agent-debate c-level-agent-debate" style="--local-accent:${categoryAccent(selectedDecision?.category || "hbm")}">
        <div class="agent-debate-title">
          <span>EXPERT AGENTS</span>
          <strong>${escapeHTML(selectedDecision?.label || "경영진 안건")} 토론</strong>
        </div>
        <div class="c-level-agent-controls">
          <label>
            <span>안건 선택</span>
            <select id="cLevelCouncilSelect" aria-label="전문가 에이전트 토론 안건 선택">
              ${decisions.map((item) => `<option value="${escapeHTML(item.id)}"${item.id === selectedDecision.id ? " selected" : ""}>${escapeHTML(item.label)} · ${escapeHTML(item.verdict)} · 근거 ${fmtNum(item.evidenceCount)}개</option>`).join("")}
            </select>
          </label>
          <button type="button" id="cLevelRunCouncil">${cLevelCouncilRan ? "토론 다시 실행" : "에이전트 실행"}</button>
        </div>
        <div class="agent-selected-brief">
          <span>선택 안건</span>
          <strong>${escapeHTML(selectedDecision?.label || "안건")}</strong>
          <p>${escapeHTML(`질문: "${selectedProfile.question}"`)}</p>
          <small>${escapeHTML(selectedDecision?.verdict || "Hold")} · 근거 ${fmtNum(selectedDecision?.evidenceCount || 0)}개 · 신뢰도 ${fmtNum(Math.round(selectedDecision?.confidence || 0))}/100</small>
        </div>
        ${cLevelCouncilRan ? `
          <div class="agent-roster">
            ${agentItems.map((agent, index) => `
              <div class="agent-avatar-card" style="--agent-color:${escapeHTML(agent.color)}; --delay:${index * rosterStepDelay}ms">
                <div class="agent-person">
                  <b>${escapeHTML(agent.initials || agent.id.toUpperCase().slice(0, 2))}</b>
                  <i aria-hidden="true"></i>
                </div>
                <span>${escapeHTML(agent.name)}</span>
                <small>${escapeHTML(agent.title || agent.role)}</small>
                <em>${escapeHTML(agent.stance || agent.role)}</em>
              </div>
            `).join("")}
          </div>
          <div class="agent-chat" style="--chat-delay:${chatStartDelay}ms">
            ${agentItems.map((agent, index) => `
              <div class="agent-turn${index % 2 ? " right" : ""}" style="--agent-color:${escapeHTML(agent.color)}; --delay:${chatStartDelay + index * councilStepDelay}ms">
                <span class="agent-badge">${escapeHTML(agent.initials || agent.id.toUpperCase().slice(0, 2))}</span>
                <div class="speech-bubble">
                  <div class="speech-meta"><strong>${escapeHTML(agent.name)}</strong><span>${escapeHTML(agent.role)}</span></div>
                  <p>${escapeHTML(agent.message)}</p>
                </div>
              </div>
            `).join("")}
          </div>
          <div class="agent-conclusion reveal" style="--local-accent:${categoryAccent(selectedDecision?.category || "hbm")}; --delay:${councilConclusionDelay}ms">
            <span>결론</span>
            <strong>${escapeHTML(conclusion.title)}</strong>
            <p>${escapeHTML(conclusion.body)}</p>
            <small>${escapeHTML(conclusion.next)}</small>
          </div>
        ` : `
          <div class="agent-waiting">
            <strong>안건을 선택한 뒤 에이전트 실행을 누르세요.</strong>
            <p>실행 전에는 에이전트를 호출하지 않습니다. 실행 후 실제 연결 근거 기준으로 CEO, CFO, CTO, 정책, 시장, 감사 에이전트가 순서대로 발언합니다.</p>
          </div>
        `}
      </div>
    `;

    const councilSelect = $("#cLevelCouncilSelect");
    if (councilSelect) {
      const chooseCouncilAgenda = (event) => {
        cLevelCouncilDecisionId = event.target.value;
        cLevelCouncilRan = false;
        renderCLevelCockpit();
      };
      councilSelect.addEventListener("input", chooseCouncilAgenda);
      councilSelect.addEventListener("change", chooseCouncilAgenda);
    }
    const runCouncil = $("#cLevelRunCouncil");
    if (runCouncil) {
      runCouncil.addEventListener("click", () => {
        cLevelCouncilRan = true;
        renderCLevelCockpit();
      });
    }
    grid.querySelectorAll("[data-council-pick]").forEach((btn) => {
      btn.addEventListener("click", () => {
        cLevelCouncilDecisionId = btn.dataset.councilPick;
        cLevelCouncilRan = false;
        renderCLevelCockpit();
      });
    });

    animateCounts(grid);
    animateMeters(grid);
  }

  function memoryMarketNodes() {
    return [
      { id: "skhy", name: "SKHY", role: "HBM·DRAM·NAND", category: "hbm", x: 46, y: 48 },
      { id: "samsung", name: "Samsung", role: "HBM·DRAM·NAND", category: "hbm", x: 24, y: 24 },
      { id: "micron", name: "Micron", role: "HBM·DRAM", category: "dram", x: 72, y: 24 },
      { id: "cxmt", name: "CXMT", role: "중국 DRAM", category: "dram", x: 20, y: 70 },
      { id: "ymtc", name: "YMTC", role: "중국 NAND/eSSD", category: "nand", x: 70, y: 72 },
      { id: "kioxia-sandisk", name: "Kioxia·SanDisk", role: "NAND peer", category: "nand", x: 88, y: 50 },
      { id: "nvidia-ai", name: "NVIDIA·AI 고객", role: "AI 서버 수요", category: "aidemand", x: 48, y: 12 },
      { id: "tsmc", name: "TSMC", role: "HBM4 base die", category: "packaging", x: 10, y: 42 },
      { id: "jcet-xmc", name: "JCET·XMC", role: "첨단 패키징", category: "packaging", x: 42, y: 88 },
      { id: "naura-amec", name: "Naura·AMEC", role: "장비 국산화", category: "equipment", x: 10, y: 88 },
      { id: "china-fund", name: "Big Fund·지방정부", role: "정책 자본", category: "geopolitics", x: 90, y: 86 },
      { id: "china-cloud", name: "중국 클라우드/OEM", role: "내수 고객", category: "china", x: 92, y: 16 },
      { id: "solidigm", name: "Solidigm", role: "eSSD·Dalian", category: "operations", x: 62, y: 92 },
      { id: "cxl-startups", name: "CXL·Photonics 후보", role: "옵션 투자", category: "cxl", x: 30, y: 8 },
    ];
  }

  function memoryMarketEdges() {
    return [
      { id: "skhy-samsung-hbm", mode: "competitive", from: "skhy", to: "samsung", type: "경쟁", label: "HBM4·AI 서버 경쟁", terms: ["sk hynix", "skhy", "samsung", "hbm", "hbm4", "ai memory"], categories: ["hbm", "aidemand"], weight: 82 },
      { id: "skhy-micron-hbm", mode: "competitive", from: "skhy", to: "micron", type: "경쟁", label: "HBM·DDR5·서버 DRAM 경쟁", terms: ["sk hynix", "skhy", "micron", "hbm", "ddr5", "server dram"], categories: ["hbm", "dram"], weight: 76 },
      { id: "skhy-cxmt-dram", mode: "competitive", from: "skhy", to: "cxmt", type: "경쟁", label: "범용 DRAM 가격 하방 압력", terms: ["cxmt", "changxin", "dram", "ddr5", "ddr4", "lpddr", "tencent"], categories: ["dram", "china"], weight: 88 },
      { id: "skhy-ymtc-nand", mode: "competitive", from: "skhy", to: "ymtc", type: "경쟁", label: "NAND/eSSD 고객 침투 경쟁", terms: ["ymtc", "yangtze", "nand", "ssd", "essd", "xtacking", "solidigm"], categories: ["nand", "china", "aidemand"], weight: 84 },
      { id: "kioxia-ymtc-nand", mode: "competitive", from: "kioxia-sandisk", to: "ymtc", type: "경쟁", label: "3D NAND 세대·원가 경쟁", terms: ["kioxia", "sandisk", "ymtc", "3d nand", "bics", "xtacking"], categories: ["nand"], weight: 66 },
      { id: "skhy-tsmc-hbm4", mode: "competitive", from: "skhy", to: "tsmc", type: "파트너십", label: "HBM4 base die·패키징 협력", terms: ["sk hynix", "skhy", "tsmc", "hbm4", "base die", "cowos"], categories: ["hbm", "packaging"], weight: 72 },
      { id: "skhy-nvidia-supply", mode: "competitive", from: "skhy", to: "nvidia-ai", type: "공급", label: "AI 서버 HBM 공급 락인", terms: ["nvidia", "hbm", "rubin", "ai server", "sk hynix", "skhy"], categories: ["hbm", "aidemand"], weight: 90 },
      { id: "cxmt-china-cloud-supply", mode: "competitive", from: "cxmt", to: "china-cloud", type: "공급", label: "중국 빅테크 서버 DRAM 공급", terms: ["cxmt", "tencent", "alibaba", "bytedance", "server dram", "contract"], categories: ["dram", "china"], weight: 86 },
      { id: "ymtc-china-oem-supply", mode: "competitive", from: "ymtc", to: "china-cloud", type: "공급", label: "중국 OEM·eSSD 공급 확대", terms: ["ymtc", "essd", "ssd", "smartphone", "server", "china oem"], categories: ["nand", "china"], weight: 76 },
      { id: "naura-amec-cxmt", mode: "competitive", from: "naura-amec", to: "cxmt", type: "공급", label: "DRAM 장비 국산화 공급", terms: ["naura", "amec", "cxmt", "equipment", "etch", "deposition"], categories: ["equipment", "dram", "china"], weight: 70 },
      { id: "naura-amec-ymtc", mode: "competitive", from: "naura-amec", to: "ymtc", type: "공급", label: "NAND 장비 qual·내재화", terms: ["naura", "amec", "ymtc", "wuhan", "equipment", "localization"], categories: ["equipment", "nand", "china"], weight: 74 },
      { id: "fund-cxmt-competitive", mode: "competitive", from: "china-fund", to: "cxmt", type: "투자", label: "IPO·지방정부 캐파 자금", terms: ["cxmt", "ipo", "fund", "big fund", "capacity", "wpm"], categories: ["dram", "geopolitics", "china"], weight: 76 },
      { id: "fund-ymtc-competitive", mode: "competitive", from: "china-fund", to: "ymtc", type: "투자", label: "우한 클러스터·NAND 증설 자금", terms: ["ymtc", "wuhan", "phase 3", "big fund", "capacity", "investment"], categories: ["nand", "geopolitics", "china"], weight: 76 },
      { id: "skhy-ai-revenue", mode: "money", from: "nvidia-ai", to: "skhy", type: "매출", label: "HBM·AI 서버 매출 노출", terms: ["nvidia", "hbm", "ai server", "sk hynix", "skhy", "rubin"], categories: ["hbm", "aidemand"], weight: 94, flowIndex: 92 },
      { id: "china-cloud-cxmt-revenue", mode: "money", from: "china-cloud", to: "cxmt", type: "매출", label: "중국 서버 DRAM 장기계약 매출", terms: ["cxmt", "tencent", "server dram", "contract", "alibaba", "bytedance"], categories: ["dram", "china"], weight: 88, flowIndex: 84 },
      { id: "china-oem-ymtc-revenue", mode: "money", from: "china-cloud", to: "ymtc", type: "매출", label: "중국 eSSD·스마트폰 NAND 매출", terms: ["ymtc", "essd", "ssd", "smartphone", "nand", "oem"], categories: ["nand", "china"], weight: 78, flowIndex: 76 },
      { id: "fund-cxmt-money", mode: "money", from: "china-fund", to: "cxmt", type: "투자", label: "CXMT IPO·캐파 확대 자금", terms: ["cxmt", "ipo", "funding", "big fund", "capacity", "wpm"], categories: ["dram", "china", "geopolitics"], weight: 82, flowIndex: 80 },
      { id: "fund-ymtc-money", mode: "money", from: "china-fund", to: "ymtc", type: "투자", label: "YMTC 우한 Phase 3·장비 내재화", terms: ["ymtc", "wuhan", "phase 3", "investment", "big fund", "equipment"], categories: ["nand", "equipment", "geopolitics"], weight: 80, flowIndex: 78 },
      { id: "skhy-wuxi-dalian-invest", mode: "money", from: "skhy", to: "solidigm", type: "투자", label: "Dalian·Solidigm value-up 투자", terms: ["sk hynix", "skhy", "solidigm", "dalian", "nand", "ssd", "investment"], categories: ["nand", "operations"], weight: 70, flowIndex: 68 },
      { id: "skhy-tsmc-invest", mode: "money", from: "skhy", to: "tsmc", type: "투자", label: "HBM4 로직·패키징 외부 생태계 지출", terms: ["sk hynix", "skhy", "tsmc", "hbm4", "base die", "packaging"], categories: ["hbm", "packaging"], weight: 66, flowIndex: 64 },
      { id: "skhy-startup-option", mode: "money", from: "skhy", to: "cxl-startups", type: "투자", label: "CXL·포토닉스·PIM 옵션 투자", terms: ["cxl", "photonics", "pim", "xconn", "celestial", "ayar", "lightmatter", "xcena", "startup"], categories: ["cxl", "packaging", "aidemand"], weight: 62, flowIndex: 58 },
      { id: "solidigm-essd-revenue", mode: "money", from: "china-cloud", to: "solidigm", type: "매출", label: "eSSD 고객 방어 매출", terms: ["solidigm", "essd", "ssd", "dalian", "server", "datacenter"], categories: ["nand", "aidemand", "operations"], weight: 66, flowIndex: 60 },
    ];
  }

  function memoryMarketModeConfig(mode = memoryMarketMode) {
    return mode === "money"
      ? {
          id: "money",
          title: "Money Flow · 돈의 흐름",
          subtitle: "투자와 매출 노출을 분리해 현금이 들어오는 축과 방어 비용이 나가는 축을 추적",
          types: ["투자", "매출"],
          accent: "#F59E0B",
        }
      : {
          id: "competitive",
          title: "Competitive Dynamics",
          subtitle: "경쟁·파트너십·투자·공급 관계를 메모리 시장 맥락으로 인터랙티브하게 비교",
          types: ["경쟁", "파트너십", "투자", "공급"],
          accent: "#38BDF8",
        };
  }

  function memoryMarketTextHasAny(text, terms = []) {
    const hay = String(text || "").toLowerCase();
    return terms.some((term) => hay.includes(String(term || "").toLowerCase()));
  }

  function memoryMarketEdgeTerms(edge = {}) {
    return []
      .concat(edge.terms || [])
      .concat([edge.label, edge.type, edge.from, edge.to])
      .map((term) => String(term || "").toLowerCase())
      .filter(Boolean);
  }

  function memoryMarketEvidenceFor(edge = {}) {
    const terms = memoryMarketEdgeTerms(edge);
    const news = rawNews().filter((item) => {
      const link = String(item.link || item.sourceUrl || "").trim();
      if (!link) return false;
      return memoryMarketTextHasAny(`${item.title || ""} ${item.titleKo || ""} ${item.summary || ""} ${item.source || ""} ${item.category || ""}`, terms);
    });
    const benchmark = (LIVE.benchmarkSignals?.stream || []).filter((item) => {
      const link = String(item.link || item.sourceUrl || "").trim();
      if (!link) return false;
      return memoryMarketTextHasAny(`${item.title || ""} ${item.titleKo || ""} ${item.summary || ""} ${item.source || ""} ${item.theme || ""}`, terms);
    });
    const prices = allPriceRows().filter((row) => memoryMarketTextHasAny(`${row.group || ""} ${row.sectionTitle || ""} ${row.item || ""}`, terms));
    const kpis = (BASE.kpis || []).filter((item) => {
      if (!String(item.sourceUrl || "").trim()) return false;
      return memoryMarketTextHasAny(`${item.label || ""} ${item.note || ""} ${item.alt || ""} ${item.source || ""}`, terms);
    });
    return { news, benchmark, prices, kpis };
  }

  function memoryMarketEvidenceCount(evidence = {}) {
    return (evidence.news || []).length + (evidence.benchmark || []).length + (evidence.prices || []).length + (evidence.kpis || []).length;
  }

  function memoryMarketRelationItem(edge = {}) {
    const evidence = memoryMarketEvidenceFor(edge);
    const evidenceCount = memoryMarketEvidenceCount(evidence);
    const linkCount = evidence.news.length + evidence.benchmark.length + evidence.kpis.length;
    const priceRows = evidence.prices.length;
    const score = clamp((edge.weight || 50) + Math.min(evidenceCount, 40) * 1.2 + priceRows * 2, 8, 100);
    const flowIndex = clamp((edge.flowIndex || edge.weight || 50) + Math.min(linkCount, 24) * 1.1 + priceRows * 1.4, 6, 100);
    return { ...edge, evidence, evidenceCount, linkCount, priceRows, score, flowIndex };
  }

  function memoryMarketRelatedToActive(edge = {}) {
    if (activeCategory === "all") return true;
    return (edge.categories || []).includes(activeCategory);
  }

  function memoryMarketRelations(mode = memoryMarketMode, type = memoryMarketEdgeType) {
    const config = memoryMarketModeConfig(mode);
    return memoryMarketEdges()
      .filter((edge) => edge.mode === config.id)
      .filter((edge) => type === "all" || edge.type === type)
      .filter(memoryMarketRelatedToActive)
      .map(memoryMarketRelationItem)
      .filter((edge) => edge.evidenceCount > 0)
      .sort((a, b) => b.score - a.score || b.evidenceCount - a.evidenceCount);
  }

  function memoryMarketRelationsForTerms(terms = []) {
    const normalized = terms.map((term) => String(term || "").toLowerCase()).filter(Boolean);
    if (!normalized.length) return [];
    return memoryMarketEdges()
      .filter((edge) => memoryMarketTextHasAny(memoryMarketEdgeTerms(edge).join(" "), normalized))
      .map(memoryMarketRelationItem)
      .filter((edge) => edge.evidenceCount > 0)
      .sort((a, b) => b.score - a.score || b.evidenceCount - a.evidenceCount);
  }

  function memoryMarketNodesFor(edges = []) {
    const allNodes = memoryMarketNodes();
    const used = new Set();
    edges.forEach((edge) => {
      used.add(edge.from);
      used.add(edge.to);
    });
    return allNodes
      .filter((node) => used.has(node.id))
      .map((node) => {
        const related = edges.filter((edge) => edge.from === node.id || edge.to === node.id);
        const signal = related.reduce((sum, edge) => sum + edge.evidenceCount, 0);
        const score = related.length ? clamp(related.reduce((sum, edge) => sum + edge.score, 0) / related.length) : 0;
        const position = memoryMarketNodePosition(node.id, node.x, node.y);
        return { ...node, ...position, related, signal, score };
      });
  }

  function memoryMarketEdgeColor(type) {
    return {
      경쟁: "#EF4444",
      파트너십: "#3B82F6",
      투자: "#10B981",
      공급: "#F59E0B",
      매출: "#F97316",
    }[type] || "var(--accent)";
  }

  function memoryMarketNodePosition(id, fallbackX = 50, fallbackY = 50) {
    const saved = memoryMarketNodePositions[id] || {};
    const x = Number(saved.x);
    const y = Number(saved.y);
    return {
      x: clamp(Number.isFinite(x) ? x : fallbackX, 6, 94),
      y: clamp(Number.isFinite(y) ? y : fallbackY, 7, 93),
    };
  }

  function persistMemoryMarketNodePositions() {
    try {
      localStorage.setItem("memory-market-node-positions", JSON.stringify(memoryMarketNodePositions));
    } catch (error) {
      // Ignore storage failures; drag still works for the current render.
    }
  }

  function updateMemoryNetworkPositions(graph = $("#memoryMarketGraph")) {
    if (!graph) return;
    const positions = new Map();
    graph.querySelectorAll(".memory-node[data-memory-node]").forEach((node) => {
      const id = node.dataset.memoryNode;
      const x = clamp(Number(node.dataset.nodeX), 6, 94);
      const y = clamp(Number(node.dataset.nodeY), 7, 93);
      if (!id || !Number.isFinite(x) || !Number.isFinite(y)) return;
      positions.set(id, { x, y });
      node.style.setProperty("--node-x", `${x}%`);
      node.style.setProperty("--node-y", `${y}%`);
    });
    graph.querySelectorAll(".memory-edge[data-from][data-to]").forEach((path) => {
      const from = positions.get(path.dataset.from);
      const to = positions.get(path.dataset.to);
      if (!from || !to) return;
      path.setAttribute("d", `M ${from.x} ${from.y} L ${to.x} ${to.y}`);
    });
  }

  function bindMemoryMarketNodeDrag(graph = $("#memoryMarketGraph")) {
    const network = graph?.querySelector(".memory-network");
    if (!graph || !network) return;
    let dragState = null;
    const finishDrag = (event) => {
      if (!dragState) return;
      const { node, id, pointerId, moved } = dragState;
      try {
        if (node.hasPointerCapture?.(pointerId)) node.releasePointerCapture(pointerId);
      } catch (error) {
        // Ignore capture release failures from canceled pointer streams.
      }
      node.classList.remove("dragging");
      network.classList.remove("drag-active");
      if (moved) {
        node.dataset.dragMoved = "1";
        persistMemoryMarketNodePositions();
        window.setTimeout(() => {
          if (node.dataset.memoryNode === id) delete node.dataset.dragMoved;
        }, 120);
      }
      dragState = null;
    };

    graph.querySelectorAll(".memory-node[data-memory-node]").forEach((node) => {
      node.addEventListener("pointerdown", (event) => {
        if (event.button != null && event.button !== 0) return;
        const id = node.dataset.memoryNode;
        if (!id) return;
        dragState = {
          id,
          node,
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          moved: false,
        };
        node.setPointerCapture?.(event.pointerId);
        node.classList.add("dragging");
        network.classList.add("drag-active");
      });
      node.addEventListener("pointermove", (event) => {
        if (!dragState || dragState.node !== node) return;
        const rect = network.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const x = clamp(((event.clientX - rect.left) / rect.width) * 100, 6, 94);
        const y = clamp(((event.clientY - rect.top) / rect.height) * 100, 7, 93);
        const movedDistance = Math.abs(event.clientX - dragState.startX) + Math.abs(event.clientY - dragState.startY);
        dragState.moved = dragState.moved || movedDistance > 3;
        node.dataset.nodeX = x.toFixed(2);
        node.dataset.nodeY = y.toFixed(2);
        memoryMarketNodePositions[dragState.id] = { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) };
        updateMemoryNetworkPositions(graph);
        event.preventDefault();
      });
      node.addEventListener("pointerup", finishDrag);
      node.addEventListener("pointercancel", finishDrag);
    });
  }

  function memoryMarketSelected(edges = [], nodes = []) {
    if (memoryMarketFocusId.startsWith("node:")) {
      const node = nodes.find((item) => `node:${item.id}` === memoryMarketFocusId);
      if (node) return { kind: "node", node };
    }
    if (memoryMarketFocusId.startsWith("edge:")) {
      const edge = edges.find((item) => `edge:${item.id}` === memoryMarketFocusId);
      if (edge) return { kind: "edge", edge };
    }
    const fallback = edges[0];
    memoryMarketFocusId = fallback ? `edge:${fallback.id}` : "";
    return fallback ? { kind: "edge", edge: fallback } : null;
  }

  function memoryMarketEvidenceLinks(edge = {}, limit = 4) {
    const links = []
      .concat((edge.evidence?.news || []).map((item) => ({ ...item, kind: "뉴스" })))
      .concat((edge.evidence?.benchmark || []).map((item) => ({ ...item, kind: "벤치마킹" })))
      .concat((edge.evidence?.kpis || []).map((item) => ({ ...item, kind: "KPI", title: item.label, link: item.sourceUrl })))
      .filter((item) => String(item.link || item.sourceUrl || "").trim());
    const seen = new Set();
    return links.filter((item) => {
      const key = String(item.link || item.sourceUrl || item.title || "").toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, limit);
  }

  function renderMemoryMarketDetail(selected, edges = []) {
    const detail = $("#memoryMarketDetail");
    if (!detail) return;
    if (!selected) {
      detail.innerHTML = `<div class="empty">관계 신호가 없습니다.</div>`;
      return;
    }

    if (selected.kind === "node") {
      const node = selected.node;
      detail.style.setProperty("--local-accent", categoryAccent(node.category));
      detail.innerHTML = `
        <div class="memory-detail-head">
          <span>${escapeHTML(node.role)}</span>
          <h3>${escapeHTML(node.name)}</h3>
          <p>${escapeHTML(categoryName(node.category))} 축에서 연결된 경쟁·투자·공급·매출 관계를 집계합니다.</p>
        </div>
        <div class="metric-row">
          ${metricCards([
            { label: "관계", value: fmtNum(node.related.length) },
            { label: "근거", value: fmtNum(node.signal) },
            { label: "점수", value: fmtNum(Math.round(node.score)) },
          ], 3)}
        </div>
        <div class="memory-relation-list">
          ${node.related.slice(0, 6).map((edge) => `
            <button type="button" data-memory-edge="${escapeHTML(edge.id)}" style="--edge-color:${memoryMarketEdgeColor(edge.type)}">
              <strong>${escapeHTML(edge.from === node.id ? `${node.name} → ${memoryMarketNodeName(edge.to)}` : `${memoryMarketNodeName(edge.from)} → ${node.name}`)}</strong>
              <span>${escapeHTML(edge.type)} · ${escapeHTML(edge.label)} · 근거 ${fmtNum(edge.evidenceCount)}</span>
            </button>
          `).join("")}
        </div>
      `;
    } else {
      const edge = selected.edge;
      const links = memoryMarketEvidenceLinks(edge, 5);
      detail.style.setProperty("--local-accent", memoryMarketEdgeColor(edge.type));
      detail.innerHTML = `
        <div class="memory-detail-head">
          <span>${escapeHTML(edge.type)}</span>
          <h3>${escapeHTML(memoryMarketNodeName(edge.from))} → ${escapeHTML(memoryMarketNodeName(edge.to))}</h3>
          <p>${escapeHTML(edge.label)}</p>
        </div>
        <div class="metric-row">
          ${metricCards([
            { label: "근거", value: fmtNum(edge.evidenceCount) },
            { label: "링크", value: fmtNum(edge.linkCount) },
            { label: "가격 rows", value: fmtNum(edge.priceRows) },
          ], 3)}
        </div>
        <div class="memory-flow-readout">
          <div class="scenario-bar-row"><span>${edge.mode === "money" ? "Flow" : "Power"}</span><i><b style="width:${edge.mode === "money" ? edge.flowIndex : edge.score}%"></b></i><em>${fmtNum(Math.round(edge.mode === "money" ? edge.flowIndex : edge.score))}</em></div>
          <div class="scenario-bar-row"><span>Evidence</span><i><b style="width:${clamp(edge.evidenceCount * 5)}%"></b></i><em>${fmtNum(edge.evidenceCount)}</em></div>
        </div>
        <div class="memory-detail-block">
          <strong>의사결정 해석</strong>
          <p>${escapeHTML(edge.mode === "money" ? "투자와 매출 노출을 분리해 실제 계약·가격 근거가 있는 흐름만 CFO 검토 대상으로 올립니다." : "경쟁·파트너십·투자·공급 관계를 구분해 고객 락인, 가격 방어, 제휴 우선순위를 판단합니다.")}</p>
        </div>
        ${links.length ? `
          <div class="memory-detail-block">
            <strong>연결 근거</strong>
            <ul class="work-link-list">
              ${links.map((item) => `<li><a href="${escapeHTML(item.link || item.sourceUrl)}" target="_blank" rel="noopener">${escapeHTML(item.kind || "근거")} · ${escapeHTML(newsTitle(item) || item.title || item.source || "Signal")}</a></li>`).join("")}
            </ul>
          </div>
        ` : ""}
      `;
    }

    detail.querySelectorAll("[data-memory-edge]").forEach((btn) => {
      btn.addEventListener("click", () => {
        memoryMarketFocusId = `edge:${btn.dataset.memoryEdge}`;
        renderMemoryMarketMap();
      });
    });
  }

  function memoryMarketNodeName(id) {
    return memoryMarketNodes().find((node) => node.id === id)?.name || id;
  }

  function renderMemoryMarketMap() {
    const tabs = $("#memoryMarketTabs");
    const summary = $("#memoryMarketSummary");
    const graph = $("#memoryMarketGraph");
    const meta = $("#memoryMarketMapMeta");
    if (!tabs || !summary || !graph) return;

    const config = memoryMarketModeConfig(memoryMarketMode);
    const allModeEdges = memoryMarketRelations(memoryMarketMode, "all");
    const edges = memoryMarketRelations(memoryMarketMode, memoryMarketEdgeType);
    const nodes = memoryMarketNodesFor(edges);
    const selected = memoryMarketSelected(edges, nodes);
    const totalEvidence = edges.reduce((sum, edge) => sum + edge.evidenceCount, 0);
    const totalPriceRows = edges.reduce((sum, edge) => sum + edge.priceRows, 0);
    if (meta) meta.textContent = `${config.title} · 관계 ${fmtNum(edges.length)}개 · 근거 ${fmtNum(totalEvidence)}개`;

    tabs.innerHTML = `
      <button type="button" class="${memoryMarketMode === "competitive" ? "active" : ""}" data-memory-mode="competitive">
        <strong>Competitive Dynamics</strong><small>경쟁 · 파트너십 · 투자 · 공급</small>
      </button>
      <button type="button" class="${memoryMarketMode === "money" ? "active" : ""}" data-memory-mode="money">
        <strong>Money Flow · 돈의 흐름</strong><small>투자 · 매출</small>
      </button>
    `;

    const typeCounts = config.types.map((type) => ({
      type,
      count: allModeEdges.filter((edge) => edge.type === type).length,
      evidence: allModeEdges.filter((edge) => edge.type === type).reduce((sum, edge) => sum + edge.evidenceCount, 0),
    }));

    summary.innerHTML = `
      <article class="memory-map-kpi">
        <span>${escapeHTML(config.title)}</span>
        <strong>${countHTML(edges.length)}</strong>
        <small>선택 조건 관계</small>
      </article>
      <article class="memory-map-kpi">
        <span>근거</span>
        <strong>${countHTML(totalEvidence)}</strong>
        <small>뉴스·벤치마킹·가격 rows</small>
      </article>
      <article class="memory-map-kpi">
        <span>가격 rows</span>
        <strong>${countHTML(totalPriceRows)}</strong>
        <small>Spot/Contract 연결</small>
      </article>
      <article class="memory-map-type-filter">
        <span>관계 필터</span>
        <div>
          <button type="button" class="${memoryMarketEdgeType === "all" ? "active" : ""}" data-memory-edge-type="all">전체 · ${fmtNum(allModeEdges.length)}</button>
          ${typeCounts.map((item) => `<button type="button" class="${memoryMarketEdgeType === item.type ? "active" : ""}" data-memory-edge-type="${escapeHTML(item.type)}" style="--edge-color:${memoryMarketEdgeColor(item.type)}">${escapeHTML(item.type)} · ${fmtNum(item.count)}</button>`).join("")}
        </div>
      </article>
    `;

    if (!edges.length) {
      graph.innerHTML = `<div class="empty">선택한 조건에 연결된 근거 있는 관계가 없습니다.</div>`;
      renderMemoryMarketDetail(null, edges);
      return;
    }

    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    graph.innerHTML = `
      <div class="memory-map-intro">
        <div>
          <span>${escapeHTML(config.title)}</span>
          <strong>${escapeHTML(config.subtitle)}</strong>
        </div>
        <div class="memory-map-intro-actions">
          <em>노드를 드래그하여 이동 · 클릭하면 상세 관계 보기</em>
          <button type="button" data-memory-reset>배치 초기화</button>
        </div>
      </div>
      <div class="memory-network">
        <svg class="memory-network-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          ${edges.map((edge, index) => {
            const from = nodeMap.get(edge.from);
            const to = nodeMap.get(edge.to);
            if (!from || !to) return "";
            const active = selected?.kind === "edge" && selected.edge.id === edge.id;
            return `<path class="memory-edge ${active ? "active" : ""}" data-memory-edge="${escapeHTML(edge.id)}" data-from="${escapeHTML(edge.from)}" data-to="${escapeHTML(edge.to)}" d="M ${from.x} ${from.y} L ${to.x} ${to.y}" style="--edge-color:${memoryMarketEdgeColor(edge.type)}; --delay:${index * 80}ms; --edge-width:${Math.max(1.2, Math.min(4.8, edge.score / 24))}" />`;
          }).join("")}
        </svg>
        <div class="memory-network-legend" aria-label="관계 범례">
          ${config.types.map((type) => `<span style="--edge-color:${memoryMarketEdgeColor(type)}"><i></i>${escapeHTML(type)}</span>`).join("")}
        </div>
        ${nodes.map((node, index) => {
          const active = selected?.kind === "node" && selected.node.id === node.id;
          const nodeSize = Math.round(clamp(74 + (node.score || 0) * .54, 82, 134));
          return `
            <button class="memory-node ${active ? "active" : ""}" type="button" draggable="false" data-memory-node="${escapeHTML(node.id)}" data-node-x="${Number(node.x).toFixed(2)}" data-node-y="${Number(node.y).toFixed(2)}" aria-label="${escapeHTML(node.name)} 관계 노드. 드래그하여 이동" title="드래그하여 이동 · 클릭하여 상세 보기" style="--node-x:${node.x}%; --node-y:${node.y}%; --node-size:${nodeSize}px; --local-accent:${categoryAccent(node.category)}; --delay:${index * 45}ms">
              <b>${escapeHTML(node.name)}</b>
              <span>${escapeHTML(node.role)}</span>
              <em>${fmtNum(node.signal)}</em>
            </button>
          `;
        }).join("")}
        <div class="memory-drag-hint">노드 드래그 · 관계선 클릭 · 원 크기 = 연결 신뢰도</div>
      </div>
      <div class="memory-relation-strip">
        ${edges.slice(0, 8).map((edge, index) => `
          <button class="${selected?.kind === "edge" && selected.edge.id === edge.id ? "active" : ""}" type="button" data-memory-edge="${escapeHTML(edge.id)}" style="--edge-color:${memoryMarketEdgeColor(edge.type)}; animation-delay:${index * 45}ms">
            <span>${escapeHTML(edge.type)}</span>
            <strong>${escapeHTML(memoryMarketNodeName(edge.from))} → ${escapeHTML(memoryMarketNodeName(edge.to))}</strong>
            <small>${escapeHTML(edge.label)} · 근거 ${fmtNum(edge.evidenceCount)}</small>
          </button>
        `).join("")}
      </div>
    `;

    bindMemoryMarketNodeDrag(graph);
    graph.querySelectorAll("[data-memory-node]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.dragMoved === "1") return;
        memoryMarketFocusId = `node:${btn.dataset.memoryNode}`;
        renderMemoryMarketMap();
      });
    });
    graph.querySelectorAll("[data-memory-edge]").forEach((node) => {
      node.addEventListener("click", () => {
        memoryMarketFocusId = `edge:${node.dataset.memoryEdge}`;
        renderMemoryMarketMap();
      });
    });
    tabs.querySelectorAll("[data-memory-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        memoryMarketMode = btn.dataset.memoryMode;
        memoryMarketEdgeType = "all";
        memoryMarketFocusId = "";
        renderMemoryMarketMap();
      });
    });
    summary.querySelectorAll("[data-memory-edge-type]").forEach((btn) => {
      btn.addEventListener("click", () => {
        memoryMarketEdgeType = btn.dataset.memoryEdgeType || "all";
        memoryMarketFocusId = "";
        renderMemoryMarketMap();
      });
    });
    graph.querySelector("[data-memory-reset]")?.addEventListener("click", () => {
      memoryMarketNodePositions = {};
      persistMemoryMarketNodePositions();
      memoryMarketFocusId = "";
      renderMemoryMarketMap();
    });

    renderMemoryMarketDetail(selected, edges);
    animateCounts(summary);
    animateCounts(graph);
    animateMeters(graph);
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
    const visibleCats = Array.from(new Set(items.flatMap((item) => item.linkedCategories || []))).filter(Boolean);
    const topCat = visibleCats.slice(0, 3).map(categoryName).join(" · ") || activeCategoryData()?.label || "전체";
    const cards = [
      { label: "Lens", value: lens.label, note: lens.sub },
      { label: "Visible KPI", value: items.length, note: `${fmtNum(allItems.length)}개 중 선택` },
      { label: "정상 / 관찰", value: `${ok}/${watch}`, note: "출처·전망 버전 상태" },
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

  function numberDashboardItems() {
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
        note: "현재 live.json의 제품·중국 벤치마킹 신호를 제품군별로 재분류",
        badge: "Live input",
        statusClass: "ok",
        source: "live.json",
        sourceDate: fmtDate(LIVE.updatedAt),
        linkedCategories: ["operations", "china"],
      },
    ];
    return visibleItems(baseItems.concat(projectionItems));
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
      overview: {
        value: allPriceRows().length + newsCount,
        unit: "signal",
        status: "Today",
        score: clamp((freshnessScore(priceState, allPriceRows().length) + freshnessScore(newsState, newsCount)) / 2),
        note: "일일 인텔리전스",
      },
      "c-level-cockpit": {
        value: cLevelEvidencePool().length,
        unit: "evidence",
        status: "C-level",
        score: cLevelEvidenceScore(),
        note: "실제 수집 근거 기반 전략/의사결정",
      },
      "executive-decision": {
        value: testedBacktests.length,
        unit: `/${backtests.length}`,
        status: "Backtest",
        score: testedBacktests.length ? clamp((hitBacktests.length / testedBacktests.length) * 100, 18, 100) : 18,
        note: "제품군별 실제 가격 백테스트",
      },
      "management-strategy": {
        value: managementStrategyItems().length,
        unit: "방향",
        status: "China Biz",
        score: managementStrategyItems().length ? clamp(managementStrategyItems().reduce((sum, item) => sum + item.score, 0) / managementStrategyItems().length) : 0,
        note: "중국 고객·제품·운영 방향",
      },
      "strategic-investment-decision": {
        value: strategicInvestmentDecisionItems().length,
        unit: "안건",
        status: "Decision",
        score: strategicInvestmentDecisionItems().length ? clamp(strategicInvestmentDecisionItems().reduce((sum, item) => sum + item.score, 0) / strategicInvestmentDecisionItems().length) : 0,
        note: "계약·JV·운영·방어 판단",
      },
      "policy-makers": {
        value: POLICY_MAKER_LENSES.reduce((sum, lens) => sum + (lens.rules || []).length, 0),
        unit: "check",
        status: activePolicyLens().label,
        score: 86,
        note: "중국·한국·미국 정책 방향성",
      },
      "china-fab-infra": {
        value: chinaInfraSignalCount(activeChinaInfraSite()),
        unit: "signal",
        status: activeChinaInfraSite().label,
        score: clamp(52 + chinaInfraSignalCount(activeChinaInfraSite()) * 6, 32, 92),
        note: "토지·용수·전력·환경·BIS 확장성",
      },
      "china-talent-strategy": {
        value: chinaTalentSignalCount(activeChinaTalentScenario()),
        unit: "signal",
        status: activeChinaTalentScenario().label,
        score: clamp(58 + chinaTalentSignalCount(activeChinaTalentScenario()) * 3, 34, 94),
        note: "채용·리텐션·IP·컴플라이언스",
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
      "memory-market-map": {
        value: memoryMarketRelations("competitive", "all").length + memoryMarketRelations("money", "all").length,
        unit: "관계",
        status: "Dynamics",
        score: clamp(46 + (memoryMarketRelations("competitive", "all").length + memoryMarketRelations("money", "all").length) * 4, 28, 100),
        note: "경쟁·파트너십·투자·공급·매출 흐름",
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
      response: {
        value: (BASE.responses || []).filter((item) => relatedToActive({ ...item, linkedCategories: responseLinkedCategories(item) })).length,
        unit: "액션",
        status: "Action",
        score: 76,
        note: "SKHY 대응 체크리스트",
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
    const items = ["projection", "china-nand"].map(sectionTelemetry);
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
    memoryCategories()
      .filter((cat) => cat.id !== "all")
      .map((cat) => ({ cat, stats: categoryStats(cat.id) }))
      .filter(({ stats }) => (stats.companies + stats.news + stats.prices) > 0)
      .forEach(({ cat, stats }, index) => {
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

  const CATEGORY_DECISION_POINTS = {
    dram: "서버 DRAM 가격·캐파 배분",
    nand: "eSSD·Solidigm 고객 방어",
    packaging: "XMC·JCET 패키징 우회 대응",
    equipment: "소부장 JV·IP 게이트",
    talent: "핵심 인재·공정 IP 방어",
    geopolitics: "수출통제·BIS/VEU 시나리오",
    hbm: "HBM 고객 락인·패키징 병목",
    cxl: "CXL/PIM 옵션 투자",
    aidemand: "AI 서버·eSSD 믹스 전환",
    operations: "다롄/Solidigm 운영 전환",
  };
  const PRICE_DECISION_CATEGORIES = new Set(["dram", "nand", "hbm", "aidemand"]);

  function categoryPriceEvidence(cat = {}) {
    const id = cat.id;
    const terms = (cat.keywords || []).map((term) => String(term).toLowerCase()).filter(Boolean);
    return allPriceRows().filter((row) => {
      const hay = `${row.group || ""} ${row.sectionTitle || ""} ${row.item || ""}`.toLowerCase();
      if (id === "dram") return /dram|ddr|lpddr|gddr|module/.test(hay);
      if (id === "nand") return /nand|ssd|flash|wafer|ufs|emmc|card/.test(hay);
      if (id === "hbm") return /dram|ddr5|gddr|module/.test(hay);
      if (id === "aidemand") return /dram|ddr5|nand|ssd|module/.test(hay);
      return terms.some((term) => hay.includes(term));
    });
  }

  function categoryDecisionRows(backtests = executiveBacktests()) {
    const strategies = managementStrategyItems();
    const decisions = strategicInvestmentDecisionItems();
    return memoryCategories().filter((cat) => cat.id !== "all").map((cat) => {
      const newsItems = filteredNews(cat.id);
      const sourceCount = sourceUrlItems(newsItems).length;
      const priceRows = categoryPriceEvidence(cat).length;
      const backtestItems = backtests.filter((item) => item.category === cat.id);
      const testedBacktests = backtestItems.filter((item) => item.outcome.hit !== null || item.observations.length);
      const relatedStrategies = strategies.filter((item) => (item.linkedCategories || []).includes(cat.id));
      const relatedDecisions = decisions.filter((item) => {
        const cats = (item.linkedCategories || []).concat(item.strategy?.linkedCategories || []);
        return cats.includes(cat.id);
      });
      const liveCategoryCount = Number(liveNewsCategory(cat.id)?.count ?? liveNewsCategory(cat.id)?.items?.length ?? 0) || 0;
      const benchmarkCount = CHINA_DYNAMIC_AXES
        .filter((axis) => (axis.categoryIds || []).includes(cat.id))
        .reduce((sum, axis) => sum + axisSignalCount(axis), 0);
      const signalCount = liveCategoryCount + benchmarkCount + newsItems.length;
      const needsPrice = PRICE_DECISION_CATEGORIES.has(cat.id);
      const sourceOk = sourceCount >= 3 || newsItems.length >= 8;
      const priceOk = !needsPrice || priceRows > 0 || testedBacktests.length > 0;
      const agendaOk = relatedDecisions.length > 0 || relatedStrategies.length > 0 || testedBacktests.length > 0;
      const verdict = sourceOk && priceOk && agendaOk ? "O" : "X";
      const missing = [];
      if (!sourceOk) missing.push(`원문 링크 3건 미만(${fmtNum(sourceCount)}건)`);
      if (!priceOk) missing.push("가격/proxy 또는 백테스트 부족");
      if (!agendaOk) missing.push("연결된 전략 안건 없음");
      const decision = backtestItems[0]?.decision?.label || relatedDecisions[0]?.stage || (verdict === "O" ? "상정" : "보류");
      return {
        id: cat.id,
        label: cat.label,
        point: CATEGORY_DECISION_POINTS[cat.id] || cat.desc || cat.label,
        verdict,
        decision,
        cls: verdict === "O" ? "ok" : "fail",
        reason: verdict === "O"
          ? `원문 ${fmtNum(sourceCount)}건 · 가격/proxy ${fmtNum(priceRows)} rows · 안건 ${fmtNum(relatedDecisions.length + relatedStrategies.length)}개`
          : missing.join(" · "),
        sourceCount,
        priceRows,
        signalCount,
        backtestCount: testedBacktests.length,
        agendaCount: relatedDecisions.length + relatedStrategies.length,
      };
    });
  }

  function renderCategoryDecisionMatrix(backtests = executiveBacktests()) {
    const target = $("#categoryDecisionMatrix");
    const meta = $("#categoryOxMeta");
    if (!target) return;
    const rows = categoryDecisionRows(backtests);
    const okCount = rows.filter((row) => row.verdict === "O").length;
    const xCount = rows.length - okCount;
    if (meta) {
      meta.textContent = `O ${fmtNum(okCount)}개 · X ${fmtNum(xCount)}개 · 기준: 원문 링크 + 가격/proxy + 연결 안건`;
    }
    target.innerHTML = rows.map((row, index) => `
      <button class="category-ox-card reveal ${row.verdict === "O" ? "go" : "stop"}${row.id === activeCategory ? " active" : ""}" type="button" data-category-ox="${escapeHTML(row.id)}" style="--local-accent:${categoryAccent(row.id)}; animation-delay:${index * 22}ms">
        <span class="ox-mark ${row.verdict === "O" ? "o" : "x"}">${escapeHTML(row.verdict)}</span>
        <div class="category-ox-body">
          <small>${escapeHTML(row.label)}</small>
          <strong>${escapeHTML(row.point)}</strong>
          <p>${escapeHTML(row.reason)}</p>
          <div class="ox-metrics">
            <span>신호 ${fmtNum(row.signalCount)}</span>
            <span>원문 ${fmtNum(row.sourceCount)}</span>
            <span>가격 ${fmtNum(row.priceRows)}</span>
            <span>안건 ${fmtNum(row.agendaCount)}</span>
          </div>
        </div>
        <em>${escapeHTML(row.verdict === "O" ? "의사결정 상정" : "보류/데이터 보강")}</em>
      </button>
    `).join("");
    target.querySelectorAll("[data-category-ox]").forEach((btn) => {
      btn.addEventListener("click", () => setCategory(btn.dataset.categoryOx));
    });
  }

  function benchmarkSignalTotal() {
    return Number(LIVE.benchmarkSignals?.stats?.total ?? LIVE.benchmarkSignals?.stream?.length ?? 0) || 0;
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
    return (LIVE.benchmarkSignals?.themes || []).find((theme) => theme.id === id && hasPositiveCount(theme)) || null;
  }

  function liveNewsCategory(id) {
    return (LIVE.categories || []).find((category) => category.id === id && hasPositiveCount(category)) || null;
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
    if (meta) meta.textContent = `${fmtNum(totalSignals)}개 신호 · ${fmtDate(LIVE.updatedAt)}`;

    summary.innerHTML = "";
    summary.hidden = true;

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

  function backtestYearOptions() {
    // Real crawled history at month granularity → past decision points expand
    // automatically as the daily crawler accumulates price-history (no fabrication).
    const months = new Map();
    historyItems().forEach((series) => {
      (series.points || []).forEach((point) => {
        const t = pointTime(point);
        if (!t) return;
        const d = new Date(t);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const current = months.get(key) || { value: key, year: String(d.getFullYear()), month: d.getMonth() + 1, firstTime: t, lastTime: t, count: 0 };
        current.firstTime = Math.min(current.firstTime, t);
        current.lastTime = Math.max(current.lastTime, t);
        current.count += 1;
        months.set(key, current);
      });
    });
    return Array.from(months.values())
      .sort((a, b) => a.firstTime - b.firstTime)
      .map((item) => ({
        ...item,
        label: `${item.year}년 ${item.month}월`,
        benchmarkIso: new Date(item.firstTime).toISOString(),
      }));
  }

  function ensureBacktestYear() {
    const options = backtestYearOptions();
    if (!options.length) {
      selectedBacktestYear = "";
      return null;
    }
    if (!options.some((item) => item.value === selectedBacktestYear)) {
      selectedBacktestYear = options[options.length - 1]?.value || options[0].value;
    }
    return selectedBacktestYear;
  }

  function selectedBacktestYearOption() {
    const year = ensureBacktestYear();
    return backtestYearOptions().find((item) => item.value === year) || null;
  }

  function selectedBacktestIso() {
    return selectedBacktestYearOption()?.benchmarkIso || null;
  }

  function selectedExecProductLabel() {
    if (selectedExecProductId === "all") return "전체 제품군";
    return EXEC_DECISION_PRODUCTS.find((item) => item.id === selectedExecProductId)?.label || "전체 제품군";
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
        logic: "기준일 이전 가격 포인트 부족 · 당시 판단 생성 불가",
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
    if (priorMomentum >= 0.55) return { label: "확대", cls: "expand", action: "캐파·고객 락인", logic: "기준일까지 실제 가격 모멘텀 양수 · 성장 제품군 확대 판단" };
    if (priorMomentum <= -0.45) return { label: "보수", cls: "defend", action: "가격 방어", logic: "기준일까지 가격 약세 확인 · 보수적 공급/가격 관리 필요" };
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

  function productBacktest(product, selectedIso = selectedBacktestIso()) {
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
    ensureBacktestYear();
    const selected = selectedBacktestIso();
    return EXEC_DECISION_PRODUCTS.map((product) => productBacktest(product, selected));
  }

  function decisionClassLabel(item) {
    if (!item.observations.length) return "데이터 부족";
    return `${fmtNum(item.observations.length)}개 품목 · ${fmtNum(item.confidence)}점`;
  }

  function renderBacktestControls() {
    const yearSelect = $("#backtestYearSelect");
    const productSelect = $("#execProductSelect");
    const yearOptions = backtestYearOptions();
    ensureBacktestYear();
    if (yearSelect) {
      yearSelect.innerHTML = yearOptions.length ? yearOptions.map((option) => `
        <option value="${escapeHTML(option.value)}"${option.value === selectedBacktestYear ? " selected" : ""}>${escapeHTML(option.label)}</option>
      `).join("") : `<option value="">가격 히스토리 없음</option>`;
      yearSelect.onchange = () => {
        selectedBacktestYear = yearSelect.value;
        execDecisionCouncilRan = false;
        renderExecutiveDecision();
      };
    }
    if (productSelect) {
      const productOptions = [{ id: "all", label: "전체 제품군", demand: "All" }].concat(EXEC_DECISION_PRODUCTS);
      if (!productOptions.some((item) => item.id === selectedExecProductId)) selectedExecProductId = "all";
      productSelect.innerHTML = productOptions.map((option) => `
        <option value="${escapeHTML(option.id)}"${option.id === selectedExecProductId ? " selected" : ""}>${escapeHTML(option.label)}${option.demand && option.id !== "all" ? ` · ${escapeHTML(option.demand)}` : ""}</option>
      `).join("");
      productSelect.onchange = () => {
        selectedExecProductId = productSelect.value;
        if (selectedExecProductId !== "all") execDecisionFocusId = selectedExecProductId;
        execDecisionCouncilRan = false;
        renderExecutiveDecision();
      };
    }
  }

  function executiveBacktestsForSelection() {
    const allItems = executiveBacktests();
    if (selectedExecProductId === "all") return allItems;
    const selected = allItems.filter((item) => item.id === selectedExecProductId);
    if (!selected.length) {
      selectedExecProductId = "all";
      return allItems;
    }
    return selected;
  }

  function agentInitials(name = "Agent") {
    return String(name)
      .split(/[\s/·]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0))
      .join("")
      .slice(0, 3)
      .toUpperCase() || "A";
  }

  function agentDebateHTML({ mode = "default", title = "Agent debate", subtitle = "", metrics = [], turns = [], kpis = [], accent = "" } = {}) {
    const colors = ["#06B6D4", "#8B5CF6", "#22C55E", "#F59E0B", "#EF4444", "#0EA5E9"];
    const normalizedTurns = turns.filter((turn) => turn?.message).slice(0, 7).map((turn, index) => ({
      ...turn,
      color: turn.color || colors[index % colors.length],
      side: turn.side || (index % 2 ? "right" : "left"),
    }));
    const agents = [];
    normalizedTurns.forEach((turn) => {
      if (!agents.some((agent) => agent.name === turn.name)) {
        agents.push({
          name: turn.name,
          role: turn.role,
          avatar: turn.avatar || agentInitials(turn.name),
          color: turn.color,
        });
      }
    });
    const rosterStepDelay = 100;
    const chatStartDelay = agents.length * rosterStepDelay + 620;
    const chatStepDelay = 620;

    return `
      <div class="agent-debate agent-debate-${escapeHTML(mode)}" style="--local-accent:${escapeHTML(accent || colors[0])}">
        <div class="agent-debate-title">
          <span>EXPERT AGENTS</span>
          <strong>${escapeHTML(title)}</strong>
          ${subtitle ? `<small>${escapeHTML(subtitle)}</small>` : ""}
        </div>
        ${metrics.length ? `
          <div class="agent-debate-metrics">
            ${metrics.slice(0, 4).map((metric) => `
              <div>
                <strong>${escapeHTML(metric.value)}</strong>
                <span>${escapeHTML(metric.label)}</span>
              </div>
            `).join("")}
          </div>
        ` : ""}
        <div class="agent-roster" aria-label="토론 참여 전문가">
          ${agents.slice(0, 6).map((agent, index) => `
            <div class="agent-avatar-card" style="--agent-color:${escapeHTML(agent.color)};--delay:${index * rosterStepDelay}ms">
              <b>${escapeHTML(agent.avatar)}</b>
              <span>${escapeHTML(agent.name)}</span>
              <small>${escapeHTML(agent.role || "Expert")}</small>
            </div>
          `).join("")}
        </div>
        <div class="agent-chat" aria-label="전문가 토론 말풍선" style="--chat-delay:${chatStartDelay}ms">
          ${normalizedTurns.map((turn, index) => `
            <article class="agent-turn ${escapeHTML(turn.side)}" style="--agent-color:${escapeHTML(turn.color)};--delay:${chatStartDelay + index * chatStepDelay}ms">
              <div class="agent-badge">${escapeHTML(turn.avatar || agentInitials(turn.name))}</div>
              <div class="speech-bubble">
                <div class="speech-meta">
                  <strong>${escapeHTML(turn.name)}</strong>
                  <span>${escapeHTML(turn.role || "Expert")}</span>
                </div>
                <p>${escapeHTML(turn.message)}</p>
              </div>
            </article>
          `).join("")}
        </div>
        ${kpis.length ? `
          <div class="agent-kpi-row">
            <strong>추적 KPI</strong>
            ${kpis.slice(0, 5).map((kpi) => `<span>${escapeHTML(kpi)}</span>`).join("")}
          </div>
        ` : ""}
      </div>
    `;
  }

  function executiveDecisionProfile(active = {}, selectedYearOption = {}, productLabel = "전체 제품군") {
    const yearLabel = selectedYearOption?.label || "선택 시점 없음";
    const profiles = {
      "hbm-ai-server": {
        question: `${yearLabel} 기준 HBM·AI 서버 제품군을 증설·고객 락인 안건으로 확대할 것인가?`,
        ceo: "AI 서버향은 가격표보다 고객 인증, HBM4 ramp, 패키징 병목이 먼저 의사결정을 좌우합니다.",
        data: "HBM 직접 가격이 없으면 DDR5/GDDR/모듈 가격을 proxy로 쓰고, proxy 여부를 결론에 남깁니다.",
        china: "중국 HBM 신호는 과거 가격을 바꾸지 않고 현재 리스크 overlay로만 둡니다.",
        cfo: "고객 장기계약과 프리미엄 ASP 근거가 붙기 전에는 CAPEX를 확정 재무 ROI로 처리하지 않습니다.",
        risk: "HBM4 고객별 ramp 지연, CoWoS/패키징 병목, 서버 DRAM 약세가 동시에 나오면 확대가 아니라 보수 재검토입니다.",
        strategy: "가격 모멘텀이 양수이고 중국 HBM 실질 양산 신호가 약하면 증설·고객 락인을 우선합니다.",
      },
      "server-dram": {
        question: `${yearLabel} 기준 서버 DRAM 캐파를 장기계약 중심으로 확대할 것인가?`,
        ceo: "서버 DRAM은 HBM 보조축이 아니라 AI 서버 고객 락인의 별도 축입니다.",
        data: "DDR5 spot/contract와 서버 DIMM proxy를 기준점 전후로 나눠 백테스트합니다.",
        china: "CXMT DDR5 캐파와 중국 빅테크 계약은 현재 가격 방어 리스크로 overlay합니다.",
        cfo: "장기계약 ASP와 재고 회전이 확인될 때만 서버향 우선 배분을 예산안으로 넘깁니다.",
        risk: "DDR5 spot이 먼저 꺾이고 contract가 따라가면 가격 방어와 고객별 물량 조정으로 전환합니다.",
        strategy: "가격 상승과 고객 인증이 같이 나오면 서버향 캐파 우선 배분이 적절합니다.",
      },
      "enterprise-ssd": {
        question: `${yearLabel} 기준 eSSD·Solidigm 방어/확대 투자를 집행할 것인가?`,
        ceo: "eSSD는 NAND 가격뿐 아니라 고객 인증, QLC 로드맵, Solidigm value-up을 같이 봐야 합니다.",
        data: "eSSD 전용 가격이 제한적이므로 NAND contract, SSD/OEM SSD proxy를 명시해 사용합니다.",
        china: "YMTC Xtacking, eSSD 인증, 우한 클러스터 신호는 가격 침투 리스크로 overlay합니다.",
        cfo: "NAND contract와 SSD proxy가 동반 개선될 때만 믹스 확대, 약세면 고객 방어 예산으로 제한합니다.",
        risk: "YMTC eSSD 인증 또는 NAND wafer 약세가 확인되면 가격 방어와 고객 장기계약 재협상이 우선입니다.",
        strategy: "Solidigm/Dalian은 유지·매각·value-up 시나리오를 별도로 비교해야 합니다.",
      },
      "mobile-pc-terminal": {
        question: `${yearLabel} 기준 모바일·PC 단말향 제품을 선별 확대할 것인가, 방어할 것인가?`,
        ceo: "단말향은 성장보다 저수익 SKU 정리와 고부가 LPDDR/UFS 선별이 핵심입니다.",
        data: "LPDDR/UFS 직접 가격이 제한적이면 module, SO-DIMM, PC-client SSD, memory card proxy를 사용합니다.",
        china: "CXMT LPDDR와 YMTC client SSD 신호는 단말 가격 하방 overlay로 봅니다.",
        cfo: "가격 개선이 확인된 SKU만 확대하고 약세 품목은 재고·원가 방어로 전환합니다.",
        risk: "client SSD 약세와 중국 범용 제품 공급이 동시에 나오면 저수익 SKU 축소가 우선입니다.",
        strategy: "단말은 전면 확대보다 고객·제품별 선별 배분으로 운영합니다.",
      },
      "auto-edge": {
        question: `${yearLabel} 기준 오토·엣지 메모리를 장기공급 옵션으로 유지할 것인가?`,
        ceo: "오토·엣지는 단기 가격보다 인증, 장기 공급계약, 수요 안정성이 핵심입니다.",
        data: "전용 가격이 부족하면 DRAM/NAND/SSD 전체 방향과 인증 뉴스를 보조 지표로 둡니다.",
        china: "중국 산업용·엣지 AI 신호는 현재 리스크 overlay이며 과거 백테스트에는 넣지 않습니다.",
        cfo: "수익성 방어용 옵션인지 성장 투자안인지 고객 계약 근거로 분리합니다.",
        risk: "범용 가격 약세가 심하면 오토·엣지는 제한 배분하고 인증 중심으로 유지합니다.",
        strategy: "가격 안정과 인증 뉴스가 같이 나올 때만 장기공급계약 옵션을 확대합니다.",
      },
      "legacy-commodity": {
        question: `${yearLabel} 기준 레거시·범용 제품을 유지할 것인가, 방어 축소할 것인가?`,
        ceo: "레거시·범용은 성장 축이 아니라 현금흐름·고객 유지 방어 축입니다.",
        data: "DDR4/eTT/wafer/SSD street 가격을 기준점 전후로 나눠 방어 판단을 검증합니다.",
        china: "CXMT·YMTC 물량 공세는 과거 가격이 아니라 현재 하방 리스크 overlay로 반영합니다.",
        cfo: "가격 하락이 확인되면 저수익 SKU 축소, 재고 회전, cash-cost floor를 우선합니다.",
        risk: "가격 방어 실패는 서버향 믹스 개선 속도까지 늦출 수 있습니다.",
        strategy: "레거시는 상승해도 구조적 성장으로 보지 않고 현금흐름 회수와 재고 정상화에 둡니다.",
      },
      "china-exposure": {
        question: `${yearLabel} 기준 중국 노출·가격 압력을 별도 경영진 리스크 안건으로 올릴 것인가?`,
        ceo: "중국 노출은 제품군 하나가 아니라 DRAM, NAND, 장비, 정책자본이 결합된 리스크입니다.",
        data: "중국 업체별 실적/캐파의 직접 가격 데이터가 없으면 DDR4/eTT/NAND/SSD proxy를 사용합니다.",
        china: "CXMT, YMTC, Naura, AMEC, XMC, JCET 신호를 업체별로 나누고 현재 overlay로만 반영합니다.",
        cfo: "중국 proxy 가격이 하락하면 가격 하방, 고객 침투, 재고 방어 비용을 Bear case에 반영합니다.",
        risk: "정책자본과 wafer start가 늘고 spot/contract가 약해지면 즉시 방어 안건입니다.",
        strategy: "중국 관련 가격 proxy가 좋아져도 확대보다 경쟁 압력 완화 확인에 둡니다.",
      },
    };
    const fallback = {
      question: `${yearLabel} 기준 ${active?.label || productLabel}을 어떤 실행 판단으로 올릴 것인가?`,
      ceo: "제품군별로 확대, 방어, 유지, 데이터 부족을 분리합니다.",
      data: "선택 시점 이후 실제 수집된 가격 관측만 백테스트에 사용합니다.",
      china: "중국 신호는 현재 리스크 overlay로만 반영합니다.",
      cfo: "확정 재무 ROI가 아니라 실사 우선순위로만 사용합니다.",
      risk: "하방 조건이 확인되면 보수적으로 재검토합니다.",
      strategy: "근거가 쌓이면 다음 크롤링에서 판단을 갱신합니다.",
    };
    return profiles[active?.id] || fallback;
  }

  function executiveDecisionAgentItems(active, selectedYearOption, productLabel, selectedIso, selectedSeriesCount) {
    if (!active) return "";
    const actual = active.actualChange == null ? "선택 시점 이후 실측 데이터 부족" : `${active.actualChange > 0 ? "+" : ""}${fmtNum(active.actualChange, 2)}%`;
    const prior = active.priorMomentum == null ? "NA" : `${active.priorMomentum > 0 ? "+" : ""}${fmtNum(active.priorMomentum, 2)}%`;
    const yearLabel = selectedYearOption?.label || "선택 시점 없음";
    const profile = executiveDecisionProfile(active, selectedYearOption, productLabel);
    const point = selectedIso ? pointDateLabel(selectedIso) : "기준점 없음";
    return [
      {
        id: "ceo",
        initials: "CEO",
        name: "CEO Agent",
        title: "Executive Chair",
        role: "의사결정 질문",
        color: "#111827",
        stance: "우선순위",
        message: `질문은 "${profile.question}"입니다. 현재 판단은 ${active.decision.label}이며, ${profile.ceo}`,
      },
      {
        id: "data",
        initials: "DATA",
        name: "Data Agent",
        title: "Backtest & Price Series",
        role: "가격·백테스트",
        color: "#06B6D4",
        stance: "실측 검증",
        message: `${profile.data} ${point} 기준으로 가격 series ${fmtNum(selectedSeriesCount)}개와 관측 ${fmtNum(active.observations.length)}개를 연결했습니다. 사전 모멘텀은 ${prior}, 이후 실측은 ${actual}입니다.`,
      },
      {
        id: "china",
        initials: "CN",
        name: "China Agent",
        title: "China Risk Overlay",
        role: "중국 신호",
        color: "#8B5CF6",
        stance: "현재 리스크",
        message: `${profile.china} 연결된 중국 신호는 ${fmtNum(active.chinaSignalCount)}건이며, 백테스트 결과를 소급 변경하지 않습니다.`,
      },
      {
        id: "cfo",
        initials: "CFO",
        name: "CFO Agent",
        title: "Capital Allocation",
        role: "수익성·자본배분",
        color: "#F59E0B",
        stance: "자본 효율",
        message: `${profile.cfo} 이 판단은 IRR/NPV가 아니라 실사 우선순위입니다. 실행 문구는 '${active.decision.action}'로 제한합니다.`,
      },
      {
        id: "risk",
        initials: "RISK",
        name: "Risk Agent",
        title: "Downside Gate",
        role: "하방 리스크",
        color: "#EF4444",
        stance: "No-Go 조건",
        message: `${profile.risk} 현재 하방 문구는 "${active.downside}"입니다.`,
      },
      {
        id: "strategy",
        initials: "STR",
        name: "Strategy Agent",
        title: "Final Synthesis",
        role: "최종 정리",
        color: "#22C55E",
        stance: "실행 판단",
        message: `${profile.strategy} 대상 제품군은 ${(active.products || []).slice(0, 4).join(" · ") || productLabel}입니다. 근거 없는 수치는 결론에 올리지 않습니다.`,
      },
    ].filter((agent) => agent.message);
  }

  function executiveDecisionCouncilConclusion(active, selectedYearOption, selectedIso) {
    const yearLabel = selectedYearOption?.label || "선택 시점 없음";
    const actual = active?.actualChange == null ? "실측 부족" : `${active.actualChange > 0 ? "+" : ""}${fmtNum(active.actualChange, 2)}%`;
    const prior = active?.priorMomentum == null ? "NA" : `${active.priorMomentum > 0 ? "+" : ""}${fmtNum(active.priorMomentum, 2)}%`;
    const outcome = active?.outcome?.label || "검증 대기";
    const profile = executiveDecisionProfile(active, selectedYearOption);
    return {
      title: `${active?.decision?.label || "판단 대기"} · ${active?.decision?.action || "실행 보류"}`,
      body: `질문: "${profile.question}" ${yearLabel} 기준점 ${selectedIso ? pointDateLabel(selectedIso) : "없음"}에서 직전 모멘텀 ${prior}, 이후 실측 ${actual}, 관측 ${fmtNum(active?.observations?.length || 0)}개로 검증했습니다.`,
      next: `결론: ${outcome}. ${active?.decision?.logic || "근거가 더 쌓이면 재판단합니다."} ${profile.strategy}`,
    };
  }

  function executiveDecisionDebateHTML(active, selectedYearOption, productLabel, selectedIso, selectedSeriesCount, items = []) {
    if (!active) return "";
    const accent = categoryAccent(active.category);
    const actual = active.actualChange == null ? "NA" : `${active.actualChange > 0 ? "+" : ""}${fmtNum(active.actualChange, 2)}%`;
    const prior = active.priorMomentum == null ? "NA" : `${active.priorMomentum > 0 ? "+" : ""}${fmtNum(active.priorMomentum, 2)}%`;
    const yearLabel = selectedYearOption?.label || "선택 시점 없음";
    const agentItems = executiveDecisionAgentItems(active, selectedYearOption, productLabel, selectedIso, selectedSeriesCount);
    const conclusion = executiveDecisionCouncilConclusion(active, selectedYearOption, selectedIso);
    const profile = executiveDecisionProfile(active, selectedYearOption, productLabel);
    const rosterStepDelay = 120;
    const chatStartDelay = agentItems.length * rosterStepDelay + 720;
    const councilStepDelay = 820;
    const councilConclusionDelay = chatStartDelay + agentItems.length * councilStepDelay + 760;
    return `
      <div class="agent-debate agent-debate-decision decision-agent-council" style="--local-accent:${escapeHTML(accent)}">
        <div class="agent-debate-title">
          <span>EXPERT AGENTS</span>
          <strong>${escapeHTML(active.label)} 의사결정 토론</strong>
        </div>
        <div class="c-level-agent-controls decision-agent-controls">
          <label>
            <span>안건 선택</span>
            <select id="execDecisionCouncilSelect" aria-label="제품군 전문가 에이전트 토론 안건 선택">
              ${items.map((item) => `<option value="${escapeHTML(item.id)}"${item.id === active.id ? " selected" : ""}>${escapeHTML(item.label)} · ${escapeHTML(item.decision.label)} · ${fmtNum(item.observations.length)}개 관측</option>`).join("")}
            </select>
          </label>
          <button type="button" id="execDecisionRunCouncil">${execDecisionCouncilRan ? "토론 다시 실행" : "에이전트 실행"}</button>
        </div>
        <div class="agent-selected-brief">
          <span>선택 안건</span>
          <strong>${escapeHTML(active.label)} · ${escapeHTML(active.decision.label)} · 관측 ${fmtNum(active.observations.length)}개</strong>
          <p>${escapeHTML(`질문: "${profile.question}"`)}</p>
          <small>${escapeHTML(yearLabel)} · ${escapeHTML(productLabel)} · 기준점 ${selectedIso ? escapeHTML(pointDateLabel(selectedIso)) : "없음"}</small>
        </div>
        <div class="agent-debate-metrics">
          <div><strong>${escapeHTML(active.decision.label)}</strong><span>판단</span></div>
          <div><strong>${escapeHTML(prior)}</strong><span>사전 모멘텀</span></div>
          <div><strong>${escapeHTML(actual)}</strong><span>이후 실측</span></div>
          <div><strong>${fmtNum(active.chinaSignalCount)}</strong><span>중국 신호</span></div>
        </div>
        ${execDecisionCouncilRan ? `
          <div class="agent-roster" aria-label="제품군 토론 참여 전문가">
            ${agentItems.map((agent, index) => `
              <div class="agent-avatar-card" style="--agent-color:${escapeHTML(agent.color)}; --delay:${index * rosterStepDelay}ms">
                <div class="agent-person">
                  <b>${escapeHTML(agent.initials)}</b>
                  <i aria-hidden="true"></i>
                </div>
                <span>${escapeHTML(agent.name)}</span>
                <small>${escapeHTML(agent.title || agent.role)}</small>
                <em>${escapeHTML(agent.stance || agent.role)}</em>
              </div>
            `).join("")}
          </div>
          <div class="agent-chat" aria-label="제품군 전문가 토론 말풍선" style="--chat-delay:${chatStartDelay}ms">
            ${agentItems.map((agent, index) => `
              <article class="agent-turn${index % 2 ? " right" : ""}" style="--agent-color:${escapeHTML(agent.color)}; --delay:${chatStartDelay + index * councilStepDelay}ms">
                <div class="agent-badge">${escapeHTML(agent.initials)}</div>
                <div class="speech-bubble">
                  <div class="speech-meta">
                    <strong>${escapeHTML(agent.name)}</strong>
                    <span>${escapeHTML(agent.role)}</span>
                  </div>
                  <p>${escapeHTML(agent.message)}</p>
                </div>
              </article>
            `).join("")}
          </div>
          <div class="agent-conclusion reveal" style="--local-accent:${escapeHTML(accent)}; --delay:${councilConclusionDelay}ms">
            <span>결론</span>
            <strong>${escapeHTML(conclusion.title)}</strong>
            <p>${escapeHTML(conclusion.body)}</p>
            <small>${escapeHTML(conclusion.next)}</small>
          </div>
          <div class="agent-kpi-row">
            <strong>추적 KPI</strong>
            ${["price spread", "china signal count", "customer mix", "BIS event", "actual outcome"].map((kpi) => `<span>${escapeHTML(kpi)}</span>`).join("")}
          </div>
        ` : `
          <div class="agent-waiting">
            <strong>안건을 선택한 뒤 에이전트 실행을 누르세요.</strong>
            <p>실행 전에는 에이전트를 호출하지 않습니다. 실행 후 가격·백테스트·중국 신호·수익성·리스크 관점이 순차 말풍선으로 나타납니다.</p>
          </div>
        `}
      </div>
    `;
  }

  function renderExecutiveDecision() {
    const summary = $("#execDecisionSummary");
    const grid = $("#execDecisionGrid");
    const focus = $("#execDecisionFocus");
    const evidence = $("#execDecisionEvidence");
    const meta = $("#execDecisionMeta");
    const coverage = $("#backtestCoverage");
    if (!summary || !grid || !focus || !evidence) return;

    renderBacktestControls();
    const selectedYearOption = selectedBacktestYearOption();
    const selected = selectedBacktestIso();
    const items = executiveBacktestsForSelection();
    if (!items.some((item) => item.id === execDecisionFocusId)) {
      execDecisionFocusId = items[0]?.id || "hbm-ai-server";
      execDecisionCouncilRan = false;
    }
    const active = items.find((item) => item.id === execDecisionFocusId) || items[0];
    const historyCount = historyItems().length;
    const latestAtRaw = items.length ? Math.max(...items.map((item) => item.latestAt || 0), 0) : 0;
    const latestAt = Number.isFinite(latestAtRaw) ? latestAtRaw : 0;
    const productLabel = selectedExecProductLabel();
    const yearLabel = selectedYearOption?.label || "시점 없음";
    const selectedSeriesKeys = new Set();
    items.forEach((item) => {
      productHistorySeries(item).forEach((series) => {
        selectedSeriesKeys.add(series.key || `${series.sectionTitle || ""}::${series.item || ""}`);
      });
    });
    const selectedSeriesCount = selectedSeriesKeys.size;
    if (meta) meta.textContent = `${yearLabel} 기준 · ${productLabel} · ${fmtNum(selectedSeriesCount)}개 매칭 series · ${latestAt ? pointDateLabel(latestAt) : "최신 결과 없음"}까지 검증`;
    if (coverage) coverage.textContent = `${yearLabel} 첫 수집점 ${selected ? pointDateLabel(selected) : "없음"} · 전체 가격 series ${fmtNum(historyCount)}개 · 제품군 매칭 ${fmtNum(selectedSeriesCount)}개`;
    summary.hidden = true;
    summary.innerHTML = "";
    renderCategoryDecisionMatrix(items);

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
        body: `${active.rationale} 기준일 판단: ${active.decision.label}. 이후 실제 변화: ${active.actualChange == null ? "데이터 부족" : `${fmtNum(active.actualChange, 2)}%`}.`,
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
        ${executiveDecisionDebateHTML(active, selectedYearOption, productLabel, selected, selectedSeriesCount, items)}
        <div class="metric-row">
          <div class="metric"><strong>${active.priorMomentum == null ? "NA" : `${fmtNum(active.priorMomentum, 2)}%`}</strong><span>직전 모멘텀</span></div>
          <div class="metric"><strong>${active.actualChange == null ? "NA" : `${fmtNum(active.actualChange, 2)}%`}</strong><span>이후 실제</span></div>
          <div class="metric"><strong>${fmtNum(active.observations.length)}</strong><span>관측 품목</span></div>
        </div>
        <div class="decision-outcome ${escapeHTML(active.outcome.cls)}">
          <strong>${escapeHTML(active.outcome.label)}</strong>
          <span>기준점 ${escapeHTML(pointDateLabel(selected))} → 최신 ${escapeHTML(active.latestAt ? pointDateLabel(active.latestAt) : "없음")}</span>
        </div>
        <div class="decision-focus-block">
          <strong>제품군</strong>
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
      focus.querySelector("#execDecisionCouncilSelect")?.addEventListener("change", (event) => {
        execDecisionFocusId = event.target.value;
        execDecisionCouncilRan = false;
        renderExecutiveDecision();
      });
      focus.querySelector("#execDecisionCouncilSelect")?.addEventListener("input", (event) => {
        execDecisionFocusId = event.target.value;
        execDecisionCouncilRan = false;
        renderExecutiveDecision();
      });
      focus.querySelector("#execDecisionRunCouncil")?.addEventListener("click", () => {
        execDecisionCouncilRan = true;
        renderExecutiveDecision();
      });
      focus.querySelector("[data-decision-copy]")?.addEventListener("click", (event) => copyPayload(payload, event.currentTarget));
      focus.querySelector("[data-decision-inspector]")?.addEventListener("click", () => openInspector(payload));
      focus.querySelector("[data-decision-prices]")?.addEventListener("click", () => jumpTo("prices"));

      if (active.observations.length) {
        evidence.hidden = false;
        evidence.innerHTML = `
          <div class="decision-table-wrap">
            <table class="decision-table">
              <thead>
                <tr>
                  <th>품목</th>
                  <th>가격표</th>
                  <th>기준점 가격</th>
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
        `;
      } else {
        evidence.hidden = true;
        evidence.innerHTML = "";
      }
    } else {
      focus.innerHTML = `<div class="empty">제품군을 선택하면 의사결정 근거가 열립니다.</div>`;
      evidence.hidden = true;
      evidence.innerHTML = "";
    }

    grid.querySelectorAll("[data-decision-product]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (execDecisionFocusId !== btn.dataset.decisionProduct) execDecisionCouncilRan = false;
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
    return CHINA_BUSINESS_STRATEGY_PILLARS.map((item) => {
      const signals = investmentSignalCount(item);
      const priceMomentum = investmentPriceMomentum(item);
      const chinaRisk = (item.linkedCategories || []).includes("china") ? rawNews().filter(isChinaArticle).length * .06 : 0;
      const score = clamp(item.baseScore + Math.min(signals, 160) * .08 + priceMomentum * 1.8 + chinaRisk);
      const links = investmentEvidenceLinks(item, 5);
      const evidenceCount = investmentEvidenceLinks(item, 999).length;
      return {
        ...item,
        signals,
        priceRows: investmentPriceRows(item).length,
        priceMomentum,
        score,
        evidenceCount,
        links,
      };
    });
  }

  function strategicInvestmentDecisionItems() {
    const strategyMap = new Map(managementStrategyItems().map((item) => [item.id, item]));
    return CHINA_BUSINESS_DECISIONS.map((item) => {
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
        evidenceCount: investmentEvidenceLinks(item, 999).length + (strategy?.evidenceCount || 0),
        links: investmentEvidenceLinks(item, 5).concat(strategy?.links || []).slice(0, 5),
      };
    });
  }

  function investmentAverageScore(items = []) {
    return items.length ? items.reduce((sum, item) => sum + item.score, 0) / items.length : 0;
  }

  function investmentPayload(item, section) {
    return {
      type: section === "management-strategy" ? "중국 경영전략 수립" : "중국 전략적 의사 결정",
      tag: item.businessAxis || item.role || item.option || "China business",
      title: item.title,
      body: item.thesis || item.logic,
      section,
      categories: item.linkedCategories || [],
      watch: (item.triggers || item.gate || []).concat(item.actions || item.action || []),
      tags: [item.label, item.capital, item.allocation, item.stage].filter(Boolean),
      links: item.links || [],
      metrics: [
        { label: "근거지수", value: fmtNum(item.score) },
        { label: "Evidence links", value: fmtNum(item.evidenceCount || sourceUrlItems(item.links || []).length) },
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

  function renderChinaBusinessBrief(target, items = []) {
    if (!target) return;
    const leaders = [...items].sort((a, b) => b.score - a.score).slice(0, 3);
    const cards = leaders.map((item, index) => ({
      title: item.businessAxis || item.label,
      label: item.label,
      score: item.score,
      proof: proofBadgeHTML(item),
      body: item.thesis,
      action: (item.actions || [])[0] || item.capital,
      delay: index * 35,
    }));
    target.innerHTML = cards.map((card) => `
      <article class="china-business-brief-card reveal" style="animation-delay:${card.delay}ms">
        <span>${escapeHTML(card.title)}</span>
        <div>
          <strong>${escapeHTML(card.label)}</strong>
          <em>모델 ${fmtNum(card.score)}%</em>
        </div>
        <div class="evidence-row">${card.proof}</div>
        <p>${escapeHTML(card.body)}</p>
        <small>${escapeHTML(card.action || "")}</small>
      </article>
    `).join("");
  }

  function renderChinaBusinessMap(target, items = [], selectedId = "") {
    if (!target) return;
    const axes = ["고객/매출", "제품/가격", "생태계", "공급망", "운영/규제", "인재/IP"];
    target.innerHTML = axes.map((axis, index) => {
      const axisItems = items.filter((item) => item.businessAxis === axis);
      const top = axisItems[0] || items[index % Math.max(items.length, 1)];
      const signals = axisItems.reduce((sum, item) => sum + item.signals, 0);
      const score = axisItems.length ? investmentAverageScore(axisItems) : top?.score || 0;
      return `
        <button class="china-business-lane reveal${top?.id === selectedId ? " active" : ""}" type="button" data-china-business-strategy="${escapeHTML(top?.id || "")}" style="--local-accent:${categoryAccent((top?.linkedCategories || [])[0])}; animation-delay:${index * 25}ms">
          <span>${escapeHTML(axis)}</span>
          <strong>${escapeHTML(top?.label || axis)}</strong>
          <p>${escapeHTML(top?.capital || "크롤링 신호를 기다리는 축")}</p>
          <div class="lane-meter" aria-hidden="true"><i data-fill-to="${clamp(score)}" style="width:0%"></i></div>
          <small>${fmtNum(signals || top?.signals || 0)} signals · 근거지수 ${fmtNum(score)}% · 근거 ${fmtNum(top?.evidenceCount || 0)}건</small>
        </button>
      `;
    }).join("");
  }

  function renderChinaDecisionGates(target, items = [], selectedId = "") {
    if (!target) return;
    target.innerHTML = items.map((item, index) => {
      const stage = String(item.stage || "Watch").toLowerCase();
      return `
        <button class="china-decision-gate reveal ${stage}${item.id === selectedId ? " active" : ""}" type="button" data-china-decision-gate="${escapeHTML(item.id)}" style="--local-accent:${categoryAccent((item.linkedCategories || [])[0])}; animation-delay:${index * 25}ms">
          <span>${escapeHTML(item.stage)} · ${escapeHTML(item.option)}</span>
          <strong>${escapeHTML(item.label)}</strong>
          <p>${escapeHTML(item.action || item.logic || "")}</p>
          <div class="gate-meter" aria-hidden="true"><i data-fill-to="${clamp(item.score)}" style="width:0%"></i></div>
          <small>${fmtNum(item.signals)} signals · 모델 ${fmtNum(item.score)}% · 근거 ${fmtNum(item.evidenceCount || 0)}건</small>
        </button>
      `;
    }).join("");
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
        <div class="evidence-row">${proofBadgeHTML(item)}</div>
      </div>
      <div class="metric-row">
        <div class="metric"><strong>${fmtNum(item.score)}</strong><span>모델점수</span></div>
        <div class="metric"><strong>${fmtNum(item.evidenceCount || sourceUrlItems(item.links || []).length)}</strong><span>출처/기사 근거</span></div>
        <div class="metric"><strong>${fmtNum(item.priceRows || 0)}</strong><span>가격 데이터</span></div>
      </div>
      <div class="investment-focus-block">
        <strong>${item.allocation ? "전략 가중치(모델)" : "판단 상태"}</strong>
        <p>${item.allocation ? `${escapeHTML(item.allocation)} · 실제 자본 배분 확정값이 아니라, 현재 수집 신호 기반 우선순위입니다.` : escapeHTML(item.stage || "Gate")}</p>
      </div>
      <div class="investment-focus-block">
        <strong>실행 관점</strong>
        <p>${escapeHTML(item.capital || item.action || "")}</p>
      </div>
      <div class="investment-focus-block">
        <strong>숫자 산식</strong>
        <p>모델점수 = 기준점수 + 크롤링 신호 + 가격 모멘텀 + 연결 전략 점수. 실측값은 가격 데이터와 원문 링크 수만 별도 집계합니다.</p>
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
    const brief = $("#chinaBusinessBrief");
    const map = $("#chinaBusinessMap");
    const grid = $("#managementStrategyGrid");
    const focus = $("#managementStrategyFocus");
    const meta = $("#managementStrategyMeta");
    if (!summary || !flow || !grid || !focus) return;

    const items = managementStrategyItems();
    if (!items.some((item) => item.id === managementStrategyFocusId)) managementStrategyFocusId = items[0]?.id || "china-key-account";
    const selected = items.find((item) => item.id === managementStrategyFocusId) || items[0];
    const totalSignals = items.reduce((sum, item) => sum + item.signals, 0);
    if (meta) meta.textContent = `${fmtNum(items.length)}개 사업 방향 · ${fmtDate(LIVE.updatedAt)}`;
    summary.hidden = true;
    summary.innerHTML = "";

    const flowSteps = [
      { label: "1. 중국 신호 수집", note: "가격·뉴스·채용·정책·팹/패키징" },
      { label: "2. 사업 영향 분류", note: "고객 방어, NAND/eSSD, 운영 리스크" },
      { label: "3. 사업 방향 선택", note: "계약, 제품 믹스, 제휴, 보안/법무" },
      { label: "4. 의사결정 이관", note: "2번 탭의 Go/Defend/Watch/Hold 안건" },
    ];
    flow.innerHTML = flowSteps.map((step, index) => `
      <article class="investment-flow-step reveal" style="animation-delay:${index * 30}ms">
        <strong>${escapeHTML(step.label)}</strong>
        <span>${escapeHTML(step.note)}</span>
      </article>
    `).join("");

    grid.innerHTML = items.map((item, index) => `
      <button class="investment-card reveal${item.id === selected?.id ? " active" : ""}" type="button" data-management-strategy="${escapeHTML(item.id)}" style="--local-accent:${categoryAccent((item.linkedCategories || [])[0])}; animation-delay:${index * 25}ms">
        ${scoreRingHTML(item.score, "근거지수")}
        <span>
          <small>${escapeHTML(item.businessAxis)} · 신호비중 ${totalSignals ? Math.round((item.signals / totalSignals) * 100) : 0}%</small>
          <strong>${escapeHTML(item.label)}</strong>
          <em>${fmtNum(item.signals)} signals · 근거 ${fmtNum(item.evidenceCount || 0)}건</em>
        </span>
      </button>
    `).join("");
    renderChinaBusinessBrief(brief, items);
    renderChinaBusinessMap(map, items, selected?.id);
    renderInvestmentFocus(focus, selected, "management-strategy");
    grid.querySelectorAll("[data-management-strategy]").forEach((btn) => {
      btn.addEventListener("click", () => {
        managementStrategyFocusId = btn.dataset.managementStrategy;
        renderManagementStrategy();
      });
    });
    map?.querySelectorAll("[data-china-business-strategy]").forEach((btn) => {
      btn.addEventListener("click", () => {
        managementStrategyFocusId = btn.dataset.chinaBusinessStrategy;
        renderManagementStrategy();
      });
    });
    animateCounts(summary);
    animateCounts(brief);
    animateCounts(grid);
    animateMeters(map);
    animateMeters(grid);
  }

  function renderStrategicInvestmentDecision() {
    const summary = $("#strategicDecisionSummary");
    const gates = $("#chinaDecisionGates");
    const grid = $("#strategicDecisionGrid");
    const focus = $("#strategicDecisionFocus");
    const evidence = $("#strategicDecisionEvidence");
    const meta = $("#strategicDecisionMeta");
    if (!summary || !grid || !focus || !evidence) return;

    const items = strategicInvestmentDecisionItems();
    if (!items.some((item) => item.id === strategicDecisionFocusId)) strategicDecisionFocusId = items[0]?.id || "china-key-account-lock";
    const selected = items.find((item) => item.id === strategicDecisionFocusId) || items[0];
    const totalSignals = items.reduce((sum, item) => sum + item.signals, 0);
    if (meta) meta.textContent = `${fmtNum(items.length)}개 투자 판단 · ${fmtDate(LIVE.updatedAt)}`;
    summary.hidden = true;
    summary.innerHTML = "";

    grid.innerHTML = items.map((item, index) => `
      <button class="investment-card reveal${item.id === selected?.id ? " active" : ""}" type="button" data-strategic-decision="${escapeHTML(item.id)}" style="--local-accent:${categoryAccent((item.linkedCategories || [])[0])}; animation-delay:${index * 25}ms">
        ${scoreRingHTML(item.score, "근거지수")}
        <span>
          <small>${escapeHTML(item.stage)} · ${escapeHTML(item.option)}</small>
          <strong>${escapeHTML(item.label)}</strong>
          <em>${fmtNum(item.signals)} signals · 근거 ${fmtNum(item.evidenceCount || 0)}건</em>
        </span>
      </button>
    `).join("");
    renderChinaDecisionGates(gates, items, selected?.id);
    renderInvestmentFocus(focus, selected, "strategic-investment-decision");

    const evidenceLinks = selected?.links || [];
    evidence.innerHTML = `
      <div>
        <span>Decision evidence</span>
        <strong>${escapeHTML(selected?.label || "투자 옵션")}</strong>
        <small>${escapeHTML(selected?.action || "")}</small>
        <div class="evidence-row">${proofBadgeHTML(selected || {})}</div>
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
    gates?.querySelectorAll("[data-china-decision-gate]").forEach((btn) => {
      btn.addEventListener("click", () => {
        strategicDecisionFocusId = btn.dataset.chinaDecisionGate;
        renderStrategicInvestmentDecision();
      });
    });
    animateCounts(summary);
    animateCounts(gates);
    animateCounts(grid);
    animateMeters(gates);
    animateMeters(grid);
  }

  function activePolicyLens() {
    return POLICY_MAKER_LENSES.find((lens) => lens.id === policyMakerTab) || POLICY_MAKER_LENSES[0];
  }

  function policyStatusClass(status) {
    const text = String(status || "").toLowerCase();
    if (text.includes("확인")) return "check";
    if (text === "x" || text.includes("fail") || text.includes("금지")) return "fail";
    if (text.includes("watch") || text.includes("조건")) return "watch";
    if (text === "o" || text.includes("ok")) return "ok";
    return "watch";
  }

  function policyPayload(lens) {
    return {
      type: "Policy Maker",
      tag: lens.en,
      title: `${lens.label} 정책 방향성`,
      body: `${lens.direction} ${lens.skImpact}`,
      section: "policy-makers",
      categories: [lens.accentCategory || "geopolitics"],
      watch: (lens.rules || []).map((rule) => `${rule.axis}: ${rule.title} - ${rule.implication}`).concat(lens.actions || []),
      metrics: [
        { label: "판단", value: lens.verdict },
        { label: "체크포인트", value: fmtNum((lens.rules || []).length) },
        { label: "출처", value: fmtNum((lens.sources || []).length) },
        { label: "SK 거점", value: fmtNum((lens.sites || []).length) },
      ],
      links: (lens.sources || []).map((source) => ({ title: source.label, link: source.url })),
      tags: [lens.label, lens.status, lens.law].filter(Boolean),
    };
  }

  function renderPolicyTabs(lens) {
    const tabs = $("#policyTabs");
    if (!tabs) return;
    tabs.innerHTML = POLICY_MAKER_LENSES.map((item) => `
      <button class="policy-tab${item.id === lens.id ? " active" : ""}" type="button" role="tab" aria-selected="${item.id === lens.id ? "true" : "false"}" data-policy-tab="${escapeHTML(item.id)}" style="--local-accent:${categoryAccent(item.accentCategory)}">
        <strong>${escapeHTML(item.label)}</strong>
        <span>${escapeHTML(item.subtitle)}</span>
      </button>
    `).join("");
    tabs.querySelectorAll("[data-policy-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        policyMakerTab = btn.dataset.policyTab;
        renderPolicyMakers();
      });
    });
  }

  function renderPolicyMakers() {
    const summary = $("#policySummary");
    const grid = $("#policyRuleGrid");
    const focus = $("#policyFocus");
    const meta = $("#policyMakerMeta");
    const sourceMeta = $("#policySourceMeta");
    if (!summary || !grid || !focus) return;

    const lens = activePolicyLens();
    const accent = categoryAccent(lens.accentCategory);
    const payload = policyPayload(lens);
    if (meta) meta.textContent = `${lens.label} · ${fmtNum((lens.rules || []).length)}개 체크포인트`;
    if (sourceMeta) sourceMeta.textContent = `${lens.law} · ${fmtDate(LIVE.updatedAt)}`;
    renderPolicyTabs(lens);

    summary.style.setProperty("--local-accent", accent);
    summary.innerHTML = [
      { label: "정책 방향", value: lens.status, note: lens.direction },
      { label: "법·규제", value: lens.verdict, note: lens.law },
      { label: "SK 영향", value: `${(lens.sites || []).length}개 거점`, note: lens.skImpact },
      { label: "전략 방향", value: "Action", note: lens.strategy },
    ].map((card, index) => `
      <article class="policy-card reveal" style="animation-delay:${index * 25}ms">
        <span>${escapeHTML(card.label)}</span>
        <strong>${escapeHTML(card.value)}</strong>
        <p>${escapeHTML(card.note)}</p>
      </article>
    `).join("");

    grid.innerHTML = (lens.rules || []).map((rule, index) => {
      const cls = policyStatusClass(rule.status);
      return `
        <article class="policy-rule-card reveal" style="--local-accent:${accent}; animation-delay:${index * 25}ms">
          <div class="policy-rule-top">
            <span class="policy-status ${cls}">${escapeHTML(rule.status)}</span>
            <small>${escapeHTML(rule.axis)}</small>
          </div>
          <h3>${escapeHTML(rule.title)}</h3>
          <p>${escapeHTML(rule.evidence)}</p>
          <em>${escapeHTML(rule.implication)}</em>
          <div class="policy-rule-foot">${sourceLinkHTML(rule.sourceUrl, rule.source || "출처")}</div>
        </article>
      `;
    }).join("");

    focus.style.setProperty("--local-accent", accent);
    focus.innerHTML = `
      <div class="policy-focus-head">
        <span class="chip accent">${escapeHTML(lens.en)} · ${escapeHTML(lens.status)}</span>
        <h3>${escapeHTML(lens.label)} Policy Maker 방향성</h3>
        <p>${escapeHTML(lens.direction)}</p>
      </div>
      <div class="policy-verdict ${policyStatusClass(lens.status)}">
        <strong>${escapeHTML(lens.verdict)}</strong>
        <span>${escapeHTML(lens.skImpact)}</span>
      </div>
      <div class="policy-focus-block">
        <strong>SKHY 전략 방향</strong>
        <p>${escapeHTML(lens.strategy)}</p>
      </div>
      <div class="policy-focus-block">
        <strong>SK 중국 법인·공장</strong>
        <ul class="policy-site-list">
          ${(lens.sites || []).map((site) => `
            <li>
              <b>${escapeHTML(site.name)}</b>
              <span>${escapeHTML(site.role)}</span>
              <small>${escapeHTML(site.note)}</small>
            </li>
          `).join("")}
        </ul>
      </div>
      <div class="policy-focus-block">
        <strong>당서기/정치조직 해석</strong>
        <p>${escapeHTML(lens.partyNote)}</p>
      </div>
      <div class="policy-focus-block">
        <strong>의사결정 액션</strong>
        <ul class="watch-list">${(lens.actions || []).map((line) => `<li>${escapeHTML(line)}</li>`).join("")}</ul>
      </div>
      <div class="focus-actions">
        <button type="button" data-policy-copy>복사</button>
        <button type="button" data-policy-inspector>상세 패널</button>
        <button type="button" data-policy-workbench>워크벤치</button>
      </div>
    `;
    focus.querySelector("[data-policy-copy]")?.addEventListener("click", (event) => copyPayload(payload, event.currentTarget));
    focus.querySelector("[data-policy-inspector]")?.addEventListener("click", () => openInspector(payload));
    focus.querySelector("[data-policy-workbench]")?.addEventListener("click", () => {
      workbenchMode = "policy-makers";
      selectedInsightId = null;
      renderWorkbench();
      jumpTo("workbench");
    });

    animateCounts(summary);
    animateCounts(grid);
    animateMeters(summary);
    animateMeters(grid);
  }

  function activeChinaInfraSite() {
    return CHINA_FAB_INFRA_SITES.find((site) => site.id === chinaInfraSite) || CHINA_FAB_INFRA_SITES[0];
  }

  function chinaInfraTheme() {
    return (LIVE.benchmarkSignals?.themes || []).find((theme) => theme.id === "china_infra" || theme.label === "China Fab Infrastructure") || null;
  }

  function chinaInfraLiveSources(site = activeChinaInfraSite()) {
    const sources = LIVE.chinaInfra?.sources || [];
    return sources.filter((source) => !source.site || source.site === site.id || source.site === "all");
  }

  function chinaInfraSignalCount(site = activeChinaInfraSite()) {
    const terms = (site.liveTerms || []).map((term) => String(term).toLowerCase());
    const newsCount = rawNews().filter((news) => {
      const hay = `${news.title || ""} ${news.titleKo || ""} ${news.summary || ""} ${news.source || ""} ${news.link || ""}`.toLowerCase();
      return terms.some((term) => hay.includes(term));
    }).length;
    const theme = chinaInfraTheme();
    const themeCount = Number(theme?.count ?? theme?.items?.length ?? 0) || 0;
    return newsCount + themeCount + chinaInfraLiveSources(site).length;
  }

  function chinaInfraPayload(site) {
    return {
      type: "중국 Fab 인프라",
      tag: site.en,
      title: `${site.label} 확장성 판단`,
      body: `${site.direction} ${site.decision}`,
      section: "china-fab-infra",
      categories: [site.accentCategory || "china"],
      watch: (site.checks || []).map((check) => `${check.axis}: ${check.title} - ${check.implication}`),
      metrics: [
        { label: "판단", value: site.verdict },
        { label: "체크포인트", value: fmtNum((site.checks || []).length) },
        { label: "크롤링 신호", value: fmtNum(chinaInfraSignalCount(site)) },
      ],
      links: [],
      tags: [site.label, site.status, "Land", "Water", "Power"],
    };
  }

  function renderChinaInfraTabs(site) {
    const tabs = $("#infraSiteTabs");
    if (!tabs) return;
    tabs.innerHTML = CHINA_FAB_INFRA_SITES.map((item) => `
      <button class="policy-tab${item.id === site.id ? " active" : ""}" type="button" role="tab" aria-selected="${item.id === site.id ? "true" : "false"}" data-infra-site="${escapeHTML(item.id)}" style="--local-accent:${categoryAccent(item.accentCategory)}">
        <strong>${escapeHTML(item.label)}</strong>
        <span>${escapeHTML(item.subtitle)}</span>
      </button>
    `).join("");
    tabs.querySelectorAll("[data-infra-site]").forEach((btn) => {
      btn.addEventListener("click", () => {
        chinaInfraSite = btn.dataset.infraSite;
        renderChinaFabInfra();
      });
    });
  }

  function renderChinaFabInfra() {
    const summary = $("#infraSummary");
    const grid = $("#infraRuleGrid");
    const focus = $("#infraFocus");
    const meta = $("#infraMakerMeta");
    const sourceMeta = $("#infraSourceMeta");
    if (!summary || !grid || !focus) return;

    const site = activeChinaInfraSite();
    const accent = categoryAccent(site.accentCategory);
    const payload = chinaInfraPayload(site);
    const signalCount = chinaInfraSignalCount(site);
    const theme = chinaInfraTheme();
    if (meta) meta.textContent = `${site.label} · ${fmtNum((site.checks || []).length)}개 체크포인트 · 크롤링 신호 ${fmtNum(signalCount)}개`;
    if (sourceMeta) sourceMeta.textContent = `RSS ${fmtNum(Number(theme?.count ?? 0) || 0)}개 · ${fmtDate(LIVE.chinaInfra?.updatedAt || LIVE.updatedAt)}`;
    renderChinaInfraTabs(site);

    summary.style.setProperty("--local-accent", accent);
    summary.innerHTML = [
      { label: "최종 판단", value: site.verdict, note: site.decision },
      { label: "토지/부지", value: (site.checks || []).find((check) => check.axis.includes("토지"))?.status || "확인필요", note: "소유권/토지사용권과 기존 부지 내 확장 근거를 분리 판단" },
      { label: "용수/폐수", value: (site.checks || []).find((check) => check.axis.includes("용수"))?.status || "확인필요", note: "공정용수, 재생수, 폐수총량, 하수처리장 여유 확인" },
      { label: "전력", value: (site.checks || []).find((check) => check.axis.includes("전력"))?.status || "확인필요", note: "수전 용량, 변전소, 비상전원, 냉동기 부하 확인" },
    ].map((card, index) => `
      <article class="policy-card reveal" style="animation-delay:${index * 25}ms">
        <span>${escapeHTML(card.label)}</span>
        <strong>${escapeHTML(card.value)}</strong>
        <p>${escapeHTML(card.note)}</p>
      </article>
    `).join("");

    grid.innerHTML = (site.checks || []).map((check, index) => {
      const cls = policyStatusClass(check.status);
      return `
        <article class="policy-rule-card reveal" style="--local-accent:${accent}; animation-delay:${index * 25}ms">
          <div class="policy-rule-top">
            <span class="policy-status ${cls}">${escapeHTML(check.status)}</span>
            <small>${escapeHTML(check.axis)}</small>
          </div>
          <h3>${escapeHTML(check.title)}</h3>
          <p>${escapeHTML(check.evidence)}</p>
          <em>${escapeHTML(check.implication)}</em>
          <div class="policy-rule-foot">${sourceLinkHTML(check.sourceUrl, check.source || "출처")}</div>
        </article>
      `;
    }).join("");

    focus.style.setProperty("--local-accent", accent);
    focus.innerHTML = `
      <div class="policy-focus-head">
        <span class="chip accent">${escapeHTML(site.en)} · ${escapeHTML(site.status)}</span>
        <h3>${escapeHTML(site.label)} 확장성 판단</h3>
        <p>${escapeHTML(site.direction)}</p>
      </div>
      <div class="policy-verdict ${policyStatusClass(site.status)}">
        <strong>${escapeHTML(site.verdict)}</strong>
        <span>${escapeHTML(site.decision)}</span>
      </div>
      <div class="metric-row">
        <div class="metric"><strong>${fmtNum(signalCount)}</strong><span>크롤링 신호</span></div>
        <div class="metric"><strong>${fmtNum((site.checks || []).filter((check) => policyStatusClass(check.status) === "fail").length)}</strong><span>No-Go 항목</span></div>
      </div>
      <div class="policy-focus-block">
        <strong>SK 중국 거점</strong>
        <ul class="policy-site-list">
          ${(site.sites || []).map((row) => `
            <li>
              <b>${escapeHTML(row.name)}</b>
              <span>${escapeHTML(row.role)}</span>
              <small>${escapeHTML(row.note)}</small>
            </li>
          `).join("")}
        </ul>
      </div>
      <div class="policy-focus-block">
        <strong>확장 판단 로직</strong>
        <p>토지사용권·남은 부지, 공정용수/폐수총량, 수전 용량, 환경영향평가, BIS 라이선스가 모두 통과해야 추가 fab 확장을 O로 판단합니다. 하나라도 공개자료가 없으면 확인필요 또는 X로 둡니다.</p>
      </div>
      <div class="policy-focus-block">
        <strong>주기 크롤링</strong>
        <ul class="watch-list">
          <li>공개 인허가·정책·규제 신호는 요약 지표와 O/X 판단 근거로만 반영합니다.</li>
          <li>Google News RSS로 Wuxi water/power/land/EIA/BIS 보조 신호를 수집합니다.</li>
          <li>전력 quota, 토지사용권, 신규 EIA 숫자가 나오기 전까지 신규 fab 증설은 보수적으로 판단합니다.</li>
        </ul>
      </div>
      <div class="focus-actions">
        <button type="button" data-infra-copy>복사</button>
        <button type="button" data-infra-inspector>상세 패널</button>
        <button type="button" data-infra-workbench>워크벤치</button>
      </div>
    `;
    focus.querySelector("[data-infra-copy]")?.addEventListener("click", (event) => copyPayload(payload, event.currentTarget));
    focus.querySelector("[data-infra-inspector]")?.addEventListener("click", () => openInspector(payload));
    focus.querySelector("[data-infra-workbench]")?.addEventListener("click", () => {
      workbenchMode = "china-fab-infra";
      selectedInsightId = null;
      renderWorkbench();
      jumpTo("workbench");
    });

    animateCounts(summary);
    animateCounts(grid);
    animateMeters(summary);
    animateMeters(grid);
  }

  function activeChinaTalentScenario() {
    return CHINA_TALENT_STRATEGY_SCENARIOS.find((scenario) => scenario.id === chinaTalentScenarioId) || CHINA_TALENT_STRATEGY_SCENARIOS[0];
  }

  function chinaTalentTheme() {
    return liveBenchmarkTheme("china_talent_strategy") || liveBenchmarkTheme("talent") || null;
  }

  function chinaTalentLiveItems(scenario = activeChinaTalentScenario(), limit = 6) {
    const keywords = (scenario.keywords || []).map((keyword) => String(keyword).toLowerCase());
    const items = [];
    ["china_talent_strategy", "talent"].forEach((id) => {
      const theme = liveBenchmarkTheme(id);
      if (theme?.items) items.push(...theme.items);
    });
    const talentCategory = liveNewsCategory("china_talent_strategy");
    if (talentCategory?.items) items.push(...talentCategory.items);
    items.push(...rawNews().filter((item) => {
      const hay = `${item.title || ""} ${item.titleKo || ""} ${item.summary || ""} ${item.source || ""} ${item.link || ""}`.toLowerCase();
      return keywords.some((keyword) => hay.includes(keyword));
    }));
    const seen = new Set();
    return items.filter((item) => {
      const hay = `${item.title || item.titleKo || item.label || ""} ${item.source || ""}`.toLowerCase().replace(/\s+/g, " ").trim();
      const related = !keywords.length || keywords.some((keyword) => hay.includes(keyword));
      if (!hay || seen.has(hay) || !related) return false;
      seen.add(hay);
      return true;
    }).slice(0, limit);
  }

  function chinaTalentSignalCount(scenario = activeChinaTalentScenario()) {
    const theme = chinaTalentTheme();
    const themeCount = Number(theme?.count ?? theme?.items?.length ?? 0) || 0;
    return chinaTalentLiveItems(scenario, 24).length + Math.min(themeCount, 24);
  }

  function chinaTalentInvestments(scenario = activeChinaTalentScenario()) {
    return CHINA_TALENT_STRATEGY_INVESTMENTS[scenario.id] || [];
  }

  function chinaTalentGateStats(scenario = activeChinaTalentScenario()) {
    const gates = scenario.gates || [];
    const ok = gates.filter((gate) => policyStatusClass(gate.status) === "ok").length;
    const noGo = gates.filter((gate) => policyStatusClass(gate.status) === "fail").length;
    const watch = gates.length - ok - noGo;
    return { ok, noGo, watch, total: gates.length };
  }

  function chinaTalentRoiModel(scenario, investment) {
    const signals = chinaTalentSignalCount(scenario);
    const gates = chinaTalentGateStats(scenario);
    const signalBoost = Math.min(signals, 30) * .72;
    const gateBoost = gates.ok * 5.5 - gates.noGo * 7.5 - gates.watch * 1.5;
    const cost = Number(investment.costIndex || 0);
    const payoff = Number(investment.payoffIndex || 0);
    const risk = Number(investment.riskIndex || 0);
    const profitability = clamp(Math.round(payoff + signalBoost * .7 - cost * .28), 0, 100);
    const roi = clamp(Math.round(payoff + signalBoost + gateBoost - cost * .42 - risk * .35), 0, 100);
    const downside = clamp(Math.round(roi - risk * .22 - gates.noGo * 5), 0, 100);
    const upside = clamp(Math.round(roi + signalBoost * .35 + gates.ok * 4), 0, 100);
    const decision = gates.noGo >= 2
      ? "법무 선행"
      : roi >= 72
        ? "확대 투자"
        : roi >= 58
          ? "단계 투자"
          : roi >= 42
            ? "옵션 유지"
            : "보류";
    const decisionClass = decision.includes("확대") ? "ok" : decision.includes("단계") ? "watch" : decision.includes("옵션") ? "check" : "fail";
    return {
      cost,
      payoff,
      risk,
      signals,
      profitability,
      roi,
      downside,
      upside,
      decision,
      decisionClass,
      formula: `ROI 지수 = 효익(${fmtNum(payoff)}) + 신호(${fmtNum(signalBoost, 1)}) + 게이트(${fmtNum(gateBoost, 1)}) - 비용(${fmtNum(cost * .42, 1)}) - 리스크(${fmtNum(risk * .35, 1)})`,
    };
  }

  function chinaTalentScenarioRoi(scenario = activeChinaTalentScenario()) {
    const investments = chinaTalentInvestments(scenario);
    if (!investments.length) return { roi: 0, profitability: 0, downside: 0, upside: 0, top: null, count: 0 };
    const modeled = investments.map((investment) => ({ investment, model: chinaTalentRoiModel(scenario, investment) }));
    const avg = (key) => modeled.reduce((sum, item) => sum + item.model[key], 0) / modeled.length;
    const top = modeled.slice().sort((a, b) => b.model.roi - a.model.roi)[0];
    return {
      roi: Math.round(avg("roi")),
      profitability: Math.round(avg("profitability")),
      downside: Math.round(avg("downside")),
      upside: Math.round(avg("upside")),
      top,
      count: modeled.length,
      modeled,
    };
  }

  function chinaTalentChallengeTargets(scenario = activeChinaTalentScenario()) {
    return [
      { id: "scenario", label: `${scenario.label} 전체`, type: "시나리오", investment: null },
    ].concat(chinaTalentInvestments(scenario).map((investment) => ({
      id: `investment:${investment.id}`,
      label: investment.label,
      type: investment.type,
      investment,
    })));
  }

  function activeCeoChallengeTarget(scenario = activeChinaTalentScenario()) {
    const targets = chinaTalentChallengeTargets(scenario);
    const target = targets.find((item) => item.id === ceoChallengeTargetId) || targets[0];
    ceoChallengeTargetId = target.id;
    return target;
  }

  function activeCeoChallenge() {
    const challenge = CEO_CHALLENGES.find((item) => item.id === ceoChallengeId) || CEO_CHALLENGES[0];
    ceoChallengeId = challenge.id;
    return challenge;
  }

  function ceoTargetModel(scenario, target) {
    const scenarioRoi = chinaTalentScenarioRoi(scenario);
    if (target?.investment) return chinaTalentRoiModel(scenario, target.investment);
    return {
      cost: Math.round((scenarioRoi.modeled || []).reduce((sum, item) => sum + item.model.cost, 0) / Math.max(scenarioRoi.count, 1)),
      payoff: Math.round((scenarioRoi.modeled || []).reduce((sum, item) => sum + item.model.payoff, 0) / Math.max(scenarioRoi.count, 1)),
      risk: Math.round((scenarioRoi.modeled || []).reduce((sum, item) => sum + item.model.risk, 0) / Math.max(scenarioRoi.count, 1)),
      profitability: scenarioRoi.profitability,
      roi: scenarioRoi.roi,
      downside: scenarioRoi.downside,
      upside: scenarioRoi.upside,
      decision: scenarioRoi.top?.model?.decision || "옵션 유지",
      decisionClass: scenarioRoi.top?.model?.decisionClass || "watch",
      formula: `시나리오 평균 ROI 지수 = 투자안 ${fmtNum(scenarioRoi.count)}개 평균`,
    };
  }

  function buildCeoAgentAnswer(scenario, target, challenge) {
    const model = ceoTargetModel(scenario, target);
    const gates = chinaTalentGateStats(scenario);
    const signals = chinaTalentSignalCount(scenario);
    const targetLabel = target?.label || scenario.label;
    const investment = target?.investment;
    const top = chinaTalentScenarioRoi(scenario).top;
    const kpis = investment?.kpis || top?.investment?.kpis || ["크롤링 신호", "O/X 게이트", "ROI 지수"];
    const noGoText = gates.noGo ? `X 게이트 ${fmtNum(gates.noGo)}개가 있어 전면 집행이 아니라 통제 조건부 집행입니다.` : "현재 선택 시나리오에는 즉시 중단형 X 게이트가 낮습니다.";

    const common = {
      title: `${challenge.angle} · ${targetLabel}`,
      metrics: [
        { label: "ROI", value: fmtNum(model.roi) },
        { label: "수익성", value: fmtNum(model.profitability) },
        { label: "신호", value: fmtNum(signals) },
        { label: "O/X", value: `${fmtNum(gates.ok)}/${fmtNum(gates.noGo)}` },
      ],
      kpis,
    };

    const answers = {
      "evidence-quality": {
        verdict: signals > 0 ? "승인 가능하되, 전면 집행이 아니라 단계 집행이 맞습니다." : "승인은 보류가 아니라 소액 옵션 집행으로 제한해야 합니다.",
        logic: `현재 판단은 단일 기사에 기대지 않고 크롤링 신호 ${fmtNum(signals)}개, O 게이트 ${fmtNum(gates.ok)}개, X 게이트 ${fmtNum(gates.noGo)}개, ROI 지수 ${fmtNum(model.roi)}를 함께 봅니다.`,
        counter: "근거가 부족하다는 지적은 맞습니다. 그래서 숫자가 없는 매출·인력 규모를 만들지 않고, 공개 데이터 기반의 상대지수와 O/X 게이트로만 판단합니다.",
        action: `${targetLabel}는 ${model.decision}로 두고, 다음 크롤링에서 전용 신호가 증가하거나 X 게이트가 해소될 때만 예산을 올립니다.`,
      },
      "roi-credibility": {
        verdict: "이 ROI는 재무 ROI %가 아니라 경영 의사결정용 상대지수로 써야 합니다.",
        logic: `${model.formula}. 실제 현금흐름이 아니라 투자비, 효익, 리스크, 크롤링 신호, O/X 게이트를 0~100으로 표준화한 비교 모델입니다.`,
        counter: "따라서 CFO 보고용 IRR/NPV로 쓰면 안 됩니다. 대신 어떤 투자안을 먼저 실사할지 정하는 1차 필터로는 유효합니다.",
        action: `ROI 지수 ${fmtNum(model.roi)} 이상인 항목은 실사 후보, ${fmtNum(model.downside)} 이하 하방이면 옵션 유지로 분리합니다.`,
      },
      "budget-cut": {
        verdict: top?.investment ? `예산을 줄이면 '${top.investment.label}'만 남기는 것이 우선입니다.` : `${targetLabel}는 옵션 유지가 맞습니다.`,
        logic: `선택 시나리오 평균 ROI는 ${fmtNum(chinaTalentScenarioRoi(scenario).roi)}이고, 최상위 투자안은 ROI ${fmtNum(top?.model?.roi || model.roi)}입니다. 낮은 ROI 투자안은 다음 수집일까지 보류합니다.`,
        counter: "모든 투자를 얇게 집행하면 보안·품질·채용 어느 것도 임계치에 도달하지 못합니다.",
        action: "1순위 투자만 승인하고, 나머지는 KPI 경보가 발생할 때 자동 재상정하는 방식이 좋습니다.",
      },
      "no-go": {
        verdict: gates.noGo ? "X 게이트는 시나리오 폐기가 아니라 투자 범위 제한 조건입니다." : "현재는 X 게이트보다 실행 KPI 관리가 핵심입니다.",
        logic: noGoText,
        counter: "예를 들어 BIS·IP·recipe 금지선은 생산 확대나 기술 이전을 막지만, EHS, 리텐션, 공개정보 크롤링까지 막지는 않습니다.",
        action: "X 게이트와 무관하게 허용되는 투자만 남기고, 금지선에 닿는 채용·데이터 접근·기술 이전은 자동 보류합니다.",
      },
      "ip-risk": {
        verdict: "채용 확대보다 접근권 통제와 클린룸 설계가 선행되어야 합니다.",
        logic: `${targetLabel}의 리스크 지수는 ${fmtNum(model.risk)}입니다. IP 리스크가 높은 항목은 직접 채용보다 역할 분리, 접근권 등급화, 퇴직자 로그 관리가 먼저입니다.`,
        counter: "인력 확보 자체가 위험한 것이 아니라, 채용과 recipe 접근을 같은 승인선에 두는 것이 위험합니다.",
        action: "면접·온보딩·퇴직 단계에 비공개자료 반입 금지, 계정 회수 SLA, 핵심 데이터 접근 예외승인 로그를 넣습니다.",
      },
      outsourcing: {
        verdict: "외주는 보조 수단이고, 핵심 품질·IP·고객 판단은 내부 역량으로 남겨야 합니다.",
        logic: `투자비 지수 ${fmtNum(model.cost)}가 높은 항목은 외주로 일부 낮출 수 있지만, ROI 지수 ${fmtNum(model.roi)}의 핵심은 학습된 운영 데이터와 고객 대응 속도입니다.`,
        counter: "전력·EHS·일반 운영은 협력사 활용이 가능하지만, 펌웨어 검증, 고객 품질, IP 통제는 내부 책임자가 필요합니다.",
        action: "외주 가능 업무와 내부 보유 업무를 RACI로 분리하고, 고객·recipe·접근권이 걸린 업무는 내부 owner를 둡니다.",
      },
      "bis-shock": {
        verdict: "BIS 쇼크가 오면 확장형 채용은 줄이고 운영 유지·컴플라이언스·리텐션으로 전환해야 합니다.",
        logic: "미국 수출통제는 기존 운영과 캐파 확대/기술 업그레이드를 분리합니다. 그래서 채용도 운영 유지형과 업그레이드형을 분리해야 합니다.",
        counter: "규제가 강해진다고 중국 사업 인력을 모두 줄이면 운영 리스크가 커집니다. 줄일 것은 선단 이전·확장형 직무입니다.",
        action: "BIS 강화 이벤트가 발생하면 Fab·패키징 확장 채용은 hold, IP·접근권 자동 통제와 운영 continuity 인력은 maintain으로 둡니다.",
      },
      "china-zero": {
        verdict: "전용 RSS 0건은 '근거 없음'이 아니라 '직접 신호 부족'으로 표시해야 합니다.",
        logic: `현재 보드는 China Talent Strategy 전용 신호가 적을 경우 Talent/IP, China 뉴스, 공식 소스, O/X 게이트를 보조 신호로 사용합니다. 그래서 전용 신호가 0이면 ROI 확대가 아니라 보수적 단계 집행입니다.`,
        counter: "신호 0건인데 확정 숫자를 만들면 할루시네이션입니다. 그래서 화면은 재무액이 아니라 상대지수와 검증 상태를 보여줍니다.",
        action: "전용 신호가 2회 연속 0건이면 쿼리·소스 목록을 보강하고, 투자 확대는 다음 수집까지 보류합니다.",
      },
      "kpi-reversal": {
        verdict: "결정을 뒤집는 KPI를 먼저 정해야 합니다.",
        logic: `${targetLabel}의 핵심 KPI는 ${kpis.slice(0, 3).join(", ")}입니다. ROI 지수만 보지 말고 KPI 방향 전환을 kill switch로 둬야 합니다.`,
        counter: "CEO 관점에서 가장 위험한 것은 한 번 승인한 투자가 관성으로 계속되는 것입니다.",
        action: `ROI ${fmtNum(Math.max(40, model.roi - 12))} 이하, X 게이트 ${fmtNum(gates.noGo + 1)}개 이상, 또는 핵심 KPI 2개 악화 시 자동 재심의로 돌립니다.`,
      },
      "strategic-fit": {
        verdict: `${targetLabel}는 중국 사업 자체보다 SKHY의 HBM·NAND/eSSD·운영 리스크 방어와 연결될 때 의미가 있습니다.`,
        logic: `수익성 지수 ${fmtNum(model.profitability)}는 고객 방어, 수율 노하우 보호, 운영 중단 방지, 가격 하락 조기 대응의 조합입니다.`,
        counter: "중국 인력 확보를 독립 프로젝트로 보면 비용입니다. 제품군·고객·IP 방어와 연결하면 옵션 가치가 생깁니다.",
        action: "각 채용 요청은 HBM 수율, eSSD 고객 방어, Wuxi/Dalian/Chongqing 운영 안정, IP 리스크 중 하나에 반드시 매핑합니다.",
      },
    };

    return { ...common, ...(answers[challenge.id] || answers["roi-credibility"]) };
  }

  function ceoChallengeDebateHTML(scenario, target, challenge, response) {
    const accent = categoryAccent(scenario.accentCategory || "talent");
    const targetLabel = target?.label || scenario.label;
    return agentDebateHTML({
      mode: "ceo-challenge",
      title: `${challenge.angle} 챌린지 토론`,
      subtitle: `${scenario.label} · ${targetLabel}`,
      accent,
      metrics: response.metrics || [],
      turns: [
        {
          name: "CEO",
          role: "Challenge",
          avatar: "CEO",
          color: "#111827",
          message: challenge.question,
        },
        {
          name: "Strategy Agent",
          role: "전략 판단",
          avatar: "STR",
          color: "#22C55E",
          message: response.verdict,
        },
        {
          name: "Data Agent",
          role: "근거·수치",
          avatar: "DATA",
          color: "#06B6D4",
          message: response.logic,
        },
        {
          name: "Risk Agent",
          role: "CEO 반론 대응",
          avatar: "RISK",
          color: "#8B5CF6",
          message: response.counter,
        },
        {
          name: "CFO Agent",
          role: "자본배분",
          avatar: "CFO",
          color: "#F59E0B",
          message: `ROI 지수는 재무 IRR/NPV가 아니라 우선순위 필터입니다. ${targetLabel}은 수익성·비용·리스크 지표를 함께 봐야 합니다.`,
        },
        {
          name: "Execution Agent",
          role: "실행 조건",
          avatar: "OPS",
          color: "#0EA5E9",
          message: response.action,
        },
      ],
      kpis: response.kpis || [],
    });
  }

  function chinaTalentPayload(scenario) {
    const roi = chinaTalentScenarioRoi(scenario);
    return {
      type: "중국 인력 확보 전략",
      tag: scenario.en,
      title: `${scenario.label} 시나리오 인력 계획`,
      body: `${scenario.direction} ${scenario.decision}`,
      section: "china-talent-strategy",
      categories: [scenario.accentCategory || "talent"],
      watch: (scenario.roles || []).map((role) => `${role.name}: ${role.plan}`).concat((scenario.gates || []).map((gate) => `${gate.axis}: ${gate.status} - ${gate.implication}`)),
      metrics: [
        { label: "판단", value: scenario.verdict },
        { label: "확보 직무", value: fmtNum((scenario.roles || []).length) },
        { label: "O/X 게이트", value: fmtNum((scenario.gates || []).length) },
        { label: "크롤링 신호", value: fmtNum(chinaTalentSignalCount(scenario)) },
        { label: "ROI 지수", value: fmtNum(roi.roi) },
        { label: "Top 투자", value: roi.top?.investment?.label || "-" },
      ],
      links: [],
      tags: [scenario.label, scenario.status, "Hiring", "Retention", "IP"].filter(Boolean),
    };
  }

  function renderChinaTalentTabs(scenario) {
    const tabs = $("#talentScenarioTabs");
    if (!tabs) return;
    tabs.innerHTML = CHINA_TALENT_STRATEGY_SCENARIOS.map((item) => `
      <button class="policy-tab${item.id === scenario.id ? " active" : ""}" type="button" role="tab" aria-selected="${item.id === scenario.id ? "true" : "false"}" data-talent-scenario="${escapeHTML(item.id)}" style="--local-accent:${categoryAccent(item.accentCategory)}">
        <strong>${escapeHTML(item.label)}</strong>
        <span>${escapeHTML(item.subtitle)}</span>
      </button>
    `).join("");
    tabs.querySelectorAll("[data-talent-scenario]").forEach((btn) => {
      btn.addEventListener("click", () => {
        chinaTalentScenarioId = btn.dataset.talentScenario;
        renderChinaTalentStrategy();
      });
    });
  }

  function renderCeoChallengeAgent(scenario = activeChinaTalentScenario()) {
    const targetSelect = $("#ceoChallengeTarget");
    const challengeSelect = $("#ceoChallengeSelect");
    const answerWrap = $("#ceoAgentAnswer");
    const meta = $("#ceoChallengeMeta");
    if (!targetSelect || !challengeSelect || !answerWrap) return;

    const targets = chinaTalentChallengeTargets(scenario);
    const target = activeCeoChallengeTarget(scenario);
    const challenge = activeCeoChallenge();
    const response = buildCeoAgentAnswer(scenario, target, challenge);
    const accent = categoryAccent(scenario.accentCategory);

    targetSelect.innerHTML = targets.map((item) => `
      <option value="${escapeHTML(item.id)}"${item.id === target.id ? " selected" : ""}>${escapeHTML(item.type)} · ${escapeHTML(item.label)}</option>
    `).join("");
    challengeSelect.innerHTML = CEO_CHALLENGES.map((item) => `
      <option value="${escapeHTML(item.id)}"${item.id === challenge.id ? " selected" : ""}>${escapeHTML(item.label)}</option>
    `).join("");
    if (meta) meta.textContent = `${scenario.label} · ${target.label} · ${challenge.angle}`;

    targetSelect.onchange = (event) => {
      ceoChallengeTargetId = event.target.value;
      renderChinaTalentStrategy();
    };
    challengeSelect.onchange = (event) => {
      ceoChallengeId = event.target.value;
      renderChinaTalentStrategy();
    };

    answerWrap.style.setProperty("--local-accent", accent);
    answerWrap.innerHTML = `
      ${ceoChallengeDebateHTML(scenario, target, challenge, response)}
      <div class="agent-head">
        <span>AGENT</span>
        <div>
          <strong>${escapeHTML(response.title)}</strong>
          <small>${escapeHTML(challenge.question)}</small>
        </div>
        <button type="button" data-agent-copy>복사</button>
      </div>
      <div class="agent-metrics">
        ${(response.metrics || []).map((metric) => `
          <div><strong>${escapeHTML(metric.value)}</strong><span>${escapeHTML(metric.label)}</span></div>
        `).join("")}
      </div>
      <div class="agent-answer-grid">
        <article>
          <span>판단</span>
          <p>${escapeHTML(response.verdict)}</p>
        </article>
        <article>
          <span>논리</span>
          <p>${escapeHTML(response.logic)}</p>
        </article>
        <article>
          <span>CEO 반론에 대한 답</span>
          <p>${escapeHTML(response.counter)}</p>
        </article>
        <article>
          <span>실행 조건</span>
          <p>${escapeHTML(response.action)}</p>
        </article>
      </div>
      <div class="agent-kpi-row">
        <strong>추적 KPI</strong>
        ${(response.kpis || []).slice(0, 4).map((kpi) => `<span>${escapeHTML(kpi)}</span>`).join("")}
      </div>
    `;
    answerWrap.querySelector("[data-agent-copy]")?.addEventListener("click", (event) => {
      copyPayload({
        type: "CEO 챌린지 AGENT 답변",
        tag: challenge.angle,
        title: challenge.question,
        body: `${response.verdict}\n\n논리: ${response.logic}\n\n반론 답변: ${response.counter}\n\n실행 조건: ${response.action}`,
        section: "executive-decision",
        categories: [scenario.accentCategory || "talent"],
        metrics: response.metrics || [],
        watch: response.kpis || [],
      }, event.currentTarget);
    });
  }

  function renderChinaTalentStrategy() {
    const summary = $("#talentStrategySummary");
    const grid = $("#talentStrategyRuleGrid");
    const focus = $("#talentStrategyFocus");
    const roiGrid = $("#talentRoiGrid");
    const planning = $("#talentScenarioPlanning");
    const meta = $("#talentStrategyMeta");
    const sourceMeta = $("#talentStrategySourceMeta");
    const roiMeta = $("#talentRoiMeta");
    if (!summary || !grid || !focus) return;

    const scenario = activeChinaTalentScenario();
    const accent = categoryAccent(scenario.accentCategory);
    const payload = chinaTalentPayload(scenario);
    const liveItems = chinaTalentLiveItems(scenario, 6);
    const signalCount = chinaTalentSignalCount(scenario);
    const gateStats = chinaTalentGateStats(scenario);
    const okGates = gateStats.ok;
    const noGoGates = gateStats.noGo;
    const scenarioRoi = chinaTalentScenarioRoi(scenario);
    const theme = chinaTalentTheme();
    if (meta) meta.textContent = `${scenario.label} · 확보 직무 ${fmtNum((scenario.roles || []).length)}개 · 크롤링 신호 ${fmtNum(signalCount)}개`;
    if (sourceMeta) sourceMeta.textContent = `시나리오 ${fmtNum(CHINA_TALENT_STRATEGY_SCENARIOS.length)}개 · 라이브 ${fmtNum(liveItems.length)}개 · RSS ${fmtNum(Number(theme?.count ?? 0) || 0)}개`;
    if (roiMeta) roiMeta.textContent = `ROI 지수 ${fmtNum(scenarioRoi.roi)} · 수익성 ${fmtNum(scenarioRoi.profitability)} · ${scenarioRoi.top?.investment?.label || "투자안 확인"}`;
    renderChinaTalentTabs(scenario);
    renderCeoChallengeAgent(scenario);

    summary.style.setProperty("--local-accent", accent);
    summary.innerHTML = [
      { label: "시나리오 판단", value: scenario.verdict, note: scenario.decision },
      { label: "확보 직무", value: `${fmtNum((scenario.roles || []).length)}개`, note: (scenario.roles || []).map((role) => role.name).join(" · ") },
      { label: "O 게이트", value: `${fmtNum(okGates)}개`, note: "즉시 실행 가능한 합법적 채용/리텐션 항목" },
      { label: "X 게이트", value: `${fmtNum(noGoGates)}개`, note: "영업비밀·recipe·승인 없는 업그레이드 금지선" },
    ].map((card, index) => `
      <article class="policy-card reveal" style="animation-delay:${index * 25}ms">
        <span>${escapeHTML(card.label)}</span>
        <strong>${escapeHTML(card.value)}</strong>
        <p>${escapeHTML(card.note)}</p>
      </article>
    `).join("");

    grid.innerHTML = (scenario.gates || []).map((gate, index) => {
      const cls = policyStatusClass(gate.status);
      return `
        <article class="policy-rule-card reveal" style="--local-accent:${accent}; animation-delay:${index * 25}ms">
          <div class="policy-rule-top">
            <span class="policy-status ${cls}">${escapeHTML(gate.status)}</span>
            <small>${escapeHTML(gate.axis)}</small>
          </div>
          <h3>${escapeHTML(gate.title)}</h3>
          <p>${escapeHTML(gate.evidence)}</p>
          <em>${escapeHTML(gate.implication)}</em>
          <div class="policy-rule-foot">${sourceLinkHTML(gate.sourceUrl, gate.source || "출처")}</div>
        </article>
      `;
    }).join("");

    focus.style.setProperty("--local-accent", accent);
    focus.innerHTML = `
      <div class="policy-focus-head">
        <span class="chip accent">${escapeHTML(scenario.en)} · ${escapeHTML(scenario.status)}</span>
        <h3>${escapeHTML(scenario.label)} 인력 확보 계획</h3>
        <p>${escapeHTML(scenario.direction)}</p>
      </div>
      <div class="policy-verdict ${policyStatusClass(scenario.status)}">
        <strong>${escapeHTML(scenario.verdict)}</strong>
        <span>${escapeHTML(scenario.decision)}</span>
      </div>
      <div class="metric-row">
        <div class="metric"><strong>${fmtNum(scenarioRoi.roi)}</strong><span>ROI 지수</span></div>
        <div class="metric"><strong>${fmtNum(scenarioRoi.profitability)}</strong><span>수익성</span></div>
        <div class="metric"><strong>${fmtNum(signalCount)}</strong><span>크롤링 신호</span></div>
        <div class="metric"><strong>${fmtNum(noGoGates)}</strong><span>No-Go</span></div>
      </div>
      <div class="policy-focus-block">
        <strong>최우선 투자</strong>
        <p>${escapeHTML(scenarioRoi.top ? `${scenarioRoi.top.investment.label}: ${scenarioRoi.top.investment.monetization}` : "투자안이 없습니다.")}</p>
      </div>
      <div class="policy-focus-block">
        <strong>확보 직무</strong>
        <ul class="policy-site-list">
          ${(scenario.roles || []).map((role) => `
            <li>
              <b>${escapeHTML(role.name)}</b>
              <span>${escapeHTML(role.target)}</span>
              <small>${escapeHTML(role.plan)}</small>
            </li>
          `).join("")}
        </ul>
      </div>
      <div class="policy-focus-block">
        <strong>채용 채널</strong>
        <ul class="watch-list">
          ${(scenario.channels || []).map((channel) => `<li>${escapeHTML(channel)}</li>`).join("")}
        </ul>
      </div>
      <div class="policy-focus-block">
        <strong>실행 액션</strong>
        <ul class="watch-list">
          ${(scenario.actions || []).map((action) => `<li>${escapeHTML(action)}</li>`).join("")}
        </ul>
      </div>
      <div class="focus-actions">
        <button type="button" data-talent-strategy-copy>복사</button>
        <button type="button" data-talent-strategy-inspector>상세 패널</button>
        <button type="button" data-talent-strategy-workbench>워크벤치</button>
      </div>
    `;
    focus.querySelector("[data-talent-strategy-copy]")?.addEventListener("click", (event) => copyPayload(payload, event.currentTarget));
    focus.querySelector("[data-talent-strategy-inspector]")?.addEventListener("click", () => openInspector(payload));
    focus.querySelector("[data-talent-strategy-workbench]")?.addEventListener("click", () => {
      workbenchMode = "china-talent-strategy";
      selectedInsightId = null;
      renderWorkbench();
      jumpTo("workbench");
    });

    if (roiGrid) {
      roiGrid.innerHTML = scenarioRoi.modeled.map(({ investment, model }, index) => `
        <article class="talent-roi-card reveal" style="--local-accent:${accent}; animation-delay:${index * 35}ms">
          <div class="talent-roi-head">
            <span>${escapeHTML(investment.type)}</span>
            <b class="policy-status ${model.decisionClass}">${escapeHTML(model.decision)}</b>
          </div>
          <h3>${escapeHTML(investment.label)}</h3>
          <p>${escapeHTML(investment.investment)}</p>
          <div class="metric-row compact">
            <div class="metric"><strong>${fmtNum(model.cost)}</strong><span>투자비</span></div>
            <div class="metric"><strong>${fmtNum(model.profitability)}</strong><span>수익성</span></div>
            <div class="metric"><strong>${fmtNum(model.roi)}</strong><span>ROI</span></div>
          </div>
          <div class="scenario-bars">
            <div class="scenario-bar-row"><span>Down</span><i><b style="width:${model.downside}%"></b></i><em>${fmtNum(model.downside)}</em></div>
            <div class="scenario-bar-row"><span>Base</span><i><b style="width:${model.roi}%"></b></i><em>${fmtNum(model.roi)}</em></div>
            <div class="scenario-bar-row"><span>Up</span><i><b style="width:${model.upside}%"></b></i><em>${fmtNum(model.upside)}</em></div>
          </div>
          <div class="talent-roi-note">
            <strong>수익성 논리</strong>
            <p>${escapeHTML(investment.monetization)}</p>
            <small>${escapeHTML(model.formula)}</small>
          </div>
          <ul class="watch-list">
            ${(investment.kpis || []).slice(0, 3).map((kpi) => `<li>${escapeHTML(kpi)}</li>`).join("")}
          </ul>
        </article>
      `).join("");
    }

    if (planning) {
      planning.innerHTML = CHINA_TALENT_STRATEGY_SCENARIOS.map((item, index) => {
        const model = chinaTalentScenarioRoi(item);
        const stats = chinaTalentGateStats(item);
        return `
          <button class="scenario-card talent-plan-card reveal${item.id === scenario.id ? " active" : ""}" type="button" data-talent-plan-scenario="${escapeHTML(item.id)}" style="--local-accent:${categoryAccent(item.accentCategory)}; animation-delay:${index * 35}ms">
            <div class="scenario-card-head">
              <span>${escapeHTML(item.label)}</span>
              <strong>${fmtNum(model.roi)}</strong>
            </div>
            <p>${escapeHTML(model.top ? model.top.investment.monetization : item.decision)}</p>
            <div class="scenario-bars">
              <div class="scenario-bar-row"><span>ROI</span><i><b style="width:${model.roi}%"></b></i><em>${fmtNum(model.roi)}</em></div>
              <div class="scenario-bar-row"><span>수익성</span><i><b style="width:${model.profitability}%"></b></i><em>${fmtNum(model.profitability)}</em></div>
              <div class="scenario-bar-row"><span>하방</span><i><b style="width:${model.downside}%"></b></i><em>${fmtNum(model.downside)}</em></div>
            </div>
            <div class="talent-plan-flow" aria-hidden="true">
              <span>신호 ${fmtNum(chinaTalentSignalCount(item))}</span>
              <i>→</i>
              <span>O ${fmtNum(stats.ok)} / X ${fmtNum(stats.noGo)}</span>
              <i>→</i>
              <span>${escapeHTML(model.top?.investment?.label || "투자안")}</span>
              <i>→</i>
              <span>${escapeHTML(model.top?.model?.decision || "판단")}</span>
            </div>
          </button>
        `;
      }).join("");
      planning.querySelectorAll("[data-talent-plan-scenario]").forEach((btn) => {
        btn.addEventListener("click", () => {
          chinaTalentScenarioId = btn.dataset.talentPlanScenario;
          renderChinaTalentStrategy();
        });
      });
    }

    animateCounts(summary);
    animateCounts(grid);
    animateCounts(roiGrid || summary);
    animateCounts(planning || summary);
    animateMeters(summary);
    animateMeters(grid);
    animateMeters(roiGrid || summary);
    animateMeters(planning || summary);
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
        { label: "T+30M 모델", value: `${fmtNum(start, 1)}%` },
        { label: "5Y 모델", value: `${fmtNum(end, 1)}%` },
        { label: "Case", value: scenario.label },
        { label: "실제 신호", value: fmtNum(segment.signals) },
        { label: "모델점수", value: fmtNum(segment.score) },
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
        note: "TrendForce NAND/SSD 가격 데이터와 eSSD 기사 신호 기반",
      },
    ];
  }

  function projectionTrajectorySVG(scenarioMap, selected, horizon) {
    if (!selected) return "";
    const cases = [
      { id: "base", label: "중립", color: "#3b82f6" },
      { id: "best", label: "베스트", color: "#22c55e" },
      { id: "worst", label: "워스트", color: "#ef4444" },
    ];
    const baseSeries = scenarioMap.base || scenarioMap[Object.keys(scenarioMap)[0]] || [];
    const n = baseSeries.length;
    if (n < 2) return "";
    const W = 680, H = 240, padL = 42, padR = 14, padT = 14, padB = 28;
    const lines = cases.map((c) => {
      const ser = scenarioMap[c.id] || baseSeries;
      return { ...c, pts: ser.map((row, i) => projectionShare(ser, selected.id, i)) };
    });
    const vals = lines.flatMap((l) => l.pts);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (hi - lo < 4) { lo -= 2; hi += 2; }
    const pad = (hi - lo) * 0.12;
    lo = Math.max(0, lo - pad); hi = hi + pad;
    const xAt = (i) => padL + (W - padL - padR) * (n <= 1 ? 0 : i / (n - 1));
    const yAt = (v) => padT + (H - padT - padB) * (1 - (v - lo) / ((hi - lo) || 1));
    const years = baseSeries.map((r) => r.year);
    const grid = [0, 0.25, 0.5, 0.75, 1].map((g) => {
      const yv = lo + (hi - lo) * (1 - g);
      const yy = padT + (H - padT - padB) * g;
      return `<line x1="${padL}" y1="${yy.toFixed(1)}" x2="${W - padR}" y2="${yy.toFixed(1)}" class="pl-grid"/><text x="6" y="${(yy + 3).toFixed(1)}" class="pl-ylab">${fmtNum(yv, 0)}%</text>`;
    }).join("");
    const xlabels = years.map((yr, i) => `<text x="${xAt(i).toFixed(1)}" y="${H - 8}" class="pl-xlab" text-anchor="middle">${escapeHTML(String(yr))}</text>`).join("");
    const paths = lines.map((l) => {
      const d = l.pts.map((v, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(" ");
      const dots = l.pts.map((v, i) => `<circle cx="${xAt(i).toFixed(1)}" cy="${yAt(v).toFixed(1)}" r="2.6" fill="${l.color}"><title>${l.label} ${escapeHTML(String(years[i]))}: ${fmtNum(v, 1)}%</title></circle>`).join("");
      return `<path d="${d}" fill="none" stroke="${l.color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>${dots}`;
    }).join("");
    const legend = lines.map((l) => `<span><i style="background:${l.color}"></i>${l.label}</span>`).join("");
    return `<div class="proj-line-wrap"><div class="proj-line-head"><span class="proj-line-title">${escapeHTML(selected.title || selected.short || "제품군")} · 점유율 궤적 T+30M→5Y</span><span class="proj-line-legend">${legend}</span></div><svg viewBox="0 0 ${W} ${H}" class="proj-line-chart" preserveAspectRatio="none" role="img" aria-label="제품군 점유율 3-case 궤적">${grid}${xlabels}${paths}</svg></div>`;
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

    if (meta) meta.textContent = `${scenario.label} case · 모델 산출 · ${horizon.detail} · ${fmtNum(totalSignals)}개 신호 · ${fmtDate(LIVE.updatedAt)}`;
    if (windowNode) windowNode.textContent = `${horizon.rangeLabel} · 현재 수집일 +${PROJECTION_START_MONTHS}개월부터`;

    const summaryCards = [
      { label: "선택 케이스", value: scenario.label, note: scenario.tone },
      { label: "서버향 믹스", value: serverShare, note: "모델 산출 · AI 서버 + 데이터센터 스토리지", suffix: "%", decimals: 1 },
      { label: "단말향 믹스", value: terminalShare, note: "모델 산출 · 모바일/PC + 오토/엣지", suffix: "%", decimals: 1 },
      { label: "서버향 3-case 범위", value: `${fmtNum(worstServerShare, 1)}~${fmtNum(bestServerShare, 1)}%`, note: "Worst~Best 5Y 민감도 · 실측 아님" },
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
          <em>${selected ? escapeHTML(selected.short) : "Product"} 5Y 모델 ${fmtNum(selectedShare, 1)}%</em>
        </button>
      `;
    }).join("");

    scenarioChart.innerHTML = projectionTrajectorySVG(scenarioMap, selected, horizon) + PROJECTION_SCENARIOS.map((item, index) => {
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
          <p>${escapeHTML(item.tone)} · 모델 산출값</p>
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
          <small>${escapeHTML(segment.demand)} · 모델점수</small>
          <strong>${escapeHTML(segment.label)}</strong>
          <em>5Y 모델 ${fmtNum(endShare, 1)}% · 실제 신호 ${fmtNum(segment.signals)}건</em>
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
          <div class="metric"><strong>${fmtNum(startShare, 1)}%</strong><span>T+30개월 모델</span></div>
          <div class="metric"><strong>${fmtNum(endShare, 1)}%</strong><span>5년차 모델</span></div>
          <div class="metric"><strong>${fmtNum(selected.signals)}</strong><span>실제 신호 건수</span></div>
        </div>
        <div class="projection-focus-block scenario-note">
          <strong>검증 기준</strong>
          <p>이 탭의 비중은 실측 판매 전망이 아니라 price-history/live.json의 가격 데이터, 기사 링크, 벤치마킹 신호를 정규화한 모델 산출값입니다. 실제 숫자는 신호 건수와 가격 데이터로만 표시합니다.</p>
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
        `빅펀드·수출통제 반작용, 인재/IP 이동, 수율 레시피 유출 가능성은 SKHY가 별도로 추적해야 할 핵심 리스크입니다`,
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
    CHINA_DYNAMIC_AXES.map((axis) => ({ axis, count: axisSignalCount(axis) }))
      .filter(({ count }) => count > 0)
      .forEach(({ axis, count }, index) => {
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
    const keywords = $("#talentKeywordGrid");
    const rules = $("#talentRuleGrid");
    const meta = $("#talentRadarMeta");
    if (!summary || !companies || !keywords || !rules) return;

    const companyItems = (data.companySignals || []).filter(talentRelated);
    const keywordItems = data.keywordTaxonomy || [];
    const ruleItems = data.warningRules || [];
    const liveTalentSignals = axisSignalCount(CHINA_DYNAMIC_AXES.find((axis) => axis.id === "talent"));
    if (meta) {
      meta.textContent = `${fmtNum(companyItems.length + keywordItems.length + ruleItems.length)}개 객체 · ${activeCategoryData().label} · 채용 신호 ${fmtNum(liveTalentSignals)}건`;
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
        "SKHY는 HBM 초격차와 동시에 레거시 원가 방어, 소부장/JV 감시, 인재/IP 리스크 방어를 병행해야 합니다",
      ];
      summary.innerHTML = lines.map((line) => `<p>${escapeHTML(line)}</p>`).join("");
    }

    grid.innerHTML = "";
    items.forEach((item, index) => {
      const card = el("article", "china-deep-card reveal");
      const numericFacts = (item.facts || []).filter((fact) => /\d/.test(String(fact || "")));
      const sourceState = item.sourceUrl ? "ok" : numericFacts.length ? "fail" : "watch";
      const sourceLabel = item.sourceUrl ? "출처 연결" : numericFacts.length ? "출처 URL 필요" : "정성 분석";
      card.style.animationDelay = `${index * 35}ms`;
      card.style.setProperty("--local-accent", categoryAccent((item.linkedCategories || [])[0]));
      card.innerHTML = `
        <div class="deep-card-head">
          <span class="chip accent">${escapeHTML(item.tag)}</span>
          <span class="deep-index">${String(index + 1).padStart(2, "0")}</span>
        </div>
        <div class="evidence-row">
          ${factBadge(sourceLabel, sourceState)}
          ${item.sourceUrl ? sourceLinkHTML(item.sourceUrl, item.source || "원문") : `<span class="evidence-mini">숫자 fact ${fmtNum(numericFacts.length)}개</span>`}
        </div>
        <h3>${escapeHTML(item.title)}</h3>
        <p>${escapeHTML(item.thesis)}</p>
        <div class="deep-facts">
          ${(item.facts || []).map((fact) => `<span>${escapeHTML(fact)}${/\d/.test(String(fact || "")) && !item.sourceUrl ? " · 출처 필요" : ""}</span>`).join("")}
        </div>
        <div class="insight-box"><span>리스크</span>${escapeHTML(item.risk)}</div>
        <div class="deep-implication"><strong>SKHY 시사점</strong><span>${escapeHTML(item.implication)}</span></div>
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
        links: item.sourceUrl ? [{ title: item.source || item.title, link: item.sourceUrl }] : [],
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

  function startupCandidateLinks(item = {}) {
    return (item.recentNews || [])
      .filter((news) => String(news.link || news.sourceUrl || "").trim())
      .slice(0, 4);
  }

  function startupCandidateCategories(item = {}) {
    const categories = inferCategoriesFromText(`${item.name || ""} ${item.area || ""} ${item.thesis || ""} ${item.whyHynix || ""} ${item.watch || ""} ${(item.tags || []).join(" ")}`);
    if (categories.length) return categories;
    return ["cxl"];
  }

  function startupCandidateWatch(item = {}) {
    return [item.whyHynix, item.watch]
      .filter(Boolean)
      .flatMap((text) => String(text).split(/;|；|\s·\s/))
      .map((text) => text.trim())
      .filter(Boolean)
      .slice(0, 5);
  }

  function workbenchItems(mode = workbenchMode) {
    let items = [];
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
          { label: "모델점수", value: fmtNum(item.score) },
          { label: "실제 신호", value: fmtNum(item.signals) },
          { label: "근거 링크", value: fmtNum(item.evidenceCount || 0) },
          { label: "가격 데이터", value: fmtNum(item.priceRows || 0) },
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
          { label: "모델점수", value: fmtNum(item.score) },
          { label: "실제 신호", value: fmtNum(item.signals) },
          { label: "근거 링크", value: fmtNum(item.evidenceCount || 0) },
          { label: "가격 데이터", value: fmtNum(item.priceRows || 0) },
        ],
        tags: [item.label, item.option, item.stage].filter(Boolean),
        links: item.links || [],
      }));
    }

    if (mode === "startup-radar") {
      items = (LIVE.startups?.candidates || []).map((item) => {
        const categories = startupCandidateCategories(item);
        const links = startupCandidateLinks(item);
        return {
          id: `startup-${item.id || item.name}`,
          mode,
          type: "스타트업 투자 후보",
          tag: `${item.stage || "Stage"} · ${item.status || "Review"}`,
          title: item.name,
          body: item.thesis || item.area || "",
          section: "workbench",
          categories,
          watch: startupCandidateWatch(item),
          metrics: [
            { label: "Fit", value: fmtNum(item.fitScore || item.score || 0) },
            { label: "Signals", value: fmtNum(item.stats?.total || links.length) },
            { label: "Stage", value: item.stage || "-" },
          ],
          tags: [item.area, item.geography, item.status].filter(Boolean),
          links,
        };
      });
    }

    if (mode === "market-map") {
      items = []
        .concat(memoryMarketRelations("competitive", "all"))
        .concat(memoryMarketRelations("money", "all"))
        .map((item) => ({
          id: `market-map-${item.id}`,
          mode,
          type: item.mode === "money" ? "Money Flow" : "Competitive Dynamics",
          tag: `${item.type} · ${memoryMarketNodeName(item.from)} → ${memoryMarketNodeName(item.to)}`,
          title: item.label,
          body: item.mode === "money"
            ? "투자와 매출 노출을 분리해 수익성·방어 비용·계약 우선순위를 판단합니다."
            : "경쟁·파트너십·투자·공급 관계를 비교해 고객 락인과 가격 방어 우선순위를 판단합니다.",
          section: "memory-market-map",
          categories: item.categories || [],
          watch: [
            `${memoryMarketNodeName(item.from)} → ${memoryMarketNodeName(item.to)}`,
            `근거 ${fmtNum(item.evidenceCount)}개`,
            `가격 rows ${fmtNum(item.priceRows)}개`,
          ],
          metrics: [
            { label: "관계점수", value: fmtNum(Math.round(item.score)) },
            { label: "근거", value: fmtNum(item.evidenceCount) },
            { label: item.mode === "money" ? "Flow" : "Power", value: fmtNum(Math.round(item.mode === "money" ? item.flowIndex : item.score)) },
          ],
          links: memoryMarketEvidenceLinks(item, 4),
        }));
    }

    if (mode === "policy-makers") {
      items = POLICY_MAKER_LENSES.flatMap((lens) => (lens.rules || []).map((rule) => ({
        id: `policy-${lens.id}-${rule.axis}`,
        mode,
        type: "Policy Maker",
        tag: `${lens.label} · ${rule.status}`,
        title: `${rule.axis} · ${rule.title}`,
        body: `${rule.evidence} ${rule.implication}`,
        section: "policy-makers",
        categories: [lens.accentCategory || "geopolitics"],
        watch: [lens.direction, lens.strategy, rule.implication].concat(lens.actions || []),
        metrics: [
          { label: "국가", value: lens.label },
          { label: "판단", value: rule.status },
          { label: "상태", value: lens.status },
          { label: "출처", value: rule.source || "source" },
        ],
        tags: [lens.verdict, rule.axis, lens.law].filter(Boolean),
        links: rule.sourceUrl ? [{ title: rule.source || rule.title, link: rule.sourceUrl }] : [],
      })));
    }

    if (mode === "china-fab-infra") {
      items = CHINA_FAB_INFRA_SITES.flatMap((site) => (site.checks || []).map((check) => ({
        id: `infra-${site.id}-${check.axis}`,
        mode,
        type: "중국 Fab 인프라",
        tag: `${site.label} · ${check.status}`,
        title: `${check.axis} · ${check.title}`,
        body: `${check.evidence} ${check.implication}`,
        section: "china-fab-infra",
        categories: [site.accentCategory || "china"],
        watch: [site.direction, site.decision, check.implication],
        metrics: [
          { label: "거점", value: site.label },
          { label: "판단", value: check.status },
          { label: "신호", value: fmtNum(chinaInfraSignalCount(site)) },
          { label: "출처", value: check.source || "source" },
        ],
        tags: [site.verdict, check.axis, "Land/Water/Power"].filter(Boolean),
        links: check.sourceUrl ? [{ title: check.source || check.title, link: check.sourceUrl }] : [],
      })));
    }

    if (mode === "china-talent-strategy") {
      items = CHINA_TALENT_STRATEGY_SCENARIOS.flatMap((scenario) => (scenario.gates || []).map((gate) => ({
        id: `talent-strategy-${scenario.id}-${gate.axis}`,
        mode,
        type: "중국 인력 확보 전략",
        tag: `${scenario.label} · ${gate.status}`,
        title: `${gate.axis} · ${gate.title}`,
        body: `${scenario.direction} ${gate.evidence} ${gate.implication}`,
        section: "china-talent-strategy",
        categories: [scenario.accentCategory || "talent"],
        watch: (scenario.roles || []).map((role) => `${role.name}: ${role.plan}`).concat(scenario.actions || [], gate.implication),
        metrics: [
          { label: "시나리오", value: scenario.label },
          { label: "판단", value: gate.status },
          { label: "신호", value: fmtNum(chinaTalentSignalCount(scenario)) },
          { label: "ROI", value: fmtNum(chinaTalentScenarioRoi(scenario).roi) },
          { label: "직무", value: fmtNum((scenario.roles || []).length) },
        ],
        tags: [scenario.verdict, gate.axis, "China hiring"].filter(Boolean),
        links: gate.sourceUrl ? [{ title: gate.source || gate.title, link: gate.sourceUrl }] : [],
      })));
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
      items = (data.companySignals || []).map((item, index) => ({
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
        }));
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
            <span>${escapeHTML(fmtNum(total))}개 신호</span>
            <span>${escapeHTML(group.sections.length)}개 보드</span>
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
        jumpTo("c-level-cockpit");
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
      type: payload.type || payload.tag || "Insight",
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
        jumpTo("c-level-cockpit");
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

  function scoreRingHTML(score, label = "Score") {
    const safe = clamp(score);
    return `
      <div class="score-ring" data-score-to="${safe}" style="--score:0">
        <span class="score-value">${countHTML(safe)}</span>
        <small>${escapeHTML(label)}</small>
      </div>
    `;
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
    const sections = SECTION_ORDER;
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
      const navTarget = NAV_SECTION_TARGETS[active] || active;
      $$(".sb-item").forEach((btn) => btn.classList.toggle("active", btn.dataset.jump === navTarget));
    };
    window.addEventListener("scroll", update, { passive: true });
    update();
  }

  /* ---------------- Q&A ---------------- */
  function setupQA() {
    const input = $("#qaInput");
    const toggle = $("#qaToggle");
    const drop = $("#qaDrop");
    const box = $("#qaBox");
    if (!input || !toggle || !drop || !box) return;
    input.placeholder = QA_PLACEHOLDER;
    toggle.setAttribute("aria-expanded", "false");

    const openDrop = () => {
      renderQADrop(input.value);
      drop.hidden = false;
      box.classList.add("open");
      toggle.setAttribute("aria-expanded", "true");
    };
    const closeDrop = () => {
      drop.hidden = true;
      box.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    };

    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      if (drop.hidden) openDrop();
      else closeDrop();
    });

    input.addEventListener("focus", openDrop);
    input.addEventListener("input", () => {
      selectedQaQuestion = "";
      if (!drop.hidden) renderQADrop(input.value);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        const query = input.value;
        closeDrop();
        answerQuestion(query);
        input.value = "";
        input.placeholder = QA_PLACEHOLDER;
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
    const q = String(filter || "").trim();
    const cats = data.cats || [];
    const scored = (data.pairs || []).map((pair) => ({ pair, score: qaMatchScore(pair, q) }));
    const pairs = q
      ? scored.filter((item) => item.score > 0).sort((a, b) => b.score - a.score).map((item) => item.pair)
      : (data.pairs || []);
    const bestQuestion = q ? scored.sort((a, b) => b.score - a.score)[0]?.pair?.q : selectedQaQuestion;

    drop.innerHTML = "";
    drop.appendChild(el("div", "qa-drop-head", `
      <span>${escapeHTML(data.intro || "질문을 선택하거나 자연어로 입력하세요.")}</span>
      <strong>${fmtNum(pairs.length)}개 질문</strong>
    `));
    const appendOption = (group, pair, cat) => {
      const active = pair.q === selectedQaQuestion || (q && pair.q === bestQuestion);
      const btn = el("button", `qa-option${active ? " active" : ""}`, `
        <span class="qa-option-kicker">${escapeHTML(cat.name)} · ${escapeHTML(SECTION_LABELS[pair.nav] || "Dashboard")}</span>
        <strong>${escapeHTML(pair.q)}</strong>
        <small>${escapeHTML(qaPreview(pair.a))}</small>
      `);
      btn.type = "button";
      btn.setAttribute("aria-pressed", active ? "true" : "false");
      btn.style.setProperty("--qa", cat.color || "var(--accent)");
      btn.addEventListener("click", () => {
        selectedQaQuestion = pair.q;
        $("#qaInput").value = "";
        $("#qaInput").placeholder = QA_PLACEHOLDER;
        drop.hidden = true;
        $("#qaBox").classList.remove("open");
        $("#qaToggle").setAttribute("aria-expanded", "false");
        answerQuestion(pair.q, pair);
      });
      group.appendChild(btn);
    };
    if (q && pairs.length) {
      const group = el("div", "qa-group qa-search-results");
      group.style.setProperty("--qa", "var(--accent)");
      group.appendChild(el("div", "qa-group-title", `<span>검색 결과</span><em>관련도순</em>`));
      pairs.forEach((pair) => appendOption(group, pair, qaCat(pair)));
      drop.appendChild(group);
      return;
    }
    cats.forEach((cat) => {
      const groupPairs = pairs.filter((pair) => pair.cat === cat.id);
      if (!groupPairs.length) return;
      const group = el("div", "qa-group");
      group.style.setProperty("--qa", cat.color || "var(--accent)");
      group.appendChild(el("div", "qa-group-title", `<span>${escapeHTML(cat.name)}</span><em>${fmtNum(groupPairs.length)}</em>`));
      groupPairs.forEach((pair) => {
        appendOption(group, pair, cat);
      });
      drop.appendChild(group);
    });

    if (!drop.children.length) {
      drop.appendChild(el("div", "empty", "일치하는 질문이 없습니다. Enter를 누르면 가장 가까운 답변을 찾습니다."));
    }
  }

  function answerQuestion(query, forcedPair) {
    const data = BASE.qa || { pairs: [] };
    const q = String(query || "").trim();
    if (!q) return;

    const scored = (data.pairs || []).map((pair) => ({ pair, score: qaMatchScore(pair, q) })).sort((a, b) => b.score - a.score);
    const best = forcedPair || (scored[0]?.score > 0 ? scored[0].pair : null) || dashboardFallbackPair(q);
    selectedQaQuestion = best.q;
    const input = $("#qaInput");
    if (input) {
      input.value = "";
      input.placeholder = QA_PLACEHOLDER;
    }
    showAnswer(best, q);
  }

  function qaNormalize(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}.$%+]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function qaTerms(pair = {}, query = "") {
    const raw = `${query} ${pair.q || ""} ${(pair.keywords || []).join(" ")}`;
    const stop = new Set(["무엇인가", "무엇", "왜", "어떻게", "하나", "해야", "되나", "있나", "시장", "memory", "메모리", "대해"]);
    return Array.from(new Set(qaNormalize(raw).split(" ").filter((term) => term.length > 1 && !stop.has(term)))).slice(0, 24);
  }

  function qaScoreText(text, terms = []) {
    const hay = qaNormalize(text);
    if (!hay || !terms.length) return 0;
    return terms.reduce((score, term) => score + (hay.includes(term) ? Math.min(8, Math.max(2, term.length)) : 0), 0);
  }

  function qaMatchScore(pair = {}, query = "") {
    const q = qaNormalize(query);
    if (!q) return 0;
    const terms = qaTerms(pair, query);
    const pairHay = `${pair.q || ""} ${pair.a || ""} ${(pair.keywords || []).join(" ")}`;
    let score = qaScoreText(pairHay, terms);
    if (qaNormalize(pair.q).includes(q)) score += 18;
    (pair.keywords || []).forEach((keyword) => {
      const key = qaNormalize(keyword);
      if (key && q.includes(key)) score += 10;
    });
    return score;
  }

  function qaPreview(text = "") {
    return String(text || "").replace(/\s+/g, " ").trim().slice(0, 108);
  }

  function qaCat(pair = {}) {
    return (BASE.qa?.cats || []).find((cat) => cat.id === pair.cat) || { name: "Dashboard", color: "var(--accent)" };
  }

  function dashboardFallbackPair(query) {
    const terms = qaTerms({}, query);
    return {
      cat: "strategy",
      q: query,
      a: "정확히 일치하는 드롭다운 질문은 없지만, 입력한 자연어와 가까운 대시보드 신호를 기준으로 답합니다.\n\n아래의 관련 가격 데이터, 기사, 벤치마킹 신호를 먼저 확인하세요. 특정 업체·제품·정책 키워드를 함께 입력하면 CXMT, YMTC, HBM, NAND, BIS, TrendForce 같은 보드로 더 정확히 연결됩니다.",
      keywords: terms,
      nav: terms.some((term) => /price|spot|contract|가격|trendforce/.test(term)) ? "prices" : "overview",
    };
  }

  function qaRelatedNews(pair = {}, query = "", limit = 4) {
    const terms = qaTerms(pair, query);
    const seen = new Set();
    return rawNews()
      .map((item) => ({
        item,
        score: qaScoreText(`${newsTitle(item)} ${item.title || ""} ${item.summary || ""} ${item.source || ""} ${item.category || ""}`, terms),
      }))
      .filter(({ item, score }) => {
        const key = canonicalNewsKey(item);
        if (!key || seen.has(key) || score <= 0) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ item }) => item);
  }

  function qaRelatedPrices(pair = {}, query = "", limit = 4) {
    const terms = qaTerms(pair, query);
    const rows = allPriceRows()
      .map((row) => ({
        row,
        score: qaScoreText(`${row.group || ""} ${row.sectionTitle || ""} ${row.item || ""} ${row.direction || ""}`, terms),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ row }) => row);
    if (rows.length) return rows;
    if ((pair.nav || "") === "prices" || /spot|contract|가격|trendforce/i.test(`${query} ${(pair.keywords || []).join(" ")}`)) {
      return allPriceRows().slice(0, limit);
    }
    return [];
  }

  function qaBenchmarkCount(pair = {}, query = "") {
    const terms = qaTerms(pair, query);
    const chinaTerms = ["cxmt", "ymtc", "china", "중국", "nand", "dram", "bis", "wuxi", "fab", "ipo"];
    if (!terms.some((term) => chinaTerms.includes(term))) return 0;
    return benchmarkSignalTotal();
  }

  function qaLiveContextHTML(pair = {}, query = "") {
    const relatedNews = qaRelatedNews(pair, query, 4);
    const relatedPrices = qaRelatedPrices(pair, query, 4);
    const allRows = allPriceRows();
    const allNews = rawNews();
    const benchmarkCount = qaBenchmarkCount(pair, query);
    const metrics = [
      { label: "업데이트", value: fmtDate(LIVE.updatedAt), note: "live.json" },
      { label: "관련 기사", value: relatedNews.length || allNews.length, note: relatedNews.length ? "질문 키워드 매칭" : "전체 기사 풀" },
      { label: "가격 데이터", value: relatedPrices.length || allRows.length, note: "TrendForce spot/contract" },
      { label: "벤치마킹", value: benchmarkCount || benchmarkSignalTotal(), note: "중국·외신 신호" },
    ];
    return `
      <section class="qa-live-context">
        <div class="qa-live-head">
          <span>대시보드 최신 데이터 기반</span>
          <strong>${escapeHTML(SECTION_LABELS[pair.nav] || "관련 보드")} · ${escapeHTML(fmtDate(LIVE.updatedAt))}</strong>
        </div>
        <div class="qa-live-metrics">
          ${metrics.map((metric) => `
            <article>
              <span>${escapeHTML(metric.label)}</span>
              <strong>${typeof metric.value === "number" ? fmtNum(metric.value) : escapeHTML(metric.value)}</strong>
              <small>${escapeHTML(metric.note)}</small>
            </article>
          `).join("")}
        </div>
        ${relatedPrices.length ? `
          <div class="qa-live-block">
            <h4>연결 가격</h4>
            <ul>${relatedPrices.map((row) => `<li><span>${escapeHTML(row.group || row.sectionTitle || "Price")}</span><strong>${escapeHTML(row.item || "")}</strong><em>${escapeHTML(row.averageRaw || row.average || "-")} · ${escapeHTML(row.changeRaw || `${fmtNum(Number(row.changePct || 0), 2)}%`)}</em></li>`).join("")}</ul>
          </div>
        ` : ""}
        ${relatedNews.length ? `
          <div class="qa-live-block">
            <h4>연결 기사</h4>
            <ul>${relatedNews.map((item) => `<li><span>${escapeHTML(item.source || "News")}</span><a href="${escapeHTML(item.link || item.sourceUrl || "#")}" target="_blank" rel="noopener">${escapeHTML(newsTitle(item) || item.title || "기사")}</a><em>${escapeHTML(shortKstDate(item.date || item.publishedAt || item.crawledAt || LIVE.updatedAt) || "")}</em></li>`).join("")}</ul>
          </div>
        ` : ""}
      </section>
    `;
  }

  function showAnswer(pair, query = "") {
    const overlay = $("#qaAnswer");
    const cat = qaCat(pair);
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    overlay.innerHTML = `
      <div class="answer-panel" role="dialog" aria-modal="true" style="--answer-accent:${escapeHTML(cat.color || "var(--accent)")}">
        <div class="answer-head">
          <span>A</span>
          <div>
            <em>${escapeHTML(cat.name)} · ${escapeHTML(SECTION_LABELS[pair.nav] || "Dashboard")}</em>
            <strong>${escapeHTML(pair.q)}</strong>
          </div>
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

    typeAnswer(pair.a || "", pair, query || pair.q);
  }

  function closeAnswer() {
    if (typeTimer) clearInterval(typeTimer);
    typeTimer = null;
    $("#qaAnswer").hidden = true;
    $("#qaAnswer").innerHTML = "";
    document.body.style.overflow = "";
  }

  function typeAnswer(text, pair = {}, query = "") {
    const body = $("#answerBody");
    const highlighted = highlight(text);
    const liveHTML = qaLiveContextHTML(pair, query);
    const plain = text;
    let i = 0;
    if (typeTimer) clearInterval(typeTimer);
    typeTimer = setInterval(() => {
      i += Math.max(2, Math.ceil(plain.length / 130));
      if (i >= plain.length) {
        clearInterval(typeTimer);
        typeTimer = null;
        body.innerHTML = `${highlighted}${liveHTML}`;
        return;
      }
      body.textContent = plain.slice(0, i) + "▋";
    }, 18);
  }

  function highlight(text) {
    return escapeHTML(text).replace(
      /(CXMT|YMTC|XMC|JCET|Naura|AMEC|ACM|TrendForce|Reuters|Counterpoint|TechInsights|Yole|Nvidia|TSMC|CoWoS|Rubin|HBM4?E?|HBM5|DRAM|NAND|DDR5|LPDDR|CXL|PIM|IP|TSV|EUV|DUV|BIS|VEU|IPO|STAR|Big Fund|빅펀드|텐센트|메기|비대칭|마이크로데이터|Xtacking|eSSD)/g,
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

  function pricePointTime(point = {}) {
    const raw = point.crawledAt || point.updatedAt || point.date || point.sourceUpdate;
    const time = new Date(raw).getTime();
    return Number.isFinite(time) ? time : 0;
  }

  function kstDayKey(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const get = (type) => parts.find((part) => part.type === type)?.value || "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  }

  function shortKstDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "numeric",
      day: "numeric",
    });
  }

  function priceHistoryFor(row = {}) {
    const key = row.historyKey || row.key || `${row.sectionTitle || ""}::${row.item || ""}`.toLowerCase();
    const points = HISTORY?.items?.[key]?.points || row.history || [];
    return points
      .map((point) => ({ ...point, time: pricePointTime(point) }))
      .filter((point) => point.time && point.average != null && !Number.isNaN(Number(point.average)))
      .sort((a, b) => a.time - b.time);
  }

  function priceDateEntries() {
    const byDate = new Map();
    allPriceRows().forEach((row) => {
      priceHistoryFor(row).forEach((point) => {
        const key = kstDayKey(point.time);
        if (!key) return;
        const prev = byDate.get(key);
        if (!prev || point.time > prev.time) byDate.set(key, { key, time: point.time });
      });
    });
    return Array.from(byDate.values()).sort((a, b) => b.time - a.time);
  }

  function activePriceDateEntry() {
    const entries = priceDateEntries();
    if (!entries.length) return null;
    if (!entries.some((entry) => entry.key === priceAsOfDate)) priceAsOfDate = entries[0].key;
    return entries.find((entry) => entry.key === priceAsOfDate) || entries[0];
  }

  function activePricePeriod() {
    return PRICE_PERIODS.find((period) => period.id === pricePeriod) || PRICE_PERIODS[0];
  }

  function latestPriceDateEntry() {
    return priceDateEntries()[0] || null;
  }

  function priceUsesFullTrend() {
    return pricePeriod !== "week";
  }

  function priceTrendEndEntry() {
    return priceUsesFullTrend() ? latestPriceDateEntry() || activePriceDateEntry() : activePriceDateEntry();
  }

  function scopedPricePoints(points = []) {
    const period = activePricePeriod();
    const endEntry = priceTrendEndEntry();
    const candidates = endEntry ? points.filter((point) => point.time <= endEntry.time) : points;
    const end = candidates[candidates.length - 1] || points[points.length - 1];
    if (!end) return { scoped: [], start: null, end: null };
    const startMs = end.time - period.days * 86400000;
    const windowPoints = candidates.filter((point) => point.time >= startMs);
    const scoped = windowPoints.length ? windowPoints : candidates;
    return {
      scoped: scoped.length ? scoped : [end],
      start: scoped[0] || end,
      end,
    };
  }

  function priceTrendForRow(row = {}) {
    const points = priceHistoryFor(row);
    activePriceDateEntry();
    if (!points.length) {
      return {
        points: (row.history || []).map((point) => Number(point.average)).filter((value) => !Number.isNaN(value)),
        average: row.average,
        averageRaw: row.averageRaw,
        changePct: Number(row.changePct),
        direction: row.direction || "flat",
        rangeLabel: row.lastUpdate || "TrendForce",
      };
    }
    const { scoped, start, end } = scopedPricePoints(points);
    const startValue = Number(start?.average);
    const endValue = Number(end?.average);
    const changePct = start && end && start.time !== end.time && startValue
      ? ((endValue - startValue) / startValue) * 100
      : Number(end.changePct || 0);
    const direction = changePct > 0 ? "up" : changePct < 0 ? "down" : "flat";
    return {
      points: scoped.map((point) => Number(point.average)).filter((value) => !Number.isNaN(value)),
      average: end.average,
      averageRaw: end.averageRaw || formatPrice(end.average),
      changePct,
      direction,
      rangeLabel: `${shortKstDate(start.time)}-${shortKstDate(end.time)}`,
      rangeMode: priceUsesFullTrend() ? "수집 전체 추세" : `${activePricePeriod().label} 기준`,
      pointCount: scoped.length,
      startTime: start.time,
      endTime: end.time,
      plotPoints: scoped.map((point) => ({ time: point.time, value: Number(point.average) })).filter((point) => !Number.isNaN(point.value)),
      sourceUpdate: end.sourceUpdate,
      crawledAt: end.crawledAt,
    };
  }

  function renderPriceControls() {
    const dateSelect = $("#priceDateSelect");
    const periodTabs = $("#pricePeriodTabs");
    const entries = priceDateEntries();
    if (dateSelect) {
      if (!entries.length) {
        dateSelect.innerHTML = `<option>수집 전</option>`;
        dateSelect.disabled = true;
      } else {
        const active = activePriceDateEntry();
        dateSelect.disabled = false;
        dateSelect.innerHTML = entries.map((entry, index) => `
          <option value="${escapeHTML(entry.key)}"${entry.key === active?.key ? " selected" : ""}>${escapeHTML(shortKstDate(entry.time))}${index === 0 ? " · 최근" : ""}</option>
        `).join("");
        dateSelect.onchange = (event) => {
          priceAsOfDate = event.target.value;
          renderPrices();
        };
      }
    }
    if (periodTabs) {
      periodTabs.innerHTML = PRICE_PERIODS.map((period) => `
        <button type="button" class="${period.id === pricePeriod ? "active" : ""}" data-price-period="${escapeHTML(period.id)}">${escapeHTML(period.label)}</button>
      `).join("");
      periodTabs.querySelectorAll("[data-price-period]").forEach((btn) => {
        btn.addEventListener("click", () => {
          pricePeriod = btn.dataset.pricePeriod || "week";
          renderPrices();
        });
      });
    }
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

    renderPriceControls();
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
    const summary = $("#priceSummary");
    if (!summary) return;
    const rows = priceRowsFor();
    const trends = rows
      .map((row) => ({ row, trend: priceTrendForRow(row) }))
      .filter((item) => (item.trend.plotPoints || []).length >= 2);
    if (!trends.length) {
      summary.hidden = true;
      summary.innerHTML = "";
      return;
    }
    const visible = trends
      .sort((a, b) => (b.trend.pointCount || 0) - (a.trend.pointCount || 0))
      .slice(0, 6);
    const changed = trends.filter((item) => Number(item.trend.changePct) !== 0);
    const up = trends.filter((item) => Number(item.trend.changePct) > 0).length;
    const down = trends.filter((item) => Number(item.trend.changePct) < 0).length;
    const leader = changed
      .slice()
      .sort((a, b) => Math.abs(Number(b.trend.changePct || 0)) - Math.abs(Number(a.trend.changePct || 0)))[0] || trends[0];
    const rangeStart = Math.min(...visible.map((item) => item.trend.startTime).filter(Number.isFinite));
    const rangeEnd = Math.max(...visible.map((item) => item.trend.endTime).filter(Number.isFinite));
    summary.hidden = false;
    summary.innerHTML = `
      <article class="price-trend-card price-trend-wide">
        <div class="price-trend-head">
          <div>
            <span>${escapeHTML(priceUsesFullTrend() ? "전체 트렌드" : "주간 트렌드")}</span>
            <strong>${escapeHTML(shortKstDate(rangeStart))} - ${escapeHTML(shortKstDate(rangeEnd))}</strong>
          </div>
          <em>${escapeHTML(activePricePeriod().label)} · ${escapeHTML(priceFilter === "all" ? "Spot+Contract" : priceFilter)}</em>
        </div>
        ${priceTrendSvg(visible)}
        <div class="price-trend-legend">
          ${visible.map((item, index) => `
            <span style="--series:${escapeHTML(priceSeriesColor(index))}">
              <i></i>${escapeHTML(item.row.item)}
            </span>
          `).join("")}
        </div>
      </article>
      <article class="price-trend-card">
        <span>상승/하락</span>
        <strong>${escapeHTML(`${up}/${down}`)}</strong>
        <small>${escapeHTML(trends.length)}개 품목 · 실제 수집 히스토리</small>
      </article>
      <article class="price-trend-card">
        <span>최대 변동</span>
        <strong>${escapeHTML(formatChange(leader.trend))}</strong>
        <small>${escapeHTML(leader.row.item || "품목")}</small>
      </article>
    `;
  }

  function priceSeriesColor(index = 0) {
    return ["#22C55E", "#3C82FF", "#FFB830", "#A050FF", "#EF4444", "#00C8A0"][index % 6];
  }

  function priceTrendSvg(items = []) {
    const width = 720;
    const height = 170;
    const pad = { top: 12, right: 12, bottom: 18, left: 12 };
    const allTimes = items.flatMap((item) => (item.trend.plotPoints || []).map((point) => point.time)).filter(Number.isFinite);
    const minTime = Math.min(...allTimes);
    const maxTime = Math.max(...allTimes);
    const timeRange = maxTime - minTime || 1;
    const paths = items.map((item, index) => {
      const points = item.trend.plotPoints || [];
      const values = points.map((point) => point.value);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min || 1;
      const d = points.map((point, pointIndex) => {
        const x = pad.left + ((point.time - minTime) / timeRange) * (width - pad.left - pad.right);
        const normalized = (point.value - min) / range;
        const y = pad.top + (1 - normalized) * (height - pad.top - pad.bottom);
        return `${pointIndex ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(" ");
      const last = points[points.length - 1];
      const lastX = last ? pad.left + ((last.time - minTime) / timeRange) * (width - pad.left - pad.right) : 0;
      const lastNorm = last ? (last.value - min) / range : 0;
      const lastY = pad.top + (1 - lastNorm) * (height - pad.top - pad.bottom);
      const color = priceSeriesColor(index);
      return `
        <path d="${escapeHTML(d)}" fill="none" stroke="${escapeHTML(color)}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path>
        <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="3.4" fill="${escapeHTML(color)}"></circle>
      `;
    }).join("");
    return `
      <svg class="price-trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="기간별 가격 추이 정규화 차트">
        <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${height - pad.bottom}" class="price-grid-line"></line>
        <line x1="${pad.left}" y1="${height - pad.bottom}" x2="${width - pad.right}" y2="${height - pad.bottom}" class="price-grid-line"></line>
        <line x1="${pad.left}" y1="${pad.top + (height - pad.top - pad.bottom) / 2}" x2="${width - pad.right}" y2="${pad.top + (height - pad.top - pad.bottom) / 2}" class="price-grid-line faint"></line>
        ${paths}
        <text x="${pad.left}" y="${height - 3}" class="price-axis-label">${escapeHTML(shortKstDate(minTime))}</text>
        <text x="${width - pad.right}" y="${height - 3}" text-anchor="end" class="price-axis-label">${escapeHTML(shortKstDate(maxTime))}</text>
      </svg>
    `;
  }

  function renderPriceRows() {
    const tbody = $("#priceRows");
    const rows = priceRowsFor();
    tbody.innerHTML = "";
    if (!rows.length) {
      const entries = healthEntries(["가격:"]);
      const failed = entries.filter((entry) => !entry.ok).map((entry) => entry.msg).filter(Boolean).join(" · ");
      const msg = failed || "TrendForce 공개 테이블 구조 변경, 접근 실패, 또는 아직 수집된 rows가 없습니다.";
      tbody.appendChild(el("tr", null, `<td colspan="6" class="empty"><span class="data-state fail">오류 발생 · 가격 데이터 없음</span><br>${escapeHTML(msg)}<br>다음 행동: 전일 가격 히스토리 폴백 여부를 점검하세요.<br>마지막 시도: ${escapeHTML(fmtDate(LIVE.prices?.updatedAt || LIVE.updatedAt))}</td>`));
      return;
    }

    rows.slice(0, 22).forEach((row) => {
      const tr = el("tr");
      const trend = priceTrendForRow(row);
      const change = formatChange(trend);
      tr.innerHTML = `
        <td><span class="source-tag">${escapeHTML(row.group || "")}</span></td>
        <td><span class="price-main">${escapeHTML(row.item)}</span><span class="price-sub">${escapeHTML(row.sectionTitle || "")}</span></td>
        <td>${escapeHTML(trend.averageRaw || formatPrice(trend.average))}</td>
        <td><span class="change ${escapeHTML(trend.direction || "flat")}">${escapeHTML(change)}</span><span class="price-sub">${escapeHTML(trend.rangeMode || `${activePricePeriod().label} 기준`)} · ${escapeHTML(String(trend.pointCount || trend.points?.length || 0))}개</span></td>
        <td></td>
        <td><a class="rainbow" href="${escapeHTML(row.sourceUrl || "#")}" target="_blank" rel="noopener">${escapeHTML(trend.rangeLabel || row.lastUpdate || "TrendForce")}</a></td>
      `;
      tr.children[4].appendChild(sparkline(trend.points, trend.direction));
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
    if (!vals || vals.length < 2) return el("span", "price-sub", "히스토리 누적 전");
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
    const clean = dedupeNews(curated.concat(live)
      .filter((item) => isForeignNews(item) && isMemoryRelevant(item) && !isAppleContent(item) && !isLowConfidenceNews(item)));
    return clean.length ? clean : (BASE.fallbackNews || []);
  }

  function canonicalNewsKey(item = {}) {
    const url = String(item.link || item.sourceUrl || "").trim();
    if (url) {
      try {
        const parsed = new URL(url);
        parsed.hash = "";
        parsed.searchParams.delete("utm_source");
        parsed.searchParams.delete("utm_medium");
        parsed.searchParams.delete("utm_campaign");
        parsed.searchParams.delete("utm_term");
        parsed.searchParams.delete("utm_content");
        return `url:${parsed.toString().replace(/\/$/, "").toLowerCase()}`;
      } catch {
        return `url:${url.replace(/#.*$/, "").replace(/\/$/, "").toLowerCase()}`;
      }
    }
    const title = cleanKoreanTitle(item.titleKo || item.title || "")
      .toLowerCase()
      .replace(/^(핵심|벤치마킹|체크포인트)\s*:\s*/, "")
      .replace(/\s+/g, " ")
      .trim();
    const source = String(item.source || "").toLowerCase().trim();
    return title ? `title:${title}|${source}` : "";
  }

  function mergeNewsDuplicate(prev = {}, next = {}) {
    const prevScore = (prev.titleKo ? 4 : 0) + (prev.summary ? 2 : 0) + (prev.source ? 1 : 0);
    const nextScore = (next.titleKo ? 4 : 0) + (next.summary ? 2 : 0) + (next.source ? 1 : 0);
    const base = nextScore > prevScore ? next : prev;
    const other = base === next ? prev : next;
    return {
      ...other,
      ...base,
      link: base.link || other.link,
      sourceUrl: base.sourceUrl || other.sourceUrl,
      source: base.source || other.source,
      titleKo: stripTrailingSource(base.titleKo || other.titleKo || "", base.source || other.source),
      title: stripTrailingSource(base.title || other.title || "", base.source || other.source),
      summary: base.summary || other.summary,
      category: base.category || other.category,
      date: base.date || other.date,
      language: base.language || other.language,
    };
  }

  function dedupeNews(items = []) {
    const byKey = new Map();
    items.forEach((item) => {
      const key = canonicalNewsKey(item);
      if (!key) return;
      byKey.set(key, byKey.has(key) ? mergeNewsDuplicate(byKey.get(key), item) : item);
    });
    return Array.from(byKey.values());
  }

  function isForeignNews(item) {
    if (!item || !item.title) return false;
    const src = `${item.source || ""} ${item.link || ""} ${item.sourceUrl || ""} ${item.placement || ""}`.toLowerCase();
    if (KOREAN_SOURCE_RE.test(src)) return false;
    return true;
  }

  function isLowConfidenceNews(item) {
    if (item?.curated) return false;
    const hay = `${item?.source || ""} ${item?.title || ""} ${item?.summary || ""} ${item?.link || ""}`;
    return LOW_CONFIDENCE_NEWS_RE.test(hay);
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
    return stripTrailingSource(cleanKoreanTitle(item.titleKo || item.title || ""), item.source);
  }

  function stripTrailingSource(title, source) {
    let clean = String(title || "").replace(/\s+/g, " ").trim();
    const src = String(source || "").replace(/\s+/g, " ").trim();
    if (!clean || !src) return clean;
    const lower = clean.toLowerCase();
    const srcLower = src.toLowerCase();
    [" - ", " – ", " — ", " | ", " :: "].forEach((sep) => {
      const suffix = `${sep}${srcLower}`;
      if (lower.endsWith(suffix)) clean = clean.slice(0, -suffix.length).trim();
    });
    return clean;
  }

  function cleanKoreanTitle(title) {
    return String(title || "")
      .replace(SOURCE_SUFFIX_RE, "")
      .replace(/\bSamsung\b/g, "삼성")
      .replace(/\bMicron\b/g, "마이크론")
      .replace(/\bNVIDIA\b/g, "엔비디아")
      .replace(/\bSK Hynix\b/gi, "SKHY")
      .replace(/SK\s*하이닉스/g, "SKHY")
      .replace(/SK하이닉스/g, "SKHY")
      .replace(/SK\s*하이닉스/g, "SKHY")
      .replace(/SK하이닉스/g, "SKHY")
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
    const summary = cleanInsightText(item.summary || "");
    const category = CATEGORY_INSIGHTS[item.category] || "메모리 업계 가격·고객·공급망 변화를 함께 점검";
    const rows = [
      { label: "요약", text: newsSummaryLine(item, title, summary, category) },
      { label: "인사이트", text: newsImpactLine(item, category) },
      { label: "확인 포인트", text: newsCheckLine(item) },
    ];
    return uniqueInsightRows(rows);
  }

  function cleanInsightText(text) {
    return cleanKoreanTitle(text || "")
      .replace(/^(요약|관찰|인사이트|확인|확인 포인트)\s*[:：]\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function newsSummaryLine(item, title, summary, category) {
    const cleanedTitle = cleanInsightText(title);
    const cleanedCategory = cleanInsightText(category);
    if (summary && !sameInsightText(summary, cleanedTitle) && !sameInsightText(summary, cleanedCategory)) {
      return summary;
    }

    const placement = cleanInsightText(String(item.placement || "").replace(/[·|/]+/g, " · "));
    if (placement && !sameInsightText(placement, cleanedCategory)) {
      return `${cleanedTitle ? `${cleanedTitle}: ` : ""}${placement}`;
    }

    if (cleanedTitle) {
      return `${cleanedTitle} 관련 가격·고객·공급망 신호 확인`;
    }
    return cleanedCategory || "메모리 업계 신호를 가격·고객·공급망 관점에서 확인";
  }

  function newsImpactLine(item, category) {
    const impacts = {
      hbm: "HBM4/HBM4E 고객 ramp와 패키징 병목이 프리미엄 메모리 공급 우위 좌우",
      dram: "DDR5·LPDDR 물량 확대는 범용 DRAM spot/contract 하방 압력의 선행 신호",
      nand: "eSSD·client SSD 채택 변화가 NAND 회복 강도와 Solidigm 방어 전략 변수",
      cxl: "CXL·PIM PoC와 인증이 Post-HBM 옵션 투자 우선순위 변화 요인",
      packaging: "XMC·JCET·TFME 패키징 우회로는 선단 공정 격차 보완 변수",
      aidemand: "AI 서버·eSSD 수요가 HBM, DDR5, NAND 가격 방어력을 동시 지지",
      china: "중국 내수 고객·정책자금·장비 내재화가 가격보다 먼저 경쟁 구도 변화",
      equipment: "Naura·AMEC·ACM 장비 qual은 YMTC·CXMT ramp 속도의 선행지표",
      geopolitics: "BIS·MATCH Act·VEU 변화가 중국 fab 증설과 장비 교체 타임라인 좌우",
      talent: "수율 엔지니어·채용 JD 증가는 공정 병목과 IP 리스크 조기 신호",
      operations: "Wuxi·Dalian·Solidigm 운영 변화는 중국 노출과 NAND 방어 전략 변수",
    };
    return impacts[item.category] || category || "가격·고객·공급망 변화가 다음 의사결정 우선순위 변화 요인";
  }

  function newsCheckLine(item) {
    const source = cleanInsightText(item.source || "원문");
    const date = formatNewsDate(item.date || item.published);
    const sourceText = `${source}${date ? ` · ${date}` : ""}`;
    return isChinaArticle(item)
      ? `${sourceText} 기준 업체·캐파·정책 수치 분리 검증`
      : `${sourceText} 기준 가격·수요·고객 수치 원문 확인`;
  }

  function uniqueInsightRows(rows) {
    const seen = new Set();
    const fallback = [
      "원문 제목과 요약을 분리해 같은 문장이 반복되지 않도록 정리했습니다.",
      "사업 영향은 가격·고객·공급망 중 어느 축이 움직이는지로 판단합니다.",
      "원문 링크·발표일·수치 출처를 확인한 뒤 의사결정 보드에 연결합니다.",
    ];
    return rows.map((row, index) => {
      let text = cleanInsightText(row.text);
      if (!text || seen.has(insightKey(text))) text = fallback[index] || fallback[fallback.length - 1];
      seen.add(insightKey(text));
      return `${row.label}: ${clipText(text, index === 0 ? 92 : 88)}`;
    });
  }

  function sameInsightText(left, right) {
    const a = insightKey(left);
    const b = insightKey(right);
    return Boolean(a && b && a === b);
  }

  function insightKey(text) {
    return cleanInsightText(text)
      .toLowerCase()
      .replace(/[\s·.,:;|/()[\]{}'"“”‘’!?%+\-→~$]+/g, "");
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
    const clean = briefCopyText(text).replace(/\s+/g, " ").trim();
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

  function setNewsFreshness() {
    const node = $("#newsFreshness");
    if (!node) return;
    const updatedAt = LIVE.news?.updatedAt || LIVE.updatedAt;
    const total = rawNews().length;
    const stale = hoursSince(updatedAt) > 18;
    const cls = total && !stale ? "ok" : "stale";
    const label = total ? (stale ? "업데이트 지연" : "업데이트") : "조건에 맞는 결과 없음";
    node.className = `freshness-badge ${cls}`;
    node.textContent = `${label} · 뉴스 · ${fmtDate(updatedAt)} · Google News RSS + 큐레이션`;
  }

  function renderNews() {
    const tabs = $("#newsTabs");
    tabs.innerHTML = "";
    const cats = memoryCategories().filter((cat) => cat.id !== "all");
    const options = [{ id: "all", label: "전체", count: newsForView("all").length }].concat(cats.map((cat) => ({
      id: cat.id,
      label: cat.label,
      count: newsForView(cat.id).length,
    })).filter((opt) => opt.count > 0));

    if (activeCategory !== "all" && options.some((opt) => opt.id === activeCategory)) {
      newsCategory = activeCategory;
    }
    if (!options.some((opt) => opt.id === newsCategory)) newsCategory = "all";

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
    setNewsFreshness();
    renderNewsBucket($(`#${activeTab.listId}`), items, `조건에 맞는 ${activeTab.label} 없음`);
  }

  function renderNewsBucket(list, items, emptyMessage) {
    list.innerHTML = "";
    if (!items.length) {
      list.appendChild(el("li", "news-empty-row", `<span class="empty empty-action"><strong>${escapeHTML(emptyMessage)}</strong><em>업체 드롭다운을 전체 업체로 바꾸거나 검색어를 줄이면 즉시 다시 계산됩니다.</em></span>`));
      return;
    }

    items.slice(0, 42).forEach((item) => {
      const li = el("li", "news-card-item");
      const card = el("article", "news-card");
      const a = el("a", "news-title");
      a.href = item.link || "#";
      a.target = "_blank";
      a.rel = "noopener";
      const insights = insightLines(item);
      a.textContent = newsTitle(item);
      card.innerHTML = `
        <div class="news-card-head">
          <span class="source-tag">${escapeHTML(item.source || "Foreign source")}</span>
          <span class="news-meta">${escapeHTML(formatNewsDate(item.date || item.published))}</span>
        </div>
        <div class="news-insights">
          ${insights.map((line) => `<span>${escapeHTML(line)}</span>`).join("")}
        </div>
      `;
      card.insertBefore(a, card.querySelector(".news-insights"));
      li.appendChild(card);
      list.appendChild(li);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
