import { useState } from "react";
import { mockProjects, mockMaterialRequests } from "../../data/mockData";
import { post, enqueue } from "../../lib/webhook";
import { useOfflineQueue } from "../../hooks/useOfflineQueue";

const URGENCY = [
  { id: "today", label: "TODAY", color: "#c0392b", bg: "#2a1010" },
  { id: "this-week", label: "THIS WEEK", color: "#e07b39", bg: "#2a1800" },
  { id: "next-week", label: "NEXT WEEK", color: "#27ae60", bg: "#0f2a0f" },
];

const STATUS_COLOR = { pending: "#e07b39", ordered: "#3498db", delivered: "#27ae60" };
const STATUS_BG = { pending: "#2a1800", ordered: "#0a1a2a", delivered: "#0f2a0f" };

const BLANK = { item: "", qty: "", unit: "units", projectId: mockProjects[0].id, urgency: "this-week", notes: "" };

export default function RequestMaterials({ worker }) {
  const { isOnline, refreshPending } = useOfflineQueue();
  const [history] = useState(mockMaterialRequests.filter(r => r.requestedBy === worker.id));
  const [form, setForm] = useState(BLANK);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.item.trim().length >= 2 && parseFloat(form.qty) > 0 && form.urgency;

  const submit = async () => {
    if (!valid) return;
    setSubmitting(true);
    const proj = mockProjects.find(p => p.id === form.projectId);
    const payload = {
      ...form,
      qty: parseFloat(form.qty),
      projectName: proj?.name || "",
      requestedBy: worker.id,
      requestedByName: worker.name,
      timestamp: new Date().toISOString(),
    };
    try {
      await post("/materials/request", payload);
    } catch {
      enqueue("/materials/request", payload);
      refreshPending();
    }
    setSubmitting(false);
    setSubmitted(true);
    setShowForm(false);
    setForm(BLANK);
  };

  return (
    <div>
      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 26, fontWeight: 700, color: "#f0f0f0", marginBottom: 4 }}>
        REQUEST MATERIALS
      </div>

      <button
        onClick={() => { setShowForm(!showForm); setSubmitted(false); }}
        style={{
          marginBottom: 20,
          padding: "12px 20px",
          borderRadius: 10,
          border: "none",
          background: showForm ? "#222" : "#e07b39",
          color: showForm ? "#888" : "#fff",
          fontFamily: "Barlow Condensed, sans-serif",
          fontSize: 16,
          letterSpacing: 0.5,
          cursor: "pointer",
          width: "100%",
        }}
      >
        {showForm ? "CANCEL" : "+ NEW REQUEST"}
      </button>

      {submitted && !showForm && (
        <div style={{ marginBottom: 16, background: "#0f2a0f", border: "1px solid #27ae60", borderRadius: 10, padding: "14px 16px", color: "#27ae60", fontFamily: "Barlow Condensed, sans-serif", fontSize: 16 }}>
          ✓ Request submitted {isOnline ? "— manager notified" : "(queued for sync)"}
        </div>
      )}

      {showForm && (
        <div style={{ background: "#141414", border: "1px solid #222", borderRadius: 12, padding: "18px 16px", marginBottom: 20 }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 18, color: "#e07b39", marginBottom: 16 }}>NEW MATERIAL REQUEST</div>

          <div style={{ marginBottom: 14 }}>
            <div style={lbl}>Item / Description</div>
            <input
              type="text"
              value={form.item}
              onChange={e => set("item", e.target.value)}
              placeholder="e.g. 90×45 MGP10 framing timber 6m"
              style={inp}
            />
          </div>

          <div style={{ marginBottom: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={lbl}>Quantity</div>
              <input type="number" min="1" value={form.qty} onChange={e => set("qty", e.target.value)} placeholder="0" style={inp} />
            </div>
            <div>
              <div style={lbl}>Unit</div>
              <select value={form.unit} onChange={e => set("unit", e.target.value)} style={inp}>
                {["units", "lengths", "sheets", "bags", "boxes", "rolls", "m", "m²", "kg", "L"].map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={lbl}>Project</div>
            <select value={form.projectId} onChange={e => set("projectId", e.target.value)} style={inp}>
              {mockProjects.filter(p => p.status === "active").map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={lbl}>Urgency</div>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              {URGENCY.map(u => (
                <button
                  key={u.id}
                  onClick={() => set("urgency", u.id)}
                  style={{
                    flex: 1,
                    padding: "12px 6px",
                    borderRadius: 8,
                    border: `2px solid ${form.urgency === u.id ? u.color : "#2a2a2a"}`,
                    background: form.urgency === u.id ? u.bg : "#1a1a1a",
                    color: form.urgency === u.id ? u.color : "#666",
                    fontFamily: "Barlow Condensed, sans-serif",
                    fontSize: 13,
                    cursor: "pointer",
                    WebkitTapHighlightColor: "transparent",
                    transition: "all 0.15s",
                  }}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={lbl}>Notes (optional)</div>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Supplier preference, delivery notes..." rows={2} style={{ ...inp, resize: "vertical" }} />
          </div>

          <button
            onClick={submit}
            disabled={!valid || submitting}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: 10,
              border: "none",
              background: valid ? "#e07b39" : "#222",
              color: valid ? "#fff" : "#555",
              fontFamily: "Barlow Condensed, sans-serif",
              fontSize: 18,
              letterSpacing: 0.5,
              cursor: valid ? "pointer" : "not-allowed",
            }}
          >
            {submitting ? "SUBMITTING..." : "SEND REQUEST"}
          </button>
        </div>
      )}

      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, color: "#555", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 }}>
        Recent Requests
      </div>

      {history.length === 0 && (
        <div style={{ color: "#555", textAlign: "center", padding: "30px 0", fontSize: 14 }}>No recent requests</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {history.map(r => (
          <div key={r.id} style={{ background: "#141414", border: "1px solid #222", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1, marginRight: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#f0f0f0", lineHeight: 1.3 }}>{r.item}</div>
                <div style={{ fontSize: 13, color: "#666", marginTop: 3 }}>
                  {r.qty} {r.unit} · {mockProjects.find(p => p.id === r.projectId)?.name}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{
                  fontSize: 11,
                  fontFamily: "Barlow Condensed, sans-serif",
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                  color: STATUS_COLOR[r.status],
                  background: STATUS_BG[r.status],
                  padding: "3px 8px",
                  borderRadius: 4,
                }}>
                  {r.status}
                </div>
                <div style={{ fontSize: 11, color: "#444", marginTop: 6 }}>
                  {new Date(r.date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const lbl = { fontSize: 12, color: "#666", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Barlow Condensed, sans-serif", marginBottom: 6 };
const inp = { width: "100%", background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, color: "#f0f0f0", fontSize: 16, padding: "12px 14px", fontFamily: "DM Sans, sans-serif", boxSizing: "border-box" };
