import { useState } from "react";
import ProjectHeader from "../shared/ProjectHeader";
import BackHeader from "../shared/BackHeader";
import AppTile from "../shared/AppTile";
import { TILES } from "../../lib/theme";
import { mockProjects, mockTasks, mockHazards, mockIssues, mockShifts, mockWorkers, mockVariations, mockDailyLogs, mockMessages, mockDocuments, HAZARD_CATEGORIES, ISSUE_CATEGORIES } from "../../data/mockData";
import { post } from "../../lib/webhook";

const TODAY = new Date().toISOString().slice(0, 10);
const PRIORITY_COLOR = { high: "#ef4444", medium: "#f59e0b", low: "#22c55e" };
const PRIORITY_BG    = { high: "#2a0c0c", medium: "#251d00", low: "#06200e" };
const STATUS_COLOR   = { open: "#f59e0b", resolved: "#22c55e", closed: "#555", approved: "#22c55e", pending: "#f59e0b" };

// ── Stat pill ─────────────────────────────────────────────────────────────────
function Stat({ value, label, color = "#e07b39" }) {
  return (
    <div style={{ flex: 1, textAlign: "center", background: "#1a1a1a", borderRadius: 10, padding: "10px 6px" }}>
      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: "#555", marginTop: 3, textTransform: "uppercase", letterSpacing: 0.3, fontFamily: "Barlow Condensed, sans-serif" }}>{label}</div>
    </div>
  );
}

// ── Shared screen chrome ──────────────────────────────────────────────────────
function Screen({ title, subtitle, onBack, children, action }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title={title} subtitle={subtitle} onBack={onBack} rightSlot={action} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>{children}</div>
    </div>
  );
}

// ── Tasks screen ──────────────────────────────────────────────────────────────
function TasksScreen({ project, onBack }) {
  const [tasks, setTasks] = useState(mockTasks.filter(t => t.projectId === project.id));
  const [filter, setFilter] = useState("all");
  const workers = mockWorkers;

  const filtered = tasks.filter(t => filter === "all" ? true : filter === "open" ? !t.done : t.done);

  const toggle = (id) => setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));

  return (
    <Screen title="Tasks" subtitle={project.street} onBack={onBack}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["all", "open", "done"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "6px 14px", borderRadius: 20, border: `1px solid ${filter === f ? "#e07b39" : "#2a2a2a"}`,
            background: filter === f ? "#2a1800" : "transparent", color: filter === f ? "#e07b39" : "#666",
            fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, textTransform: "capitalize", cursor: "pointer",
          }}>{f}</button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map(task => {
          const worker = workers.find(w => w.id === task.assignee);
          return (
            <button key={task.id} onClick={() => toggle(task.id)} style={{
              width: "100%", textAlign: "left", background: "#141414",
              border: "1px solid #1e1e1e", borderLeft: `4px solid ${PRIORITY_COLOR[task.priority]}`,
              borderRadius: 10, padding: "12px 14px", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                border: `2px solid ${task.done ? "#22c55e" : "#333"}`,
                background: task.done ? "#22c55e" : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {task.done && <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>✓</span>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: task.done ? "#555" : "#ccc", textDecoration: task.done ? "line-through" : "none" }}>{task.title}</div>
                <div style={{ fontSize: 11, color: "#555", marginTop: 3 }}>
                  {worker?.name || "Unassigned"} · Due {new Date(task.dueDate).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                </div>
              </div>
              <span style={{ fontSize: 11, fontFamily: "Barlow Condensed, sans-serif", color: PRIORITY_COLOR[task.priority], background: PRIORITY_BG[task.priority], padding: "2px 8px", borderRadius: 4, flexShrink: 0 }}>
                {task.priority}
              </span>
            </button>
          );
        })}
      </div>
    </Screen>
  );
}

