import { useState, useEffect, useRef } from "react";
import BackHeader from "../shared/BackHeader";
import { Skeleton, EmptyState } from "../shared/LoadingScreen";
import { getTasksByProject, updateTaskStatus, createTask, getProfiles } from "../../lib/db";
import { supabase } from "../../lib/supabase";
import { post } from "../../lib/webhook";
import PhotoAttach from "../shared/PhotoAttach";

const TODAY = new Date().toISOString().slice(0, 10);

const PRIORITY = {
  critical: { color: "#ef4444", bg: "#2a0c0c", label: "CRITICAL" },
  high:     { color: "#f97316", bg: "#251200", label: "HIGH" },
  medium:   { color: "#f59e0b", bg: "#251d00", label: "MEDIUM" },
  low:      { color: "#3b82f6", bg: "#0c1a33", label: "LOW" },
};

const STATUS = {
  todo:        { color: "#888",    label: "To Do" },
  in_progress: { color: "#f59e0b", label: "In Progress" },
  completed:   { color: "#22c55e", label: "Completed" },
  blocked:     { color: "#ef4444", label: "Blocked" },
};

function PriorityBadge({ priority }) {
  const p = PRIORITY[priority] || PRIORITY.medium;
  return <span style={{ fontSize: 10, fontFamily: "Barlow Condensed, sans-serif", letterSpacing: 0.5, textTransform: "uppercase", color: p.color, background: p.bg, padding: "2px 8px", borderRadius: 4 }}>{p.label}</span>;
}

function isOverdue(task) {
  return task.status !== "completed" && task.due_date && task.due_date < TODAY;
}
function isDueToday(task) {
  return task.status !== "completed" && task.due_date === TODAY;
}

function taskSection(tasks) {
  const overdue   = tasks.filter(isOverdue);
  const today     = tasks.filter(isDueToday);
  const upcoming  = tasks.filter(t => t.status !== "completed" && t.due_date > TODAY);
  const completed = tasks.filter(t => t.status === "completed");
  return { overdue, today, upcoming, completed };
}

