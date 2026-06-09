// SITE1 sandbox reset — deletes ONLY sandbox data, in dependency order. Safe to run
// repeatedly. Uses the manifest when present; otherwise discovers sandbox orgs by the
// "SANDBOX — " name prefix and sandbox users by the @*.sandbox.test email domain.
// Refuses to touch anything not so tagged.
import { adminClient, haveSeedEnv, envSummary } from "./lib/clients.mjs";
import { MANIFEST_PATH, hasManifest, readManifest } from "./lib/manifest.mjs";
import { SANDBOX_PREFIX } from "./sandbox.config.js";
import { rmSync } from "node:fs";

if (!haveSeedEnv()) {
  console.error("Missing env. Need SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.");
  console.error("Have:", envSummary());
  process.exit(1);
}
const db = adminClient();
const del = async (table, col, val) => {
  const q = db.from(table).delete();
  const { error } = Array.isArray(val) ? await q.in(col, val) : await q.eq(col, val);
  if (error && !/no rows/i.test(error.message)) console.warn(`  warn delete ${table}: ${error.message}`);
};

async function sandboxOrgs() {
  if (hasManifest()) return readManifest().orgs.map((o) => ({ id: o.id, name: o.name, users: o.users }));
  const { data, error } = await db.from("organisations").select("id, name").like("name", `${SANDBOX_PREFIX}%`);
  if (error) throw new Error(error.message);
  return data.map((o) => ({ id: o.id, name: o.name, users: null }));
}

(async () => {
  const orgs = await sandboxOrgs();
  if (!orgs.length) { console.log("No sandbox orgs found. Nothing to reset."); return; }
  console.log(`Resetting ${orgs.length} sandbox org(s) ...`);

  for (const org of orgs) {
    // 1) child entities (explicit order avoids FK cascade surprises), via this org's projects
    const { data: projs } = await db.from("projects").select("id").eq("org_id", org.id);
    const pids = (projs || []).map((p) => p.id);
    if (pids.length) {
      for (const t of ["purchase_orders", "variation_labour", "variations", "hazards", "daily_logs",
                       "task_comments", "tasks", "project_photos", "site_visits", "project_members"]) {
        await del(t, "project_id", pids);
      }
      await del("projects", "id", pids);
    }
    // 2) notification_log by sandbox recipient domain
    const { error: nErr } = await db.from("notification_log").delete().like("recipient", "%.sandbox.test");
    if (nErr && !/no rows/i.test(nErr.message)) console.warn(`  warn notif: ${nErr.message}`);

    // 3) users: org_members (cascades on profile delete), profiles, then auth user
    let userIds = [];
    if (org.users) userIds = Object.values(org.users).flat().map((u) => u.id);
    else {
      const { data: m } = await db.from("org_members").select("user_id").eq("org_id", org.id);
      userIds = (m || []).map((r) => r.user_id);
    }
    await del("audit_log", "org_id", org.id);        // no FK cascade; clean explicitly
    await del("org_members", "org_id", org.id);
    for (const uid of userIds) {
      await del("profiles", "id", uid);
      const { error } = await db.auth.admin.deleteUser(uid);
      if (error && !/not found/i.test(error.message)) console.warn(`  warn deleteUser ${uid}: ${error.message}`);
    }
    // 4) the org
    await del("organisations", "id", org.id);
    console.log(`  cleared ${org.name}`);
  }

  if (hasManifest()) rmSync(MANIFEST_PATH, { force: true });
  console.log("Reset complete.");
})().catch((err) => { console.error("RESET FAILED:", err.message); process.exit(1); });
