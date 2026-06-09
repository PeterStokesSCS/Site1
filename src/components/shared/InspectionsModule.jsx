import { useState, useEffect } from "react";
import BackHeader from "./BackHeader";
import { EmptyState } from "./LoadingScreen";
import PhotoAttach from "./PhotoAttach";
import { useFocusRow, FOCUS_HL } from "./useFocusRow";
import { getQaItems, createQaItem, updateQaItem, deleteQaItem, getMilestones } from "../../lib/db";
import { melbourneTodayStr } from "../../lib/actionQueue";
import { inspectionDueSoon } from "../../lib/timeline";

const inp = { width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#f0f0f0", fontSize: 14, padding: "9px 11px", fontFamily: "DM Sans, sans-serif", boxSizing: "border-box", colorScheme: "dark" };
const lbl = { fontSize: 10, color: "#777", textTransform: "uppercase", letterSpacing: 0.4, fontFamily: "Barlow Condensed, sans-serif", marginBottom: 4, display: "block" };
const fmt = (d) => d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "—";

const STATUS = {
  not_started: { label: "Not started", color: "#888",    bg: "#1a1a1a" },
  scheduled:   { label: "Scheduled",   color: "#0ea5e9", bg: "#0c2233" },
  passed:      { label: "Passed",      color: "#22c55e", bg: "#06200e" },
  failed:      { label: "Failed",      color: "#ef4444", bg: "#2a0c0c" },
};

export default function InspectionsModule({ project, user, onBack, focusId }) {
  const [items, setItems] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", linked_milestone_id: "", inspector: "", due_date: "", hold_point: false, inspection_required: true, notes: "" });
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(null);   // item id expanded for photos/fail
  const [failReason, setFailReason] = useState("");
  const today = melbourneTodayStr();
  const canEdit = user?.role === "builder" || user?.role === "office" || user?.role === "supervisor";

  const load = () => getQaItems(project.id).then(({ data }) => setItems(data));
  useEffect(() => { load(); getMilestones(project.id).then(({ data }) => setMilestones(data)); }, [project.id]);
  const { rowRef, highlightId } = useFocusRow(focusId, items !== null);
  const msName = (id) => milestones.find(m => m.id === id)?.name;

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const { data } = await createQaItem({
      project_id: project.id, title: form.title.trim(), stage: msName(form.linked_milestone_id) || null,
      linked_milestone_id: form.linked_milestone_id || null, inspector: form.inspector.trim() || null,
      due_date: form.due_date || null, hold_point: form.hold_point, inspection_required: form.inspection_required,
      status: "not_started", notes: form.notes.trim() || null, created_by: user.id,
    });
    if (data) setItems(prev => [data, ...(prev || [])]);
    setForm({ title: "", linked_milestone_id: "", inspector: "", due_date: "", hold_point: false, inspection_required: true, notes: "" });
    setShowForm(false); setSaving(false);
  };

  const setStatus = async (it, status, extra = {}) => {
    const patch = { status, ...extra };
    if (status === "passed") { patch.approved_at = new Date().toISOString(); patch.approved_by = user.id; }
    setItems(prev => prev.map(x => x.id === it.id ? { ...x, ...patch } : x));
    await updateQaItem(it.id, patch);
  };
  const remove = async (it) => { setItems(prev => prev.filter(x => x.id !== it.id)); await deleteQaItem(it.id); };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Inspections" subtitle={project.street} onBack={onBack}
        rightSlot={canEdit ? <button onClick={() => setShowForm(s => !s)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: showForm ? "#333" : "#14b8a6", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer" }}>{showForm ? "CANCEL" : "+ ADD"}</button> : null} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {showForm && (
          <div style={{ background: "#101010", border: "1px solid #2a2a2a", borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <label style={lbl}>Inspection *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Frame stage inspection" style={{ ...inp, marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1 }}><label style={lbl}>Stage</label>
                <select value={form.linked_milestone_id} onChange={e => setForm(f => ({ ...f, linked_milestone_id: e.target.value }))} style={inp}>
                  <option value="">— none —</option>
                  {milestones.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div style={{ width: 140 }}><label style={lbl}>Due</label><input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} style={inp} /></div>
            </div>
            <label style={lbl}>Inspector</label>
            <input value={form.inspector} onChange={e => setForm(f => ({ ...f, inspector: e.target.value }))} placeholder="Surveyor / building inspector" style={{ ...inp, marginBottom: 10 }} />
            <button onClick={() => setForm(f => ({ ...f, hold_point: !f.hold_point }))} style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", cursor: "pointer", padding: "2px 0 12px" }}>
              <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${form.hold_point ? "#f59e0b" : "#444"}`, background: form.hold_point ? "#f59e0b" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>{form.hold_point && <span style={{ color: "#000", fontSize: 11, fontWeight: 700 }}>✓</span>}</div>
              <span style={{ fontSize: 13, color: form.hold_point ? "#f59e0b" : "#888" }}>Hold point — work must not proceed until passed</span>
            </button>
            <button onClick={save} disabled={saving || !form.title.trim()} style={{ width: "100%", padding: "11px", borderRadius: 8, border: "none", background: form.title.trim() ? "#14b8a6" : "#222", color: form.title.trim() ? "#fff" : "#555", fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, cursor: form.title.trim() ? "pointer" : "not-allowed" }}>{saving ? "SAVING…" : "ADD INSPECTION"}</button>
          </div>
        )}

        {items === null ? [1, 2].map(i => <div key={i} style={{ height: 70, background: "#141414", borderRadius: 10, marginBottom: 8 }} />)
          : items.length === 0 ? <EmptyState icon="🔍" title="No inspections" subtitle={canEdit ? "Add the stage inspections to track" : "Inspections will show here"} />
          : items.map(it => {
            const st = STATUS[it.status] || STATUS.not_started;
            const soon = inspectionDueSoon(it, today);
            return (
              <div key={it.id} ref={rowRef(it.id)} style={{ background: "#141414", border: `1px solid ${soon ? "#f59e0b" : "#1e1e1e"}`, borderRadius: 10, padding: "13px 14px", marginBottom: 8, ...(highlightId === it.id ? FOCUS_HL : null) }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, color: "#e8e8e8" }}>{it.title}{it.hold_point && <span style={{ fontSize: 9, fontFamily: "Barlow Condensed, sans-serif", color: "#f59e0b", background: "#251d00", padding: "1px 6px", borderRadius: 4, marginLeft: 8 }}>HOLD POINT</span>}</div>
                    <div style={{ fontSize: 11, color: "#666", marginTop: 3 }}>{[it.stage || msName(it.linked_milestone_id), it.inspector, it.due_date ? `due ${fmt(it.due_date)}` : null].filter(Boolean).join(" · ")}</div>
                  </div>
                  <span style={{ fontSize: 10, fontFamily: "Barlow Condensed, sans-serif", color: st.color, background: st.bg, padding: "2px 8px", borderRadius: 4, textTransform: "uppercase", height: "fit-content", whiteSpace: "nowrap" }}>{st.label}</span>
                </div>
                {soon && it.status !== "passed" && <div style={{ marginTop: 8, fontSize: 12, color: "#f59e0b" }}>⚠ Due soon — book it in.</div>}
                {it.status === "failed" && it.rejection_reason && <div style={{ marginTop: 8, fontSize: 12, color: "#f0a0a0", background: "#2a0c0c", border: "1px solid #ef444433", borderRadius: 6, padding: "6px 10px" }}>Failed: {it.rejection_reason}</div>}

                {canEdit && (
                  <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                    {it.status !== "scheduled" && it.status !== "passed" && <button onClick={() => setStatus(it, "scheduled")} style={btn("#0ea5e9")}>Scheduled</button>}
                    {it.status !== "passed" && <button onClick={() => setStatus(it, "passed")} style={btn("#22c55e", true)}>✓ Pass</button>}
                    {open === `fail-${it.id}`
                      ? <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                          <input value={failReason} onChange={e => setFailReason(e.target.value)} placeholder="Reason" style={{ ...inp, width: 150, padding: "5px 8px", fontSize: 12 }} />
                          <button onClick={() => { setStatus(it, "failed", { rejection_reason: failReason.trim() || "Not passed" }); setOpen(null); setFailReason(""); }} style={btn("#ef4444", true)}>Fail</button>
                          <button onClick={() => setOpen(null)} style={btn("#888")}>✕</button>
                        </span>
                      : it.status !== "passed" && <button onClick={() => setOpen(`fail-${it.id}`)} style={btn("#ef4444")}>Fail</button>}
                    <button onClick={() => setOpen(open === `ph-${it.id}` ? null : `ph-${it.id}`)} style={btn("#a855f7")}>📷 Photos</button>
                    <button onClick={() => remove(it)} style={{ ...btn("#ef4444"), marginLeft: "auto" }}>🗑</button>
                  </div>
                )}
                {open === `ph-${it.id}` && <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #1e1e1e" }}><PhotoAttach project={project} user={user} recordType="qa_item" recordId={it.id} accent="#14b8a6" defaultCategory="qa" /></div>}
              </div>
            );
          })}
      </div>
    </div>
  );
}
function btn(color, filled) {
  return { padding: "6px 11px", borderRadius: 7, border: filled ? "none" : `1px solid ${color}55`, background: filled ? color : "transparent", color: filled ? "#fff" : color, fontFamily: "Barlow Condensed, sans-serif", fontSize: 12, cursor: "pointer", textTransform: "uppercase" };
}
