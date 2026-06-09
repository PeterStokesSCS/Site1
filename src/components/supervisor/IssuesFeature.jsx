import { useState, useEffect, useRef } from "react";
import BackHeader from "../shared/BackHeader";
import { EmptyState } from "../shared/LoadingScreen";
import { getIssues, createIssue, createHazard, getProfiles } from "../../lib/db";
import { supabase } from "../../lib/supabase";
import { post } from "../../lib/webhook";
import { ISSUE_CATEGORIES } from "../../data/mockData";
import PhotoAttach from "../shared/PhotoAttach";

const PRIORITY = {
  critical: { color: "#ef4444", bg: "#2a0c0c", label: "CRITICAL" },
  high:     { color: "#f97316", bg: "#251200", label: "HIGH" },
  medium:   { color: "#f59e0b", bg: "#251d00", label: "MEDIUM" },
  low:      { color: "#3b82f6", bg: "#0c1a33", label: "LOW" },
};

const HAZARD_CATEGORIES = ["Falls","Equipment","Manual Handling","Dust/Hazardous Substances","Electrical","Excavation","Other"];

function PriorityBadge({ priority }) {
  const p = PRIORITY[priority] || PRIORITY.medium;
  return <span style={{ fontSize: 10, fontFamily: "Barlow Condensed, sans-serif", letterSpacing: 0.5, textTransform: "uppercase", color: p.color, background: p.bg, padding: "2px 8px", borderRadius: 4 }}>{p.label}</span>;
}

// ── Issue Detail ───────────────────────────────────────────────────────────────
function IssueDetail({ issue: initial, user, onBack }) {
  const [issue, setIssue] = useState(initial);
  const [comments, setComments] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("issue_comments").select("*, author:profiles(full_name)").eq("issue_id", issue.id).order("created_at")
      .then(({ data }) => { setComments(data || []); setLoading(false); });
  }, [issue.id]);

  const resolve = async () => {
    await supabase.from("issues").update({ status: "resolved" }).eq("id", issue.id);
    setIssue(i => ({ ...i, status: "resolved" }));
    if (issue.hazard_id) {
      const confirm = window.confirm("This issue has a linked hazard. Mark it resolved too?");
      if (confirm) await supabase.from("hazards").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", issue.hazard_id);
    }
    post("/issues/resolve", { id: issue.id }).catch(() => {});
  };

  const escalate = async () => {
    const levels = ["low","medium","high","critical"];
    const next = levels[Math.min(levels.indexOf(issue.priority) + 1, levels.length - 1)];
    await supabase.from("issues").update({ priority: next }).eq("id", issue.id);
    setIssue(i => ({ ...i, priority: next }));
    post("/issues/escalate", { id: issue.id, priority: next }).catch(() => {});
  };

  const addComment = async () => {
    if (!draft.trim()) return;
    const { data } = await supabase.from("issue_comments").insert({ issue_id: issue.id, author_id: user.id, content: draft.trim() }).select("*, author:profiles(full_name)").single();
    if (data) setComments(c => [...c, data]);
    setDraft("");
  };

  const p = PRIORITY[issue.priority] || PRIORITY.medium;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title={issue.title} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {/* Priority + status */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <PriorityBadge priority={issue.priority} />
          <span style={{ fontSize: 10, fontFamily: "Barlow Condensed, sans-serif", color: issue.status === "resolved" ? "#22c55e" : "#f59e0b", background: issue.status === "resolved" ? "#06200e" : "#251d00", padding: "2px 8px", borderRadius: 4, textTransform: "uppercase" }}>{issue.status}</span>
          {issue.is_safety && <span style={{ fontSize: 10, fontFamily: "Barlow Condensed, sans-serif", color: "#ef4444", background: "#2a0c0c", padding: "2px 8px", borderRadius: 4 }}>🔗 SAFETY</span>}
        </div>

        {/* Meta */}
        <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
          {[
            { l: "Category", v: issue.category || "—" },
            { l: "Raised", v: new Date(issue.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) },
          ].map(row => (
            <div key={row.l} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1a1a1a" }}>
              <span style={{ fontSize: 12, color: "#555", fontFamily: "Barlow Condensed, sans-serif", textTransform: "uppercase", letterSpacing: 0.5 }}>{row.l}</span>
              <span style={{ fontSize: 14, color: "#ccc" }}>{row.v}</span>
            </div>
          ))}
          {issue.hazard_id && (
            <div style={{ padding: "10px 0 2px" }}>
              <div style={{ fontSize: 12, color: "#ef4444" }}>🔗 Linked to hazard record</div>
            </div>
          )}
        </div>

        {issue.description && (
          <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 12, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Description</div>
            <div style={{ fontSize: 14, color: "#888", lineHeight: 1.6 }}>{issue.description}</div>
          </div>
        )}

        {/* Actions */}
        {issue.status !== "resolved" && (
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <button onClick={resolve} style={{ flex: 2, padding: "12px", borderRadius: 10, border: "none", background: "#22c55e", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, cursor: "pointer" }}>✓ MARK RESOLVED</button>
            {issue.priority !== "critical" && (
              <button onClick={escalate} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1px solid #ef4444", background: "transparent", color: "#ef4444", fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, cursor: "pointer" }}>ESCALATE</button>
            )}
          </div>
        )}

        {/* Photos */}
        <div style={{ marginBottom: 20 }}>
          <PhotoAttach project={{ id: issue.project_id }} user={user} recordType="issue" recordId={issue.id} accent="#f97316" defaultCategory={issue.is_safety ? "safety" : "general"} />
        </div>

        {/* Comments */}
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 12, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Comments</div>
        {!loading && comments.map(c => (
          <div key={c.id} style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "10px 14px", marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: "#e07b39" }}>{c.author?.full_name}</span>
              <span style={{ fontSize: 11, color: "#444" }}>{new Date(c.created_at).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true })}</span>
            </div>
            <div style={{ fontSize: 14, color: "#ccc" }}>{c.content}</div>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && addComment()} placeholder="Add a comment..." style={{ flex: 1, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#f0f0f0", fontSize: 14, padding: "10px 12px", fontFamily: "DM Sans, sans-serif" }} />
          <button onClick={addComment} disabled={!draft.trim()} style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: draft.trim() ? "#e07b39" : "#1a1a1a", color: draft.trim() ? "#fff" : "#444", fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, cursor: draft.trim() ? "pointer" : "default" }}>ADD</button>
        </div>
      </div>
    </div>
  );
}

