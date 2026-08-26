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

// A headline of the form "<Company> expects/plans/warns …" is an attributable
// position even when nothing is in quotation marks, and the feed carries far
// more of these than it carries quotes.
const STANCE_VERBS = [
  "says", "said", "expects", "expected", "warns", "warned", "plans", "plan to",
  "targets", "sees", "forecasts", "raises", "raised", "cuts", "to invest",
  "to build", "to expand", "announces", "announced", "unveils", "commits",
  "밝혔", "전망", "계획", "예상", "발표", "확대", "추진", "경고",
];

// Technology the site does not yet know about. A candidate has to look like a
// spec or a product name and has to appear next to memory vocabulary, or every
// company and city name becomes a "trend".
// Contiguous or hyphenated only: a space makes it a phrase, and "Chips 2026" is
// a conference, not a specification. The third branch catches names like
// "Z-Angle" that carry no digit at all.
const CANDIDATE = /\b(?:[A-Z][A-Za-z]*-?\d{1,4}[A-Za-z]{0,2}|[A-Z]{2,6}\d?(?:-[A-Z0-9]{1,4})?|[A-Z][a-z]*-[A-Z][a-z]{2,})\b/g;
const TREND_CONTEXT = /\b(memory|hbm|dram|nand|ssd|bandwidth|capacity|cache|inference|accelerator|package|interconnect|latency)\b|메모리|대역폭|용량|추론|패키징|지연/i;
// Words that match the candidate shape but are never a technology.
const CANDIDATE_STOPWORDS = new Set([
  "AI", "US", "USA", "UK", "EU", "CEO", "CFO", "CTO", "COO", "IPO", "GDP", "API",
  "Q1", "Q2", "Q3", "Q4", "FY", "PC", "TV", "IT", "OK", "NO", "ON", "IN", "OF",
  "THE", "AND", "FOR", "NEW", "TOP", "ALL", "ONE", "TWO", "H1", "H2", "YoY", "QoQ",
  "NYSE", "NASDAQ", "SEC", "USD", "KRW", "CNY", "JPY", "EPS", "ROI", "TCO",
  // Category names, not technologies the site is missing.
  "NAND", "DRAM", "HBM", "SSD", "HDD", "SRAM", "RAM", "ROM", "DIMM", "NVME",
  "CPU", "GPU", "NPU", "XPU", "ASIC", "FPGA", "SOC", "PCB", "OEM", "ODM",
]);

