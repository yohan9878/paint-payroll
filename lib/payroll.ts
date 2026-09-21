import { db, type AttendanceRecord, type DayType, type Employee, type NightType, type WorkPlace } from "./db";
import { toDateStr, weekDays } from "./date";

// Day-shift pay. Saturday is treated the same as any other day now (no
// automatic halving) — whatever the manager marks (Full/Half/Absent) is
// what's paid for that day.
export function amountForDay(dayType: DayType, dailyRate: number): number {
  switch (dayType) {
    case "FULL":
      return dailyRate;
    case "HALF":
      return dailyRate / 2;
    case "ABSENT":
    default:
      return 0;
  }
}

// Night shift pays ON TOP of whatever the day-shift paid, and is available on
// any working day (Mon-Sat), possibly at a DIFFERENT site than the day shift.
// HALF (evening) = half a day's rate. FULL (worked until midnight) = a full
// day's rate, since it's substantially more hours than the half-night shift.
export function nightShiftPay(nightType: NightType | undefined, dailyRate: number): number {
  switch (nightType) {
    case "HALF":
      return dailyRate / 2;
    case "FULL":
      return dailyRate;
    case "NONE":
    default:
      return 0;
  }
}

export interface EmployeeWeekSummary {
  employee: Employee;
  fullDays: number;
  halfDays: number;
  absentDays: number;
  nightHalfDays: number;
  nightFullDays: number;
  nightShiftAmount: number;
  totalAmount: number;
  records: AttendanceRecord[];
}

// Computes what payroll WOULD be for a given employee + week, straight from
// attendance records (used both for the live preview and for locking a PayrollRun).
export async function computeEmployeeWeek(
  employee: Employee,
  weekSaturday: Date
): Promise<EmployeeWeekSummary> {
  const days = weekDays(weekSaturday);
  const dateStrs = days.map(toDateStr);

  const records = await db.attendance
    .where("employeeId")
    .equals(employee.id!)
    .filter((r) => dateStrs.includes(r.date))
    .toArray();

  let fullDays = 0;
  let halfDays = 0;
  let absentDays = 0;
  let nightHalfDays = 0;
  let nightFullDays = 0;
  let nightShiftAmount = 0;
  let totalAmount = 0;

  for (const dateStr of dateStrs) {
    const rec = records.find((r) => r.date === dateStr);
    const dayType: DayType = rec ? rec.dayType : "ABSENT";
    if (dayType === "FULL") fullDays++;
    else if (dayType === "HALF") halfDays++;
    else absentDays++;
    totalAmount += amountForDay(dayType, employee.dailyRate);

    const nightType = rec?.nightType ?? "NONE";
    if (nightType !== "NONE") {
      if (nightType === "FULL") nightFullDays++;
      else nightHalfDays++;
      const pay = nightShiftPay(nightType, employee.dailyRate);
      nightShiftAmount += pay;
      totalAmount += pay;
    }
  }

  return {
    employee,
    fullDays,
    halfDays,
    absentDays,
    nightHalfDays,
    nightFullDays,
    nightShiftAmount,
    totalAmount,
    records,
  };
}

// ---- Site cost breakdown (day-shift and night-shift may be at DIFFERENT
// sites for the same attendance record, so each is attributed separately) ----

export interface SiteTotal {
  siteId: number;
  siteName: string;
  fullDays: number;
  halfDays: number;
  nightHalfDays: number;
  nightFullDays: number;
  total: number;
}

function siteNameLookup(workplaces: WorkPlace[]): Map<number, string> {
  return new Map(workplaces.map((w) => [w.id!, w.name]));
}

// Core aggregator: given (record, rate) pairs, attribute day-shift pay to
// daySiteId and night-shift pay to nightSiteId (falling back to daySiteId if
// a night shift somehow has no site of its own — e.g. legacy data).
export function siteTotalsFromRecords(
  entries: { record: AttendanceRecord; dailyRate: number }[],
  workplaces: WorkPlace[]
): SiteTotal[] {
  const names = siteNameLookup(workplaces);
  const bySite = new Map<number, SiteTotal>();

  function ensure(id: number): SiteTotal {
    let s = bySite.get(id);
    if (!s) {
      s = {
        siteId: id,
        siteName: names.get(id) ?? "Unknown site",
        fullDays: 0,
        halfDays: 0,
        nightHalfDays: 0,
        nightFullDays: 0,
        total: 0,
      };
      bySite.set(id, s);
    }
    return s;
  }

  for (const { record: rec, dailyRate } of entries) {
    if (rec.dayType !== "ABSENT" && rec.daySiteId) {
      const s = ensure(rec.daySiteId);
      if (rec.dayType === "FULL") s.fullDays++;
      else s.halfDays++;
      s.total += amountForDay(rec.dayType, dailyRate);
    }
    const nightType = rec.nightType ?? "NONE";
    if (nightType !== "NONE") {
      const nightSiteId = rec.nightSiteId ?? rec.daySiteId;
      if (nightSiteId) {
        const s = ensure(nightSiteId);
        if (nightType === "FULL") s.nightFullDays++;
        else s.nightHalfDays++;
        s.total += nightShiftPay(nightType, dailyRate);
      }
    }
  }

  return Array.from(bySite.values()).sort((a, b) => b.total - a.total);
}

// Convenience wrapper for the live preview, where we already have each
// employee's EmployeeWeekSummary (with .records) in memory — no extra DB hit.
export function siteTotalsFromSummaries(summaries: EmployeeWeekSummary[], workplaces: WorkPlace[]): SiteTotal[] {
  const entries = summaries.flatMap((s) => s.records.map((record) => ({ record, dailyRate: s.employee.dailyRate })));
  return siteTotalsFromRecords(entries, workplaces);
}
