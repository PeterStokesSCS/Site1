import { useState, useEffect, useCallback } from "react";
import { computeActionItems } from "../../lib/actionQueue";

// Loads the derived action items for a user (compute-on-read). `enabled` lets a
// dashboard skip the work for roles that don't show a queue here.
export function useActionItems(role, userId, enabled = true) {
  const [items, setItems] = useState(null);
  const reload = useCallback(() => {
    if (!enabled) { setItems([]); return; }
    computeActionItems({ role, userId }).then(setItems).catch(() => setItems([]));
  }, [role, userId, enabled]);
  useEffect(() => { reload(); }, [reload]);
  return { items, reload };
}

const PILL = {
  high:   { c: "#ef4444", bg: "#2a0c0c", label: "HIGH" },
  medium: { c: "#f59e0b", bg: "#251d00", label: "MED" },
  low:    { c: "#888888", bg: "#1a1a1a", label: "LOW" },
};
function ageLabel(h) {
  if (h == null) return "";
  if (h < 1) return "just now";
  if (h < 24) return `${Math.floor(h)}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function ActionQueue({ items, title, onOpen, max, allClear = "Nothing needs your attention" }) {
  if (items == null) return null; // still loading — render nothing
  const high = items.filter(i => i.priority === "high").length;
  const shown = max ? items.slice(0, max) : items;

  return (
    <div style={{ background: "#121212", border: "1px solid #232323", borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: items.length ? 10 : 4 }}>
        <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, letterSpacing: 0.4, textTransform: "uppercase", color: "#e07b39" }}>{title}</span>
        {items.length > 0 && (
          <span style={{ fontSize: 11, color: "#888", fontFamily: "Barlow Condensed, sans-serif" }}>
            {items.length} item{items.length > 1 ? "s" : ""}{high ? ` · ${high} high` : ""}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div style={{ fontSize: 13, color: "#3a8a5a" }}>✓ {allClear}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {shown.map(it => {
            const p = PILL[it.priority] || PILL.low;
            return (
              <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#171717", border: "1px solid #222", borderRadius: 9, padding: "9px 11px" }}>
                <div style={{ width: 5, alignSelf: "stretch", minHeight: 30, borderRadius: 3, background: p.c, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "#e8e8e8", lineHeight: 1.3 }}>{it.description}</div>
                  <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{it.projectName}{it.ageHours != null ? ` · ${ageLabel(it.ageHours)}` : ""}</div>
                </div>
                <span style={{ fontSize: 9, fontFamily: "Barlow Condensed, sans-serif", color: p.c, background: p.bg, padding: "2px 6px", borderRadius: 4, flexShrink: 0 }}>{p.label}</span>
                <button onClick={() => onOpen(it)} style={{ padding: "6px 12px", borderRadius: 7, border: "none", background: "#e07b39", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 12, cursor: "pointer", flexShrink: 0 }}>Open</button>
              </div>
            );
          })}
          {max && items.length > max && <div style={{ fontSize: 11, color: "#555", textAlign: "center", paddingTop: 4 }}>+{items.length - max} more</div>}
        </div>
      )}
    </div>
  );
}
