"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";

export default function WorkPlacesPage() {
  const workplaces = useLiveQuery(() => db.workplaces.orderBy("name").toArray(), []);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  async function save() {
    if (!name.trim()) return;
    if (editingId) {
      await db.workplaces.update(editingId, { name: name.trim(), location: location.trim() });
    } else {
      await db.workplaces.add({ name: name.trim(), location: location.trim(), createdAt: new Date().toISOString() });
    }
    setName("");
    setLocation("");
    setEditingId(null);
  }

  async function remove(id: number) {
    const employeesHere = await db.employees.where("workPlaceId").equals(id).count();
    if (employeesHere > 0) {
      alert("This site has employees assigned. Remove or reassign them first.");
      return;
    }
    if (confirm("Delete this work site?")) {
      await db.workplaces.delete(id);
    }
  }

  return (
    <div className="page">
      <div className="eyebrow">Work sites</div>
      <h1>Sites</h1>

      <div className="card">
        <div className="field">
          <label>Site name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Colombo Warehouse Job" />
        </div>
        <div className="field">
          <label>Location (optional)</label>
          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Colombo 05" />
        </div>
        <button className="btn block" onClick={save}>
          {editingId ? "Save changes" : "Add site"}
        </button>
        {editingId && (
          <button
            className="btn secondary block"
            style={{ marginTop: 8 }}
            onClick={() => {
              setEditingId(null);
              setName("");
              setLocation("");
            }}
          >
            Cancel edit
          </button>
        )}
      </div>

      {(workplaces?.length ?? 0) === 0 && (
        <div className="empty-state">No work sites yet. Add one above.</div>
      )}

      {workplaces?.map((w) => (
        <div className="card" key={w.id}>
          <div className="row">
            <div>
              <strong>{w.name}</strong>
              {w.location && <div style={{ color: "var(--color-ink-soft)", fontSize: 13 }}>{w.location}</div>}
            </div>
            <div className="row" style={{ gap: 8, width: "auto" }}>
              <button
                className="btn secondary"
                onClick={() => {
                  setEditingId(w.id!);
                  setName(w.name);
                  setLocation(w.location ?? "");
                }}
              >
                Edit
              </button>
              <button className="btn danger" onClick={() => remove(w.id!)}>
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
