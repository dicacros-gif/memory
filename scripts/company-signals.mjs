/**
 * Company signals.
 *
 * Three things about a customer change on their own schedule and are the ones a
 * memory proposal turns on: how much they are spending, what their executives
 * said about why, and which technologies they moved onto. Each crawl folds new
 * observations into a per-company store that keeps first/last seen, so a figure
 * that was revised upward reads as a revision rather than replacing the old one
 * silently.
 *
 * A signal only attaches when a company alias and the signal's own vocabulary
 * appear in the same item — a generic industry story never lands under a named
 * customer.
 */

const CAPEX_TERMS = [
  "capex", "capital expenditure", "capital spending", "capital outlay",
  "invest", "investment", "spend", "spending", "설비투자", "설비 투자",
  "투자 계획", "증설", "capacity expansion", "build out", "buildout", "data center build",
];

// Ordered longest-first so "billion" wins over "b" inside the same match.
const AMOUNT = /(?:\$|US\$|USD\s?)\s?\d[\d,.]*\s?(?:trillion|billion|million|bn|mn)\b|\d[\d,.]*\s?(?:조\s?원|억\s?달러|억\s?위안|조원|억달러)/gi;

const ROLE_TERMS = [
  "ceo", "cfo", "cto", "coo", "chief executive", "chief financial", "chief technology",
  "president", "chairman", "founder", "vice president", "svp", "evp",
  "대표이사", "최고경영자", "최고재무책임자", "최고기술책임자", "부사장", "사장", "회장", "창업자",
];

// Straight, curly, Korean and CJK quotation pairs.
const QUOTE = /[""「『"]([^""」』"]{18,220})[""」』"]/g;

const TECH_TERMS = [
  ["HBM4E", /\bhbm4e\b/i], ["HBM4", /\bhbm4\b(?!e)/i], ["HBM5", /\bhbm5\b/i],
  ["Custom HBM", /custom\s?hbm|커스텀\s?hbm/i],
  ["HBF", /\bhbf\b|high bandwidth flash/i],
  ["CXL", /\bcxl\b/i], ["PIM", /\bpim\b|processing[- ]in[- ]memory/i],
  ["SOCAMM", /\bsocamm2?\b/i], ["MRDIMM", /\bmrdimm\b/i], ["LPDDR", /\blpddr\d?\b/i],
  ["QLC eSSD", /\bqlc\b/i], ["TLC eSSD", /\btlc\b/i], ["eSSD", /\bessd\b|enterprise ssd/i],
  ["CoWoS", /\bcowos\b/i], ["Hybrid Bonding", /hybrid bonding|하이브리드 본딩/i],
  ["CPO", /\bcpo\b|co-?packaged optics/i], ["Silicon Photonics", /silicon photonics|실리콘 포토닉스/i],
  ["Chiplet", /\bchiplet\b|칩렛/i], ["2nm", /\b2\s?nm\b/i], ["3nm", /\b3\s?nm\b/i],
  ["NVL72", /\bnvl\s?72\b/i], ["GB300", /\bgb300\b/i], ["GB200", /\bgb200\b/i],
  ["Vera Rubin", /vera rubin/i], ["Trainium", /\btrainium\d?\b/i], ["TPU", /\btpu\s?v?\d*\b/i],
  ["Custom XPU", /custom\s?xpu|커스텀\s?xpu/i], ["Custom ASIC", /custom\s?asic|커스텀\s?asic/i],
  ["Vector DB", /vector\s?(?:db|database)|벡터\s?db/i], ["KV Cache", /\bkv\s?cache\b/i],
  ["RAG", /\brag\b|retrieval[- ]augmented/i], ["Long Context", /long[- ]context|롱\s?컨텍스트/i],
];

const norm = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const lower = (value) => norm(value).toLowerCase();
const day = (value) => String(value || "").slice(0, 10);

function itemText(item = {}) {
  return norm([item.originalTitle, item.title, item.titleKo, item.summary, item.summaryOriginal]
    .filter(Boolean).join(" · "));
}

// Aliases shorter than three characters match too much prose to be safe.
function aliasMatcher(account = {}) {
  const aliases = [account.name, account.nameKo, account.label, ...(account.aliases || [])]
    .filter(Boolean).map(lower).filter((alias) => alias.length >= 3);
  return aliases.length ? new Set(aliases) : null;
}

const mentions = (haystack, aliases) => [...aliases].some((alias) => haystack.includes(alias));

function extractAmounts(text) {
  AMOUNT.lastIndex = 0;
  return [...new Set((text.match(AMOUNT) || []).map(norm))].slice(0, 3);
}

// An executive saying something about their partner programme is not an
// infrastructure read, so a quote also has to be about the subject at hand.
const RELEVANCE = /\b(ai|gpu|hbm|memory|compute|bandwidth|power|token|inference|training|workload|capacity|data ?cent(?:er|re)|capex|invest)\b|메모리|컴퓨트|대역폭|전력|추론|학습|워크로드|용량|데이터센터|투자|토큰|반도체/i;

function extractQuote(text) {
  // Summaries are short, so the whole item is the context a role can sit in;
  // a nearer mention still wins when there is more than one.
  const whole = lower(text);
  if (!ROLE_TERMS.some((term) => whole.includes(term))) return null;
  QUOTE.lastIndex = 0;
  for (const match of text.matchAll(QUOTE)) {
    const quote = norm(match[1]);
    if (!RELEVANCE.test(quote)) continue;
    const around = lower(text.slice(Math.max(0, match.index - 200), match.index + quote.length + 200));
    const role = ROLE_TERMS.find((term) => around.includes(term)) || ROLE_TERMS.find((term) => whole.includes(term));
    if (role) return { quote, role };
  }
  return null;
}

const extractTech = (text) => TECH_TERMS.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);

