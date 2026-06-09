import { useState, useEffect } from "react";
import BackHeader from "./BackHeader";
import AppTile from "./AppTile";
import { EmptyState } from "./LoadingScreen";
import { HEALTH } from "../../lib/theme";
import ActionQueue, { useActionItems } from "./ActionQueue";
import { KIND_TO_PROJECT_SCREEN } from "../../lib/actionQueue";
import TasksFeature from "../supervisor/TasksFeature";
import IssuesFeature from "../supervisor/IssuesFeature";
import OnSiteFeature from "../supervisor/OnSiteFeature";
import { SafetyScreen, DailyLogScreen, ChatScreen } from "../supervisor/SupervisorScreens";
import OverviewScreen from "./OverviewScreen";
import CommercialModule from "./CommercialModule";
import VariationsList from "./VariationsModule";
import PhotosScreen from "./PhotosScreen";
import ProjectDocsScreen from "./ProjectDocsScreen";
import TimelineScreen from "./TimelineScreen";
import LookaheadScreen from "./LookaheadScreen";
import InspectionsModule from "./InspectionsModule";
import DefectsModule from "./DefectsModule";

// §7 Project Dashboard — the project becomes its own workspace.
// Shared by Builder (drill-in from project list) and Supervisor (home screen).
// Tiles are grouped into sections so the (now many) functions stay scannable on a phone.
const GROUPS = [
  { section: "Site", tiles: [
    { key: "tasks",         icon: "✅", label: "Tasks",         accent: "#f59e0b", bg: "#251d00" },
    { key: "attendance",    icon: "👷", label: "Attendance",    accent: "#0ea5e9", bg: "#061520" },
    { key: "dailyLog",      icon: "📅", label: "Daily Logs",    accent: "#14b8a6", bg: "#061e1c" },
    { key: "photos",        icon: "📷", label: "Photos",        accent: "#a855f7", bg: "#1a0c33" },
    { key: "safety",        icon: "⚠️", label: "Safety",        accent: "#ef4444", bg: "#2a0c0c" },
    { key: "issues",        icon: "⚡", label: "Issues",        accent: "#f97316", bg: "#251200" },
  ]},
  { section: "Quality & Programme", tiles: [
    { key: "inspections",   icon: "🔍", label: "Inspections",   accent: "#14b8a6", bg: "#06201e" },
    { key: "defects",       icon: "🔧", label: "Defects",       accent: "#f97316", bg: "#251200" },
    { key: "timeline",      icon: "📈", label: "Timeline",      accent: "#0ea5e9", bg: "#06202a" },
  ]},
  { section: "Commercial", tiles: [
    // Variations now live inside Commercial → Variations (H2: "Variations → Commercial").
    { key: "commercial",    icon: "💰", label: "Commercial",    accent: "#d97706", bg: "#1e1200" },
  ]},
  { section: "Project", tiles: [
    { key: "overview",      icon: "📊", label: "Overview",      accent: "#64748b", bg: "#0c1420" },
    { key: "plans",         icon: "📐", label: "Project Docs",  accent: "#3b82f6", bg: "#0c1a33" },
    { key: "communication", icon: "💬", label: "Comms",         accent: "#22c55e", bg: "#06200e" },
  ]},
];

function Soon({ title, project, onBack }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title={title} subtitle={project.street} onBack={onBack} />
      <div style={{ flex: 1 }}><EmptyState icon="🚧" title={`${title} coming soon`} subtitle="This section is on the build roadmap" /></div>
    </div>
  );
}

