import { useState, useEffect } from "react";
import BackHeader from "./BackHeader";
import { EmptyState } from "./LoadingScreen";
import FileUploadButton from "./FileUploadButton";
import { getCommercialItems, createCommercialItem, updateCommercialStatus, getVariations, createVariation, updateVariationStatus } from "../../lib/db";

function AttachLink({ url }) {
  if (!url) return null;
  const isImg = /\.(jpe?g|png|gif|webp|heic)$/i.test(url);
  return (
    <a href={url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 12, color: "#3b82f6", textDecoration: "none" }}>
      <span>{isImg ? "🖼" : "📎"}</span> View attachment
    </a>
  );
}

// §15 Commercial — all financial/contractual records for a project.
const CATEGORIES = [
  { key: "contract",       label: "Contracts",       icon: "📜", accent: "#3b82f6" },
  { key: "purchase_order", label: "Purchase Orders", icon: "🧾", accent: "#0ea5e9" },
  { key: "quote",          label: "Quotes",          icon: "💬", accent: "#a855f7" },
  { key: "invoice",        label: "Invoices",        icon: "💳", accent: "#10b981" },
  { key: "receipt",        label: "Receipts",        icon: "🧮", accent: "#14b8a6" },
  { key: "variation",      label: "Variations",      icon: "±",  accent: "#6366f1" },
  { key: "cost",           label: "Cost Tracking",   icon: "💰", accent: "#d97706" },
];

const STATUS = {
  draft:    { label: "Draft",            color: "#888",    bg: "#1a1a1a" },
  pending:  { label: "Pending Approval", color: "#f59e0b", bg: "#251d00" },
  revision: { label: "Revision Required",color: "#ef4444", bg: "#2a0c0c" },
  approved: { label: "Approved",         color: "#22c55e", bg: "#06200e" },
  rejected: { label: "Rejected",         color: "#ef4444", bg: "#2a0c0c" },
  signed:   { label: "Signed",           color: "#3b82f6", bg: "#0c1a33" },
};

function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.draft;
  return <span style={{ fontSize: 10, fontFamily: "Barlow Condensed, sans-serif", color: s.color, background: s.bg, padding: "2px 8px", borderRadius: 4, textTransform: "uppercase", whiteSpace: "nowrap" }}>{s.label}</span>;
}

const money = (n) => (n || n === 0) ? `$${Number(n).toLocaleString()}` : "—";

