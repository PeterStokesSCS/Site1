import { useState } from "react";

const currentRole = new URLSearchParams(window.location.search).get("role") || "builder";

const ROLES = [
  { id: "builder",       label: "Builder",       icon: "🏗" },
  { id: "supervisor",    label: "Supervisor",     icon: "📋" },
  { id: "worker",        label: "Worker",         icon: "🔨" },
  { id: "subcontractor", label: "Subcontractor",  icon: "🦺" },
  { id: "client",        label: "Client",         icon: "👤" },
  { id: "office",        label: "Office Admin",   icon: "💼" },
];


export default function DevSwitcher() {
  const [open, setOpen] = useState(false);

  const switchTo = (role) => {
    const url = new URL(window.location.href);
    url.searchParams.set("role", role);
    window.location.href = url.toString();
  };

  return (
    <div style={{ position: "fixed", bottom: 80, right: 14, zIndex: 9999 }}>
      {open && (
        <>
          {/* Backdrop */}
          <div
            style={{ position: "fixed", inset: 0, zIndex: -1 }}
            onClick={() => setOpen(false)}
          />
          {/* Panel */}
          <div style={{
            position: "absolute",
            bottom: 48,
            right: 0,
            background: "#161616",
            border: "1px solid #2a2a2a",
            borderRadius: 14,
            padding: "10px 8px",
            minWidth: 180,
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          }}>
            <div style={{
              fontFamily: "Barlow Condensed, sans-serif",
              fontSize: 10,
              color: "#444",
              textTransform: "uppercase",
              letterSpacing: 1,
              padding: "2px 8px 8px",
            }}>
              Switch Role
            </div>
            {ROLES.map(r => (
              <button
                key={r.id}
                onClick={() => switchTo(r.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "9px 10px",
                  border: "none",
                  borderRadius: 8,
                  background: currentRole === r.id ? "#2a1800" : "transparent",
                  color: currentRole === r.id ? "#e07b39" : "#888",
                  fontFamily: "Barlow Condensed, sans-serif",
                  fontSize: 14,
                  letterSpacing: 0.3,
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "background 0.1s",
                }}
                onMouseEnter={e => { if (currentRole !== r.id) e.currentTarget.style.background = "#1e1e1e"; }}
                onMouseLeave={e => { if (currentRole !== r.id) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ fontSize: 16 }}>{r.icon}</span>
                {r.label}
                {currentRole === r.id && (
                  <span style={{ marginLeft: "auto", fontSize: 10, color: "#e07b39" }}>✓</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Switch role"
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: open ? "#e07b39" : "#1e1e1e",
          border: "1px solid #2a2a2a",
          color: open ? "#fff" : "#888",
          fontSize: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 2px 12px rgba(0,0,0,0.5)",
          transition: "background 0.15s",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {open ? "✕" : "⇄"}
      </button>
    </div>
  );
}
