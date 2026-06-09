// SITE1 — Action Queue (Attention Centre).
// A DERIVED layer: action items are computed from current state on every read,
// never stored. An item exists exactly while its predicate matches; it disappears
// the instant the source state changes (no "resolve" write). See
// SITE1_ACTION_QUEUE_STEP0_FINDINGS.md.
//
// Access scoping is automatic: these queries run under the user's Supabase session,
// so Row-Level Security limits each role to its own data.
import { supabase } from "./supabase";
import { milestoneVariance, mustOrderBy, breachesOrderBy, isDeliveryLate, inspectionDueSoon, materialNotOnSite, doubleBooked } from "./timeline";

// Feature guards — flip to true when the corresponding module ships (UI + data).
// Until then the timeline-engine rules below compute nothing (anti-false-alarm: no module,
// no data, no risk). Built now so they light up the instant the module lands.
export const MODULES = { procurement: true, inspections: true, labour: false };

const TZ = "Australia/Melbourne";

// ── Config (Phase 1 fixed windows) ─────────────────────────────────────────────
export const CONFIG = {
  signoffOverdueDays: 3,
  dailyLogCutoffHour: 18,
  labourCutoffHour: 17,   // end-of-day labour cutoff (Tier 2 #7) — Melbourne
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

// Offset (minutes) of Australia/Melbourne from UTC at a given instant — handles
// AEST(+10) / AEDT(+11) automatically (no hardcoded offset).
function melbourneOffsetMinutes(date) {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(date).reduce((a, x) => (a[x.type] = x.value, a), {});
  const h = p.hour === "24" ? 0 : Number(p.hour); // some engines emit "24" at midnight
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, h, +p.minute, +p.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

// UTC instant of Melbourne local midnight that starts calendar day `dateStr` (YYYY-MM-DD).
// Two-pass: the offset is first sampled at UTC-midnight, then re-sampled at the candidate
// instant and corrected — this resolves the two DST-transition days (23h / 25h) where the
// offset at the target local midnight differs from the offset at the initial guess.
export function melbourneDayStartUtc(dateStr) {
  const naiveMs = new Date(`${dateStr}T00:00:00Z`).getTime();
  const off1 = melbourneOffsetMinutes(new Date(naiveMs));
  let candidate = naiveMs - off1 * 60000;
  const off2 = melbourneOffsetMinutes(new Date(candidate));
  if (off2 !== off1) candidate = naiveMs - off2 * 60000;
  return new Date(candidate);
}

// [startUtc, endUtc) Date instants bounding the Melbourne calendar day `dateStr`.
// DST-exact: the end is the *next* Melbourne midnight, so 23h/25h transition days
// are handled correctly. Use for timestamptz range filters keyed to a local day.
export function melbourneDayRangeUtc(dateStr) {
  const next = new Date(new Date(`${dateStr}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10);
  return { startUtc: melbourneDayStartUtc(dateStr), endUtc: melbourneDayStartUtc(next) };
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

// ── Tier 2 #7 — end-of-day labour (pure, testable) ─────────────────────────────
// UTC instant of the Melbourne labour cutoff (default 17:00) on calendar day `dateStr`.
export function melbourneCutoffUtc(dateStr, cutoffHour = CONFIG.labourCutoffHour) {
  return new Date(melbourneDayStartUtc(dateStr).getTime() + cutoffHour * 3600000);
}
// Hours an unresolved OPEN shift is counted for: clock-in → cutoff (Tier 2 #7
// "count to cutoff and flag"). Never negative (cutoff before clock-in → 0).
export function openShiftHoursToCutoff(clockInIso, cutoffIso) {
  if (!clockInIso || !cutoffIso) return 0;
  const ms = new Date(cutoffIso).getTime() - new Date(clockInIso).getTime();
  return ms > 0 ? Math.round((ms / 3600000) * 100) / 100 : 0;
}
// Has an open shift passed its day's Melbourne cutoff? (Prompts the supervisor to
// confirm OT vs forgotten sign-out — in addition to the >shiftMaxHours rule.)
export function isShiftPastCutoff(clockInIso, now = Date.now(), cutoffHour = CONFIG.labourCutoffHour) {
  if (!clockInIso) return false;
  const workDate = melbourneTodayStr(new Date(clockInIso));
  return now >= melbourneCutoffUtc(workDate, cutoffHour).getTime();
}
// Condense completed-but-unapproved shifts into one group per (project, day) for the
// single "Approve today's labour" action item (Tier 2 #7 — never per-punch). Pure.
export function groupPendingLabour(timesheets) {
  const groups = {};
  for (const t of timesheets || []) {
    if (!t.clock_out || t.status === "approved") continue; // only completed + not yet approved
    const date = String(t.work_date || t.clock_in || "").slice(0, 10);
    if (!date) continue;
    const key = `${t.project_id}:${date}`;
    const g = groups[key] || (groups[key] = { key, projectId: t.project_id, date, project: t.project, count: 0, hours: 0 });
    g.count += 1;
    g.hours += Number(t.hours_worked) || 0;
  }
  return Object.values(groups).map(g => ({ ...g, hours: Math.round(g.hours * 10) / 10 }));
}

// Tier 2 #9: in-house labour cost for a variation. Each entry's `hours` apply to each
// named worker at their rate. rateById = { workerId: hourlyRate }. Pure (testable).
export function variationLabourCost(entries, rateById = {}) {
  let cost = 0;
  for (const e of entries || []) {
    const hours = Number(e.hours) || 0;
    for (const w of e.worker_ids || []) cost += hours * (Number(rateById[w]) || 0);
  }
  return Math.round(cost * 100) / 100;
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
  timeline: "timeline", procurement: "commercial", inspection: "inspections",
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
  // Tier 2 #7: ONE item per project per day ("Approve today's labour"), never per punch.
  // Derived — resolves when the day's completed shifts are all approved.
  { key: "labour.approve_day", role: "builder", priority: "high", async query() {
    const { data } = await supabase.from("timesheets").select(`id, project_id, work_date, clock_in, clock_out, hours_worked, status, ${PROJ}`).eq("status", "pending").not("clock_out", "is", null);
    const today = melbourneTodayStr();
    return groupPendingLabour(data || []).map(g => mk({
      type: "labour.approve_day", priority: "high", role: "builder", project: g.project,
      since: melbourneCutoffUtc(g.date).toISOString(),
      description: `Approve ${g.date === today ? "today's" : g.date} labour — ${g.count} shift${g.count > 1 ? "s" : ""}, ${g.hours}h`,
      target: { kind: "timesheet", projectId: g.projectId, entityId: g.key },
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
  // #11: supervisor/worker requested client visibility on a photo/defect — builder approves.
  { key: "client_visibility.pending", role: "builder", priority: "medium", async query() {
    const [ph, df] = await Promise.all([
      supabase.from("project_photos").select(`id, project_id, caption, category, visibility_requested_at, ${PROJ}`).eq("visibility_status", "requested"),
      supabase.from("defects").select(`id, project_id, title, visibility_requested_at, ${PROJ}`).eq("visibility_status", "requested"),
    ]);
    const rows = [
      ...(ph.data || []).map(p => ({ project: p.project, projectId: p.project_id, since: p.visibility_requested_at, label: p.caption ? `photo "${p.caption}"` : `photo (${p.category || "general"})`, id: p.id })),
      ...(df.data || []).map(d => ({ project: d.project, projectId: d.project_id, since: d.visibility_requested_at, label: `defect "${d.title}"`, id: d.id })),
    ];
    return rows.map(x => mk({
      type: "client_visibility.pending", priority: "medium", role: "builder", project: x.project, since: x.since,
      description: `Client visibility approval — ${x.label}`,
      target: { kind: "visibility", projectId: x.projectId, entityId: x.id },
    }));
  }},
  { key: "variation.eot_unapplied", role: "builder", priority: "medium", async query() {
    const { data } = await supabase.from("variations").select(`id, project_id, ref, title, eot, eot_days, applied_to_forecast, status, approval_date, ${PROJ}`).eq("status", "approved").eq("eot", true).eq("applied_to_forecast", false);
    return (data || []).filter(v => Number(v.eot_days) > 0).map(v => mk({
      type: "variation.eot_unapplied", priority: "medium", role: "builder", project: v.project, since: v.approval_date,
      description: `${v.ref || "Variation"} approved with a ${v.eot_days}-day extension — apply it to the timeline?`,
      target: { kind: "timeline", projectId: v.project_id, entityId: v.id },
    }));
  }},
  { key: "milestone.forecast_slip", role: "builder", priority: "medium", async query() {
    const { data } = await supabase.from("milestones").select(`id, project_id, name, planned_date, forecast_date, done, completed_date, ${PROJ}`);
    return (data || []).filter(m => !m.done && !m.completed_date && m.planned_date && m.forecast_date && (milestoneVariance(m) || 0) > 3).map(m => mk({
      type: "milestone.forecast_slip", priority: "medium", role: "builder", project: m.project, since: `${m.planned_date}T00:00:00+10:00`,
      description: `${m.name} is forecast ${milestoneVariance(m)} days past its baseline`,
      target: { kind: "timeline", projectId: m.project_id, entityId: m.id },
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

  // ---- Timeline Engine: procurement (GUARDED — dormant until Procurement module exists) ----
  { key: "procurement.order_by_breach", role: "builder", priority: "high", async query() {
    if (!MODULES.procurement) return [];
    const today = melbourneTodayStr();
    const { data } = await supabase.from("procurement_items").select(`id, project_id, item_name, required_by_date, lead_time_days, ordered_date, status, ${PROJ}`);
    return (data || []).filter(p => breachesOrderBy(p, today)).map(p => mk({
      type: "procurement.order_by_breach", priority: "high", role: "builder", project: p.project,
      since: `${mustOrderBy(p.required_by_date, p.lead_time_days)}T00:00:00+10:00`,
      description: `${p.item_name} must be ordered now — ${p.lead_time_days}-day lead, needed ${p.required_by_date}`,
      target: { kind: "procurement", projectId: p.project_id, entityId: p.id },
    }));
  }},
  { key: "procurement.delivery_late", role: "builder", priority: "high", async query() {
    if (!MODULES.procurement) return [];
    const { data } = await supabase.from("procurement_items").select(`id, project_id, item_name, ordered_date, expected_delivery_date, required_by_date, actual_delivery_date, status, ${PROJ}`);
    return (data || []).filter(isDeliveryLate).map(p => mk({
      type: "procurement.delivery_late", priority: "high", role: "builder", project: p.project, since: p.ordered_date,
      description: `${p.item_name} delivery (${p.expected_delivery_date}) is after it's needed (${p.required_by_date})`,
      target: { kind: "procurement", projectId: p.project_id, entityId: p.id },
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
  // Open shift flagged when it runs >shiftMaxHours OR is still open past the day's
  // Melbourne cutoff (Tier 2 #7 — prompt the supervisor: OT or forgotten sign-out?).
  { key: "shift.open_too_long", role: "supervisor", priority: "high", async query() {
    const { data } = await supabase.from("timesheets").select(`id, project_id, clock_in, clock_out, worker:profiles!timesheets_worker_id_fkey(full_name), ${PROJ}`).is("clock_out", null);
    return (data || []).filter(t => isShiftTooLong(t.clock_in) || isShiftPastCutoff(t.clock_in)).map(t => {
      const name = t.worker?.full_name || "Worker";
      const tooLong = isShiftTooLong(t.clock_in);
      return mk({
        type: "shift.open_too_long", priority: "high", role: "supervisor", project: t.project, since: t.clock_in,
        description: tooLong
          ? `${name} on site ${Math.floor(hoursSince(t.clock_in))}h — still clocked in`
          : `${name} still clocked in after ${CONFIG.labourCutoffHour}:00 — confirm overtime or sign-out`,
        target: { kind: "attendance", projectId: t.project_id, entityId: t.id },
      });
    });
  }},

  // ---- Timeline Engine: site execution (GUARDED) ----
  { key: "task.material_not_on_site", role: "supervisor", priority: "high", async query() {
    if (!MODULES.procurement) return [];
    const today = melbourneTodayStr();
    const { data: tasks } = await supabase.from("tasks").select(`id, project_id, title, start_date, status, depends_on_procurement_ids, ${PROJ}`).neq("status", "completed").not("start_date", "is", null);
    const ids = [...new Set((tasks || []).flatMap(t => t.depends_on_procurement_ids || []))];
    if (!ids.length) return [];
    const { data: procs } = await supabase.from("procurement_items").select("id, actual_delivery_date, status").in("id", ids);
    const procById = Object.fromEntries((procs || []).map(p => [p.id, p]));
    return materialNotOnSite(tasks, procById, today).map(t => mk({
      type: "task.material_not_on_site", priority: "high", role: "supervisor", project: t.project, since: t.start_date,
      description: `Material not on site for "${t.title}" (starts ${t.start_date})`,
      target: { kind: "task", projectId: t.project_id, entityId: t.id },
    }));
  }},
  { key: "inspection.due_soon", role: "supervisor", priority: "high", async query() {
    if (!MODULES.inspections) return [];
    const today = melbourneTodayStr();
    const { data } = await supabase.from("qa_items").select(`id, project_id, title, due_date, status, ${PROJ}`);
    return (data || []).filter(q => inspectionDueSoon(q, today)).map(q => mk({
      type: "inspection.due_soon", priority: "high", role: "supervisor", project: q.project, since: q.due_date,
      description: `Inspection due soon: ${q.title} (${q.due_date})`,
      target: { kind: "inspection", projectId: q.project_id, entityId: q.id },
    }));
  }},
  { key: "labour.double_booked", role: "builder", priority: "medium", async query() {
    if (!MODULES.labour) return [];
    const { data } = await supabase.from("labour_allocations").select("id, project_id, worker_or_subby_id, allocation_date");
    const clashes = doubleBooked(data || []);
    return clashes.map(c => mk({
      type: "labour.double_booked", priority: "medium", role: "builder", projectId: null,
      since: `${c.date}T00:00:00+10:00`,
      description: `Worker double-booked across projects on ${c.date}`,
      target: { kind: "labour", entityId: `${c.worker}-${c.date}` },
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

// ── Consolidation (#3): >threshold items of one type in one project → one group ─
// Grouped item deep-links to a filtered view (task.overdue → the overdue task list).
const GROUP_META = {
  "task.overdue":              { label: "overdue tasks",     groupEntity: "group:overdue" },
  "task.material_not_on_site": { label: "material blockers", groupEntity: null },
  "hazard.open":               { label: "open hazards",      groupEntity: null },
  "hazard.high_risk_open":     { label: "high-risk hazards", groupEntity: null },
  "issue.open":                { label: "open issues",       groupEntity: null },
  "inspection.due_soon":       { label: "inspections due",   groupEntity: null },
  "client_visibility.pending": { label: "client visibility approvals", groupEntity: null },
};
export function groupItems(items, threshold = 3) {
  const byKey = {};
  for (const it of items) {
    const k = `${it.type}::${it.projectId || "-"}`;
    (byKey[k] = byKey[k] || []).push(it);
  }
  const out = [];
  for (const arr of Object.values(byKey)) {
    const meta = GROUP_META[arr[0].type];
    if (meta && arr.length > threshold) {
      const oldest = arr.reduce((a, b) => ((a.ageHours || 0) >= (b.ageHours || 0) ? a : b));
      out.push({
        ...oldest,
        id: `${arr[0].type}:group:${arr[0].projectId || "-"}`,
        grouped: true, count: arr.length,
        description: `${arr.length} ${meta.label} need attention`,
        target: { ...oldest.target, entityId: meta.groupEntity },
      });
    } else out.push(...arr);
  }
  return out;
}

// Supervisor (#4): a fixed "what must I deal with on site" order, not raw priority.
const SUPERVISOR_ORDER = {
  "hazard.high_risk_open": 0, "hazard.open": 0,
  "shift.open_too_long": 1,
  "dailylog.outstanding": 2,
  "task.overdue": 3,
  "issue.open": 4,
  "inspection.due_soon": 5,
  "task.material_not_on_site": 6, "procurement.order_by_breach": 6, "procurement.delivery_late": 6,
};

// ── Compute the queue for a user (compute-on-read) ─────────────────────────────
export async function computeActionItems({ role, userId }) {
  const effective = role === "office" ? "builder" : role;
  const preds = REGISTRY.filter(p => p.role === effective);
  const results = await Promise.all(preds.map(p => p.query({ role: effective, userId, now: Date.now() }).catch(() => [])));
  return sortItems(groupItems(results.flat()), effective);
}

export function sortItems(items, role) {
  if (role === "supervisor") {
    const rank = (it) => (it.type in SUPERVISOR_ORDER ? SUPERVISOR_ORDER[it.type] : 99);
    return [...items].sort((a, b) => (rank(a) - rank(b)) || ((b.ageHours || 0) - (a.ageHours || 0)));
  }
  return [...items].sort((a, b) => (PRIO[a.priority] - PRIO[b.priority]) || ((b.ageHours || 0) - (a.ageHours || 0)));
}
