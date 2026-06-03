import { useState, useEffect } from "react";
import ProjectHeader from "../shared/ProjectHeader";
import BackHeader from "../shared/BackHeader";
import AppTile from "../shared/AppTile";
import { Skeleton, EmptyState } from "../shared/LoadingScreen";
import { TILES } from "../../lib/theme";
import TasksFeature  from "./TasksFeature";
import IssuesFeature from "./IssuesFeature";
import OnSiteFeature from "./OnSiteFeature";
import {
  getProjects, getTasksByProject,
  getHazardsByProject, createHazard, resolveHazard,
  getIssues,
  getDailyLogs, createDailyLog,
  getVariations, getMessages, sendMessage,
  getTodayClockIn, clockIn, clockOut,
} from "../../lib/db";
import { supabase } from "../../lib/supabase";
import { post } from "../../lib/webhook";
import { HAZARD_CATEGORIES } from "../../data/mockData";

const TODAY = new Date().toISOString().slice(0, 10);
const PRIORITY_COLOR = { high: "#ef4444", medium: "#f59e0b", low: "#22c55e" };
const PRIORITY_BG    = { high: "#2a0c0c", medium: "#251d00", low: "#06200e" };

function Screen({ title, subtitle, onBack, children, action }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title={title} subtitle={subtitle} onBack={onBack} rightSlot={action} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>{children}</div>
    </div>
  );
}



