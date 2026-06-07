import { useState, useEffect } from "react";
import { getProjects, createProject, updateProject, getAllTimesheets, approveTimesheet, getProfiles, updateProfile, getAllProjectMembers, addProjectMember, removeProjectMember, seedProjectMilestones } from "../../lib/db";
import { VIC_MILESTONES } from "../../lib/timeline";
import { geocodeAddress } from "../../lib/geocode";
import { supabase } from "../../lib/supabase";
import { HEALTH } from "../../lib/theme";
import { Skeleton, CardSkeleton, EmptyState } from "../shared/LoadingScreen";
import ProjectDashboard from "../shared/ProjectDashboard";
import ActionQueue, { useActionItems } from "../shared/ActionQueue";
import { KIND_TO_PROJECT_SCREEN } from "../../lib/actionQueue";
import TeamMemberDetail from "./TeamMemberDetail";

const TABS = [
  { id: "dashboard",  label: "Dashboard",  icon: "⊞" },
  { id: "projects",   label: "Projects",   icon: "🏗" },
  { id: "labour",     label: "Labour",     icon: "👷" },
  { id: "variations", label: "Variations", icon: "±" },
  { id: "safety",     label: "Safety",     icon: "⚠️" },
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
function DashboardTab({ projects, timesheets, onNavigate, onOpenProject, user, onOpenAction }) {
  const active = projects.filter(p => p.status === "active").length;
  const pendingTs = timesheets.filter(t => t.status === "pending").length;
  const { items: actionItems } = useActionItems("builder", user.id);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 30, fontWeight: 700, color: "#f0f0f0" }}>Company Dashboard</div>
        <div style={{ fontSize: 14, color: "#555", marginTop: 4 }}>{new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
      </div>

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

// ── Labour / Timesheets tab ────────────────────────────────────────────────────
function LabourTab({ timesheets, onApprove, user }) {
  const pending = timesheets.filter(t => t.status === "pending");
  const approved = timesheets.filter(t => t.status === "approved");

  const approveAll = () => pending.forEach(ts => onApprove(ts.id));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 28, fontWeight: 700, color: "#f0f0f0" }}>LABOUR</div>
        {pending.length > 1 && (
          <button onClick={approveAll} style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#22c55e", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, cursor: "pointer" }}>
            APPROVE ALL ({pending.length})
          </button>
        )}
      </div>
      {pending.length === 0 && approved.length === 0
        ? <EmptyState icon="📋" title="No timesheets yet" subtitle="Timesheets appear here when workers clock in and out" />
        : null
      }
      {pending.length > 0 && (
        <>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, color: "#f59e0b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Pending ({pending.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
            {pending.map(ts => (
              <div key={ts.id} style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#222", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, color: "#888", flexShrink: 0 }}>
                  {(ts.worker?.full_name || "?").split(" ").map(n => n[0]).join("")}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#ccc" }}>{ts.worker?.full_name || "Unknown"}</div>
                  <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>
                    {ts.project?.street} · {new Date(ts.work_date).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}
                    {ts.clock_in && ` · In ${new Date(ts.clock_in).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true })}`}
                    {ts.clock_out && ` → Out ${new Date(ts.clock_out).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true })}`}
                  </div>
                </div>
                <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, color: "#e07b39", fontWeight: 700, flexShrink: 0 }}>
                  {ts.hours_worked ? `${ts.hours_worked}h` : "—"}
                </div>
                <button onClick={() => onApprove(ts.id)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#22c55e", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, cursor: "pointer", flexShrink: 0 }}>APPROVE</button>
              </div>
            ))}
          </div>
        </>
      )}
      {approved.length > 0 && (
        <>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, color: "#444", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Approved</div>
          {approved.map(ts => (
            <div key={ts.id} style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 8, padding: "10px 14px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: 0.65 }}>
              <div>
                <span style={{ fontSize: 13, color: "#888" }}>{ts.worker?.full_name}</span>
                <span style={{ fontSize: 12, color: "#444", marginLeft: 10 }}>{ts.project?.street} · {new Date(ts.work_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</span>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 16, color: "#555" }}>{ts.hours_worked ? `${ts.hours_worked}h` : "—"}</span>
                <span style={{ fontSize: 10, fontFamily: "Barlow Condensed, sans-serif", color: "#22c55e", background: "#06200e", padding: "2px 8px", borderRadius: 4 }}>APPROVED</span>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── Team management tab ────────────────────────────────────────────────────────
const ROLE_COLOR = { builder: "#e07b39", supervisor: "#f59e0b", worker: "#22c55e", subcontractor: "#3b82f6", client: "#a855f7", office: "#06b6d4" };

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
  const [filter, setFilter] = useState("all");   // all / internal / subs / clients
  const [detail, setDetail] = useState(null);     // profile shown in the detail screen

  const GROUP_OF = (role) => role === "subcontractor" ? "subs" : role === "client" ? "clients" : "internal";
  const FILTERS = [["all", "All"], ["internal", "Internal"], ["subs", "Subcontractors"], ["clients", "Clients"]];

  const saveName = async (id) => {
    setSaving(true);
    const name = nameDraft.trim() || null;
    await updateProfile(id, { full_name: name });
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, full_name: name } : p));
    setEditName(null);
    setSaving(false);
  };

  useEffect(() => {
    Promise.all([getProfiles(), getProjects(), getAllProjectMembers()]).then(([pr, pj, mb]) => {
      setProfiles(pr.data); setProjects(pj.data); setMembers(mb.data); setLoading(false);
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

// ── Builder shell ──────────────────────────────────────────────────────────────
export default function BuilderApp({ user }) {
  const [tab, setTab] = useState("dashboard");
  const [projectFilter, setProjectFilter] = useState(null);
  const [openProject, setOpenProject] = useState(null);
  const [initialScreen, setInitialScreen] = useState(null);
  const [projects, setProjects] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Open a project from a normal click (no deep-link) vs. from an action item.
  const openProjectClean = (p) => { setInitialScreen(null); setOpenProject(p); };
  const openAction = (item) => {
    const t = item.target;
    if (t.kind === "timesheet") { navigate("labour"); return; }
    const proj = projects.find(p => p.id === t.projectId);
    if (proj) { setInitialScreen(KIND_TO_PROJECT_SCREEN[t.kind] || null); setOpenProject(proj); }
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

  const handleApprove = async (id) => {
    await approveTimesheet(id, user.id);
    setTimesheets(prev => prev.map(t => t.id === id ? { ...t, status: "approved" } : t));
  };

  // Opening a project takes over the full screen with its Project Dashboard
  if (openProject) {
    return <ProjectDashboard project={openProject} user={user} initialScreen={initialScreen} onBack={() => setOpenProject(null)} />;
  }

  const renderTab = () => {
    if (loading) return <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{[1,2,3].map(i => <CardSkeleton key={i} />)}</div>;
    switch (tab) {
      case "dashboard":  return <DashboardTab projects={projects} timesheets={timesheets} onNavigate={navigate} onOpenProject={openProjectClean} user={user} onOpenAction={openAction} />;
      case "projects":   return <ProjectsTab projects={projects} initialFilter={projectFilter} onProjectCreated={p => setProjects(prev => [p, ...prev])} onOpenProject={openProjectClean} />;
      case "labour":     return <LabourTab timesheets={timesheets} onApprove={handleApprove} user={user} />;
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
