// Shared company-data layer for the ten-bagger pages. Every file is loaded
// once; a failed file reports an explicit error state with a retry.
const BASE = new URL("../../data/tenbagger/", import.meta.url);
const FILES = {
  companies: "companies.json", industries: "industries.json", startups: "startups.json", history: "history.json",
  status: "status.json", changelog: "changelog.json", sources: "source-checks.json", universe: "universe.json", screen: "screen.json",
};
const cache = new Map();

export function load(name) {
  if (!cache.has(name)) {
    cache.set(name, fetch(new URL(FILES[name], BASE), { cache: "no-cache" }).then((r) => {
      if (!r.ok) throw new Error(`${FILES[name]}: HTTP ${r.status}`);
      return r.json();
    }).catch((error) => { cache.delete(name); throw error; }));
  }
  return cache.get(name);
}

export async function loadAll(names) {
  const results = await Promise.allSettled(names.map(load));
  const out = {}, errors = [];
  results.forEach((r, i) => { if (r.status === "fulfilled") out[names[i]] = r.value; else errors.push({ name: names[i], error: r.reason?.message || String(r.reason) }); });
  return { data: out, errors };
}

export function bars(ticker) {
  const [exchange, code] = String(ticker).split(":");
  const venues = /^(NASDAQ|NYSE|NYSEAMERICAN|AMEX)$/.test(exchange) ? [exchange, "NASDAQ", "NYSE", "NYSEAMERICAN"]
    : /^(KRX|KOSDAQ|KOSPI)$/.test(exchange) ? [exchange, "KRX", "KOSDAQ"] : [exchange];
  const keys = [...new Set(venues.map((v) => `${v}_${code}`.replace(/[/\s]/g, "-")))];
  const get = (k) => fetch(new URL(`bars/${k}.json`, BASE), { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return keys.reduce((p, k) => p.then((d) => d || get(k)), Promise.resolve(null));
}

/** Skeleton while loading; error banner with retry when a file fails. */
export function skeleton(host, rows = 6) {
  host.innerHTML = `<div class="skeleton" aria-busy="true" aria-label="불러오는 중">${'<div class="sk-row"></div>'.repeat(rows)}</div>`;
}
export function errorBanner(host, errors, retry) {
  host.innerHTML = `<div class="error-banner" role="alert"><b>데이터를 불러오지 못했습니다.</b> ${errors.map((e) => `<code>${e.name}</code> ${e.error}`).join(" · ")}
    <button type="button" class="btn" data-retry>다시 시도</button><span class="muted">마지막으로 성공한 데이터가 서버에 남아 있으면 다시 시도로 열립니다.</span></div>`;
  host.querySelector("[data-retry]").addEventListener("click", retry);
}
