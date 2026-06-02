import { useState } from "react";
import { mockHazards, mockProjects, HAZARD_CATEGORIES } from "../../data/mockData";
import { post } from "../../lib/webhook";

const RISK_COLOR = { high: "#c0392b", medium: "#e07b39", low: "#27ae60" };
const RISK_BG = { high: "#2a1010", medium: "#2a1800", low: "#0f2a0f" };

function RiskBadge({ level }) {
  return (
    <span style={{
      fontSize: 11, fontFamily: "Barlow Condensed, sans-serif", letterSpacing: 0.5,
      textTransform: "uppercase", color: RISK_COLOR[level], background: RISK_BG[level],
      padding: "3px 10px", borderRadius: 4, whiteSpace: "nowrap",
    }}>
      {level}
    </span>
  );
}

// ── Report Hazard Modal ───────────────────────────────────────────────────────
const BLANK = { title: "", projectId: mockProjects[0].id, riskLevel: "medium", category: "", control: "", description: "" };

function ReportModal({ onSave, onClose }) {
  const [form, setForm] = useState(BLANK);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.title.trim().length >= 3 && form.category && form.riskLevel;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#161616", border: "1px solid #2a2a2a", borderRadius: 14, width: "100%", maxWidth: 500, padding: 24, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, fontWeight: 700, color: "#f0f0f0", marginBottom: 20 }}>REPORT HAZARD</div>

        <div style={field}>
          <label style={lbl}>Title</label>
          <input value={form.title} onChange={e => set("title", e.target.value)} placeholder="Brief description of hazard" style={inp} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={field}>
            <label style={lbl}>Project</label>
            <select value={form.projectId} onChange={e => set("projectId", e.target.value)} style={inp}>
              {mockProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={field}>
            <label style={lbl}>Risk Level</label>
            <select value={form.riskLevel} onChange={e => set("riskLevel", e.target.value)} style={{ ...inp, color: RISK_COLOR[form.riskLevel] }}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        <div style={field}>
          <label style={lbl}>Category</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
            {HAZARD_CATEGORIES.map(c => (
              <button key={c} onClick={() => set("category", c)} style={{
                padding: "6px 12px", borderRadius: 6,
                border: `1px solid ${form.category === c ? "#e07b39" : "#2a2a2a"}`,
                background: form.category === c ? "#2a1800" : "#1a1a1a",
                color: form.category === c ? "#e07b39" : "#666",
                fontSize: 13, cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif",
                transition: "all 0.12s",
              }}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <div style={field}>
          <label style={lbl}>Control Measures</label>
          <textarea value={form.control} onChange={e => set("control", e.target.value)} placeholder="How is this hazard being controlled?" rows={3} style={{ ...inp, resize: "vertical" }} />
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "12px", borderRadius: 8, border: "1px solid #333", background: "transparent", color: "#888", cursor: "pointer", fontSize: 14 }}>Cancel</button>
          <button onClick={() => valid && onSave(form)} disabled={!valid} style={{
            flex: 2, padding: "12px", borderRadius: 8, border: "none",
            background: valid ? "#c0392b" : "#222", color: valid ? "#fff" : "#555",
            cursor: valid ? "pointer" : "not-allowed", fontFamily: "Barlow Condensed, sans-serif", fontSize: 16, letterSpacing: 0.5,
          }}>
            SUBMIT HAZARD REPORT
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Hazard card ───────────────────────────────────────────────────────────────
function HazardCard({ hazard, project, onResolve }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{
      background: "#141414", border: "1px solid #1e1e1e",
      borderLeft: `4px solid ${hazard.status === "resolved" ? "#333" : RISK_COLOR[hazard.riskLevel]}`,
      borderRadius: 10, overflow: "hidden",
    }}>
      <div style={{ padding: "14px 16px", cursor: "pointer" }} onClick={() => setExpanded(e => !e)}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: hazard.status === "resolved" ? "#555" : "#ccc", lineHeight: 1.3 }}>
              {hazard.title}
            </div>
            <div style={{ fontSize: 12, color: "#555", marginTop: 4, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span>{hazard.category}</span>
              <span>{project?.name}</span>
              <span>Reported by {hazard.reporter}</span>
              <span>{new Date(hazard.date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
            {hazard.status === "resolved"
              ? <span style={{ fontSize: 11, fontFamily: "Barlow Condensed, sans-serif", color: "#27ae60", background: "#0f2a0f", padding: "3px 8px", borderRadius: 4 }}>RESOLVED</span>
              : <RiskBadge level={hazard.riskLevel} />
            }
          </div>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: "1px solid #1a1a1a", padding: "12px 16px", background: "#111" }}>
          <div style={{ fontSize: 12, color: "#666", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Barlow Condensed, sans-serif", marginBottom: 6 }}>Control Measures</div>
          <div style={{ fontSize: 13, color: "#aaa", lineHeight: 1.6 }}>{hazard.control}</div>
          {hazard.status === "open" && (
            <button
              onClick={() => onResolve(hazard.id)}
              style={{
                marginTop: 14, padding: "10px 20px", borderRadius: 8, border: "1px solid #27ae60",
                background: "transparent", color: "#27ae60", fontFamily: "Barlow Condensed, sans-serif",
                fontSize: 14, letterSpacing: 0.5, cursor: "pointer", transition: "background 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#0f2a0f"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              ✓ MARK RESOLVED
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Safety main view ──────────────────────────────────────────────────────────
export default function Safety() {
  const [hazards, setHazards] = useState(mockHazards);
  const [showModal, setShowModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState("open");
  const [filterProject, setFilterProject] = useState("all");

  const openHigh = hazards.filter(h => h.status === "open" && h.riskLevel === "high").length;
  const openMed = hazards.filter(h => h.status === "open" && h.riskLevel === "medium").length;
  const openLow = hazards.filter(h => h.status === "open" && h.riskLevel === "low").length;
  const resolved = hazards.filter(h => h.status === "resolved").length;

  const filtered = hazards.filter(h => {
    if (filterStatus !== "all" && h.status !== filterStatus) return false;
    if (filterProject !== "all" && h.projectId !== filterProject) return false;
    return true;
  });

  const handleResolve = async (id) => {
    setHazards(prev => prev.map(h => h.id === id ? { ...h, status: "resolved" } : h));
    post("/hazards/resolve", { id }).catch(() => {});
  };

  const handleReport = async (form) => {
    const hazard = {
      ...form,
      id: `h${Date.now()}`,
      reporter: "Pete Stokes",
      date: new Date().toISOString().slice(0, 10),
      status: "open",
    };
    setHazards(prev => [hazard, ...prev]);
    setShowModal(false);
    post("/hazards", hazard).catch(() => {});
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 28, fontWeight: 700, color: "#f0f0f0" }}>SAFETY & COMPLIANCE</div>
        <button
          onClick={() => setShowModal(true)}
          style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#c0392b", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, letterSpacing: 0.5, cursor: "pointer" }}
        >
          + REPORT HAZARD
        </button>
      </div>

      {/* Summary stats */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
        {[
          { count: openHigh, label: "High Risk", color: "#c0392b", bg: "#2a1010" },
          { count: openMed, label: "Medium Risk", color: "#e07b39", bg: "#2a1800" },
          { count: openLow, label: "Low Risk", color: "#27ae60", bg: "#0f2a0f" },
          { count: resolved, label: "Resolved", color: "#555", bg: "#1a1a1a" },
        ].map(s => (
          <div key={s.label} style={{
            flex: "1 1 100px", background: s.bg, border: `1px solid ${s.color}44`,
            borderRadius: 10, padding: "12px 14px", textAlign: "center",
          }}>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 32, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.count}</div>
            <div style={{ fontSize: 11, color: s.color, marginTop: 4, opacity: 0.8 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {["open", "resolved", "all"].map(s => (
          <FilterChip key={s} label={s === "all" ? "All" : s} active={filterStatus === s} onClick={() => setFilterStatus(s)} />
        ))}
        <div style={{ width: 1, background: "#222", margin: "0 2px" }} />
        <FilterChip label="All Projects" active={filterProject === "all"} onClick={() => setFilterProject("all")} />
        {mockProjects.map(p => (
          <FilterChip key={p.id} label={p.name} active={filterProject === p.id} onClick={() => setFilterProject(p.id)} />
        ))}
      </div>

      {/* Hazard list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#555" }}>
            <div style={{ fontSize: 36 }}>✓</div>
            <div style={{ marginTop: 10, fontFamily: "Barlow Condensed, sans-serif", fontSize: 18 }}>No hazards in this view</div>
          </div>
        )}
        {filtered.map(h => (
          <HazardCard key={h.id} hazard={h} project={mockProjects.find(p => p.id === h.projectId)} onResolve={handleResolve} />
        ))}
      </div>

      {showModal && <ReportModal onSave={handleReport} onClose={() => setShowModal(false)} />}
    </div>
  );
}

function FilterChip({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 14px", borderRadius: 20,
      border: `1px solid ${active ? "#e07b39" : "#2a2a2a"}`,
      background: active ? "#2a1800" : "transparent",
      color: active ? "#e07b39" : "#666",
      fontSize: 13, fontFamily: "Barlow Condensed, sans-serif",
      letterSpacing: 0.3, textTransform: "capitalize", cursor: "pointer", transition: "all 0.15s",
    }}>
      {label}
    </button>
  );
}

const field = { marginBottom: 14 };
const lbl = { display: "block", fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Barlow Condensed, sans-serif", marginBottom: 6 };
const inp = { width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#f0f0f0", fontSize: 14, padding: "10px 12px", fontFamily: "DM Sans, sans-serif", boxSizing: "border-box" };
