import { executiveBulletCopy } from "./executive-copy-core.js";

// Editorial guidance is a decision framework, not a live model response.
export const QA_BRIEF_GUIDES = Object.freeze({
  industry: { headline: "기술 발표를 고객의 구매 변화로 번역", output: "산업 변화 → 구매 Trigger 맵", nav: "industry-shift", next: "산업·DC 변화 보기" },
  customer: { headline: "제품보다 고객 KPI의 손실 원인을 먼저 확정", output: "고객 Pain · KPI 기준선", nav: "strategy-consulting", next: "고객 Pain 보드 보기" },
  workload: { headline: "SW 최적화와 메모리 증설을 같은 부하에서 비교", output: "병목 지도 · 요구사항 매트릭스", nav: "visual-bridge-system", next: "Workload·Memory 요구 보기" },
  solution: { headline: "표준 제품부터 Custom 설계까지 단계적으로 검증", output: "솔루션 옵션 · 고객 제안서", nav: "ai-matrix", next: "솔루션·포트폴리오 보기" },
  newbiz: { headline: "유료 PoC와 반복 발주 경로가 있는 기회에 집중", output: "사업 가설 · 경제성 · 파트너 역할", nav: "numbers", next: "신규 Biz·경제성 보기" },
  insights: { headline: "기술 수요와 실제 구매 전환을 분리", output: "Workload 변화 · 구매 전환 조건", nav: "hyperscaler-demand", next: "계정별 메모리 전략 보기" },
  qualification: { headline: "성능·신뢰성·공급·계약을 통과한 범위만 확대", output: "검증 계획 · 단계별 승인 조건", nav: "visual-bridge-execution", next: "검증·실행 Gate 보기" },
  execution: { headline: "승인 범위와 보류 조건을 하나의 결정안으로 정리", output: "경영진 결정안 · Owner · 다음 행동", nav: "c-level-cockpit", next: "경영진 결정 보드 보기" },
});

export const QA_SOLUTION_OPTIONS = Object.freeze([
  { title: "표준 제품 + SW 최적화", when: "기존 플랫폼에서 SLO 충족 가능", compare: "배치·KV 재사용·데이터 배치 조정 → 도입 기간·변경 비용 비교" },
  { title: "메모리 계층 공동 설계", when: "용량·이동·전력 병목이 함께 발생", compare: "HBM·Host DRAM·CXL·eSSD 배치 → 지연·처리량·시스템 TCO 비교" },
  { title: "Custom HBM 공동 개발", when: "표준 구성의 한계와 고객 물량 검증", compare: "NRE·베이스 다이·패키징·인증 의존성 → 회수 가능성·공급 준비도 비교" },
]);