// ── New Issue Form ─────────────────────────────────────────────────────────────
function NewIssueForm({ onSave, onCancel, projectId, userId }) {
  const [form, setForm] = useState({ title: "", category: "Other", priority: "medium", description: "", is_safety: false });
  const [safetyForm, setSafetyForm] = useState({ risk: "medium", category: "Other" });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const { data: issue } = await createIssue({ ...form, project_id: projectId, raised_by: userId, status: "open" });
    if (issue && form.is_safety) {
      const { data: hazard } = await createHazard({
        project_id: projectId,
        title: form.title,
        risk: safetyForm.risk,
        category: safetyForm.category,
        control_measures: form.description,
        reported_by: userId,
        status: "open",
        issue_id: issue.id,
      });
      if (hazard) {
        await supabase.from("issues").update({ hazard_id: hazard.id }).eq("id", issue.id);
        issue.hazard_id = hazard.id;
      }
      if (form.priority === "critical" || form.priority === "high") {
        post("/issues/safety-critical", { issue, hazard }).catch(() => {});
      }
    }
    post("/issues/create", issue).catch(() => {});
    onSave(issue);
    setSaving(false);
  };

  return (
    <div style={{ background: "#141414", border: "1px solid #2a2a2a", borderRadius: 14, padding: 16, marginBottom: 16 }}>
      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 16, color: "#f97316", marginBottom: 14 }}>NEW ISSUE</div>
      <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Issue title" style={{ ...inp, marginBottom: 10 }} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {ISSUE_CATEGORIES.map(c => (
          <button key={c} onClick={() => setForm(f => ({ ...f, category: c }))} style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${form.category === c ? "#f97316" : "#2a2a2a"}`, background: form.category === c ? "#251200" : "transparent", color: form.category === c ? "#f97316" : "#666", fontSize: 12, cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif" }}>{c}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {Object.entries(PRIORITY).map(([k, v]) => (
          <button key={k} onClick={() => setForm(f => ({ ...f, priority: k }))} style={{ flex: 1, padding: "8px 4px", borderRadius: 6, border: `1px solid ${form.priority === k ? v.color : "#2a2a2a"}`, background: form.priority === k ? v.bg : "transparent", color: form.priority === k ? v.color : "#666", fontFamily: "Barlow Condensed, sans-serif", fontSize: 11, cursor: "pointer", textTransform: "uppercase" }}>{v.label}</button>
        ))}
      </div>
      <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Details..." rows={2} style={{ ...inp, resize: "vertical", marginBottom: 12 }} />

      {/* Safety link */}
      <button onClick={() => setForm(f => ({ ...f, is_safety: !f.is_safety }))} style={{
        width: "100%", padding: "12px 14px", borderRadius: 10, marginBottom: form.is_safety ? 12 : 14,
        border: `1px solid ${form.is_safety ? "#ef4444" : "#2a2a2a"}`,
        background: form.is_safety ? "#2a0c0c" : "#1a1a1a",
        color: form.is_safety ? "#ef4444" : "#888",
        fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span>Is this safety related?</span>
        <span style={{ fontWeight: 700 }}>{form.is_safety ? "YES — will create hazard record" : "NO"}</span>
      </button>

      {form.is_safety && (
        <div style={{ background: "#2a0c0c", border: "1px solid #ef444444", borderRadius: 10, padding: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "#ef4444", fontFamily: "Barlow Condensed, sans-serif", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Hazard Record — will be auto-created</div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>Risk Level</div>
            <div style={{ display: "flex", gap: 6 }}>
              {[["high","HIGH","#ef4444","#2a0c0c"],["medium","MED","#f59e0b","#251d00"],["low","LOW","#3b82f6","#0c1a33"]].map(([k,l,c,b]) => (
                <button key={k} onClick={() => setSafetyForm(f => ({ ...f, risk: k }))} style={{ flex: 1, padding: "7px 4px", borderRadius: 6, border: `1px solid ${safetyForm.risk === k ? c : "#333"}`, background: safetyForm.risk === k ? b : "transparent", color: safetyForm.risk === k ? c : "#666", fontFamily: "Barlow Condensed, sans-serif", fontSize: 12, cursor: "pointer" }}>{l}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {HAZARD_CATEGORIES.map(c => (
              <button key={c} onClick={() => setSafetyForm(f => ({ ...f, category: c }))} style={{ padding: "4px 8px", borderRadius: 5, border: `1px solid ${safetyForm.category === c ? "#ef4444" : "#333"}`, background: safetyForm.category === c ? "#2a0c0c" : "transparent", color: safetyForm.category === c ? "#ef4444" : "#666", fontSize: 11, cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif" }}>{c}</button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: "11px", borderRadius: 8, border: "1px solid #333", background: "transparent", color: "#888", cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif", fontSize: 14 }}>CANCEL</button>
        <button onClick={save} disabled={saving || !form.title.trim()} style={{ flex: 2, padding: "11px", borderRadius: 8, border: "none", background: form.title.trim() ? "#f97316" : "#222", color: form.title.trim() ? "#fff" : "#555", fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, cursor: form.title.trim() ? "pointer" : "not-allowed" }}>
          {saving ? "SAVING..." : form.is_safety ? "RAISE ISSUE + HAZARD" : "RAISE ISSUE"}
        </button>
      </div>
    </div>
  );
}

// ── Issue Row ──────────────────────────────────────────────────────────────────
function IssueRow({ issue, onSelect }) {
  const p = PRIORITY[issue.priority] || PRIORITY.medium;
  const age = Math.floor((Date.now() - new Date(issue.created_at)) / 3600000);
  return (
    <button onClick={() => onSelect(issue)} style={{ width: "100%", textAlign: "left", background: "#141414", border: "1px solid #1e1e1e", borderLeft: `4px solid ${issue.status === "resolved" ? "#333" : p.color}`, borderRadius: 10, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: issue.status === "resolved" ? "#555" : "#ccc" }}>
          {issue.is_safety && <span style={{ color: "#ef4444", marginRight: 6 }}>🔗</span>}
          {issue.title}
        </div>
        <div style={{ fontSize: 11, color: "#555", marginTop: 3, display: "flex", gap: 8 }}>
          <span>{issue.category}</span>
          <span>{age < 1 ? "Just now" : age < 24 ? `${age}h ago` : `${Math.floor(age/24)}d ago`}</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
        <PriorityBadge priority={issue.priority} />
        {issue.status === "resolved" && <span style={{ fontSize: 10, fontFamily: "Barlow Condensed, sans-serif", color: "#22c55e" }}>RESOLVED</span>}
      </div>
    </button>
  );
}

// ── Issue List ─────────────────────────────────────────────────────────────────
function IssueList({ title, issues, user, onBack, projectId, onIssueCreated, initialShowForm }) {
  const [filter, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(!!initialShowForm);
  const [allIssues, setAllIssues] = useState(issues);
  const [selectedIssue, setSelectedIssue] = useState(null);

  useEffect(() => { setAllIssues(issues); }, [issues]);

  if (selectedIssue) return <IssueDetail issue={selectedIssue} user={user} onBack={() => setSelectedIssue(null)} />;

  const filtered = allIssues.filter(i => {
    if (filter === "all")      return i.status !== "resolved";
    if (filter === "critical") return i.priority === "critical" && i.status !== "resolved";
    if (filter === "safety")   return i.is_safety;
    if (filter === "resolved") return i.status === "resolved";
    return true;
  });

  const sections = {
    critical: filtered.filter(i => i.priority === "critical" && i.status !== "resolved"),
    high:     filtered.filter(i => i.priority === "high"     && i.status !== "resolved"),
    medium:   filtered.filter(i => i.priority === "medium"   && i.status !== "resolved"),
    low:      filtered.filter(i => i.priority === "low"      && i.status !== "resolved"),
    resolved: filtered.filter(i => i.status === "resolved"),
  };

  const SH = ({ label, color, count }) => count > 0 ? <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 12, color, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginTop: 14, display: "flex", gap: 8 }}>{label} <span style={{ background: color + "22", color, borderRadius: 10, padding: "1px 8px", fontSize: 11 }}>{count}</span></div> : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title={title} onBack={onBack} rightSlot={
        <button onClick={() => setShowForm(s => !s)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: showForm ? "#333" : "#f97316", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer" }}>
          {showForm ? "CANCEL" : "+ RAISE"}
        </button>
      } />
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
        {showForm && (
          <NewIssueForm
            projectId={projectId}
            userId={user.id}
            onSave={issue => { setAllIssues(prev => [issue, ...prev]); setShowForm(false); onIssueCreated?.(); }}
            onCancel={() => setShowForm(false)}
          />
        )}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {[["all","All"],["critical","Critical"],["safety","Safety"],["resolved","Resolved"]].map(([f, l]) => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: "5px 12px", borderRadius: 16, border: `1px solid ${filter === f ? "#e07b39" : "#2a2a2a"}`, background: filter === f ? "#2a1800" : "transparent", color: filter === f ? "#e07b39" : "#666", fontFamily: "Barlow Condensed, sans-serif", fontSize: 12, cursor: "pointer" }}>{l}</button>
          ))}
        </div>
        {filtered.length === 0 ? <EmptyState icon="⚡" title="No issues here" subtitle="All clear" /> : (
          <>
            <SH label="Critical" color="#ef4444" count={sections.critical.length} />
            {sections.critical.map(i => <IssueRow key={i.id} issue={i} onSelect={setSelectedIssue} />)}
            <SH label="High" color="#f97316" count={sections.high.length} />
            {sections.high.map(i => <IssueRow key={i.id} issue={i} onSelect={setSelectedIssue} />)}
            <SH label="Medium" color="#f59e0b" count={sections.medium.length} />
            {sections.medium.map(i => <IssueRow key={i.id} issue={i} onSelect={setSelectedIssue} />)}
            <SH label="Low" color="#3b82f6" count={sections.low.length} />
            {sections.low.map(i => <IssueRow key={i.id} issue={i} onSelect={setSelectedIssue} />)}
            <SH label="Resolved" color="#22c55e" count={sections.resolved.length} />
            {sections.resolved.map(i => <IssueRow key={i.id} issue={i} onSelect={setSelectedIssue} />)}
          </>
        )}
      </div>
    </div>
  );
}

// ── Landing tile ───────────────────────────────────────────────────────────────
function LandingTile({ title, subtitle, icon, accent, bg, badge, badgeColor, badge2, badge2Color, onClick }) {
  return (
    <button onClick={onClick} style={{ width: "100%", background: bg, border: `1px solid ${accent}33`, borderRadius: 14, padding: "18px 20px", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 16, marginBottom: 12, WebkitTapHighlightColor: "transparent" }}>
      <span style={{ fontSize: 36 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 20, fontWeight: 700, color: "#f0f0f0", textTransform: "uppercase" }}>{title}</div>
        <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>{subtitle}</div>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
        {badge > 0 && <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, fontWeight: 700, color: badgeColor }}>{badge}</span>}
        {badge2 > 0 && <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, fontWeight: 700, color: badge2Color }}>{badge2}</span>}
        <span style={{ color: "#444", fontSize: 20 }}>›</span>
      </div>
    </button>
  );
}

// ── Issues Feature ─────────────────────────────────────────────────────────────
export default function IssuesFeature({ project, user, onBack, focusId }) {
  const [issues, setIssues] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("landing");
  const [focusIssue, setFocusIssue] = useState(null); // deep-linked issue (opens detail directly)
  const [autoNew, setAutoNew] = useState(false);      // FAB "new" → open the create form

  useEffect(() => {
    Promise.all([getIssues(project.id), getProfiles()]).then(([i, p]) => {
      setIssues(i.data);
      setWorkers(p.data);
      setLoading(false);
    });
  }, [project.id]);

  // Deep-link: open the targeted issue's detail once loaded (one-shot per focusId).
  const focusedRef = useRef(null);
  useEffect(() => {
    if (!focusId || focusedRef.current === focusId) return;
    if (focusId === "new") { focusedRef.current = focusId; setAutoNew(true); setView("project"); return; }
    const i = issues.find(x => x.id === focusId);
    if (i) { setFocusIssue(i); focusedRef.current = focusId; }
  }, [focusId, issues]);

  const reload = () => getIssues(project.id).then(({ data }) => setIssues(data));

  const myIssues      = issues.filter(i => i.raised_by === user.id);
  const projectIssues = issues;
  const othersIssues  = issues.filter(i => i.raised_by !== user.id);

  const criticalCount = (list) => list.filter(i => (i.priority === "critical" || i.priority === "high") && i.status !== "resolved").length;
  const medCount      = (list) => list.filter(i => i.priority === "medium" && i.status !== "resolved").length;

  if (focusIssue)         return <IssueDetail issue={focusIssue} user={user} onBack={() => setFocusIssue(null)} />;
  if (view === "mine")    return <IssueList title="My Issues"      issues={myIssues}      user={user} onBack={() => setView("landing")} projectId={project.id} onIssueCreated={reload} />;
  if (view === "project") return <IssueList title="Project Issues" issues={projectIssues} user={user} onBack={() => { setView("landing"); setAutoNew(false); }} projectId={project.id} onIssueCreated={reload} initialShowForm={autoNew} />;
  if (view === "others")  return <OthersIssuesList issues={othersIssues} workers={workers} user={user} onBack={() => setView("landing")} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Issues" subtitle={project.street} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        <LandingTile title="My Issues" subtitle="Issues you raised or are assigned to" icon="⚡" accent="#f97316" bg="#251200"
          badge={criticalCount(myIssues)} badgeColor="#ef4444"
          badge2={medCount(myIssues)} badge2Color="#f59e0b"
          onClick={() => setView("mine")} />
        <LandingTile title="Project Issues" subtitle={`All issues on ${project.street}`} icon="🏗" accent="#e07b39" bg="#2a1800"
          badge={criticalCount(projectIssues)} badgeColor="#ef4444"
          badge2={medCount(projectIssues)} badge2Color="#f59e0b"
          onClick={() => setView("project")} />
        <LandingTile title="Others' Issues" subtitle="Issues assigned to the rest of the team" icon="👷" accent="#3b82f6" bg="#0c1a33"
          badge={criticalCount(othersIssues)} badgeColor="#ef4444"
          badge2={medCount(othersIssues)} badge2Color="#f59e0b"
          onClick={() => setView("others")} />
      </div>
    </div>
  );
}

function OthersIssuesList({ issues, workers, user, onBack }) {
  const [selectedIssue, setSelectedIssue] = useState(null);
  if (selectedIssue) return <IssueDetail issue={selectedIssue} user={user} onBack={() => setSelectedIssue(null)} />;

  const byWorker = workers
    .filter(w => w.id !== user.id)
    .map(w => ({ worker: w, issues: issues.filter(i => i.raised_by === w.id) }))
    .filter(g => g.issues.length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Others' Issues" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
        {byWorker.length === 0
          ? <EmptyState icon="⚡" title="No issues raised by others" />
          : byWorker.map(({ worker, issues: wIssues }) => (
            <div key={worker.id} style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#2a2a2a", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, color: "#888" }}>
                  {worker.full_name?.split(" ").map(n => n[0]).join("").slice(0,2)}
                </div>
                <div>
                  <div style={{ fontSize: 15, color: "#ccc", fontWeight: 600 }}>{worker.full_name}</div>
                  <div style={{ fontSize: 11, color: "#555" }}>{wIssues.filter(i => i.status !== "resolved").length} open issues</div>
                </div>
              </div>
              {wIssues.map(i => <IssueRow key={i.id} issue={i} onSelect={setSelectedIssue} />)}
            </div>
          ))
        }
      </div>
    </div>
  );
}

const inp = { width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#f0f0f0", fontSize: 14, padding: "10px 12px", fontFamily: "DM Sans, sans-serif", boxSizing: "border-box" };
