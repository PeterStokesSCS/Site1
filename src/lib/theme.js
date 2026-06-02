export const colors = {
  bg: "#0c0c0c",
  surface: "#141414",
  surface2: "#1a1a1a",
  border: "#1e1e1e",
  border2: "#2a2a2a",
  text: "#f0f0f0",
  textMuted: "#888",
  textDim: "#555",
  textFaint: "#333",
  accent: "#e07b39",
  accentDark: "#2a1800",
};

// Each tile has an accent colour, a dark background tint, an icon, and a label
export const TILES = {
  startDay:    { accent: "#e07b39", bg: "#2a1800", icon: "▶",  label: "Start Day" },
  tasks:       { accent: "#f59e0b", bg: "#251d00", icon: "✅",  label: "Tasks" },
  plans:       { accent: "#3b82f6", bg: "#0c1a33", icon: "📐",  label: "Plans" },
  photos:      { accent: "#a855f7", bg: "#1a0c33", icon: "📷",  label: "Photos" },
  dailyLog:    { accent: "#14b8a6", bg: "#061e1c", icon: "📋",  label: "Daily Log" },
  safety:      { accent: "#ef4444", bg: "#2a0c0c", icon: "⚠️",  label: "Safety" },
  issues:      { accent: "#f97316", bg: "#251200", icon: "⚡",  label: "Issues" },
  variations:  { accent: "#6366f1", bg: "#10103a", icon: "±",   label: "Variations" },
  chat:        { accent: "#22c55e", bg: "#06200e", icon: "💬",  label: "Chat" },
  documents:   { accent: "#3b82f6", bg: "#0c1a33", icon: "📄",  label: "Documents" },
  schedule:    { accent: "#06b6d4", bg: "#061820", icon: "📅",  label: "Schedule" },
  labour:      { accent: "#0ea5e9", bg: "#061520", icon: "👷",  label: "Labour" },
  financials:  { accent: "#d97706", bg: "#1e1200", icon: "💰",  label: "Financials" },
  reports:     { accent: "#64748b", bg: "#0c1420", icon: "📊",  label: "Reports" },
  clients:     { accent: "#f43f5e", bg: "#25060e", icon: "👤",  label: "Clients" },
  projects:    { accent: "#e07b39", bg: "#2a1800", icon: "🏗",  label: "Projects" },
  signIn:      { accent: "#22c55e", bg: "#06200e", icon: "✅",  label: "Safety Sign-In" },
  compliance:  { accent: "#8b5cf6", bg: "#120c33", icon: "🛡",  label: "Compliance" },
  updates:     { accent: "#f59e0b", bg: "#251d00", icon: "🔔",  label: "Updates" },
  invoices:    { accent: "#10b981", bg: "#061e12", icon: "💳",  label: "Invoices" },
  clockOut:    { accent: "#ef4444", bg: "#2a0c0c", icon: "⏹",  label: "Clock Out" },
};

export const HEALTH = {
  green:  { label: "Healthy",    color: "#22c55e", bg: "#06200e", border: "#166534" },
  amber:  { label: "Attention",  color: "#f59e0b", bg: "#251d00", border: "#92400e" },
  red:    { label: "At Risk",    color: "#ef4444", bg: "#2a0c0c", border: "#991b1b" },
};
