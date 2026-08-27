"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import Link from "next/link";

export default function EmployeesPage() {
  const workplaces = useLiveQuery(() => db.workplaces.orderBy("name").toArray(), []);
  const employees = useLiveQuery(() => db.employees.orderBy("name").toArray(), []);

  const [name, setName] = useState("");
  const [workPlaceId, setWorkPlaceId] = useState<string>("");
  const [dailyRate, setDailyRate] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  async function save() {
    if (!name.trim() || !workPlaceId || !dailyRate) return;
    const rate = parseFloat(dailyRate);
    if (isNaN(rate) || rate <= 0) return;

    if (editingId) {
      await db.employees.update(editingId, {
        name: name.trim(),
        workPlaceId: Number(workPlaceId),
        dailyRate: rate,
      });
    } else {
      await db.employees.add({
        name: name.trim(),
        workPlaceId: Number(workPlaceId),
        dailyRate: rate,
        active: true,
        createdAt: new Date().toISOString(),
      });
    }
    setName("");
    setDailyRate("");
    setEditingId(null);
  }

  async function toggleActive(id: number, active: boolean) {
    await db.employees.update(id, { active: !active });
  }

  async function remove(id: number) {
    const attendanceCount = await db.attendance.where("employeeId").equals(id).count();
    if (attendanceCount > 0) {
      if (!confirm("This employee has attendance history. Delete anyway? History will be kept but unlinked.")) return;
    }
    await db.employees.delete(id);
  }

  if ((workplaces?.length ?? 0) === 0) {
    return (
      <div className="page">
        <div className="eyebrow">Team</div>
        <h1>Employees</h1>
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
      <div className="eyebrow">Team</div>
      <h1>Employees</h1>

      <div className="card">
        <div className="field">
          <label>Employee name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kamal Perera" />
        </div>
        <div className="field">
          <label>Default site</label>
          <select value={workPlaceId} onChange={(e) => setWorkPlaceId(e.target.value)}>
            <option value="">Select a site</option>
            {workplaces?.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <div style={{ fontSize: 12, color: "var(--color-ink-soft)", marginTop: 4 }}>
            Just used as a default/label — this employee can still be marked at any site
            on any given day in Attendance.
          </div>
        </div>
        <div className="field">
          <label>Daily rate (full day, LKR)</label>
          <input
            type="number"
            inputMode="decimal"
            value={dailyRate}
            onChange={(e) => setDailyRate(e.target.value)}
            placeholder="e.g. 3000"
          />
          <div style={{ fontSize: 12, color: "var(--color-ink-soft)", marginTop: 4 }}>
            Saturday (half day) automatically pays half this rate.
          </div>
        </div>
        <button className="btn block" onClick={save}>
          {editingId ? "Save changes" : "Add employee"}
        </button>
        {editingId && (
          <button
            className="btn secondary block"
            style={{ marginTop: 8 }}
            onClick={() => {
              setEditingId(null);
              setName("");
              setDailyRate("");
            }}
          >
            Cancel edit
          </button>
        )}
      </div>

      {(employees?.length ?? 0) === 0 && <div className="empty-state">No employees yet. Add one above.</div>}

      {employees?.map((e) => {
        const wp = workplaces?.find((w) => w.id === e.workPlaceId);
        return (
          <div className="card" key={e.id} style={{ opacity: e.active ? 1 : 0.55 }}>
            <div className="row">
              <div>
                <strong>{e.name}</strong>
                <div style={{ color: "var(--color-ink-soft)", fontSize: 13 }}>
                  Default: {wp?.name ?? "Unknown site"} · Rs {e.dailyRate.toLocaleString()}/day
                </div>
              </div>
              <div className="chip">{e.active ? "Active" : "Inactive"}</div>
            </div>
            <div className="row" style={{ gap: 8, marginTop: 10 }}>
              <button
                className="btn secondary"
                onClick={() => {
                  setEditingId(e.id!);
                  setName(e.name);
                  setWorkPlaceId(String(e.workPlaceId));
                  setDailyRate(String(e.dailyRate));
                }}
              >
                Edit
              </button>
              <button className="btn secondary" onClick={() => toggleActive(e.id!, e.active)}>
                {e.active ? "Mark inactive" : "Mark active"}
              </button>
              <button className="btn danger" onClick={() => remove(e.id!)}>
                Delete
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
