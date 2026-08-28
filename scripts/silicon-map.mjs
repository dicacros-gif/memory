/**
 * Silicon map.
 *
 * A company was being modelled as having one accelerator, which collapsed two
 * different things: AWS runs a training part and an inference part with
 * different memory profiles, and it buys NVIDIA at the same time as designing
 * its own. Hand-listing "who works with whom" reproduces that error every time
 * a company adds a programme or a second supplier.
 *
 * So what a programme *is* — designer, whether it trains or infers — is a
 * public product fact and lives in the registry. Who is doing what with it *now*
 * is only ever what the crawl observed: an account and a programme named in the
 * same item. Nothing is asserted about a pairing the feed has not shown.
 */

const norm = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const lower = (value) => norm(value).toLowerCase();
const day = (value) => String(value || "").slice(0, 10);

const ROLE_LABEL = {
  training: "학습",
  inference: "추론",
  both: "학습·추론",
  host: "호스트",
};

function itemText(item = {}) {
  return norm([item.originalTitle, item.title, item.titleKo, item.summary, item.summaryOriginal]
    .filter(Boolean).join(" · "));
}

// An alias directly preceded by a number is a unit, not the company.
function mentionsAlias(haystack, alias) {
  let at = haystack.indexOf(alias);
  while (at >= 0) {
    const before = haystack.slice(Math.max(0, at - 6), at);
    if (!/\d[\s\-–]?$/.test(before)) return true;
    at = haystack.indexOf(alias, at + alias.length);
  }
  return false;
}

function aliasesOf(account = {}) {
  return [account.name, account.nameKo, ...(account.aliases || [])]
    .filter(Boolean).map(lower).filter((alias) => alias.length >= 3);
}

/**
 * @returns {{schemaVersion, clientArtifact, runId, generatedAt, coverage, accounts, programs}}
 */
export function buildSiliconMap({
  news = [],
  accounts = [],
  registry = {},
  previous = {},
  windowDays = 180,
  now = new Date(),
  runId = null,
} = {}) {
  const programs = registry.programs || {};
  const compiled = Object.entries(programs).map(([name, program]) => ({
    name,
    program,
    test: new RegExp(program.pattern, "i"),
  }));

  const cutoff = new Date(now).getTime() - windowDays * 86400000;
  const carried = previous.accounts || {};
  const stores = new Map();
  const storeFor = (id) => {
    if (!stores.has(id)) {
      // evidenceIds were introduced with the idempotent schema. Legacy rows
      // only carried an inflated counter, so they cannot prove which articles
      // were counted and are rebuilt from the current evidence window once.
      const prior = (carried[id]?.programs || [])
        .filter((row) => Array.isArray(row.evidenceIds) && row.evidenceIds.length)
        .filter((row) => !row.lastSeen || new Date(row.lastSeen).getTime() >= cutoff)
        .map((row) => ({ ...row, evidenceIds: [...new Set(row.evidenceIds)], seenCount: new Set(row.evidenceIds).size }));
      stores.set(id, new Map(prior.map((row) => [row.program, row])));
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
    const hits = compiled.filter(({ test }) => test.test(text));
    if (!hits.length) continue;
    const url = item.link || item.sourceUrl || "";
    const headline = norm(item.titleKo || item.title);
    const evidenceId = norm(item.id || item.verification?.canonicalUrl || url || `${date}|${headline}`);

    for (const { id, aliases } of matchers) {
      if (!aliases.some((alias) => mentionsAlias(haystack, alias))) continue;
      const store = storeFor(id);
      for (const { name, program } of hits) {
        const existing = store.get(name);
        if (existing) {
          if (existing.evidenceIds.includes(evidenceId)) continue;
          existing.evidenceIds.push(evidenceId);
          existing.seenCount = existing.evidenceIds.length;
          if (date > (existing.lastSeen || "")) {
            existing.lastSeen = date;
            existing.headline = headline;
            existing.url = url;
          }
          continue;
        }
        store.set(name, {
          program: name,
          designer: program.designer,
          role: program.role,
          roleLabel: ROLE_LABEL[program.role] || program.role,
          family: program.family,
          memoryProfile: program.memoryProfile,
          // Designing a programme is a registry fact. Everything else is only
          // that the feed named them together, which is not the same as buying
          // it — so the label says co-mention, not procurement.
          relation: lower(program.designer).includes(lower(id)) ? "자체 설계" : "동시 언급",
          seenCount: 1,
          evidenceIds: [evidenceId],
          firstSeen: date,
          lastSeen: date,
          headline,
          url,
        });
        observed += 1;
      }
    }
  }

  const accountRows = {};
  let pairs = 0;
  for (const [id, store] of stores) {
    const rows = [...store.values()]
      // A single article can name any two things together. A pairing has to
      // repeat, or be the account's own programme, before it is shown.
      .filter((row) => row.relation === "자체 설계" || row.seenCount >= 2)
      .sort((a, b) => {
      // Own silicon first, then by how persistently the feed repeats it.
      if (a.relation !== b.relation) return a.relation === "자체 설계" ? -1 : 1;
      return b.seenCount - a.seenCount || String(b.lastSeen).localeCompare(String(a.lastSeen));
    });
    if (!rows.length) continue;
    const roles = [...new Set(rows.map((row) => row.role))];
    accountRows[id] = {
      programs: rows.slice(0, 10),
      // Whether this account covers both halves of the workload with silicon,
      // which is the thing a single-chip model used to hide.
      coversTraining: roles.some((role) => role === "training" || role === "both"),
      coversInference: roles.some((role) => role === "inference" || role === "both"),
      designers: [...new Set(rows.map((row) => row.designer))],
    };
    pairs += rows.length;
  }

  return {
    schemaVersion: "1.0",
    clientArtifact: true,
    runId,
    generatedAt: new Date(now).toISOString(),
    coverage: {
      programsInRegistry: compiled.length,
      accountsWithPrograms: Object.keys(accountRows).length,
      observedPairs: pairs,
      newThisRun: observed,
    },
    accounts: accountRows,
  };
}
