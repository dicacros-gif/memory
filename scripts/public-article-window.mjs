/**
 * Which dated articles a public artifact may show. This was the calendar
 * year ("2026"), which would have emptied the news stream and stripped every
 * brief's source on the first crawl of 2027. It is a rolling year before the
 * artifact's own timestamp instead.
 */
export const PUBLIC_ARTICLE_WINDOW_DAYS = 365;

/** The last day (YYYY-MM-DD) that is too old to show, for an artifact made at `reference`. */
export function publicArticleCutoff(reference = null) {
  const time = Date.parse(reference || "") || Date.now();
  return new Date(time - PUBLIC_ARTICLE_WINDOW_DAYS * 864e5).toISOString().slice(0, 10);
}

/** True when `date` (YYYY-MM-DD or ISO) falls inside the window that ends at the cutoff. */
export function isWithinPublicArticleWindow(date = "", cutoff = publicArticleCutoff()) {
  const day = String(date || "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && day > cutoff;
}
