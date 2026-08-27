import { db, type AttendanceRecord, type DayType, type Employee } from "./db";
import { toDateStr, weekDays } from "./date";

// Saturday is a half day (8am-1pm), so it pays half the normal daily rate.
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

export interface EmployeeWeekSummary {
  employee: Employee;
  fullDays: number;
  halfDays: number;
  absentDays: number;
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
  let totalAmount = 0;

  for (const dateStr of dateStrs) {
    const rec = records.find((r) => r.date === dateStr);
    const dayType: DayType = rec ? rec.dayType : "ABSENT";
    if (dayType === "FULL") fullDays++;
    else if (dayType === "HALF") halfDays++;
    else absentDays++;
    totalAmount += amountForDay(dayType, employee.dailyRate);
  }

  return { employee, fullDays, halfDays, absentDays, totalAmount, records };
}