// Tappable metric strip (Supervisor). Maps each stat to a dashboard tile.
function StatRow({ stats, onNav }) {
  const items = [
    { key: "attendance", label: "On Site",   value: stats.onSite,  color: "#0ea5e9" },
    { key: "tasks",      label: "Tasks Due", value: stats.tasks,   color: "#f59e0b" },
    { key: "issues",     label: "Issues",    value: stats.issues,  color: "#f97316" },
    { key: "safety",     label: "Hazards",   value: stats.hazards, color: "#ef4444" },
  ];
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
      {items.map(s => (
        <button key={s.key} onClick={() => onNav(s.key)} style={{ flex: 1, textAlign: "center", background: "#1a1a1a", border: "none", borderRadius: 10, padding: "10px 6px", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 28, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
          <div style={{ fontSize: 10, color: "#555", marginTop: 3, textTransform: "uppercase", letterSpacing: 0.3, fontFamily: "Barlow Condensed, sans-serif" }}>{s.label}</div>
        </button>
      ))}
    </div>
  );
}

export default function ProjectDashboard({ project, user, onBack, header, stats, badges = {}, maxWidth, initialScreen, focusId, onSwitchProject }) {
  const [screen, setScreen] = useState(initialScreen || null);
  // entityId an action item wants opened on the destination screen (deep-link to the exact record).
  const [focus, setFocus] = useState(focusId || null);
  const health = HEALTH[project.health] || HEALTH.green;

  // Deep-link from an action item (parent sets initialScreen + focusId, possibly after switching project).
  useEffect(() => { if (initialScreen) setScreen(initialScreen); setFocus(focusId || null); }, [initialScreen, focusId]);

  // Open a screen from a normal tile/stat tap — clears any stale deep-link focus.
  const openScreen = (key) => { setFocus(null); setScreen(key); };

  // Supervisor's "My actions today" — only computed/shown for supervisors here.
  const isSupervisor = user?.role === "supervisor";
  const { items: actionItems } = useActionItems(user?.role, user?.id, isSupervisor);
  const onAction = (item) => {
    const key = KIND_TO_PROJECT_SCREEN[item.target.kind];
    if (!key) return;
    const eid = item.target.entityId || null;
    if (item.projectId && item.projectId !== project.id && onSwitchProject) onSwitchProject(item.projectId, key, eid);
    else { setFocus(eid); setScreen(key); }
  };

  if (screen) {
    const props = { project, user, onBack: () => { setScreen(null); setFocus(null); } };
    switch (screen) {
      case "tasks":         return <TasksFeature {...props} focusId={focus} />;
      case "issues":        return <IssuesFeature {...props} focusId={focus} />;
      case "attendance":    return <OnSiteFeature {...props} />;
      case "safety":        return <SafetyScreen {...props} focusId={focus} />;
      case "dailyLog":      return <DailyLogScreen {...props} />;
      case "variations":    return <VariationsList {...props} focusId={focus} />;
      case "communication": return <ChatScreen {...props} />;
      case "overview":      return <OverviewScreen {...props} onNav={openScreen} />;
      case "plans":         return <ProjectDocsScreen {...props} />;
      case "photos":        return <PhotosScreen {...props} />;
      case "commercial":    return <CommercialModule {...props} />;
      case "timeline":      return user?.role === "supervisor" ? <LookaheadScreen {...props} /> : <TimelineScreen {...props} focusId={focus} />;
      case "inspections":   return <InspectionsModule {...props} focusId={focus} />;
      case "defects":       return <DefectsModule {...props} />;
      default: break;
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c", maxWidth, margin: maxWidth ? "0 auto" : undefined }}>
      {header || (
        <BackHeader
          title={project.street}
          subtitle={`JOB ${project.job_number || "—"} · ${project.phase || "—"}`}
          onBack={onBack}
          rightSlot={
            <span style={{ fontSize: 10, fontFamily: "Barlow Condensed, sans-serif", color: health.color, background: health.bg, border: `1px solid ${health.border}`, padding: "4px 10px", borderRadius: 12, whiteSpace: "nowrap" }}>
              ● {health.label}
            </span>
          }
        />
      )}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {isSupervisor && <ActionQueue items={actionItems} title="My actions today" max={10} onOpen={onAction} allClear="You're all caught up" />}
        {stats ? (
          <StatRow stats={stats} onNav={openScreen} />
        ) : (
          <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#666", marginBottom: 6 }}>
              <span>{project.client_name || "—"}</span>
              <span>{project.progress || 0}% complete</span>
            </div>
            <div style={{ height: 6, background: "#222", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${project.progress || 0}%`, background: "#e07b39", borderRadius: 3 }} />
            </div>
          </div>
        )}

        {GROUPS.map(g => (
          <div key={g.section} style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 12, color: "#555", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>{g.section}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {g.tiles.map(t => <AppTile key={t.key} {...t} badge={badges[t.key] || 0} onClick={() => openScreen(t.key)} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
