import { useState, useEffect } from "react";
import ProjectHeader from "../shared/ProjectHeader";
import BackHeader from "../shared/BackHeader";
import AppTile from "../shared/AppTile";
import { TILES } from "../../lib/theme";
import { mockProjects, mockTasks, mockHazards, mockDocuments, HAZARD_CATEGORIES } from "../../data/mockData";
import { post, enqueue } from "../../lib/webhook";
import { useOfflineQueue } from "../../hooks/useOfflineQueue";
import OfflineBar from "../shared/OfflineBar";

const TODAY = new Date().toISOString().slice(0, 10);

// ── Clock In/Out ──────────────────────────────────────────────────────────────
function ClockScreen({ project, user, onBack }) {
  const { isOnline, refreshPending } = useOfflineQueue();
  const CLOCK_KEY = "scs_clock";
  const [state, setState] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CLOCK_KEY)) || { in: false, time: null }; } catch { return { in: false, time: null }; }
  });
  const [now, setNow] = useState(Date.now());
  const [flash, setFlash] = useState(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const save = (s) => { setState(s); localStorage.setItem(CLOCK_KEY, JSON.stringify(s)); };

  const toggle = async () => {
    const ts = new Date().toISOString();
    if (!state.in) {
      save({ in: true, time: ts });
      setFlash("in"); setTimeout(() => setFlash(null), 1500);
      try { await post("/timeclock/in", { workerId: user.id, projectId: project.id, timestamp: ts }); }
      catch { enqueue("/timeclock/in", { workerId: user.id, projectId: project.id, timestamp: ts }); refreshPending(); }
    } else {
      save({ in: false, time: null });
      setFlash("out"); setTimeout(() => setFlash(null), 1500);
      try { await post("/timeclock/out", { workerId: user.id, projectId: project.id, timestamp: ts }); }
      catch { enqueue("/timeclock/out", { workerId: user.id, projectId: project.id, timestamp: ts }); refreshPending(); }
    }
  };

  const elapsed = state.in && state.time ? now - new Date(state.time).getTime() : 0;
  const fmtElapsed = () => { const h = Math.floor(elapsed/3600000); const m = Math.floor((elapsed%3600000)/60000); return `${h}h ${m}m`; };

  const btnColor = flash === "in" ? "#22c55e" : flash === "out" ? "#ef4444" : state.in ? "#ef4444" : "#e07b39";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <OfflineBar />
      <BackHeader title={state.in ? "CLOCK OUT" : "CLOCK IN"} subtitle={project.street} onBack={onBack} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28, padding: 20 }}>
        <button onClick={toggle} style={{
          width: 200, height: 200, borderRadius: "50%",
          background: btnColor, border: "none", color: "#fff",
          fontFamily: "Barlow Condensed, sans-serif", fontSize: 26, fontWeight: 700, letterSpacing: 2,
          cursor: "pointer",
          boxShadow: `0 0 0 8px ${btnColor}22, 0 0 0 16px ${btnColor}11`,
          transition: "background 0.2s",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
          WebkitTapHighlightColor: "transparent",
        }}>
          <span style={{ fontSize: 48 }}>{state.in ? "⏹" : "▶"}</span>
          {state.in ? "CLOCK OUT" : "CLOCK IN"}
        </button>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, width: "100%", maxWidth: 320 }}>
          {[
            { label: "Status",     value: state.in ? "ON SITE" : "OFF SITE", color: state.in ? "#22c55e" : "#888" },
            { label: "Time Today", value: state.in ? fmtElapsed() : "--",    color: "#e07b39" },
            { label: "Project",    value: project.jobNumber || "–",           color: "#f0f0f0" },
            { label: "Sync",       value: isOnline ? "Online" : "Queued",    color: isOnline ? "#22c55e" : "#f59e0b" },
          ].map(s => (
            <div key={s.label} style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Barlow Condensed, sans-serif" }}>{s.label}</div>
              <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 20, fontWeight: 700, color: s.color, marginTop: 4 }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Tasks screen ──────────────────────────────────────────────────────────────
function TasksScreen({ project, user, onBack }) {
  const [tasks, setTasks] = useState(mockTasks.filter(t => t.projectId === project.id && t.assignee === "w2" && t.dueDate === TODAY));
  const done = tasks.filter(t => t.done).length;
  const PRIORITY_COLOR = { high: "#ef4444", medium: "#f59e0b", low: "#22c55e" };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Today's Tasks" subtitle={project.street} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 6, background: "#1e1e1e", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: tasks.length ? `${(done/tasks.length)*100}%` : "0%", background: "#e07b39", borderRadius: 3, transition: "width 0.3s" }} />
          </div>
          <span style={{ fontSize: 13, color: "#888", fontFamily: "Barlow Condensed, sans-serif" }}>{done}/{tasks.length}</span>
        </div>
        {tasks.length === 0 && <div style={{ textAlign: "center", color: "#555", padding: "60px 0" }}><div style={{ fontSize: 40 }}>✓</div><div style={{ marginTop: 10, fontFamily: "Barlow Condensed, sans-serif", fontSize: 18 }}>No tasks for today</div></div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {tasks.map(task => (
            <button key={task.id} onClick={() => setTasks(prev => prev.map(t => t.id === task.id ? { ...t, done: !t.done } : t))} style={{
              width: "100%", textAlign: "left", background: task.done ? "#141414" : "#191919",
              border: "1px solid #1e1e1e", borderLeft: `4px solid ${task.done ? "#333" : PRIORITY_COLOR[task.priority]}`,
              borderRadius: 10, padding: "14px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{ width: 26, height: 26, borderRadius: 6, border: `2px solid ${task.done ? "#22c55e" : "#444"}`, background: task.done ? "#22c55e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {task.done && <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>✓</span>}
              </div>
              <div>
                <div style={{ fontSize: 15, color: task.done ? "#555" : "#f0f0f0", textDecoration: task.done ? "line-through" : "none" }}>{task.title}</div>
                <div style={{ fontSize: 11, color: "#555", marginTop: 3, textTransform: "capitalize" }}>{task.priority} priority</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Safety screen ─────────────────────────────────────────────────────────────
function SafetyScreen({ project, user, onBack }) {
  const { refreshPending } = useOfflineQueue();
  const [form, setForm] = useState({ riskLevel: "", category: "", description: "" });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const RISK = [
    { id: "high",   label: "HIGH",   color: "#ef4444", bg: "#2a0c0c" },
    { id: "medium", label: "MEDIUM", color: "#f59e0b", bg: "#251d00" },
    { id: "low",    label: "LOW",    color: "#22c55e", bg: "#06200e" },
  ];
  const valid = form.riskLevel && form.category && form.description.trim().length >= 5;

  const submit = async () => {
    if (!valid) return;
    setSubmitting(true);
    const payload = { ...form, reporter: user.id, reporterName: user.name, projectId: project.id, timestamp: new Date().toISOString(), status: "open" };
    try { await post("/hazards", payload); } catch { enqueue("/hazards", payload); refreshPending(); }
    setSubmitting(false);
    setSubmitted(true);
  };

  if (submitted) return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Safety" subtitle={project.street} onBack={onBack} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
        <div style={{ fontSize: 64 }}>✓</div>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 24, color: "#22c55e" }}>HAZARD REPORTED</div>
        <button onClick={() => { setForm({ riskLevel: "", category: "", description: "" }); setSubmitted(false); }} style={{ padding: "12px 28px", borderRadius: 10, border: "2px solid #e07b39", background: "transparent", color: "#e07b39", fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, cursor: "pointer" }}>REPORT ANOTHER</button>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Report Hazard" subtitle={project.street} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
        <div style={{ marginBottom: 16 }}>
          <div style={lbl}>Risk Level</div>
          <div style={{ display: "flex", gap: 8 }}>
            {RISK.map(r => (
              <button key={r.id} onClick={() => setForm(f => ({...f, riskLevel: r.id}))} style={{ flex: 1, padding: "14px 4px", borderRadius: 10, border: `2px solid ${form.riskLevel === r.id ? r.color : "#2a2a2a"}`, background: form.riskLevel === r.id ? r.bg : "#141414", color: form.riskLevel === r.id ? r.color : "#555", fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, cursor: "pointer" }}>{r.label}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={lbl}>Category</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {HAZARD_CATEGORIES.map(c => (
              <button key={c} onClick={() => setForm(f => ({...f, category: c}))} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${form.category === c ? "#e07b39" : "#2a2a2a"}`, background: form.category === c ? "#2a1800" : "#141414", color: form.category === c ? "#e07b39" : "#777", fontSize: 13, fontFamily: "Barlow Condensed, sans-serif", cursor: "pointer" }}>{c}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={lbl}>Description</div>
          <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} placeholder="Describe the hazard..." rows={4} style={{ ...inp, resize: "vertical" }} />
        </div>
        <button onClick={submit} disabled={!valid || submitting} style={{ width: "100%", padding: "18px", borderRadius: 12, border: "none", background: valid ? "#ef4444" : "#1e1e1e", color: valid ? "#fff" : "#555", fontFamily: "Barlow Condensed, sans-serif", fontSize: 18, letterSpacing: 1, cursor: valid ? "pointer" : "not-allowed" }}>
          {submitting ? "SUBMITTING..." : "SUBMIT HAZARD REPORT"}
        </button>
      </div>
    </div>
  );
}

// ── Plans screen ──────────────────────────────────────────────────────────────
function PlansScreen({ project, onBack }) {
  const docs = mockDocuments.filter(d => d.projectId === project.id);
  const categories = [...new Set(docs.map(d => d.category))];
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Plans & Docs" subtitle={project.street} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
        {categories.map(cat => (
          <div key={cat} style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>{cat}</div>
            {docs.filter(d => d.category === cat).map(doc => (
              <div key={doc.id} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, marginBottom: 6,
                opacity: doc.current ? 1 : 0.5,
              }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>📄</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: "#ccc" }}>{doc.name}{!doc.current && <span style={{ marginLeft: 8, fontSize: 10, color: "#ef4444", fontFamily: "Barlow Condensed, sans-serif" }}>SUPERSEDED</span>}</div>
                  <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{new Date(doc.date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })} · {doc.size}</div>
                </div>
                <span style={{ color: "#3b82f6", fontSize: 18 }}>↓</span>
              </div>
            ))}
          </div>
        ))}
        {docs.length === 0 && <div style={{ textAlign: "center", color: "#444", padding: "40px 0" }}>No documents uploaded</div>}
      </div>
    </div>
  );
}

// ── Worker Home ───────────────────────────────────────────────────────────────
export default function WorkerApp({ user }) {
  const [projectId] = useState("p1");
  const [screen, setScreen] = useState(null);
  const project = mockProjects.find(p => p.id === projectId) || mockProjects[0];

  if (screen) {
    const props = { project, user, onBack: () => setScreen(null) };
    switch (screen) {
      case "startDay": return <ClockScreen {...props} />;
      case "tasks":    return <TasksScreen {...props} />;
      case "plans":    return <PlansScreen {...props} />;
      case "safety":   return <SafetyScreen {...props} />;
      default: break;
    }
  }

  const TILE_GRID = [
    { key: "startDay", ...TILES.startDay, wide: false },
    { key: "tasks",    ...TILES.tasks,    badge: mockTasks.filter(t => t.projectId === projectId && !t.done && t.dueDate === TODAY).length },
    { key: "plans",    ...TILES.plans },
    { key: "photos",   ...TILES.photos },
    { key: "safety",   ...TILES.safety,   badge: mockHazards.filter(h => h.projectId === projectId && h.status === "open").length },
    { key: "chat",     ...TILES.chat },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c", maxWidth: 430, margin: "0 auto" }}>
      <OfflineBar />
      <ProjectHeader project={project} user={user} />
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 24px" }}>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
          {new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {TILE_GRID.map(tile => (
            <AppTile key={tile.key} {...tile} onClick={() => setScreen(tile.key)} />
          ))}
        </div>
      </div>
    </div>
  );
}

const inp = { width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#f0f0f0", fontSize: 15, padding: "12px 14px", fontFamily: "DM Sans, sans-serif", boxSizing: "border-box" };
const lbl = { fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Barlow Condensed, sans-serif", marginBottom: 8, display: "block" };
