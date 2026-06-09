import { useState, useEffect, useRef } from "react";
import BackHeader from "../shared/BackHeader";
import { EmptyState } from "../shared/LoadingScreen";
import { supabase } from "../../lib/supabase";

const TODAY = new Date().toISOString().slice(0, 10);

function fmtTime(ts) {
  if (!ts) return "--:--";
  return new Date(ts).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function elapsed(clockIn) {
  if (!clockIn) return "—";
  const ms = Date.now() - new Date(clockIn).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

function StatusDot({ type }) {
  const map = {
    green:  { color: "#22c55e", label: "On site — confirmed" },
    amber:  { color: "#f59e0b", label: "On site — manual" },
    red:    { color: "#ef4444", label: "Not arrived" },
    grey:   { color: "#555",    label: "Not signed in" },
  };
  const s = map[type] || map.grey;
  return <span style={{ color: s.color, fontSize: 18 }}>●</span>;
}

// ── Worker Detail ──────────────────────────────────────────────────────────────
function WorkerDetail({ worker, timesheet, user, onBack, projectId }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("timesheets")
      .select("*, project:projects(street)")
      .eq("worker_id", worker.id)
      .eq("project_id", projectId)
      .order("work_date", { ascending: false })
      .limit(10)
      .then(({ data }) => { setHistory(data || []); setLoading(false); });
  }, [worker.id, projectId]);

  const clockOutWorker = async () => {
    if (!timesheet) return;
    const clockOutTime = new Date().toISOString();
    const hours = (new Date(clockOutTime) - new Date(timesheet.clock_in)) / 3600000;
    await supabase.from("timesheets").update({
      clock_out: clockOutTime,
      hours_worked: Math.round(hours * 100) / 100,
    }).eq("id", timesheet.id);
    onBack();
  };

  const totalHours = history.reduce((s, t) => s + (t.hours_worked || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title={worker.full_name} subtitle={timesheet ? "Currently on site" : "Not on site today"} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {/* Status card */}
        <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 12, padding: "16px 18px", marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { l: "Status",     v: timesheet ? "ON SITE" : "OFF SITE", c: timesheet ? "#22c55e" : "#888" },
              { l: "Time On Site", v: timesheet ? elapsed(timesheet.clock_in) : "—", c: "#e07b39" },
              { l: "Clocked In", v: timesheet ? fmtTime(timesheet.clock_in) : "—", c: "#f0f0f0" },
              { l: "Total This Project", v: `${Math.round(totalHours * 10) / 10}h`, c: "#f0f0f0" },
            ].map(s => (
              <div key={s.l}>
                <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Barlow Condensed, sans-serif" }}>{s.l}</div>
                <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 20, fontWeight: 700, color: s.c, marginTop: 4 }}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        {timesheet && (
          <button onClick={clockOutWorker} style={{ width: "100%", padding: "14px", borderRadius: 10, border: "none", background: "#ef4444", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 17, letterSpacing: 0.5, cursor: "pointer", marginBottom: 20 }}>
            CLOCK OUT {worker.full_name?.split(" ")[0].toUpperCase()}
          </button>
        )}

        {/* Site history */}
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 12, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Site History (Last 10 Days)</div>
        {loading ? null : history.length === 0
          ? <div style={{ fontSize: 13, color: "#444" }}>No history yet</div>
          : history.map(ts => (
            <div key={ts.id} style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "10px 14px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, color: "#ccc" }}>{new Date(ts.work_date).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}</div>
                <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
                  {ts.clock_in ? fmtTime(ts.clock_in) : "—"} → {ts.clock_out ? fmtTime(ts.clock_out) : "still on site"}
                </div>
              </div>
              <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 18, color: ts.hours_worked ? "#e07b39" : "#555" }}>
                {ts.hours_worked ? `${ts.hours_worked}h` : "—"}
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ── Add Visitor / Sub Form ─────────────────────────────────────────────────────
function AddVisitorForm({ projectId, userId, companies = [], onSave, onCancel }) {
  const [form, setForm] = useState({ visitor_name: "", company: "", trade: "", phone: "", type: "visitor", swms_acknowledged: false, safety_rules_acknowledged: false });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.visitor_name.trim()) return;
    setSaving(true);
    const { data } = await supabase.from("site_visits").insert({
      ...form,
      project_id: projectId,
      recorded_by: userId,
      sign_in: new Date().toISOString(),
    }).select().single();
    if (data) onSave(data);
    setSaving(false);
  };

  return (
    <div style={{ background: "#141414", border: "1px solid #2a2a2a", borderRadius: 14, padding: 16, marginBottom: 16 }}>
      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 16, color: "#e07b39", marginBottom: 14 }}>ADD TO SITE</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {[["visitor","Visitor"],["subcontractor","Sub"],["delivery","Delivery"]].map(([k, l]) => (
          <button key={k} onClick={() => setForm(f => ({ ...f, type: k }))} style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: `1px solid ${form.type === k ? "#e07b39" : "#2a2a2a"}`, background: form.type === k ? "#2a1800" : "transparent", color: form.type === k ? "#e07b39" : "#666", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer" }}>{l}</button>
        ))}
      </div>
      <datalist id="known-companies">{companies.map(c => <option key={c} value={c} />)}</datalist>
      {[
        { k: "visitor_name", ph: "Full name *" },
        { k: "company",      ph: "Company", list: "known-companies" },
        { k: "trade",        ph: form.type === "subcontractor" ? "Trade (e.g. Plumber)" : "Reason for visit" },
        { k: "phone",        ph: "Phone number" },
      ].map(f => (
        <input key={f.k} value={form[f.k]} onChange={e => setForm(prev => ({ ...prev, [f.k]: e.target.value }))} placeholder={f.ph} list={f.list} style={{ ...inp, marginBottom: 8 }} />
      ))}
      {form.type === "subcontractor" && (
        <div style={{ marginBottom: 12 }}>
          {[
            { k: "swms_acknowledged",        l: "SWMS read and understood" },
            { k: "safety_rules_acknowledged", l: "Site safety rules acknowledged" },
          ].map(item => (
            <button key={item.k} onClick={() => setForm(f => ({ ...f, [item.k]: !f[item.k] }))} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "transparent", border: "none", cursor: "pointer", padding: "8px 0", textAlign: "left" }}>
              <div style={{ width: 22, height: 22, borderRadius: 5, border: `2px solid ${form[item.k] ? "#22c55e" : "#333"}`, background: form[item.k] ? "#22c55e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {form[item.k] && <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>✓</span>}
              </div>
              <span style={{ fontSize: 13, color: "#ccc" }}>{item.l}</span>
            </button>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: "11px", borderRadius: 8, border: "1px solid #333", background: "transparent", color: "#888", cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif", fontSize: 14 }}>CANCEL</button>
        <button onClick={save} disabled={saving || !form.visitor_name.trim()} style={{ flex: 2, padding: "11px", borderRadius: 8, border: "none", background: form.visitor_name.trim() ? "#e07b39" : "#222", color: form.visitor_name.trim() ? "#fff" : "#555", fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, cursor: form.visitor_name.trim() ? "pointer" : "not-allowed" }}>
          {saving ? "SIGNING IN..." : "SIGN IN"}
        </button>
      </div>
    </div>
  );
}

// ── On Site Main ───────────────────────────────────────────────────────────────
export default function OnSiteFeature({ project, user, onBack, focusId }) {
  const [timesheets, setTimesheets] = useState([]);
  const [visits, setVisits] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [signOutTarget, setSignOutTarget] = useState(null); // { kind: 'worker'|'visit', id, name, signIn }
  const [tab, setTab] = useState("today"); // today | history
  const [tick, setTick] = useState(0);

  const confirmSignOut = async (target, outIso) => {
    if (target.kind === "worker") {
      const ts = timesheets.find(t => t.id === target.id);
      const hours = Math.round(((new Date(outIso) - new Date(ts.clock_in)) / 3600000) * 100) / 100;
      await supabase.from("timesheets").update({ clock_out: outIso, hours_worked: hours }).eq("id", target.id);
      setTimesheets(prev => prev.filter(t => t.id !== target.id));
    } else {
      await supabase.from("site_visits").update({ sign_out: outIso }).eq("id", target.id);
      setVisits(prev => prev.filter(v => v.id !== target.id));
    }
    setSignOutTarget(null);
  };

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    // "On site now" = open shift (no clock_out / sign_out), date-agnostic.
    // No profile embed here — timesheets has two FKs to profiles (worker_id +
    // approved_by) which makes embedding ambiguous; we join names from `profiles`.
    Promise.all([
      supabase.from("timesheets").select("*").eq("project_id", project.id).is("clock_out", null),
      supabase.from("site_visits").select("*").eq("project_id", project.id).is("sign_out", null),
      supabase.from("profiles").select("*"),
      supabase.from("site_visits").select("company").not("company", "is", null),
    ]).then(([t, v, p, c]) => {
      setTimesheets(t.data || []);
      setVisits(v.data || []);
      setProfiles(p.data || []);
      // Known companies (for autocomplete): from past visits + people's company field.
      setCompanies([...new Set([...(c.data || []).map(x => x.company), ...(p.data || []).map(x => x.company)].filter(Boolean))].sort());
      setLoading(false);
    });
  }, [project.id, tick]);

  // Deep-link: an attendance action item (open shift) targets a timesheet id —
  // open that worker's detail once the muster has loaded (one-shot per focusId).
  const focusedRef = useRef(null);
  useEffect(() => {
    if (!focusId || loading || focusedRef.current === focusId) return;
    const ts = timesheets.find(t => t.id === focusId);
    if (!ts) return;
    const p = profiles.find(x => x.id === ts.worker_id);
    setSelectedWorker({ id: ts.worker_id, full_name: p?.full_name || "Worker", role: p?.role || "worker" });
    focusedRef.current = focusId;
  }, [focusId, loading, timesheets, profiles]);

  if (selectedWorker) {
    const ts = timesheets.find(t => t.worker_id === selectedWorker.id);
    return <WorkerDetail worker={selectedWorker} timesheet={ts} user={user} onBack={() => setSelectedWorker(null)} projectId={project.id} />;
  }

  const workers = timesheets.map(ts => {
    const p = profiles.find(x => x.id === ts.worker_id);
    return { id: ts.worker_id, full_name: p?.full_name || "Worker", role: p?.role || "worker", timesheet: ts };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Attendance" subtitle={project.street} onBack={onBack} rightSlot={
        tab === "today" ? (
          <button onClick={() => setShowAdd(s => !s)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: showAdd ? "#333" : "#e07b39", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer" }}>
            {showAdd ? "CANCEL" : "+ ADD"}
          </button>
        ) : null
      } />
      <div style={{ display: "flex", borderBottom: "1px solid #1e1e1e", flexShrink: 0 }}>
        {[["today","Today"],["history","History"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ flex: 1, padding: "10px 4px", border: "none", borderBottom: tab === k ? "2px solid #e07b39" : "2px solid transparent", background: "transparent", color: tab === k ? "#e07b39" : "#555", fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, letterSpacing: 0.5, cursor: "pointer" }}>{l}</button>
        ))}
      </div>

      {tab === "history" ? <AttendanceHistory project={project} /> : (
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>

        {showAdd && <AddVisitorForm projectId={project.id} userId={user.id} companies={companies} onSave={v => { setVisits(prev => [v, ...prev]); setShowAdd(false); }} onCancel={() => setShowAdd(false)} />}

        {/* Summary */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <div style={{ flex: 1, background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 32, fontWeight: 700, color: "#22c55e" }}>{workers.length}</div>
            <div style={{ fontSize: 11, color: "#555" }}>Workers</div>
          </div>
          <div style={{ flex: 1, background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 32, fontWeight: 700, color: "#3b82f6" }}>{visits.length}</div>
            <div style={{ fontSize: 11, color: "#555" }}>Visitors / Subs</div>
          </div>
          <div style={{ flex: 1, background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 32, fontWeight: 700, color: "#e07b39" }}>{workers.length + visits.length}</div>
            <div style={{ fontSize: 11, color: "#555" }}>Total on site</div>
          </div>
        </div>

        {/* Workers */}
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 12, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Internal Workers</div>
        {loading ? null : workers.length === 0
          ? <div style={{ fontSize: 13, color: "#444", marginBottom: 20 }}>No workers clocked in yet today</div>
          : workers.map(w => (
            <div key={w.id} style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
              <StatusDot type="green" />
              <button onClick={() => setSelectedWorker(w)} style={{ flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                <div style={{ fontSize: 14, color: "#ccc", fontWeight: 600 }}>{w.full_name}</div>
                <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
                  In {fmtTime(w.timesheet?.clock_in)} · {elapsed(w.timesheet?.clock_in)} on site
                </div>
              </button>
              <button onClick={() => setSignOutTarget({ kind: "worker", id: w.timesheet.id, name: w.full_name, signIn: w.timesheet.clock_in })} style={signOutBtn}>OUT</button>
            </div>
          ))
        }

        {/* Visitors / Subs */}
        {visits.length > 0 && (
          <>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 12, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, marginTop: 16 }}>Visitors & Subcontractors</div>
            {visits.map(v => (
              <div key={v.id} style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
                <StatusDot type={v.type === "subcontractor" ? (v.swms_acknowledged ? "green" : "amber") : "grey"} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: "#ccc" }}>{v.visitor_name}</div>
                  <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
                    {v.company && `${v.company} · `}{v.trade} · In {fmtTime(v.sign_in)}
                    {v.type === "subcontractor" && !v.swms_acknowledged && <span style={{ color: "#f59e0b", marginLeft: 6 }}>⚠ SWMS not confirmed</span>}
                  </div>
                </div>
                <button onClick={() => setSignOutTarget({ kind: "visit", id: v.id, name: v.visitor_name, signIn: v.sign_in })} style={signOutBtn}>OUT</button>
              </div>
            ))}
          </>
        )}

        {workers.length === 0 && visits.length === 0 && !showAdd && (
          <EmptyState icon="👷" title="Nobody on site yet" subtitle="Workers appear here when they clock in. Use + ADD to sign in visitors or subs." />
        )}
      </div>
      )}

      {signOutTarget && <SignOutModal target={signOutTarget} onConfirm={confirmSignOut} onCancel={() => setSignOutTarget(null)} />}
    </div>
  );
}

