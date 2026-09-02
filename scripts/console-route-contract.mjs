// Shared test contract: production navigation must not be used as its own oracle.
export const CONSOLE_ROUTE_IDS = Object.freeze([
  "signal", "biz-consulting", "workload-requirement", "hyperscaler-demand",
  "partnerships", "analysis", "c-level", "price",
]);
export const CONSOLE_ROUTE_LANDMARKS = Object.freeze([
  "industry-shift", "strategy-consulting", "visual-bridge-system", "projection",
  "numbers", "visual-bridge-execution", "c-level-cockpit", "prices",
]);
export function readConsoleRoutes(source) {
  const literal = source.match(/const SIDE_NAV_ROUTES = (\[[\s\S]*?\]);\s*const ROUTE_DISPLAY/);
  if (!literal) throw new Error("Console route table is missing");
  return Function(`"use strict"; return (${literal[1]});`)();
}
