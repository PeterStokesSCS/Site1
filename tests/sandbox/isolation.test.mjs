// Multi-tenant ISOLATION matrix. Signs in as REAL seeded users (anon key => RLS enforced)
// and attempts every cross-org access path. A passing run means org A could not read,
// fetch-by-id, modify, delete, search, or be notified about ANY org B data.
//
// EXPECTED TODAY: `tasks` passes (Phase 3 pilot), most other tables FAIL because they
// still use global-role RLS. The failure list is the Phase-3-rollout checklist. The suite
// auto-skips when env/manifest are absent so `npm run test:unit` stays green.
import { describe, it, expect, beforeAll } from "vitest";
import { haveTestEnv, userClient } from "./lib/clients.mjs";
import { hasManifest, readManifest } from "./lib/manifest.mjs";
import { ENTITIES } from "./sandbox.config.js";

const ready = haveTestEnv() && hasManifest();
const d = ready ? describe : describe.skip;
const orgScoped = ENTITIES.filter((e) => e.orgScoped);

d("multi-tenant isolation — org A must never reach org B", () => {
  let A, B, aBuilder, aWorker;

  beforeAll(async () => {
    const m = readManifest();
    A = m.orgs[0]; B = m.orgs[1];
    if (!B) throw new Error("Need >= 2 orgs. Reseed with SANDBOX_ORGS>=2.");
    aBuilder = (await userClient(A.users.builder[0].email, m.password)).client;
    aWorker = (await userClient(A.users.worker[0].email, m.password)).client;
  });

  describe("list leakage (A's own queries must not return B rows)", () => {
    for (const ent of orgScoped)
      it(ent.table, async () => {
        const { data, error } = await aBuilder.from(ent.table).select("id, org_id");
        expect(error).toBeNull();
        const leaked = (data || []).filter((r) => r.org_id === B.id);
        expect(leaked.length, `${leaked.length} ${ent.table} row(s) from org B visible to org A`).toBe(0);
      });
  });

  describe("direct id read (A fetches B's record id)", () => {
    for (const ent of orgScoped)
      it(ent.table, async () => {
        const { data } = await aBuilder.from(ent.table).select("id").eq("id", B.sampleIds[ent.table]);
        expect((data || []).length, `org A fetched org B ${ent.table}`).toBe(0);
      });
  });

  it("write tampering — A cannot UPDATE B's task", async () => {
    const { data } = await aBuilder.from("tasks").update({ title: "HIJACKED" })
      .eq("id", B.sampleIds.tasks).select("id");
    expect((data || []).length, "org A updated an org B task").toBe(0);
  });

  it("write tampering — A cannot DELETE B's hazard", async () => {
    const { data } = await aBuilder.from("hazards").delete()
      .eq("id", B.sampleIds.hazards).select("id");
    expect((data || []).length, "org A deleted an org B hazard").toBe(0);
  });

  it("search leakage — A cannot find B's project by name", async () => {
    const { data } = await aBuilder.from("projects").select("id").ilike("street", B.searchTerms.projectStreet);
    expect((data || []).length, "org A search surfaced an org B project").toBe(0);
  });

  it("search leakage — A cannot find B's task by title", async () => {
    const { data } = await aBuilder.from("tasks").select("id").ilike("title", B.searchTerms.taskTitle);
    expect((data || []).length, "org A search surfaced an org B task").toBe(0);
  });

  it("notification leakage — A's worker sees no B-recipient notifications", async () => {
    const { data } = await aWorker.from("notification_log").select("recipient");
    const bDomain = `@org${B.idx}.sandbox.test`;
    const leaked = (data || []).filter((r) => (r.recipient || "").includes(bDomain));
    expect(leaked.length, "org A worker saw org B notifications").toBe(0);
  });
});
