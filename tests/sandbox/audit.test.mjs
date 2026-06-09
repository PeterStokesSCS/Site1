// Audit log (R3). Verifies the record_audit() write + audit_log read path, and that the
// log is readable ONLY by the row's org admins — not by non-admins, not across orgs.
// Skips gracefully (per test) when supabase_migration_audit_log.sql hasn't been applied yet.
import { describe, it, expect, beforeAll } from "vitest";
import { haveTestEnv, userClient } from "./lib/clients.mjs";
import { hasManifest, readManifest } from "./lib/manifest.mjs";

const ready = haveTestEnv() && hasManifest();
const d = ready ? describe : describe.skip;

d("audit log (R3)", () => {
  let A, B, builderA, workerA, builderB, auditReady = false;

  beforeAll(async () => {
    const m = readManifest();
    A = m.orgs[0]; B = m.orgs[1];
    builderA = (await userClient(A.users.builder[0].email, m.password)).client;
    workerA = (await userClient(A.users.worker[0].email, m.password)).client;
    builderB = (await userClient(B.users.builder[0].email, m.password)).client;
    const { error } = await builderA.from("audit_log").select("id").limit(1);
    auditReady = !(error && /audit_log|does not exist|schema cache|relation/i.test(error.message));
  });

  it("record_audit writes a row the org admin can read", async (ctx) => {
    if (!auditReady) return ctx.skip();
    const { error: rpcErr } = await builderA.rpc("record_audit", {
      p_org: A.id, p_entity_type: "task", p_entity_id: null,
      p_action: "create", p_success: true, p_detail: { probe: true },
    });
    expect(rpcErr).toBeNull();
    const { data, error } = await builderA.from("audit_log").select("id, org_id").eq("org_id", A.id).limit(5);
    expect(error).toBeNull();
    expect((data || []).length).toBeGreaterThan(0);
  });

  it("non-admin (field worker) cannot read the audit log", async (ctx) => {
    if (!auditReady) return ctx.skip();
    const { data } = await workerA.from("audit_log").select("id").limit(5);
    expect((data || []).length, "field worker read audit_log").toBe(0);
  });

  it("admin cannot read another org's audit rows", async (ctx) => {
    if (!auditReady) return ctx.skip();
    const { data } = await builderB.from("audit_log").select("id, org_id").eq("org_id", A.id);
    expect((data || []).length, "org B admin read org A audit").toBe(0);
  });
});
