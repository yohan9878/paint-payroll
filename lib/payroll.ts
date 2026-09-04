import { db, type AttendanceRecord, type DayType, type Employee, type WorkPlace } from "./db";
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

// Night shift pays a flat half day's rate, on top of whatever the day-shift
// paid, and is available on any working day (Mon-Sat).
export function nightShiftPay(nightShift: boolean | undefined, dailyRate: number): number {
  return nightShift ? dailyRate / 2 : 0;
}

export interface EmployeeWeekSummary {
  employee: Employee;
  fullDays: number;
  halfDays: number;
  absentDays: number;
  nightShiftDays: number;
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
  let nightShiftDays = 0;
  let nightShiftAmount = 0;
  let totalAmount = 0;

  for (const dateStr of dateStrs) {
    const rec = records.find((r) => r.date === dateStr);
    const dayType: DayType = rec ? rec.dayType : "ABSENT";
    if (dayType === "FULL") fullDays++;
    else if (dayType === "HALF") halfDays++;
    else absentDays++;
    totalAmount += amountForDay(dayType, employee.dailyRate);

    if (rec?.nightShift) {
      nightShiftDays++;
      const pay = nightShiftPay(true, employee.dailyRate);
      nightShiftAmount += pay;
      totalAmount += pay;
    }
  }

  return {
    employee,
    fullDays,
    halfDays,
    absentDays,
    nightShiftDays,
    nightShiftAmount,
    totalAmount,
    records,
  };
}

export interface SiteTotal {
  siteId: number;
  siteName: string;
  total: number;
}

// Categorizes a week's pay by work site — each attendance record's pay
// (day-shift + night-shift) is credited to whichever site it was actually
// worked at that day, so an employee who split their week across sites
// contributes to each site's total correctly.
export function siteTotalsFromSummaries(
  summaries: EmployeeWeekSummary[],
  workplaces: WorkPlace[]
): SiteTotal[] {
  const totals = new Map<number, number>();

  for (const s of summaries) {
    for (const rec of s.records) {
      const amount = amountForDay(rec.dayType, s.employee.dailyRate) + nightShiftPay(rec.nightShift, s.employee.dailyRate);
      if (amount <= 0) continue;
      totals.set(rec.workPlaceId, (totals.get(rec.workPlaceId) ?? 0) + amount);
    }
  }

  return Array.from(totals.entries())
    .map(([siteId, total]) => ({
      siteId,
      siteName: workplaces.find((w) => w.id === siteId)?.name ?? "Unknown site",
      total,
    }))
    .sort((a, b) => b.total - a.total);
}
