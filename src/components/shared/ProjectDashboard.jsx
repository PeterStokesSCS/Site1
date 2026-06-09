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

// Sticky tappable metric strip (Supervisor). A small dot flags a metric that has
// grown since it was last viewed (#10). Each item opens its filtered screen.
function StatRow({ stats, onNav, seen = {} }) {
  const items = [
    { key: "attendance", label: "On Site",   value: stats.onSite,  color: "#0ea5e9" },
    { key: "tasks",      label: "Tasks Due", value: stats.tasks,   color: "#f59e0b" },
    { key: "issues",     label: "Issues",    value: stats.issues,  color: "#f97316" },
    { key: "safety",     label: "Hazards",   value: stats.hazards, color: "#ef4444" },
  ];
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {items.map(s => {
        const isNew = seen[s.key] != null && s.value > seen[s.key];
        return (
          <button key={s.key} onClick={() => onNav(s.key, s.value)} style={{ position: "relative", flex: 1, textAlign: "center", background: "#1a1a1a", border: "none", borderRadius: 10, padding: "10px 6px", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
            {isNew && <span style={{ position: "absolute", top: 6, right: 8, width: 8, height: 8, borderRadius: "50%", background: s.color, boxShadow: "0 0 0 2px #1a1a1a" }} />}
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 28, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 10, color: "#888", marginTop: 3, textTransform: "uppercase", letterSpacing: 0.3, fontFamily: "Barlow Condensed, sans-serif" }}>{s.label}</div>
          </button>
        );
      })}
    </div>
  );
}

const STAT_VAL = { attendance: "onSite", tasks: "tasks", issues: "issues", safety: "hazards" };

// #13: big obvious bottom quick-add control (mobile/site). Expands to common actions,
// each opening the relevant screen with its create flow ready.
function QuickAddFab({ onPick }) {
  const [open, setOpen] = useState(false);
  const actions = [
    { key: "tasks",  label: "Add Task",      icon: "✅", color: "#f59e0b" },
    { key: "safety", label: "Report Hazard", icon: "⚠️", color: "#ef4444" },
    { key: "issues", label: "Add Issue",     icon: "⚡", color: "#f97316" },
    { key: "photos", label: "Take Photo",    icon: "📷", color: "#a855f7" },
  ];
  return (
    <div style={{ position: "fixed", right: 18, bottom: 20, zIndex: 150, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
      {open && actions.map(a => (
        <button key={a.key} onClick={() => { setOpen(false); onPick(a.key); }} style={{ display: "flex", alignItems: "center", gap: 10, background: "#1c1c1c", border: `1px solid ${a.color}66`, borderRadius: 24, padding: "10px 16px", cursor: "pointer", boxShadow: "0 4px 14px rgba(0,0,0,0.5)" }}>
          <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, color: "#eee", letterSpacing: 0.3 }}>{a.label}</span>
          <span style={{ fontSize: 18 }}>{a.icon}</span>
        </button>
      ))}
      <button onClick={() => setOpen(o => !o)} aria-label="Quick add" style={{ width: 60, height: 60, borderRadius: "50%", border: "none", background: "#e07b39", color: "#fff", fontSize: 32, fontWeight: 300, cursor: "pointer", boxShadow: "0 4px 16px rgba(224,123,57,0.5)", display: "flex", alignItems: "center", justifyContent: "center", transform: open ? "rotate(45deg)" : "none", transition: "transform 0.15s", alignSelf: "flex-end" }}>+</button>
    </div>
  );
}

