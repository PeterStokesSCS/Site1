import { useOfflineQueue } from "../../hooks/useOfflineQueue";

export default function OfflineBar() {
  const { isOnline, pending } = useOfflineQueue();

  if (isOnline && pending === 0) return null;

  return (
    <div
      style={{
        background: isOnline ? "#1a3a1a" : "#3a1a0a",
        color: isOnline ? "#4caf50" : "#e07b39",
        fontSize: 13,
        fontFamily: "DM Sans, sans-serif",
        padding: "8px 16px",
        textAlign: "center",
        position: "sticky",
        top: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      <span style={{ fontSize: 16 }}>{isOnline ? "↑" : "✕"}</span>
      {isOnline && pending > 0
        ? `Syncing ${pending} queued action${pending !== 1 ? "s" : ""}...`
        : "Offline — actions will sync when connected"}
    </div>
  );
}