// ── Task Row ───────────────────────────────────────────────────────────────────
function TaskRow({ task, onToggle, onSelect }) {
  const overdue = isOverdue(task);
  const p = PRIORITY[task.priority] || PRIORITY.medium;
  return (
    <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderLeft: `4px solid ${task.status === "completed" ? "#333" : p.color}`, borderRadius: 10, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
      <button onClick={() => onToggle(task)} style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0, border: `2px solid ${task.status === "completed" ? "#22c55e" : "#333"}`, background: task.status === "completed" ? "#22c55e" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {task.status === "completed" && <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>✓</span>}
      </button>
      <button onClick={() => onSelect(task)} style={{ flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
        <div style={{ fontSize: 14, color: task.status === "completed" ? "#555" : overdue ? "#ef4444" : "#ccc", textDecoration: task.status === "completed" ? "line-through" : "none" }}>{task.title}</div>
        <div style={{ fontSize: 11, color: "#555", marginTop: 3, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {task.assignee?.full_name && <span>{task.assignee.full_name}</span>}
          {task.due_date && <span style={{ color: overdue ? "#ef4444" : "#555" }}>{overdue ? "OVERDUE · " : ""}{new Date(task.due_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</span>}
        </div>
      </button>
      <PriorityBadge priority={task.priority} />
    </div>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────
function SectionHead({ label, color, count }) {
  if (!count) return null;
  return (
    <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 12, color, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, marginTop: 16, display: "flex", alignItems: "center", gap: 8 }}>
      {label}
      <span style={{ background: color + "22", color, borderRadius: 10, padding: "1px 8px", fontSize: 11 }}>{count}</span>
    </div>
  );
}

// ── Task Detail ────────────────────────────────────────────────────────────────
function TaskDetail({ task: initial, user, onBack }) {
  const [task, setTask] = useState(initial);
  const [comments, setComments] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState([]);
  const [reassigning, setReassigning] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from("task_comments").select("*, author:profiles(full_name)").eq("task_id", task.id).order("created_at"),
      getProfiles(),
    ]).then(([c, p]) => {
      setComments(c.data || []);
      setProfiles(p.data);
      setLoading(false);
    });
  }, [task.id]);

  const setStatus = async (status) => {
    await updateTaskStatus(task.id, status);
    setTask(t => ({ ...t, status }));
    post("/tasks/update", { id: task.id, status }).catch(() => {});
  };

  const addComment = async () => {
    if (!draft.trim()) return;
    const { data } = await supabase.from("task_comments").insert({ task_id: task.id, author_id: user.id, content: draft.trim() }).select("*, author:profiles(full_name)").single();
    if (data) setComments(c => [...c, data]);
    setDraft("");
  };

  const reassign = async (assigneeId) => {
    await supabase.from("tasks").update({ assignee_id: assigneeId }).eq("id", task.id);
    const worker = profiles.find(p => p.id === assigneeId);
    setTask(t => ({ ...t, assignee_id: assigneeId, assignee: worker }));
    setReassigning(false);
  };

  const p = PRIORITY[task.priority] || PRIORITY.medium;
  const s = STATUS[task.status] || STATUS.todo;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title={task.title} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {/* Status + priority */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {["todo","in_progress","completed","blocked"].map(st => (
            <button key={st} onClick={() => setStatus(st)} style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${task.status === st ? STATUS[st].color : "#2a2a2a"}`, background: task.status === st ? STATUS[st].color + "22" : "transparent", color: task.status === st ? STATUS[st].color : "#666", fontFamily: "Barlow Condensed, sans-serif", fontSize: 12, cursor: "pointer", textTransform: "capitalize" }}>
              {STATUS[st].label}
            </button>
          ))}
        </div>

        {/* Meta */}
        <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
          {[
            { l: "Priority", v: <PriorityBadge priority={task.priority} /> },
            { l: "Assigned To", v: <span style={{ color: "#ccc", fontSize: 14 }}>{task.assignee?.full_name || "Unassigned"}<button onClick={() => setReassigning(r => !r)} style={{ marginLeft: 10, background: "none", border: "none", color: "#e07b39", fontSize: 12, cursor: "pointer" }}>Change</button></span> },
            { l: "Due Date", v: <span style={{ color: isOverdue(task) ? "#ef4444" : "#ccc", fontSize: 14 }}>{task.due_date ? new Date(task.due_date).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "long" }) : "No date set"}{task.due_time ? ` · ${task.due_time.slice(0,5)}` : ""}</span> },
          ].map(row => (
            <div key={row.l} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1a1a1a" }}>
              <span style={{ fontSize: 12, color: "#555", fontFamily: "Barlow Condensed, sans-serif", textTransform: "uppercase", letterSpacing: 0.5 }}>{row.l}</span>
              {row.v}
            </div>
          ))}
        </div>

        {reassigning && (
          <div style={{ background: "#141414", border: "1px solid #2a2a2a", borderRadius: 10, padding: 12, marginBottom: 14 }}>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, color: "#555", textTransform: "uppercase", marginBottom: 8 }}>Reassign To</div>
            {profiles.map(p => (
              <button key={p.id} onClick={() => reassign(p.id)} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", background: "transparent", border: "none", color: "#ccc", fontSize: 14, cursor: "pointer", borderBottom: "1px solid #1a1a1a" }}>
                {p.full_name} <span style={{ color: "#555", fontSize: 12 }}>{p.role}</span>
              </button>
            ))}
          </div>
        )}

        {task.description && (
          <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 12, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Description</div>
            <div style={{ fontSize: 14, color: "#888", lineHeight: 1.6 }}>{task.description}</div>
          </div>
        )}

        {/* Photos */}
        <div style={{ marginBottom: 20 }}>
          <PhotoAttach project={{ id: task.project_id }} user={user} recordType="task" recordId={task.id} accent="#f59e0b" defaultCategory="progress" />
        </div>

        {/* Comments */}
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 12, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Comments</div>
        {loading ? null : comments.length === 0
          ? <div style={{ fontSize: 13, color: "#444", marginBottom: 14 }}>No comments yet</div>
          : comments.map(c => (
            <div key={c.id} style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "10px 14px", marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: "#e07b39" }}>{c.author?.full_name}</span>
                <span style={{ fontSize: 11, color: "#444" }}>{new Date(c.created_at).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true })}</span>
              </div>
              <div style={{ fontSize: 14, color: "#ccc" }}>{c.content}</div>
            </div>
          ))
        }

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && addComment()} placeholder="Add a comment..." style={{ flex: 1, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#f0f0f0", fontSize: 14, padding: "10px 12px", fontFamily: "DM Sans, sans-serif" }} />
          <button onClick={addComment} disabled={!draft.trim()} style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: draft.trim() ? "#e07b39" : "#1a1a1a", color: draft.trim() ? "#fff" : "#444", fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, cursor: draft.trim() ? "pointer" : "default" }}>ADD</button>
        </div>
      </div>
    </div>
  );
}

// ── Task List ──────────────────────────────────────────────────────────────────
function TaskList({ title, tasks, loading, user, onBack, onAddTask, workers, projectId }) {
  const [filter, setFilter] = useState("all");
  const [selectedTask, setSelectedTask] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", assignee_id: "", due_date: TODAY, due_time: "", priority: "medium", description: "" });
  const [allTasks, setAllTasks] = useState(tasks);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => { setAllTasks(tasks); }, [tasks]);

  if (selectedTask) return <TaskDetail task={selectedTask} user={user} onBack={() => setSelectedTask(null)} />;

  const toggle = async (task) => {
    const s = task.status === "completed" ? "todo" : "completed";
    setAllTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: s } : t));
    await updateTaskStatus(task.id, s);
    post("/tasks/complete", { id: task.id, status: s }).catch(() => {});
  };

  const saveTask = async () => {
    if (!form.title.trim()) { setSaveError("Enter a task title."); return; }
    setSaving(true);
    setSaveError(null);
    // UUID/date columns reject empty strings — coerce blanks to null
    const payload = {
      title: form.title.trim(),
      project_id: projectId,
      created_by: user.id,
      assignee_id: form.assignee_id || null,
      due_date: form.due_date || null,
      due_time: form.due_time || null,
      priority: form.priority,
      description: form.description?.trim() || null,
    };
    const { data, error } = await createTask(payload);
    setSaving(false);
    if (error) { setSaveError(error.message); return; }
    const created = { ...data, assignee: workers.find(w => w.id === data.assignee_id) || null };
    setAllTasks(prev => [created, ...prev]);
    setShowForm(false);
    setForm({ title: "", assignee_id: "", due_date: TODAY, due_time: "", priority: "medium", description: "" });
    // Open the new task so photos / PDFs / drawings can be attached straight away (H11)
    setSelectedTask(created);
  };

  const filtered = filter === "all" ? allTasks.filter(t => t.status !== "completed")
    : filter === "overdue" ? allTasks.filter(isOverdue)
    : filter === "today"   ? allTasks.filter(isDueToday)
    : filter === "completed" ? allTasks.filter(t => t.status === "completed")
    : allTasks;

  const { overdue, today, upcoming, completed } = taskSection(filtered);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title={title} onBack={onBack} rightSlot={
        <button onClick={() => setShowForm(s => !s)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: showForm ? "#333" : "#f59e0b", color: showForm ? "#888" : "#0c0c0c", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer" }}>
          {showForm ? "CANCEL" : "+ ADD"}
        </button>
      } />
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
        {showForm && (
          <div style={{ background: "#141414", border: "1px solid #2a2a2a", borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Task title" style={inp} />
            <div style={{ margin: "10px 0" }}>
              <div style={lbl}>Assignee</div>
              <select value={form.assignee_id} onChange={e => setForm(f => ({ ...f, assignee_id: e.target.value }))} style={inp}>
                <option value="">Unassigned</option>
                {workers.map(w => <option key={w.id} value={w.id}>{w.full_name}</option>)}
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
              <div>
                <div style={lbl}>Due Date</div>
                <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} style={inp} />
              </div>
              <div>
                <div style={lbl}>Due Time</div>
                <input type="time" value={form.due_time} onChange={e => setForm(f => ({ ...f, due_time: e.target.value }))} style={inp} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {Object.entries(PRIORITY).map(([k, v]) => (
                <button key={k} onClick={() => setForm(f => ({ ...f, priority: k }))} style={{ flex: 1, padding: "7px 4px", borderRadius: 6, border: `1px solid ${form.priority === k ? v.color : "#2a2a2a"}`, background: form.priority === k ? v.bg : "transparent", color: form.priority === k ? v.color : "#666", fontFamily: "Barlow Condensed, sans-serif", fontSize: 11, cursor: "pointer", textTransform: "uppercase" }}>{v.label}</button>
              ))}
            </div>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" rows={2} style={{ ...inp, resize: "vertical", marginBottom: 10 }} />
            {saveError && <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 10 }}>{saveError}</div>}
            <button onClick={saveTask} disabled={saving} style={{ width: "100%", padding: "11px", borderRadius: 8, border: "none", background: saving ? "#555" : "#f59e0b", color: "#0c0c0c", fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, cursor: saving ? "not-allowed" : "pointer" }}>{saving ? "CREATING..." : "CREATE TASK"}</button>
          </div>
        )}

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {[["all","All"],["overdue","Overdue"],["today","Today"],["upcoming","Upcoming"],["completed","Done"]].map(([f, l]) => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: "5px 12px", borderRadius: 16, border: `1px solid ${filter === f ? "#e07b39" : "#2a2a2a"}`, background: filter === f ? "#2a1800" : "transparent", color: filter === f ? "#e07b39" : "#666", fontFamily: "Barlow Condensed, sans-serif", fontSize: 12, cursor: "pointer" }}>{l}</button>
          ))}
        </div>

        {loading ? [1,2,3].map(i => <div key={i} style={{ height: 68, background: "#141414", borderRadius: 10, marginBottom: 8 }} />) : (
          <>
            <SectionHead label="Overdue"  color="#ef4444" count={overdue.length} />
            {overdue.map(t => <TaskRow key={t.id} task={t} onToggle={toggle} onSelect={setSelectedTask} />)}
            <SectionHead label="Due Today" color="#f97316" count={today.length} />
            {today.map(t => <TaskRow key={t.id} task={t} onToggle={toggle} onSelect={setSelectedTask} />)}
            <SectionHead label="Upcoming"  color="#888"    count={upcoming.length} />
            {upcoming.map(t => <TaskRow key={t.id} task={t} onToggle={toggle} onSelect={setSelectedTask} />)}
            <SectionHead label="Completed" color="#22c55e" count={completed.length} />
            {completed.map(t => <TaskRow key={t.id} task={t} onToggle={toggle} onSelect={setSelectedTask} />)}
            {filtered.length === 0 && <EmptyState icon="✅" title="No tasks here" subtitle="All clear" />}
          </>
        )}
      </div>
    </div>
  );
}

// ── Tasks Landing (3 tiles) ────────────────────────────────────────────────────
function LandingTile({ title, subtitle, badge, badgeColor, badge2, badge2Color, icon, accent, bg, onClick }) {
  return (
    <button onClick={onClick} style={{ width: "100%", background: bg, border: `1px solid ${accent}33`, borderRadius: 14, padding: "18px 20px", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 16, position: "relative", marginBottom: 12, WebkitTapHighlightColor: "transparent" }}>
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

export default function TasksFeature({ project, user, onBack, focusId }) {
  const [tasks, setTasks] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("landing"); // landing | mine | project | others
  const [focusTask, setFocusTask] = useState(null); // deep-linked task (opens detail directly)

  useEffect(() => {
    Promise.all([getTasksByProject(project.id), getProfiles()]).then(([t, p]) => {
      setTasks(t.data);
      setWorkers(p.data);
      setLoading(false);
    });
  }, [project.id]);

  // Deep-link: open the targeted task's detail once it's loaded (one-shot per focusId).
  const focusedRef = useRef(null);
  useEffect(() => {
    if (!focusId || focusedRef.current === focusId) return;
    const t = tasks.find(x => x.id === focusId);
    if (t) { setFocusTask(t); focusedRef.current = focusId; }
  }, [focusId, tasks]);

  const myTasks      = tasks.filter(t => t.assignee_id === user.id);
  const projectTasks = tasks;
  const otherTasks   = tasks.filter(t => t.assignee_id && t.assignee_id !== user.id);

  const overdueCount = (list) => list.filter(isOverdue).length;
  const todayCount   = (list) => list.filter(isDueToday).length;

  if (focusTask)          return <TaskDetail task={focusTask} user={user} onBack={() => setFocusTask(null)} />;
  if (view === "mine")    return <TaskList title="My Tasks"      tasks={myTasks}      loading={loading} user={user} onBack={() => setView("landing")} workers={workers} projectId={project.id} />;
  if (view === "project") return <TaskList title="Project Tasks" tasks={projectTasks} loading={loading} user={user} onBack={() => setView("landing")} workers={workers} projectId={project.id} />;
  if (view === "others")  return <OthersTasksList tasks={otherTasks} workers={workers} user={user} onBack={() => setView("landing")} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Tasks" subtitle={project.street} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        <LandingTile title="My Tasks" subtitle="Tasks assigned to or raised by you" icon="✅" accent="#f59e0b" bg="#251d00"
          badge={overdueCount(myTasks)} badgeColor="#ef4444"
          badge2={todayCount(myTasks)} badge2Color="#f97316"
          onClick={() => setView("mine")} />
        <LandingTile title="Project Tasks" subtitle={`All tasks on ${project.street}`} icon="🏗" accent="#e07b39" bg="#2a1800"
          badge={overdueCount(projectTasks)} badgeColor="#ef4444"
          badge2={todayCount(projectTasks)} badge2Color="#f97316"
          onClick={() => setView("project")} />
        <LandingTile title="Team Tasks" subtitle="Tasks assigned to the rest of the team" icon="👷" accent="#3b82f6" bg="#0c1a33"
          badge={overdueCount(otherTasks)} badgeColor="#ef4444"
          badge2={todayCount(otherTasks)} badge2Color="#f97316"
          onClick={() => setView("others")} />
      </div>
    </div>
  );
}

function OthersTasksList({ tasks, workers, user, onBack }) {
  const [selectedTask, setSelectedTask] = useState(null);

  if (selectedTask) return <TaskDetail task={selectedTask} user={user} onBack={() => setSelectedTask(null)} />;

  const byWorker = workers
    .filter(w => w.id !== user.id)
    .map(w => ({ worker: w, tasks: tasks.filter(t => t.assignee_id === w.id) }))
    .filter(g => g.tasks.length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Team Tasks" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
        {byWorker.length === 0
          ? <EmptyState icon="👷" title="No tasks assigned to others" />
          : byWorker.map(({ worker, tasks: wTasks }) => (
            <div key={worker.id} style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#2a2a2a", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, color: "#888" }}>
                  {worker.full_name?.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <div style={{ fontSize: 15, color: "#ccc", fontWeight: 600 }}>{worker.full_name}</div>
                  <div style={{ fontSize: 11, color: "#555" }}>{wTasks.filter(isOverdue).length > 0 && <span style={{ color: "#ef4444" }}>{wTasks.filter(isOverdue).length} overdue · </span>}{wTasks.length} tasks</div>
                </div>
              </div>
              {wTasks.map(t => <TaskRow key={t.id} task={t} onToggle={() => {}} onSelect={setSelectedTask} />)}
            </div>
          ))
        }
      </div>
    </div>
  );
}

const inp = { width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#f0f0f0", fontSize: 14, padding: "10px 12px", fontFamily: "DM Sans, sans-serif", boxSizing: "border-box" };
const lbl = { fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Barlow Condensed, sans-serif", marginBottom: 5 };
