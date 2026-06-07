import { useState, useEffect } from "react";
import ProjectHeader from "../shared/ProjectHeader";
import BackHeader from "../shared/BackHeader";
import AppTile from "../shared/AppTile";
import OfflineBar from "../shared/OfflineBar";
import FileUploadButton from "../shared/FileUploadButton";
import PhotosScreen from "../shared/PhotosScreen";
import ActionQueue, { useActionItems } from "../shared/ActionQueue";
import letterheadUrl from "../../assets/letterhead.png";
import { EmptyState, Skeleton } from "../shared/LoadingScreen";
import { TILES } from "../../lib/theme";
import { getProjects, getDocuments, createSubbieRequest, getMySubbieRequests, markSubbieRequestsViewed, getMyPurchaseOrders, updatePurchaseOrder, getPoMessages, sendPoMessage } from "../../lib/db";
import { supabase } from "../../lib/supabase";
import { post, enqueue } from "../../lib/webhook";
import { useOfflineQueue } from "../../hooks/useOfflineQueue";

// ── Safety Sign-In ─────────────────────────────────────────────────────────────
function SignInScreen({ project, user, onBack }) {
  const { isOnline, refreshPending } = useOfflineQueue();
  const [done, setDone] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [swms, setSwms] = useState(false);
  const [ppe, setPpe] = useState(false);
  const [active, setActive] = useState(undefined); // undefined=loading, null=not on site, row=signed in

  useEffect(() => {
    let alive = true;
    supabase.from("site_visits").select("*").eq("project_id", project.id).eq("recorded_by", user.id).is("sign_out", null).order("sign_in", { ascending: false }).limit(1)
      .then(({ data }) => { if (alive) setActive(data && data[0] ? data[0] : null); });
    return () => { alive = false; };
  }, [project.id, user.id]);

  const signOut = async () => {
    if (!active || submitting) return;
    setSubmitting(true);
    const stamp = new Date().toISOString();
    const { error } = await supabase.from("site_visits").update({ sign_out: stamp }).eq("id", active.id);
    const payload = { ...active, sign_out: stamp };
    try { await post("/site/signout", payload); } catch { enqueue("/site/signout", payload); refreshPending(); }
    if (error) { enqueue("/site/signout", payload); refreshPending(); }
    setSubmitting(false);
    setActive(null);
    setSignedOut(true);
  };

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
    setActive(row);
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

  if (signedOut) return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Site Sign-Out" subtitle={project.street} onBack={onBack} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
        <div style={{ fontSize: 64 }}>👋</div>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 24, color: "#e07b39" }}>SIGNED OUT</div>
        <div style={{ fontSize: 14, color: "#555", textAlign: "center" }}>{isOnline ? "You're off the site muster" : "Saved — will sync when connected"}</div>
        <div style={{ fontSize: 12, color: "#444", textAlign: "center" }}>{new Date().toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true })}</div>
      </div>
    </div>
  );

  // Already on site → offer self sign-out (H9: syncs to supervisor muster)
  if (active) return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <OfflineBar />
      <BackHeader title="On Site" subtitle={project.street} onBack={onBack} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 16 }}>
        <div style={{ fontSize: 56 }}>🦺</div>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, color: "#22c55e" }}>YOU'RE ON SITE</div>
        <div style={{ fontSize: 13, color: "#666", textAlign: "center" }}>Signed in at {new Date(active.sign_in).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true })}</div>
        <button onClick={signOut} disabled={submitting} style={{
          width: "100%", maxWidth: 360, marginTop: 12, padding: "18px", borderRadius: 12, border: "none",
          background: "#e07b39", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 20, letterSpacing: 1, cursor: submitting ? "wait" : "pointer",
        }}>
          {submitting ? "SIGNING OUT..." : "SIGN OUT OF SITE"}
        </button>
      </div>
    </div>
  );

  if (active === undefined) return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Safety Sign-In" subtitle={project.street} onBack={onBack} />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#444", fontSize: 13 }}>Checking site status…</div>
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

