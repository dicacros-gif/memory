import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { formatPublicDate, formatPublicTemporalCopy } from "../assets/js/public-copy-policy.js";

const root = new URL("../", import.meta.url);
const read = (relativePath) => readFile(new URL(relativePath, root), "utf8");

assert.equal(formatPublicDate("2025-08"), "'25.8월");
assert.equal(formatPublicDate("2025년 8월"), "'25.8월");
assert.equal(formatPublicDate("2025.08"), "'25.8월");
// A date in the current year reads as M/D. Any other year falls back to its
// month: the day of a two-year-old announcement is not something anyone acts
// on, and the marker is what stops it passing for a recent date. This gate used
// to assert that a 2024 date and a 2026 date format identically, which is how a
// Blackwell announcement from March 2024 came to sit on two OEM cards as "3/18"
// while those cards diagnosed a 2026 platform.
assert.equal(formatPublicDate("2025-08-07", 2025), "8/7");
assert.equal(formatPublicDate("2025년 8월 25일", 2025), "8/25");
assert.equal(formatPublicDate("2024-03-18", 2026), "'24.3월");
assert.equal(formatPublicDate("2026-05-18", 2026), "5/18");
assert.notEqual(formatPublicDate("2024-03-18", 2026), formatPublicDate("2026-03-18", 2026), "a date from another year must never format identically to this year's");
assert.equal(formatPublicDate("2025-13"), "");
assert.equal(formatPublicDate("2025-02-29"), "");
assert.equal(formatPublicTemporalCopy("처리량 2025.8GB"), "처리량 2025.8GB");
assert.equal(formatPublicTemporalCopy("비중 2025.2%"), "비중 2025.2%");
assert.equal(
  formatPublicTemporalCopy("기준 2025년 8월 · 갱신 2025.08 · 검증 2025-08-07"),
  `기준 '25.8월 · 갱신 '25.8월 · 검증 ${formatPublicDate("2025-08-07")}`,
);

const [landing, profile, frames] = await Promise.all([
  read("assets/js/landing.js"),
  read("assets/js/company-profile.js"),
  read("assets/js/mbb-frames.js"),
]);

assert.match(
  landing,
  /parent\.closest\("#intelligenceConsole, script, style, code, pre, time, input, textarea, \[data-keep-date\]"\)/,
  "landing date normalization must not rewrite Console text",
);
assert.match(
  profile,
  /typeof window\.memoryFormatConsoleTemporal === "function"/,
  "company profile should use the Console formatter when the host exposes it",
);
assert.match(profile, /return `\$\{month\}\/\$\{day\}`/, "profile day fallback must use M/D");
assert.match(profile, /`'\$\{monthMatch\[1\]\.slice\(-2\)\}\.\$\{month\}월`/, "profile month fallback must use 'YY.M월");
assert.match(
  profile,
  /shortDate\(item\.date \|\| item\.asOf \|\| ""\)/,
  "profile evidence dates must pass through the display formatter",
);
assert.doesNotMatch(profile, /escapeHTML\(row\.asOf \|\| ""\)/, "profile as-of labels must not expose raw dates");
assert.doesNotMatch(profile, /\[seen\.amount, seen\.date\]/, "profile observed dates must not expose raw dates");
// The <time> also states when its source predates the current platform
// generation; the raw machine-readable date is still the attribute.
assert.match(
  frames,
  /<time datetime="\$\{esc\(rawDate\)\}" data-source-age="\$\{esc\(stale \? "stale" : "current"\)\}">/,
  "MBB display formatting must preserve the raw datetime attribute and expose the source's age",
);
assert.match(frames, /const date = formatPublicDate\(rawDate\)/, "MBB linked records must use the shared temporal policy");

console.log(JSON.stringify({ status: "console-temporal-copy-pass" }, null, 2));
