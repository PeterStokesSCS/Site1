export function Skeleton({ width = "100%", height = 18, radius = 6, style = {} }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: "linear-gradient(90deg, #1a1a1a 25%, #222 50%, #1a1a1a 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s infinite",
      ...style,
    }} />
  );
}

export function CardSkeleton() {
  return (
    <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 12, padding: "16px", marginBottom: 10 }}>
      <Skeleton width="60%" height={20} style={{ marginBottom: 10 }} />
      <Skeleton width="40%" height={14} style={{ marginBottom: 6 }} />
      <Skeleton width="80%" height={14} />
    </div>
  );
}

export function EmptyState({ icon = "📭", title, subtitle, action }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 20px", color: "#555" }}>
      <div style={{ fontSize: 48, marginBottom: 14 }}>{icon}</div>
      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 20, color: "#888", marginBottom: 6 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 13, color: "#555", marginBottom: 20 }}>{subtitle}</div>}
      {action}
    </div>
  );
}

export default function LoadingScreen() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100dvh", background: "#0c0c0c" }}>
      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 24, color: "#333", letterSpacing: 2, animation: "pulse 1.4s infinite" }}>
        <span style={{ color: "#e07b3966" }}>SITE</span>1
      </div>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes pulse { 0%,100%{opacity:0.3} 50%{opacity:1} }
      `}</style>
    </div>
  );
}
