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
                        // any site on any given day (see AttendanceRecord.workPlaceId).
  name: string;
  dailyRate: number; // rate for a FULL day
  active: boolean;
  createdAt: string;
}

export type DayType = "FULL" | "HALF" | "ABSENT";

export interface AttendanceRecord {
  id?: number;
  employeeId: number;
  workPlaceId: number; // the site actually worked THAT DAY — may differ from
                        // the employee's default site, and may differ day to day.
  date: string; // YYYY-MM-DD
  dayType: DayType;
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
  totalAmount: number;
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
  }
}

export const db = new PayrollDB();
