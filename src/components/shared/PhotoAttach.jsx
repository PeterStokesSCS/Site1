import { useState, useEffect } from "react";
import FileUploadButton from "./FileUploadButton";
import { getPhotosForRecord, addPhoto, setPhotoClientVisible } from "../../lib/db";

// Reusable photo block for any record (issue, task, hazard, daily log, defect…).
// Photos attach to the record AND appear in the project Photos gallery.
export default function PhotoAttach({ project, user, recordType, recordId, accent = "#a855f7" }) {
  const [photos, setPhotos] = useState(null);
  const [caption, setCaption] = useState("");
  const [clientVisible, setClientVisible] = useState(false);
  const [view, setView] = useState(null); // photo being viewed full-screen

  useEffect(() => {
    if (!recordId) return;
    getPhotosForRecord(recordType, recordId).then(({ data }) => setPhotos(data));
  }, [recordType, recordId]);

  const onUploaded = async (url) => {
    const { data } = await addPhoto({
      project_id: project.id, url, taken_by: user.id,
      caption: caption.trim() || null, client_visible: clientVisible,
      linked_record_type: recordType, linked_record_id: recordId, category: "General",
    });
    if (data) setPhotos(p => [data, ...(p || [])]);
    setCaption("");
  };

  const toggleClient = async (photo) => {
    const next = !photo.client_visible;
    setPhotos(p => p.map(x => x.id === photo.id ? { ...x, client_visible: next } : x));
    await setPhotoClientVisible(photo.id, next);
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
            <button key={p.id} onClick={() => setView(p)} style={{ aspectRatio: "1", border: "none", padding: 0, borderRadius: 8, overflow: "hidden", cursor: "pointer", background: "#1a1a1a", position: "relative" }}>
              <img src={p.url} alt={p.caption || "photo"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              {p.client_visible && <div style={{ position: "absolute", top: 3, right: 3, background: "#22c55e", borderRadius: 4, fontSize: 8, color: "#022", padding: "1px 3px", fontFamily: "Barlow Condensed, sans-serif" }}>CLIENT</div>}
            </button>
          ))}
        </div>
      )}

      {/* Add controls */}
      <input value={caption} onChange={e => setCaption(e.target.value)} placeholder="Caption (optional)" style={{ width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#f0f0f0", fontSize: 13, padding: "9px 12px", fontFamily: "DM Sans, sans-serif", boxSizing: "border-box", marginBottom: 8 }} />
      <button onClick={() => setClientVisible(v => !v)} style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", cursor: "pointer", padding: "2px 0 10px" }}>
        <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${clientVisible ? "#22c55e" : "#333"}`, background: clientVisible ? "#22c55e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {clientVisible && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>✓</span>}
        </div>
        <span style={{ fontSize: 12, color: clientVisible ? "#22c55e" : "#888" }}>Visible to client</span>
      </button>
      <div style={{ display: "flex", gap: 8 }}>
        <FileUploadButton folder={`records/${project.id}/${recordType}`} accept="image/*" capture="environment" label="📷 Take photo" color={accent} onUploaded={onUploaded} />
        <FileUploadButton folder={`records/${project.id}/${recordType}`} accept="image/*" label="📎 Add" onUploaded={onUploaded} />
      </div>

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
            {view.caption && <div style={{ fontSize: 14, color: "#ccc", marginBottom: 8 }}>{view.caption}</div>}
            <button onClick={() => { toggleClient(view); setView(v => ({ ...v, client_visible: !v.client_visible })); }} style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", cursor: "pointer" }}>
              <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${view.client_visible ? "#22c55e" : "#555"}`, background: view.client_visible ? "#22c55e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {view.client_visible && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>✓</span>}
              </div>
              <span style={{ fontSize: 13, color: view.client_visible ? "#22c55e" : "#888" }}>Visible to client</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
