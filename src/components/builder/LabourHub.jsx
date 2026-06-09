import { useState, useEffect } from "react";
import { EmptyState } from "../shared/LoadingScreen";
import { getAllProjectMembers, getProfiles, getLabourRates, upsertLabourRate, updateProject } from "../../lib/db";
import { melbourneTodayStr } from "../../lib/actionQueue";

// §M1 Labour — workforce / reporting hub. Hours-only (no pay rates / no $),
// all derived from existing timesheets + project_members. Four sections:
// Timesheets · Attendance · Labour Allocation · Hours report.

const card = { background: "#141414", border: "1px solid #1e1e1e", borderRadius: 12, padding: 16, marginBottom: 12 };
const head = { fontFamily: "Barlow Condensed, sans-serif", fontSize: 28, fontWeight: 700, color: "#f0f0f0" };
const sectionLbl = { fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 };

const shiftHours = (t) => {
  if (t.hours_worked != null) return Number(t.hours_worked);
  if (t.clock_in && t.clock_out) return Math.round(((new Date(t.clock_out) - new Date(t.clock_in)) / 3600000) * 10) / 10;
  return 0;
};
const round1 = (n) => Math.round(n * 10) / 10;
const fmtDay = (d) => d ? new Date(d).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" }) : "—";
const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true }) : "--";
// Prefer the stored work_date (already a Melbourne calendar day); for legacy rows
// without it, derive the Melbourne day from the clock_in instant (not the UTC date).
const dayKey = (t) => t.work_date ? String(t.work_date).slice(0, 10) : (t.clock_in ? melbourneTodayStr(new Date(t.clock_in)) : "");

// Monday (Melbourne) of the week containing `now`, as a YYYY-MM-DD Melbourne date.
function weekStartStr(now = new Date()) {
  const d = new Date(`${melbourneTodayStr(now)}T00:00:00Z`); // Melbourne calendar day → pure UTC date math
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

// ── Section landing tile ────────────────────────────────────────────────────────
function HubTile({ icon, label, subtitle, badge, badgeColor, onClick }) {
  return (
    <button onClick={onClick} style={{ width: "100%", display: "flex", alignItems: "center", gap: 16, background: "#141414", border: "1px solid #1e1e1e", borderRadius: 12, padding: "18px 20px", marginBottom: 10, cursor: "pointer", textAlign: "left", WebkitTapHighlightColor: "transparent" }}>
      <span style={{ fontSize: 30 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 20, fontWeight: 700, color: "#f0f0f0", textTransform: "uppercase" }}>{label}</div>
        <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>{subtitle}</div>
      </div>
      {badge != null && badge > 0 && <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 24, fontWeight: 700, color: badgeColor || "#e07b39" }}>{badge}</span>}
      <span style={{ color: "#444", fontSize: 20 }}>›</span>
    </button>
  );
}

