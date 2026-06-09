// SITE1 sandbox configuration — scale, roles, and the entities the isolation/RBAC
// suites exercise. Everything here is synthetic; no real client/subbie identities.

export const SANDBOX_PREFIX = "SANDBOX — ";

// Scale. Override via env for quick smoke runs (e.g. SANDBOX_ORGS=2).
export const SCALE = {
  orgs: Number(process.env.SANDBOX_ORGS || 5),
  projectsPerOrg: Number(process.env.SANDBOX_PROJECTS || 3),
};

// 20 users per org, across every role. `profileRole` matches the profiles.role CHECK
// constraint (note: subcontractor, not "subbie").
export const ROLE_PLAN = [
  { key: "builder",    profileRole: "builder",       count: 1 }, // owner
  { key: "office",     profileRole: "office",        count: 2 }, // admin
  { key: "supervisor", profileRole: "supervisor",    count: 3 },
  { key: "worker",     profileRole: "worker",        count: 8 }, // carpenter / field
  { key: "client",     profileRole: "client",        count: 3 },
  { key: "subbie",     profileRole: "subcontractor", count: 3 },
];

// Shared sandbox password (sandbox only; never a real credential). Override via env.
export const SANDBOX_PASSWORD = process.env.SANDBOX_PASSWORD || "Sandbox!Test-2026";

// Deterministic synthetic email so seed/reset/tests agree without sharing state.
export const emailFor = (orgIdx, roleKey, n) =>
  `${roleKey}${n}@org${orgIdx}.sandbox.test`;

// Entities the cross-org matrix walks. orgScoped=false => no org_id column (tested by
// recipient/ownership instead). searchField is used for the search-leakage cases.
export const ENTITIES = [
  { table: "tasks",            orgScoped: true,  searchField: "title" },
  { table: "daily_logs",       orgScoped: true,  searchField: "progress_notes" },
  { table: "hazards",          orgScoped: true,  searchField: "title" },
  { table: "variations",       orgScoped: true,  searchField: "title" },
  { table: "purchase_orders",  orgScoped: true,  searchField: "scope" },
  { table: "projects",         orgScoped: true,  searchField: "street" },
  { table: "notification_log", orgScoped: false, searchField: null },
];
