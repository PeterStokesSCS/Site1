import { useState, useEffect } from "react";
import ProjectHeader from "../shared/ProjectHeader";
import BackHeader from "../shared/BackHeader";
import AppTile from "../shared/AppTile";
import OfflineBar from "../shared/OfflineBar";
import { EmptyState, Skeleton } from "../shared/LoadingScreen";
import { TILES } from "../../lib/theme";
import { getProjects, getDocuments } from "../../lib/db";
import { supabase } from "../../lib/supabase";
import { post, enqueue } from "../../lib/webhook";
import { useOfflineQueue } from "../../hooks/useOfflineQueue";

// ── Safety Sign-In ─────────────────────────────────────────────────────────────
function SignInScreen({ project, user, onBack }) {
  const { isOnline, refreshPending } = useOfflineQueue();
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [swms, setSwms] = useState(false);
  const [ppe, setPpe] = useState(false);

  const signIn = async () => {
    if (!swms || !ppe || submitting) return;
    setSubmitting(true);
    const row = {
      project_id: project.id,
      visitor_name: user.name,
      trade: user.trade || null,
      type: "subcontractor",
      sign_in: new Date().toISOString(),
      swms_acknowledged: true,
      safety_rules_acknowledged: true,
      recorded_by: user.id,
    };
    const { error } = await supabase.from("site_visits").insert(row);
    // Fire-and-forget n8n notification; queue if offline
    try { await post("/site/signin", row); } catch { enqueue("/site/signin", row); refreshPending(); }
    if (error) { enqueue("/site/signin", row); refreshPending(); }
    setSubmitting(false);
    setDone(true);
  };

  if (done) return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Safety Sign-In" subtitle={project.street} onBack={onBack} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
        <div style={{ fontSize: 64 }}>✅</div>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 24, color: "#22c55e" }}>SIGNED IN</div>
        <div style={{ fontSize: 14, color: "#555", textAlign: "center" }}>{isOnline ? "You're on the site muster" : "Saved — will sync when connected"}</div>
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
          { id: "swms", val: swms, set: setSwms, label: "I have read and understood the SWMS for my scope of work on this site" },
          { id: "ppe",  val: ppe,  set: setPpe,  label: "I am wearing appropriate PPE and my tools/equipment are in safe working order" },
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
            <div style={{ fontSize: 13, color: "#ccc", lineHeight: 1.4 }}>{item.label}</div>
          </button>
        ))}
        <button onClick={signIn} disabled={!swms || !ppe || submitting} style={{
          width: "100%", marginTop: 8, padding: "18px", borderRadius: 12, border: "none",
          background: swms && ppe ? "#22c55e" : "#1e1e1e", color: swms && ppe ? "#fff" : "#444",
          fontFamily: "Barlow Condensed, sans-serif", fontSize: 20, letterSpacing: 1, cursor: swms && ppe ? "pointer" : "not-allowed",
        }}>
          {submitting ? "SIGNING IN..." : "SIGN IN TO SITE"}
        </button>
      </div>
    </div>
  );
}

// ── Documents ──────────────────────────────────────────────────────────────────
function DocsScreen({ project, onBack }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDocuments(project.id).then(({ data }) => { setDocs(data.filter(d => !d.superseded)); setLoading(false); });
  }, [project.id]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Documents" subtitle={project.street} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {loading ? [1,2,3].map(i => <div key={i} style={{ height: 56, background: "#141414", borderRadius: 10, marginBottom: 8 }} />)
          : docs.length === 0
            ? <EmptyState icon="📄" title="No documents yet" subtitle="Site documents will appear here when uploaded" />
            : docs.map(doc => (
              <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 22 }}>📄</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: "#ccc" }}>{doc.name}</div>
                  <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{doc.category}{doc.created_at && ` · ${new Date(doc.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}`}</div>
                </div>
                {doc.file_url && <a href={doc.file_url} target="_blank" rel="noreferrer" style={{ color: "#3b82f6", fontSize: 18, textDecoration: "none" }}>↓</a>}
              </div>
            ))
        }
      </div>
    </div>
  );
}

// ── Subcontractor Home ─────────────────────────────────────────────────────────
export default function SubcontractorApp({ user }) {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState(null);
  const [screen, setScreen] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProjects().then(({ data }) => {
      setProjects(data);
      if (data.length > 0) setProjectId(data[0].id);
      setLoading(false);
    });
  }, []);

  const project = projects.find(p => p.id === projectId);

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <div style={{ padding: "14px 16px", background: "#111", borderBottom: "1px solid #1e1e1e" }}>
        <Skeleton width={120} height={16} style={{ marginBottom: 8 }} />
        <Skeleton width="70%" height={28} />
      </div>
    </div>
  );

  if (!project) return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <div style={{ padding: "14px 16px", background: "#111", borderBottom: "1px solid #1e1e1e" }}>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: 2 }}><span style={{ color: "#e07b39" }}>SITE</span>1</div>
      </div>
      <div style={{ flex: 1 }}><EmptyState icon="🏗" title="No site assigned" subtitle="Contact the site supervisor to be assigned to a project" /></div>
      <div style={{ padding: 16, borderTop: "1px solid #1e1e1e" }}>
        <button onClick={() => supabase.auth.signOut()} style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #333", background: "transparent", color: "#666", fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, cursor: "pointer" }}>SIGN OUT</button>
      </div>
    </div>
  );

  if (screen) {
    const props = { project, user, onBack: () => setScreen(null) };
    switch (screen) {
      case "signIn":    return <SignInScreen {...props} />;
      case "documents": return <DocsScreen {...props} />;
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
      <ProjectHeader project={project} projects={projects} user={user} onSwitch={projects.length > 1 ? setProjectId : null} />
      <div style={{ padding: "8px 16px 0", background: "#0c0c0c" }}>
        <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>🦺</span>
          <div>
            <div style={{ fontSize: 13, color: "#ccc", fontWeight: 600 }}>{user.name}</div>
            <div style={{ fontSize: 11, color: "#555" }}>{user.trade ? `${user.trade} · ` : ""}Sign in before starting work</div>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {TILE_GRID.map(tile => <AppTile key={tile.key} {...tile} onClick={() => setScreen(tile.key)} />)}
        </div>
      </div>
    </div>
  );
}
