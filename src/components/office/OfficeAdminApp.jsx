import { useState } from "react";
import { mockVariations, mockTimesheets, mockProjects, mockMessages, mockDocuments } from "../../data/mockData";
import { post } from "../../lib/webhook";

const TABS = [
  { id: "variations", label: "Variations", icon: "±" },
  { id: "timesheets", label: "Timesheets",  icon: "📋" },
  { id: "clients",    label: "Clients",     icon: "👤" },
  { id: "documents",  label: "Documents",   icon: "📄" },
  { id: "schedule",   label: "Schedule",    icon: "📅" },
];

function SectionHead({ children }) {
  return <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12, marginTop: 4 }}>{children}</div>;
}

function StatusBadge({ status }) {
  const map = { pending: ["#f59e0b","#251d00"], approved: ["#22c55e","#06200e"], sent: ["#3b82f6","#0c1a33"] };
  const [c, bg] = map[status] || ["#666","#1a1a1a"];
  return <span style={{ fontSize: 10, fontFamily: "Barlow Condensed, sans-serif", color: c, background: bg, padding: "2px 8px", borderRadius: 4, textTransform: "uppercase" }}>{status}</span>;
}

function VariationsTab() {
  const awaiting = mockVariations.filter(v => v.status === "pending");
  const approved = mockVariations.filter(v => v.status === "approved");

  return (
    <div>
      <SectionHead>Awaiting Approval ({awaiting.length})</SectionHead>
      {awaiting.map(v => {
        const proj = mockProjects.find(p => p.id === v.projectId);
        return (
          <div key={v.id} style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "14px 16px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "#555", fontFamily: "Barlow Condensed, sans-serif" }}>{v.ref} · {proj?.jobNumber}</div>
              <div style={{ fontSize: 14, color: "#ccc", marginTop: 2 }}>{v.title}</div>
              <div style={{ fontSize: 12, color: "#555", marginTop: 3 }}>{new Date(v.date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 20, color: "#e07b39" }}>${v.amount.toLocaleString()}</div>
              <StatusBadge status={v.status} />
            </div>
          </div>
        );
      })}
      <SectionHead>Approved</SectionHead>
      {approved.map(v => (
        <div key={v.id} style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 8, padding: "10px 14px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: 0.7 }}>
          <div><div style={{ fontSize: 12, color: "#666" }}>{v.ref} · {v.title}</div></div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 16, color: "#555" }}>${v.amount.toLocaleString()}</span>
            <StatusBadge status="approved" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TimesheetsTab() {
  const [sheets, setSheets] = useState(mockTimesheets);
  const approve = (id) => { setSheets(prev => prev.map(t => t.id === id ? { ...t, status: "approved" } : t)); post("/timesheets/approve", { id }).catch(() => {}); };
  const pending = sheets.filter(t => t.status === "pending");
  const approved = sheets.filter(t => t.status === "approved");

  return (
    <div>
      <SectionHead>Pending ({pending.length})</SectionHead>
      {pending.map(ts => (
        <div key={ts.id} style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: "#ccc" }}>{ts.workerName}</div>
            <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>{ts.projectName} · w/e {new Date(ts.weekEnding).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</div>
          </div>
          <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 20, color: "#e07b39" }}>{ts.hours}h</span>
          <button onClick={() => approve(ts.id)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#22c55e", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer" }}>APPROVE</button>
        </div>
      ))}
      <SectionHead>Approved</SectionHead>
      {approved.map(ts => (
        <div key={ts.id} style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 8, padding: "10px 14px", marginBottom: 6, display: "flex", justifyContent: "space-between", opacity: 0.6 }}>
          <span style={{ fontSize: 13, color: "#888" }}>{ts.workerName} · {ts.projectName}</span>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 16, color: "#555" }}>{ts.hours}h</span>
            <StatusBadge status="approved" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ClientsTab() {
  const [selected, setSelected] = useState(mockProjects[0].id);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState(mockMessages.filter(m => m.channel === "client"));
  const project = mockProjects.find(p => p.id === selected);

  const send = () => {
    if (!draft.trim() || !project) return;
    const msg = { id: `m${Date.now()}`, projectId: project.id, channel: "client", sender: "Lena Kovac", senderRole: "office", text: draft.trim(), timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, msg]);
    setDraft("");
    post("/messages", { ...msg, clientEmail: project.clientEmail, projectName: project.street }).catch(() => {});
  };

  const visible = messages.filter(m => m.projectId === selected);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 180px)" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {mockProjects.map(p => (
          <button key={p.id} onClick={() => setSelected(p.id)} style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${selected === p.id ? "#e07b39" : "#2a2a2a"}`, background: selected === p.id ? "#2a1800" : "transparent", color: selected === p.id ? "#e07b39" : "#666", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer" }}>
            {p.jobNumber}
          </button>
        ))}
      </div>
      {project && (
        <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 16, color: "#f0f0f0" }}>{project.client}</div>
          <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>{project.clientEmail} · {project.clientPhone}</div>
        </div>
      )}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
        {visible.map(msg => {
          const out = ["office","builder","supervisor"].includes(msg.senderRole);
          return (
            <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: out ? "flex-end" : "flex-start" }}>
              <div style={{ fontSize: 10, color: "#444", marginBottom: 2 }}>{msg.sender}</div>
              <div style={{ maxWidth: "75%", background: out ? "#2a1800" : "#1a1a1a", border: `1px solid ${out ? "#3a2200" : "#222"}`, borderRadius: 10, padding: "9px 13px", fontSize: 13, color: "#ccc", lineHeight: 1.5 }}>{msg.text}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Message client..." style={{ flex: 1, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#f0f0f0", fontSize: 14, padding: "10px 12px", fontFamily: "DM Sans, sans-serif" }} />
        <button onClick={send} disabled={!draft.trim()} style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: draft.trim() ? "#e07b39" : "#1a1a1a", color: draft.trim() ? "#fff" : "#444", fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, cursor: draft.trim() ? "pointer" : "default" }}>SEND</button>
      </div>
    </div>
  );
}

export default function OfficeAdminApp({ user }) {
  const [tab, setTab] = useState("variations");

  const renderTab = () => {
    switch (tab) {
      case "variations": return <VariationsTab />;
      case "timesheets": return <TimesheetsTab />;
      case "clients":    return <ClientsTab />;
      default: return <div style={{ color: "#444", padding: "40px 0", textAlign: "center", fontFamily: "Barlow Condensed, sans-serif", fontSize: 18 }}>Coming next</div>;
    }
  };

  return (
    <div style={{ display: "flex", height: "100dvh", background: "#0c0c0c", overflow: "hidden" }}>
      <aside style={{ width: 200, background: "#111", borderRight: "1px solid #1e1e1e", display: "flex", flexDirection: "column", flexShrink: 0 }} className="office-sidebar">
        <div style={{ padding: "20px 20px 14px", borderBottom: "1px solid #1e1e1e" }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, fontWeight: 700, letterSpacing: 2 }}><span style={{ color: "#e07b39" }}>SCS</span> BuildHub</div>
          <div style={{ fontSize: 11, color: "#444", letterSpacing: 0.5, marginTop: 2 }}>OFFICE ADMIN</div>
        </div>
        <nav style={{ flex: 1, padding: "10px 8px" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "none", borderRadius: 8, borderLeft: `3px solid ${tab === t.id ? "#e07b39" : "transparent"}`, background: tab === t.id ? "#1e1e1e" : "transparent", color: tab === t.id ? "#e07b39" : "#666", cursor: "pointer", width: "100%", fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 2 }}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: "12px 16px", borderTop: "1px solid #1e1e1e", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#e07b39", color: "#0c0c0c", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Barlow Condensed, sans-serif", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{user.avatar}</div>
          <div><div style={{ fontSize: 12, color: "#ccc" }}>{user.name}</div><div style={{ fontSize: 11, color: "#555" }}>Office Admin</div></div>
        </div>
      </aside>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <header style={{ background: "#111", borderBottom: "1px solid #1e1e1e", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }} className="office-topbar">
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 18, fontWeight: 700 }}><span style={{ color: "#e07b39" }}>SCS</span> BuildHub</div>
          <div style={{ fontSize: 13, color: "#666" }}>{user.name}</div>
        </header>
        <main style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 26, fontWeight: 700, color: "#f0f0f0", marginBottom: 20 }}>{TABS.find(t => t.id === tab)?.label.toUpperCase()}</div>
          {renderTab()}
        </main>
        <nav style={{ background: "#111", borderTop: "1px solid #1e1e1e", display: "flex" }} className="office-bottomnav">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 4px 12px", border: "none", background: "transparent", color: tab === t.id ? "#e07b39" : "#555", borderTop: tab === t.id ? "2px solid #e07b39" : "2px solid transparent", cursor: "pointer" }}>
              <span style={{ fontSize: 17 }}>{t.icon}</span>
              <span style={{ fontSize: 9, marginTop: 3, fontFamily: "Barlow Condensed, sans-serif", textTransform: "uppercase" }}>{t.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <style>{`
        @media (min-width: 768px) { .office-topbar { display: none !important; } .office-bottomnav { display: none !important; } .office-sidebar { display: flex !important; } }
        @media (max-width: 767px) { .office-sidebar { display: none !important; } .office-topbar { display: flex !important; } .office-bottomnav { display: flex !important; } }
      `}</style>
    </div>
  );
}
