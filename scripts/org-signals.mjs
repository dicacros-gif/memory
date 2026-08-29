/**
 * Organisation and executive signals.
 *
 * The account brief carried an executive line and a buying centre that were
 * both written by hand, and the automation that was meant to replace them
 * produced nothing at all — not because the extractor was wrong, but because
 * no query asked for people, so no article naming one ever reached the stream.
 *
 * With those articles collected, two things can be read without inventing
 * anything. A person holds a chair: a name sitting directly beside a role term
 * in an item that also names the company. And a person says something: a span
 * inside quotation marks, or — far more common in this feed — a statement the
 * article reports without quoting. Those are not the same kind of evidence, so
 * they are labelled differently and never merged.
 */

const norm = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const lower = (value) => norm(value).toLowerCase();
const day = (value) => String(value || "").slice(0, 10);

// Chairs that decide or speak for infrastructure. Ordered longest-first so
// "Chief Financial Officer" wins over "Chief".
const ROLES = [
  ["Chief Executive Officer", "CEO"], ["Chief Financial Officer", "CFO"],
  ["Chief Technology Officer", "CTO"], ["Chief Operating Officer", "COO"],
  ["Chief Information Officer", "CIO"], ["Chief Scientist", "Chief Scientist"],
  ["Executive Vice President", "EVP"], ["Senior Vice President", "SVP"],
  ["Vice President", "VP"], ["President", "President"], ["Chairman", "Chairman"],
  ["Founder", "Founder"], ["CEO", "CEO"], ["CFO", "CFO"], ["CTO", "CTO"],
  ["COO", "COO"], ["EVP", "EVP"], ["SVP", "SVP"], ["VP", "VP"],
  ["대표이사", "대표이사"], ["최고경영자", "CEO"], ["최고재무책임자", "CFO"],
  ["최고기술책임자", "CTO"], ["부사장", "부사장"], ["사장", "사장"],
];

// A capitalised two or three word name. Deliberately narrow: a wrong name is
// worse than a missing one, so anything unusual is left out.
const NAME = "[A-Z][a-z]{2,14}(?:\\s[A-Z][a-z.'-]{1,16}){1,2}";

// Words that look like names but are not people.
const NOT_A_PERSON = /\b(inc|corp|corporation|technologies|systems|labs|cloud|group|holdings|university|institute|news|report|market|research|street|journal|times|post|today|week|quarter)\b/i;
const NOT_A_KOREAN_PERSON = /^(공동|대행|전임|신임|최고|글로벌|한국|미국|중국|일본|유럽)$/;
const isPlausiblePersonName = (value) => {
  const name = norm(value);
  return Boolean(name) && !NOT_A_PERSON.test(name) && !NOT_A_KOREAN_PERSON.test(name);
};

// Reported speech. The feed rarely uses quotation marks, so a statement the
// article attributes without quoting is kept — labelled as reported, never as
// a direct quote.
const REPORTED = /\b(said|says|told|stated|noted|added|warned|announced|expects?|plans?)\b|라고 말했|라며|밝혔|전했|강조했|덧붙였/;
// Single quotes are deliberately absent: an apostrophe in "NVIDIA's" was being
// read as an opening quote, which turned the rest of a headline into a
// fabricated direct quote. Only paired double quotes and CJK brackets count.
const QUOTED = /[\"“「『«]([^\"”」』»]{16,240})[\"”」』»]/;

// A person talking about their partner programme is not an infrastructure read.
const RELEVANT = /\b(ai|gpu|hbm|memory|compute|bandwidth|power|token|inference|training|workload|capacity|data ?cent(?:er|re)|capex|invest|chip|silicon|server)\b|메모리|컴퓨트|대역폭|전력|추론|학습|워크로드|용량|데이터센터|투자|토큰|반도체|서버|칩/i;

function itemText(item = {}) {
  return norm([item.originalTitle, item.title, item.titleKo, item.summary, item.summaryOriginal]
    .filter(Boolean).join(" · "));
}

/**
 * A name is only accepted when it sits directly beside a role term — "Jensen
 * Huang, CEO of NVIDIA" or "NVIDIA CEO Jensen Huang" — so a name that merely
 * appears somewhere in the same article is not given a chair it may not hold.
 */
export function extractPeople(text) {
  const found = new Map();
  for (const [term, label] of ROLES) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`(${NAME})\\s*,?\\s*(?:the\\s+)?${escaped}\\b`, "g"),
      new RegExp(`${escaped}\\s+(${NAME})`, "g"),
      new RegExp(`([가-힣]{2,4})\\s*${escaped}`, "g"),
    ];
    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) {
        const name = norm(match[1]);
        if (!isPlausiblePersonName(name)) continue;
        // Longest-first ordering means a chair already recorded for this person
        // came from a more specific term, so it stays.
        if (!found.has(name)) found.set(name, label);
      }
    }
  }
  return [...found].map(([name, role]) => ({ name, role }));
}

/**
 * @returns {{text, kind}|null} kind is 직접 인용 or 보도, never both.
 */
export function extractStatement(text) {
  const quoted = text.match(QUOTED);
  if (quoted && RELEVANT.test(quoted[1])) return { text: norm(quoted[1]), kind: "직접 인용" };
  if (!REPORTED.test(text)) return null;
  // The headline is the reported claim in this feed; the summary repeats it.
  const head = norm(String(text).split(" · ")[0]);
  if (!head || head.length < 16 || !RELEVANT.test(head)) return null;
  return { text: head.slice(0, 220), kind: "보도" };
}

