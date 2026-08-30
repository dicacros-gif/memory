/**
 * The calculator's account examples carry the figure each account has actually
 * announced. Those figures move — a capex guidance is revised, a programme
 * slips a quarter — so the note is regenerated from the capital plan layer the
 * crawl already maintains instead of being retyped into the frame model.
 *
 * The scenario inputs stay authored: they are assumptions, and inventing them
 * from a crawl would be the opposite of what this site promises. Only the
 * evidence line is derived.
 */
import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));

const capital = await read("data/capital-plans.json");
const frames = await read("data/mbb-frames.json");

// Bullet form, no sentence endings: the renderer rewrites prose, and frame copy
// has to survive that untouched (test-frame-copy-stability).
const bullet = (value = "") => String(value)
  .replace(/\s+/g, " ")
  .replace(/[.。]\s*$/u, "")
  .trim();

const firstClause = (value = "", limit = 96) => {
  const text = bullet(value);
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const boundary = Math.max(cut.lastIndexOf(" · "), cut.lastIndexOf(" "));
  return boundary > 40 ? cut.slice(0, boundary) : cut;
};

const evidenceFor = (id) => {
  const plan = capital.plans?.[id];
  if (!plan) return "";
  const parts = [plan.capex, plan.plan].map((value) => firstClause(value)).filter(Boolean);
  if (!parts.length) return "";
  // An account that has published a quantity has evidence behind the line.
  // An account that has only said where it plays has a position. Both are
  // public and only one is checkable, so they are not called the same thing.
  return `${publicFigure(id) ? "공개 근거" : "공개 포지션"} · ${parts.join(" · ")}`;
};

let frame = null;
const walk = (node) => {
  if (Array.isArray(node)) return node.forEach(walk);
  if (node && typeof node === "object") {
    if (!frame && Array.isArray(node.presets) && Array.isArray(node.inputs)) frame = node;
    Object.values(node).forEach(walk);
  }
};
walk(frames);

if (!frame) {
  console.log(JSON.stringify({ script: "refresh-calculator-examples", updated: 0, reason: "calculator frame not found" }));
  process.exit(0);
}