const stamp = (date) => day(date) || "";

function fold(store, key, entry, stampedAt) {
  const existing = store.get(key);
  if (existing) {
    existing.lastSeen = stampedAt > existing.lastSeen ? stampedAt : existing.lastSeen;
    existing.seenCount += 1;
    if (stampedAt > (existing.asOf || "")) Object.assign(existing, entry, { asOf: stampedAt });
    return false;
  }
  store.set(key, { ...entry, asOf: stampedAt, firstSeen: stampedAt, lastSeen: stampedAt, seenCount: 1 });
  return true;
}

/**
 * @returns {{schemaVersion, clientArtifact, runId, generatedAt, companies}}
 *   companies[id] = { capex[], quotes[], tech[] }
 */
export function buildCompanySignals({
  news = [],
  accounts = [],
  previous = {},
  windowDays = 120,
  now = new Date(),
  runId = null,
} = {}) {
  const cutoff = new Date(now).getTime() - windowDays * 86400000;
  const generatedAt = new Date(now).toISOString();
  const carried = previous.companies || {};

  const stores = new Map();
  const storeFor = (id) => {
    if (!stores.has(id)) {
      const prior = carried[id] || {};
      stores.set(id, {
        capex: new Map((prior.capex || []).map((row) => [row.key, { ...row }])),
        quotes: new Map((prior.quotes || []).map((row) => [row.key, { ...row }])),
        tech: new Map((prior.tech || []).map((row) => [row.key, { ...row }])),
      });
    }
    return stores.get(id);
  };
  for (const id of Object.keys(carried)) storeFor(id);

  const matchers = accounts
    .map((account) => ({ id: account.id, aliases: aliasMatcher(account) }))
    .filter((entry) => entry.id && entry.aliases);

  let added = 0;
  for (const item of news) {
    const date = stamp(item.date || item.publishedAt);
    if (date && new Date(date).getTime() < cutoff) continue;
    const text = itemText(item);
    if (!text) continue;
    const haystack = lower(text);
    const url = item.link || item.sourceUrl || "";
    const source = norm(item.source) || "";

    for (const { id, aliases } of matchers) {
      if (!mentions(haystack, aliases)) continue;
      const store = storeFor(id);

      if (CAPEX_TERMS.some((term) => haystack.includes(term))) {
        for (const amount of extractAmounts(text)) {
          if (fold(store.capex, `capex:${lower(amount)}`, { key: `capex:${lower(amount)}`, amount, headline: norm(item.titleKo || item.title), url, source }, date)) added += 1;
        }
      }

      const spoken = extractQuote(text);
      if (spoken) {
        const key = `quote:${lower(spoken.quote).slice(0, 60)}`;
        if (fold(store.quotes, key, { key, quote: spoken.quote, role: spoken.role.toUpperCase(), headline: norm(item.titleKo || item.title), url, source }, date)) added += 1;
      }

      for (const label of extractTech(text)) {
        const key = `tech:${label}`;
        if (fold(store.tech, key, { key, label, headline: norm(item.titleKo || item.title), url, source }, date)) added += 1;
      }
    }
  }

  const byRecency = (a, b) => String(b.asOf || "").localeCompare(String(a.asOf || "")) || b.seenCount - a.seenCount;
  const companies = {};
  for (const [id, store] of stores) {
    const capex = [...store.capex.values()].sort(byRecency).slice(0, 6);
    const quotes = [...store.quotes.values()].sort(byRecency).slice(0, 5);
    // Technology reads better by how long it has been running than by recency.
    const tech = [...store.tech.values()]
      .sort((a, b) => b.seenCount - a.seenCount || String(b.lastSeen).localeCompare(String(a.lastSeen)))
      .slice(0, 12);
    if (!capex.length && !quotes.length && !tech.length) continue;
    companies[id] = { capex, quotes, tech };
  }

  return {
    schemaVersion: "1.0",
    clientArtifact: true,
    runId,
    generatedAt,
    windowDays,
    addedThisRun: added,
    companies,
  };
}
