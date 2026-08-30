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

const FILES = [
  "assets/css/styles.css",
  "assets/css/brand-system.css",
  "assets/css/landing.css",
  "assets/css/company-profile.css",
  "assets/css/mbb-frames.css",
];
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

// `.card:hover .label` recolours text that sits on the card's hovered fill, so
// the readable background is the nearest ancestor that paints one.
function ancestorBg(sel, bgBySelector) {
  const tokens = sel.replace(/\s*([>+~])\s*/g, " $1 ").split(/\s+/).filter(Boolean);
  for (let i = tokens.length - 1; i >= 1; i--) {
    const prefix = tokens.slice(0, i).join(" ").replace(/\s*[>+~]$/, "").trim();
    if (!prefix || !PSEUDO.test(prefix)) continue;
    const found = bgBySelector.get(prefix) || bgBySelector.get(baseSelector(prefix));
    if (found) return found;
  }
  return null;
}

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
      // descendant combinator, else an ancestor that is itself hovered (a card
      // recolouring its own text children), else the non-hover base rule.
      const ownerSel = sel.replace(/\s*\*\s*$/, "").trim();
      const bgRaw = decls["background-color"] || decls.background
        || bgBySelector.get(ownerSel)
        || ancestorBg(sel, bgBySelector)
        || bgBySelector.get(baseSelector(sel));
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

const consoleCss = await readFile(new URL("../assets/css/styles.css", import.meta.url), "utf8");
const brandSystemCss = await readFile(new URL("../assets/css/brand-system.css", import.meta.url), "utf8");
const appJs = await readFile(new URL("../assets/js/app.js", import.meta.url), "utf8");
assert.match(
  appJs,
  /ai-council-capabilities[\s\S]*?<div tabindex="0">[\s\S]*?ai-council-workstreams[\s\S]*?<div tabindex="0">[\s\S]*?ai-council-start" tabindex="0"/,
  "strategy-agent cards must expose their hover motion to keyboard focus",
);
assert.match(
  brandSystemCss,
  /Strategy-agent cards lift as one surface[\s\S]*?translateY\(-5px\)[\s\S]*?prefers-reduced-motion[\s\S]*?transform:\s*none !important/,
  "strategy-agent cards must lift on hover or focus while respecting reduced motion",
);
assert.doesNotMatch(
  consoleCss,
  /\[class\^="hs-"\][\s\S]{0,180}:is\(:hover, :focus-visible, :focus-within\)/,
  "hyperscaler container hover must not invert every descendant card",
);
assert.match(
  consoleCss,
  /\.projection-bar-seg:not\(:hover\):not\(:focus-visible\)[\s\S]{0,260}color: #fff !important/,
  "projection segments must own a readable light label on saturated fills",
);
assert.match(
  consoleCss,
  /\.hs-assume-list li:is\(:hover, :focus-within\)[\s\S]{0,220}background: #fff7e6 !important[\s\S]{0,140}color: #17263a !important/,
  "hyperscaler assumption hover must pair its paper surface with dark copy",
);
assert.match(
  consoleCss,
  /\.news-card:is\(:hover, :focus-within\) \.crawl-remove-button[\s\S]{0,240}background: #f8fafc !important[\s\S]{0,140}color: #17263a !important/,
  "news moderation control must keep a visible glyph on parent hover",
);
assert.equal(
  /\.sb-item, \.sb-cat\):not\(\.active\):is\(:hover, :focus-visible, :focus-within\)[\s\S]{0,260}background: rgba\(255, 255, 255, \.11\) !important/.test(consoleCss),
  true,
  "sidebar hover must use a translucent tint rather than a paper/navy inversion",
);
assert.equal(
  /--console-card-hover-bg: #f4f1fb[\s\S]{0,220}\[data-theme="dark"\][\s\S]{0,160}--console-card-hover-bg: #172033/.test(consoleCss),
  true,
  "console cards must own soft, theme-aware hover surfaces",
);
assert.match(
  consoleCss,
  /Hyperscaler decision surfaces invert atomically[\s\S]{0,680}transition-property: transform, box-shadow, border-color !important[\s\S]{0,900}transition: none !important/,
  "hyperscaler decision cards must repaint background and nested copy without a colour transition",
);
assert.match(
  consoleCss,
  /\.hs-scenario-tabs button[\s\S]{0,420}:is\(:hover, :focus-visible, :focus-within, \.active\)[\s\S]{0,260}background-color: #0b3040 !important[\s\S]{0,180}color: #f8fbfc !important/,
  "scenario selection and hover must use one atomic high-contrast state",
);
assert.equal(
  /\.qa-option:is\(:hover, :focus-visible, \.active\)[\s\S]{0,360}background: color-mix\(in srgb, var\(--qa, var\(--accent\)\) 7%, var\(--panel\)\)/.test(consoleCss),
  true,
  "question cards must tint their surface without full inversion",
);
assert.equal(
  appJs.includes('class="qa-option-action">판단 프레임 열기'),
  false,
  "question cards must omit the retired decision-frame action copy",
);
assert.equal(
  /document\.documentElement\.classList\.remove\("qa-library-open"\)[\s\S]{0,260}backdrop\.hidden = true[\s\S]{0,120}answerQuestion\(pair\.q, pair\)/.test(appJs),
  true,
  "opening an answer must release the question-library backdrop first",
);