const DOCUMENT_NOISE = /(?:\bcareers?\b|\bjobs?\b|채용|채용공고|인재 모집|privacy policy|cookie policy|개인정보 처리|terms of use|주가 전망|목표주가|stock price prediction|weekly.*roundup|주간 뉴스 정리|기본 정의|란 무엇|what is|what are)/i;
const TOPIC_GROUPS = Object.freeze({
  industry: [/data ?cent(?:er|re)|데이터센터|rack|랙|ai factory/i, /inference|training|추론|학습|accelerator|가속기|gpu/i],
  customer: [/inference|추론|serving|서빙|kv.?cache|kv 캐시|context|컨텍스트/i],
  workload: [/bandwidth|대역폭|latency|지연|throughput|처리량|offload|오프로딩|inference|추론|memory pooling/i],
  solution: [/\bhbm\d*|custom memory|맞춤형.*메모리|\bcxl\b|memory architecture|메모리.*아키텍처|\bdram\b|\bddr\d|\bnand\b|\be?ssd\b/i],
  newbiz: [/\brag\b|agentic|에이전틱|kv.?cache|kv 캐시|vector|벡터|inference|추론/i],
  insights: [/transformer|context|컨텍스트|\brag\b|vector|벡터|kv.?cache|kv 캐시|inference|추론/i],
  qualification: [/qualification|인증|양산|production|reliability|신뢰성|supply agreement|공급 계약|packaging|패키징/i],
  execution: [/qualification|인증|양산|production|agreement|계약|investment|투자|capacity|생산능력/i],
});
const TECH_DOCUMENT = /hbm|dram|ddr\d|rdimm|socamm|nand|ssd|flash|cxl|memory|메모리|semiconductor|반도체|inference|추론|gpu|accelerator|가속기|데이터센터|data.?cent(?:er|re)/i;
const SYSTEM_CONTEXT = /data.?cent(?:er|re)|데이터센터|hyperscaler|enterprise|server|서버|inference|추론|accelerator|가속기|\bai\b|\brack\b|랙/i;
const DESIGN_CONTEXT = /\bhbm\d*|\bcxl\b|custom|맞춤형|architecture|아키텍처|bonding|본딩|적층|\bpim\b|\bpnm\b|\bsocamm\b|\brdimm\b/i;
const CONSUMER_CONTEXT = /gaming|gamer|budget savior|memory kits?|ram kits?|ssd review|게이밍|게임용|소비자용|소매 가격/i;
const COMPANY_ONLY = /^(?:nvidia|amd|micron|samsung|삼성|마이크론|sk hynix|hynix|하이닉스|google|meta|microsoft|amazon|aws|memory|메모리|hbm|dram|cxl|essd)$/i;
const LIVE_TOPICS = {hbm:/\bhbm\d*|high.bandwidth.memory|고대역폭/i,dram:/\bdram\b|\b(?:lp)?ddr\d|rdimm|mrdimm|socamm/i,nand:/\bnand\b|\be?ssd\b|flash|플래시|스토리지/i,demand:/data.?center|hyperscaler|accelerator|gpu|가속기|데이터센터/i};

export function qaEvidenceScore(item = {}, pair = {}) {
  const url = String(item.sourceUrl || item.link || item.url || "");
  let parsed;
  try { parsed = new URL(url); } catch { return 0; }
  if (!/^https?:$/.test(parsed.protocol) || /(^|\.)news\.google\.com$/i.test(parsed.hostname)) return 0;
  const title = `${item.titleKo || ""} ${item.title || ""}`.trim();
  if (!title || DOCUMENT_NOISE.test(`${title} ${parsed.pathname}`)) return 0;
  // A company name buried in boilerplate or a summary is not topic relevance.
  if (!TECH_DOCUMENT.test(title)) return 0;
  if (CONSUMER_CONTEXT.test(title) && !SYSTEM_CONTEXT.test(title)) return 0;
  // Commodity memory pricing alone is not evidence for a customer solution.
  if (pair.cat === "solution" && !pair.liveTopic && !DESIGN_CONTEXT.test(title) && !SYSTEM_CONTEXT.test(title)) return 0;
  const groups = LIVE_TOPICS[pair.liveTopic] ? [LIVE_TOPICS[pair.liveTopic]] : (TOPIC_GROUPS[pair.cat] || TOPIC_GROUPS.execution);
  const matches = groups.filter(pattern => pattern.test(title)).length;
  if (!matches) return 0;
  const specific = (pair.keywords || []).filter(term => String(term).length >= 3 && !COMPANY_ONLY.test(String(term)));
  const keywordHits = specific.filter(term => title.toLowerCase().includes(String(term).toLowerCase())).length;
  return matches * 10 + Math.min(3, keywordHits) * 3;
}

export function qaEvidenceTitle(title = "") {
  return executiveBulletCopy(String(title).replace(/\s*[_|]\s*(?:뉴스|News)\s*$/i, "").trim());
}

export function qaEvidenceIdentity(item = {}) {
  try {
    const url = new URL(item.sourceUrl || item.link || item.url);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
    return url.toString().replace(/\/$/, "");
  } catch { return ""; }
}

export function selectQaEvidence(items = [], pair = {}, limit = 4) {
  const seen = new Set();
  return items.map(item => ({ item, score: qaEvidenceScore(item, pair) }))
    .filter(row => row.score > 0)
    .sort((a, b) => b.score - a.score || String(b.item.date || b.item.publishedAt || "").localeCompare(String(a.item.date || a.item.publishedAt || "")))
    .filter(({ item }) => { const key = qaEvidenceIdentity(item); if (!key || seen.has(key)) return false; seen.add(key); return true; })
    .slice(0, limit).map(({ item }) => item);
}
