import { useState, useEffect } from "react";
import ProjectHeader from "../shared/ProjectHeader";
import ProjectDashboard from "../shared/ProjectDashboard";
import { Skeleton } from "../shared/LoadingScreen";
import {
  getProjects, getTasksByProject, getIssues, getHazardsByProject,
  getTodayClockIn, clockIn, clockOut,
} from "../../lib/db";
import { supabase } from "../../lib/supabase";

const TODAY = new Date().toISOString().slice(0, 10);
const LAST_PROJECT_KEY = "scs_sup_last_project";

// H6 — live on-site indicator + tap-to-clock in/out for the supervisor
function OnSiteIndicator({ user, project }) {
  const [ts, setTs] = useState(undefined); // undefined=loading, null=off, row=on
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  const load = () => getTodayClockIn(user.id).then(row => setTs(row || null));
  useEffect(() => { load(); }, [user.id]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  if (ts === undefined) return null;

  const onThis  = ts && ts.project_id === project.id;
  const onOther = ts && ts.project_id !== project.id;

  const fmt = () => {
    const ms = onThis ? now - new Date(ts.clock_in).getTime() : 0;
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    if (onThis) {
      if (window.confirm("Clock OUT of this site?")) { await clockOut(user.id); await load(); }
    } else if (onOther) {
      if (window.confirm("You're clocked in on another job. Clock out there and clock in here?")) {
        await clockOut(user.id); await clockIn(user.id, project.id); await load();
      }
    } else {
      await clockIn(user.id, project.id); await load();
    }
    setBusy(false);
  };

  const colors = onThis
    ? { fg: "#22c55e", bg: "#06200e", bd: "#166534", label: "ON SITE", extra: fmt() }
    : onOther
      ? { fg: "#f59e0b", bg: "#251d00", bd: "#92400e", label: "OTHER SITE", extra: "tap" }
      : { fg: "#ef4444", bg: "#2a0c0c", bd: "#7f1d1d", label: "OFF SITE", extra: "tap in" };

  return (
    <button onClick={toggle} disabled={busy} style={{
      display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 14,
      background: colors.bg, border: `1px solid ${colors.bd}`, color: colors.fg,
      fontFamily: "Barlow Condensed, sans-serif", fontSize: 12, letterSpacing: 0.5, cursor: "pointer",
      WebkitTapHighlightColor: "transparent", whiteSpace: "nowrap",
    }}>
      <span style={{ fontSize: 8 }}>●</span>
      {colors.label}
      <span style={{ opacity: 0.85, fontVariantNumeric: "tabular-nums" }}>{colors.extra}</span>
    </button>
  );
}

export default function SupervisorApp({ user }) {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectIdRaw] = useState(null);
  const [stats, setStats] = useState({ onSite: 0, tasks: 0, issues: 0, hazards: 0 });
  const [loading, setLoading] = useState(true);

  // Persist the last viewed project so the app reopens where the supervisor left off
  const setProjectId = (id) => {
    setProjectIdRaw(id);
    try { localStorage.setItem(LAST_PROJECT_KEY, id); } catch { /* ignore */ }
  };

  useEffect(() => {
    getProjects().then(({ data }) => {
      setProjects(data);
      if (data.length > 0) {
        let saved = null;
        try { saved = localStorage.getItem(LAST_PROJECT_KEY); } catch { /* ignore */ }
        const initial = data.find(p => p.id === saved) ? saved : data[0].id;
        setProjectIdRaw(initial);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!projectId) return;
    Promise.all([
      getTasksByProject(projectId),
      getIssues(projectId),
      getHazardsByProject(projectId),
      supabase.from("timesheets").select("id").eq("project_id", projectId).eq("work_date", TODAY).is("clock_out", null),
      supabase.from("site_visits").select("id").eq("project_id", projectId).gte("sign_in", TODAY + "T00:00:00Z").is("sign_out", null),
    ]).then(([t, i, h, ts, sv]) => {
      setStats({
        onSite:  (ts.data?.length || 0) + (sv.data?.length || 0),
        tasks:   t.data.filter(x => x.status !== "completed").length,
        issues:  i.data.filter(x => x.status === "open").length,
        hazards: h.data.filter(x => x.status === "open").length,
      });
    });
  }, [projectId]);

  const project = projects.find(p => p.id === projectId);

  if (loading || !project) return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <div style={{ padding: "14px 16px", background: "#111", borderBottom: "1px solid #1e1e1e" }}>
        <Skeleton width={120} height={14} style={{ marginBottom: 8 }} />
        <Skeleton width="70%" height={28} />
      </div>
    </div>
  );

  // Supervisor's home IS the project dashboard, with the rich header (switcher +
  // on-site indicator) and tappable project-scoped stat row.
  return (
    <ProjectDashboard
      key={project.id}
      project={project}
      user={user}
      maxWidth={430}
      stats={stats}
      badges={{ tasks: stats.tasks, issues: stats.issues, safety: stats.hazards, attendance: stats.onSite }}
      header={
        <ProjectHeader
          project={project}
          projects={projects}
          user={user}
          onSwitch={projects.length > 1 ? setProjectId : null}
          rightSlot={<OnSiteIndicator user={user} project={project} />}
        />
      }
    />
  );
}