// Completed-shift records (closed timesheets + signed-out visits) for this project
function AttendanceHistory({ project }) {
  const [rows, setRows] = useState(null);
  const [day, setDay] = useState("");   // optional date filter (YYYY-MM-DD)
  useEffect(() => {
    Promise.all([
      supabase.from("timesheets").select("*").eq("project_id", project.id).not("clock_out", "is", null).order("clock_in", { ascending: false }).limit(100),
      supabase.from("site_visits").select("*").eq("project_id", project.id).not("sign_out", "is", null).order("sign_in", { ascending: false }).limit(100),
      supabase.from("profiles").select("id, full_name, role"),
    ]).then(([ts, sv, pr]) => {
      const pmap = Object.fromEntries((pr.data || []).map(p => [p.id, p]));
      const a = (ts.data || []).map(t => {
        const p = pmap[t.worker_id];
        return {
          id: t.id, date: t.work_date || (t.clock_in || "").slice(0, 10), name: p?.full_name || "Worker",
          role: p?.role || "worker", inIso: t.clock_in, outIso: t.clock_out, hours: t.hours_worked,
        };
      });
      const b = (sv.data || []).map(v => ({
        id: v.id, date: (v.sign_in || "").slice(0, 10), name: v.visitor_name, role: v.type || "visitor",
        inIso: v.sign_in, outIso: v.sign_out,
        hours: v.sign_out ? Math.round(((new Date(v.sign_out) - new Date(v.sign_in)) / 3600000) * 10) / 10 : null,
      }));
      setRows([...a, ...b].sort((x, y) => (y.inIso || "").localeCompare(x.inIso || "")));
    });
  }, [project.id]);

  const fmtT = (iso) => iso ? new Date(iso).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true }) : "--";
  const visible = day ? (rows || []).filter(r => r.date === day) : (rows || []);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
      {/* Date picker (H10) */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <input type="date" value={day} onChange={e => setDay(e.target.value)} style={{ flex: 1, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#f0f0f0", fontSize: 14, padding: "9px 11px", fontFamily: "DM Sans, sans-serif", colorScheme: "dark" }} />
        {day && <button onClick={() => setDay("")} style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #2a2a2a", background: "transparent", color: "#888", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer" }}>All days</button>}
      </div>
      {rows === null ? [1,2,3].map(i => <div key={i} style={{ height: 56, background: "#141414", borderRadius: 10, marginBottom: 8 }} />)
        : visible.length === 0 ? <EmptyState icon="📋" title={day ? "Nobody on site that day" : "No completed shifts yet"} subtitle={day ? "Try another date" : "Records appear here once people clock/sign out"} />
        : visible.map(r => (
          <div key={r.id} style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: "#ccc", fontWeight: 600 }}>{r.name} <span style={{ fontSize: 11, color: "#555", textTransform: "capitalize" }}>· {r.role}</span></div>
              <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
                {r.date ? new Date(r.date).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" }) : "—"} · {fmtT(r.inIso)} → {fmtT(r.outIso)}
              </div>
            </div>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 18, color: r.hours ? "#e07b39" : "#555", flexShrink: 0 }}>{r.hours != null ? `${r.hours}h` : "—"}</div>
          </div>
        ))
      }
    </div>
  );
}

