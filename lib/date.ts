// All dates are handled as local-time YYYY-MM-DD strings to avoid timezone bugs.

export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromDateStr(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayStr(): string {
  return toDateStr(new Date());
}

// Given any date, return the Saturday that ends its work week (Mon-Sat).
// If the date IS a Saturday, returns that same date.
export function weekEndingSaturday(d: Date): Date {
  const day = d.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
  const diffToSaturday = (6 - day + 7) % 7;
  const sat = new Date(d);
  sat.setDate(d.getDate() + diffToSaturday);
  return sat;
}

// Returns { start: Monday, end: Saturday } for the week that ends on the given Saturday.
export function weekRangeFromSaturday(saturday: Date): { start: Date; end: Date } {
  const end = new Date(saturday);
  const start = new Date(saturday);
  start.setDate(saturday.getDate() - 5);
  return { start, end };
}

// All 6 working days (Mon..Sat) for a week, given its Saturday end date.
export function weekDays(saturday: Date): Date[] {
  const { start } = weekRangeFromSaturday(saturday);
  const days: Date[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

export function formatNice(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function isSaturday(d: Date): boolean {
  return d.getDay() === 6;
}
