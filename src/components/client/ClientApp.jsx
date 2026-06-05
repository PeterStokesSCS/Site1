import { useState, useEffect } from "react";
import AppTile from "../shared/AppTile";
import BackHeader from "../shared/BackHeader";
import { EmptyState, Skeleton, CardSkeleton } from "../shared/LoadingScreen";
import { TILES } from "../../lib/theme";
import { getProjectsByUser, getProjects, getMilestones, getDocuments, getVariations, getClientPhotos, updateVariation } from "../../lib/db";
import { supabase } from "../../lib/supabase";
import { post } from "../../lib/webhook";

// Client progress gallery — only photos the team marked visible to the client
function ClientPhotosScreen({ project, onBack }) {
  const [photos, setPhotos] = useState(null);
  const [view, setView] = useState(null);
  useEffect(() => { getClientPhotos(project.id).then(({ data }) => setPhotos(data)); }, [project.id]);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Progress Photos" subtitle={project.street} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
        {photos === null ? <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4 }}>{[1,2,3,4,5,6].map(i => <div key={i} style={{ aspectRatio: "1", background: "#141414", borderRadius: 8 }} />)}</div>
          : photos.length === 0 ? <EmptyState icon="📷" title="No photos yet" subtitle="Progress photos shared by your builder will appear here" />
          : <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4 }}>
              {photos.map(p => (
                <button key={p.id} onClick={() => setView(p)} style={{ aspectRatio: "1", border: "none", padding: 0, borderRadius: 8, overflow: "hidden", cursor: "pointer", background: "#141414" }}>
                  <img src={p.url} alt={p.caption || "photo"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </button>
              ))}
            </div>
        }
      </div>
      {view && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 300, display: "flex", flexDirection: "column" }} onClick={() => setView(null)}>
          <div style={{ display: "flex", justifyContent: "flex-end", padding: 14 }}><button onClick={() => setView(null)} style={{ background: "#1e1e1e", border: "none", borderRadius: 10, color: "#fff", fontSize: 20, width: 40, height: 40 }}>✕</button></div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 12px" }}><img src={view.url} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8 }} /></div>
          {view.caption && <div style={{ padding: 16, color: "#ccc", fontSize: 14, textAlign: "center" }}>{view.caption}</div>}
        </div>
      )}
    </div>
  );
}

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

