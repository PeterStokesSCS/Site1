import { useState, useEffect } from "react";
import BackHeader from "./BackHeader";
import { EmptyState } from "./LoadingScreen";
import { useFocusRow, FOCUS_HL } from "./useFocusRow";
import { getMilestones, updateMilestone, recordForecastChange, getVariations, updateVariation } from "../../lib/db";
import { milestoneStatus, milestoneVariance, eotAffectedMilestones, addDays } from "../../lib/timeline";

const STATUS_STYLE = {
  complete: { c: "#22c55e", bg: "#06200e", label: "Complete" },
  at_risk:  { c: "#ef4444", bg: "#2a0c0c", label: "At risk" },
  upcoming: { c: "#888888", bg: "#1a1a1a", label: "Upcoming" },
};
const fmt = (d) => d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "—";
const dateInput = { background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 6, color: "#f0f0f0", fontSize: 12, padding: "5px 7px", fontFamily: "DM Sans, sans-serif", colorScheme: "dark" };

export default function TimelineScreen({ project, user, onBack, focusId }) {
  const [milestones, setMilestones] = useState(null);
  const [eotVars, setEotVars] = useState([]);
  const [apply, setApply] = useState(null); // { variation, fromMilestoneId, cascade }
  const [busy, setBusy] = useState(false);
  const canEdit = user?.role === "builder" || user?.role === "office";

  const load = () => {
    getMilestones(project.id).then(({ data }) => setMilestones(data));
    getVariations(project.id).then(({ data }) =>
      setEotVars((data || []).filter(v => v.status === "approved" && v.eot && Number(v.eot_days) > 0 && !v.applied_to_forecast)));
  };
  useEffect(() => { load(); }, [project.id]);
  const { rowRef, highlightId } = useFocusRow(focusId, milestones !== null);

  const savePlanned = async (m, val) => {
    setMilestones(prev => prev.map(x => x.id === m.id ? { ...x, planned_date: val, forecast_date: x.forecast_date || val } : x));
    await updateMilestone(m.id, { planned_date: val || null, forecast_date: m.forecast_date || val || null });
  };
  const saveForecast = async (m, val) => {
    setMilestones(prev => prev.map(x => x.id === m.id ? { ...x, forecast_date: val } : x));
    await updateMilestone(m.id, { forecast_date: val || null });
  };
  const toggleComplete = async (m) => {
    const done = !m.done;
    const completed_date = done ? new Date().toISOString().slice(0, 10) : null;
    setMilestones(prev => prev.map(x => x.id === m.id ? { ...x, done, completed_date } : x));
    await updateMilestone(m.id, { done, completed_date });
  };

  const confirmApply = async () => {
    if (!apply) return;
    setBusy(true);
    const v = apply.variation;
    const n = Number(v.eot_days);
    const affected = eotAffectedMilestones(milestones, apply.fromMilestoneId, apply.cascade);
    for (const m of affected) {
      const base = m.forecast_date || m.planned_date;
      if (base) await updateMilestone(m.id, { forecast_date: addDays(base, n) });
    }
    await updateVariation(v.id, { applied_to_forecast: true });
    await recordForecastChange({ project_id: project.id, milestone_id: apply.fromMilestoneId, source: "variation_eot", source_id: v.id, days: n, reason: `EOT from ${v.ref || "variation"}`, confirmed_by: user.id });
    setBusy(false); setApply(null); load();
  };

  const lastForecast = (milestones || []).reduce((acc, m) => {
    const d = m.forecast_date || m.planned_date;
    return d && (!acc || d > acc) ? d : acc;
  }, null);
  const atRisk = (milestones || []).filter(m => milestoneStatus(m) === "at_risk");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Project Timeline" subtitle={project.street} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {milestones === null ? [1, 2, 3].map(i => <div key={i} style={{ height: 56, background: "#141414", borderRadius: 10, marginBottom: 8 }} />)
          : milestones.length === 0 ? <EmptyState icon="📅" title="No milestones" subtitle="Stage milestones seed automatically on new projects" />
          : (
            <>
              {/* Forecast completion + at-risk summary */}
              <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                <div style={{ flex: 1, background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 0.4, fontFamily: "Barlow Condensed, sans-serif" }}>Forecast completion</div>
                  <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 18, color: "#e07b39", marginTop: 2 }}>{fmt(lastForecast)}</div>
                </div>
                <div style={{ flex: 1, background: atRisk.length ? "#2a0c0c" : "#141414", border: `1px solid ${atRisk.length ? "#ef444444" : "#1e1e1e"}`, borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 0.4, fontFamily: "Barlow Condensed, sans-serif" }}>At risk</div>
                  <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 18, color: atRisk.length ? "#ef4444" : "#22c55e", marginTop: 2 }}>{atRisk.length} stage{atRisk.length === 1 ? "" : "s"}</div>
                </div>
              </div>

              {/* EOT apply prompts (forecast logic) */}
              {canEdit && eotVars.map(v => (
                <div key={v.id} style={{ background: "#10103a", border: "1px solid #6366f155", borderRadius: 10, padding: "12px 14px", marginBottom: 10 }}>
                  <div style={{ fontSize: 13, color: "#a5b4fc" }}>⏱ {v.ref || "Variation"} approved with a <b>{v.eot_days}-day</b> extension of time — not yet applied to the timeline.</div>
                  {apply?.variation?.id === v.id ? (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>Apply the {v.eot_days} days from which stage?</div>
                      <select value={apply.fromMilestoneId} onChange={e => setApply(a => ({ ...a, fromMilestoneId: e.target.value }))} style={{ ...dateInput, width: "100%", marginBottom: 8 }}>
                        {milestones.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                      <button onClick={() => setApply(a => ({ ...a, cascade: !a.cascade }))} style={{ display: "flex", alignItems: "center", gap: 7, background: "transparent", border: "none", cursor: "pointer", padding: "0 0 10px" }}>
                        <div style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${apply.cascade ? "#22c55e" : "#444"}`, background: apply.cascade ? "#22c55e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>{apply.cascade && <span style={{ color: "#000", fontSize: 10, fontWeight: 700 }}>✓</span>}</div>
                        <span style={{ fontSize: 12, color: "#aaa" }}>Push all later stages too (delays cascade)</span>
                      </button>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={confirmApply} disabled={busy} style={{ flex: 1, padding: "9px", borderRadius: 8, border: "none", background: "#22c55e", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer" }}>{busy ? "APPLYING…" : `ADD ${v.eot_days} DAYS`}</button>
                        <button onClick={() => setApply(null)} style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #333", background: "transparent", color: "#888", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer" }}>CANCEL</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setApply({ variation: v, fromMilestoneId: milestones[0]?.id, cascade: true })} style={{ marginTop: 8, padding: "8px 14px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer" }}>Apply to timeline</button>
                  )}
                </div>
              ))}

              {/* Milestone list */}
              {milestones.map(m => {
                const st = STATUS_STYLE[milestoneStatus(m)];
                const variance = milestoneVariance(m);
                return (
                  <div key={m.id} ref={rowRef(m.id)} style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "12px 14px", marginBottom: 8, ...(highlightId === m.id ? FOCUS_HL : null) }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: canEdit ? 10 : 4 }}>
                      <div style={{ fontSize: 14, color: "#e8e8e8" }}>{m.name}</div>
                      <span style={{ fontSize: 10, fontFamily: "Barlow Condensed, sans-serif", color: st.c, background: st.bg, padding: "2px 8px", borderRadius: 4, textTransform: "uppercase" }}>{st.label}</span>
                    </div>
                    {canEdit ? (
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                        <label style={{ fontSize: 10, color: "#666" }}>Planned<br /><input type="date" value={m.planned_date || ""} onChange={e => savePlanned(m, e.target.value)} style={dateInput} /></label>
                        <label style={{ fontSize: 10, color: "#666" }}>Forecast<br /><input type="date" value={m.forecast_date || ""} onChange={e => saveForecast(m, e.target.value)} style={dateInput} /></label>
                        {variance != null && variance !== 0 && <span style={{ fontSize: 11, color: variance > 0 ? "#ef4444" : "#22c55e", paddingBottom: 6 }}>{variance > 0 ? `+${variance}d` : `${variance}d`}</span>}
                        <button onClick={() => toggleComplete(m)} style={{ marginLeft: "auto", padding: "6px 11px", borderRadius: 7, border: `1px solid ${m.done ? "#22c55e" : "#2a2a2a"}`, background: "transparent", color: m.done ? "#22c55e" : "#888", fontFamily: "Barlow Condensed, sans-serif", fontSize: 11, cursor: "pointer" }}>{m.done ? "✓ Complete" : "Mark complete"}</button>
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: "#777" }}>Planned {fmt(m.planned_date)} · Forecast {fmt(m.forecast_date)}{variance > 0 ? ` · +${variance}d` : ""}{m.completed_date ? ` · done ${fmt(m.completed_date)}` : ""}</div>
                    )}
                  </div>
                );
              })}
            </>
          )}
      </div>
    </div>
  );
}
