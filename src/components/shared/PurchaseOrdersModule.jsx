import { useState, useEffect } from "react";
import BackHeader from "./BackHeader";
import { EmptyState } from "./LoadingScreen";
import { getPurchaseOrders, getPoMessages, sendPoMessage } from "../../lib/db";

const money = (n) => (n || n === 0) ? `$${Number(n).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";

// Builder's view of one PO — summary + the message thread with the subbie.
function BuilderPoDetail({ po, user, onBack }) {
  const [msgs, setMsgs] = useState([]);
  const [draft, setDraft] = useState("");
  const value = Number(po.po_value) || 0;

  useEffect(() => { getPoMessages(po.id).then(({ data }) => setMsgs(data)); }, [po.id]);

  const send = async () => {
    if (!draft.trim()) return;
    const { data } = await sendPoMessage({ po_id: po.id, sender_id: user.id, content: draft.trim() });
    if (data) setMsgs(prev => [...prev, data]);
    setDraft("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title={po.po_number} subtitle={po.subbie?.full_name || "Subcontractor"} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column" }}>
        {/* Summary */}
        <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "14px", marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <div>
              <div style={{ fontSize: 14, color: "#ccc" }}>{po.subbie?.full_name || "Subcontractor"}{po.subbie?.company ? ` · ${po.subbie.company}` : ""}{po.trade ? ` · ${po.trade}` : ""}</div>
              {po.scope && <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>{po.scope}</div>}
              {po.eot && <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 5 }}>⏱ EOT: {po.eot_days || "?"} day(s)</div>}
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 18, color: "#e07b39" }}>{money(value)}</div>
              <div style={{ fontSize: 9, color: "#555" }}>PO value (ex GST)</div>
              <div style={{ fontSize: 10, fontFamily: "Barlow Condensed, sans-serif", color: po.status === "accepted" ? "#22c55e" : "#f59e0b", marginTop: 4, textTransform: "uppercase" }}>{po.status}</div>
            </div>
          </div>
          {po.status === "accepted" && <div style={{ marginTop: 10, fontSize: 12, color: "#9ae6b4" }}>✓ Accepted by {po.signature}{po.accepted_at ? ` · ${new Date(po.accepted_at).toLocaleDateString("en-AU")}` : ""}</div>}
        </div>

        {/* Thread */}
        <div style={{ fontSize: 12, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Barlow Condensed, sans-serif", marginBottom: 8 }}>Messages</div>
        <div style={{ flex: 1 }}>
          {msgs.length === 0 && <div style={{ fontSize: 13, color: "#444", paddingTop: 8 }}>No messages yet — start the thread below.</div>}
          {msgs.map(m => {
            const out = m.sender_id === user.id;
            return (
              <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: out ? "flex-end" : "flex-start", marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: "#444", marginBottom: 2 }}>{m.sender?.full_name || (out ? "You" : "Subcontractor")}</div>
                <div style={{ maxWidth: "80%", background: out ? "#2a1800" : "#1a1a1a", border: `1px solid ${out ? "#3a2200" : "#222"}`, borderRadius: 10, padding: "9px 13px", fontSize: 13, color: "#ccc" }}>{m.content}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Message the subcontractor…" style={{ flex: 1, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#f0f0f0", fontSize: 14, padding: "10px 12px", fontFamily: "DM Sans, sans-serif" }} />
          <button onClick={send} disabled={!draft.trim()} style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: draft.trim() ? "#e07b39" : "#1a1a1a", color: draft.trim() ? "#fff" : "#444", fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, cursor: draft.trim() ? "pointer" : "default" }}>SEND</button>
        </div>
      </div>
    </div>
  );
}

// ── Builder PO inbox ───────────────────────────────────────────────────────────
export default function BuilderPosScreen({ project, user, onBack }) {
  const [pos, setPos] = useState(null);
  const [open, setOpen] = useState(null);

  useEffect(() => { getPurchaseOrders(project.id).then(({ data }) => setPos(data)); }, [project.id]);

  if (open) return <BuilderPoDetail po={open} user={user} onBack={() => setOpen(null)} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Subbie POs" subtitle={project.street} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {pos === null ? [1, 2].map(i => <div key={i} style={{ height: 70, background: "#141414", borderRadius: 10, marginBottom: 8 }} />)
          : pos.length === 0 ? <EmptyState icon="🧾" title="No purchase orders yet" subtitle="POs you issue on approved variations appear here" />
          : pos.map(po => (
            <button key={po.id} onClick={() => setOpen(po)} style={{ width: "100%", textAlign: "left", background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "14px", marginBottom: 8, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: "#555", fontFamily: "Barlow Condensed, sans-serif" }}>{po.po_number}{po.trade ? ` · ${po.trade}` : ""}</div>
                  <div style={{ fontSize: 14, color: "#ccc", marginTop: 3 }}>{po.subbie?.full_name || "Subcontractor"}{po.subbie?.company ? ` · ${po.subbie.company}` : ""}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 18, color: "#e07b39" }}>{money(po.po_value)}</div>
                  <div style={{ fontSize: 10, fontFamily: "Barlow Condensed, sans-serif", color: po.status === "accepted" ? "#22c55e" : "#f59e0b", marginTop: 3, textTransform: "uppercase" }}>{po.status}</div>
                </div>
              </div>
            </button>
          ))}
      </div>
    </div>
  );
}
