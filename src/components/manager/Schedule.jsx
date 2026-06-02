import { useState } from "react";
import { mockShifts, mockWorkers, mockProjects, mockTimesheets } from "../../data/mockData";
import { post } from "../../lib/webhook";

const PROJECT_COLORS = ["#e07b39", "#3498db", "#27ae60", "#9b59b6"];

function getWeekDates(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function ShiftCell({ shift, projectColor }) {
  if (!shift) return <div style={{ height: "100%", background: "transparent" }} />;
  const project = mockProjects.find(p => p.id === shift.projectId);
  return (
    <div style={{
      background: `${projectColor}22`,
      border: `1px solid ${projectColor}44`,
      borderRadius: 6,
      padding: "4px 6px",
      fontSize: 11,
      color: projectColor,
      lineHeight: 1.3,
    }}>
      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 600, fontSize: 12 }}>{project?.name.split(" ")[0]}</div>
      <div style={{ opacity: 0.8 }}>{shift.start}–{shift.end}</div>
    </div>
  );
}

function WeeklySchedule({ weekOffset, setWeekOffset }) {
  const days = getWeekDates(weekOffset);
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const today = isoDate(new Date());

  return (
    <div>
      {/* Week navigation */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={() => setWeekOffset(w => w - 1)} style={navBtn}>‹</button>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, color: "#ccc", minWidth: 200, textAlign: "center" }}>
          {days[0].toLocaleDateString("en-AU", { day: "numeric", month: "short" })} — {days[6].toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
        </div>
        <button onClick={() => setWeekOffset(w => w + 1)} style={navBtn}>›</button>
        {weekOffset !== 0 && (
          <button onClick={() => setWeekOffset(0)} style={{ ...navBtn, fontSize: 12, padding: "6px 12px", color: "#e07b39", borderColor: "#e07b39" }}>Today</button>
        )}
      </div>

      {/* Project legend */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        {mockProjects.map((p, i) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: PROJECT_COLORS[i % PROJECT_COLORS.length] }} />
            <span style={{ fontSize: 12, color: "#666" }}>{p.name}</span>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
          <thead>
            <tr>
              <th style={{ width: 120, textAlign: "left", padding: "8px 10px", fontSize: 12, color: "#555", fontWeight: 400, borderBottom: "1px solid #1e1e1e" }}>Worker</th>
              {days.map((d, i) => {
                const isToday = isoDate(d) === today;
                return (
                  <th key={i} style={{
                    padding: "8px 6px", textAlign: "center", fontSize: 12, fontWeight: 400,
                    color: isToday ? "#e07b39" : "#555",
                    borderBottom: `2px solid ${isToday ? "#e07b39" : "#1e1e1e"}`,
                    minWidth: 72,
                  }}>
                    <div>{dayLabels[i]}</div>
                    <div style={{ fontSize: 13, fontWeight: isToday ? 700 : 400, color: isToday ? "#e07b39" : "#888", marginTop: 2 }}>
                      {d.getDate()}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {mockWorkers.map(worker => (
              <tr key={worker.id}>
                <td style={{ padding: "8px 10px", borderBottom: "1px solid #1a1a1a" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%", background: "#2a2a2a",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontFamily: "Barlow Condensed, sans-serif", color: "#888", flexShrink: 0,
                    }}>
                      {worker.avatar}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, color: "#ccc" }}>{worker.name.split(" ")[0]}</div>
                      <div style={{ fontSize: 11, color: "#555" }}>{worker.trade}</div>
                    </div>
                  </div>
                </td>
                {days.map((d, di) => {
                  const dateStr = isoDate(d);
                  const shift = mockShifts.find(s => s.workerId === worker.id && s.date === dateStr);
                  const projIdx = shift ? mockProjects.findIndex(p => p.id === shift.projectId) : -1;
                  return (
                    <td key={di} style={{ padding: "5px 4px", borderBottom: "1px solid #1a1a1a", verticalAlign: "top" }}>
                      <ShiftCell shift={shift} projectColor={projIdx >= 0 ? PROJECT_COLORS[projIdx % PROJECT_COLORS.length] : "#555"} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Timesheet list ────────────────────────────────────────────────────────────
function TimesheetList() {
  const [sheets, setSheets] = useState(mockTimesheets);

  const approve = async (id) => {
    setSheets(prev => prev.map(ts => ts.id === id ? { ...ts, status: "approved" } : ts));
    post("/timesheets/approve", { id }).catch(() => {});
  };

  const approveAll = () => {
    const pendingIds = sheets.filter(ts => ts.status === "pending").map(ts => ts.id);
    setSheets(prev => prev.map(ts => ts.status === "pending" ? { ...ts, status: "approved" } : ts));
    pendingIds.forEach(id => post("/timesheets/approve", { id }).catch(() => {}));
  };

  const pending = sheets.filter(ts => ts.status === "pending");
  const approved = sheets.filter(ts => ts.status === "approved");

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 18, color: "#888", letterSpacing: 0.5, textTransform: "uppercase" }}>
          Timesheets — {pending.length} pending
        </div>
        {pending.length > 1 && (
          <button onClick={approveAll} style={{
            padding: "8px 16px", borderRadius: 8, border: "none",
            background: "#27ae60", color: "#fff", fontFamily: "Barlow Condensed, sans-serif",
            fontSize: 14, cursor: "pointer",
          }}>
            APPROVE ALL ({pending.length})
          </button>
        )}
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {pending.map(ts => (
            <div key={ts.id} style={{
              background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10,
              padding: "14px 16px", display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: "50%", background: "#222",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, color: "#888", flexShrink: 0,
              }}>
                {ts.workerName.split(" ").map(n => n[0]).join("")}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#ccc" }}>{ts.workerName}</div>
                <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>
                  {ts.projectName} · w/e {new Date(ts.weekEnding).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                </div>
              </div>
              <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 24, color: "#e07b39", fontWeight: 700, flexShrink: 0 }}>
                {ts.hours}h
              </div>
              <button
                onClick={() => approve(ts.id)}
                style={{
                  padding: "8px 16px", borderRadius: 8, border: "none",
                  background: "#27ae60", color: "#fff", fontFamily: "Barlow Condensed, sans-serif",
                  fontSize: 14, cursor: "pointer", flexShrink: 0,
                }}
              >
                APPROVE
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Approved */}
      {approved.length > 0 && (
        <div>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, color: "#444", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>Approved</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {approved.map(ts => (
              <div key={ts.id} style={{
                background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 8,
                padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", opacity: 0.7,
              }}>
                <div>
                  <span style={{ fontSize: 13, color: "#888" }}>{ts.workerName}</span>
                  <span style={{ fontSize: 12, color: "#444", marginLeft: 10 }}>{ts.projectName}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 16, color: "#555" }}>{ts.hours}h</span>
                  <span style={{ fontSize: 11, fontFamily: "Barlow Condensed, sans-serif", color: "#27ae60", background: "#0f2a0f", padding: "2px 8px", borderRadius: 4 }}>APPROVED</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Schedule main view ────────────────────────────────────────────────────────
export default function Schedule() {
  const [weekOffset, setWeekOffset] = useState(0);

  return (
    <div>
      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 28, fontWeight: 700, color: "#f0f0f0", marginBottom: 24 }}>
        SCHEDULE & TIMESHEETS
      </div>

      <section style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 14, padding: "20px", marginBottom: 28 }}>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 16, color: "#888", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 16 }}>
          Weekly Schedule
        </div>
        <WeeklySchedule weekOffset={weekOffset} setWeekOffset={setWeekOffset} />
      </section>

      <section style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 14, padding: "20px" }}>
        <TimesheetList />
      </section>
    </div>
  );
}

const navBtn = {
  padding: "6px 14px", borderRadius: 6, border: "1px solid #2a2a2a",
  background: "transparent", color: "#888", cursor: "pointer", fontSize: 18, lineHeight: 1,
  transition: "all 0.15s",
};
