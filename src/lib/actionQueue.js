// SITE1 — Action Queue (Attention Centre).
// A DERIVED layer: action items are computed from current state on every read,
// never stored. An item exists exactly while its predicate matches; it disappears
// the instant the source state changes (no "resolve" write). See
// SITE1_ACTION_QUEUE_STEP0_FINDINGS.md.
//
// Access scoping is automatic: these queries run under the user's Supabase session,
// so Row-Level Security limits each role to its own data.
import { supabase } from "./supabase";

const TZ = "Australia/Melbourne";

// ── Config (Phase 1 fixed windows) ─────────────────────────────────────────────
export const CONFIG = {
  signoffOverdueDays: 3,
  dailyLogCutoffHour: 18,
  shiftMaxHours: 10,
};

// ── Melbourne-time helpers (never compute day boundaries in UTC) ───────────────
export function melbourneTodayStr(d = new Date()) {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
export function melbourneHour(d = new Date()) {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(d));
}

// ── Pure predicate logic (unit-testable, no DB) ────────────────────────────────
export function hoursSince(iso, now = Date.now()) {
  if (!iso) return null;
  return Math.round(((now - new Date(iso).getTime()) / 3600000) * 100) / 100;
}
export function isSignoffOverdue(sentAt, now = Date.now(), days = CONFIG.signoffOverdueDays) {
  const h = hoursSince(sentAt, now);
  return h != null && h > days * 24;
}
export function isShiftTooLong(clockIn, now = Date.now(), maxH = CONFIG.shiftMaxHours) {
  const h = hoursSince(clockIn, now);
  return h != null && h > maxH;
}
// Combine a date + optional time into a comparable instant (Melbourne wall clock).
export function dueAtIso(dueDate, dueTime) {
  if (!dueDate) return null;
  const t = (dueTime && /^\d{2}:\d{2}/.test(dueTime)) ? dueTime.slice(0, 5) : "17:00";
  // Australia/Melbourne is +10:00 (AEST) / +11:00 (AEDT). Use a fixed +10:00 offset
  // for the comparison instant; ~1h DST drift is acceptable for "overdue" windows.
  return `${dueDate}T${t}:00+10:00`;
}
export function isTaskOverdue(dueDate, dueTime, status, now = Date.now()) {
  if (status === "completed") return false;
  const iso = dueAtIso(dueDate, dueTime);
  return !!iso && new Date(iso).getTime() < now;
}

// ── ActionItem builder ─────────────────────────────────────────────────────────
const PRIO = { high: 0, medium: 1, low: 2 };
function mk({ type, priority, role, project, projectId, since, dueAt, description, target, userId }) {
  const sinceIso = since ? new Date(since).toISOString() : null;
  const pid = project?.id || projectId || null;
  return {
    id: `${type}:${target.entityId || pid}`,
    type, priority, role, userId,
    projectId: pid,
    projectName: project ? (project.street || project.job_number || "Project") : "",
    since: sinceIso,
    ageHours: sinceIso ? hoursSince(sinceIso) : null,
    dueAt: dueAt || undefined,
    description,
    // navigation intent (no URL router in SITE1 — dashboards interpret this)
    target,
  };
}
const PROJ = "project:projects(id, job_number, street)";

// Maps an item's navigation-intent kind to a Project Dashboard screen key.
// (Builder timesheets resolve in the Labour tab, handled separately.)
export const KIND_TO_PROJECT_SCREEN = {
  variation: "variations", task: "tasks", hazard: "safety", issue: "issues",
  dailylog: "dailyLog", attendance: "attendance", commercial: "commercial", po: "commercial",
};

