/**
 * Capital signals.
 *
 * The curated capital plans are a baseline; this pulls what the crawl actually
 * observed about a company's spending so the investment block moves with the
 * feed instead of ageing in a hand-written file. A signal only attaches when a
 * company alias and an investment term appear in the same item, which keeps a
 * generic "industry capex" story from being filed under a specific customer.
 */

const CAPEX_TERMS = [
  "capex", "capital expenditure", "capital spending", "invest", "investment",
  "설비투자", "설비 투자", "투자 계획", "증설", "capacity expansion", "build out", "buildout",
];
const AMOUNT = /(\$\s?\d[\d,.]*\s?(?:billion|bn|million|m|trillion)|\d[\d,.]*\s?(?:억\s?달러|조\s?원|억\s?위안|billion|조원))/i;

const norm = (value) => String(value ?? "").toLowerCase().replace(/\s+/g, " ");
const day = (value) => String(value || "").slice(0, 10);

function itemText(item = {}) {
  return norm([item.source, item.originalTitle, item.titleKo, item.title, item.summary, item.summaryOriginal]
    .filter(Boolean).join(" "));
}

/**
 * @returns {Record<string, {headline, url, date, amount, source}>} newest signal per company id
 */
export function buildCapitalSignals({ news = [], accounts = [], windowDays = 90, now = new Date() } = {}) {
  const cutoff = new Date(now).getTime() - windowDays * 86400000;
  const rows = news
    .map((item) => ({ item, text: itemText(item), date: day(item.date || item.publishedAt) }))
    .filter((row) => row.text && row.date && new Date(row.date).getTime() >= cutoff)
    .filter((row) => CAPEX_TERMS.some((term) => row.text.includes(term)));

  const out = {};
  for (const account of accounts) {
    const aliases = (account.aliases || [account.id]).map(norm).filter((alias) => alias.length > 2);
    if (!aliases.length) continue;
    const matched = rows
      .filter((row) => aliases.some((alias) => row.text.includes(alias)))
      .sort((a, b) => b.date.localeCompare(a.date));
    const best = matched.find((row) => AMOUNT.test(row.text)) || matched[0];
    if (!best) continue;
    const title = best.item.titleKo || best.item.title || best.item.originalTitle || "";
    out[account.id] = {
      headline: String(title).replace(/\s+/g, " ").trim().slice(0, 150),
      url: best.item.link || best.item.sourceUrl || "",
      date: best.date,
      source: best.item.source || "",
      amount: (best.text.match(AMOUNT) || [null])[0],
      observedCount: matched.length,
    };
  }
  return out;
}
