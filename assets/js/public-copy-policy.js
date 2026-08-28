const clean = (value) => typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";

export function neutralizePublicBrand(value) {
  return clean(value)
    .replace(/근거\s*원문/gu, "원문")
    .replace(/SK\s*하이닉스/giu, "Memory Business")
    .replace(/\bSK\s+HYNIX\b/giu, "Memory Business")
    .replace(/\bSKHY\b/giu, "Memory Business")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatPublicDate(value) {
  const raw = clean(value);
  const match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/)
    || raw.match(/^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?$/);
  if (!match) return "";

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() + 1 !== month || calendar.getUTCDate() !== day) return "";
  return `${month}/${String(day).padStart(2, "0")}`;
}

export function sourceLabel(dateValue) {
  const date = formatPublicDate(dateValue);
  return date || "출처";
}

export function consultingBullet(value) {
  const copy = neutralizePublicBrand(value);
  if (!copy) return "";

  const normalizeClause = (clause) => clause
    .replace(/[.!?。]+$/u, "")
    .trim()
    .replace(/해야\s*(?:합니다|한다)$/u, " 필요")
    .replace(/이어야\s*(?:합니다|한다)$/u, " 필수")
    .replace(/될\s*수\s*(?:있습니다|있다)$/u, " 가능")
    .replace(/필요(?:합니다|하다)$/u, "필요")
    .replace(/가능(?:합니다|하다)$/u, "가능")
    .replace(/중요(?:합니다|하다)$/u, "중요")
    .replace(/([가-힣]+)합니다$/u, "$1")
    .replace(/([가-힣]+)됩니다$/u, "$1됨")
    .replace(/([가-힣]+)있습니다$/u, "$1있음")
    .replace(/([가-힣]+)없습니다$/u, "$1없음")
    .replace(/([가-힣]+)한다$/u, "$1")
    .replace(/([가-힣]+)된다$/u, "$1됨")
    .replace(/([가-힣]+)있다$/u, "$1 있음")
    .replace(/([가-힣]+)없다$/u, "$1 없음")
    .replace(/([가-힣]+)아니다$/u, "$1 아님")
    .replace(/기다린다$/u, "보류")
    .replace(/할\s*것인가$/u, "대상")
    .replace(/가능한가$/u, "가능성")
    .replace(/인가$/u, " 여부")
    .replace(/는가$/u, " 여부")
    .replace(/은가$/u, " 여부")
    .trim();

  return copy
    .split(/\.\s+|[!?。]+\s*/u)
    .map(normalizeClause)
    .filter(Boolean)
    .join(" · ");
}
