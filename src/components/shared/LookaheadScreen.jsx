import { useState, useEffect } from "react";
import BackHeader from "./BackHeader";
import { EmptyState } from "./LoadingScreen";
import { getTasksByProject } from "../../lib/db";
import { supabase } from "../../lib/supabase";
import { melbourneTodayStr, MODULES } from "../../lib/actionQueue";
import { lookaheadBucket } from "../../lib/timeline";

const BUCKETS = [
  { key: "today",    label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "thisWeek", label: "This week" },
  { key: "nextWeek", label: "Next week" },
];
const fmt = (d) => d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" }) : "";

// Supervisor execution lookahead: tasks now (live), deliveries + inspections appear
// automatically when those modules light up (MODULES flags).
export default function LookaheadScreen({ project, onBack }) {
  const [items, setItems] = useState(null);
  const today = melbourneTodayStr();

  useEffect(() => {
    (async () => {
      const out = [];
      const { data: tasks } = await getTasksByProject(project.id);
      (tasks || []).filter(t => t.status !== "completed").forEach(t => {
        const date = t.start_date || t.due_date;
        const b = lookaheadBucket(date, today);
        if (b) out.push({ id: `task-${t.id}`, bucket: b, date, icon: "✅", kind: "Task", title: t.title });
      });
      if (MODULES.procurement) {
        const { data: procs } = await supabase.from("procurement_items").select("id, item_name, expected_delivery_date").eq("project_id", project.id);
        (procs || []).forEach(p => { const b = lookaheadBucket(p.expected_delivery_date, today); if (b) out.push({ id: `proc-${p.id}`, bucket: b, date: p.expected_delivery_date, icon: "📦", kind: "Delivery", title: p.item_name }); });
      }
      if (MODULES.inspections) {
        const { data: qa } = await supabase.from("qa_items").select("id, title, due_date, status").eq("project_id", project.id);
        (qa || []).filter(q => !["completed", "approved", "passed"].includes(q.status)).forEach(q => { const b = lookaheadBucket(q.due_date, today); if (b) out.push({ id: `qa-${q.id}`, bucket: b, date: q.due_date, icon: "🔍", kind: "Inspection", title: q.title }); });
      }
      out.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
      setItems(out);
    })();
  }, [project.id, today]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Lookahead" subtitle={project.street} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {items === null ? [1, 2, 3].map(i => <div key={i} style={{ height: 50, background: "#141414", borderRadius: 10, marginBottom: 8 }} />)
          : items.length === 0 ? <EmptyState icon="📈" title="Nothing scheduled" subtitle="Tasks with dates in the next 2 weeks appear here" />
          : BUCKETS.map(b => {
            const list = items.filter(i => i.bucket === b.key);
            return (
              <div key={b.key} style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12, color: "#0ea5e9", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Barlow Condensed, sans-serif", marginBottom: 8 }}>{b.label} {list.length > 0 && <span style={{ color: "#555" }}>· {list.length}</span>}</div>
                {list.length === 0 ? <div style={{ fontSize: 12, color: "#3a3a3a", paddingLeft: 2 }}>—</div>
                  : list.map(i => (
                    <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#141414", border: "1px solid #1e1e1e", borderRadius: 9, padding: "9px 12px", marginBottom: 6 }}>
                      <span style={{ fontSize: 16 }}>{i.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: "#e8e8e8" }}>{i.title}</div>
                        <div style={{ fontSize: 11, color: "#666" }}>{i.kind} · {fmt(i.date)}</div>
                      </div>
                    </div>
                  ))}
              </div>
            );
          })}
      </div>
    </div>
  );
}
