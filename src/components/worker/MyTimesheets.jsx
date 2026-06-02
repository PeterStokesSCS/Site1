import { useState } from "react";
import { mockTimesheets, mockProjects } from "../../data/mockData";
import { post, enqueue } from "../../lib/webhook";
import { useOfflineQueue } from "../../hooks/useOfflineQueue";

const STATUS_COLOR = { approved: "#27ae60", pending: "#e07b39" };
const STATUS_BG = { approved: "#0f2a0f", pending: "#2a1800" };

function weekEnding() {
  const d = new Date();
  const day = d.getDay();
  const diff = (day === 0 ? 0 : 7 - day);
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

const BLANK = { projectId: mockProjects[0].id, weekEnding: weekEnding(), hours: "", notes: "" };

export default function MyTimesheets({ worker }) {
  const { isOnline, refreshPending } = useOfflineQueue();
  const [history] = useState(mockTimesheets.filter((t) => t.workerId === worker.id));
  const [form, setForm] = useState(BLANK);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.hours && parseFloat(form.hours) > 0 && parseFloat(form.hours) <= 80;

  const submit = async () => {
    if (!valid) return;
    setSubmitting(true);
    const proj = mockProjects.find(p => p.id === form.projectId);
    const payload = {
      workerId: worker.id,
      workerName: worker.name,
      projectId: form.projectId,
      projectName: proj?.name || "",
      weekEnding: form.weekEnding,
      hours: parseFloat(form.hours),
      notes: form.notes,
      submittedAt: new Date().toISOString(),
    };
    try {
      await post("/timesheets", payload);
    } catch {
      enqueue("/timesheets", payload);
      refreshPending();
    }
    setSubmitting(false);
    setSubmitted(true);
    setShowForm(false);
  };

  return (
    <div>
      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 26, fontWeight: 700, color: "#f0f0f0", marginBottom: 4 }}>
        MY TIMESHEETS
      </div>

      <button
        onClick={() => { setShowForm(!showForm); setSubmitted(false); setForm(BLANK); }}
        style={{
          marginBottom: 20,
          padding: "12px 20px",
          borderRadius: 10,
          border: "none",
          background: showForm ? "#222" : "#e07b39",
          color: showForm ? "#888" : "#fff",
          fontFamily: "Barlow Condensed, sans-serif",
          fontSize: 16,
          letterSpacing: 0.5,
          cursor: "pointer",
          width: "100%",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {showForm ? "CANCEL" : "+ SUBMIT THIS WEEK'S HOURS"}
      </button>

      {submitted && !showForm && (
        <div style={{
          marginBottom: 16,
          background: "#0f2a0f",
          border: "1px solid #27ae60",
          borderRadius: 10,
          padding: "14px 16px",
          color: "#27ae60",
          fontFamily: "Barlow Condensed, sans-serif",
          fontSize: 16,
        }}>
          ✓ Timesheet submitted {isOnline ? "" : "(queued for sync)"}
        </div>
      )}

      {showForm && (
        <div style={{ background: "#141414", border: "1px solid #222", borderRadius: 12, padding: "18px 16px", marginBottom: 20 }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 18, color: "#e07b39", marginBottom: 16 }}>NEW TIMESHEET</div>

          <div style={{ marginBottom: 14 }}>
            <div style={lbl}>Project</div>
            <select value={form.projectId} onChange={e => set("projectId", e.target.value)} style={inp}>
              {mockProjects.filter(p => p.status === "active").map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={lbl}>Week Ending</div>
            <input type="date" value={form.weekEnding} onChange={e => set("weekEnding", e.target.value)} style={inp} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={lbl}>Hours Worked</div>
            <input
              type="number"
              min="0.5"
              max="80"
              step="0.5"
              value={form.hours}
              onChange={e => set("hours", e.target.value)}
              placeholder="e.g. 38.5"
              style={inp}
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={lbl}>Notes (optional)</div>
            <textarea
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
              placeholder="Any notes for payroll..."
              rows={3}
              style={{ ...inp, resize: "vertical" }}
            />
          </div>

          <button
            onClick={submit}
            disabled={!valid || submitting}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: 10,
              border: "none",
              background: valid ? "#e07b39" : "#222",
              color: valid ? "#fff" : "#555",
              fontFamily: "Barlow Condensed, sans-serif",
              fontSize: 18,
              letterSpacing: 0.5,
              cursor: valid ? "pointer" : "not-allowed",
            }}
          >
            {submitting ? "SUBMITTING..." : "SUBMIT TIMESHEET"}
          </button>
        </div>
      )}

      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, color: "#555", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 }}>
        History
      </div>

      {history.length === 0 && (
        <div style={{ color: "#555", textAlign: "center", padding: "30px 0", fontSize: 14 }}>No timesheet history</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {history.map((ts) => (
          <div key={ts.id} style={{
            background: "#141414",
            border: "1px solid #222",
            borderRadius: 10,
            padding: "14px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#f0f0f0" }}>{ts.projectName}</div>
              <div style={{ fontSize: 13, color: "#666", marginTop: 3 }}>
                Week ending {new Date(ts.weekEnding).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, color: "#e07b39", fontWeight: 700 }}>
                {ts.hours}h
              </div>
              <div style={{
                marginTop: 4,
                fontSize: 11,
                fontFamily: "Barlow Condensed, sans-serif",
                letterSpacing: 0.5,
                textTransform: "uppercase",
                color: STATUS_COLOR[ts.status],
                background: STATUS_BG[ts.status],
                padding: "2px 8px",
                borderRadius: 4,
              }}>
                {ts.status}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const lbl = {
  fontSize: 12,
  color: "#666",
  textTransform: "uppercase",
  letterSpacing: 0.5,
  fontFamily: "Barlow Condensed, sans-serif",
  marginBottom: 6,
};

const inp = {
  width: "100%",
  background: "#1a1a1a",
  border: "1px solid #333",
  borderRadius: 8,
  color: "#f0f0f0",
  fontSize: 16,
  padding: "12px 14px",
  fontFamily: "DM Sans, sans-serif",
  boxSizing: "border-box",
};
