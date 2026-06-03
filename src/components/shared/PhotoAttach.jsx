import { useState, useEffect } from "react";
import PhotoCaptureButton from "./PhotoCaptureButton";
import PhotoQueueBanner from "./PhotoQueueBanner";
import CategoryBadge from "./CategoryBadge";
import { gpsStatusLabel, PHOTO_CATEGORIES } from "../../lib/photoUtils";
import { getPhotosForRecord, addPhoto, setPhotoClientVisible, deletePhoto } from "../../lib/db";
import { removeFile } from "../../lib/storage";

// Reusable photo block for any record (issue, task, hazard, daily log, defect…).
// Photos attach to the record AND appear in the project Photos gallery.
// defaultCategory pre-tags new photos for the context (e.g. hazard→safety, daily log→progress).
// defaultClientVisible seeds the client-visible toggle (e.g. progress photos default on).
export default function PhotoAttach({ project, user, recordType, recordId, accent = "#a855f7", defaultCategory = "general", defaultClientVisible = false }) {
  const [photos, setPhotos] = useState(null);
  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState(defaultCategory);
  const [clientVisible, setClientVisible] = useState(defaultClientVisible);
  const [view, setView] = useState(null); // photo being viewed full-screen
  const [confirmDel, setConfirmDel] = useState(false);
  const canSetClient = user?.role === "builder" || user?.role === "supervisor";

  const reload = () => getPhotosForRecord(recordType, recordId).then(({ data }) => setPhotos(data));
  useEffect(() => {
    if (!recordId) return;
    reload();
    const h = () => reload();
    window.addEventListener("photoqueue:flushed", h);
    return () => window.removeEventListener("photoqueue:flushed", h);
  }, [recordType, recordId]);

  const onPhoto = async (meta) => {
    const { data } = await addPhoto({
      project_id: project.id, url: meta.url, taken_by: user.id,
      caption: caption.trim() || null, client_visible: clientVisible,
      linked_record_type: recordType, linked_record_id: recordId, category,
      file_name: meta.file_name, file_size_kb: meta.file_size_kb,
      gps_lat: meta.gps_lat, gps_lng: meta.gps_lng, gps_accuracy_m: meta.gps_accuracy_m,
      gps_on_site: meta.gps_on_site, gps_distance_from_site_m: meta.gps_distance_from_site_m,
      taken_at: meta.taken_at,
    });
    if (data) setPhotos(p => [data, ...(p || [])]);
    setCaption("");
  };

  const toggleClient = async (photo) => {
    const next = !photo.client_visible;
    setPhotos(p => p.map(x => x.id === photo.id ? { ...x, client_visible: next } : x));
    await setPhotoClientVisible(photo.id, next);
  };

  const canDelete = (p) => canSetClient || p.taken_by?.id === user?.id || p.taken_by === user?.id;

  const removePhoto = async (photo) => {
    setPhotos(p => p.filter(x => x.id !== photo.id));
    setView(null);
    await deletePhoto(photo.id);
    removeFile(photo.url).catch(() => {});
  };

  return (
    <div>
      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 12, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
        Photos {photos?.length ? `(${photos.length})` : ""}
      </div>

      {/* Thumbnails */}
      {photos?.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4, marginBottom: 12 }}>
          {photos.map(p => (
            <button key={p.id} onClick={() => { setConfirmDel(false); setView(p); }} style={{ aspectRatio: "1", border: "none", padding: 0, borderRadius: 8, overflow: "hidden", cursor: "pointer", background: "#1a1a1a", position: "relative" }}>
              <img src={p.url} alt={p.caption || "photo"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <div style={{ position: "absolute", top: 3, left: 3 }}><CategoryBadge category={p.category || "general"} /></div>
              {p.client_visible && <div style={{ position: "absolute", top: 3, right: 3, background: "#22c55e", borderRadius: 4, fontSize: 8, color: "#022", padding: "1px 3px", fontFamily: "Barlow Condensed, sans-serif" }}>CLIENT</div>}
            </button>
          ))}
        </div>
      )}

      {/* Add controls */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {PHOTO_CATEGORIES.map(c => {
          const active = category === c.key;
          return (
            <button key={c.key} onClick={() => setCategory(c.key)} style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              background: active ? c.color : "transparent",
              color: active ? "#fff" : c.color,
              border: `1px solid ${c.color}${active ? "" : "55"}`,
              borderRadius: 14, padding: "4px 9px", cursor: "pointer",
              fontFamily: "Barlow Condensed, sans-serif", fontSize: 11, letterSpacing: 0.3, textTransform: "uppercase",
            }}>{c.icon} {c.label}</button>
          );
        })}
      </div>
      <input value={caption} onChange={e => setCaption(e.target.value)} placeholder="Caption (optional)" style={{ width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#f0f0f0", fontSize: 13, padding: "9px 12px", fontFamily: "DM Sans, sans-serif", boxSizing: "border-box", marginBottom: 8 }} />
      {canSetClient && (
        <button onClick={() => setClientVisible(v => !v)} style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", cursor: "pointer", padding: "2px 0 10px" }}>
          <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${clientVisible ? "#22c55e" : "#333"}`, background: clientVisible ? "#22c55e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {clientVisible && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>✓</span>}
          </div>
          <span style={{ fontSize: 12, color: clientVisible ? "#22c55e" : "#888" }}>Visible to client</span>
        </button>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <PhotoCaptureButton folder={`records/${project.id}/${recordType}`} projectLat={project.lat} projectLng={project.lng} capture="environment" label="📷 Take photo" color={accent} onPhoto={onPhoto} queueAction={{ type: "addPhoto", payload: { project_id: project.id, taken_by: user.id, caption: caption.trim() || null, client_visible: clientVisible, linked_record_type: recordType, linked_record_id: recordId, category } }} />
        <PhotoCaptureButton folder={`records/${project.id}/${recordType}`} projectLat={project.lat} projectLng={project.lng} label="📎 Add" onPhoto={onPhoto} queueAction={{ type: "addPhoto", payload: { project_id: project.id, taken_by: user.id, caption: caption.trim() || null, client_visible: clientVisible, linked_record_type: recordType, linked_record_id: recordId, category } }} />
      </div>
      <div style={{ marginTop: 10 }}><PhotoQueueBanner /></div>

      {/* Lightbox */}
      {view && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 400, display: "flex", flexDirection: "column" }} onClick={() => setView(null)}>
          <div style={{ display: "flex", justifyContent: "flex-end", padding: 14 }}>
            <button onClick={() => setView(null)} style={{ background: "#1e1e1e", border: "none", borderRadius: 10, color: "#fff", fontSize: 20, width: 40, height: 40, cursor: "pointer" }}>✕</button>
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 12px" }} onClick={e => e.stopPropagation()}>
            <img src={view.url} alt={view.caption || "photo"} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8 }} />
          </div>
          <div style={{ padding: 16, maxWidth: 480, margin: "0 auto", width: "100%" }} onClick={e => e.stopPropagation()}>
            <div style={{ marginBottom: 8 }}><CategoryBadge category={view.category || "general"} size="lg" /></div>
            {view.caption && <div style={{ fontSize: 14, color: "#ccc", marginBottom: 8 }}>{view.caption}</div>}
            {(() => { const g = gpsStatusLabel({ gps: view.gps_lat != null ? { lat: view.gps_lat } : null, distanceM: view.gps_distance_from_site_m }); return (
              <div style={{ fontSize: 12, color: g.color, marginBottom: 8 }}>
                {g.label}{view.taken_at ? ` · ${new Date(view.taken_at).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}
                {view.gps_lat != null && view.gps_lng != null && <a href={`https://www.google.com/maps?q=${view.gps_lat},${view.gps_lng}`} target="_blank" rel="noreferrer" style={{ color: "#3b82f6", marginLeft: 8, textDecoration: "none" }}>· View on map ↗</a>}
              </div>
            ); })()}
            {canSetClient ? (
              <button onClick={() => { toggleClient(view); setView(v => ({ ...v, client_visible: !v.client_visible })); }} style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", cursor: "pointer" }}>
                <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${view.client_visible ? "#22c55e" : "#555"}`, background: view.client_visible ? "#22c55e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {view.client_visible && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>✓</span>}
                </div>
                <span style={{ fontSize: 13, color: view.client_visible ? "#22c55e" : "#888" }}>Visible to client</span>
              </button>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 10, color: view.client_visible ? "#22c55e" : "#555" }}>●</span>
                <span style={{ fontSize: 13, color: view.client_visible ? "#22c55e" : "#888" }}>{view.client_visible ? "Visible to client" : "Internal only"}</span>
              </div>
            )}
            {canDelete(view) && (
              confirmDel ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
                  <span style={{ fontSize: 13, color: "#ef4444", flex: 1 }}>Delete this photo?</span>
                  <button onClick={() => { setConfirmDel(false); removePhoto(view); }} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#ef4444", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer" }}>DELETE</button>
                  <button onClick={() => setConfirmDel(false)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #333", background: "transparent", color: "#888", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer" }}>CANCEL</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDel(true)} style={{ marginTop: 14, background: "transparent", border: "none", color: "#ef4444", fontSize: 13, cursor: "pointer", padding: 0, fontFamily: "DM Sans, sans-serif" }}>🗑 Delete photo</button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