// ── Category list (contracts / POs / quotes / invoices / receipts) ─────────────
function CategoryList({ project, user, category, onBack }) {
  const [items, setItems] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", ref: "", vendor: "", amount: "", status: "draft", description: "", file_url: "" });
  const [saving, setSaving] = useState(false);

  const load = () => getCommercialItems(project.id).then(({ data }) => setItems(data.filter(i => i.type === category.key)));
  useEffect(() => { load(); }, [project.id, category.key]);

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const { data } = await createCommercialItem({
      project_id: project.id, type: category.key, created_by: user.id,
      title: form.title.trim(), ref: form.ref.trim() || null, vendor: form.vendor.trim() || null,
      amount: parseFloat(form.amount) || null, status: form.status, description: form.description.trim() || null,
      file_url: form.file_url || null,
    });
    if (data) setItems(prev => [data, ...prev]);
    setForm({ title: "", ref: "", vendor: "", amount: "", status: "draft", description: "", file_url: "" });
    setShowForm(false);
    setSaving(false);
  };

  const setStatus = async (id, status) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i));
    await updateCommercialStatus(id, status);
  };

  const total = (items || []).filter(i => i.status === "approved").reduce((s, i) => s + (i.amount || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title={category.label} subtitle={project.street} onBack={onBack}
        rightSlot={<button onClick={() => setShowForm(s => !s)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: showForm ? "#333" : category.accent, color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer" }}>{showForm ? "CANCEL" : "+ ADD"}</button>}
      />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {showForm && (
          <div style={{ background: "#141414", border: "1px solid #2a2a2a", borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder={`${category.label.replace(/s$/, "")} title *`} style={{ ...inp, marginBottom: 10 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <input value={form.ref} onChange={e => setForm(f => ({ ...f, ref: e.target.value }))} placeholder="Reference #" style={inp} />
              <input value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="Amount $" type="number" style={inp} />
            </div>
            <input value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} placeholder="Vendor / supplier" style={{ ...inp, marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
              {["draft","pending","revision","approved"].map(s => (
                <button key={s} onClick={() => setForm(f => ({ ...f, status: s }))} style={{ flex: "1 1 auto", padding: "7px 8px", borderRadius: 6, border: `1px solid ${form.status === s ? STATUS[s].color : "#2a2a2a"}`, background: form.status === s ? STATUS[s].bg : "transparent", color: form.status === s ? STATUS[s].color : "#666", fontFamily: "Barlow Condensed, sans-serif", fontSize: 11, cursor: "pointer", textTransform: "uppercase" }}>{STATUS[s].label}</button>
              ))}
            </div>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Notes (optional)" rows={2} style={{ ...inp, resize: "vertical", marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
              <FileUploadButton folder={`commercial/${project.id}/${category.key}`} accept="application/pdf,image/*" label="📎 Attach file" onUploaded={(url) => setForm(f => ({ ...f, file_url: url }))} />
              <FileUploadButton folder={`commercial/${project.id}/${category.key}`} accept="image/*" capture="environment" label="📷 Snap receipt" color="#a855f7" onUploaded={(url) => setForm(f => ({ ...f, file_url: url }))} />
              {form.file_url && <span style={{ fontSize: 12, color: "#22c55e" }}>✓ attached</span>}
            </div>
            <button onClick={save} disabled={saving || !form.title.trim()} style={{ width: "100%", padding: "11px", borderRadius: 8, border: "none", background: form.title.trim() ? category.accent : "#222", color: form.title.trim() ? "#fff" : "#555", fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, cursor: form.title.trim() ? "pointer" : "not-allowed" }}>{saving ? "SAVING..." : "SAVE"}</button>
          </div>
        )}

        {items === null ? [1,2].map(i => <div key={i} style={{ height: 70, background: "#141414", borderRadius: 10, marginBottom: 8 }} />)
          : items.length === 0 ? <EmptyState icon={category.icon} title={`No ${category.label.toLowerCase()} yet`} subtitle="Use + ADD to create one" />
          : (
            <>
              {total > 0 && <div style={{ fontSize: 13, color: "#555", marginBottom: 12 }}>Approved total: <span style={{ color: "#22c55e", fontFamily: "Barlow Condensed, sans-serif", fontSize: 16 }}>{money(total)}</span></div>}
              {items.map(it => (
                <div key={it.id} style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      {it.ref && <div style={{ fontSize: 11, color: "#555", fontFamily: "Barlow Condensed, sans-serif" }}>{it.ref}</div>}
                      <div style={{ fontSize: 14, color: "#ccc", marginTop: 2 }}>{it.title}</div>
                      <div style={{ fontSize: 11, color: "#444", marginTop: 3 }}>{[it.vendor, new Date(it.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })].filter(Boolean).join(" · ")}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 18, color: "#e07b39" }}>{money(it.amount)}</div>
                      <div style={{ marginTop: 4 }}><StatusBadge status={it.status} /></div>
                    </div>
                  </div>
                  {it.file_url && <div><AttachLink url={it.file_url} /></div>}
                  {/* quick status change */}
                  <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                    {["draft","pending","revision","approved"].filter(s => s !== it.status).map(s => (
                      <button key={s} onClick={() => setStatus(it.id, s)} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #2a2a2a", background: "transparent", color: STATUS[s].color, fontFamily: "Barlow Condensed, sans-serif", fontSize: 11, cursor: "pointer", textTransform: "uppercase" }}>→ {STATUS[s].label}</button>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
      </div>
    </div>
  );
}

// ── Variations category (own table + client sign-off placeholder) ──────────────
function VariationsList({ project, user, onBack }) {
  const [vars, setVars] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", amount: "", description: "", file_url: "" });
  const [saving, setSaving] = useState(false);

  const load = () => getVariations(project.id).then(({ data }) => setVars(data));
  useEffect(() => { load(); }, [project.id]);

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const ref = `${project.job_number || "VAR"}-V${String((vars?.length || 0) + 1).padStart(2, "0")}`;
    const { data } = await createVariation({
      project_id: project.id, ref, title: form.title.trim(),
      description: form.description.trim() || null, amount: parseFloat(form.amount) || null,
      status: "pending", raised_by: user.id, file_url: form.file_url || null,
    });
    if (data) setVars(prev => [data, ...prev]);
    setForm({ title: "", amount: "", description: "", file_url: "" });
    setShowForm(false);
    setSaving(false);
  };

  const setStatus = async (id, status) => {
    setVars(prev => prev.map(v => v.id === id ? { ...v, status } : v));
    await updateVariationStatus(id, status, status === "approved" ? user.id : null);
  };

  const approved = (vars || []).filter(v => v.status === "approved").reduce((s, v) => s + (v.amount || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Variations" subtitle={project.street} onBack={onBack}
        rightSlot={<button onClick={() => setShowForm(s => !s)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: showForm ? "#333" : "#6366f1", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer" }}>{showForm ? "CANCEL" : "+ RAISE"}</button>}
      />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {showForm && (
          <div style={{ background: "#141414", border: "1px solid #2a2a2a", borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Variation scope *" style={{ ...inp, marginBottom: 10 }} />
            <input value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="Cost impact $" type="number" style={{ ...inp, marginBottom: 10 }} />
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Detailed scope description" rows={3} style={{ ...inp, resize: "vertical", marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
              <FileUploadButton folder={`variations/${project.id}`} accept="application/pdf,image/*" label="📎 Attach" color="#6366f1" onUploaded={(url) => setForm(f => ({ ...f, file_url: url }))} />
              <FileUploadButton folder={`variations/${project.id}`} accept="image/*" capture="environment" label="📷 Photo" color="#a855f7" onUploaded={(url) => setForm(f => ({ ...f, file_url: url }))} />
              {form.file_url && <span style={{ fontSize: 12, color: "#22c55e" }}>✓ attached</span>}
            </div>
            <div style={{ fontSize: 11, color: "#555", marginBottom: 10 }}>Client digital sign-off coming in the next pass.</div>
            <button onClick={save} disabled={saving || !form.title.trim()} style={{ width: "100%", padding: "11px", borderRadius: 8, border: "none", background: form.title.trim() ? "#6366f1" : "#222", color: form.title.trim() ? "#fff" : "#555", fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, cursor: form.title.trim() ? "pointer" : "not-allowed" }}>{saving ? "SAVING..." : "RAISE VARIATION"}</button>
          </div>
        )}
        {vars === null ? [1,2].map(i => <div key={i} style={{ height: 70, background: "#141414", borderRadius: 10, marginBottom: 8 }} />)
          : vars.length === 0 ? <EmptyState icon="±" title="No variations yet" subtitle="Raise one before the work proceeds" />
          : (
            <>
              {approved > 0 && <div style={{ fontSize: 13, color: "#555", marginBottom: 12 }}>Approved variations: <span style={{ color: "#22c55e", fontFamily: "Barlow Condensed, sans-serif", fontSize: 16 }}>{money(approved)}</span></div>}
              {vars.map(v => (
                <div key={v.id} style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: "#555", fontFamily: "Barlow Condensed, sans-serif" }}>{v.ref}</div>
                      <div style={{ fontSize: 14, color: "#ccc", marginTop: 2 }}>{v.title}</div>
                      {v.description && <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>{v.description}</div>}
                      {v.file_url && <AttachLink url={v.file_url} />}
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 18, color: "#e07b39" }}>{money(v.amount)}</div>
                      <div style={{ marginTop: 4 }}><StatusBadge status={v.status} /></div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                    {["pending","approved","rejected"].filter(s => s !== v.status).map(s => (
                      <button key={s} onClick={() => setStatus(v.id, s)} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #2a2a2a", background: "transparent", color: STATUS[s]?.color || "#888", fontFamily: "Barlow Condensed, sans-serif", fontSize: 11, cursor: "pointer", textTransform: "uppercase" }}>→ {STATUS[s]?.label || s}</button>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
      </div>
    </div>
  );
}

// ── Cost Tracking rollup ───────────────────────────────────────────────────────
function CostTracking({ project, onBack }) {
  const [rollup, setRollup] = useState(null);

  useEffect(() => {
    Promise.all([getCommercialItems(project.id), getVariations(project.id)]).then(([ci, vr]) => {
      const items = ci.data, vars = vr.data;
      const sum = (arr, st) => arr.filter(x => x.status === st).reduce((s, x) => s + (x.amount || 0), 0);
      setRollup({
        budget: project.budget || 0,
        approvedVariations: sum(vars, "approved"),
        pendingVariations: vars.filter(v => v.status === "pending").reduce((s, v) => s + (v.amount || 0), 0),
        contracts: items.filter(i => i.type === "contract" && i.status === "approved").reduce((s, i) => s + (i.amount || 0), 0),
        pos: items.filter(i => i.type === "purchase_order").reduce((s, i) => s + (i.amount || 0), 0),
        invoices: items.filter(i => i.type === "invoice").reduce((s, i) => s + (i.amount || 0), 0),
      });
    });
  }, [project.id]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Cost Tracking" subtitle={project.street} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {!rollup ? <div style={{ height: 200, background: "#141414", borderRadius: 12 }} /> : (
          <>
            <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 12, padding: "18px", marginBottom: 14, textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Barlow Condensed, sans-serif" }}>Contract Value + Approved Variations</div>
              <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 40, fontWeight: 700, color: "#e07b39", marginTop: 6 }}>{money((rollup.budget) + rollup.approvedVariations)}</div>
            </div>
            {[
              { l: "Original Budget",        v: rollup.budget,             c: "#f0f0f0" },
              { l: "Approved Variations",    v: rollup.approvedVariations, c: "#22c55e" },
              { l: "Pending Variations",     v: rollup.pendingVariations,  c: "#f59e0b" },
              { l: "Approved Contracts",     v: rollup.contracts,          c: "#3b82f6" },
              { l: "Purchase Orders",        v: rollup.pos,                c: "#0ea5e9" },
              { l: "Invoices",               v: rollup.invoices,           c: "#10b981" },
            ].map(r => (
              <div key={r.l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "12px 16px", marginBottom: 8 }}>
                <span style={{ fontSize: 14, color: "#888" }}>{r.l}</span>
                <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 18, color: r.c }}>{money(r.v)}</span>
              </div>
            ))}
            <div style={{ fontSize: 11, color: "#444", marginTop: 12, textAlign: "center" }}>Live rollup from this project's commercial records.</div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Commercial landing ─────────────────────────────────────────────────────────
export default function CommercialModule({ project, user, onBack }) {
  const [view, setView] = useState(null);
  const [counts, setCounts] = useState({});

  useEffect(() => {
    Promise.all([getCommercialItems(project.id), getVariations(project.id)]).then(([ci, vr]) => {
      const c = {};
      ci.data.forEach(i => { c[i.type] = (c[i.type] || 0) + 1; });
      c.variation = vr.data.length;
      setCounts(c);
    });
  }, [project.id, view]);

  if (view) {
    const props = { project, user, onBack: () => setView(null) };
    if (view === "variation") return <VariationsList {...props} />;
    if (view === "cost") return <CostTracking {...props} />;
    const category = CATEGORIES.find(c => c.key === view);
    return <CategoryList {...props} category={category} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Commercial" subtitle={project.street} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {CATEGORIES.map(c => (
          <button key={c.key} onClick={() => setView(c.key)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, background: "#141414", border: `1px solid ${c.accent}33`, borderRadius: 12, padding: "16px 18px", marginBottom: 10, cursor: "pointer", textAlign: "left", WebkitTapHighlightColor: "transparent" }}>
            <span style={{ fontSize: 26 }}>{c.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 18, fontWeight: 700, color: "#f0f0f0", textTransform: "uppercase" }}>{c.label}</div>
              {c.key !== "cost" && <div style={{ fontSize: 12, color: "#555" }}>{counts[c.key] || 0} record{(counts[c.key] || 0) !== 1 ? "s" : ""}</div>}
              {c.key === "cost" && <div style={{ fontSize: 12, color: "#555" }}>Budget vs variations rollup</div>}
            </div>
            <span style={{ color: "#444", fontSize: 20 }}>›</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const inp = { width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#f0f0f0", fontSize: 14, padding: "10px 12px", fontFamily: "DM Sans, sans-serif", boxSizing: "border-box" };
