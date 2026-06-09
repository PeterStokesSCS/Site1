import { useState, useEffect } from "react";
import { getProjects, createProject, updateProject, getAllTimesheets, approveTimesheet, getProfiles, updateProfile, getAllProjectMembers, addProjectMember, removeProjectMember, seedProjectMilestones, getAllCommercialItems, getAllVariations, getPendingVisibilityRequests, approveClientVisibility, rejectClientVisibility, getAttendanceForDay, getVariationLabour, getDailyLogs, approveProjectDayLabour, amendTimesheet } from "../../lib/db";
import { VIC_MILESTONES } from "../../lib/timeline";
import { geocodeAddress } from "../../lib/geocode";
import { supabase } from "../../lib/supabase";
import { HEALTH } from "../../lib/theme";
import { Skeleton, CardSkeleton, EmptyState } from "../shared/LoadingScreen";
import ProjectDashboard from "../shared/ProjectDashboard";
import ProjectHeader from "../shared/ProjectHeader";
import BackHeader from "../shared/BackHeader";
import LabourHub from "./LabourHub";
import ActionQueue, { useActionItems } from "../shared/ActionQueue";
import { KIND_TO_PROJECT_SCREEN } from "../../lib/actionQueue";
import TeamMemberDetail from "./TeamMemberDetail";

const LAST_PROJECT_KEY = "scs_builder_last_project";

// Company-level spine (5 tabs). "Commercial" reads distinctly from the in-project
// Commercial → Variations; Safety lives inside each project's dashboard, not here.
const TABS = [
  { id: "dashboard",  label: "Dashboard",  icon: "⊞" },
  { id: "projects",   label: "Projects",   icon: "🏗" },
  { id: "labour",     label: "Labour",     icon: "👷" },
  { id: "commercial", label: "Commercial", icon: "💰" },
  { id: "team",       label: "Team",       icon: "👤" },
];

