export default function AppTile({ tileKey, icon, label, accent, bg, badge, onClick, wide = false }) {
  return (
    <button
      onClick={onClick}
      data-testid={`tile-${(label || "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
      style={{
        aspectRatio: wide ? "2 / 1" : "1 / 1",
        gridColumn: wide ? "span 2" : "span 1",
        borderRadius: 18,
        background: bg,
        border: `1.5px solid ${accent}33`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        cursor: "pointer",
        position: "relative",
        WebkitTapHighlightColor: "transparent",
        userSelect: "none",
        transition: "transform 0.1s, opacity 0.1s",
        padding: 8,
      }}
      onPointerDown={e => e.currentTarget.style.transform = "scale(0.93)"}
      onPointerUp={e => e.currentTarget.style.transform = "scale(1)"}
      onPointerLeave={e => e.currentTarget.style.transform = "scale(1)"}
    >
      <span style={{ fontSize: 30, lineHeight: 1 }}>{icon}</span>
      <span style={{
        fontFamily: "Barlow Condensed, sans-serif",
        fontSize: 12,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        color: accent,
        lineHeight: 1,
        textAlign: "center",
      }}>
        {label}
      </span>

      {badge > 0 && (
        <div style={{
          position: "absolute",
          top: 8,
          right: 10,
          background: "#ef4444",
          color: "#fff",
          borderRadius: 10,
          minWidth: 18,
          height: 18,
          fontSize: 10,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 4px",
          fontFamily: "Barlow Condensed, sans-serif",
        }}>
          {badge > 9 ? "9+" : badge}
        </div>
      )}
    </button>
  );
}