// ── Safety ─────────────────────────────────────────────────────────────────────
export function SafetyScreen({ project, user, onBack }) {
  const [hazards, setHazards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", risk: "medium", category: "", control_measures: "" });
  const RISK_COLOR = { high: "#ef4444", medium: "#f59e0b", low: "#22c55e" };
  const RISK_BG    = { high: "#2a0c0c", medium: "#251d00", low: "#06200e" };

  useEffect(() => {
    getHazardsByProject(project.id).then(({ data }) => { setHazards(data); setLoading(false); });
  }, [project.id]);

  const submit = async () => {
    if (!form.title || !form.category) return;
    const { data } = await createHazard({ ...form, project_id: project.id, reported_by: user.id, status: "open" });
    if (data) { setHazards(prev => [data, ...prev]); setShowForm(false); setForm({ title: "", risk: "medium", category: "", control_measures: "" }); }
    post("/hazards", data).catch(() => {});
  };

  const resolve = async (id) => {
    await resolveHazard(id);
    setHazards(prev => prev.map(h => h.id === id ? { ...h, status: "resolved" } : h));
    post("/hazards/resolve", { id }).catch(() => {});
  };

  return (
    <Screen title="Safety" subtitle={project.street} onBack={onBack}
      action={<button onClick={() => setShowForm(s => !s)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#ef4444", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer" }}>+ REPORT</button>}
    >
      {showForm && (
        <div style={{ background: "#141414", border: "1px solid #2a2a2a", borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Hazard description" style={{ ...inp, marginBottom: 10 }} />
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {["high","medium","low"].map(r => (<button key={r} onClick={() => setForm(f => ({ ...f, risk: r }))} style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: `1px solid ${form.risk === r ? RISK_COLOR[r] : "#2a2a2a"}`, background: form.risk === r ? RISK_BG[r] : "transparent", color: form.risk === r ? RISK_COLOR[r] : "#666", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer", textTransform: "capitalize" }}>{r}</button>))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {HAZARD_CATEGORIES.map(c => (<button key={c} onClick={() => setForm(f => ({ ...f, category: c }))} style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${form.category === c ? "#e07b39" : "#2a2a2a"}`, background: form.category === c ? "#2a1800" : "transparent", color: form.category === c ? "#e07b39" : "#666", fontSize: 12, cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif" }}>{c}</button>))}
          </div>
          <textarea value={form.control_measures} onChange={e => setForm(f => ({ ...f, control_measures: e.target.value }))} placeholder="Control measures" rows={2} style={{ ...inp, resize: "vertical", marginBottom: 10 }} />
          <button onClick={submit} style={{ width: "100%", padding: "11px", borderRadius: 8, border: "none", background: "#ef4444", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, cursor: "pointer" }}>SUBMIT</button>
        </div>
      )}
      {loading ? [1,2,3].map(i => <div key={i} style={{ height: 80, background: "#141414", borderRadius: 10, marginBottom: 8 }} />) :
        hazards.length === 0
          ? <EmptyState icon="🛡" title="No hazards reported" subtitle="Use the Report button to log a hazard" />
          : hazards.map(h => (
            <div key={h.id} style={{ background: "#141414", border: "1px solid #1e1e1e", borderLeft: `4px solid ${h.status === "resolved" ? "#333" : RISK_COLOR[h.risk]}`, borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: h.status === "resolved" ? "#555" : "#ccc" }}>{h.title}</div>
                  <div style={{ fontSize: 11, color: "#444", marginTop: 3 }}>{h.category} · {h.reported_by?.full_name} · {new Date(h.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</div>
                  {h.control_measures && <div style={{ fontSize: 12, color: "#666", marginTop: 5, fontStyle: "italic" }}>{h.control_measures}</div>}
                </div>
                {h.status === "open"
                  ? <span style={{ fontSize: 10, fontFamily: "Barlow Condensed, sans-serif", color: RISK_COLOR[h.risk], background: RISK_BG[h.risk], padding: "2px 8px", borderRadius: 4, flexShrink: 0, textTransform: "uppercase" }}>{h.risk}</span>
                  : <span style={{ fontSize: 10, fontFamily: "Barlow Condensed, sans-serif", color: "#22c55e", background: "#06200e", padding: "2px 8px", borderRadius: 4, flexShrink: 0 }}>RESOLVED</span>
                }
              </div>
              {h.status === "open" && (
                <button onClick={() => resolve(h.id)} style={{ marginTop: 10, padding: "7px 14px", borderRadius: 6, border: "1px solid #22c55e", background: "transparent", color: "#22c55e", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer" }}>✓ RESOLVE</button>
              )}
            </div>
          ))
      }
    </Screen>
  );
}

// ── Daily Log ──────────────────────────────────────────────────────────────────
export function DailyLogScreen({ project, user, onBack }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ weather: "Fine", workers_on_site: "", progress_notes: "", deliveries: "", visitors: "", issues: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    getDailyLogs(project.id).then(({ data }) => { setLogs(data); setLoading(false); });
  }, [project.id]);

  const submit = async () => {
    if (!form.progress_notes) return;
    setSubmitting(true);
    const { data } = await createDailyLog({ ...form, workers_on_site: parseInt(form.workers_on_site) || 0, project_id: project.id, submitted_by: user.id, log_date: TODAY });
    if (data) { setLogs(prev => [data, ...prev]); setSubmitted(true); setShowForm(false); }
    post("/dailylogs", data).catch(() => {});
    setSubmitting(false);
  };

  return (
    <Screen title="Daily Log" subtitle={project.street} onBack={onBack}
      action={<button onClick={() => setShowForm(s => !s)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#14b8a6", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer" }}>TODAY</button>}
    >
      {submitted && <div style={{ background: "#061e1c", border: "1px solid #14b8a6", borderRadius: 10, padding: "12px 14px", marginBottom: 14, color: "#14b8a6", fontFamily: "Barlow Condensed, sans-serif", fontSize: 15 }}>✓ Daily log submitted</div>}
      {showForm && (
        <div style={{ background: "#141414", border: "1px solid #2a2a2a", borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, color: "#14b8a6", marginBottom: 12 }}>{new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <div style={lbl}>Weather</div>
              <select value={form.weather} onChange={e => setForm(f => ({ ...f, weather: e.target.value }))} style={inp}>
                {["Fine","Overcast","Rain","Strong Wind","Hot"].map(w => <option key={w}>{w}</option>)}
              </select>
            </div>
            <div>
              <div style={lbl}>Workers on Site</div>
              <input type="number" min="0" value={form.workers_on_site} onChange={e => setForm(f => ({ ...f, workers_on_site: e.target.value }))} placeholder="0" style={inp} />
            </div>
          </div>
          {[
            { k: "progress_notes", l: "Work Completed *", ph: "What was done today..." },
            { k: "deliveries",     l: "Deliveries",       ph: "Materials received..." },
            { k: "visitors",       l: "Site Visitors",    ph: "Engineers, clients, inspectors..." },
            { k: "issues",         l: "Issues / Delays",  ph: "Any problems..." },
          ].map(f => (
            <div key={f.k} style={{ marginBottom: 10 }}>
              <div style={lbl}>{f.l}</div>
              <textarea value={form[f.k]} onChange={e => setForm(prev => ({ ...prev, [f.k]: e.target.value }))} placeholder={f.ph} rows={2} style={{ ...inp, resize: "vertical" }} />
            </div>
          ))}
          <button onClick={submit} disabled={submitting} style={{ width: "100%", padding: "11px", borderRadius: 8, border: "none", background: "#14b8a6", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, cursor: "pointer" }}>
            {submitting ? "SUBMITTING..." : "SUBMIT LOG"}
          </button>
        </div>
      )}
      {loading ? [1,2].map(i => <div key={i} style={{ height: 100, background: "#141414", borderRadius: 10, marginBottom: 8 }} />) :
        logs.length === 0
          ? <EmptyState icon="📋" title="No logs yet" subtitle="Submit today's log using the TODAY button" />
          : logs.map(log => (
            <div key={log.id} style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, color: "#ccc" }}>{new Date(log.log_date).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "short" })}</div>
                <span style={{ fontSize: 11, color: "#555" }}>{log.weather} · {log.workers_on_site} workers</span>
              </div>
              <div style={{ fontSize: 13, color: "#888", lineHeight: 1.5 }}>{log.progress_notes}</div>
              {log.issues && <div style={{ fontSize: 12, color: "#ef4444", marginTop: 6 }}>⚠ {log.issues}</div>}
            </div>
          ))
      }
    </Screen>
  );
}


// ── Variations ─────────────────────────────────────────────────────────────────
export function VariationsScreen({ project, onBack }) {
  const [vars, setVars] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getVariations(project.id).then(({ data }) => { setVars(data); setLoading(false); });
  }, [project.id]);

  const approved = vars.filter(v => v.status === "approved").reduce((s, v) => s + (v.amount || 0), 0);
  const pending  = vars.filter(v => v.status === "pending").length;

  return (
    <Screen title="Variations" subtitle={project.street} onBack={onBack}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 28, color: "#22c55e" }}>${approved.toLocaleString()}</div>
          <div style={{ fontSize: 11, color: "#555" }}>Approved</div>
        </div>
        <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 28, color: "#f59e0b" }}>{pending}</div>
          <div style={{ fontSize: 11, color: "#555" }}>Awaiting approval</div>
        </div>
      </div>
      {loading ? [1,2].map(i => <div key={i} style={{ height: 80, background: "#141414", borderRadius: 10, marginBottom: 8 }} />) :
        vars.length === 0
          ? <EmptyState icon="±" title="No variations yet" subtitle="Variations will appear here when raised" />
          : vars.map(v => (
            <div key={v.id} style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: "#555", fontFamily: "Barlow Condensed, sans-serif" }}>{v.ref}</div>
                  <div style={{ fontSize: 14, color: "#ccc", marginTop: 2 }}>{v.title}</div>
                  <div style={{ fontSize: 11, color: "#444", marginTop: 3 }}>{new Date(v.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 20, color: "#e07b39" }}>{v.amount ? `$${v.amount.toLocaleString()}` : "TBC"}</div>
                  <div style={{ fontSize: 10, fontFamily: "Barlow Condensed, sans-serif", color: v.status === "approved" ? "#22c55e" : "#f59e0b", marginTop: 4 }}>{v.status?.toUpperCase()}</div>
                </div>
              </div>
            </div>
          ))
      }
    </Screen>
  );
}

// ── Photos placeholder ─────────────────────────────────────────────────────────
function PhotosScreen({ project, onBack }) {
  return (
    <Screen title="Photos" subtitle={project.street} onBack={onBack}>
      <EmptyState icon="📷" title="Photo uploads coming in Stage 3" subtitle="Will connect to Supabase Storage" />
    </Screen>
  );
}

// ── Chat ───────────────────────────────────────────────────────────────────────
export function ChatScreen({ project, user, onBack }) {
  const [channel, setChannel] = useState("team");
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMessages(project.id).then(({ data }) => { setMessages(data); setLoading(false); });
  }, [project.id]);

  const send = async () => {
    if (!draft.trim()) return;
    const { data } = await sendMessage({ project_id: project.id, sender_id: user.id, channel, content: draft.trim() });
    if (data) setMessages(prev => [...prev, data]);
    setDraft("");
    post("/messages", data).catch(() => {});
  };

  const visible = messages.filter(m => m.channel === channel);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Chat" subtitle={project.street} onBack={onBack} />
      <div style={{ display: "flex", borderBottom: "1px solid #1e1e1e", flexShrink: 0 }}>
        {["team","trades","client"].map(ch => (
          <button key={ch} onClick={() => setChannel(ch)} style={{ flex: 1, padding: "10px 4px", border: "none", borderBottom: channel === ch ? "2px solid #e07b39" : "2px solid transparent", background: "transparent", color: channel === ch ? "#e07b39" : "#555", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, textTransform: "capitalize", cursor: "pointer" }}>{ch}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {loading ? null : visible.length === 0
          ? <div style={{ textAlign: "center", color: "#444", fontSize: 13, paddingTop: 20 }}>No messages in this channel</div>
          : visible.map(msg => {
            const out = msg.sender_id === user.id;
            return (
              <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: out ? "flex-end" : "flex-start" }}>
                <div style={{ fontSize: 10, color: "#444", marginBottom: 3 }}>{msg.sender?.full_name || "Unknown"}</div>
                <div style={{ maxWidth: "80%", background: out ? "#2a1800" : "#1a1a1a", border: `1px solid ${out ? "#3a2200" : "#222"}`, borderRadius: out ? "12px 12px 2px 12px" : "12px 12px 12px 2px", padding: "10px 14px", fontSize: 14, color: "#ccc", lineHeight: 1.5 }}>
                  {msg.content}
                </div>
              </div>
            );
          })
        }
      </div>
      <div style={{ padding: "10px 16px 24px", borderTop: "1px solid #1e1e1e", display: "flex", gap: 8 }}>
        <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder={`Message ${channel}...`} style={{ flex: 1, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#f0f0f0", fontSize: 14, padding: "10px 12px", fontFamily: "DM Sans, sans-serif" }} />
        <button onClick={send} disabled={!draft.trim()} style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: draft.trim() ? "#22c55e" : "#1a1a1a", color: draft.trim() ? "#fff" : "#444", fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, cursor: draft.trim() ? "pointer" : "default" }}>SEND</button>
      </div>
    </div>
  );
}

