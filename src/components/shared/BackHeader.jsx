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
        aria-label="Back"
        style={{
          background: "#242424",
          border: "1px solid #3a3a3a",
          borderRadius: 11,
          color: "#e07b39",
          fontSize: 30,
          fontWeight: 700,
          lineHeight: 1,
          width: 44,
          height: 44,
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
        {subtitle && <div style={{ fontSize: 12, color: "#8a8a8a", marginTop: 2 }}>{subtitle}</div>}
      </div>
      {rightSlot && <div style={{ flexShrink: 0 }}>{rightSlot}</div>}
    </div>
  );
}
