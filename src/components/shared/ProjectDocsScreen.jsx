import { useState, useEffect } from "react";
import BackHeader from "./BackHeader";
import { EmptyState } from "./LoadingScreen";
import FileUploadButton from "./FileUploadButton";
import { getDocuments, createDocument, setDocumentSuperseded } from "../../lib/db";

const CATEGORIES = ["Architectural", "Engineering", "Permits", "Specifications", "Energy Reports", "Contracts", "Other"];

export default function ProjectDocsScreen({ project, user, onBack }) {
  const [docs, setDocs] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", category: "Architectural", version: "", file_url: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const load = () => getDocuments(project.id).then(({ data }) => setDocs(data));
  useEffect(() => { load(); }, [project.id]);

  const save = async () => {
    if (!form.name.trim() || !form.file_url) { setErr("Add a name and a file."); return; }
    setSaving(true); setErr(null);
    const { data, error } = await createDocument({
      project_id: project.id, name: form.name.trim(), category: form.category,
      version: form.version.trim() || null, file_url: form.file_url, superseded: false, uploaded_by: user.id,
    });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setDocs(prev => [data, ...(prev || [])]);
    setForm({ name: "", category: "Architectural", version: "", file_url: "" });
    setShowForm(false);
  };

  const toggleSuperseded = async (doc) => {
    setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, superseded: !d.superseded } : d));
    await setDocumentSuperseded(doc.id, !doc.superseded);
  };

  const categories = docs ? [...new Set(docs.map(d => d.category).filter(Boolean))] : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Project Docs" subtitle={project.street} onBack={onBack}
        rightSlot={<button onClick={() => setShowForm(s => !s)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: showForm ? "#333" : "#3b82f6", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer" }}>{showForm ? "CANCEL" : "+ UPLOAD"}</button>}
      />
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
        {showForm && (
          <div style={{ background: "#141414", border: "1px solid #2a2a2a", borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Document name *" style={{ ...inp, marginBottom: 10 }} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setForm(f => ({ ...f, category: c }))} style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${form.category === c ? "#3b82f6" : "#2a2a2a"}`, background: form.category === c ? "#0c1a33" : "transparent", color: form.category === c ? "#3b82f6" : "#666", fontSize: 12, cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif" }}>{c}</button>
              ))}
            </div>
            <input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} placeholder="Version / revision (e.g. Rev C)" style={{ ...inp, marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
              <FileUploadButton folder={`docs/${project.id}`} accept="application/pdf,image/*" label="📎 Choose file" onUploaded={(url) => { setForm(f => ({ ...f, file_url: url })); setErr(null); }} />
              {form.file_url && <span style={{ fontSize: 12, color: "#22c55e" }}>✓ file ready</span>}
            </div>
            {err && <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 10 }}>{err}</div>}
            <button onClick={save} disabled={saving} style={{ width: "100%", padding: "11px", borderRadius: 8, border: "none", background: "#3b82f6", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, cursor: "pointer" }}>{saving ? "SAVING..." : "SAVE DOCUMENT"}</button>
          </div>
        )}

        {err && !showForm && <div style={{ background: "#2a0c0c", border: "1px solid #ef444444", borderRadius: 8, padding: "10px 14px", color: "#ef4444", fontSize: 13, marginBottom: 10 }}>⚠ {err}</div>}

        {docs === null ? [1,2,3].map(i => <div key={i} style={{ height: 56, background: "#141414", borderRadius: 10, marginBottom: 8 }} />)
          : docs.length === 0 ? <EmptyState icon="📄" title="No documents yet" subtitle="Upload plans, permits, engineering, specs…" />
          : categories.map(cat => {
            const list = docs.filter(d => d.category === cat).sort((a, b) => (a.superseded === b.superseded ? 0 : a.superseded ? 1 : -1));
            return (
              <div key={cat} style={{ marginBottom: 20 }}>
                <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>{cat}</div>
                {list.map(doc => (
                  <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, marginBottom: 6, opacity: doc.superseded ? 0.55 : 1 }}>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>📄</span>
                    <a href={doc.file_url} target="_blank" rel="noreferrer" style={{ flex: 1, textDecoration: "none", minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: "#ccc" }}>
                        {doc.name}
                        {doc.superseded && <span style={{ marginLeft: 8, fontSize: 10, color: "#ef4444", fontFamily: "Barlow Condensed, sans-serif" }}>SUPERSEDED</span>}
                        {!doc.superseded && <span style={{ marginLeft: 8, fontSize: 10, color: "#22c55e", fontFamily: "Barlow Condensed, sans-serif" }}>CURRENT</span>}
                      </div>
                      <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{[doc.version, new Date(doc.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })].filter(Boolean).join(" · ")}</div>
                    </a>
                    <button onClick={() => toggleSuperseded(doc)} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #2a2a2a", background: "transparent", color: "#888", fontFamily: "Barlow Condensed, sans-serif", fontSize: 11, cursor: "pointer", flexShrink: 0 }}>{doc.superseded ? "MAKE CURRENT" : "SUPERSEDE"}</button>
                  </div>
                ))}
              </div>
            );
          })}
      </div>
    </div>
  );
}

const inp = { width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#f0f0f0", fontSize: 14, padding: "10px 12px", fontFamily: "DM Sans, sans-serif", boxSizing: "border-box" };
