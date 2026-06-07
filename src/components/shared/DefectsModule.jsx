import { useState, useEffect } from "react";
import BackHeader from "./BackHeader";
import { EmptyState } from "./LoadingScreen";
import PhotoAttach from "./PhotoAttach";
import { getDefects, createDefect, updateDefect, deleteDefect } from "../../lib/db";

const inp = { width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#f0f0f0", fontSize: 14, padding: "9px 11px", fontFamily: "DM Sans, sans-serif", boxSizing: "border-box", colorScheme: "dark" };
const lbl = { fontSize: 10, color: "#777", textTransform: "uppercase", letterSpacing: 0.4, fontFamily: "Barlow Condensed, sans-serif", marginBottom: 4, display: "block" };
const fmt = (d) => d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short" }) : "—";
const PRIO = { high: "#ef4444", medium: "#f59e0b", low: "#22c55e" };

export default function DefectsModule({ project, user, onBack }) {
  const [items, setItems] = useState(null);
  const [tab, setTab] = useState("open");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", location_area: "", description: "", related_trade: "", priority: "medium", due_date: "", client_visible: false });
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(null);
  const canEdit = user?.role === "builder" || user?.role === "office" || user?.role === "supervisor";
  const canSetClient = user?.role === "builder" || user?.role === "supervisor";

  const load = () => getDefects(project.id).then(({ data }) => setItems(data));
  useEffect(() => { load(); }, [project.id]);

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const { data } = await createDefect({
      project_id: project.id, title: form.title.trim(), location_area: form.location_area.trim() || null,
      description: form.description.trim() || null, related_trade: form.related_trade.trim() || null,
      priority: form.priority, due_date: form.due_date || null, client_visible: form.client_visible,
      status: "open", raised_by: user.id,
    });
    if (data) setItems(prev => [data, ...(prev || [])]);
    setForm({ title: "", location_area: "", description: "", related_trade: "", priority: "medium", due_date: "", client_visible: false });
    setShowForm(false); setSaving(false);
  };

  const close = async (it) => {
    const patch = { status: "closed", closed_by: user.id, closed_at: new Date().toISOString() };
    setItems(prev => prev.map(x => x.id === it.id ? { ...x, ...patch } : x));
    await updateDefect(it.id, patch);
  };
  const reopen = async (it) => {
    const patch = { status: "open", closed_by: null, closed_at: null };
    setItems(prev => prev.map(x => x.id === it.id ? { ...x, ...patch } : x));
    await updateDefect(it.id, patch);
  };
  const toggleClient = async (it) => {
    const v = !it.client_visible;
    setItems(prev => prev.map(x => x.id === it.id ? { ...x, client_visible: v } : x));
    await updateDefect(it.id, { client_visible: v });
  };
  const remove = async (it) => { setItems(prev => prev.filter(x => x.id !== it.id)); await deleteDefect(it.id); };

  const shown = (items || []).filter(d => tab === "open" ? d.status !== "closed" : d.status === "closed");
  const openCount = (items || []).filter(d => d.status !== "closed").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Defects" subtitle={project.street} onBack={onBack}
        rightSlot={canEdit ? <button onClick={() => setShowForm(s => !s)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: showForm ? "#333" : "#f97316", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer" }}>{showForm ? "CANCEL" : "+ ADD"}</button> : null} />
      <div style={{ display: "flex", borderBottom: "1px solid #1e1e1e", flexShrink: 0 }}>
        {[["open", `Open${openCount ? ` (${openCount})` : ""}`], ["closed", "Closed"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ flex: 1, padding: "10px", border: "none", borderBottom: tab === k ? "2px solid #f97316" : "2px solid transparent", background: "transparent", color: tab === k ? "#f97316" : "#555", fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, cursor: "pointer" }}>{l}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {showForm && (
          <div style={{ background: "#101010", border: "1px solid #2a2a2a", borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <label style={lbl}>Defect *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Scratch on kitchen benchtop" style={{ ...inp, marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1 }}><label style={lbl}>Location</label><input value={form.location_area} onChange={e => setForm(f => ({ ...f, location_area: e.target.value }))} placeholder="Kitchen" style={inp} /></div>
              <div style={{ flex: 1 }}><label style={lbl}>Trade</label><input value={form.related_trade} onChange={e => setForm(f => ({ ...f, related_trade: e.target.value }))} placeholder="Stonemason" style={inp} /></div>
            </div>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Detail (optional)" rows={2} style={{ ...inp, resize: "vertical", marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}><label style={lbl}>Priority</label>
                <div style={{ display: "flex", gap: 5 }}>{["high", "medium", "low"].map(p => <button key={p} onClick={() => setForm(f => ({ ...f, priority: p }))} style={{ flex: 1, padding: "7px 4px", borderRadius: 6, border: `1px solid ${form.priority === p ? PRIO[p] : "#2a2a2a"}`, background: form.priority === p ? `${PRIO[p]}22` : "transparent", color: form.priority === p ? PRIO[p] : "#666", fontFamily: "Barlow Condensed, sans-serif", fontSize: 12, cursor: "pointer", textTransform: "uppercase" }}>{p}</button>)}</div>
              </div>
              <div style={{ width: 130 }}><label style={lbl}>Due</label><input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} style={inp} /></div>
            </div>
            {canSetClient && (
              <button onClick={() => setForm(f => ({ ...f, client_visible: !f.client_visible }))} style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", cursor: "pointer", padding: "0 0 12px" }}>
                <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${form.client_visible ? "#22c55e" : "#444"}`, background: form.client_visible ? "#22c55e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>{form.client_visible && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>✓</span>}</div>
                <span style={{ fontSize: 13, color: form.client_visible ? "#22c55e" : "#888" }}>Visible to client</span>
              </button>
            )}
            <button onClick={save} disabled={saving || !form.title.trim()} style={{ width: "100%", padding: "11px", borderRadius: 8, border: "none", background: form.title.trim() ? "#f97316" : "#222", color: form.title.trim() ? "#fff" : "#555", fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, cursor: form.title.trim() ? "pointer" : "not-allowed" }}>{saving ? "SAVING…" : "ADD DEFECT"}</button>
          </div>
        )}

        {items === null ? [1, 2].map(i => <div key={i} style={{ height: 70, background: "#141414", borderRadius: 10, marginBottom: 8 }} />)
          : shown.length === 0 ? <EmptyState icon="🔧" title={tab === "open" ? "No open defects" : "No closed defects"} subtitle={tab === "open" && canEdit ? "Add snags as you find them" : ""} />
          : shown.map(it => (
            <div key={it.id} style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "13px 14px", marginBottom: 8, opacity: it.status === "closed" ? 0.6 : 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: "#e8e8e8" }}>{it.title}{it.client_visible && <span style={{ fontSize: 8, fontFamily: "Barlow Condensed, sans-serif", color: "#022", background: "#22c55e", padding: "1px 5px", borderRadius: 4, marginLeft: 8 }}>CLIENT</span>}</div>
                  <div style={{ fontSize: 11, color: "#666", marginTop: 3 }}>{[it.location_area, it.related_trade, it.due_date ? `due ${fmt(it.due_date)}` : null].filter(Boolean).join(" · ")}</div>
                  {it.description && <div style={{ fontSize: 12, color: "#777", marginTop: 4 }}>{it.description}</div>}
                </div>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: PRIO[it.priority] || "#888", flexShrink: 0, marginTop: 5 }} />
              </div>
              {canEdit && (
                <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                  {it.status !== "closed"
                    ? <button onClick={() => close(it)} style={btn("#22c55e", true)}>✓ Close</button>
                    : <button onClick={() => reopen(it)} style={btn("#f59e0b")}>Reopen</button>}
                  {canSetClient && <button onClick={() => toggleClient(it)} style={btn(it.client_visible ? "#22c55e" : "#888")}>{it.client_visible ? "✓ Client" : "Client"}</button>}
                  <button onClick={() => setOpen(open === it.id ? null : it.id)} style={btn("#a855f7")}>📷 Photos</button>
                  <button onClick={() => remove(it)} style={{ ...btn("#ef4444"), marginLeft: "auto" }}>🗑</button>
                </div>
              )}
              {open === it.id && <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #1e1e1e" }}><PhotoAttach project={project} user={user} recordType="defect" recordId={it.id} accent="#f97316" defaultCategory="defect" /></div>}
            </div>
          ))}
      </div>
    </div>
  );
}
function btn(color, filled) {
  return { padding: "6px 11px", borderRadius: 7, border: filled ? "none" : `1px solid ${color}55`, background: filled ? color : "transparent", color: filled ? "#fff" : color, fontFamily: "Barlow Condensed, sans-serif", fontSize: 12, cursor: "pointer", textTransform: "uppercase" };
}
