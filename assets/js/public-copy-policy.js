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

const publicTemporalParts = (value) => {
  const raw = clean(value);
  const dayMatch = raw.match(/^((?:19|20)\d{2})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/)
    || raw.match(/^((?:19|20)\d{2})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?$/)
    || raw.match(/^((?:19|20)\d{2})년\s*(\d{1,2})월\s*(\d{1,2})일$/);
  if (dayMatch) {
    const year = Number(dayMatch[1]);
    const month = Number(dayMatch[2]);
    const day = Number(dayMatch[3]);
    const calendar = new Date(Date.UTC(year, month - 1, day));
    if (calendar.getUTCFullYear() === year
      && calendar.getUTCMonth() + 1 === month
      && calendar.getUTCDate() === day) return { precision: "day", year, month, day };
    return null;
  }

  const monthMatch = raw.match(/^((?:19|20)\d{2})-(\d{1,2})$/)
    || raw.match(/^((?:19|20)\d{2})\.\s*(\d{1,2})\.?$/)
    || raw.match(/^((?:19|20)\d{2})년\s*(\d{1,2})월$/);
  if (!monthMatch) return null;
  const year = Number(monthMatch[1]);
  const month = Number(monthMatch[2]);
  return month >= 1 && month <= 12 ? { precision: "month", year, month } : null;
};

export function formatPublicDate(value) {
  const temporal = publicTemporalParts(value);
  if (!temporal) return "";
  if (temporal.precision === "month") return `'${String(temporal.year).slice(-2)}.${temporal.month}월`;
  return `${temporal.month}/${temporal.day}`;
}

export function formatPublicTemporalCopy(value) {
  const formatMatch = (match, year, month, day = "") => (
    formatPublicDate(day ? `${year}-${month}-${day}` : `${year}-${month}`) || match
  );
  return String(value ?? "")
    .replace(/\b((?:19|20)\d{2})년\s*(1[0-2]|0?[1-9])월\s*(3[01]|[12]\d|0?[1-9])일(?!\d)/g, formatMatch)
    .replace(/\b((?:19|20)\d{2})-(1[0-2]|0?[1-9])-(3[01]|[12]\d|0?[1-9])\b/g, formatMatch)
    .replace(/\b((?:19|20)\d{2})\.\s*(1[0-2]|0?[1-9])\.\s*(3[01]|[12]\d|0?[1-9])\.?(?!\d)/g, formatMatch)
    .replace(/\b((?:19|20)\d{2})년\s*(1[0-2]|0?[1-9])월(?!\s*(?:3[01]|[12]\d|0?[1-9])일)/g, (match, year, month) => formatMatch(match, year, month))
    .replace(/\b((?:19|20)\d{2})-(1[0-2]|0?[1-9])\b(?!-\d)/g, (match, year, month) => formatMatch(match, year, month))
    .replace(/\b((?:19|20)\d{2})\.\s*(1[0-2]|0?[1-9])(?!\s*\.\s*\d)(?!\s*[%A-Za-z\d])/g, (match, year, month) => formatMatch(match, year, month));
}

export function sourceLabel(dateValue) {
  const date = formatPublicDate(dateValue);
  return date || "출처";
}

export function consultingBullet(value) {
  const copy = formatPublicTemporalCopy(neutralizePublicBrand(value));
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
