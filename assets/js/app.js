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

  const KOREAN_SOURCE_RE =
    /(yonhap|korea ?herald|korea ?times|koreatimes|koreaherald|chosun|joongang|joong ?ang|donga|dong-?a|hankyung|hankyoreh|ked ?global|kedglobal|maeil|maekyung|pulse ?news|business ?korea|businesskorea|et ?news|etnews|the ?elec|thelec|zdnet ?korea|sedaily|seoul ?economic|aju ?(business|news|press)|korea ?economic|korea ?joongang|korea ?biz ?wire|koreabizwire|inews24|edaily|mt\.co\.kr|mk\.co\.kr|dt\.co\.kr|\.kr\b|korea ?pro|the ?korea|naver|daum|fnnews|newspim|moneytoday|heraldcorp)/i;
  const MEMORY_NEWS_RE =
    /(memory|dram|nand|hbm|ddr|lpddr|gddr|ssd|semiconductor|chip|wafer|foundry|packaging|interconnect|cxl|trendforce|dramexchange|micron|samsung|sk hynix|hynix|kioxia|western digital|sandisk|cxmt|changxin|ymtc|yangtze|jcet|tfme|xmc|wuhan xinxin|naura|amec|acm research|techinsights|yole|big fund|export control|china chip|chinese chip)/i;
  const CHINA_NEWS_RE =
    /(china|chinese|cxmt|changxin|ymtc|yangtze|jcet|tfme|xmc|wuhan|naura|amec|huawei|tencent|alibaba|baidu|lenovo|big fund|36kr|pandaily|caixin|yicai|scmp|kraneshares|sina|sohu|eastmoney|huxiu|jiwei|c114|digitimes asia)/i;
  const APPLE_CONTENT_RE =
    /\b(apple|applem|aapl|iphone|ipad|macbook|9to5mac|applemagazine)\b|애플|아이폰|아이패드|맥북/i;
  const SOURCE_SUFFIX_RE = /\s[-–—]\s(?:[A-Za-z0-9가-힣 .·&]+)$/;
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
    corpdev: "M&A·JV·IPO·지분·정책자금·장기 공급계약을 거래 이벤트로 추적",
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
    corpdev: "#B45309",
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
    "daily-review": "#A7F3D0",
    numbers: "#FDE68A",
    workbench: "#B9A7FF",
    "ai-matrix": "#C4B5FD",
    crawler: "#7EE7C8",
    prices: "#FFD166",
    news: "#93C5FD",
    "china-dynamics": "#7DD3FC",
    "talent-radar": "#F0ABFC",
    "china-deep-dive": "#86EFAC",
    corpdev: "#FCD34D",
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
      id: "crawler",
      label: "크롤링 관제",
      sub: "Source · Health · Map",
      section: "crawler",
    },
    {
      id: "architecture",
      label: "AI Matrix",
      sub: "HBM · CXL · Commodity",
      section: "ai-matrix",
    },
    {
      id: "dynamics",
      label: "중국 다이내믹스",
      sub: "캐파 · 장비 · 패키징",
      section: "china-dynamics",
    },
    {
      id: "talent",
      label: "인재 레이더",
      sub: "Hiring · Campus · IP",
      section: "talent-radar",
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
      id: "corpdev",
      label: "Corp Dev",
      sub: "M&A · JV · IPO",
      section: "corpdev",
    },
    {
      id: "intelligence",
      label: "정보 채널",
      sub: "Finance · Hiring · Teardown",
      section: "intelligence",
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
    { id: "corpdev", label: "거래/자본", sub: "IPO · JV · 공급계약", categories: ["corpdev", "operations"], keywords: ["ipo", "jv", "m&a", "계약", "지분", "투자", "fund"] },
    { id: "pipeline", label: "수집상태", sub: "Freshness · Health", categories: ["operations"], keywords: ["freshness", "health", "crawler", "rows", "뉴스", "수집", "pipeline"] },
  ];
  const SECTION_LABELS = {
    "daily-review": "일일 리뷰 큐",
    numbers: "숫자 대시보드",
    crawler: "전체 크롤링 관제",
    "ai-matrix": "AI 메모리 매트릭스",
    "china-dynamics": "중국 반도체 다이내믹스",
    "talent-radar": "인재·채용 레이더",
    "china-deep-dive": "중국 심층 벤치마킹",
    corpdev: "Corp Dev 레이어",
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
      id: "talent-hiring-radar",
      label: "인재·채용 레이더",
      source: "CXMT/YMTC 공식 채용 · Boss Zhipin/Liepin/Maimai · Tsinghua/HUST · ijiwei/IP",
      method: "TSV, Yield, Advanced Packaging, Xtacking, eSSD, tool qual, campus recruiting 키워드를 MECE 축으로 분류",
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
  let activeCategory = "all";
  let priceFilter = "all";
  let newsCategory = "all";
  let newsSearch = "";
  let newsCompany = "all";
  let newsSource = "english";
  let workbenchMode = "review";
  let corpDevLayer = "all";
  let selectedInsightId = null;
  let reviewView = "today";
  let selectedReviewId = null;
  let numberLens = "all";
  let dynamicFocusId = null;
  let modelFocusId = null;
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
    [BASE, LIVE] = await Promise.all([
      loadJSON("data/baseline.json", null),
      loadJSON("data/live.json", emptyLive),
    ]);

    if (!BASE) {
      document.body.innerHTML = "<main class=\"empty\">baseline.json을 불러오지 못했습니다.</main>";
      return;
    }

    renderChrome();
    renderSidebarCategories();
    renderKpis();
    renderDailyReview();
    renderNumberDashboard();
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
    renderChinaDynamics();
    renderTalentRadar();
    renderChinaDeepDive();
    renderCorpDev();
    renderWorkbench();
    setupQA();
    setupInteractions();
    setupScrollSpy();
    animateCounts();
  }

  function memoryCategories() {
    return BASE.memoryCategories || [];
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

  function renderChrome() {
    document.title = BASE.meta?.title || document.title;
    const saved = localStorage.getItem("memory-theme") || "light";
    document.documentElement.dataset.theme = saved;
    const savedPalette = Number(localStorage.getItem("memory-palette-index") || 0);
    applyPalette(savedPalette);
    setSidebarCollapsed(localStorage.getItem("memory-sidebar-collapsed") === "1", { persist: false, cycle: false });
    decorateSidebarItems();

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
    activeCategory = id;
    const cat = activeCategoryData();
    $("#categoryMeta").textContent = `${cat.label} · ${cat.desc}`;
    $$(".sb-cat").forEach((btn) => btn.classList.toggle("active", btn.dataset.category === id));
    renderDailyReview();
    renderNumberDashboard();
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
    renderCorpDev();
    renderWorkbench();
    animateCounts();
  }

  function renderKpis() {
    const strip = $("#overview");
    strip.innerHTML = "";
    (BASE.kpis || []).forEach((kpi, index) => {
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
    return seed.concat(liveReviewItems())
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
      { label: "New since last review", value: newCount, note: "새로 들어온 기사·가격·거래 이벤트" },
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
    const corpLayers = Object.values(BASE.corpDev?.layers || {});
    const corpEvents = corpLayers.reduce((sum, layer) => sum + (layer.items || []).length, 0);
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
      {
        id: "live-corpdev-events",
        kind: "Corp Dev",
        title: "거래·자본 이벤트",
        value: corpEvents,
        suffix: "건",
        note: "M&A · JV · IPO · 지분투자 · 정부펀드 · 장기 공급계약 레이어",
        badge: "Layer",
        statusClass: "watch",
        source: "baseline corpDev layer",
        sourceDate: "versioned",
        linkedCategories: ["corpdev", "geopolitics", "equipment"],
      },
    ];
    return baseItems.concat(liveItems);
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
          <div class="number-bar"><i style="width:${numberProgress(item)}%"></i></div>
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
  }

  function relatedToActive(item) {
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
    (BASE.channels || []).filter(relatedToActive).forEach((item, index) => {
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

    flow.innerHTML = "";
    pipelineItems.forEach((item, index) => {
      const card = el("article", "crawler-card reveal");
      card.style.animationDelay = `${index * 30}ms`;
      card.style.setProperty("--local-accent", categoryAccent((item.linkedCategories || [])[0]));
      card.innerHTML = `
        <div class="crawler-card-head">
          <span class="chip accent">${escapeHTML(item.label)}</span>
          <span class="crawler-status ${escapeHTML(item.status.cls)}">${escapeHTML(item.status.label)}</span>
        </div>
        <h3>${escapeHTML(item.source)}</h3>
        <p>${escapeHTML(item.method)}</p>
        <div class="crawl-tags">${item.fields.map((field) => `<span>${escapeHTML(field)}</span>`).join("")}</div>
        <div class="crawler-rule">
          <strong>필터/분류</strong>
          <span>${escapeHTML(item.filters.join(" → "))}</span>
        </div>
        <div class="crawler-card-foot">
          <span>${fmtNum(item.signalCount)}개 신호</span>
          <button type="button" data-crawl-jump="${escapeHTML(item.section)}">${escapeHTML(SECTION_LABELS[item.section] || item.output)}</button>
        </div>
      `;
      card.querySelector("[data-crawl-jump]")?.addEventListener("click", () => jumpTo(item.section));
      makeInspectable(card, {
        type: "크롤링 파이프라인",
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
      });
      flow.appendChild(card);
    });

    const taxonomyRows = []
      .concat((LIVE.categories || []).map((category) => ({
        type: "뉴스 카테고리",
        label: category.label || category.id,
        count: Number(category.count ?? category.items?.length ?? 0) || 0,
        note: `${fmtNum(category.items?.length || 0)}개 샘플 · 기사 탭/자연어 검색`,
      })))
      .concat((LIVE.benchmarkSignals?.themes || []).map((theme) => ({
        type: "벤치마킹 테마",
        label: theme.label || theme.id,
        count: Number(theme.count ?? theme.items?.length ?? 0) || 0,
        note: `${fmtNum(theme.items?.length || 0)}개 샘플 · 중국 다이내믹스`,
      })))
      .filter((row) => {
        if (activeCategory === "all") return true;
        const hay = `${row.label} ${row.type}`.toLowerCase();
        return hay.includes(activeCategory.toLowerCase()) || categoryName(activeCategory).includes(row.label);
      });

    taxonomy.innerHTML = taxonomyRows.length ? taxonomyRows.map((row) => `
      <div class="crawler-tax-row">
        <span>${escapeHTML(row.type)}</span>
        <strong>${escapeHTML(row.label)}</strong>
        <em>${fmtNum(row.count)}건 · ${escapeHTML(row.note)}</em>
      </div>
    `).join("") : `<div class="empty">선택한 카테고리에 직접 연결된 분류 로그가 없습니다.</div>`;

    const healthOk = health.filter((entry) => entry.ok).length;
    const healthMeta = $("#crawlerHealthMeta");
    if (healthMeta) healthMeta.textContent = `${fmtNum(healthOk)}/${fmtNum(health.length)} 정상`;
    healthWrap.innerHTML = health.length ? health.map((entry) => `
      <div class="health-chip ${entry.ok ? "ok" : "fail"}">
        <strong>${escapeHTML(entry.step || "step")}</strong>
        <span>${escapeHTML(entry.msg || "")}</span>
      </div>
    `).join("") : `<div class="empty">수집 로그가 아직 없습니다.</div>`;
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
        type: "MECE 크롤링 타깃",
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

  function corpDevLayers() {
    return BASE.corpDev?.layers || [];
  }

  function corpDevEvents(layerId = corpDevLayer) {
    return corpDevLayers().flatMap((layer) => (layer.events || []).map((event) => ({
      ...event,
      layerId: layer.id,
      layerLabel: layer.label,
      layerTitle: layer.title,
      layerDesc: layer.desc,
    }))).filter((event) => {
      const layerMatch = layerId === "all" || event.layerId === layerId;
      const categoryMatch = activeCategory === "all" || (event.linkedCategories || []).includes(activeCategory);
      return layerMatch && categoryMatch;
    });
  }

  function renderCorpDev() {
    const summary = $("#corpdevSummary");
    const tabs = $("#corpdevLayerTabs");
    const grid = $("#corpdevGrid");
    const ledger = $("#claimLedger");
    const meta = $("#corpdevMeta");
    if (!summary || !tabs || !grid) return;

    const layers = corpDevLayers();
    const allEvents = corpDevEvents("all");
    const visibleEvents = corpDevEvents();
    const okClaims = (BASE.claimLedger || []).filter((claim) => String(claim.statusClass || "").toLowerCase() === "ok").length;
    if (meta) meta.textContent = `${fmtNum(layers.length)}개 레이어 · ${fmtNum(allEvents.length)}개 이벤트 · ${activeCategoryData().label}`;

    const summaryCards = [
      { label: "레이어", value: layers.length, note: "M&A · JV · IPO · 지분 · 정책자금 · 장기계약" },
      { label: "거래/자본 이벤트", value: allEvents.length, note: "중국 메모리 생태계 Corp Dev 신호" },
      { label: "검증 OK", value: okClaims, note: "팩트 레저 기준 확정/공식 항목" },
      { label: "업데이트", value: fmtDate(LIVE.updatedAt), note: "크롤링·큐레이션 결합" },
    ];
    summary.innerHTML = summaryCards.map((card) => `
      <article class="card">
        <span class="chip accent">${escapeHTML(card.label)}</span>
        <h3>${typeof card.value === "number" ? countHTML(card.value) : escapeHTML(card.value)}</h3>
        <p>${escapeHTML(card.note)}</p>
      </article>
    `).join("");

    const layerOptions = [{ id: "all", label: "전체", count: allEvents.length }].concat(layers.map((layer) => ({
      id: layer.id,
      label: layer.label,
      count: corpDevEvents(layer.id).length,
    })));
    tabs.innerHTML = layerOptions.map((layer) => `
      <button type="button" class="${layer.id === corpDevLayer ? "active" : ""}" data-corpdev-layer="${escapeHTML(layer.id)}">
        <span>${escapeHTML(layer.label)}</span><small>${fmtNum(layer.count)}</small>
      </button>
    `).join("");
    tabs.querySelectorAll("[data-corpdev-layer]").forEach((btn) => {
      btn.addEventListener("click", () => {
        corpDevLayer = btn.dataset.corpdevLayer;
        renderCorpDev();
      });
    });

    grid.innerHTML = "";
    visibleEvents.forEach((event, index) => {
      const card = el("article", "card corpdev-card reveal");
      card.style.animationDelay = `${index * 30}ms`;
      card.style.setProperty("--local-accent", categoryAccent((event.linkedCategories || ["corpdev"])[0]));
      card.innerHTML = `
        <div class="card-top">
          <div>
            <span class="chip accent">${escapeHTML(event.layerLabel)}</span>
            <h3>${escapeHTML(event.title)}</h3>
            <span class="source-tag">${escapeHTML(event.date || event.source || "")}</span>
          </div>
          ${factBadge(event.confidence || "보도", event.statusClass || "watch")}
        </div>
        <p>${escapeHTML(event.insight || event.desc || "")}</p>
        <div class="corpdev-event-meta">
          ${(event.tags || []).slice(0, 5).map((tag) => `<span class="tag">${escapeHTML(tag)}</span>`).join("")}
        </div>
        <ul class="watch-list">${(event.watch || []).slice(0, 4).map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul>
        ${event.sourceUrl ? `<a class="rainbow" href="${escapeHTML(event.sourceUrl)}" target="_blank" rel="noopener">${escapeHTML(event.source || "source")}</a>` : ""}
      `;
      makeInspectable(card, {
        type: "Corp Dev 이벤트",
        tag: event.layerLabel,
        title: event.title,
        body: event.insight || event.desc,
        section: "corpdev",
        categories: event.linkedCategories || ["corpdev"],
        watch: event.watch || [],
        tags: event.tags || [],
        links: event.sourceUrl ? [{ title: event.source || event.title, link: event.sourceUrl }] : [],
        metrics: [
          { label: "Layer", value: event.layerLabel },
          { label: "Status", value: event.confidence || "보도" },
          { label: "Date", value: event.date || "상시" },
        ],
      });
      grid.appendChild(card);
    });
    if (!grid.children.length) grid.appendChild(el("div", "empty", "선택한 조건의 Corp Dev 이벤트가 없습니다."));

    if (ledger) {
      const claims = BASE.claimLedger || [];
      ledger.innerHTML = claims.map((claim) => `
        <article class="claim-card">
          <div class="card-top">
            <h4>${escapeHTML(claim.claim)}</h4>
            ${factBadge(claim.status || "검증", claim.statusClass || "watch")}
          </div>
          <p>${escapeHTML(claim.note || "")}</p>
          <span class="source-tag">${escapeHTML(claim.version || "전망 버전 미상")}</span>
          ${claim.sourceUrl ? `<a href="${escapeHTML(claim.sourceUrl)}" target="_blank" rel="noopener">${escapeHTML(claim.source || "원문")}</a>` : ""}
        </article>
      `).join("");
    }
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
          type: "MECE 크롤링 타깃",
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

    if (mode === "corpdev") {
      items = corpDevEvents("all").map((event, index) => ({
        id: `corpdev-${event.layerId}-${index}`,
        mode,
        type: "Corp Dev 이벤트",
        tag: event.layerLabel,
        title: event.title,
        body: event.insight || event.desc,
        section: "corpdev",
        categories: event.linkedCategories || ["corpdev"],
        watch: event.watch || [],
        metrics: [
          { label: "Layer", value: event.layerLabel },
          { label: "Status", value: event.confidence || "보도" },
          { label: "Date", value: event.date || "상시" },
        ],
        links: event.sourceUrl ? [{ title: event.source || event.title, link: event.sourceUrl }] : [],
      }));
    }

    if (mode === "intelligence") {
      items = (BASE.channels || []).map((item, index) => ({
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

    return items.filter((item) => {
      if (activeCategory === "all") return true;
      if (!item.categories || !item.categories.length) return true;
      return item.categories.includes(activeCategory);
    });
  }

  function renderWorkbench() {
    const tabs = $("#workbenchTabs");
    const stage = $("#workbenchStage");
    const detail = $("#workbenchDetail");
    if (!tabs || !stage || !detail) return;

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
    wrap.innerHTML = "";
    cats.forEach((cat) => {
      const count = cat.id === "all"
        ? sourceItems.length
        : sourceItems.filter((item) => (item.linkedCategories || []).includes(cat.id)).length;
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
    const head = el("div", "relation-head", `
      <div>
        <span>Competitive graph</span>
        <strong>${escapeHTML(activeCategoryData()?.label || "전체")} 관계 맵</strong>
      </div>
      <small>플레이어 · 병목 · 관찰 지표를 클릭/복사</small>
    `);
    const lanes = el("div", "relation-lanes");
    items.forEach((item, index) => {
      const players = item.players || [];
      const from = players[0] || "시장";
      const to = players.slice(1, 4).join(" · ") || item.title;
      const payload = dynamicsPayload(item);
      const key = stablePanelKey("dynamic", item, index);
      const edge = el("article", `relation-edge reveal${key === dynamicFocusId ? " selected" : ""}`);
      edge.style.animationDelay = `${index * 30}ms`;
      edge.style.setProperty("--local-accent", categoryAccent((item.linkedCategories || [])[0]));
      edge.innerHTML = `
        <div class="relation-node source">${escapeHTML(from)}</div>
        <div class="relation-connector">
          <span>${escapeHTML(item.axis || "dynamic")}</span>
          <i></i>
        </div>
        <div class="relation-node target">${escapeHTML(to)}</div>
        <p>${escapeHTML(item.desc)}</p>
        <div class="relation-foot">
          <span>${(item.watch || []).slice(0, 2).map(escapeHTML).join(" · ")}</span>
          <button class="copy-btn" type="button" data-copy-relation>복사</button>
        </div>
      `;
      edge.querySelector("[data-copy-relation]")?.addEventListener("click", (event) => copyPayload(payload, event.currentTarget));
      edge.tabIndex = 0;
      edge.setAttribute("role", "button");
      edge.setAttribute("aria-label", `${item.title} 선택`);
      edge.addEventListener("click", (event) => {
        if (event.target.closest("button, a")) return;
        dynamicFocusId = key;
        renderDynamics();
      });
      edge.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        dynamicFocusId = key;
        renderDynamics();
      });
      lanes.appendChild(edge);
    });
    wrap.append(head, lanes);
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
      <div class="focus-flow">
        <span>${escapeHTML(flowInfo.from)}</span>
        <i></i>
        <span>${escapeHTML(flowInfo.to)}</span>
      </div>
      <div class="focus-block">
        <strong>수익화 Watch</strong>
        <ul class="watch-list">
          <li>${escapeHTML(item.watch || "가격·고객·캐파 변화")}</li>
          <li>${escapeHTML(flowInfo.lever)} 지표를 가격/뉴스/Corp Dev 큐와 같이 확인</li>
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
      wrap.appendChild(el("div", "empty", "선택한 카테고리의 수익화 흐름이 없습니다."));
      return;
    }
    const head = el("div", "relation-head", `
      <div>
        <span>Money flow</span>
        <strong>수익화 레버 맵</strong>
      </div>
      <small>고객 · 제품 · 지표를 한 줄 흐름으로 추적</small>
    `);
    const flow = el("div", "money-flow-lanes");
    items.forEach((item, index) => {
      const payload = modelPayload(item);
      const flowInfo = moneyFlowFromModel(item);
      const key = stablePanelKey("model", item, index);
      const node = el("article", `money-flow-card reveal${key === modelFocusId ? " selected" : ""}`);
      node.style.animationDelay = `${index * 30}ms`;
      node.style.setProperty("--local-accent", categoryAccent((item.linkedCategories || [])[0]));
      node.innerHTML = `
        <div class="money-flow-path">
          <span>${escapeHTML(flowInfo.from)}</span>
          <i></i>
          <span>${escapeHTML(flowInfo.to)}</span>
        </div>
        <div class="money-flow-main">
          <h3>${escapeHTML(item.title)}</h3>
          <p>${escapeHTML(item.logic)}</p>
        </div>
        <div class="money-flow-metrics">
          <div><strong>${escapeHTML(flowInfo.lever)}</strong><span>수익 레버</span></div>
          <div><strong>${escapeHTML(item.metric)}</strong><span>핵심 숫자</span></div>
          <button class="copy-btn" type="button" data-copy-money>복사</button>
        </div>
      `;
      node.querySelector("[data-copy-money]")?.addEventListener("click", (event) => copyPayload(payload, event.currentTarget));
      node.tabIndex = 0;
      node.setAttribute("role", "button");
      node.setAttribute("aria-label", `${item.title} 선택`);
      node.addEventListener("click", (event) => {
        if (event.target.closest("button, a")) return;
        modelFocusId = key;
        renderModels();
      });
      node.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        modelFocusId = key;
        renderModels();
      });
      flow.appendChild(node);
    });
    wrap.append(head, flow);
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
    const lastSection = $$("main > section").at(-1);
    target.scrollIntoView({ behavior: "smooth", block: target === lastSection ? "end" : "start" });
  }

  function setupScrollSpy() {
    const sections = ["overview", "daily-review", "numbers", "workbench", "ai-matrix", "crawler", "prices", "news", "china-dynamics", "talent-radar", "china-deep-dive", "corpdev", "categories", "competitors", "dynamics", "monetization", "response", "intelligence"];
    const update = () => {
      const y = window.scrollY + 96;
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