// ── Variation digital sign-off modal (legal layer) ─────────────────────────────
function SignOffModal({ variation, user, onClose, onDone }) {
  const [name, setName] = useState(user?.name || "");
  const [mode, setMode] = useState(null); // 'approve' | 'reject'
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const v = variation;

  const submit = async (decision) => {
    if (!name.trim()) return;
    setSaving(true);
    const nowIso = new Date().toISOString();
    // Capture sign-off metadata (device always; public IP best-effort).
    const device = typeof navigator !== "undefined" ? navigator.userAgent : null;
    let ip = null;
    try { ip = await Promise.race([
      fetch("https://api.ipify.org?format=json").then(r => r.json()).then(d => d.ip),
      new Promise(res => setTimeout(() => res(null), 2500)),
    ]); } catch { ip = null; }
    const history = [...(v.revision_history || []), {
      action: decision, by: name.trim(), at: nowIso, ...(ip ? { ip } : {}), ...(decision === "rejected" && reason.trim() ? { reason: reason.trim() } : {}),
    }];
    const meta = { approval_device: device, approval_ip: ip, approval_statement_accepted: true, approved_version: v.ref || null };
    const patch = decision === "approved"
      ? { status: "approved", client_approved: true, client_signature: name.trim(), approval_date: nowIso, revision_history: history, ...meta }
      : { status: "rejected", client_approved: false, client_signature: name.trim(), approval_date: nowIso, revision_history: history, ...meta };
    const { data } = await updateVariation(v.id, patch);
    // Fire-and-forget routing event for n8n (post-approval routing to supervisor/admin,
    // or rejection alert to builder). No-op until VITE_WEBHOOK_BASE is configured.
    post(decision === "approved" ? "/variations/approved" : "/variations/rejected", {
      variation_id: v.id, ref: v.ref, project_id: v.project_id, title: v.title,
      total_inc_gst: v.total_inc_gst ?? v.amount, signed_by: name.trim(), at: nowIso,
      ...(decision === "rejected" && reason.trim() ? { reason: reason.trim() } : {}),
    }).catch(() => {});
    setSaving(false);
    onDone(data || { ...v, ...patch });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 400, display: "flex", flexDirection: "column", overflowY: "auto" }}>
      <div style={{ maxWidth: 460, margin: "0 auto", width: "100%", padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, color: "#fff", letterSpacing: 0.5 }}>VARIATION SIGN-OFF</div>
          <button onClick={onClose} style={{ background: "#1e1e1e", border: "none", borderRadius: 10, color: "#fff", fontSize: 18, width: 38, height: 38, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ background: "#141414", border: "1px solid #2a2a2a", borderRadius: 12, padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "#555", fontFamily: "Barlow Condensed, sans-serif" }}>{v.ref || "VARIATION"}</div>
          <div style={{ fontSize: 17, color: "#f0f0f0", margin: "4px 0 10px" }}>{v.title}</div>
          {v.description && <div style={{ fontSize: 13, color: "#aaa", lineHeight: 1.5, marginBottom: 12 }}>{v.description}</div>}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #222", paddingTop: 12 }}>
            <span style={{ fontSize: 12, color: "#888", textTransform: "uppercase", fontFamily: "Barlow Condensed, sans-serif" }}>Cost impact{(v.total_inc_gst ?? v.amount) != null ? " (inc GST)" : ""}</span>
            <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 28, color: "#e07b39" }}>{(v.total_inc_gst ?? v.amount) != null ? `$${Number(v.total_inc_gst ?? v.amount).toLocaleString()}` : "TBC"}</span>
          </div>
          {v.eot && <div style={{ fontSize: 12, color: "#f59e0b", marginTop: 10 }}>⏱ Includes an extension of time of {v.eot_days || "?"} day{v.eot_days === 1 ? "" : "s"}.</div>}
          {(v.attachments?.[0] || v.file_url) && <a href={v.attachments?.[0] || v.file_url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 12, color: "#3b82f6", textDecoration: "none" }}>📎 View attached document</a>}
        </div>

        <div style={{ fontSize: 12, color: "#777", lineHeight: 1.5, marginBottom: 12 }}>
          By signing below you confirm you have reviewed this variation and agree to the change in scope and the cost impact shown. Your name, the date and time will be recorded as your electronic signature.
        </div>

        <label style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Barlow Condensed, sans-serif" }}>Type your full name to sign</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Your full legal name" style={{ width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#f0f0f0", fontSize: 16, padding: "12px 14px", fontFamily: "DM Sans, sans-serif", boxSizing: "border-box", margin: "6px 0 14px" }} />

        {mode === "reject" && (
          <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for declining (optional)" rows={2} style={{ width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#f0f0f0", fontSize: 14, padding: "10px 12px", fontFamily: "DM Sans, sans-serif", boxSizing: "border-box", marginBottom: 14, resize: "vertical" }} />
        )}

        {mode === null ? (
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setMode("approve")} disabled={!name.trim()} style={{ flex: 2, padding: "14px", borderRadius: 10, border: "none", background: name.trim() ? "#22c55e" : "#173a23", color: name.trim() ? "#fff" : "#5a7", fontFamily: "Barlow Condensed, sans-serif", fontSize: 16, cursor: name.trim() ? "pointer" : "not-allowed", letterSpacing: 0.5 }}>✓ APPROVE & SIGN</button>
            <button onClick={() => setMode("reject")} style={{ flex: 1, padding: "14px", borderRadius: 10, border: "1px solid #ef4444", background: "transparent", color: "#ef4444", fontFamily: "Barlow Condensed, sans-serif", fontSize: 16, cursor: "pointer" }}>DECLINE</button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => submit(mode === "approve" ? "approved" : "rejected")} disabled={saving || !name.trim()} style={{ flex: 2, padding: "14px", borderRadius: 10, border: "none", background: mode === "approve" ? "#22c55e" : "#ef4444", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 16, cursor: "pointer", letterSpacing: 0.5 }}>{saving ? "SIGNING…" : mode === "approve" ? `CONFIRM APPROVAL — ${name.trim()}` : `CONFIRM DECLINE`}</button>
            <button onClick={() => setMode(null)} style={{ flex: 1, padding: "14px", borderRadius: 10, border: "1px solid #333", background: "transparent", color: "#888", fontFamily: "Barlow Condensed, sans-serif", fontSize: 16, cursor: "pointer" }}>BACK</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Variations screen ──────────────────────────────────────────────────────────
