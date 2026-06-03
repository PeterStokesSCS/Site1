import { useState, useEffect } from "react";
import {
  getAllVariations, updateVariationStatus,
  getAllTimesheets, approveTimesheet,
  getProjects, getMessages, sendMessage,
  getAllDocuments,
} from "../../lib/db";
import { supabase } from "../../lib/supabase";
import { post } from "../../lib/webhook";
import { EmptyState, CardSkeleton } from "../shared/LoadingScreen";

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
  const map = { pending: ["#f59e0b","#251d00"], approved: ["#22c55e","#06200e"], rejected: ["#ef4444","#2a0c0c"], signed: ["#3b82f6","#0c1a33"], sent: ["#3b82f6","#0c1a33"] };
  const [c, bg] = map[status] || ["#666","#1a1a1a"];
  return <span style={{ fontSize: 10, fontFamily: "Barlow Condensed, sans-serif", color: c, background: bg, padding: "2px 8px", borderRadius: 4, textTransform: "uppercase" }}>{status}</span>;
}

// ── Variations ─────────────────────────────────────────────────────────────────
function VariationsTab({ user }) {
  const [vars, setVars] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getAllVariations().then(({ data }) => { setVars(data); setLoading(false); }); }, []);

  const setStatus = async (id, status) => {
    setVars(prev => prev.map(v => v.id === id ? { ...v, status } : v));
    await updateVariationStatus(id, status, status === "approved" ? user.id : null);
    post("/variations/status", { id, status }).catch(() => {});
  };

  if (loading) return <><CardSkeleton /><CardSkeleton /></>;
  const awaiting = vars.filter(v => v.status === "pending");
  const decided  = vars.filter(v => v.status !== "pending");

  if (vars.length === 0) return <EmptyState icon="±" title="No variations yet" subtitle="Variations raised on site appear here for pricing and approval" />;

  return (
    <div>
      <SectionHead>Awaiting Approval ({awaiting.length})</SectionHead>
      {awaiting.length === 0 && <div style={{ fontSize: 13, color: "#444", marginBottom: 16 }}>Nothing awaiting approval</div>}
      {awaiting.map(v => (
        <div key={v.id} style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "14px 16px", marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "#555", fontFamily: "Barlow Condensed, sans-serif" }}>{v.ref || "—"} · {v.project?.job_number}</div>
              <div style={{ fontSize: 14, color: "#ccc", marginTop: 2 }}>{v.title}</div>
              <div style={{ fontSize: 12, color: "#555", marginTop: 3 }}>{v.project?.street} · {new Date(v.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</div>
            </div>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 20, color: "#e07b39", flexShrink: 0 }}>{v.amount ? `$${v.amount.toLocaleString()}` : "TBC"}</div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={() => setStatus(v.id, "approved")} style={{ flex: 2, padding: "9px", borderRadius: 8, border: "none", background: "#22c55e", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, cursor: "pointer" }}>APPROVE</button>
            <button onClick={() => setStatus(v.id, "rejected")} style={{ flex: 1, padding: "9px", borderRadius: 8, border: "1px solid #ef4444", background: "transparent", color: "#ef4444", fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, cursor: "pointer" }}>REJECT</button>
          </div>
        </div>
      ))}
      <SectionHead>Decided</SectionHead>
      {decided.map(v => (
        <div key={v.id} style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 8, padding: "10px 14px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: 0.75 }}>
          <div style={{ fontSize: 12, color: "#666" }}>{v.ref || ""} {v.title}</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 16, color: "#555" }}>{v.amount ? `$${v.amount.toLocaleString()}` : "—"}</span>
            <StatusBadge status={v.status} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Timesheets ─────────────────────────────────────────────────────────────────
function TimesheetsTab({ user }) {
  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getAllTimesheets().then(({ data }) => { setSheets(data); setLoading(false); }); }, []);

  const approve = async (id) => {
    setSheets(prev => prev.map(t => t.id === id ? { ...t, status: "approved" } : t));
    await approveTimesheet(id, user.id);
    post("/timesheets/approve", { id }).catch(() => {});
  };

  if (loading) return <><CardSkeleton /><CardSkeleton /></>;
  const pending = sheets.filter(t => t.status === "pending");
  const approved = sheets.filter(t => t.status === "approved");

  if (sheets.length === 0) return <EmptyState icon="📋" title="No timesheets yet" subtitle="Timesheets appear here when workers clock in and out" />;

  return (
    <div>
      <SectionHead>Pending ({pending.length})</SectionHead>
      {pending.length === 0 && <div style={{ fontSize: 13, color: "#444", marginBottom: 16 }}>Nothing pending</div>}
      {pending.map(ts => (
        <div key={ts.id} style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: "#ccc" }}>{ts.worker?.full_name || "Unknown"}</div>
            <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>{ts.project?.street} · {new Date(ts.work_date).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}</div>
          </div>
          <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 20, color: "#e07b39" }}>{ts.hours_worked ? `${ts.hours_worked}h` : "—"}</span>
          <button onClick={() => approve(ts.id)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#22c55e", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer" }}>APPROVE</button>
        </div>
      ))}
      <SectionHead>Approved</SectionHead>
      {approved.map(ts => (
        <div key={ts.id} style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 8, padding: "10px 14px", marginBottom: 6, display: "flex", justifyContent: "space-between", opacity: 0.6 }}>
          <span style={{ fontSize: 13, color: "#888" }}>{ts.worker?.full_name} · {ts.project?.street}</span>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 16, color: "#555" }}>{ts.hours_worked ? `${ts.hours_worked}h` : "—"}</span>
            <StatusBadge status="approved" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Clients ────────────────────────────────────────────────────────────────────
