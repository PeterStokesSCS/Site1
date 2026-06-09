import { useState, useEffect } from "react";
import BackHeader from "../shared/BackHeader";
import { EmptyState } from "../shared/LoadingScreen";
import {
  getHazardsByProject, createHazard, resolveHazard,
  getDailyLogs, createDailyLog, getAttendanceForDay,
  getMessages, sendMessage, addPhoto,
} from "../../lib/db";
import { post } from "../../lib/webhook";
import { melbourneTodayStr } from "../../lib/actionQueue";
import { fetchWeather } from "../../lib/weather";
import { HAZARD_CATEGORIES } from "../../data/mockData";
import PhotoAttach from "../shared/PhotoAttach";
import PhotoCaptureButton from "../shared/PhotoCaptureButton";
import PhotoQueueBanner from "../shared/PhotoQueueBanner";

// Melbourne YYYY-MM-DD so "today" / log_date always match the site's actual calendar day
function localDateStr(d = new Date()) {
  return melbourneTodayStr(d);
}
function isoDaysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n); return localDateStr(d);
}
function fmtT(iso) {
  return iso ? new Date(iso).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true }) : "--";
}

// Renders a day's attendance roll (workers + visitors/subs) with durations
function AttendanceRoll({ entries, now }) {
  if (!entries) return <div style={{ fontSize: 12, color: "#444", padding: "6px 0" }}>Loading attendance…</div>;
  if (entries.length === 0) return <div style={{ fontSize: 12, color: "#555", padding: "6px 0" }}>No one signed in</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {entries.map(e => {
        const live = !e.outIso;
        const dur = e.hours != null ? `${e.hours}h` : live ? `${Math.round(((now - new Date(e.inIso).getTime()) / 3600000) * 10) / 10}h · on site` : "—";
        return (
          <div key={e.kind + e.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#1a1a1a", borderRadius: 8, padding: "8px 10px" }}>
            <span style={{ fontSize: 10, color: live ? "#22c55e" : "#555" }}>●</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: "#ccc" }}>{e.name} <span style={{ fontSize: 10, color: "#555", textTransform: "capitalize" }}>· {e.role}</span></div>
              <div style={{ fontSize: 11, color: "#555" }}>{fmtT(e.inIso)} → {e.outIso ? fmtT(e.outIso) : "still on site"}</div>
            </div>
            <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, color: live ? "#22c55e" : "#e07b39", flexShrink: 0 }}>{dur}</span>
          </div>
        );
      })}
    </div>
  );
}

// Expandable attendance for a past log (lazy-loads on expand)
function LogAttendance({ projectId, dateStr }) {
  const [entries, setEntries] = useState(null);
  useEffect(() => { getAttendanceForDay(projectId, dateStr).then(({ data }) => setEntries(data)); }, [projectId, dateStr]);
  return <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #1e1e1e" }}><AttendanceRoll entries={entries} now={Date.now()} /></div>;
}

