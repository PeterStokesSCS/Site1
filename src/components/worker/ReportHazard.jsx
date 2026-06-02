import { useState, useRef } from "react";
import { mockProjects, HAZARD_CATEGORIES } from "../../data/mockData";
import { post, enqueue } from "../../lib/webhook";
import { useOfflineQueue } from "../../hooks/useOfflineQueue";

const RISK = [
  { id: "high", label: "HIGH RISK", color: "#c0392b", bg: "#2a1010", icon: "🔴" },
  { id: "medium", label: "MEDIUM", color: "#e07b39", bg: "#2a1800", icon: "🟡" },
  { id: "low", label: "LOW", color: "#27ae60", bg: "#0f2a0f", icon: "🟢" },
];

const BLANK = { projectId: mockProjects[0].id, riskLevel: "", category: "", description: "", photoUrl: null };

export default function ReportHazard({ worker }) {
  const { isOnline, refreshPending } = useOfflineQueue();
  const [form, setForm] = useState(BLANK);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef();

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPhotoPreview(url);
    set("photoUrl", url);
  };

  const valid = form.riskLevel && form.category && form.description.trim().length >= 5;

  const submit = async () => {
    if (!valid) return;
    setSubmitting(true);
    const payload = {
      ...form,
      reporter: worker.id,
      reporterName: worker.name,
      timestamp: new Date().toISOString(),
      status: "open",
    };
    try {
      await post("/hazards", payload);
    } catch {
      enqueue("/hazards", payload);
      refreshPending();
    }
    setSubmitting(false);
    setSubmitted(true);
  };

  const reset = () => { setForm(BLANK); setPhotoPreview(null); setSubmitted(false); };

  if (submitted) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 300, gap: 16 }}>
        <div style={{ fontSize: 64 }}>✓</div>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 28, fontWeight: 700, color: "#27ae60", letterSpacing: 1 }}>HAZARD REPORTED</div>
        <div style={{ fontSize: 14, color: "#666", textAlign: "center" }}>
          {isOnline ? "Submitted and manager notified." : "Saved offline — will sync when connected."}
        </div>
        <button onClick={reset} style={reportAnotherBtn}>REPORT ANOTHER</button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 26, fontWeight: 700, color: "#f0f0f0", marginBottom: 20 }}>
        REPORT HAZARD
      </div>

      {/* Photo first */}
      <div
        onClick={() => fileRef.current?.click()}
        style={{
          background: "#191919",
          border: "2px dashed #333",
          borderRadius: 12,
          minHeight: 160,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          marginBottom: 20,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {photoPreview ? (
          <>
            <img src={photoPreview} alt="hazard" style={{ width: "100%", height: 200, objectFit: "cover" }} />
            <div style={{ position: "absolute", bottom: 8, right: 8, background: "#e07b39", color: "#fff", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontFamily: "Barlow Condensed, sans-serif" }}>TAP TO CHANGE</div>
          </>
        ) : (
          <>
            <span style={{ fontSize: 48 }}>📷</span>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 18, color: "#888", marginTop: 8 }}>TAP TO ADD PHOTO</div>
            <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>Optional but recommended</div>
          </>
        )}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handlePhoto} />
      </div>

      {/* Risk level */}
      <div style={{ marginBottom: 18 }}>
        <div style={label}>Risk Level</div>
        <div style={{ display: "flex", gap: 8 }}>
          {RISK.map((r) => (
            <button
              key={r.id}
              onClick={() => set("riskLevel", r.id)}
              style={{
                flex: 1,
                padding: "14px 8px",
                borderRadius: 10,
                border: `2px solid ${form.riskLevel === r.id ? r.color : "#2a2a2a"}`,
                background: form.riskLevel === r.id ? r.bg : "#141414",
                color: form.riskLevel === r.id ? r.color : "#666",
                fontFamily: "Barlow Condensed, sans-serif",
                fontSize: 14,
                letterSpacing: 0.5,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                WebkitTapHighlightColor: "transparent",
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: 20 }}>{r.icon}</span>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Category */}
      <div style={{ marginBottom: 18 }}>
        <div style={label}>Category</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {HAZARD_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => set("category", c)}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: `1px solid ${form.category === c ? "#e07b39" : "#2a2a2a"}`,
                background: form.category === c ? "#2a1800" : "#141414",
                color: form.category === c ? "#e07b39" : "#888",
                fontSize: 14,
                fontFamily: "Barlow Condensed, sans-serif",
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
                transition: "all 0.15s",
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Project */}
      <div style={{ marginBottom: 18 }}>
        <div style={label}>Project</div>
        <select value={form.projectId} onChange={(e) => set("projectId", e.target.value)} style={selectStyle}>
          {mockProjects.filter(p => p.status === "active").map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div style={{ marginBottom: 24 }}>
        <div style={label}>Description</div>
        <textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Describe the hazard clearly..."
          rows={4}
          style={{ ...selectStyle, resize: "vertical", lineHeight: 1.5 }}
        />
        <div style={{ fontSize: 12, color: "#444", marginTop: 4 }}>{form.description.length} chars</div>
      </div>

      <button
        onClick={submit}
        disabled={!valid || submitting}
        style={{
          width: "100%",
          padding: "18px",
          borderRadius: 12,
          border: "none",
          background: valid ? "#c0392b" : "#222",
          color: valid ? "#fff" : "#555",
          fontFamily: "Barlow Condensed, sans-serif",
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: 1,
          cursor: valid ? "pointer" : "not-allowed",
          transition: "background 0.15s",
        }}
      >
        {submitting ? "SUBMITTING..." : "SUBMIT HAZARD REPORT"}
      </button>
    </div>
  );
}

const label = {
  fontSize: 12,
  color: "#666",
  textTransform: "uppercase",
  letterSpacing: 0.5,
  fontFamily: "Barlow Condensed, sans-serif",
  marginBottom: 8,
};

const selectStyle = {
  width: "100%",
  background: "#1a1a1a",
  border: "1px solid #333",
  borderRadius: 8,
  color: "#f0f0f0",
  fontSize: 16,
  padding: "12px 14px",
  fontFamily: "DM Sans, sans-serif",
  marginTop: 6,
};

const reportAnotherBtn = {
  marginTop: 8,
  padding: "14px 32px",
  borderRadius: 10,
  border: "2px solid #e07b39",
  background: "transparent",
  color: "#e07b39",
  fontFamily: "Barlow Condensed, sans-serif",
  fontSize: 16,
  letterSpacing: 1,
  cursor: "pointer",
};