// ── Supervisor Home ────────────────────────────────────────────────────────────
function Stat({ value, label, color = "#e07b39", onClick }) {
  return (
    <button onClick={onClick} disabled={!onClick} style={{ flex: 1, textAlign: "center", background: "#1a1a1a", border: "none", borderRadius: 10, padding: "10px 6px", cursor: onClick ? "pointer" : "default", WebkitTapHighlightColor: "transparent" }}>
      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: "#555", marginTop: 3, textTransform: "uppercase", letterSpacing: 0.3, fontFamily: "Barlow Condensed, sans-serif" }}>{label}</div>
    </button>
  );
}

const LAST_PROJECT_KEY = "scs_sup_last_project";

// H6 — live on-site indicator + tap-to-clock in/out for the supervisor
function OnSiteIndicator({ user, project }) {
  const [ts, setTs] = useState(undefined); // undefined=loading, null=off, row=on
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  const load = () => getTodayClockIn(user.id).then(row => setTs(row || null));
  useEffect(() => { load(); }, [user.id]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  if (ts === undefined) return null;

  const onThis  = ts && ts.project_id === project.id;
  const onOther = ts && ts.project_id !== project.id;

  const fmt = () => {
    const ms = onThis ? now - new Date(ts.clock_in).getTime() : 0;
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    if (onThis) {
      if (window.confirm("Clock OUT of this site?")) { await clockOut(user.id); await load(); }
    } else if (onOther) {
      if (window.confirm("You're clocked in on another job. Clock out there and clock in here?")) {
        await clockOut(user.id); await clockIn(user.id, project.id); await load();
      }
    } else {
      await clockIn(user.id, project.id); await load();
    }
    setBusy(false);
  };

  const colors = onThis
    ? { fg: "#22c55e", bg: "#06200e", bd: "#166534", label: "ON SITE", extra: fmt() }
    : onOther
      ? { fg: "#f59e0b", bg: "#251d00", bd: "#92400e", label: "OTHER SITE", extra: "tap" }
      : { fg: "#ef4444", bg: "#2a0c0c", bd: "#7f1d1d", label: "OFF SITE", extra: "tap in" };

  return (
    <button onClick={toggle} disabled={busy} style={{
      display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 14,
      background: colors.bg, border: `1px solid ${colors.bd}`, color: colors.fg,
      fontFamily: "Barlow Condensed, sans-serif", fontSize: 12, letterSpacing: 0.5, cursor: "pointer",
      WebkitTapHighlightColor: "transparent", whiteSpace: "nowrap",
    }}>
      <span style={{ fontSize: 8 }}>●</span>
      {colors.label}
      <span style={{ opacity: 0.85, fontVariantNumeric: "tabular-nums" }}>{colors.extra}</span>
    </button>
  );
}

export default function SupervisorApp({ user }) {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectIdRaw] = useState(null);
  const [stats, setStats] = useState({ onSite: 0, tasks: 0, issues: 0, hazards: 0 });
  const [screen, setScreen] = useState(null);
  const [loading, setLoading] = useState(true);

  // Persist the last viewed project so the app reopens where the supervisor left off
  const setProjectId = (id) => {
    setProjectIdRaw(id);
    try { localStorage.setItem(LAST_PROJECT_KEY, id); } catch { /* ignore */ }
  };

  useEffect(() => {
    getProjects().then(({ data }) => {
      setProjects(data);
      if (data.length > 0) {
        let saved = null;
        try { saved = localStorage.getItem(LAST_PROJECT_KEY); } catch { /* ignore */ }
        const initial = data.find(p => p.id === saved) ? saved : data[0].id;
        setProjectIdRaw(initial);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!projectId) return;
    Promise.all([
      getTasksByProject(projectId),
      getIssues(projectId),
      getHazardsByProject(projectId),
      supabase.from("timesheets").select("id").eq("project_id", projectId).eq("work_date", TODAY).is("clock_out", null),
      supabase.from("site_visits").select("id").eq("project_id", projectId).gte("sign_in", TODAY + "T00:00:00Z").is("sign_out", null),
    ]).then(([t, i, h, ts, sv]) => {
      setStats({
        onSite:  (ts.data?.length || 0) + (sv.data?.length || 0),
        tasks:   t.data.filter(x => x.status !== "completed").length,
        issues:  i.data.filter(x => x.status === "open").length,
        hazards: h.data.filter(x => x.status === "open").length,
      });
    });
  }, [projectId]);

  const project = projects.find(p => p.id === projectId);

  if (loading || !project) return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <div style={{ padding: "14px 16px", background: "#111", borderBottom: "1px solid #1e1e1e" }}>
        <Skeleton width={120} height={14} style={{ marginBottom: 8 }} />
        <Skeleton width="70%" height={28} />
      </div>
    </div>
  );

  if (screen) {
    const props = { project, user, onBack: () => setScreen(null) };
    switch (screen) {
      case "onSite":     return <OnSiteFeature {...props} />;
      case "tasks":      return <TasksFeature {...props} />;
      case "issues":     return <IssuesFeature {...props} />;
      case "safety":     return <SafetyScreen {...props} />;
      case "dailyLog":   return <DailyLogScreen {...props} />;
      case "variations": return <VariationsScreen {...props} />;
      case "photos":     return <PhotosScreen {...props} />;
      case "chat":       return <ChatScreen {...props} />;
      default: break;
    }
  }

  const TILE_GRID = [
    { key: "onSite",     icon: "👷", label: "On Site",    accent: "#0ea5e9", bg: "#061520", badge: stats.onSite },
    { key: "tasks",      ...TILES.tasks,      badge: stats.tasks },
    { key: "plans",      ...TILES.plans,      badge: 0 },
    { key: "dailyLog",   ...TILES.dailyLog,   badge: 0 },
    { key: "safety",     ...TILES.safety,     badge: stats.hazards },
    { key: "issues",     ...TILES.issues,     badge: stats.issues },
    { key: "photos",     ...TILES.photos,     badge: 0 },
    { key: "variations", ...TILES.variations, badge: 0 },
    { key: "chat",       ...TILES.chat,       badge: 0 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c", maxWidth: 430, margin: "0 auto" }}>
      <ProjectHeader project={project} projects={projects} user={user} onSwitch={projects.length > 1 ? setProjectId : null} rightSlot={<OnSiteIndicator user={user} project={project} />} />
      <div style={{ display: "flex", gap: 8, padding: "12px 16px 0", flexShrink: 0 }}>
        <Stat value={stats.onSite}  label="On Site"   color="#0ea5e9" onClick={() => setScreen("onSite")} />
        <Stat value={stats.tasks}   label="Tasks Due" color="#f59e0b" onClick={() => setScreen("tasks")} />
        <Stat value={stats.issues}  label="Issues"    color="#f97316" onClick={() => setScreen("issues")} />
        <Stat value={stats.hazards} label="Hazards"   color="#ef4444" onClick={() => setScreen("safety")} />
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {TILE_GRID.map(tile => <AppTile key={tile.key} {...tile} onClick={() => setScreen(tile.key)} />)}
        </div>
      </div>
    </div>
  );
}

const inp = { width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#f0f0f0", fontSize: 14, padding: "10px 12px", fontFamily: "DM Sans, sans-serif", boxSizing: "border-box" };
const lbl = { fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Barlow Condensed, sans-serif", marginBottom: 5, display: "block" };