// One account belongs to one role band. The calculator used to mix cloud
// platforms, model builders, OEMs and ODMs in a single group; this registry is
// now the canonical MECE ordering. Per-account planning ratios also keep fleet
// CapEx and memory allocation from falling back to the same generic numbers.
const PRESET_CONFIGS = [
  { label: "Microsoft · Azure", aliases: ["Microsoft · Azure · 계산 예시"], id: "microsoft", group: "01 · 클라우드 플랫폼", capexPerRack: .37, memoryShare: 38, winShare: 35, hbmShare: 38, hbm4eShare: 20 },
  { label: "Google · TPU", id: "google", group: "01 · 클라우드 플랫폼", capexPerRack: .32, memoryShare: 36, winShare: 30, hbmShare: 30, hbm4eShare: 20 },
  { label: "AWS · Trainium", id: "aws", group: "01 · 클라우드 플랫폼", capexPerRack: .31, memoryShare: 34, winShare: 30, hbmShare: 32, hbm4eShare: 25 },
  { label: "Oracle · Stargate", id: "oracle", group: "01 · 클라우드 플랫폼", capexPerRack: .36, memoryShare: 40, winShare: 32, hbmShare: 35, hbm4eShare: 35 },
  { label: "Meta · MTIA", id: "meta", group: "02 · AI 모델·자체 가속기", capexPerRack: .35, memoryShare: 42, winShare: 36, hbmShare: 40, hbm4eShare: 25 },
  { label: "OpenAI · 자체 가속기", id: "openai", group: "02 · AI 모델·자체 가속기", capexPerRack: .42, memoryShare: 46, winShare: 38, hbmShare: 36, hbm4eShare: 35 },
  { label: "Anthropic · 멀티플랫폼", id: "anthropic", aliases: ["Anthropic · 인프라 전환"], group: "02 · AI 모델·자체 가속기", capexPerRack: .38, memoryShare: 48, winShare: 35, hbmShare: 42, hbm4eShare: 30 },
  { label: "xAI · Colossus", id: "spacexai", group: "02 · AI 모델·자체 가속기", capexPerRack: .40, memoryShare: 44, winShare: 36, hbmShare: 40, hbm4eShare: 40 },
  { label: "Dell · PowerEdge XE", id: "dell", group: "03 · 서버 OEM", capexPerRack: .33, memoryShare: 40, winShare: 30, hbmShare: 34, hbm4eShare: 30 },
  { label: "HPE · Cray XD", id: "hpe", group: "03 · 서버 OEM", capexPerRack: .31, memoryShare: 38, winShare: 28, hbmShare: 30, hbm4eShare: 25 },
  { label: "Lenovo · ThinkSystem SR", id: "lenovo", group: "03 · 서버 OEM", capexPerRack: .30, memoryShare: 36, winShare: 26, hbmShare: 28, hbm4eShare: 25 },
  { label: "Supermicro · NVL72", id: "supermicro", group: "03 · 서버 OEM", capexPerRack: .32, memoryShare: 42, winShare: 30, hbmShare: 32, hbm4eShare: 35 },
  { label: "Cisco · UCS", id: "cisco", group: "03 · 서버 OEM", capexPerRack: .30, memoryShare: 34, winShare: 24, hbmShare: 26, hbm4eShare: 20 },
  { label: "Fujitsu", id: "fujitsu", group: "03 · 서버 OEM", capexPerRack: .28, memoryShare: 34, winShare: 24, hbmShare: 25, hbm4eShare: 20 },
  { label: "Quanta · QCT", id: "quanta-qct", group: "04 · 랙 ODM", capexPerRack: .27, memoryShare: 38, winShare: 28, hbmShare: 30, hbm4eShare: 30 },
  { label: "Wiwynn", id: "wiwynn", group: "04 · 랙 ODM", capexPerRack: .27, memoryShare: 38, winShare: 27, hbmShare: 29, hbm4eShare: 30 },
  { label: "Foxconn", id: "foxconn", group: "04 · 랙 ODM", capexPerRack: .26, memoryShare: 40, winShare: 29, hbmShare: 31, hbm4eShare: 35 },
  { label: "Inventec", id: "inventec", group: "04 · 랙 ODM", capexPerRack: .26, memoryShare: 36, winShare: 25, hbmShare: 27, hbm4eShare: 25 },
  { label: "GIGABYTE", id: "gigabyte", group: "04 · 랙 ODM", capexPerRack: .28, memoryShare: 34, winShare: 22, hbmShare: 24, hbm4eShare: 20 },
  { label: "ASUS · ESC", id: "asus", group: "04 · 랙 ODM", capexPerRack: .28, memoryShare: 34, winShare: 22, hbmShare: 24, hbm4eShare: 20 },
  { label: "CoreWeave · Neo-cloud", group: "05 · 네오클라우드", capexPerRack: .37, memoryShare: 44, winShare: 34, hbmShare: 36, hbm4eShare: 35 },
  { label: "Nebius · Neo-cloud", group: "05 · 네오클라우드", capexPerRack: .35, memoryShare: 42, winShare: 30, hbmShare: 32, hbm4eShare: 30 },
  { label: "HUMAIN · 사우디", group: "06 · 국가 AI 인프라", capexPerRack: .40, memoryShare: 40, winShare: 28, hbmShare: 30, hbm4eShare: 25 },
  { label: "G42 · UAE", group: "06 · 국가 AI 인프라", capexPerRack: .39, memoryShare: 40, winShare: 27, hbmShare: 29, hbm4eShare: 25 },
  { label: "EuroHPC · 유럽", group: "06 · 국가 AI 인프라", capexPerRack: .36, memoryShare: 36, winShare: 24, hbmShare: 26, hbm4eShare: 20 },
  { label: "CDAC · 인도", group: "06 · 국가 AI 인프라", capexPerRack: .30, memoryShare: 34, winShare: 22, hbmShare: 24, hbm4eShare: 15 },
  { label: "국가 AI 컴퓨트 · 한국·일본", group: "06 · 국가 AI 인프라", capexPerRack: .34, memoryShare: 38, winShare: 26, hbmShare: 28, hbm4eShare: 20 },
];

