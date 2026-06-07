// SITE1 — Timeline Engine helpers (Phase 2).
// Pure, testable date/milestone logic. The baseline (planned_date) and forecast_date
// are PERSISTED; variance and status are DERIVED here, never stored.

// Default Victorian residential stage skeleton, seeded on project creation.
// Aligns with the mandatory VIC stage inspections.
export const VIC_MILESTONES = [
  { key: "site_start",            label: "Site start",            sequence: 1 },
  { key: "base",                  label: "Base stage",            sequence: 2 },
  { key: "frame",                 label: "Frame stage",           sequence: 3 },
  { key: "lock_up",               label: "Lock-up stage",         sequence: 4 },
  { key: "fixing",                label: "Fixing stage",          sequence: 5 },
  { key: "practical_completion",  label: "Practical completion",  sequence: 6 },
];

// Whole-day difference a − b (date-only ISO 'YYYY-MM-DD' or Date). Positive = a after b.
// All date-only math is done in UTC so it never shifts by the runner's timezone.
export function daysBetween(a, b) {
  if (!a || !b) return null;
  const da = Date.parse(`${String(a).slice(0, 10)}T00:00:00Z`);
  const db = Date.parse(`${String(b).slice(0, 10)}T00:00:00Z`);
  return Math.round((da - db) / 86400000);
}

// Slip in days = forecast − planned (positive = behind baseline).
export function milestoneVariance(m) {
  return daysBetween(m.forecast_date, m.planned_date);
}

// Derived milestone status (never persisted). at_risk when forecast slips past threshold.
export function milestoneStatus(m, slipThresholdDays = 3) {
  if (m.actual_date || m.completed_date || m.done) return "complete";
  const variance = milestoneVariance(m);
  if (variance != null && variance > slipThresholdDays) return "at_risk";
  // "in_progress" = the earliest not-complete milestone with a forecast on/before today
  return "upcoming";
}

// must_order_by = required_by_date − lead_time_days (null if either missing → no risk).
export function mustOrderBy(requiredByDate, leadTimeDays) {
  if (!requiredByDate || leadTimeDays == null) return null;
  return addDays(requiredByDate, -Number(leadTimeDays));
}

// Which milestones an EOT applies to: the chosen one, plus all later stages if cascading
// (a delay at one stage pushes everything after it).
export function eotAffectedMilestones(milestones, fromMilestoneId, cascade = true) {
  const from = milestones.find(m => m.id === fromMilestoneId);
  if (!from) return [];
  if (!cascade) return [from];
  return milestones.filter(m => (m.sort_order ?? 0) >= (from.sort_order ?? 0));
}

// Add whole days to a date-only string (UTC math, returns 'YYYY-MM-DD').
export function addDays(dateStr, days) {
  if (!dateStr) return null;
  const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Number(days));
  return d.toISOString().slice(0, 10);
}

// ── Timeline Engine rule logic (pure; ISO 'YYYY-MM-DD' compares chronologically) ──
// `today` = Melbourne 'YYYY-MM-DD'. Every rule returns nothing when a required input
// is missing (anti-false-alarm) — it never guesses.
const D = (x) => x ? String(x).slice(0, 10) : null;
const ORDERED = (p) => !!p.ordered_date || ["ordered", "delivered", "received"].includes(p.status);
const DELIVERED = (p) => !!p.actual_delivery_date || ["delivered", "received"].includes(p.status);

export function isWithinDays(dateStr, n, today) {
  const d = D(dateStr);
  return !!d && d >= today && d <= addDays(today, n);
}

// procurement.order_by_breach — needs required-by + lead time, not yet ordered, past must-order-by.
export function breachesOrderBy(p, today) {
  if (!p.required_by_date || p.lead_time_days == null) return false; // missing input → silent
  if (ORDERED(p)) return false;                                       // resolved
  const mob = mustOrderBy(p.required_by_date, p.lead_time_days);
  return !!mob && today > mob;
}

// procurement.delivery_late — ordered, quoted delivery lands after it's needed.
export function isDeliveryLate(p) {
  if (!ORDERED(p) || DELIVERED(p)) return false;
  if (!p.expected_delivery_date || !p.required_by_date) return false;
  return D(p.expected_delivery_date) > D(p.required_by_date);
}

// inspection.due_soon — required within N days (default 2), not completed.
export function inspectionDueSoon(q, today, n = 2) {
  if (["completed", "approved", "passed"].includes(q.status)) return false;
  return isWithinDays(q.due_date, n, today);
}

// task.material_not_on_site — task starts within N days (default 5), depends on undelivered procurement.
export function materialNotOnSite(tasks, procById, today, n = 5) {
  return (tasks || []).filter(t => {
    if (t.status === "completed" || !isWithinDays(t.start_date, n, today)) return false;
    const deps = t.depends_on_procurement_ids || [];
    return deps.length > 0 && deps.some(id => { const p = procById[id]; return p && !DELIVERED(p); });
  });
}

// labour.double_booked — same person allocated to >1 project on the same date.
export function doubleBooked(allocations) {
  const map = {};
  for (const a of allocations || []) {
    const k = `${a.worker_or_subby_id}|${D(a.allocation_date)}`;
    (map[k] = map[k] || new Set()).add(a.project_id);
  }
  return Object.entries(map).filter(([, projs]) => projs.size > 1).map(([k]) => {
    const [worker, date] = k.split("|"); return { worker, date };
  });
}