// ── Safety screen ─────────────────────────────────────────────────────────────
function SafetyScreen({ project, onBack }) {
  const [hazards, setHazards] = useState(mockHazards.filter(h => h.projectId === project.id));
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", riskLevel: "medium", category: "", control: "" });

  const RISK_COLOR = { high: "#ef4444", medium: "#f59e0b", low: "#22c55e" };
  const RISK_BG    = { high: "#2a0c0c", medium: "#251d00", low: "#06200e" };

  const submit = () => {
    if (!form.title || !form.category) return;
    const h = { ...form, id: `h${Date.now()}`, reporter: "Jake Thornton", date: TODAY, status: "open", projectId: project.id };
    setHazards(prev => [h, ...prev]);
    post("/hazards", h).catch(() => {});
    setForm({ title: "", riskLevel: "medium", category: "", control: "" });
    setShowForm(false);
  };

  return (
    <Screen title="Safety" subtitle={project.street} onBack={onBack}
      action={
        <button onClick={() => setShowForm(s => !s)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#ef4444", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer" }}>
          + REPORT
        </button>
      }
    >
      {showForm && (
        <div style={{ background: "#141414", border: "1px solid #2a2a2a", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 16, color: "#ef4444", marginBottom: 12 }}>NEW HAZARD REPORT</div>
          <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} placeholder="Hazard description" style={inp} />
          <div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
            {["high","medium","low"].map(r => (
              <button key={r} onClick={() => setForm(f => ({...f, riskLevel: r}))} style={{
                flex: 1, padding: "8px 4px", borderRadius: 8, border: `1px solid ${form.riskLevel === r ? RISK_COLOR[r] : "#2a2a2a"}`,
                background: form.riskLevel === r ? RISK_BG[r] : "transparent",
                color: form.riskLevel === r ? RISK_COLOR[r] : "#666",
                fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer", textTransform: "capitalize",
              }}>{r}</button>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {HAZARD_CATEGORIES.map(c => (
              <button key={c} onClick={() => setForm(f => ({...f, category: c}))} style={{
                padding: "5px 10px", borderRadius: 6, border: `1px solid ${form.category === c ? "#e07b39" : "#2a2a2a"}`,
                background: form.category === c ? "#2a1800" : "transparent",
                color: form.category === c ? "#e07b39" : "#666", fontSize: 12, cursor: "pointer",
                fontFamily: "Barlow Condensed, sans-serif",
              }}>{c}</button>
            ))}
          </div>
          <textarea value={form.control} onChange={e => setForm(f => ({...f, control: e.target.value}))} placeholder="Control measures" rows={2} style={{ ...inp, resize: "vertical", marginBottom: 10 }} />
          <button onClick={submit} style={{ width: "100%", padding: "12px", borderRadius: 8, border: "none", background: "#ef4444", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, cursor: "pointer" }}>SUBMIT HAZARD</button>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {hazards.map(h => (
          <div key={h.id} style={{ background: "#141414", border: "1px solid #1e1e1e", borderLeft: `4px solid ${h.status === "resolved" ? "#333" : RISK_COLOR[h.riskLevel]}`, borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: h.status === "resolved" ? "#555" : "#ccc" }}>{h.title}</div>
                <div style={{ fontSize: 11, color: "#444", marginTop: 3 }}>{h.category} · {h.reporter} · {new Date(h.date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</div>
                {h.control && <div style={{ fontSize: 12, color: "#666", marginTop: 6, fontStyle: "italic" }}>{h.control}</div>}
              </div>
              {h.status === "open"
                ? <span style={{ fontSize: 10, fontFamily: "Barlow Condensed, sans-serif", color: RISK_COLOR[h.riskLevel], background: RISK_BG[h.riskLevel], padding: "2px 8px", borderRadius: 4, flexShrink: 0 }}>{h.riskLevel.toUpperCase()}</span>
                : <span style={{ fontSize: 10, fontFamily: "Barlow Condensed, sans-serif", color: "#22c55e", background: "#06200e", padding: "2px 8px", borderRadius: 4, flexShrink: 0 }}>RESOLVED</span>
              }
            </div>
            {h.status === "open" && (
              <button onClick={() => { setHazards(prev => prev.map(x => x.id === h.id ? { ...x, status: "resolved" } : x)); post("/hazards/resolve", { id: h.id }).catch(() => {}); }}
                style={{ marginTop: 10, padding: "7px 14px", borderRadius: 6, border: "1px solid #22c55e", background: "transparent", color: "#22c55e", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer" }}>
                ✓ RESOLVE
              </button>
            )}
          </div>
        ))}
      </div>
    </Screen>
  );
}

// ── Issues screen ─────────────────────────────────────────────────────────────
function IssuesScreen({ project, onBack }) {
  const [issues, setIssues] = useState(mockIssues.filter(i => i.projectId === project.id));
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", category: "Other", priority: "medium", notes: "" });

  const submit = () => {
    if (!form.title) return;
    const issue = { ...form, id: `i${Date.now()}`, projectId: project.id, date: TODAY, assignee: "w1", status: "open" };
    setIssues(prev => [issue, ...prev]);
    setShowForm(false);
    setForm({ title: "", category: "Other", priority: "medium", notes: "" });
  };

  return (
    <Screen title="Issues" subtitle={project.street} onBack={onBack}
      action={<button onClick={() => setShowForm(s => !s)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#f97316", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer" }}>+ ADD</button>}
    >
      {showForm && (
        <div style={{ background: "#141414", border: "1px solid #2a2a2a", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} placeholder="Issue title" style={{ ...inp, marginBottom: 10 }} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {ISSUE_CATEGORIES.map(c => (
              <button key={c} onClick={() => setForm(f => ({...f, category: c}))} style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${form.category === c ? "#f97316" : "#2a2a2a"}`, background: form.category === c ? "#251200" : "transparent", color: form.category === c ? "#f97316" : "#666", fontSize: 12, cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif" }}>{c}</button>
            ))}
          </div>
          <textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder="Details / notes" rows={2} style={{ ...inp, resize: "vertical", marginBottom: 10 }} />
          <button onClick={submit} style={{ width: "100%", padding: "12px", borderRadius: 8, border: "none", background: "#f97316", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, cursor: "pointer" }}>ADD ISSUE</button>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {issues.map(issue => (
          <div key={issue.id} style={{ background: "#141414", border: "1px solid #1e1e1e", borderLeft: `4px solid ${PRIORITY_COLOR[issue.priority]}`, borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 14, color: "#ccc", fontWeight: 600 }}>{issue.title}</div>
            <div style={{ fontSize: 11, color: "#555", marginTop: 3 }}>{issue.category} · {new Date(issue.date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</div>
            {issue.notes && <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>{issue.notes}</div>}
          </div>
        ))}
        {issues.length === 0 && <div style={{ textAlign: "center", color: "#444", padding: "40px 0", fontSize: 14 }}>No open issues</div>}
      </div>
    </Screen>
  );
}

// ── Daily Log screen ──────────────────────────────────────────────────────────
function DailyLogScreen({ project, onBack }) {
  const [logs] = useState(mockDailyLogs.filter(l => l.projectId === project.id));
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ weather: "Fine", workers: "", progress: "", deliveries: "", visitors: "", issues: "" });
  const [submitted, setSubmitted] = useState(false);

  const submit = () => {
    if (!form.progress) return;
    setSubmitted(true);
    setShowForm(false);
    post("/dailylogs", { ...form, projectId: project.id, date: TODAY }).catch(() => {});
  };

  return (
    <Screen title="Daily Log" subtitle={project.street} onBack={onBack}
      action={<button onClick={() => setShowForm(s => !s)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#14b8a6", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer" }}>TODAY</button>}
    >
      {submitted && <div style={{ background: "#061e1c", border: "1px solid #14b8a6", borderRadius: 10, padding: "12px 14px", marginBottom: 14, color: "#14b8a6", fontFamily: "Barlow Condensed, sans-serif", fontSize: 15 }}>✓ Daily log submitted</div>}

      {showForm && (
        <div style={{ background: "#141414", border: "1px solid #2a2a2a", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 16, color: "#14b8a6", marginBottom: 12 }}>
            {new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={lbl}>Weather</div>
              <select value={form.weather} onChange={e => setForm(f => ({...f, weather: e.target.value}))} style={inp}>
                {["Fine","Overcast","Rain","Strong Wind","Hot"].map(w => <option key={w}>{w}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={lbl}>Workers on Site</div>
              <input type="number" min="0" value={form.workers} onChange={e => setForm(f => ({...f, workers: e.target.value}))} placeholder="0" style={inp} />
            </div>
          </div>
          {[
            { key: "progress", label: "Progress / Work Completed", placeholder: "What was done today..." },
            { key: "deliveries", label: "Deliveries", placeholder: "Materials received..." },
            { key: "visitors", label: "Site Visitors", placeholder: "Engineers, clients, inspectors..." },
            { key: "issues", label: "Issues / Delays", placeholder: "Any problems encountered..." },
          ].map(field => (
            <div key={field.key} style={{ marginBottom: 10 }}>
              <div style={lbl}>{field.label}</div>
              <textarea value={form[field.key]} onChange={e => setForm(f => ({...f, [field.key]: e.target.value}))} placeholder={field.placeholder} rows={2} style={{ ...inp, resize: "vertical" }} />
            </div>
          ))}
          <button onClick={submit} style={{ width: "100%", padding: "12px", borderRadius: 8, border: "none", background: "#14b8a6", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, cursor: "pointer" }}>SUBMIT LOG</button>
        </div>
      )}

      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 12, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Previous Logs</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {logs.map(log => (
          <div key={log.id} style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, color: "#ccc" }}>{new Date(log.date).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "short" })}</div>
              <span style={{ fontSize: 11, color: "#555" }}>{log.weather} · {log.workers} workers</span>
            </div>
            <div style={{ fontSize: 13, color: "#888", lineHeight: 1.5 }}>{log.progress}</div>
            {log.issues && <div style={{ fontSize: 12, color: "#ef4444", marginTop: 6 }}>⚠ {log.issues}</div>}
          </div>
        ))}
      </div>
    </Screen>
  );
}

// ── Variations screen ─────────────────────────────────────────────────────────
function VariationsScreen({ project, onBack }) {
  const vars = mockVariations.filter(v => v.projectId === project.id);
  const total = vars.filter(v => v.status === "approved").reduce((s, v) => s + v.amount, 0);
  const pending = vars.filter(v => v.status === "pending");

  return (
    <Screen title="Variations" subtitle={project.street} onBack={onBack}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 28, color: "#22c55e" }}>${total.toLocaleString()}</div>
          <div style={{ fontSize: 11, color: "#555" }}>Approved variations</div>
        </div>
        <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 28, color: "#f59e0b" }}>{pending.length}</div>
          <div style={{ fontSize: 11, color: "#555" }}>Awaiting approval</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {vars.map(v => (
          <div key={v.id} style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "#555", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: 0.5 }}>{v.ref}</div>
                <div style={{ fontSize: 14, color: "#ccc", marginTop: 2 }}>{v.title}</div>
                <div style={{ fontSize: 11, color: "#444", marginTop: 3 }}>{v.raisedBy} · {new Date(v.date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 18, color: "#e07b39" }}>${v.amount.toLocaleString()}</div>
                <div style={{ fontSize: 10, fontFamily: "Barlow Condensed, sans-serif", color: STATUS_COLOR[v.status], marginTop: 4 }}>{v.status.toUpperCase()}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Screen>
  );
}

// ── Photos screen (placeholder with structure) ────────────────────────────────
function PhotosScreen({ project, onBack }) {
  return (
    <Screen title="Photos" subtitle={project.street} onBack={onBack}
      action={<button style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#a855f7", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer" }}>+ UPLOAD</button>}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} style={{ aspectRatio: "1", background: "#1a1a1a", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontSize: 24 }}>📷</div>
        ))}
      </div>
      <div style={{ textAlign: "center", color: "#444", fontSize: 13, marginTop: 20 }}>Photo uploads connect to cloud storage in Phase 2</div>
    </Screen>
  );
}

// ── Chat screen ───────────────────────────────────────────────────────────────
function ChatScreen({ project, onBack }) {
  const [channel, setChannel] = useState("team");
  const [messages, setMessages] = useState(mockMessages.filter(m => m.projectId === project.id));
  const [draft, setDraft] = useState("");

  const send = () => {
    if (!draft.trim()) return;
    const msg = { id: `m${Date.now()}`, projectId: project.id, channel, sender: "Jake Thornton", senderRole: "supervisor", text: draft.trim(), timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, msg]);
    setDraft("");
    post("/messages", msg).catch(() => {});
  };

  const visible = messages.filter(m => m.channel === channel);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Chat" subtitle={project.street} onBack={onBack} />
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #1e1e1e", flexShrink: 0 }}>
        {["team","trades","client"].map(ch => (
          <button key={ch} onClick={() => setChannel(ch)} style={{
            flex: 1, padding: "10px 4px", border: "none",
            borderBottom: channel === ch ? "2px solid #e07b39" : "2px solid transparent",
            background: "transparent", color: channel === ch ? "#e07b39" : "#555",
            fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, letterSpacing: 0.5,
            textTransform: "capitalize", cursor: "pointer",
          }}>{ch}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {visible.map(msg => {
          const out = msg.senderRole === "supervisor";
          return (
            <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: out ? "flex-end" : "flex-start" }}>
              <div style={{ fontSize: 10, color: "#444", marginBottom: 3, padding: "0 4px" }}>{msg.sender}</div>
              <div style={{ maxWidth: "80%", background: out ? "#2a1800" : "#1a1a1a", border: `1px solid ${out ? "#3a2200" : "#222"}`, borderRadius: out ? "12px 12px 2px 12px" : "12px 12px 12px 2px", padding: "10px 14px", fontSize: 14, color: "#ccc", lineHeight: 1.5 }}>
                {msg.text}
              </div>
            </div>
          );
        })}
        {visible.length === 0 && <div style={{ textAlign: "center", color: "#444", fontSize: 13, paddingTop: 20 }}>No messages in this channel</div>}
      </div>
      <div style={{ padding: "10px 16px 24px", borderTop: "1px solid #1e1e1e", display: "flex", gap: 8 }}>
        <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder={`Message ${channel}...`} style={{ ...inp, flex: 1 }} />
        <button onClick={send} disabled={!draft.trim()} style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: draft.trim() ? "#22c55e" : "#1a1a1a", color: draft.trim() ? "#fff" : "#444", fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, cursor: draft.trim() ? "pointer" : "default" }}>SEND</button>
      </div>
    </div>
  );
}

// ── Supervisor Home ───────────────────────────────────────────────────────────
export default function SupervisorApp({ user }) {
  const [projectId, setProjectId] = useState("p1");
  const [screen, setScreen] = useState(null);

  const project = mockProjects.find(p => p.id === projectId) || mockProjects[0];
  const workersToday = mockShifts.filter(s => s.date === TODAY && mockTasks.find(t => t.projectId === projectId && t.assignee === s.workerId)).length || mockShifts.filter(s => s.date === TODAY && s.projectId === projectId).length;
  const tasksOpen   = mockTasks.filter(t => t.projectId === projectId && !t.done).length;
  const issuesOpen  = mockIssues.filter(i => i.projectId === projectId && i.status === "open").length;
  const hazardsOpen = mockHazards.filter(h => h.projectId === projectId && h.status === "open").length;
  const varsAwait   = mockVariations.filter(v => v.projectId === projectId && v.status === "pending").length;

  if (screen) {
    const props = { project, onBack: () => setScreen(null) };
    switch (screen) {
      case "tasks":      return <TasksScreen {...props} />;
      case "safety":     return <SafetyScreen {...props} />;
      case "issues":     return <IssuesScreen {...props} />;
      case "dailyLog":   return <DailyLogScreen {...props} />;
      case "variations": return <VariationsScreen {...props} />;
      case "photos":     return <PhotosScreen {...props} />;
      case "chat":       return <ChatScreen {...props} />;
      default: break;
    }
  }

  const TILE_GRID = [
    { key: "plans",      badge: 0,           ...TILES.plans },
    { key: "tasks",      badge: tasksOpen,   ...TILES.tasks },
    { key: "photos",     badge: 0,           ...TILES.photos },
    { key: "dailyLog",   badge: 0,           ...TILES.dailyLog },
    { key: "safety",     badge: hazardsOpen, ...TILES.safety },
    { key: "issues",     badge: issuesOpen,  ...TILES.issues },
    { key: "variations", badge: varsAwait,   ...TILES.variations },
    { key: "chat",       badge: 0,           ...TILES.chat },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c", maxWidth: 430, margin: "0 auto" }}>
      <ProjectHeader project={project} user={user} onSwitch={setProjectId} />

      {/* Stats row */}
      <div style={{ display: "flex", gap: 8, padding: "12px 16px 0", flexShrink: 0 }}>
        <Stat value={workersToday || 0} label="On Site" color="#0ea5e9" />
        <Stat value={tasksOpen}    label="Tasks Due"  color="#f59e0b" />
        <Stat value={issuesOpen}   label="Issues"     color="#f97316" />
        <Stat value={hazardsOpen}  label="Hazards"    color="#ef4444" />
      </div>

      {/* Tile grid */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {TILE_GRID.map(tile => (
            <AppTile key={tile.key} {...tile} onClick={() => setScreen(tile.key)} />
          ))}
        </div>
      </div>
    </div>
  );
}

const inp = { width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#f0f0f0", fontSize: 14, padding: "10px 12px", fontFamily: "DM Sans, sans-serif", boxSizing: "border-box" };
const lbl = { fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Barlow Condensed, sans-serif", marginBottom: 5 };
