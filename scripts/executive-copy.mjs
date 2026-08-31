import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function executiveBulletCopy(value = "") {
  return String(value ?? "")
    .replace(/할 수 없습니다(?=[.!?。]|\s*$)/g, "불가")
    .replace(/할 수 있습니다(?=[.!?。]|\s*$)/g, "가능")
    .replace(/해야 합니다(?=[.!?。]|\s*$)/g, "필요")
    .replace(/필요가 있습니다(?=[.!?。]|\s*$)/g, "필요")
    .replace(/가능성이 (?:큽니다|높습니다)(?=[.!?。]|\s*$)/g, "가능성 높음")
    .replace(/가능성이 낮습니다(?=[.!?。]|\s*$)/g, "가능성 낮음")
    .replace(/아닙니다(?=[.!?。]|\s*$)/g, "아님")
    .replace(/봅니다(?=[.!?。]|\s*$)/g, "판단")
    .replace(/([가-힣]+)납니다(?=[.!?。]|\s*$)/g, "$1남")
    .replace(/([가-힣]+)줍니다(?=[.!?。]|\s*$)/g, "$1줌")
    .replace(/([가-힣]+)둡니다(?=[.!?。]|\s*$)/g, "$1둠")
    // Dropping the ending outright assumes the stem is a noun. It is for
    // 증가했습니다 → 증가, but not for 변했습니다, which became a bare "변" and
    // read as a sentence cut off mid-word — which is exactly how it looked on
    // the NAND card. Two syllables or more keep the noun form; a single
    // syllable keeps the verb and only drops the politeness.
    .replace(/([가-힣]{2,})되었습니다(?=[.!?。]|\s*$)/g, "$1")
    .replace(/([가-힣])되었습니다(?=[.!?。]|\s*$)/g, "$1되었음")
    .replace(/([가-힣]{2,})했습니다(?=[.!?。]|\s*$)/g, "$1")
    .replace(/([가-힣])했습니다(?=[.!?。]|\s*$)/g, "$1했음")
    .replace(/([가-힣]{2,})됐습니다(?=[.!?。]|\s*$)/g, "$1")
    .replace(/([가-힣])됐습니다(?=[.!?。]|\s*$)/g, "$1됐음")
    .replace(/([가-힣]+)았습니다(?=[.!?。]|\s*$)/g, "$1았음")
    .replace(/([가-힣]+)었습니다(?=[.!?。]|\s*$)/g, "$1었음")
    .replace(/([가-힣]+)였습니다(?=[.!?。]|\s*$)/g, "$1였음")
    .replace(/([가-힣]+)입니다(?=[.!?。]|\s*$)/g, "$1")
    .replace(/([가-힣]+)합니다(?=[.!?。]|\s*$)/g, "$1")
    .replace(/([가-힣]+)됩니다(?=[.!?。]|\s*$)/g, "$1")
    .replace(/([가-힣]+)집니다(?=[.!?。]|\s*$)/g, "$1짐")
    .replace(/([가-힣]+)립니다(?=[.!?。]|\s*$)/g, "$1림")
    .replace(/([가-힣]+)듭니다(?=[.!?。]|\s*$)/g, "$1듦")
    .replace(/([가-힣]+)봅니다(?=[.!?。]|\s*$)/g, "$1 판단")
    .replace(/([가-힣]+)습니다(?=[.!?。]|\s*$)/g, "$1음")
    .replace(/입니다(?=[.!?。]|\s*$)/g, "")
    .replace(/합니다(?=[.!?。]|\s*$)/g, "")
    .replace(/됩니다(?=[.!?。]|\s*$)/g, "됨")
    .replace(/습니다(?=[.!?。]|\s*$)/g, "음")
    .replace(/([가-힣]+)니다(?=[.!?。]|\s*$)/g, "$1")
    .replace(/([가-힣]+)였다(?=[.!?。]|\s*$)/g, "$1")
    .replace(/([가-힣]+)했다(?=[.!?。]|\s*$)/g, "$1")
    .replace(/([가-힣]+)됐다(?=[.!?。]|\s*$)/g, "$1")
    .replace(/([가-힣]+)이다(?=[.!?。]|\s*$)/g, "$1")
    .replace(/([가-힣]+)있다(?=[.!?。]|\s*$)/g, "$1있음")
    .replace(/([가-힣]+)없다(?=[.!?。]|\s*$)/g, "$1없음")
    .replace(/([가-힣]{2,})한다(?=[.!?。]|\s*$)/g, "$1")
    .replace(/([가-힣])한다(?=[.!?。]|\s*$)/g, "$1함")
    .replace(/([가-힣]{2,})된다(?=[.!?。]|\s*$)/g, "$1")
    .replace(/([가-힣])된다(?=[.!?。]|\s*$)/g, "$1됨")
    .replace(/([가-힣]{2,})하다(?=[.!?。]|\s*$)/g, "$1")
    .replace(/([가-힣])하다(?=[.!?。]|\s*$)/g, "$1함")
    // The attached forms above need a Hangul character immediately before them,
    // so "불만이 있다!" slipped past every rule and only the old catch-all caught
    // it — by cutting it to "있!". These take the space.
    .replace(/있다(?=[.!?。]|\s*$)/g, "있음")
    .replace(/없다(?=[.!?。]|\s*$)/g, "없음")
    // The bare-다 catch-all converts now instead of truncating. A plain
    // declarative is built on the verb stem — 사+ㄴ다 = 산다, 팔리+ㄴ다 = 팔린다 —
    // and its nominal form swaps that ㄴ for ㅁ: 삼, 팔림. Dropping the 다 left
    // "산" and "팔린", the same mid-word cut the 변했습니다 note above describes,
    // arriving by a different route. 먹는다 takes 음 the same way.
    //
    // The catch-all has to convert rather than be removed: it is what holds
    // machine-sourced copy to the house ending, where no author will reword it.
    .replace(/([가-힣])는다(?=[.!?。]|\s*$)/g, "$1음")
    .replace(/([가-힣])다(?=[.!?。]|\s*$)/g, (match, syllable) => {
      const index = syllable.charCodeAt(0) - 0xac00;
      if (index < 0 || index > 11171) return match;
      // Jongseong 4 is ㄴ and 16 is ㅁ. Other closed syllables keep their stem
      // and take 음 (좋다 → 좋음, 올랐다 → 올랐음); open syllables take ㅁ
      // (크다 → 큼, 가다 → 감). This final path is required for machine-
      // translated headlines whose endings are not covered by the polite forms.
      const jongseong = index % 28;
      if (jongseong === 4) return String.fromCharCode(0xac00 + index - 4 + 16);
      if (jongseong === 0) return String.fromCharCode(0xac00 + index + 16);
      return `${syllable}음`;
    })
    .replace(/([A-Za-z\u3131-\u318e\uac00-\ud7a3\d%)\]"'”’])[.。]+\s+(?=[A-Za-z\u3131-\u318e\uac00-\ud7a3\d])/g, "$1 · ")
    .replace(/([A-Za-z\u3131-\u318e\uac00-\ud7a3\d%)\]"'”’])[.。]+(?=\s*$)/g, "$1")
    .replace(/\s*·\s*·\s*/g, " · ");
}

export function normalizeHtmlExecutiveCopy(markup = "") {
  const blocks = [];
  const masked = String(markup).replace(/<(script|style|code|pre|textarea|option)\b[\s\S]*?<\/\1>/gi, (block) => {
    const token = `\u0000EXECUTIVE_COPY_BLOCK_${blocks.length}\u0000`;
    blocks.push(block);
    return token;
  });
  const normalized = masked.replace(/>([^<>]+)</g, (match, text) => `>${executiveBulletCopy(text)}<`);
  return normalized.replace(/\u0000EXECUTIVE_COPY_BLOCK_(\d+)\u0000/g, (_, index) => blocks[Number(index)] || "");
}

if (process.argv.includes("--write-index")) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const file = resolve(root, "index.html");
  const current = readFileSync(file, "utf8");
  const normalized = normalizeHtmlExecutiveCopy(current);
  if (normalized !== current) writeFileSync(file, normalized, "utf8");
}
