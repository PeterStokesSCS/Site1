import { useState, useEffect } from "react";
import BackHeader from "./BackHeader";
import { EmptyState, Skeleton } from "./LoadingScreen";
import { HEALTH } from "../../lib/theme";
import { getMilestones, getDailyLogs, getHazardsByProject, getIssues, getVariations, updateProject } from "../../lib/db";
import { geocodeAddress } from "../../lib/geocode";
import { supabase } from "../../lib/supabase";

// Builder/Supervisor prompt to geocode a project's address so photos verify on-site
function SetSiteLocation({ project }) {
  const [state, setState] = useState(project.lat != null ? "set" : "idle"); // idle | working | set | fail
  if (state === "set") return null;
  const run = async () => {
    setState("working");
    const coords = await geocodeAddress([project.street, project.suburb].filter(Boolean).join(", "));
    if (coords) { await updateProject(project.id, coords); setState("set"); }
    else setState("fail");
  };
  return (
    <div style={{ background: "#0c1a33", border: "1px solid #3b82f644", borderRadius: 12, padding: "12px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: 20 }}>📍</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: "#ccc" }}>Site location not set</div>
        <div style={{ fontSize: 11, color: "#555" }}>{state === "fail" ? "Couldn't find the address — check it's correct" : "Enables on-site photo verification"}</div>
      </div>
      <button onClick={run} disabled={state === "working"} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#3b82f6", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, cursor: "pointer", flexShrink: 0 }}>
        {state === "working" ? "LOCATING…" : "SET FROM ADDRESS"}
      </button>
    </div>
  );
}

const TODAY = new Date().toISOString().slice(0, 10);

function Section({ title, children, action }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 12, color: "#555", textTransform: "uppercase", letterSpacing: 0.5 }}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function OverviewScreen({ project, user, onBack, onNav }) {
  const [data, setData] = useState(null);
  const health = HEALTH[project.health] || HEALTH.green;

  useEffect(() => {
    Promise.all([
      getMilestones(project.id),
      getDailyLogs(project.id),
      getHazardsByProject(project.id),
      getIssues(project.id),
      getVariations(project.id),
      supabase.from("timesheets").select("id").eq("project_id", project.id).is("clock_out", null),
      supabase.from("site_visits").select("id").eq("project_id", project.id).is("sign_out", null),
    ]).then(([ms, dl, hz, iss, vr, ts, sv]) => {
      const hazards = hz.data;
      const issues = iss.data;
      const variations = vr.data;
      setData({
        milestones: ms.data,
        latestLog: dl.data[0] || null,
        onSite: (ts.data?.length || 0) + (sv.data?.length || 0),
        hazardsOpen: hazards.filter(h => h.status === "open").length,
        highHazards: hazards.filter(h => h.status === "open" && h.risk === "high").length,
        issuesOpen: issues.filter(i => i.status === "open").length,
        priorityIssues: issues.filter(i => i.status === "open" && (i.priority === "critical" || i.priority === "high")),
        pendingVars: variations.filter(v => v.status === "pending").length,
      });
    });
  }, [project.id]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title="Overview" subtitle={project.street} onBack={onBack}
        rightSlot={<span style={{ fontSize: 10, fontFamily: "Barlow Condensed, sans-serif", color: health.color, background: health.bg, border: `1px solid ${health.border}`, padding: "4px 10px", borderRadius: 12, whiteSpace: "nowrap" }}>● {health.label}</span>}
      />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {!data ? (
          <>
            <Skeleton width="100%" height={70} style={{ marginBottom: 14, borderRadius: 12 }} />
            <Skeleton width="100%" height={90} style={{ marginBottom: 14, borderRadius: 12 }} />
            <Skeleton width="100%" height={120} style={{ borderRadius: 12 }} />
          </>
        ) : (
          <>
            {(user?.role === "builder" || user?.role === "supervisor") && <SetSiteLocation project={project} />}
            {/* Stage + progress */}
            <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 12, padding: "16px", marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, fontWeight: 700, color: "#f0f0f0" }}>{project.phase || "—"}</div>
                <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, color: "#e07b39" }}>{project.progress || 0}%</div>
              </div>
              <div style={{ height: 8, background: "#222", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${project.progress || 0}%`, background: "#e07b39", borderRadius: 4 }} />
              </div>
            </div>

            {/* Live counts */}
            <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
              {[
                { label: "On Site", value: data.onSite,      color: "#0ea5e9", key: "attendance" },
                { label: "Hazards", value: data.hazardsOpen, color: data.highHazards ? "#ef4444" : "#888", key: "safety" },
                { label: "Issues",  value: data.issuesOpen,  color: data.priorityIssues.length ? "#f97316" : "#888", key: "issues" },
              ].map(s => (
                <button key={s.key} onClick={() => onNav(s.key)} style={{ flex: 1, background: "#141414", border: "1px solid #1e1e1e", borderRadius: 12, padding: "14px 6px", textAlign: "center", cursor: "pointer" }}>
                  <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 30, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>{s.label}</div>
                </button>
              ))}
            </div>

            {/* Milestones */}
            {data.milestones.length > 0 && (
              <Section title="Milestones">
                <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 12, padding: "12px 16px" }}>
                  {data.milestones.map(m => (
                    <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "7px 0", borderBottom: "1px solid #1a1a1a" }}>
                      <span style={{ color: m.done ? "#e07b39" : "#333", fontSize: 15, flexShrink: 0 }}>{m.done ? "✓" : "○"}</span>
                      <span style={{ fontSize: 14, color: m.done ? "#ccc" : "#555", flex: 1 }}>{m.name}</span>
                      {m.done && m.completed_date && <span style={{ fontSize: 11, color: "#555" }}>{new Date(m.completed_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</span>}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Latest daily log */}
            <Section title="Latest Daily Log" action={<button onClick={() => onNav("dailyLog")} style={linkBtn}>View all →</button>}>
              {data.latestLog ? (
                <div onClick={() => onNav("dailyLog")} style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 12, padding: "14px 16px", cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, color: "#ccc" }}>{new Date(data.latestLog.log_date).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "short" })}</span>
                    <span style={{ fontSize: 11, color: "#555" }}>{data.latestLog.weather} · {data.latestLog.workers_on_site} workers</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#888", lineHeight: 1.5 }}>{data.latestLog.progress_notes}</div>
                </div>
              ) : (
                <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 12, padding: "14px 16px", fontSize: 13, color: "#555" }}>No daily logs yet</div>
              )}
            </Section>

            {/* Needs attention */}
            <Section title="Needs Attention">
              {(data.highHazards === 0 && data.pendingVars === 0 && data.priorityIssues.length === 0) ? (
                <div style={{ background: "#0d1a0d", border: "1px solid #166534", borderRadius: 12, padding: "14px 16px", color: "#22c55e", fontSize: 14, fontFamily: "Barlow Condensed, sans-serif" }}>
                  ✓ Nothing urgent on this project
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {data.highHazards > 0 && (
                    <button onClick={() => onNav("safety")} style={attnRow("#ef4444", "#2a0c0c")}>
                      <span>⚠ {data.highHazards} high-risk hazard{data.highHazards > 1 ? "s" : ""} open</span><span style={{ color: "#555" }}>›</span>
                    </button>
                  )}
                  {data.pendingVars > 0 && (
                    <button onClick={() => onNav("variations")} style={attnRow("#6366f1", "#10103a")}>
                      <span>± {data.pendingVars} variation{data.pendingVars > 1 ? "s" : ""} awaiting approval</span><span style={{ color: "#555" }}>›</span>
                    </button>
                  )}
                  {data.priorityIssues.map(i => (
                    <button key={i.id} onClick={() => onNav("issues")} style={attnRow("#f97316", "#251200")}>
                      <span>⚡ {i.title}</span><span style={{ color: "#555" }}>›</span>
                    </button>
                  ))}
                </div>
              )}
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

const linkBtn = { background: "none", border: "none", color: "#e07b39", fontSize: 13, cursor: "pointer", padding: 0 };
const attnRow = (color, bg) => ({
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
  width: "100%", textAlign: "left", background: bg, border: `1px solid ${color}44`,
  borderRadius: 10, padding: "12px 14px", color, fontSize: 13, cursor: "pointer",
  fontFamily: "DM Sans, sans-serif",
});
