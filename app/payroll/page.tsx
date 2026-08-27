"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type WorkPlace } from "@/lib/db";
import { toDateStr, weekEndingSaturday, formatNice, weekRangeFromSaturday } from "@/lib/date";
import { computeEmployeeWeek, type EmployeeWeekSummary } from "@/lib/payroll";
import { downloadPayslip, downloadAllPayslips, type PayslipData } from "@/lib/payslip";
import Link from "next/link";

export default function PayrollPage() {
  const workplaces = useLiveQuery(() => db.workplaces.orderBy("name").toArray(), []);
  const [weekEnd, setWeekEnd] = useState(toDateStr(weekEndingSaturday(new Date())));
  const [preview, setPreview] = useState<EmployeeWeekSummary[] | null>(null);
  const [loading, setLoading] = useState(false);

  // One payroll run per week, for the whole company — not per site, since
  // employees can split their week across sites.
  const pastRuns = useLiveQuery(
    () => db.payrollRuns.orderBy("weekEnd").reverse().toArray(),
    []
  );

  function siteName(id: number | undefined): string {
    if (!id) return "";
    return workplaces?.find((w) => w.id === id)?.name ?? "";
  }

  async function buildPreview() {
    setLoading(true);
    const employees = await db.employees.filter((e) => e.active).toArray();
    const saturday = new Date(weekEnd + "T00:00:00");
    const summaries = await Promise.all(employees.map((e) => computeEmployeeWeek(e, saturday)));
    setPreview(summaries);
    setLoading(false);
  }

  async function confirmAndSave() {
    if (!preview) return;
    const { start, end } = weekRangeFromSaturday(new Date(weekEnd + "T00:00:00"));
    const runId = await db.payrollRuns.add({
      weekStart: toDateStr(start),
      weekEnd: toDateStr(end),
      generatedAt: new Date().toISOString(),
    });
    for (const s of preview) {
      await db.payrollDetails.add({
        payrollRunId: runId,
        employeeId: s.employee.id!,
        employeeName: s.employee.name,
        dailyRate: s.employee.dailyRate,
        fullDays: s.fullDays,
        halfDays: s.halfDays,
        absentDays: s.absentDays,
        totalAmount: s.totalAmount,
      });
    }
    setPreview(null);
    alert("Payroll saved for this week.");
  }

  function sitesWorked(s: EmployeeWeekSummary): string {
    const ids = Array.from(new Set(s.records.filter((r) => r.dayType !== "ABSENT").map((r) => r.workPlaceId)));
    if (ids.length === 0) return "No days worked";
    return ids.map((id) => siteName(id)).filter(Boolean).join(", ");
  }

  const total = preview?.reduce((sum, s) => sum + s.totalAmount, 0) ?? 0;

  if ((workplaces?.length ?? 0) === 0) {
    return (
      <div className="page">
        <div className="eyebrow">Payroll</div>
        <h1>Payroll</h1>
        <div className="empty-state">
          Add a work site first.
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
      <div className="eyebrow">Payroll</div>
      <h1>Weekly payroll</h1>
      <p style={{ color: "var(--color-ink-soft)", fontSize: 13, marginTop: -6 }}>
        Covers every active employee for the week, regardless of which site(s) they worked.
      </p>

      <div className="card">
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Week ending (Saturday)</label>
          <input
            type="date"
            value={weekEnd}
            onChange={(e) => { setWeekEnd(e.target.value); setPreview(null); }}
          />
        </div>
        <button className="btn block" style={{ marginTop: 14 }} onClick={buildPreview} disabled={loading}>
          {loading ? "Calculating…" : "Calculate this week's payroll"}
        </button>
      </div>

      {preview && (
        <>
          <div className="card">
            <div className="row">
              <div className="eyebrow">Total payout</div>
              <div className="money" style={{ fontSize: 20 }}>Rs {total.toLocaleString()}</div>
            </div>
          </div>

          {preview.map((s) => (
            <div className="card" key={s.employee.id}>
              <div className="row">
                <strong>{s.employee.name}</strong>
                <span className="money">Rs {s.totalAmount.toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 13, color: "var(--color-ink-soft)" }}>
                <span><span className="swatch full" style={{ width: 14, height: 14, borderRadius: 4, display: "inline-block", verticalAlign: "middle", marginRight: 4 }} />{s.fullDays} full</span>
                <span><span className="swatch half" style={{ width: 14, height: 14, borderRadius: 4, display: "inline-block", verticalAlign: "middle", marginRight: 4 }} />{s.halfDays} half</span>
                <span><span className="swatch absent" style={{ width: 14, height: 14, borderRadius: 4, display: "inline-block", verticalAlign: "middle", marginRight: 4 }} />{s.absentDays} absent</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--color-ink-soft)", marginTop: 6 }}>
                Sites worked: {sitesWorked(s)}
              </div>
            </div>
          ))}

          <button className="btn block" onClick={confirmAndSave} style={{ marginBottom: 24 }}>
            Confirm & save this week's payroll
          </button>
        </>
      )}

      {(pastRuns?.length ?? 0) > 0 && (
        <>
          <div className="eyebrow" style={{ marginTop: 20 }}>Past payroll runs</div>
          {pastRuns?.map((run) => (
            <PastRunCard
              key={run.id}
              runId={run.id!}
              weekStart={run.weekStart}
              weekEnd={run.weekEnd}
              workplaces={workplaces ?? []}
            />
          ))}
        </>
      )}
    </div>
  );
}

