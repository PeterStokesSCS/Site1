import { useState } from "react";
import { mockProjects, mockTasks, mockWorkers } from "../../data/mockData";
import { post } from "../../lib/webhook";

const PRIORITY_COLOR = { high: "#c0392b", medium: "#e07b39", low: "#27ae60" };
const PRIORITY_BG = { high: "#2a1010", medium: "#2a1800", low: "#0f2a0f" };
const STATUS_COLOR = { active: "#27ae60", planning: "#3498db", completed: "#666" };
const STATUS_BG = { active: "#0f2a0f", planning: "#0a1a2a", completed: "#1a1a1a" };

function Badge({ value, color, bg }) {
  return (
    <span style={{
      fontSize: 11, fontFamily: "Barlow Condensed, sans-serif", letterSpacing: 0.5,
      textTransform: "uppercase", color, background: bg,
      padding: "3px 8px", borderRadius: 4, whiteSpace: "nowrap",
    }}>
      {value}
    </span>
  );
}

function BudgetBar({ project }) {
  const pct = Math.min(Math.round((project.spent / project.budget) * 100), 100);
  const over = pct > 90;
  const warn = pct > 70;
  const color = over ? "#c0392b" : warn ? "#e07b39" : "#27ae60";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: "#666" }}>${project.spent.toLocaleString()} spent</span>
        <span style={{ fontSize: 12, color: over ? "#c0392b" : "#666" }}>{pct}% of ${project.budget.toLocaleString()}</span>
      </div>
      <div style={{ height: 5, background: "#222", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3 }} />
      </div>
      {over && <div style={{ fontSize: 11, color: "#c0392b", marginTop: 3 }}>⚠ Overspend warning</div>}
    </div>
  );
}

// ── Task row ──────────────────────────────────────────────────────────────────
function TaskRow({ task, workers, onToggle }) {
  const worker = workers.find(w => w.id === task.assignee);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "9px 14px", borderBottom: "1px solid #1a1a1a",
    }}>
      <button
        onClick={() => onToggle(task.id)}
        style={{
          width: 20, height: 20, borderRadius: 4, flexShrink: 0,
          border: `2px solid ${task.done ? "#27ae60" : "#333"}`,
          background: task.done ? "#27ae60" : "transparent",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {task.done && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✓</span>}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: task.done ? "#555" : "#ccc", textDecoration: task.done ? "line-through" : "none" }}>{task.title}</div>
        <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
          {worker?.name || "Unassigned"} · Due {new Date(task.dueDate).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
        </div>
      </div>
      <Badge value={task.priority} color={PRIORITY_COLOR[task.priority]} bg={PRIORITY_BG[task.priority]} />
    </div>
  );
}

