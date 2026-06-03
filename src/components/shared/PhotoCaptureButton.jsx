import { useRef, useState } from "react";
import { uploadFile } from "../../lib/storage";
import { compressImage, getGps, distanceFromSiteMetres } from "../../lib/photoUtils";
import { enqueue } from "../../lib/photoQueue";

// Capture/upload a photo: compress → GPS → upload → onPhoto(metadata).
// onPhoto receives { url, file_name, file_size_kb, gps_lat, gps_lng, gps_accuracy_m,
// gps_on_site, gps_distance_from_site_m, taken_at }.
// If a `queueAction` is given and the device is offline / the upload fails, the
// blob is stored in the offline outbox and the DB write is deferred until online.
export default function PhotoCaptureButton({ folder = "photos", projectLat, projectLng, onPhoto, queueAction, label = "📷 Take photo", capture, color = "#a855f7" }) {
  const ref = useRef();
  const [stage, setStage] = useState(null); // 'compress' | 'gps' | 'upload' | 'queued' | null
  const [err, setErr] = useState(null);

  const handle = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr(null);
    let blob, meta;
    try {
      setStage("compress");
      blob = await compressImage(file);
      setStage("gps");
      const gps = await getGps();
      const distanceM = gps ? distanceFromSiteMetres(gps.lat, gps.lng, projectLat, projectLng) : null;
      meta = {
        file_name: file.name || null,
        file_size_kb: Math.round(blob.size / 1024),
        gps_lat: gps?.lat ?? null,
        gps_lng: gps?.lng ?? null,
        gps_accuracy_m: gps?.accuracy ?? null,
        gps_on_site: distanceM != null ? distanceM < 500 : null,
        gps_distance_from_site_m: distanceM,
        taken_at: new Date().toISOString(),
      };
    } catch (ex) {
      setStage(null);
      setErr(ex.message || "Could not read photo");
      return;
    }

    // Offline (or no upload path) → queue it for later if we know how to persist it.
    if (queueAction && typeof navigator !== "undefined" && navigator.onLine === false) {
      await enqueue({ blob, folder, meta, action: queueAction });
      setStage("queued"); setTimeout(() => setStage(null), 1500);
      return;
    }

    try {
      setStage("upload");
      const { url, error } = await uploadFile(blob, folder, "jpg");
      if (error) throw error;
      onPhoto({ url, ...meta });
      setStage(null);
    } catch (ex) {
      if (queueAction) {
        await enqueue({ blob, folder, meta, action: queueAction });
        setStage("queued"); setTimeout(() => setStage(null), 1500);
        return;
      }
      setErr(ex.message || "Upload failed");
      setStage(null);
    }
  };

  const busyLabel = stage === "compress" ? "COMPRESSING…" : stage === "gps" ? "LOCATING…" : stage === "upload" ? "UPLOADING…" : stage === "queued" ? "QUEUED ✓" : null;

  return (
    <>
      <button type="button" onClick={() => ref.current?.click()} disabled={!!stage} style={{
        padding: "9px 12px", borderRadius: 8, border: `1px solid ${color}55`,
        background: stage ? "#1a1a1a" : `${color}1a`, color: stage ? "#888" : color,
        fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, letterSpacing: 0.3,
        cursor: stage ? "wait" : "pointer", WebkitTapHighlightColor: "transparent", whiteSpace: "nowrap",
      }}>
        {busyLabel || label}
      </button>
      <input ref={ref} type="file" accept="image/*" capture={capture} style={{ display: "none" }} onChange={handle} />
      {err && <span style={{ color: "#ef4444", fontSize: 11, marginLeft: 8 }}>{err}</span>}
    </>
  );
}
