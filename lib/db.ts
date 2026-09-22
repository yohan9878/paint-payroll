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
export type NightType = "NONE" | "HALF" | "FULL"; // HALF = evening night shift (half day's pay);
                                                    // FULL = worked until midnight (a full day's pay)

export interface AttendanceRecord {
  id?: number;
  employeeId: number;
  daySiteId: number; // site worked for the DAY shift (Full/Half/Absent) that day
  date: string; // YYYY-MM-DD
  dayType: DayType; // day-shift status
  nightType?: NightType; // night-shift status that same day — paid ON TOP of the
                          // day-shift amount, on ANY day including Saturday.
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
  nightHalfDays: number; // count of half-night shifts worked that week
  nightFullDays: number; // count of full-night shifts (until midnight) worked that week
  nightShiftAmount: number; // total pay from all night shifts combined
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

    // v4: night shift now has two tiers — HALF (evening) and FULL (worked
    // until midnight, pays a full day's rate instead of half). Existing
    // records only ever had a boolean nightShift, which always meant the
    // half-night rate — migrated straight across as nightType: "HALF".
    // Saved payroll details are migrated the same way: their old
    // nightShiftDays count becomes nightHalfDays, with nightFullDays at 0.
    this.version(4)
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
            if (rec.nightType === undefined) {
              rec.nightType = rec.nightShift ? "HALF" : "NONE";
            }
            delete rec.nightShift;
          });
        await tx
          .table("payrollDetails")
          .toCollection()
          .modify((rec: any) => {
            if (rec.nightHalfDays === undefined) {
              rec.nightHalfDays = rec.nightShiftDays ?? 0;
              rec.nightFullDays = 0;
              delete rec.nightShiftDays;
            }
          });
      });
  }
}

export const db = new PayrollDB();
