/**
 * OEM / ODM account automation registry.
 *
 * The value-chain presentation and the crawler use the same account identity
 * contract.  Queries are intentionally separate from authored strategy copy:
 * this file only defines names that may appear in public sources and the
 * productive searches used to discover them.
 */

export const OEM_ODM_AUTOMATION = Object.freeze([
  {
    id: "dell",
    aliases: ["Dell", "Dell Technologies", "Dell AI Factory", "PowerEdge"],
    newsQueries: ["Dell AI server"],
  },
  {
    id: "hpe",
    aliases: ["HPE", "Hewlett Packard Enterprise", "HP Enterprise"],
    newsQueries: ["Hewlett Packard Enterprise AI"],
  },
  {
    id: "lenovo",
    aliases: ["Lenovo", "Lenovo ISG", "Lenovo Infrastructure Solutions Group"],
    newsQueries: ["Lenovo AI server"],
  },
  {
    id: "supermicro",
    aliases: ["Supermicro", "Super Micro Computer", "SMCI"],
    newsQueries: ["Supermicro AI server", "Supermicro memory"],
  },
  {
    id: "quanta-qct",
    aliases: ["Quanta", "Quanta Computer", "QCT", "Quanta Cloud Technology"],
    newsQueries: ["Quanta AI server"],
  },
  {
    id: "wiwynn",
    aliases: ["Wiwynn", "Wiwynn Corporation"],
    newsQueries: ["Wiwynn AI server"],
  },
  {
    id: "foxconn",
    aliases: ["Foxconn", "Hon Hai", "Hon Hai Precision Industry"],
    newsQueries: ["Foxconn AI server"],
  },
  {
    id: "inventec",
    aliases: ["Inventec", "Inventec Corporation"],
    newsQueries: ["Inventec"],
  },
  {
    id: "gigabyte",
    aliases: ["GIGABYTE", "Gigabyte Technology"],
    newsQueries: ["GIGABYTE AI server"],
  },
  {
    id: "asus",
    aliases: ["ASUS", "ASUSTeK", "ASUSTeK Computer"],
    newsQueries: ["ASUS AI server"],
  },
  {
    id: "cisco",
    aliases: ["Cisco", "Cisco Systems"],
    newsQueries: ["Cisco AI"],
  },
  {
    id: "fujitsu",
    aliases: ["Fujitsu"],
    // No productive feed query was found in the current verification run.
    // Keeping this explicit prevents a zero-yield term from looking healthy.
    newsQueries: [],
    queryStatus: "no-productive-query",
  },
]);

export const OEM_ODM_SHARED_QUERIES = Object.freeze([
  "NVL72",
  "ODM AI rack",
  "AI server memory",
]);

const unique = (items = []) => [...new Set(items.filter(Boolean))];
const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function mentionsAlias(text, alias) {
  const term = normalize(alias);
  if (!term) return false;
  if (!/^[a-z0-9 .&/+_-]+$/.test(term)) return text.includes(term);
  const phrase = escapeRegExp(term).replace(/\\ /g, "\\s+");
  return new RegExp(`(^|[^a-z0-9])${phrase}(?=$|[^a-z0-9])`, "i").test(text);
}

export function oemOdmAutomationFor(id) {
  return OEM_ODM_AUTOMATION.find((entry) => entry.id === id) || null;
}

export function buildOemOdmQueryPlan() {
  const plan = OEM_ODM_AUTOMATION.flatMap((entry) => (entry.newsQueries || []).map((query) => ({
    query,
    accountIds: [entry.id],
  })));
  plan.push(...OEM_ODM_SHARED_QUERIES.map((query) => ({ query, accountIds: [] })));
  return unique(plan.map((entry) => entry.query)).map((query) => ({
    query,
    accountIds: unique(plan.filter((entry) => entry.query === query).flatMap((entry) => entry.accountIds)),
  }));
}

export function matchingOemOdmAccountIds(item = {}) {
  const text = normalize([
    item.originalTitle,
    item.title,
    item.titleKo,
    item.summaryOriginal,
    item.summary,
  ].filter(Boolean).join(" · "));
  if (!text) return [];
  return OEM_ODM_AUTOMATION
    .filter((entry) => (entry.aliases || []).some((alias) => mentionsAlias(text, alias)))
    .map((entry) => entry.id);
}
