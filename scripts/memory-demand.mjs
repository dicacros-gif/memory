/**
 * Memory demand derivation.
 *
 * The brief's central capability is translating an AI technology into a system
 * change and then into a memory requirement. Writing that translation out per
 * company is what makes a site age: every new customer and every new technology
 * needs another paragraph by hand.
 *
 * So the translation lives once, as rules, and this applies them to whatever the
 * crawl actually observed. One rule reaches every company that shows the term,
 * and a technology appearing for the first time produces its requirement with no
 * data edited. Nothing is asserted about a company the feed has not mentioned.
 */

const norm = (value) => String(value ?? "").trim();

// A term seen once may be a passing mention; one that keeps returning is a
// commitment. The label states which, and the roll-up ranks by it.
function persistence(seenCount) {
  const times = Number(seenCount) || 1;
  if (times >= 5) return "지속";
  if (times >= 2) return "반복";
  return "관측";
}

const weightOf = (seenCount) => Math.min(Number(seenCount) || 1, 8);

/**
 * @param {object} input
 * @param {{companies: Record<string, {tech?: Array}>}} input.signals crawl-observed company signals
 * @param {{rules: Record<string, object>}} input.map technology → memory requirement rules
 * @returns {{schemaVersion, clientArtifact, runId, generatedAt, coverage, companies, rollup, unmapped}}
 */
export function deriveMemoryDemand({ signals = {}, map = {}, runId = null, now = new Date() } = {}) {
  const rules = map.rules || {};
  const observed = signals.companies || {};
  const companies = {};
  const byNeed = new Map();
  const unmapped = new Set();

  let derivedRows = 0;
  for (const [companyId, signal] of Object.entries(observed)) {
    const rows = [];
    for (const entry of signal.tech || []) {
      const label = norm(entry.label);
      const rule = rules[label];
      if (!rule) {
        if (label) unmapped.add(label);
        continue;
      }
      const hold = persistence(entry.seenCount);
      rows.push({
        technology: label,
        systemShift: rule.systemShift,
        memoryNeed: rule.memoryNeed,
        productAxis: rule.productAxis,
        stage: rule.stage,
        gate: rule.gate,
        hold,
        firstSeen: entry.firstSeen || entry.asOf || "",
        lastSeen: entry.lastSeen || entry.asOf || "",
        // The headline that put this technology on the record for this company.
        evidence: entry.headline || "",
        url: entry.url || "",
      });

      const key = `${rule.productAxis}::${rule.memoryNeed}`;
      const bucket = byNeed.get(key) || {
        memoryNeed: rule.memoryNeed,
        productAxis: rule.productAxis,
        stage: rule.stage,
        gate: rule.gate,
        technologies: new Set(),
        accounts: new Set(),
        weight: 0,
      };
      bucket.technologies.add(label);
      bucket.accounts.add(companyId);
      bucket.weight += weightOf(entry.seenCount);
      byNeed.set(key, bucket);
    }
    if (!rows.length) continue;
    // Strongest evidence first, so the row a reader sees first is the one the
    // feed keeps repeating.
    rows.sort((a, b) => {
      const order = { 지속: 3, 반복: 2, 관측: 1 };
      return (order[b.hold] || 0) - (order[a.hold] || 0) || String(b.lastSeen).localeCompare(String(a.lastSeen));
    });
    companies[companyId] = { requirements: rows };
    derivedRows += rows.length;
  }

  const rollup = [...byNeed.values()]
    .map((bucket) => ({
      memoryNeed: bucket.memoryNeed,
      productAxis: bucket.productAxis,
      stage: bucket.stage,
      gate: bucket.gate,
      technologies: [...bucket.technologies].sort(),
      accountCount: bucket.accounts.size,
      accounts: [...bucket.accounts].sort(),
      weight: bucket.weight,
    }))
    // A requirement that shows up across more accounts is a portfolio decision;
    // one account is a deal.
    .sort((a, b) => b.accountCount - a.accountCount || b.weight - a.weight)
    .slice(0, 12);

  return {
    schemaVersion: "1.0",
    clientArtifact: true,
    runId,
    generatedAt: new Date(now).toISOString(),
    coverage: {
      companiesObserved: Object.keys(observed).length,
      companiesWithDerivedDemand: Object.keys(companies).length,
      derivedRequirements: derivedRows,
      rules: Object.keys(rules).length,
      unmappedTechnologies: [...unmapped].sort(),
    },
    companies,
    rollup,
  };
}
