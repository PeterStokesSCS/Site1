import { useState, useEffect } from "react";
import BackHeader from "../shared/BackHeader";
import { EmptyState } from "../shared/LoadingScreen";
import ActionQueue, { useActionItems } from "../shared/ActionQueue";
import { getMyTasks, getMyTimesheets } from "../../lib/db";

const card = { background: "#141414", border: "1px solid #1e1e1e", borderRadius: 12, padding: 14, marginBottom: 14 };
const head = { fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 };

const TODAY = new Date().toISOString().slice(0, 10);
const fmtDate = (d) => d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" }) : "—";
const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true }) : "--";

// Monday-start week containing `now`, as an ISO date string (local).
function weekStartStr(now = new Date()) {
  const d = new Date(now);
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}
const shiftHours = (t) => {
  if (t.hours_worked != null) return t.hours_worked;
  if (t.clock_in && t.clock_out) return Math.round(((new Date(t.clock_out) - new Date(t.clock_in)) / 3600000) * 10) / 10;
  return 0;
};

const PRIO = {
  4: { c: "#ef4444", label: "URGENT" }, urgent: { c: "#ef4444", label: "URGENT" },
  high: { c: "#ef4444", label: "HIGH" }, 3: { c: "#ef4444", label: "HIGH" },
  medium: { c: "#f59e0b", label: "MED" }, 2: { c: "#f59e0b", label: "MED" },
  low: { c: "#888", label: "LOW" }, 1: { c: "#888", label: "LOW" },
};

export default function SupervisorDashboard({ user, projects = [], onBack, onOpenAction }) {
  const { items: actionItems } = useActionItems("supervisor", user.id);
  const [tasks, setTasks] = useState(null);
  const [sheets, setSheets] = useState(null);

  useEffect(() => {
    getMyTasks(user.id).then(({ data }) => setTasks(data));
    getMyTimesheets(user.id).then(({ data }) => setSheets(data));
  }, [user.id]);

  // Group my open tasks into overdue / today / upcoming
  const groups = { overdue: [], today: [], upcoming: [] };
  (tasks || []).forEach(t => {
    const d = t.due_date ? String(t.due_date).slice(0, 10) : null;
    if (d && d < TODAY) groups.overdue.push(t);
    else if (d === TODAY) groups.today.push(t);
    else groups.upcoming.push(t);
  });

  const ws = weekStartStr();
  const weekHours = (sheets || [])
    .filter(t => t.clock_in && t.clock_in.slice(0, 10) >= ws)
    .reduce((s, t) => s + shiftHours(t), 0);
  const openShift = (sheets || []).find(t => !t.clock_out);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="My Dashboard" subtitle={user.name || "Supervisor"} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px", maxWidth: 480, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>

        {/* Outstanding actions across all my projects (also surfaces inspections + notifications) */}
        <ActionQueue items={actionItems} title="Outstanding actions" max={12} onOpen={onOpenAction} allClear="You're all caught up across your projects" />

        {/* My timesheets */}
        <div style={card}>
          <div style={head}>My time</div>
          <div style={{ display: "flex", gap: 10, marginBottom: (sheets && sheets.length) ? 12 : 0 }}>
            <div style={{ flex: 1, background: "#101010", borderRadius: 9, padding: "10px 12px" }}>
              <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, color: "#e07b39" }}>{Math.round(weekHours * 10) / 10}h</div>
              <div style={{ fontSize: 11, color: "#666" }}>This week</div>
            </div>
            <div style={{ flex: 1, background: "#101010", borderRadius: 9, padding: "10px 12px" }}>
              <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, color: openShift ? "#22c55e" : "#555" }}>{openShift ? "ON" : "OFF"}</div>
              <div style={{ fontSize: 11, color: "#666" }}>{openShift ? `Since ${fmtTime(openShift.clock_in)}` : "Not clocked in"}</div>
            </div>
          </div>
          {sheets === null ? <div style={{ height: 36, background: "#1a1a1a", borderRadius: 8 }} />
            : sheets.length === 0 ? <div style={{ fontSize: 12, color: "#555" }}>No timesheets recorded yet.</div>
            : sheets.slice(0, 6).map(t => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #1a1a1a" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "#ccc" }}>{fmtDate(t.clock_in)}</div>
                  <div style={{ fontSize: 11, color: "#555", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.project?.street || "—"} · {fmtTime(t.clock_in)}–{t.clock_out ? fmtTime(t.clock_out) : "now"}</div>
                </div>
                <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, color: t.clock_out ? "#999" : "#22c55e", flexShrink: 0, marginLeft: 10 }}>{t.clock_out ? `${shiftHours(t)}h` : "open"}</div>
              </div>
            ))}
        </div>

        {/* My assigned tasks across all projects */}
        <div style={card}>
          <div style={head}>My tasks{tasks ? ` · ${tasks.length}` : ""}</div>
          {tasks === null ? <div style={{ height: 40, background: "#1a1a1a", borderRadius: 8 }} />
            : tasks.length === 0 ? <EmptyState icon="✅" title="No open tasks assigned to you" subtitle="Tasks assigned to you across all projects appear here" />
            : [
                { key: "overdue", label: "Overdue", color: "#ef4444" },
                { key: "today", label: "Due today", color: "#f59e0b" },
                { key: "upcoming", label: "Upcoming", color: "#666" },
              ].filter(s => groups[s.key].length).map(s => (
                <div key={s.key} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, fontFamily: "Barlow Condensed, sans-serif", letterSpacing: 0.5, textTransform: "uppercase", color: s.color, marginBottom: 6 }}>{s.label} · {groups[s.key].length}</div>
                  {groups[s.key].map(t => {
                    const p = PRIO[t.priority] || null;
                    return (
                      <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #1a1a1a" }}>
                        <div style={{ width: 4, alignSelf: "stretch", minHeight: 26, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: "#e0e0e0", lineHeight: 1.3 }}>{t.title}</div>
                          <div style={{ fontSize: 11, color: "#555" }}>{t.projects?.street || "—"} · {fmtDate(t.due_date)}{t.due_time ? ` ${t.due_time.slice(0, 5)}` : ""}</div>
                        </div>
                        {p && <span style={{ fontSize: 9, fontFamily: "Barlow Condensed, sans-serif", color: p.c, border: `1px solid ${p.c}55`, padding: "2px 6px", borderRadius: 4, flexShrink: 0 }}>{p.label}</span>}
                      </div>
                    );
                  })}
                </div>
              ))}
        </div>

      </div>
    </div>
  );
}
