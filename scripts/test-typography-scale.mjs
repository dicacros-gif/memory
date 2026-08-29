import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const brand = fs.readFileSync(path.join(root, "assets/css/brand-system.css"), "utf8");
const landing = fs.readFileSync(path.join(root, "assets/js/landing.js"), "utf8");
const landingCss = fs.readFileSync(path.join(root, "assets/css/landing.css"), "utf8");
const consoleCss = fs.readFileSync(path.join(root, "assets/css/styles.css"), "utf8");

function customProperty(name) {
  const match = brand.match(new RegExp(`--${name}\\s*:\\s*([^;]+);`));
  assert.ok(match, `missing typography token --${name}`);
  return match[1].trim();
}

function assertFixedToken(name, expectedPx) {
  assert.equal(customProperty(name), `${expectedPx}px`, `--${name} must remain ${expectedPx}px`);
}

function assertClampBounds(name, expectedMin, expectedMax) {
  const value = customProperty(name);
  const match = value.match(/^clamp\(\s*([\d.]+)px\s*,[\s\S]*,\s*([\d.]+)px\s*\)$/);
  assert.ok(match, `--${name} must be a px-bounded clamp(), received ${value}`);
  const [, minimum, maximum] = match.map(Number);
  assert.equal(minimum, expectedMin, `--${name} minimum must be ${expectedMin}px`);
  assert.equal(maximum, expectedMax, `--${name} maximum must be ${expectedMax}px`);
  assert.ok(minimum <= maximum, `--${name} has an inverted range`);
}

for (const [name, size] of [
  ["type-size-micro", 10],
  ["type-size-label", 11],
  ["type-size-caption", 12],
  ["type-size-body", 13],
  ["type-size-body-lg", 14],
]) {
  assertFixedToken(name, size);
}

for (const [name, minimum, maximum] of [
  ["type-size-card-title", 17, 20],
  ["type-size-subsection", 24, 32],
  ["type-size-section", 30, 46],
  ["type-size-hero", 42, 56],
  ["type-size-hero-mobile", 38, 44],
]) {
  assertClampBounds(name, minimum, maximum);
}

for (const [className, token] of [
  ["ui-text-floor-compact", "type-size-micro"],
  ["ui-heading-hero-cap", "type-size-hero"],
  ["ui-heading-section-cap", "type-size-section"],
  ["ui-heading-subsection-cap", "type-size-subsection"],
]) {
  assert.match(brand, new RegExp(`\\.${className}\\b[\\s\\S]*?font-size\\s*:\\s*var\\(--${token}\\)`), `${className} must use --${token}`);
  assert.match(landing, new RegExp(`\\b${className}\\b`), `${className} must be enforced by the runtime readability guard`);
}

for (const [name, source] of [["landing", landingCss], ["Console", consoleCss]]) {
  assert.match(source, /\.ui-text-floor\b[\s\S]*?font-size\s*:\s*(?:12px|var\(--type-size-caption\))/, `${name} standard text floor must remain 12px`);
}
assert.match(landing, /fontSize\s*<\s*12/, "the runtime standard text floor must remain 12px");
assert.match(landing, /fontSize\s*<\s*10/, "compact diagrams must retain a 10px minimum");

console.log(JSON.stringify({
  status: "typography-scale-approved",
  fixedScale: "10/11/12/13/14px",
  headingCaps: "20/32/46/56px",
  mobileHeroCap: "44px",
}, null, 2));