const TODAY = melbourneTodayStr();

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
function QToggle({ label, yes, onSet, detail, onDetail, placeholder }) {
  return (
    <div style={{ marginBottom: 12, background: "#101010", border: "1px solid #1e1e1e", borderRadius: 9, padding: "10px 12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, color: "#ccc" }}>{label}</span>
        <div style={{ display: "flex", gap: 6 }}>
          {[["No", false, "#888"], ["Yes", true, "#14b8a6"]].map(([t, v, c]) => (
            <button key={t} onClick={() => onSet(v)} style={{ padding: "5px 16px", borderRadius: 7, border: `1px solid ${yes === v ? c : "#2a2a2a"}`, background: yes === v ? `${c}22` : "transparent", color: yes === v ? c : "#666", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer" }}>{t}</button>
          ))}
        </div>
      </div>
      {yes === true && <textarea value={detail} onChange={e => onDetail(e.target.value)} placeholder={placeholder} rows={2} style={{ ...inp, resize: "vertical", marginTop: 8 }} autoFocus />}
    </div>
  );
}

const FRESH_LOG = { weather: "", workers_on_site: "", progress_notes: "", hasDeliveries: null, deliveries: "", hasVisitors: null, visitors: "", hasIssues: null, issues: "" };

export function DailyLogScreen({ project, user, onBack }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(FRESH_LOG);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(false);

  const [roll, setRoll] = useState(null);       // today's attendance roll
  const [now, setNow] = useState(Date.now());
  const [expanded, setExpanded] = useState(null); // log id whose attendance is expanded
  const [range, setRange] = useState("all");     // history filter: day/week/month/all
  const [search, setSearch] = useState("");

  useEffect(() => {
    getDailyLogs(project.id).then(({ data }) => { setLogs(data); setLoading(false); });
  }, [project.id]);

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(id); }, []);

  // When the form opens: load today's attendance (auto headcount) + auto-fetch weather.
  useEffect(() => {
    if (!showForm) return;
    getAttendanceForDay(project.id, localDateStr()).then(({ data }) => {
      setRoll(data);
      setForm(f => (f.workers_on_site === "" ? { ...f, workers_on_site: String(data.length) } : f));
    });
    if (project.lat != null && project.lng != null) {
      setWeatherLoading(true);
      fetchWeather(project.lat, project.lng).then(w => { if (w) setForm(f => (f.weather ? f : { ...f, weather: w.summary })); setWeatherLoading(false); });
    }
  }, [showForm, project.id]);

  const openForm = () => { setForm(FRESH_LOG); setSubmitted(false); setShowForm(true); };

  const submit = async () => {
    if (!form.progress_notes.trim()) return;
    setSubmitting(true);
    // Yes/No answers become explicit text — "No deliveries" records the negative.
    const payload = {
      weather: form.weather.trim() || null,
      workers_on_site: parseInt(form.workers_on_site) || 0,
      progress_notes: form.progress_notes.trim(),
      deliveries: form.hasDeliveries ? (form.deliveries.trim() || "Deliveries received") : "No deliveries",
      visitors: form.hasVisitors ? (form.visitors.trim() || "Visitors on site") : "No visitors",
      issues: form.hasIssues ? (form.issues.trim() || "Issue logged") : "No issues",
      project_id: project.id, submitted_by: user.id, log_date: localDateStr(),
    };
    const { data } = await createDailyLog(payload);
    if (data) { setLogs(prev => [data, ...prev]); setSubmitted(true); setShowForm(false); }
    post("/dailylogs", data).catch(() => {});
    setSubmitting(false);
  };

  // History filter + search
  const cutoff = range === "day" ? localDateStr() : range === "week" ? isoDaysAgo(7) : range === "month" ? isoDaysAgo(30) : null;
  const visibleLogs = logs.filter(l => {
    if (cutoff && l.log_date < cutoff) return false;
    if (search.trim()) { const s = search.toLowerCase(); return [l.progress_notes, l.deliveries, l.visitors, l.issues, l.weather].some(x => (x || "").toLowerCase().includes(s)); }
    return true;
  });
  const canSubmit = form.progress_notes.trim() && form.hasDeliveries !== null && form.hasVisitors !== null && form.hasIssues !== null;

  return (
    <Screen title="Daily Log" subtitle={project.street} onBack={onBack}
      action={<button onClick={() => showForm ? setShowForm(false) : openForm()} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#14b8a6", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer" }}>{showForm ? "CANCEL" : "+ TODAY"}</button>}
    >
      {submitted && <div style={{ background: "#061e1c", border: "1px solid #14b8a6", borderRadius: 10, padding: "12px 14px", marginBottom: 14, color: "#14b8a6", fontFamily: "Barlow Condensed, sans-serif", fontSize: 15 }}>✓ Daily log submitted</div>}
      {showForm && (
        <div style={{ background: "#141414", border: "1px solid #2a2a2a", borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, color: "#14b8a6", marginBottom: 12 }}>{new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}</div>
          <div style={{ marginBottom: 12 }}>
            <div style={lbl}>Weather {weatherLoading && <span style={{ color: "#555", textTransform: "none", letterSpacing: 0 }}>· fetching…</span>}</div>
            <input value={form.weather} onChange={e => setForm(f => ({ ...f, weather: e.target.value }))} placeholder="Auto from site location, or type it" style={inp} />
          </div>
          {/* Attendance review — auto from clock records */}
          <div style={{ marginBottom: 12 }}>
            <div style={lbl}>On Site Today {roll != null && <span style={{ color: "#0ea5e9", textTransform: "none", letterSpacing: 0 }}>· {roll.length} {roll.length === 1 ? "person" : "people"}</span>}</div>
            <AttendanceRoll entries={roll} now={now} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={lbl}>Work Completed *</div>
            <textarea value={form.progress_notes} onChange={e => setForm(f => ({ ...f, progress_notes: e.target.value }))} placeholder="What was done today…" rows={2} style={{ ...inp, resize: "vertical" }} />
          </div>
          <QToggle label="Any deliveries?" yes={form.hasDeliveries} onSet={v => setForm(f => ({ ...f, hasDeliveries: v }))} detail={form.deliveries} onDetail={v => setForm(f => ({ ...f, deliveries: v }))} placeholder="What was delivered…" />
          <QToggle label="Any site visitors?" yes={form.hasVisitors} onSet={v => setForm(f => ({ ...f, hasVisitors: v }))} detail={form.visitors} onDetail={v => setForm(f => ({ ...f, visitors: v }))} placeholder="Engineers, clients, inspectors…" />
          <QToggle label="Any issues or delays?" yes={form.hasIssues} onSet={v => setForm(f => ({ ...f, hasIssues: v }))} detail={form.issues} onDetail={v => setForm(f => ({ ...f, issues: v }))} placeholder="What held things up…" />
          <button onClick={submit} disabled={submitting || !canSubmit} style={{ width: "100%", padding: "11px", borderRadius: 8, border: "none", background: canSubmit ? "#14b8a6" : "#1e1e1e", color: canSubmit ? "#fff" : "#555", fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, cursor: canSubmit ? "pointer" : "not-allowed" }}>
            {submitting ? "SUBMITTING..." : "SUBMIT LOG"}
          </button>
          {!canSubmit && !submitting && <div style={{ fontSize: 11, color: "#555", marginTop: 8, textAlign: "center" }}>Answer the three questions and add what was done.</div>}
        </div>
      )}

      {/* History filters + search */}
      {!showForm && logs.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            {[["day", "Today"], ["week", "Week"], ["month", "Month"], ["all", "All"]].map(([k, l]) => (
              <button key={k} onClick={() => setRange(k)} style={{ flex: 1, padding: "6px 4px", borderRadius: 7, border: `1px solid ${range === k ? "#14b8a6" : "#2a2a2a"}`, background: range === k ? "#061e1c" : "transparent", color: range === k ? "#14b8a6" : "#666", fontFamily: "Barlow Condensed, sans-serif", fontSize: 12, cursor: "pointer" }}>{l}</button>
            ))}
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search logs…" style={{ ...inp, fontSize: 13 }} />
        </div>
      )}

      {loading ? [1,2].map(i => <div key={i} style={{ height: 100, background: "#141414", borderRadius: 10, marginBottom: 8 }} />) :
        logs.length === 0
          ? <EmptyState icon="📋" title="No logs yet" subtitle="Submit today's log using the + TODAY button" />
          : visibleLogs.length === 0
            ? <EmptyState icon="🔍" title="No logs match" subtitle="Try a wider range or clear the search" />
          : visibleLogs.map(log => (
            <div key={log.id} style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, color: "#ccc" }}>{new Date(log.log_date).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "short" })}</div>
                <span style={{ fontSize: 11, color: "#555" }}>{log.weather} · {log.workers_on_site} on site</span>
              </div>
              <div style={{ fontSize: 13, color: "#888", lineHeight: 1.5 }}>{log.progress_notes}</div>
              {log.issues && <div style={{ fontSize: 12, color: "#ef4444", marginTop: 6 }}>⚠ {log.issues}</div>}
              <button onClick={() => setExpanded(expanded === log.id ? null : log.id)} style={{ marginTop: 8, background: "none", border: "none", color: "#0ea5e9", fontSize: 12, cursor: "pointer", padding: 0, fontFamily: "Barlow Condensed, sans-serif", letterSpacing: 0.3 }}>
                {expanded === log.id ? "▾ Hide attendance" : "▸ Who was on site"}
              </button>
              {expanded === log.id && (
                <>
                  <LogAttendance projectId={project.id} dateStr={log.log_date} />
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #1e1e1e" }}>
                    <PhotoAttach project={project} user={user} recordType="daily_log" recordId={log.id} accent="#14b8a6" defaultCategory="progress" defaultClientVisible={true} />
                  </div>
                </>
              )}
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
  const [view, setView] = useState(null); // image url shown full-screen

  const reload = () => getMessages(project.id).then(({ data }) => setMessages(data));
  useEffect(() => {
    getMessages(project.id).then(({ data }) => { setMessages(data); setLoading(false); });
    const h = () => reload();
    window.addEventListener("photoqueue:flushed", h);
    return () => window.removeEventListener("photoqueue:flushed", h);
  }, [project.id]);

  const send = async () => {
    if (!draft.trim()) return;
    const { data } = await sendMessage({ project_id: project.id, sender_id: user.id, channel, content: draft.trim() });
    if (data) setMessages(prev => [...prev, data]);
    setDraft("");
    post("/messages", data).catch(() => {});
  };

  // Send a photo as a message; also file it in the project gallery linked to the message.
  const sendPhoto = async (meta) => {
    const caption = draft.trim() || null;
    const { data } = await sendMessage({ project_id: project.id, sender_id: user.id, channel, content: caption, image_url: meta.url });
    if (!data) return;
    setMessages(prev => [...prev, data]);
    setDraft("");
    post("/messages", data).catch(() => {});
    addPhoto({
      project_id: project.id, url: meta.url, taken_by: user.id, caption,
      category: "general", linked_record_type: "message", linked_record_id: data.id,
      client_visible: channel === "client",
      file_name: meta.file_name, file_size_kb: meta.file_size_kb,
      gps_lat: meta.gps_lat, gps_lng: meta.gps_lng, gps_accuracy_m: meta.gps_accuracy_m,
      gps_on_site: meta.gps_on_site, gps_distance_from_site_m: meta.gps_distance_from_site_m,
      taken_at: meta.taken_at,
    }).catch(() => {});
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
                <div style={{ maxWidth: "80%", background: out ? "#2a1800" : "#1a1a1a", border: `1px solid ${out ? "#3a2200" : "#222"}`, borderRadius: out ? "12px 12px 2px 12px" : "12px 12px 12px 2px", padding: msg.image_url ? 4 : "10px 14px", fontSize: 14, color: "#ccc", lineHeight: 1.5 }}>
                  {msg.image_url && (
                    <img src={msg.image_url} alt={msg.content || "photo"} onClick={() => setView(msg.image_url)}
                      style={{ display: "block", maxWidth: 220, maxHeight: 260, borderRadius: 9, cursor: "pointer", objectFit: "cover" }} />
                  )}
                  {msg.content && <div style={{ padding: msg.image_url ? "7px 10px 4px" : 0 }}>{msg.content}</div>}
                </div>
              </div>
            );
          })
        }
      </div>
      <div style={{ padding: "0 16px" }}><PhotoQueueBanner /></div>
      <div style={{ padding: "10px 16px 24px", borderTop: "1px solid #1e1e1e", display: "flex", gap: 8, alignItems: "center" }}>
        <PhotoCaptureButton folder={`chat/${project.id}`} projectLat={project.lat} projectLng={project.lng} label="📷" color="#a855f7" onPhoto={sendPhoto}
          queueAction={{ type: "chatPhoto", payload: { message: { project_id: project.id, sender_id: user.id, channel, content: draft.trim() || null }, photo: { project_id: project.id, taken_by: user.id, category: "general", client_visible: channel === "client", linked_record_type: "message" } } }} />
        <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder={`Message ${channel}...`} style={{ flex: 1, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#f0f0f0", fontSize: 14, padding: "10px 12px", fontFamily: "DM Sans, sans-serif" }} />
        <button onClick={send} disabled={!draft.trim()} style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: draft.trim() ? "#22c55e" : "#1a1a1a", color: draft.trim() ? "#fff" : "#444", fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, cursor: draft.trim() ? "pointer" : "default" }}>SEND</button>
      </div>

      {view && (
        <div onClick={() => setView(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 400, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "flex-end", padding: 14 }}>
            <button onClick={() => setView(null)} style={{ background: "#1e1e1e", border: "none", borderRadius: 10, color: "#fff", fontSize: 20, width: 40, height: 40, cursor: "pointer" }}>✕</button>
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 12px 24px" }}>
            <img src={view} alt="photo" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8 }} />
          </div>
        </div>
      )}
    </div>
  );
}

const inp = { width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#f0f0f0", fontSize: 14, padding: "10px 12px", fontFamily: "DM Sans, sans-serif", boxSizing: "border-box" };
const lbl = { fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Barlow Condensed, sans-serif", marginBottom: 5, display: "block" };
