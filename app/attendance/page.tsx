"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type DayType } from "@/lib/db";
import {
  todayStr,
  fromDateStr,
  weekEndingSaturday,
  weekDays,
  toDateStr,
} from "@/lib/date";
import { amountForDay, nightShiftPay } from "@/lib/payroll";
import Link from "next/link";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CYCLE: (DayType | null)[] = [null, "FULL", "HALF", "ABSENT"];

export default function AttendancePage() {
  const workplaces = useLiveQuery(() => db.workplaces.orderBy("name").toArray(), []);
  const [workPlaceId, setWorkPlaceId] = useState<string>("");
  const [date, setDate] = useState(todayStr());

  useEffect(() => {
    if (!workPlaceId && workplaces && workplaces.length > 0) {
      setWorkPlaceId(String(workplaces[0].id));
    }
  }, [workplaces, workPlaceId]);

  // Company-wide roster — an employee isn't locked to one site, so every
  // active employee can be marked here regardless of their "default" site.
  const employees = useLiveQuery(
    () => db.employees.filter((e) => e.active).sortBy("name"),
    []
  );

  // ---- Daily table data: today's attendance, for whichever site is selected ----
  const dayRecords = useLiveQuery(
    () => db.attendance.where("date").equals(date).toArray(),
    [date]
  );

  // ---- Weekly overview data: company-wide, across whichever sites each
  //      employee actually worked that week ----
  const weekSaturday = weekEndingSaturday(fromDateStr(date));
  const days = weekDays(weekSaturday);
  const dateStrs = days.map(toDateStr);
  const weekSaturdayStr = toDateStr(weekSaturday);

  const weekRecords = useLiveQuery(
    () => db.attendance.filter((r) => dateStrs.includes(r.date)).toArray(),
    [weekSaturdayStr]
  );

  function siteName(id: number | undefined): string {
    if (!id) return "";
    return workplaces?.find((w) => w.id === id)?.name ?? "";
  }

  function siteShort(id: number | undefined): string {
    const name = siteName(id);
    return name ? name.slice(0, 3).toUpperCase() : "";
  }

  async function setDayType(employeeId: number, dateStr: string, siteId: number, dayType: DayType | null) {
    const existing = await db.attendance
      .where("[employeeId+date]")
      .equals([employeeId, dateStr])
      .first();
    if (dayType === null) {
      if (existing) await db.attendance.delete(existing.id!);
      return;
    }
    if (existing) {
      // Update status, and refresh which site it was worked at (in case
      // today's selected site is different from what was saved before).
      await db.attendance.update(existing.id!, { dayType, workPlaceId: siteId });
    } else {
      await db.attendance.add({
        employeeId,
        workPlaceId: siteId,
        date: dateStr,
        dayType,
      });
    }
  }

  // Night shift is independent of day-shift status — it can be toggled even
  // if the employee was absent during the day, or on top of a full/half day.
  async function toggleNightShift(employeeId: number, dateStr: string, siteId: number) {
    const existing = await db.attendance
      .where("[employeeId+date]")
      .equals([employeeId, dateStr])
      .first();
    if (existing) {
      await db.attendance.update(existing.id!, { nightShift: !existing.nightShift });
    } else {
      await db.attendance.add({
        employeeId,
        workPlaceId: siteId,
        date: dateStr,
        dayType: "ABSENT",
        nightShift: true,
      });
    }
  }

  function cycleNext(current: DayType | null): DayType | null {
    const idx = CYCLE.indexOf(current);
    return CYCLE[(idx + 1) % CYCLE.length];
  }

  if ((workplaces?.length ?? 0) === 0) {
    return (
      <div className="page">
        <div className="eyebrow">Attendance</div>
        <h1>Attendance</h1>
        <div className="empty-state">
          Add a work site and employees first.
          <div style={{ marginTop: 12 }}>
            <Link href="/workplaces" className="btn" style={{ textDecoration: "none" }}>
              Add a work site
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="eyebrow">Attendance</div>
      <h1>Mark attendance</h1>

      <div className="card">
        <div className="field">
          <label>Site worked today</label>
          <select value={workPlaceId} onChange={(e) => setWorkPlaceId(e.target.value)}>
            {workplaces?.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <div style={{ fontSize: 12, color: "var(--color-ink-soft)", marginTop: 4 }}>
            Employees can be marked here even if this isn't their default site —
            useful when someone's working a different job this week.
          </div>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {(employees?.length ?? 0) === 0 && (
        <div className="empty-state">
          No active employees yet.
          <div style={{ marginTop: 12 }}>
            <Link href="/employees" className="btn" style={{ textDecoration: "none" }}>
              Add an employee
            </Link>
          </div>
        </div>
      )}

      {(employees?.length ?? 0) > 0 && (
        <>
          {/* ---- Daily entry table ---- */}
          <div className="eyebrow" style={{ marginTop: 4 }}>
            Today's entry — at {siteName(Number(workPlaceId)) || "selected site"}
          </div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="attendance-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Rate</th>
                  <th>F</th>
                  <th>H</th>
                  <th>A</th>
                  <th>N</th>
                </tr>
              </thead>
              <tbody>
                {employees?.map((emp) => {
                  const rec = dayRecords?.find((r) => r.employeeId === emp.id);
                  const current: DayType | null = rec?.dayType ?? null;
                  const nightOn = !!rec?.nightShift;
                  // If this employee already has a record today at a DIFFERENT
                  // site, flag it so the manager doesn't accidentally double-mark them.
                  const markedElsewhere = rec && rec.workPlaceId !== Number(workPlaceId);
                  return (
                    <tr key={emp.id}>
                      <td>
                        {emp.name}
                        {markedElsewhere && (
                          <div style={{ fontSize: 10, color: "var(--color-absent)", fontWeight: 700 }}>
                            already marked at {siteName(rec!.workPlaceId)} today
                          </div>
                        )}
                        {!rec && emp.workPlaceId !== Number(workPlaceId) && (
                          <div style={{ fontSize: 10, color: "var(--color-ink-soft)" }}>
                            default: {siteName(emp.workPlaceId)}
                          </div>
                        )}
                      </td>
                      <td className="tabular">Rs {emp.dailyRate.toLocaleString()}</td>
                      <td onClick={() => setDayType(emp.id!, date, Number(workPlaceId), "FULL")}>
                        <span className={`swatch ${current === "FULL" ? "full" : ""}`} style={{ margin: "0 auto" }} />
                      </td>
                      <td onClick={() => setDayType(emp.id!, date, Number(workPlaceId), "HALF")}>
                        <span className={`swatch ${current === "HALF" ? "half" : ""}`} style={{ margin: "0 auto" }} />
                      </td>
                      <td onClick={() => setDayType(emp.id!, date, Number(workPlaceId), "ABSENT")}>
                        <span className={`swatch ${current === "ABSENT" ? "absent" : ""}`} style={{ margin: "0 auto" }} />
                      </td>
                      <td onClick={() => toggleNightShift(emp.id!, date, Number(workPlaceId))}>
                        <button className={`night-toggle ${nightOn ? "active" : ""}`} type="button">
                          N
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 12, color: "var(--color-ink-soft)", marginBottom: 20 }}>
            F = full day, H = half day, A = absent, N = night shift (pays a half day extra,
            on top of the day shift — can apply on any day, including Saturday).
          </div>

          {/* ---- Weekly overview table (company-wide, across all sites) ---- */}
          <div className="eyebrow">
            Week of {formatShort(days[0])} – {formatShort(days[5])} · all sites
          </div>
          <div className="card" style={{ padding: 0, overflowX: "auto" }}>
            <table className="week-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  {days.map((d, i) => (
                    <th key={i}>
                      {DAY_LABELS[i]}
                      <div style={{ fontWeight: 400, fontSize: 10, color: "var(--color-ink-soft)" }}>{d.getDate()}</div>
                    </th>
                  ))}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {employees?.map((emp) => {
                  let weekTotal = 0;
                  const cells = dateStrs.map((ds) => {
                    const rec = weekRecords?.find((r) => r.employeeId === emp.id && r.date === ds);
                    const dt: DayType | null = rec?.dayType ?? null;
                    weekTotal += amountForDay(dt ?? "ABSENT", emp.dailyRate);
                    weekTotal += nightShiftPay(rec?.nightShift, emp.dailyRate);
                    return { ds, dt, siteId: rec?.workPlaceId, nightShift: !!rec?.nightShift };
                  });
                  return (
                    <tr key={emp.id}>
                      <td style={{ textAlign: "left" }}>{emp.name}</td>
                      {cells.map(({ ds, dt, siteId, nightShift }) => (
                        <td
                          key={ds}
                          onClick={() => setDayType(emp.id!, ds, Number(workPlaceId), cycleNext(dt))}
                          style={{ cursor: "pointer" }}
                        >
                          <span
                            className={`swatch ${dt === "FULL" ? "full" : dt === "HALF" ? "half" : dt === "ABSENT" ? "absent" : ""}`}
                            style={{ width: 20, height: 20, margin: "0 auto" }}
                          />
                          {dt && dt !== "ABSENT" && siteId && (
                            <div style={{ fontSize: 8, color: "var(--color-ink-soft)", marginTop: 2 }}>
                              {siteShort(siteId)}
                            </div>
                          )}
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleNightShift(emp.id!, ds, Number(workPlaceId));
                            }}
                            style={{
                              fontSize: 8,
                              fontWeight: 700,
                              color: nightShift ? "white" : "var(--color-ink-soft)",
                              background: nightShift ? "var(--color-night)" : "var(--color-bg)",
                              border: nightShift ? "none" : "1px solid var(--color-border)",
                              borderRadius: 4,
                              marginTop: 2,
                              padding: "1px 0",
                              cursor: "pointer",
                            }}
                          >
                            N
                          </div>
                        </td>
                      ))}
                      <td className="money">{weekTotal.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 12, color: "var(--color-ink-soft)", marginTop: 8, marginBottom: 20 }}>
            Tap a day cell to cycle: blank → full → half → absent → blank (uses the site
            selected above). Tap the "N" tag under any day — Monday through Saturday — to
            turn that day's night shift on or off.
          </div>
        </>
      )}
    </div>
  );
}

function formatShort(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
