// Full company page: company.html?id=us-nasdaq-nvda[&from=YYYY-MM-DD&to=YYYY-MM-DD]
import { mountCompany } from "./company.js";
import { errorBanner } from "./data.js";

const q = new URLSearchParams(location.search);
const host = document.getElementById("view");
const saved = (() => { try { return localStorage.getItem("tb-theme"); } catch { return null; } })();
document.documentElement.dataset.theme = saved || "dark";
const run = () => mountCompany(host, q.get("id") || "", { zoom: q.get("from") ? { from: q.get("from"), to: q.get("to") } : null })
  .catch((error) => errorBanner(host, [{ name: "companies", error: error.message }], run));
run();
