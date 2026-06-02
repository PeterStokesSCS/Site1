import { useState, useRef, useEffect } from "react";
import { mockProjects, mockMessages, mockDocuments } from "../../data/mockData";
import { post } from "../../lib/webhook";

// ── Milestone tracker ─────────────────────────────────────────────────────────
function MilestoneTracker({ milestones }) {
  const lastDone = milestones.filter(m => m.done).length;
  return (
    <div style={{ padding: "0 4px" }}>
      <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
        {/* Track line */}
        <div style={{
          position: "absolute", left: 14, right: 14, top: 14,
          height: 2, background: "#1e1e1e", zIndex: 0,
        }} />
        <div style={{
          position: "absolute", left: 14, top: 14, height: 2, zIndex: 1,
          background: "#e07b39",
          width: lastDone === 0 ? 0 : lastDone === milestones.length ? "calc(100% - 28px)" : `calc(${((lastDone - 0.5) / milestones.length) * 100}% - 0px)`,
          transition: "width 0.4s",
        }} />
        {milestones.map((m, i) => {
          const past = m.done;
          const current = !m.done && i === lastDone;
          return (
            <div key={m.name} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", zIndex: 2 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: past ? "#e07b39" : current ? "#1e1e1e" : "#111",
                border: `2px solid ${past ? "#e07b39" : current ? "#e07b39" : "#2a2a2a"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s",
              }}>
                {past
                  ? <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>✓</span>
                  : <div style={{ width: 8, height: 8, borderRadius: "50%", background: current ? "#e07b39" : "#2a2a2a" }} />
                }
              </div>
              <div style={{
                fontSize: 9, fontFamily: "Barlow Condensed, sans-serif",
                textTransform: "uppercase", letterSpacing: 0.3,
                color: past ? "#e07b39" : current ? "#ccc" : "#444",
                marginTop: 6, textAlign: "center", lineHeight: 1.2,
                maxWidth: 52,
              }}>
                {m.name}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Message thread ────────────────────────────────────────────────────────────
function MessageThread({ project }) {
  const [messages, setMessages] = useState(
    mockMessages.filter(m => m.projectId === project.id).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
  );
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!draft.trim()) return;
    setSending(true);
    const msg = {
      id: `msg${Date.now()}`,
      projectId: project.id,
      sender: "Pete Stokes",
      senderRole: "manager",
      text: draft.trim(),
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, msg]);
    setDraft("");
    setSending(false);
    post("/messages", {
      ...msg,
      clientEmail: project.clientEmail,
      projectName: project.name,
    }).catch(() => {});
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 0 12px", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: "#444", fontSize: 13, paddingTop: 20 }}>No messages yet</div>
        )}
        {messages.map(msg => {
          const outgoing = msg.senderRole === "manager";
          return (
            <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: outgoing ? "flex-end" : "flex-start" }}>
              <div style={{ fontSize: 11, color: "#444", marginBottom: 3, padding: "0 4px" }}>
                {msg.sender} · {new Date(msg.timestamp).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true })}
              </div>
              <div style={{
                maxWidth: "78%",
                background: outgoing ? "#2a1800" : "#1a1a1a",
                border: `1px solid ${outgoing ? "#3a2200" : "#222"}`,
                borderRadius: outgoing ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                padding: "10px 14px",
                fontSize: 14,
                color: "#ccc",
                lineHeight: 1.5,
              }}>
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      <div style={{ borderTop: "1px solid #1e1e1e", paddingTop: 12, display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${project.client}...`}
          rows={2}
          style={{
            flex: 1, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10,
            color: "#f0f0f0", fontSize: 14, padding: "10px 12px",
            fontFamily: "DM Sans, sans-serif", resize: "none",
          }}
        />
        <button
          onClick={send}
          disabled={!draft.trim() || sending}
          style={{
            padding: "10px 18px", borderRadius: 10, border: "none",
            background: draft.trim() ? "#e07b39" : "#1a1a1a",
            color: draft.trim() ? "#fff" : "#444",
            fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, letterSpacing: 0.5,
            cursor: draft.trim() ? "pointer" : "not-allowed", flexShrink: 0,
            transition: "background 0.15s",
          }}
        >
          SEND
        </button>
      </div>
      <div style={{ fontSize: 11, color: "#333", marginTop: 4 }}>⌘+Enter to send · Triggers email to client via n8n</div>
    </div>
  );
}

// ── Documents panel ───────────────────────────────────────────────────────────
function DocumentList({ projectId }) {
  const docs = mockDocuments.filter(d => d.projectId === projectId);
  if (docs.length === 0) return <div style={{ fontSize: 13, color: "#444" }}>No documents uploaded</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {docs.map(d => (
        <div key={d.id} style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "#1a1a1a", border: "1px solid #222", borderRadius: 8, padding: "10px 12px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>📄</span>
            <div>
              <div style={{ fontSize: 13, color: "#ccc" }}>{d.name}</div>
              <div style={{ fontSize: 11, color: "#444", marginTop: 2 }}>
                {new Date(d.date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })} · {d.size}
              </div>
            </div>
          </div>
          <button style={{ background: "none", border: "none", color: "#e07b39", fontSize: 13, cursor: "pointer", padding: "4px 8px" }}>
            ↓
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Client Portal main view ───────────────────────────────────────────────────
export default function ClientPortal() {
  const [selectedId, setSelectedId] = useState(mockProjects[0].id);
  const project = mockProjects.find(p => p.id === selectedId) || mockProjects[0];

  return (
    <div>
      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 28, fontWeight: 700, color: "#f0f0f0", marginBottom: 20 }}>
        CLIENT PORTAL
      </div>

      {/* Project tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {mockProjects.map(p => (
          <button
            key={p.id}
            onClick={() => setSelectedId(p.id)}
            style={{
              padding: "8px 18px", borderRadius: 8,
              border: `1px solid ${selectedId === p.id ? "#e07b39" : "#2a2a2a"}`,
              background: selectedId === p.id ? "#2a1800" : "#141414",
              color: selectedId === p.id ? "#e07b39" : "#666",
              fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, letterSpacing: 0.3,
              cursor: "pointer", transition: "all 0.15s",
            }}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }} className="client-grid">
        {/* Left — info + milestones + docs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Client info */}
          <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 12, padding: "16px 18px" }}>
            <SectionTitle>Client</SectionTitle>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 20, fontWeight: 700, color: "#f0f0f0", marginBottom: 8 }}>{project.client}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Row icon="📧" value={project.clientEmail} />
              <Row icon="📞" value={project.clientPhone} />
              <Row icon="📍" value={project.address} />
              <Row icon="📅" value={`${new Date(project.startDate).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })} → ${new Date(project.estimatedEnd).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}`} />
            </div>
          </div>

          {/* Milestones */}
          <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 12, padding: "16px 18px" }}>
            <SectionTitle>Project Milestones</SectionTitle>
            <MilestoneTracker milestones={project.milestones} />
            <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
              {project.milestones.map((m, i) => (
                <div key={i} style={{ fontSize: 12, display: "flex", gap: 5, alignItems: "center" }}>
                  <span style={{ color: m.done ? "#e07b39" : "#444" }}>{m.done ? "✓" : "○"}</span>
                  <span style={{ color: m.done ? "#888" : "#444" }}>{m.name}</span>
                  {m.done && m.date && <span style={{ color: "#444", fontSize: 11 }}>{new Date(m.date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Documents */}
          <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <SectionTitle noMargin>Documents</SectionTitle>
              <button style={{ background: "none", border: "1px dashed #2a2a2a", borderRadius: 6, color: "#555", fontSize: 12, cursor: "pointer", padding: "5px 10px" }}>+ Upload</button>
            </div>
            <DocumentList projectId={project.id} />
          </div>
        </div>

        {/* Right — messages */}
        <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", minHeight: 420 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <SectionTitle noMargin>Messages</SectionTitle>
            {project.telegramChatId && (
              <span style={{ fontSize: 11, color: "#3498db", background: "#0a1a2a", padding: "3px 8px", borderRadius: 4, fontFamily: "Barlow Condensed, sans-serif" }}>
                Telegram linked
              </span>
            )}
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <MessageThread project={project} />
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 767px) {
          .client-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function SectionTitle({ children, noMargin }) {
  return (
    <div style={{
      fontFamily: "Barlow Condensed, sans-serif", fontSize: 12, fontWeight: 700,
      color: "#555", textTransform: "uppercase", letterSpacing: 0.5,
      marginBottom: noMargin ? 0 : 12,
    }}>
      {children}
    </div>
  );
}

function Row({ icon, value }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <span style={{ fontSize: 13, color: "#888", lineHeight: 1.4 }}>{value}</span>
    </div>
  );
}
