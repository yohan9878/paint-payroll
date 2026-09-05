import Dexie, { type Table } from "dexie";

export interface WorkPlace {
  id?: number;
  name: string;
  location?: string;
  createdAt: string;
}

export interface Employee {
  id?: number;
  workPlaceId: number; // default/home site — used for grouping & suggestions only,
                        // NOT a restriction. An employee can be marked present at
                        // any site on any given day (see AttendanceRecord.daySiteId
                        // and .nightSiteId).
  name: string;
  dailyRate: number; // rate for a FULL day
  active: boolean;
  createdAt: string;
}

export type DayType = "FULL" | "HALF" | "ABSENT";

export interface AttendanceRecord {
  id?: number;
  employeeId: number;
  daySiteId: number; // site worked for the DAY shift (Full/Half/Absent) that day
  date: string; // YYYY-MM-DD
  dayType: DayType; // day-shift status
  nightShift?: boolean; // worked a night shift that same day — pays a half day
                         // on top of the day-shift amount, on ANY day including Saturday.
  nightSiteId?: number; // site worked for the NIGHT shift — independent of daySiteId,
                         // since someone can work days at one site and nights at another.
}

export interface PayrollRun {
  id?: number;
  weekStart: string; // Monday, YYYY-MM-DD
  weekEnd: string; // Saturday, YYYY-MM-DD
  generatedAt: string;
}

export interface PayrollDetail {
  id?: number;
  payrollRunId: number;
  employeeId: number;
  employeeName: string; // snapshot, in case employee is renamed/removed later
  dailyRate: number; // snapshot of the rate used
  fullDays: number;
  halfDays: number;
  absentDays: number;
  nightShiftDays: number; // count of night shifts worked that week
  nightShiftAmount: number; // total pay from night shifts (each = half a day's rate)
  totalAmount: number; // day-shift pay + night-shift pay combined
}

class PayrollDB extends Dexie {
  workplaces!: Table<WorkPlace, number>;
  employees!: Table<Employee, number>;
  attendance!: Table<AttendanceRecord, number>;
  payrollRuns!: Table<PayrollRun, number>;
  payrollDetails!: Table<PayrollDetail, number>;

  constructor() {
    super("paintCoPayrollDB");

    // v1: original schema (payroll runs were per work site)
    this.version(1).stores({
      workplaces: "++id, name",
      employees: "++id, workPlaceId, name, active",
      attendance: "++id, employeeId, workPlaceId, date, [employeeId+date]",
      payrollRuns: "++id, workPlaceId, weekStart, weekEnd",
      payrollDetails: "++id, payrollRunId, employeeId",
    });

    // v2: payroll is now per EMPLOYEE for the week, across whichever sites
    // they worked — so payrollRuns no longer needs a workPlaceId index.
    // Existing rows keep any stray workPlaceId property (harmless); it's
    // just no longer indexed or relied upon.
    this.version(2).stores({
      workplaces: "++id, name",
      employees: "++id, workPlaceId, name, active",
      attendance: "++id, employeeId, workPlaceId, date, [employeeId+date]",
      payrollRuns: "++id, weekStart, weekEnd",
      payrollDetails: "++id, payrollRunId, employeeId",
    });

    // v3: an employee's night shift can be at a DIFFERENT site than their day
    // shift, so attendance.workPlaceId splits into daySiteId + nightSiteId.
    // Existing attendance rows are migrated: their old workPlaceId becomes
    // daySiteId, and also nightSiteId if they already had a night shift on.
    this.version(3)
      .stores({
        workplaces: "++id, name",
        employees: "++id, workPlaceId, name, active",
        attendance: "++id, employeeId, daySiteId, date, [employeeId+date]",
        payrollRuns: "++id, weekStart, weekEnd",
        payrollDetails: "++id, payrollRunId, employeeId",
      })
      .upgrade(async (tx) => {
        await tx
          .table("attendance")
          .toCollection()
          .modify((rec: any) => {
            if (rec.workPlaceId !== undefined && rec.daySiteId === undefined) {
              rec.daySiteId = rec.workPlaceId;
              if (rec.nightShift && rec.nightSiteId === undefined) {
                rec.nightSiteId = rec.workPlaceId;
              }
              delete rec.workPlaceId;
            }
          });
      });
  }
}

export const db = new PayrollDB();
