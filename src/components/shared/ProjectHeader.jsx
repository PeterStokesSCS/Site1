import { useState } from "react";
import { HEALTH } from "../../lib/theme";

// Real Supabase rows use snake_case (job_number); legacy/mock used camelCase (jobNumber).
const jobNumberOf = (p) => p.job_number ?? p.jobNumber;

export default function ProjectHeader({ project, projects = [], onSwitch, user, rightSlot }) {
  const [showPicker, setShowPicker] = useState(false);
  const health = HEALTH[project.health] || HEALTH.green;
  const switchList = projects.length ? projects : [project];
  const jobNumber = jobNumberOf(project);

  return (
    <>
      <div style={{
        background: "#111",
        borderBottom: "1px solid #1e1e1e",
        padding: "14px 16px 12px",
        flexShrink: 0,
      }}>
        {/* Top row — logo + user */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#f0f0f0" }}>
            <span style={{ color: "#e07b39" }}>SCS</span> BuildHub
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {rightSlot}
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "#e07b39", color: "#0c0c0c",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "Barlow Condensed, sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 1,
            }}>
              {user.avatar}
            </div>
          </div>
        </div>

        {/* Project identity */}
        <button
          onClick={() => onSwitch && setShowPicker(true)}
          style={{
            width: "100%", textAlign: "left", background: "transparent", border: "none",
            cursor: onSwitch ? "pointer" : "default", padding: 0,
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {jobNumber && (
            <div style={{ fontSize: 11, color: "#555", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>
              JOB {jobNumber}
            </div>
          )}
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 28, fontWeight: 700, color: "#f0f0f0", textTransform: "uppercase", letterSpacing: 0.5, lineHeight: 1.1 }}>
            {project.street}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 13, color: "#555" }}>{project.suburb}</span>
            <div style={{
              fontSize: 10, fontFamily: "Barlow Condensed, sans-serif", letterSpacing: 0.5,
              textTransform: "uppercase", color: health.color, background: health.bg,
              border: `1px solid ${health.border}`,
              padding: "2px 8px", borderRadius: 10,
              display: "flex", alignItems: "center", gap: 4,
            }}>
              <span style={{ fontSize: 8 }}>●</span> {health.label}
            </div>
            {onSwitch && <span style={{ color: "#444", fontSize: 12 }}>▾</span>}
          </div>
        </button>
      </div>

      {/* Project switcher modal */}
      {showPicker && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 200, display: "flex", alignItems: "flex-end" }}
          onClick={() => setShowPicker(false)}
        >
          <div style={{ background: "#141414", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 16px 32px" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 16 }}>Switch Project</div>
            {switchList.map(p => {
              const h = HEALTH[p.health] || HEALTH.green;
              return (
                <button
                  key={p.id}
                  onClick={() => { onSwitch(p.id); setShowPicker(false); }}
                  style={{
                    width: "100%", textAlign: "left", background: p.id === project.id ? "#1e1e1e" : "transparent",
                    border: "none", borderRadius: 12, padding: "12px 14px", cursor: "pointer", marginBottom: 6,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 10, color: "#555", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: 1, textTransform: "uppercase" }}>{jobNumberOf(p)}</div>
                    <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 18, fontWeight: 700, color: "#f0f0f0", textTransform: "uppercase" }}>{p.street}</div>
                    <div style={{ fontSize: 12, color: "#555" }}>{p.suburb}</div>
                  </div>
                  <div style={{ fontSize: 10, fontFamily: "Barlow Condensed, sans-serif", color: h.color, background: h.bg, border: `1px solid ${h.border}`, padding: "3px 10px", borderRadius: 10 }}>
                    ● {h.label}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