export default function ProjectDashboard({ project, user, onBack, header, stats, badges = {}, maxWidth, initialScreen, focusId, focusKind, onSwitchProject, onScreenChange }) {
  const [screen, setScreen] = useState(initialScreen || null);
  // entityId an action item wants opened on the destination screen (deep-link to the exact record).
  const [focus, setFocus] = useState(focusId || null);
  // kind disambiguates multi-category screens (Commercial: receipt vs po vs procurement).
  const [focusK, setFocusK] = useState(focusKind || null);
  const health = HEALTH[project.health] || HEALTH.green;

  // Deep-link from an action item (parent sets initialScreen + focusId, possibly after switching project).
  useEffect(() => { if (initialScreen) setScreen(initialScreen); setFocus(focusId || null); setFocusK(focusKind || null); }, [initialScreen, focusId, focusKind]);

  // #9: report the current screen up so a project switch can keep the same feature.
  useEffect(() => { onScreenChange?.(screen); }, [screen]); // eslint-disable-line react-hooks/exhaustive-deps

  // #10: per-metric "last seen" baselines (localStorage) → dot when a count grows.
  const SEEN_KEY = `scs_stats_seen_${project.id}`;
  const [seen, setSeen] = useState(() => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}"); } catch { return {}; } });
  useEffect(() => {
    if (!stats) return;
    setSeen(prev => {
      const next = { ...prev }; let changed = false;
      for (const k of Object.keys(STAT_VAL)) if (next[k] == null) { next[k] = stats[STAT_VAL[k]] ?? 0; changed = true; }
      if (changed) { try { localStorage.setItem(SEEN_KEY, JSON.stringify(next)); } catch { /* ignore */ } }
      return changed ? next : prev;
    });
  }, [stats]); // eslint-disable-line react-hooks/exhaustive-deps
  const onStatNav = (key, value) => {
    setSeen(prev => { const next = { ...prev, [key]: value }; try { localStorage.setItem(SEEN_KEY, JSON.stringify(next)); } catch { /* ignore */ } return next; });
    openScreen(key);
  };

  // Open a screen from a normal tile/stat tap — clears any stale deep-link focus.
  const openScreen = (key) => { setFocus(null); setFocusK(null); setScreen(key); };
  // FAB quick-add: open the screen with its create form ready (#13).
  const openNew = (key) => { setFocusK(null); setFocus("new"); setScreen(key); };

  // Supervisor's "My actions today" — only computed/shown for supervisors here.
  const isSupervisor = user?.role === "supervisor";
  const { items: actionItems } = useActionItems(user?.role, user?.id, isSupervisor);
  const onAction = (item) => {
    const key = KIND_TO_PROJECT_SCREEN[item.target.kind];
    if (!key) return;
    const eid = item.target.entityId || null;
    if (item.projectId && item.projectId !== project.id && onSwitchProject) onSwitchProject(item.projectId, key, eid);
    else { setFocus(eid); setFocusK(item.target.kind); setScreen(key); }
  };

  if (screen) {
    const props = { project, user, onBack: () => { setScreen(null); setFocus(null); } };
    switch (screen) {
      case "tasks":         return <TasksFeature {...props} focusId={focus} />;
      case "issues":        return <IssuesFeature {...props} focusId={focus} />;
      case "attendance":    return <OnSiteFeature {...props} focusId={focus} />;
      case "safety":        return <SafetyScreen {...props} focusId={focus} />;
      case "dailyLog":      return <DailyLogScreen {...props} />;
      case "variations":    return <VariationsList {...props} focusId={focus} />;
      case "communication": return <ChatScreen {...props} />;
      case "overview":      return <OverviewScreen {...props} onNav={openScreen} />;
      case "plans":         return <ProjectDocsScreen {...props} />;
      case "photos":        return <PhotosScreen {...props} />;
      case "commercial":    return <CommercialModule {...props} focusId={focus} focusKind={focusK} />;
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
      {/* #10: sticky operational metrics bar — stays below the header while scrolling */}
      {stats && (
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #1e1e1e", background: "#0c0c0c", flexShrink: 0 }}>
          <StatRow stats={stats} onNav={onStatNav} seen={seen} />
        </div>
      )}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {isSupervisor && <ActionQueue items={actionItems} title="My actions today" max={5} onOpen={onAction} allClear="You're all caught up" />}
        {!stats && (
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
      {isSupervisor && <QuickAddFab onPick={openNew} />}
    </div>
  );
}
