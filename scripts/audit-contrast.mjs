#!/usr/bin/env node
// Measures text contrast on the rendered page instead of reasoning about the
// stylesheet. Two things made the source-level guesses unreliable: a colour can
// be painted by `-webkit-text-fill-color` rather than `color`, and a surface is
// usually a stack of translucent layers rather than one declared background.
// Both only resolve once the page is laid out, so this drives a real browser.
//
//   node scripts/audit-contrast.mjs                 # audit the landing page
//   node scripts/audit-contrast.mjs --json out.json # also write the findings
//   node scripts/audit-contrast.mjs --max 0         # fail on any finding
//
// Exits 0 when the number of findings is within --max (default: 0), 1
// otherwise. Exits 0 with a notice when no Chrome build is present, so a
// machine without one does not turn into a red build.
//
// `pnpm run audit:contrast` gates five passes — landing and console, desktop and
// phone, plus landing hover — all at zero. The console's own hover pass is the
// one it does NOT gate, and it is exposed separately as
// `audit:contrast:console-hover`: repeated runs on an unchanged tree return 26,
// 35 and 389 findings, because the console's projection and scenario modules
// hydrate at different points relative to when :hover is forced. The findings it
// does surface are real; the count is not yet stable enough to fail a build on.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

function parseArgs(argv) {
  const args = {
    page: "index.html",
    max: null,
    json: "",
    viewport: "1440x900",
    waitFor: "",
    hover: false,
    themeCycle: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--page") args.page = argv[++index];
    else if (flag === "--max") args.max = Number(argv[++index]);
    else if (flag === "--json") args.json = argv[++index];
    else if (flag === "--viewport") args.viewport = argv[++index];
    else if (flag === "--wait-for") args.waitFor = argv[++index];
    else if (flag === "--hover") args.hover = true;
    else if (flag === "--theme-cycle") args.themeCycle = true;
  }
  return args;
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((request, response) => {
      let pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      if (pathname.endsWith("/")) pathname += "index.html";
      const file = path.join(ROOT, pathname);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        response.writeHead(404).end("not found");
        return;
      }
      response.writeHead(200, {
        "content-type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
        "cache-control": "no-store",
      });
      fs.createReadStream(file).pipe(response);
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

function findChrome() {
  return CHROME_CANDIDATES.find((candidate) => {
    try { return fs.existsSync(candidate); } catch { return false; }
  }) || null;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function launchChrome(binary, viewport) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "contrast-audit-"));
  const child = spawn(binary, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    `--window-size=${viewport.replace("x", ",")}`,
    `--user-data-dir=${profile}`,
    "--remote-debugging-port=0",
    "about:blank",
  ], { stdio: "ignore" });

  const portFile = path.join(profile, "DevToolsActivePort");
  let port = 0;
  for (let attempt = 0; attempt < 100 && !port; attempt += 1) {
    await wait(100);
    if (!fs.existsSync(portFile)) continue;
    const [line] = fs.readFileSync(portFile, "utf8").split("\n");
    if (line && Number(line)) port = Number(line);
  }
  if (!port) {
    child.kill();
    throw new Error("Chrome did not report a debugging port");
  }
  return { child, port, profile };
}

class Session {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      const entry = this.pending.get(message.id);
      if (!entry) return;
      this.pending.delete(message.id);
      if (message.error) entry.reject(new Error(message.error.message));
      else entry.resolve(message.result);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || "page evaluation failed");
    }
    return result.result.value;
  }
}

async function connect(port, url) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  const target = await response.json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", () => reject(new Error("devtools socket failed")), { once: true });
  });
  return { session: new Session(socket), targetId: target.id };
}

