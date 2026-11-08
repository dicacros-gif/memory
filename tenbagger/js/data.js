// Shared company-data layer for the ten-bagger pages. Every file is loaded
// once; a failed file reports an explicit error state with a retry.
const BASE = new URL("../../data/tenbagger/", import.meta.url);
const FILES = {
  companies: "companies.json", industries: "industries.json", startups: "startups.json", history: "history.json",
  status: "status.json", changelog: "changelog.json", digest: "digest.json", positioning: "positioning.json", sources: "source-checks.json", universe: "universe.json", screen: "screen.json",
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
let retryTimer = null;
export function errorBanner(host, errors, retry) {
  clearTimeout(retryTimer);
  const notYet = errors.every((e) => /HTTP 404/.test(e.error));
  host.innerHTML = notYet
    ? `<div class="error-banner info" role="status"><b>데이터를 준비하고 있습니다.</b> 매일 자동 수집 작업이 이 화면의 데이터 파일(${errors.map((e) => `<code>${e.name}</code>`).join(", ")})을 아직 게시하지 않았습니다. 1분마다 자동으로 다시 확인합니다.
        <button type="button" class="btn" data-retry>지금 다시 확인</button></div>`
    : `<div class="error-banner" role="alert"><b>데이터를 불러오지 못했습니다.</b> ${errors.map((e) => `<code>${e.name}</code> ${e.error}`).join(" · ")}
        <button type="button" class="btn" data-retry>다시 시도</button><span class="muted">마지막으로 게시된 정상 데이터가 있으면 다시 시도로 열립니다. 1분 뒤 자동으로 다시 시도합니다.</span></div>`;
  host.querySelector("[data-retry]").addEventListener("click", () => { clearTimeout(retryTimer); retry(); });
  retryTimer = setTimeout(retry, 60_000);
}
