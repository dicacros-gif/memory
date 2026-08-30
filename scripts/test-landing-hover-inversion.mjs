import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const landing = fs.readFileSync(path.join(root, "assets/css/landing.css"), "utf8");

// The readability audit runs a frame after pointerover, so sliding from one
// consulting card to the next tags the incoming card against the surface it
// had before the pointer arrived. That is survivable only while the hover
// inversion outranks the ink classes it has to correct. The ink is declared at
// #businessSite, and an id beats any number of classes, so a class-only guard
// silently loses and near-black copy lands on the dark hover surface.
const inkAtId = /#businessSite\s+:is\(\.ui-contrast-on-(?:dark|light)\)/.test(landing);
assert.ok(inkAtId, "landing CSS must still declare the audit ink classes at #businessSite");

// Read real rule blocks rather than scanning loose text: the muted-copy guard
// mentions the same ink classes, and matching it instead would let the rule
// that actually carries the headline colour disappear unnoticed.
// Comments are stripped first: a selector capture runs back to the previous
// brace, so an explanatory comment naming #businessSite would otherwise be read
// as part of the selector and pass a rule that is only class-scoped.
const stylesheet = landing.replace(/\/\*[\s\S]*?\*\//g, " ");
const rules = [...stylesheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map((match) => ({ selector: match[1].trim(), body: match[2] }));

const guard = rules.find((rule) => rule.selector.includes("#businessSite")
  && rule.selector.includes(".business-strategy-artifact")
  && /:hover/.test(rule.selector)
  && rule.body.includes("--motion-copy-hover"));
assert.ok(
  guard,
  "the artifact hover inversion must be declared at #businessSite so it outranks #businessSite ink classes",
);

// The guard stays scoped to this grid on purpose. Cards elsewhere hover onto
// teal, amber and paper surfaces where the audit's ink is the right answer, and
// forcing the navy palette across every consulting card traded one unreadable
// state for fifty.
const overreach = rules.find((rule) => rule.selector.includes("#businessSite")
  && /\.business-consulting-motion:is\([^)]*:hover/.test(rule.selector)
  && !rule.selector.includes(".business-strategy-artifact")
  && rule.body.includes("--motion-copy-hover"));
assert.ok(
  !overreach,
  `the inversion guard must not be widened to every consulting card: ${overreach?.selector.slice(0, 90)}`,
);

// Whatever the motion variables resolve to, the copy must never fall back to an
// inherited colour: that is what put light text on the white cells at 1.05:1.
assert.match(
  guard.body,
  /color:\s*var\(--motion-copy-hover,\s*#[0-9a-f]{3,8}\)\s*!important/i,
  "the inversion guard must give --motion-copy-hover a literal fallback",
);
assert.match(
  guard.body,
  /-webkit-text-fill-color:\s*currentColor\s*!important/i,
  "the guard must reclaim -webkit-text-fill-color, which is what actually paints",
);

// The six-cell artifact is a light grid inside a dark solution card, so a cell
// with no ink tag of its own inherits paper-coloured text onto white.
for (const [selector, why] of [
  [
    /#businessSite\s+\.business-strategy-artifact\s*>\s*div:not\([^)]*:hover[^)]*\)\s*>\s*span/,
    "artifact labels must pin their resting colour at #businessSite",
  ],
  [
    /#businessSite\s+\.business-strategy-artifact\s*>\s*div:not\([^)]*:hover[^)]*\)\s*>\s*p/,
    "artifact body copy must pin its resting colour at #businessSite",
  ],
]) {
  assert.match(landing, selector, why);
}

console.log(JSON.stringify({ status: "landing-hover-inversion-pass", guardedAtId: true }));
