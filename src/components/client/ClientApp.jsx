import { useState } from "react";
import AppTile from "../shared/AppTile";
import BackHeader from "../shared/BackHeader";
import { TILES } from "../../lib/theme";
import { mockProjects, mockDocuments, mockMessages, mockVariations } from "../../data/mockData";

const PROJECT_KEY = "scs_client_project";

function MilestoneBar({ milestones }) {
  const done = milestones.filter(m => m.done).length;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 0, padding: "4px 0" }}>
      {milestones.map((m, i) => {
        const past = m.done;
        const current = !m.done && i === done;
        return (
          <div key={m.name} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
            {i > 0 && <div style={{ position: "absolute", top: 13, right: "50%", left: "-50%", height: 2, background: past ? "#e07b39" : "#222", zIndex: 0 }} />}
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: past ? "#e07b39" : current ? "#1e1e1e" : "#141414", border: `2px solid ${past ? "#e07b39" : current ? "#e07b39" : "#2a2a2a"}`, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1, position: "relative" }}>
              {past ? <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>✓</span> : <div style={{ width: 8, height: 8, borderRadius: "50%", background: current ? "#e07b39" : "#2a2a2a" }} />}
            </div>
            <div style={{ fontSize: 8, fontFamily: "Barlow Condensed, sans-serif", textTransform: "uppercase", color: past ? "#e07b39" : "#444", marginTop: 5, textAlign: "center", maxWidth: 44, lineHeight: 1.2 }}>{m.name}</div>
          </div>
        );
      })}
    </div>
  );
}

function ProgressScreen({ project, onBack }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Progress" subtitle={project.street} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 14, padding: "20px", marginBottom: 16 }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 72, fontWeight: 700, color: "#e07b39", lineHeight: 1 }}>{project.progress}%</div>
            <div style={{ fontSize: 14, color: "#888", marginTop: 4 }}>Overall completion</div>
          </div>
          <div style={{ height: 10, background: "#222", borderRadius: 5, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ height: "100%", width: `${project.progress}%`, background: "#e07b39", borderRadius: 5, transition: "width 0.5s" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#666", marginBottom: 20 }}>
            <span>Current stage: <strong style={{ color: "#ccc" }}>{project.phase}</strong></span>
          </div>
          <MilestoneBar milestones={project.milestones} />
        </div>
        <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 12, padding: "16px" }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Milestone Detail</div>
          {project.milestones.map((m, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: "1px solid #1a1a1a" }}>
              <span style={{ color: m.done ? "#e07b39" : "#333", fontSize: 16, flexShrink: 0 }}>{m.done ? "✓" : "○"}</span>
              <span style={{ fontSize: 14, color: m.done ? "#ccc" : "#444", flex: 1 }}>{m.name}</span>
              {m.done && m.date && <span style={{ fontSize: 12, color: "#555" }}>{new Date(m.date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DocumentsScreen({ project, onBack }) {
  const docs = mockDocuments.filter(d => d.projectId === project.id && d.current);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Documents" subtitle={project.street} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {docs.map(doc => (
          <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 24 }}>📄</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: "#ccc" }}>{doc.name}</div>
              <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{doc.category} · {new Date(doc.date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</div>
            </div>
            <span style={{ color: "#3b82f6", fontSize: 18, cursor: "pointer" }}>↓</span>
          </div>
        ))}
        {docs.length === 0 && <div style={{ textAlign: "center", color: "#444", padding: "40px 0", fontSize: 14 }}>No documents available</div>}
      </div>
    </div>
  );
}

function VariationsScreen({ project, onBack }) {
  const vars = mockVariations.filter(v => v.projectId === project.id);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Variations" subtitle={project.street} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {vars.map(v => (
          <div key={v.id} style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "14px", marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div>
                <div style={{ fontSize: 11, color: "#555", fontFamily: "Barlow Condensed, sans-serif" }}>{v.ref}</div>
                <div style={{ fontSize: 14, color: "#ccc", marginTop: 2 }}>{v.title}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 20, color: "#e07b39" }}>${v.amount.toLocaleString()}</div>
                <div style={{ fontSize: 10, fontFamily: "Barlow Condensed, sans-serif", color: v.status === "approved" ? "#22c55e" : "#f59e0b", marginTop: 3 }}>{v.status.toUpperCase()}</div>
              </div>
            </div>
          </div>
        ))}
        {vars.length === 0 && <div style={{ textAlign: "center", color: "#444", padding: "40px 0", fontSize: 14 }}>No variations</div>}
      </div>
    </div>
  );
}

export default function ClientApp({ user }) {
  const project = mockProjects.find(p => p.id === user.projectId) || mockProjects[0];
  const [screen, setScreen] = useState(null);

  const TILE_GRID = [
    { key: "updates",    ...TILES.updates    },
    { key: "schedule",   ...TILES.schedule   },
    { key: "variations", ...TILES.variations, badge: mockVariations.filter(v => v.projectId === project.id && v.status === "pending").length },
    { key: "documents",  ...TILES.documents  },
    { key: "photos",     ...TILES.photos     },
    { key: "invoices",   ...TILES.invoices   },
  ];

  if (screen) {
    const props = { project, onBack: () => setScreen(null) };
    switch (screen) {
      case "updates":    return <ProgressScreen {...props} />;
      case "documents":  return <DocumentsScreen {...props} />;
      case "variations": return <VariationsScreen {...props} />;
      default: break;
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c", maxWidth: 430, margin: "0 auto" }}>
      {/* Client header */}
      <div style={{ background: "#111", borderBottom: "1px solid #1e1e1e", padding: "14px 16px 12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>
            <span style={{ color: "#e07b39" }}>SCS</span> BuildHub
          </div>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#e07b39", color: "#0c0c0c", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Barlow Condensed, sans-serif", fontSize: 12, fontWeight: 700 }}>{user.avatar}</div>
        </div>
        {project.jobNumber && <div style={{ fontSize: 11, color: "#555", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: 1, textTransform: "uppercase" }}>JOB {project.jobNumber}</div>}
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 26, fontWeight: 700, color: "#f0f0f0", textTransform: "uppercase" }}>{project.street}</div>
        <div style={{ fontSize: 13, color: "#555" }}>{project.suburb}</div>
      </div>

      {/* Progress summary */}
      <div style={{ padding: "14px 16px", background: "#0f0f0f", borderBottom: "1px solid #1e1e1e" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 48, fontWeight: 700, color: "#e07b39", lineHeight: 1 }}>{project.progress}%</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#ccc" }}>{project.phase}</div>
            <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>Current stage</div>
          </div>
        </div>
        <div style={{ height: 6, background: "#1e1e1e", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${project.progress}%`, background: "#e07b39", borderRadius: 3 }} />
        </div>
      </div>

      {/* Tile grid */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {TILE_GRID.map(tile => (
            <AppTile key={tile.key} {...tile} onClick={() => setScreen(tile.key)} />
          ))}
        </div>
      </div>
    </div>
  );
}
