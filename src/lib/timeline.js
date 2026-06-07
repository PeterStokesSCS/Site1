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

// Add whole days to a date-only string (UTC math, returns 'YYYY-MM-DD').
export function addDays(dateStr, days) {
  if (!dateStr) return null;
  const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Number(days));
  return d.toISOString().slice(0, 10);
}
