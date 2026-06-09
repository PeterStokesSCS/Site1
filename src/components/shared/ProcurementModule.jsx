import { useState, useEffect } from "react";
import { useFocusRow, FOCUS_HL } from "./useFocusRow";
import BackHeader from "./BackHeader";
import { EmptyState } from "./LoadingScreen";
import { getProcurementItems, createProcurementItem, updateProcurementItem, deleteProcurementItem, getMilestones } from "../../lib/db";
import { melbourneTodayStr } from "../../lib/actionQueue";
import { breachesOrderBy, isDeliveryLate, mustOrderBy, addDays } from "../../lib/timeline";

const inp = { width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#f0f0f0", fontSize: 14, padding: "9px 11px", fontFamily: "DM Sans, sans-serif", boxSizing: "border-box", colorScheme: "dark" };
const lbl = { fontSize: 10, color: "#777", textTransform: "uppercase", letterSpacing: 0.4, fontFamily: "Barlow Condensed, sans-serif", marginBottom: 4, display: "block" };
const fmt = (d) => d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "—";

const STATUS = {
  required:  { label: "To order", color: "#f59e0b", bg: "#251d00" },
  ordered:   { label: "Ordered",  color: "#0ea5e9", bg: "#0c2233" },
  delivered: { label: "Delivered",color: "#22c55e", bg: "#06200e" },
};

export default function ProcurementModule({ project, user, onBack, focusId }) {
  const [items, setItems] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ item_name: "", category: "", supplier: "", required_by_date: "", lead_time_days: "", linked_milestone_id: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const today = melbourneTodayStr();
  const canEdit = user?.role === "builder" || user?.role === "office";

  const load = () => getProcurementItems(project.id).then(({ data }) => setItems(data));
  useEffect(() => { load(); getMilestones(project.id).then(({ data }) => setMilestones(data)); }, [project.id]);
  const { rowRef, highlightId } = useFocusRow(focusId, items !== null);
  const msName = (id) => milestones.find(m => m.id === id)?.name;

  const save = async () => {
    if (!form.item_name.trim()) return;
    setSaving(true);
    const { data } = await createProcurementItem({
      project_id: project.id, item_name: form.item_name.trim(), category: form.category.trim() || null,
      supplier: form.supplier.trim() || null, required_by_date: form.required_by_date || null,
      lead_time_days: form.lead_time_days ? parseInt(form.lead_time_days) : null,
      linked_milestone_id: form.linked_milestone_id || null, notes: form.notes.trim() || null,
      status: "required", created_by: user.id,
    });
    if (data) setItems(prev => [data, ...(prev || [])]);
    setForm({ item_name: "", category: "", supplier: "", required_by_date: "", lead_time_days: "", linked_milestone_id: "", notes: "" });
    setShowForm(false); setSaving(false);
  };

  const markOrdered = async (it) => {
    const ordered_date = today;
    const expected = it.expected_delivery_date || (it.lead_time_days != null ? addDays(ordered_date, it.lead_time_days) : null);
    const patch = { status: "ordered", ordered_date, expected_delivery_date: expected };
    setItems(prev => prev.map(x => x.id === it.id ? { ...x, ...patch } : x));
    await updateProcurementItem(it.id, patch);
  };
  const markDelivered = async (it) => {
    const patch = { status: "delivered", actual_delivery_date: today };
    setItems(prev => prev.map(x => x.id === it.id ? { ...x, ...patch } : x));
    await updateProcurementItem(it.id, patch);
  };
  const setExpected = async (it, val) => {
    setItems(prev => prev.map(x => x.id === it.id ? { ...x, expected_delivery_date: val } : x));
    await updateProcurementItem(it.id, { expected_delivery_date: val || null });
  };
  const remove = async (it) => { setItems(prev => prev.filter(x => x.id !== it.id)); setConfirmDel(null); await deleteProcurementItem(it.id); };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Procurement" subtitle={project.street} onBack={onBack}
        rightSlot={canEdit ? <button onClick={() => setShowForm(s => !s)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: showForm ? "#333" : "#0ea5e9", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer" }}>{showForm ? "CANCEL" : "+ ADD ITEM"}</button> : null} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {showForm && (
          <div style={{ background: "#101010", border: "1px solid #2a2a2a", borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <label style={lbl}>Item / material *</label>
            <input value={form.item_name} onChange={e => setForm(f => ({ ...f, item_name: e.target.value }))} placeholder="e.g. Windows — front elevation" style={{ ...inp, marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1 }}><label style={lbl}>Category</label><input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Joinery" style={inp} /></div>
              <div style={{ flex: 1 }}><label style={lbl}>Supplier</label><input value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} placeholder="Supplier" style={inp} /></div>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1 }}><label style={lbl}>Needed by</label><input type="date" value={form.required_by_date} onChange={e => setForm(f => ({ ...f, required_by_date: e.target.value }))} style={inp} /></div>
              <div style={{ width: 110 }}><label style={lbl}>Lead time (days)</label><input type="number" value={form.lead_time_days} onChange={e => setForm(f => ({ ...f, lead_time_days: e.target.value }))} placeholder="21" style={inp} /></div>
            </div>
            <label style={lbl}>Linked stage (optional)</label>
            <select value={form.linked_milestone_id} onChange={e => setForm(f => ({ ...f, linked_milestone_id: e.target.value }))} style={{ ...inp, marginBottom: 12 }}>
              <option value="">— none —</option>
              {milestones.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <button onClick={save} disabled={saving || !form.item_name.trim()} style={{ width: "100%", padding: "11px", borderRadius: 8, border: "none", background: form.item_name.trim() ? "#0ea5e9" : "#222", color: form.item_name.trim() ? "#fff" : "#555", fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, cursor: form.item_name.trim() ? "pointer" : "not-allowed" }}>{saving ? "SAVING…" : "ADD ITEM"}</button>
          </div>
        )}

        {items === null ? [1, 2].map(i => <div key={i} style={{ height: 80, background: "#141414", borderRadius: 10, marginBottom: 8 }} />)
          : items.length === 0 ? <EmptyState icon="📦" title="No procurement items" subtitle={canEdit ? "Add materials to track ordering + delivery" : "Materials being procured will show here"} />
          : items.map(it => {
            const st = STATUS[it.status] || STATUS.required;
            const breach = breachesOrderBy(it, today);
            const late = isDeliveryLate(it);
            const mob = mustOrderBy(it.required_by_date, it.lead_time_days);
            return (
              <div key={it.id} ref={rowRef(it.id)} style={{ background: "#141414", border: `1px solid ${breach ? "#ef4444" : late ? "#f59e0b" : "#1e1e1e"}`, borderRadius: 10, padding: "13px 14px", marginBottom: 8, ...(highlightId === it.id ? FOCUS_HL : null) }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, color: "#e8e8e8" }}>{it.item_name}</div>
                    <div style={{ fontSize: 11, color: "#666", marginTop: 3 }}>{[it.supplier, it.category, msName(it.linked_milestone_id)].filter(Boolean).join(" · ")}</div>
                  </div>
                  <span style={{ fontSize: 10, fontFamily: "Barlow Condensed, sans-serif", color: st.color, background: st.bg, padding: "2px 8px", borderRadius: 4, textTransform: "uppercase", height: "fit-content", whiteSpace: "nowrap" }}>{st.label}</span>
                </div>

                <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 11, color: "#888", flexWrap: "wrap" }}>
                  {it.required_by_date && <span>Needed {fmt(it.required_by_date)}</span>}
                  {it.lead_time_days != null && <span>Lead {it.lead_time_days}d</span>}
                  {it.status === "required" && mob && <span style={{ color: breach ? "#ef4444" : "#888" }}>Order by {fmt(mob)}</span>}
                  {it.status === "ordered" && <span>Ordered {fmt(it.ordered_date)} · ETA {fmt(it.expected_delivery_date)}</span>}
                  {it.status === "delivered" && <span style={{ color: "#22c55e" }}>Delivered {fmt(it.actual_delivery_date)}</span>}
                </div>

                {breach && <div style={{ marginTop: 8, fontSize: 12, color: "#ef4444" }}>⚠ Order now — lead time means it won't arrive in time otherwise.</div>}
                {late && <div style={{ marginTop: 8, fontSize: 12, color: "#f59e0b" }}>⚠ Expected delivery is after it's needed.</div>}

                {canEdit && (
                  <div style={{ display: "flex", gap: 6, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
                    {it.status === "required" && <button onClick={() => markOrdered(it)} style={btn("#0ea5e9", true)}>Mark ordered</button>}
                    {it.status === "ordered" && <>
                      <label style={{ fontSize: 10, color: "#666" }}>ETA <input type="date" value={it.expected_delivery_date || ""} onChange={e => setExpected(it, e.target.value)} style={{ ...inp, width: 150, padding: "5px 7px", fontSize: 12 }} /></label>
                      <button onClick={() => markDelivered(it)} style={btn("#22c55e", true)}>Mark delivered</button>
                    </>}
                    {confirmDel === it.id
                      ? <span style={{ display: "inline-flex", gap: 6 }}><button onClick={() => remove(it)} style={btn("#ef4444", true)}>Delete</button><button onClick={() => setConfirmDel(null)} style={btn("#888")}>Cancel</button></span>
                      : <button onClick={() => setConfirmDel(it.id)} style={{ ...btn("#ef4444"), marginLeft: "auto" }}>🗑</button>}
                  </div>
                )}
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