const configFor = (label) => PRESET_CONFIGS.find((config) => config.label === label || config.aliases?.includes(label));
const WORKLOAD_BY_GROUP = {
  "03 · 서버 OEM": { tokensPerQuery: 1400, costPerMillionTokens: 3.8, tieringSavingPercent: 12, systemCostMillions: 5.5, bandwidthTBPerSecond: 10, capacityTB: 30 },
  "04 · 랙 ODM": { tokensPerQuery: 1800, costPerMillionTokens: 2.9, tieringSavingPercent: 13, systemCostMillions: 5, bandwidthTBPerSecond: 9, capacityTB: 28 },
  "05 · 네오클라우드": { tokensPerQuery: 2200, costPerMillionTokens: 3.4, tieringSavingPercent: 16, systemCostMillions: 6, bandwidthTBPerSecond: 11, capacityTB: 32 },
  "06 · 국가 AI 인프라": { tokensPerQuery: 1600, costPerMillionTokens: 3.8, tieringSavingPercent: 12, systemCostMillions: 5.5, bandwidthTBPerSecond: 9, capacityTB: 30 },
};

// A public example has to be checkable: a quantity the account itself stated,
// and a date that quantity is true as of. An account with only a positioning
// line — "TIER 2 ODM · 캐파 배정과 물량 약정이 진입 시점" — has neither, and its
// scenario inputs are ours, not theirs. Those stay off the public board.
// A digit is not a quantity: "Trainium4" and "Colossus 1" are names and
// "2027년" is a date. The unit is what makes a number one a reader can check,
// so the figure has to carry one — and the account has to say when it holds.
const FIGURE_RE = /\d[\d,.]*\s*(?:억|조|만|%|\$|USD|GW|MW|kW|EB|PB|TB|GB|칩|nm|W\b)/;
const DATE_RE = /(?:19|20)\d{2}[-.\/년]|FY\d{2}|Q[1-4]/;
const publicFigure = (id) => {
  const plan = capital.plans?.[id];
  if (!plan) return false;
  const stated = `${plan.capex || ""} ${plan.plan || ""}`;
  if (!FIGURE_RE.test(stated)) return false;
  return Boolean(plan.asOf) || DATE_RE.test(stated);
};

let updated = 0;
for (const preset of frame.presets) {
  const config = configFor(preset.label);
  const id = config?.id;
  if (config) {
    const groupDefaults = WORKLOAD_BY_GROUP[config.group] || {};
    const rackCount = Number(preset.values?.rackCount || 0);
    const accountValues = {
      ...groupDefaults,
      incrementalCapexMillions: Math.round((rackCount * config.capexPerRack) / 5) * 5,
      memoryShareOfSavingPercent: config.memoryShare,
      targetWinSharePercent: config.winShare,
      hbmSharePercent: config.hbmShare,
      hbm4eSharePercent: config.hbm4eShare,
    };
    if (preset.label !== config.label) {
      preset.label = config.label;
      updated += 1;
    }
    if (preset.group !== config.group) {
      preset.group = config.group;
      updated += 1;
    }
    if (id && preset.accountId !== id) {
      preset.accountId = id;
      updated += 1;
    }
    for (const [name, value] of Object.entries(accountValues)) {
      if (preset.values?.[name] === value) continue;
      preset.values[name] = value;
      updated += 1;
    }
  }
  const isPublic = Boolean(id) && publicFigure(id);
  if (Boolean(preset.public) !== isPublic) {
    if (isPublic) preset.public = true;
    else delete preset.public;
    updated += 1;
  }
  if (!id) continue;
  const note = evidenceFor(id);
  if (!note || note === preset.note) continue;
  preset.note = note;
  updated += 1;
}

const presetOrder = new Map(PRESET_CONFIGS.map((config, index) => [config.label, index]));
const beforeOrder = frame.presets.map((preset) => preset.label).join("|");
frame.presets.sort((a, b) => (presetOrder.get(a.label) ?? 999) - (presetOrder.get(b.label) ?? 999));
if (frame.presets.map((preset) => preset.label).join("|") !== beforeOrder) updated += 1;

const presetsNote = "계정별 워크로드·배포·메모리 계획 가정 · 회사 발표 실적·계약과 분리";
if (frame.presetsNote !== presetsNote) {
  frame.presetsNote = presetsNote;
  updated += 1;
}

if (updated) await writeFile(new URL("data/mbb-frames.json", root), `${JSON.stringify(frames, null, 2)}\n`);
console.log(JSON.stringify({ script: "refresh-calculator-examples", updated, examples: frame.presets.length }));