// ── Timesheets (approval) ───────────────────────────────────────────────────────
function TimesheetsView({ timesheets, onApprove }) {
  const pending = timesheets.filter(t => t.status === "pending");
  const approved = timesheets.filter(t => t.status === "approved");
  const approveAll = () => pending.forEach(ts => onApprove(ts.id));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={sectionLbl}>Timesheets</div>
        {pending.length > 1 && <button onClick={approveAll} style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: "#22c55e", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, cursor: "pointer" }}>APPROVE ALL ({pending.length})</button>}
      </div>
      {pending.length === 0 && approved.length === 0 && <EmptyState icon="📋" title="No timesheets yet" subtitle="Timesheets appear here when workers clock in and out" />}
      {pending.length > 0 && (
        <>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, color: "#f59e0b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Pending ({pending.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
            {pending.map(ts => (
              <div key={ts.id} style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#222", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, color: "#888", flexShrink: 0 }}>
                  {(ts.worker?.full_name || "?").split(" ").map(n => n[0]).join("")}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#ccc" }}>{ts.worker?.full_name || "Unknown"}</div>
                  <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>
                    {ts.project?.street} · {fmtDay(ts.work_date || ts.clock_in)}
                    {ts.clock_in && ` · In ${fmtTime(ts.clock_in)}`}{ts.clock_out && ` → Out ${fmtTime(ts.clock_out)}`}
                  </div>
                </div>
                <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, color: "#e07b39", fontWeight: 700, flexShrink: 0 }}>{ts.hours_worked ? `${ts.hours_worked}h` : "—"}</div>
                <button onClick={() => onApprove(ts.id)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#22c55e", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, cursor: "pointer", flexShrink: 0 }}>APPROVE</button>
              </div>
            ))}
          </div>
        </>
      )}
      {approved.length > 0 && (
        <>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, color: "#444", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Approved</div>
          {approved.map(ts => (
            <div key={ts.id} style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 8, padding: "10px 14px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: 0.65 }}>
              <div>
                <span style={{ fontSize: 13, color: "#888" }}>{ts.worker?.full_name}</span>
                <span style={{ fontSize: 12, color: "#444", marginLeft: 10 }}>{ts.project?.street} · {fmtDay(ts.work_date || ts.clock_in)}</span>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 16, color: "#555" }}>{ts.hours_worked ? `${ts.hours_worked}h` : "—"}</span>
                <span style={{ fontSize: 10, fontFamily: "Barlow Condensed, sans-serif", color: "#22c55e", background: "#06200e", padding: "2px 8px", borderRadius: 4 }}>APPROVED</span>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── Attendance (who was on site, by day) ────────────────────────────────────────
function AttendanceView({ timesheets }) {
  const days = {};
  timesheets.forEach(t => { const k = dayKey(t); if (k) (days[k] = days[k] || []).push(t); });
  const sortedDays = Object.keys(days).sort((a, b) => b.localeCompare(a)).slice(0, 30);

  return (
    <div>
      <div style={sectionLbl}>Attendance · last {sortedDays.length} day{sortedDays.length === 1 ? "" : "s"}</div>
      {sortedDays.length === 0 ? <EmptyState icon="👷" title="No attendance yet" subtitle="Recorded from worker clock-ins" />
        : sortedDays.map(d => {
          const rows = days[d];
          const total = round1(rows.reduce((s, t) => s + shiftHours(t), 0));
          return (
            <div key={d} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 17, color: "#f0f0f0" }}>{fmtDay(d)}</span>
                <span style={{ fontSize: 12, color: "#666" }}>{rows.length} on site · <span style={{ color: "#e07b39", fontFamily: "Barlow Condensed, sans-serif", fontSize: 15 }}>{total}h</span></span>
              </div>
              {rows.map(t => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1a1a1a" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "#ccc" }}>{t.worker?.full_name || "Worker"}</div>
                    <div style={{ fontSize: 11, color: "#555" }}>{t.project?.street || "—"} · {fmtTime(t.clock_in)}–{t.clock_out ? fmtTime(t.clock_out) : "now"}</div>
                  </div>
                  <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, color: t.clock_out ? "#999" : "#22c55e", flexShrink: 0, marginLeft: 10 }}>{t.clock_out ? `${shiftHours(t)}h` : "on site"}</div>
                </div>
              ))}
            </div>
          );
        })}
    </div>
  );
}

