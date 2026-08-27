/**
 * Pain points, derived.
 *
 * The chain the brief asks for runs 고객의 새로운 요구 → 메모리의 새로운 요구 →
 * 제품 → 신규 사업. The middle two links were already derived: memory-demand
 * turns an observed technology into a memory requirement and a product axis.
 * The first and last links were still written by hand per account, which is the
 * part that goes stale and the part that does not scale — a new account meant a
 * new paragraph.
 *
 * So the conditions a pain point depends on are read from what the crawl
 * observed (which halves of the workload the account has silicon for, which
 * product axes its derived requirements land on, whose silicon it runs), and
 * the pain, the memory answer and the business hook come from a rule table.
 * One rule covers every account. An account the feed has said nothing about
 * gets no card rather than a generic one.
 */

const norm = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

/**
 * Evaluate one rule's conditions against an account's observed facts.
 * Every condition must hold; an unknown condition name fails closed.
 */
function matches(when = {}, facts = {}) {
  for (const [key, expected] of Object.entries(when)) {
    if (key === "coversTraining" || key === "coversInference" || key === "designerOtherThanSelf") {
      if (Boolean(facts[key]) !== Boolean(expected)) return false;
      continue;
    }
    if (key === "productAxis") {
      if (!facts.productAxes?.includes(expected)) return false;
      continue;
    }
    return false;
  }
  return true;
}

/**
 * @returns {{schemaVersion, clientArtifact, runId, generatedAt, coverage, accounts}}
 */
export function buildPainPoints({
  silicon = {},
  memoryDemand = {},
  rules = {},
  accounts = [],
  now = new Date(),
  runId = null,
} = {}) {
  const table = (rules.rules || []).filter((rule) => rule.id && rule.pain);
  const ids = accounts.length
    ? accounts.map((account) => account.id).filter(Boolean)
    : [...new Set([...Object.keys(silicon), ...Object.keys(memoryDemand)])];

  const out = {};
  let cards = 0;
  for (const id of ids) {
    const chip = silicon[id] || null;
    const requirements = memoryDemand[id]?.requirements || [];
    if (!chip && !requirements.length) continue;

    const productAxes = [...new Set(requirements.map((row) => norm(row.productAxis)).filter(Boolean))];
    const designers = chip?.designers || [];
    const facts = {
      coversTraining: Boolean(chip?.coversTraining),
      coversInference: Boolean(chip?.coversInference),
      // Running silicon somebody else designed is a different exposure from
      // designing your own, and the registry already separates the two.
      designerOtherThanSelf: designers.some((designer) => !norm(designer).toLowerCase().includes(id.toLowerCase())),
      productAxes,
    };

    const matched = table.filter((rule) => matches(rule.when, facts)).map((rule) => ({
      id: rule.id,
      pain: rule.pain,
      cause: rule.cause,
      answer: rule.answer,
      products: rule.products || [],
      newBiz: rule.newBiz,
      metric: rule.metric,
      // What in the observation made this rule fire, so a reader can check it
      // rather than take the card on trust.
      basis: [
        facts.coversTraining && rule.when.coversTraining ? "학습 실리콘 관측" : "",
        facts.coversInference && rule.when.coversInference ? "추론 실리콘 관측" : "",
        rule.when.designerOtherThanSelf ? `외부 설계 · ${designers.join(" · ")}` : "",
        rule.when.productAxis ? `파생 제품축 · ${rule.when.productAxis}` : "",
      ].filter(Boolean).join(" / "),
    }));
    if (!matched.length) continue;

    out[id] = { painPoints: matched.slice(0, 4) };
    cards += out[id].painPoints.length;
  }

  return {
    schemaVersion: "1.0",
    clientArtifact: true,
    runId,
    generatedAt: new Date(now).toISOString(),
    coverage: { rules: table.length, accounts: Object.keys(out).length, cards },
    accounts: out,
  };
}
