import { useState } from "react";
import Dashboard from "./Dashboard";
import Projects from "./Projects";
import Safety from "./Safety";
import Schedule from "./Schedule";
import ClientPortal from "./ClientPortal";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: "⊞" },
  { id: "projects", label: "Projects", icon: "◻" },
  { id: "safety", label: "Safety", icon: "⚠" },
  { id: "schedule", label: "Schedule", icon: "⋮⋮" },
  { id: "clients", label: "Clients", icon: "◎" },
];

export default function ManagerApp({ user }) {
  const [tab, setTab] = useState("dashboard");

  const renderTab = () => {
    switch (tab) {
      case "dashboard": return <Dashboard onNavigate={setTab} />;
      case "projects": return <Projects />;
      case "safety": return <Safety />;
      case "schedule": return <Schedule />;
      case "clients": return <ClientPortal />;
      default: return null;
    }
  };

  return (
    <div style={{ display: "flex", height: "100dvh", background: "#0f0f0f", overflow: "hidden" }}>
      {/* Sidebar — desktop */}
      <aside style={{
        width: 220,
        background: "#111",
        borderRight: "1px solid #1e1e1e",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }} className="manager-sidebar">
        {/* Logo */}
        <div style={{ padding: "22px 20px 16px", borderBottom: "1px solid #1e1e1e" }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 24, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>
            <span style={{ color: "#e07b39" }}>Build</span>Safe Pro
          </div>
          <div style={{ fontSize: 11, color: "#444", letterSpacing: 0.5, marginTop: 2 }}>MANAGEMENT CONSOLE</div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "11px 14px",
                border: "none",
                borderRadius: 8,
                background: tab === t.id ? "#1e1e1e" : "transparent",
                color: tab === t.id ? "#e07b39" : "#666",
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
                fontFamily: "Barlow Condensed, sans-serif",
                fontSize: 16,
                letterSpacing: 0.5,
                textTransform: "uppercase",
                transition: "all 0.15s",
                borderLeft: tab === t.id ? "3px solid #e07b39" : "3px solid transparent",
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1, opacity: tab === t.id ? 1 : 0.6 }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>

        {/* User */}
        <div style={{ padding: "14px 16px", borderTop: "1px solid #1e1e1e", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: "50%",
            background: "#e07b39", color: "#0f0f0f",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: 1,
            flexShrink: 0,
          }}>
            {user.avatar}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#ccc" }}>{user.name}</div>
            <div style={{ fontSize: 11, color: "#555", textTransform: "capitalize" }}>Manager</div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top bar — mobile only */}
        <header style={{
          background: "#111",
          borderBottom: "1px solid #1e1e1e",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }} className="manager-topbar">
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: 1 }}>
            <span style={{ color: "#e07b39" }}>Build</span>Safe Pro
          </div>
          <div style={{ fontSize: 13, color: "#666" }}>{user.name}</div>
        </header>

        {/* Content */}
        <main style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          {renderTab()}
        </main>

        {/* Bottom nav — mobile only */}
        <nav style={{
          background: "#111",
          borderTop: "1px solid #1e1e1e",
          display: "flex",
        }} className="manager-bottomnav">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "10px 4px 12px",
                border: "none",
                background: "transparent",
                color: tab === t.id ? "#e07b39" : "#555",
                cursor: "pointer",
                borderTop: tab === t.id ? "2px solid #e07b39" : "2px solid transparent",
                transition: "color 0.15s",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <span style={{ fontSize: 18 }}>{t.icon}</span>
              <span style={{ fontSize: 9, marginTop: 3, fontFamily: "Barlow Condensed, sans-serif", letterSpacing: 0.5, textTransform: "uppercase" }}>{t.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .manager-topbar { display: none !important; }
          .manager-bottomnav { display: none !important; }
          .manager-sidebar { display: flex !important; }
        }
        @media (max-width: 767px) {
          .manager-sidebar { display: none !important; }
          .manager-topbar { display: flex !important; }
          .manager-bottomnav { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
