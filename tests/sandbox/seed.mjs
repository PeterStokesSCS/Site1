// SITE1 sandbox seed — creates N orgs × 20 users × projects × entities, all tagged
// "SANDBOX — " and fully synthetic. org_id is set EXPLICITLY on every row (the Phase 2
// triggers are `if NEW.org_id is null` guarded, and auth.uid() is null under the
// service-role seed, so we never rely on them). Run AFTER reset on a clean sandbox.
//
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... npm run sandbox:seed
import { adminClient, haveSeedEnv, envSummary } from "./lib/clients.mjs";
import { writeManifest } from "./lib/manifest.mjs";
import {
  SCALE, ROLE_PLAN, SANDBOX_PREFIX, SANDBOX_PASSWORD, emailFor,
} from "./sandbox.config.js";

if (!haveSeedEnv()) {
  console.error("Missing env. Need SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.");
  console.error("Have:", envSummary());
  process.exit(1);
}

const db = adminClient();
const today = new Date().toISOString().slice(0, 10);
const ins = async (table, row) => {
  const { data, error } = await db.from(table).insert(row).select("id").single();
  if (error) throw new Error(`insert ${table}: ${error.message}`);
  return data.id;
};

async function seedOrg(orgIdx) {
  const name = `${SANDBOX_PREFIX}Co ${orgIdx}`;
  const orgId = await ins("organisations", { name, abn: `SBX${orgIdx}00000000`, plan: "standard" });

  // Users
  const users = {};
  for (const plan of ROLE_PLAN) {
    users[plan.key] = [];
    for (let n = 1; n <= plan.count; n++) {
      const email = emailFor(orgIdx, plan.key, n);
      const { data, error } = await db.auth.admin.createUser({
        email, password: SANDBOX_PASSWORD, email_confirm: true,
        user_metadata: { sandbox: true, org: orgIdx },
      });
      if (error) throw new Error(`createUser ${email}: ${error.message} (run sandbox:reset first?)`);
      const uid = data.user.id;
      const { error: pErr } = await db.from("profiles").upsert({
        id: uid, full_name: `${SANDBOX_PREFIX}${plan.key} ${orgIdx}.${n}`,
        role: plan.profileRole, company: name,
      });
      if (pErr) throw new Error(`profile ${email}: ${pErr.message}`);
      const { error: mErr } = await db.from("org_members")
        .insert({ org_id: orgId, user_id: uid, role: plan.key });
      if (mErr) throw new Error(`org_member ${email}: ${mErr.message}`);
      users[plan.key].push({ email, id: uid });
    }
  }

  const builder = users.builder[0].id;
  const supervisor = users.supervisor[0].id;
  const worker = users.worker[0].id;
  const subbie = users.subbie[0].id;
  const clientEmail = users.client[0].email;

  // Projects + memberships + entities
  const projects = [];
  let sampleIds = {}, searchTerms = {};
  for (let p = 1; p <= SCALE.projectsPerOrg; p++) {
    const street = `${SANDBOX_PREFIX}Site ${orgIdx}.${p}`;
    const projectId = await ins("projects", {
      org_id: orgId, job_number: `SBX-${orgIdx}-${p}`, street, suburb: "Sandbox",
      client_name: `${SANDBOX_PREFIX}Client ${orgIdx}.${p}`, client_email: clientEmail,
      status: "active", budget: 500000, health: "green",
    });
    // memberships: builder + all supervisors + first 4 workers
    const members = [builder, ...users.supervisor.map((u) => u.id), ...users.worker.slice(0, 4).map((u) => u.id)];
    for (const uid of members) {
      await db.from("project_members").insert({ project_id: projectId, user_id: uid, role: "member" });
    }

    const e = {};
    for (let i = 1; i <= 3; i++)
      e.tasks = await ins("tasks", {
        org_id: orgId, project_id: projectId, title: `${SANDBOX_PREFIX}Task ${orgIdx}.${p}.${i}`,
        assignee_id: worker, created_by: builder, status: "todo", priority: "medium", due_date: today,
      });
    for (let i = 1; i <= 2; i++)
      e.daily_logs = await ins("daily_logs", {
        org_id: orgId, project_id: projectId, submitted_by: worker, log_date: today,
        weather: "Fine", workers_on_site: 5, progress_notes: `${SANDBOX_PREFIX}Log ${orgIdx}.${p}.${i}`,
      });
    e.hazards = await ins("hazards", {
      org_id: orgId, project_id: projectId, title: `${SANDBOX_PREFIX}Hazard ${orgIdx}.${p}`,
      risk: "high", category: "Site", reported_by: worker, status: "open",
    });
    e.variations = await ins("variations", {
      org_id: orgId, project_id: projectId, ref: `V-${orgIdx}-${p}`,
      title: `${SANDBOX_PREFIX}Variation ${orgIdx}.${p}`, amount: 12500, status: "pending", raised_by: supervisor,
    });
    e.purchase_orders = await ins("purchase_orders", {
      org_id: orgId, project_id: projectId, subbie_id: subbie, created_by: builder,
      po_number: `PO-${orgIdx}-${p}`, trade: "Carpentry", scope: `${SANDBOX_PREFIX}PO ${orgIdx}.${p}`,
      po_value: 30000, status: "issued",
    });
    e.notification_log = await ins("notification_log", {
      type: "email", entity_type: "variation", entity_id: e.variations, recipient: clientEmail,
    });

    if (p === 1) {
      sampleIds = e;
      searchTerms = { projectStreet: street, taskTitle: `${SANDBOX_PREFIX}Task ${orgIdx}.1.1`, clientEmail };
    }
    projects.push({ id: projectId, job_number: `SBX-${orgIdx}-${p}`, street, client_email: clientEmail });
  }

  console.log(`  org ${orgIdx} (${name}): ${ROLE_PLAN.reduce((a, r) => a + r.count, 0)} users, ${projects.length} projects`);
  return { idx: orgIdx, id: orgId, name, users, projects, sampleIds, searchTerms };
}

(async () => {
  console.log(`Seeding ${SCALE.orgs} orgs × 20 users × ${SCALE.projectsPerOrg} projects ...`);
  const orgs = [];
  for (let k = 1; k <= SCALE.orgs; k++) orgs.push(await seedOrg(k));
  writeManifest({ createdAt: new Date().toISOString(), password: SANDBOX_PASSWORD, orgs });
  console.log(`Done. Manifest written. Run: npm run sandbox:test`);
})().catch((err) => { console.error("SEED FAILED:", err.message); process.exit(1); });
