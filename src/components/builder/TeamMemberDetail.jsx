import { useState, useEffect } from "react";
import BackHeader from "../shared/BackHeader";
import { updateProfile, getProfileCredentials, addProfileCredential, deleteProfileCredential, getWorkerApprovedHours } from "../../lib/db";

const inp = { width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#f0f0f0", fontSize: 14, padding: "9px 11px", fontFamily: "DM Sans, sans-serif", boxSizing: "border-box", colorScheme: "dark" };
const lbl = { fontSize: 10, color: "#777", textTransform: "uppercase", letterSpacing: 0.4, fontFamily: "Barlow Condensed, sans-serif", marginBottom: 4, display: "block" };
const card = { background: "#141414", border: "1px solid #1e1e1e", borderRadius: 12, padding: 14, marginBottom: 14 };
const head = { fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 };
const today = new Date().toISOString().slice(0, 10);
const in30 = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10); })();
const credStatus = (c) => !c.expiry_date ? null : c.expiry_date < today ? { label: "EXPIRED", color: "#ef4444" } : c.expiry_date <= in30 ? { label: "EXPIRING", color: "#f59e0b" } : { label: "VALID", color: "#22c55e" };
const fmt = (d) => d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "—";

export default function TeamMemberDetail({ profile, projects, members, onBack, onUpdated }) {
  const [f, setF] = useState({ phone: profile.phone || "", company: profile.company || "", address: profile.address || "", emergency_contact_name: profile.emergency_contact_name || "", emergency_contact_phone: profile.emergency_contact_phone || "", emergency_contact_relationship: profile.emergency_contact_relationship || "" });
  const [saved, setSaved] = useState(false);
  const [creds, setCreds] = useState(null);
  const [credForm, setCredForm] = useState({ type: "Licence", name: "", number: "", issued_date: "", expiry_date: "" });
  const [hours, setHours] = useState(null);

  useEffect(() => {
    getProfileCredentials(profile.id).then(({ data }) => setCreds(data));
    getWorkerApprovedHours(profile.id).then(setHours);
  }, [profile.id]);

  const assignedProjects = (members || []).filter(m => m.user_id === profile.id).map(m => projects.find(p => p.id === m.project_id)).filter(Boolean);

  const saveContact = async () => {
    await updateProfile(profile.id, f);
    onUpdated?.({ ...profile, ...f });
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  };
  const addCred = async () => {
    if (!credForm.name.trim()) return;
    const { data } = await addProfileCredential({ profile_id: profile.id, type: credForm.type, name: credForm.name.trim(), number: credForm.number.trim() || null, issued_date: credForm.issued_date || null, expiry_date: credForm.expiry_date || null });
    if (data) setCreds(prev => [...(prev || []), data]);
    setCredForm({ type: "Licence", name: "", number: "", issued_date: "", expiry_date: "" });
  };
  const delCred = async (id) => { setCreds(prev => prev.filter(c => c.id !== id)); await deleteProfileCredential(id); };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title={profile.full_name || "Team member"} subtitle={profile.role || "—"} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px", maxWidth: 560, margin: "0 auto", width: "100%" }}>

        {/* Contact */}
        <div style={card}>
          <div style={head}>Contact</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}><label style={lbl}>Phone</label><input value={f.phone} onChange={e => setF(s => ({ ...s, phone: e.target.value }))} style={inp} /></div>
            <div style={{ flex: 1 }}><label style={lbl}>Company</label><input value={f.company} onChange={e => setF(s => ({ ...s, company: e.target.value }))} style={inp} /></div>
          </div>
          <label style={lbl}>Address</label>
          <input value={f.address} onChange={e => setF(s => ({ ...s, address: e.target.value }))} style={{ ...inp, marginBottom: 10 }} />
          <div style={head}>Emergency contact</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}><label style={lbl}>Name</label><input value={f.emergency_contact_name} onChange={e => setF(s => ({ ...s, emergency_contact_name: e.target.value }))} style={inp} /></div>
            <div style={{ flex: 1 }}><label style={lbl}>Phone</label><input value={f.emergency_contact_phone} onChange={e => setF(s => ({ ...s, emergency_contact_phone: e.target.value }))} style={inp} /></div>
          </div>
          <label style={lbl}>Relationship</label>
          <input value={f.emergency_contact_relationship} onChange={e => setF(s => ({ ...s, emergency_contact_relationship: e.target.value }))} style={{ ...inp, marginBottom: 12 }} />
          <button onClick={saveContact} style={{ width: "100%", padding: "10px", borderRadius: 8, border: "none", background: saved ? "#22c55e" : "#e07b39", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, cursor: "pointer" }}>{saved ? "SAVED ✓" : "SAVE DETAILS"}</button>
        </div>

        {/* Licences / certs */}
        <div style={card}>
          <div style={head}>Licences, certificates & qualifications</div>
          {creds === null ? <div style={{ height: 40, background: "#1a1a1a", borderRadius: 8 }} />
            : creds.length === 0 ? <div style={{ fontSize: 12, color: "#555", marginBottom: 12 }}>None recorded yet.</div>
            : creds.map(c => {
              const st = credStatus(c);
              return (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid #1a1a1a" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: "#ccc" }}>{c.name}{c.number ? <span style={{ color: "#555" }}> · {c.number}</span> : ""}</div>
                    <div style={{ fontSize: 11, color: "#555" }}>{c.type}{c.expiry_date ? ` · expires ${fmt(c.expiry_date)}` : ""}</div>
                  </div>
                  {st && <span style={{ fontSize: 9, fontFamily: "Barlow Condensed, sans-serif", color: st.color, padding: "2px 7px", borderRadius: 4, border: `1px solid ${st.color}55` }}>{st.label}</span>}
                  <button onClick={() => delCred(c.id)} style={{ background: "transparent", border: "none", color: "#ef4444", fontSize: 14, cursor: "pointer" }}>✕</button>
                </div>
              );
            })}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #1e1e1e" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <select value={credForm.type} onChange={e => setCredForm(s => ({ ...s, type: e.target.value }))} style={{ ...inp, width: 130 }}>
                {["Licence", "Certificate", "Qualification", "Insurance", "White Card"].map(t => <option key={t}>{t}</option>)}
              </select>
              <input value={credForm.name} onChange={e => setCredForm(s => ({ ...s, name: e.target.value }))} placeholder="e.g. Electrical licence" style={inp} />
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input value={credForm.number} onChange={e => setCredForm(s => ({ ...s, number: e.target.value }))} placeholder="Number (optional)" style={inp} />
              <div style={{ width: 150 }}><label style={lbl}>Expiry</label><input type="date" value={credForm.expiry_date} onChange={e => setCredForm(s => ({ ...s, expiry_date: e.target.value }))} style={inp} /></div>
            </div>
            <button onClick={addCred} disabled={!credForm.name.trim()} style={{ width: "100%", padding: "9px", borderRadius: 8, border: "1px solid #2a2a2a", background: "transparent", color: credForm.name.trim() ? "#e07b39" : "#444", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: credForm.name.trim() ? "pointer" : "not-allowed" }}>+ ADD CREDENTIAL</button>
          </div>
        </div>

        {/* History */}
        <div style={card}>
          <div style={head}>History</div>
          <div style={{ display: "flex", gap: 10, marginBottom: assignedProjects.length ? 12 : 0 }}>
            <div style={{ flex: 1, background: "#101010", borderRadius: 9, padding: "10px 12px" }}>
              <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, color: "#e07b39" }}>{assignedProjects.length}</div>
              <div style={{ fontSize: 11, color: "#666" }}>Projects</div>
            </div>
            <div style={{ flex: 1, background: "#101010", borderRadius: 9, padding: "10px 12px" }}>
              <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, color: "#0ea5e9" }}>{hours == null ? "—" : `${Math.round(hours)}h`}</div>
              <div style={{ fontSize: 11, color: "#666" }}>Approved hours</div>
            </div>
          </div>
          {assignedProjects.map(p => (
            <div key={p.id} style={{ fontSize: 13, color: "#999", padding: "5px 0", borderBottom: "1px solid #1a1a1a" }}>{p.job_number ? `${p.job_number} · ` : ""}{p.street}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
