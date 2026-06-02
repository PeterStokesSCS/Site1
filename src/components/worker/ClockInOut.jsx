import { useState, useEffect } from "react";
import { mockProjects } from "../../data/mockData";
import { post, enqueue } from "../../lib/webhook";
import { useOfflineQueue } from "../../hooks/useOfflineQueue";

function fmt(ts) {
  if (!ts) return "--:--";
  return new Date(ts).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function fmtDuration(ms) {
  if (!ms || ms < 0) return "0h 0m";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

const CLOCK_KEY = "bsp_clock_state";

function loadClockState() {
  try {
    return JSON.parse(localStorage.getItem(CLOCK_KEY) || "null");
  } catch {
    return null;
  }
}

function saveClockState(s) {
  localStorage.setItem(CLOCK_KEY, JSON.stringify(s));
}

export default function ClockInOut({ worker }) {
  const { isOnline, refreshPending } = useOfflineQueue();
  const [state, setState] = useState(() => loadClockState() || { clockedIn: false, clockInTime: null, projectId: mockProjects[0].id });
  const [now, setNow] = useState(Date.now());
  const [flash, setFlash] = useState(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const project = mockProjects.find((p) => p.id === state.projectId) || mockProjects[0];

  const toggle = async () => {
    const timestamp = new Date().toISOString();
    if (!state.clockedIn) {
      const next = { ...state, clockedIn: true, clockInTime: timestamp };
      setState(next);
      saveClockState(next);
      setFlash("in");
      setTimeout(() => setFlash(null), 1500);
      try {
        await post("/timeclock/in", { workerId: worker.id, projectId: state.projectId, timestamp });
      } catch {
        enqueue("/timeclock/in", { workerId: worker.id, projectId: state.projectId, timestamp });
        refreshPending();
      }
    } else {
      const next = { ...state, clockedIn: false, clockInTime: null };
      setState(next);
      saveClockState(next);
      setFlash("out");
      setTimeout(() => setFlash(null), 1500);
      try {
        await post("/timeclock/out", { workerId: worker.id, projectId: state.projectId, timestamp });
      } catch {
        enqueue("/timeclock/out", { workerId: worker.id, projectId: state.projectId, timestamp });
        refreshPending();
      }
    }
  };

  const elapsed = state.clockedIn && state.clockInTime ? now - new Date(state.clockInTime).getTime() : 0;

  const btnColor = state.clockedIn ? "#c0392b" : "#e07b39";
  const btnLabel = state.clockedIn ? "CLOCK OUT" : "CLOCK IN";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
      <div style={{ textAlign: "center", marginTop: 8 }}>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, color: "#555", letterSpacing: 1, textTransform: "uppercase" }}>Current Project</div>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 24, fontWeight: 700, color: "#f0f0f0", marginTop: 4 }}>{project.name}</div>
        <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>{project.address}</div>
      </div>

      {/* Project selector */}
      {!state.clockedIn && (
        <div style={{ width: "100%", maxWidth: 320 }}>
          <label style={{ fontSize: 12, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Barlow Condensed, sans-serif" }}>Select Project</label>
          <select
            value={state.projectId}
            onChange={(e) => { const next = { ...state, projectId: e.target.value }; setState(next); saveClockState(next); }}
            style={{
              width: "100%",
              marginTop: 6,
              background: "#1a1a1a",
              border: "1px solid #333",
              borderRadius: 8,
              color: "#f0f0f0",
              fontSize: 16,
              padding: "12px 14px",
              fontFamily: "DM Sans, sans-serif",
            }}
          >
            {mockProjects.filter(p => p.status === "active").map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Big clock button */}
      <button
        onClick={toggle}
        style={{
          width: 200,
          height: 200,
          borderRadius: "50%",
          background: flash ? (flash === "in" ? "#27ae60" : "#c0392b") : btnColor,
          border: "none",
          color: "#fff",
          fontFamily: "Barlow Condensed, sans-serif",
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: 2,
          cursor: "pointer",
          boxShadow: `0 0 0 6px ${(flash ? (flash === "in" ? "#27ae60" : "#c0392b") : btnColor)}22, 0 0 0 12px ${(flash ? (flash === "in" ? "#27ae60" : "#c0392b") : btnColor)}11`,
          transition: "background 0.2s, box-shadow 0.2s",
          WebkitTapHighlightColor: "transparent",
          userSelect: "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <span style={{ fontSize: 44, lineHeight: 1 }}>{state.clockedIn ? "⏹" : "▶"}</span>
        <span>{btnLabel}</span>
      </button>

      {/* Status panel */}
      <div style={{
        width: "100%",
        maxWidth: 320,
        background: "#141414",
        border: "1px solid #222",
        borderRadius: 12,
        padding: "16px 20px",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
      }}>
        <div>
          <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Barlow Condensed, sans-serif" }}>Status</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "Barlow Condensed, sans-serif", color: state.clockedIn ? "#27ae60" : "#888", marginTop: 4 }}>
            {state.clockedIn ? "ON SITE" : "OFF SITE"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Barlow Condensed, sans-serif" }}>Time Today</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "Barlow Condensed, sans-serif", color: "#e07b39", marginTop: 4 }}>
            {state.clockedIn ? fmtDuration(elapsed) : "--"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Barlow Condensed, sans-serif" }}>Clocked In</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "Barlow Condensed, sans-serif", color: "#f0f0f0", marginTop: 4 }}>
            {fmt(state.clockInTime)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Barlow Condensed, sans-serif" }}>Sync</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "Barlow Condensed, sans-serif", color: isOnline ? "#27ae60" : "#e07b39", marginTop: 4 }}>
            {isOnline ? "Online" : "Queued"}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 12, color: "#444", textAlign: "center" }}>
        {new Date(now).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </div>
    </div>
  );
}
