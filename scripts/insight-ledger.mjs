/**
 * Insight ledger.
 *
 * whatChanged is a seven-day window, so an insight that mattered last month is
 * simply gone. The console is supposed to be where insight accumulates, which
 * needs a store that survives crawls: entries are appended, deduped by a stable
 * id, and carry firstSeen/lastSeen so a recurring signal reads as persistent
 * rather than new.
 */

const KINDS = {
  "pain-rise": { label: "고객 병목 상승", weight: 5 },
  "supply-change": { label: "공급 관계 변화", weight: 5 },
  "deal-event": { label: "계약 이벤트", weight: 4 },
  "opportunity-candidate": { label: "기술 기회", weight: 3 },
  "capital-move": { label: "투자 변동", weight: 3 },
  "generation-spec": { label: "세대 사양", weight: 2 },
  "strategy-opportunity": { label: "사업 기회", weight: 4 },
};

const iso = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
};
const day = (value) => (iso(value) || "").slice(0, 10) || null;
const text = (value, max = 180) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const evidenceIdOf = (entry = {}) => text([
  entry.url,
  entry.asOf,
  entry.headline,
].filter(Boolean).join("|"), 500);

const stableId = (kind, parts = []) => `${kind}:${parts.filter(Boolean).map((p) => String(p)
  .toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-|-$/g, "")).join(":")}`.slice(0, 180);