// ── Sign-out confirmation modal ────────────────────────────────────────────────
function SignOutModal({ target, onConfirm, onCancel }) {
  // datetime-local needs local time without timezone suffix
  const toLocalInput = (d) => {
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
  };
  const [outLocal, setOutLocal] = useState(toLocalInput(new Date()));
  const outIso = new Date(outLocal).toISOString();
  const ms = new Date(outIso) - new Date(target.signIn);
  const hrs = Math.max(0, ms) / 3600000;
  const dur = `${Math.floor(hrs)}h ${Math.round((hrs % 1) * 60)}m`;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={e => e.target === e.currentTarget && onCancel()}>
      <div style={{ background: "#161616", border: "1px solid #2a2a2a", borderRadius: 14, width: "100%", maxWidth: 380, padding: 22 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 20, fontWeight: 700, color: "#f0f0f0", marginBottom: 6 }}>SIGN OUT</div>
        <div style={{ fontSize: 14, color: "#ccc", marginBottom: 16 }}>{target.name}</div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1e1e1e" }}>
          <span style={{ fontSize: 12, color: "#555", fontFamily: "Barlow Condensed, sans-serif", textTransform: "uppercase" }}>Signed in</span>
          <span style={{ fontSize: 14, color: "#ccc" }}>{fmtTime(target.signIn)}</span>
        </div>
        <div style={{ padding: "12px 0" }}>
          <div style={{ fontSize: 12, color: "#555", fontFamily: "Barlow Condensed, sans-serif", textTransform: "uppercase", marginBottom: 6 }}>Sign-out time</div>
          <input type="datetime-local" value={outLocal} onChange={e => setOutLocal(e.target.value)} style={{ width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#f0f0f0", fontSize: 15, padding: "10px 12px", fontFamily: "DM Sans, sans-serif", boxSizing: "border-box" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 16px" }}>
          <span style={{ fontSize: 12, color: "#555", fontFamily: "Barlow Condensed, sans-serif", textTransform: "uppercase" }}>Total on site</span>
          <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 18, color: "#e07b39" }}>{dur}</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "12px", borderRadius: 8, border: "1px solid #333", background: "transparent", color: "#888", cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif", fontSize: 14 }}>CANCEL</button>
          <button onClick={() => onConfirm(target, outIso)} style={{ flex: 2, padding: "12px", borderRadius: 8, border: "none", background: "#ef4444", color: "#fff", cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, letterSpacing: 0.5 }}>CONFIRM SIGN OUT</button>
        </div>
      </div>
    </div>
  );
}

const signOutBtn = { padding: "6px 12px", borderRadius: 8, border: "1px solid #7f1d1d", background: "#2a0c0c", color: "#ef4444", fontFamily: "Barlow Condensed, sans-serif", fontSize: 12, letterSpacing: 0.5, cursor: "pointer", flexShrink: 0 };

const inp = { width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#f0f0f0", fontSize: 14, padding: "10px 12px", fontFamily: "DM Sans, sans-serif", boxSizing: "border-box" };
