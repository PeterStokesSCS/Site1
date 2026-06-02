import { mockProjects, mockHazards, mockTimesheets, mockTasks, mockMaterialRequests } from "../../data/mockData";

function StatCard({ value, label, sub, color = "#e07b39", onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "#141414",
        border: "1px solid #1e1e1e",
        borderRadius: 12,
        padding: "18px 20px",
        textAlign: "left",
        cursor: onClick ? "pointer" : "default",
        flex: "1 1 140px",
        minWidth: 130,
        transition: "border-color 0.15s",
        WebkitTapHighlightColor: "transparent",
      }}
      onMouseEnter={e => onClick && (e.currentTarget.style.borderColor = "#333")}
      onMouseLeave={e => onClick && (e.currentTarget.style.borderColor = "#1e1e1e")}
    >
      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 38, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#ccc", marginTop: 6 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "#555", marginTop: 3 }}>{sub}</div>}
    </button>
  );
}

function BudgetBar({ project }) {
  const pct = Math.round((project.spent / project.budget) * 100);
  const over = pct > 90;
  const warn = pct > 70;
  const color = over ? "#c0392b" : warn ? "#e07b39" : "#27ae60";
  return (
    <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#ccc" }}>{project.name}</span>
        <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, color: over ? "#c0392b" : "#888" }}>
          ${project.spent.toLocaleString()} / ${project.budget.toLocaleString()}
        </span>
      </div>
      <div style={{ height: 6, background: "#222", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 3, transition: "width 0.4s" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
        <span style={{ fontSize: 11, color: "#555" }}>{project.phase}</span>
        <span style={{ fontSize: 11, color: over ? "#c0392b" : "#555" }}>{pct}% spent{over ? " — OVERSPEND WARNING" : ""}</span>
      </div>
    </div>
  );
}

const RISK_COLOR = { high: "#c0392b", medium: "#e07b39", low: "#27ae60" };
const RISK_BG = { high: "#2a1010", medium: "#2a1800", low: "#0f2a0f" };

export default function Dashboard({ onNavigate }) {
  const activeProjects = mockProjects.filter(p => p.status === "active").length;
  const openHazards = mockHazards.filter(h => h.status === "open").length;
  const highHazards = mockHazards.filter(h => h.status === "open" && h.riskLevel === "high").length;
  const pendingTimesheets = mockTimesheets.filter(t => t.status === "pending").length;
  const pendingTasks = mockTasks.filter(t => !t.done).length;
  const pendingMaterials = mockMaterialRequests.filter(r => r.status === "pending").length;

  const recentHazards = [...mockHazards]
    .filter(h => h.status === "open")
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 3);

  const pendingTs = mockTimesheets.filter(t => t.status === "pending");

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 28, fontWeight: 700, color: "#f0f0f0", letterSpacing: 0.5 }}>
          Good morning, Pete.
        </div>
        <div style={{ fontSize: 14, color: "#555", marginTop: 4 }}>
          {new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 28 }}>
        <StatCard value={activeProjects} label="Active Projects" sub="1 in planning" onClick={() => onNavigate("projects")} />
        <StatCard value={openHazards} label="Open Hazards" sub={highHazards > 0 ? `${highHazards} HIGH RISK` : "None critical"} color={highHazards > 0 ? "#c0392b" : "#e07b39"} onClick={() => onNavigate("safety")} />
        <StatCard value={pendingTimesheets} label="Pending Timesheets" sub="Awaiting approval" onClick={() => onNavigate("schedule")} />
        <StatCard value={pendingTasks} label="Open Tasks" sub="Across all projects" onClick={() => onNavigate("projects")} />
      </div>

      {/* Budget overview */}
      <section style={{ marginBottom: 28 }}>
        <SectionHeader title="Budget Overview" action="View Projects" onAction={() => onNavigate("projects")} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {mockProjects.map(p => <BudgetBar key={p.id} project={p} />)}
        </div>
      </section>

      {/* Open hazards */}
      {recentHazards.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <SectionHeader title="Open Hazards" action="View All" onAction={() => onNavigate("safety")} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recentHazards.map(h => (
              <div key={h.id} style={{
                background: "#141414",
                border: "1px solid #1e1e1e",
                borderLeft: `4px solid ${RISK_COLOR[h.riskLevel]}`,
                borderRadius: 10,
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#ccc" }}>{h.title}</div>
                  <div style={{ fontSize: 12, color: "#555", marginTop: 3 }}>{h.category} · {mockProjects.find(p => p.id === h.projectId)?.name}</div>
                </div>
                <span style={{
                  fontSize: 11, fontFamily: "Barlow Condensed, sans-serif", letterSpacing: 0.5,
                  textTransform: "uppercase", color: RISK_COLOR[h.riskLevel],
                  background: RISK_BG[h.riskLevel], padding: "3px 8px", borderRadius: 4, flexShrink: 0,
                }}>
                  {h.riskLevel}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pending timesheets */}
      {pendingTs.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <SectionHeader title="Pending Timesheets" action="Approve All" onAction={() => onNavigate("schedule")} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pendingTs.map(ts => (
              <div key={ts.id} style={{
                background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10,
                padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#ccc" }}>{ts.workerName}</div>
                  <div style={{ fontSize: 12, color: "#555", marginTop: 3 }}>{ts.projectName} · w/e {new Date(ts.weekEnding).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</div>
                </div>
                <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 20, color: "#e07b39", fontWeight: 700 }}>{ts.hours}h</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Material requests */}
      {pendingMaterials > 0 && (
        <div style={{
          background: "#1a1800",
          border: "1px solid #3a3000",
          borderRadius: 10,
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#ccc" }}>{pendingMaterials} material request{pendingMaterials !== 1 ? "s" : ""} pending</div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>Review and order from Projects tab</div>
          </div>
          <span style={{ fontSize: 20 }}>🧱</span>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, action, onAction }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 16, fontWeight: 700, color: "#888", letterSpacing: 0.5, textTransform: "uppercase" }}>{title}</div>
      {action && <button onClick={onAction} style={{ background: "none", border: "none", color: "#e07b39", fontSize: 13, cursor: "pointer", padding: 0 }}>{action} →</button>}
    </div>
  );
}
