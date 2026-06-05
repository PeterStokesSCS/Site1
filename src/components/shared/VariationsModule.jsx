import { useState, useEffect, useRef } from "react";
import BackHeader from "./BackHeader";
import { EmptyState } from "./LoadingScreen";
import FileUploadButton from "./FileUploadButton";
import letterheadUrl from "../../assets/letterhead.png";
import { getVariations, createVariation, updateVariation, deleteVariation, getProfiles, getSubbieRequests, updateSubbieRequest, createPurchaseOrder, getPurchaseOrders } from "../../lib/db";
import { uploadFile } from "../../lib/storage";
import { post } from "../../lib/webhook";
import { downloadPdf, generatePdfBlob } from "../../lib/variationPdf";
import { emptyLine, lineClient, lineCost, computeTotals, money, nextRef, pushAudit, approvedVariationsTotal } from "../../lib/variationCalc";

// Human-readable labels for audit/revision events.
const EVENT_LABELS = {
  created: "Created", edited: "Edited", approved_for_issue: "Approved for issue",
  sent_to_client: "Sent to client", issued: "Issued to client", reverted_to_draft: "Recalled to draft",
  superseded: "Superseded", created_revision: "Revision created", signed_pdf_saved: "Signed PDF saved",
  approved: "Approved by client", rejected: "Rejected by client",
};
const isUuid = (s) => typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(s);
function whoLabel(by, nameMap) {
  if (!by) return "—";
  if (isUuid(by)) return nameMap?.[by] || "Staff";
  return by; // client sign-offs store the typed name directly
}
function nextRevLabel(old) {
  const m = (old.revision_label || "").match(/Rev\s*([A-Z])/i);
  return m ? "Rev " + String.fromCharCode(m[1].toUpperCase().charCodeAt(0) + 1) : "Rev A";
}
// Merge audit_trail + revision_history into one sorted timeline.
function buildTimeline(v) {
  const a = (v.audit_trail || []).map(e => ({ event: e.event, by: e.by, at: e.at, note: e.notes }));
  const r = (v.revision_history || []).map(e => ({ event: e.action, by: e.by, at: e.at, note: e.reason }));
  // de-dupe issued/sent that appear in both trails at the same time
  const all = [...a, ...r].filter(e => e.at);
  return all.sort((x, y) => new Date(x.at) - new Date(y.at));
}

// Legal acceptance wording (have solicitor confirm before go-live).
export const LEGAL_ACCEPTANCE = "Please review and approve this variation if you wish to confirm the adjustment to your original scope of works. Under the terms of your building contract, this variation constitutes a formal change to the agreed scope and contract sum. By approving, you acknowledge the adjustment to the construction program and agree that the variation amount will be invoiced upon approval or included in a subsequent progress claim. Prompt approval is appreciated to avoid delays to the project program. This variation has been issued in accordance with the Domestic Building Contracts Act 1995 (Vic).";

const inp = { width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#f0f0f0", fontSize: 14, padding: "10px 12px", fontFamily: "DM Sans, sans-serif", boxSizing: "border-box" };
const lbl = { fontSize: 11, color: "#777", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Barlow Condensed, sans-serif", marginBottom: 5, display: "block" };

const STATUS = {
  draft:             { label: "Draft",             color: "#888",    bg: "#1a1a1a" },
  pending:           { label: "Pending Approval",  color: "#f59e0b", bg: "#251d00" },
  approved_for_issue:{ label: "Approved for Issue",color: "#a855f7", bg: "#1a0c33" },
  sent:              { label: "Awaiting Sign-off", color: "#0ea5e9", bg: "#0c2233" },
  approved:          { label: "Approved",          color: "#22c55e", bg: "#06200e" },
  rejected:          { label: "Rejected",          color: "#ef4444", bg: "#2a0c0c" },
  superseded:        { label: "Superseded",        color: "#888",    bg: "#1a1a1a" },
};
function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.draft;
  return <span style={{ fontSize: 10, fontFamily: "Barlow Condensed, sans-serif", color: s.color, background: s.bg, padding: "2px 8px", borderRadius: 4, textTransform: "uppercase", whiteSpace: "nowrap" }}>{s.label}</span>;
}
function AttachLink({ url }) {
  if (!url) return null;
  const isImg = /\.(jpe?g|png|gif|webp|heic)$/i.test(url);
  return <a href={url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 12, color: "#3b82f6", textDecoration: "none" }}><span>{isImg ? "🖼" : "📎"}</span> View attachment</a>;
}

