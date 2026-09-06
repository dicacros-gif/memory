import { executiveBulletCopy } from "./executive-copy-core.js";

// Editorial guidance is a decision framework, not a live model response.
export const QA_BRIEF_GUIDES = Object.freeze({
  industry: { headline: "AI CapEx와 메모리 사이클의 전이 시차를 검증", output: "사이클 · 수급 · 실적 전이 맵", nav: "investor-overview", next: "시장·사이클 보기" },
  customer: { headline: "수요 발표와 공급사 실적 인식을 분리", output: "수요 · 출하 · 이익 민감도", nav: "investor-demand", next: "수요·실적 전환 보기" },
  workload: { headline: "시스템 병목을 밸류체인 수혜 순서로 번역", output: "AI 인프라 병목 · 수혜 체인", nav: "investor-technology", next: "기술·경쟁 구도 보기" },
  solution: { headline: "제품 차별화가 가격 결정력과 마진으로 이어지는지 검증", output: "제품 · 경쟁력 · 인증 비교", nav: "investor-technology", next: "제품·경쟁력 보기" },
  newbiz: { headline: "기술 기대보다 반복 매출과 이익 경로를 우선", output: "신기술 · 상장사 수혜 경로", nav: "investor-technology", next: "신기술·성장 보기" },
  insights: { headline: "수요·실적 변화와 현재 주가 반영 기대를 분리", output: "주가 · 밸류체인 비교", nav: "equity-value-chain", next: "투자 밸류체인 보기" },
  qualification: { headline: "인증·양산·공급·계약을 통과한 범위만 촉매로 인정", output: "촉매 · 근거 · 반증 조건", nav: "investor-thesis", next: "투자 판단 보기" },
  execution: { headline: "기대·가격·리스크를 한 장의 투자 논지로 정리", output: "투자 논지 · 확인 지표 · 폐기 조건", nav: "investor-thesis", next: "투자 판단 보기" },
});

export const QA_SOLUTION_OPTIONS = Object.freeze([
  { title: "수요 민감도", when: "AI CapEx·출하·탑재량이 함께 증가", compare: "고객 집중도·인증 시차·제품 Mix → 매출 전환 강도 비교" },
  { title: "이익 민감도", when: "가격·수율·가동률이 동시 개선", compare: "ASP·원가·패키징 비용·감가상각 → 마진 전환 속도 비교" },
  { title: "밸류에이션·리스크", when: "성장 기대가 주가에 선반영", compare: "실적 추정 변화·멀티플·공급 과잉·기술 지연 → 논지 폐기 조건 비교" },
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
  // A stale "verified" flag cannot rescue an unreadable source extraction.
  const sourceTexts = [title, item.summary, item.summaryOriginal].filter(Boolean);
  if (sourceTexts.some(text => /[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F]/u.test(text))) return 0;
  if (/japanese|chinese|korean/i.test(item.language || item.streamLanguage || "")
    && sourceTexts.some(text => (String(text).match(/[\u0100-\u036F]/gu) || []).length >= 8)) return 0;
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
