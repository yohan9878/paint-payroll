"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { todayStr, isSaturday, fromDateStr, formatNice } from "@/lib/date";

export default function Home() {
  const today = todayStr();
  const todayDate = fromDateStr(today);
  const saturdayToday = isSaturday(todayDate);

  const workplaceCount = useLiveQuery(() => db.workplaces.count(), []);
  const employeeCount = useLiveQuery(
    () => db.employees.filter((e) => e.active).count(),
    []
  );
  const todaysAttendance = useLiveQuery(() => db.attendance.where("date").equals(today).toArray(), [today]);

  return (
    <div className="page">
      <div className="eyebrow">{formatNice(todayDate)}</div>
      <h1>Paint Co Payroll</h1>
      <p style={{ color: "var(--color-ink-soft)", marginTop: 0 }}>
        {saturdayToday
          ? "It's Saturday — half day. Wrap up attendance, then generate this week's payroll."
          : "Mark today's attendance for each work site."}
      </p>

      <div className="card">
        <div className="row">
          <div>
            <div className="eyebrow">Work sites</div>
            <h2>{workplaceCount ?? "…"}</h2>
          </div>
          <div>
            <div className="eyebrow">Employees</div>
            <h2>{employeeCount ?? "…"}</h2>
          </div>
          <div>
            <div className="eyebrow">Marked today</div>
            <h2>{todaysAttendance?.length ?? "…"}</h2>
          </div>
        </div>
      </div>

      <Link href="/attendance" className="btn block" style={{ display: "block", textAlign: "center", marginBottom: 10, textDecoration: "none" }}>
        Mark today's attendance
      </Link>

      {saturdayToday && (
        <Link href="/payroll" className="btn secondary block" style={{ display: "block", textAlign: "center", marginBottom: 10, textDecoration: "none" }}>
          Generate this week's payroll
        </Link>
      )}

      {(workplaceCount ?? 0) === 0 && (
        <div className="card">
          <div className="eyebrow">Get started</div>
          <p style={{ marginTop: 4 }}>Add your first work site to begin.</p>
          <Link href="/workplaces" className="btn" style={{ textDecoration: "none", display: "inline-block" }}>
            Add a work site
          </Link>
        </div>
      )}
    </div>
  );
}
