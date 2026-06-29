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
      keywords: ["talent", "hiring", "engineer", "ip", "yield", "tsv", "hybrid bonding"],
      pulse: "채용·커뮤니티·특허 신호로 수율 엔지니어 이동과 공정 노하우 유출 가능성을 조기 감지",
      watch: ["TSV JD 증가", "수율 엔지니어 이동", "IP 분쟁", "익명 커뮤니티 신호"],
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
      facts: ["Gloway DDR5-6000 양산", "DDR5 8000Mbps·LPDDR5X 10667Mbps 공개", "16nm 수율 90%+·2026년 말 15nm 목표"],
      risk: "DUV 반복 노광은 공정 스텝·마스크 비용·변동성을 키우며, TSV 적층이 필요한 HBM3 전환 시 열 변형과 패키징 수율 리스크가 커집니다",
      implication: "HBM 선두와의 격차는 단기 축소보다 3~4년 기술 갭 유지 가능성이 높고, 실제 위협은 레거시 DRAM 가격 하방에서 먼저 나타납니다",
      linkedCategories: ["dram", "packaging", "equipment"],
    },
    {
      id: "ymtc-xtacking",
      tag: "NAND 구조",
      title: "YMTC Xtacking 4.0과 270단급 NAND 추격",
      thesis: "YMTC는 로직 제어 웨이퍼와 메모리 셀 웨이퍼를 분리 가공한 뒤 하이브리드 본딩하는 Xtacking 4.0으로 기존 NAND 구조를 우회합니다",
      facts: ["NAND 점유율 2025년 1분기 8% → 2026년 1분기 13%", "256Gb 기준 4.41Gb/mm² 비트 밀도", "267~294단 추정 3D NAND 양산"],
      risk: "두 장의 웨이퍼를 쓰는 공정은 성능과 밀도에는 유리하지만 보조금 없는 원가 경쟁력에는 의문이 남습니다",
      implication: "SK하이닉스는 NAND 가격만이 아니라 eSSD·스마트폰·서버 고객의 중국 내수 보조금 효과를 함께 봐야 합니다",
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
      facts: ["JCET XDFOI 플랫폼 HVM 전환", "2025년 첨단 패키징 매출 270억 위안", "우한 XMC에 2,600억 위안 투자"],
      risk: "CXMT·YMTC 베이스 다이를 XMC가 고대역폭 패키징으로 묶는 구조가 자리 잡으면 중국 내수 AI 가속기용 HBM 우회 공급망이 두꺼워집니다",
      implication: "SK하이닉스는 HBM 다이 경쟁뿐 아니라 OSAT·인터포저·언더필·테스트 병목을 함께 보는 패키징 레이더가 필요합니다",
      linkedCategories: ["packaging", "hbm", "geopolitics"],
    },
    {
      id: "big-fund-equipment",
      tag: "소부장",
      title: "빅펀드 3기와 장비·소재 국산화",
      thesis: "빅펀드 3기는 단순 팹 증설보다 EUV·EDA·첨단 화학 소재 같은 초크포인트에 자본을 집중하고 있습니다",
      facts: ["빅펀드 3기 약 475억 달러", "장비 국산화율 2021년 8% → 2025년 23.2%", "2030년 39% 전망"],
      risk: "AMEC 식각, Naura 종합장비, ACM 세정이 서방 장비를 대체하고 소재 기업은 JV·공동 R&D를 통해 recipe 흡수를 시도합니다",
      implication: "한국 소부장 파트너의 JV 제안, 소재 recipe 이전, 중국 내수 우선 공급권 요구를 조기 탐지해야 합니다",
      linkedCategories: ["equipment", "geopolitics", "talent"],
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
  const NEWS_SOURCE_TABS = [
    { id: "english", label: "영어권 기사", countId: "foreignNewsCount", bucketId: "foreignNewsBucket", listId: "foreignNewsList" },
    { id: "chinese", label: "중국어 기사", countId: "chinaNewsCount", bucketId: "chinaNewsBucket", listId: "chinaNewsList" },
  ];
  const SECTION_LABELS = {
    crawler: "전체 크롤링 관제",
    "china-dynamics": "중국 반도체 다이내믹스",
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
  let workbenchMode = "crawler";
  let selectedInsightId = null;
  let responsePriority = "all";
  let typeTimer = null;

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
    renderCategories();
    renderChannels();
    renderCompanies();
    renderDynamics();
    renderModels();
    renderResponses();
    renderCrawlerBoard();
    renderPrices();
    renderNews();
    renderChinaDynamics();
    renderChinaDeepDive();
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
    $("#themeBtn").addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      localStorage.setItem("memory-theme", next);
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
    renderCategories();
    renderChannels();
    renderCompanies();
    renderDynamics();
    renderModels();
    renderNews();
    renderCrawlerBoard();
    renderChinaDeepDive();
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
        <small>${escapeHTML(kpi.note)}</small>
      `;
      strip.appendChild(node);
    });
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
    if (item.id === "foreign-news") return rawNews().filter((news) => !isChinaArticle(news)).length;
    if (item.id === "china-news") return rawNews().filter(isChinaArticle).length;
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
        <button type="button" data-open-inspector>상세 패널 열기</button>
        <button type="button" data-work-jump="${escapeHTML(item.section)}">관련 보드로 이동</button>
      </div>
    `;

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
          <button type="button" data-inspector-jump="${escapeHTML(data.section)}">관련 보드로 이동</button>
        </div>
      </div>
    `;
    overlay.querySelector("[data-close-inspector]")?.addEventListener("click", closeInspector);
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

  function renderDynamics() {
    const grid = $("#dynamicGrid");
    renderCategoryControls("dynamicControls", BASE.dynamics || [], "dynamics");
    grid.innerHTML = "";
    (BASE.dynamics || []).filter(relatedToActive).forEach((item, index) => {
      const card = el("article", "card reveal");
      card.style.animationDelay = `${index * 35}ms`;
      card.style.setProperty("--local-accent", categoryAccent((item.linkedCategories || [])[0]));
      card.innerHTML = `
        <span class="chip accent">${escapeHTML(item.axis)}</span>
        <h3>${escapeHTML(item.title)}</h3>
        <p>${escapeHTML(item.desc)}</p>
        <div class="tag-row">${(item.players || []).map((p) => `<span class="tag">${escapeHTML(p)}</span>`).join("")}</div>
        <ul class="watch-list">${(item.watch || []).map((w) => `<li>${escapeHTML(w)}</li>`).join("")}</ul>
      `;
      makeInspectable(card, {
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
      });
      grid.appendChild(card);
    });
    if (!grid.children.length) grid.appendChild(el("div", "empty", "선택한 카테고리의 경쟁 다이나믹스가 없습니다."));
  }

  function renderModels() {
    const grid = $("#modelGrid");
    renderCategoryControls("modelControls", BASE.monetizationModels || [], "monetization");
    grid.innerHTML = "";
    (BASE.monetizationModels || []).filter(relatedToActive).forEach((item, index) => {
      const card = el("article", "card reveal");
      card.style.animationDelay = `${index * 35}ms`;
      card.style.setProperty("--local-accent", categoryAccent((item.linkedCategories || [])[0]));
      card.innerHTML = `
        <h3>${escapeHTML(item.title)}</h3>
        <p>${escapeHTML(item.logic)}</p>
        <div class="metric-row">
          <div class="metric"><strong>Metric</strong><span>${escapeHTML(item.metric)}</span></div>
          <div class="metric"><strong>Watch</strong><span>${escapeHTML(item.watch)}</span></div>
          <div class="metric"><strong>Fit</strong><span>${(item.linkedCategories || []).map(categoryName).join(" · ")}</span></div>
        </div>
      `;
      makeInspectable(card, {
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
      btn.addEventListener("click", () => jumpTo(btn.dataset.jump));
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
    const sections = ["overview", "workbench", "crawler", "prices", "news", "china-dynamics", "china-deep-dive", "categories", "competitors", "dynamics", "monetization", "response", "intelligence"];
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
    const cats = data.cats || [];
    const pairs = (data.pairs || []).filter((pair) => {
      if (!q) return true;
      const hay = `${pair.q} ${pair.a} ${(pair.keywords || []).join(" ")}`.toLowerCase();
      return hay.includes(q);
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
      const score = tokens.reduce((acc, token) => acc + (token && hay.includes(token) ? 3 : 0), 0) +
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
    return sections.flatMap((section) => (section.rows || []).map((row) => ({
      ...row,
      sectionTitle: section.title,
      group: section.group,
      lastUpdate: section.lastUpdate,
      sourceUrl: section.sourceUrl,
    })));
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
  }

  function renderPriceSummary() {
    const rows = priceRowsFor();
    const summary = $("#priceSummary");
    const up = rows.filter((row) => Number(row.changePct) > 0).length;
    const down = rows.filter((row) => Number(row.changePct) < 0).length;
    const contract = rows.filter((row) => /contract/i.test(row.sectionTitle || "")).length;
    const spot = rows.filter((row) => /spot|street/i.test(row.sectionTitle || "")).length;
    const updated = LIVE.prices?.updatedAt || LIVE.updatedAt;
    const cards = [
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
      tbody.appendChild(el("tr", null, "<td colspan=\"6\" class=\"empty\">가격 데이터가 아직 없습니다.</td>"));
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
    const clean = live.filter((item) => isForeignNews(item) && isMemoryRelevant(item) && !isAppleContent(item));
    return clean.length ? clean : (BASE.fallbackNews || []);
  }

  function isForeignNews(item) {
    const src = `${item.source || ""} ${item.link || ""}`.toLowerCase();
    if (!item || !item.title) return false;
    if (KOREAN_SOURCE_RE.test(src)) return false;
    return true;
  }

  function isMemoryRelevant(item) {
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
    return sourceId === "chinese" ? isChinaArticle(item) : !isChinaArticle(item);
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
    $("#newsStats").textContent = `· ${items.length}건`;
    NEWS_SOURCE_TABS.forEach((tab) => {
      const bucket = $(`#${tab.bucketId}`);
      const count = $(`#${tab.countId}`);
      if (bucket) bucket.hidden = tab.id !== newsSource;
      if (count) count.textContent = tab.id === newsSource ? `${items.length}건` : "0건";
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
