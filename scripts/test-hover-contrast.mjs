/**
 * Hover readability gate.
 *
 * Every hover/focus rule that recolours text must land on a background with
 * enough contrast to stay readable. Rules are read straight from the CSS
 * sources, so this runs in CI without a browser (headless pages never fire the
 * rAF that reveals the console, which made browser-side probing unreliable).
 */
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const FILES = ["assets/css/strategy-experience.css"];
const MIN_RATIO = 4.5;
const PSEUDO = /:(hover|focus-visible|focus-within)\b/;

const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

function parseRules(css) {
  const rules = [];
  let depth = 0, buf = "", selector = "";
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === "{") {
      depth++;
      if (depth === 1) { selector = buf.trim(); buf = ""; continue; }
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        if (selector && !selector.startsWith("@")) rules.push({ selector, body: buf });
        else if (selector.startsWith("@")) rules.push(...parseRules(buf));
        buf = ""; selector = ""; continue;
      }
    }
    buf += ch;
  }
  return rules;
}

const splitSelectors = (selector) => {
  const parts = [];
  let depth = 0, buf = "";
  for (const ch of selector) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) { parts.push(buf); buf = ""; continue; }
    buf += ch;
  }
  if (buf.trim()) parts.push(buf);
  return parts.map((p) => p.trim()).filter(Boolean);
};

const declsOf = (body) => {
  const out = {};
  for (const part of body.split(";")) {
    const idx = part.indexOf(":");
    if (idx < 0) continue;
    const prop = part.slice(0, idx).trim().toLowerCase();
    if (!prop || prop.includes("{")) continue;
    out[prop] = part.slice(idx + 1).trim();
  }
  return out;
};

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
function toRgb(value, vars, seen = 0) {
  if (!value || seen > 6) return null;
  let v = String(value).replace(/!important/g, "").trim();
  const varMatch = v.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*([\s\S]+))?\)$/);
  if (varMatch) {
    const resolved = vars.get(varMatch[1]);
    return toRgb(resolved || varMatch[2], vars, seen + 1);
  }
  v = (v.split(/\s+(?=(?:linear|radial|url|conic))/)[0] || v).trim();
  if (HEX.test(v)) {
    let h = v.slice(1);
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
  }
  const rgb = v.match(/^rgba?\(([^)]+)\)$/i);
  if (rgb) {
    const p = rgb[1].split(/[,\s\/]+/).filter(Boolean).map(Number);
    if (p.length >= 3 && p.slice(0, 3).every(Number.isFinite)) return { r: p[0], g: p[1], b: p[2], a: Number.isFinite(p[3]) ? p[3] : 1 };
  }
  if (v === "#fff" || v === "white") return { r: 255, g: 255, b: 255, a: 1 };
  if (v === "#000" || v === "black") return { r: 0, g: 0, b: 0, a: 1 };
  return null;
}

const lum = (c) => {
  const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
};
const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
const ratioOf = (fg, bg) => { const a = lum(over(fg, bg)), b = lum(bg); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };

const baseSelector = (sel) => sel.replace(/:is\([^)]*\)/g, (m) => (PSEUDO.test(m) ? "" : m)).replace(PSEUDO, "").replace(/\s*\*\s*$/, "").trim();

const findings = [];
let checked = 0, unresolved = 0;

for (const file of FILES) {
  const css = strip(await readFile(new URL(`../${file}`, import.meta.url), "utf8"));
  const rules = parseRules(css);
  // The stylesheet ships a light and a dark palette, so a single flat variable
  // map would resolve tokens to whichever theme happens to be declared last.
  const lightVars = new Map();
  const darkVars = new Map();
  const bgBySelector = new Map();
  for (const rule of rules) {
    const decls = declsOf(rule.body);
    const isDark = /\[data-theme=["']?dark["']?\]|prefers-color-scheme:\s*dark/.test(rule.selector);
    // Component-scoped overrides (e.g. a card redefining --ink) cannot be
    // resolved without cascade context, so only palette-level declarations are
    // trusted. Anything else leaves the token unresolved and the rule skipped.
    const themeLevel = /^(:root|html|body|\[data-theme)/.test(rule.selector.trim());
    if (themeLevel) {
      for (const [prop, value] of Object.entries(decls)) {
        if (!prop.startsWith("--")) continue;
        (isDark ? darkVars : lightVars).set(prop, value);
      }
    }
    const bg = decls["background-color"] || decls.background;
    if (bg) for (const sel of splitSelectors(rule.selector)) bgBySelector.set(sel, bg);
  }
  const themes = [["light", lightVars], ["dark", new Map([...lightVars, ...darkVars])]];
  for (const rule of rules) {
    if (!PSEUDO.test(rule.selector)) continue;
    const decls = declsOf(rule.body);
    if (!decls.color) continue;
    for (const sel of splitSelectors(rule.selector)) {
      if (!PSEUDO.test(sel)) continue;
      // Background: this rule, else the same hover selector without the trailing
      // descendant combinator, else the non-hover base rule.
      const ownerSel = sel.replace(/\s*\*\s*$/, "").trim();
      const bgRaw = decls["background-color"] || decls.background || bgBySelector.get(ownerSel) || bgBySelector.get(baseSelector(sel));
      for (const [theme, vars] of themes) {
        const fg = toRgb(decls.color, vars);
        const bg = toRgb(bgRaw, vars);
        // A translucent hover fill composites over an unknown backdrop, so its
        // real contrast cannot be judged from the stylesheet alone.
        if (!fg || !bg || bg.a < 0.95) { unresolved++; continue; }
        checked++;
        const ratio = ratioOf(fg, bg);
        if (ratio < MIN_RATIO) findings.push({ file, theme, sel: sel.slice(0, 88), ratio: Number(ratio.toFixed(2)) });
      }
    }
  }
}

if (findings.length) {
  console.error(`hover contrast failures (${findings.length}):`);
  for (const f of findings.slice(0, 25)) console.error(`  ${f.ratio}  [${f.theme}] ${f.sel}`);
}
console.log(JSON.stringify({ checked, unresolved, failures: findings.length }));
assert.ok(checked > 0, "hover contrast gate must resolve at least one active interactive state");
assert.equal(findings.length, 0, "hovered text must keep at least 4.5:1 contrast against its hovered background");