// ── Predicate registry ─────────────────────────────────────────────────────────
// Each entry: { key, role, priority, query(ctx) -> ActionItem[] }. Office reuses builder.
export const REGISTRY = [
  // ---- Builder / Office ----
  { key: "variation.signoff_overdue", role: "builder", priority: "high", async query() {
    const { data } = await supabase.from("variations").select(`id, project_id, ref, title, sent_at, status, ${PROJ}`).eq("status", "sent");
    return (data || []).filter(v => isSignoffOverdue(v.sent_at)).map(v => mk({
      type: "variation.signoff_overdue", priority: "high", role: "builder", project: v.project, since: v.sent_at,
      description: `${v.ref || "Variation"} "${v.title}" — no client response in ${Math.floor(hoursSince(v.sent_at) / 24)} day(s)`,
      target: { kind: "variation", projectId: v.project_id, entityId: v.id },
    }));
  }},
  { key: "variation.awaiting_issue", role: "builder", priority: "high", async query() {
    const { data } = await supabase.from("variations").select(`id, project_id, ref, title, total_inc_gst, status, created_at, ${PROJ}`).in("status", ["draft", "pending", "approved_for_issue"]);
    return (data || []).filter(v => Number(v.total_inc_gst) > 0).map(v => mk({
      type: "variation.awaiting_issue", priority: "high", role: "builder", project: v.project, since: v.created_at,
      description: `${v.ref || "Variation"} "${v.title}" priced and ready to send to client`,
      target: { kind: "variation", projectId: v.project_id, entityId: v.id },
    }));
  }},
  { key: "variation.awaiting_pricing", role: "builder", priority: "high", async query() {
    const { data: reqs } = await supabase.from("subbie_requests").select("id, linked_variation_id, decided_at, trade").eq("status", "converted").not("linked_variation_id", "is", null);
    if (!reqs?.length) return [];
    const { data: vars } = await supabase.from("variations").select(`id, project_id, ref, title, total_inc_gst, status, created_at, ${PROJ}`).in("id", reqs.map(r => r.linked_variation_id));
    return (vars || []).filter(v => v.status === "draft" && !(Number(v.total_inc_gst) > 0)).map(v => {
      const r = reqs.find(x => x.linked_variation_id === v.id);
      return mk({
        type: "variation.awaiting_pricing", priority: "high", role: "builder", project: v.project, since: r?.decided_at || v.created_at,
        description: `${v.ref || "Variation"} "${v.title}" (${r?.trade || "subbie"} request) needs pricing`,
        target: { kind: "variation", projectId: v.project_id, entityId: v.id },
      });
    });
  }},
  { key: "variation.rejected_decision", role: "builder", priority: "medium", async query() {
    const { data } = await supabase.from("variations").select(`id, project_id, ref, title, approval_date, status, ${PROJ}`).eq("status", "rejected");
    return (data || []).map(v => mk({
      type: "variation.rejected_decision", priority: "medium", role: "builder", project: v.project, since: v.approval_date,
      description: `${v.ref || "Variation"} "${v.title}" was declined — revise or close it out`,
      target: { kind: "variation", projectId: v.project_id, entityId: v.id },
    }));
  }},
  { key: "timesheet.pending", role: "builder", priority: "high", async query() {
    const { data } = await supabase.from("timesheets").select(`id, project_id, status, clock_out, created_at, worker:profiles!timesheets_worker_id_fkey(full_name), ${PROJ}`).eq("status", "pending");
    return (data || []).map(t => mk({
      type: "timesheet.pending", priority: "high", role: "builder", project: t.project, since: t.clock_out || t.created_at,
      description: `Timesheet to approve — ${t.worker?.full_name || "worker"}`,
      target: { kind: "timesheet", projectId: t.project_id, entityId: t.id },
    }));
  }},
  { key: "po.awaiting_acceptance", role: "builder", priority: "medium", async query() {
    const { data } = await supabase.from("purchase_orders").select(`id, project_id, po_number, status, created_at, subbie:profiles(full_name), ${PROJ}`).eq("status", "issued");
    return (data || []).map(p => mk({
      type: "po.awaiting_acceptance", priority: "medium", role: "builder", project: p.project, since: p.created_at,
      description: `${p.po_number} not yet accepted by ${p.subbie?.full_name || "subcontractor"}`,
      target: { kind: "po", projectId: p.project_id, entityId: p.id },
    }));
  }},
  { key: "hazard.high_risk_open", role: "builder", priority: "high", async query() {
    const { data } = await supabase.from("hazards").select(`id, project_id, title, status, risk, created_at, ${PROJ}`).eq("status", "open").eq("risk", "high");
    return (data || []).map(h => mk({
      type: "hazard.high_risk_open", priority: "high", role: "builder", project: h.project, since: h.created_at,
      description: `High-risk hazard open: ${h.title}`,
      target: { kind: "hazard", projectId: h.project_id, entityId: h.id },
    }));
  }},
  { key: "receipt.awaiting_confirmation", role: "builder", priority: "low", async query() {
    const { data } = await supabase.from("commercial_items").select(`id, project_id, title, type, status, created_at, ${PROJ}`).eq("type", "receipt").eq("status", "draft");
    return (data || []).map(r => mk({
      type: "receipt.awaiting_confirmation", priority: "low", role: "builder", project: r.project, since: r.created_at,
      description: `Receipt to confirm: ${r.title || "scanned receipt"}`,
      target: { kind: "commercial", projectId: r.project_id, entityId: r.id },
    }));
  }},

  // ---- Supervisor (RLS already limits to assigned projects) ----
  { key: "dailylog.outstanding", role: "supervisor", priority: "high", async query() {
    if (melbourneHour() < CONFIG.dailyLogCutoffHour) return [];
    const today = melbourneTodayStr();
    const [{ data: projs }, { data: logs }] = await Promise.all([
      supabase.from("projects").select("id, job_number, street").eq("status", "active"),
      supabase.from("daily_logs").select("project_id").eq("log_date", today),
    ]);
    const done = new Set((logs || []).map(l => l.project_id));
    return (projs || []).filter(p => !done.has(p.id)).map(p => mk({
      type: "dailylog.outstanding", priority: "high", role: "supervisor", project: p, since: `${today}T00:00:00+10:00`,
      description: `Daily log not submitted for ${p.street} today`,
      target: { kind: "dailylog", projectId: p.id },
    }));
  }},
  { key: "task.overdue", role: "supervisor", priority: "high", async query() {
    const { data } = await supabase.from("tasks").select(`id, project_id, title, due_date, due_time, status, ${PROJ}`).neq("status", "completed");
    return (data || []).filter(t => isTaskOverdue(t.due_date, t.due_time, t.status)).map(t => mk({
      type: "task.overdue", priority: "high", role: "supervisor", project: t.project, since: dueAtIso(t.due_date, t.due_time), dueAt: dueAtIso(t.due_date, t.due_time),
      description: `Overdue task: ${t.title}`,
      target: { kind: "task", projectId: t.project_id, entityId: t.id },
    }));
  }},
  { key: "hazard.open", role: "supervisor", priority: "high", async query() {
    const { data } = await supabase.from("hazards").select(`id, project_id, title, status, risk, created_at, ${PROJ}`).eq("status", "open");
    return (data || []).map(h => mk({
      type: "hazard.open", priority: "high", role: "supervisor", project: h.project, since: h.created_at,
      description: `${h.risk === "high" ? "High-risk h" : "H"}azard open: ${h.title}`,
      target: { kind: "hazard", projectId: h.project_id, entityId: h.id },
    }));
  }},
  { key: "issue.open", role: "supervisor", priority: "medium", async query() {
    const { data } = await supabase.from("issues").select(`id, project_id, title, status, created_at, ${PROJ}`).in("status", ["open", "in_progress"]);
    return (data || []).map(i => mk({
      type: "issue.open", priority: "medium", role: "supervisor", project: i.project, since: i.created_at,
      description: `Open issue: ${i.title}`,
      target: { kind: "issue", projectId: i.project_id, entityId: i.id },
    }));
  }},
  { key: "shift.open_too_long", role: "supervisor", priority: "high", async query() {
    const { data } = await supabase.from("timesheets").select(`id, project_id, clock_in, clock_out, worker:profiles!timesheets_worker_id_fkey(full_name), ${PROJ}`).is("clock_out", null);
    return (data || []).filter(t => isShiftTooLong(t.clock_in)).map(t => mk({
      type: "shift.open_too_long", priority: "high", role: "supervisor", project: t.project, since: t.clock_in,
      description: `${t.worker?.full_name || "Worker"} on site ${Math.floor(hoursSince(t.clock_in))}h — still clocked in`,
      target: { kind: "attendance", projectId: t.project_id, entityId: t.id },
    }));
  }},

  // ---- Client (RLS limits to own project) ----
  { key: "variation.awaiting_client_approval", role: "client", priority: "high", async query() {
    const { data } = await supabase.from("variations").select(`id, project_id, ref, title, sent_at, status, ${PROJ}`).eq("status", "sent");
    return (data || []).map(v => mk({
      type: "variation.awaiting_client_approval", priority: "high", role: "client", project: v.project, since: v.sent_at,
      description: `Variation ${v.ref || ""} "${v.title}" needs your approval`,
      target: { kind: "clientVariation", projectId: v.project_id, entityId: v.id },
    }));
  }},

  // ---- Subcontractor (own POs/requests only; NO financial fields selected) ----
  { key: "po.awaiting_acceptance_subby", role: "subcontractor", priority: "high", async query({ userId }) {
    const { data } = await supabase.from("purchase_orders").select("id, project_id, po_number, scope, status, created_at, project:projects(job_number, street)").eq("status", "issued").eq("subbie_id", userId);
    return (data || []).map(p => mk({
      type: "po.awaiting_acceptance_subby", priority: "high", role: "subcontractor", project: p.project, since: p.created_at,
      description: `New purchase order ${p.po_number} to review and accept`,
      target: { kind: "subbiePo", projectId: p.project_id, entityId: p.id },
    }));
  }},
  { key: "request.outcome_unviewed", role: "subcontractor", priority: "medium", async query({ userId }) {
    const { data } = await supabase.from("subbie_requests").select("id, project_id, status, decided_at, project:projects(job_number, street)").eq("submitted_by", userId).in("status", ["approved", "rejected"]).is("viewed_at", null);
    return (data || []).map(r => mk({
      type: "request.outcome_unviewed", priority: "medium", role: "subcontractor", project: r.project, since: r.decided_at,
      description: `Your variation request was ${r.status} — tap to view`,
      target: { kind: "subbieRequest", projectId: r.project_id, entityId: r.id },
    }));
  }},
];

// ── Compute the queue for a user (compute-on-read) ─────────────────────────────
export async function computeActionItems({ role, userId }) {
  const effective = role === "office" ? "builder" : role;
  const preds = REGISTRY.filter(p => p.role === effective);
  const results = await Promise.all(preds.map(p => p.query({ role: effective, userId, now: Date.now() }).catch(() => [])));
  return sortItems(results.flat());
}

export function sortItems(items) {
  return [...items].sort((a, b) => (PRIO[a.priority] - PRIO[b.priority]) || ((b.ageHours || 0) - (a.ageHours || 0)));
}