const analyticalPalette = consoleCss.slice(consoleCss.lastIndexOf("Console analytical palette"));
assert.match(
  consoleCss,
  /\.qa-dropdown,\s*\.answer-panel \{[\s\S]{0,420}--qa-navy: #f4f8fa;[\s\S]{0,220}--qa-white: #10263a;/,
  "QA popups must use a bright canvas with dark readable copy",
);
assert.match(
  analyticalPalette,
  /\.scenario-card:is\(:hover, :focus-visible, :focus-within, \.active\)[\s\S]{0,520}background-color: color-mix\(in srgb, var\(--scenario-card-accent,[\s\S]{0,340}color: var\(--analysis-ink\) !important/,
  "scenario cards must use a semantic tint with readable ink instead of navy inversion",
);
assert.match(
  analyticalPalette,
  /\.news-card:is\(:hover, :focus-within\)[\s\S]{0,520}background-color: color-mix\(in srgb, var\(--news-accent,[\s\S]{0,360}color: var\(--analysis-ink\) !important/,
  "news cards must keep a tinted editorial surface on hover",
);
for (const [segment, color] of [
  ["ai-server", "#5b4cc4"],
  ["dc-storage", "#0b7285"],
  ["mobile-smartphone", "#3367b1"],
  ["pc-appliance", "#9a5a22"],
  ["auto-edge", "#9a4f75"],
]) {
  assert.ok(
    analyticalPalette.includes(`[data-projection-seg="${segment}"] { --projection-family: ${color}; }`),
    `${segment} must keep its own stable projection colour`,
  );
}
assert.match(
  analyticalPalette,
  /Product projection keeps each family colour[\s\S]{0,1500}\.projection-bar-seg:is\(:hover, :focus-visible, \.active\)[\s\S]{0,800}color: #fff !important[\s\S]{0,180}transform: none !important/,
  "projection hover must preserve family colour, white labels, and stable geometry",
);
assert.match(
  analyticalPalette,
  /#projection \.focus-actions button \{[\s\S]{0,820}background-image: linear-gradient\(135deg,[\s\S]{0,720}transform: none !important/,
  "projection detail actions must use stable gradient controls",
);
assert.doesNotMatch(
  analyticalPalette,
  /\.scenario-card:is\([^}]+\)[\s\S]{0,420}#0b3040/,
  "the final scenario interaction palette must not reintroduce the old navy inversion",
);

const mbbGradientSystem = consoleCss.slice(consoleCss.lastIndexOf("MBB GRADIENT FRAMEWORK SYSTEM"));
for (const token of [
  "--mbb-teal-1", "--mbb-blue-1", "--mbb-violet-1", "--mbb-magenta-1", "--mbb-amber-1",
]) {
  assert.ok(mbbGradientSystem.includes(token), `${token} must be part of the shared MBB palette`);
}
assert.match(
  mbbGradientSystem,
  /\.hs-card,[\s\S]{0,520}\.news-card,[\s\S]{0,380}background-image: var\(--mbb-card-gradient\) !important/,
  "console evidence and decision cards must share the consulting gradient surface",
);
assert.match(
  mbbGradientSystem,
  /\.hs-logic-step,[\s\S]{0,360}\.sc-memory-flow > li,[\s\S]{0,520}background-image: var\(--mbb-strong-gradient\) !important[\s\S]{0,260}color: #fff !important/,
  "framework flows must use directional gradients with readable white copy",
);
assert.match(
  mbbGradientSystem,
  /transition-property: transform, box-shadow, border-color !important[\s\S]{0,1500}transition: none !important/,
  "MBB card hover must animate geometry only and repaint copy atomically",
);
