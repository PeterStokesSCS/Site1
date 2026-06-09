import { useState, useEffect } from "react";
import ProjectHeader from "../shared/ProjectHeader";
import ProjectDashboard from "../shared/ProjectDashboard";
import SupervisorDashboard from "./SupervisorDashboard";
import OnSiteIndicator from "../shared/OnSiteIndicator";
import { Skeleton } from "../shared/LoadingScreen";
import { getProjects, getTasksByProject, getIssues, getHazardsByProject } from "../../lib/db";
import { KIND_TO_PROJECT_SCREEN } from "../../lib/actionQueue";
import { supabase } from "../../lib/supabase";

const TODAY = new Date().toISOString().slice(0, 10);
const LAST_PROJECT_KEY = "scs_sup_last_project";

export default function SupervisorApp({ user }) {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectIdRaw] = useState(null);
  const [stats, setStats] = useState({ onSite: 0, tasks: 0, issues: 0, hazards: 0 });
  const [refreshKey, setRefreshKey] = useState(0);
  const [initialScreen, setInitialScreen] = useState(null);
  const [focusId, setFocusId] = useState(null);   // entityId to deep-link on the destination screen
  const [showMyDashboard, setShowMyDashboard] = useState(false);
  const [loading, setLoading] = useState(true);

  // From an action item targeting a different assigned project: switch project + open the screen at the record.
  const switchToAction = (pid, screenKey, entityId = null) => { setInitialScreen(screenKey); setFocusId(entityId); setProjectId(pid); };

  // From the personal dashboard's action queue: resolve the screen, switch project, close overlay.
  const openActionFromMyDashboard = (item) => {
    const key = KIND_TO_PROJECT_SCREEN[item.target?.kind];
    if (!key) return;
    setShowMyDashboard(false);
    switchToAction(item.projectId || projectId, key, item.target?.entityId || null);
  };

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

  // Re-runs on project change AND whenever clock state changes (refreshKey),
  // so the On Site count always matches the live muster.
  useEffect(() => {
    if (!projectId) return;
    Promise.all([
      getTasksByProject(projectId),
      getIssues(projectId),
      getHazardsByProject(projectId),
      supabase.from("timesheets").select("id").eq("project_id", projectId).is("clock_out", null),
      supabase.from("site_visits").select("id").eq("project_id", projectId).is("sign_out", null),
    ]).then(([t, i, h, ts, sv]) => {
      setStats({
        onSite:  (ts.data?.length || 0) + (sv.data?.length || 0),
        tasks:   t.data.filter(x => x.status !== "completed").length,
        issues:  i.data.filter(x => x.status === "open").length,
        hazards: h.data.filter(x => x.status === "open").length,
      });
    });
  }, [projectId, refreshKey]);

  const project = projects.find(p => p.id === projectId);

  if (!loading && showMyDashboard) return (
    <SupervisorDashboard
      user={user}
      projects={projects}
      onBack={() => setShowMyDashboard(false)}
      onOpenAction={openActionFromMyDashboard}
    />
  );

  if (loading || !project) return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <div style={{ padding: "14px 16px", background: "#111", borderBottom: "1px solid #1e1e1e" }}>
        <Skeleton width={120} height={14} style={{ marginBottom: 8 }} />
        <Skeleton width="70%" height={28} />
      </div>
    </div>
  );

  return (
    <ProjectDashboard
      key={project.id}
      project={project}
      user={user}
      maxWidth={430}
      stats={stats}
      initialScreen={initialScreen}
      focusId={focusId}
      onSwitchProject={switchToAction}
      badges={{ tasks: stats.tasks, issues: stats.issues, safety: stats.hazards, attendance: stats.onSite }}
      header={
        <ProjectHeader
          project={project}
          projects={projects}
          user={user}
          onSwitch={projects.length > 1 ? setProjectId : null}
          onAvatarClick={() => setShowMyDashboard(true)}
          rightSlot={<OnSiteIndicator user={user} project={project} onChange={() => setRefreshKey(k => k + 1)} />}
        />
      }
    />
  );
}