// The page-side measurement. Kept as source text so the browser evaluates it
// verbatim, and so the same routine can be reused by other page audits.
const SCANNER = String.raw`
(() => {
  const parseColor = (value) => {
    if (!value) return null;
    const text = String(value).trim();
    if (text === "transparent") return [0, 0, 0, 0];
    const cssNumber = (token, percentScale = 1) => {
      const source = String(token || "").trim().toLowerCase();
      if (!source || source === "none") return 0;
      const number = Number.parseFloat(source);
      if (!Number.isFinite(number)) return null;
      return source.endsWith("%") ? number * percentScale / 100 : number;
    };
    const oklabToSrgb = (lightness, axisA, axisB) => {
      const lRoot = lightness + .3963377774 * axisA + .2158037573 * axisB;
      const mRoot = lightness - .1055613458 * axisA - .0638541728 * axisB;
      const sRoot = lightness - .0894841775 * axisA - 1.291485548 * axisB;
      const l = lRoot ** 3;
      const m = mRoot ** 3;
      const s = sRoot ** 3;
      return [
        4.0767416621 * l - 3.3077115913 * m + .2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s,
        -.0041960863 * l - .7034186147 * m + 1.707614701 * s,
      ].map((channel) => {
        const encoded = channel <= .0031308
          ? 12.92 * channel
          : 1.055 * (Math.max(0, channel) ** (1 / 2.4)) - .055;
        return Math.min(255, Math.max(0, encoded * 255));
      });
    };
    let match = text.match(/^(oklab|oklch)\((.*)\)$/i);
    if (match) {
      const [coordinates = "", alphaToken = "1"] = match[2].split("/").map((part) => part.trim());
      const tokens = coordinates.split(/\s+/).filter(Boolean);
      if (tokens.length >= 3) {
        const lightness = cssNumber(tokens[0], 1);
        let axisA = cssNumber(tokens[1], .4);
        let axisB = cssNumber(tokens[2], .4);
        if (match[1].toLowerCase() === "oklch") {
          const chroma = axisA;
          const hueToken = String(tokens[2] || "0").toLowerCase();
          const hueValue = Number.parseFloat(hueToken) || 0;
          const hueDegrees = hueToken.endsWith("turn") ? hueValue * 360
            : hueToken.endsWith("rad") ? hueValue * 180 / Math.PI
              : hueToken.endsWith("grad") ? hueValue * .9
                : hueValue;
          const radians = hueDegrees * Math.PI / 180;
          axisA = chroma * Math.cos(radians);
          axisB = chroma * Math.sin(radians);
        }
        const alpha = cssNumber(alphaToken, 1);
        if ([lightness, axisA, axisB, alpha].every(Number.isFinite)) {
          return [...oklabToSrgb(lightness, axisA, axisB), Math.min(1, Math.max(0, alpha))];
        }
      }
    }
    match = text.match(/^rgba?\(([^)]+)\)$/i);
    if (match) {
      const parts = match[1].split(/[,\s\/]+/).filter(Boolean).map(Number);
      return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
    }
    // color-mix() resolves to color(srgb …) in getComputedStyle, and a parser
    // that only knows rgb() silently drops that layer and reports the surface
    // underneath it — a light chip on a dark card then looks unreadable.
    match = text.match(/^color\(\s*srgb\s+([^)]+)\)$/i);
    if (match) {
      const parts = match[1].split(/[\s\/]+/).filter(Boolean).map(Number);
      return [parts[0] * 255, parts[1] * 255, parts[2] * 255, parts.length > 3 ? parts[3] : 1];
    }
    match = text.match(/^#([0-9a-f]{3,8})$/i);
    if (match) {
      let hex = match[1];
      if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
        hex.length >= 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
      ];
    }
    return null;
  };
  const over = (top, base) => {
    const alpha = top[3];
    return [
      top[0] * alpha + base[0] * (1 - alpha),
      top[1] * alpha + base[1] * (1 - alpha),
      top[2] * alpha + base[2] * (1 - alpha),
      1,
    ];
  };
  const luminance = (rgb) => {
    const channel = (value) => {
      const v = value / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
  };
  const ratio = (a, b) => {
    const la = luminance(a);
    const lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };
  const splitLayers = (value) => {
    const parts = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < value.length; i += 1) {
      const c = value[i];
      if (c === "(") depth += 1;
      else if (c === ")") depth -= 1;
      else if (c === "," && depth === 0) { parts.push(value.slice(start, i)); start = i + 1; }
    }
    parts.push(value.slice(start));
    return parts.map((part) => part.trim()).filter(Boolean);
  };
  // A background-image layer covers its whole box, so the layer underneath is
  // only reachable when one of the stops is fully transparent. Treating every
  // translucent gradient as "might not cover" invents surfaces that never paint.
  const paintLayers = (style) => {
    const layers = [];
    const base = parseColor(style.backgroundColor);
    if (base && base[3] > 0) layers.push({ stops: [base], allowsBase: false });
    const image = style.backgroundImage;
    if (image && image !== "none") {
      const parts = splitLayers(image);
      for (let i = parts.length - 1; i >= 0; i -= 1) {
        const all = (parts[i].match(/(?:rgba?|color|oklab|oklch)\([^)]*\)/gi) || []).map(parseColor).filter(Boolean);
        if (!all.length) continue;
        const stops = all.filter((stop) => stop[3] > 0);
        if (!stops.length) continue;
        layers.push({ stops, allowsBase: all.some((stop) => stop[3] < 0.05) });
      }
    }
    return layers;
  };
  const surfacesOf = (element) => {
    const stack = [];
    let node = element;
    while (node) {
      const style = getComputedStyle(node);
      stack.push(paintLayers(style));
      // An opaque background-colour is the floor of that element's paint: its
      // own background-image sits on top of it, and nothing below it can show
      // through. Walking past it invents surfaces from ancestors that are not
      // visible at all.
      const base = parseColor(style.backgroundColor);
      if (base && base[3] >= 0.999) break;
      node = node.parentElement;
    }
    let surfaces = [[255, 255, 255, 1]];
    for (let i = stack.length - 1; i >= 0; i -= 1) {
      for (const layer of stack[i]) {
        const next = [];
        for (const base of surfaces) {
          for (const stop of layer.stops) next.push(over(stop, base));
          if (layer.allowsBase) next.push(base);
        }
        const seen = new Set();
        const unique = [];
        for (const surface of next) {
          const key = surface.slice(0, 3).map((v) => Math.round(v / 4)).join(":");
          if (seen.has(key)) continue;
          seen.add(key);
          unique.push(surface);
        }
        surfaces = unique.slice(0, 6);
      }
    }
    return surfaces;
  };
  const describe = (element) => {
    const classes = typeof element.className === "string" && element.className
      ? "." + element.className.trim().split(/\s+/).slice(0, 3).join(".")
      : "";
    const states = [element.matches(":hover") ? ":hover" : "", element.matches(":focus-within") ? ":focus-within" : ""].join("");
    return element.tagName.toLowerCase() + (element.id ? "#" + element.id : "") + classes + states;
  };
  // Which rule actually painted the ink. Not a full cascade resolver: it keeps
  // the last matching declaration, preferring !important ones, which is right
  // for everything except same-priority specificity ties.
  const inkOrigin = (element) => {
    let best = null;
    const walk = (rules, sheet) => {
      for (const rule of rules) {
        if (rule.cssRules && rule.cssRules.length) walk(rule.cssRules, sheet);
        if (!rule.selectorText || !rule.style) continue;
        let matches = false;
        try { matches = element.matches(rule.selectorText); } catch (error) { continue; }
        if (!matches) continue;
        const value = rule.style.getPropertyValue("color") || rule.style.getPropertyValue("-webkit-text-fill-color");
        if (!value) continue;
        const important = rule.style.getPropertyPriority("color") === "important";
        if (best && best.important && !important) continue;
        best = { sheet, selector: rule.selectorText, value, important };
      }
    };
    for (const sheet of document.styleSheets) {
      try { walk(sheet.cssRules, (sheet.href || "inline").split("/").pop().split("?")[0]); } catch (error) { /* cross-origin */ }
    }
    return best;
  };

  // Where the run sits, so a finding can be acted on without a second pass.
  const ancestry = (element) => {
    const parts = [];
    let node = element;
    for (let depth = 0; depth < 7 && node && node !== document.body; depth += 1) {
      parts.push(describe(node));
      node = node.parentElement;
    }
    return parts.join(" < ");
  };

  const effectivelyHidden = (element) => {
    let node = element;
    let opacity = 1;
    while (node && node !== document.documentElement) {
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") return true;
      opacity *= Number.parseFloat(style.opacity || "1");
      if (opacity < 0.05) return true;
      node = node.parentElement;
    }
    return false;
  };

  const findings = [];
  for (const element of document.querySelectorAll("body *")) {
    const style = getComputedStyle(element);
    if (effectivelyHidden(element)) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    let text = "";
    for (const child of element.childNodes) if (child.nodeType === 3) text += child.nodeValue;
    text = text.trim();
    if (!text) continue;
    const painted = style.webkitTextFillColor && style.webkitTextFillColor !== "currentcolor"
      ? style.webkitTextFillColor
      : style.color;
    const ink = parseColor(painted);
    if (!ink) continue;
    let worst = Infinity;
    let worstSurface = null;
    for (const surface of surfacesOf(element)) {
      const resolved = ink[3] < 0.99 ? over(ink, surface) : ink;
      const value = ratio(resolved, surface);
      if (value < worst) { worst = value; worstSurface = surface; }
    }
    if (!worstSurface) continue;
    const size = Number.parseFloat(style.fontSize);
    const bold = Number.parseInt(style.fontWeight, 10) >= 700;
    const floor = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
    if (worst >= floor) continue;
    const origin = inkOrigin(element);
    findings.push({
      origin: origin ? origin.sheet + " · " + origin.selector.slice(0, 90) + (origin.important ? " !important" : "") : "",
      selector: describe(element),
      path: ancestry(element),
      text: text.slice(0, 44),
      ink: painted,
      surface: "rgb(" + worstSurface.slice(0, 3).map((v) => Math.round(v)).join(",") + ")",
      contrast: Math.round(worst * 100) / 100,
      floor,
      fontSize: Math.round(size * 100) / 100,
    });
  }
  return findings;
})()
`;