const sinp = { width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#f0f0f0", fontSize: 14, padding: "11px 13px", fontFamily: "DM Sans, sans-serif", boxSizing: "border-box" };
const slbl = { fontSize: 11, color: "#777", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Barlow Condensed, sans-serif", marginBottom: 6, display: "block" };

// ── Request a variation (upload any-format request → builder queue) ─────────────
function RequestVariationScreen({ project, user, onBack }) {
  const [form, setForm] = useState({ trade: user.trade || "", note: "", file_url: "" });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const valid = form.note.trim().length >= 5 || form.file_url;

  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    const payload = { project_id: project.id, submitted_by: user.id, trade: form.trade.trim() || null, note: form.note.trim() || null, file_url: form.file_url || null, status: "submitted" };
    const { error } = await createSubbieRequest(payload);
    // Notify the builder queue (no-op until n8n connected).
    post("/subbie/variation-request", { ...payload, project: project.street, subbie: user.name }).catch(() => {});
    setSaving(false);
    if (!error) setDone(true);
  };

  if (done) return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Request Variation" subtitle={project.street} onBack={onBack} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 20 }}>
        <div style={{ fontSize: 64 }}>📨</div>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 24, color: "#22c55e" }}>REQUEST SUBMITTED</div>
        <div style={{ fontSize: 13, color: "#666", textAlign: "center", maxWidth: 300 }}>The builder will review and price your request. You'll see the outcome (approved or rejected) in My Requests.</div>
        <button onClick={onBack} style={{ padding: "12px 28px", borderRadius: 10, border: "2px solid #e07b39", background: "transparent", color: "#e07b39", fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, cursor: "pointer" }}>DONE</button>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <OfflineBar />
      <BackHeader title="Request Variation" subtitle={project.street} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        <div style={{ fontSize: 13, color: "#888", lineHeight: 1.5, marginBottom: 16 }}>
          Submit your variation request in any format — a photo, PDF, quote, or just a written note. The builder reviews and prices it. You'll never see client pricing or margin — only your own outcome.
        </div>
        <label style={slbl}>Trade</label>
        <input value={form.trade} onChange={e => setForm(f => ({ ...f, trade: e.target.value }))} placeholder="e.g. Electrical" style={{ ...sinp, marginBottom: 14 }} />
        <label style={slbl}>Describe the request</label>
        <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="What's the extra work, why is it needed, any costs or time impact…" rows={5} style={{ ...sinp, resize: "vertical", marginBottom: 14 }} />
        <label style={slbl}>Attach evidence (any format)</label>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
          <FileUploadButton folder={`subbie-requests/${project.id}`} accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx" label="📎 Attach file" color="#6366f1" onUploaded={(url) => setForm(f => ({ ...f, file_url: url }))} />
          <FileUploadButton folder={`subbie-requests/${project.id}`} accept="image/*" capture="environment" label="📷 Photo" color="#a855f7" onUploaded={(url) => setForm(f => ({ ...f, file_url: url }))} />
          {form.file_url && <span style={{ fontSize: 12, color: "#22c55e" }}>✓ attached</span>}
        </div>
        <button onClick={submit} disabled={!valid || saving} style={{ width: "100%", marginTop: 18, padding: "16px", borderRadius: 12, border: "none", background: valid ? "#6366f1" : "#1e1e1e", color: valid ? "#fff" : "#555", fontFamily: "Barlow Condensed, sans-serif", fontSize: 17, letterSpacing: 0.5, cursor: valid ? "pointer" : "not-allowed" }}>
          {saving ? "SUBMITTING…" : "SUBMIT REQUEST"}
        </button>
      </div>
    </div>
  );
}