function ClientsTab({ user }) {
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProjects().then(({ data }) => {
      setProjects(data);
      if (data.length > 0) setSelected(data[0].id);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    getMessages(selected, "client").then(({ data }) => setMessages(data));
  }, [selected]);

  const project = projects.find(p => p.id === selected);

  const send = async () => {
    if (!draft.trim() || !project) return;
    const { data } = await sendMessage({ project_id: project.id, sender_id: user.id, channel: "client", content: draft.trim() });
    if (data) setMessages(prev => [...prev, { ...data, sender: { full_name: user.name, role: "office" } }]);
    setDraft("");
    post("/messages", { project_id: project.id, content: draft.trim(), clientEmail: project.client_email, projectName: project.street }).catch(() => {});
  };

  if (loading) return <CardSkeleton />;
  if (projects.length === 0) return <EmptyState icon="👤" title="No projects yet" subtitle="Create a project first to message its client" />;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 180px)" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {projects.map(p => (
          <button key={p.id} onClick={() => setSelected(p.id)} style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${selected === p.id ? "#e07b39" : "#2a2a2a"}`, background: selected === p.id ? "#2a1800" : "transparent", color: selected === p.id ? "#e07b39" : "#666", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer" }}>
            {p.job_number || p.street}
          </button>
        ))}
      </div>
      {project && (
        <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 16, color: "#f0f0f0" }}>{project.client_name || "No client name"}</div>
          <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>{[project.client_email, project.client_phone].filter(Boolean).join(" · ") || "No contact details"}</div>
        </div>
      )}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
        {messages.length === 0 && <div style={{ fontSize: 13, color: "#444", textAlign: "center", paddingTop: 20 }}>No messages with this client yet</div>}
        {messages.map(msg => {
          const out = ["office","builder","supervisor"].includes(msg.sender?.role);
          return (
            <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: out ? "flex-end" : "flex-start" }}>
              <div style={{ fontSize: 10, color: "#444", marginBottom: 2 }}>{msg.sender?.full_name || "Client"}</div>
              <div style={{ maxWidth: "75%", background: out ? "#2a1800" : "#1a1a1a", border: `1px solid ${out ? "#3a2200" : "#222"}`, borderRadius: 10, padding: "9px 13px", fontSize: 13, color: "#ccc", lineHeight: 1.5 }}>{msg.content}</div>
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

// ── Documents ──────────────────────────────────────────────────────────────────
function DocumentsTab() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getAllDocuments().then(({ data }) => { setDocs(data); setLoading(false); }); }, []);

  if (loading) return <><CardSkeleton /><CardSkeleton /></>;
  if (docs.length === 0) return <EmptyState icon="📄" title="No documents yet" subtitle="Project documents uploaded by site teams appear here" />;

  // group by project
  const byProject = {};
  docs.forEach(d => {
    const key = d.project?.street || "Unassigned";
    (byProject[key] = byProject[key] || []).push(d);
  });

  return (
    <div>
      {Object.entries(byProject).map(([proj, list]) => (
        <div key={proj} style={{ marginBottom: 20 }}>
          <SectionHead>{proj}</SectionHead>
          {list.map(doc => (
            <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, marginBottom: 6, opacity: doc.superseded ? 0.5 : 1 }}>
              <span style={{ fontSize: 20 }}>📄</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: "#ccc" }}>{doc.name}{doc.superseded && <span style={{ marginLeft: 8, fontSize: 10, color: "#ef4444", fontFamily: "Barlow Condensed, sans-serif" }}>SUPERSEDED</span>}</div>
                <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{doc.category}{doc.created_at && ` · ${new Date(doc.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}`}</div>
              </div>
              {doc.file_url && <a href={doc.file_url} target="_blank" rel="noreferrer" style={{ color: "#3b82f6", fontSize: 18, textDecoration: "none" }}>↓</a>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Shell ──────────────────────────────────────────────────────────────────────
export default function OfficeAdminApp({ user }) {
  const [tab, setTab] = useState("variations");

  const renderTab = () => {
    switch (tab) {
      case "variations": return <VariationsTab user={user} />;
      case "timesheets": return <TimesheetsTab user={user} />;
      case "clients":    return <ClientsTab user={user} />;
      case "documents":  return <DocumentsTab />;
      default: return <EmptyState icon="📅" title="Schedule coming next" subtitle="Weekly scheduling view is on the roadmap" />;
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
          <div style={{ flex: 1 }}><div style={{ fontSize: 12, color: "#ccc" }}>{user.name}</div><div style={{ fontSize: 11, color: "#555" }}>Office Admin</div></div>
          <button onClick={() => supabase.auth.signOut()} style={{ background: "none", border: "none", color: "#444", fontSize: 12, cursor: "pointer" }} title="Sign out">⏻</button>
        </div>
      </aside>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <header style={{ background: "#111", borderBottom: "1px solid #1e1e1e", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }} className="office-topbar">
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 18, fontWeight: 700 }}><span style={{ color: "#e07b39" }}>SCS</span> BuildHub</div>
          <button onClick={() => supabase.auth.signOut()} style={{ background: "none", border: "none", color: "#555", fontSize: 13, cursor: "pointer" }}>Sign out</button>
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