/** Normalise the various intelligence shapes into one ledger entry form. */
function collect(intelligence = {}, strategyOpportunities = {}, now = new Date()) {
  const stamp = day(now) || "";
  const out = [];
  const push = (kind, parts, entry) => {
    if (!entry.headline) return;
    out.push({
      id: stableId(kind, parts),
      kind,
      kindLabel: KINDS[kind]?.label || kind,
      weight: KINDS[kind]?.weight || 1,
      asOf: entry.asOf || stamp,
      ...entry,
    });
  };

  for (const alert of intelligence.painAlerts || []) {
    push("pain-rise", [alert.accountId, alert.axisId, alert.asOf], {
      accountId: alert.accountId,
      axisId: alert.axisId,
      asOf: day(alert.asOf),
      headline: `${alert.accountId} · ${alert.label} 신호 상승`,
      detail: text(alert.latest?.title),
      url: alert.latest?.url || "",
    });
  }

  for (const event of intelligence.deals?.events || []) {
    push("deal-event", [event.accountId, event.eventType, event.asOf], {
      accountId: event.accountId,
      asOf: day(event.asOf),
      headline: `${event.accountId} · ${text(event.eventType || "계약 신호", 40)}`,
      detail: text(event.evidenceSpan || event.detail),
      stage: event.evidenceStage || "",
      url: event.sourceUrl || "",
    });
  }

  for (const opportunity of intelligence.technologyOpportunities || []) {
    const latest = opportunity.latest || {};
    const minSources = Number(opportunity.promotionRule?.minSources || 2);
    const minMentions = Number(opportunity.promotionRule?.minMentions || 2);
    // A configured lens is not an insight. Publish only a promoted signal with
    // enough independent observations and a direct evidence path.
    if (opportunity.status !== "opportunity-candidate"
      || Number(opportunity.sourceCount || 0) < minSources
      || Number(opportunity.mentions || 0) < minMentions
      || !/^https?:\/\//i.test(String(latest.url || ""))) continue;
    push("opportunity-candidate", [opportunity.id, day(latest.date)], {
      asOf: day(latest.date),
      headline: `${text(opportunity.label || opportunity.id, 60)} · 기술 기회`,
      detail: text(`${opportunity.sourceCount}개 출처 · ${latest.title}`),
      url: latest.url || "",
      verification: {
        status: "cross-checked",
        sourceCount: Number(opportunity.sourceCount || 0),
        mentions: Number(opportunity.mentions || 0),
        minSources,
        minMentions,
      },
    });
  }

  for (const row of intelligence.supplierMatrix?.rows || []) {
    for (const cell of row.cells || []) {
      if (!cell.status || cell.status === "unconfirmed" || !cell.changed) continue;
      push("supply-change", [cell.accountId, cell.supplierId, cell.asOf || stamp], {
        accountId: cell.accountId,
        asOf: day(cell.asOf),
        headline: `${cell.accountId} · ${cell.supplierId} 공급 관계 ${text(cell.status, 24)}`,
        detail: text(cell.note),
        url: cell.source?.url || "",
      });
    }
  }

  for (const candidate of intelligence.generationCandidates || []) {
    push("generation-spec", [candidate.accountId, candidate.id || candidate.asOf], {
      accountId: candidate.accountId,
      asOf: day(candidate.asOf),
      headline: `${candidate.accountId} · 세대 사양 후보`,
      detail: text(candidate.title || candidate.detail),
      url: candidate.url || "",
    });
  }

  // Only a source-qualified, fully connected chain becomes a strategy
  // insight. Stable IDs omit the date so later evidence strengthens one
  // decision item rather than creating near-duplicate cards every crawl.
  const strategyAccounts = strategyOpportunities.accounts || strategyOpportunities || {};
  for (const [accountId, row] of Object.entries(strategyAccounts)) {
    for (const opportunity of row.opportunities || []) {
      if (opportunity.status !== "validated"
        || !/^https?:\/\//i.test(String(opportunity.evidence?.url || ""))) continue;
      push("strategy-opportunity", [accountId, opportunity.productAxis, opportunity.newBiz], {
        accountId,
        asOf: day(opportunity.evidence?.asOf),
        headline: `${text(opportunity.account || accountId, 48)} · ${text(opportunity.newBiz, 88)}`,
        detail: text(`${opportunity.signal} → ${opportunity.memoryRequirement} → ${opportunity.executionGate}`),
        stage: opportunity.stage || "",
        url: opportunity.evidence.url,
        verification: {
          status: "repeated-evidence",
          evidenceCount: Number(opportunity.evidence.count || 2),
          minimumEvidence: 2,
        },
      });
    }
  }

  return out;
}

export function buildInsightLedger({
  intelligence = {},
  strategyOpportunities = {},
  previous = {},
  now = new Date(),
  limit = 300,
  runId = null,
} = {}) {
  const stamp = iso(now) || new Date().toISOString();
  const byId = new Map();

  for (const entry of previous.entries || []) {
    if (!entry?.id) continue;
    if (entry.kind === "opportunity-candidate"
      && (!/^https?:\/\//i.test(String(entry.url || ""))
        || entry.verification?.status !== "cross-checked"
        || Number(entry.verification?.sourceCount || 0) < Number(entry.verification?.minSources || 2)
        || Number(entry.verification?.mentions || 0) < Number(entry.verification?.minMentions || 2))) continue;
    const evidenceIds = Array.isArray(entry.evidenceIds) && entry.evidenceIds.length
      ? [...new Set(entry.evidenceIds.filter(Boolean))]
      : [evidenceIdOf(entry)].filter(Boolean);
    byId.set(entry.id, { ...entry, evidenceIds, seenCount: evidenceIds.length || 1 });
  }

  let added = 0;
  for (const entry of collect(intelligence, strategyOpportunities, now)) {
    const existing = byId.get(entry.id);
    if (existing) {
      const evidenceId = evidenceIdOf(entry);
      if (entry.verification) existing.verification = entry.verification;
      if (evidenceId && existing.evidenceIds?.includes(evidenceId)) continue;
      if (evidenceId) existing.evidenceIds = [...(existing.evidenceIds || []), evidenceId];
      existing.lastSeen = stamp;
      existing.seenCount = existing.evidenceIds?.length || Number(existing.seenCount || 1) + 1;
      // Keep the richest copy: a later crawl often resolves a missing link.
      if (!existing.url && entry.url) existing.url = entry.url;
      if (!existing.detail && entry.detail) existing.detail = entry.detail;
      continue;
    }
    const evidenceId = evidenceIdOf(entry);
    byId.set(entry.id, {
      ...entry,
      firstSeen: stamp,
      lastSeen: stamp,
      seenCount: 1,
      evidenceIds: [evidenceId].filter(Boolean),
    });
    added += 1;
  }

  const entries = [...byId.values()]
    .sort((a, b) => String(b.asOf || "").localeCompare(String(a.asOf || ""))
      || String(b.firstSeen || "").localeCompare(String(a.firstSeen || ""))
      || (b.weight || 0) - (a.weight || 0))
    .slice(0, limit);

  const byKind = {};
  for (const entry of entries) byKind[entry.kind] = (byKind[entry.kind] || 0) + 1;

  return {
    schemaVersion: "1.0",
    clientArtifact: true,
    runId,
    generatedAt: stamp,
    total: entries.length,
    addedThisRun: added,
    byKind,
    kinds: Object.entries(KINDS).map(([id, meta]) => ({ id, label: meta.label })),
    entries,
  };
}
