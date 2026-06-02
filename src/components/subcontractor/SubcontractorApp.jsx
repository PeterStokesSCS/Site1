import { useState } from "react";
import ProjectHeader from "../shared/ProjectHeader";
import BackHeader from "../shared/BackHeader";
import AppTile from "../shared/AppTile";
import { TILES } from "../../lib/theme";
import { mockProjects, mockDocuments, HAZARD_CATEGORIES } from "../../data/mockData";
import { post, enqueue } from "../../lib/webhook";
import { useOfflineQueue } from "../../hooks/useOfflineQueue";
import OfflineBar from "../shared/OfflineBar";

function SignInScreen({ project, user, onBack }) {
  const { isOnline, refreshPending } = useOfflineQueue();
  const [done, setDone] = useState(false);
  const [swms, setSwms] = useState(false);
  const [ppe, setPpe] = useState(false);

  const signIn = async () => {
    if (!swms || !ppe) return;
    const payload = { workerId: user.id, workerName: user.name, projectId: project.id, type: "subcontractor", timestamp: new Date().toISOString(), swmsAcknowledged: true, ppeConfirmed: true };
    try { await post("/timeclock/in", payload); } catch { enqueue("/timeclock/in", payload); refreshPending(); }
    setDone(true);
  };

  if (done) return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Safety Sign-In" subtitle={project.street} onBack={onBack} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
        <div style={{ fontSize: 64 }}>✅</div>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 24, color: "#22c55e" }}>SIGNED IN</div>
        <div style={{ fontSize: 14, color: "#555", textAlign: "center" }}>{isOnline ? "Recorded successfully" : "Saved — will sync when connected"}</div>
        <div style={{ fontSize: 12, color: "#444", textAlign: "center" }}>{new Date().toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true })}</div>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <OfflineBar />
      <BackHeader title="Safety Sign-In" subtitle={project.street} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 16 }}>Before you start work today</div>

        {[
          { id: "swms", val: swms, set: setSwms, label: "I have read and understood the SWMS for my scope of work on this site", icon: "📋" },
          { id: "ppe",  val: ppe,  set: setPpe,  label: "I am wearing appropriate PPE and my tools/equipment are in safe working order", icon: "🦺" },
        ].map(item => (
          <button key={item.id} onClick={() => item.set(!item.val)} style={{
            width: "100%", textAlign: "left", background: item.val ? "#061e1c" : "#141414",
            border: `1px solid ${item.val ? "#14b8a6" : "#1e1e1e"}`, borderRadius: 12, padding: "16px",
            cursor: "pointer", display: "flex", alignItems: "center", gap: 14, marginBottom: 12,
            WebkitTapHighlightColor: "transparent",
          }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, border: `2px solid ${item.val ? "#22c55e" : "#333"}`, background: item.val ? "#22c55e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {item.val && <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>✓</span>}
            </div>
            <div>
              <div style={{ fontSize: 13, color: "#ccc", lineHeight: 1.4 }}>{item.label}</div>
            </div>
          </button>
        ))}

        <button onClick={signIn} disabled={!swms || !ppe} style={{
          width: "100%", marginTop: 8, padding: "18px", borderRadius: 12, border: "none",
          background: swms && ppe ? "#22c55e" : "#1e1e1e", color: swms && ppe ? "#fff" : "#444",
          fontFamily: "Barlow Condensed, sans-serif", fontSize: 20, letterSpacing: 1, cursor: swms && ppe ? "pointer" : "not-allowed",
        }}>
          SIGN IN TO SITE
        </button>
      </div>
    </div>
  );
}

function DocsScreen({ project, onBack }) {
  const docs = mockDocuments.filter(d => d.projectId === project.id && d.current);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Documents" subtitle={project.street} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {docs.map(doc => (
          <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 22 }}>📄</span>
            <div style={{ flex: 1 }}><div style={{ fontSize: 14, color: "#ccc" }}>{doc.name}</div><div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{doc.category} · {doc.size}</div></div>
            <span style={{ color: "#3b82f6", fontSize: 18 }}>↓</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SubcontractorApp({ user }) {
  const [projectId] = useState("p1");
  const [screen, setScreen] = useState(null);
  const project = mockProjects.find(p => p.id === projectId) || mockProjects[0];

  if (screen) {
    const props = { project, user, onBack: () => setScreen(null) };
    switch (screen) {
      case "signIn":     return <SignInScreen {...props} />;
      case "documents":  return <DocsScreen {...props} />;
      default: break;
    }
  }

  const TILE_GRID = [
    { key: "documents",  ...TILES.documents  },
    { key: "signIn",     ...TILES.signIn     },
    { key: "tasks",      ...TILES.tasks      },
    { key: "chat",       ...TILES.chat       },
    { key: "compliance", ...TILES.compliance },
    { key: "photos",     ...TILES.photos     },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c", maxWidth: 430, margin: "0 auto" }}>
      <OfflineBar />
      <ProjectHeader project={project} user={user} />
      <div style={{ padding: "8px 16px 0", background: "#0c0c0c" }}>
        <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>🦺</span>
          <div>
            <div style={{ fontSize: 13, color: "#ccc", fontWeight: 600 }}>{user.name}</div>
            <div style={{ fontSize: 11, color: "#555" }}>{user.trade} · Sign in before starting work</div>
          </div>
        </div>
      </div>
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
