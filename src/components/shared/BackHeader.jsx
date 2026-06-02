export default function BackHeader({ title, subtitle, onBack, rightSlot }) {
  return (
    <div style={{
      background: "#111",
      borderBottom: "1px solid #1e1e1e",
      padding: "12px 16px",
      display: "flex",
      alignItems: "center",
      gap: 12,
      flexShrink: 0,
    }}>
      <button
        onClick={onBack}
        style={{
          background: "#1e1e1e",
          border: "none",
          borderRadius: 10,
          color: "#e07b39",
          fontSize: 20,
          width: 38,
          height: 38,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          flexShrink: 0,
          WebkitTapHighlightColor: "transparent",
        }}
      >
        ‹
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "Barlow Condensed, sans-serif",
          fontSize: 20,
          fontWeight: 700,
          color: "#f0f0f0",
          textTransform: "uppercase",
          letterSpacing: 0.5,
          lineHeight: 1.1,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}>
          {title}
        </div>
        {subtitle && <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{subtitle}</div>}
      </div>
      {rightSlot && <div style={{ flexShrink: 0 }}>{rightSlot}</div>}
    </div>
  );
}
