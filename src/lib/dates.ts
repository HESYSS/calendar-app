export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function toDateKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function fromDateKey(key: string) {
  const [y, m, d] = key.split("-").map((x) => Number(x));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function isDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

// weekStart: 0=Sun, 1=Mon
export function getCalendarRange(month: Date, weekStart: 0 | 1 = 1) {
  const first = startOfMonth(month);
  const last = endOfMonth(month);

  const firstDow = first.getDay(); // 0..6 (Sun..Sat)
  const leading = (firstDow - weekStart + 7) % 7;
  const gridStart = addDays(first, -leading);

  const lastDow = last.getDay();
  const trailing = (6 - ((lastDow - weekStart + 7) % 7) + 7) % 7;
  const gridEnd = addDays(last, trailing);

  return { gridStart, gridEnd };
}

export function daysBetweenInclusive(start: Date, end: Date) {
  const out: Date[] = [];
  let cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endKey = toDateKey(end);
  while (toDateKey(cur) <= endKey) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

