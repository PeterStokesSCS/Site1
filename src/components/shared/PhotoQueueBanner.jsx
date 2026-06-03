import { useState, useEffect } from "react";
import { subscribe, flush } from "../../lib/photoQueue";

// Thin banner shown while photos are waiting in the offline outbox.
export default function PhotoQueueBanner() {
  const [n, setN] = useState(0);
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);

  useEffect(() => {
    const unsub = subscribe(setN);
    const on = () => { setOnline(true); flush(); };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { unsub(); window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  if (n === 0) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#1c1505", border: "1px solid #e07b3944", borderRadius: 8, padding: "8px 12px", margin: "0 0 10px", fontSize: 12, color: "#e0a060", fontFamily: "DM Sans, sans-serif" }}>
      <span>{online ? "↑" : "⌁"}</span>
      <span style={{ flex: 1 }}>{n} photo{n > 1 ? "s" : ""} queued — {online ? "uploading…" : "will upload when back online"}</span>
      {online && <button onClick={() => flush()} style={{ background: "transparent", border: "none", color: "#e07b39", fontSize: 12, cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif" }}>RETRY</button>}
    </div>
  );
}
