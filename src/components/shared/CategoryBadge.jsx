import { categoryMeta } from "../../lib/photoUtils";

// Small coloured category pill for photo thumbnails (sm) and detail views (lg).
export default function CategoryBadge({ category, size = "sm" }) {
  const m = categoryMeta(category);
  const small = size === "sm";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      background: small ? m.color : `${m.color}22`,
      color: small ? "#fff" : m.color,
      borderRadius: 4, fontFamily: "Barlow Condensed, sans-serif",
      fontSize: small ? 8 : 12, letterSpacing: 0.3, textTransform: "uppercase",
      padding: small ? "1px 4px" : "3px 8px", whiteSpace: "nowrap",
    }}>
      <span style={{ fontSize: small ? 8 : 12 }}>{m.icon}</span>{m.label}
    </span>
  );
}
