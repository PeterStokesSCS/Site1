import { useState, useEffect } from "react";
import BackHeader from "../shared/BackHeader";
import { EmptyState } from "../shared/LoadingScreen";
import {
  getHazardsByProject, createHazard, resolveHazard,
  getDailyLogs, createDailyLog,
  getVariations, getMessages, sendMessage,
} from "../../lib/db";
import { post } from "../../lib/webhook";
import { supabase } from "../../lib/supabase";
import { HAZARD_CATEGORIES } from "../../data/mockData";

const TODAY = new Date().toISOString().slice(0, 10);

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

  const [autoCount, setAutoCount] = useState(null);

  useEffect(() => {
    getDailyLogs(project.id).then(({ data }) => { setLogs(data); setLoading(false); });
  }, [project.id]);

  // When the log form opens, pre-fill the worker count from who's actually on site now
  useEffect(() => {
    if (!showForm) return;
    Promise.all([
      supabase.from("timesheets").select("id").eq("project_id", project.id).is("clock_out", null),
      supabase.from("site_visits").select("id").eq("project_id", project.id).is("sign_out", null),
    ]).then(([t, v]) => {
      const count = (t.data?.length || 0) + (v.data?.length || 0);
      setAutoCount(count);
      setForm(f => (f.workers_on_site === "" ? { ...f, workers_on_site: String(count) } : f));
    });
  }, [showForm, project.id]);

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
              <div style={lbl}>Workers on Site {autoCount != null && <span style={{ color: "#0ea5e9", textTransform: "none", letterSpacing: 0 }}>· {autoCount} on muster</span>}</div>
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

const inp = { width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#f0f0f0", fontSize: 14, padding: "10px 12px", fontFamily: "DM Sans, sans-serif", boxSizing: "border-box" };
const lbl = { fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Barlow Condensed, sans-serif", marginBottom: 5, display: "block" };