function PastRunCard({
  runId,
  weekStart,
  weekEnd,
  workplaces,
}: {
  runId: number;
  weekStart: string;
  weekEnd: string;
  workplaces: WorkPlace[];
}) {
  const details = useLiveQuery(() => db.payrollDetails.where("payrollRunId").equals(runId).toArray(), [runId]);
  const [open, setOpen] = useState(false);
  const total = details?.reduce((sum, d) => sum + d.totalAmount, 0) ?? 0;

  // Recompute which sites each employee actually worked that week, straight
  // from attendance records (payroll details themselves don't store this).
  const siteMap = useLiveQuery(async () => {
    if (!details || details.length === 0) return {} as Record<number, string>;
    const map: Record<number, string> = {};
    for (const d of details) {
      const records = await db.attendance
        .where("employeeId")
        .equals(d.employeeId)
        .filter((r) => r.date >= weekStart && r.date <= weekEnd && r.dayType !== "ABSENT")
        .toArray();
      const ids = Array.from(new Set(records.map((r) => r.workPlaceId)));
      map[d.employeeId] = ids.map((id) => workplaces.find((w) => w.id === id)?.name).filter(Boolean).join(", ") || "—";
    }
    return map;
  }, [details, weekStart, weekEnd, workplaces]);

  function exportJson() {
    const payload = { weekStart, weekEnd, total, details };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll_${weekStart}_to_${weekEnd}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function toPayslipData(d: (typeof details)[number]): PayslipData {
    return {
      employeeName: d.employeeName,
      weekStart,
      weekEnd,
      dailyRate: d.dailyRate,
      fullDays: d.fullDays,
      halfDays: d.halfDays,
      absentDays: d.absentDays,
      totalAmount: d.totalAmount,
      sitesWorked: siteMap?.[d.employeeId],
    };
  }

  function handleDownloadOne(d: (typeof details)[number]) {
    downloadPayslip(toPayslipData(d));
  }

  function handleDownloadAll() {
    if (!details) return;
    downloadAllPayslips(details.map(toPayslipData));
  }

  return (
    <div className="card">
      <div className="row" onClick={() => setOpen(!open)} style={{ cursor: "pointer" }}>
        <div>
          <strong>{formatNice(new Date(weekStart + "T00:00:00"))} – {formatNice(new Date(weekEnd + "T00:00:00"))}</strong>
        </div>
        <span className="money">Rs {total.toLocaleString()}</span>
      </div>
      {open && (
        <>
          {details?.map((d) => (
            <div key={d.id} className="row" style={{ marginTop: 10, fontSize: 14 }}>
              <span>{d.employeeName}</span>
              <div className="row" style={{ width: "auto", gap: 10 }}>
                <span className="tabular">Rs {d.totalAmount.toLocaleString()}</span>
                <button
                  className="btn secondary"
                  style={{ padding: "6px 10px", fontSize: 12, minHeight: 32 }}
                  onClick={() => handleDownloadOne(d)}
                >
                  PDF slip
                </button>
              </div>
            </div>
          ))}
          <button className="btn block" style={{ marginTop: 14 }} onClick={handleDownloadAll}>
            Download all payslips (PDF)
          </button>
          {/* <button className="btn secondary block" style={{ marginTop: 8 }} onClick={exportJson}>
            Export raw data (JSON)
          </button> */}
        </>
      )}
    </div>
  );
}
