"use client";

import { useEffect, useState } from "react";

const PIN_KEY = "paintco_pin";
const UNLOCK_KEY = "paintco_unlocked_at";
const UNLOCK_MINUTES = 30; // re-ask for PIN after this much idle time

function getStoredPin(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(PIN_KEY);
}

function isRecentlyUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  const t = sessionStorage.getItem(UNLOCK_KEY);
  if (!t) return false;
  const elapsedMs = Date.now() - Number(t);
  return elapsedMs < UNLOCK_MINUTES * 60 * 1000;
}

export default function PinGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [input, setInput] = useState("");
  const [confirmInput, setConfirmInput] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = getStoredPin();
    setHasPin(!!stored);
    setUnlocked(isRecentlyUnlocked());
    setReady(true);
  }, []);

  if (!ready) return null;

  if (unlocked) {
    return <>{children}</>;
  }

  // First run: let the manager set a PIN (or skip).
  if (!hasPin) {
    return (
      <div className="page">
        <div className="card">
          <img
            src="/logo.jpg"
            alt="Doctor Paint"
            style={{
              height: 96,
              width: 96,
              borderRadius: "var(--radius-md)",
              marginBottom: 10,
              display: "block",
            }}
          />
          <div className="eyebrow">One-time setup</div>
          <h2>Set a PIN for this app</h2>
          <p style={{ color: "var(--color-ink-soft)", fontSize: 14 }}>
            This app stores wages and salary data on this phone. A PIN keeps it
            private if someone else picks up your phone. You can skip this, but
            it's not recommended.
          </p>
          <div className="field">
            <label>4-digit PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={input}
              onChange={(e) => setInput(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
            />
          </div>
          {error && (
            <p style={{ color: "var(--color-absent)", fontSize: 13 }}>
              {error}
            </p>
          )}
          <div className="row" style={{ gap: 8 }}>
            <button
              className="btn secondary"
              onClick={() => {
                sessionStorage.setItem(UNLOCK_KEY, String(Date.now()));
                setUnlocked(true);
              }}
            >
              Skip for now
            </button>
            <button
              className="btn"
              onClick={() => {
                if (input.length !== 4) {
                  setError("PIN must be 4 digits");
                  return;
                }
                localStorage.setItem(PIN_KEY, input);
                sessionStorage.setItem(UNLOCK_KEY, String(Date.now()));
                setHasPin(true);
                setUnlocked(true);
              }}
            >
              Set PIN
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Locked: ask for PIN.
  return (
    <div className="page">
      <div className="card" style={{ marginTop: 60 }}>
        <div
          className="image"
          style={{
            justifyContent: "center",
            alignContent: "center",
            padding: 10,
          }}
        >
          <img
            src="/logo.jpg"
            alt="Doctor Paint"
            style={{
              height: 96,
              width: 96,
              borderRadius: "var(--radius-md)",
              marginBottom: 10,
              display: "block",
            }}
          />
          <p className="eyebrow" style={{
            fontWeight: "bold",
            color: "black",
            fontSize: 24
          }}>DOCTOR PAINT PAYROLL</p>
        </div>
        <div className="eyebrow">Locked</div>
        <h2>Enter your PIN</h2>
        <div className="field">
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            autoFocus
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value.replace(/\D/g, ""))}
            placeholder="••••"
          />
        </div>
        {error && (
          <p style={{ color: "var(--color-absent)", fontSize: 13 }}>{error}</p>
        )}
        <button
          className="btn block"
          onClick={() => {
            if (confirmInput === getStoredPin()) {
              sessionStorage.setItem(UNLOCK_KEY, String(Date.now()));
              setUnlocked(true);
              setError("");
            } else {
              setError("Wrong PIN, try again");
              setConfirmInput("");
            }
          }}
        >
          Unlock
        </button>
      </div>
    </div>
  );
}
