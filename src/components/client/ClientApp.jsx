import { useState, useEffect } from "react";
import AppTile from "../shared/AppTile";
import BackHeader from "../shared/BackHeader";
import { EmptyState, Skeleton, CardSkeleton } from "../shared/LoadingScreen";
import { TILES } from "../../lib/theme";
import { getProjectsByUser, getProjects, getMilestones, getDocuments, getVariations } from "../../lib/db";
import { supabase } from "../../lib/supabase";

// ── Milestone bar ──────────────────────────────────────────────────────────────
function MilestoneBar({ milestones }) {
  const done = milestones.filter(m => m.done).length;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 0, padding: "4px 0" }}>
      {milestones.map((m, i) => {
        const past = m.done;
        const current = !m.done && i === done;
        return (
          <div key={m.id || m.name} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
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

// ── Progress / Updates screen ──────────────────────────────────────────────────
function ProgressScreen({ project, onBack }) {
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getMilestones(project.id).then(({ data }) => { setMilestones(data); setLoading(false); }); }, [project.id]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Progress" subtitle={project.street} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 14, padding: "20px", marginBottom: 16 }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 72, fontWeight: 700, color: "#e07b39", lineHeight: 1 }}>{project.progress || 0}%</div>
            <div style={{ fontSize: 14, color: "#888", marginTop: 4 }}>Overall completion</div>
          </div>
          <div style={{ height: 10, background: "#222", borderRadius: 5, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ height: "100%", width: `${project.progress || 0}%`, background: "#e07b39", borderRadius: 5, transition: "width 0.5s" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#666", marginBottom: milestones.length ? 20 : 0 }}>
            <span>Current stage: <strong style={{ color: "#ccc" }}>{project.phase || "—"}</strong></span>
          </div>
          {milestones.length > 0 && <MilestoneBar milestones={milestones} />}
        </div>

        {loading ? <CardSkeleton /> : milestones.length === 0 ? (
          <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 12, padding: "16px", textAlign: "center", color: "#555", fontSize: 13 }}>
            Milestone tracker will appear here once your builder sets the project stages.
          </div>
        ) : (
          <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 12, padding: "16px" }}>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Milestone Detail</div>
            {milestones.map((m) => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: "1px solid #1a1a1a" }}>
                <span style={{ color: m.done ? "#e07b39" : "#333", fontSize: 16, flexShrink: 0 }}>{m.done ? "✓" : "○"}</span>
                <span style={{ fontSize: 14, color: m.done ? "#ccc" : "#444", flex: 1 }}>{m.name}</span>
                {m.done && m.completed_date && <span style={{ fontSize: 12, color: "#555" }}>{new Date(m.completed_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Documents screen ───────────────────────────────────────────────────────────
function DocumentsScreen({ project, onBack }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getDocuments(project.id).then(({ data }) => { setDocs(data.filter(d => !d.superseded)); setLoading(false); }); }, [project.id]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Documents" subtitle={project.street} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {loading ? [1,2,3].map(i => <div key={i} style={{ height: 56, background: "#141414", borderRadius: 10, marginBottom: 8 }} />)
          : docs.length === 0
            ? <EmptyState icon="📄" title="No documents yet" subtitle="Documents shared by your builder will appear here" />
            : docs.map(doc => (
              <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 24 }}>📄</span>
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

// ── Variations screen ──────────────────────────────────────────────────────────
function VariationsScreen({ project, onBack }) {
  const [vars, setVars] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getVariations(project.id).then(({ data }) => { setVars(data); setLoading(false); }); }, [project.id]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Variations" subtitle={project.street} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {loading ? [1,2].map(i => <div key={i} style={{ height: 70, background: "#141414", borderRadius: 10, marginBottom: 8 }} />)
          : vars.length === 0
            ? <EmptyState icon="±" title="No variations" subtitle="Any changes to your contract will be listed here" />
            : vars.map(v => (
              <div key={v.id} style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "14px", marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#555", fontFamily: "Barlow Condensed, sans-serif" }}>{v.ref || "—"}</div>
                    <div style={{ fontSize: 14, color: "#ccc", marginTop: 2 }}>{v.title}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 20, color: "#e07b39" }}>{v.amount ? `$${v.amount.toLocaleString()}` : "TBC"}</div>
                    <div style={{ fontSize: 10, fontFamily: "Barlow Condensed, sans-serif", color: v.status === "approved" ? "#22c55e" : "#f59e0b", marginTop: 3 }}>{v.status?.toUpperCase()}</div>
                  </div>
                </div>
              </div>
            ))
        }
      </div>
    </div>
  );
}

// ── Generic "coming soon" sub-screen ───────────────────────────────────────────
function SoonScreen({ title, project, onBack, icon }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title={title} subtitle={project.street} onBack={onBack} />
      <div style={{ flex: 1 }}><EmptyState icon={icon} title={`${title} coming soon`} subtitle="This will be available in a future update" /></div>
    </div>
  );
}

// ── Client Home ────────────────────────────────────────────────────────────────
export default function ClientApp({ user }) {
  const [project, setProject] = useState(null);
  const [pendingVars, setPendingVars] = useState(0);
  const [screen, setScreen] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // A client sees the project(s) they are a member of; fall back to RLS-visible projects.
      let { data } = await getProjectsByUser(user.id);
      if (!data || data.length === 0) {
        const all = await getProjects();
        data = all.data;
      }
      const p = data[0] || null;
      setProject(p);
      if (p) {
        const { data: vs } = await getVariations(p.id);
        setPendingVars(vs.filter(v => v.status === "pending").length);
      }
      setLoading(false);
    })();
  }, [user.id]);

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c", maxWidth: 430, margin: "0 auto" }}>
      <div style={{ padding: "14px 16px", background: "#111", borderBottom: "1px solid #1e1e1e" }}>
        <Skeleton width={120} height={14} style={{ marginBottom: 8 }} />
        <Skeleton width="70%" height={26} />
      </div>
    </div>
  );

  if (!project) return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c", maxWidth: 430, margin: "0 auto" }}>
      <div style={{ padding: "14px 16px", background: "#111", borderBottom: "1px solid #1e1e1e" }}>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: 2 }}><span style={{ color: "#e07b39" }}>SCS</span> BuildHub</div>
      </div>
      <div style={{ flex: 1 }}><EmptyState icon="🏗" title="No project linked yet" subtitle="Your builder will connect your account to your project shortly" /></div>
      <div style={{ padding: 16, borderTop: "1px solid #1e1e1e" }}>
        <button onClick={() => supabase.auth.signOut()} style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #333", background: "transparent", color: "#666", fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, cursor: "pointer" }}>SIGN OUT</button>
      </div>
    </div>
  );

  if (screen) {
    const props = { project, onBack: () => setScreen(null) };
    switch (screen) {
      case "updates":    return <ProgressScreen {...props} />;
      case "documents":  return <DocumentsScreen {...props} />;
      case "variations": return <VariationsScreen {...props} />;
      case "schedule":   return <SoonScreen title="Schedule" icon="📅" {...props} />;
      case "photos":     return <SoonScreen title="Photos" icon="📷" {...props} />;
      case "invoices":   return <SoonScreen title="Invoices" icon="💳" {...props} />;
      default: break;
    }
  }

  const TILE_GRID = [
    { key: "updates",    ...TILES.updates    },
    { key: "schedule",   ...TILES.schedule   },
    { key: "variations", ...TILES.variations, badge: pendingVars },
    { key: "documents",  ...TILES.documents  },
    { key: "photos",     ...TILES.photos     },
    { key: "invoices",   ...TILES.invoices   },
  ];

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
        {project.job_number && <div style={{ fontSize: 11, color: "#555", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: 1, textTransform: "uppercase" }}>JOB {project.job_number}</div>}
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 26, fontWeight: 700, color: "#f0f0f0", textTransform: "uppercase" }}>{project.street}</div>
        <div style={{ fontSize: 13, color: "#555" }}>{project.suburb}</div>
      </div>

      {/* Progress summary */}
      <div style={{ padding: "14px 16px", background: "#0f0f0f", borderBottom: "1px solid #1e1e1e" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 48, fontWeight: 700, color: "#e07b39", lineHeight: 1 }}>{project.progress || 0}%</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#ccc" }}>{project.phase || "—"}</div>
            <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>Current stage</div>
          </div>
        </div>
        <div style={{ height: 6, background: "#1e1e1e", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${project.progress || 0}%`, background: "#e07b39", borderRadius: 3 }} />
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
