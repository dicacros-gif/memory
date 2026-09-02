// Different figures can be the very change a decision-maker needs to see.
// Exact canonical URLs still identify one document; fuzzy matches do not.
export function conflictingNewsFigures(a = {}, b = {}) {
  const fingerprint = (item) => {
    const title = String(item.originalTitle || item.title || item.titleKo || "");
    const values = title.match(/[$€£¥₩]?\s*\d[\d,]*(?:\.\d+)?\s*(?:%|trillion|billion|million|bn|mn|gbps|tb|gb|nm|조원|억원|억달러)?/gi) || [];
    return [...new Set(values.map((value) => value.toLowerCase().replace(/[,\s]+/g, "")))].sort();
  };
  const left = fingerprint(a);
  const right = fingerprint(b);
  return left.length > 0 && right.length > 0 && JSON.stringify(left) !== JSON.stringify(right);
}

// Shared by current news, retained references and the publication pipeline.
// A standing price table remains useful in tab 8, but is not an insight article.
export function isEditorialNewsItem(item = {}) {
  try {
    const url = new URL(item.verification?.canonicalUrl || item.sourceUrl || item.link || item.url || "");
    if (/(^|\.)(?:kucoin|weex|binance|companiesmarketcap)\.com$/i.test(url.hostname)) return false;
    if (/trendforce|dramexchange/i.test(url.hostname) && /^\/(?:price|price-table)(?:\/|$)/i.test(url.pathname)) return false;
  } catch { return false; }
  const summary = String(item.summaryKo || item.summary || item.summaryOriginal || "");
  return !/(?:research reports? covering market|offers? (?:market|industry) research|provides? (?:market|industry|high.tech).*research reports|연구 보고서를 제공하여 기업|구독하고.*소식|수준이네요|이랍니다|해보세요|살펴볼까요)/i.test(summary);
}
