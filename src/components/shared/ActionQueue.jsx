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
        <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 17, letterSpacing: 0.4, textTransform: "uppercase", color: "#e07b39" }}>{title}</span>
        {items.length > 0 && (
          <span style={{ fontSize: 13, color: "#bbb", fontWeight: 600, fontFamily: "Barlow Condensed, sans-serif" }}>
            {items.length} item{items.length > 1 ? "s" : ""}{high ? <span style={{ color: "#ef4444" }}> · {high} high</span> : ""}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div style={{ fontSize: 13, color: "#3a8a5a" }}>✓ {allClear}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {shown.map(it => {
            const p = PILL[it.priority] || PILL.low;
            // Whole card is the tap target (mobile pattern) — no separate "Open" button.
            return (
              <button key={it.id} onClick={() => onOpen(it)} style={{ display: "flex", alignItems: "center", gap: 10, background: "#171717", border: "1px solid #222", borderRadius: 9, padding: "10px 11px", width: "100%", textAlign: "left", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                <div style={{ width: 6, alignSelf: "stretch", minHeight: 32, borderRadius: 3, background: p.c, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: "#f0f0f0", lineHeight: 1.3 }}>{it.description}</div>
                  <div style={{ fontSize: 12, color: "#9a9a9a", marginTop: 2 }}>{it.projectName}{it.ageHours != null ? ` · ${ageLabel(it.ageHours)}` : ""}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, fontFamily: "Barlow Condensed, sans-serif", color: p.c, background: p.bg, padding: "3px 9px", borderRadius: 5, flexShrink: 0 }}>{p.label}</span>
                <span style={{ color: "#666", fontSize: 18, flexShrink: 0 }}>›</span>
              </button>
            );
          })}
          {max && items.length > max && <div style={{ fontSize: 11, color: "#555", textAlign: "center", paddingTop: 4 }}>+{items.length - max} more</div>}
        </div>
      )}
    </div>
  );
}