// ── My requests (status: submitted / approved / rejected) ───────────────────────
const REQ_STATUS = {
  submitted: { label: "Submitted", color: "#f59e0b", bg: "#251d00" },
  converted: { label: "In Review",  color: "#0ea5e9", bg: "#0c2233" },
  approved:  { label: "Approved",   color: "#22c55e", bg: "#06200e" },
  rejected:  { label: "Rejected",   color: "#ef4444", bg: "#2a0c0c" },
};
function MyRequestsScreen({ user, onBack }) {
  const [reqs, setReqs] = useState(null);
  useEffect(() => {
    getMySubbieRequests(user.id).then(({ data }) => setReqs(data));
    // Viewing the outcomes clears the "outcome unviewed" action item.
    markSubbieRequestsViewed(user.id);
  }, [user.id]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="My Requests" subtitle="Variation requests" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {reqs === null ? [1, 2].map(i => <div key={i} style={{ height: 70, background: "#141414", borderRadius: 10, marginBottom: 8 }} />)
          : reqs.length === 0 ? <EmptyState icon="📨" title="No requests yet" subtitle="Submit a variation request and track its outcome here" />
          : reqs.map(r => {
            // Subbies only ever see Submitted / Approved / Rejected (converted shown as In Review).
            const st = REQ_STATUS[r.status] || REQ_STATUS.submitted;
            return (
              <div key={r.id} style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "14px", marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: "#555", fontFamily: "Barlow Condensed, sans-serif" }}>{r.project?.job_number || ""}{r.trade ? ` · ${r.trade}` : ""}</div>
                    <div style={{ fontSize: 14, color: "#ccc", marginTop: 3 }}>{r.note || "(attached file)"}</div>
                    <div style={{ fontSize: 11, color: "#444", marginTop: 4 }}>{new Date(r.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</div>
                    {r.status === "rejected" && r.rejection_reason && <div style={{ marginTop: 8, fontSize: 12, color: "#f0a0a0", background: "#2a0c0c", border: "1px solid #ef444433", borderRadius: 6, padding: "6px 10px" }}>Reason: {r.rejection_reason}</div>}
                    {r.file_url && <a href={r.file_url} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 8, fontSize: 12, color: "#3b82f6", textDecoration: "none" }}>📎 View attachment</a>}
                  </div>
                  <span style={{ fontSize: 10, fontFamily: "Barlow Condensed, sans-serif", color: st.color, background: st.bg, padding: "3px 9px", borderRadius: 4, textTransform: "uppercase", height: "fit-content", whiteSpace: "nowrap" }}>{st.label}</span>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

const poMoney = (n) => (n || n === 0) ? `$${Number(n).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";

// ── PO document + accept/sign + per-PO messaging ───────────────────────────────
function PoDetailScreen({ po: initialPo, user, onBack }) {
  const [po, setPo] = useState(initialPo);
  const [name, setName] = useState(user.name || "");
  const [msgs, setMsgs] = useState([]);
  const [draft, setDraft] = useState("");
  const [accepting, setAccepting] = useState(false);
  const value = Number(po.po_value) || 0;
  const gst = Math.round(value * 0.1 * 100) / 100;

  useEffect(() => { getPoMessages(po.id).then(({ data }) => setMsgs(data)); }, [po.id]);

  const accept = async () => {
    if (!name.trim() || accepting) return;
    setAccepting(true);
    const { data } = await updatePurchaseOrder(po.id, { status: "accepted", accepted_at: new Date().toISOString(), signature: name.trim() });
    setAccepting(false);
    if (data) setPo(p => ({ ...p, ...data }));
  };

  const send = async () => {
    if (!draft.trim()) return;
    const { data } = await sendPoMessage({ po_id: po.id, sender_id: user.id, content: draft.trim() });
    if (data) setMsgs(prev => [...prev, data]);
    setDraft("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title={po.po_number || "Purchase Order"} subtitle={po.project?.street} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* PO document */}
        <div style={{ maxWidth: 560, margin: "0 auto", padding: 12 }}>
          <div style={{ background: "#fff", color: "#1c1c1c", borderRadius: 6, overflow: "hidden", fontFamily: "DM Sans, sans-serif" }}>
            <img src={letterheadUrl} alt="Stokes Construction Services" style={{ width: "100%", display: "block" }} />
            <div style={{ background: "#2c2c2c", color: "#fff", padding: "8px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: "Barlow Condensed, sans-serif", letterSpacing: 0.5, fontSize: 13 }}>Purchase Order · Stokes Construction Services</span>
              <span style={{ fontSize: 10, fontFamily: "Barlow Condensed, sans-serif", textTransform: "uppercase", color: "#fff", background: po.status === "accepted" ? "#16a34a" : "#f59e0b", padding: "3px 9px", borderRadius: 4 }}>{po.status}</span>
            </div>
            <div style={{ padding: "16px 20px 22px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <div><div style={{ fontSize: 10, color: "#888", textTransform: "uppercase" }}>Project</div><div style={{ fontWeight: 600 }}>{po.project?.street}</div><div style={{ color: "#666" }}>{po.project?.job_number}</div></div>
                <div style={{ textAlign: "right" }}><div style={{ fontSize: 10, color: "#888", textTransform: "uppercase" }}>PO number</div><div style={{ fontWeight: 600 }}>{po.po_number}</div><div style={{ color: "#666" }}>{new Date(po.created_at).toLocaleDateString("en-AU")}</div></div>
              </div>
              <div style={{ borderTop: "2px solid #2c2c2c", margin: "14px 0 10px" }} />
              <div style={{ fontSize: 10, color: "#e07b39", textTransform: "uppercase", letterSpacing: 0.6, fontFamily: "Barlow Condensed, sans-serif" }}>Issued to</div>
              <div style={{ fontSize: 14 }}>{name || "Subcontractor"}{po.trade ? ` · ${po.trade}` : ""}</div>
              <div style={{ fontSize: 10, color: "#e07b39", textTransform: "uppercase", letterSpacing: 0.6, fontFamily: "Barlow Condensed, sans-serif", marginTop: 12 }}>Scope of works</div>
              <div style={{ fontSize: 13, color: "#333", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{po.scope}</div>
              {po.eot && <><div style={{ fontSize: 10, color: "#e07b39", textTransform: "uppercase", letterSpacing: 0.6, fontFamily: "Barlow Condensed, sans-serif", marginTop: 12 }}>Extension of time</div><div style={{ fontSize: 13, color: "#333" }}>{po.eot_days || "?"} day(s){po.eot_description ? ` — ${po.eot_description}` : ""}</div></>}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 14 }}>
                <tbody>
                  <tr><td style={{ padding: "6px 4px", color: "#666", textAlign: "right" }}>PO value</td><td style={{ padding: "6px 4px", textAlign: "right" }}>{poMoney(value)}</td></tr>
                  <tr><td style={{ padding: "4px", color: "#666", textAlign: "right" }}>GST (10%)</td><td style={{ padding: "4px", textAlign: "right" }}>{poMoney(gst)}</td></tr>
                  <tr style={{ background: "#2c2c2c", color: "#fff" }}><td style={{ padding: "8px", fontFamily: "Barlow Condensed, sans-serif", fontSize: 15 }}>TOTAL (INC GST)</td><td style={{ padding: "8px", textAlign: "right", fontFamily: "Barlow Condensed, sans-serif", fontSize: 16 }}>{poMoney(value + gst)}</td></tr>
                </tbody>
              </table>
              <div style={{ marginTop: 16, fontSize: 11, color: "#555" }}>Acceptance: {po.status === "accepted" ? <span style={{ color: "#16a34a", fontWeight: 600 }}>Accepted by {po.signature} on {new Date(po.accepted_at).toLocaleDateString("en-AU")}</span> : "Awaiting your acceptance below."}</div>
            </div>
          </div>
        </div>

        {/* Accept / sign */}
        {po.status !== "accepted" && (
          <div style={{ maxWidth: 560, margin: "0 auto", padding: "4px 16px 16px" }}>
            <label style={slbl}>Type your full name to accept this PO</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" style={{ ...sinp, flex: 1 }} />
              <button onClick={accept} disabled={!name.trim() || accepting} style={{ padding: "11px 18px", borderRadius: 8, border: "none", background: name.trim() ? "#22c55e" : "#1e1e1e", color: name.trim() ? "#fff" : "#555", fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, cursor: name.trim() ? "pointer" : "not-allowed" }}>{accepting ? "…" : "ACCEPT PO"}</button>
            </div>
          </div>
        )}

        {/* Per-PO message thread */}
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "8px 16px 24px" }}>
          <div style={{ fontSize: 12, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Barlow Condensed, sans-serif", marginBottom: 8 }}>Messages with the builder</div>
          {msgs.map(m => {
            const out = m.sender_id === user.id;
            return (
              <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: out ? "flex-end" : "flex-start", marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: "#444", marginBottom: 2 }}>{m.sender?.full_name || (out ? "You" : "Builder")}</div>
                <div style={{ maxWidth: "80%", background: out ? "#2a1800" : "#1a1a1a", border: `1px solid ${out ? "#3a2200" : "#222"}`, borderRadius: 10, padding: "9px 13px", fontSize: 13, color: "#ccc" }}>{m.content}</div>
              </div>
            );
          })}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Message the builder about this PO…" style={{ ...sinp, flex: 1 }} />
            <button onClick={send} disabled={!draft.trim()} style={{ padding: "11px 16px", borderRadius: 8, border: "none", background: draft.trim() ? "#e07b39" : "#1a1a1a", color: draft.trim() ? "#fff" : "#444", fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, cursor: draft.trim() ? "pointer" : "default" }}>SEND</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── My purchase orders ──────────────────────────────────────────────────────────
function MyPosScreen({ user, onBack }) {
  const [pos, setPos] = useState(null);
  const [open, setOpen] = useState(null);
  useEffect(() => { getMyPurchaseOrders(user.id).then(({ data }) => setPos(data)); }, [user.id]);

  if (open) return <PoDetailScreen po={open} user={user} onBack={() => setOpen(null)} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="My POs" subtitle="Purchase orders" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {pos === null ? [1, 2].map(i => <div key={i} style={{ height: 70, background: "#141414", borderRadius: 10, marginBottom: 8 }} />)
          : pos.length === 0 ? <EmptyState icon="🧾" title="No purchase orders yet" subtitle="POs the builder issues to you will appear here" />
          : pos.map(po => (
            <button key={po.id} onClick={() => setOpen(po)} style={{ width: "100%", textAlign: "left", background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "14px", marginBottom: 8, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: "#555", fontFamily: "Barlow Condensed, sans-serif" }}>{po.po_number}{po.trade ? ` · ${po.trade}` : ""}</div>
                  <div style={{ fontSize: 14, color: "#ccc", marginTop: 3 }}>{po.project?.street}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 18, color: "#e07b39" }}>{poMoney((Number(po.po_value) || 0) * 1.1)}</div>
                  <div style={{ fontSize: 10, fontFamily: "Barlow Condensed, sans-serif", color: po.status === "accepted" ? "#22c55e" : "#f59e0b", marginTop: 3, textTransform: "uppercase" }}>{po.status}</div>
                </div>
              </div>
            </button>
          ))}
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

  // Attention Centre — subby items are scoped to their own POs/requests (no financials).
  const { items: actionItems } = useActionItems("subcontractor", user.id);
  const onOpenAction = (item) => {
    if (item.target.kind === "subbiePo") setScreen("myPos");
    else if (item.target.kind === "subbieRequest") setScreen("myRequests");
  };

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
      case "signIn":     return <SignInScreen {...props} />;
      case "documents":  return <DocsScreen {...props} />;
      case "varRequest": return <RequestVariationScreen {...props} />;
      case "myRequests": return <MyRequestsScreen {...props} />;
      case "myPos":      return <MyPosScreen {...props} />;
      case "photos":     return <PhotosScreen {...props} />;
      default: break;
    }
  }

  const TILE_GRID = [
    { key: "signIn",     ...TILES.signIn     },
    { key: "varRequest", icon: "±",  label: "Request Variation", accent: "#6366f1", bg: "#10103a" },
    { key: "myRequests", icon: "📨", label: "My Requests",       accent: "#0ea5e9", bg: "#061520" },
    { key: "myPos",      icon: "🧾", label: "My POs",            accent: "#d97706", bg: "#1e1200" },
    { key: "documents",  ...TILES.documents  },
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
        {actionItems?.length > 0 && <ActionQueue items={actionItems} title="Action required" onOpen={onOpenAction} />}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {TILE_GRID.map(tile => <AppTile key={tile.key} {...tile} onClick={() => setScreen(tile.key)} />)}
        </div>
      </div>
    </div>
  );
}