// ── Task Modal ────────────────────────────────────────────────────────────────
function TaskModal({ initial, projects, workers, onSave, onClose }) {
  const [form, setForm] = useState(initial || {
    title: "", projectId: projects[0]?.id || "", assignee: workers[0]?.id || "",
    dueDate: new Date().toISOString().slice(0, 10), priority: "medium",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.title.trim().length >= 2;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#161616", border: "1px solid #2a2a2a", borderRadius: 14, width: "100%", maxWidth: 460, padding: 24 }}>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 20, fontWeight: 700, color: "#f0f0f0", marginBottom: 20 }}>
          {initial ? "EDIT TASK" : "NEW TASK"}
        </div>

        <div style={field}>
          <label style={lbl}>Title</label>
          <input value={form.title} onChange={e => set("title", e.target.value)} placeholder="Task description" style={inp} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={field}>
            <label style={lbl}>Project</label>
            <select value={form.projectId} onChange={e => set("projectId", e.target.value)} style={inp}>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={field}>
            <label style={lbl}>Assignee</label>
            <select value={form.assignee} onChange={e => set("assignee", e.target.value)} style={inp}>
              {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div style={field}>
            <label style={lbl}>Due Date</label>
            <input type="date" value={form.dueDate} onChange={e => set("dueDate", e.target.value)} style={inp} />
          </div>
          <div style={field}>
            <label style={lbl}>Priority</label>
            <select value={form.priority} onChange={e => set("priority", e.target.value)} style={inp}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "12px", borderRadius: 8, border: "1px solid #333", background: "transparent", color: "#888", cursor: "pointer", fontSize: 14 }}>
            Cancel
          </button>
          <button
            onClick={() => valid && onSave(form)}
            disabled={!valid}
            style={{ flex: 2, padding: "12px", borderRadius: 8, border: "none", background: valid ? "#e07b39" : "#222", color: valid ? "#fff" : "#555", cursor: valid ? "pointer" : "not-allowed", fontFamily: "Barlow Condensed, sans-serif", fontSize: 16, letterSpacing: 0.5 }}
          >
            {initial ? "SAVE CHANGES" : "CREATE TASK"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Project Card ──────────────────────────────────────────────────────────────
function ProjectCard({ project, tasks, workers, onAddTask, onToggleTask }) {
  const [expanded, setExpanded] = useState(false);
  const projectTasks = tasks.filter(t => t.projectId === project.id);
  const done = projectTasks.filter(t => t.done).length;

  return (
    <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 14, overflow: "hidden" }}>
      {/* Card header */}
      <div style={{ padding: "18px 18px 14px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, fontWeight: 700, color: "#f0f0f0", lineHeight: 1.1 }}>{project.name}</div>
            <div style={{ fontSize: 13, color: "#666", marginTop: 3 }}>{project.client}</div>
            <div style={{ fontSize: 12, color: "#444", marginTop: 1 }}>{project.address}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
            <Badge value={project.status} color={STATUS_COLOR[project.status]} bg={STATUS_BG[project.status]} />
            <Badge value={`${project.priority} priority`} color={PRIORITY_COLOR[project.priority]} bg={PRIORITY_BG[project.priority]} />
          </div>
        </div>

        {/* Progress + phase */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: "#666" }}>Phase: <strong style={{ color: "#ccc" }}>{project.phase}</strong></span>
              <span style={{ fontSize: 12, color: "#666" }}>{project.progress}%</span>
            </div>
            <div style={{ height: 5, background: "#222", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${project.progress}%`, background: "#e07b39", borderRadius: 3 }} />
            </div>
          </div>
        </div>

        {/* Budget */}
        <BudgetBar project={project} />
      </div>

      {/* Task section toggle */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          borderTop: "1px solid #1a1a1a",
          padding: "10px 18px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer", userSelect: "none",
          background: expanded ? "#191919" : "transparent",
        }}
      >
        <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, color: "#666", letterSpacing: 0.5, textTransform: "uppercase" }}>
          Tasks — {done}/{projectTasks.length} done
        </span>
        <span style={{ color: "#555", fontSize: 16, transition: "transform 0.2s", display: "inline-block", transform: expanded ? "rotate(180deg)" : "none" }}>▾</span>
      </div>

      {expanded && (
        <div style={{ borderTop: "1px solid #1a1a1a" }}>
          {projectTasks.length === 0 && (
            <div style={{ padding: "16px 18px", color: "#555", fontSize: 13 }}>No tasks yet.</div>
          )}
          {projectTasks.map(t => (
            <TaskRow key={t.id} task={t} workers={workers} onToggle={onToggleTask} />
          ))}
          <div style={{ padding: "10px 14px" }}>
            <button
              onClick={() => onAddTask(project.id)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "none", border: "1px dashed #2a2a2a", borderRadius: 6,
                color: "#555", fontSize: 13, cursor: "pointer", padding: "8px 12px",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#e07b39"; e.currentTarget.style.color = "#e07b39"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#2a2a2a"; e.currentTarget.style.color = "#555"; }}
            >
              + Add task
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Projects main view ────────────────────────────────────────────────────────
export default function Projects() {
  const [tasks, setTasks] = useState(mockTasks);
  const [modal, setModal] = useState(null); // { projectId } | null

  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");

  const filtered = mockProjects.filter(p => {
    if (filterStatus !== "all" && p.status !== filterStatus) return false;
    if (filterPriority !== "all" && p.priority !== filterPriority) return false;
    return true;
  });

  const handleToggleTask = (id) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const handleSaveTask = (form) => {
    const newTask = { ...form, id: `t${Date.now()}`, done: false };
    setTasks(prev => [...prev, newTask]);
    post("/tasks", newTask).catch(() => {});
    setModal(null);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 28, fontWeight: 700, color: "#f0f0f0" }}>PROJECTS</div>
        <button
          onClick={() => setModal({ projectId: mockProjects[0].id, newProject: true })}
          style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#e07b39", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, letterSpacing: 0.5, cursor: "pointer" }}
        >
          + NEW TASK
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {["all", "active", "planning", "completed"].map(s => (
          <FilterChip key={s} label={s === "all" ? "All Status" : s} active={filterStatus === s} onClick={() => setFilterStatus(s)} />
        ))}
        <div style={{ width: 1, background: "#222", margin: "0 4px" }} />
        {["all", "high", "medium", "low"].map(p => (
          <FilterChip key={p} label={p === "all" ? "All Priority" : p} active={filterPriority === p} onClick={() => setFilterPriority(p)}
            color={p !== "all" ? PRIORITY_COLOR[p] : undefined} />
        ))}
      </div>

      {/* Project cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
        {filtered.map(p => (
          <ProjectCard
            key={p.id}
            project={p}
            tasks={tasks}
            workers={mockWorkers}
            onAddTask={(projectId) => setModal({ projectId })}
            onToggleTask={handleToggleTask}
          />
        ))}
      </div>

      {modal && (
        <TaskModal
          initial={modal.newProject ? undefined : { projectId: modal.projectId, title: "", assignee: mockWorkers[0].id, dueDate: new Date().toISOString().slice(0, 10), priority: "medium" }}
          projects={mockProjects}
          workers={mockWorkers}
          onSave={handleSaveTask}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function FilterChip({ label, active, onClick, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 14px", borderRadius: 20, border: `1px solid ${active ? (color || "#e07b39") : "#2a2a2a"}`,
        background: active ? (color ? `${color}22` : "#2a1800") : "transparent",
        color: active ? (color || "#e07b39") : "#666",
        fontSize: 13, fontFamily: "Barlow Condensed, sans-serif", letterSpacing: 0.3,
        textTransform: "capitalize", cursor: "pointer", transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );
}

const field = { marginBottom: 14 };
const lbl = { display: "block", fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Barlow Condensed, sans-serif", marginBottom: 6 };
const inp = { width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#f0f0f0", fontSize: 14, padding: "10px 12px", fontFamily: "DM Sans, sans-serif", boxSizing: "border-box" };