// ── Cost line item row ─────────────────────────────────────────────────────────
function LineRow({ li, onChange, onRemove, canSeeMargin }) {
  const client = lineClient(li);
  const margin = client - lineCost(li);
  return (
    <div style={{ background: "#141414", border: "1px solid #232323", borderRadius: 10, padding: 12, marginBottom: 8 }}>
      <input value={li.description} onChange={e => onChange({ ...li, description: e.target.value })} placeholder="Line item description" style={{ ...inp, marginBottom: 8 }} />
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {["margin", "direct"].map(m => (
          <button key={m} onClick={() => onChange({ ...li, mode: m })} style={{ flex: 1, padding: "7px", borderRadius: 7, border: `1px solid ${li.mode === m ? "#6366f1" : "#2a2a2a"}`, background: li.mode === m ? "#6366f122" : "transparent", color: li.mode === m ? "#a5b4fc" : "#777", fontFamily: "Barlow Condensed, sans-serif", fontSize: 12, cursor: "pointer", textTransform: "uppercase" }}>{m === "margin" ? "Cost + Margin %" : "Direct Price"}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={lbl}>{canSeeMargin ? "Builder cost $" : "Cost $"}</label>
          <input value={li.cost} onChange={e => onChange({ ...li, cost: e.target.value })} type="number" placeholder="0" style={inp} />
        </div>
        {li.mode === "margin" ? (
          <div style={{ flex: 1 }}>
            <label style={lbl}>Margin %</label>
            <input value={li.margin_pct} onChange={e => onChange({ ...li, margin_pct: e.target.value })} type="number" placeholder="0" style={inp} />
          </div>
        ) : (
          <div style={{ flex: 1 }}>
            <label style={lbl}>Client price $</label>
            <input value={li.client_amount} onChange={e => onChange({ ...li, client_amount: e.target.value })} type="number" placeholder="0" style={inp} />
          </div>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
        <button onClick={() => onChange({ ...li, gst_exempt: !li.gst_exempt })} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
          <div style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${li.gst_exempt ? "#f59e0b" : "#444"}`, background: li.gst_exempt ? "#f59e0b" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>{li.gst_exempt && <span style={{ color: "#000", fontSize: 10, fontWeight: 700 }}>✓</span>}</div>
          <span style={{ fontSize: 12, color: li.gst_exempt ? "#f59e0b" : "#888" }}>GST exempt</span>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "#e07b39", fontFamily: "Barlow Condensed, sans-serif" }}>{money(client)}{!li.gst_exempt && " +GST"}</span>
          {canSeeMargin && <span style={{ fontSize: 11, color: margin >= 0 ? "#22c55e" : "#ef4444" }}>m {money(margin)}</span>}
          <button onClick={onRemove} style={{ background: "transparent", border: "none", color: "#ef4444", fontSize: 16, cursor: "pointer" }}>✕</button>
        </div>
      </div>
    </div>
  );
}

// ── Create / edit form ─────────────────────────────────────────────────────────
function VariationForm({ project, user, existing, initial, vars, onSaved, onCancel, canSeeMargin }) {
  const [form, setForm] = useState(() => existing ? {
    title: existing.title || "", reason: existing.reason || "", description: existing.description || "",
    lines: (existing.line_items?.length ? existing.line_items : [emptyLine()]),
    eot: !!existing.eot, eot_days: existing.eot_days || "", eot_description: existing.eot_description || "",
    instruction_note: existing.instruction_note || "", attachments: existing.attachments || [],
  } : {
    title: initial?.title || "", reason: initial?.reason || "", description: initial?.description || "",
    lines: [emptyLine()], eot: false, eot_days: "", eot_description: "",
    instruction_note: initial?.instruction_note || "", attachments: initial?.attachments || [],
  });
  const [saving, setSaving] = useState(false);

  const totals = computeTotals(form.lines);
  const originalContract = project.budget || 0;
  const approvedToDate = approvedVariationsTotal(vars);
  const revised = originalContract + approvedToDate + totals.total;

  const setLine = (i, li) => setForm(f => ({ ...f, lines: f.lines.map((x, idx) => idx === i ? li : x) }));
  const addLine = () => setForm(f => ({ ...f, lines: [...f.lines, emptyLine()] }));
  const removeLine = (i) => setForm(f => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }));

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const cleanLines = form.lines.filter(l => l.description.trim() || l.cost || l.client_amount);
    const payload = {
      title: form.title.trim(), reason: form.reason.trim() || null, description: form.description.trim() || null,
      line_items: cleanLines,
      subtotal: totals.subtotal, gst_amount: totals.gst, total_inc_gst: totals.total,
      builder_cost: totals.builderCost, margin_amount: totals.margin, client_total: totals.subtotal,
      amount: totals.total,
      eot: form.eot, eot_days: form.eot ? (parseInt(form.eot_days) || null) : null, eot_description: form.eot ? (form.eot_description.trim() || null) : null,
      instruction_note: form.instruction_note.trim() || null, attachments: form.attachments,
    };
    let result;
    if (existing) {
      result = await updateVariation(existing.id, { ...payload, audit_trail: pushAudit(existing.audit_trail, "edited", user.id) });
    } else {
      const ref = nextRef(project.job_number, vars.length);
      result = await createVariation({
        project_id: project.id, ref, status: "draft", raised_by: user.id,
        audit_trail: pushAudit([], "created", user.id), revision_history: [],
        ...payload,
      });
    }
    setSaving(false);
    if (result.data) onSaved(result.data, !existing);
  };

  return (
    <div style={{ background: "#101010", border: "1px solid #2a2a2a", borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 18, color: "#f0f0f0", marginBottom: 4 }}>{existing ? `Edit ${existing.ref}` : `New Variation · ${nextRef(project.job_number, vars.length)}`}</div>
      <div style={{ fontSize: 12, color: "#666", marginBottom: 14 }}>{project.job_number} · {project.client_name || "Client"} · {project.street}</div>

      <label style={lbl}>Title *</label>
      <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Variation title" style={{ ...inp, marginBottom: 12 }} />

      <label style={lbl}>Description / scope of works</label>
      <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Detailed scope of works" rows={3} style={{ ...inp, resize: "vertical", marginBottom: 12 }} />

      <label style={lbl}>Reason for variation</label>
      <input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Why is this variation required" style={{ ...inp, marginBottom: 16 }} />

      {/* Cost line items */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={lbl}>Cost line items</span>
        <button onClick={addLine} style={{ background: "transparent", border: "1px solid #6366f1", borderRadius: 7, color: "#a5b4fc", fontFamily: "Barlow Condensed, sans-serif", fontSize: 12, padding: "5px 10px", cursor: "pointer" }}>+ ADD LINE</button>
      </div>
      {form.lines.map((li, i) => <LineRow key={li.id} li={li} onChange={(x) => setLine(i, x)} onRemove={() => removeLine(i)} canSeeMargin={canSeeMargin} />)}

      {/* Totals */}
      <div style={{ background: "#141414", border: "1px solid #232323", borderRadius: 10, padding: "12px 14px", margin: "8px 0 16px" }}>
        <Row l="Subtotal (ex GST)" v={money(totals.subtotal)} />
        <Row l="GST (10%)" v={money(totals.gst)} />
        <Row l="Total inc GST" v={money(totals.total)} bold color="#e07b39" />
        {canSeeMargin && (
          <div style={{ borderTop: "1px dashed #2a2a2a", marginTop: 8, paddingTop: 8 }}>
            <Row l="Builder cost (internal)" v={money(totals.builderCost)} small />
            <Row l={`Margin (internal · ${totals.marginPct}%)`} v={money(totals.margin)} small color={totals.margin >= 0 ? "#22c55e" : "#ef4444"} />
          </div>
        )}
      </div>

      {/* Running contract sum */}
      <div style={{ background: "#0c1a33", border: "1px solid #0ea5e944", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "#7aa7d9", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Barlow Condensed, sans-serif", marginBottom: 8 }}>Running contract sum</div>
        <Row l="Original contract" v={money(originalContract)} small />
        <Row l="Approved variations to date" v={money(approvedToDate)} small />
        <Row l="This variation" v={money(totals.total)} small />
        <Row l="Revised contract total" v={money(revised)} bold color="#0ea5e9" />
      </div>

      {/* EOT */}
      <button onClick={() => setForm(f => ({ ...f, eot: !f.eot }))} style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", cursor: "pointer", padding: "0 0 12px" }}>
        <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${form.eot ? "#f59e0b" : "#444"}`, background: form.eot ? "#f59e0b" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>{form.eot && <span style={{ color: "#000", fontSize: 11, fontWeight: 700 }}>✓</span>}</div>
        <span style={{ fontSize: 13, color: form.eot ? "#f59e0b" : "#888" }}>Extension of time (EOT) claimed</span>
      </button>
      {form.eot && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <div style={{ width: 110 }}><label style={lbl}>Days</label><input value={form.eot_days} onChange={e => setForm(f => ({ ...f, eot_days: e.target.value }))} type="number" placeholder="0" style={inp} /></div>
          <div style={{ flex: 1 }}><label style={lbl}>Basis for EOT</label><input value={form.eot_description} onChange={e => setForm(f => ({ ...f, eot_description: e.target.value }))} placeholder="Reason / basis" style={inp} /></div>
        </div>
      )}

      {/* Client instruction / evidence */}
      <label style={lbl}>Client instruction / evidence</label>
      <textarea value={form.instruction_note} onChange={e => setForm(f => ({ ...f, instruction_note: e.target.value }))} placeholder="Note describing the client instruction / authority for this variation" rows={2} style={{ ...inp, resize: "vertical", marginBottom: 8 }} />
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <FileUploadButton folder={`variations/${project.id}`} accept="application/pdf,image/*" label="📎 Attach" color="#6366f1" onUploaded={(url) => setForm(f => ({ ...f, attachments: [...f.attachments, url] }))} />
        <FileUploadButton folder={`variations/${project.id}`} accept="image/*" capture="environment" label="📷 Photo" color="#a855f7" onUploaded={(url) => setForm(f => ({ ...f, attachments: [...f.attachments, url] }))} />
        {form.attachments.length > 0 && <span style={{ fontSize: 12, color: "#22c55e" }}>✓ {form.attachments.length} attached</span>}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={save} disabled={saving || !form.title.trim()} style={{ flex: 1, padding: "12px", borderRadius: 8, border: "none", background: form.title.trim() ? "#6366f1" : "#222", color: form.title.trim() ? "#fff" : "#555", fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, cursor: form.title.trim() ? "pointer" : "not-allowed" }}>{saving ? "SAVING…" : existing ? "SAVE CHANGES" : "SAVE DRAFT"}</button>
        <button onClick={onCancel} style={{ padding: "12px 18px", borderRadius: 8, border: "1px solid #333", background: "transparent", color: "#888", fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, cursor: "pointer" }}>CANCEL</button>
      </div>
    </div>
  );
}

function Row({ l, v, bold, small, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: small ? "3px 0" : "5px 0" }}>
      <span style={{ fontSize: small ? 12 : 13, color: "#999" }}>{l}</span>
      <span style={{ fontSize: bold ? 18 : small ? 13 : 14, color: color || "#f0f0f0", fontFamily: bold ? "Barlow Condensed, sans-serif" : "DM Sans, sans-serif", fontWeight: bold ? 700 : 400 }}>{v}</span>
    </div>
  );
}

// ── Formatted variation document (matches the eventual PDF) ────────────────────
const SECT = { fontSize: 11, color: "#e07b39", textTransform: "uppercase", letterSpacing: 0.6, fontFamily: "Barlow Condensed, sans-serif", margin: "16px 0 6px" };

function VariationPreview({ variation: v, project, vars, user, canSeeMargin, nameMap, onBack, onEdit, onPatch, onRevise }) {
  const [busy, setBusy] = useState(false);
  const [pdfMsg, setPdfMsg] = useState(null);
  const [showAudit, setShowAudit] = useState(false);
  const docRef = useRef(null);

  const doDownload = async () => {
    setPdfMsg("Generating…");
    try { await downloadPdf(docRef.current, v.ref || "variation"); setPdfMsg(null); }
    catch (e) { setPdfMsg("PDF failed: " + (e.message || "error")); }
  };

  // Generate the signed PDF, store it, and save its URL against the variation.
  const saveSignedPdf = async () => {
    setPdfMsg("Generating signed PDF…");
    try {
      const blob = await generatePdfBlob(docRef.current);
      const { url, error } = await uploadFile(blob, `variations/${project.id}`, "pdf");
      if (error) throw error;
      await onPatch(v, { signed_pdf_url: url, audit_trail: pushAudit(v.audit_trail, "signed_pdf_saved", user.id) });
      setPdfMsg(null);
    } catch (e) { setPdfMsg("Save failed: " + (e.message || "error")); }
  };
  const t = (v.line_items?.length) ? computeTotals(v.line_items) : { subtotal: v.subtotal || 0, gst: v.gst_amount || 0, total: v.total_inc_gst ?? v.amount ?? 0 };
  const original = project.budget || 0;
  const approvedExcl = vars.filter(x => x.status === "approved" && x.id !== v.id).reduce((s, x) => s + (Number(x.total_inc_gst ?? x.amount) || 0), 0);
  const revised = original + approvedExcl + t.total;
  const s = STATUS[v.status] || STATUS.draft;
  const locked = v.status === "approved";
  const timeline = buildTimeline(v);

  const act = async (patch) => { setBusy(true); await onPatch(v, patch); setBusy(false); };
  const approveForIssue = () => act({ status: "approved_for_issue", audit_trail: pushAudit(v.audit_trail, "approved_for_issue", user.id) });
  const sendToClient = () => {
    act({ status: "sent", sent_at: new Date().toISOString(), audit_trail: pushAudit(v.audit_trail, "sent_to_client", user.id), revision_history: pushAudit(v.revision_history, "issued", user.id) });
    // Fire-and-forget routing event (no-op until VITE_WEBHOOK_BASE / n8n is connected).
    post("/variations/issued", { variation_id: v.id, ref: v.ref, project_id: project.id, project: project.street, client_name: project.client_name, client_email: project.client_email, title: v.title, total_inc_gst: v.total_inc_gst ?? v.amount }).catch(() => {});
  };
  const revertDraft = () => act({ status: "draft", audit_trail: pushAudit(v.audit_trail, "reverted_to_draft", user.id) });
  const notifySupervisor = () => {
    post("/variations/notify-supervisor", { variation_id: v.id, ref: v.ref, project_id: project.id, title: v.title, scope: v.description, eot: v.eot, eot_days: v.eot_days, eot_description: v.eot_description }).catch(() => {});
    setPdfMsg("Supervisor notified (scope + EOT only)");
    setTimeout(() => setPdfMsg(null), 2500);
  };

  const labelStyle = { fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: 0.4, fontFamily: "Barlow Condensed, sans-serif" };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title={v.ref || "Variation"} subtitle="Document preview" onBack={onBack} />

      {/* PDF toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderBottom: "1px solid #1e1e1e", background: "#0c0c0c", flexWrap: "wrap" }}>
        <button onClick={doDownload} style={{ ...pbtn("#6366f1", true), flex: "0 0 auto", padding: "8px 14px", fontSize: 13 }}>⬇ Download PDF</button>
        {v.status === "approved" && !v.signed_pdf_url && <button onClick={saveSignedPdf} style={{ ...pbtn("#22c55e", true), flex: "0 0 auto", padding: "8px 14px", fontSize: 13 }}>💾 Save signed PDF</button>}
        {v.signed_pdf_url && <a href={v.signed_pdf_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#22c55e", textDecoration: "none", fontFamily: "Barlow Condensed, sans-serif" }}>✓ Signed PDF saved — view ↗</a>}
        {pdfMsg && <span style={{ fontSize: 12, color: "#888" }}>{pdfMsg}</span>}
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* The document — white page, A4-ish, centred */}
        <div style={{ maxWidth: 620, margin: "0 auto", padding: 12 }}>
          <div ref={docRef} style={{ background: "#fff", color: "#1c1c1c", borderRadius: 6, overflow: "hidden", fontFamily: "DM Sans, sans-serif" }}>
            <img src={letterheadUrl} alt="Stokes Construction Services" style={{ width: "100%", display: "block" }} />
            {/* Charcoal status bar */}
            <div style={{ background: "#2c2c2c", color: "#fff", padding: "8px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: "Barlow Condensed, sans-serif", letterSpacing: 0.5, fontSize: 13 }}>Variation Notice · Stokes Construction Services</span>
              <span style={{ fontSize: 10, fontFamily: "Barlow Condensed, sans-serif", textTransform: "uppercase", color: "#fff", background: s.color, padding: "3px 9px", borderRadius: 4 }}>{s.label}</span>
            </div>

            <div style={{ padding: "16px 20px 22px" }}>
              {/* Project / client block */}
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: 12 }}>
                <div>
                  <div style={labelStyle}>Project</div>
                  <div style={{ fontWeight: 600 }}>{project.street}</div>
                  <div style={{ marginTop: 6, ...labelStyle }}>Client</div>
                  <div>{project.client_name || "—"}</div>
                  {project.client_phone && <div style={{ color: "#555" }}>{project.client_phone}</div>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={labelStyle}>Site address</div>
                  <div>{[project.street, project.suburb].filter(Boolean).join(", ")}</div>
                  <div style={{ marginTop: 6, ...labelStyle }}>Date issued</div>
                  <div>{new Date(v.sent_at || v.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}</div>
                </div>
              </div>

              <div style={{ borderTop: "2px solid #2c2c2c", margin: "16px 0 10px" }} />
              <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 26, fontWeight: 700, color: "#1c1c1c" }}>{v.ref}{v.revision_label ? ` ${v.revision_label}` : ""}</div>
              <div style={{ fontSize: 16, color: "#333", marginTop: 2 }}>{v.title}</div>

              {v.description && (<><div style={SECT}>Description of works</div><div style={{ fontSize: 13, lineHeight: 1.5, color: "#333", whiteSpace: "pre-wrap" }}>{v.description}</div></>)}
              {v.reason && (<><div style={SECT}>Reason for variation</div><div style={{ fontSize: 13, lineHeight: 1.5, color: "#333" }}>{v.reason}</div></>)}
              {v.eot && (<><div style={SECT}>Extension of time</div><div style={{ fontSize: 13, color: "#333" }}>{v.eot_days || "?"} day{v.eot_days === 1 ? "" : "s"}{v.eot_description ? ` — ${v.eot_description}` : ""}</div></>)}

              {/* Cost table */}
              <div style={SECT}>Cost breakdown</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <tbody>
                  {(v.line_items?.length ? v.line_items : [{ id: "x", description: v.title, client_amount: t.total, mode: "direct" }]).map(li => (
                    <tr key={li.id} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "7px 4px", color: "#333" }}>{li.description || "—"}{li.gst_exempt ? " (GST exempt)" : ""}</td>
                      <td style={{ padding: "7px 4px", textAlign: "right", color: "#333", whiteSpace: "nowrap" }}>{money(lineClient(li))}</td>
                    </tr>
                  ))}
                  <tr><td style={{ padding: "7px 4px", textAlign: "right", color: "#666" }}>Subtotal</td><td style={{ padding: "7px 4px", textAlign: "right", color: "#333" }}>{money(t.subtotal)}</td></tr>
                  <tr><td style={{ padding: "4px", textAlign: "right", color: "#666" }}>GST (10%)</td><td style={{ padding: "4px", textAlign: "right", color: "#333" }}>{money(t.gst)}</td></tr>
                  <tr style={{ background: "#2c2c2c", color: "#fff" }}><td style={{ padding: "9px 8px", fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, letterSpacing: 0.5 }}>TOTAL VARIATION AMOUNT</td><td style={{ padding: "9px 8px", textAlign: "right", fontFamily: "Barlow Condensed, sans-serif", fontSize: 17 }}>{money(t.total)}</td></tr>
                </tbody>
              </table>

              {/* Running contract sum */}
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 10, fontSize: 12, background: "#f4f4f4", borderRadius: 6, padding: "10px 12px" }}>
                <div><div style={labelStyle}>Original contract</div><div>{money(original)}</div></div>
                <div><div style={labelStyle}>Approved to date</div><div>{money(approvedExcl)}</div></div>
                <div style={{ textAlign: "right" }}><div style={labelStyle}>Revised total</div><div style={{ fontWeight: 700, color: "#1c1c1c" }}>{money(revised)}</div></div>
              </div>

              {v.attachments?.length > 0 && (<><div style={SECT}>Supporting documents</div>{v.attachments.map((u, i) => <div key={i} style={{ fontSize: 12, color: "#2563eb" }}><a href={u} target="_blank" rel="noreferrer" style={{ color: "#2563eb", textDecoration: "none" }}>📎 Attachment {i + 1}</a></div>)}</>)}

              {/* Legal */}
              <div style={{ fontSize: 11, color: "#555", lineHeight: 1.5, marginTop: 16, paddingTop: 12, borderTop: "1px solid #eee" }}>{LEGAL_ACCEPTANCE}</div>

              {/* Signature block */}
              <div style={SECT}>Client approval</div>
              <div style={{ fontSize: 11, color: "#666", marginBottom: 10 }}>By signing below you confirm your acceptance of this variation, including the adjusted scope, cost, and time impact.</div>
              <div style={{ display: "flex", gap: 12, fontSize: 12 }}>
                <div style={{ flex: 1 }}><div style={{ borderBottom: "1px solid #999", minHeight: 26, color: "#1c1c1c", fontFamily: "Barlow Condensed, sans-serif", fontSize: 18 }}>{v.client_signature || ""}</div><div style={labelStyle}>Signature</div></div>
                <div style={{ flex: 1 }}><div style={{ borderBottom: "1px solid #999", minHeight: 26 }}>{v.client_signature || ""}</div><div style={labelStyle}>Full name</div></div>
                <div style={{ width: 110 }}><div style={{ borderBottom: "1px solid #999", minHeight: 26 }}>{v.approval_date ? new Date(v.approval_date).toLocaleDateString("en-AU") : ""}</div><div style={labelStyle}>Date</div></div>
              </div>
              {v.status === "approved" && <div style={{ marginTop: 10, fontSize: 11, color: "#16a34a", fontWeight: 600 }}>✓ Approved &amp; locked{v.approval_date ? ` — ${new Date(v.approval_date).toLocaleString("en-AU")}` : ""}</div>}

              <div style={{ marginTop: 18, paddingTop: 10, borderTop: "1px solid #eee", display: "flex", justifyContent: "space-between", fontSize: 9, color: "#999", fontFamily: "Barlow Condensed, sans-serif" }}>
                <span>Generated by SITE1 · Document ID: {v.ref}</span><span>ABN 31 607 685 870 · VBA CDB-U 73867</span>
              </div>
            </div>
          </div>
        </div>

        {/* Audit history (internal — never shown on the PDF) */}
        <div style={{ maxWidth: 620, margin: "0 auto", padding: "0 12px 20px" }}>
          <button onClick={() => setShowAudit(x => !x)} style={{ width: "100%", textAlign: "left", background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "12px 14px", cursor: "pointer", color: "#888", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, letterSpacing: 0.4, textTransform: "uppercase", display: "flex", justifyContent: "space-between" }}>
            <span>📜 Audit history ({timeline.length})</span><span>{showAudit ? "▲" : "▼"}</span>
          </button>
          {showAudit && (
            <div style={{ background: "#0f0f0f", border: "1px solid #1e1e1e", borderTop: "none", borderRadius: "0 0 10px 10px", padding: "4px 14px 12px" }}>
              {timeline.length === 0 ? <div style={{ fontSize: 12, color: "#555", padding: "8px 0" }}>No history yet</div> :
                timeline.map((e, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, padding: "7px 0", borderBottom: i < timeline.length - 1 ? "1px solid #181818" : "none" }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#e07b39", marginTop: 5, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: "#ccc" }}>{EVENT_LABELS[e.event] || e.event}{e.note ? <span style={{ color: "#777" }}> — {e.note}</span> : ""}</div>
                      <div style={{ fontSize: 11, color: "#555" }}>{whoLabel(e.by, nameMap)} · {new Date(e.at).toLocaleString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                    </div>
                  </div>
                ))}
              {(v.approval_ip || v.approval_device) && (
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid #181818", fontSize: 10, color: "#555" }}>
                  Sign-off metadata: {v.approval_ip ? `IP ${v.approval_ip}` : "IP n/a"}{v.approval_device ? ` · ${v.approval_device.slice(0, 70)}` : ""}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Builder action bar */}
      {!locked && (
        <div style={{ display: "flex", gap: 8, padding: "12px 16px 22px", borderTop: "1px solid #1e1e1e", background: "#0c0c0c" }}>
          {(v.status === "draft" || v.status === "pending") && <>
            <button onClick={() => onEdit(v)} disabled={busy} style={pbtn("#3b82f6")}>✎ Edit Draft</button>
            <button onClick={approveForIssue} disabled={busy} style={pbtn("#a855f7", true)}>✓ Approve for Issue</button>
          </>}
          {v.status === "approved_for_issue" && <>
            <button onClick={revertDraft} disabled={busy} style={pbtn("#888")}>↩ Revert</button>
            <button onClick={sendToClient} disabled={busy} style={pbtn("#0ea5e9", true)}>✍ Send to Client</button>
          </>}
          {v.status === "sent" && <>
            <span style={{ flex: 1, alignSelf: "center", fontSize: 12, color: "#0ea5e9", fontFamily: "Barlow Condensed, sans-serif" }}>Awaiting client sign-off…</span>
            <button onClick={revertDraft} disabled={busy} style={pbtn("#888")}>↩ Recall to Draft</button>
          </>}
          {v.status === "rejected" && <>
            <button onClick={notifySupervisor} disabled={busy} style={pbtn("#f59e0b")}>🔔 Notify Supervisor</button>
            <button onClick={() => onRevise(v)} disabled={busy} style={pbtn("#3b82f6", true)}>↻ Create Revision</button>
          </>}
        </div>
      )}
      {v.status === "superseded" && (
        <div style={{ padding: "12px 16px 22px", borderTop: "1px solid #1e1e1e", background: "#0c0c0c", fontSize: 12, color: "#888", textAlign: "center" }}>
          This version has been superseded by a newer revision.
        </div>
      )}
    </div>
  );
}
function pbtn(color, filled) {
  return { flex: 1, padding: "12px", borderRadius: 10, border: filled ? "none" : `1px solid ${color}66`, background: filled ? color : "transparent", color: filled ? "#fff" : color, fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, cursor: "pointer", letterSpacing: 0.3 };
}

// ── Issue a subbie PO (builder's cost to the subbie, excludes margin) ──────────
function PoIssueForm({ variation: v, request, onIssue, onCancel }) {
  const [fields, setFields] = useState({ trade: request?.trade || "", scope: v.description || v.title || "", po_value: v.builder_cost ?? "" });
  const [saving, setSaving] = useState(false);
  const go = async () => { setSaving(true); await onIssue(v, request, fields); setSaving(false); };
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Issue Purchase Order" subtitle={`${v.ref}-PO`} onBack={onCancel} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        <div style={{ background: "#101010", border: "1px solid #2a2a2a", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>To: <b style={{ color: "#ccc" }}>{request?.submitted_by?.full_name || "Subcontractor"}</b>{request?.submitted_by?.company ? ` · ${request.submitted_by.company}` : ""}</div>
          <label style={lbl}>Trade</label>
          <input value={fields.trade} onChange={e => setFields(f => ({ ...f, trade: e.target.value }))} placeholder="Trade" style={{ ...inp, marginBottom: 12 }} />
          <label style={lbl}>Scope of works (subbie's trade only)</label>
          <textarea value={fields.scope} onChange={e => setFields(f => ({ ...f, scope: e.target.value }))} rows={4} style={{ ...inp, resize: "vertical", marginBottom: 12 }} />
          <label style={lbl}>PO value $ (your cost to the subbie — excludes margin, not shown to client)</label>
          <input value={fields.po_value} onChange={e => setFields(f => ({ ...f, po_value: e.target.value }))} type="number" placeholder="0" style={{ ...inp, marginBottom: 8 }} />
          {v.eot && <div style={{ fontSize: 12, color: "#f59e0b", marginBottom: 8 }}>⏱ EOT carried from variation: {v.eot_days || "?"} day(s){v.eot_description ? ` — ${v.eot_description}` : ""}</div>}
          <button onClick={go} disabled={saving} style={{ width: "100%", marginTop: 8, padding: "13px", borderRadius: 10, border: "none", background: "#22c55e", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, cursor: "pointer", letterSpacing: 0.3 }}>{saving ? "ISSUING…" : "ISSUE PURCHASE ORDER"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Variations list (builder console) ──────────────────────────────────────────
export default function VariationsList({ project, user, onBack }) {
  const [vars, setVars] = useState(null);
  const [editing, setEditing] = useState(null);   // variation being edited, or "new"
  const [preview, setPreview] = useState(null);    // variation shown as formatted document
  const [confirmDel, setConfirmDel] = useState(null);

  const canCreate = user.role === "builder" || user.role === "office";
  const canSeeMoney = user.role === "builder" || user.role === "office";
  const canSeeMargin = user.role === "builder" || user.role === "office";

  const [nameMap, setNameMap] = useState({});
  const [allReqs, setAllReqs] = useState([]);     // every subbie request (any status)
  const [pos, setPos] = useState([]);             // purchase orders for this project
  const [convertReq, setConvertReq] = useState(null); // request being converted to a draft
  const [rejectReq, setRejectReq] = useState(null);   // request id pending rejection
  const [rejectReason, setRejectReason] = useState("");
  const [poForVar, setPoForVar] = useState(null);     // { variation, request } pending PO issue

  const subReqs = allReqs.filter(r => r.status === "submitted");
  const reqByVariation = Object.fromEntries(allReqs.filter(r => r.linked_variation_id).map(r => [r.linked_variation_id, r]));
  const poByVariation = Object.fromEntries(pos.filter(p => p.variation_id).map(p => [p.variation_id, p]));

  const load = () => getVariations(project.id).then(({ data }) => setVars(data));
  const loadReqs = () => getSubbieRequests(project.id).then(({ data }) => setAllReqs(data || []));
  const loadPos = () => getPurchaseOrders(project.id).then(({ data }) => setPos(data || []));
  useEffect(() => {
    load();
    loadReqs();
    loadPos();
    getProfiles().then(({ data }) => setNameMap(Object.fromEntries((data || []).map(p => [p.id, p.full_name || "Staff"]))));
  }, [project.id]);

  // Issue a PO to the subbie on an approved variation (PO value = builder cost, excl margin).
  const issuePo = async (v, req, fields) => {
    const payload = {
      project_id: project.id, variation_id: v.id, subbie_id: req?.submitted_by?.id || req?.submitted_by || null,
      po_number: `${v.ref}-PO`, trade: fields.trade || req?.trade || null, scope: fields.scope || v.description || v.title,
      eot: !!v.eot, eot_days: v.eot_days || null, eot_description: v.eot_description || null,
      po_value: parseFloat(fields.po_value) || 0, gst_treatment: "10%", status: "issued", created_by: user.id,
    };
    const { data: po } = await createPurchaseOrder(payload);
    if (po) {
      setPos(prev => [po, ...prev]);
      if (req) { await updateSubbieRequest(req.id, { status: "approved" }); setAllReqs(prev => prev.map(r => r.id === req.id ? { ...r, status: "approved" } : r)); }
      post("/po/issued", { po_number: po.po_number, project_id: project.id, variation_id: v.id, subbie_id: payload.subbie_id, po_value: payload.po_value, scope: payload.scope }).catch(() => {});
    }
    setPoForVar(null);
  };

  // Convert a subbie request into a pre-filled draft variation, linking the two.
  const onConvertSaved = async (v, isNew, req) => {
    onSaved(v, isNew);
    setConvertReq(null);
    await updateSubbieRequest(req.id, { status: "converted", linked_variation_id: v.id });
    setSubReqs(prev => prev.filter(r => r.id !== req.id));
  };
  const doReject = async (req) => {
    await updateSubbieRequest(req.id, { status: "rejected", rejection_reason: rejectReason.trim() || "Not approved" });
    setSubReqs(prev => prev.filter(r => r.id !== req.id));
    setRejectReq(null); setRejectReason("");
  };

  const onSaved = (v, isNew) => {
    setVars(prev => isNew ? [v, ...(prev || [])] : prev.map(x => x.id === v.id ? { ...x, ...v } : x));
    setEditing(null);
  };

  // Create a new revision of a (rejected/superseded) variation. Original is preserved
  // and marked superseded; the new draft carries the same VO number with the next Rev label.
  const revise = async (old) => {
    const label = nextRevLabel(old);
    const { data: created } = await createVariation({
      project_id: project.id, ref: old.ref, revision_label: label, status: "draft", raised_by: user.id,
      title: old.title, description: old.description, reason: old.reason, line_items: old.line_items || [],
      subtotal: old.subtotal, gst_amount: old.gst_amount, total_inc_gst: old.total_inc_gst, amount: old.amount,
      builder_cost: old.builder_cost, margin_amount: old.margin_amount, client_total: old.client_total,
      eot: old.eot, eot_days: old.eot_days, eot_description: old.eot_description,
      instruction_note: old.instruction_note, attachments: old.attachments || [],
      supersedes_id: old.id,
      audit_trail: [{ event: "created_revision", by: user.id, at: new Date().toISOString(), notes: `Revision of ${old.ref}${old.revision_label ? " " + old.revision_label : ""}` }],
      revision_history: [],
    });
    if (!created) return;
    await updateVariation(old.id, { status: "superseded", superseded_by_id: created.id, audit_trail: pushAudit(old.audit_trail, "superseded", user.id) });
    setVars(prev => [created, ...prev.map(x => x.id === old.id ? { ...x, status: "superseded", superseded_by_id: created.id } : x)]);
    setPreview(null);
    setEditing(created);
  };

  // Apply a status/field patch from the preview (and keep both list + preview in sync).
  const patchVar = async (v, patch) => {
    setVars(prev => prev.map(x => x.id === v.id ? { ...x, ...patch } : x));
    setPreview(p => (p && p.id === v.id ? { ...p, ...patch } : p));
    await updateVariation(v.id, patch);
  };

  const remove = async (v) => {
    setVars(prev => prev.filter(x => x.id !== v.id));
    setConfirmDel(null);
    await deleteVariation(v.id);
  };

  const approvedToDate = approvedVariationsTotal(vars || []);
  const revisedTotal = (project.budget || 0) + approvedToDate;
  const editable = (v) => v.status === "draft" || v.status === "pending";

  if (preview) {
    return <VariationPreview variation={preview} project={project} vars={vars || []} user={user} canSeeMargin={canSeeMargin} nameMap={nameMap}
      onBack={() => setPreview(null)} onEdit={(v) => { setPreview(null); setEditing(v); }} onPatch={patchVar} onRevise={revise} />;
  }

  if (poForVar) {
    return <PoIssueForm variation={poForVar.variation} request={poForVar.request} onIssue={issuePo} onCancel={() => setPoForVar(null)} />;
  }

  if (convertReq) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
        <BackHeader title="Convert request" subtitle={`From ${convertReq.submitted_by?.full_name || "subcontractor"}`} onBack={() => setConvertReq(null)} />
        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
          {convertReq.file_url && <a href={convertReq.file_url} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginBottom: 12, fontSize: 12, color: "#3b82f6", textDecoration: "none" }}>📎 View original submission</a>}
          <VariationForm project={project} user={user} vars={vars || []} canSeeMargin={canSeeMargin}
            initial={{ description: convertReq.note || "", reason: convertReq.trade ? `Subcontractor request — ${convertReq.trade}` : "Subcontractor request" }}
            onSaved={(v, isNew) => onConvertSaved(v, isNew, convertReq)} onCancel={() => setConvertReq(null)} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Variations" subtitle={project.street} onBack={onBack}
        rightSlot={canCreate && !editing ? <button onClick={() => setEditing("new")} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer" }}>+ RAISE VARIATION</button> : null}
      />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {editing === "new" && <VariationForm project={project} user={user} vars={vars || []} onSaved={onSaved} onCancel={() => setEditing(null)} canSeeMargin={canSeeMargin} />}
        {editing && editing !== "new" && <VariationForm project={project} user={user} existing={editing} vars={vars || []} onSaved={onSaved} onCancel={() => setEditing(null)} canSeeMargin={canSeeMargin} />}

        {/* Incoming subbie variation requests */}
        {canCreate && !editing && subReqs.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "#0ea5e9", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Barlow Condensed, sans-serif", marginBottom: 8 }}>📨 Subbie requests ({subReqs.length})</div>
            {subReqs.map(r => (
              <div key={r.id} style={{ background: "#0c1822", border: "1px solid #0ea5e944", borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: "#7aa7d9", fontFamily: "Barlow Condensed, sans-serif" }}>{r.submitted_by?.full_name || "Subcontractor"}{r.submitted_by?.company ? ` · ${r.submitted_by.company}` : ""}{r.trade ? ` · ${r.trade}` : ""}</div>
                <div style={{ fontSize: 13, color: "#ccc", marginTop: 4 }}>{r.note || "(attached file)"}</div>
                {r.file_url && <a href={r.file_url} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 6, fontSize: 12, color: "#3b82f6", textDecoration: "none" }}>📎 View submission</a>}
                {rejectReq === r.id ? (
                  <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
                    <input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason (shown to subbie)" style={{ ...inp, flex: 1 }} />
                    <button onClick={() => doReject(r)} style={btn("#ef4444", true)}>Reject</button>
                    <button onClick={() => { setRejectReq(null); setRejectReason(""); }} style={btn("#888")}>Cancel</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    <button onClick={() => setConvertReq(r)} style={btn("#22c55e", true)}>→ Create draft variation</button>
                    <button onClick={() => setRejectReq(r.id)} style={btn("#ef4444")}>Reject</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {vars === null ? [1, 2].map(i => <div key={i} style={{ height: 80, background: "#141414", borderRadius: 10, marginBottom: 8 }} />)
          : vars.length === 0 && !editing ? <EmptyState icon="±" title="No variations yet" subtitle={canCreate ? "Raise one before the work proceeds" : "Variations are managed by the builder"} />
          : !editing && (
            <>
              {canSeeMoney && (
                <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "10px 14px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#888", textTransform: "uppercase", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: 0.5 }}>Revised contract total</span>
                  <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, color: "#e07b39" }}>{money(revisedTotal)}</span>
                </div>
              )}
              {vars.map(v => (
                <div key={v.id} style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "14px", marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: "#555", fontFamily: "Barlow Condensed, sans-serif" }}>{v.ref}{v.revision_label ? ` ${v.revision_label}` : ""}</div>
                      <div style={{ fontSize: 15, color: "#ccc", marginTop: 2 }}>{v.title}</div>
                      {v.description && <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>{v.description}</div>}
                      {v.eot && <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 5 }}>⏱ EOT: {v.eot_days || "?"} day{v.eot_days === 1 ? "" : "s"}{v.eot_description ? ` — ${v.eot_description}` : ""}</div>}
                      {v.attachments?.[0] && <AttachLink url={v.attachments[0]} />}
                    </div>
                    {canSeeMoney && (
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 18, color: "#e07b39" }}>{money(v.total_inc_gst ?? v.amount)}</div>
                        <div style={{ fontSize: 9, color: "#555" }}>inc GST</div>
                        <div style={{ marginTop: 4 }}><StatusBadge status={v.status} /></div>
                        {canSeeMargin && v.margin_amount != null && <div style={{ fontSize: 10, color: "#22c55e", marginTop: 4 }}>m {money(v.margin_amount)}</div>}
                      </div>
                    )}
                  </div>

                  {v.client_approved && (
                    <div style={{ marginTop: 10, background: "#06200e", border: "1px solid #22c55e44", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "#9ae6b4" }}>
                      ✓ Signed by <b>{v.client_signature}</b>{v.approval_date ? ` · ${new Date(v.approval_date).toLocaleString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}` : ""}
                    </div>
                  )}
                  {v.status === "rejected" && v.client_signature && !v.client_approved && (
                    <div style={{ marginTop: 10, background: "#2a0c0c", border: "1px solid #ef444444", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "#f0a0a0" }}>
                      ✕ Declined by <b>{v.client_signature}</b>{v.approval_date ? ` · ${new Date(v.approval_date).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}
                    </div>
                  )}

                  {/* Subbie PO — only on approved variations converted from a subbie request */}
                  {canCreate && v.status === "approved" && reqByVariation[v.id] && (
                    poByVariation[v.id]
                      ? <div style={{ marginTop: 10, background: "#10103a", border: "1px solid #6366f155", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "#a5b4fc" }}>
                          🧾 PO {poByVariation[v.id].po_number} issued to {reqByVariation[v.id].submitted_by?.full_name || "subbie"}{poByVariation[v.id].status === "accepted" ? " · accepted ✓" : ""}
                        </div>
                      : <button onClick={() => setPoForVar({ variation: v, request: reqByVariation[v.id] })} style={{ ...btn("#6366f1", true), marginTop: 10 }}>🧾 Generate Subbie PO</button>
                  )}

                  {canCreate && (
                    <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                      <button onClick={() => setPreview(v)} style={btn("#a855f7", true)}>📄 Open document</button>
                      {editable(v) && <button onClick={() => setEditing(v)} style={btn("#3b82f6")}>✎ Edit</button>}
                      {editable(v) && (confirmDel === v.id
                        ? <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                            <button onClick={() => remove(v)} style={btn("#ef4444", true)}>Confirm delete</button>
                            <button onClick={() => setConfirmDel(null)} style={btn("#888")}>Cancel</button>
                          </span>
                        : <button onClick={() => setConfirmDel(v.id)} style={btn("#ef4444")}>🗑 Delete</button>)}
                      {v.status === "approved_for_issue" && <span style={{ fontSize: 11, color: "#a855f7", fontFamily: "Barlow Condensed, sans-serif", padding: "6px 0" }}>Ready to send — open document</span>}
                      {v.status === "sent" && <span style={{ fontSize: 11, color: "#0ea5e9", fontFamily: "Barlow Condensed, sans-serif", padding: "6px 0" }}>Awaiting client sign-off…</span>}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
      </div>
    </div>
  );
}

function btn(color, filled) {
  return { padding: "6px 11px", borderRadius: 6, border: filled ? "none" : `1px solid ${color}55`, background: filled ? color : "transparent", color: filled ? "#fff" : color, fontFamily: "Barlow Condensed, sans-serif", fontSize: 11, cursor: "pointer", textTransform: "uppercase" };
}
