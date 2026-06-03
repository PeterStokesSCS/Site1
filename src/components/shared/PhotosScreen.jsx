import { useState, useEffect } from "react";
import BackHeader from "./BackHeader";
import { EmptyState } from "./LoadingScreen";
import PhotoCaptureButton from "./PhotoCaptureButton";
import { gpsStatusLabel } from "../../lib/photoUtils";
import { getPhotos, addPhoto, updatePhotoCaption, setPhotoClientVisible } from "../../lib/db";

// Full-screen photo viewer with editable caption + client-visible toggle
function Lightbox({ photo, onClose, onCaption, onClientChange, canSetClient }) {
  const [caption, setCaption] = useState(photo.caption || "");
  const [clientVisible, setClientVisible] = useState(!!photo.client_visible);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    await onCaption(photo.id, caption);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const toggleClient = async () => {
    const next = !clientVisible;
    setClientVisible(next);
    await setPhotoClientVisible(photo.id, next);
    onClientChange?.(photo.id, next);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 300, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", padding: 14 }}>
        <button onClick={onClose} style={{ background: "#1e1e1e", border: "none", borderRadius: 10, color: "#fff", fontSize: 20, width: 40, height: 40, cursor: "pointer" }}>✕</button>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", padding: "0 12px" }}>
        <img src={photo.url} alt={photo.caption || "site photo"} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8 }} />
      </div>
      <div style={{ padding: "16px", maxWidth: 480, margin: "0 auto", width: "100%" }}>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>
          {photo.taken_by?.full_name || "Unknown"} · {new Date(photo.taken_at || photo.created_at).toLocaleString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        </div>
        {(() => { const g = gpsStatusLabel({ gps: photo.gps_lat != null ? { lat: photo.gps_lat } : null, distanceM: photo.gps_distance_from_site_m }); return (
          <div style={{ fontSize: 12, color: g.color, marginBottom: 8 }}>
            {g.label}
            {photo.gps_lat != null && photo.gps_lng != null && <a href={`https://www.google.com/maps?q=${photo.gps_lat},${photo.gps_lng}`} target="_blank" rel="noreferrer" style={{ color: "#3b82f6", marginLeft: 8, textDecoration: "none" }}>· View on map ↗</a>}
          </div>
        ); })()}
        <div style={{ display: "flex", gap: 8 }}>
          <input value={caption} onChange={e => setCaption(e.target.value)} placeholder="Add a caption…" style={{ flex: 1, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#f0f0f0", fontSize: 14, padding: "10px 12px", fontFamily: "DM Sans, sans-serif" }} />
          <button onClick={save} style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: saved ? "#22c55e" : "#e07b39", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, cursor: "pointer" }}>{saved ? "SAVED" : "SAVE"}</button>
        </div>
        {canSetClient ? (
          <button onClick={toggleClient} style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", cursor: "pointer", marginTop: 12 }}>
            <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${clientVisible ? "#22c55e" : "#555"}`, background: clientVisible ? "#22c55e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {clientVisible && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>✓</span>}
            </div>
            <span style={{ fontSize: 13, color: clientVisible ? "#22c55e" : "#888" }}>Visible to client</span>
          </button>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
            <span style={{ fontSize: 10, color: clientVisible ? "#22c55e" : "#555" }}>●</span>
            <span style={{ fontSize: 13, color: clientVisible ? "#22c55e" : "#888" }}>{clientVisible ? "Visible to client" : "Internal only"}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PhotosScreen({ project, user, onBack }) {
  const [photos, setPhotos] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => { getPhotos(project.id).then(({ data }) => setPhotos(data)); }, [project.id]);

  const onPhoto = async (meta) => {
    setErr(null);
    const { data, error } = await addPhoto({
      project_id: project.id, url: meta.url, taken_by: user.id, category: "general",
      file_name: meta.file_name, file_size_kb: meta.file_size_kb,
      gps_lat: meta.gps_lat, gps_lng: meta.gps_lng, gps_accuracy_m: meta.gps_accuracy_m,
      gps_on_site: meta.gps_on_site, gps_distance_from_site_m: meta.gps_distance_from_site_m,
      taken_at: meta.taken_at,
    });
    if (error) { setErr(error.message || "Could not save photo"); return; }
    if (data) setPhotos(prev => [data, ...(prev || [])]);
  };

  const saveCaption = async (id, caption) => {
    await updatePhotoCaption(id, caption);
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, caption } : p));
  };

  // Keep the gallery list in sync so the toggle state persists when reopened
  const onClientChange = (id, value) => {
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, client_visible: value } : p));
    setLightbox(lb => (lb && lb.id === id ? { ...lb, client_visible: value } : lb));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Photos" subtitle={project.street} onBack={onBack}
        rightSlot={
          <div style={{ display: "flex", gap: 8 }}>
            <PhotoCaptureButton folder={`photos/${project.id}`} projectLat={project.lat} projectLng={project.lng} capture="environment" label="📷 Take" color="#a855f7" onPhoto={onPhoto} />
            <PhotoCaptureButton folder={`photos/${project.id}`} projectLat={project.lat} projectLng={project.lng} label="📎 Add" onPhoto={onPhoto} />
          </div>
        }
      />
      <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
        {err && <div style={{ background: "#2a0c0c", border: "1px solid #ef444444", borderRadius: 8, padding: "10px 14px", color: "#ef4444", fontSize: 13, marginBottom: 10 }}>⚠ {err}</div>}
        {photos === null ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
            {[1,2,3,4,5,6].map(i => <div key={i} style={{ aspectRatio: "1", background: "#141414", borderRadius: 8 }} />)}
          </div>
        ) : photos.length === 0 ? (
          <EmptyState icon="📷" title="No photos yet" subtitle="Use Take or Add to capture site progress" />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
            {photos.map(p => (
              <button key={p.id} onClick={() => setLightbox(p)} style={{ aspectRatio: "1", border: "none", padding: 0, borderRadius: 8, overflow: "hidden", cursor: "pointer", background: "#141414", position: "relative" }}>
                <img src={p.url} alt={p.caption || "site photo"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                {p.client_visible && <div style={{ position: "absolute", top: 3, right: 3, background: "#22c55e", borderRadius: 4, fontSize: 8, color: "#022", padding: "1px 4px", fontFamily: "Barlow Condensed, sans-serif" }}>CLIENT</div>}
                {p.caption && <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.8))", color: "#fff", fontSize: 10, padding: "12px 6px 5px", textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.caption}</div>}
              </button>
            ))}
          </div>
        )}
      </div>

      {lightbox && <Lightbox photo={lightbox} onClose={() => setLightbox(null)} onCaption={saveCaption} onClientChange={onClientChange} canSetClient={user?.role === "builder" || user?.role === "supervisor"} />}
    </div>
  );
}