const aliasesOf = (account = {}) => [account.company, account.name, account.nameKo, ...(account.aliases || [])]
  .filter(Boolean).map(lower).filter((alias) => alias.length >= 3);

const evidenceIdForPerson = (person = {}, evidence = {}) => [
  "v2",
  lower(person.name),
  lower(person.role),
  lower(evidence.url),
  lower(evidence.url) ? "" : lower(evidence.headline),
  day(evidence.date || evidence.lastSeen),
  lower(evidence.source),
].join("|");

function hydratePersonEvidence(row = {}) {
  const ids = Array.isArray(row.evidenceIds)
    ? row.evidenceIds.filter((id) => String(id).startsWith("v2|"))
    : [];
  if (ids.length) return [...new Set(ids)];
  const legacyId = evidenceIdForPerson(row, row);
  return legacyId.replaceAll("|", "") ? [legacyId] : [];
}

/**
 * @returns {{schemaVersion, clientArtifact, runId, generatedAt, coverage, accounts}}
 */
export function buildOrgSignals({
  news = [],
  accounts = [],
  previous = {},
  windowDays = 180,
  now = new Date(),
  runId = null,
} = {}) {
  const cutoff = new Date(now).getTime() - windowDays * 86400000;
  const carried = previous.accounts || {};
  const stores = new Map();
  const storeFor = (id) => {
    if (!stores.has(id)) {
      const prior = carried[id] || {};
      stores.set(id, {
        people: new Map((prior.people || [])
          .filter((row) => isPlausiblePersonName(row.name))
          .map((row) => [`${row.name}|${row.role}`, {
            ...row,
            evidenceIds: hydratePersonEvidence(row),
          }])),
        statements: new Map((prior.statements || []).map((row) => [row.key, { ...row }])),
      });
    }
    return stores.get(id);
  };
  for (const id of Object.keys(carried)) storeFor(id);

  const matchers = accounts
    .map((account) => ({ id: account.id, aliases: aliasesOf(account) }))
    .filter((entry) => entry.id && entry.aliases.length);

  let observed = 0;
  for (const item of news) {
    const date = day(item.date || item.publishedAt);
    if (date && new Date(date).getTime() < cutoff) continue;
    const text = itemText(item);
    if (!text) continue;
    const haystack = lower(text);
    const people = extractPeople(text);
    const statement = extractStatement(text);
    if (!people.length && !statement) continue;
    const url = item.link || item.sourceUrl || "";
    const source = norm(item.source || "");
    const headline = norm(item.titleKo || item.title);

    for (const { id, aliases } of matchers) {
      if (!aliases.some((alias) => haystack.includes(alias))) continue;
      const store = storeFor(id);

      for (const person of people) {
        const key = `${person.name}|${person.role}`;
        const existing = store.people.get(key);
        const evidence = { date, url, headline, source };
        const evidenceId = evidenceIdForPerson(person, evidence);
        if (existing) {
          const evidenceIds = new Set(existing.evidenceIds || hydratePersonEvidence(existing));
          if (evidenceIds.has(evidenceId)) continue;
          evidenceIds.add(evidenceId);
          existing.evidenceIds = [...evidenceIds];
          existing.seenCount = Math.max(Number(existing.seenCount) || 0, evidenceIds.size - 1) + 1;
          if (date > (existing.lastSeen || "")) { existing.lastSeen = date; existing.url = url; existing.headline = headline; }
          continue;
        }
        store.people.set(key, {
          ...person,
          seenCount: 1,
          firstSeen: date,
          lastSeen: date,
          url,
          headline,
          source,
          evidenceIds: [evidenceId],
        });
        observed += 1;
      }

      if (statement) {
        const key = `s:${lower(statement.text).slice(0, 70)}`;
        if (!store.statements.has(key)) {
          store.statements.set(key, {
            key,
            text: statement.text,
            kind: statement.kind,
            // Attribution only when the same item named someone; otherwise the
            // statement stands as the company's, which is what it is.
            speaker: people[0]?.name || "",
            role: people[0]?.role || "",
            date,
            url,
            source,
          });
          observed += 1;
        }
      }
    }
  }

  const byRecency = (a, b) => String(b.date || b.lastSeen || "").localeCompare(String(a.date || a.lastSeen || ""));
  const out = {};
  let people = 0;
  let statements = 0;
  for (const [id, store] of stores) {
    // A chair named once in one article is a reasonable read; a chair named
    // twice is a reliable one. Both are shown, and the count says which.
    const rows = [...store.people.values()].sort((a, b) => b.seenCount - a.seenCount || byRecency(a, b)).slice(0, 6);
    const said = [...store.statements.values()].sort(byRecency).slice(0, 5);
    if (!rows.length && !said.length) continue;
    out[id] = { people: rows, statements: said };
    people += rows.length;
    statements += said.length;
  }

  return {
    schemaVersion: "1.0",
    clientArtifact: true,
    runId,
    generatedAt: new Date(now).toISOString(),
    coverage: { accounts: Object.keys(out).length, people, statements, newThisRun: observed },
    accounts: out,
  };
}
