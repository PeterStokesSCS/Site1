import { useState } from "react";
import { mockProjects, mockHazards, mockIssues, mockTimesheets, mockTasks, mockVariations } from "../../data/mockData";
import { HEALTH, TILES } from "../../lib/theme";
import { post } from "../../lib/webhook";

const TABS = [
  { id: "dashboard", label: "Dashboard",  icon: "⊞" },
  { id: "projects",  label: "Projects",   icon: "🏗" },
  { id: "schedule",  label: "Schedule",   icon: "📅" },
  { id: "labour",    label: "Labour",     icon: "👷" },
  { id: "variations",label: "Variations", icon: "±" },
  { id: "safety",    label: "Safety",     icon: "⚠️" },
  { id: "financials",label: "Financials", icon: "💰" },
  { id: "reports",   label: "Reports",    icon: "📊" },
];

function HealthDot({ health }) {
  const h = HEALTH[health] || HEALTH.green;
  return <span style={{ color: h.color, fontSize: 10 }}>●</span>;
}

function ProjectHealthCard({ project }) {
  const h = HEALTH[project.health] || HEALTH.green;
  const pct = Math.round((project.spent / project.budget) * 100);
  const openIssues = mockIssues.filter(i => i.projectId === project.id && i.status === "open").length;
  const openHazards = mockHazards.filter(h => h.projectId === project.id && h.status === "open" && h.riskLevel === "high").length;

  return (
    <div style={{ background: "#141414", border: `1px solid ${h.border}`, borderRadius: 14, padding: "18px 18px 14px", flex: "1 1 280px", minWidth: 260 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "#555", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: 1, textTransform: "uppercase" }}>{project.jobNumber}</div>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, fontWeight: 700, color: "#f0f0f0", textTransform: "uppercase", lineHeight: 1.1, marginTop: 2 }}>{project.street}</div>
          <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>{project.client}</div>
        </div>
        <div style={{ fontSize: 12, fontFamily: "Barlow Condensed, sans-serif", color: h.color, background: h.bg, border: `1px solid ${h.border}`, padding: "4px 12px", borderRadius: 20, flexShrink: 0 }}>
          ● {h.label.toUpperCase()}
        </div>
      </div>

      {/* Progress */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#666", marginBottom: 4 }}>
          <span>{project.phase}</span><span>{project.progress}%</span>
        </div>
        <div style={{ height: 4, background: "#222", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${project.progress}%`, background: "#e07b39", borderRadius: 2 }} />
        </div>
      </div>

      {/* Budget */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#666", marginBottom: 4 }}>
          <span>${project.spent.toLocaleString()} spent</span>
          <span style={{ color: pct > 90 ? "#ef4444" : "#666" }}>{pct}% of ${project.budget.toLocaleString()}</span>
        </div>
        <div style={{ height: 4, background: "#222", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: pct > 90 ? "#ef4444" : pct > 70 ? "#f59e0b" : "#22c55e", borderRadius: 2 }} />
        </div>
        {pct > 90 && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 3 }}>⚠ Overspend warning</div>}
      </div>

      {/* Alert pills */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {openIssues > 0 && <Pill label={`${openIssues} issues`} color="#f97316" bg="#251200" />}
        {openHazards > 0 && <Pill label={`${openHazards} high hazards`} color="#ef4444" bg="#2a0c0c" />}
        {mockVariations.filter(v => v.projectId === project.id && v.status === "pending").length > 0 && (
          <Pill label={`${mockVariations.filter(v => v.projectId === project.id && v.status === "pending").length} var pending`} color="#6366f1" bg="#10103a" />
        )}
      </div>
    </div>
  );
}

function Pill({ label, color, bg }) {
  return <span style={{ fontSize: 11, fontFamily: "Barlow Condensed, sans-serif", color, background: bg, padding: "3px 8px", borderRadius: 10 }}>{label}</span>;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function BuilderDashboard() {
  const activeProjects  = mockProjects.filter(p => p.status === "active").length;
  const openHazardsHigh = mockHazards.filter(h => h.status === "open" && h.riskLevel === "high").length;
  const pendingTs       = mockTimesheets.filter(t => t.status === "pending").length;
  const pendingVars     = mockVariations.filter(v => v.status === "pending").length;
  const openIssues      = mockIssues.filter(i => i.status === "open").length;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 30, fontWeight: 700, color: "#f0f0f0" }}>Company Dashboard</div>
        <div style={{ fontSize: 14, color: "#555", marginTop: 4 }}>{new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 32 }}>
        {[
          { v: activeProjects, l: "Active Projects",       c: "#e07b39" },
          { v: pendingVars,    l: "Variations Awaiting",   c: "#6366f1" },
          { v: openHazardsHigh,l: "High Risk Hazards",     c: "#ef4444" },
          { v: pendingTs,      l: "Timesheets to Approve", c: "#f59e0b" },
          { v: openIssues,     l: "Open Issues",           c: "#f97316" },
        ].map(s => (
          <div key={s.l} style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 12, padding: "16px 20px", flex: "1 1 130px", minWidth: 120 }}>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 36, fontWeight: 700, color: s.c, lineHeight: 1 }}>{s.v}</div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Project health cards */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14 }}>Project Health</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
          {mockProjects.map(p => <ProjectHealthCard key={p.id} project={p} />)}
        </div>
      </div>

      {/* Blockers */}
      <div>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14 }}>
          🚧 Active Blockers
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {mockIssues.filter(i => i.status === "open" && i.priority === "high").map(issue => {
            const proj = mockProjects.find(p => p.id === issue.projectId);
            return (
              <div key={issue.id} style={{ background: "#141414", border: "1px solid #2a0c0c", borderLeft: "4px solid #ef4444", borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 14, color: "#ccc" }}>{issue.title}</div>
                  <div style={{ fontSize: 12, color: "#555", marginTop: 3 }}>{proj?.jobNumber} · {proj?.street}</div>
                  {issue.notes && <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>{issue.notes}</div>}
                </div>
                <Pill label={issue.category} color="#ef4444" bg="#2a0c0c" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Timesheets (approvals) ────────────────────────────────────────────────────
function LabourTab() {
  const [sheets, setSheets] = useState(mockTimesheets);
  const approve = (id) => { setSheets(prev => prev.map(t => t.id === id ? { ...t, status: "approved" } : t)); post("/timesheets/approve", { id }).catch(() => {}); };
  const pending = sheets.filter(t => t.status === "pending");
  const approved = sheets.filter(t => t.status === "approved");

  return (
    <div>
      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 28, fontWeight: 700, color: "#f0f0f0", marginBottom: 20 }}>LABOUR</div>
      {pending.length > 0 && (
        <>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, color: "#f59e0b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Pending Approval ({pending.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
            {pending.map(ts => (
              <div key={ts.id} style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#222", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, color: "#888", flexShrink: 0 }}>
                  {ts.workerName.split(" ").map(n => n[0]).join("")}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#ccc" }}>{ts.workerName}</div>
                  <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>{ts.projectName} · w/e {new Date(ts.weekEnding).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</div>
                </div>
                <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, color: "#e07b39", fontWeight: 700 }}>{ts.hours}h</div>
                <button onClick={() => approve(ts.id)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#22c55e", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, cursor: "pointer" }}>APPROVE</button>
              </div>
            ))}
          </div>
        </>
      )}
      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, color: "#444", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Approved</div>
      {approved.map(ts => (
        <div key={ts.id} style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 8, padding: "10px 14px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: 0.6 }}>
          <div><span style={{ fontSize: 13, color: "#888" }}>{ts.workerName}</span><span style={{ fontSize: 12, color: "#444", marginLeft: 10 }}>{ts.projectName}</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 16, color: "#555" }}>{ts.hours}h</span>
            <span style={{ fontSize: 10, fontFamily: "Barlow Condensed, sans-serif", color: "#22c55e", background: "#06200e", padding: "2px 8px", borderRadius: 4 }}>APPROVED</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Placeholder tabs ──────────────────────────────────────────────────────────
function PlaceholderTab({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "#444" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, marginBottom: 8 }}>{label}</div>
        <div style={{ fontSize: 13 }}>Coming next</div>
      </div>
    </div>
  );
}

// ── Builder shell ─────────────────────────────────────────────────────────────
export default function BuilderApp({ user }) {
  const [tab, setTab] = useState("dashboard");

  const renderTab = () => {
    switch (tab) {
      case "dashboard":  return <BuilderDashboard />;
      case "labour":     return <LabourTab />;
      default:           return <PlaceholderTab label={TABS.find(t => t.id === tab)?.label} />;
    }
  };

  return (
    <div style={{ display: "flex", height: "100dvh", background: "#0c0c0c", overflow: "hidden" }}>
      {/* Sidebar */}
      <aside style={{ width: 220, background: "#111", borderRight: "1px solid #1e1e1e", display: "flex", flexDirection: "column", flexShrink: 0 }} className="builder-sidebar">
        <div style={{ padding: "20px 20px 14px", borderBottom: "1px solid #1e1e1e" }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#f0f0f0" }}>
            <span style={{ color: "#e07b39" }}>SCS</span> BuildHub
          </div>
          <div style={{ fontSize: 11, color: "#444", letterSpacing: 0.5, marginTop: 2 }}>BUILDER CONSOLE</div>
        </div>
        <nav style={{ flex: 1, padding: "10px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: "flex", alignItems: "center", gap: 11, padding: "10px 14px",
              border: "none", borderRadius: 8, borderLeft: `3px solid ${tab === t.id ? "#e07b39" : "transparent"}`,
              background: tab === t.id ? "#1e1e1e" : "transparent",
              color: tab === t.id ? "#e07b39" : "#666",
              cursor: "pointer", textAlign: "left", width: "100%",
              fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, letterSpacing: 0.3, textTransform: "uppercase",
              transition: "all 0.12s",
            }}>
              <span style={{ fontSize: 16 }}>{t.icon}</span>{t.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: "12px 16px", borderTop: "1px solid #1e1e1e", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#e07b39", color: "#0c0c0c", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Barlow Condensed, sans-serif", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{user.avatar}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#ccc" }}>{user.name}</div>
            <div style={{ fontSize: 11, color: "#555" }}>Builder / Admin</div>
          </div>
        </div>
      </aside>

      {/* Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <header style={{ background: "#111", borderBottom: "1px solid #1e1e1e", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }} className="builder-topbar">
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: 1 }}><span style={{ color: "#e07b39" }}>SCS</span> BuildHub</div>
          <div style={{ fontSize: 13, color: "#666" }}>{user.name}</div>
        </header>
        <main style={{ flex: 1, overflowY: "auto", padding: "24px" }}>{renderTab()}</main>
        <nav style={{ background: "#111", borderTop: "1px solid #1e1e1e", display: "flex" }} className="builder-bottomnav">
          {TABS.slice(0, 5).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 4px 12px", border: "none", background: "transparent", color: tab === t.id ? "#e07b39" : "#555", borderTop: tab === t.id ? "2px solid #e07b39" : "2px solid transparent", cursor: "pointer" }}>
              <span style={{ fontSize: 17 }}>{t.icon}</span>
              <span style={{ fontSize: 9, marginTop: 3, fontFamily: "Barlow Condensed, sans-serif", letterSpacing: 0.3, textTransform: "uppercase" }}>{t.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <style>{`
        @media (min-width: 768px) { .builder-topbar { display: none !important; } .builder-bottomnav { display: none !important; } .builder-sidebar { display: flex !important; } }
        @media (max-width: 767px) { .builder-sidebar { display: none !important; } .builder-topbar { display: flex !important; } .builder-bottomnav { display: flex !important; } }
      `}</style>
    </div>
  );
}