// ── Labour Allocation (who is on which project) ─────────────────────────────────
function AllocationView({ timesheets, projects, members, profiles }) {
  const nameMap = Object.fromEntries(profiles.map(p => [p.id, p]));
  // Workers currently on site (open shift) keyed by project.
  const onSiteByProject = {};
  timesheets.filter(t => !t.clock_out).forEach(t => { (onSiteByProject[t.project_id] = onSiteByProject[t.project_id] || new Set()).add(t.worker_id); });
  const byProject = members.reduce((acc, m) => { (acc[m.project_id] = acc[m.project_id] || []).push(m); return acc; }, {});
  const activeProjects = projects.filter(p => byProject[p.id]?.length);
  const totalAllocated = new Set(members.map(m => m.user_id)).size;

  return (
    <div>
      <div style={sectionLbl}>Labour Allocation</div>
      <div style={{ ...card, display: "flex", gap: 10 }}>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 26, color: "#e07b39" }}>{totalAllocated}</div>
          <div style={{ fontSize: 11, color: "#666" }}>People allocated</div>
        </div>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 26, color: "#0ea5e9" }}>{activeProjects.length}</div>
          <div style={{ fontSize: 11, color: "#666" }}>Projects staffed</div>
        </div>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 26, color: "#22c55e" }}>{Object.values(onSiteByProject).reduce((s, set) => s + set.size, 0)}</div>
          <div style={{ fontSize: 11, color: "#666" }}>On site now</div>
        </div>
      </div>
      {activeProjects.length === 0 ? <EmptyState icon="🗂" title="Nobody allocated yet" subtitle="Assign team members to projects in the Team tab" />
        : activeProjects.map(p => {
          const onSite = onSiteByProject[p.id] || new Set();
          return (
            <div key={p.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 17, color: "#f0f0f0", textTransform: "uppercase" }}>{p.street}</span>
                <span style={{ fontSize: 11, color: "#666" }}>{p.job_number || ""}</span>
              </div>
              {byProject[p.id].map(m => {
                const prof = nameMap[m.user_id];
                const here = onSite.has(m.user_id);
                return (
                  <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid #1a1a1a" }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: here ? "#22c55e" : "#333", flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: 13, color: "#ccc" }}>{prof?.full_name || "Team member"}</div>
                    <div style={{ fontSize: 11, color: "#555", textTransform: "capitalize" }}>{m.role || prof?.role || "—"}</div>
                    {here && <span style={{ fontSize: 9, fontFamily: "Barlow Condensed, sans-serif", color: "#22c55e", background: "#06200e", padding: "2px 7px", borderRadius: 4 }}>ON SITE</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
    </div>
  );
}

// ── Hours report (actual hours by project / worker) ─────────────────────────────
function HoursView({ timesheets, projects }) {
  const [range, setRange] = useState("week"); // 'week' | 'all'
  const ws = weekStartStr();
  const inRange = (t) => range === "all" || dayKey(t) >= ws;
  const rows = timesheets.filter(inRange);

  const projMap = Object.fromEntries(projects.map(p => [p.id, p]));
  const byProject = {}, byWorker = {};
  rows.forEach(t => {
    const h = shiftHours(t);
    byProject[t.project_id] = (byProject[t.project_id] || 0) + h;
    const wn = t.worker?.full_name || "Worker";
    byWorker[wn] = (byWorker[wn] || 0) + h;
  });
  const total = round1(Object.values(byProject).reduce((s, h) => s + h, 0));
  const projList = Object.entries(byProject).map(([id, h]) => ({ label: projMap[id]?.street || "—", h: round1(h) })).sort((a, b) => b.h - a.h);
  const workerList = Object.entries(byWorker).map(([label, h]) => ({ label, h: round1(h) })).sort((a, b) => b.h - a.h);
  const max = Math.max(1, ...projList.map(x => x.h), ...workerList.map(x => x.h));

  const Bars = ({ title, list }) => (
    <div style={card}>
      <div style={sectionLbl}>{title}</div>
      {list.length === 0 ? <div style={{ fontSize: 12, color: "#555" }}>No hours in range.</div>
        : list.map(x => (
          <div key={x.label} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#aaa", marginBottom: 4 }}>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.label}</span>
              <span style={{ color: "#e07b39", fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, flexShrink: 0, marginLeft: 8 }}>{x.h}h</span>
            </div>
            <div style={{ height: 6, background: "#222", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(x.h / max) * 100}%`, background: "#e07b39", borderRadius: 3 }} />
            </div>
          </div>
        ))}
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={sectionLbl}>Hours report</div>
        <div style={{ display: "flex", gap: 6 }}>
          {[["week", "This week"], ["all", "All time"]].map(([k, l]) => (
            <button key={k} onClick={() => setRange(k)} style={{ padding: "6px 14px", borderRadius: 16, border: `1px solid ${range === k ? "#e07b39" : "#2a2a2a"}`, background: range === k ? "#2a1800" : "transparent", color: range === k ? "#e07b39" : "#666", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer" }}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{ ...card, textAlign: "center" }}>
        <div style={{ fontSize: 12, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Barlow Condensed, sans-serif" }}>Total labour hours {range === "week" ? "this week" : "all time"}</div>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 40, fontWeight: 700, color: "#e07b39", marginTop: 4 }}>{total}h</div>
      </div>
      <Bars title="By project" list={projList} />
      <Bars title="By worker" list={workerList} />
    </div>
  );
}

// ── Budget vs Actual (labour $ — needs pay rates) ───────────────────────────────
const money = (n) => (n || n === 0) ? `$${Math.round(Number(n)).toLocaleString()}` : "—";

function BudgetView({ timesheets, projects }) {
  const [rates, setRates] = useState(null);                       // { profileId: hourly_rate }
  const [budgets, setBudgets] = useState(() => Object.fromEntries(projects.map(p => [p.id, p.labour_budget ?? ""])));

  useEffect(() => {
    getLabourRates().then(({ data }) => setRates(Object.fromEntries((data || []).map(r => [r.profile_id, r.hourly_rate]))));
  }, []);

  // Distinct workers with their total hours (all time).
  const workers = Object.values(timesheets.reduce((acc, t) => {
    const id = t.worker_id; if (!id) return acc;
    const w = acc[id] || (acc[id] = { id, name: t.worker?.full_name || "Worker", hours: 0 });
    w.hours += shiftHours(t);
    return acc;
  }, {})).sort((a, b) => b.hours - a.hours);

  const rateOf = (id) => Number((rates || {})[id]) || 0;
  const saveRate = async (id, val) => {
    const num = val === "" ? null : Number(val);
    setRates(r => ({ ...r, [id]: num }));
    await upsertLabourRate(id, num);
  };
  const saveBudget = async (pid, val) => {
    const num = val === "" ? null : Number(val);
    setBudgets(b => ({ ...b, [pid]: val }));
    await updateProject(pid, { labour_budget: num });
  };

  // Actual labour cost per project = Σ hours × that worker's rate.
  const actualByProject = {};
  timesheets.forEach(t => { actualByProject[t.project_id] = (actualByProject[t.project_id] || 0) + shiftHours(t) * rateOf(t.worker_id); });

  const anyRates = rates && Object.values(rates).some(v => v);
  const projWithActivity = projects.filter(p => (actualByProject[p.id] || 0) > 0 || (budgets[p.id] !== "" && budgets[p.id] != null));

  return (
    <div>
      <div style={sectionLbl}>Budget vs Actual</div>
      {!anyRates && <div style={{ ...card, borderColor: "#33270a", background: "#1a1407", color: "#e0b050", fontSize: 13 }}>Set an hourly cost rate for your workers below — actual labour cost is hours × rate. Rates are internal and only visible to builder/office.</div>}

      {/* Per-project budget vs actual */}
      {projWithActivity.length === 0 ? <EmptyState icon="💰" title="No labour cost yet" subtitle="Set a labour budget on a project and cost rates on your workers" />
        : projWithActivity.map(p => {
          const actual = Math.round(actualByProject[p.id] || 0);
          const budget = Number(budgets[p.id]) || 0;
          const pct = budget > 0 ? Math.min(100, Math.round((actual / budget) * 100)) : 0;
          const over = budget > 0 && actual > budget;
          const barColor = !budget ? "#444" : over ? "#ef4444" : pct >= 85 ? "#f59e0b" : "#22c55e";
          return (
            <div key={p.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 17, color: "#f0f0f0", textTransform: "uppercase" }}>{p.street}</span>
                <span style={{ fontSize: 11, color: "#666" }}>{p.job_number || ""}</span>
              </div>
              <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: "#777", textTransform: "uppercase", letterSpacing: 0.4, fontFamily: "Barlow Condensed, sans-serif", marginBottom: 4 }}>Labour budget $</div>
                  <input type="number" defaultValue={budgets[p.id]} onBlur={e => saveBudget(p.id, e.target.value)} placeholder="0" style={inp} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: "#777", textTransform: "uppercase", letterSpacing: 0.4, fontFamily: "Barlow Condensed, sans-serif", marginBottom: 4 }}>Actual labour cost</div>
                  <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, color: over ? "#ef4444" : "#e07b39", padding: "6px 0" }}>{money(actual)}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: "#777", textTransform: "uppercase", letterSpacing: 0.4, fontFamily: "Barlow Condensed, sans-serif", marginBottom: 4 }}>{over ? "Over by" : "Remaining"}</div>
                  <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, color: over ? "#ef4444" : "#22c55e", padding: "6px 0" }}>{budget ? money(Math.abs(budget - actual)) : "—"}</div>
                </div>
              </div>
              {budget > 0 && (
                <>
                  <div style={{ height: 6, background: "#222", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 3 }} />
                  </div>
                  <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>{pct}% of budget used{over ? " · OVER BUDGET" : ""}</div>
                </>
              )}
            </div>
          );
        })}

      {/* Hourly cost rates */}
      <div style={card}>
        <div style={sectionLbl}>Hourly cost rates · internal</div>
        {rates === null ? <div style={{ height: 40, background: "#1a1a1a", borderRadius: 8 }} />
          : workers.length === 0 ? <div style={{ fontSize: 12, color: "#555" }}>No worker hours recorded yet.</div>
          : workers.map(w => (
            <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid #1a1a1a" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: "#ccc" }}>{w.name}</div>
                <div style={{ fontSize: 11, color: "#555" }}>{round1(w.hours)}h logged · {money(round1(w.hours) * rateOf(w.id))} cost</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                <span style={{ color: "#666", fontSize: 13 }}>$</span>
                <input type="number" defaultValue={(rates || {})[w.id] ?? ""} onBlur={e => saveRate(w.id, e.target.value)} placeholder="0" style={{ ...inp, width: 80, textAlign: "right" }} />
                <span style={{ color: "#666", fontSize: 12 }}>/hr</span>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

const inp = { width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#f0f0f0", fontSize: 14, padding: "9px 11px", fontFamily: "DM Sans, sans-serif", boxSizing: "border-box", colorScheme: "dark" };

// ── Hub shell ───────────────────────────────────────────────────────────────────
export default function LabourHub({ timesheets = [], projects = [], onApprove, user }) {
  const [view, setView] = useState(null);
  const [members, setMembers] = useState([]);
  const [profiles, setProfiles] = useState([]);

  useEffect(() => {
    getAllProjectMembers().then(({ data }) => setMembers(data || []));
    getProfiles().then(({ data }) => setProfiles(data || []));
  }, []);

  const pending = timesheets.filter(t => t.status === "pending").length;
  const onSiteNow = timesheets.filter(t => !t.clock_out).length;
  const weekHours = round1(timesheets.filter(t => dayKey(t) >= weekStartStr()).reduce((s, t) => s + shiftHours(t), 0));

  if (view === "timesheets") return <Wrap onBack={() => setView(null)}><TimesheetsView timesheets={timesheets} onApprove={onApprove} /></Wrap>;
  if (view === "attendance") return <Wrap onBack={() => setView(null)}><AttendanceView timesheets={timesheets} /></Wrap>;
  if (view === "allocation") return <Wrap onBack={() => setView(null)}><AllocationView timesheets={timesheets} projects={projects} members={members} profiles={profiles} /></Wrap>;
  if (view === "hours") return <Wrap onBack={() => setView(null)}><HoursView timesheets={timesheets} projects={projects} /></Wrap>;
  if (view === "budget") return <Wrap onBack={() => setView(null)}><BudgetView timesheets={timesheets} projects={projects} /></Wrap>;

  return (
    <div>
      <div style={{ ...head, marginBottom: 4 }}>LABOUR</div>
      <div style={{ fontSize: 13, color: "#555", marginBottom: 20 }}>Workforce & hours reporting{user?.name ? "" : ""}</div>
      <HubTile icon="📋" label="Timesheets" subtitle="Review & approve worker hours" badge={pending} badgeColor="#f59e0b" onClick={() => setView("timesheets")} />
      <HubTile icon="👷" label="Attendance" subtitle="Who was on site, by day & hours" onClick={() => setView("attendance")} />
      <HubTile icon="🗂" label="Labour Allocation" subtitle={`Who's on which project · ${onSiteNow} on site now`} onClick={() => setView("allocation")} />
      <HubTile icon="⏱" label="Hours Report" subtitle={`Actual hours by project & worker · ${weekHours}h this week`} onClick={() => setView("hours")} />
      <HubTile icon="💰" label="Budget vs Actual" subtitle="Labour budget vs actual cost (hours × rate)" onClick={() => setView("budget")} />
    </div>
  );
}

// Back affordance for sub-views (builder console is desktop; simple inline bar)
function Wrap({ onBack, children }) {
  return (
    <div>
      <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "transparent", border: "none", color: "#e07b39", fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, cursor: "pointer", marginBottom: 16, padding: 0 }}>‹ Labour</button>
      {children}
    </div>
  );
}
