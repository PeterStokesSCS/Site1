import { useState } from "react";
import BackHeader from "./BackHeader";
import AppTile from "./AppTile";
import { EmptyState } from "./LoadingScreen";
import { HEALTH } from "../../lib/theme";
import TasksFeature from "../supervisor/TasksFeature";
import IssuesFeature from "../supervisor/IssuesFeature";
import OnSiteFeature from "../supervisor/OnSiteFeature";
import { SafetyScreen, DailyLogScreen, VariationsScreen, ChatScreen } from "../supervisor/SupervisorApp";

// §7 Project Dashboard — the project becomes its own workspace.
// Reuses the existing supervisor screens, scoped to the chosen project.
const TILES = [
  { key: "overview",      icon: "📊", label: "Overview",      accent: "#64748b", bg: "#0c1420" },
  { key: "plans",         icon: "📐", label: "Plans",         accent: "#3b82f6", bg: "#0c1a33" },
  { key: "tasks",         icon: "✅", label: "Tasks",         accent: "#f59e0b", bg: "#251d00" },
  { key: "attendance",    icon: "👷", label: "Attendance",    accent: "#0ea5e9", bg: "#061520" },
  { key: "dailyLog",      icon: "📅", label: "Daily Logs",    accent: "#14b8a6", bg: "#061e1c" },
  { key: "photos",        icon: "📷", label: "Photos",        accent: "#a855f7", bg: "#1a0c33" },
  { key: "safety",        icon: "⚠️", label: "Safety",        accent: "#ef4444", bg: "#2a0c0c" },
  { key: "issues",        icon: "⚡", label: "Issues",        accent: "#f97316", bg: "#251200" },
  { key: "variations",    icon: "±",  label: "Variations",    accent: "#6366f1", bg: "#10103a" },
  { key: "commercial",    icon: "💰", label: "Commercial",    accent: "#d97706", bg: "#1e1200" },
  { key: "communication", icon: "💬", label: "Comms",         accent: "#22c55e", bg: "#06200e" },
];

function Soon({ title, project, onBack }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
      <BackHeader title={title} subtitle={project.street} onBack={onBack} />
      <div style={{ flex: 1 }}><EmptyState icon="🚧" title={`${title} coming soon`} subtitle="This section is on the build roadmap" /></div>
    </div>
  );
}

export default function ProjectDashboard({ project, user, onBack }) {
  const [screen, setScreen] = useState(null);
  const health = HEALTH[project.health] || HEALTH.green;

  if (screen) {
    const props = { project, user, onBack: () => setScreen(null) };
    switch (screen) {
      case "tasks":         return <TasksFeature {...props} />;
      case "issues":        return <IssuesFeature {...props} />;
      case "attendance":    return <OnSiteFeature {...props} />;
      case "safety":        return <SafetyScreen {...props} />;
      case "dailyLog":      return <DailyLogScreen {...props} />;
      case "variations":    return <VariationsScreen {...props} />;
      case "communication": return <ChatScreen {...props} />;
      case "overview":      return <Soon title="Overview" {...props} />;
      case "plans":         return <Soon title="Plans" {...props} />;
      case "photos":        return <Soon title="Photos" {...props} />;
      case "commercial":    return <Soon title="Commercial" {...props} />;
      default: break;
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0c0c0c" }}>
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
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {/* Progress strip */}
        <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#666", marginBottom: 6 }}>
            <span>{project.client_name || "—"}</span>
            <span>{project.progress || 0}% complete</span>
          </div>
          <div style={{ height: 6, background: "#222", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${project.progress || 0}%`, background: "#e07b39", borderRadius: 3 }} />
          </div>
        </div>

        {/* Workspace tiles */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {TILES.map(t => <AppTile key={t.key} {...t} onClick={() => setScreen(t.key)} />)}
        </div>
      </div>
    </div>
  );
}