const norm = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const lower = (value) => norm(value).toLowerCase();
const day = (value) => String(value || "").slice(0, 10);
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function shortHash(value = "") {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

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

function mentionsAlias(haystack, alias) {
  // "775 마이크론" is a unit, not Micron: an alias directly preceded by a
  // number is a measurement and does not count as a mention of the company.
  const notAMeasurement = (at) => !/\d[\s\-–]?$/.test(haystack.slice(Math.max(0, at - 6), at));
  if (!/^[a-z0-9 .&/+_-]+$/.test(alias)) {
    let at = haystack.indexOf(alias);
    while (at >= 0) {
      if (notAMeasurement(at)) return true;
      at = haystack.indexOf(alias, at + alias.length);
    }
    return false;
  }
  const phrase = escapeRegExp(alias).replace(/\\ /g, "\\s+");
  const pattern = new RegExp(`(^|[^a-z0-9])${phrase}(?=$|[^a-z0-9])`, "gi");
  let match;
  while ((match = pattern.exec(haystack))) {
    if (notAMeasurement(match.index + (match[1] || "").length)) return true;
  }
  return false;
}

const mentions = (haystack, aliases) => [...aliases].some((alias) => mentionsAlias(haystack, alias));

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

// The company's own stated position, taken from the headline rather than from a
// quoted span. Returns the verb so the reader can see what kind of statement it
// was — a plan reads differently from a warning.
function extractStance(headline, aliases) {
  const text = norm(headline);
  if (!text) return null;
  const lowered = lower(text);
  if (!RELEVANCE.test(text)) return null;
  const verb = STANCE_VERBS.find((term) => lowered.includes(term));
  if (!verb) return null;
  // The company has to be the subject, not merely mentioned somewhere after.
  const verbAt = lowered.indexOf(verb);
  const subject = lowered.slice(0, verbAt);
  if (![...aliases].some((alias) => subject.includes(alias))) return null;
  return { statement: text, verb: verb.trim() };
}

// Terms that look like technology, sit next to memory vocabulary, and are not
// already in the known list. These are candidates for the reader to judge, not
// findings — the site says so.
function extractTrendCandidates(text, known, companyNames = new Set()) {
  if (!TREND_CONTEXT.test(text)) return [];
  CANDIDATE.lastIndex = 0;
  const out = new Set();
  for (const match of text.match(CANDIDATE) || []) {
    const token = norm(match);
    if (token.length < 3 || token.length > 18) continue;
    if (CANDIDATE_STOPWORDS.has(token.toUpperCase())) continue;
    if (/^\d/.test(token)) continue;
    if (known.has(token.toLowerCase())) continue;
    if (companyNames.has(token.toLowerCase())) continue;
    // A year fragment is a date, and a bare capital word with no digit is a
    // name; a specification carries a number or is a long acronym.
    if (/(?:19|20)\d{2}/.test(token)) continue;
    if (!/\d/.test(token) && token.length < 5) continue;
    out.add(token);
  }
  return [...out].slice(0, 4);
}

const stamp = (date) => day(date) || "";

function evidenceId(entry = {}, stampedAt = "") {
  const url = lower(entry.url || "").replace(/\/$/, "");
  const fallback = lower(`${entry.source || ""}|${entry.headline || entry.quote || entry.label || entry.amount || ""}`);
  return shortHash(`${url || fallback}|${stampedAt}`);
}

function hydratePriorRow(row = {}) {
  const evidenceIds = [...new Set((row.evidenceIds || []).filter(Boolean))];
  if (!evidenceIds.length) evidenceIds.push(evidenceId(row, row.asOf || row.lastSeen || row.firstSeen || ""));
  return { ...row, evidenceIds: evidenceIds.slice(-24), seenCount: evidenceIds.length };
}

function fold(store, key, entry, stampedAt) {
  const currentEvidenceId = evidenceId(entry, stampedAt);
  const existing = store.get(key);
  if (existing) {
    const evidenceIds = new Set(existing.evidenceIds || []);
    if (evidenceIds.has(currentEvidenceId)) return false;
    evidenceIds.add(currentEvidenceId);
    existing.evidenceIds = [...evidenceIds].slice(-24);
    existing.lastSeen = stampedAt > existing.lastSeen ? stampedAt : existing.lastSeen;
    existing.seenCount = existing.evidenceIds.length;
    if (stampedAt > (existing.asOf || "")) Object.assign(existing, entry, { asOf: stampedAt });
    return true;
  }
  store.set(key, { ...entry, asOf: stampedAt, firstSeen: stampedAt, lastSeen: stampedAt, seenCount: 1, evidenceIds: [currentEvidenceId] });
  return true;
}

function mergedAccountMatchers(accounts = []) {
  const byId = new Map();
  for (const account of accounts) {
    if (!account?.id) continue;
    const aliases = aliasMatcher(account);
    if (!aliases) continue;
    const current = byId.get(account.id) || new Set();
    for (const alias of aliases) current.add(alias);
    byId.set(account.id, current);
  }
  return [...byId].map(([id, aliases]) => ({ id, aliases }));
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
        capex: new Map((prior.capex || []).map((row) => [row.key, hydratePriorRow(row)])),
        quotes: new Map((prior.quotes || []).map((row) => [row.key, hydratePriorRow(row)])),
        tech: new Map((prior.tech || []).map((row) => [row.key, hydratePriorRow(row)])),
        stances: new Map((prior.stances || []).map((row) => [row.key, hydratePriorRow(row)])),
      });
    }
    return stores.get(id);
  };
  for (const id of Object.keys(carried)) storeFor(id);

  const matchers = mergedAccountMatchers(accounts);
  const coverage = new Map(matchers.map(({ id }) => [id, new Map()]));

  const knownTech = new Set(TECH_TERMS.map(([label]) => label.toLowerCase()));
  const companyNames = new Set(accounts.flatMap((account) => [account.name, account.nameKo, ...(account.aliases || [])])
    .filter(Boolean).map((value) => lower(value)));
  // Trend candidates are site-wide, not per company: a term is new to us or it
  // is not, regardless of who was mentioned alongside it.
  const trendStore = new Map((previous.trendCandidates || []).map((row) => [row.term.toLowerCase(), { ...row }]));

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
      coverage.get(id).set(evidenceId({ url, source, headline: norm(item.titleKo || item.title) }, date), date);
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

      const stance = extractStance(item.titleKo || item.title || item.originalTitle, aliases);
      if (stance) {
        const key = `stance:${lower(stance.statement).slice(0, 70)}`;
        if (fold(store.stances, key, { key, statement: stance.statement, verb: stance.verb, headline: stance.statement, url, source }, date)) added += 1;
      }

      for (const label of extractTech(text)) {
        const key = `tech:${label}`;
        if (fold(store.tech, key, { key, label, headline: norm(item.titleKo || item.title), url, source }, date)) added += 1;
      }
    }
    for (const term of extractTrendCandidates(text, knownTech, companyNames)) {
      const key = term.toLowerCase();
      const seen = trendStore.get(key);
      if (seen) {
        seen.seenCount += 1;
        if (date > (seen.lastSeen || "")) {
          seen.lastSeen = date;
          seen.headline = norm(item.titleKo || item.title);
          seen.url = url;
        }
      } else {
        trendStore.set(key, { term, seenCount: 1, firstSeen: date, lastSeen: date, headline: norm(item.titleKo || item.title), url, source });
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
    const stances = [...store.stances.values()].sort(byRecency).slice(0, 5);
    if (!capex.length && !quotes.length && !tech.length && !stances.length) continue;
    companies[id] = { capex, quotes, tech, stances };
  }

  const coverageThisRun = Object.fromEntries([...coverage].map(([id, observations]) => {
    const dates = [...observations.values()].filter(Boolean).sort();
    return [id, {
      articleCount: observations.size,
      latestAt: dates.at(-1) || null,
      status: observations.size ? "observed" : "no-match",
    }];
  }));

  return {
    schemaVersion: "1.1",
    clientArtifact: true,
    runId,
    generatedAt,
    windowDays,
    addedThisRun: added,
    coverageThisRun,
    // A term repeated across items is worth a look; one sighting is noise.
    trendCandidates: [...trendStore.values()]
      .filter((row) => row.seenCount >= 2)
      .sort((a, b) => b.seenCount - a.seenCount || String(b.lastSeen).localeCompare(String(a.lastSeen)))
      .slice(0, 24),
    companies,
  };
}
