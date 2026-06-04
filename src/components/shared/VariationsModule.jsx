import { useState, useEffect } from "react";
import BackHeader from "./BackHeader";
import { EmptyState } from "./LoadingScreen";
import FileUploadButton from "./FileUploadButton";
import { getVariations, createVariation, updateVariation, deleteVariation } from "../../lib/db";
import { emptyLine, lineClient, lineCost, computeTotals, money, nextRef, pushAudit, approvedVariationsTotal } from "../../lib/variationCalc";

const inp = { width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#f0f0f0", fontSize: 14, padding: "10px 12px", fontFamily: "DM Sans, sans-serif", boxSizing: "border-box" };
const lbl = { fontSize: 11, color: "#777", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Barlow Condensed, sans-serif", marginBottom: 5, display: "block" };

const STATUS = {
  draft:    { label: "Draft",             color: "#888",    bg: "#1a1a1a" },
  pending:  { label: "Pending Approval",  color: "#f59e0b", bg: "#251d00" },
  sent:     { label: "Awaiting Sign-off", color: "#0ea5e9", bg: "#0c2233" },
  approved: { label: "Approved",          color: "#22c55e", bg: "#06200e" },
  rejected: { label: "Rejected",          color: "#ef4444", bg: "#2a0c0c" },
  superseded:{ label: "Superseded",       color: "#888",    bg: "#1a1a1a" },
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
function VariationForm({ project, user, existing, vars, onSaved, onCancel, canSeeMargin }) {
  const [form, setForm] = useState(() => existing ? {
    title: existing.title || "", reason: existing.reason || "", description: existing.description || "",
    lines: (existing.line_items?.length ? existing.line_items : [emptyLine()]),
    eot: !!existing.eot, eot_days: existing.eot_days || "", eot_description: existing.eot_description || "",
    instruction_note: existing.instruction_note || "", attachments: existing.attachments || [],
  } : { title: "", reason: "", description: "", lines: [emptyLine()], eot: false, eot_days: "", eot_description: "", instruction_note: "", attachments: [] });
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

// ── Variations list (builder console) ──────────────────────────────────────────
export default function VariationsList({ project, user, onBack }) {
  const [vars, setVars] = useState(null);
  const [editing, setEditing] = useState(null);   // variation being edited, or "new"
  const [confirmDel, setConfirmDel] = useState(null);

  const canCreate = user.role === "builder" || user.role === "office";
  const canSeeMoney = user.role === "builder" || user.role === "office";
  const canSeeMargin = user.role === "builder" || user.role === "office";

  const load = () => getVariations(project.id).then(({ data }) => setVars(data));
  useEffect(() => { load(); }, [project.id]);

  const onSaved = (v, isNew) => {
    setVars(prev => isNew ? [v, ...(prev || [])] : prev.map(x => x.id === v.id ? { ...x, ...v } : x));
    setEditing(null);
  };

  const issue = async (v) => {
    const patch = { status: "sent", sent_at: new Date().toISOString(), audit_trail: pushAudit(v.audit_trail, "sent_to_client", user.id), revision_history: pushAudit(v.revision_history, "issued", user.id) };
    setVars(prev => prev.map(x => x.id === v.id ? { ...x, ...patch } : x));
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

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Variations" subtitle={project.street} onBack={onBack}
        rightSlot={canCreate && !editing ? <button onClick={() => setEditing("new")} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer" }}>+ RAISE VARIATION</button> : null}
      />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {editing === "new" && <VariationForm project={project} user={user} vars={vars || []} onSaved={onSaved} onCancel={() => setEditing(null)} canSeeMargin={canSeeMargin} />}
        {editing && editing !== "new" && <VariationForm project={project} user={user} existing={editing} vars={vars || []} onSaved={onSaved} onCancel={() => setEditing(null)} canSeeMargin={canSeeMargin} />}

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

                  {canCreate && (
                    <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                      {editable(v) && <button onClick={() => setEditing(v)} style={btn("#3b82f6")}>✎ Edit</button>}
                      {editable(v) && <button onClick={() => issue(v)} style={btn("#0ea5e9", true)}>✍ Send to client for sign-off</button>}
                      {editable(v) && (confirmDel === v.id
                        ? <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                            <button onClick={() => remove(v)} style={btn("#ef4444", true)}>Confirm delete</button>
                            <button onClick={() => setConfirmDel(null)} style={btn("#888")}>Cancel</button>
                          </span>
                        : <button onClick={() => setConfirmDel(v.id)} style={btn("#ef4444")}>🗑 Delete</button>)}
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
