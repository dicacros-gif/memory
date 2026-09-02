/**
 * A URL can name a document or name a place.
 *
 * Only a document can sit under a decision as its evidence. A company's front
 * page, a locale doorway or a section index has no publication date of its own,
 * and the text a crawler lifts from it is the site's standing meta description
 * — a marketing line, not a claim anyone made on a given day. Promoting one
 * puts a source and an "AS OF" date on a card when the only true statement is
 * that we looked at the site that morning.
 *
 * This is the shared test. crawl.mjs applies it when a brief picks its headline
 * evidence; site-content.mjs applies it again where panels read that evidence,
 * so a brief built before the gate existed cannot leak through a rebuild.
 */

// /en/, /en-WW/, /global/ — a doorway to content, not content.
const LOCALE_SEGMENT_RE = /^(?:[a-z]{2}|[a-z]{2}[-_][a-z]{2,3}|global|www)$/i;

// A section index lists articles; it is not one. /news is out, /news/2026/… stays.
const SECTION_INDEX_RE = /^(?:news|newsroom|newsroom-home|press|press-releases|media|blog|blogs|stories|story|insights|resources)$/i;

// Evergreen site furniture. Real pages, but the company describing itself
// rather than something that happened.
const STANDING_PAGE_RE = /^(?:products?|product-portfolio|solutions?|about|about-us|company|our-story(?:\.[a-z]+)?|careers?|support|contact|investors?|glossary|wiki)(?:\/|$)/i;

// The same page can sit under a container — /site/about-XMC, /en/company/overview
// — so the last segment is tested on its own name too. "about-XMC" is an
// about page whatever precedes it.
const STANDING_LEAF_RE = /^(?:about|company|overview|profile|introduction|corporate|who-we-are|our-story|careers?|contact|history|leadership|mission|vision)(?:[-_.]|$)/i;

// A quote page is a live readout and a glossary entry is a definition. Neither
// was published on a day, so neither can carry a date on a decision card.
const LIVE_READOUT_RE = /(?:^|\/)(?:quote|quotes|ticker)(?:\/|$)/i;
const GLOSSARY_RE = /(?:^|\/|-)glossary(?:$|[-/.])/i;

export function isEvidenceDocumentUrl(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return false;
  let url;
  try { url = new URL(raw); } catch { return false; }
  if (!/^https?:$/.test(url.protocol)) return false;
  if (/(^|\.)companiesmarketcap\.com$/i.test(url.hostname)) return false;
  const path = url.pathname.replace(/\/+$/, "");
  if (!path) return false;
  const segments = path.split("/").filter(Boolean);
  if (segments.every((segment) => LOCALE_SEGMENT_RE.test(segment))) return false;
  const tail = segments.filter((segment) => !LOCALE_SEGMENT_RE.test(segment));
  if (!tail.length) return false;
  if (tail.length === 1 && SECTION_INDEX_RE.test(tail[0])) return false;
  if (/^company\/newsroom\/(?:press-releases|blogs)\/20\d{2}\/[^/]+/i.test(tail.join("/"))) return true;
  if (STANDING_PAGE_RE.test(tail.join("/"))) return false;
  if (STANDING_LEAF_RE.test(tail[tail.length - 1])) return false;
  if (LIVE_READOUT_RE.test(path)) return false;
  if (GLOSSARY_RE.test(path)) return false;
  return true;
}