// ── Project health card ────────────────────────────────────────────────────────
function ProjectCard({ project, onOpen }) {
  const h = HEALTH[project.health] || HEALTH.green;
  const pct = project.budget ? Math.round(((project.spent || 0) / project.budget) * 100) : 0;
  const barColor = pct > 90 ? "#ef4444" : pct > 70 ? "#f59e0b" : "#22c55e";
  return (
    <div onClick={onOpen} style={{ background: "#141414", border: `1px solid ${h.border}`, borderRadius: 14, padding: "18px", cursor: onOpen ? "pointer" : "default", transition: "border-color 0.15s" }}
      onMouseEnter={e => { if (onOpen) e.currentTarget.style.borderColor = "#e07b39"; }}
      onMouseLeave={e => { if (onOpen) e.currentTarget.style.borderColor = h.border; }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "#555", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: 1, textTransform: "uppercase" }}>{project.job_number}</div>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, fontWeight: 700, color: "#f0f0f0", textTransform: "uppercase", lineHeight: 1.1, marginTop: 2 }}>{project.street}</div>
          <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>{project.client_name}</div>
        </div>
        <div style={{ fontSize: 11, fontFamily: "Barlow Condensed, sans-serif", color: h.color, background: h.bg, border: `1px solid ${h.border}`, padding: "4px 12px", borderRadius: 20, flexShrink: 0 }}>
          ● {h.label.toUpperCase()}
        </div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#666", marginBottom: 4 }}>
          <span>{project.phase || "—"}</span><span>{project.progress || 0}%</span>
        </div>
        <div style={{ height: 4, background: "#222", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${project.progress || 0}%`, background: "#e07b39", borderRadius: 2 }} />
        </div>
      </div>
      {project.budget && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#666", marginBottom: 4 }}>
            <span>${(project.spent || 0).toLocaleString()} spent</span>
            <span style={{ color: pct > 90 ? "#ef4444" : "#666" }}>{pct}% of ${project.budget.toLocaleString()}</span>
          </div>
          <div style={{ height: 4, background: "#222", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: barColor, borderRadius: 2 }} />
          </div>
          {pct > 90 && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 3 }}>⚠ Overspend warning</div>}
        </div>
      )}
    </div>
  );
}

// ── Dashboard tab ──────────────────────────────────────────────────────────────
function DashboardTab({ projects, timesheets, onNavigate, onOpenProject, user, onOpenAction, lastProject }) {
  const active = projects.filter(p => p.status === "active").length;
  const pendingTs = timesheets.filter(t => t.status === "pending").length;
  const { items: actionItems } = useActionItems("builder", user.id);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 30, fontWeight: 700, color: "#f0f0f0" }}>Company Dashboard</div>
        <div style={{ fontSize: 14, color: "#555", marginTop: 4 }}>{new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
      </div>

      {/* One-tap return to the last project worked on (builder remembers it across sessions) */}
      {lastProject && (
        <button onClick={() => onOpenProject(lastProject)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, background: "#1a1206", border: "1px solid #e07b3955", borderRadius: 12, padding: "12px 16px", marginBottom: 16, cursor: "pointer", textAlign: "left" }}>
          <span style={{ fontSize: 18 }}>↩</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: "#e0a060", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Barlow Condensed, sans-serif" }}>Resume last project</div>
            <div style={{ fontSize: 15, color: "#f0f0f0", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lastProject.street}{lastProject.job_number ? ` · ${lastProject.job_number}` : ""}</div>
          </div>
          <span style={{ color: "#e07b39", fontSize: 20 }}>›</span>
        </button>
      )}

      <ActionQueue items={actionItems} title="Action Queue" onOpen={onOpenAction} allClear="No outstanding actions" />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 28 }}>
        {[
          { v: active,    l: "Active Projects",       c: "#e07b39", tab: "projects", filter: { status: "active" } },
          { v: pendingTs, l: "Timesheets to Approve", c: "#f59e0b", tab: "labour" },
          { v: projects.filter(p => p.health === "red").length,   l: "At Risk",    c: "#ef4444", tab: "projects", filter: { health: "red" } },
          { v: projects.filter(p => p.health === "amber").length, l: "Attention",  c: "#f59e0b", tab: "projects", filter: { health: "amber" } },
        ].map(s => (
          <button key={s.l} onClick={() => onNavigate(s.tab, s.filter)} style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 12, padding: "16px 20px", flex: "1 1 130px", minWidth: 120, cursor: "pointer", textAlign: "left" }}>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 36, fontWeight: 700, color: s.c, lineHeight: 1 }}>{s.v}</div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>{s.l}</div>
          </button>
        ))}
      </div>
      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14 }}>Project Health</div>
      {projects.length === 0
        ? <EmptyState icon="🏗" title="No projects yet" subtitle="Create your first project to get started" />
        : <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>{projects.map(p => <div key={p.id} style={{ flex: "1 1 280px", minWidth: 260 }}><ProjectCard project={p} onOpen={() => onOpenProject(p)} /></div>)}</div>
      }
    </div>
  );
}

// ── Projects tab ───────────────────────────────────────────────────────────────
function ProjectsTab({ projects, onProjectCreated, initialFilter, onOpenProject }) {
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState(initialFilter || null); // {status} | {health} | null
  useEffect(() => { setFilter(initialFilter || null); }, [initialFilter]);
  const [form, setForm] = useState({ job_number: "", street: "", suburb: "", client_name: "", client_email: "", client_phone: "", budget: "", phase: "Planning", status: "planning", health: "green" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.job_number.trim()) { setError("Job Number is required."); return; }
    if (!form.street.trim()) { setError("Street Address is required."); return; }
    setSaving(true); setError(null);
    const { data, error } = await createProject({ ...form, budget: parseFloat(form.budget) || null });
    if (error) { setError(error.message); setSaving(false); return; }
    // Seed the Victorian stage-milestone skeleton for the new project.
    seedProjectMilestones(data.id, VIC_MILESTONES).catch(() => {});
    onProjectCreated(data);
    setShowForm(false);
    setForm({ job_number: "", street: "", suburb: "", client_name: "", client_email: "", client_phone: "", budget: "", phase: "Planning", status: "planning", health: "green" });
    setSaving(false);
    // Best-effort: geocode the address so photos can be verified on-site
    geocodeAddress([form.street, form.suburb].filter(Boolean).join(", ")).then(coords => {
      if (coords) updateProject(data.id, coords);
    });
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 28, fontWeight: 700, color: "#f0f0f0" }}>PROJECTS</div>
        <button onClick={() => setShowForm(s => !s)} style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: showForm ? "#333" : "#e07b39", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, cursor: "pointer" }}>
          {showForm ? "CANCEL" : "+ NEW PROJECT"}
        </button>
      </div>

      {showForm && (
        <div style={{ background: "#141414", border: "1px solid #2a2a2a", borderRadius: 14, padding: 24, marginBottom: 24 }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 18, color: "#e07b39", marginBottom: 16 }}>NEW PROJECT</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 4 }}>
            <div style={field}>
              <label style={lbl}>Job Number *</label>
              <input value={form.job_number} onChange={e => set("job_number", e.target.value)} placeholder="SCS-004" style={inp} />
            </div>
            <div style={field}>
              <label style={lbl}>Phase</label>
              <input value={form.phase} onChange={e => set("phase", e.target.value)} placeholder="Planning" style={inp} />
            </div>
          </div>
          <div style={field}>
            <label style={lbl}>Street Address *</label>
            <input value={form.street} onChange={e => set("street", e.target.value)} placeholder="12 Example Street" style={inp} />
          </div>
          <div style={field}>
            <label style={lbl}>Suburb / State</label>
            <input value={form.suburb} onChange={e => set("suburb", e.target.value)} placeholder="Sassafras VIC 3787" style={inp} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={field}>
              <label style={lbl}>Client Name</label>
              <input value={form.client_name} onChange={e => set("client_name", e.target.value)} placeholder="John & Jane Smith" style={inp} />
            </div>
            <div style={field}>
              <label style={lbl}>Budget ($)</label>
              <input type="number" value={form.budget} onChange={e => set("budget", e.target.value)} placeholder="350000" style={inp} />
            </div>
            <div style={field}>
              <label style={lbl}>Client Email</label>
              <input value={form.client_email} onChange={e => set("client_email", e.target.value)} placeholder="client@email.com" style={inp} />
            </div>
            <div style={field}>
              <label style={lbl}>Client Phone</label>
              <input value={form.client_phone} onChange={e => set("client_phone", e.target.value)} placeholder="0400 000 000" style={inp} />
            </div>
          </div>
          {error && <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <button onClick={save} disabled={saving} style={{ width: "100%", padding: "14px", borderRadius: 10, border: "none", background: "#e07b39", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 17, cursor: saving ? "not-allowed" : "pointer", marginTop: 4 }}>
            {saving ? "SAVING..." : "CREATE PROJECT"}
          </button>
        </div>
      )}

      {/* Filter chips */}
      {projects.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {[
            { key: null,                  label: "All" },
            { key: { status: "active" },  label: "Active" },
            { key: { status: "planning" },label: "Planning" },
            { key: { health: "red" },     label: "At Risk" },
            { key: { health: "amber" },   label: "Attention" },
          ].map(f => {
            const on = JSON.stringify(filter) === JSON.stringify(f.key);
            return (
              <button key={f.label} onClick={() => setFilter(f.key)} style={{ padding: "6px 14px", borderRadius: 16, border: `1px solid ${on ? "#e07b39" : "#2a2a2a"}`, background: on ? "#2a1800" : "transparent", color: on ? "#e07b39" : "#666", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer" }}>{f.label}</button>
            );
          })}
        </div>
      )}

      {(() => {
        const shown = projects.filter(p => {
          if (!filter) return true;
          if (filter.status) return p.status === filter.status;
          if (filter.health) return p.health === filter.health;
          return true;
        });
        if (projects.length === 0 && !showForm) return <EmptyState icon="🏗" title="No projects yet" subtitle="Click + NEW PROJECT to get started" />;
        if (shown.length === 0) return <EmptyState icon="🔍" title="No projects match" subtitle="Try a different filter" />;
        return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>{shown.map(p => <ProjectCard key={p.id} project={p} onOpen={() => onOpenProject(p)} />)}</div>;
      })()}
    </div>
  );
}

// ── Team management tab ────────────────────────────────────────────────────────
const ROLE_COLOR = { builder: "#e07b39", supervisor: "#f59e0b", worker: "#22c55e", subcontractor: "#3b82f6", client: "#a855f7", office: "#06b6d4" };

// Suppliers aren't user profiles — they're the vendors named on commercial records.
// This directory derives them from commercial_items.vendor across all projects.
const TYPE_LABEL = { contract: "Contracts", purchase_order: "POs", quote: "Quotes", invoice: "Invoices", receipt: "Receipts", procurement: "Procurement", subbie_pos: "Subbie POs", cost: "Cost" };

function SupplierDirectory({ commercial, projects }) {
  const projMap = Object.fromEntries(projects.map(p => [p.id, p]));
  const byVendor = {};
  commercial.forEach(it => {
    const name = (it.vendor || "").trim();
    if (!name) return;
    const key = name.toLowerCase();
    const s = byVendor[key] || (byVendor[key] = { name, count: 0, total: 0, types: new Set(), projects: new Set(), last: null });
    s.count += 1;
    if (it.amount) s.total += Number(it.amount) || 0;
    if (it.type) s.types.add(it.type);
    if (it.project_id) s.projects.add(it.project_id);
    if (!s.last || (it.created_at || "") > s.last) s.last = it.created_at;
  });
  const suppliers = Object.values(byVendor).sort((a, b) => b.count - a.count || b.total - a.total);
  const money = (n) => n ? `$${Number(n).toLocaleString()}` : "—";

  if (suppliers.length === 0) return <EmptyState icon="🏭" title="No suppliers yet" subtitle="Suppliers appear here once they're named as the vendor on a contract, PO, quote, invoice or receipt in Commercial." />;

  return (
    <>
      <div style={{ fontSize: 12, color: "#555", marginBottom: 12 }}>{suppliers.length} supplier{suppliers.length === 1 ? "" : "s"} — derived from vendors named on commercial records.</div>
      {suppliers.map(s => {
        const projNames = [...s.projects].map(id => projMap[id]?.job_number || projMap[id]?.street).filter(Boolean);
        return (
          <div key={s.name} style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "14px 16px", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: "#1e1200", color: "#d97706", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🏭</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, color: "#eee", fontWeight: 600 }}>{s.name}</div>
                <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>{s.count} record{s.count === 1 ? "" : "s"}{projNames.length ? ` · ${projNames.length} project${projNames.length === 1 ? "" : "s"}` : ""}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 18, color: "#e07b39" }}>{money(s.total)}</div>
                <div style={{ fontSize: 9, color: "#555" }}>total billed</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              {[...s.types].map(t => <span key={t} style={{ fontSize: 10, fontFamily: "Barlow Condensed, sans-serif", color: "#888", background: "#1a1a1a", border: "1px solid #2a2a2a", padding: "2px 8px", borderRadius: 4, textTransform: "uppercase" }}>{TYPE_LABEL[t] || t}</span>)}
            </div>
          </div>
        );
      })}
    </>
  );
}

function TeamTab() {
  const [profiles, setProfiles] = useState([]);
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);   // all project_members rows
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);  // user id whose role is being edited
  const [assigning, setAssigning] = useState(null); // user id whose projects are being edited
  const [editName, setEditName] = useState(null); // user id whose name is being edited
  const [nameDraft, setNameDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all");   // all / internal / subs / clients / suppliers
  const [detail, setDetail] = useState(null);     // profile shown in the detail screen
  const [commercial, setCommercial] = useState([]); // all commercial_items, for the supplier directory

  const GROUP_OF = (role) => role === "subcontractor" ? "subs" : role === "client" ? "clients" : "internal";
  const FILTERS = [["all", "All"], ["internal", "Internal"], ["subs", "Subcontractors"], ["clients", "Clients"], ["suppliers", "Suppliers"]];

  const saveName = async (id) => {
    setSaving(true);
    const name = nameDraft.trim() || null;
    await updateProfile(id, { full_name: name });
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, full_name: name } : p));
    setEditName(null);
    setSaving(false);
  };

  useEffect(() => {
    Promise.all([getProfiles(), getProjects(), getAllProjectMembers(), getAllCommercialItems()]).then(([pr, pj, mb, ci]) => {
      setProfiles(pr.data); setProjects(pj.data); setMembers(mb.data); setCommercial(ci.data || []); setLoading(false);
    });
  }, []);

  const saveRole = async (id, role) => {
    setSaving(true);
    await updateProfile(id, { role });
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, role } : p));
    setEditing(null);
    setSaving(false);
  };

  const memberProjectIds = (userId) => members.filter(m => m.user_id === userId).map(m => m.project_id);

  const toggleProject = async (user, projectId) => {
    const assigned = members.some(m => m.user_id === user.id && m.project_id === projectId);
    if (assigned) {
      setMembers(prev => prev.filter(m => !(m.user_id === user.id && m.project_id === projectId)));
      await removeProjectMember(projectId, user.id);
    } else {
      const { data } = await addProjectMember(projectId, user.id, user.role);
      if (data) setMembers(prev => [...prev, data]);
    }
  };

  const ROLES = ["builder", "supervisor", "worker", "subcontractor", "client", "office"];

  if (detail) return <TeamMemberDetail profile={detail} projects={projects} members={members} onBack={() => setDetail(null)} onUpdated={(u) => { setProfiles(prev => prev.map(p => p.id === u.id ? u : p)); setDetail(u); }} />;

  const shownProfiles = profiles.filter(p => filter === "all" || GROUP_OF(p.role) === filter);

  return (
    <div>
      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 28, fontWeight: 700, color: "#f0f0f0", marginBottom: 8 }}>TEAM</div>
      <div style={{ fontSize: 13, color: "#555", marginBottom: 14 }}>Create users in Supabase Authentication, then set their role and assign them to projects here. Tap a person for their full profile, licences and history.</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {FILTERS.map(([k, l]) => <button key={k} onClick={() => setFilter(k)} style={{ padding: "6px 14px", borderRadius: 16, border: `1px solid ${filter === k ? "#e07b39" : "#2a2a2a"}`, background: filter === k ? "#2a1800" : "transparent", color: filter === k ? "#e07b39" : "#666", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer" }}>{l}</button>)}
      </div>
      {loading
        ? [1,2,3].map(i => <CardSkeleton key={i} />)
        : filter === "suppliers"
        ? <SupplierDirectory commercial={commercial} projects={projects} />
        : shownProfiles.map(p => {
          const isAdmin = p.role === "builder" || p.role === "office";
          const assignedIds = memberProjectIds(p.id);
          return (
          <div key={p.id} style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "14px 16px", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#e07b39", color: "#0c0c0c", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                {(p.full_name || "?").split(" ").map(n => n[0]).join("").slice(0, 2)}
              </div>
              <div style={{ flex: 1 }}>
                {editName === p.id
                  ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 2 }}>
                      <input value={nameDraft} onChange={e => setNameDraft(e.target.value)} placeholder="Full name" autoFocus onKeyDown={e => e.key === "Enter" && saveName(p.id)} style={{ flex: 1, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 6, color: "#f0f0f0", fontSize: 14, padding: "6px 9px", fontFamily: "DM Sans, sans-serif" }} />
                      <button onClick={() => saveName(p.id)} disabled={saving} style={{ padding: "6px 10px", borderRadius: 6, border: "none", background: "#22c55e", color: "#fff", fontSize: 12, cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif" }}>SAVE</button>
                      <button onClick={() => setEditName(null)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #333", background: "transparent", color: "#666", fontSize: 12, cursor: "pointer" }}>✕</button>
                    </div>
                  )
                  : <div onClick={() => { setEditName(p.id); setNameDraft(p.full_name || ""); }} style={{ fontSize: 14, color: p.full_name ? "#ccc" : "#f59e0b", cursor: "pointer" }} title="Click to edit name">{p.full_name || "Set name…"} <span style={{ fontSize: 11, color: "#555" }}>✎</span></div>
                }
                {editing === p.id
                  ? (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                      {ROLES.map(r => (
                        <button key={r} onClick={() => saveRole(p.id, r)} disabled={saving} style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${p.role === r ? ROLE_COLOR[r] : "#2a2a2a"}`, background: p.role === r ? "#1a1a1a" : "transparent", color: ROLE_COLOR[r] || "#888", fontSize: 12, cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif", textTransform: "capitalize" }}>{r}</button>
                      ))}
                      <button onClick={() => setEditing(null)} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #333", background: "transparent", color: "#555", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                    </div>
                  )
                  : <div style={{ fontSize: 12, color: ROLE_COLOR[p.role] || "#555", textTransform: "capitalize", marginTop: 2 }}>{p.role || "No role assigned"}{!isAdmin && ` · ${assignedIds.length} project${assignedIds.length === 1 ? "" : "s"}`}</div>
                }
              </div>
              {editing !== p.id && (
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button onClick={() => setDetail(p)} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #2a2a2a", background: "transparent", color: "#e07b39", fontSize: 12, cursor: "pointer" }}>Profile</button>
                  {!isAdmin && <button onClick={() => setAssigning(assigning === p.id ? null : p.id)} style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${assigning === p.id ? "#e07b39" : "#2a2a2a"}`, background: "transparent", color: assigning === p.id ? "#e07b39" : "#666", fontSize: 12, cursor: "pointer" }}>Projects</button>}
                  <button onClick={() => setEditing(p.id)} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #2a2a2a", background: "transparent", color: "#666", fontSize: 12, cursor: "pointer" }}>Role</button>
                </div>
              )}
            </div>

            {/* Project assignment */}
            {assigning === p.id && !isAdmin && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #1e1e1e" }}>
                <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Barlow Condensed, sans-serif", marginBottom: 8 }}>Assigned projects</div>
                {projects.length === 0 ? <div style={{ fontSize: 12, color: "#444" }}>No projects yet</div> : (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {projects.map(pj => {
                      const on = assignedIds.includes(pj.id);
                      return (
                        <button key={pj.id} onClick={() => toggleProject(p, pj.id)} style={{ padding: "6px 11px", borderRadius: 16, border: `1px solid ${on ? "#22c55e" : "#2a2a2a"}`, background: on ? "#06200e" : "transparent", color: on ? "#22c55e" : "#777", fontSize: 12, cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif", display: "flex", alignItems: "center", gap: 5 }}>
                          {on && <span style={{ fontSize: 10 }}>✓</span>}{pj.job_number || pj.street}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
          );
        })
      }
    </div>
  );
}

// ── Company Commercial (all-projects variations roll-up) ───────────────────────
const VAR_STATUS = {
  draft:              { label: "Draft",             color: "#888",    bg: "#1a1a1a" },
  pending:            { label: "Pending",           color: "#f59e0b", bg: "#251d00" },
  approved_for_issue: { label: "Ready to Send",     color: "#a855f7", bg: "#1a0c33" },
  sent:               { label: "Awaiting Sign-off", color: "#0ea5e9", bg: "#0c2233" },
  approved:           { label: "Approved",          color: "#22c55e", bg: "#06200e" },
  rejected:           { label: "Rejected",          color: "#ef4444", bg: "#2a0c0c" },
  superseded:         { label: "Superseded",        color: "#888",    bg: "#1a1a1a" },
};
const cmoney = (n) => (n || n === 0) ? `$${Number(n).toLocaleString()}` : "—";

function CompanyCommercialTab({ projects, onOpenVariation }) {
  const [vars, setVars] = useState(null);
  const [filter, setFilter] = useState("all");
  useEffect(() => { getAllVariations().then(({ data }) => setVars(data || [])); }, []);

  const FILTERS = [["all", "All"], ["sent", "Awaiting"], ["approved_for_issue", "Ready"], ["draft", "Draft"], ["approved", "Approved"], ["rejected", "Rejected"]];
  const projById = Object.fromEntries(projects.map(p => [p.id, p]));
  const shown = vars === null ? [] : (filter === "all" ? vars : vars.filter(v => v.status === filter));
  const approvedTotal = (vars || []).filter(v => v.status === "approved").reduce((s, v) => s + (Number(v.total_inc_gst ?? v.amount) || 0), 0);

  return (
    <div>
      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 28, fontWeight: 700, color: "#f0f0f0", marginBottom: 4 }}>COMMERCIAL</div>
      <div style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>Variations across all projects · approved total <span style={{ color: "#22c55e", fontFamily: "Barlow Condensed, sans-serif", fontSize: 16 }}>{cmoney(approvedTotal)}</span></div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {FILTERS.map(([k, l]) => {
          const n = k === "all" ? (vars || []).length : (vars || []).filter(v => v.status === k).length;
          return <button key={k} onClick={() => setFilter(k)} style={{ padding: "6px 13px", borderRadius: 16, border: `1px solid ${filter === k ? "#e07b39" : "#2a2a2a"}`, background: filter === k ? "#2a1800" : "transparent", color: filter === k ? "#e07b39" : "#666", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer" }}>{l}{n ? ` ${n}` : ""}</button>;
        })}
      </div>
      {vars === null ? [1, 2, 3].map(i => <CardSkeleton key={i} />)
        : shown.length === 0 ? <EmptyState icon="±" title="No variations" subtitle="Variations raised on any project roll up here" />
        : shown.map(v => {
          const st = VAR_STATUS[v.status] || VAR_STATUS.draft;
          const proj = projById[v.project_id] || v.project;
          return (
            <div key={v.id} onClick={() => proj && onOpenVariation(proj, v.id)} style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "14px", marginBottom: 8, cursor: "pointer", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: "#777", fontFamily: "Barlow Condensed, sans-serif" }}>{v.project?.job_number || proj?.job_number || ""} · {v.ref || ""}{v.revision_label ? ` ${v.revision_label}` : ""}</div>
                <div style={{ fontSize: 14, color: "#ddd", marginTop: 2 }}>{v.title}</div>
                <div style={{ fontSize: 12, color: "#777", marginTop: 2 }}>{v.project?.street || proj?.street || ""}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 17, color: "#e07b39" }}>{cmoney(v.total_inc_gst ?? v.amount)}</div>
                <div style={{ marginTop: 4 }}><span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, fontFamily: "Barlow Condensed, sans-serif", color: st.color, background: st.bg, border: `1px solid ${st.color}55`, padding: "3px 10px", borderRadius: 6, textTransform: "uppercase", whiteSpace: "nowrap" }}>{st.label}</span></div>
              </div>
            </div>
          );
        })}
    </div>
  );
}

// ── Client-visibility approval review (#11) ────────────────────────────────────
function VisibilityReview({ onBack }) {
  const [reqs, setReqs] = useState(null);
  useEffect(() => { getPendingVisibilityRequests().then(({ data }) => setReqs(data)); }, []);
  const act = async (r, approve) => {
    setReqs(prev => prev.filter(x => !(x.table === r.table && x.id === r.id)));
    if (approve) await approveClientVisibility(r.table, r.id); else await rejectClientVisibility(r.table, r.id);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Client Visibility" subtitle="Approve what the client can see" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px", maxWidth: 620, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        {reqs === null ? [1, 2].map(i => <CardSkeleton key={i} />)
          : reqs.length === 0 ? <EmptyState icon="👁" title="No pending requests" subtitle="Visibility requests from supervisors/workers appear here for approval" />
          : reqs.map(r => (
            <div key={r.table + r.id} style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 12, padding: 14, marginBottom: 10, display: "flex", gap: 12, alignItems: "center" }}>
              {r.kind === "photo"
                ? <img src={r.url} alt="" style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover", flexShrink: 0, background: "#000" }} />
                : <div style={{ width: 64, height: 64, borderRadius: 8, background: "#251200", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>🔧</div>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, color: "#777", fontFamily: "Barlow Condensed, sans-serif", textTransform: "uppercase" }}>{r.kind}</div>
                <div style={{ fontSize: 14, color: "#e8e8e8", marginTop: 2 }}>{r.title}{r.subtitle ? ` · ${r.subtitle}` : ""}</div>
                <div style={{ fontSize: 12, color: "#777", marginTop: 2 }}>{r.project?.street || ""}{r.project?.job_number ? ` · ${r.project.job_number}` : ""}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                <button onClick={() => act(r, true)} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#22c55e", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer" }}>APPROVE</button>
                <button onClick={() => act(r, false)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #ef4444", background: "transparent", color: "#ef4444", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer" }}>REJECT</button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

// ── #5 Daily labour review (one per project per day) ───────────────────────────
const r1 = (n) => Math.round((n || 0) * 10) / 10;
const fmtClock = (iso) => iso ? new Date(iso).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true }) : "—";
const toLocalInput = (iso) => { const d = iso ? new Date(iso) : new Date(); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

function LabourReviewScreen({ project, date, user, onBack }) {
  const [roll, setRoll] = useState(null);
  const [vlabour, setVlabour] = useState([]);
  const [log, setLog] = useState(undefined);
  const [approved, setApproved] = useState(false);
  const [amendId, setAmendId] = useState(null);
  const [amendOut, setAmendOut] = useState("");
  const [amendNote, setAmendNote] = useState("");

  const reload = () => getAttendanceForDay(project.id, date).then(({ data }) => setRoll(data));
  useEffect(() => {
    reload();
    getVariationLabour(project.id).then(({ data }) => setVlabour((data || []).filter(v => String(v.work_date || "").slice(0, 10) === date)));
    getDailyLogs(project.id).then(({ data }) => setLog((data || []).find(l => String(l.log_date || "").slice(0, 10) === date) || null));
  }, [project.id, date]); // eslint-disable-line react-hooks/exhaustive-deps

  const workers = (roll || []).filter(r => r.kind === "worker");
  const visitors = (roll || []).filter(r => r.kind === "visit");
  const totalHours = r1(workers.reduce((s, r) => s + (r.hours || 0), 0));
  const openShifts = workers.filter(r => !r.outIso);
  const counts = {}; workers.forEach(r => { counts[r.name] = (counts[r.name] || 0) + 1; });
  const multi = Object.entries(counts).filter(([, n]) => n > 1).map(([name]) => name);
  const vlHours = r1(vlabour.reduce((s, v) => s + (Number(v.hours) || 0) * (v.worker_ids?.length || 1), 0));
  const fmtDate = new Date(`${date}T00:00:00`).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });

  const startAmend = (r) => { setAmendId(r.id); setAmendOut(toLocalInput(r.outIso || r.inIso)); setAmendNote(""); };
  const saveAmend = async (r) => {
    const outIso = new Date(amendOut).toISOString();
    const hours = r1((new Date(outIso) - new Date(r.inIso)) / 3600000);
    await amendTimesheet(r.id, { clock_out: outIso, hours_worked: hours }, user.id, amendNote.trim() || "Amended in labour review");
    setAmendId(null); reload();
  };
  const approveDay = async () => { await approveProjectDayLabour(project.id, date, user.id); setApproved(true); };

  const tile = (val, label, color) => (
    <div style={{ flex: 1, background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "12px", textAlign: "center" }}>
      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 26, fontWeight: 700, color }}>{val}</div>
      <div style={{ fontSize: 10, color: "#777", textTransform: "uppercase", letterSpacing: 0.3, fontFamily: "Barlow Condensed, sans-serif", marginTop: 2 }}>{label}</div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Daily Labour Review" subtitle={`${project.street} · ${fmtDate}`} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px", maxWidth: 620, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {tile(workers.length, "Workers", "#22c55e")}
          {tile(`${totalHours}h`, "Total hours", "#e07b39")}
          {tile(openShifts.length, "Open shifts", openShifts.length ? "#ef4444" : "#555")}
        </div>
        {openShifts.length > 0 && <div style={{ background: "#2a0c0c", border: "1px solid #ef444444", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#f0a0a0", marginBottom: 10 }}>⚠ {openShifts.length} open / missing sign-out(s) — amend the time below, or wait for sign-out.</div>}
        {multi.length > 0 && <div style={{ fontSize: 12, color: "#f59e0b", marginBottom: 10 }}>↺ Multiple periods today: {multi.join(", ")}</div>}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "10px 14px", marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: "#888" }}>Daily log <span style={{ fontSize: 11, color: "#555" }}>(supervisor's — does not block approval)</span></span>
          <span style={{ fontSize: 12, fontFamily: "Barlow Condensed, sans-serif", color: log === undefined ? "#555" : log ? "#22c55e" : "#f59e0b" }}>{log === undefined ? "…" : log ? "SUBMITTED" : "NOT SUBMITTED"}</span>
        </div>
        {(vlabour.length > 0 || visitors.length > 0) && (
          <div style={{ display: "flex", justifyContent: "space-between", background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#888" }}>
            <span>Variation labour: <b style={{ color: "#ccc" }}>{vlabour.length}</b> entr{vlabour.length === 1 ? "y" : "ies"}{vlHours ? ` · ${vlHours}h` : ""}</span>
            {visitors.length > 0 && <span>Visitors/subs: <b style={{ color: "#ccc" }}>{visitors.length}</b></span>}
          </div>
        )}

        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Shifts</div>
        {roll === null ? [1, 2].map(i => <div key={i} style={{ height: 56, background: "#141414", borderRadius: 10, marginBottom: 8 }} />)
          : workers.length === 0 ? <EmptyState icon="👷" title="No worker shifts" subtitle="Nobody clocked in for this project that day" />
          : workers.map(r => (
            <div key={r.id} style={{ background: "#141414", border: `1px solid ${!r.outIso ? "#ef444455" : "#1e1e1e"}`, borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: "#ddd" }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: "#777" }}>{fmtClock(r.inIso)} → {r.outIso ? fmtClock(r.outIso) : <span style={{ color: "#ef4444" }}>not signed out</span>}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 16, color: r.outIso ? "#e07b39" : "#777" }}>{r.outIso ? `${r1(r.hours)}h` : "—"}</span>
                  {!approved && <button onClick={() => startAmend(r)} style={{ padding: "6px 11px", borderRadius: 7, border: "1px solid #2a2a2a", background: "transparent", color: "#0ea5e9", fontFamily: "Barlow Condensed, sans-serif", fontSize: 12, cursor: "pointer" }}>Amend</button>}
                </div>
              </div>
              {amendId === r.id && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #1e1e1e" }}>
                  <div style={{ fontSize: 11, color: "#777", marginBottom: 4, fontFamily: "Barlow Condensed, sans-serif", textTransform: "uppercase" }}>Set sign-out time</div>
                  <input type="datetime-local" value={amendOut} onChange={e => setAmendOut(e.target.value)} style={{ width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#f0f0f0", fontSize: 14, padding: "8px 10px", fontFamily: "DM Sans, sans-serif", boxSizing: "border-box", colorScheme: "dark", marginBottom: 8 }} />
                  <input value={amendNote} onChange={e => setAmendNote(e.target.value)} placeholder="Reason (e.g. forgot to sign out)" style={{ width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#f0f0f0", fontSize: 13, padding: "8px 10px", fontFamily: "DM Sans, sans-serif", boxSizing: "border-box", marginBottom: 8 }} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => saveAmend(r)} style={{ flex: 1, padding: "9px", borderRadius: 8, border: "none", background: "#0ea5e9", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer" }}>SAVE AMENDMENT</button>
                    <button onClick={() => setAmendId(null)} style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #333", background: "transparent", color: "#888", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer" }}>CANCEL</button>
                  </div>
                </div>
              )}
            </div>
          ))}

        <div style={{ marginTop: 16 }}>
          {approved
            ? <div style={{ background: "#06200e", border: "1px solid #22c55e44", borderRadius: 10, padding: "14px", textAlign: "center", color: "#9ae6b4", fontFamily: "Barlow Condensed, sans-serif", fontSize: 16 }}>✓ Labour approved for {fmtDate}</div>
            : <button onClick={approveDay} disabled={workers.length === 0} style={{ width: "100%", padding: "15px", borderRadius: 12, border: "none", background: workers.length ? "#22c55e" : "#1e1e1e", color: workers.length ? "#fff" : "#555", fontFamily: "Barlow Condensed, sans-serif", fontSize: 18, letterSpacing: 0.5, cursor: workers.length ? "pointer" : "not-allowed" }}>APPROVE LABOUR · {totalHours}h</button>}
          <div style={{ fontSize: 11, color: "#555", textAlign: "center", marginTop: 8 }}>Approval is reversible — amend a shift to correct it (audited).</div>
        </div>
      </div>
    </div>
  );
}

// ── Builder shell ──────────────────────────────────────────────────────────────
export default function BuilderApp({ user }) {
  const [tab, setTab] = useState("dashboard");
  const [projectFilter, setProjectFilter] = useState(null);
  const [openProject, setOpenProject] = useState(null);
  const [initialScreen, setInitialScreen] = useState(null);
  const [focusId, setFocusId] = useState(null);   // entityId to deep-link on the destination screen
  const [focusKind, setFocusKind] = useState(null); // disambiguates the Commercial hub category
  const [showVisibility, setShowVisibility] = useState(false); // #11 builder approval review
  const [labourReview, setLabourReview] = useState(null);      // #5 { project, date }
  const [projects, setProjects] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [lastProjectId, setLastProjectId] = useState(() => { try { return localStorage.getItem(LAST_PROJECT_KEY); } catch { return null; } });
  const [loading, setLoading] = useState(true);

  // Remember the last project worked on so returning is one tap (persists across sessions).
  const open = (p) => { setLastProjectId(p.id); try { localStorage.setItem(LAST_PROJECT_KEY, p.id); } catch { /* ignore */ } setOpenProject(p); };

  // Open a project from a normal click (no deep-link) vs. from an action item.
  const openProjectClean = (p) => { setInitialScreen(null); setFocusId(null); setFocusKind(null); open(p); };
  const openAction = (item) => {
    const t = item.target;
    if (t.kind === "timesheet") {
      // labour.approve_day entityId = "projectId:date" → open that day's review (#5)
      const [pid, date] = String(t.entityId || "").split(":");
      const proj = projects.find(p => p.id === pid);
      if (proj && date) { setLabourReview({ project: proj, date }); return; }
      navigate("labour"); return;
    }
    if (t.kind === "visibility") { setShowVisibility(true); return; }
    const proj = projects.find(p => p.id === t.projectId);
    if (proj) { setInitialScreen(KIND_TO_PROJECT_SCREEN[t.kind] || null); setFocusId(t.entityId || null); setFocusKind(t.kind); open(proj); }
  };

  useEffect(() => {
    Promise.all([getProjects(), getAllTimesheets()]).then(([p, t]) => {
      setProjects(p.data);
      setTimesheets(t.data);
      setLoading(false);
    });
  }, []);

  // Dashboard tiles navigate to a tab, optionally pre-filtering the Projects list
  const navigate = (toTab, filter = null) => { setProjectFilter(filter); setTab(toTab); };

  // From the company Commercial tab: open a variation inside its project (reuses the deep-link).
  const openVariationInProject = (proj, varId) => { setInitialScreen("variations"); setFocusId(varId || null); setFocusKind(null); open(proj); };

  // Company spine: jump from inside a project straight to a company-level tab (one tap).
  const goCompany = (tabId) => { setInitialScreen(null); setFocusId(null); setFocusKind(null); setProjectFilter(null); setTab(tabId); setOpenProject(null); };

  const handleApprove = async (id) => {
    await approveTimesheet(id, user.id);
    setTimesheets(prev => prev.map(t => t.id === id ? { ...t, status: "approved" } : t));
  };

  if (showVisibility) return <VisibilityReview onBack={() => setShowVisibility(false)} />;
  if (labourReview) return <LabourReviewScreen project={labourReview.project} date={labourReview.date} user={user} onBack={() => setLabourReview(null)} />;

  // Opening a project takes over the full screen with its Project Dashboard.
  // Give the builder the same project-centric header as the supervisor, incl. an
  // in-context switcher so they can hop between jobs without returning to the list.
  if (openProject) {
    const switchProject = (id) => { const p = projects.find(x => x.id === id); if (p) { setInitialScreen(null); setFocusId(null); setFocusKind(null); open(p); } };
    return (
      <ProjectDashboard
        key={openProject.id}
        project={openProject}
        user={user}
        maxWidth={560}
        initialScreen={initialScreen}
        focusId={focusId}
        focusKind={focusKind}
        onSwitchProject={(pid, key, entityId = null) => { setInitialScreen(key); setFocusId(entityId); setFocusKind(null); open(projects.find(x => x.id === pid) || openProject); }}
        onBack={() => setOpenProject(null)}
        header={
          <ProjectHeader
            project={openProject}
            projects={projects}
            user={user}
            onSwitch={projects.length > 1 ? switchProject : null}
            companyNav={{ tabs: TABS, onSelect: goCompany }}
          />
        }
      />
    );
  }

  const renderTab = () => {
    if (loading) return <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{[1,2,3].map(i => <CardSkeleton key={i} />)}</div>;
    switch (tab) {
      case "dashboard":  return <DashboardTab projects={projects} timesheets={timesheets} onNavigate={navigate} onOpenProject={openProjectClean} user={user} onOpenAction={openAction} lastProject={projects.find(p => p.id === lastProjectId) || null} />;
      case "projects":   return <ProjectsTab projects={projects} initialFilter={projectFilter} onProjectCreated={p => setProjects(prev => [p, ...prev])} onOpenProject={openProjectClean} />;
      case "labour":     return <LabourHub timesheets={timesheets} projects={projects} onApprove={handleApprove} user={user} />;
      case "commercial": return <CompanyCommercialTab projects={projects} onOpenVariation={openVariationInProject} />;
      case "team":       return <TeamTab />;
      default: return <div style={{ color: "#444", padding: "40px 0", textAlign: "center", fontFamily: "Barlow Condensed, sans-serif", fontSize: 18 }}>Coming in Stage 3</div>;
    }
  };

  return (
    <div style={{ display: "flex", height: "100dvh", background: "#0c0c0c", overflow: "hidden" }}>
      <aside style={{ width: 220, background: "#111", borderRight: "1px solid #1e1e1e", display: "flex", flexDirection: "column", flexShrink: 0 }} className="builder-sidebar">
        <div style={{ padding: "20px 20px 14px", borderBottom: "1px solid #1e1e1e" }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#f0f0f0" }}><span style={{ color: "#e07b39" }}>SITE</span>1</div>
          <div style={{ fontSize: 11, color: "#444", letterSpacing: 0.5, marginTop: 2 }}>BUILDER CONSOLE</div>
        </div>
        <nav style={{ flex: 1, padding: "10px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => navigate(t.id)} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 14px", border: "none", borderRadius: 8, borderLeft: `3px solid ${tab === t.id ? "#e07b39" : "transparent"}`, background: tab === t.id ? "#1e1e1e" : "transparent", color: tab === t.id ? "#e07b39" : "#666", cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, letterSpacing: 0.3, textTransform: "uppercase", transition: "all 0.12s" }}>
              <span style={{ fontSize: 16 }}>{t.icon}</span>{t.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: "12px 16px", borderTop: "1px solid #1e1e1e", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#e07b39", color: "#0c0c0c", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Barlow Condensed, sans-serif", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{user.avatar}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#ccc" }}>{user.name}</div>
            <div style={{ fontSize: 11, color: "#555" }}>Builder / Admin</div>
          </div>
          <button onClick={() => supabase.auth.signOut()} style={{ marginLeft: "auto", background: "none", border: "none", color: "#444", fontSize: 12, cursor: "pointer" }} title="Sign out">⏻</button>
        </div>
      </aside>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <header style={{ background: "#111", borderBottom: "1px solid #1e1e1e", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }} className="builder-topbar">
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 18, fontWeight: 700 }}><span style={{ color: "#e07b39" }}>SITE</span>1</div>
          <button onClick={() => supabase.auth.signOut()} style={{ background: "none", border: "none", color: "#555", fontSize: 13, cursor: "pointer" }}>Sign out</button>
        </header>
        <main style={{ flex: 1, overflowY: "auto", padding: "24px" }}>{renderTab()}</main>
        <nav style={{ background: "#111", borderTop: "1px solid #1e1e1e", display: "flex" }} className="builder-bottomnav">
          {TABS.map(t => (
            <button key={t.id} onClick={() => navigate(t.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 4px 12px", border: "none", background: "transparent", color: tab === t.id ? "#e07b39" : "#555", borderTop: tab === t.id ? "2px solid #e07b39" : "2px solid transparent", cursor: "pointer" }}>
              <span style={{ fontSize: 17 }}>{t.icon}</span>
              <span style={{ fontSize: 9, marginTop: 3, fontFamily: "Barlow Condensed, sans-serif", textTransform: "uppercase" }}>{t.label}</span>
            </button>
          ))}
        </nav>
      </div>
      <style>{`
        @media (min-width: 768px) { .builder-topbar { display: none !important; } .builder-bottomnav { display: none !important; } .builder-sidebar { display: flex !important; } }
        @media (max-width: 767px) { .builder-sidebar { display: none !important; } .builder-topbar { display: flex !important; } .builder-bottomnav { display: flex !important; } }
      `}</style>
    </div>
  );
}

const field = { marginBottom: 14 };
const lbl = { display: "block", fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Barlow Condensed, sans-serif", marginBottom: 6 };
const inp = { width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#f0f0f0", fontSize: 14, padding: "10px 12px", fontFamily: "DM Sans, sans-serif", boxSizing: "border-box" };
