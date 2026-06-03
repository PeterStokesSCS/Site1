import { useRef, useState } from "react";
import { uploadFile } from "../../lib/storage";

// Reusable upload control. Calls onUploaded(url, file) once stored.
// `capture="environment"` opens the camera directly on mobile (for receipts/photos).
export default function FileUploadButton({ folder = "misc", onUploaded, label = "📎 Attach", accept, capture, color = "#3b82f6" }) {
  const ref = useRef();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const handle = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setErr(null);
    const { url, error } = await uploadFile(file, folder);
    setBusy(false);
    e.target.value = ""; // allow re-selecting the same file
    if (error) { setErr(error.message || "Upload failed"); return; }
    onUploaded(url, file);
  };

  return (
    <>
      <button type="button" onClick={() => ref.current?.click()} disabled={busy} style={{
        padding: "9px 12px", borderRadius: 8, border: `1px solid ${color}55`,
        background: busy ? "#1a1a1a" : `${color}1a`, color: busy ? "#555" : color,
        fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, letterSpacing: 0.3,
        cursor: busy ? "wait" : "pointer", WebkitTapHighlightColor: "transparent", whiteSpace: "nowrap",
      }}>
        {busy ? "UPLOADING…" : label}
      </button>
      <input ref={ref} type="file" accept={accept} capture={capture} style={{ display: "none" }} onChange={handle} />
      {err && <span style={{ color: "#ef4444", fontSize: 11, marginLeft: 8 }}>{err}</span>}
    </>
  );
}
