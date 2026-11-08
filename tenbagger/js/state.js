// View state lives in the URL hash (#companies?industry=ai-infra&market=KR&sort=-revenueGrowthPct)
// so every view can be bookmarked and shared and the back button works.
export const VIEWS = ["industries", "companies", "startups", "history", "sources"];

export function parseHash(hash = location.hash) {
  const [path, query = ""] = String(hash).replace(/^#/, "").split("?");
  const [view, ...rest] = path.split("/");
  const params = Object.fromEntries(new URLSearchParams(query));
  return { view: VIEWS.includes(view) ? view : "industries", sub: rest.join("/") || null, params };
}

export function buildHash(view, params = {}, sub = null) {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""));
  const qs = q.toString();
  return `#${view}${sub ? `/${sub}` : ""}${qs ? `?${qs}` : ""}`;
}

export function go(view, params = {}, sub = null, { replace = false } = {}) {
  const hash = buildHash(view, params, sub);
  if (hash === location.hash) return;
  if (replace) history.replaceState(null, "", hash); else history.pushState(null, "", hash);
  window.dispatchEvent(new Event("tb:route"));
}

/** "-revenueGrowthPct,fcfMarginPct" <-> [{key, dir}] */
export const sortFromParam = (s) => (s ? s.split(",").filter(Boolean).map((k) => (k.startsWith("-") ? { key: k.slice(1), dir: "desc" } : { key: k, dir: "asc" })) : null);
export const sortToParam = (sort) => sort.map((s) => `${s.dir === "desc" ? "-" : ""}${s.key}`).join(",");

export const companyUrl = (id, extra = "") => `company.html?id=${encodeURIComponent(id)}${extra}`;