function VariationsScreen({ project, user, onBack }) {
  const [vars, setVars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(null);

  useEffect(() => { getVariations(project.id).then(({ data }) => { setVars(data); setLoading(false); }); }, [project.id]);

  const onDone = (updated) => {
    setVars(prev => prev.map(v => v.id === updated.id ? { ...v, ...updated } : v));
    setSigning(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Variations" subtitle={project.street} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {loading ? [1,2].map(i => <div key={i} style={{ height: 70, background: "#141414", borderRadius: 10, marginBottom: 8 }} />)
          : vars.length === 0
            ? <EmptyState icon="±" title="No variations" subtitle="Any changes to your contract will be listed here" />
            : vars.map(v => {
              const awaiting = v.status === "sent";
              return (
              <div key={v.id} style={{ background: "#141414", border: `1px solid ${awaiting ? "#0ea5e955" : "#1e1e1e"}`, borderRadius: 10, padding: "14px", marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: "#555", fontFamily: "Barlow Condensed, sans-serif" }}>{v.ref || "—"}</div>
                    <div style={{ fontSize: 14, color: "#ccc", marginTop: 2 }}>{v.title}</div>
                    {v.description && <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>{v.description}</div>}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 20, color: "#e07b39" }}>{(v.total_inc_gst ?? v.amount) != null ? `$${Number(v.total_inc_gst ?? v.amount).toLocaleString()}` : "TBC"}</div>
                    <div style={{ fontSize: 10, fontFamily: "Barlow Condensed, sans-serif", color: v.status === "approved" ? "#22c55e" : v.status === "rejected" ? "#ef4444" : awaiting ? "#0ea5e9" : "#f59e0b", marginTop: 3 }}>{awaiting ? "AWAITING YOUR SIGN-OFF" : v.status?.toUpperCase()}</div>
                  </div>
                </div>
                {v.client_approved && (
                  <div style={{ marginTop: 10, background: "#06200e", border: "1px solid #22c55e44", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "#9ae6b4" }}>
                    ✓ You approved this — signed <b>{v.client_signature}</b>{v.approval_date ? ` on ${new Date(v.approval_date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                  </div>
                )}
                {v.status === "rejected" && !v.client_approved && v.client_signature && (
                  <div style={{ marginTop: 10, background: "#2a0c0c", border: "1px solid #ef444444", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "#f0a0a0" }}>
                    ✕ You declined this on {v.approval_date ? new Date(v.approval_date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                  </div>
                )}
                {awaiting && (
                  <button onClick={() => setSigning(v)} style={{ width: "100%", marginTop: 12, padding: "12px", borderRadius: 10, border: "none", background: "#0ea5e9", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, cursor: "pointer", letterSpacing: 0.5 }}>✍ REVIEW & SIGN</button>
                )}
                {v.signed_pdf_url && (
                  <a href={v.signed_pdf_url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 13, color: "#3b82f6", textDecoration: "none" }}>📄 Download signed variation (PDF)</a>
                )}
              </div>
              );
            })
        }
      </div>
      {signing && <SignOffModal variation={signing} user={user} onClose={() => setSigning(null)} onDone={onDone} />}
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
  const [sentVars, setSentVars] = useState([]);
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
        const sent = vs.filter(v => v.status === "sent");
        setSentVars(sent);
        setPendingVars(sent.length);
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
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: 2 }}><span style={{ color: "#e07b39" }}>SITE</span>1</div>
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
      case "variations": return <VariationsScreen {...props} user={user} />;
      case "schedule":   return <SoonScreen title="Schedule" icon="📅" {...props} />;
      case "photos":     return <ClientPhotosScreen {...props} />;
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
            <span style={{ color: "#e07b39" }}>SITE</span>1
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
        {/* Variation awaiting approval — action-required alert */}
        {sentVars.length > 0 && (
          <button onClick={() => setScreen("variations")} style={{ width: "100%", textAlign: "left", background: "#0c2233", border: "1px solid #0ea5e9", borderRadius: 12, padding: "14px 16px", marginBottom: 14, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>✍</span>
              <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, color: "#0ea5e9", letterSpacing: 0.3, textTransform: "uppercase" }}>
                {sentVars.length === 1 ? "Variation awaiting your approval" : `${sentVars.length} variations awaiting your approval`}
              </span>
            </div>
            <div style={{ fontSize: 13, color: "#cbd5e1" }}>
              {sentVars[0].ref ? `${sentVars[0].ref} — ` : ""}{sentVars[0].title}
              {(sentVars[0].total_inc_gst ?? sentVars[0].amount) != null && <span style={{ color: "#e07b39", fontFamily: "Barlow Condensed, sans-serif", marginLeft: 6 }}>${Number(sentVars[0].total_inc_gst ?? sentVars[0].amount).toLocaleString()} inc GST</span>}
            </div>
            <div style={{ fontSize: 12, color: "#0ea5e9", marginTop: 8, fontFamily: "Barlow Condensed, sans-serif" }}>REVIEW &amp; SIGN →</div>
          </button>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {TILE_GRID.map(tile => (
            <AppTile key={tile.key} {...tile} onClick={() => setScreen(tile.key)} />
          ))}
        </div>
      </div>
    </div>
  );
}
