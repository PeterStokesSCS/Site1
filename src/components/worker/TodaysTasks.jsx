import { useState } from "react";
import { mockTasks, mockProjects } from "../../data/mockData";

const TODAY = new Date().toISOString().slice(0, 10);

const PRIORITY_COLOR = { high: "#c0392b", medium: "#e07b39", low: "#27ae60" };
const PRIORITY_BG = { high: "#2a1010", medium: "#2a1800", low: "#0f2a0f" };

export default function TodaysTasks({ worker }) {
  const [tasks, setTasks] = useState(() =>
    mockTasks.filter((t) => t.assignee === worker.id && t.dueDate === TODAY)
  );

  const toggle = (id) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  const done = tasks.filter((t) => t.done).length;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 26, fontWeight: 700, color: "#f0f0f0" }}>
          TODAY'S TASKS
        </div>
        <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>
          {new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}
        </div>
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, height: 6, background: "#222", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: tasks.length ? `${(done / tasks.length) * 100}%` : "0%", background: "#e07b39", borderRadius: 3, transition: "width 0.3s" }} />
          </div>
          <span style={{ fontSize: 13, color: "#888", fontFamily: "Barlow Condensed, sans-serif", whiteSpace: "nowrap" }}>
            {done}/{tasks.length} done
          </span>
        </div>
      </div>

      {tasks.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#555" }}>
          <div style={{ fontSize: 48 }}>✓</div>
          <div style={{ fontSize: 18, fontFamily: "Barlow Condensed, sans-serif", marginTop: 12 }}>No tasks for today</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Check back later or contact your manager</div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {tasks.map((task) => {
          const proj = mockProjects.find((p) => p.id === task.projectId);
          return (
            <button
              key={task.id}
              onClick={() => toggle(task.id)}
              style={{
                width: "100%",
                textAlign: "left",
                background: task.done ? "#141414" : "#191919",
                border: `1px solid ${task.done ? "#222" : "#2a2a2a"}`,
                borderLeft: `4px solid ${task.done ? "#333" : PRIORITY_COLOR[task.priority]}`,
                borderRadius: 10,
                padding: "14px 16px",
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
                display: "flex",
                alignItems: "flex-start",
                gap: 14,
                transition: "all 0.15s",
              }}
            >
              <div style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                border: `2px solid ${task.done ? "#27ae60" : "#444"}`,
                background: task.done ? "#27ae60" : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginTop: 1,
                transition: "all 0.15s",
              }}>
                {task.done && <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>✓</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: task.done ? "#555" : "#f0f0f0",
                  textDecoration: task.done ? "line-through" : "none",
                  lineHeight: 1.3,
                }}>
                  {task.title}
                </div>
                <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={{
                    fontSize: 11,
                    fontFamily: "Barlow Condensed, sans-serif",
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                    color: PRIORITY_COLOR[task.priority],
                    background: PRIORITY_BG[task.priority],
                    padding: "2px 8px",
                    borderRadius: 4,
                  }}>
                    {task.priority}
                  </span>
                  {proj && (
                    <span style={{ fontSize: 12, color: "#555" }}>{proj.name}</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {done === tasks.length && tasks.length > 0 && (
        <div style={{
          marginTop: 24,
          textAlign: "center",
          background: "#0f2a0f",
          border: "1px solid #27ae60",
          borderRadius: 12,
          padding: "18px 20px",
          color: "#27ae60",
          fontFamily: "Barlow Condensed, sans-serif",
          fontSize: 20,
          letterSpacing: 1,
        }}>
          ALL TASKS COMPLETE ✓
        </div>
      )}
    </div>
  );
}