// "It disappears when I hover it" is the single most reported symptom, and it
// comes from a shape that inverts its ink without inverting its surface. A
// pointer can only hold one shape at a time, so this forces :hover on every
// element at once through the same DevTools mechanism the :hov panel uses —
// the real cascade, not a rewritten copy of it. Hovering a descendant already
// hovers its ancestors, and sibling cards do not read each other's surface, so
// holding them all measures what hovering each in turn would.
async function forceHoverEverywhere(session) {
  await session.send("DOM.enable");
  await session.send("CSS.enable");
  const { root } = await session.send("DOM.getDocument", { depth: 1 });
  const { nodeIds } = await session.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector: "body *" });
  await Promise.all(nodeIds.map((nodeId) => session
    .send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: ["hover"] })
    .catch(() => null)));
  return nodeIds.length;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const binary = findChrome();
  if (!binary) {
    console.log("contrast audit skipped: no Chrome/Edge/Chromium binary found (set CHROME_PATH to run it)");
    return;
  }

  const { server, port: httpPort } = await startServer();
  const url = `http://127.0.0.1:${httpPort}/${args.page}`;
  const chrome = await launchChrome(binary, args.viewport);
  let findings = [];
  try {
    const { session } = await connect(chrome.port, url);
    await session.send("Page.enable");
    await session.send("Runtime.enable");
    await wait(2500);
    // Colour transitions would otherwise be caught mid-flight and report a
    // blend no state actually settles on.
    if (!args.themeCycle) await session.evaluate(`(() => {
      const style = document.createElement("style");
      // :not(#no-such-id) carries an id's specificity without matching one, so
      // this outranks the module rules that re-enable colour transitions with
      // !important longhands.
      style.textContent = "*:not(#audit-no-such-id), *::before, *::after {"
        + " transition-property: none !important; transition-duration: 0s !important;"
        + " animation: none !important; }";
      document.head.appendChild(style);
      return true;
    })()`);
    // Reveal-on-scroll and content-visibility both defer work until a section
    // has been near the viewport, so walk the page before measuring it.
    await session.evaluate(`(async () => {
      const step = 700;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 40));
      }
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 1200));
      // The readability guard walks the sections on an idle queue. Measuring
      // mid-queue reports a page state no reader ever sees, so settle it first.
      window.__applyReadabilityGuard?.(document.body);
      await new Promise((r) => setTimeout(r, 400));
      return document.body.scrollHeight;
    })()`);
    if (args.waitFor) {
      await session.evaluate(`(async () => {
        const selector = ${JSON.stringify(args.waitFor)};
        for (let attempt = 0; attempt < 60 && !document.querySelector(selector); attempt += 1) {
          await new Promise((r) => setTimeout(r, 250));
        }
        // The console hydrates its market modules after the shell mounts, so
        // wait for the node count to stop moving before auditing.
        let previous = -1;
        for (let attempt = 0; attempt < 40; attempt += 1) {
          const count = document.querySelectorAll("#intelligenceConsole *").length;
          if (count === previous) break;
          previous = count;
          await new Promise((r) => setTimeout(r, 250));
        }
        window.__applyReadabilityGuard?.(document.body);
        await new Promise((r) => setTimeout(r, 800));
        return Boolean(document.querySelector(selector));
      })()`);
    }
    if (args.hover) {
      await session.evaluate(`(() => {
        window.__restingPaint = [...document.querySelectorAll("body *")]
          .map((element) => { const s = getComputedStyle(element); return s.backgroundColor + "|" + s.backgroundImage + "|" + s.color; });
        return window.__restingPaint.length;
      })()`);
      const forced = await forceHoverEverywhere(session);
      // An audit that silently failed to engage hover would report a clean
      // page, so state how much of it actually changed.
      const changed = await session.evaluate(`(() => {
        const now = [...document.querySelectorAll("body *")]
          .map((element) => { const s = getComputedStyle(element); return s.backgroundColor + "|" + s.backgroundImage + "|" + s.color; });
        let count = 0;
        for (let i = 0; i < now.length && i < window.__restingPaint.length; i += 1) {
          if (now[i] !== window.__restingPaint[i]) count += 1;
        }
        return count;
      })()`);
      console.log(`  hover forced on ${forced} elements · ${changed} repainted`);
      const guardState = await session.evaluate(`JSON.stringify({ adjusted: document.body.dataset.readabilityAdjusted, errors: document.body.dataset.readabilityErrors, tagged: document.querySelectorAll(".ui-contrast-on-dark,.ui-contrast-on-light").length })`);
      console.log(`  guard after hover: ${guardState}`);
      if (!changed) throw new Error("hover state did not engage — the audit would be meaningless");
      // The guard re-audits a card when the pointer enters it, so the state a
      // reader actually sees while hovering is the audited one.
      await session.evaluate(`(async () => {
        await new Promise((r) => setTimeout(r, 900));
        window.__applyReadabilityGuard?.(document.body);
        await new Promise((r) => setTimeout(r, 700));
      })()`);
    }
    if (args.themeCycle) {
      // Exercise the real transition rather than disabling it: the previous
      // implementation audited only the first animation frame, so dark ink
      // selected for the outgoing light card remained on the settled dark
      // card. Do not call the guard from the audit; this verifies the product's
      // own delayed re-audit contract.
      const beforeTheme = await session.evaluate(`document.documentElement.dataset.theme || ""`);
      const cycled = await session.evaluate(`(() => {
        const button = document.querySelector("#themeBtn");
        if (!button) return false;
        button.click();
        return true;
      })()`);
      if (!cycled) throw new Error("theme cycle audit could not find #themeBtn");
      // A timer resolved inside one Runtime.evaluate call can precede the first
      // post-transition paint. Poll through independent CDP round-trips and
      // require two identical computed signatures before measuring contrast.
      await wait(900);
      let previousSignature = "";
      let stableReads = 0;
      let afterTheme = "";
      for (let attempt = 0; attempt < 20 && stableReads < 2; attempt += 1) {
        const snapshot = JSON.parse(await session.evaluate(`JSON.stringify((() => {
          const nodes = [
            document.documentElement,
            document.querySelector("#intelligenceConsole"),
            document.querySelector(".price-category-cell"),
            document.querySelector(".price-sub"),
          ].filter(Boolean);
          return {
            theme: document.documentElement.dataset.theme || "",
            switching: document.documentElement.classList.contains("ui-theme-switching"),
            signature: nodes.map((node) => {
              const style = getComputedStyle(node);
              return [style.color, style.backgroundColor, style.backgroundImage, style.borderColor].join("|");
            }).join("||"),
          };
        })())`));
        afterTheme = snapshot.theme;
        if (!snapshot.switching && snapshot.signature && snapshot.signature === previousSignature) stableReads += 1;
        else stableReads = 0;
        previousSignature = snapshot.signature;
        if (stableReads < 2) await wait(140);
      }
      if (beforeTheme !== "dark" || afterTheme !== "light" || stableReads < 2) {
        throw new Error(`theme cycle did not settle dark → light (before=${beforeTheme}, after=${afterTheme}, stable=${stableReads})`);
      }
      console.log(`  theme cycle settled: ${beforeTheme} → ${afterTheme}`);
    }
    findings = await session.evaluate(SCANNER);
  } finally {
    try { await fetch(`http://127.0.0.1:${chrome.port}/json/close`); } catch { /* best effort */ }
    chrome.child.kill();
    server.close();
  }

  findings.sort((a, b) => a.contrast - b.contrast);
  const grouped = new Map();
  for (const finding of findings) {
    const key = `${finding.selector}|${finding.ink}|${finding.surface}`;
    if (!grouped.has(key)) grouped.set(key, { ...finding, count: 0 });
    grouped.get(key).count += 1;
  }
  const groups = [...grouped.values()].sort((a, b) => a.contrast - b.contrast);

  console.log(`contrast audit · ${args.page} @ ${args.viewport}`);
  console.log(`  unreadable runs: ${findings.length} (${groups.length} distinct)`);
  for (const group of groups.slice(0, 40)) {
    console.log(
      `  ${String(group.contrast).padStart(6)}:1  floor ${group.floor}  x${group.count}  ${group.selector}`
      + `\n           ink ${group.ink} on ${group.surface} — ${JSON.stringify(group.text)}`
      + (group.origin ? `\n           from ${group.origin}` : "")
      + (group.path ? `\n           at   ${group.path}` : ""),
    );
  }
  if (groups.length > 40) console.log(`  … ${groups.length - 40} more groups not listed`);

  if (args.json) {
    fs.writeFileSync(args.json, `${JSON.stringify({ page: args.page, viewport: args.viewport, findings }, null, 2)}\n`);
    console.log(`  written: ${args.json}`);
  }

  const max = Number.isFinite(args.max) ? args.max : 0;
  if (findings.length > max) {
    console.error(`contrast audit failed: ${findings.length} unreadable runs (allowed ${max})`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
